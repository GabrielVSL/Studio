import express from 'express';
import axios from 'axios';
import cors from 'cors';
import 'dotenv/config';

const app = express();

// ==========================================
// HARDENING DE SEGURANÇA DO SERVIDOR EXPRESS
// ==========================================
app.disable('x-powered-by');
app.set('trust proxy', 1);

const IS_VERCEL_PROD = Boolean(process.env.VERCEL);

const STATIC_ALLOWED_ORIGINS = new Set(
  [
    'https://studiofilm.vercel.app',
    // Em produção na Vercel, bloqueia origens localhost (evita abuso local contra a API pública)
    ...(!IS_VERCEL_PROD
      ? ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173']
      : []),
    process.env.ALLOWED_ORIGIN?.trim(),
  ].filter(Boolean)
);

const VERCEL_PREVIEW_REGEX = /^https:\/\/(studiofilm|bhflix)-[a-z0-9-]+\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requisições same-origin (sem header Origin) e origens autorizadas
      if (
        !origin ||
        STATIC_ALLOWED_ORIGINS.has(origin) ||
        VERCEL_PREVIEW_REGEX.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'HEAD', 'OPTIONS'],
    maxAge: 86400,
  })
);

// Headers defensivos, bloqueio de escrita, URL gigante e HTTP Parameter Pollution (HPP)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Apenas leitura permitida (bloqueia POST/PUT/DELETE/PATCH)
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Bloqueia URLs excessivamente longas ou com caracteres de controle (anti-DoS / log injection)
  if ((req.originalUrl || '').length > 512 || /[\r\n\0]/.test(req.originalUrl || '')) {
    return res.status(414).json({ error: 'Requisição inválida' });
  }

  // Rejeita payloads em requisições GET
  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > 0) {
    return res.status(400).json({ error: 'Corpo não permitido em requisições GET' });
  }

  // Anti-HPP: se algum parâmetro de query vier duplicado como array, rejeita
  if (req.query && typeof req.query === 'object') {
    for (const val of Object.values(req.query)) {
      if (Array.isArray(val)) {
        return res.status(400).json({ error: 'Parâmetros de consulta duplicados não permitidos' });
      }
    }
  }

  return next();
});

// Rate limiter por IP real com teto rígido de memória (anti-DoS / anti-OOM / anti-spoofing)
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 120;
const MAX_RATE_BUCKETS = 2000;
const rateBuckets = new Map();

const WATCHMODE_RATE_MAX = 25; // Protege a cota mensal gratuita da Watchmode (1000 req/mês)
const watchmodeRateBuckets = new Map();

const getClientIp = (req) => {
  // Na Vercel, x-real-ip / x-vercel-forwarded-for é definido pela borda; fallback para req.ip (trust proxy 1)
  const vercelIp = req.headers['x-real-ip']?.toString().trim();
  return vercelIp || req.ip || req.socket?.remoteAddress || 'unknown';
};

const consumeRateLimit = (store, key, maxRequests, windowMs) => {
  const now = Date.now();
  let bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    store.set(key, bucket);
  } else {
    bucket.count += 1;
  }

  // Limpeza com teto rígido FIFO (impossível estourar memória mesmo sob flood de IPs)
  if (store.size > MAX_RATE_BUCKETS) {
    for (const [k, v] of store.entries()) {
      if (now > v.resetAt) store.delete(k);
      if (store.size <= MAX_RATE_BUCKETS * 0.75) break;
    }
    while (store.size > MAX_RATE_BUCKETS) {
      const oldest = store.keys().next().value;
      store.delete(oldest);
    }
  }

  return {
    allowed: bucket.count <= maxRequests,
    remaining: Math.max(0, maxRequests - bucket.count),
    resetSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
};

app.use((req, res, next) => {
  const ip = getClientIp(req);
  const status = consumeRateLimit(rateBuckets, ip, RATE_MAX_REQUESTS, RATE_WINDOW_MS);

  res.setHeader('X-RateLimit-Limit', String(RATE_MAX_REQUESTS));
  res.setHeader('X-RateLimit-Remaining', String(status.remaining));
  res.setHeader('X-RateLimit-Reset', String(status.resetSeconds));

  if (!status.allowed) {
    res.setHeader('Retry-After', String(status.resetSeconds));
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em breve.' });
  }

  return next();
});

