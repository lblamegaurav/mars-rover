import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class MarsGLBManager {
  constructor(scene, terrain, rover, onStatusUpdate) {
    this.scene = scene;
    this.terrain = terrain;
    this.rover = rover;
    this.onStatusUpdate = onStatusUpdate;

    this.loader = new GLTFLoader();
    this.totalToLoad = 2;
    this.loadedCount = 0;

    // Celestial Sky Reference
    this.skyboxAlien = null;
    this.mountainInstances = [];

    // Initialize the authentic Alien Nebula Upper Sky Dome
    this._initAlienNebulaSkyDome();

    // Load remaining 3D world models
    this._startLoading();
  }

  _notify(msg) {
    if (this.onStatusUpdate) {
      this.onStatusUpdate(msg, this.loadedCount, this.totalToLoad);
    }
  }

  // --- 1. Authentic Alien Space Nebula Celestial Sky Dome ---
  _initAlienNebulaSkyDome() {
    const textureLoader = new THREE.TextureLoader();
    const skyTex = textureLoader.load('/models/alien_sky_equirect.webp');
    skyTex.wrapS = THREE.RepeatWrapping;
    skyTex.wrapT = THREE.ClampToEdgeWrapping;

    // Upper celestial hemisphere dome (radius 2400, phi from 0 (zenith) to 0.52 * PI (horizon))
    // Zero geometry beneath Mars
    const geom = new THREE.SphereGeometry(2400, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52);

    // CRITICAL: MeshBasicMaterial is unlit! Rover headlights will NEVER illuminate or flash on the sky!
    // The nebula & stars shine continuously at their authentic intermediate celestial brightness.
    const mat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide, // Viewed from inside looking up at the heavens
      depthWrite: false,
      depthTest: false,
      fog: false,
      transparent: true,
      opacity: 1.0,
      color: 0xffffff
    });

    this.skyboxAlien = new THREE.Mesh(geom, mat);
    this.skyboxAlien.renderOrder = -100;
    this.scene.add(this.skyboxAlien);
  }

  _startLoading() {
    this._notify('STREAMING EXPEDITION ASSETS...');

    // 1. Real NASA Curiosity Mars Rover
    this.loader.load(
      '/models/curiosity_rover.glb',
      (gltf) => {
        this._setupCuriosityRover(gltf);
        this.loadedCount++;
        this._notify(`ASSETS: CURIOSITY ROVER ONLINE (${this.loadedCount}/${this.totalToLoad})`);
      },
      undefined,
      (err) => {
        console.warn('Could not load curiosity_rover.glb, falling back to mars_rover.glb:', err);
        this.loader.load('/models/mars_rover.glb', (gltf2) => this._setupCuriosityRover(gltf2));
      }
    );

    // 2. Distant Horizon Mountain Massifs
    this.loader.load(
      '/models/a_mountain.glb',
      (gltf) => {
        this._setupMountains(gltf);
        this.loadedCount++;
        this._notify(`ASSETS: PLANETARY HORIZON ACTIVE (${this.loadedCount}/${this.totalToLoad})`);
      },
      undefined,
      (err) => console.warn('Could not load a_mountain.glb:', err)
    );
  }

  // --- 2. NASA Curiosity Rover Setup ---
  _setupCuriosityRover(gltf) {
    const model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Target length is ~3.8m
    const maxHoriz = Math.max(size.x, size.z);
    const scaleFactor = 3.8 / maxHoriz;
    model.scale.setScalar(scaleFactor);

    model.rotation.y = 0;

    box.setFromObject(model);
    box.getCenter(center);

    // Center pivot horizontally, position bottom of wheels on ground
    model.position.x = -center.x;
    model.position.y = -box.min.y + 0.08;
    model.position.z = -center.z;

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.roughness = 0.78;
          child.material.metalness = 0.18;
        }
      }
    });

    const roverContainer = new THREE.Group();
    roverContainer.add(model);

    if (this.rover) {
      this.rover.setGLBModel(roverContainer);
    }
  }

  // --- 3. Distant Horizon Mountain Ranges ---
  _setupMountains(gltf) {
    const baseModel = gltf.scene;
    const box = new THREE.Box3().setFromObject(baseModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.z);
    const normScale = 450.0 / (maxDim || 100);

    baseModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        if (child.material) {
          child.material.roughness = 0.98;
          child.material.metalness = 0.04;
        }
      }
    });

    // 2 majestic horizon massifs framing the distant horizon
    const mountainCoords = [
      { x: -850, z: -920, rotY: 0.4, scale: normScale * 1.3, yOffset: -8 }, // Northwest
      { x: 950, z: 620, rotY: 2.2, scale: normScale * 1.5, yOffset: -12 }   // Southeast
    ];

    mountainCoords.forEach(mc => {
      const clone = baseModel.clone();
      const y = this.terrain.getBaseDuneHeight(mc.x, mc.z);
      clone.position.set(mc.x, y + mc.yOffset, mc.z);
      clone.rotation.y = mc.rotY;
      clone.scale.setScalar(mc.scale);
      this.scene.add(clone);
      this.mountainInstances.push(clone);
    });
  }

  // --- Frame Update: Rotate Celestial Sky Dome & Follow Camera ---
  update(dt, cameraPos) {
    if (this.skyboxAlien && cameraPos) {
      // Celestial sky moves with camera (infinite horizon effect)
      this.skyboxAlien.position.copy(cameraPos);
      this.skyboxAlien.rotation.y += dt * 0.0015; // Gentle celestial vault rotation
    }
  }
}
