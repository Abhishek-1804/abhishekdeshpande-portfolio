// Phone-size pass: node scripts/dev/shot.mjs scripts/dev/steps-phone.mjs 390 844 m
import { start } from './steps-example.mjs';
const waitFor = (cond, max = 600) => `for (let i = 0; i < ${max} && !(${cond}); i++) await new Promise(r => setTimeout(r, 150));`;
const H = 'window.__city.hero';
export default async ({ goto, run, shot, sleep }) => {
  await goto('http://localhost:4173/?debug&noadapt');
  await sleep(2500); await shot('p0-loader');
  console.log(await run(start));
  await sleep(1500); await shot('p1-perch');
  await run(`document.querySelector('#menu').click();`); await sleep(500); await shot('p2-menu');
  await run(`document.querySelector('[data-go=about]').click();`);
  await run(waitFor(`${H}.state.mode === 'travel' && ${H}.traversal.mode === 'swing' && ${H}.traversal.s > 60`));
  await shot('p3-swing');
  await run(waitFor(`${H}.state.mode === 'idle'`, 900));
  await sleep(2500); await shot('p4-panel');
  console.log(JSON.stringify(await run(`return { overflowX: document.documentElement.scrollWidth > innerWidth, w: innerWidth }`)));
};
