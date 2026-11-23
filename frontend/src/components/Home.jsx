import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Play,
  ChevronRight,
  ChevronLeft,
  Star,
  Heart,
  Dices,
  Film,
  Sparkles,
  ThumbsUp,
  Meh,
  RefreshCw,
  Check,
  User,
} from 'lucide-react';
import TrailerModal from './TrailerModal';
import TrailerPreviewCard from './TrailerPreviewCard';
import { HeroSkeleton, CardGridSkeleton } from './Skeletons';
import {
  getHeroShowcase,
  getTrending,
  getPopularMovies,
  getNowPlayingMovies,
  getTopRatedMovies,
  getPopularSeries,
  getNewSeries,
  getPopularPeople,
  getPosterUrl,
  getBackdropUrl,
  IMAGE_BASE,
} from '../services/api';
import {
  isFavorite,
  toggleFavorite,
  getUserReview,
  saveUserReview,
} from '../utils/storage';
import { useToast } from '../utils/toast';
import { resolvePlatformMeta } from '../utils/streaming';
import { preloadImage, ensureImageDecoded } from '../utils/imagePreload';

const GENRE_LABELS = {
  28: 'Ação',
  12: 'Aventura',
  16: 'Animação',
  35: 'Comédia',
  80: 'Crime',
  99: 'Documentário',
  18: 'Drama',
  10751: 'Família',
  14: 'Fantasia',
  36: 'História',
  27: 'Terror',
  10402: 'Música',
  9648: 'Mistério',
  10749: 'Romance',
  878: 'Ficção Científica',
  53: 'Suspense',
  10752: 'Guerra',
  37: 'Faroeste',
  10759: 'Ação & Aventura',
  10762: 'Infantil',
  10765: 'Sci-Fi & Fantasia',
  10766: 'Novela',
  10768: 'Guerra & Política',
};

// Categorias de filmes (grid editorial 4x2 minimalista)
const MOVIE_CATEGORIES = [
  { id: 28, matchIds: [28, 10759], label: 'Ação' },
  { id: 878, matchIds: [878, 10765], label: 'Ficção Científica' },
  { id: 27, matchIds: [27], label: 'Terror' },
  { id: 53, matchIds: [53, 9648, 80], label: 'Suspense' },
  { id: 12, matchIds: [12, 14], label: 'Aventura' },
  { id: 18, matchIds: [18], label: 'Drama' },
  { id: 35, matchIds: [35], label: 'Comédia' },
  { id: 16, matchIds: [16, 10751], label: 'Animação' },
];

const LAST_SHOWN_KEY = 'studio_last_home_ids';

const getItemKey = (item) => `${item?.media_type || 'tv'}-${item?.id}`;

