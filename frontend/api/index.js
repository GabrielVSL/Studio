import express from 'express';
import axios from 'axios';
import cors from 'cors';
import 'dotenv/config'; // Forma moderna de carregar o .env

const app = express();

// Configura o CORS
app.use(cors({ origin: "*" }));

const API_KEY = process.env.API_KEY;

// Endpoint para buscar séries que vão ao ar
app.get("/api/newSeries", async (req, res) => {
  try {
    const response = await axios.get("https://api.themoviedb.org/3/tv/on_the_air", {
      params: {
        api_key: API_KEY,
        include_adult: true,
        language: "pt-BR",
        page: 1,
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Erro ao buscar novas séries:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar tendências
app.get("/api/series", async (req, res) => {
  try {
    const response = await axios.get("https://api.themoviedb.org/3/trending/tv/day", {
      params: {
        api_key: API_KEY,
        include_adult: true,
        language: "pt-BR",
        page: 1,
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("Erro ao buscar séries em tendência:", error.message);
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Endpoint para buscar detalhes com provedores de streaming
app.get("/api/series/:id", async (req, res) => {
  const movieId = req.params.id; 
  try {
    const response = await axios.get(`https://api.themoviedb.org/3/tv/${movieId}`, {
      params: {
        api_key: API_KEY,
        language: "pt-BR",
        append_to_response: "credits,videos,recommendations,watch/providers",
        include_video_language: "pt,en" 
      },
    });
    res.json(response.data); 
  } catch (error) {
    console.error("Erro ao buscar detalhes:", error.message);
    res.status(500).json({ error: "Erro ao buscar os detalhes da série" });
  }
});

// Endpoint de Pesquisa
app.get("/api/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: "Query obrigatória" });

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
    res.status(500).json({ error: "Erro na busca" });
  }
});

// Endpoint de Gêneros
app.get("/api/genres", async (req, res) => {
  try {
    const response = await axios.get("https://api.themoviedb.org/3/genre/tv/list", {
      params: { api_key: API_KEY, language: "pt-BR" },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar gêneros" });
  }
});

// Endpoint Discover
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
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Erro no discover" });
  }
});

// EXPORTAÇÃO PARA VERCEL (Substitui o module.exports)
export default app;