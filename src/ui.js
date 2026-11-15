import { marsAudio } from './audio.js';

export class MarsUI {
  constructor(rover, radar, itemsManager, onCameraToggle, onGfxToggle, onPerspectiveSet) {
    this.rover = rover;
    this.radar = radar;
    this.itemsManager = itemsManager;
    this.onCameraToggle = onCameraToggle;
    this.onGfxToggle = onGfxToggle;
    this.onPerspectiveSet = onPerspectiveSet;

    this.isWakeComplete = false;
    this.startTime = 0;
    this.elapsedSeconds = 0;
    this.totalTraversedMeters = 0;
    this.lastRoverPos = null;

    // DOM Elements
    this.canvasContainer = document.getElementById('canvas-container');
    this.wakeScreen = document.getElementById('wake-screen');
    this.eyelidTop = document.getElementById('eyelid-top');
    this.eyelidBottom = document.getElementById('eyelid-bottom');
    this.wakeCalibrationHud = document.getElementById('wake-calibration-hud');
    this.wakeTitle = document.getElementById('wake-title');
    this.wakeSubtitle = document.getElementById('wake-subtitle');
    this.skipWakeBtn = document.getElementById('skip-wake-btn');

    this.startModal = document.getElementById('start-modal');
    this.hud = document.getElementById('hud');

    this.teleSpeed = document.getElementById('tele-speed');
    this.teleHeading = document.getElementById('tele-heading');
    this.teleDist = document.getElementById('tele-dist');
    this.teleTime = document.getElementById('tele-time');

    this.compassTape = document.getElementById('compass-tape');
    this.sonarCanvas = document.getElementById('sonar-canvas');
    this.sonarCtx = this.sonarCanvas ? this.sonarCanvas.getContext('2d') : null;
    this.sonarDistLabel = document.getElementById('sonar-distance-label');
    this.radarSignalDb = document.getElementById('radar-signal-db');

    this.proximityBanner = document.getElementById('proximity-banner');
    this.proximityText = document.getElementById('proximity-target-text');
    this.missionToast = document.getElementById('mission-toast');

    this.leaderboardModal = document.getElementById('leaderboard-modal');
    this.helpModal = document.getElementById('help-modal');
    this.victoryModal = document.getElementById('victory-modal');

    // Telemetry Panel Canvases (Image 2 Restored)
    this.alertCanvas = document.getElementById('alert-tolerance-canvas');
    this.alertCtx = this.alertCanvas ? this.alertCanvas.getContext('2d') : null;
    this.seismicCanvas = document.getElementById('seismic-vibration-canvas');
    this.seismicCtx = this.seismicCanvas ? this.seismicCanvas.getContext('2d') : null;
    this.telemetryTime = 0;

    // Speedometer & Fuel Gauge (Image 2 & 3)
    this.speedoCanvas = document.getElementById('speedometer-canvas');
    this.speedoCtx = this.speedoCanvas ? this.speedoCanvas.getContext('2d') : null;
    this.speedoDigitalDisplay = document.getElementById('speedo-digital-display');
    this.fuelFillBar = document.getElementById('fuel-fill-bar');
    this.fuelPercentText = document.getElementById('fuel-gauge-percent');
    this.fuel = 82.0; // 0 to 100%

    this.sonarSweepAngle = 0;

    this._setupCompassTape();
    this._setupControls();
    this._setupModals();
    this._initLeaderboard();
  }

