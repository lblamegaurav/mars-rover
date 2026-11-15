import * as THREE from 'three';
window.THREE = THREE;
import { MarsTerrain } from './terrain.js';
import { MarsRover } from './rover.js';
import { MarsAtmosphere } from './weather.js';
import { SurvivalMission } from './items.js';
import { MarsRadar } from './radar.js';
import { MarsUI } from './ui.js';
import { MarsGLBManager } from './glbManager.js';
import { SpawnPropsManager } from './spawnProps.js';
import { MarsMultiplayer } from './multiplayer.js';

// Floating Collected Artifacts 3D Viewer (Pure rotating GLB models with 1:1 square pixel aspect ratio)
class CollectedArtifactsViewer {
  constructor(canvas) {
    this.canvas = canvas;
    if (!this.canvas) return;

    this.scene = new THREE.Scene();
    const halfW = canvas.width / 2;
    const halfH = canvas.height / 2;
    // Symmetric Orthographic camera: bounds [-halfW, halfW] and [-halfH, halfH]
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 500);
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.renderer.setClearColor(0x000000, 0.0);

    const amb = new THREE.AmbientLight(0xffffff, 2.4);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffecc4, 3.2);
    dir.position.set(0, 80, 100);
    this.scene.add(dir);

    this.collectedModels = [];
  }

  _getSlotCoordinates(idx) {
    const cell = document.querySelector(`.artifact-slot-cell[data-slot="${idx}"]`);
    if (cell && this.canvas) {
      const canvasRect = this.canvas.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      if (canvasRect.width > 0 && cellRect.width > 0) {
        const cellCenterX = (cellRect.left + cellRect.width / 2) - canvasRect.left;
        const cellCenterY = (cellRect.top + cellRect.height / 2) - canvasRect.top;
        const scaleX = this.canvas.width / canvasRect.width;
        const scaleY = this.canvas.height / canvasRect.height;
        const pixelX = cellCenterX * scaleX;
        const pixelY = cellCenterY * scaleY;
        const camX = pixelX - (this.canvas.width / 2);
        const camY = (this.canvas.height / 2) - pixelY;
        return { x: camX, y: camY };
      }
    }
    // Fallback if DOM not yet laid out: 8 slots distributed evenly
    const xPositions = [-196, -140, -84, -28, 28, 84, 140, 196];
    return { x: xPositions[idx] !== undefined ? xPositions[idx] : 0, y: 0 };
  }

  addCollectedArtifact(item) {
    if (!this.canvas) return;
    const innerModel = new THREE.Group();

    if (item.loadedModel) {
      const clone = item.loadedModel.clone(true);
      clone.traverse(child => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.transparent = false;
          child.material.opacity = 1.0;
          if (child.material.emissive) {
            child.material.emissive.setHex(item.glowColor || 0xffb74d);
            child.material.emissiveIntensity = 0.45;
          }
        }
      });

      // Compute bounding box of clone
      const box = new THREE.Box3().setFromObject(clone);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
      const targetPixelSize = 28.0; // Perfectly centered inside 46x44 cell
      const scale = targetPixelSize / maxDim;

      // Shift clone so its center is exactly at (0, 0, 0)
      clone.position.sub(center);
      innerModel.scale.setScalar(scale);
      innerModel.add(clone);
    } else {
      const geom = new THREE.IcosahedronGeometry(13.0, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: item.glowColor || 0xffb74d,
        roughness: 0.35,
        metalness: 0.8
      });
      innerModel.add(new THREE.Mesh(geom, mat));
    }

    // Pure axial rotation group with subtle isometric tilt
    const rotGroup = new THREE.Group();
    rotGroup.rotation.x = 0.22;
    rotGroup.add(innerModel);

    // Slot position group
    const slotGroup = new THREE.Group();
    slotGroup.add(rotGroup);
    this.scene.add(slotGroup);

    const idx = this.collectedModels.length;
    const pos = this._getSlotCoordinates(idx);
    slotGroup.position.set(pos.x, pos.y, 0);

    this.collectedModels.push({
      idx,
      rotGroup,
      slotGroup,
      rotSpeed: 1.4 + Math.random() * 0.4
    });
  }

  update(dt) {
    if (!this.canvas || this.collectedModels.length === 0) return;
    this.collectedModels.forEach(entry => {
      entry.rotGroup.rotation.y += dt * entry.rotSpeed;
    });
    this.renderer.render(this.scene, this.camera);
  }
}

