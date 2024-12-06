// Adiciona o evento de clique ao botão de pesquisa
document.getElementById("search-button").addEventListener("click", function () {
  // Captura o valor do input de pesquisa
  const searchInput = document.getElementById("search-input").value.trim();

  // Verifica se o input está preenchido
  if (searchInput) {
    // Redireciona para a página de pesquisa com o termo como query string
    window.location.href = `explorer.html?query=${encodeURIComponent(
      searchInput
    )}`;
  } else {
    alert("Por favor, insira um termo para pesquisa."); // Alerta caso o campo esteja vazio
  }
});

// Permite a pesquisa pressionando a tecla Enter no input
document
  .getElementById("search-input")
  .addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      // Captura o valor do input
      const searchInput = event.target.value.trim();

      // Verifica se o input está preenchido
      if (searchInput) {
        // Redireciona para a página de pesquisa com o termo como query string
        window.location.href = `explorer.html?query=${encodeURIComponent(
          searchInput
        )}`;
      } else {
        alert("Por favor, insira um termo para pesquisa."); // Alerta caso o campo esteja vazio
      }
    }
  });
