export interface Person {
  name: string;
  role?: string;
  email?: string;
  github?: string;
  url?: string;
}

export interface AboutLink {
  label: string;
  url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit this file to update the developer / contributor / repository details
// shown in the About panel (top bar ⓘ) and the Options page.
// ─────────────────────────────────────────────────────────────────────────────

/** GitHub repository URL for this app (the desktop app itself). */
export const REPO_URL = 'https://github.com/AponAhmed/apitab-desktop';

/** The companion browser extension lives in a separate repo. */
export const SIBLING_REPO_URL = 'https://github.com/AponAhmed/apitab';

export const ABOUT = {
  tagline: 'Lightweight, local-first API testing — a fast, minimal API client.',
  repoUrl: REPO_URL,

  developer: {
    name: 'Muhiminul Haque (Apon)',
    role: 'Creator & Lead Developer',
    email: 'apon2041@gmail.com',
    github: 'https://github.com/AponAhmed',
  } satisfies Person,

  contributors: [
    {
      name: 'Anisur Rahman Shahin',
      role: 'Contributor',
      github: 'https://github.com/AR-Shahin',
    },
  ] satisfies Person[],

  links: [
    { label: 'Source code', url: REPO_URL },
    { label: 'Report an issue', url: `${REPO_URL}/issues` },
    { label: 'Browser extension repo', url: SIBLING_REPO_URL },
  ] satisfies AboutLink[],

  license: 'MIT',
};
