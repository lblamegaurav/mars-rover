import * as THREE from 'three';

export class MarsRover {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;

    // Movement state
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = 0;
    this.maxSpeed = 16.0; // m/s
    this.maxReverseSpeed = -7.0;
    this.accel = 12.0;
    this.decel = 8.0;
    this.brakeForce = 18.0;

    this.heading = 0; // Radians (Y rotation)
    this.steerAngle = 0;
    this.maxSteerAngle = 0.55; // ~31 deg
    this.steerSpeed = 2.2;

    this.pitch = 0;
    this.roll = 0;

    // Control inputs
    this.inputs = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      brake: false
    };

    // Lights
    this.headlightsOn = true;

    // Create 3D Mesh
    this.group = new THREE.Group();
    this.wheels = [];
    this.frontSteerAssemblies = [];
    this.rearSteerAssemblies = [];
    this._buildRoverModel();
    this.scene.add(this.group);

    // Dust particles from wheels
    this._initTireDust();

    // Position rover on terrain
    this.position.set(0, this.terrain.getHeight(0, 0), 0);
    this.update(0);
  }

  _buildRoverModel() {
    // --- Palette: Dark, Matte, Basalt & Weathered Metal (Dune-style brutalist sci-fi) ---
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1f1d1b, // Dark basalt composite
      roughness: 0.92,
      metalness: 0.15
    });

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x2b2622, // Weathered dark titanium plate
      roughness: 0.88,
      metalness: 0.25,
      flatShading: true
    });

    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x141312, // Dark ribbed alloy wheel
      roughness: 0.95,
      metalness: 0.3
    });

    const goldFoilMat = new THREE.MeshStandardMaterial({
      color: 0x6e5229, // Matte dark amber thermal kapton insulation
      roughness: 0.65,
      metalness: 0.4
    });

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c0e,
      roughness: 0.1,
      metalness: 0.9
    });

    // Procedural body container (swappable with GLB model)
    this.proceduralBody = new THREE.Group();
    this.group.add(this.proceduralBody);

    // 1. Main Chassis Hull (Chiseled angular prism)
    const chassisGeom = new THREE.BoxGeometry(2.2, 0.9, 3.4);
    const chassis = new THREE.Mesh(chassisGeom, chassisMat);
    chassis.position.y = 1.0;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.proceduralBody.add(chassis);

    // Armor Slanted Top Plates (Brutalist angles)
    const topPlateGeom = new THREE.CylinderGeometry(1.2, 1.4, 0.4, 6);
    const topPlate = new THREE.Mesh(topPlateGeom, armorMat);
    topPlate.position.set(0, 1.55, -0.2);
    topPlate.castShadow = true;
    this.proceduralBody.add(topPlate);

    // Thermal foil bay at rear
    const foilGeom = new THREE.BoxGeometry(1.6, 0.5, 0.9);
    const foilMesh = new THREE.Mesh(foilGeom, goldFoilMat);
    foilMesh.position.set(0, 1.35, 1.1);
    this.proceduralBody.add(foilMesh);

    // RTG Generator Cylinder (Rear power core)
    const rtgGeom = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 12);
    rtgGeom.rotateX(Math.PI / 2);
    const rtgMesh = new THREE.Mesh(rtgGeom, armorMat);
    rtgMesh.position.set(0, 1.25, 1.95);
    this.proceduralBody.add(rtgMesh);

    // 2. Sensor Mast & "Eyes" (Optical Camera Bar)
    const mastPoleGeom = new THREE.CylinderGeometry(0.06, 0.08, 1.4, 8);
    const mastPole = new THREE.Mesh(mastPoleGeom, armorMat);
    mastPole.position.set(0.45, 1.9, -1.1);
    mastPole.castShadow = true;
    this.proceduralBody.add(mastPole);

    // Sensor Head Housing (Dual camera lens head)
    const headGeom = new THREE.BoxGeometry(0.8, 0.32, 0.4);
    this.sensorHead = new THREE.Mesh(headGeom, armorMat);
    this.sensorHead.position.set(0.45, 2.65, -1.1);
    this.sensorHead.castShadow = true;
    this.proceduralBody.add(this.sensorHead);

    // Eye 1 (Left Optical Aperture)
    const eyeGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.15, 16);
    eyeGeom.rotateX(Math.PI / 2);
    const eye1 = new THREE.Mesh(eyeGeom, lensMat);
    eye1.position.set(-0.24, 0, -0.2);
    this.sensorHead.add(eye1);

    // Eye 2 (Right Optical Aperture)
    const eye2 = new THREE.Mesh(eyeGeom, lensMat);
    eye2.position.set(0.24, 0, -0.2);
    this.sensorHead.add(eye2);

    // Faint amber optical boot indicator inside sensor head
    const eyeIndicatorGeom = new THREE.SphereGeometry(0.03, 8, 8);
    const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xc87533 });
    const eyeGlow1 = new THREE.Mesh(eyeIndicatorGeom, eyeGlowMat);
    eyeGlow1.position.set(-0.24, 0, -0.26);
    this.sensorHead.add(eyeGlow1);

    const eyeGlow2 = new THREE.Mesh(eyeIndicatorGeom, eyeGlowMat);
    eyeGlow2.position.set(0.24, 0, -0.26);
    this.sensorHead.add(eyeGlow2);

    // Dish Antenna
    const dishGeom = new THREE.CylinderGeometry(0.5, 0.05, 0.18, 16, 1, true);
    dishGeom.rotateX(0.5);
    const dishMesh = new THREE.Mesh(dishGeom, armorMat);
    dishMesh.position.set(-0.6, 1.85, 0.5);
    this.proceduralBody.add(dishMesh);

    // 3. Forward Rover Headlights (Targeted Downwards onto Front Sand Terrain)
    this.headlights = [];

    const lightPositions = [
      new THREE.Vector3(-0.75, 0.75, -1.8),
      new THREE.Vector3(0.75, 0.75, -1.8)
    ];

    lightPositions.forEach((pos, idx) => {
      // Forward ground-sweeping spotlight aimed downwards at the sand (Brightened)
      const spotLight = new THREE.SpotLight(0xfff0dd, 52.0);
      spotLight.position.copy(pos);
      spotLight.angle = 0.88;
      spotLight.penumbra = 0.85; // Soft feathered falloff (no harsh circle)
      spotLight.decay = 1.5;
      spotLight.distance = 80;
      spotLight.castShadow = idx === 0;
      if (spotLight.castShadow) {
        spotLight.shadow.mapSize.width = 512;
        spotLight.shadow.mapSize.height = 512;
        spotLight.shadow.bias = -0.0008;
      }

      // Aimed downwards at the ground in front of rover (pools light directly onto sand dunes)
      const targetObj = new THREE.Object3D();
      targetObj.position.set(pos.x * 0.4, -0.65, -9.0);
      this.group.add(targetObj);
      spotLight.target = targetObj;

      this.group.add(spotLight);
      this.headlights.push(spotLight);

      // Compact physical lamp fixture on front bumper
      const housingGeom = new THREE.CylinderGeometry(0.10, 0.10, 0.12, 10);
      housingGeom.rotateX(Math.PI / 2);
      const housing = new THREE.Mesh(housingGeom, armorMat);
      housing.position.copy(pos);
      this.group.add(housing);
    });

    // Near-Ground Wide Floodlight (Brightly illuminates sand ripples directly ahead of front wheels)
    const groundFlood = new THREE.SpotLight(0xffe8c8, 45.0);
    groundFlood.position.set(0, 0.55, -1.85);
    groundFlood.angle = 1.25; // Wide soft coverage
    groundFlood.penumbra = 0.9;
    groundFlood.decay = 1.7;
    groundFlood.distance = 42;
    const floodTarget = new THREE.Object3D();
    floodTarget.position.set(0, -0.75, -5.5);
    this.group.add(floodTarget);
    groundFlood.target = floodTarget;
    this.group.add(groundFlood);
    this.headlights.push(groundFlood);

    // 4. Rocker-Bogie Suspension & 6 Heavy Wheels
    // Wheel coordinates relative to chassis (X, Z)
    const wheelOffsets = [
      { x: -1.45, z: -1.3, isFront: true },
      { x: 1.45, z: -1.3, isFront: true },
      { x: -1.55, z: 0.1, isMid: true },
      { x: 1.55, z: 0.1, isMid: true },
      { x: -1.45, z: 1.45, isRear: true },
      { x: 1.45, z: 1.45, isRear: true }
    ];

    const wheelRadius = 0.52;
    const wheelWidth = 0.42;

    wheelOffsets.forEach((cfg, idx) => {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(cfg.x, 0.55, cfg.z);
      this.group.add(steerPivot);

      if (cfg.isFront) this.frontSteerAssemblies.push(steerPivot);
      if (cfg.isRear) this.rearSteerAssemblies.push(steerPivot);

      // Suspension strut
      const strutGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8);
      const strut = new THREE.Mesh(strutGeom, armorMat);
      strut.position.set(0, 0.25, 0);
      steerPivot.add(strut);

      // Wheel mesh with tread grooves
      const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 18);
      wheelGeom.rotateZ(Math.PI / 2);

      const wheelMesh = new THREE.Mesh(wheelGeom, wheelMat);
      wheelMesh.castShadow = true;
      wheelMesh.receiveShadow = true;
      steerPivot.add(wheelMesh);

      // Hubcap detail
      const hubGeom = new THREE.CylinderGeometry(0.2, 0.2, wheelWidth + 0.05, 10);
      hubGeom.rotateZ(Math.PI / 2);
      const hubMesh = new THREE.Mesh(hubGeom, armorMat);
      steerPivot.add(hubMesh);

      this.wheels.push({
        mesh: wheelMesh,
        radius: wheelRadius,
        steerPivot: steerPivot,
        offsetX: cfg.x,
        offsetZ: cfg.z
      });
    });
  }

  _initTireDust() {
    // Particle system for sand/dust kicked up by spinning wheels
    const dustCount = 180;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(dustCount * 3);
    const alphas = new Float32Array(dustCount);
    this.dustLifetimes = new Float32Array(dustCount);
    this.dustVelocities = [];

    for (let i = 0; i < dustCount; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = -100; // start hidden
      positions[i * 3 + 2] = 0;
      alphas[i] = 0;
      this.dustLifetimes[i] = 1.0;
      this.dustVelocities.push(new THREE.Vector3());
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    // Custom shader material for soft dusty particle puffs
    this.dustMaterial = new THREE.PointsMaterial({
      size: 1.2,
      color: 0x482f20, // Matte red-brown Martian regolith
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.dustParticles = new THREE.Points(geom, this.dustMaterial);
    this.scene.add(this.dustParticles);
    this.dustCount = dustCount;
    this.dustIdx = 0;
  }

  _emitDustFromWheels() {
    if (Math.abs(this.velocity) < 0.8) return;

    const posAttr = this.dustParticles.geometry.attributes.position;
    const forwardDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);

    // Emit from 2 rear wheels or wheels slipping
    const emitOffsets = [
      this.wheels[4], // Left rear
      this.wheels[5]  // Right rear
    ];

    emitOffsets.forEach(w => {
      if (Math.random() > 0.45) return;
      const idx = this.dustIdx % this.dustCount;
      this.dustIdx++;

      // World pos of wheel contact patch
      const wheelPos = new THREE.Vector3(w.offsetX, 0.1, w.offsetZ)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading)
        .add(this.position);

      posAttr.setXYZ(idx, wheelPos.x, wheelPos.y, wheelPos.z);
      this.dustLifetimes[idx] = 0.0;

      // Dust blows backward opposite to travel + slight upward lift + Mars wind
      const vel = forwardDir.clone().multiplyScalar(-this.velocity * 0.35);
      vel.y = 0.4 + Math.random() * 0.6;
      vel.x += (Math.random() - 0.5) * 0.8 + 0.3; // prevailing wind drift
      vel.z += (Math.random() - 0.5) * 0.8;
      this.dustVelocities[idx].copy(vel);
    });

    posAttr.needsUpdate = true;
  }

  _updateDust(dt) {
    const posAttr = this.dustParticles.geometry.attributes.position;
    for (let i = 0; i < this.dustCount; i++) {
      if (this.dustLifetimes[i] < 1.0) {
        this.dustLifetimes[i] += dt * 1.4;
        const vx = this.dustVelocities[i].x;
        const vy = this.dustVelocities[i].y;
        const vz = this.dustVelocities[i].z;

        posAttr.setXYZ(
          i,
          posAttr.getX(i) + vx * dt,
          posAttr.getY(i) + vy * dt,
          posAttr.getZ(i) + vz * dt
        );
      } else {
        posAttr.setY(i, -999);
      }
    }
    posAttr.needsUpdate = true;
  }

  update(dt) {
    // 1. Process Steering
    let targetSteer = 0;
    if (this.inputs.left) targetSteer += this.maxSteerAngle;
    if (this.inputs.right) targetSteer -= this.maxSteerAngle;

    // Smoothly turn wheels
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1.0, dt * this.steerSpeed * 4.0);

    // Apply steering angle to wheel assemblies
    this.frontSteerAssemblies.forEach(p => {
      p.rotation.y = this.steerAngle;
    });
    // Counter-steer rear wheels slightly (planetary rover turn geometry)
    this.rearSteerAssemblies.forEach(p => {
      p.rotation.y = -this.steerAngle * 0.6;
    });

    // Turn heading based on speed and steering
    if (Math.abs(this.velocity) > 0.05) {
      const turnFactor = (this.velocity / this.maxSpeed) * this.steerAngle * 1.8;
      this.heading += turnFactor * dt;
    } else if (Math.abs(this.steerAngle) > 0.1 && (this.inputs.left || this.inputs.right)) {
      // Pivot turn in place at zero speed
      const pivotDir = this.inputs.left ? 1 : -1;
      this.heading += pivotDir * dt * 0.8;
    }

    // 2. Throttle & Braking
    if (this.inputs.brake) {
      if (this.velocity > 0) {
        this.velocity = Math.max(0, this.velocity - this.brakeForce * dt);
      } else if (this.velocity < 0) {
        this.velocity = Math.min(0, this.velocity + this.brakeForce * dt);
      }
    } else if (this.inputs.forward) {
      this.velocity = Math.min(this.maxSpeed, this.velocity + this.accel * dt);
    } else if (this.inputs.backward) {
      this.velocity = Math.max(this.maxReverseSpeed, this.velocity - this.accel * dt);
    } else {
      // Natural sand rolling drag / coasting
      if (this.velocity > 0) {
        this.velocity = Math.max(0, this.velocity - this.decel * dt);
      } else if (this.velocity < 0) {
        this.velocity = Math.min(0, this.velocity + this.decel * dt);
      }
    }

    // 3. Move along heading
    const moveDist = this.velocity * dt;
    this.position.x -= Math.sin(this.heading) * moveDist;
    this.position.z -= Math.cos(this.heading) * moveDist;

    // 4. Wheel & Chassis Conformance to Martian Terrain
    const frontProbeDist = 1.6;
    const sideProbeDist = 1.3;

    // Sample terrain around rover
    const frontZ = this.position.z - Math.cos(this.heading) * frontProbeDist;
    const frontX = this.position.x - Math.sin(this.heading) * frontProbeDist;
    const rearZ = this.position.z + Math.cos(this.heading) * frontProbeDist;
    const rearX = this.position.x + Math.sin(this.heading) * frontProbeDist;

    const leftZ = this.position.z + Math.sin(this.heading) * sideProbeDist;
    const leftX = this.position.x - Math.cos(this.heading) * sideProbeDist;
    const rightZ = this.position.z - Math.sin(this.heading) * sideProbeDist;
    const rightX = this.position.x + Math.cos(this.heading) * sideProbeDist;

    const hCenter = this.terrain.getHeight(this.position.x, this.position.z);
    const hFront = this.terrain.getHeight(frontX, frontZ);
    const hRear = this.terrain.getHeight(rearX, rearZ);
    const hLeft = this.terrain.getHeight(leftX, leftZ);
    const hRight = this.terrain.getHeight(rightX, rightZ);

    // Calculate maximum wheel contact height to ensure wheels always ride on the surface
    const surfaceContactHeight = Math.max(
      hCenter,
      (hFront + hRear) * 0.5,
      (hLeft + hRight) * 0.5,
      hFront,
      hRear
    ) + 0.14; // Suspension clearance buffer prevents wheel clipping into sand mesh

    // Immediate anti-burrow protection: rover can NEVER sink below the terrain surface
    if (this.position.y < surfaceContactHeight) {
      this.position.y = surfaceContactHeight;
    } else {
      // Smoothly settle downward with snappy suspension lerp
      this.position.y += (surfaceContactHeight - this.position.y) * Math.min(1.0, dt * 18.0);
    }

    // Pitch & Roll angles
    const targetPitch = Math.atan2(hFront - hRear, frontProbeDist * 2);
    const targetRoll = Math.atan2(hLeft - hRight, sideProbeDist * 2);

    this.pitch += (targetPitch - this.pitch) * Math.min(1.0, dt * 10.0);
    this.roll += (targetRoll - this.roll) * Math.min(1.0, dt * 10.0);

    // Apply transform to 3D object
    this.group.position.copy(this.position);
    this.group.rotation.set(0, this.heading, 0, 'YXZ');
    this.group.rotateX(this.pitch);
    this.group.rotateZ(-this.roll);

    // Rotate wheels
    const wheelRotDelta = moveDist / 0.52;
    this.wheels.forEach(w => {
      w.mesh.rotation.x += wheelRotDelta;
    });

    // Dust effects
    this._emitDustFromWheels();
    this._updateDust(dt);
  }

  setGLBModel(glbGroup) {
    this.glbRover = glbGroup;
    this.group.add(glbGroup);

    // Hide procedural body and wheels so the high-poly GLB model takes over cleanly
    if (this.proceduralBody) {
      this.proceduralBody.visible = false;
    }
    if (this.wheels) {
      this.wheels.forEach(w => {
        if (w.steerPivot) w.steerPivot.visible = false;
      });
    }
  }

  toggleHeadlights() {
    this.headlightsOn = !this.headlightsOn;
    this.headlights.forEach((l, i) => {
      // First 2 are spotlights (52.0), 3rd is ground flood (45.0)
      const baseIntensity = i < 2 ? 52.0 : 45.0;
      l.intensity = this.headlightsOn ? baseIntensity : 0.0;
    });
    return this.headlightsOn;
  }

  getSpeed() {
    return this.velocity;
  }
}
