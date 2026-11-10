# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio at https://abhishekdp.com: an interactive 3D flight built with three.js and Vite, plus a static Markdown blog. Deployed to GitHub Pages by GitHub Actions. (It used to be a Hugo/PaperMod site; that's gone.)

## Commands

```bash
npm run dev       # Vite dev server for the 3D site (blog pages are NOT served in dev)
npm run build     # vite build && node scripts/build-blog.mjs  →  dist/
npm run preview   # serve dist/ on :4173 (use this to check blog pages)
```

Append `?debug` to the URL to get `window.__flight` (scene, camera, plane, islands, orbs, env).

## Architecture

- `src/content.js`: **all portfolio text**. Sections, experience, projects, skills, etc. Content changes only touch this file.
- `src/render.js`: pure HTML-string renderers (no DOM). Used by the in-flight panels, the classic view, and `vite.config.js` (which bakes the classic view into `index.html` at build time).
- `src/main.js`: boot/loader, renderer and post-processing, input (mouse, keys, touch joystick), camera, panels, toasts, main loop.
- `src/world/`
  - `environment.js`: Sky, Water (procedural normal map), instanced billboard clouds, stars, and the time-of-day presets (`TIMES`).
  - `islands.js`: procedural terrain, one primitive-built landmark per section, gates (fly-through rings), beacons, instanced trees. Island positions are in `LAYOUT`.
  - `plane.js`: procedural aircraft, flight model, autopilot, contrails.
  - `orbs.js`: skill collectibles (persisted in localStorage `flightlog.skills`).
  - `title.js`: 3D chrome nameplate.
  - `util.js`: seeded RNG, value noise/fbm, canvas textures, text sprites.
- `src/ui/hud.js` (gauges + radar), `src/ui/audio.js` (procedural Web Audio).
- `scripts/posts.mjs` reads `content/posts/*.md`. `scripts/build-blog.mjs` renders the post pages, post list, tag pages, RSS (`/index.xml` and `/posts/index.xml`), sitemap, robots, 404 and redirects for old Hugo URLs (`/portfolio/`, `/archives/`, `/search/`, `/categories/`). Styles: `scripts/blog.css`.
- `static/`: Vite publicDir, copied to the site root (`me.jpeg`, `favicon.svg`, `posts/...` images).

Rules of thumb:
- No external 3D/texture/audio assets; keep everything procedural.
- Keep it working on phones. `quality.low` in `main.js` lowers resolution, reflections, cloud count and bloom. Layout breakpoints are in `src/style.css` (≤900px: bottom-sheet panel, hamburger nav).
- If WebGL is missing or boot throws, the site falls back to the classic view; keep that path working.

## Deployment

`.github/workflows/deploy.yml`: on push to `main`, Node 22 → `npm ci` → `npm run build` → upload `dist/` → deploy to Pages. The custom domain is set in the repo's Pages settings (no CNAME file needed with Actions deploys).

## Blog Content Guidelines

### Naming
Use descriptive file names: `nix-package-manager.md`, `docker-essentials.md`, `regex-guide.md`. Avoid `first.md`, `post1.md`. The file name is the URL slug.

### Frontmatter
```yaml
---
title: "Post Title"
date: YYYY-MM-DDTHH:MM:SS-07:00
draft: false
tags: ["tag1", "tag2"]
---
```
No cover images. Posts with `draft: true` or a future date are skipped. Hugo-style `{#custom-id}` on headings is supported.

### ASCII Art Convention
Each post starts (right after the frontmatter) with relevant ASCII art in a code block **with no language**, including a tagline. Un-labelled code blocks are rendered as glowing centred "art"; labelled blocks get syntax highlighting and a copy button.

```markdown
\```
    ┌─────────────────────────────────┐
    │  ASCII art here                 │
    │  Tagline here                   │
    └─────────────────────────────────┘
\```
```
