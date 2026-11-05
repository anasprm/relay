/** 
 * Collaborative Co-Browsing Canvas - Lightweight WebRTC interactive canvas
 * for real-time co-drawing, tab sharing, and joint document annotation.
 * 
 * Features:
 *   - WebRTC data channel for real-time cursor/annotation sharing
 *   - Shared tab synchronization with URL tracking
 *   - Interactive drawing canvas with multiple colors/widths
 *   - Joint document annotation (PDF, web pages)
 *   - Low-latency updates via binary WebRTC data channels
 *   - User identification with colored cursors
 *   - Optional full-screen sharing mode
 *   - User opt-in for collaborative mode
 */

import { api } from './api';
import { useAuth as useStore } from '@/lib/AuthProvider';
import { useEffect, useRef, useState } from 'react';
import { PeerConnection, DataChannel } from 'webrtc';

/** Canvas message types for collaborative browsing */
export type CanvasMessageType = 
  | 'cursor-position'
  | 'drawing'
  | 'tab-update'
  | 'selection'
  | 'clear-canvas';

/** Cursor position message */
export interface CanvasCursorMessage {
  type: 'cursor-position';
  userId: string;
  username: string;
  color: string;
  x: number;
  y: number;
  isTyping: boolean;
}

/** Drawing path message */
export interface CanvasDrawingMessage {
  type: 'drawing';
  userId: string;
  username: string;
  color: string;
  width: number;
  path: CanvasPath[];
  timestamp: number;
}

/** Tab update message */
export interface CanvasTabMessage {
  type: 'tab-update';
  userId: string;
  username: string;
  url: string;
  title: string;
  timestamp: number;
}

/** Selection message */
export interface CanvasSelectionMessage {
  type: 'selection';
  userId: string;
  username: string;
  text: string;
  rect: { x: number; y: number; width: number; height: number };
  timestamp: number;
}

/** Clear canvas message */
export interface CanvasClearMessage {
  type: 'clear-canvas';
  userId: string;
  username: string;
  timestamp: number;
}

/** All canvas message types */
export type CanvasMessage = 
  | CanvasCursorMessage
  | CanvasDrawingMessage
  | CanvasTabMessage
  | CanvasSelectionMessage
  | CanvasClearMessage;

/** Canvas path point */
export interface CanvasPathPoint {
  x: number;
  y: number;
}

export interface CanvasPath {
  points: CanvasPathPoint[];
  color: string;
  width: number;
  timestamp: number;
}

/** Shared canvas state */
export interface CanvasState {
  width: number;
  height: number;
  backgroundColor: string;
  drawings: CanvasPath[];
  selections: CanvasSelectionMessage[];
  currentUserId: string;
  participants: Record<string, { color: string; username: string }>;
}

