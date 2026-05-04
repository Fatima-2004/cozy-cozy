// ============================================================
//  STARRY PICNIC — backgrounds.js
//  Drop-in background builders for each level.
//  Import the function you need and call it inside init().
// ============================================================

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
//  GROCERY  — cozy warm convenience store, late afternoon
//  Store bounds: x -15→15, z -19→7, ceiling y=4
// ─────────────────────────────────────────────────────────────
export function groceryBackground(scene) {

  // ── 1. Solid warm interior background + fog ───────────────
  scene.background = new THREE.Color(0xf2e8d5);
  scene.fog = new THREE.Fog(0xede0c8, 20, 52);

  // ── 2. Lighting ───────────────────────────────────────────
  // Very low ambient — let the practical lights do the work
  scene.add(new THREE.AmbientLight(0xfff0d0, 0.18));
  scene.add(new THREE.HemisphereLight(0xffe8c0, 0xd4a870, 0.15));

  // Fluorescent tubes — warm white, soft pools
  [-13, -7, -1].forEach(z => [-3.2, 3.2].forEach(x => {
    const pl = new THREE.PointLight(0xffeebb, 0.95, 10, 1.6);
    pl.position.set(x, 3.65, z);
    pl.castShadow = true;
    pl.shadow.mapSize.setScalar(256);
    pl.shadow.bias = -0.003;
    scene.add(pl);

    // tube mesh
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.05, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xfff8e0 })
    );
    tube.position.set(x, 3.93, z);
    scene.add(tube);

    // subtle warm halo directly beneath
    const halo = new THREE.PointLight(0xffcc77, 0.28, 3.5, 2);
    halo.position.set(x, 3.3, z);
    scene.add(halo);
  }));

  // Window sun shafts — two warm spotlights through front windows
  [-6, 6].forEach(x => {
    const spot = new THREE.SpotLight(0xffe4a0, 2.2, 22, Math.PI / 9, 0.55, 1.8);
    spot.position.set(x, 3.8, 5.5);
    spot.target.position.set(x * 0.6, 0, -2);
    spot.castShadow = false; // skip shadow for perf
    scene.add(spot);
    scene.add(spot.target);
  });

  // ── 3. Windows on front wall (z≈6.7) ──────────────────────
  // Outside sky canvas visible through each window
  const outsideCanvas = _paintOutsideView();
  const outsideTex    = (() => { const _t = new THREE.CanvasTexture(outsideCanvas); _t.channel = 0; return _t; })();

  [-7, 0, 7].forEach(x => {
    // Window glass pane — shows the outside view
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 1.6),
      new THREE.MeshBasicMaterial({
        map:         outsideTex,
        transparent: false,
      })
    );
    pane.position.set(x, 2.2, 6.68);
    scene.add(pane);

    // Window frame (four thin boxes)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xd4c4a0, roughness: 0.7 });
    [
      [x,       2.2,  6.72, 2.92, 0.07, 0.08],  // top
      [x,       2.2,  6.72, 2.92, 0.07, 0.08],  // bottom (offset below)
      [x - 1.47,2.2,  6.72, 0.07, 1.72, 0.08],  // left
      [x + 1.47,2.2,  6.72, 0.07, 1.72, 0.08],  // right
    ].forEach(([fx, fy, fz, fw, fh, fd], i) => {
      if (i === 1) fy = 1.35;
      const f = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), frameMat);
      f.position.set(fx, fy, fz);
      scene.add(f);
    });

    // Cross divider
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.06, 0.07), frameMat);
    crossH.position.set(x, 2.2, 6.72);
    scene.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.72, 0.07), frameMat);
    crossV.position.set(x, 2.2, 6.72);
    scene.add(crossV);

    // Window sill
    const sill = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.09, 0.22), frameMat);
    sill.position.set(x, 1.34, 6.6);
    scene.add(sill);

    // Soft light pool on floor beneath each window
    const sunPool = new THREE.PointLight(0xffdd99, 0.6, 5, 2);
    sunPool.position.set(x, 0.1, 4);
    scene.add(sunPool);
  });

  // ── 4. Back wall accent — produce refrigerator glow ───────
  // Blue-white glow at z=-18.5 (back wall)
  [-8, 0, 8].forEach(x => {
    const refGlow = new THREE.PointLight(0xaaddff, 0.45, 5, 2);
    refGlow.position.set(x, 1.2, -18.2);
    scene.add(refGlow);

    const refPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.4),
      new THREE.MeshBasicMaterial({
        ap: (() => { const _t = new THREE.CanvasTexture(_paintFridgePanel()); _t.channel = 0; return _t; })(),
        transparent: false,
      })
    );
    refPanel.position.set(x, 1.2, -18.65);
    scene.add(refPanel);

    // Fridge door frame
    const fMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.3, metalness: 0.7 });
    const fTop = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 0.1), fMat);
    fTop.position.set(x, 2.42, -18.6); scene.add(fTop);
    const fBot = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 0.1), fMat);
    fBot.position.set(x, 0.04, -18.6); scene.add(fBot);
    [-1.65, 1.65].forEach(ox => {
      const fSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.48, 0.1), fMat);
      fSide.position.set(x + ox, 1.2, -18.6); scene.add(fSide);
    });
  });

  // ── 5. Entrance mat ───────────────────────────────────────
  const matCanvas = _paintEntranceMat();
  const entranceMat = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.2),
    new THREE.MeshBasicMaterial({ map: (() => { const _t = new THREE.CanvasTexture(matCanvas); _t.channel = 0; return _t; })(), transparent: true })
  );
  entranceMat.rotation.x = -Math.PI / 2;
  entranceMat.position.set(0, 0.002, 5.2);
  scene.add(entranceMat);

  // ── 6. Potted plants by entrance ─────────────────────────
  [-11, 11].forEach(x => _buildPot(scene, x, 0, 5));

  // ── 7. Noticeboard on left side wall ──────────────────────
  _buildNoticeboard(scene, -14.7, 2.0, -4);

  // ── 8. Hanging star decorations from ceiling ──────────────
  _buildCeilingDecorations(scene);

  // ── 9. Produce display crates near entrance ───────────────
  _buildProduceDisplay(scene);

  // Return update function (called each frame from level's update)
  let _t = 0;
  return {
    update(dt) {
      _t += dt;
      // Gently pulse the fridge glow
      scene.children
        .filter(c => c.isPointLight && c.color.b > 0.7)
        .forEach(l => { l.intensity = 0.45 + Math.sin(_t * 1.4) * 0.08; });
    }
  };
}

