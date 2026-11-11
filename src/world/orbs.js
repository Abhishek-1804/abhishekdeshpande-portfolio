// Skill orbs: one collectible per skill in content.js, plus the burst on pickup.
import * as THREE from 'three';
import { allSkills, sections } from '../content.js';
import { planRoute } from '../sim/layout.js';
import { buildRoute } from '../sim/route.js';
import { rng, glowTexture, textSprite } from './util.js';

const STORE_KEY = 'flightlog.skills';
const REACH = 6.5; // sideways distance at which a passing hero grabs an orb

function loadCollected() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]').filter((s) => allSkills.includes(s))); }
  catch { return new Set(); }
}
function saveCollected(set) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify([...set])); } catch { /* private mode */ }
}

export function createOrbs(scene, city) {
  const rand = rng(2024);
  const collected = loadCollected();
  const geo = new THREE.IcosahedronGeometry(1.5, 1);
  const palette = sections.map((s) => new THREE.Color(s.hue));

  // Orbs sit along the streets between consecutive towers, off-centre, so a
  // visitor touring the sections in order passes all of them and can drift to grab each.
  const stops = ['home', ...sections.map((s) => s.id)].map((id) => city.site(id));
  const legs = stops.slice(1).map((to, i) => buildRoute(planRoute(stops[i].access, to.access)));
  const total = legs.reduce((sum, r) => sum + r.length - 140, 0);
  const spots = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  allSkills.forEach((_, i) => {
    let d = ((i + 0.5) / allSkills.length) * total;
    const leg = legs.find((r) => (d < r.length - 140 ? true : ((d -= r.length - 140), false))) ?? legs[legs.length - 1];
    const s = 70 + d, lat = (rand() < 0.5 ? -1 : 1) * (3 + rand() * 5);
    leg.pointAt(s, p); leg.tangentAt(s, t);
    spots.push([p.x - t.z * lat, 24 + rand() * 18, p.z + t.x * lat]);
  });

  const orbs = allSkills.map((skill, i) => {
    const [x, y, z] = spots[i];
    const color = palette[i % palette.length];
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const core = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.3, flatShading: true }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.setScalar(11);
    const label = textSprite(skill, { height: 2.4 });
    label.position.y = 4;
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
        o.group.position.y = o.base + Math.sin(t * 1.5 + o.phase) * 1.2;
        o.core.rotation.set(t * 0.7 + o.phase, t + o.phase, 0);
        const dx = o.group.position.x - planePos.x, dz = o.group.position.z - planePos.z;
        const flat = dx * dx + dz * dz;
        o.label.visible = flat < 220 * 220;
        // Swings rise and fall a lot, so height barely matters: line up sideways and it is yours.
        if (flat < REACH * REACH && Math.abs(o.group.position.y - planePos.y) < 42) {
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
