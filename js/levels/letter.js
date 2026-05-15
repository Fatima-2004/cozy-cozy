// ============================================================
//  STARRY PICNIC — levels/letter.js
//  Avicula writes a letter to Purpura
//  On submit → letter is saved → Purpura's reply is revealed
// ============================================================

import { Level } from '../engine.js';

// Purpura's pre-written letter to Avicula
const PURPURA_LETTER = `My dearest Avicula,

Hey Jaani, I really hope you liked this game I made. It was alot of crashing out but I like how it came together at the end.
I know we always imagine that we are going to the park together but this is a little better. To actually see what it could be like.
My jaan, being with you is one of, if not the most, scariest things ive done. I feel alot about you and its something I've never gotten to experience so its very daunting.
There is only a month left till we see where we end up. Jaan...I do not want a life without you. I want the scenarios we imagine togehter to be true. 
To go to Japan together, to go to the park together, eat together, dance in the rain, WWE, and so much more jaan. It has not been an easy path for us. It has been full of trying to do the right thing and failing and trying again.
Our future is always in my prayers, sometimes its hard to think about how to tell you how I feel because its so complex its not as easy as saying I like you or I adore you. Jaan...you mean a lot to me, alot. The idea of not being with you brings me insurmountable unhappiness.
I want a forever with you... I adore you jaan. We have gone through 2 years together, heres to infinity more my birdie.

Yours forever,
Purpura 💜`;

// ─────────────────────────────────────────────────────────────
export class Letter extends Level {
// ─────────────────────────────────────────────────────────────

  constructor(engine) {
    super(engine);
    this._el         = null;
    this._phase      = 'write'; // 'write' | 'read' | 'archive'
    this._savedLetters = [];
  }

