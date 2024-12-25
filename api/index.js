const express = require("express");
const axios = require("axios");
const cors = require("cors"); // Importa o pacote cors
require("dotenv").config(); // Carrega as variáveis do arquivo .env

const app = express();

// Configura o CORS para permitir todas as origens
app.use(cors());


const API_KEY = process.env.API_KEY;

// Endpoint para buscar series que vão ao ar em até 7 dias
https: app.get("/api/newSeries", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.themoviedb.org/3/tv/on_the_air",
      {
        params: {
          api_key: API_KEY,
          include_adult: true,
          language: "pt-BR",
          page: 1,
        },
      }
    );
    res.json(response.data); // Envia os dados para o front-end
  } catch (error) {
    console.error("Erro ao buscar tendências:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar tendências de séries e filmes
https: app.get("/api/series", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.themoviedb.org/3/trending/tv/day",
      {
        params: {
          api_key: API_KEY,
          include_adult: true,
          language: "pt-BR",
          page: 1,
        },
      }
    );
    res.json(response.data); // Envia os dados para o front-end
  } catch (error) {
    console.error("Erro ao buscar tendências:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar detalhes de um filme ou série por ID
app.get("/api/series/:id", async (req, res) => {
  const movieId = req.params.id; // Pega o ID do filme da URL

  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}`,
      {
        params: {
          api_key: API_KEY,
          language: "pt-BR",
        },
      }
    );
    res.json(response.data); // Envia os dados para o front-end
  } catch (error) {
    console.error("Erro ao buscar detalhes:", error.message);
    res.status(500).json({ error: "Erro ao buscar os detalhes do filme" });
  }
});

// Novo endpoint para buscar filmes ou séries pelo nome
app.get("/api/search", async (req, res) => {
  const query = req.query.query; // Obtém o parâmetro de busca da query string

  if (!query) {
    return res
      .status(400)
      .json({ error: "Parâmetro de busca 'query' é obrigatório" });
  }

  try {
    const response = await axios.get("https://api.themoviedb.org/3/search/tv", {
      params: {
        api_key: API_KEY,
        query: query,
        include_adult: false,
        language: "pt-BR",
        page: 1,
      },
    });
    res.json(response.data); // Envia os dados para o front-end
  } catch (error) {
    console.error("Erro ao buscar filmes ou séries:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Inicia o servidor na porta 3000
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
module.exports = app;
