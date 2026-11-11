// The city as plain data: street grid, building lots, section towers and route planning.
// No rendering here, so the test suite can load and check it directly.
import { rng } from './random.js';

export const N = 13; // blocks per side
export const BLOCK = 84; // metres
export const STREET = 28;
export const PITCH = BLOCK + STREET;
export const HALF = (N * PITCH) / 2;
// The hero only travels the inner streets; the outer rings are skyline filler.
export const CORE_LINES = [2, 11];
export const TOWER = 56; // footprint of a section tower

/** Centre line of street k (0..N). Block i lies between lines i and i+1. */
export const streetLine = (k) => k * PITCH - HALF;
export const blockCenter = (i) => (i + 0.5) * PITCH - HALF;

// Which block each tower stands on: [x index, z index, height].
export const SITE_BLOCKS = {
  home: [6, 10, 112],
  about: [6, 7, 150],
  experience: [9, 8, 188],
  projects: [10, 5, 142],
  skills: [8, 2, 170],
  opensource: [5, 3, 134],
  education: [2, 3, 158],
  blog: [2, 7, 128],
  contact: [3, 9, 146],
};

// A strip of park three blocks long (no buildings; trees and lawns instead).
export const PARK_BLOCKS = [[4, 5], [4, 6], [4, 7]];

// Facade families, each with its own palette. The index is the shader's style id.
export const STYLES = ['brick', 'stone', 'glass', 'modern'];
const PALETTES = [
  [[0.44, 0.21, 0.16], [0.52, 0.28, 0.2], [0.36, 0.19, 0.15], [0.56, 0.4, 0.3], [0.62, 0.5, 0.4], [0.33, 0.24, 0.2]],
  [[0.74, 0.69, 0.6], [0.64, 0.61, 0.56], [0.8, 0.74, 0.63], [0.56, 0.54, 0.5], [0.7, 0.62, 0.52]],
  [[0.3, 0.45, 0.56], [0.26, 0.36, 0.46], [0.42, 0.5, 0.52], [0.2, 0.26, 0.32], [0.36, 0.5, 0.5]],
  [[0.86, 0.85, 0.82], [0.72, 0.72, 0.7], [0.8, 0.76, 0.7]],
];

function split(total, parts, rand, min) {
  const cuts = Array.from({ length: parts }, () => 0.6 + rand());
  const sum = cuts.reduce((a, b) => a + b, 0);
  let sizes = cuts.map((c) => (c / sum) * total);
  if (sizes.some((s) => s < min)) sizes = sizes.map(() => total / parts);
  return sizes;
}

