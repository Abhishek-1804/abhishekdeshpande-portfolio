// One rooftop showpiece per section, built from primitives (no model files).
// Each builder returns { group, update(t, night) }.
import * as THREE from 'three';
import { experience, projects } from '../content.js';
import { rng, canvasTexture, glowTexture, textSprite } from './util.js';

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

export const landmarks = {
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

