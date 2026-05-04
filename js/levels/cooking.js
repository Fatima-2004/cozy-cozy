// ============================================================
//  STARRY PICNIC — levels/cooking.js
//  First-person interactive kitchen
//
//  TASKS (in order):
//   1. Season the raw chicken  (shake spice jar ×4)
//   2. Grill chicken            (flip on pan ×4)
//   3. Chop vegetables          (18 chops)
//   4. Spread sauce on bread    (hold click — fixed flat-bread)
//   5. Make lemonade            (squeeze 4 lemons into jug)
// ============================================================

import { cookingBackground } from '../backgrounds.js';
import * as THREE from 'three';
import { Level, Anime, Build, FPController, Interactor } from '../engine.js';

// ── Step IDs ─────────────────────────────────────────────────
const STEP = { SEASON:0, CHICKEN:1, CHOP:2, SAUCE:3, LEMON:4, DONE:5 };

// ── Colors ───────────────────────────────────────────────────
const RAW_COLOR    = new THREE.Color(0xffbbaa);
const COOKED_COLOR = new THREE.Color(0x7b3e10);

// ─────────────────────────────────────────────────────────────
export class Cooking extends Level {
// ─────────────────────────────────────────────────────────────

  constructor(engine) {
    super(engine);
    this.fp         = new FPController(this.camera, engine.input);
    this.fp.speed   = 3.5;
    this.interactor = new Interactor(this.camera, this.scene);

    this.step = STEP.SEASON;

    // season state
    this._seasonCount  = 0;
    this._seasonNeeded = 4;
    this._spiceJarMesh = null;
    this._seasonZone   = null;

    // chicken / grill
    this._cookProgress = 0;
    this._flips        = 0;
    this._isFlipping   = false;
    this._flipT        = 0;
    this._chickenMesh  = null;
    this._burnerGlow   = null;
    this._steamParticles = [];
    this._stoveZone    = null;

    // chop
    this._chopCount   = 0;
    this._chopNeeded  = 18;
    this._vegMeshes   = [];
    this._chopPieces  = [];
    this._chopZone    = null;

    // sauce / bread
    this._sauceCanvas   = null;
    this._sauceCtx      = null;
    this._sauceTex      = null;
    this._breadPlane    = null;
    this._sauceCoverage = 0;
    this._sauceZone     = null;

    // lemonade
    this._lemonCount   = 0;
    this._lemonNeeded  = 4;
    this._lemonMeshes  = [];
    this._lemonadeFill = 0;   // 0→1 jug fill level
    this._jugMesh      = null;
    this._liqMesh      = null; // liquid inside jug
    this._lemonZone    = null;

    // DOM
    this._mgEl    = null;
    this._mgLabel = null;
    this._mgFill  = null;
  }

  // ══════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════
  init() {
    const s = this.scene;
    this._sky = cookingBackground(this.scene);

    this._buildFloor(s);
    this._buildWalls(s);
    this._buildUpperCabinets(s);
    this._buildCounters(s);
    this._buildStove(s);
    this._buildChopStation(s);
    this._buildSauceStation(s);
    this._buildLemonStation(s);
    this._buildSeasonStation(s);
    this._buildKitchenProps(s);
    this._buildAvicula(s);
    this._buildMiniHUD();
  }

  // ── Floor — checkerboard tile ─────────────────────────────
  _buildFloor(s) {
    const mats = [Anime.mat(0x8b5e3c), Anime.mat(0x7a4f30)];
    const geo  = new THREE.PlaneGeometry(1.5,1.5);
    for(let tx=-8;tx<=8;tx++) for(let tz=-7;tz<=7;tz++){
      const m = new THREE.Mesh(geo, mats[(tx+tz+100)%2]);
      m.rotation.x=-Math.PI/2; m.position.set(tx*1.5,0.001,tz*1.5);
      m.receiveShadow=true; s.add(m);
    }
  }

  // ── Walls + ceiling ───────────────────────────────────────
  _buildWalls(s) {
    const wm = Anime.mat(0xc4956a);
    [[0,2,-7,18,4,0.2],[0,2,7,18,4,0.2],[-9,2,0,0.2,4,14],[9,2,0,0.2,4,14]]
      .forEach(([x,y,z,w,h,d])=>{
        const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wm);
        m.position.set(x,y,z); m.receiveShadow=true; s.add(m);
        this.collidables.push(new THREE.Box3(
          new THREE.Vector3(x-w/2,0,z-d/2),
          new THREE.Vector3(x+w/2,h,z+d/2)));
      });
    // ceiling
    const ceil=new THREE.Mesh(new THREE.PlaneGeometry(18,14),Anime.mat(0xfffbf0));
    ceil.rotation.x=Math.PI/2; ceil.position.set(0,4,0); s.add(ceil);