class MarsGame {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // 1. Scene & Renderer Setup
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // Balanced Cinematic Color Grading
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.container.appendChild(this.renderer.domElement);

    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(
      56,
      window.innerWidth / window.innerHeight,
      0.2,
      3500
    );

    // Camera Modes:
    // 0 = 1X Fixed-Point Dune Chase View
    // 1 = 2X FPV (Rover Optical Sensor Mast Eye-Level View)
    // 2 = Tactical Survey
    this.cameraMode = 0;
    this.cameraOffset = new THREE.Vector3(0, 4.2, 9.5);
    this.cameraLookOffset = new THREE.Vector3(0, 1.4, -2.5);

    // 3. Initialize Core Subsystems
    this.terrain = new MarsTerrain(this.scene);
    this.rover = new MarsRover(this.scene, this.terrain);
    this.atmosphere = new MarsAtmosphere(this.scene);
    this.itemsManager = new SurvivalMission(this.scene, this.terrain);
    this.radar = new MarsRadar(this.scene, this.itemsManager);

    // 4. Initialize Collected Artifacts Floating 3D Viewer
    const artifactCanvas = document.getElementById('collected-artifacts-canvas');
    this.artifactsViewer = new CollectedArtifactsViewer(artifactCanvas);

    // Hook item collected callback
    this.itemsManager.onItemCollected = (item, count, total, totalScore) => {
      this.ui.handleItemCollected(item, count, total, totalScore);
      if (this.artifactsViewer) {
        this.artifactsViewer.addCollectedArtifact(item);
      }
    };

    // 5. Initialize UI
    this.gfxMode = 0;
    this.ui = new MarsUI(
      this.rover,
      this.radar,
      this.itemsManager,
      () => this.toggleCameraMode(),
      () => this.toggleGfxMode(),
      (mode) => this.setCameraMode(mode)
    );

    // 6. Non-Collectible Spawn Props (Axe, Missile, Extinguisher, Lamp, Turbine Tower - 96% Compressed)
    this.spawnProps = new SpawnPropsManager(this.scene, this.terrain);

    // 7. PeerJS WebRTC P2P Multiplayer Subsystem
    this.multiplayer = new MarsMultiplayer(
      this.scene,
      this.terrain,
      this.rover,
      this.itemsManager,
      (status) => this.ui.showToast(status)
    );

    // 8. Initialize 3D GLB Expedition Assets (Rover, Mountains, Aram Chaos, Desert)
    this.glbManager = new MarsGLBManager(
      this.scene,
      this.terrain,
      this.rover,
      (status) => this.ui.showToast(status)
    );

    // 9. Initial Terrain & Position
    this.terrain.update(this.rover.position.x, this.rover.position.z);

    // Mouse / Touch drag for free look around rover
    this.cameraAngleOffset = 0;
    this.cameraPitchOffset = 0;
    this._setupCameraDrag();
    this._setupCameraZoomToggle();

    // 10. Intro Video & Expedition Mode Select (Solo / Multiplayer Rooms)
    this._setupIntroAndModeSelect();

    // 11. Timing, FPS Tracking and Animation Loop
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps = 60;
    this.fpsDisplay = document.getElementById('tele-fps');
    this.topFpsDisplay = document.getElementById('top-fps-badge');
    window.addEventListener('resize', () => this._onWindowResize());

    // 12. Right-Side Rover Optical Mast Live Camera Feed (Image 4 Optimization, Zero FPS Drop)
    this.feedCamera = new THREE.PerspectiveCamera(65, 280 / 155, 0.2, 1600);
    const feedCanvas = document.getElementById('camera-feed-canvas');
    this.feedRenderer = null;
    if (feedCanvas) {
      this.feedRenderer = new THREE.WebGLRenderer({
        canvas: feedCanvas,
        antialias: false,
        powerPreference: 'low-power'
      });
      this.feedRenderer.setSize(280, 155, false);
      this.feedRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.feedRenderer.toneMappingExposure = 0.95;
    }

