document.addEventListener("DOMContentLoaded", async function () {
  // 1. Captura o ID da série da URL
  const params = new URLSearchParams(window.location.search);
  const seriesId = params.get("id"); // Obtém o ID da série a partir da URL

  if (seriesId) {
    try {
      // 2. Requisição para buscar os detalhes da série usando o ID
      const response = await fetch(
        `https://api.themoviedb.org/3/tv/${seriesId}?api_key=457f195a42d96b0e9f6f6bbf413a23ad&language=pt-BR`
      );
      const movieData = await response.json();

      if (movieData) {
        // 3. Chama a função para exibir os detalhes da série
        displayMovieDetails(movieData);
      } else {
        console.log("Detalhes da série não encontrados.");
      }
    } catch (error) {
      console.error("Erro ao buscar os detalhes da série:", error);
    }
  } else {
    console.log("ID da série não encontrado na URL.");
  }
});

// Função para exibir os detalhes da série na página
function displayMovieDetails(movie) {
  const movieDetailsSection = document.querySelector(".movie-details"); // Ajuste aqui para o contêiner correto

  // Estrutura básica para exibir os detalhes
  movieDetailsSection.innerHTML = `
    <div class="info">
      <div class="esquerda">
        <img src="https://image.tmdb.org/t/p/w500${movie.poster_path}" alt="${
    movie.title || movie.name
  }" width="300" height="450" />
      </div>

      <div class="direita">
        <h2>${movie.title || movie.name}</h2>

        <div class="movie-info">
          <p><strong>Avaliação:</strong> ${movie.vote_average || "N/A"}</p>
          <p><strong>Ano de Lançamento:</strong> ${
            movie.first_air_date
              ? new Date(movie.first_air_date).getFullYear()
              : "N/A"
          }</p>
          <p><strong>Gênero:</strong> ${
            movie.genres ? movie.genres.map((g) => g.name).join(", ") : "N/A"
          }</p>
          <p><strong>Descrição:</strong> ${
            movie.overview || "Descrição não disponível."
          }</p>
        </div>

        <section class="cast">
          <h3>Elenco Principal:</h3>
          <ul>
            ${
              movie.cast
                ? movie.cast
                    .map(
                      (actor) => `
              <div class="ator">
                <li><img src="https://image.tmdb.org/t/p/w500${actor.profile_path}" alt="${actor.name}" />${actor.name}</li>
              </div>
            `
                    )
                    .join("")
                : "<li>Elenco não disponível.</li>"
            }
          </ul>
        </section>
      </div>
    </div>

    <div class="rating">
      <i class="fas fa-star"></i>
      <span>${movie.vote_average || "N/A"}</span>
    </div>

    <button class="action-button">Adicionar aos Favoritos</button>
  `;
}
