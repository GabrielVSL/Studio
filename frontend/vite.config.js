import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const resolveFrontendRoot = () => {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'api', 'index.js'))) return cwd;
  const sub = path.join(cwd, 'frontend');
  if (fs.existsSync(path.join(sub, 'api', 'index.js'))) return sub;
  return cwd;
};

const localStudioApiPlugin = (env, frontendRoot) => ({
  name: 'studio-local-api',
  async configureServer(server) {
    if (!env.API_KEY) return;

    // Garante que API_KEY e WATCHMODE_API_KEY estejam disponíveis antes do import de api/index.js
    if (!process.env.API_KEY) process.env.API_KEY = env.API_KEY;
    if (!process.env.WATCHMODE_API_KEY && env.WATCHMODE_API_KEY) {
      process.env.WATCHMODE_API_KEY = env.WATCHMODE_API_KEY;
    }

    const apiFilePath = path.resolve(frontendRoot, 'api/index.js');
    const apiEntryUrl = pathToFileURL(apiFilePath).href;
    let currentApiApp = (await import(apiEntryUrl)).default;

    // Recarrega automaticamente api/index.js quando houver alterações em dev
    server.watcher.on('change', async (changedFile) => {
      if (path.resolve(changedFile) === apiFilePath) {
        try {
          const fresh = await import(`${apiEntryUrl}?t=${Date.now()}`);
          if (fresh?.default) currentApiApp = fresh.default;
        } catch (err) {
          console.error('[studio-local-api] Erro ao recarregar api/index.js:', err);
        }
      }
    });

    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/api')) {
        return currentApiApp(req, res, next);
      }
      return next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const frontendRoot = resolveFrontendRoot();
  const env = loadEnv(mode, frontendRoot, '');
  const hasLocalApiKey = Boolean(env.API_KEY || process.env.API_KEY);

  return {
    plugins: [react(), localStudioApiPlugin(env, frontendRoot)],
    server: hasLocalApiKey
      ? undefined
      : {
          proxy: {
            '/api': {
              target: 'https://studiofilm.vercel.app',
              changeOrigin: true,
            },
          },
        },
  };
});