    this._animate();
  }

  _setupIntroAndModeSelect() {
    const videoContainer = document.getElementById('intro-video-container');
    const video = document.getElementById('intro-video');
    const skipBtn = document.getElementById('skip-intro-btn');
    const toggleAudioBtn = document.getElementById('toggle-intro-audio-btn');
    const modeModal = document.getElementById('mode-select-modal');
    const waitingRoomModal = document.getElementById('waiting-room-modal');

    const transitionToModeSelect = () => {
      if (!videoContainer || videoContainer.dataset.dismissed) return;
      videoContainer.dataset.dismissed = 'true';

      // Smooth fade out
      videoContainer.classList.add('fade-out');
      setTimeout(() => {
        videoContainer.style.display = 'none';
        if (video) video.pause();
      }, 1200);

      // Open mode selection modal
      if (modeModal) {
        modeModal.classList.add('open');
      }
    };

    if (skipBtn) {
      skipBtn.addEventListener('click', (e) => {
        e.preventDefault();
        transitionToModeSelect();
      });
    }

    if (video) {
      // User specifically requested the video WITH SOUND:
      video.muted = false;
      video.volume = 1.0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // If browser policy requires user gesture for unmuted audio, start muted
          video.muted = true;
          video.play();
          if (toggleAudioBtn) toggleAudioBtn.style.opacity = '0.5';
        });
      }

      const updateAudioIcon = (isMuted) => {
        if (!toggleAudioBtn) return;
        toggleAudioBtn.style.opacity = isMuted ? '0.5' : '1.0';
        toggleAudioBtn.style.borderColor = isMuted ? 'rgba(224, 155, 76, 0.3)' : '#f59e0b';
      };

      if (toggleAudioBtn) {
        toggleAudioBtn.addEventListener('click', (e) => {
          e.preventDefault();
          video.muted = !video.muted;
          video.volume = 1.0;
          updateAudioIcon(video.muted);
        });
      }

      // First click on window also unmutes if browser initially blocked autoplay audio
      window.addEventListener('click', () => {
        if (video && !video.paused && video.muted) {
          video.muted = false;
          video.volume = 1.0;
          updateAudioIcon(false);
        }
      }, { once: true });

      video.addEventListener('timeupdate', () => {
        if (video.duration && video.currentTime > video.duration - 1.2) {
          videoContainer?.classList.add('fade-out');
        }
      });
      video.addEventListener('ended', () => {
        transitionToModeSelect();
      });
    }

    // Single Player Launch
    const btnSolo = document.getElementById('btn-launch-solo');
    if (btnSolo) {
      btnSolo.addEventListener('click', () => {
        if (modeModal) modeModal.classList.remove('open');
        this.ui.startWakeSequence();
      });
    }

    // Multiplayer Tabs (Create / Join)
    const tabCreate = document.getElementById('tab-mp-create');
    const tabJoin = document.getElementById('tab-mp-join');
    const panelCreate = document.getElementById('mp-panel-create');
    const panelJoin = document.getElementById('mp-panel-join');
    const displayCode = document.getElementById('display-room-code');

    const roomCode = `MARS-${Math.floor(1000 + Math.random() * 9000)}`;
    if (displayCode) displayCode.textContent = roomCode;

    if (tabCreate && tabJoin) {
      tabCreate.addEventListener('click', () => {
        tabCreate.classList.add('active');
        tabJoin.classList.remove('active');
        panelCreate?.classList.add('active');
        panelJoin?.classList.remove('active');
      });
      tabJoin.addEventListener('click', () => {
        tabJoin.classList.add('active');
        tabCreate.classList.remove('active');
        panelJoin?.classList.add('active');
        panelCreate?.classList.remove('active');
      });
    }

    // Waiting Room UI Elements
    const wrRoomCode = document.getElementById('wr-room-code');
    const wrPassword = document.getElementById('wr-room-password');
    const wrRoster = document.getElementById('waiting-room-roster');
    const wrPlayerCount = document.getElementById('wr-player-count');
    const wrStatusBanner = document.getElementById('wr-status-banner');
    const btnStartExpedition = document.getElementById('btn-start-expedition');
    const btnLeaveWaitingRoom = document.getElementById('btn-leave-waiting-room');
    const btnCopyCode = document.getElementById('btn-copy-code');

    const updateRosterUI = (roster) => {
      if (!wrRoster) return;
      wrRoster.innerHTML = '';
      roster.forEach(player => {
        const item = document.createElement('div');
        item.className = 'roster-item';
        const color = player.profile ? player.profile.cssColor : '#f59e0b';
        item.innerHTML = `
          <div class="roster-item-info">
            <span class="roster-dot" style="background:${color}; box-shadow:0 0 8px ${color};"></span>
            <span style="color:#ffffff; font-weight:600;">${player.name || 'Explorer'}</span>
          </div>
          <span class="roster-badge ${player.isHost ? 'host' : 'ready'}" style="${player.isHost ? 'background:rgba(245,158,11,0.2); border-color:#f59e0b; color:#ffd294;' : ''}">
            ${player.isHost ? 'COMMANDER' : 'READY'}
          </span>
        `;
        wrRoster.appendChild(item);
      });

      if (wrPlayerCount) {
        wrPlayerCount.textContent = `${roster.length} / 6 ROVERS ASSEMBLED`;
      }

      if (this.multiplayer.isHost) {
        if (btnStartExpedition) btnStartExpedition.style.display = 'block';
        if (wrStatusBanner) {
          wrStatusBanner.textContent = roster.length > 1
            ? 'EXPLORERS ASSEMBLED! CLICK START EXPEDITION TO LAUNCH'
            : 'WAITING FOR ONLINE FRIENDS (UP TO 6) TO ENTER ROOM CODE...';
        }
      } else {
        if (btnStartExpedition) btnStartExpedition.style.display = 'none';
        if (wrStatusBanner) {
          wrStatusBanner.textContent = 'CONNECTED! WAITING FOR COMMANDER TO START EXPEDITION...';
        }
      }
    };

    // Wire multiplayer callbacks
    this.multiplayer.onRosterUpdated = (roster) => {
      updateRosterUI(roster);
    };

    this.multiplayer.onGameStart = () => {
      if (waitingRoomModal) waitingRoomModal.classList.remove('open');
      this.ui.startWakeSequence();
    };

    this.multiplayer.onRoomClosed = (reason) => {
      if (waitingRoomModal && waitingRoomModal.classList.contains('open')) {
        waitingRoomModal.classList.remove('open');
        if (modeModal) modeModal.classList.add('open');
      }
      this.ui.showToast(reason || 'DISCONNECTED FROM ROOM');
    };

    // Copy Room Code Button
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        const code = wrRoomCode ? wrRoomCode.textContent : roomCode;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(() => {
            btnCopyCode.textContent = 'COPIED!';
            setTimeout(() => { btnCopyCode.textContent = 'COPY'; }, 1800);
          });
        }
      });
    }

    // Host clicks Create Room
    const btnCreateRoom = document.getElementById('btn-create-room');
    if (btnCreateRoom) {
      btnCreateRoom.addEventListener('click', () => {
        const playerName = document.getElementById('input-player-name')?.value || 'Commander Unit-04';
        const password = document.getElementById('input-host-password')?.value || '';

        if (modeModal) modeModal.classList.remove('open');
        if (waitingRoomModal) waitingRoomModal.classList.add('open');

        if (wrRoomCode) wrRoomCode.textContent = roomCode;
        if (wrPassword) wrPassword.textContent = password || 'NONE';

        this.multiplayer.createRoom(roomCode, password, playerName);
      });
    }

    // Client clicks Join Room
    const btnJoinRoom = document.getElementById('btn-join-room');
    if (btnJoinRoom) {
      btnJoinRoom.addEventListener('click', () => {
        const playerName = document.getElementById('input-player-name')?.value || 'Explorer Unit-04';
        const code = document.getElementById('input-join-code')?.value || '';
        const password = document.getElementById('input-join-password')?.value || '';

        if (!code) {
          this.ui.showToast('ENTER EXPEDITION ROOM CODE');
          return;
        }

        if (modeModal) modeModal.classList.remove('open');
        if (waitingRoomModal) waitingRoomModal.classList.add('open');

        if (wrRoomCode) wrRoomCode.textContent = code.toUpperCase();
        if (wrPassword) wrPassword.textContent = password || 'NONE';

        this.multiplayer.joinRoom(code, password, playerName);
      });
    }

    // Host clicks Start Expedition
    if (btnStartExpedition) {
      btnStartExpedition.addEventListener('click', () => {
        this.multiplayer.startGame();
      });
    }

    // Leave Waiting Room
    if (btnLeaveWaitingRoom) {
      btnLeaveWaitingRoom.addEventListener('click', () => {
        this.multiplayer.leaveRoom();
        if (waitingRoomModal) waitingRoomModal.classList.remove('open');
        if (modeModal) modeModal.classList.add('open');
      });
    }
  }

  _setupCameraZoomToggle() {
    const btnFpp = document.getElementById('btn-view-fpp');
    const btnTpp = document.getElementById('btn-view-tpp');

    if (btnFpp) {
      btnFpp.addEventListener('click', () => {
        this.setCameraMode(1); // FPP
      });
    }
    if (btnTpp) {
      btnTpp.addEventListener('click', () => {
        this.setCameraMode(0); // TPP
      });
    }
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    const btnFpp = document.getElementById('btn-view-fpp');
    const btnTpp = document.getElementById('btn-view-tpp');

    if (mode === 0) {
      // TPP (Third Person Perspective / Dune Chase)
      btnTpp?.classList.add('active');
      btnFpp?.classList.remove('active');
      this.ui.showToast('PERSPECTIVE: TPP [KEY 2] (DUNE CHASE VIEW)');
    } else if (mode === 1) {
      // FPP (First Person Perspective / Sensor Mast View)
      btnTpp?.classList.remove('active');
      btnFpp?.classList.add('active');
      this.ui.showToast('PERSPECTIVE: FPP [KEY 1] (MAST SENSOR EYE-LEVEL)');
    }
  }

  toggleCameraMode() {
    const nextMode = (this.cameraMode === 0) ? 1 : 0;
    this.setCameraMode(nextMode);
  }

  toggleGfxMode() {
    this.gfxMode = (this.gfxMode + 1) % 3;
    const btn = document.getElementById('btn-gfx');
    const label = document.getElementById('gfx-mode-label') || btn;
    if (this.gfxMode === 0) {
      // HIGH: 60-90 FPS standard
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      this.ui.showToast('GRAPHICS: HIGH (60-90 FPS BALANCED)');
      if (label) label.textContent = 'EPR: 60-99 FPS';
    } else if (this.gfxMode === 1) {
      // BOOST: 90+ FPS super-smooth
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 0.95));
      this.ui.showToast('GRAPHICS: BOOST (90+ FPS PEAK PERFORMANCE)');
      if (label) label.textContent = 'EPR: 90+ FPS';
    } else if (this.gfxMode === 2) {
      // ULTRA: High-fidelity
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.ui.showToast('GRAPHICS: ULTRA (RETINA HD)');
      if (label) label.textContent = 'EPR: ULTRA';
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _setupCameraDrag() {
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;

    const startDrag = (x, y) => {
      isDragging = true;
      prevX = x;
      prevY = y;
    };

    const moveDrag = (x, y) => {
      if (!isDragging) return;
      const dx = x - prevX;
      const dy = y - prevY;
      prevX = x;
      prevY = y;

      this.cameraAngleOffset -= dx * 0.005;
      // Expanded vertical pitch range allows looking high into the starry sky and down at dunes
      this.cameraPitchOffset = Math.max(-1.25, Math.min(1.25, this.cameraPitchOffset + dy * 0.0045));
    };

    const endDrag = () => {
      isDragging = false;
    };

    window.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on UI buttons or modals
      if (e.target.closest('#hud') || e.target.closest('.modal-content')) return;
      startDrag(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup', endDrag);

    // Touch drag for mobile
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1 && !e.target.closest('#touch-controls') && !e.target.closest('#hud')) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length === 1) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', endDrag);
  }

  _updateCamera(dt) {
    const roverPos = this.rover.position;
    const roverHeading = this.rover.heading + this.cameraAngleOffset;
    const pitch = this.cameraPitchOffset;

    let targetCamPos = new THREE.Vector3();
    let targetLookAt = new THREE.Vector3();

    if (this.cameraMode === 0) {
      // --- Mode 0: Cinematic Dune Follow (Full Horizontal & Vertical Orbital Axis) ---
      // Dynamically arc camera based on vertical pitch
      const offsetDist = Math.max(5.0, 10.8 * Math.cos(pitch * 0.65));
      const offsetHeight = 3.4 + pitch * 7.5;

      targetCamPos.set(
        roverPos.x + Math.sin(roverHeading) * offsetDist,
        roverPos.y + offsetHeight,
        roverPos.z + Math.cos(roverHeading) * offsetDist
      );

      // Prevent camera from clipping through terrain height
      const camTerrainH = this.terrain.getHeight(targetCamPos.x, targetCamPos.z) + 1.35;
      if (targetCamPos.y < camTerrainH) {
        targetCamPos.y = camTerrainH;
      }

      // Look direction smoothly tilts up to starry nebula sky or down to dunes
      targetLookAt.set(
        roverPos.x - Math.sin(roverHeading) * 12.0,
        roverPos.y + 1.8 - pitch * 14.0,
        roverPos.z - Math.cos(roverHeading) * 12.0
      );

      // Smooth damped lerp
      this.camera.position.lerp(targetCamPos, Math.min(1.0, dt * 6.0));
      this.camera.lookAt(targetLookAt);

    } else if (this.cameraMode === 1) {
      // --- Mode 1: Optical Sensor Mast (Full 360-degree & Vertical Look) ---
      const mastOffset = new THREE.Vector3(0.45, 2.65, -1.1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rover.heading);

      this.camera.position.copy(roverPos).add(mastOffset);

      const fwdDist = 20.0 * Math.cos(-pitch);
      const upDist = 20.0 * Math.sin(-pitch);

      targetLookAt.set(
        roverPos.x - Math.sin(roverHeading) * fwdDist,
        roverPos.y + 2.65 + upDist,
        roverPos.z - Math.cos(roverHeading) * fwdDist
      );

      this.camera.lookAt(targetLookAt);

    } else if (this.cameraMode === 2) {
      // --- Mode 2: Tactical High Orbital Survey ---
      const surveyDist = Math.max(10.0, 24.0 * Math.cos(pitch * 0.5));
      const surveyHeight = 16.0 + pitch * 9.0;

      targetCamPos.set(
        roverPos.x + Math.sin(roverHeading) * surveyDist,
        roverPos.y + surveyHeight,
        roverPos.z + Math.cos(roverHeading) * surveyDist
      );

      targetLookAt.copy(roverPos).add(new THREE.Vector3(0, 1.0 - pitch * 6.0, 0));
      this.camera.position.lerp(targetCamPos, Math.min(1.0, dt * 4.0));
      this.camera.lookAt(targetLookAt);
    }
  }

  _onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    const ratioCap = this.gfxMode === 1 ? 0.95 : (this.gfxMode === 2 ? 1.5 : 1.25);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, ratioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Real-time Framerate Monitor
    this.frameCount++;
    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
      if (this.fpsDisplay) {
        this.fpsDisplay.textContent = `${this.currentFps} FPS`;
        this.fpsDisplay.style.color = this.currentFps >= 50 ? '#78b860' : (this.currentFps >= 30 ? '#d4b540' : '#b84030');
      }
      if (this.topFpsDisplay) {
        this.topFpsDisplay.textContent = `${this.currentFps} FPS`;
      }
    }

    // 1. Update Rover Physics and Movement
    this.rover.update(dt);

    // 2. Stream Infinite Terrain Chunks around Rover
    this.terrain.update(this.rover.position.x, this.rover.position.z);

    // 3. Update Weather, Dust Storm & Shadows
    this.atmosphere.update(dt, this.rover.position.x, this.rover.position.z, this.terrain);

    // 4. Update Survival Mission Items (Strobes, pickups)
    this.itemsManager.update(dt, this.rover.position);

    // 5. Update Camera Rig
    this._updateCamera(dt);

    // 6. Update Heads-Up Display & Telemetry
    this.ui.update(dt);

    // 7. Update PeerJS Multiplayer Subsystem
    if (this.multiplayer) {
      this.multiplayer.update(dt);
    }

    // 8. Update 3D GLB Animations, Skyboxes, and Galactic Vortex
    if (this.glbManager) {
      this.glbManager.update(dt, this.camera.position);
    }

    // 8. Render 3D Frame
    this.renderer.render(this.scene, this.camera);

    // 9. Render Floating Collected 3D GLBs (Pure rotating 3D models)
    if (this.artifactsViewer) {
      this.artifactsViewer.update(dt);
    }

    // 10. Render Live Rover Mast Camera Feed (Image 4 Optimization - throttled every 2nd frame for 0 FPS impact)
    if (this.feedRenderer && this.feedCamera && this.ui.isWakeComplete) {
      if (this.frameCount % 2 === 0) {
        const fwdX = -Math.sin(this.rover.heading);
        const fwdZ = -Math.cos(this.rover.heading);
        this.feedCamera.position.set(
          this.rover.position.x + fwdX * 0.45,
          this.rover.position.y + 1.82,
          this.rover.position.z + fwdZ * 0.45
        );
        this.feedCamera.lookAt(
          this.feedCamera.position.x + fwdX * 50.0,
          this.feedCamera.position.y - 1.2,
          this.feedCamera.position.z + fwdZ * 50.0
        );
        this.feedRenderer.render(this.scene, this.feedCamera);
      }
    }
  }
}

// Instantiate game on page load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new MarsGame();
});
