import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  Heart,
  Play,
  Share2,
  Clock,
  Tv,
  ChevronDown,
  Lock,
  User,
  DollarSign,
  MessageSquare,
  ExternalLink,
  Trash2,
  Send,
  Clapperboard,
  Film,
} from 'lucide-react';
import {
  getMediaDetails,
  getSeasonDetails,
  getWatchLinks,
  getPosterUrl,
  getBackdropUrl,
  IMAGE_BASE,
} from '../services/api';
import MovieCard from './MovieCard';
import TrailerPreviewCard from './TrailerPreviewCard';
import { DetailsSkeleton, EpisodeSkeleton } from './Skeletons';
import {
  isFavorite,
  toggleFavorite,
  getUserReview,
  saveUserReview,
  deleteUserReview,
} from '../utils/storage';
import { useToast } from '../utils/toast';
import { isValidNumericId, sanitizeExternalUrl } from '../utils/security';
import { getNormalizedPlatformsBR } from '../utils/streaming';

const formatRuntime = (minutes) => {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
};

const formatCurrency = (amount) => {
  if (!amount || amount <= 0) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
};

function CommunityReviewCard({ review }) {
  const [expanded, setExpanded] = useState(false);
  const content = review.content || '';
  const isLong = content.length > 320;
  const avatarPath = review.author_details?.avatar_path;
  const rawAvatarUrl = avatarPath
    ? avatarPath.startsWith('/http')
      ? avatarPath.slice(1)
      : `${IMAGE_BASE}/w185${avatarPath}`
    : null;
  const avatarUrl = sanitizeExternalUrl(rawAvatarUrl, [
    'image.tmdb.org',
    'gravatar.com',
  ]);

  return (
    <article className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={review.author}
              className="w-10 h-10 rounded-full object-cover border border-white/15 flex-shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/[0.08] text-white/80 border border-white/[0.12] flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {(review.author || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-white truncate">{review.author}</h4>
            <p className="text-xs text-white/45">
              {review.created_at
                ? new Date(review.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Comunidade TMDB'}
            </p>
          </div>
        </div>

        {review.author_details?.rating != null && (
          <div className="inline-flex items-center gap-1 bg-white/[0.06] text-amber-400 border border-white/[0.1] px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0">
            <Star className="w-3 h-3 fill-amber-400" />
            {review.author_details.rating}/10
          </div>
        )}
      </div>

      <p className="text-sm text-white/75 leading-relaxed whitespace-pre-line">
        {isLong && !expanded ? `${content.slice(0, 320).trim()}...` : content}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-white/80 hover:text-white underline underline-offset-2 self-start transition-colors"
        >
          {expanded ? 'Recolher crítica' : 'Ler crítica completa'}
        </button>
      )}
    </article>
  );
}

const detailsMemoryCache = new Map();

