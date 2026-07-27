import http from 'node:http';
import crypto from 'node:crypto';
import { shell } from 'electron';
import type { GoogleOAuthResult } from '@shared/types';

// Public per Google's own native-app guidance — installed-app client IDs
// aren't treated as confidential. The matching client_secret stays
// server-side only (apitab-server does the code→token exchange), so it's
// never embedded here.
const GOOGLE_DESKTOP_CLIENT_ID = '405992136210-5i73a1kpt456s14croh49p0dsp1etf2h.apps.googleusercontent.com';

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const CLOSE_TAB_HTML = `<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding-top:4rem;">
<h2>Signed in to ApiTab</h2><p>You can close this tab and return to the app.</p>
<script>window.close();</script></body></html>`;

const OAUTH_ERROR_HTML = `<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding-top:4rem;">
<h2>Sign-in failed</h2><p>You can close this tab and try again in ApiTab.</p></body></html>`;

/**
 * Native-app loopback flow (RFC 8252): opens the system browser to Google's
 * consent screen with a redirect_uri pointing at a one-shot local server,
 * then resolves once that server catches the redirect. The authorization
 * code is handed back to the renderer as-is — apitab-server performs the
 * actual code→token exchange, so client_secret never touches this process.
 */
export async function runGoogleOAuthLoopback(): Promise<GoogleOAuthResult> {
  const state = base64url(crypto.randomBytes(16));
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());

  return new Promise((resolve, reject) => {
    let redirectUri = '';

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error || !code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(OAUTH_ERROR_HTML);
        server.close();
        reject(new Error(error ?? 'Google sign-in was cancelled or the redirect was invalid.'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(CLOSE_TAB_HTML);
      server.close();
      resolve({ code, redirectUri, codeVerifier });
    });

    // Timeout if the user never completes (or abandons) the browser flow.
    const timeout = setTimeout(
      () => {
        server.close();
        reject(new Error('Google sign-in timed out.'));
      },
      5 * 60 * 1000,
    );
    server.on('close', () => clearTimeout(timeout));

    server.on('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      redirectUri = `http://localhost:${port}`;

      const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorizeUrl.searchParams.set('client_id', GOOGLE_DESKTOP_CLIENT_ID);
      authorizeUrl.searchParams.set('redirect_uri', redirectUri);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('scope', 'openid email profile');
      authorizeUrl.searchParams.set('code_challenge', codeChallenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');
      authorizeUrl.searchParams.set('state', state);

      void shell.openExternal(authorizeUrl.toString());
    });
  });
}
