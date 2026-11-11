// Swing physics. The hero follows a route along the streets; this module
// simulates the vertical pendulum motion along it: free fall, rope attach, swing,
// release. It has no rendering in it, so tests can run thousands of trips headlessly.
//
// Coordinates: `s` is distance along the route, `y` is height, `lat` is the
// sideways offset from the street's centre line. The rope constraint is solved
// in the (s, y) plane, which is what guarantees the hero stays over the street.
import * as THREE from 'three';
import { STREET } from './layout.js';

export const TUNING = {
  gravity: 36,
  cruise: 56, // m/s
  boost: 80,
  ceiling: 50, // ropes only go out below this height, which keeps the hero in the streets
  minHeight: 13, // lowest the bottom of a swing may go
  ropeRise: 34, // how far above the hero a rope aims
  release: 0.8, // radians past vertical
  drift: 9, // max sideways offset the player can steer to
  arrive: 26, // metres before the route's end where the swing hands over
};

const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3();

export class Traversal {
  constructor(layout) {
    this.layout = layout;
    this.route = null;
    this.mode = 'air'; // 'air' | 'swing'
    this.s = 0; this.y = 0; this.vs = 0; this.vy = 0; this.lat = 0;
    this.anchor = null; // { s, y, side, L, point: Vector3 }
    this.side = 1;
    this.swingTime = 0;
    this.events = [];
  }

  start(route, { s = 0, y, vs, vy = 0, lat = 0 }) {
    Object.assign(this, { route, s, y, vs, vy, lat, mode: 'air', anchor: null });
  }

  /** Swap to a new route that begins exactly where the hero is now. */
  reroute(route) {
    if (this.anchor) this.anchor.s -= this.s;
    this.route = route;
    this.s = 0;
  }

  get done() { return this.s >= this.route.length - TUNING.arrive; }
  get speed() { return Math.hypot(this.vs, this.vy); }

  position(out = new THREE.Vector3()) {
    this.route.pointAt(this.s, out);
    this.route.tangentAt(this.s, tmpT);
    out.x += -tmpT.z * this.lat; out.z += tmpT.x * this.lat;
    out.y = this.y;
    return out;
  }

  /** World-space velocity. */
  velocity(out = new THREE.Vector3()) {
    this.route.tangentAt(this.s, out).multiplyScalar(this.vs);
    out.y = this.vy;
    return out;
  }

  /** Finds a point on a real building face to hang a rope from. */
  findAnchor() {
    const { route, layout } = this;
    const lead = 18 + this.vs * 0.3;
    const reach = STREET / 2;
    for (const shift of [0, 8, -8, 16, -14]) {
      const as = this.s + lead + shift;
      if (as < this.s + 6) continue;
      route.pointAt(as, tmpP); route.tangentAt(as, tmpT);
      for (const side of [this.side, -this.side]) {
        const rx = -tmpT.z * side, rz = tmpT.x * side;
        // Probe just inside the facade line, then find where the wall really is.
        let roof = 0, depth = 0;
        for (depth = reach + 1; depth <= reach + 5; depth += 1) {
          roof = layout.roofAt(tmpP.x + rx * depth, tmpP.z + rz * depth);
          if (roof) break;
        }
        if (roof < this.y + 14) continue;
        const ay = Math.min(this.y + TUNING.ropeRise, roof - 1, TUNING.ceiling + 30);
        const point = new THREE.Vector3(tmpP.x + rx * (depth - 0.5), ay, tmpP.z + rz * (depth - 0.5));
        return { s: as, y: ay, side, point, L: Math.hypot(as - this.s, ay - this.y) };
      }
    }
    return null;
  }

