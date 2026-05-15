import * as THREE from 'three';
import { Level, Anime, Build, FPController, Interactor } from '../engine.js';

export class EldenLevel extends Level {
  constructor(engine) {
    super(engine);
    // ── state
    this._bossActive = false;
    this._bossHealth = 8;
    this._playerHealth = 5;
    this._flashTimer = 0;
    this._died = false;
    this._jumpscareTriggered = false;
    this._screenShake = 0;
    this._heartbeatTimer = 0;
    this._playerAttackCooldown = 0;
    this._playerAttacking = false;
    this._playerAttackTimer = 0;
    this._bossStunned = false;
    this._bossStunTimer = 0;
    this._phase2 = false;
    this._bossRoarTimer = 3;
    this._stamina = 1.0;

    // ── attack system
    this._attackCooldown = 2.0;
    this._currentAttack = null;   // 'lunge' | 'slam' | 'combo' | 'tail' | 'throw'
    this._attackPhase = 'idle';   // 'idle' | 'telegraph' | 'active' | 'recovery'
    this._attackTimer = 0;
    this._comboStep = 0;
    this._comboHitThisSwing = false;
    this._lungeDir = new THREE.Vector3();
    this._slamCircle = null;
    this._slamLight = null;
    this._projectiles = [];
    this._tailGlow = null;
    this._comboHitFlag = false;

    // ── visuals
    this._torchLights = [];
    this._dangleItems = [];
    this._grassTufts = [];
    this._runes = [];
    this._clouds = [];
    this._lightShafts = [];
    this._mistPlanes = [];
  }

  init() {
    // ═══════════════════════════════════════════════════
    //  SKY & ATMOSPHERE — misty green-grey Stormveil approach
    // ═══════════════════════════════════════════════════
    this.scene.background = new THREE.Color(0x7a8480);
    this.scene.fog = new THREE.FogExp2(0x8a9288, 0.013);

    // ── LIGHTING (overcast hazy daylight)
    const ambient = new THREE.AmbientLight(0x8a9290, 1.3);
    this.scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xcccab0, 1.6);
    sunLight.position.set(18, 36, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.setScalar(4096);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -45;
    sunLight.shadow.camera.right = sunLight.shadow.camera.top = 45;
    sunLight.shadow.bias = -0.0003;
    this.scene.add(sunLight);
    this._sunLight = sunLight;

    const fill = new THREE.DirectionalLight(0x8898a0, 0.6);
    fill.position.set(-20, 18, -10);
    this.scene.add(fill);

    const hemi = new THREE.HemisphereLight(0xa0b0a8, 0x504438, 0.7);
    this.scene.add(hemi);

    // ═══════════════════════════════════════════════════
    //  THE STORMVEIL CASTLE FACADE — massive backdrop
    // ═══════════════════════════════════════════════════
    const stoneMat = { matOpts: { roughness: 0.95, metalness: 0.05 } };
    const darkStoneMat = { matOpts: { roughness: 0.97, metalness: 0.04 } };

    // main outer wall — massive (60 wide, 35 tall)
    Build.box(this.scene, 0, 17.5, -32, 60, 35, 3, 0x4a4640, stoneMat);
    // inner wall surface (slightly forward)
    Build.box(this.scene, 0, 16, -30.5, 56, 32, 0.3, 0x55504a, stoneMat);
    // base battlements / stone trim
    Build.box(this.scene, 0, 1.0, -30, 60, 2.0, 0.6, 0x3a3630, darkStoneMat);
    Build.box(this.scene, 0, 33, -30.5, 58, 1.5, 0.5, 0x3a3630, darkStoneMat);

    // ── crenellations along top
    for (let x = -28; x <= 28; x += 2.0) {
      Build.box(this.scene, x, 35.5, -30.5, 1.2, 2.0, 1.0, 0x3a3630, { noOutline: true });
    }

    // ── massive towers along the wall (gothic)
    const towerDefs = [
      [-26, 4.5, 48,  6.0],
      [-15, 4.0, 44,  5.5],
      [  0, 5.0, 52,  7.0],
      [ 15, 4.0, 44,  5.5],
      [ 26, 4.5, 48,  6.0],
      [-22, 3.5, 40,  4.5],
      [ 22, 3.5, 40,  4.5],
    ];
    towerDefs.forEach(([x, w, h, d]) => {
      // main tower shaft
      Build.box(this.scene, x, h/2, -30, w, h, w*0.9, 0x44403a, stoneMat);
      // tower battlement collar
      Build.box(this.scene, x, h+0.5, -30, w+0.6, 1.0, w+0.4, 0x363230, stoneMat);
      // crenellations on tower
      for (let cx = -w/2+0.3; cx <= w/2-0.3; cx += 1.1) {
        Build.box(this.scene, x+cx, h+1.6, -30, 0.7, 1.5, 0.7, 0x2c2826, { noOutline: true });
      }
      // tall spire on top
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(w*0.45, h*0.5, 6),
        Anime.mat(0x2a2622, { roughness: 0.95 })
      );
      spire.position.set(x, h + h*0.27, -30);
      this.scene.add(spire);

      // gothic windows (tall narrow openings)
      [h*0.3, h*0.55, h*0.78].forEach(wy => {
        Build.box(this.scene, x, wy, -29.6, 0.7, 1.8, 0.3, 0x0a0808, { noOutline: true });
      });

      // tiny glow from arrow slits
      if (Math.random() > 0.3) {
        Build.pointLight(this.scene, x, h*0.55, -29.5, 0xff7733, 0.4, 5);
      }
    });

    // ── grand central archway (closed — boss room is "beyond" it)
    Build.box(this.scene, -3, 6, -29.4, 0.8, 12, 0.4, 0x1a1816, stoneMat);
    Build.box(this.scene,  3, 6, -29.4, 0.8, 12, 0.4, 0x1a1816, stoneMat);
    Build.box(this.scene,  0, 12.5,-29.4, 7.5, 1.2, 0.4, 0x1a1816, stoneMat);
    // arch keystone
    Build.box(this.scene, 0, 12, -29.3, 1.5, 1.5, 0.5, 0x2a2624, stoneMat);
    // dark interior (the way "inside")
    Build.box(this.scene, 0, 6, -29.55, 5.8, 11.5, 0.05, 0x080605, { noOutline: true });
    Build.pointLight(this.scene, 0, 4, -28, 0xff5522, 1.0, 8);

