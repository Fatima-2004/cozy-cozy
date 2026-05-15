import * as THREE from 'three';
import { Level, Anime, Build, FPController, Interactor } from '../engine.js';
import { showCharacterSelect } from '../character-select.js';

// ═══════════════════════════════════════════════════════════════════════
//  TARDIS LEVEL — The End of the Line
//  Classic coral/ivory/gold console room. Warm. Alive. Like the show.
//  Full interactable suite: console panels, telescope, bookshelves,
//  memory crystal, logbook, viewer screen, hat stand, and more.
// ═══════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────
//  NOTEBOOK UI — beautiful in-world journal with editable pages
// ─────────────────────────────────────────────────────────────────────
function createNotebook(engine) {
  const overlay = document.createElement('div');
  overlay.id = 'tardis-notebook';
  // FIX 1: removed purple tint — now pure dark amber
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:10000;
    display:flex;align-items:center;justify-content:center;
    background:rgba(8,4,1,0.93);
    backdrop-filter:blur(18px);
    opacity:0;pointer-events:none;
    transition:opacity 0.4s cubic-bezier(0.16,1,0.3,1);
    font-family:'Georgia',serif;
  `;

  overlay.innerHTML = `
    <div id="nb-book" style="
      position:relative;
      width:min(860px,94vw);height:min(580px,88vh);
      display:flex;
      border-radius:4px 18px 18px 4px;
      box-shadow:
        0 0 0 1px rgba(180,130,60,0.35),
        0 32px 80px rgba(0,0,0,0.75),
        0 0 120px rgba(255,160,40,0.08),
        inset 0 0 0 1px rgba(255,200,80,0.06);
      transform:scale(0.93) rotateX(3deg);
      transition:transform 0.45s cubic-bezier(0.16,1,0.3,1);
      overflow:hidden;
    ">

      <!-- LEFT PAGE — amber parchment spine + index -->
      <div id="nb-left" style="
        width:240px;min-width:200px;
        background:linear-gradient(170deg,#1e1106 0%,#251608 60%,#1a0e05 100%);
        border-right:2px solid rgba(180,120,40,0.28);
        display:flex;flex-direction:column;
        padding:28px 20px 20px;
        position:relative;overflow:hidden;flex-shrink:0;
      ">
        <!-- spine texture lines -->
        <div style="position:absolute;inset:0;opacity:0.06;background:repeating-linear-gradient(
          90deg,transparent,transparent 12px,rgba(255,200,80,0.5) 12px,rgba(255,200,80,0.5) 13px
        )"></div>

        <!-- TARDIS lamp glyph at top -->
        <div style="text-align:center;margin-bottom:20px;position:relative">
          <div style="font-size:28px;filter:drop-shadow(0 0 12px rgba(150,220,255,0.8))">⌛</div>
          <div style="font-size:9px;letter-spacing:4px;color:rgba(255,200,80,0.5);margin-top:6px;font-family:monospace">
            T·A·R·D·I·S
          </div>
        </div>

        <div style="font-size:16px;font-weight:700;color:rgba(255,210,100,0.9);
          letter-spacing:1.5px;margin-bottom:6px;font-family:serif">
          CAPTAIN'S LOG
        </div>
        <div style="font-size:10px;color:rgba(255,180,60,0.4);letter-spacing:2px;
          margin-bottom:20px;font-family:monospace">ENTRIES</div>

        <div id="nb-entry-list" style="
          flex:1;overflow-y:auto;
          scrollbar-width:thin;scrollbar-color:rgba(180,120,40,0.3) transparent;
          display:flex;flex-direction:column;gap:4px;
        "></div>

        <button id="nb-new-entry" style="
          margin-top:16px;padding:9px 0;width:100%;
          background:rgba(180,120,40,0.18);
          border:1px solid rgba(180,120,40,0.35);border-radius:8px;
          color:rgba(255,210,100,0.85);font-size:12px;letter-spacing:1px;
          font-family:serif;cursor:pointer;
          transition:background 0.2s,border-color 0.2s;
        ">+ New Entry</button>
      </div>

      <!-- RIGHT PAGE — the writing surface -->
      <div id="nb-right" style="
        flex:1;
        background:linear-gradient(160deg,#1c1006 0%,#231408 50%,#1e1107 100%);
        display:flex;flex-direction:column;
        padding:32px 36px 24px;
        position:relative;overflow:hidden;
      ">
        <!-- parchment grain lines -->
        <div style="position:absolute;inset:0;opacity:0.04;background:repeating-linear-gradient(
          0deg,transparent,transparent 28px,rgba(255,200,80,0.6) 28px,rgba(255,200,80,0.6) 29px
        );pointer-events:none"></div>

        <!-- corner glow -->
        <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;
          background:radial-gradient(circle,rgba(180,120,40,0.1) 0%,transparent 70%);
          pointer-events:none"></div>
        <div style="position:absolute;bottom:-40px;left:-40px;width:120px;height:120px;
          background:radial-gradient(circle,rgba(80,150,220,0.07) 0%,transparent 70%);
          pointer-events:none"></div>

        <!-- Entry title row -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
          <input id="nb-title" type="text"
            placeholder="Entry title…"
            style="
              flex:1;background:transparent;border:none;border-bottom:1px solid rgba(180,120,40,0.25);
              color:rgba(255,210,100,0.95);font-size:20px;font-family:serif;font-weight:700;
              padding:4px 0;outline:none;letter-spacing:0.5px;
              transition:border-color 0.2s;
            "
          />
          <div id="nb-date" style="font-size:10px;color:rgba(255,180,60,0.4);
            letter-spacing:2px;font-family:monospace;white-space:nowrap;flex-shrink:0"></div>
        </div>
        <div style="height:1px;background:linear-gradient(90deg,rgba(180,120,40,0.4),transparent);margin-bottom:20px"></div>

        <!-- The actual textarea -->
        <textarea id="nb-body"
          placeholder="Write your entry here. The TARDIS remembers everything…"
          style="
            flex:1;background:transparent;border:none;resize:none;
            color:rgba(255,225,170,0.82);font-size:15px;line-height:1.85;
            font-family:Georgia,serif;outline:none;
            scrollbar-width:thin;scrollbar-color:rgba(180,120,40,0.2) transparent;
          "
        ></textarea>

        <!-- Bottom bar -->
        <div style="
          display:flex;align-items:center;justify-content:space-between;
          margin-top:16px;padding-top:14px;
          border-top:1px solid rgba(180,120,40,0.15);
          gap:10px;flex-wrap:wrap;
        ">
          <div id="nb-char-count" style="font-size:10px;color:rgba(255,180,60,0.3);font-family:monospace;letter-spacing:1px">
            0 characters
          </div>
          <div style="display:flex;gap:8px">
            <button id="nb-delete" style="
              padding:7px 18px;background:rgba(180,40,40,0.12);
              border:1px solid rgba(180,40,40,0.25);border-radius:8px;
              color:rgba(255,120,100,0.7);font-size:11px;font-family:serif;
              cursor:pointer;letter-spacing:0.5px;transition:all 0.2s;
            ">Delete</button>
            <button id="nb-save" style="
              padding:7px 22px;
              background:linear-gradient(135deg,rgba(180,120,40,0.35),rgba(200,140,50,0.25));
              border:1px solid rgba(200,150,60,0.45);border-radius:8px;
              color:rgba(255,220,120,0.95);font-size:11px;font-family:serif;
              cursor:pointer;letter-spacing:0.5px;
              box-shadow:0 0 16px rgba(180,120,40,0.15);
              transition:all 0.2s;
            ">Save Entry ✦</button>
          </div>
        </div>
      </div>

      <!-- Close button -->
      <button id="nb-close" style="
        position:absolute;top:14px;right:16px;
        background:rgba(180,120,40,0.15);border:1px solid rgba(180,120,40,0.28);
        border-radius:50%;width:30px;height:30px;
        color:rgba(255,200,80,0.7);font-size:16px;line-height:1;
        cursor:pointer;z-index:10;
        transition:background 0.2s;
      ">×</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // ── State
  const STORAGE_KEY = 'tardis_log_v2';
  let entries = [];
  let currentIdx = -1;

  function loadEntries() {
    try { entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { entries = []; }
  }
  function saveEntries() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
      .toUpperCase().replace(/ /g, '·');
  }

  function renderList() {
    const list = document.getElementById('nb-entry-list');
    list.innerHTML = '';
    if (entries.length === 0) {
      list.innerHTML = `<div style="font-size:11px;color:rgba(255,180,60,0.25);
        text-align:center;margin-top:20px;letter-spacing:1px;font-family:monospace">
        No entries yet
      </div>`;
    }
    entries.forEach((e, i) => {
      const btn = document.createElement('button');
      const isCurrent = i === currentIdx;
      btn.style.cssText = `
        width:100%;text-align:left;padding:8px 10px;border-radius:8px;
        background:${isCurrent ? 'rgba(180,120,40,0.22)' : 'transparent'};
        border:1px solid ${isCurrent ? 'rgba(180,120,40,0.35)' : 'rgba(180,120,40,0.08)'};
        cursor:pointer;transition:all 0.15s;
      `;
      btn.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:rgba(255,210,100,${isCurrent ? '0.95' : '0.65'});
          font-family:serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${e.title || 'Untitled'}
        </div>
        <div style="font-size:9px;color:rgba(255,180,60,0.35);letter-spacing:1px;font-family:monospace;margin-top:2px">
          ${formatDate(e.ts)}
        </div>
      `;
      btn.onclick = () => selectEntry(i);
      btn.onmouseenter = () => { if (i !== currentIdx) btn.style.background = 'rgba(180,120,40,0.1)'; };
      btn.onmouseleave = () => { if (i !== currentIdx) btn.style.background = 'transparent'; };
      list.appendChild(btn);
    });
  }

  function selectEntry(i) {
    currentIdx = i;
    const e = entries[i];
    document.getElementById('nb-title').value = e.title || '';
    document.getElementById('nb-body').value  = e.body  || '';
    document.getElementById('nb-date').textContent = formatDate(e.ts);
    updateCharCount();
    renderList();
  }

  function newEntry() {
    const e = { title: '', body: '', ts: Date.now() };
    entries.unshift(e);
    saveEntries();
    selectEntry(0);
    document.getElementById('nb-title').focus();
  }

  function updateCharCount() {
    const body = document.getElementById('nb-body').value;
    document.getElementById('nb-char-count').textContent = `${body.length} characters`;
  }

  function saveCurrentEntry() {
    if (currentIdx < 0) { newEntry(); return; }
    entries[currentIdx].title = document.getElementById('nb-title').value;
    entries[currentIdx].body  = document.getElementById('nb-body').value;
    entries[currentIdx].ts    = Date.now();
    saveEntries();
    renderList();
    // flash save button
    const btn = document.getElementById('nb-save');
    btn.textContent = 'Saved ✓';
    btn.style.background = 'linear-gradient(135deg,rgba(60,180,80,0.35),rgba(40,160,60,0.25))';
    btn.style.borderColor = 'rgba(100,220,120,0.45)';
    btn.style.color = 'rgba(160,255,180,0.95)';
    setTimeout(() => {
      btn.textContent = 'Save Entry ✦';
      btn.style.background = 'linear-gradient(135deg,rgba(180,120,40,0.35),rgba(200,140,50,0.25))';
      btn.style.borderColor = 'rgba(200,150,60,0.45)';
      btn.style.color = 'rgba(255,220,120,0.95)';
    }, 1200);
  }

  function deleteCurrentEntry() {
    if (currentIdx < 0) return;
    entries.splice(currentIdx, 1);
    saveEntries();
    if (entries.length > 0) {
      selectEntry(Math.min(currentIdx, entries.length - 1));
    } else {
      currentIdx = -1;
      document.getElementById('nb-title').value = '';
      document.getElementById('nb-body').value  = '';
      document.getElementById('nb-date').textContent = '';
      updateCharCount();
      renderList();
    }
  }

  // ── Wire events
  document.getElementById('nb-close').onclick = () => closeNotebook();
  document.getElementById('nb-new-entry').onclick = newEntry;
  document.getElementById('nb-save').onclick = saveCurrentEntry;
  document.getElementById('nb-delete').onclick = deleteCurrentEntry;
  document.getElementById('nb-body').oninput = updateCharCount;

  document.getElementById('nb-new-entry').onmouseenter = e => {
    e.target.style.background = 'rgba(180,120,40,0.28)';
    e.target.style.borderColor = 'rgba(180,120,40,0.55)';
  };
  document.getElementById('nb-new-entry').onmouseleave = e => {
    e.target.style.background = 'rgba(180,120,40,0.18)';
    e.target.style.borderColor = 'rgba(180,120,40,0.35)';
  };

  overlay.addEventListener('click', e => { if (e.target === overlay) closeNotebook(); });

  // Keyboard: Escape closes, Ctrl+S saves
  const keyHandler = e => {
    if (!isOpen) return;
    if (e.code === 'Escape') { closeNotebook(); }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); saveCurrentEntry(); }
  };
  document.addEventListener('keydown', keyHandler);

  let isOpen = false;

  // FIX 3: Predefined template entries — fill in later
  const TEMPLATE_ENTRIES = [
    {
      title: 'May 16th, 2024',
      body: [
        'A boy lurks '
      ].join('\n'),
    },
    {
      title: 'Companions Manifest',
      body: [
        'Name: ___________________________',
        'Species / Origin: ___________________________',
        'Joined the TARDIS at: ___________________________',
        'Notable traits: ___________________________',
        '',
        '——',
        '',
        'Name: ___________________________',
        'Species / Origin: ___________________________',
        'Joined the TARDIS at: ___________________________',
        'Notable traits: ___________________________',
        '',
        '——',
        '',
        'Notes on the crew:',
        '',
      ].join('\n'),
    },
    {
      title: 'Space-Time Coordinates',
      body: [
        'Destination: ___________________________',
        'Sector / Galaxy: ___________________________',
        'Galactic Coordinates: ___________________________',
        '',
        'Departure time: ___________________________',
        'Arrival time: ___________________________',
        'Duration in vortex: ___________________________',
        '',
        'Navigation anomalies:',
        '',
        '',
        'Hazards noted:',
        '',
      ].join('\n'),
    },
    {
      title: 'Anomalies & Encounters',
      body: [
        'Type of anomaly: ___________________________',
        'Severity (1–10): ___________________________',
        'Location detected: ___________________________',
        '',
        'Description:',
        '',
        '',
        '',
        'Species / entities involved:',
        '',
        '',
        'Resolution / outcome:',
        '',
      ].join('\n'),
    },
    {
      title: 'Technical Faults',
      body: [
        'System affected: ___________________________',
        'Fault code: ___________________________',
        'First noticed: ___________________________',
        '',
        'Symptoms:',
        '',
        '',
        'Suspected cause:',
        '',
        '',
        'Repair attempt:',
        '',
        '',
        'Status: ☐ Unresolved   ☐ Bodged   ☐ Fixed (somehow)',
      ].join('\n'),
    },
    {
      title: 'Personal Reflections',
      body: [
        'Write your thoughts here. The TARDIS remembers everything.',
        '',
        '',
        '',
        '',
        '',
        '',
        '——',
        '"We\'re all stories in the end."',
      ].join('\n'),
    },
  ];

  function openNotebook() {
    loadEntries();
    // FIX 3: seed with templates if no saved entries exist
    if (entries.length === 0) {
      const now = Date.now();
      entries = TEMPLATE_ENTRIES.map((t, i) => ({
        title: t.title,
        body:  t.body,
        ts:    now - (TEMPLATE_ENTRIES.length - i) * 60000,
      }));
      saveEntries();
    }
    renderList();
    selectEntry(0);
    isOpen = true;
    overlay.style.pointerEvents = 'all';
    overlay.style.opacity = '1';
    const book = document.getElementById('nb-book');
    book.style.transform = 'scale(1) rotateX(0deg)';
    document.exitPointerLock();
  }

  function closeNotebook() {
    isOpen = false;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    const book = document.getElementById('nb-book');
    book.style.transform = 'scale(0.93) rotateX(3deg)';
    setTimeout(() => {
      document.getElementById('canvas')?.requestPointerLock();
    }, 350);
  }

  return { openNotebook, closeNotebook };
}

// ─────────────────────────────────────────────────────────────────────
//  INTERACT POPUP — small in-world popup for non-notebook objects
// ─────────────────────────────────────────────────────────────────────
function createInteractPopup() {
  const el = document.createElement('div');
  el.id = 'tardis-interact-popup';
  el.style.cssText = `
    position:fixed;left:50%;bottom:22vh;transform:translateX(-50%) translateY(10px);
    z-index:9990;pointer-events:none;
    opacity:0;transition:opacity 0.3s,transform 0.3s;
    font-family:Georgia,serif;
    max-width:min(480px,88vw);
  `;
  document.body.appendChild(el);

  let _timeout = null;

  function show(html, durationMs = 5000) {
    clearTimeout(_timeout);
    el.innerHTML = `
      <div style="
        background:linear-gradient(160deg,rgba(20,12,4,0.97),rgba(28,16,6,0.97));
        border:1px solid rgba(180,130,50,0.35);
        border-radius:14px;padding:18px 24px 16px;
        box-shadow:0 8px 40px rgba(0,0,0,0.65),0 0 60px rgba(180,120,40,0.08),
          inset 0 0 0 1px rgba(255,200,80,0.05);
        position:relative;
      ">
        <div style="position:absolute;top:0;left:24px;right:24px;height:1px;
          background:linear-gradient(90deg,transparent,rgba(180,130,50,0.5),transparent)"></div>
        ${html}
        <div style="position:absolute;bottom:0;left:24px;right:24px;height:1px;
          background:linear-gradient(90deg,transparent,rgba(180,130,50,0.2),transparent)"></div>
      </div>
    `;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0px)';
    if (durationMs > 0) {
      _timeout = setTimeout(() => hide(), durationMs);
    }
  }

  function hide() {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(10px)';
  }

  return { show, hide };
}

// ─────────────────────────────────────────────────────────────────────
//  NOTEBOOK V2 — physical book with page-flip animation
//  Same STORAGE_KEY as V1 so entries are shared.
//  To swap: comment out "this._notebook = createNotebookV2(...)" in init()
//           and uncomment "this._notebook = createNotebook(...)" below it.
// ─────────────────────────────────────────────────────────────────────
function createNotebookV2(engine) {
  const STORAGE_KEY = 'tardis_log_v2';
  let entries = [];
  let currentIdx = -1;
  let isOpen = false;
  let isFlipping = false;

  // ── Template entries (same as V1)
  const TEMPLATE_ENTRIES = [
    { title: 'Mission Log — Arrival', body: 'Date / Stardate: ___________________________\nLocation: ___________________________\nObjective: ___________________________\n\nSituation on arrival:\n\n\n\nActions taken:\n\n\n\nCurrent status:\n\n' },
    { title: 'Companions Manifest',   body: 'Name: ___________________________\nSpecies / Origin: ___________________________\nJoined at: ___________________________\nNotes: ___________________________\n\n——\n\nName: ___________________________\nSpecies / Origin: ___________________________\nJoined at: ___________________________\nNotes: ___________________________\n\nAdditional observations:\n\n' },
    { title: 'Space-Time Coordinates', body: 'Destination: ___________________________\nSector / Galaxy: ___________________________\nGalactic Coordinates: ___________________________\n\nDeparture: ___________________________\nArrival: ___________________________\nDuration in vortex: ___________________________\n\nNavigation anomalies:\n\n\nHazards:\n\n' },
    { title: 'Anomalies & Encounters', body: 'Type: ___________________________\nSeverity (1–10): ___________________________\nLocation: ___________________________\n\nDescription:\n\n\n\nSpecies / entities:\n\n\nResolution:\n\n' },
    { title: 'Technical Faults',       body: 'System affected: ___________________________\nFault code: ___________________________\nFirst noticed: ___________________________\n\nSymptoms:\n\n\nSuspected cause:\n\n\nRepair attempt:\n\n\nStatus: ☐ Unresolved   ☐ Bodged   ☐ Fixed (somehow)' },
    { title: 'Personal Reflections',   body: 'Write your thoughts here. The TARDIS remembers everything.\n\n\n\n\n\n\n——\n"We\'re all stories in the end."' },
  ];

  function loadEntries() {
    try { entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { entries = []; }
  }
  function saveEntries() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
  }
  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
      .toUpperCase().replace(/ /g,'·');
  }

  // ── Build DOM
  const overlay = document.createElement('div');
  overlay.id = 'nb2-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:10000;
    display:flex;align-items:center;justify-content:center;
    background:rgba(8,4,1,0.94);backdrop-filter:blur(20px);
    opacity:0;pointer-events:none;
    transition:opacity 0.38s cubic-bezier(0.16,1,0.3,1);
    font-family:Georgia,serif;
  `;

  overlay.innerHTML = `
    <div id="nb2-book" style="
      position:relative;
      width:min(920px,96vw);height:min(600px,90vh);
      display:flex;
      border-radius:3px 16px 16px 3px;
      box-shadow:0 0 0 1px rgba(160,110,40,0.3),0 40px 100px rgba(0,0,0,0.8),
        0 0 140px rgba(220,150,40,0.06),inset 0 0 0 1px rgba(255,190,60,0.05);
      transform:scale(0.91) rotateX(4deg);
      transition:transform 0.42s cubic-bezier(0.16,1,0.3,1);
      overflow:hidden;
    ">

      <!-- SPINE -->
      <div style="
        width:18px;flex-shrink:0;
        background:linear-gradient(180deg,#1a0c04,#0e0602,#1a0c04);
        border-right:1px solid rgba(160,100,30,0.4);
        display:flex;flex-direction:column;align-items:center;
        padding:20px 0;gap:12px;
      ">
        ${Array.from({length:9},(_,i)=>`<div style="width:6px;height:6px;border-radius:50%;
          background:rgba(${i%2?'180,130,50':'100,70,20'},0.${i%2?'7':'4'});"></div>`).join('')}
      </div>

      <!-- LEFT PAGE — index -->
      <div id="nb2-left" style="
        width:230px;flex-shrink:0;
        background:linear-gradient(168deg,#1d1005 0%,#231306 55%,#1a0e04 100%);
        border-right:2px solid rgba(160,110,30,0.22);
        display:flex;flex-direction:column;padding:26px 18px 18px;
        position:relative;overflow:hidden;
      ">
        <div style="position:absolute;inset:0;opacity:0.05;pointer-events:none;
          background:repeating-linear-gradient(0deg,transparent,transparent 27px,
          rgba(200,150,60,0.8) 27px,rgba(200,150,60,0.8) 28px)"></div>

        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:24px;filter:drop-shadow(0 0 10px rgba(140,210,255,0.7))">⌛</div>
          <div style="font-size:8px;letter-spacing:4px;color:rgba(220,170,60,0.45);
            margin-top:5px;font-family:monospace">T·A·R·D·I·S</div>
        </div>

        <div style="font-size:14px;font-weight:700;color:rgba(240,195,80,0.88);
          letter-spacing:2px;margin-bottom:4px">CAPTAIN'S LOG</div>
        <div style="height:1px;background:linear-gradient(90deg,rgba(160,110,30,0.5),transparent);
          margin-bottom:14px"></div>

        <div id="nb2-list" style="
          flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:3px;
          scrollbar-width:thin;scrollbar-color:rgba(160,110,30,0.25) transparent;
        "></div>

        <button id="nb2-new" style="
          margin-top:14px;padding:8px 0;width:100%;
          background:rgba(160,110,30,0.15);border:1px solid rgba(160,110,30,0.3);
          border-radius:7px;color:rgba(240,195,80,0.8);font-size:11px;
          letter-spacing:1px;font-family:serif;cursor:pointer;
          transition:background 0.18s;
        ">+ New Entry</button>
      </div>

      <!-- RIGHT PAGE — the writing surface (flippable) -->
      <div id="nb2-right" style="
        flex:1;position:relative;overflow:hidden;
        background:linear-gradient(155deg,#1b0f06 0%,#221308 50%,#1d1007 100%);
        perspective:1100px;
      ">
        <!-- page grain lines -->
        <div style="position:absolute;inset:0;pointer-events:none;opacity:0.035;
          background:repeating-linear-gradient(0deg,transparent,transparent 27px,
          rgba(220,170,60,0.9) 27px,rgba(220,170,60,0.9) 28px)"></div>

        <!-- inner glow corners -->
        <div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;
          background:radial-gradient(circle,rgba(160,110,30,0.09) 0%,transparent 70%);
          pointer-events:none"></div>
        <div style="position:absolute;bottom:-30px;left:-30px;width:110px;height:110px;
          background:radial-gradient(circle,rgba(60,130,200,0.06) 0%,transparent 70%);
          pointer-events:none"></div>

        <!-- THE FLIPPING CONTENT PANEL -->
        <div id="nb2-content" style="
          position:absolute;inset:0;
          display:flex;flex-direction:column;
          padding:28px 32px 20px;
          transform-origin:left center;
          transition:transform 0s;
          transform-style:preserve-3d;
          will-change:transform;
        ">
          <!-- nav row -->
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <button id="nb2-prev" style="
              width:26px;height:26px;border-radius:50%;
              background:rgba(160,110,30,0.18);border:1px solid rgba(160,110,30,0.3);
              color:rgba(240,195,80,0.7);font-size:13px;cursor:pointer;
              display:flex;align-items:center;justify-content:center;
              transition:background 0.15s;flex-shrink:0;
            ">‹</button>
            <input id="nb2-title" type="text" placeholder="Entry title…" style="
              flex:1;background:transparent;border:none;outline:none;
              border-bottom:1px solid rgba(160,110,30,0.22);
              color:rgba(245,200,80,0.93);font-size:18px;font-family:serif;
              font-weight:700;padding:3px 0;letter-spacing:0.4px;
              transition:border-color 0.2s;
            "/>
            <button id="nb2-next" style="
              width:26px;height:26px;border-radius:50%;
              background:rgba(160,110,30,0.18);border:1px solid rgba(160,110,30,0.3);
              color:rgba(240,195,80,0.7);font-size:13px;cursor:pointer;
              display:flex;align-items:center;justify-content:center;
              transition:background 0.15s;flex-shrink:0;
            ">›</button>
            <div id="nb2-counter" style="
              font-size:9px;color:rgba(200,150,50,0.35);font-family:monospace;
              letter-spacing:1px;flex-shrink:0;min-width:40px;text-align:right;
            ">0 / 0</div>
          </div>

          <div id="nb2-dateline" style="
            font-size:9px;color:rgba(200,150,50,0.38);font-family:monospace;
            letter-spacing:2px;margin-bottom:4px;
          "></div>
          <div style="height:1px;background:linear-gradient(90deg,rgba(160,110,30,0.38),transparent);
            margin-bottom:16px"></div>

          <textarea id="nb2-body" placeholder="Write your entry here…" style="
            flex:1;background:transparent;border:none;resize:none;outline:none;
            color:rgba(248,215,158,0.8);font-size:14px;line-height:1.9;
            font-family:Georgia,serif;
            scrollbar-width:thin;scrollbar-color:rgba(160,110,30,0.18) transparent;
          "></textarea>

          <!-- bottom bar -->
          <div style="
            display:flex;align-items:center;justify-content:space-between;
            margin-top:12px;padding-top:12px;
            border-top:1px solid rgba(160,110,30,0.13);gap:8px;flex-wrap:wrap;
          ">
            <span id="nb2-chars" style="font-size:9px;color:rgba(200,150,50,0.28);
              font-family:monospace;letter-spacing:1px">0 chars</span>
            <div style="display:flex;gap:7px">
              <button id="nb2-delete" style="
                padding:6px 14px;background:rgba(160,40,40,0.1);
                border:1px solid rgba(160,40,40,0.22);border-radius:7px;
                color:rgba(240,110,90,0.65);font-size:10px;font-family:serif;
                cursor:pointer;transition:all 0.18s;letter-spacing:0.4px;
              ">Delete</button>
              <button id="nb2-save" style="
                padding:6px 18px;
                background:linear-gradient(135deg,rgba(160,110,30,0.32),rgba(180,130,40,0.22));
                border:1px solid rgba(180,130,45,0.42);border-radius:7px;
                color:rgba(245,210,100,0.93);font-size:10px;font-family:serif;
                cursor:pointer;letter-spacing:0.4px;
                box-shadow:0 0 14px rgba(160,110,30,0.12);
                transition:all 0.18s;
              ">Save ✦</button>
            </div>
          </div>
        </div>

        <!-- PAGE TURN EFFECT LAYER (cloned, animates over content) -->
        <div id="nb2-flipper" style="
          position:absolute;inset:0;pointer-events:none;
          transform-origin:left center;
          background:linear-gradient(155deg,#1b0f06 0%,#221308 50%,#1d1007 100%);
          opacity:0;
        "></div>
      </div>

      <!-- close -->
      <button id="nb2-close" style="
        position:absolute;top:12px;right:14px;z-index:10;
        width:28px;height:28px;border-radius:50%;
        background:rgba(160,110,30,0.12);border:1px solid rgba(160,110,30,0.26);
        color:rgba(240,195,80,0.65);font-size:15px;line-height:1;
        cursor:pointer;transition:background 0.18s;
      ">×</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // ── helpers
  function renderList() {
    const list = document.getElementById('nb2-list');
    list.innerHTML = '';
    if (!entries.length) {
      list.innerHTML = `<div style="font-size:10px;color:rgba(200,150,50,0.22);
        text-align:center;margin-top:18px;font-family:monospace;letter-spacing:1px">
        No entries</div>`;
      return;
    }
    entries.forEach((e, i) => {
      const b = document.createElement('button');
      const cur = i === currentIdx;
      b.style.cssText = `
        width:100%;text-align:left;padding:7px 9px;border-radius:7px;cursor:pointer;
        background:${cur ? 'rgba(160,110,30,0.2)' : 'transparent'};
        border:1px solid ${cur ? 'rgba(160,110,30,0.32)' : 'rgba(160,110,30,0.07)'};
        transition:all 0.13s;
      `;
      b.innerHTML = `
        <div style="font-size:11px;font-weight:700;font-family:serif;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          color:rgba(240,195,80,${cur ? '0.92' : '0.58'})">${e.title || 'Untitled'}</div>
        <div style="font-size:8px;color:rgba(200,150,50,0.3);
          font-family:monospace;letter-spacing:1px;margin-top:2px">${formatDate(e.ts)}</div>
      `;
      b.onclick = () => flipToEntry(i);
      b.onmouseenter = () => { if (i !== currentIdx) b.style.background = 'rgba(160,110,30,0.1)'; };
      b.onmouseleave = () => { if (i !== currentIdx) b.style.background = 'transparent'; };
      list.appendChild(b);
    });
  }

  function loadContent(i) {
    if (i < 0 || i >= entries.length) return;
    const e = entries[i];
    document.getElementById('nb2-title').value = e.title || '';
    document.getElementById('nb2-body').value  = e.body  || '';
    document.getElementById('nb2-dateline').textContent = formatDate(e.ts);
    document.getElementById('nb2-counter').textContent  = `${i+1} / ${entries.length}`;
    updateChars();
    currentIdx = i;
    renderList();
  }

  function updateChars() {
    const v = (document.getElementById('nb2-body')?.value || '').length;
    const el = document.getElementById('nb2-chars');
    if (el) el.textContent = `${v} chars`;
  }

  // ── THE FLIP ANIMATION — two-phase rotateY
  function flipToEntry(newIdx) {
    if (isFlipping || newIdx === currentIdx || newIdx < 0 || newIdx >= entries.length) {
      if (newIdx === currentIdx) return;
      loadContent(newIdx); return;
    }
    isFlipping = true;
    const content = document.getElementById('nb2-content');
    const flipper = document.getElementById('nb2-flipper');
    const goingForward = newIdx > currentIdx;

    // Phase 1: fold current page away
    content.style.transition = 'transform 0.22s ease-in';
    content.style.transform  = goingForward
      ? 'perspective(900px) rotateY(-88deg)' 
      : 'perspective(900px) rotateY(88deg)';

    // page-shadow sweeps across
    flipper.style.transition  = 'opacity 0.22s ease-in';
    flipper.style.opacity     = '1';

    setTimeout(() => {
      // Swap content at the fold midpoint
      loadContent(newIdx);
      content.style.transition = 'none';
      content.style.transform  = goingForward
        ? 'perspective(900px) rotateY(88deg)'
        : 'perspective(900px) rotateY(-88deg)';

      // Phase 2: unfold into new page
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          content.style.transition = 'transform 0.22s ease-out';
          content.style.transform  = 'perspective(900px) rotateY(0deg)';
          flipper.style.transition = 'opacity 0.22s ease-out';
          flipper.style.opacity    = '0';
          setTimeout(() => { isFlipping = false; }, 230);
        });
      });
    }, 225);
  }

  function saveCurrentEntry() {
    if (currentIdx < 0) { newEntry(); return; }
    entries[currentIdx].title = document.getElementById('nb2-title').value;
    entries[currentIdx].body  = document.getElementById('nb2-body').value;
    entries[currentIdx].ts    = Date.now();
    saveEntries();
    renderList();
    const btn = document.getElementById('nb2-save');
    if (!btn) return;
    btn.textContent = 'Saved ✓';
    btn.style.background = 'linear-gradient(135deg,rgba(50,160,70,0.32),rgba(40,140,60,0.22))';
    btn.style.borderColor = 'rgba(90,200,110,0.42)';
    btn.style.color = 'rgba(150,240,170,0.92)';
    setTimeout(() => {
      btn.textContent = 'Save ✦';
      btn.style.background = 'linear-gradient(135deg,rgba(160,110,30,0.32),rgba(180,130,40,0.22))';
      btn.style.borderColor = 'rgba(180,130,45,0.42)';
      btn.style.color = 'rgba(245,210,100,0.93)';
    }, 1300);
  }

  function newEntry() {
    entries.unshift({ title: '', body: '', ts: Date.now() });
    saveEntries();
    flipToEntry(0);
    setTimeout(() => document.getElementById('nb2-title')?.focus(), 500);
  }

  function deleteEntry() {
    if (currentIdx < 0) return;
    entries.splice(currentIdx, 1);
    saveEntries();
    if (entries.length) { currentIdx = 0; loadContent(0); }
    else {
      currentIdx = -1;
      document.getElementById('nb2-title').value = '';
      document.getElementById('nb2-body').value  = '';
      document.getElementById('nb2-dateline').textContent = '';
      document.getElementById('nb2-counter').textContent  = '0 / 0';
      updateChars(); renderList();
    }
  }

  // ── Wire events
  document.getElementById('nb2-close').onclick  = () => closeNotebook();
  document.getElementById('nb2-new').onclick    = newEntry;
  document.getElementById('nb2-save').onclick   = saveCurrentEntry;
  document.getElementById('nb2-delete').onclick = deleteEntry;
  document.getElementById('nb2-body').oninput   = updateChars;
  document.getElementById('nb2-prev').onclick   = () => flipToEntry(currentIdx - 1);
  document.getElementById('nb2-next').onclick   = () => flipToEntry(currentIdx + 1);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeNotebook(); });

  const keyHandler = e => {
    if (!isOpen) return;
    if (e.code === 'Escape') closeNotebook();
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); saveCurrentEntry(); }
    if (e.code === 'ArrowLeft'  && !e.target.matches('input,textarea')) flipToEntry(currentIdx - 1);
    if (e.code === 'ArrowRight' && !e.target.matches('input,textarea')) flipToEntry(currentIdx + 1);
  };
  document.addEventListener('keydown', keyHandler);

  // ── Hover styles
  ['nb2-new','nb2-prev','nb2-next'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onmouseenter = () => el.style.background = 'rgba(160,110,30,0.3)';
    el.onmouseleave = () => el.style.background = 'rgba(160,110,30,0.18)';
  });

  function openNotebook() {
    loadEntries();
    if (!entries.length) {
      const now = Date.now();
      entries = TEMPLATE_ENTRIES.map((t, i) => ({
        title: t.title, body: t.body,
        ts: now - (TEMPLATE_ENTRIES.length - i) * 60000,
      }));
      saveEntries();
    }
    renderList();
    loadContent(0);
    isOpen = true;
    overlay.style.pointerEvents = 'all';
    overlay.style.opacity = '1';
    document.getElementById('nb2-book').style.transform = 'scale(1) rotateX(0deg)';
    document.exitPointerLock();
  }

  function closeNotebook() {
    isOpen = false;
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    document.getElementById('nb2-book').style.transform = 'scale(0.91) rotateX(4deg)';
    setTimeout(() => document.getElementById('canvas')?.requestPointerLock(), 380);
  }

  return { openNotebook, closeNotebook };
}

