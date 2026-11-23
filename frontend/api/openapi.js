export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'studio API (BFF Serverless)',
    version: '2.0.0',
    description:
      'API BFF somente leitura que orquestra catálogo, artistas, trailers e links diretos de streamings no Brasil (TMDB + Watchmode) com hardening, rate limiting e cache na borda.',
  },
  servers: [
    { url: 'https://studiofilm.vercel.app', description: 'Produção (Vercel)' },
    { url: 'http://localhost:5173', description: 'Desenvolvimento Local (Vite Plugin)' },
  ],
  tags: [
    { name: 'Vitrine', description: 'Hero e prateleiras da Home' },
    { name: 'Catálogo', description: 'Explorar, busca, gêneros e provedores BR' },
    { name: 'Detalhes', description: 'Filmes, séries, temporadas, trailers e streamings' },
    { name: 'Artistas', description: 'Estrelas em destaque e filmografia completa' },
  ],
  paths: {
    '/api/hero': {
      get: {
        tags: ['Vitrine'],
        summary: 'Destaques da Hero enriquecidos',
        description:
          'Retorna os 5 destaques do dia enriquecidos em paralelo com streaming BR, cena alternativa de preview e melhor trailer YouTube.',
        responses: { 200: { description: 'Lista de destaques da Hero' } },
      },
    },
    '/api/trending': {
      get: {
        tags: ['Vitrine'],
        summary: 'Tendências do dia',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['all', 'movie', 'tv'], default: 'all' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 500, default: 1 } },
        ],
        responses: { 200: { description: 'Títulos em alta' } },
      },
    },
    '/api/movies/popular': {
      get: {
        tags: ['Vitrine'],
        summary: 'Filmes populares no Brasil',
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
        responses: { 200: { description: 'Lista paginada de filmes populares' } },
      },
    },
    '/api/movies/now_playing': {
      get: {
        tags: ['Vitrine'],
        summary: 'Filmes em cartaz no Brasil',
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
        responses: { 200: { description: 'Lista paginada de filmes em cartaz' } },
      },
    },
    '/api/movies/top_rated': {
      get: {
        tags: ['Vitrine'],
        summary: 'Filmes aclamados pela crítica (nota >= 7.8 e >= 300 votos)',
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
        responses: { 200: { description: 'Lista paginada de filmes aclamados' } },
      },
    },
    '/api/series': {
      get: {
        tags: ['Vitrine'],
        summary: 'Séries em tendência do dia',
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
        responses: { 200: { description: 'Lista paginada de séries em tendência' } },
      },
    },
    '/api/newSeries': {
      get: {
        tags: ['Vitrine'],
        summary: 'Séries atualmente no ar',
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
        responses: { 200: { description: 'Lista paginada de séries no ar' } },
      },
    },
    '/api/discover': {
      get: {
        tags: ['Catálogo'],
        summary: 'Explorar catálogo com filtros combinados (Todos / Filmes / Séries + Grátis BR)',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['all', 'movie', 'tv'], default: 'tv' } },
          { name: 'genre', in: 'query', description: 'IDs separados por vírgula (AND com fallback OR)', schema: { type: 'string' } },
          { name: 'provider', in: 'query', description: 'IDs de streamings BR separados por |', schema: { type: 'string' } },
          { name: 'free', in: 'query', description: 'Filtra somente catálogo gratuito/com anúncios no Brasil', schema: { type: 'boolean' } },
          { name: 'year', in: 'query', schema: { type: 'string', example: '2024' } },
          { name: 'yearFrom', in: 'query', schema: { type: 'string', example: '2015' } },
          { name: 'yearTo', in: 'query', schema: { type: 'string', example: '2026' } },
          { name: 'rating', in: 'query', schema: { type: 'number', minimum: 0, maximum: 10, example: 7.5 } },
          {
            name: 'sort',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['popularity.desc', 'vote_average.desc', 'primary_release_date.desc', 'first_air_date.desc'],
            },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: { 200: { description: 'Resultados paginados e totais' } },
      },
    },
    '/api/search': {
      get: {
        tags: ['Catálogo'],
        summary: 'Busca unificada (Filmes + Séries)',
        parameters: [
          { name: 'query', in: 'query', required: true, schema: { type: 'string', maxLength: 120, example: 'Interestelar' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['multi', 'movie', 'tv'], default: 'multi' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          200: { description: 'Resultados da busca' },
          400: { description: 'Termo de busca inválido' },
        },
      },
    },
    '/api/genres': {
      get: {
        tags: ['Catálogo'],
        summary: 'Lista de gêneros',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['all', 'movie', 'tv'], default: 'tv' } },
        ],
        responses: { 200: { description: 'Lista de gêneros em pt-BR' } },
      },
    },
    '/api/providers': {
      get: {
        tags: ['Catálogo'],
        summary: 'Provedores de streaming curados no Brasil',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['movie', 'tv'], default: 'movie' } },
        ],
        responses: { 200: { description: 'Principais streamings disponíveis no Brasil' } },
      },
    },
    '/api/surprise': {
      get: {
        tags: ['Catálogo'],
        summary: 'Roleta Surpreenda-me (nota 7.4+)',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['all', 'movie', 'tv'], default: 'all' } },
          { name: 'genre', in: 'query', schema: { type: 'string' } },
          { name: 'provider', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Título sorteado + alternativas na fila' } },
      },
    },
    '/api/movies/{id}': {
      get: {
        tags: ['Detalhes'],
        summary: 'Detalhes completos de um filme',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 278 } }],
        responses: { 200: { description: 'Detalhes, créditos, vídeos, provedores BR e críticas' } },
      },
    },
    '/api/series/{id}': {
      get: {
        tags: ['Detalhes'],
        summary: 'Detalhes completos de uma série',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1396 } }],
        responses: { 200: { description: 'Detalhes, temporadas, créditos, vídeos e críticas' } },
      },
    },
    '/api/series/{id}/season/{seasonNumber}': {
      get: {
        tags: ['Detalhes'],
        summary: 'Episódios de uma temporada',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 1396 } },
          { name: 'seasonNumber', in: 'path', required: true, schema: { type: 'integer', example: 1 } },
        ],
        responses: { 200: { description: 'Lista de episódios da temporada' } },
      },
    },
    '/api/videos/{type}/{id}': {
      get: {
        tags: ['Detalhes'],
        summary: 'Trailers oficiais no YouTube (pt-BR com fallback en-US)',
        parameters: [
          { name: 'type', in: 'path', required: true, schema: { type: 'string', enum: ['movie', 'tv'] } },
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 278 } },
        ],
        responses: { 200: { description: 'Vídeos ranqueados por relevância' } },
      },
    },
    '/api/watch-links/{type}/{id}': {
      get: {
        tags: ['Detalhes'],
        summary: 'Deep-links diretos de streamings no Brasil (Watchmode + cache 24h)',
        parameters: [
          { name: 'type', in: 'path', required: true, schema: { type: 'string', enum: ['movie', 'tv'] } },
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 278 } },
        ],
        responses: { 200: { description: 'Links diretos validados e ofertas gratuitas BR' } },
      },
    },
    '/api/people/popular': {
      get: {
        tags: ['Artistas'],
        summary: 'Artistas em destaque na semana',
        parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }],
        responses: { 200: { description: 'Lista de artistas populares' } },
      },
    },
    '/api/people/{id}': {
      get: {
        tags: ['Artistas'],
        summary: 'Perfil do artista, biografia (pt-BR/en-US) e filmografia completa',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', example: 287 } }],
        responses: { 200: { description: 'Dados biográficos, obras em destaque e créditos' } },
      },
    },
  },
};
