"use strict";
/**
 * js/entities/player/PatPlayer.js
 * ════════════════════════════════════════════════════════════════════
 * PatPlayer — "แพท" Samurai Ronin (extends Player / PlayerBase)
 * Skills: Zanzo Flash (Q blink+ambush) · Iaido Strike (R 3-phase)
 *         Blade Guard (R-Click reflect) · Katana dual-mode (L-Click)
 *
 * Load after: PlayerBase.js, config.js (BALANCE), effects.js,
 *             audio.js (playZanzo, playIaidoCharge, playIaidoStrike,
 *                       playIaidoSheathe, playReflect, playMeleeHit)
 * Exports: window.PatPlayer
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────────
 *  L.9   class PatPlayer extends Player         constructor / props
 *  L.71  checkPassiveUnlock()                   "Ronin's Edge" — first Iaido hit
 *  L.113 update(dt, keys, mouse)                calls super.update() — minimal override
 *  L.207 _tickBladeGuard(dt, keys, S)           R-Click hold → reflect window
 *  L.233 _endBladeGuard(S)                      release cleanup + cooldown set
 *  L.241 tryReflectProjectile(proj)             called from game.js projectile loop
 *  L.265 _doZanzoFlash(S, mouse)                Q teleport + ghost trail + ambush window
 *  L.317 _beginIaidoCharge(S, mouse)            R — starts charge phase
 *  L.332 _tickIaido(dt, S)                      phase state machine: charge→flash→cinematic
 *  L.366 _executeIaidoFlash(S)                  segment hit detection + bullet-time
 *  L.439 _resolveIaidoDamage(S)                 crit + triggerHitStop + passive unlock
 *  L.498 _doKatanaAttack(S, mouse)              range check → slash wave or melee
 *  L.523 _doSlashWave(S, mouse)                 ranged katana projectile
 *  L.584 _doMeleeCombo(S, mouse)                3-hit arc melee
 *  L.674 updateUI()                             zanzo/iaido/guard/dash cooldown dials
 *  L.721 window.PatPlayer = PatPlayer           export
 *
 * ⚠️  update() calls super.update() — _tickAnim is handled by PlayerBase.
 *     Do NOT call _tickAnim again inside PatPlayer.
 * ⚠️  _zanzoGhosts is a pre-allocated pool (size = S.zanzoGhostCount ?? 4).
 *     Never push/splice — set g.active = false to recycle.
 * ⚠️  _iaidoPhase 'charge' and 'cinematic' both return early from update(),
 *     consuming Q and R-Click inputs silently — do not add skill input here.
 * ⚠️  tryReflectProjectile() is called externally from game.js collision loop,
 *     not from inside PatPlayer.update(). Guard with bladeGuardActive check.
 * ⚠️  triggerHitStop called at L.477 — uses seconds (0.09 / 0.07), not ms.
 * ⚠️  skills.zanzo.cd / skills.iaido.cd use the {cd, max} object pattern
 *     (not flat this.cooldowns.*) — don't mix the two accessor styles.
 * ════════════════════════════════════════════════════════════════════
 */
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  PatPlayer.js — "แพท" Samurai Ronin Character                           ║
// ║  Skills: Zanzo Flash (Q) · Iaido Strike (R) · Blade Guard (R-Click)    ║
// ║  Weapon: Katana — Slash Wave (range) / Melee Combo (close)             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

