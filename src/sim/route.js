// Turns a waypoint plan into a smooth path: straight runs with rounded corners,
// addressable by distance travelled (s, in metres).
import * as THREE from 'three';

const CORNER = 15;

export function buildRoute(waypoints) {
  const pts = waypoints.map((p) => new THREE.Vector3(p.x, 0, p.z));
  const parts = []; // { curve, start, length, straight }
  let cursor = pts[0].clone();
  for (let i = 1; i < pts.length; i++) {
    const end = pts[i];
    if (i === pts.length - 1) { parts.push({ curve: new THREE.LineCurve3(cursor, end.clone()), straight: true }); break; }
    const next = pts[i + 1];
    const dIn = end.clone().sub(pts[i - 1]), dOut = next.clone().sub(end);
    const r = Math.min(CORNER, dIn.length() * 0.45, dOut.length() * 0.45);
    const a = end.clone().addScaledVector(dIn.normalize(), -r), b = end.clone().addScaledVector(dOut.normalize(), r);
    parts.push({ curve: new THREE.LineCurve3(cursor, a), straight: true });
    parts.push({ curve: new THREE.QuadraticBezierCurve3(a, end.clone(), b), straight: false });
    cursor = b;
  }
  let length = 0;
  for (const p of parts) { p.start = length; p.length = p.curve.getLength(); length += p.length; }

  const find = (s) => {
    const c = Math.min(Math.max(s, 0), length);
    let part = parts[parts.length - 1];
    for (const p of parts) if (c <= p.start + p.length) { part = p; break; }
    return [part, part.length > 0 ? Math.min(1, Math.max(0, (c - part.start) / part.length)) : 0, s - c];
  };

  return {
    length, waypoints,
    /** Point on the path at distance s. Past either end it continues in a straight line. */
    pointAt(s, out = new THREE.Vector3()) {
      const [part, u, over] = find(s);
      part.curve.getPointAt(u, out);
      if (over) out.addScaledVector(part.curve.getTangentAt(u), over);
      return out;
    },
    tangentAt(s, out = new THREE.Vector3()) {
      const [part, u] = find(s);
      return part.curve.getTangentAt(u, out);
    },
    /** How far the straight run under s continues ahead (0 when s is inside a corner). */
    straightAhead(s) {
      const [part] = find(s);
      return part.straight ? part.start + part.length - Math.min(Math.max(s, 0), length) : 0;
    },
  };
}