// ==========================================
// CLIENTE HTTP TMDB & WATCHMODE (TIMEOUT + SEM REDIRECTS)
// ==========================================
const API_KEY = process.env.API_KEY?.trim() || '';
const WATCHMODE_API_KEY = process.env.WATCHMODE_API_KEY?.trim() || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const tmdbClient = axios.create({
  baseURL: TMDB_BASE,
  timeout: 8000,
  maxRedirects: 0, // Evita vazamento da api_key em redirecionamentos externos
  maxContentLength: 5 * 1024 * 1024,
});

const watchmodeClient = axios.create({
  baseURL: 'https://api.watchmode.com/v1',
  timeout: 7000,
  maxRedirects: 0,
  maxContentLength: 2 * 1024 * 1024,
});

const WATCHMODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const WATCHMODE_EMPTY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const watchmodeCache = new Map();

const PRIVATE_HOST_REGEX =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[|::1)/i;

const isSafeHttpsUrl = (raw) => {
  if (typeof raw !== 'string' || raw.length > 500) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== '443') return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || PRIVATE_HOST_REGEX.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// Verifica presença da API_KEY antes de bater no TMDB (exceto rota independente Watchmode)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/watch-links/')) {
    return next();
  }
  if (!API_KEY) {
    return res.status(503).json({ error: 'Serviço temporariamente indisponível' });
  }
  return next();
});

const tmdbGet = (endpoint, params = {}) =>
  tmdbClient.get(endpoint, {
    params: {
      api_key: API_KEY,
      language: 'pt-BR',
      ...params,
    },
  });

// ==========================================
// VALIDADORES ESTRITOS (ANTI-SSRF / PATH TRAVERSAL)
// ==========================================
const NUMERIC_ID_REGEX = /^\d{1,10}$/;
const SEASON_REGEX = /^\d{1,3}$/;
const YEAR_REGEX = /^(19|20)\d{2}$/;
const GENRE_REGEX = /^\d{1,6}([|,]\d{1,6}){0,6}$/;
const PROVIDER_REGEX = /^\d{1,6}([|,]\d{1,6}){0,10}$/;

const ALLOWED_SORTS = new Set([
  'popularity.desc',
  'vote_average.desc',
  'first_air_date.desc',
  'primary_release_date.desc',
]);

const isValidId = (val) => typeof val === 'string' && NUMERIC_ID_REGEX.test(val);
const isValidSeason = (val) => typeof val === 'string' && SEASON_REGEX.test(val);

const parsePage = (raw) => {
  const n = Number.parseInt(String(raw ?? '1'), 10);
  if (Number.isNaN(n) || n < 1) return 1;
  return Math.min(n, 500); // Limite oficial da API TMDB
};

const setEdgeCache = (res, seconds = 300) => {
  res.setHeader(
    'Cache-Control',
    `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`
  );
};

// Log seguro (nunca imprime URLs contendo api_key)
const logSafeError = (context, error) => {
  const status = error?.response?.status || 'NETWORK';
  console.error(`[studio API] ${context} (status: ${status})`);
};

// Principais provedores de streaming no Brasil (IDs oficiais TMDB/JustWatch)
const CURATED_BR_PROVIDER_IDS = [8, 119, 337, 1899, 350, 307, 531, 283];

