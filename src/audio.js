// Mars Audio Engine - Procedural Web Audio API
// No external assets required. 100% synthesized for authentic atmosphere.

class MarsAudioEngine {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.isMuted = false;

    // Nodes
    this.masterGain = null;
    this.windGain = null;
    this.windFilter = null;
    this.windLFO = null;

    this.engineGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;

    this.treadGain = null;
    this.treadFilter = null;

    this.lastBeaconBeep = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this._initWind();
      this._initEngine();
      this._initTreadFriction();

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // --- Martian Wind Generator ---
  _initWind() {
    if (!this.ctx) return;
    // Generate 5 seconds of brown/pink noise in buffer
    const bufferSize = this.ctx.sampleRate * 5;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Gain compensation
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    // LFO for gusting wind dynamics
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.18, this.ctx.currentTime); // 0.18 Hz slow gusts
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(140, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(this.windFilter.frequency);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.28, this.ctx.currentTime);

    whiteNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    whiteNoise.start();
    lfo.start();
  }

  // --- Rover Electric Motor Synth ---
  _initEngine() {
    if (!this.ctx) return;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(38, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(76, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(160, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime); // Low idle hum

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  // --- Sand Tread Friction ---
  _initTreadFriction() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    this.treadFilter = this.ctx.createBiquadFilter();
    this.treadFilter.type = 'bandpass';
    this.treadFilter.frequency.setValueAtTime(650, this.ctx.currentTime);
    this.treadFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.treadGain = this.ctx.createGain();
    this.treadGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    noiseSource.connect(this.treadFilter);
    this.treadFilter.connect(this.treadGain);
    this.treadGain.connect(this.masterGain);

    noiseSource.start();
  }

  // Call on each animation frame with normalized speed (0 to 1) and turn force
  updateRoverAudio(speedNorm, isReversing = false, turnRate = 0) {
    if (!this.initialized || !this.ctx) return;

    const t = this.ctx.currentTime;
    const absSpeed = Math.min(1.0, Math.abs(speedNorm));
    const targetFreq = 38 + absSpeed * 85 + Math.abs(turnRate) * 20;
    const targetFilter = 150 + absSpeed * 420;
    const targetGain = 0.04 + absSpeed * 0.16 + (Math.abs(turnRate) > 0.1 ? 0.04 : 0);

    this.engineOsc1.frequency.setTargetAtTime(targetFreq, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.85, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(targetFilter, t, 0.08);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.08);

    // Tread sand crunch
    const treadTarget = absSpeed * 0.15;
    this.treadGain.gain.setTargetAtTime(treadTarget, t, 0.05);
    this.treadFilter.frequency.setTargetAtTime(500 + absSpeed * 400, t, 0.1);
  }

  // --- Optical Sensor Wakeup Sequence Sounds ---
  playWakeupSequence() {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;

    // 1. Heavy sub-bass jolt (impact survivor heartbeat)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, t);
    subOsc.frequency.exponentialRampToValueAtTime(25, t + 1.2);
    subGain.gain.setValueAtTime(0.4, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(t);
    subOsc.stop(t + 1.25);

    // 2. High voltage capacitor charging whine
    const capOsc = this.ctx.createOscillator();
    const capGain = this.ctx.createGain();
    capOsc.type = 'sine';
    capOsc.frequency.setValueAtTime(220, t + 0.3);
    capOsc.frequency.exponentialRampToValueAtTime(1400, t + 2.8);
    capGain.gain.setValueAtTime(0.001, t + 0.3);
    capGain.gain.linearRampToValueAtTime(0.08, t + 2.5);
    capGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    capOsc.connect(capGain);
    capGain.connect(this.masterGain);
    capOsc.start(t + 0.3);
    capOsc.stop(t + 3.0);

    // 3. Shutter lens clicks (double mechanical clicks)
    this._playClick(t + 0.8, 1200);
    this._playClick(t + 0.95, 800);
    this._playClick(t + 2.2, 1600);
    this._playClick(t + 2.35, 1100);
  }

  _playClick(time, freq) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, time + 0.05);
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  // --- Seismic Scanner Sonar Ping ---
  playScannerPing() {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Ground thump
    const thump = this.ctx.createOscillator();
    const thumpGain = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(90, t);
    thump.frequency.exponentialRampToValueAtTime(28, t + 0.8);
    thumpGain.gain.setValueAtTime(0.35, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    thump.connect(thumpGain);
    thumpGain.connect(this.masterGain);
    thump.start(t);
    thump.stop(t + 0.85);

    // Acoustic resonance ping
    const ping = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(520, t + 0.1);
    ping.frequency.exponentialRampToValueAtTime(320, t + 1.4);
    pingGain.gain.setValueAtTime(0.001, t);
    pingGain.gain.linearRampToValueAtTime(0.18, t + 0.15);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    ping.connect(pingGain);
    pingGain.connect(this.masterGain);
    ping.start(t + 0.1);
    ping.stop(t + 1.55);
  }

  // --- Distress Beacon Audio Chirp ---
  // Distance in meters: closer = faster chirps & louder
  updateBeaconProximity(closestDistance) {
    if (!this.initialized || !this.ctx) return;
    if (closestDistance > 450) return; // out of radio range

    const now = Date.now();
    // Chirp interval: 2500ms at 450m down to 250ms at 15m
    const norm = Math.max(0, Math.min(1, (closestDistance - 15) / 435));
    const interval = 250 + norm * 2000;

    if (now - this.lastBeaconBeep > interval) {
      this.lastBeaconBeep = now;
      this._playBeaconChirp(1 - norm);
    }
  }

  _playBeaconChirp(intensity) {
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1150, t);
    osc.frequency.exponentialRampToValueAtTime(750, t + 0.08);

    const volume = 0.04 + intensity * 0.18;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  // --- Overkilled Sci-Fi Artifact Collection Chime & Sub-Bass Warp ---
  playOverkillCollect(totalScore = 0) {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;

    // 1. Sub-Bass Cosmic Implosion Boom
    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(85, t);
    boom.frequency.exponentialRampToValueAtTime(22, t + 0.65);
    boomGain.gain.setValueAtTime(0.45, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    boom.connect(boomGain);
    boomGain.connect(this.masterGain);
    boom.start(t);
    boom.stop(t + 0.75);

    // 2. Ascending High-Energy Laser Arpeggio Sweep
    const notes = [329.63, 440.0, 554.37, 659.25, 880.0, 1108.73, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.055);
      gain.gain.setValueAtTime(0.16, t + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.055 + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.055);
      osc.stop(t + idx * 0.055 + 0.5);
    });

    // 3. Shimmer Sparkle Overtone
    const shimmer = this.ctx.createOscillator();
    const shimmerGain = this.ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(1760, t + 0.25);
    shimmer.frequency.exponentialRampToValueAtTime(2637, t + 0.75);
    shimmerGain.gain.setValueAtTime(0.09, t + 0.25);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0005, t + 0.8);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(this.masterGain);
    shimmer.start(t + 0.25);
    shimmer.stop(t + 0.85);

    // 4. Milestone 7,000,000+ Fanfare Trigger
    if (totalScore >= 7000000) {
      setTimeout(() => {
        this.playMilestoneFanfare();
      }, 500);
    }
  }

  // --- Grand 7M+ Milestone Fanfare ---
  playMilestoneFanfare() {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Epic D-Major Fanfare [D4, F#4, A4, D5, F#5, A5]
    const fanfareNotes = [293.66, 369.99, 440.0, 587.33, 739.99, 880.0];
    fanfareNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
      const startTime = t + idx * 0.12;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.9);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startTime);
      osc.stop(startTime + 0.95);
    });
  }

  // --- Item Collected Fanfare ---
  playCollectSuccess() {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [293.66, 369.99, 440.0, 587.33]; // D4, F#4, A4, D5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.1);
      gain.gain.setValueAtTime(0.18, t + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.1);
      osc.stop(t + idx * 0.1 + 0.55);
    });

    // Heavy mechanical lock
    this._playClick(t + 0.42, 400);
  }

  // --- Real Audio File Artifact Collection Sound (/audio/collectsound.mp3) ---
  playCollectAudio() {
    if (this.isMuted) return;
    try {
      if (!this.collectAudioEl) {
        this.collectAudioEl = new Audio('/audio/collectsound.mp3');
      }
      this.collectAudioEl.currentTime = 0;
      this.collectAudioEl.volume = 0.95;
      const playPromise = this.collectAudioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Audio element play deferred or blocked:', err);
          this.playCollectSuccess();
        });
      }
    } catch (e) {
      this.playCollectSuccess();
    }
  }

  // --- Toggle Audio Mute ---
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

export const marsAudio = new MarsAudioEngine();
if (typeof window !== 'undefined') {
  window.marsAudio = marsAudio;
}
