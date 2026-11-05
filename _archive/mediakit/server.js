'use strict';

/**
 * MediaShelf - a small local web app for watching and saving media.
 *
 * Zero npm dependencies: only Node's standard library plus the external
 * `yt-dlp` and (optionally) `ffmpeg` binaries.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DOWNLOAD_DIR = path.join(ROOT, 'downloads');
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const COOKIES_FILE = process.env.COOKIES_FILE ? path.resolve(process.env.COOKIES_FILE) : '';
const WA_DIR = process.env.WA_STATUS_DIR ? path.resolve(process.env.WA_STATUS_DIR) : '';

const MAX_ACTIVE_JOBS = 2;
const MAX_JOBS_KEPT = 120;
const JOB_TTL_MS = 24 * 60 * 60 * 1000;

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

/* ------------------------------------------------------------------ */
/* Tool discovery                                                      */
/* ------------------------------------------------------------------ */

function probe(command, args) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
    });
    if (result.status === 0) return (result.stdout || '').trim();
  } catch {
    /* ignore */
  }
  return null;
}

function findYtDlp() {
  const binDir = path.join(ROOT, 'bin');
  const candidates = [
    process.env.YTDLP_PATH,
    path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
    'yt-dlp',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const version = probe(candidate, ['--version']);
    if (version) return { command: candidate, version: version.split(/\r?\n/)[0] };
  }
  return null;
}

function findFfmpeg() {
  const version = probe('ffmpeg', ['-version']);
  if (!version) return null;
  return version.split(/\r?\n/)[0];
}

const YTDLP = findYtDlp();
const FFMPEG = findFfmpeg();
const COOKIES_OK = Boolean(COOKIES_FILE && fs.existsSync(COOKIES_FILE));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function mimeFor(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJson(req, limitBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new HttpError(413, 'Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function contentDisposition(filename) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function streamFile(req, res, filePath, options = {}) {
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    return sendJson(res, 404, { error: 'File not found.' });
  }
  if (!stat.isFile()) return sendJson(res, 404, { error: 'File not found.' });

  const headers = {
    'Content-Type': mimeFor(filePath),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };
  if (options.download) {
    headers['Content-Disposition'] = contentDisposition(options.filename || path.basename(filePath));
  }

  const range = req.headers.range;
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (match && (match[1] || match[2])) {
    let start = match[1] ? Number(match[1]) : 0;
    let end = match[2] ? Number(match[2]) : stat.size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    end = Math.min(end, stat.size - 1);
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Length': end - start + 1,
    });
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }

  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  fs.createReadStream(filePath).pipe(res);
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^0\./.test(host) || /^169\.254\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  return false;
}

function parseMediaUrl(raw) {
  let url;
  try {
    url = new URL(String(raw || '').trim());
  } catch {
    throw new HttpError(400, 'That does not look like a valid link.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(400, 'Only http:// and https:// links are supported.');
  }
  if (isPrivateHost(url.hostname)) {
    throw new HttpError(400, 'Local and private network addresses are not allowed.');
  }
  return url;
}

function detectKind(url) {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    return 'youtube';
  }
  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') {
    return 'instagram';
  }
  return 'other';
}

/* ------------------------------------------------------------------ */
/* In-memory job store                                                 */
/* ------------------------------------------------------------------ */

const jobs = new Map();
const queue = [];
let activeCount = 0;

function publicJob(job) {
  return {
    id: job.id,
    url: job.url,
    kind: job.kind,
    mode: job.mode,
    quality: job.quality,
    height: job.height,
    fps: job.fps,
    title: job.title,
    status: job.status,
    stage: job.stage,
    percent: job.percent,
    speed: job.speed,
    eta: job.eta,
    totalSize: job.totalSize,
    fileSize: job.fileSize,
    fileName: job.fileName,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    downloadable: job.status === 'done' && Boolean(job.file),
  };
}

