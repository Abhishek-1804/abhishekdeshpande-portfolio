// Everything you can see of the city: buildings (one instanced draw call with a
// procedural window shader), streets, street lights, traffic and the section towers.
import * as THREE from 'three';
import { sections } from '../content.js';
import { generateLayout, N, PITCH, HALF, STREET, BLOCK, TOWER, PARK_BLOCKS, streetLine } from '../sim/layout.js';
import { rng, canvasTexture, glowTexture, textSprite } from './util.js';
import { landmarks } from './landmarks.js';

const GLSL_COMMON = /* glsl */ `
  uniform vec3 uSunDir, uSun, uAmbSky, uAmbGround, uHorizon, uZenith, uFogColor;
  uniform float uFogDensity, uLights, uShade;
  // Stable hash (no sine), so windows do not sparkle on low-precision GPUs.
  float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec3 skyColor(vec3 d) { return mix(uHorizon, uZenith, smoothstep(-0.02, 0.6, d.y)); }
  vec3 applyFog(vec3 col, vec3 world) {
    float d = length(cameraPosition - world);
    return mix(col, uFogColor, 1.0 - exp(-uFogDensity * uFogDensity * d * d));
  }`;

const buildingShader = {
  vertexShader: /* glsl */ `
    attribute float aSeed, aStyle; attribute vec3 aTint, aHue;
    varying vec3 vWorld, vLocal, vN;
    flat varying vec3 vSize, vTint, vHue; flat varying float vSeed, vStyle, vBase;
    void main() {
      vSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      vLocal = position; vN = normal; vSeed = floor(aSeed * 4096.0); vStyle = aStyle; vTint = aTint; vHue = aHue;
      vBase = instanceMatrix[3].y;
      vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: GLSL_COMMON + /* glsl */ `
    varying vec3 vWorld, vLocal, vN;
    flat varying vec3 vSize, vTint, vHue; flat varying float vSeed, vStyle, vBase;

    float box(vec2 f, vec2 lo, vec2 hi, vec2 aa) {
      return smoothstep(lo.x - aa.x, lo.x + aa.x, f.x) * smoothstep(hi.x + aa.x, hi.x - aa.x, f.x)
           * smoothstep(lo.y - aa.y, lo.y + aa.y, f.y) * smoothstep(hi.y + aa.y, hi.y - aa.y, f.y);
    }

    void main() {
      vec3 N = normalize(vN);
      vec3 V = normalize(cameraPosition - vWorld);
      // With the sun low, only the upper floors catch it; the streets sit in cool shade.
      float sunVis = mix(1.0, smoothstep(6.0, 75.0, vWorld.y), uShade);
      // Sky light plus sunlight bounced around the streets, so shaded walls are never black.
      vec3 ambient = mix(uAmbGround, uAmbSky, N.y * 0.5 + 0.5) + uSun * 0.16 * (1.0 - uShade * 0.6);
      vec3 direct = uSun * max(dot(N, uSunDir), 0.0) * sunVis;
      vec3 col;

      if (N.y > 0.5) {
        // Roof: gravel, with a parapet in the wall colour around the edge.
        vec2 e = (0.5 - abs(vLocal.xz)) * vSize.xz;
        float parapet = 1.0 - smoothstep(0.45, 0.65, min(e.x, e.y));
        float grain = noise(vWorld.xz * 1.4) * 0.3 + noise(vWorld.xz * 0.12) * 0.3;
        vec3 base = mix(vec3(0.24, 0.24, 0.25), vec3(0.4, 0.39, 0.37), grain);
        base = mix(base, vTint * 0.7 + 0.12, parapet);
        col = base * (ambient + uSun * max(dot(N, uSunDir), 0.0) * mix(1.0, smoothstep(20.0, 90.0, vWorld.y), uShade * 0.7));
      } else {
        bool xFace = abs(N.x) > 0.5;
        float width = xFace ? vSize.z : vSize.x;
        float u = ((xFace ? vLocal.z : vLocal.x) + 0.5) * width;
        float v = vLocal.y * vSize.y, H = vSize.y;
        float face = floor(N.x * 1.5 + N.z * 3.5 + 4.0);
        int style = int(vStyle + 0.5);

        float bay = style == 0 ? 3.2 : style == 1 ? 4.4 : style == 2 ? 1.6 : 1.9;
        float fh = style == 0 ? 3.3 : style == 1 ? 3.5 : style == 2 ? 3.7 : 3.4;
        float bw = width / max(1.0, floor(width / bay + 0.5));
        vec2 g = vec2(u / bw, v / fh);
        vec2 cell = floor(g), f = fract(g), aa = fwidth(g);
        float lod = smoothstep(0.25, 0.8, max(aa.x, aa.y)); // 1 when windows are sub-pixel

        // Where is glass, and what is the wall made of here?
        float glassMask, reflectivity = 0.14;
        vec3 wall = vTint;
        float wear = 0.86 + 0.28 * noise(vec2(u * 0.9 + vSeed, v * 0.08)) - 0.1 * noise(vec2(u * 6.0, v * 6.0));
        if (style == 0) { // brick with punched windows and stone sills
          glassMask = box(f, vec2(0.3, 0.26), vec2(0.7, 0.84), aa);
          float sill = box(f, vec2(0.26, 0.18), vec2(0.74, 0.26), aa);
          wall = mix(vTint * wear, vec3(0.62, 0.59, 0.53), sill * 0.9);
          glassMask = mix(glassMask, 0.23, lod);
        } else if (style == 1) { // limestone piers with dark vertical window strips
          float strip = box(f, vec2(0.16, -1.0), vec2(0.84, 2.0), aa);
          float mullion = 1.0 - smoothstep(0.02, 0.02 + aa.x, abs(f.x - 0.5));
          float spandrel = 1.0 - smoothstep(0.3, 0.3 + aa.y, f.y);
          glassMask = strip * (1.0 - mullion) * (1.0 - spandrel);
          wall = mix(vTint * wear, vTint * 0.42, strip * max(spandrel, mullion));
          glassMask = mix(glassMask, 0.42, lod);
        } else if (style == 2) { // glass curtain wall
          float frame = max(1.0 - smoothstep(0.035, 0.035 + aa.x, f.x), 1.0 - smoothstep(0.04, 0.04 + aa.y, f.y));
          glassMask = mix(1.0 - frame, 0.93, lod);
          wall = vTint * 0.35;
          reflectivity = 0.5;
        } else { // modern slab: ribbon windows between pale bands
          float ribbon = box(f, vec2(0.05, 0.36), vec2(1.5, 0.9), aa);
          glassMask = mix(ribbon, 0.5, lod);
          wall = vTint * wear;
          reflectivity = 0.3;
        }

        // Street level: darker base and shop windows. Roofline: a pale cornice.
        bool ground = vBase < 0.5;
        float storefront = ground ? 1.0 - smoothstep(4.2, 4.5, v) : 0.0;
        float cornice = smoothstep(H - 1.3, H - 1.1, v) * (style == 2 ? 0.0 : 1.0);
        float underCornice = smoothstep(H - 2.6, H - 1.3, v) * (1.0 - cornice) * (style == 2 ? 0.0 : 1.0);
        glassMask *= 1.0 - cornice;
        wall = mix(wall, vTint * 0.5 + 0.34, cornice) * (1.0 - underCornice * 0.3);
        wall *= mix(0.6, 1.0, smoothstep(0.0, 16.0, vWorld.y)); // grime and shade near the street

        // Glass: reflects the sky above and a dark skyline below, more at grazing angles.
        vec3 R = reflect(-V, N);
        vec2 jitter = (vec2(hash(cell + vSeed + 1.7), hash(cell + vSeed + 9.2)) - 0.5) * (1.0 - lod);
        R = normalize(R + vec3(jitter.x, jitter.y, jitter.x) * 0.05);
        // Below a blocky horizon the glass mirrors the buildings across the street.
        float skyline = 0.03 + 0.26 * hash(vec2(floor(atan(R.z, R.x) * 9.0), vSeed)) * hash(vec2(floor(atan(R.z, R.x) * 3.0), 7.0));
        vec3 across = (uAmbSky * 0.55 + uSun * 0.3 * (1.0 - uShade * 0.5)) * vec3(0.5, 0.47, 0.45) + vec3(1.0, 0.7, 0.4) * 0.12 * uLights * step(0.7, hash(floor(vec2(atan(R.z, R.x) * 40.0, R.y * 60.0)) + 3.0));
        vec3 refl = mix(across * (0.7 + 0.6 * hash(floor(vec2(atan(R.z, R.x) * 40.0, R.y * 60.0)))), skyColor(R), smoothstep(skyline - 0.01, skyline + 0.01, R.y));
        float fres = reflectivity + (1.0 - reflectivity) * pow(1.0 - max(dot(N, V), 0.0), 4.0);
        float glint = pow(max(dot(R, uSunDir), 0.0), 90.0) * sunVis;
        // Behind the glass: darkness, some drawn blinds, a few lights on.
        float r1 = hash(cell + vSeed + face * 17.0), r2 = hash(cell + vSeed * 1.31 + 4.4);
        float blinds = step(0.55, r2) * smoothstep(1.0 - r1 * 0.9, 1.0 - r1 * 0.9 + 0.02, f.y) * (style == 2 ? 0.25 : 1.0) * (1.0 - lod);
        vec3 interior = mix(vec3(0.02, 0.024, 0.03), vec3(0.5, 0.48, 0.44), blinds) * (ambient * 0.6 + direct * 0.5);
        float litFrac = uLights * (style == 2 ? 0.3 : 0.4);
        float lit = mix(step(1.0 - litFrac, r1), litFrac, lod);
        vec3 warm = mix(vec3(1.0, 0.6, 0.27), vec3(0.6, 0.78, 1.0), step(0.88, r2));
        vec3 lamp = warm * (0.25 + 0.55 * r2) * mix(style == 2 ? 0.1 : 0.45, 0.95, uLights * uLights) * lit;
        vec3 glass = interior * (1.0 - fres) + refl * fres * (style == 2 ? mix(vTint * 2.2, vec3(1.0), 0.45) : vec3(1.0)) + uSun * glint * 6.0 + lamp;

        col = mix(wall * (ambient + direct), glass, glassMask);

        if (storefront > 0.0) {
          float shop = floor(u / 8.0), sx = fract(u / 8.0);
          float pane = box(vec2(sx, v / 4.4), vec2(0.06, 0.1), vec2(0.94, 0.72), vec2(aa.x * bw / 8.0, aa.y)) * (1.0 - lod);
          vec3 awning = 0.25 + 0.5 * cos(6.2831 * (hash(vec2(shop, vSeed)) + vec3(0.0, 0.33, 0.67)));
          float stripe = smoothstep(3.25, 3.35, v) * smoothstep(4.05, 3.95, v) * step(0.35, hash(vec2(shop, vSeed + 3.0)));
          vec3 base = vTint * 0.45 * (ambient + direct);
          vec3 shopGlass = vec3(0.03) * ambient + refl * fres * 0.6 + warm * 0.8 * uLights * step(0.25, hash(vec2(shop, vSeed + 7.0)));
          base = mix(base, shopGlass, pane);
          base = mix(base, awning * (ambient + direct) * 0.8, stripe);
          col = mix(col, base, storefront);
        }

        // Section towers: glowing corner strips and a crown in the section's colour.
        float isTower = step(0.001, dot(vHue, vec3(1.0)));
        float corner = step(0.478, abs(vLocal.x)) * step(0.478, abs(vLocal.z));
        float crown = smoothstep(H - 2.2, H - 1.8, v);
        col += vHue * isTower * (corner + crown) * 1.15;
      }
      gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
    }`,
};

const ROAD = 9; // half-width of the roadway; the rest of the street is sidewalk

const groundShader = {
  vertexShader: /* glsl */ `
    varying vec3 vWorld; varying vec2 vUv;
    void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: GLSL_COMMON + /* glsl */ `
    uniform sampler2D uMap;
    varying vec3 vWorld; varying vec2 vUv;
    void main() {
      vec3 albedo = texture2D(uMap, vUv).rgb;
      vec3 V = normalize(cameraPosition - vWorld);
      // The low sun runs straight down the east-west streets; everything else is in shadow.
      float toLine = abs(fract((vWorld.z + ${HALF.toFixed(1)}) / ${PITCH.toFixed(1)} + 0.5) - 0.5) * ${PITCH.toFixed(1)};
      float sunlit = mix(1.0, 1.0 - smoothstep(${(STREET / 2 - 3).toFixed(1)}, ${(STREET / 2 + 5).toFixed(1)}, toLine), uShade);
      vec3 light = uAmbSky * 0.85 + uSun * 0.14 * (1.0 - uShade * 0.6) + uSun * (max(uSunDir.y, 0.0) * 2.2 + 0.25 * uShade) * sunlit;
      vec3 col = albedo * light;
      vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
      float glare = pow(max(dot(R, uSunDir), 0.0), 26.0) * sunlit;
      float fres = pow(1.0 - max(V.y, 0.0), 5.0);
      col += uSun * glare * 0.9 + skyColor(R) * fres * 0.35;
      // Pools of light under the street lamps.
      col += albedo * vec3(1.0, 0.72, 0.42) * uLights * 0.6 * smoothstep(${(STREET / 2 + 2).toFixed(1)}, ${(STREET / 2 - 6).toFixed(1)}, min(toLine, abs(fract((vWorld.x + ${HALF.toFixed(1)}) / ${PITCH.toFixed(1)} + 0.5) - 0.5) * ${PITCH.toFixed(1)}));
      gl_FragColor = vec4(applyFog(col, vWorld), 1.0);
    }`,
};

