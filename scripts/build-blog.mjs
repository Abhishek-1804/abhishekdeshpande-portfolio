// Runs after `vite build`. Renders the markdown blog into static pages at the
// same URLs the Hugo site used (/posts/<slug>/), plus tag pages, RSS, sitemap,
// a 404 page and redirects for retired Hugo pages.
import fs from 'node:fs';
import path from 'node:path';
import { Marked, Renderer } from 'marked';
import hljs from 'highlight.js';
import { loadPosts } from './posts.mjs';
import { profile } from '../src/content.js';
import { slugify, formatDate } from '../src/render.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = profile.site;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const write = (rel, content) => {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

// ── Markdown ────────────────────────────────────────────────────────────────
function renderMarkdown(src) {
  const toc = [];
  const used = new Map();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        let text = this.parser.parseInline(tokens);
        // Hugo-style explicit ids: "## Title {#custom-id}"
        const custom = text.match(/\s*\{#([\w-]+)\}\s*$/);
        if (custom) text = text.slice(0, custom.index);
        let id = custom?.[1] || slugify(text.replace(/<[^>]+>/g, '')) || 'section';
        const n = used.get(id) ?? 0;
        used.set(id, n + 1);
        if (n) id += `-${n}`;
        if (depth === 2 || depth === 3) toc.push({ id, depth, text: text.replace(/<[^>]+>/g, '') });
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${text}</h${depth}>\n`;
      },
      code({ text, lang }) {
        const language = (lang || '').split(/\s/)[0];
        if (language && hljs.getLanguage(language)) {
          return `<pre class="code" data-lang="${esc(language)}"><code class="hljs language-${esc(language)}">${hljs.highlight(text, { language }).value}</code></pre>\n`;
        }
        // Un-labelled blocks are the ASCII-art banners: keep them as plain art.
        const art = !language;
        return `<pre class="${art ? 'art' : 'code'}"><code>${esc(text)}</code></pre>\n`;
      },
      table(token) {
        // Keep marked's own table output, just wrapped for horizontal scrolling on phones.
        return `<div class="table-wrap">${Renderer.prototype.table.call(this, token)}</div>`;
      },
    },
  });
  const html = marked.parse(src);
  return { html, toc };
}

const readingTime = (md) => Math.max(1, Math.round(md.split(/\s+/).length / 220));

// ── Layout ──────────────────────────────────────────────────────────────────
const fontLink = '<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />';

function layout({ title, description, urlPath, body, head = '', type = 'website' }) {
  const url = SITE + urlPath;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="theme-color" content="#0b1424" />
<link rel="canonical" href="${url}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="alternate" type="application/rss+xml" title="${esc(profile.name)} · Blog" href="/index.xml" />
<meta property="og:type" content="${type}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/me.jpeg" />
${fontLink}
<link rel="stylesheet" href="/assets/blog.css" />
${head}
</head>
<body>
<div class="sky" aria-hidden="true"><svg class="paper-plane" viewBox="0 0 64 64"><path d="M4 30 60 6 44 58 32 40z" fill="#ffb347"/><path d="M32 40 60 6 24 36z" fill="#fff" opacity=".85"/></svg></div>
<header class="site-head">
  <a class="brand" href="/"><span class="logo">AD</span><span>Flight&nbsp;Log</span></a>
  <nav>
    <a href="/posts/">Blog</a>
    <a href="/tags/">Tags</a>
    <a class="fly" href="/">✈ Fly the portfolio</a>
  </nav>
</header>
<main class="wrap">
${body}
</main>
<footer class="site-foot">
  <p>© ${new Date().getFullYear()} ${esc(profile.name)} · ${profile.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join(' · ')} · <a href="/index.xml">RSS</a></p>
</footer>
<script>
document.querySelectorAll('pre.code').forEach(function (pre) {
  var b = document.createElement('button'); b.className = 'copy'; b.type = 'button'; b.textContent = 'Copy';
  b.onclick = function () { navigator.clipboard.writeText(pre.innerText.replace(/Copy(ed)?$/, '')).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); }); };
  pre.appendChild(b);
});
</script>
<script data-goatcounter="https://${profile.goatcounter}.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</body>
</html>`;
}

const tagLinks = (tags) => `<ul class="tags">${tags.map((t) => `<li><a href="/tags/${slugify(t)}/">${esc(t)}</a></li>`).join('')}</ul>`;
const postList = (list) =>
  `<ul class="post-list">${list
    .map(
      (p) => `<li><a href="/posts/${p.slug}/">
        <time datetime="${p.date}">${formatDate(p.date)}</time>
        <h2>${esc(p.title)}</h2>
        <p>${esc(p.summary)}</p>
        <span class="more">${p.minutes} min read →</span>
      </a></li>`
    )
    .join('')}</ul>`;

function redirect(to) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title><link rel="canonical" href="${SITE}${to}"><meta http-equiv="refresh" content="0; url=${to}"><meta name="robots" content="noindex"></head><body><p>This page moved: <a href="${to}">${to}</a></p></body></html>`;
}

// ── Build ───────────────────────────────────────────────────────────────────
const posts = loadPosts().map((p) => {
  const { html, toc } = renderMarkdown(p.body);
  const plain = p.body.replace(/```[\s\S]*?```/g, '').replace(/[#>*_`|\-[\]()!]/g, ' ').replace(/\s+/g, ' ').trim();
  return { ...p, html, toc, minutes: readingTime(p.body), summary: plain.slice(0, 180).replace(/\s\S*$/, '') + '…' };
});

