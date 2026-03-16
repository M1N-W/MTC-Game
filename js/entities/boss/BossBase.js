"use strict";
/**
 * js/entities/BossBase.js
 *
 * BossBase — shared lifecycle for all boss entities (speak, takeDamage, HUD)
 * BossDog  — summoned melee sub-unit of KruManop Phase 2
 *
 * Depends on: base.js (Entity), config.js (GAME_TEXTS, BALANCE)
 * Loaded before: ManopBoss.js, FirstBoss.js
 */

// ════════════════════════════════════════════════════════════
// 🏛️ BOSS BASE — Shared lifecycle for all boss entities
// ════════════════════════════════════════════════════════════
class BossBase extends Entity {
  constructor(x, y, radius) {
    super(x, y, radius);
    // ── Guard: push spawn clear of MTC Room (x:-150→150, y:-700→-460) ──
    // Prevents player exploit of trapping boss against Citadel walls.
    const MTC_X1 = -150 - 80,
      MTC_X2 = 150 + 80; // wall thickness buffer
    const MTC_Y1 = -700 - 20,
      MTC_Y2 = -460 + 20; // slight Y buffer
    if (
      this.x > MTC_X1 &&
      this.x < MTC_X2 &&
      this.y > MTC_Y1 &&
      this.y < MTC_Y2
    ) {
      // Eject south below the Citadel entrance
      this.y = MTC_Y2 + (radius || 50) + 20;
    }
    // ── Shared state ──────────────────────────────────────
    this.name = "BOSS";
    this.difficulty = 1;
    this.sayTimer = 0;
    this.hitFlashTimer = 0;
    // Race-condition guard: prevents double startNextWave() on rapid hits
    this._waveSpawnLocked = false;
    // Poom sticky stack tracker (shared across boss types)
    this.stickyStacks = 0;
  }

  // ── Boss speech — ดึงข้อความจาก GAME_TEXTS โดยตรง ────────
  speak(context) {
    if (!window.UIManager) return;
    const taunts = GAME_TEXTS.ai.bossTaunts;
    const text = taunts[Math.floor(Math.random() * taunts.length)];
    window.UIManager.showBossSpeech(text);
  }

  // ── Shared: HUD tick (call once per update frame) ─────────
  _updateHUD() {
    if (window.UIManager) {
      window.UIManager.updateBossHUD(this);
      window.UIManager.updateBossSpeech(this);
    }
  }

  // ── Shared: death cleanup ─────────────────────────────────
  // Subclasses call super.takeDamage() or override _onDeath().
  _onDeath() {
    this.dead = true;
    this.hp = 0;
    spawnParticles(this.x, this.y, 60, "#dc2626");
    spawnFloatingText("CLASS DISMISSED!", this.x, this.y, "#facc15", 35);
    addScore(BALANCE.score.boss * this.difficulty);
    if (window.UIManager) window.UIManager.updateBossHUD(null);
    Audio.playAchievement();
    for (let i = 0; i < 3; i++) {
      setTimeout(
        () =>
          window.powerups.push(
            new PowerUp(this.x + rand(-50, 50), this.y + rand(-50, 50))
          ),
        i * 200
      );
    }
    // ── Force-reset both domain singletons so isInvincible() doesn't leak ──
    // หากไม่ reset: phase ค้างใน casting/active → isInvincible() = true ทั้งเกมถัดไป
    if (typeof DomainExpansion !== "undefined") DomainExpansion._abort(null);
    if (typeof GravitationalSingularity !== "undefined")
      GravitationalSingularity._abort(null);
    // WARN-9: set flag BEFORE nulling window.boss so achievement check fires
    window.lastBossKilled = true;
    window.boss = null;
    setTimeout(() => {
      setWave(getWave() + 1);
      if (getWave() > BALANCE.waves.maxWaves) window.endGame("victory");
      else if (typeof window.startNextWave === "function")
        window.startNextWave();
    }, BALANCE.boss.nextWaveDelay);
  }

  // Subclasses must override takeDamage() and call _onDeath() on death,
  // or call super.takeDamage() if they have no additional guards.
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.BossBase = BossBase;
