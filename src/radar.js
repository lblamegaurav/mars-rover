import * as THREE from 'three';

export class MarsRadar {
  constructor(scene, itemsManager) {
    this.scene = scene;
    this.itemsManager = itemsManager;

    // Seismic shockwave pulse in 3D world
    this._initSeismicPulse();

    this.scanCooldown = 0;
    this.isScanning = false;
    this.scanRadius = 0;
    this.maxScanRadius = 750; // meters
  }

  _initSeismicPulse() {
    // 3D expanding ground ring mesh
    const ringGeom = new THREE.RingGeometry(0.8, 2.2, 64);
    ringGeom.rotateX(-Math.PI / 2);

    this.pulseMaterial = new THREE.MeshBasicMaterial({
      color: 0xba7640, // Muted dark amber ground pulse
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.pulseMesh = new THREE.Mesh(ringGeom, this.pulseMaterial);
    this.pulseMesh.position.y = -100;
    this.scene.add(this.pulseMesh);
  }

  triggerScan(roverPos) {
    if (this.isScanning) return;
    this.isScanning = true;
    this.scanRadius = 2.0;

    this.pulseMesh.position.set(roverPos.x, roverPos.y + 0.35, roverPos.z);
    this.pulseMesh.scale.set(1, 1, 1);
  }

  update(dt, roverPos, roverHeading) {
    // Update 3D expanding seismic shockwave
    if (this.isScanning) {
      this.scanRadius += dt * 280; // Speed of sound in Martian CO2 (~240 m/s)
      const scale = this.scanRadius;
      this.pulseMesh.scale.set(scale, 1, scale);

      // Fade out as it expands
      const progress = this.scanRadius / this.maxScanRadius;
      if (progress < 1.0) {
        this.pulseMaterial.opacity = (1.0 - progress) * 0.45;
      } else {
        this.isScanning = false;
        this.pulseMaterial.opacity = 0;
      }
    }

    // Calculate signals for all active items
    const signals = [];
    let closestItem = null;
    let minDistance = 999999;

    let forwardTarget = null;
    let minForwardDistance = 999999;

    this.itemsManager.items.forEach(item => {
      if (item.collected) return;

      const dx = item.x - roverPos.x;
      const dz = item.z - roverPos.z;
      const dist = Math.hypot(dx, dz);

      // Forward and Right unit vectors in world space
      const fwdX = -Math.sin(roverHeading);
      const fwdZ = -Math.cos(roverHeading);
      const rightX = Math.cos(roverHeading);
      const rightZ = -Math.sin(roverHeading);

      // 100% mathematically exact rover-relative projections:
      const fwdDist = dx * fwdX + dz * fwdZ;     // >0: front, <0: behind
      const rightDist = dx * rightX + dz * rightZ; // >0: right, <0: left

      const signalStrength = Math.max(0, Math.min(100, Math.round(100 - (dist / 1200) * 100)));

      const sigData = {
        item,
        dist: Math.round(dist),
        fwdDist,
        rightDist,
        signalStrength,
        isAhead: fwdDist > 0
      };

      signals.push(sigData);

      // Closest overall
      if (dist < minDistance) {
        minDistance = dist;
        closestItem = sigData;
      }

      // Closest uncollected artifact in front of the rover (forward hemisphere)
      if (fwdDist > 0 && dist < minForwardDistance) {
        minForwardDistance = dist;
        forwardTarget = sigData;
      }
    });

    // Primary target: Prioritize the target in front so distance counts down as you drive towards it!
    const activeTarget = forwardTarget || closestItem;

    return {
      signals,
      closestItem,
      forwardTarget,
      activeTarget,
      minDistance
    };
  }
}
