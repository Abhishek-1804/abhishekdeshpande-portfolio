---
title: "8 Essential CLI Tools Every Developer Should Master"
date: 2025-12-02T10:00:00-07:00
draft: false
tags:
  [
    "cli tools",
    "developer tools",
    "productivity",
    "terminal",
    "command line",
  ]
---

```
    ┌─────────────────────────────────────┐
    │ user@terminal:~$                    │
    │ ❯ ffmpeg -i video.mp4 output.webm  │
    │ ❯ rg "TODO" --type js               │
    │ ❯ fzf --preview 'cat {}'            │
    │ ❯ lazygit                           │
    │ ❯ yt-dlp https://youtu.be/...       │
    │ ❯ tldr docker                       │
    │ ❯ eza --tree --git                  │
    │                                     │
    │ Power at Your Fingertips ⚡         │
    └─────────────────────────────────────┘
```

The right CLI tools can transform your terminal from intimidating to indispensable. These eight tools have become essential in modern development workflows, each solving specific problems with speed and elegance. Master them, and watch your productivity soar.

---

## 1. FFmpeg: The Swiss Army Knife of Media Processing

FFmpeg handles virtually any media task: convert formats, extract audio, create thumbnails, resize videos, or stream content. It's lightning-fast, supports every format imaginable, and perfect for automation.

### Installation

```bash
# macOS
brew install ffmpeg

# Debian/Ubuntu
sudo apt install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

### Essential Commands

**Convert video format:**
```bash
ffmpeg -i input.mp4 output.webm
```

**Extract audio from video:**
```bash
ffmpeg -i video.mp4 -vn -acodec libmp3lame audio.mp3
```

**Create thumbnail at 5 seconds:**
```bash
ffmpeg -i video.mp4 -ss 00:00:05 -vframes 1 thumbnail.jpg
```

**Resize video (maintains aspect ratio):**
```bash
ffmpeg -i input.mp4 -vf scale=1280:-1 output.mp4
```

---

## 2. Ripgrep: Blazing Fast Code Search

Ripgrep (rg) is grep on steroids. It's 5-10x faster, automatically ignores `.gitignore` files, skips binaries, and outputs beautiful syntax-highlighted results. Written in Rust for speed.

### Installation

```bash
# macOS
brew install ripgrep

# Debian/Ubuntu
sudo apt install ripgrep

# Arch Linux
sudo pacman -S ripgrep
```

### Essential Commands

**Search across your project:**
```bash
rg "function.*export"
# Output: src/utils.ts:15:export function processData() {
#         lib/api.ts:42:export function fetchUsers() {
```

**Case-insensitive search:**
```bash
rg -i "todo"
# Output: app.js:23:  // TODO: refactor this
#         main.ts:67:  // todo: add error handling
```

**Search specific file types:**
```bash
rg "API_KEY" --type js
# Output: config.js:5:const API_KEY = process.env.API_KEY;
```

**Show context (3 lines before/after):**
```bash
rg "error" -C 3
```

**Count occurrences:**
```bash
rg "console.log" --count
# Output: app.js:12
#         utils.js:7
```

---

## 3. FZF: Fuzzy Finding Made Easy

FZF provides interactive fuzzy search for files, command history, and processes. Type a few letters, see filtered results instantly. Integrates with shell, Git, Vim, and more.

### Installation

```bash
# macOS
brew install fzf

# Debian/Ubuntu
sudo apt install fzf

# Arch Linux
sudo pacman -S fzf
```

### Essential Commands

**Find and open file:**
```bash
vim $(fzf)
# Opens interactive fuzzy finder, select file with arrow keys + Enter
```

**Search command history (after shell integration):**
```bash
# Press Ctrl+R
# Type: git
# See: git commit -m "fix bug"
#      git push origin main
#      git status
```

**Preview files before opening:**
```bash
fzf --preview 'cat {}'
# Shows file preview in split pane as you navigate
```

**Find and kill process:**
```bash
kill -9 $(ps aux | fzf | awk '{print $2}')
```

**Quick directory navigation:**
```bash
cd $(find . -type d | fzf)
```

---

## 4. Lazy Git: Git Made Visual

Lazy Git is a terminal UI that makes Git operations intuitive. See your working tree, branches, commits, and diffs simultaneously. Perform complex operations without memorizing commands.

### Installation

```bash
# macOS
brew install lazygit

# Debian/Ubuntu (requires adding PPA)
sudo add-apt-repository ppa:lazygit-team/release
sudo apt update
sudo apt install lazygit

# Arch Linux
sudo pacman -S lazygit
```

### Essential Commands

**Launch Lazy Git:**
```bash
lazygit
# Opens full-screen TUI with:
# - Files panel (stage/unstage with space)
# - Branches panel (create/switch/delete)
# - Commits panel (view history)
# - Stash panel (save/apply/drop)
```

**Key shortcuts inside Lazy Git:**
```
space  → Stage/unstage file
c      → Commit staged changes
P      → Push to remote
p      → Pull from remote
n      → Create new branch
m      → Merge branch
r      → Rebase
```

---

## 5. Lazy Docker: Docker Management Simplified

Lazy Docker brings the same elegant UI to Docker. Monitor containers, view logs, inspect resources, and clean up—all from one intuitive dashboard.

### Installation

```bash
# macOS
brew install lazydocker

