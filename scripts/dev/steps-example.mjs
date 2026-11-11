// Example steps for scripts/dev/shot.mjs: start the site, look at the city from
// fixed cameras, then ride to a section and capture the landing and its panel.
// Needs the preview server on :4173 and the ?debug flag (exposes window.__city).
const waitFor = (cond, max = 240) => `for (let i = 0; i < ${max} && !(${cond}); i++) await new Promise(r => setTimeout(r, 250));`;

export const start = `
  ${waitFor(`document.querySelector('#takeoff')?.disabled === false || document.documentElement.classList.contains('no-webgl')`)}
  if (document.documentElement.classList.contains('no-webgl')) return 'NO WEBGL';
  document.querySelector('#sound-toggle').checked = false;
  document.querySelector('#takeoff').click();
  await new Promise(r => setTimeout(r, 1500));
  return 'started';`;

export default async ({ goto, run, shot, sleep }) => {
  await goto('http://localhost:4173/?debug&noadapt');
  console.log(await run(start));
  await shot('idle');

  // Park the camera anywhere with __city.freecam = { pos, look }; null returns it to the hero.
  const cam = async (name, pos, look) => {
    await run(`window.__city.freecam = { pos: ${JSON.stringify(pos)}, look: ${JSON.stringify(look)} };`);
    await sleep(1200);
    await shot(name);
  };
  await cam('aerial', [-420, 260, 520], [0, 60, 0]);
  await cam('street', [-56, 14, 300], [-56, 30, -200]);
  await run(`window.__city.freecam = null;`);

  // Ride to a section. Poll the hero's state rather than sleeping a fixed time.
  await run(`document.querySelector('[data-go=about]').click();`);
  await run(waitFor(`window.__city.hero.state.mode === 'travel' && window.__city.hero.traversal.mode === 'swing'`));
  await shot('swing');
  await run(waitFor(`window.__city.hero.state.mode === 'idle'`, 600));
  await sleep(1500);
  await shot('landed');
};