// ─────────────────────────────────────────────────────────────
//  CANVAS PAINTERS
// ─────────────────────────────────────────────────────────────

function _paintOutsideView() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');

  // Sky gradient — warm late afternoon
  const sky = ctx.createLinearGradient(0, 0, 0, 180);
  sky.addColorStop(0,    '#6ab4e8');
  sky.addColorStop(0.45, '#f0c87a');
  sky.addColorStop(0.75, '#ffb347');
  sky.addColorStop(1,    '#ff8c69');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 180);

  // Ground strip
  const ground = ctx.createLinearGradient(0, 180, 0, 256);
  ground.addColorStop(0, '#7aaa66');
  ground.addColorStop(1, '#5a8844');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 180, 512, 76);

  // Distant building silhouettes
  ctx.fillStyle = '#3a4a6a';
  [[60,110,50,70],[130,125,35,55],[190,100,55,80],[280,115,45,65],[350,90,60,90],[430,120,40,60]].forEach(([x,y,w,h]) => {
    ctx.fillRect(x, y, w, h);
    // windows
    ctx.fillStyle = '#ffeeaa';
    for (let wy = y + 8; wy < y + h - 8; wy += 14) {
      for (let wx = x + 6; wx < x + w - 6; wx += 12) {
        if (Math.random() > 0.3) ctx.fillRect(wx, wy, 6, 8);
      }
    }
    ctx.fillStyle = '#3a4a6a';
  });

  // Tree silhouettes in foreground
  ctx.fillStyle = '#2d5a2a';
  [[20,160,18,40],[80,150,22,50],[160,155,16,45],[240,145,24,55],[320,158,18,42],[400,148,20,52],[480,155,16,45]].forEach(([x,y,r,h]) => {
    // trunk
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(x - 3, y + 10, 6, 30);
    // canopy
    ctx.fillStyle = '#2d5a2a';
    ctx.beginPath();
    ctx.ellipse(x, y, r, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a7a35';
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 8, r * 0.7, h * 0.4, -0.3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Soft sun glow
  const sun = ctx.createRadialGradient(400, 60, 0, 400, 60, 80);
  sun.addColorStop(0,   'rgba(255,240,160,0.6)');
  sun.addColorStop(0.4, 'rgba(255,200,80,0.2)');
  sun.addColorStop(1,   'rgba(255,160,60,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 512, 256);

  // A few small clouds
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  [[100,40,60,22],[260,25,80,28],[370,50,55,20]].forEach(([cx,cy,rw,rh]) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, rh/rw);
    ctx.beginPath();
    ctx.arc(0, 0, rw, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  return c;
}

function _paintFridgePanel() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 192;
  const ctx = c.getContext('2d');

  // Fridge interior — cool blue-white
  const bg = ctx.createLinearGradient(0, 0, 0, 192);
  bg.addColorStop(0, '#d8eeff');
  bg.addColorStop(1, '#b8d8f0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 192);

  // Shelf lines
  ctx.strokeStyle = 'rgba(100,140,180,0.4)';
  ctx.lineWidth = 2;
  [50, 100, 150].forEach(y => {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  });

  // Product silhouettes on shelves
  const colors = ['#ee4444','#4488ee','#44aa44','#eeaa22','#aa44ee','#ee8844'];
  [20, 70, 120].forEach(sy => {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = colors[(i + sy) % colors.length] + 'cc';
      const w = 20 + Math.random() * 14;
      const h = 28 + Math.random() * 16;
      ctx.beginPath();
      ctx.roundRect(8 + i * 40, sy + (50 - h), w, h, 3);
      ctx.fill();
      // label strip
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(8 + i * 40, sy + (50 - h) + h * 0.6, w, h * 0.25);
    }
  });

  // Cool light reflection at top
  const shine = ctx.createLinearGradient(0, 0, 0, 30);
  shine.addColorStop(0, 'rgba(220,240,255,0.7)');
  shine.addColorStop(1, 'rgba(220,240,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, 256, 30);

  return c;
}

function _paintEntranceMat() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 192;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 192, 16);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#c8a060';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(10, 10, 492, 172, 10);
  ctx.stroke();

  // Welcome text
  ctx.fillStyle = '#e8c880';
  ctx.font = 'bold 52px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WELCOME', 256, 80);

  ctx.font = '28px serif';
  ctx.fillStyle = '#c0a060';
  ctx.fillText('✦  Cozy Corner Market  ✦', 256, 140);

  return c;
}

// ─────────────────────────────────────────────────────────────
//  SCENE OBJECT BUILDERS
// ─────────────────────────────────────────────────────────────

function _buildPot(scene, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  scene.add(g);

  // Pot body
  const potMat = new THREE.MeshStandardMaterial({ color: 0xc05a30, roughness: 0.8, metalness: 0.05 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.38, 16), potMat);
  pot.position.y = 0.19;
  pot.castShadow = true;
  g.add(pot);

  // Soil
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 1 })
  );
  soil.position.y = 0.36;
  g.add(soil);

  // Plant stems + leaves
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x44aa33, roughness: 0.7, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a7a22, roughness: 0.8 });

  for (let i = 0; i < 5; i++) {
    const angle  = (i / 5) * Math.PI * 2;
    const lean   = 0.28 + Math.random() * 0.18;
    const height = 0.5 + Math.random() * 0.4;

    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.018, height, 5),
      stemMat
    );
    stem.position.set(Math.cos(angle) * lean * 0.3, 0.38 + height / 2, Math.sin(angle) * lean * 0.3);
    stem.rotation.z = Math.cos(angle) * lean * 0.5;
    stem.rotation.x = Math.sin(angle) * lean * 0.5;
    g.add(stem);

    // Leaf
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.38), leafMat);
    leaf.position.set(
      Math.cos(angle) * lean * 0.55,
      0.38 + height,
      Math.sin(angle) * lean * 0.55
    );
    leaf.rotation.y = angle;
    leaf.rotation.x = -0.4 - Math.random() * 0.3;
    g.add(leaf);
  }

  // Warm glow from plant (subtle)
  const glow = new THREE.PointLight(0x88ff66, 0.12, 2.5, 2);
  glow.position.y = 0.9;
  g.add(glow);

  return g;
}