function createJob(input) {
  const url = parseMediaUrl(input.url);
  const mode = input.mode === 'audio' ? 'audio' : 'video';
  const quality = mode === 'video' ? String(input.quality || 'best') : 'audio';

  // Quality is either "best", "1080" or "1080@60" (height@fps).
  const qualityMatch = mode === 'video' ? /^(\d{2,4})(?:@(\d{2,3}))?$/.exec(quality) : null;
  let height = qualityMatch ? Number(qualityMatch[1]) : 0;
  const fps = qualityMatch && qualityMatch[2] ? Number(qualityMatch[2]) : 0;
  if (height && (height < 16 || height > 4320)) height = 0;

  const kind = ['youtube', 'instagram', 'other'].includes(input.kind) ? input.kind : detectKind(url);

  if (!YTDLP) {
    throw new HttpError(503, 'yt-dlp is not installed on this machine. Run `npm run setup` first.');
  }

  const job = {
    id: randomUUID(),
    url: url.toString(),
    kind,
    mode,
    quality,
    height,
    fps,
    title: typeof input.title === 'string' ? input.title.slice(0, 300) : '',
    status: 'queued',
    stage: 'waiting',
    percent: 0,
    speed: '',
    eta: '',
    totalSize: '',
    fileSize: 0,
    fileName: '',
    file: '',
    error: '',
    createdAt: Date.now(),
    finishedAt: 0,
    child: null,
    cancelled: false,
  };

  jobs.set(job.id, job);
  queue.push(job);
  pruneJobs();
  pumpQueue();
  return publicJob(job);
}

function pruneJobs() {
  if (jobs.size <= MAX_JOBS_KEPT) return;
  const finished = [...jobs.values()]
    .filter((job) => job.status === 'done' || job.status === 'error' || job.status === 'cancelled')
    .sort((a, b) => a.createdAt - b.createdAt);
  while (jobs.size > MAX_JOBS_KEPT && finished.length) {
    const job = finished.shift();
    jobs.delete(job.id);
  }
}

function pumpQueue() {
  while (activeCount < MAX_ACTIVE_JOBS && queue.length) {
    const job = queue.shift();
    activeCount += 1;
    runJob(job)
      .catch((error) => {
        job.status = 'error';
        job.error = error.message || String(error);
        job.finishedAt = Date.now();
      })
      .finally(() => {
        activeCount -= 1;
        pumpQueue();
      });
  }
}

function buildArgs(job) {
  const outputTemplate = path.join(DOWNLOAD_DIR, '%(title).150B [%(id)s].%(ext)s');
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--newline',
    '--progress',
    '--no-mtime',
    '--windows-filenames',
    '--trim-filenames',
    '190',
    '--socket-timeout',
    '25',
    '--retries',
    '3',
    '-o',
    outputTemplate,
  ];

  if (COOKIES_OK) args.push('--cookies', COOKIES_FILE);

  if (job.mode === 'audio') {
    args.push('-f', 'ba/b');
    if (FFMPEG) args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    const height = Number(job.height) || 0;
    const fps = Number(job.fps) || 0;

    // Prefer H.264 + AAC for MP4. YouTube's "best" video is often AV1 and its
    // best audio is Opus; that combination is valid inside MP4 but many desktop
    // players and older browsers cannot decode AV1, so the file plays as audio
    // only. H.264/AAC works everywhere. Above 1080p YouTube rarely offers
    // H.264, so try the requested high resolution first and only then fall back
    // to compatible 1080p instead of an incompatible mid-resolution AV1 file.
    const fpsMin = fps ? Math.max(24, fps - 5) : 0;
    const fpsFilter = fpsMin ? `[fps>=${fpsMin}]` : '';
    const resFilter = height ? `[height<=${height}]` : '';
    const filter = `${resFilter}${fpsFilter}`;

    const h264 = (f) => [
      `bv*${f}[vcodec^=avc1]+ba[ext=m4a]`,
      `bv*${f}[vcodec^=avc1]+ba`,
    ];
    const anyVideo = (f) => {
      const list = [`bv*${f}+ba`];
      if (f) list.push(`b${f}`);
      return list;
    };

    let candidates;
    if (!height || height <= 1080) {
      candidates = [...h264(filter), ...anyVideo(filter)];
    } else {
      candidates = [`bv*[height>1080]${filter}+ba`, ...h264(filter), ...anyVideo(filter)];
    }

    if (fpsMin) {
      // If the exact frame rate only exists in VP9/AV1, prefer a compatible
      // H.264 file at the same resolution over a higher-resolution AV1 one.
      if (height > 1080) {
        candidates.push(`bv*[height>1080]${resFilter}+ba`);
      }
      candidates.push(...h264(resFilter), ...anyVideo(resFilter));
    }

    candidates.push('bv*+ba/b');

    args.push('-f', candidates.join('/'));

    if (FFMPEG) args.push('--merge-output-format', 'mp4');

    const sort = [];
    if (height) sort.push(`res:${height}`);
    if (fps) sort.push('fps');
    if (sort.length) args.push('-S', sort.join(','));
  }

  args.push('--print', 'after_move:filepath', job.url);
  return args;
}

