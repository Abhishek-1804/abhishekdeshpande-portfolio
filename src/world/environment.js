// Sky, sun, ocean, clouds, stars and the time-of-day cycle.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { rng, lerp, fbm, canvasTexture } from './util.js';

const SUN_AZIMUTH = 262; // low on the left as you take off, so the opening shot is side-lit
export const CLOUD_RANGE = 2600;

// Each preset is a complete lighting mood; the cycle interpolates between them.
export const TIMES = [
  {
    id: 'golden', label: 'Golden hour',
    sunEl: 3.5, lightEl: 7, light: '#ffb07a', lightI: 2.8,
    hemiSky: '#ffd2a8', hemiGround: '#25324a', hemiI: 1.0,
    fog: '#d9a58a', fogDensity: 0.00042, exposure: 0.42, stars: 0,
    cloudLight: '#ffd9b8', cloudShadow: '#8a6f86', water: '#0b2b3a',
    turbidity: 9, rayleigh: 2.6,
  },
  {
    id: 'day', label: 'Midday',
    sunEl: 34, lightEl: 34, light: '#fff3df', lightI: 3.2,
    hemiSky: '#cfe6ff', hemiGround: '#3c5b4c', hemiI: 1.1,
    fog: '#b5cfe8', fogDensity: 0.00034, exposure: 0.36, stars: 0,
    cloudLight: '#ffffff', cloudShadow: '#9fb2c8', water: '#063a52',
    turbidity: 6, rayleigh: 1.4,
  },
  {
    id: 'night', label: 'Night',
    sunEl: -16, lightEl: 32, light: '#8fb2ff', lightI: 0.85,
    hemiSky: '#2b3d6e', hemiGround: '#04060c', hemiI: 0.75,
    fog: '#070c1a', fogDensity: 0.0003, exposure: 0.62, stars: 1,
    cloudLight: '#5f74a8', cloudShadow: '#101830', water: '#02101c',
    turbidity: 4, rayleigh: 0.6,
  },
];

/** A seamlessly tiling normal map built from summed sine waves. */
function waterNormals(size = 256) {
  const rand = rng(7);
  const waves = Array.from({ length: 34 }, () => {
    const kx = Math.round((rand() * 2 - 1) * 11), ky = Math.round((rand() * 2 - 1) * 11);
    const k = Math.hypot(kx, ky) || 1;
    return { kx, ky, amp: 1 / k ** 1.15, phase: rand() * Math.PI * 2 };
  });
  const data = new Uint8Array(size * size * 4);
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0, dy = 0;
      for (const w of waves) {
        const c = Math.cos(TAU * ((w.kx * x + w.ky * y) / size) + w.phase) * w.amp;
        dx += c * w.kx; dy += c * w.ky;
      }
      const s = 0.11;
      const n = new THREE.Vector3(-dx * s, -dy * s, 1).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Wispy cloud puff: fractal noise under a soft elliptical falloff. */
function cloudTexture() {
  const S = 256;
  return canvasTexture(S, S, (g) => {
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S - 0.5, v = y / S - 0.5;
        const falloff = Math.max(0, 1 - Math.hypot(u * 2.05, v * 2.7) ** 1.4);
        const n = fbm(x / 70, y / 70, 9, 6);
        const d = Math.min(1, Math.max(0, (n - 0.3) * 2.4)) * falloff ** 0.8;
        const a = Math.min(1, d * 0.85 + falloff * falloff * 0.3);
        const i = (y * S + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = a * 255;
      }
    }
    g.putImageData(img, 0, 0);
  });
}

