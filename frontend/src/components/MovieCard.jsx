import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, Film } from 'lucide-react';
import { isFavorite, toggleFavorite } from '../utils/storage';
import { useToast } from '../utils/toast';

export default function MovieCard({
  id,
  title,
  image,
  rating,
  year = '',
  mediaType = 'tv',
  userRating = null,
}) {
  const [favorited, setFavorited] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const sync = () => setFavorited(isFavorite(id, mediaType));
    sync();
    window.addEventListener('bhflix:favorites-updated', sync);
    return () => window.removeEventListener('bhflix:favorites-updated', sync);
  }, [id, mediaType]);

  const handleFavoriteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleFavorite({ id, title, image, rating, year, mediaType });
    setFavorited(added);
    showToast(
      added ? `"${title}" salvo na Minha Lista` : `"${title}" removido da Minha Lista`,
      'heart'
    );
  };

  const targetUrl = mediaType === 'movie' ? `/filme/${id}` : `/serie/${id}`;

  return (
    <Link
      to={targetUrl}
      state={{
        heroPrefill: {
          id,
          media_type: mediaType,
          displayTitle: title,
          displayRating: rating,
          displayYear: year,
        },
      }}
      className="block relative group overflow-hidden rounded-2xl bg-[#111115] border border-white/[0.07] shadow-lg shadow-black/40 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/25 hover:shadow-[0_18px_40px_rgba(0,0,0,0.8)]"
    >
      {/* Botão Favorito minimalista (branco limpo quando salvo) */}
      <button
        onClick={handleFavoriteClick}
        aria-label={favorited ? 'Remover da Minha Lista' : 'Salvar na Minha Lista'}
        className={`absolute top-2.5 right-2.5 z-20 w-8 h-8 rounded-xl backdrop-blur-xl flex items-center justify-center transition-all duration-300 border ${
          favorited
            ? 'bg-white border-white text-[#09090B] opacity-100 scale-100'
            : 'bg-black/45 border-white/15 text-white/85 opacity-0 group-hover:opacity-100 hover:bg-black/75 hover:scale-110'
        }`}
      >
        <Heart className={`w-3.5 h-3.5 ${favorited ? 'fill-current' : ''}`} />
      </button>

      {/* Poster Limpo */}
      <div className="aspect-[2/3] w-full overflow-hidden bg-white/[0.03] relative">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/25 gap-2 p-4 text-center">
            <Film className="w-9 h-9" />
            <span className="text-xs font-medium text-white/45 line-clamp-2">{title}</span>
          </div>
        )}

        {/* Vinheta suave apenas na base */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080C] via-[#07080C]/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />
      </div>

      {/* Informações Minimalistas na Base */}
      <div className="absolute bottom-0 inset-x-0 p-3.5 flex flex-col justify-end">
        <div className="flex items-center justify-between gap-2 mb-1 text-[11px]">
          <span className="inline-flex items-center gap-1 font-semibold text-white/90">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            {rating}
          </span>

          {userRating ? (
            <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-400/30 px-1.5 py-0.5 rounded-full">
              Sua {userRating}★
            </span>
          ) : year ? (
            <span className="text-white/55 font-medium">{year}</span>
          ) : null}
        </div>

        <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {title}
        </h3>
      </div>
    </Link>
  );
}
