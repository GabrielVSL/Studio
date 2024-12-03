# **Portal de Séries 🎥**

Este é um portal dinâmico de séries de TV, desenvolvido como parte de um trabalho acadêmico. O projeto utiliza a API **The Movie DB** e um **JSON Server** como backend para armazenar dados personalizados.

---

## **📋 Funcionalidades**

### **Tela 1: Home Page (index.html)**
- **Seção 1: Carrossel de Séries Populares**  
  Mostra as séries mais populares obtidas da API The Movie DB.  
  - Navegação entre as séries (próxima/anterior).  
  - Clique em uma série para acessar a página de detalhes.  

- **Seção 2: Cards de Séries Novas**  
  Apresenta séries recentes com imagem, nome e descrição.  

- **Seção 3: Informações do Autor**  
  Mostra informações sobre o desenvolvedor do projeto, obtidas do JSON Server.  

- **Seção 4: Séries Favoritas**  
  Lista as séries marcadas como favoritas pelo usuário, armazenadas no JSON Server.

### **Tela 2: Explorador (explorer.html)**
- Campo de busca para localizar séries específicas.  
- Lista de resultados exibida em cards.  
- Clique em uma série para acessar a página de detalhes.

### **Tela 3: Detalhes da Série (detalhes.html)**
- **Seção 1: Visão Geral**  
  Informações detalhadas da série, incluindo sinopse, data de lançamento, e mais.  
  - Botão para marcar/desmarcar a série como favorita.  

- **Seção 2: Elenco**  
  Apresentação dos principais atores da série em formato de cards.

---

## **🛠️ Tecnologias Utilizadas**

- **Frontend:**  
  - HTML5, CSS3, JavaScript  
  - Bootstrap (para componentes responsivos e design)  

- **Backend:**  
  - JSON Server (para armazenar dados de séries favoritas e do autor)

- **API Externa:**  
  - [The Movie DB API](https://developers.themoviedb.org/3)

---

## **📂 Estrutura do Projeto**
portalSeries/ ├── public/ │ ├── css/ │ │ └── styles.css │ ├── js/ │ │ ├── home.js │ │ ├── explorer.js │ │ └── details.js │ ├── img/ │ ├── index.html │ ├── explorer.html │ └── detalhes.html ├── server/ │ ├── db.json │ └── server.js ├── utils/ │ ├── api.js │ └── helpers.js └── README.md
