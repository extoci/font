#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadCatalog, loadFont, resolveFont, searchFonts, variantUrl } from './gwfh.js';
import { normalizeVariant } from './names.js';
import { readManifest, removeInstalled, upsertInstalled } from './manifest.js';
import { installFontFile, removeFontFile, saveFontFile } from './system.js';
import type { FontFormat, FontSummary, InstalledFont } from './types.js';

type Options = Record<string, string | boolean | string[]>;

const __dirname = dirname(fileURLToPath(import.meta.url));
const version = await readVersion();

main().catch((error: unknown) => {
  p.log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '-h' || command === '--help') return showHelp();
  if (command === '-v' || command === '--version') {
    console.log(version);
    return;
  }

  const parsed = parseArgs(args.slice(1));

  switch (command) {
    case 'add':
    case 'install':
    case 'i':
      await addCommand(parsed.positionals, parsed.options);
      return;
    case 'download':
    case 'dl':
      await downloadCommand(parsed.positionals, parsed.options);
      return;
    case 'find':
    case 'search':
      await findCommand(parsed.positionals, parsed.options);
      return;
    case 'list':
    case 'ls':
      await listCommand(parsed.options);
      return;
    case 'remove':
    case 'rm':
      await removeCommand(parsed.positionals, parsed.options);
      return;
    case 'update':
    case 'upgrade':
      await updateCommand(parsed.positionals, parsed.options);
      return;
    default:
      p.log.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

async function addCommand(positionals: string[], options: Options): Promise<void> {
  const refresh = Boolean(options.refresh || options['refresh-cache']);
  const yes = Boolean(options.yes);
  const format = readFormat(options);
  const fonts = await loadCatalog({ refresh });
  const selected = await selectFont(fonts, positionals.join(' '), yes);
  const variants = await selectVariants(selected, options, yes);
  const details = await loadFont(selected.id);
  const installed: InstalledFont[] = [];

  const spinner = p.spinner();
  spinner.start(`Installing ${selected.family}`);
  for (const variant of variants) {
    const url = variantUrl(details, variant, format);
    if (!url) continue;
    const path = await installFontFile({ url, family: selected.family, variant, format });
    installed.push({ id: selected.id, family: selected.family, variant, format, path, installedAt: new Date().toISOString() });
  }
  spinner.stop(`Installed ${installed.length} font file${installed.length === 1 ? '' : 's'}`);

  if (installed.length === 0) throw new Error(`No ${format.toUpperCase()} files found for selected variants.`);
  await upsertInstalled(installed);
  printResults(installed);
}

async function downloadCommand(positionals: string[], options: Options): Promise<void> {
  const refresh = Boolean(options.refresh || options['refresh-cache']);
  const yes = Boolean(options.yes);
  const format = readFormat(options);
  const dest = typeof options.dest === 'string' ? resolve(options.dest) : process.cwd();
  const fonts = await loadCatalog({ refresh });
  const selected = await selectFont(fonts, positionals.join(' '), yes);
  const variants = await selectVariants(selected, options, yes);
  const details = await loadFont(selected.id);
  const saved: InstalledFont[] = [];

  const spinner = p.spinner();
  spinner.start(`Downloading ${selected.family}`);
  for (const variant of variants) {
    const url = variantUrl(details, variant, format);
    if (!url) continue;
    const path = await saveFontFile({ url, family: selected.family, variant, format, dest });
    saved.push({ id: selected.id, family: selected.family, variant, format, path, installedAt: new Date().toISOString() });
  }
  spinner.stop(`Downloaded ${saved.length} font file${saved.length === 1 ? '' : 's'}`);

  if (saved.length === 0) throw new Error(`No ${format.toUpperCase()} files found for selected variants.`);
  printResults(saved);
}

async function findCommand(positionals: string[], options: Options): Promise<void> {
  const fonts = await loadCatalog({ refresh: Boolean(options.refresh || options['refresh-cache']) });
  let query = positionals.join(' ').trim();

  if (!query && !options.all) {
    const search = await p.text({ message: 'Search Google Fonts', placeholder: 'inter, mono, source sans' });
    if (p.isCancel(search)) return p.cancel('Search cancelled.');
    query = search.trim();
  }

  if (!options.select) {
    const allResults = searchFonts(fonts, query);
    const limit = typeof options.limit === 'string' ? Number(options.limit) : undefined;
    const results = limit ? allResults.slice(0, limit) : allResults;
    if (results.length === 0) {
      p.log.warn(`No fonts found for "${query}".`);
      return;
    }

    printFindResults(results, { total: allResults.length, query, limited: Boolean(limit && allResults.length > limit) });
    return;
  }

  if (!query) {
    p.log.info('Use a search term with --select, for example: font find inter --select');
    return;
  }

  const matches = searchFonts(fonts, query);
  if (matches.length === 0) {
    p.log.warn(`No fonts found for "${query}".`);
    return;
  }

  const selected = await chooseFont(matches.slice(0, 50));
  if (selected) printFontBlock(selected);
}

async function listCommand(options: Options): Promise<void> {
  const manifest = await readManifest();
  if (options.json) {
    console.log(JSON.stringify(manifest.fonts, null, 2));
    return;
  }

  if (manifest.fonts.length === 0) {
    p.log.info('No fonts installed by this CLI yet.');
    return;
  }

  for (const font of manifest.fonts) {
    console.log(`${pc.bold(font.family)} ${pc.dim(font.variant)} ${pc.dim(font.path)}`);
  }
}

async function removeCommand(positionals: string[], options: Options): Promise<void> {
  const manifest = await readManifest();
  const query = positionals.join(' ').trim().toLowerCase();
  const matches = query
    ? manifest.fonts.filter((font) => font.family.toLowerCase() === query || font.id === query)
    : await selectInstalledFonts(manifest.fonts);

  if (matches.length === 0) {
    p.log.warn(query ? `No installed font found for "${query}".` : 'No fonts selected.');
    return;
  }

  if (!options.yes) {
    const ok = await p.confirm({ message: `Remove ${matches.length} installed font file${matches.length === 1 ? '' : 's'}?`, initialValue: true });
    if (p.isCancel(ok) || !ok) return p.cancel('Remove cancelled.');
  }

  for (const font of matches) await removeFontFile(font.path);
  await removeInstalled((font) => matches.some((match) => match.path === font.path));
  p.log.success(`Removed ${matches.length} font file${matches.length === 1 ? '' : 's'}.`);
}

async function updateCommand(positionals: string[], options: Options): Promise<void> {
  const manifest = await readManifest();
  const query = positionals.join(' ').trim().toLowerCase();
  const targets = query ? manifest.fonts.filter((font) => font.family.toLowerCase() === query || font.id === query) : manifest.fonts;

  if (targets.length === 0) {
    p.log.info(query ? `No installed font found for "${query}".` : 'No fonts installed by this CLI yet.');
    return;
  }

  const updated: InstalledFont[] = [];
  const grouped = new Map<string, InstalledFont[]>();
  for (const target of targets) {
    const key = `${target.id}:${target.format}`;
    grouped.set(key, [...(grouped.get(key) ?? []), target]);
  }

  for (const group of grouped.values()) {
    const first = group[0];
    const details = await loadFont(first.id);
    for (const current of group) {
      const url = variantUrl(details, current.variant, current.format);
      if (!url) continue;
      await removeFontFile(current.path);
      const path = await installFontFile({ url, family: current.family, variant: current.variant, format: current.format });
      updated.push({ ...current, path, installedAt: new Date().toISOString() });
    }
  }

  await upsertInstalled(updated);
  p.log.success(`Updated ${updated.length} font file${updated.length === 1 ? '' : 's'}.`);
}

async function selectFont(fonts: FontSummary[], query: string, yes: boolean): Promise<FontSummary> {
  if (query) {
    const exact = resolveFont(fonts, query);
    if (exact) return exact;

    const matches = searchFonts(fonts, query).slice(0, 8);
    if (yes || matches.length === 0) throw new Error(`Could not uniquely resolve "${query}". Try: ${matches.map((font) => font.family).join(', ')}`);
    const selected = await chooseFont(matches);
    if (!selected) throw new Error('No font selected.');
    return selected;
  }

  const search = await p.text({ message: 'Search Google Fonts', placeholder: 'Inter' });
  if (p.isCancel(search)) throw new Error('Cancelled.');
  const matches = searchFonts(fonts, search).slice(0, 30);
  const selected = await chooseFont(matches);
  if (!selected) throw new Error('No font selected.');
  return selected;
}

async function chooseFont(fonts: FontSummary[]): Promise<FontSummary | null> {
  if (fonts.length === 0) return null;
  const value = await p.select({
    message: 'Select a font',
    options: fonts.map((font) => ({
      label: font.family,
      value: font.id,
      hint: [font.category, font.variants.length ? `${font.variants.length} variants` : undefined].filter(Boolean).join(' · '),
    })),
  });
  if (p.isCancel(value)) return null;
  return fonts.find((font) => font.id === value) ?? null;
}

async function selectVariants(font: FontSummary, options: Options, yes: boolean): Promise<string[]> {
  const raw = typeof options.variants === 'string' ? options.variants : typeof options.variant === 'string' ? options.variant : '';
  if (raw) return raw.split(',').map(normalizeVariant).filter(Boolean);
  if (yes) return [font.defVariant ?? 'regular'];

  const selected = await p.multiselect({
    message: 'Select variants',
    required: true,
    initialValues: [font.defVariant ?? 'regular'],
    options: font.variants.map((variant) => ({ label: variant, value: variant })),
  });

  if (p.isCancel(selected)) throw new Error('Cancelled.');
  return selected.map(normalizeVariant);
}

async function selectInstalledFonts(fonts: InstalledFont[]): Promise<InstalledFont[]> {
  if (fonts.length === 0) return [];
  const selected = await p.multiselect({
    message: 'Select installed fonts to remove',
    required: true,
    options: fonts.map((font) => ({
      label: `${font.family} ${font.variant}`,
      value: font.path,
      hint: font.format,
    })),
  });
  if (p.isCancel(selected)) return [];
  return fonts.filter((font) => selected.includes(font.path));
}

function parseArgs(args: string[]): { positionals: string[]; options: Options } {
  const positionals: string[] = [];
  const options: Options = {};

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }

    const key = arg.replace(/^-+/, '');
    const normalized = key === 'v' ? 'variants' : key === 'd' ? 'dest' : key === 'y' ? 'yes' : key;
    const next = args[index + 1];
    if (next && !next.startsWith('-') && !['yes', 'ttf', 'woff2', 'json', 'refresh', 'all', 'select'].includes(normalized)) {
      options[normalized] = next;
      index++;
    } else {
      options[normalized] = true;
    }
  }

  return { positionals, options };
}

