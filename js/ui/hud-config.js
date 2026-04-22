// ══════════════════════════════════════════════════════════════════
//  HUD_CONFIG — declarative per-character skill slot spec (v3.44.3)
//
//  Each entry describes one skill icon in the HUD bar:
//    iconId    : DOM id of the .skill-icon element
//    lockKey   : SKILL.* constant (null = never locked)
//    cdPath    : dotted path into player for the current cooldown value
//                (empty '' = no cooldown arc; use for instant-active skills)
//    cdMaxPath : dotted path OR literal number for the cooldown max
//                (e.g. 'stats.teleportCooldown' or 24)
//
//  The UIManager._applyHUDConfig(player, setLockOverlay) helper iterates
//  this array and handles the *simple* pattern (lock overlay + cooldown
//  arc).  Bespoke per-character logic (Kao teleport charges, Pat iaido
//  phase, Auto heat tier) still lives in _updateIconsXxx for now — the
//  config handles what CAN be generic, leaving the complex cases untouched.
//
//  Adding a new character:
//    1. Add its token block in char-select.css (CHARACTER_CARD_CHECKLIST.md)
//    2. Add a HUD_CONFIG[<charId>] array here with one entry per icon.
//    3. Wire its updater (or reuse a generic one) in ui.js.
// ══════════════════════════════════════════════════════════════════

(function () {
  'use strict';
  // SKILL must be loaded first (SkillRegistry.js is script-ordered before
  // this file in index.html).  Guard defensively for smoke-test harness.
  const SK = (typeof window !== 'undefined' && window.SKILL) || {};

  const HUD_CONFIG = Object.freeze({
    kao: Object.freeze([
      // Teleport + Clone are unlock-gated and use charge-based HUD — their
      // full UI is driven by bespoke code in _updateIconsKao (charges arc,
      // penalty timers).  Still useful to register the lock key here.
      { iconId: 'teleport-icon', lockKey: SK.KAO?.TELEPORT, cdPath: '', cdMaxPath: 0 },
      { iconId: 'kao-clone-icon', lockKey: SK.KAO?.CLONE,   cdPath: '', cdMaxPath: 0 },
    ]),
    poom: Object.freeze([
      { iconId: 'eat-icon',    lockKey: null,             cdPath: 'cooldowns.eat',    cdMaxPath: 'stats.eatRiceCooldown' },
      { iconId: 'naga-icon',   lockKey: SK.POOM?.NAGA,    cdPath: 'cooldowns.naga',   cdMaxPath: 'stats.nagaCooldown' },
      { iconId: 'ritual-icon', lockKey: SK.POOM?.NAGA,    cdPath: 'cooldowns.ritual', cdMaxPath: 20 }, // BALANCE.abilities.ritual.cooldown
      { iconId: 'garuda-icon', lockKey: SK.POOM?.GARUDA,  cdPath: 'cooldowns.garuda', cdMaxPath: 'stats.garudaCooldown' },
    ]),
    auto: Object.freeze([
      // Wanchai R-Click and Vacuum Q are never locked (always available).
      { iconId: 'stealth-icon',  lockKey: null,                  cdPath: '', cdMaxPath: 0 },
      { iconId: 'vacuum-icon',   lockKey: null,                  cdPath: 'cooldowns.vacuum',     cdMaxPath: 'stats.vacuumCooldown' },
      { iconId: 'auto-det-icon', lockKey: SK.AUTO?.DETONATION,   cdPath: 'cooldowns.detonation', cdMaxPath: 'stats.detonationCooldown' },
    ]),
    pat: Object.freeze([
      { iconId: 'zanzo-icon',     lockKey: SK.PAT?.ZANZO, cdPath: 'skills.zanzo.cd', cdMaxPath: 'skills.zanzo.max' },
      { iconId: 'pat-guard-icon', lockKey: null,          cdPath: '', cdMaxPath: 0 },
      { iconId: 'pat-iaido-icon', lockKey: null,          cdPath: 'skills.iaido.cd', cdMaxPath: 'skills.iaido.max' },
    ]),
  });

  // Helper: resolve a dotted path against the player object.
  // Returns 0 when any segment is missing so consumers don't blow up.
  function resolvePath(obj, path) {
    if (typeof path === 'number') return path;
    if (!path) return 0;
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return 0;
      cur = cur[p];
    }
    return (typeof cur === 'number') ? cur : 0;
  }

  if (typeof window !== 'undefined') {
    window.HUD_CONFIG = HUD_CONFIG;
    window._hudResolvePath = resolvePath;
  }
})();
