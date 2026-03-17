"use strict";
/**
 * js/rendering/RenderSkins.js
 * ════════════════════════════════════════════════════════════════
 * Skin registry and apply/reset orchestrator for all playable characters.
 *
 * RULES:
 *  - ห้าม call applySkin() ใน draw loop หรือ update() — เรียกเฉพาะช่วง state transition
 *  - applySkin() ทำ RT.reset() → RT.override(patch) → clear caches เท่านั้น
 *  - SKIN_REGISTRY entries ใช้ชื่อ RT token เท่านั้น — ห้าม hardcode hex ใหม่
 *  - เพิ่ม skin ใหม่ → เพิ่ม entry ใน SKIN_REGISTRY[charId] แล้วเรียก applySkin() ได้เลย
 *  - ห้าม new object ใน draw path — RenderSkins ไม่มีโค้ดที่รันใน draw loop
 *
 * LOAD ORDER:
 *  RenderTokens.js → RenderSkins.js → [all renderer files]
 *  (index.html ต้องเรียง script ตามลำดับนี้)
 *
 * CALL SITE:
 *  menu.js → selectCharacter() → RenderSkins.applySkin(charId, skinId)
 *  (หลัง GameState.activeSkin sync จาก getSaveData())
 *
 * HOW TO ADD A NEW SKIN:
 *  1. เพิ่ม entry ใน SKIN_REGISTRY[charId]:
 *       mySkin: {
 *         palette: { bossOrange: '#hex', dangerDark: '#hex' },
 *         glow:    { danger: { blur: 20, color: '#hex' } }   // optional
 *       }
 *  2. เก็บ skinId ลง save ผ่าน updateSaveData({ selectedSkins: { auto: 'mySkin' } })
 *  3. เรียก RenderSkins.applySkin('auto', 'mySkin') — เห็นผลในเฟรมถัดไป
 *
 * ── TABLE OF CONTENTS ───────────────────────────────────────────
 *  L.44  SKIN_REGISTRY          skin patch definitions per character
 *  L.65  RenderSkins            singleton
 *  L.66    .applySkin()         RT.reset → RT.override → clear caches
 *  L.84    .reset()             restore all to factory defaults
 *  L.94    ._clearCaches()      invalidate renderer OffscreenCanvas caches
 * ════════════════════════════════════════════════════════════════
 */

// ── Skin definitions per character ───────────────────────────────────────────
// Empty patch ({}) = no override = RT factory defaults.
// All keys MUST match RT.palette / RT.glow / RT.stroke / RT.alpha token names.
const SKIN_REGISTRY = {
  auto: {
    default: {}, // factory defaults — no override applied
    // ── Example skin (uncomment to activate, verify token names vs RenderTokens.js):
    // cryo: {
    //   palette: {
    //     bossOrange:    '#38bdf8',  // icy blue replaces orange
    //     bossOrangeMid: '#7dd3fc',
    //     dangerDark:    '#0284c7',
    //   },
    //   glow: {
    //     danger: { blur: 18, color: '#38bdf8' },
    //   },
    // },
  },
  kao:  { default: {} },
  poom: { default: {} },
  pat:  { default: {} },
};

// ── RenderSkins singleton ─────────────────────────────────────────────────────
const RenderSkins = {

  /**
   * Apply a skin for one character.
   * Safe to call at menu state transitions only — never in draw/update loop.
   *
   * @param {string} charId   'auto' | 'kao' | 'poom' | 'pat'
   * @param {string} skinId   key in SKIN_REGISTRY[charId], defaults to 'default'
   */
  applySkin(charId, skinId = 'default') {
    if (typeof RT === 'undefined') {
      console.warn('[RenderSkins] RT not loaded — applySkin skipped');
      return;
    }

    // Always reset to factory defaults first so stale patches don't compound
    RT.reset();

    const patch = SKIN_REGISTRY[charId]?.[skinId];
    if (patch && Object.keys(patch).length > 0) {
      RT.override(patch);
    }

    // Update GameState so cache key reads are consistent this session
    if (typeof GameState !== 'undefined') {
      GameState.activeSkin[charId] = skinId;
    }

    this._clearCaches();
  },

  /**
   * Restore RT to factory defaults and clear all caches.
   * Call on "equip default skin" or new-game reset.
   */
  reset() {
    if (typeof RT !== 'undefined') RT.reset();
    this._clearCaches();
  },

  /**
   * Invalidate all OffscreenCanvas caches that bake RT palette values.
   * Forces fresh bitmap build on the next draw frame.
   * @private
   */
  _clearCaches() {
    // AutoRenderer — skin-keyed entries; clear entire Map to evict all tier variants
    if (typeof AutoRenderer !== 'undefined' && AutoRenderer._bodyCache instanceof Map) {
      AutoRenderer._bodyCache.clear();
    }
    // BossRenderer — only needed if boss skins are introduced (deferred, Session 8)
    // if (typeof BossRenderer !== 'undefined' && BossRenderer._cache) {
    //   BossRenderer._cache = {};
    // }
  },
};

window.RenderSkins = RenderSkins;
