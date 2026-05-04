// ============================================================
//  STARRY PICNIC — levels/stargazing.js
//
//  FIXES vs original:
//   • Import fixed to 'three' (not CDN URL)
//   • Pointer lock requested on onEnter() / canvas click
//   • Stars are larger (r=1.2) and easier to click
//   • Constellation lines drawn as cylinders (WebGL ignores
//     linewidth > 1, so LineBasicMaterial lines were invisible)
//   • Hint panel now includes a sky compass showing WHERE to look
//   • Background twinkle rewritten (scaling meshes, not size attr)
//   • Proximity glow: crosshair near a star makes it pulse harder
//   • Zoom-in effect when aiming at a valid star
// ============================================================
import { stargazingBackground } from '../backgrounds.js';
import * as THREE from 'three';
import { Level, Anime, Build } from '../engine.js';

// ─────────────────────────────────────────────────────────────
//  CONSTELLATIONS
// ─────────────────────────────────────────────────────────────
const CONSTELLATIONS = [
  {
    id:    'chicken',
    name:  '🍗 The Golden Chicken',
    hint:  'Looks like a roasting bird! (EAST sky)',
    color: 0xffd700,
    stars: [
      [ 50, 55],  // 0 head
      [ 58, 48],  // 1 neck
      [ 65, 42],  // 2 body-top
      [ 62, 35],  // 3 body-bottom
      [ 72, 38],  // 4 wing-tip
      [ 55, 28],  // 5 tail
    ],
    lines: [[0,1],[1,2],[2,3],[2,4],[3,5]],
  },
  {
    id:    'basket',
    name:  '🧺 The Picnic Basket',
    hint:  'See the handle arching overhead! (SOUTH sky)',
    color: 0xcc88ff,
    stars: [
      [175, 40],  // 0 left-base
      [187, 40],  // 1 right-base
      [175, 52],  // 2 left-rim
      [187, 52],  // 3 right-rim
      [181, 64],  // 4 handle-top
    ],
    lines: [[0,1],[0,2],[1,3],[2,4],[3,4],[2,3]],
  },
  {
    id:    'pair',
    name:  '💛💜 The Star Pair',
    hint:  'Two bright figures side by side! (WEST sky)',
    color: 0xff88cc,
    stars: [
      [290, 62],  // 0 left-head
      [285, 54],  // 1 left-body
      [282, 47],  // 2 left-feet
      [302, 62],  // 3 right-head
      [307, 54],  // 4 right-body
      [310, 47],  // 5 right-feet
      [296, 58],  // 6 joining-star
    ],
    lines: [[0,1],[1,2],[3,4],[4,5],[0,6],[3,6]],
  },
];

const SKY_R = 88;

function skyPoint(azDeg, elDeg) {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(
    SKY_R * Math.cos(el) * Math.sin(az),
    SKY_R * Math.sin(el),
    SKY_R * Math.cos(el) * Math.cos(az)
  );
}

// Thin visible cylinder between two world points (replaces broken linewidth)
function lineCylinder(scene, pa, pb, color, r=0.10) {
  const dir = pb.clone().sub(pa);
  const len = dir.length();
  const mid = pa.clone().lerp(pb, 0.5);
  const geo = new THREE.CylinderGeometry(r, r, len, 5);
  const mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.65});
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  scene.add(mesh);
  return mesh;
}

// ─────────────────────────────────────────────────────────────
export class Stargazing extends Level {
// ─────────────────────────────────────────────────────────────

  constructor(engine) {
    super(engine);
    this._yaw   = 0;
    this._pitch = 0.85;
    this._sens  = 0.0016;

    this._constellIdx = 0;
    this._foundStars  = new Set();
    this._completedConstellations = 0;
    this._done = false;

    this._starMeshes      = [];   // { mesh, constellIdx, starIdx }
    this._lineGroups      = [];   // arrays of cylinder meshes per constellation
    this._glowRings       = [];   // outer ring meshes per star
    this._bgStarMeshes    = [];   // handful of bright bg stars to twinkle
    this._fireflies       = [];
    this._constellLines   = [];   // drawn connection cylinders

    this._hintCanvas = null;
    this._hintCtx    = null;
    this._hintTex    = null;
    this._hintMesh   = null;
    this._hoveredStar = null;     // for zoom effect
  }

