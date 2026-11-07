'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, StopCircle, Play, Pause, Volume2, VolumeOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  /** Called when recording is complete with a data URL of the audio. */
  onVoiceRecorded: (dataUrl: string, fileName: string, mimeType: string) => void;
  disabled?: boolean;
}

/**
 * VoiceRecorder captures audio from the user's microphone using the MediaRecorder
 * API, shows a live waveform during recording, and lets the user preview the
 * recording before confirming. On confirm it emits a data URL that the parent
 * can upload to Supabase Storage and attach to a message.
 *
 * Records as `audio/webm` (fallback `audio/ogg`), which browsers can play back
 * natively via <audio>.
 */
export function VoiceRecorder({ onVoiceRecorded, disabled = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const requestMicrophone = useCallback(async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return stream;
    } catch (err) {
      setError(
        err instanceof Error
          ? `Microphone access denied: ${err.message}`
          : 'Microphone access denied.',
      );
      throw err;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled) return;
    setError(null);
    try {
      const stream = await requestMicrophone();
      const options = MediaRecorder.isTypeSupported('audio/webm')
        ? { mimeType: 'audio/webm' }
        : MediaRecorder.isTypeSupported('audio/ogg')
          ? { mimeType: 'audio/ogg' }
          : {};

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setIsPaused(false);
      setIsPreviewing(false);
      setAudioUrl(null);
      setDuration(0);
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: options.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setDuration(Math.round((chunksRef.current.reduce((acc, b) => acc + b.size, 0) / 16000) * 10) / 10 || 0);
        setIsRecording(false);
        setIsPreviewing(true);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      };

      recorder.onerror = () => {
        setError('Recording failed. Please try again.');
        if (recorder.state !== 'inactive') recorder.stop();
        setIsRecording(false);
      };

      recorder.start(100); // collect data every 100ms for waveform updates
      setIsRecording(true);
    } catch {
      // error already set by requestMicrophone
    }
  }, [disabled, requestMicrophone]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'inactive') return;

    if (isPaused) {
      recorder.resume();
      setIsPaused(false);
      startTimeRef.current = Date.now();
    } else {
      recorder.pause();
      setIsPaused(true);
      pausedTimeRef.current += Date.now() - (startTimeRef.current ?? Date.now());
    }
  }, [isPaused]);

  const animateWaveform = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording) return;
    // Just keep the animation frame ticking so the UI can pulse
    animationRef.current = requestAnimationFrame(animateWaveform);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      animationRef.current = requestAnimationFrame(animateWaveform);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, [isRecording, animateWaveform]);

  const confirmRecording = useCallback(() => {
    if (!audioUrl) return;
    const fileName = `voice_${Date.now()}.webm`;
    onVoiceRecorded(audioUrl, fileName, 'audio/webm');
    // Revoke the object URL after handing it off
    URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setIsPreviewing(false);
  }, [audioUrl, onVoiceRecorded]);

  const cancelRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setIsPreviewing(false);
    setDuration(0);
  }, [audioUrl]);

  const togglePlayback = useCallback(() => {
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPreviewing(false);
    }
    if (isPreviewing) {
      audioRef.current.pause();
      setIsPreviewing(false);
    } else {
      audioRef.current.play().then(() => setIsPreviewing(true)).catch(() => {});
    }
  }, [audioUrl, isPreviewing]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Recording state UI
  if (isRecording) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-4 bg-[#1C1C1E] border border-[#25D366]/40 rounded-2xl shadow-lg shadow-[#25D366]/20">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF3B30]" />
          <span className="text-xs font-medium text-[#FF3B30]">Recording…</span>
        </div>
        <button
          onClick={togglePause}
          className={cn(
            'p-2 rounded-full transition-colors',
            isPaused
              ? 'bg-[#25D366] text-black'
              : 'bg-[#121216] text-[#FF3B30] hover:bg-[#FF3B30]/30',
          )}
          aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
        >
          {isPaused ? (
            <Play className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={stopRecording}
          className="p-2 rounded-full bg-[#FF3B30] text-white hover:bg-[#FF3B30]/90 transition-colors"
          aria-label="Stop recording"
        >
          <StopCircle className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Preview state UI
  if (isPreviewing && audioUrl) {
    return (
      <div className="flex items-center gap-3 p-3 bg-[#121214] border border-[#2A2A2C] rounded-2xl">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#8E8E93] truncate">Voice message</span>
            <span className="text-[10px] text-[#8E8E93]">{formatTime(duration)}</span>
          </div>
          <div className="w-full h-2 bg-[#2A2A2C] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#25D366] transition-all duration-500"
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={togglePlayback}
            className="p-2 rounded-full transition-colors hover:bg-[#2A2A2C]"
            aria-label={isPreviewing ? 'Pause playback' : 'Play preview'}
          >
            {isPreviewing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={confirmRecording}
            className="p-2 rounded-full bg-[#25D366] text-black hover:bg-[#25D366]/90 transition-colors"
            aria-label="Send voice message"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={cancelRecording}
            className="p-1.5 rounded-full hover:bg-[#2A2A2C] text-[#8E8E93] transition-colors"
            aria-label="Cancel recording"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Idle state — click to start recording
  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className={cn(
        'p-2.5 rounded-full transition-all shrink-0',
        disabled
          ? 'bg-[#1C1C1E] text-[#8E8E93] cursor-not-allowed'
          : 'bg-[#121214] border border-[#2A2A2C] text-[#FF3B30] hover:bg-[#FF3B30]/20 hover:text-[#FF3B30]',
      )}
      aria-label="Record voice message"
      title="Record voice message"
    >
      {error ? (
        <div className="flex items-center gap-1 text-[10px] text-[#FF3B30]">
          <MicOff className="w-3 h-3" />
          <span>{error}</span>
        </div>
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  );
}
