// ============================================================
//  STARRY PICNIC — character-select.js
//  Studio Ghibli-inspired character selection screen
// ============================================================

export function showCharacterSelect(engine, onSelect) {

  // ── Fonts ────────────────────────────────────────────────
  if (!document.getElementById('cs-fonts')) {
    const link = document.createElement('link');
    link.id = 'cs-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cormorant+SC:wght@300;400;600&display=swap';
    document.head.appendChild(link);
  }

  const root = document.createElement('div');
  root.id = 'cs-root';
  root.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    overflow:hidden;cursor:default;
    font-family:'Cormorant Garamond',Georgia,serif;
  `;

  root.innerHTML = `
    <style>
      #cs-root *, #cs-root *::before, #cs-root *::after {
        box-sizing:border-box; margin:0; padding:0;
      }

      @keyframes cs-float  { 0%,100%{transform:translateY(0)}       50%{transform:translateY(-10px)} }
      @keyframes cs-floatB { 0%,100%{transform:translateY(0)}       50%{transform:translateY(-7px)}  }
      @keyframes cs-fadein { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      @keyframes cs-titlein{ from{opacity:0;letter-spacing:0.5em}   to{opacity:1;letter-spacing:0.12em} }
      @keyframes cs-pulse  { 0%,100%{opacity:0.3} 50%{opacity:0.7} }
      @keyframes cs-shimmer{
        0%  {background-position:200% center}
        100%{background-position:-200% center}
      }
      @keyframes cs-reveal {
        from{opacity:0;transform:translateY(30px) scale(0.97)}
        to  {opacity:1;transform:translateY(0)    scale(1)}
      }
      @keyframes cs-chosen {
        0%  {transform:scale(1)}
        35% {transform:scale(1.05)}
        70% {transform:scale(0.98)}
        100%{transform:scale(1.02)}
      }
      @keyframes cs-dustRise {
        0%  {opacity:0.8;transform:translateY(0) scale(1)}
        100%{opacity:0;  transform:translateY(-80px) scale(0.3) rotate(40deg)}
      }
      @keyframes cs-mote {
        0%  {transform:translate(0,0);    opacity:0}
        10% {opacity:0.6}
        90% {opacity:0.3}
        100%{transform:translate(var(--mx),var(--my)); opacity:0}
      }
      @keyframes cs-inkDraw {
        from{stroke-dashoffset:600}
        to  {stroke-dashoffset:0}
      }

      /* ── Sky layers ── */
      #cs-sky {
        position:absolute;inset:0;
        background:
          linear-gradient(
            to bottom,
            #0e0b1f 0%,
            #1a1035 18%,
            #2d1f52 38%,
            #4a2d5a 55%,
            #7a3d4a 70%,
            #c46a3a 84%,
            #e8925a 93%,
            #f5b87a 100%
          );
      }
      #cs-horizon-haze {
        position:absolute;bottom:0;left:0;right:0;height:38%;
        background:linear-gradient(to top,
          rgba(232,146,90,0.45) 0%,
          rgba(180,100,80,0.18) 50%,
          transparent 100%);
        pointer-events:none;
      }
      /* Silhouette hill */
      #cs-hills {
        position:absolute;bottom:0;left:0;right:0;height:220px;
        pointer-events:none;
      }

      /* ── Dust motes ── */
      .cs-mote {
        position:absolute;
        border-radius:50%;
        background:rgba(255,230,180,0.55);
        pointer-events:none;
        animation:cs-mote var(--dur) ease-in-out infinite var(--delay);
      }

      /* ── Layout ── */
      #cs-content {
        position:relative;z-index:3;
        display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        min-height:100vh;
        padding:48px 24px 56px;
        gap:0;
      }

      /* ── Title ── */
      .cs-eyebrow {
        font-family:'Cormorant SC',serif;
        font-size:11px;
        letter-spacing:0.45em;
        color:rgba(255,230,180,0.45);
        margin-bottom:16px;
        animation:cs-fadein 1s ease 0.1s both;
        text-transform:uppercase;
      }
      .cs-title {
        font-family:'Cormorant SC',serif;
        font-size:clamp(26px,3.8vw,44px);
        font-weight:300;
        letter-spacing:0.12em;
        color:#f5e6cc;
        animation:cs-titlein 1.2s ease 0.2s both;
        text-shadow:0 2px 24px rgba(200,140,80,0.35);
      }
      .cs-subtitle {
        margin-top:10px;
        font-size:17px;
        font-style:italic;
        color:rgba(240,210,170,0.4);
        font-weight:300;
        letter-spacing:0.04em;
        animation:cs-fadein 1s ease 0.5s both;
      }

      /* ── Divider line ── */
      .cs-rule {
        width:180px;height:1px;
        background:linear-gradient(to right,transparent,rgba(255,210,140,0.3),transparent);
        margin:28px auto 36px;
        animation:cs-fadein 1s ease 0.6s both;
      }

      /* ── Cards row ── */
      .cs-cards {
        display:flex;align-items:flex-start;
        gap:32px;flex-wrap:wrap;justify-content:center;
        animation:cs-reveal 0.9s ease 0.4s both;
      }

      /* ── Card ── */
      .cs-card {
        position:relative;
        width:240px;
        padding:40px 28px 32px;
        border-radius:4px;
        cursor:pointer;
        text-align:center;
        transition:transform 0.5s cubic-bezier(0.23,1,0.32,1);
        background:rgba(255,245,225,0.045);
        backdrop-filter:blur(6px);
        border:1px solid rgba(255,220,160,0.12);
      }
      .cs-card::after {
        content:'';
        position:absolute;inset:0;border-radius:4px;
        box-shadow:inset 0 0 0 1px rgba(255,220,160,0.07);
        pointer-events:none;
      }
      /* Corner ink marks */
      .cs-card::before {
        content:'';
        position:absolute;top:10px;left:10px;
        width:18px;height:18px;
        border-top:1px solid rgba(255,210,140,0.3);
        border-left:1px solid rgba(255,210,140,0.3);
        pointer-events:none;
        transition:border-color 0.3s;
      }
      .cs-card-corner-br {
        position:absolute;bottom:10px;right:10px;
        width:18px;height:18px;
        border-bottom:1px solid rgba(255,210,140,0.3);
        border-right:1px solid rgba(255,210,140,0.3);
        pointer-events:none;
        transition:border-color 0.3s;
      }

      .cs-card:hover {
        transform:translateY(-10px);
      }
      .cs-card:hover::before,
      .cs-card:hover .cs-card-corner-br {
        border-color:rgba(255,210,140,0.55);
      }
      .cs-card:hover .cs-card-bg {
        opacity:1;
      }
      .cs-card-bg {
        position:absolute;inset:0;border-radius:4px;
        opacity:0;transition:opacity 0.4s;
        pointer-events:none;
      }
      .cs-avicula .cs-card-bg {
        background:radial-gradient(ellipse at 50% 30%,rgba(255,200,100,0.07) 0%,transparent 70%);
      }
      .cs-purpura .cs-card-bg {
        background:radial-gradient(ellipse at 50% 30%,rgba(180,140,255,0.08) 0%,transparent 70%);
      }

      /* ── Floating illustration ── */
      .cs-illo {
        display:block;margin:0 auto 22px;
        animation:cs-float 5s ease-in-out infinite;
        filter:drop-shadow(0 8px 20px rgba(0,0,0,0.35));
      }
      .cs-purpura .cs-illo {
        animation:cs-floatB 5.8s ease-in-out infinite;
      }

      /* ── Name ── */
      .cs-name {
        font-family:'Cormorant SC',serif;
        font-size:22px;
        font-weight:400;
        letter-spacing:0.15em;
        margin-bottom:8px;
      }
      .cs-avicula .cs-name { color:#f5d9a0; }
      .cs-purpura .cs-name { color:#d4b8ff; }

      /* ── Desc ── */
      .cs-desc {
        font-size:14px;
        font-style:italic;
        font-weight:300;
        line-height:1.9;
        color:rgba(240,220,190,0.45);
        margin-bottom:18px;
      }

      /* ── Traits ── */
      .cs-traits {
        display:flex;flex-wrap:wrap;gap:6px;
        justify-content:center;margin-bottom:24px;
      }
      .cs-trait {
        font-family:'Cormorant SC',serif;
        font-size:10px;
        letter-spacing:0.18em;
        padding:3px 11px;
        border-radius:2px;
        border:1px solid;
      }
      .cs-avicula .cs-trait {
        color:rgba(245,210,140,0.7);
        border-color:rgba(245,210,140,0.2);
        background:rgba(245,210,140,0.04);
      }
      .cs-purpura .cs-trait {
        color:rgba(200,170,255,0.7);
        border-color:rgba(200,170,255,0.2);
        background:rgba(200,170,255,0.04);
      }

      /* ── Button ── */
      .cs-btn {
        display:inline-block;
        padding:9px 26px;
        border:1px solid;
        border-radius:2px;
        font-family:'Cormorant SC',serif;
        font-size:11px;
        font-weight:400;
        letter-spacing:0.2em;
        cursor:pointer;
        background:transparent;
        transition:background 0.25s,color 0.25s,border-color 0.25s,transform 0.2s;
        text-transform:uppercase;
      }
      .cs-btn:hover { transform:scale(1.04); }
      .cs-avicula .cs-btn {
        color:#f5d9a0;
        border-color:rgba(245,210,140,0.35);
      }
      .cs-avicula .cs-btn:hover {
        background:rgba(245,210,140,0.1);
        border-color:rgba(245,210,140,0.6);
      }
      .cs-purpura .cs-btn {
        color:#d4b8ff;
        border-color:rgba(200,170,255,0.35);
      }
      .cs-purpura .cs-btn:hover {
        background:rgba(200,170,255,0.1);
        border-color:rgba(200,170,255,0.6);
      }

      /* ── Centre divider ── */
      .cs-divider {
        display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        gap:14px;padding:0 16px;
        animation:cs-fadein 1s ease 0.7s both;
        color:rgba(255,220,160,0.2);
        font-family:'Cormorant Garamond',serif;
        font-size:13px;
        letter-spacing:0.3em;
        margin-top:40px;
      }
      .cs-divider svg {
        opacity:0.3;
      }

      /* ── Hint ── */
      .cs-hint {
        margin-top:44px;
        font-family:'Cormorant SC',serif;
        font-size:10px;
        letter-spacing:0.4em;
        color:rgba(255,220,160,0.2);
        animation:cs-pulse 4s ease-in-out infinite;
        text-transform:uppercase;
      }
    </style>

    <!-- Sky -->
    <div id="cs-sky"></div>
    <div id="cs-horizon-haze"></div>

    <!-- Animated canvas (stars + moon) -->
    <canvas id="cs-canvas" style="position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;pointer-events:none;"></canvas>

    <!-- SVG hills silhouette -->
    <svg id="cs-hills" viewBox="0 0 1440 220" preserveAspectRatio="none"
         xmlns="http://www.w3.org/2000/svg" style="z-index:2;">
      <!-- Back hills -->
      <path d="M0,180 C120,120 260,90 400,110 C540,130 620,80 760,95
               C900,110 1020,70 1160,90 C1280,108 1380,85 1440,100 L1440,220 L0,220Z"
            fill="rgba(18,12,35,0.75)"/>
      <!-- Mid hills -->
      <path d="M0,200 C80,160 180,140 300,155 C440,172 520,130 660,148
               C800,166 920,125 1060,145 C1180,162 1340,138 1440,155 L1440,220 L0,220Z"
            fill="rgba(12,8,25,0.88)"/>
      <!-- Foreground dark strip -->
      <path d="M0,215 C200,205 400,200 600,208 C800,216 1100,202 1440,210 L1440,220 L0,220Z"
            fill="rgba(6,4,15,0.95)"/>
      <!-- Tiny tree silhouettes -->
      <g fill="rgba(8,5,20,0.95)">
        <rect x="60"  y="168" width="3" height="22"/>
        <polygon points="61.5,148 55,170 68,170"/>
        <rect x="110" y="172" width="3" height="18"/>
        <polygon points="111.5,154 105,174 118,174"/>
        <rect x="1340" y="165" width="3" height="25"/>
        <polygon points="1341.5,144 1335,167 1348,167"/>
        <rect x="1390" y="170" width="3" height="20"/>
        <polygon points="1391.5,151 1385,172 1398,172"/>
      </g>
    </svg>

    <!-- Content -->
    <div id="cs-content">
      <div style="text-align:center;animation:cs-fadein 0.9s ease 0.1s both;margin-bottom:36px;">
        <div class="cs-eyebrow">A Starry Picnic</div>
        <div class="cs-title">Who shall wander tonight?</div>
        <div class="cs-subtitle">Choose your companion for the journey</div>
        <div class="cs-rule"></div>
      </div>

      <div class="cs-cards">

        <!-- Avicula -->
        <div class="cs-card cs-avicula" id="cs-avicula" tabindex="0" role="button" aria-label="Choose Avicula">
          <div class="cs-card-bg"></div>
          <div class="cs-card-corner-br"></div>

          <!-- Watercolour-style Avicula illustration -->
          <svg class="cs-illo" width="108" height="120" viewBox="0 0 108 120">

  <!-- warm celestial glow -->
  <radialGradient id="avGlowDrift" cx="50%" cy="50%" r="60%">
    <stop offset="0%" stop-color="#ffd9a3" stop-opacity="0.6">
      <animate attributeName="stop-opacity"
               values="0.45;0.7;0.45"
               dur="6s"
               repeatCount="indefinite"/>
    </stop>
    <stop offset="100%" stop-color="#ffd9a3" stop-opacity="0"/>
  </radialGradient>

  <circle cx="54" cy="60" r="42" fill="url(#avGlowDrift)"/>

  <!-- drifting star -->
  <g>
    <animateTransform attributeName="transform"
                      type="translate"
                      values="0,0; 0,-4; 0,0"
                      dur="7s"
                      repeatCount="indefinite"/>

    <animate attributeName="opacity"
             values="0.75;1;0.75"
             dur="5.5s"
             repeatCount="indefinite"/>

    <path d="M54 30
             L60 47
             L78 49
             L63 59
             L69 76
             L54 66
             L39 76
             L45 59
             L30 49
             L48 47 Z"
          fill="#e7c07a"
          opacity="0.9"/>

    <!-- soft inner light pulse -->
    <path d="M54 34 L54 66"
          stroke="rgba(255,240,210,0.35)"
          stroke-width="1"/>

    <path d="M44 52 L64 52"
          stroke="rgba(255,240,210,0.25)"
          stroke-width="1"/>
  </g>

  <!-- distant motes -->
  <circle cx="18" cy="38" r="1.2" fill="#ffe7c0" opacity="0.35"/>
  <circle cx="92" cy="34" r="1" fill="#ffe7c0" opacity="0.25"/>
  <circle cx="22" cy="86" r="1" fill="#ffe7c0" opacity="0.2"/>

</svg>
          </svg>

          <div class="cs-name">Avicula</div>
          <div class="cs-desc">Warm as an afternoon<br>in the wheat fields</div>
          <div class="cs-traits">
            <span class="cs-trait">Bright</span>
            <span class="cs-trait">Curious</span>
            <span class="cs-trait">Gentle</span>
          </div>
          <button class="cs-btn">Begin his story</button>
        </div>

        <!-- Divider -->
        <div class="cs-divider">
          <svg width="1" height="80" viewBox="0 0 1 80">
            <line x1="0.5" y1="0" x2="0.5" y2="80"
                  stroke="rgba(255,210,140,0.25)" stroke-width="1"
                  stroke-dasharray="3,4"/>
          </svg>
          <span style="font-size:16px;opacity:0.25">or</span>
          <svg width="1" height="80" viewBox="0 0 1 80">
            <line x1="0.5" y1="0" x2="0.5" y2="80"
                  stroke="rgba(255,210,140,0.25)" stroke-width="1"
                  stroke-dasharray="3,4"/>
          </svg>
        </div>

        <!-- Purpura -->
        <div class="cs-card cs-purpura" id="cs-purpura" tabindex="0" role="button" aria-label="Choose Purpura">
          <div class="cs-card-bg"></div>
          <div class="cs-card-corner-br"></div>

          <svg class="cs-illo" width="108" height="120" viewBox="0 0 108 120">

  <!-- cool moon glow -->
  <radialGradient id="purGlowDrift" cx="50%" cy="50%" r="60%">
    <stop offset="0%" stop-color="#cbb7ff" stop-opacity="0.55">
      <animate attributeName="stop-opacity"
               values="0.4;0.65;0.4"
               dur="7s"
               repeatCount="indefinite"/>
    </stop>
    <stop offset="100%" stop-color="#cbb7ff" stop-opacity="0"/>
  </radialGradient>

  <circle cx="54" cy="60" r="42" fill="url(#purGlowDrift)"/>

  <!-- drifting star body -->
  <g>
    <animateTransform attributeName="transform"
                      type="translate"
                      values="0,0; 0,-3; 0,0"
                      dur="8s"
                      repeatCount="indefinite"/>

    <animate attributeName="opacity"
             values="0.7;0.95;0.7"
             dur="6.5s"
             repeatCount="indefinite"/>

    <path d="M54 30
             L60 46
             L78 48
             L63 58
             L70 76
             L54 65
             L38 76
             L45 58
             L30 48
             L48 46 Z"
          fill="#b9a2ff"
          opacity="0.88"/>

    <!-- faint internal structure -->
    <path d="M52 34 L56 66"
          stroke="rgba(220,200,255,0.25)"
          stroke-width="1"/>

    <path d="M42 52 L66 54"
          stroke="rgba(220,200,255,0.2)"
          stroke-width="1"/>
  </g>

  <!-- drifting stardust -->
  <circle cx="16" cy="34" r="1" fill="#e0d2ff" opacity="0.3"/>
  <circle cx="94" cy="38" r="1.2" fill="#e0d2ff" opacity="0.25"/>
  <circle cx="22" cy="84" r="1" fill="#e0d2ff" opacity="0.2"/>

</svg>

          <div class="cs-name">Purpura</div>
          <div class="cs-desc">Still as a forest at dusk,<br>deep as the sky above</div>
          <div class="cs-traits">
            <span class="cs-trait">Dreamy</span>
            <span class="cs-trait">Wise</span>
            <span class="cs-trait">Calm</span>
          </div>
          <button class="cs-btn">Begin her story</button>
        </div>

      </div>

      <div class="cs-hint">Choose a companion to begin</div>
    </div>
  `;

  document.body.appendChild(root);
engine.audio.playLevelMusic('characterSelect');

  // ── Canvas: stars + soft moon ────────────────────────────
  const canvas = root.querySelector('#cs-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  // Moon
  function drawMoon() {
    const mx = canvas.width * 0.78, my = canvas.height * 0.22, mr = 38;
    // Glow
    const g = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 2.8);
    g.addColorStop(0,   'rgba(255,240,200,0.12)');
    g.addColorStop(0.5, 'rgba(255,230,180,0.05)');
    g.addColorStop(1,   'rgba(255,220,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 2.8, 0, Math.PI * 2);
    ctx.fill();
    // Moon disc
    const mg = ctx.createRadialGradient(mx - 6, my - 6, 2, mx, my, mr);
    mg.addColorStop(0,   '#fffaee');
    mg.addColorStop(0.6, '#f5e8c8');
    mg.addColorStop(1,   '#e8d4a8');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    // Subtle craters
    [[-10,-8,5],[ 8, 6,3],[-4,12,4]].forEach(([cx,cy,cr]) => {
      ctx.beginPath();
      ctx.arc(mx+cx, my+cy, cr, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(200,180,140,0.12)';
      ctx.fill();
    });
  }

  // Stars — small, not many, muted
  const stars = Array.from({ length: 160 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height * 0.75,
    r:     Math.random() * 1.1 + 0.2,
    op:    Math.random() * 0.5 + 0.15,
    speed: 0.3 + Math.random() * 1.5,
    phase: Math.random() * Math.PI * 2,
    warm:  Math.random() > 0.6,
  }));

  // Shooting stars — rare, slow, graceful
  const shooters = [];
  const spawnShooter = () => {
    if (!root.isConnected) return;
    shooters.push({
      x: Math.random() * canvas.width * 0.5,
      y: Math.random() * canvas.height * 0.35,
      len: 70 + Math.random() * 100,
      life: 0,
      maxLife: 2.0 + Math.random() * 1.0,
      vx: 160 + Math.random() * 120,
      vy: 80  + Math.random() * 60,
    });
  };
  const shootInterval = setInterval(spawnShooter, 4000);
  spawnShooter();

  // Dust motes (DOM)
  for (let i = 0; i < 18; i++) {
    const m = document.createElement('div');
    m.className = 'cs-mote';
    const sz = 2 + Math.random() * 3;
    const dur = 6 + Math.random() * 10;
    const delay = -(Math.random() * dur);
    const mx2 = (Math.random() - 0.5) * 60;
    const my2 = -(30 + Math.random() * 80);
    m.style.cssText += `
      width:${sz}px;height:${sz}px;
      left:${Math.random()*100}%;
      top:${40 + Math.random()*50}%;
      --dur:${dur}s;--delay:${delay}s;
      --mx:${mx2}px;--my:${my2}px;
      opacity:0;
    `;
    root.appendChild(m);
  }

  let lastT = null;
  const draw = (ts) => {
    if (!root.isConnected) return;
    const dt = lastT ? Math.min((ts - lastT) / 1000, 0.05) : 0;
    lastT = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMoon();

    const t = ts / 1000;
    stars.forEach(s => {
      const twinkle = s.op * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.warm
        ? `rgba(255,240,200,${twinkle})`
        : `rgba(220,215,255,${twinkle})`;
      ctx.fill();
    });

    for (let i = shooters.length - 1; i >= 0; i--) {
      const sh = shooters[i];
      sh.life += dt;
      const prog = sh.life / sh.maxLife;
      const fade = prog < 0.15 ? prog / 0.15 : 1 - (prog - 0.15) / 0.85;
      const cx2 = sh.x + sh.vx * sh.life;
      const cy2 = sh.y + sh.vy * sh.life;
      const ang  = Math.atan2(sh.vy, sh.vx);
      const tailX = cx2 - Math.cos(ang) * sh.len * fade;
      const tailY = cy2 - Math.sin(ang) * sh.len * fade;
      const g = ctx.createLinearGradient(cx2, cy2, tailX, tailY);
      g.addColorStop(0,   `rgba(255,248,230,${fade * 0.75})`);
      g.addColorStop(0.5, `rgba(230,210,255,${fade * 0.25})`);
      g.addColorStop(1,   'rgba(200,180,255,0)');
      ctx.beginPath();
      ctx.moveTo(cx2, cy2);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = g;
      ctx.lineWidth = fade * 1.2;
      ctx.stroke();
      if (sh.life >= sh.maxLife) shooters.splice(i, 1);
    }

    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  // ── Dust mote burst on pick ──────────────────────────────
  function dustBurst(card, isAv) {
    const rect = card.getBoundingClientRect();
    const cx2 = rect.left + rect.width  / 2;
    const cy2 = rect.top  + rect.height / 2;
    for (let i = 0; i < 16; i++) {
      const dot = document.createElement('div');
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.3;
      const dist  = 40 + Math.random() * 80;
      const sz    = 2 + Math.random() * 4;
      dot.style.cssText = `
        position:fixed;border-radius:50%;pointer-events:none;z-index:99999;
        width:${sz}px;height:${sz}px;
        background:${isAv ? 'rgba(255,220,140,0.8)' : 'rgba(200,170,255,0.8)'};
        left:${cx2 + Math.cos(angle) * dist}px;
        top:${cy2  + Math.sin(angle) * dist}px;
        animation:cs-dustRise ${0.8 + Math.random() * 0.6}s ease-out ${i * 0.025}s forwards;
      `;
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 1600);
    }
  }

  // ── Pick ─────────────────────────────────────────────────
  function pick(name) {
    clearInterval(shootInterval);
      engine.audio.musicStop(); // ← add this

    const card  = root.querySelector(`#cs-${name}`);
    const isAv  = name === 'avicula';
    dustBurst(card, isAv);
    card.style.animation = 'cs-chosen 0.5s ease forwards';
    root.style.transition = 'opacity 0.7s ease';
    setTimeout(() => { root.style.opacity = '0'; }, 250);
    setTimeout(() => {
      root.remove();
      _buildCharBadge(name);
      onSelect(name);
    }, 950);
  }

  root.querySelector('#cs-avicula').addEventListener('click', () => pick('avicula'));
  root.querySelector('#cs-purpura').addEventListener('click', () => pick('purpura'));
  root.querySelector('#cs-avicula').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') pick('avicula'); });
  root.querySelector('#cs-purpura').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') pick('purpura'); });

  // Prevent btn double-fire
  root.querySelectorAll('.cs-btn').forEach(btn => btn.addEventListener('click', e => e.stopPropagation()));
  root.querySelector('.cs-avicula .cs-btn').addEventListener('click', () => pick('avicula'));
  root.querySelector('.cs-purpura .cs-btn').addEventListener('click', () => pick('purpura'));
}