function makeClouds(count) {
  const rand = rng(11);
  const puffs = 8;
  const n = count * puffs;
  const pos = new Float32Array(n * 3), misc = new Float32Array(n * 3);
  let i = 0;
  for (let c = 0; c < count; c++) {
    const cx = (rand() * 2 - 1) * CLOUD_RANGE, cz = (rand() * 2 - 1) * CLOUD_RANGE;
    // Most clouds sit above cruising height; a few hang low enough to fly through.
    const cy = rand() < 0.22 ? 70 + rand() * 60 : 190 + rand() * 260;
    const size = 70 + rand() * 120;
    for (let p = 0; p < puffs; p++, i++) {
      pos[i * 3] = cx + (rand() * 2 - 1) * size * 1.5;
      pos[i * 3 + 1] = cy + (rand() * 2 - 1) * size * 0.22;
      pos[i * 3 + 2] = cz + (rand() * 2 - 1) * size * 0.9;
      misc[i * 3] = size * (0.7 + rand() * 0.8);
      misc[i * 3 + 1] = rand() * Math.PI * 2;
      misc[i * 3 + 2] = rand();
    }
  }
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('aMisc', new THREE.InstancedBufferAttribute(misc, 3));
  geo.instanceCount = n;

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uMap: { value: cloudTexture() }, uTime: { value: 0 }, uRange: { value: CLOUD_RANGE },
      uLight: { value: new THREE.Color() }, uShadow: { value: new THREE.Color() },
      uFog: { value: new THREE.Color() },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aPos; attribute vec3 aMisc;
      uniform float uTime, uRange;
      varying vec2 vUv; varying float vDist, vShade;
      void main() {
        vec3 c = aPos;
        c.x = mod(c.x + uTime * 6.0 + uRange, uRange * 2.0) - uRange;
        vec4 mv = viewMatrix * vec4(c, 1.0);
        float s = sin(aMisc.y), co = cos(aMisc.y);
        vec2 p = mat2(co, -s, s, co) * position.xy;
        mv.xy += p * aMisc.x * vec2(1.5, 1.0);
        vUv = uv; vDist = -mv.z; vShade = aMisc.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uLight, uShadow, uFog;
      varying vec2 vUv; varying float vDist, vShade;
      void main() {
        float a = texture2D(uMap, vUv).a;
        vec3 col = mix(uShadow, uLight, clamp(a * 0.9 + vShade * 0.35, 0.0, 1.0));
        float far = smoothstep(1400.0, 3600.0, vDist);
        col = mix(col, uFog, far * 0.75);
        a *= smoothstep(4.0, 70.0, vDist) * (1.0 - far * 0.85) * 0.9;
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

function makeStars() {
  const rand = rng(5);
  const pts = [];
  for (let i = 0; i < 1800; i++) {
    const v = new THREE.Vector3(rand() * 2 - 1, rand() * 0.98 + 0.02, rand() * 2 - 1).normalize().multiplyScalar(4500);
    pts.push(v.x, v.y, v.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const stars = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: '#dfe8ff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })
  );
  stars.frustumCulled = false;
  return stars;
}

export function createEnvironment(scene, renderer, quality) {
  const sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);
  const skyU = sky.material.uniforms;
  skyU.mieCoefficient.value = 0.005;
  skyU.mieDirectionalG.value = 0.82;

  scene.fog = new THREE.FogExp2('#d9a58a', 0.0004);

  const sunLight = new THREE.DirectionalLight('#ffffff', 2);
  scene.add(sunLight, sunLight.target);
  const hemi = new THREE.HemisphereLight('#ffffff', '#222222', 1);
  scene.add(hemi);

  const reflection = quality.low ? 256 : 512;
  const water = new Water(new THREE.PlaneGeometry(20000, 20000), {
    textureWidth: reflection, textureHeight: reflection,
    waterNormals: waterNormals(), sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff, waterColor: 0x0b2b3a, distortionScale: 3.4, fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.material.uniforms.size.value = 0.7;
  scene.add(water);

  const clouds = makeClouds(quality.low ? 34 : 70);
  scene.add(clouds);
  const stars = makeStars();
  scene.add(stars);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  let envTarget;
  function bakeEnvironment() {
    envScene.add(sky);
    const next = pmrem.fromScene(envScene, 0, 1, 12000);
    scene.add(sky);
    scene.environment = next.texture;
    envTarget?.dispose();
    envTarget = next;
  }

  // Current blended state, plus the preset we are heading to.
  const numeric = ['sunEl', 'lightEl', 'lightI', 'hemiI', 'fogDensity', 'exposure', 'stars', 'turbidity', 'rayleigh'];
  const colors = ['light', 'hemiSky', 'hemiGround', 'fog', 'cloudLight', 'cloudShadow', 'water'];
  const state = {};
  let from = null, to = TIMES[0], blend = 1, index = 0, bakeTimer = 0;
  const sun = new THREE.Vector3(), lightDir = new THREE.Vector3();
  const tmp = new THREE.Color();

  function apply(t) {
    for (const k of numeric) state[k] = from ? lerp(from[k], to[k], t) : to[k];
    for (const k of colors) {
      state[k] ??= new THREE.Color();
      state[k].set(to[k]);
      if (from) state[k].copy(tmp.set(from[k])).lerp(tmp.clone().set(to[k]), t);
    }
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - state.sunEl), THREE.MathUtils.degToRad(SUN_AZIMUTH));
    lightDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - state.lightEl), THREE.MathUtils.degToRad(SUN_AZIMUTH));
    skyU.sunPosition.value.copy(sun);
    skyU.turbidity.value = state.turbidity;
    skyU.rayleigh.value = state.rayleigh;
    water.material.uniforms.sunDirection.value.copy(lightDir);
    water.material.uniforms.sunColor.value.copy(state.light).multiplyScalar(0.9);
    water.material.uniforms.waterColor.value.copy(state.water);
    sunLight.color.copy(state.light);
    sunLight.intensity = state.lightI;
    hemi.color.copy(state.hemiSky);
    hemi.groundColor.copy(state.hemiGround);
    hemi.intensity = state.hemiI;
    scene.fog.color.copy(state.fog);
    scene.fog.density = state.fogDensity;
    renderer.toneMappingExposure = state.exposure;
    stars.material.opacity = state.stars;
    stars.visible = state.stars > 0.01;
    const cu = clouds.material.uniforms;
    cu.uLight.value.copy(state.cloudLight);
    cu.uShadow.value.copy(state.cloudShadow);
    cu.uFog.value.copy(state.fog);
  }
  apply(1);
  bakeEnvironment();

  return {
    water, state, lightDir,
    get time() { return to; },
    /** 0 in daylight, 1 at night. Lets lamps and windows switch on. */
    get night() { return state.stars; },
    nextTime() {
      index = (index + 1) % TIMES.length;
      from = { ...state, ...Object.fromEntries(colors.map((k) => [k, '#' + state[k].getHexString()])) };
      to = TIMES[index];
      blend = 0;
      return to;
    },
    update(dt, elapsed, camera) {
      water.material.uniforms.time.value = elapsed * 0.55;
      clouds.material.uniforms.uTime.value = elapsed;
      stars.position.copy(camera.position);
      sunLight.target.position.copy(camera.position);
      sunLight.position.copy(camera.position).addScaledVector(lightDir, 800);
      if (blend < 1) {
        blend = Math.min(1, blend + dt / 3.5);
        apply(blend * blend * (3 - 2 * blend));
        bakeTimer += dt;
        if (bakeTimer > 0.4 || blend === 1) { bakeTimer = 0; bakeEnvironment(); }
      }
    },
  };
}