  // ══════════════════════════════════════════════════════════
  //  STORAGE
  // ══════════════════════════════════════════════════════════
  _loadLetters() {
    try {
      const raw = localStorage.getItem('starryPicnic_letters');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _saveLetter(text) {
    const letters = this._loadLetters();
    letters.push({
      text,
      date: new Date().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      }),
      time: new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit'
      })
    });
    localStorage.setItem('starryPicnic_letters', JSON.stringify(letters));
  }

  // ══════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════
  init() {
    this._buildUI();
  }

  // ══════════════════════════════════════════════════════════
  //  BUILD UI
  // ══════════════════════════════════════════════════════════
  _buildUI() {
    // Remove old if re-entering
    if (this._el) { this._el.remove(); this._el = null; }

    const el = document.createElement('div');
    el.id = 'letterLevel';
    el.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      display: none;
      background: #1a0e06;
      font-family: 'Georgia', 'Palatino Linotype', serif;
      overflow: hidden;
    `;

    el.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Pinyon+Script&family=IM+Fell+English:ital@0;1&display=swap');

        #letterLevel * { box-sizing: border-box; }

        /* ── Ambient dust particles ── */
        .dust {
          position: absolute; border-radius: 50%;
          background: rgba(255,220,140,0.18);
          animation: floatDust linear infinite;
          pointer-events: none;
        }
        @keyframes floatDust {
          0%   { transform: translateY(100vh) translateX(0)   scale(0.5); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(-10vh)  translateX(40px) scale(1.2); opacity: 0; }
        }

        /* ── Candlelight flicker ── */
        @keyframes flicker {
          0%,100% { opacity: 1;   filter: brightness(1); }
          20%     { opacity: 0.92; filter: brightness(0.95); }
          50%     { opacity: 0.97; filter: brightness(1.04); }
          75%     { opacity: 0.88; filter: brightness(0.97); }
        }
        .candle-glow {
          animation: flicker 3.2s ease-in-out infinite;
        }

        /* ── Page fade ── */
        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: pageFadeIn 0.7s ease forwards; }

        /* ── Letter unfurl ── */
        @keyframes unfurl {
          from { opacity: 0; transform: scaleY(0.4) translateY(-30px); }
          to   { opacity: 1; transform: scaleY(1)   translateY(0); }
        }
        .unfurl { animation: unfurl 0.55s cubic-bezier(0.22,1,0.36,1) forwards; }

        /* ── Seal pop ── */
        @keyframes sealPop {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.15) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .seal-pop { animation: sealPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }

        /* ── Ink write ── */
        @keyframes inkReveal {
          from { clip-path: inset(0 100% 0 0); }
          to   { clip-path: inset(0 0% 0 0); }
        }

        /* ── Shared paper texture ── */
        .paper {
          background:
            radial-gradient(ellipse at 30% 20%, rgba(255,245,210,1) 0%, rgba(245,225,175,1) 60%, rgba(230,205,150,1) 100%);
          box-shadow:
            0 2px 0 rgba(160,120,60,0.15),
            0 8px 32px rgba(0,0,0,0.55),
            inset 0 0 40px rgba(180,130,60,0.08);
          border: 1px solid rgba(160,120,50,0.3);
        }

        /* ── Ruled lines on paper ── */
        .paper-lined {
          background-image:
            radial-gradient(ellipse at 30% 20%, rgba(255,245,210,1) 0%, rgba(245,225,175,1) 60%, rgba(230,205,150,1) 100%),
            repeating-linear-gradient(
              to bottom,
              transparent 0px,
              transparent 27px,
              rgba(160,120,60,0.12) 27px,
              rgba(160,120,60,0.12) 28px
            );
        }

        /* ── Textarea ── */
        #aviLetterText {
          width: 100%; height: 100%;
          background: transparent;
          border: none; outline: none; resize: none;
          font-family: 'IM Fell English', Georgia, serif;
          font-size: 15px; line-height: 28px;
          color: #2a1505;
          padding: 0; margin: 0;
          caret-color: #7a3010;
        }
        #aviLetterText::placeholder { color: rgba(120,80,30,0.38); font-style: italic; }
        #aviLetterText::-webkit-scrollbar { width: 4px; }
        #aviLetterText::-webkit-scrollbar-thumb { background: rgba(160,100,40,0.3); border-radius: 4px; }

        /* ── Buttons ── */
        .letter-btn {
          font-family: 'IM Fell English', Georgia, serif;
          font-size: 14px; letter-spacing: 0.06em;
          border: 1px solid rgba(200,146,42,0.55);
          border-radius: 4px;
          padding: 9px 22px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative; overflow: hidden;
        }
        .letter-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
        .letter-btn:active { transform: translateY(0); }

        .btn-primary {
          background: linear-gradient(135deg, #7a3010, #5a1e06);
          color: #f0d090; box-shadow: 0 3px 12px rgba(0,0,0,0.4);
        }
        .btn-ghost {
          background: rgba(255,255,255,0.04);
          color: #c8922a;
        }
        .btn-gold {
          background: linear-gradient(135deg, #c8922a, #8a5a10);
          color: #fff8e0; box-shadow: 0 3px 14px rgba(0,0,0,0.45);
          font-size: 15px; padding: 11px 32px;
        }

        /* ── Archive list ── */
        .archive-item {
          background: rgba(255,240,200,0.06);
          border: 1px solid rgba(200,146,42,0.18);
          border-radius: 8px; padding: 14px 18px;
          cursor: pointer; transition: all 0.2s;
          margin-bottom: 10px;
        }
        .archive-item:hover {
          background: rgba(255,240,200,0.12);
          border-color: rgba(200,146,42,0.4);
          transform: translateX(4px);
        }

        /* ── Scroll in Purpura letter ── */
        #purpuraScroll {
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(160,100,40,0.3) transparent;
        }
        #purpuraScroll::-webkit-scrollbar { width: 4px; }
        #purpuraScroll::-webkit-scrollbar-thumb { background: rgba(160,100,40,0.3); border-radius: 4px; }
      </style>

      <!-- Ambient background -->
      <div id="ltrBg" style="position:absolute;inset:0;background:radial-gradient(ellipse at 40% 30%, #3a1c08 0%, #1a0a02 55%, #0e0604 100%);"></div>
      <div id="ltrDust"></div>

      <!-- ══ WRITE PHASE ══ -->
      <div id="phaseWrite" style="
        position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        gap:32px;padding:24px;
      ">
        <!-- Left: candle + prompt -->
        <div class="fade-in" style="
          display:flex;flex-direction:column;align-items:center;gap:18px;
          max-width:220px;flex-shrink:0;
        ">
          <!-- Candle SVG -->
          <div class="candle-glow" style="font-size:52px;filter:drop-shadow(0 0 18px rgba(255,180,60,0.7))">🕯️</div>

          <div style="text-align:center">
            <div style="
              font-family:'Pinyon Script',cursive;font-size:34px;
              color:#e8c060;text-shadow:0 0 20px rgba(232,192,96,0.4);
              line-height:1.1;
            ">Dear Purpura,</div>
            <div style="
              font-family:'IM Fell English',Georgia,serif;font-style:italic;
              font-size:12px;color:rgba(200,160,80,0.7);margin-top:8px;
              line-height:1.6;
            ">Write her a letter.<br>She is waiting.</div>
          </div>

          <!-- Previous letters button -->
          <button id="btnShowArchive" class="letter-btn btn-ghost" style="margin-top:8px;font-size:12px;padding:7px 16px">
            📜 Past Letters
          </button>

          <button id="btnExitWrite" class="letter-btn btn-ghost" style="font-size:11px;padding:6px 14px;opacity:0.6">
            ← Back
          </button>
        </div>

        <!-- Centre: writing paper -->
        <div class="fade-in paper paper-lined" style="
          width: min(520px, 90vw);
          height: min(640px, 80vh);
          border-radius: 3px;
          padding: 48px 52px 40px;
          display: flex; flex-direction: column;
          position: relative;
          animation-delay: 0.1s;
        ">
          <!-- Red margin line -->
          <div style="
            position:absolute;left:72px;top:0;bottom:0;
            width:1px;background:rgba(200,80,60,0.22);
          "></div>

          <!-- Date -->
          <div style="
            font-family:'IM Fell English',Georgia,serif;
            font-style:italic;font-size:12px;
            color:rgba(100,60,20,0.55);
            text-align:right;margin-bottom:16px;
            padding-left:20px;
          " id="ltrDate"></div>

          <!-- Textarea -->
          <div style="flex:1;padding-left:20px;overflow:hidden;">
            <textarea id="aviLetterText"
              placeholder="My dearest Purpura,&#10;&#10;I have been thinking about you…"
              spellcheck="false"
            ></textarea>
          </div>

          <!-- Signature area -->
          <div style="
            padding-left:20px;margin-top:12px;
            display:flex;align-items:flex-end;justify-content:space-between;
          ">
            <div style="
              font-family:'Pinyon Script',cursive;font-size:28px;
              color:rgba(80,40,10,0.45);
            ">Avicula</div>
            <div id="ltrCharCount" style="
              font-family:'IM Fell English',Georgia,serif;
              font-size:11px;color:rgba(120,80,30,0.4);
              font-style:italic;
            "></div>
          </div>
        </div>

        <!-- Right: send button area -->
        <div class="fade-in" style="
          display:flex;flex-direction:column;align-items:center;gap:16px;
          animation-delay:0.2s;
        ">
          <button id="btnSendLetter" class="letter-btn btn-primary" style="font-size:15px;padding:12px 28px">
            Send Letter 💌
          </button>
          <div style="
            font-family:'IM Fell English',Georgia,serif;font-style:italic;
            font-size:11px;color:rgba(200,160,80,0.45);text-align:center;
            max-width:120px;line-height:1.6;
          ">Seal it and<br>send it on its way</div>
        </div>
      </div>

      <!-- ══ READ PHASE (Purpura's letter) ══ -->
      <div id="phaseRead" style="
        position:absolute;inset:0;display:none;
        align-items:center;justify-content:center;
        padding:24px;gap:28px;
      ">
        <!-- Envelope reveal -->
        <div class="fade-in" style="display:flex;flex-direction:column;align-items:center;gap:14px;flex-shrink:0">
          <div style="font-size:56px;filter:drop-shadow(0 0 22px rgba(180,100,220,0.55))">💌</div>
          <div style="
            font-family:'Pinyon Script',cursive;font-size:22px;
            color:#cc88ff;text-shadow:0 0 16px rgba(180,80,255,0.35);
            text-align:center;line-height:1.3;
          ">A letter<br>from Purpura</div>
          <div style="
            font-family:'IM Fell English',Georgia,serif;font-style:italic;
            font-size:11px;color:rgba(180,140,220,0.55);text-align:center;
          ">She was waiting<br>for yours first.</div>
        </div>

        <!-- Purpura's letter paper -->
        <div class="unfurl paper" id="purpuraLetterWrap" style="
          width: min(500px, 88vw);
          max-height: min(640px, 82vh);
          border-radius: 3px;
          padding: 48px 52px;
          position: relative;
          display: flex; flex-direction: column;
        ">
          <!-- Wax seal top -->
          <div id="waxSeal" class="seal-pop" style="
            position:absolute;top:-18px;left:50%;transform:translateX(-50%);
            width:44px;height:44px;border-radius:50%;
            background:radial-gradient(circle at 35% 35%, #cc44ff, #6600aa);
            box-shadow:0 3px 12px rgba(120,0,180,0.55);
            display:flex;align-items:center;justify-content:center;
            font-size:20px;
          ">💜</div>

          <div id="purpuraScroll" style="overflow-y:auto;flex:1;">
            <div style="
              font-family:'IM Fell English',Georgia,serif;
              font-size:14.5px;line-height:28px;
              color:#2a1505;
              white-space:pre-wrap;
              word-break:break-word;
            " id="purpuraText"></div>
          </div>

          <!-- Bottom signature -->
          <div style="
            margin-top:16px;text-align:right;
            font-family:'Pinyon Script',cursive;
            font-size:30px;color:rgba(100,0,160,0.55);
          ">Purpura 💜</div>
        </div>

        <!-- Continue button -->
        <div class="fade-in" style="
          display:flex;flex-direction:column;align-items:center;gap:14px;
          animation-delay:0.4s;
        ">
          <button id="btnContinue" class="letter-btn btn-gold">
            Continue ✨
          </button>
          <div style="
            font-family:'IM Fell English',Georgia,serif;font-style:italic;
            font-size:11px;color:rgba(200,160,80,0.45);text-align:center;
            max-width:110px;line-height:1.6;
          ">Keep this letter<br>somewhere safe</div>
        </div>
      </div>

      <!-- ══ ARCHIVE PHASE ══ -->
      <div id="phaseArchive" style="
        position:absolute;inset:0;display:none;
        align-items:center;justify-content:center;
        padding:32px;
      ">
        <div class="fade-in" style="
          width:min(560px,92vw);
          max-height:85vh;
          display:flex;flex-direction:column;
          gap:18px;
        ">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="
              font-family:'Pinyon Script',cursive;font-size:38px;
              color:#e8c060;text-shadow:0 0 16px rgba(232,192,96,0.35);
            ">Past Letters</div>
            <button id="btnCloseArchive" class="letter-btn btn-ghost" style="font-size:12px;padding:6px 14px">
              ← Back
            </button>
          </div>

          <div id="archiveList" style="overflow-y:auto;flex:1;padding-right:4px;"></div>
        </div>
      </div>

      <!-- ══ MODAL: view a single archived letter ══ -->
      <div id="archiveModal" style="
        position:absolute;inset:0;display:none;
        align-items:center;justify-content:center;
        background:rgba(10,4,0,0.75);backdrop-filter:blur(6px);
        z-index:10;padding:24px;
      ">
        <div class="paper unfurl" style="
          width:min(480px,88vw);max-height:80vh;
          border-radius:3px;padding:44px 48px;
          display:flex;flex-direction:column;gap:12px;
          position:relative;
        ">
          <div id="modalDate" style="
            font-family:'IM Fell English',Georgia,serif;font-style:italic;
            font-size:12px;color:rgba(100,60,20,0.55);text-align:right;
          "></div>
          <div id="modalText" style="
            font-family:'IM Fell English',Georgia,serif;
            font-size:14px;line-height:27px;color:#2a1505;
            white-space:pre-wrap;overflow-y:auto;flex:1;
          "></div>
          <div style="
            font-family:'Pinyon Script',cursive;font-size:28px;
            color:rgba(80,40,10,0.45);
          ">Avicula</div>
          <button id="btnCloseModal" class="letter-btn btn-ghost" style="
            align-self:flex-end;font-size:12px;padding:6px 14px;
          ">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    this._el = el;
    this._bindEvents();
    this._spawnDust();
  }

  // ══════════════════════════════════════════════════════════
  //  DUST PARTICLES
  // ══════════════════════════════════════════════════════════
  _spawnDust() {
    const container = this._el.querySelector('#ltrDust');
    for (let i = 0; i < 22; i++) {
      const d = document.createElement('div');
      d.className = 'dust';
      const size = 2 + Math.random() * 4;
      d.style.cssText = `
        width:${size}px;height:${size}px;
        left:${Math.random() * 100}%;
        bottom:${Math.random() * 20}%;
        animation-duration:${8 + Math.random() * 14}s;
        animation-delay:${-Math.random() * 12}s;
      `;
      container.appendChild(d);
    }
  }

  // ══════════════════════════════════════════════════════════
  //  BIND EVENTS
  // ══════════════════════════════════════════════════════════
  _bindEvents() {
    const el = this._el;

    // Date stamp
    el.querySelector('#ltrDate').textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Char counter
    const textarea  = el.querySelector('#aviLetterText');
    const charCount = el.querySelector('#ltrCharCount');
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      charCount.textContent = len > 0 ? `${len} words written` : '';
    });

    // Send
    el.querySelector('#btnSendLetter').addEventListener('click', () => {
      const text = textarea.value.trim();
      if (text.length < 10) {
        textarea.style.outline = '1.5px solid rgba(200,60,30,0.6)';
        textarea.placeholder   = 'Write a little more first…';
        setTimeout(() => { textarea.style.outline = ''; }, 1400);
        return;
      }
      this._saveLetter(text);
      this._showReadPhase();
    });

    // Archive
    el.querySelector('#btnShowArchive').addEventListener('click', () => this._showArchive());
    el.querySelector('#btnCloseArchive').addEventListener('click', () => this._showWritePhase());

    // Modal
    el.querySelector('#btnCloseModal').addEventListener('click', () => {
      el.querySelector('#archiveModal').style.display = 'none';
    });

    // Continue to next level
    el.querySelector('#btnContinue').addEventListener('click', () => {
      this.engine.nextLevel('letter');
    });

    // Back buttons
    el.querySelector('#btnExitWrite').addEventListener('click', () => {
      this.engine.nextLevel('letter');
    });
  }

  // ══════════════════════════════════════════════════════════
  //  PHASE SWITCHING
  // ══════════════════════════════════════════════════════════
  _showWritePhase() {
    this._el.querySelector('#phaseWrite').style.display    = 'flex';
    this._el.querySelector('#phaseRead').style.display     = 'none';
    this._el.querySelector('#phaseArchive').style.display  = 'none';
  }

  _showReadPhase() {
    this._el.querySelector('#phaseWrite').style.display    = 'none';
    this._el.querySelector('#phaseArchive').style.display  = 'none';

    const readEl = this._el.querySelector('#phaseRead');
    readEl.style.display = 'flex';

    // Type out Purpura's letter character by character
    const target = this._el.querySelector('#purpuraText');
    target.textContent = '';
    let i = 0;
    const type = () => {
      if (i < PURPURA_LETTER.length) {
        target.textContent += PURPURA_LETTER[i++];
        // Scroll to bottom as it types
        const scroll = this._el.querySelector('#purpuraScroll');
        scroll.scrollTop = scroll.scrollHeight;
        setTimeout(type, 14);
      }
    };
    // Small delay before typing starts — let the unfurl finish
    setTimeout(type, 620);
  }

  _showArchive() {
    this._el.querySelector('#phaseWrite').style.display    = 'none';
    this._el.querySelector('#phaseArchive').style.display  = 'flex';

    const list    = this._el.querySelector('#archiveList');
    const letters = this._loadLetters();
    list.innerHTML = '';

    if (letters.length === 0) {
      list.innerHTML = `
        <div style="
          font-family:'IM Fell English',Georgia,serif;font-style:italic;
          color:rgba(200,160,80,0.4);font-size:14px;text-align:center;
          margin-top:32px;line-height:1.8;
        ">No letters yet.<br>Write the first one.</div>
      `;
      return;
    }

    // Most recent first
    [...letters].reverse().forEach((letter, idx) => {
      const item = document.createElement('div');
      item.className = 'archive-item';
      const preview = letter.text.substring(0, 80).replace(/\n/g, ' ');
      item.innerHTML = `
        <div style="
          font-family:'IM Fell English',Georgia,serif;font-style:italic;
          font-size:11px;color:rgba(200,146,42,0.55);margin-bottom:5px;
        ">${letter.date} · ${letter.time}</div>
        <div style="
          font-family:'IM Fell English',Georgia,serif;
          font-size:13px;color:rgba(240,210,140,0.8);
          line-height:1.5;
        ">${preview}${letter.text.length > 80 ? '…' : ''}</div>
      `;
      item.addEventListener('click', () => this._openArchiveModal(letter));
      list.appendChild(item);
    });
  }

  _openArchiveModal(letter) {
    const modal = this._el.querySelector('#archiveModal');
    this._el.querySelector('#modalDate').textContent = `${letter.date} · ${letter.time}`;
    this._el.querySelector('#modalText').textContent = letter.text;
    modal.style.display = 'flex';
  }

  // ══════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════════════
  onEnter() {
    this.engine.audio.playLevelMusic('letter'); // cleanest — stops old, starts new

    if (!this._el) this._buildUI();
    this._el.style.display = 'block';
    this._showWritePhase();

    // Clear textarea for fresh letter
    const ta = this._el.querySelector('#aviLetterText');
    if (ta) { ta.value = ''; }

    this.engine.hud?.setInfo(`
      <div style="font-weight:700;font-size:13px;color:#ffd700;margin-bottom:6px">✉️ Write a Letter</div>
      <div style="font-size:12px;opacity:0.7;line-height:1.6">
        Write to Purpura.<br>
        Send it to receive hers.
      </div>
    `);
  }

  onExit() {
    if (this._el) this._el.style.display = 'none';
  }

  update(_dt) {
    // No 3D update needed — pure DOM level
  }

  onInteract() {}
}