// Instrument readouts and the radar mini-map.
const $ = (sel) => document.querySelector(sel);

export function createHud(city, orbs) {
  const speedEl = $('#i-speed'), altEl = $('#i-alt'), hdgEl = $('#i-hdg'), tapeEl = $('#i-tape'), skillsEl = $('#i-skills');
  const radar = $('#radar');
  const g = radar.getContext('2d');
  const RANGE = 620;
  let size = 0;

  // Compass tape: letters every 45°, ticks every 15°.
  const marks = [];
  for (let d = -360; d <= 720; d += 15) {
    const n = ((d % 360) + 360) % 360;
    const label = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[n];
    marks.push(`<span style="left:${(d + 360) * 4}px" class="${label ? 'major' : ''}">${label ?? '·'}</span>`);
  }
  tapeEl.innerHTML = marks.join('');

  function resize() {
    const css = radar.clientWidth;
    const dpr = Math.min(window.devicePixelRatio, 2);
    size = css;
    radar.width = radar.height = css * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  let frame = 0;
  return {
    setSkills(n, total) { skillsEl.textContent = `${n}/${total}`; },
    update(hero, target) {
      const s = hero.state;
      const heading = ((((-s.yaw * 180) / Math.PI) % 360) + 360) % 360;
      if (frame++ % 3 === 0) {
        speedEl.textContent = Math.round(s.speed * 2.237);
        altEl.textContent = Math.round(s.pos.y * 3.281).toLocaleString('en-US');
        hdgEl.textContent = String(Math.round(heading) % 360).padStart(3, '0');
      }
      tapeEl.style.transform = `translateX(${-(heading + 360) * 4}px)`;

      // Radar, heading-up.
      const r = size / 2, k = (r - 6) / RANGE;
      g.clearRect(0, 0, size, size);
      g.save();
      g.translate(r, r);
      g.beginPath(); g.arc(0, 0, r - 1, 0, Math.PI * 2); g.fillStyle = 'rgba(6,14,24,0.55)'; g.fill();
      g.strokeStyle = 'rgba(160,220,255,0.18)'; g.lineWidth = 1;
      for (const f of [0.33, 0.66]) { g.beginPath(); g.arc(0, 0, (r - 1) * f, 0, Math.PI * 2); g.stroke(); }
      g.beginPath(); g.arc(0, 0, r - 1, 0, Math.PI * 2); g.stroke();
      g.rotate(s.yaw);
      const map = (x, z) => [(x - s.pos.x) * k, (z - s.pos.z) * k];
      for (const o of orbs.list) {
        if (!o.group.visible) continue;
        const [x, y] = map(o.group.position.x, o.group.position.z);
        if (x * x + y * y > (r - 4) ** 2) continue;
        g.fillStyle = 'rgba(255,255,255,0.65)';
        g.fillRect(x - 1, y - 1, 2, 2);
      }
      for (const isl of city.sites) {
        let [x, y] = map(isl.x, isl.z);
        const d = Math.hypot(x, y), max = r - 9;
        if (d > max) { x *= max / d; y *= max / d; }
        g.beginPath(); g.arc(x, y, isl === target ? 6 : 4.5, 0, Math.PI * 2);
        g.fillStyle = isl.hue; g.fill();
        if (isl === target) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
      }
      g.restore();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(r, r - 7); g.lineTo(r + 5, r + 6); g.lineTo(r, r + 3); g.lineTo(r - 5, r + 6); g.closePath(); g.fill();
    },
  };
}
