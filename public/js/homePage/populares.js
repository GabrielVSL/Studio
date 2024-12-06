// MOSTRA OS FILMES E SÉRIES NA PÁGINA DE EXPLORAÇÃO

const movieContainer = document.getElementById("movies"); // Aonde os cards de filmes serão inseridos

async function fetchMovies() {
  try {
    // Fazendo uma requisição GET para o servidor
    const response = await fetch("http://localhost:3000/api/series");
    const data = await response.json(); // Espera o retorno em formato JSON

    // Verifica se existem filmes na resposta e cria os cards
    if (data.results) {
      data.results.forEach((media) => {
        const card = createMovieCard(media); // Cria o card para cada filme/serie
        movieContainer.appendChild(card); // Adiciona o card à div "movies"
      });
    }
  } catch (error) {
    console.log("Erro ao buscar dados da API: ", error);
  }
}

function createMovieCard(media) {
  const { id, title, name, poster_path, vote_average, overview } = media; // Desestruturando para pegar id, título, nome, avaliação e sinopse

  // Cria o elemento do card
  const card = document.createElement("div");
  card.classList.add("filmes"); // A classe principal do card

  // Preenche o conteúdo do card com as informações recebidas da API
  card.innerHTML = `
    <a href="detalhes.html?id=${id}">
      <div class="content">
          <div class="title">${title || name}</div>
          <img src="https://image.tmdb.org/t/p/w500${poster_path}" alt="${
    title || name
  }" />
          <div class="rating">
              <i class="fas fa-star"></i> ${vote_average}
          </div>
          <button class="save">
              <img src="/public/images/detalheSerie/coracao.png"> Favoritar
          </button>
      </div>
    </a>
  `;

  return card; // Retorna o card gerado
}

// Chama a função para buscar os filmes assim que o script for carregado
fetchMovies();
