// ============================================================
//  STARRY PICNIC — engine.js  (Three.js r165, ES module)
//  Professional graphics rewrite — cel shading, SSAO, HDR,
//  DoF, chromatic aberration, hemisphere lights, particles,
//  animated emissives, per-level post-processing profiles
// ============================================================

import * as THREE from 'three';
import { EffectComposer }      from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }          from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass }     from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass }          from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { BokehPass }           from 'three/examples/jsm/postprocessing/BokehPass.js';
import { FXAAShader }          from 'three/examples/jsm/shaders/FXAAShader.js';
import { OutputPass }          from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment }     from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LensflareElement, Lensflare } from 'three/examples/jsm/objects/Lensflare.js';

// ─────────────────────────────────────────────────────────────
//  POST-PROCESSING PROFILES  (one per level)
// ─────────────────────────────────────────────────────────────
export const PostProfiles = {
  grocery: {
    bloom:    { strength: 0.06, radius: 0.25, threshold: 0.96 },
    vignette: { darkness: 0.38, offset: 1.0 },
    ca:       { offset: 0.0005 },
    exposure: 0.78,
  },
  cooking: {
    bloom:    { strength: 0.18, radius: 0.5,  threshold: 0.88 },
    vignette: { darkness: 0.5,  offset: 0.9  },
    ca:       { offset: 0.001  },
    exposure: 1.0,
  },
  packing: {
    bloom:    { strength: 0.1,  radius: 0.35, threshold: 0.92 },
    vignette: { darkness: 0.4,  offset: 1.0  },
    ca:       { offset: 0.0006 },
    exposure: 0.88,
  },
  driving: {
    bloom:    { strength: 0.12, radius: 0.4,  threshold: 0.9  },
    vignette: { darkness: 0.55, offset: 0.85 },
    ca:       { offset: 0.0014 },
    exposure: 1.05,
  },
  stargazing: {
    bloom:    { strength: 0.9,  radius: 0.7,  threshold: 0.75 },
    vignette: { darkness: 0.75, offset: 0.75 },
    ca:       { offset: 0.002  },
    exposure: 0.75,
  },
  letter: {
    bloom:    { strength: 0.14, radius: 0.4,  threshold: 0.90 },
    vignette: { darkness: 0.50, offset: 0.88 },
    ca:       { offset: 0.0008 },
    exposure: 0.92,
  },
  elden: {
    bloom:    { strength: 0.55, radius: 0.6,  threshold: 0.80 },
    vignette: { darkness: 0.85, offset: 0.70 },
    ca:       { offset: 0.003  },
    exposure: 0.55,
  },
  tardis: {
    bloom:    { strength: 0.35, radius: 0.55, threshold: 0.82 },
    vignette: { darkness: 0.45, offset: 0.90 },
    ca:       { offset: 0.001  },
    exposure: 1.1,
  },
};