/** Initialize a collaborative co-browsing session */
export function initiateCollaborativeBrowser(
  myPeerId: string,
  theirPeerId: string,
  socket: any,
  onMessage: (msg: CanvasMessage) => void
): {
  pc: RTCPeerConnection;
  dc: DataChannel;
  myColor: string;
} {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  // Generate a unique color for this user
  const myColor = `hsl(${Math.random() * 360}, 70%, 60%)`;

  // Create data channel for canvas messages
  const dc = pc.createDataChannel('collaborative-canvas', {
    maxRetransmits: 100,
    protocol: 'relay-canvas',
  });

  // Handle incoming data channel messages
  dc.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string);
      onMessage(data as CanvasMessage);
    } catch (e) {
      console.error('[CollabCanvas] Failed to parse message:', e);
    }
  };

  dc.onopen = () => {
    console.log('[CollabCanvas] Data channel opened to peer', theirPeerId);
  };

  dc.onclose = () => {
    console.log('[CollabCanvas] Data channel closed with peer', theirPeerId);
  };

  dc.onerror = (err) => {
    console.error('[CollabCanvas] Data channel error:', err.message);
  };

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      api.post('/p2p/candidate', {
        peerId: myPeerId,
        candidate: event.candidate,
      }).catch(console.error);
    }
  };

  // Handle connection state
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      console.log('[CollabCanvas] Connected to peer', theirPeerId);
    }
    if (pc.connectionState === 'failed') {
      console.error('[CollabCanvas] Connection failed with peer', theirPeerId);
    }
    if (pc.connectionState === 'disconnected') {
      console.log('[CollabCanvas] Disconnected from peer', theirPeerId);
    }
  };

  // Create offer and signal
  pc.createOffer().then(offer => {
    pc.setLocalDescription(offer);
    socket.emit('collab-browser:offer', {
      from: myPeerId,
      to: theirPeerId,
      sdp: offer,
    });
  });

  // Handle remote offer
  socket.on('collab-browser:offer', (data: { from: string; to: string; sdp: any }) => {
    if (data.to !== myPeerId) return;
    pc.setRemoteDescription(new RTCSessionDescriptionInit(data.sdp));
    pc.createAnswer().then(answer => {
      pc.setLocalDescription(answer);
      socket.emit('collab-browser:answer', {
        from: myPeerId,
        to: data.from,
        sdp: pc.localDescription,
      });
    });
  });

  // Handle remote answer
  socket.on('collab-browser:answer', (data: { from: string; to: string; sdp: any }) => {
    if (data.to !== myPeerId) return;
    pc.setRemoteDescription(new RTCSessionDescriptionInit(data.sdp));
  });

  // Handle incoming data channel from remote
  pc.ondatachannel = (event) => {
    const remoteDC = event.channel;
    remoteDC.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        onMessage(data as CanvasMessage);
      } catch (e) {
        console.error('[CollabCanvas] Failed to parse remote message:', e);
      }
    };
  };

  return {
    pc,
    dc,
    myColor,
  };
}

/** Send a cursor position update */
export function sendCursorUpdate(
  dc: DataChannel,
  myId: string,
  username: string,
  color: string,
  x: number,
  y: number,
  isTyping: boolean
) {
  const message: CanvasCursorMessage = {
    type: 'cursor-position',
    userId: myId,
    username,
    color,
    x,
    y,
    isTyping,
  };
  dc.send(JSON.stringify(message));
}

/** Send a drawing path update */
export function sendDrawingUpdate(
  dc: DataChannel,
  myId: string,
  username: string,
  color: string,
  width: number,
  path: CanvasPath[]
) {
  const message: CanvasDrawingMessage = {
    type: 'drawing',
    userId: myId,
    username,
    color,
    width,
    path,
    timestamp: Date.now(),
  };
  dc.send(JSON.stringify(message));
}

/** Send a tab update */
export function sendTabUpdate(
  dc: DataChannel,
  myId: string,
  username: string,
  url: string,
  title: string
) {
  const message: CanvasTabMessage = {
    type: 'tab-update',
    userId: myId,
    username,
    url,
    title,
    timestamp: Date.now(),
  };
  dc.send(JSON.stringify(message));
}

/** Send a selection highlight */
export function sendSelectionUpdate(
  dc: DataChannel,
  myId: string,
  username: string,
  text: string,
  rect: { x: number; y: number; width: number; height: number }
) {
  const message: CanvasSelectionMessage = {
    type: 'selection',
    userId: myId,
    username,
    text,
    rect,
    timestamp: Date.now(),
  };
  dc.send(JSON.stringify(message));
}

/** Send a clear canvas command */
export function sendClearCanvasCommand(dc: DataChannel, myId: string, username: string) {
  const message: CanvasClearMessage = {
    type: 'clear-canvas',
    userId: myId,
    username,
    timestamp: Date.now(),
  };
  dc.send(JSON.stringify(message));
}

export default {
  initiateCollaborativeBrowser,
  sendCursorUpdate,
  sendDrawingUpdate,
  sendTabUpdate,
  sendSelectionUpdate,
  sendClearCanvasCommand,
};