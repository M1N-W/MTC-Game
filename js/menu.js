"use strict";
/**
 * js/menu.js
 * ════════════════════════════════════════════════════════════════
 * Main menu scripts — character select, portrait injection,
 * victory screen animations, skill tooltips, and Service Worker.
 * Extracted from inline <script> in index.html.
 *
 * Depends on (must load before menu.js):
 *  ui.js          — window.PORTRAITS (SVG strings per char)
 *  effects.js     — spawnParticles() (victory burst)
 *  game.js        — CANVAS, window.Achievements, ACHIEVEMENT_DEFS
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────
 *  L.8   selectCharacter(charType)
 *          updates .char-card.selected, start/tutorial button labels,
 *          HUD portrait SVG swap, skill slot hint text
 *  ⚠️  Reads window.PORTRAITS — safe only after ui.js executes.
 *      Called by onclick on char cards; also callable from game.js on restart.
 *
 *  L.57  window 'load' → _injectPortraits()
 *          populates #char-avatar-[id] SVG elements (96×112)
 *          sets default HUD portrait to _selectedChar (default: 'kao')
 *
 *  L.79  Victory Screen IIFE
 *          MutationObserver on #victory-screen style → triggers _launchVictory()
 *          L.96   _startStarfield()     canvas particle rain on #victory-stars
 *          L.128  _countUp(id, delay)   ease-out number count-up animation
 *          L.144  _buildAchievements()  chip list from window.Achievements.unlocked
 *          L.159  _particleBurst()      gold spawnParticles on victory entry (600ms delay)
 *
 *  L.168 Skill Preview Tooltips IIFE (_initSkillTooltips)
 *          desktop: mouseenter/mouseleave with 120ms hide debounce
 *          mobile:  touchstart 350ms hold → toggle tooltip
 *          positions tooltip above card (flips below if near top edge)
 *
 *  L.251 Service Worker registration (sw.js)
 *  ⚠️  sw.js cache version must be bumped on every deploy — see sw.js header.
 *
 * ════════════════════════════════════════════════════════════════
 */

// ── Character Selection ───────────────────────────────────────────────────────
let _selectedChar = "kao";
function selectCharacter(charType) {
  _selectedChar = charType;
  document
    .querySelectorAll(".char-card")
    .forEach((c) => c.classList.remove("selected"));
  const card =
    document.getElementById("card-" + charType) ||
    document.getElementById("btn-" + charType) ||
    document.getElementById(charType);
  if (card) card.classList.add("selected");

  // ── Mark container so unselected cards can recede ──────────────────────
  const cardsContainer = card?.closest(".char-cards");
  if (cardsContainer) cardsContainer.classList.add("has-selection");

  // ── Buttons label ──────────────────────────────
  const startBtn = document.getElementById("start-btn");
  const tutBtn = document.getElementById("tutorial-btn");
  const iconPrefix =
    charType === "poom"
      ? "🌾"
      : charType === "auto"
        ? "🔥"
        : charType === "pat"
          ? "⚔️"
          : "🎓";
  if (startBtn) startBtn.textContent = iconPrefix + " START MISSION";
  if (tutBtn) tutBtn.textContent = iconPrefix + " REPLAY TUTORIAL";

  // ── HUD portrait SVG swap ────────────────────────────────────────────────
  // window.PORTRAITS defined in ui.js at module scope (loaded before user
  // can click a card).  Guard covers edge-case of early call.
  const hudSvg = document.getElementById("hud-portrait-svg");
  if (hudSvg && window.PORTRAITS?.[charType]) {
    hudSvg.innerHTML = window.PORTRAITS[charType];
  }

  // ── Skill slot hint preview ──────────────────────────────────────────────
  const hintEl = document.getElementById("skill1-hint");
  if (hintEl) {
    hintEl.textContent =
      charType === "auto"
        ? "STAND"
        : charType === "poom"
          ? "EAT"
          : charType === "pat"
            ? "GUARD"
            : "R-Click";
  }
  const emojiEl = document.getElementById("skill1-emoji");
  if (emojiEl) {
    emojiEl.textContent =
      charType === "auto"
        ? "🔥"
        : charType === "poom"
          ? "🍚"
          : charType === "pat"
            ? "⚔️"
            : "📖";
  }
}