    // hanging pendant lights (two)
    [-3,3].forEach(lx=>{
      const cord=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.9,6),Anime.mat(0x555566));
      cord.position.set(lx,3.55,0); s.add(cord);
      const shade=new THREE.Mesh(new THREE.ConeGeometry(0.38,0.28,10,1,true),Anime.mat(0xffcc88));
      shade.rotation.x=Math.PI; shade.position.set(lx,3.1,0); s.add(shade);
      Anime.outline(shade,0.03);
      const pt=new THREE.PointLight(0xfffacc,1.6,10); pt.position.set(lx,3.0,0); s.add(pt);
    });

    // wall clock
    const clockFace=new THREE.Mesh(new THREE.CircleGeometry(0.38,20),Anime.mat(0xfff8f0));
    clockFace.position.set(-8.85,2.8,-2); clockFace.rotation.y=Math.PI/2; s.add(clockFace);
    Anime.outline(clockFace,0.03);
    const clockRim=new THREE.Mesh(new THREE.TorusGeometry(0.38,0.04,8,20),Anime.mat(0x886644));
    clockRim.position.set(-8.82,2.8,-2); clockRim.rotation.y=Math.PI/2; s.add(clockRim);
    // clock hands
    [{ len:0.22,w:0.025,angle:0.5 },{ len:0.15,w:0.035,angle:2.2 }].forEach(h=>{
      const hand=new THREE.Mesh(new THREE.BoxGeometry(h.w,h.len,0.02),Anime.mat(0x222233));
      hand.position.set(-8.80,2.8+(Math.cos(h.angle)*h.len/2),-2+Math.sin(h.angle)*h.len/2);
      hand.rotation.y=Math.PI/2; hand.rotation.z=h.angle; s.add(hand);
    });

    // calendar on back wall
    {
      const c=document.createElement('canvas'); c.width=128; c.height=160;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,128,160);
      ctx.fillStyle='#ff6688'; ctx.fillRect(0,0,128,36);
      ctx.fillStyle='#fff'; ctx.font='bold 18px sans-serif';
      ctx.textAlign='center'; ctx.fillText('JUNE',64,24);
      ctx.fillStyle='#333'; ctx.font='14px monospace';
      ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach((d,i)=>{ctx.fillText(d,12+i*16,52);});
      ctx.fillStyle='#555';
      for(let day=1;day<=30;day++){const row=Math.floor((day+5)/7),col=(day+5)%7; ctx.fillText(day,12+col*16,68+row*16);}
      ctx.fillStyle='#ff6688'; ctx.font='bold 14px monospace'; ctx.fillText('15',12+6*16,68+2*16);
      const cal=new THREE.Mesh(new THREE.PlaneGeometry(0.8,1.0),
        new THREE.MeshBasicMaterial({map:(() => { const _t = new THREE.CanvasTexture(c); _t.channel = 0; return _t; })()}));
      cal.position.set(3,2.5,-6.88); s.add(cal);
    }
  }

  // ── Upper wall cabinets ───────────────────────────────────
  _buildUpperCabinets(s) {
    const cabMat  = Anime.mat(0xeecc99);
    const doorMat = Anime.mat(0xddbb88);
    // back wall upper cabinet strip
    for(let cx=-6;cx<=6;cx+=3){
      const cab=new THREE.Mesh(new THREE.BoxGeometry(2.8,0.9,0.5),cabMat);
      cab.position.set(cx,3.5,-6.77); s.add(cab); Anime.outline(cab,0.025);
      // two doors per cabinet
      [-0.68,0.68].forEach(ox=>{
        const door=new THREE.Mesh(new THREE.BoxGeometry(1.26,0.78,0.06),doorMat);
        door.position.set(cx+ox,3.5,-6.53); s.add(door); Anime.outline(door,0.02);
        const knob=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,4),Anime.mat(0x997755));
        knob.position.set(cx+ox*0.85,3.5,-6.50); s.add(knob);
      });
    }
  }

  // ── Base counters (back + lower cabinets) ─────────────────
  _buildCounters(s) {
    // main back counter top
    const top=new THREE.Mesh(new THREE.BoxGeometry(16,0.12,1.1),Anime.mat(0xffe4b0));
    top.position.set(0,0.98,-5.5); top.castShadow=true; top.receiveShadow=true;
    s.add(top); Anime.outline(top,0.025);
    const body=new THREE.Mesh(new THREE.BoxGeometry(16,1.0,1.1),Anime.mat(0xcc9966));
    body.position.set(0,0.5,-5.5); s.add(body); Anime.outline(body,0.025);
    for(let cx=-7;cx<=7;cx+=2){
      const door=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.78,0.06),Anime.mat(0xddaa77));
      door.position.set(cx,0.5,-5.03); s.add(door); Anime.outline(door,0.02);
      const knob=new THREE.Mesh(new THREE.SphereGeometry(0.045,6,4),Anime.mat(0x886644));
      knob.position.set(cx+0.58,0.5,-4.98); s.add(knob);
    }
    this.collidables.push(new THREE.Box3(
      new THREE.Vector3(-8,0,-6.1),new THREE.Vector3(8,1.1,-5.0)));

    // sink (right-of-centre)
    this._buildSink(s, 2.8, -5.5);

    // toaster
    this._buildToaster(s, -2.0, -5.5);

    // kettle
    this._buildKettle(s, -3.4, -5.5);

    // blender
    this._buildBlender(s, 4.5, -5.5);

    // salt & pepper shakers
    [[7.0,0xeeeeee,'SALT'],[7.5,0x222233,'PEPPER']].forEach(([bx,col,lbl])=>{
      const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.06,0.18,10),Anime.mat(col));
      sh.position.set(bx,1.12,-5.5); s.add(sh); Anime.outline(sh,0.02);
    });

    // paper towel holder
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.4,8),Anime.mat(0x888899));
    rod.rotation.z=Math.PI/2; rod.position.set(6.2,1.22,-5.5); s.add(rod);
    const roll=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.36,12),
      Anime.mat(0xffffff,0.3));
    roll.rotation.z=Math.PI/2; roll.position.set(6.2,1.22,-5.5); s.add(roll); Anime.outline(roll,0.02);

    // fruit bowl near recipe book
    this._buildFruitBowl(s, 2.2, -5.5);

    // dish rack with plates
    this._buildDishRack(s, -7.5, -5.5);

    // recipe book
    const book=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.04,0.40),Anime.mat(0xff88aa));
    book.position.set(1.2,1.06,-5.5); book.rotation.y=0.2; s.add(book); Anime.outline(book,0.03);
    Build.label(s,'📖 Recipe',1.2,1.6,-5.5,'#fff','rgba(80,20,60,0.8)');

    // window
    this._buildWindow(s);
  }

  _buildSink(s, x, z) {
    const basin=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.08,0.55),Anime.mat(0xddddee,0.2,0.6));
    basin.position.set(x,0.96,z); s.add(basin); Anime.outline(basin,0.025);
    const inner=new THREE.Mesh(new THREE.BoxGeometry(0.68,0.06,0.44),Anime.mat(0xccccdd,0.1,0.7));
    inner.position.set(x,0.94,z); s.add(inner);
    // tap
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.25,8),Anime.mat(0x999aaa,0.2,0.8));
    pipe.position.set(x,1.18,z-0.18); s.add(pipe);
    const spout=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.18,8),Anime.mat(0x999aaa,0.2,0.8));
    spout.rotation.x=Math.PI/3; spout.position.set(x,1.28,z-0.08); s.add(spout);
    // handles
    [-0.07,0.07].forEach(ox=>{
      const h=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.1,6),Anime.mat(0x888899));
      h.rotation.z=Math.PI/2; h.position.set(x+ox*3,1.22,z-0.22); s.add(h);
    });
  }

  _buildToaster(s, x, z) {
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.22,0.22),Anime.mat(0x888899,0.3,0.5));
    body.position.set(x,1.1,z); s.add(body); Anime.outline(body,0.03);
    // slots
    [-0.07,0.07].forEach(ox=>{
      const slot=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.02,0.14),Anime.mat(0x222233));
      slot.position.set(x+ox,1.22,z); s.add(slot);
    });
    // lever
    const lev=new THREE.Mesh(new THREE.BoxGeometry(0.025,0.10,0.025),Anime.mat(0xcccccc));
    lev.position.set(x+0.13,1.09,z+0.05); s.add(lev);
  }

  _buildKettle(s, x, z) {
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.11,0.22,12),Anime.mat(0x334466,0.3,0.5));
    body.position.set(x,1.11,z); s.add(body); Anime.outline(body,0.03);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.04,10),Anime.mat(0x223355));
    lid.position.set(x,1.23,z); s.add(lid);
    const spout=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.03,0.18,8),Anime.mat(0x334466));
    spout.rotation.z=-Math.PI/5; spout.position.set(x+0.14,1.14,z); s.add(spout);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(0.075,0.018,6,10,Math.PI),Anime.mat(0x111122));
    handle.rotation.z=Math.PI/2; handle.position.set(x-0.12,1.12,z); s.add(handle);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.115,0.115,0.03,12),Anime.mat(0x222233,0.3,0.6));
    base.position.set(x,0.99,z); s.add(base);
  }

  _buildBlender(s, x, z) {
    const base=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.11,0.12,10),Anime.mat(0x222233,0.3,0.6));
    base.position.set(x,1.04,z); s.add(base); Anime.outline(base,0.03);
    const jug=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.10,0.26,10),
      new THREE.MeshStandardMaterial({color:0xaaddff,transparent:true,opacity:0.55,roughness:0.1}));
    jug.position.set(x,1.23,z); s.add(jug);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.04,10),Anime.mat(0x222233));
    lid.position.set(x,1.38,z); s.add(lid);
  }

  _buildFruitBowl(s, x, z) {
    const bowl=new THREE.Mesh(new THREE.SphereGeometry(0.18,10,6,0,Math.PI*2,0,Math.PI/2),
      Anime.mat(0xc88844,0.5));
    bowl.position.set(x,1.07,z); bowl.rotation.x=Math.PI; s.add(bowl); Anime.outline(bowl,0.03);
    // fruit inside
    const fruits=[
      {c:0xff4444,r:0.07,ox:-0.06,oz:0.02},{c:0xffaa00,r:0.07,ox:0.06,oz:-0.03},
      {c:0xffff44,r:0.062,ox:0.00,oz:0.07},{c:0xcc3333,r:0.065,ox:-0.05,oz:-0.06},
    ];
    fruits.forEach(f=>{
      const fr=new THREE.Mesh(new THREE.SphereGeometry(f.r,8,6),Anime.mat(f.c));
      fr.position.set(x+f.ox,1.13+f.r,z+f.oz); s.add(fr); Anime.outline(fr,0.03);
    });
  }

  _buildDishRack(s, x, z) {
    // wire frame
    const rack=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.38,0.3),
      new THREE.MeshStandardMaterial({color:0x888899,wireframe:true}));
    rack.position.set(x,1.18,z); s.add(rack);
    // stacked plates
    [0,1,2].forEach(i=>{
      const plate=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.10,0.02,12),Anime.mat(0xfff8f0,0.4));
      plate.rotation.z=Math.PI/2+i*0.15;
      plate.position.set(x-0.12+i*0.05,1.18+i*0.02,z); s.add(plate); Anime.outline(plate,0.02);
    });
  }

  _buildWindow(s) {
    const fm=Anime.mat(0xddccaa);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(3.2,2.2,0.14),fm);
    frame.position.set(-1.5,2.4,-6.9); s.add(frame); Anime.outline(frame,0.04);
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(2.8,1.9),
      new THREE.MeshBasicMaterial({color:0x88d8ff,transparent:true,opacity:0.68}));
    glass.position.set(-1.5,2.4,-6.82); s.add(glass);
    // cross bars
    [[-0.7,0],[0.7,0]].forEach(([ox])=>{
      const bar=new THREE.Mesh(new THREE.BoxGeometry(0.1,1.9,0.08),fm);
      bar.position.set(-1.5+ox,2.4,-6.84); s.add(bar);
    });
    [0.5,-0.5].forEach(oy=>{
      const bar=new THREE.Mesh(new THREE.BoxGeometry(2.8,0.1,0.08),fm);
      bar.position.set(-1.5,2.4+oy,-6.84); s.add(bar);
    });
    for(let i=0;i<3;i++){
      const cl=new THREE.Mesh(new THREE.SphereGeometry(0.22+i*0.07,8,6),
        new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.88}));
      cl.scale.set(1.4,0.75,1); cl.position.set(-2.2+i*0.65,2.56,-6.6); s.add(cl);
    }
    // curtains
    const cm=Anime.mat(0xff99bb);
    [-3.0,0.0].forEach(cx=>{
      const ct=new THREE.Mesh(new THREE.PlaneGeometry(0.62,2.4),cm);
      ct.position.set(cx,2.4,-6.72); s.add(ct); Anime.outline(ct,0.04);
    });
    // pot plant on windowsill
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.08,0.16,8),Anime.mat(0xcc6633));
    pot.position.set(-1.5,1.14,-6.65); s.add(pot); Anime.outline(pot,0.03);
    for(let i=0;i<5;i++){
      const leaf=new THREE.Mesh(new THREE.SphereGeometry(0.06,6,5),Anime.mat(0x44cc44));
      const a=(i/5)*Math.PI*2;
      leaf.position.set(-1.5+Math.cos(a)*0.09,1.34+Math.random()*0.06,-6.65+Math.sin(a)*0.09);
      leaf.scale.set(1.2,0.7,1.2); s.add(leaf); Anime.outline(leaf,0.025);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  TASK 1 — SEASON STATION  (far left, x≈-6.5)
  // ══════════════════════════════════════════════════════════
  _buildSeasonStation(s) {
    const sx=-6.5, sz=-5.5;

    // spice shelf
    const shelf=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.06,0.32),Anime.mat(0xcc9966));
    shelf.position.set(sx,1.85,sz); s.add(shelf);
    // spice jars on shelf
    const spiceColors=[0xff8800,0xcc2200,0x228822,0xffcc00,0xaa44cc];
    spiceColors.forEach((c,i)=>{
      const j=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.16,8),Anime.mat(c));
      j.position.set(sx-0.48+i*0.24,1.97,sz); s.add(j); Anime.outline(j,0.025);
      const jl=new THREE.Mesh(new THREE.CylinderGeometry(0.058,0.058,0.03,8),Anime.mat(0x999988));
      jl.position.set(sx-0.48+i*0.24,2.07,sz); s.add(jl);
    });

    // THE active spice jar (bigger, on counter — player shakes this)
    const sj=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.07,0.22,10),Anime.mat(0xff5500));
    sj.position.set(sx,1.13,sz-0.15); s.add(sj); Anime.outline(sj,0.04);
    const sjl=new THREE.Mesh(new THREE.CylinderGeometry(0.078,0.078,0.04,10),Anime.mat(0x888877));
    sjl.position.set(sx,1.25,sz-0.15); s.add(sjl);
    this._spiceJarMesh=sj;

    // raw chicken displayed here (plate)
    const plate=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.03,16),Anime.mat(0xfff8f0,0.3));
    plate.position.set(sx,1.01,sz+0.15); s.add(plate); Anime.outline(plate,0.03);
    this._rawChickenDisplay=new THREE.Mesh(
      new THREE.BoxGeometry(0.44,0.09,0.28),Anime.mat(RAW_COLOR.getHex()));
    this._rawChickenDisplay.position.set(sx,1.07,sz+0.15); s.add(this._rawChickenDisplay);
    Anime.outline(this._rawChickenDisplay,0.04);

    Build.label(s,'🧂 Season first!',sx,1.9,sz+0.8,'#fff','rgba(80,40,0,0.88)');
    this._seasonZone=this._zone(s,sx,sz+0.8,2.5,2.4);
    this._seasonZone.userData.onInteract=()=>this._interactSeason();
    this.interactables.push(this._seasonZone);
  }

  // ══════════════════════════════════════════════════════════
  //  TASK 2 — STOVE + GRILL  (x≈-3)
  // ══════════════════════════════════════════════════════════
  _buildStove(s) {
    const sx=-3, sz=-5.5;

    // oven body under counter
    const oven=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.96,1.05),Anime.mat(0x555566));
    oven.position.set(sx,0.5,sz); s.add(oven); Anime.outline(oven,0.04);
    const ovenDoor=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.5,0.06),Anime.mat(0x444455,0.2,0.4));
    ovenDoor.position.set(sx,0.32,sz-0.54); s.add(ovenDoor); Anime.outline(ovenDoor,0.03);
    const ovenGlass=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.36),
      new THREE.MeshBasicMaterial({color:0x334455,transparent:true,opacity:0.6}));
    ovenGlass.position.set(sx,0.33,sz-0.52); s.add(ovenGlass);
    const ovenHandle=new THREE.Mesh(new THREE.BoxGeometry(1.2,0.04,0.04),Anime.mat(0x888899));
    ovenHandle.position.set(sx,0.54,sz-0.55); s.add(ovenHandle);

    // stove top surface
    const stoveTop=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.06,1.05),Anime.mat(0x444455,0.2,0.5));
    stoveTop.position.set(sx,0.99,sz); s.add(stoveTop);

    // 4 burner rings
    [[-0.45,-0.2],[0.45,-0.2],[-0.45,0.2],[0.45,0.2]].forEach(([bx,bz])=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.20,0.04,6,18),Anime.mat(0x333344));
      ring.rotation.x=-Math.PI/2; ring.position.set(sx+bx,1.03,sz+bz); s.add(ring);
    });
    // knobs on front
    [[-0.5,-0.25,0],[0,0,0],[0.5,0.25,0]].forEach(([ox,,])=>{
      const knob=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.045,0.06,10),Anime.mat(0x888899));
      knob.rotation.x=Math.PI/2; knob.position.set(sx+ox,1.02,sz-0.54); s.add(knob);
    });

    // frying pan on front-left burner
    const pan=new THREE.Mesh(new THREE.CylinderGeometry(0.40,0.36,0.06,18),Anime.mat(0x222233));
    pan.position.set(sx-0.45,1.06,sz-0.2); s.add(pan); Anime.outline(pan,0.04);
    const panHandle=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.68,8),Anime.mat(0x111122));
    panHandle.rotation.z=Math.PI/2; panHandle.position.set(sx-0.45-0.60,1.06,sz-0.2); s.add(panHandle);
    // pan interior
    const panIn=new THREE.Mesh(new THREE.CircleGeometry(0.36,16),Anime.mat(0x333344,0.5));
    panIn.rotation.x=-Math.PI/2; panIn.position.set(sx-0.45,1.095,sz-0.2); s.add(panIn);

    // pot on back-right burner (decorative)
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.20,0.28,12),Anime.mat(0x3a5560,0.4,0.3));
    pot.position.set(sx+0.45,1.20,sz+0.2); s.add(pot); Anime.outline(pot,0.03);
    const potLid=new THREE.Mesh(new THREE.CylinderGeometry(0.23,0.23,0.04,12),Anime.mat(0x3a5560,0.4,0.3));
    potLid.position.set(sx+0.45,1.35,sz+0.2); s.add(potLid); Anime.outline(potLid,0.025);
    const potKnob=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,4),Anime.mat(0x888899));
    potKnob.position.set(sx+0.45,1.40,sz+0.2); s.add(potKnob);

    // overhead extractor hood
    const hood=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.18,1.2),Anime.mat(0x888899,0.3,0.4));
    hood.position.set(sx,2.92,sz); s.add(hood); Anime.outline(hood,0.03);
    const duct=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.6,0.4),Anime.mat(0x999aaa));
    duct.position.set(sx,3.31,sz); s.add(duct);

    // chicken on pan (appears/updates during step)
    this._chickenMesh=new THREE.Mesh(
      new THREE.BoxGeometry(0.50,0.09,0.30),Anime.mat(RAW_COLOR.getHex()));
    this._chickenMesh.position.set(sx-0.45,1.12,sz-0.20);
    this._chickenMesh.visible=false; s.add(this._chickenMesh);
    Anime.outline(this._chickenMesh,0.05);

    // steam particles
    for(let i=0;i<16;i++){
      const sp=new THREE.Mesh(new THREE.SphereGeometry(0.05,4,3),
        new THREE.MeshBasicMaterial({color:0xddddff,transparent:true,opacity:0}));
      sp.visible=false; s.add(sp);
      this._steamParticles.push({mesh:sp,life:0,maxLife:1,active:false});
    }

    // burner glow light
    this._burnerGlow=new THREE.PointLight(0xff4400,0,1.5);
    this._burnerGlow.position.set(sx-0.45,1.14,sz-0.20); s.add(this._burnerGlow);

    Build.label(s,'🍗 Grill Station',sx,2.1,sz+0.75,'#fff','rgba(80,20,0,0.88)');
    this._stoveZone=this._zone(s,sx,sz+0.8,2.4,2.2);
    this._stoveZone.userData.onInteract=()=>this._interactChicken();
    this.interactables.push(this._stoveZone);
  }

  // ══════════════════════════════════════════════════════════
  //  TASK 3 — CHOP STATION  (x≈0.5)
  // ══════════════════════════════════════════════════════════
  _buildChopStation(s) {
    const cx=0.5, cz=-5.5;

    // wooden cutting board (raised, thicker, realistic)
    const board=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.055,0.85),Anime.mat(0xc8944a));
    board.position.set(cx,1.03,cz); s.add(board); Anime.outline(board,0.03);
    // wood grain lines
    for(let gx=-0.58;gx<=0.58;gx+=0.14){
      const g=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.004,0.82),
        new THREE.MeshBasicMaterial({color:0xae7832}));
      g.position.set(cx+gx,1.06,cz); s.add(g);
    }
    // board feet
    [[-0.55,0.3],[0.55,0.3],[-0.55,-0.3],[0.55,-0.3]].forEach(([ox,oz])=>{
      const foot=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.04,0.08),Anime.mat(0xaa7833));
      foot.position.set(cx+ox,0.99,cz+oz); s.add(foot);
    });

    // chef's knife lying beside board
    const blade=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.004,0.52),Anime.mat(0xccccdd,0.1,0.7));
    blade.position.set(cx+0.82,1.06,cz-0.04); s.add(blade); Anime.outline(blade,0.018);
    const bevel=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.004,0.1),Anime.mat(0xbbbbcc));
    bevel.position.set(cx+0.82,1.06,cz+0.30); bevel.rotation.y=0.4; s.add(bevel);
    const kHandle=new THREE.Mesh(new THREE.BoxGeometry(0.095,0.038,0.20),Anime.mat(0x552211));
    kHandle.position.set(cx+0.82,1.064,cz+0.34); s.add(kHandle); Anime.outline(kHandle,0.025);
    // rivets on handle
    [0.08,0,0.08].forEach(oz=>{
      const riv=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.042,6),Anime.mat(0x888899));
      riv.rotation.x=Math.PI/2; riv.position.set(cx+0.82,1.064,cz+0.34+oz); s.add(riv);
    });

    // vegetables on board
    [
      {color:0x44bb55,geo:new THREE.CylinderGeometry(0.065,0.065,0.34,10),ox:-0.30,oz:0.00},
      {color:0xff3333,geo:new THREE.SphereGeometry(0.10,8,7),               ox: 0.10,oz:0.02},
      {color:0x55dd44,geo:new THREE.SphereGeometry(0.085,8,7),              ox:-0.06,oz:0.16},
      {color:0xffcc00,geo:new THREE.SphereGeometry(0.07,8,7),               ox: 0.28,oz:-0.10},
    ].forEach(v=>{
      const m=new THREE.Mesh(v.geo,Anime.mat(v.color));
      m.position.set(cx+v.ox,1.10,cz+v.oz); m.castShadow=true;
      s.add(m); Anime.outline(m,0.045);
      this._vegMeshes.push(m);
    });

    Build.label(s,'🥒 Chop Station',cx,2.1,cz+0.75,'#fff','rgba(0,60,20,0.88)');
    this._chopZone=this._zone(s,cx,cz+0.8,2.4,2.2);
    this._chopZone.userData.onInteract=()=>this._interactChop();
    this.interactables.push(this._chopZone);
  }

  // ══════════════════════════════════════════════════════════
  //  TASK 4 — SAUCE STATION  (x≈4)
  //  Fixed bread: proper 3D loaf slice, sauce canvas correctly aligned
  // ══════════════════════════════════════════════════════════
  _buildSauceStation(s) {
    const bx=4, bz=-5.5;

    // sauce jar (realistic)
    const jar=new THREE.Mesh(new THREE.CylinderGeometry(0.115,0.115,0.28,12),Anime.mat(0xff3322));
    jar.position.set(bx+0.68,1.13,bz-0.22); s.add(jar); Anime.outline(jar,0.035);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.045,12),Anime.mat(0xbb1100));
    lid.position.set(bx+0.68,1.28,bz-0.22); s.add(lid);
    // label on jar
    {
      const c=document.createElement('canvas'); c.width=64; c.height=80;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#ff3322'; ctx.fillRect(0,0,64,80);
      ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif';
      ctx.textAlign='center'; ctx.fillText('TOMATO',32,28); ctx.fillText('SAUCE',32,44);
      jar.material=new THREE.MeshStandardMaterial({map:(() => { const _t = new THREE.CanvasTexture(c); _t.channel = 0; return _t; })(),roughness:0.5});
    }
    // spreading knife/spatula
    const spatBlade=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.006,0.32),Anime.mat(0xccccdd,0.1,0.6));
    spatBlade.position.set(bx+0.68,1.28,bz); spatBlade.rotation.y=0.3; s.add(spatBlade);

    // ── BREAD SLICE (realistic flat open sandwich) ────────
    // Base loaf body — slightly rounded top using scaled sphere
    const breadBody=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.055,0.40),Anime.mat(0xd4963a));
    breadBody.position.set(bx,1.03,bz+0.04); s.add(breadBody);
    // Top rounded face (lighter crumb colour)
    const breadTop=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.018,0.36),Anime.mat(0xf5d080,0.6));
    breadTop.position.set(bx,1.06,bz+0.04); s.add(breadTop);
    // Crust rim (4 thin sides)
    const crustMat=Anime.mat(0xaa6422);
    [
      [bx,1.048,bz+0.04-0.20,0.52,0.03,0.012],// front crust
      [bx,1.048,bz+0.04+0.20,0.52,0.03,0.012],// back crust
      [bx-0.26,1.048,bz+0.04,0.012,0.03,0.40],// left crust
      [bx+0.26,1.048,bz+0.04,0.012,0.03,0.40],// right crust
    ].forEach(([x,y,z,w,h,d])=>{
      const c=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),crustMat);
      c.position.set(x,y,z); s.add(c);
    });
    Anime.outline(breadBody,0.04);

    // ── SAUCE CANVAS painted onto bread top surface ───────
    this._sauceCanvas=document.createElement('canvas');
    this._sauceCanvas.width=256; this._sauceCanvas.height=256;
    this._sauceCtx=this._sauceCanvas.getContext('2d');
    this._resetSauceCanvas();
    this._sauceTex=(() => { const _t = new THREE.CanvasTexture(this._sauceCanvas); _t.channel = 0; return _t; })();

    // PlaneGeometry exactly matching breadTop dimensions, sits right on top
    this._breadPlane=new THREE.Mesh(
      new THREE.PlaneGeometry(0.48,0.36),
      new THREE.MeshBasicMaterial({map:this._sauceTex,transparent:true,depthWrite:false}));
    this._breadPlane.rotation.x=-Math.PI/2;
    this._breadPlane.position.set(bx,1.072,bz+0.04); // just above breadTop
    s.add(this._breadPlane);
    this.interactables.push(this._breadPlane);
    this._breadPlane.userData.onInteract=()=>{};

    Build.label(s,'🍞 Spread Sauce',bx,2.1,bz+0.75,'#fff','rgba(80,40,0,0.88)');
    this._sauceZone=this._zone(s,bx,bz+0.8,2.4,2.2);
    this.interactables.push(this._sauceZone);
  }

  _resetSauceCanvas() {
    const ctx=this._sauceCtx;
    // Draw realistic bread crumb texture
    ctx.fillStyle='#e8ba58'; ctx.fillRect(0,0,256,256);
    // subtle grain
    for(let i=0;i<200;i++){
      ctx.fillStyle=`rgba(${160+Math.random()*40|0},${100+Math.random()*30|0},${30+Math.random()*20|0},0.18)`;
      ctx.beginPath();
      ctx.arc(Math.random()*256,Math.random()*256,1+Math.random()*3,0,Math.PI*2);
      ctx.fill();
    }
    // pores / holes
    for(let i=0;i<30;i++){
      ctx.fillStyle='rgba(120,70,20,0.22)';
      ctx.beginPath();
      ctx.ellipse(Math.random()*220+18,Math.random()*220+18,
        2+Math.random()*4,1+Math.random()*3,Math.random()*Math.PI,0,Math.PI*2);
      ctx.fill();
    }
    if(this._sauceTex) this._sauceTex.needsUpdate=true;
  }

  // ══════════════════════════════════════════════════════════
  //  TASK 5 — LEMON / LEMONADE STATION  (x≈7)
  // ══════════════════════════════════════════════════════════
  _buildLemonStation(s) {
    const lx=7, lz=-5.5;

    // glass jug
    this._jugMesh=new THREE.Mesh(
      new THREE.CylinderGeometry(0.14,0.12,0.38,12),
      new THREE.MeshStandardMaterial({color:0xaaddff,transparent:true,opacity:0.50,roughness:0.05,metalness:0.1}));
    this._jugMesh.position.set(lx,1.20,lz); s.add(this._jugMesh);
    Anime.outline(this._jugMesh,0.025);
    // jug handle
    const jugH=new THREE.Mesh(new THREE.TorusGeometry(0.09,0.022,6,10,Math.PI),Anime.mat(0x88aacc));
    jugH.rotation.z=Math.PI/2; jugH.position.set(lx-0.16,1.20,lz); s.add(jugH);
    // liquid level (starts empty, grows as lemons added)
    this._liqMesh=new THREE.Mesh(
      new THREE.CylinderGeometry(0.12,0.10,0.005,12),
      new THREE.MeshStandardMaterial({color:0xffee44,transparent:true,opacity:0.75}));
    this._liqMesh.position.set(lx,1.02,lz);
    this._liqMesh.visible=false; s.add(this._liqMesh);

    // lemons in small bowl
    const bowl=new THREE.Mesh(
      new THREE.SphereGeometry(0.15,10,6,0,Math.PI*2,0,Math.PI/2),
      Anime.mat(0xeecc44,0.5));
    bowl.rotation.x=Math.PI; bowl.position.set(lx+0.42,1.06,lz); s.add(bowl); Anime.outline(bowl,0.03);

    for(let i=0;i<4;i++){
      const lem=new THREE.Mesh(new THREE.SphereGeometry(0.065,8,6),Anime.mat(0xffee22));
      lem.scale.set(1.3,0.9,1.1); // lemon shape
      lem.position.set(lx+0.42+Math.cos(i*1.57)*0.07,1.13+Math.random()*0.02,lz+Math.sin(i*1.57)*0.07);
      s.add(lem); Anime.outline(lem,0.03);
      this._lemonMeshes.push(lem);
    }
    // juicer
    const juicer=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.12,0.08,10),Anime.mat(0xddcc88));
    juicer.position.set(lx+0.42,1.06,lz+0.28); s.add(juicer); Anime.outline(juicer,0.025);
    const cone=new THREE.Mesh(new THREE.ConeGeometry(0.065,0.10,10),Anime.mat(0xddcc88));
    cone.position.set(lx+0.42,1.13,lz+0.28); s.add(cone); Anime.outline(cone,0.02);

    Build.label(s,'🍋 Make Lemonade',lx,2.1,lz+0.75,'#fff','rgba(60,50,0,0.88)');
    this._lemonZone=this._zone(s,lx,lz+0.8,2.4,2.2);
    this._lemonZone.userData.onInteract=()=>this._interactLemon();
    this.interactables.push(this._lemonZone);
  }

  // ── Invisible trigger zone helper ────────────────────────
  _zone(s, x, z, w, d) {
    const m=new THREE.Mesh(
      new THREE.BoxGeometry(w,2.5,d),
      new THREE.MeshBasicMaterial({visible:false}));
    m.position.set(x,1.25,z); s.add(m); return m;
  }

  // ── Avicula helper character ──────────────────────────────
  _buildAvicula(s) {
    const g=new THREE.Group(); s.add(g);
    g.position.set(4,0,3.5); g.rotation.y=-Math.PI*0.6;
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.28,0.7,10),Anime.mat(0xffdd44));
    body.position.y=0.75; g.add(body); Anime.outline(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.26,12,10),Anime.mat(0xffe8c0));
    head.position.y=1.4; g.add(head); Anime.outline(head);
    const star=new THREE.Mesh(new THREE.OctahedronGeometry(0.10,0),Anime.mat(0xffcc00));
    star.position.set(0.10,1.72,0); star.rotation.z=Math.PI/5; g.add(star);
    [-0.09,0.09].forEach(ex=>{
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6),
        new THREE.MeshBasicMaterial({color:0x222200}));
      eye.position.set(ex,1.42,0.22); g.add(eye);
    });
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.04,0.48,6),Anime.mat(0xffdd44));
    arm.rotation.z=-Math.PI/2.4; arm.position.set(-0.44,1.1,-0.08); g.add(arm); Anime.outline(arm);
    g.userData.bobT=0; this.scene.userData.avicula=g;
  }

  // ── Kitchen props / decorations ───────────────────────────
  _buildKitchenProps(s) {
    // fridge (right wall)
    const fridge=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.2,0.82),Anime.mat(0xeeeeff));
    fridge.position.set(7.5,1.1,-3); s.add(fridge); Anime.outline(fridge,0.05);
    const fHandle=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.5,0.055),Anime.mat(0x888899));
    fHandle.position.set(7.02,1.2,-2.62); s.add(fHandle);
    // magnets
    [0xff6688,0x66aaff,0xffcc44,0x88ff88,0xff8844].forEach((c,i)=>{
      const mag=new THREE.Mesh(new THREE.BoxGeometry(0.10,0.10,0.028),Anime.mat(c));
      mag.position.set(7.03,1.5+i*0.14,-2.63); s.add(mag); Anime.outline(mag,0.015);
    });
    this.collidables.push(new THREE.Box3(new THREE.Vector3(7,0,-3.45),new THREE.Vector3(8,2.2,-2.55)));

    // spice rack (back wall upper-left)
    const rack=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.07,0.32),Anime.mat(0xcc9966));
    rack.position.set(-7,2.52,-6.66); s.add(rack);
    [0xffaa44,0x44aaff,0xffee44,0xcc44aa,0x88ff44,0x4488ff].forEach((c,i)=>{
      const j=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.17,8),Anime.mat(c));
      j.position.set(-8.0+i*0.42,2.64,-6.66); s.add(j); Anime.outline(j,0.025);
    });

    // hanging pot rack over the stove area
    const rackBar=new THREE.Mesh(new THREE.BoxGeometry(3.0,0.05,0.6),Anime.mat(0x888899,0.3,0.5));
    rackBar.position.set(-3,3.55,-5.5); s.add(rackBar); Anime.outline(rackBar,0.02);
    [[0.9,0xaa6644,0.22],[0,0x557788,0.20],[0.9,0x334455,0.18]].forEach(([ox,col,r],i)=>{
      const hook=new THREE.Mesh(new THREE.TorusGeometry(0.03,0.012,6,8,Math.PI*1.5),Anime.mat(0x999aaa));
      hook.position.set(-3+ox,3.44,-5.5); s.add(hook);
      const cord=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,0.3+i*0.06,4),Anime.mat(0x666677));
      cord.position.set(-3+ox,3.3-i*0.03,-5.5); s.add(cord);
      const hanging=new THREE.Mesh(new THREE.CylinderGeometry(r,r*0.9,0.22,10),Anime.mat(col,0.4,0.3));
      hanging.position.set(-3+ox,3.12-i*0.04,-5.5); s.add(hanging); Anime.outline(hanging,0.025);
    });

    // kitchen towel draped over counter
    const towel=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.005,0.44),Anime.mat(0xff8899,0.9));
    towel.position.set(-5.8,1.04,-5.5); towel.rotation.y=0.1; s.add(towel); Anime.outline(towel,0.02);
    // stripes on towel
    [0.06,0.13,0.20].forEach(ox=>{
      const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.025,0.007,0.42),
        new THREE.MeshBasicMaterial({color:0xffffff}));
      stripe.position.set(-5.8+ox-0.10,1.045,-5.5); s.add(stripe);
    });

    // small chalkboard on side wall
    {
      const board=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.9,0.06),Anime.mat(0x223322));
      board.position.set(8.87,2.2,1); board.rotation.y=Math.PI/2; s.add(board);
      Anime.outline(board,0.03);
      const c=document.createElement('canvas'); c.width=140; c.height=90;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#223322'; ctx.fillRect(0,0,140,90);
      ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=2;
      ctx.strokeRect(4,4,132,82);
      ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='bold 13px sans-serif';
      ctx.textAlign='center';
      ['TODAY\'S MENU','──────────','🍗 Grilled Chicken','🥒 Garden Salad','🍞 Sauce Bread','🍋 Lemonade'].forEach((ln,i)=>{
        ctx.fillText(ln,70,18+i*12);
      });
      const cb=new THREE.Mesh(new THREE.PlaneGeometry(1.3,0.82),
        new THREE.MeshBasicMaterial({map:(() => { const _t = new THREE.CanvasTexture(c); _t.channel = 0; return _t; })()}));
      cb.position.set(8.84,2.2,1); cb.rotation.y=Math.PI/2; s.add(cb);
    }

    // small radio on counter
    const radio=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.16,0.14),Anime.mat(0x445566,0.4,0.3));
    radio.position.set(-1.5,1.10,-5.5); s.add(radio); Anime.outline(radio,0.025);
    const speaker=new THREE.Mesh(new THREE.CircleGeometry(0.056,10),Anime.mat(0x223344));
    speaker.position.set(-1.5,1.10,-5.44); s.add(speaker);
    const antenna=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.008,0.22,4),Anime.mat(0x777788));
    antenna.rotation.z=0.3; antenna.position.set(-1.44,1.22,-5.46); s.add(antenna);
  }

  // ══════════════════════════════════════════════════════════
  //  MINI HUD
  // ══════════════════════════════════════════════════════════
  _buildMiniHUD() {
    const el=document.createElement('div');
    el.style.cssText=`position:fixed;left:50%;bottom:82px;transform:translateX(-50%);
      width:280px;pointer-events:none;display:none;z-index:20;`;
    el.innerHTML=`
      <div id="mgLabel" style="text-align:center;font-size:13px;color:#fff;
        text-shadow:0 1px 4px #000;margin-bottom:5px;font-weight:700"></div>
      <div style="height:13px;background:rgba(0,0,0,0.45);border-radius:999px;
        overflow:hidden;border:1.5px solid rgba(255,255,255,0.3)">
        <div id="mgFill" style="height:100%;width:0%;border-radius:999px;
          background:linear-gradient(90deg,#ff88aa,#ffdd44);transition:width 0.10s"></div>
      </div>`;
    document.body.appendChild(el);
    this._mgEl=el;
    this._mgLabel=el.querySelector('#mgLabel');
    this._mgFill=el.querySelector('#mgFill');
  }
  _showBar(label,pct){ this._mgEl.style.display='block'; this._mgLabel.textContent=label; this._mgFill.style.width=(Math.min(pct,1)*100).toFixed(1)+'%'; }
  _hideBar(){ this._mgEl.style.display='none'; }

  // ══════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════
  onEnter() {
    this.step=STEP.SEASON;
    this._seasonCount=0; this._cookProgress=0; this._flips=0;
    this._isFlipping=false; this._chopCount=0; this._sauceCoverage=0;
    this._lemonCount=0; this._lemonadeFill=0;

    if(this._chickenMesh){ this._chickenMesh.material.color.copy(RAW_COLOR); this._chickenMesh.visible=false; }
    if(this._rawChickenDisplay){ this._rawChickenDisplay.material.color.copy(RAW_COLOR); this._rawChickenDisplay.visible=true; }
    this._vegMeshes.forEach(m=>{ m.visible=true; m.scale.set(1,1,1); m.position.y=1.10; });
    this._chopPieces.forEach(p=>this.scene.remove(p)); this._chopPieces=[];
    this._lemonMeshes.forEach(m=>{ m.visible=true; });
    if(this._liqMesh){ this._liqMesh.visible=false; this._liqMesh.scale.y=0.01; }
    this._resetSauceCanvas();
    if(this._burnerGlow) this._burnerGlow.intensity=0;

    this.fp.teleport(0,0,4,Math.PI); this.fp.speed=3.5;
    this._updateStepHUD();
    this.engine.audio.play('music',110);
  }

  onExit() {
    this.engine.audio.play('musicStop');
    this._hideBar();
    if(this._burnerGlow) this._burnerGlow.intensity=0;
  }

  // ══════════════════════════════════════════════════════════
  //  INTERACTIONS
  // ══════════════════════════════════════════════════════════
  _interactSeason() {
    if(this.step!==STEP.SEASON) return;
    this._seasonCount++;
    this.engine.audio.play('whoosh');
    // shake visual
    if(this._spiceJarMesh){
      this._spiceJarMesh.userData.shakeT=0;
    }
    // show seasoning specks on chicken
    if(this._rawChickenDisplay){
      const t=this._seasonCount/this._seasonNeeded;
      this._rawChickenDisplay.material.color.setHSL(0.04,0.8,0.72-t*0.1);
    }
    if(this._seasonCount>=this._seasonNeeded) this._finishSeason();
  }

  _finishSeason() {
    if(this._rawChickenDisplay) this._rawChickenDisplay.visible=false;
    if(this._chickenMesh){ this._chickenMesh.visible=true; this._chickenMesh.material.color.copy(RAW_COLOR); }
    this.engine.audio.play('pickup');
    this.step=STEP.CHICKEN; this._updateStepHUD();
    this.engine.hud.showPrompt('✅ Seasoned! Head to the stove to grill.');
    setTimeout(()=>this.engine.hud.hidePrompt(),2200);
  }

  _interactChicken() {
    if(this.step!==STEP.CHICKEN) return;
    if(this._flips===0){ this._burnerGlow.intensity=3; this.engine.audio.play('sizzle'); }
    this._cookProgress+=0.18; this._flips++;
    this._isFlipping=true; this._flipT=0;
    const t=Math.min(this._cookProgress,1);
    this._chickenMesh.material.color.lerpColors(RAW_COLOR,COOKED_COLOR,t);
    this.engine.audio.play('sizzle');
    if(this._flips>=4&&this._cookProgress>=0.72) this._finishChicken();
  }

  _finishChicken() {
    this._cookProgress=1; this._chickenMesh.material.color.copy(COOKED_COLOR);
    this._burnerGlow.intensity=0;
    this.engine.audio.play('pickup');
    this.step=STEP.CHOP; this._updateStepHUD();
    this.engine.hud.showPrompt('✅ Chicken grilled! Head to the chopping board.');
    setTimeout(()=>this.engine.hud.hidePrompt(),2200);
  }

  _interactChop() {
    if(this.step!==STEP.CHOP) return;
    this._chopCount++;
    this.engine.audio.play('chop');
    const vm=this._vegMeshes[Math.floor(Math.random()*this._vegMeshes.length)];
    if(vm.visible){ vm.userData.squishT=0; if(this._chopCount%4===0) this._spawnChopPiece(vm); }
    if(this._chopCount>=this._chopNeeded) this._finishChop();
  }

  _spawnChopPiece(src) {
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.055,0.038,0.055),
      Anime.mat(src.material.color.getHex()));
    p.position.copy(src.position);
    p.position.x+=(Math.random()-0.5)*0.28; p.position.z+=(Math.random()-0.5)*0.28;
    p.userData.vy=0.025+Math.random()*0.04; p.userData.vx=(Math.random()-0.5)*0.02; p.userData.fallen=false;
    this.scene.add(p); this._chopPieces.push(p);
  }

  _finishChop() {
    this._vegMeshes.forEach(m=>{ m.scale.set(1,0.12,1); m.position.y=1.01; });
    this.engine.audio.play('pickup');
    this.step=STEP.SAUCE; this._updateStepHUD();
    this.engine.hud.showPrompt('✅ Veggies chopped! Spread sauce on the bread.');
    setTimeout(()=>this.engine.hud.hidePrompt(),2200);
  }

  _paintSauce(u,v) {
    const ctx=this._sauceCtx;
    const px=u*256, py=(1-v)*256, r=20+Math.random()*10;
    ctx.globalAlpha=0.5;
    const grad=ctx.createRadialGradient(px,py,0,px,py,r);
    grad.addColorStop(0,'rgba(210,35,15,0.95)');
    grad.addColorStop(0.5,'rgba(195,28,10,0.55)');
    grad.addColorStop(1,'rgba(170,15,5,0)');
    ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    this._sauceTex.needsUpdate=true;
    // measure coverage
    const d=this._sauceCtx.getImageData(12,12,232,232).data;
    let red=0,total=0;
    for(let i=0;i<d.length;i+=12){ total++; if(d[i]>150&&d[i+1]<70) red++; }
    this._sauceCoverage=red/total;
    if(this._sauceCoverage>0.48) this._finishSauce();
  }

  _finishSauce() {
    if(this.step!==STEP.SAUCE) return;
    // flood fill remaining
    const ctx=this._sauceCtx;
    ctx.globalAlpha=0.55; ctx.fillStyle='rgba(200,30,12,0.65)'; ctx.fillRect(12,12,232,232);
    ctx.globalAlpha=1; this._sauceTex.needsUpdate=true;
    this.engine.audio.play('pickup');
    this.step=STEP.LEMON; this._updateStepHUD();
    this.engine.hud.showPrompt('✅ Sauce spread! Now squeeze the lemons for lemonade.');
    setTimeout(()=>this.engine.hud.hidePrompt(),2400);
  }

  _interactLemon() {
    if(this.step!==STEP.LEMON) return;
    if(this._lemonCount>=this._lemonNeeded) return;
    this._lemonCount++;
    this.engine.audio.play('pickup');
    // hide one lemon
    const lem=this._lemonMeshes[this._lemonCount-1];
    if(lem){ lem.userData.squeezeT=0; }
    // grow liquid in jug
    this._lemonadeFill=this._lemonCount/this._lemonNeeded;
    if(this._liqMesh){
      this._liqMesh.visible=true;
      this._liqMesh.scale.set(1,Math.max(0.01,this._lemonadeFill*35),1);
      this._liqMesh.position.y=1.02+(this._lemonadeFill*0.17)/2;
    }
    if(this._lemonCount>=this._lemonNeeded) this._finishLemon();
  }

  _finishLemon() {
    this.engine.audio.play('cash');
    this.step=STEP.DONE; this._updateStepHUD();
    setTimeout(()=>this._showComplete(),500);
  }

  _showComplete() {
    this.engine.hud.showOverlay(`
      <div style="font-size:48px">🍗🥒🍞🍋✨</div>
      <div style="font-size:26px;font-weight:900;
        background:linear-gradient(135deg,#ffd700,#ff80b0);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent">
        Feast Ready!</div>
      <div style="font-size:15px;color:#ddd;text-align:center;max-width:320px;line-height:1.9">
        🧂 Seasoned & grilled chicken ✅<br>
        🥒 Fresh chopped veggies ✅<br>
        🍞 Saucy open sandwich ✅<br>
        🍋 Fresh lemonade ✅<br>
        <span style="color:#aaffaa">Avicula: "It smells amazing in here!" ⭐</span>
      </div>
    `,'Pack the basket! 🎒',()=>this.engine.nextLevel('cooking'));
  }

  // ══════════════════════════════════════════════════════════
  //  UPDATE
  // ══════════════════════════════════════════════════════════
  
  update(dt) {
    this._sky?.update(dt);
    this.fp.update(dt,this.collidables);

    // Avicula bob
    const av=this.scene.userData.avicula;
    if(av){ av.userData.bobT+=dt; av.position.y=Math.sin(av.userData.bobT*1.4)*0.028; }

    // spice jar shake animation
    if(this._spiceJarMesh?.userData.shakeT!=null){
      const st=this._spiceJarMesh.userData.shakeT+=dt*12;
      this._spiceJarMesh.rotation.z=Math.sin(st)*0.35*(1-st/Math.PI);
      this._spiceJarMesh.position.y=1.13+Math.abs(Math.sin(st*2))*0.04;
      if(st>Math.PI){ this._spiceJarMesh.rotation.z=0; this._spiceJarMesh.position.y=1.13; delete this._spiceJarMesh.userData.shakeT; }
    }

    // chicken cooking (auto-slow)
    if(this.step===STEP.CHICKEN&&this._cookProgress>0&&this._cookProgress<1){
      this._cookProgress+=dt*0.035;
      const t=Math.min(this._cookProgress,1);
      this._chickenMesh.material.color.lerpColors(RAW_COLOR,COOKED_COLOR,t);
      this._showBar(`🍗 Grilling… flip ${Math.max(0,4-this._flips)} more time(s)!`,t);
    }
    // flip animation
    if(this._isFlipping){
      this._flipT+=dt*5.5;
      this._chickenMesh.rotation.x=Math.sin(this._flipT)*Math.PI;
      if(this._flipT>Math.PI){ this._isFlipping=false; this._chickenMesh.rotation.x=0; }
    }
    // steam
    if(this.step===STEP.CHICKEN&&this._cookProgress>0.06) this._updateSteam(dt);
    // burner flicker
    if(this.step===STEP.CHICKEN&&this._cookProgress>0){
      this._burnerGlow.intensity=2.6+Math.sin(performance.now()/75)*0.6;
    }

    // chop
    if(this.step===STEP.CHOP){
      this._showBar(`🥒 Chopping… ${this._chopCount}/${this._chopNeeded}`,this._chopCount/this._chopNeeded);
      this._vegMeshes.forEach(m=>{
        if(m.userData.squishT!=null){
          m.userData.squishT+=dt*9;
          m.scale.y=1-0.28*Math.abs(Math.sin(m.userData.squishT*Math.PI));
          if(m.userData.squishT>1) delete m.userData.squishT;
        }
      });
      this._chopPieces.forEach(p=>{
        if(!p.userData.fallen){
          p.userData.vy-=dt*0.35; p.position.y+=p.userData.vy; p.position.x+=p.userData.vx;
          p.rotation.x+=dt*4.5; p.rotation.z+=dt*3;
          if(p.position.y<=1.07){ p.position.y=1.07; p.userData.fallen=true; }
        }
      });
    }

    // sauce
    if(this.step===STEP.SAUCE){
      this._showBar(`🍅 Spread sauce — ${Math.round(this._sauceCoverage*100)}% covered`,this._sauceCoverage/0.48);
      if(this.engine.input.mouse.buttons[0]){
        const ray=new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0,0),this.camera);
        const hits=ray.intersectObject(this._breadPlane);
        if(hits.length&&hits[0].uv){ this._paintSauce(hits[0].uv.x,hits[0].uv.y); if(Math.random()<0.07) this.engine.audio.play('sizzle'); }
      }
    }

    // lemon
    if(this.step===STEP.LEMON){
      this._showBar(`🍋 Squeeze lemons — ${this._lemonCount}/${this._lemonNeeded}`,this._lemonCount/this._lemonNeeded);
      // squeeze animation
      this._lemonMeshes.forEach(m=>{
        if(m.userData.squeezeT!=null){
          m.userData.squeezeT+=dt*8;
          const q=m.userData.squeezeT;
          m.scale.y=0.9+Math.sin(q*Math.PI)*0.5; m.scale.x=1+Math.sin(q*Math.PI)*0.2;
          if(q>1){ m.visible=false; delete m.userData.squeezeT; }
        }
      });
    }

    if(this.step===STEP.DONE) this._hideBar();

    // hover prompt
    const hov=this.interactor.update(this.interactables);
    const promptMap={
      [STEP.SEASON]:  [this._seasonZone, '[E] Shake the spice jar'],
      [STEP.CHICKEN]: [this._stoveZone,  '[E] Flip the chicken'],
      [STEP.CHOP]:    [this._chopZone,   '[E] Chop!'],
      [STEP.SAUCE]:   [this._breadPlane, '[Hold Click] Spread sauce'],
      [STEP.LEMON]:   [this._lemonZone,  '[E] Squeeze lemon'],
    };
    const pm=promptMap[this.step];
    if(pm&&hov===pm[0]){
      this.engine.hud.showPrompt(pm[1]);
      this.engine.hud.crosshairColor('#ffd700');
    } else {
      if(this.step!==STEP.DONE) this.engine.hud.hidePrompt();
      this.engine.hud.crosshairColor('white');
    }
  }

  _updateSteam(dt) {
    const origin=new THREE.Vector3(-3-0.45,1.18,-5.5-0.20);
    this._steamParticles.forEach(p=>{
      if(p.active){
        p.life+=dt;
        const t=p.life/p.maxLife;
        p.mesh.position.y+=dt*0.42; p.mesh.position.x+=Math.sin(p.life*2.8)*dt*0.05;
        p.mesh.material.opacity=0.50*(1-t); p.mesh.scale.setScalar(1+t*2.2);
        if(t>=1){ p.active=false; p.mesh.visible=false; }
      } else if(Math.random()<0.16){
        p.active=true; p.life=0; p.maxLife=0.85+Math.random()*0.55;
        p.mesh.visible=true; p.mesh.position.copy(origin);
        p.mesh.position.x+=(Math.random()-0.5)*0.14; p.mesh.position.z+=(Math.random()-0.5)*0.14;
        p.mesh.material.opacity=0.48; p.mesh.scale.setScalar(1);
      }
    });
  }

  _updateStepHUD() {
    const steps=[
      {s:STEP.SEASON,  icon:'🧂', text:'Season the chicken'},
      {s:STEP.CHICKEN, icon:'🍗', text:'Grill the chicken (flip ×4)'},
      {s:STEP.CHOP,    icon:'🥒', text:'Chop the vegetables'},
      {s:STEP.SAUCE,   icon:'🍞', text:'Spread sauce on bread'},
      {s:STEP.LEMON,   icon:'🍋', text:'Squeeze lemons for lemonade'},
    ];
    const rows=steps.map(r=>`
      <div style="opacity:${this.step===r.s?1:this.step>r.s?0.5:0.32};
        color:${this.step>r.s?'#88ff88':this.step===r.s?'#ffd700':'#fff'};
        text-decoration:${this.step>r.s?'line-through':'none'};
        font-weight:${this.step===r.s?700:400}">
        ${this.step>r.s?'✅':this.step===r.s?'▶':'◻'} ${r.icon} ${r.text}
      </div>`).join('');
    this.engine.hud.setInfo(`
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#ffd700">🍳 Cooking Steps</div>
      ${rows}
      <div style="font-size:11px;opacity:0.5;margin-top:6px">Walk to station · E to interact</div>`);
  }

  onInteract() {
    const hov=this.interactor.update(this.interactables);
    if(!hov) return;
    if(hov===this._seasonZone) this._interactSeason();
    else if(hov===this._stoveZone) this._interactChicken();
    else if(hov===this._chopZone) this._interactChop();
    else if(hov===this._lemonZone) this._interactLemon();
  }
}