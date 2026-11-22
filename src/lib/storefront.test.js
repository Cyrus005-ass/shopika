import { describe, expect, it } from 'vitest';
const { readColors, sanitizeColors, THEME_IDS } = require('./storefront');

describe('storefront helpers', () => {
  it('exposes the three supported storefront themes', () => {
    expect(THEME_IDS).toEqual([1, 2, 3]);
  });

  it('normalizes valid product colors and removes empty values', () => {
    expect(sanitizeColors([{ name: ' Rouge ', hex: ' #ff0000 ', image: '' }])).toEqual({
      value: [{ name: 'Rouge', hex: '#ff0000', image: null }],
      error: null,
    });
    expect(sanitizeColors([])).toEqual({ value: null, error: null });
  });

  it('rejects invalid colors and more than twelve entries', () => {
    expect(sanitizeColors([{ name: '', hex: '#fff' }]).error).toBeTruthy();
    expect(sanitizeColors(Array.from({ length: 13 }, (_, index) => ({
      name: `Color ${index}`,
      hex: '#000000',
    }))).error).toBeTruthy();
  });

  it('reads stored arrays and JSON strings, returning an empty list for invalid data', () => {
    const colors = [{ name: 'Bleu', hex: '#0000ff', image: null }];
    expect(readColors(colors)).toEqual(colors);
    expect(readColors(JSON.stringify(colors))).toEqual(colors);
    expect(readColors('not json')).toEqual([]);
    expect(readColors({})).toEqual([]);
  });
});
