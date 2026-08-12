const fs = require('fs');
const path = require('path');

// Wraps the real Electron binary in a small launcher script (matching the
// original name, so shortcuts/.desktop Exec= lines keep working unchanged)
// that sets real process argv/env before exec'ing the renamed real binary.
// "Real" specifically because app.commandLine.appendSwitch() from the main
// process's own JS is too late for flags Chromium's native init reads
// before that JS ever runs — confirmed the hard way for --no-sandbox (GitHub
// issue #10: that JS-level switch alone did not stop Electron's zygote host
// from aborting before any window opened) and not worth re-risking for
// --ozone-platform either, so both fixes below go through this same
// exec-time mechanism rather than in-app code.
//
// Fix 1 — chrome-sandbox: needs to be root-owned with mode 4755 to enable
// Chromium's OS-level sandbox. None of our four Linux targets ever apply
// that: AppImage/tar.gz have no install step to run it in, and neither the
// deb nor rpm target here has a postinst/postrpm scriptlet configured to.
// ELECTRON_DISABLE_SANDBOX set as a real environment variable before the
// process is exec'd is what actually avoids the abort.
//
// Fix 2 — Ozone/Wayland: Electron's native Wayland renderer has real,
// still-unresolved bugs on several compositors (confirmed on Fedora/GNOME
// Wayland — installs and starts, but no window ever appears, no error
// either) and is a known-common failure mode on Hyprland specifically
// (less mainstream compositor, incomplete Wayland protocol support Ozone
// expects). --ozone-platform=x11 forces the well-supported XWayland
// compatibility path instead. Unconditional and safe on true X11 sessions
// (Xfce etc.) too — X11 is already the native platform there, so this is a
// no-op, not a behavior change.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;

  const exeName = context.packager.executableName;
  const exePath = path.join(context.appOutDir, exeName);
  const realBinName = `${exeName}-bin`;
  const realBinPath = path.join(context.appOutDir, realBinName);

  fs.renameSync(exePath, realBinPath);

  const wrapper = `#!/bin/bash
export ELECTRON_DISABLE_SANDBOX=1
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
exec "$DIR/${realBinName}" --ozone-platform=x11 "$@"
`;
  fs.writeFileSync(exePath, wrapper, { mode: 0o755 });
};
