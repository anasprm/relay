'use strict';

/**
 * Downloads the standalone yt-dlp binary into ./bin so the app works
 * without a Python install. Safe to run more than once.
 */

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const BIN_DIR = path.join(ROOT, 'bin');
const IS_WIN = process.platform === 'win32';
const TARGET = path.join(BIN_DIR, IS_WIN ? 'yt-dlp.exe' : 'yt-dlp');
const ASSET = IS_WIN ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp';
const URL = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ASSET}`;

function versionOf(command) {
  try {
    const result = spawnSync(command, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
    if (result.status === 0) return (result.stdout || '').trim().split(/\r?\n/)[0];
  } catch {
    /* ignore */
  }
  return '';
}

async function main() {
  await fsp.mkdir(BIN_DIR, { recursive: true });

  const existing = versionOf(TARGET);
  if (existing) {
    console.log(`yt-dlp already installed in bin/ (version ${existing}).`);
    return;
  }

  const onPath = versionOf('yt-dlp');
  if (onPath) {
    console.log(`Found yt-dlp ${onPath} on your PATH - the app will use it.`);
    return;
  }

  console.log(`Downloading ${ASSET} …`);
  const response = await fetch(URL, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const temp = `${TARGET}.download`;
  await fsp.writeFile(temp, buffer);
  if (!IS_WIN) await fsp.chmod(temp, 0o755);
  await fsp.rename(temp, TARGET);

  const version = versionOf(TARGET);
  if (!version) throw new Error('Downloaded file did not run. Try installing yt-dlp manually.');
  console.log(`Installed yt-dlp ${version} into bin/.`);
}

main().catch((error) => {
  console.error(`\nSetup failed: ${error.message}`);
  console.error('Install yt-dlp manually: https://github.com/yt-dlp/yt-dlp#installation');
  process.exit(1);
});
