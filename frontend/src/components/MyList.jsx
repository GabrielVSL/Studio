import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Film, Tv, Compass, Sparkles } from 'lucide-react';
import MovieCard from './MovieCard';
import { getFavorites, getAllUserReviews } from '../utils/storage';

export default function MyList() {
  const [favorites, setFavorites] = useState([]);
  const [reviews, setReviews] = useState({});
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = () => {
      setFavorites(getFavorites());
      setReviews(getAllUserReviews());
    };
    load();
    window.scrollTo(0, 0);
    window.addEventListener('bhflix:favorites-updated', load);
    return () => window.removeEventListener('bhflix:favorites-updated', load);
  }, []);

  const filtered =
    filter === 'all'
      ? favorites
      : favorites.filter((item) => (item.mediaType || 'tv') === filter);

  const moviesCount = favorites.filter((f) => f.mediaType === 'movie').length;
  const tvCount = favorites.filter((f) => (f.mediaType || 'tv') === 'tv').length;

  return (
    <main className="min-h-screen bg-[#09090B] pt-28 pb-20 px-5 sm:px-8 lg:px-14">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-white/[0.07]">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/40 mb-1.5">
              Sua curadoria
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
              Minha Lista
            </h1>
            <p className="text-sm text-white/45 mt-2">
              {favorites.length === 0
                ? 'Salve filmes e séries para assistir depois'
                : `${favorites.length} ${favorites.length === 1 ? 'título salvo' : 'títulos salvos'}`}
            </p>
          </div>

          {favorites.length > 0 && (
            <div className="inline-flex p-1 bg-white/[0.05] border border-white/[0.1] rounded-xl self-start">
              {[
                { value: 'all', label: `Todos (${favorites.length})`, icon: Sparkles },
                { value: 'movie', label: `Filmes (${moviesCount})`, icon: Film },
                { value: 'tv', label: `Séries (${tvCount})`, icon: Tv },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = filter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setFilter(tab.value)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                      active
                        ? 'bg-white text-[#09090B] font-semibold'
                        : 'text-white/65 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
            {filtered.map((item) => {
              const mType = item.mediaType || 'tv';
              const userRev = reviews[`${mType}_${item.id}`];
              return (
                <MovieCard
                  key={`${mType}-${item.id}`}
                  id={item.id}
                  title={item.title}
                  image={item.image}
                  rating={item.rating}
                  year={item.year}
                  mediaType={mType}
                  userRating={userRev?.rating || null}
                />
              );
            })}
          </div>
        ) : favorites.length > 0 ? (
          <div className="text-center text-white/55 mt-16 bg-white/[0.02] p-10 rounded-3xl border border-white/[0.07] max-w-xl mx-auto">
            <h3 className="text-lg font-bold text-white mb-2">
              Nenhum item nesta categoria
            </h3>
            <p className="text-sm mb-5">
              Você ainda não salvou {filter === 'movie' ? 'filmes' : 'séries'} na sua lista.
            </p>
            <Link
              to={`/explorar?tipo=${filter}`}
              className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Compass className="w-4 h-4" />
              Explorar {filter === 'movie' ? 'Filmes' : 'Séries'}
            </Link>
          </div>
        ) : (
          <div className="text-center text-white/55 mt-16 bg-white/[0.02] p-12 rounded-3xl border border-white/[0.07] max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.05] mx-auto mb-5 flex items-center justify-center">
              <Heart className="w-8 h-8 text-white/25" />
            </div>
            <h3 className="text-2xl font-medium mb-2 text-white">Sua lista está vazia</h3>
            <p className="text-sm text-white/50 mb-7 max-w-sm mx-auto">
              Explore o catálogo e clique no coração nos filmes ou séries que deseja guardar.
            </p>
            <Link
              to="/explorar"
              className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-[#09090B] font-semibold px-7 py-3 rounded-xl text-sm transition-all"
            >
              <Compass className="w-4 h-4" />
              Explorar Catálogo
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
