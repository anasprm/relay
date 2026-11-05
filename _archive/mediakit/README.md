# MediaShelf

A small web app that runs **on your own computer**. Open one page, pick what you
want to do, and get on with it:

| Option | What it does |
| --- | --- |
| **Watch a video** | Plays any YouTube link in a clean player page (official embed, no comments or recommendations). |
| **YouTube download** | Saves a video as MP4, or extracts the audio as MP3. |
| **Instagram post / reel** | Saves public posts, reels and story media. |
| **WhatsApp statuses** | Browses, previews and saves the status files already stored on your phone. |

No npm packages, no build step, no cloud service. Node's standard library plus
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and optionally ffmpeg.

---

## 1. Run it

```bash
cd mediakit
npm run setup     # downloads the standalone yt-dlp binary into ./bin
npm start
```

Then open <http://127.0.0.1:4173>.

`npm run setup` is optional if `yt-dlp` is already on your PATH. ffmpeg is
optional too: without it, video downloads still work when a single-file format
exists, but MP4 merging and MP3 conversion are disabled.

**Requirements:** Node 18.17+ (Node 20+ recommended). Windows, macOS or Linux.

### Config (optional, via environment variables)

| Variable | Purpose | Example |
| --- | --- | --- |
| `PORT` | Change the port | `PORT=8080` |
| `HOST` | Bind address | `HOST=0.0.0.0` |
| `YTDLP_PATH` | Use a specific yt-dlp binary | `YTDLP_PATH=/usr/local/bin/yt-dlp` |
| `COOKIES_FILE` | Netscape-format cookies for login-only content | `COOKIES_FILE=./cookies.txt` |
| `WA_STATUS_DIR` | Pre-fill the WhatsApp status folder | `WA_STATUS_DIR=D:\phone\.Statuses` |

On Windows PowerShell:

```powershell
$env:COOKIES_FILE = "C:\path\to\cookies.txt"
npm start
```

---

## 2. How each part works

### Watch
Paste a `youtube.com/watch`, `youtu.be`, `/shorts/` or `/live/` link. The page
loads the official embed player. Nothing is proxied or re-streamed.

### Downloads
The server asks yt-dlp for the media and writes the file into `mediakit/downloads/`.
Progress is polled from the browser once per second, and finished files are
available with a **Save file** button.

* **Video** – MP4 (H.264 + AAC when the source allows). Pick from 144p up to
  2160p/4K, or "Best available"; the exact list (with frame rate and size
  estimate) appears after **Preview info** for the link you pasted.
* **Audio** – MP3 at the best quality, via ffmpeg.
* Downloads are one video at a time per job; playlists are intentionally not
  expanded. Two jobs run in parallel, the rest queue.
* Files older than 24 hours are cleaned up automatically.

### Instagram
Public posts and reels usually work without any credentials. For private
accounts, content behind a login, or when Instagram asks for verification:

1. In a browser where you are logged in, export cookies with a
   "Get cookies.txt" extension (Netscape format).
2. Save the file and start the server with `COOKIES_FILE` pointing at it.

Never share that cookies file — it is equivalent to your session.

Stories are only downloadable while they are live and only if your cookies
belong to an account allowed to view them.

### WhatsApp statuses
WhatsApp statuses are end-to-end encrypted and never leave the phone, so there is
nothing to fetch from a URL. Instead this page reads the folder where your phone
already stores the media, and lets you preview and save it.

It behaves like a status-saver app: the **New** tab shows only statuses you have
not saved yet. Pressing **Save** copies the file to your downloads and removes the
tile from the list. The registry is content-based (size + hash of the file head),
stored in `data/status-saved.json` and pruned after 90 days. Switch to **All** to
review everything, or **Reset saved history** to bring hidden items back.

On **Android** connect the phone by USB (or copy the folder across). The path is
usually:

```
Android/media/com.whatsapp/WhatsApp/Media/.Statuses
```

Some file managers hide folders starting with a dot; enable "show hidden files".
Copy the folder to the computer, then paste the folder path on the page.

On **iPhone** the status media is not exposed as files. Export the items you want
from the phone first, then scan the folder you exported to.

Only images, videos and audio are listed, nothing is uploaded anywhere, and the
server refuses paths that try to escape the folder you picked.

---

## 3. Honest limits

* **Ad-free YouTube playback is not implemented.** Embedding the official player
  keeps ads paying the creator; stripping them is a terms-of-service and
  creator-income problem, not a technical one. If you want no ads, use YouTube
  Premium, or watch media you own. What this app *does* give you is a clean page
  with no feed, no comments and no autoplay rabbit hole.
* **No DRM.** Netflix, Disney+, Spotify and similar services are not supported
  and will not be added.
* **No login bypass.** Logged-in content needs your own cookies.
* **Platforms change constantly.** If a site stops working, update yt-dlp:

  ```bash
  npm run setup          # re-checks the binary
  # or, if using a system install:
  yt-dlp -U
  ```

* **Single-user, local tool.** It binds to `127.0.0.1` and has no accounts or
  authentication. Do not expose it to the internet.

## 4. Legality

Downloading is legal in some places for personal use and illegal in others, and
almost every platform's terms forbid it. Use this for content you created, content
licensed for reuse (Creative Commons, public domain), or content you have explicit
permission to save — and follow the rules where you live. The app asks you to
confirm this before every download.

## 5. Project layout

```
mediakit/
├─ server.js          zero-dependency HTTP server + job queue + API
├─ scripts/setup.js   downloads yt-dlp into ./bin
├─ public/
│  ├─ index.html      one page, option cards + three panels
│  ├─ styles.css      dark UI, responsive
│  └─ app.js          navigation, progress polling, gallery, lightbox
├─ bin/               yt-dlp binary (created by setup)
└─ downloads/         saved media (auto-cleaned after 24h)
```

### API quick reference

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | yt-dlp/ffmpeg availability, config |
| `POST` | `/api/info` | metadata preview for a link |
| `POST` | `/api/jobs` | start a download `{url, kind, mode, quality}` |
| `GET` | `/api/jobs` | list jobs |
| `GET` | `/api/jobs/:id` | one job's progress |
| `GET` | `/api/jobs/:id/file` | download the finished file |
| `DELETE` | `/api/jobs/:id` | cancel |
| `POST` | `/api/wa/scan` | list media in a folder `{dir}` |
| `GET` | `/api/wa/file?dir=&name=&dl=1` | preview/save one status file (marks it saved) |
| `POST` | `/api/wa/reset` | forget which statuses were saved |