function groundTexture() {
  const S = 1024, m = S / PITCH, half = STREET / 2;
  const tex = canvasTexture(S, S, (g) => {
    const rand = rng(8);
    g.fillStyle = '#8d8a84'; g.fillRect(0, 0, S, S); // pavement everywhere first
    // Paving slabs.
    g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 1;
    for (let p = 0; p < S; p += 1.5 * m) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.moveTo(0, p); g.lineTo(S, p); g.stroke(); }
    g.fillStyle = '#6f6c68'; g.fillRect(half * m, half * m, BLOCK * m, BLOCK * m); // under the buildings
    // Roadways run along the tile edges.
    g.fillStyle = '#3d3e41';
    for (const e of [0, S - ROAD * m]) { g.fillRect(e, 0, ROAD * m, S); g.fillRect(0, e, S, ROAD * m); }
    for (let i = 0; i < 5000; i++) { // asphalt speckle and patches
      const along = rand() * S, across = rand() * ROAD * m, edge = rand() < 0.5 ? 0 : S - ROAD * m;
      g.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,255'},${rand() * 0.07})`;
      const w = 1 + rand() * 9, h = 1 + rand() * 9;
      if (rand() < 0.5) g.fillRect(edge + across, along, w, h); else g.fillRect(along, edge + across, w, h);
    }
    // Curbs.
    g.fillStyle = '#a9a69f';
    for (const e of [ROAD * m, S - ROAD * m - 0.25 * m]) { g.fillRect(e, ROAD * m, 0.25 * m, S - 2 * ROAD * m); g.fillRect(ROAD * m, e, S - 2 * ROAD * m, 0.25 * m); }
    // Centre lines (double yellow) and lane dashes.
    g.fillStyle = '#d6a51f';
    for (const e of [0.12 * m, S - 0.27 * m]) { g.fillRect(e, half * m, 0.15 * m, BLOCK * m); g.fillRect(half * m, e, BLOCK * m, 0.15 * m); }
    g.fillStyle = '#d9d8d2';
    for (let p = half + 2; p < half + BLOCK - 3; p += 8) {
      for (const lane of [ROAD / 2, PITCH - ROAD / 2]) { g.fillRect(lane * m, p * m, 0.18 * m, 3 * m); g.fillRect(p * m, lane * m, 3 * m, 0.18 * m); }
    }
    // Zebra crossings where the sidewalks meet the junction.
    for (const edge of [ROAD + 0.6, PITCH - ROAD - 3.6]) {
      for (let p = 0.7; p < ROAD - 0.4; p += 1.3) {
        for (const base of [0, PITCH - ROAD]) { g.fillRect((base + p) * m, edge * m, 0.65 * m, 3 * m); g.fillRect(edge * m, (base + p) * m, 3 * m, 0.65 * m); }
      }
    }
    // Manhole covers and stains.
    for (let i = 0; i < 26; i++) {
      const along = rand() * S, across = (1 + rand() * (ROAD - 2)) * m, edge = rand() < 0.5 ? 0 : S - ROAD * m;
      g.fillStyle = 'rgba(20,20,22,0.55)';
      g.beginPath(); g.arc(rand() < 0.5 ? edge + across : along, rand() < 0.5 ? along : edge + across, 0.45 * m, 0, 7); g.fill();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function signTexture(title, hue) {
  return canvasTexture(1024, 256, (g) => {
    g.fillStyle = 'rgba(6,10,18,0.94)'; g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = hue; g.lineWidth = 10; g.strokeRect(12, 12, 1000, 232);
    g.font = '700 132px "Space Grotesk", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = hue; g.shadowBlur = 36;
    g.fillStyle = '#ffffff';
    g.fillText(title.toUpperCase(), 512, 134, 940);
  });
}

export function createCity(scene, quality) {
  const layout = generateLayout();
  const rand = rng(99);

  // ── Buildings ──────────────────────────────────────────────────────────────
  const hueOf = Object.fromEntries(sections.map((s) => [s.id, s.hue]));
  hueOf.home = '#f29a1f';
  const count = layout.buildings.length;
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const seeds = new Float32Array(count), styles = new Float32Array(count), tints = new Float32Array(count * 3), hues = new Float32Array(count * 3);
  const uniforms = {
    uSunDir: { value: new THREE.Vector3() }, uSun: { value: new THREE.Color() },
    uAmbSky: { value: new THREE.Color() }, uAmbGround: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() },
    uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0.001 }, uLights: { value: 0 }, uShade: { value: 0 },
  };
  const buildings = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ ...buildingShader, uniforms }), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  layout.buildings.forEach((b, i) => {
    m4.compose(new THREE.Vector3(b.x, b.y0, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
    buildings.setMatrixAt(i, m4);
    seeds[i] = b.seed;
    styles[i] = b.style;
    tints.set(b.tint, i * 3);
    if (b.site) { c.set(hueOf[b.site]); hues.set([c.r, c.g, c.b], i * 3); }
  });
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(styles, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
  geo.setAttribute('aHue', new THREE.InstancedBufferAttribute(hues, 3));
  buildings.frustumCulled = false;
  scene.add(buildings);

  // ── Ground ─────────────────────────────────────────────────────────────────
  const tiles = N + 14;
  const groundMap = groundTexture();
  groundMap.repeat.set(tiles, tiles);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(tiles * PITCH, tiles * PITCH).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ ...groundShader, uniforms: { ...uniforms, uMap: { value: groundMap } } })
  );
  ground.geometry.attributes.uv.array.forEach((v, i, arr) => { arr[i] = v * tiles; });
  scene.add(ground);

  // ── Rooftops: water towers, plant rooms, spires ───────────────────────────
  const place = (mesh, list, fn) => { list.forEach((item, i) => { fn(item, i); mesh.setMatrixAt(i, m4); }); mesh.frustumCulled = false; scene.add(mesh); return mesh; };
  const P = new THREE.Vector3(), S1 = new THREE.Vector3();
  const wood = new THREE.MeshStandardMaterial({ color: '#6b4a33', roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: '#33363c', roughness: 0.6, metalness: 0.6 });
  const wt = layout.waterTowers;
  place(new THREE.InstancedMesh(new THREE.CylinderGeometry(1.7, 1.7, 3.4, 14).translate(0, 4.4, 0), wood, wt.length), wt, (t) => m4.compose(P.set(t.x, t.y, t.z), q, S1.set(1, 1, 1)));
  place(new THREE.InstancedMesh(new THREE.ConeGeometry(1.9, 1.3, 14).translate(0, 6.75, 0), steel, wt.length), wt, (t) => m4.compose(P.set(t.x, t.y, t.z), q, S1.set(1, 1, 1)));
  place(new THREE.InstancedMesh(new THREE.BoxGeometry(2.5, 2.7, 2.5).translate(0, 1.35, 0), new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.7, metalness: 0.5, wireframe: true }), wt.length), wt, (t) => m4.compose(P.set(t.x, t.y, t.z), q, S1.set(1, 1, 1)));
  place(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#77756f', roughness: 0.85 }), layout.roofBoxes.length), layout.roofBoxes, (b) => m4.compose(P.set(b.x, b.y, b.z), q, S1.set(b.w, b.h, b.d)));
  place(new THREE.InstancedMesh(new THREE.ConeGeometry(0.707, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: '#b8b1a2', roughness: 0.45, metalness: 0.35 }), layout.spires.length), layout.spires, (sp) => m4.compose(P.set(sp.x, sp.y, sp.z), q, S1.set(sp.w, sp.h, sp.w)));

  // ── Trees: along every sidewalk in town, and filling the park ─────────────
  const treeSpots = [];
  const step = quality.low ? 26 : 13;
  for (let i = 1; i < N - 1; i++) for (let j = 1; j < N - 1; j++) {
    const cx = (i + 0.5) * PITCH - HALF, cz = (j + 0.5) * PITCH - HALF, edge = BLOCK / 2 + 2.6;
    for (let p = -BLOCK / 2 + 7; p <= BLOCK / 2 - 7; p += step) {
      if (rand() < 0.2) continue;
      treeSpots.push([cx + p, cz - edge], [cx + p, cz + edge], [cx - edge, cz + p], [cx + edge, cz + p]);
    }
  }
  const lawns = [];
  for (const [pi, pj] of PARK_BLOCKS) {
    const cx = (pi + 0.5) * PITCH - HALF, cz = (pj + 0.5) * PITCH - HALF;
    lawns.push([cx, cz]);
    for (let n = 0; n < (quality.low ? 45 : 110); n++) treeSpots.push([cx + (rand() - 0.5) * (BLOCK - 8), cz + (rand() - 0.5) * (BLOCK - 8), 1.5]);
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 3.4, 6).translate(0, 1.7, 0), new THREE.MeshStandardMaterial({ color: '#3a2c22', roughness: 1 }), treeSpots.length);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2).translate(0, 4.6, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, envMapIntensity: 0.3 }), treeSpots.length);
  const autumn = ['#3f6b2c', '#4d7a31', '#35602a', '#5c7d2c', '#47702d', '#8a7a2c', '#a5662c', '#8f4a2a'];
  treeSpots.forEach(([x, z, big = 1], i) => {
    const sc = (0.8 + rand() * 0.6) * big;
    m4.compose(P.set(x, 0, z), q, S1.set(sc, sc, sc));
    trunks.setMatrixAt(i, m4);
    m4.compose(P.set(x, (sc - 1) * 3.4 * 0.2, z), q, S1.set(sc * 2.1, sc * 1.8, sc * 2.1));
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, c.set(autumn[Math.floor(rand() ** 1.6 * autumn.length)]).multiplyScalar(0.75 + rand() * 0.4));
  });
  trunks.frustumCulled = crowns.frustumCulled = false;
  scene.add(trunks, crowns);
  const lawnTex = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#44682e'; g.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 1400; n++) { g.fillStyle = `rgba(${rand() < 0.5 ? '20,40,10' : '120,150,60'},${rand() * 0.18})`; g.fillRect(rand() * 256, rand() * 256, 2 + rand() * 10, 2 + rand() * 10); }
    g.strokeStyle = '#b9ae97'; g.lineWidth = 9; // footpaths
    g.beginPath(); g.moveTo(0, 60); g.bezierCurveTo(90, 20, 150, 230, 256, 190); g.moveTo(128, 0); g.bezierCurveTo(60, 100, 210, 150, 128, 256); g.stroke();
  });
  for (const [x, z] of lawns) {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 3, BLOCK - 3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: lawnTex, roughness: 1 }));
    lawn.position.set(x, 0.08, z);
    scene.add(lawn);
  }

  // ── Street lights ──────────────────────────────────────────────────────────
  const lampPts = [];
  for (let k = 0; k <= N; k++) {
    for (let p = -HALF + 10; p < HALF; p += 30) {
      for (const side of [-1, 1]) {
        const off = streetLine(k) + side * (ROAD + 0.8);
        lampPts.push(off, 8.5, p, p, 8.5, off);
      }
    }
  }
  const lampGeo = new THREE.BufferGeometry();
  lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(lampPts, 3));
  const lamps = new THREE.Points(lampGeo, new THREE.PointsMaterial({
    map: glowTexture(), color: '#ffbf80', size: 5, sizeAttenuation: true, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  scene.add(lamps);

  // ── Traffic ────────────────────────────────────────────────────────────────
  const cars = [];
  const perLane = quality.low ? 6 : 13;
  for (let k = 1; k < N; k++) {
    for (const axis of ['x', 'z']) {
      for (const dir of [-1, 1]) {
        for (let n = 0; n < perLane; n++) cars.push({ axis, dir, line: streetLine(k) + dir * (axis === 'z' ? -3.6 : 3.6), p: (rand() * 2 - 1) * HALF, speed: 9 + rand() * 9 });
      }
    }
  }
  const carMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.9, 1.3, 4.4).translate(0, 0.85, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.6 }), cars.length
  );
  const paint = ['#101114', '#d8d9dc', '#7a1f1f', '#1d2c4d', '#3a3d42', '#f2f2f0'];
  // This is New York: more than half the traffic is yellow cabs.
  cars.forEach((_, i) => carMesh.setColorAt(i, c.set(rand() < 0.55 ? '#f2b705' : paint[Math.floor(rand() * paint.length)])));
  carMesh.frustumCulled = false;
  scene.add(carMesh);
  const lightPos = new Float32Array(cars.length * 6), lightCol = new Float32Array(cars.length * 6);
  cars.forEach((_, i) => { lightCol.set([1, 0.93, 0.78, 1, 0.08, 0.05], i * 6); });
  const lightGeo = new THREE.BufferGeometry();
  lightGeo.setAttribute('position', new THREE.BufferAttribute(lightPos, 3));
  lightGeo.setAttribute('color', new THREE.BufferAttribute(lightCol, 3));
  const carLights = new THREE.Points(lightGeo, new THREE.PointsMaterial({
    map: glowTexture(), size: 4.2, sizeAttenuation: true, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  carLights.frustumCulled = false;
  scene.add(carLights);
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const one = new THREE.Vector3(1, 1, 1), carPos = new THREE.Vector3();

  // ── Section towers ─────────────────────────────────────────────────────────
  const pickables = [], props = [];
  const sites = layout.sites.map((site) => {
    const section = sections.find((s) => s.id === site.id);
    const hue = hueOf[site.id];
    const info = { ...site, hue, title: section?.title ?? 'Home', blurb: section?.blurb ?? '' };
    const root = new THREE.Group();
    root.position.set(site.x, site.h, site.z);

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 1.3, 460, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })
    );
    beacon.position.set(18, 230, 0);
    if (section) root.add(beacon);

    if (section) {
      // A billboard on a gantry, readable from both sides.
      const tex = signTexture(section.title, hue);
      const signMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.15, 1.15, 1.15), fog: false });
      for (const face of [-1, 1]) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(46, 11.5), signMat);
        sign.position.set(18 + face * 0.45, 22, 0);
        sign.rotation.y = face * Math.PI / 2;
        root.add(sign);
      }
      root.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 12.4, 47), steel).translateX(18).translateY(22));
      for (const z of [-20, 20]) root.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 17, 0.9), steel).translateX(18).translateY(8.5).translateZ(z));

      const prop = landmarks[site.id](hue);
      prop.group.scale.setScalar(0.42);
      prop.group.position.set(4, 0, 17);
      prop.group.rotation.y = -Math.PI / 2;
      root.add(prop.group);
      props.push(prop);

      const label = textSprite(section.title.toUpperCase(), { height: 13, weight: 700 });
      label.position.set(18, 46, 0);
      root.add(label);

      // Invisible click target: the whole tower.
      const hit = new THREE.Mesh(new THREE.BoxGeometry(TOWER, site.h + 34, TOWER), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(site.x, (site.h + 34) / 2, site.z);
      hit.userData.site = site.id;
      scene.add(hit);
      pickables.push(hit);
    }
    scene.add(root);
    return info;
  });

  return {
    layout, sites, pickables,
    site: (id) => sites.find((s) => s.id === id),
    update(dt, t, env) {
      const st = env.state, k = st.hemiI / Math.PI;
      uniforms.uSunDir.value.copy(env.lightDir);
      uniforms.uSun.value.copy(st.light).multiplyScalar(st.lightI / Math.PI);
      uniforms.uAmbSky.value.copy(st.hemiSky).multiplyScalar(k);
      uniforms.uAmbGround.value.copy(st.hemiGround).multiplyScalar(k);
      uniforms.uHorizon.value.copy(st.horizon);
      uniforms.uZenith.value.copy(st.zenith);
      uniforms.uFogColor.value.copy(st.fog);
      uniforms.uFogDensity.value = st.fogDensity;
      uniforms.uLights.value = st.lights;
      uniforms.uShade.value = THREE.MathUtils.clamp(1 - st.lightEl / 30, 0, 1) * (1 - st.stars);
      lamps.material.opacity = st.lights * 0.95;
      lamps.visible = st.lights > 0.02;
      carLights.material.opacity = 0.35 + st.lights * 0.65;

      for (let i = 0; i < cars.length; i++) {
        const car = cars[i];
        car.p += car.dir * car.speed * dt;
        if (car.p > HALF) car.p -= 2 * HALF; else if (car.p < -HALF) car.p += 2 * HALF;
        const x = car.axis === 'z' ? car.line : car.p, z = car.axis === 'z' ? car.p : car.line;
        m4.compose(carPos.set(x, 0, z), car.axis === 'z' ? q : turn, one);
        carMesh.setMatrixAt(i, m4);
        const fx = car.axis === 'z' ? 0 : car.dir * 2.3, fz = car.axis === 'z' ? car.dir * 2.3 : 0;
        lightPos.set([x + fx, 0.9, z + fz, x - fx, 0.9, z - fz], i * 6);
      }
      carMesh.instanceMatrix.needsUpdate = true;
      lightGeo.attributes.position.needsUpdate = true;
      for (const p of props) p.update(t, st.lights);
    },
  };
}
