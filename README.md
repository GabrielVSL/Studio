<div align="center">

<br />

<a href="https://studiofilm.vercel.app" target="_blank">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="frontend/public/logo-studio.png" />
    <source media="(prefers-color-scheme: light)" srcset="docs/logo-studio-light.png" />
    <img src="frontend/public/logo-studio.png" alt="studio" width="230" />
  </picture>
</a>

<br />
<br />

<p>
  Plataforma editorial de descoberta de <strong>filmes, séries, artistas e streamings no Brasil</strong>,<br />
  com player YouTube unificado, deep-links BR e BFF Serverless na Vercel.
</p>

<p>
  <a href="https://studiofilm.vercel.app" target="_blank"><img src="https://img.shields.io/badge/ACESSAR_APLICAÇÃO-studiofilm.vercel.app-FE3131?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
  <a href="https://studiofilm.vercel.app/api/docs" target="_blank"><img src="https://img.shields.io/badge/API_DOCS-Swagger_OpenAPI-85EA2D?style=for-the-badge&logo=swagger&logoColor=09090B" alt="Swagger Docs" /></a>
</p>

<p>
  <img src="https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-18181B?style=for-the-badge&logo=vite&logoColor=646CFF" alt="Vite 8" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Express-5_Serverless-18181B?style=for-the-badge&logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/TMDB_%2B_Watchmode-BR-0D253F?style=for-the-badge&logo=themoviedatabase&logoColor=01B4E4" alt="TMDB and Watchmode" />
</p>

<br />

<a href="https://studiofilm.vercel.app" target="_blank">
  <img src="docs/screenshots/01-home-hero.png" alt="Tela principal do studio" width="100%" />
</a>

</div>

---

## ✨ O que o studio entrega

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>🎬 Vitrine Viva &amp; Player Contínuo</strong><br />
      <sub>Hero com transição atômica em 2 tempos, prévia de trailer que expande para tela cheia sem recarregar, grid de categorias, <code>TOP 10</code> arrastável e curadoria de aclamados 8.0+.</sub>
    </td>
    <td width="50%" valign="top">
      <strong>🧭 Explorar Unificado + Grátis no BR</strong><br />
      <sub>Filmes e séries juntos ou separados, dock multi-seleção de 8 streamings no Brasil, filtro <strong>Grátis no BR</strong> (21 mil+ títulos), sliders de ano/nota e infinite scroll automático.</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <strong>🎭 Detalhes, Artistas &amp; Deep-Links BR</strong><br />
      <sub>Páginas completas de filmes, séries (com temporadas/episódios) e artistas (biografia + filmografia filtrável), com links diretos para abrir o título no streaming via Watchmode.</sub>
    </td>
    <td width="50%" valign="top">
      <strong>⚡ Busca Spotlight &amp; Surpreenda-me</strong><br />
      <sub>Busca instantânea letra-a-letra (<code>/</code> ou <code>Ctrl+K</code>) com autocomplete inline (<code>Tab</code>), roleta inteligente de recomendações por clima e <strong>Minha Lista</strong> salva localmente.</sub>
    </td>
  </tr>
</table>

---

## 🏗️ Arquitetura

O frontend nunca fala direto com APIs privadas: todas as consultas passam por um **BFF Serverless em Express 5** na mesma origem (`/api/*`), que protege credenciais, aplica cache na borda da Vercel e combina dados do **TMDB** com os deep-links brasileiros da **Watchmode**.

<div align="center">
  <img src="docs/architecture.svg" alt="Fluxo de arquitetura do studio" width="100%" />
</div>

> **Documentação interativa da API:** acesse o Swagger em **[studiofilm.vercel.app/api/docs](https://studiofilm.vercel.app/api/docs)** (especificação OpenAPI 3.0 em [`/api/openapi.json`](https://studiofilm.vercel.app/api/openapi.json)).

---

## 🧠 Decisões & Desafios

- **BFF Serverless em vez de chaves no frontend:** `API_KEY` e `WATCHMODE_API_KEY` ficam 100% no servidor. O endpoint `/api/hero` faz a agregação em paralelo (`Promise.all`) evitando múltiplas chamadas no navegador.
- **Hero instantânea (sem carregar "faixa por faixa"):** troca dos backdrops 4K (`original`) para `w1280` pré-decodificados na GPU (`img.decode()`), com transição atômica que sincroniza fundo, título e preview no mesmo frame.
- **Player de trailer único e sem UI do YouTube:** um único `<iframe>` (`youtube-nocookie.com`) expande do card para tela cheia sem recarregar o vídeo. Na Hero, um pool persistente aquece ~3.6s de cada trailer em RAM para trocar slides sem novas requisições, enquanto crop + gate de tempo escondem 100% do chrome do YouTube.
- **Streamings no Brasil & proteção de cota:** normalização de 18 plataformas BR mesclando logos do TMDB com links diretos e ofertas gratuitas da Watchmode — protegido por cache FIFO de 24h e rate limit dedicado (25 req/min) para preservar o plano gratuito.
- **Explorar fluido e completo:** modo unificado (`Todos | Filmes | Séries`), filtro **Grátis no BR**, sliders de ano e nota com debounce, busca letra-a-letra com `AbortController`, cache LRU em memória e infinite scroll automático (`IntersectionObserver`).

---

## 🛡️ Segurança

<div align="center">
  <img src="docs/security-pipeline.svg" alt="Pipeline de 6 camadas de defesa em profundidade do studio" width="100%" />
</div>

<br />

| Ameaça | Mitigação |
| :--- | :--- |
| **Vazamento de chaves** | Credenciais exclusivamente em `process.env` no servidor, `maxRedirects: 0` no Axios e logs sanitizados sem URLs/chaves. |
| **SSRF & Path Traversal** | Regex estrito em todos os IDs e filtros + `isSafeHttpsUrl()` bloqueando IPs privados, credenciais embutidas e portas fora da `443`. |
| **DoS / Exaustão de RAM** | Rate limiter dual (`120/min` global + `25/min` Watchmode) por IP real (`x-real-ip`) com teto FIFO de 2.000 buckets. |
| **HPP & Log Injection** | Bloqueio de métodos de escrita (`405`), parâmetros duplicados (`400`), URLs > 512 chars (`414`) e caracteres `\r\n\0`. |
| **XSS & Clickjacking** | Headers CSP restritivos, HSTS (2 anos + preload), `X-Frame-Options: DENY` e validação de chaves YouTube antes do iframe. |
| **Prototype Pollution** | `Object.create(null)` na leitura do `localStorage` e imagens travadas ao CDN oficial `image.tmdb.org`. |

---

<div align="center">
  <sub>Feito por <a href="https://github.com/GabrielVSL"><strong>Gabriel VSL</strong></a> • <a href="https://studiofilm.vercel.app"><strong>studiofilm.vercel.app</strong></a></sub>
</div>
