// ══════════════════════════════════════════════════════════════════
//  SkillRegistry — single source of truth for unlock keys
//  Introduced in v3.44.3 (tech-debt remediation after Pat-Zanzo miss)
//
//  The project uses `player._abilityUnlock.skillsUnlocked[]` — a plain
//  array of string literals — to track per-skill unlock progression.
//  Previously every call site typed the key inline:
//
//      AU.skillsUnlocked.includes('teleport')   // typo-prone
//      AU.skillsUnlocked.push('perfectParry')
//
//  This freeze-object registry + `isUnlocked()` / `unlock()` helpers
//  on PlayerBase catches typos at dev time and documents the full set
//  of keys in one place. The runtime values remain bare strings to
//  avoid changing stored/migrated data.
//
//  Usage:
//      if (player.isUnlocked(SKILL.KAO.TELEPORT)) { ... }
//      player.unlock(SKILL.KAO.CLONE);
//
//  To add a new skill key: append it here, then reference the constant.
//  ══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const SKILL = Object.freeze({
    KAO: Object.freeze({
      TELEPORT:      'teleport',      // SU1: Q Teleport (ambush damage threshold)
      CLONE:         'clone',         // SU2: E Shadow Clone (stealth-attack chains)
    }),
    POOM: Object.freeze({
      NAGA:          'naga',          // SU1: Q+R Naga + Ritual (sticky target hits)
      GARUDA:        'garuda',        // SU2: E Garuda (ritual 4+ hits)
    }),
    AUTO: Object.freeze({
      VACUUM:        'vacuum',        // SU1: Q Vacuum Heat (rush melee damage)
      DETONATION:    'detonation',    // SU2: E Detonation (ORA combo x3)
    }),
    PAT: Object.freeze({
      ZANZO:         'zanzo',         // SU1: Q Zanzo Flash (Iaido hit count)
      PERFECT_PARRY: 'perfectParry',  // SU2: R-Click Perfect Parry (reflect count)
    }),
  });

  // Flat set of all valid keys — used by assertValidKey below.
  const ALL_KEYS = new Set([
    ...Object.values(SKILL.KAO),
    ...Object.values(SKILL.POOM),
    ...Object.values(SKILL.AUTO),
    ...Object.values(SKILL.PAT),
  ]);

  /**
   * assertValidSkillKey(key) — throws in dev mode if the key is not
   * registered above. In production (DEBUG_MODE === false) it's a no-op
   * so we never crash real users, only surface typos during development.
   */
  function assertValidSkillKey(key) {
    if (typeof key !== 'string' || !ALL_KEYS.has(key)) {
      const msg = `[SkillRegistry] Unknown skill key: ${JSON.stringify(key)} — ` +
                  `register it in js/systems/SkillRegistry.js first.`;
      if (typeof DEBUG_MODE !== 'undefined' && DEBUG_MODE) {
        throw new Error(msg);
      } else if (typeof console !== 'undefined') {
        console.warn(msg);
      }
      return false;
    }
    return true;
  }

  // Expose globally (non-module script pattern used elsewhere in repo)
  if (typeof window !== 'undefined') {
    window.SKILL = SKILL;
    window.SKILL_ALL_KEYS = ALL_KEYS;
    window.assertValidSkillKey = assertValidSkillKey;
  }
})();
