import * as THREE from 'three';

export class MarsAtmosphere {
  constructor(scene) {
    this.scene = scene;

    // Palette: Luminous dark cosmic twilight, visible starry heavens, warm Dune desert
    this.fogColor = new THREE.Color(0x382e24); // Rich warm dusty beige horizon fog
    this.skyColor = new THREE.Color(0x0c0914); // Deep space cosmic indigo

    this.scene.background = this.skyColor;

    this._setupFogAndLighting();
  }

  _setupFogAndLighting() {
    // 1. Softer Atmospheric Fog (allows cosmic sky and distant mountains to shine!)
    this.scene.fog = new THREE.FogExp2(this.fogColor, 0.00125);

    // 2. Balanced Ambient & Cinematic Lighting (Natural Desert Beige Sunlight)
    // Ambient light: Warm beige sand bounce
    const ambientLight = new THREE.AmbientLight(0x756350, 1.05);
    this.scene.add(ambientLight);

    // Deep space celestial fill light from zenith (soft cosmic indigo)
    const skyFillLight = new THREE.DirectionalLight(0x657588, 0.42);
    skyFillLight.position.set(0, 500, 0);
    this.scene.add(skyFillLight);

    // Directional sunlight casting natural crisp dune shadows
    const dirLight = new THREE.DirectionalLight(0xffecd4, 1.85);
    dirLight.position.set(420, 260, -560);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 50;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.bias = -0.0006;
    this.scene.add(dirLight);
    this.sunLight = dirLight;
  }

  update(dt, playerX, playerZ, terrain) {
    this.time += dt;

    // Keep sunlight shadow camera centered on rover
    if (this.sunLight) {
      this.sunLight.position.set(playerX + 90, 110, playerZ - 120);
      this.sunLight.target.position.set(playerX, 0, playerZ);
      this.sunLight.target.updateMatrixWorld();
    }
  }
}
