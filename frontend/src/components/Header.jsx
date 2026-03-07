import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Header() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

const handleSearch = (e) => {
    e.preventDefault(); // Impede a página de recarregar
    if (search.trim()) {
      // Redireciona para /explorer?q=NomedoFilme
      navigate(`/explorer?q=${encodeURIComponent(search)}`);
      setSearch(''); // Limpa a barra
    }
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/10 transition-all duration-300">
      <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 group text-white no-underline">
            <i className="fas fa-play text-yellow-400 text-xl group-hover:scale-110 transition-transform"></i>
            <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
              BHFlix
            </h1>
          </Link>
          
          {/* Navegação Desktop */}
          <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-300">
            <Link to="/" className="hover:text-white transition-colors">Início</Link>
            <Link to="/explorer" className="hover:text-white transition-colors">Explorar</Link>
            <Link to="/minha-lista" className="hover:text-white transition-colors">Minha Lista</Link>
          </nav>
        </div>

        {/* Barra de Pesquisa */}
        <form onSubmit={handleSearch} className="flex items-center bg-slate-900/50 border border-white/10 rounded-full px-4 py-1.5 focus-within:border-yellow-400 focus-within:bg-slate-900 transition-all">
          <i className="fas fa-search text-gray-400 text-sm"></i>
          <input 
            type="text" 
            placeholder="Buscar séries..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm w-32 md:w-56 ml-3 placeholder-gray-500"
          />
        </form>

      </div>
    </header>
  );
}