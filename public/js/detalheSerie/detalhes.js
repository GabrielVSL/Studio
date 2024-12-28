document.addEventListener("DOMContentLoaded", async function () {
  // 1. Captura o ID da série da URL
  const params = new URLSearchParams(window.location.search);
  const seriesId = params.get("id"); // Obtém o ID da série a partir da URL

  if (seriesId) {
    try {
      // 2. Requisição para buscar os detalhes da série usando o ID, agora através do seu backend
      const response = await fetch(
        `https://portal-de-series-five.vercel.app/api/series/${seriesId}`
      );
      const movieData = await response.json();

      if (movieData) {
        // 3. Chama a função para exibir os detalhes da série
        displayMovieDetails(movieData);
      } else {
        console.log("Detalhes da série não encontrados.");
        // Aqui você pode exibir uma mensagem de erro no front-end.
      }
    } catch (error) {
      console.error("Erro ao buscar os detalhes da série:", error);
      // Exibir uma mensagem de erro caso a requisição falhe
    }
  } else {
    console.log("ID da série não encontrado na URL.");
    // Exibir uma mensagem se não encontrar o ID
  }
});

// Função para exibir os detalhes da série na página
function displayMovieDetails(movie) {
  const movieDetailsSection = document.querySelector(".movie-details");

  // Verifica se os campos são válidos antes de usá-los
  const posterPath = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "caminho/para/imagem-padrão.jpg";
  const castList =
    movie.cast && movie.cast.length > 0
      ? movie.cast
          .map(
            (actor) => `
      <div class="ator">
        <li><img src="https://image.tmdb.org/t/p/w500${actor.profile_path}" alt="${actor.name}" />${actor.name}</li>
      </div>
    `
          )
          .join("")
      : "<li>Elenco não disponível.</li>";

  // Estrutura básica para exibir os detalhes
  movieDetailsSection.innerHTML = `
    <div class="info">
      <div class="esquerda">
        <img src="${posterPath}" alt="${
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
      </div>
    </div>
    <div class="elenco">
      <section class="cast">
        <h3>Elenco Principal:</h3>
        <ul>${castList}</ul>
      </section>
    </div>

    <div class="rating">
      <i class="fas fa-star"></i>
      <span>${movie.vote_average ? movie.vote_average.toFixed(1) : "N/A"}</span>
    </div>

    <button class="action-button">Adicionar aos Favoritos</button>
  `;
}