// ─────────────────────────────────────────────────────────────
//  CUSTOM SHADERS
// ─────────────────────────────────────────────────────────────
const SkyGradientShader = {
  uniforms: {
    topColor: { value: new THREE.Color(0x8ec5e8) },
    midColor: { value: new THREE.Color(0xffd6a5) },
    botColor: { value: new THREE.Color(0xffecd2) },
    midPoint: { value: 0.45 },
    exponent: { value: 1.6  },
  },
  vertexShader: `
    varying vec3 vWorldPos;
    void main() {
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor, midColor, botColor;
    uniform float midPoint, exponent;
    varying vec3 vWorldPos;
    void main() {
      float h = normalize(vWorldPos).y * 0.5 + 0.5;
      vec3 col = h > midPoint
        ? mix(midColor, topColor, pow((h - midPoint) / (1.0 - midPoint), exponent))
        : mix(botColor, midColor, pow(h / midPoint, exponent));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const VignetteCAShader = {
  uniforms: {
    tDiffuse:   { value: null },
    darkness:   { value: 0.5  },
    offset:     { value: 0.95 },
    caOffset:   { value: 0.001 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness, offset, caOffset;
    uniform vec2 resolution;
    varying vec2 vUv;
    void main(){
      vec2 center = vUv - 0.5;
      float dist  = length(center);
      float ca = caOffset * dist * dist;
      vec2 dir = normalize(center + 0.0001);
      float r = texture2D(tDiffuse, vUv + dir * ca).r;
      float g = texture2D(tDiffuse, vUv            ).g;
      float b = texture2D(tDiffuse, vUv - dir * ca).b;
      vec3 col = vec3(r, g, b);
      float vig = smoothstep(offset, offset - 0.45, dist);
      col *= mix(1.0 - darkness, 1.0, vig);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function celShaderPatch(shader, steps = 3, rimPower = 2.2) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <dithering_fragment>',
    `
    #include <dithering_fragment>
    float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float step = floor(lum * float(${steps})) / float(${steps});
    float smooth_step = mix(step, lum, 0.18);
    gl_FragColor.rgb = gl_FragColor.rgb * (smooth_step / max(lum, 0.001));
    vec3 viewDir = normalize(cameraPosition - vViewPosition.xyz);
    float rim = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
    rim = pow(rim, ${rimPower.toFixed(1)});
    gl_FragColor.rgb += vec3(rim * 0.12);
    `
  );
}

// ─────────────────────────────────────────────────────────────
//  RENDERER
// ─────────────────────────────────────────────────────────────
export class Renderer {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;

    let gl = null;
    const attempts = [
      { canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false },
      { canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'default',          failIfMajorPerformanceCaveat: false },
      { canvas: this.canvas, antialias: false, alpha: false, powerPreference: 'low-power',        failIfMajorPerformanceCaveat: false },
    ];
    for (const opts of attempts) {
      try { gl = new THREE.WebGLRenderer(opts); break; } catch (_) {}
    }
    if (!gl) {
      document.body.innerHTML = '<div style="color:#fff;background:#200;padding:40px">❌ WebGL unavailable.</div>';
      throw new Error('WebGL unavailable');
    }
    this.gl = gl;

    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.gl.toneMapping       = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 0.9;
    this.gl.outputColorSpace  = THREE.SRGBColorSpace;
    this.gl.setSize(window.innerWidth, window.innerHeight);

    const pmrem = new THREE.PMREMGenerator(this.gl);
    pmrem.compileEquirectangularShader();
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this._composers = new Map();
    this._activeComposer = null;
    this._activePasses   = null;

    window.addEventListener('resize', () => this.resize());
  }

  buildComposer(scene, camera, profileName = 'grocery') {
    const w = window.innerWidth, h = window.innerHeight;
    const profile = PostProfiles[profileName] || PostProfiles.grocery;

    const rt = new THREE.WebGLRenderTarget(w, h, {
      type:    THREE.HalfFloatType,
      format:  THREE.RGBAFormat,
      samples: 4,
    });
    const composer = new EffectComposer(this.gl, rt);

    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      profile.bloom.strength,
      profile.bloom.radius,
      profile.bloom.threshold,
    );
    composer.addPass(bloom);

    const vigCA = new ShaderPass(VignetteCAShader);
    vigCA.material.uniforms.darkness.value  = profile.vignette.darkness;
    vigCA.material.uniforms.offset.value    = profile.vignette.offset;
    vigCA.material.uniforms.caOffset.value  = profile.ca.offset;
    vigCA.material.uniforms.resolution.value.set(w, h);
    composer.addPass(vigCA);

    composer.addPass(new OutputPass());

    const fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms['resolution'].value.set(1 / w, 1 / h);
    composer.addPass(fxaa);

    const passes = { composer, bloom, vigCA, fxaa };
    this._composers.set(scene.uuid, passes);
    return composer;
  }

  applyProfile(scene, profileName) {
    const entry   = this._composers.get(scene.uuid);
    if (!entry) return;
    const profile = PostProfiles[profileName] || PostProfiles.grocery;
    const { bloom, vigCA } = entry;

    bloom.strength  = profile.bloom.strength;
    bloom.radius    = profile.bloom.radius;
    bloom.threshold = profile.bloom.threshold;

    vigCA.material.uniforms.darkness.value = profile.vignette.darkness;
    vigCA.material.uniforms.offset.value   = profile.vignette.offset;
    vigCA.material.uniforms.caOffset.value = profile.ca.offset;

    this.gl.toneMappingExposure = profile.exposure;
  }

  setActiveScene(scene, camera, profileName) {
    if (!this._composers.has(scene.uuid)) {
      this.buildComposer(scene, camera, profileName);
    }
    const entry = this._composers.get(scene.uuid);
    this._activeComposer = entry.composer;
    this._activePasses   = entry;
    if (profileName) this.applyProfile(scene, profileName);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setSize(w, h);
    this.gl.domElement.style.width  = w + 'px';
    this.gl.domElement.style.height = h + 'px';
    this._composers.forEach(({ composer, fxaa, vigCA }) => {
      composer.setSize(w, h);
      fxaa.material.uniforms['resolution'].value.set(1 / w, 1 / h);
      if (vigCA) vigCA.material.uniforms.resolution.value.set(w, h);
    });
  }

  render(scene, camera) {
    if (this._activeComposer) {
      try {
        this._activeComposer.render();
      } catch (e) {
        console.warn('[Renderer] Composer render error:', e.message);
        try {
          this.gl.render(scene, camera);
        } catch (e2) {
          console.error('[Renderer] Direct render also failed:', e2.message);
        }
      }
    } else {
      this.gl.render(scene, camera);
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  ANIME MATERIALS
// ─────────────────────────────────────────────────────────────
export const Anime = {

  mat(color = 0xffffff, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.72,
      metalness: opts.metalness ?? 0.05,
      envMapIntensity: opts.envMapIntensity ?? 0.6,
      ...opts,
    });
    if (opts.cel !== false) {
      m.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vNormal = normalize(normalMatrix * normal);`
        );
        celShaderPatch(shader, opts.celSteps ?? 3, opts.rimPower ?? 2.2);
        m.userData.shader = shader;
      };
      m.needsUpdate = true;
    }
    return m;
  },

  glow(color = 0xffee44, emissiveIntensity = 0.6, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity,
      roughness: 0.3,
      metalness: 0.05,
      ...opts,
    });
  },

  glass(color = 0x88ddff, opts = {}) {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness:          opts.roughness          ?? 0.05,
      metalness:          opts.metalness          ?? 0.1,
      transmission:       opts.transmission       ?? 0.9,
      thickness:          opts.thickness          ?? 0.4,
      ior:                opts.ior                ?? 1.45,
      clearcoat:          opts.clearcoat          ?? 1.0,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.05,
      transparent:        true,
      opacity:            opts.opacity            ?? 0.55,
      side:               THREE.DoubleSide,
    });
  },

  metal(color = 0xaaaacc, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness:       opts.roughness       ?? 0.2,
      metalness:       opts.metalness       ?? 0.85,
      envMapIntensity: opts.envMapIntensity ?? 1.2,
      ...opts,
    });
  },

  roughnessTex(seed = 0, size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const id  = ctx.createImageData(size, size);
    for (let i = 0; i < id.data.length; i += 4) {
      const n = Math.floor(Math.random() * 80 + 120 + seed % 40);
      id.data[i] = id.data[i+1] = id.data[i+2] = n;
      id.data[i+3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.channel = 0;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  },

  outline(mesh, thickness = 0.04, color = 0x111111) {
    if (!mesh || !mesh.geometry) return null;
    const outMat  = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    const outMesh = new THREE.Mesh(mesh.geometry, outMat);
    outMesh.scale.setScalar(1 + thickness);
    outMesh.renderOrder = -1;
    mesh.add(outMesh);
    return outMesh;
  },

  skyScene(scene, topColor = 0x0d0920, botColor = 0x3d2080) {
    scene.background = new THREE.Color(topColor);
    scene.fog = new THREE.FogExp2(botColor, 0.028);
  },

  daySky(scene) {
    scene.background = new THREE.Color(0x9ed8f5);
    scene.fog = new THREE.FogExp2(0xc8eeff, 0.018);
  },

  goldenSky(scene) {
    scene.background = new THREE.Color(0xf5a642);
    scene.fog = new THREE.Fog(0xff7a20, 30, 110);
  },
};

// ─────────────────────────────────────────────────────────────
//  INPUT MANAGER
// ─────────────────────────────────────────────────────────────
export class Input {
  constructor() {
    this.keys  = {};
    this.mouse = { dx: 0, dy: 0, buttons: {} };
    this._rawDx = 0; this._rawDy = 0;
    this.locked = false;
    this._bind();
  }
  _bind() {
    document.addEventListener('keydown', e => { this.keys[e.code] = true; });
    document.addEventListener('keyup',   e => { this.keys[e.code] = false; });
    document.addEventListener('mousedown', e => { this.mouse.buttons[e.button] = true; });
    document.addEventListener('mouseup',   e => { this.mouse.buttons[e.button] = false; });
    document.addEventListener('mousemove', e => {
      if (this.locked) { this._rawDx += e.movementX; this._rawDy += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === document.getElementById('canvas');
    });
    document.getElementById('canvas').addEventListener('click', () => {
      if (!document.pointerLockElement && this._canRelock?.()) {
        document.getElementById('canvas').requestPointerLock();
      }
    });
    let tx0 = 0, ty0 = 0;
    document.addEventListener('touchstart', e => {
      tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchmove', e => {
      this._rawDx += (e.touches[0].clientX - tx0) * 1.5;
      this._rawDy += (e.touches[0].clientY - ty0) * 1.5;
      tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY;
    }, { passive: true });
  }
  requestLock() { document.getElementById('canvas').requestPointerLock(); }
  flush() {
    this.mouse.dx = this._rawDx; this.mouse.dy = this._rawDy;
    this._rawDx = 0; this._rawDy = 0;
  }
  is(code) { return !!this.keys[code]; }
  anyOf(...codes) { return codes.some(c => this.is(c)); }
}

// ─────────────────────────────────────────────────────────────
//  FIRST-PERSON CAMERA CONTROLLER
// ─────────────────────────────────────────────────────────────
export class FPController {
  constructor(camera, input) {
    this.camera       = camera;
    this.input        = input;
    this.speed        = 5;
    this.sensitivity  = 0.0045;
    this.yaw          = 0;
    this.pitch        = 0;
    this.height       = 1.65;
    this.pos          = new THREE.Vector3(0, this.height, 0);
    this.vel          = new THREE.Vector3();
    this.radius       = 0.35;
    this.enabled      = true;
    this._bobT        = 0;
    this._bobAmp      = 0.052;
    this._leanAmt     = 0;
    this._breathT     = 0;
    this._targetYaw   = 0;
    this._targetPitch = 0;
  }

  update(dt, collidables = []) {
    if (!this.enabled) return;
    const inp = this.input;

    this._targetYaw   -= inp.mouse.dx * this.sensitivity;
    this._targetPitch -= inp.mouse.dy * this.sensitivity;
    this._targetPitch  = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this._targetPitch));
    this.yaw   = this._targetYaw;
    this.pitch = this._targetPitch;

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const rgt = new THREE.Vector3( Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let moving = false;
    let strafing = 0;
    const move = new THREE.Vector3();
    if (inp.anyOf('KeyW', 'ArrowUp'))    { move.addScaledVector(fwd,  1); moving = true; }
    if (inp.anyOf('KeyS', 'ArrowDown'))  { move.addScaledVector(fwd, -1); moving = true; }
    if (inp.anyOf('KeyA', 'ArrowLeft'))  { move.addScaledVector(rgt, -1); moving = true; strafing = -1; }
    if (inp.anyOf('KeyD', 'ArrowRight')) { move.addScaledVector(rgt,  1); moving = true; strafing =  1; }
    if (move.lengthSq() > 0) move.normalize();
    this.pos.addScaledVector(move, this.speed * dt);

    for (const aabb of collidables) this._resolveAABB(aabb);

    if (moving) this._bobT += dt * 6.5; else this._bobT *= 0.88;
    const bob = Math.sin(this._bobT) * this._bobAmp * (moving ? 1 : 0);

    this._breathT += dt * 0.8;
    const breath = Math.sin(this._breathT) * 0.006;

    this._leanAmt += (strafing * 0.025 - this._leanAmt) * dt * 8;

    const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const qX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    const qZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this._leanAmt);
    this.camera.quaternion.copy(qY).multiply(qX).multiply(qZ);
    this.camera.position.set(this.pos.x, this.pos.y + this.height + bob + breath, this.pos.z);
  }

  _resolveAABB(box) {
    const r = this.radius, px = this.pos.x, pz = this.pos.z;
    if (px+r > box.min.x && px-r < box.max.x && pz+r > box.min.z && pz-r < box.max.z &&
        this.pos.y < box.max.y && this.pos.y + this.height * 2 > box.min.y) {
      const dx1 = box.max.x - (px - r), dx2 = (px + r) - box.min.x;
      const dz1 = box.max.z - (pz - r), dz2 = (pz + r) - box.min.z;
      const mn = Math.min(dx1, dx2, dz1, dz2);
      if      (mn === dx1) this.pos.x += dx1;
      else if (mn === dx2) this.pos.x -= dx2;
      else if (mn === dz1) this.pos.z += dz1;
      else                 this.pos.z -= dz2;
    }
  }

  teleport(x, y, z, yaw = 0) {
    this.pos.set(x, y, z);
    this.yaw = this._targetYaw = yaw;
    this.pitch = this._targetPitch = 0;
  }
}