function cleanErrorText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const errorLine = [...lines].reverse().find((line) => /^ERROR:/i.test(line));
  const chosen = errorLine || lines[lines.length - 1] || '';
  return chosen.replace(/^ERROR:\s*/i, '').slice(0, 500);
}

function runJob(job) {
  return new Promise((resolve, reject) => {
    job.status = 'running';
    job.stage = 'starting';

    const args = buildArgs(job);
    let child;
    try {
      child = spawn(YTDLP.command, args, { windowsHide: true });
    } catch (error) {
      return reject(error);
    }
    job.child = child;

    let stderrTail = '';

    const handleLine = (rawLine) => {
      const line = rawLine.replace(/\x1b\[[0-9;]*m/g, '').trim();
      if (!line) return;

      if (line.includes('[Merger]')) job.stage = 'merging';
      else if (line.includes('[ExtractAudio]')) job.stage = 'converting audio';
      else if (line.includes('[Metadata]')) job.stage = 'writing metadata';

      const pct = /\[download\]\s+([\d.]+)%/.exec(line);
      if (pct) {
        job.stage = 'downloading';
        job.percent = Math.min(100, Number(pct[1]));
      }
      const size = /of\s+~?\s*([\d.]+\s*[KMGTP]?i?B)/i.exec(line);
      if (size) job.totalSize = size[1].replace(/\s+/g, '');
      const speed = /at\s+([\d.]+\s*[KMGTP]?i?B\/s)/i.exec(line);
      if (speed) job.speed = speed[1].replace(/\s+/g, '');
      const eta = /ETA\s+([\d:]+)/i.exec(line);
      if (eta) job.eta = eta[1];

      if (line.startsWith('[')) return;

      // `--print after_move:filepath` emits the final absolute path.
      try {
        if (fs.existsSync(line) && fs.statSync(line).isFile()) job.file = line;
      } catch {
        /* ignore */
      }
    };

    const attach = (stream) => {
      let buffer = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        buffer += chunk;
        const parts = buffer.split(/\r\n|\r|\n/);
        buffer = parts.pop();
        for (const part of parts) handleLine(part);
      });
      stream.on('end', () => {
        if (buffer.trim()) handleLine(buffer);
      });
    };

    attach(child.stdout);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      bufferAppend(chunk);
    });

    let stderrBuffer = '';
    function bufferAppend(chunk) {
      stderrBuffer += chunk;
      const parts = stderrBuffer.split(/\r\n|\r|\n/);
      stderrBuffer = parts.pop();
      for (const part of parts) {
        stderrTail = `${stderrTail}\n${part}`.slice(-4000);
        handleLine(part);
      }
    }

    child.on('error', (error) => reject(error));

    child.on('close', async (code) => {
      job.child = null;

      if (job.cancelled) {
        job.status = 'cancelled';
        job.finishedAt = Date.now();
        return resolve();
      }

      if (code === 0) {
        if (!job.file) job.file = await newestFileSince(job.createdAt);
        if (job.file) {
          try {
            const stat = await fsp.stat(job.file);
            job.fileSize = stat.size;
            job.fileName = path.basename(job.file);
          } catch {
            /* ignore */
          }
        }
        job.status = 'done';
        job.percent = 100;
        job.stage = 'finished';
        job.finishedAt = Date.now();
        return resolve();
      }

      job.status = 'error';
      job.error = cleanErrorText(stderrTail) || `Download failed (exit code ${code}).`;
      job.finishedAt = Date.now();
      resolve();
    });
  });
}

