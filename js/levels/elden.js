import * as THREE from 'three';
import { Level, Anime, Build, FPController, Interactor } from '../engine.js';

export class EldenLevel extends Level {
  constructor(engine) {
    super(engine);
    this._bossActive = false;
    this._bossHealth = 5;
    this._playerHealth = 3;
    this._flashTimer = 0;
    this._died = false;
    this._jumpscareTriggered = false;
    this._attackCooldown = 0;
    this._lunging = false;
    this._lungeTimer = 0;
    this._lungeDir = new THREE.Vector3();
    this._screenShake = 0;
    this._heartbeatTimer = 0;
    this._playerAttackCooldown = 0;
    this._playerAttacking = false;
    this._playerAttackTimer = 0;
    this._bossStunned = false;
    this._bossStunTimer = 0;
    this._phase2 = false;
    this._teleportTimer = 0;
    this._ambientFlicker = 0;
    this._groundCrackLights = [];
    this._swipeTrails = [];
    this._bossRoarTimer = 3;
    this._torchLights = [];
    this._dangleItems = [];
    this._bannerMeshes = [];
    this._smokeParticles = [];
    this._lungeOrigin = new THREE.Vector3();
    this._attackPhase = 0; // 0=idle, 1=telegraph, 2=lunge
    this._attackScheduled = false;
    this._bloodSplats = [];
    this._runes = [];
  }

