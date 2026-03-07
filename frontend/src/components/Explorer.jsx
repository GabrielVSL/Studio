import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import MovieCard from './MovieCard';
import { searchSeries, getGenres, discoverSeries } from '../services/api';

const genreIcons = {
  10759: "fas fa-user-ninja", 16: "fas fa-ghost", 35: "fas fa-laugh-squint", 80: "fas fa-mask", 99: "fas fa-video", 18: "fas fa-sad-tear", 10751: "fas fa-users", 10762: "fas fa-child", 9648: "fas fa-search", 10765: "fas fa-dragon", 10766: "fas fa-heart", 10767: "fas fa-comments", 10768: "fas fa-flag", 37: "fas fa-hat-cowboy",
};

export default function Explorer() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  
  const [genres, setGenres] = useState([]);
  const [activeGenre, setActiveGenre] = useState(null);
  
  const [year, setYear] = useState('');
  const [rating, setRating] = useState(0); 
  const [sort, setSort] = useState('popularity.desc');
  
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const carouselRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Estados e Refs para o Dropdown Customizado de Ordenação
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef(null);

  const sortOptions = [
    { value: 'popularity.desc', label: 'Mais Populares' },
    { value: 'vote_average.desc', label: 'Melhores Avaliados' },
    { value: 'first_air_date.desc', label: 'Mais Recentes' }
  ];

  // Fecha o dropdown de ordenação se clicar fora dele
  useEffect(() => {
    function handleClickOutside(event) {
      if (sortRef.current && !sortRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMouseDown = (e) => { setIsDragging(true); setStartX(e.pageX - carouselRef.current.offsetLeft); setScrollLeft(carouselRef.current.scrollLeft); };
  const handleMouseLeaveOrUp = () => setIsDragging(false);
  const handleMouseMove = (e) => { if (!isDragging) return; e.preventDefault(); const x = e.pageX - carouselRef.current.offsetLeft; carouselRef.current.scrollLeft = scrollLeft - (x - startX) * 2; };

  useEffect(() => { const loadGenres = async () => setGenres(await getGenres()); loadGenres(); }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true); setPage(1);
      if (query) { 
        setActiveGenre(null); 
        setResults(await searchSeries(query)); 
      } else { 
        const finalRating = rating > 0 ? rating : '';
        setResults(await discoverSeries(activeGenre, 1, year, finalRating, sort)); 
      }
      setLoading(false);
    };
    window.scrollTo(0, 0); 
    fetchInitialData();
  }, [query, activeGenre, year, rating, sort]);

  const handleLoadMore = async () => {
    if (query) return;
    setLoadingMore(true); const nextPage = page + 1;
    const finalRating = rating > 0 ? rating : '';
    const newMovies = await discoverSeries(activeGenre, nextPage, year, finalRating, sort);
    setResults((prev) => [...prev, ...newMovies]); setPage(nextPage); setLoadingMore(false);
  };

  const clearFilters = () => { setYear(''); setRating(0); setSort('popularity.desc'); setActiveGenre(null); setIsSortOpen(false); };

  // Pega o texto do filtro de ordenação selecionado atualmente
  const currentSortLabel = sortOptions.find(opt => opt.value === sort)?.label;

  return (
    <main className="min-h-screen bg-slate-950 pt-24 pb-20 px-4 lg:px-8">
      <div className="container mx-auto">
        
        <div className="flex items-center gap-3 mb-10">
          <div className="w-2 h-10 bg-yellow-400 rounded-full"></div>
          <h2 className="text-3xl md:text-5xl font-black text-white">
            {query ? `Resultados para: "${query}"` : 'Explorar Catálogo'}
          </h2>
        </div>

        {!query && (
          <div className="space-y-6 mb-12">
            
            {/* CARROSSEL DE CATEGORIAS */}
            <div 
              ref={carouselRef}
              onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeaveOrUp} onMouseUp={handleMouseLeaveOrUp} onMouseMove={handleMouseMove}
              className={`flex overflow-x-auto gap-4 pb-4 hide-scrollbar pt-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              <button 
                onClick={() => setActiveGenre(null)}
                className={`flex-shrink-0 w-28 h-28 md:w-32 md:h-32 rounded-3xl flex flex-col items-center justify-center gap-3 font-bold transition-all border-2 ${activeGenre === null ? 'bg-yellow-400 border-yellow-400 text-slate-950 scale-105 shadow-[0_0_20px_rgba(250,204,21,0.3)]' : 'bg-slate-900 border-white/5 text-gray-400 hover:border-yellow-400/50 hover:text-white'}`}
              >
                <i className="fas fa-fire text-3xl"></i>
                <span className="text-sm text-center">Todos</span>
              </button>
              
              {genres.map((g) => (
                <button 
                  key={g.id}
                  onClick={() => setActiveGenre(g.id)}
                  className={`flex-shrink-0 w-28 h-28 md:w-32 md:h-32 rounded-3xl flex flex-col items-center justify-center gap-3 font-bold transition-all border-2 ${activeGenre === g.id ? 'bg-yellow-400 border-yellow-400 text-slate-950 scale-105 shadow-[0_0_20px_rgba(250,204,21,0.3)]' : 'bg-slate-900 border-white/5 text-gray-400 hover:border-yellow-400/50 hover:text-white'}`}
                >
                  <i className={`${genreIcons[g.id] || 'fas fa-film'} text-3xl`}></i>
                  <span className="text-sm text-center px-2 line-clamp-2 leading-tight">{g.name}</span>
                </button>
              ))}
            </div>

            {/* BARRA DE FILTROS ALINHADA */}
            <div className="relative z-40 flex flex-col xl:flex-row items-start xl:items-end gap-6 bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl">
              
              <div className="flex items-center gap-2 mb-2 xl:mb-0 xl:pb-3">
                <i className="fas fa-sliders-h text-yellow-400 text-xl"></i>
                <span className="text-white font-bold uppercase tracking-wider">Filtros</span>
              </div>
              
              <div className="flex flex-wrap md:flex-nowrap items-end gap-4 w-full flex-1">
                
                {/* 1. INPUT DE ANO */}
                <div className="flex flex-col gap-2 w-full md:w-32 flex-shrink-0">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-widest ml-1">Ano</label>
                  <input 
                    type="number" 
                    placeholder="Ex: 2015"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    min="1950"
                    max={new Date().getFullYear() + 1}
                    className="bg-slate-800 text-white font-bold border border-white/10 rounded-xl px-4 py-3 w-full hover:border-yellow-400 focus:border-yellow-400 outline-none transition-all shadow-inner placeholder-gray-500"
                  />
                </div>

                {/* 2. SLIDER DE NOTA MÍNIMA */}
                <div className="flex flex-col gap-2 flex-1 min-w-[200px] w-full mb-1">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs text-gray-400 font-bold uppercase tracking-widest">Nota Mínima</label>
                    <span className={`text-sm font-black transition-colors ${rating > 0 ? 'text-yellow-400' : 'text-gray-500'}`}>
                      {rating > 0 ? `+ ${rating} Estrelas` : 'Qualquer Nota'}
                    </span>
                  </div>
                  <input 
                    type="range" min="0" max="10" step="0.5" value={rating} onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full h-3 mt-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-yellow-400 hover:accent-yellow-300 transition-all"
                  />
                </div>

                {/* 3. ORDENAÇÃO (DROPDOWN CUSTOMIZADO) */}
                <div className="flex flex-col gap-2 w-full md:w-56 flex-shrink-0" ref={sortRef}>
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-widest ml-1">Organizar por</label>
                  <div className="relative">
                    {/* Botão Principal do Dropdown */}
                    <button 
                      type="button"
                      onClick={() => setIsSortOpen(!isSortOpen)}
                      className="w-full bg-slate-800 text-white font-bold border border-white/10 rounded-xl px-4 py-3 flex justify-between items-center hover:border-yellow-400 focus:border-yellow-400 outline-none transition-all shadow-inner"
                    >
                      <span className="truncate">{currentSortLabel}</span>
                      <i className={`fas fa-chevron-down text-gray-400 transition-transform duration-300 ${isSortOpen ? 'rotate-180 text-yellow-400' : ''}`}></i>
                    </button>

                    {/* Menu Flutuante (Opciones) */}
                    {isSortOpen && (
                      <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden py-2 animate-fade-in origin-top">
                        {sortOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSort(option.value);
                              setIsSortOpen(false); // Fecha ao escolher
                            }}
                            className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${sort === option.value ? 'bg-yellow-400/10 text-yellow-400 border-l-2 border-yellow-400' : 'text-white hover:bg-slate-700 hover:text-yellow-400'}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Botão de Limpar Filtros */}
              {(year || rating > 0 || sort !== 'popularity.desc' || activeGenre) && (
                <button onClick={clearFilters} className="w-full xl:w-auto flex-shrink-0 justify-center text-sm font-bold text-slate-950 bg-yellow-400 hover:bg-yellow-300 px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(250,204,21,0.4)] mt-4 xl:mt-0">
                  <i className="fas fa-eraser"></i> Limpar Tudo
                </button>
              )}
            </div>
          </div>
        )}

        {/* GRADE DE RESULTADOS */}
        {loading ? (
          <div className="flex justify-center mt-32 text-yellow-400 text-5xl">
            <i className="fas fa-circle-notch fa-spin"></i>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 lg:gap-8">
              {results.map((item, index) => (
                <MovieCard key={`${item.id}-${index}`} id={item.id} title={item.title || item.name} image={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "https://via.placeholder.com/500x750?text=Sem+Imagem"} rating={item.vote_average ? item.vote_average.toFixed(1) : "N/A"} />
              ))}
            </div>
            
            {!query && (
              <div className="flex justify-center mt-16">
                <button onClick={handleLoadMore} disabled={loadingMore} className="bg-slate-800 hover:bg-slate-700 text-white border-2 border-slate-700 hover:border-yellow-400 font-bold py-4 px-12 rounded-full transition-all flex items-center gap-3 shadow-xl disabled:opacity-50">
                  {loadingMore ? <><i className="fas fa-circle-notch fa-spin"></i> Carregando...</> : <><i className="fas fa-plus"></i> Carregar Mais Séries</>}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-400 mt-32 bg-slate-900/50 p-12 rounded-3xl border border-white/5 max-w-2xl mx-auto">
            <i className="fas fa-ticket-alt text-7xl mb-6 text-slate-700"></i>
            <h3 className="text-3xl font-bold mb-3 text-white">Nenhuma série encontrada</h3>
            <p className="text-lg">Tente abaixar a nota mínima ou remover o filtro de ano para ver mais resultados.</p>
          </div>
        )}
      </div>
    </main>
  );
}