// ── Character badge ───────────────────────────────────────────
function _buildCharBadge(name) {
  document.getElementById('char-badge')?.remove();
  const isAv = name === 'avicula';

  if (!document.getElementById('cs-fonts')) {
    const link = document.createElement('link');
    link.id  = 'cs-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+SC:wght@400&display=swap';
    document.head.appendChild(link);
  }

  if (!document.getElementById('cs-badge-style')) {
    const st = document.createElement('style');
    st.id = 'cs-badge-style';
    st.textContent = `
      @keyframes cs-fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    `;
    document.head.appendChild(st);
  }

  const badge = document.createElement('div');
  badge.id = 'char-badge';
  badge.style.cssText = `
    position:fixed;bottom:22px;left:22px;
    display:flex;align-items:center;gap:9px;
    background:rgba(4,2,12,0.82);
    border:1px solid ${isAv ? 'rgba(245,210,140,0.3)' : 'rgba(180,140,255,0.3)'};
    border-radius:3px;
    padding:7px 16px 7px 10px;
    font-family:'Cormorant SC',Georgia,serif;
    font-size:11px;letter-spacing:0.18em;
    color:${isAv ? '#f5d9a0' : '#d4b8ff'};
    pointer-events:none;z-index:9999;
    backdrop-filter:blur(8px);
    box-shadow:0 2px 16px ${isAv ? 'rgba(200,150,60,0.12)' : 'rgba(130,80,220,0.14)'};
    animation:cs-fadein 0.6s ease both;
    text-transform:uppercase;
  `;
  badge.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 12 12">
      <polygon points="6,0.5 7.5,4 11.5,4 8.5,6.5 9.5,10.5 6,8 2.5,10.5 3.5,6.5 0.5,4 4.5,4"
               fill="${isAv ? '#f5d9a0' : '#d4b8ff'}" opacity="0.85"/>
    </svg>
    ${isAv ? 'Avicula' : 'Purpura'}
  `;
  document.body.appendChild(badge);
}