import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Film,
  Tv,
  LayoutGrid,
  Star,
  User,
  ExternalLink,
  Clapperboard,
  Award,
} from 'lucide-react';
import { getPersonDetails, getPosterUrl, getBackdropUrl } from '../services/api';
import { isValidNumericId } from '../utils/security';
import MovieCard from './MovieCard';
import HorizontalDragRail from './HorizontalDragRail';
import { CardGridSkeleton } from './Skeletons';

const personMemoryCache = new Map();

const DEPARTMENT_PT = {
  Acting: 'Atuação',
  Directing: 'Direção',
  Production: 'Produção',
  Writing: 'Roteiro',
  Sound: 'Trilha & Som',
  Camera: 'Fotografia',
  Editing: 'Montagem',
  Art: 'Direção de Arte',
  'Visual Effects': 'Efeitos Visuais',
  Creator: 'Criação',
};

const formatDateBR = (isoDate) => {
  if (!isoDate) return null;
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return isoDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const computeAge = (birthday, deathday = null) => {
  if (!birthday) return null;
  const [by, bm, bd] = String(birthday).split('-').map(Number);
  if (!by || !bm || !bd) return null;
  const ref = deathday
    ? (() => {
        const [dy, dm, dd] = String(deathday).split('-').map(Number);
        return dy && dm && dd ? new Date(dy, dm - 1, dd) : new Date();
      })()
    : new Date();
  let age = ref.getFullYear() - by;
  const mDiff = ref.getMonth() + 1 - bm;
  if (mDiff < 0 || (mDiff === 0 && ref.getDate() < bd)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
};

export default function PersonDetails() {
  const { id } = useParams();
  return <PersonDetailsView key={id} id={id} />;
}

function PersonDetailsView({ id }) {
  const navigate = useNavigate();
  const location = useLocation();

  const validId = isValidNumericId(id);
  const cached = validId ? personMemoryCache.get(String(id)) || null : null;
  const prefill =
    cached ||
    (validId &&
    location.state?.personPrefill &&
    String(location.state.personPrefill.id) === String(id)
      ? location.state.personPrefill
      : null);

  const [person, setPerson] = useState(prefill);
  const [loading, setLoading] = useState(validId && !prefill);
  const [loadingCredits, setLoadingCredits] = useState(validId && !cached);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [tab, setTab] = useState('all'); // 'all' | 'movie' | 'tv'
  const [sort, setSort] = useState('popularity'); // 'popularity' | 'recent' | 'rating'
  const [visibleCount, setVisibleCount] = useState(24);
  const sentinelRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!validId || cached) return undefined;

    let cancelled = false;
    const load = async () => {
      const data = await getPersonDetails(id);
      if (cancelled) return;
      if (data) {
        if (personMemoryCache.size >= 40) {
          const oldest = personMemoryCache.keys().next().value;
          personMemoryCache.delete(oldest);
        }
        personMemoryCache.set(String(id), data);
        setPerson(data);
      } else if (!prefill) {
        setPerson(null);
      }
      setLoading(false);
      setLoadingCredits(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id, validId, cached, prefill]);

  const allCredits = useMemo(() => person?.credits || [], [person]);
  const movieCount = useMemo(
    () => allCredits.filter((c) => c.media_type === 'movie').length,
    [allCredits]
  );
  const tvCount = useMemo(
    () => allCredits.filter((c) => c.media_type === 'tv').length,
    [allCredits]
  );

  const filteredCredits = useMemo(() => {
    const base =
      tab === 'movie'
        ? allCredits.filter((c) => c.media_type === 'movie')
        : tab === 'tv'
          ? allCredits.filter((c) => c.media_type === 'tv')
          : allCredits;

    const list = [...base];
    list.sort((a, b) => {
      if (sort === 'recent') {
        const da = String(a.release_date || a.first_air_date || '0000-00-00');
        const db = String(b.release_date || b.first_air_date || '0000-00-00');
        return db.localeCompare(da);
      }
      if (sort === 'rating') {
        const score = (x) => (x.vote_count >= 25 ? x.vote_average || 0 : (x.vote_average || 0) * 0.5);
        return score(b) - score(a);
      }
      const popScore = (x) =>
        (x.popularity || 0) + Math.min(180, Math.sqrt(x.vote_count || 0) * 3);
      return popScore(b) - popScore(a);
    });
    return list;
  }, [allCredits, tab, sort]);

  // Revelação progressiva automática da filmografia ao descer a página
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= filteredCredits.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((v) => Math.min(filteredCredits.length, v + 24));
        }
      },
      { rootMargin: '400px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, filteredCredits.length]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#09090B] pt-28 pb-20 px-5 sm:px-8 lg:px-14">
        <div className="container mx-auto space-y-10">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-48 sm:w-64 aspect-[2/3] rounded-2xl skeleton-shimmer flex-shrink-0" />
            <div className="flex-1 space-y-4 pt-2">
              <div className="h-4 w-24 rounded-lg skeleton-shimmer" />
              <div className="h-11 w-72 max-w-full rounded-xl skeleton-shimmer" />
              <div className="h-4 w-96 max-w-full rounded-lg skeleton-shimmer" />
              <div className="h-28 w-full max-w-2xl rounded-2xl skeleton-shimmer" />
            </div>
          </div>
          <CardGridSkeleton
            count={12}
            cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          />
        </div>
      </main>
    );
  }

  if (!person) {
    return (
      <main className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center px-4 text-center">
        <Clapperboard className="w-14 h-14 text-white/20 mb-4" />
        <h2 className="text-2xl font-medium text-white mb-2">Artista não encontrado</h2>
        <p className="text-white/50 text-sm mb-6">
          Não conseguimos carregar as informações deste artista no momento.
        </p>
        <Link
          to="/"
          className="bg-white hover:bg-white/90 text-[#09090B] font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Voltar ao Início
        </Link>
      </main>
    );
  }

  const profileUrl = person.profile_path ? getPosterUrl(person.profile_path, 'h632') : null;
  const knownFor = person.known_for || [];
  const heroBackdropPath = knownFor.find((k) => k.backdrop_path)?.backdrop_path || null;
  const heroBackdropUrl = heroBackdropPath ? getBackdropUrl(heroBackdropPath, 'w1280') : null;

  const deptLabel =
    DEPARTMENT_PT[person.known_for_department] || person.known_for_department || 'Cinema & TV';
  const birthdayFormatted = formatDateBR(person.birthday);
  const deathdayFormatted = formatDateBR(person.deathday);
  const age = computeAge(person.birthday, person.deathday);

  const bio = person.biography || '';
  const isBioLong = bio.length > 420;
  const visibleCredits = filteredCredits.slice(0, visibleCount);

  const imdbUrl = person.external_ids?.imdb_id
    ? `https://www.imdb.com/name/${person.external_ids.imdb_id}/`
    : null;
  const instagramUrl = person.external_ids?.instagram_id
    ? `https://www.instagram.com/${person.external_ids.instagram_id}/`
    : null;

  return (
    <main className="min-h-screen bg-[#09090B] relative pb-24 overflow-x-hidden">
      {/* FUNDO ATMOSFÉRICO BASEADO NA OBRA PRINCIPAL DO ARTISTA */}
      <div className="relative pt-24 pb-12 sm:pb-16 overflow-hidden">
        {heroBackdropUrl && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={heroBackdropUrl}
              alt=""
              className="w-full h-full object-cover object-top opacity-25 blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/70 via-[#09090B]/80 to-[#09090B]" />
          </div>
        )}

        <div className="relative z-10 container mx-auto px-5 sm:px-8 lg:px-14">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-medium text-white/80 hover:text-white px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-md border border-white/15 transition-all mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>

          {/* CABEÇALHO DO ARTISTA */}
          <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start">
            {/* Retrato */}
            <div className="w-44 sm:w-56 md:w-64 aspect-[2/3] rounded-2xl overflow-hidden bg-[#131318] border border-white/15 shadow-2xl shadow-black/70 flex-shrink-0">
              {profileUrl ? (
                <img
                  src={profileUrl}
                  alt={person.name}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/25">
                  <User className="w-16 h-16" />
                </div>
              )}
            </div>

            {/* Informações & Biografia */}
            <div className="flex-1 min-w-0 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-wider text-white/85">
                  <Award className="w-3.5 h-3.5 text-[#FE3131]" />
                  {deptLabel}
                </span>
                {allCredits.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs font-medium text-white/65">
                    {allCredits.length} {allCredits.length === 1 ? 'crédito' : 'créditos'}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-white leading-[1.05]">
                {person.name}
              </h1>

              {/* Metadados Pessoais */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-xs sm:text-sm text-white/70">
                {birthdayFormatted && (
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <span>
                      {birthdayFormatted}
                      {age !== null && !deathdayFormatted && (
                        <span className="text-white/45"> ({age} anos)</span>
                      )}
                      {deathdayFormatted && (
                        <span className="text-white/45">
                          {' '}
                          — {deathdayFormatted}
                          {age !== null ? ` (${age} anos)` : ''}
                        </span>
                      )}
                    </span>
                  </span>
                )}

                {person.place_of_birth && (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <span>{person.place_of_birth}</span>
                  </span>
                )}
              </div>

              {/* Links externos (IMDb / Instagram) */}
              {(imdbUrl || instagramUrl) && (
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {imdbUrl && (
                    <a
                      href={imdbUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-xs font-semibold text-amber-300 transition-colors"
                    >
                      IMDb
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-medium text-white/85 transition-colors"
                    >
                      Instagram
                      <ExternalLink className="w-3 h-3 text-white/50" />
                    </a>
                  )}
                </div>
              )}

              {/* Biografia */}
              <div className="pt-2 max-w-3xl">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white/45">
                    Biografia
                  </h2>
                  {bio && person.biography_lang === 'en-US' && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/[0.06] text-white/45">
                      EN
                    </span>
                  )}
                </div>

                {loadingCredits && !bio ? (
                  <div className="space-y-2">
                    <div className="h-3.5 w-full rounded skeleton-shimmer" />
                    <div className="h-3.5 w-5/6 rounded skeleton-shimmer" />
                    <div className="h-3.5 w-2/3 rounded skeleton-shimmer" />
                  </div>
                ) : bio ? (
                  <>
                    <p className="text-sm sm:text-base text-white/75 leading-relaxed whitespace-pre-line">
                      {isBioLong && !bioExpanded ? `${bio.slice(0, 420).trim()}...` : bio}
                    </p>
                    {isBioLong && (
                      <button
                        type="button"
                        onClick={() => setBioExpanded((v) => !v)}
                        className="mt-2.5 text-xs font-medium text-white/80 hover:text-white underline underline-offset-4 transition-colors"
                      >
                        {bioExpanded ? 'Recolher biografia' : 'Ler biografia completa'}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-white/45">
                    Biografia ainda não cadastrada no catálogo do TMDB para {person.name}.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-5 sm:px-8 lg:px-14 space-y-16">
        {/* OBRAS MAIS MARCANTES COM ARRASTO LATERAL + SETAS */}
        {knownFor.length > 0 && (
          <section>
            <HorizontalDragRail
              title="Obras em Destaque"
              subtitle={`Títulos mais populares e reconhecidos de ${person.name}`}
              railClassName="gap-4 pb-4"
            >
              {knownFor.map((work) => {
                const target =
                  work.media_type === 'movie' ? `/filme/${work.id}` : `/serie/${work.id}`;
                return (
                  <Link
                    key={`known-${work.media_type}-${work.id}`}
                    to={target}
                    state={{ heroPrefill: work }}
                    draggable={false}
                    className="group flex-shrink-0 w-40 sm:w-44 flex flex-col"
                  >
                    <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-[#121216] border border-white/[0.09] group-hover:border-white/30 transition-all duration-300 shadow-xl shadow-black/50 mb-2.5">
                      {work.poster_path ? (
                        <img
                          src={getPosterUrl(work.poster_path, 'w342')}
                          alt={work.displayTitle}
                          draggable={false}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/25">
                          <Film className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-amber-400">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {work.displayRating}
                      </span>
                      <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/65 backdrop-blur-md text-[10px] font-semibold uppercase tracking-wider text-white/80">
                        {work.media_type === 'movie' ? 'Filme' : 'Série'}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-white/80 transition-colors line-clamp-1">
                      {work.displayTitle}
                    </h3>
                    {work.role && (
                      <p className="text-[11px] text-white/45 line-clamp-1 mt-0.5">
                        {work.role}
                      </p>
                    )}
                  </Link>
                );
              })}
            </HorizontalDragRail>
          </section>
        )}

        {/* FILMOGRAFIA COMPLETA FILTRÁVEL */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 pb-4 border-b border-white/[0.08]">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Filmografia
              </h2>
              <p className="text-xs sm:text-sm text-white/45 mt-1">
                Explore todos os filmes e séries com participação de {person.name}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Abas Todos / Filmes / Séries */}
              <div className="inline-flex p-1 bg-white/[0.05] border border-white/[0.1] rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setTab('all');
                    setVisibleCount(24);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === 'all'
                      ? 'bg-white text-[#09090B] font-semibold'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Todos ({allCredits.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('movie');
                    setVisibleCount(24);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === 'movie'
                      ? 'bg-white text-[#09090B] font-semibold'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  Filmes ({movieCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('tv');
                    setVisibleCount(24);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === 'tv'
                      ? 'bg-white text-[#09090B] font-semibold'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                  Séries ({tvCount})
                </button>
              </div>

              {/* Ordenação rápida */}
              <div className="inline-flex p-1 bg-white/[0.04] border border-white/[0.09] rounded-xl">
                {[
                  { id: 'popularity', label: 'Populares' },
                  { id: 'recent', label: 'Recentes' },
                  { id: 'rating', label: 'Nota' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSort(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sort === opt.id
                        ? 'bg-white/[0.15] text-white font-semibold'
                        : 'text-white/55 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingCredits && allCredits.length === 0 ? (
            <CardGridSkeleton
              count={12}
              cols="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            />
          ) : visibleCredits.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                {visibleCredits.map((credit) => (
                  <MovieCard
                    key={`${credit.media_type}-${credit.id}`}
                    id={credit.id}
                    title={credit.displayTitle}
                    image={getPosterUrl(credit.poster_path)}
                    rating={credit.displayRating}
                    year={credit.displayYear}
                    mediaType={credit.media_type}
                  />
                ))}
              </div>
              {visibleCount < filteredCredits.length && (
                <div ref={sentinelRef} className="h-8 w-full" aria-hidden="true" />
              )}
            </>
          ) : (
            <div className="text-center py-14 rounded-2xl bg-white/[0.02] border border-white/[0.07] text-sm text-white/45">
              Nenhum título encontrado nesta categoria.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
