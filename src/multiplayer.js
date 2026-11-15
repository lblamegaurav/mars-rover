import * as THREE from 'three';

// 6 Distinct Thematic Rover Explorer Profiles for Acidalia Expedition
const EXPLORER_PROFILES = [
  {
    name: 'Command-Gold',
    colorHex: 0xf59e0b,
    chassisHex: 0x452205,
    glowHex: 0xfbbf24,
    cssColor: '#f59e0b'
  },
  {
    name: 'Cosmic-Cyan',
    colorHex: 0x06b6d4,
    chassisHex: 0x0e3b43,
    glowHex: 0x22d3ee,
    cssColor: '#06b6d4'
  },
  {
    name: 'Emerald-Alpha',
    colorHex: 0x10b981,
    chassisHex: 0x064e3b,
    glowHex: 0x34d399,
    cssColor: '#10b981'
  },
  {
    name: 'Violet-Probe',
    colorHex: 0xa855f7,
    chassisHex: 0x4c1d95,
    glowHex: 0xc084fc,
    cssColor: '#a855f7'
  },
  {
    name: 'Coral-Vanguard',
    colorHex: 0xf43f5e,
    chassisHex: 0x881337,
    glowHex: 0xfb7185,
    cssColor: '#f43f5e'
  },
  {
    name: 'Sapphire-Recon',
    colorHex: 0x3b82f6,
    chassisHex: 0x1e3a8a,
    glowHex: 0x60a5fa,
    cssColor: '#3b82f6'
  }
];

