import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import { escapeHtml, escapeRegExp, stripTags } from './html';
import { filenameFromUrl, mediaBaseUrl, mediaUrl } from './media';
import { slugify } from './slug';
import { formatDate } from './date';
import { codeBlockHtml } from './code-block';
import type { PostManifest } from './manifest';

export type Heading = {
  id: string;
  level: number;
  text: string;
};

type MarkdownEnv = {
  headings: Heading[];
};

const articleLinkClasses = [
  'royb-link',
  'royb-link-highlight',
  'royb-link-fragment',
  'section-color-b',
];
const articleExternalLinkClasses = [...articleLinkClasses, 'external-link'];
const articleLinkClassName = articleLinkClasses.join(' ');
const articleExternalLinkClassName = articleExternalLinkClasses.join(' ');
const unframedArticleImageSrcs = new Map<string, Set<string>>([
  [
    'on-fingerspitzengefuhl',
    new Set([
      'https://raw.githubusercontent.com/islamtayeb/obsidian-files/main/On%20Fingerspitzengef%C3%BChl-22.png',
    ]),
  ],
  [
    'on-using-computers',
    new Set(['/static/media/pasted-image-20251003215923.webp']),
  ],
]);
const lightTransparentArticleImageSrcs = new Map<string, Set<string>>([
  [
    'on-fingerspitzengefuhl',
    new Set([
      '/static/media/fingerspitzen-optimization-transparent.png',
      '/static/media/fingerspitzen-language-transparent.png',
    ]),
  ],
]);