async function newestFileSince(timestamp) {
  try {
    const entries = await fsp.readdir(DOWNLOAD_DIR, { withFileTypes: true });
    let best = null;
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.endsWith('.part')) continue;
      const filePath = path.join(DOWNLOAD_DIR, entry.name);
      const stat = await fsp.stat(filePath);
      if (stat.mtimeMs >= timestamp - 2000 && (!best || stat.mtimeMs > best.mtimeMs)) {
        best = { path: filePath, mtimeMs: stat.mtimeMs };
      }
    }
    return best ? best.path : '';
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/* Link metadata                                                       */
/* ------------------------------------------------------------------ */

function ytInfo(url) {
  return new Promise((resolve, reject) => {
    const args = ['-J', '--no-playlist', '--no-warnings'];
    if (COOKIES_OK) args.push('--cookies', COOKIES_FILE);
    args.push(url);

    const child = spawn(YTDLP.command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new HttpError(504, 'Reading that link took too long. Try again.'));
    }, 45000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new HttpError(422, cleanErrorText(stderr) || 'Could not read that link.'));
      }
      try {
        const data = JSON.parse(stdout);

        // Only the resolutions we deliberately support (144p - 2160p). Several
        // codecs can share a resolution, so keep the most useful one per
        // height/frame-rate pair (prefer MP4, then the largest known size).
        const byKey = new Map();
        for (const format of data.formats || []) {
          const formatHeight = Number(format.height) || 0;
          if (!formatHeight || formatHeight > 2160 || format.vcodec === 'none') continue;
          const formatFps = Math.round(Number(format.fps) || 0);
          const filesize = Number(format.filesize) || Number(format.filesize_approx) || 0;
          const key = formatFps >= 50 ? `${formatHeight}@${formatFps}` : String(formatHeight);
          const candidate = {
            height: formatHeight,
            fps: formatFps,
            ext: format.ext || 'mp4',
            filesize,
          };

          const current = byKey.get(key);
          const better = !current
            || (candidate.filesize > 0 && current.filesize === 0)
            || (candidate.filesize > 0 && current.filesize > 0
              && ((candidate.ext === 'mp4' && current.ext !== 'mp4')
                || (candidate.ext === current.ext && candidate.filesize > current.filesize)));
          if (better) byKey.set(key, candidate);
        }

        const videoFormats = [...byKey.values()]
          .sort((a, b) => b.height - a.height || b.fps - a.fps);

        resolve({
          title: data.title || 'Untitled',
          uploader: data.uploader || data.channel || data.uploader_id || '',
          duration: Number(data.duration) || 0,
          thumbnail: data.thumbnail || '',
          webpageUrl: data.webpage_url || url,
          extractor: data.extractor_key || data.extractor || '',
          isLive: Boolean(data.is_live),
          viewCount: Number(data.view_count) || 0,
          kind: detectKind(new URL(url)),
          videoFormats: videoFormats.slice(0, 40),
        });
      } catch {
        reject(new HttpError(502, 'yt-dlp returned something unexpected for that link.'));
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* WhatsApp status browser                                             */
/* ------------------------------------------------------------------ */

const MEDIA_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.3gp', '.mkv', '.webm', '.mov',
  '.opus', '.mp3', '.m4a', '.ogg', '.wav',
]);

// Folders the user has explicitly scanned. Only these can be read back,
// so a crafted ?dir= query cannot browse the whole disk.
const allowedWaFolders = new Set();
if (WA_DIR) allowedWaFolders.add(path.resolve(WA_DIR));

/* Saved-status registry -------------------------------------------------
 * A small content fingerprint per file lets us remember what was already
 * saved, so the gallery can show only genuinely new statuses. Persisted to
 * data/status-saved.json and pruned after 90 days.
 */

const SAVED_STATUS_FILE = path.join(DATA_DIR, 'status-saved.json');
const SAVED_STATUS_TTL_MS = 90 * 24 * 60 * 60 * 1000;

let savedStatuses = loadSavedStatuses();

