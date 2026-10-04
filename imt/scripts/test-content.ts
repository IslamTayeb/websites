import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { externalWriting } from '../data/external-writing';
import { absoluteSiteUrl, siteMetadata } from '../data/site-metadata';
import { buildAtomFeed, buildRssFeed } from '../lib/blog/feed';
import {
  contentRoot,
  getAllPosts,
  getListedPosts,
  postHref,
} from '../lib/blog/posts';
import { escapeRegExp } from '../lib/blog/html';
import {
  buildBlogPostingJsonLd,
  buildPersonJsonLd,
  buildPostMetadata,
} from '../lib/seo';

function assertDescendingDates(
  posts: Awaited<ReturnType<typeof getListedPosts>>
) {
  for (let index = 1; index < posts.length; index += 1) {
    const previous = new Date(posts[index - 1].manifest.publishedAt).getTime();
    const current = new Date(posts[index].manifest.publishedAt).getTime();

    assert.ok(
      previous >= current,
      `${posts[index - 1].manifest.slug} should not sort before ${posts[index].manifest.slug}`
    );
  }
}

function assertRenderedExternalLinks(postSlug: string, html: string) {
  const externalAnchors = Array.from(
    html.matchAll(/<a\b(?=[^>]*href="https?:\/\/)([^>]*)>/g)
  );

  for (const [, attrs] of externalAnchors) {
    assert.match(
      attrs,
      /target="_blank"/,
      `${postSlug} external link is missing target="_blank"`
    );
    assert.match(
      attrs,
      /rel="[^"]*\bexternal\b[^"]*"/,
      `${postSlug} external link is missing rel external`
    );
    assert.match(
      attrs,
      /class="[^"]*\bexternal-link\b[^"]*"/,
      `${postSlug} external link is missing external-link class`
    );
    for (const className of [
      'royb-link',
      'royb-link-highlight',
      'section-color-b',
    ]) {
      assert.match(
        attrs,
        new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`),
        `${postSlug} external link is missing ${className} class`
      );
    }
  }
}

function assertImagesHaveAlt(postSlug: string, html: string) {
  const images = Array.from(html.matchAll(/<img\b([^>]*)>/g));

  for (const [, attrs] of images) {
    assert.match(
      attrs,
      /\balt="[^"]+"/,
      `${postSlug} rendered image is missing alt text`
    );
  }
}

function countMatches(value: string, pattern: RegExp) {
  return Array.from(value.matchAll(pattern)).length;
}

function assertNoBareSiteUrl(value: string, label: string) {
  assert.doesNotMatch(
    value,
    /https:\/\/islamtayeb\.dev(?:\/|$)/,
    `${label} should use the www canonical domain`
  );
}

const legacyPlaceholderIconHashes = new Map([
  [
    'apple-icon.png',
    'da678942d4656a903f61000551cc51c09464d7a223faaae304e8210e1ca19257',
  ],
  [
    'icon-light-32x32.png',
    '83145e5bb033ace23cd8e7fbb63e7c39733aaf58f8a7280d7800995cced6f7c2',
  ],
  [
    'icon-dark-32x32.png',
    '8a1570b2955c3748b6844356a7487d88c60f9f1e699e870a3452a3decd1ba03c',
  ],
]);

type PngAlphaBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const faviconPngBounds = new Map<
  string,
  { width: number; height: number; bounds: PngAlphaBounds }
>([
  [
    'apple-icon.png',
    {
      width: 180,
      height: 180,
      bounds: { minX: 30, minY: 24, maxX: 150, maxY: 156 },
    },
  ],
  [
    'icon-light-32x32.png',
    {
      width: 32,
      height: 32,
      bounds: { minX: 5, minY: 4, maxX: 26, maxY: 28 },
    },
  ],
  [
    'icon-dark-32x32.png',
    {
      width: 32,
      height: 32,
      bounds: { minX: 5, minY: 4, maxX: 26, maxY: 28 },
    },
  ],
]);

function paethPredictor(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  if (upDistance <= upLeftDistance) {
    return up;
  }

  return upLeft;
}

function getPngAlphaBounds(png: Buffer) {
  assert.equal(
    png.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    'favicon PNG should have a valid PNG signature'
  );

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < png.length) {
    const chunkLength = png.readUInt32BE(offset);
    const chunkType = png.toString('ascii', offset + 4, offset + 8);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkLength;
    const chunkData = png.subarray(chunkDataStart, chunkDataEnd);

    if (chunkType === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
    } else if (chunkType === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }

    offset = chunkDataEnd + 4;
  }

  assert.equal(bitDepth, 8, 'favicon PNGs should use 8-bit channels');
  assert.ok(
    colorType === 4 || colorType === 6,
    `favicon PNGs should include alpha channels, received color type ${colorType}`
  );

  const channels = colorType === 4 ? 2 : 4;
  const alphaChannel = colorType === 4 ? 1 : 3;
  const rowLength = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  let sourceOffset = 0;
  let previousRow = new Uint8Array(rowLength);
  const bounds: PngAlphaBounds = {
    minX: width,
    minY: height,
    maxX: -1,
    maxY: -1,
  };

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[sourceOffset];
    sourceOffset += 1;
    const sourceRow = inflated.subarray(sourceOffset, sourceOffset + rowLength);
    sourceOffset += rowLength;
    const row = new Uint8Array(rowLength);

    for (let index = 0; index < rowLength; index += 1) {
      const raw = sourceRow[index];
      const left = index >= channels ? row[index - channels] : 0;
      const up = previousRow[index] ?? 0;
      const upLeft = index >= channels ? previousRow[index - channels] : 0;

      if (filterType === 0) {
        row[index] = raw;
      } else if (filterType === 1) {
        row[index] = (raw + left) & 0xff;
      } else if (filterType === 2) {
        row[index] = (raw + up) & 0xff;
      } else if (filterType === 3) {
        row[index] = (raw + Math.floor((left + up) / 2)) & 0xff;
      } else if (filterType === 4) {
        row[index] = (raw + paethPredictor(left, up, upLeft)) & 0xff;
      } else {
        throw new Error(`Unsupported PNG filter type ${filterType}`);
      }
    }

    for (let x = 0; x < width; x += 1) {
      const alpha = row[x * channels + alphaChannel];

      if (alpha > 0) {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.maxY = Math.max(bounds.maxY, y);
      }
    }

    previousRow = row;
  }

  assert.ok(bounds.maxX >= 0, 'favicon PNG should contain visible pixels');

  return { width, height, bounds };
}

function assertCenteredPngGlyph(asset: string, assetBytes: Buffer) {
  const expected = faviconPngBounds.get(asset);

  if (!expected) {
    return;
  }

  const actual = getPngAlphaBounds(assetBytes);
  assert.equal(actual.width, expected.width, `${asset} width should be stable`);
  assert.equal(
    actual.height,
    expected.height,
    `${asset} height should be stable`
  );
  assert.deepEqual(
    actual.bounds,
    expected.bounds,
    `${asset} alpha bounds should keep the moon glyph centered`
  );

  const centerX = (actual.bounds.minX + actual.bounds.maxX + 1) / 2;
  const centerY = (actual.bounds.minY + actual.bounds.maxY + 1) / 2;
  const canvasCenterX = actual.width / 2;
  const canvasCenterY = actual.height / 2;

  assert.ok(
    Math.abs(centerX - canvasCenterX) <= 0.5,
    `${asset} glyph should be horizontally centered`
  );
  assert.ok(
    Math.abs(centerY - canvasCenterY) <= 0.5,
    `${asset} glyph should be vertically centered`
  );
}

async function assertFaviconAssets() {
  const publicRoot = path.join(process.cwd(), 'public');
  const faviconAssets = [
    'apple-icon.png',
    'icon-light-32x32.png',
    'icon-dark-32x32.png',
    'favicon.ico',
  ];

  for (const asset of faviconAssets) {
    const assetBytes = await readFile(path.join(publicRoot, asset));
    const legacyHash = legacyPlaceholderIconHashes.get(asset);

    if (legacyHash) {
      assert.notEqual(
        createHash('sha256').update(assetBytes).digest('hex'),
        legacyHash,
        `${asset} should use the moon glyph, not the old placeholder mark`
      );
    }

    assertCenteredPngGlyph(asset, assetBytes);
  }

  const iconSvg = await readFile(path.join(publicRoot, 'icon.svg'), 'utf8');
  assert.match(iconSvg, /<circle cx="130\.57" cy="75\.97" r="54\.96"/);
  assert.match(
    iconSvg,
    /<circle class="moon" cx="95\.5" cy="90" r="65\.5" mask="url\(#moon-cutout\)"/,
    'favicon SVG should keep the centered moon geometry'
  );

  const layoutSource = await readFile(
    path.join(process.cwd(), 'app', 'layout.tsx'),
    'utf8'
  );

  for (const iconPath of [
    '/icon.svg',
    '/apple-icon.png',
    '/icon-light-32x32.png',
    '/icon-dark-32x32.png',
    '/favicon.ico',
  ]) {
    assert.match(
      layoutSource,
      new RegExp(iconPath.replaceAll('.', '\\.')),
      `site metadata should advertise ${iconPath}`
    );
  }
}

function assertArticlePrimitiveNormalization(postSlug: string, html: string) {
  assert.doesNotMatch(
    html,
    /<div class="table-pair">/,
    `${postSlug} should normalize legacy table-pair wrappers`
  );
  assert.doesNotMatch(
    html,
    /<div class="highlight">\s*<pre>/,
    `${postSlug} should normalize legacy highlight code blocks`
  );
  assert.doesNotMatch(
    html,
    /<p>\s*<img\b/,
    `${postSlug} should wrap images in article media figures`
  );
  assert.doesNotMatch(
    html,
    /<hr>\s*<section class="footnotes">/,
    `${postSlug} should use the dashed footnotes separator`
  );

  const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g)).map(([, id]) => id);

  assert.equal(
    new Set(ids).size,
    ids.length,
    `${postSlug} should not render duplicate HTML ids`
  );
}

async function assertLocalSocialImageExists(
  postSlug: string,
  socialImage: string
) {
  assert.match(
    socialImage,
    /^\//,
    `${postSlug} socialImage should use a root-relative public path`
  );

  const assetPath = path.join(process.cwd(), 'public', socialImage.slice(1));

  await assert.doesNotReject(
    access(assetPath),
    `${postSlug} socialImage points to a missing public asset: ${socialImage}`
  );
}

async function assertSeoInfrastructure(
  posts: Awaited<ReturnType<typeof getAllPosts>>,
  listedPosts: Awaited<ReturnType<typeof getListedPosts>>
) {
  const robotsConfig = robots();
  const sitemapEntries = await sitemap();
  const sitemapUrls = sitemapEntries.map((entry) => entry.url);
  const listedPostUrls = listedPosts.map((post) =>
    absoluteSiteUrl(postHref(post))
  );
  const unlistedPosts = posts.filter((post) => !post.manifest.listed);

  assert.equal(siteMetadata.url, 'https://imt.sh');
  assert.deepEqual(robotsConfig.rules, {
    userAgent: '*',
    allow: '/',
  });
  assert.equal(robotsConfig.sitemap, absoluteSiteUrl('/sitemap.xml'));
  assert.deepEqual(sitemapUrls, [
    absoluteSiteUrl('/'),
    absoluteSiteUrl('/blog'),
    ...listedPostUrls,
  ]);

  for (const post of posts) {
    const metadata = buildPostMetadata(post);
    const canonicalUrl = absoluteSiteUrl(postHref(post));
    const openGraph = metadata.openGraph as { url?: string } | undefined;

    assert.equal(
      metadata.alternates?.canonical,
      canonicalUrl,
      `${post.manifest.slug} should expose a canonical URL`
    );
    assert.equal(
      openGraph?.url,
      canonicalUrl,
      `${post.manifest.slug} should expose og:url`
    );

    if (post.manifest.listed) {
      assert.equal(
        metadata.robots,
        undefined,
        `${post.manifest.slug} should be indexable`
      );
      assert.ok(
        sitemapUrls.includes(canonicalUrl),
        `${post.manifest.slug} should appear in the sitemap`
      );
    } else {
      assert.deepEqual(
        metadata.robots,
        { index: false, follow: false },
        `${post.manifest.slug} should be marked noindex/nofollow`
      );
      assert.ok(
        !sitemapUrls.includes(canonicalUrl),
        `${post.manifest.slug} should be excluded from the sitemap`
      );
    }
  }

  const personJsonLd = buildPersonJsonLd();

  assert.equal(personJsonLd['@type'], 'Person');
  assert.equal(personJsonLd.url, siteMetadata.url);
  assert.ok(
    personJsonLd.sameAs.every((href) => href.startsWith('https://')),
    'Person JSON-LD should only include HTTPS sameAs links'
  );

  for (const post of listedPosts) {
    const blogPostingJsonLd = buildBlogPostingJsonLd(post);

    assert.equal(blogPostingJsonLd['@type'], 'BlogPosting');
    assert.equal(blogPostingJsonLd.url, absoluteSiteUrl(postHref(post)));
    assert.equal(blogPostingJsonLd.headline, post.manifest.title);
  }

  const atomFeed = await buildAtomFeed();
  const rssFeed = await buildRssFeed();

  for (const feed of [atomFeed, rssFeed]) {
    assertNoBareSiteUrl(feed, 'feed output');

    for (const post of unlistedPosts) {
      assert.doesNotMatch(
        feed,
        new RegExp(escapeRegExp(postHref(post))),
        `${post.manifest.slug} should be excluded from feeds`
      );
    }
  }
}

async function main() {
  const manifestFiles = (await readdir(contentRoot)).filter((file) =>
    file.endsWith('.json')
  );
  const posts = await getAllPosts();
  const listedPosts = await getListedPosts();

  assert.equal(
    posts.length,
    manifestFiles.length,
    'every APM Overflow manifest should load'
  );
  assert.ok(listedPosts.length > 0, 'at least one listed post should load');
  assert.deepEqual(
    listedPosts
      .filter((post) => post.manifest.kind === 'technical')
      .map((post) => post.manifest.slug),
    ['on-agent-memory-fidelity', 'on-dimensions-of-taste'],
    'only Decant and Harmonia should carry the technical tag'
  );
  assertDescendingDates(listedPosts);
  await assertSeoInfrastructure(posts, listedPosts);
  await assertFaviconAssets();
  assert.deepEqual(externalWriting, [
    {
      title: 'Finding the Right Answer Was Never the Point',
      href: 'https://www.dukechronicle.com/article/daf941cd-e431-4e71-a282-5f7da9a56c28',
      meta: '894 words (4 mins)',
      date: 'Nov 2024',
    },
  ]);

  for (const post of posts) {
    assert.ok(post.manifest.title, `${post.manifest.slug} needs a title`);
    assert.ok(
      post.html.includes('<p') || post.html.includes('<h'),
      `${post.manifest.slug} should render article content`
    );
    assert.match(
      post.readingMeta,
      /^\d+(?:\.\d+)?K? words \(\d+ mins\)$/,
      `${post.manifest.slug} should use canonical reading metadata`
    );
    assert.doesNotMatch(
      post.readingMeta,
      /~/,
      `${post.manifest.slug} reading metadata should not use approximation markers`
    );
    assert.doesNotMatch(
      post.readingMeta,
      /\b\d+(?:\.\d+)?k\b/,
      `${post.manifest.slug} reading metadata should use uppercase K`
    );
    assert.equal(
      postHref(post),
      `/blog/${post.manifest.slug}`,
      `${post.manifest.slug} should generate the expected route`
    );
    if (post.manifest.socialImage) {
      await assertLocalSocialImageExists(
        post.manifest.slug,
        post.manifest.socialImage
      );
    }

    const sourcePath = path.join(contentRoot, post.manifest.source);
    assert.ok(
      sourcePath.endsWith('.md'),
      `${post.manifest.slug} source should be markdown`
    );
    assertImagesHaveAlt(post.manifest.slug, post.html);
    assertRenderedExternalLinks(post.manifest.slug, post.html);
    assertArticlePrimitiveNormalization(post.manifest.slug, post.html);
    assert.doesNotMatch(
      post.html,
      /\b\d+(?:\.\d+)?k\b/,
      `${post.manifest.slug} should render thousands abbreviations with uppercase K`
    );

    if (post.manifest.slug === 'on-agent-memory-fidelity') {
      assert.match(post.html, /class="article-toc"/);
      assert.match(post.html, /<span>Time<\/span>/);
      assert.doesNotMatch(post.html, /Reading time/);
      assert.match(post.html, /Last updated/);
      assert.match(post.html, /GitHub/);
      assert.doesNotMatch(post.html, /<span>time<\/span>/);
      assert.doesNotMatch(post.html, /<span>code<\/span>/);
      assert.match(post.html, /class="toc-subs"/);
      assert.match(
        post.html,
        /RGB-agent\.<sup class="footnote-ref">/,
        'sentence-end footnote refs should move after punctuation'
      );
      assert.match(
        post.html,
        /<code>fidelity<\/code><sup class="footnote-ref">[\s\S]*?<\/sup> settings/,
        'mid-sentence footnote refs should stay attached to the word'
      );
      assert.match(
        post.html,
        /<ol>\s*<li><code>Topic<\/code>:/,
        'control layer markdown should render as a real ordered list'
      );
      assert.match(post.html, /class="article-media"/);
      assert.match(post.html, /<figcaption><em>/);
      assert.doesNotMatch(post.html, /data-prototype=/);
      assert.doesNotMatch(post.html, /prototype-card/);
      assert.doesNotMatch(post.html, />prototyping<\/span>/);
      assert.doesNotMatch(post.html, /prototype-row/);
      assert.doesNotMatch(post.html, /prototype-tag/);
      assert.match(post.html, /<figure class="article-table/);
      assert.match(post.html, /<div class="table-wrap">/);
      assert.match(post.html, /<table>/);
      assert.doesNotMatch(
        post.html,
        /<figure class="article-table[\s\S]*?<figcaption>/,
        'past blog tables should not get synthetic captions'
      );
      assert.match(
        post.html,
        /class="article-code-block article-code-block-blue highlight" data-code-theme="blue"/,
        'code blocks should render through the default blue code-block primitive'
      );
      assert.match(post.html, /class="hljs-keyword"/);
      assert.match(
        post.html,
        /<video autoplay controls loop muted playsinline preload="auto"/
      );
    }

    if (post.manifest.slug === 'on-dimensions-of-taste') {
      assert.doesNotMatch(
        post.html,
        /<p><em>HDBSCAN<\/em> assumes/,
        'Harmonia should avoid starting consecutive paragraphs with HDBSCAN'
      );
      assert.match(
        post.html,
        /<p>It assumes clusters are/,
        'Harmonia HDBSCAN follow-up paragraph should start with a pronoun'
      );
      assert.match(
        post.html,
        /<ul>\s*<li>\s*<p><strong><code class="mellow-hopecore">Mellow-Hopecore<\/code>/,
        'Harmonia mellow subclusters should render as bullet points'
      );
      assert.equal(
        countMatches(post.html, /class="article-media iframe-figure"/g),
        13,
        'Harmonia should render each iframe as a separate media figure'
      );
      assert.equal(
        countMatches(post.html, /class="article-media iframe-figure"/g),
        countMatches(post.html, /<iframe\b/g),
        'Harmonia should not leave bare iframe elements outside article media figures'
      );
      assert.equal(
        countMatches(post.html, /class="article-table-pair"/g),
        2,
        'Harmonia table pairs should normalize to shared article table pairs'
      );
      assert.match(
        post.html,
        /<figure class="article-media iframe-figure"><iframe (?=[^>]*data-harmonia-src="https:\/\/islamtayeb\.github\.io\/harmonia\/export\/visualizations\/genre\/genre_family_pie\/index\.html")(?=[^>]*data-harmonia-iframe="true")(?=[^>]*allowtransparency="true")[^>]*><\/iframe><\/figure>/,
        'bare Harmonia iframes should become figure-wrapped media'
      );
      assert.match(
        post.html,
        /<figure class="article-media iframe-figure"><iframe (?=[^>]*width="100%")(?=[^>]*height="600px")(?=[^>]*data-harmonia-src="https:\/\/islamtayeb\.github\.io\/harmonia\/export\/visualizations\/temporal\/genre_trends_proportion\/index\.html")(?=[^>]*data-harmonia-iframe="true")(?=[^>]*allowtransparency="true")[^>]*><\/iframe><figcaption><em>Genre trends by quarter<\/em><\/figcaption><\/figure>/,
        'captioned Harmonia iframes should keep their own captioned figures'
      );
      assert.match(
        post.html,
        /class="article-code-block article-code-block-blue highlight"/,
        'Harmonia code blocks should use the shared code block primitive'
      );
    }

    if (post.manifest.slug === 'on-using-computers') {
      assert.match(
        post.html,
        /<figure class="article-media article-media-unframed"><img src="\/static\/media\/pasted-image-20251003215923\.webp"/,
        'Using Computers spaces screenshot should render without image frame padding'
      );
      assert.equal(
        countMatches(post.html, /class="article-details"/g),
        13,
        'Using Computers tool notes should normalize to article details'
      );
      assert.match(
        post.html,
        /<hr class="footnotes-sep"><section class="footnotes">/,
        'Using Computers should use dashed footnote separator'
      );
    }

    if (post.manifest.slug === 'on-fingerspitzengefuhl') {
      assert.match(
        post.html,
        /<figure class="article-media article-media-unframed"><img src="https:\/\/raw\.githubusercontent\.com\/islamtayeb\/obsidian-files\/main\/On%20Fingerspitzengef%C3%BChl-22\.png"/,
        'Fingerspitzengefuhl lead image should render without image frame padding'
      );
      assert.match(
        post.html,
        /<figure class="article-media article-media-light-transparent"><img src="\/static\/media\/fingerspitzen-optimization-transparent\.png"/,
        'Fingerspitzengefuhl optimization landscape should be transparent on light mode'
      );
      assert.match(
        post.html,
        /<figure class="article-media article-media-light-transparent"><img src="\/static\/media\/fingerspitzen-language-transparent\.png"/,
        'Fingerspitzengefuhl high-dimensional understanding graphic should be transparent on light mode'
      );
    }
  }

  const feed = await buildAtomFeed();
  assert.match(feed, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(feed, /<entry>/);
  assert.match(
    feed,
    new RegExp(`<title>${escapeRegExp(listedPosts[0].manifest.title)}</title>`)
  );
  assert.doesNotMatch(feed, /Finding the Right Answer Was Never the Point/);
  assert.doesNotMatch(feed, /dukechronicle\.com/);

  console.log(
    `content ok: ${posts.length} posts loaded, ${listedPosts.length} listed, feed generated`
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
