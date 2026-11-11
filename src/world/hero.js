// The hero: an original masked figure with a glowing grapple line. This file
// owns how they look and move (rig, poses, rope) and the trip state
// machine: idle on a roof → leap → swing along the route → pull up → land.
// The swing physics itself lives in src/sim/traverse.js.
import * as THREE from 'three';
import { planRoute, roamTarget } from '../sim/layout.js';
import { buildRoute } from '../sim/route.js';
import { Traversal, TUNING, HANDOFF, launchCurve, zipCurve, retarget, extendRoam } from '../sim/traverse.js';
import { clamp, lerp, damp, canvasTexture } from './util.js';

const SCALE = 1.8; // a little larger than life so the figure reads from the chase camera
export const STAND = 0.98 * SCALE; // pelvis height above the roof when standing
const UP = new THREE.Vector3(0, 1, 0);
const PERCH_DROP = 0.6, LAND_DROP = 0.68; // how far the pelvis sinks in each crouch (unscaled metres)
const ROPE = new THREE.Color(1.5, 1.5, 1.55); // a thin white line, bright enough to catch the bloom

// ── Rig ──────────────────────────────────────────────────────────────────────
// A slim athletic figure in a two-tone suit, built from tapered primitives.
// Deliberately an original design: dark teal-black suit, amber yoke, gloves and
// boots, and one wraparound visor. No emblem, no web pattern.
const SUIT = '#161b26', ACCENT = '#f29a1f';

function suitTexture() {
  // Wrapped around the torso: v runs waist (0) to neck (1).
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = SUIT; g.fillRect(0, 0, 256, 256);
    g.fillStyle = ACCENT; g.fillRect(0, 0, 256, 62); // shoulder yoke (canvas top = neck)
    g.fillStyle = SUIT;
    g.beginPath(); g.moveTo(0, 62); g.lineTo(64, 40); g.lineTo(128, 62); g.lineTo(192, 40); g.lineTo(256, 62); g.lineTo(256, 70); g.lineTo(0, 70); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; // seams
    for (const x of [32, 96, 160, 224]) { g.beginPath(); g.moveTo(x, 70); g.lineTo(x, 256); g.stroke(); }
    g.fillStyle = ACCENT; g.fillRect(0, 232, 256, 7); // belt line
  });
}

