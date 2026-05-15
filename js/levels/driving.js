// ============================================================
//  STARRY PICNIC — levels/driving.js
//  First-person car drive to the park
//  A/D steer · W/S throttle/brake · avoid traffic · reach park
// ============================================================

import { drivingBackground } from '../backgrounds.js';
import * as THREE from 'three';
import { Level, Anime, Build } from '../engine.js';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const ROAD_W        = 14;
const LANE_W        = 3.5;
const LANES         = 4;
const LANE_CX       = [-5.25, -1.75, 1.75, 5.25];
const PLAYER_LANES  = [2, 3];
const ONCOMING_LANES= [0, 1];

const ROAD_LEN      = 800;
const CHUNK_LEN     = 100;
const CHUNK_COUNT   = 10;

const MAX_SPEED     = 22;
const MAX_REVERSE   = 5;
const ACCEL         = 9;
const BRAKE_FORCE   = 16;
const COAST_DRAG    = 3.5;
const REVERSE_ACCEL = 5;

const STEER_MAX_DEG    = 58;
const STEER_SPEED_NORM = 16;
const STEER_INPUT_RATE = 4.2;
const STEER_RETURN     = 1.8;

const CAR_HALF_W    = 0.85;
const EYE_HEIGHT    = 1.62;   // ← raised from 1.28 so camera sits above dash

const TRAFFIC_COUNT = 14;
const NPC_SPEED_MIN = 8;
const NPC_SPEED_MAX = 15;
const NPC_ONCOMING_SPEED_MIN = 10;
const NPC_ONCOMING_SPEED_MAX = 18;

const NPC_COLORS    = [0xff6688, 0x66aaff, 0xffcc44, 0x88ffcc, 0xff8844, 0xcc66ff, 0xffffff, 0x44ddaa];
const TREE_COLORS = [0x2d7a3a, 0x1e6b2e, 0x3a8040, 0x245c30, 0x336b28, 0x1a5c25, 0x2e7535];
const BASE_FOV   = 72;
const MAX_FOV    = 82;

// ─────────────────────────────────────────────────────────────
export class Driving extends Level {
// ─────────────────────────────────────────────────────────────

  constructor(engine) {
    super(engine);

    this.carPos    = new THREE.Vector3(LANE_CX[2], 0, 0);
    this.carSpeed  = 0;
    this.carSteer  = 0;
    this.carYaw    = 0;
    this.travelled = 0;
    this._done     = false;
    this._crashed  = false;
    this._crashTimer  = 0;
    this._hornTimer   = 0;
    this._shakeAmt    = 0;
    this._suspBob     = 0;
    this._suspBobT    = 0;

    this._carGroup    = null;
    this._steerWheel  = null;
    this._roadChunks  = [];
    this._traffic     = [];
    this._speedoCtx   = null;
    this._speedoTex   = null;
    this._tachoCtx    = null;
    this._tachoTex    = null;
    this._fuelTempCtx = null;
    this._fuelTempTex = null;
    this._rpmDots     = [];
    this._driveHUD    = null;
    this._domSpeedFill= null;
    this._domSpeedNum = null;
    this._domDistNum  = null;
    this._domDistFill = null;
    this._domCrash    = null;
    this._domGear     = null;
    this._fuelLevel   = 0.92;
    this._tempLevel   = 0.38;
  }

  // ══════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════
  init() {
    const s = this.scene;
    s.fog = new THREE.FogExp2(0xffc87a, 0.0011);
    const r = this.engine.renderer?.renderer || this.engine.renderer;
    if (r && r.setClearColor) r.setClearColor(0xf5a855, 1);
    this._sky = drivingBackground(this.scene);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, ROAD_LEN + 400),
      Anime.mat(0x8fba60)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, -(ROAD_LEN / 2));
    ground.receiveShadow = true;
    s.add(ground);

    for (let i = 0; i < CHUNK_COUNT; i++) this._spawnChunk(i);
    for (let i = 0; i < TRAFFIC_COUNT; i++) this._spawnTraffic(i);
    this._buildScenery(s);
    this._buildInterior(s);
    this._buildHUD();
  }

  // ── Road chunk ─────────────────────────────────────────────
  _spawnChunk(idx) {
    const s  = this.scene;
    const gz = -(idx * CHUNK_LEN);
    const g  = new THREE.Group();
    g.position.set(0, 0, gz);
    s.add(g);

    const halfLen = CHUNK_LEN / 2;

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W, CHUNK_LEN),
      Anime.mat(0x3a3a48)
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.005, -halfLen);
    g.add(road);

    [-0.12, 0.12].forEach(ox => {
      const div = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, CHUNK_LEN),
        new THREE.MeshBasicMaterial({ color: 0xffdd00 })
      );
      div.rotation.x = -Math.PI / 2;
      div.position.set(ox, 0.013, -halfLen);
      g.add(div);
    });

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

    [-ROAD_W / 2, ROAD_W / 2].forEach(ex => {
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, CHUNK_LEN),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(ex, 0.012, -halfLen);
      g.add(edge);
    });

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
      g.rotation.y = 0;
      const startZ = -(30 + slot * (ROAD_LEN / TRAFFIC_COUNT));
      g.position.set(LANE_CX[laneIdx], 0, startZ);
      const spd = NPC_ONCOMING_SPEED_MIN + Math.random() * (NPC_ONCOMING_SPEED_MAX - NPC_ONCOMING_SPEED_MIN);
      this._traffic.push({ g, laneIdx, speed: spd, isOncoming: true, slot });
    } else {
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

    [
      { z: -60,  text: '✧ Drive carefully ✧' },
      { z: -200, text: '✧ Park: 600 m ✧' },
      { z: -400, text: '✧ Park: 400 m ✧' },
      { z: -600, text: '✧ Park: 200 m ✧' },
      { z: -750, text: '✧ Almost there ✧' },
    ].forEach(({ z, text }) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8),
        Anime.mat(0x888899)
      );
      post.position.set(ROAD_W / 2 + 1.6, 1.6, z);
      s.add(post);
    Build.label(s, text, ROAD_W / 2 + 2.2, 4.2, z, '#fff', 'rgba(60,20,100,0.88)');
    });

    // Roadside flower patches
   const roadFlowerColors = [
  0xff66aa, 0xffdd33, 0xff5533, 0xcc44ff, 0xff88cc, 0xffbb22, 0xff4477,
  0xff3366, 0xee44bb, 0xffaa00, 0xff6600, 0xdd2255, 0xff99bb, 0xffcc44,
  0xee55ff, 0xff7722, 0xffd700, 0xff44aa, 0xcc3388, 0xff8800
];