function mergeClasses(className: string, requiredClasses: string[]) {
  return Array.from(
    new Set(
      [...className.split(/\s+/), ...requiredClasses]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).join(' ');
}

function imageSrcFromHtml(imageHtml: string) {
  return imageHtml.match(/\ssrc=(["'])(.*?)\1/i)?.[2] ?? '';
}

function articleMediaFigureHtml({
  imageHtml,
  manifest,
  captionHtml,
}: {
  imageHtml: string;
  manifest: PostManifest;
  captionHtml?: string;
}) {
  const imageSrc = imageSrcFromHtml(imageHtml);
  const className = [
    'article-media',
    unframedArticleImageSrcs.get(manifest.slug)?.has(imageSrc)
      ? 'article-media-unframed'
      : '',
    lightTransparentArticleImageSrcs.get(manifest.slug)?.has(imageSrc)
      ? 'article-media-light-transparent'
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  const caption = captionHtml
    ? `<figcaption><em>${captionHtml}</em></figcaption>`
    : '';

  return `<figure class="${className}">${imageHtml}${caption}</figure>`;
}

function withoutFootnoteDefinitions(markdown: string) {
  const index = markdown.search(/^\[\^[^\]]+\]:/m);

  return index >= 0 ? markdown.slice(0, index) : markdown;
}

function readingMeta(markdown: string) {
  const body = withoutFootnoteDefinitions(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    // inline charts and embeds are markup, not words
    .replace(/<(svg|script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[\^[^\]]+\]/g, '')
    // a link's text is read, its URL is not
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`|:-]/g, ' ');
  const words = body
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
  // one shape for every length: 500 words reads as 0.5K, never 500
  const value = Math.max(0.1, Math.round(words / 100) / 10);
  const rounded = `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}K`;
  const minutes = Math.max(1, Math.round(words / 250));

  return `${rounded} words (${minutes} mins)`;
}

function normalizeFootnoteOrder(markdown: string) {
  const firstDefinitionIndex = markdown.search(/^\[\^[^\]]+\]:/m);
  const body =
    firstDefinitionIndex >= 0
      ? markdown.slice(0, firstDefinitionIndex)
      : markdown;
  const orderedIds: string[] = [];

  for (const match of body.matchAll(/\[\^([^\]]+)\]/g)) {
    if (!orderedIds.includes(match[1])) {
      orderedIds.push(match[1]);
    }
  }

  if (orderedIds.length === 0) {
    return markdown;
  }

  const remap = new Map(orderedIds.map((id, index) => [id, String(index + 1)]));

  return markdown.replace(/\[\^([^\]]+)\]/g, (match, id: string) => {
    return `[^${remap.get(id) ?? id}]`;
  });
}

function headingTextForId(markdown: string, id: string) {
  for (const match of markdown.matchAll(/^##\s+(.+)$/gm)) {
    if (slugify(match[1]) === id) {
      return match[1];
    }
  }

  throw new Error(`Could not find heading for media insert target: ${id}`);
}

function prepareMarkdown(markdown: string, manifest: PostManifest) {
  let prepared = normalizeFootnoteOrder(markdown);

  for (const image of manifest.images) {
    prepared = prepared.replaceAll(
      `${mediaBaseUrl}${image.filename}`,
      mediaUrl(image.filename)
    );
  }

  prepared = prepared
    .replace(/<div class="toc">[\s\S]*?\n(?=##\s+)/, '%%GENERATED_TOC%%\n\n')
    .replace(/^## Index[ \t]*$/m, '%%GENERATED_TOC%%');

  for (const insert of manifest.videoInserts) {
    const targetHeading = headingTextForId(prepared, insert.beforeHeadingId);

    prepared = prepared.replace(
      new RegExp(`\\n## ${escapeRegExp(targetHeading)}\\n`),
      `\n%%MEDIA:${insert.filename}%%\n\n## ${targetHeading}\n`
    );
  }

  return prepared;
}

function tocLabel(heading: Heading) {
  return heading.level === 2 && heading.text.includes(':')
    ? heading.text.split(':')[0]
    : heading.text;
}

function buildToc(
  headings: Heading[],
  manifest: PostManifest,
  sourceMarkdown: string
) {
  const sections = headings.filter((heading) => heading.level === 2);

  if (sections.length === 0) {
    return '';
  }

  const subsectionsByParent = new Map<string, Heading[]>();
  let currentParent: string | null = null;

  for (const heading of headings) {
    if (heading.level === 2) {
      currentParent = heading.id;
      subsectionsByParent.set(currentParent, []);
    } else if (heading.level === 3 && currentParent) {
      subsectionsByParent.get(currentParent)?.push(heading);
    }
  }

  const sectionHtml = sections
    .map((section, index) => {
      const sublinks = (subsectionsByParent.get(section.id) ?? [])
        .map(
          (subsection) =>
            `<a href="#${escapeHtml(
              subsection.id
            )}" class="toc-link ${articleLinkClassName}">${escapeHtml(
              tocLabel(subsection)
            )}</a>`
        )
        .join('');
      const subs = sublinks ? `<div class="toc-subs">${sublinks}</div>` : '';

      return `<div class="toc-section"><span class="toc-num">${index}</span><a href="#${escapeHtml(
        section.id
      )}" class="toc-link ${articleLinkClassName}">${escapeHtml(tocLabel(section))}</a>${subs}</div>`;
    })
    .join('');

  const metaItems = [
    `<div class="toc-meta-row"><span>Time</span><span>${escapeHtml(
      readingMeta(sourceMarkdown)
    )}</span></div>`,
    `<div class="toc-meta-row"><span>Last updated</span><span>${escapeHtml(
      formatDate(manifest.updatedAt)
    )}</span></div>`,
  ];

  if (manifest.codeLink) {
    metaItems.push(
      `<div class="toc-meta-row"><span>Code</span><span><a href="${escapeHtml(
        manifest.codeLink.href
      )}" class="toc-link ${articleExternalLinkClassName}">${escapeHtml(manifest.codeLink.label)}</a></span></div>`
    );
  }

  return `<nav class="article-toc" aria-label="Article index"><div class="toc-main"><h2 id="index">Index</h2><div class="toc-sections">${sectionHtml}</div></div><div class="toc-meta">${metaItems.join('')}</div></nav>`;
}

function mediaHtml(manifest: PostManifest, filename: string) {
  const insert = manifest.videoInserts.find(
    (item) => item.filename === filename
  );

  if (!insert) {
    return '';
  }

  return `<figure class="article-media video-figure"><video autoplay controls loop muted playsinline preload="auto" aria-label="${escapeHtml(
    insert.ariaLabel
  )}"><source src="${escapeHtml(
    mediaUrl(insert.filename)
  )}" type="video/mp4" /></video><figcaption><em>${insert.captionHtml}</em></figcaption></figure>`;
}

function normalizeExternalAnchors(html: string) {
  return html.replace(
    /<a\b([^>]*\bhref="https?:\/\/[^"]+"[^>]*)>/g,
    (match, attrs: string) => {
      let nextAttrs = attrs;

      if (!/\btarget=/.test(nextAttrs)) {
        nextAttrs += ' target="_blank"';
      }

      if (/\brel="/.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(
          /\brel="([^"]*)"/,
          (_, rel: string) =>
            `rel="${Array.from(
              new Set(`${rel} noreferrer external`.split(/\s+/))
            )
              .filter(Boolean)
              .join(' ')}"`
        );
      } else {
        nextAttrs += ' rel="noreferrer external"';
      }

      if (/\bclass="/.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(
          /\bclass="([^"]*)"/,
          (_, className: string) =>
            `class="${mergeClasses(className, articleExternalLinkClasses)}"`
        );
      } else {
        nextAttrs += ` class="${articleExternalLinkClasses.join(' ')}"`;
      }

      return `<a${nextAttrs}>`;
    }
  );
}

