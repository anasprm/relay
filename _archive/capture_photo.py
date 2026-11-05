import os
import time
import sys

import cv2

COUNTDOWN = 10
out_dir = os.path.dirname(os.path.abspath(__file__))
out_path = os.path.join(out_dir, f"photo_{time.strftime('%Y%m%d_%H%M%S')}.jpg")
mirror_path = os.path.join(out_dir, f"photo_mirrored_{time.strftime('%Y%m%d_%H%M%S')}.jpg")

# Try the default camera; fall back to scanning indices 0-3
cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
if not cap.isOpened():
    cap.release()
    for idx in range(1, 4):
        cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
        if cap.isOpened():
            break

if not cap.isOpened():
    print("ERROR: No camera found.")
    sys.exit(1)

# Let the camera warm up (auto-exposure / white balance settle)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
for _ in range(30):  # discard ~30 frames
    cap.read()
    time.sleep(0.05)

print(f"Photo in {COUNTDOWN} seconds...", flush=True)
for s in range(COUNTDOWN, 0, -1):
    # consume frames while counting down so the buffer stays fresh
    ok, frame = cap.read()
    if not ok:
        print("ERROR: Could not read from camera.")
        sys.exit(1)
    print(f"  {s}s", flush=True)
    time.sleep(1)

# Capture a few frames and keep the sharpest (best focus)
best, best_lap = None, -1.0
for _ in range(5):
    ok, frame = cap.read()
    if not ok:
        continue
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_64F).var()
    if lap > best_lap:
        best, best_lap = frame, lap
    time.sleep(0.15)

cap.release()

if best is None:
    print("ERROR: Failed to capture a frame.")
    sys.exit(1)

cv2.imwrite(out_path, best)
cv2.imwrite(mirror_path, cv2.flip(best, 1))
print(f"Photo saved: {out_path}")
print(f"Photo saved: {mirror_path}")
print(f"Resolution: {best.shape[1]}x{best.shape[0]}, sharpness: {best_lap:.1f}")
