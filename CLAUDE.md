# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome Extension (Manifest v3) that replaces the default new tab page with a customizable start page. **No build system** — load unpacked directly into Chrome.

## Development Workflow

**Loading the extension:**
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" and select this directory

**After changes:** Click the reload icon on the extension card in `chrome://extensions`, then open a new tab.

There are no build steps, no test suite, and no package manager.

## Architecture

Single-page extension with three files:

- [new-tab.html](new-tab.html) — page structure: bookmarks grid, settings panel, modal, context menu
- [new-tab.js](new-tab.js) — all logic (~520 lines, no modules)
- [new-tab.css](new-tab.css) — glassmorphism design using CSS custom properties for theming

State is persisted in `localStorage` under the key `ntp_state`.

### JS Organization (new-tab.js)

| Lines | Concern |
|-------|---------|
| 1–20 | i18n helpers (`t()` wraps `chrome.i18n.getMessage`) |
| 31–55 | State load/save with defaults |
| 57–127 | Background (solid color, 6 preset gradients, custom image) |
| 128–173 | Card theming via CSS custom properties |
| 175–257 | Bookmarks: render, drag-and-drop reorder, favicon loading |
| 267–302 | Context menu (edit/remove) |
| 304–383 | Modal for add/edit bookmarks |
| 385–403 | Settings panel open/close |
| 405–483 | Recent history (last 20 unique domains, excludes bookmarked) |
| 485–519 | Init: apply state, wire event listeners |

### Favicon Strategy

Three-tier fallback in `loadFavicon()`:
1. Chrome's internal favicon API (`chrome-extension://_favicon/?pageUrl=…`)
2. Google's favicon service (`https://www.google.com/s2/favicons?…`)
3. Generated letter avatar (first letter of domain, colored background)

### Localization

All UI strings live in `_locales/en_US/messages.json` and `_locales/pt_BR/messages.json`. HTML elements use `data-i18n` attributes; JS uses `t('key')`. Default locale is `pt_BR`.

### Permissions

- `history` — for the "Recently Visited" section
- `favicon` — for the local Chrome favicon API
