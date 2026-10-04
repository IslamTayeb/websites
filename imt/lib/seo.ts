import type { Metadata, MetadataRoute } from 'next';
import { contactLinks } from '@/data/links';
import { absoluteSiteUrl, siteMetadata } from '@/data/site-metadata';
import { datetime } from './blog/date';
import type { BlogPost } from './blog/posts';
import { postHref } from './blog/posts';

function socialImageUrlForPost(post: BlogPost) {
  return absoluteSiteUrl(
    post.manifest.socialImage ?? siteMetadata.socialImage.url
  );
}

export function buildPostMetadata(post: BlogPost): Metadata {
  const canonicalUrl = absoluteSiteUrl(postHref(post));
  const socialImage = {
    ...siteMetadata.socialImage,
    url: socialImageUrlForPost(post),
  };

  return {
    title: post.manifest.title,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.manifest.title,
      url: canonicalUrl,
      type: 'article',
      publishedTime: datetime(post.manifest.publishedAt),
      modifiedTime: datetime(post.manifest.updatedAt),
      images: [socialImage],
    },
    twitter: {
      card: 'summary',
      title: post.manifest.title,
      images: [socialImage],
    },
    robots: post.manifest.listed
      ? undefined
      : {
          index: false,
          follow: false,
        },
  };
}

export function buildPersonJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: siteMetadata.title,
    url: siteMetadata.url,
    image: siteMetadata.socialImage.url,
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

export function staticSitemapEntries(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteSiteUrl('/'),
    },
    {
      url: absoluteSiteUrl('/blog'),
    },
  ];
}

export function postSitemapEntry(
  post: BlogPost
): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteSiteUrl(postHref(post)),
    lastModified: new Date(post.manifest.updatedAt),
  };
}
