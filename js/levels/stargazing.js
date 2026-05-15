// ============================================================
//  STARRY PICNIC — levels/stargazing.js  (REWRITTEN)
//
//  FIXES & CHANGES:
//  - No more giant speech bubble / HUD prompt that stays on screen.
//    Dialogue is rendered as small, faint 3D sprites written
//    directly on the sky — they fade in, linger, fade out.
//  - Ultra-detailed park: grass, flower beds, fountain, benches,
//    lampposts, distant city glow, rolling hills, dense treeline.
//  - Fireworks system: bursts, trails, sparkle after each
//    constellation reveal and at the finale.
//  - Richer aurora, milky way, and star density.
//  - Characters now have subtle idle animation (breathing, pointing).
// ============================================================
import * as THREE from 'three';
import { Level, Anime, Build } from '../engine.js';

// Override Anime.mat for this level — bypass cel shader entirely
function mat(color) {
  return new THREE.MeshBasicMaterial({ color });
}
const SKY_R = 90;

const CONSTELLATIONS = [
  {
    name:  ' Pocketwatch',
    // dialogue written small on sky — no HUD popup
    dialogue: '"Hey do you still even have my pocketwatch?" — Avicula',
    color: 0xffd700,
    delay: 5,
    stars: [[30,58],[38,52],[48,46],[44,38],[56,42],[36,32]],
    lines: [[0,1],[1,2],[2,3],[2,4],[1,5]],
    fireworks: 2,
  },
  {
    name:  'The Picnic Basket 🧺',
    dialogue: '"And there — that\'s our basket!" — Purpura',
    color: 0xcc88ff,
    delay: 16,
    stars: [[175,42],[187,42],[175,54],[187,54],[181,66]],
    lines: [[0,1],[0,2],[1,3],[2,4],[3,4],[2,3]],
    fireworks: 2,
  },
  {
    name:  'The Star Pair 💛💜',
    dialogue: '"That\'s us!!! ✨" — Both',
    color: 0xff88cc,
    delay: 28,
    stars: [[288,64],[284,56],[280,48],[302,64],[308,56],[312,48],[295,60]],
    lines: [[0,1],[1,2],[3,4],[4,5],[0,6],[3,6]],
    fireworks: 5,
  },

  {
  name:  'Computer 🌟',
  dialogue: '"Oh wow, that is where I first met you" — Avicula',
  color: 0xff0000,        // hex color for the stars/lines
  delay: 42,              // seconds before it appears
  stars: [[120,42],[128,48],[136,44],[132,36],[124,36],[140,52],[144,44]],
  lines: [[0,1],[1,2],[2,3],[3,4],[4,0],[2,5],[5,6],[6,2]],
  fireworks: 3,           // how many fireworks on reveal
},
{
  name: 'Flowers',
  dialogue: '"I love flowers so much" — Purpura',
  color: 0x44ccff,
  delay: 64,
  stars: [[60,35],[68,35],[76,35],[72,28],[64,28],[68,44],[68,22]],
  lines: [[0,1],[1,2],[0,5],[2,5],[3,4],[4,6],[3,6],[4,1]],
  fireworks: 6,
},
];

function skyPoint(azDeg, elDeg) {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(
    SKY_R * Math.cos(el) * Math.sin(az),
    SKY_R * Math.sin(el),
    SKY_R * Math.cos(el) * Math.cos(az)
  );
}

function lineCylinder(scene, pa, pb, color) {
  const dir = pb.clone().sub(pa);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(0.08, 0.08, len, 5);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pa.clone().lerp(pb, 0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  scene.add(mesh);
  return mesh;
}

// ── Sky text sprite — small, faint, written on the dome ──────
function makeSkyTextSprite(text, color='rgba(220,210,255,0.95)') {
  const canvas = document.createElement('canvas');
  canvas.width  = 1024;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,1024,120);
  // Background pill
  ctx.fillStyle = 'rgba(10,5,30,0.72)';
  ctx.beginPath();
  ctx.roundRect(10, 10, 1004, 100, 20);
  ctx.fill();
  // Border
  ctx.strokeStyle = 'rgba(200,180,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Text
  ctx.font = 'italic 38px Georgia, serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, 60);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 0, depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(55, 6.5, 1);
  return sprite;
}

export class Stargazing extends Level {
  constructor(engine) {
    super(engine);
    this._yaw   = 0.3;
    this._pitch = 1.1;
    this._t     = 0;
    this._done  = false;
    this._bgStars      = [];
    this._shootStars   = [];
    this._fireflies    = [];
    this._auroraPlanes = [];
    this._constellData = [];
    this._fireworks    = [];
    this._skyLabels    = [];   // { sprite, fadeInAt, fadeOutAt, alive }
    this._lockOnClick  = null;
  }

  init() {
    const s = this.scene;
    this._buildSky(s);
    this._buildGround(s);
    this._buildPark(s);
    this._buildPicnic(s);
    this._buildStarfield(s);
    this._buildMilkyWay(s);
    this._buildMoon(s);
    this._buildPlanets(s);
    this._buildAurora(s);
    this._buildConstellations(s);
    this._buildFireflies(s);
    this._buildCityGlow(s);
  }

  // ── Sky gradient ──────────────────────────────────────────
  _buildSky(s) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x00010a) },
        midColor: { value: new THREE.Color(0x060320) },
        botColor: { value: new THREE.Color(0x140838) },
      },
      vertexShader: `varying vec3 vPos;
        void main(){ vPos=(modelMatrix*vec4(position,1.)).xyz;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform vec3 topColor,midColor,botColor; varying vec3 vPos;
        void main(){
          float h=normalize(vPos).y*.5+.5;
          vec3 c=h>.45?mix(midColor,topColor,pow((h-.45)/.55,1.5)):mix(botColor,midColor,pow(h/.45,1.3));
          gl_FragColor=vec4(c,1.);}`,
      side: THREE.BackSide, depthWrite: false,
    });
    s.add(new THREE.Mesh(new THREE.SphereGeometry(SKY_R+2, 32, 16), mat));
    s.add(new THREE.AmbientLight(0xffffff, 2.2));
    s.add(new THREE.AmbientLight(0xffffff, 4.5));  }

  // ── Ground + rolling hills ────────────────────────────────
