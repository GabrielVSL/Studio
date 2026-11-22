// Em dev local (via Vite middleware/proxy) e em produção (Vercel), "/api" funciona na mesma origem sem CORS.
const BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const IMAGE_BASE = "https://image.tmdb.org/t/p";

const FALLBACK_PROVIDERS = [
  { provider_id: 8, provider_name: "Netflix", logo_path: "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg" },
  { provider_id: 119, provider_name: "Prime Video", logo_path: "/pvske1MyAoymrs5bguRfVqYiM9a.jpg" },
  { provider_id: 337, provider_name: "Disney+", logo_path: "/97yvRBw1GzX7fXprcF80er19ot.jpg" },
  { provider_id: 1899, provider_name: "Max", logo_path: "/jbe4gVSfRlbPTdESXhEKpornsfu.jpg" },
  { provider_id: 350, provider_name: "Apple TV+", logo_path: "/2E03IAZsX4ZaUqM7tXlctEPMGWS.jpg" },
  { provider_id: 307, provider_name: "Globoplay", logo_path: "/7Cg8esVVXOijXAm1f1vrS7jVjcN.jpg" },
  { provider_id: 531, provider_name: "Paramount+", logo_path: "/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg" },
  { provider_id: 283, provider_name: "Crunchyroll", logo_path: "/mXeC4TrcgdU6ltE9bCBCEORwSQR.jpg" },
];

export const getPosterUrl = (path, size = "w500") =>
  path ? `${IMAGE_BASE}/${size}${path}` : null;

export const getBackdropUrl = (path, size = "original") =>
  path ? `${IMAGE_BASE}/${size}${path}` : null;

const normalizeMediaItem = (item, fallbackType = "tv") => {
  if (!item) return null;
  const mediaType =
    item.media_type === "movie" || item.media_type === "tv"
      ? item.media_type
      : item.title && !item.name
        ? "movie"
        : fallbackType;

  const dateStr = item.release_date || item.first_air_date || "";
  const year = dateStr ? new Date(dateStr).getFullYear() : "";

  return {
    ...item,
    media_type: mediaType,
    displayTitle: item.title || item.name || "Sem título",
    displayYear: Number.isNaN(year) ? "" : year,
    displayRating: item.vote_average ? Number(item.vote_average).toFixed(1) : "N/A",
  };
};

const safeFetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
};

// ==========================================
// HERO SHOWCASE ENRIQUECIDO
// ==========================================
export const getHeroShowcase = async () => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/hero`);
    return (data.results || []).map((i) => normalizeMediaItem(i));
  } catch {
    // Fallback em dev local contra API antiga: busca tendências/séries e enriquece os 5 primeiros
    const fallbackList = (await getTrending('all', 1))
      .filter((i) => i.backdrop_path && i.poster_path)
      .slice(0, 5);

    const enriched = await Promise.all(
      fallbackList.map(async (item) => {
        try {
          const detail = await getMediaDetails(item.id, item.media_type);
          if (!detail) return item;
          const brProviders = detail['watch/providers']?.results?.BR || {};
          const brPrimary =
            brProviders.free?.[0] ||
            brProviders.ads?.[0] ||
            brProviders.flatrate?.[0] ||
            null;
          const ytVideos = (detail.videos?.results || []).filter((v) => v.site === 'YouTube');
          return {
            ...item,
            genres: (detail.genres || []).slice(0, 3),
            runtime: detail.runtime || null,
            number_of_episodes: detail.number_of_episodes || null,
            number_of_seasons: detail.number_of_seasons || null,
            primary_provider: brPrimary,
            trailer_key: ytVideos[0]?.key || null,
          };
        } catch {
          return item;
        }
      })
    );
    return enriched;
  }
};

// ==========================================
// TENDÊNCIAS (FILMES + SÉRIES)
// ==========================================
export const getTrending = async (type = "all", page = 1) => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/trending?type=${type}&page=${page}`);
    return (data.results || []).map((i) => normalizeMediaItem(i, type === "movie" ? "movie" : "tv"));
  } catch {
    // Fallback gracioso caso o backend antigo ainda esteja no ar em dev
    if (type !== "movie") {
      return getPopularSeries(page);
    }
    return [];
  }
};

// ==========================================
// SÉRIES
// ==========================================
export const getPopularSeries = async (page = 1) => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/series?page=${page}`);
    return (data.results || []).map((i) => normalizeMediaItem(i, "tv"));
  } catch (error) {
    console.error("Erro ao buscar séries populares:", error);
    return [];
  }
};

export const getNewSeries = async (page = 1) => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/newSeries?page=${page}`);
    return (data.results || []).map((i) => normalizeMediaItem(i, "tv"));
  } catch (error) {
    console.error("Erro ao buscar novas séries:", error);
    return [];
  }
};

// ==========================================
// FILMES
// ==========================================
export const getPopularMovies = async (page = 1) => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/movies/popular?page=${page}`);
    return (data.results || []).map((i) => normalizeMediaItem(i, "movie"));
  } catch (error) {
    console.error("Erro ao buscar filmes populares:", error);
    return [];
  }
};

export const getNowPlayingMovies = async (page = 1) => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/movies/now_playing?page=${page}`);
    return (data.results || []).map((i) => normalizeMediaItem(i, "movie"));
  } catch (error) {
    console.error("Erro ao buscar filmes em cartaz:", error);
    return [];
  }
};

export const getTopRatedMovies = async (page = 1) => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/movies/top_rated?page=${page}`);
    return (data.results || []).map((i) => normalizeMediaItem(i, "movie"));
  } catch (error) {
    console.error("Erro ao buscar filmes aclamados:", error);
    return [];
  }
};

export const getPopularPeople = async (page = 1) => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/people/popular?page=${page}`);
    return data.results || [];
  } catch (error) {
    console.error("Erro ao buscar artistas em destaque:", error);
    return [];
  }
};