  // ══════════════════════════════════════════════════════════
  init() {
    const s = this.scene;

    this._sky = stargazingBackground(this.scene);
    this._buildSkyDome(s);
    this._buildBackgroundStars(s);
    this._buildMilkyWay(s);
    this._buildMoon(s);
    this._buildPark(s);
    this._buildPicnicScene(s);
    this._buildConstellationStars(s);
    this._buildHintPanel(s);
    this._buildFireflies(s);
  }

  // ── Sky dome ──────────────────────────────────────────────
  _buildSkyDome(s) {
    s.add(new THREE.Mesh(
      new THREE.SphereGeometry(SKY_R+2,32,16),
      new THREE.MeshBasicMaterial({color:0x04021a,side:THREE.BackSide})));
  }

  // ── Background stars (Points — fixed size, no per-vertex twinkle) ──
  _buildBackgroundStars(s) {
    const count=1600;
    const pos=new Float32Array(count*3);
    const col=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const az=Math.random()*Math.PI*2, el=Math.asin(Math.random());
      const r=SKY_R-1+Math.random();
      pos[i*3]=r*Math.cos(el)*Math.sin(az);
      pos[i*3+1]=r*Math.sin(el);
      pos[i*3+2]=r*Math.cos(el)*Math.cos(az);
      const w=Math.random();
      col[i*3]=0.85+w*0.15; col[i*3+1]=0.85; col[i*3+2]=0.92+w*0.08;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color',new THREE.BufferAttribute(col,3));
    s.add(new THREE.Points(geo,new THREE.PointsMaterial(
      {size:0.5,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.88})));

    // A few dozen brighter "mesh" stars that can actually twinkle by scaling
    for(let i=0;i<60;i++){
      const az=Math.random()*Math.PI*2, el=0.1+Math.random()*1.3;
      const r=SKY_R-2;
      const m=new THREE.Mesh(
        new THREE.SphereGeometry(0.22+Math.random()*0.18,5,4),
        new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,
          opacity:0.5+Math.random()*0.4}));
      m.position.set(r*Math.cos(el)*Math.sin(az),r*Math.sin(el),r*Math.cos(el)*Math.cos(az));
      m.userData.twinkleT=Math.random()*Math.PI*2;
      m.userData.twinkleSpeed=0.8+Math.random()*1.4;
      s.add(m);
      this._bgStarMeshes.push(m);
    }
  }

  // ── Milky way band ────────────────────────────────────────
  _buildMilkyWay(s) {
    const count=700;
    const pos=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const t=(i/count)*Math.PI*2, band=(Math.random()-0.5)*0.26;
      const el=Math.sin(t)*0.5+band+0.28;
      if(el<0.05){pos[i*3]=0;pos[i*3+1]=0;pos[i*3+2]=0;continue;}
      const r=SKY_R-3;
      pos[i*3]=r*Math.cos(el)*Math.sin(t);
      pos[i*3+1]=r*Math.sin(el);
      pos[i*3+2]=r*Math.cos(el)*Math.cos(t);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    s.add(new THREE.Points(geo,new THREE.PointsMaterial(
      {color:0x9988ff,size:0.7,transparent:true,opacity:0.25,sizeAttenuation:true})));
  }

  // ── Moon ─────────────────────────────────────────────────
  _buildMoon(s) {
    const mp=skyPoint(220,52);
    const moon=new THREE.Mesh(new THREE.SphereGeometry(4.5,16,12),
      Anime.mat(0xfff8e8,0.6));
    moon.position.copy(mp); s.add(moon); Anime.outline(moon,0.02);
    [[1.5,1.0,0.8],[-1.2,1.8,0.5],[0.5,-1.4,0.62]].forEach(([cx,cy,cr])=>{
      const c=new THREE.Mesh(new THREE.CircleGeometry(cr,8),
        new THREE.MeshBasicMaterial({color:0xeee0c0,transparent:true,opacity:0.55}));
      c.position.set(mp.x+cx,mp.y+cy,mp.z); c.lookAt(0,0,0); s.add(c);
    });
    const halo=new THREE.Mesh(new THREE.SphereGeometry(7,12,8),
      new THREE.MeshBasicMaterial({color:0xfff0aa,transparent:true,opacity:0.07,side:THREE.BackSide}));
    halo.position.copy(mp); s.add(halo);
    const mlight=new THREE.PointLight(0xc8d8ff,0.45,130);
    mlight.position.copy(mp); s.add(mlight);
  }

  // ── Park ground ───────────────────────────────────────────
  _buildPark(s) {
    const grass=new THREE.Mesh(new THREE.PlaneGeometry(220,220),Anime.mat(0x0c3016));
    grass.rotation.x=-Math.PI/2; s.add(grass);
    for(let i=0;i<20;i++){
      const angle=(i/20)*Math.PI*2, r=28+Math.random()*10;
      this._buildNightTree(s,Math.cos(angle)*r,Math.sin(angle)*r);
    }
    for(let pz=-14;pz<0;pz+=1.9){
      const st=new THREE.Mesh(new THREE.BoxGeometry(0.7+Math.random()*0.3,0.05,0.7+Math.random()*0.3),
        Anime.mat(0x334455));
      st.position.set((Math.random()-0.5)*0.5,0.026,pz); s.add(st);
    }
  }

  _buildNightTree(s,x,z){
    const g=new THREE.Group(); s.add(g); g.position.set(x,0,z);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.24,2.2,7),Anime.mat(0x0a1a08));
    trunk.position.y=1.1; g.add(trunk);
    [0,0.8,1.55].forEach((ty,ti)=>{
      const crown=new THREE.Mesh(new THREE.ConeGeometry(1.6-ti*0.38,1.1,8),Anime.mat(0x091e0b));
      crown.position.y=1.9+ty; g.add(crown);
    });
  }

  // ── Picnic scene ──────────────────────────────────────────
  _buildPicnicScene(s) {
    const blanket=new THREE.Mesh(new THREE.PlaneGeometry(3.4,3.0),Anime.mat(0x3a1a55));
    blanket.rotation.x=-Math.PI/2; blanket.position.set(0,0.01,0);
    s.add(blanket); Anime.outline(blanket,0.04);
    [0.5,1.0,-0.5,-1.0].forEach(sx=>{
      const stripe=new THREE.Mesh(new THREE.PlaneGeometry(0.16,2.9),Anime.mat(0x5a3580));
      stripe.rotation.x=-Math.PI/2; stripe.position.set(sx,0.015,0); s.add(stripe);
    });
    this._buildNightBasket(s,-1.0,0,-0.5);
    [{c:0xff4444,x:0.3,z:-0.4,r:0.12},{c:0xffdd44,x:0.6,z:0.1,r:0.1},
     {c:0xf5c97a,x:0.15,z:0.3,r:0.11}].forEach(sp=>{
      const m=new THREE.Mesh(new THREE.SphereGeometry(sp.r,8,6),Anime.mat(sp.c));
      m.position.set(sp.x,0.07,sp.z); s.add(m); Anime.outline(m,0.04);
    });
    [-0.3,0.2].forEach((jx,i)=>{
      const j=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.18,0.08),Anime.mat(0xffaa00));
      j.position.set(jx,0.1,0.5+i*0.12); s.add(j); Anime.outline(j,0.03);
    });
    this._buildLyingChar(s,-0.7,0.12,0.5,0xffdd44,0xffe8c0,0xffcc00,'avicula');
    this._buildLyingChar(s, 0.5,0.12,0.5,0xcc88ff,0xffe0cc,0xcc66ff,'purpura');
    Build.label(s,'"Look — The Golden Chicken!"',-1.0,1.85,0.5,'#fff','rgba(40,10,80,0.9)');
  }

  _buildNightBasket(s,x,y,z){
    const g=new THREE.Group(); s.add(g); g.position.set(x,y,z);
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.75,0.55,0.65),Anime.mat(0x3a2210));
    body.position.y=0.28; g.add(body); Anime.outline(body,0.04);
    const rim=new THREE.Mesh(new THREE.BoxGeometry(0.82,0.06,0.70),Anime.mat(0x5a3418));
    rim.position.y=0.58; g.add(rim);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(0.28,0.04,6,16,Math.PI),Anime.mat(0x3a2210));
    handle.rotation.z=Math.PI; handle.rotation.y=Math.PI/2;
    handle.position.y=0.72; g.add(handle); Anime.outline(handle,0.03);
  }

  _buildLyingChar(s,x,y,z,bodyCol,headCol,starCol,name){
    const g=new THREE.Group(); s.add(g); g.position.set(x,y,z);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.20,0.82,10),Anime.mat(bodyCol));
    body.rotation.z=Math.PI/2; g.add(body); Anime.outline(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.22,12,10),Anime.mat(headCol));
    head.position.set(0.53,0.08,0); g.add(head); Anime.outline(head);
    const star=new THREE.Mesh(new THREE.OctahedronGeometry(0.08,0),Anime.mat(starCol));
    star.position.set(0.62,0.28,0.08); g.add(star);
    [-0.07,0.07].forEach(ez=>{
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.038,6,6),
        new THREE.MeshBasicMaterial({color:0x222200}));
      eye.position.set(0.70,0.14,ez); g.add(eye);
    });
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.04,0.44,6),Anime.mat(bodyCol));
    arm.rotation.x=-Math.PI/2.3; arm.position.set(0.1,0.28,-0.12); g.add(arm);
    g.userData.bobT=name==='purpura'?Math.PI/3:0;
    this.scene.userData[name]=g;
  }

  // ── Constellation star meshes ─────────────────────────────
  _buildConstellationStars(s) {
    CONSTELLATIONS.forEach((con,ci)=>{
      this._lineGroups.push([]);
      con.stars.forEach((pos,si)=>{
        const wp=skyPoint(pos[0],pos[1]);

        // main star mesh — larger (r=1.2) so it's actually clickable
        const mesh=new THREE.Mesh(
          new THREE.SphereGeometry(1.2,10,8),
          new THREE.MeshBasicMaterial({color:0xffffff}));
        mesh.position.copy(wp); s.add(mesh);

        // pulsing glow ring (torus around the star)
        const ring=new THREE.Mesh(
          new THREE.TorusGeometry(2.0,0.35,6,18),
          new THREE.MeshBasicMaterial({color:con.color,transparent:true,opacity:0.0}));
        ring.position.copy(wp); ring.lookAt(0,0,0); s.add(ring);

        // soft outer sphere glow
        const glow=new THREE.Mesh(
          new THREE.SphereGeometry(2.5,8,6),
          new THREE.MeshBasicMaterial({color:con.color,transparent:true,
            opacity:0.0,side:THREE.FrontSide}));
        glow.position.copy(wp); s.add(glow);

        mesh.userData={isConstellStar:true,constellIdx:ci,starIdx:si,worldPos:wp,ring,glow};
        this._starMeshes.push({mesh,constellIdx:ci,starIdx:si});
        this._glowRings.push(ring);
        this.interactables.push(mesh);
      });
    });
  }

  // ── Hint panel (floating canvas) ─────────────────────────
  _buildHintPanel(s) {
    this._hintCanvas=document.createElement('canvas');
    this._hintCanvas.width=220; this._hintCanvas.height=260;
    this._hintCtx=this._hintCanvas.getContext('2d');
    this._hintTex=new THREE.CanvasTexture(this._hintCanvas);
    const mat=new THREE.MeshBasicMaterial({map:this._hintTex,transparent:true,
      depthWrite:false,depthTest:false});
    this._hintMesh=new THREE.Mesh(new THREE.PlaneGeometry(2.0,2.4),mat);
    this._hintMesh.renderOrder=999; s.add(this._hintMesh);
    this._redrawHint();
  }

  _redrawHint() {
    const con=CONSTELLATIONS[this._constellIdx];
    const ctx=this._hintCtx;
    const W=220,H=260;
    ctx.clearRect(0,0,W,H);

    // background
    ctx.fillStyle='rgba(4,2,26,0.92)';
    this._rrect(ctx,2,2,W-4,H-4,10); ctx.fill();
    ctx.strokeStyle='rgba(180,140,255,0.5)'; ctx.lineWidth=1.5;
    this._rrect(ctx,2,2,W-4,H-4,10); ctx.stroke();

    // title
    ctx.fillStyle='#ffd700'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center';
    ctx.fillText('Find this constellation:',W/2,18);
    ctx.fillStyle='#fff'; ctx.font='bold 13px sans-serif';
    ctx.fillText(con.name,W/2,34);
    ctx.fillStyle='rgba(180,160,255,0.85)'; ctx.font='10px sans-serif';
    ctx.fillText(con.hint,W/2,50);

    // ── constellation mini diagram (top half) ─────────────
    const azs=con.stars.map(p=>p[0]), els=con.stars.map(p=>p[1]);
    const azMin=Math.min(...azs)-10, azMax=Math.max(...azs)+10;
    const elMin=Math.min(...els)-10, elMax=Math.max(...els)+10;
    const diagramY=62, diagramH=90, pad=14;
    const toX=az=>pad+(az-azMin)/(azMax-azMin)*(W-pad*2);
    const toY=el=>diagramY+diagramH-(pad+(el-elMin)/(elMax-elMin)*(diagramH-pad*2));

    // diagram bg
    ctx.fillStyle='rgba(10,5,40,0.7)';
    ctx.fillRect(6,diagramY-4,W-12,diagramH+8);

    // lines (dashed)
    const [r,g,b]=[(con.color>>16)&255,(con.color>>8)&255,con.color&255];
    ctx.strokeStyle=`rgba(${r},${g},${b},0.55)`; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
    con.lines.forEach(([a,bv])=>{
      ctx.beginPath();
      ctx.moveTo(toX(con.stars[a][0]),toY(con.stars[a][1]));
      ctx.lineTo(toX(con.stars[bv][0]),toY(con.stars[bv][1]));
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // star dots
    con.stars.forEach((pos,si)=>{
      const found=this._foundStars.has(si);
      ctx.fillStyle=found?`rgb(${r},${g},${b})`:'#fff';
      ctx.beginPath();
      ctx.arc(toX(pos[0]),toY(pos[1]),found?5:3,0,Math.PI*2); ctx.fill();
      if(found){
        ctx.strokeStyle=`rgba(${r},${g},${b},0.6)`; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(toX(pos[0]),toY(pos[1]),8,0,Math.PI*2); ctx.stroke();
      }
    });

    // ── SKY COMPASS (bottom half) — shows WHERE to look ────
    // This is the key missing feature from the original!
    const compCY=diagramY+diagramH+22, compR=32;
    ctx.fillStyle='rgba(10,5,40,0.7)';
    ctx.beginPath(); ctx.arc(W/2,compCY,compR+6,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(100,80,180,0.5)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(W/2,compCY,compR+6,0,Math.PI*2); ctx.stroke();

    // compass N/S/E/W labels
    ctx.fillStyle='rgba(180,160,255,0.65)'; ctx.font='9px sans-serif'; ctx.textAlign='center';
    ctx.fillText('N',W/2,compCY-compR-8+3);
    ctx.fillText('S',W/2,compCY+compR+8);
    ctx.fillText('E',W/2+compR+8,compCY+3);
    ctx.fillText('W',W/2-compR-8,compCY+3);

    // compass ring
    ctx.strokeStyle='rgba(100,80,180,0.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(W/2,compCY,compR,0,Math.PI*2); ctx.stroke();

    // constellation centroid direction (target circle)
    const centAz=con.stars.reduce((s,p)=>s+p[0],0)/con.stars.length;
    const centEl=con.stars.reduce((s,p)=>s+p[1],0)/con.stars.length;
    const cRad=THREE.MathUtils.degToRad(centAz);
    const cx=W/2+Math.sin(cRad)*compR*(1-centEl/90);
    const cy=compCY-Math.cos(cRad)*compR*(1-centEl/90);
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(cx,cy,8,0,Math.PI*2); ctx.stroke();

    // player look direction arrow
    const yawNorm=((this._yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
    const yawForCompass=yawNorm; // yaw=0 → looking +Z (north-ish)
    const ax=W/2+Math.sin(yawForCompass)*compR*0.7;
    const ay=compCY-Math.cos(yawForCompass)*compR*0.7;
    ctx.strokeStyle='#88ffcc'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(W/2,compCY); ctx.lineTo(ax,ay); ctx.stroke();
    // arrowhead
    ctx.fillStyle='#88ffcc';
    ctx.beginPath(); ctx.arc(ax,ay,4,0,Math.PI*2); ctx.fill();

    // direction hint text
    const compassDirs=['N','NE','E','SE','S','SW','W','NW','N'];
    const conDir=compassDirs[Math.round(centAz/45)%8];
    const elLabel=centEl>60?'high up':centEl>40?'mid sky':'near horizon';
    ctx.fillStyle='rgba(255,220,80,0.9)'; ctx.font='bold 10px sans-serif'; ctx.textAlign='center';
    ctx.fillText(`→ Look ${conDir}, ${elLabel}`,W/2,compCY+compR+20);

    // progress
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='10px sans-serif';
    ctx.fillText(`${this._foundStars.size}/${con.stars.length} stars found`,W/2,H-8);

    this._hintTex.needsUpdate=true;
  }

  _rrect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  // ── Fireflies ─────────────────────────────────────────────
  _buildFireflies(s) {
    for(let i=0;i<28;i++){
      const ff=new THREE.Mesh(
        new THREE.SphereGeometry(0.06,5,4),
        new THREE.MeshBasicMaterial({color:0xccff44,transparent:true,opacity:0.9}));
      const r=4+Math.random()*12, a=Math.random()*Math.PI*2;
      ff.position.set(Math.cos(a)*r,0.3+Math.random()*2.5,Math.sin(a)*r);
      ff.userData={t:Math.random()*Math.PI*2,
        cx:ff.position.x,cy:ff.position.y,cz:ff.position.z,
        speed:0.5+Math.random()*0.9, r:1.5+Math.random()*2};
      s.add(ff);
      const pt=new THREE.PointLight(0xaaffaa,0,3.5);
      pt.position.copy(ff.position); s.add(pt);
      ff.userData.light=pt;
      this._fireflies.push(ff);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════
  onEnter() {
    this._constellIdx=0; this._foundStars=new Set();
    this._completedConstellations=0; this._done=false;
    this._hoveredStar=null;

    // reset star appearances
    this._starMeshes.forEach(({mesh})=>{
      mesh.material.color.set(0xffffff); mesh.scale.setScalar(1);
      if(mesh.userData.ring)  mesh.userData.ring.material.opacity=0;
      if(mesh.userData.glow)  mesh.userData.glow.material.opacity=0;
    });
    // remove drawn constellation lines
    this._constellLines.forEach(m=>this.scene.remove(m));
    this._constellLines=[];

    this._yaw=0; this._pitch=0.88;
    this.camera.fov=78; this.camera.updateProjectionMatrix();
    this.camera.position.set(0,0.28,0.4);

    // FIX: request pointer lock on enter (no FPController to do it)
    if(!this.engine.input.locked) this.engine.input.requestLock();
    // Also on canvas click so it reacquires if lost
    this._lockOnClick=()=>{ if(!this.engine.input.locked) this.engine.input.requestLock(); };
    document.getElementById('canvas').addEventListener('click',this._lockOnClick);

    this.engine.audio.play('music',68);
    this._redrawHint();
    this._updateHUD();
    this.engine.hud.showPrompt('Look around the night sky — find the glowing constellation ✨');
    setTimeout(()=>this.engine.hud.hidePrompt(),3500);
  }

  onExit() {
    this.engine.audio.play('musicStop');
    if(this._lockOnClick)
      document.getElementById('canvas').removeEventListener('click',this._lockOnClick);
  }

  // ══════════════════════════════════════════════════════════
  //  STAR CLICK
  // ══════════════════════════════════════════════════════════
  _clickStar(mesh) {
    const {constellIdx,starIdx,glow,ring}=mesh.userData;
    if(constellIdx!==this._constellIdx){
      this.engine.audio.play('deny');
      this.engine.hud.showPrompt(`That's a different constellation — find ${CONSTELLATIONS[this._constellIdx].name} first!`);
      setTimeout(()=>this.engine.hud.hidePrompt(),1800); return;
    }
    if(this._foundStars.has(starIdx)) return;

    this._foundStars.add(starIdx);
    this.engine.audio.play('pickup');

    const con=CONSTELLATIONS[constellIdx];
    mesh.material.color.set(con.color);
    if(ring)  ring.material.opacity=0.85;
    if(glow)  glow.material.opacity=0.55;
    mesh.userData.popT=0;

    this._redrawHint();

    const left=con.stars.length-this._foundStars.size;
    if(left>0){
      this.engine.hud.showPrompt(`⭐ Star found! ${left} more to go`);
      setTimeout(()=>this.engine.hud.hidePrompt(),1400);
    } else {
      this._completeConstellation(constellIdx);
    }
  }

  _completeConstellation(ci) {
    const con=CONSTELLATIONS[ci];
    this._completedConstellations++;

    // Draw cylinder lines (VISIBLE thick lines — LineBasicMaterial linewidth is ignored in WebGL)
    con.lines.forEach(([a,b])=>{
      const pa=skyPoint(con.stars[a][0],con.stars[a][1]);
      const pb=skyPoint(con.stars[b][0],con.stars[b][1]);
      const cyl=lineCylinder(this.scene,pa,pb,con.color,0.12);
      this._constellLines.push(cyl);
    });

    // burst all stars in constellation
    this._starMeshes.filter(e=>e.constellIdx===ci).forEach(({mesh})=>{
      mesh.userData.burstT=0;
      if(mesh.userData.glow) mesh.userData.glow.material.opacity=0.8;
    });

    // name label near centroid
    const cAz=con.stars.reduce((s,p)=>s+p[0],0)/con.stars.length;
    const cEl=con.stars.reduce((s,p)=>s+p[1],0)/con.stars.length;
    const lp=skyPoint(cAz,cEl+7);
    Build.label(this.scene,con.name,lp.x*0.88,lp.y*0.88,lp.z*0.88,'#ffd700','rgba(20,0,60,0.88)');

    [0,120,240,360].forEach(t=>setTimeout(()=>this.engine.audio.play('pickup'),t));
    this.engine.hud.showPrompt(`✨ ${con.name} complete!`);

    setTimeout(()=>{
      if(this._completedConstellations>=CONSTELLATIONS.length){
        this._showEnding(); return;
      }
      this._constellIdx++;
      this._foundStars=new Set();
      this._redrawHint();
      this._updateHUD();
      const next=CONSTELLATIONS[this._constellIdx];
      this.engine.hud.showPrompt(`Now find: ${next.name} — check the field guide!`);
      setTimeout(()=>this.engine.hud.hidePrompt(),3000);
    },1800);
  }

  _showEnding() {
    this.engine.audio.play('cash');
    setTimeout(()=>{
      this.engine.hud.showOverlay(`
        <div style="font-size:52px">🌟💛💜🌟</div>
        <div style="font-size:28px;font-weight:900;
          background:linear-gradient(135deg,#ffd700,#c890ff);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;text-align:center">
          Perfect Picnic!</div>
        <div style="font-size:15px;color:#ddd;text-align:center;max-width:340px;line-height:1.8;margin-top:4px">
          Avicula points out the last constellation.<br>
          Purpura squeezes their hand.<br>
          Fireflies dance as the Milky Way stretches overhead.<br>
          <span style="color:#ffd700">✨ A perfect night. ✨</span>
        </div>
      `,'Play Again 🔄',()=>this.engine.nextLevel('stargazing'));
    },800);
  }

  // ══════════════════════════════════════════════════════════
  //  UPDATE
  // ══════════════════════════════════════════════════════════
  update(dt) {
    this._sky?.update(dt);
    const inp=this.engine.input;
    const t=performance.now()/1000;

    // ── look around ───────────────────────────────────────
    this._yaw   -= inp.mouse.dx*this._sens;
    this._pitch -= inp.mouse.dy*this._sens;
    this._pitch  = THREE.MathUtils.clamp(this._pitch,0.16,Math.PI/2-0.03);

    const qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),this._yaw);
    const qX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-this._pitch);
    this.camera.quaternion.copy(qY).multiply(qX);
    this.camera.position.set(0,0.28,0.4);

    // ── hint panel follows view (right side, slightly down) ─
    if(this._hintMesh){
      const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(this.camera.quaternion);
      const rgt=new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion);
      const dwn=new THREE.Vector3(0,-1,0).applyQuaternion(this.camera.quaternion);
      this._hintMesh.position.copy(this.camera.position)
        .addScaledVector(fwd,3.8).addScaledVector(rgt,1.9).addScaledVector(dwn,0.7);
      this._hintMesh.quaternion.copy(this.camera.quaternion);
    }

    // ── raycast for hovered star ──────────────────────────
    const ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0,0),this.camera);
    ray.far=SKY_R+10;
    const meshOnly=this._starMeshes.map(e=>e.mesh);
    const hits=ray.intersectObjects(meshOnly,false);
    this._hoveredStar=hits.length?hits[0].object:null;

    // ── FOV zoom when aiming at a valid star ──────────────
    const targetFOV=this._hoveredStar&&
      this._hoveredStar.userData.constellIdx===this._constellIdx&&
      !this._foundStars.has(this._hoveredStar.userData.starIdx) ? 62 : 78;
    this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,targetFOV,dt*4);
    this.camera.updateProjectionMatrix();

    // ── star animations ───────────────────────────────────
    this._starMeshes.forEach(({mesh})=>{
      const ud=mesh.userData;
      const isCurrent=ud.constellIdx===this._constellIdx;
      const isFound=this._foundStars.has(ud.starIdx);
      const isHovered=mesh===this._hoveredStar;

      // base pulse scale
      const pScale=isCurrent&&!isFound ?
        1.0+Math.sin(t*2.8+mesh.position.x*0.3)*0.25 : 0.8;
      mesh.scale.setScalar(pScale);

      // glow ring opacity
      if(ud.ring){
        ud.ring.material.opacity=isFound?0.75:
          isCurrent?(0.18+Math.sin(t*3+mesh.position.y*0.3)*0.14):0;
        // make ring face camera
        ud.ring.lookAt(this.camera.position);
      }
      // sphere glow
      if(ud.glow){
        ud.glow.material.opacity=isFound?0.45:
          isHovered&&isCurrent?(0.35+Math.sin(t*6)*0.15):
          isCurrent?(0.08+Math.sin(t*2)*0.05):0;
      }
      // pop on click
      if(ud.popT!=null){
        ud.popT+=dt*5;
        mesh.scale.setScalar(1+Math.sin(ud.popT*Math.PI)*1.0);
        if(ud.popT>1) delete ud.popT;
      }
      // burst after constellation complete
      if(ud.burstT!=null){
        ud.burstT+=dt*1.5;
        if(ud.glow) ud.glow.material.opacity=Math.max(0.3,0.8-ud.burstT*0.25);
        if(ud.burstT>3) delete ud.burstT;
      }
      // brighten stars for current constellation
      if(isCurrent&&!isFound){
        mesh.material.color.setHSL(0,0,0.88+Math.sin(t*4+mesh.position.x)*0.12);
      }
    });

    // ── background star twinkle (scale-based, not size attr) ─
    this._bgStarMeshes.forEach(m=>{
      m.userData.twinkleT+=dt*m.userData.twinkleSpeed;
      const s=0.8+Math.sin(m.userData.twinkleT)*0.4;
      m.scale.setScalar(Math.max(0.1,s));
      m.material.opacity=0.45+Math.sin(m.userData.twinkleT*0.7)*0.35;
    });

    // ── constellation line fade-in ────────────────────────
    this._constellLines.forEach(m=>{
      if(m.material.opacity<0.65) m.material.opacity=Math.min(0.65,m.material.opacity+dt*0.8);
    });

    // ── fireflies ─────────────────────────────────────────
    this._fireflies.forEach(ff=>{
      ff.userData.t+=dt*ff.userData.speed;
      const ft=ff.userData.t;
      ff.position.x=ff.userData.cx+Math.sin(ft*0.7)*ff.userData.r;
      ff.position.y=ff.userData.cy+Math.sin(ft*1.3)*0.4;
      ff.position.z=ff.userData.cz+Math.cos(ft*0.9)*ff.userData.r;
      const blink=Math.sin(ft*4)*0.5+0.5;
      ff.material.opacity=blink*0.88;
      if(ff.userData.light){ ff.userData.light.position.copy(ff.position); ff.userData.light.intensity=blink*0.55; }
    });

    // ── characters breathe ────────────────────────────────
    ['avicula','purpura'].forEach(name=>{
      const ch=this.scene.userData[name]; if(!ch) return;
      ch.userData.bobT+=dt; ch.position.y=0.12+Math.sin(ch.userData.bobT*0.85)*0.011;
    });

    // ── crosshair + prompt ────────────────────────────────
    const con=CONSTELLATIONS[this._constellIdx];
    if(this._hoveredStar){
      const ud=this._hoveredStar.userData;
      const alreadyFound=this._foundStars.has(ud.starIdx);
      const isCurrent=ud.constellIdx===this._constellIdx;
      if(isCurrent&&!alreadyFound){
        this.engine.hud.showPrompt('[Click / E] Select this star ⭐');
        this.engine.hud.crosshairColor('#'+con.color.toString(16).padStart(6,'0'));
      } else if(alreadyFound){
        this.engine.hud.showPrompt('Already found ✅');
        this.engine.hud.crosshairColor('#88ff88');
      } else {
        this.engine.hud.showPrompt('Wrong constellation — check the field guide');
        this.engine.hud.crosshairColor('#888888');
      }
    } else {
      this.engine.hud.hidePrompt();
      this.engine.hud.crosshairColor('white');
    }

    // redraw hint compass once per second (updates look-direction arrow)
    if(!this._lastHintRedraw||t-this._lastHintRedraw>0.25){
      this._redrawHint(); this._lastHintRedraw=t;
    }
  }

  onInteract() {
    if(this._done||!this._hoveredStar) return;
    this._clickStar(this._hoveredStar);
  }

  _updateHUD() {
    const done=this._completedConstellations, total=CONSTELLATIONS.length;
    const rows=CONSTELLATIONS.map((con,i)=>{
      const complete=i<done, current=i===this._constellIdx;
      return `<div style="opacity:${complete?0.5:current?1:0.38};
        color:${complete?'#88ff88':current?'#ffd700':'#aaa'};
        text-decoration:${complete?'line-through':'none'};
        font-weight:${current?700:400}">
        ${complete?'✅':current?'🔭':'◻'} ${con.name}</div>`;
    }).join('');
    this.engine.hud.setInfo(`
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#ffd700">
        🌟 Stargazing (${done}/${total})</div>
      ${rows}
      <div style="font-size:11px;opacity:0.5;margin-top:6px">
        Mouse = look · Click/E = select star<br>
        Check the field guide (right side) for direction</div>`);
  }
}