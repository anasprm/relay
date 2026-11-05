/**
 * P2P File Transfer via WebRTC DataChannels
 * Enables direct peer-to-peer file sharing up to 10GB without server storage limits.
 */

import { api } from './api';

/** Configure RTCPeerConnection for P2P data channels */
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  // TURN credentials would be injected at deployment via env vars
};

/** Start a P2P connection with a remote peer */
export function startPeerConnection(peerId: string, onMessage: (data: { type: string; payload: any }) => void) {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      api.post('/p2p/candidate', {
        peerId,
        candidate: event.candidate,
      }).catch(console.error);
    }
  };

  // Handle connection state changes
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      console.log(`[P2P] Connected to peer ${peerId}`);
    }
    if (pc.connectionState === 'failed') {
      console.error(`[P2P] Connection failed with peer ${peerId}`);
    }
    if (pc.connectionState === 'disconnected') {
      console.log(`[P2P] Disconnected from peer ${peerId}`);
    }
  };

  // Handle data channel messages
  pc.ondatachannel = (event) => {
    const channel = event.channel;
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        onMessage({ type: 'data', payload: data });
      } catch {
        onMessage({ type: 'data', payload: event.data });
      }
    };
    channel.onopen = () => {
      onMessage({ type: 'connection', payload: { state: 'opened', peerId } });
    };
    channel.onclose = () => {
      onMessage({ type: 'connection', payload: { state: 'closed', peerId } });
    };
    channel.onerror = (err) => {
      onMessage({ type: 'error', payload: { error: err.message, peerId } });
    };
  };

  // Create outbound data channel
  const dc = pc.createDataChannel('file-transfer', {
    // Enable message buffering for large files
    maxRetransmits: 100,
    protocol: 'relay-p2p',
  });

  // Handle channel open
  dc.onopen = () => {
    onMessage({ type: 'connection', payload: { state: 'opened', peerId, channel: 'file-transfer' } });
  };

  // Handle channel close
  dc.onclose = () => {
    onMessage({ type: 'connection', payload: { state: 'closed', peerId, channel: 'file-transfer' } });
  };

  // Handle channel error
  dc.onerror = (err) => {
    onMessage({ type: 'error', payload: { error: err.message, peerId } });
  };

  // Handle incoming data channel from remote
  pc.onchannel = (event) => {
    const channel = event.channel;
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        onMessage({ type: 'data', payload: data });
      } catch {
        onMessage({ type: 'data', payload: event.data });
      }
    };
    onMessage({ type: 'connection', payload: { state: 'opened', peerId, channel: 'remote' } });
  };

  // Generate offer and return signaling data
  return {
    pc,
    dc,
    async start(): Promise<RTCSessionDescriptionInit> {
      await pc.setLocalDescription(await pc.createOffer());
      await api.post('/p2p/offer', {
        peerId,
        sdp: pc.localDescription,
      });
      return pc.localDescription;
    },
    async acceptRemoteOffer(remoteSdp: RTCSessionDescriptionInit) {
      await pc.setRemoteDescription(remoteSdp);
      await pc.createAnswer();
      await pc.setLocalDescription(await pc.createAnswer());
      await api.post('/p2p/answer', {
        peerId,
        sdp: pc.localDescription,
      });
    },
    send: (data: any) => {
      const stringified = JSON.stringify(data);
      if (pc && pc.connectedState === 'connected') {
        pc.send(data);
      } else {
        console.error('[P2P] Peer not connected');
      }
    },
    close: () => pc.close(),
    getLocalStream: () => pc.getLocalStreams ? pc.getLocalStreams() : null,
  };
}

