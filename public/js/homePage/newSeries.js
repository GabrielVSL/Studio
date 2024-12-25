// MOSTRA AS NOVAS SÉRIES NA PÁGINA DE EXPLORAÇÃO

const newSeriesContainer = document.getElementById("newSeries"); // Aonde os cards de novas séries serão inseridos

async function fetchNewSeries() {
  try {
    // Fazendo uma requisição GET para o servidor
    const response = await fetch(
      "https://portal-de-series-five.vercel.app/api/newSeries"
    );
    const data = await response.json(); // Espera o retorno em formato JSON

    // Verifica se existem séries na resposta e cria os cards
    if (data.results) {
      data.results.forEach((media) => {
        const card = createNewSeriesCard(media); // Cria o card para cada nova série
        newSeriesContainer.appendChild(card); // Adiciona o card à div "newSeries"
      });
    }
  } catch (error) {
    console.log("Erro ao buscar dados da API: ", error);
  }
}

function createNewSeriesCard(media) {
  const { id, title, name, poster_path, vote_average, overview } = media; // Desestruturando para pegar id, título, nome, avaliação e sinopse

  // Cria o elemento do card
  const card = document.createElement("div");
  card.classList.add("novasSeries"); // A classe principal do card para novas séries

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
              <img src="images/detalheSerie/coracao.png"> Favoritar
          </button>
      </div>
    </a>
  `;

  return card; // Retorna o card gerado
}

// Chama a função para buscar as novas séries assim que o script for carregado
fetchNewSeries();
