/** Platform/version identifiers for analytics — mirrors the extension's synchronous equivalent, but resolved over IPC since the renderer has no direct Node/OS access. */
let cachedPlatform: string | null = null;
let cachedVersion: string | null = null;

export async function getPlatform(): Promise<string> {
  if (cachedPlatform) return cachedPlatform;
  const raw = await window.api.app.getPlatform();
  const label = raw === 'win32' ? 'win' : raw === 'darwin' ? 'mac' : raw;
  const platform = `desktop-${label}`;
  cachedPlatform = platform;
  return platform;
}

export async function getAppVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  const version = await window.api.app.getVersion();
  cachedVersion = version;
  return version;
}
