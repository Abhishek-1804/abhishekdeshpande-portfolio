// Headless checks of the city layout, route planner and swing physics.
// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateLayout, planRoute, roamTarget, roomAhead, streetLine, CORE_LINES, HALF, PITCH, STREET, N } from '../src/sim/layout.js';
import { buildRoute } from '../src/sim/route.js';
import { Traversal, TUNING, HANDOFF, launchCurve, zipCurve, retarget, extendRoam } from '../src/sim/traverse.js';
import { rng } from '../src/sim/random.js';

const layout = generateLayout();
const STAND = 1.4;
const pairs = layout.sites.flatMap((a) => layout.sites.filter((b) => b !== a).map((b) => [a, b]));
const onStreet = (p) => [p.x, p.z].some((v) => Math.abs(((v + HALF) / PITCH) - Math.round((v + HALF) / PITCH)) < 1e-6);
const lo = streetLine(CORE_LINES[0]) - 1e-6, hi = streetLine(CORE_LINES[1]) + 1e-6;

function checkPlan(plan, from, to, heading) {
  assert.deepEqual(plan[0], from);
  assert.deepEqual(plan.at(-1), to);
  let prev = heading;
  for (let i = 1; i < plan.length; i++) {
    const a = plan[i - 1], b = plan[i];
    assert.ok(onStreet(a) && onStreet(b), 'waypoints are on streets');
    assert.ok(a.x >= lo && a.x <= hi && a.z >= lo && a.z <= hi, 'route stays in the core');
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    assert.ok(len > 1, 'no zero-length legs');
    assert.ok(Math.abs(dx) < 1e-6 || Math.abs(dz) < 1e-6, 'legs are axis-aligned');
    const d = { x: dx / len, z: dz / len };
    if (prev) assert.ok(d.x * prev.x + d.z * prev.z > -0.5, 'route never doubles back');
    prev = d;
  }
}

