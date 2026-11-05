# Camera Photo Capture Setup — Progress Notes

## Goal
Take a webcam photo after a 10-second countdown on Windows (user request).

## Environment
- Windows, PowerShell available, no Python initially
- **Python 3.13.15 installed** via winget → `%LOCALAPPDATA%\Programs\Python\Python313\python.exe`
- Camera capture script ready at `C:\Users\anasp\Documents\Default Project\capture_photo.py`

## Network situation (important)
- `files.pythonhosted.org` is throttled to ~2.7 KB/s → unusable
- Tsinghua mirror slow (~1.6 KB/s); GitHub releases 404 for numpy wheels
- **Aliyun mirror works: ~65 KB/s** (`https://mirrors.aliyun.com/pypi/packages/<same hash path as pypi>`)
- curl with `--speed-limit 10000 --speed-time 60 -C -` used to abort stall and resume

## Wheel URLs (Aliyun = pypi path with mirrors.aliyun.com/pypi prefix)
- opencv-python 5.0.0.93:
  `https://mirrors.aliyun.com/pypi/packages/21/f0/9fa6e85cb10c8eb36a0222d27e50fe381b86ce49a55446bf39f491727564/opencv_python-5.0.0.93-cp37-abi3-win_amd64.whl`
- numpy 2.5.4:
  `https://mirrors.aliyun.com/pypi/packages/90/8c/140a40398a66b4471211be1affdb6ed24c486d581bd28d07b7f2fcb69540/numpy-2.5.4-cp313-cp313-win_amd64.whl`

Wheels save to: `C:\Users\anasp\AppData\Local\Temp\opencode\wheels\`

## State / todos — ALL DONE ✓
- [x] numpy 2.5.4 installed (wheel from Aliyun)
- [x] opencv-python 5.0.0 installed (wheel from Aliyun)
- [x] Ran `capture_photo.py` → photo_20261025_111007.jpg (1280x720) + mirrored copy, shown in Review pane
- [x] Killed leftover HttpListener server on localhost:8765 (PID 10192)
