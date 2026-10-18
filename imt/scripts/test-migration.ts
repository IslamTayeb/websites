import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { profile } from '../data/profile';
import { siteMetadata } from '../data/site-metadata';
import {
  apmShellConfigPath,
  appConfigPath,
  renderApmShellConfig,
  renderAppConfig,
} from '../lib/apm-redirects.mjs';
import { buildAtomFeed, buildRssFeed } from '../lib/blog/feed';
import { listFiles } from './source-files.mjs';
import { getAllPosts } from '../lib/blog/posts';

const siteUrl = siteMetadata.url;
const oldHosts = ['apmoverflow.xyz', 'www.apmoverflow.xyz'];

type HostCondition = {
  type: string;
  value?: unknown;
};

type RedirectRule = {
  source: string;
  destination: string;
  permanent?: boolean;
  has?: HostCondition[];
};

type VercelConfig = {
  redirects?: RedirectRule[];
};

function hasHostCondition(rule: RedirectRule, hosts: readonly string[]) {
  return (
    rule.has?.some(
      (condition) =>
        condition.type === 'host' &&
        typeof condition.value === 'string' &&
        hosts.includes(condition.value)
    ) === true
  );
}

function assertRedirectRule(
  redirects: RedirectRule[],
  source: string,
  destination: string,
  matches: (rule: RedirectRule) => boolean,
  label: string
) {
  assert.ok(
    redirects.some(
      (rule) =>
        rule.source === source &&
        rule.destination === destination &&
        rule.permanent === true &&
        matches(rule)
    ),
    `missing ${label}: ${source} -> ${destination}`
  );
}

function assertAppRedirect(
  redirects: RedirectRule[],
  source: string,
  destination: string
) {
  for (const host of oldHosts) {
    assertRedirectRule(
      redirects,
      source,
      destination,
      (rule) => hasHostCondition(rule, [host]),
      `apmoverflow redirect for ${host}`
    );
  }
}

function assertShellRedirect(
  redirects: RedirectRule[],
  source: string,
  destination: string
) {
  assertRedirectRule(
    redirects,
    source,
    destination,
    (rule) => !rule.has,
    'apmoverflow shell redirect'
  );
}

async function readRedirects() {
  const config = JSON.parse(
    await readFile(appConfigPath, 'utf8')
  ) as VercelConfig;

  assert.ok(
    Array.isArray(config.redirects),
    'imt/vercel.json should define redirects'
  );

  return config.redirects;
}

async function readApmShellRedirects() {
  const config = JSON.parse(
    await readFile(apmShellConfigPath, 'utf8')
  ) as VercelConfig;

  assert.ok(
    Array.isArray(config.redirects),
    'apmoverflow/vercel.json should define redirects'
  );

  return config.redirects;
}

async function assertRedirectConfigsAreGenerated() {
  const shellText = await readFile(apmShellConfigPath, 'utf8');
  const appText = await readFile(appConfigPath, 'utf8');

  assert.equal(
    shellText,
    renderApmShellConfig(shellText),
    'apmoverflow/vercel.json is stale; run npm run generate:redirects in imt/'
  );
  assert.equal(
    appText,
    renderAppConfig(appText, oldHosts),
    'imt/vercel.json is stale; run npm run generate:redirects in imt/'
  );
}

async function assertNoOldTrackingPayload() {
  const roots = ['src', 'components', 'content', 'data', 'lib', 'styles'];
  const sourceFiles = (
    await Promise.all(roots.map((root) => listFiles(path.resolve(root))))
  )
    .flat()
    .filter((file) => /\.(css|mjs|ts|tsx)$/.test(file));
  const bannedPatterns = [
    /ip-api\.com/,
    /VisitorTracker/,
    /visitor_fingerprint/,
    /ip_address/,
    /getGeolocation/,
    /GeolocationData/,
    /apmoverflow\.xyz/,
    /islamtayeb\.dev/,
  ];

  for (const file of sourceFiles) {
    const content = await readFile(file, 'utf8');

    for (const pattern of bannedPatterns) {
      assert.doesNotMatch(
        content,
        pattern,
        `${path.relative(process.cwd(), file)} contains legacy tracking/domain payload: ${pattern}`
      );
    }
  }
}

