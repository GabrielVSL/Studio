import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MovieCard from './MovieCard';
import { searchSeries, getPopularSeries } from '../services/api';

export default function Explorer() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q'); // Pega a palavra pesquisada na URL
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      if (query) {
        const data = await searchSeries(query); // Busca a pesquisa
        setResults(data);
      } else {
        const data = await getPopularSeries(); // Mostra populares se não tiver pesquisa
        setResults(data);
      }
      setLoading(false);
    };
    
    // Rola para o topo sempre que a pesquisa mudar
    window.scrollTo(0, 0);
    fetchResults();
  }, [query]);

  return (
    <main className="min-h-screen bg-slate-950 pt-24 pb-20 px-4 lg:px-8">
      <div className="container mx-auto">
        
        {/* Título dinâmico */}
        <h2 className="text-3xl font-bold text-white mb-8 border-l-4 border-yellow-400 pl-3">
          {query ? `Resultados para: "${query}"` : 'Explorar Catálogo'}
        </h2>
        
        {loading ? (
          <div className="flex justify-center mt-20 text-yellow-400 text-3xl">
            <i className="fas fa-spinner fa-spin"></i>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {results.map((item) => (
              <MovieCard 
                key={item.id} 
                id={item.id} 
                title={item.title || item.name}
                image={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "https://via.placeholder.com/500x750?text=Sem+Imagem"}
                rating={item.vote_average ? item.vote_average.toFixed(1) : "N/A"}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400 text-xl mt-20">
            <i className="fas fa-search-minus text-4xl mb-4"></i>
            <p>Nenhuma série encontrada. Tente outro nome!</p>
          </div>
        )}

      </div>
    </main>
  );
}