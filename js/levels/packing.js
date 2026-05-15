// ============================================================
//  STARRY PICNIC — levels/packing.js  (FIXED + REDESIGNED)


import { packingBackground } from '../backgrounds.js';
import * as THREE from 'three';
import { Level, Anime, Build, FPController, Interactor } from '../engine.js';

// ─────────────────────────────────────────────────────────────
//  ITEMS — finished picnic goods
// ─────────────────────────────────────────────────────────────
const PACK_ITEMS = [
  { id:'sandwich',  label:'🥪 Sandwich',      color:0xf0c060, w:2, h:1, d:2, shape:'box' },
  { id:'lemonade',  label:'🍋 Lemonade Jug',  color:0xffee44, w:1, h:2, d:1, shape:'cyl' },
  { id:'cookies',   label:'🍪 Cookie Tin',    color:0x885533, w:1, h:1, d:1, shape:'cyl' },
  { id:'juice',     label:'🧃 Juice Carton',  color:0xff8800, w:1, h:2, d:1, shape:'box' },
  { id:'chocolate', label:'🍫 Choco Bar',     color:0x5c2e00, w:2, h:1, d:1, shape:'box' },
  { id:'veggies',   label:'🥗 Veggie Box',    color:0x44cc66, w:2, h:1, d:2, shape:'box' },
  { id:'crisps',    label:'🥨 Crisps Bag',    color:0xee9922, w:1, h:2, d:1, shape:'box' },
  { id:'blanket',   label:'🧺 Blanket Roll',  color:0xcc88ff, w:2, h:1, d:3, shape:'box' },
];

const GRID_W  = 4, GRID_D = 4, GRID_H = 4;
const CELL    = 0.28;

// Basket sits on a side table to the left; items spread on the central dining table
const BASKET_X = -1.2, BASKET_Z = -2.8;
const TABLE_X  =  1.0, TABLE_Z  = -2.0;  // item display table

// ─────────────────────────────────────────────────────────────
export class Packing extends Level {
// ─────────────────────────────────────────────────────────────

  constructor(engine) {
    super(engine);
    this.fp         = new FPController(this.camera, engine.input);
    this.fp.speed   = 3.2;
    this.interactor = new Interactor(this.camera, this.scene);

    this._held         = null;
    this._placed       = [];
    this._grid         = [];
    this._itemMeshes   = [];
    this._placedMeshes = [];
    this._ghostMesh    = null;
    this._currentCell  = null;
    // BUG FIX 1: separate raycast mesh (visible:true, opacity:0)
    this._basketRayMesh = null;
    this._done         = false;

    this._initGrid();
  }

  _initGrid() {
    this._grid = [];
    for(let x=0;x<GRID_W;x++){ this._grid[x]=[];
      for(let y=0;y<GRID_H;y++){ this._grid[x][y]=[];
        for(let z=0;z<GRID_D;z++) this._grid[x][y][z]=false; } }
  }

  // ══════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════
  init() {
    const s = this.scene;
    s.background = new THREE.Color(0x2d1f3a);
    // No fog — crisp interior
    s.fog = null;

    this._buildRoom(s);
    this._buildBasketTable(s);
    this._buildBasket(s);
    this._buildItemTable(s);
    this._buildGhost(s);
    this._buildGridOverlay(s);
    this._buildDecor(s);
  }