function buildRig() {
  const fabric = { roughness: 0.62, metalness: 0.05, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color('#5a6f8f'), envMapIntensity: 1.2 };
  const suit = new THREE.MeshPhysicalMaterial({ color: SUIT, ...fabric });
  const accent = new THREE.MeshPhysicalMaterial({ color: ACCENT, ...fabric, sheenColor: new THREE.Color('#ffd9a0') });
  const torsoMat = new THREE.MeshPhysicalMaterial({ map: suitTexture(), ...fabric });
  const visorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.25, 1.3), fog: false });

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const j = {};
  const joint = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); j[name] = g; return g; };
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  /** A tapered limb segment hanging down from its joint, with a rounded end. */
  const limb = (parent, rTop, rBottom, len, mat, endMat = mat) => {
    add(parent, new THREE.CylinderGeometry(rTop, rBottom, len, 14, 1).translate(0, -len / 2, 0), mat);
    add(parent, new THREE.SphereGeometry(rTop, 14, 10), mat);
    return add(parent, new THREE.SphereGeometry(rBottom, 12, 8), endMat, 0, -len, 0);
  };
  const lathe = (pts, mat, parent, sx, sz) => {
    const m = add(parent, new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28), mat);
    m.scale.set(sx, 1, sz);
    return m;
  };

  // Hips, then a V-shaped torso: narrow waist, broad chest and shoulders.
  lathe([[0, -0.13], [0.1, -0.12], [0.15, -0.04], [0.145, 0.03], [0.12, 0.09]], suit, body, 1.08, 0.78);
  const spine = joint('spine', body, 0, 0.06, 0);
  lathe([[0.118, 0.0], [0.108, 0.1], [0.125, 0.2], [0.158, 0.33], [0.172, 0.42], [0.15, 0.49], [0.075, 0.535], [0.05, 0.56]], torsoMat, spine, 1.16, 0.7);

  const neck = joint('neck', spine, 0, 0.55, 0);
  add(neck, new THREE.CylinderGeometry(0.047, 0.055, 0.09, 12), suit, 0, 0.02, 0);
  add(neck, new THREE.SphereGeometry(0.104, 24, 18).scale(0.9, 1.12, 1.0), suit, 0, 0.155, 0.008);
  // One wraparound visor band across the face.
  const visor = add(neck, new THREE.SphereGeometry(0.106, 24, 8, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.4, Math.PI * 0.13), visorMat, 0, 0.155, 0.01);
  visor.scale.set(0.9, 1.12, 1.0);

  const hands = {};
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = joint('sh' + side, spine, sx * 0.205, 0.46, 0);
    add(sh, new THREE.SphereGeometry(0.066, 14, 10), suit); // deltoid
    limb(sh, 0.05, 0.04, 0.28, suit);
    const el = joint('el' + side, sh, 0, -0.28, 0);
    limb(el, 0.041, 0.031, 0.25, suit);
    add(el, new THREE.CylinderGeometry(0.036, 0.033, 0.09, 12), accent, 0, -0.2, 0); // glove cuff
    hands[side] = add(el, new THREE.SphereGeometry(0.042, 10, 8).scale(0.8, 1.25, 1), accent, 0, -0.29, 0);

    const hip = joint('hip' + side, body, sx * 0.088, -0.06, 0);
    limb(hip, 0.086, 0.057, 0.44, suit);
    const kn = joint('kn' + side, hip, 0, -0.44, 0);
    limb(kn, 0.058, 0.04, 0.42, suit);
    add(kn, new THREE.CylinderGeometry(0.05, 0.043, 0.17, 12), accent, 0, -0.335, 0); // boot
    add(kn, new THREE.CapsuleGeometry(0.042, 0.14, 4, 8).rotateX(Math.PI / 2), accent, 0, -0.45, 0.06);
  }
  root.scale.setScalar(SCALE);
  return { root, body, j, hands };
}

// Joint angles (radians) as [x, y, z]. Unlisted joints relax to zero.
// Facing +Z; the character's left is +X. Negative shoulder/hip x swings the limb forward.
const POSES = {
  // Perched on the ledge: deep squat, one hand down, watching the city.
  perch: {
    spine: [0.5, 0, 0], neck: [-0.62, 0, 0],
    hipL: [-1.95, 0, 0.6], knL: [2.4, 0, 0], hipR: [-1.95, 0, -0.6], knR: [2.4, 0, 0],
    shL: [-1.05, 0, 0.45], elL: [-1.3, 0, 0], shR: [-0.3, 0, 0.1], elR: [-0.12, 0, 0],
  },
  // Landing impact: lower still, one arm thrown back for balance.
  crouch: {
    spine: [0.75, 0, 0], neck: [-0.3, 0, 0],
    hipL: [-2.1, 0, 0.5], knL: [2.5, 0, 0], hipR: [-1.7, 0, -0.7], knR: [2.5, 0, 0],
    shL: [-0.8, 0, 0.2], elL: [-0.2, 0, 0], shR: [0.9, 0, -1.0], elR: [-0.3, 0, 0],
  },
  leap: {
    spine: [-0.2, 0, 0], shL: [-2.6, 0, 0.5], shR: [-2.6, 0, -0.5],
    hipL: [-0.9, 0, 0], knL: [1.3, 0, 0], hipR: [0.5, 0, 0], knR: [0.3, 0, 0],
  },
  dive: {
    neck: [-0.5, 0, 0], shL: [0.45, 0, 0.3], shR: [0.45, 0, -0.3], elL: [-0.1, 0, 0], elR: [-0.1, 0, 0],
    hipL: [0.1, 0, 0.04], knL: [0.15, 0, 0], hipR: [0.05, 0, -0.04], knR: [0.3, 0, 0],
  },
  rise: {
    spine: [-0.25, 0, 0], neck: [-0.2, 0, 0], shL: [0.7, 0, 1.0], shR: [0.7, 0, -1.0], elL: [-0.5, 0, 0], elR: [-0.5, 0, 0],
    hipL: [-0.75, 0, 0.1], knL: [1.4, 0, 0], hipR: [0.35, 0, -0.1], knR: [0.7, 0, 0],
  },
  tuck: {
    spine: [0.7, 0, 0], neck: [0.4, 0, 0], shL: [-1.0, 0, 0.3], shR: [-1.0, 0, -0.3], elL: [-1.9, 0, 0], elR: [-1.9, 0, 0],
    hipL: [-2.0, 0, 0.1], knL: [2.3, 0, 0], hipR: [-2.0, 0, -0.1], knR: [2.3, 0, 0],
  },
  // Corkscrew: arms crossed in, body straight as it spins.
  twist: {
    shL: [-0.9, 0, -0.5], elL: [-1.9, 0, 0], shR: [-0.9, 0, 0.5], elR: [-1.9, 0, 0],
    hipL: [0.1, 0, 0.03], knL: [0.2, 0, 0], hipR: [0, 0, -0.03], knR: [0.1, 0, 0],
  },
  zip: {
    neck: [-0.6, 0, 0], shL: [-2.75, 0, 0.12], shR: [-2.75, 0, -0.12],
    hipL: [0.35, 0, 0], knL: [0.5, 0, 0], hipR: [0.6, 0, 0], knR: [0.9, 0, 0],
  },
};
const JOINTS = ['spine', 'neck', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'knL', 'knR'];