// ── Character Carousel Navigation ─────────────────────────────────────────────
// Characters in display order (must match IDs used by selectCharacter)
const _CHAR_ORDER = ["kao", "poom", "auto", "pat"];
let _currentCharIndex = 0;

/**
 * Navigate the carousel by `dir` steps (+1 = next, -1 = prev).
 * Wraps around. Exposed on window so HTML onclick can reach it.
 */
function _navigateChar(dir) {
  _resetFlip();
  _currentCharIndex =
    (_currentCharIndex + dir + _CHAR_ORDER.length) % _CHAR_ORDER.length;
  selectCharacter(_CHAR_ORDER[_currentCharIndex]);
  _updateCarousel();
}
window._navigateChar = _navigateChar;

// ── Flip state ────────────────────────────────────────────────────────────────
let _flippedChar = null;

function _resetFlip() {
  if (!_flippedChar) return;
  const el =
    document.getElementById("card-" + _flippedChar) ||
    document.getElementById("btn-" + _flippedChar);
  if (el) el.classList.remove("is-flipped");
  _flippedChar = null;
}

/**
 * Card click handler (replaces inline onclick="selectCharacter(...)").
 * First click  → select character, reset flip.
 * Second click → toggle front / back face.
 */
function handleCardClick(charId) {
  if (_selectedChar !== charId) {
    _resetFlip();
    selectCharacter(charId);
    const idx = _CHAR_ORDER.indexOf(charId);
    if (idx !== -1) _currentCharIndex = idx;
    _updateCarousel();
  } else {
    const el =
      document.getElementById("card-" + charId) ||
      document.getElementById("btn-" + charId);
    if (!el) return;
    const flipping = !el.classList.contains("is-flipped");
    el.classList.toggle("is-flipped", flipping);
    _flippedChar = flipping ? charId : null;
  }
}
window.handleCardClick = handleCardClick;

function _updateCarousel() {
  const charId = _CHAR_ORDER[_currentCharIndex];

  // ── Show only active card ────────────────────────────────────────────────
  _CHAR_ORDER.forEach((id, i) => {
    const el =
      document.getElementById("card-" + id) ||
      document.getElementById("btn-" + id);
    if (!el) return;
    if (i === _currentCharIndex) {
      el.classList.add("selected");
    } else {
      el.classList.remove("selected");
    }
  });

  // ── Update dot indicators ────────────────────────────────────────────────
  document.querySelectorAll(".char-dot").forEach((dot, i) => {
    dot.classList.toggle("active", i === _currentCharIndex);
  });

  // ── Apply theme to #overlay ──────────────────────────────────────────────
  const overlay = document.getElementById("overlay");
  if (overlay) {
    // Strip existing theme-* classes, add new one
    const classes = overlay.className
      .split(" ")
      .filter((c) => !c.startsWith("theme-"));
    classes.push("theme-" + charId);
    overlay.className = classes.join(" ").trim();
  }

  // ── Sync start modal char name if visible ────────────────────────────────
  const startModalName = document.getElementById("start-modal-char-name");
  if (startModalName) startModalName.textContent = charId.toUpperCase();
}

// Initialise carousel on DOMContentLoaded
(function _initCarousel() {
  function _setup() {
    // Dots click→navigate
    document.querySelectorAll(".char-dot").forEach((dot) => {
      const idx = parseInt(dot.dataset.index, 10);
      dot.addEventListener("click", () => {
        _resetFlip();
        _currentCharIndex = idx;
        selectCharacter(_CHAR_ORDER[_currentCharIndex]);
        _updateCarousel();
      });
    });

    // Keyboard left/right arrow navigation
    document.addEventListener("keydown", (e) => {
      // Only when overlay is visible
      const overlay = document.getElementById("overlay");
      if (!overlay || overlay.style.display === "none") return;
      if (e.key === "ArrowLeft") _navigateChar(-1);
      if (e.key === "ArrowRight") _navigateChar(+1);
    });

    // Set initial theme & state
    _updateCarousel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _setup);
  } else {
    _setup();
  }
})();

