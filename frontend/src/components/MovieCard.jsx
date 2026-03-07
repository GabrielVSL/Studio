import React from 'react';
import { Link } from 'react-router-dom';

export default function MovieCard({ id, title, image, rating }) {
  return (
    // A mágica acontece aqui: tiramos os tamanhos fixos e colocamos "w-full"
    <Link to={`/detalhes/${id}`} className="group relative flex flex-col rounded-xl overflow-hidden cursor-pointer bg-slate-900 w-full aspect-[2/3] shadow-lg hover:shadow-yellow-400/20 transition-all duration-300 hover:-translate-y-2">
      
      <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-yellow-400 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
        <i className="fas fa-star"></i>
        <span>{rating}</span>
      </div>

      <div className="absolute bottom-0 left-0 w-full p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
        <h3 className="text-white text-sm md:text-base font-bold line-clamp-2 leading-tight">
          {title}
        </h3>
      </div>
    </Link>
  );
}