# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal portfolio website built with Hugo (v0.147.0+) using the PaperMod theme as a git submodule. The site is deployed to GitHub Pages via automated workflows and is accessible at https://abhishekdp.com.

## Development Commands

### Local Development
```bash
# Start the development server (usually at http://localhost:1313/)
hugo server

# Build the site (output goes to ./public/)
hugo

# Build with minification and garbage collection (production-like build)
hugo --gc --minify
```

### Content Management
```bash
# Create a new blog post
hugo new posts/post-name.md

# Create a new project page
hugo new projects/project-name.md
```

### Theme Management
```bash
# Clone the repository with theme submodule
git clone --recurse-submodules https://github.com/abhishekdeshpande/abhishekdeshpande_portfolio.git

# If already cloned without submodules, initialize them
git submodule update --init --recursive

# Update PaperMod theme to latest version
git submodule update --remote --merge
```

## Architecture

### Directory Structure

- **content/**: All markdown content organized by section
  - **posts/**: Blog posts with frontmatter metadata
  - **portfolio/**: Portfolio page (index.md contains skills, work experience, projects)
  - **projects/**: Individual project pages
  - **archives.md**: Archive listing page
  - **search.md**: Search functionality page

- **static/**: Static assets served directly
  - **me.jpeg**: Profile image
  - **posts/**: Assets for blog posts (images, diagrams, etc.)
  - **icons/**: Site icons

- **layouts/**: Custom template overrides for PaperMod theme
  - **_default/baseof.html**: Base template override with GoatCounter analytics integration
  - **partials/analytics.html**: GoatCounter analytics script

- **themes/PaperMod/**: Git submodule for the PaperMod theme

- **public/**: Generated static site (git-ignored, created by Hugo build)

- **resources/**: Hugo's cache directory

### Configuration (hugo.yaml)

Key configuration aspects:
- **Base URL**: abhishekdp.com
- **Theme**: PaperMod (submodule)
- **Profile Mode**: Enabled with custom buttons (Portfolio, Resume, Blog)
- **Features**: Search (uses Fuse.js), RSS, reading time, share buttons, code copy, TOC
- **Analytics**: GoatCounter integration (abhishek.goatcounter.com)
- **Output Formats**: HTML, RSS, and JSON (for search functionality)

### Custom Implementations

**Analytics Integration**: Custom GoatCounter integration is implemented via:
1. `layouts/_default/baseof.html` - Conditionally includes analytics partial when `goatcounter` param is set
2. `layouts/partials/analytics.html` - Contains the GoatCounter script

**Menu Structure**: Main navigation defined in hugo.yaml includes Home, Portfolio, Blog, Archives, Search, and external Stats link.

## Deployment

The site uses GitHub Actions for automated deployment to GitHub Pages:
- **Workflow**: `.github/workflows/hugo.yaml`
- **Hugo Version**: 0.147.0 (extended version)
- **Trigger**: Pushes to `main` branch or manual workflow dispatch
- **Build Process**:
  1. Checks out repo with submodules
  2. Builds with Hugo (--gc --minify flags)
  3. Deploys to GitHub Pages from ./public/

**Important**: When upgrading Hugo locally, you must update the `HUGO_VERSION` in `.github/workflows/hugo.yaml` to match.

## Content Guidelines

### Blog Post Naming Convention
Blog post files should use descriptive, concise names that reflect their content:
- Good: `nix-package-manager.md`, `docker-essentials.md`, `regex-guide.md`
- Avoid: `first.md`, `second.md`, `post1.md`

### Blog Post Frontmatter
Posts in `content/posts/` should include:
```yaml
---
title: "Post Title"
date: YYYY-MM-DDTHH:MM:SS-07:00
draft: false
tags: ["tag1", "tag2"]
---
```

**Note**: Cover images are NOT used in this blog. The `cover:` field should be omitted from frontmatter.

### ASCII Art Convention
Each blog post should include relevant ASCII art immediately after the frontmatter (after the `---`) and before the introduction text. The ASCII art should:
- Be visually appealing and appropriately sized
- Be relevant to the blog post topic
- Be placed in a markdown code block with no language specified (just triple backticks)
- Include a tagline or caption that captures the essence of the post

Example:
```markdown
---
title: "My Blog Post"
date: 2025-12-02T10:00:00-07:00
draft: false
tags: ["example"]
---

\```
    ┌─────────────────────────────────┐
    │  ASCII art here                 │
    │  Tagline here                   │
    └─────────────────────────────────┘
\```

## Introduction
...
```

### Theme Customization

To override PaperMod theme templates:
1. Copy the template from `themes/PaperMod/layouts/` to `layouts/`
2. Maintain the same directory structure
3. Modify as needed - Hugo will use the local version over the theme version

Avoid modifying files directly in `themes/PaperMod/` as it's a git submodule and changes will be lost on updates.
