'use strict';
/**
 * js/entities/player.js
 *
 * ► Player      — Kao (main character, stealth/crit build)
 * ► PoomPlayer  — Poom (rice-eating / naga-summoning build)
 * ► NagaEntity  — Poom's snake summon
 * ► Drone       — Player's AI companion drone
 * ► BarkWave    — Boss bark projectile (lives here per refactor plan)
 *
 * Depends on: base.js  (Entity, _standAura_update, _standAura_draw)
 *
 * ────────────────────────────────────────────────────────────────
 * FIXES (QA Integrity Report)
 * ────────────────────────────────────────────────────────────────
 * ✅ BUG 2  — Mobile Patch: Removed redundant velocity calculation that
 *             double-applied joystick acceleration (2× speed on touch).
 *             The patch now only zeroes WASD keys before calling __origUpdate,
 *             letting the original update handle the joystick read once.
 *
 * ✅ WARN 5 — DRY Principle: Extracted the ~60-line obstacle-awareness block
 *             (was copy-pasted verbatim into both Player.update and
 *             PoomPlayer.update) into a single shared implementation at
 *             Player.prototype.checkObstacleProximity(ax, ay, dt, particleColor).
 *             PoomPlayer.prototype gets the same reference so both character
 *             classes call identical logic; only the particle tint differs
 *             (#93c5fd for Kao, #fcd34d for Poom).
 */

// ════════════════════════════════════════════════════════════
// PLAYER (generic — supports any charId from BALANCE.characters)
// ════════════════════════════════════════════════════════════
class Player extends Entity {
    constructor(charId = 'kao') {
        const stats = BALANCE.characters[charId];
        super(0, 0, stats.radius);

        this.charId = charId;
        this.stats  = stats;

        this.hp        = stats.hp;
        this.maxHp     = stats.maxHp;
        this.energy    = stats.energy;
        this.maxEnergy = stats.maxEnergy;

        this.cooldowns = { dash: 0, stealth: 0, shoot: 0 };

        this.isDashing     = false;
        this.isInvisible   = false;
        this.ambushReady   = false;
        this.walkCycle     = 0;

        this.damageBoost     = 1;
        this.speedBoost      = 1;
        this.speedBoostTimer = 0;
        this.afterImages     = [];   // legacy dash ghost (kept for compat)

        // ── Stand-Aura & Afterimage system ────────────────────
        this.afterimages   = [];     // JoJo-esque ghost frames
        this.auraRotation  = 0;      // radians — driven by _standAura_update()
        this._auraFrame    = 0;      // frame counter for spawn-interval logic

        this.onGraph       = false;
        this.isConfused    = false; this.confusedTimer = 0;
        this.isBurning     = false; this.burnTimer = 0; this.burnDamage = 0;

        this.level          = 1;
        this.exp            = 0;
        this.expToNextLevel = stats.expToNextLevel;

        this.baseCritChance  = stats.baseCritChance;
        this.passiveUnlocked = false;
        this.stealthUseCount = 0;
        this.goldenAuraTimer = 0;

        // ── Collision Awareness state ─────────────────────────
        // obstacleBuffTimer:   seconds remaining on the consolation speed buff.
        //                      Set by the obstacle proximity check each frame;
        //                      decays at 1:1 with dt.
        // lastObstacleWarning: Date.now() timestamp of the last warning bubble.
        //                      Compared against BALANCE.player.obstacleWarningCooldown
        //                      to rate-limit voice bubble spam.
        this.obstacleBuffTimer     = 0;
        this.lastObstacleWarning   = 0;

        // ── Restore persistent passive ─────────────────────────
        try {
            const saved = getSaveData();
            const myId  = this.charId;
            if (Array.isArray(saved.unlockedPassives) && saved.unlockedPassives.includes(myId)) {
                this.passiveUnlocked = true;
                const hpBonus = Math.floor(this.maxHp * stats.passiveHpBonusPct);
                this.maxHp += hpBonus;
                this.hp    += hpBonus;
                console.log(`[MTC Save] Passive restored for '${myId}'.`);
            }
        } catch (e) {
            console.warn('[MTC Save] Could not restore passive:', e);
        }
    }

    get S() { return this.stats; }

