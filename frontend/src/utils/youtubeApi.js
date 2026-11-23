let apiPromise = null;

/**
 * Carrega a API oficial YouTube IFrame Player uma única vez (singleton).
 * Permite consultar as faixas reais de legenda (tracklist), qualidade disponível
 * e controlar legendas/áudio sem recarregar o iframe.
 */
export function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const existingReady = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      try {
        existingReady?.();
      } catch {
        // ignora callback prévio
      }
      resolve(window.YT || null);
    };

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => resolve(null);
      document.head.appendChild(tag);
    }

    // Fallback caso YT já tenha carregado antes do handler registrar
    const poll = setInterval(() => {
      if (window.YT && typeof window.YT.Player === 'function') {
        clearInterval(poll);
        resolve(window.YT);
      }
    }, 150);

    setTimeout(() => {
      clearInterval(poll);
      resolve(window.YT && typeof window.YT.Player === 'function' ? window.YT : null);
    }, 8000);
  });

  return apiPromise;
}

const LANG_LABELS = {
  'pt-BR': { label: 'Português (Brasil)', short: 'PT-BR', priority: 1 },
  pt: { label: 'Português', short: 'PT', priority: 2 },
  'pt-PT': { label: 'Português (Portugal)', short: 'PT', priority: 3 },
  en: { label: 'Inglês', short: 'EN', priority: 4 },
  'en-US': { label: 'Inglês (EUA)', short: 'EN', priority: 5 },
  'en-GB': { label: 'Inglês (RU)', short: 'EN', priority: 6 },
  es: { label: 'Espanhol', short: 'ES', priority: 7 },
  'es-419': { label: 'Espanhol (LatAm)', short: 'ES', priority: 8 },
  'es-ES': { label: 'Espanhol (Espanha)', short: 'ES', priority: 9 },
  fr: { label: 'Francês', short: 'FR', priority: 10 },
  it: { label: 'Italiano', short: 'IT', priority: 11 },
  de: { label: 'Alemão', short: 'DE', priority: 12 },
  ja: { label: 'Japonês', short: 'JA', priority: 13 },
  ko: { label: 'Coreano', short: 'KO', priority: 14 },
};

/**
 * Verifica se o YT.Player e seu <iframe> ainda estão anexados ao DOM ativo.
 * Evita o erro "The YouTube player is not attached to the DOM" do widgetapi.
 */
export function isYouTubePlayerAttached(player, iframeEl = null) {
  if (!player || typeof player !== 'object') return false;
  if (iframeEl && !iframeEl.isConnected) return false;
  try {
    if (typeof player.getIframe === 'function') {
      const targetIframe = player.getIframe();
      if (!targetIframe || !targetIframe.isConnected) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Descobre qual módulo de legendas ('captions' ou 'cc') está disponível no player.
 */
function getCaptionModule(player) {
  if (!isYouTubePlayerAttached(player)) return 'captions';
  try {
    const opts = player?.getOptions?.();
    if (Array.isArray(opts)) {
      if (opts.includes('captions')) return 'captions';
      if (opts.includes('cc')) return 'cc';
    }
  } catch {
    // ignora
  }
  return 'captions';
}

/**
 * Normaliza a tracklist real retornada pelo YouTube em opções limpas para o menu do player.
 */
export function extractCaptionOptions(player) {
  if (!isYouTubePlayerAttached(player) || typeof player.getOption !== 'function') {
    return { moduleName: 'captions', options: [], activeCode: 'off' };
  }

  const moduleName = getCaptionModule(player);
  let rawTracks = [];
  let activeTrack = null;

  try {
    const list = player.getOption(moduleName, 'tracklist');
    if (Array.isArray(list)) rawTracks = list;
    activeTrack = player.getOption(moduleName, 'track') || null;
  } catch {
    return { moduleName, options: [], activeCode: 'off' };
  }

  // Deduplica por languageCode (preferindo faixas manuais sobre auto-geradas ASR)
  const byCode = new Map();
  for (const t of rawTracks) {
    if (!t || !t.languageCode) continue;
    const existing = byCode.get(t.languageCode);
    if (!existing || (existing.kind === 'asr' && t.kind !== 'asr')) {
      byCode.set(t.languageCode, t);
    }
  }

  const options = Array.from(byCode.values()).map((track) => {
    const code = track.languageCode;
    const meta = LANG_LABELS[code] || LANG_LABELS[code.split('-')[0]];
    const isAuto = track.kind === 'asr';
    const baseLabel = meta?.label || track.displayName || code.toUpperCase();
    return {
      code,
      label: isAuto ? `${baseLabel} (Auto)` : baseLabel,
      short: meta?.short || code.split('-')[0].toUpperCase(),
      priority: meta?.priority ?? 50,
      track,
    };
  });

  // Se o vídeo não tiver faixa nativa em português, mas tiver alguma faixa traduzível,
  // oferece tradução automática para Português (BR) usando a melhor faixa base (preferindo EN).
  const hasNativePt = options.some((o) => o.code.toLowerCase().startsWith('pt'));
  if (!hasNativePt && rawTracks.length > 0) {
    const baseTrack =
      rawTracks.find((t) => t.languageCode?.startsWith('en') && t.is_translateable !== false) ||
      rawTracks.find((t) => t.is_translateable !== false) ||
      rawTracks[0];

    if (baseTrack) {
      options.push({
        code: 'pt-auto',
        label: 'Português (Traduzida)',
        short: 'PT',
        priority: 1,
        track: {
          ...baseTrack,
          translationLanguage: { languageCode: 'pt' },
        },
      });
    }
  }

  options.sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label, 'pt-BR'));

  let activeCode = 'off';
  if (activeTrack && activeTrack.languageCode) {
    if (activeTrack.translationLanguage?.languageCode?.startsWith('pt')) {
      activeCode = 'pt-auto';
    } else {
      activeCode = activeTrack.languageCode;
    }
  }

  return { moduleName, options, activeCode };
}

/**
 * Aplica ou desativa a legenda diretamente no YT.Player usando a faixa exata da tracklist.
 */
export function applyCaptionSelection(player, code, options = []) {
  if (!isYouTubePlayerAttached(player)) return false;
  const mod = getCaptionModule(player);

  try {
    if (code === 'off') {
      player.setOption?.('captions', 'track', {});
      player.setOption?.('cc', 'track', {});
      player.unloadModule?.('captions');
      player.unloadModule?.('cc');
      return true;
    }

    const match =
      options.find((o) => o.code === code) ||
      options.find((o) => o.code.toLowerCase().startsWith(code.toLowerCase()));

    player.loadModule?.(mod);

    if (match?.track) {
      player.setOption?.(mod, 'track', match.track);
      return true;
    }

    // Fallback se tracklist ainda não chegou
    player.setOption?.(mod, 'track', { languageCode: code });
    return false;
  } catch {
    return false;
  }
}
