# Contributing to ApiTab Desktop

Thanks for taking the time to contribute! This project is an Electron app
built with electron-vite, React, TypeScript, Tailwind CSS, and Zustand.

## Getting started

```bash
npm install
npm run dev            # launches the app with hot reload
npm run typecheck      # main/preload (node) + renderer (web) tsconfigs
```

See the [README](README.md) for the full architecture overview, keyboard
shortcuts, and packaging instructions.

## Before you open a pull request

1. **Type-check.** `npm run typecheck` must pass with no errors.
2. **Build.** `npm run build` must succeed.
3. **Keep the diff focused.** One logical change per PR — a bug fix doesn't
   need an accompanying refactor, and a new feature shouldn't reformat
   unrelated files.
4. **Match the existing style.** No new code comments unless they explain a
   non-obvious *why* (a hidden constraint, a workaround, a subtle invariant).
   Prefer editing existing files over adding new abstractions.
5. **Describe the change.** In the PR description, explain what changed and
   why — screenshots or a short clip are welcome for UI changes.
6. If you touch anything shared with the [ApiTab browser extension](https://github.com/AponAhmed/apitab)
   (the store/service logic is intentionally kept close to identical between
   the two), consider whether the same fix should be ported there.

## Reporting bugs

Open an issue using the **Bug report** template. Include your OS + platform
build (installer/AppImage/deb/rpm/dmg), the app version (Help → About), and
steps to reproduce. Logs from the DevTools console (`Ctrl+Shift+I` /
`Cmd+Option+I` in a dev build) are extremely helpful.

## Suggesting features

Open an issue using the **Feature request** template. Describe the problem
you're trying to solve, not just the solution — it helps evaluate whether it
fits the project's local-first, no-login-required-by-default philosophy.

## Security issues

Please **do not** open a public issue for security vulnerabilities — see
[SECURITY.md](SECURITY.md) instead.

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you're expected to uphold it.

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](LICENSE).