function readFormat(options: Options): FontFormat {
  return options.woff2 ? 'woff2' : 'ttf';
}

function printFindResults(fonts: FontSummary[], meta: { total: number; query: string; limited: boolean }): void {
  const shown = fonts.length;
  const title = meta.query ? `Found ${shown}${meta.limited ? ` of ${meta.total}` : ''} for "${meta.query}"` : `Google Fonts catalog (${shown})`;
  console.log();
  console.log(`${pc.bold(title)}`);
  console.log(pc.dim('─'.repeat(Math.min(process.stdout.columns || 80, 96))));
  fonts.forEach((font, index) => printFontBlock(font, index === fonts.length - 1));
}

function printFontBlock(font: FontSummary, isLast = true): void {
  const meta = [
    font.category,
    `${font.variants.length} variant${font.variants.length === 1 ? '' : 's'}`,
    font.version,
  ].filter(Boolean);
  const css = `https://fonts.googleapis.com/css?family=${font.family.replace(/\s+/g, '+')}`;

  console.log(`${pc.bold(font.family)} ${pc.dim(meta.join(' · '))}`);
  const variantLines = wrapList(font.variants, terminalWidth() - 13);
  variantLines.forEach((line, index) => {
    const label = index === 0 ? pc.dim('variants') : '        ';
    console.log(`  ${label} ${line}`);
  });
  console.log(`  ${pc.dim('css')}      ${pc.cyan(css)}`);
  if (!isLast) console.log();
}

