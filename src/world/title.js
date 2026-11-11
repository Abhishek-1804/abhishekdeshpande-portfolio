// The chrome 3D name above the home tower, where the visit starts.
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { profile } from '../content.js';

export function createTitle(scene, home) {
  // Floats out over the street in front of the home tower, where the opening shot looks.
  const TITLE_POS = new THREE.Vector3(home.edge.x - 26, home.h + 9, home.z);
  const font = new FontLoader().parse(fontData);
  const group = new THREE.Group();
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 1, roughness: 0.2, clearcoat: 1, envMapIntensity: 0.9 });
  const glow = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffc58a', emissiveIntensity: 0.7 });

  const make = (text, size, depth, material) => {
    const geo = new TextGeometry(text, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelThickness: depth * 0.25, bevelSize: size * 0.035, bevelSegments: 3 });
    geo.center();
    return new THREE.Mesh(geo, material);
  };
  const name = make(profile.name.toUpperCase(), 2.1, 0.7, chrome);
  const role = make(profile.role.toUpperCase(), 0.85, 0.15, glow);
  role.position.y = -2.7;
  group.add(name, role);
  group.position.copy(TITLE_POS);
  group.rotation.y = Math.PI / 2;
  scene.add(group);

  return {
    group,
    /** Bobs gently and turns (slowly) to stay readable from wherever the camera is. */
    update(t, camera) {
      group.position.y = TITLE_POS.y + Math.sin(t * 0.6) * 0.5;
      const want = Math.atan2(camera.position.x - TITLE_POS.x, camera.position.z - TITLE_POS.z);
      const diff = Math.atan2(Math.sin(want - group.rotation.y), Math.cos(want - group.rotation.y));
      group.rotation.y += diff * 0.03;
    },
  };
}