const readPrevShownIds = () => {
  try {
    const raw = sessionStorage.getItem(LAST_SHOWN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const writePrevShownIds = (idsSet) => {
  try {
    sessionStorage.setItem(LAST_SHOWN_KEY, JSON.stringify(Array.from(idsSet).slice(0, 80)));
  } catch {
    // ignora
  }
};

const shuffleArray = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * Seleciona itens únicos priorizando títulos inéditos (não exibidos na visita anterior),
 * excluindo estritamente qualquer título já em `excludedSet` (Hero e seções anteriores).
 */
const smartPick = (pool, count, excludedSet, prevShownSet, { requireBackdrop = false, trackInExcluded = true } = {}) => {
  const localSeen = new Set();
  const eligible = [];

  for (const item of pool) {
    if (!item || !item.id) continue;
    const key = getItemKey(item);
    if (excludedSet.has(key) || localSeen.has(key)) continue;
    if (requireBackdrop && !item.backdrop_path) continue;
    if (!item.poster_path && !item.backdrop_path) continue;
    localSeen.add(key);
    eligible.push(item);
  }

  const unseen = shuffleArray(eligible.filter((i) => !prevShownSet.has(getItemKey(i))));
  const seenBefore = shuffleArray(eligible.filter((i) => prevShownSet.has(getItemKey(i))));
  const picked = [...unseen, ...seenBefore].slice(0, count);

  if (trackInExcluded) {
    picked.forEach((i) => excludedSet.add(getItemKey(i)));
  }

  return picked;
};

const formatMonthYear = (dateStr) => {
  if (!dateStr) return 'Em catálogo';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Em catálogo';
  const raw = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const formatRuntimeShort = (mins) => {
  if (!mins) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

function StarRow({ voteAverage }) {
  const score5 = Math.max(1, Math.min(5, Math.round((Number(voteAverage) || 0) / 2)));
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Nota ${score5} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${
            n <= score5
              ? 'text-amber-400 fill-amber-400'
              : 'text-white/15 fill-white/10'
          }`}
        />
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle, linkTo, linkLabel = 'Ver tudo' }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-white/45 mt-1">{subtitle}</p>
        )}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-medium text-white/70 hover:text-white transition-all flex-shrink-0"
        >
          {linkLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

/**
 * Numeral sólido geométrico para o TOP 10 (sem stroke/riscos internos de fontes variáveis)
 */
function Top10RankNumber({ rank }) {
  const isTwoDigits = rank >= 10;

  return (
    <span
      aria-hidden="true"
      className={`font-display font-extrabold leading-[0.78] select-none pointer-events-none flex-shrink-0 bg-gradient-to-b from-white/40 via-white/22 to-white/8 bg-clip-text text-transparent group-hover:from-white group-hover:via-white/90 group-hover:to-white/65 transition-all duration-300 ${
        isTwoDigits
          ? 'text-[76px] sm:text-[94px] tracking-tighter'
          : 'text-[88px] sm:text-[112px] tracking-tight'
      }`}
    >
      {rank}
    </span>
  );
}

/**
 * TOP 10 CORRIGIDO:
 * - Números SVG 100% visíveis ao lado do pôster (nunca cortados)
 * - Arrastar com o mouse (click & drag) + setas ← → + touch até o #10
 * - overflow-y-hidden eliminando qualquer scroll vertical interno
 */
function Top10Rail({ title, items, mediaType }) {
  const railRef = useRef(null);
  const dragRef = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });
  const [isDragging, setIsDragging] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateScrollEdges = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    updateScrollEdges();
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, updateScrollEdges]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragRef.current.isDown || !railRef.current) return;
      const dx = e.pageX - dragRef.current.startX;
      if (Math.abs(dx) > 5) {
        dragRef.current.moved = true;
        setIsDragging(true);
      }
      if (dragRef.current.moved) {
        e.preventDefault();
        railRef.current.scrollLeft = dragRef.current.scrollLeft - dx * 1.15;
      }
    };

    const handleMouseUp = () => {
      if (!dragRef.current.isDown) return;
      dragRef.current.isDown = false;
      setIsDragging(false);
      // Limpa a flag logo após o evento click para não bloquear o próximo clique legítimo
      setTimeout(() => {
        dragRef.current.moved = false;
      }, 40);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!items || items.length === 0) return null;

  const handleMouseDown = (e) => {
    if (e.button !== 0 || !railRef.current) return;
    dragRef.current = {
      isDown: true,
      startX: e.pageX,
      scrollLeft: railRef.current.scrollLeft,
      moved: false,
    };
  };

  const scrollByStep = (dir) => {
    const el = railRef.current;
    if (!el) return;
    const distance = Math.max(320, Math.round(el.clientWidth * 0.72));
    el.scrollBy({ left: dir * distance, behavior: 'smooth' });
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight leading-none select-none bg-gradient-to-b from-white via-white/90 to-white/55 bg-clip-text text-transparent">
            TOP 10
          </span>
          <h2 className="text-xl sm:text-2xl font-semibold text-white/90">{title}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            disabled={!canLeft}
            aria-label={`Anterior em ${title}`}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.15] border border-white/[0.1] text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByStep(1)}
            disabled={!canRight}
            aria-label={`Próximo em ${title}`}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.15] border border-white/[0.1] text-white flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        {canLeft && (
          <div className="hidden sm:block absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#09090B] to-transparent z-30 pointer-events-none" />
        )}
        {canRight && (
          <div className="hidden sm:block absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#09090B] to-transparent z-30 pointer-events-none" />
        )}

        <div
          ref={railRef}
          onMouseDown={handleMouseDown}
          onScroll={updateScrollEdges}
          className={`flex overflow-x-auto overflow-y-hidden gap-6 sm:gap-7 py-5 pr-4 hide-scrollbar select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {items.slice(0, 10).map((item, idx) => {
            const rank = idx + 1;
            const mType = item.media_type || mediaType;
            const target = mType === 'movie' ? `/filme/${item.id}` : `/serie/${item.id}`;
            return (
              <Link
                key={`${mType}-${item.id}`}
                to={target}
                state={{ heroPrefill: item }}
                draggable={false}
                onClick={(e) => {
                  if (dragRef.current.moved) {
                    e.preventDefault();
                  }
                }}
                className="group flex-shrink-0 flex items-end gap-1.5"
              >
                <Top10RankNumber rank={rank} />

                <div className="relative z-20 w-[138px] sm:w-[158px] aspect-[2/3] rounded-2xl overflow-hidden bg-[#121216] border border-white/[0.1] shadow-xl shadow-black/60 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-white/35">
                  {item.poster_path ? (
                    <img
                      src={getPosterUrl(item.poster_path)}
                      alt={item.displayTitle}
                      draggable={false}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/25">
                      <Film className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                    <span className="text-[11px] font-medium text-white line-clamp-2 leading-tight">
                      {item.displayTitle}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * Banner Cinematográfico Rotativo (adaptado de "Latest and Trending" para a estética studio)
 */
function CuratedSpotlightBanner({ items, onWatchTrailer }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!items || items.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((curr) => (curr + 1) % items.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [items]);

  if (!items || items.length === 0) return null;

  const safeIdx = idx < items.length ? idx : 0;
  const current = items[safeIdx];
  const target =
    current.media_type === 'movie' ? `/filme/${current.id}` : `/serie/${current.id}`;
  const genres = (current.genre_ids || [])
    .slice(0, 3)
    .map((id) => GENRE_LABELS[id])
    .filter(Boolean);

  return (
    <section>
      <SectionHeader
        title="Destaque da Curadoria"
        subtitle="Seleção renovada de filmes e séries que valem a sua sessão"
        linkTo="/explorar?tipo=all&sort=popularity.desc"
      />

      <div className="relative rounded-3xl overflow-hidden bg-[#111115] border border-white/[0.09] shadow-2xl shadow-black/60 h-[370px] sm:h-[420px] group">
        {current.backdrop_path && (
          <img
            key={`spot-${current.media_type}-${current.id}`}
            src={getBackdropUrl(current.backdrop_path, 'w1280')}
            alt={current.displayTitle}
            className="absolute inset-0 w-full h-full object-cover object-center sm:object-top transition-transform duration-700 group-hover:scale-[1.03] animate-fade-in"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-[#09090B]/95 via-[#09090B]/65 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B]/90 via-transparent to-black/25" />

        <div className="relative z-10 h-full p-6 sm:p-10 lg:p-12 flex flex-col justify-between max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.1] backdrop-blur-md border border-white/[0.16] text-[11px] font-semibold uppercase tracking-wider text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FE3131]" />
              {current.media_type === 'movie' ? 'Filme' : 'Série'}
            </span>
            {current.displayYear && (
              <span className="px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-xs text-white/75">
                {current.displayYear}
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/45 backdrop-blur-md border border-white/10 text-xs font-semibold text-amber-400">
              <Star className="w-3 h-3 fill-amber-400" />
              {current.displayRating}
            </span>
            {genres.slice(0, 2).map((g) => (
              <span
                key={g}
                className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-white/[0.06] text-[11px] text-white/70"
              >
                {g}
              </span>
            ))}
          </div>

          <div key={`spot-copy-${current.id}`} className="animate-fade-in">
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.06] line-clamp-2">
              {current.displayTitle}
            </h3>
            {current.overview && (
              <p className="text-xs sm:text-sm text-white/65 line-clamp-2 mt-3 max-w-xl leading-relaxed">
                {current.overview}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Link
                to={target}
                state={{ heroPrefill: current }}
                className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                Ver Detalhes
              </Link>
              <button
                type="button"
                onClick={() => onWatchTrailer(current)}
                className="inline-flex items-center gap-2 bg-white/[0.1] hover:bg-white/[0.18] backdrop-blur-xl border border-white/[0.18] text-white font-medium text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all"
              >
                Assistir Trailer
              </button>
            </div>
          </div>
        </div>

        {/* Controles do carrossel do banner */}
        {items.length > 1 && (
          <div className="absolute right-6 bottom-6 z-20 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {items.map((item, i) => (
                <button
                  key={`spot-dot-${item.id}`}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Destaque ${i + 1}: ${item.displayTitle}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === safeIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIdx((safeIdx - 1 + items.length) % items.length)}
                aria-label="Destaque anterior"
                className="w-8 h-8 rounded-full bg-black/45 hover:bg-white text-white hover:text-[#09090B] border border-white/15 flex items-center justify-center transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIdx((safeIdx + 1) % items.length)}
                aria-label="Próximo destaque"
                className="w-8 h-8 rounded-full bg-black/45 hover:bg-white text-white hover:text-[#09090B] border border-white/15 flex items-center justify-center transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Banner interativo "O que você achou?" + Roleta Surpreenda-me
 */
function QuickRateAndSurpriseBanner({ pool, onOpenSurprise, showToast }) {
  const [index, setIndex] = useState(0);
  const [savedRating, setSavedRating] = useState(null);

  const item = pool && pool.length > 0 ? pool[index % pool.length] : null;
  const existing = item ? getUserReview(item.id, item.media_type) : null;
  const activeRating = savedRating?.id === item?.id ? savedRating.rating : existing?.rating || null;

  const handleRate = (ratingValue, label) => {
    if (!item) return;
    saveUserReview(item.id, item.media_type, { rating: ratingValue });
    setSavedRating({ id: item.id, rating: ratingValue });
    showToast(`Você avaliou "${item.displayTitle}" como ${label}`, 'info');
  };

  const handleNext = () => {
    setSavedRating(null);
    setIndex((i) => i + 1);
  };

  const target = item
    ? item.media_type === 'movie'
      ? `/filme/${item.id}`
      : `/serie/${item.id}`
    : '/explorar';

  const options = [
    { value: 5, label: 'Incrível', icon: Sparkles },
    { value: 4, label: 'Muito bom', icon: ThumbsUp },
    { value: 3, label: 'Mediano', icon: Meh },
  ];

  return (
    <section className="relative rounded-3xl overflow-hidden bg-[#111115] border border-white/[0.09] shadow-2xl shadow-black/60">
      {item?.backdrop_path && (
        <img
          src={getBackdropUrl(item.backdrop_path, 'w1280')}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-25 blur-[2px] scale-105 pointer-events-none"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090B]/95 via-[#09090B]/80 to-[#09090B]/90 pointer-events-none" />

      <div className="relative z-10 p-6 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
        {item ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 flex-1 min-w-0">
            <Link
              to={target}
              state={{ heroPrefill: item }}
              className="w-24 sm:w-28 aspect-[2/3] rounded-2xl overflow-hidden bg-white/5 border border-white/15 shadow-2xl flex-shrink-0 group"
            >
              {item.poster_path && (
                <img
                  src={getPosterUrl(item.poster_path, 'w342')}
                  alt={item.displayTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                  Sua opinião no studio
                </span>
                {pool.length > 1 && (
                  <button
                    type="button"
                    onClick={handleNext}
                    title="Trocar título"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-white/55 hover:text-white px-2 py-0.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Outro
                  </button>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
                O que você achou de{' '}
                <Link
                  to={target}
                  state={{ heroPrefill: item }}
                  className="underline decoration-white/25 hover:decoration-white underline-offset-4 transition-colors"
                >
                  {item.displayTitle}
                </Link>
                ?
              </h2>

              <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-white/55">
                {item.displayYear && <span>{item.displayYear}</span>}
                <span>•</span>
                <StarRow voteAverage={item.vote_average} />
                <span className="text-white/75 font-semibold">{item.displayRating}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 mt-5">
                {options.map((opt) => {
                  const Icon = opt.icon;
                  const selected = activeRating === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleRate(opt.value, opt.label)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
                        selected
                          ? 'bg-white text-[#09090B] border-white font-semibold shadow-lg'
                          : 'bg-white/[0.06] hover:bg-white/[0.14] text-white/85 border-white/[0.12]'
                      }`}
                    >
                      {selected ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* Separador + Atalho rápido para a Roleta Surpreenda-me */}
        <div className="w-full lg:w-auto lg:pl-8 lg:border-l border-white/10 flex flex-col items-start gap-3 flex-shrink-0">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
            Indeciso hoje?
          </span>
          <p className="text-xs text-white/55 max-w-[220px]">
            Deixe a roleta escolher um título aclamado no seu clima.
          </p>
          <button
            type="button"
            onClick={onOpenSurprise}
            className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-all"
          >
            <Dices className="w-4 h-4" />
            Sortear Agora
          </button>
        </div>
      </div>
    </section>
  );
}

const HOME_CACHE_TTL_MS = 5 * 60 * 1000;
const homeCache = {
  timestamp: 0,
  heroItems: [],
  trendingGrid: [],
  spotlightItems: [],
  awardMovies: [],
  top10Movies: [],
  top10Series: [],
  people: [],
  ratePool: [],
  categoryPool: [],
  currentHeroIndex: 0,
  scrollY: 0,
};

const hasFreshHomeCache = () =>
  homeCache.heroItems.length > 0 &&
  Date.now() - homeCache.timestamp < HOME_CACHE_TTL_MS;

export default function Home({ onOpenSurprise }) {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const cachedReady = hasFreshHomeCache();

  const [heroItems, setHeroItems] = useState(() =>
    cachedReady ? homeCache.heroItems : []
  );
  const [trendingGrid, setTrendingGrid] = useState(() =>
    cachedReady ? homeCache.trendingGrid : []
  );
  const [spotlightItems, setSpotlightItems] = useState(() =>
    cachedReady ? homeCache.spotlightItems : []
  );
  const [awardMovies, setAwardMovies] = useState(() =>
    cachedReady ? homeCache.awardMovies : []
  );
  const [top10Movies, setTop10Movies] = useState(() =>
    cachedReady ? homeCache.top10Movies : []
  );
  const [top10Series, setTop10Series] = useState(() =>
    cachedReady ? homeCache.top10Series : []
  );
  const [people, setPeople] = useState(() =>
    cachedReady ? homeCache.people : []
  );
  const [ratePool, setRatePool] = useState(() =>
    cachedReady ? homeCache.ratePool : []
  );
  const [categoryPool, setCategoryPool] = useState(() =>
    cachedReady ? homeCache.categoryPool : []
  );

  const [currentHeroIndex, setCurrentHeroIndex] = useState(() =>
    cachedReady ? homeCache.currentHeroIndex : 0
  );
  const [prevHeroIndex, setPrevHeroIndex] = useState(() =>
    cachedReady ? homeCache.currentHeroIndex : 0
  );
  const [slideTick, setSlideTick] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [loading, setLoading] = useState(!cachedReady);
  const [mountedTrailerIndices, setMountedTrailerIndices] = useState(() => [
    cachedReady ? homeCache.currentHeroIndex : 0,
  ]);
  const [prebufferStep, setPrebufferStep] = useState(0);

  const navTokenRef = useRef(0);
  const currentHeroIndexRef = useRef(currentHeroIndex);
  useEffect(() => {
    currentHeroIndexRef.current = currentHeroIndex;
  }, [currentHeroIndex]);

  const [, setFavVersion] = useState(0);
  const [heroTrailerExpanded, setHeroTrailerExpanded] = useState(false);
  const [trailerItem, setTrailerItem] = useState(null);

  const openTrailer = (item) => setTrailerItem(item);
  const closeTrailer = () => setTrailerItem(null);

  useEffect(() => {
    const sync = () => setFavVersion((v) => v + 1);
    window.addEventListener('bhflix:favorites-updated', sync);
    return () => window.removeEventListener('bhflix:favorites-updated', sync);
  }, []);

  useEffect(() => {
    if (hasFreshHomeCache() && homeCache.scrollY > 0) {
      window.scrollTo(0, homeCache.scrollY);
    }

    const handleScroll = () => {
      homeCache.scrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    homeCache.currentHeroIndex = currentHeroIndex;
  }, [currentHeroIndex]);

  useEffect(() => {
    if (hasFreshHomeCache()) return;

    let cancelled = false;
    const loadData = async () => {
      setLoading(true);

      // Páginas secundárias variadas para manter o catálogo vivo a cada nova carga
      const altPage = Math.random() < 0.5 ? 2 : 3;
      const topRatedPage = Math.floor(Math.random() * 3) + 1;

      const [
        heroData,
        trendingP1,
        trendingAlt,
        popMovP1,
        popMovAlt,
        nowMov,
        topRatedMov,
        popTvP1,
        popTvAlt,
        newTv,
        peopleData,
      ] = await Promise.all([
        getHeroShowcase(),
        getTrending('all', 1),
        getTrending('all', altPage),
        getPopularMovies(1),
        getPopularMovies(altPage),
        getNowPlayingMovies(1),
        getTopRatedMovies(topRatedPage),
        getPopularSeries(1),
        getPopularSeries(altPage),
        getNewSeries(1),
        getPopularPeople(1),
      ]);

      if (cancelled) return;

      const prevShown = readPrevShownIds();

      // Rotaciona levemente a ordem da Hero para trazer variedade sem perder qualidade
      const freshHero = heroData.length > 1 ? shuffleArray(heroData) : heroData;

      // Bloqueia QUALQUER título da Hero de aparecer nas seções abaixo
      const heroIdSet = new Set(freshHero.map(getItemKey));
      const editorialUsed = new Set(heroIdSet);

      // 1. Em Alta no studio (8 cards — 4 colunas x 2 linhas ou 4 em destaque, sem repetir Hero)
      const pickedTrending = smartPick(
        [...trendingP1, ...nowMov, ...trendingAlt, ...newTv],
        4,
        editorialUsed,
        prevShown,
        { requireBackdrop: true }
      );

      // 2. Destaque da Curadoria (3 slides no banner largo, priorizando nota >= 6.5 e sem repetir)
      const spotlightCandidates = [...nowMov, ...trendingP1, ...trendingAlt, ...popMovAlt, ...popTvAlt];
      const wellRatedSpotlight = spotlightCandidates.filter((i) => Number(i?.vote_average) >= 6.5);
      const pickedSpotlight = smartPick(
        wellRatedSpotlight.length >= 3 ? wellRatedSpotlight : spotlightCandidates,
        3,
        editorialUsed,
        prevShown,
        { requireBackdrop: true }
      );

      // 3. Aclamados pela Crítica (estritamente obras 8.0+ com base sólida de votos, sem misturar populares genéricos)
      const strictAcclaimed = topRatedMov.filter(
        (m) => Number(m?.vote_average) >= 8.0 && Number(m?.vote_count || 0) >= 300
      );
      const fallbackAcclaimed = topRatedMov.filter((m) => Number(m?.vote_average) >= 7.8);
      const pickedAwards = smartPick(
        strictAcclaimed.length >= 4 ? strictAcclaimed : fallbackAcclaimed,
        4,
        editorialUsed,
        prevShown,
        { requireBackdrop: true }
      ).sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0));

      // 4. TOP 10 Filmes Hoje (excluindo Hero para não repetir o topo!)
      const movieRankExcluded = new Set(heroIdSet);
      const pickedTop10Movies = smartPick(
        [...popMovP1, ...nowMov, ...popMovAlt],
        10,
        movieRankExcluded,
        new Set(),
        { trackInExcluded: true }
      );

      // 5. TOP 10 Séries Hoje (excluindo Hero para não repetir o topo!)
      const tvRankExcluded = new Set(heroIdSet);
      const pickedTop10Series = smartPick(
        [...popTvP1, ...newTv, ...popTvAlt],
        10,
        tvRankExcluded,
        new Set(),
        { trackInExcluded: true }
      );

      // 6. Estrelas em Destaque (embaralha sutilmente os 12 primeiros para renovar o grid)
      const pickedPeople = shuffleArray(peopleData.slice(0, 12)).slice(0, 6);

      // 7. Pool do banner interativo "O que você achou?"
      const pickedRatePool = smartPick(
        [...topRatedMov, ...popMovP1, ...popTvP1, ...trendingAlt],
        8,
        new Set(heroIdSet),
        prevShown,
        { requireBackdrop: true }
      );

      // 8. Pool de cenas reais para as Categorias de Filmes (priorizando filmes fora da Hero)
      const catPool = [...popMovP1, ...nowMov, ...topRatedMov, ...popMovAlt, ...popTvP1, ...newTv]
        .filter((i) => !heroIdSet.has(getItemKey(i)));

      // Registra IDs exibidos agora para privilegiar inéditos no próximo F5
      const nextShown = new Set([
        ...pickedTrending.map(getItemKey),
        ...pickedSpotlight.map(getItemKey),
        ...pickedAwards.map(getItemKey),
        ...pickedRatePool.slice(0, 2).map(getItemKey),
      ]);
      writePrevShownIds(nextShown);

      homeCache.timestamp = Date.now();
      homeCache.heroItems = freshHero;
      homeCache.trendingGrid = pickedTrending;
      homeCache.spotlightItems = pickedSpotlight;
      homeCache.awardMovies = pickedAwards;
      homeCache.top10Movies = pickedTop10Movies;
      homeCache.top10Series = pickedTop10Series;
      homeCache.people = pickedPeople;
      homeCache.ratePool = pickedRatePool;
      homeCache.categoryPool = catPool;
      homeCache.currentHeroIndex = 0;

      setHeroItems(freshHero);
      setTrendingGrid(pickedTrending);
      setSpotlightItems(pickedSpotlight);
      setAwardMovies(pickedAwards);
      setTop10Movies(pickedTop10Movies);
      setTop10Series(pickedTop10Series);
      setPeople(pickedPeople);
      setRatePool(pickedRatePool);
      setCategoryPool(catPool);
      setCurrentHeroIndex(0);
      setPrevHeroIndex(0);
      setLoading(false);
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pré-carrega e decodifica na GPU todos os backdrops (w1280), capas de preview e pôsteres da Hero
  useEffect(() => {
    if (!heroItems.length) return;
    heroItems.forEach((item) => {
      if (item.backdrop_path) preloadImage(getBackdropUrl(item.backdrop_path, 'w1280'));
      if (item.preview_backdrop_path) {
        preloadImage(getBackdropUrl(item.preview_backdrop_path, 'w780'));
      }
      if (item.poster_path) preloadImage(getPosterUrl(item.poster_path, 'w185'));
    });
  }, [heroItems]);

  const handleTrailerPrebufferReady = useCallback(() => {
    setPrebufferStep((s) => s + 1);
  }, []);

  // Fila escalonada (1 por vez): aquece ~3.6s de cada trailer da Hero em standby e pausa em RAM
  useEffect(() => {
    const total = heroItems.length;
    if (total <= 1 || mountedTrailerIndices.length >= total || heroTrailerExpanded) return;

    const findNextToWarm = () => {
      for (let offset = 1; offset < total; offset += 1) {
        const candidate = (currentHeroIndex + offset) % total;
        if (!mountedTrailerIndices.includes(candidate)) return candidate;
      }
      return -1;
    };

    const nextIdx = findNextToWarm();
    if (nextIdx === -1) return;

    // Se o passo avançou via onPrebufferReady, aquece o próximo rapidamente; senão usa fallback gentil
    const delayMs = prebufferStep > 0 ? 550 : 2200;
    const timer = setTimeout(() => {
      setMountedTrailerIndices((prev) =>
        prev.includes(nextIdx) ? prev : [...prev, nextIdx]
      );
    }, delayMs);

    return () => clearTimeout(timer);
  }, [heroItems.length, currentHeroIndex, mountedTrailerIndices, prebufferStep, heroTrailerExpanded]);

  // Troca de slide atômica: aguarda decodificação do backdrop w1280 antes de sincronizar fundo + texto + trailer
  const goToSlide = useCallback(
    async (nextIndex) => {
      if (heroItems.length <= 1) return;
      const wrapped = (nextIndex + heroItems.length) % heroItems.length;
      if (wrapped === currentHeroIndexRef.current) return;

      const token = ++navTokenRef.current;
      const nextItem = heroItems[wrapped];

      // Garante que o iframe desse slide já entre no pool imediatamente caso ainda não estivesse
      setMountedTrailerIndices((prev) => (prev.includes(wrapped) ? prev : [...prev, wrapped]));

      const nextBackdropUrl = nextItem?.backdrop_path
        ? getBackdropUrl(nextItem.backdrop_path, 'w1280')
        : null;
      if (nextBackdropUrl) {
        await ensureImageDecoded(nextBackdropUrl, 450);
      }

      if (token !== navTokenRef.current) return;

      const prevIdx = currentHeroIndexRef.current;
      if (wrapped === prevIdx) return;

      setPrevHeroIndex(prevIdx);
      setCurrentHeroIndex(wrapped);
      setSlideTick((t) => t + 1);
    },
    [heroItems]
  );

  useEffect(() => {
    if (heroItems.length <= 1 || isHovered || heroTrailerExpanded || trailerItem) return;
    const interval = setInterval(() => {
      goToSlide(currentHeroIndexRef.current + 1);
    }, 9000);
    return () => clearInterval(interval);
  }, [heroItems.length, isHovered, heroTrailerExpanded, trailerItem, goToSlide]);

  const handleToggleItemFav = (item) => {
    if (!item) return;
    const added = toggleFavorite({
      id: item.id,
      title: item.displayTitle,
      image: getPosterUrl(item.poster_path) || '',
      rating: item.displayRating,
      year: item.displayYear,
      mediaType: item.media_type,
    });
    showToast(
      added
        ? `"${item.displayTitle}" salvo na Minha Lista`
        : `"${item.displayTitle}" removido da Minha Lista`,
      'heart'
    );
  };

  const categoryItems = useMemo(() => {
    const seen = new Set();
    const pool = [];
    for (const item of categoryPool) {
      const path = item?.backdrop_path || item?.poster_path;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      pool.push(item);
    }

    const used = new Set();
    const isAvailable = (m) => !used.has(m.backdrop_path || m.poster_path);

    return MOVIE_CATEGORIES.map((cat) => {
      // 1) Filme com backdrop e gênero exato; 2) Qualquer mídia com backdrop e matchIds; 3) Fallback sem duplicar
      const match =
        pool.find(
          (m) =>
            isAvailable(m) &&
            m.backdrop_path &&
            m.media_type === 'movie' &&
            (m.genre_ids || []).includes(cat.id)
        ) ||
        pool.find(
          (m) =>
            isAvailable(m) &&
            m.backdrop_path &&
            (m.genre_ids || []).some((gid) => cat.matchIds.includes(gid))
        ) ||
        pool.find((m) => isAvailable(m) && m.backdrop_path) ||
        pool.find((m) => isAvailable(m));

      const chosenPath = match?.backdrop_path || match?.poster_path || '';
      if (chosenPath) used.add(chosenPath);

      return {
        id: cat.id,
        label: cat.label,
        image: match?.backdrop_path
          ? getBackdropUrl(match.backdrop_path, 'w780')
          : match?.poster_path
            ? getPosterUrl(match.poster_path, 'w500')
            : '',
        link: `/explorar?tipo=movie&genero=${cat.id}`,
      };
    });
  }, [categoryPool]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#09090B] pb-20">
        <HeroSkeleton />
        <div className="container mx-auto px-5 sm:px-8 lg:px-14 mt-14">
          <CardGridSkeleton count={8} cols="grid-cols-2 sm:grid-cols-4" />
        </div>
      </main>
    );
  }

  const activeHero = heroItems[currentHeroIndex] || null;
  const prevHero = heroItems[prevHeroIndex] || activeHero;

  const activeGenres = activeHero?.genres?.length
    ? activeHero.genres.map((g) => g.name).slice(0, 3)
    : (activeHero?.genre_ids || [])
        .slice(0, 3)
        .map((id) => GENRE_LABELS[id])
        .filter(Boolean);

  const isHeroFav = activeHero
    ? isFavorite(activeHero.id, activeHero.media_type)
    : false;

  const heroMetaSecondLabel =
    activeHero?.media_type === 'movie' ? 'Duração' : 'Total';
  const heroMetaSecondValue =
    activeHero?.media_type === 'movie'
      ? formatRuntimeShort(activeHero?.runtime) || 'Longa-metragem'
      : activeHero?.number_of_episodes
        ? `${activeHero.number_of_episodes} Episódios`
        : activeHero?.number_of_seasons
          ? `${activeHero.number_of_seasons} Temporadas`
          : 'Série';

  return (
    <main className="min-h-screen bg-[#09090B] pb-16 overflow-x-hidden">
      {/* ================================================================ */}
      {/* HERO MINIMALISTA CONFORTÁVEL (INTACTA — ESTILO MON 2 TEMPOS)     */}
      {/* ================================================================ */}
      {activeHero && (
        <section
          onClick={() =>
            navigate(
              activeHero.media_type === 'movie'
                ? `/filme/${activeHero.id}`
                : `/serie/${activeHero.id}`,
              { state: { heroPrefill: activeHero } }
            )
          }
          className="relative w-full h-[94vh] min-h-[620px] max-h-[960px] flex flex-col justify-between overflow-hidden pt-24 pb-8 sm:pb-10 group/hero cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {prevHero && (
            <div className="absolute inset-0 z-0 pointer-events-none">
              <img
                src={getBackdropUrl(prevHero.backdrop_path, 'w1280')}
                alt=""
                decoding="sync"
                className="w-full h-full object-cover object-center md:object-top"
              />
            </div>
          )}

          <div
            key={`backdrop-${activeHero.media_type}-${activeHero.id}-${slideTick}`}
            className={`absolute inset-0 z-[1] pointer-events-none ${
              slideTick > 0 ? 'animate-mon-backdrop' : ''
            }`}
          >
            <img
              src={getBackdropUrl(activeHero.backdrop_path, 'w1280')}
              alt={activeHero.displayTitle}
              decoding="sync"
              fetchPriority="high"
              className="w-full h-full object-cover object-center md:object-top"
            />
          </div>

          <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
          <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-t from-[#09090B] via-black/10 to-black/30" />

          {heroItems.length > 1 && !heroTrailerExpanded && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(currentHeroIndex - 1);
                }}
                aria-label="Destaque anterior"
                className="hidden lg:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/30 hover:bg-black/60 backdrop-blur-md border border-white/10 items-center justify-center text-white/70 hover:text-white opacity-0 group-hover/hero:opacity-100 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToSlide(currentHeroIndex + 1);
                }}
                aria-label="Próximo destaque"
                className="hidden lg:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/30 hover:bg-black/60 backdrop-blur-md border border-white/10 items-center justify-center text-white/70 hover:text-white opacity-0 group-hover/hero:opacity-100 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* BLOCO CENTRAL-ESQUERDO */}
          <div
            key={`info-${activeHero.media_type}-${activeHero.id}-${slideTick}`}
            className="relative z-10 container mx-auto px-5 sm:px-8 lg:px-14 my-auto"
          >
            <div className="animate-mon-text-1 flex flex-wrap items-center gap-1.5 mb-3.5">
              {activeGenres.length > 0 ? (
                activeGenres.map((genreName) => (
                  <span
                    key={genreName}
                    className="px-2.5 py-0.5 rounded bg-white/[0.14] backdrop-blur-md text-[11px] font-medium text-white/90"
                  >
                    {genreName}
                  </span>
                ))
              ) : (
                <span className="px-2.5 py-0.5 rounded bg-white/[0.14] backdrop-blur-md text-[11px] font-medium text-white/90">
                  {activeHero.media_type === 'movie' ? 'Filme' : 'Série'}
                </span>
              )}
            </div>

            <h1 className="animate-mon-text-2 text-4xl sm:text-5xl lg:text-[60px] font-bold tracking-tight text-white leading-[1.04] max-w-2xl drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] mb-4">
              {activeHero.displayTitle}
            </h1>

            <div className="animate-mon-text-3 flex flex-wrap items-center gap-3 mb-7">
              <span className="inline-flex items-center gap-1.5">
                <span className="bg-amber-400 text-[#09090B] font-extrabold text-[10px] tracking-wider px-1.5 py-0.5 rounded">
                  TMDB
                </span>
                <span className="text-sm font-semibold text-white">
                  {activeHero.displayRating}
                </span>
              </span>

              {activeHero.primary_provider && (() => {
                const pMeta = resolvePlatformMeta(
                  activeHero.primary_provider,
                  activeHero.displayTitle
                );
                return (
                  <a
                    href={pMeta.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-2 pl-2 border-l border-white/20 hover:opacity-85 transition-opacity"
                  >
                    <img
                      src={`${IMAGE_BASE}/w92${activeHero.primary_provider.logo_path}`}
                      alt={pMeta.name}
                      className="w-6 h-6 rounded-md object-cover shadow"
                    />
                    <span className="text-xs font-medium text-white/90">
                      {pMeta.name}
                    </span>
                  </a>
                );
              })()}
            </div>

            <div className="animate-mon-text-4 flex items-center gap-4">
              <Link
                to={
                  activeHero.media_type === 'movie'
                    ? `/filme/${activeHero.id}`
                    : `/serie/${activeHero.id}`
                }
                state={{ heroPrefill: activeHero }}
                onClick={(e) => e.stopPropagation()}
                className="group inline-flex items-center gap-3.5 text-sm font-medium text-white/95 hover:text-white transition-colors"
              >
                <span className="w-11 h-11 rounded-xl bg-white group-hover:scale-105 text-[#09090B] flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-transform">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </span>
                <span>Ver Detalhes</span>
              </Link>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleItemFav(activeHero);
                }}
                aria-label={isHeroFav ? 'Remover da Minha Lista' : 'Salvar na Minha Lista'}
                className={`w-11 h-11 rounded-xl backdrop-blur-xl border flex items-center justify-center transition-all ${
                  isHeroFav
                    ? 'bg-white text-[#09090B] border-white'
                    : 'bg-white/[0.1] hover:bg-white/[0.18] border-white/[0.16] text-white/85'
                }`}
              >
                <Heart className={`w-4 h-4 ${isHeroFav ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {/* RODAPÉ EQUILIBRADO EM 3 ZONAS */}
          <div
            className={`relative container mx-auto px-5 sm:px-8 lg:px-14 flex items-end justify-between gap-4 ${
              heroTrailerExpanded ? 'z-[90]' : 'z-10'
            }`}
          >
            <Link
              key={`mini-${activeHero.media_type}-${activeHero.id}-${slideTick}`}
              to={
                activeHero.media_type === 'movie'
                  ? `/filme/${activeHero.id}`
                  : `/serie/${activeHero.id}`
              }
              state={{ heroPrefill: activeHero }}
              onClick={(e) => e.stopPropagation()}
              className="animate-mon-text-3 flex items-center gap-3.5 group"
            >
              <div className="w-11 h-16 sm:w-12 sm:h-[68px] rounded-lg overflow-hidden bg-white/10 border border-white/15 shadow-2xl flex-shrink-0">
                <img
                  src={getPosterUrl(activeHero.poster_path, 'w185')}
                  alt={activeHero.displayTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="hidden xs:flex sm:flex items-center gap-5 text-xs">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-white/45 mb-0.5">
                    Lançamento
                  </span>
                  <span className="font-medium text-white/90">
                    {formatMonthYear(activeHero.release_date || activeHero.first_air_date)}
                  </span>
                </div>
                <div className="hidden md:block">
                  <span className="block text-[10px] uppercase tracking-wider text-white/45 mb-0.5">
                    {heroMetaSecondLabel}
                  </span>
                  <span className="font-medium text-white/90">{heroMetaSecondValue}</span>
                </div>
              </div>
            </Link>

            {heroItems.length > 1 && (
              <div
                className="flex items-center gap-2 pb-2"
                onClick={(e) => e.stopPropagation()}
              >
                {heroItems.map((item, idx) => (
                  <button
                    key={`${item.id}-dot`}
                    type="button"
                    onClick={() => goToSlide(idx)}
                    aria-label={`Destaque ${idx + 1}: ${item.displayTitle}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentHeroIndex
                        ? 'w-6 bg-white'
                        : 'w-1.5 bg-white/35 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Pool persistente de trailers da Hero: pré-carregados e mantidos em RAM sem re-requisitar */}
            <div className="relative isolate w-52 sm:w-72 lg:w-[310px] aspect-[16/10] flex-shrink-0">
              {heroItems.map((item, idx) => {
                const isSlideActive = idx === currentHeroIndex;
                const isMountedInPool = isSlideActive || mountedTrailerIndices.includes(idx);

                return (
                  <div
                    key={`hero-trailer-${item.media_type}-${item.id}`}
                    className={`absolute inset-0 transition-opacity duration-500 ${
                      isSlideActive
                        ? 'opacity-100 z-20 pointer-events-auto'
                        : 'opacity-0 z-0 pointer-events-none'
                    }`}
                    aria-hidden={!isSlideActive}
                  >
                    <TrailerPreviewCard
                      mediaId={item.id}
                      mediaType={item.media_type}
                      title={item.displayTitle}
                      backdropPath={item.backdrop_path}
                      previewImagePath={item.preview_backdrop_path || null}
                      avoidSameAsHero
                      initialTrailerKey={item.trailer_key}
                      paused={Boolean(trailerItem)}
                      isActive={isSlideActive}
                      shouldMountIframe={isMountedInPool}
                      preloadSeconds={3.6}
                      onPrebufferReady={handleTrailerPrebufferReady}
                      onExpandChange={setHeroTrailerExpanded}
                      className="w-full h-full"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* LAYOUT EDITORIAL VIVO ABAIXO DA HERO (ESTÉTICA STUDIO)           */}
      {/* ================================================================ */}
      <div className="container mx-auto px-5 sm:px-8 lg:px-14 mt-14 space-y-20">
        {/* 1. FILMES POR CATEGORIA (GRID EDITORIAL 4x2 MINIMALISTA) */}
        <section>
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Filmes
            </h2>
            <Link
              to="/explorar?tipo=movie"
              className="text-xs sm:text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Ver tudo
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {categoryItems.map((cat) => (
              <Link
                key={cat.id}
                to={cat.link}
                className="group relative aspect-[16/10] rounded-2xl overflow-hidden bg-[#111115] border border-white/[0.07] hover:border-white/25 transition-all duration-300 shadow-lg shadow-black/50"
              >
                {cat.image && (
                  <img
                    src={cat.image}
                    alt={cat.label}
                    loading="lazy"
                    className="w-full h-full object-cover object-center brightness-[0.58] saturate-[0.82] group-hover:brightness-[0.78] group-hover:saturate-100 group-hover:scale-105 transition-all duration-500"
                  />
                )}

                {/* Vinheta escura editorial que funde as bordas com o fundo escuro e destaca o título */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/75 group-hover:from-black/35 group-hover:via-black/15 group-hover:to-black/65 transition-colors duration-300" />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at center, rgba(9,9,11,0.12) 0%, rgba(9,9,11,0.68) 100%)',
                  }}
                />

                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <span className="font-display text-base sm:text-lg font-semibold tracking-tight text-white/95 group-hover:text-white group-hover:scale-105 drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)] transition-all duration-300 text-center">
                    {cat.label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 2. EM ALTA NO STUDIO (GRID 4 COLUNAS COM PLAY RÁPIDO DE TRAILER) */}
        {trendingGrid.length > 0 && (
          <section>
            <SectionHeader
              title="Em Alta no studio"
              subtitle="Novidades quentes em filmes e séries — sempre renovadas"
              linkTo="/explorar?tipo=all&sort=popularity.desc"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {trendingGrid.map((item) => {
                const target =
                  item.media_type === 'movie' ? `/filme/${item.id}` : `/serie/${item.id}`;
                const primaryGenre = (item.genre_ids || [])
                  .map((id) => GENRE_LABELS[id])
                  .find(Boolean);

                return (
                  <div
                    key={getItemKey(item)}
                    className="group relative rounded-2xl overflow-hidden bg-[#111115] border border-white/[0.08] hover:border-white/25 transition-all duration-300 hover:-translate-y-1 shadow-xl shadow-black/50"
                  >
                    <Link
                      to={target}
                      state={{ heroPrefill: item }}
                      className="block relative aspect-[16/10] overflow-hidden"
                    >
                      <img
                        src={getBackdropUrl(item.backdrop_path, 'w780')}
                        alt={item.displayTitle}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#111115] via-black/20 to-transparent" />

                      <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-[10px] font-semibold uppercase tracking-wider text-white/90">
                        {item.media_type === 'movie' ? 'Filme' : 'Série'}
                      </span>

                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-amber-400">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {item.displayRating}
                      </span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => openTrailer(item)}
                      aria-label={`Assistir trailer de ${item.displayTitle}`}
                      title="Assistir trailer"
                      className="absolute right-3.5 top-[42%] -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-[#09090B] flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition-all duration-300 z-10"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </button>

                    <div className="p-4 flex items-start justify-between gap-2">
                      <Link
                        to={target}
                        state={{ heroPrefill: item }}
                        className="min-w-0 flex-1"
                      >
                        <h3 className="text-base font-semibold text-white truncate group-hover:text-white/85 transition-colors">
                          {item.displayTitle}
                        </h3>
                        <p className="text-xs text-white/45 mt-0.5 truncate">
                          {[item.displayYear, primaryGenre].filter(Boolean).join(' • ')}
                        </p>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleToggleItemFav(item)}
                        aria-label="Salvar na Minha Lista"
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          isFavorite(item.id, item.media_type)
                            ? 'bg-white text-[#09090B]'
                            : 'bg-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.14]'
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            isFavorite(item.id, item.media_type) ? 'fill-current' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. TOP 10 FILMES HOJE (NÚMEROS CORRIGIDOS + SEM SCROLL VERTICAL INTERNO) */}
        <Top10Rail
          title="Filmes Hoje"
          items={top10Movies}
          mediaType="movie"
        />

        {/* 4. DESTAQUE DA CURADORIA (BANNER CINEMATOGRÁFICO LARGO ROTATIVO) */}
        <CuratedSpotlightBanner
          items={spotlightItems}
          onWatchTrailer={openTrailer}
        />

        {/* 5. ACLAMADOS PELA CRÍTICA (GRID 4 COLUNAS COM ESTRELAS ABAIXO) */}
        {awardMovies.length > 0 && (
          <section>
            <SectionHeader
              title="Aclamados pela Crítica"
              subtitle="Obras essenciais com nota 8.0+ do público e da crítica"
              linkTo="/explorar?tipo=movie&sort=vote_average.desc&nota=8"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {awardMovies.map((movie) => {
                const primaryGenre = (movie.genre_ids || [])
                  .map((id) => GENRE_LABELS[id])
                  .find(Boolean);

                return (
                  <Link
                    key={getItemKey(movie)}
                    to={`/filme/${movie.id}`}
                    state={{ heroPrefill: movie }}
                    className="group flex flex-col"
                  >
                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#111115] border border-white/[0.08] group-hover:border-white/30 transition-all duration-300 shadow-xl shadow-black/50 mb-3.5">
                      <img
                        src={getBackdropUrl(movie.backdrop_path, 'w780')}
                        alt={movie.displayTitle}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                      <span className="absolute bottom-3 right-3 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-white">
                        TMDB {movie.displayRating}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-white/80 transition-colors line-clamp-1">
                      {movie.displayTitle}
                    </h3>
                    <p className="text-xs text-white/45 mt-0.5 line-clamp-1">
                      {[movie.displayYear, primaryGenre || 'Cinema'].filter(Boolean).join(' • ')}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <StarRow voteAverage={movie.vote_average} />
                      <span className="text-[11px] font-medium text-white/50">
                        {movie.displayRating}/10
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 6. TOP 10 SÉRIES HOJE (NÚMEROS CORRIGIDOS + SEM SCROLL VERTICAL INTERNO) */}
        <Top10Rail
          title="Séries Hoje"
          items={top10Series}
          mediaType="tv"
        />

        {/* 7. ESTRELAS EM DESTAQUE (ADAPTADO DE "BEST ARTISTS") */}
        {people.length > 0 && (
          <section>
            <SectionHeader
              title="Estrelas em Destaque"
              subtitle="Nomes que estão dominando as telas nesta semana"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">
              {people.map((person) => {
                const topWork = person.known_for?.[0];

                return (
                  <Link
                    key={person.id}
                    to={`/artista/${person.id}`}
                    state={{ personPrefill: person }}
                    className="group flex flex-col"
                  >
                    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#111115] border border-white/[0.08] group-hover:border-white/30 transition-all duration-300 shadow-lg shadow-black/50 mb-3">
                      {person.profile_path ? (
                        <img
                          src={getPosterUrl(person.profile_path, 'w342')}
                          alt={person.name}
                          loading="lazy"
                          className="w-full h-full object-cover object-top grayscale-[25%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/25">
                          <User className="w-10 h-10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    </div>

                    <h3 className="text-sm font-semibold text-white group-hover:text-white/80 transition-colors truncate">
                      {person.name}
                    </h3>
                    {topWork?.title && (
                      <p className="text-[11px] text-white/45 truncate mt-0.5">
                        {topWork.title}
                      </p>
                    )}
                    {topWork?.vote_average > 0 && (
                      <div className="mt-1.5">
                        <StarRow voteAverage={topWork.vote_average} />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 8. AVALIAÇÃO RÁPIDA INTERATIVA + ROLETA SURPREENDA-ME */}
        <QuickRateAndSurpriseBanner
          pool={ratePool}
          onOpenSurprise={onOpenSurprise}
          showToast={showToast}
        />
      </div>

      {/* PLAYER DE TRAILER EM TELA CHEIA PARA OS CARDS */}
      <TrailerModal
        isOpen={Boolean(trailerItem)}
        onClose={closeTrailer}
        mediaId={trailerItem?.id}
        mediaType={trailerItem?.media_type}
        title={trailerItem?.displayTitle}
      />
    </main>
  );
}
