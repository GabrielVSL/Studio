const express = require("express");
const axios = require("axios");
const cors = require("cors"); // Importa o pacote cors

const app = express();

// Configura o CORS para permitir todas as origens
app.use(cors());

// Configure as opções para a requisição à API do TMDb
const trendingOptions = {
  method: "GET",
  url: "https://api.themoviedb.org/3/trending/all/day", // Endpoint de tendências
  params: {
    api_key: "457f195a42d96b0e9f6f6bbf413a23ad", // Substitua com sua chave da API
    include_adult: true, // Filtra conteúdo adulto (altere para false para não incluir)
    language: "pt-BR", // Idioma dos resultados
    page: 1, // Página dos resultados
  },
};

// Endpoint para buscar séries e filmes populares
app.get("/api/series", async (req, res) => {
  try {
    const response = await axios.request(trendingOptions);
    res.json(response.data); // Envia os dados para o front-end
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar detalhes de um filme por ID
app.get("/api/series/:id", async (req, res) => {
  const movieId = req.params.id; // Pega o ID do filme da URL

  try {
    // Faz a requisição à API do TMDb para obter detalhes do filme
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}`,
      {
        params: {
          api_key: "457f195a42d96b0e9f6f6bbf413a23ad", // Sua chave da API
          language: "pt-BR",
        },
      }
    );
    res.json(response.data); // Envia os dados para o front-end
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar os detalhes do filme" });
  }
});

// Inicia o servidor na porta 3000
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
