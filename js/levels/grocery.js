// ============================================================
//  STARRY PICNIC — Grocery Level
//  Compatible with engine.js (Level / FPController / Interactor)
// ============================================================

import * as THREE from 'three';
import { Level, Anime, Build, FPController, Interactor } from '../engine.js';

// ── Shopping list (8 required items) ─────────────────────────
const LIST = [
  { id:'chicken',  label:'🍗 Chicken', price:3.50, color:0xffcc88, geo:()=>new THREE.BoxGeometry(0.26,0.16,0.16) },
  { id:'bread',    label:'🍞 Bread',   price:2.00, color:0xd4933a, geo:()=>new THREE.BoxGeometry(0.16,0.24,0.20) },
  { id:'sauce',    label:'🍅 Sauce',   price:1.50, color:0xcc2222, geo:()=>new THREE.CylinderGeometry(0.06,0.07,0.26,14) },
  { id:'cucumber', label:'🥒 Cucumber',price:0.80, color:0x33aa44, geo:()=>new THREE.CylinderGeometry(0.05,0.05,0.26,10) },
  { id:'tomato',   label:'🍅 Tomato',  price:0.60, color:0xee2222, geo:()=>new THREE.SphereGeometry(0.09,12,10) },
  { id:'lettuce',  label:'🥬 Lettuce', price:1.20, color:0x44cc33, geo:()=>new THREE.SphereGeometry(0.11,12,10) },
  { id:'juice',    label:'🧃 Juice',   price:1.80, color:0xee9900, geo:()=>new THREE.BoxGeometry(0.10,0.17,0.08) },
  { id:'blanket',  label:'🧺 Blanket', price:4.00, color:0x9966cc, geo:()=>new THREE.BoxGeometry(0.20,0.10,0.14) },
];

// ── 26 filler product types packed onto every shelf ──────────
const FILLER = [
  // Cans
  { c:0xcc3333, g:()=>new THREE.CylinderGeometry(0.054,0.054,0.115,12) },
  { c:0xff5500, g:()=>new THREE.CylinderGeometry(0.054,0.054,0.130,12) },
  { c:0x2266cc, g:()=>new THREE.CylinderGeometry(0.050,0.050,0.120,12) },
  { c:0x33aacc, g:()=>new THREE.CylinderGeometry(0.048,0.050,0.105,12) },
  { c:0x229944, g:()=>new THREE.CylinderGeometry(0.052,0.052,0.118,12) },
  { c:0xaaaaaa, g:()=>new THREE.CylinderGeometry(0.050,0.050,0.112,12) },
  { c:0xcccccc, g:()=>new THREE.CylinderGeometry(0.056,0.056,0.095,12) },
  // Tall boxes / cereal
  { c:0xeedd88, g:()=>new THREE.BoxGeometry(0.130,0.195,0.070) },
  { c:0xffaa44, g:()=>new THREE.BoxGeometry(0.125,0.200,0.070) },
  { c:0xdd88ff, g:()=>new THREE.BoxGeometry(0.120,0.185,0.068) },
  // Shorter boxes
  { c:0x88ccee, g:()=>new THREE.BoxGeometry(0.115,0.130,0.080) },
  { c:0xee8899, g:()=>new THREE.BoxGeometry(0.130,0.120,0.080) },
  { c:0xaaddcc, g:()=>new THREE.BoxGeometry(0.120,0.115,0.075) },
  { c:0x774422, g:()=>new THREE.BoxGeometry(0.115,0.115,0.090) },
  { c:0xdddddd, g:()=>new THREE.BoxGeometry(0.105,0.135,0.080) },
  // Flat snack boxes
  { c:0xff9944, g:()=>new THREE.BoxGeometry(0.155,0.095,0.090) },
  { c:0x55aadd, g:()=>new THREE.BoxGeometry(0.145,0.090,0.085) },
  // Bottles
  { c:0x66bb44, g:()=>new THREE.CylinderGeometry(0.038,0.044,0.225,10) },
  { c:0xccaa33, g:()=>new THREE.CylinderGeometry(0.036,0.040,0.210,10) },
  { c:0x4499dd, g:()=>new THREE.CylinderGeometry(0.038,0.040,0.230,8)  },
  { c:0xcc4444, g:()=>new THREE.CylinderGeometry(0.040,0.046,0.185,10) },
  { c:0x222222, g:()=>new THREE.CylinderGeometry(0.036,0.038,0.240,10) },
  // Produce
  { c:0xffaa00, g:()=>new THREE.SphereGeometry(0.068,8,6) },
  { c:0xffff44, g:()=>new THREE.SphereGeometry(0.062,8,6) },
  { c:0xcc3333, g:()=>new THREE.SphereGeometry(0.070,8,6) },
  { c:0x774400, g:()=>new THREE.SphereGeometry(0.058,8,6) },
];

