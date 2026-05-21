import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cacheDir } from './paths.js';
import { scoreFont, slugify } from './names.js';
import type { FontDetails, FontFormat, FontSummary } from './types.js';

const apiBase = 'https://gwfh.mranftl.com/api/fonts';
const cacheMaxAgeMs = 24 * 60 * 60 * 1000;

type CacheFile = {
  cachedAt: string;
  fonts: FontSummary[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': '@extoci/fonts' },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

export async function loadCatalog(options: { refresh?: boolean } = {}): Promise<FontSummary[]> {
  const path = join(cacheDir(), 'fonts.json');

  if (!options.refresh) {
    try {
      const cache = JSON.parse(await readFile(path, 'utf8')) as CacheFile;
      const age = Date.now() - new Date(cache.cachedAt).getTime();
      if (Array.isArray(cache.fonts) && age < cacheMaxAgeMs) {
        return cache.fonts;
      }
    } catch {
      // Cache misses should feel invisible.
    }
  }

  const fonts = await fetchJson<FontSummary[]>(apiBase);
  await mkdir(cacheDir(), { recursive: true });
  await writeFile(path, JSON.stringify({ cachedAt: new Date().toISOString(), fonts }, null, 2));
  return fonts;
}

export async function loadFont(idOrFamily: string): Promise<FontDetails> {
  return fetchJson<FontDetails>(`${apiBase}/${slugify(idOrFamily)}`);
}

export function searchFonts(fonts: FontSummary[], query: string): FontSummary[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) return [...fonts].sort((a, b) => (a.popularity ?? Number.MAX_SAFE_INTEGER) - (b.popularity ?? Number.MAX_SAFE_INTEGER));

  return fonts
    .filter((font) => terms.every((term) => font.family.toLowerCase().includes(term)))
    .sort((a, b) => scoreFont(a.family, query) - scoreFont(b.family, query) || a.family.localeCompare(b.family));
}

export function resolveFont(fonts: FontSummary[], query: string): FontSummary | null {
  const exact = fonts.find((font) => font.family.toLowerCase() === query.trim().toLowerCase());
  if (exact) return exact;

  const byId = fonts.find((font) => font.id === slugify(query));
  if (byId) return byId;

  const results = searchFonts(fonts, query);
  return results.length === 1 ? results[0] : null;
}

export function cssUrl(font: FontSummary, variants?: string[]): string {
  const family = font.family.trim().replace(/\s+/g, '+');
  return variants?.length ? `https://fonts.googleapis.com/css?family=${family}:${variants.join(',')}` : `https://fonts.googleapis.com/css?family=${family}`;
}

export function variantUrl(font: FontDetails, variantId: string, format: FontFormat): string | undefined {
  const variant = font.variants.find((item) => item.id === variantId);
  return variant?.[format];
}
