const express = require("express");
const axios = require("axios");
const cors = require("cors"); // Importa o pacote cors
require("dotenv").config(); // Carrega as variáveis do arquivo .env

const app = express();

// Configura o CORS para permitir apenas origens específicas (como o front-end hospedado no Vercel)
app.use(
  cors({
    origin: "*", // Substitua pelo domínio do seu front-end
  })
);

const API_KEY = process.env.API_KEY;

// Endpoint para buscar séries que vão ao ar em até 7 dias
app.get("/api/newSeries", async (req, res) => {
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
    console.error("Erro ao buscar novas séries:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar tendências de séries e filmes
app.get("/api/series", async (req, res) => {
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
    console.error("Erro ao buscar séries em tendência:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar detalhes de um filme ou série por ID
app.get("/api/series/:id", async (req, res) => {
  const movieId = req.params.id; 

  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/tv/${movieId}`, 
      {
        params: {
          api_key: API_KEY,
          language: "pt-BR",
          // Apenas altere esta linha no seu backend:
          append_to_response: "credits,videos,recommendations",
          include_video_language: "pt,en" // Se não achar trailer BR, pega o gringo
        },
      }
    );
    res.json(response.data); 
  } catch (error) {
    console.error("Erro ao buscar detalhes da série:", error.message);
    res.status(500).json({ error: "Erro ao buscar os detalhes da série" });
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

// 1. Endpoint para buscar a lista oficial de Gêneros (Ação, Comédia, etc)
app.get("/api/genres", async (req, res) => {
  try {
    const response = await axios.get("https://api.themoviedb.org/3/genre/tv/list", {
      params: {
        api_key: API_KEY,
        language: "pt-BR",
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Erro ao buscar gêneros:", error.message);
    res.status(500).json({ error: "Erro ao buscar gêneros" });
  }
});

// 2. Endpoint mágico do "Discover" para filtrar filmes por gênero e popularidade
app.get("/api/discover", async (req, res) => {
  const { genre, page = 1 } = req.query;

  try {
    const response = await axios.get("https://api.themoviedb.org/3/discover/tv", {
      params: {
        api_key: API_KEY,
        language: "pt-BR",
        sort_by: "popularity.desc", // Traz sempre os melhores primeiro
        page: page,
        with_genres: genre, // Aqui entra o ID do gênero clicado!
        include_null_first_air_dates: false
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Erro no discover:", error.message);
    res.status(500).json({ error: "Erro ao filtrar séries" });
  }
});

// Inicia o servidor na porta 3000
// O Vercel utiliza uma porta dinâmica, então a porta 3000 pode ser substituída por process.env.PORT
app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor rodando na porta 3000");
});

module.exports = app;