const FALLBACK_BR_PROVIDERS = [
  { provider_id: 8, provider_name: 'Netflix', logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg' },
  { provider_id: 119, provider_name: 'Amazon Prime Video', logo_path: '/pvske1MyAoymrs5bguRfVqYiM9a.jpg' },
  { provider_id: 337, provider_name: 'Disney+', logo_path: '/97yvRBw1GzX7fXprcF80er19ot.jpg' },
  { provider_id: 1899, provider_name: 'Max', logo_path: '/jbe4gVSfRlbPTdESXhEKpornsfu.jpg' },
  { provider_id: 350, provider_name: 'Apple TV+', logo_path: '/2E03IAZsX4ZaUqM7tXlctEPMGWS.jpg' },
  { provider_id: 307, provider_name: 'Globoplay', logo_path: '/7Cg8esVVXOijXAm1f1vrS7jVjcN.jpg' },
  { provider_id: 531, provider_name: 'Paramount+', logo_path: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg' },
  { provider_id: 283, provider_name: 'Crunchyroll', logo_path: '/mXeC4TrcgdU6ltE9bCBCEORwSQR.jpg' },
];

const attachMediaType = (items = [], mediaType) =>
  items.map((item) => ({
    ...item,
    media_type: item.media_type || mediaType,
  }));

// ==========================================
// HERO SHOWCASE ENRIQUECIDO (COM STREAMING + DURAÇÃO/EPISÓDIOS + TRAILER)
// ==========================================
app.get('/api/hero', async (req, res) => {
  try {
    const trendingRes = await tmdbGet('/trending/all/day', { page: 1 });
    const candidates = (trendingRes.data.results || [])
      .filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && item.backdrop_path && item.poster_path)
      .slice(0, 5);

    const enriched = await Promise.all(
      candidates.map(async (item) => {
        const mType = item.media_type;
        try {
          const detailRes = await tmdbGet(`/${mType}/${item.id}`, {
            append_to_response: 'watch/providers,videos',
            include_video_language: 'pt,en',
          });
          const d = detailRes.data || {};
          const brProviders = d['watch/providers']?.results?.BR || {};
          const brPrimary =
            brProviders.free?.[0] ||
            brProviders.ads?.[0] ||
            brProviders.flatrate?.[0] ||
            null;
          const ytVideos = (d.videos?.results || []).filter((v) => v.site === 'YouTube');
          ytVideos.sort((a, b) => {
            const score = (v) =>
              (v.iso_639_1 === 'pt' ? 4 : 0) +
              (v.type === 'Trailer' ? 3 : v.type === 'Teaser' ? 2 : 1) +
              (v.official ? 1 : 0);
            return score(b) - score(a);
          });

          return {
            ...item,
            media_type: mType,
            genres: (d.genres || []).slice(0, 3),
            runtime: d.runtime || null,
            number_of_episodes: d.number_of_episodes || null,
            number_of_seasons: d.number_of_seasons || null,
            primary_provider: brPrimary,
            trailer_key: ytVideos[0]?.key || null,
          };
        } catch {
          return { ...item, media_type: mType };
        }
      })
    );

    setEdgeCache(res, 600);
    res.json({ results: enriched });
  } catch (error) {
    logSafeError('hero', error);
    res.status(502).json({ error: 'Erro ao buscar destaques' });
  }
});

// ==========================================
// TENDÊNCIAS (FILMES + SÉRIES)
// ==========================================
app.get('/api/trending', async (req, res) => {
  const type = ['all', 'movie', 'tv'].includes(req.query.type) ? req.query.type : 'all';
  const page = parsePage(req.query.page);

  try {
    const response = await tmdbGet(`/trending/${type}/day`, { page });
    const filtered = (response.data.results || [])
      .filter((item) => item.media_type !== 'person')
      .map((item) => ({
        ...item,
        media_type: item.media_type || (type === 'all' ? (item.title ? 'movie' : 'tv') : type),
      }));

    setEdgeCache(res, 300);
    res.json({ ...response.data, results: filtered });
  } catch (error) {
    logSafeError('trending', error);
    res.status(502).json({ error: 'Erro ao buscar tendências' });
  }
});

// ==========================================
// SÉRIES
// ==========================================
app.get('/api/newSeries', async (req, res) => {
  const page = parsePage(req.query.page);
  try {
    const response = await tmdbGet('/tv/on_the_air', {
      include_adult: false,
      page,
    });
    setEdgeCache(res, 300);
    res.json({
      ...response.data,
      results: attachMediaType(response.data.results, 'tv'),
    });
  } catch (error) {
    logSafeError('newSeries', error);
    res.status(502).json({ error: 'Erro ao buscar novas séries' });
  }
});

app.get('/api/series', async (req, res) => {
  const page = parsePage(req.query.page);
  try {
    const response = await tmdbGet('/trending/tv/day', {
      include_adult: false,
      page,
    });
    setEdgeCache(res, 300);
    res.json({
      ...response.data,
      results: attachMediaType(response.data.results, 'tv'),
    });
  } catch (error) {
    logSafeError('series', error);
    res.status(502).json({ error: 'Erro ao buscar séries em tendência' });
  }
});

// ==========================================
// FILMES (POPULARES E NOS CINEMAS)
// ==========================================
app.get('/api/movies/popular', async (req, res) => {
  const page = parsePage(req.query.page);
  try {
    const response = await tmdbGet('/movie/popular', {
      include_adult: false,
      region: 'BR',
      page,
    });
    setEdgeCache(res, 300);
    res.json({
      ...response.data,
      results: attachMediaType(response.data.results, 'movie'),
    });
  } catch (error) {
    logSafeError('movies/popular', error);
    res.status(502).json({ error: 'Erro ao buscar filmes populares' });
  }
});

app.get('/api/movies/now_playing', async (req, res) => {
  const page = parsePage(req.query.page);
  try {
    const response = await tmdbGet('/movie/now_playing', {
      include_adult: false,
      region: 'BR',
      page,
    });
    setEdgeCache(res, 300);
    res.json({
      ...response.data,
      results: attachMediaType(response.data.results, 'movie'),
    });
  } catch (error) {
    logSafeError('movies/now_playing', error);
    res.status(502).json({ error: 'Erro ao buscar filmes em cartaz' });
  }
});

app.get('/api/movies/top_rated', async (req, res) => {
  const page = parsePage(req.query.page);
  try {
    const response = await tmdbGet('/movie/top_rated', {
      include_adult: false,
      region: 'BR',
      page,
    });
    setEdgeCache(res, 600);
    res.json({
      ...response.data,
      results: attachMediaType(response.data.results, 'movie'),
    });
  } catch (error) {
    logSafeError('movies/top_rated', error);
    res.status(502).json({ error: 'Erro ao buscar filmes aclamados' });
  }
});

// ==========================================
// ARTISTAS / ESTRELAS EM DESTAQUE
// ==========================================
app.get('/api/people/popular', async (req, res) => {
  const page = parsePage(req.query.page);
  try {
    const response = await tmdbGet('/trending/person/week', { page });
    const filtered = (response.data.results || [])
      .filter((p) => p && !p.adult && p.profile_path && Array.isArray(p.known_for) && p.known_for.length > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        profile_path: p.profile_path,
        known_for_department: p.known_for_department || 'Acting',
        popularity: p.popularity || 0,
        known_for: (p.known_for || []).slice(0, 2).map((k) => ({
          id: k.id,
          media_type: k.media_type === 'movie' ? 'movie' : 'tv',
          title: k.title || k.name || '',
          vote_average: k.vote_average || 0,
        })),
      }));
    setEdgeCache(res, 900);
    res.json({ results: filtered });
  } catch (error) {
    logSafeError('people/popular', error);
    res.status(502).json({ error: 'Erro ao buscar artistas em destaque' });
  }
});

