import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Film,
  Tv,
  ChevronDown,
  RotateCcw,
  Plus,
  Loader2,
  Ticket,
  X,
  Check,
  Star,
  Calendar,
  Tags,
  ArrowUpDown,
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

const YEAR_PRESETS = [
  { id: 'all', label: 'Qualquer ano', year: '', yearFrom: '', yearTo: '' },
  { id: String(CURRENT_YEAR), label: String(CURRENT_YEAR), year: String(CURRENT_YEAR), yearFrom: '', yearTo: '' },
  { id: String(CURRENT_YEAR - 1), label: String(CURRENT_YEAR - 1), year: String(CURRENT_YEAR - 1), yearFrom: '', yearTo: '' },
  { id: String(CURRENT_YEAR - 2), label: String(CURRENT_YEAR - 2), year: String(CURRENT_YEAR - 2), yearFrom: '', yearTo: '' },
  { id: '2020s', label: 'Anos 2020', year: '', yearFrom: '2020', yearTo: String(CURRENT_YEAR) },
  { id: '2010s', label: 'Anos 2010', year: '', yearFrom: '2010', yearTo: '2019' },
  { id: '2000s', label: 'Anos 2000', year: '', yearFrom: '2000', yearTo: '2009' },
  { id: 'classics', label: 'Clássicos (< 2000)', year: '', yearFrom: '1950', yearTo: '1999' },
];

const RATING_OPTIONS = [
  { value: 0, label: 'Qualquer nota', desc: 'Sem filtro mínimo' },
  { value: 6, label: '6.0+', desc: 'Bem avaliados' },
  { value: 7, label: '7.0+', desc: 'Muito bons' },
  { value: 8, label: '8.0+', desc: 'Aclamados' },
];

const normalizeProviderLabel = (name = '') =>
  name
    .replace(/^Amazon Prime Video$/i, 'Prime Video')
    .replace(/^Amazon Video$/i, 'Prime Video')
    .replace(/^HBO Max$/i, 'Max');

