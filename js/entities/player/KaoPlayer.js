"use strict";
/**
 * js/entities/player/KaoPlayer.js
 * ════════════════════════════════════════════════════════════════════════════
 * "เก้า" — Advanced Assassin. Passive-driven stealth combatant with
 * two-phase passive unlock, weapon mastery, and phantom clone mechanics.
 *
 * Extends: KaoPlayer → Player (PlayerBase) → Entity
 * Exports: window.KaoPlayer
 *
 * @module js/entities/player/KaoPlayer
 * @fileoverview Kao character implementation with stealth, clones, and weapon mastery
 *
 * Load order dependency:
 *   base.js → PlayerBase.js → KaoPlayer.js
 *   PlayerRenderer.js reads isFreeStealthActive, clones[], teleportCharges
 *   enemy.js calls player.addKill(weaponName) on every enemy death
 *   game.js calls player.update(dt, keys, mouse) and player.shoot(dt)
 *
 * ── TABLE OF CONTENTS ───────────────────────────────────────────────────
 *  L.63   class KaoClone           Phantom duplicate that mirrors attacks
 *  L.63     constructor            Spawns at owner position with angle offset
 *  L.75     .update(dt)            Orbits around owner (if not stationary)
 *  L.88     .shoot()               Fire projectiles from clone position
 *  L.135  class KaoPlayer          Main character class
 *  L.136    constructor            Stealth state, weapon kills, clones array
 *  L.213    checkPassiveUnlock()   Lv1/Lv2 passive progression (stealth → kills)
 *  L.289    onKillWhileFreeStealthy()  Count kills toward Lv2 unlock
 *  L.307    addKill(weaponName)    Weapon mastery kill tracker (called by enemy.js)
 *  L.369    update(dt,k,m)         Main tick — stealth, cooldowns, input
 *  L.773    shoot(dt)              L-Click entry — delegates to weaponSystem
 *  L.808    fireWeapon()           Fire with Weapon Master buffs + clone mirrors
 *  L.1004   takeDamage(amt)        Graph Risk ×1.5 multiplier check
 *  L.1015   updateUI()             Q/E cooldown dials + HP/EN bars
 *  L.1075 window.KaoPlayer = KaoPlayer  Global export
 *
 * ── PASSIVE SYSTEM OVERVIEW ──────────────────────────────────────────────
 *  Lv1  first stealth use → HP+30%, lifesteal 3%, speed+0.4, Dash-Stealth,
 *                            Q (Teleport) + E (Clone) UNLOCKED
 *  Lv2  5 kills while isFreeStealthActive → HP+20%, crit+5%,
 *                                            Phantom Blink UNLOCKED
 *
 * ── FREE-STEALTH vs AUTO-STEALTH TERMINOLOGY ────────────────────────────
 *  Free-Stealth  (ซุ่มเสรี)  — the passive STATE: isFreeStealthActive=true
 *                               Damage×1.5, guaranteed crit, kills count toward Lv2
 *  Auto-Stealth  (ซุ่มอัตโนมัติ) — the TRIGGER mechanism that activates Free-Stealth
 *                               Currently: rising-edge of dash → Free-Stealth
 *                               lastAutoStealthTrigger: 'dash' | 'bullet'
 *  Skill Stealth (R-Click)  — player-activated via PlayerBase, separate cooldown
 *
 * ⚠️  Clones are created in constructor (this.clones = []) but only activated
 *     after Lv1 passive unlock — check this.passiveUnlocked before spawning.
 * ⚠️  Weapon mastery requires 5 kills PER WEAPON — track via this.weaponKills{}.
 * ⚠️  isFreeStealthActive must be true for kills to count toward Lv2 — stealth
 *     must be triggered BEFORE the killing blow lands.
 * ⚠️  Graph Risk damage multiplier (1.5×) is applied in takeDamage() — any other
 *     damage mods must stack multiplicatively, not replace this.
 * ⚠️  KaoPlayer bypasses WeaponSystem.shootSingle() entirely — ambush break,
 *     stealth check, and shell casings must all be handled inside fireWeapon().
 * ⚠️  speedBoost is injected and restored around super.update() every frame
 *     (stateless additive pattern) — never persist the modified value.
 * ⚠️  draw() lives in PlayerRenderer._drawKao() — nothing renders here.
 * ⚠️  isFreeStealthActive is NOT the same as isInvisible (R-Click stealth).
 *     Both can be true simultaneously. Renderer checks both independently.
 *
 * ── STATE MACHINE INVARIANTS (v3.44.3 audit) ────────────────────────────
 *   A. Teleport       : teleportCharges + teleportTimers[] (SU1-gated)
 *   B. Clone          : clones[], clonesActiveTimer, cloneSkillCooldown (SU2-gated)
 *   C. Free-Stealth   : isFreeStealthActive ↔ freeStealthRemainingTime
 *                       (passive-gated; triggered by dash rising edge)
 *   D. R-Click Stealth: isInvisible (base PlayerBase, independent of C)
 *   E. Phantom Blink  : _phantomBlinkActive + _blinkAmbushTimer
 *                       (Lv2-passive-gated; consumes C+D on trigger)
 *   F. Weapon Master  : isWeaponMaster (Special-gated; independent of A-E)
 *
 * ⚠️  A, B, C, D, F are ORTHOGONAL.  Do not gate B on A or vice versa —
 *     each has its own unlock condition via _abilityUnlock.skillsUnlocked.
 * ⚠️  E is STRICTLY AFTER C+D (consumes both on trigger).  Adding a new
 *     ability that mutates isInvisible must account for E's break.
 * ⚠️  C kills count toward passive only when A+B are BOTH unlocked
 *     (see addKill() → this._abilityUnlock.allSkillsDone gate).
 * ═══════════════════════════════════════════════════════════════════════
 */

// ── KaoClone ─────────────────────────────────────────────────────────────────
// Phantom duplicate that mirrors Kao's attacks but is invisible to enemies.
class KaoClone {
  constructor(owner, angleOffset) {
    this.owner = owner;
    this.angleOffset = angleOffset;
    // FIX (TASK 1): Fallback radius and position to prevent Canvas .arc() crash
    this.radius = owner.radius || 20;
    this.x = owner.x || 0;
    this.y = owner.y || 0;
    this.color = "#3b82f6";
    this.alpha = 0.6; // FIX (TASK 1): Slightly more visible (was 0.5)
  }