// Section strip labels cycling across shelf boards
const SECTIONS = [
  ['SOUPS & CANS','#b03020'],['CEREALS','#c07800'],  ['SNACKS','#207040'],
  ['BEVERAGES','#1050aa'],   ['CONDIMENTS','#993010'],['DAIRY & EGGS','#1888aa'],
  ['PASTA & RICE','#806010'],['FRESH PRODUCE','#206030'],['FROZEN','#204888'],
  ['BAKERY','#885522'],      ['HEALTH','#228866'],    ['HOUSEHOLD','#555588'],
];

const AISLE_XS = [-5, 5];
const SHELF_ZS = [-14, -10, -6, -2];
const FLOOR_Y  = 0;

// ── Small utilities ───────────────────────────────────────────
function stdMat(color, rough=0.75, metal=0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness:rough, metalness:metal });
}

function rng(a, b) { return a + Math.random() * (b - a); }

/** Return half-height of a geometry's bounding box */
function halfH(geo) {
  geo.computeBoundingBox();
  return (geo.boundingBox.max.y - geo.boundingBox.min.y) / 2;
}

/** Canvas price tag billboard */
function priceTag(scene, text, x, y, z) {
  const c = document.createElement('canvas'); c.width=128; c.height=48;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,128,48);
  ctx.strokeStyle='#c00'; ctx.lineWidth=3; ctx.strokeRect(2,2,124,44);
  ctx.fillStyle='#c00'; ctx.font='bold 22px monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,64,24);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28,0.10),
    new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false })
  );
  mesh.position.set(x,y,z); mesh.userData.isBillboard=true; scene.add(mesh);
}

/** Coloured section strip on shelf front edge */
function sectionStrip(scene, text, color, x, y, z) {
  const c = document.createElement('canvas'); c.width=256; c.height=40;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.fillRect(0,0,256,40);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 17px sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,128,20);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45,0.09),
    new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, depthWrite:false, side:THREE.DoubleSide })
  );
  mesh.position.set(x,y,z); mesh.userData.isBillboard=true; scene.add(mesh);
}

/** Overhead aisle sign */
function aisleSign(scene, text, subtext, x, z) {
  const c = document.createElement('canvas'); c.width=320; c.height=96;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#1a5c2a'; ctx.fillRect(0,0,320,96);
  ctx.fillStyle='#fff'; ctx.font='bold 24px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,160,36);
  ctx.font='15px sans-serif'; ctx.fillStyle='#aaffcc'; ctx.fillText(subtext,160,66);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1,0.63),
    new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, side:THREE.DoubleSide })
  );
  mesh.position.set(x,3.62,z); mesh.userData.isBillboard=true; scene.add(mesh);
}

// ══════════════════════════════════════════════════════════════
export class Grocery extends Level {
  constructor(engine) {
    super(engine);
    this.fp         = new FPController(this.camera, engine.input);
    this.interactor = new Interactor(this.camera, this.scene);
    this._items     = [];   // { mesh, def, picked }
    this.npcs       = [];
    this._boardList = [];   // { sx, by, rz, sd } for filler
    this._sectionCtr = 0;
    this.cartObj    = null;
    this._bobT      = 0;
  }