function _buildNoticeboard(scene, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  scene.add(g);

  // Board backing
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.4, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x8b5e2a, roughness: 0.85 })
  );
  g.add(board);

  // Cork surface
  const corkCanvas = _paintCorkboard();
  const cork = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.28),
    new THREE.MeshBasicMaterial({ map: (() => { const _t = new THREE.CanvasTexture(corkCanvas); _t.channel = 0; return _t; })() })
  );
  cork.rotation.y = Math.PI / 2;
  cork.position.x = 0.04;
  g.add(cork);

  // Warm reading light above board
  const light = new THREE.PointLight(0xffdd88, 0.5, 3, 2);
  light.position.set(0.5, 0.9, 0);
  g.add(light);

  return g;
}

function _paintCorkboard() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 384;
  const ctx = c.getContext('2d');

  // Cork texture
  ctx.fillStyle = '#c8935a';
  ctx.fillRect(0, 0, 512, 384);
  // grain dots
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = `rgba(${100 + Math.random()*60},${60 + Math.random()*30},${20 + Math.random()*20},0.25)`;
    ctx.beginPath();
    ctx.arc(Math.random()*512, Math.random()*384, 1 + Math.random()*3, 0, Math.PI*2);
    ctx.fill();
  }

  // Pinned notes
  const notes = [
    { x:30,  y:20,  w:180, h:130, bg:'#fffde0', text:['🌟 SPECIALS', 'Tomatoes 3/$1', 'Fresh bread daily', 'Juice 2-for-1'],         pin:'#ee3333' },
    { x:230, y:15,  w:160, h:110, bg:'#e0f0ff', text:['📋 NOTICE', 'Store hours:', 'Mon–Sat 8–9', 'Sun 9–6'],                         pin:'#3366ee' },
    { x:30,  y:175, w:200, h:90,  bg:'#f0ffe0', text:['✅ Today\'s list:', '☐ Chicken', '☐ Bread', '☐ Juice'],                       pin:'#44aa33' },
    { x:255, y:145, w:155, h:100, bg:'#fff0e8', text:['☎ LOST & FOUND', 'See manager', 'at checkout 🛒'],                            pin:'#ee8833' },
    { x:60,  y:285, w:130, h:80,  bg:'#f8e8ff', text:['🎵 Music Fri!', 'Come enjoy', 'live tunes'],                                  pin:'#9944ee' },
    { x:220, y:265, w:180, h:100, bg:'#fff8e0', text:['⭐ Loyalty card?', 'Ask cashier', 'for details!'],                            pin:'#ddaa00' },
  ];

  notes.forEach(({ x, y, w, h, bg, text, pin }) => {
    // slight rotation
    const rot = (Math.random() - 0.5) * 0.12;
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    ctx.rotate(rot);

    // shadow
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 4);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // text
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    text.forEach((line, i) => {
      ctx.font = i === 0 ? 'bold 15px sans-serif' : '13px sans-serif';
      ctx.fillStyle = i === 0 ? '#222' : '#444';
      ctx.fillText(line, -w/2 + 10, -h/2 + 18 + i * 18);
    });

    // pushpin
    ctx.fillStyle = pin;
    ctx.beginPath();
    ctx.arc(0, -h/2 + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(-1, -h/2 + 6, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  return c;
}

function _buildCeilingDecorations(scene) {
  // Hanging star garland across the store
  const starMat = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide });
  const pinkMat = new THREE.MeshBasicMaterial({ color: 0xff88cc, side: THREE.DoubleSide });
  const mints   = new THREE.MeshBasicMaterial({ color: 0x88ffcc, side: THREE.DoubleSide });

  const mats = [starMat, pinkMat, mints];

  // String geometry helper
  function hangStar(x, y, z, mat) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    scene.add(g);

    // 5-point star using cones
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
      const pt = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 4), mat);
      pt.position.set(Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0);
      pt.rotation.z = -a - Math.PI / 2;
      g.add(pt);
    }
    // tiny string
    const str = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.18, 0.01),
      new THREE.MeshBasicMaterial({ color: 0xccaa66 })
    );
    str.position.y = 0.18;
    g.add(str);
    return g;
  }

  // Two garland rows
  for (let zi = 0; zi < 2; zi++) {
    const rowZ = -5 + zi * -8;
    for (let i = 0; i < 9; i++) {
      const sx = -14 + i * 3.5;
      const sy = 3.78 - Math.abs(Math.sin(i * 0.9)) * 0.18; // gentle droop
      hangStar(sx, sy, rowZ, mats[i % mats.length]);
    }
  }

  // Tiny warm twinkle lights along the garland
  for (let zi = 0; zi < 2; zi++) {
    const rowZ = -5 + zi * -8;
    [-10, -4, 2, 8].forEach(x => {
      const tw = new THREE.PointLight(0xffffaa, 0.22, 2.5, 2);
      tw.position.set(x, 3.65, rowZ);
      scene.add(tw);
    });
  }
}