class PatPlayer extends Player {
  constructor(x = 0, y = 0) {
    super("pat");
    this.x = x;
    this.y = y;
    const S = BALANCE.characters.pat;

    // ── Skill Cooldowns ────────────────────────────────────────────────────
    this.skills = {
      zanzo: { cd: 0, max: S.zanzoCooldown ?? 7.0 },
      iaido: { cd: 0, max: S.iaidoCooldown ?? 14.0 },
    };

    // ── Blade Guard (R-Click) ──────────────────────────────────────────────
    this.bladeGuardActive = false;
    this._bladeGuardDuration = 0; // counts UP while held
    this._bladeGuardCooldown = 0; // counts DOWN after release

    // ── Zanzo Flash (Q) ───────────────────────────────────────────────────
    this._zanzoGhosts = []; // [{x,y,angle,alpha}] object pool (max 4)
    this._zanzoAmbushTimer = 0; // crit window after blink
    // Pre-allocate ghost pool — zero GC in game loop
    for (let i = 0; i < (S.zanzoGhostCount ?? 4); i++) {
      this._zanzoGhosts.push({ x: 0, y: 0, angle: 0, alpha: 0, active: false });
    }

    // ── Iaido Strike (R) — 3-phase state machine ──────────────────────────
    // Phase: 'none' | 'charge' | 'flash' | 'cinematic'
    this._iaidoPhase = "none";
    this._iaidoTimer = 0;
    this._iaidoTargetX = 0;
    this._iaidoTargetY = 0;
    this._iaidoOriginX = 0;
    this._iaidoOriginY = 0;
    this._iaidoHitEnemy = null; // enemy ref ถ้าโดน — ใช้ใน Phase 3
    this._iaidoPendingDamage = 0;

    // ── Melee Combo State ─────────────────────────────────────────────────
    this._meleeComboStep = 0; // 0-2 (3-hit combo)
    this._meleeComboTimer = 0;
    this._meleeCooldownTimer = 0;

    // ── Passive behaviour flags ───────────────────────────────────────────
    this.usesOwnLifesteal = false;
    this.passiveSpeedBonus = 0;

    // ── Invincibility timer (Pat-specific) ───────────────────────────────
    // Counts DOWN — set by point-blank Iaido execute and Perfect Parry.
    // takeDamage() guards against this; isDashing already handled by PlayerBase.
    this._invincibleTimer = 0;

    // ── Passive: RONIN'S EDGE ─────────────────────────────────────────────
    // Unlock: ใช้ Iaido สำเร็จ (โดน enemy) ครั้งแรก
    this._iaidoKillCount = 0;
    this._passiveUnlockTriggered = false;

    // ── Swing Arc (renderer feedback) ─────────────────────────────────────
    // Set when katana swings — PlayerRenderer reads these to flash arc FX
    this._attackArcTimer = 0; // counts down from 0.25 (slash) or 0.18 (melee)
    this._attackArcAngle = 0; // world angle of the swing
    this._isCritArc = false; // drives gold vs ice-blue arc colour

    // ── Melee combo visual step (renderer reads for distinct hit shapes) ──
    // Mirrors _meleeComboStep but persists during arc flash window.
    // 0 = diagonal slash, 1 = thrust, 2 = heavy downward
    this._meleeVisualStep = 0;

    // ── Blade Guard reflect flash ─────────────────────────────────────────
    // Spike to 1.0 on reflect, decay ~0.3s — drives body sheen + katana glow burst
    this._reflectFlashTimer = 0;

    // ── Perfect Parry state ───────────────────────────────────────────────
    // Tap R-Click < perfectParryWindow → Perfect Parry (×4 reflect + i-frame)
    // _bladeGuardHoldTime tracks how long R-Click has been pressed THIS press.
    // Reset to 0 on button release or when guard activates normally.
    this._perfectParryArmed = false;  // true = button just pressed, waiting for release/timeout
    this._perfectParrySucceeded = false; // latches true for 1 frame when parry fires
    this._prevRightHeld = false;      // previous frame R-Click state for edge detection

    // ── Iaido cinematic sheathe ────────────────────────────────────────────
    // 0→1 during cinematic phase (lerps katana to scabbard position at hip)
    this._iaidoCinematicT = 0;
    // Blood trail line: set at iaido flash moment, alpha fades over 0.5s
    this._iaidoBloodTrail = { x1: 0, y1: 0, x2: 0, y2: 0, alpha: 0 };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PASSIVE UNLOCK — Ronin's Edge
  // Trigger: Iaido โดน enemy ครั้งแรก
  // ──────────────────────────────────────────────────────────────────────────
  checkPassiveUnlock() {
    if (this.passiveUnlocked) return;
    if (!this._passiveUnlockTriggered) return;

    this.passiveUnlocked = true;
    const S = this.stats;

    const hpBonus = Math.floor(this.maxHp * (S.passiveHpBonusPct ?? 0.25));
    this.maxHp += hpBonus;
    this.hp += hpBonus;
    this.baseCritChance += S.passiveCritBonus ?? 0.05;

    const unlockText = S.passiveUnlockText ?? "⚔️ โรนินตื่น!";
    spawnFloatingText(unlockText, this.x, this.y - 70, "#7ec8e3", 28);
    spawnFloatingText(
      "⚔️ MELEE DAMAGE +15%",
      this.x,
      this.y - 105,
      "#fbbf24",
      16,
    );
    spawnParticles(this.x, this.y, 50, "#7ec8e3");
    addScreenShake(15);
    this.goldenAuraTimer = 3;
    if (typeof Audio !== "undefined" && Audio.playAchievement)
      Audio.playAchievement();
    if (typeof UIManager !== "undefined")
      UIManager.showVoiceBubble(unlockText, this.x, this.y - 40);

    try {
      const saved = getSaveData();
      const set = new Set(saved.unlockedPassives || []);
      set.add(this.charId);
      updateSaveData({ unlockedPassives: [...set] });
    } catch (e) {
      console.warn("[MTC Save] PatPlayer passive:", e);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────────────────────
  update(dt, keys, mouse) {
    // ── Run PlayerBase update first (movement, dash, energy regen, etc.) ──
    super.update(dt, keys, mouse);

    const S = this.stats;

    // ── Skill cooldown ticks ──────────────────────────────────────────────
    if (this.skills.zanzo.cd > 0) this.skills.zanzo.cd -= dt;
    if (this.skills.iaido.cd > 0) this.skills.iaido.cd -= dt;
    if (this._bladeGuardCooldown > 0) this._bladeGuardCooldown -= dt;
    if (this._zanzoAmbushTimer > 0) this._zanzoAmbushTimer -= dt;
    if (this._meleeCooldownTimer > 0) this._meleeCooldownTimer -= dt;
    if (this._attackArcTimer > 0) this._attackArcTimer -= dt;
    if (this._reflectFlashTimer > 0) this._reflectFlashTimer -= dt;
    if (this._iaidoBloodTrail.alpha > 0) this._iaidoBloodTrail.alpha -= dt / 0.5;
    if (this._invincibleTimer > 0) this._invincibleTimer -= dt;

    // ── Iaido cinematic T — 0→1 over cinematic duration ─────────────────
    if (this._iaidoPhase === "cinematic") {
      const dur = (this.stats?.iaidoCinematicDur ?? 0.55);
      this._iaidoCinematicT = Math.min(1, this._iaidoCinematicT + dt / dur);
    } else {
      this._iaidoCinematicT = 0;
    }

    // ── Zanzo ghost alpha decay (O(n), pool — no alloc) ──────────────────
    const ghostCount = S.zanzoGhostCount ?? 4;
    const ghostFadeDur = S.zanzoGhostFadeDur ?? 0.35;
    for (let i = 0; i < ghostCount; i++) {
      const g = this._zanzoGhosts[i];
      if (!g.active) continue;
      g.alpha -= dt / ghostFadeDur;
      if (g.alpha <= 0) {
        g.alpha = 0;
        g.active = false;
      }
    }

    // ── Iaido Phase State Machine ─────────────────────────────────────────
    this._tickIaido(dt, S);

    // ── Block input during Iaido charge/cinematic ─────────────────────────
    if (this._iaidoPhase === "charge" || this._iaidoPhase === "cinematic") {
      consumeInput("q");
      consumeInput("rightClick");
      return; // ไม่รับ skill input ระหว่าง cinematic
    }

    // ── Blade Guard (R-Click hold) ────────────────────────────────────────
    this._tickBladeGuard(dt, keys, S, mouse);

    // ── Zanzo Flash (Q) ───────────────────────────────────────────────────
    if (
      checkInput("q") &&
      this.skills.zanzo.cd <= 0 &&
      this._iaidoPhase === "none"
    ) {
      const cost = S.qEnergyCost ?? 22;
      if ((this.energy ?? 0) < cost) {
        spawnFloatingText("⚡ FOCUS LOW!", this.x, this.y - 50, "#facc15", 16);
        consumeInput("q");
      } else {
        this.energy = Math.max(0, (this.energy ?? 0) - cost);
        this._doZanzoFlash(S, mouse);
        this.skills.zanzo.cd = this.skills.zanzo.max * this.skillCooldownMult;
        if (this._anim) this._anim.dashT = 1;
        consumeInput("q");
      }
    }

    // ── Iaido Strike (R) — start charge ───────────────────────────────────
    if (
      checkInput("r") &&
      this.skills.iaido.cd <= 0 &&
      this._iaidoPhase === "none"
    ) {
      const cost = S.rEnergyCost ?? 40;
      if ((this.energy ?? 0) < cost) {
        spawnFloatingText("⚡ FOCUS LOW!", this.x, this.y - 50, "#facc15", 16);
        consumeInput("r");
      } else {
        this.energy = Math.max(0, (this.energy ?? 0) - cost);
        this._beginIaidoCharge(S, mouse);
        if (this._anim) this._anim.skillT = (S.iaidoChargeDur ?? 0.45) + 0.3;
        consumeInput("r");
      }
    }

    // ── Auto-shoot: slash wave or melee combo (L-Click gated) ───────────
    const lClick = !!(mouse && mouse.left);
    if (
      lClick &&
      this.cooldowns.shoot <= 0 &&
      this._iaidoPhase === "none" &&
      !this.bladeGuardActive
    ) {
      this._doKatanaAttack(S, mouse);
      if (this._anim) this._anim.shootT = 1;
    }
    if (this.cooldowns.shoot > 0) this.cooldowns.shoot -= dt;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BLADE GUARD — R-Click hold
  // ──────────────────────────────────────────────────────────────────────────
  _tickBladeGuard(dt, keys, S, mouse) {
    const held = !!(mouse && mouse.right);
    const parryWindow = S.perfectParryWindow ?? 0.15;

    // ── Button just pressed: arm Perfect Parry ───────────────────────────
    if (held && !this._prevRightHeld && this._bladeGuardCooldown <= 0) {
      this._perfectParryArmed = true;
      this._bladeGuardDuration = 0; // reset hold timer
    }

    // ── Button held: count duration ──────────────────────────────────────
    if (held && this._bladeGuardCooldown <= 0) {
      this._bladeGuardDuration += dt;

      // Held past parry window → switch to normal Blade Guard
      if (this._perfectParryArmed && this._bladeGuardDuration >= parryWindow) {
        this._perfectParryArmed = false;
        if (!this.bladeGuardActive) {
          this.bladeGuardActive = true;
          spawnFloatingText('🛡 BLADE GUARD', this.x, this.y - 45, '#a8d8ea', 16);
        }
      }

      if (this.bladeGuardActive) {
        // Duration cap for normal guard
        const maxDur = S.bladeGuardMaxDuration ?? 3.0;
        if (this._bladeGuardDuration >= maxDur) {
          this._endBladeGuard(S);
        }
      }
    }

    // ── Button released ──────────────────────────────────────────────────
    if (!held && this._prevRightHeld) {
      if (this._perfectParryArmed && this._bladeGuardCooldown <= 0) {
        // Released within parry window — Perfect Parry armed, waits for incoming proj
        // _perfectParryArmed stays true; tryReflectProjectile handles the actual fire.
        // Set a short window before it expires on its own.
        this._perfectParryArmed = true; // kept until hit or timeout
      }
      if (this.bladeGuardActive) {
        this._endBladeGuard(S);
      }
      this._perfectParryArmed = false; // no projectile hit in time = miss, no penalty
    }

    this._prevRightHeld = held;
  }

  _endBladeGuard(S) {
    this.bladeGuardActive = false;
    this._bladeGuardCooldown = S.bladeGuardCooldown ?? 5.0;
    this._bladeGuardDuration = 0;
  }

  // Called from game.js / ProjectileManager projectile collision loop
  // Returns true if projectile was reflected
  tryReflectProjectile(proj) {
    const S = this.stats;
    const isPerfectParryArmed = this._perfectParryArmed;
    const isGuardActive = this.bladeGuardActive;

    if (!isPerfectParryArmed && !isGuardActive) return false;
    if (proj.owner === 'player') return false;

    const dist2 = Math.hypot(proj.x - this.x, proj.y - this.y);
    if (dist2 > (S.bladeGuardReflectRadius ?? 55)) return false;

    // ── Determine reflect type ────────────────────────────────────────────
    const isPerfect = isPerfectParryArmed;

    // Reflect: flip velocity, mark as player-owned
    proj.vx *= -1;
    proj.vy *= -1;
    proj.owner = 'player';
    proj.team = 'player';
    // isReflected flag → Projectile renderer keeps original color/visual
    proj.isReflected = true;

    if (isPerfect) {
      // ── Perfect Parry ─────────────────────────────────────────────────
      proj.damage *= S.perfectParryReflectMult ?? 4.0;
      this._perfectParryArmed = false;
      this._invincibleTimer = S.perfectParryIFrameDur ?? 0.4;
      this.energy = Math.min(this.maxEnergy ?? 100,
        (this.energy ?? 0) + (S.perfectParryEnergyRestore ?? 20));

      spawnFloatingText('⚔ PERFECT PARRY!', this.x, this.y - 65, '#facc15', 26);
      spawnParticles(proj.x, proj.y, 14, '#facc15');
      this._bladeGuardCooldown = S.bladeGuardCooldown ?? 5.0;

      // Micro bullet-time
      if (typeof TimeManager !== 'undefined') {
        TimeManager.setBulletTime(0.1, S.perfectParryScreenFreeze ?? 0.05);
      }
      addScreenShake(6);
    } else {
      // ── Normal Blade Guard reflect ────────────────────────────────────
      proj.damage *= S.reflectDamageMult ?? 2.0;
      spawnFloatingText('⚔ REFLECT!', this.x, this.y - 55, '#7ec8e3', 20);
      spawnParticles(proj.x, proj.y, 8, '#a8d8ea');
      addScreenShake(3);
    }

    if (typeof Audio !== 'undefined' && Audio.playReflect) Audio.playReflect();
    this._reflectFlashTimer = 0.32;
    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ZANZO FLASH (Q)
  // ──────────────────────────────────────────────────────────────────────────
  _doZanzoFlash(S, mouse) {
    const maxRange = S.zanzoRange ?? 280;
    const dx = mouse.wx - this.x;
    const dy = mouse.wy - this.y;
    const dist = Math.hypot(dx, dy);
    const t = dist > 0 ? Math.min(1, maxRange / dist) : 1;

    // Stamp ghost trail at current positions (4 ghosts spread across path)
    const ghostCount = S.zanzoGhostCount ?? 4;
    for (let i = 0; i < ghostCount; i++) {
      const g = this._zanzoGhosts[i];
      const frac = i / ghostCount;
      g.x = this.x + dx * t * frac;
      g.y = this.y + dy * t * frac;
      g.angle = this.angle;
      g.alpha = 0.7 * (1 - frac * 0.4); // farthest ghost = more transparent
      g.active = true;
    }

    // Teleport
    spawnParticles(this.x, this.y, 15, "#4a90d9");
    this.x += dx * t;
    this.y += dy * t;
    spawnParticles(this.x, this.y, 15, "#7ec8e3");
    addScreenShake(3);

    if (typeof Audio !== "undefined" && Audio.playZanzo) Audio.playZanzo();

    // Check landing: enemy near → ambush crit window
    const landRange = S.zanzoLandingRange ?? 120;
    let hitNearby = false;
    if (window.enemies) {
      for (let i = 0; i < window.enemies.length; i++) {
        const e = window.enemies[i];
        if (e.dead) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) <= landRange) {
          hitNearby = true;
          break;
        }
      }
    }

    if (hitNearby) {
      this._zanzoAmbushTimer = S.zanzoAmbushWindow ?? 1.5;
      this.ambushReady = true;
      spawnFloatingText("⚔ AMBUSH!", this.x, this.y - 60, "#facc15", 22);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IAIDO STRIKE (R) — 3-phase
  // ──────────────────────────────────────────────────────────────────────────
  _beginIaidoCharge(S, mouse) {
    this._iaidoPhase = "charge";
    this._iaidoTimer = 0;
    this._iaidoTargetX = mouse.wx;
    this._iaidoTargetY = mouse.wy;
    this._iaidoOriginX = this.x;
    this._iaidoOriginY = this.y;
    this._iaidoHitEnemy = null;
    this._iaidoPendingDamage = 0;

    spawnFloatingText("…", this.x, this.y - 40, "#e8e8e8", 18);
    if (typeof Audio !== "undefined" && Audio.playIaidoCharge)
      Audio.playIaidoCharge();
  }

  _tickIaido(dt, S) {
    if (this._iaidoPhase === "none") return;

    const chargeDur = S.iaidoChargeDuration ?? 0.6;
    const freezeDur = S.iaidoFreezeDuration ?? 0.5;

    // ── Phase 1: Charge ────────────────────────────────────────────────────
    if (this._iaidoPhase === "charge") {
      this._iaidoTimer += dt;
      if (this._iaidoTimer >= chargeDur) {
        this._iaidoPhase = "flash";
        this._executeIaidoFlash(S);
      }
      return;
    }

    // ── Phase 3: Cinematic freeze ──────────────────────────────────────────
    if (this._iaidoPhase === "cinematic") {
      this._iaidoTimer += dt;
      if (this._iaidoTimer >= freezeDur) {
        // Apply damage + FX
        this._resolveIaidoDamage(S);
        this._iaidoPhase = "none";
        this._iaidoTimer = 0;
        this.skills.iaido.cd = this.skills.iaido.max * this.skillCooldownMult;

        // Resume time
        if (typeof TimeManager !== "undefined") {
          TimeManager.setBulletTime(1.0, 0.3);
        }
      }
    }
  }

  _executeIaidoFlash(S) {
    const dx = this._iaidoTargetX - this._iaidoOriginX;
    const dy = this._iaidoTargetY - this._iaidoOriginY;
    const dist = Math.hypot(dx, dy);
    const maxRange = S.iaidoRange ?? 400;
    const t = dist > 0 ? Math.min(1, maxRange / dist) : 1;

    // White flash line FX — stored for renderer
    this._iaidoFlashLine = {
      x1: this._iaidoOriginX,
      y1: this._iaidoOriginY,
      x2: this._iaidoOriginX + dx * t,
      y2: this._iaidoOriginY + dy * t,
      alpha: 1.0,
    };

    spawnParticles(this.x, this.y, 20, "#ffffff");
    addScreenShake(6);

    // Move Pat
    this.x = this._iaidoOriginX + dx * t;
    this.y = this._iaidoOriginY + dy * t;

    // Hit detection along dash path
    const hitRange = (this.radius ?? 17) + 28;
    let hit = null;
    if (window.enemies) {
      for (let i = 0; i < window.enemies.length; i++) {
        const e = window.enemies[i];
        if (e.dead) continue;
        // Check closest point on segment to enemy
        const ex = e.x - this._iaidoOriginX;
        const ey = e.y - this._iaidoOriginY;
        const segLen = dist * t;
        const segDx = (dx * t) / (segLen || 1);
        const segDy = (dy * t) / (segLen || 1);
        const proj = Math.max(0, Math.min(segLen, ex * segDx + ey * segDy));
        const closestX = this._iaidoOriginX + segDx * proj;
        const closestY = this._iaidoOriginY + segDy * proj;
        if (Math.hypot(e.x - closestX, e.y - closestY) <= hitRange + e.radius) {
          hit = e;
          break;
        }
      }
    }
    // Also check boss — original code only hit enemies, never boss
    if (!hit && window.boss && !window.boss.dead) {
      const bx2 = window.boss.x - this._iaidoOriginX;
      const by2 = window.boss.y - this._iaidoOriginY;
      const segLen = dist * t;
      const segDx = (dx * t) / (segLen || 1);
      const segDy = (dy * t) / (segLen || 1);
      const proj2 = Math.max(0, Math.min(segLen, bx2 * segDx + by2 * segDy));
      const closestX = this._iaidoOriginX + segDx * proj2;
      const closestY = this._iaidoOriginY + segDy * proj2;
      if (Math.hypot(window.boss.x - closestX, window.boss.y - closestY) <= hitRange + (window.boss.radius ?? 50)) {
        hit = window.boss;
      }
    }

    if (hit) {
      // Phase 3: cinematic freeze
      this._iaidoHitEnemy = hit;
      this._iaidoPhase = "cinematic";
      this._iaidoTimer = 0;
      this._iaidoCinematicT = 0; // reset so renderer lerps from 0

      // Blood trail: world-space slash line from origin → Pat's current pos
      this._iaidoBloodTrail.x1 = this._iaidoOriginX;
      this._iaidoBloodTrail.y1 = this._iaidoOriginY;
      this._iaidoBloodTrail.x2 = this.x;
      this._iaidoBloodTrail.y2 = this.y;
      this._iaidoBloodTrail.alpha = 1.0;

      // Slow time
      if (typeof TimeManager !== "undefined") {
        TimeManager.setBulletTime(0.05, 0.1);
      }

      spawnFloatingText("…", this.x, this.y - 45, "#e8e8e8", 22);
      if (typeof Audio !== "undefined" && Audio.playIaidoStrike)
        Audio.playIaidoStrike();
    } else {
      // Miss — end immediately
      this._iaidoPhase = "none";
      this._iaidoTimer = 0;
      this.skills.iaido.cd =
        this.skills.iaido.max * this.skillCooldownMult * 0.5; // miss = half CD
      spawnFloatingText("MISS", this.x, this.y - 40, "#6b7280", 16);
    }

    if (typeof Audio !== "undefined" && Audio.playIaidoStrike)
      Audio.playIaidoStrike();
  }

  _resolveIaidoDamage(S) {
    const e = this._iaidoHitEnemy;
    if (!e || e.dead) return;

    const baseDmg = S.iaidoDamage ?? 160;
    let dmg = baseDmg * this.damageMultiplier;

    // Passive melee bonus
    if (this.passiveUnlocked) {
      dmg *= 1 + (this.stats.passiveMeleeDmgBonus ?? 0.15);
    }

    // ── Point-blank execute check ─────────────────────────────────────────
    // Pat หยุด ≤ iaidoPointBlankRange px จาก target → dmg ×2 + i-frame 1.5s
    const pointBlankRange = S.iaidoPointBlankRange ?? 45;
    const isPointBlank = Math.hypot(this.x - e.x, this.y - e.y) <= pointBlankRange + (e.radius ?? 30);
    if (isPointBlank) {
      dmg *= S.iaidoPointBlankDmgMult ?? 2.0;
      this._invincibleTimer = S.iaidoPointBlankIFrameDur ?? 1.5;
      spawnFloatingText('⚔ EXECUTE!', this.x, this.y - 80, '#ff4500', 28);
      spawnParticles(this.x, this.y, 20, '#ff4500');
    }

    // Crit
    const iaidoCritMult = S.iaidoCritMulti ?? 3.5;
    const critChance =
      (this.baseCritChance ?? 0.08) +
      (this._zanzoAmbushTimer > 0 ? (S.zanzoCritBonus ?? 0.4) : 0);
    const isCrit = Math.random() < critChance;
    if (isCrit) {
      dmg *= iaidoCritMult;
      this.goldenAuraTimer = 2;
    }

    if (!isFinite(dmg) || isNaN(dmg)) dmg = baseDmg;

    e.takeDamage(dmg, this);
    spawnFloatingText(
      `${isCrit ? "⚔ CRIT " : ""}${Math.round(dmg)}`,
      e.x,
      e.y - 40,
      isCrit ? "#facc15" : "#ef4444",
      isCrit ? 26 : 20,
    );

    // Blood burst particles
    const bloodCount = S.iaidoBloodParticles ?? 18;
    spawnParticles(e.x, e.y, bloodCount, "#cc2222");
    addScreenShake(8);
    if (typeof triggerHitStop === 'function') triggerHitStop(isCrit ? 0.09 : 0.07);

    if (typeof Audio !== "undefined" && Audio.playIaidoSheathe)
      Audio.playIaidoSheathe();

    // Passive trigger
    if (!this._passiveUnlockTriggered) {
      this._passiveUnlockTriggered = true;
      this.checkPassiveUnlock();
    }

    // Lifesteal
    if (this.passiveUnlocked) {
      const ls = this.stats.passiveLifesteal ?? 0.02;
      this.hp = Math.min(this.maxHp, this.hp + dmg * ls);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // KATANA ATTACK — dual mode
  // ──────────────────────────────────────────────────────────────────────────
  _doKatanaAttack(S, mouse) {
    // Find nearest enemy to check distance
    let nearestDist = Infinity;
    if (window.enemies) {
      for (let i = 0; i < window.enemies.length; i++) {
        const e = window.enemies[i];
        if (e.dead) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d < nearestDist) nearestDist = d;
      }
    }
    // Also check boss
    if (window.boss && !window.boss.dead) {
      const d = Math.hypot(window.boss.x - this.x, window.boss.y - this.y);
      if (d < nearestDist) nearestDist = d;
    }

    const meleeRange = S.meleeRange ?? 150;
    if (nearestDist <= meleeRange && this._meleeCooldownTimer <= 0) {
      this._doMeleeCombo(S, mouse);
    } else if (nearestDist > meleeRange) {
      this._doSlashWave(S, mouse);
    }
  }

  _doSlashWave(S, mouse) {
    const wep = S.weapons.katana;
    const aimAngle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x);

    let baseDmg = wep.damage * this.damageMultiplier;
    let color = wep.color ?? "#7ec8e3";

    // Zanzo ambush window → crit boost
    const extraCrit =
      this._zanzoAmbushTimer > 0 ? (S.zanzoCritBonus ?? 0.4) : 0;
    const critChance = (this.baseCritChance ?? 0.08) + extraCrit;
    const isCrit = Math.random() < critChance;
    if (isCrit) {
      baseDmg *= this.stats.critMultiplier ?? 2.4;
      color = "#facc15";
      this.goldenAuraTimer = 0.5;
    }
    if (!isFinite(baseDmg)) baseDmg = wep.damage;

    const barrelOffset = 28;
    const sx = this.x + Math.cos(aimAngle) * barrelOffset;
    const sy = this.y + Math.sin(aimAngle) * barrelOffset;

    const p = new Projectile(
      sx,
      sy,
      aimAngle,
      wep.speed ?? 820,
      baseDmg,
      color,
      isCrit,
      "player",
      { life: (wep.range ?? 750) / (wep.speed ?? 820) },
    );
    p.isCrit = isCrit;
    p.weaponKind = "katana";
    projectileManager.add(p);

    // ── Swing arc renderer feedback ──────────────────────────────────────
    this._attackArcTimer = 0.25;
    this._attackArcAngle = aimAngle;
    this._isCritArc = isCrit;
    if (typeof spawnKatanaSlashArc !== "undefined")
      spawnKatanaSlashArc(sx, sy, aimAngle, isCrit);

    // Recoil + cooldown
    this.vx -= Math.cos(aimAngle) * 30;
    this.vy -= Math.sin(aimAngle) * 30;
    this.cooldowns.shoot =
      (wep.cooldown ?? 0.38) * this.cooldownMultiplier * this.skillCooldownMult;

    spawnParticles(sx, sy, 3, color);
    if (typeof Audio !== "undefined" && Audio.playShoot)
      Audio.playShoot("katana");

    if (this.passiveUnlocked) {
      const ls = this.stats.passiveLifesteal ?? 0.02;
      this.hp = Math.min(this.maxHp, this.hp + baseDmg * ls);
    }
  }

  _doMeleeCombo(S, mouse) {
    const aimAngle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x);
    const meleeRange = S.meleeRange ?? 150;
    const baseDmg =
      S.weapons.katana.damage *
      (S.meleeDamageMulti ?? 1.8) *
      this.damageMultiplier *
      (this.passiveUnlocked ? 1 + (S.passiveMeleeDmgBonus ?? 0.15) : 1);

    // Hit all enemies in melee arc
    const targets = [];
    if (window.enemies) {
      for (let i = 0; i < window.enemies.length; i++) {
        const e = window.enemies[i];
        if (e.dead) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) <= meleeRange + e.radius) {
          targets.push(e);
        }
      }
    }
    if (window.boss && !window.boss.dead) {
      if (
        Math.hypot(window.boss.x - this.x, window.boss.y - this.y) <=
        meleeRange + (window.boss.radius ?? 50)
      ) {
        targets.push(window.boss);
      }
    }

    const extraCrit =
      this._zanzoAmbushTimer > 0 ? (S.zanzoCritBonus ?? 0.4) : 0;
    const critChance = (this.baseCritChance ?? 0.08) + extraCrit;

    for (let i = 0; i < targets.length; i++) {
      const e = targets[i];
      let dmg = baseDmg;
      const isCrit = Math.random() < critChance;
      if (isCrit) {
        dmg *= this.stats.critMultiplier ?? 2.4;
        this.goldenAuraTimer = 0.5;
      }
      if (!isFinite(dmg)) dmg = S.weapons.katana.damage;

      e.takeDamage(dmg, this);
      spawnFloatingText(
        `${isCrit ? "⚔ " : ""}${Math.round(dmg)}`,
        e.x,
        e.y - 30,
        isCrit ? "#facc15" : "#7ec8e3",
        isCrit ? 20 : 15,
      );
      spawnParticles(e.x, e.y, 5, "#7ec8e3");

      if (this.passiveUnlocked) {
        const ls = this.stats.passiveLifesteal ?? 0.02;
        this.hp = Math.min(this.maxHp, this.hp + dmg * ls);
      }
    }

    // Combo step
    this._meleeVisualStep = this._meleeComboStep; // snapshot BEFORE increment — renderer reads this during arc flash
    this._meleeComboStep = (this._meleeComboStep + 1) % (S.meleeComboHits ?? 3);
    const comboWindow = S.meleeComboWindow ?? 0.18;

    // ── Swing arc renderer feedback ──────────────────────────────────────
    this._attackArcTimer = 0.18;
    this._attackArcAngle = aimAngle;
    this._isCritArc = this._zanzoAmbushTimer > 0;
    if (typeof spawnKatanaSlashArc !== "undefined")
      spawnKatanaSlashArc(this.x, this.y, aimAngle, this._isCritArc);

    if (this._meleeComboStep === 0) {
      // Combo finished — full cooldown
      this._meleeCooldownTimer = S.meleeCooldown ?? 0.55;
      this.cooldowns.shoot = S.meleeCooldown ?? 0.55;
    } else {
      // Next hit in combo — short window
      this.cooldowns.shoot = comboWindow;
    }

    // Push Pat slightly toward cursor on melee
    this.vx += Math.cos(aimAngle) * 80;
    this.vy += Math.sin(aimAngle) * 80;

    if (typeof Audio !== "undefined" && Audio.playMeleeHit)
      Audio.playMeleeHit();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TAKE DAMAGE — guard invincibility from point-blank Iaido / Perfect Parry
  // ──────────────────────────────────────────────────────────────────────────
  takeDamage(amt, attacker) {
    if (this._invincibleTimer > 0) return; // i-frame active
    super.takeDamage(amt, attacker);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HUD UPDATE
  // ──────────────────────────────────────────────────────────────────────────
  updateUI() {
    if (typeof UIManager === "undefined" || !UIManager._setCooldownVisual)
      return;
    const S = this.stats;

    // Q — Zanzo Flash
    UIManager._setCooldownVisual(
      "q-icon",
      Math.max(0, this.skills.zanzo.cd),
      this.skills.zanzo.max,
    );

    // R — Iaido Strike
    UIManager._setCooldownVisual(
      "r-icon",
      Math.max(0, this.skills.iaido.cd),
      this.skills.iaido.max,
    );

    // R-Click — Blade Guard (show cooldown when not held)
    UIManager._setCooldownVisual(
      "stealth-icon",
      Math.max(0, this._bladeGuardCooldown),
      S.bladeGuardCooldown ?? 5.0,
    );

    // Dash
    UIManager._setCooldownVisual(
      "dash-icon",
      Math.max(0, this.cooldowns?.dash ?? 0),
      S.dashCooldown ?? 1.6,
    );

    // HP / Energy
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

window.PatPlayer = PatPlayer;