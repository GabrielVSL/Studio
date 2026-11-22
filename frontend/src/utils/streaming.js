import { sanitizeExternalUrl } from './security';

/**
 * Normaliza, desduplica e gera links diretos para plataformas de streaming no Brasil.
 * Mescla as logos oficiais do TMDB com os links diretos (web_url) e ofertas gratuitas da Watchmode.
 */

const PLATFORM_RULES = [
  {
    key: 'netflix',
    name: 'Netflix',
    match: /netflix/i,
    primaryIds: [8],
    fallbackLogo: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
    buildUrl: (q) => `https://www.netflix.com/search?q=${q}`,
  },
  {
    key: 'prime-video',
    name: 'Prime Video',
    match: /amazon\s*prime|prime\s*video|^amazon(\s*video)?$/i,
    primaryIds: [119, 10],
    fallbackLogo: '/pvske1MyAoymrs5bguRfVqYiM9a.jpg',
    buildUrl: (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
  },
  {
    key: 'disney-plus',
    name: 'Disney+',
    match: /disney/i,
    primaryIds: [337],
    fallbackLogo: '/97yvRBw1GzX7fXprcF80er19ot.jpg',
    buildUrl: (q) => `https://www.disneyplus.com/pt-br/search?q=${q}`,
  },
  {
    key: 'max',
    name: 'Max',
    match: /\b(hbo\s*max|max)\b/i,
    primaryIds: [1899, 384],
    fallbackLogo: '/jbe4gVSfRlbPTdESXhEKpornsfu.jpg',
    buildUrl: (q) => `https://play.max.com/search?q=${q}`,
  },
  {
    key: 'paramount-plus',
    name: 'Paramount+',
    match: /paramount/i,
    primaryIds: [531],
    fallbackLogo: '/xbhHHa1YgtpwhC8lb1NQ3ACVcLd.jpg',
    buildUrl: (q) => `https://www.paramountplus.com/br/search/?q=${q}`,
  },
  {
    key: 'apple-tv',
    name: 'Apple TV+',
    match: /apple\s*tv/i,
    primaryIds: [350, 2],
    fallbackLogo: '/2E03IAZsX4ZaUqM7tXlctEPMGWS.jpg',
    buildUrl: (q) => `https://tv.apple.com/br/search?term=${q}`,
  },
  {
    key: 'globoplay',
    name: 'Globoplay',
    match: /globoplay/i,
    primaryIds: [307],
    fallbackLogo: '/7Cg8esVVXOijXAm1f1vrS7jVjcN.jpg',
    buildUrl: (q) => `https://globoplay.globo.com/busca/?q=${q}`,
  },
  {
    key: 'telecine',
    name: 'Telecine',
    match: /telecine/i,
    primaryIds: [227],
    fallbackLogo: null,
    buildUrl: (q) => `https://globoplay.globo.com/busca/?q=${q}`,
  },
  {
    key: 'crunchyroll',
    name: 'Crunchyroll',
    match: /crunchyroll/i,
    primaryIds: [283],
    fallbackLogo: '/mXeC4TrcgdU6ltE9bCBCEORwSQR.jpg',
    buildUrl: (q) => `https://www.crunchyroll.com/pt-br/search?q=${q}`,
  },
  {
    key: 'claro-tv',
    name: 'Claro tv+',
    match: /claro/i,
    primaryIds: [167, 484],
    fallbackLogo: null,
    buildUrl: (q) => `https://www.clarotvmais.com.br/busca?q=${q}`,
  },
  {
    key: 'mercado-play',
    name: 'Mercado Play',
    match: /mercado\s*play/i,
    primaryIds: [2064],
    fallbackLogo: null,
    buildUrl: (q) => `https://play.mercadolivre.com.br/buscar?q=${q}`,
  },
  {
    key: 'pluto-tv',
    name: 'Pluto TV',
    match: /pluto\s*tv/i,
    primaryIds: [300],
    fallbackLogo: null,
    buildUrl: (q) => `https://pluto.tv/br/search?q=${q}`,
  },
  {
    key: 'mubi',
    name: 'MUBI',
    match: /\bmubi\b/i,
    primaryIds: [11],
    fallbackLogo: null,
    buildUrl: (q) => `https://mubi.com/pt/search?query=${q}`,
  },
  {
    key: 'mgm-plus',
    name: 'MGM+',
    match: /\bmgm/i,
    primaryIds: [2141, 636],
    fallbackLogo: null,
    buildUrl: (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`,
  },
  {
    key: 'universal-plus',
    name: 'Universal+',
    match: /universal/i,
    primaryIds: [2155],
    fallbackLogo: null,
    buildUrl: () => 'https://www.universalplus.com/br',
  },
  {
    key: 'looke',
    name: 'Looke',
    match: /looke/i,
    primaryIds: [47],
    fallbackLogo: null,
    buildUrl: (q) => `https://www.looke.com.br/search/${q}`,
  },
  {
    key: 'google-play',
    name: 'Google Play',
    match: /google\s*play/i,
    primaryIds: [3],
    fallbackLogo: null,
    buildUrl: (q) => `https://play.google.com/store/search?q=${q}&c=movies`,
  },
  {
    key: 'youtube',
    name: 'YouTube',
    match: /youtube/i,
    primaryIds: [192],
    fallbackLogo: null,
    buildUrl: (q) => `https://www.youtube.com/results?search_query=${q}`,
  },
];

// Verifica se é canal embutido (ex: "Paramount+ Amazon Channel", "MAX (Via Amazon Prime)")
const isChannelVariant = (name = '') =>
  /channel|premium|basic|standard|with ads|originals|\(via\s+/i.test(name);

export const resolvePlatformMeta = (provider, title = '') => {
  const rawName = provider?.provider_name || provider?.name || '';
  const encodedTitle = encodeURIComponent(title.trim());

  const cleanedForMatch = rawName
    .replace(/\s*\(via\s+[^)]+\)/gi, '')
    .replace(/\s*(amazon|apple\s*tv|roku|prime\s*video)\s*channels?/gi, '')
    .trim();

  const rule =
    PLATFORM_RULES.find((r) => r.match.test(cleanedForMatch)) ||
    PLATFORM_RULES.find((r) => r.match.test(rawName));

  if (rule) {
    return {
      key: rule.key,
      name: rule.name,
      fallbackLogo: rule.fallbackLogo,
      isPrimaryLogo:
        rule.primaryIds.includes(provider?.provider_id) || !isChannelVariant(rawName),
      isChannel: isChannelVariant(rawName),
      url: rule.buildUrl(encodedTitle),
    };
  }

  const cleanName = cleanedForMatch || rawName || 'Streaming';
  return {
    key: cleanName.toLowerCase().replace(/\s+/g, '-'),
    name: cleanName,
    fallbackLogo: null,
    isPrimaryLogo: !isChannelVariant(rawName),
    isChannel: isChannelVariant(rawName),
    url: `https://www.google.com/search?q=${encodeURIComponent(
      `Assistir ${title} ${cleanName}`
    )}`,
  };
};

const watchmodeTypePriority = (type = '') => {
  if (type === 'free') return 1;
  if (type === 'sub') return 2;
  if (type === 'rent') return 4;
  if (type === 'buy') return 5;
  return 6;
};

/**
 * Normaliza, desduplica e injeta links diretos reais (Watchmode web_url) + badges Grátis.
 */
export const getNormalizedPlatformsBR = (
  watchProvidersBR,
  title = '',
  watchmodeSources = []
) => {
  const byKey = new Map();

  // 1. Popula com as plataformas do TMDB (garantindo logos oficiais de alta qualidade)
  if (watchProvidersBR) {
    const buckets = [
      { list: watchProvidersBR.free || [], isFree: true, priority: 1 },
      { list: watchProvidersBR.ads || [], isFree: true, priority: 2 },
      { list: watchProvidersBR.flatrate || [], isFree: false, priority: 3 },
      { list: watchProvidersBR.rent || [], isFree: false, priority: 4 },
      { list: watchProvidersBR.buy || [], isFree: false, priority: 5 },
    ];

    for (const bucket of buckets) {
      for (const provider of bucket.list) {
        if (!provider?.provider_name) continue;
        const meta = resolvePlatformMeta(provider, title);
        const existing = byKey.get(meta.key);

        if (!existing) {
          byKey.set(meta.key, {
            key: meta.key,
            provider_id: provider.provider_id,
            name: meta.name,
            logo_path: provider.logo_path || meta.fallbackLogo,
            isPrimaryLogo: meta.isPrimaryLogo,
            isFree: bucket.isFree,
            priority: bucket.priority,
            url: meta.url,
            isDirectLink: false,
            directLinkScore: 99,
          });
        } else {
          if (bucket.isFree && !existing.isFree) {
            existing.isFree = true;
            existing.priority = Math.min(existing.priority, bucket.priority);
          }
          if (meta.isPrimaryLogo && !existing.isPrimaryLogo && provider.logo_path) {
            existing.logo_path = provider.logo_path;
            existing.provider_id = provider.provider_id;
            existing.isPrimaryLogo = true;
          }
        }
      }
    }
  }

  // 2. Enriquece com links diretos reais e ofertas gratuitas da Watchmode (BR)
  if (Array.isArray(watchmodeSources)) {
    for (const src of watchmodeSources) {
      const safeUrl = sanitizeExternalUrl(src?.web_url);
      if (!safeUrl || !src?.name) continue;

      const meta = resolvePlatformMeta({ name: src.name }, title);
      const isFree = src.type === 'free';
      const basePrio = watchmodeTypePriority(src.type);
      // Prefere link direto nativo (não canal embutido "(Via Amazon Prime)")
      const linkScore = basePrio + (meta.isChannel ? 10 : 0);

      const existing = byKey.get(meta.key);
      if (existing) {
        if (isFree) {
          existing.isFree = true;
          existing.priority = 1;
        }
        if (linkScore < existing.directLinkScore) {
          existing.url = safeUrl;
          existing.isDirectLink = true;
          existing.directLinkScore = linkScore;
        }
      } else {
        // Watchmode encontrou uma plataforma no BR (ex: Prime Video Grátis) ausente no TMDB
        byKey.set(meta.key, {
          key: meta.key,
          provider_id: src.source_id,
          name: meta.name,
          logo_path: meta.fallbackLogo,
          isPrimaryLogo: !meta.isChannel,
          isFree,
          priority: basePrio,
          url: safeUrl,
          isDirectLink: true,
          directLinkScore: linkScore,
        });
      }
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.priority - b.priority);
};