/** Runs one trip and checks every frame. Returns stats. */
function fly(trav, { dt, input = () => ({ x: 0, boost: false }), maxTime = 120, until = () => trav.done, each }) {
  const pos = new THREE.Vector3();
  let t = 0, swings = 0, virtual = 0, low = Infinity, high = -Infinity;
  while (!until(t)) {
    trav.step(dt, input(t));
    t += dt;
    each?.(t);
    assert.ok(t < maxTime, `trip finishes in time (stuck at s=${trav.s.toFixed(1)} of ${trav.route.length.toFixed(1)})`);
    for (const v of [trav.s, trav.y, trav.vs, trav.vy, trav.lat]) assert.ok(Number.isFinite(v), 'state stays finite');
    assert.ok(trav.vs > 0, 'always moving forward');
    assert.ok(trav.y >= TUNING.minHeight - 3 - 1e-6, `stays above the street (y=${trav.y.toFixed(2)})`);
    trav.position(pos);
    assert.equal(layout.heightAt(pos.x, pos.z), 0, `never inside a building footprint (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
    assert.ok(Math.abs(trav.lat) <= TUNING.drift + 1e-6, 'drift is bounded');
    if (trav.mode === 'swing') {
      const a = trav.anchor;
      assert.ok(Math.hypot(trav.s - a.s, trav.y - a.y) <= a.L + 1e-6, 'rope never stretches');
    }
    if (trav.events.includes('attach')) {
      swings++;
      const a = trav.anchor;
      if (a.virtual) virtual++;
      else {
        // The rope end must be on a real wall: solid just behind it, at least as tall as the anchor.
        const c = trav.route.pointAt(a.s), tan = trav.route.tangentAt(a.s);
        const rx = -tan.z * a.side, rz = tan.x * a.side;
        const behind = layout.roofAt(a.point.x + rx, a.point.z + rz);
        assert.ok(behind >= a.y, `anchor is on a building (roof ${behind.toFixed(1)}, anchor ${a.y.toFixed(1)})`);
        assert.ok(Math.hypot(a.point.x - c.x, a.point.z - c.z) >= STREET / 2, 'anchor is off the roadway');
      }
    }
    low = Math.min(low, trav.y); high = Math.max(high, trav.y);
  }
  return { t, swings, virtual, low, high };
}

test('layout: towers, streets and lookups are consistent', () => {
  assert.equal(layout.sites.length, 9);
  for (const s of layout.sites) {
    assert.ok(onStreet(s.access), `${s.id} access point is on a street`);
    assert.equal(layout.heightAt(s.access.x, s.access.z), 0);
    assert.equal(layout.heightAt(s.perch.x, s.perch.z), s.h, `${s.id} perch is on its roof`);
  }
  for (let k = 0; k <= N; k++) for (let v = -HALF; v <= HALF; v += 7) {
    for (const off of [-STREET / 2 + 0.01, 0, STREET / 2 - 0.01]) {
      assert.equal(layout.heightAt(streetLine(k) + off, v), 0, 'streets are clear');
      assert.equal(layout.heightAt(v, streetLine(k) + off), 0, 'streets are clear');
    }
  }
  for (const b of layout.buildings) assert.ok(b.w > 5 && b.d > 5 && b.h > 5, 'no degenerate buildings');
});

test('routes: every tower-to-tower plan is valid', () => {
  for (const [a, b] of pairs) checkPlan(planRoute(a.access, b.access), a.access, b.access, null);
});

test('routes: plans respect the current heading from anywhere', () => {
  const rand = rng(7);
  for (let n = 0; n < 400; n++) {
    const k = CORE_LINES[0] + Math.floor(rand() * 10), l = CORE_LINES[0] + Math.floor(rand() * 9);
    const vertical = rand() < 0.5, sign = rand() < 0.5 ? 1 : -1;
    // Distance past the intersection behind us. Includes points a hair past it, which once
    // confused the planner; re-routing always leaves at least 36 m before the next one.
    const past = n % 5 === 0 ? 0.2 + rand() * 0.4 : 1 + rand() * (PITCH - 37);
    const along = sign > 0 ? streetLine(l) + past : streetLine(l + 1) - past;
    const from = vertical ? { x: streetLine(k), z: along } : { x: along, z: streetLine(k) };
    const heading = vertical ? { x: 0, z: sign } : { x: sign, z: 0 };
    const to = layout.sites[Math.floor(rand() * layout.sites.length)].access;
    if (Math.hypot(to.x - from.x, to.z - from.z) < 1) continue;
    assert.ok(Math.abs(roomAhead(from, heading) - (PITCH - past)) < 1e-6, 'roomAhead measures to the next intersection');
    checkPlan(planRoute(from, to, heading), from, to, heading);
  }
});

test('route curves: length and continuity', () => {
  for (const [a, b] of pairs) {
    const r = buildRoute(planRoute(a.access, b.access));
    assert.ok(r.length > 50);
    let prev = r.pointAt(0);
    for (let s = 1; s <= r.length; s += 1) {
      const p = r.pointAt(s);
      assert.ok(p.distanceTo(prev) < 1.2, 'no jumps along the path');
      assert.equal(layout.heightAt(p.x, p.z), 0, 'path centre line is over streets');
      prev = p;
    }
  }
});

for (const dt of [1 / 144, 1 / 60, 1 / 30, 1 / 20]) {
  test(`swing physics: all ${pairs.length} trips arrive safely at ${Math.round(1 / dt)} fps`, () => {
    let virtual = 0;
    for (const [a, b] of pairs) {
      const route = buildRoute(planRoute(a.access, b.access));
      const trav = new Traversal(layout);
      trav.start(route, HANDOFF);
      const r = fly(trav, { dt, maxTime: route.length / 20 + 10 });
      virtual += r.virtual;
      assert.ok(r.swings >= 1, 'at least one swing per trip');
      assert.ok(r.high < 120, `swings stay at street level (peak ${r.high.toFixed(1)})`);
      const avg = (route.length - HANDOFF.s) / r.t;
      assert.ok(avg > 28 && avg < 80, `average speed is sensible (${avg.toFixed(1)} m/s)`);
    }
    assert.equal(virtual, 0, 'every rope found a real building');
  });
}

test('swing physics: hard steering and boost stay safe', () => {
  const rand = rng(3);
  for (const [a, b] of pairs) {
    const route = buildRoute(planRoute(a.access, b.access));
    const trav = new Traversal(layout);
    trav.start(route, HANDOFF);
    let x = 0, boost = false, next = 0;
    fly(trav, {
      dt: 1 / 60, maxTime: route.length / 20 + 10,
      input: (t) => { if (t >= next) { next = t + rand() * 1.5; x = [-1, 0, 1][Math.floor(rand() * 3)]; boost = rand() < 0.5; } return { x, boost }; },
    });
  }
});

test('rooftops: launch and landing curves clear every building', () => {
  for (const [a, b] of pairs) {
    const route = buildRoute(planRoute(a.access, b.access));
    const launch = launchCurve(a, route, STAND);
    for (let i = 1; i <= 60; i++) {
      const p = launch.getPoint(i / 60);
      assert.ok(p.y > layout.heightAt(p.x, p.z) + 0.5, `launch from ${a.id} clears buildings`);
    }
    const end = launch.getPoint(1);
    assert.ok(end.distanceTo(route.pointAt(HANDOFF.s).setY(HANDOFF.y)) < 1e-6, 'launch ends at the handoff point');

    const trav = new Traversal(layout);
    trav.start(route, HANDOFF);
    fly(trav, { dt: 1 / 60 });
    const zip = zipCurve(trav.position(), trav.velocity(), b, STAND);
    for (let i = 0; i < 60; i++) {
      const p = zip.getPoint(i / 60);
      assert.ok(p.y > layout.heightAt(p.x, p.z) + 0.5, `landing on ${b.id} clears buildings (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`);
    }
    const perch = zip.getPoint(1);
    assert.ok(Math.abs(perch.y - (b.h + STAND)) < 1e-6 && layout.heightAt(perch.x, perch.z) === b.h, 'landing ends on the roof');
  }
});

test('changing destination mid-swing keeps the hero on course', () => {
  const rand = rng(11);
  for (let n = 0; n < 60; n++) {
    const a = layout.sites[Math.floor(rand() * 9)];
    let b = layout.sites[Math.floor(rand() * 9)];
    if (b === a) continue;
    const trav = new Traversal(layout);
    trav.start(buildRoute(planRoute(a.access, b.access)), HANDOFF);
    let changeAt = 1 + rand() * 6, pending = null;
    const before = new THREE.Vector3(), after = new THREE.Vector3();
    fly(trav, {
      dt: 1 / 60, maxTime: 200,
      each: (t) => {
        if (!pending && t >= changeAt && !trav.done) { pending = layout.sites[Math.floor(rand() * 9)]; changeAt = Infinity; }
        if (pending && !trav.done) {
          trav.position(before);
          if (retarget(trav, pending.access)) {
            assert.ok(trav.position(after).distanceTo(before) < 1e-3, 'no teleport when re-routing');
            b = pending; pending = null;
          }
        }
      },
    });
    const end = trav.route.pointAt(trav.route.length);
    assert.ok(Math.hypot(end.x - b.access.x, end.z - b.access.z) < 1e-6, 'arrives at the latest destination');
  }
});

test('free roam: two minutes of random turns stays in the city and out of walls', () => {
  const rand = rng(5);
  for (const start of layout.sites) {
    const first = roamTarget(start.access, { x: 0, z: -1 }, 0);
    const trav = new Traversal(layout);
    trav.start(buildRoute(planRoute(start.access, first, { x: 0, z: -1 })), HANDOFF);
    const pos = new THREE.Vector3();
    let extended = 0;
    fly(trav, {
      dt: 1 / 60, maxTime: 121, until: (t) => t >= 120,
      input: () => ({ x: 0, boost: rand() < 0.3 }),
      each: () => {
        if (extendRoam(trav, [-1, 0, 0, 1][Math.floor(rand() * 4)])) extended++;
        assert.ok(!trav.done, 'free roam never runs out of route');
        trav.position(pos);
        assert.ok(pos.x > lo - 15 && pos.x < hi + 15 && pos.z > lo - 15 && pos.z < hi + 15, 'stays in the core');
      },
    });
    assert.ok(extended > 10, 'keeps extending the route');
  }
});
