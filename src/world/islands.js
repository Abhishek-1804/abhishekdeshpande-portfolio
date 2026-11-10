// The eight islands: terrain, trees, a landmark per section, a gate and a beacon.
import * as THREE from 'three';
import { sections, experience, projects } from '../content.js';
import { rng, fbm, clamp, canvasTexture, glowTexture, textSprite } from './util.js';

// Where each island sits (x, z), its radius, and how tall its mountain is.
const LAYOUT = {
  about: { x: 0, z: -620, r: 150, peak: 55 },
  experience: { x: 660, z: -930, r: 190, peak: 70 },
  projects: { x: 1080, z: -230, r: 165, peak: 60 },
  skills: { x: 800, z: 520, r: 170, peak: 95 },
  opensource: { x: 110, z: 940, r: 150, peak: 50 },
  education: { x: -640, z: 720, r: 175, peak: 80 },
  blog: { x: -1080, z: 40, r: 155, peak: 58 },
  contact: { x: -660, z: -790, r: 150, peak: 66 },
};
export const WORLD_RADIUS = 1750;
const BASE = 9; // height of the flat ground each landmark stands on
const GATE_RADIUS = 15;

const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function heightAt(isl, x, z) {
  const d = Math.hypot(x, z) / isl.r;
  if (d > 1.2) return -6;
  const ang = Math.atan2(z, x);
  const coast = 0.78 + 0.24 * fbm(Math.cos(ang) * 1.6 + 9, Math.sin(ang) * 1.6 + 9, isl.seed, 3);
  const m = clamp(1 - d / coast, 0, 1);
  const shape = m * m * (3 - 2 * m);
  const n = fbm(x * 0.017 + isl.seed, z * 0.017, isl.seed, 5);
  const mx = x - isl.mx, mz = z - isl.mz;
  const mountain = Math.exp(-(mx * mx + mz * mz) / (2 * (isl.r * 0.27) ** 2));
  let h = -3 + shape * (7 + n * 9) + mountain * Math.sqrt(shape) * isl.peak * (0.5 + n * 0.95);
  const flat = smooth(0.3, 0.13, d);
  return h + (BASE - h) * flat;
}

const SAND = new THREE.Color('#d9c59c'), GRASS = new THREE.Color('#5c8a3f'), FOREST = new THREE.Color('#36602f');
const ROCK = new THREE.Color('#77706a'), SNOW = new THREE.Color('#f2f4f7');

function buildTerrain(isl) {
  const seg = 84;
  const geo = new THREE.PlaneGeometry(isl.r * 2.3, isl.r * 2.3, seg, seg).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(isl, pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i), x = pos.getX(i), z = pos.getZ(i);
    const steep = 1 - nor.getY(i);
    const v = fbm(x * 0.06, z * 0.06, isl.seed + 40, 3);
    c.copy(GRASS).lerp(FOREST, v);
    c.lerp(SAND, smooth(3.2, 1.2, h));
    c.lerp(ROCK, Math.max(smooth(0.22, 0.42, steep), smooth(isl.peak * 0.45, isl.peak * 0.7, h)));
    if (isl.peak > 75) c.lerp(SNOW, smooth(isl.peak * 0.78, isl.peak * 0.92, h + v * 6));
    c.multiplyScalar(0.86 + v * 0.28);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 }));
}

// ── Landmarks ────────────────────────────────────────────────────────────────
// Each returns { group, update(t, night) }. They are built from primitives so
// the site ships no model files.
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...o });
const mesh = (geo, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); return m; };
const glowMat = (color, opacity = 0.5) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });

function windowTexture(seed) {
  const rand = rng(seed);
  return canvasTexture(64, 128, (g) => {
    g.fillStyle = '#0b1220'; g.fillRect(0, 0, 64, 128);
    for (let y = 4; y < 124; y += 8)
      for (let x = 4; x < 60; x += 8) {
        const lit = rand();
        g.fillStyle = lit > 0.55 ? `rgba(255,${190 + rand() * 50},${110 + rand() * 80},1)` : '#16233a';
        g.fillRect(x, y, 5, 5);
      }
  });
}