  // --- Start Game & Optical Wake Sequence ---
  startWakeSequence() {
    this.startModal.style.display = 'none';
    this.wakeScreen.style.display = 'flex';
    this.skipWakeBtn.style.display = 'block';

    marsAudio.init();
    marsAudio.resume();
    marsAudio.playWakeupSequence();

    // Initial blurry closed state
    this.canvasContainer.style.filter = 'blur(28px) brightness(0.4) saturate(0.6)';
    this.eyelidTop.style.height = '50%';
    this.eyelidBottom.style.height = '50%';
    this.wakeCalibrationHud.style.opacity = '1';

    // Step 1: Eyelids flutter slightly open (1.4s)
    setTimeout(() => {
      if (this.isWakeComplete) return;
      this.eyelidTop.style.height = '43%';
      this.eyelidBottom.style.height = '43%';
      this.canvasContainer.style.filter = 'blur(22px) brightness(0.55) saturate(0.7)';
      if (this.wakeTitle) this.wakeTitle.textContent = 'OPTICAL APERTURE FLUTTER...';
      if (this.wakeSubtitle) this.wakeSubtitle.innerHTML = 'ATMOSPHERIC PRESSURE: 0.636 kPa<br>ACIDALIA PLANITIA HORIZON DETECTED';
    }, 1400);

    // Step 2: Glitch and slam shut (2.5s)
    setTimeout(() => {
      if (this.isWakeComplete) return;
      this.eyelidTop.style.height = '49%';
      this.eyelidBottom.style.height = '49%';
      this.canvasContainer.style.filter = 'blur(26px) brightness(0.4) saturate(0.5)';
      if (this.wakeTitle) this.wakeTitle.textContent = 'OPTICAL SENSOR RE-ALIGNMENT...';
    }, 2500);

    // Step 3: Open halfway & blur starts clearing (3.6s)
    setTimeout(() => {
      if (this.isWakeComplete) return;
      this.eyelidTop.style.height = '24%';
      this.eyelidBottom.style.height = '24%';
      this.canvasContainer.style.filter = 'blur(12px) brightness(0.85) saturate(0.85)';
      if (this.wakeTitle) this.wakeTitle.textContent = 'DUAL MAST LENSES SYNCHRONIZING...';
      if (this.wakeSubtitle) this.wakeSubtitle.innerHTML = 'RECOVERY PROTOCOL LOADED<br>AEGIS-7 WRECKAGE CONFIRMED';
    }, 3600);

    // Step 4: Fully retract eyelids, blur drops to ZERO! (5.2s)
    setTimeout(() => {
      if (this.isWakeComplete) return;
      this.eyelidTop.style.height = '0%';
      this.eyelidBottom.style.height = '0%';
      this.canvasContainer.style.filter = 'blur(0px) brightness(1.0) saturate(1.0)';
      this.wakeCalibrationHud.style.opacity = '0';
      if (this.wakeTitle) this.wakeTitle.textContent = 'ALL SENSORS ONLINE';
    }, 5200);

    // Step 5: Complete wake & reveal in-game HUD (6.2s)
    setTimeout(() => {
      this.completeWake();
    }, 6200);
  }

  completeWake() {
    if (this.isWakeComplete) return;
    this.isWakeComplete = true;

    if (this.startModal) this.startModal.style.display = 'none';
    this.eyelidTop.style.height = '0%';
    this.eyelidBottom.style.height = '0%';
    this.canvasContainer.style.filter = 'none';
    this.wakeScreen.style.setProperty('display', 'none', 'important');
    if (this.wakeCalibrationHud) this.wakeCalibrationHud.style.display = 'none';
    if (this.skipWakeBtn) this.skipWakeBtn.style.display = 'none';
    this.hud.style.display = 'block';

    this.startTime = Date.now();
    this.showToast('OPTICAL REBOOT COMPLETE. SALVAGE DISPERSED SURVIVAL CASINGS.');
  }