/** Swing pose: hang from one arm, legs sweeping from trailing to kicked forward. */
function swingPose(side, p) {
  const k = (p + 1) / 2; // 0 at the back of the arc, 1 at the front
  const hold = side > 0 ? 'R' : 'L', free = side > 0 ? 'L' : 'R', out = side > 0 ? 1 : -1;
  return {
    spine: [lerp(-0.25, 0.3, k), 0, out * 0.12], neck: [lerp(-0.5, -0.1, k), 0, 0],
    ['sh' + hold]: [-2.95, 0, -out * 0.25], ['el' + hold]: [-0.12, 0, 0],
    ['sh' + free]: [lerp(0.9, -0.4, k), 0, out * 0.7], ['el' + free]: [-0.6, 0, 0],
    ['hip' + free]: [lerp(0.45, -1.3, k), 0, 0], ['kn' + free]: [lerp(1.0, 0.25, k), 0, 0],
    ['hip' + hold]: [lerp(0.7, -0.55, k), 0, 0], ['kn' + hold]: [lerp(1.3, 1.0, k), 0, 0],
  };
}

function makeRope(scene) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 1, 6, 1, true).translate(0, 0.5, 0),
    new THREE.MeshBasicMaterial({ color: ROPE, transparent: true, fog: false })
  );
  mesh.visible = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const dir = new THREE.Vector3();
  return {
    mesh,
    /** Draws the rope from `from` towards `to`, `reach` (0..1) of the way there. */
    set(from, to, reach = 1, opacity = 1) {
      dir.subVectors(to, from);
      const len = dir.length();
      mesh.visible = len > 0.01 && opacity > 0.01;
      mesh.position.copy(from);
      mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
      mesh.scale.set(1, len * reach, 1);
      mesh.material.opacity = opacity;
    },
    hide() { mesh.visible = false; },
  };
}