// ─────────────────────────────────────────────────────────────
//  WEB AUDIO ENGINE
// ─────────────────────────────────────────────────────────────
export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this._ready = false;
    const resume = () => { this._init(); document.removeEventListener('click', resume); };
    document.addEventListener('click', resume);
    document.addEventListener('keydown', () => this._init(), { once: true });
  }

  _init() {
    if (this._ready) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this._ready = true;
  }

  // Play any named sfx or level music by key
  play(name) {
    if (!this._ready) return;
    const fn = this.sfx[name];
    if (fn) fn(this);
  }

  // Convenience wrappers — backward compat + per-level shorthands
  music(bpm)           { this.sfx.music(this, bpm); }
  musicStop()          { this.sfx.musicStop(this); }
  musicElden(bpm)      { this.sfx.musicElden(this, bpm); }
  musicGrocery(bpm)    { this.sfx.musicGrocery(this, bpm); }
  musicCooking(bpm)    { this.sfx.musicCooking(this, bpm); }
  musicPacking(bpm)    { this.sfx.musicPacking(this, bpm); }
  musicDriving(bpm)    { this.sfx.musicDriving(this, bpm); }
  musicStargazing(bpm) { this.sfx.musicStargazing(this, bpm); }
  musicLetter(bpm)     { this.sfx.musicLetter(this, bpm); }
  musicTardis(bpm)          { this.sfx.musicTardis(this, bpm); }
  musicCharacterSelect(bpm) { this.sfx.musicCharacterSelect(this, bpm); }