export default function Explorer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get('q') || '';
  const initialType = searchParams.get('tipo') === 'tv' ? 'tv' : 'movie';
  const initialGenres = parseIdList(searchParams.get('genero'));
  const initialProviders = parseIdList(searchParams.get('streaming'));
  const initialSort = searchParams.get('sort') || 'popularity.desc';
  const initialYear = searchParams.get('ano') || '';
  const initialPeriod = searchParams.get('periodo') || (initialYear ? 'custom' : 'all');
  const initialRating = Number(searchParams.get('nota')) || 0;

  const [mediaType, setMediaType] = useState(initialType);
  const [genres, setGenres] = useState(() => explorerMetaCache.get(initialType)?.genres || []);
  const [providers, setProviders] = useState(
    () => explorerMetaCache.get(initialType)?.providers || []
  );

  const [selectedGenres, setSelectedGenres] = useState(initialGenres);
  const [selectedProviders, setSelectedProviders] = useState(initialProviders);
  const [yearPresetId, setYearPresetId] = useState(initialPeriod);
  const [customYear, setCustomYear] = useState(initialYear);
  const [rating, setRating] = useState(initialRating);
  const [sort, setSort] = useState(initialSort);

  // Apenas um popover aberto por vez: 'genres' | 'year' | 'rating' | 'sort' | null
  const [openMenu, setOpenMenu] = useState(null);
  const toolbarRef = useRef(null);
  const requestSeqRef = useRef(0);

  // Sincroniza quando o usuário navega para /explorar com novos query params (ex: clicar em categoria na Home)
  const searchString = searchParams.toString();
  const [prevSearchString, setPrevSearchString] = useState(searchString);
  if (searchString !== prevSearchString) {
    setPrevSearchString(searchString);
    const paramTipo = searchParams.get('tipo');
    if (paramTipo === 'movie' || paramTipo === 'tv') {
      setMediaType(paramTipo);
    }
    setSelectedGenres(parseIdList(searchParams.get('genero')));
    setSelectedProviders(parseIdList(searchParams.get('streaming')));
    const pSort = searchParams.get('sort');
    setSort(pSort || 'popularity.desc');
    const pYear = searchParams.get('ano') || '';
    const pPeriod = searchParams.get('periodo') || (pYear ? 'custom' : 'all');
    setCustomYear(pYear);
    setYearPresetId(pPeriod);
    setRating(Number(searchParams.get('nota')) || 0);
  }

  // Resolve parâmetros efetivos de ano / faixa
  const resolvedYearFilter = useMemo(() => {
    if (yearPresetId === 'custom') {
      return {
        year: /^\d{4}$/.test(customYear) ? customYear : '',
        yearFrom: '',
        yearTo: '',
        label: /^\d{4}$/.test(customYear) ? customYear : 'Ano',
      };
    }
    const preset = YEAR_PRESETS.find((p) => p.id === yearPresetId) || YEAR_PRESETS[0];
    return {
      year: preset.year,
      yearFrom: preset.yearFrom,
      yearTo: preset.yearTo,
      label: preset.id === 'all' ? 'Ano' : preset.label,
    };
  }, [yearPresetId, customYear]);

  const genresKey = [...selectedGenres].sort((a, b) => a - b).join(',');
  const providersKey = [...selectedProviders].sort((a, b) => a - b).join('|');

  const cacheKey = `${query}|${mediaType}|${genresKey}|${providersKey}|${resolvedYearFilter.year}|${resolvedYearFilter.yearFrom}|${resolvedYearFilter.yearTo}|${rating}|${sort}`;

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
        value: mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc',
        label: 'Mais Recentes',
      },
    ],
    [mediaType]
  );

  // Atualiza a URL de forma limpa (replace: true para não poluir o botão Voltar)
  const syncUrlParams = (overrides = {}) => {
    if (query) return;
    const next = {
      tipo: overrides.mediaType ?? mediaType,
      genres: overrides.selectedGenres ?? selectedGenres,
      providers: overrides.selectedProviders ?? selectedProviders,
      period: overrides.yearPresetId ?? yearPresetId,
      customYear: overrides.customYear ?? customYear,
      rating: overrides.rating ?? rating,
      sort: overrides.sort ?? sort,
    };

    const params = new URLSearchParams();
    params.set('tipo', next.tipo);
    if (next.genres.length > 0) params.set('genero', next.genres.join(','));
    if (next.providers.length > 0) params.set('streaming', next.providers.join('|'));
    if (next.period === 'custom' && /^\d{4}$/.test(next.customYear)) {
      params.set('ano', next.customYear);
    } else if (next.period && next.period !== 'all' && next.period !== 'custom') {
      params.set('periodo', next.period);
    }
    if (next.rating > 0) params.set('nota', String(next.rating));
    if (next.sort && next.sort !== 'popularity.desc') params.set('sort', next.sort);

    const nextStr = params.toString();
    setPrevSearchString(nextStr);
    setSearchParams(params, { replace: true });
  };

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

  // Carrega gêneros e streamings disponíveis para Filmes ou Séries
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
        getStreamingProviders(mediaType),
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

    const fetchInitialData = async () => {
      const cached = explorerResultsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < EXPLORER_CACHE_TTL_MS) {
        setResults(cached.results);
        setTotalResults(cached.totalResults || cached.results.length);
        setPage(cached.page);
        setHasMore(cached.hasMore);
        setLoading(false);
        if (lastExplorerScroll.key === cacheKey && lastExplorerScroll.y > 0) {
          window.scrollTo(0, lastExplorerScroll.y);
        }
        return;
      }

      setLoading(true);
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
          year: resolvedYearFilter.year,
          yearFrom: resolvedYearFilter.yearFrom,
          yearTo: resolvedYearFilter.yearTo,
          rating: rating > 0 ? rating : '',
          sort,
          provider: providersKey || null,
          withMeta: true,
        });
        items = res.results;
        total = res.totalResults;
        moreAvailable = res.totalPages > 1 && items.length >= 18;
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
    resolvedYearFilter.year,
    resolvedYearFilter.yearFrom,
    resolvedYearFilter.yearTo,
    rating,
    sort,
  ]);

  const handleSwitchType = (nextType) => {
    if (nextType === mediaType) return;
    let nextSort = sort;
    if (sort === 'first_air_date.desc' && nextType === 'movie') {
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

  const handleSelectYearPreset = (presetId) => {
    setYearPresetId(presetId);
    setCustomYear('');
    setOpenMenu(null);
    syncUrlParams({ yearPresetId: presetId, customYear: '' });
  };

  const handleCustomYearChange = (val) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setCustomYear(clean);
    if (clean.length === 0) {
      setYearPresetId('all');
      syncUrlParams({ yearPresetId: 'all', customYear: '' });
    } else {
      setYearPresetId('custom');
      if (clean.length === 4) {
        syncUrlParams({ yearPresetId: 'custom', customYear: clean });
      }
    }
  };

  const handleSelectRating = (val) => {
    setRating(val);
    setOpenMenu(null);
    syncUrlParams({ rating: val });
  };

  const handleSelectSort = (val) => {
    setSort(val);
    setOpenMenu(null);
    syncUrlParams({ sort: val });
  };

  const clearAllFilters = () => {
    setSelectedGenres([]);
    setSelectedProviders([]);
    setYearPresetId('all');
    setCustomYear('');
    setRating(0);
    setSort('popularity.desc');
    setOpenMenu(null);
    syncUrlParams({
      selectedGenres: [],
      selectedProviders: [],
      yearPresetId: 'all',
      customYear: '',
      rating: 0,
      sort: 'popularity.desc',
    });
  };

  const handleLoadMore = async () => {
    if (query || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;

    const res = await discoverMedia({
      type: mediaType,
      genre: genresKey || null,
      page: nextPage,
      year: resolvedYearFilter.year,
      yearFrom: resolvedYearFilter.yearFrom,
      yearTo: resolvedYearFilter.yearTo,
      rating: rating > 0 ? rating : '',
      sort,
      provider: providersKey || null,
      withMeta: true,
    });

    const existingIds = new Set(results.map((r) => r.id));
    const fresh = res.results.filter((r) => !existingIds.has(r.id));
    const merged = [...results, ...fresh];
    const nextHasMore = nextPage < res.totalPages && res.results.length >= 18;

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
  };

  const activeProviderObjs = providers.filter((p) =>
    selectedProviders.includes(p.provider_id)
  );
  const activeGenreObjs = genres.filter((g) => selectedGenres.includes(g.id));
  const hasYearFilter = Boolean(
    resolvedYearFilter.year || resolvedYearFilter.yearFrom || resolvedYearFilter.yearTo
  );
  const hasAnyFilter = Boolean(
    selectedProviders.length > 0 ||
      selectedGenres.length > 0 ||
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

          {!query && (
            <div className="inline-flex p-1 bg-white/[0.05] border border-white/[0.1] rounded-xl self-start md:self-auto">
              <button
                type="button"
                onClick={() => handleSwitchType('movie')}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
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
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
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

            {/* 2. BARRA ÚNICA DE FILTROS (POPOVERS LIMPOS — SEM PAREDE DE BOTÕES) */}
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

                {/* POPOVER: ANO / PERÍODO */}
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
                    <span>{resolvedYearFilter.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${
                        openMenu === 'year' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {openMenu === 'year' && (
                    <div className="absolute left-0 top-full mt-2.5 w-64 bg-[#111115]/98 backdrop-blur-2xl border border-white/[0.14] rounded-2xl shadow-2xl p-3.5 animate-fade-in">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/45 mb-2.5 px-1">
                        Período
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 mb-3">
                        {YEAR_PRESETS.map((preset) => {
                          const active = yearPresetId === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => handleSelectYearPreset(preset.id)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all border ${
                                active
                                  ? 'bg-white text-[#09090B] border-white font-semibold'
                                  : 'bg-white/[0.03] hover:bg-white/[0.09] text-white/80 border-white/[0.06]'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-2.5 border-t border-white/[0.08]">
                        <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1.5 px-1">
                          Ou digite um ano exato
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="Ex: 2019"
                          value={customYear}
                          onChange={(e) => handleCustomYearChange(e.target.value)}
                          className="w-full bg-black/50 text-white text-xs font-medium border border-white/[0.14] rounded-xl px-3 py-2 focus:border-white/45 outline-none placeholder-white/30"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* POPOVER: NOTA MÍNIMA */}
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
                    <div className="absolute left-0 top-full mt-2.5 w-56 bg-[#111115]/98 backdrop-blur-2xl border border-white/[0.14] rounded-2xl shadow-2xl p-2 animate-fade-in">
                      {RATING_OPTIONS.map((opt) => {
                        const active = rating === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelectRating(opt.value)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between transition-colors ${
                              active
                                ? 'bg-white text-[#09090B]'
                                : 'text-white/85 hover:bg-white/[0.07]'
                            }`}
                          >
                            <div>
                              <span className="block text-xs font-semibold">{opt.label}</span>
                              <span
                                className={`block text-[10px] ${
                                  active ? 'text-[#09090B]/65' : 'text-white/40'
                                }`}
                              >
                                {opt.desc}
                              </span>
                            </div>
                            {active && <Check className="w-3.5 h-3.5" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                    onClick={() => handleSelectYearPreset('all')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-xs font-medium text-white transition-colors"
                  >
                    <span>{resolvedYearFilter.label}</span>
                    <X className="w-3 h-3 text-white/55" />
                  </button>
                )}

                {rating > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSelectRating(0)}
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
              {results.map((item, index) => (
                <MovieCard
                  key={`${item.media_type}-${item.id}-${index}`}
                  id={item.id}
                  title={item.displayTitle}
                  image={getPosterUrl(item.poster_path)}
                  rating={item.displayRating}
                  year={item.displayYear}
                  mediaType={item.media_type}
                />
              ))}
            </div>

            {!query && hasMore && (
              <div className="flex justify-center mt-14">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="bg-white/[0.06] hover:bg-white/[0.14] text-white border border-white/[0.14] font-medium text-sm py-3.5 px-10 rounded-xl transition-all flex items-center gap-2.5 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-white" />
                      Carregar Mais {mediaType === 'movie' ? 'Filmes' : 'Séries'}
                    </>
                  )}
                </button>
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
              Tente combinar outros streamings, gêneros ou ampliar o período.
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