const landmarks = {
  about(hue) {
    const g = new THREE.Group();
    const stripes = canvasTexture(8, 64, (c) => {
      for (let i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#c8402f' : '#f4f1ea'; c.fillRect(0, i * 16, 8, 16); }
    });
    g.add(mesh(new THREE.CylinderGeometry(2.4, 3.6, 28, 24), mat('#ffffff', { map: stripes }), 0, 14, 0));
    g.add(mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.6, 24), mat('#2a2d33'), 0, 28.2, 0));
    const lamp = mesh(new THREE.CylinderGeometry(1.9, 1.9, 3.4, 16), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 3 }), 0, 30.2, 0);
    g.add(lamp, mesh(new THREE.ConeGeometry(2.6, 2.4, 16), mat('#c8402f'), 0, 33.1, 0));
    g.add(mesh(new THREE.BoxGeometry(9, 5, 7), mat('#f4f1ea'), 8, 2.5, 3), mesh(new THREE.ConeGeometry(6.6, 3, 4).rotateY(Math.PI / 4), mat('#8a3b2e'), 8, 6.5, 3));
    // Light beams fade out along their length; mostly a night-time effect.
    const fade = canvasTexture(4, 128, (c) => {
      const grad = c.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = grad; c.fillRect(0, 0, 4, 128);
    });
    const beamMat = glowMat('#ffe2a0', 0.02);
    beamMat.alphaMap = fade;
    const beams = new THREE.Group();
    for (const s of [1, -1]) {
      const beam = mesh(new THREE.ConeGeometry(7, 120, 20, 1, true).translate(0, -60, 0), beamMat);
      beam.rotation.z = (s * Math.PI) / 2;
      beams.add(beam);
    }
    beams.position.y = 30.2;
    g.add(beams);
    return { group: g, update(t, night) { beams.rotation.y = t * 0.5; beamMat.opacity = 0.015 + night * 0.12; } };
  },

  experience() {
    const g = new THREE.Group();
    const lit = [];
    const spots = [[0, 0, 52, 11], [17, 6, 34, 9], [-15, 9, 26, 9]];
    experience.slice(0, 3).forEach((job, i) => {
      const [x, z, h, w] = spots[i];
      const tex = windowTexture(20 + i);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(w / 8, h / 16);
      const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.7 });
      lit.push(m);
      g.add(mesh(new THREE.BoxGeometry(w, h, w), m, x, h / 2, z), mesh(new THREE.BoxGeometry(w * 0.7, 2, w * 0.7), mat('#1c2330'), x, h + 1, z));
      const label = textSprite(job.company, { height: 5 });
      label.position.set(x, h + 9 + i * 2, z);
      g.add(label);
    });
    g.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 14, 6), mat('#cfd6e0', { metalness: 0.9 }), 0, 60, 0));
    const blink = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff3b30', blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    blink.position.set(0, 67.5, 0); blink.scale.setScalar(7);
    g.add(blink);
    return { group: g, update(t, night) { lit.forEach((m) => (m.emissiveIntensity = 0.25 + night * 2.2)); blink.material.opacity = Math.sin(t * 3) > 0.4 ? 1 : 0.1; } };
  },

  projects(hue) {
    const g = new THREE.Group();
    const hangar = mesh(new THREE.CylinderGeometry(14, 14, 34, 28, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), mat('#aeb7c2', { metalness: 0.85, roughness: 0.35, side: THREE.DoubleSide }));
    g.add(hangar, mesh(new THREE.BoxGeometry(30, 0.4, 36), mat('#2b3038'), 0, 0.2, 0));
    const holos = projects.slice(0, 3).map((p, i) => {
      const holo = new THREE.Group();
      const shape = [new THREE.IcosahedronGeometry(4.2, 0), new THREE.OctahedronGeometry(4.6, 0), new THREE.TorusKnotGeometry(2.8, 0.8, 64, 8)][i];
      holo.add(new THREE.LineSegments(new THREE.EdgesGeometry(shape), new THREE.LineBasicMaterial({ color: hue, fog: false })));
      holo.add(mesh(shape, glowMat(hue, 0.16)));
      holo.position.set((i - 1) * 17, 30 + (i % 2) * 6, 0);
      const label = textSprite(p.name, { height: 3.4 });
      label.position.set(holo.position.x, holo.position.y + 8, 0);
      g.add(holo, label);
      return holo;
    });
    return { group: g, update(t) { holos.forEach((h, i) => { h.rotation.set(t * 0.4 + i, t * 0.6 + i * 2, 0); h.position.y = 30 + (i % 2) * 6 + Math.sin(t * 1.2 + i * 2) * 1.6; }); } };
  },

  skills(hue) {
    const g = new THREE.Group();
    const rand = rng(77);
    const crystal = new THREE.MeshPhysicalMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.55, roughness: 0.08, metalness: 0.1, clearcoat: 1, flatShading: true, envMapIntensity: 1.6 });
    for (let i = 0; i < 11; i++) {
      const h = i === 0 ? 34 : 9 + rand() * 18, r = i === 0 ? 4.6 : 1.6 + rand() * 2.2;
      const geo = new THREE.CylinderGeometry(0.01, r, h, 6).translate(0, h / 2, 0);
      const c = mesh(geo, crystal);
      if (i > 0) { const a = rand() * Math.PI * 2, d = 4 + rand() * 9; c.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); c.rotation.set((rand() - 0.5) * 0.9, rand() * 3, (rand() - 0.5) * 0.9); }
      g.add(c);
    }
    return { group: g, update(t, night) { crystal.emissiveIntensity = 0.45 + night * 0.9 + Math.sin(t * 1.4) * 0.15; } };
  },

  opensource(hue) {
    const g = new THREE.Group();
    const lines = ['$ tldr lazygit', '', '  Simple terminal UI for git.', '', '  - Open lazygit:', '    lazygit', '', '$ git push origin main', '  PR merged ✓', '$ █'];
    const screen = canvasTexture(512, 640, (c) => {
      c.fillStyle = '#05100b'; c.fillRect(0, 0, 512, 640);
      c.font = '600 30px ui-monospace, "JetBrains Mono", monospace';
      lines.forEach((l, i) => { c.fillStyle = l.startsWith('$') ? '#7dffb0' : '#c8f7dc'; c.fillText(l, 28, 70 + i * 54); });
    });
    g.add(mesh(new THREE.BoxGeometry(22, 30, 2.4), mat('#0c0f14', { metalness: 0.9, roughness: 0.2 }), 0, 16, 0));
    const face = new THREE.MeshStandardMaterial({ map: screen, emissiveMap: screen, emissive: '#ffffff', emissiveIntensity: 1.3, roughness: 0.3 });
    const front = mesh(new THREE.PlaneGeometry(19, 26), face, 0, 16.4, 1.25);
    const back = mesh(new THREE.PlaneGeometry(19, 26), face, 0, 16.4, -1.25);
    back.rotation.y = Math.PI;
    g.add(front, back);
    return { group: g, update(t, night) { face.emissiveIntensity = 1.1 + night * 0.9 + Math.sin(t * 9) * 0.04; } };
  },

  education(hue) {
    const g = new THREE.Group();
    const marble = mat('#efe9dc', { roughness: 0.45 });
    g.add(mesh(new THREE.CylinderGeometry(15, 16, 1.6, 40), marble, 0, 0.8, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(mesh(new THREE.CylinderGeometry(1, 1.15, 16, 14), marble, Math.cos(a) * 12, 9.6, Math.sin(a) * 12));
    }
    g.add(mesh(new THREE.TorusGeometry(12, 1.5, 8, 40).rotateX(Math.PI / 2), marble, 0, 18.4, 0));
    const cap = new THREE.Group();
    cap.add(mesh(new THREE.BoxGeometry(9, 0.5, 9), mat('#14171d')), mesh(new THREE.CylinderGeometry(2.6, 3, 2.4, 20), mat('#14171d'), 0, -1.3, 0));
    cap.add(mesh(new THREE.SphereGeometry(0.5, 10, 10), new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 2 }), 0, 0.5, 0));
    cap.position.y = 30;
    g.add(cap);
    return { group: g, update(t) { cap.rotation.y = t * 0.5; cap.rotation.z = Math.sin(t * 0.8) * 0.12; cap.position.y = 30 + Math.sin(t) * 1.5; } };
  },

  blog(hue) {
    const g = new THREE.Group();
    const covers = ['#b5442f', '#2f6f8f', '#d9a441', '#3d7a52', '#6a4a8c'];
    let y = 0;
    covers.forEach((color, i) => {
      const h = 3 + (i % 3) * 0.8, w = 20 - i * 1.6;
      const book = new THREE.Group();
      book.add(mesh(new THREE.BoxGeometry(w, h, w * 0.72), mat(color, { roughness: 0.7 })), mesh(new THREE.BoxGeometry(w - 0.8, h - 0.7, w * 0.72 + 0.2), mat('#f3ecd9'), 0.6, 0, 0));
      book.position.y = y + h / 2; book.rotation.y = i * 0.5 - 0.6;
      y += h;
      g.add(book);
    });
    const pages = Array.from({ length: 14 }, (_, i) => {
      const p = mesh(new THREE.PlaneGeometry(3, 4), new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#fff1d0', emissiveIntensity: 0.25, side: THREE.DoubleSide }));
      p.userData = { a: (i / 14) * Math.PI * 2, r: 10 + (i % 4) * 3, s: 0.5 + (i % 5) * 0.12 };
      g.add(p);
      return p;
    });
    return { group: g, update(t) { for (const p of pages) { const u = p.userData, a = u.a + t * u.s * 0.6; p.position.set(Math.cos(a) * u.r, y + 8 + Math.sin(t * u.s + u.a) * 5 + u.r * 0.5, Math.sin(a) * u.r); p.rotation.set(t * u.s, a, Math.sin(t + u.a)); } } };
  },

  contact(hue) {
    const g = new THREE.Group();
    const steel = mat('#d7dde6', { metalness: 0.9, roughness: 0.3 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 4.5, 46, 4, 9, true), new THREE.MeshStandardMaterial({ color: '#d7dde6', metalness: 0.9, roughness: 0.3, wireframe: true }));
    mast.position.y = 23;
    g.add(mast, mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 6), steel, 0, 50, 0));
    const dish = mesh(new THREE.SphereGeometry(6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6).rotateX(Math.PI), mat('#eef1f5', { side: THREE.DoubleSide, metalness: 0.4 }), 5, 30, 0);
    dish.rotation.z = -0.9;
    g.add(dish);
    const rings = [0, 1, 2].map((i) => {
      const r = mesh(new THREE.TorusGeometry(1, 0.035, 6, 64).rotateX(Math.PI / 2), glowMat(hue, 0.8), 0, 54, 0);
      r.userData.o = i / 3;
      g.add(r);
      return r;
    });
    return { group: g, update(t) { for (const r of rings) { const k = (t * 0.35 + r.userData.o) % 1; r.scale.setScalar(2 + k * 34); r.material.opacity = (1 - k) * 0.85; } } };
  },
};

