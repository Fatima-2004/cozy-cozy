// ============================================================
//  STARRY PICNIC — levels/packing.js
//
//  FIX: items can only be placed when you're LOOKING at the
//  basket. _currentCell tracks the ghost cell; onInteract()
//  places there, or denies if the crosshair isn't on the basket.
//
//  Items are finished picnic goods (not raw ingredients).
// ============================================================

import { packingBackground } from '../backgrounds.js';
import * as THREE from 'three';
import { Level, Anime, Build, FPController, Interactor } from '../engine.js';

// ─────────────────────────────────────────────────────────────
//  ITEMS — finished picnic goods bought / prepared
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
const BASKET_X = 0, BASKET_Z = -3;

// ─────────────────────────────────────────────────────────────
export class Packing extends Level {
// ─────────────────────────────────────────────────────────────

  constructor(engine) {
    super(engine);
    this.fp         = new FPController(this.camera, engine.input);
    this.fp.speed   = 3.2;
    this.interactor = new Interactor(this.camera, this.scene);

    this._held         = null;   // { entry, ghost, item }
    this._placed       = [];     // { item, gx, gy, gz }
    this._grid         = [];
    this._itemMeshes   = [];     // { mesh, item, picked }
    this._placedMeshes = [];
    this._ghostMesh    = null;
    this._currentCell  = null;   // ← THE FIX: only valid when crosshair hits basket
    this._basketTrig   = null;
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

    s.background = new THREE.Color(0xffe8f0);
    this._sky = packingBackground(this.scene);


    this._buildRoom(s);
    this._buildTable(s);
    this._buildBasket(s);
    this._buildItemShelf(s);
    this._buildGhost(s);
    this._buildGridOverlay(s);
    this._buildDecor(s);
  }

