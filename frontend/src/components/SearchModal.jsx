import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Loader2,
  Star,
  Film,
  Tv,
  ArrowRight,
  TrendingUp,
  CornerDownLeft,
} from 'lucide-react';
import { searchMedia, getTrending, getPosterUrl } from '../services/api';

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_SEARCH_CACHE = 80;
const searchQueryCache = new Map();
let trendingQuickCache = { timestamp: 0, items: [] };

const getCachedSearch = (normQuery) => {
  const hit = searchQueryCache.get(normQuery);
  if (hit && Date.now() - hit.timestamp < SEARCH_CACHE_TTL_MS) {
    return hit.items;
  }
  return null;
};

const setCachedSearch = (normQuery, items) => {
  if (searchQueryCache.size >= MAX_SEARCH_CACHE && !searchQueryCache.has(normQuery)) {
    const oldest = searchQueryCache.keys().next().value;
    searchQueryCache.delete(oldest);
  }
  searchQueryCache.set(normQuery, { timestamp: Date.now(), items });
};

const getTriggerRect = () => {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById('studio-search-trigger');
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const getTargetBox = () => {
  if (typeof window === 'undefined') {
    return { top: 88, left: 200, width: 672 };
  }
  const width = Math.min(window.innerWidth - 32, 672);
  const left = Math.round((window.innerWidth - width) / 2);
  const top = Math.max(68, Math.round(window.innerHeight * 0.11));
  return { top, left, width };
};

const normalizeText = (str = '') =>
  String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function HighlightedTitle({ title = '', query = '' }) {
  const trimmed = query.trim();
  if (!trimmed) return title;
  const normTitle = normalizeText(title);
  const normQuery = normalizeText(trimmed);
  const idx = normTitle.indexOf(normQuery);
  if (idx === -1) return title;

  const before = title.slice(0, idx);
  const match = title.slice(idx, idx + trimmed.length);
  const after = title.slice(idx + trimmed.length);

  return (
    <>
      <span className="text-white/70">{before}</span>
      <span className="text-white font-semibold">{match}</span>
      <span className="text-white/70">{after}</span>
    </>
  );
}

export default function SearchModal({ isOpen, onClose }) {
  const [phase, setPhase] = useState('idle'); // 'idle' | 'entering' | 'open' | 'closing'
  const [anchorRect, setAnchorRect] = useState(null);
  const [targetBox, setTargetBox] = useState(getTargetBox);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [trendingQuick, setTrendingQuick] = useState(() => trendingQuickCache.items || []);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const reqSeqRef = useRef(0);
  const throttleTimerRef = useRef(null);
  const lastFetchAtRef = useRef(0);
  const closeTimerRef = useRef(null);
  const closingRef = useRef(false);
  const navigate = useNavigate();

  // Dispara a requisição real com cancelamento via AbortController e cache em memória
  const executeSearch = useCallback(async (rawText) => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const norm = trimmed.toLowerCase();
    const cached = getCachedSearch(norm);
    if (cached) {
      setResults(cached);
      setIsSearching(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const reqId = ++reqSeqRef.current;
    lastFetchAtRef.current = Date.now();
    setIsSearching(true);

    const data = await searchMedia(trimmed, 'multi', { signal: controller.signal });
    if (data === null || reqId !== reqSeqRef.current) return;

    // Ranqueia priorizando títulos reais/populares que batem com o prefixo digitado
    const normQuery = normalizeText(trimmed);
    const ranked = [...data].sort((a, b) => {
      const score = (item) => {
        const nt = normalizeText(item.displayTitle);
        const prefixBonus = nt.startsWith(normQuery) ? 14 : nt.includes(normQuery) ? 6 : 0;
        const popBonus = Math.log10((item.popularity || 0) + 1) * 18;
        const votesBonus = Math.log10((item.vote_count || 0) + 1) * 14;
        const posterBonus = item.poster_path ? 8 : 0;
        return prefixBonus + popBonus + votesBonus + posterBonus;
      };
      return score(b) - score(a);
    });

    const sliced = ranked.slice(0, 8);
    setCachedSearch(norm, sliced);
    setResults(sliced);
    setIsSearching(false);
  }, []);

  // Busca letra-a-letra fluida: executa imediatamente se passou >=130ms (nunca espera parar de digitar!)
  const scheduleLiveSearch = useCallback(
    (nextText) => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }

      const trimmed = nextText.trim();
      if (!trimmed) {
        if (abortRef.current) abortRef.current.abort();
        reqSeqRef.current += 1;
        setResults([]);
        setIsSearching(false);
        setSelectedIndex(-1);
        return;
      }

      const norm = trimmed.toLowerCase();
      const cached = getCachedSearch(norm);
      if (cached) {
        setResults(cached);
        setIsSearching(false);
        return;
      }

      // Mantém resultados compatíveis filtrados localmente enquanto a nova letra chega (0ms)
      const normNeedle = normalizeText(trimmed);
      setResults((prev) =>
        prev.filter((item) => normalizeText(item.displayTitle).includes(normNeedle))
      );

      const elapsed = Date.now() - lastFetchAtRef.current;
      const MIN_INTERVAL_MS = 130;

      if (elapsed >= MIN_INTERVAL_MS) {
        executeSearch(trimmed);
      } else {
        setIsSearching(true);
        throttleTimerRef.current = setTimeout(() => {
          executeSearch(trimmed);
        }, MIN_INTERVAL_MS - elapsed);
      }
    },
    [executeSearch]
  );

  // Animação de fechamento suave: devolve a barra exatamente para o botão Buscar na navbar
  const handleSmoothClose = useCallback(
    (afterClose = null) => {
      if (closingRef.current) return;
      closingRef.current = true;

      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      if (abortRef.current) abortRef.current.abort();

      setAnchorRect(getTriggerRect());
      setPhase('closing');

      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        closingRef.current = false;
        setPhase('idle');
        setQuery('');
        setResults([]);
        setSelectedIndex(-1);
        setIsSearching(false);
        onClose();
        afterClose?.();
      }, 300);
    },
    [onClose]
  );

  // Orquestra abertura FLIP (botão na navbar -> centro da tela) e sugestões em alta
  useEffect(() => {
    if (!isOpen) return undefined;
    closingRef.current = false;

    let raf1 = 0;
    let raf2 = 0;
    let focusTimer = 0;

    raf1 = requestAnimationFrame(() => {
      setAnchorRect(getTriggerRect());
      setTargetBox(getTargetBox());
      setPhase('entering');

      raf2 = requestAnimationFrame(() => {
        setPhase('open');
        focusTimer = setTimeout(() => inputRef.current?.focus(), 140);
      });
    });

    // Carrega sugestões "Em Alta" 1 única vez (cache 5 min) para o estado vazio não ficar sem vida
    const staleTrending =
      trendingQuickCache.items.length === 0 ||
      Date.now() - trendingQuickCache.timestamp > SEARCH_CACHE_TTL_MS;
    let cancelled = false;
    if (staleTrending) {
      getTrending('all', 1).then((items) => {
        if (cancelled) return;
        const top = (items || []).slice(0, 5);
        trendingQuickCache = { timestamp: Date.now(), items: top };
        setTrendingQuick(top);
      });
    }

    const onResize = () => {
      setTargetBox(getTargetBox());
      setAnchorRect(getTriggerRect());
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(focusTimer);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Limpeza geral na desmontagem
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Autocomplete inline ("possível busca") quando o melhor título começa com o que o usuário digitou
  const inlineSuggestion = useMemo(() => {
    const raw = query;
    const trimmed = raw.trimStart();
    if (!trimmed || results.length === 0) return null;

    const normInput = normalizeText(trimmed);
    const candidate = results.find((item) => {
      const title = item.displayTitle || '';
      return title.length > trimmed.length && normalizeText(title).startsWith(normInput);
    });
    if (!candidate) return null;

    const fullTitle = candidate.displayTitle;

    return {
      fullTitle,
      completion: fullTitle.slice(trimmed.length),
      item: candidate,
    };
  }, [query, results]);

  const displayedList = query.trim() ? results : trendingQuick;

  const handleSelect = useCallback(
    (item) => {
      if (!item) return;
      const target = item.media_type === 'movie' ? `/filme/${item.id}` : `/serie/${item.id}`;
      handleSmoothClose(() => navigate(target, { state: { heroPrefill: item } }));
    },
    [handleSmoothClose, navigate]
  );

  const handleSubmit = useCallback(
    (e) => {
      e?.preventDefault?.();
      if (selectedIndex >= 0 && displayedList[selectedIndex]) {
        handleSelect(displayedList[selectedIndex]);
        return;
      }
      const trimmed = query.trim();
      if (!trimmed) return;
      handleSmoothClose(() => navigate(`/explorar?q=${encodeURIComponent(trimmed)}`));
    },
    [selectedIndex, displayedList, handleSelect, query, handleSmoothClose, navigate]
  );

  // Atalhos de teclado: ESC (volta suave), Setas ↑/↓, Tab (completa sugestão)
  useEffect(() => {
    if (!isOpen && phase === 'idle') return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSmoothClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleSmoothClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (displayedList.length > 0) {
          setSelectedIndex((i) => (i + 1) % displayedList.length);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (displayedList.length > 0) {
          setSelectedIndex((i) => (i <= 0 ? displayedList.length - 1 : i - 1));
        }
      } else if (e.key === 'Tab' && inlineSuggestion) {
        e.preventDefault();
        const completed = inlineSuggestion.fullTitle;
        setQuery(completed);
        scheduleLiveSearch(completed);
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, phase, displayedList.length, inlineSuggestion, handleSmoothClose, scheduleLiveSearch]);

  if (!isOpen && phase === 'idle') return null;

  const isExpanded = phase === 'open';
  const morphStyle =
    isExpanded || !anchorRect
      ? {
          top: `${targetBox.top}px`,
          left: `${targetBox.left}px`,
          width: `${targetBox.width}px`,
          borderRadius: '22px',
        }
      : {
          top: `${anchorRect.top}px`,
          left: `${anchorRect.left}px`,
          width: `${anchorRect.width}px`,
          borderRadius: '12px',
        };

  return (
    <>
      {/* Backdrop escuro com blur independente (fade suave sem apagar a barra em voo) */}
      <div
        className={`fixed inset-0 z-[89] transition-all duration-300 ${
          isExpanded
            ? 'bg-black/75 backdrop-blur-xl opacity-100'
            : 'bg-black/0 backdrop-blur-none opacity-0 pointer-events-none'
        }`}
        onClick={() => handleSmoothClose()}
        aria-hidden="true"
      />

      {/* CONTAINER FLIP QUE VOA DA NAVBAR PARA O CENTRO E RETORNA VISÍVEL AO FECHAR */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar no studio"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          zIndex: 90,
          ...morphStyle,
          transition:
            phase === 'closing'
              ? 'top 300ms cubic-bezier(0.32, 0.72, 0, 1), left 300ms cubic-bezier(0.32, 0.72, 0, 1), width 300ms cubic-bezier(0.32, 0.72, 0, 1), border-radius 300ms cubic-bezier(0.32, 0.72, 0, 1), background-color 240ms ease, border-color 240ms ease'
              : 'top 380ms cubic-bezier(0.22, 1, 0.36, 1), left 380ms cubic-bezier(0.22, 1, 0.36, 1), width 380ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 380ms cubic-bezier(0.22, 1, 0.36, 1), background-color 280ms ease, border-color 280ms ease',
        }}
        className={`overflow-hidden backdrop-blur-2xl border shadow-[0_32px_90px_rgba(0,0,0,0.92)] ${
          isExpanded
            ? 'bg-[#101014]/96 border-white/[0.13]'
            : 'bg-white/[0.09] border-white/[0.16]'
        }`}
      >
        {/* CAMPO DE BUSCA COM AUTOCOMPLETE INLINE */}
        <form
          onSubmit={handleSubmit}
          className={`flex items-center gap-3 transition-all duration-300 ${
            isExpanded
              ? 'px-5 h-15 border-b border-white/[0.08]'
              : 'px-3.5 h-10 border-b border-transparent'
          }`}
        >
          <Search
            className={`flex-shrink-0 transition-all duration-300 ${
              isExpanded ? 'w-5 h-5 text-white/60' : 'w-4 h-4 text-white/70'
            }`}
          />

          <div className="relative flex-1 min-w-0 flex items-center">
            {/* Ghost Autocomplete ("possível busca" direto atrás do cursor) */}
            {isExpanded && inlineSuggestion && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center text-base sm:text-lg font-medium whitespace-pre overflow-hidden"
              >
                <span className="invisible">{query}</span>
                <span className="text-white/25 truncate">{inlineSuggestion.completion}</span>
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                setSelectedIndex(-1);
                scheduleLiveSearch(next);
              }}
              placeholder={isExpanded ? 'Buscar filmes, séries, animes...' : 'Buscar'}
              className={`relative z-10 w-full bg-transparent text-white placeholder-white/40 font-medium focus:outline-none transition-all duration-300 ${
                isExpanded ? 'text-base sm:text-lg' : 'text-xs'
              }`}
            />
          </div>

          {isExpanded && inlineSuggestion && (
            <button
              type="button"
              onClick={() => {
                setQuery(inlineSuggestion.fullTitle);
                scheduleLiveSearch(inlineSuggestion.fullTitle);
                inputRef.current?.focus();
              }}
              title="Completar sugestão (Tab)"
              className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.1] text-[10px] font-semibold uppercase tracking-wider text-white/55 hover:text-white transition-colors flex-shrink-0"
            >
              Tab
            </button>
          )}

          {isExpanded && isSearching ? (
            <Loader2 className="w-4 h-4 text-white/75 animate-spin flex-shrink-0" />
          ) : (
            isExpanded &&
            query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  scheduleLiveSearch('');
                  inputRef.current?.focus();
                }}
                className="text-white/45 hover:text-white p-1 rounded-lg hover:bg-white/[0.08] transition-colors flex-shrink-0"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )
          )}

          {isExpanded && (
            <button
              type="button"
              onClick={() => handleSmoothClose()}
              className="hidden sm:inline-flex items-center px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-[10px] font-semibold text-white/50 hover:text-white transition-colors flex-shrink-0"
            >
              ESC
            </button>
          )}
        </form>

        {/* PAINEL DE RESULTADOS E SUGESTÕES (DESDOBRA SUAVEMENTE APÓS O VOO) */}
        <div
          className={`transition-all duration-300 overflow-hidden ${
            isExpanded ? 'max-h-[62vh] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="max-h-[56vh] overflow-y-auto custom-scrollbar">
            {query.trim() === '' ? (
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between px-2.5 pb-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/40">
                    <TrendingUp className="w-3.5 h-3.5 text-[#FE3131]" />
                    Em alta agora
                  </span>
                  <span className="text-[11px] text-white/35">Digite para buscar em tempo real</span>
                </div>

                {trendingQuick.length > 0 ? (
                  <div className="space-y-1">
                    {trendingQuick.map((item, idx) => {
                      const active = idx === selectedIndex;
                      return (
                        <button
                          key={`trend-${item.media_type}-${item.id}`}
                          type="button"
                          onMouseEnter={() => setSelectedIndex(idx)}
                          onClick={() => handleSelect(item)}
                          className={`w-full text-left flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all group ${
                            active ? 'bg-white/[0.09]' : 'hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="w-9 h-13 rounded-lg overflow-hidden bg-white/[0.05] border border-white/[0.08] flex-shrink-0">
                            {item.poster_path ? (
                              <img
                                src={getPosterUrl(item.poster_path, 'w92')}
                                alt={item.displayTitle}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/25">
                                <Film className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-display text-sm font-medium text-white truncate">
                              {item.displayTitle}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/45">
                              <span>{item.media_type === 'movie' ? 'Filme' : 'Série'}</span>
                              {item.displayYear && <span>• {item.displayYear}</span>}
                              <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                                <Star className="w-3 h-3 fill-amber-400" />
                                {item.displayRating}
                              </span>
                            </div>
                          </div>

                          <ArrowRight
                            className={`w-4 h-4 flex-shrink-0 transition-all ${
                              active
                                ? 'text-white translate-x-0.5'
                                : 'text-white/25 group-hover:text-white'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-white/40">
                    Digite o nome de qualquer filme ou série...
                  </div>
                )}
              </div>
            ) : results.length > 0 ? (
              <div className="p-2.5 sm:p-3 space-y-1">
                {results.map((item, idx) => {
                  const active = idx === selectedIndex;
                  return (
                    <button
                      key={`${item.media_type}-${item.id}`}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => handleSelect(item)}
                      className={`w-full text-left flex items-center gap-3.5 px-3 py-2.5 rounded-xl transition-all group ${
                        active ? 'bg-white/[0.1]' : 'hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="w-10 h-14 rounded-xl overflow-hidden bg-white/[0.05] flex-shrink-0 border border-white/[0.09]">
                        {item.poster_path ? (
                          <img
                            src={getPosterUrl(item.poster_path, 'w92')}
                            alt={item.displayTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/25">
                            <Film className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-display text-sm sm:text-[15px] font-medium truncate">
                          <HighlightedTitle title={item.displayTitle} query={query} />
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-white/45">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.07] text-white/75 text-[10px] font-semibold uppercase tracking-wider">
                            {item.media_type === 'movie' ? (
                              <Film className="w-2.5 h-2.5" />
                            ) : (
                              <Tv className="w-2.5 h-2.5" />
                            )}
                            {item.media_type === 'movie' ? 'Filme' : 'Série'}
                          </span>
                          {item.displayYear && <span>{item.displayYear}</span>}
                          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {item.displayRating}
                          </span>
                        </div>
                      </div>

                      <ArrowRight
                        className={`w-4 h-4 flex-shrink-0 transition-all ${
                          active
                            ? 'text-[#FE3131] translate-x-0.5'
                            : 'text-white/25 group-hover:text-white group-hover:translate-x-0.5'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            ) : isSearching ? (
              <div className="p-8 flex items-center justify-center gap-2.5 text-xs text-white/50">
                <Loader2 className="w-4 h-4 animate-spin text-white/75" />
                Buscando "{query.trim()}"...
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-white/45">
                Nenhum resultado encontrado para "<span className="text-white">{query.trim()}</span>"
              </div>
            )}
          </div>

          {/* Rodapé editorial com ação de busca completa e atalhos */}
          <div className="px-4 py-2.5 bg-white/[0.025] border-t border-white/[0.07] flex items-center justify-between gap-3 text-[11px] text-white/40">
            {query.trim() ? (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 font-medium text-white/80 hover:text-white transition-colors truncate"
              >
                <span>Ver todos os resultados para "{query.trim()}"</span>
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
            ) : (
              <span>Navegue com as setas ou digite para filtrar</span>
            )}

            <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.07] text-white/55 font-sans">
                  ↑↓
                </kbd>
                Navegar
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.07] text-white/55 font-sans inline-flex items-center">
                  <CornerDownLeft className="w-2.5 h-2.5" />
                </kbd>
                Abrir
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