  step(dt, input = { x: 0, boost: false }) {
    const T = TUNING;
    this.events.length = 0;
    const target = input.boost ? T.boost : T.cruise;
    this.lat += (input.x * T.drift - this.lat) * (1 - Math.exp(-2.2 * dt));

    this.vy -= T.gravity * dt;

    if (this.mode === 'air') {
      if (this.vs < target * 0.7) this.vs += 26 * dt;
      if ((this.vy < -8 && this.y < T.ceiling) || this.y < T.minHeight + 14) {
        let a = this.findAnchor();
        // Nothing in reach and the street is coming up: hang from thin air rather than land.
        if (!a && this.y < T.minHeight + 10) {
          const as = this.s + 24, ay = this.y + 30;
          this.route.pointAt(as, tmpP);
          a = { s: as, y: ay, side: this.side, point: new THREE.Vector3(tmpP.x, ay, tmpP.z), L: Math.hypot(24, 30), virtual: true };
        }
        if (a) {
          this.anchor = a; this.mode = 'swing'; this.swingTime = 0;
          this.side = -a.side;
          this.events.push('attach');
        }
      }
    } else {
      this.swingTime += dt;
      const sp = this.speed;
      if (sp > 1e-3) {
        const push = sp < target ? 30 : sp > target * 1.12 ? -18 : 0;
        this.vs += (this.vs / sp) * push * dt;
        this.vy += (this.vy / sp) * push * dt;
      }
    }

    this.s += this.vs * dt;
    this.y += this.vy * dt;

    if (this.mode === 'swing') {
      const a = this.anchor;
      // Reel in if the bottom of the arc would dip too close to the street.
      if (a.y - a.L < T.minHeight) a.L = Math.max(a.y - T.minHeight, a.L - 45 * dt, 6);
      let dx = this.s - a.s, dy = this.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > a.L) {
        dx /= d; dy /= d;
        this.s = a.s + dx * a.L; this.y = a.y + dy * a.L;
        const vr = this.vs * dx + this.vy * dy;
        if (vr > 0) { this.vs -= vr * dx; this.vy -= vr * dy; }
      }
      const angle = Math.atan2(this.s - a.s, a.y - this.y);
      const past = this.s > a.s;
      if ((past && (angle > T.release || this.vy <= 0)) || this.swingTime > 4) {
        this.mode = 'air'; this.anchor = null;
        this.vy += 3;
        this.events.push('release');
      }
    }

    // Never stall, never reverse, never touch the street.
    if (this.vs < 14) this.vs = 14;
    if (this.y < T.minHeight - 3) { this.y = T.minHeight - 3; if (this.vy < 0) this.vy = 0; }
  }
}

// ── Leaving and reaching rooftops ────────────────────────────────────────────
export const HANDOFF = { s: 22, y: 44, vs: 42, vy: -34 }; // the end of the dive off the roof

/** The leap from a tower's perch down into the street, joining `route` at HANDOFF. */
export function launchCurve(site, route, standHeight = 0) {
  const p0 = new THREE.Vector3(site.perch.x, site.perch.y + standHeight, site.perch.z);
  const p3 = route.pointAt(HANDOFF.s); p3.y = HANDOFF.y;
  const t = route.tangentAt(HANDOFF.s);
  const p1 = p0.clone().add(new THREE.Vector3(site.out.x * 24, 16, site.out.z * 24));
  const p2 = p3.clone().addScaledVector(t, -20); p2.y += 16;
  return new THREE.CubicBezierCurve3(p0, p1, p2, p3);
}

/** The final pull from the street up onto a tower's perch. */
export function zipCurve(pos, vel, site, standHeight = 0) {
  const p3 = new THREE.Vector3(site.perch.x, site.perch.y + standHeight, site.perch.z);
  const p1 = pos.clone().addScaledVector(vel, 0.3);
  p1.y = Math.max(p1.y, pos.y);
  const p2 = new THREE.Vector3(site.edge.x + site.out.x * 12, site.edge.y + 45, site.edge.z + site.out.z * 12);
  return new THREE.CubicBezierCurve3(pos.clone(), p1, p2, p3);
}

// ── Changing course mid-swing ────────────────────────────────────────────────
import { planRoute, roamTarget, roomAhead } from './layout.js';
import { buildRoute } from './route.js';

/**
 * Re-plans from where the hero is now to a new street point. Returns false when
 * there is no room to turn smoothly yet (mid-corner, or too close to the next
 * intersection); the caller simply tries again next frame.
 */
export function retarget(trav, to) {
  if (trav.route.straightAhead(trav.s) < 1) return false;
  const p = trav.route.pointAt(trav.s), t = trav.route.tangentAt(trav.s);
  const h = { x: Math.round(t.x), z: Math.round(t.z) }, here = { x: p.x, z: p.z };
  if (roomAhead(here, h) < 36) return false;
  trav.reroute(buildRoute(planRoute(here, to, h)));
  return true;
}

/** Free roam: when the current route is nearly used up, extend it a block in the chosen direction. */
export function extendRoam(trav, choice = 0) {
  if (trav.route.length - trav.s > 44 || trav.route.straightAhead(trav.s) < 1) return false;
  const p = trav.route.pointAt(trav.s), t = trav.route.tangentAt(trav.s);
  const h = { x: Math.round(t.x), z: Math.round(t.z) }, here = { x: p.x, z: p.z };
  trav.reroute(buildRoute(planRoute(here, roamTarget(here, h, choice), h)));
  return true;
}
