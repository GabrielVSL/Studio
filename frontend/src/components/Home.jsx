import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MovieCard from './MovieCard';
import { getPopularSeries, getNewSeries } from '../services/api';

export default function Home() {
  const [popularMovies, setPopularMovies] = useState([]);
  const [newSeries, setNewSeries] = useState([]);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [loading, setLoading] = useState(true); // Novo estado de carregamento

  useEffect(() => {
    const loadData = async () => {
      setLoading(true); // Começa carregando
      setPopularMovies(await getPopularSeries());
      setNewSeries(await getNewSeries());
      setLoading(false); // Carregamento finalizado
    };
    loadData();
  }, []);

  const heroMovies = popularMovies.slice(0, 5);
  const gridMovies = popularMovies.slice(5, 20); 
  const gridNew = newSeries.slice(0, 15);

  useEffect(() => {
    if (heroMovies.length === 0 || isHovered) return;
    
    const interval = setInterval(() => {
      setCurrentHeroIndex((prevIndex) => (prevIndex + 1) % heroMovies.length);
    }, 8000); 
    
    return () => clearInterval(interval);
  }, [heroMovies, isHovered]);

  const nextSlide = () => setCurrentHeroIndex((prev) => (prev + 1) % heroMovies.length);
  const prevSlide = () => setCurrentHeroIndex((prev) => (prev === 0 ? heroMovies.length - 1 : prev - 1));

  // Spinner de carregamento para uma experiência profissional
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-yellow-400">
        <i className="fas fa-spinner fa-spin text-5xl"></i>
        <p className="text-gray-400 font-bold text-lg tracking-widest animate-pulse">DevFlix Carregando...</p>
      </div>
    );
  }

  const activeHero = heroMovies[currentHeroIndex];

  return (
    <main className="min-h-screen bg-slate-950 pb-20 overflow-hidden">
      
      {/* HERO SECTION - Agora com Cross-Fade */}
      <section 
        className="relative w-full h-[75vh] md:h-[80vh] min-h-[550px] flex items-center justify-start overflow-hidden bg-black group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Renderiza as 5 imagens de uma vez para Cross-Fade */}
        {heroMovies.map((movie, index) => (
          <div 
            key={movie.id} 
            // Controla a opacidade com base no índice ativo. z-10 garante que o texto fique na frente.
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentHeroIndex ? 'opacity-100 z-0' : 'opacity-0 z-0'}`}
          >
            <img 
              src={`https://image.tmdb.org/t/p/original${movie.backdrop_path || movie.poster_path}`} 
              alt={movie.name} 
              // Mantivemos a animação de zoom lento
              className={`w-full h-full object-cover object-center md:object-top opacity-50 md:opacity-60 transition-transform duration-[8000ms] ease-out ${index === currentHeroIndex ? 'scale-100' : 'scale-110'}`} 
            />
            {/* Degradês para leitura */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent"></div>
          </div>
        ))}

        {/* SETAS DE NAVEGAÇÃO DISCRETAS */}
        {heroMovies.length > 1 && (
          <>
            <button onClick={prevSlide} className="absolute left-2 md:left-8 z-20 text-white/30 hover:text-white p-2 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-125 hidden md:block">
              <i className="fas fa-chevron-left text-4xl drop-shadow-xl"></i>
            </button>
            <button onClick={nextSlide} className="absolute right-2 md:right-8 z-20 text-white/30 hover:text-white p-2 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-125 hidden md:block">
              <i className="fas fa-chevron-right text-4xl drop-shadow-xl"></i>
            </button>
          </>
        )}

        {/* CONTEÚDO PRINCIPAL (z-10 para ficar na frente de todas as imagens) */}
        {activeHero && (
          <div className="relative z-10 container mx-auto px-6 lg:px-20 pt-10">
            
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-yellow-400 text-slate-950 text-xs font-black px-2 py-1 rounded-sm uppercase tracking-wider">Top {currentHeroIndex + 1}</span>
              <span className="text-gray-300 text-sm font-semibold tracking-widest uppercase">Em Destaque</span>
            </div>
            
            <div className="min-h-[160px] md:min-h-[200px] mb-6 md:mb-8 flex flex-col justify-start">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 drop-shadow-2xl max-w-3xl leading-tight line-clamp-2">
                {activeHero.name || activeHero.title}
              </h1>
              <p className="text-gray-300 text-base md:text-lg max-w-2xl line-clamp-3 text-shadow-md leading-relaxed">
                {activeHero.overview || "Uma série incrível que você precisa assistir hoje mesmo. Descubra os mistérios e as aventuras que aguardam por você."}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button onClick={() => window.open(`https://www.youtube.com/results?search_query=Trailer+${activeHero.name || activeHero.title}`, '_blank')} className="w-full sm:w-auto justify-center bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold py-3 md:py-4 px-8 md:px-10 rounded-lg transition-colors flex items-center gap-3 text-lg shadow-lg shadow-yellow-400/20">
                <i className="fas fa-play"></i> Ver Trailer
              </button>
              <Link to={`/detalhes/${activeHero.id}`} className="w-full sm:w-auto justify-center bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-md font-bold py-3 md:py-4 px-8 md:px-10 rounded-lg transition-all flex items-center gap-3 text-lg">
                <i className="fas fa-info-circle"></i> Mais Detalhes
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* SEÇÕES EM GRADE (Manteve igual) */}
      <div className="container mx-auto px-4 lg:px-8 mt-16 space-y-16">
        
        {/* Mais Populares */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-8 md:h-10 bg-yellow-400 rounded-full"></div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white">Mais Populares</h2>
            </div>
            <Link to="/explorer?categoria=populares" className="flex items-center gap-2 text-sm md:text-base font-bold text-gray-400 hover:text-yellow-400 transition-colors">
              Ver tudo <i className="fas fa-chevron-right text-xs"></i>
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 lg:gap-8">
            {gridMovies.map((movie) => (
              <MovieCard 
                key={movie.id} id={movie.id} title={movie.title || movie.name}
                image={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "https://via.placeholder.com/500x750"}
                rating={movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}
              />
            ))}
          </div>
        </section>

        {/* Lançamentos */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-8 md:h-10 bg-yellow-400 rounded-full"></div>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white">Lançamentos</h2>
            </div>
            <Link to="/explorer?categoria=lancamentos" className="flex items-center gap-2 text-sm md:text-base font-bold text-gray-400 hover:text-yellow-400 transition-colors">
              Ver tudo <i className="fas fa-chevron-right text-xs"></i>
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 lg:gap-8">
            {gridNew.map((series) => (
              <MovieCard 
                key={series.id} id={series.id} title={series.title || series.name}
                image={series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : "https://via.placeholder.com/500x750"}
                rating={series.vote_average ? series.vote_average.toFixed(1) : "N/A"}
              />
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}