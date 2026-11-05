# THE 500-LINE ULTIMATE MASTER ENGINEERING PROMPT FOR RELAY MESSENGER PRO
# Repository: https://github.com/anasprm/relay-messenger.git
# Target Deployment: relay-messengerpro.vercel.app / valiyakath.vercel.app

ROLE & PERSONA:
You are an elite Principal Distributed Systems Architect, Staff Full-Stack React/Next.js/Node.js Engineer, and Real-Time Communications Specialist who has built massive-scale production apps handling millions of concurrent WebSockets, WebRTC media streams, and zero-loss media pipelines. 

MISSION:
Transform our repository (https://github.com/anasprm/relay-messenger.git) into the absolute pinnacle of real-time communication and social sharing, definitively surpassing the technical and UX sophistication of WhatsApp, Telegram, and Instagram combined. You must write complete, production-ready, highly optimized, type-safe TypeScript code for every architectural layer specified below. Do not use placeholders or stub functions; provide fully implemented enterprise-grade modules.

---

### SECTION 1: DISTRIBUTED OFFLINE-FIRST ARCHITECTURE & STATE SYNCHRONIZATION
To match and exceed Telegram Web (WebK) and WhatsApp Web:
1. IndexedDB Client-Side Persistence Layer (`web/lib/db.ts`):
   - Implement a robust IndexedDB wrapper using `idb` storing stores for: `conversations`, `messages`, `users`, `media_cache`, and `pending_outbox`.
   - On initial app boot, hydrate the React state instantly from IndexedDB (0ms perceived load time), then perform a delta-sync via WebSockets in the background.
2. Optimistic Outbox Queue & Conflict Resolution (`web/lib/outbox.ts`):
   - When a user sends a message offline or during network jitter, commit it instantly to `pending_outbox` in IndexedDB with status `sending`.
   - Render the message instantly in the UI with a pending spinner.
   - Implement automatic exponential backoff retry logic upon socket reconnection, handling server-side message ID deduplication and vector clock conflict resolution.
3. Memory Management & Virtualized Lists (`web/components/chat/MessageList.tsx`):
   - Implement windowed virtualization (e.g., TanStack Virtual / custom windowing) for message rendering to ensure smooth 60fps scrolling even in conversations with 100,000+ messages.
   - Implement intelligent DOM recycling and image lazy-loading for media messages.

---

### SECTION 2: ZERO-LOSS HIGH-PERFORMANCE MEDIA PIPELINE & STORIES (Instagram Grade)
To surpass Instagram's media sharing speed and quality:
1. Web Worker Client-Side Media Compressor (`web/lib/mediaWorker.ts`):
   - Offload heavy image resizing (to max 2048px WebP) and video transcoding (client-side MP4/WebM chunking) to a dedicated Web Worker. Prevent main thread freezing during multi-file 4K video drops.
2. Resumable Chunked Uploads (`server/src/routes/media.js` & `web/lib/api.ts`):
   - Implement chunked file uploads with MD5 integrity hashing, allowing resumable uploads over flaky mobile networks.
3. Immersive Stories Rail & Viewer (`web/components/chat/StoriesRail.tsx` & `StoryViewer.tsx`):
   - Build fluid touch/mouse swipe gesture handlers for 24-hour stories.
   - Implement pause-on-hold, auto-advance progress bars, gradient background generators, interactive poll stickers, and direct DM reply drawers that seamlessly transition into encrypted chat rooms.
4. Voice Note Waveform Engine (`web/components/chat/VoiceRecorder.tsx` & `AudioMessage.tsx`):
   - Capture audio via Web Audio API AnalyserNode, generate precise visual waveform peaks array, and render interactive seekable audio players with variable playback speeds (1x, 1.5x, 2x).

---

### SECTION 3: OFFLINE PUSH-TRIGGERED BACKGROUND CALLING (WhatsApp / Instagram Grade)
To enable calling offline users whose apps/browsers are closed:
1. Service Worker Push Notification Gateway (`web/public/sw.js`):
   - Register a persistent Service Worker listening to high-priority Push API events (`push` event with payload type `INCOMING_CALL`).
   - When an incoming call arrives for an offline recipient, trigger `self.registration.showNotification()` displaying a high-priority persistent banner with rich actions (`Accept` and `Decline`).
2. Native Ringer & Web Audio API Synthesis (`web/lib/ringtones.ts`):
   - When the notification fires or the incoming call screen opens, execute the exact dual-tone harmonic WhatsApp ringtone synthesizer (440Hz and 480Hz dual European standard) with precise cadences (`700ms` tone, `300ms` pause) and haptic vibration pulses (`navigator.vibrate([350, 180, 350])`).
3. WebRTC Call Bootstrap (`web/lib/useCall.ts`):
   - When the user taps "Accept" on the push notification or incoming call overlay, wake up the PWA window, establish the WebSocket signaling socket, exchange SDP offer/answer/ICE candidates via STUN/TURN servers, and establish peer-to-peer audio/video streams instantly.

---

### SECTION 4: ANTI-CLICHÉ AI PRODUCTIVITY SUITE
To solve group chat fatigue and provide genuine utility:
1. Smart Thread Morning Brief (`web/components/chat/ChatHeader.tsx` & `server/src/ai.js`):
   - Build an AI aggregator widget in group chats that analyzes unread messages and uses an LLM/summarization pipeline to output 3 crisp bullet points: (1) Core decisions made, (2) Action items assigned to specific users, (3) Key links/files shared.
2. Voice Note Auto-Transcription (`web/components/chat/AudioMessage.tsx`):
   - Provide a 1-tap "Transcribe Voice Note" button that instantly generates readable text transcripts below audio bubbles for silent environments.
3. Aesthetic Auto-Grade Filter (`web/components/chat/StoryComposer.tsx`):
   - Provide 1-click cinematic color grading and lighting adjustments for shared images and stories.

---

### SECTION 5: ENTERPRISE SECURITY, E2E ENCRYPTION & POLISH
1. End-to-End Encryption (E2EE) Signal Protocol Layer (`server/src/encryption.js` & `web/lib/crypto.ts`):
   - Implement client-side cryptographic key generation (Curve25519 / AES-GCM 256) so messages are encrypted on the sender's device and can only be decrypted on the recipient's device. Server never sees plaintext.
2. Biometric & Passcode Chat Lock (`web/components/chat/ChatLockDialog.tsx`):
   - Allow users to lock individual sensitive chat rooms behind WebAuthn (Fingerprint/FaceID) or a custom PIN.
3. Glassmorphic Dark-Mode UI System (`web/app/globals.css`):
   - Deliver a bespoke dark-mode-first glassmorphism design system with custom accent gradients, subtle ambient lighting glows, smooth CSS transitions, and zero visual layout shifts.

Deliver the complete, fully written, production-grade implementation code for all requested modules now.