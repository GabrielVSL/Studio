const express = require("express");
const axios = require("axios");
const cors = require("cors"); // Importa o pacote cors

const app = express();

// Configura o CORS para permitir todas as origens
app.use(cors());

// Configure as opções para a requisição à API do TMDb
const options = {
  method: "GET",
  url: "https://api.themoviedb.org/3/trending/all/week", // Endpoint de tendências
  params: {
    api_key: "457f195a42d96b0e9f6f6bbf413a23ad", // Substitua com sua chave da API
    include_adult: false, // Filtra conteúdo adulto (altere para false para não incluir)
    language: "pt-BR", // Idioma dos resultados
    page: 1, // Página dos resultados
  },
};

// Endpoint para buscar séries
app.get("/api/series", async (req, res) => {
  try {
    // Faz a requisição à API do TMDb
    const response = await axios.request(options);
    res.json(response.data); // Envia os dados para o front-end
  } catch (error) {
    // Trata erro na requisição
    res.status(500).json({ error: "Erro ao buscar dados da API" });
  }
});

// Inicia o servidor na porta 3000
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});
