// ============================================================
//  STARRY PICNIC — levels/cooking.js  (clean rewrite)
//  Warm kitchen — cream walls, oak counters, cheerful lighting
// ============================================================

import * as THREE from 'three';
import { Level, Anime, Build, FPController, Interactor } from '../engine.js';

// ── Step order ────────────────────────────────────────────────
const STEP = { SEASON:0, CHICKEN:1, CHOP:2, SAUCE:3, LEMON:4, DONE:5 };

// ── Chicken colours ───────────────────────────────────────────
const RAW_COLOR    = new THREE.Color(0xffccaa);
const COOKED_COLOR = new THREE.Color(0x8b4513);

// ── Kitchen palette ───────────────────────────────────────────
const C = {
  wallMain:    0x8A8483,   // warm sand
  wallAccent:  0xBD9891,   // slightly darker dado
  floor:       0x8a6848,   // medium terracotta
  floorB:      0x9a7858,
  grout:       0x6a5038,
  counter:     0x6b4f2a,   // oak
  counterTop:  0x8a6840,
  cabinet:     0x7a5c30,
  cabinetDoor: 0x8a6a3a,
  tileLight:   0xe8f0f0,   // light mint tile
  tileDark:    0xd0e8e0,
  tileAccent:  0x9ec8b8,
  groutTile:   0xc0c8c0,
  woodOak:     0x9a7040,
  woodDark:    0x5a3a18,
  brass:       0xc8a030,
  stoveBody:   0x3a3a42,
  panBlack:    0x222228,
  skyLight:    0xd8eef8,
};

function rng(a,b){ return a+Math.random()*(b-a); }

// ── Simple particle spawner (no disposal races) ───────────────
// Particles live in a fixed pool; we reuse slots instead of
// creating/destroying meshes every frame.
class ParticlePool {
  constructor(scene, count, geo, color){
    this.slots = [];
    for(let i=0;i<count;i++){
      const m = new THREE.Mesh(
        geo instanceof THREE.BufferGeometry ? geo : geo(),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity:0})
      );
      m.visible = false;
      scene.add(m);
      this.slots.push({mesh:m, active:false, life:0, maxLife:1, vel:new THREE.Vector3(), scaleFn:null});
    }
  }
  spawn(pos, vel, maxLife, scaleFn){
    const slot = this.slots.find(s=>!s.active);
    if(!slot) return;
    slot.active = true;
    slot.life   = 0;
    slot.maxLife= maxLife;
    slot.vel.copy(vel);
    slot.scaleFn= scaleFn || (t=>1-t);
    slot.mesh.position.copy(pos);
    slot.mesh.visible = true;
    slot.mesh.material.opacity = 1;
  }
  update(dt, gravity){
    for(const s of this.slots){
      if(!s.active) continue;
      s.life += dt;
      const t = s.life/s.maxLife;
      s.vel.y += gravity * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.material.opacity = Math.max(0, s.scaleFn(t));
      if(s.life >= s.maxLife){
        s.active = false;
        s.mesh.visible = false;
        s.mesh.material.opacity = 0;
      }
    }
  }
  reset(){
    for(const s of this.slots){
      s.active = false;
      s.mesh.visible = false;
      s.mesh.material.opacity = 0;
    }
  }
}

// ─────────────────────────────────────────────────────────────
export class Cooking extends Level {
// ─────────────────────────────────────────────────────────────
  constructor(engine){
    super(engine);
    this.fp        = new FPController(this.camera, engine.input);
    this.fp.speed  = 4;
    this.interactor= new Interactor(this.camera, this.scene);
    this.step      = STEP.SEASON;

    // Season
    this._seasonCount   = 0;
    this._seasonNeeded  = 4;
    this._spiceJarMesh  = null;
    this._seasonZone    = null;
    this._rawDisplay    = null;
    this._spicePool     = null;

    // Chicken / stove
    this._cookProgress  = 0;
    this._flips         = 0;
    this._isFlipping    = false;
    this._flipT         = 0;
    this._chickenMesh   = null;
    this._burnerGlow    = null;
    this._stoveZone     = null;
    this._grillCanvas   = null;
    this._grillCtx      = null;
    this._grillTex      = null;
    this._grillMarkMesh = null;
    this._panFlashMesh  = null;
    this._panFlashT     = -1;
    this._steamPool     = null;
    this._smokePool     = null;
    this._steamOrigin   = new THREE.Vector3(-3.45,1.18,-5.70);

    // Chop
    this._chopCount   = 0;
    this._chopNeeded  = 16;
    this._vegMeshes   = [];
    this._chopPieces  = [];
    this._chopZone    = null;
    this._knifeGroup  = null;
    this._knifeT      = -1;

    // Sauce
    this._sauceCanvas   = null;
    this._sauceCtx      = null;
    this._sauceTex      = null;
    this._breadPlane    = null;
    this._sauceCoverage = 0;
    this._sauceZone     = null;
    this._brushGroup    = null;
    this._brushT        = -1;
    this._saucePool     = null;
    this._saucePaintCount = 0;
    this._breadWorldMin = new THREE.Vector3();
    this._breadWorldMax = new THREE.Vector3();

    // Lemon
    this._lemonCount   = 0;
    this._lemonNeeded  = 4;
    this._lemonMeshes  = [];
    this._lemonadeFill = 0;
    this._liqMesh      = null;
    this._lemonZone    = null;
    this._lemonPool    = null;

    // HUD
    this._mgEl    = null;
    this._mgLabel = null;
    this._mgFill  = null;

    // Misc
    this._clockHandMin = null;
    this._clockHandHr  = null;
    this._clockT       = 0;
    this._candleLights = [];
    this._raycaster    = new THREE.Raycaster();
    this._rayCenter    = new THREE.Vector2(0,0);
    this._gravity      = -2.2;
  }

  // ══════════════════════════════════════════════════════════
  init(){
    const s = this.scene;
    s.background = new THREE.Color(0x7a9ab0);
    s.fog = new THREE.Fog(0x7a9ab0, 12, 32);

    this._buildLighting(s);
    this._buildFloor(s);
    this._buildWalls(s);
    this._buildBacksplash(s);
    this._buildCounters(s);
    this._buildUpperCabinets(s);
    this._buildStove(s);
    this._buildChopStation(s);
    this._buildSauceStation(s);
    this._buildLemonStation(s);
    this._buildSeasonStation(s);
    this._buildDecor(s);
    this._buildParticlePools(s);
    this._buildMiniHUD();
  }

  // ── Lighting ─────────────────────────────────────────────
  _buildLighting(s){
    // Soft indoor ambient — main source of base illumination
    s.add(new THREE.AmbientLight(0xE0D3C1, 0.28));

    // Very soft fill — stops deep shadows being pitch black
    const fill = new THREE.DirectionalLight(0x95A5BF, 0.18);
    fill.position.set(5, 4, -3);
    s.add(fill);

    // Minimal hemisphere so floor/ceiling aren't grey voids
    const hemi = new THREE.HemisphereLight(0xb8ccdd, 0xd8c8a8, 0.14);
    s.add(hemi);
  }

