import { cache } from 'react';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validatePostManifest, type PostManifest } from './manifest';
import { renderMarkdown, type Heading } from './markdown';

export type BlogPost = {
  manifest: PostManifest;
  sourceMarkdown: string;
  html: string;
  headings: Heading[];
  readingMeta: string;
};

export const contentRoot = path.resolve(process.cwd(), 'content', 'posts');

async function loadPostsUncached() {
  const manifestFiles = (await readdir(contentRoot))
    .filter((file) => file.endsWith('.json'))
    .sort();

  if (manifestFiles.length === 0) {
    throw new Error(`No post manifests found in ${contentRoot}`);
  }

  return Promise.all(
    manifestFiles.map(async (file) => {
      const manifestPath = path.join(contentRoot, file);
      const raw = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
      const manifest = validatePostManifest(raw, manifestPath);
      const sourcePath = path.join(contentRoot, manifest.source);
      const sourceMarkdown = await readFile(sourcePath, 'utf8');
      const rendered = renderMarkdown(sourceMarkdown, manifest);

      return {
        manifest,
        sourceMarkdown,
        html: rendered.html,
        headings: rendered.headings,
        readingMeta: rendered.readingMeta,
      };
    })
  );
}

export const getAllPosts = cache(async () => {
  const posts = await loadPostsUncached();

  return posts.sort(
    (a, b) =>
      new Date(b.manifest.publishedAt).getTime() -
      new Date(a.manifest.publishedAt).getTime()
  );
});

export async function getListedPosts() {
  return (await getAllPosts()).filter((post) => post.manifest.listed);
}

export async function getPostBySlug(slug: string) {
  return (await getAllPosts()).find((post) => post.manifest.slug === slug);
}

export function postHref(post: Pick<BlogPost, 'manifest'>) {
  return `/blog/${post.manifest.slug}`;
}

// Feed entry IDs stay on the first slug a post shipped with, so a rename
// doesn't resurface the post as new in feed readers. `previousSlugs` lists
// retired slugs oldest first; the old path still redirects to the post.
export function postFeedIdPath(post: Pick<BlogPost, 'manifest'>) {
  return `/blog/${post.manifest.previousSlugs[0] ?? post.manifest.slug}`;
}
