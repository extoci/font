import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const appName = 'extoci-fonts';

export function dataDir(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', appName);
  }

  if (platform() === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), appName);
  }

  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), appName);
}

export function cacheDir(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Caches', appName);
  }

  if (platform() === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), appName, 'Cache');
  }

  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), appName);
}

export function manifestPath(): string {
  return join(dataDir(), 'installed.json');
}

export function systemFontDir(): string {
  if (platform() === 'darwin') {
    return join(homedir(), 'Library', 'Fonts');
  }

  if (platform() === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Microsoft', 'Windows', 'Fonts');
  }

  return join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'fonts');
}
