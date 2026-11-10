// The plane: a procedural light aircraft, its flight model, autopilot and contrails.
import * as THREE from 'three';
import { clamp, lerp, damp, wrapAngle, glowTexture } from './util.js';

export const SPEED = { cruise: 52, boost: 118, panel: 9 };
const FLOOR = 7, CEILING = 420;

function buildModel() {
  const plane = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#f5f3ee', roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12 });
  const accent = new THREE.MeshPhysicalMaterial({ color: '#e0552c', roughness: 0.35, metalness: 0.2, clearcoat: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1d2129', roughness: 0.5, metalness: 0.6 });

  // Fuselage: a lathe profile from the nose (top) to the tail (bottom), laid along -Z.
  const profile = [[0, 3.4], [0.62, 3.2], [0.95, 2.5], [1.05, 1.2], [1.0, -0.6], [0.78, -2.6], [0.42, -4.6], [0.16, -5.6], [0, -5.7]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 28).rotateX(-Math.PI / 2), paint);
  body.scale.set(1, 0.95, 1);
  plane.add(body);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.07, 0.98, 1.2, 28, 1, true).rotateX(Math.PI / 2), accent);
  stripe.position.z = 0.1;
  plane.add(stripe);

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: '#13202e', roughness: 0.04, metalness: 0.2, clearcoat: 1, envMapIntensity: 2.4 })
  );
  canopy.scale.set(0.95, 0.85, 2.1);
  canopy.position.set(0, 0.62, -0.6);
  plane.add(canopy);

  // Tapered wings from a 2D planform shape.
  const wingShape = (span, root, tip, sweep) => {
    const s = new THREE.Shape();
    s.moveTo(0, -root / 2); s.lineTo(span, -tip / 2 + sweep); s.lineTo(span, tip / 2 + sweep); s.lineTo(0, root / 2); s.closePath();
    return s;
  };
  const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(extrude(wingShape(6.4, 2.1, 1.1, 0.35), 0.14).rotateX(Math.PI / 2), paint);
    wing.scale.x = side;
    wing.position.set(0, -0.15, -0.3);
    wing.rotation.z = side * 0.06; // dihedral
    plane.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 1.2), accent);
    tip.position.set(side * 6.2, 0.25, 0.05);
    plane.add(tip);
    const tail = new THREE.Mesh(extrude(wingShape(2.4, 1.3, 0.7, 0.3), 0.1).rotateX(Math.PI / 2), paint);
    tail.scale.x = side;
    tail.position.set(0, 0.05, 4.9);
    plane.add(tail);
  }
  const fin = new THREE.Mesh(extrude(wingShape(2.3, 1.7, 0.8, 0.7), 0.1).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), accent);
  fin.position.set(-0.05, 0.3, 4.9);
  plane.add(fin);

  // Propeller.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 20).rotateX(-Math.PI / 2), accent);
  spinner.position.z = -3.75;
  plane.add(spinner);
  const prop = new THREE.Group();
  prop.position.z = -3.55;
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.05).translate(0, 1.1, 0), dark);
    blade.rotation.z = (i / 3) * Math.PI * 2;
    blade.rotation.y = 0.3;
    prop.add(blade);
  }
  plane.add(prop);
  const blur = new THREE.Mesh(new THREE.CircleGeometry(2.3, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
  blur.position.z = -3.5;
  plane.add(blur);

  // Landing gear.
  for (const x of [-1.1, 1.1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1), dark);
    leg.position.set(x, -1.2, -1); leg.rotation.z = x * -0.3;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.13, 8, 16).rotateY(Math.PI / 2), dark);
    wheel.position.set(x * 1.25, -1.7, -1);
    plane.add(leg, wheel);
  }

  // Navigation lights: red left, green right, white strobe on the tail.
  const light = (color, x, y, z, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.position.set(x, y, z); s.scale.setScalar(size);
    plane.add(s);
    return s;
  };
  light('#ff2b2b', -6.65, 0.3, 0.05, 1.4);
  light('#2bff6a', 6.65, 0.3, 0.05, 1.4);
  const strobe = light('#ffffff', 0, 2.65, 6.2, 2.2);

  plane.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  plane.scale.setScalar(0.62);
  return { plane, prop, blur, strobe };
}