function normalizeLegacyVideos(html: string) {
  return html.replace(/<video\b([^>]*)>/g, (_match, attrs: string) => {
    let nextAttrs = attrs;

    for (const attr of [
      'autoplay',
      'controls',
      'loop',
      'muted',
      'playsinline',
    ]) {
      if (!new RegExp(`(?:^|\\s)${attr}(?:\\s|=|$)`, 'i').test(nextAttrs)) {
        nextAttrs += ` ${attr}`;
      }
    }

    if (/\bpreload=/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\bpreload="[^"]*"/i, 'preload="auto"');
    } else {
      nextAttrs += ' preload="auto"';
    }

    return `<video${nextAttrs}>`;
  });
}

function normalizeLegacyCodeBlocks(html: string) {
  return html.replace(
    /<div class="highlight">\s*<pre>([\s\S]*?)<\/pre>\s*<\/div>/g,
    (_match, highlighted: string) =>
      codeBlockHtml({
        highlighted: highlighted.replace(/^\s*<span><\/span>/, ''),
        lang: 'text',
      }).trim()
  );
}

function wrapArticleTable(tableHtml: string) {
  return `<figure class="article-table article-table-plain"><div class="table-wrap">${tableHtml}</div></figure>`;
}

function normalizeLegacyTables(html: string) {
  let normalized = html.replace(
    /<div class="table-pair">([\s\S]*?)<\/div>/g,
    (_match, inner: string) => {
      const tables = Array.from(inner.matchAll(/<table\b[\s\S]*?<\/table>/g))
        .map(([table]) => wrapArticleTable(table))
        .join('');

      return `<div class="article-table-pair">${tables}</div>`;
    }
  );

  normalized = normalized.replace(
    /(?<!<div class="table-wrap">)(<table\b[\s\S]*?<\/table>)/g,
    (_match, table: string) => wrapArticleTable(table)
  );

  return normalized;
}

function withTransparentIframeAttrs(html: string) {
  return html.replace(/<iframe\b([^>]*)>/g, (_match, attrs: string) => {
    let nextAttrs = attrs;
    const isHarmoniaIframe =
      /\bsrc="https:\/\/islamtayeb\.github\.io\/harmonia\//i.test(nextAttrs);

    if (isHarmoniaIframe && !/\bdata-harmonia-iframe=/i.test(nextAttrs)) {
      nextAttrs += ' data-harmonia-iframe="true"';
    }

    if (!/\bloading=/i.test(nextAttrs)) {
      nextAttrs += ' loading="lazy"';
    }

    if (!/\ballowtransparency=/i.test(nextAttrs)) {
      nextAttrs += ' allowtransparency="true"';
    }

    return `<iframe${nextAttrs}>`;
  });
}

