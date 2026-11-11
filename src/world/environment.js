// Sky, sun, clouds, stars and the time-of-day cycle.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { rng, lerp, fbm, canvasTexture } from './util.js';

const SUN_AZIMUTH = 264; // due west: the low sun shines straight down the east-west streets
export const CLOUD_RANGE = 2600;

// Each preset is a complete lighting mood; the cycle interpolates between them.
export const TIMES = [
  {
    id: 'golden', label: 'Golden hour',
    sunEl: 4, lightEl: 10, light: '#ffab6e', lightI: 3.6,
    hemiSky: '#a9b6e6', hemiGround: '#5a4a44', hemiI: 1.25,
    fog: '#d8a88e', fogDensity: 0.00105, exposure: 0.5, stars: 0, lights: 0.3,
    cloudLight: '#ffd9b8', cloudShadow: '#8a6f86', zenith: '#6f93cf', horizon: '#ffcf9e',
    turbidity: 9, rayleigh: 2.6,
  },
  {
    id: 'night', label: 'Night',
    sunEl: -16, lightEl: 38, light: '#8fb2ff', lightI: 0.7,
    hemiSky: '#2b3d6e', hemiGround: '#0a0c14', hemiI: 0.8,
    fog: '#0c1326', fogDensity: 0.0008, exposure: 0.8, stars: 1, lights: 1,
    cloudLight: '#5f74a8', cloudShadow: '#101830', zenith: '#0a1430', horizon: '#1b2748',
    turbidity: 4, rayleigh: 0.6,
  },
  {
    id: 'day', label: 'Midday',
    sunEl: 38, lightEl: 38, light: '#fff3df', lightI: 3.2,
    hemiSky: '#cfe6ff', hemiGround: '#4a4f58', hemiI: 1.1,
    fog: '#b9d0e6', fogDensity: 0.00075, exposure: 0.42, stars: 0, lights: 0,
    cloudLight: '#ffffff', cloudShadow: '#9fb2c8', zenith: '#4f8fdc', horizon: '#cfe2f3',
    turbidity: 6, rayleigh: 1.4,
  },
];

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
    const cy = 420 + rand() * 380; // well above the tallest towers
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
  const numeric = ['sunEl', 'lightEl', 'lightI', 'hemiI', 'fogDensity', 'exposure', 'stars', 'lights', 'turbidity', 'rayleigh'];
  const colors = ['light', 'hemiSky', 'hemiGround', 'fog', 'cloudLight', 'cloudShadow', 'zenith', 'horizon'];
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
    state, lightDir,
    get time() { return to; },
    /** 0 in daylight, 1 at night. Lets lamps and windows switch on. */
    get night() { return state.lights; },
    nextTime() {
      index = (index + 1) % TIMES.length;
      from = { ...state, ...Object.fromEntries(colors.map((k) => [k, '#' + state[k].getHexString()])) };
      to = TIMES[index];
      blend = 0;
      return to;
    },
    update(dt, elapsed, camera) {
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
