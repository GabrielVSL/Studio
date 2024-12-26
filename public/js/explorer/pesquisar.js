// Captura a referência para o contêiner de filmes
const movieContainer = document.getElementById("movies");

// Função para buscar filmes de acordo com a query
async function searchMovies(query) {
  try {
    // Fazendo a requisição GET para o servidor com a query
    const response = await fetch(
      `https://portal-de-series-five.vercel.app/api/search?query=${encodeURIComponent(
        query
      )}`
    );
    const data = await response.json();

    // Limpa o contêiner de filmes antes de adicionar novos resultados
    movieContainer.innerHTML = "";

    // Verifica se há resultados e cria os cards
    if (data.results && data.results.length > 0) {
      data.results.forEach((media) => {
        const card = createMovieCard(media); // Cria o card para cada filme/serie
        movieContainer.appendChild(card); // Adiciona o card ao contêiner
      });
    } else {
      movieContainer.innerHTML = "<p>Nenhum resultado encontrado.</p>"; // Exibe mensagem caso não haja resultados
    }
  } catch (error) {
    console.error("Erro ao buscar filmes:", error);
    movieContainer.innerHTML = "<p>Ocorreu um erro ao buscar os filmes.</p>"; // Exibe mensagem de erro
  }
}

// Função para criar o card de cada filme/série
function createMovieCard(media) {
  const { id, title, name, poster_path, vote_average, overview } = media;

  // Cria o elemento do card
  const card = document.createElement("div");
  card.classList.add("filmes");

  // Preenche o conteúdo do card com as informações recebidas
  card.innerHTML = `
    <div class="movie-poster">
        <img src="https://image.tmdb.org/t/p/w500${poster_path}" alt="${
    title || name
  }" />
    </div>
    <a href="detalhes.html?id=${id}">
      <div class="movie-details">
          <div class="movie-title">${title || name}</div>
          <div class="movie-rating">
              <img src="images/detalheSerie/estrela.png" class="estrela">
              <span>${vote_average || "N/A"}</span>
              <img src="images/detalheSerie/coracao.png" class="coracao">
              <span>Favoritar</span>
          </div>
          <div class="movie-description">
              ${overview || "Descrição não disponível."}
          </div>
      </div>
    </a>
  `;

  return card;
}

// Evento de clique no botão de pesquisa
document.getElementById("search-button").addEventListener("click", function () {
  const searchInput = document.getElementById("search-input").value.trim();

  if (searchInput) {
    searchMovies(searchInput); // Chama a função de busca com o valor do input
  } else {
    alert("Por favor, insira um termo para pesquisa.");
  }
});

// Evento para permitir busca ao pressionar Enter
document
  .getElementById("search-input")
  .addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      const searchInput = event.target.value.trim();
      if (searchInput) {
        searchMovies(searchInput); // Chama a função de busca com o valor do input
      } else {
        alert("Por favor, insira um termo para pesquisa.");
      }
    }
  });

// Nova funcionalidade: busca automática com base na query string
window.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search); // Captura os parâmetros da URL
  const query = urlParams.get("query"); // Obtém o valor do parâmetro "query"

  if (query) {
    searchMovies(query); // Realiza a busca automaticamente com o termo recebido
  }
});