// ═══════════════════════════════════════════════════════════════════════
//  THE LEVEL
// ═══════════════════════════════════════════════════════════════════════
export class TardisLevel extends Level {
  constructor(engine) {
    super(engine);
    this._rotorY            = 0;
    this._consoleGlow       = [];
    this._panelLights       = [];
    this._timeRotorMeshes   = [];
    this._restarting        = false;
    this._notebook          = null;
    this._popup             = null;
    this._interactCooldown  = 0;
    this._consoleLeverAngles= [];
    this._dialRotations     = [];
    this._screenMessages    = [];
    this._currentMsgIdx     = 0;
    this._msgTimer          = 0;
    this._hatAngle          = 0;
    this._hatSpinning       = false;
    this._hatSpinTimer      = 0;
    this._crystalColor      = 0;
    this._crystalMeshes     = [];
    this._bookshelfMeshes   = [];
    this._telescopeMesh     = null;
    this._telescopeAngle    = 0;
    this._globeMesh         = null;
    this._globeAngle        = 0;
    this._torchLights       = [];
    this._arrivalOverlay    = null;
    this._flickerLights     = [];
    this._nearbyObj         = null;   // closest interactable this frame
    this._hintEl            = null;   // DOM hint "Press E"
  }

  // ─────────────────────────────────────────────
  init() {
    document.querySelectorAll('[data-elden-stamina],[data-elden-flash],[data-elden-hit]')
      .forEach(el => el.remove());

    // ── UI systems
    this._notebook = createNotebookV2(this.engine);  // ← V2: flip animation
    // this._notebook = createNotebook(this.engine); // ← V1: classic sidebar — swap to enable
    this._popup    = createInteractPopup();

    // ── Proximity hint pill (shows "Press E — <object name>" when near anything)
    this._hintEl = document.createElement('div');
    this._hintEl.style.cssText = `
      position:fixed;left:50%;bottom:12vh;
      transform:translateX(-50%) translateY(6px);
      z-index:9985;pointer-events:none;
      opacity:0;transition:opacity 0.22s,transform 0.22s;
      font-family:Georgia,serif;white-space:nowrap;
    `;
    this._hintEl.innerHTML = `
      <div style="
        background:rgba(14,8,2,0.88);
        border:1px solid rgba(200,150,60,0.45);
        border-radius:30px;padding:9px 22px 9px 16px;
        display:flex;align-items:center;gap:10px;
        box-shadow:0 4px 24px rgba(0,0,0,0.5),0 0 40px rgba(200,140,40,0.08);
      ">
        <span style="
          background:rgba(200,150,50,0.22);
          border:1px solid rgba(200,150,50,0.45);
          border-radius:6px;padding:2px 9px;
          font-size:12px;font-weight:700;
          color:rgba(255,220,100,0.95);letter-spacing:1px;font-family:monospace;
        ">E</span>
        <span id="tardis-hint-text" style="
          font-size:13px;color:rgba(255,210,150,0.85);letter-spacing:0.5px;
        ">Interact</span>
      </div>
    `;
    document.body.appendChild(this._hintEl);

    // ═══════════════════════════════════════════
    //  ATMOSPHERE
    // ═══════════════════════════════════════════
    this.scene.background = new THREE.Color(0x150c04);
    this.scene.fog = new THREE.Fog(0x120a03, 18, 44);

    const ambient = new THREE.AmbientLight(0xffe0a0, 0.5);
    this.scene.add(ambient);

    const ceiling = new THREE.DirectionalLight(0xffd070, 0.85);
    ceiling.position.set(0, 14, 0);
    ceiling.castShadow = true;
    ceiling.shadow.mapSize.setScalar(2048);
    ceiling.shadow.camera.near = 0.5;
    ceiling.shadow.camera.far  = 36;
    ceiling.shadow.camera.left = ceiling.shadow.camera.bottom = -18;
    ceiling.shadow.camera.right= ceiling.shadow.camera.top   =  18;
    ceiling.shadow.bias = -0.0003;
    this.scene.add(ceiling);

    this._rotorFill  = Build.pointLight(this.scene, 0, 5,   0, 0xaaddff, 3.2, 14);
    this._rotorFill2 = Build.pointLight(this.scene, 0, 2,   0, 0x88ccff, 1.8,  8);
    Build.pointLight(this.scene, 0, 0.3, 0, 0xff9944, 1.0, 7);

    const hemi = new THREE.HemisphereLight(0xffe0a0, 0x100800, 0.45);
    this.scene.add(hemi);

    // ═══════════════════════════════════════════
    //  FLOOR — dark grated bronze
    // ═══════════════════════════════════════════
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x221408, roughness: 0.88, metalness: 0.28 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34, 1, 1), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grateMat = new THREE.MeshBasicMaterial({ color: 0x160e04, transparent: true, opacity: 0.82 });
    for (let x = -15; x <= 15; x += 1.2) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 28), grateMat);
      l.rotation.x = -Math.PI/2; l.position.set(x, 0.002, 0); this.scene.add(l);
    }
    for (let z = -15; z <= 15; z += 1.2) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(28, 0.04), grateMat);
      l.rotation.x = -Math.PI/2; l.position.set(0, 0.002, z); this.scene.add(l);
    }

    // warm glow pools around console
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2;
      const r = 2.8;
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(0.6, 12),
        new THREE.MeshBasicMaterial({ color: 0xff8833, transparent: true, opacity: 0.07, depthWrite: false })
      );
      pool.rotation.x = -Math.PI/2;
      pool.position.set(Math.cos(a)*r, 0.003, Math.sin(a)*r);
      this.scene.add(pool);
      this._consoleGlow.push({ mesh: pool, phase: (i/6)*Math.PI*2, base: 0.07, isPool: true });
    }

    // ═══════════════════════════════════════════
    //  WALLS — octagonal coral roundel panels
    // ═══════════════════════════════════════════
    const wallColor   = 0x7a5035;
    const roundelCol  = 0xc89860;

    for (let i = 0; i < 8; i++) {
      const angle = (i/8)*Math.PI*2 + Math.PI/8;
      const wx = Math.cos(angle) * 11.4;
      const wz = Math.sin(angle) * 11.4;

      const { mesh: wall } = Build.box(this.scene, wx, 5.6, wz, 8.2, 11.2, 0.72, wallColor, {
        matOpts: { roughness: 0.9, metalness: 0.06 }
      });
      wall.rotation.y = -angle;
      wall.receiveShadow = true;

      const fwd = 0.40;
      const perpX = Math.cos(angle) * fwd;
      const perpZ = Math.sin(angle) * fwd;

      // ROUNDELS — 3 columns × 3 rows
      for (let rx = -1; rx <= 1; rx++) {
        for (let ry = 0; ry <= 2; ry++) {
          const sideX = Math.cos(angle + Math.PI/2) * rx * 2.7;
          const sideZ = Math.sin(angle + Math.PI/2) * rx * 2.7;

          // outer disc (ivory)
          const roundel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.90, 0.90, 0.12, 22),
            new THREE.MeshStandardMaterial({
              color: roundelCol,
              roughness: 0.72,
              metalness: 0.22,
              emissive: new THREE.Color(0x442211),
              emissiveIntensity: 0.28,
            })
          );
          roundel.position.set(wx + sideX - perpX, 1.2 + ry*3.1, wz + sideZ - perpZ);
          roundel.rotation.y = -angle;
          roundel.rotation.x = Math.PI/2;
          this.scene.add(roundel);

          // inner disc (deeper ivory)
          const inner = new THREE.Mesh(
            new THREE.CylinderGeometry(0.72, 0.72, 0.08, 20),
            new THREE.MeshStandardMaterial({
              color: 0xd4a060,
              roughness: 0.65, metalness: 0.28,
              emissive: new THREE.Color(0x664422),
              emissiveIntensity: 0.22,
            })
          );
          inner.position.copy(roundel.position);
          inner.position.x -= Math.cos(angle)*0.04;
          inner.position.z -= Math.sin(angle)*0.04;
          inner.rotation.copy(roundel.rotation);
          this.scene.add(inner);

          // shadow ring
          const shadow = new THREE.Mesh(
            new THREE.CylinderGeometry(0.93, 0.93, 0.04, 22),
            new THREE.MeshBasicMaterial({ color: 0x2e1608, transparent: true, opacity: 0.65 })
          );
          shadow.position.copy(roundel.position);
          shadow.position.x -= Math.cos(angle)*0.06;
          shadow.position.z -= Math.sin(angle)*0.06;
          shadow.rotation.copy(roundel.rotation);
          this.scene.add(shadow);

          this._consoleGlow.push({
            mesh: inner,
            phase: Math.random()*Math.PI*2,
            base: 0.22,
            isRoundel: true,
          });
        }
      }

      // warm vertical strip between roundel columns
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.09, 9.8),
        new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.12, depthWrite: false })
      );
      strip.position.set(wx - Math.cos(angle)*0.35, 5.6, wz - Math.sin(angle)*0.35);
      strip.rotation.y = -angle;
      this.scene.add(strip);

      const stripL = Build.pointLight(
        this.scene,
        wx - Math.cos(angle)*0.42, 5.6, wz - Math.sin(angle)*0.42,
        0xffaa44, 0.5, 4.8
      );
      this._flickerLights.push({ light: stripL, phase: Math.random()*Math.PI*2, base: 0.5 });
    }

    // BASE SKIRT
    for (let i = 0; i < 8; i++) {
      const angle = (i/8)*Math.PI*2 + Math.PI/8;
      const { mesh: skirt } = Build.box(
        this.scene,
        Math.cos(angle)*11.2, 0.55, Math.sin(angle)*11.2,
        8.3, 1.1, 0.95, 0x3e2410, { noOutline: true }
      );
      skirt.rotation.y = -angle;
    }

    // ═══════════════════════════════════════════
    //  CEILING DOME
    // ═══════════════════════════════════════════
    Build.box(this.scene, 0, 12.4, 0, 28, 0.55, 28, 0x4e3018, { noOutline: true });
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2;
      const { mesh: rib } = Build.box(this.scene, Math.cos(a)*5.2, 12.0, Math.sin(a)*5.2, 0.22, 0.4, 10.5, 0x3e2810, { noOutline: true });
      rib.rotation.y = -a;
    }
    // ceiling roundels
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2;
      const cr = new THREE.Mesh(
        new THREE.CylinderGeometry(0.78, 0.78, 0.12, 18),
        new THREE.MeshStandardMaterial({ color: 0xb88850, roughness: 0.78, metalness: 0.18 })
      );
      cr.position.set(Math.cos(a)*4.8, 12.1, Math.sin(a)*4.8);
      this.scene.add(cr);
    }

    // ceiling ring lamp
    Build.pointLight(this.scene, 0, 11.6, 0, 0xffd090, 3.8, 18);
    const ceilRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.10, 8, 34),
      new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.65 })
    );
    ceilRing.position.set(0, 11.5, 0); ceilRing.rotation.x = Math.PI/2;
    this.scene.add(ceilRing);
    this._ceilRing = ceilRing;

    // ═══════════════════════════════════════════
    //  CORAL SUPPORT STRUTS (4 large)
    // ═══════════════════════════════════════════
    for (let i = 0; i < 4; i++) {
      const a  = (i/4)*Math.PI*2 + Math.PI/4;
      const r  = 5.6;
      const cx = Math.cos(a)*r;
      const cz = Math.sin(a)*r;

      const { mesh: strut } = Build.box(this.scene, cx, 6, cz, 0.40, 12, 0.40, 0x7a4420, {
        matOpts: { roughness: 0.92, metalness: 0.08 }
      });
      strut.castShadow = true;

      // organic branches — simplified to 3 clean arms, no sub-branches
      for (let b = 0; b < 3; b++) {
        const by     = 4.0 + b * 2.4;
        const bAngle = a + (b % 2 === 0 ? 0.5 : -0.5);
        const bLen   = 1.1 + b * 0.18;
        const bx2    = cx + Math.cos(bAngle) * bLen * 0.42;
        const bz2    = cz + Math.sin(bAngle) * bLen * 0.42;
        const { mesh: branch } = Build.box(this.scene, bx2, by, bz2, 0.16, 0.16, bLen, 0x8a5025, { noOutline: true });
        branch.rotation.y = -bAngle;
        branch.rotation.z = -0.28 + b * 0.05;
      }

      Build.pointLight(this.scene, cx, 0.5, cz, 0xff7722, 0.65, 3.5);
      Build.box(this.scene, cx, 0.18, cz, 0.68, 0.36, 0.68, 0x4e2c0e);
    }

    // ═══════════════════════════════════════════
    //  CENTRAL CONSOLE
    // ═══════════════════════════════════════════
    Build.box(this.scene, 0, 0,    0, 5.2, 0.24, 5.2, 0x3e2408);
    Build.box(this.scene, 0, 0.24, 0, 4.6, 0.20, 4.6, 0x4e3012);
    Build.box(this.scene, 0, 0.44, 0, 4.0, 0.20, 4.0, 0x583818);
    Build.box(this.scene, 0, 0.64, 0, 3.4, 0.16, 3.4, 0x644020);

    // Six console panels
    const btnColArrays = [
      [0xff3300, 0xffaa00, 0x00aaff, 0xffff00, 0x00ff88, 0xff00aa],
      [0xff6600, 0x00ffcc, 0xff00ff, 0xffff33, 0x4444ff, 0xff4444],
      [0x00ff44, 0xffaa22, 0x8800ff, 0x00ffff, 0xff2200, 0xaaff00],
      [0xff0088, 0x44ffff, 0xffcc00, 0x0088ff, 0xff6600, 0x44ff44],
      [0xffff00, 0xff0044, 0x00ff88, 0x8800ff, 0xffaa00, 0x0044ff],
      [0x00aaff, 0xff8800, 0x44ff00, 0xff0066, 0xffcc44, 0x8800ff],
    ];

    for (let i = 0; i < 6; i++) {
      const a  = (i/6)*Math.PI*2 + Math.PI/6;
      const cx = Math.cos(a) * 1.38;
      const cz = Math.sin(a) * 1.38;

      const { mesh: panel } = Build.box(this.scene, cx, 1.5, cz, 0.95, 1.65, 0.55, 0x4e3010, {
        matOpts: { roughness: 0.78, metalness: 0.38 }
      });
      panel.rotation.y = -a;
      panel.castShadow = true;

      // face
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.78, 1.45),
        new THREE.MeshStandardMaterial({ color: 0x2e1808, roughness: 0.68, metalness: 0.48 })
      );
      face.position.set(cx + Math.cos(a)*0.29, 1.5, cz + Math.sin(a)*0.29);
      face.rotation.y = -a;
      this.scene.add(face);

      // buttons
      const btnCols = btnColArrays[i];
      for (let b = 0; b < 6; b++) {
        const bRow = Math.floor(b/3);
        const bCol = b % 3;
        const bx2  = Math.cos(a + Math.PI/2) * (bCol - 1) * 0.18;
        const bz2  = Math.sin(a + Math.PI/2) * (bCol - 1) * 0.18;
        const btn  = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.09, 0.05),
          new THREE.MeshBasicMaterial({ color: btnCols[b] })
        );
        btn.position.set(cx + Math.cos(a)*0.30 + bx2, 1.08 + bRow*0.30, cz + Math.sin(a)*0.30 + bz2);
        btn.rotation.y = -a;
        this.scene.add(btn);
        this._consoleGlow.push({ mesh: btn, phase: Math.random()*Math.PI*2, base: 1.0, isBtn: true });
      }

      // LEVER — interactive
      const leverInitAngle = (Math.random() - 0.5) * 0.7;
      this._consoleLeverAngles.push(leverInitAngle);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, 0.07), Anime.mat(0x7a4a20, { roughness: 0.68 }));
      lever.position.set(cx + Math.cos(a)*0.31, 1.95, cz + Math.sin(a)*0.31);
      lever.rotation.y = -a;
      lever.rotation.x = leverInitAngle;
      lever.userData.isLever = true;
      lever.userData.panelIdx = i;
      lever.userData.onInteract = (obj) => {
        const newAngle = -this._consoleLeverAngles[i];
        this._consoleLeverAngles[i] = newAngle;
        lever.rotation.x = newAngle;
        this.engine.audio.play('chop');
        this._popup.show(`
          <div style="font-size:11px;letter-spacing:3px;color:rgba(255,180,60,0.5);font-family:monospace;margin-bottom:6px">CONSOLE PANEL ${i+1}</div>
          <div style="font-size:16px;font-weight:700;color:rgba(255,220,120,0.95);font-family:serif;margin-bottom:4px">
            ${newAngle < 0 ? 'Lever Forward' : 'Lever Aft'}
          </div>
          <div style="font-size:13px;color:rgba(255,200,120,0.65);line-height:1.6">
            ${['Temporal stabilisers engaged.','Dematerialisation circuits primed.','Artron energy redirected.','Navigation matrix recalibrated.','Chameleon circuit bypassed.','Time-lock disengaged.'][i]}
          </div>
        `);
      };
      this.scene.add(lever);
      this.interactables.push(lever);

      // lever ball
      const leverBall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), Anime.mat(0xcc8833, { roughness: 0.38, metalness: 0.65 }));
      leverBall.position.set(cx + Math.cos(a)*0.31, 2.24, cz + Math.sin(a)*0.31);
      this.scene.add(leverBall);

      // ROTATING DIAL
      const dialGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16);
      const dialMat  = new THREE.MeshStandardMaterial({ color: 0x887744, roughness: 0.45, metalness: 0.7 });
      const dial = new THREE.Mesh(dialGeom, dialMat);
      dial.position.set(cx + Math.cos(a)*0.31, 1.55, cz + Math.sin(a)*0.31 + Math.sin(a + Math.PI/2)*0.16);
      dial.rotation.z = Math.PI/2;
      this.scene.add(dial);
      this._dialRotations.push({ mesh: dial, speed: 0.3 + Math.random()*0.5, phase: Math.random()*Math.PI*2 });
    }

    // console top ring
    Build.box(this.scene, 0, 2.32, 0, 3.5, 0.14, 3.5, 0x4e3010);
    Build.box(this.scene, 0, 2.46, 0, 3.1, 0.10, 3.1, 0x583c16);

    // ═══════════════════════════════════════════
    //  TIME ROTOR — glowing crystal column
    // ═══════════════════════════════════════════
    Build.box(this.scene, 0, 2.56, 0, 0.75, 0.22, 0.75, 0x8a5c28);
    Build.box(this.scene, 0, 9.90, 0, 0.75, 0.22, 0.75, 0x8a5c28);

    // glass tube panels
    for (let i = 0; i < 16; i++) {
      const a   = (i/16)*Math.PI*2;
      const r   = 0.32;
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.13, 7.25),
        new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.035, side: THREE.DoubleSide, depthWrite: false })
      );
      pane.position.set(Math.cos(a)*r, 5.95, Math.sin(a)*r);
      pane.rotation.y = -a;
      this.scene.add(pane);
    }

    // crystal segments
    const crystalColors = [0xcceeff, 0xaaddff, 0x88ccff, 0xccddff, 0xbbeeee, 0xddeeff];
    for (let s = 0; s < 11; s++) {
      const sy  = 2.9 + s * 0.70;
      const col = crystalColors[s % crystalColors.length];
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.17, 0.50, 12),
        Anime.glow(col, 3.8)
      );
      seg.position.set(0, sy, 0);
      this.scene.add(seg);
      this._timeRotorMeshes.push({ mesh: seg, baseY: sy, phase: s * 0.33 });
      this.fx.registerItem(seg);
      this._crystalMeshes.push(seg);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.024, 6, 20),
        new THREE.MeshStandardMaterial({ color: 0xcc8833, roughness: 0.28, metalness: 0.88,
          emissive: new THREE.Color(0x443300), emissiveIntensity: 0.55 })
      );
      ring.position.set(0, sy + 0.26, 0);
      this.scene.add(ring);
      this._timeRotorMeshes.push({ mesh: ring, baseY: sy + 0.26, phase: s * 0.33 + 0.18, isRing: true });
    }

    // top cap (interactive — changes colour)
    const rotorTop = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), Anime.glow(0xeef8ff, 5.0));
    rotorTop.position.set(0, 9.66, 0);
    this.scene.add(rotorTop);
    this.fx.registerItem(rotorTop);
    this._rotorTopMesh = rotorTop;

    rotorTop.userData.onInteract = () => {
      this._crystalColor = (this._crystalColor + 1) % 4;
      const cols = [
        { crystal: 0xcceeff, cap: 0xeef8ff, light: 0xaaddff, label: 'Blue (Standard)' },
        { crystal: 0xffcc88, cap: 0xfff8ee, light: 0xffddaa, label: 'Amber (Emergency)' },
        { crystal: 0xaaffcc, cap: 0xeeffee, light: 0x88ffcc, label: 'Green (Temporal Drift)' },
        { crystal: 0xffaaff, cap: 0xffeeff, light: 0xddaaff, label: 'Violet (Vortex Mode)' },
      ];
      const c = cols[this._crystalColor];
      this._crystalMeshes.forEach(m => { m.material.color.set(c.crystal); m.material.emissive.set(c.crystal); });
      rotorTop.material.color.set(c.cap); rotorTop.material.emissive.set(c.cap);
      this._rotorFill.color.set(c.light); this._rotorFill2.color.set(c.light);
      this._rotorLight.color.set(c.light); this._rotorLight2.color.set(c.light);
      this.engine.audio.play('pickup');
      this._popup.show(`
        <div style="font-size:11px;letter-spacing:3px;color:rgba(150,220,255,0.5);font-family:monospace;margin-bottom:6px">TIME ROTOR</div>
        <div style="font-size:16px;font-weight:700;color:rgba(220,240,255,0.95);font-family:serif;margin-bottom:4px">
          Resonance Frequency Shifted
        </div>
        <div style="font-size:13px;color:rgba(180,220,255,0.65);line-height:1.6">
          Crystal matrix now tuned to <b style="color:rgba(220,240,255,0.9)">${c.label}</b>.<br>
          All temporal calculations recalibrated.
        </div>
      `);
    };
    this.interactables.push(rotorTop);

    this._rotorLight  = Build.pointLight(this.scene, 0, 6,    0, 0xaaddff, 5.0, 11);
    this._rotorLight2 = Build.pointLight(this.scene, 0, 9.60, 0, 0xddeeff, 2.5,  6);

    // ═══════════════════════════════════════════
    //  SCANNER SCREEN — with rotating messages
    // ═══════════════════════════════════════════
    this._screenMessages = [
      { title: 'TEMPORAL VORTEX STABLE',   body: 'Coordinates locked to N-Space.\nGravitational constant nominal.', color: 0x004488 },
      { title: 'ARTRON ENERGY: 94.7%',      body: 'Eye of Harmony supplying\nfull power to all systems.', color: 0x003322 },
      { title: 'CHAMELEON CIRCUIT FAILED',  body: 'Exterior shell locked to\nPolice Box configuration.', color: 0x440000 },
      { title: 'TIME ROTOR ACTIVE',         body: 'Dematerialised. In transit.\nDestination: Unknown.', color: 0x002244 },
      { title: 'SPACE-TIME COORDINATES',    body: 'Sector: ∞ — Galactic: 0,0,0\nPersonal timeline: Complicated.', color: 0x110033 },
    ];
    this._currentMsgIdx = 0;

    Build.box(this.scene, 0, 4.5, -10.6, 6.2, 4.0, 0.5, 0x4a2c10);
    Build.box(this.scene, 0, 4.5, -10.38, 5.4, 3.3, 0.16, 0x140a02);

    // screen canvas rendered dynamically
    this._screenCanvas = document.createElement('canvas');
    this._screenCanvas.width = 512; this._screenCanvas.height = 320;
    this._screenTex = new THREE.CanvasTexture(this._screenCanvas);
    const screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.0, 3.15),
      new THREE.MeshBasicMaterial({ map: this._screenTex })
    );
    screenMesh.position.set(0, 4.5, -10.29);
    this.scene.add(screenMesh);
    this._screenMesh = screenMesh;
    this._drawScreen(0);

    // screen is interactive — cycles messages
    screenMesh.userData.onInteract = () => {
      this._currentMsgIdx = (this._currentMsgIdx + 1) % this._screenMessages.length;
      this._drawScreen(0);
      this.engine.audio.play('step');
      const msg = this._screenMessages[this._currentMsgIdx];
      this._popup.show(`
        <div style="font-size:11px;letter-spacing:3px;color:rgba(100,180,255,0.5);font-family:monospace;margin-bottom:6px">VORTEX NAVIGATION SYSTEM</div>
        <div style="font-size:16px;font-weight:700;color:rgba(180,220,255,0.95);font-family:monospace;margin-bottom:4px">
          ${msg.title}
        </div>
        <div style="font-size:13px;color:rgba(140,200,255,0.65);line-height:1.7;white-space:pre-line">
          ${msg.body}
        </div>
      `);
    };
    this.interactables.push(screenMesh);

    Build.box(this.scene, 0, 2.9, -10.6, 6.2, 0.42, 0.5, 0x5a3618);
    // ── Override engine label styles — remove purple tint
    {
      const s = document.createElement('style');
      s.textContent = `
        .label, .three-label, [class*="label"],[class*="Label"] {
          background: rgba(12,6,1,0.82) !important;
          border: 1px solid rgba(190,140,50,0.45) !important;
          color: rgba(255,210,120,0.92) !important;
          border-radius: 6px !important;
          padding: 3px 9px !important;
          text-shadow: none !important;
          box-shadow: 0 2px 12px rgba(0,0,0,0.5) !important;
        }
      `;
      document.head.appendChild(s);
    }

    Build.label(this.scene, 'VORTEX NAVIGATION SYSTEM', 0, 2.9, -10.34, '#ffcc88');
    Build.pointLight(this.scene, 0, 4.5, -10.1, 0x1133aa, 1.8, 7);

    // ═══════════════════════════════════════════
    //  POLICE BOX DOOR (interactive — flavour)
    // ═══════════════════════════════════════════
    Build.box(this.scene, 8.6, 0, 0, 0.42, 7.4, 4.4, 0x163216);
    Build.box(this.scene, 8.6, 3.7, -1.0, 0.14, 6.4, 1.9, 0x1a3a1a);
    Build.box(this.scene, 8.6, 3.7,  1.0, 0.14, 6.4, 1.9, 0x1a3a1a);
    [[-0.9,1.8],[0.9,1.8],[-0.9,4.5],[0.9,4.5]].forEach(([z2,y2]) => {
      Build.box(this.scene, 8.52, y2, z2, 0.06, 2.5, 1.55, 0x12281a, { noOutline: true });
    });
    Build.label(this.scene, '✦ POLICE PUBLIC CALL BOX ✦', 8.52, 6.9, 0, '#ffcc88');
    Build.pointLight(this.scene, 8.1, 6.6, 0, 0xaaffcc, 1.4, 5);
    Build.box(this.scene, 8.6, 7.6, 0, 0.30, 0.30, 0.30, 0xffffcc, { noOutline: true });
    Build.pointLight(this.scene, 8.6, 7.6, 0, 0xffffaa, 2.2, 5.5);

    // door knob (interactive)
    const doorKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      Anime.mat(0xcc9933, { roughness: 0.3, metalness: 0.85 })
    );
    doorKnob.position.set(8.52, 3.5, 0.3);
    this.scene.add(doorKnob);
    doorKnob.userData.onInteract = () => {
      this.engine.audio.play('deny');
      this._popup.show(`
        <div style="font-size:11px;letter-spacing:3px;color:rgba(170,255,170,0.5);font-family:monospace;margin-bottom:6px">POLICE BOX DOOR</div>
        <div style="font-size:16px;font-weight:700;color:rgba(200,255,200,0.95);font-family:serif;margin-bottom:4px">
          The door won't budge.
        </div>
        <div style="font-size:13px;color:rgba(160,220,160,0.65);line-height:1.6">
          "You can't go back outside," the TARDIS seems to say.<br>
          "Not yet. There's still something to remember here."
        </div>
      `);
    };
    doorKnob.userData.hintLabel = '🚪 Police Box Door';
    this.interactables.push(doorKnob);

    // ═══════════════════════════════════════════
    //  HAT STAND — classic TARDIS prop
    // ═══════════════════════════════════════════
    const hatStandX = -6.5, hatStandZ = 3.5;
    // pole
    const { mesh: hatPole } = Build.box(this.scene, hatStandX, 1, hatStandZ, 0.07, 2.0, 0.07, 0x5a3818, { noOutline: true });
    // base
    Build.box(this.scene, hatStandX, 0,   hatStandZ, 0.55, 0.06, 0.55, 0x4a2c10);
    Build.box(this.scene, hatStandX, 0.06,hatStandZ, 0.35, 0.04, 0.35, 0x5a3818);
    // arms
    for (let arm = 0; arm < 4; arm++) {
      const aa  = (arm/4)*Math.PI*2;
      const { mesh: armMesh } = Build.box(
        this.scene,
        hatStandX + Math.cos(aa)*0.28, 1.9, hatStandZ + Math.sin(aa)*0.28,
        0.06, 0.06, 0.6, 0x6a4420, { noOutline: true }
      );
      armMesh.rotation.y = -aa;
    }
    // THE HAT — a tall top hat
    const hatBrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.30, 0.04, 18),
      Anime.mat(0x1a1008, { roughness: 0.85, metalness: 0.12 })
    );
    hatBrim.position.set(hatStandX + 0.18, 2.05, hatStandZ + 0.18);
    hatBrim.rotation.z = 0.22;
    this.scene.add(hatBrim);
    const hatCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.20, 0.45, 16),
      Anime.mat(0x1a1008, { roughness: 0.85, metalness: 0.12 })
    );
    hatCrown.position.set(hatStandX + 0.18, 2.3, hatStandZ + 0.18);
    hatCrown.rotation.z = 0.22;
    this.scene.add(hatCrown);
    this._hatMesh  = hatCrown;
    this._hatBrim  = hatBrim;

    hatCrown.userData.onInteract = () => {
      this._hatSpinning = true;
      this._hatSpinTimer = 2.0;
      this.engine.audio.play('whoosh');
      this._popup.show(`
        <div style="font-size:11px;letter-spacing:3px;color:rgba(255,210,100,0.5);font-family:monospace;margin-bottom:6px">HAT STAND</div>
        <div style="font-size:16px;font-weight:700;color:rgba(255,225,160,0.95);font-family:serif;margin-bottom:4px">
          The Doctor's Favourite Hat
        </div>
        <div style="font-size:13px;color:rgba(255,200,120,0.65);line-height:1.6">
          It spins beautifully. Some say the hat knows more about time travel than any TARDIS manual ever written.
        </div>
      `);
    };
    hatCrown.userData.hintLabel = '🎩 The Doctor\'s Hat';
    hatBrim.userData.hintLabel  = '🎩 The Doctor\'s Hat';
    this.interactables.push(hatCrown);
    this.interactables.push(hatBrim);
    hatBrim.userData.onInteract = hatCrown.userData.onInteract;

    // ═══════════════════════════════════════════
    //  BOOKSHELF — interactive lore books
    // ═══════════════════════════════════════════
    const bookEntries = [
      { title: 'The Hitchhiker\'s Guide to the Galaxy',    lore: 'A surprisingly inaccurate guide. The entry for Earth was recently updated from "Harmless" to "Mostly Harmless".' },
      { title: 'Temporal Mechanics Vol. IV',               lore: 'Chapter 12 is missing. The Doctor claims it "hasn\'t been written yet" and refuses to elaborate.' },
      { title: 'A Brief History of Time',                  lore: 'Professor Hawking signed this copy. Or will sign it. The TARDIS is parked outside his office in 1994.' },
      { title: 'TARDIS Technical Manual',                  lore: 'Pages 42–119 are redacted by the Time Lords. Page 120 just says "Don\'t."' },
      { title: 'Gallifreyan Mythology',                    lore: 'The story of Rassilon and Omega. Their names are not spoken lightly in this room.' },
      { title: 'Companion Care: A Practical Guide',        lore: 'Chapter 1: "Try not to lose them." Chapter 2: "If lost, they usually find their way back."' },
    ];
    const shelfColors = [0x8b4513, 0x4a2c10, 0x5a3818, 0x3e2410, 0x6a4022, 0x7a4820];
    const bookCols    = [0x8b0000, 0x003366, 0x004400, 0x6b4c11, 0x440044, 0x2244aa];

    // shelf unit at -6.5, 0, -4
    const shX = -7.5, shZ = -5.5;
    Build.box(this.scene, shX, 3.2, shZ, 2.2, 6.4, 0.45, 0x3a2010, { noOutline: true });
    for (let shelf = 0; shelf < 5; shelf++) {
      Build.box(this.scene, shX, 0.6 + shelf * 1.1, shZ, 2.2, 0.07, 0.48, 0x4a2c12, { noOutline: true });
    }

    for (let b = 0; b < bookEntries.length; b++) {
      const bx   = shX - 0.85 + (b % 3) * 0.58;
      const by   = 0.9 + Math.floor(b / 3) * 1.1;
      const bz   = shZ - 0.04;
      const bh   = 0.75 + Math.random() * 0.25;
      const bookMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, bh, 0.38),
        Anime.mat(bookCols[b], { roughness: 0.88, metalness: 0.05 })
      );
      bookMesh.position.set(bx, by, bz);
      bookMesh.rotation.y = (Math.random()-0.5)*0.08;
      this.scene.add(bookMesh);
      this._bookshelfMeshes.push(bookMesh);
      Anime.outline(bookMesh, 0.04);

      const entry = bookEntries[b];
      bookMesh.userData.onInteract = () => {
        this.engine.audio.play('pickup');
        this._popup.show(`
          <div style="font-size:11px;letter-spacing:3px;color:rgba(255,200,100,0.5);font-family:monospace;margin-bottom:6px">TARDIS LIBRARY</div>
          <div style="font-size:16px;font-weight:700;color:rgba(255,225,160,0.95);font-family:serif;margin-bottom:4px">
            "${entry.title}"
          </div>
          <div style="font-size:13px;color:rgba(255,200,120,0.65);line-height:1.6">
            ${entry.lore}
          </div>
        `, 7000);
      };
      this.interactables.push(bookMesh);
    }

    Build.pointLight(this.scene, shX, 5, shZ, 0xffcc66, 0.7, 4);

    // ═══════════════════════════════════════════
    //  TELESCOPE — interactive (another side of room)
    // ═══════════════════════════════════════════
    const telX = 6.5, telZ = 4.0;
    // tripod
    for (let tl = 0; tl < 3; tl++) {
      const ta  = (tl/3)*Math.PI*2;
      const { mesh: leg } = Build.box(
        this.scene,
        telX + Math.cos(ta)*0.25, 0.55, telZ + Math.sin(ta)*0.25,
        0.06, 1.1, 0.06, 0x5a3818, { noOutline: true }
      );
      leg.rotation.z = Math.atan2(Math.cos(ta)*0.25, 0.55) * 0.8;
    }
    // scope body
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.08, 1.0, 12),
      Anime.metal(0x5a4030, { roughness: 0.45, metalness: 0.65 })
    );
    scope.position.set(telX, 1.6, telZ);
    scope.rotation.x = Math.PI/2;
    scope.rotation.z = -0.3;
    this.scene.add(scope);
    this._telescopeMesh = scope;

    const eyepiece = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.10, 0.22, 10),
      Anime.metal(0x3a2810, { roughness: 0.5, metalness: 0.7 })
    );
    eyepiece.position.set(telX - 0.28, 1.85, telZ + 0.35);
    eyepiece.rotation.copy(scope.rotation);
    this.scene.add(eyepiece);

    scope.userData.onInteract = () => {
      this._telescopeAngle += 0.3;
      this.engine.audio.play('step');
      const sights = [
        'A supernova 3 billion years ago.\nThe debris is still falling.',
        'The Eye of Orion. Highest\nstatic electricity in the universe.',
        'A generation ship, mid-journey.\nThey\'ve forgotten what Earth was.',
        'A dying star nursing a\nnew planetary system.',
        'The edge of the universe.\nIt\'s closer than you\'d think.',
      ];
      this._popup.show(`
        <div style="font-size:11px;letter-spacing:3px;color:rgba(180,200,255,0.5);font-family:monospace;margin-bottom:6px">STELLAR TELESCOPE</div>
        <div style="font-size:16px;font-weight:700;color:rgba(200,220,255,0.95);font-family:serif;margin-bottom:4px">
          You peer through the eyepiece…
        </div>
        <div style="font-size:13px;color:rgba(160,200,255,0.65);line-height:1.65;white-space:pre-line">
          ${sights[Math.floor(Math.random()*sights.length)]}
        </div>
      `, 6500);
    };
    this.interactables.push(scope);
    this.interactables.push(eyepiece);
    eyepiece.userData.onInteract = scope.userData.onInteract;

    Build.pointLight(this.scene, telX, 2.5, telZ, 0xffd080, 0.55, 3.5);

    // ═══════════════════════════════════════════
    //  ORRERY / CELESTIAL GLOBE — centre-left desk
    // ═══════════════════════════════════════════
    const globeX = -5.5, globeZ = 0;
    Build.box(this.scene, globeX, 0.7, globeZ, 1.2, 0.10, 0.8, 0x4a2c10);
    Build.box(this.scene, globeX, 0,   globeZ, 1.0, 1.4,  0.6, 0x3a2010);

    const globeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 22, 22),
      new THREE.MeshStandardMaterial({
        color: 0x1133aa, roughness: 0.35, metalness: 0.22,
        emissive: new THREE.Color(0x001166), emissiveIntensity: 0.55,
      })
    );
    globeSphere.position.set(globeX, 1.45, globeZ);
    this.scene.add(globeSphere);
    this._globeMesh = globeSphere;

    // globe rings
    for (let rg = 0; rg < 3; rg++) {
      const globeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.40 + rg*0.06, 0.012, 6, 32),
        new THREE.MeshStandardMaterial({ color: 0xcc9933, roughness: 0.4, metalness: 0.8 })
      );
      globeRing.position.copy(globeSphere.position);
      globeRing.rotation.x = (rg/3)*Math.PI;
      globeRing.rotation.z = (rg/3)*Math.PI*0.5;
      this.scene.add(globeRing);
    }

    Anime.outline(globeSphere, 0.06, 0x001133);
    Build.pointLight(this.scene, globeX, 1.8, globeZ, 0x4488ff, 1.0, 3.5);

    globeSphere.userData.onInteract = () => {
      this.engine.audio.play('pickup');
      const readings = [
        ['Gallifrey', 'Constellation Kasterborous.\nGalactic coordinates: 10-0-11-00:02:07:09:01:3:6:12:0:9:07:6:5:02:5:09:0:1. Currently: inaccessible.'],
        ['Earth',     'Sector 8,001, Mutter\'s Spiral.\nA remarkable planet of exceptional insignificance with a habit of producing extraordinary people.'],
        ['Skaro',     'Home of the Daleks.\nThe TARDIS refuses to set coordinates. Some trauma runs deep.'],
        ['Trenzalore', 'Site of the Doctor\'s greatest stand.\nA place the TARDIS prefers not to dwell upon.'],
        ['Mondas',    'Original home of the Cybermen.\nNow adrift. The cold has followed them everywhere.'],
      ];
      const [loc, desc] = readings[Math.floor(Math.random()*readings.length)];
      this._popup.show(`
        <div style="font-size:11px;letter-spacing:3px;color:rgba(100,180,255,0.5);font-family:monospace;margin-bottom:6px">CELESTIAL ORRERY</div>
        <div style="font-size:16px;font-weight:700;color:rgba(180,220,255,0.95);font-family:serif;margin-bottom:4px">
          ${loc}
        </div>
        <div style="font-size:13px;color:rgba(140,200,255,0.65);line-height:1.65;white-space:pre-line">
          ${desc}
        </div>
      `, 7000);
    };
    this.interactables.push(globeSphere);

    // ═══════════════════════════════════════════
    //  CAPTAIN'S LOG — slim lectern, nothing covering the book
    //  Spawn at (6,0,0) facing -X → log placed at (4.4, 0, 0): straight ahead
    // ═══════════════════════════════════════════
    const logX = 4.4, logZ = 0.0;

    // Slim pedestal — just wide enough to stand, nothing to hide the book
    Build.box(this.scene, logX, 0.44, logZ, 0.40, 0.88, 0.40, 0x3a2010, { noOutline: true });
    // small flat top surface
    Build.box(this.scene, logX, 0.90, logZ, 0.70, 0.04, 0.55, 0x5a3818, { noOutline: true });

    // Angled reading face — book rests here, tilted toward player
    const lecternFace = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.04, 0.50),
      new THREE.MeshStandardMaterial({ color: 0x4e3012, roughness: 0.85, metalness: 0.15 })
    );
    lecternFace.position.set(logX, 0.95, logZ + 0.02);
    lecternFace.rotation.x = 0.30;
    this.scene.add(lecternFace);

    // THE LOGBOOK — deep red, sits on the tilted face, fully exposed
    const logbook = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.052, 0.42),
      Anime.mat(0xaa0022, { roughness: 0.72, metalness: 0.06 })
    );
    logbook.position.set(logX, 1.005, logZ + 0.01);
    logbook.rotation.x = 0.30;
    this.scene.add(logbook);
    Anime.outline(logbook, 0.04, 0x550011);

    // Three gilded lines across the cover
    for (let ln = 0; ln < 3; ln++) {
      const coverLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.005, 0.005),
        new THREE.MeshBasicMaterial({ color: 0xddaa44 })
      );
      coverLine.position.set(logX, 1.013, logZ + 0.01 + (ln - 1) * 0.11);
      coverLine.rotation.x = 0.30;
      this.scene.add(coverLine);
    }

    // Gilded spine on the left edge
    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.062, 0.42),
      Anime.mat(0xcc9933, { roughness: 0.28, metalness: 0.85 })
    );
    spine.position.set(logX - 0.28, 1.005, logZ + 0.01);
    spine.rotation.x = 0.30;
    this.scene.add(spine);

    // Clasp on right edge
    const clasp = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.035, 0.038),
      Anime.metal(0xcc9933, { roughness: 0.28, metalness: 0.9 })
    );
    clasp.position.set(logX + 0.28, 1.005, logZ + 0.01);
    clasp.rotation.x = 0.30;
    this.scene.add(clasp);

    // Dedicated spotlight — angled to hit the book face-on, nothing in the way
    Build.pointLight(this.scene, logX - 0.5, 2.2, logZ - 1.0, 0xffaa44, 2.5, 6.0);
    Build.pointLight(this.scene, logX,        1.1, logZ - 0.5, 0xff7722, 1.1, 2.8);

    const logGlow = new THREE.PointLight(0xff4400, 0.6, 2.4, 2);
    logGlow.position.set(logX, 1.0, logZ);
    this.scene.add(logGlow);
    this._logGlow = logGlow;

    this.fx.registerItem(logbook);

    const openLog = () => { this.engine.audio.play('pickup'); this._notebook.openNotebook(); };
    logbook.userData.onInteract     = openLog;
    logbook.userData.hintLabel      = "📕 Captain's Log";
    spine.userData.onInteract       = openLog;
    spine.userData.hintLabel        = "📕 Captain's Log";
    clasp.userData.onInteract       = openLog;
    clasp.userData.hintLabel        = "📕 Captain's Log";
    lecternFace.userData.onInteract = openLog;
    lecternFace.userData.hintLabel  = "📕 Captain's Log";
    this.interactables.push(logbook, spine, clasp, lecternFace);

    // ═══════════════════════════════════════════
    //  NOTEBOOK — separate open spiral notebook on the side desk
    //  Placed near the telescope desk at (6.5, 0.76, -3.6)
    // ═══════════════════════════════════════════
    const nbX = 6.5, nbZ = -3.6;

    // Open two-page spread
    const nbMatL = Anime.mat(0xf2ead8, { roughness: 0.94, metalness: 0.0 });
    const nbMatR = Anime.mat(0xeee6d0, { roughness: 0.94, metalness: 0.0 });

    const nbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.28), nbMatL);
    nbLeft.position.set(nbX - 0.18, 0.775, nbZ);
    nbLeft.rotation.y = 0.08;
    this.scene.add(nbLeft);

    const nbRight = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.28), nbMatR);
    nbRight.position.set(nbX + 0.18, 0.775, nbZ);
    nbRight.rotation.y = 0.08;
    this.scene.add(nbRight);
    Anime.outline(nbRight, 0.025, 0xbbaa88);

    // Spiral wire down the center
    for (let sp = 0; sp < 9; sp++) {
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.019, 0.007, 5, 9),
        new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.35, metalness: 0.75 })
      );
      coil.position.set(nbX + 0.01, 0.792, nbZ - 0.105 + sp * 0.026);
      coil.rotation.y = 0.08;
      this.scene.add(coil);
    }

    // Ruled lines on the right page
    for (let rl = 0; rl < 6; rl++) {
      const ruled = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.003, 0.003),
        new THREE.MeshBasicMaterial({ color: 0x99aacc, transparent: true, opacity: 0.45 })
      );
      ruled.position.set(nbX + 0.18, 0.788 + 0.001, nbZ - 0.08 + rl * 0.038);
      this.scene.add(ruled);
    }

    // Pencil resting diagonally across it
    const pencilMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.30, 6), pencilMat);
    pencil.position.set(nbX + 0.26, 0.792, nbZ + 0.06);
    pencil.rotation.z = Math.PI / 2;
    pencil.rotation.y = -0.35;
    this.scene.add(pencil);
    const pencilTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0, 0.007, 0.022, 6),
      new THREE.MeshBasicMaterial({ color: 0xcc8833 })
    );
    pencilTip.position.set(nbX + 0.405, 0.792, nbZ + 0.06);
    pencilTip.rotation.z = Math.PI / 2;
    pencilTip.rotation.y = -0.35;
    this.scene.add(pencilTip);

    Build.pointLight(this.scene, nbX - 0.2, 1.5, nbZ - 0.4, 0xffd080, 0.8, 3.5);
    this.fx.registerItem(nbRight);

    const openNb = () => { this.engine.audio.play('pickup'); this._notebook.openNotebook(); };
    nbLeft.userData.onInteract  = openNb;  nbLeft.userData.hintLabel  = '📓 Notebook';
    nbRight.userData.onInteract = openNb;  nbRight.userData.hintLabel = '📓 Notebook';
    this.interactables.push(nbLeft, nbRight);

    // ═══════════════════════════════════════════
    //  MEMORY CRYSTAL — Gallifreyan artefact
    // ═══════════════════════════════════════════
    const memX = -2.5, memZ = -7.5;
    Build.box(this.scene, memX, 0.75, memZ, 1.6, 0.10, 0.7, 0x4a2c10);
    Build.box(this.scene, memX, 0,    memZ, 1.4, 1.5,  0.6, 0x3a2010);

    const crystalGeo  = new THREE.OctahedronGeometry(0.22, 0);
    const memCrystal  = new THREE.Mesh(
      crystalGeo,
      Anime.glow(0x88ccff, 5.0)
    );
    memCrystal.position.set(memX, 1.3, memZ);
    memCrystal.rotation.z = 0.2;
    this.scene.add(memCrystal);
    Anime.outline(memCrystal, 0.08, 0x002244);
    Build.pointLight(this.scene, memX, 1.5, memZ, 0x88aaff, 1.5, 4);
    // hint pill handles label
    this.fx.registerItem(memCrystal);
    this._memoryCrystal = memCrystal;

    const memories = [
      ['The First Journey', 'An old man and a girl, a junkyard on Totter\'s Lane, 1963. He was running away from something. He\'s been running ever since.'],
      ['The Brigadier', '"Wonderful chap. All of them." The TARDIS keeps a light on for everyone who\'s waited on the hillside.'],
      ['Donna Noble',   'She saved all of reality and doesn\'t remember it. The universe is full of debts it can never repay.'],
      ['The War',       'Some things are locked away, even from the TARDIS. The crystal grows warm. Best not to linger here.'],
      ['Rose Tyler',    'Bad Wolf. The Vortex. A girl who looked into the heart of the TARDIS, and it looked back, and loved her.'],
    ];

    memCrystal.userData.onInteract = () => {
      this.engine.audio.play('cash');
      const [title, text] = memories[Math.floor(Math.random()*memories.length)];
      this._popup.show(`
        <div style="font-size:11px;letter-spacing:3px;color:rgba(150,200,255,0.5);font-family:monospace;margin-bottom:6px">MEMORY CRYSTAL</div>
        <div style="font-size:16px;font-weight:700;color:rgba(200,230,255,0.95);font-family:serif;margin-bottom:4px">
          ${title}
        </div>
        <div style="font-size:13px;color:rgba(160,210,255,0.7);line-height:1.7">
          ${text}
        </div>
      `, 8000);
    };
    memCrystal.userData.hintLabel = '💎 Memory Crystal';
    this.interactables.push(memCrystal);

    // ═══════════════════════════════════════════
    //  SIDE DESKS (misc props)
    // ═══════════════════════════════════════════
    [
      [6.5, 0, -4, 0.4],
      [0,   0,  6.8, 0],
    ].forEach(([dx, , dz]) => {
      Build.box(this.scene, dx, 0.75, dz, 2.6, 0.10, 0.88, 0x4a2c10);
      Build.box(this.scene, dx, 0,    dz, 2.4, 1.5,  0.78, 0x3a2010);
      Build.pointLight(this.scene, dx, 1.0, dz, 0xff9944, 0.35, 2.5);
    });

    // ═══════════════════════════════════════════
    //  RESTART PLINTH — centre-forward
    // ═══════════════════════════════════════════
    Build.box(this.scene, 0, 0,    3.8, 1.4, 0.10, 0.9, 0x5a3818);
    Build.box(this.scene, 0, 0.10, 3.8, 1.2, 0.08, 0.75, 0x6a4422);
    this._holoLight = Build.pointLight(this.scene, 0, 1.8, 3.8, 0xaaddff, 2.2, 5);

    Build.label(this.scene, '— ADVENTURES COMPLETE —',            0, 3.3, 3.7, '#ffdd88');
    Build.label(this.scene, 'The TARDIS drifts between stories.', 0, 2.55, 3.7, '#ffcc66');
    Build.label(this.scene, 'Every ending is a new beginning.',   0, 2.05, 3.7, '#ffbb44');

    const restartBtn = new THREE.Mesh(
      new THREE.SphereGeometry(0.30, 18, 18),
      Anime.glow(0xffcc44, 4.5)
    );
    restartBtn.position.set(0, 1.65, 3.8);
    this.scene.add(restartBtn);
    Anime.outline(restartBtn, 0.07, 0xaa7700);
    this.fx.registerItem(restartBtn);
    this._restartBtn = restartBtn;
    this._restartBtnLight = Build.pointLight(this.scene, 0, 1.65, 3.8, 0xffcc44, 2.2, 3.8);
    // hint pill handles "Begin Again" label

    restartBtn.userData.onInteract = () => this._triggerRestart();
    restartBtn.userData.hintLabel  = '✦ Begin Again';
    this.interactables.push(restartBtn);

    // ═══════════════════════════════════════════
    //  PARTICLES
    // ═══════════════════════════════════════════
    this.fx.registerParticles(Build.particles(this.scene, 70, 11, 0xffcc88, 0.038));
    this.fx.registerParticles(Build.particles(this.scene, 35,  7, 0xaaddff, 0.044));
    this.fx.registerParticles(Build.particles(this.scene, 20,  4, 0xffffff, 0.025));

    // ═══════════════════════════════════════════
    //  FP CONTROLLER
    // ═══════════════════════════════════════════
    this.fpCtrl = new FPController(this.camera, this.engine.input);
    this.fpCtrl.teleport(6, 0, 0, Math.PI * 1.5);

    // ── Arrival flash
    this._arrivalOverlay = document.createElement('div');
    this._arrivalOverlay.style.cssText = `
      position:fixed;inset:0;background:rgba(255,200,80,0.95);
      pointer-events:none;z-index:9998;transition:background 2.2s ease;
    `;
    document.body.appendChild(this._arrivalOverlay);
    setTimeout(() => { this._arrivalOverlay.style.background = 'rgba(0,0,0,0)'; }, 80);
  }

  // ─────────────────────────────────────────────
  _drawScreen(scanlinePhase) {
    const cv  = this._screenCanvas;
    const ctx = cv.getContext('2d');
    const msg = this._screenMessages[this._currentMsgIdx];

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cv.width, cv.height);

    // background tint
    ctx.fillStyle = `rgba(${(msg.color >> 16) & 0xff}, ${(msg.color >> 8) & 0xff}, ${msg.color & 0xff}, 0.9)`;
    ctx.fillRect(0, 0, cv.width, cv.height);

    // scan lines
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    for (let sy = 0; sy < cv.height; sy += 3) {
      ctx.beginPath();
      ctx.moveTo(0, sy + (scanlinePhase % 3));
      ctx.lineTo(cv.width, sy + (scanlinePhase % 3));
      ctx.stroke();
    }

    // border
    ctx.strokeStyle = 'rgba(100,180,255,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, cv.width-16, cv.height-16);

    // corner ticks
    ctx.strokeStyle = 'rgba(100,180,255,0.6)';
    ctx.lineWidth = 2;
    [[12,12],[cv.width-12,12],[12,cv.height-12],[cv.width-12,cv.height-12]].forEach(([x,y]) => {
      const s = 18;
      ctx.beginPath(); ctx.moveTo(x,y+s); ctx.lineTo(x,y); ctx.lineTo(x+s,y); ctx.stroke();
    });

    // stars
    for (let s = 0; s < 60; s++) {
      const sx  = Math.random()*cv.width;
      const sy  = Math.random()*cv.height;
      const r   = Math.random() * 1.2 + 0.2;
      ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.6 + 0.1})`;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
    }

    // title
    ctx.fillStyle = 'rgba(160,220,255,0.9)';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(msg.title, cv.width/2, 70);

    // divider
    ctx.strokeStyle = 'rgba(100,180,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 88); ctx.lineTo(cv.width-60, 88); ctx.stroke();

    // body text
    ctx.fillStyle = 'rgba(120,200,255,0.75)';
    ctx.font = '15px monospace';
    msg.body.split('\n').forEach((line, li) => {
      ctx.fillText(line, cv.width/2, 122 + li * 28);
    });

    // footer
    ctx.fillStyle = 'rgba(80,160,255,0.4)';
    ctx.font = '11px monospace';
    ctx.fillText('[E] CYCLE DISPLAY', cv.width/2, cv.height - 24);

    this._screenTex.needsUpdate = true;
  }

  // ─────────────────────────────────────────────
  onEnter() {
    this.engine.audio.playLevelMusic('tardis'); // cleanest — stops old, starts new
    this.engine.renderer.setActiveScene(this.scene, this.camera, 'driving');
    this.engine.renderer.gl.toneMappingExposure = 0.80;

    // FIX 2: single unified HUD — no stacked overlays
    this.engine.hud.setInfo(`
      <b style="color:#ffcc66;font-size:15px">⌛ Inside the TARDIS</b><br>
      <span style="opacity:0.7;font-size:12px">Dimensions: Transcendentally Infinite</span><br>
      <div style="margin-top:8px;font-size:11px;opacity:0.5;line-height:1.8">
        <b style="color:#ffcc88">E</b> — interact &nbsp;·&nbsp; Look around to explore<br>
        📕 Find the <b style="color:#ffcc88">Captain's Log</b> desk to the right<br>
        💎 Touch the <b style="color:#aaddff">memory crystal</b> · 🔭 Use the telescope
      </div>
    `);
  }

  _buildOverlayHTML() {
    return `
      <div style="font-size:11px;letter-spacing:5px;opacity:0.55;color:#ffcc66;
        font-family:monospace;margin-bottom:12px;text-align:center">
        T · A · R · D · I · S
      </div>
      <div style="font-size:9px;opacity:0.35;color:#ffdd99;letter-spacing:4px;
        margin-bottom:22px;text-align:center;font-family:monospace">
        TIME AND RELATIVE DIMENSION IN SPACE
      </div>

      <div style="font-size:56px;margin-bottom:14px;
        filter:drop-shadow(0 0 30px rgba(150,220,255,0.6))">⌛</div>

      <div style="font-size:36px;font-weight:900;letter-spacing:5px;
        background:linear-gradient(135deg,#ffdd44,#ffaa22,#ff8800);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;
        font-family:Georgia,serif;margin-bottom:8px;text-align:center">
        ADVENTURES COMPLETE
      </div>

      <div style="
        width:220px;height:1px;margin:0 auto 22px;
        background:linear-gradient(90deg,transparent,rgba(255,200,80,0.5),transparent);
      "></div>

      <div style="font-size:14px;color:rgba(255,225,160,0.8);line-height:2.0;
        max-width:400px;margin:0 auto;text-align:center;font-family:Georgia,serif">
        You crossed the Veldt.<br>
        You survived the Fell Omen.<br>
        You cooked, packed, drove, and gazed at stars.<br>
        <span style="opacity:0.5;font-size:12px">The TARDIS remembers every journey.</span>
      </div>

      <div style="
        margin:24px auto 0;padding:12px 24px;
        border:1px solid rgba(255,200,80,0.2);border-radius:12px;
        max-width:360px;
        background:rgba(255,180,40,0.06);
      ">
        <div style="font-size:12px;color:rgba(255,200,80,0.6);letter-spacing:2px;
          font-family:monospace;margin-bottom:8px;text-align:center">EXPLORE INSIDE</div>
        <div style="font-size:12px;color:rgba(255,200,120,0.5);line-height:1.8;
          text-align:center;font-family:Georgia,serif">
          📕 Find the <b style="color:rgba(255,220,120,0.8)">Captain's Log</b> to write your own entries<br>
          🔭 Look through the <b style="color:rgba(255,220,120,0.8)">telescope</b><br>
          💎 Touch the <b style="color:rgba(180,220,255,0.8)">memory crystal</b><br>
          ✦ Interact with <b style="color:rgba(255,220,120,0.8)">anything that glows</b>
        </div>
      </div>

      <div style="font-size:10px;color:rgba(255,200,80,0.3);margin-top:18px;
        letter-spacing:3px;text-align:center;font-family:monospace">
        THE STORY CONTINUES…
      </div>
    `;
  }

  onExit() {
    this._popup.hide();
    if (this._arrivalOverlay) this._arrivalOverlay.remove();
    if (this._hintEl) this._hintEl.remove();
    this.engine.renderer.gl.toneMappingExposure = 0.9;
  }

  onInteract() {
    if (this._interactCooldown > 0) return;
    this._interactCooldown = 0.35;

    // ── Proximity-first: find nearest interactable within generous reach
    const camPos = this.camera.position;
    let closest = null;
    let closestDist = 4.5;

    for (const obj of this.interactables) {
      if (!obj.userData.onInteract) continue;
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      const d = camPos.distanceTo(wp);
      if (d < closestDist) { closestDist = d; closest = obj; }
    }

    if (closest) {
      closest.userData.onInteract(closest);
      return;
    }

    // ── Fallback: raycasting for far/precise objects
    try {
      const interactor = new Interactor(this.camera, this.scene);
      interactor.interact(this.interactables);
    } catch(e) {}
  }

  // ─────────────────────────────────────────────
  _triggerRestart() {
    if (this._restarting) return;
    this._restarting = true;
    this.engine.audio.play('whoosh');
    setTimeout(() => this.engine.audio.play('deny'), 220);

    // Flash out
    this._arrivalOverlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0);
      pointer-events:none;z-index:9998;transition:background 0.6s;
    `;
    setTimeout(() => { this._arrivalOverlay.style.background = 'rgba(255,255,255,1)'; }, 100);

    setTimeout(() => {
      // Reset state
      this._restarting = false;
      // Go back to start — show character select just like initial boot
      showCharacterSelect((chosen) => {
        this.engine.selectedCharacter = chosen;
        // Use main.js's goLevel if available, else fall back
        if (typeof window._goLevel === 'function') {
          window._goLevel('grocery');
        } else {
          this.engine.go('grocery');
        }
      });
    }, 900);
  }

  // ─────────────────────────────────────────────
  update(dt) {
    super.update(dt);
    if (this.fpCtrl) this.fpCtrl.update(dt, this.collidables);
    if (this._interactCooldown > 0) this._interactCooldown -= dt;

    // ── Proximity scan — find nearest interactable and show hint
    if (this._hintEl && this.camera) {
      const camPos = this.camera.position;
      let nearest = null, nearestDist = 4.0;
      const NAMES = new Map([
        // we tag key objects by position bucket
      ]);

      for (const obj of this.interactables) {
        if (!obj.userData.onInteract) continue;
        const wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        const d = camPos.distanceTo(wp);
        if (d < nearestDist) { nearestDist = d; nearest = obj; }
      }

      this._nearbyObj = nearest;
      if (nearest) {
        // derive a friendly name
        const ud = nearest.userData;
        let label = ud.hintLabel || (
          ud.isLever        ? `Console Panel ${(ud.panelIdx ?? 0) + 1}` :
          nearest === this._rotorTopMesh    ? 'Time Rotor' :
          nearest === this._screenMesh      ? 'Navigation Screen' :
          nearest === this._globeMesh       ? 'Celestial Orrery' :
          nearest === this._memoryCrystal   ? 'Memory Crystal' :
          nearest === this._telescopeMesh   ? 'Stellar Telescope' :
          nearest === this._restartBtn      ? 'Begin Again' :
          'Interact'
        );
        // logbook proximity
        if (nearest.geometry && nearest.geometry.parameters &&
            nearest.geometry.parameters.width > 0.9) label = "Captain's Log";

        const hintText = document.getElementById('tardis-hint-text');
        if (hintText) hintText.textContent = label;
        this._hintEl.style.opacity = '1';
        this._hintEl.style.transform = 'translateX(-50%) translateY(0px)';
      } else {
        this._hintEl.style.opacity = '0';
        this._hintEl.style.transform = 'translateX(-50%) translateY(6px)';
      }
    }

    const t = Date.now() * 0.001;
    const spinMult = this._restarting ? 5.0 : 1.0;

    // ── TIME ROTOR — bob & spin
    this._rotorY += dt * 0.6 * spinMult;
    this._timeRotorMeshes.forEach(({ mesh, baseY, phase, isRing }) => {
      mesh.position.y = baseY + Math.sin(t * 1.1 + phase) * 0.15;
      if (!isRing) mesh.rotation.y = this._rotorY + phase;
    });
    if (this._rotorTopMesh) {
      this._rotorTopMesh.position.y = 9.66 + Math.sin(t * 1.1) * 0.15;
      this._rotorTopMesh.rotation.y = this._rotorY * 0.55;
    }

    // rotor lights breathe
    const rp = 4.2 + Math.sin(t * 1.8) * 1.5 + (this._restarting ? 6 : 0);
    this._rotorLight.intensity  = rp * spinMult;
    this._rotorLight2.intensity = (1.9 + Math.sin(t*1.8+1)*0.9) * spinMult;
    this._rotorFill.intensity   = 2.6 + Math.sin(t * 1.4) * 0.8;
    this._rotorFill2.intensity  = 1.4 + Math.sin(t * 2.1 + 0.5) * 0.5;

    // ── Ceiling ring pulse
    if (this._ceilRing) {
      this._ceilRing.material.opacity = 0.50 + 0.18 * Math.sin(t * 1.2);
    }

    // ── Holographic and restart button
    if (this._holoLight)       this._holoLight.intensity      = 1.9 + Math.sin(t*2.2)*0.75;
    if (this._restartBtnLight) this._restartBtnLight.intensity = 1.8 + Math.sin(t*3.0)*1.0;
    if (this._restartBtn) {
      this._restartBtn.rotation.y = t * 0.7;
      this._restartBtn.position.y = 1.65 + Math.sin(t*1.5)*0.06;
    }

    // ── Wall strip lights subtle flicker
    this._flickerLights.forEach(({ light, phase, base }) => {
      light.intensity = base * (0.78 + 0.22*Math.sin(t*1.5+phase) + 0.06*Math.sin(t*8.5+phase));
    });

    // ── Console glow elements
    this._consoleGlow.forEach(item => {
      const { mesh, phase, base, isBtn, isStar, isRoundel, isPool } = item;
      if (isBtn)     { mesh.material.opacity = Math.random() > 0.97 ? 0.12 : base; }
      else if (isStar)    { mesh.material.opacity = base * (0.48 + 0.55*Math.sin(t*3.2+phase)); }
      else if (isRoundel) { mesh.material.emissiveIntensity = 0.18 + 0.16*Math.sin(t*1.3+phase); }
      else if (isPool)    { mesh.material.opacity = base * (0.6 + 0.42*Math.sin(t*1.8+phase)); }
      else                { mesh.material.opacity = base * (0.62 + 0.38*Math.sin(t*2.0+phase)); }
    });

    // ── Dial rotations on console panels
    this._dialRotations.forEach(({ mesh, speed, phase }) => {
      mesh.rotation.y = t * speed + phase;
    });

    // ── Globe slow rotation
    if (this._globeMesh) {
      this._globeAngle += dt * 0.12;
      this._globeMesh.rotation.y = this._globeAngle;
    }

    // ── Telescope slow sway
    if (this._telescopeMesh) {
      this._telescopeMesh.rotation.y = Math.sin(t * 0.2) * 0.08;
    }

    // ── Hat spin if triggered
    if (this._hatSpinning && this._hatMesh) {
      this._hatSpinTimer -= dt;
      const spinSpeed = this._hatSpinTimer > 0 ? 6 : 0;
      this._hatAngle += dt * spinSpeed;
      this._hatMesh.rotation.y = this._hatAngle;
      if (this._hatBrim) this._hatBrim.rotation.y = this._hatAngle;
      if (this._hatSpinTimer <= 0) this._hatSpinning = false;
    }

    // ── Memory crystal pulse and rotate
    if (this._memoryCrystal) {
      this._memoryCrystal.rotation.y += dt * 0.4;
      this._memoryCrystal.rotation.x  = Math.sin(t * 0.7) * 0.2;
    }

    // ── Logbook glow
    if (this._logGlow) {
      this._logGlow.intensity = 0.55 + 0.45*Math.sin(t*2.5);
    }

    // ── Screen refresh (scanline animation)
    this._msgTimer += dt;
    if (this._msgTimer > 0.08) {
      this._msgTimer = 0;
      this._drawScreen(Math.floor(t * 24) % 3);
    }
  }
}