  // ─────────────────────────────────────────────────────────
  init() {
    const s = this.scene;
    s.background = new THREE.Color(0xd0ccc8);
    s.fog = new THREE.Fog(0xd0ccc8, 22, 60);

    s.add(new THREE.AmbientLight(0xffffff, 0.45));
    s.add(new THREE.HemisphereLight(0xffffff, 0x889977, 0.30));

    // Fluorescent ceiling strips
    [-12,-6,0].forEach(z => [-3,3].forEach(x => {
      const pl = new THREE.PointLight(0xfff8e8, 1.8, 10, 1.5);
      pl.position.set(x,3.7,z); pl.castShadow=true; pl.shadow.mapSize.setScalar(256); s.add(pl);
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.06,0.12), new THREE.MeshBasicMaterial({color:0xffffee}));
      tube.position.set(x,3.92,z); s.add(tube);
    }));

    this._buildStore(s);
    this._buildShelves(s);
    this._buildFiller(s);
    this._buildItems(s);
    this._buildCart(s);
    this._spawnNPCs(s);
    this._buildCollidables();
  }

  // ─────────────────────────────────────────────────────────
  _buildStore(s) {
    // Checkerboard floor
    const t1 = stdMat(0xc8c6c2,0.5,0.04), t2 = stdMat(0xbebbb6,0.5,0.04);
    const tGeo = new THREE.PlaneGeometry(1.6,1.6);
    for(let x=-9;x<=9;x++) for(let z=-17;z<=5;z++) {
      const m = new THREE.Mesh(tGeo,(x+z+50)%2 ? t1:t2);
      m.rotation.x=-Math.PI/2; m.position.set(x*1.6,0.001,z*1.6); m.receiveShadow=true; s.add(m);
    }

    // Ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30,28), stdMat(0xf5f5f5,1));
    ceil.rotation.x = Math.PI/2; ceil.position.set(0,4,-6); s.add(ceil);
    for(let x=-9;x<=9;x+=3) { const g=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.03,28),new THREE.MeshBasicMaterial({color:0xcccccc})); g.position.set(x,3.97,-6); s.add(g); }
    for(let z=-17;z<=5;z+=3) { const g=new THREE.Mesh(new THREE.BoxGeometry(30,0.03,0.03),new THREE.MeshBasicMaterial({color:0xcccccc})); g.position.set(0,3.97,z); s.add(g); }

    // Walls
    const wMat = new THREE.MeshStandardMaterial({color:0xc8c4be,roughness:0.95});
    [[0,2,-19,30,4,0.3],[0,2,7,30,4,0.3],[-15,2,-6,0.3,4,30],[15,2,-6,0.3,4,30]]
      .forEach(([x,y,z,w,h,d]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wMat);
        m.position.set(x,y,z); m.receiveShadow=true; s.add(m);
      });

    // Baseboards
    [[-14.95,0.1,-6],[14.95,0.1,-6]].forEach(([x,y,z]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.2,30), stdMat(0xc0b8ac,0.8));
      b.position.set(x,y,z); s.add(b);
    });

    // Aisle overhead signs
    aisleSign(s, 'AISLE 1', 'Pantry · Cans · Snacks',   AISLE_XS[0], -8);
    aisleSign(s, 'AISLE 2', 'Fresh · Frozen · Drinks', AISLE_XS[1], -8);

    // Checkout counter
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.9,0.65), stdMat(0x3d6b42,0.6));
    counter.position.set(-9,0.45,4); counter.castShadow=true; s.add(counter);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.02,0.5), stdMat(0x333344,0.9));
    belt.position.set(-9,0.91,4); s.add(belt);
    // register screen
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.35,0.28,0.04), stdMat(0x111122,0.3,0.6));
    screen.position.set(-9.5,1.18,3.72); s.add(screen);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.30,0.22),
      new THREE.MeshBasicMaterial({color:0x44ffaa,transparent:true,opacity:0.45}));
    glow.position.set(-9.5,1.18,3.70); s.add(glow);
    Build.label(s, '🛒 Checkout', -9, 1.82, 4, '#fff', 'rgba(20,80,30,0.9)');
  }

  // ─────────────────────────────────────────────────────────
  _buildShelves(s) {
    const shBk  = stdMat(0xddd0bc,0.85);
    const shBd  = stdMat(0xc8b898,0.80);
    const shSd  = stdMat(0xcfc0aa,0.85);

    AISLE_XS.forEach(ax => {
      [-1,1].forEach(sd => {
        const sx = ax + sd*1.6;
        SHELF_ZS.forEach(rz => {
          // Back panel
          const bp = new THREE.Mesh(new THREE.BoxGeometry(1.55,2.1,0.07),shBk);
          bp.position.set(sx,1.05,rz); bp.castShadow=true; bp.receiveShadow=true; s.add(bp);
          // Side panels
          [-0.78,0.78].forEach(ox => {
            const sp = new THREE.Mesh(new THREE.BoxGeometry(0.05,2.1,0.48),shSd);
            sp.position.set(sx+ox,1.05,rz+sd*0.20); s.add(sp);
          });
          // 3 usable shelf boards + 1 top rail
          [0.28,0.90,1.52,2.10].forEach((by,bi) => {
            const b = new THREE.Mesh(new THREE.BoxGeometry(1.55,0.05,0.44),shBd);
            b.position.set(sx,by,rz+sd*0.20); b.receiveShadow=true; s.add(b);
            if(bi < 3) {
              // section label strip on front edge
              const sec = SECTIONS[this._sectionCtr % SECTIONS.length];
              sectionStrip(s, sec[0], sec[1], sx, by+0.046, rz+sd*0.435);
              this._sectionCtr++;
              this._boardList.push({ sx, by, rz, sd });
            }
          });
          // Kick board
          const kick = new THREE.Mesh(new THREE.BoxGeometry(1.55,0.25,0.06),shBk);
          kick.position.set(sx,0.12,rz+sd*0.36); s.add(kick);
        });
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  /** Pack every shelf board with 6-9 filler items */
  _buildFiller(s) {
    this._boardList.forEach(({ sx, by, rz, sd }) => {
      const n = 6 + Math.floor(Math.random() * 4);
      for(let i=0; i<n; i++) {
        const fd  = FILLER[Math.floor(Math.random() * FILLER.length)];
        const geo = fd.g();
        const col = new THREE.Color(fd.c)
          .offsetHSL(rng(-0.03,0.03), rng(-0.06,0.06), rng(-0.07,0.07));
        const mat = new THREE.MeshStandardMaterial({
          color:col, roughness:rng(0.35,0.75), metalness:rng(0,0.14)
        });
        const mesh = new THREE.Mesh(geo, mat);
        const hh   = halfH(geo);
        mesh.position.set(
          (sx - 0.62) + i/(n-1)*1.24 + rng(-0.025,0.025),
          by + 0.028 + hh,
          rz + sd*0.21 + rng(-0.04,0.04)
        );
        mesh.rotation.y = rng(-0.4,0.4);
        mesh.castShadow = true;
        s.add(mesh);
        // subtle dark outline
        const om = new THREE.MeshBasicMaterial({color:0x000000,side:THREE.BackSide});
        const outMesh = new THREE.Mesh(geo, om);
        outMesh.scale.setScalar(1.04);
        mesh.add(outMesh);
      }
    });
  }

  // ─────────────────────────────────────────────────────────
  /** Place the 8 required LIST items — visually distinct with gold glow */
  _buildItems(s) {
    LIST.forEach((def, i) => {
      const ax = AISLE_XS[i % AISLE_XS.length];
      const sd = i % 2 === 0 ? -1 : 1;
      const sx = ax + sd*1.6;
      const rz = SHELF_ZS[Math.floor(i/2) % SHELF_ZS.length];
      const by = [0.28, 0.90, 1.52][Math.floor(i/4) % 3];

      const geo = def.geo();
      const hh  = halfH(geo);
      const mat = new THREE.MeshStandardMaterial({
        color:def.color, roughness:0.45, metalness:0.08,
        emissive:def.color, emissiveIntensity:0.22
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sx, by + 0.028 + hh, rz + sd*0.22);
      mesh.castShadow = true;

      // Gold pulsing outline so player can spot required items
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

      priceTag(s, `$${def.price.toFixed(2)}`, mesh.position.x, by - 0.03, mesh.position.z + sd*0.30);
    });
  }

  // ─────────────────────────────────────────────────────────
  _buildCart(s) {
    const metal = stdMat(0x9999bb,0.3,0.75);
    const g = new THREE.Group(); g.position.set(0,0,3); s.add(g); this.cartObj = g;

    const bask = new THREE.Mesh(new THREE.BoxGeometry(0.65,0.44,0.95),
      new THREE.MeshStandardMaterial({color:0xaaaacc,wireframe:true}));
    bask.position.y = 0.6; g.add(bask);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.66,0.04,0.96),metal);
    base.position.y = 0.38; g.add(base);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.66,0.05,0.05),metal);
    handle.position.set(0,0.90,-0.5); g.add(handle);

    [[-0.28,0.44],[0.28,0.44],[-0.28,-0.44],[0.28,-0.44]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03,0.38,0.03),metal);
      leg.position.set(lx,0.20,lz); g.add(leg);
    });
    [[-0.3,0.44],[0.3,0.44],[-0.3,-0.44],[0.3,-0.44]].forEach(([wx,wz]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.05,12),
        stdMat(0x222233,0.9));
      w.rotation.z = Math.PI/2; w.position.set(wx,0.08,wz); g.add(w);
    });
  }

  // ─────────────────────────────────────────────────────────
  _spawnNPCs(s) {
    [
      { type:'star',  color:0xffd700, x:-2, z:-5  },
      { type:'comet', color:0x66ddff, x: 3, z:-9  },
      { type:'star',  color:0xff88cc, x:-6, z:-13 },
    ].forEach(cfg => {
      const g = new THREE.Group(); g.position.set(cfg.x, FLOOR_Y, cfg.z); s.add(g);
      const mat = new THREE.MeshStandardMaterial({
        color:cfg.color, emissive:cfg.color, emissiveIntensity:0.55, roughness:0.4, metalness:0.1
      });
      if(cfg.type === 'star') {
        for(let p=0;p<5;p++) {
          const a = (p/5)*Math.PI*2 - Math.PI/2;
          const pt = new THREE.Mesh(new THREE.ConeGeometry(0.09,0.32,4), mat);
          pt.position.set(Math.cos(a)*0.25, 1.1+Math.sin(a)*0.25, 0);
          pt.rotation.z = -a - Math.PI/2; g.add(pt);
        }
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.09,12),mat);
        disc.rotation.x = Math.PI/2; disc.position.y = 1.1; g.add(disc);
      } else {
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2,12,10),mat);
        head.position.y = 1.1; g.add(head);
        for(let t=1;t<=6;t++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.2*(1-t/7),8,6),
            new THREE.MeshStandardMaterial({
              color:cfg.color, emissive:cfg.color, emissiveIntensity:0.4*(1-t/7),
              transparent:true, opacity:0.85-t*0.1, roughness:0.5
            }));
          seg.position.set(t*0.18, 1.1-t*0.03, 0); g.add(seg);
        }
      }
      const glow = new THREE.PointLight(cfg.color,1.5,3.0); glow.position.y=1.1; g.add(glow);
      g.userData = {
        target: new THREE.Vector3(cfg.x, FLOOR_Y, cfg.z),
        wanderTimer: Math.random()*2,
        floatT: Math.random()*Math.PI*2,
        type: cfg.type,
      };
      this.npcs.push(g);
    });
  }

  // ─────────────────────────────────────────────────────────
  /**
   * Build this.collidables as THREE.Box3 objects.
   * FPController._resolveAABB() expects box.min / box.max.
   */
  _buildCollidables() {
    // Outer walls (thin slabs)
    const wallBoxes = [
      new THREE.Box3(new THREE.Vector3(-15.5,0,-20), new THREE.Vector3(-14.5,5,8)),
      new THREE.Box3(new THREE.Vector3(14.5,0,-20),  new THREE.Vector3(15.5,5,8)),
      new THREE.Box3(new THREE.Vector3(-16,0,-20),   new THREE.Vector3(16,5,-18.5)),
      new THREE.Box3(new THREE.Vector3(-16,0,6.5),   new THREE.Vector3(16,5,8)),
    ];
    // Checkout counter
    wallBoxes.push(new THREE.Box3(new THREE.Vector3(-10.4,0,3.7), new THREE.Vector3(-7.7,1.5,4.4)));

    // Shelf units — each is ~1.6 wide, 0.5 deep
    AISLE_XS.forEach(ax => [-1,1].forEach(sd => {
      const sx = ax + sd*1.6;
      SHELF_ZS.forEach(rz => {
        wallBoxes.push(new THREE.Box3(
          new THREE.Vector3(sx - 0.82, 0, rz - 0.28),
          new THREE.Vector3(sx + 0.82, 2.2, rz + 0.28)
        ));
      });
    }));

    this.collidables = wallBoxes;
  }

  // ─────────────────────────────────────────────────────────
  onEnter() {
    this.fp.speed = 4.8;
    this.fp.teleport(0, 0, 5, Math.PI);

    // Reset items
    this._items.forEach(e => { e.picked=false; e.mesh.visible=true; });

    this.engine.hud.setInfo(`
      🛒 <b>Grocery Run</b><br>
      Pick up every item!<br>
      Budget: $20.00
    `);
  }

  // ─────────────────────────────────────────────────────────
  _pickItem(mesh) {
    const entry = this._items.find(e => e.mesh === mesh);
    if(!entry || entry.picked) return;
    entry.picked  = true;
    mesh.visible  = false;

    const picked = this._items.filter(e => e.picked).length;
    const spent  = this._items.filter(e => e.picked).reduce((s,e) => s+e.def.price, 0);

    this.engine.hud.setInfo(`
      🛒 <b>Grocery Run</b><br>
      ${picked}/${this._items.length} items<br>
      $${spent.toFixed(2)} / $20.00
    `);
    this.engine.audio.play('pickup');

    if(picked === this._items.length) {
      setTimeout(() => this.engine.nextLevel('grocery'), 800);
    }
  }

  // ─────────────────────────────────────────────────────────
  update(dt) {
    // FPController uses this.collidables (THREE.Box3 array)
    this.fp.update(dt, this.collidables);

    // ── Star / comet NPCs ─────────────────────────────────
    this.npcs.forEach(npc => {
      const ud = npc.userData;
      ud.wanderTimer -= dt;
      ud.floatT      += dt * 1.8;
      if(ud.wanderTimer <= 0) {
        ud.wanderTimer = 2 + Math.random()*3;
        ud.target.set((Math.random()-0.5)*12, FLOOR_Y, -1 - Math.random()*16);
      }
      const dir = ud.target.clone().sub(npc.position); dir.y=0;
      if(dir.length() > 0.4) {
        dir.normalize();
        npc.position.addScaledVector(dir, 1.1*dt);
        npc.rotation.y = Math.atan2(dir.x, dir.z);
      }
      npc.position.y = FLOOR_Y + 0.15 + Math.sin(ud.floatT)*0.12;
      if(ud.type === 'star') npc.rotation.z += dt*1.2;
    });

    // ── Cart follows player loosely ───────────────────────
    if(this.cartObj) {
      const cam  = this.fp.pos;
      const cart = this.cartObj.position;
      const dx   = cam.x - cart.x, dz = cam.z - cart.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      if(dist > 1.6 && dist < 5) {
        cart.x += dx/dist*1.5*dt;
        cart.z += dz/dist*1.5*dt;
      }
      cart.y = FLOOR_Y;
    }

    // ── Pulse gold outline on unpicked items ──────────────
    const pulse = 0.35 + Math.sin(this.engine.loop._last * 0.003)*0.3;
    this._items.forEach(e => {
      if(!e.picked && e.mesh.userData.outline)
        e.mesh.userData.outline.material.opacity = pulse;
    });

    // ── Hover prompt / crosshair ──────────────────────────
    const hov = this.interactor.update(this.interactables);
    if(hov && hov.userData.isItem) {
      const entry = this._items.find(e => e.mesh === hov);
      if(entry && !entry.picked) {
        this.engine.hud.showPrompt(`[E] Pick up ${entry.def.label} — $${entry.def.price.toFixed(2)}`);
        this.engine.hud.crosshairColor('#ffd700');
        return;
      }
    }
    this.engine.hud.hidePrompt();
    this.engine.hud.crosshairColor('white');
  }

  // ─────────────────────────────────────────────────────────
  onInteract() {
    // Engine fires this on E / click — delegate to Interactor
    this.interactor.interact(this.interactables);
  }
}