// ── Gate: the ring you fly through to open a section ─────────────────────────
function buildGate(hue) {
  const g = new THREE.Group();
  const color = new THREE.Color(hue);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(GATE_RADIUS, 0.9, 14, 72), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 2.6, roughness: 0.3 })));
  const portal = new THREE.Mesh(
    new THREE.CircleGeometry(GATE_RADIUS, 64),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uColor: { value: color } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
          float swirl = 0.5 + 0.5 * sin(a * 5.0 + r * 9.0 - uTime * 2.2);
          float rim = smoothstep(0.35, 1.0, r);
          gl_FragColor = vec4(uColor, (rim * 0.5 + swirl * rim * 0.35) * smoothstep(1.0, 0.96, r));
        }`,
    })
  );
  g.add(portal);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.setScalar(GATE_RADIUS * 5);
  g.add(halo);
  return { group: g, portal };
}

export function createIslands(scene) {
  const islands = [];
  const treeSpots = [];

  sections.forEach((section, i) => {
    const lay = LAYOUT[section.id];
    const toOrigin = new THREE.Vector2(-lay.x, -lay.z).normalize();
    // The mountain rises on the far side, leaving the approach from the centre clear.
    const isl = { ...section, ...lay, seed: 100 + i * 31, mx: -toOrigin.x * lay.r * 0.42, mz: -toOrigin.y * lay.r * 0.42 };
    const root = new THREE.Group();
    root.position.set(lay.x, 0, lay.z);
    root.add(buildTerrain(isl));

    const landmark = landmarks[section.id](section.hue);
    landmark.group.position.y = BASE;
    landmark.group.rotation.y = Math.atan2(toOrigin.x, toOrigin.y);
    root.add(landmark.group);

    const gate = buildGate(section.hue);
    const gatePos = new THREE.Vector3(lay.x + toOrigin.x * lay.r * 0.95, 42, lay.z + toOrigin.y * lay.r * 0.95);
    gate.group.position.copy(gatePos);
    gate.group.rotation.y = Math.atan2(toOrigin.x, toOrigin.y);
    scene.add(gate.group);

    const title = textSprite(section.title.toUpperCase(), { height: 15, weight: 700 });
    title.position.set(0, isl.peak + 46, 0);
    root.add(title);

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 520, 8, 1, true), glowMat(section.hue, 0.22));
    beacon.position.set(isl.mx, 260 + isl.peak * 0.5, isl.mz);
    root.add(beacon);

    const rand = rng(isl.seed);
    for (let n = 0; n < 900 && treeSpots.length < (i + 1) * 130; n++) {
      const x = (rand() * 2 - 1) * lay.r, z = (rand() * 2 - 1) * lay.r;
      const h = heightAt(isl, x, z);
      const flatZone = Math.hypot(x, z) < lay.r * 0.2;
      if (h > 3.5 && h < isl.peak * 0.42 && !flatZone) treeSpots.push([lay.x + x, h, lay.z + z, 0.7 + rand() * 0.9, rand()]);
    }

    scene.add(root);
    islands.push({ ...isl, landmark, gate, gatePos, approach: new THREE.Vector3(-toOrigin.x, 0, -toOrigin.y), cooldown: 0 });
  });

  // All trees share one instanced mesh.
  const treeGeo = new THREE.ConeGeometry(2.2, 8, 7).translate(0, 4, 0);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ roughness: 1, envMapIntensity: 0.2 }), treeSpots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  treeSpots.forEach(([x, y, z, s, v], i) => {
    m4.compose(new THREE.Vector3(x, y - 0.4, z), q, new THREE.Vector3(s, s * (0.9 + v * 0.5), s));
    trees.setMatrixAt(i, m4);
    trees.setColorAt(i, c.setHSL(0.3 + v * 0.06, 0.42, 0.17 + v * 0.1));
  });
  scene.add(trees);

  return {
    list: islands,
    byId: (id) => islands.find((i) => i.id === id),
    /** Terrain height under a world position (0 over open water). */
    groundAt(x, z) {
      for (const isl of islands) {
        const dx = x - isl.x, dz = z - isl.z;
        if (dx * dx + dz * dz < (isl.r * 1.2) ** 2) return Math.max(0, heightAt(isl, dx, dz));
      }
      return 0;
    },
    /** Animates landmarks; returns the island whose gate the plane just crossed, if any. */
    update(t, dt, night, planePos) {
      let hit = null;
      for (const isl of islands) {
        isl.landmark.update(t, night);
        isl.gate.portal.material.uniforms.uTime.value = t;
        isl.cooldown = Math.max(0, isl.cooldown - dt);
        if (!isl.cooldown && planePos.distanceToSquared(isl.gatePos) < (GATE_RADIUS - 1.5) ** 2) {
          isl.cooldown = 6;
          hit = isl;
        }
      }
      return hit;
    },
  };
}