const css = fs.readFileSync(path.join(ROOT, 'scripts/blog.css'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'node_modules/highlight.js/styles/github-dark.css'), 'utf8');
write('assets/blog.css', css);

posts.forEach((p, i) => {
  const newer = posts[i - 1], older = posts[i + 1];
  const toc = p.toc.length > 2
    ? `<details class="toc" open><summary>Contents</summary><ol>${p.toc.map((t) => `<li class="d${t.depth}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></details>`
    : '';
  const ld = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.date, author: { '@type': 'Person', name: profile.name, url: SITE }, url: `${SITE}/posts/${p.slug}/` };
  const body = `
<article class="post">
  <header class="post-head">
    <p class="crumbs"><a href="/posts/">Blog</a> /</p>
    <h1>${esc(p.title)}</h1>
    <p class="meta"><time datetime="${p.date}">${formatDate(p.date)}</time> · ${p.minutes} min read · ${esc(profile.name)}</p>
    ${tagLinks(p.tags)}
  </header>
  ${toc}
  <div class="post-body">${p.html}</div>
  <nav class="pager">
    ${newer ? `<a class="newer" href="/posts/${newer.slug}/"><span>Newer</span>${esc(newer.title)}</a>` : '<span></span>'}
    ${older ? `<a class="older" href="/posts/${older.slug}/"><span>Older</span>${esc(older.title)}</a>` : '<span></span>'}
  </nav>
</article>`;
  write(`posts/${p.slug}/index.html`, layout({ title: `${p.title} · ${profile.name}`, description: p.summary, urlPath: `/posts/${p.slug}/`, body, type: 'article', head: `<script type="application/ld+json">${JSON.stringify(ld)}</script>` }));
});

write('posts/index.html', layout({
  title: `Blog · ${profile.name}`,
  description: 'Tech musings: tools, aha moments and random rants about software.',
  urlPath: '/posts/',
  body: `<header class="list-head"><p class="kicker">Tech musings</p><h1>Blog</h1><p class="lead">Tools I love (and sometimes hate), "aha" moments that keep me up at night, and random musings about all things tech.</p></header>${postList(posts)}`,
}));

// Tags
const tags = new Map();
for (const p of posts) for (const t of p.tags) { const k = slugify(t); if (!tags.has(k)) tags.set(k, { name: t, posts: [] }); tags.get(k).posts.push(p); }
for (const [slug, t] of tags) {
  write(`tags/${slug}/index.html`, layout({ title: `${t.name} · ${profile.name}`, description: `Posts tagged ${t.name}.`, urlPath: `/tags/${slug}/`, body: `<header class="list-head"><p class="kicker">Tag</p><h1>#${esc(t.name)}</h1></header>${postList(t.posts)}` }));
}
write('tags/index.html', layout({
  title: `Tags · ${profile.name}`, description: 'All blog tags.', urlPath: '/tags/',
  body: `<header class="list-head"><p class="kicker">Browse</p><h1>Tags</h1></header><ul class="tag-cloud">${[...tags].sort((a, b) => b[1].posts.length - a[1].posts.length).map(([s, t]) => `<li><a href="/tags/${s}/">#${esc(t.name)} <sup>${t.posts.length}</sup></a></li>`).join('')}</ul>`,
}));

// RSS, at both URLs Hugo used.
const rss = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(profile.name)} · Blog</title>
<link>${SITE}/posts/</link>
<description>Tech musings by ${esc(profile.name)}</description>
<language>en-us</language>
<atom:link href="${SITE}/index.xml" rel="self" type="application/rss+xml" />
${posts.map((p) => `<item><title>${esc(p.title)}</title><link>${SITE}/posts/${p.slug}/</link><guid>${SITE}/posts/${p.slug}/</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.summary)}</description></item>`).join('\n')}
</channel>
</rss>`;
write('index.xml', rss);
write('posts/index.xml', rss);

// Sitemap & robots
const urls = ['/', '/posts/', '/tags/', ...posts.map((p) => `/posts/${p.slug}/`), ...[...tags.keys()].map((s) => `/tags/${s}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

// Old Hugo pages that no longer exist.
write('portfolio/index.html', redirect('/#classic'));
write('archives/index.html', redirect('/posts/'));
write('search/index.html', redirect('/posts/'));
write('categories/index.html', redirect('/tags/'));

write('404.html', layout({
  title: `Lost at sea · ${profile.name}`, description: 'Page not found.', urlPath: '/404.html',
  body: `<section class="lost"><p class="kicker">Error 404</p><h1>Lost at sea.</h1><p class="lead">This page drifted off the map. Let's get you back to the runway.</p><p><a class="btn" href="/">✈ Back to the flight</a> <a class="btn ghost" href="/posts/">Read the blog</a></p></section>`,
}));

console.log(`blog: ${posts.length} posts, ${tags.size} tags written to dist/`);
