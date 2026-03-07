// URL base da sua API hospedada na Vercel
const BASE_URL = "https://bhflix.vercel.app/api";

export const getPopularSeries = async () => {
  try {
    const response = await fetch(`${BASE_URL}/series`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Erro ao buscar populares:", error);
    return [];
  }
};

export const getNewSeries = async () => {
  try {
    const response = await fetch(`${BASE_URL}/newSeries`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Erro ao buscar novas séries:", error);
    return [];
  }
};

// Substitui a chamada de API do detalhes.js
export const getSeriesDetails = async (id) => {
  try {
    const response = await fetch(`${BASE_URL}/series/${id}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Erro ao buscar detalhes da série ${id}:`, error);
    return null;
  }
};

// Substitui a chamada de API do pesquisar.js
export const searchSeries = async (query) => {
  try {
    const response = await fetch(`${BASE_URL}/search?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error("Erro ao pesquisar séries:", error);
    return [];
  }
};

// Busca a lista de botões (Ação, Aventura, etc)
export const getGenres = async () => {
  try {
    const response = await fetch(`${BASE_URL}/genres`);
    const data = await response.json();
    return data.genres || [];
  } catch (error) {
    console.error("Erro ao buscar gêneros:", error);
    return [];
  }
};

// Busca os filmes filtrados por aquele botão específico
export const discoverSeries = async (genreId, page = 1, year = '', rating = '', sort = '') => {
  try {
    // Monta a URL dinâmica com os filtros que o usuário escolher
    let url = `${BASE_URL}/discover?page=${page}`;
    if (genreId) url += `&genre=${genreId}`;
    if (year) url += `&year=${year}`;
    if (rating) url += `&rating=${rating}`;
    if (sort) url += `&sort=${sort}`;
      
    // Se não tiver nenhum filtro ativado e for a página 1, pega os populares padrão
    if (!genreId && !year && !rating && !sort) {
      url = `${BASE_URL}/series?page=${page}`;
    }

    const response = await fetch(url);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Erro ao descobrir séries:", error);
    return [];
  }
};