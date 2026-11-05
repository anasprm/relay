# Dev Machine Setup — Inventory (anasp)

> Last updated: 2026-10-25. Everything below was verified working.

## Directory conventions

| Path | Purpose |
|---|---|
| `C:\Users\anasp\dev\projects` | All future code projects live here |
| `C:\Users\anasp\dev\scripts` | One-off automation scripts |
| `C:\Users\anasp\dev\tools` | Portable/standalone tools |
| `C:\Users\anasp\dev\logs` | Output logs from long-running jobs |
| Winget-managed tools | Installed system-wide, updated with `winget upgrade --all` |

## Installed toolchain

### Languages & runtimes
| Tool | Version | Location |
|---|---|---|
| Node.js LTS + npm | 24.22.1 | `C:\Program Files\nodejs` |
| Python (real install + pip) | 3.12.10 | `%LOCALAPPDATA%\Programs\Python\Python312` |
| Go | latest | `C:\Program Files\Go` (in progress — see Install log) |
| Rust (rustup) | latest | `%USERPROFILE%\.cargo` (in progress) |
| VS C++ Build Tools | 2022 | `C:\Program Files (x86)\Microsoft Visual Studio` (in progress) |

### Version control & platform
| Tool | Version | Notes |
|---|---|---|
| Git | 2.56.0 | Credential Manager enabled — pushes to GitHub browser-auth once, then never asks again |
| GitHub CLI | latest (in progress) | `gh auth login` after install |

### CLI utilities
| Tool | Version | Use |
|---|---|---|
| 7-Zip | 26.05 | archive create/extract (`7z`), also profile alias `extract` |
| ripgrep (`rg`) | 15.2.0 | fast code/text search — best regex search on Windows |
| fd | 10.5.0 | fast file finder |
| jq | 1.8.2 | JSON processing |
| FFmpeg (`ffmpeg`, `ffprobe`, `ffplay`) | 9.0.2 full build | audio/video convert, cut, extract |
| Neovim | latest (in progress) | terminal editor |

### Shell, terminal & containers
| Tool | Status |
|---|---|
| Windows Terminal | installing |
| PowerShell 7 (`pwsh`) | installing |
| Docker Desktop + WSL2 | installing (launch app once after reboot) |

### Editor / IDE
- VS Code — installed, configured **and wired to everything**: set as Git's default editor (`git config core.editor 'code --wait'`).

## Configuration decisions made for you

**Git (global):** default branch `main`, Unix-style line endings (`input`), VS Code as commit editor, auto-setup remote on push, prune on fetch. *Name/email are not set yet — tell me mine and I'll add them.*

**PowerShell profile** (both 5.1 and 7): aliases `gs` `gd` `ga` `gcm` `gco` `gl` (git), `serve`, `extract`, `refresh-path`.

## How I (OpenCode) work on this machine

1. Long installs run in **a single elevated batch** → one UAC prompt total.
2. Everything is logged and inventoried.
3. Anything missing for a task gets installed via winget (auto), pip/npm (per-project), or a portable binary into `dev\tools`.

## Maintenance
- Update everything: `winget upgrade --all`
- After a new install, shells don't see it until restarted (or run `refresh-path`).
