import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dices,
  X,
  Star,
  Play,
  Info,
  Heart,
  Sparkles,
  Film,
  Tv,
  RefreshCw,
} from 'lucide-react';
import { getSurprisePick, getPosterUrl } from '../services/api';
import { isFavorite, toggleFavorite } from '../utils/storage';
import { useToast } from '../utils/toast';
import TrailerModal from './TrailerModal';

const MOODS = [
  { id: 'any', label: 'Qualquer clima', movieGenre: '', tvGenre: '' },
  { id: 'action', label: 'Adrenalina', movieGenre: '28', tvGenre: '10759' },
  { id: 'comedy', label: 'Para Rir', movieGenre: '35', tvGenre: '35' },
  { id: 'drama', label: 'Drama Intenso', movieGenre: '18', tvGenre: '18' },
  { id: 'scifi', label: 'Ficção & Fantasia', movieGenre: '878', tvGenre: '10765' },
  { id: 'crime', label: 'Suspense & Crime', movieGenre: '80', tvGenre: '80' },
  { id: 'animation', label: 'Animação', movieGenre: '16', tvGenre: '16' },
];

export default function SurpriseModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mediaType, setMediaType] = useState('all');
  const [mood, setMood] = useState('any');
  const [spinning, setSpinning] = useState(false);
  const [pick, setPick] = useState(null);
  const [favorited, setFavorited] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !trailerOpen) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, trailerOpen]);

  useEffect(() => {
    if (pick) {
      setFavorited(isFavorite(pick.id, pick.media_type));
    }
  }, [pick]);

  const handleRoll = async (customType = mediaType, customMood = mood) => {
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
      new Promise((r) => setTimeout(r, 420)),
    ]);

    setPick(result.pick);
    setSpinning(false);
  };

  useEffect(() => {
    if (isOpen && !pick) {
      handleRoll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoToDetails = () => {
    if (!pick) return;
    const route = pick.media_type === 'movie' ? `/filme/${pick.id}` : `/serie/${pick.id}`;
    onClose();
    navigate(route);
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
        className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Roleta Surpreenda-me"
      >
        <div
          className="relative w-full max-w-2xl bg-[#0E0E12] border border-white/[0.12] rounded-2xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.9)] animate-scale-in max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-[#09090B] flex items-center justify-center shadow-lg">
                <Dices className={`w-5 h-5 ${spinning ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-medium text-white flex items-center gap-1.5">
                  Surpreenda-me
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>
                <p className="text-xs text-white/45">
                  Títulos aclamados (nota 7.4+) sorteados para hoje
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/[0.08] hover:bg-white/[0.16] text-white/80 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { value: 'all', label: 'Todos', icon: Sparkles },
                  { value: 'movie', label: 'Filmes', icon: Film },
                  { value: 'tv', label: 'Séries', icon: Tv },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = mediaType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setMediaType(opt.value);
                        handleRoll(opt.value, mood);
                      }}
                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        active
                          ? 'bg-white text-[#07080C] border-white'
                          : 'bg-white/[0.05] text-white/70 border-white/[0.1] hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMood(m.id);
                      handleRoll(mediaType, m.id);
                    }}
                    className={`px-3.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                      mood === m.id
                        ? 'bg-white text-[#09090B] border-white font-semibold'
                        : 'bg-white/[0.03] text-white/55 border-white/[0.08] hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {spinning ? (
              <div className="flex flex-col sm:flex-row gap-5 bg-white/[0.03] p-5 rounded-2xl border border-white/[0.06]">
                <div className="w-36 sm:w-44 aspect-[2/3] rounded-xl skeleton-shimmer mx-auto sm:mx-0 flex-shrink-0" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="h-5 w-24 rounded-full skeleton-shimmer" />
                  <div className="h-8 w-3/4 rounded-xl skeleton-shimmer" />
                  <div className="h-4 w-full rounded skeleton-shimmer" />
                  <div className="h-4 w-5/6 rounded skeleton-shimmer" />
                </div>
              </div>
            ) : pick ? (
              <div className="flex flex-col sm:flex-row gap-5 bg-white/[0.03] p-5 rounded-2xl border border-white/[0.08]">
                <div className="w-36 sm:w-44 aspect-[2/3] rounded-xl overflow-hidden bg-white/[0.05] mx-auto sm:mx-0 flex-shrink-0 shadow-xl border border-white/[0.1]">
                  {pick.poster_path ? (
                    <img
                      src={getPosterUrl(pick.poster_path)}
                      alt={pick.displayTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/25">
                      <Film className="w-10 h-10" />
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/[0.1] text-white font-medium">
                        {pick.media_type === 'movie' ? 'Filme' : 'Série'}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        {pick.displayRating}
                      </span>
                      {pick.displayYear && (
                        <span className="text-white/50">• {pick.displayYear}</span>
                      )}
                    </div>

                    <h4 className="text-2xl sm:text-3xl font-medium text-white tracking-tight leading-tight mb-2">
                      {pick.displayTitle}
                    </h4>

                    <p className="text-sm text-white/65 leading-relaxed line-clamp-4">
                      {pick.overview ||
                        'Um título altamente avaliado pelo público que vale a pena conferir hoje.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 mt-5">
                    <button
                      onClick={handleGoToDetails}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl transition-colors"
                    >
                      <Info className="w-4 h-4" />
                      Detalhes
                    </button>

                    <button
                      onClick={() => setTrailerOpen(true)}
                      className="inline-flex items-center justify-center gap-2 bg-white/[0.1] hover:bg-white/[0.18] text-white font-medium text-xs sm:text-sm px-4 py-2.5 rounded-xl border border-white/[0.14] transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Trailer
                    </button>

                    <button
                      onClick={handleFavorite}
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                        favorited
                          ? 'bg-white border-white text-[#09090B]'
                          : 'bg-white/[0.06] border-white/[0.12] text-white/75 hover:text-white'
                      }`}
                      title={favorited ? 'Remover da Minha Lista' : 'Salvar na Minha Lista'}
                    >
                      <Heart className={`w-4 h-4 ${favorited ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-white/50">
                Não foi possível sortear agora. Tente outro clima!
              </div>
            )}

            <button
              onClick={() => handleRoll()}
              disabled={spinning}
              className="w-full py-3 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.12] text-white font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-white ${spinning ? 'animate-spin' : ''}`} />
              {spinning ? 'Sorteando...' : 'Sortear Outra Opção'}
            </button>
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
