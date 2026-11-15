import * as THREE from 'three';

// Fast Simplex Noise 2D implementation
class SimplexNoise {
  constructor(seed = 42) {
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];
    this.p = [];
    for (let i = 0; i < 256; i++) {
      this.p[i] = Math.floor(Math.abs(Math.sin(seed + i) * 10000)) % 256;
    }
    this.perm = new Array(512);
    this.gradP = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.gradP[i] = this.grad3[this.perm[i] % 12];
    }
  }

  dot2(g, x, y) {
    return g[0] * x + g[1] * y;
  }

  noise2D(xin, yin) {
    let n0, n1, n2;
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.gradP[ii + this.perm[jj]];
    const gi1 = this.gradP[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.gradP[ii + 1 + this.perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * this.dot2(gi0, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * this.dot2(gi1, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * this.dot2(gi2, x2, y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }
}

export class MarsTerrain {
  constructor(scene) {
    this.scene = scene;
    this.simplex = new SimplexNoise(1337);

    // Chunk configuration
    this.chunkSize = 140; // width of each square chunk in meters
    this.chunkResolution = 20; // 20x20 grid (optimal balance of smooth dunes & high FPS)
    this.viewRadius = 2; // 5x5 chunks around rover = 700m span
    this.chunks = new Map(); // key: "cx,cz" => { mesh, rocksGroup }

    // Asteroid holes / impact craters (very small & intermediate)
    this.craters = this._initCraterField();

    // Materials and Authentic PBR Textures
    this.terrainMaterial = this._createTerrainMaterial();
    this.rockMaterial = this._createRockMaterial();
  }

  // Deterministic impact crater field across the Martian dunes
  _initCraterField() {
    const craters = [];
    let seed = 849204;
    const rnd = () => {
      seed = (seed * 16807 + 11) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    // 1. Very small asteroid holes (radius 2.5 - 5.0m, depth 0.6 - 1.3m)
    for (let i = 0; i < 30; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = 24 + rnd() * 620;
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;
      const radius = 2.5 + rnd() * 2.5;
      const depth = 0.6 + rnd() * 0.7;
      craters.push({ x: cx, z: cz, radius, depth });
    }

    // 2. Intermediate asteroid holes (radius 8 - 18m, depth 1.6 - 3.0m)
    for (let i = 0; i < 16; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = 38 + rnd() * 580;
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;
      const radius = 8.0 + rnd() * 10.0;
      const depth = 1.6 + rnd() * 1.4;
      craters.push({ x: cx, z: cz, radius, depth });
    }

    return craters;
  }

  // Analytical crater depression and raised ejecta rim
  getCraterOffset(x, z) {
    let totalOffset = 0;
    for (let i = 0; i < this.craters.length; i++) {
      const c = this.craters[i];
      const dx = x - c.x;
      const dz = z - c.z;
      if (Math.abs(dx) > c.radius * 1.4 || Math.abs(dz) > c.radius * 1.4) continue;

      const dist = Math.hypot(dx, dz);
      if (dist < c.radius) {
        // Inner bowl depression (smooth parabolic depression)
        const norm = dist / c.radius;
        const bowl = -c.depth * (1.0 - norm * norm);
        totalOffset += bowl;
      } else if (dist < c.radius * 1.35) {
        // Raised ejecta rim ring
        const rimNorm = (dist - c.radius) / (c.radius * 0.35);
        const rim = Math.sin(rimNorm * Math.PI) * (c.depth * 0.24);
        totalOffset += rim;
      }
    }
    return totalOffset;
  }

  // Base procedural Martian sand dunes, transverse barchans, and rocky outcrops
  getBaseDuneHeight(x, z) {
    // 1. Broad rolling Martian dunes (low frequency, sweeping amplitude)
    const d1 = this.simplex.noise2D(x * 0.0032, z * 0.0032) * 14.0;

    // 2. Transverse Dune Ridges (asymmetric sharp crests like Dune barchans)
    const duneAngle = 0.785; // 45 deg prevailing wind direction
    const rx = x * Math.cos(duneAngle) - z * Math.sin(duneAngle);
    const rz = x * Math.sin(duneAngle) + z * Math.cos(duneAngle);
    const d2 = Math.sin(rx * 0.018 + this.simplex.noise2D(rx * 0.007, rz * 0.007) * 2.8) * 4.2;

    // 3. Rocky ridges & jagged outcrops (ridge noise)
    const rawRidge = 1.0 - Math.abs(this.simplex.noise2D(x * 0.011, z * 0.011));
    const d3 = Math.pow(Math.max(0, rawRidge), 2.4) * 6.5;

    // 4. Subtle fine ripples
    const d4 = this.simplex.noise2D(x * 0.038, z * 0.038) * 0.8;

    // 5. Geological features (Landmark Mesas and Ancient Basins)
    // East Outcrop Mesa (around 260, -160)
    const distMesa1 = Math.hypot(x - 260, z - (-160));
    const mesa1 = Math.max(0, 1.0 - distMesa1 / 65.0);
    const mesa1Height = Math.pow(mesa1, 1.8) * 9.5;

    // North-West Pillars (around -140, 350)
    const distMesa2 = Math.hypot(x - (-140), z - 350);
    const mesa2 = Math.max(0, 1.0 - distMesa2 / 70.0);
    const mesa2Height = Math.pow(mesa2, 1.8) * 11.0;

    // Aram Chaos Basin (around 380, 300)
    const distChaos = Math.hypot(x - 380, z - 300);
    const chaosFactor = Math.max(0, 1.0 - distChaos / 120.0);
    const chaosRough = (this.simplex.noise2D(x * 0.025, z * 0.025) * 4.0 - 2.0) * Math.pow(chaosFactor, 1.5);

    // Flatten starting crash zone around (0, 0) slightly so rover doesn't spawn inside a steep slope
    const distFromOrigin = Math.hypot(x, z);
    const startFactor = Math.min(1.0, distFromOrigin / 55.0);

    return (d1 + d2 + d3 + d4 + mesa1Height + mesa2Height + chaosRough) * (0.35 + 0.65 * startFactor);
  }

  // 100% continuous elevation: zero hollow geometry, zero underground clipping, zero seams
  getHeight(x, z) {
    return this.getBaseDuneHeight(x, z) + this.getCraterOffset(x, z);
  }

  // Calculate terrain normal analytically via central differences
  getNormal(x, z) {
    const eps = 0.5;
    const hL = this.getHeight(x - eps, z);
    const hR = this.getHeight(x + eps, z);
    const hD = this.getHeight(x, z - eps);
    const hU = this.getHeight(x, z + eps);

    const normal = new THREE.Vector3(hL - hR, 2 * eps, hD - hU);
    normal.normalize();
    return normal;
  }

  // Authentic Desert Beige Sand Texture (Calibrated Natural Desert Tan, fine dune variations)
  _createSandTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Natural Desert Sand Beige Base (Warm sand tan, NOT reddish)
    ctx.fillStyle = '#c5a682';
    ctx.fillRect(0, 0, 512, 512);

    // Natural undulating wind-drift shading
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0.0, 'rgba(215, 185, 150, 0.3)');
    grad.addColorStop(0.5, 'rgba(180, 150, 115, 0.22)');
    grad.addColorStop(1.0, 'rgba(225, 195, 160, 0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;

    // Soft microscopic mineral grain variation (fine velvety desert sand)
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + noise * 1.0));       // R
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 0.9)); // G (warm beige)
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.7)); // B
    }
    ctx.putImageData(imgData, 0, 0);

    // Subtle natural wind-blown sand ripples (very gentle, soft wavelets)
    ctx.fillStyle = 'rgba(185, 155, 120, 0.12)';
    for (let y = 0; y < 512; y += 18) {
      ctx.fillRect(0, y, 512, 8);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(18, 18);
    return texture;
  }

  _createSandNormalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(128, 128, 255)'; // Neutral flat tangent normal
    ctx.fillRect(0, 0, 256, 256);

    const imgData = ctx.getImageData(0, 0, 256, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const nx = (Math.random() - 0.5) * 12;
      const ny = (Math.random() - 0.5) * 12;
      data[i] = 128 + nx;
      data[i + 1] = 128 + ny;
      data[i + 2] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 24);
    return texture;
  }

  // Authentic Desert Regolith material: Calibrated beige sand, velvety dunes, 100% opaque
  _createTerrainMaterial() {
    const sandDiffuse = this._createSandTexture();
    const sandNormal = this._createSandNormalTexture();

    const mat = new THREE.MeshStandardMaterial({
      map: sandDiffuse,
      normalMap: sandNormal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.94,
      metalness: 0.01,
      color: new THREE.Color('#c5a682'), // Pure Natural Desert Sand Beige
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
      flatShading: false
    });

    return mat;
  }

  _createRockMaterial() {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#6e5a48'), // Natural desert basalt / weathered stone
      roughness: 0.92,
      metalness: 0.05,
      transparent: false,
      opacity: 1.0,
      flatShading: true
    });
  }

  // Update chunks around the rover's position
  update(roverX, roverZ) {
    const centerChunkX = Math.floor(roverX / this.chunkSize);
    const centerChunkZ = Math.floor(roverZ / this.chunkSize);

    const neededKeys = new Set();

    // Spawn chunks in view radius
    for (let dx = -this.viewRadius; dx <= this.viewRadius; dx++) {
      for (let dz = -this.viewRadius; dz <= this.viewRadius; dz++) {
        const cx = centerChunkX + dx;
        const cz = centerChunkZ + dz;
        const key = `${cx},${cz}`;
        neededKeys.add(key);

        if (!this.chunks.has(key)) {
          const chunkData = this._generateChunk(cx, cz);
          this.chunks.set(key, chunkData);
          this.scene.add(chunkData.mesh);
          if (chunkData.rocksGroup) {
            this.scene.add(chunkData.rocksGroup);
          }
        }
      }
    }

    // Prune distant chunks
    for (const [key, chunkData] of this.chunks.entries()) {
      if (!neededKeys.has(key)) {
        this.scene.remove(chunkData.mesh);
        chunkData.mesh.geometry.dispose();
        if (chunkData.rocksGroup) {
          this.scene.remove(chunkData.rocksGroup);
          chunkData.rocksGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
          });
        }
        this.chunks.delete(key);
      }
    }
  }

  _generateChunk(cx, cz) {
    const startX = cx * this.chunkSize;
    const startZ = cz * this.chunkSize;
    const res = this.chunkResolution;
    const geom = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, res, res);
    geom.rotateX(-Math.PI / 2); // Orient horizontally

    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      // Local x, z in plane geometry
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wx = startX + lx;
      const wz = startZ + lz;
      const wy = this.getHeight(wx, wz);
      pos.setY(i, wy);
    }

    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, this.terrainMaterial);
    mesh.position.set(startX, 0, startZ);
    mesh.receiveShadow = true;

    // Deterministic rock placement based on chunk coordinates
    const rocksGroup = this._generateChunkRocks(cx, cz);

    return { mesh, rocksGroup };
  }

  _generateChunkRocks(cx, cz) {
    const rocksGroup = new THREE.Group();
    // Pseudo-random generator for this chunk
    let seed = Math.abs(cx * 73856093 ^ cz * 19349663);
    const pseudoRand = () => {
      seed = (seed * 16807 + 11) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const numRocks = Math.floor(pseudoRand() * 6) + 4; // 4 to 9 boulders per chunk
    for (let i = 0; i < numRocks; i++) {
      const rx = (cx + pseudoRand() - 0.5) * this.chunkSize;
      const rz = (cz + pseudoRand() - 0.5) * this.chunkSize;

      // Don't spawn rocks directly on spawn point (within 15m of origin)
      if (Math.hypot(rx, rz) < 15) continue;

      const ry = this.getHeight(rx, rz);
      // Very small (0.25-0.5m) and intermediate (0.75-1.6m) rocks
      const isSmall = (i % 2 === 0);
      const scale = isSmall ? (0.25 + pseudoRand() * 0.25) : (0.75 + pseudoRand() * 0.85);

      // Natural weathered icosahedron rock
      const rockGeom = new THREE.IcosahedronGeometry(scale, 1);
      // Soft vertex distortion for natural desert rock shaping
      const pos = rockGeom.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        pos.setX(v, pos.getX(v) * (0.85 + pseudoRand() * 0.3));
        pos.setY(v, pos.getY(v) * (0.80 + pseudoRand() * 0.35));
        pos.setZ(v, pos.getZ(v) * (0.85 + pseudoRand() * 0.3));
      }
      rockGeom.computeVertexNormals();

      const rock = new THREE.Mesh(rockGeom, this.rockMaterial);
      rock.position.set(rx, ry + scale * 0.3, rz);
      rock.rotation.set(pseudoRand() * Math.PI, pseudoRand() * Math.PI, pseudoRand() * Math.PI);
      rock.castShadow = false; // Background rocks don't need expensive shadow map passes
      rock.receiveShadow = true;
      rocksGroup.add(rock);
    }

    return rocksGroup;
  }
}
