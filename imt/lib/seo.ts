import { contactLinks, profileLinks } from '@/data/links';
import { profile } from '@/data/profile';
import { absoluteSiteUrl, siteMetadata } from '@/data/site-metadata';
import { datetime } from './blog/date';
import type { BlogPost } from './blog/posts';
import { postHref } from './blog/posts';

function socialImageUrlForPost(post: BlogPost) {
  return absoluteSiteUrl(
    post.manifest.socialImage ?? siteMetadata.socialImage.url
  );
}

type SocialImage = typeof siteMetadata.socialImage;

/** Everything the layout renders into <head> for one page. */
export type PageMeta = {
  title: string;
  // Posts carry no summary; null keeps them from inheriting the homepage bio.
  description: string | null;
  canonical: string;
  robots?: { index: false; follow: false };
  openGraph: {
    title: string;
    description?: string;
    url: string;
    siteName?: string;
    type: 'website' | 'article';
    publishedTime?: string;
    modifiedTime?: string;
    image: SocialImage;
  };
  twitter: { title: string; description?: string; image: SocialImage };
};

function pageTitle(title?: string) {
  return title ? `${title} | ${siteMetadata.title}` : siteMetadata.title;
}

export function buildHomeMetadata(): PageMeta {
  return {
    title: pageTitle(),
    description: siteMetadata.description,
    canonical: siteMetadata.url,
    openGraph: {
      title: siteMetadata.title,
      description: siteMetadata.description,
      url: siteMetadata.url,
      siteName: siteMetadata.title,
      type: 'website',
      image: siteMetadata.socialImage,
    },
    twitter: {
      title: siteMetadata.title,
      description: siteMetadata.description,
      image: siteMetadata.socialImage,
    },
  };
}

export function buildBlogIndexMetadata(): PageMeta {
  const url = absoluteSiteUrl('/blog');

  return {
    title: pageTitle('Blog'),
    description: siteMetadata.description,
    canonical: url,
    openGraph: {
      title: 'Blog',
      description: siteMetadata.description,
      url,
      type: 'website',
      image: siteMetadata.socialImage,
    },
    twitter: {
      title: 'Blog',
      description: siteMetadata.description,
      image: siteMetadata.socialImage,
    },
  };
}

export function buildNotFoundMetadata(): PageMeta {
  return {
    ...buildHomeMetadata(),
    title: pageTitle('Not found'),
    robots: { index: false, follow: false },
  };
}

export function buildPostMetadata(post: BlogPost): PageMeta {
  const canonicalUrl = absoluteSiteUrl(postHref(post));
  const socialImage = {
    ...siteMetadata.socialImage,
    url: socialImageUrlForPost(post),
  };

  return {
    title: pageTitle(post.manifest.title),
    description: null,
    canonical: canonicalUrl,
    openGraph: {
      title: post.manifest.title,
      url: canonicalUrl,
      type: 'article',
      publishedTime: datetime(post.manifest.publishedAt),
      modifiedTime: datetime(post.manifest.updatedAt),
      image: socialImage,
    },
    twitter: {
      title: post.manifest.title,
      image: socialImage,
    },
    robots: post.manifest.listed ? undefined : { index: false, follow: false },
  };
}

export function buildPersonJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    url: siteMetadata.url,
    image: siteMetadata.portraitUrl,
    description: siteMetadata.description,
    affiliation: {
      '@type': 'CollegeOrUniversity',
      name: 'Duke University',
      url: profileLinks.dukeUniversity,
    },
    sameAs: contactLinks
      .map((link) => link.href)
      .filter((href) => href.startsWith('https://')),
  };
}

export function buildBlogPostingJsonLd(post: BlogPost) {
  const canonicalUrl = absoluteSiteUrl(postHref(post));

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.manifest.title,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    datePublished: datetime(post.manifest.publishedAt),
    dateModified: datetime(post.manifest.updatedAt),
    image: [socialImageUrlForPost(post)],
    author: {
      '@type': 'Person',
      name: siteMetadata.title,
      url: siteMetadata.url,
    },
  };
}

export function sitemapUrls(listedPosts: BlogPost[]) {
  return [
    absoluteSiteUrl('/'),
    absoluteSiteUrl('/blog'),
    ...listedPosts.map((post) => absoluteSiteUrl(postHref(post))),
  ];
}

export function buildSitemapXml(listedPosts: BlogPost[]) {
  const postModified = new Map(
    listedPosts.map((post) => [
      absoluteSiteUrl(postHref(post)),
      new Date(post.manifest.updatedAt).toISOString(),
    ])
  );
  const entries = sitemapUrls(listedPosts).map((url) => {
    const lastModified = postModified.get(url);

    return `<url>
<loc>${url}</loc>${lastModified ? `\n<lastmod>${lastModified}</lastmod>` : ''}
</url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
}

export function buildRobotsTxt() {
  return `User-Agent: *
Allow: /

Sitemap: ${absoluteSiteUrl('/sitemap.xml')}
`;
}