/** Send a file via P2P data channel in chunks */
export function sendFileViaP2P(
  pc: RTCPeerConnection,
  file: File,
  onProgress?: (progress: number) => void,
  onComplete?: (blob: Blob) => void,
  onError?: (error: string) => void
) {
  const CHUNK_SIZE = 1_000_000; // 1MB chunks
  const channel = pc.createDataChannel('file-transfer', {
    maxRetransmits: 200,
  });

  let sentBytes = 0;
  let offset = 0;

  dc.onopen = () => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      const chunk = e.target!.result as ArrayBuffer;
      dc.send(chunk);
      sentBytes += chunk.byteLength;
      offset += CHUNK_SIZE;
      onProgress?.(sentBytes / file.size);
      
      if (offset < file.size) {
        // Send next chunk
        const blob = file.slice(offset, offset + CHUNK_SIZE);
        const reader2 = new FileReader();
        reader2.onloadend = (e2) => {
          dc.send(e2.target!.result as ArrayBuffer);
          sentBytes += e2.target!.result.byteLength;
          onProgress?.(sentBytes / file.size);
          sendRemainingChunks(pc, file, offset + CHUNK_SIZE, onProgress, onComplete);
        };
        reader2.readAsArrayBuffer(blob);
      } else {
        // Send remaining bytes
        const blob = file.slice(offset);
        const reader3 = new FileReader();
        reader3.onloadend = (e3) => {
          dc.send(e3.target!.result as ArrayBuffer);
          sentBytes += e3.target!.result.byteLength;
          onProgress?.(sentBytes / file.size);
          onComplete?.(new Blob([new Uint8Array(file)]));
        };
        reader3.readAsArrayBuffer(blob);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  dc.onmessage = (event) => {
    const data = JSON.parse(event.data as string);
    if (data.type === 'file-complete') {
      onComplete?.(data.blob as Blob);
    } else if (data.type === 'progress') {
      onProgress?.(data.progress);
    }
  };

  dc.onerror = (err) => {
    onError?.(err.message);
  };

  // Start chunked sending
  const sendRemainingChunks = (
    pc: RTCPeerConnection,
    file: File,
    startOffset: number,
    onProgress?: (progress: number) => void,
    onComplete?: (blob: Blob) => void
  ) => {
    if (offset >= file.size) {
      onComplete?.(new Blob([new Uint8Array(file)]));
      return;
    }
    
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const blob = file.slice(offset, end);
    const reader = new FileReader();
    
    reader.onloadend = (e) => {
      dc.send(e.target!.result as ArrayBuffer);
      sentBytes += e.target!.result.byteLength;
      onProgress?.(sentBytes / file.size);
      
      offset += CHUNK_SIZE;
      if (offset < file.size) {
        sendRemainingChunks(pc, file, offset, onProgress, onComplete);
      } else {
        onComplete?.(new Blob([new Uint8Array(file)]));
      }
    };
    
    reader.readAsArrayBuffer(blob);
  };

  // Start the sending process
  sendRemainingChunks(pc, file, 0, onProgress, onComplete);
}

/** Receive and handle incoming P2P file */
export function handleIncomingP2PFile(
  event: MessageEvent,
  onFileReceived: (file: { name: string; size: number; blob: Blob }) => void
) {
  try {
    const data = JSON.parse(event.data as string);
    
    if (data.type === 'file-complete') {
      onFileReceived({
        name: data.name || 'unknown',
        size: data.size,
        blob: data.blob as Blob,
      });
    } else if (data.type === 'file-start') {
      // Initialize receive state
      // The actual blob assembly happens via incoming messages
    } else if (data.type === 'chunk') {
      // Handle individual chunks - assemble blob
      // This would need state management in the caller
    }
  } catch (e) {
    console.error('[P2P] Failed to parse file message:', e);
  }
}

/** Protocol messages for P2P file transfer */
export const P2P_PROTOCOL = {
  FILE_START: 'file-start',
  FILE_CHUNK: 'file-chunk',
  FILE_COMPLETE: 'file-complete',
  PROGRESS: 'progress',
  CANDIDATE: 'candidate',
  OFFER: 'offer',
  ANSWER: 'answer',
};

/** Initialize P2P signaling between two peers */
export function initiateP2PSession(
  socket: any,
  myPeerId: string,
  theirPeerId: string,
  onSessionReady: (pc1: any, pc2: any) => void
) {
  // Create two peer connections
  const pc1 = new RTCPeerConnection(RTC_CONFIG);
  const pc2 = new RTCPeerConnection(RTC_CONFIG);

  // Exchange ICE candidates
  socket.on('p2p:candidate', (data: { peerId: string; candidate: RTCIceCandidateInit }) => {
    const pc = data.peerId === myPeerId ? pc1 : pc2;
    pc.addIceCandidate(data.candidate);
  });

  // Handle connection state
  [pc1, pc2].forEach((pc) => {
    pc.onconnectionstatechange = () => {
      console.log(`[P2P] Peer ${pc === pc1 ? '1' : '2'} state: ${pc.connectionState}`);
    };
  });

  // Create data channels
  const dc1 = pc1.createDataChannel('file-transfer');
  const dc2 = pc2.createDataChannel('file-transfer');

  // Handle messages on dc1
  dc1.onmessage = (event) => {
    onMessage?.({ type: 'p2p-data', payload: JSON.parse(event.data as string), channel: 'dc1' });
  };

  // Handle messages on dc2
  dc2.onmessage = (event) => {
    onMessage?.({ type: 'p2p-data', payload: JSON.parse(event.data as string), channel: 'dc2' });
  };

  // Create offer from initiator
  pc1.createOffer().then(offer => {
    pc1.setLocalDescription(offer);
    socket.emit('p2p:offer', {
      from: myPeerId,
      to: theirPeerId,
      sdp: offer,
    });
  });

  // Handle remote offer
  socket.on('p2p:offer', (data: { from: string; to: string; sdp: RTCSessionDescriptionInit }) => {
    if (data.to !== myPeerId) return;
    pc2.setRemoteDescription(new RTCSessionDescriptionInit(data.sdp));
    pc2.createAnswer().then(answer => {
      pc2.setLocalDescription(answer);
      socket.emit('p2p:answer', {
        from: myPeerId,
        to: data.from,
        sdp: pc2.localDescription,
      });
    });
  });

  // Handle remote answer
  socket.on('p2p:answer', (data: { from: string; to: string; sdp: RTCSessionDescriptionInit }) => {
    if (data.to !== myPeerId) return;
    pc1.setRemoteDescription(new RTCSessionDescriptionInit(data.sdp));
  });

  // Wait for session to be ready
  const checkSession = setInterval(() => {
    if (pc1.connectionState === 'connected' && pc2.connectionState === 'connected') {
      clearInterval(checkSession);
      onSessionReady(pc1, pc2);
    }
  }, 1000);

  setTimeout(() => clearInterval(checkSession), 10000);
}

/** Simple P2P file transfer between two peers */
export async function transferFileBetweenPeers(
  socket: any,
  myId: string,
  targetPeer: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  // Create peer connections
  const pc1 = await startPeerConnection(myId, () => {});
  const pc2 = new RTCPeerConnection(RTC_CONFIG);
  
  // Exchange ICE candidates via socket
  // ... (simplified for brevity)
  
  // Create offer from initiator
  await pc1.setLocalDescription(await pc1.createOffer());
  socket.emit('p2p:offer', {
    from: myId,
    to: targetPeer,
    sdp: pc1.localDescription,
  });
  
  // Wait for answer
  const answerResponse = await new Promise<RTCSessionDescriptionInit>((resolve) => {
    socket.once('p2p:answer', resolve);
  });
  
  // Set remote description
  pc2.setRemoteDescription(answer);
  
  // Create answer from responder
  await pc2.setLocalDescription(await pc2.createAnswer());
  socket.emit('p2p:answer', {
    from: targetPeer,
    to: myId,
    sdp: pc2.localDescription,
  });
  
  // Set local description on initiator
  pc1.setRemoteDescription(pc2.localDescription);
  
  // Send file from pc1 to pc2
  return sendFileViaP2P(pc1, file, onProgress);
}