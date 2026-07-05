import {
  SANDBOX_READY,
  SANDBOX_RUN,
  SANDBOX_RESULT,
  type SandboxResultMessage,
} from '@/services/sandboxProtocol';
import { runUserScript } from '@/utils/scriptSandbox';

/*
 * Sandboxed iframe page (loaded with the HTML `sandbox="allow-scripts"`
 * attribute — see scriptRunner.ts): an opaque-origin page that's allowed to
 * run `new Function(...)` even though the main renderer forbids it via CSP.
 * It runs user scripts via runUserScript and talks to the app only through
 * postMessage — no access to Node, Electron, or window.api.
 */
window.addEventListener('message', (e: MessageEvent) => {
  const data = e.data;
  if (!data || data.type !== SANDBOX_RUN) return;
  const result = runUserScript(data.code, data.context);
  const message: SandboxResultMessage = { type: SANDBOX_RESULT, id: data.id, result };
  window.parent.postMessage(message, '*');
});

window.parent.postMessage({ type: SANDBOX_READY }, '*');
