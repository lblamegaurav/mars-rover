import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { marsAudio } from './audio.js';

export class SurvivalMission {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.loader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();

    this.items = [];
    this.mixers = [];
    this.collectedCount = 0;
    this.totalCount = 10;
    this.totalScore = 0;
    this.targetScore = 7000000; // 7 Million target
    this.onItemCollected = null; // Callback for UI / audio

    // Shared Ethereal Energy Beam Texture
    this.energyBeamTexture = this.textureLoader.load('/textures/energy_beam.png');
    this.energyBeamTexture.wrapS = THREE.ClampToEdgeWrapping;
    this.energyBeamTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Pre-allocated Zero-Lag Martian Dust Cloud System
    this._initMartianDustCloud();

    // Pre-allocated Ground Shockwave
    this._initPreallocatedShockwave();

    // Crash site wreckage removed per user directive
    // this._createCrashSite();
    this._createCollectibleArtifacts();
  }

  // Pre-allocated static particle pool for zero garbage collection and rock-solid 60-90 FPS
  _initMartianDustCloud() {
    this.dustCount = 130;
    this.dustGeom = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.dustCount * 3);
    this.dustColors = new Float32Array(this.dustCount * 3);
    this.dustVelocities = [];

    // Realistic Matte Martian Regolith Palette (Dune dark terracotta, burnt sienna, umber)
    const dustPalette = [
      new THREE.Color('#6e3824'), // Terracotta red-brown
      new THREE.Color('#542c1c'), // Deep burnt sienna
      new THREE.Color('#7a432b'), // Warm sand dust
      new THREE.Color('#3d1e12'), // Dark basalt dust
      new THREE.Color('#8b4e33')  // Oxidized iron dust
    ];

    for (let i = 0; i < this.dustCount; i++) {
      this.dustPositions[i * 3 + 0] = 0;
      this.dustPositions[i * 3 + 1] = -1000; // Start off-screen
      this.dustPositions[i * 3 + 2] = 0;

      const col = dustPalette[i % dustPalette.length];
      this.dustColors[i * 3 + 0] = col.r;
      this.dustColors[i * 3 + 1] = col.g;
      this.dustColors[i * 3 + 2] = col.b;

      this.dustVelocities.push(new THREE.Vector3());
    }

    this.dustGeom.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dustGeom.setAttribute('color', new THREE.BufferAttribute(this.dustColors, 3));

    const dustTex = this.textureLoader.load('/textures/dust_particle.png');
    this.dustMat = new THREE.PointsMaterial({
      size: 4.8,
      map: dustTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending // Matte dust, NOT bright glowing neon!
    });

    this.dustPoints = new THREE.Points(this.dustGeom, this.dustMat);
    this.scene.add(this.dustPoints);

    this.dustActive = false;
    this.dustLife = 0;
    this.dustMaxLife = 1.9;
  }

  // Pre-allocated Expanding Shockwave Mesh (Zero Allocation)
  _initPreallocatedShockwave() {
    const geom = new THREE.RingGeometry(1.0, 2.2, 40);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x8a523a, // Matte burnt sienna dust ring
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.shockwaveMesh = new THREE.Mesh(geom, mat);
    this.shockwaveMesh.rotation.x = -Math.PI / 2;
    this.shockwaveMesh.position.set(0, -1000, 0);
    this.scene.add(this.shockwaveMesh);

    this.shockwaveActive = false;
    this.shockwaveLife = 0;
    this.shockwaveScale = 1.0;
  }

  // --- Spaceship Crash Site at Origin ---
  _createCrashSite() {
    this.crashGroup = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1c1a18, // Matte dark charred carbon titanium
      roughness: 0.92,
      metalness: 0.25,
      flatShading: true
    });

    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x2e251e,
      roughness: 0.95,
      metalness: 0.1
    });

    // 1. Broken main hull section
    const hullGeom = new THREE.CylinderGeometry(4.2, 5.0, 16, 12, 1, true);
    const hull = new THREE.Mesh(hullGeom, hullMat);
    hull.position.set(-6, 2.5, -12);
    hull.rotation.set(0.4, 0.6, -0.5);
    hull.castShadow = true;
    hull.receiveShadow = true;
    this.crashGroup.add(hull);

    // Inner exposed bulkheads
    const ribGeom = new THREE.TorusGeometry(4.3, 0.25, 8, 12);
    for (let r = -6; r <= 6; r += 3) {
      const rib = new THREE.Mesh(ribGeom, innerMat);
      rib.position.set(0, r, 0);
      rib.rotation.x = Math.PI / 2;
      hull.add(rib);
    }

    // 2. Shattered Thruster Engine Bell
    const engineGeom = new THREE.ConeGeometry(3.2, 5.5, 12, 1, true);
    const engine = new THREE.Mesh(engineGeom, hullMat);
    engine.position.set(11, 1.2, -6);
    engine.rotation.set(-0.8, -0.4, 0.7);
    engine.castShadow = true;
    this.crashGroup.add(engine);

    // 3. Torn wing/solar panel strut
    const strutGeom = new THREE.BoxGeometry(0.8, 11, 3.0);
    const strut = new THREE.Mesh(strutGeom, hullMat);
    strut.position.set(-14, 4.0, 8);
    strut.rotation.set(0.2, 0.3, 0.4);
    strut.castShadow = true;
    this.crashGroup.add(strut);

    // 4. Burning wreckage soot smoke
    this._addSmokeEmitter(this.crashGroup, new THREE.Vector3(-6, 4, -12));
    this._addSmokeEmitter(this.crashGroup, new THREE.Vector3(11, 2, -6));

    const groundH = this.terrain.getHeight(0, 0);
    this.crashGroup.position.set(0, groundH, 0);
    this.scene.add(this.crashGroup);
  }

  _addSmokeEmitter(parent, offset) {
    const smokeCount = 45;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i++) {
      pos[i * 3 + 0] = offset.x + (Math.random() - 0.5) * 0.8;
      pos[i * 3 + 1] = offset.y + Math.random() * 8;
      pos[i * 3 + 2] = offset.z + (Math.random() - 0.5) * 0.8;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.2,
      color: 0x221812,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });
    parent.add(new THREE.Points(geom, mat));
  }

  // --- Real 3D GLB Collectibles Distributed Across Acidalia Planitia ---
  _createCollectibleArtifacts() {
    const artifactDefs = [
      {
        id: 'gyroscope',
        modelPath: '/models/collectibles/magical_gyroscope.glb',
        name: 'Quantum Gravitational Gyroscope',
        type: 'AVIONICS CORE',
        desc: 'Precessing hyper-dimensional gimbal core stabilizing deep-space orbital vectors.',
        x: 290,
        z: -140,
        glowColor: 0x38bdf8, // Brilliant Cyan
        points: 1000000,
        targetSize: 2.6,
        hoverHeight: 2.2
      },
      {
        id: 'pragyan',
        modelPath: '/models/collectibles/pragyan_rover.glb',
        name: 'ISRO Pragyan Exploration Relic',
        type: 'HISTORIC EXPLORER',
        desc: 'Pioneering planetary autonomous rover unit carrying alpha spectrometer arrays.',
        x: -140,
        z: 350,
        glowColor: 0xf59e0b, // Amber Gold
        points: 1000000,
        targetSize: 2.8,
        hoverHeight: 2.0
      },
      {
        id: 'plant',
        modelPath: '/models/collectibles/plant.glb',
        name: 'Bio-Dome Botanical Specimen',
        type: 'GREENHOUSE FLORA',
        desc: 'Cryo-preserved Martian photosynthetic hybrid plant engineered for atmospheric oxygenation.',
        x: -360,
        z: -260,
        glowColor: 0x10b981, // Emerald Green
        points: 1000000,
        targetSize: 2.5,
        hoverHeight: 2.2
      },
      {
        id: 'safe',
        modelPath: '/models/collectibles/antique_iron_safe.glb',
        name: 'Reinforced Cryo-Safe Repository',
        type: 'SECURE ARCHIVE',
        desc: 'Heavy tungsten-iron security vault safeguarding colonization mission gene-banks.',
        x: 380,
        z: 300,
        glowColor: 0xeab308, // Luminous Gold
        points: 1000000,
        targetSize: 2.4,
        hoverHeight: 2.0
      },
      {
        id: 'beermug',
        modelPath: '/models/collectibles/wip-6_infinite_beer_mug_from_the_future.glb',
        name: 'Infinite Hydro-Synthesizer Flask',
        type: 'LIFE SUPPORT',
        desc: 'Holographic molecular beverage synthesizer delivering infinite purified hydration.',
        x: -520,
        z: 420,
        glowColor: 0x06b6d4, // Neon Cyan
        points: 1000000,
        targetSize: 2.3,
        hoverHeight: 2.1
      },
      {
        id: 'vasebot',
        modelPath: '/models/collectibles/vase_bot_clemchenscreation.glb',
        name: 'Autonomous Vase-Bot Drone',
        type: 'AUTOMATION PROBE',
        desc: 'Cybernetic self-balancing bipedal probe with atmospheric sensing telemetry.',
        x: 580,
        z: -480,
        glowColor: 0xa855f7, // Deep Violet
        points: 1000000,
        targetSize: 2.5,
        hoverHeight: 2.2
      },
      {
        id: 'detainer',
        modelPath: '/models/collectibles/pro4ik_astro_detainer_arm_test_2.glb',
        name: 'Exo-Hydraulic Detainer Arm',
        type: 'ROBOTIC MANIPULATOR',
        desc: 'Heavy titanium servo-manipulator arm capable of 12-ton hydraulic excavation.',
        x: -690,
        z: -510,
        glowColor: 0xef4444, // Energetic Crimson
        points: 1000000,
        targetSize: 2.6,
        hoverHeight: 2.4
      },
      {
        id: 'blackbox',
        modelPath: '/models/collectibles/the_broken_end.glb',
        name: 'Orbital Descent Telemetry Blackbox',
        type: 'COMMUNICATIONS',
        desc: 'Sub-surface emergency distress beacon transmitting blackbox crash telemetry.',
        x: 180,
        z: 780,
        glowColor: 0xf97316, // Radiant Orange
        points: 1000000,
        targetSize: 2.4,
        hoverHeight: 2.0
      },
      {
        id: 'geishamask',
        modelPath: '/models/collectibles/ghost_in_the_shell_geisha_mask.glb',
        name: 'Synthetic AI Neural Matrix',
        type: 'SECRET ARTIFACT',
        desc: 'Ancient cybernetic android visage embedding a dormant synthetic persona core.',
        x: 450,
        z: -180,
        glowColor: 0xec4899, // Cyberpunk Pink
        points: 1000000,
        targetSize: 2.4,
        hoverHeight: 2.2
      },
      {
        id: 'teslatequila',
        modelPath: '/models/collectibles/free_tesla_tequila.glb',
        name: 'Lightning Bio-Ethanol Catalyst',
        type: 'SECRET ARTIFACT',
        desc: 'High-voltage lightning decanter containing ultra-concentrated rocket propellant.',
        x: -280,
        z: 620,
        glowColor: 0x3b82f6, // Electric Blue
        points: 1000000,
        targetSize: 2.5,
        hoverHeight: 2.3
      }
    ];

    this.totalCount = artifactDefs.length;

    artifactDefs.forEach((def, index) => {
      const groundY = this.terrain.getHeight(def.x, def.z);
      const rootGroup = new THREE.Group();
      rootGroup.position.set(def.x, groundY, def.z);

      // 1. Floating & Bobbing Container Group
      const floatGroup = new THREE.Group();
      floatGroup.position.y = def.hoverHeight;
      rootGroup.add(floatGroup);

      // 2. Model Container (holds 3D GLB with auto-centering & rotation)
      const modelContainer = new THREE.Group();
      floatGroup.add(modelContainer);

      // Placeholder wireframe icosahedron while GLB loads
      const placeholderGeom = new THREE.IcosahedronGeometry(def.targetSize * 0.45, 1);
      const placeholderMat = new THREE.MeshBasicMaterial({
        color: def.glowColor,
        wireframe: true,
        transparent: true,
        opacity: 0.6
      });
      const placeholderMesh = new THREE.Mesh(placeholderGeom, placeholderMat);
      modelContainer.add(placeholderMesh);

      // Async GLB Loader
      this.loader.load(
        def.modelPath,
        (gltf) => {
          const model = gltf.scene;

          // Compute natural bounding box
          const box = new THREE.Box3().setFromObject(model);
          const center = new THREE.Vector3();
          box.getCenter(center);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z) || 1.0;

          // Normalize scale uniformly to targetSize
          const scaleFactor = def.targetSize / maxDim;
          model.scale.setScalar(scaleFactor);

          // Center geometry pivot point exactly at origin (0, 0, 0)
          model.position.set(-center.x * scaleFactor, -center.y * scaleFactor, -center.z * scaleFactor);

          // Configure shadows & materials
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                // Enhance subtle emissive response
                if (child.material.emissive && !child.material.emissiveMap) {
                  child.material.emissive.setHex(def.glowColor);
                  child.material.emissiveIntensity = 0.15;
                }
              }
            }
          });

          // Play built-in animations if present
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            gltf.animations.forEach((clip) => {
              mixer.clipAction(clip).play();
            });
            itemObj.mixer = mixer;
            this.mixers.push(mixer);
          }

          // Remove placeholder and mount real GLB
          modelContainer.remove(placeholderMesh);
          if (placeholderGeom) placeholderGeom.dispose();
          if (placeholderMat) placeholderMat.dispose();

          modelContainer.add(model);
          itemObj.loadedModel = model;
        },
        undefined,
        (err) => {
          console.warn(`Could not load artifact ${def.id}:`, err);
        }
      );

      // 3. AURA LIGHTING EFFECT: Dynamic Point Light (illuminates ground & rocks)
      const pointLight = new THREE.PointLight(def.glowColor, 8.5, 30, 1.4);
      pointLight.position.set(0, 0.4, 0);
      floatGroup.add(pointLight);

      // 4. AURA LIGHTING EFFECT: Concentric Orbiting Inner Torus
      const torusGeom = new THREE.TorusGeometry(def.targetSize * 0.72, 0.035, 8, 36);
      const torusMat = new THREE.MeshBasicMaterial({
        color: def.glowColor,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const innerTorus = new THREE.Mesh(torusGeom, torusMat);
      innerTorus.rotation.x = Math.PI / 4;
      floatGroup.add(innerTorus);

      // 5. AURA LIGHTING EFFECT: Expanding Pulsing Horizontal Halo Ring
      const ringGeom = new THREE.RingGeometry(def.targetSize * 0.85, def.targetSize * 1.25, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: def.glowColor,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const outerRing = new THREE.Mesh(ringGeom, ringMat);
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = -def.hoverHeight * 0.35;
      floatGroup.add(outerRing);

      // 6. AURA LIGHTING EFFECT: Ground Projected Energy Decal (Directly on Red Sand)
      const decalGeom = new THREE.RingGeometry(def.targetSize * 0.9, def.targetSize * 1.35, 32);
      const decalMat = new THREE.MeshBasicMaterial({
        color: def.glowColor,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const groundDecal = new THREE.Mesh(decalGeom, decalMat);
      groundDecal.rotation.x = -Math.PI / 2;
      groundDecal.position.y = 0.06; // Hugs terrain surface
      rootGroup.add(groundDecal);

      // 7. ETHEREAL SKY BEAM: Translucent non-solid shimmering energy pillar streaming to space (Soft & Fader)
      const beamHeight = 160;
      const beamPlaneGeom = new THREE.PlaneGeometry(3.6, beamHeight, 1, 1);
      beamPlaneGeom.translate(0, beamHeight / 2, 0); // Base anchored at ground
      const beamMat = new THREE.MeshBasicMaterial({
        map: this.energyBeamTexture,
        color: def.glowColor,
        transparent: true,
        opacity: 0.26, // Soft translucent ethereal shimmer requested by user
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      const skyBeamGroup = new THREE.Group();
      const plane1 = new THREE.Mesh(beamPlaneGeom, beamMat);
      const plane2 = new THREE.Mesh(beamPlaneGeom, beamMat);
      plane2.rotation.y = Math.PI / 2; // Perpendicular crossed plane
      const plane3 = new THREE.Mesh(beamPlaneGeom, beamMat);
      plane3.rotation.y = Math.PI / 4; // Diagonal crossed plane for full volume

      skyBeamGroup.add(plane1);
      skyBeamGroup.add(plane2);
      skyBeamGroup.add(plane3);
      skyBeamGroup.position.y = 0.2;
      rootGroup.add(skyBeamGroup);

      this.scene.add(rootGroup);

      const itemObj = {
        ...def,
        rootGroup,
        floatGroup,
        modelContainer,
        pointLight,
        innerTorus,
        outerRing,
        groundDecal,
        skyBeam: skyBeamGroup,
        beamMat,
        shimmerPoints: null, // Particles removed around collectibles as requested
        loadedModel: null,
        mixer: null,
        collected: false,
        exploding: false,
        explodeTime: 0,
        animTime: Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
        baseHoverY: def.hoverHeight
      };

      this.items.push(itemObj);
    });
  }

  // --- Frame Update: Smooth Hovering, Rotation & Overkilled FX ---
  update(dt, roverPos) {
    // Update active GLB animation mixers
    this.mixers.forEach((m) => m.update(dt));

    let closestDist = 999999;
    let closestItem = null;

    this.items.forEach((item) => {
      if (item.collected && !item.exploding) return;

      const dist = Math.hypot(roverPos.x - item.x, roverPos.z - item.z);
      if (!item.collected && dist < closestDist) {
        closestDist = dist;
        closestItem = item;
      }

      item.animTime += dt;

      // --- 1. ENERGETIC LIGHT & ENERGY FLOW DE-MATERIALIZATION (NO PARTICLES) ---
      if (item.exploding) {
        item.explodeTime += dt;
        const duration = 1.25;
        const progress = Math.min(1.0, item.explodeTime / duration);
        const energySurge = Math.sin(progress * Math.PI);

        // 1. Sky Beam: Surges into a luminous vertical energy conduit streaming upwards
        if (item.skyBeam && item.beamMat) {
          item.beamMat.opacity = Math.max(0, 0.22 + energySurge * 0.68 - progress * 0.25);
          item.skyBeam.rotation.y += dt * 4.2;
          const beamW = 1.0 + energySurge * 0.55;
          item.skyBeam.scale.set(beamW, 1.0 + progress * 0.4, beamW);
          if (item.beamMat.map) {
            item.beamMat.map.offset.y -= dt * 6.5; // Rapid vertical energy flow scrolling to space
          }
        }

        // 2. Artifact Model: De-materializes into pure vertical light stream
        item.modelContainer.rotation.y += dt * 16.0;
        item.modelContainer.scale.y += dt * 9.0; // Stretches vertically along light beam
        item.modelContainer.scale.x = Math.max(0.01, item.modelContainer.scale.x * (1.0 - dt * 2.8));
        item.modelContainer.scale.z = Math.max(0.01, item.modelContainer.scale.z * (1.0 - dt * 2.8));
        item.floatGroup.position.y += dt * (14.0 + progress * 32.0); // Ascends skyward into space

        item.modelContainer.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.opacity = Math.max(0, 1.0 - progress * 1.3);
          }
        });

        // 3. Concentric Aura Energy Rings: Expand and rocket upwards along the beam
        if (item.innerTorus) {
          item.innerTorus.rotation.y += dt * 22.0;
          item.innerTorus.rotation.x += dt * 14.0;
          item.innerTorus.position.y += dt * 26.0;
          item.innerTorus.scale.multiplyScalar(1.0 + dt * 3.0);
          item.innerTorus.material.opacity = Math.max(0, (1.0 - progress) * 0.95);
        }

        if (item.outerRing) {
          item.outerRing.position.y += dt * 28.0;
          item.outerRing.scale.multiplyScalar(1.0 + dt * 3.6);
          item.outerRing.material.opacity = Math.max(0, (1.0 - progress) * 0.8);
        }

        // 4. Ground Decal: Smooth energy shockwave ripple expanding outward
        if (item.groundDecal) {
          item.groundDecal.scale.multiplyScalar(1.0 + dt * 4.2);
          item.groundDecal.material.opacity = Math.max(0, (1.0 - progress) * 0.65);
        }

        // 5. Point Light: Energy flash
        if (item.pointLight) {
          item.pointLight.intensity = Math.max(0, (1.0 - progress) * 18.0);
        }

        if (progress >= 1.0) {
          item.exploding = false;
          item.rootGroup.visible = false;
        }
        return;
      }

      // --- 2. IDLE FLOATING & SLOW ROTATION ---
      // Harmonic dual-sine hover bobbing
      const hoverOffset =
        Math.sin(item.animTime * 2.2 + item.phase) * 0.28 +
        Math.cos(item.animTime * 1.1) * 0.08;
      item.floatGroup.position.y = item.baseHoverY + hoverOffset;

      // Slow majestic 3D rotation (accelerates on close rover approach)
      const rotSpeed = dist < 22 ? 2.6 : 0.85;
      item.modelContainer.rotation.y += dt * rotSpeed;
      item.modelContainer.rotation.x = Math.sin(item.animTime * 1.4) * 0.12;
      item.modelContainer.rotation.z = Math.cos(item.animTime * 1.2) * 0.10;

      // Concentric aura ring counter-rotation & pulsing
      item.innerTorus.rotation.y -= dt * 1.8;
      item.innerTorus.rotation.x += dt * 0.9;
      const ringPulse = 1.0 + Math.sin(item.animTime * 3.2) * 0.18;
      item.outerRing.scale.set(ringPulse, ringPulse, ringPulse);
      item.outerRing.material.opacity = 0.35 + Math.sin(item.animTime * 2.8) * 0.18;

      // Ground decal breathing
      item.groundDecal.scale.set(1.0 + Math.sin(item.animTime * 2.0) * 0.12, 1.0 + Math.sin(item.animTime * 2.0) * 0.12, 1.0);

      // Sky beam gentle continuous rotation & subtle fader opacity pulse
      if (item.skyBeam) {
        item.skyBeam.rotation.y += dt * 0.35;
      }
      if (item.beamMat) {
        item.beamMat.opacity = 0.22 + Math.sin(item.animTime * 2.2) * 0.08;
      }

      // Distance-based dynamic light culling (HUGE 90-FPS GPU OPTIMIZATION)
      if (dist < 75) {
        // Active and pulsing
        const lightPulse = dist < 22 ? 14.0 : 8.0 + Math.sin(item.animTime * 3.5) * 2.5;
        item.pointLight.intensity = lightPulse;
      } else {
        item.pointLight.intensity = 0.0;
      }

      // --- 3. COLLECTION CHECK (< 5.0m from rover) ---
      if (dist < 5.0) {
        this.collectItem(item, roverPos);
      }
    });
  }

  // --- COLLECTION TRIGGER ---
  collectItem(item, roverPos) {
    if (item.collected) return;
    item.collected = true;
    item.exploding = true;
    item.explodeTime = 0.0;
    this.collectedCount++;

    // Switch model materials to energetic glowing mode (de-materialization surge)
    item.modelContainer.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.transparent = true;
        if (child.material.emissive) {
          child.material.emissive.setHex(item.glowColor);
          child.material.emissiveIntensity = 2.4;
        }
      }
    });

    // Notify UI (plays collectsound.mp3 and toast "ARTIFACT [N] COLLECTED")
    if (this.onItemCollected) {
      this.onItemCollected(item, this.collectedCount, this.totalCount);
    }
  }

  // --- ZERO-ALLOCATION DUST CLOUD BURST (60-90 FPS OPTIMIZED) ---
  _triggerMartianDustBurst(x, y, z) {
    this.dustActive = true;
    this.dustLife = 0.0;
    this.dustMat.opacity = 0.95;

    const pos = this.dustPositions;
    for (let i = 0; i < this.dustCount; i++) {
      // Emitter origin with subtle spatial spread
      pos[i * 3 + 0] = x + (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 1] = y + (Math.random() - 0.5) * 1.0;
      pos[i * 3 + 2] = z + (Math.random() - 0.5) * 1.5;

      // Realistic billowing dust outward & upward velocities
      const theta = Math.random() * Math.PI * 2;
      const speed = 4.5 + Math.random() * 8.5; // Gentle expanding billow, not explosive laser neon
      const upSpeed = 2.0 + Math.random() * 6.0;

      this.dustVelocities[i].set(
        Math.cos(theta) * speed,
        upSpeed,
        Math.sin(theta) * speed
      );
    }

    this.dustGeom.attributes.position.needsUpdate = true;
  }

  _updateMartianDust(dt) {
    if (!this.dustActive) return;

    this.dustLife += dt;
    const t = this.dustLife / this.dustMaxLife;

    if (t >= 1.0) {
      this.dustActive = false;
      this.dustMat.opacity = 0.0;
      return;
    }

    // Billowing dust: opacity fades out gently over time
    this.dustMat.opacity = Math.max(0, 0.95 * Math.pow(1.0 - t, 1.2));
    this.dustMat.size = 4.8 + t * 6.5; // Dust cloud expands as it dissipates!

    const pos = this.dustPositions;
    for (let i = 0; i < this.dustCount; i++) {
      const vel = this.dustVelocities[i];
      // Martian gravity (3.7 m/s^2)
      vel.y -= 3.7 * dt;
      // Atmospheric drag
      vel.multiplyScalar(0.96);

      pos[i * 3 + 0] += vel.x * dt;
      pos[i * 3 + 1] += vel.y * dt;
      pos[i * 3 + 2] += vel.z * dt;
    }

    this.dustGeom.attributes.position.needsUpdate = true;
  }

  // --- ZERO-ALLOCATION EXPANDING GROUND SHOCKWAVE ---
  _triggerShockwave(x, z) {
    const groundY = this.terrain.getHeight(x, z) + 0.12;
    this.shockwaveMesh.position.set(x, groundY, z);
    this.shockwaveActive = true;
    this.shockwaveLife = 0.0;
    this.shockwaveScale = 1.0;
    this.shockwaveMesh.material.opacity = 0.85;
    this.shockwaveMesh.scale.set(1, 1, 1);
  }

  _updateShockwave(dt) {
    if (!this.shockwaveActive) return;

    this.shockwaveLife += dt;
    this.shockwaveScale += dt * 28.0; // Expands outward along red dunes
    const op = Math.max(0, 0.85 - this.shockwaveLife * 1.4);

    this.shockwaveMesh.scale.set(this.shockwaveScale, this.shockwaveScale, 1.0);
    this.shockwaveMesh.material.opacity = op;

    if (this.shockwaveLife > 0.75) {
      this.shockwaveActive = false;
      this.shockwaveMesh.material.opacity = 0.0;
      this.shockwaveMesh.position.set(0, -1000, 0);
    }
  }

  isMissionComplete() {
    return this.collectedCount >= this.totalCount;
  }
}