const FLOWER_COUNT = 10000;
const dummy = new THREE.Object3D();

const iStem = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.018, 0.018, 0.28, 5),
  Anime.mat(0x44aa33),
  FLOWER_COUNT
);
iStem.castShadow = false;
iStem.receiveShadow = false;
s.add(iStem);

const iHead = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.10, 5, 4),
  new THREE.MeshBasicMaterial({ vertexColors: false }),
  FLOWER_COUNT
);
iHead.castShadow = false;
s.add(iHead);

const iCentre = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.042, 4, 3),
  Anime.mat(0xffee44),
  FLOWER_COUNT
);
iCentre.castShadow = false;
s.add(iCentre);

const _col = new THREE.Color();

for (let i = 0; i < FLOWER_COUNT; i++) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const fx   = side * (ROAD_W / 2 + 0.5 + Math.random() * 9);
  const fz   = -(Math.random() * ROAD_LEN);

  dummy.position.set(fx, 0.14, fz);
  dummy.scale.set(1, 1, 1);
  dummy.rotation.set(0, 0, 0);
  dummy.updateMatrix();
  iStem.setMatrixAt(i, dummy.matrix);

  dummy.position.set(fx, 0.32, fz);
  dummy.updateMatrix();
  iHead.setMatrixAt(i, dummy.matrix);
  _col.set(roadFlowerColors[Math.floor(Math.random() * roadFlowerColors.length)]);
  iHead.setColorAt(i, _col);

  dummy.position.set(fx, 0.38, fz);
  dummy.updateMatrix();
  iCentre.setMatrixAt(i, dummy.matrix);
}

