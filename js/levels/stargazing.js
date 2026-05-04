// ============================================================
//  STARRY PICNIC — levels/stargazing.js
//  Simple challenge: numbered stars appear in the sky,
//  click them in order 1 → 10 to complete the level.
// ============================================================
import { stargazingBackground } from '../backgrounds.js';
import * as THREE from 'three';
import { Level, Anime, Build } from '../engine.js';

const STAR_COUNT = 10;
const SKY_R      = 85;

// Spread stars around the sky at nice visible positions
const STAR_POSITIONS = [
  [30,  55], [70,  48], [120, 62], [160, 44], [200, 58],
  [240, 50], [280, 65], [310, 42], [350, 55], [40,  40],
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

export class Stargazing extends Level {

  constructor(engine) {
    super(engine);
    this._yaw        = 0;
    this._pitch      = 0.85;
    this._sens       = 0.003;
    this._nextStar   = 0;        // which star to click next (0-indexed)
    this._done       = false;
    this._starMeshes = [];       // { mesh, number }
    this._labels     = [];       // canvas label meshes
    this._ray        = new THREE.Raycaster();
    this._ray.far    = SKY_R + 10;
    this._hoveredStar = null;
    this._bgStarMeshes = [];
    this._fireflies    = [];
  }

  // ══════════════════════════════════════════════════════════
  init() {
    const s = this.scene;
    this._sky = stargazingBackground(s);
    this._buildSkyDome(s);
    this._buildBackgroundStars(s);
    this._buildMilkyWay(s);
    this._buildMoon(s);
    this._buildPark(s);
    this._buildPicnicScene(s);
    this._buildNumberedStars(s);
    this._buildFireflies(s);
  }

  _buildSkyDome(s) {
    s.add(new THREE.Mesh(
      new THREE.SphereGeometry(SKY_R + 2, 32, 16),
      new THREE.MeshBasicMaterial({ color: 0x04021a, side: THREE.BackSide })
    ));
  }

  _buildBackgroundStars(s) {
    const count = 1400;
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const az = Math.random() * Math.PI * 2;
      const el = Math.asin(Math.random());
      const r  = SKY_R - 1 + Math.random();
      pos[i*3]   = r * Math.cos(el) * Math.sin(az);
      pos[i*3+1] = r * Math.sin(el);
      pos[i*3+2] = r * Math.cos(el) * Math.cos(az);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    s.add(new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.45, sizeAttenuation: true, color: 0xffffff,
      transparent: true, opacity: 0.8,
    })));

    for (let i = 0; i < 50; i++) {
      const az = Math.random() * Math.PI * 2;
      const el = 0.1 + Math.random() * 1.3;
      const r  = SKY_R - 2;
      const m  = new THREE.Mesh(
        new THREE.SphereGeometry(0.22 + Math.random() * 0.18, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 + Math.random() * 0.4 })
      );
      m.position.set(r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az));
      m.userData.twinkleT     = Math.random() * Math.PI * 2;
      m.userData.twinkleSpeed = 0.8 + Math.random() * 1.4;
      s.add(m);
      this._bgStarMeshes.push(m);
    }
  }

  _buildMilkyWay(s) {
    const count = 600;
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t    = (i / count) * Math.PI * 2;
      const band = (Math.random() - 0.5) * 0.26;
      const el   = Math.sin(t) * 0.5 + band + 0.28;
      if (el < 0.05) { pos[i*3] = pos[i*3+1] = pos[i*3+2] = 0; continue; }
      const r = SKY_R - 3;
      pos[i*3]   = r * Math.cos(el) * Math.sin(t);
      pos[i*3+1] = r * Math.sin(el);
      pos[i*3+2] = r * Math.cos(el) * Math.cos(t);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    s.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x9988ff, size: 0.65, transparent: true, opacity: 0.22, sizeAttenuation: true,
    })));
  }

  _buildMoon(s) {
    const mp = skyPoint(220, 68);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(3.0, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff8e8 })
    );
    moon.position.copy(mp); s.add(moon); Anime.outline(moon, 0.02);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(7, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff0aa, transparent: true, opacity: 0.07, side: THREE.BackSide })
    );
    halo.position.copy(mp); s.add(halo);
    const ml = new THREE.PointLight(0xc8d8ff, 0.12, 130);
    ml.position.copy(mp); s.add(ml);
  }

  _buildPark(s) {
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      Anime.mat(0x0c3016)
    );
    grass.rotation.x = -Math.PI / 2; s.add(grass);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, r = 28 + Math.random() * 10;
      this._buildNightTree(s, Math.cos(a) * r, Math.sin(a) * r);
    }
  }

  _buildNightTree(s, x, z) {
    const g = new THREE.Group(); s.add(g); g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 2.2, 7), Anime.mat(0x0a1a08));
    trunk.position.y = 1.1; g.add(trunk);
    [0, 0.8, 1.55].forEach((ty, ti) => {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.6 - ti * 0.38, 1.1, 8), Anime.mat(0x091e0b));
      crown.position.y = 1.9 + ty; g.add(crown);
    });
  }

  _buildPicnicScene(s) {
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.0), Anime.mat(0x3a1a55));
    blanket.rotation.x = -Math.PI / 2; blanket.position.set(0, 0.01, 0); s.add(blanket);
    this._buildLyingChar(s, -0.7, 0.12, 0.5, 0xffdd44, 0xffe8c0, 'avicula');
    this._buildLyingChar(s,  0.5, 0.12, 0.5, 0xcc88ff, 0xffe0cc, 'purpura');
    Build.label(s, '"Let\'s count the stars!"', -0.8, 1.85, 0.5, '#fff', 'rgba(40,10,80,0.9)');
  }

  _buildLyingChar(s, x, y, z, bodyCol, headCol, name) {
    const g = new THREE.Group(); s.add(g); g.position.set(x, y, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.82, 10), Anime.mat(bodyCol));
    body.rotation.z = Math.PI / 2; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), Anime.mat(headCol));
    head.position.set(0.53, 0.08, 0); g.add(head);
    g.userData.bobT = name === 'purpura' ? Math.PI / 3 : 0;
    this.scene.userData[name] = g;
  }

  // ── Numbered stars ────────────────────────────────────────
  _buildNumberedStars(s) {
    STAR_POSITIONS.forEach(([az, el], i) => {
      const wp = skyPoint(az, el);

      // star sphere
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      mesh.position.copy(wp);
      mesh.userData = { number: i, worldPos: wp };
      s.add(mesh);
      this._starMeshes.push(mesh);
      this.interactables.push(mesh);

      // glow ring
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.3, 6, 18),
        new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0 })
      );
      ring.position.copy(wp); ring.lookAt(0, 0, 0); s.add(ring);
      mesh.userData.ring = ring;

      // number label floating next to star
      const cv  = document.createElement('canvas');
      cv.width  = 64; cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = 'rgba(10,5,40,0.85)';
      ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i + 1, 32, 33);
      const tex = (() => { const _t = new THREE.CanvasTexture(cv); _t.channel = 0; return _t; })();
      const lbl = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      );
      // offset label slightly from star
      const dir = wp.clone().normalize();
      lbl.position.copy(wp).addScaledVector(dir, -3).addScaledVector(new THREE.Vector3(0, 1, 0), 2.5);
      lbl.userData.isBillboard = true;
      s.add(lbl);
      mesh.userData.label = lbl;
      this._labels.push(lbl);
    });
  }

  _buildFireflies(s) {
    for (let i = 0; i < 22; i++) {
      const ff = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0xccff44, transparent: true, opacity: 0.9 })
      );
      const r = 4 + Math.random() * 12, a = Math.random() * Math.PI * 2;
      ff.position.set(Math.cos(a) * r, 0.3 + Math.random() * 2.5, Math.sin(a) * r);
      ff.userData = {
        t: Math.random() * Math.PI * 2,
        cx: ff.position.x, cy: ff.position.y, cz: ff.position.z,
        speed: 0.5 + Math.random() * 0.9, r: 1.5 + Math.random() * 2,
      };
      s.add(ff);
      const pt = new THREE.PointLight(0xaaffaa, 0, 3.5);
      pt.position.copy(ff.position); s.add(pt);
      ff.userData.light = pt;
      this._fireflies.push(ff);
    }
  }

  // ══════════════════════════════════════════════════════════
  onEnter() {
    this._nextStar  = 0;
    this._done      = false;
    this._hoveredStar = null;
    this._yaw   = 0;
    this._pitch = 1.2;

    // reset all stars to white, hide rings
    this._starMeshes.forEach(mesh => {
      mesh.material.color.set(0xffffff);
      mesh.scale.setScalar(1);
      if (mesh.userData.ring) mesh.userData.ring.material.opacity = 0;
      if (mesh.userData.label) mesh.userData.label.visible = true;
    });

    this.camera.fov = 78; this.camera.updateProjectionMatrix();
    this.camera.position.set(0, 1.6, 0.4);

    if (!this.engine.input.locked) this.engine.input.requestLock();
    this._lockOnClick = () => { if (!this.engine.input.locked) this.engine.input.requestLock(); };
    document.getElementById('canvas').addEventListener('click', this._lockOnClick);

    this.engine.audio.play('music', 68);
    this._updateHUD();
    this.engine.hud.showPrompt('Click star ⭐ 1 first, then 2, 3… all the way to 10!');
    setTimeout(() => this.engine.hud.hidePrompt(), 4000);
  }

  onExit() {
    this.engine.audio.play('musicStop');
    if (this._lockOnClick)
      document.getElementById('canvas').removeEventListener('click', this._lockOnClick);
  }

  // ══════════════════════════════════════════════════════════
  update(dt) {
    this._sky?.update(dt);
    const inp = this.engine.input;
    const t   = performance.now() / 1000;

    // look around
    this._yaw   -= inp.mouse.dx * this._sens;
    this._pitch -= inp.mouse.dy * this._sens;
this._pitch = THREE.MathUtils.clamp(this._pitch, 0.3, Math.PI / 2 + 0.3);
    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this._yaw);
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this._pitch);
    this.camera.quaternion.copy(qY).multiply(qX);
    this.camera.position.set(0, 1.6, 0.4);

    // raycast
    this._ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this._ray.intersectObjects(this._starMeshes, false);
    this._hoveredStar = hits.length ? hits[0].object : null;

    // star animations
    this._starMeshes.forEach((mesh, i) => {
      const isNext   = i === this._nextStar;
      const isDone   = i < this._nextStar;
      const isHovered = mesh === this._hoveredStar;

      // scale pulse on next target
      mesh.scale.setScalar(isNext ? 1.0 + Math.sin(t * 3 + i) * 0.3 : isDone ? 0.7 : 0.8);

      // colour
      if (isDone) {
        mesh.material.color.setHex(0xffd700);
      } else if (isNext) {
        mesh.material.color.setHSL(0, 0, 0.85 + Math.sin(t * 4) * 0.15);
      } else {
        mesh.material.color.setHex(0x888888);
      }

      // ring
      if (mesh.userData.ring) {
        mesh.userData.ring.material.opacity = isDone ? 0.7 : isNext ? 0.2 + Math.sin(t * 3) * 0.15 : 0;
        mesh.userData.ring.lookAt(this.camera.position);
      }

      // label visibility — hide done stars' labels
      if (mesh.userData.label) {
        mesh.userData.label.visible = !isDone;
      }
    });

    // bg star twinkle
    this._bgStarMeshes.forEach(m => {
      m.userData.twinkleT += dt * m.userData.twinkleSpeed;
      m.scale.setScalar(Math.max(0.1, 0.8 + Math.sin(m.userData.twinkleT) * 0.4));
      m.material.opacity = 0.45 + Math.sin(m.userData.twinkleT * 0.7) * 0.35;
    });

    // fireflies
    this._fireflies.forEach(ff => {
      ff.userData.t += dt * ff.userData.speed;
      const ft = ff.userData.t;
      ff.position.x = ff.userData.cx + Math.sin(ft * 0.7) * ff.userData.r;
      ff.position.y = ff.userData.cy + Math.sin(ft * 1.3) * 0.4;
      ff.position.z = ff.userData.cz + Math.cos(ft * 0.9) * ff.userData.r;
      const blink = Math.sin(ft * 4) * 0.5 + 0.5;
      ff.material.opacity = blink * 0.88;
      if (ff.userData.light) {
        ff.userData.light.position.copy(ff.position);
        ff.userData.light.intensity = blink * 0.55;
      }
    });

    // characters breathe
    ['avicula', 'purpura'].forEach(name => {
      const ch = this.scene.userData[name]; if (!ch) return;
      ch.userData.bobT += dt;
      ch.position.y = 0.12 + Math.sin(ch.userData.bobT * 0.85) * 0.011;
    });

    // crosshair + prompt
    if (this._hoveredStar) {
      const num = this._hoveredStar.userData.number;
      if (num === this._nextStar) {
        this.engine.hud.showPrompt(`[Click / E] Star ${num + 1} ⭐`);
        this.engine.hud.crosshairColor('#ffd700');
      } else if (num < this._nextStar) {
        this.engine.hud.showPrompt(`Already found ✅`);
        this.engine.hud.crosshairColor('#88ff88');
      } else {
        this.engine.hud.showPrompt(`Find star ${this._nextStar + 1} first!`);
        this.engine.hud.crosshairColor('#888888');
      }
    } else {
      this.engine.hud.hidePrompt();
      this.engine.hud.crosshairColor('white');
    }
  }

  onInteract() {
    if (this._done || !this._hoveredStar) return;
    const num = this._hoveredStar.userData.number;
    if (num !== this._nextStar) {
      this.engine.audio.play('deny');
      this.engine.hud.showPrompt(`Find star ${this._nextStar + 1} first!`);
      setTimeout(() => this.engine.hud.hidePrompt(), 1500);
      return;
    }

    // correct star clicked
    this._hoveredStar.material.color.setHex(0xffd700);
    if (this._hoveredStar.userData.ring) this._hoveredStar.userData.ring.material.opacity = 0.8;
    this._hoveredStar.userData.popT = 0;
    this.engine.audio.play('pickup');
    this._nextStar++;
    this._updateHUD();

    if (this._nextStar >= STAR_COUNT) {
      this._complete();
    } else {
      this.engine.hud.showPrompt(`⭐ ${this._nextStar} / ${STAR_COUNT} — now find star ${this._nextStar + 1}!`);
      setTimeout(() => this.engine.hud.hidePrompt(), 1800);
    }
  }

  _complete() {
    this._done = true;
    this.engine.audio.play('cash');
    setTimeout(() => {
      this.engine.hud.showOverlay(`
        <div style="font-size:52px">🌟💛💜🌟</div>
        <div style="font-size:28px;font-weight:900;
          background:linear-gradient(135deg,#ffd700,#c890ff);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;text-align:center">
          All 10 Stars Found!</div>
        <div style="font-size:15px;color:#ddd;text-align:center;max-width:340px;line-height:1.8;margin-top:4px">
          Avicula counts the last star.<br>
          Purpura squeezes their hand.<br>
          <span style="color:#ffd700">✨ A perfect night. ✨</span>
        </div>
      `, 'Play Again 🔄', () => this.engine.nextLevel('stargazing'));
    }, 800);
  }

  _updateHUD() {
    this.engine.hud.setInfo(`
      <div style="font-weight:700;font-size:13px;color:#ffd700;margin-bottom:6px">
        🌟 Stargazing (${this._nextStar}/${STAR_COUNT})</div>
      <div style="font-size:13px;line-height:1.9">
        Find star <span style="color:#ffd700;font-size:18px;font-weight:900">${this._nextStar + 1}</span> next!
      </div>
      <div style="font-size:11px;opacity:0.5;margin-top:6px">
        Mouse = look · Click/E = select star<br>
        Stars are numbered — click in order!
      </div>
    `);
  }
}