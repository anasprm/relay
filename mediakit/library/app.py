"""
MediaShelf Library - a local video library player.

Serves only files that already exist in ../downloads. No downloading, no
stream extraction, no iframe: the browser talks to localhost and gets bytes
from this disk.

Run:
    python -m uvicorn app:app --host 127.0.0.1 --port 4180
"""

from __future__ import annotations

import json
import mimetypes
import re
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Iterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response, StreamingResponse

BASE_DIR = Path(__file__).resolve().parent
LIBRARY_DIR = (BASE_DIR.parent / "downloads").resolve()
CACHE_DIR = BASE_DIR / "cache"
THUMB_DIR = CACHE_DIR / "thumbs"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
THUMB_DIR.mkdir(parents=True, exist_ok=True)

VIDEO_EXTS = {".mp4", ".m4v", ".webm", ".mkv", ".mov"}
ID_RE = re.compile(r"\[([A-Za-z0-9_-]{6,})\]\s*$")
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

SPONSOR_ENDPOINT = "https://sponsor.ajay.app/api/skipSegments"
SPONSOR_CACHE_TTL = 600.0
CHUNK_SIZE = 256 * 1024

app = FastAPI(title="MediaShelf Library", docs_url=None, redoc_url=None)

_duration_cache: dict[str, float] = {}
_sponsor_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_thumb_locks: dict[str, threading.Lock] = {}
_thumb_locks_guard = threading.Lock()
_probe_pool = ThreadPoolExecutor(max_workers=4)


# ---------------------------------------------------------------------------
# Library scanning
# ---------------------------------------------------------------------------

