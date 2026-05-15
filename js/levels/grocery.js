// ============================================================
//  STARRY PICNIC — Grocery Level  (Ghibli Edition)
//  Studio Ghibli aesthetic: warm lantern light, hand-painted
//  textures, soft moss-green walls, cosy village market feel.
//  Fixes: billboard price tags, duplicate onExit removed,
//  priceTagFixed signature updated, both stand calls fixed.
// ============================================================
import { groceryBackground } from '../backgrounds.js';
import * as THREE from 'three';
import { Level, Anime, Build, FPController, Interactor } from '../engine.js';

// ── Shopping list ─────────────────────────────────────────────
const LIST = [
  { id:'chicken',  label:'🍗 Chicken',  price:2.50, color:0xffcc88, geo:()=>new THREE.BoxGeometry(0.26,0.16,0.16) },
  { id:'bread',    label:'🍞 Bread',    price:1.50, color:0xd4933a, geo:()=>new THREE.BoxGeometry(0.16,0.24,0.20) },
  { id:'sauce',    label:'🍅 Sauce',    price:1.00, color:0xcc2222, geo:()=>new THREE.CylinderGeometry(0.06,0.07,0.26,14) },
  { id:'cucumber', label:'🥒 Cucumber', price:0.50, color:0x33aa44, geo:()=>new THREE.CylinderGeometry(0.05,0.05,0.26,10) },
  { id:'tomato',   label:'🍅 Tomato',   price:0.20, color:0xee2222, geo:()=>new THREE.SphereGeometry(0.09,12,10) },
  { id:'lettuce',  label:'🥬 Lettuce',  price:1.00, color:0x44cc33, geo:()=>new THREE.SphereGeometry(0.11,12,10) },
  { id:'juice',    label:'🧃 Juice',    price:1.00, color:0xee9900, geo:()=>new THREE.BoxGeometry(0.10,0.17,0.08) },
  { id:'blanket',  label:'🧺 Blanket',  price:3.00, color:0x9966cc, geo:()=>new THREE.BoxGeometry(0.20,0.10,0.14) },
];

// ── Filler products ───────────────────────────────────────────
const FILLER_DEFS = [
  { c:0xcc3333, g:()=>new THREE.CylinderGeometry(0.054,0.054,0.115,12), label:'🥫 Tomato Soup',    price:1.10 },
  { c:0xff5500, g:()=>new THREE.CylinderGeometry(0.054,0.054,0.130,12), label:'🥫 Baked Beans',    price:0.90 },
  { c:0x2266cc, g:()=>new THREE.CylinderGeometry(0.050,0.050,0.120,12), label:'🥤 Sparkling Water', price:0.70 },
  { c:0x33aacc, g:()=>new THREE.CylinderGeometry(0.048,0.050,0.105,12), label:'🥤 Sports Drink',   price:1.20 },
  { c:0x229944, g:()=>new THREE.CylinderGeometry(0.052,0.052,0.118,12), label:'🫒 Olives',          price:2.10 },
  { c:0xaaaaaa, g:()=>new THREE.CylinderGeometry(0.050,0.050,0.112,12), label:'🧂 Sea Salt',        price:0.60 },
  { c:0xcccccc, g:()=>new THREE.CylinderGeometry(0.056,0.056,0.095,12), label:'🥄 Cooking Spray',   price:1.40 },
  { c:0xeedd88, g:()=>new THREE.BoxGeometry(0.130,0.195,0.070),          label:'🥣 Granola',        price:3.20 },
  { c:0xffaa44, g:()=>new THREE.BoxGeometry(0.125,0.200,0.070),          label:'🌾 Corn Flakes',    price:2.80 },
  { c:0xdd88ff, g:()=>new THREE.BoxGeometry(0.120,0.185,0.068),          label:'🍫 Choco Puffs',    price:3.00 },
  { c:0x88ccee, g:()=>new THREE.BoxGeometry(0.115,0.130,0.080),          label:'🍪 Crackers',       price:1.60 },
  { c:0xee8899, g:()=>new THREE.BoxGeometry(0.130,0.120,0.080),          label:'🍬 Fruit Snacks',   price:1.30 },
  { c:0xaaddcc, g:()=>new THREE.BoxGeometry(0.120,0.115,0.075),          label:'🫙 Pesto',          price:2.50 },
  { c:0x774422, g:()=>new THREE.BoxGeometry(0.115,0.115,0.090),          label:'☕ Coffee',         price:4.50 },
  { c:0xdddddd, g:()=>new THREE.BoxGeometry(0.105,0.135,0.080),          label:'🧁 Cake Mix',       price:2.20 },
  { c:0xff9944, g:()=>new THREE.BoxGeometry(0.155,0.095,0.090),          label:'🍿 Popcorn',        price:1.00 },
  { c:0x55aadd, g:()=>new THREE.BoxGeometry(0.145,0.090,0.085),          label:'🍘 Rice Cakes',     price:1.50 },
  { c:0x66bb44, g:()=>new THREE.CylinderGeometry(0.038,0.044,0.225,10),  label:'🫙 Olive Oil',      price:3.80 },
  { c:0xccaa33, g:()=>new THREE.CylinderGeometry(0.036,0.040,0.210,10),  label:'🍯 Honey',          price:3.40 },
  { c:0x4499dd, g:()=>new THREE.CylinderGeometry(0.038,0.040,0.230,8),   label:'💧 Still Water',    price:0.50 },
  { c:0xcc4444, g:()=>new THREE.CylinderGeometry(0.040,0.046,0.185,10),  label:'🍓 Raspberry Jam',  price:2.30 },
  { c:0x222222, g:()=>new THREE.CylinderGeometry(0.036,0.038,0.240,10),  label:'🫖 Cold Brew',      price:2.90 },
  { c:0xffaa00, g:()=>new THREE.SphereGeometry(0.068,8,6),               label:'🍊 Orange',         price:0.40 },
  { c:0xffff44, g:()=>new THREE.SphereGeometry(0.062,8,6),               label:'🍋 Lemon',          price:0.35 },
  { c:0xcc3333, g:()=>new THREE.SphereGeometry(0.070,8,6),               label:'🍎 Apple',          price:0.55 },
  { c:0x774400, g:()=>new THREE.SphereGeometry(0.058,8,6),               label:'🥔 Potato',         price:0.30 },
];

// Ghibli-esque section names & warm earthy colours
const SECTIONS = [
  ['Forest Pantry',   '#3b2a14'],['Morning Grains', '#2a3b14'],['Seaside Snacks',  '#14303b'],
  ['Meadow Drinks',   '#1a2b14'],['Cottage Jams',   '#3b1a14'],['Hillside Dairy',  '#14283b'],
  ['River Pasta',     '#28201a'],['Garden Harvest',  '#1a3b20'],['Valley Frozen',   '#141e3b'],
  ['Village Bakery',  '#3b2014'],['Herbal Health',   '#143b28'],['Hearth Goods',    '#282814'],
];

const AISLE_XS = [-5, 5];
const SHELF_ZS = [-14, -10, -6, -2];
const FLOOR_Y  = 0;
const BUDGET   = 20.00;

const CHECKOUT_POS    = new THREE.Vector3(-9, 0, 4);
const CHECKOUT_RADIUS = 2.8;

// ── Utilities ─────────────────────────────────────────────────
function stdMat(color, rough=0.75, metal=0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness:rough, metalness:metal });
}
function rng(a, b) { return a + Math.random()*(b-a); }
function halfH(geo) {
  geo.computeBoundingBox();
  return (geo.boundingBox.max.y - geo.boundingBox.min.y) / 2;
}

// ── Billboard helper ──────────────────────────────────────────
function makeBillboard(scene, billboards, canvasW, canvasH, worldW, worldH, paintFn) {
  const c = document.createElement('canvas');
  c.width = canvasW; c.height = canvasH;
  paintFn(c.getContext('2d'), canvasW, canvasH);
  const tex  = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(worldW, worldH),
    new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false, side:THREE.DoubleSide })
  );
  mesh.userData.isBillboard = true;
  scene.add(mesh);
  billboards.push(mesh);
  return mesh;
}

// ── Price tag — billboard so it always faces the camera ───────
// Signature: (scene, billboards, text, x, y, z)
function priceTagFixed(scene, billboards, text, x, y, z) {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 56;
  const ctx = c.getContext('2d');
  // Warm parchment bg
  ctx.fillStyle = '#fdf6e3';
  ctx.beginPath(); ctx.roundRect(2, 2, 156, 52, 8); ctx.fill();
  // Earthy red border
  ctx.strokeStyle = '#8b3a1a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(2, 2, 156, 52, 8); ctx.stroke();
  // Price text
  ctx.fillStyle = '#5c1a00';
  ctx.font = 'bold 24px "Georgia", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 80, 28);
  const tex  = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.13, 0.046),
    new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false, side:THREE.DoubleSide })
  );
  mesh.position.set(x, y, z);
  mesh.userData.isBillboard = true;
  scene.add(mesh);
  billboards.push(mesh);
  return mesh;
}

