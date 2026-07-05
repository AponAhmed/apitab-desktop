import { uuid } from '@/utils/id';
import {
  SANDBOX_READY,
  SANDBOX_RESULT,
  SANDBOX_RUN,
  type SandboxRunMessage,
} from './sandboxProtocol';
import type { ScriptContext, ScriptRun } from '@/types';

const empty = (error?: string): ScriptRun => ({ tests: [], logs: [], envUpdates: {}, error });

let iframe: HTMLIFrameElement | null = null;
let ready: Promise<void> | null = null;
let markReady: (() => void) | null = null;
const pending = new Map<string, (r: ScriptRun) => void>();

function onMessage(e: MessageEvent) {
  const data = e.data;
  if (!data) return;
  if (data.type === SANDBOX_READY) {
    markReady?.();
    return;
  }
  if (data.type === SANDBOX_RESULT && typeof data.id === 'string') {
    const cb = pending.get(data.id);
    if (cb) {
      pending.delete(data.id);
      cb(data.result as ScriptRun);
    }
  }
}

function ensureIframe(): Promise<void> {
  if (iframe && ready) return ready;
  window.addEventListener('message', onMessage);
  iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  // No `sandbox` attribute: a sandboxed (opaque-origin) iframe can't load a
  // file:// resource in a packaged build ("Not allowed to load local
  // resource"). Isolation from the parent's React/Zustand state doesn't
  // depend on it anyway — the iframe is already a separate JS realm that
  // talks to the parent only via postMessage (below), and it never receives
  // a preload script (no window.api), regardless of the sandbox attribute.
  // sandbox.html's own CSP meta tag is what permits `new Function`.
  iframe.style.display = 'none';
  iframe.src = 'sandbox.html';
  ready = new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    markReady = done;
    // Proceed even if the ready signal is missed; per-run timeouts handle hangs.
    setTimeout(done, 4000);
  });
  document.body.appendChild(iframe);
  return ready;
}

function reset() {
  iframe?.remove();
  iframe = null;
  ready = null;
  markReady = null;
  for (const cb of pending.values()) cb(empty('Script sandbox was reset.'));
  pending.clear();
}

/** Runs a user script in the sandbox and resolves with its result. */
export async function runScript(
  code: string,
  context: ScriptContext,
  timeoutMs = 5000,
): Promise<ScriptRun> {
  if (!code.trim()) return empty();
  await ensureIframe();
  const target = iframe?.contentWindow;
  if (!target) return empty('Script sandbox unavailable.');

  const id = uuid();
  const message: SandboxRunMessage = { type: SANDBOX_RUN, id, code, context };

  return new Promise<ScriptRun>((resolve) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (r: ScriptRun) => {
      if (done) return;
      done = true;
      pending.delete(id);
      clearTimeout(timer);
      resolve(r);
    };
    pending.set(id, finish);
    timer = setTimeout(() => {
      reset(); // tear down a possibly stuck (infinite-loop) sandbox
      finish(empty('Script timed out (possible infinite loop).'));
    }, timeoutMs);
    target.postMessage(message, '*');
  });
}