  init() {

    // ═══════════════════════════════════════════════════
    //  SKY — Stormveil approach: brooding sky, golden Erdtree cast
    // ═══════════════════════════════════════════════════
    this.scene.background = new THREE.Color(0x3a3445);
    this.scene.fog = new THREE.FogExp2(0x3a2e22, 0.011);

    // ═══════════════════════════════════════════════════
    //  LIGHTING — Erdtree golden hour through storm
    // ═══════════════════════════════════════════════════
    const ambient = new THREE.AmbientLight(0x2a2418, 1.0);
    this.scene.add(ambient);

    // main directional — warm Erdtree light from above-back
    const erdtreeLight = new THREE.DirectionalLight(0xffcc66, 2.2);
    erdtreeLight.position.set(22, 38, -28);
    erdtreeLight.castShadow = true;
    erdtreeLight.shadow.mapSize.setScalar(4096);
    erdtreeLight.shadow.camera.near = 0.5;
    erdtreeLight.shadow.camera.far = 100;
    erdtreeLight.shadow.camera.left = erdtreeLight.shadow.camera.bottom = -40;
    erdtreeLight.shadow.camera.right = erdtreeLight.shadow.camera.top = 40;
    erdtreeLight.shadow.bias = -0.0003;
    this.scene.add(erdtreeLight);
    this._moonLight = erdtreeLight;

    // storm fill — cool gray-blue from the side
    const stormFill = new THREE.DirectionalLight(0x4a5566, 0.7);
    stormFill.position.set(-18, 22, 8);
    this.scene.add(stormFill);

    // golden rim from the Erdtree direction
    const rimLight = new THREE.DirectionalLight(0xddaa55, 1.1);
    rimLight.position.set(20, 14, -35);
    this.scene.add(rimLight);

    // hemisphere — stormy sky over warm ground
    const hemi = new THREE.HemisphereLight(0x3a4555, 0x1a1208, 0.65);
    this.scene.add(hemi);

    // ═══════════════════════════════════════════════════
    //  DISTANT ENVIRONMENT — The Erdtree, Stormveil, mountains
    // ═══════════════════════════════════════════════════

    // ── THE ERDTREE — massive glowing golden tree, far back
    const erdtreeGroup = new THREE.Group();
    erdtreeGroup.position.set(8, 0, -75);

    // trunk
    const trunkMat = Anime.glow(0xffaa44, 0.7);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 6.5, 70, 10), trunkMat);
    trunk.position.y = 30;
    erdtreeGroup.add(trunk);

    // root flare at base
    for (let i = 0; i < 8; i++) {
      const ang = (i/8) * Math.PI * 2;
      const root = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 1.4, 8, 5),
        Anime.glow(0xddaa44, 0.5)
      );
      root.position.set(Math.cos(ang)*5, 3, Math.sin(ang)*5);
      root.rotation.z = Math.cos(ang) * 0.6;
      root.rotation.x = -Math.sin(ang) * 0.6;
      erdtreeGroup.add(root);
    }

    // canopy — layered glowing orbs forming the iconic shape
    const canopyMat = Anime.glow(0xffdd66, 2.2);
    const canopyMat2 = Anime.glow(0xffcc55, 1.8);
    const canopyLayers = [
      [ 0, 58, 0, 18, canopyMat ],
      [-5, 64, 2, 14, canopyMat ],
      [ 6, 66, -3, 13, canopyMat2],
      [-3, 72, 0, 11, canopyMat ],
      [ 4, 75, 2, 10, canopyMat2],
      [-1, 80, -1, 9, canopyMat ],
      [ 3, 84, 0, 7, canopyMat2],
      [ 0, 88, 0, 5, canopyMat ],
    ];
    canopyLayers.forEach(([x,y,z,r,mat]) => {
      const c = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
      c.position.set(x, y, z);
      erdtreeGroup.add(c);
    });

    // erdtree branches reaching outward
    for (let i = 0; i < 14; i++) {
      const ang = (i/14) * Math.PI * 2;
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 1.1, 20 + Math.random()*10, 5),
        Anime.glow(0xffbb55, 1.3)
      );
      const rad = 5 + Math.random()*4;
      branch.position.set(Math.cos(ang)*rad, 45 + Math.random()*15, Math.sin(ang)*rad);
      branch.rotation.z = Math.cos(ang) * 0.5;
      branch.rotation.x = -Math.sin(ang) * 0.5;
      erdtreeGroup.add(branch);
    }

    this.scene.add(erdtreeGroup);
    this._erdtree = erdtreeGroup;

    // erdtree halo light (sky illumination)
    Build.pointLight(this.scene, 8, 75, -75, 0xffcc66, 18, 100);
    Build.pointLight(this.scene, 8, 40, -75, 0xffaa44, 8, 60);

    // ── STORMVEIL CASTLE — distant tower silhouettes flanking the arena
    const castleTowers = [
      [-38, -50,  6, 36, 6],
      [-30, -55,  4.5, 28, 4.5],
      [-46, -42,  5, 30, 5],
      [-25, -58,  3.5, 22, 3.5],
      [-52, -35,  4, 26, 4],
      [ 38, -48,  5.5, 32, 5.5],
      [ 30, -55,  4, 25, 4],
      [ 46, -40,  5, 28, 5],
      [ 26, -60,  3.5, 20, 3.5],
      [ 52, -38,  4, 24, 4],
      // back wall castle bulk
      [-15, -65, 12, 22, 8],
      [ 22, -68, 14, 20, 10],
    ];
    castleTowers.forEach(([x, z, w, h, d]) => {
      Build.box(this.scene, x, h/2, z, w, h, d, 0x0d1018, { noOutline: true });
      // conical roof
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(w*0.85, h*0.35, 4),
        Anime.mat(0x080a10, { roughness: 0.95 })
      );
      roof.position.set(x, h + h*0.18, z);
      roof.rotation.y = Math.PI/4;
      this.scene.add(roof);
      // tower window glow (tiny golden light from windows)
      if (Math.random() > 0.4) {
        Build.pointLight(this.scene, x, h*0.6, z, 0xffaa33, 0.4, 5);
      }
    });

    // ── DISTANT MOUNTAINS / cliff silhouettes
    const mountainDefs = [
      [-58, -62, 32, 22, 10],
      [ 60, -58, 30, 18, 8],
      [-68, -48, 22, 14, 10],
      [ 70, -45, 24, 16, 9],
      [-72, -30, 18, 10, 8],
      [ 75, -28, 20, 11, 8],
    ];
    mountainDefs.forEach(([x, z, w, h, d]) => {
      Build.box(this.scene, x, h/2, z, w, h, d, 0x0a0d14, { noOutline: true });
    });

    // ── STORM CLOUDS overhead, drifting
    this._clouds = [];
    for (let i = 0; i < 18; i++) {
      const cloudMat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0x6a6055 : 0x3a4252,
        transparent: true,
        opacity: 0.32 + Math.random() * 0.25,
        depthWrite: false,
      });
      const w = 14 + Math.random() * 22;
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.45), cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 100,
        28 + Math.random() * 25,
        -25 - Math.random() * 50
      );
      cloud.rotation.x = -Math.PI/2 + 0.25;
      this.scene.add(cloud);
      this._clouds.push({ mesh: cloud, vx: (Math.random()-0.5) * 0.15, baseY: cloud.position.y });
    }

    // ── GROUND MIST around arena perimeter
    for (let i = 0; i < 28; i++) {
      const mistMat = new THREE.MeshBasicMaterial({
        color: 0x8a7a60,
        transparent: true,
        opacity: 0.1 + Math.random() * 0.08,
        depthWrite: false,
      });
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(9 + Math.random()*6, 2.5), mistMat);
      const ang = (i/28) * Math.PI * 2;
      mist.position.set(Math.cos(ang) * 17, 0.8 + Math.random()*1.8, Math.sin(ang) * 17);
      mist.rotation.y = ang;
      this.scene.add(mist);
    }

    // ═══════════════════════════════════════════════════
    //  FLOOR — massive ancient stone plaza (80x80)
    // ═══════════════════════════════════════════════════
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x130f1a,
      roughness: 0.97,
      metalness: 0.04,
      roughnessMap: Anime.roughnessTex(16, 512),
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 40, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // large stone tile grid (every 5 units)
    for (let x = -38; x <= 38; x += 5) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.07, 76),
        new THREE.MeshBasicMaterial({ color: 0x080510, transparent: true, opacity: 0.75 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.002, 0);
      this.scene.add(line);
    }
    for (let z = -38; z <= 38; z += 5) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(76, 0.07),
        new THREE.MeshBasicMaterial({ color: 0x080510, transparent: true, opacity: 0.75 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.002, z);
      this.scene.add(line);
    }

    // smaller inset tiles (every 2.5 units, subtler)
    for (let x = -38; x <= 38; x += 2.5) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.025, 76),
        new THREE.MeshBasicMaterial({ color: 0x0a0812, transparent: true, opacity: 0.35 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.0015, 0);
      this.scene.add(line);
    }

    // worn stone patches — darker irregular blotches
    const patchDefs = [
      [-4,3,3,2],[ 6,-2,4,2.5],[-8,5,2,3],[ 2,-7,5,2],
      [-12,0,3,4],[10,6,2.5,2],[-2,9,3,2],[7,-9,2,3],
      [0,0,6,6], // centre dark patch under boss zone
    ];
    patchDefs.forEach(([x,z,w,d]) => {
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshBasicMaterial({ color: 0x0b0810, transparent: true, opacity: 0.5+Math.random()*0.3, depthWrite: false })
      );
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(x, 0.001, z);
      this.scene.add(patch);
    });

    // ─── ELABORATE FLOOR CRACKS (network of branching fissures) ─────
    const crackMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.6 });
    const glowCrackMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.8 });

    const crackNetworks = [
      // main central fissure
      [[0,0],[2,1.5],[4,2.5],[5,4.5],[6,6],[4.5,8]],
      [[0,0],[-1.5,2],[-3,3.5],[-5,4],[-6.5,6]],
      [[0,0],[1,-2],[2,-4],[4,-5.5],[6,-6.5]],
      [[0,0],[-2,-1.5],[-4,-3],[-5.5,-5],[-4,-8]],
      // side cracks
      [[-6,3],[-8,2.5],[-10,3.5]],
      [[5,-3],[7,-2],[9,-3.5]],
      [[-3,8],[-5,9],[-4,11]],
      [[4,7],[6,8.5],[5,10]],
      // hairline cracks
      [[-1,5],[-2,6],[-1.5,7]],
      [[3,-2],[4,-3],[3.5,-4],[4.5,-5]],
      [[-7,-5],[-8,-4],[-9,-5.5]],
      [[8,4],[9,3],[10,4.5]],
    ];

    crackNetworks.forEach(pts => {
      pts.forEach(([x,z], i) => {
        if (i === 0) return;
        const px = pts[i-1][0], pz = pts[i-1][1];
        const len = Math.sqrt((x-px)**2 + (z-pz)**2);
        const angle = Math.atan2(z-pz, x-px);
        const isMain = len > 3;
        const w = isMain ? 0.055 : 0.028;
        const crack = new THREE.Mesh(new THREE.PlaneGeometry(len, w), isMain ? glowCrackMat : crackMat);
        crack.rotation.x = -Math.PI / 2;
        crack.rotation.z = -angle;
        crack.position.set((x+px)/2, 0.004, (z+pz)/2);
        this.scene.add(crack);

        // secondary hairline branches off main cracks
        if (isMain && Math.random() > 0.4) {
          const branchLen = 0.5 + Math.random() * 1.5;
          const branchAngle = angle + (Math.random()-0.5) * 1.2;
          const bx = (x+px)/2 + Math.cos(branchAngle) * branchLen/2;
          const bz = (z+pz)/2 + Math.sin(branchAngle) * branchLen/2;
          const branch = new THREE.Mesh(new THREE.PlaneGeometry(branchLen, 0.02), crackMat);
          branch.rotation.x = -Math.PI / 2;
          branch.rotation.z = -branchAngle;
          branch.position.set(bx, 0.004, bz);
          this.scene.add(branch);
        }
      });
    });

    // crack glow pools — where lava seeps up
    const crackPoolDefs = [
      [0,0, 0xff5500, 0.9, 5],
      [5,5, 0xff4400, 0.7, 4],
      [-5,4,0xff6600, 0.65, 3.5],
      [4,-5,0xff3300, 0.75, 4],
      [-3,-4,0xff5500, 0.55, 3],
      [2,9, 0xff4400, 0.5, 3],
      [-6,-6,0xff3300,0.6,3.5],
    ];
    crackPoolDefs.forEach(([x,z,col,i,r]) => {
      const cl = Build.pointLight(this.scene, x, 0.08, z, col, i, r);
      this._groundCrackLights.push(cl);
    });

    // lava glow discs in the cracks
    [[0,0,1.5],[ 5,4,0.8],[-4,5,0.7],[3,-5,0.9],[-5,-4,0.7]].forEach(([x,z,s]) => {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(s*0.4, 12),
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.35, depthWrite: false })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 0.003, z);
      this.scene.add(disc);
    });

    // ─── RUNE CIRCLE (large, intricate) ───────────────
    // outer ring
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const r = 9.0;
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 8),
        new THREE.MeshBasicMaterial({ color: 0xaa5500, transparent: true, opacity: 0.22, depthWrite: false })
      );
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(Math.cos(angle)*r, 0.005, Math.sin(angle)*r);
      this.scene.add(dot);
    }
    // ring line (approximated with segments)
    for (let i = 0; i < 64; i++) {
      const a1 = (i/64)*Math.PI*2;
      const a2 = ((i+1)/64)*Math.PI*2;
      const r = 9.0;
      const seg = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.03),
        new THREE.MeshBasicMaterial({ color: 0xcc6600, transparent: true, opacity: 0.18, depthWrite: false })
      );
      seg.rotation.x = -Math.PI / 2;
      seg.rotation.z = -a1 - Math.PI/2;
      seg.position.set(Math.cos(a1+0.049)*r, 0.005, Math.sin(a1+0.049)*r);
      this.scene.add(seg);
    }
    // mid ring
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const r = 6.5;
      const rune = new THREE.Mesh(
        new THREE.PlaneGeometry(0.45, 0.45),
        new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.25, depthWrite: false })
      );
      rune.rotation.x = -Math.PI / 2;
      rune.position.set(Math.cos(angle)*r, 0.005, Math.sin(angle)*r);
      this.scene.add(rune);
      // store for animation
      this._runes.push({ mesh: rune, angle, r, baseOp: 0.25 });
    }
    // inner ring
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const r = 3.5;
      const sym = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.28, depthWrite: false })
      );
      sym.rotation.x = -Math.PI / 2;
      sym.position.set(Math.cos(angle)*r, 0.005, Math.sin(angle)*r);
      this.scene.add(sym);
    }
    // radial spoke lines
    for (let i = 0; i < 8; i++) {
      const angle = (i/8)*Math.PI*2;
      const spoke = new THREE.Mesh(
        new THREE.PlaneGeometry(0.03, 9),
        new THREE.MeshBasicMaterial({ color: 0xcc6600, transparent: true, opacity: 0.15, depthWrite: false })
      );
      spoke.rotation.x = -Math.PI / 2;
      spoke.rotation.z = -angle;
      spoke.position.set(Math.cos(angle)*4.5, 0.005, Math.sin(angle)*4.5);
      this.scene.add(spoke);
    }

    // ═══════════════════════════════════════════════════
    //  WALLS — thick imposing fortress stone
    // ═══════════════════════════════════════════════════
    const wallMat = { matOpts: { roughness: 0.93, metalness: 0.06 } };

    // BACK WALL — with two arch bays and a central ritual window
    Build.box(this.scene, -9,  0, -18, 10, 12, 1.8, 0x14101c, wallMat);
    Build.box(this.scene,  9,  0, -18, 10, 12, 1.8, 0x14101c, wallMat);
    Build.box(this.scene,  0,  7, -18, 12, 5, 1.8, 0x14101c, wallMat); // above arches
    Build.box(this.scene,  0, 11.5,-18, 22, 1.5,1.8, 0x12101a, wallMat); // parapet
    // arch gap (invisible — just visual negative space)

    // wall detail — recessed panels on back wall
    [[-8,3,-17.1],[-8,6,-17.1],[8,3,-17.1],[8,6,-17.1]].forEach(([x,y,z]) => {
      Build.box(this.scene, x, y, z, 3.5, 2.5, 0.12, 0x100d17, { noOutline:true });
    });

    // LEFT WALL — with buttresses
    Build.box(this.scene, -18, 0, 0, 1.8, 12, 40, 0x12101a, wallMat);
    // buttresses left
    [-12,-6,0,6,12].forEach(bz => {
      Build.box(this.scene, -17, 0, bz, 2.5, 10, 2.5, 0x14111c, wallMat);
      Build.box(this.scene, -17, 10,bz, 2.8, 0.5, 2.8, 0x1a1625, wallMat);
    });

    // RIGHT WALL — with buttresses
    Build.box(this.scene, 18, 0, 0, 1.8, 12, 40, 0x12101a, wallMat);
    [-12,-6,0,6,12].forEach(bz => {
      Build.box(this.scene, 17, 0, bz, 2.5, 10, 2.5, 0x14111c, wallMat);
      Build.box(this.scene, 17, 10,bz, 2.8, 0.5, 2.8, 0x1a1625, wallMat);
    });

    // FRONT PARTIAL WALLS
    Build.box(this.scene, -11, 0, 18, 14, 8, 1.8, 0x14101c, wallMat);
    Build.box(this.scene,  11, 0, 18, 14, 8, 1.8, 0x14101c, wallMat);

    // wall crenellations — top of all walls
    for (let x = -16; x <= 16; x += 2.5) {
      if (Math.abs(x) < 4) continue;
      Build.box(this.scene, x, 12.5, -18, 1.0, 1.2, 2.0, 0x120f18, { noOutline:true });
    }
    for (let z = -16; z <= 16; z += 2.5) {
      Build.box(this.scene, -18, 12.5, z, 2.0, 1.2, 1.0, 0x120f18, { noOutline:true });
      Build.box(this.scene,  18, 12.5, z, 2.0, 1.2, 1.0, 0x120f18, { noOutline:true });
    }

    // collidable boundaries
    [
      new THREE.Box3(new THREE.Vector3(-20,-1,-20), new THREE.Vector3(-17,14,20)),
      new THREE.Box3(new THREE.Vector3( 17,-1,-20), new THREE.Vector3( 20,14,20)),
      new THREE.Box3(new THREE.Vector3(-20,-1,-20), new THREE.Vector3( 20,14,-17)),
      new THREE.Box3(new THREE.Vector3(-20,-1, 17), new THREE.Vector3( 20,14, 20)),
    ].forEach(b => this.collidables.push(b));

    // ═══════════════════════════════════════════════════
    //  CEILING / VAULT (partial — broken sections)
    // ═══════════════════════════════════════════════════
    // vaulted arch ribs crossing overhead (purely visual)
    for (let z = -14; z <= 10; z += 6) {
      Build.box(this.scene, -16, 11, z, 2.0, 0.5, 0.8, 0x10091a, { noOutline:true });
      Build.box(this.scene,  16, 11, z, 2.0, 0.5, 0.8, 0x10091a, { noOutline:true });
      // ceiling rib
      Build.box(this.scene, 0, 12, z, 36, 0.4, 0.8, 0x0e0c16, { noOutline:true });
    }
    // broken ceiling slabs falling
    [[-5,9,-10,40,0.3],[ 6,8,-6,35,0.25],[-8,8.5,-3,30,0.2]].forEach(([x,y,z,w,d]) => {
      const { mesh } = Build.box(this.scene, x, y, z, w, d, 3, 0x100d18, { noOutline:true });
      mesh.rotation.z = (Math.random()-0.5)*0.15;
      mesh.rotation.x = (Math.random()-0.5)*0.1;
    });

    // ═══════════════════════════════════════════════════
    //  PILLARS — 20 massive ornate columns
    // ═══════════════════════════════════════════════════
    const pillarDefs = [
      // [x, z, w, h, broken, sconce]
      [-4,  -6, 1.3, 9.0, false, true ],
      [ 4,  -6, 1.3, 9.0, false, true ],
      [-8,  -4, 1.2, 8.5, true,  true ],
      [ 8,  -4, 1.2, 7.5, true,  true ],
      [-10, -1, 1.1, 9.2, false, true ],
      [ 10, -1, 1.1, 9.2, false, true ],
      [-10,  5, 1.1, 8.8, false, true ],
      [ 10,  5, 1.1, 8.8, false, true ],
      [-8,   8, 1.0, 7.5, true,  true ],
      [ 8,   8, 1.0, 8.0, false, true ],
      [-4,  10, 1.0, 7.0, true,  false],
      [ 4,  10, 1.0, 7.2, false, false],
      [-14, -3, 0.9, 6.0, true,  true ],
      [ 14, -3, 0.9, 6.5, true,  true ],
      [-14,  4, 0.9, 7.0, false, true ],
      [ 14,  4, 0.9, 7.0, false, true ],
      // inner ring of shorter columns
      [-2,  -3, 0.8, 5.0, false, false],
      [ 2,  -3, 0.8, 5.0, false, false],
      [-2,   3, 0.8, 5.5, true,  false],
      [ 2,   3, 0.8, 5.5, false, false],
    ];

    pillarDefs.forEach(([x, z, w, h, broken, hasSconce]) => {
      // multi-tier base
      Build.box(this.scene, x, 0,    z, w+0.6, 0.3, w+0.6, 0x1c1528);
      Build.box(this.scene, x, 0.3,  z, w+0.4, 0.25, w+0.4, 0x201a2c);
      Build.box(this.scene, x, 0.55, z, w+0.2, 0.15, w+0.2, 0x231e30);

      // shaft with slight taper
      const { mesh } = Build.box(this.scene, x, 0.7, z, w, h*0.92, w, 0x191422);
      mesh.castShadow = true;
      this.collidables.push(new THREE.Box3().setFromObject(mesh));

      // decorative band mid-shaft
      Build.box(this.scene, x, 0.7+h*0.35, z, w+0.12, 0.18, w+0.12, 0x201828, { noOutline:true });
      Build.box(this.scene, x, 0.7+h*0.6,  z, w+0.08, 0.12, w+0.08, 0x1e1626, { noOutline:true });

      if (!broken) {
        // capital — two-tier
        Build.box(this.scene, x, 0.7+h*0.92,     z, w+0.35, 0.35, w+0.35, 0x221c2e);
        Build.box(this.scene, x, 0.7+h*0.92+0.35, z, w+0.55, 0.2,  w+0.55, 0x1e1828);
        // top slab
        Build.box(this.scene, x, 0.7+h*0.92+0.55, z, w+0.7,  0.25, w+0.7,  0x18131e);
        // carved corner stones on capital
        for (let ci = 0; ci < 4; ci++) {
          const cx = Math.cos(ci*Math.PI/2+Math.PI/4) * (w*0.55);
          const cz2 = Math.sin(ci*Math.PI/2+Math.PI/4) * (w*0.55);
          Build.box(this.scene, x+cx, 0.7+h*0.92+0.2, z+cz2, 0.22, 0.4, 0.22, 0x1a1524, { noOutline:true });
        }
      } else {
        // broken top — multi-shard ruin
        const shardCount = 3 + Math.floor(Math.random()*4);
        for (let s = 0; s < shardCount; s++) {
          const sh = 0.4 + Math.random()*1.2;
          const ox = (Math.random()-0.5)*w*1.2;
          const oz = (Math.random()-0.5)*w*1.2;
          const tilt = (Math.random()-0.5)*0.6;
          const { mesh: sm } = Build.box(this.scene, x+ox, 0.7+h*0.92+s*0.12, z+oz, w*0.55, sh, w*0.55, 0x130f1a, { noOutline:true });
          sm.rotation.z = tilt;
          sm.rotation.x = (Math.random()-0.5)*0.3;
        }
        // large rubble chunks at base
        for (let r = 0; r < 8; r++) {
          const rs = 0.15 + Math.random()*0.5;
          const rx = x + (Math.random()-0.5)*2.5;
          const rz2 = z + (Math.random()-0.5)*2.5;
          const { mesh: rm } = Build.box(this.scene, rx, 0, rz2, rs*1.5, rs*0.6, rs, 0x110d18, { noOutline:true });
          rm.rotation.y = Math.random()*Math.PI;
          rm.rotation.z = (Math.random()-0.5)*0.5;
        }
        // dust cloud base (flat dark circle)
        const dustCirc = new THREE.Mesh(
          new THREE.CircleGeometry(w*1.5, 12),
          new THREE.MeshBasicMaterial({ color: 0x0a0812, transparent: true, opacity: 0.5, depthWrite: false })
        );
        dustCirc.rotation.x = -Math.PI/2;
        dustCirc.position.set(x, 0.001, z);
        this.scene.add(dustCirc);
      }

      if (hasSconce) {
        // ornate sconce bracket
        Build.box(this.scene, x*0.8, Math.min(h*0.55, 4.5), z*0.8, 0.3, 0.7, 0.3, 0x1e1830, { noOutline:true });
        const torch = Build.pointLight(this.scene, x*0.78, Math.min(h*0.55+0.8, 5.5), z*0.78, 0xff6622, 0.85, 6.5);
        this._torchLights.push({ light: torch, base: 0.85, phase: Math.random()*Math.PI*2 });
        // flame visual
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(0.08, 0.25, 6),
          new THREE.MeshBasicMaterial({ color: 0xff8822, transparent: true, opacity: 0.9 })
        );
        flame.position.set(x*0.78, Math.min(h*0.55+0.85, 5.8), z*0.78);
        this.scene.add(flame);
        this._torchLights[this._torchLights.length-1].flame = flame;
      }
    });

    // ═══════════════════════════════════════════════════
    //  HANGING CHAINS & IRON CAGES
    // ═══════════════════════════════════════════════════
    const chainMat = Anime.mat(0x1a1520, { roughness: 0.9, metalness: 0.3 });

    // hanging chains from ceiling
    const chainDefs = [
      [-6,-12,7],[ 6,-12,7],[-11,-8,5],[ 11,-8,5],
      [-3,-14,9],[ 3,-14,9],[-8,-15,8],[ 8,-15,8],
      [0,-13,11],[-5,-10,6],[ 5,-10,6],
    ];
    chainDefs.forEach(([x,z,h]) => {
      const segs = 4 + Math.floor(Math.random()*4);
      for (let s = 0; s < segs; s++) {
        const link = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.07), chainMat);
        link.position.set(x + (Math.random()-0.5)*0.06, h - s*0.28, z + (Math.random()-0.5)*0.06);
        link.rotation.y = (s % 2) * Math.PI/2;
        this.scene.add(link);
      }
      // iron weight / hook at end
      const hook = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18), chainMat);
      hook.position.set(x, h - segs*0.28 - 0.2, z);
      this.scene.add(hook);
      this._dangleItems.push({ mesh: hook, x, y: h - segs*0.28 - 0.2, z, phase: Math.random()*Math.PI*2 });
    });

    // iron cage (near back-left corner)
    const cageParts = [
      // floor
      [-11,0.05,-8, 2.5,0.08,2.5],
      // top
      [-11,3.0,-8, 2.5,0.08,2.5],
      // vertical bars
      ...[-1.1,-0.6,0,0.6,1.1].flatMap(ox =>
        [-1.1,0,1.1].map(oz2 => [-11+ox, 1.5, -8+oz2, 0.07, 3, 0.07])
      ),
    ];
    cageParts.forEach(([x,y,z,w,h2,d]) => {
      Build.box(this.scene, x, y, z, w, h2, d, 0x151020, { noOutline:true });
    });
    // skull inside cage
    Build.box(this.scene, -11, 0.5, -8, 0.4, 0.38, 0.38, 0x13101a);
    Build.box(this.scene, -11, 0.76,-8, 0.28, 0.25, 0.28, 0x161220);

    // second cage (right side)
    cageParts.forEach(([x,y,z,w,h2,d]) => {
      Build.box(this.scene, x+22, y, z, w, h2, d, 0x151020, { noOutline:true });
    });
    // body slumped in right cage
    Build.box(this.scene, 11, 0.4, -8, 0.9, 1.0, 0.5, 0x1a0a05);
    Build.box(this.scene, 11, 1.3, -8, 0.45, 0.45, 0.42, 0x13101a);

    // ═══════════════════════════════════════════════════
    //  TAPESTRIES / BANNERS (hanging from walls)
    // ═══════════════════════════════════════════════════
    const bannerData = [
      // [x, y, z, rotY, w, h, color, symbol]
      [-16.5, 7, -8,   Math.PI/2, 3, 5, 0x2a0a00],
      [-16.5, 7,  2,   Math.PI/2, 3, 5, 0x1a0015],
      [ 16.5, 7, -8,  -Math.PI/2, 3, 5, 0x2a0a00],
      [ 16.5, 7,  2,  -Math.PI/2, 3, 5, 0x1a0015],
      [-0.5,  8, -17.5, 0,        5, 6, 0x200010],
      [ 4.5,  8, -17.5, 0,        3, 5, 0x1a0a00],
      [-4.5,  8, -17.5, 0,        3, 5, 0x1a0a00],
    ];
    bannerData.forEach(([x, y, z, ry, w, h, col]) => {
      const bannerMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, metalness: 0.0 });
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(w, h), bannerMat);
      banner.position.set(x, y, z);
      banner.rotation.y = ry;
      banner.castShadow = false;
      this.scene.add(banner);
      this._bannerMeshes.push({ mesh: banner, baseY: y, phase: Math.random()*Math.PI*2 });

      // golden stitching border on banner
      const borderMat = new THREE.MeshBasicMaterial({ color: 0x664400, transparent: true, opacity: 0.6 });
      const topBar = new THREE.Mesh(new THREE.PlaneGeometry(w+0.05, 0.1), borderMat);
      topBar.position.set(x, y+h/2, z+0.01*(ry===0?1:0));
      topBar.rotation.y = ry;
      this.scene.add(topBar);

      // emblem cross on banner
      const emblemMat = new THREE.MeshBasicMaterial({ color: 0xaa6600, transparent: true, opacity: 0.4 });
      const embH = new THREE.Mesh(new THREE.PlaneGeometry(w*0.5, 0.12), emblemMat);
      embH.position.set(x, y+0.2, z + (ry===0 ? 0.02 : 0));
      embH.rotation.y = ry;
      this.scene.add(embH);
      const embV = new THREE.Mesh(new THREE.PlaneGeometry(0.12, h*0.5), emblemMat);
      embV.position.set(x, y+0.2, z + (ry===0 ? 0.02 : 0));
      embV.rotation.y = ry;
      this.scene.add(embV);
    });

    // ═══════════════════════════════════════════════════
    //  ARCHWAY — grand entrance gate (more ornate)
    // ═══════════════════════════════════════════════════
    // main arch pillars
    Build.box(this.scene, -2.0, 0, -17.2, 1.2, 8.0, 1.5, 0x1c1428);
    Build.box(this.scene,  2.0, 0, -17.2, 1.2, 8.0, 1.5, 0x1c1428);
    // pillar bases
    Build.box(this.scene, -2.0, 0, -17.2, 1.6, 0.5, 1.9, 0x221a30);
    Build.box(this.scene,  2.0, 0, -17.2, 1.6, 0.5, 1.9, 0x221a30);
    // arch lintel
    Build.box(this.scene,  0, 8.5, -17.2, 6.0, 1.0, 1.5, 0x1c1428);
    // arch keystone
    Build.box(this.scene,  0, 8.2, -17.2, 1.2, 0.8, 1.6, 0x281e38);
    // arch detail blocks
    Build.box(this.scene, -1.3, 7.5,-17.2, 0.8, 0.8, 1.4, 0x201630);
    Build.box(this.scene,  1.3, 7.5,-17.2, 0.8, 0.8, 1.4, 0x201630);
    // outer decorative frame
    Build.box(this.scene,  0, 9.5, -17.2, 8.0, 0.5, 1.6, 0x181020);
    // flanking statues (rough silhouette)
    [-3.5, 3.5].forEach(ox => {
      Build.box(this.scene, ox, 0,   -17.2, 0.7, 0.8, 0.7, 0x161020); // base
      Build.box(this.scene, ox, 0.8, -17.2, 0.55, 2.8, 0.5, 0x161020); // body
      Build.box(this.scene, ox, 3.8, -17.2, 0.45, 0.6, 0.42, 0x161020); // head
      // raised arm
      Build.box(this.scene, ox*1.05, 2.0, -17.2, 0.25, 1.5, 0.25, 0x161020);
      Build.box(this.scene, ox*1.2,  2.8, -17.2, 0.2,  0.25, 0.8, 0x161020); // blade
    });
    // arch lights
    Build.pointLight(this.scene,  0,   6.5, -16.8, 0x3311aa, 2.0, 8);
    Build.pointLight(this.scene,  0,   3.0, -17.0, 0x220088, 0.8, 4);
    Build.pointLight(this.scene, -2.8, 2.0, -16.8, 0x4422cc, 0.6, 3);
    Build.pointLight(this.scene,  2.8, 2.0, -16.8, 0x4422cc, 0.6, 3);

    // ═══════════════════════════════════════════════════
    //  FOG DOOR (more elaborate)
    // ═══════════════════════════════════════════════════
    const fogGeo = new THREE.PlaneGeometry(3.5, 7.5);
    const fogMat = new THREE.MeshBasicMaterial({
      color: 0x6600ee,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this._fogDoor = new THREE.Mesh(fogGeo, fogMat);
    this._fogDoor.position.set(0, 3.75, -17.2);
    this.scene.add(this._fogDoor);

    // fog door second layer (finer shimmer)
    const fogGeo2 = new THREE.PlaneGeometry(3.3, 7.3);
    const fogMat2 = new THREE.MeshBasicMaterial({
      color: 0xaa44ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this._fogDoor2 = new THREE.Mesh(fogGeo2, fogMat2);
    this._fogDoor2.position.set(0, 3.75, -17.18);
    this.scene.add(this._fogDoor2);

    // fog door bead curtain effect — vertical lines
    for (let bx = -1.5; bx <= 1.5; bx += 0.25) {
      const bead = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06, 7.3),
        new THREE.MeshBasicMaterial({ color: 0x9944ff, transparent: true, opacity: 0.25+Math.random()*0.2, depthWrite: false, side: THREE.DoubleSide })
      );
      bead.position.set(bx, 3.75, -17.19);
      this.scene.add(bead);
      this._bannerMeshes.push({ mesh: bead, baseY: 3.75, phase: Math.random()*Math.PI*2, isFog: true });
    }

    this.fx.registerParticles(Build.particles(this.scene, 60, 2.5, 0xaa66ff, 0.06));
    Build.label(this.scene, '[E] Enter the fog', 0, 8.5, -17.0, '#cc99ff');
    Build.pointLight(this.scene, 0, 4, -17.0, 0x7733ff, 4.0, 10);
    this._fogDoor.userData.onInteract = () => this._enterFog();
    this.interactables.push(this._fogDoor);

    // ═══════════════════════════════════════════════════
    //  GRACE SITE — elaborate pedestal with orbiting orbs
    // ═══════════════════════════════════════════════════
    // multi-tier pedestal
    Build.box(this.scene, 0, 0,    0, 1.6, 0.2,  1.6, 0x201830);
    Build.box(this.scene, 0, 0.2,  0, 1.3, 0.18, 1.3, 0x241e34);
    Build.box(this.scene, 0, 0.38, 0, 1.0, 0.3,  1.0, 0x2a2038);
    Build.box(this.scene, 0, 0.68, 0, 0.7, 0.12, 0.7, 0x30263e);
    // shaft
    Build.box(this.scene, 0, 0.8,  0, 0.22,0.45, 0.22, 0x281e38);
    // cup
    Build.box(this.scene, 0, 1.25, 0, 0.55,0.12, 0.55, 0x332244);

    this._graceLight = Build.pointLight(this.scene, 0, 1.5, 0, 0xffcc44, 5.0, 20);

    const graceMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      Anime.glow(0xffee88, 4.0)
    );
    graceMesh.position.set(0, 1.65, 0);
    this.scene.add(graceMesh);
    Anime.outline(graceMesh, 0.08, 0x443300);
    this.fx.registerItem(graceMesh);
    this._graceMesh = graceMesh;

    // grace rays — more of them, layered
    this._graceRays = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const len = 1.5 + (i%3)*0.6;
      const ray = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04, len),
        new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide })
      );
      ray.position.set(Math.cos(angle)*0.2, 1.65+len/2, Math.sin(angle)*0.2);
      ray.rotation.y = angle;
      ray.rotation.x = 0.12;
      this.scene.add(ray);
      this._graceRays.push({ mesh: ray, angle, phase: (i/12)*Math.PI*2 });
    }

    // orbiting golden orbs around grace
    this._graceOrbs = [];
    for (let i = 0; i < 5; i++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 10, 10),
        Anime.glow(0xffcc33, 2.5)
      );
      this.scene.add(orb);
      this._graceOrbs.push({ mesh: orb, angle: (i/5)*Math.PI*2, r: 0.5 + (i%2)*0.2, vy: (i%3)*0.4 });
    }

    graceMesh.userData.onInteract = () => this._tryWin();
    this.interactables.push(graceMesh);
    Build.label(this.scene, 'Site of Grace', 0, 2.8, 0, '#ffdd88');

    // ═══════════════════════════════════════════════════
    //  ALTAR — back of arena (elaborate ritual space)
    // ═══════════════════════════════════════════════════
    // main altar block
    Build.box(this.scene, -4.5, 0, -14, 2.5, 1.4, 2.0, 0x1c1530);
    Build.box(this.scene,  4.5, 0, -14, 2.5, 1.4, 2.0, 0x1c1530);
    Build.box(this.scene, 0, 1.4,  -14, 5.5, 0.18, 1.8, 0x26203a);
    Build.box(this.scene, 0, 1.58, -14, 5.0, 0.06, 1.6, 0x2e2844);
    // altar steps
    Build.box(this.scene, 0, 0,   -14.8, 7.0, 0.3,  0.6, 0x181230);
    Build.box(this.scene, 0, 0.3, -14.6, 6.5, 0.3,  0.5, 0x1a1432);
    // flanking pedestals
    [-2.5, 2.5].forEach(ox => {
      Build.box(this.scene, ox, 1.58, -14, 0.7, 0.3, 0.7, 0x28204a);
      Build.box(this.scene, ox, 1.88, -14, 0.5, 0.1, 0.5, 0x302850);
    });
    // candles (lots)
    const candleDefs = [-2.2,-1.4,-0.5,0.5,1.4,2.2];
    candleDefs.forEach((ox, i) => {
      const ch = 0.3 + (i%3)*0.15;
      Build.box(this.scene, ox, 1.64, -14, 0.12, ch, 0.12, 0xeeddcc, { noOutline:true });
      Build.pointLight(this.scene, ox, 1.64+ch+0.3, -13.8, 0xff8833, 0.6+Math.random()*0.4, 2.5);
      // wax drip
      Build.box(this.scene, ox, 1.62, -14, 0.18, 0.04, 0.18, 0xddd0bb, { noOutline:true });
    });
    // large ritual bowl / brazier center
    Build.box(this.scene, 0, 1.64, -14, 0.55, 0.25, 0.55, 0x1a1535);
    Build.box(this.scene, 0, 1.89, -14, 0.65, 0.06, 0.65, 0x221c3a);
    this._brazierLight = Build.pointLight(this.scene, 0, 2.3, -13.8, 0xff4400, 3.0, 8);
    this._torchLights.push({ light: this._brazierLight, base: 3.0, phase: 0, isBrazier: true });
    // books / offerings on altar
    [[-1.8,0],[-1.1,0],[1.1,0],[1.8,0]].forEach(([ox,oz]) => {
      Build.box(this.scene, ox, 1.64, -14+oz, 0.35, 0.18, 0.45, 0x1a0800, { noOutline:true });
    });

    // back altar triptych panels — on the back WALL (z=-17.8, behind altar, not blocking the fog door)
    Build.box(this.scene, 0,  4,  -17.8, 4.0, 4.0, 0.12, 0x1a0a20, { noOutline:true });
    Build.box(this.scene,-3.8, 3.5,-17.8, 2.2, 3.0, 0.12, 0x180818, { noOutline:true });
    Build.box(this.scene, 3.8, 3.5,-17.8, 2.2, 3.0, 0.12, 0x180818, { noOutline:true });
    // painted rune on centre panel
    const panelRune = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 2.0),
      new THREE.MeshBasicMaterial({ color: 0xcc4400, transparent: true, opacity: 0.3, depthWrite: false })
    );
    panelRune.position.set(0, 4, -17.75);
    this.scene.add(panelRune);
    Build.pointLight(this.scene, 0, 5, -17.4, 0x880022, 1.5, 6);

    // ═══════════════════════════════════════════════════
    //  SCATTERED PROPS (much more)
    // ═══════════════════════════════════════════════════

    // fallen pillar sections
    [
      [-8,  0,  3, 0.3, 0.0, 0.9, 4.0, 0x1a1424],
      [ 7,  0, -4, 0.0, 0.9, 0.9, 5.0, 0x1c1626],
      [-3,  0,  7, 0.0, 0.5, 0.8, 3.5, 0x191222],
      [ 5,  0,  9, 0.8, 0.0, 0.7, 4.5, 0x1a1525],
      [-11, 0, -4, 0.2, 0.0, 0.8, 3.0, 0x181220],
      [ 12, 0,  7, 0.0, 0.3, 0.75,3.8, 0x191323],
    ].forEach(([x,y,z,ry,rz,w,l,col]) => {
      const { mesh } = Build.box(this.scene, x, y+w/2, z, w, w, l, col);
      mesh.rotation.y = ry; mesh.rotation.z = rz;
      mesh.castShadow = true;
      this.collidables.push(new THREE.Box3().setFromObject(mesh));
      // rubble at ends
      for (let r = 0; r < 5; r++) {
        const rs = 0.1+Math.random()*0.35;
        Build.box(this.scene, x+(Math.random()-0.5)*l, 0, z+(Math.random()-0.5)*l, rs, rs*0.5, rs, 0x110d18, { noOutline:true });
      }
    });

    // skull piles (everywhere)
    const skullDefs = [
      [-4,0,4],[ 4,0,-6],[ 2,0,9],[-6,0,-7],[ 7,0,3],
      [-3,0,-10],[9,0,-8],[-11,0,4],[ 3,0,-12],[-9,0,9],
      [7,0,11],[-6,0,12],[11,0,6],[-12,0,-8],[0,0,14],
      [-4,0,-4],[5,0,5],[-7,0,1],[4,0,-2],[8,0,-12],
      [-13,0,8],[12,0,-5],[-2,0,13],[3,0,11],[-9,0,-12],
    ];
    skullDefs.forEach(([x,y,z]) => {
      const count = 1+Math.floor(Math.random()*4);
      for (let r = 0; r < count; r++) {
        const ox = (Math.random()-0.5)*1.5;
        const oz = (Math.random()-0.5)*1.5;
        const s = 0.22+Math.random()*0.15;
        Build.box(this.scene, x+ox, y+s*0.4, z+oz, s*1.2, s, s*1.1, 0x161220);
        Build.box(this.scene, x+ox, y+s*0.9, z+oz, s*0.8, s*0.7, s*0.85, 0x181426);
      }
    });

    // large crumbled stone blocks (scattered)
    [
      [-9,0,-11, 2.5,1.5,1.8],[ 10,0,-10, 1.8,2.0,2.2],[-12,0,8, 2.2,1.3,2.0],
      [ 9,0,10, 2.0,1.6,1.5],[-7,0,-13, 3.0,1.0,2.5],[ 5,0,12, 2.5,2.0,1.8],
      [-14,0,-10,1.5,2.5,1.5],[13,0,-11, 1.8,1.8,2.0],
    ].forEach(([x,y,z,w,h2,d]) => {
      const { mesh } = Build.box(this.scene, x, y+h2/2, z, w, h2, d, 0x14101c);
      mesh.rotation.y = Math.random()*0.4-0.2;
      this.collidables.push(new THREE.Box3().setFromObject(mesh));
      // chips
      for (let c = 0; c < 5; c++) {
        const cs = 0.1+Math.random()*0.3;
        Build.box(this.scene, x+(Math.random()-0.5)*w*1.5, 0, z+(Math.random()-0.5)*d*1.5, cs, cs*0.5, cs, 0x110d18, { noOutline:true });
      }
    });

    // wall sconces (both walls, full length)
    [
      [-17,3.5,-14],[-17,3.5,-8],[-17,3.5,-2],[-17,3.5,4],[-17,3.5,10],[-17,3.5,16],
      [ 17,3.5,-14],[ 17,3.5,-8],[ 17,3.5,-2],[ 17,3.5, 4],[ 17,3.5,10],[ 17,3.5,16],
    ].forEach(([x,y,z]) => {
      Build.box(this.scene, x*0.96, y, z, 0.3, 0.8, 0.3, 0x1e1830, { noOutline:true });
      const tl = Build.pointLight(this.scene, x*0.93, y+0.7, z, 0xff5500, 1.3, 7.5);
      this._torchLights.push({ light: tl, base: 1.3, phase: Math.random()*Math.PI*2 });
      // flame
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.22, 6),
        new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.85 })
      );
      flame.position.set(x*0.93, y+0.75, z);
      this.scene.add(flame);
      this._torchLights[this._torchLights.length-1].flame = flame;
    });

    // hanging braziers (overhead)
    [[0,-12,6],[5,-14,-5],[-5,-14,-5],[0,-13,-2]].forEach(([x,z,h]) => {
      // chain up to ceiling
      for (let s = 0; s < 8; s++) {
        const link = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.06), chainMat);
        link.position.set(x, h+s*0.2, z);
        this.scene.add(link);
      }
      // bowl
      Build.box(this.scene, x, h-0.2, z, 0.7, 0.35, 0.7, 0x1a1530);
      Build.box(this.scene, x, h+0.15,z, 0.8, 0.08, 0.8, 0x201840);
      const bl = Build.pointLight(this.scene, x, h-0.15, z, 0xff5500, 1.8, 8);
      this._torchLights.push({ light: bl, base: 1.8, phase: Math.random()*Math.PI*2 });
    });

    // weapons stuck in ground / walls
    [
      [-5,0,5, 0.3],[ 3,0,-5, -0.2],[7,0,2, 0.5],[-8,0,-8, -0.4],
    ].forEach(([x,z, wz, tilt]) => {
      // blade
      Build.box(this.scene, x, 0.85, wz, 0.06, 1.7, 0.04, 0x888aaa, { noOutline:true });
      // guard
      Build.box(this.scene, x, 0.3, wz, 0.35, 0.05, 0.05, 0x665500, { noOutline:true });
    });

    // ═══════════════════════════════════════════════════
    //  BLOOD POOLS & STAINS
    // ═══════════════════════════════════════════════════
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x440000, transparent: true, opacity: 0.55, depthWrite: false });
    [
      [-6,4,2.0,1.2],[ 5,-3,1.5,0.8],[2,8,1.8,1.0],[-4,-6,1.2,0.9],
      [ 9,2,1.4,0.7],[-3,3,0.9,0.6],[7,-7,1.6,1.1],[-9,8,1.0,0.8],
      [ 0,-2,2.2,1.5],[11,-3,0.8,0.6],
    ].forEach(([x,z,rx,rz]) => {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(rx*2, rz*2), bloodMat);
      pool.rotation.x = -Math.PI/2;
      pool.position.set(x, 0.002, z);
      this.scene.add(pool);
    });
