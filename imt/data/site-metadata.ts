import siteUrlConfig from './site-url.json';

const canonicalSiteUrl = siteUrlConfig.url;

export function absoluteSiteUrl(pathOrUrl = '/') {
  return new URL(pathOrUrl, canonicalSiteUrl).toString();
}

export const siteMetadata = {
  url: canonicalSiteUrl,
  title: 'Islam Tayeb',
  socialImage: {
    url: absoluteSiteUrl('/static/og-moon.png'),
    width: 1200,
    height: 1200,
    alt: 'Crescent moon mark for Islam Tayeb',
  },
} as const;
