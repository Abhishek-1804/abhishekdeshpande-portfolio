// The chrome 3D name hanging in the sky at the start of the flight.
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { profile } from '../content.js';

export const TITLE_POS = new THREE.Vector3(0, 92, 90);

export function createTitle(scene) {
  const font = new FontLoader().parse(fontData);
  const group = new THREE.Group();
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 1, roughness: 0.12, clearcoat: 1, envMapIntensity: 1.7 });
  const glow = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffc58a', emissiveIntensity: 1.6 });

  const make = (text, size, depth, material) => {
    const geo = new TextGeometry(text, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: depth * 0.25, bevelSize: size * 0.035, bevelSegments: 3 });
    geo.center();
    return new THREE.Mesh(geo, material);
  };
  const name = make(profile.name.toUpperCase(), 9, 3, chrome);
  const role = make(profile.role.toUpperCase(), 3.4, 0.6, glow);
  role.position.y = -11;
  group.add(name, role);
  group.position.copy(TITLE_POS);
  scene.add(group);

  return {
    group,
    /** Bobs gently and turns (slowly) to stay readable from wherever the camera is. */
    update(t, camera) {
      group.position.y = TITLE_POS.y + Math.sin(t * 0.6) * 1.5;
      const want = Math.atan2(camera.position.x - TITLE_POS.x, camera.position.z - TITLE_POS.z);
      const diff = Math.atan2(Math.sin(want - group.rotation.y), Math.cos(want - group.rotation.y));
      group.rotation.y += diff * 0.02;
    },
  };
}