function loadSavedStatuses() {
  try {
    const raw = JSON.parse(fs.readFileSync(SAVED_STATUS_FILE, 'utf8'));
    const cutoff = Date.now() - SAVED_STATUS_TTL_MS;
    const clean = {};
    for (const [key, value] of Object.entries(raw || {})) {
      if (value && Number(value.savedAt) > cutoff) clean[key] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

let savedWriteQueue = Promise.resolve();
function persistSavedStatuses() {
  savedWriteQueue = savedWriteQueue
    .then(async () => {
      await fsp.mkdir(DATA_DIR, { recursive: true });
      const temp = `${SAVED_STATUS_FILE}.tmp`;
      await fsp.writeFile(temp, JSON.stringify(savedStatuses));
      await fsp.rename(temp, SAVED_STATUS_FILE);
    })
    .catch(() => {});
  return savedWriteQueue;
}

async function fingerprintFile(filePath, stat) {
  const length = Math.min(Math.max(stat.size, 0), 128 * 1024);
  if (!length) return `0:${path.basename(filePath)}`;
  const handle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    const hash = createHash('sha1').update(buffer.subarray(0, bytesRead)).digest('hex');
    return `${stat.size}:${hash}`;
  } finally {
    await handle.close();
  }
}

async function markStatusSaved(filePath, name) {
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return;
    const fingerprint = await fingerprintFile(filePath, stat);
    savedStatuses[fingerprint] = { name, size: stat.size, savedAt: Date.now() };
    await persistSavedStatuses();
  } catch {
    /* saving is best-effort; never block the download */
  }
}

function mediaKind(ext) {
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return 'image';
  if (['.opus', '.mp3', '.m4a', '.ogg', '.wav'].includes(ext)) return 'audio';
  return 'video';
}

async function scanStatusFolder(folder) {
  const base = path.resolve(folder);
  const stat = await fsp.stat(base).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new HttpError(404, 'That folder does not exist or is not a directory.');
  }

  allowedWaFolders.add(base);
  const entries = await fsp.readdir(base, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(ext)) continue;
    const full = path.join(base, entry.name);
    const info = await fsp.stat(full).catch(() => null);
    if (!info) continue;

    const fingerprint = await fingerprintFile(full, info).catch(() => '');
    files.push({
      name: entry.name,
      size: info.size,
      mtime: info.mtimeMs,
      kind: mediaKind(ext),
      saved: Boolean(fingerprint && savedStatuses[fingerprint]),
      url: `/api/wa/file?name=${encodeURIComponent(entry.name)}`,
      downloadUrl: `/api/wa/file?name=${encodeURIComponent(entry.name)}&dl=1`,
    });
  }

  files.sort((a, b) => b.mtime - a.mtime);
  const savedCount = files.filter((file) => file.saved).length;
  return {
    folder: base,
    count: files.length,
    savedCount,
    newCount: files.length - savedCount,
    files: files.slice(0, 400),
  };
}

function resolveInside(base, name) {
  const baseResolved = path.resolve(base);
  const target = path.resolve(baseResolved, name);
  if (target !== baseResolved && !target.startsWith(baseResolved + path.sep)) {
    throw new HttpError(400, 'Invalid file name.');
  }
  return target;
}

/* ------------------------------------------------------------------ */
/* Static files                                                        */
/* ------------------------------------------------------------------ */