  update(dt) {
    if (this.isStationary) return; // FIX: shadow clone จาก Phantom Blink ไม่ควร orbit หา owner
    const dist = 60;
    const targetX = this.owner.x + Math.cos(this.angleOffset) * dist;
    const targetY = this.owner.y + Math.sin(this.angleOffset) * dist;
    // Smooth-follow the orbit position
    this.x += (targetX - this.x) * 10 * dt;
    this.y += (targetY - this.y) * 10 * dt;
  }

  // draw() ย้ายไป PlayerRenderer._drawKaoClone() แล้ว

  /** Fire projectiles from the clone's position, mirroring the owner's shot. */
  shoot(wep, damage, color, pellets, spread, wepKey, isCrit) {
    const aimAngle = Math.atan2(
      window.mouse.wy - this.y,
      window.mouse.wx - this.x,
    );
    const barrelOffset = 28;

    for (let i = 0; i < pellets; i++) {
      const spreadAngle = pellets > 1 ? (Math.random() - 0.5) * spread : 0;
      const finalAngle = aimAngle + spreadAngle;
      const sx = this.x + Math.cos(finalAngle) * barrelOffset;
      const sy = this.y + Math.sin(finalAngle) * barrelOffset;

      let projOptions = {};
      if (wepKey === "sniper") {
        projOptions.bounces = 2;
        projOptions.life = 5;
      } else if (wepKey === "shotgun") {
        projOptions.bounces = 1;
        projOptions.life = 2.5;
      }

      const p = new Projectile(
        sx,
        sy,
        finalAngle,
        wep.speed,
        damage,
        color, // FIX: damage already scaled to 60% by caller (was ×0.5 here → actual 30%)
        isCrit,
        "player",
        projOptions,
      );
      p.isCrit = isCrit;
      p.weaponKind = wepKey;
      projectileManager.add(p);
    }
    spawnParticles(
      this.x + Math.cos(aimAngle) * 25,
      this.y + Math.sin(aimAngle) * 25,
      3,
      color,
    );
  }
}

