# MARS : PROVIDENCE PROTOCOL

> **A Dune-inspired, open-world Martian survival & recovery web game.**
> Built with Three.js, WebGL, procedural infinite terrain generation, authentic 3D GLB assets, and 100% procedural Web Audio API.

---

## 🏜️ Game Concept & Lore

Following the catastrophic atmospheric entry and crash of the colonial spacecraft **AEGIS-7** over **Acidalia Planitia**, 8 critical survival modules (Cryo-Seeds, Atmospheric Water Condenser, RTG Power Cell, O2 Sublimator, Sub-Space Transponder, etc.) were dispersed across hundreds of kilometers of endless Martian dunes.

You take command of the real **NASA Curiosity Mars Rover** (`curiosity-mars-rover.zip`). Your optical lenses boot up from blackout amidst the smoking titanium wreckage. Your mission: navigate the vast, dark, dusty Martian dune sea, observe the cosmic anomalies and alien nebula skies, and track down every scattered survival payload using your seismic scanner and compass beacon array before your communications window closes.

---

## ✨ Features & Mechanics

1. **Real NASA Curiosity Mars Rover**:
   - High-fidelity 3D model of NASA's Curiosity Mars Science Laboratory rover (`curiosity-mars-rover.zip` / `Curiosity_static.glb`).
   - Authentic ChemCam mast, robotic sample arm, rocker-bogie suspension, RTG nuclear generator, and hazard cameras.
   - Conforms dynamically to slopes, pitch, and roll with realistic off-road sand dust kick-up.

2. **Alien Space Nebula & Celestial Night Skybox**:
   - Planet enveloped by `alien_space_nebula_1_skybox.glb` and `sky_night.glb` creating an expansive cosmic panorama.
   - Deep space nebula clouds, galactic dust lanes, and the brilliant **Northern Star (Polaris Borealis)** with 4-point cross diffraction spikes.

3. **Animated Galactic Incident & Cosmic Dust Vortex**:
   - `galactic_incident.glb` rendered as an animated deep-space celestial event with an active 60-channel animation mixer.
   - Surrounded by an orbital vortex of 2,000+ swirling high-energy cosmic dust particles, embers, and plasma trails.

4. **Authentic Martian Landscape & Geological Formations**:
   - Procedural infinite dunes combined with `a_mountain.glb` (distant 450m horizon massifs), `mars_-_aram_chaos_region.glb` (canyon mesas), and `04_sculptjanuary18_-_desert.glb` (sculpted rock formations).

5. **Illuminated Survival Beacons ("Hide & Seek")**:
   - All 8 scattered survival modules feature:
     - 90-meter-tall vertical sky beacon pillars shooting into the starry sky.
     - 45-meter ground illumination auras casting colored light onto the sand and rocks.
     - Rotating, floating holographic marker cores and emergency strobes.

6. **Supercharged Headlights & Ground Floodlights**:
   - Forward searchlights (34.0 intensity, 180m range) + wide bumper floodlight (28.0 intensity) with volumetric beam shafts cutting through the dust storm.

7. **Cinematic "Waking Up" Eyelids Sequence**:
   - Mechanical shutter eyelids opening and closing with optical blur reduction from 28px down to 0px.

8. **100% Procedural Web Audio API**:
   - Zero external audio files required! Synthesizes howling Martian wind, electric motor whines, sand tread crunching, seismic sonar pings, and beacon chirps.

---

## 🎮 Controls

| Action | Keyboard | On-Screen Tactile Button |
|---|---|---|
| **Drive Forward** | `W` or `↑` | **▲ FWD** |
| **Reverse / Decelerate** | `S` or `↓` | **▼ REV** |
| **Steer Left** | `A` or `←` | **◄ LEFT** |
| **Steer Right** | `D` or `→` | **► RIGHT** |
| **Seismic Ping / Scan** | `Spacebar` | **◎ SCAN** |
| **Toggle Headlights** | `F` | **LIGHTS** |
| **Switch Camera Mode** | `C` | **CAM** (Chase / Mast / Survey) |
| **Toggle Audio Mute** | `M` | **AUDIO** |
| **Look Around / Tilt** | Click & Drag | Swipe on screen |

---

## 🚀 Running the Game Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the local development server
npm run dev

# 3. Open in your browser
http://localhost:3000
```