async function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(PUBLIC_DIR, relative);
  if (target !== PUBLIC_DIR && !target.startsWith(PUBLIC_DIR + path.sep)) {
    return sendJson(res, 403, { error: 'Forbidden.' });
  }
  await streamFile(req, res, target);
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method || 'GET';

  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      ytdlp: YTDLP ? { available: true, version: YTDLP.version } : { available: false },
      ffmpeg: FFMPEG,
      cookies: COOKIES_OK,
      waDir: WA_DIR,
      downloadsDir: DOWNLOAD_DIR,
      activeJobs: activeCount,
      queuedJobs: queue.length,
    });
  }

  if (pathname === '/api/info' && method === 'POST') {
    const body = await readJson(req);
    const target = parseMediaUrl(body.url);
    if (!YTDLP) throw new HttpError(503, 'yt-dlp is not installed. Run `npm run setup`.');
    const info = await ytInfo(target.toString());
    return sendJson(res, 200, info);
  }

  if (pathname === '/api/jobs' && method === 'GET') {
    const list = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt).map(publicJob);
    return sendJson(res, 200, { jobs: list });
  }

  if (pathname === '/api/jobs' && method === 'POST') {
    const body = await readJson(req);
    return sendJson(res, 202, createJob(body));
  }

  const jobMatch = /^\/api\/jobs\/([a-f0-9-]{36})(\/file)?$/i.exec(pathname);
  if (jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) return sendJson(res, 404, { error: 'Unknown job.' });

    if (jobMatch[2]) {
      if (method !== 'GET' && method !== 'HEAD') {
        return sendJson(res, 405, { error: 'Method not allowed.' });
      }
      if (job.status !== 'done' || !job.file) {
        return sendJson(res, 409, { error: 'That file is not ready yet.' });
      }
      return streamFile(req, res, job.file, {
        download: true,
        filename: job.fileName || path.basename(job.file),
      });
    }

    if (method === 'GET') return sendJson(res, 200, publicJob(job));

    if (method === 'DELETE') {
      if (job.status === 'queued') {
        const index = queue.indexOf(job);
        if (index >= 0) queue.splice(index, 1);
        job.status = 'cancelled';
        job.finishedAt = Date.now();
      } else if (job.status === 'running' && job.child) {
        job.cancelled = true;
        job.child.kill();
      }
      return sendJson(res, 200, publicJob(job));
    }

    return sendJson(res, 405, { error: 'Method not allowed.' });
  }

  if (pathname === '/api/wa/scan' && method === 'POST') {
    const body = await readJson(req);
    const folder = body.dir ? String(body.dir) : '';
    if (!folder) {
      throw new HttpError(400, 'Enter the folder that contains your WhatsApp status files.');
    }
    return sendJson(res, 200, await scanStatusFolder(folder));
  }

  if (pathname === '/api/wa/file' && (method === 'GET' || method === 'HEAD')) {
    const folder = path.resolve(url.searchParams.get('dir') || WA_DIR || '');
    if (!folder || !allowedWaFolders.has(folder)) {
      return sendJson(res, 403, { error: 'Scan that folder from the app first.' });
    }
    const name = url.searchParams.get('name') || '';
    if (!name) return sendJson(res, 400, { error: 'Missing file name.' });
    const target = resolveInside(folder, name);
    const download = url.searchParams.get('dl') === '1';
    if (download && method === 'GET') await markStatusSaved(target, name);
    return streamFile(req, res, target, {
      download,
      filename: name,
    });
  }

  if (pathname === '/api/wa/reset' && method === 'POST') {
    savedStatuses = {};
    await persistSavedStatuses();
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Unknown API route.' });
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendJson(res, 400, { error: 'Bad request.' });
  }

  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(req, res, url.pathname);
    } else {
      sendJson(res, 405, { error: 'Method not allowed.' });
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error('[error]', error);
    if (!res.headersSent) sendJson(res, status, { error: error.message || 'Something went wrong.' });
    else res.end();
  }
});

/* ------------------------------------------------------------------ */
/* Housekeeping + start                                                */
/* ------------------------------------------------------------------ */

async function cleanupOldFiles() {
  const cutoff = Date.now() - JOB_TTL_MS;
  try {
    const entries = await fsp.readdir(DOWNLOAD_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(DOWNLOAD_DIR, entry.name);
      const stat = await fsp.stat(full).catch(() => null);
      if (stat && stat.mtimeMs < cutoff) await fsp.unlink(full).catch(() => {});
    }
  } catch {
    /* ignore */
  }

  for (const [id, job] of jobs) {
    if (job.finishedAt && job.finishedAt < cutoff) jobs.delete(id);
  }
}

setInterval(cleanupOldFiles, 60 * 60 * 1000).unref();
cleanupOldFiles();

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  MediaShelf is running');
  console.log(`  http://${HOST}:${PORT}`);
  console.log('');
  console.log(`  yt-dlp : ${YTDLP ? YTDLP.version : 'NOT FOUND - run "npm run setup"'}`);
  console.log(`  ffmpeg : ${FFMPEG ? 'available' : 'not found (audio conversion disabled)'}`);
  console.log(`  cookies: ${COOKIES_OK ? COOKIES_FILE : 'not configured'}`);
  console.log(`  saves  : ${DOWNLOAD_DIR}`);
  console.log('');
});
