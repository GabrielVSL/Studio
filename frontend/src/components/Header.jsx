import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchSeries } from '../services/api';

export default function Header() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  // Efeito de Debounce (Atraso inteligente)
  useEffect(() => {
    // Se a barra estiver vazia, limpa os resultados
    if (query.trim() === '') {
      setResults([]);
      return;
    }

    // Só chama a API 500 milissegundos DEPOIS que o usuário parar de digitar
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      const data = await searchSeries(query);
      // Pega apenas os 5 primeiros resultados para não criar um menu gigante
      setResults(data.slice(0, 5));
      setIsSearching(false);
    }, 500);

    // Se ele voltar a digitar antes de 500ms, cancela o timer anterior
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Fecha o menu de busca se clicar fora dele
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setQuery(''); // Limpa a busca ao clicar fora, fechando o menu
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Quando clica em um resultado, limpa a barra e vai para a página da série
  const handleSelectResult = (id) => {
    setQuery('');
    setResults([]);
    navigate(`/series/${id}`);
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/10 shadow-lg">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-4">
        
        {/* LOGO E MENU ESQUERDA */}
        <div className="flex items-center gap-8">
          <Link to="/" className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200">
            BHFlix
          </Link>
          <nav className="hidden md:flex items-center gap-6 font-bold text-sm">
            <Link to="/" className="text-gray-300 hover:text-yellow-400 transition-colors">Início</Link>
            <Link to="/explorar" className="text-gray-300 hover:text-yellow-400 transition-colors">Explorar</Link>
            <Link to="/minha-lista" className="text-gray-300 hover:text-yellow-400 transition-colors">Minha Lista</Link>
          </nav>
        </div>

        {/* BARRA DE PESQUISA (LIVE SEARCH) */}
        <div className="relative flex-1 max-w-sm" ref={searchRef}>
          <div className="relative group">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-yellow-400 transition-colors z-10"></i>
            <input 
              type="text" 
              placeholder="Buscar séries..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 text-white placeholder-gray-500 rounded-full pl-11 pr-4 py-2.5 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all shadow-inner relative z-10"
            />
            
            {/* Ícone de Carregando dentro do Input */}
            {isSearching && (
              <i className="fas fa-circle-notch fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-yellow-400 z-10"></i>
            )}
          </div>

          {/* MENU FLUTUANTE DE RESULTADOS */}
          {query.length > 0 && results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
              {results.map((series) => (
                <button
                  key={series.id}
                  onClick={() => handleSelectResult(series.id)}
                  className="w-full text-left flex items-center gap-3 p-3 hover:bg-slate-700 transition-colors border-b border-white/5 last:border-0 group"
                >
                  <img 
                    src={series.poster_path ? `https://image.tmdb.org/t/p/w92${series.poster_path}` : "https://via.placeholder.com/92x138"} 
                    alt={series.name}
                    className="w-10 h-14 object-cover rounded-md shadow-sm"
                  />
                  <div className="flex-1 overflow-hidden">
                    <h4 className="text-sm font-bold text-white group-hover:text-yellow-400 truncate">{series.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{series.first_air_date ? new Date(series.first_air_date).getFullYear() : ""}</span>
                      <span className="text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded font-bold">
                        <i className="fas fa-star mr-1"></i>
                        {series.vote_average ? series.vote_average.toFixed(1) : "N/A"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* MENSAGEM: NENHUM RESULTADO */}
          {query.length > 0 && results.length === 0 && !isSearching && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in text-center text-sm text-gray-400">
              Nenhuma série encontrada para "{query}"
            </div>
          )}
        </div>

      </div>
    </header>
  );
}