export default function MovieDetails({ mediaType = 'tv' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const detailCacheKey = `${mediaType}_${id}`;
  const cachedDetail = detailsMemoryCache.get(detailCacheKey) || null;

  // Pré-preenche imediatamente com cache em memória ou dados da Hero (transição contínua 0ms!)
  const prefill =
    cachedDetail ||
    (location.state?.heroPrefill &&
    String(location.state.heroPrefill.id) === String(id)
      ? location.state.heroPrefill
      : null);

  const [item, setItem] = useState(prefill);
  const [watchLinks, setWatchLinks] = useState(
    () => cachedDetail?._watchLinks || []
  );
  const [loading, setLoading] = useState(!prefill);
  const [favorited, setFavorited] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const trailerCardRef = useRef(null);

  // Episódios (Séries)
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [isSeasonOpen, setIsSeasonOpen] = useState(false);
  const seasonRef = useRef(null);

  // Avaliação pessoal do usuário
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [savedReview, setSavedReview] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (seasonRef.current && !seasonRef.current.contains(event.target)) {
        setIsSeasonOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);

    let cancelled = false;
    const fetchDetails = async () => {
      setIsExiting(false);
      const cached = detailsMemoryCache.get(detailCacheKey);
      const hasMatchingPrefill =
        location.state?.heroPrefill &&
        String(location.state.heroPrefill.id) === String(id);

      if (cached) {
        setItem(cached);
        setWatchLinks(cached._watchLinks || []);
        setFavorited(isFavorite(id, mediaType));
        const existingRev = getUserReview(id, mediaType);
        setSavedReview(existingRev);
        setUserRating(existingRev?.rating || 0);
        setUserComment(existingRev?.comment || '');
        if (mediaType === 'tv' && cached?.seasons?.length > 0) {
          const firstRealSeason =
            cached.seasons.find((s) => s.season_number > 0) || cached.seasons[0];
          setSelectedSeason(firstRealSeason ? firstRealSeason.season_number : null);
        }
        setLoading(false);
        return;
      }

      if (!hasMatchingPrefill) {
        setLoading(true);
      } else {
        setItem(location.state.heroPrefill);
        setLoading(false);
      }
      setWatchLinks([]);
      setEpisodes([]);
      setSelectedSeason(null);

      if (!isValidNumericId(id)) {
        if (!cancelled) {
          setItem(null);
          setLoading(false);
        }
        return;
      }

      const [data, directLinks] = await Promise.all([
        getMediaDetails(id, mediaType),
        getWatchLinks(id, mediaType),
      ]);
      if (!cancelled) {
        if (data) {
          if (detailsMemoryCache.size > 25) {
            const firstKey = detailsMemoryCache.keys().next().value;
            detailsMemoryCache.delete(firstKey);
          }
          detailsMemoryCache.set(detailCacheKey, { ...data, _watchLinks: directLinks });
        }
        setItem(data);
        setWatchLinks(directLinks);
        setFavorited(isFavorite(id, mediaType));
        const existingRev = getUserReview(id, mediaType);
        setSavedReview(existingRev);
        setUserRating(existingRev?.rating || 0);
        setUserComment(existingRev?.comment || '');

        if (mediaType === 'tv' && data?.seasons?.length > 0) {
          const firstRealSeason =
            data.seasons.find((s) => s.season_number > 0) || data.seasons[0];
          setSelectedSeason(firstRealSeason ? firstRealSeason.season_number : null);
        }

        setLoading(false);
      }
    };
    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [id, mediaType, detailCacheKey, location.state]);

  useEffect(() => {
    if (mediaType !== 'tv' || selectedSeason === null || !id) return;
    let cancelled = false;
    const fetchEpisodes = async () => {
      setLoadingEpisodes(true);
      const eps = await getSeasonDetails(id, selectedSeason);
      if (!cancelled) {
        setEpisodes(eps);
        setLoadingEpisodes(false);
      }
    };
    fetchEpisodes();
    return () => {
      cancelled = true;
    };
  }, [id, selectedSeason, mediaType]);

  const handleFavoriteClick = () => {
    if (!item) return;
    const added = toggleFavorite({
      id: item.id,
      title: item.displayTitle,
      image: getPosterUrl(item.poster_path) || '',
      rating: item.displayRating,
      year: item.displayYear,
      mediaType,
    });
    setFavorited(added);
    showToast(
      added
        ? `"${item.displayTitle}" salvo na Minha Lista`
        : `"${item.displayTitle}" removido da Minha Lista`,
      'heart'
    );
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareTitle = `${item?.displayTitle || 'studio'} — studio`;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url: shareUrl });
        return;
      }
    } catch {
      // cancelado pelo usuário
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copiado para a área de transferência!', 'success');
    } catch {
      showToast('Não foi possível copiar o link.', 'info');
    }
  };

  const handleSaveUserReview = (e) => {
    e.preventDefault();
    if (userRating === 0) {
      showToast('Selecione de 1 a 5 estrelas antes de salvar.', 'info');
      return;
    }
    const saved = saveUserReview(id, mediaType, {
      rating: userRating,
      comment: userComment,
    });
    setSavedReview(saved);
    showToast('Sua avaliação foi salva!', 'success');
  };

  const handleDeleteUserReview = () => {
    deleteUserReview(id, mediaType);
    setSavedReview(null);
    setUserRating(0);
    setUserComment('');
    showToast('Sua avaliação foi removida.', 'info');
  };

  const handleBack = () => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }, 280);
  };

  if (loading) return <DetailsSkeleton />;

  if (!item) {
    return (
      <main className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center px-4 text-center">
        <Clapperboard className="w-14 h-14 text-white/20 mb-4" />
        <h2 className="text-2xl font-medium text-white mb-2">Título não encontrado</h2>
        <p className="text-white/50 text-sm mb-6">
          Não conseguimos carregar os detalhes desta obra no momento.
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

  const backdropUrl = getBackdropUrl(item.backdrop_path || item.poster_path);
  const posterUrl = getPosterUrl(item.poster_path);
  const ytVideos = (item.videos?.results || []).filter((v) => v.site === 'YouTube');
  const watchProvidersBR = item['watch/providers']?.results?.BR;
  const platforms = getNormalizedPlatformsBR(
    watchProvidersBR,
    item.displayTitle,
    watchLinks
  );

  const castList = item.credits?.cast?.slice(0, 12) || [];
  const director = item.credits?.crew?.find((c) => c.job === 'Director');
  const recommendations = item.recommendations?.results || [];
  const communityReviews = item.reviews?.results || [];

  const runtimeLabel = mediaType === 'movie' ? formatRuntime(item.runtime) : null;
  const budgetLabel = mediaType === 'movie' ? formatCurrency(item.budget) : null;
  const revenueLabel = mediaType === 'movie' ? formatCurrency(item.revenue) : null;

  const currentSeasonObj = item.seasons?.find((s) => s.season_number === selectedSeason);
  const seasonDropdownLabel = currentSeasonObj
    ? `${currentSeasonObj.name}`
    : 'Temporada';

  return (
    <main className="min-h-screen bg-[#09090B] relative pb-20">
      {/* ================================================================ */}
      {/* TOPO CENA FULL-BLEED + BOTÃO PLAY CENTRAL + FAIXA DE EPISÓDIOS   */}
      {/* (EXATAMENTE COMO OS FRAMES 00:08–00:09 DO VÍDEO MON)             */}
      {/* ================================================================ */}
      <section className="relative w-full min-h-[62vh] md:min-h-[68vh] flex flex-col justify-between overflow-hidden pt-24 pb-6">
        {backdropUrl && (
          <div className="absolute inset-0 pointer-events-none">
            <img
              src={backdropUrl}
              alt={item.displayTitle}
              className="w-full h-full object-cover object-center md:object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-black/25 to-black/40" />
          </div>
        )}

        {/* Voltar discreto no topo */}
        <div
          className={`relative z-10 container mx-auto px-5 sm:px-8 lg:px-14 transition-opacity duration-200 ${
            isExiting ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-xs font-medium text-white/80 hover:text-white px-3.5 py-1.5 rounded-xl bg-black/35 hover:bg-black/55 backdrop-blur-md border border-white/15 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
        </div>

        {/* Botão Play Translúcido Centralizado sobre a Cena */}
        <div
          className={`relative z-10 flex items-center justify-center my-auto py-8 transition-all duration-300 ${
            isExiting ? 'opacity-0 scale-90' : 'opacity-100 scale-100 animate-fade-in'
          }`}
        >
          <button
            type="button"
            onClick={() => trailerCardRef.current?.openFullscreen()}
            aria-label={`Assistir trailer de ${item.displayTitle}`}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/30 text-white flex items-center justify-center shadow-2xl transition-all hover:scale-105 active:scale-95"
          >
            <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
          </button>
        </div>

        {/* Faixa de Episódios sobre a base do backdrop (sobe ao entrar, desce ao sair) */}
        {mediaType === 'tv' && item.seasons?.length > 0 && (
          <div
            className={`relative z-20 container mx-auto px-5 sm:px-8 lg:px-14 ${
              isExiting ? 'animate-sheet-out' : 'animate-sheet-in'
            }`}
          >
            <div className="flex items-center gap-4 mb-3">
              <h2 className="text-base sm:text-lg font-medium text-white">Episódios</h2>

              <div className="relative" ref={seasonRef}>
                <button
                  type="button"
                  onClick={() => setIsSeasonOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-white/75 hover:text-white bg-black/40 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-lg transition-all"
                >
                  <span>{seasonDropdownLabel}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      isSeasonOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isSeasonOpen && (
                  <div className="absolute left-0 mt-2 w-56 bg-[#111115]/98 backdrop-blur-2xl border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden py-1.5 max-h-60 overflow-y-auto custom-scrollbar z-50 animate-fade-in">
                    {item.seasons
                      .filter((s) => s.season_number > 0)
                      .map((season) => (
                        <button
                          key={season.id}
                          onClick={() => {
                            setSelectedSeason(season.season_number);
                            setIsSeasonOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                            selectedSeason === season.season_number
                              ? 'bg-white text-[#09090B] font-semibold'
                              : 'text-white/80 hover:bg-white/[0.08]'
                          }`}
                        >
                          {season.name} ({season.episode_count} eps)
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {loadingEpisodes ? (
              <EpisodeSkeleton count={5} />
            ) : (
              <div className="flex overflow-x-auto overflow-y-hidden gap-3 pb-2 hide-scrollbar snap-x">
                {episodes.map((ep) => {
                  const isUnreleased = !ep.air_date || new Date(ep.air_date) > new Date();
                  return (
                    <div
                      key={ep.id}
                      className={`snap-start flex-shrink-0 w-48 sm:w-56 aspect-video relative rounded-xl overflow-hidden bg-black/50 border border-white/15 group ${
                        isUnreleased ? 'opacity-55 grayscale-[40%]' : ''
                      }`}
                    >
                      {ep.still_path ? (
                        <img
                          src={`${IMAGE_BASE}/w500${ep.still_path}`}
                          alt={ep.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/25">
                          <Tv className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

                      {isUnreleased && (
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/70 text-[10px] font-medium text-white/80">
                          <Lock className="w-2.5 h-2.5" /> Em breve
                        </span>
                      )}

                      <div className="absolute bottom-2 inset-x-2.5">
                        <p className="text-xs font-medium text-white truncate">{ep.name}</p>
                        <p className="text-[10px] text-white/60">
                          T{selectedSeason} · E{ep.episode_number}
                          {ep.runtime ? ` · ${ep.runtime} min` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* LINHA PRINCIPAL SOBRE PRETO PURO (SOBE AO ENTRAR, DESCE AO SAIR) */}
      {/* ================================================================ */}
      <div
        className={`container mx-auto px-5 sm:px-8 lg:px-14 mt-10 space-y-16 ${
          isExiting ? 'animate-sheet-out' : 'animate-sheet-in-delayed'
        }`}
      >
        <section className="flex flex-col lg:flex-row items-start gap-8 lg:gap-10">
          {/* Esquerda: Cartaz Vertical 2:3 */}
          <div className="w-36 sm:w-44 lg:w-48 aspect-[2/3] rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.1] shadow-2xl flex-shrink-0">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={item.displayTitle}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/25">
                <Film className="w-10 h-10" />
              </div>
            )}
          </div>

          {/* Centro: Micro-tags, Título, Nota + Streaming, Favorito, Sinopse */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded bg-white/[0.08] text-[11px] font-medium text-white/75">
                {mediaType === 'movie' ? 'Filme' : 'Série'}
              </span>
              {(item.genres || []).slice(0, 4).map((g) => (
                <Link
                  key={g.id}
                  to={`/explorar?tipo=${mediaType}&genero=${g.id}`}
                  className="px-2.5 py-0.5 rounded bg-white/[0.08] hover:bg-white/[0.16] text-[11px] font-medium text-white/80 transition-colors"
                >
                  {g.name}
                </Link>
              ))}
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-bold tracking-tight text-white leading-[1.06]">
              {item.displayTitle}
            </h1>

            {/* Nota + Streaming + Ano + Duração */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="bg-amber-400 text-[#09090B] font-extrabold text-[10px] tracking-wider px-1.5 py-0.5 rounded">
                  TMDB
                </span>
                <span className="font-semibold text-white">{item.displayRating}</span>
              </span>

              {platforms[0] && (
                <a
                  href={platforms[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 pl-2 border-l border-white/15 hover:opacity-85 transition-opacity"
                >
                  {platforms[0].logo_path && (
                    <img
                      src={`${IMAGE_BASE}/w92${platforms[0].logo_path}`}
                      alt={platforms[0].name}
                      className="w-6 h-6 rounded-md object-cover"
                    />
                  )}
                  <span className="text-xs font-medium text-white/85">
                    {platforms[0].name}
                  </span>
                  {platforms[0].isFree && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Grátis
                    </span>
                  )}
                </a>
              )}

              {item.displayYear && (
                <span className="text-white/50 text-xs">• {item.displayYear}</span>
              )}

              {runtimeLabel && (
                <span className="text-white/50 text-xs inline-flex items-center gap-1">
                  • <Clock className="w-3 h-3" /> {runtimeLabel}
                </span>
              )}
            </div>

            {/* Ações: + Minha Lista (botão branco quadrado) + Compartilhar */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                type="button"
                onClick={handleFavoriteClick}
                className="group inline-flex items-center gap-3 text-sm font-medium text-white/90 hover:text-white transition-colors"
              >
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    favorited
                      ? 'bg-white text-[#09090B]'
                      : 'bg-white/[0.1] group-hover:bg-white/[0.18] border border-white/[0.15] text-white'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
                </span>
                <span>{favorited ? 'Salvo na Lista' : 'Adicionar à Lista'}</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 text-xs font-medium text-white/65 hover:text-white px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartilhar
              </button>
            </div>

            {item.tagline && (
              <p className="text-sm italic text-white/45 pt-1">“{item.tagline}”</p>
            )}

            <p className="text-sm sm:text-base text-white/70 leading-relaxed max-w-2xl">
              {item.overview || 'Nenhuma sinopse em português disponível para este título.'}
            </p>

            {/* Ficha Técnica compacta para Filmes */}
            {mediaType === 'movie' && (director || budgetLabel || revenueLabel) && (
              <div className="flex flex-wrap gap-6 pt-2 text-xs">
                {director && (
                  <div>
                    <span className="block text-white/40 uppercase tracking-wider text-[10px]">
                      Direção
                    </span>
                    <span className="font-medium text-white/90">{director.name}</span>
                  </div>
                )}
                {budgetLabel && (
                  <div>
                    <span className="block text-white/40 uppercase tracking-wider text-[10px]">
                      Orçamento
                    </span>
                    <span className="font-medium text-white/90 inline-flex items-center gap-0.5">
                      <DollarSign className="w-3 h-3 text-white/50" />
                      {budgetLabel}
                    </span>
                  </div>
                )}
                {revenueLabel && (
                  <div>
                    <span className="block text-white/40 uppercase tracking-wider text-[10px]">
                      Bilheteria
                    </span>
                    <span className="font-medium text-emerald-400 inline-flex items-center gap-0.5">
                      <DollarSign className="w-3 h-3" />
                      {revenueLabel}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Direita: Player único persistente (prévia -> tela cheia sem recarregar!) */}
          <TrailerPreviewCard
            ref={trailerCardRef}
            mediaId={item.id}
            mediaType={mediaType}
            title={item.displayTitle}
            backdropPath={item.backdrop_path || item.poster_path}
            initialTrailerKey={ytVideos[0]?.key || item.trailer_key || null}
            preloadedVideos={ytVideos}
            paused={isExiting}
            className="w-full sm:w-80 lg:w-72"
          />
        </section>

        {/* ================================================================ */}
        {/* ONDE ASSISTIR (PLATAFORMAS UNIFICADAS + LINK DIRETO EM NOVA ABA) */}
        {/* ================================================================ */}
        {platforms.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-medium text-white">
              Onde Assistir
            </h2>

            <div className="flex flex-wrap gap-3">
              {platforms.map((platform) => (
                <a
                  key={platform.key}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Assistir "${item.displayTitle}" em ${platform.name}`}
                  className="group flex items-center gap-3 bg-white/[0.04] hover:bg-white/[0.11] border border-white/[0.09] hover:border-white/25 px-3.5 py-2.5 rounded-2xl transition-all"
                >
                  {platform.logo_path ? (
                    <img
                      src={`${IMAGE_BASE}/w92${platform.logo_path}`}
                      alt={platform.name}
                      className="w-9 h-9 rounded-xl object-cover shadow"
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-xl bg-white/[0.1] flex items-center justify-center text-xs font-bold text-white">
                      {platform.name.charAt(0)}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {platform.name}
                    </span>
                    {platform.isFree && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Grátis
                      </span>
                    )}
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-white/30 group-hover:text-white/80 transition-colors ml-0.5" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* ELENCO EM CARDS VERTICAIS 3:4 (EXATAMENTE COMO FRAME 00:12!)     */}
        {/* ================================================================ */}
        {castList.length > 0 && (
          <section>
            <h2 className="text-lg sm:text-xl font-medium text-white mb-5">Elenco</h2>
            <div className="flex overflow-x-auto overflow-y-hidden gap-4 pt-2 pb-4 hide-scrollbar snap-x">
              {castList.map((actor) => (
                <div
                  key={actor.id}
                  className="snap-start flex-shrink-0 w-36 sm:w-44 aspect-[3/4] relative rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.08] group"
                >
                  {actor.profile_path ? (
                    <img
                      src={`${IMAGE_BASE}/w300${actor.profile_path}`}
                      alt={actor.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/25">
                      <User className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 inset-x-3">
                    <p className="text-sm font-medium text-white leading-tight line-clamp-2">
                      {actor.name}
                    </p>
                    <p className="text-[11px] text-white/55 truncate mt-0.5">
                      {actor.character}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* AVALIAÇÕES & CRÍTICAS                                            */}
        {/* ================================================================ */}
        <section>
          <h2 className="text-lg sm:text-xl font-medium text-white mb-5">
            Avaliações & Críticas
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleSaveUserReview}
              className="lg:col-span-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Sua Avaliação</h3>
                {savedReview && (
                  <button
                    type="button"
                    onClick={handleDeleteUserReview}
                    className="text-xs font-medium text-white/55 hover:text-white inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = star <= (hoverRating || userRating);
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setUserRating(star)}
                      aria-label={`Nota ${star} de 5`}
                      className="p-1 transition-transform hover:scale-125"
                    >
                      <Star
                        className={`w-6 h-6 transition-colors ${
                          active ? 'text-amber-400 fill-amber-400' : 'text-white/20'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs text-white/50">
                  {userRating > 0 ? `${userRating} de 5 estrelas` : 'Toque para avaliar'}
                </span>
              </div>

              <div className="space-y-1">
                <textarea
                  rows={3}
                  maxLength={500}
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="Escreva o que achou deste título (salvo no seu navegador)..."
                  className="w-full bg-black/40 border border-white/[0.1] rounded-xl p-3.5 text-sm text-white placeholder-white/35 focus:outline-none focus:border-white/35 resize-none"
                />
                <p className="text-[11px] text-white/35 text-right">
                  {userComment.length}/500
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-white hover:bg-white/90 text-[#09090B] font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-4 h-4" />
                {savedReview ? 'Atualizar Avaliação' : 'Salvar Avaliação'}
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              {communityReviews.length > 0 ? (
                communityReviews.slice(0, 4).map((review) => (
                  <CommunityReviewCard key={review.id} review={review} />
                ))
              ) : (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 text-center text-white/50">
                  <MessageSquare className="w-9 h-9 mx-auto mb-3 text-white/20" />
                  <p className="text-sm font-medium text-white/70">
                    Ainda não há críticas da comunidade TMDB para este título.
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Registre sua nota pessoal ao lado!
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* VOCÊ TAMBÉM PODE GOSTAR                                          */}
        {/* ================================================================ */}
        {recommendations.length > 0 && (
          <section>
            <h2 className="text-lg sm:text-xl font-medium text-white mb-5">
              Você também pode gostar
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {recommendations.slice(0, 12).map((rec) => {
                const recType = rec.media_type || mediaType;
                return (
                  <MovieCard
                    key={`${recType}-${rec.id}`}
                    id={rec.id}
                    title={rec.title || rec.name}
                    image={getPosterUrl(rec.poster_path)}
                    rating={rec.vote_average ? rec.vote_average.toFixed(1) : 'N/A'}
                    year={
                      rec.release_date || rec.first_air_date
                        ? new Date(rec.release_date || rec.first_air_date).getFullYear()
                        : ''
                    }
                    mediaType={recType}
                  />
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