  // --- Tactile Touch & Mouse Buttons ---
  _setupControls() {
    // Skip wake button
    this.skipWakeBtn.addEventListener('click', () => {
      this.completeWake();
    });

    // Touch & Mouse Control bindings for Rover
    const bindBtn = (elemId, inputProp) => {
      const el = document.getElementById(elemId);
      if (!el) return;

      const press = (e) => {
        e.preventDefault();
        this.rover.inputs[inputProp] = true;
        el.classList.add('pressed');
      };
      const release = (e) => {
        e.preventDefault();
        this.rover.inputs[inputProp] = false;
        el.classList.remove('pressed');
      };

      el.addEventListener('pointerdown', press);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('touchstart', press, { passive: false });
      el.addEventListener('touchend', release, { passive: false });
    };

    bindBtn('btn-forward', 'forward');
    bindBtn('btn-backward', 'backward');
    bindBtn('btn-left', 'left');
    bindBtn('btn-right', 'right');

    // Seismic Scan Button (Click, Touch & Pointer resilient)
    const btnScan = document.getElementById('btn-scan');
    if (btnScan) {
      const handleScan = (e) => {
        if (e) e.preventDefault();
        this.triggerScan();
        btnScan.classList.add('pressed');
        setTimeout(() => btnScan.classList.remove('pressed'), 250);
      };
      btnScan.addEventListener('pointerdown', handleScan);
      btnScan.addEventListener('touchstart', handleScan, { passive: false });
      btnScan.addEventListener('click', handleScan);
    }

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
      if (!this.isWakeComplete) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
          this.completeWake();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          this.rover.inputs.forward = true;
          document.getElementById('btn-forward')?.classList.add('pressed');
          break;
        case 's':
        case 'arrowdown':
          this.rover.inputs.backward = true;
          document.getElementById('btn-backward')?.classList.add('pressed');
          break;
        case 'a':
        case 'arrowleft':
          this.rover.inputs.left = true;
          document.getElementById('btn-left')?.classList.add('pressed');
          break;
        case 'd':
        case 'arrowright':
          this.rover.inputs.right = true;
          document.getElementById('btn-right')?.classList.add('pressed');
          break;
        case 'shift':
          this.rover.inputs.brake = true;
          break;
        case ' ':
        case 'e':
          this.triggerScan();
          break;
        case 't':
        case 'f':
          this._toggleLights();
          break;
        case 'c':
          if (this.onCameraToggle) this.onCameraToggle();
          break;
        case 'g':
        case 'p':
          if (this.onGfxToggle) this.onGfxToggle();
          break;
        case 'm':
          this._toggleAudio();
          break;
        case '1':
          // Switch to FPP (First Person Perspective)
          if (this.onPerspectiveSet) this.onPerspectiveSet(1);
          break;
        case '2':
          // Switch to TPP (Third Person Perspective)
          if (this.onPerspectiveSet) this.onPerspectiveSet(0);
          break;
        case 'l':
          this.leaderboardModal.classList.add('open');
          this._renderLeaderboard();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          this.rover.inputs.forward = false;
          document.getElementById('btn-forward')?.classList.remove('pressed');
          break;
        case 's':
        case 'arrowdown':
          this.rover.inputs.backward = false;
          document.getElementById('btn-backward')?.classList.remove('pressed');
          break;
        case 'a':
        case 'arrowleft':
          this.rover.inputs.left = false;
          document.getElementById('btn-left')?.classList.remove('pressed');
          break;
        case 'd':
        case 'arrowright':
          this.rover.inputs.right = false;
          document.getElementById('btn-right')?.classList.remove('pressed');
          break;
        case 'shift':
          this.rover.inputs.brake = false;
          break;
      }
    });

    // Auxiliary HUD buttons
    document.getElementById('btn-headlights')?.addEventListener('click', () => this._toggleLights());
    document.getElementById('btn-camera')?.addEventListener('click', () => {
      if (this.onCameraToggle) this.onCameraToggle();
    });
    document.getElementById('btn-gfx')?.addEventListener('click', () => {
      if (this.onGfxToggle) this.onGfxToggle();
    });
    document.getElementById('btn-mute')?.addEventListener('click', () => this._toggleAudio());
    document.getElementById('btn-hud-records')?.addEventListener('click', () => {
      this.leaderboardModal.classList.add('open');
      this._renderLeaderboard();
    });
  }

  _toggleLights() {
    const on = this.rover.toggleHeadlights();
    this.showToast(on ? 'HEADLIGHTS: ENGAGED' : 'HEADLIGHTS: DEACTIVATED');
  }

  _toggleAudio() {
    const muted = marsAudio.toggleMute();
    this.showToast(muted ? 'AUDIO MUTED' : 'AUDIO SYNTH ACTIVE');
  }

  triggerScan() {
    if (!this.isWakeComplete) return;
    this.radar.triggerScan(this.rover.position);
    marsAudio.playScannerPing();
    const btnScan = document.getElementById('btn-scan');
    if (btnScan) {
      btnScan.classList.add('pressed');
      setTimeout(() => btnScan.classList.remove('pressed'), 350);
    }
    this.showToast('SEISMIC SCAN PULSE EMITTED');
  }

  // --- Modals Setup ---
  _setupModals() {
    // Start game
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.startWakeSequence();
    });

    // Help modal
    document.getElementById('btn-open-help')?.addEventListener('click', () => {
      this.helpModal.classList.add('open');
    });
    document.getElementById('btn-close-help')?.addEventListener('click', () => {
      this.helpModal.classList.remove('open');
    });

    // Leaderboard modal
    document.getElementById('btn-open-leaderboard')?.addEventListener('click', () => {
      this.leaderboardModal.classList.add('open');
      this._renderLeaderboard();
    });
    document.getElementById('btn-close-leaderboard')?.addEventListener('click', () => {
      this.leaderboardModal.classList.remove('open');
    });

    // Replay after victory
    document.getElementById('btn-replay')?.addEventListener('click', () => {
      window.location.reload();
    });
    document.getElementById('btn-victory-leaderboard')?.addEventListener('click', () => {
      this.victoryModal.classList.remove('open');
      this.leaderboardModal.classList.add('open');
      this._renderLeaderboard();
    });
  }

  _setupCompassTape() {
    if (!this.compassTape) return;
    // Generate tape: 2 full rotations of cardinal ticks
    let html = '';
    const points = [
      { deg: 0, label: 'N' }, { deg: 30, label: '030' }, { deg: 45, label: 'NE' },
      { deg: 60, label: '060' }, { deg: 90, label: 'E' }, { deg: 120, label: '120' },
      { deg: 135, label: 'SE' }, { deg: 150, label: '150' }, { deg: 180, label: 'S' },
      { deg: 210, label: '210' }, { deg: 225, label: 'SW' }, { deg: 240, label: '240' },
      { deg: 270, label: 'W' }, { deg: 300, label: '300' }, { deg: 315, label: 'NW' },
      { deg: 330, label: '330' }
    ];

    for (let r = -1; r <= 2; r++) {
      points.forEach(p => {
        const isCardinal = isNaN(Number(p.label));
        const style = isCardinal ? 'color:var(--color-text-main); font-weight:bold;' : '';
        html += `<span class="compass-tick" style="${style}">${p.label} &bull;</span>`;
      });
    }
    this.compassTape.innerHTML = html;
  }

  // --- Real-Time HUD Update Loop ---
  update(dt) {
    if (!this.isWakeComplete) return;

    // 1. Mission Clock
    this.elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const mins = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(this.elapsedSeconds % 60).toString().padStart(2, '0');
    if (this.teleTime) this.teleTime.textContent = `${mins}:${secs}`;

    // 2. Traversed Distance
    if (!this.lastRoverPos) {
      this.lastRoverPos = this.rover.position.clone();
    } else {
      const dStep = this.rover.position.distanceTo(this.lastRoverPos);
      this.totalTraversedMeters += dStep;
      this.lastRoverPos.copy(this.rover.position);
      if (this.teleDist) {
        this.teleDist.textContent = `${(this.totalTraversedMeters / 1000).toFixed(2)} KM`;
      }
    }

    // 3. Speed & Heading
    const kmh = (Math.abs(this.rover.getSpeed()) * 3.6).toFixed(1);
    if (this.teleSpeed) this.teleSpeed.textContent = `${kmh} KM/H`;

    let deg = Math.round(((-this.rover.heading * 180 / Math.PI) % 360 + 360) % 360);
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const cardIdx = Math.round(deg / 45) % 8;
    if (this.teleHeading) this.teleHeading.textContent = `${deg.toString().padStart(3, '0')}° ${cardinals[cardIdx]}`;

    // 4. Update Compass Tape position
    if (this.compassTape) {
      // 1 deg = ~4.2px
      const offset = (deg * 4.2) % 1512;
      this.compassTape.style.transform = `translateX(${-offset}px)`;
    }

    // 5. Radar Signals & Distances
    const radarData = this.radar.update(dt, this.rover.position, this.rover.heading);
    this._renderSonarCanvas(radarData);

    // Active primary target & distance
    if (radarData.activeTarget) {
      const c = radarData.activeTarget;
      if (this.sonarDistLabel) {
        const dirTag = c.isAhead ? '▲ AHEAD' : '▼ BEHIND';
        this.sonarDistLabel.textContent = `TARGET: ${c.dist}M [${dirTag}]`;
      }
      if (this.radarSignalDb) {
        const db = -100 + Math.round(c.signalStrength * 0.7);
        this.radarSignalDb.textContent = `${db} dBm`;
      }

      // Proximity banner when < 75m
      if (c.dist < 75) {
        this.proximityBanner.classList.add('active');
        this.proximityText.textContent = `${c.item.name} (${c.dist}M)`;
      } else {
        this.proximityBanner.classList.remove('active');
      }

      // Audio beacon chirping
      marsAudio.updateBeaconProximity(c.dist);
    } else {
      if (this.sonarDistLabel) this.sonarDistLabel.textContent = 'NO ACTIVE SIGNALS';
      if (this.radarSignalDb) this.radarSignalDb.textContent = 'SILENT';
      this.proximityBanner.classList.remove('active');
    }

    // 6. Update Rover Sound
    marsAudio.updateRoverAudio(
      this.rover.getSpeed() / this.rover.maxSpeed,
      this.rover.getSpeed() < 0,
      this.rover.steerAngle
    );

    // 7. Update Telemetry Waveform Charts (Image 2 Restoration)
    this._renderTelemetryCharts(dt);

    // 8. Update Speedometer & Fuel Gauge (Image 2 & 3)
    const currentSpeedKmh = parseFloat(kmh) || 0;
    this._renderSpeedometer(currentSpeedKmh);
    this._updateFuel(dt, currentSpeedKmh);
  }

  // --- Render Tactical Circular Speedometer (Image 2 & 3) ---
  _renderSpeedometer(kmh) {
    if (!this.speedoCtx || !this.speedoCanvas) return;
    const ctx = this.speedoCtx;
    const w = this.speedoCanvas.width;
    const h = this.speedoCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w / 2 - 8;

    ctx.clearRect(0, 0, w, h);

    // Bezel dark circular backing
    ctx.fillStyle = '#160f0a';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.fill();

    // Subtle dark gradient shading
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
    grad.addColorStop(0, 'rgba(38, 25, 16, 0.4)');
    grad.addColorStop(1, 'rgba(14, 9, 6, 0.95)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Scale range: 0 to 70 km/h (matching Image 3)
    // Span: 240 degrees (from 150 deg to 390 deg)
    const maxScaleSpeed = 70.0;
    const startAngle = (150 * Math.PI) / 180;
    const totalSpan = (240 * Math.PI) / 180;

    // Draw scale arc
    ctx.strokeStyle = 'rgba(224, 155, 76, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 4, startAngle, startAngle + totalSpan);
    ctx.stroke();

    // Draw Major & Minor Ticks and Numbers
    const majorCount = 7; // 0, 10, 20, 30, 40, 50, 60, 70
    for (let i = 0; i <= majorCount; i++) {
      const val = i * 10;
      const angle = startAngle + (i / majorCount) * totalSpan;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Major Tick
      ctx.strokeStyle = '#ffd294';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(cx + cosA * (radius - 12), cy + sinA * (radius - 12));
      ctx.lineTo(cx + cosA * (radius - 2), cy + sinA * (radius - 2));
      ctx.stroke();

      // Number Label (e.g. 0, 10, 20, 30, 40, 50, 60, 70)
      ctx.font = 'bold 8.5px "Lucida Calligraphy", sans-serif';
      ctx.fillStyle = '#ffd294';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textRadius = radius - 20;
      ctx.fillText(val.toString(), cx + cosA * textRadius, cy + sinA * textRadius);

      // Minor Ticks between major ticks
      if (i < majorCount) {
        for (let m = 1; m < 5; m++) {
          const subAngle = angle + (m / 5) * (totalSpan / majorCount);
          const sc = Math.cos(subAngle);
          const ss = Math.sin(subAngle);
          ctx.strokeStyle = 'rgba(224, 155, 76, 0.45)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(cx + sc * (radius - 8), cy + ss * (radius - 8));
          ctx.lineTo(cx + sc * (radius - 2), cy + ss * (radius - 2));
          ctx.stroke();
        }
      }
    }

    // Center Dial Labels (Image 3: SPEED/WMR)
    ctx.font = 'bold 8px "Lucida Calligraphy", sans-serif';
    ctx.fillStyle = '#e09b4c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPEED', cx, cy - 24);
    ctx.font = 'bold 6.5px "Lucida Calligraphy", sans-serif';
    ctx.fillStyle = 'rgba(224, 155, 76, 0.65)';
    ctx.fillText('KM/H', cx, cy - 14);

    // Calculate Needle Angle
    const speedFraction = Math.max(0.0, Math.min(1.0, kmh / maxScaleSpeed));
    const needleAngle = startAngle + speedFraction * totalSpan;
    const nCos = Math.cos(needleAngle);
    const nSin = Math.sin(needleAngle);

    // Analog Needle (warm amber with sharp glowing gold tip)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx - nCos * 8, cy - nSin * 8); // slight counterweight tail
    ctx.lineTo(cx + nCos * (radius - 8), cy + nSin * (radius - 8));
    ctx.stroke();

    // Center Needle Pivot Hub (cap)
    ctx.fillStyle = '#261910';
    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Update Digital Display at bottom
    if (this.speedoDigitalDisplay) {
      this.speedoDigitalDisplay.textContent = kmh.toFixed(1);
    }
  }

  // --- Real-Time RTG Fuel / Power Gauge ---
  // When stopped: discharged slowly. When moving: goes high!
  _updateFuel(dt, speedKmh) {
    if (speedKmh > 0.4) {
      // Kinetic alternator charging while moving
      this.fuel = Math.min(100.0, this.fuel + dt * 4.8);
      if (this.fuelFillBar) {
        this.fuelFillBar.classList.add('charging');
      }
    } else {
      // Idle systems discharge while stopped
      this.fuel = Math.max(6.0, this.fuel - dt * 1.25);
      if (this.fuelFillBar) {
        this.fuelFillBar.classList.remove('charging');
      }
    }

    if (this.fuelFillBar) {
      this.fuelFillBar.style.width = `${this.fuel.toFixed(1)}%`;
    }
    if (this.fuelPercentText) {
      this.fuelPercentText.textContent = `${Math.round(this.fuel)}%`;
    }
  }

  // --- Render Tactical Seismic Radar Scope ---
  _renderSonarCanvas(radarData) {
    if (!this.sonarCtx) return;
    const ctx = this.sonarCtx;
    const w = this.sonarCanvas.width;
    const h = this.sonarCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = w / 2 - 4;

    ctx.clearRect(0, 0, w, h);

    // Background circular radar plate
    ctx.fillStyle = '#140c08';
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
    ctx.fill();

    // Range rings
    ctx.strokeStyle = '#2d1b11';
    ctx.lineWidth = 1;
    [0.33, 0.66, 1.0].forEach(r => {
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius * r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(cx, 4);
    ctx.lineTo(cx, h - 4);
    ctx.moveTo(4, cy);
    ctx.lineTo(w - 4, cy);
    ctx.stroke();

    // Directional orientation labels along radar perimeter (FWD, REV, L, R)
    ctx.font = 'bold 8.5px "Lucida Calligraphy", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
    ctx.fillText('▲', cx, 8);
    ctx.fillStyle = 'rgba(184, 110, 53, 0.55)';
    ctx.fillText('▼', cx, h - 8);
    ctx.fillText('L', 9, cy);
    ctx.fillText('R', w - 9, cy);

    // Rotating sweep line
    this.sonarSweepAngle += 0.035;
    ctx.strokeStyle = 'rgba(184, 110, 53, 0.35)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + Math.cos(this.sonarSweepAngle) * maxRadius,
      cy + Math.sin(this.sonarSweepAngle) * maxRadius
    );
    ctx.stroke();

    // Render cargo blips:
    // Physical Cartesian rover-relative projection:
    // sig.rightDist: >0 is to rover's right (+X on canvas), <0 is to rover's left (-X on canvas).
    // sig.fwdDist: >0 is in front of rover (-Y on canvas, UP), <0 is behind rover (+Y on canvas, DOWN).
    const maxRadarDist = 850; // meters full radar scope range
    const radarScale = (maxRadius - 8) / maxRadarDist;

    let targetScreenPos = null;

    radarData.signals.forEach(sig => {
      let px = sig.rightDist * radarScale;
      let py = -sig.fwdDist * radarScale;
      const pDist = Math.hypot(px, py);

      // Clamp distant targets to outer ring perimeter
      if (pDist > maxRadius - 8) {
        px = (px / pDist) * (maxRadius - 8);
        py = (py / pDist) * (maxRadius - 8);
      }

      const bx = cx + px;
      const by = cy + py;

      const isTarget = radarData.activeTarget && radarData.activeTarget.item.id === sig.item.id;
      if (isTarget) {
        targetScreenPos = { bx, by, isAhead: sig.fwdDist > 0, dist: sig.dist };
      }

      const blipRadius = isTarget ? 6.0 : 4.0;

      // Outer glow halo ring
      ctx.fillStyle = isTarget ? 'rgba(245, 158, 11, 0.42)' : 'rgba(217, 138, 74, 0.22)';
      ctx.beginPath();
      ctx.arc(bx, by, isTarget ? 12.0 : 7.0, 0, Math.PI * 2);
      ctx.fill();

      // Solid central blip
      ctx.fillStyle = isTarget ? '#ffb049' : '#d98a4a';
      ctx.beginPath();
      ctx.arc(bx, by, blipRadius, 0, Math.PI * 2);
      ctx.fill();

      // Sharp core dot for high visibility
      ctx.fillStyle = isTarget ? '#ffffff' : '#ffd294';
      ctx.beginPath();
      ctx.arc(bx, by, isTarget ? 2.5 : 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Dynamic lock brackets on active target
      if (isTarget) {
        const pulse = (Math.sin(performance.now() * 0.007) + 1.0) * 0.5;
        ctx.strokeStyle = `rgba(255, 176, 73, ${0.55 + pulse * 0.45})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(bx, by, 8.0 + pulse * 6.0, 0, Math.PI * 2);
        ctx.stroke();

        // Corner target reticle ticks around blip
        const s = 10;
        ctx.beginPath();
        ctx.moveTo(bx - s, by - 4); ctx.lineTo(bx - s, by - s); ctx.lineTo(bx - 4, by - s);
        ctx.moveTo(bx + s, by - 4); ctx.lineTo(bx + s, by - s); ctx.lineTo(bx + 4, by - s);
        ctx.moveTo(bx - s, by + 4); ctx.lineTo(bx - s, by + s); ctx.lineTo(bx - 4, by + s);
        ctx.moveTo(bx + s, by + 4); ctx.lineTo(bx + s, by + s); ctx.lineTo(bx + 4, by + s);
        ctx.stroke();
      }
    });

    // Draw tactical guidance tracking vector line from rover to active target
    if (targetScreenPos) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(targetScreenPos.bx, targetScreenPos.by);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash
    }

    // Rover marker at center (facing up)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.lineTo(cx, cy + 2.5);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // --- Real-Time Telemetry Charts (Image 2 Restored) ---
  _renderTelemetryCharts(dt) {
    this.telemetryTime += dt;
    const t = this.telemetryTime;
    const speed = Math.abs(this.rover.getSpeed());

    // 1. Alert Tolerance Dual Harmonic Waveform
    if (this.alertCtx && this.alertCanvas) {
      const ctx = this.alertCtx;
      const w = this.alertCanvas.width;
      const h = this.alertCanvas.height;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Background subtle grid
      ctx.strokeStyle = 'rgba(59, 40, 28, 0.45)';
      ctx.lineWidth = 1;
      [-18, 0, 18].forEach(offset => {
        ctx.beginPath();
        ctx.moveTo(0, midY + offset);
        ctx.lineTo(w, midY + offset);
        ctx.stroke();
      });

      // Wave 1: Primary Amber Harmonic Wave
      ctx.strokeStyle = '#e09b4c';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const progress = x / w;
        const wave = Math.sin(progress * 18 + t * 3.2) * 14
                   + Math.sin(progress * 7 - t * 1.8) * 7;
        const y = midY + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Wave 2: Secondary Light Ochre Wave
      ctx.strokeStyle = 'rgba(245, 207, 130, 0.75)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const progress = x / w;
        const wave = Math.sin(progress * 22 + t * 4.1 + 0.8) * 11
                   + Math.cos(progress * 9 - t * 2.2) * 5;
        const y = midY + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Wave 3: Cyan Atmospheric Baseline
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const progress = x / w;
        const wave = Math.sin(progress * 12 + t * 2.0 + 1.6) * 8;
        const y = midY + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 2. Seismic Vibration Spikes Waveform
    if (this.seismicCtx && this.seismicCanvas) {
      const ctx = this.seismicCtx;
      const w = this.seismicCanvas.width;
      const h = this.seismicCanvas.height;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Baseline center grid line
      ctx.strokeStyle = 'rgba(59, 40, 28, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      // Vibration signal calculation
      const isScanning = this.radar.isScanning;
      const moveFactor = (speed / this.rover.maxSpeed) * 0.7 + (isScanning ? 0.9 : 0.15);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const progress = x / w;
        // High frequency noise jitter
        const noise = (Math.sin(x * 1.7 + t * 40) + Math.cos(x * 3.1 - t * 25)) * 0.5;
        // Central burst envelope
        const burst = Math.exp(-Math.pow((progress - 0.48) / 0.22, 2)) * 1.8;
        const amp = (2.0 + moveFactor * 14.0 + burst * (isScanning ? 16 : 8));
        const y = midY + noise * amp;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // --- Item Collected Event Handler ---
  handleItemCollected(item, count, total) {
    if (this.salvageCountEl) this.salvageCountEl.textContent = count;
    if (this.manifestPercentEl) {
      this.manifestPercentEl.textContent = `${Math.round((count / total) * 100)}%`;
    }

    // Play collect audio file
    marsAudio.playCollectAudio();

    // Clean notification requested by user: ARTIFACT [N] COLLECTED
    this.showToast(`ARTIFACT ${count} COLLECTED`);

    // Check for complete mission victory
    if (count >= total) {
      setTimeout(() => {
        this.triggerVictory();
      }, 2000);
    }
  }

  showToast(msg) {
    if (!this.missionToast) return;
    this.missionToast.textContent = msg;
    this.missionToast.style.display = 'block';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.missionToast.style.display = 'none';
    }, 4500);
  }

  // --- Mission Victory Sequence ---
  triggerVictory() {
    this.hud.style.display = 'none';
    this.victoryModal.classList.add('open');

    const mins = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(this.elapsedSeconds % 60).toString().padStart(2, '0');
    const timeStr = `${mins}:${secs}`;
    const distStr = `${(this.totalTraversedMeters / 1000).toFixed(2)} KM`;

    document.getElementById('vic-time').textContent = timeStr;
    document.getElementById('vic-dist').textContent = distStr;

    // Save to leaderboard
    this._saveRecord({
      id: `EXP-${Math.floor(1000 + Math.random() * 9000)}`,
      timeStr,
      distStr,
      salvaged: '8/8 (100%)',
      status: 'SURVIVED'
    });
  }

  // --- Leaderboard Storage & Rendering ---
  _initLeaderboard() {
    const raw = localStorage.getItem('mars_providence_records');
    if (!raw) {
      // Default initial mock history
      const defaults = [
        { id: 'EXP-8014', timeStr: '09:24', distStr: '4.82 KM', salvaged: '8/8 (100%)', status: 'SURVIVED' },
        { id: 'EXP-7941', timeStr: '11:15', distStr: '5.40 KM', salvaged: '8/8 (100%)', status: 'SURVIVED' },
        { id: 'EXP-6520', timeStr: '14:38', distStr: '6.12 KM', salvaged: '7/8 (87%)', status: 'SIGNAL LOST' }
      ];
      localStorage.setItem('mars_providence_records', JSON.stringify(defaults));
    }
  }

  _saveRecord(entry) {
    let records = [];
    try {
      records = JSON.parse(localStorage.getItem('mars_providence_records') || '[]');
    } catch (e) {
      records = [];
    }
    records.unshift(entry);
    if (records.length > 10) records.pop();
    localStorage.setItem('mars_providence_records', JSON.stringify(records));
  }

  _renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let records = [];
    try {
      records = JSON.parse(localStorage.getItem('mars_providence_records') || '[]');
    } catch (e) {
      records = [];
    }

    records.forEach((rec, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--color-accent-amber);">#${idx + 1}</td>
        <td><strong>${rec.id}</strong></td>
        <td>${rec.salvaged}</td>
        <td>${rec.timeStr}</td>
        <td>${rec.distStr}</td>
        <td style="color:${rec.status === 'SURVIVED' ? '#8cb870' : '#b85c4a'};">${rec.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}
