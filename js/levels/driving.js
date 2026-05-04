// ============================================================
//  STARRY PICNIC — levels/driving.js
//  First-person car drive to the park
//  A/D steer · W/S throttle/brake · avoid traffic · reach park
//
//  FIXES applied:
//   • Camera faces forward (removed erroneous +Math.PI on yaw)
//   • Reverse works correctly; travelled only counts forward progress
//   • Road chunk recycling no longer double-offsets children
//   • Speed-dependent steering (realistic understeer at high speed)
//   • Dynamic FOV / suspension bob
//   • Mixed traffic: same-direction AND oncoming lanes
//   • FIX: _recycleChunks condition corrected for −Z travel direction
//   • FIX: traffic wrap margins corrected for −Z travel
//   • FIX: collision box Z extents corrected (front of car is at lower Z)
// ============================================================

import { drivingBackground } from '../backgrounds.js';
import * as THREE from 'three';
import { Level, Anime, Build } from '../engine.js';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const ROAD_W        = 14;      // total road width (4 lanes × 3.5)
const LANE_W        = 3.5;
const LANES         = 4;
// lane centres: negative X = oncoming side, positive X = player side
const LANE_CX       = [-5.25, -1.75, 1.75, 5.25];
const PLAYER_LANES  = [2, 3];  // indices player can use
const ONCOMING_LANES= [0, 1];  // oncoming traffic lanes

const ROAD_LEN      = 800;
const CHUNK_LEN     = 100;
const CHUNK_COUNT   = 10;      // how many chunks in the pool

const MAX_SPEED     = 22;      // m/s forward  (~79 km/h)
const MAX_REVERSE   = 5;       // m/s reverse
const ACCEL         = 9;
const BRAKE_FORCE   = 16;
const COAST_DRAG    = 3.5;
const REVERSE_ACCEL = 5;

// Steering: turn rate scales DOWN with speed (understeer at high speed)
const STEER_MAX_DEG    = 32;   // max wheel angle (degrees) at low speed
const STEER_SPEED_NORM = 8;    // speed at which steer angle halves
const STEER_INPUT_RATE = 2.4;  // how fast steer input builds
const STEER_RETURN     = 4.0;  // auto-centre rate

const CAR_HALF_W    = 0.85;
const EYE_HEIGHT    = 1.28;

const TRAFFIC_COUNT = 14;
const NPC_SPEED_MIN = 8;
const NPC_SPEED_MAX = 15;
const NPC_ONCOMING_SPEED_MIN = 10;
const NPC_ONCOMING_SPEED_MAX = 18;

const NPC_COLORS    = [0xff6688, 0x66aaff, 0xffcc44, 0x88ffcc, 0xff8844, 0xcc66ff, 0xffffff, 0x44ddaa];
const TREE_COLORS   = [0x44cc55, 0x33aa44, 0x55dd66, 0x22bb33];

const BASE_FOV   = 72;
const MAX_FOV    = 82;   // FOV widens at high speed for rush feel

// ─────────────────────────────────────────────────────────────
export class Driving extends Level {
// ─────────────────────────────────────────────────────────────

  constructor(engine) {
    super(engine);

    // ── car state ─────────────────────────────────────────
    this.carPos    = new THREE.Vector3(LANE_CX[2], 0, 0);
    this.carSpeed  = 0;      // positive = forward, negative = reverse
    this.carSteer  = 0;      // -1 … +1 (steering input accumulator)
    this.carYaw    = 0;      // radians — 0 = looking in -Z (forward)
    this.travelled = 0;      // metres driven forward only
    this._done     = false;
    this._crashed  = false;
    this._crashTimer  = 0;
    this._hornTimer   = 0;
    this._shakeAmt    = 0;
    this._suspBob     = 0;   // vertical suspension oscillation
    this._suspBobT    = 0;

    // ── visuals ───────────────────────────────────────────
    this._carGroup    = null;
    this._steerWheel  = null;
    this._roadChunks  = [];
    this._traffic     = [];
    this._speedoCtx   = null;
    this._speedoTex   = null;
    this._rpmDots     = [];
    this._driveHUD    = null;
    this._domSpeedFill= null;
    this._domSpeedNum = null;
    this._domDistNum  = null;
    this._domDistFill = null;
    this._domCrash    = null;
    this._domGear     = null;
  }

