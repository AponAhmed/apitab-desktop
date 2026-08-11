const fs = require('fs');
const path = require('path');

// Electron's bundled `chrome-sandbox` SUID helper needs to be root-owned
// with mode 4755 to enable Chromium's OS-level sandbox on Linux. None of
// our four Linux targets ever apply that fixup: AppImage and tar.gz have no
// install step to run it in, and neither the deb nor rpm target here is
// configured with a postinst/postrpm scriptlet that would. Electron's
// zygote host hard-aborts before any window opens if the helper isn't
// configured correctly, and it does so in native Chromium startup — before
// the main process's own JS has run at all, so calling
// app.commandLine.appendSwitch('no-sandbox') from src/main/index.ts is too
// late to matter (confirmed by reproducing GitHub issue #10 in a real
// Fedora 44 container: that JS-level switch alone did not prevent the
// crash). The only thing that reliably avoids it is ELECTRON_DISABLE_SANDBOX
// set as a real environment variable *before* the process is exec'd — so
// this hook renames the real Electron binary and replaces it with a tiny
// wrapper script (matching the original name, so shortcuts/.desktop Exec=
// lines keep working unchanged) that sets the env var and execs the real
// binary. Verified working end-to-end against the real packaged output in
// the same Fedora 44 reproduction.
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
exec "$DIR/${realBinName}" "$@"
`;
  fs.writeFileSync(exePath, wrapper, { mode: 0o755 });
};