// ═══════════════════════════════════════════════════
    //  PARTICLES & ATMOSPHERE — Erdtree leaves and storm ash
    // ═══════════════════════════════════════════════════
    this.fx.registerParticles(Build.particles(this.scene, 200, 35, 0xffcc66, 0.07));  // golden erdtree leaves
    this.fx.registerParticles(Build.particles(this.scene, 120, 30, 0xddaa44, 0.05));  // smaller gold motes
    this.fx.registerParticles(Build.particles(this.scene, 150, 28, 0x8a7a60, 0.04));  // dust/ash
    this.fx.registerParticles(Build.particles(this.scene,  60, 20, 0xffee88, 0.06));  // bright gold sparks
    Build.stars(this.scene, 800);

    // ═══════════════════════════════════════════════════
    //  MARGIT — THE FELL OMEN (proper omen anatomy)
    // ═══════════════════════════════════════════════════
    const enemyGroup = new THREE.Group();
    this.scene.add(enemyGroup);

    const darkMat    = Anime.mat(0x0c0a10, { roughness: 0.9,  metalness: 0.15 });
    const robeMat    = Anime.mat(0x1a0a00, { roughness: 0.85, metalness: 0.05 });
    const cloakMat   = Anime.mat(0x080608, { roughness: 0.95, metalness: 0.0  });
    const bandageMat = Anime.mat(0xc8b89a, { roughness: 0.95, metalness: 0.0  });
    const goldMat    = Anime.metal(0xbb8800, { roughness: 0.3, metalness: 0.9  });
    const boneWhite  = Anime.mat(0xd0c8b8, { roughness: 0.9,  metalness: 0.0  });
    const hornMat    = Anime.mat(0x2a1d14, { roughness: 0.6,  metalness: 0.1  });
    const darkRobe2  = Anime.mat(0x120800, { roughness: 0.88, metalness: 0.02 });
    const fleshMat   = Anime.mat(0x6a5848, { roughness: 0.9,  metalness: 0.0  });

    // ── LOWER BODY (hips + skirt)
    const hips = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.75), robeMat);
    hips.position.set(0, 1.05, 0);
    enemyGroup.add(hips);

    [-0.55, 0, 0.55].forEach((ox, i) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.25, 0.22), darkRobe2);
      panel.position.set(ox, 0.4, 0.1 + i*0.06);
      panel.rotation.x = -0.08 + i*0.04;
      enemyGroup.add(panel);
    });
    const backDrape = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.18), darkRobe2);
    backDrape.position.set(0, 0.35, -0.38);
    enemyGroup.add(backDrape);

    // ── LEGS
    [-0.5, 0.5].forEach((lx) => {
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.55), robeMat);
      thigh.position.set(lx, 0.2, 0.05);
      thigh.rotation.x = 0.08;
      enemyGroup.add(thigh);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.95, 0.38), darkMat);
      shin.position.set(lx, -0.6, 0.12);
      shin.rotation.x = -0.05;
      enemyGroup.add(shin);
      const ankle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.32), bandageMat);
      ankle.position.set(lx, -1.1, 0.15);
      enemyGroup.add(ankle);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.65), darkMat);
      foot.position.set(lx + lx*0.08, -1.25, 0.22);
      enemyGroup.add(foot);
      for (let f = 0; f < 3; f++) {
        const tclaw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 5), Anime.mat(0x0a0808));
        tclaw.position.set(lx+(f-1)*0.12, -1.38, 0.5);
        tclaw.rotation.x = -0.5;
        enemyGroup.add(tclaw);
      }
    });

    // ── TORSO
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.9, 0.92), robeMat);
    torso.position.set(0, 2.1, 0);
    torso.rotation.x = 0.14;
    enemyGroup.add(torso);
    Anime.outline(torso, 0.04, 0x000000);

    const chestArmour = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.55), darkMat);
    chestArmour.position.set(0, 2.2, 0.22);
    chestArmour.rotation.x = 0.14;
    enemyGroup.add(chestArmour);
    const chestH = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.6), bandageMat);
    chestH.position.set(0, 2.5, 0.18);
    enemyGroup.add(chestH);
    const chestV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.6), bandageMat);
    chestV.position.set(0, 2.0, 0.18);
    enemyGroup.add(chestV);
    // gold pectoral cross
    const medalH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.06), goldMat);
    medalH.position.set(0, 2.55, 0.5);
    enemyGroup.add(medalH);
    const medalV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.06), goldMat);
    medalV.position.set(0, 2.45, 0.5);
    enemyGroup.add(medalV);

    // ── BLACK TATTERED CLOAK behind body
    const cloakBack = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.2, 0.15), cloakMat);
    cloakBack.position.set(0, 1.8, -0.5);
    cloakBack.rotation.x = -0.05;
    enemyGroup.add(cloakBack);
    // tattered cloak strips
    [-0.7, -0.3, 0.3, 0.7].forEach(ox => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6 + Math.random()*0.4, 0.1), cloakMat);
      strip.position.set(ox, 0.5, -0.55);
      strip.rotation.z = ox * 0.1;
      enemyGroup.add(strip);
    });
    // cloak shoulder draped pieces
    [-1, 1].forEach(side => {
      const drape = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.12), cloakMat);
      drape.position.set(side * 1.05, 2.0, -0.25);
      drape.rotation.z = side * 0.08;
      enemyGroup.add(drape);
    });

    // ── NECK
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.35), fleshMat);
    neck.position.set(0, 3.1, 0.08);
    enemyGroup.add(neck);

    // ── HEAD
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.08, 0.82), fleshMat);
    head.position.set(0, 3.45, 0.12);
    enemyGroup.add(head);
    Anime.outline(head, 0.045, 0x000000);
    this._margitHead = head;

    [-0.38, 0.38].forEach(ox => {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.18), fleshMat);
      cheek.position.set(ox, 3.32, 0.42);
      enemyGroup.add(cheek);
    });
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.22), darkMat);
    brow.position.set(0, 3.7, 0.4);
    brow.rotation.x = -0.18;
    enemyGroup.add(brow);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.24), fleshMat);
    nose.position.set(0, 3.3, 0.5);
    enemyGroup.add(nose);

    // ── HORNS — the defining omen feature
    // huge left horn — curving back and up (the iconic one)
    const bigHornL = new THREE.Group();
    const blS1 = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.55, 6), hornMat);
    blS1.position.y = 0.27;
    bigHornL.add(blS1);
    const blS2 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 6), hornMat);
    blS2.position.set(-0.1, 0.75, -0.1);
    blS2.rotation.z = 0.4;
    bigHornL.add(blS2);
    const blS3 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 6), hornMat);
    blS3.position.set(-0.28, 1.15, -0.22);
    blS3.rotation.z = 0.85;
    bigHornL.add(blS3);
    const blS4 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 5), hornMat);
    blS4.position.set(-0.5, 1.42, -0.3);
    blS4.rotation.z = 1.3;
    bigHornL.add(blS4);
    bigHornL.position.set(-0.32, 3.92, 0.05);
    bigHornL.rotation.z = -0.15;
    enemyGroup.add(bigHornL);

    // big right horn — curves up and slightly forward
    const bigHornR = new THREE.Group();
    const brS1 = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 6), hornMat);
    brS1.position.y = 0.25;
    bigHornR.add(brS1);
    const brS2 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), hornMat);
    brS2.position.set(0.07, 0.7, 0.1);
    brS2.rotation.z = -0.3;
    bigHornR.add(brS2);
    const brS3 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 6), hornMat);
    brS3.position.set(0.2, 1.05, 0.22);
    brS3.rotation.z = -0.7;
    bigHornR.add(brS3);
    bigHornR.position.set(0.32, 3.92, 0.05);
    bigHornR.rotation.z = 0.12;
    enemyGroup.add(bigHornR);

    // smaller horns / bony protrusions
    const smallHorns = [
      [-0.12, 4.02, 0.22, 0.05, 0.3,  0.05, 0.1 ],
      [ 0.12, 4.02, 0.22, 0.05, 0.3, -0.05, 0.1 ],
      [-0.5,  3.55, 0.2,  0.05, 0.28, 0.7,  0.0 ],
      [ 0.5,  3.55, 0.2,  0.05, 0.28,-0.7,  0.0 ],
      [-0.55, 3.3,  0.25, 0.04, 0.22, 0.85, 0.0 ],
      [ 0.55, 3.3,  0.25, 0.04, 0.22,-0.85, 0.0 ],
      [ 0.0,  4.05, 0.3,  0.05, 0.25, 0.0,  0.25],
      [-0.22, 3.62, 0.5,  0.04, 0.2,  0.3, -0.4 ],
      [ 0.22, 3.62, 0.5,  0.04, 0.2, -0.3, -0.4 ],
    ];
    smallHorns.forEach(([x, y, z, r, h, rz, rx]) => {
      const sh = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), hornMat);
      sh.position.set(x, y, z);
      sh.rotation.z = rz;
      sh.rotation.x = rx;
      enemyGroup.add(sh);
    });
    // chin/jaw bony spurs
    const chinBone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), hornMat);
    chinBone.position.set(0, 2.88, 0.46);
    chinBone.rotation.x = -0.4;
    enemyGroup.add(chinBone);
    [-0.18, 0.18].forEach(ox => {
      const jspur = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 5), hornMat);
      jspur.position.set(ox, 3.0, 0.42);
      jspur.rotation.x = -0.2;
      jspur.rotation.z = ox*0.5;
      enemyGroup.add(jspur);
    });

    // ── BEARD (long, layered)
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.22), bandageMat);
    beard.position.set(0, 2.72, 0.44);
    beard.rotation.x = 0.18;
    enemyGroup.add(beard);
    const beardSide = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.16), boneWhite);
    beardSide.position.set(0, 2.82, 0.4);
    enemyGroup.add(beardSide);
    const beardTail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.15), boneWhite);
    beardTail.position.set(0, 2.22, 0.42);
    beardTail.rotation.x = 0.3;
    enemyGroup.add(beardTail);
    // beard braid binding (gold ring)
    const beardRing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.18), goldMat);
    beardRing.position.set(0, 2.45, 0.42);
    enemyGroup.add(beardRing);

    // ── MUSTACHE
    const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.2), bandageMat);
    mustache.position.set(0, 3.15, 0.46);
    enemyGroup.add(mustache);
    [-0.32, 0.32].forEach(ox => {
      const drop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.14), bandageMat);
      drop.position.set(ox, 3.02, 0.44);
      drop.rotation.z = ox < 0 ? 0.3 : -0.3;
      enemyGroup.add(drop);
    });

    // ── GLOWING EYES (golden omen eyes)
    const eyeGlow = Anime.glow(0xffcc00, 6.0);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), eyeGlow);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.2, 3.5, 0.46);
    eyeR.position.set( 0.2, 3.5, 0.46);
    enemyGroup.add(eyeL);
    enemyGroup.add(eyeR);
    this.fx.registerItem(eyeL);
    this.fx.registerItem(eyeR);
    this._eyeL = eyeL;
    this._eyeR = eyeR;

    // ── GOLDEN SEAL/CROWN between horns
    const crownMat = Anime.glow(0xffaa00, 2.5);
    const crownH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.06), crownMat);
    crownH.position.set(0, 3.95, 0.42);
    enemyGroup.add(crownH);
    const crownV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.06), crownMat);
    crownV.position.set(0, 3.92, 0.42);
    enemyGroup.add(crownV);
    this._crownLight = Build.pointLight(this.scene, 0, 3.9, 0, 0xffaa00, 0, 2.5);

    // ── SHOULDERS (armoured pauldrons)
    [-1, 1].forEach(side => {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.58, 0.78), darkMat);
      shoulder.position.set(side * 1.15, 2.85, 0.04);
      enemyGroup.add(shoulder);
      Anime.outline(shoulder, 0.04);

      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.84), goldMat);
      p1.position.set(side * 1.15, 3.18, 0.04);
      enemyGroup.add(p1);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.5), darkMat);
      p2.position.set(side * 1.2, 3.32, -0.15);
      p2.rotation.x = -0.2;
      enemyGroup.add(p2);

      // shoulder horn-spikes
      for (let s = 0; s < 3; s++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), hornMat);
        spike.position.set(side * 1.2 + (s-1)*0.18, 3.52, -0.1);
        spike.rotation.x = -0.2;
        enemyGroup.add(spike);
      }

      const uArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.95, 0.4), robeMat);
      uArm.position.set(side * 1.22, 2.2, 0.04);
      enemyGroup.add(uArm);
      const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.32), bandageMat);
      wrap.position.set(side * 1.27, 1.5, 0.08);
      enemyGroup.add(wrap);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), fleshMat);
      hand.position.set(side * 1.3, 0.85, 0.2);
      enemyGroup.add(hand);
      for (let k = 0; k < 3; k++) {
        const ksp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.12), goldMat);
        ksp.position.set(side*(1.2 + (k-1)*0.1), 1.0, 0.4);
        enemyGroup.add(ksp);
      }
      for (let f = 0; f < 4; f++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 5), Anime.mat(0x0a0808));
        claw.position.set(side*(1.22 + (f-1.5)*0.1), 0.56, 0.28);
        claw.rotation.x = -0.45;
        enemyGroup.add(claw);
      }
    });

    // ── TAIL (omen tail)
    const tailSegs = [
      [0.0, 0.55,-0.55, 0.30, 0.85],
      [0.25,0.28,-1.15, 0.24, 0.72],
      [0.55,0.14,-1.85, 0.18, 0.60],
      [0.88,0.07,-2.45, 0.13, 0.50],
      [1.15,0.04,-2.90, 0.09, 0.42],
      [1.38,0.03,-3.20, 0.06, 0.35],
    ];
    tailSegs.forEach(([tx,ty,tz,tw,th]) => {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(tw, th, tw*1.1), robeMat);
      seg.position.set(tx, ty, tz);
      enemyGroup.add(seg);
      if (tw > 0.12) {
        const spine = new THREE.Mesh(new THREE.ConeGeometry(tw*0.18, tw*0.65, 5), hornMat);
        spine.position.set(tx, ty + th*0.6, tz);
        enemyGroup.add(spine);
      }
    });
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), hornMat);
    tailTip.position.set(1.55, 0.03, -3.35);
    tailTip.rotation.z = Math.PI / 2;
    enemyGroup.add(tailTip);

    // ── WEAPON: Spectral Golden Hammer (the iconic summoned weapon)
    this._weaponGroup = new THREE.Group();
    const wHandle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.8, 0.13), goldMat);
    wHandle.position.y = -0.7;
    this._weaponGroup.add(wHandle);
    for (let w = 0; w < 4; w++) {
      const wrap2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), bandageMat);
      wrap2.position.y = -1.2 + w*0.3;
      this._weaponGroup.add(wrap2);
    }
    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.25), goldMat);
    pommel.position.y = -1.6;
    this._weaponGroup.add(pommel);
    const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.42), Anime.glow(0xffcc00, 2.0));
    hHead.position.y = 0.45;
    this._weaponGroup.add(hHead);
    Anime.outline(hHead, 0.04, 0xaa6600);
    const hSide = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.38), goldMat);
    hSide.position.set(-0.4, 0.45, 0);
    this._weaponGroup.add(hSide);
    const hRune = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.06), Anime.glow(0xffee44, 1.5));
    hRune.position.set(0, 0.55, 0.23);
    this._weaponGroup.add(hRune);
    this._weaponLight = Build.pointLight(this.scene, 0, 0, 0, 0xffaa00, 0, 4);
    this._weaponGroup.position.set(1.7, 1.3, 0.55);
    enemyGroup.add(this._weaponGroup);

    // ── LEFT HAND: dagger
    this._offhandGroup = new THREE.Group();
    const dagBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.04), Anime.metal(0x8899bb, {roughness:0.2,metalness:0.95}));
    dagBlade.position.y = 0.5;
    this._offhandGroup.add(dagBlade);
    const dagGuard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), goldMat);
    this._offhandGroup.add(dagGuard);
    const dagGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), Anime.mat(0x2a1500,{roughness:0.9}));
    dagGrip.position.y = -0.18;
    this._offhandGroup.add(dagGrip);
    this._offhandGroup.position.set(-1.7, 1.2, 0.55);
    this._offhandGroup.rotation.z = 0.4;
    enemyGroup.add(this._offhandGroup);

    enemyGroup.position.set(0, 0, -8);
    enemyGroup.visible = false;
    this._enemy = enemyGroup;

    this._eyeLight = Build.pointLight(this.scene, 0, 3.5, -8, 0xffcc00, 0, 6);

    // ═══════════════════════════════════════════════════
    //  PLAYER WEAPON — more detailed sword
    // ═══════════════════════════════════════════════════
    this._swordGroup = new THREE.Group();
    const bladeMat2 = Anime.metal(0xaabbcc, { roughness: 0.12, metalness: 0.96 });
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.2, 0.04), bladeMat2);
    blade2.position.y = 0.62;
    this._swordGroup.add(blade2);
    // fuller (groove down blade)
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.022, 1.0, 0.01), Anime.mat(0x889aaa));
    fuller.position.set(0, 0.62, 0.025);
    this._swordGroup.add(fuller);
    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.07), Anime.metal(0x996600,{roughness:0.3,metalness:0.9}));
    crossguard.position.y = 0.06;
    this._swordGroup.add(crossguard);
    // quillon tips
    [-0.19, 0.19].forEach(ox => {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), goldMat);
      tip.position.set(ox, 0.06, 0);
      this._swordGroup.add(tip);
    });
    const grip2 = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.4, 0.065), Anime.mat(0x3a2200,{roughness:0.9}));
    grip2.position.y = -0.22;
    this._swordGroup.add(grip2);
    // grip wrapping
    for (let r2 = 0; r2 < 3; r2++) {
      const rw = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.075), Anime.mat(0x1a0800));
      rw.position.y = -0.1 - r2*0.12;
      this._swordGroup.add(rw);
    }
    const pommel2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), goldMat);
    pommel2.position.y = -0.45;
    this._swordGroup.add(pommel2);
    // attach to camera
    this._swordGroup.position.set(0.36, -0.30, -0.65);
    this._swordGroup.rotation.set(0.1, -0.2, 0.05);
    this.camera.add(this._swordGroup);
    this.scene.add(this.camera);

    // ═══════════════════════════════════════════════════
    //  HUD OVERLAYS
    // ═══════════════════════════════════════════════════
    this._flashOverlay = document.createElement('div');
    this._flashOverlay.style.cssText = `
      position:fixed;inset:0;background:rgba(180,0,0,0);
      pointer-events:none;z-index:9998;transition:background 0.05s;
    `;
    document.body.appendChild(this._flashOverlay);

    this._hitText = document.createElement('div');
    this._hitText.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      font-size:46px;font-weight:900;color:#ffcc00;font-family:serif;
      letter-spacing:6px;opacity:0;pointer-events:none;z-index:9999;
      text-shadow:0 0 30px #ffaa00,0 0 60px #ff6600;transition:opacity 0.08s;
    `;
    this._hitText.textContent = 'HIT';
    document.body.appendChild(this._hitText);

    // stamina bar
    document.querySelectorAll('[data-elden-stamina]').forEach(el => el.remove());
    this._staminaBar = document.createElement('div');
    this._staminaBar.setAttribute('data-elden-stamina', '1');  // ADD THIS LINE

    this._staminaBar.setAttribute('data-elden-stamina', '1');
    this._staminaBar.style.cssText = `
    position:fixed;bottom:60px;left:50%;transform:translateX(-50%);
    width:200px;height:7px;background:#111;border:1px solid #333;
    pointer-events:none;z-index:9997;border-radius:3px;overflow:hidden;