function _buildProduceDisplay(scene) {
  // Wooden crate display near entrance, right side
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xaa7744, roughness: 0.9 });
  const positions = [[8, 0, 3.5], [9.6, 0, 3.5], [8.8, 0.38, 3.5]];

  positions.forEach(([x, y, z]) => {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.9), crateMat);
    crate.position.set(x, y + 0.19, z);
    crate.castShadow = true;
    scene.add(crate);

    // Slat lines on crate front
    const slatMat = new THREE.MeshBasicMaterial({ color: 0x885533 });
    for (let i = 0; i < 3; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.03, 0.01), slatMat);
      slat.position.set(x, y + 0.1 + i * 0.12, z - 0.455);
      scene.add(slat);
    }

    // Produce inside — coloured spheres peeking over rim
    const produceColors = [0xff5533, 0xff9900, 0xffee22, 0x44cc22, 0xee2244];
    for (let p = 0; p < 6; p++) {
      const r    = 0.07 + Math.random() * 0.04;
      const prod = new THREE.Mesh(
        new THREE.SphereGeometry(r, 8, 6),
        new THREE.MeshStandardMaterial({
          color:    produceColors[p % produceColors.length],
          roughness:0.6,
          emissive: produceColors[p % produceColors.length],
          emissiveIntensity: 0.08,
        })
      );
      prod.position.set(
        x + (Math.random() - 0.5) * 1.0,
        y + 0.38 + r * 0.7,
        z + (Math.random() - 0.5) * 0.55
      );
      prod.castShadow = true;
      scene.add(prod);
    }
  });

  // Small handwritten sign above crates
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256; signCanvas.height = 80;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#fff9e8';
  sctx.fillRect(0, 0, 256, 80);
  sctx.strokeStyle = '#c08040';
  sctx.lineWidth = 3;
  sctx.strokeRect(3, 3, 250, 74);
  sctx.fillStyle = '#884422';
  sctx.font = 'bold 24px serif';
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.fillText('🍎 Fresh Today!', 128, 40);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.34),
    new THREE.MeshBasicMaterial({ map: (() => { const _t = new THREE.CanvasTexture(signCanvas); _t.channel = 0; return _t; })(), transparent: true })
  );
  sign.position.set(8.8, 1.22, 3.06);
  sign.userData.isBillboard = true;
  scene.add(sign);
}

