// ============================================================
//  STARRY PICNIC — main.js  (ES module entry point)
//  Wires Engine → Levels → Game Flow
// ============================================================

import { Engine }   from './engine.js';
import { Grocery }  from './levels/grocery.js';
import { Cooking }  from './levels/cooking.js';
import { Driving }  from './levels/driving.js';
import { Packing }  from './levels/packing.js';
import { Stargazing } from './levels/stargazing.js';

// ─────────────────────────────────────────────────────────────
//  Bootstrap
// ─────────────────────────────────────────────────────────────
const engine = new Engine();
window._engine = engine;   // dev convenience

// Instantiate levels (each builds its own Three.js scene)
const grocery    = new Grocery(engine);
const cooking    = new Cooking(engine);
const driving    = new Driving(engine);
const packing    = new Packing(engine);
const stargazing = new Stargazing(engine);

// Build scenes (geometry, lights — no assets to load)
grocery.init();
cooking.init();
driving.init();
packing.init();
stargazing.init();

// Register with router
engine.register('grocery',    grocery);
engine.register('cooking',    cooking);
engine.register('driving',    driving);
engine.register('packing',    packing);
engine.register('stargazing', stargazing);

// ─────────────────────────────────────────────────────────────
//  Level progression
//  grocery → cooking → packing → driving → stargazing
// ─────────────────────────────────────────────────────────────
const ORDER = ['grocery', 'cooking', 'packing', 'driving', 'stargazing'];

function goLevel(name) {
  engine.go(name);
  engine.hud.setInfo(levelInfo(name));
}

function levelInfo(name) {
  const map = {
    grocery:    '🛒 <b>Grocery Run</b><br>Pick up every item on the list!<br>Budget: <span id="budget">$20.00</span>',
    cooking:    '🍳 <b>Cooking Time</b><br>Follow each step to make the picnic food.',
    packing:    '🎒 <b>Pack the Bag</b><br>Fit everything into the basket.',
    driving:    '🚗 <b>Drive to the Park</b><br>Steer with A/D — avoid cars!',
    stargazing: '🌟 <b>Stargazing</b><br>Find the constellations Avicula pointed out.',
  };
  return map[name] || '';
}

// Expose level-complete callback so levels can trigger the next one
engine.nextLevel = (currentName) => {
  const idx = ORDER.indexOf(currentName);
  if (idx === -1 || idx >= ORDER.length - 1) {
    showEnding();
  } else {
    const next = ORDER[idx + 1];
    showTransition(currentName, next, () => goLevel(next));
  }
};

// ─────────────────────────────────────────────────────────────
//  Transition screen between levels
// ─────────────────────────────────────────────────────────────
const LEVEL_TITLES = {
  grocery:    ['🛒 Grocery Store',   'Collect all the picnic ingredients!'],
  cooking:    ['🍳 Avicula\'s Kitchen','Cook the chicken and make the sandwiches.'],
  packing:    ['🎒 Packing Up',       'Fit everything neatly into the basket.'],
  driving:    ['🚗 Road Trip',        'Drive carefully to the park.'],
  stargazing: ['🌟 Under the Stars',  'Spot the constellations together.'],
};

function showTransition(from, to, cb) {
  const [title, sub] = LEVEL_TITLES[to] || [to, ''];
  engine.hud.showOverlay(`
    <div style="font-size:52px">${title.split(' ')[0]}</div>
    <div style="font-size:28px;font-weight:700;
      background:linear-gradient(135deg,#ffd700,#ff90d0);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent">
      ${title.slice(title.indexOf(' ')+1)}</div>
    <div style="font-size:15px;opacity:0.75;color:#ddd;margin-top:-4px">${sub}</div>
  `, 'Let\'s go! ✨', cb);
}

function showEnding() {
  engine.hud.showOverlay(`
    <div style="font-size:52px">🌟💛💜🌟</div>
    <div style="font-size:30px;font-weight:900;
      background:linear-gradient(135deg,#ffd700,#c890ff);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent">
      Perfect Picnic!</div>
    <div style="font-size:15px;opacity:0.8;color:#ddd;text-align:center;max-width:320px">
      Avicula and Purpura lay under the stars,<br>
      bellies full, hearts full. ✨</div>
  `, 'Play Again 🔄', () => goLevel('grocery'));
}

// ─────────────────────────────────────────────────────────────
//  Dev shortcuts (number keys 1-5 jump levels)
// ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const lvl = { Digit1:'grocery', Digit2:'cooking', Digit3:'packing',
                 Digit4:'driving', Digit5:'stargazing' }[e.code];
  if (lvl) goLevel(lvl);
});

// ─────────────────────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────────────────────
engine.start();
engine.onStart(() => {
  goLevel('grocery');
});