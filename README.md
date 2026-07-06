# ApiTab Desktop

> Lightweight, local‑first API testing desktop app — a fast, minimal alternative to Postman.

ApiTab Desktop is the native Electron counterpart to the [ApiTab browser extension](https://github.com/AponAhmed/apitab): the same request builder, collections, environments, and scripting sandbox, packaged as a standalone Windows/macOS/Linux app with **no browser required and no CORS restrictions** on the requests you send.

Everything is stored locally by default — **no account, no login, no cloud needed**. An optional team-sync backend can be enabled for shared collections and variables (see [Team Collaboration](#team-collaboration) below).

Built with **Electron + electron-vite + React + TypeScript + Tailwind CSS + Zustand**.

---

## Download

Prebuilt installers for Windows, macOS, and Linux are published on the [Releases page](https://github.com/AponAhmed/apitab-desktop/releases), and linked from the [ApiTab landing page](https://apitab.duckdns.org).

Builds are currently **unsigned** (no code-signing certificate yet):

- **Windows** — SmartScreen will show "Windows protected your PC". Click **More info → Run anyway**.
- **macOS** — Gatekeeper will say the app "is damaged" or can't be opened. Right-click the app → **Open**, or run `xattr -cr /Applications/ApiTab.app` once.
- **Linux** — the `.AppImage` needs `chmod +x` before running; the `.tar.gz` just needs extracting.

---

## Features

- **Request Builder** — `GET` `POST` `PUT` `PATCH` `DELETE` `OPTIONS` `HEAD`
  - Query params (kept in sync with the URL), dynamic headers with suggestions
  - Auth: No Auth · Bearer Token · Basic Auth · API Key (header or query)
  - Body: JSON (with beautify + live validation) · Raw · Form URL Encoded · Form Data
- **Response Viewer** — status, timing, size, Pretty/Raw body with syntax highlighting, response headers, generated cURL and code snippets (Fetch, Axios, PHP cURL, Laravel HTTP, Python Requests)
- **Scripts** — pre-request and post-response JavaScript, run inside a sandboxed iframe (opaque origin, no Node/Electron access), exposing a `pm.*`-compatible API (`apitab.*` also works) so pasted Postman scripts run unmodified. Post-response scripts support `pm.test()` assertions, shown in a Tests tab alongside captured `console.log` output.
- **Collections** — nested folders, create/rename/duplicate/delete, save/update/duplicate requests, search
- **Environments** — `{{variable}}` interpolation resolved before sending and in generated cURL/code
- **Import** — Postman Collection (v2/v2.1) and Environment exports, cURL commands, and ApiTab's own JSON backup format
- **History** — automatic, keeps the latest *N* requests; reopen, delete, clear all
- **Team Collaboration** *(optional)* — log in, share a collection with a team, and role-aware sync keeps everyone's copy up to date; individual environment variables can be flagged to sync to a per-team shared pool, while environments themselves always stay local. See [Team Collaboration](#team-collaboration).
- **Dark mode**, keyboard shortcuts, JSON backup import/export

---

## Tech Stack

| Area | Choice |
| --- | --- |
| Shell | [Electron](https://www.electronjs.org/) 43, [electron-vite](https://electron-vite.org/), electron-builder |
| UI | React 19, TypeScript, Tailwind CSS v4, Lucide icons |
| State | Zustand, persisted via `electron-store` through an IPC bridge |
| HTTP | Executed in the **main process** (Node), so no browser CORS restrictions apply |
| Scripting | A `sandbox="allow-scripts"` iframe (`sandbox.html`) runs pre-request/post-response scripts in isolation |
| Team sync | Optional Laravel + Sanctum backend ([apitab-server](https://github.com/AponAhmed/apitab-server)) |

---

## Getting Started

### Prerequisites

- **Node.js ≥ 18** (developed on Node 22)
- npm

### Install & develop

```bash
npm install
npm run dev          # launches the app with hot reload
```

### Type-check

```bash
npm run typecheck     # both the main/preload (node) and renderer (web) tsconfigs
```

### Production build (no installer)

```bash
npm run build          # bundles main/preload/renderer into ./out
npm run start           # preview the production build
```

---

## Build & Package

Cross-platform installers are built with [electron-builder](https://www.electron.build/), configured in `electron-builder.yml`:

| Platform | Command | Output |
| --- | --- | --- |
| Windows | `npm run dist:win` | NSIS installer, x64 (`dist/apitab-desktop-<version>-setup.exe`) |
| macOS | `npm run dist:mac` | DMG, x64 + arm64 (`dist/apitab-desktop-<version>.dmg`) |
| Linux | `npm run dist:linux` | AppImage + tar.gz, x64 |
| All (current OS only) | `npm run dist` | Whichever target(s) the host OS supports |

> electron-builder can only build **macOS** targets on a Mac and **Windows** targets natively/on Windows — cross-compiling from Linux CI is why the GitHub Actions release workflow (`.github/workflows/build.yml`) runs a `windows-latest` / `macos-latest` / `ubuntu-latest` matrix rather than building everything on one runner.

### Releasing

Pushing a `v*` tag (e.g. `git tag v0.5.0 && git push origin v0.5.0`) triggers the release workflow: it builds all three platforms and publishes the installers as assets on a GitHub Release for that tag. Update the version in `package.json` first (`Bump version to X.Y.Z`, matching the tag).

---

## Team Collaboration

Team sync is entirely optional and off by default — without logging in, everything behaves exactly like a local-only app.

When enabled:

- **Shared collections** — share a personal collection with a team; **owners/admins** can edit it for everyone, **members** get a local-only read-through view (their edits/deletes never leave their device, and the server rejects direct writes from that role too).
- **Shared variables** — an environment variable flagged "shared" syncs to a flat per-team key/value pool, merged into interpolation as a fallback under your active environment's own values. Environments themselves are never uploaded — only individually-flagged values.
- **Workspace grouping** — the Collections sidebar separates your personal workspace from each team's shared space, with a role badge (owner/admin/member) per team.

The backend URL and API key are **build-time constants** in `src/renderer/src/config/server.ts` — to self-host, deploy your own copy of [apitab-server](https://github.com/AponAhmed/apitab-server) and point this file at it before building.

---

## Architecture

```
src/
├── main/                  # Electron main process (Node)
│   ├── index.ts           # Window creation, IPC handlers
│   ├── requestHandler.ts  # Executes HTTP requests (no CORS — runs in Node, not a browser)
│   └── store.ts           # electron-store-backed key/value storage
├── preload/
│   └── index.ts           # contextBridge: exposes `window.api.{request,storage,app}` to the renderer
├── renderer/
│   ├── index.html          # Main app window
│   ├── sandbox.html         # sandbox="allow-scripts" iframe that runs user pre-request/post-response scripts
│   └── src/
│       ├── config/         # Build-time server URL/API key constants
│       ├── stores/         # Zustand stores (request, collections, environments, teams, settings, …)
│       ├── services/       # apiClient, syncService, requestService, sandboxProtocol
│       ├── features/       # Collections/Environments/Requests/Account panels
│       ├── components/     # Reusable UI
│       ├── hooks/, utils/, types/
│       └── sandbox-main.ts # Entry point loaded inside the sandbox iframe
└── shared/
    └── types.ts             # Types shared between main and renderer (IPC payloads)
```

**Why a Node-process HTTP client instead of the renderer's `fetch`?** Requests execute in the Electron **main process**, which isn't subject to a browser's CORS restrictions — the desktop equivalent of the browser extension's background-service-worker `fetch`.

**Storage** — `electron-store` in the main process is exposed to the renderer via a `browser.storage.local`-shaped IPC API (`window.api.storage`), so the extension's Zustand persist adapters port over with minimal changes.

**Security** — the renderer runs with `contextIsolation: true` and `nodeIntegration: false`; it only ever touches Node/Electron internals through the typed `contextBridge` API in `preload/index.ts`.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start electron-vite in dev mode with hot reload |
| `npm run build` | Production build of main/preload/renderer |
| `npm run typecheck` | Type-check both the node and web TypeScript projects |
| `npm run start` | Preview the production build |
| `npm run package` | Build + package an unpacked app directory (no installer) |
| `npm run dist` | Build + package an installer for the current OS |
| `npm run dist:win` / `dist:mac` / `dist:linux` | Build + package for a specific OS |

---

## Related Projects

- [**apitab**](https://github.com/AponAhmed/apitab) — the browser extension (Chrome/Firefox), same feature set
- [**apitab-server**](https://github.com/AponAhmed/apitab-server) — the optional Laravel + Sanctum team-sync backend

---

## License

MIT — use it, fork it, ship it.
