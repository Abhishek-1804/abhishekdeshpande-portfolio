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
import { createIslands, WORLD_RADIUS } from './world/islands.js';
import { createPlane, SPEED } from './world/plane.js';
import { createOrbs } from './world/orbs.js';
import { createTitle, TITLE_POS } from './world/title.js';
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
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, 12000);
  camera.position.set(0, 120, 420);

  const env = await check('Painting the sky and the ocean', () => createEnvironment(scene, renderer, quality));
  const islands = await check('Raising eight islands', () => createIslands(scene));
  const title = await check('Polishing the nameplate', () => createTitle(scene));
  const plane = await check('Assembling the aircraft', () => createPlane(scene, islands.groundAt, WORLD_RADIUS));
  const orbs = await check('Scattering skills across the map', () => createOrbs(scene, islands));

  const composer = await check('Warming up the engine', async () => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality.low ? 0 : 4 });
    const comp = new EffectComposer(renderer, target);
    comp.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), quality.low ? 0.5 : 0.65, 0.55, 0.82);
    comp.addPass(bloom);
    comp.addPass(new OutputPass());
    comp.setPixelRatio(renderer.getPixelRatio());
    comp.setSize(innerWidth, innerHeight);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    return comp;
  });

  if (location.search.includes('debug')) Object.assign(window, { __flight: { scene, camera, renderer, env, plane, islands, orbs } });

  const hud = createHud(islands, orbs);
  const audio = createAudio();
  hud.setSkills(orbs.collected.size, orbs.total);

  // ── App state ──────────────────────────────────────────────────────────────
  const app = {
    mode: 'intro', // intro → flying
    introBlend: 0,
    panel: null, // id of open section
    target: null, // island the autopilot is heading to
    keys: new Set(),
    pointer: { active: false, x: 0, y: 0, down: false },
    touch: null, // { id, x0, y0, x, y }
    boostButton: false,
    shake: 0,
  };

  // ── Loader → take off ─────────────────────────────────────────────────────
  const takeoff = $('#takeoff');
  const soundToggle = $('#sound-toggle');
  soundToggle.checked = audio.enabled;
  takeoff.disabled = false;
  takeoff.textContent = 'Take off';
  $('#loader').classList.add('ready');
  takeoff.focus({ preventScroll: true });

  takeoff.addEventListener('click', () => {
    audio.setEnabled(soundToggle.checked);
    audio.start();
    syncSoundButton();
    $('#loader').classList.add('gone');
    setTimeout(() => $('#loader').remove(), 1200);
    html.classList.add('flying');
    plane.reset();
    app.mode = 'flying';
    const deep = location.hash.slice(1);
    if (sections.some((s) => s.id === deep)) setTimeout(() => flyTo(deep), 1800);
    else showHint();
  });

  // ── Navigation & panels ────────────────────────────────────────────────────
  const nav = $('#nav');
  nav.innerHTML = sections
    .map((s) => `<button type="button" data-go="${s.id}" style="--hue:${s.hue}"><span class="dot"></span>${s.title}</button>`)
    .join('');
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    html.classList.remove('menu-open');
    if (app.mode !== 'flying') return;
    flyTo(b.dataset.go);
  });
  $('#menu').addEventListener('click', () => html.classList.toggle('menu-open'));

  function flyTo(id) {
    const isl = islands.byId(id);
    closePanel();
    app.target = isl;
    isl.cooldown = 0;
    setActiveNav(id);
    const pre = isl.gatePos.clone().addScaledVector(isl.approach, -150);
    pre.y = isl.gatePos.y;
    const through = isl.gatePos.clone().addScaledVector(isl.approach, 60);
    const toGate = () => { plane.state.autopilot = { target: through, onArrive: () => openPanel(id) }; };
    if (plane.state.pos.distanceTo(pre) < 80) toGate();
    else plane.state.autopilot = { target: pre, onArrive: toGate };
    toast(`Autopilot: ${isl.title}`, isl.hue);
  }

  function setActiveNav(id) {
    for (const b of nav.querySelectorAll('[data-go]')) b.classList.toggle('active', b.dataset.go === id);
  }

  const panel = $('#panel');
  function openPanel(id) {
    const s = sections.find((x) => x.id === id);
    plane.state.autopilot = null;
    app.target = null;
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
    audio.whoosh();
    history.replaceState(null, '', '#' + id);
  }
  function closePanel() {
    if (!app.panel) return;
    app.panel = null;
    setActiveNav(null);
    html.classList.remove('panel-open');
    setTimeout(() => { if (!app.panel) panel.hidden = true; }, 450);
    history.replaceState(null, '', ' ');
    canvas.focus({ preventScroll: true });
  }
  $('#panel-close').addEventListener('click', closePanel);

  function updateSkillCount() {
    const el = $('[data-skill-count]');
    if (el) {
      const n = orbs.collected.size;
      el.textContent = n === orbs.total
        ? `You collected all ${n} skills. Nice flying.`
        : `You've collected ${n} of ${orbs.total} skills. Fly through the glowing orbs to collect the rest.`;
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
  const proximity = $('#proximity');

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
    if (k === 'escape') { if (!classic.hidden) showClassic(false); else closePanel(); return; }
    if (!classic.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === 'm') { soundBtn.click(); return; }
    if (k === 't') { cycleTime(); return; }
    const n = parseInt(k, 10);
    if (n >= 1 && n <= sections.length && app.mode === 'flying') { flyTo(sections[n - 1].id); return; }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'shift'].includes(k)) {
      if (app.panel && e.target.closest?.('#panel')) return;
      app.keys.add(k);
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      plane.state.autopilot = null; app.target = null; setActiveNav(app.panel);
    }
  });
  addEventListener('keyup', (e) => app.keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => app.keys.clear());

  // Mouse: the plane follows the cursor; holding the button boosts.
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    app.pointer.active = true;
    app.pointer.x = (e.clientX / innerWidth) * 2 - 1;
    app.pointer.y = -((e.clientY / innerHeight) * 2 - 1);
  });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') app.pointer.active = false; });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') app.pointer.down = true;
    else if (!app.touch) {
      app.touch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      showStick(true);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (app.touch?.id === e.pointerId) { app.touch.x = e.clientX; app.touch.y = e.clientY; showStick(true); }
  });
  const endTouch = (e) => {
    if (e.pointerType === 'mouse') app.pointer.down = false;
    if (app.touch?.id === e.pointerId) { app.touch = null; showStick(false); }
  };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);

  // Touch joystick (drawn wherever the thumb lands).
  const stick = $('#stick'), knob = $('#stick i');
  const STICK = 56;
  function showStick(on) {
    stick.classList.toggle('on', on);
    if (!on || !app.touch) return;
    const t = app.touch;
    let dx = t.x - t.x0, dy = t.y - t.y0;
    const d = Math.hypot(dx, dy);
    if (d > STICK) { dx *= STICK / d; dy *= STICK / d; }
    stick.style.transform = `translate(${t.x0}px, ${t.y0}px)`;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    plane.state.autopilot = null; app.target = null;
  }
  const boostBtn = $('#boost');
  boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); app.boostButton = true; boostBtn.classList.add('on'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) boostBtn.addEventListener(ev, () => { app.boostButton = false; boostBtn.classList.remove('on'); });

  function readInput() {
    const k = app.keys;
    let x = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    let y = (k.has('arrowup') || k.has('w') ? 1 : 0) - (k.has('arrowdown') || k.has('s') ? 1 : 0);
    if (app.touch) {
      x = clamp((app.touch.x - app.touch.x0) / STICK, -1, 1);
      y = clamp(-(app.touch.y - app.touch.y0) / STICK, -1, 1);
    } else if (!x && !y && app.pointer.active && !app.panel) {
      const dead = (v) => (Math.abs(v) < 0.1 ? 0 : (v - Math.sign(v) * 0.1) / 0.9);
      x = dead(app.pointer.x) * 1.3;
      y = dead(app.pointer.y + 0.12) * 1.4;
      if (x || y) { plane.state.autopilot = null; app.target = null; }
    }
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), boost: k.has('shift') || k.has(' ') || app.pointer.down || app.boostButton };
  }

  // ── Resize ─────────────────────────────────────────────────────────────────
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);

  // ── Main loop ──────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), look = new THREE.Vector3();
  const offset = new THREE.Vector3(), introPos = new THREE.Vector3(), introLook = new THREE.Vector3();
  let elapsed = 0, lastProx = null;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    elapsed += dt;
    const s = plane.state;

    // Controls
    let targetSpeed = SPEED.cruise;
    if (app.mode === 'intro') {
      s.input.x = 0.32; s.input.y = (70 - s.pos.y) * 0.04; // a lazy circle while the loader shows
    } else if (app.panel) {
      s.input.x = 0.4; s.input.y = (75 - s.pos.y) * 0.03; // orbit while reading
      targetSpeed = SPEED.panel * 3;
    } else {
      const input = readInput();
      s.input.x = input.x; s.input.y = input.y;
      targetSpeed = input.boost ? SPEED.boost : s.autopilot ? SPEED.cruise * 1.6 : SPEED.cruise;
    }
    plane.update(dt, elapsed, targetSpeed);
    title.update(elapsed, camera);
    env.update(dt, elapsed, camera);

    // Gates & orbs
    const hit = islands.update(elapsed, dt, env.night, s.pos);
    if (hit && app.mode === 'flying' && !app.panel) openPanel(hit.id);
    if (app.mode === 'flying') {
      const got = orbs.update(elapsed, dt, s.pos);
      if (got) {
        const n = orbs.collected.size;
        hud.setSkills(n, orbs.total);
        if (n === orbs.total) { audio.fanfare(); toast('All skills collected! You are a certified wingman.', '#5dffb0', 5000); }
        else { audio.chime(n); toast(`+ ${got}  ·  ${n}/${orbs.total}`, '#5dffb0'); }
        updateSkillCount();
        for (const li of document.querySelectorAll(`[data-skill="${CSS.escape(got)}"]`)) li.classList.add('got');
      }
    } else orbs.update(elapsed, dt, new THREE.Vector3(0, -999, 0));

    // "Fly through the ring" prompt when near a gate.
    let near = null;
    if (app.mode === 'flying' && !app.panel) {
      for (const isl of islands.list) if (!isl.cooldown && s.pos.distanceTo(isl.gatePos) < 260) near = isl;
    }
    if (near !== lastProx) {
      lastProx = near;
      proximity.classList.toggle('show', !!near);
      if (near) { proximity.innerHTML = `Fly through the ring to open <b>${near.title}</b>`; proximity.style.setProperty('--hue', near.hue); }
    }
    $('#turnback').classList.toggle('show', s.turningBack && app.mode === 'flying');

    // Camera: orbit the title during the intro, then a chase cam.
    const portrait = camera.aspect < 0.8;
    const dist = portrait ? 25 : 18;
    offset.set(0, (portrait ? 7.5 : 5.6) - s.pitch * 4, dist).applyAxisAngle(THREE.Object3D.DEFAULT_UP, s.yaw);
    camPos.copy(s.pos).add(offset);
    camLook.copy(s.pos).addScaledVector(s.forward, 20).y += 2;
    if (app.panel && !portrait && innerWidth >= 900) {
      // Slide the plane left so it is not hidden behind the panel.
      const right = new THREE.Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
      camLook.addScaledVector(right, 9);
      camPos.addScaledVector(right, 6);
    }
    const a = reducedMotion ? 0.05 : elapsed * 0.06;
    introPos.set(TITLE_POS.x + Math.sin(a) * 210, TITLE_POS.y + 25, TITLE_POS.z + Math.cos(a) * 210 + 60);
    introLook.copy(TITLE_POS);
    app.introBlend = app.mode === 'intro' ? 0 : Math.min(1, app.introBlend + dt / 2.6);
    const b = app.introBlend * app.introBlend * (3 - 2 * app.introBlend);
    const follow = damp(app.introBlend < 1 ? 3 : 5, dt);
    camera.position.lerp(introPos.clone().lerp(camPos, b), app.mode === 'intro' ? 1 : follow);
    look.lerp(introLook.clone().lerp(camLook, b), app.mode === 'intro' ? 1 : damp(8, dt));
    camera.lookAt(look);
    if (app.mode === 'flying') camera.rotateZ(s.roll * -0.18);

    const boosting = s.speed > SPEED.cruise * 1.25;
    camera.fov = lerp(camera.fov, (portrait ? 70 : 62) + clamp((s.speed - SPEED.cruise) / 66, 0, 1) * 14, damp(3, dt));
    camera.updateProjectionMatrix();
    if (boosting && !reducedMotion) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, 0));

    hud.update(plane, app.target);
    audio.update(clamp((s.speed - 20) / (SPEED.boost - 20), 0, 1));
    composer.render(dt);
  });
  // requestAnimationFrame already pauses in background tabs; dt is clamped on return.
}