iStem.instanceMatrix.needsUpdate   = true;
iHead.instanceMatrix.needsUpdate   = true;
iHead.instanceColor.needsUpdate    = true;
iCentre.instanceMatrix.needsUpdate = true;


    this._buildFinishLine(s);

  }

 _makeTree(x, z, color) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  // Trunk — tapered, slightly randomised
  const trunkH = 1.2 + Math.random() * 0.6;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.22, trunkH, 9),
    Anime.mat(0x6a3818)
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  Anime.outline(trunk, 0.04);

  // Layered foliage spheres instead of cones — much rounder/lush
  const baseY   = trunkH;
  const layers  = 4 + Math.floor(Math.random() * 2);
 const lighterColor = new THREE.Color(color).offsetHSL(0, 0.05, 0.03).getHex();
  const darkerColor  = new THREE.Color(color).offsetHSL(0, 0.08, -0.08).getHex();

  for (let i = 0; i < layers; i++) {
    const t   = i / (layers - 1);
    const r   = (1.4 - t * 0.7) * (0.85 + Math.random() * 0.3);
    const yOff = baseY + i * 0.55 + Math.random() * 0.2;
    const xOff = (Math.random() - 0.5) * 0.25;
    const zOff = (Math.random() - 0.5) * 0.25;
    const col  = i % 2 === 0 ? darkerColor : lighterColor;

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(r, 9, 7),
      Anime.mat(col)
    );
    ball.position.set(xOff, yOff, zOff);
    g.add(ball);
    Anime.outline(ball, 0.04);
  }

  // Small flower clusters at base
  const flowerColors = [0xff88aa, 0xffdd44, 0xff6644, 0xcc88ff, 0xff4488];
  const flowerCount  = 3 + Math.floor(Math.random() * 4);
  for (let f = 0; f < flowerCount; f++) {
    const a  = (f / flowerCount) * Math.PI * 2 + Math.random() * 0.5;
    const r2 = 0.4 + Math.random() * 0.5;
    const fc = flowerColors[Math.floor(Math.random() * flowerColors.length)];

    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.28, 5),
      Anime.mat(0x44aa33)
    );
    stem.position.set(Math.cos(a) * r2, 0.14, Math.sin(a) * r2);
    g.add(stem);

    // Flower head — flat disc + petals
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 7, 5),
      Anime.mat(fc)
    );
    head.position.set(Math.cos(a) * r2, 0.30, Math.sin(a) * r2);
    g.add(head);

    // Centre dot
    const centre = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 5, 4),
      Anime.mat(0xffee44)
    );
    centre.position.copy(head.position);
    centre.position.y += 0.06;
    g.add(centre);
  }

  return g;
}

  _buildFinishLine(s) {
    const fz = -(ROAD_LEN - 8);
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 64;
    const bx = bc.getContext('2d');
    for (let cx2 = 0; cx2 < 16; cx2++) for (let ry = 0; ry < 4; ry++) {
      bx.fillStyle = (cx2 + ry) % 2 === 0 ? '#000' : '#fff';
      bx.fillRect(cx2 * 16, ry * 16, 16, 16);
    }
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W + 2, 1.0),
      new THREE.MeshBasicMaterial({ map: (() => { const _t = new THREE.CanvasTexture(bc); _t.channel = 0; return _t; })(), side: THREE.DoubleSide })
    );
    banner.position.set(0, 5.5, fz); s.add(banner);
    [-ROAD_W / 2 - 0.6, ROAD_W / 2 + 0.6].forEach(px => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 6.2, 8), Anime.mat(0xff4488));
      pole.position.set(px, 3.1, fz); s.add(pole); Anime.outline(pole, 0.04);
    });
    Build.label(s, '🌳 Picnic Park! 🎉', 0, 7.2, fz, '#ffd700', 'rgba(60,0,120,0.92)');
  }

  // ══════════════════════════════════════════════════════════
  //  INTERIOR  (all geometry pushed down/back so road is visible)
  // ══════════════════════════════════════════════════════════
  _buildInterior(s) {
    const g = new THREE.Group();
    s.add(g);
    this._carGroup = g;

    // Interior fill light
    const cabinLight = new THREE.PointLight(0xffe4b0, 1.4, 2.0);
    cabinLight.position.set(0, 0.2, -0.6);
    g.add(cabinLight);

    // Dashboard main slab — pushed lower and further back
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.44, 0.52),
      new THREE.MeshLambertMaterial({ color: 0x1a0c04 })
    );
    dash.position.set(0, -0.72, -0.88);   // was (0, -0.38, -0.55)
    g.add(dash);

    // Padded top rail
    const dashTop = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.09, 0.46),
      new THREE.MeshLambertMaterial({ color: 0x2a1608 })
    );
    dashTop.position.set(0, -0.51, -0.86);  // was (0, -0.17, -0.53)
    g.add(dashTop);

    // Wood-grain inlay strip
    const woodStrip = new THREE.Mesh(
      new THREE.BoxGeometry(3.18, 0.05, 0.10),
      new THREE.MeshLambertMaterial({ color: 0x7a4822 })
    );
    woodStrip.position.set(0, -0.47, -0.86);  // was (0, -0.13, -0.53)
    g.add(woodStrip);
    Anime.outline(woodStrip, 0.010);

    // Brass trim
    const brassTrim = new THREE.Mesh(
      new THREE.BoxGeometry(3.18, 0.016, 0.09),
      new THREE.MeshLambertMaterial({ color: 0xc8922a })
    );
    brassTrim.position.set(0, -0.445, -0.86);  // was (0, -0.105, -0.53)
    g.add(brassTrim);

    // Instrument binnacle
    const binnacle = new THREE.Mesh(
      new THREE.BoxGeometry(1.60, 0.24, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x100802 })
    );
    binnacle.position.set(0, -0.46, -0.90);   // was (0, -0.12, -0.58)
    g.add(binnacle);
    Anime.outline(binnacle, 0.012);

    // Binnacle visor shade
    const binHood = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.045, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x0a0502 })
    );
    binHood.position.set(0, -0.34, -0.84);   // was (0, -0.005, -0.545)
    g.add(binHood);

    // Gauge glow light
    const gaugeGlow = new THREE.PointLight(0x88ffaa, 0.4, 0.45);
    gaugeGlow.position.set(0, -0.60, -0.90);
    g.add(gaugeGlow);

    // Steering wheel rim — lower and further back
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.034, 12, 36),
      new THREE.MeshLambertMaterial({ color: 0x3a1e08 })
    );
    rim.position.set(0, -0.60, -0.80);   // was (0, -0.28, -0.52)
    rim.rotation.x = Math.PI / 5.2;
    g.add(rim);
    Anime.outline(rim, 0.024);
    this._steerWheel = rim;

    // Brass accent ring on rim
    const rimAccent = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.008, 7, 36),
      new THREE.MeshLambertMaterial({ color: 0xb87820 })
    );
    rimAccent.position.copy(rim.position);
    rimAccent.rotation.copy(rim.rotation);
    g.add(rimAccent);

    // 3 spokes
    [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach(a => {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.22, 0.020),
        new THREE.MeshLambertMaterial({ color: 0x1e0e04 })
      );
      spoke.position.set(
        Math.sin(a) * 0.110,
        -0.60 + Math.cos(a) * 0.110,
        -0.80
      );
      spoke.rotation.z = a;
      spoke.rotation.x = Math.PI / 5.2;
      g.add(spoke);
    });

    // Centre boss
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.028, 14),
      new THREE.MeshLambertMaterial({ color: 0xb87820 })
    );
    boss.position.set(0, -0.60, -0.80);
    boss.rotation.x = Math.PI / 2 + Math.PI / 5.2;
    g.add(boss);
    Anime.outline(boss, 0.010);

    // Steering column
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.34, 10),
      new THREE.MeshLambertMaterial({ color: 0x1a0a02 })
    );
    col.position.set(0, -0.84, -0.84);
    col.rotation.x = -Math.PI / 5.2;
    g.add(col);

    // A-pillars — slimmer and pushed to the very edges
    [-1.52, 1.52].forEach(px => {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.30, 0.08),
        new THREE.MeshLambertMaterial({ color: 0x180a02 })
      );
      pillar.position.set(px, -0.62, -1.10);   // was (±1.35, -0.14, -0.68)
      pillar.rotation.z = px > 0 ? -0.10 : 0.10;
      g.add(pillar);
    });

    // Roof panel — add after the windscreen top bar block
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.10, 0.06, 1.20),
    new THREE.MeshLambertMaterial({ color: 0x0e0602 })
    );
    roof.position.set(0, 0.46, -0.50);
    g.add(roof);
    Anime.outline(roof, 0.015);

