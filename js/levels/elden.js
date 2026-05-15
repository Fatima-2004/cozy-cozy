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
    this._currentAttack = null;
    this._attackPhase = 'idle';
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
    this._birds = [];
    this._raindrops = [];
    this._windowGlows = [];
    this._banners = [];
    this._chainLinks = [];
    this._candleFlames = [];
  }

  init() {
    // ═══════════════════════════════════════════════════
    //  SKY — dramatic layered stormy sky with lightning glow
    // ═══════════════════════════════════════════════════
    this.scene.background = new THREE.Color(0x1a1e22);
    this.scene.fog = new THREE.FogExp2(0x2a2e30, 0.009);

    // ── LIGHTING — stormy overcast with occasional electric flicker
    const ambient = new THREE.AmbientLight(0x5a6068, 1.1);
    this.scene.add(ambient);

    // Main sun — barely cutting through storm clouds, cold & angular
    const sunLight = new THREE.DirectionalLight(0x8090a0, 1.3);
    sunLight.position.set(22, 42, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.setScalar(4096);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -60;
    sunLight.shadow.camera.right = sunLight.shadow.camera.top = 60;
    sunLight.shadow.bias = -0.0003;
    this.scene.add(sunLight);
    this._sunLight = sunLight;

    // Secondary light — warm amber from below (fire reflection off cobblestones)
    const fireReflect = new THREE.DirectionalLight(0xcc6622, 0.4);
    fireReflect.position.set(0, -5, 10);
    this.scene.add(fireReflect);

    // Cold fill from the side
    const fill = new THREE.DirectionalLight(0x607080, 0.5);
    fill.position.set(-25, 20, -15);
    this.scene.add(fill);

    const hemi = new THREE.HemisphereLight(0x404858, 0x302820, 0.8);
    this.scene.add(hemi);

    // Storm lightning ambient — flickers in update
    this._lightningLight = new THREE.PointLight(0xaabbff, 0, 200);
    this._lightningLight.position.set(0, 80, -60);
    this.scene.add(this._lightningLight);
    this._lightningTimer = 6 + Math.random() * 8;
    this._lightningFlash = 0;

    // ═══════════════════════════════════════════════════
    //  SKY DOME — layered clouds, storm, distant lightning
    // ═══════════════════════════════════════════════════
    const stoneMat = { matOpts: { roughness: 0.95, metalness: 0.05 } };
    const darkStoneMat = { matOpts: { roughness: 0.97, metalness: 0.04 } };
    const mossStoneMat = { matOpts: { roughness: 0.98, metalness: 0.02 } };

    // ── Sky backdrop gradient layers (render-order stacked)
    // Horizon glow band (sickly amber where fires reflect off low clouds)
    const horizonGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 40),
      new THREE.MeshBasicMaterial({ color: 0x3a2810, transparent: true, opacity: 0.7, depthWrite: false })
    );
    horizonGlow.position.set(0, 8, -200);
    horizonGlow.renderOrder = -10;
    this.scene.add(horizonGlow);

    // Upper sky — deep storm grey-purple
    const upperSky = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 200),
      new THREE.MeshBasicMaterial({ color: 0x0e1018, transparent: true, opacity: 0.9, depthWrite: false })
    );
    upperSky.position.set(0, 100, -200);
    this.scene.add(upperSky);

    // ── STORM CLOUD LAYERS (multiple depths, densities)
    const cloudDefs = [
      // [x, y, z, w, h, opacity, color, speed]
      [-80, 60, -180, 120, 35, 0.72, 0x1a1e22, 0.05],
      [ 40, 55, -170, 140, 28, 0.65, 0x22262a, 0.03],
      [-20, 75, -160, 100, 30, 0.80, 0x151820, 0.07],
      [ 90, 65, -155, 110, 25, 0.60, 0x1e2228, 0.04],
      [-50, 50, -150, 160, 22, 0.55, 0x282c32, 0.06],
      [  0, 80, -145, 130, 32, 0.75, 0x141618, 0.05],
      [ 60, 45, -130, 90,  20, 0.50, 0x20242a, 0.08],
      [-90, 70, -140, 80,  26, 0.62, 0x1c2024, 0.04],
      // mid-distance, slightly lighter (backlit)
      [-10, 42, -120, 80,  18, 0.45, 0x303840, 0.09],
      [ 50, 38, -115, 70,  16, 0.42, 0x2a3038, 0.07],
      [-60, 35, -110, 90,  14, 0.38, 0x343c44, 0.06],
    ];
    cloudDefs.forEach(([x, y, z, w, h, op, col, spd]) => {
      const mat = new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: op, depthWrite: false
      });
      const cloud = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      cloud.position.set(x, y, z);
      cloud.rotation.x = -0.05 + Math.random() * 0.1;
      this.scene.add(cloud);
      this._clouds.push({ mesh: cloud, vx: spd * (Math.random() > 0.5 ? 1 : -1), baseOpacity: op });
    });

    // ── Volumetric god-rays (light cutting through storm)
    for (let i = 0; i < 14; i++) {
      const angle = -0.3 + (Math.random() - 0.5) * 0.5;
      const shaft = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5 + Math.random() * 3, 60 + Math.random() * 40),
        new THREE.MeshBasicMaterial({
          color: i < 5 ? 0xd4c8a0 : 0x8a9890,
          transparent: true,
          opacity: 0.03 + Math.random() * 0.05,
          depthWrite: false
        })
      );
      shaft.position.set(-35 + i * 6, 25 + Math.random() * 15, -50 - Math.random() * 30);
      shaft.rotation.z = angle;
      shaft.rotation.y = (Math.random() - 0.5) * 0.3;
      this.scene.add(shaft);
      this._lightShafts.push(shaft);
    }

    // ── Distant lightning silhouettes (background mountains/ruins)
    // Distant mountain range (barely visible through haze)
    const mountainDefs = [
      [-180, 0, -300, 80, 55],
      [-100, 0, -310, 60, 42],
      [ -40, 0, -320, 70, 60],
      [  30, 0, -315, 55, 48],
      [ 100, 0, -305, 75, 52],
      [ 170, 0, -295, 65, 45],
      [ -70, 0, -280, 90, 38],
      [  80, 0, -285, 85, 42],
    ];
    mountainDefs.forEach(([x, y, z, w, h]) => {
      const mtn = new THREE.Mesh(
        new THREE.ConeGeometry(w * 0.6, h, 5 + Math.floor(Math.random() * 3)),
        new THREE.MeshBasicMaterial({ color: 0x0d0f12, transparent: true, opacity: 0.85 })
      );
      mtn.position.set(x, h / 2 - 5, z);
      this.scene.add(mtn);
      // snow caps faintly visible
      if (h > 48) {
        const cap = new THREE.Mesh(
          new THREE.ConeGeometry(w * 0.12, h * 0.15, 5),
          new THREE.MeshBasicMaterial({ color: 0x6070788, transparent: true, opacity: 0.25 })
        );
        cap.position.set(x, h * 0.88, z);
        this.scene.add(cap);
      }
    });

    // ── Distant ruined city silhouette on horizon
    const cityDefs = [
      [-130, -295, 5, 18],[-120, -292, 4, 24],[-110, -290, 6, 14],[-100, -288, 4, 20],
      [ -90, -293, 5, 16],[ -80, -291, 3, 22],[ -70, -289, 7, 28],[ -60, -294, 5, 18],
      [ -50, -292, 4, 12],[ -40, -290, 8, 32],[ -30, -288, 5, 18],[ -20, -286, 4, 24],
      [ -10, -284, 6, 36],  [0, -282, 8, 42],  [10, -284, 5, 26],  [20, -286, 6, 18],
      [  30, -288, 4, 14],  [40, -290, 5, 22],  [50, -292, 7, 30],  [60, -294, 4, 18],
      [  70, -290, 5, 16],  [80, -292, 3, 20],  [90, -288, 6, 24], [100, -290, 5, 18],
      [ 110, -293, 4, 14], [120, -291, 6, 20], [130, -295, 5, 16],
    ];
    cityDefs.forEach(([x, z, w, h]) => {
      Build.box(this.scene, x, h / 2, z, w, h, w * 0.9, 0x0a0c0e);
      // faint glowing window
      if (Math.random() > 0.6) {
        const gl = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 0.5),
          new THREE.MeshBasicMaterial({ color: 0xcc5511, transparent: true, opacity: 0.35 + Math.random() * 0.3 })
        );
        gl.position.set(x, h * 0.4 + Math.random() * h * 0.4, z + w * 0.46);
        this.scene.add(gl);
      }
    });

    // ═══════════════════════════════════════════════════
    //  THE STORMVEIL CASTLE FACADE — massively detailed
    // ═══════════════════════════════════════════════════

    // ── OUTER LOWER WALL — massive stone foundation
    Build.box(this.scene, 0, 2, -34, 68, 4, 5, 0x2c2a26, darkStoneMat);   // base plinth
    Build.box(this.scene, 0, 0.5, -32, 72, 1, 3, 0x222018, stoneMat);     // ground-level berm
    // stone beveling on the plinth
    Build.box(this.scene, 0, 4.1, -32, 68, 0.4, 4.2, 0x38342e, { noOutline: true }); // ledge
    Build.box(this.scene, 0, 0.8, -32, 70, 0.5, 5.2, 0x1e1c18, { noOutline: true }); // base trim

    // main outer wall — massive (62 wide, 38 tall)
    Build.box(this.scene, 0, 19, -32, 62, 38, 3.5, 0x3e3a34, stoneMat);
    // inner wall surface (slightly forward, lighter tone)
    Build.box(this.scene, 0, 18, -30.2, 58, 34, 0.4, 0x48443e, stoneMat);

    // ── Horizontal stone band courses (gives the wall depth and age)
    [-0.5, 4.5, 9.5, 14.5, 19.5, 24.5, 29.5, 34.0].forEach(y => {
      Build.box(this.scene, 0, y, -30, 60, 0.28, 0.8, 0x2c2822, { noOutline: true });
    });

    // ── Vertical stone quoins (corner stones with alternating depths)
    [-30, 30].forEach(qx => {
      for (let y = 1; y < 38; y += 1.4) {
        const deep = y % 2.8 < 1.4;
        Build.box(this.scene, qx, y, -30.2, deep ? 1.2 : 0.9, 0.9, deep ? 1.5 : 1.1, 0x322e28, { noOutline: true });
      }
    });

    // ── BATTLEMENTS — layered and detailed
    for (let x = -29; x <= 29; x += 2.2) {
      // main merlon
      Build.box(this.scene, x, 37.5, -30.2, 1.4, 2.8, 1.2, 0x2e2c28, { noOutline: true });
      // merlon cap
      Build.box(this.scene, x, 38.95, -30.2, 1.5, 0.22, 1.4, 0x26241e, { noOutline: true });
      // arrow slit in merlon
      Build.box(this.scene, x, 37.8, -30.1, 0.25, 1.4, 0.3, 0x0c0a08, { noOutline: true });
    }
    // battlement walkway
    Build.box(this.scene, 0, 35.8, -30.5, 60, 0.35, 1.8, 0x302c26, { noOutline: true });
    // inner parapet wall
    Build.box(this.scene, 0, 36.5, -29.4, 60, 1.5, 0.35, 0x383430, { noOutline: true });

    // ── MASSIVE TOWERS (gothic — wider, taller, more articulated)
    const towerDefs = [
      [-27, 5.5, 56, 7.5, 'L'],
      [-16, 5.0, 50, 6.5, 'L'],
      [  0, 6.5, 62, 9.0, 'C'], // central — tallest
      [ 16, 5.0, 50, 6.5, 'R'],
      [ 27, 5.5, 56, 7.5, 'R'],
      [-22, 4.0, 44, 5.5, 'L'],
      [ 22, 4.0, 44, 5.5, 'R'],
      [-12, 3.5, 38, 5.0, 'L'],  // inner towers, slightly behind
      [ 12, 3.5, 38, 5.0, 'R'],
    ];

    towerDefs.forEach(([x, w, h, d, side]) => {
      const isCenter = side === 'C';
      const col = isCenter ? 0x3a3630 : 0x3c3a34;

      // ── Foundation batter (sloped base widening)
      Build.box(this.scene, x, 1, -30, w + 2.0, 2, w * 0.95 + 1.5, 0x2e2c28, stoneMat);
      Build.box(this.scene, x, 3, -30, w + 1.0, 3, w * 0.95 + 0.8, 0x322e2a, stoneMat);

      // ── Main tower shaft
      const { mesh: towerMesh } = Build.box(this.scene, x, h / 2, -30, w, h, w * 0.95, col, stoneMat);
      towerMesh.castShadow = true;
      this.collidables.push(new THREE.Box3().setFromObject(towerMesh));

      // ── Horizontal bands on tower
      [h * 0.25, h * 0.5, h * 0.75].forEach(bh => {
        Build.box(this.scene, x, bh, -29.8, w + 0.5, 0.3, w + 0.3, 0x2a2824, { noOutline: true });
      });

      // ── Pilaster strips (vertical articulation)
      [-w * 0.35, 0, w * 0.35].forEach(ox => {
        Build.box(this.scene, x + ox, h / 2, -29.6, 0.35, h, 0.3, 0x2c2a26, { noOutline: true });
      });

      // ── Tower battlement collar (corbelled)
      Build.box(this.scene, x, h + 0.4, -30, w + 1.2, 0.5, w + 0.9, 0x2a2822, stoneMat);
      Build.box(this.scene, x, h + 0.9, -30, w + 0.8, 0.5, w + 0.6, 0x302c28, stoneMat);
      Build.box(this.scene, x, h + 1.4, -30, w + 0.4, 0.4, w + 0.3, 0x2e2a24, stoneMat);

      // ── Tower crenellations
      for (let cx = -w / 2 + 0.35; cx <= w / 2 - 0.35; cx += 1.2) {
        Build.box(this.scene, x + cx, h + 2.2, -30, 0.85, 1.8, 0.85, 0x242220, { noOutline: true });
        // merlon cap
        Build.box(this.scene, x + cx, h + 3.15, -30, 0.95, 0.18, 0.95, 0x1e1c1a, { noOutline: true });
      }

      // ── Tall spire on top (gothic tapered)
      const spireH = isCenter ? h * 0.7 : h * 0.5;
      const spireR = isCenter ? w * 0.42 : w * 0.38;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(spireR, spireH, isCenter ? 8 : 6),
        Anime.mat(0x1e1c1a, { roughness: 0.95 })
      );
      spire.position.set(x, h + 1.8 + spireH / 2, -30);
      this.scene.add(spire);

      // ── Finial at spire tip
      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 8, 6),
        Anime.metal(0x886600, { roughness: 0.4, metalness: 0.8 })
      );
      finial.position.set(x, h + 1.8 + spireH + 0.12, -30);
      this.scene.add(finial);

      // ── Cross element at top for central tower
      if (isCenter) {
        Build.box(this.scene, x, h + 1.8 + spireH * 0.85, -29.9, 1.6, 0.18, 0.18, 0x997700, { noOutline: true });
        Build.box(this.scene, x, h + 1.8 + spireH * 0.85 + 0.4, -29.9, 0.18, 0.8, 0.18, 0x997700, { noOutline: true });
      }

      // ── Gothic windows — tall lancet arches (multiple levels)
      const windowLevels = Math.floor(h / 8);
      for (let wl = 1; wl <= windowLevels; wl++) {
        const wy = (h / (windowLevels + 1)) * wl;
        // main window opening
        Build.box(this.scene, x, wy, -29.6, 0.8, 2.4, 0.35, 0x060504, { noOutline: true });
        // pointed arch top
        Build.box(this.scene, x, wy + 1.4, -29.6, 0.56, 0.6, 0.35, 0x060504, { noOutline: true });
        Build.box(this.scene, x, wy + 1.7, -29.6, 0.35, 0.4, 0.35, 0x060504, { noOutline: true });
        // window tracery (stone divider)
        Build.box(this.scene, x, wy + 0.5, -29.55, 0.06, 1.6, 0.1, 0x302c28, { noOutline: true });
        // warm glow from inside
        if (Math.random() > 0.3) {
          const wgl = Build.pointLight(this.scene, x, wy + 0.5, -29.4, 0xff6622, 0.6 + Math.random() * 0.6, 4);
          this._windowGlows.push({ light: wgl, base: wgl.intensity, phase: Math.random() * Math.PI * 2 });
        }
      }

      // ── Corbelled machicolations under battlements
      for (let cx = -w / 2 + 0.25; cx <= w / 2 - 0.25; cx += 0.9) {
        Build.box(this.scene, x + cx, h - 0.3, -29.7, 0.7, 0.6, 0.8, 0x28261e, { noOutline: true });
        // drop hole
        Build.box(this.scene, x + cx, h - 0.6, -29.6, 0.28, 0.4, 0.3, 0x0a0906, { noOutline: true });
      }
    });

    // ── GRAND CENTRAL ARCHWAY (the fog gate arch — massive and ornate)
    // Arch jambs
    Build.box(this.scene, -3.8, 7, -29.4, 1.0, 14, 0.5, 0x1a1816, stoneMat);
    Build.box(this.scene,  3.8, 7, -29.4, 1.0, 14, 0.5, 0x1a1816, stoneMat);
    // Voussoir stones of the arch (stepped)
    Build.box(this.scene,  0, 14.8, -29.4, 9.0, 1.4, 0.5, 0x1a1816, stoneMat);
    Build.box(this.scene,  0, 13.8, -29.4, 8.2, 0.6, 0.5, 0x201e1a, stoneMat);
    Build.box(this.scene,  0, 12.9, -29.4, 7.4, 0.6, 0.5, 0x201e1a, stoneMat);
    // Arch keystone (prominent)
    Build.box(this.scene, 0, 14.2, -29.3, 1.8, 2.0, 0.65, 0x2a2624, stoneMat);
    // Decorative boss at keystone
    const boss = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 8),
      Anime.mat(0x2e2a24, { roughness: 0.85 })
    );
    boss.position.set(0, 14.8, -29.1);
    this.scene.add(boss);

    // Arch moulding rings
    [-0.1, 0.25].forEach(off => {
      Build.box(this.scene, -3.8, 7, -29.4 + off, 0.2, 13.8, 0.06, 0x302c26, { noOutline: true });
      Build.box(this.scene,  3.8, 7, -29.4 + off, 0.2, 13.8, 0.06, 0x302c26, { noOutline: true });
    });

    // Inner arch darkness
    Build.box(this.scene, 0, 7, -29.55, 6.8, 13.5, 0.06, 0x050403, { noOutline: true });
    Build.pointLight(this.scene, 0, 5, -28, 0xff5522, 1.2, 10);
    Build.pointLight(this.scene, -2, 9, -28.5, 0xff3300, 0.5, 6);
    Build.pointLight(this.scene,  2, 9, -28.5, 0xff3300, 0.5, 6);

    // ── Portcullis (iron gate in the arch)
    for (let px = -3.2; px <= 3.2; px += 0.9) {
      Build.box(this.scene, px, 7.5, -29.5, 0.1, 13.5, 0.1, 0x222222, { noOutline: true });
    }
    for (let py = 1; py <= 12; py += 2.2) {
      Build.box(this.scene, 0, py, -29.5, 6.5, 0.1, 0.1, 0x222222, { noOutline: true });
    }
    // portcullis spikes
    for (let px = -3.0; px <= 3.0; px += 0.9) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.35, 4),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.8 })
      );
      spike.position.set(px, 0.2, -29.5);
      spike.rotation.x = Math.PI;
      this.scene.add(spike);
    }

    // ── Flanking statue niches in the arch wall
    [-2.2, 2.2].forEach((nx, idx) => {
      Build.box(this.scene, nx, 10, -29.6, 1.4, 3.5, 0.35, 0x1e1c18, { noOutline: true });
      // figure inside niche (abstract)
      Build.box(this.scene, nx, 9.8, -29.55, 0.5, 2.0, 0.3, 0x2a2622, { noOutline: true });
      Build.box(this.scene, nx, 11.6, -29.5, 0.55, 0.6, 0.45, 0x2a2622, { noOutline: true }); // head
      // candle at base of niche
      Build.box(this.scene, nx, 8.5, -29.4, 0.12, 0.3, 0.12, 0xd8c8a0, { noOutline: true });
      const clight = Build.pointLight(this.scene, nx, 8.9, -29.35, 0xff9933, 0.5, 3);
      this._windowGlows.push({ light: clight, base: 0.5, phase: Math.random() * Math.PI * 2 });
    });

    // ── GOTHIC PINNACLES along the wall top (dense decorative forest)
    for (let x = -28; x <= 28; x += 4.5) {
      const pinH = 4 + Math.random() * 3;
      const pin = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, pinH, 6),
        Anime.mat(0x222018, { roughness: 0.92 })
      );
      pin.position.set(x, 35 + pinH / 2, -30.3);
      this.scene.add(pin);
      // finial
      const pfinial = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6),
        Anime.metal(0x886600, { roughness: 0.5, metalness: 0.7 })
      );
      pfinial.position.set(x, 35 + pinH + 0.1, -30.3);
      this.scene.add(pfinial);
      // crockets (leaf decorations climbing pinnacle)
      for (let c = 0; c < 3; c++) {
        const crocket = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.22, 0.22),
          Anime.mat(0x2a2820, { roughness: 0.9 })
        );
        crocket.position.set(x + 0.28, 35 + (c + 1) * (pinH / 4), -30.3);
        crocket.rotation.z = 0.4;
        crocket.rotation.y = 0.5;
        this.scene.add(crocket);
      }
    }

    // ── WALL DECORATIONS — carved heraldic panels
    [[-20, 12], [-10, 11], [10, 12], [20, 11]].forEach(([x, y]) => {
      Build.box(this.scene, x, y, -30.2, 4, 6, 0.2, 0x34302a, { noOutline: true });
      Build.box(this.scene, x, y, -30.1, 3.4, 5.2, 0.08, 0x2e2a24, { noOutline: true });
      // carved cross / emblem
      Build.box(this.scene, x, y, -30.0, 2.0, 0.22, 0.1, 0x3a3630, { noOutline: true });
      Build.box(this.scene, x, y, -30.0, 0.22, 2.8, 0.1, 0x3a3630, { noOutline: true });
      // rune markings faintly glowing
      const rune = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 1.5),
        new THREE.MeshBasicMaterial({ color: 0x885500, transparent: true, opacity: 0.3 })
      );
      rune.position.set(x + 0.6, y, -29.95);
      this.scene.add(rune);
      this._runes.push({ mesh: rune, phase: Math.random() * Math.PI * 2 });
    });

    // ── GARGOYLES on tower corners (squat stone creatures)
    const gargoyleDefs = [
      [-27, 52, -30], [27, 52, -30],
      [-16, 46, -30], [16, 46, -30],
      [0, 58, -30],
    ];
    gargoyleDefs.forEach(([x, y, z]) => {
      // body
      Build.box(this.scene, x, y - 0.2, z - 0.1, 1.1, 0.8, 0.9, 0x2c2a24, { noOutline: true });
      // head
      Build.box(this.scene, x, y + 0.35, z + 0.3, 0.65, 0.55, 0.65, 0x2a2822, { noOutline: true });
      // horns
      const ghorn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 4), Anime.mat(0x222018));
      ghorn.position.set(x - 0.2, y + 0.65, z + 0.3);
      ghorn.rotation.z = -0.4;
      this.scene.add(ghorn);
      const ghorn2 = ghorn.clone();
      ghorn2.position.x = x + 0.2;
      ghorn2.rotation.z = 0.4;
      this.scene.add(ghorn2);
      // wings (flat planes angled out)
      [-1, 1].forEach(side => {
        const wing = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 0.7),
          new THREE.MeshStandardMaterial({ color: 0x242220, roughness: 0.98, side: THREE.DoubleSide })
        );
        wing.position.set(x + side * 0.9, y + 0.1, z - 0.3);
        wing.rotation.z = side * 0.6;
        wing.rotation.y = side * 0.4;
        this.scene.add(wing);
      });
      // eye glow (faint)
      Build.pointLight(this.scene, x, y + 0.4, z + 0.55, 0xff3300, 0.3, 3);
    });

    // ── CHAINS hanging from towers (enormous iron links)
    const chainDefs = [
      [-27, 50, -30, -14, 30],
      [ 27, 50, -30,  14, 30],
      [-16, 45, -30,  0, 25],
      [ 16, 45, -30,  0, 25],
    ];
    chainDefs.forEach(([x1, y1, z, x2, y2]) => {
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const t2 = i / steps;
        const cx = x1 + (x2 - x1) * t2;
        const cy = y1 + (y2 - y1) * t2 - Math.sin(t2 * Math.PI) * 10; // catenary sag
        const cz = z;
        const link = new THREE.Mesh(
          new THREE.TorusGeometry(0.2, 0.07, 5, 8),
          new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.5, metalness: 0.85 })
        );
        link.position.set(cx, cy, cz);
        link.rotation.z = i % 2 === 0 ? Math.PI / 2 : 0;
        this.scene.add(link);
      }
    });

    // ── HANGING BANNERS on the wall (torn, weather-beaten)
    [-24, -12, 0, 12, 24].forEach((bx, idx) => {
      const bannerH = 6 + Math.random() * 3;
      const bannerCol = idx === 2 ? 0x8a0808 : 0x6a0606; // central darkest red
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, bannerH),
        new THREE.MeshStandardMaterial({ color: bannerCol, roughness: 0.95, side: THREE.DoubleSide })
      );
      banner.position.set(bx, 28 - bannerH / 2, -29.9);
      this.scene.add(banner);
      this._banners.push({ mesh: banner, phase: Math.random() * Math.PI * 2, bx });
      // banner rod
      Build.box(this.scene, bx, 31.2, -29.7, 2.6, 0.12, 0.12, 0x444440, { noOutline: true });
      // horizontal stripes on banner (heraldic)
      Build.box(this.scene, bx, 28, -29.85, 2.2, 0.25, 0.05, 0xaa1010, { noOutline: true });
      // torn bottom edge
      for (let t = -0.9; t <= 0.9; t += 0.35) {
        const tear = new THREE.Mesh(
          new THREE.PlaneGeometry(0.28, 0.5 + Math.random() * 0.6),
          new THREE.MeshBasicMaterial({ color: bannerCol, side: THREE.DoubleSide })
        );
        tear.position.set(bx + t, 28 - bannerH - 0.1, -29.88);
        tear.rotation.z = (Math.random() - 0.5) * 0.6;
        this.scene.add(tear);
      }
    });

    // ── LARGE STAINED GLASS WINDOWS on the main wall (between towers)
    [[-10, 22, 3.5, 8], [10, 22, 3.5, 8], [0, 25, 2.5, 10]].forEach(([x, y, w, h]) => {
      // Stone frame
      Build.box(this.scene, x, y, -30.1, w + 0.6, h + 0.6, 0.3, 0x2a2622, stoneMat);
      // Tracery (stone dividers)
      Build.box(this.scene, x, y, -29.9, 0.1, h, 0.15, 0x302c28, { noOutline: true });
      Build.box(this.scene, x, y, -29.9, w, 0.1, 0.15, 0x302c28, { noOutline: true });
      // Glass panels (colored, glowing)
      const glassColors = [0x1a0000, 0x000f1a, 0x0a0a00, 0x1a000a];
      [[0, h * 0.25], [0, -h * 0.25]].forEach(([ox, oy]) => {
        const glass = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.45, h * 0.45),
          new THREE.MeshBasicMaterial({
            color: glassColors[Math.floor(Math.random() * glassColors.length)],
            transparent: true, opacity: 0.85
          })
        );
        glass.position.set(x + ox - w * 0.23, y + oy, -29.85);
        this.scene.add(glass);
        const glass2 = glass.clone();
        glass2.position.x = x + ox + w * 0.23;
        this.scene.add(glass2);
      });
      // Warm glow from behind
      Build.pointLight(this.scene, x, y, -29.5, 0xff5511, 0.8, 8);
    });

    // ── FLANKING SECONDARY WALLS with more detail
    [-35, 35].forEach(wx => {
      const side = wx < 0 ? -1 : 1;
      // main flanking wall
      Build.box(this.scene, wx, 7, -15, 4.5, 14, 35, 0x3c3a34, stoneMat);
      // batter at base
      Build.box(this.scene, wx, 2, -15, 5.5, 4, 36, 0x34322c, stoneMat);
      // horizontal courses
      [3.5, 7.5, 11.5].forEach(y => {
        Build.box(this.scene, wx, y, -15, 5.2, 0.3, 35.5, 0x2e2c28, { noOutline: true });
      });
      // crenellations along top
      for (let z = -30; z <= 0; z += 2.2) {
        Build.box(this.scene, wx, 15.2, z, 5.0, 2.2, 1.1, 0x302e2a, { noOutline: true });
        Build.box(this.scene, wx, 15.2, z, 5.4, 0.2, 1.3, 0x282622, { noOutline: true }); // cap
      }
      // wall walk platform
      Build.box(this.scene, wx, 14.2, -15, 4.5, 0.3, 35, 0x302e28, { noOutline: true });
      // small tower at the junction
      Build.box(this.scene, wx, 10, -31, 5.5, 20, 5.5, 0x38362e, stoneMat);
      const jspire = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 14, 6),
        Anime.mat(0x1c1a18, { roughness: 0.95 })
      );
      jspire.position.set(wx, 20 + 7, -31);
      this.scene.add(jspire);
      // arrow loops along flanking wall
      for (let az = -25; az <= -5; az += 5) {
        Build.box(this.scene, wx + side * (-2.15), 9, az, 0.1, 1.5, 0.35, 0x0a0806, { noOutline: true });
        Build.pointLight(this.scene, wx + side * (-1.8), 9, az, 0xff5500, 0.25, 4);
      }
    });

    // ── DISTANT CASTLE LAYERS (receding planes, increasingly hazy)
    const distantBuildDefs = [
      // [x, w, z, sw, sh, opacity]
      [-18, 8, -65, 5, 32, 0.9],
      [  8, 7, -70, 4, 26, 0.85],
      [-30, 6, -62, 4, 22, 0.9],
      [ 22, 6, -68, 4, 28, 0.85],
      [  0, 9, -75, 7, 38, 0.9],
      [-45, 5, -58, 4, 20, 0.92],
      [ 42, 5, -60, 4, 24, 0.88],
      // very distant
      [-55, 10, -120, 8, 50, 0.6],
      [ 40, 10, -115, 7, 44, 0.55],
      [ -5, 14, -130, 10, 60, 0.65],
      [ 25, 8,  -125, 6, 38, 0.58],
      [-30, 9,  -118, 7, 42, 0.62],
      [-70, 7,  -100, 5, 30, 0.70],
      [ 65, 6,  -105, 5, 28, 0.68],
    ];
    distantBuildDefs.forEach(([x, w, z, sw, sh, op]) => {
      const mat2 = new THREE.MeshBasicMaterial({ color: 0x0e1014, transparent: true, opacity: op });
      const towerB = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sw), mat2);
      towerB.position.set(x, sh / 2, z);
      this.scene.add(towerB);
      const spireMat = new THREE.MeshBasicMaterial({ color: 0x0a0c10, transparent: true, opacity: op * 0.95 });
      const spireB = new THREE.Mesh(new THREE.ConeGeometry(sw * 0.5, sh * 0.5, 5), spireMat);
      spireB.position.set(x, sh + sh * 0.25, z);
      this.scene.add(spireB);
      // faint window glow on distant towers
      if (Math.random() > 0.5) {
        const glowW = new THREE.Mesh(
          new THREE.PlaneGeometry(0.6, 0.4),
          new THREE.MeshBasicMaterial({ color: 0xcc4400, transparent: true, opacity: 0.4 * op })
        );
        glowW.position.set(x, sh * 0.4 + Math.random() * sh * 0.3, z + sw * 0.51);
        this.scene.add(glowW);
      }
    });

    // ═══════════════════════════════════════════════════
    //  GROUND — richly detailed mossy stone bridge
    // ═══════════════════════════════════════════════════
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2e2c24,
      roughness: 0.97,
      metalness: 0.03,
      roughnessMap: Anime.roughnessTex(20, 512),
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(72, 72, 40, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // ── Large stone slabs (the actual flagstones — irregular sizes)
    const slabDefs = [
      [-6, -4, 3.8, 3.2], [0, -4, 4.0, 3.5], [6, -4, 3.5, 3.0],
      [-8, 0, 3.2, 3.8],  [-2, 0, 4.2, 3.5],  [4, 0, 3.8, 3.2],  [10, 0, 3.2, 3.6],
      [-10, 4, 3.6, 3.2], [-4, 4, 3.8, 3.5],   [2, 4, 4.0, 3.2],   [8, 4, 3.5, 3.8],
    ];
    const slabMat = new THREE.MeshBasicMaterial({ color: 0x26241e, transparent: true, opacity: 0.4, depthWrite: false });
    slabDefs.forEach(([x, z, w, d]) => {
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(w, d), slabMat);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set(x, 0.001, z);
      this.scene.add(slab);
    });

    // ── Stone joint grid (two scales for depth)
    const jointMat = new THREE.MeshBasicMaterial({ color: 0x0e0c0a, transparent: true, opacity: 0.75 });
    for (let x = -34; x <= 34; x += 4) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 70), jointMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.002, 0);
      this.scene.add(line);
    }
    for (let z = -34; z <= 34; z += 4) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(70, 0.07), jointMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.002, z);
      this.scene.add(line);
    }
    // Sub-joints (smaller scale)
    const subJointMat = new THREE.MeshBasicMaterial({ color: 0x161410, transparent: true, opacity: 0.4 });
    for (let x = -34; x <= 34; x += 2) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 70), subJointMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.0015, 0);
      this.scene.add(line);
    }

    // ── Extensive moss/algae coverage (darkens near walls and cracks)
    const mossColors = [0x2a3018, 0x303818, 0x253015, 0x1e2812, 0x3a3820];
    for (let i = 0; i < 60; i++) {
      const w2 = 1.8 + Math.random() * 3.5;
      const d2 = 1.8 + Math.random() * 3.5;
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(w2, d2),
        new THREE.MeshBasicMaterial({
          color: mossColors[Math.floor(Math.random() * mossColors.length)],
          transparent: true, opacity: 0.5 + Math.random() * 0.3, depthWrite: false
        })
      );
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = Math.random() * Math.PI;
      patch.position.set((Math.random() - 0.5) * 60, 0.003, (Math.random() - 0.5) * 50);
      this.scene.add(patch);
    }

    // ── Dark water puddles (reflecting sky)
    const puddleMat = new THREE.MeshBasicMaterial({ color: 0x181c20, transparent: true, opacity: 0.65, depthWrite: false });
    const puddlePositions = [
      [-8, 3, 1.5], [5, -4, 1.2], [12, 6, 0.9], [-14, -2, 1.4],
      [3, 10, 1.1], [-6, -8, 0.8], [18, -3, 1.3], [-20, 5, 1.0],
      [8, -10, 0.7], [-3, 7, 1.6], [14, 2, 0.9], [-10, 12, 1.2],
    ];
    puddlePositions.forEach(([x, z, r]) => {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(r, 16), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(x, 0.003, z);
      this.scene.add(puddle);
      // faint reflection glow in puddle from torches
      Build.pointLight(this.scene, x, 0.1, z, 0xff5500, 0.08, 3);
    });

    // ── GRASS TUFTS — dense and detailed
    const grassMats = [
      new THREE.MeshBasicMaterial({ color: 0x485828, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0x526230, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0x3e5020, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0x5a6a34, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0x384820, side: THREE.DoubleSide }),
    ];
    for (let i = 0; i < 340; i++) {
      const x = (Math.random() - 0.5) * 62;
      const z = (Math.random() - 0.5) * 58;
      if (Math.abs(x) < 3.5 && Math.abs(z) < 3.5) continue;
      const cluster = 2 + Math.floor(Math.random() * 5);
      for (let c = 0; c < cluster; c++) {
        const mat = grassMats[Math.floor(Math.random() * grassMats.length)];
        const h = 0.15 + Math.random() * 0.45;
        for (let p = 0; p < 3; p++) { // 3 crossed planes per blade cluster
          const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.07, h), mat);
          blade.position.set(
            x + (Math.random() - 0.5) * 0.4,
            h / 2,
            z + (Math.random() - 0.5) * 0.4
          );
          blade.rotation.y = (p / 3) * Math.PI + Math.random() * 0.3;
          blade.rotation.z = (Math.random() - 0.5) * 0.2;
          this.scene.add(blade);
          this._grassTufts.push({ mesh: blade, baseRot: blade.rotation.y, phase: Math.random() * Math.PI * 2 });
        }
      }
    }

    // ── Tall weeds and dead flowers (scattered in cracks)
    for (let i = 0; i < 80; i++) {
      const x = (Math.random() - 0.5) * 58;
      const z = (Math.random() - 0.5) * 52;
      if (Math.abs(x) < 4.5 && Math.abs(z) < 4.5) continue;
      const stalkH = 0.4 + Math.random() * 0.55;
      const stalk = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, stalkH, 0.035),
        new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x586030 : 0x485028 })
      );
      stalk.position.set(x, stalkH / 2, z);
      stalk.rotation.z = (Math.random() - 0.5) * 0.25;
      this.scene.add(stalk);
      // small leaves
      [-0.15, 0.15].forEach(lx => {
        const leaf = new THREE.Mesh(
          new THREE.PlaneGeometry(0.15, 0.12),
          new THREE.MeshBasicMaterial({ color: 0x485028, side: THREE.DoubleSide })
        );
        leaf.position.set(x + lx, stalkH * 0.55, z);
        leaf.rotation.z = lx * 3;
        this.scene.add(leaf);
      });
      if (Math.random() > 0.45) {
        const flowerType = Math.random();
        const fcolor = flowerType > 0.66 ? 0xcc9922 : flowerType > 0.33 ? 0xaa4422 : 0x887744;
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 6, 4),
          new THREE.MeshBasicMaterial({ color: fcolor })
        );
        flower.position.set(x, stalkH + 0.07, z);
        this.scene.add(flower);
      }
    }

    // ── Crack networks with ember/lava glow
    const crackMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.35, depthWrite: false });
    const crackGlowMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.2, depthWrite: false });
    const crackNetworks = [
      [[0,0],[2.5,2],[5,3.5],[7,5.5]],
      [[0,0],[-2,1.8],[-4.5,3.2],[-6.5,2.5]],
      [[0,0],[1.5,-2.5],[3.5,-4.5],[5,-7]],
      [[0,0],[-1.8,-2],[-3.5,-4],[-4.5,-6.5]],
      [[-7,4],[-9,3.5],[-11,5],[-13,4.5]],
      [[7,-4],[9,-3],[11,-4.5],[13,-3.5]],
      [[-5,-8],[-7,-7],[-9,-8.5]],
      [[4.5,7],[6.5,8.5],[8,10]],
      [[-12,8],[-14,6.5],[-16,8]],
      [[10,5],[12,7],[14,6],[16,8]],
      [[-2,12],[-4,10.5],[-6,12],[-7,10]],
      [[1,-9],[3,-11],[5,-10],[7,-12]],
    ];
    crackNetworks.forEach(pts => {
      pts.forEach(([x2, z2], i) => {
        if (i === 0) return;
        const px = pts[i - 1][0], pz = pts[i - 1][1];
        const len = Math.sqrt((x2 - px) ** 2 + (z2 - pz) ** 2);
        const angle = Math.atan2(z2 - pz, x2 - px);
        [crackGlowMat, crackMat].forEach((mat, mi) => {
          const crack = new THREE.Mesh(
            new THREE.PlaneGeometry(len, mi === 0 ? 0.12 : 0.04),
            mat
          );
          crack.rotation.x = -Math.PI / 2;
          crack.rotation.z = -angle;
          crack.position.set((x2 + px) / 2, 0.004 + mi * 0.001, (z2 + pz) / 2);
          this.scene.add(crack);
        });
        // ember glow along crack
        if (Math.random() > 0.6) {
          Build.pointLight(this.scene, (x2 + px) / 2, 0.1, (z2 + pz) / 2, 0xff3300, 0.4 + Math.random() * 0.4, 2);
        }
      });
    });

    // ═══════════════════════════════════════════════════
    //  ARENA BOUNDARIES
    // ═══════════════════════════════════════════════════
    [
      new THREE.Box3(new THREE.Vector3(-38, -1, -34), new THREE.Vector3(-33, 15, 22)),
      new THREE.Box3(new THREE.Vector3(33, -1, -34), new THREE.Vector3(38, 15, 22)),
      new THREE.Box3(new THREE.Vector3(-38, -1, -34), new THREE.Vector3(38, 40, -31)),
      new THREE.Box3(new THREE.Vector3(-38, -1, 21), new THREE.Vector3(38, 15, 24)),
    ].forEach(b => this.collidables.push(b));

    // ═══════════════════════════════════════════════════
    //  MIST / FOG LAYERS — heavy volumetric atmosphere
    // ═══════════════════════════════════════════════════
    // Ground-hugging fog (dense near edges)
    for (let i = 0; i < 50; i++) {
      const ang = (i / 50) * Math.PI * 2;
      const r = 20 + Math.random() * 10;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(10 + Math.random() * 8, 2.5 + Math.random() * 2),
        new THREE.MeshBasicMaterial({ color: 0x80888c, transparent: true, opacity: 0.08 + Math.random() * 0.1, depthWrite: false })
      );
      m.position.set(Math.cos(ang) * r, 0.3 + Math.random() * 1.5, Math.sin(ang) * r - 4);
      m.rotation.y = ang;
      this.scene.add(m);
      this._mistPlanes.push(m);
    }
    // Additional heavy front mist
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(12 + Math.random() * 10, 8 + Math.random() * 6),
        new THREE.MeshBasicMaterial({ color: 0x70787c, transparent: true, opacity: 0.12 + Math.random() * 0.1, depthWrite: false })
      );
      m.position.set((Math.random() - 0.5) * 60, 3 + Math.random() * 6, 22 + Math.random() * 8);
      this.scene.add(m);
      this._mistPlanes.push(m);
    }
    // Low ceiling haze overhead
    for (let i = 0; i < 15; i++) {
      const hazeM = new THREE.Mesh(
        new THREE.PlaneGeometry(25 + Math.random() * 20, 15 + Math.random() * 10),
        new THREE.MeshBasicMaterial({ color: 0x606870, transparent: true, opacity: 0.06 + Math.random() * 0.06, depthWrite: false })
      );
      hazeM.rotation.x = -Math.PI / 2;
      hazeM.position.set((Math.random() - 0.5) * 50, 25 + Math.random() * 10, (Math.random() - 0.5) * 40 - 10);
      this.scene.add(hazeM);
      this._mistPlanes.push(hazeM);
    }

    // ═══════════════════════════════════════════════════
    //  SCATTERED RUINS — more diverse, denser
    // ═══════════════════════════════════════════════════

    // ── Elaborate pillar set (varying heights, some toppled)
    const pillarDefs = [
      [-12, -10, 1.1, 8.5, false],
      [ 12, -10, 1.1, 7.0, true ],
      [-18,  -2, 1.0, 9.5, false],
      [ 18,  -2, 1.0, 6.5, true ],
      [-14,   8, 1.0, 7.0, true ],
      [ 14,   8, 1.0, 8.5, false],
      [-22,   4, 0.9, 5.5, true ],
      [ 22,   4, 0.9, 6.0, false],
      [-8,   -6, 0.8, 5.0, true ],
      [ 8,   -6, 0.8, 4.5, false],
      [-26,  -4, 0.9, 7.5, false],
      [ 26,  -4, 0.9, 7.5, true ],
    ];

    pillarDefs.forEach(([x, z, w, h, broken]) => {
      // Layered base
      Build.box(this.scene, x, 0, z, w + 0.7, 0.35, w + 0.7, 0x282624);
      Build.box(this.scene, x, 0.35, z, w + 0.5, 0.22, w + 0.5, 0x2c2a24);
      Build.box(this.scene, x, 0.57, z, w + 0.3, 0.18, w + 0.3, 0x2e2c28);

      const { mesh } = Build.box(this.scene, x, 0.75, z, w, h, w, 0x3c3a32);
      mesh.castShadow = true;
      this.collidables.push(new THREE.Box3().setFromObject(mesh));

      // Entasis (slight taper — narrower at top)
      Build.box(this.scene, x, 0.75 + h * 0.75, z, w * 0.88, h * 0.25, w * 0.88, 0x383632);

      // Fluting (vertical grooves)
      for (let f = 0; f < 6; f++) {
        const ang = (f / 6) * Math.PI * 2;
        const fx = x + Math.cos(ang) * (w * 0.52);
        const fz = z + Math.sin(ang) * (w * 0.52);
        Build.box(this.scene, fx, 0.75 + h * 0.5, fz, 0.06, h, 0.06, 0x282622, { noOutline: true });
      }

      // Heavy moss coverage
      [0.3, 0.45, 0.6].forEach(ht => {
        Build.box(this.scene, x + w * 0.52, 0.75 + h * ht, z, 0.02, 1.0, w * 0.6, 0x3a4c1e, { noOutline: true });
        Build.box(this.scene, x, 0.75 + h * (ht + 0.08), z + w * 0.52, w * 0.55, 0.5, 0.02, 0x3a4c1e, { noOutline: true });
      });

      if (!broken) {
        Build.box(this.scene, x, 0.75 + h, z, w + 0.4, 0.35, w + 0.4, 0x2e2c28);
        Build.box(this.scene, x, 0.75 + h + 0.35, z, w + 0.6, 0.22, w + 0.6, 0x2a2826);
      } else {
        // Shattered top — more fragments
        for (let s = 0; s < 6; s++) {
          const sh = 0.5 + Math.random() * 1.2;
          const { mesh: sm } = Build.box(
            this.scene, x + (Math.random() - 0.5) * w * 1.6, 0.75 + h + s * 0.08,
            z + (Math.random() - 0.5) * w * 1.6, w * 0.55, sh, w * 0.55, 0x2e2c28, { noOutline: true }
          );
          sm.rotation.z = (Math.random() - 0.5) * 0.8;
          sm.rotation.x = (Math.random() - 0.5) * 0.5;
        }
        // Rubble scatter with blood stains
        for (let r = 0; r < 12; r++) {
          const rs = 0.12 + Math.random() * 0.45;
          Build.box(this.scene, x + (Math.random() - 0.5) * 3, 0, z + (Math.random() - 0.5) * 3, rs * 1.6, rs * 0.5, rs, 0x232120, { noOutline: true });
        }
        // Blood stain at base
        const bm = new THREE.MeshBasicMaterial({ color: 0x2a0000, transparent: true, opacity: 0.4, depthWrite: false });
        const bp = new THREE.Mesh(new THREE.CircleGeometry(0.8 + Math.random() * 0.6, 10), bm);
        bp.rotation.x = -Math.PI / 2;
        bp.position.set(x, 0.005, z);
        this.scene.add(bp);
      }
    });

    // ── Toppled pillar (lying on ground — dramatic)
    {
      const { mesh: fallM } = Build.box(this.scene, 16, 0.45, 12, 1.0, 9, 1.0, 0x383630);
      fallM.rotation.z = Math.PI / 2;
      fallM.castShadow = true;
      this.collidables.push(new THREE.Box3().setFromObject(fallM));
      // crush debris under it
      for (let r = 0; r < 8; r++) {
        Build.box(this.scene, 14 + Math.random() * 4, 0, 11 + Math.random() * 2, 0.3 + Math.random() * 0.5, 0.2 + Math.random() * 0.3, 0.3 + Math.random() * 0.5, 0x252320, { noOutline: true });
      }
    }

    // ── FALLEN STATUE — much more detailed (full body, heroic scale)
    const statueX = -19;
    Build.box(this.scene, statueX, 0.4, 14, 5.5, 0.9, 2.0, 0x3a3832); // torso
    Build.box(this.scene, statueX + 0.5, 1.2, 14, 0.8, 0.75, 0.8, 0x3a3832); // head, tilted
    Build.box(this.scene, statueX + 0.5, 1.85, 14, 0.55, 0.65, 0.55, 0x383630); // crown section
    Build.box(this.scene, statueX - 2.0, 0.5, 13.6, 1.6, 0.6, 0.65, 0x3a3832); // left arm
    Build.box(this.scene, statueX + 2.6, 0.45, 14.4, 1.3, 0.55, 0.6, 0x3a3832); // right arm
    Build.box(this.scene, statueX - 0.45, 0.35, 15.4, 0.7, 0.7, 1.8, 0x3a3832); // left leg
    Build.box(this.scene, statueX + 0.45, 0.35, 15.2, 0.7, 0.7, 1.6, 0x383630); // right leg
    // broken-off foot
    Build.box(this.scene, statueX - 0.5, 0.18, 17, 0.65, 0.36, 0.9, 0x302e2a);
    // statue plinth (still standing)
    Build.box(this.scene, statueX - 3, 1.5, 14, 2.5, 3, 2.5, 0x2e2c28);
    Build.box(this.scene, statueX - 3, 0.3, 14, 3, 0.6, 3, 0x262420);
    // plinth inscription
    const inscr = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x887766, transparent: true, opacity: 0.4 })
    );
    inscr.position.set(statueX - 3, 1.5, 12.53);
    this.scene.add(inscr);
    // heavy moss on statue
    Build.box(this.scene, statueX, 0.87, 14, 4.5, 0.06, 1.8, 0x3a4c1e, { noOutline: true });

    // ── ALTAR / SHRINE (small, near north wall)
    Build.box(this.scene, -8, 0, -22, 3, 0.5, 2, 0x2c2a24);
    Build.box(this.scene, -8, 0.5, -22, 2.6, 0.8, 1.6, 0x302e28);
    Build.box(this.scene, -8, 1.3, -22, 2.4, 0.1, 1.4, 0x383632);
    // Offering bowl
    const bowlRing = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 8, 16), Anime.metal(0x554400, { roughness: 0.4, metalness: 0.8 }));
    bowlRing.rotation.x = Math.PI / 2;
    bowlRing.position.set(-8, 1.5, -22);
    this.scene.add(bowlRing);
    Build.pointLight(this.scene, -8, 1.7, -22, 0xff7700, 0.8, 4);
    const altarFlame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.9 }));
    altarFlame.position.set(-8, 1.7, -22);
    this.scene.add(altarFlame);
    this._torchLights.push({ light: { intensity: 0.8 }, base: 0.8, phase: Math.random() * Math.PI * 2, flame: altarFlame });
    // altar candles
    [-1, 0, 1].forEach(cx => {
      Build.box(this.scene, -8 + cx * 0.7, 1.35, -22 + 0.5, 0.09, 0.25, 0.09, 0xd8c89a, { noOutline: true });
      const cl = Build.pointLight(this.scene, -8 + cx * 0.7, 1.65, -22 + 0.5, 0xffaa44, 0.3, 2.5);
      this._windowGlows.push({ light: cl, base: 0.3, phase: Math.random() * Math.PI * 2 });
      const cfm = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 5), new THREE.MeshBasicMaterial({ color: 0xffcc55, transparent: true, opacity: 0.9 }));
      cfm.position.set(-8 + cx * 0.7, 1.68, -22 + 0.5);
      this.scene.add(cfm);
    });

    // ── BROKEN ARCHWAY spanning the arena (aesthetic ruin mid-field)
    Build.box(this.scene, 20, 0, 8, 1.2, 0.3, 1.2, 0x2c2a22);
    Build.box(this.scene, 20, 0.3, 8, 1.0, 8, 1.0, 0x363430);  // left jamb
    Build.box(this.scene, 24, 0, 8, 1.2, 0.3, 1.2, 0x2c2a22);
    Build.box(this.scene, 24, 0.3, 8, 1.0, 6, 1.0, 0x363430);  // right jamb (broken shorter)
    Build.box(this.scene, 22, 8.7, 8, 4.8, 1.0, 1.0, 0x2e2c28); // lintel (slightly tilted)
    // crumbled top
    for (let r = 0; r < 6; r++) {
      Build.box(this.scene, 20 + Math.random() * 4, 6 + Math.random() * 2, 7 + Math.random() * 2, 0.4 + Math.random() * 0.6, 0.3 + Math.random() * 0.5, 0.4 + Math.random() * 0.6, 0x252320, { noOutline: true });
    }

    // ── Scattered debris, war relics
    // Broken shield face-down
    Build.box(this.scene, 5, 0.06, -8, 1.5, 0.12, 1.2, 0x444240);
    Build.box(this.scene, 5, 0.13, -8, 1.3, 0.06, 0.05, 0x333130);
    // Helmet lying sideways
    Build.box(this.scene, -7, 0.2, 11, 0.65, 0.55, 0.7, 0x3a3836);
    Build.box(this.scene, -7.1, 0.5, 11, 0.2, 0.35, 0.65, 0x323030); // visor
    // Lantern on the ground
    Build.box(this.scene, 11, 0.2, -4, 0.35, 0.5, 0.35, 0x444240);
    Build.box(this.scene, 11, 0.05, -4, 0.4, 0.1, 0.4, 0x3a3836);
    Build.pointLight(this.scene, 11, 0.4, -4, 0xff8822, 0.5, 3);
    // Tipped cauldron
    const cauldronRing = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 8, 16), Anime.mat(0x2a2826, { roughness: 0.6, metalness: 0.7 }));
    cauldronRing.rotation.z = Math.PI / 2.5;
    cauldronRing.position.set(-16, 0.35, -6);
    this.scene.add(cauldronRing);
    Build.pointLight(this.scene, -16, 0.5, -6, 0xff4400, 0.6, 4);
    // Scattered scrolls/books
    [[14, -8], [-9, -12], [7, 15]].forEach(([x2, z2]) => {
      Build.box(this.scene, x2, 0.04, z2, 0.6, 0.08, 0.9, 0x4a4030);
      Build.box(this.scene, x2 + 0.1, 0.04, z2 - 0.2, 0.5, 0.05, 0.7, 0x5a5040);
    });

    // ── Skulls (more, and skull piles)
    for (let i = 0; i < 30; i++) {
      const x2 = (Math.random() - 0.5) * 50;
      const z2 = (Math.random() - 0.5) * 40;
      if (Math.abs(x2) < 4.5 && Math.abs(z2) < 4.5) continue;
      const s = 0.20 + Math.random() * 0.14;
      Build.box(this.scene, x2, s * 0.45, z2, s * 1.3, s, s * 1.15, 0x1a1620);
      Build.box(this.scene, x2, s * 0.95, z2, s * 0.85, s * 0.75, s * 0.9, 0x201c28);
      // jaw
      Build.box(this.scene, x2, s * 0.15, z2 + s * 0.3, s * 0.8, s * 0.3, s * 0.6, 0x181420);
    }
    // Skull pile in corner
    [[-2, 3], [0, 3], [2, 3], [-1, 3.5], [1, 3.5]].forEach(([ox, oy]) => {
      Build.box(this.scene, -28 + ox, oy * 0.22, -20, 0.32, 0.24, 0.28, 0x1a1620);
    });

    // ── Weapons stuck in ground
    [[-8, 5], [6, -3], [10, 8], [-12, -6], [15, -2], [-5, -15], [20, -10]].forEach(([x2, z2]) => {
      Build.box(this.scene, x2, 1.0, z2, 0.06, 2.0, 0.04, 0x888aaa, { noOutline: true });
      Build.box(this.scene, x2, 0.3, z2, 0.4, 0.05, 0.05, 0x665500, { noOutline: true });
      // small glow from rune-etched blade
      if (Math.random() > 0.5) {
        Build.pointLight(this.scene, x2, 1.0, z2, 0x4466ff, 0.15, 2);
      }
    });

    // ── STAIRS — more elaborate, with cracks
    [
      [0, 0, -27, 9, 0.35, 3.5],
      [0, 0.35, -25.2, 8, 0.35, 2.8],
      [0, 0.7, -23.6, 7, 0.35, 2.3],
      [0, 1.05, -22.2, 6, 0.35, 2.0],
    ].forEach(([x2, y, z2, w, h, d]) => {
      Build.box(this.scene, x2, y, z2, w, h, d, 0x383432, stoneMat);
      // edge trim
      Build.box(this.scene, x2, y + h / 2, z2 - d / 2, w + 0.2, h * 0.15, 0.15, 0x2e2c28, { noOutline: true });
    });
    // Side rails on stairs
    [-4.5, 4.5].forEach(sx => {
      Build.box(this.scene, sx, 0.4, -25, 0.25, 0.8, 6, 0x302e28, stoneMat);
      // finial on top
      const sfin = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), Anime.mat(0x2a2824, { roughness: 0.9 }));
      sfin.position.set(sx, 0.95, -22.5);
      this.scene.add(sfin);
    });

    // ── BRAZIERS — larger and more ornate
    [[-6, -23.5], [6, -23.5], [-10, -15], [10, -15]].forEach(([x2, z2], idx) => {
      // tripod legs
      [0, 1, 2].forEach(leg => {
        const ang = (leg / 3) * Math.PI * 2;
        Build.box(this.scene, x2 + Math.cos(ang) * 0.5, 0.5, z2 + Math.sin(ang) * 0.5, 0.1, 1.2, 0.1, 0x222020, { noOutline: true });
      });
      // basin
      const basinRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.1, 8, 16),
        Anime.mat(0x2a2824, { roughness: 0.5, metalness: 0.75 })
      );
      basinRing.rotation.x = Math.PI / 2;
      basinRing.position.set(x2, 1.3, z2);
      this.scene.add(basinRing);
      Build.box(this.scene, x2, 1.1, z2, 0.95, 0.4, 0.95, 0x242220);
      // fire
      const flameC = 0xff7733;
      Build.pointLight(this.scene, x2, 1.9, z2, flameC, idx < 2 ? 3.0 : 2.0, 10 + idx * 2);
      const bfl = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.65, 6),
        new THREE.MeshBasicMaterial({ color: flameC, transparent: true, opacity: 0.88 })
      );
      bfl.position.set(x2, 1.7, z2);
      this.scene.add(bfl);
      const innerF = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.45, 5),
        new THREE.MeshBasicMaterial({ color: 0xffee66, transparent: true, opacity: 0.95 })
      );
      innerF.position.set(x2, 1.85, z2);
      this.scene.add(innerF);
      const bl2 = Build.pointLight(this.scene, x2, 1.9, z2, flameC, idx < 2 ? 3.0 : 2.0, 10);
      this._torchLights.push({ light: bl2, base: bl2.intensity, phase: Math.random() * Math.PI * 2, isBrazier: true, flame: bfl, innerFlame: innerF });
    });

    // ── WALL TORCHES — more of them, in sconces
    [-22, -14, -6, 6, 14, 22].forEach(x2 => {
      // sconce bracket
      Build.box(this.scene, x2, 5.2, -29.3, 0.4, 0.15, 0.6, 0x2a2622, { noOutline: true });
      Build.box(this.scene, x2, 5.0, -29.1, 0.3, 0.55, 0.3, 0x2a2622, { noOutline: true });
      Build.box(this.scene, x2, 4.7, -28.85, 0.12, 0.65, 0.12, 0x2c2820, { noOutline: true });
      const wl = Build.pointLight(this.scene, x2, 5.6, -28.7, 0xff6622, 1.6, 9);
      const fl3 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 5), new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.92 }));
      fl3.position.set(x2, 5.72, -28.7);
      this.scene.add(fl3);
      const innerF2 = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), new THREE.MeshBasicMaterial({ color: 0xffee55, transparent: true, opacity: 0.95 }));
      innerF2.position.set(x2, 5.8, -28.7);
      this.scene.add(innerF2);
      this._torchLights.push({ light: wl, base: 1.6, phase: Math.random() * Math.PI * 2, flame: fl3, innerFlame: innerF2 });
    });

    // ── Ground torches along the path
    [[-4, 5], [4, 5], [-7, 0], [7, 0], [-4, -5], [4, -5]].forEach(([x2, z2]) => {
      Build.box(this.scene, x2, 0, z2, 0.12, 1.6, 0.12, 0x282420, { noOutline: true });
      Build.box(this.scene, x2, 1.6, z2, 0.18, 0.25, 0.18, 0x222018, { noOutline: true });
      const gl2 = Build.pointLight(this.scene, x2, 2.0, z2, 0xff7722, 0.9, 5);
      const gfl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.88 }));
      gfl.position.set(x2, 1.95, z2);
      this.scene.add(gfl);
      this._torchLights.push({ light: gl2, base: 0.9, phase: Math.random() * Math.PI * 2, flame: gfl });
    });

    // ═══════════════════════════════════════════════════
    //  BIRDS — crows circling the towers
    // ═══════════════════════════════════════════════════
    for (let i = 0; i < 20; i++) {
      const bird = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.28), new THREE.MeshBasicMaterial({ color: 0x111010 }));
      bird.add(body);
      [-1, 1].forEach(side => {
        const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.12), new THREE.MeshBasicMaterial({ color: 0x0e0d0d, side: THREE.DoubleSide }));
        wing.position.set(side * 0.28, 0, 0);
        bird.add(wing);
        this._birds.push({ wing, side, phase: Math.random() * Math.PI * 2 });
      });
      const radius = 15 + Math.random() * 20;
      const height = 30 + Math.random() * 28;
      bird.position.set(
        Math.cos(Math.random() * Math.PI * 2) * radius,
        height,
        -20 + Math.sin(Math.random() * Math.PI * 2) * radius
      );
      this.scene.add(bird);
      this._birds.push({ group: bird, angle: Math.random() * Math.PI * 2, r: radius, h: height, speed: 0.3 + Math.random() * 0.3, centerX: 0, centerZ: -15 });
    }

    // ═══════════════════════════════════════════════════
    //  RAIN — light drizzle (visual layer only)
    // ═══════════════════════════════════════════════════
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 800;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 60;
      rainPos[i * 3 + 1] = Math.random() * 30;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 60 - 5;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0x8899aa, size: 0.04, transparent: true, opacity: 0.35 });
    this._rain = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this._rain);
    this._rainPositions = rainPos;

    // ═══════════════════════════════════════════════════
    //  FOG DOOR
    // ═══════════════════════════════════════════════════
    const fogGeo = new THREE.PlaneGeometry(6.5, 13.5);
    const fogMat = new THREE.MeshBasicMaterial({
      color: 0x5522cc, transparent: true, opacity: 0.45,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this._fogDoor = new THREE.Mesh(fogGeo, fogMat);
    this._fogDoor.position.set(0, 6.75, -29.2);
    this.scene.add(this._fogDoor);

    const fogGeo2 = new THREE.PlaneGeometry(6.3, 13.2);
    const fogMat2 = new THREE.MeshBasicMaterial({
      color: 0x9944ff, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this._fogDoor2 = new THREE.Mesh(fogGeo2, fogMat2);
    this._fogDoor2.position.set(0, 6.75, -29.18);
    this.scene.add(this._fogDoor2);

    // Fog door particle streams (vertical wisps)
    for (let wi = -3; wi <= 3; wi += 0.8) {
      const wispP = Build.particles(this.scene, 15, 6.5, 0xaa66ff, 0.05);
      wispP.mesh.position.set(wi, 5, -29.0);
      this.fx.registerParticles(wispP);
    }

    this.fx.registerParticles(Build.particles(this.scene, 80, 4.5, 0xaa66ff, 0.07));
    Build.label(this.scene, '[E] Enter the fog', 0, 14.5, -28.5, '#cc99ff');
    Build.pointLight(this.scene, 0, 7, -28, 0x7733ff, 4.0, 12);
    Build.pointLight(this.scene, -3, 4, -28.5, 0x5522dd, 1.5, 6);
    Build.pointLight(this.scene,  3, 4, -28.5, 0x5522dd, 1.5, 6);
    this._fogDoor.userData.onInteract = () => this._enterFog();
    this.interactables.push(this._fogDoor);

    // ═══════════════════════════════════════════════════
    //  SITE OF GRACE
    // ═══════════════════════════════════════════════════
    Build.box(this.scene, 0, 0, 14, 2.2, 0.22, 2.2, 0x4a4438);
    Build.box(this.scene, 0, 0.22, 14, 1.8, 0.2, 1.8, 0x504840);
    Build.box(this.scene, 0, 0.42, 14, 1.4, 0.32, 1.4, 0x585048);
    Build.box(this.scene, 0, 0.74, 14, 1.0, 0.14, 1.0, 0x5e5650);
    Build.box(this.scene, 0, 0.88, 14, 0.28, 0.55, 0.28, 0x504840);
    Build.box(this.scene, 0, 1.43, 14, 0.65, 0.14, 0.65, 0x6a5e48);
    // small rune carvings around the base
    [0, 1, 2, 3].forEach(i => {
      const ang = (i / 4) * Math.PI * 2;
      const rm = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.8),
        new THREE.MeshBasicMaterial({ color: 0xccaa00, transparent: true, opacity: 0.25 })
      );
      rm.position.set(Math.cos(ang) * 1.1, 0.55, 14 + Math.sin(ang) * 1.1);
      rm.rotation.y = ang + Math.PI;
      this.scene.add(rm);
      this._runes.push({ mesh: rm, phase: (i / 4) * Math.PI * 2 });
    });

    this._graceLight = Build.pointLight(this.scene, 0, 1.5, 14, 0xffcc44, 6.0, 22);
    // Secondary ambient grace glow
    Build.pointLight(this.scene, 0, 0.5, 14, 0xff9900, 1.5, 8);

    const graceMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 24, 24),
      Anime.glow(0xffee88, 5.0)
    );
    graceMesh.position.set(0, 1.68, 14);
    this.scene.add(graceMesh);
    Anime.outline(graceMesh, 0.1, 0x443300);
    this.fx.registerItem(graceMesh);
    this._graceMesh = graceMesh;

    this._graceRays = [];
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const len = 2 + (i % 4) * 0.5;
      const ray = new THREE.Mesh(
        new THREE.PlaneGeometry(0.05, len),
        new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })
      );
      ray.position.set(Math.cos(angle) * 0.22, 1.68 + len / 2, 14 + Math.sin(angle) * 0.22);
      ray.rotation.y = angle;
      ray.rotation.x = 0.1;
      this.scene.add(ray);
      this._graceRays.push({ mesh: ray, angle, phase: (i / 16) * Math.PI * 2 });
    }

    this._graceOrbs = [];
    for (let i = 0; i < 8; i++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 10, 10),
        Anime.glow(0xffcc33, 3.0)
      );
      this.scene.add(orb);
      this._graceOrbs.push({ mesh: orb, angle: (i / 8) * Math.PI * 2, r: 0.45 + (i % 3) * 0.2, vy: (i % 4) * 0.35 });
    }

    graceMesh.userData.onInteract = () => this._tryWin();
    this.interactables.push(graceMesh);
    Build.label(this.scene, 'Site of Grace', 0, 3.2, 14, '#ffdd88');

    // ═══════════════════════════════════════════════════
    //  PARTICLES
    // ═══════════════════════════════════════════════════
    this.fx.registerParticles(Build.particles(this.scene, 240, 32, 0xb0ac9a, 0.05));  // ash
    this.fx.registerParticles(Build.particles(this.scene, 140, 28, 0x8a9078, 0.04));  // dust
    this.fx.registerParticles(Build.particles(this.scene, 70,  20, 0xffcc66, 0.06));  // sparks
    this.fx.registerParticles(Build.particles(this.scene, 80,  25, 0xddccaa, 0.04));  // motes
    this.fx.registerParticles(Build.particles(this.scene, 50,  18, 0x4488aa, 0.035)); // cold mist wisps

    // ═══════════════════════════════════════════════════
    //  MARGIT — THE FELL OMEN  (unchanged from original)
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

    const hips = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 0.75), robeMat);
    hips.position.set(0, 1.05, 0);
    enemyGroup.add(hips);

    [-0.55, 0, 0.55].forEach((ox, i) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.25, 0.22), darkRobe2);
      panel.position.set(ox, 0.4, 0.1 + i * 0.06);
      panel.rotation.x = -0.08 + i * 0.04;
      enemyGroup.add(panel);
    });
    const backDrape = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.18), darkRobe2);
    backDrape.position.set(0, 0.35, -0.38);
    enemyGroup.add(backDrape);

    [-0.5, 0.5].forEach((lx) => {
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.55), robeMat);
      thigh.position.set(lx, 0.2, 0.05); thigh.rotation.x = 0.08;
      enemyGroup.add(thigh);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.95, 0.38), darkMat);
      shin.position.set(lx, -0.6, 0.12); shin.rotation.x = -0.05;
      enemyGroup.add(shin);
      const ankle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.32), bandageMat);
      ankle.position.set(lx, -1.1, 0.15);
      enemyGroup.add(ankle);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.22, 0.65), darkMat);
      foot.position.set(lx + lx * 0.08, -1.25, 0.22);
      enemyGroup.add(foot);
      for (let f = 0; f < 3; f++) {
        const tclaw = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 5), Anime.mat(0x0a0808));
        tclaw.position.set(lx + (f - 1) * 0.12, -1.38, 0.5); tclaw.rotation.x = -0.5;
        enemyGroup.add(tclaw);
      }
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.9, 0.92), robeMat);
    torso.position.set(0, 2.1, 0); torso.rotation.x = 0.14;
    enemyGroup.add(torso);
    Anime.outline(torso, 0.04, 0x000000);

    const chestArmour = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.55), darkMat);
    chestArmour.position.set(0, 2.2, 0.22); chestArmour.rotation.x = 0.14;
    enemyGroup.add(chestArmour);
    const chestH = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.6), bandageMat);
    chestH.position.set(0, 2.5, 0.18); enemyGroup.add(chestH);
    const chestV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.6), bandageMat);
    chestV.position.set(0, 2.0, 0.18); enemyGroup.add(chestV);
    const medalH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.06), goldMat);
    medalH.position.set(0, 2.55, 0.5); enemyGroup.add(medalH);
    const medalV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.06), goldMat);
    medalV.position.set(0, 2.45, 0.5); enemyGroup.add(medalV);

    const cloakBack = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.2, 0.15), cloakMat);
    cloakBack.position.set(0, 1.8, -0.5); cloakBack.rotation.x = -0.05;
    enemyGroup.add(cloakBack);
    [-0.7, -0.3, 0.3, 0.7].forEach(ox => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6 + Math.random() * 0.4, 0.1), cloakMat);
      strip.position.set(ox, 0.5, -0.55); strip.rotation.z = ox * 0.1;
      enemyGroup.add(strip);
    });
    [-1, 1].forEach(side => {
      const drape = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 0.12), cloakMat);
      drape.position.set(side * 1.05, 2.0, -0.25); drape.rotation.z = side * 0.08;
      enemyGroup.add(drape);
    });

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.35), fleshMat);
    neck.position.set(0, 3.1, 0.08); enemyGroup.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.08, 0.82), fleshMat);
    head.position.set(0, 3.45, 0.12); enemyGroup.add(head);
    Anime.outline(head, 0.045, 0x000000);

    [-0.38, 0.38].forEach(ox => {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.18), fleshMat);
      cheek.position.set(ox, 3.32, 0.42); enemyGroup.add(cheek);
    });
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.22), darkMat);
    brow.position.set(0, 3.7, 0.4); brow.rotation.x = -0.18; enemyGroup.add(brow);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.24), fleshMat);
    nose.position.set(0, 3.3, 0.5); enemyGroup.add(nose);

    const bigHornL = new THREE.Group();
    const blS1 = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.55, 6), hornMat); blS1.position.y = 0.27; bigHornL.add(blS1);
    const blS2 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 6), hornMat); blS2.position.set(-0.1, 0.75, -0.1); blS2.rotation.z = 0.4; bigHornL.add(blS2);
    const blS3 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 6), hornMat); blS3.position.set(-0.28, 1.15, -0.22); blS3.rotation.z = 0.85; bigHornL.add(blS3);
    const blS4 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 5), hornMat); blS4.position.set(-0.5, 1.42, -0.3); blS4.rotation.z = 1.3; bigHornL.add(blS4);
    bigHornL.position.set(-0.32, 3.92, 0.05); bigHornL.rotation.z = -0.15; enemyGroup.add(bigHornL);

    const bigHornR = new THREE.Group();
    const brS1 = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 6), hornMat); brS1.position.y = 0.25; bigHornR.add(brS1);
    const brS2 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), hornMat); brS2.position.set(0.07, 0.7, 0.1); brS2.rotation.z = -0.3; bigHornR.add(brS2);
    const brS3 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.38, 6), hornMat); brS3.position.set(0.2, 1.05, 0.22); brS3.rotation.z = -0.7; bigHornR.add(brS3);
    bigHornR.position.set(0.32, 3.92, 0.05); bigHornR.rotation.z = 0.12; enemyGroup.add(bigHornR);

    const smallHorns = [
      [-0.12, 4.02, 0.22, 0.05, 0.3, 0.05, 0.1],
      [0.12, 4.02, 0.22, 0.05, 0.3, -0.05, 0.1],
      [-0.5, 3.55, 0.2, 0.05, 0.28, 0.7, 0.0],
      [0.5, 3.55, 0.2, 0.05, 0.28, -0.7, 0.0],
      [-0.55, 3.3, 0.25, 0.04, 0.22, 0.85, 0.0],
      [0.55, 3.3, 0.25, 0.04, 0.22, -0.85, 0.0],
      [0.0, 4.05, 0.3, 0.05, 0.25, 0.0, 0.25],
    ];
    smallHorns.forEach(([x2, y, z2, r, h, rz, rx]) => {
      const sh = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), hornMat);
      sh.position.set(x2, y, z2); sh.rotation.z = rz; sh.rotation.x = rx;
      enemyGroup.add(sh);
    });

    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.0, 0.22), bandageMat);
    beard.position.set(0, 2.72, 0.44); beard.rotation.x = 0.18; enemyGroup.add(beard);
    const beardSide = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.16), boneWhite);
    beardSide.position.set(0, 2.82, 0.4); enemyGroup.add(beardSide);
    const beardTail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.15), boneWhite);
    beardTail.position.set(0, 2.22, 0.42); beardTail.rotation.x = 0.3; enemyGroup.add(beardTail);
    const beardRing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.18), goldMat);
    beardRing.position.set(0, 2.45, 0.42); enemyGroup.add(beardRing);
    const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.2), bandageMat);
    mustache.position.set(0, 3.15, 0.46); enemyGroup.add(mustache);

    const eyeGlow = Anime.glow(0xffcc00, 6.0);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), eyeGlow);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.2, 3.5, 0.46); eyeR.position.set(0.2, 3.5, 0.46);
    enemyGroup.add(eyeL); enemyGroup.add(eyeR);
    this.fx.registerItem(eyeL); this.fx.registerItem(eyeR);

    const crownMat = Anime.glow(0xffaa00, 2.5);
    const crownH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.06), crownMat);
    crownH.position.set(0, 3.95, 0.42); enemyGroup.add(crownH);
    const crownV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.06), crownMat);
    crownV.position.set(0, 3.92, 0.42); enemyGroup.add(crownV);
    this._crownLight = Build.pointLight(this.scene, 0, 3.9, 0, 0xffaa00, 0, 2.5);

    [-1, 1].forEach(side => {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.58, 0.78), darkMat);
      shoulder.position.set(side * 1.15, 2.85, 0.04); enemyGroup.add(shoulder);
      Anime.outline(shoulder, 0.04);
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.84), goldMat);
      p1.position.set(side * 1.15, 3.18, 0.04); enemyGroup.add(p1);
      for (let s = 0; s < 3; s++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), hornMat);
        spike.position.set(side * 1.2 + (s - 1) * 0.18, 3.52, -0.1); spike.rotation.x = -0.2;
        enemyGroup.add(spike);
      }
      const uArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.95, 0.4), robeMat);
      uArm.position.set(side * 1.22, 2.2, 0.04); enemyGroup.add(uArm);
      const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.32), bandageMat);
      wrap.position.set(side * 1.27, 1.5, 0.08); enemyGroup.add(wrap);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), fleshMat);
      hand.position.set(side * 1.3, 0.85, 0.2); enemyGroup.add(hand);
      for (let f = 0; f < 4; f++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.32, 5), Anime.mat(0x0a0808));
        claw.position.set(side * (1.22 + (f - 1.5) * 0.1), 0.56, 0.28); claw.rotation.x = -0.45;
        enemyGroup.add(claw);
      }
    });

    const tailSegs = [
      [0.0, 0.55, -0.55, 0.30, 0.85],
      [0.25, 0.28, -1.15, 0.24, 0.72],
      [0.55, 0.14, -1.85, 0.18, 0.60],
      [0.88, 0.07, -2.45, 0.13, 0.50],
      [1.15, 0.04, -2.90, 0.09, 0.42],
    ];
    const tailGroup = new THREE.Group();
    tailSegs.forEach(([tx, ty, tz, tw, th]) => {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(tw, th, tw * 1.1), robeMat);
      seg.position.set(tx, ty, tz); tailGroup.add(seg);
    });
    const tailTip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 6), hornMat);
    tailTip.position.set(1.55, 0.03, -3.35); tailTip.rotation.z = Math.PI / 2;
    tailGroup.add(tailTip);
    enemyGroup.add(tailGroup);
    this._tailGroup = tailGroup;

    const tailGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0, depthWrite: false })
    );
    tailGlow.position.set(1.55, 0.03, -3.35);
    tailGroup.add(tailGlow);
    this._tailGlow = tailGlow;

    this._weaponGroup = new THREE.Group();
    const wHandle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.8, 0.13), goldMat);
    wHandle.position.y = -0.7; this._weaponGroup.add(wHandle);
    for (let w = 0; w < 4; w++) {
      const wrap2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.16), bandageMat);
      wrap2.position.y = -1.2 + w * 0.3; this._weaponGroup.add(wrap2);
    }
    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.25), goldMat);
    pommel.position.y = -1.6; this._weaponGroup.add(pommel);
    const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.42), Anime.glow(0xffcc00, 2.0));
    hHead.position.y = 0.45; this._weaponGroup.add(hHead);
    Anime.outline(hHead, 0.04, 0xaa6600);
    this._weaponLight = Build.pointLight(this.scene, 0, 0, 0, 0xffaa00, 0, 4);
    this._weaponGroup.position.set(1.7, 1.3, 0.55);
    enemyGroup.add(this._weaponGroup);

    enemyGroup.position.set(0, 0, -8);
    enemyGroup.visible = false;
    this._enemy = enemyGroup;
    this._eyeLight = Build.pointLight(this.scene, 0, 3.5, -8, 0xffcc00, 0, 6);

    // ── Telegraph visuals
    const slamRingMat = new THREE.MeshBasicMaterial({
      color: 0xff2200, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    });
    this._slamCircle = new THREE.Mesh(new THREE.RingGeometry(3.5, 4.5, 32), slamRingMat);
    this._slamCircle.rotation.x = -Math.PI / 2;
    this._slamCircle.position.y = 0.01;
    this._slamCircle.visible = false;
    this.scene.add(this._slamCircle);

    this._slamInner = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 32),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0, depthWrite: false })
    );
    this._slamInner.rotation.x = -Math.PI / 2;
    this._slamInner.position.y = 0.008;
    this._slamInner.visible = false;
    this.scene.add(this._slamInner);
    this._slamLight = Build.pointLight(this.scene, 0, 0.5, 0, 0xff3300, 0, 8);

    // ── Player sword
    this._swordGroup = new THREE.Group();
    const bladeMat2 = Anime.metal(0xaabbcc, { roughness: 0.12, metalness: 0.96 });
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.2, 0.04), bladeMat2);
    blade2.position.y = 0.62; this._swordGroup.add(blade2);
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.022, 1.0, 0.01), Anime.mat(0x889aaa));
    fuller.position.set(0, 0.62, 0.025); this._swordGroup.add(fuller);
    const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.07), Anime.metal(0x996600, { roughness: 0.3, metalness: 0.9 }));
    crossguard.position.y = 0.06; this._swordGroup.add(crossguard);
    const grip2 = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.4, 0.065), Anime.mat(0x3a2200, { roughness: 0.9 }));
    grip2.position.y = -0.22; this._swordGroup.add(grip2);
    const pommel2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), goldMat);
    pommel2.position.y = -0.45; this._swordGroup.add(pommel2);
    this._swordGroup.position.set(0.36, -0.30, -0.65);
    this._swordGroup.rotation.set(0.1, -0.2, 0.05);
    this.camera.add(this._swordGroup);
    this.scene.add(this.camera);

    // ── HUD
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
    this.engine.renderer.gl.toneMappingExposure = 0.75;
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
  //  PLAYER COMBAT (unchanged)
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
    const dist = Math.sqrt(dx * dx + dz * dz);
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
    this._currentAttack = null;
    this._attackPhase = 'idle';
    this._attackTimer = 0;
    this._attackCooldown = 1.8;
    this._hideTelegraphs();
    const ep = this._enemy.position;
    const cp = this.camera.position;
    const dx = ep.x - cp.x;
    const dz = ep.z - cp.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    ep.x = Math.max(-28, Math.min(28, ep.x + (dx / len) * 1.5));
    ep.z = Math.max(-26, Math.min(16, ep.z + (dz / len) * 1.5));
    ep.y = 0;
    this._enemy.rotation.x = 0; this._enemy.rotation.z = 0;
    this._hitText.style.opacity = '1';
    setTimeout(() => { this._hitText.style.opacity = '0'; }, 380);
    this.engine.audio.play('chop');
    this._weaponLight.intensity = 5;
    setTimeout(() => { this._weaponLight.intensity = 0; }, 180);
    this._screenShake = 0.3;
    if (this._bossHealth <= 0) { this._bossDefeated(); return; }
    if (this._bossHealth <= 4 && !this._phase2) { this._phase2 = true; this._enterPhase2(); }
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
    const bossHearts = '🟡'.repeat(this._bossHealth) + '⬛'.repeat(Math.max(0, 8 - this._bossHealth));
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

  _selectAttack(dist) {
    const r = Math.random();
    const p2 = this._phase2;
    if (dist < 3.5) {
      if (r < 0.35) return 'tail';
      if (r < 0.65) return 'combo';
      if (r < 0.85 && p2) return 'slam';
      return 'lunge';
    }
    if (dist < 7) {
      if (r < 0.40) return 'lunge';
      if (r < 0.70) return 'slam';
      if (r < 0.85 && p2) return 'throw';
      return 'combo';
    }
    if (p2 && r < 0.55) return 'throw';
    if (r < 0.70) return 'slam';
    return 'lunge';
  }

  _startAttack(type) {
    this._currentAttack = type;
    this._attackPhase = 'telegraph';
    switch (type) {
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
        const cp = this.camera.position;
        this._slamCircle.position.x = cp.x; this._slamCircle.position.z = cp.z;
        this._slamInner.position.x = cp.x;  this._slamInner.position.z = cp.z;
        this._slamCircle.visible = true; this._slamInner.visible = true;
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
    switch (type) {
      case 'lunge': {
        const cam = this.camera.position;
        const ep = this._enemy.position;
        const lx = cam.x - ep.x; const lz = cam.z - ep.z;
        const lLen = Math.sqrt(lx * lx + lz * lz) || 1;
        this._lungeDir.set(lx / lLen, 0, lz / lLen);
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
        this._slamLight.position.set(this._slamCircle.position.x, 0.5, this._slamCircle.position.z);
        this._slamLight.intensity = 12;
        this._screenShake = 0.7;
        this.engine.audio.play('deny');
        const cp2 = this.camera.position;
        const sx = this._slamCircle.position.x - cp2.x;
        const sz = this._slamCircle.position.z - cp2.z;
        if (Math.sqrt(sx * sx + sz * sz) < 4.5) this._takeDamage(2);
        break;
      }
      case 'combo': {
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
        this._tailGroup.rotation.y = Math.PI / 2;
        this._tailGlow.material.opacity = 0.5;
        this.engine.audio.play('whoosh');
        const cp3 = this.camera.position; const ep3 = this._enemy.position;
        const tdx = cp3.x - ep3.x; const tdz = cp3.z - ep3.z;
        if (Math.sqrt(tdx * tdx + tdz * tdz) < 3.8) this._takeDamage(1);
        break;
      }
      case 'throw': {
        this._attackTimer = 1.2;
        this._eyeLight.intensity = 5;
        this._weaponGroup.rotation.x = 0.3;
        this._weaponGroup.position.y = 1.3;
        this._spawnHammerProjectile();
        this.engine.audio.play('deny');
        break;
      }
    }
  }

  _checkComboHit() {
    if (this._comboHitFlag) return;
    const cp = this.camera.position; const ep = this._enemy.position;
    const dx = cp.x - ep.x; const dz = cp.z - ep.z;
    if (Math.sqrt(dx * dx + dz * dz) < 3.2) { this._takeDamage(1); this._comboHitFlag = true; }
  }

  _spawnHammerProjectile() {
    const ep = this._enemy.position; const cam = this.camera.position;
    const dx = cam.x - ep.x; const dz = cam.z - ep.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const dir = new THREE.Vector3(dx / len, 0, dz / len);
    const proj = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), Anime.glow(0xffcc00, 3.0));
    proj.position.set(ep.x + dir.x * 1.5, 1.6, ep.z + dir.z * 1.5);
    this.scene.add(proj);
    const light = Build.pointLight(this.scene, proj.position.x, 1.6, proj.position.z, 0xffaa00, 3, 6);
    this._projectiles.push({ mesh: proj, light, dir, speed: 18, life: 1.4 });
  }

  _endAttack() {
    const type = this._currentAttack;
    switch (type) {
      case 'lunge':
        this._weaponGroup.rotation.x = 0; this._weaponGroup.position.z = 0.55;
        this._attackCooldown = this._phase2 ? 1.0 : 1.6; break;
      case 'slam':
        this._weaponGroup.rotation.x = 0; this._weaponGroup.position.y = 1.3;
        this._slamCircle.visible = false; this._slamInner.visible = false;
        this._slamCircle.material.opacity = 0; this._slamInner.material.opacity = 0;
        this._slamLight.intensity = 0;
        this._attackCooldown = this._phase2 ? 1.4 : 2.0; break;
      case 'combo':
        if (this._comboStep < 2) {
          this._comboStep++; this._comboHitFlag = false;
          this._attackPhase = 'telegraph'; this._attackTimer = 0.25;
          this._eyeLight.intensity = 8;
          const dir = this._comboStep % 2 === 0 ? -1 : 1;
          this._weaponGroup.rotation.x = -0.6; this._weaponGroup.rotation.z = dir * 0.5;
          this.engine.audio.play('whoosh');
          return;
        } else {
          this._weaponGroup.rotation.x = 0; this._weaponGroup.rotation.z = 0;
          this._attackCooldown = this._phase2 ? 1.2 : 1.8;
        } break;
      case 'tail':
        this._tailGroup.rotation.y = 0; this._tailGlow.material.opacity = 0;
        this._attackCooldown = this._phase2 ? 1.0 : 1.6; break;
      case 'throw':
        this._weaponGroup.rotation.x = 0; this._weaponGroup.position.y = 1.3;
        this._weaponLight.intensity = 0;
        this._attackCooldown = this._phase2 ? 1.3 : 2.0; break;
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

    // ── Stamina regen
    if (this._stamina < 1.0) {
      this._stamina = Math.min(1.0, this._stamina + dt * 0.4);
      if (this._staminaFill) this._staminaFill.style.width = `${this._stamina * 100}%`;
    }

    if (this._playerAttackCooldown > 0) this._playerAttackCooldown -= dt;
    if (this._bossStunned) {
      this._bossStunTimer -= dt;
      if (this._bossStunTimer <= 0) {
        this._bossStunned = false;
        this._enemy.rotation.x = 0; this._enemy.rotation.z = 0;
      }
    }

    // ── LIGHTNING STRIKES
    this._lightningTimer -= dt;
    if (this._lightningTimer <= 0) {
      this._lightningTimer = 8 + Math.random() * 15;
      this._lightningFlash = 0.15;
    }
    if (this._lightningFlash > 0) {
      this._lightningFlash -= dt;
      this._lightningLight.intensity = Math.max(0, this._lightningFlash * 60 * (0.5 + Math.random() * 0.5));
      if (this._lightningFlash <= 0) this._lightningLight.intensity = 0;
    }

    // ── Fog door pulse
    if (this._fogDoor?.visible) {
      this._fogDoor.material.opacity = 0.32 + 0.22 * Math.sin(t * 2.6);
      this._fogDoor2.material.opacity = 0.14 + 0.12 * Math.sin(t * 3.0 + 0.5);
      this._fogDoor.position.y = 6.75 + Math.sin(t * 1.1) * 0.05;
    }

    // ── Grace
    if (this._graceLight) this._graceLight.intensity = 4.5 + Math.sin(t * 2.1) * 1.5;
    if (this._graceRays) this._graceRays.forEach(({ mesh, phase }) => {
      mesh.material.opacity = 0.09 + 0.08 * Math.sin(t * 2.0 + phase);
    });
    if (this._graceOrbs) this._graceOrbs.forEach((orb, i) => {
      orb.angle += dt * (0.7 + i * 0.1);
      orb.mesh.position.set(
        Math.cos(orb.angle) * orb.r,
        1.68 + Math.sin(t * 1.2 + orb.vy) * 0.35,
        14 + Math.sin(orb.angle) * orb.r
      );
    });

    // ── Rune glows
    this._runes.forEach(({ mesh, phase }) => {
      mesh.material.opacity = 0.15 + 0.2 * Math.abs(Math.sin(t * 1.5 + phase));
    });

    // ── Window glows (subtle candle flicker)
    this._windowGlows.forEach(({ light, base, phase }) => {
      light.intensity = base * (0.75 + 0.3 * Math.sin(t * 6.0 + phase) + 0.1 * Math.sin(t * 17.0 + phase));
    });

    // ── Banners sway (wind)
    this._banners.forEach(({ mesh, phase }) => {
      mesh.rotation.z = Math.sin(t * 1.4 + phase) * 0.04;
      mesh.rotation.x = Math.sin(t * 0.9 + phase * 0.5) * 0.015;
    });

    // ── Torches flicker (dual flame layers)
    this._torchLights.forEach(({ light, base, phase, flame, innerFlame }) => {
      const flicker = base * (0.78 + 0.26 * Math.sin(t * 7.5 + phase) + 0.1 * Math.sin(t * 21 + phase * 2));
      light.intensity = flicker;
      if (flame) {
        flame.scale.y = 0.75 + 0.45 * Math.sin(t * 12 + phase);
        flame.scale.x = 0.65 + 0.4 * Math.sin(t * 9 + phase * 1.4);
      }
      if (innerFlame) {
        innerFlame.scale.y = 0.8 + 0.5 * Math.sin(t * 15 + phase * 1.2);
        innerFlame.position.y += Math.sin(t * 20 + phase) * 0.002;
      }
    });

    // ── Grass sway
    this._grassTufts.forEach(g => {
      g.mesh.rotation.y = g.baseRot + Math.sin(t * 1.8 + g.phase) * 0.18;
      g.mesh.rotation.z = Math.sin(t * 1.2 + g.phase * 0.7) * 0.08;
    });

    // ── Clouds drift (with subtle opacity breathe)
    this._clouds.forEach((c, i) => {
      c.mesh.position.x += c.vx * dt;
      if (c.mesh.position.x > 120) c.mesh.position.x = -120;
      if (c.mesh.position.x < -120) c.mesh.position.x = 120;
      c.mesh.material.opacity = c.baseOpacity * (0.9 + 0.1 * Math.sin(t * 0.3 + i));
    });

    // ── Light shafts shift with storm intensity
    this._lightShafts.forEach((shaft, i) => {
      shaft.material.opacity = 0.03 + 0.04 * Math.sin(t * 0.6 + i * 0.7);
    });

    // ── Mist drift
    this._mistPlanes.forEach((m, i) => {
      m.position.y += Math.sin(t * 0.45 + i * 0.3) * 0.003;
      m.position.x += Math.sin(t * 0.2 + i) * 0.005;
    });

    // ── Rain
    if (this._rain && this._rainPositions) {
      for (let i = 0; i < this._rainPositions.length / 3; i++) {
        this._rainPositions[i * 3 + 1] -= dt * 12;
        this._rainPositions[i * 3] += dt * 0.5; // slight wind angle
        if (this._rainPositions[i * 3 + 1] < 0) {
          this._rainPositions[i * 3 + 1] = 30;
          this._rainPositions[i * 3] = (Math.random() - 0.5) * 60;
          this._rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 5;
        }
      }
      this._rain.geometry.attributes.position.needsUpdate = true;
    }

    // ── Birds circling
    if (this._birds) {
      this._birds.forEach(birdObj => {
        if (!birdObj.group) {
          // wing flap data
          if (birdObj.wing) {
            birdObj.wing.rotation.z = birdObj.side * (0.3 + 0.5 * Math.abs(Math.sin(t * 5 + birdObj.phase)));
          }
        } else {
          birdObj.angle += dt * birdObj.speed;
          birdObj.group.position.set(
            birdObj.centerX + Math.cos(birdObj.angle) * birdObj.r,
            birdObj.h + Math.sin(t * 0.8 + birdObj.angle) * 2,
            birdObj.centerZ + Math.sin(birdObj.angle) * birdObj.r * 0.6
          );
          birdObj.group.rotation.y = -birdObj.angle + Math.PI / 2;
        }
      });
    }

    // ── Flash overlay fade
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) this._flashOverlay.style.background = 'rgba(0,0,0,0)';
    }

    // ── Screen shake
    if (this._screenShake > 0) {
      this._screenShake -= dt * 2.2;
      const s = Math.max(0, this._screenShake) * 0.08;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.4;
    }

    // ── Projectiles
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const p = this._projectiles[i];
      p.mesh.position.x += p.dir.x * p.speed * dt;
      p.mesh.position.z += p.dir.z * p.speed * dt;
      p.mesh.rotation.x += dt * 8; p.mesh.rotation.y += dt * 5;
      p.light.position.copy(p.mesh.position);
      p.life -= dt;
      const cam = this.camera.position;
      const pdx = p.mesh.position.x - cam.x; const pdz = p.mesh.position.z - cam.z;
      if (Math.sqrt(pdx * pdx + pdz * pdz) < 1.3) {
        this._takeDamage(1);
        this.scene.remove(p.mesh); this.scene.remove(p.light);
        this._projectiles.splice(i, 1); continue;
      }
      if (p.life <= 0 || Math.abs(p.mesh.position.x) > 35 || Math.abs(p.mesh.position.z) > 30) {
        this.scene.remove(p.mesh); this.scene.remove(p.light);
        this._projectiles.splice(i, 1);
      }
    }

    if (!this._bossActive || this._died) return;

    const enemy = this._enemy;
    const cam = this.camera;
    const dx = cam.position.x - enemy.position.x;
    const dz = cam.position.z - enemy.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    enemy.position.x = Math.max(-28, Math.min(28, enemy.position.x));
    enemy.position.z = Math.max(-26, Math.min(16, enemy.position.z));

    this._eyeLight.position.set(enemy.position.x, enemy.position.y + 3.5, enemy.position.z);
    this._crownLight.position.set(enemy.position.x, enemy.position.y + 3.8, enemy.position.z);
    this._weaponLight.position.set(
      enemy.position.x + 1.7 * Math.sin(enemy.rotation.y + Math.PI / 2),
      enemy.position.y + 1.9,
      enemy.position.z + 1.7 * Math.cos(enemy.rotation.y + Math.PI / 2)
    );

    enemy.rotation.y = Math.atan2(dx, dz);

    // ── Attack state machine
    if (this._currentAttack) {
      this._attackTimer -= dt;
      if (this._currentAttack === 'slam' && this._attackPhase === 'telegraph') {
        const progress = 1 - Math.max(0, this._attackTimer / 1.1);
        this._slamCircle.material.opacity = 0.4 + progress * 0.5;
        this._slamInner.material.opacity = 0.15 + progress * 0.35;
      }
      if (this._currentAttack === 'lunge' && this._attackPhase === 'active') {
        const lungeSpeed = this._phase2 ? 17 : 13;
        enemy.position.x += this._lungeDir.x * lungeSpeed * dt;
        enemy.position.z += this._lungeDir.z * lungeSpeed * dt;
        enemy.rotation.x = -0.5;
        const ldx = cam.position.x - enemy.position.x;
        const ldz = cam.position.z - enemy.position.z;
        if (Math.sqrt(ldx * ldx + ldz * ldz) < 1.5) {
          enemy.rotation.x = 0;
          this._takeDamage(1);
          this._endAttack();
          return;
        }
      }
      if (this._currentAttack === 'combo' && this._attackPhase === 'active') this._checkComboHit();
      if (this._currentAttack === 'tail' && this._attackPhase === 'active') this._tailGroup.rotation.y += dt * 8;
      if (this._attackTimer <= 0) {
        if (this._attackPhase === 'telegraph') this._executeAttack();
        else if (this._attackPhase === 'active') this._endAttack();
      }
      return;
    }

    // ── Idle animation
    if (!this._bossStunned) {
      enemy.position.y = Math.sin(t * 1.3) * (this._phase2 ? 0.07 : 0.05);
      this._weaponGroup.rotation.z = Math.sin(t * 2.2) * 0.14;
      this._weaponGroup.position.y = 1.3 + Math.sin(t * 1.5) * 0.1;
      this._crownLight.intensity = 1.5 + Math.sin(t * 2.8) * 0.5;
    }
    if (this._bossStunned) {
      enemy.rotation.z = Math.sin(t * 14) * 0.14;
      this._crownLight.intensity = 0.3 + Math.random() * 0.8;
    }

    this._attackCooldown -= dt;

    // ── Movement
    if (!this._bossStunned) {
      const baseSpeed = this._phase2 ? 2.8 : 1.8;
      const speed = baseSpeed + (8 - this._bossHealth) * 0.18;
      if (dist > 5.0) {
        enemy.position.x += (dx / dist) * speed * dt;
        enemy.position.z += (dz / dist) * speed * dt;
      } else if (dist > 3.2) {
        const perpX = -dz / dist; const perpZ = dx / dist;
        const side = Math.sin(t * 0.5) > 0 ? 1 : -1;
        enemy.position.x += perpX * speed * 0.85 * dt * side;
        enemy.position.z += perpZ * speed * 0.85 * dt * side;
      }
    }

    if (this._attackCooldown <= 0 && dist < 14 && !this._bossStunned) {
      this._startAttack(this._selectAttack(dist));
    }

    // ── Heartbeat
    this._heartbeatTimer -= dt;
    const hbRate = this._playerHealth === 1 ? 0.32 : this._playerHealth === 2 ? 0.5 : 0.9;
    if (this._heartbeatTimer <= 0) {
      this._heartbeatTimer = hbRate;
      this.engine.audio.play('step');
    }

    // ── Boss roar
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
    this._projectiles.forEach(p => { this.scene.remove(p.mesh); this.scene.remove(p.light); });
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