// ==========================================
// LINKS DIRETOS DE STREAMING NO BRASIL (WATCHMODE + CACHE 24H)
// ==========================================
app.get('/api/watch-links/:type/:id', async (req, res) => {
  const type = req.params.type === 'movie' ? 'movie' : req.params.type === 'tv' ? 'tv' : null;
  const { id } = req.params;

  if (!type || !isValidId(id)) {
    return res.status(400).json({ error: 'Parâmetros inválidos' });
  }

  if (!WATCHMODE_API_KEY) {
    return res.json({ sources: [], enabled: false });
  }

  const cacheKey = `${type}-${id}`;
  const cached = watchmodeCache.get(cacheKey);
  const ttl = cached?.sources?.length > 0 ? WATCHMODE_CACHE_TTL_MS : WATCHMODE_EMPTY_CACHE_TTL_MS;
  if (cached && Date.now() - cached.timestamp < ttl) {
    setEdgeCache(res, cached.sources.length > 0 ? 86400 : 21600);
    return res.json({ sources: cached.sources, enabled: true, cached: true });
  }

  // Rate limit dedicado para consultas não-cacheadas na Watchmode (protege a cota mensal)
  const wmLimit = consumeRateLimit(
    watchmodeRateBuckets,
    getClientIp(req),
    WATCHMODE_RATE_MAX,
    RATE_WINDOW_MS
  );
  if (!wmLimit.allowed) {
    res.setHeader('Retry-After', String(wmLimit.resetSeconds));
    return res.status(429).json({ sources: [], enabled: true, error: 'Limite temporário atingido' });
  }

  try {
    const response = await watchmodeClient.get(`/title/${type}-${id}/sources/`, {
      params: {
        apiKey: WATCHMODE_API_KEY,
        regions: 'BR',
      },
    });

    const rawSources = Array.isArray(response.data) ? response.data : [];
    const sources = rawSources
      .filter((s) => s && (!s.region || s.region === 'BR') && isSafeHttpsUrl(s.web_url))
      .map((s) => ({
        source_id: s.source_id,
        name: String(s.name || ''),
        type: String(s.type || ''),
        web_url: s.web_url,
        format: s.format || null,
      }));

    if (watchmodeCache.size >= 500) {
      const oldestKey = watchmodeCache.keys().next().value;
      watchmodeCache.delete(oldestKey);
    }
    watchmodeCache.set(cacheKey, { timestamp: Date.now(), sources });

    setEdgeCache(res, sources.length > 0 ? 86400 : 21600);
    return res.json({ sources, enabled: true });
  } catch (error) {
    logSafeError('watch-links', error);
    // Cacheia resposta vazia temporariamente (6h) para não martelar a cota em falhas repetidas
    if (watchmodeCache.size >= 500) {
      const oldestKey = watchmodeCache.keys().next().value;
      watchmodeCache.delete(oldestKey);
    }
    watchmodeCache.set(cacheKey, { timestamp: Date.now(), sources: [] });
    return res.json({ sources: [], enabled: true });
  }
});

