# Security Policy

## Supported Versions

Only the latest published release of ApiTab Desktop is supported with
security fixes. The app checks for updates automatically — please update
before reporting an issue (Help → About, or the update banner).

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, email **apon2041@gmail.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal repro is very helpful)
- The app version and OS/platform build (installer/AppImage/deb/rpm/dmg)

You should receive an acknowledgment within a few days. Once a fix is
confirmed, a new release will be published and, where appropriate, credit
given to the reporter (unless you'd prefer to stay anonymous).

## Scope

ApiTab Desktop is local-first: requests and workspace data (collections,
environments, history) are stored on-device via `electron-store` and never
leave the machine unless you explicitly enable the optional team-sync
feature, which talks to the [apitab-server](https://github.com/AponAhmed/apitab-server)
backend over HTTPS. Vulnerabilities of particular interest include:

- Anything that could achieve remote code execution via the renderer
  (e.g. a `contextIsolation`/`nodeIntegration` bypass, or escaping the
  pre-request/post-response script sandbox iframe)
- Anything that could exfiltrate stored requests/collections/environment
  variables to a third party
- Auth/token handling issues in the optional team-sync flow
- Auto-update (`electron-updater`) integrity issues
- IPC surface issues (main ⇄ preload ⇄ renderer) that grant the renderer more
  than its intended access