export class MarsMultiplayer {
  constructor(scene, terrain, rover, itemsManager, onStatusMessage) {
    this.scene = scene;
    this.terrain = terrain;
    this.localRover = rover;
    this.itemsManager = itemsManager;
    this.onStatus = onStatusMessage || console.log;

    this.peer = null;
    this.conn = null; // Client's connection to host
    this.connections = new Map(); // Host: peerId -> { conn, name, slotIndex }
    this.isHost = false;
    this.isConnected = false;
    this.inGame = false;

    this.myPeerId = 'local';
    this.roomCode = '';
    this.roomPassword = '';
    this.localPlayerName = 'Commander Unit-01';
    this.roster = [];

    // Callbacks for UI
    this.onRosterUpdated = null;
    this.onGameStart = null;
    this.onRoomClosed = null;

    // Up to 6 simultaneous players: Map of peerId -> remotePlayerRecord
    this.remotePlayers = new Map();

    // Wheel geometry shared across all remote rovers for memory efficiency
    this.wheelGeom = new THREE.CylinderGeometry(0.48, 0.48, 0.35, 12);
    this.wheelGeom.rotateZ(Math.PI / 2);
    this.wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });

    // Throttle outbound telemetry (~25 updates/sec = 40ms)
    this.lastBroadcastTime = 0;
    this.broadcastInterval = 40;
  }

  // Build a distinct visual 3D rover mesh for a remote peer
  _buildRemoteRover(peerId, playerName, slotIndex = 1) {
    const profile = EXPLORER_PROFILES[slotIndex % EXPLORER_PROFILES.length];
    const group = new THREE.Group();
    group.name = `remote-rover-${peerId}`;

    // Chassis body
    const chassisMat = new THREE.MeshStandardMaterial({
      color: profile.chassisHex,
      roughness: 0.8,
      metalness: 0.35
    });
    const bodyGeom = new THREE.BoxGeometry(2.4, 0.7, 3.2);
    const body = new THREE.Mesh(bodyGeom, chassisMat);
    body.position.y = 0.8;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Accent Stripe
    const stripeMat = new THREE.MeshBasicMaterial({ color: profile.glowHex });
    const stripeGeom = new THREE.BoxGeometry(2.44, 0.08, 0.6);
    const stripe = new THREE.Mesh(stripeGeom, stripeMat);
    stripe.position.set(0, 0.85, 0.4);
    group.add(stripe);

    // Sensor mast
    const mastGeom = new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8);
    const mast = new THREE.Mesh(mastGeom, chassisMat);
    mast.position.set(0.4, 1.7, -1.0);
    group.add(mast);

    // Luminous Beacon Light & Orb
    const beaconLight = new THREE.PointLight(profile.glowHex, 4.5, 30, 1.5);
    beaconLight.position.set(0.4, 2.4, -1.0);
    group.add(beaconLight);

    const beaconGeom = new THREE.SphereGeometry(0.18, 10, 10);
    const beaconMat = new THREE.MeshBasicMaterial({ color: profile.glowHex });
    const beaconMesh = new THREE.Mesh(beaconGeom, beaconMat);
    beaconMesh.position.set(0.4, 2.4, -1.0);
    group.add(beaconMesh);

    // 6 Wheels
    const wheelOffsets = [
      [-1.4, 0.5, -1.2], [1.4, 0.5, -1.2],
      [-1.5, 0.48, 0.0],  [1.5, 0.48, 0.0],
      [-1.4, 0.5, 1.2],  [1.4, 0.5, 1.2]
    ];
    wheelOffsets.forEach(pos => {
      const w = new THREE.Mesh(this.wheelGeom, this.wheelMat);
      w.position.set(pos[0], pos[1], pos[2]);
      w.castShadow = true;
      group.add(w);
    });

    // Holographic Nameplate Sprite
    const labelSprite = this._createBillboardSprite(playerName, profile);
    labelSprite.position.set(0, 3.4, 0);
    group.add(labelSprite);

    group.visible = false;
    this.scene.add(group);

    return {
      group,
      labelSprite,
      profile,
      targetPos: new THREE.Vector3(0, 0, 0),
      targetHeading: 0,
      targetPitch: 0,
      speed: 0,
      name: playerName
    };
  }

  // Create lightweight canvas texture for overhead nameplate
  _createBillboardSprite(name, profile) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Rounded tag pill
    ctx.fillStyle = 'rgba(14, 10, 7, 0.88)';
    ctx.strokeStyle = profile.cssColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(4, 4, 248, 56, 10);
    ctx.fill();
    ctx.stroke();

    // Call sign text in Lucida Calligraphy
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Lucida Calligraphy", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name || 'EXPLORER').toUpperCase(), 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.95 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.6, 0.9, 1);
    return sprite;
  }

  _getOrCreateRemotePlayer(peerId, name, slotIndex) {
    let player = this.remotePlayers.get(peerId);
    if (!player) {
      player = this._buildRemoteRover(peerId, name, slotIndex || (this.remotePlayers.size + 1));
      this.remotePlayers.set(peerId, player);
    }
    return player;
  }

  _removeRemotePlayer(peerId) {
    const player = this.remotePlayers.get(peerId);
    if (player) {
      if (player.group) {
        this.scene.remove(player.group);
      }
      this.remotePlayers.delete(peerId);
    }
  }

  _getPeerConstructor() {
    return window.Peer || null;
  }

  // --- Host: Create Waiting Room (Up to 6 Players) ---
  createRoom(roomCode, password = '', playerName = 'Commander Unit-01') {
    const PeerClass = this._getPeerConstructor();
    if (!PeerClass) {
      this.onStatus('MULTIPLAYER: PEER SUBSYSTEM INITIALIZING...');
      return;
    }

    this.isHost = true;
    this.inGame = false;
    this.localPlayerName = playerName.trim() || 'Commander Unit-01';
    this.roomCode = (roomCode || `MARS-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
    this.roomPassword = password.trim();

    this.roster = [
      { id: 'host', name: this.localPlayerName, isHost: true, slot: 0, profile: EXPLORER_PROFILES[0] }
    ];
    this.connections.clear();
    this._clearRemotePlayers();

    const peerId = `mars-prov-${this.roomCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    this.myPeerId = 'host';
    this.onStatus(`CREATING EXPEDITION ROOM [${this.roomCode}]...`);

    if (this.peer) this.peer.destroy();
    this.peer = new PeerClass(peerId, { debug: 1 });

    this.peer.on('open', (id) => {
      this.onStatus(`WAITING ROOM ACTIVE // CODE: ${this.roomCode}`);
      if (this.onRosterUpdated) this.onRosterUpdated(this.roster);
    });

    this.peer.on('connection', (conn) => {
      this._handleHostIncomingConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.warn('Host peer error:', err);
      if (err.type === 'unavailable-id') {
        this.onStatus(`ROOM [${this.roomCode}] OCCUPIED. GENERATING NEW ROOM CODE...`);
        const newCode = `MARS-${Math.floor(1000 + Math.random() * 9000)}`;
        this.createRoom(newCode, password, playerName);
      } else {
        this.onStatus(`SIGNAL WARNING: ${err.type || 'RECONNECTING'}`);
      }
    });

    if (this.onRosterUpdated) this.onRosterUpdated(this.roster);
  }

  // Host accepts connection and enforces max 6 players & password check
  _handleHostIncomingConnection(conn) {
    conn.on('data', (data) => {
      if (!data || !data.type) return;

      if (data.type === 'auth') {
        // Enforce max 6 players
        if (this.roster.length >= 6) {
          conn.send({ type: 'auth_fail', reason: 'EXPEDITION ROOM FULL (MAX 6 PLAYERS)' });
          setTimeout(() => conn.close(), 200);
          return;
        }

        // Verify password
        if (this.roomPassword && data.password !== this.roomPassword) {
          conn.send({ type: 'auth_fail', reason: 'INCORRECT ROOM PASSWORD' });
          setTimeout(() => conn.close(), 200);
          this.onStatus('ACCESS DENIED: INCORRECT PASSWORD');
          return;
        }

        const clientName = (data.playerName || `Explorer Unit-0${this.roster.length + 1}`).trim();
        const slot = this.roster.length;
        const profile = EXPLORER_PROFILES[slot % EXPLORER_PROFILES.length];

        this.connections.set(conn.peer, { conn, name: clientName, slot });

        // Add to roster
        this.roster.push({
          id: conn.peer,
          name: clientName,
          isHost: false,
          slot,
          profile
        });

        // Instantiate remote rover mesh
        this._getOrCreateRemotePlayer(conn.peer, clientName, slot);

        // Send confirmation and full roster to newly joined client
        conn.send({
          type: 'auth_ok',
          yourPeerId: conn.peer,
          roster: this.roster,
          roomCode: this.roomCode
        });

        // Broadcast updated roster to all other clients
        this._broadcastPacket({
          type: 'roster_update',
          roster: this.roster
        });

        this.isConnected = true;
        this.onStatus(`EXPLORER [${clientName.toUpperCase()}] JOINED WAITING ROOM!`);
        if (this.onRosterUpdated) this.onRosterUpdated(this.roster);
      } else {
        this._handleGamePacket(data, conn.peer);
      }
    });

    conn.on('close', () => {
      const clientEntry = this.connections.get(conn.peer);
      const name = clientEntry ? clientEntry.name : 'Explorer';
      this.connections.delete(conn.peer);
      this._removeRemotePlayer(conn.peer);

      this.roster = this.roster.filter(p => p.id !== conn.peer);
      this._broadcastPacket({
        type: 'roster_update',
        roster: this.roster
      });
      this._broadcastPacket({
        type: 'player_left',
        peerId: conn.peer
      });

      this.onStatus(`EXPLORER [${name.toUpperCase()}] LEFT EXPEDITION`);
      if (this.onRosterUpdated) this.onRosterUpdated(this.roster);
    });

    conn.on('error', (err) => {
      console.warn('Host connection error:', err);
    });
  }

  // --- Client: Join Waiting Room ---
  joinRoom(roomCode, password = '', playerName = 'Explorer Unit-02') {
    const PeerClass = this._getPeerConstructor();
    if (!PeerClass) {
      this.onStatus('MULTIPLAYER: PEER SUBSYSTEM INITIALIZING...');
      return;
    }

    this.isHost = false;
    this.inGame = false;
    this.localPlayerName = playerName.trim() || 'Explorer Unit-02';
    this.roomCode = (roomCode || '').trim().toUpperCase();
    this.roomPassword = password.trim();

    this.roster = [
      { id: 'self', name: this.localPlayerName, isHost: false, slot: 1, profile: EXPLORER_PROFILES[1] }
    ];
    this._clearRemotePlayers();

    const targetPeerId = `mars-prov-${this.roomCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    this.onStatus(`CONNECTING TO ROOM [${this.roomCode}]...`);

    if (this.peer) this.peer.destroy();
    this.peer = new PeerClass({ debug: 1 });

    this.peer.on('open', (myId) => {
      this.myPeerId = myId;
      this.conn = this.peer.connect(targetPeerId, { reliable: true });
      this._setupClientConnection();
    });

    this.peer.on('error', (err) => {
      console.warn('Client peer join error:', err);
      this.onStatus(`JOIN FAILED: ROOM [${this.roomCode}] NOT REACHABLE`);
      if (this.onRoomClosed) this.onRoomClosed(`ROOM [${this.roomCode}] NOT FOUND`);
    });

    if (this.onRosterUpdated) this.onRosterUpdated(this.roster);
  }

  _setupClientConnection() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      // Send handshake auth
      this.conn.send({
        type: 'auth',
        password: this.roomPassword,
        playerName: this.localPlayerName
      });
    });

    this.conn.on('data', (data) => {
      if (!data || !data.type) return;

      if (data.type === 'auth_ok') {
        this.isConnected = true;
        this.myPeerId = data.yourPeerId || this.myPeerId;
        this.roster = data.roster || [];
        this._syncRosterRovers(this.roster);

        this.onStatus('JOINED WAITING ROOM! WAITING FOR HOST TO START...');
        if (this.onRosterUpdated) this.onRosterUpdated(this.roster);
      } else if (data.type === 'auth_fail') {
        this.isConnected = false;
        this.onStatus(`ACCESS DENIED: ${data.reason || 'PASSWORD INCORRECT'}`);
        if (this.onRoomClosed) this.onRoomClosed(data.reason || 'PASSWORD INCORRECT');
      } else if (data.type === 'roster_update') {
        this.roster = data.roster || [];
        this._syncRosterRovers(this.roster);
        if (this.onRosterUpdated) this.onRosterUpdated(this.roster);
      } else if (data.type === 'player_left') {
        this._removeRemotePlayer(data.peerId);
      } else if (data.type === 'start_game') {
        this.inGame = true;
        this.onStatus('EXPEDITION LAUNCHED BY COMMANDER! DEPLOYING...');
        if (this.onGameStart) this.onGameStart();
      } else if (data.type === 'room_closed') {
        this.isConnected = false;
        this.onStatus(`ROOM CLOSED: ${data.reason || 'HOST DISBANDED'}`);
        if (this.onRoomClosed) this.onRoomClosed(data.reason || 'HOST DISBANDED');
      } else {
        this._handleGamePacket(data, 'host');
      }
    });

    this.conn.on('close', () => {
      this.isConnected = false;
      this._clearRemotePlayers();
      this.onStatus('DISCONNECTED FROM EXPEDITION HOST');
      if (this.onRoomClosed) this.onRoomClosed('DISCONNECTED FROM EXPEDITION HOST');
    });

    this.conn.on('error', (err) => {
      console.warn('Client connection error:', err);
    });
  }

  // Ensure remote rovers exist for all other players in the roster
  _syncRosterRovers(roster) {
    roster.forEach(p => {
      if (p.id !== this.myPeerId && p.id !== 'self') {
        this._getOrCreateRemotePlayer(p.id, p.name, p.slot);
      }
    });
  }

  // --- Start Game (Host only) ---
  startGame() {
    if (!this.isHost) return;
    this.inGame = true;
    this._broadcastPacket({ type: 'start_game' });
    this.onStatus('LAUNCHING ACIDALIA EXPEDITION...');
    if (this.onGameStart) this.onGameStart();
  }

  // --- Leave / Disband Room ---
  leaveRoom() {
    if (this.isHost) {
      this._broadcastPacket({ type: 'room_closed', reason: 'HOST DISBANDED EXPEDITION' });
      this.connections.forEach(entry => entry.conn && entry.conn.close());
      this.connections.clear();
    } else {
      if (this.conn && this.conn.open) {
        this.conn.close();
      }
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.isConnected = false;
    this.inGame = false;
    this.roster = [];
    this._clearRemotePlayers();
    if (this.onRoomClosed) this.onRoomClosed('LEFT ROOM');
  }

  _clearRemotePlayers() {
    this.remotePlayers.forEach(p => {
      if (p.group) this.scene.remove(p.group);
    });
    this.remotePlayers.clear();
  }

  // Broadcast packet to all connected peers
  _broadcastPacket(data) {
    if (this.isHost) {
      this.connections.forEach(entry => {
        if (entry.conn && entry.conn.open) {
          entry.conn.send(data);
        }
      });
    } else if (this.conn && this.conn.open) {
      this.conn.send(data);
    }
  }

  // Process incoming game telemetry and artifact collection with star-relay
  _handleGamePacket(data, senderPeerId) {
    if (data.type === 'state') {
      const peerId = data.id || senderPeerId;
      // Do not process our own reflected state
      if (peerId === this.myPeerId || (this.isHost && peerId === 'host')) return;

      const player = this._getOrCreateRemotePlayer(peerId, data.name || 'Explorer');
      player.targetPos.set(data.x, data.y, data.z);
      player.targetHeading = data.heading;
      player.targetPitch = data.pitch;
      player.speed = data.speed;

      if (!player.group.visible) {
        player.group.visible = true;
        player.group.position.copy(player.targetPos);
      }

      // Star topology: If host, relay this client's state to all OTHER peers
      if (this.isHost) {
        this.connections.forEach((entry, otherPeerId) => {
          if (otherPeerId !== senderPeerId && entry.conn && entry.conn.open) {
            entry.conn.send(data);
          }
        });
      }
    } else if (data.type === 'collected') {
      if (this.itemsManager) {
        const item = this.itemsManager.items.find(i => i.id === data.id);
        if (item && !item.collected) {
          const collector = this.remotePlayers.get(data.collectorId);
          const collectPos = collector ? collector.targetPos : this.localRover.position;
          this.itemsManager.collectItem(item, collectPos);
          this.onStatus(`[${(data.collectorName || 'TEAM').toUpperCase()}] SALVAGED: ${item.name.toUpperCase()}`);
        }
      }

      // If host, relay salvage notification to all other peers
      if (this.isHost) {
        this.connections.forEach((entry, otherPeerId) => {
          if (otherPeerId !== senderPeerId && entry.conn && entry.conn.open) {
            entry.conn.send(data);
          }
        });
      }
    }
  }

  // Broadcast artifact collection event
  broadcastArtifactCollected(itemId) {
    const packet = {
      type: 'collected',
      id: itemId,
      collectorId: this.myPeerId,
      collectorName: this.localPlayerName
    };
    this._broadcastPacket(packet);
  }

  // Main render loop update
  update(dt) {
    const now = performance.now();

    // Outbound throttled telemetry broadcast (40ms ~ 25 updates/s)
    if (this.inGame && this.isConnected) {
      if (now - this.lastBroadcastTime >= this.broadcastInterval) {
        this.lastBroadcastTime = now;
        const packet = {
          type: 'state',
          id: this.myPeerId,
          name: this.localPlayerName,
          x: Math.round(this.localRover.position.x * 100) / 100,
          y: Math.round(this.localRover.position.y * 100) / 100,
          z: Math.round(this.localRover.position.z * 100) / 100,
          heading: Math.round(this.localRover.heading * 1000) / 1000,
          pitch: Math.round(this.localRover.pitch * 1000) / 1000,
          speed: Math.round((this.localRover.getSpeed() || 0) * 10) / 10
        };
        this._broadcastPacket(packet);
      }
    }

    // Smoothly interpolate all remote rovers in the 3D scene (zero stutter)
    this.remotePlayers.forEach(player => {
      if (player.group && player.group.visible) {
        player.group.position.lerp(player.targetPos, Math.min(1.0, dt * 14.0));
        player.group.rotation.y = THREE.MathUtils.lerp(
          player.group.rotation.y,
          player.targetHeading,
          Math.min(1.0, dt * 12.0)
        );
        player.group.rotation.x = THREE.MathUtils.lerp(
          player.group.rotation.x,
          player.targetPitch,
          Math.min(1.0, dt * 10.0)
        );
      }
    });
  }
}