  // ── Floor ────────────────────────────────────────────────
  _buildFloor(s){
    const matA = new THREE.MeshStandardMaterial({color:C.floor,   roughness:0.85});
    const matB = new THREE.MeshStandardMaterial({color:C.floorB,  roughness:0.88});
    const grout= new THREE.MeshStandardMaterial({color:C.grout,   roughness:0.95});
    const geo  = new THREE.PlaneGeometry(1.8,1.8);

    for(let tx=-7;tx<=7;tx++) for(let tz=-6;tz<=6;tz++){
      const m = new THREE.Mesh(geo, (tx+tz+100)%2===0?matA:matB);
      m.rotation.x=-Math.PI/2;
      m.position.set(tx*1.8, 0, tz*1.8);
      s.add(m);
    }
    // grout lines
    for(let tx=-7;tx<=7;tx++){
      const g=new THREE.Mesh(new THREE.PlaneGeometry(0.05,22),grout);
      g.rotation.x=-Math.PI/2; g.position.set(tx*1.8-0.9,0.001,0); s.add(g);
    }
    for(let tz=-6;tz<=6;tz++){
      const g=new THREE.Mesh(new THREE.PlaneGeometry(26,0.05),grout);
      g.rotation.x=-Math.PI/2; g.position.set(0,0.001,tz*1.8-0.9); s.add(g);
    }

    // area rug under dining area
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5,3),
      new THREE.MeshStandardMaterial({color:0x8a4a2a, roughness:0.97}));
    rug.rotation.x=-Math.PI/2; rug.position.set(0,0.002,2); s.add(rug);
    const rugInner = new THREE.Mesh(new THREE.PlaneGeometry(4.4,2.4),
      new THREE.MeshStandardMaterial({color:0xa05a30, roughness:0.97}));
    rugInner.rotation.x=-Math.PI/2; rugInner.position.set(0,0.003,2); s.add(rugInner);
  }

  // ── Walls ────────────────────────────────────────────────
  _buildWalls(s){
    const wTop  = new THREE.MeshStandardMaterial({color:C.wallMain,   roughness:0.90});
    const wDado = new THREE.MeshStandardMaterial({color:C.wallAccent, roughness:0.92});

    // main wall panels (upper)
    [[0,2.2,-7,18,4.4,0.2],[0,2.2,7,18,4.4,0.2],[-9,2.2,0,0.2,4.4,14],[9,2.2,0,0.2,4.4,14]]
      .forEach(([x,y,z,w,h,d])=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wTop);
        m.position.set(x,y,z); s.add(m);
        this.collidables.push(new THREE.Box3(
          new THREE.Vector3(x-w/2,0,z-d/2),
          new THREE.Vector3(x+w/2,h,z+d/2)));
      });
    // dado rail (lower 1m)
    [[0,0.5,-6.9,18,1,0.15],[0,0.5,6.9,18,1,0.15],
     [-8.9,0.5,0,0.15,1,14],[8.9,0.5,0,0.15,1,14]]
      .forEach(([x,y,z,w,h,d])=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wDado);
        m.position.set(x,y,z); s.add(m);
      });
    // dado rail trim strip
    const trim=new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.60});
    [[0,1.02,-6.88,18,0.07,0.08],[0,1.02,6.88,18,0.07,0.08],
     [-8.88,1.02,0,0.08,0.07,14],[8.88,1.02,0,0.08,0.07,14]]
      .forEach(([x,y,z,w,h,d])=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),trim);
        m.position.set(x,y,z); s.add(m);
      });

    // ceiling
    const ceil=new THREE.Mesh(new THREE.PlaneGeometry(18,14),
      new THREE.MeshStandardMaterial({color:0xc8bfb0,roughness:0.95}));
    ceil.rotation.x=Math.PI/2; ceil.position.set(0,4.4,0); s.add(ceil);

    // ceiling beams
    [-3,3].forEach(bx=>{
      const beam=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.20,14),
        new THREE.MeshStandardMaterial({color:C.woodDark,roughness:0.90}));
      beam.position.set(bx,4.30,0); s.add(beam);
    });

    // window
    this._buildWindow(s);

    // clock
    this._buildClock(s);

    // hanging pot rack above island
    this._buildPotRack(s);
  }

  _buildWindow(s){
    const fm=new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.70});
    const frame=new THREE.Mesh(new THREE.BoxGeometry(3.2,2.2,0.14),fm);
    frame.position.set(-1.5,2.6,-6.9); s.add(frame);

    const glass=new THREE.Mesh(new THREE.PlaneGeometry(2.9,2.0),
      new THREE.MeshBasicMaterial({color:0x9dc8e8,transparent:true,opacity:0.65}));
    glass.position.set(-1.5,2.6,-6.82); s.add(glass);

    // cross bars
    const barMat=new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.7});
    [[-0.72],[0.72]].forEach(([ox])=>{
      const b=new THREE.Mesh(new THREE.BoxGeometry(0.09,2.0,0.07),barMat);
      b.position.set(-1.5+ox,2.6,-6.84); s.add(b);
    });
    [[0.5],[-0.5]].forEach(([oy])=>{
      const b=new THREE.Mesh(new THREE.BoxGeometry(2.9,0.09,0.07),barMat);
      b.position.set(-1.5,2.6+oy,-6.84); s.add(b);
    });
   
    // sill plant
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.08,0.16,10),
      new THREE.MeshStandardMaterial({color:0xc86030,roughness:0.80}));
    pot.position.set(-1.5,1.14,-6.65); s.add(pot);
    [0,1,2,3,4].forEach(i=>{
      const a=(i/5)*Math.PI*2;
      const leaf=new THREE.Mesh(new THREE.SphereGeometry(0.06,8,6),
        new THREE.MeshStandardMaterial({color:[0x3a9030,0x2a7828,0x50a840][i%3],roughness:0.88}));
      leaf.position.set(-1.5+Math.cos(a)*0.09,1.35,-6.65+Math.sin(a)*0.09);
      leaf.scale.set(1.2,0.7,1.2); s.add(leaf);
    });
    // curtains
    [-3.0,0.0].forEach(cx=>{
      const ct=new THREE.Mesh(new THREE.PlaneGeometry(0.65,2.4),
        new THREE.MeshStandardMaterial({color:0xd8c0a0,roughness:0.96,side:THREE.DoubleSide}));
      ct.position.set(cx,2.6,-6.72); s.add(ct);
    });
  }

  _buildClock(s){
    const face=new THREE.Mesh(new THREE.CircleGeometry(0.36,20),
      new THREE.MeshStandardMaterial({color:0xfaf0e0,roughness:0.7}));
    face.position.set(-8.85,2.9,-2); face.rotation.y=Math.PI/2; s.add(face);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(0.36,0.055,8,24),
      new THREE.MeshStandardMaterial({color:C.woodDark,roughness:0.75}));
    rim.position.set(-8.82,2.9,-2); rim.rotation.y=Math.PI/2; s.add(rim);
    for(let i=0;i<12;i++){
      const a=(i/12)*Math.PI*2;
      const tick=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.055,0.02),
        new THREE.MeshBasicMaterial({color:0x3a2808}));
      tick.position.set(-8.83,2.9+Math.sin(a)*0.28,-2+Math.cos(a)*0.28);
      tick.rotation.y=Math.PI/2; s.add(tick);
    }
    const minH=new THREE.Mesh(new THREE.BoxGeometry(0.016,0.26,0.018),
      new THREE.MeshBasicMaterial({color:0x2a1808}));
    minH.position.set(-8.82,2.9,-2); minH.rotation.y=Math.PI/2; s.add(minH);
    this._clockHandMin=minH;
    const hrH=new THREE.Mesh(new THREE.BoxGeometry(0.022,0.17,0.018),
      new THREE.MeshBasicMaterial({color:0x4a2808}));
    hrH.position.set(-8.82,2.9,-2); hrH.rotation.y=Math.PI/2; s.add(hrH);
    this._clockHandHr=hrH;
  }

  _buildPotRack(s){
    const barMat=new THREE.MeshStandardMaterial({color:C.brass,roughness:0.40,metalness:0.6});
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,2.0,8),barMat);
    bar.rotation.z=Math.PI/2; bar.position.set(0,3.5,-1); s.add(bar);
    // hanging pots
    [{ox:-0.7,col:0x5a3a20},{ox:0,col:0x6a4828},{ox:0.7,col:0x4a3018}].forEach((p,i)=>{
      const hook=new THREE.Mesh(new THREE.TorusGeometry(0.028,0.010,6,8,Math.PI*1.3),barMat);
      hook.position.set(p.ox,3.40,-1); hook.rotation.z=Math.PI/2; s.add(hook);
      const cord=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.007,0.3+i*0.04,4),
        new THREE.MeshStandardMaterial({color:C.woodDark,roughness:0.9}));
      cord.position.set(p.ox,3.24-i*0.02,-1); s.add(cord);
      const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.10,0.22,12),
        new THREE.MeshStandardMaterial({color:p.col,roughness:0.50,metalness:0.4}));
      pot.position.set(p.ox,3.02-i*0.03,-1); s.add(pot);
    });
  }

  // ── Backsplash tiles ──────────────────────────────────────
  _buildBacksplash(s){
    const tW=0.18,tH=0.18,gr=0.012;
    const tileMat = new THREE.MeshStandardMaterial({color:C.tileLight,roughness:0.25,metalness:0.06});
    const groutMat= new THREE.MeshStandardMaterial({color:C.groutTile,roughness:0.90});
    const accentMat=new THREE.MeshStandardMaterial({color:C.tileAccent,roughness:0.28});
    for(let tx=-6;tx<=6;tx++) for(let ty=0;ty<5;ty++){
      const mat=(tx*3+ty*2)%9===0?accentMat:tileMat;
      const tile=new THREE.Mesh(new THREE.BoxGeometry(tW,tH,0.025),mat);
      tile.position.set(tx*(tW+gr),1.05+ty*(tH+gr)+tH/2,-6.72); s.add(tile);
    }
    for(let ty=0;ty<=5;ty++){
      const g=new THREE.Mesh(new THREE.BoxGeometry(18,gr,0.018),groutMat);
      g.position.set(0,1.05+ty*(tH+gr)-gr/2,-6.71); s.add(g);
    }
  }

  // ── Counters ──────────────────────────────────────────────
  _buildCounters(s){
    const topMat = new THREE.MeshStandardMaterial({color:C.counterTop,roughness:0.55,metalness:0.05});
    const bodyMat= new THREE.MeshStandardMaterial({color:C.cabinet,   roughness:0.80});
    const doorMat= new THREE.MeshStandardMaterial({color:C.cabinetDoor,roughness:0.75});
    const brassMat= new THREE.MeshStandardMaterial({color:C.brass,roughness:0.35,metalness:0.6});

    // main counter top
    const top=new THREE.Mesh(new THREE.BoxGeometry(16,0.11,1.1),topMat);
    top.position.set(0,0.98,-5.5); s.add(top);
    const body=new THREE.Mesh(new THREE.BoxGeometry(16,0.98,1.1),bodyMat);
    body.position.set(0,0.49,-5.5); s.add(body);
    this.collidables.push(new THREE.Box3(
      new THREE.Vector3(-8,0,-6.1),new THREE.Vector3(8,1.1,-5.0)));

    // cabinet doors
    for(let cx=-7;cx<=7;cx+=2){
      const door=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.76,0.055),doorMat);
      door.position.set(cx,0.49,-5.02); s.add(door);
      const knob=new THREE.Mesh(new THREE.SphereGeometry(0.040,6,4),brassMat);
      knob.position.set(cx+0.58,0.49,-4.97); s.add(knob);
    }

    // sink
    this._buildSink(s,2.8,-5.5);
    // toaster
    this._buildToaster(s,-1.8,-5.5);
    // kettle
    this._buildKettle(s,-3.2,-5.5);
    // blender
    this._buildBlender(s,4.4,-5.5);
    // spice rack on counter
    this._buildCounterSpiceRack(s,6.8,-5.5);
  }

  _buildSink(s,x,z){
    const mat=new THREE.MeshStandardMaterial({color:0xd0d0c8,roughness:0.28,metalness:0.18});
    const basin=new THREE.Mesh(new THREE.BoxGeometry(0.78,0.07,0.52),mat);
    basin.position.set(x,0.96,z); s.add(basin);
    const inner=new THREE.Mesh(new THREE.BoxGeometry(0.66,0.055,0.42),
      new THREE.MeshStandardMaterial({color:0xb8b8b0,roughness:0.20}));
    inner.position.set(x,0.945,z); s.add(inner);
    const brassMat=new THREE.MeshStandardMaterial({color:C.brass,roughness:0.40,metalness:0.7});
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.020,0.020,0.22,8),brassMat);
    pipe.position.set(x,1.18,z-0.17); s.add(pipe);
    const spout=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.16,8),brassMat);
    spout.rotation.x=Math.PI/3; spout.position.set(x,1.27,z-0.07); s.add(spout);
  }

  _buildToaster(s,x,z){
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.32,0.21,0.20),
      new THREE.MeshStandardMaterial({color:0xd8c8b0,roughness:0.70}));
    body.position.set(x,1.10,z); s.add(body);
    [-0.07,0.07].forEach(ox=>{
      const slot=new THREE.Mesh(new THREE.BoxGeometry(0.038,0.018,0.13),
        new THREE.MeshBasicMaterial({color:0x1a1210}));
      slot.position.set(x+ox,1.215,z); s.add(slot);
    });
  }

  _buildKettle(s,x,z){
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.105,0.21,12),
      new THREE.MeshStandardMaterial({color:0x2a7080,roughness:0.40,metalness:0.30}));
    body.position.set(x,1.10,z); s.add(body);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(0.072,0.072,0.036,10),
      new THREE.MeshStandardMaterial({color:0x205860,roughness:0.40}));
    lid.position.set(x,1.22,z); s.add(lid);
    const spout=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.028,0.17,8),
      new THREE.MeshStandardMaterial({color:0x2a7080,roughness:0.40}));
    spout.rotation.z=-Math.PI/5; spout.position.set(x+0.13,1.13,z); s.add(spout);
  }

  _buildBlender(s,x,z){
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.105,0.11,10),
      new THREE.MeshStandardMaterial({color:0x303038,roughness:0.75}));
    base.position.set(x,1.045,z); s.add(base);
    const jug=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.095,0.24,10),
      new THREE.MeshStandardMaterial({color:0x88aac0,transparent:true,opacity:0.50,roughness:0.12}));
    jug.position.set(x,1.215,z); s.add(jug);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.03,10),
      new THREE.MeshStandardMaterial({color:0x303038,roughness:0.75}));
    lid.position.set(x,1.35,z); s.add(lid);
  }

  _buildCounterSpiceRack(s,x,z){
    const shelf=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.055,0.22),
      new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.75}));
    shelf.position.set(x,1.70,z); s.add(shelf);
    const back=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.35,0.04),
      new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.75}));
    back.position.set(x,1.88,z+0.09); s.add(back);
    [[0xa03010,'Chill'],[0x207040,'Herb'],[0x303028,'Pep'],[0xa07820,'Cumin'],[0x601820,'Paprika']]
    .forEach(([col,],i)=>{
      const j=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.15,8),
        new THREE.MeshStandardMaterial({color:col,roughness:0.60}));
      j.position.set(x-0.38+i*0.19,1.83,z); s.add(j);
    });
  }

  // ── Upper cabinets ────────────────────────────────────────
  _buildUpperCabinets(s){
    const cabMat =new THREE.MeshStandardMaterial({color:C.cabinet,    roughness:0.72});
    const doorMat=new THREE.MeshStandardMaterial({color:C.cabinetDoor,roughness:0.68});
    const brassMat=new THREE.MeshStandardMaterial({color:C.brass,roughness:0.35,metalness:0.6});
    for(let cx=-6;cx<=6;cx+=3){
      const cab=new THREE.Mesh(new THREE.BoxGeometry(2.8,0.88,0.48),cabMat);
      cab.position.set(cx,3.56,-6.77); s.add(cab);
      [-0.66,0.66].forEach(ox=>{
        const door=new THREE.Mesh(new THREE.BoxGeometry(1.24,0.76,0.055),doorMat);
        door.position.set(cx+ox,3.56,-6.53); s.add(door);
        const knob=new THREE.Mesh(new THREE.SphereGeometry(0.038,6,4),brassMat);
        knob.position.set(cx+ox*0.84,3.56,-6.50); s.add(knob);
      });
    }
    // hanging herb bundles
    [[-5,3.08],[-2,3.08],[1,3.08],[4,3.08]].forEach(([hx,hy])=>{
      const string=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.20,4),
        new THREE.MeshStandardMaterial({color:C.woodDark,roughness:0.9}));
      string.position.set(hx,hy-0.09,-6.52); s.add(string);
      const bunch=new THREE.Mesh(new THREE.SphereGeometry(0.065,8,6),
        new THREE.MeshStandardMaterial({color:0x3a8028,roughness:0.92}));
      bunch.scale.set(1,1.6,1);
      bunch.position.set(hx,hy-0.26,-6.52); s.add(bunch);
    });
  }

  // ── Stove ─────────────────────────────────────────────────
  _buildStove(s){
    const sx=-3, sz=-5.5;
    // oven body
    const oven=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.96,1.04),
      new THREE.MeshStandardMaterial({color:C.stoveBody,roughness:0.80,metalness:0.28}));
    oven.position.set(sx,0.50,sz); s.add(oven);
    const door=new THREE.Mesh(new THREE.BoxGeometry(1.80,0.48,0.055),
      new THREE.MeshStandardMaterial({color:0x282830,roughness:0.75}));
    door.position.set(sx,0.32,sz-0.54); s.add(door);
    const handle=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.038,0.038),
      new THREE.MeshStandardMaterial({color:C.brass,roughness:0.38,metalness:0.65}));
    handle.position.set(sx,0.54,sz-0.55); s.add(handle);
    // stove top
    const top=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.055,1.04),
      new THREE.MeshStandardMaterial({color:0x222228,roughness:0.75,metalness:0.38}));
    top.position.set(sx,0.99,sz); s.add(top);
    // burner rings
    [[-0.44,-0.20],[0.44,-0.20],[-0.44,0.20],[0.44,0.20]].forEach(([bx,bz])=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.19,0.038,6,18),
        new THREE.MeshStandardMaterial({color:0x181820,roughness:0.88}));
      ring.rotation.x=-Math.PI/2; ring.position.set(sx+bx,1.028,sz+bz); s.add(ring);
    });
    // knobs
    [-0.48,0,0.48].forEach(ox=>{
      const knob=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.042,0.055,10),
        new THREE.MeshStandardMaterial({color:C.brass,roughness:0.38,metalness:0.55}));
      knob.rotation.x=Math.PI/2; knob.position.set(sx+ox,1.015,sz-0.535); s.add(knob);
    });
    // pan
    const pan=new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.34,0.060,18),
      new THREE.MeshStandardMaterial({color:C.panBlack,roughness:0.88,metalness:0.18}));
    pan.position.set(sx-0.44,1.058,sz-0.20); s.add(pan);
    const panIn=new THREE.Mesh(new THREE.CircleGeometry(0.34,16),
      new THREE.MeshStandardMaterial({color:0x181818,roughness:0.80}));
    panIn.rotation.x=-Math.PI/2; panIn.position.set(sx-0.44,1.094,sz-0.20); s.add(panIn);
    const panH=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.65,8),
      new THREE.MeshStandardMaterial({color:C.panBlack,roughness:0.88}));
    panH.rotation.z=Math.PI/2; panH.position.set(sx-0.44-0.58,1.058,sz-0.20); s.add(panH);
    // grill mark canvas mesh
    const gc=document.createElement('canvas'); gc.width=128; gc.height=128;
    this._grillCanvas=gc; this._grillCtx=gc.getContext('2d');
    this._grillTex=new THREE.CanvasTexture(gc);
    this._grillMarkMesh=new THREE.Mesh(new THREE.PlaneGeometry(0.65,0.65),
      new THREE.MeshBasicMaterial({map:this._grillTex,transparent:true,opacity:0,depthWrite:false}));
    this._grillMarkMesh.rotation.x=-Math.PI/2;
    this._grillMarkMesh.position.set(sx-0.44,1.096,sz-0.20); s.add(this._grillMarkMesh);
    // pan flash
    this._panFlashMesh=new THREE.Mesh(new THREE.RingGeometry(0.28,0.42,16),
      new THREE.MeshBasicMaterial({color:0xff8800,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
    this._panFlashMesh.rotation.x=-Math.PI/2;
    this._panFlashMesh.position.set(sx-0.44,1.10,sz-0.20); s.add(this._panFlashMesh);
    // side pot
    const sp=new THREE.Mesh(new THREE.CylinderGeometry(0.20,0.18,0.27,12),
      new THREE.MeshStandardMaterial({color:0x6a4828,roughness:0.75}));
    sp.position.set(sx+0.44,1.18,sz+0.20); s.add(sp);
    const spLid=new THREE.Mesh(new THREE.CylinderGeometry(0.205,0.205,0.038,12),
      new THREE.MeshStandardMaterial({color:0x7a5830,roughness:0.75}));
    spLid.position.set(sx+0.44,1.33,sz+0.20); s.add(spLid);
    // range hood
    const hood=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.17,1.22),
      new THREE.MeshStandardMaterial({color:0x2a2a32,roughness:0.75,metalness:0.28}));
    hood.position.set(sx,2.90,sz); s.add(hood);
    const duct=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.62,0.40),
      new THREE.MeshStandardMaterial({color:0x222228,roughness:0.78}));
    duct.position.set(sx,3.29,sz); s.add(duct);
    // chicken mesh (hidden until seasoned)
    this._chickenMesh=new THREE.Mesh(new THREE.BoxGeometry(0.50,0.088,0.30),
      new THREE.MeshStandardMaterial({color:RAW_COLOR.getHex(),roughness:0.65}));
    this._chickenMesh.position.set(sx-0.44,1.118,sz-0.20);
    this._chickenMesh.visible=false; s.add(this._chickenMesh);
    // burner glow light
    this._burnerGlow=new THREE.PointLight(0xff6600,0,4);
    this._burnerGlow.position.set(sx-0.44,1.15,sz-0.20); s.add(this._burnerGlow);

    Build.label(s,'🍗 Grill Station',sx,2.06,sz+0.74,'#5a3a10','rgba(255,240,210,0.92)');
    this._stoveZone=this._zone(s,sx,sz+0.78,2.3,2.1);
    this._stoveZone.userData.onInteract=()=>this._interactChicken();
    this.interactables.push(this._stoveZone);
  }

  // ── Chop station ──────────────────────────────────────────
  _buildChopStation(s){
    const cx=0.5, cz=-5.5;
    const board=new THREE.Mesh(new THREE.BoxGeometry(1.35,0.060,0.84),
      new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.78}));
    board.position.set(cx,1.028,cz); s.add(board);
    // wood grain lines
    for(let gx=-0.55;gx<=0.55;gx+=0.13){
      const g=new THREE.Mesh(new THREE.BoxGeometry(0.007,0.004,0.80),
        new THREE.MeshBasicMaterial({color:0x7a5830}));
      g.position.set(cx+gx,1.062,cz); s.add(g);
    }
    // static display knife
    const blade=new THREE.Mesh(new THREE.BoxGeometry(0.050,0.004,0.50),
      new THREE.MeshStandardMaterial({color:0x9898b0,roughness:0.22,metalness:0.75}));
    blade.position.set(cx+0.80,1.058,cz-0.04); s.add(blade);
    const kH=new THREE.Mesh(new THREE.BoxGeometry(0.090,0.035,0.19),
      new THREE.MeshStandardMaterial({color:C.woodDark,roughness:0.78}));
    kH.position.set(cx+0.80,1.062,cz+0.33); s.add(kH);
    // animated knife group
    this._knifeGroup=new THREE.Group();
    this._knifeGroup.position.set(cx-0.10,1.058,cz);
    s.add(this._knifeGroup);
    const ab=new THREE.Mesh(new THREE.BoxGeometry(0.048,0.004,0.44),
      new THREE.MeshStandardMaterial({color:0x9898b0,roughness:0.22,metalness:0.75}));
    ab.position.set(0,0,-0.02); this._knifeGroup.add(ab);
    const ah=new THREE.Mesh(new THREE.BoxGeometry(0.082,0.032,0.17),
      new THREE.MeshStandardMaterial({color:C.woodDark,roughness:0.78}));
    ah.position.set(0,0.008,0.29); this._knifeGroup.add(ah);
    // veggies
    [{color:0x228018,geo:new THREE.CylinderGeometry(0.065,0.065,0.34,10),ox:-0.28,oz:0.00},
     {color:0xcc2020,geo:new THREE.SphereGeometry(0.100,10,8),ox:0.12,oz:0.03},
     {color:0x30a020,geo:new THREE.SphereGeometry(0.084,10,8),ox:-0.05,oz:0.18},
     {color:0xcc9010,geo:new THREE.SphereGeometry(0.070,10,8),ox:0.26,oz:-0.10}]
    .forEach(v=>{
      const m=new THREE.Mesh(v.geo,new THREE.MeshStandardMaterial({color:v.color,roughness:0.68}));
      m.position.set(cx+v.ox,1.098,cz+v.oz); s.add(m); this._vegMeshes.push(m);
    });
    Build.label(s,'🥒 Chop Station',cx,2.06,cz+0.74,'#204010','rgba(220,255,200,0.92)');
    this._chopZone=this._zone(s,cx,cz+0.78,2.3,2.1);
    this._chopZone.userData.onInteract=()=>this._interactChop();
    this.interactables.push(this._chopZone);
  }

  // ── Sauce station ─────────────────────────────────────────
  _buildSauceStation(s){
    const bx=4.0, bz=-5.5;
    // sauce jar
    const jar=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.26,12),
      new THREE.MeshStandardMaterial({color:0x9a1808,roughness:0.58}));
    jar.position.set(bx+0.66,1.12,bz-0.22); s.add(jar);
    const jlid=new THREE.Mesh(new THREE.CylinderGeometry(0.115,0.115,0.042,12),
      new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.78}));
    jlid.position.set(bx+0.66,1.27,bz-0.22); s.add(jlid);
    Build.label(s,'Tomato Sauce',bx+0.66,1.60,bz-0.22,'#8a1a08','rgba(255,240,220,0.92)');
    // bread
    const breadBody=new THREE.Mesh(new THREE.BoxGeometry(0.50,0.055,0.38),
      new THREE.MeshStandardMaterial({color:0x8a5c28,roughness:0.80}));
    breadBody.position.set(bx,1.028,bz+0.04); s.add(breadBody);
    const breadTop=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.020,0.34),
      new THREE.MeshStandardMaterial({color:0xb07838,roughness:0.70}));
    breadTop.position.set(bx,1.058,bz+0.04); s.add(breadTop);
    // crust edges
    new THREE.MeshStandardMaterial({color:0x6a4018,roughness:0.90});
    [[bx,1.048,bz+0.04-0.19,0.50,0.030,0.013],
     [bx,1.048,bz+0.04+0.19,0.50,0.030,0.013],
     [bx-0.25,1.048,bz+0.04,0.013,0.030,0.38],
     [bx+0.25,1.048,bz+0.04,0.013,0.030,0.38]]
    .forEach(([x,y,z,w,h,d])=>{
      const c=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
        new THREE.MeshStandardMaterial({color:0x6a4018,roughness:0.90}));
      c.position.set(x,y,z); s.add(c);
    });
    // spatula/brush
    this._brushGroup=new THREE.Group();
    this._brushGroup.position.set(bx,1.18,bz);
    s.add(this._brushGroup);
    const spatBlade=new THREE.Mesh(new THREE.BoxGeometry(0.038,0.005,0.30),
      new THREE.MeshStandardMaterial({color:0x9898b0,roughness:0.22,metalness:0.5}));
    spatBlade.position.set(0,0,-0.05); this._brushGroup.add(spatBlade);
    const spatH=new THREE.Mesh(new THREE.BoxGeometry(0.032,0.032,0.20),
      new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.78}));
    spatH.position.set(0,0.018,0.16); this._brushGroup.add(spatH);
    // sauce canvas
    this._sauceCanvas=document.createElement('canvas');
    this._sauceCanvas.width=256; this._sauceCanvas.height=256;
    this._sauceCtx=this._sauceCanvas.getContext('2d');
    this._resetSauceCanvas();
    this._sauceTex=new THREE.CanvasTexture(this._sauceCanvas);
    this._breadPlane=new THREE.Mesh(new THREE.PlaneGeometry(0.46,0.34),
      new THREE.MeshBasicMaterial({map:this._sauceTex,transparent:true,depthWrite:false}));
    this._breadPlane.rotation.x=-Math.PI/2;
    this._breadPlane.position.set(bx,1.062,bz+0.04); s.add(this._breadPlane);
    this.interactables.push(this._breadPlane);
    this._breadPlane.userData.onInteract=()=>{};
    this._breadWorldMin.set(bx-0.23,1.060,bz-0.13);
    this._breadWorldMax.set(bx+0.23,1.060,bz+0.21);

    Build.label(s,'🍞 Spread Sauce',bx,2.06,bz+0.74,'#8a4010','rgba(255,240,210,0.92)');
    this._sauceZone=this._zone(s,bx,bz+0.78,2.3,2.1);
    this._sauceZone.userData.onInteract=()=>this._interactSauceE();
    this.interactables.push(this._sauceZone);
  }

  _resetSauceCanvas(){
    const ctx=this._sauceCtx;
    ctx.fillStyle='#a07040'; ctx.fillRect(0,0,256,256);
    for(let i=0;i<180;i++){
      ctx.fillStyle=`rgba(${120+Math.random()*30|0},${80+Math.random()*20|0},${20+Math.random()*10|0},0.14)`;
      ctx.beginPath(); ctx.arc(Math.random()*256,Math.random()*256,1+Math.random()*3,0,Math.PI*2); ctx.fill();
    }
    if(this._sauceTex) this._sauceTex.needsUpdate=true;
  }

  // ── Lemon station ─────────────────────────────────────────
  _buildLemonStation(s){
    const lx=7.0, lz=-5.5;
    // jug (glass pitcher)
    this._jugMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.11,0.38,12),
      new THREE.MeshStandardMaterial({color:0xc8e0f0,transparent:true,opacity:0.52,roughness:0.08}));
    this._jugMesh.position.set(lx,1.20,lz); s.add(this._jugMesh);
    const jugH=new THREE.Mesh(new THREE.TorusGeometry(0.088,0.020,6,10,Math.PI),
      new THREE.MeshStandardMaterial({color:0xa8c8e0,roughness:0.30}));
    jugH.rotation.z=Math.PI/2; jugH.position.set(lx-0.15,1.20,lz); s.add(jugH);
    // liquid fill (grows as lemons added)
    this._liqMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.115,0.095,0.005,12),
      new THREE.MeshStandardMaterial({color:0xd4c030,transparent:true,opacity:0.85}));
    this._liqMesh.position.set(lx,1.01,lz); this._liqMesh.visible=false; s.add(this._liqMesh);
    // bowl of lemons
    const bowl=new THREE.Mesh(new THREE.SphereGeometry(0.14,10,6,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshStandardMaterial({color:0xc86830,roughness:0.72}));
    bowl.rotation.x=Math.PI; bowl.position.set(lx+0.42,1.055,lz); s.add(bowl);
    for(let i=0;i<4;i++){
      const lem=new THREE.Mesh(new THREE.SphereGeometry(0.065,10,8),
        new THREE.MeshStandardMaterial({color:0xd4b808,roughness:0.62}));
      lem.scale.set(1.32,0.90,1.10);
      lem.position.set(lx+0.42+Math.cos(i*1.57)*0.065,1.135,lz+Math.sin(i*1.57)*0.065);
      s.add(lem); this._lemonMeshes.push(lem);
    }
    // juicer
    const juicer=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.11,0.075,10),
      new THREE.MeshStandardMaterial({color:0xc86030,roughness:0.78}));
    juicer.position.set(lx+0.42,1.055,lz+0.28); s.add(juicer);
    const cone=new THREE.Mesh(new THREE.ConeGeometry(0.062,0.095,10),
      new THREE.MeshStandardMaterial({color:0xb85028,roughness:0.72}));
    cone.position.set(lx+0.42,1.128,lz+0.28); s.add(cone);

    Build.label(s,'🍋 Make Lemonade',lx,2.06,lz+0.74,'#706010','rgba(255,250,200,0.92)');
    this._lemonZone=this._zone(s,lx,lz+0.78,2.3,2.1);
    this._lemonZone.userData.onInteract=()=>this._interactLemon();
    this.interactables.push(this._lemonZone);
  }

  // ── Season station ────────────────────────────────────────
  _buildSeasonStation(s){
    const sx=-6.5, sz=-5.5;
    // spice shelf on wall
    const shelf=new THREE.Mesh(new THREE.BoxGeometry(1.3,0.055,0.28),
      new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.78}));
    shelf.position.set(sx,1.82,sz); s.add(shelf);
    [0x9a2010,0x701010,0x204010,0x907020,0x481038].forEach((c,i)=>{
      const j=new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.052,0.16,8),
        new THREE.MeshStandardMaterial({color:c,roughness:0.62}));
      j.position.set(sx-0.45+i*0.225,1.95,sz); s.add(j);
    });
    // main spice jar (interactive)
    this._spiceJarMesh=new THREE.Mesh(new THREE.CylinderGeometry(0.072,0.068,0.22,12),
      new THREE.MeshStandardMaterial({color:0xa02808,roughness:0.65}));
    this._spiceJarMesh.position.set(sx,1.11,sz-0.14); s.add(this._spiceJarMesh);
    const sjl=new THREE.Mesh(new THREE.CylinderGeometry(0.076,0.076,0.038,10),
      new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.70}));
    sjl.position.set(sx,1.23,sz-0.14); s.add(sjl);
    // raw chicken on plate
    const plate=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.025,16),
      new THREE.MeshStandardMaterial({color:0xe8e0d0,roughness:0.48}));
    plate.position.set(sx,1.008,sz+0.14); s.add(plate);
    this._rawDisplay=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.085,0.26),
      new THREE.MeshStandardMaterial({color:RAW_COLOR.getHex(),roughness:0.65}));
    this._rawDisplay.position.set(sx,1.058,sz+0.14); s.add(this._rawDisplay);

    Build.label(s,'🧂 Season first!',sx,1.88,sz+0.78,'#6a3010','rgba(255,240,210,0.92)');
    this._seasonZone=this._zone(s,sx,sz+0.78,2.3,2.1);
    this._seasonZone.userData.onInteract=()=>this._interactSeason();
    this.interactables.push(this._seasonZone);
  }

  // ── Kitchen decor ─────────────────────────────────────────
  _buildDecor(s){
    // fridge
    this._buildFridge(s,7.5,-3);
    // juice / drinks rack
    this._buildJuiceRack(s,-8.6,4);
    // dining table + chairs
    this._buildDiningTable(s,0,3.5);
    // wall art
    this._buildWallArt(s);
    // recipe book stand
    this._buildRecipeStand(s,1.2,-5.5);
    // fruit bowl
    this._buildFruitBowl(s,2.4,-5.5);
    // dish rack
    this._buildDishRack(s,-7.5,-5.5);
    // hanging lamp over table
    this._buildHangingLamp(s,0,3.5);
    // candles on counter
    this._buildCandles(s);
  }

  _buildFridge(s,x,z){
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.08,2.18,0.82),
      new THREE.MeshStandardMaterial({color:0xf0ece6,roughness:0.62}));
    body.position.set(x,1.09,z); s.add(body);
    const line=new THREE.Mesh(new THREE.BoxGeometry(1.10,0.014,0.84),
      new THREE.MeshStandardMaterial({color:0xd8d0c4,roughness:0.60}));
    line.position.set(x,1.40,z); s.add(line);
    const bMat=new THREE.MeshStandardMaterial({color:C.brass,roughness:0.38,metalness:0.6});
    const handle1=new THREE.Mesh(new THREE.BoxGeometry(0.052,0.48,0.052),bMat);
    handle1.position.set(x-0.46,1.60,z-0.42); s.add(handle1);
    const handle2=new THREE.Mesh(new THREE.BoxGeometry(0.052,0.28,0.052),bMat);
    handle2.position.set(x-0.46,1.20,z-0.42); s.add(handle2);
    // magnets
    [0x9a2820,0x2a6040,0xc09010,0x283a8a].forEach((c,i)=>{
      const mag=new THREE.Mesh(new THREE.BoxGeometry(0.095,0.095,0.025),
        new THREE.MeshStandardMaterial({color:c,roughness:0.75}));
      mag.position.set(x-0.50,1.70+i*0.13,z-0.42); s.add(mag);
    });
    this.collidables.push(new THREE.Box3(
      new THREE.Vector3(x-0.55,0,z-0.42),new THREE.Vector3(x+0.55,2.2,z+0.42)));
  }

  _buildJuiceRack(s,x,z){
    const rMat=new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.80});
    const frame=new THREE.Mesh(new THREE.BoxGeometry(0.65,1.15,0.36),rMat);
    frame.position.set(x,0.58,z); s.add(frame);
    // shelves
    [0.08,0.44,0.80].forEach(ry=>{
      const sh=new THREE.Mesh(new THREE.BoxGeometry(0.63,0.042,0.34),rMat);
      sh.position.set(x,ry,z); s.add(sh);
    });
    // juice bottles
    const juices=[
      {y:0.22,col:0xd83010,label:'OJ'},
      {y:0.22,col:0x28a030,label:''},
      {y:0.58,col:0xd0b010,label:''},
      {y:0.58,col:0xf06020,label:''},
      {y:0.94,col:0x901090,label:''},
      {y:0.94,col:0xe03820,label:''},
    ];
    juices.forEach((j,i)=>{
      const bottle=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.060,0.24,10),
        new THREE.MeshStandardMaterial({color:j.col,transparent:true,opacity:0.82,roughness:0.30}));
      bottle.position.set(x-0.14+(i%2)*0.28,j.y,z); s.add(bottle);
      const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.040,0.040,0.028,8),
        new THREE.MeshStandardMaterial({color:0xf0f0e8,roughness:0.70}));
      cap.position.set(x-0.14+(i%2)*0.28,j.y+0.135,z); s.add(cap);
    });
    Build.label(s,'Drinks Rack',x,1.38,z,'#4a3010','rgba(255,240,200,0.92)');
    this.collidables.push(new THREE.Box3(
      new THREE.Vector3(x-0.35,0,z-0.20),new THREE.Vector3(x+0.35,1.2,z+0.20)));
  }

  _buildDiningTable(s,x,z){
    const tMat=new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.72});
    const top=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.065,1.1),tMat);
    top.position.set(x,0.76,z); s.add(top);
    [[0.88,0.64],[-0.88,0.64],[0.88,z+0.36],[-0.88,z+0.36]].forEach(([lx,lz])=>{
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.038,0.76,8),tMat);
      leg.position.set(x+lx,0.38,lz); s.add(leg);
    });
    // chairs
    [[-1.3,z,0],[1.3,z,Math.PI],[x,z-0.74,-Math.PI/2],[x,z+0.74,Math.PI/2]].forEach(([cx,cz,ry])=>{
      this._buildChair(s,cx,cz,ry);
    });
    this.collidables.push(new THREE.Box3(
      new THREE.Vector3(x-1.1,0,z-0.56),new THREE.Vector3(x+1.1,0.78,z+0.56)));
  }

  _buildChair(s,x,z,ry){
    const mat=new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.75});
    const seat=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.038,0.38),mat);
    seat.position.set(x,0.46,z); seat.rotation.y=ry; s.add(seat);
    const back=new THREE.Mesh(new THREE.BoxGeometry(0.44,0.44,0.038),mat);
    back.position.set(
      x+Math.sin(ry)*0.17, 0.70, z+Math.cos(ry)*0.17);
    back.rotation.y=ry; s.add(back);
    [[0.17,0.17],[-0.17,0.17],[0.17,-0.17],[-0.17,-0.17]].forEach(([lx,lz])=>{
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.020,0.020,0.46,6),mat);
      leg.position.set(x+Math.cos(ry)*lx-Math.sin(ry)*lz,0.23,
                       z+Math.sin(ry)*lx+Math.cos(ry)*lz); s.add(leg);
    });
  }

  _buildWallArt(s){
    // framed prints on back wall
    [{x:-5,title:'🌿 Herbs',bg:'#204018'},{x:-3.2,title:'🌸 Garden',bg:'#2a1830'},{x:4.8,title:'🍅 Fresh',bg:'#3a0c10'}]
    .forEach(p=>{
      const frame=new THREE.Mesh(new THREE.BoxGeometry(0.60,0.72,0.038),
        new THREE.MeshStandardMaterial({color:C.woodDark,roughness:0.88}));
      frame.position.set(p.x,2.62,-6.88); s.add(frame);
      const c=document.createElement('canvas'); c.width=80; c.height=96;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#f8f0e4'; ctx.fillRect(0,0,80,96);
      ctx.globalAlpha=0.6;
      ctx.fillStyle=p.bg;
      ctx.beginPath(); ctx.ellipse(40,44,32,36,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      ctx.fillStyle=p.bg;
      for(let i=0;i<6;i++){
        ctx.beginPath(); ctx.ellipse(rng(12,68),rng(8,78),rng(2,7),rng(4,13),rng(0,Math.PI),0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='#5a3a08'; ctx.font='bold 9px serif'; ctx.textAlign='center';
      ctx.fillText(p.title,40,90);
      const art=new THREE.Mesh(new THREE.PlaneGeometry(0.54,0.66),
        new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));
      art.position.set(p.x,2.62,-6.85); s.add(art);
    });
    // chalkboard menu
    {
      const board=new THREE.Mesh(new THREE.BoxGeometry(1.35,0.88,0.055),
        new THREE.MeshStandardMaterial({color:0x0e1a0e,roughness:0.95}));
      board.position.set(8.87,2.28,1); board.rotation.y=Math.PI/2; s.add(board);
      const frame=new THREE.Mesh(new THREE.BoxGeometry(1.42,0.95,0.045),
        new THREE.MeshStandardMaterial({color:C.woodDark,roughness:0.88}));
      frame.position.set(8.88,2.28,1); frame.rotation.y=Math.PI/2; s.add(frame);
      const c=document.createElement('canvas'); c.width=135; c.height=88;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#0e1a0e'; ctx.fillRect(0,0,135,88);
      ctx.fillStyle='rgba(220,200,140,0.92)'; ctx.font='bold 10px serif'; ctx.textAlign='center';
      ["TODAY'S MENU","──────","🍗 Herb Chicken","🥒 Garden Veggies","🍞 Sauce Bread","🍋 Lemonade"]
        .forEach((l,i)=>ctx.fillText(l,67,12+i*13));
      const cb=new THREE.Mesh(new THREE.PlaneGeometry(1.28,0.82),
        new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c)}));
      cb.position.set(8.84,2.28,1); cb.rotation.y=Math.PI/2; s.add(cb);
    }
  }

  _buildRecipeStand(s,x,z){
    const book=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.038,0.36),
      new THREE.MeshStandardMaterial({color:0x8a3a18,roughness:0.88}));
    book.position.set(x,1.055,z); book.rotation.y=0.18; s.add(book);
    const stand=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.26,0.055),
      new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.78}));
    stand.rotation.x=-Math.PI/5; stand.position.set(x,1.19,z-0.30); s.add(stand);
    Build.label(s,'📖 Recipes',x,1.58,z,'#5a2808','rgba(255,240,210,0.92)');
  }

  _buildFruitBowl(s,x,z){
    const bowl=new THREE.Mesh(new THREE.SphereGeometry(0.17,10,6,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshStandardMaterial({color:0xc06028,roughness:0.78}));
    bowl.position.set(x,1.065,z); bowl.rotation.x=Math.PI; s.add(bowl);
    [{c:0xcc1818,r:0.072,ox:-0.05,oz:0.02},{c:0xd08010,r:0.068,ox:0.06,oz:-0.03},
     {c:0x20a020,r:0.060,ox:0.00,oz:0.08},{c:0xcc1010,r:0.065,ox:-0.04,oz:-0.07}]
    .forEach(f=>{
      const fr=new THREE.Mesh(new THREE.SphereGeometry(f.r,10,8),
        new THREE.MeshStandardMaterial({color:f.c,roughness:0.62}));
      fr.position.set(x+f.ox,1.14+f.r,z+f.oz); s.add(fr);
    });
  }

  _buildDishRack(s,x,z){
    const rack=new THREE.Mesh(new THREE.BoxGeometry(0.55,0.36,0.28),
      new THREE.MeshStandardMaterial({color:C.woodOak,roughness:0.80,wireframe:true}));
    rack.position.set(x,1.16,z); s.add(rack);
    [0,1,2].forEach(i=>{
      const plate=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.095,0.020,12),
        new THREE.MeshStandardMaterial({color:[0xe8e0d0,0xd8e8e8,0xe8e0c8][i],roughness:0.48}));
      plate.rotation.z=Math.PI/2+i*0.14;
      plate.position.set(x-0.11+i*0.05,1.17+i*0.02,z); s.add(plate);
    });
  }

  _buildHangingLamp(s,x,z){
    const cord=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,1.0,6),
      new THREE.MeshStandardMaterial({color:C.woodDark,roughness:0.90}));
    cord.position.set(x,3.90,z); s.add(cord);
    const shade=new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.14,0.22,12,1,true),
      new THREE.MeshStandardMaterial({color:0xd8c090,roughness:0.80,side:THREE.DoubleSide}));
    shade.position.set(x,3.28,z); s.add(shade);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(0.065,8,6),
      new THREE.MeshBasicMaterial({color:0xffee88}));
    bulb.position.set(x,3.30,z); s.add(bulb);
    const pt=new THREE.PointLight(0xffd080,1.0,6);
    pt.position.set(x,3.26,z); s.add(pt);
  }

  _buildCandles(s){
    [[5.5,1.038,-5.38],[5.8,1.038,-5.5],[5.5,1.038,-5.62]].forEach((pos,i)=>{
      const candle=new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.030,0.12+i*0.04,8),
        new THREE.MeshStandardMaterial({color:0xfffff0,roughness:0.88}));
      candle.position.set(pos[0],pos[1]+0.06+i*0.02,pos[2]); s.add(candle);
      const flame=new THREE.Mesh(new THREE.ConeGeometry(0.016,0.052,6),
        new THREE.MeshBasicMaterial({color:0xffaa22,transparent:true,opacity:0.92}));
      flame.position.set(pos[0],pos[1]+0.14+i*0.04+0.03,pos[2]);
      flame.userData.isFlame=true; flame.userData.baseY=flame.position.y;
      s.userData.flames=s.userData.flames||[];
      s.userData.flames.push(flame); s.add(flame);
    });
    const cl=new THREE.PointLight(0xffcc44,0.35,3.0);
    cl.position.set(5.6,1.22,-5.5); s.add(cl);
    this._candleLights.push(cl);
  }

  // ── Zone helper ───────────────────────────────────────────
  _zone(s,x,z,w,d){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,2.5,d),
      new THREE.MeshBasicMaterial({visible:false}));
    m.position.set(x,1.25,z); s.add(m); return m;
  }

  // ── Particle pools ────────────────────────────────────────
  _buildParticlePools(s){
    const spiceGeo=new THREE.SphereGeometry(0.016,4,3);
    this._spicePool=new ParticlePool(s,30,spiceGeo,0xcc6010);
    const steamGeo=new THREE.SphereGeometry(0.046,4,3);
    this._steamPool=new ParticlePool(s,20,steamGeo,0xe8e8e0);
    const smokeGeo=new THREE.SphereGeometry(0.10,6,5);
    this._smokePool=new ParticlePool(s,10,smokeGeo,0x989898);
    const sauceGeo=new THREE.SphereGeometry(0.013,4,3);
    this._saucePool=new ParticlePool(s,20,sauceGeo,0xcc1808);
    const lemonGeo=new THREE.SphereGeometry(0.018,4,3);
    this._lemonPool=new ParticlePool(s,24,lemonGeo,0xd4c010);
  }

  // ── Mini HUD ──────────────────────────────────────────────
  _buildMiniHUD(){
    if(this._mgEl) return;
    const el=document.createElement('div');
    el.style.cssText=`position:fixed;left:50%;bottom:80px;transform:translateX(-50%);
      width:270px;pointer-events:none;display:none;z-index:20;`;
    el.innerHTML=`
      <div id="mgLabel" style="text-align:center;font-size:13px;color:#5a3010;
        text-shadow:0 1px 3px rgba(255,255,255,0.7);margin-bottom:5px;
        font-weight:700;font-family:serif"></div>
      <div style="height:13px;background:rgba(255,255,255,0.55);border-radius:999px;
        overflow:hidden;border:1.5px solid rgba(180,120,40,0.35)">
        <div id="mgFill" style="height:100%;width:0%;border-radius:999px;
          background:linear-gradient(90deg,#c86010,#f0b030);transition:width 0.10s"></div>
      </div>`;
    document.body.appendChild(el);
    this._mgEl=el;
    this._mgLabel=el.querySelector('#mgLabel');
    this._mgFill=el.querySelector('#mgFill');
  }

  _showBar(label,pct){
    if(!this._mgEl) return;
    this._mgEl.style.display='block';
    this._mgLabel.textContent=label;
    this._mgFill.style.width=(Math.min(pct,1)*100).toFixed(1)+'%';
  }
  _hideBar(){
    if(!this._mgEl) return;
    this._mgEl.style.display='none';
  }

  // ══════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════
  onEnter(){
    this.step=STEP.SEASON;
    this._seasonCount=0;
    this._cookProgress=0; this._flips=0; this._isFlipping=false; this._flipT=0;
    this._knifeT=-1;
    this._chopCount=0;
    this._chopPieces.forEach(p=>this.scene.remove(p));
    this._chopPieces=[];
    this._sauceCoverage=0; this._saucePaintCount=0;
    this._lemonCount=0; this._lemonadeFill=0;

    if(this._chickenMesh){ this._chickenMesh.material.color.copy(RAW_COLOR); this._chickenMesh.visible=false; }
    if(this._rawDisplay){  this._rawDisplay.material.color.copy(RAW_COLOR); this._rawDisplay.visible=true; }
    this._vegMeshes.forEach(m=>{ m.visible=true; m.scale.set(1,1,1); m.position.y=1.098; });
    this._lemonMeshes.forEach(m=>{ m.visible=true; m.scale.set(1.32,0.90,1.10); });
    if(this._liqMesh){ this._liqMesh.visible=false; this._liqMesh.scale.y=0.01; }
    this._resetSauceCanvas();
    if(this._burnerGlow) this._burnerGlow.intensity=0;
    if(this._grillCtx)   this._grillCtx.clearRect(0,0,128,128);
    if(this._grillMarkMesh) this._grillMarkMesh.material.opacity=0;
    if(this._panFlashMesh)  this._panFlashMesh.material.opacity=0;
    this._panFlashT=-1;
    if(this._knifeGroup){ this._knifeGroup.position.y=1.058; this._knifeGroup.rotation.x=0; }
    if(this._spicePool)  this._spicePool.reset();
    if(this._steamPool)  this._steamPool.reset();
    if(this._smokePool)  this._smokePool.reset();
    if(this._saucePool)  this._saucePool.reset();
    if(this._lemonPool)  this._lemonPool.reset();

    this.fp.teleport(0,0,4,Math.PI); this.fp.speed=4;
    this._updateStepHUD();
    this.engine.audio.play('music',110);
  }

  onExit(){
    this.engine.audio.play('musicStop');
    this._hideBar();
    if(this._burnerGlow) this._burnerGlow.intensity=0;
  }

  // ══════════════════════════════════════════════════════════
  //  INTERACTIONS
  // ══════════════════════════════════════════════════════════
  _interactSeason(){
    if(this.step!==STEP.SEASON) return;
    this._seasonCount++;
    this.engine.audio.play('whoosh');
    if(this._spiceJarMesh) this._spiceJarMesh.userData.shakeT=0;
    const jarPos=new THREE.Vector3(-6.5,1.22,-5.64);
    for(let i=0;i<10;i++){
      const vel=new THREE.Vector3(rng(-0.5,0.5),rng(0.4,1.1),rng(-0.3,0.4));
      this._spicePool.spawn(jarPos,vel,0.6+Math.random()*0.35,t=>1-t);
    }
    if(this._rawDisplay){
      const t=this._seasonCount/this._seasonNeeded;
      this._rawDisplay.material.color.setHSL(0.05,0.80,0.74-t*0.08);
    }
    if(this._seasonCount>=this._seasonNeeded) this._finishSeason();
  }

  _finishSeason(){
    if(this._rawDisplay) this._rawDisplay.visible=false;
    if(this._chickenMesh){ this._chickenMesh.visible=true; this._chickenMesh.material.color.copy(RAW_COLOR); }
    this.engine.audio.play('pickup');
    this.step=STEP.CHICKEN; this._updateStepHUD();
    this.engine.hud.showPrompt('✅ Seasoned! Head to the stove to grill.');
    setTimeout(()=>this.engine.hud.hidePrompt(),2200);
  }

  _interactChicken(){
    if(this.step!==STEP.CHICKEN) return;
    if(this._flips===0) this._burnerGlow.intensity=3.2;
    this._cookProgress+=0.20; this._flips++;
    this._isFlipping=true; this._flipT=0;
    this._panFlashT=0;
    const t=Math.min(this._cookProgress,1);
    this._chickenMesh.material.color.lerpColors(RAW_COLOR,COOKED_COLOR,t);
    this._drawGrillMarks(t);
    this.engine.audio.play('sizzle');
    const panPos=new THREE.Vector3(-3.44,1.14,-5.70);
    for(let i=0;i<6;i++){
      const vel=new THREE.Vector3(rng(-0.4,0.4),rng(0.7,1.8),rng(-0.4,0.4));
      this._spicePool.spawn(panPos,vel,0.38+Math.random()*0.25,t=>1-t);
    }
    if(this._flips>=4&&this._cookProgress>=0.72) this._finishChicken();
  }

  _drawGrillMarks(t){
    const ctx=this._grillCtx;
    ctx.clearRect(0,0,128,128);
    ctx.strokeStyle=`rgba(22,8,2,${Math.min(t*1.2,0.85)})`;
    ctx.lineWidth=6;
    const marks=Math.floor(t*5)+1;
    for(let i=0;i<marks;i++){ ctx.beginPath(); ctx.moveTo(10+i*20,10); ctx.lineTo(30+i*20,118); ctx.stroke(); }
    ctx.lineWidth=5;
    for(let i=0;i<marks-1;i++){ ctx.beginPath(); ctx.moveTo(10,10+i*26); ctx.lineTo(118,30+i*26); ctx.stroke(); }
    this._grillTex.needsUpdate=true;
    this._grillMarkMesh.material.opacity=Math.min(t,0.85);
  }

  _finishChicken(){
    this._cookProgress=1;
    this._chickenMesh.material.color.copy(COOKED_COLOR);
    this._burnerGlow.intensity=0;
    this._drawGrillMarks(1);
    this.engine.audio.play('pickup');
    this.step=STEP.CHOP; this._updateStepHUD();
    this.engine.hud.showPrompt('✅ Chicken grilled! Head to the chopping board.');
    setTimeout(()=>this.engine.hud.hidePrompt(),2200);
  }

  _interactChop(){
    if(this.step!==STEP.CHOP) return;
    this._chopCount++;
    this.engine.audio.play('chop');
    this._knifeT=0;
    const vm=this._vegMeshes[Math.floor(Math.random()*this._vegMeshes.length)];
    if(vm&&vm.visible){ vm.userData.squishT=0; if(this._chopCount%4===0) this._spawnChopPiece(vm); }
    if(this._chopCount>=this._chopNeeded) this._finishChop();
  }

  _spawnChopPiece(src){
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.052,0.036,0.052),
      new THREE.MeshStandardMaterial({color:src.material.color.getHex(),roughness:0.68}));
    p.position.copy(src.position);
    p.position.x+=(Math.random()-0.5)*0.26;
    p.position.z+=(Math.random()-0.5)*0.26;
    p.userData.vy=0.055+Math.random()*0.07;
    p.userData.vx=(Math.random()-0.5)*0.04;
    p.userData.vz=(Math.random()-0.5)*0.04;
    p.userData.rx=rng(-5,5); p.userData.rz=rng(-5,5);
    p.userData.fallen=false;
    this.scene.add(p); this._chopPieces.push(p);
  }

  _finishChop(){
    this._vegMeshes.forEach(m=>{ m.scale.set(1,0.12,1); m.position.y=1.004; });
    this.engine.audio.play('pickup');
    this.step=STEP.SAUCE; this._updateStepHUD();
    this.engine.hud.showPrompt('✅ Veggies chopped! Spread sauce on the bread.');
    setTimeout(()=>this.engine.hud.hidePrompt(),2200);
  }

  _interactSauceE(){
    if(this.step!==STEP.SAUCE) return;
    for(let i=0;i<3;i++) this._paintSauce(0.2+Math.random()*0.6, 0.2+Math.random()*0.6);
  }

  _paintSauce(u,v){
    const ctx=this._sauceCtx;
    const px=u*256, py=(1-v)*256, r=20+Math.random()*12;
    ctx.globalAlpha=0.52;
    const g=ctx.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,'rgba(200,30,8,0.98)');
    g.addColorStop(0.5,'rgba(180,22,6,0.52)');
    g.addColorStop(1,'rgba(140,12,4,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1; this._sauceTex.needsUpdate=true;

    if(this._brushGroup){
      const min=this._breadWorldMin, max=this._breadWorldMax;
      this._brushGroup.position.x=min.x+u*(max.x-min.x);
      this._brushGroup.position.z=min.z+v*(max.z-min.z);
      this._brushT=0;
    }
    if(Math.random()<0.35){
      const bx=4;
      const dp=new THREE.Vector3(bx-0.23+u*0.46,1.09,-5.5-0.17+v*0.34);
      for(let i=0;i<3;i++){
        const vel=new THREE.Vector3(rng(-0.35,0.35),rng(0.28,0.72),rng(-0.28,0.28));
        this._saucePool.spawn(dp,vel,0.28+Math.random()*0.18,t=>1-t);
      }
    }
    this._saucePaintCount++;
    if(this._saucePaintCount%5===0){
      const d=ctx.getImageData(10,10,236,236).data;
      let red=0,total=0;
      for(let i=0;i<d.length;i+=16){ total++; if(d[i]>110&&d[i+1]<55) red++; }
      this._sauceCoverage=red/total;
      if(this._sauceCoverage>0.46&&this.step===STEP.SAUCE) this._finishSauce();
    }
  }

  _finishSauce(){
    if(this.step!==STEP.SAUCE) return;
    const ctx=this._sauceCtx;
    ctx.globalAlpha=0.52; ctx.fillStyle='rgba(180,28,8,0.68)'; ctx.fillRect(10,10,236,236);
    ctx.globalAlpha=1; this._sauceTex.needsUpdate=true;
    this.engine.audio.play('pickup');
    this.step=STEP.LEMON; this._updateStepHUD();
    this.engine.hud.showPrompt('✅ Sauce spread! Now squeeze lemons for lemonade.');
    setTimeout(()=>this.engine.hud.hidePrompt(),2400);
  }

  _interactLemon(){
    if(this.step!==STEP.LEMON) return;
    if(this._lemonCount>=this._lemonNeeded) return;
    this._lemonCount++;
    this.engine.audio.play('pickup');
    const lem=this._lemonMeshes[this._lemonCount-1];
    if(lem) lem.userData.squeezeT=0;
    this._lemonadeFill=this._lemonCount/this._lemonNeeded;
    if(this._liqMesh){
      this._liqMesh.visible=true;
      this._liqMesh.scale.set(1,Math.max(0.01,this._lemonadeFill*32),1);
      this._liqMesh.position.y=1.01+(this._lemonadeFill*0.16)/2;
    }
    const lp=new THREE.Vector3(7.42,1.15,-5.5);
    for(let i=0;i<5;i++){
      const target=new THREE.Vector3(7,1.10,-5.5);
      const vel=target.clone().sub(lp).normalize().multiplyScalar(rng(0.55,1.0));
      vel.y=rng(0.55,1.3);
      this._lemonPool.spawn(lp,vel,0.45+Math.random()*0.28,t=>Math.max(0,1-t*1.4));
    }
    if(this._lemonCount>=this._lemonNeeded) this._finishLemon();
  }

  _finishLemon(){
    this.engine.audio.play('cash');
    this.step=STEP.DONE; this._updateStepHUD();
    setTimeout(()=>this._showComplete(),500);
  }

  _showComplete(){
    this.engine.hud.showOverlay(`
      <div style="font-size:46px">🍗🥒🍞🍋✨</div>
      <div style="font-size:24px;font-weight:900;font-family:serif;
        background:linear-gradient(135deg,#8a5008,#d09020,#6a3008);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent">
        Feast Ready!</div>
      <div style="font-size:14px;color:#7a5830;text-align:center;max-width:300px;line-height:2;font-family:serif">
        🧂 Herb-seasoned chicken ✅<br>
        🥒 Fresh garden veggies ✅<br>
        🍞 Saucy open bread ✅<br>
        🍋 Fresh lemonade ✅<br>
        <span style="color:#4a9030">Avicula: "It smells amazing!" ⭐</span>
      </div>
    `,'Pack the basket! 🎒',()=>this.engine.nextLevel('cooking'));
  }

  // ══════════════════════════════════════════════════════════
  //  UPDATE
  // ══════════════════════════════════════════════════════════
  update(dt){
    this.fp.update(dt, this.collidables);
    const now=performance.now()*0.001;

    // clock
    this._clockT+=dt;
    if(this._clockHandMin) this._clockHandMin.rotation.z=this._clockT*0.10;
    if(this._clockHandHr)  this._clockHandHr.rotation.z=this._clockT*0.0083;

    // candle flicker
    this._candleLights.forEach(cl=>{
      cl.intensity=0.48+Math.sin(now*6.8)*0.12+Math.sin(now*11.2)*0.06;
    });
    const flames=this.scene.userData.flames||[];
    flames.forEach(f=>{
      f.position.y=f.userData.baseY+Math.sin(now*8.5+f.position.x)*0.006;
      f.scale.x=1+Math.sin(now*10+f.position.z)*0.14;
      f.material.opacity=0.88+Math.sin(now*7)*0.08;
    });

    // spice jar shake
    if(this._spiceJarMesh?.userData.shakeT!=null){
      const st=this._spiceJarMesh.userData.shakeT+=dt*11;
      this._spiceJarMesh.rotation.z=Math.sin(st)*0.34*(1-st/Math.PI);
      this._spiceJarMesh.position.y=1.11+Math.abs(Math.sin(st*2))*0.05;
      if(st>Math.PI){ this._spiceJarMesh.rotation.z=0; this._spiceJarMesh.position.y=1.11; delete this._spiceJarMesh.userData.shakeT; }
    }

    // particle pools
    this._spicePool?.update(dt,this._gravity);
    this._saucePool?.update(dt,this._gravity);
    this._lemonPool?.update(dt,this._gravity);
    // steam (lighter gravity)
    if(this.step===STEP.CHICKEN&&this._cookProgress>0.04){
      this._updateSteam(dt);
    }

    // chicken flip
    if(this._isFlipping){
      this._flipT+=dt*6;
      this._chickenMesh.rotation.x=Math.sin(this._flipT)*Math.PI;
      if(this._flipT>Math.PI){ this._isFlipping=false; this._chickenMesh.rotation.x=0; }
    }

    // pan flash
    if(this._panFlashT>=0){
      this._panFlashT+=dt*3.5;
      if(this._panFlashMesh) this._panFlashMesh.material.opacity=Math.max(0,0.65-this._panFlashT*0.65);
      if(this._panFlashT>1){ this._panFlashT=-1; if(this._panFlashMesh) this._panFlashMesh.material.opacity=0; }
    }

    // burner glow pulse while cooking
    if(this.step===STEP.CHICKEN&&this._cookProgress>0){
      this._burnerGlow.intensity=2.8+Math.sin(now*11)*0.7+Math.sin(now*7)*0.4;
    }

    // knife animation
    if(this._knifeT>=0&&this._knifeGroup){
      this._knifeT+=dt*8.5;
      const arc=Math.sin(this._knifeT*Math.PI);
      this._knifeGroup.position.y=1.058+arc*0.26;
      this._knifeGroup.rotation.x=-arc*0.65;
      if(this._knifeT>1){ this._knifeT=-1; this._knifeGroup.position.y=1.058; this._knifeGroup.rotation.x=0; }
    }

    // veggie squish
    this._vegMeshes.forEach(m=>{
      if(m.userData.squishT!=null){
        m.userData.squishT+=dt*9;
        m.scale.y=1-0.32*Math.abs(Math.sin(m.userData.squishT*Math.PI));
        m.scale.x=1+0.13*Math.abs(Math.sin(m.userData.squishT*Math.PI));
        if(m.userData.squishT>1) delete m.userData.squishT;
      }
    });

    // chop piece physics
    this._chopPieces.forEach(p=>{
      if(!p.userData.fallen){
        p.userData.vy-=dt*2.6;
        p.position.y+=p.userData.vy*dt*60;
        p.position.x+=p.userData.vx;
        p.position.z+=p.userData.vz;
        p.rotation.x+=p.userData.rx*dt;
        p.rotation.z+=p.userData.rz*dt;
        if(p.position.y<=1.065){ p.position.y=1.065; p.userData.fallen=true; }
      }
    });

    // brush animation
    if(this._brushT>=0&&this._brushGroup){
      this._brushT+=dt*7.5;
      this._brushGroup.rotation.x=-0.38+Math.sin(this._brushT)*0.45;
      this._brushGroup.rotation.z=Math.sin(this._brushT*0.65)*0.28;
      this._brushGroup.position.y=1.18+Math.sin(this._brushT)*0.045;
      if(this._brushT>2){ this._brushT=-1; this._brushGroup.rotation.x=0; this._brushGroup.rotation.z=0; }
    }

    // sauce mouse-drag painting
    if(this.step===STEP.SAUCE&&this.engine.input.mouse.buttons[0]){
      const ray=this._raycaster;
      ray.setFromCamera(this._rayCenter,this.camera);
      const hits=ray.intersectObject(this._breadPlane);
      if(hits.length&&hits[0].uv){
        this._paintSauce(hits[0].uv.x,hits[0].uv.y);
        if(Math.random()<0.07) this.engine.audio.play('sizzle');
      }
    }

    // lemon squeeze animation
    this._lemonMeshes.forEach(m=>{
      if(m.userData.squeezeT!=null){
        m.userData.squeezeT+=dt*7.5;
        const q=m.userData.squeezeT;
        m.scale.y=0.90+Math.sin(q*Math.PI)*0.52;
        m.scale.x=1+Math.sin(q*Math.PI)*0.22;
        m.scale.z=1+Math.sin(q*Math.PI)*0.16;
        if(q>1){ m.visible=false; delete m.userData.squeezeT; }
      }
    });

    // HUD bar
    switch(this.step){
      case STEP.SEASON:
        this._showBar(`🧂 Seasoning… ${this._seasonCount}/${this._seasonNeeded}`,
          this._seasonCount/this._seasonNeeded); break;
      case STEP.CHICKEN:
        if(this._cookProgress>0)
          this._showBar(`🍗 Grilling… flip ${Math.max(0,4-this._flips)} more!`,this._cookProgress); break;
      case STEP.CHOP:
        this._showBar(`🥒 Chopping… ${this._chopCount}/${this._chopNeeded}`,
          this._chopCount/this._chopNeeded); break;
      case STEP.SAUCE:
        this._showBar(`🍅 Spread sauce — ${Math.round(this._sauceCoverage*100)}% covered`,
          this._sauceCoverage/0.46); break;
      case STEP.LEMON:
        this._showBar(`🍋 Squeeze lemons — ${this._lemonCount}/${this._lemonNeeded}`,
          this._lemonCount/this._lemonNeeded); break;
      case STEP.DONE:
        this._hideBar(); break;
    }

    // interactor
    const hov=this.interactor.update(this.interactables);
    const promptMap={
      [STEP.SEASON]:  [this._seasonZone,  '[E] Shake spice jar'],
      [STEP.CHICKEN]: [this._stoveZone,   '[E] Flip the chicken'],
      [STEP.CHOP]:    [this._chopZone,    '[E] Chop!'],
      [STEP.SAUCE]:   [this._sauceZone,   '[Hold Click] Drag sauce  /  [E] Quick dab'],
      [STEP.LEMON]:   [this._lemonZone,   '[E] Squeeze lemon'],
    };
    const pm=promptMap[this.step];
    const isSauce=this.step===STEP.SAUCE&&(hov===this._sauceZone||hov===this._breadPlane);
    if(pm&&(hov===pm[0]||isSauce)){
      this.engine.hud.showPrompt(isSauce?'[Hold Click] Drag sauce  /  [E] Quick dab':pm[1]);
      this.engine.hud.crosshairColor('#d08020');
    } else {
      if(this.step!==STEP.DONE) this.engine.hud.hidePrompt();
      this.engine.hud.crosshairColor('white');
    }
  }

  _updateSteam(dt){
    const o=this._steamOrigin;
    this._steamPool.update(dt,-0.05); // steam rises
    // respawn
    if(Math.random()<0.20){
      const vel=new THREE.Vector3((Math.random()-0.5)*0.06,0.5+Math.random()*0.3,(Math.random()-0.5)*0.04);
      this._steamPool.spawn(
        new THREE.Vector3(o.x+(Math.random()-0.5)*0.14,o.y,o.z+(Math.random()-0.5)*0.14),
        vel, 0.7+Math.random()*0.5, t=>0.36*(1-t)
      );
    }
    if(this._cookProgress>0.38&&Math.random()<0.06){
      const vel=new THREE.Vector3((Math.random()-0.5)*0.07,0.24+Math.random()*0.15,(Math.random()-0.5)*0.07);
      this._smokePool.update(dt,-0.04);
      this._smokePool.spawn(
        new THREE.Vector3(o.x+(Math.random()-0.5)*0.10,o.y+0.12,o.z+(Math.random()-0.5)*0.10),
        vel, 1.4+Math.random()*0.7, t=>0.12*(1-t)
      );
    }
  }

  // ── Step HUD ──────────────────────────────────────────────
  _updateStepHUD(){
    const steps=[
      {s:STEP.SEASON,  icon:'🧂',text:'Season the chicken'},
      {s:STEP.CHICKEN, icon:'🍗',text:'Grill the chicken (flip ×4)'},
      {s:STEP.CHOP,    icon:'🥒',text:'Chop the vegetables'},
      {s:STEP.SAUCE,   icon:'🍞',text:'Spread sauce on bread'},
      {s:STEP.LEMON,   icon:'🍋',text:'Squeeze lemons for lemonade'},
    ];
    const rows=steps.map(r=>`
      <div style="opacity:${this.step===r.s?1:this.step>r.s?0.55:0.35};
        color:${this.step>r.s?'#5a9040':this.step===r.s?'#8a5010':'#7a6040'};
        text-decoration:${this.step>r.s?'line-through':'none'};
        font-weight:${this.step===r.s?700:400};font-family:serif;font-size:13px">
        ${this.step>r.s?'✅':this.step===r.s?'▶':'◻'} ${r.icon} ${r.text}
      </div>`).join('');
    this.engine.hud.setInfo(`
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#7a4808;font-family:serif">🍳 Cooking Steps</div>
      ${rows}
      <div style="font-size:11px;opacity:0.50;margin-top:6px;font-family:serif">Walk to station · E to interact</div>`);
  }

  onInteract(){
    const hov=this.interactor.update(this.interactables);
    if(!hov) return;
    if(hov===this._seasonZone)                              this._interactSeason();
    else if(hov===this._stoveZone)                          this._interactChicken();
    else if(hov===this._chopZone)                           this._interactChop();
    else if(hov===this._sauceZone||hov===this._breadPlane)  this._interactSauceE();
    else if(hov===this._lemonZone)                          this._interactLemon();
  }
}