// ==========================================
// DETALHES (SÉRIES E FILMES + REVIEWS FALLBACK EN)
// ==========================================
const fetchDetailsWithReviews = async (mediaType, id) => {
  const response = await tmdbGet(`/${mediaType}/${id}`, {
    append_to_response: 'credits,videos,recommendations,watch/providers,reviews',
    include_video_language: 'pt,en',
  });

  const data = {
    ...response.data,
    media_type: mediaType,
  };

  if (data.recommendations?.results) {
    data.recommendations.results = attachMediaType(data.recommendations.results, mediaType);
  }

  if (!data.reviews?.results || data.reviews.results.length === 0) {
    try {
      const enReviews = await tmdbGet(`/${mediaType}/${id}/reviews`, {
        language: 'en-US',
        page: 1,
      });
      data.reviews = enReviews.data;
    } catch {
      // Mantém vazio caso falhe
    }
  }

  return data;
};

app.get('/api/series/:id', async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: 'ID de série inválido' });
  }
  try {
    const data = await fetchDetailsWithReviews('tv', req.params.id);
    setEdgeCache(res, 600);
    res.json(data);
  } catch (error) {
    logSafeError('series/:id', error);
    const status = error?.response?.status === 404 ? 404 : 502;
    res.status(status).json({ error: 'Erro ao buscar os detalhes da série' });
  }
});

app.get('/api/movies/:id', async (req, res) => {
  if (!isValidId(req.params.id)) {
    return res.status(400).json({ error: 'ID de filme inválido' });
  }
  try {
    const data = await fetchDetailsWithReviews('movie', req.params.id);
    setEdgeCache(res, 600);
    res.json(data);
  } catch (error) {
    logSafeError('movies/:id', error);
    const status = error?.response?.status === 404 ? 404 : 502;
    res.status(status).json({ error: 'Erro ao buscar os detalhes do filme' });
  }
});

// ==========================================
// EPISÓDIOS DE TEMPORADA
// ==========================================
app.get('/api/series/:id/season/:seasonNumber', async (req, res) => {
  const { id, seasonNumber } = req.params;
  if (!isValidId(id) || !isValidSeason(seasonNumber)) {
    return res.status(400).json({ error: 'Parâmetros de temporada inválidos' });
  }
  try {
    const response = await tmdbGet(`/tv/${id}/season/${seasonNumber}`);
    setEdgeCache(res, 600);
    res.json(response.data);
  } catch (error) {
    logSafeError('season', error);
    res.status(502).json({ error: 'Erro ao buscar a temporada' });
  }
});

// ==========================================
// VÍDEOS / TRAILERS (MODAL)
// ==========================================
app.get('/api/videos/:type/:id', async (req, res) => {
  const type = req.params.type === 'movie' ? 'movie' : req.params.type === 'tv' ? 'tv' : null;
  const { id } = req.params;

  if (!type || !isValidId(id)) {
    return res.status(400).json({ error: 'Parâmetros inválidos para vídeos' });
  }

  try {
    const ptRes = await tmdbGet(`/${type}/${id}/videos`, { language: 'pt-BR' });
    let videos = (ptRes.data.results || []).filter((v) => v.site === 'YouTube');

    if (videos.length === 0) {
      const enRes = await tmdbGet(`/${type}/${id}/videos`, { language: 'en-US' });
      videos = (enRes.data.results || []).filter((v) => v.site === 'YouTube');
    }

    videos.sort((a, b) => {
      const score = (v) =>
        (v.type === 'Trailer' ? 3 : v.type === 'Teaser' ? 2 : 1) + (v.official ? 1 : 0);
      return score(b) - score(a);
    });

    setEdgeCache(res, 900);
    res.json({ results: videos });
  } catch (error) {
    logSafeError('videos', error);
    res.status(502).json({ error: 'Erro ao buscar vídeos' });
  }
});

