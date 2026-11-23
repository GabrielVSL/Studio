import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Film,
  Tv,
  LayoutGrid,
  ChevronDown,
  RotateCcw,
  Loader2,
  Ticket,
  X,
  Check,
  Star,
  Calendar,
  Tags,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import MovieCard from './MovieCard';
import { CardGridSkeleton } from './Skeletons';
import {
  searchMedia,
  getGenres,
  getStreamingProviders,
  discoverMedia,
  getPosterUrl,
  IMAGE_BASE,
} from '../services/api';

const EXPLORER_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_EXPLORER_CACHE_ENTRIES = 40;
const explorerResultsCache = new Map();
const explorerMetaCache = new Map();
let lastExplorerScroll = { key: '', y: 0 };

const setExplorerCache = (key, entry) => {
  if (explorerResultsCache.size >= MAX_EXPLORER_CACHE_ENTRIES && !explorerResultsCache.has(key)) {
    const oldestKey = explorerResultsCache.keys().next().value;
    explorerResultsCache.delete(oldestKey);
  }
  explorerResultsCache.set(key, entry);
};

const getFreshExplorerCache = (key) => {
  const entry = explorerResultsCache.get(key);
  if (entry && Date.now() - entry.timestamp < EXPLORER_CACHE_TTL_MS) {
    return entry;
  }
  return null;
};