_buildGround(s) {
  // Base grass
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400,400), mat(0x0a1f08));
  ground.rotation.x = -Math.PI/2; s.add(ground);

  // Grass color variation tiles — denser
  for(let i=0;i<200;i++){
    const a = Math.random()*Math.PI*2, r = 0.5+Math.random()*60;
    const size = 0.8+Math.random()*3.5;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(size, 7),
      mat([0x0e2a0c,0x071508,0x0c2410,0x122e0e,0x081a06][Math.floor(Math.random()*5)]));
    patch.rotation.x = -Math.PI/2;
    patch.position.set(Math.cos(a)*r, 0.002, Math.sin(a)*r);
    s.add(patch);
  }

  // Grass tufts — small upright blades
  for(let i=0;i<300;i++){
    const a = Math.random()*Math.PI*2, r = 1+Math.random()*25;
    const tuft = new THREE.Mesh(
      new THREE.ConeGeometry(0.04+Math.random()*0.04, 0.18+Math.random()*0.22, 4),
      mat([0x1a4a10,0x0e3008,0x226618,0x1c5212][Math.floor(Math.random()*4)]));
    tuft.position.set(Math.cos(a)*r, 0.09, Math.sin(a)*r);
    tuft.rotation.y = Math.random()*Math.PI;
    tuft.rotation.z = (Math.random()-0.5)*0.3;
    s.add(tuft);
  }

  // Dirt/mud patches
  for(let i=0;i<30;i++){
    const a = Math.random()*Math.PI*2, r = 2+Math.random()*20;
    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(0.3+Math.random()*0.8, 7),
      mat(0x1a0e08));
    dirt.rotation.x = -Math.PI/2;
    dirt.position.set(Math.cos(a)*r, 0.003, Math.sin(a)*r);
    s.add(dirt);
  }

  // Fallen leaves scattered around
  const leafColors = [0x3a2008, 0x4a1a04, 0x2a1a04, 0x5a2a08];
  for(let i=0;i<80;i++){
    const a = Math.random()*Math.PI*2, r = 1+Math.random()*22;
    const leaf = new THREE.Mesh(
      new THREE.CircleGeometry(0.08+Math.random()*0.10, 5),
      mat(leafColors[Math.floor(Math.random()*leafColors.length)]));
    leaf.rotation.x = -Math.PI/2;
    leaf.rotation.z = Math.random()*Math.PI;
    leaf.position.set(Math.cos(a)*r, 0.004, Math.sin(a)*r);
    s.add(leaf);
  }

  // Small rocks scattered
  for(let i=0;i<50;i++){
    const a = Math.random()*Math.PI*2, r = 2+Math.random()*28;
    const rock = new THREE.Mesh(
      new THREE.SphereGeometry(0.06+Math.random()*0.12, 5, 4),
      mat([0x2a2030,0x1e1a28,0x282030][Math.floor(Math.random()*3)]));
    rock.position.set(Math.cos(a)*r, 0.04, Math.sin(a)*r);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.scale.set(1, 0.6+Math.random()*0.5, 1);
    s.add(rock);
  }

  // Mushrooms
  for(let i=0;i<20;i++){
    const a = Math.random()*Math.PI*2, r = 3+Math.random()*18;
    const mx = Math.cos(a)*r, mz = Math.sin(a)*r;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.04,0.14,6), mat(0xddc8a0));
    stem.position.set(mx, 0.07, mz); s.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.10,8,5), mat(
      [0xcc2222,0xaa1a1a,0xdd4422,0x8b2200][Math.floor(Math.random()*4)]));
    cap.position.set(mx, 0.17, mz); cap.scale.y = 0.55; s.add(cap);
    // White spots
    for(let sp=0;sp<3;sp++){
      const sa=(sp/3)*Math.PI*2;
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.018,5),
        new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.8}));
      spot.rotation.x=-Math.PI/2;
      spot.position.set(mx+Math.cos(sa)*0.05, 0.175, mz+Math.sin(sa)*0.05);
      s.add(spot);
    }
  }

  // Rolling hills
  for(let h=0;h<8;h++){
    const a = (h/8)*Math.PI*2;
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(18+Math.random()*14, 10, 6),
      mat(0x061006));
    hill.position.set(Math.cos(a)*52, -16+Math.random()*4, Math.sin(a)*52);
    s.add(hill);
  }

  // Dense treeline
  for(let i=0;i<60;i++){
    const a  = (i/60)*Math.PI*2 + (Math.random()-0.5)*0.18;
    const r  = 28 + Math.random()*18;
    this._plantTree(s, Math.cos(a)*r, Math.sin(a)*r,
      1.6+Math.random()*2.2, Math.random()>0.3);
  }
  for(let i=0;i<12;i++){
    const a = Math.random()*Math.PI*2, r = 12+Math.random()*10;
    this._plantTree(s, Math.cos(a)*r, Math.sin(a)*r, 1.2+Math.random()*1.4, false);
  }
}
  _plantTree(s, x, z, scale, conifer) {
    const trunkMat = mat(0x060e04);
    const h = (conifer ? 2.8 : 2.0)*scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1*scale,0.17*scale,h,7), trunkMat);
    trunk.position.set(x, h/2, z); s.add(trunk);
    if(conifer){
      [0,0.7,1.4].forEach((ty,ti) => {
        const crown = new THREE.Mesh(
          new THREE.ConeGeometry((1.5-ti*0.35)*scale, 1.1*scale, 8),
          mat(ti===0?0x030a02:0x061008));
        crown.position.set(x, h+ty*scale, z); s.add(crown);
      });
    } else {
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry((0.9+Math.random()*0.4)*scale, 8, 6),
        mat(Math.random()>0.5?0x061008:0x040c06));
      crown.position.set(x, h+0.6*scale, z); s.add(crown);
    }

  }

  // ── Park features ─────────────────────────────────────────
  _buildPark(s) {
    this._buildPaths(s);
    this._buildFountain(s);
    this._buildBenches(s);
    this._buildLampposts(s);
    this._buildFlowerBeds(s);
    this._buildPond(s);
    this._buildBushes(s);
  }

  _buildPaths(s) {
    // Curved gravel paths
    const pathMat = mat(0x1a140e);
    // Main cross paths
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 30), pathMat);
    p1.rotation.x = -Math.PI/2; p1.position.set(8,0.003,0); s.add(p1);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(30, 1.2), pathMat);
    p2.rotation.x = -Math.PI/2; p2.position.set(8,0.003,8); s.add(p2);
    // Diagonal path to blanket
    const p3 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 14), pathMat);
    p3.rotation.x = -Math.PI/2; p3.rotation.z = Math.PI/4;
    p3.position.set(4,0.003,4); s.add(p3);
    // Gravel texture dots
    for(let i=0;i<80;i++){
      const gx=8+(Math.random()-0.5)*0.9, gz=-14+Math.random()*28;
      const pebble = new THREE.Mesh(new THREE.CircleGeometry(0.04+Math.random()*0.04,5), mat(0x2a2018));
      pebble.rotation.x=-Math.PI/2; pebble.position.set(gx,0.004,gz); s.add(pebble);
    }
  }

  _buildFountain(s) {
    const fx=10, fz=8;
    // Basin
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.5,0.38,18), mat(0x2a2230));
    basin.position.set(fx,0.19,fz); s.add(basin); Anime.outline(basin,0.03);
    // Water surface
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.45,0.06,18), mat(0x1a3a5a));
    water.position.set(fx,0.34,fz); s.add(water);
    // Water shimmer
    const shimmer = new THREE.Mesh(new THREE.CylinderGeometry(1.42,1.42,0.01,18),
      new THREE.MeshBasicMaterial({color:0x4488bb,transparent:true,opacity:0.5}));
    shimmer.position.set(fx,0.36,fz); s.add(shimmer);
    this._fountainShimmer = shimmer;
    // Centre column
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.14,0.8,10), mat(0x3a2a40));
    col.position.set(fx,0.58,fz); s.add(col);
    // Spray drops (small spheres)
    this._fountainDrops = [];
    for(let fd=0;fd<18;fd++){
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.04,5,4),
        new THREE.MeshBasicMaterial({color:0x88ccff,transparent:true,opacity:0.7}));
      drop.userData.phase = (fd/18)*Math.PI*2;
      drop.userData.r = 0.1+Math.random()*0.35;
      drop.userData.speed = 1.2+Math.random()*0.8;
      s.add(drop); this._fountainDrops.push(drop);
      drop.position.set(fx,0.5,fz);
    }
    const fLight = new THREE.PointLight(0x4499cc,0.6,5);
    fLight.position.set(fx,0.8,fz); s.add(fLight);
  }

  _buildBenches(s) {
    const benchPositions = [
      [10,0,4, 0],[10,0,12, Math.PI],[6,0,8, Math.PI/2],[-4,0,10, -Math.PI/4],
    ];
    benchPositions.forEach(([x,y,z,ry]) => {
      const g = new THREE.Group(); g.position.set(x,y,z); g.rotation.y=ry; s.add(g);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.07,0.38), mat(0x3a2010));
      seat.position.y=0.44; g.add(seat); Anime.outline(seat,0.02);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.32,0.06), mat(0x3a2010));
      back.position.set(0,0.66,-0.16); g.add(back);
      [[-0.44,0],[0.44,0]].forEach(([lx]) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.44,0.36), mat(0x2a1a08));
        leg.position.set(lx,0.22,0); g.add(leg);
      });
    });
  }

  _buildLampposts(s) {
    const postPositions = [[8,6],[8,-6],[14,8],[14,0],[2,10],[-2,6]];
    postPositions.forEach(([x,z]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.07,3.2,8), mat(0x1a1825));
      post.position.set(x,1.6,z); s.add(post);
      // Curved arm
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.6,6), mat(0x1a1825));
      arm.rotation.z = Math.PI/2; arm.position.set(x+0.3,3.12,z); s.add(arm);
      // Lamp globe
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6),
        new THREE.MeshBasicMaterial({color:0xfff0cc}));
      globe.position.set(x+0.6,3.12,z); s.add(globe);
      const lp = new THREE.PointLight(0xffe8a0,0.9,8);
      lp.position.set(x+0.6,3.0,z); s.add(lp);
      // Pool of light on grass
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.8,12),
        new THREE.MeshBasicMaterial({color:0xffd060,transparent:true,opacity:0.07,side:THREE.DoubleSide}));
      pool.rotation.x=-Math.PI/2; pool.position.set(x+0.6,0.01,z); s.add(pool);
    });
  }

  _buildFlowerBeds(s) {
    // Circular beds around fountain
    const bedCenters = [[10,4],[10,12],[7,8],[13,8],[10,8-3.4]];
    const flowerColors = [0xff6688,0xff88aa,0xffaabb,0xffcc44,0xee88ff,0xff4466,0xffd700,0xcc44ff];
    bedCenters.forEach(([bx,bz]) => {
      // Bed border
      const bed = new THREE.Mesh(new THREE.CircleGeometry(0.7,10), mat(0x1a0e08));
      bed.rotation.x=-Math.PI/2; bed.position.set(bx,0.004,bz); s.add(bed);
      // Flowers
      for(let f=0;f<9;f++){
        const fa=(f/9)*Math.PI*2, fr=0.1+Math.random()*0.48;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.018,0.25,5),
          mat(0x2a6018));
        stem.position.set(bx+Math.cos(fa)*fr,0.125,bz+Math.sin(fa)*fr); s.add(stem);
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.07+Math.random()*0.04,7,5),
          mat(flowerColors[Math.floor(Math.random()*flowerColors.length)]));
        bloom.position.set(bx+Math.cos(fa)*fr,0.27,bz+Math.sin(fa)*fr); s.add(bloom);
        // Petals
        for(let p=0;p<5;p++){
          const pa2=(p/5)*Math.PI*2;
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.04,5,4), mat(flowerColors[(f+p)%flowerColors.length]));
          petal.position.set(
            bx+Math.cos(fa)*fr+Math.cos(pa2)*0.06,
            0.27,
            bz+Math.sin(fa)*fr+Math.sin(pa2)*0.06);
          petal.scale.y=0.4; s.add(petal);
        }
      }
    });

    // Long border beds on path edges
    for(let i=0;i<12;i++){
      const bx2=8.8+(Math.random()-0.5)*0.3, bz2=-10+i*2;
      for(let f2=0;f2<3;f2++){
        const bloom2 = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,5),
          mat(flowerColors[Math.floor(Math.random()*flowerColors.length)]));
        bloom2.position.set(bx2+Math.random()*0.3-0.15,0.2,bz2+Math.random()*0.4);
        s.add(bloom2);
      }
    }
  }

  _buildPond(s) {
    // Small decorative pond near treeline
    const pond = new THREE.Mesh(new THREE.EllipseCurve ? // graceful fallback
      new THREE.CircleGeometry(2.8, 16) : new THREE.CircleGeometry(2.8, 16),
      mat(0x0a1a2e));
    pond.rotation.x=-Math.PI/2; pond.position.set(-8,0.01,6); s.add(pond);
    const pondShine = new THREE.Mesh(new THREE.CircleGeometry(2.7,16),
      new THREE.MeshBasicMaterial({color:0x112233,transparent:true,opacity:0.8}));
    pondShine.rotation.x=-Math.PI/2; pondShine.position.set(-8,0.012,6); s.add(pondShine);
    // Moon reflection on pond
    const reflection = new THREE.Mesh(new THREE.CircleGeometry(0.4,10),
      new THREE.MeshBasicMaterial({color:0xfff0cc,transparent:true,opacity:0.35}));
    reflection.rotation.x=-Math.PI/2; reflection.position.set(-8.4,0.015,5.6); s.add(reflection);
    this._pondReflection = reflection;
    // Lily pads
    for(let l=0;l<6;l++){
      const a=Math.random()*Math.PI*2, r=0.6+Math.random()*1.8;
      const lily = new THREE.Mesh(new THREE.CircleGeometry(0.18+Math.random()*0.1,8),
        mat(0x1a5e18));
      lily.rotation.x=-Math.PI/2; lily.position.set(-8+Math.cos(a)*r,0.014,6+Math.sin(a)*r);
      s.add(lily);
    }
    // Pond border stones
    for(let ps=0;ps<16;ps++){
      const pa=(ps/16)*Math.PI*2;
      const stone = new THREE.Mesh(new THREE.SphereGeometry(0.14+Math.random()*0.08,5,4),
        mat(0x2a2030));
      stone.position.set(-8+Math.cos(pa)*2.9,0.06,6+Math.sin(pa)*2.7); s.add(stone);
    }
    const pondLight = new THREE.PointLight(0x1a3a6a,0.4,6);
    pondLight.position.set(-8,0.5,6); s.add(pondLight);
  }

  _buildBushes(s) {
    const bushPositions = [
      [5,3],[6,-3],[-3,4],[3,12],[12,5],[9,-4],[7,14],[-5,8],
    ];
    bushPositions.forEach(([x,z]) => {
      const scale = 0.5+Math.random()*0.5;
      for(let b=0;b<3;b++){
        const bx=x+Math.random()*0.5-0.25, bz2=z+Math.random()*0.5-0.25;
        const bush = new THREE.Mesh(
          new THREE.SphereGeometry((0.28+Math.random()*0.18)*scale,7,5),
          mat(Math.random()>0.4?0x0c2208:0x142e10));
        bush.position.set(bx,(0.2+Math.random()*0.12)*scale,bz2); s.add(bush);
      }
    });
  }

  // ── Distant city glow on horizon ──────────────────────────
  _buildCityGlow(s) {
    // Soft horizon glow behind treeline
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6622, transparent: true, opacity: 0.06, side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(60,8), glowMat);
    glow.rotation.x = Math.PI/2 - 0.18;
    glow.position.set(-20, 1.5, -42); s.add(glow);

    const glow2 = new THREE.Mesh(new THREE.PlaneGeometry(40,5),
      new THREE.MeshBasicMaterial({color:0xffaa33,transparent:true,opacity:0.04,side:THREE.DoubleSide}));
    glow2.rotation.x = Math.PI/2 - 0.14;
    glow2.position.set(30, 1.2, -38); s.add(glow2);
  }

  // ── Picnic setup ──────────────────────────────────────────
  _buildPicnic(s) {
    // Blanket
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(4.4,3.8), mat(0x3a1a55));
    blanket.rotation.x=-Math.PI/2; blanket.position.set(0,0.01,0); s.add(blanket);
    [0.7,1.4,-0.7,-1.4].forEach(sx => {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.22,3.6), mat(0x5a3080));
      stripe.rotation.x=-Math.PI/2; stripe.position.set(sx,0.016,0); s.add(stripe);
    });
    [0,0.9,-0.9].forEach(sz => {
      const cross = new THREE.Mesh(new THREE.PlaneGeometry(3.6,0.16), mat(0x6a3898));
      cross.rotation.x=-Math.PI/2; cross.position.set(0,0.015,sz); s.add(cross);
    });
    // Blanket fringe tassels
    for(let t=0;t<18;t++){
      const tx=-2.0+(t/17)*4.0;
      const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.010,0.18,5),
        mat(0x7744aa));
      tassel.position.set(tx,0.01,-1.95); s.add(tassel);
      const tassel2 = tassel.clone();
      tassel2.position.set(tx,0.01,1.95); s.add(tassel2);
    }

    // Picnic basket
    const bask = new THREE.Mesh(new THREE.BoxGeometry(0.82,0.60,0.70), mat(0x4a2c14));
    bask.position.set(-1.6,0.32,-0.95); s.add(bask); Anime.outline(bask,0.04);
    const basketLid = new THREE.Mesh(new THREE.BoxGeometry(0.84,0.14,0.72), mat(0x5a3818));
    basketLid.position.set(-1.6,0.68,-0.95); s.add(basketLid); Anime.outline(basketLid,0.03);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.28,0.032,6,16,Math.PI),
      mat(0x6a4422));
    handle.rotation.z=Math.PI; handle.rotation.y=Math.PI/2;
    handle.position.set(-1.6,0.94,-0.95); s.add(handle);

    // Food items on blanket
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.04,14), mat(0xf0ece0));
    plate.position.set(0.6,0.04,0.5); s.add(plate); Anime.outline(plate,0.02);
    const sandwich = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.10,0.18), mat(0xd4a040));
    sandwich.position.set(0.6,0.10,0.5); s.add(sandwich);
    const cup1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.06,0.20,8), mat(0xffee66));
    cup1.position.set(1.2,0.12,0.3); s.add(cup1); Anime.outline(cup1,0.02);
    const cup2 = cup1.clone(); cup2.material=mat(0xcc88ff);
    cup2.position.set(1.0,0.12,-0.3); s.add(cup2); Anime.outline(cup2,0.02);
    // Cookie tin
    const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.10,10), mat(0x884422));
    tin.position.set(-0.4,0.08,-0.7); s.add(tin); Anime.outline(tin,0.02);

    // Characters
    this._buildChar(s,-0.65,0.1,0.3,0xffdd44,0xffe8c0,'avicula');
    this._buildChar(s, 0.65,0.1,0.3,0xcc88ff,0xffe0cc,'purpura');

    // Pointing arm
    const armGeo = new THREE.CylinderGeometry(0.04,0.03,0.55,6);
    const arm = new THREE.Mesh(armGeo, mat(0xffdd44));
    arm.rotation.z=-0.85; arm.position.set(-0.38,0.40,0.08); s.add(arm);

    // Small lantern between characters
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.18,0.14), mat(0x2a1a08));
    lantern.position.set(0,0.14,0.6); s.add(lantern); Anime.outline(lantern,0.02);
    const lanternGlow = new THREE.Mesh(new THREE.SphereGeometry(0.055,6,5),
      new THREE.MeshBasicMaterial({color:0xffdd44}));
    lanternGlow.position.set(0,0.18,0.6); s.add(lanternGlow);
    const lanternLight = new THREE.PointLight(0xffcc44,0.8,3.5);
    lanternLight.position.set(0,0.3,0.6); s.add(lanternLight);
    this._lanternLight = lanternLight; this._lanternT = 0;
  }

  _buildChar(s, x, y, z, bodyCol, headCol, name) {
    const g = new THREE.Group(); s.add(g); g.position.set(x,y,z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.22,0.90,10), mat(bodyCol));
    body.rotation.z = Math.PI/2; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24,12,10), mat(headCol));
    head.position.set(0.58,0.10,0); g.add(head);
    // Eyes looking up
    [-0.07,0.07].forEach(ez => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034,6,6),
        new THREE.MeshBasicMaterial({color:0x111100}));
      eye.position.set(0.70,0.16,ez); g.add(eye);
    });
    // Star reflection in eyes (tiny white dot)
    [-0.07,0.07].forEach(ez => {
      const gleam = new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4),
        new THREE.MeshBasicMaterial({color:0xffffff}));
      gleam.position.set(0.725,0.175,ez+0.02); g.add(gleam);
    });
    // Small star on body
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.04,0),
      mat(name==='avicula'?0xfff066:0xee99ff));
    star.position.set(0.05,0.06,0.16); star.rotation.z=Math.PI/4; g.add(star);

    g.userData.bobT = name==='purpura' ? Math.PI/3 : 0;
    g.userData.name = name;
    this.scene.userData[name] = g;
  }

  // ── Starfield ─────────────────────────────────────────────
  _buildStarfield(s) {
    // Three point-cloud layers
    [
      {count:3000, size:0.28, opacity:0.92},
      {count:900,  size:0.55, opacity:0.68},
      {count:240,  size:0.95, opacity:0.48},
    ].forEach(layer => {
      const pos = new Float32Array(layer.count*3);
      const col = new Float32Array(layer.count*3);
      for(let i=0;i<layer.count;i++){
        const az=Math.random()*Math.PI*2;
        const el=Math.asin(Math.random());
        const r=SKY_R-1+Math.random()*2;
        pos[i*3]=r*Math.cos(el)*Math.sin(az);
        pos[i*3+1]=r*Math.sin(el);
        pos[i*3+2]=r*Math.cos(el)*Math.cos(az);
        const w=Math.random();
        col[i*3]=0.75+w*0.25; col[i*3+1]=0.80; col[i*3+2]=0.95-w*0.10;
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
      geo.setAttribute('color',   new THREE.BufferAttribute(col,3));
      s.add(new THREE.Points(geo,new THREE.PointsMaterial({
        size:layer.size,sizeAttenuation:true,vertexColors:true,
        transparent:true,opacity:layer.opacity,
      })));
    });

    // Bright individual twinkle stars
    for(let i=0;i<110;i++){
      const az=Math.random()*Math.PI*2, el=0.08+Math.random()*1.42;
      const r=SKY_R-2;
      const m=new THREE.Mesh(
        new THREE.SphereGeometry(0.14+Math.random()*0.28,5,4),
        new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:Math.random()*0.4+0.45}));
      m.position.set(r*Math.cos(el)*Math.sin(az),r*Math.sin(el),r*Math.cos(el)*Math.cos(az));
      m.userData.twinkleT=Math.random()*Math.PI*2;
      m.userData.twinkleSpeed=0.4+Math.random()*2.2;
      s.add(m); this._bgStars.push(m);
    }
  }

  // ── Milky way band ────────────────────────────────────────
  _buildMilkyWay(s) {
    const count=2200;
    const pos=new Float32Array(count*3);
    const col=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const t=(i/count)*Math.PI*2, band=(Math.random()-0.5)*0.38;
      const el=Math.sin(t)*0.60+band+0.35;
      if(el<0.04){pos[i*3]=pos[i*3+1]=pos[i*3+2]=0;continue;}
      const r=SKY_R-3;
      pos[i*3]=r*Math.cos(el)*Math.sin(t);
      pos[i*3+1]=r*Math.sin(el);
      pos[i*3+2]=r*Math.cos(el)*Math.cos(t);
      const c=Math.abs(band)/0.19;
      col[i*3]=0.55+(1-c)*0.40; col[i*3+1]=0.50+(1-c)*0.24; col[i*3+2]=0.90;
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color',   new THREE.BufferAttribute(col,3));
    s.add(new THREE.Points(geo,new THREE.PointsMaterial({
      size:0.78,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:0.42,
    })));
  }

  // ── Moon ──────────────────────────────────────────────────
  _buildMoon(s) {
    const mp=skyPoint(212,56);
    const moon=new THREE.Mesh(new THREE.SphereGeometry(3.8,20,16),
      new THREE.MeshBasicMaterial({color:0xfff9f0}));
    moon.position.copy(mp); s.add(moon);
    // Craters
    [[1.1,0.7,0.65],[-0.9,1.6,0.46],[0.3,-1.1,0.54],[-1.4,-0.5,0.38],[0.8,-0.8,0.28]].forEach(([cx,cy,cr])=>{
      const c=new THREE.Mesh(new THREE.CircleGeometry(cr,8),
        new THREE.MeshBasicMaterial({color:0xeedd99,transparent:true,opacity:0.5}));
      c.position.set(mp.x+cx,mp.y+cy,mp.z+0.2); c.lookAt(0,0,0); s.add(c);
    });
    // Halos
    [
      {r:7.8, c:0xfff0aa, op:0.06},
      {r:16,  c:0x88aaff, op:0.022},
      {r:30,  c:0x6688cc, op:0.010},
    ].forEach(({r,c,op})=>{
      const h=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),
        new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,side:THREE.BackSide}));
      h.position.copy(mp); s.add(h);
    });
    const moonLight=new THREE.PointLight(0xc8d8ff,0.7,220);
    moonLight.position.copy(mp); s.add(moonLight);
  }

  // ── Planets ───────────────────────────────────────────────
  _buildPlanets(s) {
    // Venus-like bright planet
    const venus=new THREE.Mesh(new THREE.SphereGeometry(0.9,10,8),
      new THREE.MeshBasicMaterial({color:0xffeecc}));
    venus.position.copy(skyPoint(80,38)); s.add(venus);
    const vHalo=new THREE.Mesh(new THREE.SphereGeometry(2.2,8,6),
      new THREE.MeshBasicMaterial({color:0xffeebb,transparent:true,opacity:0.08,side:THREE.BackSide}));
    vHalo.position.copy(skyPoint(80,38)); s.add(vHalo);

    // Reddish Mars-like
    const mars=new THREE.Mesh(new THREE.SphereGeometry(0.5,8,6),
      new THREE.MeshBasicMaterial({color:0xff8855}));
    mars.position.copy(skyPoint(340,44)); s.add(mars);
  }

  // ── Aurora ────────────────────────────────────────────────
  _buildAurora(s) {
    [
      [0x00ffaa, 0.07],
      [0x44aaff, 0.055],
      [0xaa44ff, 0.045],
      [0x00ffcc, 0.038],
    ].forEach(([col,op],i)=>{
      const mat=new THREE.MeshBasicMaterial({
        color:col,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,
      });
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(SKY_R*2.8,22+i*7),mat);
      plane.rotation.x=-Math.PI/2; plane.rotation.z=i*0.7;
      plane.position.y=10+i*5; plane.renderOrder=-1;
      s.add(plane);
      this._auroraPlanes.push({mat,base:op,phase:i*1.4});
    });
  }

  // ── Constellations ────────────────────────────────────────
  _buildConstellations(s) {
    CONSTELLATIONS.forEach(con => {
      const stars=con.stars.map(([az,el])=>{
        const wp=skyPoint(az,el);
        const mesh=new THREE.Mesh(new THREE.SphereGeometry(2.0,10,8),
          new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0}));
        mesh.position.copy(wp); s.add(mesh);
        const glow=new THREE.Mesh(new THREE.SphereGeometry(4.2,8,6),
          new THREE.MeshBasicMaterial({color:con.color,transparent:true,opacity:0}));
        glow.position.copy(wp); s.add(glow);
        mesh.userData.glow=glow;
        return mesh;
      });
      const lines=con.lines.map(([a,b])=>
        lineCylinder(s,skyPoint(con.stars[a][0],con.stars[a][1]),
                       skyPoint(con.stars[b][0],con.stars[b][1]),con.color));

      // ── Sky text sprite (THE FIX: no HUD bubble) ─────────
      // Position the text just below the constellation's
      // average sky position, very small and faint
      const avgAz=con.stars.reduce((s,[a])=>s+a,0)/con.stars.length;
      const avgEl=con.stars.reduce((s,[,e])=>s+e,0)/con.stars.length;
      const textPos=skyPoint(avgAz, avgEl-8);  // slightly below stars
      const sprite=makeSkyTextSprite(con.dialogue);
      sprite.position.copy(textPos);
      sprite.position.multiplyScalar(0.5); // pull in a bit so it's readable
      s.add(sprite);

      this._constellData.push({stars,lines,sprite,revealed:false,revealT:-1});
    });
  }

  // ── Fireflies ─────────────────────────────────────────────
  _buildFireflies(s) {
    for(let i=0;i<40;i++){
      const ff=new THREE.Mesh(new THREE.SphereGeometry(0.055,5,4),
        new THREE.MeshBasicMaterial({color:0xccff44,transparent:true,opacity:0}));
      const r=3+Math.random()*22, a=Math.random()*Math.PI*2;
      ff.position.set(Math.cos(a)*r,0.3+Math.random()*3.5,Math.sin(a)*r);
      ff.userData={
        t:Math.random()*Math.PI*2,
        cx:ff.position.x,cy:ff.position.y,cz:ff.position.z,
        speed:0.3+Math.random()*1.2,
        r:1.0+Math.random()*3.0,
      };
      s.add(ff);
      const pt=new THREE.PointLight(0xaaffaa,0,5); pt.position.copy(ff.position); s.add(pt);
      ff.userData.light=pt;
      this._fireflies.push(ff);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  FIREWORKS SYSTEM
  // ══════════════════════════════════════════════════════════
  _spawnFirework(x, y, z, color) {
    const particleCount = 28+Math.floor(Math.random()*18);
    const particles = [];
    for(let p=0;p<particleCount;p++){
      const vel=new THREE.Vector3(
        (Math.random()-0.5)*1.8,
        0.6+Math.random()*1.4,
        (Math.random()-0.5)*1.8
      ).normalize().multiplyScalar(8+Math.random()*12);
      const mesh=new THREE.Mesh(
        new THREE.SphereGeometry(0.10+Math.random()*0.12,4,3),
        new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));
      mesh.position.set(x,y,z); this.scene.add(mesh);
      particles.push({mesh,vel,t:0,life:0.7+Math.random()*0.6});
    }
    // Burst light
    const burstLight=new THREE.PointLight(color,4.0,25);
    burstLight.position.set(x,y,z); this.scene.add(burstLight);
    this._fireworks.push({particles,burstLight,t:0});
  }

  _spawnFireworkBurst(count) {
    const colors=[0xffd700,0xff6688,0xcc88ff,0x44ffcc,0xff8844,0xffffff,0x66ff66];
    for(let fw=0;fw<count;fw++){
      setTimeout(()=>{
        // Fireworks high up and spread around
        const a=Math.random()*Math.PI*2;
        const r=5+Math.random()*12;
        this._spawnFirework(
          Math.cos(a)*r,
          18+Math.random()*14,
          Math.sin(a)*r,
          colors[Math.floor(Math.random()*colors.length)]);
      }, fw*320+Math.random()*200);
    }
  }

  // ══════════════════════════════════════════════════════════
  onEnter() {
    this._t=0; this._done=false;
    this._yaw=0.3; this._pitch=1.12;
    this._fireworks=[];
    this._constellData.forEach(cd=>{
      cd.revealed=false; cd.revealT=-1;
      cd.stars.forEach(m=>{m.material.opacity=0;if(m.userData.glow)m.userData.glow.material.opacity=0;});
      cd.lines.forEach(l=>{l.material.opacity=0;});
      if(cd.sprite) cd.sprite.material.opacity=0;
    });
    this.camera.fov=72; this.camera.updateProjectionMatrix();
    this.camera.position.set(0,1.6,0.5);
    setTimeout(()=>{if(!this.engine.input.locked)this.engine.input.requestLock();},400);
    this._lockOnClick=()=>{if(!this.engine.input.locked)this.engine.input.requestLock();};
    document.getElementById('canvas').addEventListener('click',this._lockOnClick);
    this.engine.audio.play('music',58);
    this._updateHUD(0);
    // Brief fade-in prompt, then gone
    this.engine.hud.showPrompt('Lie back and watch the stars… ✨');
    setTimeout(()=>this.engine.hud.hidePrompt(),3000);
  }

  onExit() {
    this.engine.audio.play('musicStop');
    if(this._lockOnClick)
      document.getElementById('canvas').removeEventListener('click',this._lockOnClick);
  }

  // ══════════════════════════════════════════════════════════
  update(dt) {
    const inp=this.engine.input;
    this._t+=dt;
    const t=this._t;

    // Look around
    this._yaw  -=inp.mouse.dx*0.003;
    this._pitch -=inp.mouse.dy*0.003;
    this._pitch=THREE.MathUtils.clamp(this._pitch,0.28,Math.PI/2+0.38);
    const qY=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),this._yaw);
    const qX=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),this._pitch);
    this.camera.quaternion.copy(qY).multiply(qX);
    this.camera.position.set(0,1.6,0.5);

    // ── Constellation reveal ──────────────────────────────
    CONSTELLATIONS.forEach((con,ci)=>{
      const cd=this._constellData[ci];
      if(!cd.revealed && t>=con.delay){
        cd.revealed=true; cd.revealT=0;
        // No HUD popup — dialogue appears as sky text
        this.engine.audio.play('pickup');
        this._updateHUD(ci+1);
        // Fireworks!
        this._spawnFireworkBurst(con.fireworks||2);
      }
      if(cd.revealT>=0){
        cd.revealT+=dt;
        const rt=cd.revealT;

        // Stars fade in
        cd.stars.forEach((m,si)=>{
          const starT=Math.max(0,Math.min((rt-si*0.18)/1.4,1));
          m.material.opacity=starT;
          if(m.userData.glow) m.userData.glow.material.opacity=starT*0.34;
          m.scale.setScalar(1+Math.sin(t*2.5+si)*0.15*starT);
        });
        // Lines draw in
        cd.lines.forEach((l,li)=>{
          l.material.opacity=Math.max(0,Math.min((rt-0.9-li*0.12)/1.2,1))*0.75;
        });

        // Sky text sprite: fade in after 1s, hold 7s, fade out
        if(cd.sprite){
          const fadeIn  = Math.max(0,Math.min((rt-1.0)/1.2,1));
          const fadeOut = Math.max(0,1-Math.max(0,(rt-8.0)/1.8));
          cd.sprite.material.opacity = fadeIn*fadeOut*0.78;
        }
      }
    });

    // Star field slow drift
    this.scene.children.forEach(obj=>{if(obj.isPoints)obj.rotation.y+=dt*0.003;});

    // Twinkle
    this._bgStars.forEach(m=>{
      m.userData.twinkleT+=dt*m.userData.twinkleSpeed;
      m.scale.setScalar(Math.max(0.1,0.70+Math.sin(m.userData.twinkleT)*0.50));
      m.material.opacity=0.35+Math.sin(m.userData.twinkleT*0.7)*0.45;
    });

    // Aurora pulse
    this._auroraPlanes.forEach(({mat,base,phase})=>{
      mat.opacity=base*(0.35+Math.sin(t*0.22+phase)*0.65);
    });

    // Shooting stars
    if(Math.random()<dt*0.22) this._spawnShootingStar();
    this._shootStars=this._shootStars.filter(ss=>{
      ss.t+=dt*2.6;
      ss.mesh.position.addScaledVector(ss.vel,dt*60);
      ss.mesh.material.opacity=Math.max(0,1-ss.t);
      if(ss.t>=1){this.scene.remove(ss.mesh);return false;}
      return true;
    });

    // Fireflies
    this._fireflies.forEach(ff=>{
      ff.userData.t+=dt*ff.userData.speed;
      const ft=ff.userData.t;
      ff.position.set(
        ff.userData.cx+Math.sin(ft*0.7)*ff.userData.r,
        ff.userData.cy+Math.sin(ft*1.3)*0.55,
        ff.userData.cz+Math.cos(ft*0.9)*ff.userData.r);
      const blink=Math.sin(ft*3.2)*0.5+0.5;
      ff.material.opacity=blink*0.92;
      if(ff.userData.light){
        ff.userData.light.position.copy(ff.position);
        ff.userData.light.intensity=blink*0.7;
      }
    });

    // Fireworks update
    this._fireworks=this._fireworks.filter(fw=>{
      fw.t+=dt;
      let alive=false;
      fw.particles=fw.particles.filter(p=>{
        p.t+=dt;
        p.vel.y-=dt*9;  // gravity
        p.mesh.position.addScaledVector(p.vel,dt);
        p.mesh.material.opacity=Math.max(0,1-p.t/p.life);
        if(p.t>=p.life){this.scene.remove(p.mesh);return false;}
        alive=true; return true;
      });
      fw.burstLight.intensity=Math.max(0,4.0-fw.t*8);
      if(!alive){this.scene.remove(fw.burstLight);return false;}
      return true;
    });

    // Fountain drops arc
    if(this._fountainDrops){
      this._fountainDrops.forEach(drop=>{
        const ft=t*drop.userData.speed+drop.userData.phase;
        const arc=Math.sin(ft%(Math.PI))*0.9;
        drop.position.set(
          10+Math.cos(drop.userData.phase)*drop.userData.r*arc,
          0.38+arc*0.8,
          8+Math.sin(drop.userData.phase)*drop.userData.r*arc);
        drop.material.opacity=arc>0.05?0.7:0;
      });
      if(this._fountainShimmer){
        this._fountainShimmer.material.opacity=0.4+Math.sin(t*2.1)*0.15;
      }
    }

    // Lantern flicker
    if(this._lanternLight){
      this._lanternT+=dt;
      this._lanternLight.intensity=0.6+Math.sin(this._lanternT*6.1)*0.18+Math.sin(this._lanternT*11.3)*0.08;
    }

    // Characters breathe
    ['avicula','purpura'].forEach(name=>{
      const ch=this.scene.userData[name]; if(!ch) return;
      ch.userData.bobT=(ch.userData.bobT||0)+dt;
      ch.position.y=0.1+Math.sin(ch.userData.bobT*0.65)*0.013;
      // Subtle head bob
      const head=ch.children[1];
      if(head) head.position.y=0.10+Math.sin(ch.userData.bobT*0.65+0.3)*0.008;
    });

    // Pond reflection shimmer
    if(this._pondReflection){
      this._pondReflection.material.opacity=0.25+Math.sin(t*1.4)*0.12;
    }

    // Auto-complete after all constellations shown
    const lastDelay=CONSTELLATIONS[CONSTELLATIONS.length-1].delay;
    if(!this._done && t>lastDelay+9){
      this._done=true;
      this._spawnFireworkBurst(12);  // big finale
      this.engine.audio.play('cash');
      setTimeout(()=>{
        this.engine.hud.showOverlay(`
          <div style="font-size:52px">🌟💛💜🌟</div>
          <div style="font-size:28px;font-weight:900;
            background:linear-gradient(135deg,#ffd700,#c890ff);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;text-align:center">
            Perfect Picnic!</div>
          <div style="font-size:15px;color:#ddd;text-align:center;max-width:340px;line-height:1.9;margin-top:4px">
            Avicula and Purpura lie under the stars,<br>
            bellies full, hearts full.<br>
            <span style="color:#ffd700">✨ A perfect night. ✨</span>
          </div>
        `,'Play Again 🔄',()=>this.engine.nextLevel('stargazing'));
      },1400);
    }
  }

  _spawnShootingStar() {
    const az=Math.random()*Math.PI*2, el=0.5+Math.random()*0.9;
    const r=SKY_R-5;
    const pos=new THREE.Vector3(r*Math.cos(el)*Math.sin(az),r*Math.sin(el),r*Math.cos(el)*Math.cos(az));
    const vel=new THREE.Vector3((Math.random()-0.5)*0.8,-0.5-Math.random()*0.5,(Math.random()-0.5)*0.8).normalize();
    const mesh=new THREE.Mesh(
      new THREE.CylinderGeometry(0.055,0.018,3.5,4),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:1}));
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vel);
    this.scene.add(mesh);
    this._shootStars.push({mesh,vel,t:0});
  }

  _updateHUD(shown) {
    const rows=CONSTELLATIONS.map((con,i)=>`
      <div style="opacity:${i<shown?1:0.28};color:${i<shown?'#ffd700':'#888'};font-size:12px;margin:3px 0">
        ${i<shown?'✨':'·'} ${con.name}
      </div>`).join('');
    this.engine.hud.setInfo(`
      <div style="font-weight:700;font-size:13px;color:#c8d8ff;margin-bottom:8px">🌟 Stargazing</div>
      ${rows}
      <div style="font-size:11px;opacity:0.38;margin-top:8px">Mouse = look around</div>`);
  }

  onInteract() {}
}