// ==========================================
// PESQUISA UNIFICADA (MULTI: FILMES + SÉRIES)
// ==========================================
app.get('/api/search', async (req, res) => {
  const rawQuery = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  if (!rawQuery || rawQuery.length > 120) {
    return res.status(400).json({ error: 'Termo de busca inválido' });
  }

  const type = ['multi', 'tv', 'movie'].includes(req.query.type) ? req.query.type : 'multi';
  const page = parsePage(req.query.page);
  const endpoint = type === 'tv' ? '/search/tv' : type === 'movie' ? '/search/movie' : '/search/multi';

  try {
    const response = await tmdbGet(endpoint, {
      query: rawQuery,
      include_adult: false,
      page,
    });

    let results = response.data.results || [];
    if (type === 'multi') {
      results = results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv');
    } else {
      results = attachMediaType(results, type);
    }

    setEdgeCache(res, 120);
    res.json({ ...response.data, results });
  } catch (error) {
    logSafeError('search', error);
    res.status(502).json({ error: 'Erro na busca' });
  }
});

// ==========================================
// GÊNEROS (TV / MOVIE)
// ==========================================
app.get('/api/genres', async (req, res) => {
  const type = req.query.type === 'movie' ? 'movie' : 'tv';
  try {
    const response = await tmdbGet(`/genre/${type}/list`);
    setEdgeCache(res, 86400);
    res.json(response.data);
  } catch (error) {
    logSafeError('genres', error);
    res.status(502).json({ error: 'Erro ao buscar gêneros' });
  }
});

// ==========================================
// PROVEDORES DE STREAMING NO BRASIL (BR)
// ==========================================
app.get('/api/providers', async (req, res) => {
  const type = req.query.type === 'tv' ? 'tv' : 'movie';
  try {
    const response = await tmdbGet(`/watch/providers/${type}`, {
      watch_region: 'BR',
    });

    const allProviders = response.data.results || [];
    const byId = new Map(allProviders.map((p) => [p.provider_id, p]));

    const curated = CURATED_BR_PROVIDER_IDS
      .map((id) => byId.get(id) || FALLBACK_BR_PROVIDERS.find((f) => f.provider_id === id))
      .filter(Boolean);

    setEdgeCache(res, 86400);
    res.json({ results: curated });
  } catch (error) {
    logSafeError('providers', error);
    res.json({ results: FALLBACK_BR_PROVIDERS });
  }
});