const parseIdList = (raw) => {
  if (!raw) return [];
  return Array.from(
    new Set(
      String(raw)
        .split(/[,|]/)
        .map((v) => Number(v.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  );
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MIN = 1950;
const YEAR_MAX = CURRENT_YEAR;
const RATING_MAX = 9.5;

const clampYear = (val, fallback) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(YEAR_MAX, Math.max(YEAR_MIN, Math.round(n)));
};

const clampRating = (val) => {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(RATING_MAX, Math.round(n * 2) / 2);
};

const parseInitialYears = (searchParams) => {
  const exact = searchParams.get('ano');
  if (exact && /^\d{4}$/.test(exact)) {
    const y = clampYear(exact, YEAR_MAX);
    return [y, y];
  }

  const de = searchParams.get('de');
  const ate = searchParams.get('ate');
  if (de || ate) {
    const from = de ? clampYear(de, YEAR_MIN) : YEAR_MIN;
    const to = ate ? clampYear(ate, YEAR_MAX) : YEAR_MAX;
    return [Math.min(from, to), Math.max(from, to)];
  }

  // Compatibilidade com links antigos usando ?periodo=...
  const periodo = searchParams.get('periodo');
  if (periodo === '2020s') return [2020, YEAR_MAX];
  if (periodo === '2010s') return [2010, 2019];
  if (periodo === '2000s') return [2000, 2009];
  if (periodo === 'classics') return [YEAR_MIN, 1999];
  if (periodo && /^\d{4}$/.test(periodo)) {
    const y = clampYear(periodo, YEAR_MAX);
    return [y, y];
  }

  return [YEAR_MIN, YEAR_MAX];
};

const YEAR_QUICK_PRESETS = [
  { id: 'recent', label: 'Últimos 3 anos', from: CURRENT_YEAR - 2, to: YEAR_MAX },
  { id: '2020s', label: 'Anos 2020', from: 2020, to: YEAR_MAX },
  { id: '2010s', label: 'Anos 2010', from: 2010, to: 2019 },
  { id: 'classics', label: 'Clássicos (< 2000)', from: YEAR_MIN, to: 1999 },
];

const RATING_QUICK_PRESETS = [
  { value: 0, label: 'Todas' },
  { value: 6, label: '6.0+' },
  { value: 7, label: '7.0+' },
  { value: 8, label: '8.0+' },
];

const getRatingDescriptor = (val) => {
  if (val <= 0) return 'Sem filtro mínimo';
  if (val < 6) return 'Acima da média';
  if (val < 7) return 'Bem avaliados';
  if (val < 8) return 'Muito bons';
  if (val < 8.5) return 'Aclamados pela crítica';
  return 'Obras-primas';
};

const normalizeProviderLabel = (name = '') =>
  name
    .replace(/^Amazon Prime Video$/i, 'Prime Video')
    .replace(/^Amazon Video$/i, 'Prime Video')
    .replace(/^HBO Max$/i, 'Max');

const parseMediaType = (raw) => {
  if (raw === 'movie') return 'movie';
  if (raw === 'tv') return 'tv';
  return 'all';
};

export default function Explorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get('q') || '';
  const initialType = parseMediaType(searchParams.get('tipo'));
  const initialGenres = parseIdList(searchParams.get('genero'));
  const initialProviders = parseIdList(searchParams.get('streaming'));
  const initialSort = searchParams.get('sort') || 'popularity.desc';
  const [initYFrom, initYTo] = parseInitialYears(searchParams);
  const initialRating = clampRating(searchParams.get('nota'));
  const initialFree = searchParams.get('gratis') === '1' || searchParams.get('gratis') === 'true';

  const [mediaType, setMediaType] = useState(initialType);
  const [genres, setGenres] = useState(() => explorerMetaCache.get(initialType)?.genres || []);
  const [providers, setProviders] = useState(
    () => explorerMetaCache.get(initialType)?.providers || []
  );

  const [selectedGenres, setSelectedGenres] = useState(initialGenres);
  const [selectedProviders, setSelectedProviders] = useState(initialProviders);
  const [freeOnly, setFreeOnly] = useState(initialFree);

  // Faixa efetiva de ano e nota (commitadas na query) + estados draft para sliders a 60fps
  const [yearRange, setYearRange] = useState([initYFrom, initYTo]);
  const [draftYearRange, setDraftYearRange] = useState([initYFrom, initYTo]);
  const [rating, setRating] = useState(initialRating);
  const [draftRating, setDraftRating] = useState(initialRating);
  const [sort, setSort] = useState(initialSort);

  // Apenas um popover aberto por vez: 'genres' | 'year' | 'rating' | 'sort' | null
  const [openMenu, setOpenMenu] = useState(null);
  const toolbarRef = useRef(null);
  const requestSeqRef = useRef(0);
  const yearDebounceRef = useRef(null);
  const ratingDebounceRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);

  // Sincroniza quando o usuário navega para /explorar com novos query params (ex: clicar em categoria na Home)
  const searchString = searchParams.toString();
  const [prevSearchString, setPrevSearchString] = useState(searchString);
  if (searchString !== prevSearchString) {
    setPrevSearchString(searchString);
    const paramTipo = searchParams.get('tipo');
    if (paramTipo === 'movie' || paramTipo === 'tv' || paramTipo === 'all') {
      setMediaType(paramTipo);
    }
    setSelectedGenres(parseIdList(searchParams.get('genero')));
    setSelectedProviders(parseIdList(searchParams.get('streaming')));
    setFreeOnly(searchParams.get('gratis') === '1' || searchParams.get('gratis') === 'true');
    const pSort = searchParams.get('sort');
    setSort(pSort || 'popularity.desc');
    const [pFrom, pTo] = parseInitialYears(searchParams);
    setYearRange([pFrom, pTo]);
    setDraftYearRange([pFrom, pTo]);
    const pRating = clampRating(searchParams.get('nota'));
    setRating(pRating);
    setDraftRating(pRating);
  }

  const [yearFrom, yearTo] = yearRange;
  const hasYearFilter = yearFrom > YEAR_MIN || yearTo < YEAR_MAX;
  const effectiveYear = hasYearFilter && yearFrom === yearTo ? String(yearFrom) : '';
  const effectiveYearFrom = hasYearFilter && yearFrom !== yearTo && yearFrom > YEAR_MIN ? String(yearFrom) : '';
  const effectiveYearTo = hasYearFilter && yearFrom !== yearTo && yearTo < YEAR_MAX ? String(yearTo) : '';

  const yearLabel = !hasYearFilter
    ? 'Ano'
    : yearFrom === yearTo
      ? String(yearFrom)
      : `${yearFrom}–${yearTo}`;

  const genresKey = [...selectedGenres].sort((a, b) => a - b).join(',');
  const providersKey = [...selectedProviders].sort((a, b) => a - b).join('|');

  const cacheKey = `${query}|${mediaType}|${genresKey}|${providersKey}|${freeOnly ? '1' : '0'}|${effectiveYear}|${effectiveYearFrom}|${effectiveYearTo}|${rating}|${sort}`;

  const [results, setResults] = useState(() => getFreshExplorerCache(cacheKey)?.results || []);
  const [totalResults, setTotalResults] = useState(
    () => getFreshExplorerCache(cacheKey)?.totalResults || 0
  );
  const [page, setPage] = useState(() => getFreshExplorerCache(cacheKey)?.page || 1);
  const [hasMore, setHasMore] = useState(
    () => getFreshExplorerCache(cacheKey)?.hasMore ?? false
  );
  const [loading, setLoading] = useState(() => !getFreshExplorerCache(cacheKey));
  const [loadingMore, setLoadingMore] = useState(false);

  const sortOptions = useMemo(
    () => [
      { value: 'popularity.desc', label: 'Mais Populares' },
      { value: 'vote_average.desc', label: 'Melhores Avaliados' },
      {
        value: mediaType === 'tv' ? 'first_air_date.desc' : 'primary_release_date.desc',
        label: 'Mais Recentes',
      },
    ],
    [mediaType]
  );

  // Atualiza a URL de forma limpa (replace: true para não poluir o botão Voltar)
  const syncUrlParams = useCallback(
    (overrides = {}) => {
      if (query) return;
      const next = {
        tipo: overrides.mediaType ?? mediaType,
        genres: overrides.selectedGenres ?? selectedGenres,
        providers: overrides.selectedProviders ?? selectedProviders,
        freeOnly: overrides.freeOnly ?? freeOnly,
        yearRange: overrides.yearRange ?? yearRange,
        rating: overrides.rating ?? rating,
        sort: overrides.sort ?? sort,
      };

      const params = new URLSearchParams();
      params.set('tipo', next.tipo);
      if (next.genres.length > 0) params.set('genero', next.genres.join(','));
      if (next.providers.length > 0) params.set('streaming', next.providers.join('|'));
      if (next.freeOnly) params.set('gratis', '1');

      const [nFrom, nTo] = next.yearRange;
      if (nFrom > YEAR_MIN || nTo < YEAR_MAX) {
        if (nFrom === nTo) {
          params.set('ano', String(nFrom));
        } else {
          if (nFrom > YEAR_MIN) params.set('de', String(nFrom));
          if (nTo < YEAR_MAX) params.set('ate', String(nTo));
        }
      }

      if (next.rating > 0) params.set('nota', String(next.rating));
      if (next.sort && next.sort !== 'popularity.desc') params.set('sort', next.sort);

      const nextStr = params.toString();
      setPrevSearchString(nextStr);
      setSearchParams(params, { replace: true });
    },
    [query, mediaType, selectedGenres, selectedProviders, freeOnly, yearRange, rating, sort, setSearchParams]
  );

  // Limpa timers de debounce na desmontagem
  useEffect(() => {
    return () => {
      if (yearDebounceRef.current) clearTimeout(yearDebounceRef.current);
      if (ratingDebounceRef.current) clearTimeout(ratingDebounceRef.current);
    };
  }, []);

  // Fecha popover ao clicar fora ou apertar ESC
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Carrega gêneros e streamings disponíveis para Todos / Filmes / Séries
  useEffect(() => {
    const cachedMeta = explorerMetaCache.get(mediaType);
    let cancelled = false;
    const loadMeta = async () => {
      if (cachedMeta) {
        setGenres(cachedMeta.genres);
        setProviders(cachedMeta.providers);
        return;
      }
      const [gList, pList] = await Promise.all([
        getGenres(mediaType),
        getStreamingProviders(mediaType === 'tv' ? 'tv' : 'movie'),
      ]);
      if (!cancelled) {
        explorerMetaCache.set(mediaType, { genres: gList, providers: pList });
        setGenres(gList);
        setProviders(pList);
      }
    };
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  // Salva scroll para restaurar ao voltar dos Detalhes
  useEffect(() => {
    const onScroll = () => {
      lastExplorerScroll = { key: cacheKey, y: window.scrollY };
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [cacheKey]);

  // Busca real dos resultados sempre que qualquer filtro muda
  useEffect(() => {
    const reqId = ++requestSeqRef.current;
    loadingMoreRef.current = false;

    const fetchInitialData = async () => {
      const cached = explorerResultsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < EXPLORER_CACHE_TTL_MS) {
        setResults(cached.results);
        setTotalResults(cached.totalResults || cached.results.length);
        setPage(cached.page);
        setHasMore(cached.hasMore);
        setLoading(false);
        setLoadingMore(false);
        if (lastExplorerScroll.key === cacheKey && lastExplorerScroll.y > 0) {
          window.scrollTo(0, lastExplorerScroll.y);
        }
        return;
      }

      setLoading(true);
      setLoadingMore(false);
      setPage(1);

      let items = [];
      let total = 0;
      let moreAvailable = false;

      if (query) {
        items = await searchMedia(query, 'multi');
        total = items.length;
        moreAvailable = false;
      } else {
        const res = await discoverMedia({
          type: mediaType,
          genre: genresKey || null,
          page: 1,
          year: effectiveYear,
          yearFrom: effectiveYearFrom,
          yearTo: effectiveYearTo,
          rating: rating > 0 ? rating : '',
          sort,
          provider: providersKey || null,
          free: freeOnly,
          withMeta: true,
        });
        items = res.results;
        total = res.totalResults;
        moreAvailable = res.totalPages > 1 && items.length >= 16;
      }

      if (reqId !== requestSeqRef.current) return;

      setExplorerCache(cacheKey, {
        timestamp: Date.now(),
        results: items,
        totalResults: total,
        page: 1,
        hasMore: moreAvailable,
      });
      setResults(items);
      setTotalResults(total);
      setHasMore(moreAvailable);
      setLoading(false);
    };

    fetchInitialData();
  }, [
    cacheKey,
    query,
    mediaType,
    genresKey,
    providersKey,
    freeOnly,
    effectiveYear,
    effectiveYearFrom,
    effectiveYearTo,
    rating,
    sort,
  ]);

  const loadNextPage = useCallback(async () => {
    if (query || loading || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    const reqId = requestSeqRef.current;
    const nextPage = page + 1;

    const res = await discoverMedia({
      type: mediaType,
      genre: genresKey || null,
      page: nextPage,
      year: effectiveYear,
      yearFrom: effectiveYearFrom,
      yearTo: effectiveYearTo,
      rating: rating > 0 ? rating : '',
      sort,
      provider: providersKey || null,
      free: freeOnly,
      withMeta: true,
    });

    if (reqId !== requestSeqRef.current) {
      loadingMoreRef.current = false;
      return;
    }

    const existingKeys = new Set(results.map((r) => `${r.media_type}-${r.id}`));
    const fresh = res.results.filter((r) => !existingKeys.has(`${r.media_type}-${r.id}`));
    const merged = [...results, ...fresh];
    const nextHasMore = nextPage < res.totalPages && res.results.length >= 16;

    setExplorerCache(cacheKey, {
      timestamp: Date.now(),
      results: merged,
      totalResults: res.totalResults,
      page: nextPage,
      hasMore: nextHasMore,
    });
    setResults(merged);
    setPage(nextPage);
    setHasMore(nextHasMore);
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }, [
    query,
    loading,
    hasMore,
    page,
    mediaType,
    genresKey,
    effectiveYear,
    effectiveYearFrom,
    effectiveYearTo,
    rating,
    sort,
    providersKey,
    freeOnly,
    results,
    cacheKey,
  ]);

  // Infinite Scroll automático: antecipa o carregamento 500px antes do fim da lista
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || query || loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadNextPage();
        }
      },
      { rootMargin: '500px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [query, loading, hasMore, loadNextPage]);

  const handleSwitchType = (nextType) => {
    if (nextType === mediaType) return;
    let nextSort = sort;
    if (sort === 'first_air_date.desc' && nextType !== 'tv') {
      nextSort = 'primary_release_date.desc';
    } else if (sort === 'primary_release_date.desc' && nextType === 'tv') {
      nextSort = 'first_air_date.desc';
    }
    setMediaType(nextType);
    setSelectedGenres([]);
    setSort(nextSort);
    setOpenMenu(null);
    syncUrlParams({ mediaType: nextType, selectedGenres: [], sort: nextSort });
  };

  const toggleProvider = (providerId) => {
    const next = selectedProviders.includes(providerId)
      ? selectedProviders.filter((id) => id !== providerId)
      : [...selectedProviders, providerId];
    setSelectedProviders(next);
    syncUrlParams({ selectedProviders: next });
  };

  const clearProviders = () => {
    setSelectedProviders([]);
    syncUrlParams({ selectedProviders: [] });
  };

  const toggleFreeOnly = () => {
    const next = !freeOnly;
    setFreeOnly(next);
    syncUrlParams({ freeOnly: next });
  };

  const toggleGenre = (genreId) => {
    const next = selectedGenres.includes(genreId)
      ? selectedGenres.filter((id) => id !== genreId)
      : [...selectedGenres, genreId];
    setSelectedGenres(next);
    syncUrlParams({ selectedGenres: next });
  };

  const clearGenres = () => {
    setSelectedGenres([]);
    syncUrlParams({ selectedGenres: [] });
  };

  // Commit do slider de ano (imediato ou debounced durante arrasto)
  const commitYearRange = useCallback(
    (nextRange) => {
      if (yearDebounceRef.current) clearTimeout(yearDebounceRef.current);
      setYearRange(nextRange);
      syncUrlParams({ yearRange: nextRange });
    },
    [syncUrlParams]
  );

  const handleYearSliderChange = (index, rawVal) => {
    const val = clampYear(rawVal, index === 0 ? YEAR_MIN : YEAR_MAX);
    const nextRange =
      index === 0
        ? [Math.min(val, draftYearRange[1]), draftYearRange[1]]
        : [draftYearRange[0], Math.max(val, draftYearRange[0])];

    setDraftYearRange(nextRange);
    if (yearDebounceRef.current) clearTimeout(yearDebounceRef.current);
    yearDebounceRef.current = setTimeout(() => {
      commitYearRange(nextRange);
    }, 240);
  };

  const applyYearPreset = (from, to) => {
    const nextRange = [from, to];
    setDraftYearRange(nextRange);
    commitYearRange(nextRange);
  };

  const resetYearFilter = () => {
    const full = [YEAR_MIN, YEAR_MAX];
    setDraftYearRange(full);
    commitYearRange(full);
  };

  // Commit do slider de nota mínima
  const commitRating = useCallback(
    (nextVal) => {
      if (ratingDebounceRef.current) clearTimeout(ratingDebounceRef.current);
      const clean = clampRating(nextVal);
      setRating(clean);
      syncUrlParams({ rating: clean });
    },
    [syncUrlParams]
  );

  const handleRatingSliderChange = (rawVal) => {
    const clean = clampRating(rawVal);
    setDraftRating(clean);
    if (ratingDebounceRef.current) clearTimeout(ratingDebounceRef.current);
    ratingDebounceRef.current = setTimeout(() => {
      commitRating(clean);
    }, 220);
  };

  const handleSelectSort = (val) => {
    setSort(val);
    setOpenMenu(null);
    syncUrlParams({ sort: val });
  };

  const clearAllFilters = () => {
    const fullYears = [YEAR_MIN, YEAR_MAX];
    setSelectedGenres([]);
    setSelectedProviders([]);
    setFreeOnly(false);
    setYearRange(fullYears);
    setDraftYearRange(fullYears);
    setRating(0);
    setDraftRating(0);
    setSort('popularity.desc');
    setOpenMenu(null);
    syncUrlParams({
      selectedGenres: [],
      selectedProviders: [],
      freeOnly: false,
      yearRange: fullYears,
      rating: 0,
      sort: 'popularity.desc',
    });
  };

  const activeProviderObjs = providers.filter((p) =>
    selectedProviders.includes(p.provider_id)
  );
  const activeGenreObjs = genres.filter((g) => selectedGenres.includes(g.id));
  const hasAnyFilter = Boolean(
    selectedProviders.length > 0 ||
      selectedGenres.length > 0 ||
      freeOnly ||
      hasYearFilter ||
      rating > 0 ||
      sort !== 'popularity.desc'
  );

  const currentSortLabel =
    sortOptions.find((opt) => opt.value === sort)?.label || 'Mais Populares';

  const genresButtonLabel =
    activeGenreObjs.length === 0
      ? 'Gêneros'
      : activeGenreObjs.length === 1
        ? activeGenreObjs[0].name
        : `Gêneros (${activeGenreObjs.length})`;

  // Percentuais para as barras preenchidas dos sliders
  const yearSpan = YEAR_MAX - YEAR_MIN;
  const yearLeftPct = ((draftYearRange[0] - YEAR_MIN) / yearSpan) * 100;
  const yearRightPct = ((draftYearRange[1] - YEAR_MIN) / yearSpan) * 100;
  const ratingPct = (draftRating / RATING_MAX) * 100;

  return (
    <main className="min-h-screen bg-[#09090B] pt-28 pb-20 px-5 sm:px-8 lg:px-14">
      <div className="container mx-auto">
        {/* CABEÇALHO LIMPO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-white/[0.07]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
              Catálogo studio
            </p>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                {query ? `Resultados para "${query}"` : 'Explorar'}
              </h1>
              {!loading && totalResults > 0 && (
                <span className="text-xs sm:text-sm font-medium text-white/40">
                  {totalResults.toLocaleString('pt-BR')}{' '}
                  {query
                    ? 'encontrados'
                    : mediaType === 'all'
                      ? 'títulos'
                      : mediaType === 'movie'
                        ? 'filmes'
                        : 'séries'}
                </span>
              )}
            </div>
            {query && (
              <button
                type="button"
                onClick={() => navigate('/explorar')}
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white underline underline-offset-2"
              >
                <X className="w-3.5 h-3.5" /> Limpar busca e voltar ao catálogo
              </button>
            )}
          </div>

          {/* SELETOR UNIFICADO: TODOS | FILMES | SÉRIES */}
          {!query && (
            <div className="inline-flex p-1 bg-white/[0.05] border border-white/[0.1] rounded-xl self-start md:self-auto">
              <button
                type="button"
                onClick={() => handleSwitchType('all')}
                className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  mediaType === 'all'
                    ? 'bg-white text-[#09090B] font-semibold shadow-sm'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Todos
              </button>
              <button
                type="button"
                onClick={() => handleSwitchType('movie')}
                className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  mediaType === 'movie'
                    ? 'bg-white text-[#09090B] font-semibold shadow-sm'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                <Film className="w-4 h-4" />
                Filmes
              </button>
              <button
                type="button"
                onClick={() => handleSwitchType('tv')}
                className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  mediaType === 'tv'
                    ? 'bg-white text-[#09090B] font-semibold shadow-sm'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                <Tv className="w-4 h-4" />
                Séries
              </button>
            </div>
          )}
        </div>

        {!query && (
          <div className="space-y-5 mb-10">
            {/* 1. DOCK DE STREAMINGS (ÍCONES LIMPOS COM MULTI-SELEÇÃO) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.025] border border-white/[0.07] rounded-2xl p-4 sm:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                    Streamings
                  </span>
                  {selectedProviders.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-white text-[#09090B] text-[10px] font-bold">
                      {selectedProviders.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 mt-0.5 truncate max-w-xs">
                  {activeProviderObjs.length > 0
                    ? activeProviderObjs
                        .map((p) => normalizeProviderLabel(p.provider_name))
                        .join(', ')
                    : 'Selecione um ou mais serviços'}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {providers.map((prov) => {
                  const isSelected = selectedProviders.includes(prov.provider_id);
                  const dimmed = selectedProviders.length > 0 && !isSelected;
                  const cleanName = normalizeProviderLabel(prov.provider_name);

                  return (
                    <button
                      key={prov.provider_id}
                      type="button"
                      onClick={() => toggleProvider(prov.provider_id)}
                      title={cleanName}
                      aria-label={`${isSelected ? 'Remover' : 'Filtrar por'} ${cleanName}`}
                      aria-pressed={isSelected}
                      className={`group relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden transition-all duration-200 ${
                        isSelected
                          ? 'ring-2 ring-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.22)] opacity-100'
                          : dimmed
                            ? 'opacity-40 grayscale-[50%] hover:opacity-85 hover:grayscale-0 hover:scale-105 ring-1 ring-white/10'
                            : 'opacity-85 hover:opacity-100 hover:scale-105 ring-1 ring-white/15 hover:ring-white/40'
                      }`}
                    >
                      <img
                        src={`${IMAGE_BASE}/w92${prov.logo_path}`}
                        alt={cleanName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-bl-lg bg-white text-[#09090B] flex items-center justify-center shadow">
                          <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                        </span>
                      )}
                    </button>
                  );
                })}

                {selectedProviders.length > 0 && (
                  <button
                    type="button"
                    onClick={clearProviders}
                    className="h-11 px-3 rounded-xl text-xs font-medium text-white/55 hover:text-white bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] transition-all inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Todos
                  </button>
                )}
              </div>
            </div>

            {/* 2. BARRA ÚNICA DE FILTROS (GÊNEROS, SLIDER DE ANO, SLIDER DE NOTA, GRÁTIS BR & SORT) */}
            <div
              ref={toolbarRef}
              className="relative z-30 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                {/* POPOVER: GÊNEROS (MULTI-SELEÇÃO EM GRADE) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenu((m) => (m === 'genres' ? null : 'genres'))}
                    className={`h-10 px-4 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-all ${
                      selectedGenres.length > 0 || openMenu === 'genres'
                        ? 'bg-white text-[#09090B] border-white font-semibold'
                        : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.1] text-white/85'
                    }`}
                  >
                    <Tags className="w-3.5 h-3.5" />
                    <span>{genresButtonLabel}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        openMenu === 'genres' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openMenu === 'genres' && (
                    <div className="absolute left-0 top-full mt-2.5 w-[min(92vw,420px)] bg-[#111115]/98 backdrop-blur-2xl border border-white/[0.14] rounded-2xl shadow-2xl p-4 animate-fade-in">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                          Escolha um ou mais gêneros
                        </span>
                        {selectedGenres.length > 0 && (
                          <button
                            type="button"
                            onClick={clearGenres}
                            className="text-xs font-medium text-white/60 hover:text-white transition-colors"
                          >
                            Limpar
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                        {genres.map((g) => {
                          const active = selectedGenres.includes(g.id);
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => toggleGenre(g.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium text-left flex items-center justify-between gap-1.5 transition-all border ${
                                active
                                  ? 'bg-white text-[#09090B] border-white font-semibold'
                                  : 'bg-white/[0.03] hover:bg-white/[0.09] text-white/80 border-white/[0.06]'
                              }`}
                            >
                              <span className="truncate">{g.name}</span>
                              {active && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* POPOVER: ANO / PERÍODO COM BARRA DUPLA DESLIZANTE */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenu((m) => (m === 'year' ? null : 'year'))}
                    className={`h-10 px-4 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-all ${
                      hasYearFilter || openMenu === 'year'
                        ? 'bg-white text-[#09090B] border-white font-semibold'
                        : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.1] text-white/85'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{yearLabel}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        openMenu === 'year' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openMenu === 'year' && (
                    <div className="absolute left-0 top-full mt-2.5 w-[min(92vw,320px)] bg-[#111115]/98 backdrop-blur-2xl border border-white/[0.14] rounded-2xl shadow-2xl p-4 animate-fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                          Faixa de lançamento
                        </span>
                        {(draftYearRange[0] > YEAR_MIN || draftYearRange[1] < YEAR_MAX) && (
                          <button
                            type="button"
                            onClick={resetYearFilter}
                            className="text-xs font-medium text-white/55 hover:text-white transition-colors"
                          >
                            Resetar
                          </button>
                        )}
                      </div>

                      {/* Leitura grande da faixa atual */}
                      <div className="flex items-baseline justify-between mb-4">
                        <span className="text-2xl font-bold tracking-tight text-white">
                          {draftYearRange[0] === YEAR_MIN && draftYearRange[1] === YEAR_MAX
                            ? 'Qualquer ano'
                            : draftYearRange[0] === draftYearRange[1]
                              ? draftYearRange[0]
                              : `${draftYearRange[0]} — ${draftYearRange[1]}`}
                        </span>
                        <span className="text-[11px] text-white/40">
                          {YEAR_MIN}–{YEAR_MAX}
                        </span>
                      </div>

                      {/* Barra dupla interativa */}
                      <div className="relative h-7 flex items-center mb-1">
                        <div className="w-full h-1.5 rounded-full bg-white/[0.12] relative">
                          <div
                            className="absolute top-0 bottom-0 rounded-full bg-white"
                            style={{
                              left: `${yearLeftPct}%`,
                              width: `${Math.max(2, yearRightPct - yearLeftPct)}%`,
                            }}
                          />
                        </div>

                        <input
                          type="range"
                          min={YEAR_MIN}
                          max={YEAR_MAX}
                          step={1}
                          value={draftYearRange[0]}
                          aria-label="Ano inicial"
                          onChange={(e) => handleYearSliderChange(0, e.target.value)}
                          onMouseUp={() => commitYearRange(draftYearRange)}
                          onTouchEnd={() => commitYearRange(draftYearRange)}
                          className="studio-range absolute inset-0 w-full h-full"
                          style={{ zIndex: draftYearRange[0] > YEAR_MAX - 8 ? 20 : 10 }}
                        />
                        <input
                          type="range"
                          min={YEAR_MIN}
                          max={YEAR_MAX}
                          step={1}
                          value={draftYearRange[1]}
                          aria-label="Ano final"
                          onChange={(e) => handleYearSliderChange(1, e.target.value)}
                          onMouseUp={() => commitYearRange(draftYearRange)}
                          onTouchEnd={() => commitYearRange(draftYearRange)}
                          className="studio-range absolute inset-0 w-full h-full"
                          style={{ zIndex: 15 }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-medium text-white/35 mb-4 px-0.5">
                        <span>1950</span>
                        <span>1980</span>
                        <span>2000</span>
                        <span>2015</span>
                        <span>{YEAR_MAX}</span>
                      </div>

                      {/* Atalhos rápidos */}
                      <div className="pt-3 border-t border-white/[0.08] grid grid-cols-2 gap-1.5">
                        {YEAR_QUICK_PRESETS.map((preset) => {
                          const active =
                            draftYearRange[0] === preset.from && draftYearRange[1] === preset.to;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => applyYearPreset(preset.from, preset.to)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-left transition-all border ${
                                active
                                  ? 'bg-white text-[#09090B] border-white font-semibold'
                                  : 'bg-white/[0.03] hover:bg-white/[0.09] text-white/75 border-white/[0.07]'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* POPOVER: NOTA MÍNIMA COM BARRA DESLIZANTE */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenu((m) => (m === 'rating' ? null : 'rating'))}
                    className={`h-10 px-4 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-all ${
                      rating > 0 || openMenu === 'rating'
                        ? 'bg-white text-[#09090B] border-white font-semibold'
                        : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.1] text-white/85'
                    }`}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        rating > 0 ? 'fill-amber-500 text-amber-500' : ''
                      }`}
                    />
                    <span>{rating > 0 ? `Nota ${rating.toFixed(1)}+` : 'Nota'}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        openMenu === 'rating' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openMenu === 'rating' && (
                    <div className="absolute left-0 top-full mt-2.5 w-[min(92vw,300px)] bg-[#111115]/98 backdrop-blur-2xl border border-white/[0.14] rounded-2xl shadow-2xl p-4 animate-fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                          Nota mínima TMDB
                        </span>
                        {draftRating > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setDraftRating(0);
                              commitRating(0);
                            }}
                            className="text-xs font-medium text-white/55 hover:text-white transition-colors"
                          >
                            Resetar
                          </button>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between mb-4">
                        <div className="inline-flex items-center gap-2">
                          <Star
                            className={`w-5 h-5 ${
                              draftRating > 0
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-white/25'
                            }`}
                          />
                          <span className="text-2xl font-bold tracking-tight text-white">
                            {draftRating > 0 ? `${draftRating.toFixed(1)}+` : 'Todas'}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-amber-300/80">
                          {getRatingDescriptor(draftRating)}
                        </span>
                      </div>

                      {/* Barra deslizante dourada */}
                      <div className="relative h-7 flex items-center mb-1">
                        <div className="w-full h-1.5 rounded-full bg-white/[0.12] relative overflow-hidden">
                          <div
                            className="absolute top-0 bottom-0 left-0 rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                            style={{ width: `${ratingPct}%` }}
                          />
                        </div>

                        <input
                          type="range"
                          min={0}
                          max={RATING_MAX}
                          step={0.5}
                          value={draftRating}
                          aria-label="Nota mínima TMDB"
                          onChange={(e) => handleRatingSliderChange(e.target.value)}
                          onMouseUp={() => commitRating(draftRating)}
                          onTouchEnd={() => commitRating(draftRating)}
                          className="studio-range studio-range-amber absolute inset-0 w-full h-full z-10"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-medium text-white/35 mb-4 px-0.5">
                        <span>0.0</span>
                        <span>5.0</span>
                        <span>7.0</span>
                        <span>8.0</span>
                        <span>9.5</span>
                      </div>

                      {/* Atalhos rápidos */}
                      <div className="pt-3 border-t border-white/[0.08] grid grid-cols-4 gap-1.5">
                        {RATING_QUICK_PRESETS.map((opt) => {
                          const active = draftRating === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setDraftRating(opt.value);
                                commitRating(opt.value);
                              }}
                              className={`py-1.5 rounded-xl text-[11px] font-medium text-center transition-all border ${
                                active
                                  ? 'bg-amber-400 text-[#09090B] border-amber-400 font-semibold'
                                  : 'bg-white/[0.03] hover:bg-white/[0.09] text-white/75 border-white/[0.07]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* TOGGLE: GRÁTIS NO BRASIL (FREE + ADS) */}
                <button
                  type="button"
                  onClick={toggleFreeOnly}
                  aria-pressed={freeOnly}
                  className={`h-10 px-4 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-all ${
                    freeOnly
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 font-semibold shadow-[0_0_20px_rgba(16,185,129,0.18)]'
                      : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.1] text-white/85'
                  }`}
                >
                  <Sparkles
                    className={`w-3.5 h-3.5 ${freeOnly ? 'text-emerald-300' : 'text-emerald-400/75'}`}
                  />
                  <span>Grátis no BR</span>
                  {freeOnly && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                </button>
              </div>

              {/* DIREITA: ORDENAR POR */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenu((m) => (m === 'sort' ? null : 'sort'))}
                  className={`h-10 px-4 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-all ${
                    openMenu === 'sort'
                      ? 'bg-white text-[#09090B] border-white font-semibold'
                      : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/[0.1] text-white/85'
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{currentSortLabel}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      openMenu === 'sort' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openMenu === 'sort' && (
                  <div className="absolute right-0 top-full mt-2.5 w-52 bg-[#111115]/98 backdrop-blur-2xl border border-white/[0.14] rounded-2xl shadow-2xl p-1.5 animate-fade-in">
                    {sortOptions.map((option) => {
                      const active = sort === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleSelectSort(option.value)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors ${
                            active
                              ? 'bg-white text-[#09090B] font-semibold'
                              : 'text-white/80 hover:bg-white/[0.07] hover:text-white'
                          }`}
                        >
                          <span>{option.label}</span>
                          {active && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 3. CHIPS REMOVÍVEIS DOS FILTROS ATIVOS (SÓ APARECE QUANDO HÁ FILTRO) */}
            {hasAnyFilter && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {freeOnly && (
                  <button
                    type="button"
                    onClick={toggleFreeOnly}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-xs font-medium text-emerald-200 transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-300" />
                    <span>Grátis no Brasil</span>
                    <X className="w-3 h-3 text-emerald-200/70" />
                  </button>
                )}

                {activeProviderObjs.map((prov) => (
                  <button
                    key={`chip-prov-${prov.provider_id}`}
                    type="button"
                    onClick={() => toggleProvider(prov.provider_id)}
                    className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-xs font-medium text-white transition-colors"
                  >
                    <img
                      src={`${IMAGE_BASE}/w92${prov.logo_path}`}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover"
                    />
                    <span>{normalizeProviderLabel(prov.provider_name)}</span>
                    <X className="w-3 h-3 text-white/55" />
                  </button>
                ))}

                {activeGenreObjs.map((g) => (
                  <button
                    key={`chip-genre-${g.id}`}
                    type="button"
                    onClick={() => toggleGenre(g.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-xs font-medium text-white transition-colors"
                  >
                    <span>{g.name}</span>
                    <X className="w-3 h-3 text-white/55" />
                  </button>
                ))}

                {hasYearFilter && (
                  <button
                    type="button"
                    onClick={resetYearFilter}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-xs font-medium text-white transition-colors"
                  >
                    <span>{yearLabel}</span>
                    <X className="w-3 h-3 text-white/55" />
                  </button>
                )}

                {rating > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftRating(0);
                      commitRating(0);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-xs font-medium text-amber-300 transition-colors"
                  >
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{rating.toFixed(1)}+</span>
                    <X className="w-3 h-3 text-white/55" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white/50 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Limpar tudo
                </button>
              </div>
            )}
          </div>
        )}

        {/* GRADE DE RESULTADOS */}
        {loading ? (
          <CardGridSkeleton
            count={12}
            cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          />
        ) : results.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
              {results.map((item) => (
                <MovieCard
                  key={`${item.media_type}-${item.id}`}
                  id={item.id}
                  title={item.displayTitle}
                  image={getPosterUrl(item.poster_path)}
                  rating={item.displayRating}
                  year={item.displayYear}
                  mediaType={item.media_type}
                />
              ))}
            </div>

            {/* INFINITE SCROLL AUTOMÁTICO (SENTINELA + SHIMMER INLINE) */}
            {!query && hasMore && (
              <div className="mt-8">
                {loadingMore && (
                  <div className="space-y-6">
                    <CardGridSkeleton
                      count={6}
                      cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                    />
                    <div className="flex justify-center">
                      <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.09] text-xs font-medium text-white/60">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white/80" />
                        Carregando mais títulos...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={loadMoreSentinelRef} className="h-6 w-full" aria-hidden="true" />
              </div>
            )}

            {!query && !hasMore && results.length > 0 && (
              <div className="flex items-center justify-center gap-3 mt-14 text-xs text-white/35">
                <span className="h-px w-12 bg-white/10" />
                <span>Fim dos resultados para este filtro</span>
                <span className="h-px w-12 bg-white/10" />
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-white/50 mt-16 bg-white/[0.02] p-12 rounded-3xl border border-white/[0.07] max-w-2xl mx-auto">
            <Ticket className="w-14 h-14 mx-auto mb-4 text-white/20" />
            <h3 className="text-xl font-semibold mb-2 text-white">
              Nenhum título encontrado
            </h3>
            <p className="text-sm text-white/50 mb-6">
              Tente combinar outros streamings, gêneros ou ampliar a faixa de ano e nota.
            </p>
            {hasAnyFilter && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Resetar Filtros
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
