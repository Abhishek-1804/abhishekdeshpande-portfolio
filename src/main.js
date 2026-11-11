import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import posts from 'virtual:posts';
import { sections } from './content.js';
import { renderSection } from './render.js';
import { createEnvironment } from './world/environment.js';
import { createCity } from './world/city.js';
import { createHero, TUNING } from './world/hero.js';
import { createOrbs } from './world/orbs.js';
import { createTitle } from './world/title.js';
import { createHud } from './ui/hud.js';
import { createAudio } from './ui/audio.js';
import { clamp, lerp, damp } from './world/util.js';

const $ = (sel) => document.querySelector(sel);
const html = document.documentElement;
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

// ── Classic (plain document) view ───────────────────────────────────────────
const classic = $('#classic');
function showClassic(on) {
  classic.hidden = !on;
  html.classList.toggle('reading', on);
  if (on) { classic.scrollTop = 0; $('#classic-close').focus(); }
}
$('#classic-close').addEventListener('click', () => { showClassic(false); if (location.hash === '#classic') history.replaceState(null, '', ' '); });
for (const b of document.querySelectorAll('[data-classic]')) b.addEventListener('click', () => showClassic(true));

function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

if (!webglAvailable()) {
  html.classList.add('no-webgl');
  $('#loader').remove();
  showClassic(true);
} else {
  if (location.hash === '#classic') showClassic(true);
  boot().catch((err) => {
    console.error(err);
    html.classList.add('no-webgl');
    $('#loader')?.remove();
    showClassic(true);
  });
}