// ── Hero ─────────────────────────────────────────────────────────────────────
export function createHero(scene, city) {
  const { layout } = city;
  const rig = buildRig();
  scene.add(rig.root);
  const rope = makeRope(scene), oldRope = makeRope(scene);
  const trav = new Traversal(layout);

  const s = {
    mode: 'idle', // idle | launch | travel | zip | land
    site: city.site('home'), // tower we are standing on (null while travelling)
    dest: null, // tower we are heading to (null in free roam)
    roam: false,
    pending: null, // destination requested while we could not turn yet
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), forward: new THREE.Vector3(0, 0, -1),
    yaw: 0, speed: 0,
    curve: null, u: 0, duration: 1, // launch / zip path
    timer: 0, flip: 0, flipping: false, trick: 'flip',
    lastAnchor: new THREE.Vector3(), ropeAge: 0, ropeHand: 'R', oldAge: 1, oldFrom: new THREE.Vector3(), oldTo: new THREE.Vector3(),
    onArrive: null,
  };
  const listeners = [];
  const emit = (name, data) => listeners.forEach((fn) => fn(name, data));

  const perchPos = (site, out = new THREE.Vector3()) => out.set(site.perch.x, site.perch.y + STAND, site.perch.z);
  perchPos(s.site, s.pos);

  const qTarget = new THREE.Quaternion(), basis = new THREE.Matrix4();
  const U = new THREE.Vector3(), F = new THREE.Vector3(), X = new THREE.Vector3();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), hand = new THREE.Vector3(), tan = new THREE.Vector3();
  let pose = POSES.perch, crouchDrop = PERCH_DROP;

  /** Points the body: `up` is head direction, `facing` is roughly where the chest points. */
  function orient(up, facing, rate, dt) {
    U.copy(up).normalize();
    F.copy(facing).addScaledVector(U, -facing.dot(U));
    if (F.lengthSq() < 1e-4) F.set(0, -1, 0).addScaledVector(U, U.y);
    F.normalize();
    X.crossVectors(U, F);
    qTarget.setFromRotationMatrix(basis.makeBasis(X, U, F));
    rig.root.quaternion.slerp(qTarget, rate >= 1 ? 1 : damp(rate, dt));
  }

  function applyPose(dt, rate = 10) {
    const k = damp(rate, dt);
    for (const name of JOINTS) {
      const target = pose[name], r = rig.j[name].rotation;
      r.x += ((target ? target[0] : 0) - r.x) * k;
      r.y += ((target ? target[1] : 0) - r.y) * k;
      r.z += ((target ? target[2] : 0) - r.z) * k;
    }
  }

  function beginLaunch(route, onArrive) {
    s.onArrive = onArrive;
    s.curve = launchCurve(s.site, route, STAND);
    s.u = 0;
    s.duration = clamp((1.5 * s.curve.getLength()) / 55, 1.3, 3.4);
    s.route0 = route;
    s.mode = 'launch';
    s.site = null;
    emit('launch');
  }

  function land(site) {
    s.mode = 'land'; s.timer = 0; s.site = site; s.dest = null; s.roam = false;
    perchPos(site, s.pos);
    s.vel.set(0, 0, 0);
    rope.hide();
    emit('land', site);
    if (s.pending) return; // another trip is queued: leave again without opening anything
    const cb = s.onArrive; s.onArrive = null;
    cb?.(site);
  }

  const api = {
    state: s, object: rig.root, traversal: trav,
    on(fn) { listeners.push(fn); },
    get travelling() { return s.mode !== 'idle' && s.mode !== 'land'; },

    /** Autopilot to a section's tower. */
    goTo(site, onArrive) {
      if (s.mode === 'idle' && s.site === site) { onArrive?.(site); return; }
      s.roam = false;
      if (s.mode === 'idle') {
        s.dest = site;
        beginLaunch(buildRoute(planRoute(s.site.access, site.access)), onArrive);
      } else {
        s.pending = site; s.onArrive = onArrive;
      }
    },

    /** Free roam: keep swinging block to block; drifting left or right picks the turn. */
    roam() {
      if (s.roam) return;
      s.pending = null; s.onArrive = null;
      if (s.mode === 'idle') {
        s.roam = true; s.dest = null;
        const heading = { x: 0, z: s.site.j > 6 ? -1 : 1 }; // head towards the middle of town
        beginLaunch(buildRoute(planRoute(s.site.access, roamTarget(s.site.access, heading, 0), heading)));
      } else if (s.mode === 'travel' || s.mode === 'launch') { s.roam = true; s.dest = null; }
    },

    /** Jump straight to the destination (for visitors in a hurry). */
    skip() {
      const site = s.pending ?? s.dest;
      if (!site || !api.travelling) return;
      s.pending = null;
      oldRope.hide();
      land(site);
      rig.root.quaternion.identity();
    },

    update(dt, t, input) {
      const prev = tmp2.copy(s.pos);

      if (s.mode === 'idle' || s.mode === 'land') {
        const site = s.site;
        perchPos(site, s.pos);
        if (s.mode === 'land') {
          s.timer += dt;
          pose = s.timer < 0.45 ? POSES.crouch : POSES.perch;
          crouchDrop = lerp(crouchDrop, s.timer < 0.45 ? LAND_DROP : PERCH_DROP, damp(12, dt));
          if (s.timer > 0.95) {
            s.mode = 'idle';
            if (s.pending) { const next = s.pending, cb = s.onArrive; s.pending = null; s.onArrive = null; api.goTo(next, cb); }
          }
        } else {
          pose = POSES.perch;
          crouchDrop = lerp(crouchDrop, PERCH_DROP, damp(9, dt));
        }
        s.pos.y -= crouchDrop * SCALE;
        orient(UP, tmp.set(site.out.x, 0, site.out.z), 6, dt);
        rig.j.spine.position.y = 0.06 + Math.sin(t * 1.6) * 0.006; // breathing
        applyPose(dt, 9);
        if (s.mode === 'idle') rig.j.neck.rotation.y = Math.sin(t * 0.45) * 0.45; // scanning the skyline
      } else if (s.mode === 'launch') {
        s.u = Math.min(1, s.u + dt / s.duration);
        const e = s.u ** 1.5;
        s.curve.getPoint(e, s.pos);
        s.curve.getTangent(e, tan);
        pose = s.u < 0.22 ? POSES.leap : POSES.dive;
        const k = clamp((s.u - 0.08) / 0.3, 0, 1);
        orient(F.copy(UP).lerp(tan, k * k * (3 - 2 * k)), tmp.set(tan.x, -0.3, tan.z), 8, dt);
        applyPose(dt, 9);
        if (s.u >= 1) {
          trav.start(s.route0, { ...HANDOFF });
          s.mode = 'travel';
        }
      } else if (s.mode === 'travel') {
        if (s.pending && retarget(trav, s.pending.access)) { s.dest = s.pending; s.pending = null; s.roam = false; emit('reroute', s.dest); }
        if (s.roam) extendRoam(trav, input.x < -0.35 ? -1 : input.x > 0.35 ? 1 : 0);
        trav.step(dt, input);
        trav.position(s.pos);
        trav.route.tangentAt(trav.s, tan);

        for (const ev of trav.events) {
          if (ev === 'attach') { s.ropeAge = 0; s.ropeHand = trav.anchor.side > 0 ? 'R' : 'L'; s.flipping = false; s.flip = 0; }
          if (ev === 'release') {
            s.oldAge = 0; s.oldTo.copy(s.lastAnchor);
            // Some releases get a trick: a forward somersault or a corkscrew.
            s.flipping = trav.vy > 20 && Math.random() < 0.55; s.flip = 0;
            s.trick = Math.random() < 0.55 ? 'flip' : 'twist';
          }
          emit(ev, trav.anchor);
        }

        trav.velocity(tmp);
        if (trav.mode === 'swing') {
          const a = trav.anchor;
          s.lastAnchor.copy(a.point);
          pose = swingPose(a.side, clamp((trav.s - a.s) / a.L, -1, 1));
          orient(U.subVectors(a.point, s.pos), tmp.copy(tan).addScaledVector(UP, -0.2), 12, dt);
        } else {
          const vel = tmp.normalize();
          if (s.flipping) { s.flip = Math.min(1, s.flip + dt / 0.7); pose = s.trick === 'flip' ? POSES.tuck : POSES.twist; if (s.flip >= 1) s.flipping = false; }
          else pose = trav.vy > 4 ? POSES.rise : POSES.dive;
          orient(F.copy(vel).addScaledVector(UP, 0.55), tmp.copy(tan).addScaledVector(UP, -0.3), 7, dt);
        }
        applyPose(dt, 11);

        if (trav.done) {
          if (s.dest) {
            s.curve = zipCurve(s.pos, trav.velocity(tmp), s.dest, STAND);
            s.u = 0; s.duration = clamp(s.curve.getLength() / 62, 1.2, 2.6);
            s.mode = 'zip';
            if (trav.mode === 'swing') { s.oldAge = 0; s.oldTo.copy(trav.anchor.point); }
            s.ropeAge = 0; s.ropeHand = 'R';
            emit('attach', null);
          } else extendRoam(trav, 0);
        }
      } else if (s.mode === 'zip') {
        s.u = Math.min(1, s.u + dt / s.duration);
        const e = 1 - (1 - s.u) ** 1.7;
        s.curve.getPoint(e, s.pos);
        s.curve.getTangent(e, tan);
        pose = s.u > 0.8 ? POSES.tuck : POSES.zip;
        orient(s.u > 0.8 ? UP : tan, tmp.set(-s.dest.out.x, s.u > 0.8 ? 0 : -0.4, -s.dest.out.z), 7, dt);
        applyPose(dt, 9);
        if (s.u >= 1) land(s.dest);
      }

      // Somersault after some releases.
      const flipAngle = s.flipping ? (s.flip * s.flip * (3 - 2 * s.flip)) * Math.PI * 2 : 0;
      rig.body.rotation.x = s.trick === 'flip' ? flipAngle : 0;
      rig.body.rotation.y = s.trick === 'twist' ? flipAngle : 0;

      rig.root.position.copy(s.pos);
      if (dt > 0) s.vel.subVectors(s.pos, prev).divideScalar(dt);
      s.speed = s.vel.length();
      if (s.speed > 2) { s.forward.copy(s.vel).setY(0).normalize(); s.yaw = Math.atan2(-s.forward.x, -s.forward.z); }
      rig.root.updateMatrixWorld(true);

      // Grapple line.
      const swinging = s.mode === 'travel' && trav.mode === 'swing';
      const zipping = s.mode === 'zip' && s.u < 0.72;
      if (swinging || zipping) {
        s.ropeAge += dt;
        rig.hands[s.ropeHand].getWorldPosition(hand);
        const to = swinging ? trav.anchor.point : tmp.set(s.dest.edge.x, s.dest.edge.y, s.dest.edge.z);
        rope.set(hand, to, clamp(s.ropeAge / 0.09, 0, 1));
        s.oldFrom.copy(hand);
      } else rope.hide();
      // The line you just let go of lingers for a moment, falling slack.
      if (s.oldAge < 0.45) {
        s.oldAge += dt;
        s.oldFrom.y -= 22 * dt;
        oldRope.set(s.oldFrom, s.oldTo, 1, 1 - s.oldAge / 0.45);
      } else oldRope.hide();
    },

    /** Where the camera would like to be, and what it should look at. */
    view(outPos, outLook, t, portrait) {
      const far = portrait ? 1.45 : 1;
      if (s.mode === 'travel') {
        trav.route.tangentAt(trav.s, tan);
        trav.route.pointAt(trav.s - 10 * far, outPos);
        trav.route.tangentAt(trav.s - 10 * far, tmp);
        outPos.x += -tmp.z * trav.lat * 0.6; outPos.z += tmp.x * trav.lat * 0.6;
        outPos.y = Math.max(5, trav.y + 2.6 * far - trav.vy * 0.04);
        outLook.copy(s.pos).addScaledVector(tan, 14).y += 1.4;
      } else if (s.mode === 'launch') {
        // Follow the dive from behind and above.
        const a = s.curve.v0, b = s.curve.v3;
        tmp.set(b.x - a.x, 0, b.z - a.z).normalize();
        outPos.copy(s.pos).addScaledVector(tmp, -9 * far).y += 5;
        outLook.copy(s.pos).addScaledVector(tmp, 8).y -= 2;
      } else if (s.mode === 'zip') {
        // Stand off from the tower and watch the hero rise up its face onto the roof.
        const o = s.dest.out;
        outPos.copy(s.pos).add(tmp.set(o.x * 11 * far + o.z * 7, -1.5, o.z * 11 * far - o.x * 7));
        outLook.copy(s.pos).y += 1.5;
      } else {
        // On a roof: behind the hero's shoulder, looking out over the city they are watching.
        const site = s.site, a = -(Math.sin(t * 0.11) * 0.1 + 0.2); // slightly to one side, so the hero sits left of centre
        const ix = -site.out.x * Math.cos(a) + site.out.z * Math.sin(a), iz = -site.out.x * Math.sin(a) - site.out.z * Math.cos(a);
        perchPos(site, outPos);
        outPos.y -= PERCH_DROP * SCALE;
        outLook.copy(outPos).add(tmp.set(site.out.x * 40, -6, site.out.z * 40));
        outPos.add(tmp.set(ix * 5.2 * far, 1.9, iz * 5.2 * far));
      }
    },
  };
  return api;
}

export { TUNING };
