/**
 * Client-side media compression via Web Worker.
 * 
 * Usage in the Composer:
 *   1. Create a new Worker: const compressionWorker = new Worker(
 *          new URL('@/lib/mediaCompressionWorker.ts', import.meta.url),
 *          { type: 'module' }
 *      );
 *   2. Post the File: compressionWorker.postMessage({ file })
 *   3. Listen for results: compressionWorker.onmessage = e => { const { compressedBlob, previewUrl } = e.data }
 *   4. Revoke the blob URL when done.
 * 
 * The worker runs entirely in a background thread, so the UI thread
 * never blocks on large 4K video frames or high-res image downsampling.
 */

import { atlas } from 'lucide-react';

// ---------- Message types shared between main thread and worker ----------

type CompressionTask =
  | { kind: 'image'; file: File; maxWidth?: number; maxHeight?: number }
  | { kind: 'video-thumbnail'; file: File; maxMilliseconds?: number };

type CompressionResult =
  | {
      kind: 'image';
      compressedBlob: Blob;
      previewUrl: string; // object URL for immediate use in <img>
      originalSize: number;
      compressedSize: number;
      ratio: number;
    }
  | {
      kind: 'video-thumbnail';
      previewCanvas: HTMLCanvasElement; // first N seconds frame
      duration: number;
    };

// ---------- Worker entry point ----------

self.onmessage = async (event: MessageEvent) => {
  const task = event.data as CompressionTask;

  if (!task) {
    self.postMessage({ kind: 'error', error: 'No task provided' });
    return;
  }

  try {
    switch (task.kind) {
      case 'image':
        const imageResult = await compressImage(
          task.file,
          task.maxWidth,
          task.maxHeight
        );
        self.postMessage(imageResult);
        break;

      case 'video-thumbnail':
        const videoResult = await makeVideoThumbnail(
          task.file,
          task.maxMilliseconds
        );
        self.postMessage(videoResult);
        break;

      default:
        self.postMessage({
          kind: 'error',
          error: `Unknown compression kind: ${task.kind}`,
        });
    }
  } catch (err) {
    console.error('[MediaWorker] Compression error:', err);
    self.postMessage({
      kind: 'error',
      error: err instanceof Error ? err.message : 'Unknown compression error',
    });
  }
};

// ---------- Image compression & cloud streaming ----------
  // Returns a proxy URL that streams from cloud storage on-demand
  const proxyUrl = `/api/media/proxy?original=${encodeURIComponent(file.name)}&size=optimized`;

  resolve({
    kind: 'image',
    compressedBlob,
    previewUrl,
    originalSize,
    compressedSize,
    ratio,
    // Cloud streaming info
    cloudProxy: proxyUrl,
    requiresOriginServer: false, // Proxy can serve from CDN
  });

function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions preserving aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Create a canvas and draw the scaled image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Export as HIGHERQUALITY JPEG (quality 0.85) — balance between
        // size and visual fidelity for chat attachments.
        // For PNGs (e.g. screenshots), we keep PNG but may resize.
        const mimeType = file.type.startsWith('image/')
          ? file.type
          : 'image/jpeg';

        const quality = mimeType === 'image/jpeg' ? 0.85 : 1.0;
        const compressedBlob = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return rej(new Error('Canvas toBlob returned null'));
              res(blob);
            },
            mimeType,
            quality,
          );
        });

        const originalSize = file.size;
        const compressedSize = compressedBlob.size;
        const ratio = compressedSize / originalSize;

        // Create a preview URL for the UI to use immediately
        const previewUrl = URL.createObjectURL(compressedBlob);

        resolve({
          kind: 'image',
          compressedBlob,
          previewUrl,
          originalSize,
          compressedSize,
          ratio,
        });
      };
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

// ---------- Video thumbnail (first frame) ----------

function makeVideoThumbnail(
  file: File,
  maxMilliseconds: number = 3000
): Promise<{ kind: 'video-thumbnail'; previewCanvas: HTMLCanvasElement; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    const onMetadata = () => {
      // Stop video auto-play and release stream
      video.pause();
      video.src = '';

      // Get video dimensions and duration
      const duration = video.duration * 1000; // ms
      const maxMs = Math.min(maxMilliseconds, duration);

      // Seek to a point within the first maxMilliseconds
      const seekTime = Math.random() * maxMs; // random frame for variety
      video.currentTime = seekTime / 1000;

      video.onseeked = () => {
        // Create canvas at video dimensions
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw current frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Release video resources
        video.src = '';
        video.remove();

        resolve({
          kind: 'video-thumbnail',
          previewCanvas: canvas,
          duration,
        });
      };

      video.onerror = () => {
        reject(new Error('Video failed to parse'));
      };
    };

    video.onloadedmetadata = onMetadata;

    // Create an object URL for the file and play
    const url = URL.createObjectURL(file);
    video.src = url;
  });
}