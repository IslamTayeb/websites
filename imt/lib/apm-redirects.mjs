import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
/** @type {{ url: string }} */
const siteUrlConfig = require('../data/site-url.json');
const siteUrl = siteUrlConfig.url;
const libRoot = path.dirname(fileURLToPath(import.meta.url));
const postsRoot = path.join(libRoot, '..', 'posts');

/** Absolute path of the old-domain redirect shell's Vercel config. */
export const apmShellConfigPath = path.resolve(
  libRoot,
  '..',
  '..',
  'apmoverflow',
  'vercel.json'
);

/** Absolute path of the main site's Vercel config. */
export const appConfigPath = path.resolve(libRoot, '..', 'vercel.json');

/**
 * Current slug plus any retired slugs for every post, read from the content
 * manifests and sorted by current slug.
 *
 * @returns {{ slug: string, previousSlugs: string[] }[]}
 */
export function postSlugRecords() {
  const records = readdirSync(postsRoot)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const raw = readFileSync(path.join(postsRoot, file), 'utf8');
      const manifest = JSON.parse(raw);

      if (typeof manifest.slug !== 'string') {
        throw new Error(`${file} is missing a string slug`);
      }

      return {
        slug: manifest.slug,
        previousSlugs: Array.isArray(manifest.previousSlugs)
          ? manifest.previousSlugs.map(String)
          : [],
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const claimed = new Set();

  // A retired slug that collides with a live one would redirect a real page.
  for (const slug of records.flatMap((record) => [
    record.slug,
    ...record.previousSlugs,
  ])) {
    if (claimed.has(slug)) {
      throw new Error(`post slug is claimed more than once: ${slug}`);
    }

    claimed.add(slug);
  }

  return records;
}

/**
 * Retired `/blog/...` paths on the main site and their current pages.
 *
 * @returns {[string, string][]} `[source, destination]` pairs
 */
export function renamedPostRedirectPairs() {
  return postSlugRecords().flatMap(({ slug, previousSlugs }) =>
    previousSlugs.map((previousSlug) => [
      `/blog/${previousSlug}`,
      `/blog/${slug}`,
    ])
  );
}

/**
 * Old blog paths and their canonical destinations, in the order they are
 * emitted by both the app and the redirect shell. Retired `/blog/...` slugs
 * come before the `/blog/:path*` passthrough so they land in one hop.
 *
 * @returns {[string, string][]} `[source, destination]` pairs
 */
export function apmRedirectPairs() {
  const records = postSlugRecords();
  /** @type {[string, string][]} */
  const renamedBlogPairs = records.flatMap(({ slug, previousSlugs }) =>
    previousSlugs.flatMap((previousSlug) => [
      [`/blog/${previousSlug}`, `${siteUrl}/blog/${slug}`],
      [`/blog/${previousSlug}/`, `${siteUrl}/blog/${slug}`],
    ])
  );
  /** @type {[string, string][]} */
  const staticPairs = [
    ['/', `${siteUrl}/blog`],
    ['/blog', `${siteUrl}/blog`],
    ['/blog/', `${siteUrl}/blog`],
    ...renamedBlogPairs,
    ['/blog/:path*', `${siteUrl}/blog/:path*`],
    ['/feed', `${siteUrl}/blog/feed.xml`],
    ['/feed/', `${siteUrl}/blog/feed.xml`],
    ['/feed/index.xml', `${siteUrl}/blog/feed.xml`],
    ['/feed/rss.xml', `${siteUrl}/blog/rss.xml`],
    ['/static/:path*', `${siteUrl}/static/:path*`],
  ];
  /** @type {[string, string][]} */
  const postPairs = records.flatMap(({ slug, previousSlugs }) =>
    [slug, ...previousSlugs].flatMap((source) => [
      [`/${source}`, `${siteUrl}/blog/${slug}`],
      [`/${source}/`, `${siteUrl}/blog/${slug}`],
    ])
  );

  return [...staticPairs, ...postPairs];
}

/**
 * Re-renders the shell config with a freshly generated `redirects` list,
 * keeping every other field of the existing file in place.
 *
 * @param {string} existingText current contents of the shell config
 * @returns {string} the config text to write back
 */
export function renderApmShellConfig(existingText) {
  const { redirects: _ignored, ...rest } = JSON.parse(existingText);

  return (
    JSON.stringify(
      {
        ...rest,
        redirects: apmRedirectPairs().map(([source, destination]) => ({
          source,
          destination,
          permanent: true,
        })),
      },
      null,
      2
    ) + '\n'
  );
}

/**
 * Redirects for the main site: retired post slugs, plus every old APM path
 * conditioned on the old hosts, ready in case those domains move here.
 *
 * @param {string[]} oldHosts the old APM hostnames
 * @returns {{ source: string, destination: string, permanent: true, has?: { type: 'host', value: string }[] }[]}
 */
export function appRedirects(oldHosts) {
  const apm = apmRedirectPairs().flatMap(([source, destination]) =>
    oldHosts.map((host) => ({
      source,
      has: [{ type: /** @type {const} */ ('host'), value: host }],
      destination,
      permanent: /** @type {const} */ (true),
    }))
  );
  const renamed = renamedPostRedirectPairs().map(([source, destination]) => ({
    source,
    destination,
    permanent: /** @type {const} */ (true),
  }));

  return [...apm, ...renamed];
}

/**
 * Re-renders the main site's Vercel config with fresh redirects, keeping
 * every other field in place.
 *
 * @param {string} existingText current contents of imt/vercel.json
 * @param {string[]} oldHosts the old APM hostnames
 * @returns {string} the config text to write back
 */
export function renderAppConfig(existingText, oldHosts) {
  const { redirects: _ignored, ...rest } = JSON.parse(existingText);

  return (
    JSON.stringify({ ...rest, redirects: appRedirects(oldHosts) }, null, 2) +
    '\n'
  );
}