// ── KaoPlayer ─────────────────────────────────────────────────────────────────
class KaoPlayer extends Player {
  constructor(x = 0, y = 0) {
    super("kao");
    this.x = x;
    this.y = y;
    const S = BALANCE.characters.kao;

    // ── Teleport ───────────────────────────────────────────────────────────
    this.teleportCharges = 0; // 0 ก่อน passive unlock, จะเซ็ตเป็น 3 ตอน unlock
    this.maxTeleportCharges = 3;
    this.teleportCooldown = S.teleportCooldown ?? 20; // BUG-1 fix: was hardcoded 15
    this.teleportPenalty = 5; // วินาทีบทลงโทษเมื่อหมดทุก stack
    this.teleportTimers = []; // [{elapsed, max}] แต่ละ slot = 1 stack ที่ถูกใช้ไป
    this._teleportInited = false; // flag: เซ็ต 3 charge ครั้งแรกที่ passive unlock
    // ── Free-Stealth State (ซุ่มเสรี — Passive ของเก้า) ───────────────────
    this.isFreeStealthActive = false;       // ← ขณะนี้ Free-Stealth อยู่หรือ?
    this.freeStealthRemainingTime = 0;      // ← เวลาที่เหลือของ Free-Stealth
    this.maxFreeStealthDuration = 2.0;

    // ── Auto-Stealth Trigger (กลไกที่เรียก Free-Stealth อัตโนมัติ) ────────
    this.autoStealthCooldown = 0;           // ← cooldown ก่อน auto-trigger ครั้งถัดไป
    this.lastAutoStealthTrigger = 'dash';   // ← trigger จากอะไร: 'dash' | 'bullet';

    // ── Weapon Master Awakening ────────────────────────────────────────────
    this.weaponKills = { auto: 0, sniper: 0, shotgun: 0 };
    this.isWeaponMaster = false;

    // Sniper charge (hold-to-charge when Weapon Master)
    this.sniperChargeTime = 0;

    // Stacking crit bonus from Auto Rifle (Weapon Master)
    this.bonusCritFromAuto = 0;

    // ── Clone of Stealth (E skill) ─────────────────────────────────────────
    this.clones = [];
    this.cloneSkillCooldown = 0;
    this.maxCloneCooldown = S.cloneCooldown ?? 60; // BUG-2 fix: was || 45 (config = 60)
    this.clonesActiveTimer = 0;

    // FIX (TASK 2): Own shoot cooldown — decoupled from weaponSystem to
    //               prevent the machine-gun NaN glitch.
    this.shootCooldown = 0;

    // ── Audio edge-trigger flag: play stealth sound only on rising edge ──
    this._wasFreeStealthActive = false;

    // ── Phantom Blink state ──────────────────────────────────────────────
    this._phantomBlinkActive = false; // Q pressed during stealth
    this._blinkAmbushTimer = 0; // crit window after blink

    // ── Clone proximity burst tracking ──────────────────────────────────
    this._cloneProxTimers = []; // [{clone, timer}] detonation countdown

    // ── Dash-stealth (replaces random auto-stealth) ─────────────────────
    this._dashWasActive = false; // edge-detect dash start

    // ── Passive behaviour flags (overrides PlayerBase defaults) ──────────
    this.passiveSpeedBonus = 0; // REWORK: ไม่ใช้ Math.max แล้ว — ใช้ additive แทนใน speedMult
    this.usesOwnLifesteal = true; // KaoPlayer จัดการ lifesteal เอง ไม่ใช้ base logic

    // ── Passive Lv2 "Awakened" state ────────────────────────────────────
    this.passiveLv2Unlocked = false; // Phantom Blink + crit bonus ปลดที่ Lv2
    this._freeStealthKills = 0; // นับ kills ขณะ isFreeStealthActive

    // ── AbilityUnlock trackers ─────────────────────────────────────────
    // SU1: Q (Teleport) — deal 200 total guaranteed-crit ambush damage
    this._ambushDamageDealt = 0;
    // SU2: E (Clone) — 3 stealth→attack chain completions
    this._stealthAttackChains = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ABILITY UNLOCK — Sequential behavior-gated progression
  // ──────────────────────────────────────────────────────────────────────────
  // SU1: Q (Teleport)      — deal 200 total ambush (guaranteed-crit) damage
  // SU2: E (Clone)         — complete 3 stealth→attack chain sequences
  // Passive (merged Lv1+2) — SU1+SU2 done + kill 5 enemies during stealth
  // Special (WeaponMaster) — all 3 weapons reach 5 kills (after passive)
  checkPassiveUnlock() {
    const S = this.stats;
    const AU = this._abilityUnlock;

    // ── SU1: Teleport Q — accumulate 200 guaranteed-crit ambush damage ──
    if (!this.isUnlocked(SKILL.KAO.TELEPORT)) {
      const req = S.su1AmbushDmgReq ?? 200;
      if ((this._ambushDamageDealt ?? 0) < req) return;
      this.unlock(SKILL.KAO.TELEPORT);
      spawnFloatingText("🔮 Q UNLOCKED: Teleport!", this.x, this.y - 65, "#3b82f6", 22);
      spawnParticles(this.x, this.y, 25, "#3b82f6");
      if (typeof Audio !== "undefined" && Audio.playAchievement) Audio.playAchievement();
      if (typeof UIManager !== "undefined")
        UIManager.showVoiceBubble("🔮 Teleport Unlocked!", this.x, this.y - 40);
    }

    // ── SU2: Clone E — complete 3 stealth→attack chain sequences ───────
    if (!this.isUnlocked(SKILL.KAO.CLONE)) {
      const req2 = S.su2ChainReq ?? 3;
      if ((this._stealthAttackChains ?? 0) < req2) return;
      this.unlock(SKILL.KAO.CLONE);
      AU.allSkillsDone = true;
      spawnFloatingText("👥 E UNLOCKED: Shadow Clone!", this.x, this.y - 65, "#8b5cf6", 22);
      spawnParticles(this.x, this.y, 25, "#8b5cf6");
      if (typeof Audio !== "undefined" && Audio.playAchievement) Audio.playAchievement();
      if (typeof UIManager !== "undefined")
        UIManager.showVoiceBubble("👥 Clone Unlocked!", this.x, this.y - 40);
    }

    // Both skills done — ensure flag is set
    if (!AU.allSkillsDone) AU.allSkillsDone = true;

    // ── Passive (merged Lv1+Lv2): SU1+SU2 + 5 free-stealth kills ──────
    if (!this.passiveUnlocked) {
      const req = S.passiveLv2KillReq ?? 5;
      if (this._freeStealthKills < req) return;

      this.passiveUnlocked = true;
      this.passiveLv2Unlocked = true; // Merged: Phantom Blink available immediately
      AU.passiveDone = true;

      const hpBonus = Math.floor(
        this.maxHp * ((S.passiveHpBonusPct ?? 0.3) + (S.passiveLv2HpBonusPct ?? 0.2)),
      );
      this.maxHp += hpBonus;
      this.hp += hpBonus;
      this.baseCritChance += S.passiveLv2CritBonus ?? 0.04;

      const unlockText = S.passiveUnlockText ?? "👻 PHANTOM ASSASSIN!";
      spawnFloatingText(unlockText, this.x, this.y - 70, "#fbbf24", 32);
      spawnFloatingText("⚡ BLINK · LIFESTEAL · SPEED", this.x, this.y - 108, "#c4b5fd", 18);
      spawnFloatingText("👻 PHANTOM BLINK UNLOCKED", this.x, this.y - 130, "#93c5fd", 14);
      spawnParticles(this.x, this.y, 60, "#fbbf24");
      spawnParticles(this.x, this.y, 30, "#a855f7");
      addScreenShake(20);
      this.goldenAuraTimer = 5;
      Audio.playAchievement();
      if (typeof Achievements !== "undefined") Achievements.check("free_stealth");
      if (typeof UIManager !== "undefined")
        UIManager.showVoiceBubble(unlockText, this.x, this.y - 40);
      this._showUnlockHint(null); // clear progress hint

      try {
        const saved = getSaveData();
        const set = new Set(saved.unlockedPassives || []);
        set.add(this.charId);
        set.add(`${this.charId}_lv2`);
        updateSaveData({ unlockedPassives: [...set] });
      } catch (e) {
        console.warn("[MTC Save] Could not persist passive unlock:", e);
      }
    }
  }

  // ── Track free-stealth kills toward passive unlock ─────────────────────────
  onKillWhileFreeStealthy() {
    if (this.passiveUnlocked) return;
    if (!this._abilityUnlock.allSkillsDone) return; // SU1+SU2 required first
    this._freeStealthKills++;
    const req = this.stats.passiveLv2KillReq ?? 5;
    spawnFloatingText(
      `👻 ${this._freeStealthKills}/${req} STEALTH KILL`,
      this.x,
      this.y - 55,
      "#c4b5fd",
      14,
    );
    this.checkPassiveUnlock();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // KILL TRACKING — called from enemy.js after each enemy death
  // ──────────────────────────────────────────────────────────────────────────
  addKill(weaponName) {
    // Count free-stealth kills toward passive (only when SU1+SU2 both done)
    if (this._abilityUnlock.allSkillsDone && !this.passiveUnlocked && this.isFreeStealthActive) {
      this.onKillWhileFreeStealthy();
    }

    // 🛡️ STRICT GATE: Weapon mastery requires passive to be fully done
    if (!this._abilityUnlock.passiveDone) return;
    if (this.isWeaponMaster) return; // already awakened, no need to track weapon kills

    const req = BALANCE.characters.kao.weaponMasterReq || 5;

    if (weaponName === "AUTO RIFLE") this.weaponKills.auto++;
    if (weaponName === "SNIPER") this.weaponKills.sniper++;
    if (weaponName === "SHOTGUN") this.weaponKills.shotgun++;

    // ── Progress indicator: แสดง count ทุก kill ที่เกี่ยวข้อง ─────────────
    // ผู้เล่นรู้ว่าตัวเองอยู่ที่ไหน — ลด confusion จาก silent grind
    const progMap = {
      "AUTO RIFLE": { key: "auto", icon: "🔵", label: "RIFLE" },
      SNIPER: { key: "sniper", icon: "🔴", label: "SNIPER" },
      SHOTGUN: { key: "shotgun", icon: "🟠", label: "SHOTGUN" },
    };
    const prog = progMap[weaponName];
    if (prog) {
      const current = this.weaponKills[prog.key];
      if (current < req) {
        spawnFloatingText(
          `${prog.icon} ${prog.label} ${current}/${req}`,
          this.x,
          this.y - 50,
          "#94a3b8",
          13,
        );
      }
    }

    // Unlock only when ALL three weapons have reached the required kills
    if (
      this.weaponKills.auto >= req &&
      this.weaponKills.sniper >= req &&
      this.weaponKills.shotgun >= req
    ) {
      this.isWeaponMaster = true;
      // ✨ [kao_awakened] เช็ค achievement ทุกครั้งที่ weapon master เปลิดล็อค
      if (typeof Achievements !== "undefined")
        Achievements.check("kao_awakened");
      spawnFloatingText(
        GAME_TEXTS.combat.kaoWeaponAwaken,
        this.x,
        this.y - 60,
        "#facc15",
        30,
      );
      if (typeof Audio !== "undefined" && Audio.playLevelUp)
        Audio.playLevelUp();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────────────────────
  update(dt, keys, mouse) {
    const S = BALANCE.characters.kao;

    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    // ── Weapon Switch Flash — visual indicator ใน PlayerRenderer ──────────
    // ตรวจ edge: weapon เปลี่ยนจาก frame ก่อน → set timer 0.5s
    {
      const curWep =
        typeof weaponSystem !== "undefined"
          ? weaponSystem.currentWeapon || "auto"
          : "auto";
      if (this._prevWeaponKey === undefined) this._prevWeaponKey = curWep;
      if (curWep !== this._prevWeaponKey) {
        this._weaponSwitchFlash = 0.5; // PlayerRenderer อ่าน timer นี้
        this._prevWeaponKey = curWep;
      }
      if ((this._weaponSwitchFlash ?? 0) > 0) {
        this._weaponSwitchFlash = Math.max(0, this._weaponSwitchFlash - dt);
      }
    }

    // ── bonusCritFromAuto decay: ลดลง 0.01/s เมื่อถือ weapon อื่น (ไม่ใช่ AUTO RIFLE) ──
    // กัน permanent 50% crit lock จากการ farm auto rifle
    if (this.bonusCritFromAuto > 0 && this.isWeaponMaster) {
      const wepKey =
        typeof weaponSystem !== "undefined"
          ? weaponSystem.currentWeapon
          : "auto";
      if (wepKey !== "auto") {
        this.bonusCritFromAuto = Math.max(
          0,
          this.bonusCritFromAuto - 0.01 * dt,
        );
      }
    }

    // ── SkillUnlock check + persistent hint display ───────────────────────────
    this.checkPassiveUnlock();
    {
      const AU = this._abilityUnlock;
      if (!this.isUnlocked(SKILL.KAO.TELEPORT)) {
        const req = S.su1AmbushDmgReq ?? 200;
        this._showUnlockHint(`🔮 Ambush DMG: ${Math.floor(this._ambushDamageDealt ?? 0)}/${req} → Q Unlock`);
      } else if (!this.isUnlocked(SKILL.KAO.CLONE)) {
        const req = S.su2ChainReq ?? 3;
        this._showUnlockHint(`👥 Stealth Chains: ${this._stealthAttackChains ?? 0}/${req} → E Unlock`);
      } else if (!this.passiveUnlocked) {
        const req = S.passiveLv2KillReq ?? 5;
        this._showUnlockHint(`👻 Stealth Kills: ${this._freeStealthKills}/${req} → PASSIVE`);
      }
    }

    // ── Dash-Stealth — PASSIVE required ───────────────────────────────────
    if (this.passiveUnlocked) {
      const dashNow = this.isDashing;
      if (dashNow && !this._dashWasActive) {
        this.isFreeStealthActive = true;
        this.lastAutoStealthTrigger = 'dash';
        this.freeStealthRemainingTime = S.dashStealthDuration ?? 1.5;
        this.maxFreeStealthDuration = S.dashStealthDuration ?? 1.5;
        this.ambushReady = true;
        spawnFloatingText(
          GAME_TEXTS.combat.kaoFreeStealth,
          this.x,
          this.y - 40,
          "#a855f7",
          18,
        );
      }
      this._dashWasActive = dashNow;
      if (this.freeStealthRemainingTime > 0) {
        this.freeStealthRemainingTime -= dt;
        if (this.freeStealthRemainingTime <= 0) {
          this.freeStealthRemainingTime = 0;
          this.isFreeStealthActive = false;
        }
      }
      if (this.isFreeStealthActive && !this._wasFreeStealthActive) {
        if (typeof Audio !== "undefined" && Audio.playStealth) Audio.playStealth();
      }
      this._wasFreeStealthActive = this.isFreeStealthActive;
    } else {
      this._dashWasActive = this.isDashing;
    }

    // ── Teleport (Q) — SU1 required ───────────────────────────────────────
    const _su1Done = this.isUnlocked(SKILL.KAO.TELEPORT);
    if (_su1Done) {
      // Init: give 3 full charges on first frame after SU1 unlock
      if (!this._teleportInited) {
        this.teleportCharges = this.maxTeleportCharges;
        this._teleportInited = true;
      }
      // ── Tick each timer independently ────────────────────────────
      for (let i = this.teleportTimers.length - 1; i >= 0; i--) {
        this.teleportTimers[i].elapsed += dt;
        if (this.teleportTimers[i].elapsed >= this.teleportTimers[i].max) {
          this.teleportTimers.splice(i, 1);
          this.teleportCharges = Math.min(
            this.maxTeleportCharges,
            this.teleportCharges + 1,
          );
          spawnFloatingText(
            GAME_TEXTS.combat.kaoTeleport,
            this.x,
            this.y - 60,
            "#00e5ff",
            20,
          );
        }
      }
      // ── Use charge ───────────────────────────────────────────────
      if (checkInput("q") && this.teleportCharges > 0) {
        const tpCost = S.teleportEnergyCost ?? 20;
        if ((this.energy ?? 0) < tpCost) {
          spawnFloatingText(
            "⚡ FOCUS LOW!",
            this.x,
            this.y - 50,
            "#facc15",
            16,
          );
          consumeInput("q");
        } else {
          this.energy = Math.max(0, (this.energy ?? 0) - tpCost);
          this.teleportCharges--;
          const newTimer = { elapsed: 0, max: this.teleportCooldown };
          this.teleportTimers.push(newTimer);

          // Penalty: หมดทุก stack → เพิ่ม +5s ให้ timer ที่ recharge ช้าสุด (elapsed น้อยสุด)
          if (this.teleportCharges === 0 && this.teleportTimers.length > 1) {
            let minElapsed = Infinity,
              penaltyIdx = 0;
            this.teleportTimers.forEach((t, i) => {
              if (t.elapsed < minElapsed) {
                minElapsed = t.elapsed;
                penaltyIdx = i;
              } // FIX: ใช้ < แทน > — penalty = timer ที่ยังรีชาร์จช้าที่สุด
            });
            this.teleportTimers[penaltyIdx].max += this.teleportPenalty;
            spawnFloatingText(
              "\u23F3 Penalty!",
              this.x,
              this.y - 80,
              "#ef4444",
              20,
            );
          }

          // ── PHANTOM BLINK: Q during stealth/freeStealthy — requires Lv2 ──
          // Leave a shadow clone at origin, blink to cursor
          // Grant ambush crit window at destination
          const isPhantomBlink =
            this.passiveLv2Unlocked &&
            (S.phantomBlinkEnabled ?? true) &&
            (this.isInvisible || this.isFreeStealthActive);

          const prevX = this.x,
            prevY = this.y;
          spawnParticles(this.x, this.y, 25, "#3b82f6");
          // VFX: shadow ripple at departure
          if (typeof addScreenShake === "function") addScreenShake(2);

          this.x = window.mouse.wx;
          this.y = window.mouse.wy;
          consumeInput("q");
          spawnParticles(this.x, this.y, 25, "#3b82f6");
          if (this._anim) this._anim.dashT = 1;

          if (isPhantomBlink) {
            // ── Leave shadow clone at departure point ──────────
            const shadowClone = new KaoClone(this, 0);
            shadowClone.x = prevX;
            shadowClone.y = prevY;
            shadowClone.alpha = 0.85; // more visible than orbit clones
            shadowClone.isStationary = true; // FIX: ค้างที่จุดออกเดินทาง ไม่ orbit หา owner
            this.clones.push(shadowClone);
            this.clonesActiveTimer = Math.max(
              this.clonesActiveTimer,
              S.cloneDuration ?? 8,
            );
            // ── Ambush window at destination ───────────────────
            this._blinkAmbushTimer = S.phantomBlinkAmbushWindow ?? 2.0;
            this.ambushReady = true;
            // Break stealth after blink (ambush strike)
            this.isFreeStealthActive = false;
            this.freeStealthRemainingTime = 0;
            if (this.isInvisible) this.breakStealth();
            spawnFloatingText(
              "\uD83D\uDC7B PHANTOM BLINK!",
              this.x,
              this.y - 65,
              "#93c5fd",
              24,
            );
            if (typeof addScreenShake === "function") addScreenShake(4);
          }
        } // end energy-sufficient branch
      } // end checkInput('q') && teleportCharges > 0
      if (this._blinkAmbushTimer > 0) this._blinkAmbushTimer -= dt;
    } else if (checkInput("q")) {
      spawnFloatingText(
        `🔒 Ambush DMG: ${Math.floor(this._ambushDamageDealt ?? 0)}/${S.su1AmbushDmgReq ?? 200} → Q`,
        this.x, this.y - 40, "#94a3b8", 13,
      );
      consumeInput("q");
    }

    // ── Clone (E) — SU2 required ────────────────────────────────────────
    const _su2Done = this.isUnlocked(SKILL.KAO.CLONE);
    if (_su2Done) {
      if (this.cloneSkillCooldown > 0) this.cloneSkillCooldown -= dt;
      if (checkInput("e")) {
        if (this.clones.length > 0 && this.clonesActiveTimer > 0) {
          this.clonesActiveTimer = 0; // force expiry block below
          consumeInput("e");
        } else if (this.cloneSkillCooldown <= 0) {
          const cloneCost = S.cloneEnergyCost ?? 30;
          if ((this.energy ?? 0) < cloneCost) {
            spawnFloatingText("⚡ FOCUS LOW!", this.x, this.y - 50, "#facc15", 16);
            consumeInput("e");
          } else {
            this.energy = Math.max(0, (this.energy ?? 0) - cloneCost);
            this.clones = [
              new KaoClone(this, (2 * Math.PI) / 3),
              new KaoClone(this, (4 * Math.PI) / 3),
            ];
            this.clonesActiveTimer = S.cloneDuration ?? 8;
            this.cloneSkillCooldown = this.maxCloneCooldown;
            if (this._anim) this._anim.skillT = 0.5;
            spawnFloatingText(GAME_TEXTS.combat.kaoClones, this.x, this.y - 40, "#3b82f6", 25);
            if (typeof Audio !== "undefined" && Audio.playClone) Audio.playClone();
            consumeInput("e");
          }
        }
      }
    } else if (checkInput("e")) {
      spawnFloatingText(
        `🔒 Stealth Chains: ${this._stealthAttackChains ?? 0}/${S.su2ChainReq ?? 3} → E`,
        this.x, this.y - 40, "#94a3b8", 13,
      );
      consumeInput("e");
    }

    // ── Unrestricted Update Logic — existing clones keep moving ───────────
    if (this.clonesActiveTimer > 0) {
      this.clonesActiveTimer -= dt;
      const aimAngle = Math.atan2(
        window.mouse.wy - this.y,
        window.mouse.wx - this.x,
      );
      if (this.clones[0]) this.clones[0].angleOffset = aimAngle + Math.PI / 1.5;
      if (this.clones[1]) this.clones[1].angleOffset = aimAngle - Math.PI / 1.5;
      this.clones.forEach((c) => c.update(dt));

      // ── Clone Proximity Burst (auto-detonate when enemy too close) ──
      const proxRange = S.cloneProximityRange ?? 90;
      const proxDmgMult = S.cloneProximityDmgMult ?? 0.6;
      const shatterDmgProx =
        BALANCE.characters.kao.weapons.shotgun.damage *
        proxDmgMult *
        (this.damageMultiplier || 1.0);
      for (let ci = this.clones.length - 1; ci >= 0; ci--) {
        const clone = this.clones[ci];
        let triggered = false;
        for (const e of window.enemies || []) {
          if (e.dead) continue;
          if (Math.hypot(e.x - clone.x, e.y - clone.y) < proxRange) {
            triggered = true;
            break;
          }
        }
        if (
          !triggered &&
          window.boss &&
          !window.boss.dead &&
          Math.hypot(window.boss.x - clone.x, window.boss.y - clone.y) <
          proxRange + 20
        ) {
          triggered = true;
        }
        if (triggered) {
          // ── Mini-Phantom Shatter (single clone) ───────────────
          const NUM_RAYS = 8;
          spawnParticles(clone.x, clone.y, 14, "#60a5fa");
          for (let ri = 0; ri < NUM_RAYS; ri++) {
            const angle = ((Math.PI * 2) / NUM_RAYS) * ri;
            const p = new Projectile(
              clone.x,
              clone.y,
              angle,
              760,
              shatterDmgProx,
              "#93c5fd",
              false,
              "player",
              { life: 0.7, bounces: 0 },
            );
            projectileManager.add(p);
          }
          // Swap-and-pop O(1)
          this.clones[ci] = this.clones[this.clones.length - 1];
          this.clones.pop();
          spawnFloatingText(
            "\uD83D\uDCA5 PROXIMITY!",
            clone.x,
            clone.y - 35,
            "#93c5fd",
            15,
          );
          if (typeof Audio !== "undefined" && Audio.playPhantomShatter)
            Audio.playPhantomShatter();
        }
      }
      if (this.clonesActiveTimer <= 0) {
        // ── PHANTOM SHATTER: โคลนหมดเวลา → ระเบิด 8 ทิศ ──────────
        // กระสุน 8 ทิศ ดาเมจเบา (20% ของ shotgun pellet) แต่ AoE ดี
        // ออกแบบให้ reward การวางตำแหน่งโคลนใกล้ศัตรู
        if (this.clones.length > 0) {
          const shatterDmg =
            BALANCE.characters.kao.weapons.shotgun.damage *
            0.35 *
            (this.damageMultiplier || 1.0);
          const NUM_RAYS = 8;
          for (const clone of this.clones) {
            spawnParticles(clone.x, clone.y, 20, "#3b82f6");
            for (let i = 0; i < NUM_RAYS; i++) {
              const angle = ((Math.PI * 2) / NUM_RAYS) * i;
              const p = new Projectile(
                clone.x,
                clone.y,
                angle,
                780, // ความเร็วกระสุน
                shatterDmg,
                "#93c5fd", // สีฟ้าอ่อน — สีของโคลน
                false,
                "player",
                { life: 0.8, bounces: 0 },
              );
              projectileManager.add(p);
            }
          }
          addScreenShake(3);
          spawnFloatingText(
            "💠 PHANTOM SHATTER!",
            this.x,
            this.y - 50,
            "#93c5fd",
            18,
          );
          if (typeof Audio !== "undefined" && Audio.playPhantomShatter)
            Audio.playPhantomShatter();
        }
        this.clones = [];
      }
    }

    // ── Speed Additive: +0.4 หลัง passive Lv1 (additive ไม่ทับ shop bonus) ──
    // inject ก่อน super.update() เพื่อให้ speedBoost ถูกต้องตอนคำนวณ velocity
    const _savedSpeedBoost = this.speedBoost;
    if (this.passiveUnlocked) {
      this.speedBoost =
        (this.speedBoost || 1) + (S.passiveSpeedAdditive ?? 0.4);
    }

    super.update(dt, keys, mouse);

    // Restore speedBoost (stateless per-frame)
    this.speedBoost = _savedSpeedBoost;

    // ── Tick graphBuffTimer ────────────────────────────────
    if ((this.graphBuffTimer ?? 0) > 0)
      this.graphBuffTimer = Math.max(0, this.graphBuffTimer - dt);

    // FIX (SNIPER-CHARGE): shoot() is only called while mouse is held.
    // When player releases, we catch the release here (runs every frame).
    if (this.sniperChargeTime > 0 && window.mouse.left === 0) {
      const wepKey =
        typeof weaponSystem !== "undefined"
          ? weaponSystem.currentWeapon
          : "auto";
      const wep = BALANCE.characters.kao.weapons?.[wepKey];
      if (wep) {
        this.fireWeapon(wep, true);
        const baseCd = wep.cooldown || 0.25;
        this.shootCooldown = baseCd * (this.cooldownMultiplier || 1);
        if (typeof weaponSystem !== "undefined")
          weaponSystem.weaponCooldown = this.shootCooldown;
      }
      this.sniperChargeTime = 0;
    }

    this.updateUI();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DRAW
  // ──────────────────────────────────────────────────────────────────────────
  // draw() ย้ายไป PlayerRenderer._drawKao() แล้ว

  // ──────────────────────────────────────────────────────────────────────────
  // SHOOT — entry point called every frame by the base class tick
  // ──────────────────────────────────────────────────────────────────────────
  shoot(dt) {
    if (typeof weaponSystem === "undefined") return;
    // 🛡️ THE REAL FIX: currentWeapon is a STRING ('auto', 'sniper', 'shotgun')
    const wepKey = weaponSystem.currentWeapon || "auto";
    const wep = BALANCE.characters.kao.weapons[wepKey];
    if (!wep) return;
    const isClick = window.mouse.left === 1;
    const baseCd = wep.cooldown || 0.25;
    // ── Weapon Master Sniper: hold-to-charge mode (Gated) ──
    if (this.passiveUnlocked && this.isWeaponMaster && wepKey === "sniper") {
      if (isClick && this.shootCooldown <= 0) {
        // Accumulate charge time; emit charge particles
        this.sniperChargeTime += dt;
        if (Math.random() < 0.3) spawnParticles(this.x, this.y, 1, "#ef4444");
        return; // don't fire yet
      } else if (!isClick && this.sniperChargeTime > 0) {
        // FIX: fire path ย้ายไป update() แล้ว — skip ที่นี่เพื่อกัน double-fire
        // update() รันก่อน shoot() ทุก frame ดังนั้น sniperChargeTime จะ = 0 แล้วถ้า update() fire ไปแล้ว
        return;
      }
    } else {
      // Reset charge if passive/mastery not met, or weapon switched away
      this.sniperChargeTime = 0;
    }
    // ── Normal fire — guarded by internal cooldown ──
    if (isClick && this.shootCooldown <= 0) {
      this.fireWeapon(wep, false);
      this.shootCooldown = baseCd * (this.cooldownMultiplier || 1);
      weaponSystem.weaponCooldown = this.shootCooldown; // Sync UI
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FIRE WEAPON — handles all Weapon Master buffs, crits, and clone mirrors
  // ──────────────────────────────────────────────────────────────────────────
  fireWeapon(wep, isChargedSniper) {
    let pellets = wep.pellets || 1;
    let spread = wep.spread || 0;
    let baseDmg = wep.damage || 10;
    let color = wep.color || "#ffffff";

    // Read wepKey here so ricochet options, audio, and clone shots all share it
    const wepKey =
      typeof weaponSystem !== "undefined"
        ? weaponSystem.currentWeapon || "auto"
        : "auto";

    // ── 🛡️ Stealth Break & Ambush Logic ──
    // Kao bypasses WeaponSystem.shootSingle() entirely, so this must live here.
    let isAmbush = false;
    if (this.ambushReady) {
      isAmbush = true;
      this.ambushReady = false;
      this.breakStealth();
      spawnParticles(this.x, this.y, 15, "#facc15");
    } else if (this.isInvisible) {
      // Firing while invisible (late frame) still breaks stealth
      this.breakStealth();
    }

    let dmgMult = (this.damageMultiplier || 1.0) * (this.damageBoost || 1.0);
    if (this.isSecondWind)
      dmgMult *= BALANCE.player.secondWindDamageMult || 1.5;
    // ── Graph Buff: ยืนบนเลเซอร์ระยะ 3 → ดาเมจ x1.5 ─────
    if ((this.graphBuffTimer ?? 0) > 0) dmgMult *= 1.5;

    const S_fw = BALANCE.characters.kao;
    const passiveCrit = this.passiveUnlocked
      ? (this.stats.passiveCritBonus ?? 0)
      : 0; // INC-1 fix: was BALANCE.characters.kao.passiveCritBonus
    // stealthChainBonus: +crit when blink ambush window is active (phantom sequence)
    const chainBonus =
      this._blinkAmbushTimer > 0 ? (S_fw.stealthChainBonus ?? 0.18) : 0;
    let critChance =
      (this.baseCritChance || 0) +
      passiveCrit +
      (this.bonusCritFromAuto || 0) +
      chainBonus;

    // Ambush: guaranteed crit
    if (isAmbush) {
      critChance = 2.0; // >1 guarantees crit without double-dip
      color = "#facc15";
      // ── Phantom Blink ambush multiplier (requires Lv2) ─────────────────
      if (this._blinkAmbushTimer > 0 && this.passiveLv2Unlocked) {
        dmgMult *= S_fw.phantomBlinkDmgMult ?? 1.4;
        this._blinkAmbushTimer = 0; // consume window
        if (typeof spawnFloatingText !== "undefined")
          spawnFloatingText(
            "\uD83D\uDC7B BLINK STRIKE!",
            this.x,
            this.y - 60,
            "#c4b5fd",
            22,
          );
      }
    }

    // ── Weapon Master buffs ──
    if (this.passiveUnlocked && this.isWeaponMaster) {
      if (!isAmbush) color = "#facc15";
      if (wep.name === "AUTO RIFLE") {
        // 50% chance to fire 2 bullets instead of 1
        if (Math.random() < 0.5) pellets = 2;
        // Stacking crit bonus (max 50%)
        this.bonusCritFromAuto = Math.min(0.5, this.bonusCritFromAuto + 0.005);
      } else if (wep.name === "SNIPER") {
        critChance += 0.25;
        if (isChargedSniper) {
          // NERF: Max charge 2.5× instead of 4× (was too strong)
          const chargeMult = 1 + Math.min(1.5, this.sniperChargeTime * 2);
          baseDmg *= chargeMult;
          if (!isAmbush) color = "#ef4444";
          pellets = 1;
        }
      } else if (wep.name === "SHOTGUN") {
        // NERF: 1.5× pellets instead of 2× (4 → 6 instead of 8)
        pellets = Math.floor((wep.pellets || 1) * 1.5);
      }
    }

    // NaN guard
    let finalDamage = baseDmg * dmgMult;
    if (!isFinite(finalDamage) || isNaN(finalDamage)) finalDamage = baseDmg;

    let isCrit = Math.random() < critChance;
    if (isCrit) {
      finalDamage *= this.stats.critMultiplier || 3;
      if (this.passiveUnlocked) this.goldenAuraTimer = 1;
      if (typeof Achievements !== "undefined" && Achievements.stats) {
        Achievements.stats.crits++;
        Achievements.check("crit_master");
      }
    }

    // Lifesteal
    if (this.passiveUnlocked) {
      const lifestealRate = this.stats.passiveLifesteal ?? 0.03; // INC-1 fix: was BALANCE.characters.kao.passiveLifesteal
      const healAmount = finalDamage * lifestealRate;
      this.hp = Math.min(this.maxHp, this.hp + healAmount);
      if (Math.random() < 0.3 && typeof spawnFloatingText !== "undefined") {
        spawnFloatingText(
          `+${Math.round(healAmount)}`,
          this.x,
          this.y - 35,
          "#10b981",
          12,
        );
      }
    }

    const aimAngle = Math.atan2(
      window.mouse.wy - this.y,
      window.mouse.wx - this.x,
    );
    const barrelOffset = 28;

    // ── SU1/SU2 AbilityUnlock tracking ────────────────────────────────────
    if (isAmbush) {
      this._ambushDamageDealt = (this._ambushDamageDealt ?? 0) + finalDamage * pellets;
      this._stealthAttackChains = (this._stealthAttackChains ?? 0) + 1;
      this.checkPassiveUnlock();
    }

    for (let i = 0; i < pellets; i++) {
      const spreadAngle = pellets > 1 ? (Math.random() - 0.5) * spread : 0;
      const finalAngle = aimAngle + spreadAngle;
      // FIX: spawn bullet at barrel tip, not player centre
      const sx = this.x + Math.cos(finalAngle) * barrelOffset;
      const sy = this.y + Math.sin(finalAngle) * barrelOffset;

      // FIX: pass ricochet options matching WeaponSystem.shootSingle()
      let projOptions = {};
      if (wepKey === "sniper") {
        projOptions.bounces = 2;
        projOptions.life = 5;
      } else if (wepKey === "shotgun") {
        projOptions.bounces = 1;
        projOptions.life = 2.5;
      }

      const p = new Projectile(
        sx,
        sy,
        finalAngle,
        wep.speed,
        finalDamage,
        color,
        false,
        "player",
        projOptions,
      );
      p.isCrit = isCrit;
      p.weaponKind = wepKey;
      projectileManager.add(p);
    }

    // Clones deal 60% damage — scaling done here, KaoClone.shoot() uses damage as-is
    const cloneDamage = finalDamage * 0.6;
    this.clones.forEach((c) =>
      c.shoot(wep, cloneDamage, color, pellets, spread, wepKey, isCrit),
    );

    // FIX: pass wepKey so Audio plays the correct weapon sound
    if (typeof Audio !== "undefined" && Audio.playShoot)
      Audio.playShoot(wepKey);
    if (this._anim) this._anim.shootT = 1;

    // FIX: velocity-based knockback (was position warp → physics stutter)
    this.vx -= Math.cos(aimAngle) * 50;
    this.vy -= Math.sin(aimAngle) * 50;
    // FIX: trigger animated gun recoil sprite
    if (typeof this.triggerRecoil === "function") this.triggerRecoil();

    // 🔫 Battle Scars: ดีดปลอกกระสุน (Kao bypass shootSingle → ต้องเรียกที่นี่โดยตรง)
    if (typeof shellCasingSystem !== "undefined") {
      const shellCount = wepKey === "shotgun" ? 3 : 1;
      const shellSpeed = wepKey === "sniper" ? 160 : 120;
      for (let _s = 0; _s < shellCount; _s++) {
        shellCasingSystem.spawn(this.x, this.y, aimAngle, shellSpeed);
      }
    }

    spawnParticles(
      this.x + Math.cos(aimAngle) * barrelOffset,
      this.y + Math.sin(aimAngle) * barrelOffset,
      3,
      color,
    );
  }

  takeDamage(amt) {
    // ── Graph Risk: ยืนบนเลเซอร์ → รับดาเมจ x1.5 ─────────
    if (this.onGraph) {
      amt *= 1.5;
      spawnFloatingText("EXPOSED!", this.x, this.y - 40, "#ef4444", 16);
    }
    super.takeDamage(amt);
  }

  // ── HUD Update: cooldown bars สำหรับ Q (teleport) และ E (clone) ──────────
  // FIX: KaoPlayer ไม่มี updateUI() เลย → Q/E CD ไม่แสดงบน HUD
  updateUI() {
    if (typeof UIManager === "undefined" || !UIManager._setCooldownVisual)
      return;

    // Q — Teleport: แสดง CD ของ timer ที่ regen ช้าสุด (timer ที่ elapsed น้อยสุด)
    const S = BALANCE.characters.kao;
    if (this.teleportTimers.length > 0) {
      let minElapsed = Infinity;
      this.teleportTimers.forEach((t) => {
        if (t.elapsed < minElapsed) minElapsed = t.elapsed;
      });
      const slowestTimer = this.teleportTimers.find(
        (t) => t.elapsed === minElapsed,
      );
      const cdRemaining = slowestTimer
        ? slowestTimer.max - slowestTimer.elapsed
        : 0;
      UIManager._setCooldownVisual(
        "q-icon",
        Math.max(0, cdRemaining),
        this.teleportCooldown,
      );
    } else {
      UIManager._setCooldownVisual("q-icon", 0, this.teleportCooldown);
    }

    // E — Clone of Stealth
    UIManager._setCooldownVisual(
      "e-icon",
      Math.max(0, this.cloneSkillCooldown),
      this.maxCloneCooldown,
    );

    // Dash — BUG-5 FIX: PlayerBase ไม่มี updateUI → ต้อง update เองที่นี่
    UIManager._setCooldownVisual(
      "dash-icon",
      Math.max(0, this.cooldowns?.dash ?? 0),
      S.dashCooldown ?? 1.65,
    );

    // Stealth (R-Click) — BUG-5 FIX: comment "handled by PlayerBase" ผิด
    UIManager._setCooldownVisual(
      "stealth-icon",
      Math.max(0, this.cooldowns?.stealth ?? 0),
      S.stealthCooldown ?? 5.5,
    );

    // HP / Energy bars (ผ่าน base class ถ้ามี)
    const hpBar = document.getElementById("hp-bar");
    const enBar = document.getElementById("en-bar");
    if (hpBar) hpBar.style.width = `${(this.hp / this.maxHp) * 100}%`;
    if (enBar) enBar.style.width = `${(this.energy / this.maxEnergy) * 100}%`;

    const levelEl = document.getElementById("player-level");
    if (levelEl) levelEl.textContent = `Lv.${this.level}`;
    const expBar = document.getElementById("exp-bar");
    if (expBar)
      expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;
  }
}
window.KaoPlayer = KaoPlayer;