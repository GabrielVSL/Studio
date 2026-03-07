import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MovieCard from './MovieCard';
import { searchSeries, getGenres, discoverSeries } from '../services/api';

export default function Explorer() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q'); // Lê se a pessoa buscou algo na barra lá em cima
  
  const [genres, setGenres] = useState([]);
  const [activeGenre, setActiveGenre] = useState(null);
  
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // 1. Carrega as categorias (Gêneros) assim que a tela abre
  useEffect(() => {
    const loadGenres = async () => {
      const data = await getGenres();
      setGenres(data);
    };
    loadGenres();
  }, []);

  // 2. Busca inicial (Pesquisa de texto OU Filtro de Gênero)
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setPage(1); // Reseta a página sempre que mudar de filtro
      
      if (query) {
        // Se a pessoa digitou algo, ignoramos o filtro e fazemos a busca por texto
        setActiveGenre(null); 
        const data = await searchSeries(query);
        setResults(data);
      } else {
        // Se não tem texto, buscamos pelo gênero ativo (ou os populares se for null)
        const data = await discoverSeries(activeGenre, 1);
        setResults(data);
      }
      setLoading(false);
    };
    
    window.scrollTo(0, 0); // Joga pro topo
    fetchInitialData();
  }, [query, activeGenre]);

  // 3. Função do botão "Carregar Mais Filmes"
  const handleLoadMore = async () => {
    if (query) return; // Não fazemos paginação complexa para busca de texto neste momento
    
    setLoadingMore(true);
    const nextPage = page + 1;
    const newMovies = await discoverSeries(activeGenre, nextPage);
    
    // Junta os filmes antigos com os novos que acabaram de chegar
    setResults((prevResults) => [...prevResults, ...newMovies]);
    setPage(nextPage);
    setLoadingMore(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 pt-24 pb-20 px-4 lg:px-8">
      <div className="container mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <h2 className="text-3xl md:text-4xl font-black text-white border-l-4 border-yellow-400 pl-4">
            {query ? `Resultados para: "${query}"` : 'Explorar Catálogo'}
          </h2>
        </div>

        {/* BARRA DE FILTROS POR GÊNERO (Só aparece se não for uma pesquisa de texto) */}
        {!query && (
          <div className="mb-10">
            <div className="flex overflow-x-auto gap-3 pb-4 snap-x hide-scrollbar">
              <button 
                onClick={() => setActiveGenre(null)}
                className={`flex-shrink-0 snap-start px-6 py-2 rounded-full font-bold transition-colors ${activeGenre === null ? 'bg-yellow-400 text-slate-950' : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white'}`}
              >
                Tudo (Populares)
              </button>
              
              {genres.map((g) => (
                <button 
                  key={g.id}
                  onClick={() => setActiveGenre(g.id)}
                  className={`flex-shrink-0 snap-start px-6 py-2 rounded-full font-bold transition-colors ${activeGenre === g.id ? 'bg-yellow-400 text-slate-950' : 'bg-slate-800 text-gray-300 hover:bg-slate-700 hover:text-white'}`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GRADE DE RESULTADOS */}
        {loading ? (
          <div className="flex justify-center mt-20 text-yellow-400 text-5xl">
            <i className="fas fa-spinner fa-spin"></i>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
              {results.map((item, index) => (
                // O index junto com ID garante que não quebre se a API mandar algum filme duplicado de uma página pra outra
                <MovieCard 
                  key={`${item.id}-${index}`} 
                  id={item.id} 
                  title={item.title || item.name}
                  image={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "https://via.placeholder.com/500x750?text=Sem+Imagem"}
                  rating={item.vote_average ? item.vote_average.toFixed(1) : "N/A"}
                />
              ))}
            </div>
            
            {/* BOTÃO CARREGAR MAIS (Só aparece se não for pesquisa de texto) */}
            {!query && (
              <div className="flex justify-center mt-12">
                <button 
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="bg-slate-800 hover:bg-slate-700 text-white border border-white/10 font-bold py-3 px-10 rounded-full transition-all flex items-center gap-3 shadow-lg disabled:opacity-50"
                >
                  {loadingMore ? <><i className="fas fa-spinner fa-spin"></i> Carregando...</> : <><i className="fas fa-plus"></i> Carregar Mais</>}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-gray-400 mt-20">
            <i className="fas fa-film text-6xl mb-6 opacity-20"></i>
            <h3 className="text-2xl font-bold mb-2">Nada encontrado</h3>
            <p>Não achamos nenhuma série com esses critérios. Tente outra busca!</p>
          </div>
        )}

      </div>
    </main>
  );
}