import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dices,
  X,
  Play,
  Heart,
  Film,
  Tv,
  LayoutGrid,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { getSurprisePick, getPosterUrl, getBackdropUrl } from '../services/api';
import { isFavorite, toggleFavorite } from '../utils/storage';
import { useToast } from '../utils/toast';
import TrailerModal from './TrailerModal';

const MOODS = [
  { id: 'any', label: 'Qualquer clima', movieGenre: '', tvGenre: '' },
  { id: 'action', label: 'Adrenalina', movieGenre: '28', tvGenre: '10759' },
  { id: 'comedy', label: 'Para rir', movieGenre: '35', tvGenre: '35' },
  { id: 'drama', label: 'Drama', movieGenre: '18', tvGenre: '18' },
  { id: 'scifi', label: 'Sci-Fi & Fantasia', movieGenre: '878', tvGenre: '10765' },
  { id: 'thriller', label: 'Suspense', movieGenre: '53', tvGenre: '80' },
  { id: 'horror', label: 'Terror', movieGenre: '27', tvGenre: '9648' },
  { id: 'animation', label: 'Animação', movieGenre: '16', tvGenre: '16' },
];

export default function SurpriseModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [phase, setPhase] = useState('idle'); // 'idle' | 'entering' | 'open' | 'closing'
  const [mediaType, setMediaType] = useState('all');
  const [mood, setMood] = useState('any');
  const [spinning, setSpinning] = useState(false);
  const [pick, setPick] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  const [favorited, setFavorited] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const reqSeqRef = useRef(0);
  const closeTimerRef = useRef(null);
  const closingRef = useRef(false);
  const hasInitialRollRef = useRef(false);

  const fetchBatch = useCallback(async (customType, customMood) => {
    const reqId = ++reqSeqRef.current;
    setSpinning(true);

    const chosenMood = MOODS.find((m) => m.id === customMood) || MOODS[0];
    const resolvedType =
      customType === 'all'
        ? Math.random() < 0.5
          ? 'movie'
          : 'tv'
        : customType;
    const genre =
      resolvedType === 'movie' ? chosenMood.movieGenre : chosenMood.tvGenre;

    const [result] = await Promise.all([
      getSurprisePick({ type: resolvedType, genre }),
      new Promise((r) => setTimeout(r, 340)),
    ]);

    if (reqId !== reqSeqRef.current) return;

    const nextPick = result?.pick || null;
    setPick(nextPick);
    setAlternatives(Array.isArray(result?.alternatives) ? result.alternatives : []);
    setFavorited(nextPick ? isFavorite(nextPick.id, nextPick.media_type) : false);
    setSpinning(false);
  }, []);

  // Sortear próximo: instantâneo usando o pool já carregado; busca novo lote quando esgotar
  const handleRollNext = useCallback(() => {
    if (spinning) return;
    if (alternatives.length > 0) {
      const [next, ...rest] = alternatives;
      setPick(next);
      setAlternatives(rest);
      setFavorited(isFavorite(next.id, next.media_type));
      return;
    }
    fetchBatch(mediaType, mood);
  }, [spinning, alternatives, fetchBatch, mediaType, mood]);

  const handleSelectAlternative = (item) => {
    if (!item || !pick) return;
    const nextAlts = [pick, ...alternatives.filter((a) => a.id !== item.id)].slice(0, 5);
    setPick(item);
    setAlternatives(nextAlts);
    setFavorited(isFavorite(item.id, item.media_type));
  };

  const handleSmoothClose = useCallback(
    (afterClose = null) => {
      if (closingRef.current) return;
      closingRef.current = true;
      setPhase('closing');
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        closingRef.current = false;
        setPhase('idle');
        onClose();
        afterClose?.();
      }, 240);
    },
    [onClose]
  );

  // Orquestra abertura suave + primeiro sorteio
  useEffect(() => {
    if (!isOpen) return undefined;
    closingRef.current = false;

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      setPhase('entering');
      raf2 = requestAnimationFrame(() => {
        setPhase('open');
        if (!hasInitialRollRef.current) {
          hasInitialRollRef.current = true;
          fetchBatch('all', 'any');
        }
      });
    });

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, fetchBatch]);

  useEffect(() => {
    if (!isOpen && phase === 'idle') return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !trailerOpen) {
        e.preventDefault();
        handleSmoothClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, phase, trailerOpen, handleSmoothClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!isOpen && phase === 'idle') return null;

  const isExpanded = phase === 'open';
  const backdropUrl = pick?.backdrop_path ? getBackdropUrl(pick.backdrop_path, 'w1280') : null;

  const handleGoToDetails = () => {
    if (!pick) return;
    const route = pick.media_type === 'movie' ? `/filme/${pick.id}` : `/serie/${pick.id}`;
    handleSmoothClose(() => navigate(route, { state: { heroPrefill: pick } }));
  };

  const handleFavorite = () => {
    if (!pick) return;
    const added = toggleFavorite({
      id: pick.id,
      title: pick.displayTitle,
      image: getPosterUrl(pick.poster_path) || '',
      rating: pick.displayRating,
      year: pick.displayYear,
      mediaType: pick.media_type,
    });
    setFavorited(added);
    showToast(
      added ? `"${pick.displayTitle}" salvo na Minha Lista` : 'Removido da Minha Lista',
      'heart'
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[85] flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
          isExpanded
            ? 'bg-black/80 backdrop-blur-xl opacity-100'
            : 'bg-black/0 backdrop-blur-none opacity-0 pointer-events-none'
        }`}
        onClick={() => handleSmoothClose()}
        role="dialog"
        aria-modal="true"
        aria-label="Roleta Surpreenda-me"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-3xl bg-[#101014]/98 border border-white/[0.12] rounded-3xl overflow-hidden shadow-[0_36px_100px_rgba(0,0,0,0.92)] max-h-[92vh] flex flex-col transition-all duration-300 ${
            isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
        >
          {/* FUNDO CINEMATOGRÁFICO ATMOSFÉRICO DO TÍTULO SORTEADO */}
          {backdropUrl && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <img
                key={`surprise-bg-${pick.media_type}-${pick.id}`}
                src={backdropUrl}
                alt=""
                className="w-full h-full object-cover object-top opacity-30 scale-105 transition-opacity duration-500 animate-fade-in"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#101014] via-[#101014]/82 to-[#101014]/55" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-[#101014]/45 to-[#101014]/80" />
            </div>
          )}

          {/* CABEÇALHO LIMPO ALINHADO AO STUDIO */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-5 sm:px-7 pt-5 pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#FE3131]" />
              <div>
                <h3 className="font-display text-base sm:text-lg font-semibold tracking-tight text-white leading-none">
                  Surpreenda-me
                </h3>
                <p className="text-[11px] text-white/45 mt-1">
                  Curadoria aclamada (nota 7.4+) no seu clima
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Seletor segmentado idêntico ao Explorar */}
              <div className="inline-flex p-1 bg-white/[0.05] border border-white/[0.1] rounded-xl">
                {[
                  { value: 'all', label: 'Todos', icon: LayoutGrid },
                  { value: 'movie', label: 'Filmes', icon: Film },
                  { value: 'tv', label: 'Séries', icon: Tv },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = mediaType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setMediaType(opt.value);
                        fetchBatch(opt.value, mood);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        active
                          ? 'bg-white text-[#09090B] font-semibold'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline sm:inline">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => handleSmoothClose()}
                className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] border border-white/[0.1] text-white/75 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CORPO PRINCIPAL */}
          <div className="relative z-10 px-5 sm:px-7 py-5 overflow-y-auto custom-scrollbar space-y-6">
            {/* Faixa horizontal limpa de Climas */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
              {MOODS.map((m) => {
                const active = mood === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMood(m.id);
                      fetchBatch(mediaType, m.id);
                    }}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                      active
                        ? 'bg-white text-[#09090B] border-white font-semibold'
                        : 'bg-white/[0.04] hover:bg-white/[0.1] text-white/65 hover:text-white border-white/[0.08]'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Vitrine Editorial do Título Sorteado */}
            {spinning ? (
              <div className="flex flex-col sm:flex-row gap-6 py-2">
                <div className="w-36 sm:w-44 aspect-[2/3] rounded-2xl skeleton-shimmer mx-auto sm:mx-0 flex-shrink-0" />
                <div className="flex-1 space-y-3.5 py-2">
                  <div className="h-5 w-32 rounded-lg skeleton-shimmer" />
                  <div className="h-9 w-3/4 rounded-xl skeleton-shimmer" />
                  <div className="h-4 w-full rounded skeleton-shimmer" />
                  <div className="h-4 w-5/6 rounded skeleton-shimmer" />
                  <div className="h-10 w-64 rounded-xl skeleton-shimmer mt-6" />
                </div>
              </div>
            ) : pick ? (
              <div
                key={`pick-${pick.media_type}-${pick.id}`}
                className="flex flex-col sm:flex-row gap-6 items-start animate-fade-in"
              >
                {/* Pôster */}
                <button
                  type="button"
                  onClick={handleGoToDetails}
                  className="group w-36 sm:w-44 aspect-[2/3] rounded-2xl overflow-hidden bg-white/[0.05] mx-auto sm:mx-0 flex-shrink-0 shadow-2xl shadow-black/70 border border-white/15 hover:border-white/35 transition-all"
                >
                  {pick.poster_path ? (
                    <img
                      src={getPosterUrl(pick.poster_path, 'w500')}
                      alt={pick.displayTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/25">
                      <Film className="w-10 h-10" />
                    </div>
                  )}
                </button>

                {/* Metadados + Ações no padrão Hero do studio */}
                <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5 mb-3 text-xs">
                      <span className="px-2.5 py-0.5 rounded bg-white/[0.12] backdrop-blur-md text-[11px] font-medium text-white/90">
                        {pick.media_type === 'movie' ? 'Filme' : 'Série'}
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        <span className="bg-amber-400 text-[#09090B] font-extrabold text-[10px] tracking-wider px-1.5 py-0.5 rounded">
                          TMDB
                        </span>
                        <span className="font-semibold text-white">{pick.displayRating}</span>
                      </span>

                      {pick.displayYear && (
                        <span className="text-white/50">• {pick.displayYear}</span>
                      )}
                    </div>

                    <h4 className="font-display text-2xl sm:text-4xl font-bold text-white tracking-tight leading-[1.06] mb-3">
                      {pick.displayTitle}
                    </h4>

                    <p className="text-sm text-white/70 leading-relaxed line-clamp-4">
                      {pick.overview ||
                        'Um título altamente avaliado pelo público que vale a pena conferir hoje.'}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap items-center gap-2.5 mt-6">
                    <button
                      type="button"
                      onClick={handleGoToDetails}
                      className="inline-flex items-center justify-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-black/40 transition-all"
                    >
                      <span>Ver Detalhes</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setTrailerOpen(true)}
                      className="inline-flex items-center justify-center gap-2 bg-white/[0.09] hover:bg-white/[0.16] backdrop-blur-xl text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-white/[0.15] transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Trailer
                    </button>

                    <button
                      type="button"
                      onClick={handleFavorite}
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                        favorited
                          ? 'bg-white border-white text-[#09090B]'
                          : 'bg-white/[0.06] hover:bg-white/[0.14] border-white/[0.12] text-white/80 hover:text-white'
                      }`}
                      aria-label={favorited ? 'Remover da Minha Lista' : 'Salvar na Minha Lista'}
                      title={favorited ? 'Remover da Minha Lista' : 'Salvar na Minha Lista'}
                    >
                      <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-sm text-white/50">
                Não encontramos um título com essa combinação agora. Tente outro clima!
              </div>
            )}

            {/* Rodapé interativo: Alternativas rápidas + Botão Sortear Outro */}
            <div className="pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {alternatives.length > 0 ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 flex-shrink-0">
                    A seguir
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                    {alternatives.slice(0, 4).map((alt) => (
                      <button
                        key={`alt-${alt.media_type}-${alt.id}`}
                        type="button"
                        onClick={() => handleSelectAlternative(alt)}
                        title={alt.displayTitle}
                        className="w-9 h-12 rounded-lg overflow-hidden bg-white/[0.06] border border-white/[0.12] hover:border-white/50 hover:scale-105 transition-all flex-shrink-0"
                      >
                        {alt.poster_path ? (
                          <img
                            src={getPosterUrl(alt.poster_path, 'w92')}
                            alt={alt.displayTitle}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30">
                            <Film className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-xs text-white/40 inline-flex items-center gap-1.5">
                  <Dices className="w-3.5 h-3.5 text-white/50" />
                  Novo lote pronto para sortear
                </span>
              )}

              <button
                type="button"
                onClick={handleRollNext}
                disabled={spinning}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.14] text-white font-medium text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50 flex-shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
                {spinning ? 'Sorteando...' : 'Sortear Outra Opção'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {pick && (
        <TrailerModal
          isOpen={trailerOpen}
          onClose={() => setTrailerOpen(false)}
          mediaId={pick.id}
          mediaType={pick.media_type}
          title={pick.displayTitle}
        />
      )}
    </>
  );
}