// Roof lining (lighter interior fabric)
    const roofLining = new THREE.Mesh(
    new THREE.BoxGeometry(3.00, 0.03, 1.10),
    new THREE.MeshLambertMaterial({ color: 0x2a1a0a })
  );
  roofLining.position.set(0, 0.42, -0.50);
  g.add(roofLining);

  
    
    // Side windows — moved to match new pillar positions
    [-1.52, 1.52].forEach(px => {
      const win = new THREE.Mesh(
     new THREE.PlaneGeometry(1.40, 0.90),
      new THREE.MeshBasicMaterial({
      color: 0x9ac8e8, transparent: true, opacity: 0.10, side: THREE.DoubleSide
     })
);
win.position.set(px, -0.10, -0.70);
win.rotation.y = px > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(win);
    });

    // Car hood — pushed much lower so it barely peeks in at bottom
    const carHood = new THREE.Mesh(
      new THREE.BoxGeometry(2.00, 0.055, 1.20),
      new THREE.MeshLambertMaterial({ color: 0xc45a6a })
    );
    carHood.position.set(0, -1.20, -1.60);   // was (0, -0.72, -1.30)
    g.add(carHood);
    Anime.outline(carHood, 0.020);

    // Hood centre crease
    const crease = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.012, 1.20),
      new THREE.MeshLambertMaterial({ color: 0xdd4466 })
    );
    crease.position.set(0, -1.088, -1.60);
    g.add(crease);

    // Centre console
    const console_ = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.26, 0.13),
      new THREE.MeshLambertMaterial({ color: 0x140a02 })
    );
    console_.position.set(0, -0.92, -0.76);   // was (0, -0.66, -0.46)
    g.add(console_);
    Anime.outline(console_, 0.010);

    // Radio display slit
    const radioBg = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.028, 0.010),
      new THREE.MeshBasicMaterial({ color: 0x003322 })
    );
    radioBg.position.set(0, -0.82, -0.72);
    g.add(radioBg);

    // Tune knobs
    [-0.062, 0.062].forEach(ox => {
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.017, 10),
        new THREE.MeshLambertMaterial({ color: 0xb07018 })
      );
      knob.position.set(ox, -0.79, -0.72);
      knob.rotation.x = Math.PI / 2;
      g.add(knob);
      Anime.outline(knob, 0.007);
    });

    // Glovebox
    const glove = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.16, 0.038),
      new THREE.MeshLambertMaterial({ color: 0x1a0c04 })
    );
    glove.position.set(0.70, -0.86, -0.72);
    g.add(glove);
    Anime.outline(glove, 0.010);

    const latch = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0xc8922a })
    );
    latch.position.set(0.44, -0.86, -0.705);
    g.add(latch);

    // Instrument cluster
    this._buildSpeedoCluster(g);
  }

  // ══════════════════════════════════════════════════════════
  //  SPEEDO CLUSTER
  // ══════════════════════════════════════════════════════════
  _buildSpeedoCluster(g) {
    const makeCanvas = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const tex = new THREE.CanvasTexture(c);
      return { c, ctx: c.getContext('2d'), tex };
    };

    // Speedometer — centre, largest
    const sp = makeCanvas(256, 256);
    this._speedoCanvas = sp.c;
    this._speedoCtx    = sp.ctx;
    this._speedoTex    = sp.tex;

    const speedoDial = new THREE.Mesh(
      new THREE.CircleGeometry(0.130, 40),
      new THREE.MeshBasicMaterial({ map: sp.tex })
    );
    speedoDial.position.set(0, -0.42, -0.705);   // was (0, -0.09, -0.475)
    speedoDial.rotation.x = -0.28;
    g.add(speedoDial);

    // Tachometer — left
    const tc = makeCanvas(200, 200);
    this._tachoCanvas = tc.c;
    this._tachoCtx    = tc.ctx;
    this._tachoTex    = tc.tex;

    const tachoDial = new THREE.Mesh(
      new THREE.CircleGeometry(0.100, 36),
      new THREE.MeshBasicMaterial({ map: tc.tex })
    );
    tachoDial.position.set(-0.310, -0.43, -0.702);   // was (-0.345, -0.1, -0.472)
    tachoDial.rotation.x = -0.28;
    g.add(tachoDial);

    // Fuel + Temp — right
    const ft = makeCanvas(200, 200);
    this._fuelTempCanvas = ft.c;
    this._fuelTempCtx    = ft.ctx;
    this._fuelTempTex    = ft.tex;

    const ftDial = new THREE.Mesh(
      new THREE.CircleGeometry(0.100, 36),
      new THREE.MeshBasicMaterial({ map: ft.tex })
    );
    ftDial.position.set(0.310, -0.43, -0.702);   // was (0.345, -0.1, -0.472)
    ftDial.rotation.x = -0.28;
    g.add(ftDial);

    // RPM dot bar
    this._rpmDots = [];
    for (let i = 0; i < 10; i++) {
      const dot = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.010, 0.010),
        new THREE.MeshBasicMaterial({ color: 0x1a0a02 })
      );
      dot.position.set(-0.117 + i * 0.026, -0.335, -0.808);
      g.add(dot);
      this._rpmDots.push(dot);
    }

    // Initial renders
    this._drawSpeedo(0);
    this._drawTacho(0);
    this._drawFuelTemp(0.92, 0.38);
  }

  // ── Shared gauge painting utilities ──────────────────────
  _ghibliGaugeBg(ctx, cx, cy, r, labelText) {
    const bezel = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy - 4, r + 2);
    bezel.addColorStop(0, '#2a1808');
    bezel.addColorStop(0.6, '#1a0e04');
    bezel.addColorStop(1, '#3a2010');
    ctx.fillStyle = bezel;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#c8922a';
    ctx.lineWidth   = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1.5, Math.PI * 0.6, Math.PI * 2.2);
    ctx.stroke();
    ctx.strokeStyle = '#6a3e18';
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1.5, Math.PI * 2.2, Math.PI * 0.6);
    ctx.stroke();

    const face = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, 0, cx, cy, r);
    face.addColorStop(0, '#f0e2c0');
    face.addColorStop(0.6, '#e8d4a4');
    face.addColorStop(1, '#d4b87a');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(160,110,50,${0.04 + i * 0.02})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (0.92 - i * 0.18), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (labelText) {
      ctx.font         = 'bold 10px serif';
      ctx.fillStyle    = '#7a4822';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, cx, cy + r * 0.60);
    }
  }

  _ghibliTickmarks(ctx, cx, cy, r, count, minAngle, maxAngle, majEvery) {
    const tickR  = r * 0.88;
    const majLen = r * 0.14;
    const minLen = r * 0.07;
    for (let i = 0; i <= count; i++) {
      const t   = i / count;
      const ang = minAngle + t * (maxAngle - minAngle);
      const isMaj = i % majEvery === 0;
      const len = isMaj ? majLen : minLen;
      ctx.strokeStyle = isMaj ? '#5a3010' : '#9a6830';
      ctx.lineWidth   = isMaj ? 1.8 : 0.9;
      ctx.beginPath();
      ctx.moveTo(
        cx + Math.cos(ang) * (tickR - len),
        cy + Math.sin(ang) * (tickR - len)
      );
      ctx.lineTo(
        cx + Math.cos(ang) * tickR,
        cy + Math.sin(ang) * tickR
      );
      ctx.stroke();
    }
  }

  _ghibliNeedle(ctx, cx, cy, angle, length, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    ctx.save();
    ctx.translate(1.5, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(length, 0);
    ctx.lineTo(0, -4);
    ctx.lineTo(-length * 0.14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 2.8);
    ctx.lineTo(length, 0);
    ctx.lineTo(0, -2.8);
    ctx.lineTo(-length * 0.14, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth   = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -1.2);
    ctx.lineTo(length * 0.82, 0);
    ctx.stroke();

    ctx.restore();

    ctx.fillStyle = '#2a1408';
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8922a';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.fillStyle   = '#c8922a';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  _ghibliNeedleHalf(ctx, cx, cy, angle, length, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 1.8);
    ctx.lineTo(length, 0);
    ctx.lineTo(0, -1.8);
    ctx.lineTo(-length * 0.12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle   = '#3a1808';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c8922a';
    ctx.lineWidth   = 0.8;
    ctx.stroke();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  // ── Speedometer ───────────────────────────────────────────
  _drawSpeedo(speed) {
    const ctx = this._speedoCtx;
    if (!ctx) return;
    const W = 200, H = 200, cx = 100, cy = 108, r = 88;

    ctx.clearRect(0, 0, W, H);
    this._ghibliGaugeBg(ctx, cx, cy, r, 'km/h');

    const arcStart = Math.PI * 0.72;
    const arcEnd   = Math.PI * 2.28;
    const arcSpan  = arcEnd - arcStart;

    const drawArc = (from, to, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth   = 5;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.75, arcStart + from * arcSpan, arcStart + to * arcSpan);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    drawArc(0, 0.55, '#44aa66');
    drawArc(0.55, 0.80, '#ddaa22');
    drawArc(0.80, 1.00, '#cc3311');

    this._ghibliTickmarks(ctx, cx, cy, r, 32, arcStart, arcEnd, 4);

    ctx.font         = '9px serif';
    ctx.fillStyle    = '#5a3010';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    [0, 20, 40, 60, 80].forEach(v => {
      const t   = v / 160;
      const ang = arcStart + t * arcSpan;
      const lr  = r * 0.70;
      ctx.fillText(v, cx + Math.cos(ang) * lr, cy + Math.sin(ang) * lr);
    });

    const kmh = Math.abs(speed) * 3.6;
    const pct = Math.min(kmh / 160, 1);

    const glowCol = pct > 0.80 ? 'rgba(200,50,10,0.12)' : pct > 0.55 ? 'rgba(200,160,10,0.10)' : 'rgba(40,160,80,0.10)';
    ctx.fillStyle = glowCol;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r * 0.82, arcStart, arcStart + pct * arcSpan);
    ctx.closePath();
    ctx.fill();

    const needleAngle = arcStart + pct * arcSpan;
    const needleColor = pct > 0.80 ? '#e83c1a' : '#3a1808';
    this._ghibliNeedle(ctx, cx, cy, needleAngle, r * 0.73, needleColor);

    ctx.fillStyle = '#0e0804';
    this._roundRect(ctx, cx - 26, cy + 46, 52, 20, 4);
    ctx.fillStyle    = '#c8e898';
    ctx.font         = 'bold 12px monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(kmh).toString().padStart(3, ' '), cx, cy + 56);

    if (this._speedoTex) this._speedoTex.needsUpdate = true;
  }

  // ── Tachometer ────────────────────────────────────────────
  _drawTacho(speed) {
    const ctx = this._tachoCtx;
    if (!ctx) return;
    const W = 160, H = 160, cx = 80, cy = 86, r = 68;

    ctx.clearRect(0, 0, W, H);
    this._ghibliGaugeBg(ctx, cx, cy, r, 'RPM ×1000');

    const arcStart = Math.PI * 0.75;
    const arcEnd   = Math.PI * 2.25;
    const arcSpan  = arcEnd - arcStart;

    ctx.strokeStyle = 'rgba(180,30,10,0.4)';
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.76, arcStart + arcSpan * 0.75, arcEnd);
    ctx.stroke();

    this._ghibliTickmarks(ctx, cx, cy, r, 28, arcStart, arcEnd, 4);

    ctx.font         = '8px serif';
    ctx.fillStyle    = '#5a3010';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    [0, 1, 2, 3, 4, 5, 6, 7].forEach(v => {
      const t   = v / 7;
      const ang = arcStart + t * arcSpan;
      const lr  = r * 0.68;
      ctx.fillText(v, cx + Math.cos(ang) * lr, cy + Math.sin(ang) * lr);
    });

    const rpm = Math.abs(speed) / MAX_SPEED * 6500;
    const pct = Math.min(rpm / 7000, 1);

    const needleColor = pct > 0.75 ? '#cc2200' : '#3a1808';
    this._ghibliNeedle(ctx, cx, cy, arcStart + pct * arcSpan, r * 0.72, needleColor);

    if (this._tachoTex) this._tachoTex.needsUpdate = true;
  }

  // ── Fuel + Temperature gauge ──────────────────────────────
  _drawFuelTemp(fuelPct, tempPct) {
    const ctx = this._fuelTempCtx;
    if (!ctx) return;
    const W = 160, H = 160, cx = 80, cy = 80, r = 68;

    ctx.clearRect(0, 0, W, H);
    this._ghibliGaugeBg(ctx, cx, cy, r, null);

    ctx.strokeStyle = 'rgba(90,48,16,0.35)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy);
    ctx.lineTo(cx + r * 0.5, cy);
    ctx.stroke();

    const fuelStart = Math.PI * 1.10;
    const fuelEnd   = Math.PI * 1.90;
    const fuelSpan  = fuelEnd - fuelStart;

    for (let i = 0; i <= 8; i++) {
      const t   = i / 8;
      const ang = fuelStart + t * fuelSpan;
      const isMaj = i % 4 === 0;
      const len = isMaj ? r * 0.13 : r * 0.07;
      ctx.strokeStyle = '#9a6830';
      ctx.lineWidth   = isMaj ? 1.4 : 0.7;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * (r * 0.86 - len), cy + Math.sin(ang) * (r * 0.86 - len));
      ctx.lineTo(cx + Math.cos(ang) * r * 0.86, cy + Math.sin(ang) * r * 0.86);
      ctx.stroke();
    }

    ctx.font         = 'bold 9px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#cc3311';
    ctx.fillText('E', cx + Math.cos(fuelStart) * r * 0.68, cy + Math.sin(fuelStart) * r * 0.68);
    ctx.fillStyle    = '#228833';
    ctx.fillText('F', cx + Math.cos(fuelEnd) * r * 0.68, cy + Math.sin(fuelEnd) * r * 0.68);
    ctx.fillStyle    = '#7a4822';
    ctx.font         = '7px serif';
    ctx.fillText('FUEL', cx, cy - r * 0.30);

    if (fuelPct < 0.20) {
      ctx.fillStyle = 'rgba(200,40,10,0.22)';
      ctx.beginPath();
      ctx.arc(cx, cy - 8, r * 0.55, fuelStart, fuelStart + fuelSpan * 0.20);
      ctx.lineTo(cx, cy - 8);
      ctx.closePath();
      ctx.fill();
    }

    const fuelNeedle = fuelPct < 0.20 ? '#cc2200' : '#3a1808';
    this._ghibliNeedleHalf(ctx, cx, cy - 8, fuelStart + fuelPct * fuelSpan, r * 0.55, fuelNeedle);

    const tempStart = Math.PI * 0.10;
    const tempEnd   = Math.PI * 0.90;
    const tempSpan  = tempEnd - tempStart;

    for (let i = 0; i <= 8; i++) {
      const t   = i / 8;
      const ang = tempStart + t * tempSpan;
      const isMaj = i % 4 === 0;
      const len = isMaj ? r * 0.13 : r * 0.07;
      ctx.strokeStyle = '#9a6830';
      ctx.lineWidth   = isMaj ? 1.4 : 0.7;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * (r * 0.86 - len), cy + Math.sin(ang) * (r * 0.86 - len));
      ctx.lineTo(cx + Math.cos(ang) * r * 0.86, cy + Math.sin(ang) * r * 0.86);
      ctx.stroke();
    }

    ctx.font      = 'bold 9px serif';
    ctx.fillStyle = '#5588cc';
    ctx.fillText('C', cx + Math.cos(tempStart) * r * 0.68, cy + Math.sin(tempStart) * r * 0.68);
    ctx.fillStyle = '#cc4422';
    ctx.fillText('H', cx + Math.cos(tempEnd) * r * 0.68, cy + Math.sin(tempEnd) * r * 0.68);
    ctx.fillStyle = '#7a4822';
    ctx.font      = '7px serif';
    ctx.fillText('TEMP', cx, cy + r * 0.30);

    if (tempPct > 0.85) {
      ctx.fillStyle = 'rgba(200,40,10,0.22)';
      ctx.beginPath();
      ctx.arc(cx, cy + 8, r * 0.55, tempStart + tempSpan * 0.85, tempEnd);
      ctx.lineTo(cx, cy + 8);
      ctx.closePath();
      ctx.fill();
    }

    const tempNeedle = tempPct > 0.85 ? '#cc2200' : '#3a1808';
    this._ghibliNeedleHalf(ctx, cx, cy + 8, tempStart + tempPct * tempSpan, r * 0.55, tempNeedle);

    if (this._fuelTempTex) this._fuelTempTex.needsUpdate = true;
  }

  // ── DOM HUD ────────────────────────────────────────────────
  _buildHUD() {
    const el  = document.createElement('div');
    el.id     = 'driveHUD';
    el.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      display:none;gap:12px;align-items:flex-end;pointer-events:none;z-index:20;
      font-family:'Georgia',serif;
    `;
    el.innerHTML = `
      <style>
        .gh-panel {
          background: rgba(20,10,2,0.82);
          backdrop-filter: blur(14px);
          border-radius: 14px;
          border: 1px solid rgba(200,146,42,0.30);
          box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(200,146,42,0.12);
          padding: 10px 16px;
          font-family: Georgia, serif;
        }
        .gh-label {
          font-size: 9px;
          color: #9a7845;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .gh-value {
          font-size: 22px;
          font-weight: 700;
          color: #e8c87a;
          line-height: 1;
        }
        .gh-unit { font-size: 9px; color: #7a5822; letter-spacing: 0.08em; }
        .gh-progress {
          height: 4px;
          background: rgba(255,255,255,0.07);
          border-radius: 99px;
          overflow: hidden;
          margin-top: 6px;
        }
        .gh-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #4fd4c0, #e8c45a, #ff6a1a);
          width: 0%;
          transition: width 0.25s;
        }
        #drvCrash {
          display: none;
          background: rgba(180,30,10,0.88);
          border-radius: 12px;
          padding: 8px 16px;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          border: 1px solid rgba(255,100,60,0.5);
          letter-spacing: 0.06em;
        }
      </style>

      <div class="gh-panel" style="min-width:120px">
        <div class="gh-label">Speed</div>
        <div class="gh-value" id="drvSpeedNum">0</div>
        <div class="gh-unit">km / h</div>
        <div class="gh-progress">
          <div class="gh-fill" id="drvSpeedFill"></div>
        </div>
      </div>

      <div class="gh-panel" style="min-width:120px">
        <div class="gh-label">To Park</div>
        <div class="gh-value" id="drvDistNum" style="font-size:18px">800 m</div>
        <div class="gh-progress">
          <div class="gh-fill" id="drvDistFill"></div>
        </div>
      </div>

      <div class="gh-panel" style="min-width:60px;text-align:center">
        <div class="gh-label">Gear</div>
        <div class="gh-value" id="drvGear">N</div>
      </div>

      <div id="drvCrash">💥 Crash!</div>
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
    this.engine.audio.playLevelMusic('driving'); // cleanest — stops old, starts new

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
    this._fuelLevel  = 0.92;
    this._tempLevel  = 0.38;

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
          this.carSpeed = Math.min(0, this.carSpeed + BRAKE_FORCE * dt);
        } else {
          this.carSpeed = Math.min(MAX_SPEED, this.carSpeed + ACCEL * dt);
        }
      } else if (bwd) {
        if (this.carSpeed > 0) {
          this.carSpeed = Math.max(0, this.carSpeed - BRAKE_FORCE * dt);
        } else {
          this.carSpeed = Math.max(-MAX_REVERSE, this.carSpeed - REVERSE_ACCEL * dt);
        }
      } else {
        if (this.carSpeed > 0) this.carSpeed = Math.max(0, this.carSpeed - COAST_DRAG * dt);
        if (this.carSpeed < 0) this.carSpeed = Math.min(0, this.carSpeed + COAST_DRAG * dt);
      }

      // ── steering ──────────────────────────────────────
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
      const speedFactor   = Math.abs(this.carSpeed) / (Math.abs(this.carSpeed) + STEER_SPEED_NORM);
      const steerAngleRad = THREE.MathUtils.degToRad(STEER_MAX_DEG) * this.carSteer * speedFactor;
      const steerDir      = this.carSpeed >= 0 ? 1 : -1;
      this.carYaw        += steerDir * steerAngleRad * (Math.abs(this.carSpeed) / MAX_SPEED) * dt * 1.4;

      const fwdVec = new THREE.Vector3(Math.sin(this.carYaw), 0, -Math.cos(this.carYaw));
      this.carPos.addScaledVector(fwdVec, this.carSpeed * dt);

      if (this.carSpeed > 0) this.travelled += this.carSpeed * dt;
    }

    this.carPos.x = THREE.MathUtils.clamp(
      this.carPos.x, -(ROAD_W / 2 - CAR_HALF_W), ROAD_W / 2 - CAR_HALF_W
    );

    // ── horn ─────────────────────────────────────────────
    this._hornTimer -= dt;
    if (inp.is('KeyF') && this._hornTimer <= 0) {
      this.engine.audio.play('horn'); this._hornTimer = 0.6;
    }