export function cookingBackground(scene) {

  // Warm late-afternoon kitchen
  scene.background = new THREE.Color(0xfff4e0);
  scene.fog = new THREE.FogExp2(0xffedd0, 0.032);

  // Low ambient — pendant lights do the heavy lifting
  scene.add(new THREE.AmbientLight(0xffeedd, 0.28));
  scene.add(new THREE.HemisphereLight(0xfff0cc, 0xddaa66, 0.22));

  // Warm sun shaft through the window (window is at x=-1.5, z=-6.9)
  const sunSpot = new THREE.SpotLight(0xffe090, 3.5, 18, Math.PI / 8, 0.6, 1.6);
  sunSpot.position.set(-1.5, 3.8, -5.8);
  sunSpot.target.position.set(-1.5, 0, -3);
  scene.add(sunSpot);
  scene.add(sunSpot.target);

  // Warm pool on floor under window
  const floorPool = new THREE.PointLight(0xffdd88, 0.7, 4, 2);
  floorPool.position.set(-1.5, 0.1, -4.5);
  scene.add(floorPool);

  // Replace the blue window glass with a painted outside view
  // Find and hide the original glass (MeshBasicMaterial color 0x88d8ff)
  scene.traverse(obj => {
    if (obj.isMesh && obj.material?.color?.getHex?.() === 0x88d8ff) {
      obj.visible = false;
    }
  });

  // Painted outside canvas in its place
const outsideTex = (() => { const _t = new THREE.CanvasTexture(_paintKitchenWindow()); _t.channel = 0; return _t; })();

  const windowView = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.9),
    new THREE.MeshBasicMaterial({ map: outsideTex })
  );
  windowView.position.set(-1.5, 2.4, -6.82);
  scene.add(windowView);

  // Stove area warm glow (complements the burner glow from gameplay)
  const stoveAmb = new THREE.PointLight(0xff8833, 0.35, 4, 2);
  stoveAmb.position.set(-3, 1.5, -4.5);
  scene.add(stoveAmb);

  // Cozy warm fill on the right side (fridge area)
  const fillLight = new THREE.PointLight(0xffeebb, 0.4, 6, 2);
  fillLight.position.set(6, 2.5, 0);
  scene.add(fillLight);

  let _t = 0;
  return {
    update(dt) {
      _t += dt;
      // Gentle sunlight flicker (like leaves outside)
      sunSpot.intensity = 3.5 + Math.sin(_t * 0.7) * 0.3 + Math.sin(_t * 1.9) * 0.15;
      floorPool.intensity = 0.7 + Math.sin(_t * 0.7) * 0.12;
    }
  };
}