def _probe_duration(path: Path, mtime_ns: int) -> float:
    key = f"{path}|{mtime_ns}"
    cached = _duration_cache.get(key)
    if cached is not None:
        return cached

    ffprobe = shutil.which("ffprobe")
    duration = 0.0
    if ffprobe:
        try:
            result = subprocess.run(
                [
                    ffprobe,
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    str(path),
                ],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            duration = float(result.stdout.strip() or 0)
        except (ValueError, subprocess.SubprocessError):
            duration = 0.0

    _duration_cache[key] = duration
    return duration


def _item_from_path(path: Path) -> dict[str, Any]:
    stat = path.stat()
    stem = path.stem
    match = ID_RE.search(stem)
    if match:
        video_id = match.group(1)
        title = stem[: match.start()].strip(" -_") or stem
    else:
        video_id = re.sub(r"[^A-Za-z0-9_-]+", "-", stem).strip("-")[:64] or "video"
        title = stem

    return {
        "id": video_id,
        "title": title,
        "filename": path.name,
        "path": str(path),
        "size": stat.st_size,
        "mtime": stat.st_mtime,
        "mtime_ns": stat.st_mtime_ns,
        "duration": 0.0,
    }


def scan_library() -> list[dict[str, Any]]:
    if not LIBRARY_DIR.is_dir():
        return []

    candidates: list[tuple[Path, dict[str, Any]]] = []
    for entry in LIBRARY_DIR.iterdir():
        if not entry.is_file():
            continue
        if entry.suffix.lower() not in VIDEO_EXTS:
            continue
        try:
            candidates.append((entry, _item_from_path(entry)))
        except OSError:
            continue

    # Newest file wins when two files share a video id.
    candidates.sort(key=lambda pair: pair[1]["mtime"], reverse=True)
    unique: dict[str, dict[str, Any]] = {}
    for _, item in candidates:
        unique.setdefault(item["id"], item)

    items = list(unique.values())
    items.sort(key=lambda item: item["mtime"], reverse=True)

    durations = list(_probe_pool.map(lambda item: _probe_duration(Path(item["path"]), item["mtime_ns"]), items))
    for item, duration in zip(items, durations):
        item["duration"] = round(duration, 2)
        item["streamUrl"] = f"/api/stream/{item['id']}"
        item["thumbUrl"] = f"/api/thumb/{item['id']}"
        item["sponsorUrl"] = f"/api/sponsor/{item['id']}"

    return items


def find_item(video_id: str) -> dict[str, Any] | None:
    if not SAFE_ID.match(video_id):
        return None
    return next((item for item in scan_library() if item["id"] == video_id), None)


# ---------------------------------------------------------------------------
# Thumbnails (ffmpeg, lazily generated and cached)
# ---------------------------------------------------------------------------

def _thumb_lock(video_id: str) -> threading.Lock:
    with _thumb_locks_guard:
        return _thumb_locks.setdefault(video_id, threading.Lock())


def ensure_thumb(item: dict[str, Any]) -> Path | None:
    target = THUMB_DIR / f"{item['id']}.jpg"
    source = Path(item["path"])
    if target.exists() and target.stat().st_mtime >= item["mtime"]:
        return target

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return None

    with _thumb_lock(item["id"]):
        if target.exists() and target.stat().st_mtime >= item["mtime"]:
            return target

        duration = item.get("duration") or 10
        offset = min(max(duration * 0.1, 1.0), 30.0)
        try:
            subprocess.run(
                [
                    ffmpeg, "-y", "-loglevel", "error",
                    "-ss", f"{offset:.2f}",
                    "-i", str(source),
                    "-frames:v", "1",
                    "-vf", "scale=640:-2",
                    "-q:v", "3",
                    str(target),
                ],
                capture_output=True,
                timeout=40,
                check=False,
            )
        except subprocess.SubprocessError:
            return None

    return target if target.exists() else None


# ---------------------------------------------------------------------------
# SponsorBlock
# ---------------------------------------------------------------------------

def _fetch_sponsor_segments(video_id: str) -> dict[str, Any]:
    cached = _sponsor_cache.get(video_id)
    if cached and time.time() - cached[0] < SPONSOR_CACHE_TTL:
        return cached[1]

    url = f"{SPONSOR_ENDPOINT}?videoID={urllib.parse.quote(video_id)}"
    request = urllib.request.Request(url, headers={"User-Agent": "MediaShelf-Library/1.0"})

    payload: list[dict[str, Any]] = []
    unavailable = False
    try:
        with urllib.request.urlopen(request, timeout=6) as response:
            parsed = json.loads(response.read().decode("utf-8"))
            if isinstance(parsed, list):
                payload = parsed
    except urllib.error.HTTPError as error:
        if error.code != 404:  # 404 simply means "no segments"
            unavailable = True
    except (urllib.error.URLError, TimeoutError, ValueError):
        unavailable = True

    segments: list[dict[str, Any]] = []
    for entry in payload:
        if not isinstance(entry, dict):
            continue

        # Older/lookup responses nest segments: {videoID, segments:[...]}.
        # The public ?videoID= endpoint returns flat segment objects.
        raw_segments = entry.get("segments") if isinstance(entry.get("segments"), list) else [entry]
        for segment in raw_segments:
            if not isinstance(segment, dict):
                continue
            try:
                start, end = segment["segment"]
                segments.append(
                    {
                        "category": segment.get("category", "sponsor"),
                        "start": float(start),
                        "end": float(end),
                    }
                )
            except (KeyError, TypeError, ValueError):
                continue

    segments.sort(key=lambda seg: seg["start"])
    result = {"videoID": video_id, "segments": segments, "source": "SponsorBlock"}
    if unavailable:
        result["unavailable"] = True

    _sponsor_cache[video_id] = (time.time(), result)
    return result


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html", media_type="text/html; charset=utf-8")


@app.get("/favicon.ico")
def favicon() -> Response:
    return Response(status_code=204)


@app.get("/api/library")
def library() -> dict[str, Any]:
    items = scan_library()
    return {"count": len(items), "folder": str(LIBRARY_DIR), "items": items}


@app.get("/api/search")
def search(q: str = "") -> dict[str, Any]:
    needle = q.strip().lower()
    items = scan_library()
    if needle:
        items = [item for item in items if needle in item["title"].lower() or needle in item["id"].lower()]
    return {"query": q, "count": len(items), "items": items}


@app.get("/api/video/{video_id}")
def video(video_id: str) -> RedirectResponse:
    """Stable permalink for a library item: redirects to its byte stream."""
    if not find_item(video_id):
        raise HTTPException(status_code=404, detail="Not in library")
    return RedirectResponse(url=f"/api/stream/{video_id}", status_code=302)


@app.get("/api/thumb/{video_id}")
def thumb(video_id: str) -> Response:
    item = find_item(video_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not in library")

    path = ensure_thumb(item)
    if not path:
        raise HTTPException(status_code=404, detail="No thumbnail available")

    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=3600"})


@app.get("/api/sponsor/{video_id}")
def sponsor(video_id: str) -> JSONResponse:
    if not SAFE_ID.match(video_id):
        raise HTTPException(status_code=400, detail="Invalid video id")
    return JSONResponse(_fetch_sponsor_segments(video_id))


def _parse_range(header: str, size: int) -> tuple[int, int] | None:
    match = re.match(r"^bytes=(\d*)-(\d*)$", header.strip())
    if not match:
        return None

    start_text, end_text = match.groups()
    if not start_text and not end_text:
        return None

    if not start_text:
        # Suffix range: the last N bytes.
        length = int(end_text)
        if length <= 0:
            return None
        start = max(0, size - length)
        end = size - 1
    else:
        start = int(start_text)
        end = int(end_text) if end_text else size - 1

    end = min(end, size - 1)
    if start >= size or start > end:
        return None
    return start, end


def _iter_file(path: Path, start: int, length: int) -> Iterator[bytes]:
    with path.open("rb") as handle:
        handle.seek(start)
        remaining = length
        while remaining > 0:
            chunk = handle.read(min(CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@app.get("/api/stream/{video_id}")
def stream(video_id: str, request: Request) -> Response:
    item = find_item(video_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not in library")

    path = Path(item["path"])
    try:
        size = path.stat().st_size
    except OSError:
        raise HTTPException(status_code=404, detail="File missing on disk")

    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    disposition = f"inline; filename*=UTF-8''{urllib.parse.quote(path.name)}"
    base_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "Content-Disposition": disposition,
    }

    range_header = request.headers.get("range")
    if not range_header:
        return FileResponse(path, media_type=media_type, headers=base_headers)

    parsed = _parse_range(range_header, size)
    if not parsed:
        return Response(
            status_code=416,
            headers={"Content-Range": f"bytes */{size}", "Accept-Ranges": "bytes"},
        )

    start, end = parsed
    length = end - start + 1
    headers = {
        **base_headers,
        "Content-Range": f"bytes {start}-{end}/{size}",
        "Content-Length": str(length),
    }
    return StreamingResponse(
        _iter_file(path, start, length),
        status_code=206,
        media_type=media_type,
        headers=headers,
    )