this.engine.audio.sfx.engineRev(this.engine.audio, Math.abs(this.carSpeed) / MAX_SPEED);

    // ── traffic ───────────────────────────────────────────
    this._updateTraffic(dt);
    if (!this._crashed) this._checkCollisions();

    // ── chunk recycling ───────────────────────────────────
    this._recycleChunks();

    // ── camera then sync interior ─────────────────────────
    this._updateCamera(dt);
    this._carGroup.position.copy(this.camera.position);
    this._carGroup.rotation.order = this.camera.rotation.order;
    this._carGroup.rotation.copy(this.camera.rotation);

    // ── steering wheel ────────────────────────────────────
    if (this._steerWheel) this._steerWheel.rotation.z = -this.carSteer * 0.85;

    // ── dashboard update ──────────────────────────────────
    this._updateGhibliDash();

    // ── arrival ───────────────────────────────────────────
    if (this.travelled >= ROAD_LEN) this._arrive();
  }

  // ── Dashboard update ───────────────────────────────────────
  _updateGhibliDash() {
    const kmh       = Math.round(Math.abs(this.carSpeed) * 3.6);
    const remaining = Math.max(0, ROAD_LEN - this.travelled);
    const gear      = this.carSpeed > 0.5 ? 'D' : this.carSpeed < -0.5 ? 'R' : 'N';
    const spdPct    = Math.abs(this.carSpeed) / MAX_SPEED;

    this._drawSpeedo(this.carSpeed);
    this._drawTacho(this.carSpeed);

    this._fuelLevel = Math.max(0, this._fuelLevel - 0.000006 * Math.abs(this.carSpeed));
    this._tempLevel = THREE.MathUtils.lerp(this._tempLevel, 0.38 + spdPct * 0.28, 0.003);
    this._drawFuelTemp(this._fuelLevel, this._tempLevel);

    const lit = Math.round(spdPct * 10);
    this._rpmDots.forEach((dot, i) => {
      dot.material.color.set(i < lit
        ? (i > 7 ? 0xff2200 : i > 5 ? 0xffaa00 : 0x00ff44)
        : 0x1a0a02);
    });

    this._domSpeedNum.textContent  = kmh + ' km/h';
    this._domSpeedFill.style.width = (spdPct * 100) + '%';
    this._domDistNum.textContent   = Math.round(remaining) + ' m';
    this._domDistFill.style.width  = (this.travelled / ROAD_LEN * 100) + '%';
    this._domGear.textContent      = gear;
    this._domGear.style.color      = gear === 'R' ? '#ff8844' : gear === 'D' ? '#e8c87a' : '#9a7845';
  }

  // ── Camera update ──────────────────────────────────────────
  _updateCamera(dt) {
    this._suspBobT += dt * (3 + Math.abs(this.carSpeed) * 0.25);
    const bob = Math.sin(this._suspBobT) * 0.018 * (Math.abs(this.carSpeed) / MAX_SPEED);
    const sk  = this._shakeAmt;

    this.camera.position.set(
      this.carPos.x + (Math.random() - 0.5) * sk * 0.22,
      EYE_HEIGHT + bob + (Math.random() - 0.5) * sk * 0.10,
      this.carPos.z + (Math.random() - 0.5) * sk * 0.12
    );

    const roll     = -this.carSteer * 0.038;
    const pitchFwd = (this.carSpeed / MAX_SPEED) * 0.016;

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.carYaw;
    this.camera.rotation.x = -pitchFwd;
    this.camera.rotation.z = roll;

    const targetFOV = BASE_FOV + (Math.abs(this.carSpeed) / MAX_SPEED) * (MAX_FOV - BASE_FOV);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 4);
    this.camera.updateProjectionMatrix();
  }

  // ── Traffic update ─────────────────────────────────────────
  _updateTraffic(dt) {
    this._traffic.forEach(t => {
      if (t.isOncoming) {
        t.g.position.z += t.speed * dt;
        if (t.g.position.z > this.carPos.z + 40) {
          t.laneIdx = ONCOMING_LANES[Math.floor(Math.random() * ONCOMING_LANES.length)];
          t.g.position.x = LANE_CX[t.laneIdx];
          t.g.position.z = this.carPos.z - (100 + Math.random() * 150);
          t.speed = NPC_ONCOMING_SPEED_MIN + Math.random() * (NPC_ONCOMING_SPEED_MAX - NPC_ONCOMING_SPEED_MIN);
        }
      } else {
        t.g.position.z -= t.speed * dt;
        if (t.g.position.z > this.carPos.z + 60) {
          t.laneIdx = PLAYER_LANES[Math.floor(Math.random() * PLAYER_LANES.length)];
          t.g.position.x = LANE_CX[t.laneIdx];
          t.g.position.z = this.carPos.z - (80 + Math.random() * 120);
          t.speed = NPC_SPEED_MIN + Math.random() * (NPC_SPEED_MAX - NPC_SPEED_MIN);
        }
      }
      t.g.position.y = Math.sin(performance.now() / 500 + t.slot * 1.3) * 0.018;
    });
  }

  // ── Collision ──────────────────────────────────────────────
  _checkCollisions() {
    const playerBox = new THREE.Box3(
      new THREE.Vector3(this.carPos.x - CAR_HALF_W, 0,   this.carPos.z - 2.3),
      new THREE.Vector3(this.carPos.x + CAR_HALF_W, 1.6, this.carPos.z + 0.6)
    );
    const npcBox = new THREE.Box3();
    for (const t of this._traffic) {
      npcBox.setFromObject(t.g);
      if (playerBox.intersectsBox(npcBox)) { this._triggerCrash(); break; }
    }
  }

  _triggerCrash() {
    this._crashed    = true;
    this._crashTimer = 1.8;
    this._shakeAmt   = 1.2;
    this.carSpeed    = 0;
    this._domCrash.style.display = 'block';
    this.engine.audio.play('deny');
    this.engine.audio.play('whoosh');
  }

  // ── Road recycling ─────────────────────────────────────────
  _recycleChunks() {
    const playerZ  = this.carPos.z;
    const poolSpan = CHUNK_COUNT * CHUNK_LEN;
    this._roadChunks.forEach(chunk => {
      if (chunk.position.z > playerZ + CHUNK_LEN) {
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

  onInteract() {}
}