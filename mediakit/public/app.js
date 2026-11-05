'use strict';

/* ------------------------------------------------------------------ */
/* Tiny helpers                                                        */
/* ------------------------------------------------------------------ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  health: null,
  kind: 'youtube',
  mode: 'video',
  jobs: new Map(),
  pollTimer: null,
  waDir: '',
  waFiles: [],
  waFilter: 'new',
  lightboxFile: null,
};

let toastTimer = null;
function toast(message, bad = false) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.toggle('bad', bad);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    /* ignore */
  }
  if (!response.ok) {
    throw new Error((payload && payload.error) || `Request failed (${response.status})`);
  }
  return payload;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

const PANELS = ['watch', 'download', 'wa'];

const PAGE_META = {
  home: ['Overview', 'Watch, download, or browse status media.'],
  watch: ['Watch', 'Play a link in a clean, distraction-free player.'],
  download: ['Download', 'Save video or audio from a link you have rights to.'],
  wa: ['Statuses', 'Preview and save WhatsApp status files from your phone.'],
};

function updatePage(name) {
  const [title, sub] = PAGE_META[name] || PAGE_META.home;
  $('#pageTitle').textContent = title;
  $('#pageSub').textContent = sub;
  document.title = name === 'home' ? 'MediaShelf — watch & save' : `${title} · MediaShelf`;
  $$('[data-nav]').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.nav === name);
  });
}

