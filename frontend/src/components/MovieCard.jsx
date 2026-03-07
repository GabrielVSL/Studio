import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { isFavorite, toggleFavorite } from '../utils/storage';

export default function MovieCard({ id, title, image, rating }) {
  const [favorited, setFavorited] = useState(false);

  // Assim que o card aparece, ele olha no navegador se já foi favoritado antes
  useEffect(() => {
    setFavorited(isFavorite(id));
  }, [id]);

  // Função disparada ao clicar no coração
  const handleFavoriteClick = (e) => {
    e.preventDefault(); // Impede que o clique no coração abra a página de detalhes!
    const newState = toggleFavorite({ id, title, image, rating });
    setFavorited(newState);
  };

  return (
    <Link to={`/series/${id}`} className="block relative group overflow-hidden rounded-2xl bg-slate-900 border border-white/5 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-yellow-400/20 hover:border-yellow-400/50">
      
      {/* BOTÃO DE CORAÇÃO NO CANTO DIREITO */}
      <button 
        onClick={handleFavoriteClick}
        className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-slate-950/60 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-slate-900 hover:scale-110 border border-white/10"
      >
        <i className={`text-xl transition-colors ${favorited ? 'fas fa-heart text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'far fa-heart text-white hover:text-red-400'}`}></i>
      </button>

      {/* IMAGEM DO FILME */}
      <div className="aspect-[2/3] w-full overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-90 group-hover:opacity-100"
          loading="lazy"
        />
        {/* Degradê escuro na parte de baixo para o texto aparecer bem */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
      </div>

      {/* TEXTOS (Nota e Título) */}
      <div className="absolute bottom-0 w-full p-4 flex flex-col justify-end">
        <div className="flex items-center gap-1.5 mb-1.5 bg-slate-950/80 w-max px-2 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
          <i className="fas fa-star text-yellow-400 text-xs"></i>
          <span className="text-white text-xs font-bold">{rating}</span>
        </div>
        <h3 className="text-white font-bold text-sm md:text-base line-clamp-2 leading-tight group-hover:text-yellow-400 transition-colors">
          {title}
        </h3>
      </div>
    </Link>
  );
}