import { useEffect, useRef } from 'react';
import { apiClient } from '@/services/apiClient';
import { useAccountStore } from '@/stores/accountStore';
import { uuid } from '@/utils/id';
import { getAppVersion, getPlatform } from '@/utils/runtimeInfo';

/** How often to refresh `last_seen_at` while the page is open and visible — the primary signal for session duration, since an explicit end rarely fires reliably on abrupt close. */
const HEARTBEAT_MS = 120_000;

/**
 * First-party usage tracking: one session per page load, identified once
 * signed in. Every call is fire-and-forget — analytics must never affect
 * the app, so failures are swallowed everywhere here.
 */
export function useAnalyticsSession() {
  const sessionIdRef = useRef<string>(uuid());

  useEffect(() => {
    const sessionId = sessionIdRef.current;
    let cancelled = false;

    void (async () => {
      // On a fresh app launch, accountStore's own automatic hydration from
      // disk may not have finished yet — without this, a genuinely logged-in
      // user's very first session/start call (fired the instant this effect
      // mounts) reads `session` as still null and goes out unauthenticated,
      // permanently miscounting them as anonymous for that session's whole
      // lifetime (heartbeat only upgrades an existing session later; a short
      // visit that ends before the first heartbeat never gets the chance).
      await useAccountStore.persist.rehydrate();
      const [platform, appVersion] = await Promise.all([getPlatform(), getAppVersion()]);
      if (cancelled) return;
      try {
        await apiClient.startAnalyticsSession(sessionId, platform, appVersion);
      } catch {
        // best-effort
      }
    })();

    // Only counts while the page is actually visible, so a tab left open
    // and forgotten in the background doesn't inflate "time used."
    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      apiClient.heartbeatAnalyticsSession(sessionId).catch(() => {});
    };
    const interval = setInterval(heartbeat, HEARTBEAT_MS);

    // Best-effort only — a fetch() fired from unload frequently never
    // completes, but the heartbeat above already carries the real duration
    // up to the last visible tick, so a missed end call is harmless.
    const onUnload = () => {
      apiClient.endAnalyticsSession(sessionId).catch(() => {});
    };
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
    };
  }, []);
}