async function boot() {
  const checklist = $('#checklist');
  const check = async (label, fn) => {
    const li = document.createElement('li');
    li.textContent = label;
    checklist.append(li);
    await tick();
    const out = await fn();
    li.classList.add('done');
    return out;
  };

  // Labels are drawn to canvases, so wait for the web font (but not forever).
  await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1500))]);

  // ── Quality tier ───────────────────────────────────────────────────────────
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const quality = { low: coarse || small || (navigator.deviceMemory ?? 8) < 4 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Renderer, scene, camera ────────────────────────────────────────────────
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality.low ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.3, 12000);

  const env = await check('Lighting the sky', () => createEnvironment(scene, renderer, quality));
  const city = await check('Raising the skyline', () => createCity(scene, quality));
  const title = await check('Hanging the nameplate', () => createTitle(scene, city.site('home')));
  const hero = await check('Suiting up', () => createHero(scene, city));
  const orbs = await check('Scattering skills through the streets', () => createOrbs(scene, city));

  let bloom;
  const composer = await check('Testing the grapple line', async () => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.low ? 0 : 4 });
    const comp = new EffectComposer(renderer, target);
    comp.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), quality.low ? 0.3 : 0.38, 0.45, 1.0);
    comp.addPass(bloom);
    comp.addPass(new OutputPass());
    comp.setPixelRatio(renderer.getPixelRatio());
    comp.setSize(innerWidth, innerHeight);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    return comp;
  });

  if (location.search.includes('debug')) Object.assign(window, { __city: { scene, camera, renderer, env, city, hero, orbs, bloom } });

  const hud = createHud(city, orbs);
  const audio = createAudio();
  hud.setSkills(orbs.collected.size, orbs.total);

  // ── App state ──────────────────────────────────────────────────────────────
  const app = {
    started: false,
    panel: null, // id of the open section
    keys: new Set(),
    pointer: { active: false, x: 0, down: false },
    touch: null, // { id, x0, y0, x, y }
    boostButton: false,
    cut: true, // snap the camera instead of gliding (first frame, and after a skip)
    shift: 0, // how far the view is slid left to make room for the panel
  };

  // ── Loader → start ─────────────────────────────────────────────────────────
  const start = $('#takeoff');
  const soundToggle = $('#sound-toggle');
  soundToggle.checked = audio.enabled;
  start.disabled = false;
  start.textContent = 'Enter the city';
  $('#loader').classList.add('ready');
  start.focus({ preventScroll: true });

  start.addEventListener('click', () => {
    audio.setEnabled(soundToggle.checked);
    audio.start();
    syncSoundButton();
    $('#loader').classList.add('gone');
    setTimeout(() => $('#loader').remove(), 1200);
    html.classList.add('flying');
    app.started = true;
    const deep = location.hash.slice(1);
    if (sections.some((s) => s.id === deep)) setTimeout(() => travel(deep), 900);
    else showHint();
  });

  // ── Navigation & panels ────────────────────────────────────────────────────
  const nav = $('#nav');
  nav.innerHTML = sections
    .map((s, i) => `<button type="button" data-go="${s.id}" style="--hue:${s.hue}" title="Swing to ${s.title} (${i + 1})"><span class="dot"></span>${s.title}</button>`)
    .join('');
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    html.classList.remove('menu-open');
    if (app.started) travel(b.dataset.go);
  });
  $('#menu').addEventListener('click', () => html.classList.toggle('menu-open'));

  /** Autopilot: send the hero to a section's tower, then open it. */
  function travel(id) {
    const site = city.site(id);
    closePanel();
    setActiveNav(id);
    const already = hero.state.site === site && !hero.travelling;
    hero.goTo(site, () => openPanel(id));
    if (!already) toast(`On the way to ${site.title}`, site.hue);
    syncTravelUi();
  }
  function roam() {
    if (!app.started) return;
    closePanel();
    setActiveNav(null);
    hero.roam();
    toast('Free roam: drift left or right to choose your turns', '#5ff2ff', 3600);
    syncTravelUi();
  }
  function skip() {
    if (!hero.travelling || hero.state.roam) return;
    app.cut = true;
    hero.skip();
    syncTravelUi();
  }
  const skipBtn = $('#skip'), roamBtn = $('#btn-roam');
  skipBtn.addEventListener('click', skip);
  roamBtn.addEventListener('click', roam);
  function syncTravelUi() {
    const s = hero.state, heading = s.pending ?? s.dest;
    skipBtn.classList.toggle('show', hero.travelling && !!heading && !s.roam);
    roamBtn.setAttribute('aria-pressed', String(s.roam));
    html.classList.toggle('travelling', hero.travelling);
  }

  function setActiveNav(id) {
    for (const b of nav.querySelectorAll('[data-go]')) b.classList.toggle('active', b.dataset.go === id);
  }

  const panel = $('#panel');
  function openPanel(id) {
    const s = sections.find((x) => x.id === id);
    app.panel = id;
    setActiveNav(id);
    panel.style.setProperty('--hue', s.hue);
    $('#panel-kicker').textContent = s.blurb;
    $('#panel-title').textContent = s.title;
    $('#panel-body').innerHTML = renderSection(id, posts, orbs.collected);
    updateSkillCount();
    panel.hidden = false;
    panel.scrollTop = 0;
    requestAnimationFrame(() => html.classList.add('panel-open'));
    $('#panel-close').focus({ preventScroll: true });
    history.replaceState(null, '', '#' + id);
    syncTravelUi();
  }
  function closePanel() {
    if (!app.panel) return;
    app.panel = null;
    html.classList.remove('panel-open');
    setTimeout(() => { if (!app.panel) panel.hidden = true; }, 450);
    history.replaceState(null, '', ' ');
    canvas.focus({ preventScroll: true });
  }
  $('#panel-close').addEventListener('click', () => { closePanel(); setActiveNav(null); });

  function updateSkillCount() {
    const el = $('[data-skill-count]');
    if (el) {
      const n = orbs.collected.size;
      el.textContent = n === orbs.total
        ? `You collected all ${n} skills. Nicely swung.`
        : `You've collected ${n} of ${orbs.total} skills. They float along the streets between towers: drift into them as you swing past.`;
    }
  }

  // ── Toasts & hints ─────────────────────────────────────────────────────────
  const toasts = $('#toasts');
  function toast(text, hue = '#ffffff', ms = 2200) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--hue', hue);
    el.textContent = text;
    toasts.append(el);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 500);
    while (toasts.children.length > 3) toasts.firstChild.remove();
  }
  function showHint() {
    const hint = $('#hint');
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 9000);
  }

  // ── Hero events → sound and UI ─────────────────────────────────────────────
  hero.on((name, data) => {
    if (name === 'attach') audio.shot();
    if (name === 'launch') audio.whoosh();
    if (name === 'land') { audio.thud(); app.shake = 0.35; syncTravelUi(); }
    if (name === 'reroute') syncTravelUi();
    void data;
  });

  // ── Corner buttons ─────────────────────────────────────────────────────────
  const soundBtn = $('#btn-sound');
  function syncSoundButton() {
    soundBtn.setAttribute('aria-pressed', String(audio.enabled));
    soundBtn.title = audio.enabled ? 'Mute (M)' : 'Unmute (M)';
  }
  soundBtn.addEventListener('click', () => { audio.start(); audio.setEnabled(!audio.enabled); syncSoundButton(); });
  const timeBtn = $('#btn-time');
  const cycleTime = () => { const t = env.nextTime(); toast(t.label); timeBtn.dataset.time = t.id; };
  timeBtn.addEventListener('click', cycleTime);
  $('#btn-help').addEventListener('click', () => $('#help').showModal());
  $('#help-close').addEventListener('click', () => $('#help').close());
  $('#reset-skills').addEventListener('click', () => { orbs.reset(); hud.setSkills(0, orbs.total); toast('Skill orbs respawned'); $('#help').close(); });

  // ── Input ──────────────────────────────────────────────────────────────────
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, dialog')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (!classic.hidden) showClassic(false); else { closePanel(); setActiveNav(null); } return; }
    if (!classic.hidden || e.metaKey || e.ctrlKey || e.altKey || !app.started) return;
    if (k === 'm') return soundBtn.click();
    if (k === 't') return cycleTime();
    if (k === 'f') return roam();
    if (k === 'x') return skip();
    const n = parseInt(k, 10);
    if (n >= 1 && n <= sections.length) return travel(sections[n - 1].id);
    if (['arrowleft', 'arrowright', ' ', 'a', 'd', 'shift'].includes(k)) {
      if (app.panel && e.target.closest?.('#panel')) return;
      app.keys.add(k);
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => app.keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => app.keys.clear());

  // Mouse: drift follows the cursor, holding the button boosts, clicking a tower sends the hero there.
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let press = null;
  function pickTower(e) {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(city.pickables, false)[0]?.object.userData.site ?? null;
  }
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      app.pointer.active = true;
      app.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      if (!hero.travelling) canvas.style.cursor = pickTower(e) ? 'pointer' : '';
      else canvas.style.cursor = '';
    } else if (app.touch?.id === e.pointerId) { app.touch.x = e.clientX; app.touch.y = e.clientY; showStick(true); }
  });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') app.pointer.active = false; });
  canvas.addEventListener('pointerdown', (e) => {
    press = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (e.pointerType === 'mouse') app.pointer.down = true;
    else if (!app.touch) {
      app.touch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      if (hero.travelling) showStick(true);
    }
  });
  const release = (e) => {
    if (e.pointerType === 'mouse') app.pointer.down = false;
    if (app.touch?.id === e.pointerId) { app.touch = null; showStick(false); }
    // A quick tap or click (not a drag or a held boost) on a tower picks it.
    if (e.type === 'pointerup' && press && app.started && performance.now() - press.t < 350 && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8) {
      const id = pickTower(e);
      if (id) travel(id);
    }
    press = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // Touch joystick (drawn wherever the thumb lands).
  const stick = $('#stick'), knob = $('#stick i');
  const STICK = 56;
  function showStick(on) {
    stick.classList.toggle('on', on && !!app.touch);
    if (!on || !app.touch) return;
    const t = app.touch;
    const dx = clamp(t.x - t.x0, -STICK, STICK);
    stick.style.transform = `translate(${t.x0}px, ${t.y0}px)`;
    knob.style.transform = `translate(${dx}px, 0px)`;
  }
  const boostBtn = $('#boost');
  boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); app.boostButton = true; boostBtn.classList.add('on'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) boostBtn.addEventListener(ev, () => { app.boostButton = false; boostBtn.classList.remove('on'); });

  const input = { x: 0, boost: false };
  function readInput() {
    const k = app.keys;
    let x = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    if (app.touch) x = clamp((app.touch.x - app.touch.x0) / STICK, -1, 1);
    else if (!x && app.pointer.active) {
      const v = app.pointer.x;
      x = Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.6;
    }
    input.x = clamp(x, -1, 1);
    input.boost = k.has('shift') || k.has(' ') || app.pointer.down || app.boostButton;
    return input;
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    app.shiftApplied = null;
  }
  addEventListener('resize', resize);

  // ── Automatic quality ──────────────────────────────────────────────────────
  // If the device cannot hold ~40 fps, step the resolution down, then drop the
  // glow pass. It only ever steps down, so it cannot flicker between levels.
  const adapt = { on: !location.search.includes('noadapt'), time: 0, frames: 0, warmup: 3 };
  function watchFrameRate(raw) {
    if (!adapt.on || raw > 1.5) return; // a gap that long is a tab switch, not a slow frame
    if ((adapt.warmup -= raw) > 0) return;
    adapt.frames++; adapt.time += raw;
    if (adapt.time < 2.5 && adapt.frames < 90) return; // judge every couple of seconds
    const struggling = adapt.time / adapt.frames > 1 / 40;
    adapt.frames = adapt.time = 0;
    if (!struggling) return;
    const ratio = renderer.getPixelRatio();
    if (ratio > 0.8) {
      const next = Math.max(0.75, ratio - 0.25);
      renderer.setPixelRatio(next);
      composer.setPixelRatio(next);
      resize();
    } else if (bloom.enabled) bloom.enabled = false;
    else adapt.on = false; // nothing left to trade away
  }

  // ── Main loop ──────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3(), look = new THREE.Vector3();
  const off = new THREE.Vector3(0, -999, 0);
  let elapsed = 0, wasTravelling = false;

  renderer.setAnimationLoop(() => {
    const raw = clock.getDelta();
    watchFrameRate(raw);
    const dt = Math.min(raw, 1 / 20);
    elapsed += dt;
    const s = hero.state;

    hero.update(dt, elapsed, readInput());
    if (hero.travelling !== wasTravelling) { wasTravelling = hero.travelling; syncTravelUi(); }
    title.group.scale.setScalar(camera.aspect < 0.8 ? 0.42 : 1); // fit the name on a phone held upright
    title.update(elapsed, camera);
    env.update(dt, elapsed, camera);
    city.update(dt, elapsed, env);

    // Skill orbs can only be grabbed mid-swing.
    const got = orbs.update(elapsed, dt, s.mode === 'travel' ? s.pos : off);
    if (got) {
      const n = orbs.collected.size;
      hud.setSkills(n, orbs.total);
      if (n === orbs.total) { audio.fanfare(); toast('All skills collected. The city is yours.', '#5dffb0', 5000); }
      else { audio.chime(n); toast(`+ ${got}  ·  ${n}/${orbs.total}`, '#5dffb0'); }
      updateSkillCount();
      for (const li of document.querySelectorAll(`[data-skill="${CSS.escape(got)}"]`)) li.classList.add('got');
    }

    // Camera.
    const portrait = camera.aspect < 0.8;
    hero.view(wantPos, wantLook, elapsed, portrait);
    const free = window.__city?.freecam; // debug: park the camera anywhere
    if (free) { wantPos.fromArray(free.pos); wantLook.fromArray(free.look); app.cut = true; }
    if (app.cut) { camera.position.copy(wantPos); look.copy(wantLook); app.cut = false; }
    else {
      const rate = s.mode === 'travel' ? 7 : s.mode === 'idle' || s.mode === 'land' ? 2.6 : 11;
      camera.position.lerp(wantPos, damp(rate, dt));
      look.lerp(wantLook, damp(s.mode === 'idle' || s.mode === 'land' ? 4 : 12, dt));
    }
    camera.lookAt(look);
    if (s.mode === 'travel' && !reducedMotion) camera.rotateZ(clamp(-hero.traversal.lat * 0.012, -0.12, 0.12));
    if (app.shake > 0) {
      app.shake = Math.max(0, app.shake - dt * 1.6);
      if (!reducedMotion) camera.position.y += Math.sin(elapsed * 60) * app.shake * 0.25;
    }
    const rush = clamp((s.speed - 30) / (TUNING.boost - 30), 0, 1);
    camera.fov = lerp(camera.fov, (portrait ? 72 : 58) + (s.mode === 'travel' ? 6 + rush * 16 : 0), damp(3, dt));

    // Slide the view left while a panel covers the right side of a wide screen.
    const wide = !portrait && innerWidth >= 900;
    app.shift = lerp(app.shift, app.panel && wide ? 1 : 0, damp(4, dt));
    const px = Math.round(app.shift * Math.min(240, innerWidth * 0.18));
    if (px !== app.shiftApplied) {
      app.shiftApplied = px;
      if (px) camera.setViewOffset(innerWidth, innerHeight, px, 0, innerWidth, innerHeight); else camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();

    hud.update(hero, s.pending ?? s.dest);
    audio.update(hero.travelling ? clamp(s.speed / TUNING.boost, 0, 1) : 0.05);
    composer.render(dt);
  });
  // requestAnimationFrame already pauses in background tabs; dt is clamped on return.
}
