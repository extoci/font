import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { manifestPath } from './paths.js';
import type { InstalledFont, Manifest } from './types.js';

const emptyManifest: Manifest = { version: 1, fonts: [] };

export async function readManifest(): Promise<Manifest> {
  try {
    const raw = await readFile(manifestPath(), 'utf8');
    const parsed = JSON.parse(raw) as Manifest;
    return { version: 1, fonts: Array.isArray(parsed.fonts) ? parsed.fonts : [] };
  } catch {
    return emptyManifest;
  }
}

export async function writeManifest(manifest: Manifest): Promise<void> {
  await mkdir(dirname(manifestPath()), { recursive: true });
  await writeFile(manifestPath(), JSON.stringify(manifest, null, 2));
}

export async function upsertInstalled(entries: InstalledFont[]): Promise<void> {
  const manifest = await readManifest();
  const next = manifest.fonts.filter(
    (current) => !entries.some((entry) => entry.id === current.id && entry.variant === current.variant && entry.format === current.format)
  );
  next.push(...entries);
  await writeManifest({ version: 1, fonts: next.sort((a, b) => a.family.localeCompare(b.family) || a.variant.localeCompare(b.variant)) });
}

export async function removeInstalled(predicate: (font: InstalledFont) => boolean): Promise<InstalledFont[]> {
  const manifest = await readManifest();
  const removed = manifest.fonts.filter(predicate);
  const kept = manifest.fonts.filter((font) => !predicate(font));
  await writeManifest({ version: 1, fonts: kept });
  return removed;
}
