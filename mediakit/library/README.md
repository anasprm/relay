# MediaShelf Library

A local video library player. It reads `../downloads` (the folder MediaShelf
saves into), serves the files with HTTP Range support, and plays them in a
native `<video>` element. No iframe, no external stream URLs — every byte the
player receives comes from this machine.

## Run

```powershell
cd "C:\Users\anasp\Documents\Default Project\mediakit\library"
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 4180
```

Open <http://127.0.0.1:4180>.

## Adding videos

Put files in `../downloads` (MediaShelf's download folder) or download
something you have the rights to with MediaShelf. The folder is rescanned on
every `/api/library` call, so new files appear on the next **Refresh** — or
automatically when you switch back to the tab.

Keep yt-dlp's default filename pattern, e.g.
`My Clip [dQw4w9WgXcQ].mp4`. The `[ID]` at the end is what SponsorBlock needs;
don't rename it away. Files without an ID still play, but sponsor skipping
won't find data.

There is **no paste-a-URL box**. The box in the header is **Open by ID**: it
looks up an item that is already on disk by its ID (`dQw4w9WgXcQ` or
`[dQw4w9WgXcQ]`). If the file isn't there it says so instead of downloading.

## Endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/library` | scan the folder, return items + durations |
| `GET` | `/api/search?q=` | filter the library by title or ID |
| `GET` | `/api/video/{id}` | permalink, 302 to the stream (404 if not on disk) |
| `GET` | `/api/stream/{id}` | serve the local file, Range/206, `Content-Range` |
| `GET` | `/api/thumb/{id}` | cached JPEG frame (ffmpeg, generated on demand) |
| `GET` | `/api/sponsor/{id}` | proxy `sponsor.ajay.app` for skip segments |

`/api/video/{id}` only resolves files that already exist. It never invokes
yt-dlp and never fetches a URL.

## Player

- Library grid with search (`/`), manual **Refresh**, and automatic rescan when
  the tab regains focus.
- Resume position per video (stored in `localStorage`).
- Auto-skips SponsorBlock categories (`sponsor`, `selfpromo`, …) for files whose
  name contains a video ID; toggle in the player bar. Segment chips jump to the
  start of each reported segment.
- Shortcuts: `Space`/`K` play-pause, `←`/`→` ±5s, `M` mute, `F` fullscreen,
  `Esc` back to the grid, `/` focus search.

## Scope

The app never downloads anything. `/api/video/{id}` is a permalink to a file
that is already in `../downloads`; if the ID is unknown it returns 404. There
is no URL ingestion and no media extraction, so it cannot be used to pull
content off YouTube or any other site.

## Notes

- Thumbnails and SponsorBlock responses are cached in `./cache` and in memory.
- ffmpeg/ffprobe are used for thumbnails and durations; both are optional.
- Single-user, localhost-only; no auth and no upload.
