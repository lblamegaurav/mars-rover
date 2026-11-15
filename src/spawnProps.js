import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class SpawnPropsManager {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.loader = new GLTFLoader();
    this.propsGroup = new THREE.Group();
    this.scene.add(this.propsGroup);

    this._spawnRelics();
  }

  _spawnRelics() {
    const propDefs = [
      {
        id: 'turbine',
        path: '/models/spawn_props/turbine_tower_opt.glb',
        x: 28,
        z: -24,
        scale: 4.5,
        rot: [0.15, 0.8, -0.2], // Angled in sand
        sinkY: -0.8
      },
      {
        id: 'missile',
        path: '/models/spawn_props/missile_opt.glb',
        x: -22,
        z: 16,
        scale: 2.8,
        rot: [1.4, 0.4, 0.3], // Fallen sideways on dune
        sinkY: 0.1
      },
      {
        id: 'fire_extinguisher',
        path: '/models/spawn_props/fire_extinguisher_opt.glb',
        x: 12,
        z: 14,
        scale: 1.4,
        rot: [1.2, 0.3, -0.5],
        sinkY: 0.05
      },
      {
        id: 'lamp',
        path: '/models/spawn_props/rusty_lamp_opt.glb',
        x: -14,
        z: -18,
        scale: 1.5,
        rot: [0.4, 1.1, 0.2],
        sinkY: 0.1
      },
      {
        id: 'axe',
        path: '/models/spawn_props/axe_opt.glb',
        x: 18,
        z: -12,
        scale: 1.3,
        rot: [-0.6, 0.5, 1.2],
        sinkY: 0.08
      }
    ];

    propDefs.forEach(def => {
      this.loader.load(
        def.path,
        (gltf) => {
          const model = gltf.scene;

          // Compute normalized dimensions
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
          const s = def.scale / maxDim;
          model.scale.setScalar(s);

          // Center pivot
          const center = new THREE.Vector3();
          box.getCenter(center);
          model.position.set(-center.x * s, -center.y * s, -center.z * s);

          const wrapper = new THREE.Group();
          wrapper.add(model);

          // Apply slight transparency / weathered translucency per user specification
          model.traverse(child => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.88; // Subtle weathered translucency requested
                child.material.depthWrite = true;
              }
            }
          });

          // Position on terrain around spawn
          const groundY = this.terrain.getHeight(def.x, def.z);
          wrapper.position.set(def.x, groundY + def.sinkY, def.z);
          wrapper.rotation.set(def.rot[0], def.rot[1], def.rot[2]);

          this.propsGroup.add(wrapper);
        },
        undefined,
        (err) => {
          console.warn(`Could not load spawn prop ${def.id}:`, err);
        }
      );
    });
  }
}
