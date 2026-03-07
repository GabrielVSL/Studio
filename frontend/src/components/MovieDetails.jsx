import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSeriesDetails, getSeasonDetails } from '../services/api';
import MovieCard from './MovieCard';

export default function MovieDetails() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0); 
    const fetchDetails = async () => {
      setLoading(true);
      setMovie(await getSeriesDetails(id));
      setLoading(false);
    };
    fetchDetails();
  }, [id]);

  // Efeito para carregar a 1ª temporada automaticamente quando a série carregar
  useEffect(() => {
    if (movie && movie.seasons && movie.seasons.length > 0) {
      // Ignora a temporada 0 (geralmente são os Extras/Especiais) e pega a primeira oficial
      const firstRealSeason = movie.seasons.find(s => s.season_number > 0) || movie.seasons[0];
      if (firstRealSeason && !selectedSeason) {
        setSelectedSeason(firstRealSeason.season_number);
      }
    }
  }, [movie]);

  // Efeito para buscar os episódios sempre que o usuário trocar de temporada
  useEffect(() => {
    const fetchEpisodes = async () => {
      if (!selectedSeason || !id) return;
      setLoadingEpisodes(true);
      const eps = await getSeasonDetails(id, selectedSeason);
      setEpisodes(eps);
      setLoadingEpisodes(false);
    };
    fetchEpisodes();
  }, [id, selectedSeason]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-yellow-400 text-3xl"><i className="fas fa-spinner fa-spin"></i></div>;
  if (!movie) return <div className="min-h-screen flex items-center justify-center text-white">Série não encontrada.</div>;

  const backdropUrl = movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '';
  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "https://via.placeholder.com/500x750";
  const trailer = movie.videos?.results?.find(vid => vid.site === "YouTube" && vid.type === "Trailer") || movie.videos?.results?.[0];
  // Puxando os provedores de streaming do Brasil
  const watchProviders = movie["watch/providers"]?.results?.BR;
  // Pegamos apenas o "flatrate" (que significa streaming por assinatura, como Netflix)
  const streamingPlatforms = watchProviders?.flatrate || [];
  // Pega os 8 primeiros atores para preencher o buraco abaixo do poster
  const castList = movie.credits?.cast?.slice(0, 8) || []; 
  const recommendations = movie.recommendations?.results || [];

  return (
    <main className="min-h-screen bg-slate-950 relative pb-20">
      
      {/* Imagem de Fundo (Backdrop) */}
      <div className="absolute top-0 w-full h-[50vh] md:h-[70vh] overflow-hidden">
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/50 z-10"></div>
        {backdropUrl && <img src={backdropUrl} alt="Background" className="w-full h-full object-cover opacity-30" />}
      </div>

      <div className="container mx-auto px-4 lg:px-8 pt-24 md:pt-25 relative z-20">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors">
          <i className="fas fa-arrow-left"></i> Voltar
        </Link>

        {/* ESTRUTURA PRINCIPAL (Esquerda: Poster+Elenco | Direita: Infos+Trailer) */}
        <div className="flex flex-col md:flex-row gap-8 lg:gap-12 mb-16">
          
          {/* COLUNA ESQUERDA (Poster e Elenco com Scroll) */}
          <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 flex flex-col gap-8">
            <img src={posterUrl} alt={movie.name || movie.title} className="w-full rounded-2xl shadow-2xl shadow-black/50 border border-white/10" />
            
            {/* NOVO ELENCO COM SCROLL E 1 POR LINHA */}
            {castList.length > 0 && (
              <div className="bg-slate-900/80 p-5 rounded-2xl border border-white/5 h-[295px] flex flex-col shadow-xl">
                <h3 className="text-xl font-bold mb-4 text-white border-l-4 border-yellow-400 pl-3 flex-shrink-0">Elenco</h3>
                
                {/* O container que rola o conteúdo */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                  {castList.map((actor) => (
                    <div key={actor.id} className="flex items-center gap-4 group p-2 rounded-lg hover:bg-white/5 transition-colors">
                      <img 
                        src={actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : "https://via.placeholder.com/150"} 
                        alt={actor.name} 
                        className="w-14 h-14 rounded-full object-cover border-2 border-transparent group-hover:border-yellow-400 transition-colors shadow-md" 
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-200 group-hover:text-yellow-400 transition-colors">{actor.name}</span>
                        <span className="text-xs text-gray-500">{actor.character}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* COLUNA DIREITA (Sinopse e Trailer) */}
          <div className="flex-1 pt-2 text-white">
            <h1 className="text-4xl md:text-5xl font-black mb-4">{movie.name || movie.title}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-300 mb-8">
              <span className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                <i className="fas fa-star"></i> {movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}
              </span>
              <span>{movie.first_air_date ? new Date(movie.first_air_date).getFullYear() : "N/A"}</span>
            </div>

            {/* NOVA SEÇÃO: ONDE ASSISTIR */}
            {streamingPlatforms.length > 0 && (
              <div className="mb-8">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">Disponível em:</span>
                <div className="flex flex-wrap gap-3">
                  {streamingPlatforms.map((provider) => (
                    <div key={provider.provider_id} className="relative group cursor-pointer" title={provider.provider_name}>
                      <img 
                        src={`https://image.tmdb.org/t/p/original${provider.logo_path}`} 
                        alt={provider.provider_name} 
                        className="w-12 h-12 rounded-xl shadow-lg border-2 border-transparent group-hover:border-yellow-400 group-hover:scale-110 transition-all duration-300"
                      />
                      {/* Tooltip com o nome da plataforma */}
                      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
                        {provider.provider_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 className="text-xl font-bold mb-3 text-gray-100 border-l-4 border-yellow-400 pl-3">Sinopse</h3>
            <p className="text-gray-300 leading-relaxed text-lg mb-10 max-w-4xl">
              {movie.overview || "Nenhuma sinopse disponível para esta série."}
            </p>

            {/* PLAYER DO TRAILER */}
            {trailer && (
              <section>
                <h3 className="text-xl font-bold mb-4 text-gray-100 border-l-4 border-yellow-400 pl-3">Trailer Oficial</h3>
                <div className="aspect-video w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black">
                  <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${trailer.key}?autoplay=0&rel=0`} title="Trailer" frameBorder="0" allowFullScreen></iframe>
                </div>
              </section>
            )}
          </div>
        </div>

        {/* NOVA SEÇÃO: TEMPORADAS E EPISÓDIOS */}
        {movie.seasons && movie.seasons.length > 0 && (
          <section className="mt-16 border-t border-white/10 pt-10 mb-16">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-8 bg-yellow-400 rounded-full"></div>
                <h3 className="text-3xl font-black text-white">Episódios</h3>
              </div>

              {/* Seletor de Temporada com visual Premium */}
              <div className="relative">
                <select
                  value={selectedSeason || ''}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  className="appearance-none bg-slate-800 text-white font-bold border border-white/10 rounded-xl px-5 py-3 pr-12 hover:border-yellow-400 focus:border-yellow-400 outline-none transition-all cursor-pointer shadow-inner w-full sm:w-auto min-w-[200px]"
                >
                  {movie.seasons.filter(s => s.season_number > 0).map(season => (
                    <option key={season.id} value={season.season_number} className="bg-slate-900 py-2">
                      {season.name} ({season.episode_count} eps)
                    </option>
                  ))}
                </select>
                <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
              </div>
            </div>

            {/* Lista de Episódios */}
            {loadingEpisodes ? (
              <div className="flex justify-center py-12">
                <i className="fas fa-circle-notch fa-spin text-4xl text-yellow-400"></i>
              </div>
            ) : (
              <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-2">
                {episodes.map(ep => (
                  <div key={ep.id} className="flex flex-col md:flex-row gap-5 bg-slate-900/40 p-4 rounded-2xl border border-white/5 hover:bg-slate-800/60 hover:border-white/10 transition-all duration-300 group">
                    
                    {/* Thumbnail do Episódio */}
                    <div className="md:w-64 flex-shrink-0 relative rounded-xl overflow-hidden aspect-video bg-slate-950 shadow-lg">
                      {ep.still_path ? (
                        <img src={`https://image.tmdb.org/t/p/w500${ep.still_path}`} alt={ep.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600"><i className="fas fa-tv text-3xl"></i></div>
                      )}
                      {/* Badge T1:E1 */}
                      <div className="absolute top-2 left-2 bg-slate-950/90 px-2.5 py-1 rounded-lg text-xs font-black text-white backdrop-blur-sm border border-white/10 shadow-lg">
                        T{selectedSeason}:E{ep.episode_number}
                      </div>
                    </div>

                    {/* Textos do Episódio */}
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                        <h4 className="text-xl font-bold text-gray-100 group-hover:text-yellow-400 transition-colors leading-tight">{ep.name}</h4>
                        <div className="flex items-center gap-1.5 bg-yellow-400/10 px-2.5 py-1 rounded-lg border border-yellow-400/20 text-xs font-bold text-yellow-400 whitespace-nowrap">
                          <i className="fas fa-star"></i> {ep.vote_average ? ep.vote_average.toFixed(1) : "N/A"}
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed mb-3">
                        {ep.overview || "Sinopse não disponível para este episódio."}
                      </p>
                      <div className="mt-auto flex items-center gap-4 text-xs font-bold text-gray-500">
                        <span><i className="far fa-calendar-alt mr-1.5"></i> {ep.air_date ? new Date(ep.air_date).toLocaleDateString('pt-BR') : "Data desconhecida"}</span>
                        <span><i className="far fa-clock mr-1.5"></i> {ep.runtime ? `${ep.runtime} min` : "-- min"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* INDICAÇÕES DE FILMES (No final de tudo) */}
        {recommendations.length > 0 && (
          <section className="pt-8 border-t border-white/10">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-1.5 h-6 bg-yellow-400 rounded-full"></div>
              <h3 className="text-2xl font-bold text-white">Você também pode gostar</h3>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar">
              {recommendations.map((rec) => (
                <div key={rec.id} className="snap-start flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px]">
                  <MovieCard 
                    id={rec.id} title={rec.title || rec.name}
                    image={rec.poster_path ? `https://image.tmdb.org/t/p/w500${rec.poster_path}` : "https://via.placeholder.com/500x750"}
                    rating={rec.vote_average ? rec.vote_average.toFixed(1) : "N/A"}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}