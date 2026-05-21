import { constants, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, dirname, join } from 'node:path';
import { platform, tmpdir } from 'node:os';
import { fileStem } from './names.js';
import { systemFontDir } from './paths.js';
import type { FontFormat } from './types.js';

export async function ensureWritableDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await access(path, constants.W_OK);
}

export async function downloadFile(url: string, path: string): Promise<void> {
  const response = await fetch(url, { headers: { 'user-agent': '@extoci/fonts' } });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download font (${response.status})`);
  }

  await mkdir(dirname(path), { recursive: true });
  const stream = createWriteStream(path);
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    response.body!.pipeTo(
      new WritableStream({
        write(chunk) {
          stream.write(Buffer.from(chunk));
        },
        close() {
          stream.end();
        },
        abort(reason) {
          stream.destroy(reason);
        },
      })
    ).catch(reject);
  });
}

export async function saveFontFile(options: {
  url: string;
  family: string;
  variant: string;
  format: FontFormat;
  dest: string;
}): Promise<string> {
  await ensureWritableDir(options.dest);
  const path = join(options.dest, `${fileStem(options.family, options.variant)}.${options.format}`);
  await downloadFile(options.url, path);
  return path;
}

export async function installFontFile(options: {
  url: string;
  family: string;
  variant: string;
  format: FontFormat;
}): Promise<string> {
  const dest = systemFontDir();
  const saved = await saveFontFile({ ...options, dest });

  if (platform() === 'linux') {
    await runOptional('fc-cache', ['-f', dest]);
  }

  if (platform() === 'win32') {
    await registerWindowsFont(saved);
  }

  return saved;
}

export async function removeFontFile(path: string): Promise<void> {
  await rm(path, { force: true });

  if (platform() === 'linux') {
    await runOptional('fc-cache', ['-f', systemFontDir()]);
  }
}

async function registerWindowsFont(path: string): Promise<void> {
  const name = basename(path);
  const script = join(tmpdir(), `extoci-font-${Date.now()}.ps1`);
  const content = [
    '$ErrorActionPreference = "Stop"',
    `$fontPath = ${JSON.stringify(path)}`,
    `$fontName = ${JSON.stringify(name)}`,
    '$fonts = (New-Object -ComObject Shell.Application).Namespace(0x14)',
    '$fonts.CopyHere($fontPath)',
    '$key = "HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts"',
    'New-Item -Path $key -Force | Out-Null',
    'New-ItemProperty -Path $key -Name $fontName -Value $fontPath -PropertyType String -Force | Out-Null',
  ].join('\n');

  await writeFile(script, content);
  try {
    await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script]);
  } finally {
    await rm(script, { force: true });
  }
}

function runOptional(command: string, args: string[]): Promise<void> {
  return run(command, args).catch(() => undefined);
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}
