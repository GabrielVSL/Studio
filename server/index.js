const express = require("express");
const axios = require("axios");
const cors = require("cors"); // Importa o pacote cors

const app = express();

// Configura o CORS para permitir todas as origens
app.use(cors());

const API_KEY = "457f195a42d96b0e9f6f6bbf413a23ad"; // Substitua pela sua chave da API do TMDb

// Endpoint para buscar tendências de séries e filmes
app.get("/api/series", async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.themoviedb.org/3/trending/all/day",
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
