import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSeriesDetails } from '../services/api';

export default function MovieDetails() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0); 
    const fetchDetails = async () => {
      setLoading(true);
      const data = await getSeriesDetails(id);
      setMovie(data);
      setLoading(false);
    };
    fetchDetails();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-yellow-400 text-3xl"><i className="fas fa-spinner fa-spin"></i></div>;
  }

  if (!movie) {
    return <div className="min-h-screen flex items-center justify-center text-white">Série não encontrada.</div>;
  }

  const backdropUrl = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '';
  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "https://via.placeholder.com/500x750?text=Sem+Imagem";

  // Lógica inteligente para achar o trailer oficial em português (ou pegar o primeiro vídeo disponível)
  const trailer = movie.videos?.results?.find(
    (vid) => vid.site === "YouTube" && vid.type === "Trailer"
  ) || movie.videos?.results?.[0]; // Fallback para qualquer vídeo se não tiver um "Trailer" exato

  // Pega apenas os 6 primeiros atores do elenco
  const castList = movie.credits?.cast?.slice(0, 6) || [];

  return (
    <main className="min-h-screen bg-slate-950 relative pb-20">
      
      {/* Imagem de Fundo (Backdrop) */}
      <div className="absolute top-0 w-full h-[60vh] md:h-[80vh] overflow-hidden">
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/50 z-10"></div>
        {backdropUrl && <img src={backdropUrl} alt="Background" className="w-full h-full object-cover opacity-30" />}
      </div>

      <div className="container mx-auto px-4 lg:px-8 pt-24 md:pt-40 relative z-20">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <i className="fas fa-arrow-left"></i> Voltar
        </Link>

        <div className="flex flex-col md:flex-row gap-8 lg:gap-16">
          
          {/* Poster Lateral */}
          <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0">
            <img 
              src={posterUrl} 
              alt={movie.name || movie.title} 
              className="w-full rounded-2xl shadow-2xl shadow-black/50 border border-white/10"
            />
          </div>

          {/* Informações */}
          <div className="flex-1 pt-4 text-white">
            <h1 className="text-4xl md:text-5xl font-black mb-4">{movie.name || movie.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-300 mb-8">
              <span className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                <i className="fas fa-star"></i> {movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}
              </span>
              <span>{movie.first_air_date ? new Date(movie.first_air_date).getFullYear() : "N/A"}</span>
              <span>•</span>
              <div className="flex gap-2">
                {movie.genres?.map(g => (
                  <span key={g.id} className="border border-gray-600 px-3 py-1 rounded-full">{g.name}</span>
                ))}
              </div>
            </div>

            <h3 className="text-xl font-bold mb-3 text-gray-100 border-l-4 border-yellow-400 pl-3">Sinopse</h3>
            <p className="text-gray-300 leading-relaxed text-lg mb-10 max-w-4xl">
              {movie.overview || "Nenhuma sinopse disponível para esta série no momento."}
            </p>

            {/* PLAYER DE VÍDEO (TRAILER) */}
            {trailer && (
              <section className="mb-12">
                <h3 className="text-xl font-bold mb-4 text-gray-100 border-l-4 border-yellow-400 pl-3">Trailer Oficial</h3>
                <div className="aspect-video w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    src={`https://www.youtube.com/embed/${trailer.key}?autoplay=0&rel=0`} 
                    title="YouTube video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen>
                  </iframe>
                </div>
              </section>
            )}

            {/* ELENCO CORRIGIDO */}
            {castList.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-4 text-gray-100 border-l-4 border-yellow-400 pl-3">Elenco Principal</h3>
                <div className="flex flex-wrap gap-6">
                  {castList.map((actor) => (
                    <div key={actor.id} className="flex flex-col items-center w-20 text-center group">
                      <img 
                        src={actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : "https://via.placeholder.com/150?text=Ator"} 
                        alt={actor.name} 
                        className="w-16 h-16 rounded-full object-cover mb-2 border-2 border-transparent group-hover:border-yellow-400 transition-colors shadow-lg" 
                      />
                      <span className="text-xs text-gray-400 group-hover:text-white transition-colors">{actor.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}