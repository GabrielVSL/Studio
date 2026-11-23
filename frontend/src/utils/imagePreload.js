/**
 * Preloader e decodificador de imagens com cache em memória (singleton).
 * Garante que backdrops da Hero sejam baixados e decodificados na GPU antes da
 * transição, eliminando carregamento "faixa por faixa" e dessincronização entre
 * fundo, título e preview de trailer.
 */

const decodedSet = new Set();
const pendingMap = new Map();

export function isImageDecoded(url) {
  return Boolean(url && decodedSet.has(url));
}

export function preloadImage(url) {
  if (!url || typeof window === 'undefined') return Promise.resolve();
  if (decodedSet.has(url)) return Promise.resolve();
  if (pendingMap.has(url)) return pendingMap.get(url);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';

    const finish = (ok) => {
      if (ok) decodedSet.add(url);
      pendingMap.delete(url);
      resolve();
    };

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => finish(true))
          .catch(() => finish(true));
      } else {
        finish(true);
      }
    };

    img.onerror = () => finish(false);
    img.src = url;

    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => finish(true))
          .catch(() => finish(true));
      } else {
        finish(true);
      }
    }
  });

  pendingMap.set(url, promise);
  return promise;
}

/**
 * Aguarda uma imagem estar pronta/decodificada com teto de segurança (timeoutMs),
 * garantindo troca atômica sem travar a UI em conexões lentas.
 */
export function ensureImageDecoded(url, timeoutMs = 450) {
  if (!url || decodedSet.has(url)) return Promise.resolve();
  return Promise.race([
    preloadImage(url),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