function printResults(results: InstalledFont[]): void {
  for (const result of results) {
    console.log(`${pc.green('✓')} ${result.family} ${pc.dim(result.variant)} ${result.path}`);
  }
}

async function readVersion(): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(resolve(__dirname, '..', 'package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function showHelp(): void {
  console.log(`
${pc.bold('Usage:')} font <command> [options]

${pc.bold('Commands:')}
  add, install <font>       Install a Google Font
  download <font>           Save font files to a folder
  find, search [query]      Search Google Fonts
  list, ls                  List fonts installed by this CLI
  remove, rm [font]         Remove installed font files
  update [font]             Reinstall installed fonts from latest source

${pc.bold('Options:')}
  -v, --variants <list>     Comma-separated variants, e.g. regular,700
  -d, --dest <folder>       Download destination
  --woff2                   Download WOFF2 instead of TTF
  --refresh                 Refresh the Google Fonts catalog cache
  -y, --yes                 Skip prompts where possible
  --json                    JSON output for list
  --all                     Print the full Google Fonts catalog
  --select                  Pick one narrowed find result interactively
  -h, --help                Show help
  --version                 Show version

${pc.bold('Examples:')}
  font add inter
  font add inter -v regular,700
  font add
  font download "Source Sans 3" --dest ./fonts --woff2
  font find mono
  font find --all
  font remove inter
`);
}

function terminalWidth(): number {
  return Math.max(60, Math.min(process.stdout.columns || 88, 120));
}

function wrapList(items: string[], width: number): string[] {
  const lines: string[] = [];
  let current = '';

  for (const item of items) {
    const next = current ? `${current}, ${item}` : item;
    if (next.length > width && current) {
      lines.push(current);
      current = item;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}
