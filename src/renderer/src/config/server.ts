/**
 * ApiTab team-sync backend base URL. Swap this for your deployed Laravel
 * server's URL before shipping a production build.
 */
export const API_BASE_URL = 'https://apitab.duckdns.org/api';

/**
 * Static app-level key sent as `X-Api-Key` on every request, gating the
 * backend to legitimate extension builds. Must match the server's
 * APP_API_KEY. Swap this alongside API_BASE_URL for production.
 */
export const API_KEY = '6dc0d74f58b4e2d0181547749fd2f115378623b187ca7067';