async function assertFeedsAreCanonical() {
  const atomFeed = await buildAtomFeed();
  const rssFeed = await buildRssFeed();

  assert.match(atomFeed, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(rssFeed, /<rss version="2\.0"/);

  for (const feed of [atomFeed, rssFeed]) {
    assert.match(feed, new RegExp(`${siteUrl}/blog`));
    assert.doesNotMatch(feed, /islamtayeb\.dev/);
    assert.doesNotMatch(feed, /apmoverflow\.xyz/);
    assert.doesNotMatch(feed, /<link>\/blog/);
    assert.doesNotMatch(feed, /href="\/blog/);
  }
}

// Retired "On X" slugs: links shared before the rename must keep landing.
const expectedRenames: [string, string][] = [
  ['on-agent-memory-fidelity', 'agent-memory-fidelity'],
  ['on-dimensions-of-taste', 'clustering-my-spotify-library'],
  ['on-fingerspitzengefuhl', 'osu-and-fingerspitzengefuhl'],
  ['on-using-computers', 'ricing-macos-for-fun'],
];

function assertRenamedPostRedirects(
  redirects: RedirectRule[],
  shellRedirects: RedirectRule[],
  posts: Awaited<ReturnType<typeof getAllPosts>>
) {
  const renames = posts.flatMap((post) =>
    post.manifest.previousSlugs.map((previousSlug): [string, string] => [
      previousSlug,
      post.manifest.slug,
    ])
  );
  const liveSlugs = new Set(posts.map((post) => post.manifest.slug));

  for (const expected of expectedRenames) {
    assert.ok(
      renames.some(
        ([previousSlug, slug]) =>
          previousSlug === expected[0] && slug === expected[1]
      ),
      `missing retired slug: ${expected[0]} -> ${expected[1]}`
    );
  }

  const passthroughIndex = shellRedirects.findIndex(
    (rule) => rule.source === '/blog/:path*'
  );

  for (const [previousSlug, slug] of renames) {
    const destination = `${siteUrl}/blog/${slug}`;

    assert.ok(
      !liveSlugs.has(previousSlug),
      `retired slug ${previousSlug} must not belong to a live post`
    );
    assertRedirectRule(
      redirects,
      `/blog/${previousSlug}`,
      `/blog/${slug}`,
      (rule) => !rule.has,
      'main-site retired slug redirect'
    );

    for (const source of [
      `/${previousSlug}`,
      `/${previousSlug}/`,
      `/blog/${previousSlug}`,
      `/blog/${previousSlug}/`,
    ]) {
      assertAppRedirect(redirects, source, destination);
      assertShellRedirect(shellRedirects, source, destination);
    }

    for (const source of [`/blog/${previousSlug}`, `/blog/${previousSlug}/`]) {
      const index = shellRedirects.findIndex((rule) => rule.source === source);

      assert.ok(
        index < passthroughIndex,
        `${source} must precede /blog/:path* in the shell so it lands in one hop`
      );
    }
  }

  return renames.length;
}

async function assertRenamedFeedIdsAreStable() {
  const atomFeed = await buildAtomFeed();
  const rssFeed = await buildRssFeed();

  for (const [previousSlug, slug] of expectedRenames) {
    const oldUrl = `${siteUrl}/blog/${previousSlug}`;
    const newUrl = `${siteUrl}/blog/${slug}`;

    assert.ok(
      atomFeed.includes(`<id>${oldUrl}</id>`),
      `Atom entry id for ${slug} should stay ${oldUrl}`
    );
    assert.ok(
      atomFeed.includes(`<link href="${newUrl}" rel="alternate" />`),
      `Atom entry link for ${slug} should point at ${newUrl}`
    );
    assert.ok(
      rssFeed.includes(`<guid isPermaLink="true">${oldUrl}</guid>`),
      `RSS guid for ${slug} should stay ${oldUrl}`
    );
    assert.ok(
      rssFeed.includes(`<link>${newUrl}</link>`),
      `RSS link for ${slug} should point at ${newUrl}`
    );
  }
}

function assertPublicProfileFieldsAreIntentional() {
  assert.equal(profile.email, 'islam.moh.islamm@gmail.com');
  assert.equal(profile.location, 'Durham, NC');
  assert.equal(profile.hometown, 'Egypt');
}

async function main() {
  const redirects = await readRedirects();
  const shellRedirects = await readApmShellRedirects();
  const posts = await getAllPosts();
  const staticRedirects: [string, string][] = [
    ['/', `${siteUrl}/blog`],
    ['/blog', `${siteUrl}/blog`],
    ['/blog/', `${siteUrl}/blog`],
    ['/blog/:path*', `${siteUrl}/blog/:path*`],
    ['/feed', `${siteUrl}/blog/feed.xml`],
    ['/feed/', `${siteUrl}/blog/feed.xml`],
    ['/feed/index.xml', `${siteUrl}/blog/feed.xml`],
    ['/feed/rss.xml', `${siteUrl}/blog/rss.xml`],
    ['/static/:path*', `${siteUrl}/static/:path*`],
  ];

  assert.ok(redirects.length > 0, 'imt/vercel.json should define redirects');
  await assertRedirectConfigsAreGenerated();

  for (const [source, destination] of staticRedirects) {
    assertAppRedirect(redirects, source, destination);
    assertShellRedirect(shellRedirects, source, destination);
  }

  for (const post of posts) {
    const destination = `${siteUrl}/blog/${post.manifest.slug}`;

    assertAppRedirect(redirects, `/${post.manifest.slug}`, destination);
    assertAppRedirect(redirects, `/${post.manifest.slug}/`, destination);
    assertShellRedirect(shellRedirects, `/${post.manifest.slug}`, destination);
    assertShellRedirect(shellRedirects, `/${post.manifest.slug}/`, destination);
  }

  const renameCount = assertRenamedPostRedirects(
    redirects,
    shellRedirects,
    posts
  );

  for (const rule of redirects.filter((rule) =>
    hasHostCondition(rule, oldHosts)
  )) {
    assert.notEqual(rule.source, '/:path*', 'avoid broad old-host catch-all');
    assert.notEqual(rule.source, '/(.*)', 'avoid broad old-host catch-all');
  }

  assertPublicProfileFieldsAreIntentional();
  await assertNoOldTrackingPayload();
  await assertFeedsAreCanonical();
  await assertRenamedFeedIdsAreStable();

  console.log(
    `migration ok: ${posts.length} old APM slugs and ${renameCount} retired slugs redirect in app and shell, both redirect configs generated, feeds canonical with stable ids, old tracking payload absent`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