// ── Section strip ─────────────────────────────────────────────
function sectionStrip(scene, billboards, text, color, x, y, z) {
  const m = makeBillboard(scene, billboards, 256, 44, 1.45, 0.10, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    // Hand-painted feel — slightly rough text
    ctx.fillStyle = '#f0e8c8';
    ctx.font = 'bold italic 16px "Georgia", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w/2, h/2);
  });
  m.position.set(x, y, z);
}

// ── Aisle hanging sign ────────────────────────────────────────
function aisleSign(scene, billboards, text, subtext, x, z) {
  const m = makeBillboard(scene, billboards, 320, 100, 2.1, 0.65, (ctx, w, h) => {
    // Worn wood plank feel
    ctx.fillStyle = '#2e1e0a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w-8, h-8);
    // Grain lines
    for(let i=0; i<8; i++) {
      ctx.strokeStyle = `rgba(180,130,60,${0.06+Math.random()*0.06})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, i*14+4); ctx.lineTo(w, i*14+rng(-3,3)); ctx.stroke();
    }
    ctx.fillStyle = '#f0d898';
    ctx.font = 'bold italic 22px "Georgia", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w/2, 36);
    ctx.font = 'italic 14px "Georgia", serif';
    ctx.fillStyle = '#c8a878';
    ctx.fillText(subtext, w/2, 68);
  });
  m.position.set(x, 3.62, z);
}

// ── Stand sign ────────────────────────────────────────────────
function standSign(scene, billboards, text, color, x, y, z) {
  const m = makeBillboard(scene, billboards, 256, 64, 1.0, 0.25, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,220,140,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, w-6, h-6);
    ctx.fillStyle = '#fff8e8';
    ctx.font = 'bold italic 20px "Georgia", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w/2, h/2);
  });
  m.position.set(x, y, z);
}

// ── Outdoor window texture — Ghibli countryside ───────────────
function makeWindowTexture(w, h) {
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  const ctx = c.getContext('2d');

  // Warm golden-hour sky
  const skyGrad = ctx.createLinearGradient(0,0,0,h*0.62);
  skyGrad.addColorStop(0,   '#f5c87a');
  skyGrad.addColorStop(0.35,'#f9dea0');
  skyGrad.addColorStop(0.7, '#c8e8f5');
  skyGrad.addColorStop(1,   '#a8d8f0');
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, h*0.65);

  // Sun — large, warm
  const sunGrad = ctx.createRadialGradient(w*0.7,h*0.12,0, w*0.7,h*0.12,44);
  sunGrad.addColorStop(0,'rgba(255,245,180,1)');
  sunGrad.addColorStop(0.5,'rgba(255,210,100,0.8)');
  sunGrad.addColorStop(1,'rgba(255,180,60,0)');
  ctx.fillStyle = sunGrad; ctx.beginPath(); ctx.arc(w*0.7,h*0.12,44,0,Math.PI*2); ctx.fill();

  // Wispy Ghibli clouds — soft layered ovals
  function ghibliCloud(cx, cy, scale) {
    const blobs = [
      [cx, cy, 28*scale], [cx+22*scale, cy+6*scale, 20*scale],
      [cx-18*scale, cy+8*scale, 18*scale], [cx+8*scale, cy-8*scale, 16*scale],
    ];
    blobs.forEach(([bx,by,r]) => {
      const g = ctx.createRadialGradient(bx,by,0,bx,by,r);
      g.addColorStop(0,'rgba(255,252,240,0.92)');
      g.addColorStop(0.6,'rgba(255,245,220,0.55)');
      g.addColorStop(1,'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx,by,r,0,Math.PI*2); ctx.fill();
    });
  }
  ghibliCloud(w*0.12, h*0.10, 1.1);
  ghibliCloud(w*0.50, h*0.07, 0.85);
  ghibliCloud(w*0.82, h*0.18, 0.7);

  // Rolling green hills
  ctx.fillStyle = '#7ab850';
  ctx.beginPath();
  ctx.moveTo(0, h*0.62);
  ctx.quadraticCurveTo(w*0.2, h*0.52, w*0.4, h*0.60);
  ctx.quadraticCurveTo(w*0.6, h*0.68, w*0.8, h*0.57);
  ctx.quadraticCurveTo(w*0.92, h*0.52, w, h*0.58);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();

  // Darker foreground hill
  ctx.fillStyle = '#5a9038';
  ctx.beginPath();
  ctx.moveTo(0, h*0.72);
  ctx.quadraticCurveTo(w*0.25, h*0.66, w*0.5, h*0.72);
  ctx.quadraticCurveTo(w*0.75, h*0.78, w, h*0.70);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();

  // Stone path — cobblestone feel
  ctx.fillStyle = '#c4b48a';
  ctx.beginPath();
  ctx.moveTo(w*0.35, h*0.64); ctx.lineTo(w*0.65, h*0.64);
  ctx.lineTo(w*0.82, h); ctx.lineTo(w*0.18, h); ctx.fill();
  // Cobble pattern
  ctx.strokeStyle = 'rgba(100,80,40,0.25)'; ctx.lineWidth = 1.5;
  for(let row=0; row<5; row++) {
    const y2 = h*0.66 + row*14;
    for(let col=0; col<6; col++) {
      ctx.strokeRect(w*0.2+col*22+(row%2)*11, y2, 18, 10);
    }
  }

  // Ghibli-style trees — round canopies, expressive
  function ghibliTree(tx, ty, sc=1) {
    // Trunk — slightly curved feel
    ctx.fillStyle = '#5c3518';
    ctx.fillRect(tx-5*sc, ty, 10*sc, 38*sc);
    // Root flare
    ctx.fillStyle = '#4a2a10';
    ctx.beginPath();
    ctx.ellipse(tx, ty+38*sc, 14*sc, 6*sc, 0, 0, Math.PI); ctx.fill();
    // Layered canopy — 3 overlapping circles for Ghibli roundness
    [[0,-8,26],[6,-18,20],[-5,-16,18],[0,-30,14]].forEach(([ox,oy,r]) => {
      ctx.fillStyle = `hsl(${120+rng(-10,10)},${45+rng(-5,5)}%,${28+rng(-4,4)}%)`;
      ctx.beginPath(); ctx.arc(tx+ox*sc, ty+oy*sc, r*sc, 0, Math.PI*2); ctx.fill();
    });
    // Light spots on canopy
    ctx.fillStyle = 'rgba(180,230,120,0.35)';
    ctx.beginPath(); ctx.arc(tx-6*sc, ty-20*sc, 7*sc, 0, Math.PI*2); ctx.fill();
  }
  ghibliTree(w*0.06, h*0.63, 1.1);
  ghibliTree(w*0.20, h*0.63, 0.85);
  ghibliTree(w*0.76, h*0.63, 0.95);
  ghibliTree(w*0.93, h*0.63, 1.05);

  // Tiny distant village suggestion
  ctx.fillStyle = 'rgba(80,60,40,0.4)';
  ctx.fillRect(w*0.42, h*0.54, 8, 12);
  ctx.fillRect(w*0.44, h*0.52, 12, 4); // roof

  // Window frame — warm aged wood
  ctx.strokeStyle = 'rgba(140,100,50,0.75)'; ctx.lineWidth = 7;
  ctx.strokeRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(140,100,50,0.55)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(w/2,0); ctx.lineTo(w/2,h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,h*0.48); ctx.lineTo(w,h*0.48); ctx.stroke();

  // Soft inner glow — warm afternoon light coming through
  const innerGlow = ctx.createRadialGradient(w/2,h/2,0, w/2,h/2,w/2);
  innerGlow.addColorStop(0,'rgba(255,230,150,0.08)');
  innerGlow.addColorStop(1,'rgba(255,200,80,0.18)');
  ctx.fillStyle = innerGlow; ctx.fillRect(0,0,w,h);

  return new THREE.CanvasTexture(c);
}

// ── Ghibli floor tile texture — hand-painted stone ────────────
function makeFloorTile(color1, color2) {
  const c = document.createElement('canvas'); c.width=64; c.height=64;
  const ctx = c.getContext('2d');
  const col = Math.random() < 0.5 ? color1 : color2;
  ctx.fillStyle = `#${col.toString(16).padStart(6,'0')}`;
  ctx.fillRect(0,0,64,64);
  // Subtle variation — hand-painted feel
  for(let i=0;i<12;i++) {
    ctx.fillStyle = `rgba(0,0,0,${rng(0.01,0.04)})`;
    ctx.fillRect(rng(0,50), rng(0,50), rng(8,24), rng(8,24));
  }
  // Grout lines
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(1,1,62,62);
  return new THREE.CanvasTexture(c);
}

// ══════════════════════════════════════════════════════════════
export class Grocery extends Level {
  constructor(engine) {
    super(engine);
    this.fp           = new FPController(this.camera, engine.input);
    this.interactor   = new Interactor(this.camera, this.scene);
    this._items       = [];
    this._billboards  = [];
    this.npcs         = [];
    this._boardList   = [];
    this._sectionCtr  = 0;
    this.cartObj      = null;
    this._fillerItems = [];
    this._checkoutReady = false;
    this._checkoutDone  = false;
    this._elapsedMs   = 0;
    this._listHUDEl   = null;
    this._basketEl    = null;
    this._basketOpen  = false;
    this._listCollapsed = false;
    this._tabHandler  = null;
  }

  // ─────────────────────────────────────────────────────────
  init() {
    const s = this.scene;
    this._sky = groceryBackground(s);
    this._buildStore(s);
    this._buildShelves(s);
    this._buildFiller(s);
    this._buildItems(s);
    this._buildFlowerStand(s);
    this._buildBakeryStand(s);
    this._buildCart(s);
    this._spawnNPCs(s);
    this._buildCollidables();
  }

  // ─────────────────────────────────────────────────────────
  _buildStore(s) {
    // ── Floor — warm aged terracotta + cream stone tiles ──
    const tileColors = [0xc4a882, 0xd4b892]; // warm stone
    const tGeo = new THREE.PlaneGeometry(1.6, 1.6);
    for(let x=-9; x<=9; x++) for(let z=-17; z<=5; z++) {
      const col = (x+z+50)%2 ? tileColors[0] : tileColors[1];
      const mat = new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.88,
        metalness: 0.0,
      });
      const m = new THREE.Mesh(tGeo, mat);
      m.rotation.x = -Math.PI/2;
      m.position.set(x*1.6, 0.001, z*1.6);
      m.receiveShadow = true;
      s.add(m);
    }

    // ── Ceiling — aged plaster, warm off-white ────────────
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 28),
      stdMat(0xe8dfc8, 0.95)
    );
    ceil.rotation.x = Math.PI/2; ceil.position.set(0, 4, -6); s.add(ceil);

    // Exposed ceiling beams — dark timber, Ghibli cottage feel
    const beamMat = stdMat(0x3a2210, 0.9);
    [-6, -2, 2, 6].forEach(bx => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 28), beamMat);
      beam.position.set(bx, 3.89, -6); s.add(beam);
    });
    // Cross beams
    [-14, -8, -2, 4].forEach(bz => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(30, 0.18, 0.18), beamMat);
      beam.position.set(0, 3.88, bz); s.add(beam);
    });

    // ── Lighting — warm lantern-style ────────────────────
    // Hanging lantern lights
    const lanternPositions = [
      [-4,-4],[-4,-10],[-4,-16],
      [ 4,-4],[ 4,-10],[ 4,-16],
      [ 0,-7],[ 0,-13],
    ];
    lanternPositions.forEach(([lx,lz]) => {
      // Lantern body
      const lanternMat = stdMat(0x8b6914, 0.4, 0.6);
      const lanternBody = new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.22,8), lanternMat);
      lanternBody.position.set(lx, 3.55, lz); s.add(lanternBody);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.10,0.06,8), lanternMat);
      cap.position.set(lx, 3.67, lz); s.add(cap);
      const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.13,0.06,8), lanternMat);
      base2.position.set(lx, 3.44, lz); s.add(base2);
      // Glow pane
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085,0.085,0.18,8),
        new THREE.MeshBasicMaterial({ color:0xffdd88, transparent:true, opacity:0.65 })
      );
      glow.position.set(lx, 3.555, lz); s.add(glow);
      // Hanging wire
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.35,4), stdMat(0x222222,0.9));
      wire.position.set(lx, 3.83, lz); s.add(wire);
      // Warm point light
      const pl = new THREE.PointLight(0xffcc66, 2.8, 9);
      pl.position.set(lx, 3.3, lz); s.add(pl);
    });

    // Ambient — warm afternoon
    const ambLight = new THREE.AmbientLight(0xffe8c0, 0.9); s.add(ambLight);
    const sunLight = new THREE.DirectionalLight(0xffd080, 1.2);
    sunLight.position.set(-12, 6, -4); s.add(sunLight);
    // Soft fill from opposite side
    const fillLight = new THREE.DirectionalLight(0xc8e8ff, 0.3);
    fillLight.position.set(12, 4, -12); s.add(fillLight);

    // ── Walls — warm sage green plaster, Ghibli village ──
    // Base plaster tone — desaturated sage
    const wPlaster = new THREE.MeshStandardMaterial({ color:0x8fa882, roughness:0.92 });
    // Lower dado — darker aged plaster
    const wDado    = new THREE.MeshStandardMaterial({ color:0x6a7d62, roughness:0.95 });

    // Back wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(30,5,0.3), wPlaster);
    backWall.position.set(0,2.5,-19); backWall.receiveShadow=true; s.add(backWall);
    // Front walls
    const frontL = new THREE.Mesh(new THREE.BoxGeometry(8,5,0.3), wPlaster);
    frontL.position.set(-8,2.5,7); s.add(frontL);
    const frontR = new THREE.Mesh(new THREE.BoxGeometry(8,5,0.3), wPlaster);
    frontR.position.set(8,2.5,7); s.add(frontR);
    // Side walls
    const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.3,5,30), wPlaster);
    sideWallL.position.set(-15,2.5,-6); sideWallL.receiveShadow=true; s.add(sideWallL);
    const sideWallR = new THREE.Mesh(new THREE.BoxGeometry(0.3,5,30), wPlaster);
    sideWallR.position.set(15,2.5,-6); sideWallR.receiveShadow=true; s.add(sideWallR);

    // Dado panel — lower third of walls
    [
      [0,0.6,-18.85,30,1.2,0.28],[0,0.6,6.85,30,1.2,0.28],
      [-14.86,0.6,-6,0.28,1.2,28],[14.86,0.6,-6,0.28,1.2,28],
    ].forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wDado);
      m.position.set(x,y,z); s.add(m);
    });

    // Dado rail — warm honey wood trim
    const trimMat = new THREE.MeshStandardMaterial({ color:0xb8862a, roughness:0.45, metalness:0.3 });
    [
      [0,1.21,-18.82,30,0.06,0.06],[0,1.21,6.82,30,0.06,0.06],
      [-14.84,1.21,-6,0.06,0.06,28],[14.84,1.21,-6,0.06,0.06,28],
    ].forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), trimMat);
      m.position.set(x,y,z); s.add(m);
    });

    // Skirting board — at floor level
    const skirtMat = stdMat(0x5c3a18, 0.85);
    [
      [0,0.05,-18.85,30,0.10,0.05],[0,0.05,6.85,30,0.10,0.05],
      [-14.87,0.05,-6,0.05,0.10,28],[14.87,0.05,-6,0.05,0.10,28],
    ].forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), skirtMat);
      m.position.set(x,y,z); s.add(m);
    });

    // ── Windows ───────────────────────────────────────────
    const winTex  = makeWindowTexture(512, 320);
    const winMat  = new THREE.MeshBasicMaterial({ map:winTex, side:THREE.FrontSide });
    const frameMat = stdMat(0xa07838, 0.6, 0.2);

    const addWindow = (x, y, z, rotY, ww=2.4, wh=1.5) => {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), winMat);
      glass.position.set(x, y, z); glass.rotation.y = rotY; s.add(glass);

      const thick = 0.10, depth = 0.06;
      // Top & bottom frames
      [y+wh/2+thick/2, y-wh/2-thick/2].forEach(fy => {
        const f = new THREE.Mesh(new THREE.BoxGeometry(ww+thick*2, thick, depth), frameMat);
        f.position.set(x, fy, z); f.rotation.y = rotY; s.add(f);
      });
      // Side frames
      [-(ww/2+thick/2), (ww/2+thick/2)].forEach(fo => {
        const f = new THREE.Mesh(new THREE.BoxGeometry(thick, wh+thick*2, depth), frameMat);
        const offset = new THREE.Vector3(fo,0,0).applyEuler(new THREE.Euler(0,rotY,0));
        f.position.set(x+offset.x, y, z+offset.z); f.rotation.y = rotY; s.add(f);
      });
      // Sill — wider, slightly jutting
      const sill = new THREE.Mesh(new THREE.BoxGeometry(ww+thick*2+0.16, 0.08, 0.24), frameMat);
      const sillOff = new THREE.Vector3(0,0,0.12).applyEuler(new THREE.Euler(0,rotY,0));
      sill.position.set(x+sillOff.x, y-wh/2-thick/2, z+sillOff.z); sill.rotation.y = rotY; s.add(sill);

      // Warm light spilling in from window
      const wl = new THREE.PointLight(0xffdc80, 0.9, 6);
      const wo  = new THREE.Vector3(0,0,2.5).applyEuler(new THREE.Euler(0,rotY,0));
      wl.position.set(x+wo.x, y, z+wo.z); s.add(wl);
    };

    addWindow(-14.85, 2.1, -4,   Math.PI/2, 2.4, 1.5);
    addWindow(-14.85, 2.1, -9,   Math.PI/2, 2.4, 1.5);
    addWindow(-14.85, 2.1, -14,  Math.PI/2, 2.4, 1.5);
    addWindow( 14.85, 2.1, -4,  -Math.PI/2, 2.4, 1.5);
    addWindow( 14.85, 2.1, -9,  -Math.PI/2, 2.4, 1.5);
    addWindow( 14.85, 2.1, -14, -Math.PI/2, 2.4, 1.5);
    addWindow(-5, 2.3, -18.85, 0, 2.8, 1.6);
    addWindow( 5, 2.3, -18.85, 0, 2.8, 1.6);

    // ── Aisle signs ───────────────────────────────────────
    aisleSign(s, this._billboards, 'Aisle One', 'Pantry · Preserves · Dry Goods', AISLE_XS[0], -8);
    aisleSign(s, this._billboards, 'Aisle Two', 'Fresh · Chilled · Drinks',       AISLE_XS[1], -8);

    // ── Checkout counter — warm walnut ────────────────────
    const walnutMat = stdMat(0x6b4220, 0.5, 0.1);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.9,0.65), walnutMat);
    counter.position.set(-9,0.45,4); counter.castShadow=true; s.add(counter);
    // Stone/marble top
    const cTop = new THREE.Mesh(new THREE.BoxGeometry(2.42,0.05,0.67), stdMat(0xd8cfc0,0.3,0.1));
    cTop.position.set(-9,0.915,4); s.add(cTop);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.02,0.5), stdMat(0x4a4040,0.9));
    belt.position.set(-9,0.92,4); s.add(belt);
    // Brass register suggestion
    const reg = new THREE.Mesh(new THREE.BoxGeometry(0.38,0.30,0.06), stdMat(0x8b7030,0.3,0.7));
    reg.position.set(-9.5,1.20,3.72); s.add(reg);
    // Checkout sign — wood board style
    const chkSign = makeBillboard(s, this._billboards, 512, 128, 2.8, 0.70, (ctx, w, h) => {
      ctx.fillStyle = '#2e1e0a'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 4; ctx.strokeRect(4,4,w-8,h-8);
      ctx.fillStyle = '#f5dfa0';
      ctx.font = 'bold italic 36px "Georgia", serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✦  Market Checkout  ✦', w/2, h*0.38);
      ctx.fillStyle = '#c8b878';
      ctx.font = 'italic 16px "Georgia", serif';
      ctx.fillText('Gather all your goods, then come pay here', w/2, h*0.72);
    });
    chkSign.position.set(-9, 2.1, 4);

    // ── Potted plants — Ghibli cosy detail ───────────────
    const plantPositions = [
      [-13.5,0,4], [13.5,0,4], [-13.5,0,-18], [13.5,0,-18],
    ];
    plantPositions.forEach(([px,py,pz]) => {
      const potMat = stdMat(0x8c5428,0.85);
      const pot  = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.11,0.22,10), potMat);
      pot.position.set(px, 0.11, pz); s.add(pot);
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.13,0.03,10), stdMat(0x3a2210,0.95));
      soil.position.set(px, 0.235, pz); s.add(soil);
      // Bushy plant
      [[0,0,0.16],[0.06,0.05,0.12],[-0.05,0.04,0.11],[0,0.08,0.10]].forEach(([ox,oy,r]) => {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(r, 8, 6),
          stdMat(0x3a7030+Math.floor(rng(-0x050500,0x050500)), 0.8)
        );
        leaf.position.set(px+ox, 0.30+oy, pz); s.add(leaf);
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  _buildShelves(s) {
    // Warm honey-oak wood tones
    const shBk = stdMat(0x4a3418, 0.88);
    const shBd = stdMat(0x6a4e28, 0.82);
    const shSd = stdMat(0x5a3e20, 0.88);

    AISLE_XS.forEach(ax => {
      [-1,1].forEach(sd => {
        const sx = ax + sd*1.6;
        SHELF_ZS.forEach(rz => {
          // Back panel
          const bp = new THREE.Mesh(new THREE.BoxGeometry(1.55,2.1,0.07), shBk);
          bp.position.set(sx,1.05,rz); bp.castShadow=true; bp.receiveShadow=true; s.add(bp);
          // Side panels
          [-0.78,0.78].forEach(ox => {
            const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05,2.1,0.48), shSd);
            sp.position.set(sx+ox, 1.05, rz+sd*0.20); s.add(sp);
          });
          // Shelf boards + section labels
          [0.28,0.90,1.52,2.10].forEach((by,bi) => {
            const b = new THREE.Mesh(new THREE.BoxGeometry(1.55,0.05,0.44), shBd);
            b.position.set(sx, by, rz+sd*0.20); b.receiveShadow=true; s.add(b);
            if(bi < 3) {
              const sec = SECTIONS[this._sectionCtr % SECTIONS.length];
              sectionStrip(s, this._billboards, sec[0], sec[1], sx, by+0.046, rz+sd*0.415);
              this._sectionCtr++;
              this._boardList.push({ sx, by, rz, sd });
            }
          });
          // Front lip strip — brass-ish
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(1.50,0.02,0.03),
            new THREE.MeshStandardMaterial({ color:0xc09040, roughness:0.3, metalness:0.6 })
          );
          strip.position.set(sx, 0.26, rz+sd*0.38); s.add(strip);
          // Kick board
          const kick = new THREE.Mesh(new THREE.BoxGeometry(1.55,0.25,0.06), shBk);
          kick.position.set(sx, 0.12, rz+sd*0.36); s.add(kick);
        });
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  _buildFiller(s) {
    let fillerIdCounter = 0;
    this._boardList.forEach(({ sx, by, rz, sd }) => {
      const n = 6 + Math.floor(Math.random()*4);
      for(let i=0; i<n; i++) {
        const fd  = FILLER_DEFS[Math.floor(Math.random()*FILLER_DEFS.length)];
        const geo = fd.g();
        const col = new THREE.Color(fd.c)
          .offsetHSL(rng(-0.03,0.03), rng(-0.06,0.06), rng(-0.07,0.07));
        const mat = new THREE.MeshStandardMaterial({
          color:col, roughness:rng(0.35,0.75), metalness:rng(0,0.14)
        });
        const mesh = new THREE.Mesh(geo, mat);
        const hh   = halfH(geo);
        const itemX = (sx-0.62) + i/(n-1)*1.24 + rng(-0.025,0.025);
        const itemY = by+0.028+hh;
        const itemZ = rz+sd*0.21+rng(-0.04,0.04);
        mesh.position.set(itemX, itemY, itemZ);
        mesh.rotation.y = rng(-0.4,0.4);
        mesh.castShadow = true; s.add(mesh);

        const om = new THREE.MeshBasicMaterial({ color:0x000000, side:THREE.BackSide });
        const outMesh = new THREE.Mesh(geo, om);
        outMesh.scale.setScalar(1.04); mesh.add(outMesh);

        const def = { id:`filler_${fillerIdCounter++}`, label:fd.label, price:fd.price, color:fd.c };
        mesh.userData = { isItem:true, def, onInteract:()=>this._buyItem(mesh) };
        this._fillerItems.push({ mesh, def, picked:false });
        this.interactables.push(mesh);

        // Price tag — billboard, sits just in front of item
        priceTagFixed(s, this._billboards, `$${fd.price.toFixed(2)}`,
          itemX, by + 0.042, itemZ + sd*0.06
        );
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  _buildItems(s) {
    LIST.forEach((def, i) => {
      const ax  = AISLE_XS[i % AISLE_XS.length];
      const sd  = i%2===0 ? -1 : 1;
      const sx  = ax + sd*1.6;
      const rz  = SHELF_ZS[Math.floor(i/2) % SHELF_ZS.length];
      const by  = [0.28,0.90,1.52][Math.floor(i/4)%3];

      const geo = def.geo();
      const hh  = halfH(geo);
      const mat = new THREE.MeshStandardMaterial({
        color: def.color, roughness:0.45, metalness:0.08,
        emissive: def.color, emissiveIntensity:0.18
      });
      const mesh = new THREE.Mesh(geo, mat);
      const itemX = sx, itemY = by+0.028+hh, itemZ = rz+sd*0.22;
      mesh.position.set(itemX, itemY, itemZ);
      mesh.castShadow = true;

      // Gold outline
      const outGeo = def.geo();
      const outMat = new THREE.MeshBasicMaterial({
        color:0xffd700, side:THREE.BackSide, transparent:true, opacity:0.55
      });
      const outline = new THREE.Mesh(outGeo, outMat);
      outline.scale.setScalar(1.22); mesh.add(outline);
      mesh.userData = { isItem:true, def, outline, onInteract:()=>this._pickItem(mesh) };

      this._items.push({ mesh, def, picked:false });
      this.interactables.push(mesh);
      s.add(mesh);

      priceTagFixed(s, this._billboards, `$${def.price.toFixed(2)}`,
        itemX, by + 0.042, itemZ + sd*0.06
      );
    });
  }

  // ─────────────────────────────────────────────────────────
  _buildFlowerStand(s) {
    const wood = stdMat(0x5a3818, 0.82);
    const top  = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.07,0.9), stdMat(0x7a5228,0.7));
    top.position.set(6,0.90,3); s.add(top);
    [[-0.72,0.38],[0.72,0.38],[-0.72,-0.38],[0.72,-0.38]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.90,0.07), wood);
      leg.position.set(6+lx,0.45,3+lz); s.add(leg);
    });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.05,0.9), wood);
    shelf.position.set(6,0.44,3); s.add(shelf);

    // Trellis back — charming Ghibli garden detail
    for(let xi=0; xi<5; xi++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04,1.4,0.04), wood);
      post.position.set(6-0.72+xi*0.36, 1.63, 2.58); s.add(post);
    }
    for(let yi=0; yi<5; yi++) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.55,0.04,0.04), wood);
      rail.position.set(6, 1.00+yi*0.28, 2.58); s.add(rail);
    }

    // Flower buckets — glazed ceramic feel
    const flowerGroups = [
      { x:5.4, z:2.98, bucketColor:0x5a8860, blooms:[{c:0xff4466,r:0.06},{c:0xff6699,r:0.05},{c:0xff2255,r:0.055}] },
      { x:6.0, z:2.98, bucketColor:0x7a6830, blooms:[{c:0xffdd00,r:0.06},{c:0xffee44,r:0.05},{c:0xffcc00,r:0.055}] },
      { x:6.6, z:2.98, bucketColor:0x5a5888, blooms:[{c:0xaa44ff,r:0.06},{c:0xcc66ff,r:0.055},{c:0x8822ee,r:0.05}] },
    ];

    flowerGroups.forEach(fg => {
      const bucket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10,0.08,0.22,12),
        new THREE.MeshStandardMaterial({ color:fg.bucketColor, roughness:0.4, metalness:0.3 })
      );
      bucket.position.set(fg.x, 0.97, fg.z); s.add(bucket);
      fg.blooms.forEach((bl, si) => {
        const angle = (si/fg.blooms.length)*Math.PI*2;
        const sr = 0.04;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.008,0.008,0.32,6),
          stdMat(0x2a6a1a,0.8)
        );
        stem.position.set(fg.x+Math.cos(angle)*sr, 1.24, fg.z+Math.sin(angle)*sr); s.add(stem);
        // Petals — multi-sphere cluster
        const bloom = new THREE.Mesh(
          new THREE.SphereGeometry(bl.r, 8, 6),
          new THREE.MeshStandardMaterial({ color:bl.c, roughness:0.55, emissive:bl.c, emissiveIntensity:0.12 })
        );
        bloom.position.set(fg.x+Math.cos(angle)*sr, 1.40, fg.z+Math.sin(angle)*sr); s.add(bloom);
        // Smaller accent petal
        const petal2 = new THREE.Mesh(
          new THREE.SphereGeometry(bl.r*0.55, 6, 4),
          new THREE.MeshStandardMaterial({ color:new THREE.Color(bl.c).offsetHSL(0.05,0,0.1), roughness:0.5 })
        );
        petal2.position.set(fg.x+Math.cos(angle+0.8)*sr*1.8, 1.42, fg.z+Math.sin(angle+0.8)*sr*1.8);
        s.add(petal2);
      });
    });

    // Hanging potted plants on trellis
    [5.6, 6.0, 6.4].forEach(hx => {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.05,0.10,10), stdMat(0x9c5a20,0.82));
      pot.position.set(hx, 2.18, 2.58); s.add(pot);
      [[0,0,0.10],[0.04,0.04,0.08],[-0.03,0.03,0.07]].forEach(([ox,oy,r]) => {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(r,6,5), stdMat(0x3a8030+Math.floor(rng(-0x040400,0x040400)),0.75));
        leaf.position.set(hx+ox, 2.30+oy, 2.58); s.add(leaf);
      });
    });

    // Bouquet — purchasable item
    const bqDef = { id:'bouquet', label:'💐 Bouquet', price:3.00, color:0xff4466 };
    const bqGeo = new THREE.SphereGeometry(0.12,10,8);
    const bqMat = new THREE.MeshStandardMaterial({ color:0xff4466, roughness:0.5, emissive:0xff2244, emissiveIntensity:0.25 });
    const bqMesh = new THREE.Mesh(bqGeo, bqMat);
    bqMesh.position.set(6.0, 1.01, 3.28);
    const bqOut = new THREE.Mesh(bqGeo,
      new THREE.MeshBasicMaterial({ color:0xffd700, side:THREE.BackSide, transparent:true, opacity:0.55 }));
    bqOut.scale.setScalar(1.25); bqMesh.add(bqOut);
    bqMesh.userData = { isItem:true, def:bqDef, outline:bqOut, onInteract:()=>this._pickItem(bqMesh) };
    this._items.push({ mesh:bqMesh, def:bqDef, picked:false });
    this.interactables.push(bqMesh); s.add(bqMesh);

    // FIX: uses updated signature (no facingDir arg)
    priceTagFixed(s, this._billboards, `$${bqDef.price.toFixed(2)}`, 6.0, 0.88, 3.40);
    standSign(s, this._billboards, '✿ Fresh Flowers', '#3a1e2e', 6.0, 2.58, 3.0);
  }

  // ─────────────────────────────────────────────────────────
  _buildBakeryStand(s) {
    const wood = stdMat(0x4a2c10, 0.82);
    const ctr  = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.95,0.85), stdMat(0x6a3c18,0.6));
    ctr.position.set(-3,0.475,3); s.add(ctr);
    const ctrTop = new THREE.Mesh(new THREE.BoxGeometry(2.22,0.04,0.87), stdMat(0x1c1008,0.2,0.1));
    ctrTop.position.set(-3,0.96,3); s.add(ctrTop);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.1,0.45,0.03),
      new THREE.MeshStandardMaterial({ color:0xaaccee, transparent:true, opacity:0.20, roughness:0.05 })
    );
    glass.position.set(-3,0.70,3.43); s.add(glass);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.10,0.6), stdMat(0x7a4828,0.7));
    riser.position.set(-3,0.98,3.05); s.add(riser);
    const riser2 = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.10,0.4), stdMat(0x7a4828,0.7));
    riser2.position.set(-3,1.10,3.05); s.add(riser2);
    [[-1.02,0.36],[1.02,0.36],[-1.02,-0.36],[1.02,-0.36]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.95,0.06), wood);
      leg.position.set(-3+lx,0.475,3+lz); s.add(leg);
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.3,0.16,0.16), wood);
    board.position.set(-3,2.4,2.62); s.add(board);
    [[-0.9],[0.9]].forEach(([ox]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05,1.44,0.05), wood);
      arm.position.set(-3+ox,1.68,2.62); s.add(arm);
    });
    [-0.6,-0.2,0.2,0.6].forEach((ox,hi) => {
      const hb = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.16,0.08),
        stdMat([0xd4933a,0xc8843a,0xe0a044,0xbc7c30][hi%4],0.7));
      hb.position.set(-3+ox,2.18,2.62); s.add(hb);
    });

    const bakeryItems = [
      { id:'croissant', label:'🥐 Croissant',    price:1.80, color:0xe8a844,
        geo:()=>new THREE.TorusGeometry(0.06,0.028,6,12,Math.PI*1.4), x:-3.6, y:1.08, z:3.00 },
      { id:'muffin',    label:'🧁 Muffin',       price:2.20, color:0xd46030,
        geo:()=>new THREE.CylinderGeometry(0.06,0.05,0.10,10),         x:-3.2, y:1.08, z:3.00 },
      { id:'baguette',  label:'🥖 Baguette',     price:1.40, color:0xcc9933,
        geo:()=>new THREE.CylinderGeometry(0.030,0.030,0.30,8),        x:-2.8, y:1.08, z:3.00 },
      { id:'cinnroll',  label:'🍩 Cinnamon Roll', price:2.50, color:0xc87820,
        geo:()=>new THREE.TorusGeometry(0.065,0.030,8,14),             x:-2.4, y:1.08, z:3.00 },
    ];

    bakeryItems.forEach(def => {
      const geo = def.geo();
      const hh  = halfH(geo);
      const mat = new THREE.MeshStandardMaterial({
        color:def.color, roughness:0.55, metalness:0.02,
        emissive:def.color, emissiveIntensity:0.15
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(def.x, def.y+hh, def.z);
      mesh.castShadow = true;
      const outGeo = def.geo();
      const outMat = new THREE.MeshBasicMaterial({ color:0xffd700, side:THREE.BackSide, transparent:true, opacity:0.55 });
      const outline = new THREE.Mesh(outGeo, outMat);
      outline.scale.setScalar(1.22); mesh.add(outline);
      mesh.userData = { isItem:true, def, outline, onInteract:()=>this._pickItem(mesh) };
      this._items.push({ mesh, def, picked:false });
      this.interactables.push(mesh); s.add(mesh);

      // FIX: updated signature (no facingDir)
      priceTagFixed(s, this._billboards, `$${def.price.toFixed(2)}`, def.x, 0.965, def.z+0.10);
    });

    standSign(s, this._billboards, '🥖 Village Bakery', '#2e1400', -3.0, 2.76, 2.62);
  }

  // ─────────────────────────────────────────────────────────
  _buildCart(s) {
    const metal = stdMat(0x9aaa88,0.4,0.55); // mossy green-grey
    const g = new THREE.Group(); g.position.set(0,0,3); s.add(g); this.cartObj=g;
    const bask = new THREE.Mesh(new THREE.BoxGeometry(0.65,0.44,0.95),
      new THREE.MeshStandardMaterial({ color:0x9aaa88, wireframe:true }));
    bask.position.y=0.6; g.add(bask);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.66,0.04,0.96), metal);
    base.position.y=0.38; g.add(base);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.66,0.05,0.05), metal);
    handle.position.set(0,0.90,-0.5); g.add(handle);
    [[-0.28,0.44],[0.28,0.44],[-0.28,-0.44],[0.28,-0.44]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.38,0.03), metal);
      leg.position.set(lx,0.20,lz); g.add(leg);
    });
    [[-0.3,0.44],[0.3,0.44],[-0.3,-0.44],[0.3,-0.44]].forEach(([wx,wz]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.05,12), stdMat(0x444440,0.9));
      w.rotation.z=Math.PI/2; w.position.set(wx,0.08,wz); g.add(w);
    });
  }

  // ─────────────────────────────────────────────────────────
  _spawnNPCs(s) {
    const NPC_DEFS = [
      { name:'✦ Vega',  color:0xffe566, glowColor:0xffdd00, x:-2, z:-5,  speed:1.4, personality:'shopper',
        quips:['Hmm, which one…','Need to check my list!','Oh, is that fresh today?'], points:6, outerR:0.30, innerR:0.13, height:0.08 },
      { name:'★ Blaze', color:0xff6633, glowColor:0xff4400, x: 3, z:-9,  speed:2.1, personality:'rusher',
        quips:['No time!','Quick, quick!','Where\'s the bread?!'], points:4, outerR:0.26, innerR:0.10, height:0.07 },
      { name:'✿ Mochi', color:0xff88ee, glowColor:0xdd44cc, x:-7, z:-13, speed:0.9, personality:'browser',
        quips:['How lovely…','What a nice shop!','Maybe flowers too~'], points:8, outerR:0.32, innerR:0.16, height:0.07 },
      { name:'◈ Zed',   color:0x44ddff, glowColor:0x0099cc, x: 6, z:-3,  speed:1.7, personality:'shopper',
        quips:['Almost done…','Just a few more.','Budget is tight.'], points:5, outerR:0.28, innerR:0.11, height:0.09 },
      { name:'❋ Petra', color:0xaaff66, glowColor:0x66cc22, x:-4, z:-8,  speed:1.1, personality:'browser',
        quips:['Is this organic?','Love this place!','So many choices…'], points:7, outerR:0.31, innerR:0.14, height:0.07 },
    ];

    NPC_DEFS.forEach(cfg => {
      const g = new THREE.Group(); g.position.set(cfg.x, 0.55, cfg.z); s.add(g);
      const coreMat = new THREE.MeshStandardMaterial({ color:cfg.color, emissive:cfg.color, emissiveIntensity:0.6, roughness:0.35, metalness:0.15 });
      const rimMat  = new THREE.MeshStandardMaterial({ color:cfg.glowColor, emissive:cfg.glowColor, emissiveIntensity:0.9, roughness:0.2, metalness:0.3, transparent:true, opacity:0.85 });

      const bodyGroup = new THREE.Group(); g.add(bodyGroup);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(cfg.innerR*1.3, cfg.innerR*1.3, cfg.height*1.6, 20), coreMat);
      bodyGroup.add(disc);

      for(let p=0; p<cfg.points; p++) {
        const angle = (p/cfg.points)*Math.PI*2;
        const ray = new THREE.Mesh(new THREE.ConeGeometry(cfg.innerR*0.55, cfg.outerR-cfg.innerR, 4, 1), coreMat);
        ray.position.set(Math.cos(angle)*(cfg.innerR+(cfg.outerR-cfg.innerR)*0.42), 0, Math.sin(angle)*(cfg.innerR+(cfg.outerR-cfg.innerR)*0.42));
        ray.rotation.z = -Math.PI/2; ray.rotation.y = -angle; bodyGroup.add(ray);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(cfg.innerR*0.28,6,4), rimMat);
        tip.position.set(Math.cos(angle)*cfg.outerR*0.94, 0, Math.sin(angle)*cfg.outerR*0.94);
        bodyGroup.add(tip);
      }
      [0.065,-0.065].forEach(yo => {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(cfg.innerR*0.9,10,6),
          new THREE.MeshStandardMaterial({ color:cfg.glowColor, emissive:cfg.glowColor, emissiveIntensity:0.7, roughness:0.3, metalness:0.2 }));
        cap.position.y = yo; bodyGroup.add(cap);
      });

      const sparkleGroup = new THREE.Group(); g.add(sparkleGroup);
      const nSparkles = 5+cfg.points;
      for(let i=0; i<nSparkles; i++) {
        const sp = new THREE.Mesh(new THREE.SphereGeometry(0.022+Math.random()*0.018,4,3),
          new THREE.MeshBasicMaterial({ color:cfg.glowColor }));
        const sa = (i/nSparkles)*Math.PI*2;
        const sr = cfg.outerR*1.35+Math.random()*0.08;
        sp.position.set(Math.cos(sa)*sr, (Math.random()-0.5)*0.12, Math.sin(sa)*sr);
        sparkleGroup.add(sp);
      }

      const glow = new THREE.PointLight(cfg.glowColor, 1.8, 3.5); g.add(glow);

      const nameTag = makeBillboard(s, this._billboards, 180, 40, 0.80, 0.18, (ctx, w, h) => {
        ctx.fillStyle='rgba(20,12,4,0.80)'; ctx.beginPath(); ctx.roundRect(0,0,w,h,20); ctx.fill();
        const col = '#'+cfg.color.toString(16).padStart(6,'0');
        ctx.strokeStyle=col; ctx.lineWidth=2.5; ctx.beginPath(); ctx.roundRect(1,1,w-2,h-2,20); ctx.stroke();
        ctx.fillStyle=col; ctx.font='bold italic 16px "Georgia", serif';
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(cfg.name, w/2, h/2);
      });
      nameTag.position.set(cfg.x, 0.88, cfg.z);

      const bubble = makeBillboard(s, this._billboards, 260, 60, 1.10, 0.26, (ctx, w, h) => {
        ctx.fillStyle='rgba(255,252,235,0.96)'; ctx.beginPath(); ctx.roundRect(0,0,w,h,10); ctx.fill();
        ctx.strokeStyle='#c8aa70'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.fillStyle='#3a2a10'; ctx.font='italic 13px "Georgia", serif';
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(cfg.quips[0], w/2, h/2);
      });
      bubble.position.set(cfg.x, 1.10, cfg.z); bubble.visible=false;

      g.userData = {
        bodyGroup, sparkleGroup, glow, nameTag, bubble,
        name:cfg.name, color:cfg.color, quips:cfg.quips,
        target:new THREE.Vector3(cfg.x, 0.55, cfg.z),
        idleTimer:rng(1,3), walking:false,
        speed:cfg.speed, personality:cfg.personality,
        quipTimer:rng(4,12), quipShow:0, currentQuip:0,
        outerR:cfg.outerR, points:cfg.points, walkT:0,
      };
      this.npcs.push(g);
    });
  }

  // ─────────────────────────────────────────────────────────
  _npcNewTarget(ud) {
    if(ud.personality==='rusher') {
      ud.target.set(rng(-12,12), 0.55, rng(-16,4)); ud.idleTimer=rng(0.2,1.0);
    } else if(ud.personality==='browser') {
      const ax=AISLE_XS[Math.random()<0.5?0:1];
      ud.target.set(ax+rng(-2.5,2.5), 0.55, rng(-15,-1)); ud.idleTimer=rng(2,5);
    } else {
      ud.target.set(rng(-10,10), 0.55, rng(-14,4)); ud.idleTimer=rng(1,3);
    }
  }

  // ─────────────────────────────────────────────────────────
  _buildCollidables() {
    const wallBoxes = [
      new THREE.Box3(new THREE.Vector3(-15.5,0,-20), new THREE.Vector3(-14.5,5,8)),
      new THREE.Box3(new THREE.Vector3( 14.5,0,-20), new THREE.Vector3( 15.5,5,8)),
      new THREE.Box3(new THREE.Vector3(-16,0,-20),   new THREE.Vector3( 16,5,-18.5)),
      new THREE.Box3(new THREE.Vector3(-16,0,6.5),   new THREE.Vector3( 16,5,8)),
    ];
    wallBoxes.push(new THREE.Box3(new THREE.Vector3(-10.4,0,3.7), new THREE.Vector3(-7.7,1.5,4.4)));
    wallBoxes.push(new THREE.Box3(new THREE.Vector3(5.2,0,2.6),   new THREE.Vector3(6.8,1.2,3.5)));
    wallBoxes.push(new THREE.Box3(new THREE.Vector3(-4.2,0,2.6),  new THREE.Vector3(-1.8,1.2,3.5)));
    AISLE_XS.forEach(ax => [-1,1].forEach(sd => {
      const sx = ax+sd*1.6;
      SHELF_ZS.forEach(rz => {
        wallBoxes.push(new THREE.Box3(
          new THREE.Vector3(sx-0.82,0,rz-0.28),
          new THREE.Vector3(sx+0.82,2.2,rz+0.28)
        ));
      });
    }));
    this.collidables = wallBoxes;
  }

  // ─────────────────────────────────────────────────────────
  _buildShoppingListHUD() {
    const panel = document.createElement('div');
    panel.id = 'grocery-list-panel';
    panel.style.cssText = `
      position: fixed; top: 18px; right: 18px; width: 240px;
      background: rgba(28, 18, 8, 0.92);
      border: 2px solid #a07838;
      border-radius: 12px;
      font-family: 'Georgia', serif;
      color: #f0e8c8;
      z-index: 9999;
      box-shadow: 0 4px 28px rgba(0,0,0,0.55);
      pointer-events: all; user-select: none;
    `;
    document.body.appendChild(panel);
    this._listHUDEl = panel;
    this._listCollapsed = false;
    this._refreshListHUD();
  }

  _refreshListHUD() {
    if(!this._listHUDEl) return;
    const spent     = this._spentAmount();
    const remaining = BUDGET - spent;
    const allDone   = this._items.every(e => e.picked);

    const rows = this._listCollapsed ? '' : this._items.map(entry => {
      const done = entry.picked;
      return `
        <div style="display:flex;align-items:center;gap:8px;margin:4px 0;opacity:${done?0.45:1}">
          <span style="font-size:16px;${done?'filter:grayscale(1)':''}">${entry.def.label.split(' ')[0]}</span>
          <span style="flex:1;font-size:13px;${done?'text-decoration:line-through;color:#887750':'color:#e8d8a8'}">${entry.def.label.slice(entry.def.label.indexOf(' ')+1)}</span>
          <span style="font-size:12px;color:${done?'#a08840':'#ffcc66'}">${done?'✓':'$'+entry.def.price.toFixed(2)}</span>
        </div>`;
    }).join('');

    const budgetSection = this._listCollapsed ? '' : `
      <div style="margin-top:10px;border-top:1px solid #6a4a18;padding-top:8px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#c8a868;">Budget:</span><span style="color:#f0e8c8;font-weight:600;">$${BUDGET.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#c8a868;">Spent:</span><span style="color:#ffcc66;font-weight:600;">$${spent.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#c8a868;">Left:</span>
          <span style="color:${remaining<2?'#dd5533':'#88cc66'};font-weight:700;">$${remaining.toFixed(2)}</span>
        </div>
      </div>`;

    this._listHUDEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:10px 14px;cursor:pointer;border-radius:10px;" id="grocery-list-toggle">
        <span style="font-size:15px;font-weight:700;font-style:italic;color:#e8c870;">✦ Shopping List</span>
        <span style="font-size:16px;color:#c8a848;">${this._listCollapsed?'▼':'▲'}</span>
      </div>
      ${this._listCollapsed?'':` <div style="padding:0 14px 12px">${rows}${budgetSection}</div>`}
      ${allDone&&!this._checkoutDone&&!this._listCollapsed?`
        <div style="margin:0 14px 10px;background:#2e1e08;border:1px solid #c8a040;border-radius:8px;padding:8px;text-align:center;font-size:13px;color:#f0d870;font-style:italic;">
          ✦ All gathered! Head to the checkout ✦
        </div>`:''}
      ${this._checkoutDone&&!this._listCollapsed?`
        <div style="margin:0 14px 10px;background:#0e2818;border:1px solid #70aa40;border-radius:8px;padding:8px;text-align:center;font-size:13px;color:#a8e070;font-style:italic;">
          ✦ Shopping complete! ✦
        </div>`:''}
    `;
    document.getElementById('grocery-list-toggle')?.addEventListener('click', () => {
      this._listCollapsed = !this._listCollapsed;
      this._refreshListHUD();
    });
  }

  // ─────────────────────────────────────────────────────────
  onEnter() {
    this.fp.speed = 9;
    this.fp.teleport(0, 0, 5, Math.PI);
    this._items.forEach(e => { e.picked=false; e.mesh.visible=true; });
    this._fillerItems.forEach(e => { e.picked=false; e.mesh.visible=true; });
    this._checkoutReady = false;
    this._checkoutDone  = false;
    this._basketOpen    = false;
    this._elapsedMs     = 0;

    if(!this._listHUDEl) {
      this._buildShoppingListHUD();
    } else {
      this._listHUDEl.style.display = 'block';
    }
    this._refreshListHUD();

    if(!document.getElementById('grocery-pulse-style')) {
      const st = document.createElement('style');
      st.id = 'grocery-pulse-style';
      st.textContent = '@keyframes pulse{from{opacity:0.6}to{opacity:1}}';
      document.head.appendChild(st);
    }

    this._tabHandler = (e) => {
      if(e.code==='Tab') {
        e.preventDefault();
        if(this._basketOpen) this._closeBasket(); else this._openBasket();
      }
      if(e.code==='Escape' && this._basketOpen) this._closeBasket();
    };
    window.addEventListener('keydown', this._tabHandler);
  }

  // ─────────────────────────────────────────────────────────
  // FIX: single onExit — no duplicate
  onExit() {
    document.getElementById('grocery-list-panel')?.remove();
    document.getElementById('grocery-basket-panel')?.remove();
    document.getElementById('grocery-pulse-style')?.remove();
    this._listHUDEl = null;
    this._basketEl  = null;
    if(this._tabHandler) window.removeEventListener('keydown', this._tabHandler);
    this._closeBasket();
  }

  // ─────────────────────────────────────────────────────────
  _spentAmount() {
    return this._items.filter(e=>e.picked).reduce((s,e)=>s+e.def.price,0)
         + this._fillerItems.filter(e=>e.picked).reduce((s,e)=>s+e.def.price,0);
  }

  _pickItem(mesh) {
    const entry = this._items.find(e=>e.mesh===mesh);
    if(!entry || entry.picked) return;
    if(this._spentAmount()+entry.def.price > BUDGET) {
      this.engine.hud.showPrompt('Over budget! Press [Tab] to open basket and return something.');
      return;
    }
    entry.picked=true; mesh.visible=false;
    this.engine.audio?.play('pickup');
    this._checkoutReady = this._items.every(e=>e.picked);
    this._refreshListHUD();
  }

  _buyItem(mesh) {
    const entry = this._fillerItems.find(e=>e.mesh===mesh);
    if(!entry || entry.picked) return;
    if(this._spentAmount()+entry.def.price > BUDGET) {
      this.engine.hud.showPrompt('Over budget! Press [Tab] to open basket and return something.');
      return;
    }
    entry.picked=true; mesh.visible=false;
    this.engine.audio?.play('pickup');
    this._refreshListHUD();
  }

  // ─────────────────────────────────────────────────────────
  _buildBasketUI() {
    if(this._basketEl) return;
    const panel = document.createElement('div');
    panel.id = 'grocery-basket-panel';
    panel.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      width:320px; max-height:70vh; overflow-y:auto;
      background:rgba(20,12,4,0.97);
      border:2px solid #a07838; border-radius:14px;
      padding:16px 18px;
      font-family:'Georgia',serif; color:#f0e8c8;
      z-index:10000; box-shadow:0 8px 40px rgba(0,0,0,0.7);
      display:none;
    `;
    document.body.appendChild(panel);
    this._basketEl = panel;
  }

  _openBasket() {
    if(!this._basketEl) this._buildBasketUI();
    this._basketOpen = true;
    this._refreshBasketUI();
    this._basketEl.style.display = 'block';
    if(document.pointerLockElement) document.exitPointerLock();
  }

  _closeBasket() {
    this._basketOpen = false;
    if(this._basketEl) this._basketEl.style.display = 'none';
  }

  _refreshBasketUI() {
    if(!this._basketEl) return;
    const pickedList   = this._items.filter(e=>e.picked);
    const pickedFiller = this._fillerItems.filter(e=>e.picked);
    const all = [
      ...pickedList.map(e=>({...e, isRequired:true})),
      ...pickedFiller.map(e=>({...e, isRequired:false})),
    ];
    const spent = this._spentAmount(), remaining = BUDGET-spent;

    const rows = all.length===0
      ? `<div style="color:#887750;text-align:center;padding:12px;font-style:italic;">Your basket is empty.</div>`
      : all.map((entry,i) => `
        <div style="display:flex;align-items:center;gap:8px;margin:6px 0;padding:6px 8px;background:rgba(255,240,180,0.06);border-radius:8px;">
          <span style="font-size:18px">${entry.def.label.split(' ')[0]}</span>
          <span style="flex:1;font-size:13px;color:${entry.isRequired?'#f0d070':'#b8a870'}">${entry.def.label.slice(entry.def.label.indexOf(' ')+1)}${entry.isRequired?' ✦':''}</span>
          <span style="font-size:13px;color:#e8a840;min-width:38px;text-align:right">$${entry.def.price.toFixed(2)}</span>
          <button onclick="window.__groceryReturn(${i})" style="
            background:#6a2810;border:1px solid #aa4820;color:#f0c890;border-radius:6px;
            padding:4px 9px;font-size:12px;cursor:pointer;font-family:'Georgia',serif;
          ">Return</button>
        </div>`).join('');

    this._basketEl.innerHTML = `
      <div style="font-size:16px;font-weight:700;font-style:italic;color:#e8c870;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
        <span>✦ Your Basket (${all.length})</span>
        <button onclick="window.__groceryCloseBasket()" style="background:transparent;border:1px solid #a07838;color:#e8c870;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:13px;font-family:'Georgia',serif;">✕ Close</button>
      </div>
      ${rows}
      <div style="margin-top:12px;border-top:1px solid #5a3a10;padding-top:10px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;margin:3px 0">
          <span style="color:#c8a868">Total spent:</span>
          <span style="color:#ffcc44;font-weight:700">$${spent.toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin:3px 0">
          <span style="color:#c8a868">Remaining:</span>
          <span style="color:${remaining<2?'#dd5533':'#88cc66'};font-weight:700">$${remaining.toFixed(2)}</span>
        </div>
      </div>
      <div style="margin-top:10px;color:#6a5030;font-size:11px;text-align:center;font-style:italic">[Tab] or click ✕ to close</div>
    `;

    window.__groceryReturn = (idx) => {
      const allNow = [
        ...this._items.filter(e=>e.picked).map(e=>({...e,isRequired:true})),
        ...this._fillerItems.filter(e=>e.picked).map(e=>({...e,isRequired:false})),
      ];
      const target = allNow[idx]; if(!target) return;
      this._returnItem(target.mesh, target.isRequired);
      this._refreshBasketUI();
    };
    window.__groceryCloseBasket = () => this._closeBasket();
  }

  _returnItem(mesh, isRequired) {
    const arr = isRequired ? this._items : this._fillerItems;
    const entry = arr.find(e=>e.mesh===mesh);
    if(!entry || !entry.picked) return;
    entry.picked=false; mesh.visible=true;
    this._checkoutReady = this._items.every(e=>e.picked);
    this._refreshListHUD();
    this.engine.audio?.play('pickup');
  }

  _doCheckout() {
    if(this._checkoutDone) return;
    this._checkoutDone = true;
    this._refreshListHUD();
    this.engine.audio?.play('pickup');
    setTimeout(() => this.engine.nextLevel('grocery'), 1200);
  }

  // ─────────────────────────────────────────────────────────
  update(dt) {
    this._sky?.update(dt);
    this._elapsedMs += dt * 1000;

    if(this._basketOpen) return;

    this.fp.update(dt, this.collidables);

    // Billboards face camera
    const camPos = this.camera.position;
    this._billboards.forEach(m => m.lookAt(camPos.x, m.position.y, camPos.z));

    // NPC update
    this.npcs.forEach(npc => {
      const ud = npc.userData;

      ud.quipTimer -= dt;
      if(ud.quipTimer <= 0) {
        ud.quipTimer = rng(6,16);
        ud.currentQuip = (ud.currentQuip+1) % ud.quips.length;
        ud.quipShow = 2.8;
        const qc = document.createElement('canvas'); qc.width=260; qc.height=62;
        const qx = qc.getContext('2d');
        qx.fillStyle='rgba(255,248,220,0.96)';
        qx.beginPath(); qx.roundRect(0,0,260,62,10); qx.fill();
        qx.strokeStyle='#c8a870'; qx.lineWidth=1.5; qx.stroke();
        qx.fillStyle='#3a2808'; qx.font='italic 13px "Georgia",serif';
        qx.textAlign='center'; qx.textBaseline='middle';
        qx.fillText(ud.quips[ud.currentQuip], 130, 31);
        ud.bubble.material.map = new THREE.CanvasTexture(qc);
        ud.bubble.material.needsUpdate = true;
        ud.bubble.visible = true;
      }
      if(ud.quipShow > 0) { ud.quipShow -= dt; if(ud.quipShow<=0) ud.bubble.visible=false; }

      if(!ud.walking) {
        ud.idleTimer -= dt;
        ud.bodyGroup.rotation.y = this._elapsedMs*0.0005 + npc.position.x;
        if(ud.idleTimer <= 0) { this._npcNewTarget(ud); ud.walking=true; }
      } else {
        const dir = ud.target.clone().sub(npc.position); dir.y=0;
        const dist = dir.length();
        if(dist < 0.35) {
          ud.walking=false; ud.walkT=0;
        } else {
          dir.normalize();
          npc.position.addScaledVector(dir, ud.speed*dt);
          npc.rotation.y = Math.atan2(dir.x, dir.z);
          ud.walkT += dt*ud.speed*4.5;
          ud.bodyGroup.rotation.y = ud.walkT;
          ud.bodyGroup.position.y = Math.abs(Math.sin(ud.walkT))*0.028;
          ud.sparkleGroup.rotation.y = -ud.walkT*0.4;
        }
      }

      ud.nameTag.position.set(npc.position.x, 1.84, npc.position.z);
      ud.bubble.position.set(npc.position.x, 2.18, npc.position.z);
    });

    // Cart follows player
    if(this.cartObj) {
      const cam=this.fp.pos, cart=this.cartObj.position;
      const dx=cam.x-cart.x, dz=cam.z-cart.z;
      const dist=Math.sqrt(dx*dx+dz*dz);
      if(dist>1.6&&dist<5) { cart.x+=dx/dist*1.5*dt; cart.z+=dz/dist*1.5*dt; }
      cart.y = FLOOR_Y;
    }

    // Pulse outlines
    const pulse = 0.35 + Math.sin(this._elapsedMs*0.003)*0.3;
    this._items.forEach(e => {
      if(!e.picked && e.mesh.userData.outline)
        e.mesh.userData.outline.material.opacity = pulse;
    });

    // Checkout proximity
    const playerPos = this.fp.pos;
    const nearCheckout = playerPos.distanceTo(CHECKOUT_POS) < CHECKOUT_RADIUS;
    const hov = this.interactor.update(this.interactables);

    if(nearCheckout && this._checkoutReady && !this._checkoutDone) {
      this.engine.hud.showPrompt(`✦ [E] Pay at checkout — $${this._spentAmount().toFixed(2)}`);
      this.engine.hud.crosshairColor('#e8c040');
      return;
    }
    if(hov && hov.userData.isItem) {
      const listEntry = this._items.find(e=>e.mesh===hov);
      if(listEntry && !listEntry.picked) {
        const would = (this._spentAmount()+listEntry.def.price).toFixed(2);
        this.engine.hud.showPrompt(`[E] Pick up ${listEntry.def.label} — $${listEntry.def.price.toFixed(2)} (total $${would})`);
        this.engine.hud.crosshairColor('#ffd700');
        return;
      }
      const fillerEntry = this._fillerItems.find(e=>e.mesh===hov);
      if(fillerEntry && !fillerEntry.picked) {
        const would = (this._spentAmount()+fillerEntry.def.price).toFixed(2);
        this.engine.hud.showPrompt(`[E] Buy ${fillerEntry.def.label} — $${fillerEntry.def.price.toFixed(2)} (total $${would})`);
        this.engine.hud.crosshairColor('#c8e890');
        return;
      }
    }
    if(this._checkoutReady && !this._checkoutDone && !nearCheckout) {
      this.engine.hud.showPrompt('✦ All items gathered — head to the checkout!');
      this.engine.hud.crosshairColor('white');
      return;
    }
    this.engine.hud.hidePrompt();
    this.engine.hud.crosshairColor('white');
  }

  // ─────────────────────────────────────────────────────────
  onInteract() {
    if(this.fp.pos.distanceTo(CHECKOUT_POS) < CHECKOUT_RADIUS && this._checkoutReady && !this._checkoutDone) {
      this._doCheckout(); return;
    }
    this.interactor.interact(this.interactables);
  }
}