// This guarantees window.PORTRAITS (defined in ui.js) is ready before we try
// to populate the char-select cards and the default HUD portrait.
window.addEventListener("load", function _injectPortraits() {
  if (!window.PORTRAITS) {
    // ui.js wasn't loaded yet — shouldn't happen, but don't crash
    console.warn(
      "[menu] window.PORTRAITS not found — portrait injection skipped",
    );
    return;
  }

  // ── Char-select card portraits (96 × 112 each) ──────────────────────────
  ["kao", "poom", "auto", "pat"].forEach((id) => {
    const el = document.getElementById("char-avatar-" + id);
    if (!el) return;
    el.innerHTML =
      '<svg viewBox="0 0 96 112" xmlns="http://www.w3.org/2000/svg"' +
      ' width="96" height="112" style="display:block;width:100%;height:100%;">' +
      (window.PORTRAITS[id] || "") +
      "</svg>";
  });

  // ── Default HUD portrait (Kao on fresh load) ─────────────────────────────
  const hudSvg = document.getElementById("hud-portrait-svg");
  if (hudSvg && window.PORTRAITS[_selectedChar]) {
    hudSvg.innerHTML = window.PORTRAITS[_selectedChar];
  }
});

// ── Victory Screen — Starfield + Count-up + Achievement chips ────────────────
(function () {
  const vs = document.getElementById("victory-screen");
  if (!vs) return;

  const obs = new MutationObserver(() => {
    if (vs.style.display !== "none" && vs.style.display !== "") {
      _launchVictory();
      obs.disconnect();
    }
  });
  obs.observe(vs, { attributes: true, attributeFilter: ["style"] });

  function _launchVictory() {
    _startStarfield();
    _countUp("final-score", 1800);
    _countUp("final-wave", 2000);
    _countUp("final-kills", 2200);
    _buildAchievements();
    _particleBurst();
  }

  // ── Starfield ────────────────────────────────────────────────────────────
  function _startStarfield() {
    const c = document.getElementById("victory-stars");
    if (!c) return;
    const ctx = c.getContext("2d");
    let W, H, stars;

    function resize() {
      W = c.width = vs.offsetWidth;
      H = c.height = vs.offsetHeight;
      stars = Array.from({ length: 180 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random(),
        speed: Math.random() * 0.4 + 0.1,
        drift: (Math.random() - 0.5) * 0.15,
      }));
    }
    resize();
    window.addEventListener("resize", resize);

    function tick() {
      ctx.clearRect(0, 0, W, H);
      stars.forEach((s) => {
        s.y += s.speed;
        s.x += s.drift;
        s.a += (Math.random() - 0.5) * 0.04;
        s.a = Math.max(0.1, Math.min(1, s.a));
        if (s.y > H) {
          s.y = 0;
          s.x = Math.random() * W;
        }
        if (s.x < 0 || s.x > W) s.x = Math.random() * W;
        const isGold = s.r > 1.2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = isGold
          ? `rgba(250,204,21,${s.a * 0.7})`
          : `rgba(255,255,255,${s.a * 0.55})`;
        ctx.fill();
      });
      if (vs.style.display !== "none") requestAnimationFrame(tick);
    }
    tick();
  }

  // ── Count-up animation ───────────────────────────────────────────────────
  function _countUp(id, delay) {
    const el = document.getElementById(id);
    if (!el) return;
    const target = parseInt(el.textContent.replace(/\D/g, "")) || 0;
    if (target === 0) return;
    let start = null;
    const dur = 1400;
    setTimeout(() => {
      function frame(ts) {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * ease).toLocaleString();
        if (p < 1) requestAnimationFrame(frame);
        else el.textContent = target.toLocaleString();
      }
      requestAnimationFrame(frame);
    }, delay);
  }

  // ── Achievement chips ────────────────────────────────────────────────────
  function _buildAchievements() {
    const container = document.getElementById("victory-achs");
    if (!container) return;
    const ach = window.Achievements;
    if (!ach || !ach.unlocked || ach.unlocked.size === 0) return;
    const defs = window.ACHIEVEMENT_DEFS || [];
    ach.unlocked.forEach((id) => {
      const def = defs.find((a) => a.id === id);
      if (!def) return;
      const chip = document.createElement("span");
      chip.className = "victory-ach-chip";
      chip.textContent = (def.icon || "★") + " " + (def.name || id);
      container.appendChild(chip);
    });
  }

  // ── Gold particle burst on entry ─────────────────────────────────────────
  function _particleBurst() {
    if (typeof spawnParticles !== "function") return;
    setTimeout(() => {
      const cx =
        typeof CANVAS !== "undefined" && CANVAS
          ? CANVAS.width / 2
          : window.innerWidth / 2;
      const cy =
        typeof CANVAS !== "undefined" && CANVAS
          ? CANVAS.height / 2
          : window.innerHeight / 2;
      spawnParticles(cx, cy, 80, "#facc15");
      spawnParticles(cx, cy, 40, "#f97316");
    }, 600);
  }
})();

