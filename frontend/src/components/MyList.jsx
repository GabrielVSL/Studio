import React, { useState, useEffect } from 'react';
import MovieCard from './MovieCard';
import { getFavorites } from '../utils/storage';

export default function MyList() {
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    // Pega as séries salvas no navegador assim que a tela abre
    setFavorites(getFavorites());
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 pt-24 pb-20 px-4 lg:px-8">
      <div className="container mx-auto">
        
        <div className="flex items-center gap-3 mb-10">
          <div className="w-2 h-10 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
          <h2 className="text-3xl md:text-5xl font-black text-white">Minha Lista</h2>
        </div>

        {favorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 lg:gap-8">
            {/* Desenha um Card para cada filme salvo no navegador */}
            {favorites.map((movie) => (
              <MovieCard 
                key={movie.id} 
                id={movie.id} 
                title={movie.title} 
                image={movie.image} 
                rating={movie.rating} 
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 mt-32 bg-slate-900/50 p-12 rounded-3xl border border-white/5 max-w-2xl mx-auto">
            <i className="far fa-heart text-7xl mb-6 text-slate-700"></i>
            <h3 className="text-3xl font-bold mb-3 text-white">Sua lista está vazia</h3>
            <p className="text-lg">Você ainda não favoritou nenhuma série. Vá para a aba Explorar e clique nos corações para salvar!</p>
          </div>
        )}
      </div>
    </main>
  );
}