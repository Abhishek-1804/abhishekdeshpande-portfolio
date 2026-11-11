// Captures each phase of one trip: perch, launch, swing, landing, panel.
import { start } from './steps-example.mjs';
const waitFor = (cond, max = 400) => `for (let i = 0; i < ${max} && !(${cond}); i++) await new Promise(r => setTimeout(r, 150));`;
const H = 'window.__city.hero';
export default async ({ goto, run, shot, sleep }) => {
  await goto('http://localhost:4173/?debug&noadapt');
  console.log(await run(start));
  await sleep(1500);
  await shot('1-perch');
  // Close-up of the hero from the front.
  await run(`const p = ${H}.state.pos; window.__city.freecam = { pos: [p.x - 4.2, p.y + 0.6, p.z + 2.2], look: [p.x, p.y - 0.3, p.z] };`);
  await sleep(800); await shot('2-hero-closeup');
  await run(`window.__city.freecam = null; document.querySelector('[data-go=experience]').click();`);
  await run(waitFor(`${H}.state.mode === 'launch' && ${H}.state.u > 0.45`));
  await shot('3-launch');
  await run(waitFor(`${H}.state.mode === 'travel' && ${H}.traversal.mode === 'swing' && ${H}.traversal.s > 60`));
  await shot('4-swing');
  await run(waitFor(`${H}.state.mode === 'travel' && ${H}.traversal.mode === 'air' && ${H}.traversal.vy > 8`));
  await shot('5-release');
  await run(waitFor(`${H}.state.mode === 'travel' && ${H}.traversal.mode === 'swing' && ${H}.traversal.s > 260`));
  await run(`const h = ${H}, p = h.state.pos, f = h.state.forward; window.__city.freecam = { pos: [p.x + f.x * 7 + f.z * 4, p.y + 1, p.z + f.z * 7 - f.x * 4], look: [p.x, p.y, p.z] };`);
  await sleep(500); await shot('6-swing-front');
  await run(`window.__city.freecam = null;`);
  await run(waitFor(`${H}.state.mode === 'zip' && ${H}.state.u > 0.4`, 900));
  await shot('7-zip');
  await run(waitFor(`${H}.state.mode === 'idle'`, 300));
  await sleep(2500);
  await shot('8-landed-panel');
};