function normalizeLegacyIframes(html: string) {
  const iframePattern = '<iframe\\b(?:(?!<iframe\\b)[\\s\\S])*?<\\/iframe>';

  return withTransparentIframeAttrs(html)
    .replace(
      new RegExp(
        `(${iframePattern})\\s*<p>\\s*<em>([\\s\\S]*?)<\\/em>\\s*<\\/p>`,
        'g'
      ),
      '<figure class="article-media iframe-figure">$1<figcaption><em>$2</em></figcaption></figure>'
    )
    .replace(
      new RegExp(
        `<p>\\s*(${iframePattern})\\s*<em>([\\s\\S]*?)<\\/em>\\s*<\\/p>`,
        'g'
      ),
      '<figure class="article-media iframe-figure">$1<figcaption><em>$2</em></figcaption></figure>'
    )
    .replace(
      /(?<!<figure class="article-media iframe-figure">)(<iframe\b(?:(?!<iframe\b)[\s\S])*?<\/iframe>)/g,
      '<figure class="article-media iframe-figure">$1</figure>'
    );
}

function normalizeLegacyDetails(html: string) {
  return html
    .replace(/<details>/g, '<details class="article-details">')
    .replace(/<summary>/g, '<summary class="article-summary">');
}

function dedupeHtmlIds(html: string) {
  const seen = new Map<string, number>();

  return html.replace(/\bid="([^"]+)"/g, (match, id: string) => {
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);

    return count === 0 ? match : `id="${id}-${count + 1}"`;
  });
}

function normalizeSentenceFootnotes(html: string) {
  return html.replace(
    /(<sup class="footnote-ref">[\s\S]*?<\/sup>)([.,;:!?])/g,
    '$2$1'
  );
}

function configureMarkdown(manifest: PostManifest) {
  const imageAltByFilename = new Map(
    manifest.images.map((image) => [image.filename, image.alt])
  );
  const seenHeadings = new Map<string, number>();

  const md = new MarkdownIt({
    html: manifest.allowHtml,
    linkify: false,
    typographer: false,
  }).use(footnote);

  md.inline.ruler.before('html_inline', 'kbd', (state, silent) => {
    const openTag = '<kbd>';
    const closeTag = '</kbd>';

    if (!state.src.startsWith(openTag, state.pos)) {
      return false;
    }

    const contentStart = state.pos + openTag.length;
    const contentEnd = state.src.indexOf(closeTag, contentStart);

    if (contentEnd < 0) {
      return false;
    }

    const content = state.src.slice(contentStart, contentEnd);

    if (content.length === 0 || /[<>]/.test(content)) {
      return false;
    }

    if (!silent) {
      state.push('kbd_open', 'kbd', 1);

      const text = state.push('text', '', 0);
      text.content = content;

      state.push('kbd_close', 'kbd', -1);
    }

    state.pos = contentEnd + closeTag.length;

    return true;
  });

  md.renderer.rules.footnote_caption = (tokens, idx) => {
    return Number(tokens[idx].meta.id + 1).toString();
  };

  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const inline = tokens[idx + 1];
    const text = inline?.content ?? '';
    const baseId = slugify(stripTags(text));
    const count = seenHeadings.get(baseId) ?? 0;
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    seenHeadings.set(baseId, count + 1);
    tokens[idx].attrSet('id', id);

    if (env && typeof env === 'object' && 'headings' in env) {
      (env as MarkdownEnv).headings.push({
        id,
        level: Number(tokens[idx].tag.slice(1)),
        text,
      });
    }

    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href');

    if (href && /^https?:\/\//.test(href)) {
      tokens[idx].attrSet('target', '_blank');
      tokens[idx].attrSet('rel', 'noreferrer external');
      tokens[idx].attrJoin('class', articleExternalLinkClasses.join(' '));
    } else {
      tokens[idx].attrJoin('class', articleLinkClasses.join(' '));
    }

    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = token.info.trim();
    const lang = info.split(/\s+/)[0] || 'text';
    const highlighted =
      lang && hljs.getLanguage(lang)
        ? hljs.highlight(token.content, {
            language: lang,
            ignoreIllegals: true,
          }).value
        : md.utils.escapeHtml(token.content);

    return codeBlockHtml({ highlighted, lang });
  };

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src');

    if (src?.startsWith(mediaBaseUrl)) {
      const filename = filenameFromUrl(src);
      token.attrSet('src', mediaUrl(filename));

      if (imageAltByFilename.has(filename)) {
        token.attrSet('alt', imageAltByFilename.get(filename) ?? '');
      }
    }

    if (!token.attrGet('alt')) {
      token.attrSet('alt', token.content ?? '');
    }

    return self.renderToken(tokens, idx, options);
  };

  return md;
}