export function generateLayout(seed = 42) {
  const rand = rng(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const buildings = []; // every box to draw: { x, z, w, d, y0, h, seed, tint, style, site }
  const spires = []; // pointed crowns: { x, z, y, w, h }
  const waterTowers = []; // { x, y, z }
  const roofBoxes = []; // bulkheads and plant rooms: { x, y, z, w, h, d }
  const lots = []; // lots[i][j] = base footprints (roof-edge height, used for rope anchors)
  const solids = []; // solids[i][j] = every solid box incl. upper tiers (used for collision checks)
  const siteAt = new Map(Object.entries(SITE_BLOCKS).map(([id, [i, j, h]]) => [`${i},${j}`, { id, i, j, h }]));
  const parks = new Set(PARK_BLOCKS.map(([i, j]) => `${i},${j}`));
  const sites = [];

  for (let i = 0; i < N; i++) {
    lots.push([]); solids.push([]);
    for (let j = 0; j < N; j++) {
      const base = [], all = [];
      lots[i].push(base); solids[i].push(all);
      const cx = blockCenter(i), cz = blockCenter(j);
      if (parks.has(`${i},${j}`)) continue;
      const site = siteAt.get(`${i},${j}`);
      if (site) {
        const h = site.h, half = TOWER / 2;
        const rect = { x0: cx - half, x1: cx + half, z0: cz - half, z1: cz + half, h };
        base.push(rect); all.push(rect);
        buildings.push({ x: cx, z: cz, w: TOWER, d: TOWER, y0: 0, h, seed: rand(), tint: [0.16, 0.2, 0.25], style: 2, site: site.id });
        sites.push({
          id: site.id, i, j, x: cx, z: cz, h,
          out: { x: -1, z: 0 }, // every tower is approached from its west street
          perch: { x: cx - half + 1.3, y: h, z: cz }, // right on the ledge
          edge: { x: cx - half, y: h, z: cz },
          access: { x: streetLine(i), z: cz },
        });
        continue;
      }
      const ring = Math.min(i, j, N - 1 - i, N - 1 - j); // 0 = outermost
      const dist = Math.hypot(cx, cz);
      const counts = ring === 0 ? [2, 2, 3] : [2, 3, 3, 4];
      const ws = split(BLOCK, pick(counts), rand, 18), ds = split(BLOCK, pick(counts), rand, 18);
      let x = cx - BLOCK / 2;
      for (const w of ws) {
        let z = cz - BLOCK / 2;
        for (const d of ds) {
          const inset = 0.6 + rand() * 1.6;
          let h;
          if (ring === 0) h = 16 + rand() * 30;
          else if (ring === 1) h = 48 + rand() * 34;
          else {
            h = (150 - 95 * Math.min(1, dist / 480)) * (0.42 + rand() * 0.95);
            if (rand() < 0.07) h *= 1.6;
            h = Math.min(250, Math.max(48, h));
          }
          const r = rand();
          const style = h > 115 ? (r < 0.5 ? 2 : r < 0.9 ? 1 : 3) : h > 62 ? (r < 0.4 ? 1 : r < 0.68 ? 0 : r < 0.88 ? 2 : 3) : (r < 0.62 ? 0 : r < 0.86 ? 1 : 3);
          const rect = { x0: x + inset, x1: x + w - inset, z0: z + inset, z1: z + d - inset, h };
          base.push(rect); all.push(rect);
          const bSeed = rand(), tint = pick(PALETTES[style]);
          const bx = (rect.x0 + rect.x1) / 2, bz = (rect.z0 + rect.z1) / 2;
          let bw = rect.x1 - rect.x0, bd = rect.z1 - rect.z0;
          buildings.push({ x: bx, z: bz, w: bw, d: bd, y0: 0, h, seed: bSeed, tint, style });
          // Masonry towers step back like a wedding cake; glass ones mostly rise sheer.
          let top = h;
          const maxTiers = style === 2 || style === 3 ? 1 : 3, chance = style === 2 ? 0.3 : 0.75;
          for (let tier = 0; tier < maxTiers && h > 70 && Math.min(bw, bd) > 14 && rand() < chance; tier++) {
            bw *= 0.7 + rand() * 0.14; bd *= 0.7 + rand() * 0.14;
            const th = h * (0.14 + rand() * 0.2);
            buildings.push({ x: bx, z: bz, w: bw, d: bd, y0: top, h: th, seed: bSeed, tint, style });
            all.push({ x0: bx - bw / 2, x1: bx + bw / 2, z0: bz - bd / 2, z1: bz + bd / 2, h: top + th });
            top += th;
          }
          // What sits on the roof.
          if (top > 105 && style === 1 && rand() < 0.7) {
            const sw = Math.min(bw, bd) * 0.62;
            spires.push({ x: bx, z: bz, y: top, w: sw, h: sw * (1.1 + rand() * 1.6) });
          } else if (top > 120 && style === 2 && rand() < 0.5) {
            spires.push({ x: bx + (rand() - 0.5) * bw * 0.3, z: bz + (rand() - 0.5) * bd * 0.3, y: top, w: 0.9, h: 18 + rand() * 26 });
          } else {
            if (top < 120 && style !== 2 && Math.min(bw, bd) > 12 && rand() < 0.6) {
              waterTowers.push({ x: bx + (rand() - 0.5) * (bw - 9), y: top, z: bz + (rand() - 0.5) * (bd - 9) });
            }
            const n = 1 + Math.floor(rand() * 2);
            for (let k = 0; k < n; k++) {
              const rw = 3 + rand() * Math.min(7, bw * 0.3), rd = 3 + rand() * Math.min(7, bd * 0.3);
              roofBoxes.push({ x: bx + (rand() - 0.5) * (bw - rw - 2), y: top, z: bz + (rand() - 0.5) * (bd - rd - 2), w: rw, h: 2.2 + rand() * 2.4, d: rd });
            }
          }
          z += d;
        }
        x += w;
      }
    }
  }

  const lookup = (grid) => (x, z) => {
    const i = Math.floor((x + HALF) / PITCH), j = Math.floor((z + HALF) / PITCH);
    if (i < 0 || j < 0 || i >= N || j >= N) return 0;
    let h = 0;
    for (const r of grid[i][j]) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && r.h > h) h = r.h;
    return h;
  };

  return {
    buildings, sites, spires, waterTowers, roofBoxes,
    site: (id) => sites.find((s) => s.id === id),
    /** Height of whatever is solid at (x, z); 0 over streets and plazas. */
    heightAt: lookup(solids),
    /** Roof-edge height of the building whose footprint contains (x, z). */
    roofAt: lookup(lots),
  };
}