  // ── Room (dark living room) ───────────────────────────────
  _buildRoom(s) {
    // Dark herringbone parquet floor
    const floorGeo = new THREE.PlaneGeometry(24, 20);
    const floor = new THREE.Mesh(floorGeo, Anime.mat(0xBA7A45));
    floor.rotation.x = -Math.PI/2; floor.position.y = 0; s.add(floor);

    // Parquet pattern tiles
    const tileGeo = new THREE.PlaneGeometry(0.44, 0.44);
    for(let tx=-11;tx<=11;tx+=1) for(let tz=-9;tz<=9;tz+=1){
      const shade = ((tx+tz)%2===0) ? 0x6b4a2e : 0x5a3c22;
      const m = new THREE.Mesh(tileGeo, Anime.mat(shade));
      m.rotation.x = -Math.PI/2;
      m.position.set(tx*0.46, 0.001, tz*0.46);
      if((tx+tz)%2===0) m.rotation.z = Math.PI/2;
      s.add(m);
    }

    const wallColor = 0x91432D
     ;    //
    const wallMat   = Anime.mat(wallColor);
    const walls = [
      [0,   2, -9.5, 24, 4.2, 0.18],  // back
      [0,   2,  9.5, 24, 4.2, 0.18],  // front
      [-12, 2,  0,   0.18, 4.2, 19],  // left
      [ 12, 2,  0,   0.18, 4.2, 19],  // right
    ];
    walls.forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
      m.position.set(x,y,z); m.receiveShadow=true; s.add(m);
      this.collidables.push(new THREE.Box3(
        new THREE.Vector3(x-w/2,0,z-d/2),
        new THREE.Vector3(x+w/2,h,z+d/2)));
    });

    // Floral wallpaper appliqué — rose clusters on back wall
    this._addFloralWallpaper(s);

    // Dark wainscoting / dado rail
    const dado = new THREE.Mesh(new THREE.BoxGeometry(24.1, 0.06, 0.12), Anime.mat(0xb89060));
    dado.position.set(0, 0.92, -9.44); s.add(dado);
    const dadoPanel = new THREE.Mesh(new THREE.BoxGeometry(24.1, 0.92, 0.10), Anime.mat(0x63241D));
    dadoPanel.position.set(0, 0.46, -9.45); s.add(dadoPanel);

    // Crown moulding
    const crown = new THREE.Mesh(new THREE.BoxGeometry(24.1, 0.10, 0.14), Anime.mat(0xc8a060));
    crown.position.set(0, 4.02, -9.44); s.add(crown);

    // Ceiling — dark coffered look
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24, 20), Anime.mat(0x1e1628));
    ceil.rotation.x = Math.PI/2; ceil.position.set(0, 4.2, 0); s.add(ceil);

    // Coffered ceiling beams
    for(let bx=-8;bx<=8;bx+=4){
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 20), Anime.mat(0x5a3a50));
      beam.position.set(bx, 4.11, 0); s.add(beam);
    }
    for(let bz=-8;bz<=8;bz+=4){
      const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 0.16, 0.14), Anime.mat(0x5a3a50));
      beam.position.set(0, 4.11, bz); s.add(beam);
    }

    // Warm ambient & key lights — no fog, just candlelight glow
    const ambient = new THREE.AmbientLight(0xfff0f5, 5.5);  // soft lavender ambient — much brighter
    s.add(ambient);

    // Main chandelier
    const chandelierLight = new THREE.PointLight(0xffe8c0, 9.0, 35);
    chandelierLight.position.set(0, 3.8, -1); s.add(chandelierLight);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6),
      new THREE.MeshBasicMaterial({color:0xffe8a0}));
    bulb.position.set(0, 3.6, -1); s.add(bulb);

    // Chandelier arms
    const chandArm = Anime.mat(0x8b6914);
    for(let a=0;a<6;a++){
      const angle = (a/6)*Math.PI*2;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.5,6), chandArm);
      arm.rotation.z = Math.PI/2;
      arm.position.set(Math.cos(angle)*0.28, 3.65, -1+Math.sin(angle)*0.28);
      arm.rotation.z = Math.atan2(Math.sin(angle)*0.28, 0.28) - Math.PI/2;
      s.add(arm);
      const candleLight = new THREE.PointLight(0xffc870, 0.6, 4);
      candleLight.position.set(Math.cos(angle)*0.3, 3.5, -1+Math.sin(angle)*0.3);
      s.add(candleLight);
    }

    // Side sconces on walls
    [[-8,-2.5],[-8,3],[8,-2.5],[8,3]].forEach(([x,z]) => {
      const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.09,6,5),
        new THREE.MeshBasicMaterial({color:0xffeea0}));
      sconce.position.set(x>0?11.6:-11.6, 2.4, z); s.add(sconce);
      const sl = new THREE.PointLight(0xffcc88, 3.5, 14);
      sl.position.set(x>0?11.2:-11.2, 2.4, z); s.add(sl);
    });

    // Fireplace on right wall
    this._buildFireplace(s);
  }

  // ── Floral wallpaper (botanical roses) ───────────────────
  _addFloralWallpaper(s) {
    // Rose-shaped clusters using octahedra + small spheres
    const rosePositions = [];
    for(let rx=-9;rx<=9;rx+=2.8) for(let ry=1.1;ry<=3.8;ry+=1.6){
      rosePositions.push([rx, ry, -9.35]);
    }
    rosePositions.forEach(([rx,ry,rz]) => {
      // Petals
      const petalColors = [0xe8799a, 0xf0a0b8, 0xf5bece, 0xdda0b4, 0xffcce0];
      for(let p=0;p<6;p++){
        const angle = (p/6)*Math.PI*2;
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.08+Math.random()*0.03, 6, 4),
          Anime.mat(petalColors[p%petalColors.length]));
        petal.position.set(
          rx + Math.cos(angle)*0.10 + (Math.random()-0.5)*0.04,
          ry + Math.sin(angle)*0.09 + (Math.random()-0.5)*0.04,
          rz);
        petal.scale.set(1, 0.65, 0.3);
        s.add(petal);
      }
      // Center
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.065,8,6), Anime.mat(0xffe070));
      center.position.set(rx, ry, rz); center.scale.z=0.3; s.add(center);
      // Leaves
      for(let l=0;l<2;l++){
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07,6,4), Anime.mat(0x7aaa6a));
        leaf.position.set(rx+(l===0?-0.15:0.18), ry-0.12+(l*0.08), rz);
        leaf.scale.set(0.5,1.3,0.3); s.add(leaf);
      }
    });

    // Vine tendrils — soft sage green
    for(let vx=-8;vx<=8;vx+=1.4){
      const vine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 2.6, 4),
        Anime.mat(0x7aaa6a));
      vine.position.set(vx, 2.4, -9.36);
      vine.rotation.z = Math.sin(vx)*0.3;
      s.add(vine);
    }
  }

  // ── Fireplace ─────────────────────────────────────────────
  _buildFireplace(s) {
    const fm = Anime.mat(0x4a2e40);
    // Mantle surround
    const surround = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.22), fm);
    surround.position.set(11.0, 1.4, 2); s.add(surround);
    // Opening (dark recess)
    const opening = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.26), Anime.mat(0x1a1020));
    opening.position.set(11.0, 0.9, 2); s.add(opening);
    // Mantle shelf
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.4), Anime.mat(0x5c3a1a));
    shelf.position.set(11.0, 2.82, 2); s.add(shelf); Anime.outline(shelf, 0.02);
    // Fire glow
    const fireGlow = new THREE.PointLight(0xff8840, 3.2, 10);
    fireGlow.position.set(10.7, 0.8, 2); s.add(fireGlow);
    // Animated ember mesh
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.22,8,6),
      new THREE.MeshBasicMaterial({color:0xff4400}));
    ember.position.set(10.85, 0.55, 2); s.add(ember);
    this._fireGlow = fireGlow; this._fireT = 0;
    // Mantle decor: candlesticks
    [[10.5,2.88],[11.5,2.88]].forEach(([x,z]) => {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.03,0.3,8), Anime.mat(0xd4af37));
      stick.position.set(x,3.0,z); s.add(stick); Anime.outline(stick,0.01);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.04,6,4), new THREE.MeshBasicMaterial({color:0xffee44}));
      flame.position.set(x,3.18,z); s.add(flame);
      const cl = new THREE.PointLight(0xffcc44,0.5,2);
      cl.position.set(x,3.2,z); s.add(cl);
    });
  }

  // ── Basket table (left side) ──────────────────────────────
  _buildBasketTable(s) {
    // Round side table — dark walnut
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.07, 20), Anime.mat(0x5c3018));
    top.position.set(BASKET_X, 0.88, BASKET_Z); s.add(top); Anime.outline(top, 0.025);
    // Lace doily
    const doily = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.01, 24), Anime.mat(0xf5f0e8));
    doily.position.set(BASKET_X, 0.895, BASKET_Z); s.add(doily);
    // Turned legs
    const legMat = Anime.mat(0x6a3820);
    [[0.44,0],[-0.22,0.38],[-0.22,-0.38]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.88,8), legMat);
      leg.position.set(BASKET_X+lx, 0.44, BASKET_Z+lz); s.add(leg);
    });
    this.collidables.push(new THREE.Box3(
      new THREE.Vector3(BASKET_X-0.72,0,BASKET_Z-0.72),
      new THREE.Vector3(BASKET_X+0.72,0.89,BASKET_Z+0.72)));
  }

  // ── Basket ────────────────────────────────────────────────
  _buildBasket(s) {
    const bw = GRID_W*CELL+0.10, bd = GRID_D*CELL+0.10, bh = GRID_H*CELL;
    const basY = 0.95;

    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(bw,0.06,bd), Anime.mat(0x7a4a18));
    base.position.set(BASKET_X, basY, BASKET_Z); s.add(base); Anime.outline(base, 0.03);

    // Woven walls
    const wallDefs = [
      [BASKET_X,          basY+bh/2, BASKET_Z-bd/2, bw,  bh,   0.055],
      [BASKET_X,          basY+bh/2, BASKET_Z+bd/2, bw,  bh,   0.055],
      [BASKET_X-bw/2,     basY+bh/2, BASKET_Z,      0.055, bh, bd  ],
      [BASKET_X+bw/2,     basY+bh/2, BASKET_Z,      0.055, bh, bd  ],
    ];
    wallDefs.forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), Anime.mat(0x9a6828));
      m.position.set(x,y,z); m.castShadow=true; s.add(m); Anime.outline(m, 0.03);
    });
    // Weave bands
    for(let wy=0;wy<GRID_H;wy++){
      const band = new THREE.Mesh(new THREE.BoxGeometry(bw+0.05,0.04,bd+0.05),
        Anime.mat(wy%2===0 ? 0xaa7830 : 0x8a5818));
      band.position.set(BASKET_X, basY+0.03+wy*CELL, BASKET_Z); s.add(band);
    }
    // Vertical slats
    for(let vx=0;vx<=GRID_W;vx++){
      const ox = BASKET_X-bw/2+vx*(bw/GRID_W);
      [BASKET_Z-bd/2, BASKET_Z+bd/2].forEach(wz => {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.025,bh,0.06), Anime.mat(0x7a4818));
        slat.position.set(ox, basY+bh/2, wz); s.add(slat);
      });
    }
    // Rim
    const rim = new THREE.Mesh(new THREE.BoxGeometry(bw+0.12,0.075,bd+0.12), Anime.mat(0xc8a030));
    rim.position.set(BASKET_X, basY+bh+0.037, BASKET_Z); s.add(rim); Anime.outline(rim, 0.03);
    // Handle
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(bw*0.38, 0.048, 8, 24, Math.PI),
      Anime.mat(0x9a6828));
    handle.rotation.z = Math.PI; handle.rotation.y = Math.PI/2;
    handle.position.set(BASKET_X, basY+bh+0.25, BASKET_Z);
    s.add(handle); Anime.outline(handle, 0.04);

    // ── BUG FIX 1: Raycast mesh must be visible:true ───────
    // Use a fully transparent (opacity near 0) material so it's
    // invisible to the eye but NOT skipped by the raycaster.
    this._basketRayMesh = new THREE.Mesh(
      new THREE.BoxGeometry(bw+0.04, bh+0.15, bd+0.04),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.001,   // effectively invisible but raycaster sees it
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this._basketRayMesh.position.set(BASKET_X, basY+bh/2, BASKET_Z);
    s.add(this._basketRayMesh);
    this._basketRayMesh.userData.isBasket = true;
    this.interactables.push(this._basketRayMesh);

    Build.label(s, '🧺 Pack items here',
      BASKET_X, basY+bh+0.65, BASKET_Z, '#ffd4a0', 'rgba(30,10,5,0.90)');
  }

  // ── Grid overlay ──────────────────────────────────────────
  _buildGridOverlay(s) {
    const basY = 0.95 + 0.06;
    const mat = new THREE.LineBasicMaterial({color:0xd4a040,transparent:true,opacity:0.25});
    const ox = BASKET_X - GRID_W*CELL/2, oz = BASKET_Z - GRID_D*CELL/2;
    const pts = [];
    for(let x=0;x<=GRID_W;x++){
      pts.push(ox+x*CELL, basY, oz,  ox+x*CELL, basY, oz+GRID_D*CELL);
    }
    for(let z=0;z<=GRID_D;z++){
      pts.push(ox, basY, oz+z*CELL,  ox+GRID_W*CELL, basY, oz+z*CELL);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts),3));
    s.add(new THREE.LineSegments(geo, mat));
  }

  // ── Ghost mesh ────────────────────────────────────────────
  _buildGhost(s) {
    this._ghostMesh = new THREE.Mesh(
      new THREE.BoxGeometry(CELL, CELL, CELL),
      new THREE.MeshBasicMaterial({
        color: 0x88ffbb, transparent: true, opacity: 0.40,
        wireframe: false, depthWrite: false,
      }));
    this._ghostMesh.visible = false; s.add(this._ghostMesh);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),
      new THREE.LineBasicMaterial({color:0x44ff88, transparent:true, opacity:0.75}));
    this._ghostMesh.add(edges);
    this._ghostEdges = edges;
  }

  // ── Item display table (centre of room) ───────────────────
  _buildItemTable(s) {
    // Large rectangular dining table — dark mahogany
    const tabTop = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.8), Anime.mat(0x5c2e18));
    tabTop.position.set(TABLE_X, 0.88, TABLE_Z); s.add(tabTop); Anime.outline(tabTop, 0.03);
    // Table cloth — deep burgundy with gold border
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.015, 1.9), Anime.mat(0xb06080));
    cloth.position.set(TABLE_X, 0.945, TABLE_Z); s.add(cloth);
    // Gold border strips
    [[TABLE_X, 0.95, TABLE_Z-0.95, 3.7, 0.01, 0.04],
     [TABLE_X, 0.95, TABLE_Z+0.95, 3.7, 0.01, 0.04],
     [TABLE_X-1.85, 0.95, TABLE_Z, 0.04, 0.01, 1.9],
     [TABLE_X+1.85, 0.95, TABLE_Z, 0.04, 0.01, 1.9],
    ].forEach(([x,y,z,w,h,d]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), Anime.mat(0xc8a020));
      b.position.set(x,y,z); s.add(b);
    });
    // Turned legs
    const legMat = Anime.mat(0x1e0a04);
    [[-1.6,-0.78],[1.6,-0.78],[-1.6,0.78],[1.6,0.78]].forEach(([lx,lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,0.88,8), legMat);
      leg.position.set(TABLE_X+lx, 0.44, TABLE_Z+lz); s.add(leg);
    });
    this.collidables.push(new THREE.Box3(
      new THREE.Vector3(TABLE_X-1.8,0,TABLE_Z-0.92),
      new THREE.Vector3(TABLE_X+1.8,0.90,TABLE_Z+0.92)));

    // Centrepiece — flower vase
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.09,0.32,12), Anime.mat(0x1a3a5a));
    vase.position.set(TABLE_X, 1.10, TABLE_Z); s.add(vase); Anime.outline(vase, 0.02);
    // Flowers in vase
    const flowerColors = [0xcc2244, 0xff6688, 0xff88aa, 0xffccdd, 0xffd700];
    for(let f=0;f<7;f++){
      const angle = (f/7)*Math.PI*2;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.28,4), Anime.mat(0x2a6a18));
      stem.position.set(TABLE_X+Math.cos(angle)*0.04, 1.22, TABLE_Z+Math.sin(angle)*0.04);
      s.add(stem);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.045+Math.random()*0.02,8,6),
        Anime.mat(flowerColors[f%flowerColors.length]));
      bloom.position.set(TABLE_X+Math.cos(angle)*0.06, 1.37+Math.random()*0.06, TABLE_Z+Math.sin(angle)*0.06);
      s.add(bloom);
    }

    Build.label(s, '← Pick up items from here',
      TABLE_X, 1.65, TABLE_Z, '#ffd4a0', 'rgba(25,8,4,0.90)');

    this._buildItemsOnTable(s);
  }

  // ── Items laid on the table ───────────────────────────────
  _buildItemsOnTable(s) {
    // Arrange 8 items in a natural spread on the table surface
    const positions = [
      [-1.4, -0.55], [-0.75, 0.45], [-0.2, -0.50],
      [ 0.30, 0.50], [ 0.85, -0.45],[ 1.35, 0.42],
      [-1.10, 0.10], [ 1.0, -0.10],
    ];

    PACK_ITEMS.forEach((item, i) => {
      const [ox, oz] = positions[i] || [0,0];
      const mx = TABLE_X + ox;
      const mz = TABLE_Z + oz;
      const my = 0.95 + 0.12;

      const mesh = this._makeItemMesh(item, 0.19);
      mesh.position.set(mx, my, mz);
      // Slight random rotation for natural look
      mesh.rotation.y = (Math.random()-0.5)*0.9;
      mesh.castShadow = true;
      s.add(mesh); Anime.outline(mesh, 0.04);

      // Soft halo under item
      const halo = new THREE.Mesh(
        new THREE.CircleGeometry(0.14, 16),
        new THREE.MeshBasicMaterial({
          color: item.color, transparent: true,
          opacity: 0.30, side: THREE.DoubleSide,
        }));
      halo.rotation.x = -Math.PI/2;
      halo.position.set(mx, 0.951, mz);
      s.add(halo);

      Build.label(s, item.label, mx, my+0.34, mz, '#ffd4a0', 'rgba(25,8,4,0.88)');

      mesh.userData = { isPackItem:true, item, halo, picked:false };
      mesh.userData.onInteract = () => this._pickupItem(mesh);
      this._itemMeshes.push({ mesh, item, picked:false });
      this.interactables.push(mesh);
    });
  }

  // ── Decor (botanical living room) ────────────────────────
  _buildDecor(s) {
    // Large potted plant — left corner
    this._buildPottedPlant(s, -9.5, 0, 6.5, 0.9);
    this._buildPottedPlant(s, 9.0,  0, -7,  0.7);
    this._buildPottedPlant(s, -9.0, 0, -7,  0.65);

    // Botanical print frames on back wall
    const frameDefs = [[-5,2.6,-9.38,1.1,1.4], [0,2.6,-9.38,1.1,1.4], [5,2.6,-9.38,1.1,1.4]];
    frameDefs.forEach(([fx,fy,fz,fw,fh]) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(fw+0.12,fh+0.12,0.05), Anime.mat(0x4a2c0a));
      frame.position.set(fx,fy,fz); s.add(frame); Anime.outline(frame,0.02);
      const mat = new THREE.Mesh(new THREE.BoxGeometry(fw,fh,0.04), Anime.mat(0xf0ece0));
      mat.position.set(fx,fy,fz+0.01); s.add(mat);
      // Botanical sketch (green leaf shape)
      const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.2,8,6), Anime.mat(0x2a6e28));
      leaf1.position.set(fx,fy,fz+0.04); leaf1.scale.set(1.6,2.4,0.2); s.add(leaf1);
      const leaf2 = new THREE.Mesh(new THREE.SphereGeometry(0.12,8,6), Anime.mat(0x3a8a30));
      leaf2.position.set(fx+0.18,fy-0.14,fz+0.04); leaf2.scale.set(1.2,1.8,0.2); s.add(leaf2);
    });

    // Ornate rug under dining table
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), Anime.mat(0x8a3a5a));
    rug.rotation.x = -Math.PI/2; rug.position.set(TABLE_X, 0.003, TABLE_Z); s.add(rug);
    const rugBorder = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.5), Anime.mat(0xb06070));
    rugBorder.rotation.x = -Math.PI/2; rugBorder.position.set(TABLE_X, 0.004, TABLE_Z); s.add(rugBorder);
    const rugCenter = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), Anime.mat(0xc88090));
    rugCenter.rotation.x = -Math.PI/2; rugCenter.position.set(TABLE_X, 0.005, TABLE_Z); s.add(rugCenter);

    // Wingback armchair
    const chairMat = Anime.mat(0x7a5a9a);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.22,0.70), chairMat);
    seat.position.set(-8.2, 0.46, 4.5); s.add(seat); Anime.outline(seat,0.02);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.80,0.14), chairMat);
    back.position.set(-8.2, 0.92, 4.87); s.add(back); Anime.outline(back,0.02);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.28,0.65), chairMat);
    armL.position.set(-8.58, 0.63, 4.5); s.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.28,0.65), chairMat);
    armR.position.set(-7.82, 0.63, 4.5); s.add(armR);
    // Cushion
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.60,0.12,0.58), Anime.mat(0x9a3060));
    cushion.position.set(-8.2, 0.60, 4.5); s.add(cushion); Anime.outline(cushion,0.015);

    // Side cabinet / credenza
    const credenza = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.9,0.55), Anime.mat(0x4a2810));
    credenza.position.set(8.5, 0.45, 4); s.add(credenza); Anime.outline(credenza,0.03);
    // Cabinet hardware
    for(let kx=-0.5;kx<=0.5;kx+=1.0){
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025,6,6), Anime.mat(0xd4a030));
      knob.position.set(8.5+kx, 0.46, 4.27); s.add(knob);
    }
    // Items on credenza
    const vase2 = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.08,0.38,12), Anime.mat(0x2a4a2a));
    vase2.position.set(7.8, 0.94, 4); s.add(vase2); Anime.outline(vase2,0.02);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.14,12,8), Anime.mat(0x8a2020));
    bowl.position.set(9.1, 0.98, 4); bowl.scale.set(1,0.55,1); s.add(bowl); Anime.outline(bowl,0.02);

    // Clock on wall
    const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.06,24), Anime.mat(0xf0ece0));
    clockFace.rotation.x = Math.PI/2;
    clockFace.position.set(-11.86, 2.8, 0); s.add(clockFace); Anime.outline(clockFace,0.025);
    const clockRim = new THREE.Mesh(new THREE.TorusGeometry(0.28,0.04,8,24), Anime.mat(0x5c3a10));
    clockRim.rotation.x = Math.PI/2;
    clockRim.position.set(-11.83, 2.8, 0); s.add(clockRim);
  }

  // ── Potted plant ──────────────────────────────────────────
  _buildPottedPlant(s, x, y, z, scale=1) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18*scale, 0.14*scale, 0.36*scale, 12),
      Anime.mat(0xaa6848));
    pot.position.set(x, y+0.18*scale, z); s.add(pot); Anime.outline(pot,0.02*scale);
    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17*scale, 0.17*scale, 0.03*scale, 12),
      Anime.mat(0x2a1408));
    soil.position.set(x, y+0.36*scale, z); s.add(soil);
    // Stems + leaves
    const leafColors = [0x5a9e50, 0x6ab860, 0x7acc6a, 0x4e8e44];
    for(let l=0;l<7;l++){
      const angle = (l/7)*Math.PI*2;
      const ht = 0.35+Math.random()*0.55;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012*scale,0.015*scale,ht*scale,4),
        Anime.mat(0x267828));
      stem.position.set(x+Math.cos(angle)*0.06*scale, y+0.36*scale+ht*scale/2, z+Math.sin(angle)*0.06*scale);
      stem.rotation.z = Math.cos(angle)*0.4;
      stem.rotation.x = Math.sin(angle)*0.3;
      s.add(stem);
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry((0.10+Math.random()*0.08)*scale, 8, 6),
        Anime.mat(leafColors[l%leafColors.length]));
      leaf.position.set(
        x+Math.cos(angle)*(0.14+Math.random()*0.12)*scale,
        y+0.36*scale+ht*scale*0.9,
        z+Math.sin(angle)*(0.14+Math.random()*0.12)*scale);
      leaf.scale.set(1, 1.8, 0.28);
      s.add(leaf);
    }
  }

  // ── Item mesh factory ─────────────────────────────────────
  _makeItemMesh(item, size=CELL) {
    let geo;
    const s = size;
    switch(item.shape){
      case 'cyl': geo = new THREE.CylinderGeometry(s*0.44, s*0.44, s, 10); break;
      case 'sph': geo = new THREE.SphereGeometry(s*0.44, 10, 8); break;
      default:    geo = new THREE.BoxGeometry(s, s, s); break;
    }
    return new THREE.Mesh(geo, Anime.mat(item.color));
  }

  // ══════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════
  onEnter() {
    this.engine.audio.playLevelMusic('packing'); // cleanest — stops old, starts new
    this._held = null; this._placed = []; this._done = false; this._currentCell = null;
    this._placedMeshes.forEach(m => this.scene.remove(m)); this._placedMeshes = [];
    this._initGrid();
    this._itemMeshes.forEach(e => {
      e.picked = false; e.mesh.visible = true; e.mesh.userData.picked = false;
      if(e.mesh.userData.halo) e.mesh.userData.halo.visible = true;
    });
    this._ghostMesh.visible = false;
    this.fp.teleport(3, 0, 2, Math.PI*0.9);
    this.fp.speed = 3.2;
    this._updateHUD();
  }

  onExit() {
    this.engine.audio.play('musicStop');
    if(this._held){ this.scene.remove(this._held.ghost); this._held = null; }
  }

  // ══════════════════════════════════════════════════════════
  //  PICKUP
  // ══════════════════════════════════════════════════════════
  _pickupItem(mesh) {
    if(this._held) return;
    const entry = this._itemMeshes.find(e => e.mesh === mesh);
    if(!entry || entry.picked) return;
    entry.picked = true; mesh.userData.picked = true;
    mesh.visible = false;
    if(mesh.userData.halo) mesh.userData.halo.visible = false;

    const ghost = this._makeItemMesh(entry.item, CELL*0.88);
    ghost.material = ghost.material.clone();
    ghost.material.transparent = true; ghost.material.opacity = 0.75;
    this.scene.add(ghost);
    Anime.outline(ghost, 0.04);

    this._held = { entry, mesh, ghost, item: entry.item };
    this.engine.audio.play('pickup');
    this._updateHUD();
  }

  // ══════════════════════════════════════════════════════════
  //  PLACE
  // ══════════════════════════════════════════════════════════
  _tryPlace() {
    if(!this._held) return;

    if(!this._currentCell){
      this.engine.audio.play('deny');
      this.engine.hud.showPrompt('⚠️ Aim at the basket to place!');
      setTimeout(() => {
        if(!this._held) return;
        this.engine.hud.showPrompt(`Holding ${this._held.item.label} — aim at the basket`);
      }, 1400);
      return;
    }

    const {x, y, z} = this._currentCell;
    const {w:iw, h:ih, d:id_} = this._held.item;

    if(!this._canPlace(x, y, z, iw, ih, id_)){
      this.engine.audio.play('deny');
      this.engine.hud.showPrompt('⚠️ No space there — try another spot!');
      setTimeout(() => {
        if(!this._held) return;
        this.engine.hud.showPrompt(`Holding ${this._held.item.label} — aim at the basket`);
      }, 1400);
      return;
    }

    this._doPlace(x, y, z, iw, ih, id_);
  }

  _canPlace(gx, gy, gz, iw, ih, id_) {
    // BUG FIX 5: bounds check before indexing
    if(gx<0||gy<0||gz<0) return false;
    if(gx+iw>GRID_W||gy+ih>GRID_H||gz+id_>GRID_D) return false;
    for(let x=gx;x<gx+iw;x++)
    for(let y=gy;y<gy+ih;y++)
    for(let z=gz;z<gz+id_;z++){
      if(this._grid[x][y][z]) return false;
    }
    return true;
  }

  _doPlace(gx, gy, gz, iw, ih, id_) {
    for(let x=gx;x<gx+iw;x++)
    for(let y=gy;y<gy+ih;y++)
    for(let z=gz;z<gz+id_;z++)
      this._grid[x][y][z] = true;

    this._placed.push({ item: this._held.item, gx, gy, gz });

    const basY = 0.95+0.06;
    const ox = BASKET_X - GRID_W*CELL/2, oz = BASKET_Z - GRID_D*CELL/2;
    const wx = ox+(gx+iw/2)*CELL, wy = basY+(gy+ih/2)*CELL, wz = oz+(gz+id_/2)*CELL;

    const pm = this._makeItemMesh(this._held.item, CELL*0.88);
    pm.position.set(wx, wy, wz); pm.castShadow = true;
    this.scene.add(pm); Anime.outline(pm, 0.04);
    pm.scale.setScalar(0.05); pm.userData.popT = 0;
    this._placedMeshes.push(pm);

    this.scene.remove(this._held.ghost);
    // BUG FIX 4: clear held BEFORE hiding ghost to avoid flicker
    this._held = null;
    this._ghostMesh.visible = false;
    this._currentCell = null;

    this.engine.audio.play('pickup');
    this._updateHUD();
    this._checkComplete();
  }

  _checkComplete() {
    if(this._placed.length === PACK_ITEMS.length){
      this._done = true;
      setTimeout(() => this._showComplete(), 600);
    }
  }

  _showComplete() {
    this.engine.audio.play('cash');
    this.engine.hud.showOverlay(`
      <div style="font-size:48px">🧺✨</div>
      <div style="font-size:26px;font-weight:900;
        background:linear-gradient(135deg,#ffd700,#ff6688);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent">
        All Packed!</div>
      <div style="font-size:15px;color:#ddd;text-align:center;max-width:300px;line-height:1.9">
        🥪 Sandwiches ✅<br>🍋 Lemonade ✅<br>🍪 Cookies ✅<br>
        🧃 Juice ✅<br>🍫 Chocolate ✅<br>🥗 Veggies ✅<br>
        🥨 Crisps ✅<br>🧺 Blanket ✅<br>
        <span style="color:#aaffaa">Time to hit the road! 🚗</span>
      </div>
    `, 'Drive to the park! 🚗', () => this.engine.nextLevel('packing'));
  }

  // ══════════════════════════════════════════════════════════
  //  UPDATE
  // ══════════════════════════════════════════════════════════
  update(dt) {
    this.fp.update(dt, this.collidables);

    // Fire flicker
    if(this._fireGlow){
      this._fireT += dt;
      this._fireGlow.intensity = 1.8 + Math.sin(this._fireT*7.3)*0.6 + Math.sin(this._fireT*13.1)*0.3;
    }

    // ── held item bobs in front of camera ─────────────────
    if(this._held){
      const dir = new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
      const pos = this.camera.position.clone().addScaledVector(dir, 0.55);
      pos.y -= 0.10;
      this._held.ghost.position.copy(pos);
      this._held.ghost.quaternion.copy(this.camera.quaternion);
      const t = performance.now()/800;
      this._held.ghost.position.y += Math.sin(t)*0.011;
      this._held.ghost.material.opacity = 0.68 + Math.sin(t*2)*0.14;
    }

    // ── Ghost preview + currentCell (THE CORE FIX) ────────
    if(this._held){
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(0,0), this.camera);

      // BUG FIX 1: raycast against _basketRayMesh (visible:true)
      const hits = ray.intersectObject(this._basketRayMesh, false);

      if(hits.length > 0){
        const hitPt = hits[0].point;

        // BUG FIX 2: Y — when hitting a wall face of the basket,
        // wp.y may be anywhere in the basket. Clamp to [basY, basY+bh].
        const basY = 0.95 + 0.06;
        const bh   = GRID_H * CELL;
        const clampedY = Math.max(basY, Math.min(basY + bh, hitPt.y));
        const adjustedPt = hitPt.clone();
        adjustedPt.y = clampedY;

        const raw = this._worldToCell(adjustedPt);
        const {w:iw, h:ih, d:id_} = this._held.item;

        // BUG FIX 3: clamp with explicit checks, not ternary on object
        const cx = Math.max(0, Math.min(raw.x, GRID_W - iw));
        const cy = Math.max(0, Math.min(raw.y, GRID_H - ih));
        const cz = Math.max(0, Math.min(raw.z, GRID_D - id_));

        const basOx = BASKET_X - GRID_W*CELL/2;
        const basOz = BASKET_Z - GRID_D*CELL/2;

        this._ghostMesh.visible = true;
        this._ghostMesh.scale.set(iw, ih, id_);
        this._ghostMesh.position.set(
          basOx+(cx+iw/2)*CELL, basY+(cy+ih/2)*CELL, basOz+(cz+id_/2)*CELL);

        if(this._canPlace(cx, cy, cz, iw, ih, id_)){
          this._currentCell = {x:cx, y:cy, z:cz};
          this._ghostMesh.material.color.set(0x88ffbb);
          this._ghostEdges.material.color.set(0x44ff88);
        } else {
          this._currentCell = null;
          this._ghostMesh.material.color.set(0xff5544);
          this._ghostEdges.material.color.set(0xff3322);
        }
      } else {
        this._currentCell = null;
        this._ghostMesh.visible = false;
      }
    } else {
      this._currentCell = null;
      this._ghostMesh.visible = false;
    }

    // ── Pop animation for placed items ────────────────────
    this._placedMeshes.forEach(pm => {
      if(pm.userData.popT != null){
        pm.userData.popT += dt*7;
        const t = Math.min(pm.userData.popT, 1);
        const b = t < 0.65
          ? t/0.65
          : 1+(1-t)*0.20*Math.sin((t-0.65)*Math.PI/0.35);
        pm.scale.setScalar(Math.max(0.01, b));
        if(pm.userData.popT >= 1.3) delete pm.userData.popT;
      }
    });

    // ── Halo pulse ────────────────────────────────────────
    this._itemMeshes.forEach((e, i) => {
      if(e.picked || !e.mesh.userData.halo) return;
      const t = performance.now()/1000;
      e.mesh.userData.halo.material.opacity = 0.20 + Math.sin(t*2.4+i)*0.15;
    });

    // ── HUD prompts ───────────────────────────────────────
    const hov = this.interactor.update(this.interactables);
    if(this._held){
      if(this._currentCell){
        this.engine.hud.showPrompt(`[E] Place ${this._held.item.label} here`);
        this.engine.hud.crosshairColor('#88ffbb');
      } else if(hov && hov.userData.isBasket){
        this.engine.hud.showPrompt('⚠️ No space here — try a different spot');
        this.engine.hud.crosshairColor('#ff6644');
      } else {
        this.engine.hud.showPrompt(`Holding ${this._held.item.label} — aim at the basket`);
        this.engine.hud.crosshairColor('#ffd4a0');
      }
    } else if(hov && hov.userData.isPackItem && !hov.userData.picked){
      this.engine.hud.showPrompt(`[E] Pick up ${hov.userData.item.label}`);
      this.engine.hud.crosshairColor('#ffd700');
    } else {
      this.engine.hud.hidePrompt();
      this.engine.hud.crosshairColor('white');
    }
  }

  // BUG FIX 2: _worldToCell now returns 0-clamped values
  _worldToCell(wp) {
    const basY = 0.95 + 0.06;
    const ox   = BASKET_X - GRID_W*CELL/2;
    const oz   = BASKET_Z - GRID_D*CELL/2;
    return {
      x: Math.max(0, Math.floor((wp.x - ox) / CELL)),
      y: Math.max(0, Math.floor((wp.y - basY) / CELL)),
      z: Math.max(0, Math.floor((wp.z - oz) / CELL)),
    };
  }

  // ── HUD ───────────────────────────────────────────────────
  _updateHUD() {
    const done = this._placed.length, total = PACK_ITEMS.length;
    const rows = PACK_ITEMS.map(item => {
      const packed  = this._placed.some(p => p.item.id === item.id);
      const holding = this._held && this._held.item.id === item.id;
      return `<div style="opacity:${packed?0.5:1};
        text-decoration:${packed?'line-through':'none'};
        color:${packed?'#88ff88':holding?'#ffd700':'#ffd4a0'};
        font-weight:${holding?700:400}">
        ${packed?'✅':holding?'🤲':'◻'} ${item.label}
        <span style="float:right;font-size:10px;opacity:0.4">${item.w}×${item.h}×${item.d}</span>
      </div>`;
    }).join('');
    this.engine.hud.setInfo(`
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#ffd700">
        🧺 Packing (${done}/${total})</div>
      ${rows}
      <div style="font-size:11px;opacity:0.45;margin-top:6px">
        E = grab · aim at basket · E = place</div>`);
  }

  onInteract() {
    if(this._done) return;
    if(this._held){ this._tryPlace(); return; }
    const hov = this.interactor.update(this.interactables);
    if(hov && hov.userData.isPackItem && !hov.userData.picked) this._pickupItem(hov);
  }
}