export function renderMarkdown(markdown: string, manifest: PostManifest) {
  const prepared = prepareMarkdown(markdown, manifest);
  const env: MarkdownEnv = { headings: [] };
  const md = configureMarkdown(manifest);
  let html = md.render(prepared, env);
  const toc = buildToc(env.headings, manifest, markdown);

  html = html
    .replace('<p>%%GENERATED_TOC%%</p>', toc)
    .replace(
      /<p>\s*(<img\b[^>]*>)\s+<em>([\s\S]*?)<\/em>\s*<\/p>/g,
      (_match, imageHtml: string, captionHtml: string) =>
        articleMediaFigureHtml({ imageHtml, manifest, captionHtml })
    )
    .replace(
      /<p>\s*(<img\b[^>]*>)\s*<\/p>\s*<p>\s*<em>([\s\S]*?)<\/em>\s*<\/p>/g,
      (_match, imageHtml: string, captionHtml: string) =>
        articleMediaFigureHtml({ imageHtml, manifest, captionHtml })
    )
    .replace(/<p>\s*(<img\b[^>]*>)\s*<\/p>/g, (_match, imageHtml: string) =>
      articleMediaFigureHtml({ imageHtml, manifest })
    )
    .replace(
      /<p>\s*(<video\b[\s\S]*?<\/video>)\s*<em>([\s\S]*?)<\/em>\s*<\/p>/g,
      '<figure class="article-media video-figure">$1<figcaption><em>$2</em></figcaption></figure>'
    )
    .replace(
      /<p>\s*(<video\b[\s\S]*?<\/video>)\s*<\/p>\s*<p>\s*<em>([\s\S]*?)<\/em>\s*<\/p>/g,
      '<figure class="article-media video-figure">$1<figcaption><em>$2</em></figcaption></figure>'
    )
    .replace(
      /<hr>\s*<p>(P\.S\.[\s\S]*?)<\/p>\s*<hr class="footnotes-sep">\s*<section class="footnotes">/g,
      '<hr class="footnotes-sep"><section class="footnotes"><p class="footnote-postscript">$1</p>'
    )
    .replace(/<hr>\s*<hr class="footnotes-sep">/g, '<hr class="footnotes-sep">')
    .replace(
      /<hr>\s*(<section class="footnotes">)/g,
      '<hr class="footnotes-sep">$1'
    );

  html = normalizeLegacyDetails(
    normalizeLegacyCodeBlocks(
      normalizeLegacyIframes(normalizeLegacyTables(html))
    )
  );

  for (const insert of manifest.videoInserts) {
    html = html.replace(
      `<p>%%MEDIA:${escapeHtml(insert.filename)}%%</p>`,
      mediaHtml(manifest, insert.filename)
    );
  }

  return {
    html: dedupeHtmlIds(
      normalizeExternalAnchors(
        normalizeSentenceFootnotes(normalizeLegacyVideos(html))
      )
    ),
    headings: env.headings,
    readingMeta: readingMeta(markdown),
  };
}