// ── Route planning ───────────────────────────────────────────────────────────
// Routes run along street centre lines. A plan is a list of {x, z} waypoints:
// straight runs joined by right-angle turns, never doubling back on itself.
const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const [K0, K1] = CORE_LINES;
const lineIndex = (v, tolerance = 0.5) => {
  const k = Math.round((v + HALF) / PITCH);
  return Math.abs(streetLine(k) - v) < tolerance ? k : -1;
};

/** The intersections at either end of the street segment a point sits on. */
function segmentEnds(p) {
  // A point just past an intersection is within tolerance of both lines; the
  // line it sits on exactly tells us which street it is travelling along.
  const exactX = lineIndex(p.x, 1e-3), exactZ = lineIndex(p.z, 1e-3);
  if (exactX >= 0 && exactZ >= 0) return [{ k: exactX, l: exactZ }];
  const kx = exactX >= 0 ? exactX : exactZ >= 0 ? -1 : lineIndex(p.x);
  const kz = exactZ >= 0 ? exactZ : exactX >= 0 ? -1 : lineIndex(p.z);
  if (kx >= 0) { const l = Math.floor((p.z + HALF) / PITCH); return [{ k: kx, l }, { k: kx, l: l + 1 }]; }
  if (kz >= 0) { const k = Math.floor((p.x + HALF) / PITCH); return [{ k, l: kz }, { k: k + 1, l: kz }]; }
  throw new Error(`Point (${p.x}, ${p.z}) is not on a street`);
}
const nodePoint = (n) => ({ x: streetLine(n.k), z: streetLine(n.l) });
const isPark = (i, j) => PARK_BLOCKS.some(([pi, pj]) => pi === i && pj === j);
/**
 * A street stretch with park on both sides has nothing to hang a rope from,
 * so routes go around it. (k, l) is the intersection, d the direction of travel.
 */
function openStretch(k, l, d) {
  if (d.x) { const i = d.x > 0 ? k : k - 1; return isPark(i, l - 1) && isPark(i, l); }
  const j = d.z > 0 ? l : l - 1;
  return isPark(k - 1, j) && isPark(k, j);
}
const dirBetween = (a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
  return len < 1e-6 ? null : { x: dx / len, z: dz / len };
};
const dot = (a, b) => a.x * b.x + a.z * b.z;

/**
 * Plans a route between two street points. `heading` (optional unit vector) is
 * the current direction of travel; the route never starts by reversing it.
 */