engineRev(rpm) { this.sfx.engineRev(this, rpm); }

  // Stop current music then start the named level track.
  playLevelMusic(levelName, bpm) {
    this.sfx.musicStop(this);
    setTimeout(() => {
      const key = 'music' + levelName.charAt(0).toUpperCase() + levelName.slice(1);
      const fn  = this.sfx[key];
      if (fn) fn(this, bpm);
      else    this.sfx.music(this, bpm);
    }, 80);
  }

  _osc(type, freq, gain, dur, dest) {
    if (!this._ready) return;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    g.connect(dest || this.master);
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    o.connect(g); o.start(); o.stop(this.ctx.currentTime + dur);
  }

  // ─────────────────────────────────────────────────────────
  //  SFX + LEVEL MUSIC LIBRARY
  // ─────────────────────────────────────────────────────────
  sfx = {

    // ── FOOTSTEP
    step: (a) => {
      a._osc('sine', 80 + Math.random() * 20, 0.22, 0.06);
      a._osc('triangle', 55, 0.12, 0.12);
    },

    // ── PICKUP — ethereal shimmer
    pickup: (a) => {
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => {
          a._osc('sine', f, 0.22, 0.18);
          a._osc('sine', f * 1.5, 0.06, 0.3);
        }, i * 55)
      );
    },

    // ── DENY — menacing growl
    deny: (a) => {
      if (!a._ready) return;
      const now = a.ctx.currentTime;
      const o1 = a.ctx.createOscillator();
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(60, now);
      o1.frequency.exponentialRampToValueAtTime(30, now + 0.35);
      const g1 = a.ctx.createGain();
      g1.gain.setValueAtTime(0.35, now);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      const wave = a.ctx.createOscillator();
      wave.type = 'square'; wave.frequency.value = 45;
      const g2 = a.ctx.createGain();
      g2.gain.setValueAtTime(0.15, now);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      const f = a.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 280;
      o1.connect(f); wave.connect(f); f.connect(g1); g1.connect(a.master);
      g2.connect(a.master);
      o1.start(); o1.stop(now + 0.35);
      wave.start(); wave.stop(now + 0.25);
    },

    // ── CASH — triumphant rune chime
    cash: (a) => {
      if (!a._ready) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        setTimeout(() => {
          a._osc('sine', f, 0.28, 0.25);
          a._osc('sine', f * 2, 0.08, 0.2);
        }, i * 70);
      });
      setTimeout(() => a._osc('sine', 130, 0.35, 0.6), 0);
    },

    // ── CHOP — metallic sword impact
    chop: (a) => {
      if (!a._ready) return;
      const now = a.ctx.currentTime;
      a._osc('square', 320, 0.35, 0.04);
      a._osc('square', 480, 0.2,  0.03);
      a._osc('sine',    65, 0.4,  0.12);
      const buf = a.ctx.createBuffer(1, a.ctx.sampleRate * 0.08, a.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
      const src = a.ctx.createBufferSource(); src.buffer = buf;
      const g = a.ctx.createGain();
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      const filt = a.ctx.createBiquadFilter();
      filt.type = 'highpass'; filt.frequency.value = 3000;
      src.connect(filt); filt.connect(g); g.connect(a.master);
      src.start(); src.stop(now + 0.08);
    },

    // ── WHOOSH — directional swoosh
    whoosh: (a) => {
      if (!a._ready) return;
      const now = a.ctx.currentTime;
      const buf = a.ctx.createBuffer(1, a.ctx.sampleRate * 0.45, a.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
      const src = a.ctx.createBufferSource(); src.buffer = buf;
      const g = a.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.45, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      const f = a.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(2200, now);
      f.frequency.exponentialRampToValueAtTime(400, now + 0.45);
      f.Q.value = 1.8;
      src.connect(f); f.connect(g); g.connect(a.master);
      src.start(); src.stop(now + 0.45);
    },

    // ── SIZZLE — fire effect
    sizzle: (a) => {
      const buf = a.ctx.createBuffer(1, a.ctx.sampleRate * 0.4, a.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
      const src = a.ctx.createBufferSource(); src.buffer = buf;
      const g = a.ctx.createGain();
      g.gain.setValueAtTime(0.5, a.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, a.ctx.currentTime + 0.4);
      const f = a.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2000;
      src.connect(f); f.connect(g); g.connect(a.master);
      src.start(); src.stop(a.ctx.currentTime + 0.4);
    },

    // ════════════════════════════════════════════════════════
    //  LEVEL MUSIC
    //  Call via: engine.audio.playLevelMusic('grocery')
    //  or directly: engine.audio.play('musicGrocery')
    // ════════════════════════════════════════════════════════

    // ── DEFAULT FALLBACK
    music: (a, bpm = 110) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;
      const notes = [261.63, 293.66, 329.63, 392, 440];
      const step = 60 / bpm / 2;
      const schedule = () => {
        if (a._musicStop) { a._musicPlaying = false; return; }
        const f = notes[Math.floor(Math.random() * notes.length)] * (Math.random() > 0.5 ? 2 : 1);
        a._osc('sine', f, 0.07, step * 1.8);
        if (Math.random() > 0.6)  a._osc('sine', f * 3,   0.025, step * 1.2);
        if (Math.random() > 0.75) a._osc('triangle', f * 0.5, 0.05,  step * 2.5);
        a._musicTimer = setTimeout(schedule, step * 1000 * 0.88);
      };
      schedule();
    },

    // ── 🎭 CHARACTER SELECT — warm, inviting, magical anticipation
    // Gentle ascending arpeggios in C major — sparkly and welcoming,
    // the feeling of choosing your adventure before it begins.
    musicCharacterSelect: (a, bpm = 88) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;
      const arp  = [261.63, 329.63, 392, 523.25, 659.25, 784]; // C major arpeggio
      const step = 60 / bpm / 2;
      let arpIdx = 0;
      const schedule = () => {
        if (a._musicStop) { a._musicPlaying = false; return; }
        const octave = Math.floor(arpIdx / arp.length) % 2 === 0 ? 1 : 0.5;
        const f = arp[arpIdx % arp.length] * octave;
        a._osc('sine', f, 0.10, step * 1.6);
        if (Math.random() > 0.6)  a._osc('sine', f * 2,    0.04, step * 1.4);
        if (arpIdx % 4 === 0)     a._osc('triangle', f * 0.25, 0.08, step * 3.0);
        if (Math.random() > 0.72) a._osc('sine', f * 3, 0.03, step * 1.2);
        arpIdx++;
        a._musicTimer = setTimeout(schedule, step * 1000 * (0.8 + Math.random() * 0.25));
      };
      schedule();
    },

    // ── 🛒 GROCERY — bright, jingly, playful whimsy
    // Crisp bell tones in a major scale, quick tempo, occasional
    // chime flourishes — like a charming market on a sunny morning.
    musicGrocery: (a, bpm = 126) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;
      // C major scale — cheerful and open
      const melody = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.50];
      const bass   = [130.81, 164.81, 196.00, 261.63];
      const step   = 60 / bpm / 2;
      const schedule = () => {
        if (a._musicStop) { a._musicPlaying = false; return; }
        // bright bell melody
        const f = melody[Math.floor(Math.random() * melody.length)];
        a._osc('sine', f, 0.13, step * 1.4);
        // second voice harmony — third above
        if (Math.random() > 0.5) a._osc('sine', f * 1.26, 0.07, step * 1.2);
        // sparkly overtone
        if (Math.random() > 0.6) a._osc('sine', f * 2, 0.05, step * 0.9);
        // chime run — fast ascending flicker
        if (Math.random() > 0.82) {
          [0, 60, 120, 180].forEach((ms, i) =>
            setTimeout(() => a._osc('sine', melody[i] * 2, 0.09, 0.12), ms)
          );
        }
        // warm bass pluck on the beat
        if (Math.random() > 0.55) a._osc('triangle', bass[Math.floor(Math.random() * bass.length)], 0.1, step * 1.8);
        a._musicTimer = setTimeout(schedule, step * 1000 * (0.6 + Math.random() * 0.3));
      };
      schedule();
    },

    // ── 🍳 COOKING — warm, cozy, kitchen-magic
    // Mellow triangle tones and soft bell hits in a pentatonic
    // scale — the sound of something wonderful simmering gently.
    musicCooking: (a, bpm = 96) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;
      // D pentatonic major — warm and homey
      const notes = [293.66, 329.63, 369.99, 440, 493.88, 587.33];
      const step  = 60 / bpm / 2;
      // persistent gentle simmer drone
      const drone = a.ctx.createOscillator();
      drone.type = 'sine'; drone.frequency.value = 73.42; // D2
      const dg = a.ctx.createGain(); dg.gain.value = 0.04;
      drone.connect(dg); dg.connect(a.master); drone.start();
      a._cookDrone = drone;
      const schedule = () => {
        if (a._musicStop) {
          a._musicPlaying = false;
          try { drone.stop(); } catch(_) {}
          a._cookDrone = null;
          return;
        }
        const f = notes[Math.floor(Math.random() * notes.length)];
        // warm triangle melody
        a._osc('triangle', f, 0.14, step * 2.4);
        // soft harmonic halo
        if (Math.random() > 0.55) a._osc('sine', f * 1.5, 0.06, step * 2.0);
        // occasional gentle bell ping
        if (Math.random() > 0.7) {
          setTimeout(() => {
            a._osc('sine', f * 2, 0.1, 0.22);
            a._osc('sine', f * 4, 0.04, 0.18);
          }, step * 400);
        }
        // deep warm bass note
        if (Math.random() > 0.68) a._osc('sine', f * 0.25, 0.09, step * 3.2);
        a._musicTimer = setTimeout(schedule, step * 1000 * (0.85 + Math.random() * 0.4));
      };
      schedule();
    },

    // ── 🧺 PACKING — dreamy, bittersweet, tender romance
    // Slow minor-tinged melody with long sustains and a warm
    // lower voice — wistful and hopeful at the same time.
    musicPacking: (a, bpm = 72) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;
      // A natural minor — longing and tender
      const melody = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392];
      const step   = 60 / bpm / 2;
      const schedule = () => {
        if (a._musicStop) { a._musicPlaying = false; return; }
        const f = melody[Math.floor(Math.random() * melody.length)];
        // slow, breathing sine melody
        a._osc('sine', f, 0.12, step * 3.2);
        // lower shadow voice — romantic depth
        if (Math.random() > 0.45) a._osc('sine', f * 0.5, 0.08, step * 4.0);
        // high ethereal overtone
        if (Math.random() > 0.6) a._osc('sine', f * 2, 0.05, step * 2.8);
        // occasional tender chord swell
        if (Math.random() > 0.75) {
          a._osc('sine', f * 1.189, 0.07, step * 3.0); // minor third
          a._osc('sine', f * 1.498, 0.05, step * 3.0); // perfect fifth
        }
        a._musicTimer = setTimeout(schedule, step * 1000 * (1.0 + Math.random() * 0.6));
      };
      schedule();
    },

    // ── 🚗 DRIVING — adventurous, romantic, open road
    // A rolling, forward-moving melody in G major with a hopeful
    // bass pulse — windows down, going somewhere wonderful together.
    musicDriving: (a, bpm = 112) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;
      // G major — bright and adventurous
      const melody = [392, 440, 493.88, 523.25, 587.33, 659.25, 783.99];
      const bass   = [98, 130.81, 146.83, 196];
      const step   = 60 / bpm / 2;
      // steady low pulse — the open road
      const beatInterval = setInterval(() => {
        if (a._musicStop) { clearInterval(beatInterval); return; }
        a._osc('sine', 98, 0.08, 0.12);
      }, (60 / bpm) * 1000);
      a._driveBeat = beatInterval;
      const schedule = () => {
        if (a._musicStop) {
          a._musicPlaying = false;
          clearInterval(beatInterval);
          a._driveBeat = null;
          return;
        }
        const f = melody[Math.floor(Math.random() * melody.length)];
        a._osc('sine', f, 0.11, step * 1.6);
        // bright second voice
        if (Math.random() > 0.5) a._osc('sine', f * 1.26, 0.07, step * 1.4);
        // mystical shimmer
        if (Math.random() > 0.65) a._osc('sine', f * 3, 0.03, step * 1.2);
        // bass anchor
        if (Math.random() > 0.6) a._osc('triangle', bass[Math.floor(Math.random() * bass.length)], 0.09, step * 2.0);
        a._musicTimer = setTimeout(schedule, step * 1000 * (0.75 + Math.random() * 0.35));
      };
      schedule();
    },

    // ── 🌟 STARGAZING — ethereal, celestial, timeless romance
    // Slow, widely-spaced tones in an ethereal major scale —
    // the sound of lying on a blanket watching the sky breathe.
    musicStargazing: (a, bpm = 52) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;
      // E major add9 — open, celestial, infinite
      const notes = [164.81, 185, 220, 246.94, 277.18, 329.63, 369.99, 493.88];
      const step  = 60 / bpm / 2;
      // quiet stellar breath drone
      const drone = a.ctx.createOscillator();
      drone.type = 'sine'; drone.frequency.value = 41.2; // E1
      const dg = a.ctx.createGain(); dg.gain.value = 0.035;
      // slow LFO shimmer on drone
      const lfo = a.ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lg  = a.ctx.createGain(); lg.gain.value = 0.012;
      lfo.connect(lg); lg.connect(dg.gain);
      drone.connect(dg); dg.connect(a.master); drone.start(); lfo.start();
      a._starDrone = drone; a._starLfo = lfo;
      const schedule = () => {
        if (a._musicStop) {
          a._musicPlaying = false;
          try { drone.stop(); } catch(_) {}
          try { lfo.stop();   } catch(_) {}
          a._starDrone = a._starLfo = null;
          return;
        }
        const f = notes[Math.floor(Math.random() * notes.length)];
        // floating long tone
        a._osc('sine', f, 0.09, step * 4.5);
        // celestial octave
        a._osc('sine', f * 2, 0.06, step * 5.0);
        // high shimmer star
        if (Math.random() > 0.55) a._osc('sine', f * 4, 0.04, step * 3.5);
        // deep anchor
        if (Math.random() > 0.7)  a._osc('sine', f * 0.5, 0.05, step * 6.0);
        // rare magical chord bloom
        if (Math.random() > 0.8) {
          a._osc('sine', f * 1.26, 0.06, step * 4.5);
          a._osc('sine', f * 1.498, 0.04, step * 4.5);
        }
        a._musicTimer = setTimeout(schedule, step * 1000 * (1.2 + Math.random() * 1.0));
      };
      schedule();
    },

    // ── ✉️ LETTER — intimate, romantic, heartfelt
    // Delicate, close-together tones — like words written slowly
    // by candlelight, each note chosen with care and tenderness.
    musicLetter: (a, bpm = 84) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;
      // F major — warm and personal
      const melody = [174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440];
      const step   = 60 / bpm / 2;
      const schedule = () => {
        if (a._musicStop) { a._musicPlaying = false; return; }
        const f = melody[Math.floor(Math.random() * melody.length)];
        // delicate sine
        a._osc('sine', f, 0.10, step * 2.6);
        // tender inner voice
        if (Math.random() > 0.5) a._osc('sine', f * 1.335, 0.07, step * 2.2); // perfect fourth
        // warm bass breath
        if (Math.random() > 0.65) a._osc('sine', f * 0.5, 0.08, step * 3.5);
        // high shimmer grace note
        if (Math.random() > 0.7) {
          setTimeout(() => a._osc('sine', f * 3, 0.05, 0.18), step * 300);
        }
        // occasional romantic chord
        if (Math.random() > 0.78) {
          a._osc('sine', f * 1.189, 0.06, step * 2.5); // minor third warmth
        }
        a._musicTimer = setTimeout(schedule, step * 1000 * (0.9 + Math.random() * 0.5));
      };
      schedule();
    },

    // ── ⚜️ ELDEN — EXTREMELY SCARY
    // Subsonic dread, dissonant Phrygian melody, choir beating
    // clusters, chaotic unpredictable rhythm, sudden piercing
    // stings, and deep impact thuds. Psychological horror.
    musicElden: (a, bpm = 38) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;

      // ── SUBSONIC FLOOR (felt, not quite heard)
      const drone1 = a.ctx.createOscillator();
      drone1.type = 'sine'; drone1.frequency.value = 18;
      const dg1 = a.ctx.createGain(); dg1.gain.value = 0.28;
      drone1.connect(dg1); dg1.connect(a.master); drone1.start();

      // ── GROWLING MID DRONE with chaotic wobble
      const drone2 = a.ctx.createOscillator();
      drone2.type = 'sawtooth'; drone2.frequency.value = 42;
      const df2 = a.ctx.createBiquadFilter();
      df2.type = 'highpass'; df2.frequency.value = 55;
      const dg2 = a.ctx.createGain(); dg2.gain.value = 0.16;
      const lfo1 = a.ctx.createOscillator(); lfo1.frequency.value = 0.41;
      const lg1  = a.ctx.createGain(); lg1.gain.value = 28;
      lfo1.connect(lg1); lg1.connect(drone2.frequency);
      drone2.connect(df2); df2.connect(dg2); dg2.connect(a.master);
      drone2.start(); lfo1.start();

      // ── DISSONANT TRITONE CHOIR (beating, sickening)
      const choirFreqs = [110, 116.54, 123.47, 130.81]; // Am cluster, minor 2nds
      const choir = choirFreqs.map(f => {
        const o = a.ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = f;
        const g = a.ctx.createGain(); g.gain.value = 0.028;
        const filt = a.ctx.createBiquadFilter();
        filt.type = 'bandpass'; filt.frequency.value = f * 2.5; filt.Q.value = 12;
        o.connect(filt); filt.connect(g); g.connect(a.master); o.start();
        return { osc: o, gain: g };
      });

      // ── HARSH HIGH SHIMMER (constant unease)
      const shimmer = a.ctx.createOscillator();
      shimmer.type = 'square'; shimmer.frequency.value = 880;
      const sg = a.ctx.createGain(); sg.gain.value = 0.008;
      const sf = a.ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1800; sf.Q.value = 6;
      shimmer.connect(sf); sf.connect(sg); sg.connect(a.master); shimmer.start();

      a._eldenDrone  = drone1;
      a._eldenDrone2 = drone2;
      a._eldenLfo    = lfo1;
      a._eldenChoir  = choir;
      a._eldenShimmer = shimmer;

      // ── MELODIC SCHEDULE — Phrygian dominant, slow, chaotic
      const notes = [41.2, 43.65, 46.25, 49, 55, 58.27, 65.41, 69.30];
      const step  = 60 / bpm / 2;

      const stopAll = () => {
        a._musicPlaying = false;
        try { drone1.stop();   } catch(_) {}
        try { drone2.stop();   } catch(_) {}
        try { lfo1.stop();     } catch(_) {}
        try { shimmer.stop();  } catch(_) {}
        choir.forEach(c => { try { c.osc.stop(); } catch(_) {} });
        a._eldenDrone = a._eldenDrone2 = a._eldenLfo = a._eldenChoir = a._eldenShimmer = null;
      };

      const schedule = () => {
        if (a._musicStop) { stopAll(); return; }

        // ── LONG UNPREDICTABLE SILENCE (30% chance — anticipation is terror)
        if (Math.random() > 0.70) {
          a._musicTimer = setTimeout(schedule, step * 1000 * (2.0 + Math.random() * 3.5));
          return;
        }

        const f = notes[Math.floor(Math.random() * notes.length)];

        // hollow, distorted low melody
        a._osc('sawtooth', f, 0.16, step * 3.8);
        // tritone shadow — the most unsettling interval
        if (Math.random() > 0.4) a._osc('square', f * 1.414, 0.12, step * 2.8);
        // minor second grind
        if (Math.random() > 0.55) {
          setTimeout(() => a._osc('sawtooth', f * 1.059, 0.09, step * 3), step * 250);
        }

        // ── SUDDEN PIERCING SCREAM STING (rare but devastating)
        if (Math.random() > 0.84) {
          setTimeout(() => {
            if (a._musicStop) return;
            a._osc('square',   880, 0.30, 0.5);
            a._osc('square',   932, 0.26, 0.45);
            a._osc('sawtooth', 1174, 0.22, 0.4);
            a._osc('sine',      28, 0.50, 0.6); // deep impact thud
          }, Math.random() * step * 600);
        }

        // ── CHAOTIC DISSONANT CHORD CLUSTER
        if (Math.random() > 0.76) {
          a._osc('sawtooth', f,        0.14, 0.55);
          a._osc('sawtooth', f * 1.18, 0.12, 0.55);
          a._osc('sawtooth', f * 1.41, 0.10, 0.55);
          a._osc('square',   f * 1.78, 0.08, 0.45);
        }

        // ── DEEP HORROR THUD
        if (Math.random() > 0.80) {
          a._osc('sine', 22, 0.40, 0.7);
          a._osc('sine', 28, 0.28, 0.55);
        }

        // ── EPILEPTIC RHYTHM — chaos guarantees dread
        const variance = 0.35 + Math.random() * 2.8;
        a._musicTimer = setTimeout(schedule, step * 1000 * variance);
      };

      schedule();
    },

    // ── ✨ TARDIS / THE END — triumphant, transcendent, magical
    // Ascending major chords, bright harmonics, a sense of
    // arrival — you made it, and it was worth every step.
    musicTardis: (a, bpm = 98) => {
      if (!a._ready || a._musicPlaying) return;
      a._musicPlaying = true; a._musicStop = false;
      // C major — pure, triumphant, complete
      const melody = [392, 440, 493.88, 523.25, 587.33, 659.25, 783.99, 1046.50];
      const bass   = [65.41, 98, 130.81, 196];
      const step   = 60 / bpm / 2;
      // warm tonic drone
      const drone = a.ctx.createOscillator();
      drone.type = 'sine'; drone.frequency.value = 65.41; // C2
      const dg = a.ctx.createGain(); dg.gain.value = 0.045;
      drone.connect(dg); dg.connect(a.master); drone.start();
      a._tardisDrone = drone;
      const schedule = () => {
        if (a._musicStop) {
          a._musicPlaying = false;
          try { drone.stop(); } catch(_) {}
          a._tardisDrone = null;
          return;
        }
        const f = melody[Math.floor(Math.random() * melody.length)];
        // bright triumphant melody
        a._osc('sine', f, 0.14, step * 1.8);
        // full harmonic — third + fifth = major chord
        if (Math.random() > 0.45) a._osc('sine', f * 1.26,  0.09, step * 1.6);
        if (Math.random() > 0.55) a._osc('sine', f * 1.498, 0.07, step * 1.6);
        // magical high shimmer
        if (Math.random() > 0.6) a._osc('sine', f * 2, 0.07, step * 1.4);
        if (Math.random() > 0.7) a._osc('sine', f * 3, 0.04, step * 1.2);
        // heroic bass anchor
        if (Math.random() > 0.55) a._osc('triangle', bass[Math.floor(Math.random() * bass.length)], 0.1, step * 2.2);
        // triumphant fanfare flourish
        if (Math.random() > 0.85) {
          [0, 70, 140, 210, 280].forEach((ms, i) =>
            setTimeout(() => a._osc('sine', melody[i % melody.length], 0.12, 0.18), ms)
          );
        }
        a._musicTimer = setTimeout(schedule, step * 1000 * (0.65 + Math.random() * 0.35));
      };
      schedule();
    },

    // ── MUSIC STOP — kills ALL level music immediately
    musicStop: (a) => {
      a._musicStop    = true;
      a._musicPlaying = false;          // ← critical: lets the next level start
      clearTimeout(a._musicTimer);
      clearInterval(a._driveBeat);
      a._driveBeat = null;
      // Kill any persistent oscillators left by level tracks
      const oscs = ['_cookDrone','_starDrone','_starLfo','_tardisDrone',
                     '_eldenDrone','_eldenDrone2','_eldenLfo','_eldenShimmer'];
      oscs.forEach(k => { if (a[k]) { try { a[k].stop(); } catch(_) {} a[k] = null; } });
      if (a._eldenChoir) {
        a._eldenChoir.forEach(c => { try { c.osc.stop(); } catch(_) {} });
        a._eldenChoir = null;
      }
    },

    // ── ENGINE (driving level only)
    engine: (a) => {
      if (!a._ready || a._engineOsc) return;
      const o = a.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
      const g = a.ctx.createGain(); g.gain.value = 0.08;
      const f = a.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
      o.connect(f); f.connect(g); g.connect(a.master); o.start();
      a._engineOsc = o; a._engineGain = g;
    },
    engineRev: (a, rpm) => {
      if (!a._engineOsc) return;
      a._engineOsc.frequency.setTargetAtTime(40 + rpm * 80, a.ctx.currentTime, 0.1);
      a._engineGain.gain.setTargetAtTime(0.05 + rpm * 0.1, a.ctx.currentTime, 0.05);
    },
    engineStop: (a) => {
      if (!a._engineOsc) return;
      a._engineOsc.stop(); a._engineOsc = null;
    },
    horn: (a) => {
      a._osc('sawtooth', 392, 0.4, 0.3);
      a._osc('sawtooth', 494, 0.3, 0.3);
    },
  };
}