# Debian/Ubuntu
sudo apt install lazydocker

# Arch Linux
sudo pacman -S lazydocker
```

### Essential Commands

**Launch Lazy Docker:**
```bash
lazydocker
# Opens TUI showing:
# - Running containers with real-time stats
# - Images and volumes
# - Logs streaming live
# - Quick start/stop/remove actions
```

**Key shortcuts inside Lazy Docker:**
```
l      → View container logs
e      → View container environment variables
s      → View container stats
Enter  → View container details
d      → Remove container/image
```

---

## 6. YT-DLP: Download Videos Like a Pro

YT-DLP downloads videos from YouTube and 1000+ other sites. It's fast, actively maintained, and packed with features: format selection, playlist downloads, subtitle embedding, and sponsor block integration.

### Installation

```bash
# macOS
brew install yt-dlp

# Debian/Ubuntu
sudo apt install yt-dlp

# Arch Linux
sudo pacman -S yt-dlp
```

### Essential Commands

**Download best quality:**
```bash
yt-dlp "https://www.youtube.com/watch?v=VIDEO_ID"
# [youtube] Extracting URL: https://www.youtube.com/watch?v=VIDEO_ID
# [youtube] VIDEO_ID: Downloading webpage
# [download] Destination: Video Title [VIDEO_ID].webm
# [download] 100% of 45.2MiB in 00:12
```

**Download audio only:**
```bash
yt-dlp -x --audio-format mp3 "VIDEO_URL"
# [download] Destination: Audio Title.webm
# [ExtractAudio] Destination: Audio Title.mp3
```

**Download entire playlist:**
```bash
yt-dlp -o "%(playlist_index)s-%(title)s.%(ext)s" "PLAYLIST_URL"
# [download] 01-First Video.webm
# [download] 02-Second Video.webm
```

**Download with subtitles:**
```bash
yt-dlp --write-subs --sub-lang en --embed-subs "VIDEO_URL"
```

**Limit bandwidth:**
```bash
yt-dlp --limit-rate 1M "VIDEO_URL"
```

---

## 7. tldr: Man Pages for Humans

Skip dense man pages. tldr gives you practical, example-driven documentation that gets you productive immediately. Community-driven and focused on common use cases.

### Installation

```bash
# macOS
brew install tldr

# Debian/Ubuntu
sudo apt install tldr

# Arch Linux
sudo pacman -S tldr
```

### Essential Commands

**Get quick help for any command:**
```bash
tldr tar
```

**Output:**
```
  tar
  Archiving utility

  - Extract a tar file:
    tar -xf archive.tar

  - Create a tar archive:
    tar -cf archive.tar file1 file2

  - Extract a gzipped tar file:
    tar -xzf archive.tar.gz

  - Create a gzipped tar archive:
    tar -czf archive.tar.gz file1 file2
```

**More examples:**
```bash
tldr docker
tldr git-rebase
tldr rsync
tldr curl
```

---

## 8. eza: ls Reimagined

eza is a modern replacement for `ls` with colors, icons, Git integration, and tree views. It makes directory listings actually readable and informative.

### Installation

```bash
# macOS
brew install eza

# Debian/Ubuntu
sudo apt install eza

# Arch Linux
sudo pacman -S eza
```

### Essential Commands

**Basic listing with icons:**
```bash
eza --icons
# 📁 src
# 📄 README.md
# 📄 package.json
# 📁 node_modules
```

**Long format with Git status:**
```bash
eza -l --git
# .rw-r--r-- 1.2k user 15 Nov 12:30  M  app.js
# .rw-r--r--  856 user 15 Nov 11:45 --  config.js
# drwxr-xr-x    - user 14 Nov 09:12 --  src
```

**Tree view (2 levels deep):**
```bash
eza --tree --level=2
# .
# ├── src
# │  ├── index.js
# │  └── utils.js
# ├── package.json
# └── README.md
```

**Sort by modified time:**
```bash
eza -l --sort=modified
```

**Show all files with details:**
```bash
eza -la --git
```

---

## Get Started Now

Install these tools based on your needs:

```bash
# macOS (all at once)
brew install ffmpeg ripgrep fzf lazygit lazydocker yt-dlp tldr eza

# Arch Linux (all at once)
sudo pacman -S ffmpeg ripgrep fzf lazygit lazydocker yt-dlp tldr eza
```

**Recommended starter pack:** ripgrep, fzf, and tldr. They're lightweight and provide immediate value.

**Add aliases to your shell config** (`~/.zshrc` or `~/.bashrc`):
```bash
alias ls='eza --icons'
alias ll='eza -l --icons --git'
alias rg='rg --smart-case'
```

These tools represent modern CLI innovation—each solving real problems developers face daily. Start with one or two, master them, then expand your toolkit. Your terminal will transform from necessity into productivity powerhouse.