  // ══════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════
  init() {
    const s = this.scene;

    this._sky = drivingBackground(this.scene);


    // wide grass ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, ROAD_LEN + 400),
      Anime.mat(0x77bb55)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -(ROAD_LEN / 2));
    ground.receiveShadow = true;
    s.add(ground);

    // ── Road chunks (pool, recycled as player advances) ──
    for (let i = 0; i < CHUNK_COUNT; i++) this._spawnChunk(i);

    // ── Traffic ──────────────────────────────────────────
    for (let i = 0; i < TRAFFIC_COUNT; i++) this._spawnTraffic(i);

    // ── Scenery ──────────────────────────────────────────
    this._buildScenery(s);

    // ── Car interior (first-person) ───────────────────────
    this._buildInterior(s);

    // ── DOM HUD ───────────────────────────────────────────
    this._buildHUD();
  }

  // ── Road chunk ─────────────────────────────────────────────
  // Children are positioned LOCALLY (relative to group),
  // so only group.position needs to move during recycling.
  _spawnChunk(idx) {
    const s  = this.scene;
    const gz = -(idx * CHUNK_LEN);   // group world Z — negative because road runs in −Z
    const g  = new THREE.Group();
    g.position.set(0, 0, gz);
    s.add(g);

    const halfLen = CHUNK_LEN / 2;

    // tarmac
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W, CHUNK_LEN),
      Anime.mat(0x4a4a5a)
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.005, -halfLen);
    g.add(road);

    // centre divider (double yellow)
    [-0.12, 0.12].forEach(ox => {
      const div = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, CHUNK_LEN),
        new THREE.MeshBasicMaterial({ color: 0xffdd00 })
      );
      div.rotation.x = -Math.PI / 2;
      div.position.set(ox, 0.013, -halfLen);
      g.add(div);
    });

    // lane dashes (same-direction side: X > 0)
    for (let l = 1; l < 2; l++) {
      const lx = 0 + l * LANE_W;
      for (let dz = 0; dz < CHUNK_LEN; dz += 6) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(0.14, 3.2),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.013, -(dz + 1.6));
        g.add(dash);
      }
    }
    // oncoming dashes (X < 0)
    for (let l = 1; l < 2; l++) {
      const lx = -l * LANE_W;
      for (let dz = 0; dz < CHUNK_LEN; dz += 6) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(0.14, 3.2),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.013, -(dz + 1.6));
        g.add(dash);
      }
    }

    // road edge lines
    [-ROAD_W / 2, ROAD_W / 2].forEach(ex => {
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, CHUNK_LEN),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(ex, 0.012, -halfLen);
      g.add(edge);
    });

    // kerbs
    [-ROAD_W / 2 - 0.2, ROAD_W / 2 + 0.2].forEach(kx => {
      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.13, CHUNK_LEN),
        Anime.mat(0xddddcc)
      );
      kerb.position.set(kx, 0.065, -halfLen);
      g.add(kerb);
    });

    g.userData.chunkIdx = idx;
    this._roadChunks.push(g);
    return g;
  }

  // ── Traffic NPC ────────────────────────────────────────────
  _spawnTraffic(slot) {
    const s = this.scene;
    const isOncoming = slot < Math.floor(TRAFFIC_COUNT / 2);
    const lanePool   = isOncoming ? ONCOMING_LANES : PLAYER_LANES;
    const laneIdx    = lanePool[Math.floor(Math.random() * lanePool.length)];
    const color      = NPC_COLORS[Math.floor(Math.random() * NPC_COLORS.length)];

    const g = Build.carBody(s, color);

    if (isOncoming) {
      // Oncoming: faces +Z (toward player), placed far ahead in −Z, moves in +Z
      g.rotation.y = 0;
      const startZ = -(30 + slot * (ROAD_LEN / TRAFFIC_COUNT));
      g.position.set(LANE_CX[laneIdx], 0, startZ);
      const spd = NPC_ONCOMING_SPEED_MIN + Math.random() * (NPC_ONCOMING_SPEED_MAX - NPC_ONCOMING_SPEED_MIN);
      this._traffic.push({ g, laneIdx, speed: spd, isOncoming: true, slot });
    } else {
      // Same-direction: faces −Z (same as player), placed ahead in −Z, moves in −Z
      g.rotation.y = Math.PI;
      const startZ = -(40 + (slot - Math.floor(TRAFFIC_COUNT / 2)) * (ROAD_LEN / (TRAFFIC_COUNT / 2)));
      g.position.set(LANE_CX[laneIdx], 0, startZ);
      const spd = NPC_SPEED_MIN + Math.random() * (NPC_SPEED_MAX - NPC_SPEED_MIN);
      this._traffic.push({ g, laneIdx, speed: spd, isOncoming: false, slot });
    }
  }

  // ── Scenery ────────────────────────────────────────────────
  _buildScenery(s) {
    const treeCount = 80;
    for (let i = 0; i < treeCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const tx   = side * (ROAD_W / 2 + 1.8 + Math.random() * 6);
      const tz   = -(i * (ROAD_LEN / treeCount));

      if (i % 6 === 0) {
        // lamppost
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 5.2, 8),
          Anime.mat(0x999aaa)
        );
        post.position.set(tx, 2.6, tz);
        s.add(post);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5),
          new THREE.MeshBasicMaterial({ color: 0xfffacc }));
        head.position.set(tx + side * 0.4, 5.3, tz);
        s.add(head);
        const pt = new THREE.PointLight(0xfffacc, 0.6, 9);
        pt.position.copy(head.position);
        s.add(pt);
      } else {
        s.add(this._makeTree(tx, tz, TREE_COLORS[i % TREE_COLORS.length]));
      }
    }

    // road signs
    [
      { z: -60,  text: '🚗 Drive carefully!' },
      { z: -200, text: '🌳 Park: 600 m'     },
      { z: -400, text: '🌳 Park: 400 m'     },
      { z: -600, text: '⭐ Park: 200 m'     },
      { z: -750, text: '🎉 Almost there!'   },
    ].forEach(({ z, text }) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8),
        Anime.mat(0x888899)
      );
      post.position.set(ROAD_W / 2 + 1.6, 1.6, z);
      s.add(post);
      Build.label(s, text, ROAD_W / 2 + 1.6, 3.5, z, '#fff', 'rgba(60,20,100,0.88)');
    });

    this._buildFinishLine(s);
  }

  _makeTree(x, z, color) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.22, 1.3, 7), Anime.mat(0x7a4422));
    trunk.position.y = 0.65; g.add(trunk); Anime.outline(trunk, 0.05);
    for (let t = 0; t < 3; t++) {
      const r   = 1.6 - t * 0.38;
      const top = new THREE.Mesh(new THREE.ConeGeometry(r, 0.95 + t * 0.12, 8), Anime.mat(color));
      top.position.y = 1.6 + t * 0.68; g.add(top); Anime.outline(top, 0.05);
    }
    return g;
  }

  _buildFinishLine(s) {
    const fz = -(ROAD_LEN - 8);
    // checker banner
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 64;
    const bx = bc.getContext('2d');
    for (let cx2 = 0; cx2 < 16; cx2++) for (let ry = 0; ry < 4; ry++) {
      bx.fillStyle = (cx2 + ry) % 2 === 0 ? '#000' : '#fff';
      bx.fillRect(cx2 * 16, ry * 16, 16, 16);
    }
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W + 2, 1.0),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), side: THREE.DoubleSide })
    );
    banner.position.set(0, 5.5, fz); s.add(banner);
    [-ROAD_W / 2 - 0.6, ROAD_W / 2 + 0.6].forEach(px => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 6.2, 8), Anime.mat(0xff4488));
      pole.position.set(px, 3.1, fz); s.add(pole); Anime.outline(pole, 0.04);
    });
    Build.label(s, '🌳 Picnic Park! 🎉', 0, 7.2, fz, '#ffd700', 'rgba(60,0,120,0.92)');
  }

  // ── Car interior (first-person) ────────────────────────────
  _buildInterior(s) {
    const g = new THREE.Group(); s.add(g); this._carGroup = g;

    // dashboard
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.48, 0.58), Anime.mat(0x221833));
    dash.position.set(0, -0.44, -0.64); g.add(dash);
    const dashTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.09, 0.52), Anime.mat(0x110022));
    dashTop.position.set(0, -0.21, -0.62); g.add(dashTop);

    // steering wheel
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.038, 8, 24), Anime.mat(0x111122));
    rim.position.set(0, -0.30, -0.54); rim.rotation.x = Math.PI / 5; g.add(rim);
    Anime.outline(rim, 0.04);
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(a => {
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.20, 6), Anime.mat(0x111122));
      spoke.position.set(Math.sin(a) * 0.11, -0.30 + Math.cos(a) * 0.11, -0.54);
      spoke.rotation.z = a; spoke.rotation.x = Math.PI / 5; g.add(spoke);
    });
    this._steerWheel = rim;
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), Anime.mat(0x111122));
    col.position.set(0, -0.48, -0.58); col.rotation.x = -Math.PI / 5; g.add(col);

    // windscreen top bar + A-pillars
    const wf = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.11, 0.09), Anime.mat(0x110022));
    wf.position.set(0, 0.30, -0.72); g.add(wf);
    [-1.08, 1.08].forEach(px => {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.68, 0.09), Anime.mat(0x110022));
      pillar.position.set(px, -0.04, -0.72);
      pillar.rotation.z = px > 0 ? -0.12 : 0.12; g.add(pillar);
    });

    // rear-view mirror
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.04), Anime.mat(0x334455));
    mir.position.set(0, 0.24, -0.56); g.add(mir);
    const mirG = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.09, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x88aacc }));
    mirG.position.set(0, 0.24, -0.54); g.add(mirG);

    // speedometer
    this._buildSpeedoCluster(g);

    // side windows
    [-1.09, 1.09].forEach(px => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.46),
        new THREE.MeshBasicMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
      w.position.set(px, 0.02, -0.40); w.rotation.y = px > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(w);
    });

    // hood (colour matches car — here hardcoded; you could pass in car color)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.065, 0.9), Anime.mat(0xff6688));
    hood.position.set(0, -0.37, -1.12); g.add(hood); Anime.outline(hood, 0.03);
  }

  _buildSpeedoCluster(g) {
    this._speedoCanvas = document.createElement('canvas');
    this._speedoCanvas.width = 128; this._speedoCanvas.height = 128;
    this._speedoCtx = this._speedoCanvas.getContext('2d');
    this._speedoTex = new THREE.CanvasTexture(this._speedoCanvas);
    this._drawSpeedo(0);
    const dial = new THREE.Mesh(
      new THREE.CircleGeometry(0.088, 16),
      new THREE.MeshBasicMaterial({ map: this._speedoTex }));
    dial.position.set(-0.40, -0.37, -0.38); dial.rotation.x = -Math.PI / 4; g.add(dial);

    this._rpmDots = [];
    for (let i = 0; i < 8; i++) {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 6),
        new THREE.MeshBasicMaterial({ color: 0x003300 }));
      dot.position.set(-0.085 + i * 0.028, -0.34, -0.38);
      dot.rotation.x = -Math.PI / 4; g.add(dot);
      this._rpmDots.push(dot);
    }
  }

  _drawSpeedo(speed) {
    const ctx = this._speedoCtx;
    const cx = 64, cy = 64, r = 56;
    ctx.clearRect(0, 0, 128, 128);
    ctx.fillStyle = '#111122'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#4444aa'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const inner = i % 2 === 0 ? r - 14 : r - 10;
      ctx.strokeStyle = '#aaaacc'; ctx.lineWidth = i % 2 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
      ctx.stroke();
    }
    const absSpeed = Math.abs(speed);
    const pct   = Math.min(absSpeed / MAX_SPEED, 1);
    const angle = Math.PI * 0.75 + pct * Math.PI * 1.5;
    const nCol  = pct > 0.80 ? '#ff4444' : pct > 0.55 ? '#ffaa00' : '#44ffaa';
    ctx.strokeStyle = nCol; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(angle) * 10, cy - Math.sin(angle) * 10);
    ctx.lineTo(cx + Math.cos(angle) * 46, cy + Math.sin(angle) * 46);
    ctx.stroke();
    ctx.fillStyle = '#8888cc'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(absSpeed * 3.6), cx, cy + 22);
    if (this._speedoTex) this._speedoTex.needsUpdate = true;
  }

  // ── DOM HUD ────────────────────────────────────────────────
  _buildHUD() {
    const el = document.createElement('div');
    el.id = 'driveHUD';
    el.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      display:none;gap:16px;align-items:flex-end;pointer-events:none;z-index:20;
    `;
    el.innerHTML = `
      <div style="background:rgba(20,10,50,0.85);border-radius:12px;padding:10px 18px;
        border:1.5px solid rgba(180,140,255,0.4);min-width:140px">
        <div style="font-size:11px;color:#aaa;margin-bottom:4px">SPEED</div>
        <div style="height:10px;background:rgba(255,255,255,0.1);border-radius:999px;overflow:hidden">
          <div id="drvSpeedFill" style="height:100%;width:0%;border-radius:999px;
            background:linear-gradient(90deg,#44ffaa,#ffdd44,#ff4444);transition:width 0.07s"></div>
        </div>
        <div id="drvSpeedNum" style="font-size:22px;font-weight:900;color:#fff;
          font-family:monospace;text-align:right;margin-top:4px">0 km/h</div>
      </div>
      <div style="background:rgba(20,10,50,0.85);border-radius:12px;padding:10px 18px;
        border:1.5px solid rgba(180,140,255,0.4);min-width:130px">
        <div style="font-size:11px;color:#aaa;margin-bottom:4px">TO PARK</div>
        <div id="drvDistNum" style="font-size:22px;font-weight:900;color:#ffd700;font-family:monospace">800 m</div>
        <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:999px;overflow:hidden;margin-top:6px">
          <div id="drvDistFill" style="height:100%;width:0%;border-radius:999px;
            background:linear-gradient(90deg,#c890ff,#ffd700);transition:width 0.2s"></div>
        </div>
      </div>
      <div style="background:rgba(20,10,50,0.85);border-radius:12px;padding:10px 16px;
        border:1.5px solid rgba(180,140,255,0.4);text-align:center">
        <div style="font-size:11px;color:#aaa;margin-bottom:4px">GEAR</div>
        <div id="drvGear" style="font-size:26px;font-weight:900;color:#fff;font-family:monospace">N</div>
      </div>
      <div id="drvCrash" style="display:none;background:rgba(200,20,20,0.90);border-radius:12px;
        padding:10px 18px;border:1.5px solid #ff4444;color:#fff;font-weight:700;font-size:15px">
        💥 Crash!
      </div>
    `;
    document.body.appendChild(el);
    this._driveHUD     = el;
    this._domSpeedFill = el.querySelector('#drvSpeedFill');
    this._domSpeedNum  = el.querySelector('#drvSpeedNum');
    this._domDistNum   = el.querySelector('#drvDistNum');
    this._domDistFill  = el.querySelector('#drvDistFill');
    this._domGear      = el.querySelector('#drvGear');
    this._domCrash     = el.querySelector('#drvCrash');
  }

  // ══════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════
  onEnter() {
    this.carPos.set(LANE_CX[2], 0, 0);
    this.carSpeed  = 0;
    this.carSteer  = 0;
    this.carYaw    = 0;
    this.travelled = 0;
    this._done     = false;
    this._crashed  = false;
    this._crashTimer = 0;
    this._shakeAmt   = 0;
    this._suspBobT   = 0;

    this._traffic.forEach((t, i) => {
      const lanePool = t.isOncoming ? ONCOMING_LANES : PLAYER_LANES;
      t.laneIdx = lanePool[Math.floor(Math.random() * lanePool.length)];
      const sp = t.isOncoming
        ? NPC_ONCOMING_SPEED_MIN + Math.random() * (NPC_ONCOMING_SPEED_MAX - NPC_ONCOMING_SPEED_MIN)
        : NPC_SPEED_MIN + Math.random() * (NPC_SPEED_MAX - NPC_SPEED_MIN);
      t.speed = sp;
      t.g.position.set(
        LANE_CX[t.laneIdx], 0,
        t.isOncoming
          ? -(30  + i * (ROAD_LEN / TRAFFIC_COUNT))
          : -(40  + i * (ROAD_LEN / TRAFFIC_COUNT))
      );
    });

    this.camera.fov = BASE_FOV;
    this.camera.updateProjectionMatrix();
    this._driveHUD.style.display = 'flex';
    this.engine.audio.play('engine');
    this.engine.audio.play('music', 130);

    this.engine.hud.setInfo(`
      <div style="font-weight:700;font-size:13px;color:#ffd700;margin-bottom:6px">🚗 Road Trip</div>
      <div>W / ↑ — Accelerate</div>
      <div>S / ↓ — Brake / Reverse</div>
      <div>A / ← &nbsp; D / → — Steer</div>
      <div>F — Horn 📯</div>
      <div style="margin-top:6px;font-size:11px;opacity:0.6">
        Watch out for oncoming traffic!<br>Reach the park 800 m ahead.
      </div>
    `);
  }

  onExit() {
    this.engine.audio.play('engineStop');
    this.engine.audio.play('musicStop');
    this._driveHUD.style.display = 'none';
  }

  // ══════════════════════════════════════════════════════════
  //  UPDATE
  // ══════════════════════════════════════════════════════════
  
  update(dt) {
    this._sky?.update(dt);
    if (this._done) return;
    const inp = this.engine.input;

    // ── crash cooldown ────────────────────────────────────
    if (this._crashed) {
      this._crashTimer -= dt;
      this._shakeAmt    = Math.max(0, this._shakeAmt - dt * 5);
      if (this._crashTimer <= 0) {
        this._crashed = false;
        this._domCrash.style.display = 'none';
      }
    }

    // ── throttle / brake / reverse ────────────────────────
    if (!this._crashed) {
      const fwd = inp.anyOf('KeyW', 'ArrowUp');
      const bwd = inp.anyOf('KeyS', 'ArrowDown');

      if (fwd) {
        if (this.carSpeed < 0) {
          // braking from reverse
          this.carSpeed = Math.min(0, this.carSpeed + BRAKE_FORCE * dt);
        } else {
          this.carSpeed = Math.min(MAX_SPEED, this.carSpeed + ACCEL * dt);
        }
      } else if (bwd) {
        if (this.carSpeed > 0) {
          // braking from forward
          this.carSpeed = Math.max(0, this.carSpeed - BRAKE_FORCE * dt);
        } else {
          // reversing
          this.carSpeed = Math.max(-MAX_REVERSE, this.carSpeed - REVERSE_ACCEL * dt);
        }
      } else {
        // coast to stop
        if (this.carSpeed > 0) this.carSpeed = Math.max(0, this.carSpeed - COAST_DRAG * dt);
        if (this.carSpeed < 0) this.carSpeed = Math.min(0, this.carSpeed + COAST_DRAG * dt);
      }

      // ── steering (speed-dependent — understeer at high speed) ─
      const steerInput = (inp.anyOf('KeyD','ArrowRight') ? 1 : 0)
                       - (inp.anyOf('KeyA','ArrowLeft')  ? 1 : 0);
      if (steerInput !== 0) {
        this.carSteer = THREE.MathUtils.clamp(
          this.carSteer + steerInput * STEER_INPUT_RATE * dt, -1, 1
        );
      } else {
        this.carSteer *= Math.max(0, 1 - STEER_RETURN * dt);
      }
    }

    // ── move car ─────────────────────────────────────────
    if (!this._crashed) {
      // Steering angle shrinks as speed rises (realistic understeer)
      const speedFactor  = Math.abs(this.carSpeed) / (Math.abs(this.carSpeed) + STEER_SPEED_NORM);
      const steerAngleRad = THREE.MathUtils.degToRad(STEER_MAX_DEG) * this.carSteer * speedFactor;
      // Reverse: steering is inverted
      const steerDir = this.carSpeed >= 0 ? 1 : -1;
      this.carYaw += steerDir * steerAngleRad * (Math.abs(this.carSpeed) / MAX_SPEED) * dt * 1.4;

      // Forward direction: camera looks in -Z at yaw=0
      const fwdVec = new THREE.Vector3(Math.sin(this.carYaw), 0, -Math.cos(this.carYaw));
      this.carPos.addScaledVector(fwdVec, this.carSpeed * dt);

      // ── Only count FORWARD movement toward park ───────
      if (this.carSpeed > 0) {
        this.travelled += this.carSpeed * dt;
      }
    }

    // clamp to road width
    this.carPos.x = THREE.MathUtils.clamp(
      this.carPos.x, -(ROAD_W / 2 - CAR_HALF_W), ROAD_W / 2 - CAR_HALF_W
    );

    // ── horn ─────────────────────────────────────────────
    this._hornTimer -= dt;
    if (inp.is('KeyF') && this._hornTimer <= 0) {
      this.engine.audio.play('horn'); this._hornTimer = 0.6;
    }

    // ── engine audio ──────────────────────────────────────
    this.engine.audio.play('engineRev', Math.abs(this.carSpeed) / MAX_SPEED);

    // ── traffic ───────────────────────────────────────────
    this._updateTraffic(dt);
    if (!this._crashed) this._checkCollisions();

    // ── chunk recycling ───────────────────────────────────
    this._recycleChunks();

    // ── camera ────────────────────────────────────────────
    this._updateCamera(dt);

    // ── interior follows camera ───────────────────────────
    this._carGroup.position.copy(this.camera.position);
    this._carGroup.quaternion.copy(this.camera.quaternion);
    if (this._steerWheel) this._steerWheel.rotation.z = -this.carSteer * 0.85;

    // ── speedo ────────────────────────────────────────────
    this._drawSpeedo(this.carSpeed);
    const kmh      = Math.round(Math.abs(this.carSpeed) * 3.6);
    const remaining= Math.max(0, ROAD_LEN - this.travelled);
    const gear     = this.carSpeed > 0.5 ? 'D' : this.carSpeed < -0.5 ? 'R' : 'N';
    this._domSpeedNum.textContent  = kmh + ' km/h';
    this._domSpeedFill.style.width = (Math.abs(this.carSpeed) / MAX_SPEED * 100) + '%';
    this._domDistNum.textContent   = Math.round(remaining) + ' m';
    this._domDistFill.style.width  = (this.travelled / ROAD_LEN * 100) + '%';
    this._domGear.textContent      = gear;
    this._domGear.style.color      = gear === 'R' ? '#ff8844' : gear === 'D' ? '#44ffaa' : '#fff';

    this._rpmDots.forEach((dot, i) => {
      const lit = Math.round((Math.abs(this.carSpeed) / MAX_SPEED) * 8);
      dot.material.color.set(i < lit
        ? (i > 5 ? 0xff2200 : i > 3 ? 0xffaa00 : 0x00ff44) : 0x112211);
    });

    // ── arrival ───────────────────────────────────────────
    if (this.travelled >= ROAD_LEN) this._arrive();
  }

  // ── Camera update ──────────────────────────────────────────
  _updateCamera(dt) {
    // Suspension bob (proportional to speed, increases on rough road randomly)
    this._suspBobT += dt * (3 + Math.abs(this.carSpeed) * 0.25);
    const bob = Math.sin(this._suspBobT) * 0.018 * (Math.abs(this.carSpeed) / MAX_SPEED);

    // Screen shake on crash
    const sk = this._shakeAmt;

    this.camera.position.set(
      this.carPos.x + (Math.random() - 0.5) * sk * 0.22,
      EYE_HEIGHT + bob + (Math.random() - 0.5) * sk * 0.10,
      this.carPos.z + (Math.random() - 0.5) * sk * 0.12
    );

    // Camera yaw = carYaw (NOT carYaw + Math.PI)
    // At yaw=0 the camera looks in -Z, matching the forward vector.
    const roll     = -this.carSteer * 0.038;
    const pitchFwd = (this.carSpeed / MAX_SPEED) * 0.016;

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.carYaw;
    this.camera.rotation.x = -pitchFwd;
    this.camera.rotation.z = roll;

    // Dynamic FOV: widens at high speed
    const targetFOV = BASE_FOV + (Math.abs(this.carSpeed) / MAX_SPEED) * (MAX_FOV - BASE_FOV);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 4);
    this.camera.updateProjectionMatrix();
  }

  // ── Traffic update ─────────────────────────────────────────
  _updateTraffic(dt) {
    this._traffic.forEach(t => {
      if (t.isOncoming) {
        // Oncoming traffic moves in +Z (toward player start)
        t.g.position.z += t.speed * dt;
        // FIX: Wrap when car has passed well behind the player (its Z > player Z + buffer)
        if (t.g.position.z > this.carPos.z + 40) {
          t.laneIdx = ONCOMING_LANES[Math.floor(Math.random() * ONCOMING_LANES.length)];
          t.g.position.x = LANE_CX[t.laneIdx];
          t.g.position.z = this.carPos.z - (100 + Math.random() * 150);
          t.speed = NPC_ONCOMING_SPEED_MIN + Math.random() * (NPC_ONCOMING_SPEED_MAX - NPC_ONCOMING_SPEED_MIN);
        }
      } else {
        // Same-direction traffic moves in -Z
        t.g.position.z -= t.speed * dt;
        // FIX: Wrap when car has fallen well behind the player.
        // Same-dir NPCs move at NPC_SPEED_MIN..MAX (8–15 m/s); player max is 22 m/s,
        // so player will overtake them. They fall behind (higher Z) as player advances.
        // Wrap condition: NPC is more than 60m behind the player.
        if (t.g.position.z > this.carPos.z + 60) {
          t.laneIdx = PLAYER_LANES[Math.floor(Math.random() * PLAYER_LANES.length)];
          t.g.position.x = LANE_CX[t.laneIdx];
          t.g.position.z = this.carPos.z - (80 + Math.random() * 120);
          t.speed = NPC_SPEED_MIN + Math.random() * (NPC_SPEED_MAX - NPC_SPEED_MIN);
        }
      }
      // gentle suspension bob
      t.g.position.y = Math.sin(performance.now() / 500 + t.slot * 1.3) * 0.018;
    });
  }

  // ── Collision ──────────────────────────────────────────────
  _checkCollisions() {
    // FIX: Z extents corrected — car front is at carPos.z - 2.3 (more negative = forward),
    // rear is at carPos.z + 0.6. The original had these the right way but let's be explicit.
    const playerBox = new THREE.Box3(
      new THREE.Vector3(this.carPos.x - CAR_HALF_W, 0,    this.carPos.z - 2.3),
      new THREE.Vector3(this.carPos.x + CAR_HALF_W, 1.6,  this.carPos.z + 0.6)
    );
    const npcBox = new THREE.Box3();
    for (const t of this._traffic) {
      npcBox.setFromObject(t.g);
      if (playerBox.intersectsBox(npcBox)) { this._triggerCrash(); break; }
    }
  }

  _triggerCrash() {
    this._crashed     = true;
    this._crashTimer  = 1.8;
    this._shakeAmt    = 1.2;
    this.carSpeed     = 0;
    this._domCrash.style.display = 'block';
    this.engine.audio.play('deny');
    this.engine.audio.play('whoosh');
  }

  // ── Road recycling ─────────────────────────────────────────
  // FIX: Player travels in -Z, so "behind" means a chunk whose Z is GREATER than
  // the player's Z. The old condition (worldZ > playerZ + CHUNK_LEN) was correct
  // in sign but the poolSpan subtraction must bring it forward (more negative Z).
  //
  // Example: player at z=-350, CHUNK_LEN=100, poolSpan=1000
  //   chunk at z=0  → 0 > -350+100=-250  → true  → moved to z=0-1000=-1000  ✓
  //   chunk at z=-400 → -400 > -250       → false → stays put                ✓
  _recycleChunks() {
    const playerZ  = this.carPos.z;
    const poolSpan = CHUNK_COUNT * CHUNK_LEN;
    this._roadChunks.forEach(chunk => {
      // Chunk's world Z start position
      const worldZ = chunk.position.z;
      // If this chunk's start is more than one chunk-length behind the player, recycle forward
      if (worldZ > playerZ + CHUNK_LEN) {
        chunk.position.z -= poolSpan;
      }
    });
  }

  // ── Arrival ────────────────────────────────────────────────
  _arrive() {
    if (this._done) return;
    this._done = true;
    this.carSpeed = 0;
    this.engine.audio.play('engineStop');
    this.engine.audio.play('cash');
    setTimeout(() => {
      this.engine.hud.showOverlay(`
        <div style="font-size:48px">🌳🚗✨</div>
        <div style="font-size:26px;font-weight:900;
          background:linear-gradient(135deg,#ffd700,#88ff88);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent">
          Arrived at the Park!</div>
        <div style="font-size:15px;color:#ddd;text-align:center;max-width:320px">
          Avicula pulls in perfectly.<br>
          <span style="color:#aaffaa">Purpura: "I can smell the fresh air already!" 💜</span>
        </div>
      `, 'Find a spot! 🌟', () => this.engine.nextLevel('driving'));
    }, 600);
  }

  onInteract() {} // driving uses held keys only
}