/** A ribbon that trails behind a point on the plane, fading with age. */
class Trail {
  constructor(scene, length = 70, width = 0.16) {
    this.n = length;
    this.width = width;
    this.points = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(length * 2 * 3);
    const alpha = new Float32Array(length * 2);
    for (let i = 0; i < length; i++) alpha[i * 2] = alpha[i * 2 + 1] = 1 - i / (length - 1);
    const idx = [];
    for (let i = 0; i < length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uOpacity; varying float vA; void main(){ gl_FragColor = vec4(1.0, 1.0, 1.0, vA * vA * uOpacity); }',
    }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  push(p, up, opacity) {
    this.points.unshift([p.clone(), up.clone()]);
    if (this.points.length > this.n) this.points.pop();
    const last = this.points[this.points.length - 1];
    for (let i = 0; i < this.n; i++) {
      const [q, u] = this.points[i] ?? last;
      const w = this.width * (1 + i * 0.03);
      this.pos.set([q.x + u.x * w, q.y + u.y * w, q.z + u.z * w, q.x - u.x * w, q.y - u.y * w, q.z - u.z * w], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.material.uniforms.uOpacity.value = opacity;
  }
}

export function createPlane(scene, groundAt, worldRadius) {
  const { plane, prop, blur, strobe } = buildModel();
  scene.add(plane);
  const trails = [new Trail(scene), new Trail(scene)];
  const tips = [new THREE.Vector3(-6.65, 0.3, 0.6), new THREE.Vector3(6.65, 0.3, 0.6)];

  const s = {
    pos: new THREE.Vector3(0, 60, 260),
    yaw: 0, pitch: 0, roll: 0,
    speed: SPEED.cruise,
    forward: new THREE.Vector3(0, 0, -1),
    input: { x: 0, y: 0, boost: false },
    autopilot: null, // { target: Vector3, onArrive }
    turningBack: false,
  };
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const tmp = new THREE.Vector3(), up = new THREE.Vector3();

  function steerTowards(target) {
    tmp.subVectors(target, s.pos);
    const desiredYaw = Math.atan2(-tmp.x, -tmp.z);
    const yawErr = wrapAngle(desiredYaw - s.yaw);
    const desiredPitch = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z));
    return { x: clamp(-yawErr * 1.8, -1, 1), y: clamp((desiredPitch - s.pitch) * 2.2 + desiredPitch * 0.8, -1, 1) };
  }

  return {
    state: s,
    object: plane,
    reset() { s.pos.set(0, 60, 260); s.yaw = s.pitch = s.roll = 0; },
    update(dt, t, targetSpeed) {
      let { x, y } = s.input;
      if (s.autopilot) {
        ({ x, y } = steerTowards(s.autopilot.target));
        if (s.pos.distanceTo(s.autopilot.target) < 30) { const done = s.autopilot.onArrive; s.autopilot = null; done?.(); }
      }

      // Soft world boundary: past it, the plane banks itself back home.
      const dist = Math.hypot(s.pos.x, s.pos.z);
      s.turningBack = dist > worldRadius;
      if (s.turningBack) ({ x, y } = steerTowards(tmp.set(0, 80, 0)));

      // Terrain and sea avoidance.
      const ground = groundAt(s.pos.x + s.forward.x * 30, s.pos.z + s.forward.z * 30);
      const floor = Math.max(FLOOR, ground + 12);
      if (s.pos.y < floor + 8) y = Math.max(y, clamp((floor + 8 - s.pos.y) / 8, 0, 1));
      if (s.pos.y > CEILING) y = Math.min(y, -0.4);

      s.roll = lerp(s.roll, -x * 1.05, damp(3.2, dt));
      s.pitch = lerp(s.pitch, clamp(y * 0.65, -0.75, 0.75), damp(2.4, dt));
      s.yaw += Math.sin(s.roll) * 1.05 * dt;
      s.speed = lerp(s.speed, targetSpeed, damp(targetSpeed > s.speed ? 1.6 : 3, dt));

      euler.set(s.pitch, s.yaw, 0);
      s.forward.set(0, 0, -1).applyEuler(euler);
      s.pos.addScaledVector(s.forward, s.speed * dt);
      s.pos.y = Math.max(s.pos.y, floor - 4);

      // A little turbulence makes it feel alive.
      const bob = Math.sin(t * 1.3) * 0.12 + Math.sin(t * 2.7) * 0.05;
      plane.position.copy(s.pos).y += bob;
      plane.rotation.set(s.pitch, s.yaw, s.roll + Math.sin(t * 1.1) * 0.02, 'YXZ');

      prop.rotation.z += dt * (30 + s.speed * 0.9);
      blur.material.opacity = clamp(s.speed / 900, 0.03, 0.1);
      strobe.material.opacity = (t % 1.2) < 0.08 ? 1 : 0;

      const trailOpacity = clamp((s.speed - 55) / 60, 0, 0.32) + Math.abs(s.roll) * 0.12;
      plane.updateMatrixWorld();
      up.set(0, 1, 0).applyQuaternion(plane.quaternion);
      trails.forEach((tr, i) => tr.push(tmp.copy(tips[i]).applyMatrix4(plane.matrixWorld), up, trailOpacity));
    },
  };
}
