// Skill orbs: one collectible per skill in content.js, plus the burst on pickup.
import * as THREE from 'three';
import { allSkills, sections } from '../content.js';
import { rng, glowTexture, textSprite } from './util.js';

const STORE_KEY = 'flightlog.skills';
const PICKUP = 10;

function loadCollected() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]').filter((s) => allSkills.includes(s))); }
  catch { return new Set(); }
}
function saveCollected(set) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify([...set])); } catch { /* private mode */ }
}

export function createOrbs(scene, islands) {
  const rand = rng(2024);
  const collected = loadCollected();
  const geo = new THREE.IcosahedronGeometry(2.1, 1);
  const palette = sections.map((s) => new THREE.Color(s.hue));
  const skillsIsland = islands.byId('skills');

  const orbs = allSkills.map((skill, i) => {
    // About a third gather around the Skills island; the rest are scattered along the routes.
    let x, z;
    if (i % 3 === 0) {
      const a = rand() * Math.PI * 2, d = 120 + rand() * 170;
      x = skillsIsland.x + Math.cos(a) * d; z = skillsIsland.z + Math.sin(a) * d;
    } else {
      const a = rand() * Math.PI * 2, d = 180 + rand() * 1050;
      x = Math.cos(a) * d; z = Math.sin(a) * d;
    }
    const y = Math.max(islands.groundAt(x, z) + 22, 26 + rand() * 70);
    const color = palette[i % palette.length];
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const core = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.3, flatShading: true }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.setScalar(16);
    const label = textSprite(skill, { height: 3.2 });
    label.position.y = 5.5;
    group.add(core, halo, label);
    group.visible = !collected.has(skill);
    scene.add(group);
    return { skill, group, core, label, base: y, phase: rand() * 10, color };
  });

  // Particle bursts reuse a small pool of point clouds.
  const bursts = [];
  function burst(pos, color) {
    const n = 60;
    const positions = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      positions.set([pos.x, pos.y, pos.z], i * 3);
      vel.push(new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize().multiplyScalar(14 + rand() * 26));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 1.6, map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(pts);
    bursts.push({ pts, vel, life: 1.3 });
  }

  return {
    collected,
    total: allSkills.length,
    list: orbs,
    reset() { collected.clear(); saveCollected(collected); orbs.forEach((o) => (o.group.visible = true)); },
    /** Returns the skill picked up this frame, if any. */
    update(t, dt, planePos) {
      let got = null;
      for (const o of orbs) {
        if (!o.group.visible) continue;
        o.group.position.y = o.base + Math.sin(t * 1.5 + o.phase) * 2;
        o.core.rotation.set(t * 0.7 + o.phase, t + o.phase, 0);
        const d2 = o.group.position.distanceToSquared(planePos);
        o.label.visible = d2 < 260 * 260;
        if (d2 < PICKUP * PICKUP) {
          o.group.visible = false;
          collected.add(o.skill);
          saveCollected(collected);
          burst(o.group.position, o.color);
          got = o.skill;
        }
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.life -= dt;
        const arr = b.pts.geometry.attributes.position.array;
        b.vel.forEach((v, k) => { v.multiplyScalar(1 - dt * 1.8); arr[k * 3] += v.x * dt; arr[k * 3 + 1] += v.y * dt; arr[k * 3 + 2] += v.z * dt; });
        b.pts.geometry.attributes.position.needsUpdate = true;
        b.pts.material.opacity = Math.max(0, b.life / 1.3);
        if (b.life <= 0) { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
      }
      return got;
    },
  };
}
