import { describe, expect, it } from 'vitest';
import { fileStem, normalizeVariant, slugify } from './names.js';

describe('font naming helpers', () => {
  it('creates gwfh-compatible slugs', () => {
    expect(slugify('Source Sans 3')).toBe('source-sans-3');
    expect(slugify('IBM Plex Mono')).toBe('ibm-plex-mono');
  });

  it('normalizes common Google Fonts variant aliases', () => {
    expect(normalizeVariant('400')).toBe('regular');
    expect(normalizeVariant('normal')).toBe('regular');
    expect(normalizeVariant('400italic')).toBe('italic');
    expect(normalizeVariant('700')).toBe('700');
  });

  it('creates filesystem-safe font file stems', () => {
    expect(fileStem('Source Sans 3', '700italic')).toBe('SourceSans3-700italic');
  });
});