export function planRoute(from, to, heading = null) {
  // Same stretch of street, already facing the right way: go straight there.
  const direct = dirBetween(from, to);
  if (direct && (Math.abs(direct.x) < 1e-6 || Math.abs(direct.z) < 1e-6)) {
    const sameLine = Math.abs(direct.x) < 1e-6 ? lineIndex(from.x) >= 0 : lineIndex(from.z) >= 0;
    if (sameLine && (!heading || dot(direct, heading) > 0.5)) return [from, to];
  }

  // Dijkstra over (intersection, direction of arrival) so U-turns can be forbidden.
  const size = K1 - K0 + 1;
  const id = (k, l, d) => (((k - K0) * size + (l - K0)) * 4 + d);
  const cost = new Float64Array(size * size * 4).fill(Infinity);
  const prev = new Int32Array(size * size * 4).fill(-1);
  const done = new Uint8Array(size * size * 4);
  const inCore = (n) => n.k >= K0 && n.k <= K1 && n.l >= K0 && n.l <= K1;

  for (const n of segmentEnds(from)) {
    if (!inCore(n)) continue;
    const p = nodePoint(n), d = dirBetween(from, p);
    if (!d) { // starting exactly on an intersection
      DIRS.forEach((dir, di) => { if (!heading || dot(dir, heading) > -0.5) cost[id(n.k, n.l, di)] = 0; });
      continue;
    }
    if (heading && dot(d, heading) < 0.5) continue;
    const di = DIRS.findIndex((dir) => dot(dir, d) > 0.99);
    cost[id(n.k, n.l, di)] = Math.hypot(p.x - from.x, p.z - from.z);
  }

  const goals = new Map(); // state id -> remaining distance to `to`
  for (const n of segmentEnds(to)) {
    if (!inCore(n)) continue;
    const p = nodePoint(n), d = dirBetween(p, to);
    for (let di = 0; di < 4; di++) {
      if (d && dot(DIRS[di], d) < -0.5) continue; // would have to reverse into the goal
      goals.set(id(n.k, n.l, di), { rest: Math.hypot(to.x - p.x, to.z - p.z), turn: d && dot(DIRS[di], d) < 0.5 });
    }
  }

  let best = -1, bestCost = Infinity;
  for (;;) {
    let cur = -1, curCost = Infinity;
    for (let s = 0; s < cost.length; s++) if (!done[s] && cost[s] < curCost) { cur = s; curCost = cost[s]; }
    if (cur < 0 || curCost >= bestCost) break;
    done[cur] = 1;
    const goal = goals.get(cur);
    if (goal) {
      const total = curCost + goal.rest + (goal.turn ? 40 : 0);
      if (total < bestCost) { bestCost = total; best = cur; }
    }
    const di = cur % 4, cell = (cur - di) / 4, l = (cell % size) + K0, k = (cell - (l - K0)) / size + K0;
    for (let nd = 0; nd < 4; nd++) {
      if (dot(DIRS[nd], DIRS[di]) < -0.5) continue; // no U-turns
      const nk = k + DIRS[nd].x, nl = l + DIRS[nd].z;
      if (nk < K0 || nk > K1 || nl < K0 || nl > K1 || openStretch(k, l, DIRS[nd])) continue;
      const next = id(nk, nl, nd), c = curCost + PITCH + (nd === di ? 0 : 40);
      if (c < cost[next]) { cost[next] = c; prev[next] = cur; }
    }
  }
  if (best < 0) throw new Error('No route found');

  const nodes = [];
  for (let s = best; s >= 0; s = prev[s]) {
    const di = s % 4, cell = (s - di) / 4, l = (cell % size) + K0, k = (cell - (l - K0)) / size + K0;
    nodes.unshift(nodePoint({ k, l }));
  }
  // Drop repeats and merge straight runs.
  const raw = [from, ...nodes, to], points = [];
  for (const p of raw) {
    const last = points[points.length - 1];
    if (last && Math.hypot(p.x - last.x, p.z - last.z) < 1e-6) continue;
    if (points.length >= 2) {
      const a = dirBetween(points[points.length - 2], last), b = dirBetween(last, p);
      if (dot(a, b) > 0.99) { points[points.length - 1] = p; continue; }
    }
    points.push(p);
  }
  return points;
}

/** Distance from a street point to the next intersection in the direction of travel. */
export function roomAhead(point, heading) {
  const v = heading.x ? point.x : point.z, sign = heading.x || heading.z;
  const cell = (v + HALF) / PITCH;
  const next = sign > 0 ? Math.floor(cell + 1e-9) + 1 : Math.ceil(cell - 1e-9) - 1;
  return Math.abs(streetLine(next) - v);
}

/**
 * Free roam: from a street point and heading, the middle of the next block's
 * street in the chosen direction (-1 left, 0 straight, 1 right). Falls back to
 * whatever turn keeps the hero inside the core streets.
 */
export function roamTarget(point, heading, choice = 0) {
  const ahead = segmentEnds(point)
    .map((n) => ({ n, p: nodePoint(n) }))
    .find(({ p }) => { const d = dirBetween(point, p); return d && dot(d, heading) > 0.5; });
  const node = ahead ? ahead.n : segmentEnds(point)[0];
  const h = DIRS.reduce((a, b) => (dot(b, heading) > dot(a, heading) ? b : a));
  const right = { x: -h.z, z: h.x }, left = { x: h.z, z: -h.x };
  const order = choice < 0 ? [left, h, right] : choice > 0 ? [right, h, left] : [h, Math.random() < 0.5 ? left : right, left, right];
  for (const d of order) {
    const k = node.k + d.x, l = node.l + d.z;
    if (k < K0 || k > K1 || l < K0 || l > K1 || openStretch(node.k, node.l, d)) continue;
    const p = nodePoint(node);
    return { x: p.x + d.x * PITCH * 0.5, z: p.z + d.z * PITCH * 0.5 };
  }
  throw new Error('Nowhere to roam');
}