`;
    this._staminaFill = document.createElement('div');
    this._staminaFill.style.cssText = `width:100%;height:100%;background:#22cc44;transition:width 0.1s;`;
    this._staminaBar.appendChild(this._staminaFill);
    document.body.appendChild(this._staminaBar);
    this._stamina = 1.0;

    // ── F key listener (FIXED: removed facing-direction check for reliability)
    this._onKeyDown = (e) => {
      if (e.code === 'KeyF' && this._bossActive && !this._died) {
        this._playerSwing();
      }
    };
    document.addEventListener('keydown', this._onKeyDown);

    // ── FP CONTROLLER
    this.fp = this.engine.input;
    this.fpCtrl = new FPController(this.camera, this.engine.input);
    this.fpCtrl.teleport(0, 0, 12, Math.PI);
  }

  // ═══════════════════════════════════════════════════
  onEnter() {
    this.engine.renderer.setActiveScene(this.scene, this.camera, 'driving');
    this.engine.renderer.gl.toneMappingExposure = 0.65;
    this.engine.hud.setInfo(`
      <b style="color:#ffcc44">⚜ The Ashen Hollow</b><br>
      <span style="opacity:0.65;font-size:12px">A place between death and grace</span><br>
      <span style="opacity:0.5;font-size:11px">F — attack &nbsp;·&nbsp; E — interact</span>
    `);
  }

  onExit() {
  if (this._staminaBar)    { this._staminaBar.remove();    this._staminaBar = null; }
  if (this._flashOverlay)  { this._flashOverlay.remove();  this._flashOverlay = null; }
  if (this._hitText)       { this._hitText.remove();       this._hitText = null; }
  if (this._onKeyDown)     { document.removeEventListener('keydown', this._onKeyDown); }
  this.engine.renderer.gl.toneMappingExposure = 0.9;
}

  onInteract() {
    const interactor = new Interactor(this.camera, this.scene);
    interactor.interact(this.interactables);
  }

  // ═══════════════════════════════════════════════════
  //  PLAYER SWING — FIXED
  // ═══════════════════════════════════════════════════
  _playerSwing() {
    if (this._playerAttackCooldown > 0) return;
    if (this._stamina < 0.2) {
      this.engine.hud.showPrompt('No stamina...');
      setTimeout(() => this.engine.hud.hidePrompt(), 600);
      return;
    }

    this._playerAttacking = true;
    this._playerAttackTimer = 0.22;
    this._playerAttackCooldown = 0.7;
    this._stamina = Math.max(0, this._stamina - 0.3);

    // animate sword swing
    this._swordGroup.rotation.x = -1.3;
    this._swordGroup.rotation.z = -0.6;
    this._swordGroup.position.z = -0.5;
    setTimeout(() => {
      this._swordGroup.rotation.x = 0.1;
      this._swordGroup.rotation.z = 0.05;
      this._swordGroup.position.z = -0.65;
    }, 220);

    this.engine.audio.play('whoosh');

    // ─── HIT DETECTION: simplified & reliable
    // Only check distance. The player is clearly trying to attack the boss.
    const ep = this._enemy.position;
    const cp = this.camera.position;
    const dx = ep.x - cp.x;
    const dz = ep.z - cp.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    if (dist < 4.5 && !this._bossStunned) {
      this._hitEnemy();
    } else if (dist >= 4.5) {
      this.engine.hud.showPrompt('Out of range...');
      setTimeout(() => this.engine.hud.hidePrompt(), 800);
    } else if (this._bossStunned) {
      this.engine.hud.showPrompt('Already staggered!');
      setTimeout(() => this.engine.hud.hidePrompt(), 500);
    }
  }

  _hitEnemy() {
    this._bossHealth--;
    this._bossStunned = true;
    this._bossStunTimer = 1.4;
    // cancel any active attack
    this._lunging = false;
    this._attackScheduled = false;
    this._attackCooldown = 2.0;
    // push enemy back from player slightly
    const ep = this._enemy.position;
    const cp = this.camera.position;
    const dx = ep.x - cp.x;
    const dz = ep.z - cp.z;
    const len = Math.sqrt(dx*dx + dz*dz) || 1;
    ep.x = Math.max(-13, Math.min(13, ep.x + (dx/len) * 1.8));
    ep.z = Math.max(-16, Math.min(14, ep.z + (dz/len) * 1.8));
    // reset vertical drift
    ep.y = 0;
    enemy_rotation_reset: {
      this._enemy.rotation.x = 0;
      this._enemy.rotation.z = 0;
    }

    // flash HIT
    this._hitText.style.opacity = '1';
    setTimeout(() => { this._hitText.style.opacity = '0'; }, 380);

    this.engine.audio.play('chop');

    // weapon light flash
    this._weaponLight.intensity = 5;
    setTimeout(() => { this._weaponLight.intensity = 0; }, 180);

    // screen shake
    this._screenShake = 0.3;

    if (this._bossHealth <= 0) {
      this._bossDefeated();
      return;
    }
    if (this._bossHealth <= 2 && !this._phase2) {
      this._phase2 = true;
      this._enterPhase2();
    }
    this._updateHUD();
  }

  _enterPhase2() {
    this._flashOverlay.style.background = 'rgba(80,0,0,0.8)';
    setTimeout(() => { this._flashOverlay.style.background = 'rgba(0,0,0,0)'; }, 700);
    this._eyeLight.color.set(0xff0000);
    this._eyeLight.intensity = 6;
    this._crownLight.color.set(0xff2200);
    this.engine.audio.play('deny');
    setTimeout(() => this.engine.audio.play('deny'), 300);
    Build.label(this.scene, '— FELL OMEN ENRAGED —', 0, 7.0, -6, '#ff3300');
  }

  // ═══════════════════════════════════════════════════
  _enterFog() {
    if (this._jumpscareTriggered) return;
    this._jumpscareTriggered = true;
    this._flashOverlay.style.background = 'rgba(60,0,100,0.92)';
    this.engine.audio.play('whoosh');
    setTimeout(() => this.engine.audio.play('deny'), 150);
    setTimeout(() => { this._flashOverlay.style.background = 'rgba(0,0,0,0.99)'; }, 400);
    setTimeout(() => {
      this._flashOverlay.style.background = 'rgba(0,0,0,0)';
      this._fogDoor.visible = false;
      this._fogDoor2.visible = false;
      this._startBossFight();
    }, 1100);
  }

  _startBossFight() {
    this._bossHealth = 5;
    this._playerHealth = 3;
    this._bossActive = true;
    this._attackCooldown = 2.2;
    this._lunging = false;
    this._attackScheduled = false;
    this._died = false;
    this._phase2 = false;
    this._bossStunned = false;
    this._enemy.visible = true;
    this._enemy.position.set(0, 0, -8);
    this._enemy.rotation.set(0, 0, 0);
    this._eyeLight.intensity = 3.2;
    this._eyeLight.color.set(0xffcc00);
    this._crownLight.intensity = 1.5;
    this.engine.audio.play('deny');
    this._updateHUD();
  }

  _updateHUD() {
    const bossHearts = '🟡'.repeat(this._bossHealth) + '⬛'.repeat(Math.max(0,5-this._bossHealth));
    const playerHearts = '❤️ '.repeat(this._playerHealth);
    const phase = this._phase2 ? '<span style="color:#ff3300;font-size:10px"> ⚠ ENRAGED</span>' : '';
    this.engine.hud.setInfo(`
      <b style="color:#ffcc44;font-size:13px">⚜ MARGIT, THE FELL OMEN${phase}</b><br>
      <span style="font-size:13px">${bossHearts}</span><br>
      <span style="color:#ff4444;font-size:13px">${playerHearts}</span><br>
      <span style="opacity:0.55;font-size:10px">F attack · E grace site · distance matters</span>
    `);
  }

  _tryWin() {
    if (!this._bossActive) return;
    this.engine.hud.showPrompt('Defeat Margit first!');
    setTimeout(() => this.engine.hud.hidePrompt(), 1500);
  }

  _bossDefeated() {
    this._bossActive = false;
    this._enemy.visible = false;
    this._eyeLight.intensity = 0;
    this._weaponLight.intensity = 0;
    this._crownLight.intensity = 0;
    this._flashOverlay.style.background = 'rgba(200,150,0,0.85)';
    setTimeout(() => { this._flashOverlay.style.background = 'rgba(0,0,0,0)'; }, 600);
    this.engine.audio.play('cash');
    setTimeout(() => this.engine.audio.play('cash'), 200);
    setTimeout(() => this.engine.audio.play('cash'), 400);
    setTimeout(() => {
      this.engine.hud.showOverlay(`
        <div style="font-size:20px;letter-spacing:3px;opacity:0.6;color:#ffcc44;font-family:serif">GREAT ENEMY FELLED</div>
        <div style="font-size:52px">⚜</div>
        <div style="font-size:36px;font-weight:900;
          background:linear-gradient(135deg,#ffd700,#ffaa44);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
          letter-spacing:5px;font-family:serif">MARGIT DEFEATED</div>
        <div style="font-size:13px;opacity:0.6;color:#ffddaa;margin-top:8px">Runes gained: 12,000</div>
      `, 'Touch the Grace ⚜', () => {
        this._reset();
        this.engine.go('tardis');
      });
    }, 800);
  }

  _takeDamage() {
    if (this._died) return;
    this._playerHealth--;
    this._flashTimer = 0.28;
    this._flashOverlay.style.background = 'rgba(200,0,0,0.78)';
    this._screenShake = 0.55;
    this.engine.audio.play('deny');
    setTimeout(() => this.engine.audio.play('whoosh'), 70);
    if (this._playerHealth <= 0) {
      this._triggerDeath();
    } else {
      this._updateHUD();
    }
  }

  _triggerDeath() {
    this._died = true;
    this._bossActive = false;
    this._enemy.visible = false;
    this._eyeLight.intensity = 0;
    this._flashOverlay.style.background = 'rgba(0,0,0,0.97)';
    this.engine.audio.play('deny');
    setTimeout(() => this.engine.audio.play('deny'), 250);
    setTimeout(() => {
      this.engine.hud.showOverlay(`
        <div style="font-size:76px;font-weight:900;letter-spacing:12px;
          color:#cc2200;text-shadow:0 0 80px #ff000044;font-family:serif;">YOU DIED</div>
        <div style="font-size:12px;opacity:0.4;color:#ffaaaa;margin-top:12px;letter-spacing:4px">RUNES LOST: 1,204</div>
      `, 'Try Again', () => this._reset());
    }, 1100);
  }

  // ═══════════════════════════════════════════════════
  //  UPDATE — FIXED BOSS BEHAVIOR
  // ═══════════════════════════════════════════════════
  update(dt) {
    super.update(dt);
    if (this.fpCtrl) this.fpCtrl.update(dt, this.collidables);

    const t = Date.now() * 0.001;

    // ── stamina regen
    if (this._stamina < 1.0) {
      this._stamina = Math.min(1.0, this._stamina + dt * 0.4);
      if (this._staminaFill) this._staminaFill.style.width = `${this._stamina*100}%`;
    }

    // ── attack cooldowns
    if (this._playerAttackCooldown > 0) this._playerAttackCooldown -= dt;
    if (this._bossStunned) {
      this._bossStunTimer -= dt;
      if (this._bossStunTimer <= 0) {
        this._bossStunned = false;
        this._enemy.rotation.x = 0;
      }
    }

    // ── fog door pulse
    if (this._fogDoor?.visible) {
      this._fogDoor.material.opacity = 0.28 + 0.2 * Math.sin(t * 2.8);
      this._fogDoor2.material.opacity = 0.12 + 0.1 * Math.sin(t * 3.2 + 0.5);
      this._fogDoor.position.y = 3.75 + Math.sin(t * 1.1) * 0.04;
    }

    // ── grace light pulse + orbiting orbs
    if (this._graceLight) {
      this._graceLight.intensity = 4.0 + Math.sin(t * 2.1) * 1.2;
    }
    if (this._graceRays) {
      this._graceRays.forEach(({ mesh, phase }) => {
        mesh.position.y = mesh.position.y + Math.sin(t * 1.4 + phase) * 0.003;
        mesh.material.opacity = 0.1 + 0.09 * Math.sin(t * 2.2 + phase);
      });
    }
    if (this._graceOrbs) {
      this._graceOrbs.forEach((orb, i) => {
        orb.angle += dt * (0.8 + i * 0.12);
        const oy = 1.65 + Math.sin(t * 1.2 + orb.vy) * 0.3;
        orb.mesh.position.set(
          Math.cos(orb.angle) * orb.r,
          oy,
          Math.sin(orb.angle) * orb.r
        );
      });
    }

    // ── torch / sconce flicker (organic)
    this._torchLights.forEach(({ light, base, phase, flame }) => {
      const flicker = base * (0.82 + 0.22 * Math.sin(t * 7.1 + phase) + 0.08 * Math.sin(t * 19.3 + phase*2));
      light.intensity = flicker;
      if (flame) {
        flame.scale.y = 0.8 + 0.4 * Math.sin(t * 11 + phase);
        flame.scale.x = 0.7 + 0.35 * Math.sin(t * 8 + phase*1.5);
      }
    });

    // ── crack light flicker
    this._groundCrackLights.forEach((cl, i) => {
      cl.intensity = 0.45 + 0.38 * Math.sin(t * 4.8 + i * 1.4) + 0.12 * Math.sin(t*11.2+i);
    });

    // ── banner sway
    this._bannerMeshes.forEach(({ mesh, baseY, phase, isFog }) => {
      if (isFog) {
        mesh.material.opacity = 0.18 + 0.15 * Math.sin(t * 1.8 + phase);
      }
    });

    // ── dangling chains
    this._dangleItems.forEach(item => {
      item.mesh.position.x = item.x + Math.sin(t * 0.6 + item.phase) * 0.04;
      item.mesh.position.z = item.z + Math.sin(t * 0.4 + item.phase*1.3) * 0.03;
    });

    // ── rune animations
    this._runes.forEach(({ mesh, angle, r, baseOp }, i) => {
      mesh.material.opacity = baseOp + 0.12 * Math.sin(t * 1.1 + i * 0.45);
      mesh.rotation.z = t * 0.08;
    });

    // ── moon light subtle drift
    if (this._moonLight) {
      this._moonLight.intensity = 1.5 + 0.15 * Math.sin(t * 0.3);
    }

    // ── clouds drifting overhead
    if (this._clouds) {
      this._clouds.forEach(c => {
        c.mesh.position.x += c.vx * dt;
        if (c.mesh.position.x > 60) c.mesh.position.x = -60;
        if (c.mesh.position.x < -60) c.mesh.position.x = 60;
      });
    }

    // ── erdtree subtle pulse
    if (this._erdtree) {
      this._erdtree.rotation.y = Math.sin(t * 0.05) * 0.02;
    }
    
    // ── flash overlay fade
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        this._flashOverlay.style.background = 'rgba(0,0,0,0)';
      }
    }

    // ── screen shake
    if (this._screenShake > 0) {
      this._screenShake -= dt * 2.2;
      const s = Math.max(0, this._screenShake) * 0.07;
      this.camera.position.x += (Math.random()-0.5) * s;
      this.camera.position.y += (Math.random()-0.5) * s * 0.4;
    }

    if (!this._bossActive || this._died) return;

    const enemy = this._enemy;
    const cam = this.camera;
    const dx = cam.position.x - enemy.position.x;
    const dz = cam.position.z - enemy.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    // ── clamp boss inside arena at all times
    enemy.position.x = Math.max(-14, Math.min(14, enemy.position.x));
    enemy.position.z = Math.max(-15, Math.min(13, enemy.position.z));

    // ── eye light tracks boss
    this._eyeLight.position.set(enemy.position.x, enemy.position.y + 3.5, enemy.position.z);
    this._weaponLight.position.set(
      enemy.position.x + 1.7 * Math.sin(enemy.rotation.y + Math.PI/2),
      enemy.position.y + 1.9,
      enemy.position.z + 1.7 * Math.cos(enemy.rotation.y + Math.PI/2)
    );
    this._crownLight.position.set(enemy.position.x, enemy.position.y + 3.8, enemy.position.z);

    // ── face player (y-axis only)
    enemy.rotation.y = Math.atan2(dx, dz);

    // ── LUNGE ATTACK (FIXED: no random position reset)
    if (this._lunging) {
      this._lungeTimer -= dt;
      const lungeSpeed = this._phase2 ? 17 : 13;
      enemy.position.x += this._lungeDir.x * lungeSpeed * dt;
      enemy.position.z += this._lungeDir.z * lungeSpeed * dt;
      enemy.rotation.x = -0.5;
      this._weaponGroup.rotation.x = -1.4;

      const ldx = cam.position.x - enemy.position.x;
      const ldz = cam.position.z - enemy.position.z;
      const lDist = Math.sqrt(ldx*ldx + ldz*ldz);

      if (lDist < 1.5) {
        // HIT PLAYER
        this._lunging = false;
        enemy.rotation.x = 0;
        this._weaponGroup.rotation.x = 0;
        this._attackCooldown = this._phase2 ? 1.2 : 1.8;
        this._attackScheduled = false;
        this._takeDamage();
        return;
      }

      if (this._lungeTimer <= 0) {
        // LUNGE ENDED WITHOUT HIT — boss stays where it is, does NOT snap to origin
        this._lunging = false;
        enemy.rotation.x = 0;
        this._weaponGroup.rotation.x = 0;
        this._attackCooldown = this._phase2 ? 1.0 : 1.6;
        this._attackScheduled = false;
      }
      return;
    }

    // ── idle animation
    if (!this._bossStunned) {
      const breathAmt = this._phase2 ? 0.07 : 0.05;
      enemy.position.y = Math.sin(t * 1.3) * breathAmt;
      this._weaponGroup.rotation.z = Math.sin(t * 2.2) * 0.14;
      this._weaponGroup.position.y = 1.3 + Math.sin(t * 1.5) * 0.1;
      this._offhandGroup.rotation.z = 0.4 + Math.sin(t * 1.8 + 0.5) * 0.1;
      // crown glow pulse
      this._crownLight.intensity = 1.5 + Math.sin(t * 2.8) * 0.5;
    }

    // ── stun wobble
    if (this._bossStunned) {
      enemy.rotation.z = Math.sin(t * 14) * 0.14;
      this._crownLight.intensity = 0.3 + Math.random() * 0.8;
    }

    this._attackCooldown -= dt;

    // ── STALK MOVEMENT
    if (!this._bossStunned) {
      const baseSpeed = this._phase2 ? 2.4 : 1.5;
      const aggression = (5 - this._bossHealth) * 0.22;
      const speed = baseSpeed + aggression;

      if (dist > 5.0) {
        // approach
        enemy.position.x += (dx / dist) * speed * dt;
        enemy.position.z += (dz / dist) * speed * dt;
      } else if (dist > 3.2 && dist <= 5.0) {
        // circle strafe
        const perpX = -dz / dist;
        const perpZ =  dx / dist;
        const side = Math.sin(t * 0.5) > 0 ? 1 : -1;
        enemy.position.x += perpX * speed * 0.85 * dt * side;
        enemy.position.z += perpZ * speed * 0.85 * dt * side;
      }
      // keep off the grace pedestal
      const grDist = Math.sqrt(enemy.position.x**2 + enemy.position.z**2);
      if (grDist < 2) {
        enemy.position.x *= 2.2 / grDist;
        enemy.position.z *= 2.2 / grDist;
      }
    }

    // ── TRIGGER ATTACK (FIXED: use _attackScheduled flag to prevent double-triggers)
    if (this._attackCooldown <= 0 && dist < 9 && !this._bossStunned && !this._attackScheduled) {
      this._attackScheduled = true;
      const lungeCount = this._phase2 ? 2 : 1;

      const doLunge = (i) => {
        if (!this._bossActive || this._bossStunned) {
          this._attackScheduled = false;
          this._attackCooldown = 0.5;
          return;
        }
        // telegraph — eyes flash, weapon raises
        this._eyeLight.intensity = 12;
        this._weaponGroup.rotation.x = -0.9;
        this._weaponGroup.position.z = 0.8;
        this.engine.audio.play('whoosh');

        setTimeout(() => {
          if (!this._bossActive || this._bossStunned) {
            this._eyeLight.intensity = this._phase2 ? 5 : 3;
            this._weaponGroup.rotation.x = 0;
            this._weaponGroup.position.z = 0.55;
            this._attackScheduled = false;
            this._attackCooldown = 0.8;
            return;
          }
          // commit to lunge
          this._eyeLight.intensity = this._phase2 ? 5 : 3;
          this._weaponGroup.rotation.x = 0;
          this._weaponGroup.position.z = 0.55;
          // lock in direction at time of launch (toward current player pos)
          const lx = cam.position.x - enemy.position.x;
          const lz = cam.position.z - enemy.position.z;
          const lLen = Math.sqrt(lx*lx + lz*lz) || 1;
          this._lungeDir.set(lx/lLen, 0, lz/lLen);
          this._lunging = true;
          this._lungeTimer = this._phase2 ? 0.36 : 0.28;
          this.engine.audio.play('deny');

          // phase 2 — second lunge after a pause
          if (i < lungeCount - 1) {
            setTimeout(() => {
              if (!this._bossActive || this._bossStunned || this._lunging) return;
              doLunge(i + 1);
            }, 950);
          } else {
            this._attackCooldown = this._phase2 ? 1.4 : 2.4;
          }
        }, 500);
      };

      doLunge(0);
    }

    // ── HEARTBEAT
    this._heartbeatTimer -= dt;
    const hbRate = this._playerHealth === 1 ? 0.32 : this._playerHealth === 2 ? 0.62 : 1.1;
    if (this._heartbeatTimer <= 0) {
      this._heartbeatTimer = hbRate;
      this.engine.audio.play('step');
    }

    // ── BOSS ROAR
    this._bossRoarTimer -= dt;
    if (this._bossRoarTimer <= 0) {
      this._bossRoarTimer = (this._phase2 ? 5 : 9) + Math.random() * 5;
      this.engine.audio.play('deny');
    }
  }

  // ═══════════════════════════════════════════════════
  //  RESET
  // ═══════════════════════════════════════════════════
  _reset() {
    this._jumpscareTriggered = false;
    this._died = false;
    this._bossActive = false;
    this._bossHealth = 5;
    this._playerHealth = 3;
    this._flashTimer = 0;
    this._lunging = false;
    this._attackScheduled = false;
    this._screenShake = 0;
    this._attackCooldown = 0;
    this._bossStunned = false;
    this._phase2 = false;
    this._stamina = 1.0;
    this._enemy.visible = false;
    this._enemy.position.set(0, 0, -8);
    this._enemy.rotation.set(0, 0, 0);
    this._eyeLight.intensity = 0;
    this._weaponLight.intensity = 0;
    this._crownLight.intensity = 0;
    this._fogDoor.visible = true;
    this._fogDoor2.visible = true;
    this._flashOverlay.style.background = 'rgba(0,0,0,0)';
    this._swordGroup.rotation.set(0.1, -0.2, 0.05);
    this._swordGroup.position.set(0.36, -0.30, -0.65);
    if (this._staminaFill) this._staminaFill.style.width = '100%';
    if (this.fpCtrl) this.fpCtrl.teleport(0, 0, 12, Math.PI);
    this.engine.hud.setInfo(`
      <b style="color:#ffcc44">⚜ The Ashen Hollow</b><br>
      <span style="opacity:0.65;font-size:12px">A place between death and grace</span><br>
      <span style="opacity:0.5;font-size:11px">F — attack &nbsp;·&nbsp; E — interact</span>
    `);
  }
}