    // ── gothic detail pinnacles along the wall top
    for (let x = -27; x <= 27; x += 9) {
      const pin = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 3.0, 5),
        Anime.mat(0x2a2622, { roughness: 0.9 })
      );
      pin.position.set(x, 35 + 1.5, -30.5);
      this.scene.add(pin);
    }

    // ── decorative buttresses (large supports) flanking
    [-30, 30].forEach(bx => {
      Build.box(this.scene, bx, 10, -28, 4, 20, 5, 0x3c3832, stoneMat);
      Build.box(this.scene, bx, 21, -28, 5, 2, 6, 0x322e28, stoneMat);
    });

    // ── recessed wall panel detail (relief decorations)
    [[-19,12,-30.3],[-10,12,-30.3],[10,12,-30.3],[19,12,-30.3]].forEach(([x,y,z]) => {
      Build.box(this.scene, x, y, z, 3, 5, 0.15, 0x3e3a34, { noOutline:true });
      Build.box(this.scene, x, y-2, z+0.05, 2.4, 0.6, 0.05, 0x504a42, { noOutline:true });
      Build.box(this.scene, x, y, z+0.05, 0.3, 4.0, 0.05, 0x504a42, { noOutline:true });
    });

    // ── flanking secondary walls extending out and curving back
    Build.box(this.scene, -34, 6,  -16, 4, 12, 30, 0x42403a, stoneMat);
    Build.box(this.scene,  34, 6,  -16, 4, 12, 30, 0x42403a, stoneMat);
    // crenellations along these walls
    for (let z = -28; z <= 0; z += 2.0) {
      Build.box(this.scene, -34, 12.5, z, 4.5, 1.5, 1.0, 0x322e28, { noOutline: true });
      Build.box(this.scene,  34, 12.5, z, 4.5, 1.5, 1.0, 0x322e28, { noOutline: true });
    }

    // ── distant castle spires (further back, smaller, hazier)
    const distantSpireDefs = [
      [-18, 8, -55, 5, 26],
      [  8, 7, -58, 4, 22],
      [-30, 6, -52, 4, 20],
      [ 22, 6, -55, 4, 24],
      [  0, 9, -62, 6, 30],
      [-45, 5, -45, 4, 18],
      [ 40, 5, -48, 4, 20],
    ];
    distantSpireDefs.forEach(([x, w, z, sw, sh]) => {
      Build.box(this.scene, x, sh/2, z, sw, sh, sw, 0x3a3832, stoneMat);
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(sw*0.5, sh*0.45, 5),
        Anime.mat(0x252320, { roughness: 0.95 })
      );
      spire.position.set(x, sh + sh*0.22, z);
      this.scene.add(spire);
    });

    // ═══════════════════════════════════════════════════
    //  GROUND — large open mossy stone bridge/courtyard
    // ═══════════════════════════════════════════════════
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3d3a30,
      roughness: 0.96,
      metalness: 0.04,
      roughnessMap: Anime.roughnessTex(20, 512),
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70, 35, 35), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // ── moss patches scattered (greenish-brown)
    const mossMat = new THREE.MeshBasicMaterial({
      color: 0x3a4228, transparent: true, opacity: 0.65, depthWrite: false
    });
    for (let i = 0; i < 36; i++) {
      const w = 1.5 + Math.random()*2.5;
      const d = 1.5 + Math.random()*2.5;
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mossMat);
      patch.rotation.x = -Math.PI/2;
      patch.rotation.z = Math.random()*Math.PI;
      patch.position.set((Math.random()-0.5)*55, 0.003, (Math.random()-0.5)*45);
      this.scene.add(patch);
    }

    // ── darker stone joints (rough tile grid)
    for (let x = -32; x <= 32; x += 4) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08, 64),
        new THREE.MeshBasicMaterial({ color: 0x1a1812, transparent: true, opacity: 0.7 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.002, 0);
      this.scene.add(line);
    }
    for (let z = -32; z <= 32; z += 4) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(64, 0.08),
        new THREE.MeshBasicMaterial({ color: 0x1a1812, transparent: true, opacity: 0.7 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.002, z);
      this.scene.add(line);
    }

    // ── grass tufts in the cracks (this is the green!)
    const grassMat1 = new THREE.MeshBasicMaterial({ color: 0x5a7038, side: THREE.DoubleSide });
    const grassMat2 = new THREE.MeshBasicMaterial({ color: 0x6a8042, side: THREE.DoubleSide });
    const grassMat3 = new THREE.MeshBasicMaterial({ color: 0x4a6028, side: THREE.DoubleSide });
    for (let i = 0; i < 220; i++) {
      const x = (Math.random()-0.5) * 60;
      const z = (Math.random()-0.5) * 55;
      // don't put grass right on the boss arena center
      if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;

      const cluster = 2 + Math.floor(Math.random()*3);
      for (let c = 0; c < cluster; c++) {
        const mat = [grassMat1, grassMat2, grassMat3][Math.floor(Math.random()*3)];
        const h = 0.2 + Math.random()*0.35;
        const blade = new THREE.Mesh(
          new THREE.PlaneGeometry(0.08, h),
          mat
        );
        blade.position.set(x + (Math.random()-0.5)*0.3, h/2, z + (Math.random()-0.5)*0.3);
        blade.rotation.y = Math.random()*Math.PI;
        this.scene.add(blade);
        this._grassTufts.push({ mesh: blade, baseRot: blade.rotation.y, phase: Math.random()*Math.PI*2 });

        // cross-blade for fuller look
        const blade2 = new THREE.Mesh(
          new THREE.PlaneGeometry(0.08, h),
          mat
        );
        blade2.position.copy(blade.position);
        blade2.rotation.y = blade.rotation.y + Math.PI/2;
        this.scene.add(blade2);
        this._grassTufts.push({ mesh: blade2, baseRot: blade2.rotation.y, phase: Math.random()*Math.PI*2 });
      }
    }

    // ── small weed/flower stalks
    for (let i = 0; i < 40; i++) {
      const x = (Math.random()-0.5) * 55;
      const z = (Math.random()-0.5) * 50;
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
      const stalk = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.5 + Math.random()*0.3, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x6a7848 })
      );
      stalk.position.set(x, 0.25, z);
      this.scene.add(stalk);
      // tiny flower
      if (Math.random() > 0.5) {
        const flower = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.1, 0.1),
          new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xddbb44 : 0xcc6644 })
        );
        flower.position.set(x, 0.55 + Math.random()*0.2, z);
        this.scene.add(flower);
      }
    }

    // ── cracks with embers
    const crackMat = new THREE.MeshBasicMaterial({ color: 0xcc5500, transparent: true, opacity: 0.45 });
    const crackNetworks = [
      [[0,0],[2,2],[4,3],[5,5]],
      [[0,0],[-2,1.5],[-4,3]],
      [[0,0],[1,-2],[3,-4]],
      [[0,0],[-1.5,-2],[-3,-4]],
      [[-6,5],[-8,4],[-10,5.5]],
      [[6,-4],[8,-3],[10,-4.5]],
      [[-5,-7],[-7,-6]],
      [[4,7],[6,8.5]],
    ];
    crackNetworks.forEach(pts => {
      pts.forEach(([x,z], i) => {
        if (i === 0) return;
        const px = pts[i-1][0], pz = pts[i-1][1];
        const len = Math.sqrt((x-px)**2 + (z-pz)**2);
        const angle = Math.atan2(z-pz, x-px);
        const crack = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.035), crackMat);
        crack.rotation.x = -Math.PI / 2;
        crack.rotation.z = -angle;
        crack.position.set((x+px)/2, 0.004, (z+pz)/2);
        this.scene.add(crack);
      });
    });

    // ═══════════════════════════════════════════════════
    //  SIDE WALLS — low broken ramparts (NOT enclosing)
    // ═══════════════════════════════════════════════════
    // these are low so you can see over them to the void/distance

    // left rampart (broken sections)
    [[-32, 0, -8, 3, 2.8],[-32, 0, 2, 3, 2.0],[-32, 0, 11, 3, 2.5]].forEach(([x,y,z,w,h]) => {
      Build.box(this.scene, x, h/2, z, w, h, 8, 0x484440, stoneMat);
      // broken top edge
      for (let i = -3; i <= 3; i += 1.3) {
        const ch = 0.3 + Math.random()*0.4;
        Build.box(this.scene, x, h + ch/2, z+i, w*0.8, ch, 0.8, 0x363230, { noOutline:true });
      }
    });

    // right rampart
    [[32, 0, -8, 3, 2.5],[32, 0, 4, 3, 2.8],[32, 0, 12, 3, 2.0]].forEach(([x,y,z,w,h]) => {
      Build.box(this.scene, x, h/2, z, w, h, 8, 0x484440, stoneMat);
      for (let i = -3; i <= 3; i += 1.3) {
        const ch = 0.3 + Math.random()*0.4;
        Build.box(this.scene, x, h + ch/2, z+i, w*0.8, ch, 0.8, 0x363230, { noOutline:true });
      }
    });

    // ── front edge (broken bridge edge, opens to mist/void)
    [[-22,16],[-12,18],[-2,17],[8,18.5],[18,17.5]].forEach(([x,z]) => {
      Build.box(this.scene, x, 0.4, z, 4, 0.8, 3, 0x4a4640, stoneMat);
      // broken top
      for (let i = -1.5; i <= 1.5; i += 0.8) {
        Build.box(this.scene, x+i, 0.9, z, 0.6, 0.3+Math.random()*0.3, 2.5, 0x363230, { noOutline:true });
      }
    });

    // ── ARENA BOUNDARIES (invisible collidables — open feel)
    [
      new THREE.Box3(new THREE.Vector3(-35,-1,-32), new THREE.Vector3(-30,15,20)), // left
      new THREE.Box3(new THREE.Vector3( 30,-1,-32), new THREE.Vector3( 35,15,20)), // right
      new THREE.Box3(new THREE.Vector3(-35,-1,-32), new THREE.Vector3( 35,40,-29)), // back castle
      new THREE.Box3(new THREE.Vector3(-35,-1, 19), new THREE.Vector3( 35,15, 22)), // front cliff
    ].forEach(b => this.collidables.push(b));

    // ═══════════════════════════════════════════════════
    //  MIST WALLS — beyond the arena edge (illusion of void)
    // ═══════════════════════════════════════════════════
    // front mist
    for (let i = 0; i < 10; i++) {
      const mistMat = new THREE.MeshBasicMaterial({
        color: 0x9aa098, transparent: true, opacity: 0.18 + Math.random()*0.12, depthWrite: false
      });
      const mist = new THREE.Mesh(new THREE.PlaneGeometry(8, 14), mistMat);
      mist.position.set((Math.random()-0.5)*50, 4 + Math.random()*4, 22 + Math.random()*4);
      this.scene.add(mist);
      this._mistPlanes.push(mist);
    }
    // ground mist hugging the arena
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(7 + Math.random()*5, 2),
        new THREE.MeshBasicMaterial({ color: 0xa0a89c, transparent: true, opacity: 0.12+Math.random()*0.1, depthWrite: false })
      );
      const ang = (i/28)*Math.PI*2;
      m.position.set(Math.cos(ang)*22, 0.5+Math.random()*1.2, Math.sin(ang)*18 - 4);
      m.rotation.y = ang;
      this.scene.add(m);
      this._mistPlanes.push(m);
    }

    // ═══════════════════════════════════════════════════
    //  CLOUDS / HAZE OVERHEAD
    // ═══════════════════════════════════════════════════
    for (let i = 0; i < 18; i++) {
      const cloudMat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0x9098a0 : 0xb0b6b0,
        transparent: true,
        opacity: 0.35 + Math.random() * 0.25,
        depthWrite: false,
      });
      const w = 18 + Math.random() * 22;
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.4), cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 120,
        35 + Math.random() * 18,
        -20 - Math.random() * 50
      );
      cloud.rotation.x = -Math.PI/2 + 0.4;
      this.scene.add(cloud);
      this._clouds.push({ mesh: cloud, vx: (Math.random()-0.5) * 0.2 });
    }

    // ── light shafts coming through the haze (the iconic god-rays)
    for (let i = 0; i < 8; i++) {
      const shaft = new THREE.Mesh(
        new THREE.PlaneGeometry(2 + Math.random()*1.5, 30),
        new THREE.MeshBasicMaterial({
          color: 0xddd4b8, transparent: true, opacity: 0.06+Math.random()*0.05, depthWrite: false
        })
      );
      shaft.position.set(-25 + i*7, 15, -15 + Math.random()*10);
      shaft.rotation.z = 0.15 + (Math.random()-0.5)*0.1;
      this.scene.add(shaft);
      this._lightShafts.push(shaft);
    }

    // ═══════════════════════════════════════════════════
    //  SCATTERED RUINS — broken pillars, fallen statue
    // ═══════════════════════════════════════════════════
    const pillarDefs = [
      [-12, -10, 1.0, 7.0, false],
      [ 12, -10, 1.0, 6.5, true ],
      [-18,  -2, 0.9, 8.0, false],
      [ 18,  -2, 0.9, 5.5, true ],
      [-14,   8, 0.9, 6.0, true ],
      [ 14,   8, 0.9, 7.2, false],
      [-22,   4, 0.8, 4.5, true ],
      [ 22,   4, 0.8, 5.0, false],
    ];

    pillarDefs.forEach(([x, z, w, h, broken]) => {
      Build.box(this.scene, x, 0,    z, w+0.5, 0.3, w+0.5, 0x363230);
      Build.box(this.scene, x, 0.3,  z, w+0.3, 0.2, w+0.3, 0x3a3632);

      const { mesh } = Build.box(this.scene, x, 0.5, z, w, h, w, 0x4a4640);
      mesh.castShadow = true;
      this.collidables.push(new THREE.Box3().setFromObject(mesh));

      // moss on pillar
      Build.box(this.scene, x, 0.5+h*0.2, z+w*0.51, w*0.7, 0.6, 0.02, 0x4a5828, { noOutline:true });
      Build.box(this.scene, x+w*0.51, 0.5+h*0.4, z, 0.02, 0.5, w*0.6, 0x4a5828, { noOutline:true });

      if (!broken) {
        Build.box(this.scene, x, 0.5+h, z, w+0.3, 0.3, w+0.3, 0x3a3632);
        Build.box(this.scene, x, 0.5+h+0.3, z, w+0.5, 0.18, w+0.5, 0x322e2c);
      } else {
        // shattered top
        for (let s = 0; s < 4; s++) {
          const sh = 0.4 + Math.random()*1.0;
          const ox = (Math.random()-0.5)*w*1.2;
          const oz = (Math.random()-0.5)*w*1.2;
          const { mesh: sm } = Build.box(this.scene, x+ox, 0.5+h+s*0.1, z+oz, w*0.6, sh, w*0.6, 0x3a3630, { noOutline:true });
          sm.rotation.z = (Math.random()-0.5)*0.6;
        }
        // rubble at base
        for (let r = 0; r < 6; r++) {
          const rs = 0.15+Math.random()*0.4;
          Build.box(this.scene, x+(Math.random()-0.5)*2.5, 0, z+(Math.random()-0.5)*2.5, rs*1.5, rs*0.6, rs, 0x2a2624, { noOutline:true });
        }
      }
    });

    // ── fallen statue (head + torso lying down, dramatic)
    Build.box(this.scene, -20, 0.4, 14, 5.0, 0.8, 1.8, 0x4a4640); // torso
    Build.box(this.scene, -16, 0.5, 14, 1.0, 1.0, 1.0, 0x4a4640); // head
    Build.box(this.scene, -16, 1.3, 14, 0.6, 0.6, 0.6, 0x484440); // crown nub
    Build.box(this.scene, -22, 0.4, 13.5, 1.5, 0.6, 0.6, 0x4a4640); // arm
    // moss on statue
    Build.box(this.scene, -20, 0.85, 14, 4, 0.05, 1.5, 0x4a5828, { noOutline:true });

    // ── stairs leading up to castle (decorative, against archway)
    [[0,0,-26,8,0.3,3],[0,0.3,-24.5,7,0.3,2.5],[0,0.6,-23.2,6,0.3,2]].forEach(([x,y,z,w,h,d]) => {
      Build.box(this.scene, x, y, z, w, h, d, 0x44403a, stoneMat);
    });

    // ── braziers flanking the stairs
    [[-5, -23],[5, -23]].forEach(([x,z]) => {
      Build.box(this.scene, x, 0.6, z, 0.8, 1.2, 0.8, 0x2a2624);
      Build.box(this.scene, x, 1.3, z, 1.0, 0.3, 1.0, 0x322e2a);
      const bl = Build.pointLight(this.scene, x, 1.8, z, 0xff7733, 2.5, 8);
      this._torchLights.push({ light: bl, base: 2.5, phase: Math.random()*Math.PI*2, isBrazier: true });
      // flame
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.5, 6),
        new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.85 })
      );
      flame.position.set(x, 1.7, z);
      this.scene.add(flame);
      this._torchLights[this._torchLights.length-1].flame = flame;
    });

    // ── wall torches on the castle wall
    [-20, -10, 10, 20].forEach(x => {
      Build.box(this.scene, x, 5, -29.3, 0.25, 0.6, 0.25, 0x2a2622, { noOutline:true });
      const wl = Build.pointLight(this.scene, x, 5.5, -28.8, 0xff6622, 1.4, 8);
      this._torchLights.push({ light: wl, base: 1.4, phase: Math.random()*Math.PI*2 });
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.3, 6),
        new THREE.MeshBasicMaterial({ color: 0xff7733, transparent: true, opacity: 0.9 })
      );
      flame.position.set(x, 5.65, -28.8);
      this.scene.add(flame);
      this._torchLights[this._torchLights.length-1].flame = flame;
    });

    // ═══════════════════════════════════════════════════
    //  SCATTERED PROPS
    // ═══════════════════════════════════════════════════

    // skulls scattered
    for (let i = 0; i < 18; i++) {
      const x = (Math.random()-0.5)*45;
      const z = (Math.random()-0.5)*35;
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
      const s = 0.22 + Math.random()*0.12;
      Build.box(this.scene, x, s*0.4, z, s*1.2, s, s*1.1, 0x161220);
      Build.box(this.scene, x, s*0.9, z, s*0.8, s*0.7, s*0.85, 0x181426);
    }

    // weapons stuck in ground
    [[-8,5],[6,-3],[10,8],[-12,-6],[15,-2]].forEach(([x,z]) => {
      Build.box(this.scene, x, 0.85, z, 0.06, 1.7, 0.04, 0x888aaa, { noOutline:true });
      Build.box(this.scene, x, 0.3, z, 0.35, 0.05, 0.05, 0x665500, { noOutline:true });
    });

    // small rubble piles
    for (let i = 0; i < 14; i++) {
      const x = (Math.random()-0.5)*50;
      const z = (Math.random()-0.5)*40;
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
      for (let r = 0; r < 4; r++) {
        const rs = 0.15+Math.random()*0.4;
        Build.box(this.scene, x+(Math.random()-0.5)*1.5, 0, z+(Math.random()-0.5)*1.5, rs*1.5, rs*0.6, rs, 0x2a2624, { noOutline:true });
      }
    }

    // blood pools
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x3a0000, transparent: true, opacity: 0.5, depthWrite: false });
    [[-6,2,1.2],[5,-3,0.9],[9,5,1.4],[-3,-7,1.0],[12,-1,0.8]].forEach(([x,z,r]) => {
      const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 12), bloodMat);
      pool.rotation.x = -Math.PI/2;
      pool.position.set(x, 0.003, z);
      this.scene.add(pool);
    });

    // ═══════════════════════════════════════════════════
    //  FOG DOOR — at the rear, the way "into" the boss
    // ═══════════════════════════════════════════════════
    const fogGeo = new THREE.PlaneGeometry(4.5, 9);
    const fogMat = new THREE.MeshBasicMaterial({
      color: 0x6633dd, transparent: true, opacity: 0.4,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this._fogDoor = new THREE.Mesh(fogGeo, fogMat);
    this._fogDoor.position.set(0, 4.5, -29.2);
    this.scene.add(this._fogDoor);

    const fogGeo2 = new THREE.PlaneGeometry(4.3, 8.8);
    const fogMat2 = new THREE.MeshBasicMaterial({
      color: 0xaa44ff, transparent: true, opacity: 0.2,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this._fogDoor2 = new THREE.Mesh(fogGeo2, fogMat2);
    this._fogDoor2.position.set(0, 4.5, -29.18);
    this.scene.add(this._fogDoor2);

    this.fx.registerParticles(Build.particles(this.scene, 60, 3.5, 0xaa66ff, 0.06));
    Build.label(this.scene, '[E] Enter the fog', 0, 10, -28.5, '#cc99ff');
    Build.pointLight(this.scene, 0, 5, -28, 0x7733ff, 3.0, 10);
    this._fogDoor.userData.onInteract = () => this._enterFog();
    this.interactables.push(this._fogDoor);

    // ═══════════════════════════════════════════════════
    //  SITE OF GRACE — golden glowing pedestal, near player spawn
    // ═══════════════════════════════════════════════════
    Build.box(this.scene, 0, 0,    14, 1.6, 0.2,  1.6, 0x504a3c);
    Build.box(this.scene, 0, 0.2,  14, 1.3, 0.18, 1.3, 0x544e40);
    Build.box(this.scene, 0, 0.38, 14, 1.0, 0.3,  1.0, 0x58524a);
    Build.box(this.scene, 0, 0.68, 14, 0.7, 0.12, 0.7, 0x5e564c);
    Build.box(this.scene, 0, 0.8,  14, 0.22,0.45, 0.22, 0x4a4438);
    Build.box(this.scene, 0, 1.25, 14, 0.55,0.12, 0.55, 0x6a5e44);

    this._graceLight = Build.pointLight(this.scene, 0, 1.5, 14, 0xffcc44, 5.0, 18);

    const graceMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      Anime.glow(0xffee88, 4.0)
    );
    graceMesh.position.set(0, 1.65, 14);
    this.scene.add(graceMesh);
    Anime.outline(graceMesh, 0.08, 0x443300);
    this.fx.registerItem(graceMesh);
    this._graceMesh = graceMesh;

    // grace rays
    this._graceRays = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const len = 1.5 + (i%3)*0.5;
      const ray = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04, len),
        new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide })
      );
      ray.position.set(Math.cos(angle)*0.2, 1.65+len/2, 14 + Math.sin(angle)*0.2);
      ray.rotation.y = angle;
      ray.rotation.x = 0.12;
      this.scene.add(ray);
      this._graceRays.push({ mesh: ray, angle, phase: (i/10)*Math.PI*2 });
    }

    // orbiting orbs
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
    Build.label(this.scene, 'Site of Grace', 0, 2.8, 14, '#ffdd88');

    // ═══════════════════════════════════════════════════
    //  PARTICLES & STARS
    // ═══════════════════════════════════════════════════
    this.fx.registerParticles(Build.particles(this.scene, 180, 30, 0xbbb8a0, 0.05)); // ash
    this.fx.registerParticles(Build.particles(this.scene, 100, 25, 0x8a9078, 0.04)); // dust
    this.fx.registerParticles(Build.particles(this.scene,  50, 18, 0xffcc66, 0.06)); // sparks
    this.fx.registerParticles(Build.particles(this.scene,  60, 22, 0xddccaa, 0.04)); // motes

    // ═══════════════════════════════════════════════════
    //  MARGIT — THE FELL OMEN
    //  (same model as before — proper omen anatomy)
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

    // ── LOWER BODY
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
    const medalH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.06), goldMat);
    medalH.position.set(0, 2.55, 0.5);
    enemyGroup.add(medalH);
    const medalV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.06), goldMat);
    medalV.position.set(0, 2.45, 0.5);
    enemyGroup.add(medalV);

    // ── CLOAK
    const cloakBack = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.2, 0.15), cloakMat);
    cloakBack.position.set(0, 1.8, -0.5);
    cloakBack.rotation.x = -0.05;
    enemyGroup.add(cloakBack);
    [-0.7, -0.3, 0.3, 0.7].forEach(ox => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6 + Math.random()*0.4, 0.1), cloakMat);
      strip.position.set(ox, 0.5, -0.55);
      strip.rotation.z = ox * 0.1;
      enemyGroup.add(strip);
    });
    [-1, 1].forEach(side => {
      const drape = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.12), cloakMat);
      drape.position.set(side * 1.05, 2.0, -0.25);
      drape.rotation.z = side * 0.08;
      enemyGroup.add(drape);
    });

    // ── NECK + HEAD
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.35), fleshMat);
    neck.position.set(0, 3.1, 0.08);
    enemyGroup.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.08, 0.82), fleshMat);
    head.position.set(0, 3.45, 0.12);
    enemyGroup.add(head);
    Anime.outline(head, 0.045, 0x000000);

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

    // ── HORNS
    const bigHornL = new THREE.Group();
    const blS1 = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.55, 6), hornMat);
    blS1.position.y = 0.27; bigHornL.add(blS1);
    const blS2 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 6), hornMat);
    blS2.position.set(-0.1, 0.75, -0.1); blS2.rotation.z = 0.4; bigHornL.add(blS2);
    const blS3 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 6), hornMat);
    blS3.position.set(-0.28, 1.15, -0.22); blS3.rotation.z = 0.85; bigHornL.add(blS3);
    const blS4 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 5), hornMat);
    blS4.position.set(-0.5, 1.42, -0.3); blS4.rotation.z = 1.3; bigHornL.add(blS4);
    bigHornL.position.set(-0.32, 3.92, 0.05); bigHornL.rotation.z = -0.15;
    enemyGroup.add(bigHornL);

    const bigHornR = new THREE.Group();
    const brS1 = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 6), hornMat);
    brS1.position.y = 0.25; bigHornR.add(brS1);
    const brS2 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), hornMat);
    brS2.position.set(0.07, 0.7, 0.1); brS2.rotation.z = -0.3; bigHornR.add(brS2);
    const brS3 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 6), hornMat);
    brS3.position.set(0.2, 1.05, 0.22); brS3.rotation.z = -0.7; bigHornR.add(brS3);
    bigHornR.position.set(0.32, 3.92, 0.05); bigHornR.rotation.z = 0.12;
    enemyGroup.add(bigHornR);

    const smallHorns = [
      [-0.12, 4.02, 0.22, 0.05, 0.3,  0.05, 0.1 ],
      [ 0.12, 4.02, 0.22, 0.05, 0.3, -0.05, 0.1 ],
      [-0.5,  3.55, 0.2,  0.05, 0.28, 0.7,  0.0 ],
      [ 0.5,  3.55, 0.2,  0.05, 0.28,-0.7,  0.0 ],
      [-0.55, 3.3,  0.25, 0.04, 0.22, 0.85, 0.0 ],
      [ 0.55, 3.3,  0.25, 0.04, 0.22,-0.85, 0.0 ],
      [ 0.0,  4.05, 0.3,  0.05, 0.25, 0.0,  0.25],
    ];
    smallHorns.forEach(([x, y, z, r, h, rz, rx]) => {
      const sh = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), hornMat);
      sh.position.set(x, y, z);
      sh.rotation.z = rz;
      sh.rotation.x = rx;
      enemyGroup.add(sh);
    });

    // ── BEARD
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.22), bandageMat);
    beard.position.set(0, 2.72, 0.44); beard.rotation.x = 0.18;
    enemyGroup.add(beard);
    const beardSide = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.16), boneWhite);
    beardSide.position.set(0, 2.82, 0.4);
    enemyGroup.add(beardSide);
    const beardTail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.15), boneWhite);
    beardTail.position.set(0, 2.22, 0.42); beardTail.rotation.x = 0.3;
    enemyGroup.add(beardTail);
    const beardRing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.18), goldMat);
    beardRing.position.set(0, 2.45, 0.42);
    enemyGroup.add(beardRing);
    const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.2), bandageMat);
    mustache.position.set(0, 3.15, 0.46);
    enemyGroup.add(mustache);

    // ── EYES
    const eyeGlow = Anime.glow(0xffcc00, 6.0);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), eyeGlow);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.2, 3.5, 0.46);
    eyeR.position.set( 0.2, 3.5, 0.46);
    enemyGroup.add(eyeL); enemyGroup.add(eyeR);
    this.fx.registerItem(eyeL); this.fx.registerItem(eyeR);

    // ── CROWN
    const crownMat = Anime.glow(0xffaa00, 2.5);
    const crownH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.06), crownMat);
    crownH.position.set(0, 3.95, 0.42);
    enemyGroup.add(crownH);
    const crownV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.06), crownMat);
    crownV.position.set(0, 3.92, 0.42);
    enemyGroup.add(crownV);
    this._crownLight = Build.pointLight(this.scene, 0, 3.9, 0, 0xffaa00, 0, 2.5);

    // ── SHOULDERS / ARMS
    [-1, 1].forEach(side => {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.58, 0.78), darkMat);
      shoulder.position.set(side * 1.15, 2.85, 0.04);
      enemyGroup.add(shoulder);
      Anime.outline(shoulder, 0.04);
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.84), goldMat);
      p1.position.set(side * 1.15, 3.18, 0.04);
      enemyGroup.add(p1);
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
      for (let f = 0; f < 4; f++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 5), Anime.mat(0x0a0808));
        claw.position.set(side*(1.22 + (f-1.5)*0.1), 0.56, 0.28);
        claw.rotation.x = -0.45;
        enemyGroup.add(claw);
      }
    });

    // ── TAIL
    const tailSegs = [
      [0.0, 0.55,-0.55, 0.30, 0.85],
      [0.25,0.28,-1.15, 0.24, 0.72],
      [0.55,0.14,-1.85, 0.18, 0.60],
      [0.88,0.07,-2.45, 0.13, 0.50],
      [1.15,0.04,-2.90, 0.09, 0.42],
    ];
    const tailGroup = new THREE.Group();
    tailSegs.forEach(([tx,ty,tz,tw,th]) => {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(tw, th, tw*1.1), robeMat);
      seg.position.set(tx, ty, tz);
      tailGroup.add(seg);
    });
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), hornMat);
    tailTip.position.set(1.55, 0.03, -3.35);
    tailTip.rotation.z = Math.PI / 2;
    tailGroup.add(tailTip);
    enemyGroup.add(tailGroup);
    this._tailGroup = tailGroup;

    // tail glow (for telegraph)
    const tailGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0, depthWrite: false })
    );
    tailGlow.position.set(1.55, 0.03, -3.35);
    tailGroup.add(tailGlow);
    this._tailGlow = tailGlow;

    // ── WEAPON: Spectral Golden Hammer
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
    this._weaponLight = Build.pointLight(this.scene, 0, 0, 0, 0xffaa00, 0, 4);
    this._weaponGroup.position.set(1.7, 1.3, 0.55);
    enemyGroup.add(this._weaponGroup);

    enemyGroup.position.set(0, 0, -8);
    enemyGroup.visible = false;
    this._enemy = enemyGroup;
    this._eyeLight = Build.pointLight(this.scene, 0, 3.5, -8, 0xffcc00, 0, 6);

    // ═══════════════════════════════════════════════════
    //  TELEGRAPH VISUALS — slam circle on ground
    // ═══════════════════════════════════════════════════
    const slamRingMat = new THREE.MeshBasicMaterial({
      color: 0xff2200, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide,
    });
    this._slamCircle = new THREE.Mesh(new THREE.RingGeometry(3.5, 4.5, 32), slamRingMat);
    this._slamCircle.rotation.x = -Math.PI/2;
    this._slamCircle.position.y = 0.01;
    this._slamCircle.visible = false;
    this.scene.add(this._slamCircle);

    this._slamInner = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 32),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0, depthWrite: false })
    );
    this._slamInner.rotation.x = -Math.PI/2;
    this._slamInner.position.y = 0.008;
    this._slamInner.visible = false;
    this.scene.add(this._slamInner);

    this._slamLight = Build.pointLight(this.scene, 0, 0.5, 0, 0xff3300, 0, 8);

    // ═══════════════════════════════════════════════════
    //  PLAYER WEAPON — sword attached to camera
    // ═══════════════════════════════════════════════════
    this._swordGroup = new THREE.Group();
    const bladeMat2 = Anime.metal(0xaabbcc, { roughness: 0.12, metalness: 0.96 });
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.2, 0.04), bladeMat2);
    blade2.position.y = 0.62;
    this._swordGroup.add(blade2);
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.022, 1.0, 0.01), Anime.mat(0x889aaa));
    fuller.position.set(0, 0.62, 0.025);
    this._swordGroup.add(fuller);
    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.07), Anime.metal(0x996600,{roughness:0.3,metalness:0.9}));
    crossguard.position.y = 0.06;
    this._swordGroup.add(crossguard);
    const grip2 = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.4, 0.065), Anime.mat(0x3a2200,{roughness:0.9}));
    grip2.position.y = -0.22;
    this._swordGroup.add(grip2);
    const pommel2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), goldMat);
    pommel2.position.y = -0.45;
    this._swordGroup.add(pommel2);
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

    // warning text for big attacks
    this._warnText = document.createElement('div');
    this._warnText.style.cssText = `
      position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);
      font-size:36px;font-weight:900;color:#ff3300;font-family:serif;
      letter-spacing:5px;opacity:0;pointer-events:none;z-index:9999;
      text-shadow:0 0 20px #ff0000,0 0 40px #ff3300;transition:opacity 0.1s;
    `;
    document.body.appendChild(this._warnText);

    document.querySelectorAll('[data-elden-stamina]').forEach(el => el.remove());
    this._staminaBar = document.createElement('div');
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

    this._onKeyDown = (e) => {
      if (e.code === 'KeyF' && this._bossActive && !this._died) {
        this._playerSwing();
      }
    };
    document.addEventListener('keydown', this._onKeyDown);

    this.fp = this.engine.input;
    this.fpCtrl = new FPController(this.camera, this.engine.input);
    this.fpCtrl.teleport(0, 0, 16, Math.PI);
  }

  onEnter() {
    this.engine.renderer.setActiveScene(this.scene, this.camera, 'driving');
    this.engine.renderer.gl.toneMappingExposure = 0.85;
    this.engine.hud.setInfo(`
      <b style="color:#ffcc44">⚜ Stormveil Approach</b><br>
      <span style="opacity:0.65;font-size:12px">The bridge to the Fell Omen's lair</span><br>
      <span style="opacity:0.5;font-size:11px">F — attack &nbsp;·&nbsp; E — interact</span>
    `);
  }

  onExit() {
    if (this._staminaBar)    { this._staminaBar.remove();    this._staminaBar = null; }
    if (this._flashOverlay)  { this._flashOverlay.remove();  this._flashOverlay = null; }
    if (this._hitText)       { this._hitText.remove();       this._hitText = null; }
    if (this._warnText)      { this._warnText.remove();      this._warnText = null; }
    if (this._onKeyDown)     { document.removeEventListener('keydown', this._onKeyDown); }
    this.engine.renderer.gl.toneMappingExposure = 0.9;
  }

  onInteract() {
    const interactor = new Interactor(this.camera, this.scene);
    interactor.interact(this.interactables);
  }

  // ═══════════════════════════════════════════════════
  //  PLAYER COMBAT
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
    this._playerAttackCooldown = 0.6;
    this._stamina = Math.max(0, this._stamina - 0.3);

    this._swordGroup.rotation.x = -1.3;
    this._swordGroup.rotation.z = -0.6;
    this._swordGroup.position.z = -0.5;
    setTimeout(() => {
      this._swordGroup.rotation.x = 0.1;
      this._swordGroup.rotation.z = 0.05;
      this._swordGroup.position.z = -0.65;
    }, 220);

    this.engine.audio.play('whoosh');

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
    }
  }

  _hitEnemy() {
    this._bossHealth--;
    this._bossStunned = true;
    this._bossStunTimer = 1.2;
    // cancel attack
    this._currentAttack = null;
    this._attackPhase = 'idle';
    this._attackTimer = 0;
    this._attackCooldown = 1.8;
    this._hideTelegraphs();

    const ep = this._enemy.position;
    const cp = this.camera.position;
    const dx = ep.x - cp.x;
    const dz = ep.z - cp.z;
    const len = Math.sqrt(dx*dx + dz*dz) || 1;
    ep.x = Math.max(-28, Math.min(28, ep.x + (dx/len) * 1.5));
    ep.z = Math.max(-26, Math.min(16, ep.z + (dz/len) * 1.5));
    ep.y = 0;
    this._enemy.rotation.x = 0;
    this._enemy.rotation.z = 0;

    this._hitText.style.opacity = '1';
    setTimeout(() => { this._hitText.style.opacity = '0'; }, 380);
    this.engine.audio.play('chop');
    this._weaponLight.intensity = 5;
    setTimeout(() => { this._weaponLight.intensity = 0; }, 180);
    this._screenShake = 0.3;

    if (this._bossHealth <= 0) { this._bossDefeated(); return; }
    if (this._bossHealth <= 4 && !this._phase2) {
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
    this._showWarning('FELL OMEN ENRAGED');
  }

  _showWarning(text) {
    this._warnText.textContent = text;
    this._warnText.style.opacity = '1';
    setTimeout(() => { this._warnText.style.opacity = '0'; }, 700);
  }

  _hideTelegraphs() {
    if (this._slamCircle) { this._slamCircle.visible = false; this._slamCircle.material.opacity = 0; }
    if (this._slamInner)  { this._slamInner.visible = false;  this._slamInner.material.opacity = 0; }
    if (this._slamLight)  this._slamLight.intensity = 0;
    if (this._tailGlow)   this._tailGlow.material.opacity = 0;
    this._comboHitFlag = false;
  }

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
    this._bossHealth = 8;
    this._playerHealth = 5;
    this._bossActive = true;
    this._attackCooldown = 2.2;
    this._currentAttack = null;
    this._attackPhase = 'idle';
    this._died = false;
    this._phase2 = false;
    this._bossStunned = false;
    this._enemy.visible = true;
    this._enemy.position.set(0, 0, -6);
    this._enemy.rotation.set(0, 0, 0);
    this._eyeLight.intensity = 3.2;
    this._eyeLight.color.set(0xffcc00);
    this._crownLight.intensity = 1.5;
    this.engine.audio.play('deny');
    this._showWarning('MARGIT, THE FELL OMEN');
    this._updateHUD();
  }

  _updateHUD() {
    const bossHearts = '🟡'.repeat(this._bossHealth) + '⬛'.repeat(Math.max(0,8-this._bossHealth));
    const playerHearts = '❤️ '.repeat(this._playerHealth);
    const phase = this._phase2 ? '<span style="color:#ff3300;font-size:10px"> ⚠ ENRAGED</span>' : '';
    this.engine.hud.setInfo(`
      <b style="color:#ffcc44;font-size:13px">⚜ MARGIT, THE FELL OMEN${phase}</b><br>
      <span style="font-size:13px">${bossHearts}</span><br>
      <span style="color:#ff4444;font-size:13px">${playerHearts}</span><br>
      <span style="opacity:0.55;font-size:10px">F attack · E grace site · dodge his big attacks!</span>
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
    this._hideTelegraphs();
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

  _takeDamage(amount = 1) {
    if (this._died) return;
    this._playerHealth -= amount;
    this._flashTimer = 0.28;
    const intensity = amount >= 2 ? 0.92 : 0.78;
    this._flashOverlay.style.background = `rgba(200,0,0,${intensity})`;
    this._screenShake = amount >= 2 ? 0.9 : 0.55;
    this.engine.audio.play('deny');
    setTimeout(() => this.engine.audio.play('whoosh'), 70);
    if (this._playerHealth <= 0) this._triggerDeath();
    else this._updateHUD();
  }

  _triggerDeath() {
    this._died = true;
    this._bossActive = false;
    this._enemy.visible = false;
    this._eyeLight.intensity = 0;
    this._hideTelegraphs();
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
  //  ATTACK SELECTION — picks a move based on context
  // ═══════════════════════════════════════════════════
  _selectAttack(dist) {
    const r = Math.random();
    const p2 = this._phase2;

    // close range
    if (dist < 3.5) {
      if (r < 0.35) return 'tail';
      if (r < 0.65) return 'combo';
      if (r < 0.85 && p2) return 'slam';
      return 'lunge';
    }
    // mid range
    if (dist < 7) {
      if (r < 0.40) return 'lunge';
      if (r < 0.70) return 'slam';
      if (r < 0.85 && p2) return 'throw';
      return 'combo';
    }
    // long range
    if (p2 && r < 0.55) return 'throw';
    if (r < 0.70) return 'slam';
    return 'lunge';
  }

  _startAttack(type) {
    this._currentAttack = type;
    this._attackPhase = 'telegraph';

    switch(type) {
      case 'lunge':
        this._attackTimer = 0.55;
        this._eyeLight.intensity = 10;
        this._weaponGroup.rotation.x = -0.9;
        this._weaponGroup.position.z = 0.8;
        this.engine.audio.play('whoosh');
        break;

      case 'slam':
        this._attackTimer = 1.1;
        this._eyeLight.intensity = 14;
        this._weaponGroup.rotation.x = -2.4;
        this._weaponGroup.position.y = 2.5;
        this._showWarning('▼ SLAM ▼');
        // position slam circle at player
        const cp = this.camera.position;
        this._slamCircle.position.x = cp.x;
        this._slamCircle.position.z = cp.z;
        this._slamInner.position.x = cp.x;
        this._slamInner.position.z = cp.z;
        this._slamCircle.visible = true;
        this._slamInner.visible = true;
        this.engine.audio.play('whoosh');
        setTimeout(() => this.engine.audio.play('whoosh'), 300);
        break;

      case 'combo':
        this._attackTimer = 0.4;
        this._comboStep = 0;
        this._comboHitFlag = false;
        this._eyeLight.intensity = 8;
        this._weaponGroup.rotation.x = -0.7;
        this.engine.audio.play('whoosh');
        break;

      case 'tail':
        this._attackTimer = 0.65;
        this._eyeLight.intensity = 9;
        this._tailGlow.material.opacity = 0.9;
        this._showWarning('◄ TAIL SWEEP ►');
        this.engine.audio.play('whoosh');
        break;

      case 'throw':
        this._attackTimer = 0.8;
        this._eyeLight.intensity = 12;
        this._weaponGroup.rotation.x = -1.5;
        this._weaponGroup.position.y = 1.9;
        this._weaponLight.intensity = 4;
        this._showWarning('✦ HAMMER THROW ✦');
        this.engine.audio.play('whoosh');
        break;
    }
  }

  _executeAttack() {
    const type = this._currentAttack;
    this._attackPhase = 'active';

    switch(type) {
      case 'lunge': {
        const cam = this.camera.position;
        const ep = this._enemy.position;
        const lx = cam.x - ep.x;
        const lz = cam.z - ep.z;
        const lLen = Math.sqrt(lx*lx + lz*lz) || 1;
        this._lungeDir.set(lx/lLen, 0, lz/lLen);
        this._attackTimer = this._phase2 ? 0.36 : 0.3;
        this._eyeLight.intensity = this._phase2 ? 5 : 3;
        this._weaponGroup.rotation.x = 0;
        this._weaponGroup.position.z = 0.55;
        this.engine.audio.play('deny');
        break;
      }
      case 'slam': {
        this._attackTimer = 0.35;
        this._eyeLight.intensity = 8;
        this._weaponGroup.rotation.x = 0.5;
        this._weaponGroup.position.y = 0.5;
        // ground impact at the circle location
        this._slamLight.position.set(this._slamCircle.position.x, 0.5, this._slamCircle.position.z);
        this._slamLight.intensity = 12;
        this._screenShake = 0.7;
        this.engine.audio.play('deny');
        // check if player is inside the circle
        const cp = this.camera.position;
        const sx = this._slamCircle.position.x - cp.x;
        const sz = this._slamCircle.position.z - cp.z;
        const sDist = Math.sqrt(sx*sx + sz*sz);
        if (sDist < 4.5) {
          this._takeDamage(2);
        }
        break;
      }
      case 'combo': {
        // first swing
        this._attackTimer = 0.22;
        this._weaponGroup.rotation.x = 0.4;
        this._weaponGroup.rotation.z = -0.6;
        this.engine.audio.play('deny');
        this._checkComboHit();
        break;
      }
      case 'tail': {
        this._attackTimer = 0.4;
        this._eyeLight.intensity = 6;
        // sweep tail
        this._tailGroup.rotation.y = Math.PI/2;
        this._tailGlow.material.opacity = 0.5;
        this.engine.audio.play('whoosh');
        // check distance — tail hits anything within 3.8 units of boss
        const cp = this.camera.position;
        const ep = this._enemy.position;
        const tdx = cp.x - ep.x;
        const tdz = cp.z - ep.z;
        const tDist = Math.sqrt(tdx*tdx + tdz*tdz);
        if (tDist < 3.8) this._takeDamage(1);
        break;
      }
      case 'throw': {
        this._attackTimer = 1.2;
        this._eyeLight.intensity = 5;
        this._weaponGroup.rotation.x = 0.3;
        this._weaponGroup.position.y = 1.3;
        // spawn projectile
        this._spawnHammerProjectile();
        this.engine.audio.play('deny');
        break;
      }
    }
  }

  _checkComboHit() {
    if (this._comboHitFlag) return;
    const cp = this.camera.position;
    const ep = this._enemy.position;
    const dx = cp.x - ep.x;
    const dz = cp.z - ep.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < 3.2) {
      this._takeDamage(1);
      this._comboHitFlag = true;
    }
  }

  _spawnHammerProjectile() {
    const ep = this._enemy.position;
    const cam = this.camera.position;
    const dx = cam.x - ep.x;
    const dz = cam.z - ep.z;
    const len = Math.sqrt(dx*dx + dz*dz) || 1;
    const dir = new THREE.Vector3(dx/len, 0, dz/len);

    const proj = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      Anime.glow(0xffcc00, 3.0)
    );
    proj.position.set(ep.x + dir.x*1.5, 1.6, ep.z + dir.z*1.5);
    this.scene.add(proj);

    const light = Build.pointLight(this.scene, proj.position.x, 1.6, proj.position.z, 0xffaa00, 3, 6);

    this._projectiles.push({
      mesh: proj, light, dir,
      speed: 18, life: 1.4, returning: false
    });
  }

  _endAttack() {
    const type = this._currentAttack;

    switch(type) {
      case 'lunge':
        this._weaponGroup.rotation.x = 0;
        this._weaponGroup.position.z = 0.55;
        this._attackCooldown = this._phase2 ? 1.0 : 1.6;
        break;

      case 'slam':
        this._weaponGroup.rotation.x = 0;
        this._weaponGroup.position.y = 1.3;
        this._slamCircle.visible = false;
        this._slamInner.visible = false;
        this._slamCircle.material.opacity = 0;
        this._slamInner.material.opacity = 0;
        this._slamLight.intensity = 0;
        this._attackCooldown = this._phase2 ? 1.4 : 2.0;
        break;

      case 'combo':
        // chain to next swing or end
        if (this._comboStep < 2) {
          this._comboStep++;
          this._comboHitFlag = false;
          this._attackPhase = 'telegraph';
          this._attackTimer = 0.25;
          this._eyeLight.intensity = 8;
          // alternate swing direction
          const dir = this._comboStep % 2 === 0 ? -1 : 1;
          this._weaponGroup.rotation.x = -0.6;
          this._weaponGroup.rotation.z = dir * 0.5;
          this.engine.audio.play('whoosh');
          return; // don't reset attack state yet
        } else {
          this._weaponGroup.rotation.x = 0;
          this._weaponGroup.rotation.z = 0;
          this._attackCooldown = this._phase2 ? 1.2 : 1.8;
        }
        break;

      case 'tail':
        this._tailGroup.rotation.y = 0;
        this._tailGlow.material.opacity = 0;
        this._attackCooldown = this._phase2 ? 1.0 : 1.6;
        break;

      case 'throw':
        this._weaponGroup.rotation.x = 0;
        this._weaponGroup.position.y = 1.3;
        this._weaponLight.intensity = 0;
        this._attackCooldown = this._phase2 ? 1.3 : 2.0;
        break;
    }

    this._currentAttack = null;
    this._attackPhase = 'idle';
    this._eyeLight.intensity = this._phase2 ? 5 : 3;
  }

  // ═══════════════════════════════════════════════════
  //  UPDATE LOOP
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

    if (this._playerAttackCooldown > 0) this._playerAttackCooldown -= dt;
    if (this._bossStunned) {
      this._bossStunTimer -= dt;
      if (this._bossStunTimer <= 0) {
        this._bossStunned = false;
        this._enemy.rotation.x = 0;
        this._enemy.rotation.z = 0;
      }
    }

    // ── fog door pulse
    if (this._fogDoor?.visible) {
      this._fogDoor.material.opacity = 0.28 + 0.2 * Math.sin(t * 2.8);
      this._fogDoor2.material.opacity = 0.12 + 0.1 * Math.sin(t * 3.2 + 0.5);
      this._fogDoor.position.y = 4.5 + Math.sin(t * 1.1) * 0.04;
    }

    // ── grace
    if (this._graceLight) {
      this._graceLight.intensity = 4.0 + Math.sin(t * 2.1) * 1.2;
    }
    if (this._graceRays) {
      this._graceRays.forEach(({ mesh, phase }) => {
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
          14 + Math.sin(orb.angle) * orb.r
        );
      });
    }

    // ── torches
    this._torchLights.forEach(({ light, base, phase, flame }) => {
      const flicker = base * (0.82 + 0.22 * Math.sin(t * 7.1 + phase) + 0.08 * Math.sin(t * 19.3 + phase*2));
      light.intensity = flicker;
      if (flame) {
        flame.scale.y = 0.8 + 0.4 * Math.sin(t * 11 + phase);
        flame.scale.x = 0.7 + 0.35 * Math.sin(t * 8 + phase*1.5);
      }
    });

    // ── grass sway
    this._grassTufts.forEach(g => {
      g.mesh.rotation.y = g.baseRot + Math.sin(t * 1.5 + g.phase) * 0.15;
    });

    // ── clouds drift
    if (this._clouds) {
      this._clouds.forEach(c => {
        c.mesh.position.x += c.vx * dt;
        if (c.mesh.position.x > 80) c.mesh.position.x = -80;
        if (c.mesh.position.x < -80) c.mesh.position.x = 80;
      });
    }

    // ── light shafts subtle shift
    this._lightShafts.forEach((shaft, i) => {
      shaft.material.opacity = 0.05 + 0.04 * Math.sin(t * 0.7 + i);
    });

    // ── mist drift
    this._mistPlanes.forEach((m, i) => {
      m.position.y += Math.sin(t * 0.5 + i) * 0.002;
    });

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
      const s = Math.max(0, this._screenShake) * 0.08;
      this.camera.position.x += (Math.random()-0.5) * s;
      this.camera.position.y += (Math.random()-0.5) * s * 0.4;
    }

    // ── projectiles
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const p = this._projectiles[i];
      p.mesh.position.x += p.dir.x * p.speed * dt;
      p.mesh.position.z += p.dir.z * p.speed * dt;
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 5;
      p.light.position.copy(p.mesh.position);
      p.life -= dt;

      // hit check
      const cam = this.camera.position;
      const pdx = p.mesh.position.x - cam.x;
      const pdz = p.mesh.position.z - cam.z;
      const pd = Math.sqrt(pdx*pdx + pdz*pdz);
      if (pd < 1.3) {
        this._takeDamage(1);
        this.scene.remove(p.mesh);
        this.scene.remove(p.light);
        this._projectiles.splice(i, 1);
        continue;
      }

      if (p.life <= 0 || Math.abs(p.mesh.position.x) > 35 || Math.abs(p.mesh.position.z) > 30) {
        this.scene.remove(p.mesh);
        this.scene.remove(p.light);
        this._projectiles.splice(i, 1);
      }
    }

    if (!this._bossActive || this._died) return;

    const enemy = this._enemy;
    const cam = this.camera;
    const dx = cam.position.x - enemy.position.x;
    const dz = cam.position.z - enemy.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    // clamp boss inside arena
    enemy.position.x = Math.max(-28, Math.min(28, enemy.position.x));
    enemy.position.z = Math.max(-26, Math.min(16, enemy.position.z));

    this._eyeLight.position.set(enemy.position.x, enemy.position.y + 3.5, enemy.position.z);
    this._crownLight.position.set(enemy.position.x, enemy.position.y + 3.8, enemy.position.z);
    this._weaponLight.position.set(
      enemy.position.x + 1.7 * Math.sin(enemy.rotation.y + Math.PI/2),
      enemy.position.y + 1.9,
      enemy.position.z + 1.7 * Math.cos(enemy.rotation.y + Math.PI/2)
    );

    enemy.rotation.y = Math.atan2(dx, dz);

    // ── ATTACK STATE MACHINE
    if (this._currentAttack) {
      this._attackTimer -= dt;

      // Slam telegraph: grow the warning circle as it ticks down
      if (this._currentAttack === 'slam' && this._attackPhase === 'telegraph') {
        const progress = 1 - Math.max(0, this._attackTimer / 1.1);
        this._slamCircle.material.opacity = 0.4 + progress * 0.5;
        this._slamInner.material.opacity = 0.15 + progress * 0.35;
      }

      // Lunge active: move boss toward player
      if (this._currentAttack === 'lunge' && this._attackPhase === 'active') {
        const lungeSpeed = this._phase2 ? 17 : 13;
        enemy.position.x += this._lungeDir.x * lungeSpeed * dt;
        enemy.position.z += this._lungeDir.z * lungeSpeed * dt;
        enemy.rotation.x = -0.5;

        // collision with player
        const ldx = cam.position.x - enemy.position.x;
        const ldz = cam.position.z - enemy.position.z;
        const lDist = Math.sqrt(ldx*ldx + ldz*ldz);
        if (lDist < 1.5) {
          enemy.rotation.x = 0;
          this._takeDamage(1);
          this._endAttack();
          return;
        }
      }

      // combo mid-swing damage check (active phase only)
      if (this._currentAttack === 'combo' && this._attackPhase === 'active') {
        this._checkComboHit();
      }

      // tail sweep — rotate during active
      if (this._currentAttack === 'tail' && this._attackPhase === 'active') {
        this._tailGroup.rotation.y += dt * 8;
      }

      if (this._attackTimer <= 0) {
        if (this._attackPhase === 'telegraph') {
          this._executeAttack();
        } else if (this._attackPhase === 'active') {
          this._endAttack();
        }
      }
      return;
    }

    // ── IDLE ANIMATION
    if (!this._bossStunned) {
      const breathAmt = this._phase2 ? 0.07 : 0.05;
      enemy.position.y = Math.sin(t * 1.3) * breathAmt;
      this._weaponGroup.rotation.z = Math.sin(t * 2.2) * 0.14;
      this._weaponGroup.position.y = 1.3 + Math.sin(t * 1.5) * 0.1;
      this._crownLight.intensity = 1.5 + Math.sin(t * 2.8) * 0.5;
    }

    if (this._bossStunned) {
      enemy.rotation.z = Math.sin(t * 14) * 0.14;
      this._crownLight.intensity = 0.3 + Math.random() * 0.8;
    }

    this._attackCooldown -= dt;

    // ── MOVEMENT
    if (!this._bossStunned) {
      const baseSpeed = this._phase2 ? 2.8 : 1.8;
      const aggression = (8 - this._bossHealth) * 0.18;
      const speed = baseSpeed + aggression;

      if (dist > 5.0) {
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
    }

    // ── TRIGGER ATTACK
    if (this._attackCooldown <= 0 && dist < 14 && !this._bossStunned) {
      const attack = this._selectAttack(dist);
      this._startAttack(attack);
    }

    // ── heartbeat
    this._heartbeatTimer -= dt;
    const hbRate = this._playerHealth === 1 ? 0.32 : this._playerHealth === 2 ? 0.5 : 0.9;
    if (this._heartbeatTimer <= 0) {
      this._heartbeatTimer = hbRate;
      this.engine.audio.play('step');
    }

    // ── roar
    this._bossRoarTimer -= dt;
    if (this._bossRoarTimer <= 0) {
      this._bossRoarTimer = (this._phase2 ? 5 : 9) + Math.random() * 5;
      this.engine.audio.play('deny');
    }
  }

  _reset() {
    this._jumpscareTriggered = false;
    this._died = false;
    this._bossActive = false;
    this._bossHealth = 8;
    this._playerHealth = 5;
    this._flashTimer = 0;
    this._currentAttack = null;
    this._attackPhase = 'idle';
    this._attackTimer = 0;
    this._screenShake = 0;
    this._attackCooldown = 0;
    this._bossStunned = false;
    this._phase2 = false;
    this._stamina = 1.0;
    this._enemy.visible = false;
    this._enemy.position.set(0, 0, -8);
    this._enemy.rotation.set(0, 0, 0);
    this._tailGroup.rotation.y = 0;
    this._eyeLight.intensity = 0;
    this._weaponLight.intensity = 0;
    this._crownLight.intensity = 0;
    this._hideTelegraphs();
    this._fogDoor.visible = true;
    this._fogDoor2.visible = true;
    this._flashOverlay.style.background = 'rgba(0,0,0,0)';
    this._swordGroup.rotation.set(0.1, -0.2, 0.05);
    this._swordGroup.position.set(0.36, -0.30, -0.65);
    // clear projectiles
    this._projectiles.forEach(p => {
      this.scene.remove(p.mesh);
      this.scene.remove(p.light);
    });
    this._projectiles = [];
    if (this._staminaFill) this._staminaFill.style.width = '100%';
    if (this.fpCtrl) this.fpCtrl.teleport(0, 0, 16, Math.PI);
    this.engine.hud.setInfo(`
      <b style="color:#ffcc44">⚜ Stormveil Approach</b><br>
      <span style="opacity:0.65;font-size:12px">The bridge to the Fell Omen's lair</span><br>
      <span style="opacity:0.5;font-size:11px">F — attack &nbsp;·&nbsp; E — interact</span>
    `);
  }
}