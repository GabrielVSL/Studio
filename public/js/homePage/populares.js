// MOSTRA OS FILMES E SÉRIES NA PÁGINA DE EXPLORAÇÃO

const movieContainer = document.getElementById("movies"); // Onde os cards de filmes serão inseridos

async function fetchMovies() {
  try {
    // Fazendo uma requisição GET para o servidor (ajustado para produção no Vercel)
    const response = await fetch(
      "https://portal-de-series-five.vercel.app/api/series"
    );
    const data = await response.json(); // Espera o retorno em formato JSON

    // Verifica se existem filmes na resposta e cria os cards
    if (data.results) {
      data.results.forEach((media) => {
        const card = createMovieCard(media); // Cria o card para cada filme/série
        movieContainer.appendChild(card); // Adiciona o card à div "movies"
      });
    }
  } catch (error) {
    console.log("Erro ao buscar dados da API: ", error);
  }
}

function createMovieCard(media) {
  const { id, title, name, poster_path, vote_average, overview } = media; // Desestruturando para pegar id, título, nome, avaliação e sinopse

  // Verifica se existe um poster_path
  const posterUrl = poster_path
    ? `https://image.tmdb.org/t/p/w500${poster_path}`
    : "caminho/para/imagem-padrão.jpg"; // Caso não tenha poster, usa uma imagem padrão

  // Cria o elemento do card
  const card = document.createElement("div");
  card.classList.add("filmes"); // A classe principal do card

  // Preenche o conteúdo do card com as informações recebidas da API
  card.innerHTML = `
    <a href="detalhes.html?id=${id}">
      <div class="content">
          <div class="title">${title || name}</div>
          <img src="${posterUrl}" alt="${title || name}" />
          <div class="rating">
              <i class="fas fa-star"></i> ${vote_average || "N/A"}
          </div>
          <button class="save">
              <img src="/public/images/detalheSerie/coracao.png" alt="Favoritar"> Favoritar
          </button>
      </div>
    </a>
  `;

  return card; // Retorna o card gerado
}

// Chama a função para buscar os filmes assim que o script for carregado
fetchMovies();
