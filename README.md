# studio

Plataforma editorial de descoberta de **filmes, séries, trailers oficiais e streamings no Brasil**, alimentada pelas APIs do **TMDB** e **Watchmode** e hospedada na **Vercel** (`https://studiofilm.vercel.app`).

---

## ✨ Funcionalidades

- **Hero Cinematográfica & Player Customizado:** Transição coreografada em 2 tempos com player de trailer em fonte única de verdade (`youtube-nocookie.com` + API `YT.Player`), tela cheia fluida e legendas sincronizadas com as faixas reais do vídeo.
- **Vitrine Viva na Home:** Galeria sanfona 3D de categorias com GSAP, curadoria renovada sem duplicar títulos da Hero, `TOP 10 Filmes` e `TOP 10 Séries` com arrasto lateral, *Aclamados pela Crítica*, *Estrelas em Destaque* e avaliação rápida interativa.
- **Explorar com Multi-Seleção:** Dock de streamings no Brasil (selecione vários ao mesmo tempo), gêneros em grade multi-seleção, filtros de período/ano exato, nota mínima e ordenação.
- **Links Diretos de Streaming (BR):** Integração com a **Watchmode API** (com cache 24h) para abrir títulos direto na Netflix, Prime Video, Max, Disney+, Apple TV+, Globoplay, Paramount+ e Crunchyroll, destacando ofertas gratuitas.
- **Busca Spotlight (`Ctrl+K` / `/`), Roleta "Surpreenda-me" e Minha Lista** persistida localmente.

---

## 🛡️ Segurança & Hardening

- **Chaves 100% Server-Side (`frontend/api/index.js`):** `API_KEY` e `WATCHMODE_API_KEY` nunca vão para o bundle do navegador.
- **Proteção contra Ataques na API:**
  - Validação estrita por regex em todos os parâmetros (anti-SSRF e anti-path traversal).
  - Proteção contra HTTP Parameter Pollution (HPP), bloqueio de URLs gigantes e métodos de escrita (`GET`/`HEAD`/`OPTIONS` apenas).
  - CORS restritivo (libera `localhost` somente fora da Vercel) + rate limiting por IP real com limite rígido de memória (anti-DoS) e cota dedicada para proteger o plano da Watchmode.
  - Validação defensiva de URLs externas (bloqueio de credenciais embutidas, IPs privados/localhost e portas fora do padrão) + handler global de erro sem vazamento de stack trace.
- **Headers HTTP & Edge (`frontend/vercel.json`):** `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy`, `Referrer-Policy` e `Permissions-Policy`.

---

## 🚀 Rodando Localmente

1. Copie `frontend/.env.example` para `frontend/.env` e preencha sua `API_KEY` do TMDB (e opcionalmente `WATCHMODE_API_KEY`).
2. Rode com um único comando — o Vite sobe o frontend e monta a API local automaticamente em `/api/*`:

```bash
cd frontend
npm install
npm run dev
```

*(Se rodar sem `API_KEY` no `.env`, o Vite faz proxy automático de `/api` para `https://studiofilm.vercel.app/api`.)*

---

## 🛠️ Stack

- **Frontend:** React 19, Vite, Tailwind CSS v4, GSAP, React Router, Lucide React
- **API Serverless:** Node.js, Express 5, Axios (Vercel Functions)
- **Dados:** [The Movie Database (TMDB)](https://www.themoviedb.org/) & [Watchmode](https://api.watchmode.com/)
