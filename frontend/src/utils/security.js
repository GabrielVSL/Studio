const YOUTUBE_KEY_REGEX = /^[a-zA-Z0-9_-]{6,20}$/;
const NUMERIC_ID_REGEX = /^\d{1,10}$/;
const PRIVATE_HOST_REGEX =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[|::1)/i;

/**
 * Valida se uma chave de vídeo do YouTube tem formato seguro antes de injetar no iframe.
 */
export const isValidYouTubeKey = (key) =>
  typeof key === 'string' && YOUTUBE_KEY_REGEX.test(key);

/**
 * Valida se um ID numérico do TMDB tem formato válido.
 */
export const isValidNumericId = (id) =>
  typeof id === 'string' || typeof id === 'number'
    ? NUMERIC_ID_REGEX.test(String(id))
    : false;

/**
 * Sanitiza URLs externas vindas da API (proteção contra javascript:, data:, credenciais embutidas,
 * SSRF/endereços privados, portas fora do padrão e domínios não confiáveis).
 */
export const sanitizeExternalUrl = (rawUrl, allowedDomains = []) => {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.length > 500) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.port && parsed.port !== '443') return null;

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || PRIVATE_HOST_REGEX.test(hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return null;
    }

    if (allowedDomains.length > 0) {
      const allowed = allowedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      );
      if (!allowed) return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

/**
 * Valida se uma URL de imagem salva localmente pertence estritamente ao CDN oficial do TMDB.
 */
export const sanitizeTmdbImageUrl = (rawUrl) => {
  if (!rawUrl) return '';
  return sanitizeExternalUrl(rawUrl, ['image.tmdb.org']) || '';
};
