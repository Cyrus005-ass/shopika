const THEME_IDS = Object.freeze([1, 2, 3]);
const MAX_PRODUCT_COLORS = 12;
const MAX_COLOR_NAME_LENGTH = 40;
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;

function readColors(value) {
  let colors = value;
  if (typeof colors === 'string') {
    try {
      colors = JSON.parse(colors);
    } catch {
      return [];
    }
  }

  const parsed = sanitizeColors(colors);
  return parsed.error || !parsed.value ? [] : parsed.value;
}

function sanitizeColors(colors) {
  if (colors === undefined || colors === null) {
    return { value: null, error: null };
  }
  if (!Array.isArray(colors)) {
    return { value: null, error: 'Les couleurs doivent être une liste.' };
  }
  if (colors.length > MAX_PRODUCT_COLORS) {
    return { value: null, error: `Un produit ne peut pas avoir plus de ${MAX_PRODUCT_COLORS} couleurs.` };
  }
  if (colors.length === 0) {
    return { value: null, error: null };
  }

  const value = [];
  for (const color of colors) {
    if (!color || typeof color !== 'object' || Array.isArray(color)) {
      return { value: null, error: 'Une couleur est invalide.' };
    }

    const name = typeof color.name === 'string' ? color.name.trim() : '';
    const hex = typeof color.hex === 'string' ? color.hex.trim() : '';
    const image = color.image === undefined || color.image === null || color.image === ''
      ? null
      : color.image;

    if (!name || name.length > MAX_COLOR_NAME_LENGTH) {
      return { value: null, error: `Le nom de chaque couleur doit contenir de 1 à ${MAX_COLOR_NAME_LENGTH} caractères.` };
    }
    if (!HEX_COLOR_PATTERN.test(hex)) {
      return { value: null, error: 'Le code couleur doit être au format hexadécimal #RRGGBB.' };
    }
    if (image !== null && typeof image !== 'string') {
      return { value: null, error: 'L’image de couleur est invalide.' };
    }

    value.push({ name, hex, image });
  }

  return { value, error: null };
}

module.exports = { THEME_IDS, readColors, sanitizeColors };