// ─────────────────────────────────────────────────────────────
//  SCENE BUILDER HELPERS
// ─────────────────────────────────────────────────────────────
export const Build = {

  floor(scene, color = 0xd4c8f0, w = 80, h = 80) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness:    0.75,
      metalness:    0.02,
      roughnessMap: Anime.roughnessTex(42, 128),
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  },

  box(scene, x, y, z, w, h, d, color = 0xffffff, opts = {}) {
    const mat  = Anime.mat(color, { roughness: 0.7, metalness: 0.05, ...(opts.matOpts || {}) });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    if (!opts.noOutline) Anime.outline(mesh);
    return { mesh, aabb: new THREE.Box3().setFromObject(mesh) };
  },

  shelf(scene, x, z, color = 0xe8d5b0) {
    const group = new THREE.Group(); scene.add(group); group.position.set(x, 0, z);
    const mat   = Anime.mat(color, { roughness: 0.8 });
    const back  = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 0.12), mat);
    back.position.set(0, 1.1, 0); back.castShadow = true; group.add(back);
    Anime.outline(back, 0.03);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), mat);
      s.position.set(0, 0.45 + i * 0.8, 0.2); group.add(s);
    }
    return {
      group,
      aabb: new THREE.Box3(
        new THREE.Vector3(x - 1.1, 0, z - 0.35),
        new THREE.Vector3(x + 1.1, 2.5, z + 0.35),
      ),
    };
  },

  carBody(scene, color = 0xff6688) {
    const g   = new THREE.Group(); scene.add(g);
    const mat = Anime.metal(color, { roughness: 0.25, metalness: 0.5 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4.2), mat);
    chassis.position.y = 0.6; chassis.castShadow = true; g.add(chassis);
    Anime.outline(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), mat);
    cabin.position.set(0, 1.15, -0.2); cabin.castShadow = true; g.add(cabin);
    Anime.outline(cabin);

    const wind = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.45, 0.08),
      Anime.glass(0x88ddff, { transmission: 0.85, roughness: 0.0, opacity: 0.5 }),
    );
    wind.position.set(0, 1.1, 0.9); g.add(wind);

    const wGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 20);
    const wMat = Anime.mat(0x222233, { roughness: 0.85, metalness: 0.4 });
    [[-1.1,0.35,1.4],[1.1,0.35,1.4],[-1.1,0.35,-1.4],[1.1,0.35,-1.4]].forEach(([wx,wy,wz]) => {
      const w = new THREE.Mesh(wGeo, wMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, wy, wz); g.add(w);
    });
    return g;
  },

  stars(scene, count = 600) {
    const layers = [
      { count: Math.floor(count * 0.7), size: 0.22, color: 0xffffff, opacity: 0.9 },
      { count: Math.floor(count * 0.3), size: 0.55, color: 0xfff0cc, opacity: 0.6 },
    ];
    const pts = [];
    for (const layer of layers) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(layer.count * 3);
      for (let i = 0; i < layer.count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        const r     = 80 + Math.random() * 25;
        pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
        pos[i*3+1] = Math.abs(r * Math.cos(phi)) + 5;
        pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color:           layer.color,
        size:            layer.size,
        sizeAttenuation: true,
        transparent:     true,
        opacity:         layer.opacity,
      });
      const p = new THREE.Points(geo, mat);
      scene.add(p); pts.push(p);
    }
    return pts;
  },

  sunLight(scene, color = 0xfffbe8, intensity = 2.4, addFlare = false) {
    const sun = new THREE.DirectionalLight(color, intensity);
    sun.position.set(15, 30, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near   = 0.5;
    sun.shadow.camera.far    = 120;
    sun.shadow.camera.left   = sun.shadow.camera.bottom = -40;
    sun.shadow.camera.right  = sun.shadow.camera.top    =  40;
    sun.shadow.bias          = -0.0006;
    sun.shadow.normalBias    = 0.02;
    scene.add(sun);

    const hemi = new THREE.HemisphereLight(0xb8d8ff, 0xffe4a0, 0.85);
    scene.add(hemi);

    const fill = new THREE.DirectionalLight(0xc0a8ff, 0.3);
    fill.position.set(-10, 8, -15);
    scene.add(fill);

    if (addFlare) {
      const lensflare = new Lensflare();
      const fc = document.createElement('canvas');
      fc.width = fc.height = 64;
      const fctx = fc.getContext('2d');
      const grad = fctx.createRadialGradient(32,32,0,32,32,32);
      grad.addColorStop(0, 'rgba(255,255,230,1)');
      grad.addColorStop(1, 'rgba(255,200,80,0)');
      fctx.fillStyle = grad; fctx.fillRect(0,0,64,64);
      const flareTex = new THREE.CanvasTexture(fc);
      flareTex.channel = 0;
      lensflare.addElement(new LensflareElement(flareTex, 180, 0));
      lensflare.addElement(new LensflareElement(flareTex, 60,  0.4));
      lensflare.addElement(new LensflareElement(flareTex, 25,  0.8));
      sun.add(lensflare);
    }

    return { sun, hemi, fill };
  },

  pointLight(scene, x, y, z, color = 0xffcc66, intensity = 1.5, distance = 8) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    light.castShadow = false;
    scene.add(light);
    return light;
  },

  label(scene, text, x, y, z, color = '#fff', bgColor = 'rgba(20,10,50,0.88)') {
    const canvas = document.createElement('canvas');
    canvas.width = 280; canvas.height = 72;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.roundRect(4, 4, 272, 64, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(200,160,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.roundRect(4, 4, 272, 64, 12); ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 140, 36);
    const tex = new THREE.CanvasTexture(canvas);
    tex.channel = 0;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.38),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    mesh.position.set(x, y, z); scene.add(mesh);
    mesh.userData.isBillboard = true;
    return mesh;
  },

  item(scene, x, y, z, color = 0xffee44, label = '') {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 12),
      Anime.glow(color, 0.5),
    );
    mesh.position.set(x, y, z); mesh.castShadow = true; scene.add(mesh);
    Anime.outline(mesh, 0.07);

    const light = new THREE.PointLight(color, 1.2, 2.5, 2);
    light.position.set(x, y, z); scene.add(light);

    if (label) Build.label(scene, label, x, y + 0.5, z);
    mesh.userData.isItem       = true;
    mesh.userData.label        = label;
    mesh.userData.light        = light;
    mesh.userData.baseEmissive = 0.5;
    mesh.userData.baseLight    = 1.2;
    return mesh;
  },

  road(scene, z0, z1, lanes = 3) {
    const width = lanes * 3.5, len = z1 - z0;
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(width, len),
      new THREE.MeshStandardMaterial({
        color:       0x2e2e3a,
        roughness:   0.98,
        metalness:   0.0,
        roughnessMap: Anime.roughnessTex(7, 64),
      }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, (z0 + z1) / 2);
    road.receiveShadow = true; scene.add(road);

    for (let l = 1; l < lanes; l++) {
      const lx = -width / 2 + l * 3.5;
      for (let dz = z0 + 2; dz < z1; dz += 4.5) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(0.14, 2.8),
          new THREE.MeshBasicMaterial({ color: 0xffff88 }),
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.02, dz);
        scene.add(dash);
      }
    }
    [-1, 1].forEach(side => {
      const kerb = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, len),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      kerb.rotation.x = -Math.PI / 2;
      kerb.position.set(side * (width / 2 - 0.09), 0.015, (z0 + z1) / 2);
      scene.add(kerb);
    });
    return road;
  },

  particles(scene, count = 80, area = 20, color = 0xffff99, size = 0.12) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * area;
      pos[i*3+1] = Math.random() * 4 + 0.5;
      pos[i*3+2] = (Math.random() - 0.5) * area;
      vel[i*3]   = (Math.random() - 0.5) * 0.4;
      vel[i*3+1] = (Math.random() - 0.5) * 0.2;
      vel[i*3+2] = (Math.random() - 0.5) * 0.4;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color, size, sizeAttenuation: true, transparent: true, opacity: 0.85,
    });
    const pts = new THREE.Points(geo, mat);
    pts.userData.vel  = vel;
    pts.userData.area = area;
    scene.add(pts);
    return pts;
  },

  animeSky(scene, preset = 'day') {
    const PRESETS = {
      day:      { top:0x5ab3e8, mid:0xa8d8f0, bot:0xe8f4fb, fog:0xc8e8f5, fogNear:30, fogFar:90,  cloudColor:0xffffff, cloudOpacity:0.82 },
      golden:   { top:0x1a3a6e, mid:0xff7e44, bot:0xffcc66, fog:0xff9955, fogNear:20, fogFar:70,  cloudColor:0xffeebb, cloudOpacity:0.65 },
      dusk:     { top:0x1a0a3a, mid:0xc0446e, bot:0xff9966, fog:0xcc6644, fogNear:20, fogFar:65,  cloudColor:0xffaaaa, cloudOpacity:0.55 },
      night:    { top:0x04021a, mid:0x0d0930, bot:0x1a1240, fog:0x0d0928, fogNear:15, fogFar:55,  cloudColor:0x6655aa, cloudOpacity:0.30 },
      overcast: { top:0x8899aa, mid:0xaabbcc, bot:0xccddee, fog:0xbbccdd, fogNear:18, fogFar:60,  cloudColor:0xddeeff, cloudOpacity:0.70 },
    };

    const p = PRESETS[preset] ?? PRESETS.day;

    const domeMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(p.top) },
        midColor: { value: new THREE.Color(p.mid) },
        botColor: { value: new THREE.Color(p.bot) },
        midPoint: { value: 0.42 },
        exponent: { value: 1.8  },
      },
      vertexShader:   SkyGradientShader.vertexShader,
      fragmentShader: SkyGradientShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), domeMat);
    dome.renderOrder = -1;
    scene.add(dome);

    scene.fog = new THREE.Fog(p.fog, p.fogNear, p.fogFar);

    const clouds = [];
    const cloudHeights = [28, 34, 40];
    const cloudSpeeds  = [0.9, 0.5, 0.25];
    const cloudScales  = [180, 220, 260];

    cloudHeights.forEach((cy, i) => {
      const size = 512;
      const cv   = document.createElement('canvas');
      cv.width = cv.height = size;
      const ctx  = cv.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      const numBlobs = 6 + i * 2;
      for (let b = 0; b < numBlobs; b++) {
        const bx = Math.random() * size;
        const by = Math.random() * size;
        const rx = 60 + Math.random() * 120;
        const ry = 30 + Math.random() * 55;
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, rx);
        grad.addColorStop(0,   `rgba(255,255,255,${0.55 + Math.random() * 0.35})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${0.15 + Math.random() * 0.2})`);
        grad.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.save();
        ctx.translate(bx, by); ctx.scale(1, ry / rx); ctx.translate(-bx, -by);
        ctx.beginPath(); ctx.arc(bx, by, rx, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.channel = 0;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 3);
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true,
        opacity:    p.cloudOpacity * (1 - i * 0.15),
        depthWrite: false,
        color:      new THREE.Color(p.cloudColor),
        blending:   THREE.NormalBlending,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(cloudScales[i], cloudScales[i]), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = cy;
      plane.renderOrder = -1;
      scene.add(plane);
      clouds.push({ plane, speed: cloudSpeeds[i], tex });
    });

    const hazeMat = new THREE.MeshBasicMaterial({
      color:       new THREE.Color(p.bot).lerp(new THREE.Color(p.fog), 0.5),
      transparent: true, opacity: 0.45, depthWrite: false, side: THREE.BackSide,
    });
    const haze = new THREE.Mesh(new THREE.CylinderGeometry(138, 138, 18, 32, 1, true), hazeMat);
    haze.position.y = 6; haze.renderOrder = -1;
    scene.add(haze);

    return {
      dome, clouds,
      update(dt, camera) {
        clouds.forEach(({ tex }) => {
          tex.offset.x += dt * 0.0008;
          tex.offset.y += dt * 0.0003;
          tex.needsUpdate = true;
        });
        if (camera) dome.position.set(camera.position.x, 0, camera.position.z);
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────
//  PARTICLE UPDATER
// ─────────────────────────────────────────────────────────────
export class FXUpdater {
  constructor() { this._particles = []; this._items = []; this._t = 0; }

  registerParticles(pts) { this._particles.push(pts); }
  registerItem(mesh)     { this._items.push(mesh); }

  update(dt) {
    this._t += dt;

    for (const pts of this._particles) {
      if (!pts.geometry || !pts.geometry.attributes.position) continue;
      const pos  = pts.geometry.attributes.position.array;
      const vel  = pts.userData.vel;
      const area = pts.userData.area ?? 20;
      const half = area / 2;
      const n    = pos.length / 3;
      for (let i = 0; i < n; i++) {
        pos[i*3]   += vel[i*3]   * dt;
        pos[i*3+1] += vel[i*3+1] * dt;
        pos[i*3+2] += vel[i*3+2] * dt;
        vel[i*3]   += (Math.random() - 0.5) * 0.05 * dt;
        vel[i*3+1] += (Math.random() - 0.5) * 0.03 * dt;
        vel[i*3+2] += (Math.random() - 0.5) * 0.05 * dt;
        const spd = Math.sqrt(vel[i*3]**2 + vel[i*3+1]**2 + vel[i*3+2]**2);
        if (spd > 0.8) { vel[i*3] *= 0.8/spd; vel[i*3+1] *= 0.8/spd; vel[i*3+2] *= 0.8/spd; }
        if (pos[i*3]   >  half) pos[i*3]   = -half;
        if (pos[i*3]   < -half) pos[i*3]   =  half;
        if (pos[i*3+1] >  5.5)  pos[i*3+1] =  0.5;
        if (pos[i*3+1] <  0.5)  pos[i*3+1] =  5.0;
        if (pos[i*3+2] >  half) pos[i*3+2] = -half;
        if (pos[i*3+2] < -half) pos[i*3+2] =  half;
      }
      pts.geometry.attributes.position.needsUpdate = true;
      pts.material.opacity = 0.5 + 0.45 * Math.sin(this._t * 1.8);
    }

    for (const mesh of this._items) {
      if (!mesh || !mesh.parent || !mesh.material || !mesh.userData.baseEmissive) continue;
      const pulse = 0.5 + 0.5 * Math.sin(this._t * 3.5 + mesh.position.x * 0.7);
      mesh.material.emissiveIntensity = mesh.userData.baseEmissive * (0.6 + 0.8 * pulse);
      mesh.position.y += Math.sin(this._t * 2.2 + mesh.position.z) * 0.0008;
      mesh.rotation.y += dt * 1.2;
      if (mesh.userData.light) {
        mesh.userData.light.intensity = mesh.userData.baseLight * (0.7 + 0.5 * pulse);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  INTERACTION SYSTEM
// ─────────────────────────────────────────────────────────────
export class Interactor {
  constructor(camera, scene) {
    this.camera  = camera; this.scene = scene;
    this.ray     = new THREE.Raycaster(); this.ray.far = 2.5;
    this._center = new THREE.Vector2(0, 0); this.hovered = null;
  }
  update(interactables) {
    this.ray.setFromCamera(this._center, this.camera);
    const hits = this.ray.intersectObjects(interactables, false);
    this.hovered = hits.length ? hits[0].object : null;
    return this.hovered;
  }
  interact(interactables) {
    const obj = this.update(interactables);
    if (obj && obj.userData.onInteract) { obj.userData.onInteract(obj); return obj; }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  HUD
// ─────────────────────────────────────────────────────────────
export class HUD {
  constructor() {
    this.el = document.getElementById('hud');
    if (!this.el) {
      this.el = document.createElement('div'); this.el.id = 'hud'; document.body.appendChild(this.el);
    }
    this.el.style.cssText = `position:fixed;inset:0;pointer-events:none;font-family:'Segoe UI',sans-serif;color:#fff;`;

    this._crosshair = document.createElement('div');
    this._crosshair.style.cssText = `
      position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      width:20px;height:20px;pointer-events:none;transition:opacity 0.2s;
    `;
    this._crosshair.innerHTML = `<svg viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="1.8" fill="white" opacity="0.9"/>
      <line x1="10" y1="2"  x2="10" y2="7"  stroke="white" stroke-width="1.2" opacity="0.75" stroke-linecap="round"/>
      <line x1="10" y1="13" x2="10" y2="18" stroke="white" stroke-width="1.2" opacity="0.75" stroke-linecap="round"/>
      <line x1="2"  y1="10" x2="7"  y2="10" stroke="white" stroke-width="1.2" opacity="0.75" stroke-linecap="round"/>
      <line x1="13" y1="10" x2="18" y2="10" stroke="white" stroke-width="1.2" opacity="0.75" stroke-linecap="round"/>
    </svg>`;
    this.el.appendChild(this._crosshair);

    this._info = document.createElement('div');
    this._info.style.cssText = `
      position:absolute;top:20px;left:20px;
      background:rgba(8,4,22,0.78);border-radius:14px;padding:12px 18px;
      font-size:14px;line-height:1.8;border:1px solid rgba(200,150,255,0.25);
      text-shadow:0 1px 6px #0009;backdrop-filter:blur(12px);
      box-shadow:0 4px 32px rgba(80,0,180,0.18);transition:opacity 0.3s;
    `;
    this.el.appendChild(this._info);

    this._prompt = document.createElement('div');
    this._prompt.style.cssText = `
      position:absolute;bottom:32px;left:50%;transform:translateX(-50%);
      background:rgba(8,4,22,0.85);border-radius:999px;
      padding:9px 28px;font-size:15px;font-weight:500;letter-spacing:0.3px;
      border:1px solid rgba(200,150,255,0.35);
      transition:opacity 0.2s,transform 0.2s;opacity:0;
      backdrop-filter:blur(10px);box-shadow:0 2px 16px rgba(140,60,255,0.2);
    `;
    this.el.appendChild(this._prompt);

    this._overlayVisible = false;
    this._overlay = document.createElement('div');
    this._overlay.style.cssText = `
      position:absolute;inset:0;background:rgba(4,2,16,0.94);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      pointer-events:all;gap:20px;
    `;
    this._overlay.innerHTML = `
      <div style="font-size:52px;font-weight:900;letter-spacing:3px;
        background:linear-gradient(135deg,#ffd700,#ff90d0,#a060ff);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;
        filter:drop-shadow(0 2px 24px #b060ff44)">
        ✨ Starry Picnic ✨</div>
      <div style="font-size:16px;opacity:0.65;color:#e0d0ff;letter-spacing:0.5px">
        A 3D anime adventure with Avicula &amp; Purpura</div>
      <button id="startBtn" style="
        margin-top:20px;padding:15px 44px;font-size:18px;font-weight:700;
        border:none;border-radius:999px;cursor:pointer;
        background:linear-gradient(135deg,#a050ff,#ff50a0);color:#fff;
        box-shadow:0 4px 32px #a050ff66,0 0 0 1px rgba(255,255,255,0.12) inset;
        letter-spacing:1px;transition:transform 0.15s,box-shadow 0.15s;">
        Click to Begin</button>
      <div style="font-size:12px;opacity:0.4;color:#ccc;letter-spacing:0.5px">
        WASD move &nbsp;·&nbsp; Mouse look &nbsp;·&nbsp; E interact</div>`;
    this.el.appendChild(this._overlay);
    this._overlayVisible = true;

    const btn = this._overlay.querySelector('#startBtn');
    btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; btn.style.boxShadow = '0 6px 40px #a050ffaa,0 0 0 1px rgba(255,255,255,0.18) inset'; };
    btn.onmouseleave = () => { btn.style.transform = 'scale(1)';    btn.style.boxShadow = '0 4px 32px #a050ff66,0 0 0 1px rgba(255,255,255,0.12) inset'; };
    btn.addEventListener('click', () => {
      this._overlay.style.display = 'none';
      this._overlayVisible = false;
      if (this._onStart) this._onStart();
      setTimeout(() => document.getElementById('canvas').requestPointerLock(), 300);
    });
  }

  onStart(fn) { this._onStart = fn; }
  get isOverlayOpen() { return this._overlayVisible; }
  setInfo(html) { this._info.innerHTML = html; }

  showPrompt(text) {
    this._prompt.textContent = text;
    this._prompt.style.opacity = '1';
    this._prompt.style.transform = 'translateX(-50%) translateY(-4px)';
  }
  hidePrompt() {
    this._prompt.style.opacity   = '0';
    this._prompt.style.transform = 'translateX(-50%) translateY(0px)';
  }

  crosshairColor(color) {
    this._crosshair.querySelectorAll('circle,line').forEach(el => {
      el.setAttribute('fill', color); el.setAttribute('stroke', color);
    });
  }

  showOverlay(html, btnText, onBtn) {
    const _cb = onBtn;
    this._overlay.innerHTML = html + `<button id="ovBtn" style="
      margin-top:20px;padding:13px 38px;font-size:16px;font-weight:700;
      border:none;border-radius:999px;cursor:pointer;
      background:linear-gradient(135deg,#a050ff,#ff50a0);color:#fff;
      box-shadow:0 4px 28px #a050ff66;letter-spacing:0.5px;">${btnText}</button>`;
    this._overlay.style.display = 'flex';
    this._overlay.style.pointerEvents = 'all';
    this._overlayVisible = true;
    this._overlay.querySelector('#ovBtn').onclick = () => {
      this._overlay.style.display = 'none';
      this._overlay.style.pointerEvents = 'none';
      this._overlayVisible = false;
      if (_cb) _cb();
      setTimeout(() => document.getElementById('canvas').requestPointerLock(), 300);
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  GAME LOOP
// ─────────────────────────────────────────────────────────────
export class GameLoop {
  constructor() { this._last = 0; this._handlers = []; this._running = false; }
  add(fn)  { this._handlers.push(fn); }
  start()  { this._running = true; requestAnimationFrame(t => this._tick(t)); }
  stop()   { this._running = false; }
  _tick(t) {
    if (!this._running) return;
    const dt = Math.min((t - this._last) / 1000, 0.05);
    this._last = t;
    this._handlers.forEach(fn => fn(dt, t));
    requestAnimationFrame(ts => this._tick(ts));
  }
}

// ─────────────────────────────────────────────────────────────
//  LEVEL BASE CLASS
// ─────────────────────────────────────────────────────────────
export class Level {
  constructor(engine) {
    this.engine = engine;
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 200);
    this.interactables = []; this.collidables = []; this.billboards = [];
    this.fx = new FXUpdater();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }
  init()       {}
  onEnter()    {}
  onExit()     {}
  update(dt)   { this.fx.update(dt); }
  onInteract() {}
  _billboardUpdate() {
    this.scene.traverse(obj => { if (obj.userData.isBillboard) obj.lookAt(this.camera.position); });
  }
}

// ─────────────────────────────────────────────────────────────
//  ENGINE
// ─────────────────────────────────────────────────────────────
export class Engine {
  constructor() {
    this.renderer     = new Renderer();
    this.input        = new Input();
    this.audio        = new Audio();
    this.hud          = new HUD();
    this.input._canRelock = () => !this.hud.isOverlayOpen && !!this.currentLevel;
    this.loop         = new GameLoop();
    this.currentLevel = null;
    this._levels      = {};
    this._stepTimer   = 0;
    this.selectedCharacter = null;

    document.addEventListener('keydown', e => {
      if (e.code === 'KeyE' && this.currentLevel && this.input.locked) {
        this.currentLevel.onInteract();
      }
    });
    document.addEventListener('mousedown', e => {
      if (e.button === 0 && this.currentLevel && this.input.locked) {
        this.currentLevel.onInteract();
      }
    });

    this.loop.add((dt) => this._frame(dt));
    window._engine = this;
  }

  register(name, level, profileName) {
    this._levels[name] = { level, profileName: profileName || name };
    this.renderer.buildComposer(level.scene, level.camera, profileName || name);
    level.scene.environment = this.renderer.envMap;
  }

  go(name) {
    if (this.currentLevel) this.currentLevel.onExit();
    const entry = this._levels[name];
    if (!entry) { console.error('Unknown level:', name); return; }
    const { level, profileName } = entry;
    this.currentLevel = level;
    this.renderer.setActiveScene(level.scene, level.camera, profileName);
    level.onEnter();
  }

  nextLevel(currentName) {
    console.warn(`nextLevel('${currentName}') called but not yet wired by main.js`);
  }

  goTo(name) { this.go(name); }

  _toggleDevPanel() {
    if (this._devPanel) {
      this._devPanel.remove();
      this._devPanel = null;
      if (this.currentLevel?.fp) document.getElementById('canvas').requestPointerLock();
      return;
    }

    document.exitPointerLock();

    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      background:rgba(8,4,28,0.97);border:1.5px solid rgba(180,140,255,0.4);
      border-radius:20px;padding:28px 36px;z-index:9999;
      font-family:'Segoe UI',sans-serif;color:#fff;
      box-shadow:0 8px 48px rgba(100,40,220,0.4);min-width:280px;
      backdrop-filter:blur(16px);
    `;
    panel.innerHTML = `
      <div style="font-size:20px;font-weight:900;margin-bottom:6px;
        background:linear-gradient(135deg,#ffd700,#c890ff);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent">
        ✨ Dev Level Select</div>
      <div style="font-size:12px;color:#888;margin-bottom:20px">
        Press \` to close · changes take effect immediately</div>
      <div id="devLevelBtns" style="display:flex;flex-direction:column;gap:10px"></div>
    `;

    const levels = [
      { key:'grocery',    icon:'🛒', label:'Grocery Run' },
      { key:'cooking',    icon:'🍳', label:'Cooking'     },
      { key:'packing',    icon:'🧺', label:'Packing'     },
      { key:'driving',    icon:'🚗', label:'Driving'     },
      { key:'stargazing', icon:'🌟', label:'Stargazing'  },
      { key:'letter',     icon:'✉️',  label:'Letter'      },
      { key:'elden',      icon:'⚜',  label:'Secret Level'},
      { key:'tardis',     icon:'✨', label:'The End'     },
    ];

    const btns = panel.querySelector('#devLevelBtns');
    levels.forEach(({ key, icon, label }) => {
      const isCurrent = this.currentLevel === this._levels[key]?.level;
      const btn = document.createElement('button');
      btn.style.cssText = `
        padding:11px 22px;border-radius:12px;border:none;cursor:pointer;
        font-size:15px;font-weight:600;text-align:left;
        background:${isCurrent ? 'linear-gradient(135deg,#6030cc,#cc50a0)' : 'rgba(255,255,255,0.07)'};
        color:#fff;transition:background 0.15s;
        border:1px solid ${isCurrent ? 'transparent' : 'rgba(255,255,255,0.1)'};
      `;
      btn.textContent = `${icon}  ${label}${isCurrent ? '  ◀ current' : ''}`;
      btn.onmouseenter = () => { if (!isCurrent) btn.style.background = 'rgba(255,255,255,0.14)'; };
      btn.onmouseleave = () => { if (!isCurrent) btn.style.background = 'rgba(255,255,255,0.07)'; };
      btn.onclick = () => {
        this._devPanel.remove();
        this._devPanel = null;
        this.go(key);
        setTimeout(() => {
          if (this.currentLevel?.fp) document.getElementById('canvas').requestPointerLock();
        }, 100);
      };
      btns.appendChild(btn);
    });

    document.body.appendChild(panel);
    this._devPanel = panel;
  }

  _frame(dt) {
    const lvl = this.currentLevel;
    if (!lvl) return;

    const fp = lvl.fp;
    if (fp && fp.enabled) {
      this._stepTimer -= dt;
      const moving = this.input.anyOf('KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight');
      if (moving && this._stepTimer <= 0) { this.audio.play('step'); this._stepTimer = 0.38; }
    }

    lvl.update(dt);
    lvl._billboardUpdate();
    this.input.flush();
    this.renderer.render(lvl.scene, lvl.camera);
  }

  start()  { 
      this.renderer.resize(); // force correct pixel ratio on all composers before first frame

    this.loop.start();
   }

  onStart(fn) {
    this.hud.onStart(fn);
    this._devPanel = null;
    document.addEventListener('keydown', e => {
      if (e.code === 'Backquote') this._toggleDevPanel();
    });
  }
}