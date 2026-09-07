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

/** ApiTab's own marketing site — downloads, self-hosting guide, changelog. */
export const WEBSITE_URL = 'https://apitab.bitflw.com';

/**
 * The umbrella company ApiTab is built and maintained under. Blurb matches
 * the meta description on bitflw.com/about verbatim — keep them in sync.
 */
export const ORGANIZATION = {
  name: 'bitflw',
  blurb:
    'bitflw is built by engineers who use their own tools — API testing, email campaigns, e-commerce, and shared-inbox support, each shippable as SaaS or self-hosted.',
  url: 'https://bitflw.com',
};

export const ABOUT = {
  tagline: 'Lightweight, local-first API testing — a fast, minimal API client.',
  repoUrl: REPO_URL,
  website: WEBSITE_URL,
  organization: ORGANIZATION,

  developer: {
    name: 'Muhiminul Haque (Apon)',
    role: 'Creator & Lead Developer',
    email: 'apon2041@gmail.com',
    github: 'https://github.com/AponAhmed',
  } satisfies Person,

  contributors: [
    {
      name: 'AR-Shahin',
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