// ==========================================
// DETALHES (FILME OU SÉRIE)
// ==========================================
export const getMediaDetails = async (id, mediaType = "tv") => {
  try {
    const endpoint = mediaType === "movie" ? `/movies/${id}` : `/series/${id}`;
    const data = await safeFetchJson(`${BASE_URL}${endpoint}`);
    return normalizeMediaItem(data, mediaType);
  } catch (error) {
    console.error(`Erro ao buscar detalhes (${mediaType} ${id}):`, error);
    return null;
  }
};

// ==========================================
// LINKS DIRETOS DE STREAMING (WATCHMODE BR)
// ==========================================
export const getWatchLinks = async (id, mediaType = "tv") => {
  try {
    const type = mediaType === "movie" ? "movie" : "tv";
    const data = await safeFetchJson(`${BASE_URL}/watch-links/${type}/${id}`);
    return Array.isArray(data.sources) ? data.sources : [];
  } catch {
    return [];
  }
};

// ==========================================
// TEMPORADAS E EPISÓDIOS
// ==========================================
export const getSeasonDetails = async (seriesId, seasonNumber) => {
  try {
    const data = await safeFetchJson(
      `${BASE_URL}/series/${seriesId}/season/${seasonNumber}`
    );
    return data.episodes || [];
  } catch (error) {
    console.error("Erro ao buscar episódios:", error);
    return [];
  }
};

// ==========================================
// TRAILERS / VÍDEOS (PARA MODAL)
// ==========================================
export const getMediaVideos = async (id, mediaType = "tv") => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/videos/${mediaType}/${id}`);
    return data.results || [];
  } catch {
    // Fallback via endpoint de detalhes caso /videos ainda não esteja publicado
    try {
      const details = await getMediaDetails(id, mediaType);
      return (details?.videos?.results || []).filter((v) => v.site === "YouTube");
    } catch {
      return [];
    }
  }
};

// ==========================================
// BUSCA UNIFICADA (FILMES + SÉRIES)
// ==========================================
export const searchMedia = async (query, type = "multi") => {
  if (!query?.trim()) return [];
  try {
    const data = await safeFetchJson(
      `${BASE_URL}/search?query=${encodeURIComponent(query.trim())}&type=${type}`
    );
    return (data.results || []).map((i) =>
      normalizeMediaItem(i, type === "movie" ? "movie" : "tv")
    );
  } catch (error) {
    console.error("Erro na pesquisa:", error);
    return [];
  }
};

// ==========================================
// GÊNEROS E PROVEDORES DE STREAMING (BR)
// ==========================================
export const getGenres = async (type = "tv") => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/genres?type=${type}`);
    return data.genres || [];
  } catch (error) {
    console.error("Erro ao buscar gêneros:", error);
    return [];
  }
};

export const getStreamingProviders = async (type = "movie") => {
  try {
    const data = await safeFetchJson(`${BASE_URL}/providers?type=${type}`);
    return data.results?.length ? data.results : FALLBACK_PROVIDERS;
  } catch {
    return FALLBACK_PROVIDERS;
  }
};

// ==========================================
// DISCOVER AVANÇADO
// ==========================================
export const discoverMedia = async ({
  type = "tv",
  genre = null,
  page = 1,
  year = "",
  yearFrom = "",
  yearTo = "",
  rating = "",
  sort = "popularity.desc",
  provider = null,
  withMeta = false,
} = {}) => {
  try {
    const params = new URLSearchParams();
    params.set("type", type);
    params.set("page", String(page));
    if (Array.isArray(genre) && genre.length > 0) {
      params.set("genre", genre.join(","));
    } else if (genre) {
      params.set("genre", String(genre));
    }
    if (year) {
      params.set("year", String(year));
    } else {
      if (yearFrom) params.set("yearFrom", String(yearFrom));
      if (yearTo) params.set("yearTo", String(yearTo));
    }
    if (rating && Number(rating) > 0) params.set("rating", String(rating));
    if (sort) params.set("sort", sort);
    if (Array.isArray(provider) && provider.length > 0) {
      params.set("provider", provider.join("|"));
    } else if (provider) {
      params.set("provider", String(provider));
    }

    const data = await safeFetchJson(`${BASE_URL}/discover?${params.toString()}`);
    const items = (data.results || []).map((i) => normalizeMediaItem(i, type));
    if (withMeta) {
      return {
        results: items,
        totalResults: Number(data.total_results) || items.length,
        totalPages: Number(data.total_pages) || 1,
      };
    }
    return items;
  } catch (error) {
    console.error("Erro ao descobrir títulos:", error);
    return withMeta ? { results: [], totalResults: 0, totalPages: 1 } : [];
  }
};

// ==========================================
// SURPREENDA-ME! (ROLETA)
// ==========================================
export const getSurprisePick = async ({ type = "all", genre = "", provider = "" } = {}) => {
  try {
    const params = new URLSearchParams();
    params.set("type", type);
    if (genre) params.set("genre", String(genre));
    if (provider) params.set("provider", String(provider));

    const data = await safeFetchJson(`${BASE_URL}/surprise?${params.toString()}`);
    return {
      pick: data.pick ? normalizeMediaItem(data.pick) : null,
      alternatives: (data.alternatives || []).map((i) => normalizeMediaItem(i)),
    };
  } catch {
    // Fallback local usando populares se /surprise ainda não estiver ativo
    const pool = await getPopularSeries(1);
    const highRated = pool.filter((i) => Number(i.vote_average) >= 7.0);
    const list = highRated.length ? highRated : pool;
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    return {
      pick: shuffled[0] || null,
      alternatives: shuffled.slice(1, 5),
    };
  }
};
