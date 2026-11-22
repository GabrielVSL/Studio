import { isValidNumericId, sanitizeTmdbImageUrl } from './security';

const FAVORITES_KEY = 'bhflix_favorites';
const LEGACY_FAVORITES_KEY = 'devflix_favorites';
const REVIEWS_KEY = 'bhflix_user_reviews';
const MAX_FAVORITES = 200;
const MAX_REVIEWS = 300;
const REVIEW_KEY_REGEX = /^(movie|tv)_\d{1,10}$/;

const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignora QuotaExceededError ou modo privado restrito
  }
};

const dispatchFavoritesEvent = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bhflix:favorites-updated'));
  }
};

const sanitizeFavoriteEntry = (item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  if (!isValidNumericId(item.id)) return null;
  const mediaType = item.mediaType === 'movie' ? 'movie' : 'tv';
  return {
    id: Number(item.id),
    title: String(item.title || 'Sem título').slice(0, 180),
    image: sanitizeTmdbImageUrl(item.image),
    rating: String(item.rating || 'N/A').slice(0, 10),
    year: item.year ? String(item.year).slice(0, 4) : '',
    mediaType,
    savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date().toISOString(),
  };
};

// Migra favoritos antigos do DevFlix automaticamente na primeira leitura
const migrateLegacyFavorites = () => {
  try {
    const current = localStorage.getItem(FAVORITES_KEY);
    const legacy = localStorage.getItem(LEGACY_FAVORITES_KEY);
    if (!current && legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map(sanitizeFavoriteEntry)
          .filter(Boolean)
          .slice(0, MAX_FAVORITES);
        safeSetItem(FAVORITES_KEY, JSON.stringify(normalized));
        return normalized;
      }
    }
  } catch {
    // Ignora erro de parse
  }
  return null;
};

export const getFavorites = () => {
  try {
    const migrated = migrateLegacyFavorites();
    if (migrated) return migrated;

    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeFavoriteEntry).filter(Boolean).slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
};

export const isFavorite = (id, mediaType = null) => {
  const favs = getFavorites();
  const strId = String(id);
  return favs.some(
    (m) =>
      String(m.id) === strId &&
      (!mediaType || (m.mediaType || 'tv') === mediaType)
  );
};

export const toggleFavorite = (item) => {
  if (!item || !isValidNumericId(item.id)) return false;
  const favs = getFavorites();
  const strId = String(item.id);
  const mediaType = item.mediaType === 'movie' ? 'movie' : 'tv';

  const exists = favs.some(
    (m) => String(m.id) === strId && (m.mediaType || 'tv') === mediaType
  );

  let updated;
  if (exists) {
    updated = favs.filter(
      (m) => !(String(m.id) === strId && (m.mediaType || 'tv') === mediaType)
    );
  } else {
    const cleanEntry = sanitizeFavoriteEntry({ ...item, mediaType, savedAt: new Date().toISOString() });
    if (!cleanEntry) return false;
    updated = [cleanEntry, ...favs].slice(0, MAX_FAVORITES);
  }

  safeSetItem(FAVORITES_KEY, JSON.stringify(updated));
  dispatchFavoritesEvent();
  return !exists;
};

// ==========================================
// AVALIAÇÕES E NOTAS PESSOAIS DO USUÁRIO
// ==========================================
const getReviewKey = (id, mediaType = 'tv') =>
  `${mediaType === 'movie' ? 'movie' : 'tv'}_${String(id)}`;

export const getAllUserReviews = () => {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    // Proteção contra poluição de protótipo e entradas inválidas
    const safe = Object.create(null);
    for (const [k, v] of Object.entries(parsed)) {
      if (!REVIEW_KEY_REGEX.test(k)) continue;
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      safe[k] = {
        rating: Math.min(5, Math.max(1, Math.round(Number(v.rating) || 1))),
        comment: typeof v.comment === 'string' ? v.comment.slice(0, 500) : '',
        updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '',
      };
    }
    return safe;
  } catch {
    return {};
  }
};

export const getUserReview = (id, mediaType = 'tv') => {
  if (!isValidNumericId(id)) return null;
  const all = getAllUserReviews();
  return all[getReviewKey(id, mediaType)] || null;
};

export const saveUserReview = (id, mediaType = 'tv', { rating, comment = '' }) => {
  if (!isValidNumericId(id)) return null;
  const all = getAllUserReviews();
  const key = getReviewKey(id, mediaType);
  const clampedRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 1)));
  const entry = {
    rating: clampedRating,
    comment: String(comment).trim().slice(0, 500),
    updatedAt: new Date().toISOString(),
  };

  const keys = Object.keys(all);
  if (keys.length >= MAX_REVIEWS && !(key in all)) {
    delete all[keys[0]];
  }

  all[key] = entry;
  safeSetItem(REVIEWS_KEY, JSON.stringify(all));
  return entry;
};

export const deleteUserReview = (id, mediaType = 'tv') => {
  if (!isValidNumericId(id)) return;
  const all = getAllUserReviews();
  const key = getReviewKey(id, mediaType);
  delete all[key];
  safeSetItem(REVIEWS_KEY, JSON.stringify(all));
};