// ── Skill Preview Tooltips — disabled; skills now live on card back face ─────
// Replaced by handleCardClick() flip mechanic (select-then-flip pattern).

// ── Remote Config (optional DOM: #mtc-announcement, #mtc-shop-banner) ────────
(function _remoteConfigUiHook() {
  window.addEventListener("load", () => {
    if (
      typeof firebaseRemoteConfigReady === "undefined" ||
      typeof getRemoteConfigString !== "function"
    )
      return;
    firebaseRemoteConfigReady.then(() => {
      const ann = getRemoteConfigString("announcement", "");
      const annEl = document.getElementById("mtc-announcement");
      if (annEl && ann) annEl.textContent = ann;
      const shop = getRemoteConfigString("shop_banner", "");
      const shopEl = document.getElementById("mtc-shop-banner");
      if (shopEl && shop) shopEl.textContent = shop;
    });
  });
})();

// ── Start Modal ───────────────────────────────────────────────────────────────
/**
 * Opens the START MISSION sub-panel.
 * Reads _selectedChar / _currentCharIndex (module scope in this file).
 * Two choices: START GAME → startGame(), TUTORIAL → TutorialSystem.reset() + startGame().
 */
function _openStartModal() {
  const modal = document.getElementById("start-modal");
  if (!modal) return;
  const nameEl = document.getElementById("start-modal-char-name");
  if (nameEl)
    nameEl.textContent = (
      _CHAR_ORDER[_currentCharIndex] || _selectedChar
    ).toUpperCase();
  modal.classList.add("start-modal--open");
  modal.setAttribute("aria-hidden", "false");
}
window._openStartModal = _openStartModal;

function _closeStartModal() {
  const modal = document.getElementById("start-modal");
  if (!modal) return;
  modal.classList.remove("start-modal--open");
  modal.setAttribute("aria-hidden", "true");
}
window._closeStartModal = _closeStartModal;

function _startModalPlay() {
  _closeStartModal();
  if (typeof startGame === "function") startGame(_selectedChar);
}
window._startModalPlay = _startModalPlay;

function _startModalTutorial() {
  _closeStartModal();
  if (window.TutorialSystem) TutorialSystem.reset();
  if (typeof startGame === "function") startGame(_selectedChar);
}
window._startModalTutorial = _startModalTutorial;

// Escape closes start modal (only while overlay is visible)
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const modal = document.getElementById("start-modal");
  if (modal && modal.classList.contains("start-modal--open"))
    _closeStartModal();
});

// ── Service Worker Registration ───────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((r) => console.log("✅ ServiceWorker registered:", r.scope))
      .catch((e) => console.error("❌ ServiceWorker failed:", e));
  });
}