  // ── Room ──────────────────────────────────────────────────
  _buildRoom(s) {
    Build.floor(s, 0xf5eaff, 22, 18);
    const geo=new THREE.PlaneGeometry(1.8,1.8);
    for(let tx=-6;tx<=6;tx++) for(let tz=-5;tz<=5;tz++){
      const m=new THREE.Mesh(geo,Anime.mat((tx+tz)%2===0?0xf0e4fc:0xe8dcf5));
      m.rotation.x=-Math.PI/2; m.position.set(tx*1.8,0.002,tz*1.8); s.add(m);
    }
    const wm=Anime.mat(0xfce8ff);
    [[0,2,-9,22,4,0.2],[0,2,9,22,4,0.2],[-11,2,0,0.2,4,18],[11,2,0,0.2,4,18]]
      .forEach(([x,y,z,w,h,d])=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wm);
        m.position.set(x,y,z); m.receiveShadow=true; s.add(m);
        this.collidables.push(new THREE.Box3(
          new THREE.Vector3(x-w/2,0,z-d/2),new THREE.Vector3(x+w/2,h,z+d/2)));
      });
    const ceil=new THREE.Mesh(new THREE.PlaneGeometry(22,18),Anime.mat(0xfff8ff));
    ceil.rotation.x=Math.PI/2; ceil.position.set(0,4,0); s.add(ceil);

    // pendant light
    const pendant=new THREE.Mesh(new THREE.SphereGeometry(0.18,8,6),
      new THREE.MeshBasicMaterial({color:0xffee99}));
    pendant.position.set(0,3.4,0); s.add(pendant);
    const rl=new THREE.PointLight(0xffeecc,2.5,20); rl.position.set(0,3.2,0); s.add(rl);

    // wallpaper stars
    for(let i=0;i<20;i++){
      const st=new THREE.Mesh(new THREE.OctahedronGeometry(0.08,0),Anime.mat(0xffccff));
      const a=Math.random()*Math.PI*2;
      st.position.set(Math.cos(a)*9.5,1+Math.random()*2.5,Math.sin(a)*8.5);
      st.rotation.set(Math.random(),Math.random(),Math.random()); s.add(st);
    }
  }

  // ── Table ─────────────────────────────────────────────────
  _buildTable(s) {
    const top=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.09,2.4),Anime.mat(0xddbbee));
    top.position.set(BASKET_X,0.9,BASKET_Z); s.add(top); Anime.outline(top,0.03);
    // table cloth drape
    const cloth=new THREE.Mesh(new THREE.BoxGeometry(2.55,0.015,2.55),
      Anime.mat(0xffeeff,0.9));
    cloth.position.set(BASKET_X,0.948,BASKET_Z); s.add(cloth);
    const legGeo=new THREE.CylinderGeometry(0.055,0.055,0.9,8);
    const lm=Anime.mat(0xcc99dd);
    [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([lx,lz])=>{
      const leg=new THREE.Mesh(legGeo,lm);
      leg.position.set(BASKET_X+lx*0.95,0.45,BASKET_Z+lz*0.95); s.add(leg);
    });
    this.collidables.push(new THREE.Box3(
      new THREE.Vector3(BASKET_X-1.2,0,BASKET_Z-1.2),
      new THREE.Vector3(BASKET_X+1.2,0.91,BASKET_Z+1.2)));
  }

  // ── Basket ────────────────────────────────────────────────
  _buildBasket(s) {
    const bw=GRID_W*CELL+0.10, bd=GRID_D*CELL+0.10, bh=GRID_H*CELL;
    const basY=0.95;

    // base
    const base=new THREE.Mesh(new THREE.BoxGeometry(bw,0.06,bd),Anime.mat(0xb07030));
    base.position.set(BASKET_X,basY,BASKET_Z); s.add(base); Anime.outline(base,0.03);

    // woven walls — alternating horizontal strip colours
    const wallDefs=[
      [0,          basY+bh/2, BASKET_Z-bd/2,  bw,  bh, 0.055],
      [0,          basY+bh/2, BASKET_Z+bd/2,  bw,  bh, 0.055],
      [BASKET_X-bw/2, basY+bh/2, BASKET_Z, 0.055, bh, bd],
      [BASKET_X+bw/2, basY+bh/2, BASKET_Z, 0.055, bh, bd],
    ];
    wallDefs.forEach(([x,y,z,w,h,d])=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),Anime.mat(0xc8944a));
      m.position.set(x,y,z); m.castShadow=true; s.add(m); Anime.outline(m,0.03);
    });
    // horizontal weave bands
    for(let wy=0;wy<GRID_H;wy++){
      const band=new THREE.Mesh(new THREE.BoxGeometry(bw+0.05,0.04,bd+0.05),
        Anime.mat(wy%2===0?0xd4a855:0xb87830));
      band.position.set(BASKET_X,basY+0.03+wy*CELL,BASKET_Z); s.add(band);
    }
    // vertical weave slats
    for(let vx=0;vx<=GRID_W;vx++){
      const ox=BASKET_X-bw/2+vx*(bw/GRID_W);
      [BASKET_Z-bd/2,BASKET_Z+bd/2].forEach(wz=>{
        const slat=new THREE.Mesh(new THREE.BoxGeometry(0.025,bh,0.06),Anime.mat(0xaa6820));
        slat.position.set(ox,basY+bh/2,wz); s.add(slat);
      });
    }

    // rim
    const rim=new THREE.Mesh(new THREE.BoxGeometry(bw+0.12,0.075,bd+0.12),Anime.mat(0xffdd88));
    rim.position.set(BASKET_X,basY+bh+0.037,BASKET_Z); s.add(rim); Anime.outline(rim,0.03);

    // handle
    const handle=new THREE.Mesh(
      new THREE.TorusGeometry(bw*0.38,0.048,8,24,Math.PI),
      Anime.mat(0xc8944a));
    handle.rotation.z=Math.PI; handle.rotation.y=Math.PI/2;
    handle.position.set(BASKET_X,basY+bh+0.25,BASKET_Z);
    s.add(handle); Anime.outline(handle,0.04);

    // ── BASKET TRIGGER (placement detection) ─────────────
    // Slightly larger than interior so raycasts hit reliably
    this._basketTrig=new THREE.Mesh(
      new THREE.BoxGeometry(bw+0.04,bh+0.2,bd+0.04),
      new THREE.MeshBasicMaterial({visible:false}));
    this._basketTrig.position.set(BASKET_X,basY+bh/2,BASKET_Z);
    s.add(this._basketTrig);
    this._basketTrig.userData.isBasket=true;
    this.interactables.push(this._basketTrig);

    // label
    Build.label(s,'🧺 Pack items here',BASKET_X,basY+bh+0.7,BASKET_Z,'#fff','rgba(80,20,120,0.88)');
  }

  // ── Grid overlay (faint cell lines inside basket) ─────────
  _buildGridOverlay(s) {
    const basY=0.95+0.06;
    const mat=new THREE.LineBasicMaterial({color:0xffddaa,transparent:true,opacity:0.30});
    const ox=BASKET_X-GRID_W*CELL/2, oz=BASKET_Z-GRID_D*CELL/2;
    const pts=[];
    for(let x=0;x<=GRID_W;x++){
      pts.push(ox+x*CELL,basY,oz, ox+x*CELL,basY,oz+GRID_D*CELL);
    }
    for(let z=0;z<=GRID_D;z++){
      pts.push(ox,basY,oz+z*CELL, ox+GRID_W*CELL,basY,oz+z*CELL);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pts),3));
    s.add(new THREE.LineSegments(geo,mat));
  }

  // ── Ghost mesh (placement preview) ────────────────────────
  _buildGhost(s) {
    this._ghostMesh=new THREE.Mesh(
      new THREE.BoxGeometry(CELL,CELL,CELL),
      new THREE.MeshBasicMaterial({
        color:0x88ffbb, transparent:true, opacity:0.42,
        wireframe:false, depthWrite:false
      }));
    this._ghostMesh.visible=false; s.add(this._ghostMesh);

    // ghost edge outline
    const edges=new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),
      new THREE.LineBasicMaterial({color:0x44ff88,transparent:true,opacity:0.7}));
    this._ghostMesh.add(edges);
    this._ghostEdges=edges;
  }

  // ── Item shelf ────────────────────────────────────────────
  _buildItemShelf(s) {
    const sx=-5.5, sz=-1;

    // shelf structure
    const sm=Anime.mat(0xddbbee);
    [0,1].forEach(row=>{
      const shelf=new THREE.Mesh(new THREE.BoxGeometry(4.2,0.07,0.55),sm);
      shelf.position.set(sx,0.82+row*1.0,sz); s.add(shelf); Anime.outline(shelf,0.03);
    });
    const back=new THREE.Mesh(new THREE.BoxGeometry(4.2,2.1,0.07),Anime.mat(0xccaadd));
    back.position.set(sx,1.05,sz+0.28); s.add(back);
    [-2.1,2.1].forEach(ox=>{
      const up=new THREE.Mesh(new THREE.BoxGeometry(0.07,2.1,0.55),sm);
      up.position.set(sx+ox,1.05,sz); s.add(up);
    });
    Build.label(s,'← Grab items from here',sx,2.3,sz,'#fff','rgba(80,20,120,0.85)');
    this.collidables.push(new THREE.Box3(
      new THREE.Vector3(sx-2.15,0,sz-0.3),
      new THREE.Vector3(sx+2.15,2.15,sz+0.35)));

    // place items on shelf
    PACK_ITEMS.forEach((item,i)=>{
      const row=Math.floor(i/4), col=i%4;
      const mx=sx-1.5+col*1.0;
      const mz=sz-0.02;
      const my=0.82+row*1.0+0.18;
      const mesh=this._makeItemMesh(item,0.22);
      mesh.position.set(mx,my,mz); mesh.castShadow=true;
      s.add(mesh); Anime.outline(mesh,0.05);

      // glow ring under item
      const ring=new THREE.Mesh(
        new THREE.RingGeometry(0.12,0.22,16),
        new THREE.MeshBasicMaterial({color:item.color,transparent:true,opacity:0.45,side:THREE.DoubleSide}));
      ring.rotation.x=-Math.PI/2;
      ring.position.set(mx,0.82+row*1.0+0.04,mz); s.add(ring);

      Build.label(s,item.label,mx,my+0.40,mz,'#fff','rgba(60,10,100,0.82)');

      mesh.userData={isPackItem:true,item,ring,picked:false};
      mesh.userData.onInteract=()=>this._pickupItem(mesh);
      this._itemMeshes.push({mesh,item,picked:false});
      this.interactables.push(mesh);
    });
  }

  // ── Room decorations ──────────────────────────────────────
  _buildDecor(s) {
    // bookshelf on right wall
    const bshelf=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.8,1.4),Anime.mat(0xddbbcc));
    bshelf.position.set(10.9,1.0,-4); s.add(bshelf);
    [[0xcc4466,0.2],[0x4466cc,0.25],[0xcc8800,0.18],[0x44aa44,0.22],[0xaa44cc,0.19]].forEach(([c,w],i)=>{
      const bk=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.32+Math.random()*0.18,w),Anime.mat(c));
      bk.position.set(10.88,0.28+i*0.32,-4.5+i*0.18); s.add(bk); Anime.outline(bk,0.015);
    });

    // picture frame on back wall
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.0,0.04),Anime.mat(0xddbbaa));
    frame.position.set(3,2.5,-8.88); s.add(frame); Anime.outline(frame,0.03);
    // painting (canvas gradient look)
    {
      const c=document.createElement('canvas'); c.width=128; c.height=96;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#88ccff'; ctx.fillRect(0,0,128,96);
      // simple sunset scene
      ctx.fillStyle='#ffcc44'; ctx.beginPath(); ctx.arc(64,55,22,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#44aa44'; ctx.fillRect(0,64,128,32);
      ctx.fillStyle='#ff8844';
      for(let cx=8;cx<120;cx+=18){ ctx.beginPath(); ctx.arc(cx,68,8,0,Math.PI*2); ctx.fill(); }
      const painting=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.85),
        new THREE.MeshBasicMaterial({map:(() => { const _t = new THREE.CanvasTexture(c); _t.channel = 0; return _t; })()}));
      painting.position.set(3,2.5,-8.86); s.add(painting);
    }

    // small side table with lamp
    const stable=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.04,16),Anime.mat(0xddbbcc));
    stable.position.set(8,0.55,-6); s.add(stable); Anime.outline(stable,0.02);
    const lamp=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.5,8),Anime.mat(0x888899));
    lamp.position.set(8,0.82,-6); s.add(lamp);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(0.22,0.26,10,1,true),Anime.mat(0xffee88));
    shade.rotation.x=Math.PI; shade.position.set(8,1.1,-6); s.add(shade); Anime.outline(shade,0.025);
    const tabLight=new THREE.PointLight(0xffeecc,0.8,5); tabLight.position.set(8,1.0,-6); s.add(tabLight);

    // rubbish bin in corner (just for vibes)
    const bin=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.12,0.4,10),Anime.mat(0x666677));
    bin.position.set(-9,0.2,7.5); s.add(bin); Anime.outline(bin,0.025);
  }

  // ── Item mesh factory ─────────────────────────────────────
  _makeItemMesh(item,size=CELL) {
    let geo;
    const s=size;
    switch(item.shape){
      case 'cyl': geo=new THREE.CylinderGeometry(s*0.44,s*0.44,s,10); break;
      case 'sph': geo=new THREE.SphereGeometry(s*0.44,10,8); break;
      default:    geo=new THREE.BoxGeometry(s,s,s); break;
    }
    return new THREE.Mesh(geo,Anime.mat(item.color));
  }

  // ══════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════
  onEnter() {
    this._held=null; this._placed=[]; this._done=false; this._currentCell=null;
    this._placedMeshes.forEach(m=>this.scene.remove(m)); this._placedMeshes=[];
    this._initGrid();
    this._itemMeshes.forEach(e=>{
      e.picked=false; e.mesh.visible=true; e.mesh.userData.picked=false;
      if(e.mesh.userData.ring) e.mesh.userData.ring.visible=true;
    });
    this._ghostMesh.visible=false;
    this.fp.teleport(-2,0,3,Math.PI*0.85); this.fp.speed=3.2;
    this.engine.audio.play('music',105);
    this._updateHUD();
  }

  onExit() {
    this.engine.audio.play('musicStop');
    if(this._held){ this._held.ghost.visible=false; this._held=null; }
  }

  // ══════════════════════════════════════════════════════════
  //  PICKUP
  // ══════════════════════════════════════════════════════════
  _pickupItem(mesh) {
    if(this._held) return;
    const entry=this._itemMeshes.find(e=>e.mesh===mesh);
    if(!entry||entry.picked) return;
    entry.picked=true; mesh.userData.picked=true;
    mesh.visible=false;
    if(mesh.userData.ring) mesh.userData.ring.visible=false;

    const ghost=this._makeItemMesh(entry.item,CELL*0.88);
    ghost.material=ghost.material.clone();
    ghost.material.transparent=true; ghost.material.opacity=0.72;
    this.scene.add(ghost);
    Anime.outline(ghost,0.04);

    this._held={entry,mesh,ghost,item:entry.item};
    this.engine.audio.play('pickup');
    this._updateHUD();
  }

  // ══════════════════════════════════════════════════════════
  //  PLACE — FIX: only places if crosshair is on the basket
  // ══════════════════════════════════════════════════════════
  _tryPlace() {
    if(!this._held) return;

    // ── GATE: must be looking at basket ───────────────────
    if(!this._currentCell){
      this.engine.audio.play('deny');
      this.engine.hud.showPrompt('⚠️ Aim at the basket to place!');
      setTimeout(()=>{ if(!this._held) return; this.engine.hud.showPrompt(`Holding ${this._held.item.label} — aim at the basket`); },1400);
      return;
    }

    const {x,y,z}=this._currentCell;
    const {w:iw,h:ih,d:id_}=this._held.item;

    if(!this._canPlace(x,y,z,iw,ih,id_)){
      this.engine.audio.play('deny');
      this.engine.hud.showPrompt('⚠️ Something is already there!');
      setTimeout(()=>{ if(!this._held) return; this.engine.hud.showPrompt(`Holding ${this._held.item.label} — aim at the basket`); },1400);
      return;
    }

    this._doPlace(x,y,z,iw,ih,id_);
  }

  _canPlace(gx,gy,gz,iw,ih,id_) {
    for(let x=gx;x<gx+iw;x++)
    for(let y=gy;y<gy+ih;y++)
    for(let z=gz;z<gz+id_;z++){
      if(x>=GRID_W||y>=GRID_H||z>=GRID_D||x<0||y<0||z<0) return false;
      if(this._grid[x][y][z]) return false;
    }
    return true;
  }

  _doPlace(gx,gy,gz,iw,ih,id_) {
    for(let x=gx;x<gx+iw;x++)
    for(let y=gy;y<gy+ih;y++)
    for(let z=gz;z<gz+id_;z++)
      this._grid[x][y][z]=true;

    this._placed.push({item:this._held.item,gx,gy,gz});

    const basY=0.95+0.06;
    const ox=BASKET_X-GRID_W*CELL/2, oz=BASKET_Z-GRID_D*CELL/2;
    const wx=ox+(gx+iw/2)*CELL, wy=basY+(gy+ih/2)*CELL, wz=oz+(gz+id_/2)*CELL;

    const pm=this._makeItemMesh(this._held.item,CELL*0.88);
    pm.position.set(wx,wy,wz); pm.castShadow=true;
    this.scene.add(pm); Anime.outline(pm,0.04);
    pm.scale.setScalar(0.05); pm.userData.popT=0;
    this._placedMeshes.push(pm);

    this.scene.remove(this._held.ghost);
    this._ghostMesh.visible=false;
    this._currentCell=null;
    this._held=null;

    this.engine.audio.play('pickup');
    this._updateHUD();
    this._checkComplete();
  }

  _checkComplete() {
    if(this._placed.length===PACK_ITEMS.length){
      this._done=true;
      setTimeout(()=>this._showComplete(),600);
    }
  }

  _showComplete() {
    this.engine.audio.play('cash');
    this.engine.hud.showOverlay(`
      <div style="font-size:48px">🧺✨</div>
      <div style="font-size:26px;font-weight:900;
        background:linear-gradient(135deg,#ffd700,#c890ff);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent">
        All Packed!</div>
      <div style="font-size:15px;color:#ddd;text-align:center;max-width:300px;line-height:1.9">
        🥪 Sandwiches ✅<br>🍋 Lemonade ✅<br>🍪 Cookies ✅<br>
        🧃 Juice ✅<br>🍫 Chocolate ✅<br>🥗 Veggies ✅<br>
        🥨 Crisps ✅<br>🧺 Blanket ✅<br>
        <span style="color:#aaffaa">Time to hit the road! 🚗</span>
      </div>
    `,'Drive to the park! 🚗',()=>this.engine.nextLevel('packing'));
  }

  // ══════════════════════════════════════════════════════════
  //  UPDATE
  // ══════════════════════════════════════════════════════════
  update(dt) {
    this._sky?.update(dt);

    this.fp.update(dt,this.collidables);

    // ── held item bobs in front of camera ─────────────────
    if(this._held){
      const dir=new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
      const pos=this.camera.position.clone().addScaledVector(dir,0.55);
      pos.y-=0.10;
      this._held.ghost.position.copy(pos);
      this._held.ghost.quaternion.copy(this.camera.quaternion);
      const t=performance.now()/800;
      this._held.ghost.position.y+=Math.sin(t)*0.011;
      this._held.ghost.material.opacity=0.68+Math.sin(t*2)*0.14;
    }

    // ── ghost preview + currentCell update ────────────────
    // THIS IS THE FIX: _currentCell is only set when crosshair
    // actually intersects the basket trigger volume.
    if(this._held){
      const ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(0,0),this.camera);
      const hits=ray.intersectObject(this._basketTrig);

      if(hits.length){
        const cell=this._worldToCell(hits[0].point);
        const iw=this._held.item.w, ih=this._held.item.h, id_=this._held.item.d;

        // clamp cell so item fits inside grid
        const cx=cell?Math.min(cell.x,GRID_W-iw):0;
        const cy=cell?Math.max(0,Math.min(cell.y,GRID_H-ih)):0;
        const cz=cell?Math.min(cell.z,GRID_D-id_):0;
        const clamped=(cx>=0&&cy>=0&&cz>=0)?{x:cx,y:cy,z:cz}:null;

        if(clamped&&this._canPlace(clamped.x,clamped.y,clamped.z,iw,ih,id_)){
          this._currentCell=clamped;
          // position ghost at that cell
          const basY=0.95+0.06;
          const ox=BASKET_X-GRID_W*CELL/2, oz=BASKET_Z-GRID_D*CELL/2;
          this._ghostMesh.visible=true;
          this._ghostMesh.scale.set(iw,ih,id_);
          this._ghostMesh.position.set(
            ox+(clamped.x+iw/2)*CELL, basY+(clamped.y+ih/2)*CELL, oz+(clamped.z+id_/2)*CELL);
          this._ghostMesh.material.color.set(0x88ffbb);
          this._ghostEdges.material.color.set(0x44ff88);
        } else {
          // occupied or out of bounds — red ghost, no valid cell
          this._currentCell=null;
          this._ghostMesh.visible=true;
          this._ghostMesh.scale.set(iw,ih,id_);
          if(clamped){
            const basY=0.95+0.06;
            const ox=BASKET_X-GRID_W*CELL/2, oz=BASKET_Z-GRID_D*CELL/2;
            this._ghostMesh.position.set(
              ox+(clamped.x+iw/2)*CELL, basY+(clamped.y+ih/2)*CELL, oz+(clamped.z+id_/2)*CELL);
          }
          this._ghostMesh.material.color.set(0xff5544);
          this._ghostEdges.material.color.set(0xff3322);
        }
      } else {
        // not looking at basket at all
        this._currentCell=null;
        this._ghostMesh.visible=false;
      }
    } else {
      this._currentCell=null;
      this._ghostMesh.visible=false;
    }

    // ── pop animation for placed items ────────────────────
    this._placedMeshes.forEach(pm=>{
      if(pm.userData.popT!=null){
        pm.userData.popT+=dt*7;
        const t=Math.min(pm.userData.popT,1);
        const b=t<0.65 ? t/0.65 : 1+(1-t/1.0)*0.20*Math.sin((t-0.65)*Math.PI/0.35);
        pm.scale.setScalar(Math.max(0.01,b));
        if(pm.userData.popT>=1.3) delete pm.userData.popT;
      }
    });

    // ── ring pulse ────────────────────────────────────────
    this._itemMeshes.forEach((e,i)=>{
      if(e.picked||!e.mesh.userData.ring) return;
      const t=performance.now()/1000;
      e.mesh.userData.ring.material.opacity=0.28+Math.sin(t*2.8+i)*0.22;
    });

    // ── HUD crosshair / prompt ────────────────────────────
    const hov=this.interactor.update(this.interactables);
    if(this._held){
      if(this._currentCell){
        this.engine.hud.showPrompt(`[E] Place ${this._held.item.label} here`);
        this.engine.hud.crosshairColor('#88ffbb');
      } else if(hov&&hov.userData.isBasket){
        this.engine.hud.showPrompt('⚠️ No space here — try a different spot');
        this.engine.hud.crosshairColor('#ff6644');
      } else {
        this.engine.hud.showPrompt(`Holding ${this._held.item.label} — aim at the basket`);
        this.engine.hud.crosshairColor('#ffdd44');
      }
    } else if(hov&&hov.userData.isPackItem&&!hov.userData.picked){
      this.engine.hud.showPrompt(`[E] Pick up ${hov.userData.item.label}`);
      this.engine.hud.crosshairColor('#ffd700');
    } else {
      this.engine.hud.hidePrompt();
      this.engine.hud.crosshairColor('white');
    }
  }

  _worldToCell(wp) {
    const basY=0.95+0.06;
    const ox=BASKET_X-GRID_W*CELL/2, oz=BASKET_Z-GRID_D*CELL/2;
    const cx=Math.floor((wp.x-ox)/CELL);
    const cy=Math.floor((wp.y-basY)/CELL);
    const cz=Math.floor((wp.z-oz)/CELL);
    return {x:Math.max(0,cx), y:Math.max(0,cy), z:Math.max(0,cz)};
  }

  // ── HUD ───────────────────────────────────────────────────
  _updateHUD() {
    const done=this._placed.length, total=PACK_ITEMS.length;
    const rows=PACK_ITEMS.map(item=>{
      const packed=this._placed.some(p=>p.item.id===item.id);
      const holding=this._held&&this._held.item.id===item.id;
      return `<div style="opacity:${packed?0.5:1};
        text-decoration:${packed?'line-through':'none'};
        color:${packed?'#88ff88':holding?'#ffd700':'#fff'};
        font-weight:${holding?700:400}">
        ${packed?'✅':holding?'🤲':'◻'} ${item.label}
        <span style="float:right;font-size:10px;opacity:0.45">${item.w}×${item.h}×${item.d}</span>
      </div>`;
    }).join('');
    this.engine.hud.setInfo(`
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#ffd700">
        🧺 Packing (${done}/${total})</div>
      ${rows}
      <div style="font-size:11px;opacity:0.5;margin-top:6px">
        E = grab · aim at basket · E = place</div>`);
  }

  onInteract() {
    if(this._done) return;
    if(this._held){ this._tryPlace(); return; }
    const hov=this.interactor.update(this.interactables);
    if(hov&&hov.userData.isPackItem&&!hov.userData.picked) this._pickupItem(hov);
  }
}