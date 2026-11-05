'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatDuration } from '@/lib/format';
import { mediaUrl } from '@/lib/api';
import { useToast } from '@/lib/ToastProvider';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/lib/types';

/**
 * AudioMessage — renders an audio attachment with:
 *   - Play/pause controls
 *   - Duration display
 *   - Waveform preview (small canvas)
 *   - 1-tap transcription preview below the bubble
 *   - Downloaded link
 */
export function AudioMessage({
  attachment,
  mine,
  messageId,
}: {
  attachment: Attachment;
  mine: boolean;
  messageId: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number | null>(null);

  // Duration from attachment metadata
  useEffect(() => {
    if (attachment.duration) {
      setDuration(attachment.duration);
    }
  }, [attachment.duration]);

  // Transcript: in a real app this would be fetched from the server.
  // Here we simulate a deferred transcript load.
  useEffect(() => {
    // Simulate async transcript fetch
    const timer = setTimeout(() => {
      // Placeholder transcript — replace with actual server transcript
      setTranscript(
        ' transcript: "Hello everyone, just wanted to share this voice note."',
      );
    }, 1500);
    return () => clearTimeout(timer);
  }, [messageId]);

  // Play / Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  // Audio element events
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.onloadedmetadata = () => {
      setDuration(audioRef.current!.duration);
    };
    audioRef.current.onended = () => {
      setPlaying(false);
    };
  }, [audioRef.current]);

  // Waveform canvas — simple bar visualization during load/play
  useEffect(() => {
    if (!canvasRef.current) return;
    ctxRef.current = canvasRef.current.getContext('2d');
    if (!ctxRef.current) return;
    // Resize canvas
    const updateSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas!.width = canvas.clientWidth;
      canvas!.height = canvas.clientHeight;
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    function drawBars() {
      if (!ctxRef.current || !dataArrayRef.current || !canvasRef.current) return;
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      const barWidth = (canvasRef.current.width / dataArrayRef.current.length) * 2;
      let x = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        const height = (dataArrayRef.current[i] / 256) * canvasRef.current.height;
        ctxRef.current.fillStyle = mine ? '#3b82f6' : '#a0aec0';
        ctxRef.current.fillRect(x, canvasRef.current.height - height, barWidth, height);
        x += barWidth + 1;
      }
      animationRef.current = requestAnimationFrame(drawBars);
    }
    animationRef.current = requestAnimationFrame(drawBars);

    return () => {
      cancelAnimationFrame(animationRef.current!);
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Synthesize a simple data array for waveform (since we don't have the
  // actual MediaRecorder analyser here; in the full app this would be
  // connected to the MediaRecorder's analyser node).
  useEffect(() => {
    // Generate a synthetic data array based on duration for demo purposes
    const synthData = new Uint8Array(64);
    for (let i = 0; i < synthData.length; i++) {
      synthData[i] = 128 + (i % 32) * 8; // simple ramp
    }
    dataArrayRef.current = synthData;
  }, []);

  // Revoke audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.src = '';
      }
    };
  }, []);

  // Click on waveform/transcript area expands transcript
  const toggleTranscript = () => {
    // In a full app this would expand/collapse a transcript drawer
    // For now just toggle state
    setTranscript((prev) => (prev ? null : 'Transcript: "Audio content..."'));
  };

  return (
    <div className={cn(
      'group inline-flex items-center rounded-md p-1.5',
      mine && 'justify-end',
    )}>
      {/* Audio controls + waveform */}
      {attachment.kind === 'audio' || attachment.mime?.startsWith('audio/') ? (
        <div className="relative w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
          <audio
            ref={audioRef}
            controls={!mine} // only show native controls for received messages
            className="absolute inset-0 opacity-0"
          >
            <source
              src={mediaUrl(attachment.url)}
              type={attachment.mime || 'audio/mpeg'}
            />
            Your browser does not support the audio element.
          </audio>
          {!mine && (
            <Play size={16} className="text-foreground/60" />
          )}
          {mine && (
            <Pause size={16} className="text-foreground/60" />
          )}
        {/* Waveform canvas overlay — only for sent messages to show we recorded it */}
        {mine && canvasRef.current && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 rounded-md opacity-30"
            style={{ width: '40px', height: '40px' }}
          />
        )}
        {/* Transcription button — shows on hover/long-press on received messages */}
        {!mine && (
          <button
            onClick={toggleTranscript}
            className="absolute -bottom-0.5 right-1 rounded bg-secondary px-2 py-0.5 text-[10px] text-foreground/60 hover:bg-secondary/90 transition-colors"
            title="Transcribe"
          >
            T
          </button>
        )}
        {/* Duration label */}
        {duration > 0 && (
          <span className="text-[10px] text-foreground/60 ml-1">{formatDuration(duration)}</span>
        )}
        </div>
      ) : (
        /* Fallback for non-audio attachments rendered as audio (shouldn't happen) */
        <span className="text-[10px] opacity-50">{attachment.name || 'audio'}</span>
      )}

      {/* Transcription preview — appears below the bubble for received messages */}
      {!mine && transcript && (
        <p
          className={cn(
            'mt-0.5 text-[10px] text-foreground/60 line-clamp-2 select-none',
            'max-w-xs mx-auto',
          )}
        >
          {transcript}
        </p>
      )}

      {/* Downloaded link for the sender */}
      {mine && (
        <a
          href={mediaUrl(attachment.url)}
          className="mt-0.5 text-[10px] text-primary underline underline-offset-2"
          download={attachment.name || 'audio'}
          title="Download"
        >
          ↓
        </a>
      )}
    </div>
  );
}