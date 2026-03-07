const express = require("express");
const axios = require("axios");
require("dotenv").config(); // Carrega as variáveis do arquivo .env

const app = express();

// CORS MODO FORÇA-BRUTA (Perfeito para Vercel, não precisa de npm install cors)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

const API_KEY = process.env.API_KEY;

// Endpoint para buscar séries que vão ao ar (AGORA COM PÁGINA DINÂMICA!)
app.get("/api/newSeries", async (req, res) => {
  const page = req.query.page || 1; // Puxa a página solicitada pelo frontend
  try {
    const response = await axios.get("https://api.themoviedb.org/3/tv/on_the_air", {
      params: {
        api_key: API_KEY,
        include_adult: true,
        language: "pt-BR",
        page: page, // Envia para o TMDB
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Erro ao buscar novas séries:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar tendências (AGORA COM PÁGINA DINÂMICA!)
app.get("/api/series", async (req, res) => {
  const page = req.query.page || 1; // Puxa a página solicitada pelo frontend
  try {
    const response = await axios.get("https://api.themoviedb.org/3/trending/tv/day", {
      params: {
        api_key: API_KEY,
        include_adult: true,
        language: "pt-BR",
        page: page, // Envia para o TMDB
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Erro ao buscar séries em tendência:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar detalhes de um filme/série por ID
app.get("/api/series/:id", async (req, res) => {
  const movieId = req.params.id; 
  try {
    const response = await axios.get(`https://api.themoviedb.org/3/tv/${movieId}`, {
      params: {
        api_key: API_KEY,
        language: "pt-BR",
        append_to_response: "credits,videos,recommendations",
        include_video_language: "pt,en" 
      },
    });
    res.json(response.data); 
  } catch (error) {
    console.error("Erro ao buscar detalhes:", error.message);
    res.status(500).json({ error: "Erro ao buscar os detalhes da série" });
  }
});

// Endpoint para buscar filmes/séries pelo texto
app.get("/api/search", async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: "Parâmetro 'query' é obrigatório" });
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
    res.json(response.data);
  } catch (error) {
    console.error("Erro ao buscar filmes/séries:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar a lista de Gêneros (Ação, Comédia, etc)
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

// Endpoint do "Discover" para filtrar
app.get("/api/discover", async (req, res) => {
  const { genre, page = 1 } = req.query;
  try {
    const response = await axios.get("https://api.themoviedb.org/3/discover/tv", {
      params: {
        api_key: API_KEY,
        language: "pt-BR",
        sort_by: "popularity.desc", 
        page: page,
        with_genres: genre, 
        include_null_first_air_dates: false
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Erro no discover:", error.message);
    res.status(500).json({ error: "Erro ao filtrar séries" });
  }
});

// Inicia o servidor
app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor rodando");
});

module.exports = app;