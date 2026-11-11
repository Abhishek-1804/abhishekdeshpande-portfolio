// Pure HTML-string renderers shared by the in-city panels, the classic view,
// and the build step (which bakes the classic view into index.html for
// search engines and no-JS visitors). No DOM access in this file.
import * as c from './content.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const ext = (url, label, cls = '') =>
  `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>`;
const chips = (items) => `<ul class="chips">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;

export const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

const renderers = {
  about: () => `
    <div class="about-head">
      <img src="${esc(c.profile.photo)}" alt="Portrait of ${esc(c.profile.name)}" width="96" height="96" />
      <div>
        <p class="lede">${esc(c.profile.role)}</p>
        <p class="muted">${esc(c.profile.tagline)}</p>
      </div>
    </div>
    ${c.about.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="actions">${ext(c.profile.resume, 'Résumé', 'btn')}</p>`,

  experience: () =>
    c.experience
      .map(
        (j) => `
    <article class="card">
      <h3>${esc(j.role)}</h3>
      <p class="meta"><strong>${esc(j.company)}</strong> · ${esc(j.period)} · ${esc(j.place)}</p>
      <ul>${j.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    </article>`
      )
      .join(''),

  projects: () =>
    c.projects
      .map(
        (p) => `
    <article class="card">
      <h3>${ext(p.url, p.name)}</h3>
      <p>${esc(p.text)}</p>
      ${chips(p.tech)}
    </article>`
      )
      .join(''),

  skills: (_posts, collected) => `
    ${collected ? `<p class="muted" data-skill-count></p>` : ''}
    ${c.skills
      .map(
        (g) => `
    <div class="skill-group">
      <h3>${esc(g.group)}</h3>
      <ul class="chips">${g.items
        .map((s) => `<li data-skill="${esc(s)}"${collected && collected.has(s) ? ' class="got"' : ''}>${esc(s)}</li>`)
        .join('')}</ul>
    </div>`
      )
      .join('')}`,

  opensource: () =>
    c.openSource
      .map(
        (o) => `
    <article class="card">
      <h3>${ext(o.url, o.name)} <span class="muted">${esc(o.note)}</span></h3>
      <p>${esc(o.text)}</p>
      <p>${ext(o.more.url, o.more.label)}</p>
    </article>`
      )
      .join(''),

  education: () =>
    c.education
      .map(
        (e) => `
    <article class="card">
      <h3>${esc(e.degree)}</h3>
      <p class="meta"><strong>${esc(e.school)}</strong></p>
      ${chips(e.courses)}
    </article>`
      )
      .join(''),

  blog: (posts = []) => `
    <p class="muted">${esc(c.blogIntro)}</p>
    <ul class="posts">
      ${posts
        .map(
          (p) => `
      <li><a href="/posts/${esc(p.slug)}/"><span>${esc(p.title)}</span><time datetime="${esc(p.date)}">${formatDate(p.date)}</time></a></li>`
        )
        .join('')}
    </ul>
    <p class="actions"><a class="btn" href="/posts/">All posts</a></p>`,

  contact: () => `
    <p>The fastest way to reach me is email.</p>
    <p class="actions">
      <a class="btn" href="mailto:${esc(c.profile.email)}">${esc(c.profile.email)}</a>
    </p>
    <ul class="links">${c.profile.links.map((l) => `<li>${ext(l.url, l.label)}</li>`).join('')}</ul>`,
};

/** Body HTML for one section. `collected` (a Set) is only passed in the 3D view. */
export function renderSection(id, posts, collected) {
  return renderers[id] ? renderers[id](posts, collected) : '';
}

/** The whole portfolio as one plain document. */
export function renderClassic(posts) {
  return `
  <header class="classic-head">
    <h1>${esc(c.profile.name)}</h1>
    <p>${esc(c.profile.role)}</p>
  </header>
  ${c.sections
    .map(
      (s) => `
  <section id="classic-${s.id}">
    <h2>${esc(s.title)}</h2>
    ${renderSection(s.id, posts)}
  </section>`
    )
    .join('')}`;
}
