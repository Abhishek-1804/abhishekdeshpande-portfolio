// Free roam, re-targeting out of it, Skip, and the automatic quality fallback.
import { start } from './steps-example.mjs';
const waitFor = (cond, max = 900) => `for (let i = 0; i < ${max} && !(${cond}); i++) await new Promise(r => setTimeout(r, 150));`;
const H = 'window.__city.hero';
const where = `const s = ${H}.state; return { mode: s.mode, roam: s.roam, dest: s.dest?.id ?? null, site: s.site?.id ?? null, x: Math.round(s.pos.x), z: Math.round(s.pos.z), panel: document.documentElement.classList.contains('panel-open'), title: document.querySelector('#panel-title').textContent, skipShown: document.querySelector('#skip').classList.contains('show'), roamPressed: document.querySelector('#btn-roam').getAttribute('aria-pressed') };`;
export default async ({ goto, run, shot, sleep }) => {
  await goto('http://localhost:4173/?debug&noadapt');
  console.log(await run(start));
  await run(`document.querySelector('#btn-roam').click();`);
  await run(waitFor(`${H}.state.mode === 'travel' && ${H}.traversal.s > 80`));
  console.log('roaming', JSON.stringify(await run(where)));
  await run(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));`); // drift right -> turn right at the next junction
  const routes = await run(`let n = 0, last = ${H}.traversal.route; for (let i = 0; i < 500 && n < 3; i++) { if (${H}.traversal.route !== last) { n++; last = ${H}.traversal.route; } await new Promise(r => setTimeout(r, 150)); } return n;`);
  console.log('route extensions while roaming:', routes, JSON.stringify(await run(where)));
  await shot('r1-roam');
  await run(`window.dispatchEvent(new KeyboardEvent('keyup', { key: 'd' })); document.querySelector('[data-go=projects]').click();`);
  await run(waitFor(`${H}.state.mode === 'idle'`, 2000));
  await sleep(1500);
  console.log('after picking Projects mid-roam', JSON.stringify(await run(where)));
  await shot('r2-projects');
  await run(`document.querySelector('[data-go=contact]').click();`);
  await run(waitFor(`${H}.state.mode === 'travel'`));
  console.log('travelling', JSON.stringify(await run(where)));
  await run(`document.querySelector('#skip').click();`);
  await sleep(2500);
  console.log('after Skip', JSON.stringify(await run(where)));
  await shot('r3-skipped');

  // Quality fallback: without ?noadapt this slow software renderer should step down.
  await goto('http://localhost:4173/?debug');
  await sleep(3000); // let the new page load before touching it
  await run(start);
  await sleep(75000);
  console.log('adaptive quality on slow GPU:', JSON.stringify(await run(`return { pixelRatio: window.__city.renderer.getPixelRatio(), bloom: window.__city.bloom.enabled }`)));
};
