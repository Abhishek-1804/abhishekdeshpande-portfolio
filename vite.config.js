import { defineConfig } from 'vite';
import { loadPosts } from './scripts/posts.mjs';
import { renderClassic } from './src/render.js';
import { profile } from './src/content.js';

const postMeta = () => loadPosts().map(({ body, ...meta }) => meta);

/** Exposes the blog post list to the app as `virtual:posts`. */
function postsPlugin() {
  const id = 'virtual:posts';
  return {
    name: 'posts',
    resolveId: (source) => (source === id ? '\0' + id : null),
    load: (resolved) => (resolved === '\0' + id ? `export default ${JSON.stringify(postMeta())};` : null),
  };
}

/** Bakes the plain-text version of the portfolio into index.html. */
function classicPlugin() {
  return {
    name: 'classic',
    transformIndexHtml: (html) =>
      html
        .replace('<!--classic-->', renderClassic(postMeta()))
        .replaceAll('%GOATCOUNTER%', profile.goatcounter),
  };
}

export default defineConfig({
  publicDir: 'static',
  plugins: [postsPlugin(), classicPlugin()],
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 1200 },
});