    update(dt, keys, mouse) {
        const S   = this.stats;
        const PHY = BALANCE.physics;

        if (this.isBurning) {
            this.burnTimer -= dt;
            this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15,15), this.y + rand(-15,15), 1, '#f59e0b');
        }
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) { this.isConfused = false; this.confusedTimer = 0; }
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
        if (this.goldenAuraTimer > 0) {
            this.goldenAuraTimer -= dt;
            if (Math.random() < 0.5) spawnParticles(this.x + rand(-25,25), this.y + rand(-25,25), 1, '#fbbf24');
        }

        let ax = 0, ay = 0, isTouchMove = false;
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            ax = window.touchJoystickLeft.nx; ay = window.touchJoystickLeft.ny; isTouchMove = true;
        } else {
            if (keys.w) ay -= 1; if (keys.s) ay += 1;
            if (keys.a) ax -= 1; if (keys.d) ax += 1;
        }
        if (this.isConfused) { ax *= -1; ay *= -1; }
        if (ax || ay) {
            if (!isTouchMove) { const len = Math.hypot(ax, ay); ax /= len; ay /= len; }
            this.walkCycle += dt * 15;
        } else { this.walkCycle = 0; }

        let speedMult = (this.isInvisible ? S.stealthSpeedBonus : 1) * this.speedBoost;
        if (this.speedBoostTimer > 0) speedMult += S.speedOnHit / S.moveSpeed;
        // [OBSTACLE BUFF] Consolation speed multiplier — active when player is scraping
        // a map object. Applied here so the cap in the block below respects the boost.
        if (this.obstacleBuffTimer > 0) speedMult *= BALANCE.player.obstacleBuffPower;

        if (!this.isDashing) {
            this.vx += ax * PHY.acceleration * dt;
            this.vy += ay * PHY.acceleration * dt;
            this.vx *= PHY.friction;
            this.vy *= PHY.friction;
            const cs = Math.hypot(this.vx, this.vy);
            if (cs > S.moveSpeed * speedMult) {
                const scale = S.moveSpeed * speedMult / cs;
                this.vx *= scale; this.vy *= scale;
            }
        }
        this.applyPhysics(dt);
        this.x = clamp(this.x, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        this.y = clamp(this.y, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);

        // ── [OBSTACLE AWARENESS] ──────────────────────────────
        // ✅ WARN 5 FIX: logic extracted to checkObstacleProximity() below.
        // Particle colour '#93c5fd' = Tailwind blue-300 (Kao's palette).
        if (!this.isDashing) {
            this.checkObstacleProximity(ax, ay, dt, '#93c5fd');
        }

        if (this.cooldowns.dash    > 0) this.cooldowns.dash    -= dt;
        if (this.cooldowns.stealth > 0) this.cooldowns.stealth -= dt;

        if (keys.space && this.cooldowns.dash <= 0) { this.dash(ax || 1, ay || 0); keys.space = 0; }

        if (mouse.right && this.cooldowns.stealth <= 0 && !this.isInvisible && this.energy >= S.stealthCost) {
            this.activateStealth(); mouse.right = 0;
        }
        if (this.isInvisible) {
            this.energy -= S.stealthDrain * dt;
            if (this.energy <= 0) { this.energy = 0; this.breakStealth(); }
        } else {
            this.energy = Math.min(this.maxEnergy, this.energy + S.energyRegen * dt);
        }

        if (window.touchJoystickRight && window.touchJoystickRight.active) {
            this.angle = Math.atan2(window.touchJoystickRight.ny, window.touchJoystickRight.nx);
        } else {
            this.angle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x);
        }

        for (let i = this.afterImages.length - 1; i >= 0; i--) {
            this.afterImages[i].life -= dt * 5;
            if (this.afterImages[i].life <= 0) this.afterImages.splice(i, 1);
        }

        // ── Stand-Aura & Afterimage system update ─────────────
        _standAura_update(this, dt);

        this.updateUI();
    }

    dash(ax, ay) {
        const S = this.stats;
        this.isDashing = true;
        this.cooldowns.dash = S.dashCooldown;
        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        this.vx = Math.cos(angle) * (S.dashDistance / 0.2);
        this.vy = Math.sin(angle) * (S.dashDistance / 0.2);
        for (let i = 0; i < 5; i++) setTimeout(() => {
            this.afterImages.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
        }, i * 30);
        spawnParticles(this.x, this.y, 15, '#60a5fa');
        Audio.playDash();
        Achievements.stats.dashes++; Achievements.check('speedster');
        setTimeout(() => { this.isDashing = false; }, 200);
    }

    activateStealth() {
        const S = this.stats;
        this.isInvisible = true; this.ambushReady = true;
        this.energy -= S.stealthCost;
        this.stealthUseCount++;
        spawnParticles(this.x, this.y, 25, '#facc15');
        showVoiceBubble('เข้าโหมดซุ่ม!', this.x, this.y - 40);
        this.checkPassiveUnlock();
        Achievements.stats.stealths++; Achievements.check('ghost');
    }

    breakStealth() {
        this.isInvisible = false;
        this.cooldowns.stealth = this.stats.stealthCooldown;
    }

    checkPassiveUnlock() {
        const S = this.stats;
        if (!this.passiveUnlocked && this.level >= S.passiveUnlockLevel && this.stealthUseCount >= S.passiveUnlockStealthCount) {
            this.passiveUnlocked = true;
            const hpBonus = Math.floor(this.maxHp * S.passiveHpBonusPct);
            this.maxHp += hpBonus; this.hp += hpBonus;
            spawnFloatingText('ปลดล็อค: ซุ่มเสรี!', this.x, this.y - 60, '#fbbf24', 30);
            spawnParticles(this.x, this.y, 50, '#fbbf24');
            addScreenShake(15); this.goldenAuraTimer = 3;
            Audio.playAchievement();
            showVoiceBubble("ทักษะ 'ซุ่มเสรี' ปลดล็อคแล้ว!", this.x, this.y - 40);
            try {
                const saved = getSaveData();
                const set   = new Set(saved.unlockedPassives || []);
                set.add(this.charId);
                updateSaveData({ unlockedPassives: [...set] });
            } catch (e) {
                console.warn('[MTC Save] Could not persist passive unlock:', e);
            }
        }
    }

    gainExp(amount) {
        this.exp += amount;
        spawnFloatingText(`+${amount} EXP`, this.x, this.y - 50, '#8b5cf6', 14);
        while (this.exp >= this.expToNextLevel) this.levelUp();
        this.updateUI();
    }

    levelUp() {
        const S = this.stats;
        this.exp -= this.expToNextLevel;
        this.level++;
        this.expToNextLevel = Math.floor(this.expToNextLevel * S.expLevelMult);
        this.hp = this.maxHp; this.energy = this.maxEnergy;
        spawnFloatingText(`LEVEL ${this.level}!`, this.x, this.y - 70, '#facc15', 35);
        spawnParticles(this.x, this.y, 40, '#facc15');
        addScreenShake(12); Audio.playLevelUp();
        this.checkPassiveUnlock();
    }

    takeDamage(amt) {
        const S = this.stats;
        if (this.isDashing) return;
        if (this.onGraph) { amt *= 2; spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16); }
        this.hp -= amt; this.hp = Math.max(0, this.hp);
        spawnFloatingText(Math.round(amt), this.x, this.y - 30, '#ef4444');
        spawnParticles(this.x, this.y, 8, '#ef4444');
        addScreenShake(8); Audio.playHit();
        Achievements.stats.damageTaken += amt;
        if (this.hp <= 0) window.endGame('defeat');
    }

    dealDamage(baseDamage) {
        const S = this.stats;
        let damage = baseDamage, isCrit = false;
        let critChance = this.baseCritChance;
        if (this.passiveUnlocked) critChance += S.passiveCritBonus;
        if (Math.random() < critChance) {
            damage *= S.critMultiplier; isCrit = true;
            if (this.passiveUnlocked) this.goldenAuraTimer = 1;
            Achievements.stats.crits++; Achievements.check('crit_master');
        }
        if (this.passiveUnlocked) {
            const healAmount = damage * S.passiveLifesteal;
            this.hp = Math.min(this.maxHp, this.hp + healAmount);
            if (Math.random() < 0.3) spawnFloatingText(`+${Math.round(healAmount)}`, this.x, this.y - 35, '#10b981', 12);
        }
        return { damage, isCrit };
    }

    heal(amt) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
        spawnFloatingText(`+${amt} HP`, this.x, this.y - 30, '#10b981');
        spawnParticles(this.x, this.y, 10, '#10b981'); Audio.playHeal();
    }

    addSpeedBoost() { this.speedBoostTimer = this.stats.speedOnHitDuration; }

    draw() {
        const S = this.stats;

        // ── Stand-Aura & Afterimage (drawn first — behind everything) ──
        _standAura_draw(this, this.charId || 'kao');

        // Legacy dash afterImages (blue flash — kept for compat)
        for (const img of this.afterImages) {
            const screen = worldToScreen(img.x, img.y);
            CTX.save(); CTX.translate(screen.x, screen.y); CTX.rotate(img.angle);
            CTX.globalAlpha = img.life * 0.3; CTX.fillStyle = '#60a5fa';
            CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 8); CTX.fill(); CTX.restore();
        }
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.3)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 25, 18, 8, 0, 0, Math.PI * 2); CTX.fill();

        if (this.passiveUnlocked) {
            const auraSize  = 35 + Math.sin(performance.now() / 200) * 5;
            const auraAlpha = 0.3 + Math.sin(performance.now() / 300) * 0.1;
            CTX.save(); CTX.globalAlpha = auraAlpha; CTX.strokeStyle = '#fbbf24';
            CTX.lineWidth = 3; CTX.shadowBlur = 20; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, auraSize, 0, Math.PI * 2); CTX.stroke(); CTX.restore();
        }

        if (this.isConfused) { CTX.font = 'bold 24px Arial'; CTX.fillText('😵', screen.x, screen.y - 40); }
        if (this.isBurning)  { CTX.font = 'bold 20px Arial'; CTX.fillText('🔥', screen.x + 20, screen.y - 35); }

        CTX.save(); CTX.translate(screen.x, screen.y); CTX.rotate(this.angle);
        CTX.globalAlpha = this.isInvisible ? 0.3 : 1;
        const w = Math.sin(this.walkCycle) * 8;
        CTX.fillStyle = '#1e293b';
        CTX.beginPath(); CTX.ellipse(5 + w, 10, 6, 4, 0, 0, Math.PI * 2); CTX.fill();
        CTX.beginPath(); CTX.ellipse(5 - w, -10, 6, 4, 0, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#f8fafc'; CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 6); CTX.fill();
        CTX.fillStyle = '#1e40af';
        CTX.beginPath(); CTX.moveTo(0,-12); CTX.lineTo(-3,0); CTX.lineTo(-5,12);
        CTX.lineTo(0,15); CTX.lineTo(5,12); CTX.lineTo(3,0); CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#2563eb'; CTX.font = 'bold 8px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillText('MTC', 0, -5);
        CTX.fillStyle = '#ffdfc4'; CTX.beginPath(); CTX.arc(0, 0, 13, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#0f172a';
        CTX.beginPath(); CTX.arc(0,0,14,Math.PI*1.1,Math.PI*2.9); CTX.fill();
        CTX.beginPath(); CTX.arc(-8,-5,6,0,Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.arc( 8,-5,6,0,Math.PI*2); CTX.fill();
        CTX.strokeStyle = '#333'; CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.arc(-6,0,5,0,Math.PI*2);
        CTX.moveTo(7,0); CTX.arc(6,0,5,0,Math.PI*2);
        CTX.moveTo(-1,0); CTX.lineTo(1,0); CTX.stroke();
        const t = performance.now() / 500;
        const gl = Math.abs(Math.sin(t)) * 0.8 + 0.2;
        CTX.fillStyle = `rgba(255,255,255,${gl})`;
        CTX.fillRect(-8,-2,3,2); CTX.fillRect(4,-2,3,2);
        CTX.fillStyle = '#ffdfc4'; CTX.beginPath(); CTX.arc(10,15,5,0,Math.PI*2); CTX.fill();
        if (typeof weaponSystem !== 'undefined') weaponSystem.drawWeaponOnPlayer(this);
        CTX.fillStyle = '#ffdfc4'; CTX.beginPath(); CTX.arc(8,-15,5,0,Math.PI*2); CTX.fill();
        CTX.restore();

        if (this.level > 1) {
            CTX.fillStyle = 'rgba(139,92,246,0.9)';
            CTX.beginPath(); CTX.arc(screen.x+22, screen.y-22, 10, 0, Math.PI*2); CTX.fill();
            CTX.fillStyle = '#fff'; CTX.font = 'bold 10px Arial';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(this.level, screen.x+22, screen.y-22);
        }
    }

    updateUI() {
        const S = this.stats;
        const hpEl = document.getElementById('hp-bar');
        const enEl = document.getElementById('en-bar');
        if (hpEl) hpEl.style.width = `${this.hp / this.maxHp * 100}%`;
        if (enEl) enEl.style.width = `${this.energy / this.maxEnergy * 100}%`;

        const dp = Math.min(100, (1 - this.cooldowns.dash / S.dashCooldown) * 100);
        const dashEl = document.getElementById('dash-cd');
        if (dashEl) dashEl.style.height = `${100 - dp}%`;

        const sEl = document.getElementById('stealth-icon');
        const sCd = document.getElementById('stealth-cd');
        if (this.isInvisible) {
            sEl?.classList.add('active');
            if (sCd) sCd.style.height = '0%';
        } else {
            sEl?.classList.remove('active');
            if (sCd) {
                const sp = Math.min(100, (1 - this.cooldowns.stealth / S.stealthCooldown) * 100);
                sCd.style.height = `${100 - sp}%`;
            }
        }
        const levelEl = document.getElementById('player-level');
        if (levelEl) levelEl.textContent = `Lv.${this.level}`;
        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;

        const passiveEl = document.getElementById('passive-skill');
        if (passiveEl) {
            if (this.passiveUnlocked) {
                passiveEl.classList.add('unlocked');
                passiveEl.style.opacity = '1';
            } else if (this.level >= 3) {
                passiveEl.style.display = 'flex';
                passiveEl.style.opacity = '0.5';
                const skillName = passiveEl.querySelector('.skill-name');
                if (skillName) skillName.textContent = `${this.stealthUseCount}/5`;
            }
        }
    }
}

// ════════════════════════════════════════════════════════════
// ✅ WARN 5 FIX — Shared obstacle-awareness prototype method
// ════════════════════════════════════════════════════════════
/**
 * Player.prototype.checkObstacleProximity(ax, ay, dt, particleColor)
 *
 * Encapsulates the full obstacle-awareness subsystem that was previously
 * copy-pasted verbatim into both Player.update() and PoomPlayer.update().
 *
 * @param {number} ax            - Normalised horizontal move input this frame
 *                                 (used to determine whether the entity is
 *                                 "actively moving" before firing warnings).
 * @param {number} ay            - Normalised vertical move input this frame.
 * @param {number} dt            - Scaled frame delta (seconds) — used to decay
 *                                 obstacleBuffTimer at wall-clock speed.
 * @param {string} particleColor - CSS colour for speed-line particles while the
 *                                 consolation buff is active.  Callers supply
 *                                 their character-specific tint:
 *                                   • '#93c5fd'  (blue-300)  for Kao / Player
 *                                   • '#fcd34d'  (amber-300) for Poom
 *
 * Called on `this` — works for both Player and PoomPlayer because
 * PoomPlayer.prototype.checkObstacleProximity is aliased to this function
 * immediately after the PoomPlayer class definition.
 *
 * Reads / writes these instance properties (must be initialised in the
 * constructor of each character class):
 *   • this.obstacleBuffTimer    {number}
 *   • this.lastObstacleWarning  {number}   (Date.now() ms)
 *   • this.radius               {number}   (from Entity)
 *   • this.x / this.y           {number}
 *
 * Map object source priority (same as the original implementations):
 *   1. mapSystem.getObjects()       — preferred dynamic list
 *   2. mapSystem.objects            — direct array fallback
 *   3. mapSystem.solidObjects       — alternate property name fallback
 *   4. BALANCE.map.wallPositions    — static boundary walls (always appended)
 */
Player.prototype.checkObstacleProximity = function(ax, ay, dt, particleColor) {
    const OB = BALANCE.player;

    // ── Collect collidable rectangles from all available sources ──
    let mapObjs = [];
    if (window.mapSystem) {
        if      (typeof mapSystem.getObjects === 'function') mapObjs = mapSystem.getObjects();
        else if (Array.isArray(mapSystem.objects))           mapObjs = mapSystem.objects;
        else if (Array.isArray(mapSystem.solidObjects))      mapObjs = mapSystem.solidObjects;
    }
    if (Array.isArray(BALANCE.map.wallPositions)) {
        mapObjs = mapObjs.concat(BALANCE.map.wallPositions);
    }

    // Player is "moving" when pressing at least one directional input this frame
    const isMoving = (ax !== 0 || ay !== 0);

    let scraping = false;  // true if player surface is touching an object this frame

    for (const obj of mapObjs) {
        if (!obj || obj.x === undefined || obj.y === undefined) continue;
        const oL = obj.x;
        const oT = obj.y;
        const oR = oL + (obj.w || 0);
        const oB = oT + (obj.h || 0);

        // Closest point on the AABB rectangle to the player centre
        const closestX = Math.max(oL, Math.min(this.x, oR));
        const closestY = Math.max(oT, Math.min(this.y, oB));
        const d        = Math.hypot(this.x - closestX, this.y - closestY);

        // Scraping threshold: player radius + 4 px "skin" tolerance
        const scrapeThreshold   = this.radius + 4;
        // Warning threshold: larger range — fires before contact
        const warningThreshold  = this.radius + OB.obstacleWarningRange;

        if (d < scrapeThreshold && isMoving) {
            // Player surface is in contact with object while pushing into it
            scraping = true;
        }

        if (d < warningThreshold && isMoving) {
            // Trigger warning bubble (rate-limited)
            const now = Date.now();
            if (now - this.lastObstacleWarning > OB.obstacleWarningCooldown) {
                this.lastObstacleWarning = now;
                showVoiceBubble('Careful!', this.x, this.y - 50);
            }
            break; // one nearby object is enough to decide — stop iterating
        }
    }

    // Grant / maintain consolation buff while actively scraping
    if (scraping) {
        this.obstacleBuffTimer = OB.obstacleBuffDuration;
    }

    // Decay buff and emit speed-line particles while active.
    // Faint particles at ~30 % chance per frame — subtle rather than a full
    // burst every frame so the effect doesn't overpower combat visuals.
    if (this.obstacleBuffTimer > 0) {
        this.obstacleBuffTimer -= dt;
        if (Math.random() < 0.3) {
            spawnParticles(
                this.x + rand(-this.radius, this.radius),
                this.y + rand(-this.radius, this.radius),
                1, particleColor
            );
        }
    }
};

// ════════════════════════════════════════════════════════════
// 🌾 POOM PLAYER
// ════════════════════════════════════════════════════════════
class PoomPlayer extends Entity {
    constructor() {
        const stats = BALANCE.characters.poom;
        super(0, 0, stats.radius);

        this.charId = 'poom';
        this.stats  = stats;

        this.hp = stats.hp; this.maxHp = stats.maxHp;
        this.energy = stats.energy; this.maxEnergy = stats.maxEnergy;

        this.cooldowns = { dash: 0, eat: 0, naga: 0, shoot: 0 };

        this.isDashing = false; this.isInvisible = false; this.ambushReady = false;
        this.passiveUnlocked = false; this.stealthUseCount = 0; this.goldenAuraTimer = 0;

        this.walkCycle = 0;
        this.damageBoost = 1; this.speedBoost = 1; this.speedBoostTimer = 0;
        this.afterImages = [];   // legacy dash ghost (kept for compat)

        // ── Stand-Aura & Afterimage system ────────────────────
        this.afterimages   = [];     // JoJo-esque ghost frames
        this.auraRotation  = 0;      // radians
        this._auraFrame    = 0;      // frame counter

        this.onGraph = false;
        this.isConfused = false; this.confusedTimer = 0;
        this.isBurning  = false; this.burnTimer = 0; this.burnDamage = 0;

        this.isEatingRice   = false; this.eatRiceTimer = 0;
        this.currentSpeedMult = 1;
        this.nagaCount = 0;

        // ── Collision Awareness state (mirrors Player) ────────
        this.obstacleBuffTimer     = 0;
        this.lastObstacleWarning   = 0;

        this.level = 1; this.exp = 0;
        this.expToNextLevel = stats.expToNextLevel;
        this.baseCritChance = stats.critChance;
    }

    update(dt, keys, mouse) {
        const S   = this.stats;
        const PHY = BALANCE.physics;

        if (this.isBurning) {
            this.burnTimer -= dt; this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15,15), this.y + rand(-15,15), 1, '#f59e0b');
        }
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) { this.isConfused = false; this.confusedTimer = 0; }
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;

        if (this.isEatingRice) {
            this.eatRiceTimer -= dt;
            this.currentSpeedMult = S.eatRiceSpeedMult;
            if (Math.random() < 0.2) spawnParticles(this.x + rand(-20,20), this.y + rand(-20,20), 1, '#fbbf24');
            if (this.eatRiceTimer <= 0) {
                this.isEatingRice = false;
                this.currentSpeedMult = 1;
                spawnFloatingText('หมดฤทธิ์!', this.x, this.y - 40, '#94a3b8', 14);
            }
        }

        let ax = 0, ay = 0, isTouchMove = false;
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            ax = window.touchJoystickLeft.nx; ay = window.touchJoystickLeft.ny; isTouchMove = true;
        } else {
            if (keys.w) ay -= 1; if (keys.s) ay += 1;
            if (keys.a) ax -= 1; if (keys.d) ax += 1;
        }
        if (this.isConfused) { ax *= -1; ay *= -1; }
        if (ax || ay) {
            if (!isTouchMove) { const len = Math.hypot(ax, ay); ax /= len; ay /= len; }
            this.walkCycle += dt * 15;
        } else { this.walkCycle = 0; }

        let speedMult = this.currentSpeedMult * this.speedBoost;
        if (this.speedBoostTimer > 0) speedMult += S.speedOnHit / S.moveSpeed;
        // [OBSTACLE BUFF] Consolation speed multiplier — mirrors Player logic
        if (this.obstacleBuffTimer > 0) speedMult *= BALANCE.player.obstacleBuffPower;

        if (!this.isDashing) {
            this.vx += ax * PHY.acceleration * dt;
            this.vy += ay * PHY.acceleration * dt;
            this.vx *= PHY.friction;
            this.vy *= PHY.friction;
            const cs = Math.hypot(this.vx, this.vy);
            if (cs > S.moveSpeed * speedMult) {
                const scale = S.moveSpeed * speedMult / cs;
                this.vx *= scale; this.vy *= scale;
            }
        }
        this.applyPhysics(dt);
        this.x = clamp(this.x, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        this.y = clamp(this.y, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);

        // ── [OBSTACLE AWARENESS] ──────────────────────────────
        // ✅ WARN 5 FIX: logic extracted to checkObstacleProximity() above.
        // Particle colour '#fcd34d' = Tailwind amber-300 (Poom's palette).
        if (!this.isDashing) {
            this.checkObstacleProximity(ax, ay, dt, '#fcd34d');
        }

        if (this.cooldowns.dash  > 0) this.cooldowns.dash  -= dt;
        if (this.cooldowns.eat   > 0) this.cooldowns.eat   -= dt;
        if (this.cooldowns.naga  > 0) this.cooldowns.naga  -= dt;
        if (this.cooldowns.shoot > 0) this.cooldowns.shoot -= dt;

        if (keys.space && this.cooldowns.dash <= 0) { this.dash(ax || 1, ay || 0); keys.space = 0; }
        if (keys.e && this.cooldowns.eat <= 0 && !this.isEatingRice) { this.eatRice(); keys.e = 0; }
        if (keys.r && this.cooldowns.naga <= 0) { this.summonNaga(); keys.r = 0; }

        this.energy = Math.min(this.maxEnergy, this.energy + S.energyRegen * dt);

        if (window.touchJoystickRight && window.touchJoystickRight.active) {
            this.angle = Math.atan2(window.touchJoystickRight.ny, window.touchJoystickRight.nx);
        } else {
            this.angle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x);
        }

        for (let i = this.afterImages.length - 1; i >= 0; i--) {
            this.afterImages[i].life -= dt * 5;
            if (this.afterImages[i].life <= 0) this.afterImages.splice(i, 1);
        }

        // ── Stand-Aura & Afterimage system update ─────────────
        _standAura_update(this, dt);

        this.updateUI();
    }

    shoot() {
        const S = this.stats;
        if (this.cooldowns.shoot > 0) return;
        this.cooldowns.shoot = S.riceCooldown;
        const { damage, isCrit } = this.dealDamage(S.riceDamage * this.damageBoost);
        projectileManager.add(new Projectile(this.x, this.y, this.angle, S.riceSpeed, damage, S.riceColor, false, 'player'));
        if (isCrit) spawnFloatingText('สาดข้าว!', this.x, this.y - 40, '#fbbf24', 18);
        this.speedBoostTimer = S.speedOnHitDuration;
    }

    eatRice() {
        const S = this.stats;
        this.isEatingRice = true;
        this.eatRiceTimer = S.eatRiceDuration;
        this.cooldowns.eat = S.eatRiceCooldown;
        spawnParticles(this.x, this.y, 30, '#fbbf24');
        spawnFloatingText('กินข้าวเหนียว!', this.x, this.y - 50, '#fbbf24', 22);
        showVoiceBubble('อร่อยแท้ๆ!', this.x, this.y - 40);
        addScreenShake(5); Audio.playPowerUp();
    }

    summonNaga() {
        const S = this.stats;
        this.cooldowns.naga = S.nagaCooldown;
        window.specialEffects.push(new NagaEntity(this.x, this.y, this));
        spawnParticles(this.x, this.y, 40, '#10b981');
        spawnFloatingText('อัญเชิญพญานาค!', this.x, this.y - 60, '#10b981', 24);
        showVoiceBubble('ขอพรพญานาค!', this.x, this.y - 40);
        addScreenShake(10); Audio.playAchievement();
        this.nagaCount++;
        if (this.nagaCount >= 3) Achievements.check('naga_summoner');
    }

    dash(ax, ay) {
        const S = this.stats;
        this.isDashing = true;
        this.cooldowns.dash = S.dashCooldown;
        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        this.vx = Math.cos(angle) * (S.dashDistance / 0.2);
        this.vy = Math.sin(angle) * (S.dashDistance / 0.2);
        for (let i = 0; i < 5; i++) setTimeout(() => {
            this.afterImages.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
        }, i * 30);
        spawnParticles(this.x, this.y, 15, '#fbbf24');
        Audio.playDash(); Achievements.stats.dashes++; Achievements.check('speedster');
        setTimeout(() => { this.isDashing = false; }, 200);
    }

    takeDamage(amt) {
        if (this.isDashing) return;
        if (this.onGraph) { amt *= 2; spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16); }
        this.hp -= amt; this.hp = Math.max(0, this.hp);
        spawnFloatingText(Math.round(amt), this.x, this.y - 30, '#ef4444');
        spawnParticles(this.x, this.y, 8, '#ef4444');
        addScreenShake(8); Audio.playHit();
        Achievements.stats.damageTaken += amt;
        if (this.hp <= 0) window.endGame('defeat');
    }

    dealDamage(baseDamage) {
        const S = this.stats;
        let damage = baseDamage, isCrit = false;
        let critChance = this.baseCritChance;
        if (this.isEatingRice) critChance += S.eatRiceCritBonus;
        if (Math.random() < critChance) {
            damage *= S.critMultiplier; isCrit = true;
            Achievements.stats.crits++; Achievements.check('crit_master');
        }
        return { damage, isCrit };
    }

    heal(amt) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
        spawnFloatingText(`+${amt} HP`, this.x, this.y - 30, '#10b981');
        spawnParticles(this.x, this.y, 10, '#10b981'); Audio.playHeal();
    }

    addSpeedBoost() { this.speedBoostTimer = this.stats.speedOnHitDuration; }

    gainExp(amount) {
        this.exp += amount;
        spawnFloatingText(`+${amount} EXP`, this.x, this.y - 50, '#8b5cf6', 14);
        while (this.exp >= this.expToNextLevel) this.levelUp();
        this.updateUI();
    }

    levelUp() {
        const S = this.stats;
        this.exp -= this.expToNextLevel; this.level++;
        this.expToNextLevel = Math.floor(this.expToNextLevel * S.expLevelMult);
        this.hp = this.maxHp; this.energy = this.maxEnergy;
        spawnFloatingText(`LEVEL ${this.level}!`, this.x, this.y - 70, '#facc15', 35);
        spawnParticles(this.x, this.y, 40, '#facc15');
        addScreenShake(12); Audio.playLevelUp();
    }

    draw() {
        const S = this.stats;

        // ── Stand-Aura & Afterimage (drawn first — behind everything) ──
        _standAura_draw(this, 'poom');

        // Legacy dash afterImages (amber flash — kept for compat)
        for (const img of this.afterImages) {
            const s = worldToScreen(img.x, img.y);
            CTX.save(); CTX.translate(s.x, s.y); CTX.rotate(img.angle);
            CTX.globalAlpha = img.life * 0.3; CTX.fillStyle = '#fbbf24';
            CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 8); CTX.fill(); CTX.restore();
        }
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.3)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 25, 18, 8, 0, 0, Math.PI * 2); CTX.fill();

        if (this.isEatingRice) {
            const t = performance.now() / 200;
            const auraSize  = 38 + Math.sin(t) * 6;
            const auraAlpha = 0.4 + Math.sin(t * 1.5) * 0.15;
            CTX.save();
            CTX.globalAlpha = auraAlpha;
            CTX.strokeStyle = '#fbbf24'; CTX.lineWidth = 4;
            CTX.shadowBlur = 25; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, auraSize, 0, Math.PI * 2); CTX.stroke();
            CTX.globalAlpha = auraAlpha * 0.35;
            CTX.beginPath(); CTX.arc(screen.x, screen.y, auraSize + 12, 0, Math.PI * 2); CTX.stroke();
            CTX.restore();
        }

        if (this.isConfused)   { CTX.font = 'bold 24px Arial'; CTX.textAlign='center'; CTX.fillText('😵', screen.x, screen.y - 44); }
        if (this.isBurning)    { CTX.font = 'bold 20px Arial'; CTX.fillText('🔥', screen.x + 20, screen.y - 35); }
        if (this.isEatingRice) { CTX.font = 'bold 18px Arial'; CTX.textAlign='center'; CTX.fillText('🍚', screen.x, screen.y - 44); }

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        const w = Math.sin(this.walkCycle) * 8;

        CTX.fillStyle = '#1e3a8a';
        CTX.beginPath(); CTX.ellipse(5+w,12,7,5,0,0,Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.ellipse(5-w,-12,7,5,0,0,Math.PI*2); CTX.fill();

        CTX.fillStyle = '#dc2626';
        CTX.beginPath(); CTX.roundRect(-16,-13,32,26,5); CTX.fill();

        CTX.save();
        CTX.beginPath(); CTX.roundRect(-16,-13,32,26,5); CTX.clip();
        CTX.strokeStyle='rgba(255,255,255,0.5)'; CTX.lineWidth=3;
        for(let xi=-16;xi<=16;xi+=8){CTX.beginPath();CTX.moveTo(xi,-13);CTX.lineTo(xi,13);CTX.stroke();}
        for(let yi=-13;yi<=13;yi+=7){CTX.beginPath();CTX.moveTo(-16,yi);CTX.lineTo(16,yi);CTX.stroke();}
        CTX.restore();

        CTX.fillStyle = '#d4a574';
        CTX.beginPath(); CTX.arc(10,14,5,0,Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.arc(8,-14,5,0,Math.PI*2); CTX.fill();

        CTX.fillStyle = '#d4a574';
        CTX.beginPath(); CTX.arc(0,0,13,0,Math.PI*2); CTX.fill();
        CTX.fillStyle = '#0f172a';
        CTX.beginPath(); CTX.arc(0,0,14,Math.PI*1.15,Math.PI*2.85); CTX.fill();
        CTX.beginPath(); CTX.arc(-7,-4,5,0,Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.arc(7,-4,5,0,Math.PI*2); CTX.fill();

        CTX.strokeStyle='#1e293b'; CTX.lineWidth=2.5;
        CTX.beginPath(); CTX.arc(-5,1,4.5,0,Math.PI*2); CTX.moveTo(6,1); CTX.arc(5,1,4.5,0,Math.PI*2); CTX.stroke();
        const tg = performance.now()/500;
        CTX.fillStyle=`rgba(255,255,255,${Math.abs(Math.sin(tg))*0.7+0.3})`;
        CTX.fillRect(-7,-1,3,2); CTX.fillRect(3,-1,3,2);

        CTX.strokeStyle='#7c3c2a'; CTX.lineWidth=2;
        CTX.beginPath(); CTX.arc(0,2,5,0.1,Math.PI-0.1); CTX.stroke();

        CTX.restore();

        if (this.level > 1) {
            CTX.fillStyle = 'rgba(234,88,12,0.9)';
            CTX.beginPath(); CTX.arc(screen.x+22, screen.y-22, 10, 0, Math.PI*2); CTX.fill();
            CTX.fillStyle='#fff'; CTX.font='bold 10px Arial';
            CTX.textAlign='center'; CTX.textBaseline='middle';
            CTX.fillText(this.level, screen.x+22, screen.y-22);
        }
    }

    updateUI() {
        const S = this.stats;
        const hpBar = document.getElementById('hp-bar');
        const enBar = document.getElementById('en-bar');
        if (hpBar) hpBar.style.width = `${this.hp / this.maxHp * 100}%`;
        if (enBar) enBar.style.width = `${this.energy / this.maxEnergy * 100}%`;

        const dpEl = document.getElementById('dash-cd');
        if (dpEl) {
            const dp = Math.min(100,(1 - this.cooldowns.dash / S.dashCooldown)*100);
            dpEl.style.height = `${100-dp}%`;
        }
        const eatCd  = document.getElementById('eat-cd');
        const eatIcon = document.getElementById('eat-icon');
        if (eatCd) {
            if (this.isEatingRice) { eatCd.style.height = '0%'; eatIcon?.classList.add('active'); }
            else {
                eatIcon?.classList.remove('active');
                const ep = Math.min(100,(1-this.cooldowns.eat/S.eatRiceCooldown)*100);
                eatCd.style.height = `${100-ep}%`;
            }
        }
        const nagaCd = document.getElementById('naga-cd');
        if (nagaCd) {
            const np = Math.min(100,(1-this.cooldowns.naga/S.nagaCooldown)*100);
            nagaCd.style.height = `${100-np}%`;
        }
        const levelEl = document.getElementById('player-level');
        if (levelEl) levelEl.textContent = `Lv.${this.level}`;
        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${(this.exp/this.expToNextLevel)*100}%`;
    }
}

// ════════════════════════════════════════════════════════════
// ✅ WARN 5 FIX — Share checkObstacleProximity with PoomPlayer
// ════════════════════════════════════════════════════════════
// PoomPlayer extends Entity, NOT Player, so it does not inherit
// Player.prototype methods automatically. We assign the reference
// explicitly here so both classes call the same function object.
// Any future balance change to the obstacle system only needs to
// be made in the single Player.prototype.checkObstacleProximity
// definition above.
PoomPlayer.prototype.checkObstacleProximity = Player.prototype.checkObstacleProximity;

// ════════════════════════════════════════════════════════════
// 🐍 NAGA ENTITY
// ════════════════════════════════════════════════════════════
class NagaEntity {
    constructor(startX, startY, owner) {
        const S = BALANCE.characters.poom;
        this.owner   = owner;
        const n      = S.nagaSegments;
        this.segments = Array.from({ length: n }, () => ({ x: startX, y: startY }));
        this.life    = S.nagaDuration;
        this.maxLife = S.nagaDuration;
        this.speed   = S.nagaSpeed;
        this.damage  = S.nagaDamage;
        this.radius  = S.nagaRadius;
    }

    update(dt, player, _meteorZones) {
        const S = BALANCE.characters.poom;
        this.life -= dt;
        if (this.life <= 0) return true;

        const head = this.segments[0];
        const dx = mouse.wx - head.x, dy = mouse.wy - head.y;
        const d = Math.hypot(dx, dy);
        if (d > 8) {
            const step = Math.min(this.speed * dt, d);
            head.x += (dx/d)*step; head.y += (dy/d)*step;
        }
        const segDist = S.nagaSegmentDistance;
        for (let i = 1; i < this.segments.length; i++) {
            const prev = this.segments[i-1], curr = this.segments[i];
            const sdx = curr.x - prev.x, sdy = curr.y - prev.y;
            const sd = Math.hypot(sdx, sdy);
            if (sd > segDist) { curr.x = prev.x+(sdx/sd)*segDist; curr.y = prev.y+(sdy/sd)*segDist; }
        }
        for (const enemy of (window.enemies || [])) {
            if (enemy.dead) continue;
            for (const seg of this.segments) {
                if (dist(seg.x,seg.y,enemy.x,enemy.y) < this.radius + enemy.radius) {
                    enemy.takeDamage(this.damage*dt, player);
                    if (Math.random()<0.1) spawnParticles(seg.x,seg.y,2,'#10b981');
                    break;
                }
            }
        }
        if (window.boss && !window.boss.dead) {
            for (const seg of this.segments) {
                if (dist(seg.x,seg.y,window.boss.x,window.boss.y) < this.radius + window.boss.radius) {
                    window.boss.takeDamage(this.damage*dt*0.4);
                    break;
                }
            }
        }
        return false;
    }

    draw() {
        const lifeRatio = this.life / this.maxLife;
        for (let i = this.segments.length-1; i >= 0; i--) {
            const seg = this.segments[i];
            const screen = worldToScreen(seg.x, seg.y);
            const t = i / (this.segments.length-1);
            const r = this.radius * (1-t*0.55);
            const alpha = lifeRatio * (1-t*0.3);
            CTX.save(); CTX.globalAlpha = Math.max(0.1, alpha);
            if (i === 0) {
                CTX.fillStyle='#fbbf24'; CTX.shadowBlur=20; CTX.shadowColor='#fbbf24';
                CTX.beginPath(); CTX.arc(screen.x,screen.y,r,0,Math.PI*2); CTX.fill();
                CTX.shadowBlur=0;
                CTX.fillStyle='#ef4444';
                CTX.beginPath(); CTX.arc(screen.x-r*.35,screen.y-r*.2,r*.25,0,Math.PI*2); CTX.fill();
                CTX.beginPath(); CTX.arc(screen.x+r*.35,screen.y-r*.2,r*.25,0,Math.PI*2); CTX.fill();
            } else if (i === this.segments.length-1) {
                CTX.fillStyle='#065f46'; CTX.shadowBlur=6; CTX.shadowColor='#10b981';
                CTX.beginPath(); CTX.arc(screen.x,screen.y,r,0,Math.PI*2); CTX.fill();
            } else {
                CTX.fillStyle = i%2===0 ? '#10b981' : '#059669';
                CTX.shadowBlur=10; CTX.shadowColor='#10b981';
                CTX.beginPath(); CTX.arc(screen.x,screen.y,r,0,Math.PI*2); CTX.fill();
                if (i%2===0 && r>8) {
                    CTX.strokeStyle='rgba(6,95,70,0.6)'; CTX.lineWidth=1.5;
                    CTX.beginPath(); CTX.arc(screen.x,screen.y,r*.7,0,Math.PI*2); CTX.stroke();
                }
            }
            CTX.restore();
        }
        if (this.segments.length > 0) {
            const hs = worldToScreen(this.segments[0].x, this.segments[0].y);
            CTX.fillStyle=`rgba(251,191,36,${lifeRatio})`;
            CTX.font='bold 10px Arial'; CTX.textAlign='center'; CTX.textBaseline='middle';
            CTX.fillText(`${this.life.toFixed(1)}s`, hs.x, hs.y-32);
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🤖 DRONE
// ════════════════════════════════════════════════════════════
class Drone extends Entity {
    constructor() {
        const S = BALANCE.drone;
        super(0, 0, S.radius);
        this.shootCooldown = 0;
        this.targetAngle   = 0;
        this.hasTarget     = false;
        this.bobTimer      = Math.random() * Math.PI * 2;
        this.orbitAngle    = 0;
        this.lockTimer     = 0;
    }

    update(dt, player) {
        const S = BALANCE.drone;
        this.bobTimer   += dt * S.bobSpeed;
        this.orbitAngle += dt * S.orbitSpeed;
        this.lockTimer  += dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        const targetX = player.x + Math.cos(this.orbitAngle) * S.orbitRadius;
        const targetY = player.y + Math.sin(this.orbitAngle) * S.orbitRadius
                        + Math.sin(this.bobTimer) * S.bobAmplitude;
        const lerpFactor = 1 - Math.pow(S.lerpBase, dt);
        this.x += (targetX - this.x) * lerpFactor;
        this.y += (targetY - this.y) * lerpFactor;

        this.hasTarget = false;
        if (this.shootCooldown <= 0) {
            const target = this._findNearestEnemy();
            if (target) {
                this.targetAngle = Math.atan2(target.y - this.y, target.x - this.x);
                this.hasTarget   = true;
                this.lockTimer   = 0;
                projectileManager.add(new Projectile(
                    this.x, this.y, this.targetAngle,
                    S.projectileSpeed, S.damage, S.projectileColor, false, 'player'
                ));
                this.shootCooldown = 1.0 / S.fireRate;
                spawnParticles(this.x, this.y, 2, S.projectileColor);
            }
        }
    }

    _findNearestEnemy() {
        const S = BALANCE.drone;
        let nearest = null, nearestDist = S.range;
        for (const e of (window.enemies || [])) {
            if (e.dead) continue;
            const d = dist(this.x, this.y, e.x, e.y);
            if (d < nearestDist) { nearestDist = d; nearest = e; }
        }
        if (window.boss && !window.boss.dead) {
            const d = dist(this.x, this.y, window.boss.x, window.boss.y);
            if (d < nearestDist) nearest = window.boss;
        }
        return nearest;
    }

    draw() {
        const S         = BALANCE.drone;
        const bobOffset = Math.sin(this.bobTimer) * S.bobAmplitude;
        const groundScreen = worldToScreen(this.x, this.y);
        const bodyScreen   = worldToScreen(this.x, this.y + bobOffset);

        const shadowAlpha = 0.15 + (1-(bobOffset+S.bobAmplitude)/(S.bobAmplitude*2))*0.2;
        const shadowScale = 0.8  + (1-(bobOffset+S.bobAmplitude)/(S.bobAmplitude*2))*0.2;
        CTX.save();
        CTX.globalAlpha = Math.max(0.05, shadowAlpha);
        CTX.fillStyle   = 'rgba(0,0,0,0.6)';
        CTX.beginPath();
        CTX.ellipse(groundScreen.x, groundScreen.y+22, 16*shadowScale, 5*shadowScale, 0,0,Math.PI*2);
        CTX.fill(); CTX.restore();

        if (this.hasTarget) {
            const arcAlpha = 0.5+Math.sin(this.lockTimer*12)*0.3;
            CTX.save(); CTX.globalAlpha=arcAlpha; CTX.strokeStyle='#00e5ff';
            CTX.lineWidth=1.5; CTX.shadowBlur=8; CTX.shadowColor='#00e5ff';
            CTX.beginPath();
            CTX.arc(bodyScreen.x,bodyScreen.y,S.radius+8,this.targetAngle-0.6,this.targetAngle+0.6);
            CTX.stroke(); CTX.restore();
        }

        CTX.save();
        CTX.translate(bodyScreen.x, bodyScreen.y);

        const armAngle = this.orbitAngle * 2.5;
        CTX.save(); CTX.rotate(armAngle);
        for (let side=-1; side<=1; side+=2) {
            CTX.strokeStyle='#475569'; CTX.lineWidth=2.5;
            CTX.beginPath(); CTX.moveTo(0,0); CTX.lineTo(side*19,-3); CTX.stroke();
            CTX.fillStyle='#64748b';
            CTX.beginPath(); CTX.arc(side*19,-3,3.5,0,Math.PI*2); CTX.fill();
            const spin=this.bobTimer*8;
            CTX.save(); CTX.translate(side*19,-3); CTX.rotate(spin*side);
            CTX.strokeStyle='rgba(148,163,184,0.75)'; CTX.lineWidth=2;
            for(let blade=0;blade<4;blade++){
                const a=(blade/4)*Math.PI*2;
                CTX.beginPath(); CTX.moveTo(0,0); CTX.lineTo(Math.cos(a)*8,Math.sin(a)*8); CTX.stroke();
            }
            CTX.restore();
        }
        CTX.restore();

        const glowPulse=0.6+Math.sin(this.bobTimer*2)*0.4;
        CTX.shadowBlur=10*glowPulse; CTX.shadowColor='#00e5ff';
        CTX.fillStyle='#1e293b'; CTX.strokeStyle='#334155'; CTX.lineWidth=1.5;
        CTX.beginPath();
        for(let i=0;i<6;i++){
            const a=(i/6)*Math.PI*2-Math.PI/6, r=S.radius;
            if(i===0) CTX.moveTo(Math.cos(a)*r,Math.sin(a)*r);
            else      CTX.lineTo(Math.cos(a)*r,Math.sin(a)*r);
        }
        CTX.closePath(); CTX.fill(); CTX.stroke();

        CTX.strokeStyle=`rgba(0,229,255,${0.5+glowPulse*0.5})`;
        CTX.lineWidth=1.5; CTX.shadowBlur=14*glowPulse; CTX.shadowColor='#00e5ff';
        CTX.beginPath(); CTX.arc(0,0,5,0,Math.PI*2); CTX.stroke();
        CTX.fillStyle=`rgba(0,229,255,${0.7*glowPulse})`;
        CTX.beginPath(); CTX.arc(0,0,3,0,Math.PI*2); CTX.fill();
        CTX.fillStyle='rgba(255,255,255,0.8)';
        CTX.beginPath(); CTX.arc(-1,-1,1,0,Math.PI*2); CTX.fill();
        CTX.shadowBlur=0;

        CTX.save(); CTX.rotate(this.targetAngle);
        CTX.fillStyle='#475569'; CTX.strokeStyle='#64748b'; CTX.lineWidth=1;
        CTX.beginPath(); CTX.roundRect(4,-2.5,11,5,2); CTX.fill(); CTX.stroke();
        CTX.fillStyle=this.hasTarget?'#00e5ff':'#334155';
        CTX.fillRect(13,-1.5,3,3);
        CTX.restore();

        CTX.restore();

        CTX.save(); CTX.globalAlpha=0.45; CTX.fillStyle='#94a3b8';
        CTX.font='bold 6px Arial'; CTX.textAlign='center'; CTX.textBaseline='middle';
        CTX.fillText('DRONE', bodyScreen.x, bodyScreen.y+S.radius+9);
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🐕 BARK WAVE — Sonic cone emitted by Boss's bark attack
// (Lives here per refactor plan — instantiated by Boss)
// ════════════════════════════════════════════════════════════
class BarkWave {
    constructor(x, y, angle, coneHalf, range) {
        this.x=x; this.y=y; this.angle=angle;
        this.coneHalf=coneHalf; this.range=range;
        this.timer=0; this.duration=0.55; this.rings=5;
    }

    update(dt) {
        this.timer += dt;
        return this.timer >= this.duration;
    }

    draw() {
        const screen   = worldToScreen(this.x, this.y);
        const progress = this.timer / this.duration;
        const alpha    = 1 - progress;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        for (let i=0; i<this.rings; i++) {
            const frac = (progress + i/this.rings) % 1;
            const r    = frac * this.range;
            if (r < 4) continue;
            const ringAlpha = alpha*(1-i/this.rings)*0.75;
            if (ringAlpha <= 0) continue;
            CTX.save();
            CTX.globalAlpha = ringAlpha;
            CTX.strokeStyle = i%2===0 ? '#f59e0b' : '#fbbf24';
            CTX.lineWidth   = Math.max(1, 3.5-i*0.5);
            CTX.shadowBlur  = 12; CTX.shadowColor='#d97706'; CTX.lineCap='round';
            CTX.beginPath(); CTX.arc(0,0,r,-this.coneHalf,this.coneHalf); CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(Math.cos(-this.coneHalf)*Math.max(0,r-25),Math.sin(-this.coneHalf)*Math.max(0,r-25));
            CTX.lineTo(Math.cos(-this.coneHalf)*r,Math.sin(-this.coneHalf)*r); CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(Math.cos(this.coneHalf)*Math.max(0,r-25),Math.sin(this.coneHalf)*Math.max(0,r-25));
            CTX.lineTo(Math.cos(this.coneHalf)*r,Math.sin(this.coneHalf)*r); CTX.stroke();
            CTX.restore();
        }
        if (progress < 0.25) {
            const flashAlpha=(1-progress/0.25)*0.8;
            CTX.globalAlpha=flashAlpha; CTX.fillStyle='#fbbf24';
            CTX.shadowBlur=20; CTX.shadowColor='#f59e0b';
            CTX.beginPath(); CTX.arc(0,0,14*(1-progress/0.25),0,Math.PI*2); CTX.fill();
        }
        CTX.restore();
    }
}

// ─── Mobile patch ─────────────────────────────────────────────
// ✅ BUG 2 FIX: Removed the redundant velocity block that was
// double-applying joystick acceleration on touch devices.
//
// ROOT CAUSE (original bug):
//   The original patch read touchJoystickLeft.nx/ny into __mobile_ax/ay,
//   then called __origUpdate (which ALSO reads touchJoystickLeft and applies
//   acceleration internally), then applied the same acceleration a second time
//   after the call — resulting in 2× intended speed on all touch devices.
//
// FIX:
//   The patch now only zeroes WASD keys when the left joystick is active,
//   then calls __origUpdate.  __origUpdate already contains:
//     if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
//         ax = touchJoystickLeft.nx; ay = touchJoystickLeft.ny; isTouchMove = true;
//     }
//   so joystick movement, normalisation, walkCycle, speed caps, and angle
//   are all handled there exactly once.  The right-joystick angle override
//   in the old patch was also redundant for the same reason.
if (typeof Player !== 'undefined') {
    const __origUpdate = Player.prototype.update;
    Player.prototype.update = function(dt, keys, mouse) {
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            keys.w = keys.a = keys.s = keys.d = 0;
        }
        __origUpdate.call(this, dt, keys, mouse);
    };
}