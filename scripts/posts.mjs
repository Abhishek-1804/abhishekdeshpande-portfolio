// Reads blog posts from content/posts/*.md. Used by vite.config.js (post list
// for the home page) and scripts/build-blog.mjs (the post pages themselves).
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export const POSTS_DIR = path.resolve(import.meta.dirname, '../content/posts');

export function loadPosts() {
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(POSTS_DIR, f), 'utf8'));
      return {
        slug: f.replace(/\.md$/, ''),
        title: data.title ?? f,
        date: new Date(data.date).toISOString(),
        tags: data.tags ?? [],
        draft: !!data.draft,
        body: content,
      };
    })
    .filter((p) => !p.draft && new Date(p.date) <= new Date())
    .sort((a, b) => b.date.localeCompare(a.date));
}