function showPanel(name) {
  $('#home').hidden = true;
  PANELS.forEach((panel) => {
    $(`#panel-${panel}`).hidden = panel !== name;
  });
  updatePage(name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() {
  PANELS.forEach((panel) => {
    $(`#panel-${panel}`).hidden = true;
  });
  $('#home').hidden = false;
  updatePage('home');
  loadRecent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('[data-open]').forEach((control) => {
  control.addEventListener('click', () => {
    const target = control.dataset.open;
    if (target === 'home') {
      showHome();
      return;
    }
    if (target === 'download' && control.dataset.kind) setKind(control.dataset.kind);
    showPanel(target);
  });
});

$$('[data-back]').forEach((button) => button.addEventListener('click', showHome));

/* ------------------------------------------------------------------ */
/* Recent downloads (home)                                             */
/* ------------------------------------------------------------------ */

async function loadRecent() {
  const list = $('#recentList');
  if (!list) return;

  let jobs;
  try {
    ({ jobs } = await api('/api/jobs'));
  } catch {
    return;
  }

  const finished = jobs
    .filter((job) => job.status === 'done' || job.status === 'error' || job.status === 'cancelled')
    .slice(0, 5);

  if (!finished.length) {
    list.innerHTML = '<p class="empty">Nothing yet. Downloads you start will appear here.</p>';
    return;
  }

  list.innerHTML = '';
  for (const job of finished) {
    const row = document.createElement('div');
    row.className = 'recent-item';

    const main = document.createElement('div');
    main.className = 'recent-main';

    const name = document.createElement('span');
    name.className = 'recent-name';
    name.textContent = job.fileName || job.title || job.url;
    name.title = job.title || job.url;

    const meta = document.createElement('span');
    meta.className = 'recent-meta';
    const bits = [job.mode === 'audio' ? 'MP3' : 'MP4'];
    if (job.status === 'done') bits.push(job.fileSize ? formatBytes(job.fileSize) : 'saved');
    else bits.push(job.status);
    meta.textContent = bits.join(' · ');

    main.append(name, meta);
    row.appendChild(main);

    if (job.status === 'done' && job.downloadable) {
      const save = document.createElement('a');
      save.className = 'recent-save';
      save.href = `/api/jobs/${job.id}/file`;
      save.setAttribute('download', job.fileName || '');
      save.textContent = 'Save';
      row.appendChild(save);
    }

    list.appendChild(row);
  }
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

async function loadHealth() {
  const badge = $('#backendStatus');
  try {
    const health = await api('/api/health');
    state.health = health;

    if (!health.ytdlp.available) {
      badge.className = 'status bad';
      badge.innerHTML = '<span class="dot"></span> yt-dlp missing';
      toast('yt-dlp is not installed. Downloads are disabled until you run `npm run setup`.', true);
    } else {
      badge.className = 'status ok';
      badge.innerHTML = '<span class="dot"></span> Ready';
      badge.title = `yt-dlp ${health.ytdlp.version}${health.ffmpeg ? ' · ffmpeg available' : ''}`;
    }

    if (health.waDir) {
      $('#waPath').value = health.waDir;
      state.waDir = health.waDir;
    } else {
      const saved = localStorage.getItem('mediakit.waDir');
      if (saved) $('#waPath').value = saved;
    }
  } catch {
    badge.className = 'status bad';
    badge.innerHTML = '<span class="dot"></span> server offline';
  }
}

/* ------------------------------------------------------------------ */
/* Watch                                                               */
/* ------------------------------------------------------------------ */

function youtubeId(raw) {
  try {
    const url = new URL(raw.trim());
    if (url.hostname === 'youtu.be' || url.hostname.endsWith('.youtu.be')) {
      return url.pathname.split('/').filter(Boolean)[0] || null;
    }
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const match = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,})/);
    if (match) return match[1];
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

$('#watchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const value = $('#watchUrl').value.trim();
  const id = youtubeId(value);
  if (!id) {
    toast('That does not look like a YouTube link.', true);
    return;
  }
  const frame = $('#watchFrame');
  frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`;
  $('#watchPlayer').hidden = false;
  $('#watchLink').href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
});

/* ------------------------------------------------------------------ */
/* Download panel                                                      */
/* ------------------------------------------------------------------ */

const KIND_COPY = {
  youtube: {
    title: 'Download from YouTube',
    hint: 'Paste a video, Short or live replay link. Playlists are downloaded one video at a time.',
    placeholder: 'https://www.youtube.com/watch?v=…',
  },
  instagram: {
    title: 'Download from Instagram',
    hint: 'Public posts and reels work without login. Private accounts need a cookies file (see README).',
    placeholder: 'https://www.instagram.com/reel/…',
  },
  other: {
    title: 'Download from any supported site',
    hint: 'Anything yt-dlp supports: Vimeo, Reddit, X, Facebook, TikTok, direct media links and more.',
    placeholder: 'https://…',
  },
};

function setKind(kind) {
  state.kind = kind;
  const copy = KIND_COPY[kind] || KIND_COPY.other;
  $('#dlTitle').textContent = copy.title;
  $('#dlHint').textContent = copy.hint;
  $('#dlUrl').placeholder = copy.placeholder;
  $$('#kindGroup .seg').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.kind === kind);
  });
  $('#dlInfo').hidden = true;
  resetQualities();
}

const DEFAULT_QUALITIES = [
  ['best', 'Best available'],
  ['2160', '2160p / 4K'],
  ['1440', '1440p / 2K'],
  ['1080', '1080p / Full HD'],
  ['720', '720p / HD'],
  ['480', '480p'],
  ['360', '360p'],
  ['240', '240p'],
  ['144', '144p'],
];

const DEFAULT_QUALITY_NOTE = 'Press “Preview info” to list this video’s exact formats.';

function resetQualities() {
  const select = $('#dlQuality');
  select.innerHTML = '';
  for (const [value, label] of DEFAULT_QUALITIES) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
  select.value = '1080';
  $('#dlQualityNote').textContent = DEFAULT_QUALITY_NOTE;
}

/** Replace the static list with the formats this specific video actually has. */
function populateQualities(formats) {
  if (!Array.isArray(formats) || !formats.length) return;

  const select = $('#dlQuality');
  const previous = select.value;
  select.innerHTML = '';

  const best = document.createElement('option');
  best.value = 'best';
  best.textContent = 'Best available';
  select.appendChild(best);

  let count = 0;
  for (const format of formats) {
    const height = Number(format && format.height);
    if (!height) continue;
    const rawFps = Number(format.fps) || 0;
    const highFps = rawFps >= 50 ? Math.round(rawFps) : 0;
    const value = highFps ? `${height}@${highFps}` : String(height);
    if ([...select.options].some((option) => option.value === value)) continue;

    const option = document.createElement('option');
    option.value = value;
    const size = Number(format.filesize) ? ` · ~${formatBytes(format.filesize)}` : '';
    option.textContent = `${height}p${highFps || ''}${size}`;
    select.appendChild(option);
    count += 1;
  }

  $('#dlQualityNote').textContent = count
    ? `${count} format${count === 1 ? '' : 's'} found for this video.`
    : DEFAULT_QUALITY_NOTE;

  if ([...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

$$('#kindGroup .seg').forEach((button) => {
  button.addEventListener('click', () => setKind(button.dataset.kind));
});

function setMode(mode) {
  state.mode = mode;
  $$('#modeGroup .seg').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === mode);
  });
  $('#qualityField').style.visibility = mode === 'audio' ? 'hidden' : 'visible';
}

$$('#modeGroup .seg').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

$('#dlInfoBtn').addEventListener('click', async () => {
  const url = $('#dlUrl').value.trim();
  if (!url) {
    toast('Paste a link first.', true);
    return;
  }
  const button = $('#dlInfoBtn');
  button.disabled = true;
  button.textContent = 'Reading…';
  try {
    const info = await api('/api/info', { method: 'POST', body: JSON.stringify({ url }) });
    renderInfo(info);
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Preview info';
  }
});

function renderInfo(info) {
  populateQualities(info.videoFormats);

  const box = $('#dlInfo');
  box.innerHTML = '';

  const thumb = document.createElement('img');
  thumb.alt = '';
  thumb.loading = 'lazy';
  thumb.referrerPolicy = 'no-referrer';
  if (info.thumbnail) {
    thumb.src = info.thumbnail;
    thumb.addEventListener('error', () => { thumb.style.visibility = 'hidden'; });
  } else {
    thumb.style.visibility = 'hidden';
  }

  const body = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = info.title;
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'info-meta';
  const bits = [
    info.uploader,
    info.duration ? formatDuration(info.duration) : '',
    info.isLive ? 'live' : '',
    info.extractor,
  ].filter(Boolean);
  bits.forEach((bit) => {
    const span = document.createElement('span');
    span.textContent = bit;
    meta.appendChild(span);
  });
  body.appendChild(meta);

  const link = document.createElement('a');
  link.href = info.webpageUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = 'Open original ↗';
  link.style.cssText = 'display:inline-block;margin-top:10px;font-size:12.5px;color:#c4b5fd;text-decoration:none';
  body.appendChild(link);

  box.append(thumb, body);
  box.hidden = false;
}

$('#dlForm').addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!state.health || !state.health.ytdlp.available) {
    toast('yt-dlp is not installed. Run `npm run setup` in the mediakit folder.', true);
    return;
  }
  if (!$('#dlRights').checked) {
    toast('Please confirm you have the rights to this content first.', true);
    $('#dlRights').focus();
    return;
  }

  const url = $('#dlUrl').value.trim();
  if (!url) return;

  const button = $('#dlStartBtn');
  button.disabled = true;
  try {
    const job = await api('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({
        url,
        kind: state.kind,
        mode: state.mode,
        quality: $('#dlQuality').value,
      }),
    });
    state.jobs.set(job.id, job);
    renderJob(job);
    startPolling();
    toast('Download queued.');
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

/* ------------------------------------------------------------------ */
/* Job rendering + polling                                             */
/* ------------------------------------------------------------------ */

const STATUS_LABELS = {
  queued: 'Queued',
  running: 'Working',
  done: 'Done',
  error: 'Failed',
  cancelled: 'Cancelled',
};

function renderJob(job) {
  let el = document.querySelector(`[data-job="${job.id}"]`);
  const isNew = !el;

  if (isNew) {
    el = document.createElement('div');
    el.className = 'job';
    el.dataset.job = job.id;
    el.innerHTML = `
      <div class="job-head">
        <div class="job-title"><span data-title></span><span class="tag" data-tag></span></div>
        <div class="job-status" data-status></div>
      </div>
      <div class="bar"><i data-bar></i></div>
      <div class="job-foot">
        <span data-detail></span>
        <div class="job-actions" data-actions></div>
      </div>
      <div class="job-error" data-error hidden></div>
    `;
    $('#jobs').prepend(el);
  }

  const title = $('[data-title]', el);
  const tag = $('[data-tag]', el);
  const status = $('[data-status]', el);
  const bar = $('[data-bar]', el);
  const detail = $('[data-detail]', el);
  const actions = $('[data-actions]', el);
  const errorBox = $('[data-error]', el);

  title.textContent = job.title || job.fileName || job.url;
  title.title = job.url;
  tag.textContent = job.mode === 'audio' ? 'MP3' : 'MP4';

  const label = job.status === 'running'
    ? (job.stage && job.stage !== 'waiting' ? job.stage : 'working')
    : STATUS_LABELS[job.status] || job.status;
  status.textContent = label;
  status.className = `job-status ${job.status}`;

  const percent = job.status === 'done' ? 100 : Math.max(0, Math.min(100, Number(job.percent) || 0));
  bar.style.width = `${percent}%`;
  el.classList.toggle('done', job.status === 'done');

  const parts = [];
  if (job.status === 'running' || job.status === 'queued') {
    parts.push(`${percent.toFixed(percent < 10 ? 1 : 0)}%`);
    if (job.totalSize) parts.push(`of ${job.totalSize}`);
    if (job.speed) parts.push(job.speed);
    if (job.eta) parts.push(`ETA ${job.eta}`);
  } else if (job.status === 'done') {
    parts.push(job.fileSize ? formatBytes(job.fileSize) : 'saved');
    parts.push(job.fileName || 'file ready');
  } else if (job.status === 'cancelled') {
    parts.push('cancelled');
  } else {
    parts.push('see message below');
  }
  detail.textContent = parts.join(' · ');

  errorBox.hidden = job.status !== 'error';
  if (job.status === 'error') errorBox.textContent = job.error || 'Download failed.';

  actions.innerHTML = '';
  if (job.status === 'done' && job.downloadable) {
    const save = document.createElement('a');
    save.className = 'btn primary';
    save.href = `/api/jobs/${job.id}/file`;
    save.textContent = 'Save file';
    save.setAttribute('download', job.fileName || '');
    actions.appendChild(save);
  } else if (job.status === 'queued' || job.status === 'running') {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn ghost';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', async () => {
      cancel.disabled = true;
      try {
        const updated = await api(`/api/jobs/${job.id}`, { method: 'DELETE' });
        state.jobs.set(updated.id, updated);
        renderJob(updated);
      } catch (error) {
        toast(error.message, true);
      }
    });
    actions.appendChild(cancel);
  } else if (job.status === 'error') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn ghost';
    retry.textContent = 'Dismiss';
    retry.addEventListener('click', () => el.remove());
    actions.appendChild(retry);
  }
}

async function refreshJobs() {
  try {
    const data = await api('/api/jobs');
    let active = 0;
    for (const job of data.jobs) {
      state.jobs.set(job.id, job);
      if (document.querySelector(`[data-job="${job.id}"]`)) renderJob(job);
      if (job.status === 'queued' || job.status === 'running') active += 1;
    }
    if (active === 0) stopPolling();
  } catch {
    stopPolling();
  }
}

function startPolling() {
  if (state.pollTimer) return;
  state.pollTimer = setInterval(refreshJobs, 1000);
  refreshJobs();
}

function stopPolling() {
  if (!state.pollTimer) return;
  clearInterval(state.pollTimer);
  state.pollTimer = null;
}

/* ------------------------------------------------------------------ */
/* WhatsApp                                                            */
/* ------------------------------------------------------------------ */

$('#waForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const dir = $('#waPath').value.trim();
  if (!dir) {
    toast('Enter the folder path first.', true);
    return;
  }
  await scanFolder(dir);
});

async function scanFolder(dir) {
  const status = $('#waStatus');
  status.textContent = 'Scanning…';
  try {
    const data = await api('/api/wa/scan', { method: 'POST', body: JSON.stringify({ dir }) });
    state.waDir = data.folder;
    state.waFiles = data.files;
    localStorage.setItem('mediakit.waDir', data.folder);
    $('#waReset').hidden = false;
    renderGallery();
  } catch (error) {
    status.textContent = 'Scan failed.';
    toast(error.message, true);
  }
}

function waUrl(file, download = false) {
  const params = new URLSearchParams({ dir: state.waDir, name: file.name });
  if (download) params.set('dl', '1');
  return `/api/wa/file?${params.toString()}`;
}

function updateWaCounts() {
  const status = $('#waStatus');
  const total = state.waFiles.length;
  const saved = state.waFiles.filter((file) => file.saved).length;
  const fresh = total - saved;

  if (!total) {
    status.textContent = state.waDir
      ? 'No images or videos found in that folder.'
      : 'No folder scanned yet.';
    return;
  }

  if (state.waFilter === 'new') {
    status.textContent = fresh
      ? `${fresh} new status${fresh === 1 ? '' : 'es'} · ${saved} saved (hidden)`
      : `Nothing new right now. ${saved} saved item${saved === 1 ? '' : 's'} hidden — switch to All to review them.`;
  } else {
    status.textContent = `${total} item${total === 1 ? '' : 's'} · ${fresh} new, ${saved} saved`;
  }
}

$$('#waFilter .seg').forEach((button) => {
  button.addEventListener('click', () => {
    state.waFilter = button.dataset.filter === 'all' ? 'all' : 'new';
    $$('#waFilter .seg').forEach((item) => {
      item.classList.toggle('is-active', item === button);
    });
    renderGallery();
  });
});

$('#waReset').addEventListener('click', async () => {
  try {
    await api('/api/wa/reset', { method: 'POST' });
    for (const file of state.waFiles) file.saved = false;
    renderGallery();
    toast('Saved history cleared — every file is visible again.');
  } catch (error) {
    toast(error.message, true);
  }
});

/** Download a status and immediately drop it out of the "New" list. */
function saveStatus(file) {
  const anchor = document.createElement('a');
  anchor.href = waUrl(file, true);
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  file.saved = true;
  renderGallery();
  toast(`Saved ${file.name.length > 40 ? `${file.name.slice(0, 40)}…` : file.name}`);
}

function renderGallery() {
  const gallery = $('#waGallery');
  gallery.innerHTML = '';
  updateWaCounts();

  const visible = state.waFiles.filter((file) => state.waFilter === 'all' || !file.saved);

  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = state.waFiles.length
      ? 'All caught up — no new statuses to show.'
      : 'Scan a folder to see statuses here.';
    gallery.appendChild(empty);
    return;
  }

  visible.forEach((file) => {
    const tile = document.createElement('div');
    tile.className = `tile${file.saved ? ' is-saved' : ''}`;
    tile.title = file.name;

    if (file.kind === 'image') {
      const img = document.createElement('img');
      img.src = waUrl(file);
      img.loading = 'lazy';
      img.alt = file.name;
      tile.appendChild(img);
    } else {
      const video = document.createElement('video');
      video.src = waUrl(file);
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      tile.appendChild(video);
    }

    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    badge.textContent = file.saved ? 'saved' : file.kind;
    tile.appendChild(badge);

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'tile-save';
    save.textContent = file.saved ? 'Save again' : 'Save';
    save.addEventListener('click', (event) => {
      event.stopPropagation();
      saveStatus(file);
    });
    tile.appendChild(save);

    const name = document.createElement('span');
    name.className = 'tile-name';
    name.textContent = file.name;
    tile.appendChild(name);

    tile.addEventListener('click', () => openLightbox(file));
    gallery.appendChild(tile);
  });
}

function openLightbox(file) {
  state.lightboxFile = file;
  const body = $('#lightboxBody');
  body.innerHTML = '';

  if (file.kind === 'image') {
    const img = document.createElement('img');
    img.src = waUrl(file);
    img.alt = file.name;
    body.appendChild(img);
  } else if (file.kind === 'video') {
    const video = document.createElement('video');
    video.src = waUrl(file);
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    body.appendChild(video);
  } else {
    const audio = document.createElement('audio');
    audio.src = waUrl(file);
    audio.controls = true;
    audio.autoplay = true;
    body.appendChild(audio);
  }

  const link = $('#lightboxDownload');
  link.href = waUrl(file, true);
  link.setAttribute('download', file.name);
  link.textContent = `Save ${file.name.length > 34 ? `${file.name.slice(0, 34)}…` : file.name}`;

  $('#lightbox').hidden = false;
}

function closeLightbox() {
  $('#lightbox').hidden = true;
  $('#lightboxBody').innerHTML = '';
  state.lightboxFile = null;
}

$('#lightboxDownload').addEventListener('click', () => {
  const file = state.lightboxFile;
  if (!file) return;
  file.saved = true;
  renderGallery();
  toast('Saved. It will no longer show under New.');
  closeLightbox();
});

$('#lightboxClose').addEventListener('click', closeLightbox);
$('#lightbox').addEventListener('click', (event) => {
  if (event.target === $('#lightbox')) closeLightbox();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('#lightbox').hidden) closeLightbox();
});

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

setKind('youtube');
setMode('video');
updatePage('home');
loadHealth();
loadRecent();
