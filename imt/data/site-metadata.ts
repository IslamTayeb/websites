import { profile } from './profile';
import siteUrlConfig from './site-url.json';

const canonicalSiteUrl = siteUrlConfig.url;

export function absoluteSiteUrl(pathOrUrl = '/') {
  return new URL(pathOrUrl, canonicalSiteUrl).toString();
}

// Shown in the footer; bump it when the site changes.
export const lastUpdated = 'Oct 21, 2026';

export const siteMetadata = {
  url: canonicalSiteUrl,
  title: profile.name,
  description: `${profile.name} is a ${profile.role}.`,
  portraitUrl: absoluteSiteUrl('/me.webp'),
  socialImage: {
    url: absoluteSiteUrl('/static/og-moon.png'),
    width: 1200,
    height: 1200,
    alt: 'Crescent moon mark for Islam Tayeb',
  },
} as const;
