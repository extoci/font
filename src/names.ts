export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function fileStem(family: string, variant: string): string {
  return `${family.replace(/[^a-zA-Z0-9]+/g, '')}-${variant}`;
}

export function normalizeVariant(variant: string): string {
  const value = variant.trim().toLowerCase();
  if (value === '400' || value === 'normal') return 'regular';
  if (value === '400italic' || value === 'normalitalic') return 'italic';
  return value;
}

export function scoreFont(fontFamily: string, query: string): number {
  const family = fontFamily.toLowerCase();
  const term = query.trim().toLowerCase();
  if (family === term) return 0;
  if (family.startsWith(term)) return 1;
  if (term.split(/\s+/).every((part) => family.includes(part))) return 2;
  return 3;
}
