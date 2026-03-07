import React, { useState, useEffect } from 'react';
import MovieCard from './MovieCard';
import { getPopularSeries, getNewSeries } from '../services/api';

export default function Home() {
  const [popularMovies, setPopularMovies] = useState([]);
  const [newSeries, setNewSeries] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const popularData = await getPopularSeries();
      const newData = await getNewSeries();
      setPopularMovies(popularData);
      setNewSeries(newData);
    };
    loadData();
  }, []);

  // O primeiro filme popular será o nosso destaque principal (Hero)
  const heroMovie = popularMovies.length > 0 ? popularMovies[0] : null;
  // O restante vai para a grade normal
  const gridMovies = popularMovies.slice(1);

  return (
    <main className="min-h-screen bg-slate-950 pb-20">
      
      {/* HERO SECTION (Destaque Principal) */}
      {heroMovie && (
        <section className="relative w-full h-[70vh] flex items-center justify-start overflow-hidden">
          <div className="absolute inset-0">
            <img 
              src={`https://image.tmdb.org/t/p/original${heroMovie.backdrop_path || heroMovie.poster_path}`} 
              alt={heroMovie.name}
              className="w-full h-full object-cover opacity-50"
            />
            {/* Degradê para mesclar o banner com o fundo da página */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent"></div>
          </div>

          <div className="relative z-10 container mx-auto px-4 lg:px-8 pt-20">
            <h1 className="text-5xl md:text-7xl font-black text-white mb-4 drop-shadow-2xl max-w-2xl">
              {heroMovie.name || heroMovie.title}
            </h1>
            <p className="text-gray-300 text-lg max-w-xl mb-8 line-clamp-3 text-shadow-md">
              {heroMovie.overview || "Uma série incrível que você precisa assistir hoje mesmo. Descubra os mistérios e as aventuras que aguardam por você."}
            </p>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => window.open(`https://www.youtube.com/results?search_query=Trailer+${heroMovie.name || heroMovie.title}`, '_blank')}
                className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold py-3 px-8 rounded-lg transition-colors flex items-center gap-2"
              >
                <i className="fas fa-play"></i> Ver Trailer
              </button>
              <button className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm font-bold py-3 px-8 rounded-lg transition-colors flex items-center gap-2">
                <i className="fas fa-info-circle"></i> Mais Detalhes
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TRILHOS DE CONTEÚDO */}
      <div className="container mx-auto px-4 lg:px-8 mt-12 space-y-16">
        
        {/* Populares */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
            <h2 className="text-2xl font-bold text-white">Mais Populares</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {gridMovies.map((movie) => (
              <MovieCard 
                key={movie.id} id={movie.id} title={movie.title || movie.name}
                image={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "https://via.placeholder.com/500x750?text=Sem+Imagem"}
                rating={movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}
              />
            ))}
          </div>
        </section>

        {/* Lançamentos */}
        <section>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
            <h2 className="text-2xl font-bold text-white">Lançamentos</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {newSeries.map((series) => (
              <MovieCard 
                key={series.id} id={series.id} title={series.title || series.name}
                image={series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : "https://via.placeholder.com/500x750?text=Sem+Imagem"}
                rating={series.vote_average ? series.vote_average.toFixed(1) : "N/A"}
              />
            ))}
          </div>
        </section>

        {/* PERFIL DO ESTUDANTE (Modo Card Tech) */}
        <section className="pt-10 border-t border-white/10">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/5 rounded-2xl shadow-2xl p-8 max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8 group">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
              {/* Puxando a imagem direto do seu GitHub! */}
              <img 
                src="https://github.com/gabriellopes-tech.png" 
                alt="Gabriel Victor Souza Lopes" 
                className="relative w-40 h-40 rounded-full object-cover border-4 border-slate-800 shadow-xl"
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <span className="text-yellow-400 text-sm font-bold tracking-widest uppercase mb-1 block">Desenvolvedor</span>
              <h2 className="text-3xl font-black text-white mb-3">Gabriel Victor Souza Lopes</h2>
              <p className="text-gray-400 mb-6 text-lg leading-relaxed">
                Estudante de Engenharia de Software na PUC Minas, apaixonado por criar experiências digitais incríveis através do código.
              </p>
              <div className="flex items-center justify-center md:justify-start gap-4">
                <a href="https://github.com/gabriellopes-tech" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white hover:bg-yellow-400 hover:text-slate-900 transition-colors">
                  <i className="fab fa-github text-xl"></i>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white hover:bg-blue-500 hover:text-white transition-colors">
                  <i className="fab fa-linkedin-in text-xl"></i>
                </a>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}