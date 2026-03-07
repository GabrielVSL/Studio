// Busca os favoritos salvos no navegador
export const getFavorites = () => {
  const favs = localStorage.getItem('devflix_favorites');
  return favs ? JSON.parse(favs) : [];
};

// Adiciona ou remove um filme dos favoritos
export const toggleFavorite = (movie) => {
  let favs = getFavorites();
  const exists = favs.find(m => m.id === movie.id);
  
  if (exists) {
    // Se já existe, remove (Filtra todos que são diferentes do ID clicado)
    favs = favs.filter(m => m.id !== movie.id);
  } else {
    // Se não existe, adiciona na lista
    favs.push(movie);
  }
  
  // Salva a nova lista convertida em texto no navegador
  localStorage.setItem('devflix_favorites', JSON.stringify(favs));
  return !exists; // Retorna true se adicionou, false se removeu
};

// Verifica se um filme específico é favorito (para pintar o coração)
export const isFavorite = (id) => {
  const favs = getFavorites();
  return favs.some(m => m.id === id);
};