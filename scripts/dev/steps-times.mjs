// Night and midday: aerial, street and rooftop views in each lighting preset.
import { start } from './steps-example.mjs';
const settle = `for (let i = 0; i < 400; i++) { const e = window.__city.env; if (Math.abs(e.state.lights - e.time.lights) < 0.005 && Math.abs(e.state.sunEl - e.time.sunEl) < 0.05) break; await new Promise(r => setTimeout(r, 150)); }`;
export default async ({ goto, run, shot, sleep }) => {
  await goto('http://localhost:4173/?debug&noadapt');
  console.log(await run(start));
  for (const name of ['night', 'day']) {
    await run(`window.__city.env.nextTime(); ${settle}`);
    await sleep(1500);
    await run(`window.__city.freecam = null;`); await sleep(1200); await shot(`${name}-perch`);
    await run(`window.__city.freecam = { pos: [-420, 260, 520], look: [0, 60, 0] };`); await sleep(1200); await shot(`${name}-aerial`);
    await run(`window.__city.freecam = { pos: [-56, 14, 300], look: [-56, 30, -200] };`); await sleep(1200); await shot(`${name}-street`);
  }
};