// ==========================================
// DISCOVER AVANÇADO
// ==========================================
app.get('/api/discover', async (req, res) => {
  const type = req.query.type === 'movie' ? 'movie' : 'tv';
  const page = parsePage(req.query.page);

  const rawSort = typeof req.query.sort === 'string' && ALLOWED_SORTS.has(req.query.sort)
    ? req.query.sort
    : 'popularity.desc';

  let mappedSort = rawSort;
  if (type === 'movie' && mappedSort === 'first_air_date.desc') {
    mappedSort = 'primary_release_date.desc';
  } else if (type === 'tv' && mappedSort === 'primary_release_date.desc') {
    mappedSort = 'first_air_date.desc';
  }

  const params = {
    include_adult: false,
    sort_by: mappedSort,
    page,
  };

  const hasGenre = typeof req.query.genre === 'string' && GENRE_REGEX.test(req.query.genre);
  const hasProvider =
    typeof req.query.provider === 'string' && PROVIDER_REGEX.test(req.query.provider);

  if (hasGenre) {
    params.with_genres = req.query.genre;
  }

  const dateField = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  if (typeof req.query.year === 'string' && YEAR_REGEX.test(req.query.year)) {
    if (type === 'movie') {
      params.primary_release_year = req.query.year;
    } else {
      params.first_air_date_year = req.query.year;
    }
  } else {
    if (typeof req.query.yearFrom === 'string' && YEAR_REGEX.test(req.query.yearFrom)) {
      params[`${dateField}.gte`] = `${req.query.yearFrom}-01-01`;
    }
    if (typeof req.query.yearTo === 'string' && YEAR_REGEX.test(req.query.yearTo)) {
      params[`${dateField}.lte`] = `${req.query.yearTo}-12-31`;
    }
  }

  const parsedRating = Number(req.query.rating);
  if (Number.isFinite(parsedRating) && parsedRating > 0 && parsedRating <= 10) {
    params['vote_average.gte'] = parsedRating;
    params['vote_count.gte'] = hasProvider || hasGenre ? 40 : 120;
  } else if (mappedSort === 'vote_average.desc') {
    params['vote_count.gte'] = hasProvider || hasGenre ? 80 : 300;
  }

  if (mappedSort === 'primary_release_date.desc' || mappedSort === 'first_air_date.desc') {
    const today = new Date().toISOString().split('T')[0];
    if (!params[`${dateField}.lte`] || params[`${dateField}.lte`] > today) {
      params[`${dateField}.lte`] = today;
    }
    if (!params['vote_count.gte']) {
      params['vote_count.gte'] = 20;
    }
  }

  if (hasProvider) {
    // Normaliza separador para "|" (OR no TMDB: está em QUALQUER um dos streamings escolhidos)
    params.with_watch_providers = req.query.provider.replace(/,/g, '|');
    params.watch_region = 'BR';
    params.with_watch_monetization_types = 'flatrate|free|ads';
  }

  try {
    let response = await tmdbGet(`/discover/${type}`, params);

    // Se combinou múltiplos gêneros com AND (",") e não houve resultado, tenta automaticamente com OR ("|")
    if (
      (response.data.results || []).length === 0 &&
      hasGenre &&
      params.with_genres.includes(',')
    ) {
      response = await tmdbGet(`/discover/${type}`, {
        ...params,
        with_genres: params.with_genres.replace(/,/g, '|'),
      });
    }

    setEdgeCache(res, 300);
    res.json({
      ...response.data,
      results: attachMediaType(response.data.results, type),
    });
  } catch (error) {
    logSafeError('discover', error);
    res.status(502).json({ error: 'Erro no discover' });
  }
});

// ==========================================
// SURPREENDA-ME! (ROLETA DE RECOMENDAÇÕES)
// ==========================================
app.get('/api/surprise', async (req, res) => {
  const requestedType = req.query.type || 'all';
  const chosenType =
    requestedType === 'movie' || requestedType === 'tv'
      ? requestedType
      : Math.random() < 0.5
        ? 'movie'
        : 'tv';

  const randomPage = Math.floor(Math.random() * 4) + 1;

  const baseParams = {
    include_adult: false,
    sort_by: 'popularity.desc',
    'vote_average.gte': 7.4,
    'vote_count.gte': 150,
    page: randomPage,
  };

  if (typeof req.query.genre === 'string' && GENRE_REGEX.test(req.query.genre)) {
    baseParams.with_genres = req.query.genre;
  }
  if (typeof req.query.provider === 'string' && PROVIDER_REGEX.test(req.query.provider)) {
    baseParams.with_watch_providers = req.query.provider;
    baseParams.watch_region = 'BR';
    baseParams.with_watch_monetization_types = 'flatrate';
  }

  try {
    let response = await tmdbGet(`/discover/${chosenType}`, baseParams);
    let results = (response.data.results || []).filter((item) => item.poster_path && item.overview);

    if (results.length === 0) {
      response = await tmdbGet(`/discover/${chosenType}`, {
        ...baseParams,
        page: 1,
        'vote_average.gte': 6.5,
        'vote_count.gte': 30,
      });
      results = (response.data.results || []).filter((item) => item.poster_path);
    }

    const normalized = attachMediaType(results, chosenType);
    for (let i = normalized.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [normalized[i], normalized[j]] = [normalized[j], normalized[i]];
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      pick: normalized[0] || null,
      alternatives: normalized.slice(1, 6),
    });
  } catch (error) {
    logSafeError('surprise', error);
    res.status(502).json({ error: 'Erro ao sortear recomendação' });
  }
});

// Fallback 404 para rotas inexistentes sob /api
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

// Handler global de erros (nunca vaza stack trace, caminhos internos ou variáveis de ambiente)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err?.status && err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    error: status === 500 ? 'Erro interno do servidor' : 'Requisição inválida',
  });
});

// Permite rodar localmente via `RUN_LOCAL_API=true node api/index.js`
if (!process.env.VERCEL && process.env.RUN_LOCAL_API === 'true') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`studio API local rodando em http://localhost:${PORT}`);
  });
}

export default app;
