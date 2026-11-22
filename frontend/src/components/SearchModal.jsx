import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Loader2,
  Star,
  Film,
  Tv,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { searchMedia, getPosterUrl } from '../services/api';

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Foca no input e bloqueia scroll ao abrir
  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 40);
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Busca com debounce
  useEffect(() => {
    if (!isOpen || query.trim() === '') return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const data = await searchMedia(query, 'multi');
      setResults(data.slice(0, 8));
      setIsSearching(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setQuery('');
    setResults([]);
    onClose();
  };

  const handleSelect = (item) => {
    const target = item.media_type === 'movie' ? `/filme/${item.id}` : `/serie/${item.id}`;
    handleClose();
    navigate(target);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    const q = query.trim();
    handleClose();
    navigate(`/explorar?q=${encodeURIComponent(q)}`);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[10vh] px-4 bg-black/80 backdrop-blur-xl animate-fade-in"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Buscar no studio"
    >
      <div
        className="w-full max-w-2xl bg-[#0D0F16]/98 border border-white/[0.12] rounded-3xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.9)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Campo de busca */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]"
        >
          <Search className="w-5 h-5 text-white/50 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              if (next.trim() === '') setResults([]);
            }}
            placeholder="Buscar filmes, séries, animes..."
            className="flex-1 bg-transparent text-white placeholder-white/40 text-base sm:text-lg font-medium focus:outline-none"
          />

          {isSearching ? (
            <Loader2 className="w-5 h-5 text-white animate-spin flex-shrink-0" />
          ) : (
            query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  inputRef.current?.focus();
                }}
                className="text-white/45 hover:text-white p-1 transition-colors"
                aria-label="Limpar texto"
              >
                <X className="w-4 h-4" />
              </button>
            )
          )}

          <button
            type="button"
            onClick={handleClose}
            className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.1] text-[11px] font-medium text-white/50 hover:text-white transition-colors"
          >
            ESC
          </button>
        </form>

        {/* Resultados */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {query.trim() === '' ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-white/[0.05] text-white/35 flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-white/70">
                Digite o nome de qualquer filme ou série
              </p>
              <p className="text-xs text-white/40">
                Pressione <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-white/70">Enter</kbd> para abrir a busca completa no Explorador
              </p>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="divide-y divide-white/[0.06]">
                {results.map((item) => (
                  <button
                    key={`${item.media_type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="w-full text-left flex items-center gap-4 px-5 py-3 hover:bg-white/[0.05] transition-colors group"
                  >
                    <div className="w-11 h-16 rounded-xl overflow-hidden bg-white/[0.05] flex-shrink-0 border border-white/[0.08]">
                      {item.poster_path ? (
                        <img
                          src={getPosterUrl(item.poster_path, 'w92')}
                          alt={item.displayTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/25">
                          <Film className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm sm:text-base font-medium text-white group-hover:text-white truncate transition-colors">
                        {item.displayTitle}
                      </h4>
                      <div className="flex items-center gap-2.5 mt-1 text-xs text-white/50">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.07] text-white/80 text-[10px] font-medium uppercase">
                          {item.media_type === 'movie' ? (
                            <Film className="w-2.5 h-2.5" />
                          ) : (
                            <Tv className="w-2.5 h-2.5" />
                          )}
                          {item.media_type === 'movie' ? 'Filme' : 'Série'}
                        </span>
                        {item.displayYear && <span>{item.displayYear}</span>}
                        <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {item.displayRating}
                        </span>
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-white/25 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                ))}
              </div>

              <button
                onClick={handleSubmit}
                className="w-full px-5 py-3.5 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-white flex items-center justify-center gap-2 border-t border-white/[0.08] transition-colors"
              >
                Ver todos os resultados para "{query}"
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            !isSearching && (
              <div className="p-8 text-center text-sm text-white/50">
                Nenhum resultado encontrado para "<span className="text-white">{query}</span>"
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