function _paintKitchenWindow() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const ctx = c.getContext('2d');

  // Sky — warm afternoon
  const sky = ctx.createLinearGradient(0, 0, 0, 220);
  sky.addColorStop(0,    '#4a9fd4');
  sky.addColorStop(0.5,  '#f5c97a');
  sky.addColorStop(0.8,  '#ffb347');
  sky.addColorStop(1,    '#ff9060');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 220);

  // Garden / grass below
  const grass = ctx.createLinearGradient(0, 220, 0, 320);
  grass.addColorStop(0, '#6aaa44');
  grass.addColorStop(1, '#448822');
  ctx.fillStyle = grass;
  ctx.fillRect(0, 220, 512, 100);

  // Sun glow top-right
  const sun = ctx.createRadialGradient(420, 55, 0, 420, 55, 100);
  sun.addColorStop(0,   'rgba(255,248,180,0.8)');
  sun.addColorStop(0.3, 'rgba(255,210,80,0.35)');
  sun.addColorStop(1,   'rgba(255,160,40,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 512, 320);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  [[80,45,70,26],[210,30,95,32],[360,55,65,24],[460,38,55,20]].forEach(([cx,cy,rw,rh]) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, rh/rw);
    ctx.beginPath(); ctx.arc(0, 0, rw, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // extra blob
    ctx.save();
    ctx.translate(cx + rw * 0.5, cy + 2);
    ctx.scale(1, (rh * 0.7) / (rw * 0.6));
    ctx.beginPath(); ctx.arc(0, 0, rw * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // Garden fence
  ctx.fillStyle = '#c8a060';
  ctx.fillRect(0, 210, 512, 12);
  for (let fx = 10; fx < 512; fx += 22) {
    ctx.fillRect(fx, 190, 10, 32);
    // pointed top
    ctx.beginPath();
    ctx.moveTo(fx, 190);
    ctx.lineTo(fx + 5, 180);
    ctx.lineTo(fx + 10, 190);
    ctx.fill();
  }

  // Garden flowers
  const flowerColors = ['#ff4488','#ffdd22','#ff6622','#cc44ff','#ff88aa'];
  for (let i = 0; i < 18; i++) {
    const fx = 20 + Math.random() * 472;
    const fy = 225 + Math.random() * 60;
    const fc = flowerColors[i % flowerColors.length];
    // stem
    ctx.strokeStyle = '#448822';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(fx, fy + 18); ctx.lineTo(fx, fy); ctx.stroke();
    // petals
    ctx.fillStyle = fc;
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(fx + Math.cos(a) * 5, fy + Math.sin(a) * 5, 4, 3, a, 0, Math.PI * 2);
      ctx.fill();
    }
    // centre
    ctx.fillStyle = '#ffee44';
    ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Tree on left
  ctx.fillStyle = '#5a3820';
  ctx.fillRect(30, 130, 14, 90);
  ctx.fillStyle = '#3a7a28';
  ctx.beginPath(); ctx.ellipse(38, 110, 36, 55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#4a9a33';
  ctx.beginPath(); ctx.ellipse(28, 100, 24, 38, -0.3, 0, Math.PI * 2); ctx.fill();

  // Soft window-glass tint overlay
  const tint = ctx.createLinearGradient(0, 0, 512, 320);
  tint.addColorStop(0,   'rgba(200,230,255,0.10)');
  tint.addColorStop(0.5, 'rgba(255,240,200,0.06)');
  tint.addColorStop(1,   'rgba(255,220,160,0.12)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 512, 320);

  return c;
}

// ─── DRIVING ────────────────────────────────────────────────
export function drivingBackground(scene) {
  // Gradient sky dome
  const domeMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x3a8fd4) },
      midColor: { value: new THREE.Color(0x89c4e8) },
      botColor: { value: new THREE.Color(0xc8e8f5) },
      midPoint: { value: 0.38 },
      exponent: { value: 1.6  },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main(){ vWorldPos=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform vec3 topColor,midColor,botColor;
      uniform float midPoint,exponent;
      varying vec3 vWorldPos;
      void main(){
        float h=normalize(vWorldPos).y*.5+.5;
        vec3 col=h>midPoint
          ?mix(midColor,topColor,pow((h-midPoint)/(1.-midPoint),exponent))
          :mix(botColor,midColor,pow(h/midPoint,exponent));
        gl_FragColor=vec4(col,1.);}`,
    side: THREE.BackSide, depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), domeMat);
  dome.renderOrder = -1;
  scene.add(dome);

  scene.fog = new THREE.FogExp2(0xb8d8ee, 0.009);

  // Sun
  const sun = new THREE.DirectionalLight(0xfffbe0, 2.2);
  sun.position.set(20, 40, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(1024);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x88c8ff, 0x88bb66, 0.7));
  scene.add(new THREE.AmbientLight(0xd0e8ff, 0.55));

  // Cloud planes
  const clouds = [];
  [55, 70, 85].forEach((height, i) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512;
    const ctx = cv.getContext('2d');
    for (let b = 0; b < 9; b++) {
      const bx = Math.random()*512, by = Math.random()*512;
      const rx = 60+Math.random()*120;
      const grad = ctx.createRadialGradient(bx,by,0,bx,by,rx);
      grad.addColorStop(0,'rgba(255,255,255,0.7)');
      grad.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=grad;
      ctx.save(); ctx.translate(bx,by); ctx.scale(1,0.5);
      ctx.translate(-bx,-by); ctx.beginPath();
      ctx.arc(bx,by,rx,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    const tex = (() => { const _t = new THREE.CanvasTexture(cv); _t.channel = 0; return _t; })();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4,4);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(600,600),
      new THREE.MeshBasicMaterial({map:tex,transparent:true,
        opacity:0.7-i*0.15,depthWrite:false})
    );
    plane.rotation.x = -Math.PI/2;
    plane.position.y = height;
    plane.renderOrder = -1;
    scene.add(plane);
    clouds.push({plane, tex, speed: 0.9-i*0.25});
  });

  let _t=0;
  return {
    update(dt) {
      _t += dt;
      clouds.forEach(({tex,speed}) => {
        tex.offset.x += dt*speed*0.0006;
      });
      dome.position.y = -20; // keep horizon centred
    }
  };
}

// ─── PACKING ────────────────────────────────────────────────
export function packingBackground(scene) {
  scene.background = new THREE.Color(0xf5e8ff);
  scene.fog = new THREE.FogExp2(0xf0deff, 0.038);

  scene.add(new THREE.AmbientLight(0xffe0ff, 0.25));
  scene.add(new THREE.HemisphereLight(0xffd0ff, 0xddaaee, 0.20));

  // Pendant light (already in packing._buildRoom but we make it warmer)
  const pendant = new THREE.PointLight(0xffeecc, 2.2, 22);
  pendant.position.set(0, 3.2, 0);
  scene.add(pendant);

  // Side table lamp fill
  const lampFill = new THREE.PointLight(0xffdd99, 0.55, 7, 2);
  lampFill.position.set(8, 1.0, -6);
  scene.add(lampFill);

  // Window on back wall — outside view
const outsideTex = (() => { const _t = new THREE.CanvasTexture(_paintPackingWindow()); _t.channel = 0; return _t; })();
  const windowView = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.8),
    new THREE.MeshBasicMaterial({ map: outsideTex })
  );
  windowView.position.set(5, 2.4, -8.84);
  scene.add(windowView);

  // Window frame
const fMat = new THREE.MeshStandardMaterial({color:0xddbbee,roughness:0.7});
[[5,2.4,-8.8, 2.92,0.07,0.1],[5,2.4,-8.8, 0.07,1.88,0.1],
 [5-1.47,2.4,-8.8, 0.07,1.88,0.1],[5,1.5,-8.8, 2.92,0.07,0.1],
 [5,3.32,-8.8, 2.92,0.07,0.1]].forEach(([x,y,z,w,h,d])=>{
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), fMat);
  mesh.position.set(x, y, z); // ✅ mutate in place instead of Object.assign
  scene.add(mesh);
});

  // Sun shaft through window
  const shaft = new THREE.SpotLight(0xffddaa, 1.8, 16, Math.PI/10, 0.65, 1.8);
  shaft.position.set(5, 3.6, -7.5);
  shaft.target.position.set(3, 0, -2);
  scene.add(shaft); scene.add(shaft.target);

  const floorPool = new THREE.PointLight(0xffcc88, 0.45, 5, 2);
  floorPool.position.set(4, 0.1, -4);
  scene.add(floorPool);

  let _t = 0;
  return {
    update(dt) {
      _t += dt;
      shaft.intensity = 1.8 + Math.sin(_t*0.8)*0.25;
      floorPool.intensity = 0.45 + Math.sin(_t*0.8)*0.1;
    }
  };
}

function _paintPackingWindow() {
  const c = document.createElement('canvas'); c.width=512; c.height=256;
  const ctx = c.getContext('2d');
  // Soft afternoon sky
  const sky = ctx.createLinearGradient(0,0,0,170);
  sky.addColorStop(0,'#7ab8e0'); sky.addColorStop(0.6,'#f5d598'); sky.addColorStop(1,'#ffc07a');
  ctx.fillStyle=sky; ctx.fillRect(0,0,512,170);
  // Garden
  ctx.fillStyle='#7ab855'; ctx.fillRect(0,170,512,86);
  ctx.fillStyle='#5a9840'; ctx.fillRect(0,200,512,56);
  // Sun
  const sun=ctx.createRadialGradient(380,50,0,380,50,70);
  sun.addColorStop(0,'rgba(255,248,180,0.7)'); sun.addColorStop(1,'rgba(255,200,80,0)');
  ctx.fillStyle=sun; ctx.fillRect(0,0,512,170);
  // Clouds
  [[90,35,55,20],[230,22,70,25],[400,40,50,18]].forEach(([cx,cy,rw,rh])=>{
    ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.save(); ctx.translate(cx,cy); ctx.scale(1,rh/rw);
    ctx.beginPath(); ctx.arc(0,0,rw,0,Math.PI*2); ctx.fill(); ctx.restore();
  });
  // Trees
  [[60,145],[150,135],[360,140],[460,148]].forEach(([x,y])=>{
    ctx.fillStyle='#4a2818'; ctx.fillRect(x-4,y,8,30);
    ctx.fillStyle='#2d6a22';
    ctx.beginPath(); ctx.ellipse(x,y,22,35,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3a8a2a';
    ctx.beginPath(); ctx.ellipse(x-5,y-10,14,22,-0.2,0,Math.PI*2); ctx.fill();
  });
  // Flowers
  for(let i=0;i<12;i++){
    const fx=30+Math.random()*450, fy=180+Math.random()*55;
    ctx.strokeStyle='#3a7a22'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(fx,fy+12); ctx.lineTo(fx,fy); ctx.stroke();
    ctx.fillStyle=['#ff66aa','#ffdd33','#ff8855','#cc55ff'][i%4];
    ctx.beginPath(); ctx.arc(fx,fy,5,0,Math.PI*2); ctx.fill();
  }
  return c;
}

// ─── STARGAZING ─────────────────────────────────────────────
export function stargazingBackground(scene) {
  // The stargazing level has a very detailed night sky already built in its init().
  // This function just enhances the atmosphere and ground.

  scene.background = new THREE.Color(0x04021a);
  scene.fog = new THREE.FogExp2(0x06031e, 0.012);

  // Cooler, deeper ambient
  scene.add(new THREE.AmbientLight(0x0d0840, 0.9));

  // Ground mist — low flat particles
  const mistGeo = new THREE.BufferGeometry();
  const mistPos = new Float32Array(300*3);
  for(let i=0;i<300;i++){
    const a=Math.random()*Math.PI*2, r=2+Math.random()*28;
    mistPos[i*3]   = Math.cos(a)*r;
    mistPos[i*3+1] = Math.random()*0.4;
    mistPos[i*3+2] = Math.sin(a)*r;
  }
  mistGeo.setAttribute('position',new THREE.BufferAttribute(mistPos,3));
  const mist = new THREE.Points(mistGeo,
    new THREE.PointsMaterial({color:0x4433aa,size:0.9,transparent:true,
      opacity:0.18,sizeAttenuation:true}));
  scene.add(mist);

  // Soft rim light from moon direction
  const moonRim = new THREE.DirectionalLight(0x8899dd, 0.35);
  moonRim.position.set(-20,40,30);
  scene.add(moonRim);

  // Purple atmospheric scatter near horizon
  const scatter = new THREE.Mesh(
    new THREE.CylinderGeometry(82,82,12,32,1,true),
    new THREE.MeshBasicMaterial({color:0x1a0855,transparent:true,
      opacity:0.35,side:THREE.BackSide,depthWrite:false})
  );
  scatter.position.y = 4;
  scene.add(scatter);

  let _t=0;
  return {
    update(dt) {
      _t += dt;
      mist.material.opacity = 0.12 + Math.sin(_t*0.4)*0.06;
    }
  };
}