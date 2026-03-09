'use strict';
/**
 * js/entities/player/PlayerBase.js
 * * CORE PLAYER CLASS
 * Base implementation for all playable characters.
 */

// ════════════════════════════════════════════════════════════
// PLAYER (generic — supports any charId from BALANCE.characters)
// ════════════════════════════════════════════════════════════
class Player extends Entity {
    constructor(charId = 'kao') {
        const stats = BALANCE.characters[charId];
        super(0, 0, stats.radius);

        this.charId = charId;
        this.stats = stats;

        this.hp = stats.hp;
        this.maxHp = stats.maxHp;
        this.energy = stats.energy;
        this.maxEnergy = stats.maxEnergy;

        this.cooldowns = { dash: 0, stealth: 0, shoot: 0 };

        this.isDashing = false;
        this.isInvisible = false;
        this.ambushReady = false;
        this.walkCycle = 0;

        this.damageBoost = 1;
        this.speedBoost = 1;
        this.speedBoostTimer = 0;
        this.dashGhosts = [];

        // ── MTC Room Buff State ───────────────────────────────────
        this.mtcBuffType = -1;   // 0=DMG, 1=SPD, 2=CDR(instant) — -1 = none
        this.mtcBuffTimer = 0;    // remaining seconds
        this.mtcDmgBuff = 0;   // additive bonus to damageMultiplier
        this.mtcSpeedBuff = 0;   // additive bonus to speedBoost

        // ── Timeout Management ───────────────────────────────────
        this.dashTimeouts = [];

        // ── Weapon Recoil (v11) ───────────────────────────────────
        this.weaponRecoil = 0;
        this.weaponRecoilDecay = 8.5;

        // ── Stand-Aura & Afterimage system ────────────────────
        this.standGhosts = [];
        this.auraRotation = 0;
        this._auraFrame = 0;

        this.onGraph = false;
        this.isConfused = false; this.confusedTimer = 0;
        this.isBurning = false; this.burnTimer = 0; this.burnDamage = 0;

        // ── Combo System Initialization ─────────────────────────
        this.comboCount = 0;
        this.comboTimer = 0;
        this.COMBO_MAX_TIME = 3.0;
        this.COMBO_MAX_STACKS = 50;

        this.level = 1;
        this.exp = 0;
        this.expToNextLevel = stats.expToNextLevel;

        // ── RPG Scaling Multipliers ─────────────────────────────
        this._damageMultiplier = 1.0;
        Object.defineProperty(this, 'damageMultiplier', {
            get: function () {
                const combo = this.comboCount || 0;
                return this._damageMultiplier * (1 + (combo * 0.01));
            },
            set: function (val) {
                // Preserves level-up logic by extracting the base value difference
                const comboMult = 1 + ((this.comboCount || 0) * 0.01);
                const diff = val - (this._damageMultiplier * comboMult);
                this._damageMultiplier += diff;
            }
        });
        this.cooldownMultiplier = 1.0;
        this.skillCooldownMult = 1.0;   // CDR from shop (multiplied at assignment)

        this.baseCritChance = stats.baseCritChance;
        this.passiveUnlocked = false;  // Admin Dev Mode จัดการใน startGame() แทนแล้ว
        this.stealthUseCount = 0;
        this.goldenAuraTimer = 0;

        // ── Passive behaviour flags (override in subclass, avoids instanceof checks) ──
        // passiveSpeedBonus: speedMult ที่ได้หลัง passive unlock (0 = ไม่มี bonus)
        // usesOwnLifesteal: true = subclass จัดการ lifesteal เอง, ไม่ใช้ base logic
        this.passiveSpeedBonus = 0;
        this.usesOwnLifesteal = false;

        // ── Collision Awareness state ──────────────────────────
        this.obstacleBuffTimer = 0;
        this.lastObstacleWarning = 0;

        // ── Contact damage tracking (BUG-1 FIX: must be init'd here) ──
        this._contactWarningTimer = 0;
        this._dmgAccum = 0;

        // ── Hit Flash state (used by PlayerRenderer) ───────────
        this._hitFlashTimer = 0;     // counts DOWN from 1 → 0 after taking damage
        this._hitFlashBig = false;  // true = bullet/AoE hit (stronger flash)
        this._hitFlashLocked = false; // ป้องกัน contact damage reset ซ้ำทุกเฟรม

        // ── EMP Grounded status (BossFirst EMP_ATTACK) ─────────
        this.groundedTimer = 0;

        // ── Meta Progression — apply Achievement rewards ────────
        // Reads unlocked achievements from localStorage and stacks
        // their permanent bonuses onto this player instance at birth.
        this.metaSpeedMult = 1.0;
        if (typeof getSaveData === 'function' && typeof ACHIEVEMENT_DEFS !== 'undefined') {
            const unlocked = getSaveData().unlockedAchievements || [];
            for (let i = 0; i < unlocked.length; i++) {
                const achId = unlocked[i];
                const def = ACHIEVEMENT_DEFS.find(a => a.id === achId);
                if (!def || !def.reward) continue;
                const r = def.reward;
                switch (r.type) {
                    case 'hp':
                        this.maxHp += r.value;
                        this.hp += r.value;
                        break;
                    case 'damage':
                        this._damageMultiplier += r.value;
                        break;
                    case 'speed':
                        this.metaSpeedMult += r.value;
                        break;
                    case 'crit':
                        this.baseCritChance += r.value;
                        break;
                    case 'cdr':
                        // Compound reduction, floor at 10% of base
                        this.skillCooldownMult = Math.max(0.1, this.skillCooldownMult - r.value);
                        break;
                }
            }
            if (unlocked.length > 0) {
                console.log(`[MTC Meta] Applied ${unlocked.length} achievement reward(s). Speed×${this.metaSpeedMult.toFixed(2)} CDR×${this.skillCooldownMult.toFixed(2)}`);
            }
        }
    }

    get S() { return this.stats; }

    get isSecondWind() {
        return this.hp > 0 && (this.hp / this.maxHp) <= (BALANCE.player.secondWindHpPct || 0.2);
    }

    update(dt, keys, mouse) {
        const S = this.stats;
        const PHY = BALANCE.physics;

        // ── Contact Warning Timer ──────────────────────────────
        if (this._contactWarningTimer > 0) {
            this._contactWarningTimer = Math.max(0, this._contactWarningTimer - dt);
        }
        // ── Hit Flash Timer ────────────────────────────────────
        if (this._hitFlashTimer > 0) {
            this._hitFlashTimer = Math.max(0, this._hitFlashTimer - dt * 6);
            // ปลด lock เมื่อ flash decay ลงมาต่ำกว่า 0.4
            if (this._hitFlashLocked && this._hitFlashTimer < 0.4) {
                this._hitFlashLocked = false;
            }
        }

        // ── Combo System Update ────────────────────────────────
        if (this.comboCount > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
                this.comboTimer = 0;
            }
        }

        if (this.isBurning) {
            this.burnTimer -= dt;
            this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15, 15), this.y + rand(-15, 15), 1, '#f59e0b');
        }
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) { this.isConfused = false; this.confusedTimer = 0; }
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;

        // ── MTC Buff Timer ────────────────────────────────────────
        if (this.mtcBuffTimer > 0) {
            this.mtcBuffTimer -= dt;
            if (this.mtcBuffTimer <= 0) {
                // Remove buff
                if (this.mtcBuffType === 0) this._damageMultiplier -= this.mtcDmgBuff;
                if (this.mtcBuffType === 1) this.speedBoost -= this.mtcSpeedBuff;
                this.mtcBuffType = -1; this.mtcDmgBuff = 0; this.mtcSpeedBuff = 0;
                spawnFloatingText('BUFF ENDED', this.x, this.y - 55, '#6b7280', 14);
            }
        }
        if (this.groundedTimer > 0) {
            this.groundedTimer -= dt;
            if (this.groundedTimer < 0) this.groundedTimer = 0;
            // Blink "DASH LOCKED" warning ~4× per second
            if (Math.floor((this.groundedTimer + dt) * 4) !== Math.floor(this.groundedTimer * 4)) {
                spawnFloatingText('⚡ DASH LOCKED!', this.x, this.y - 50, '#38bdf8', 18);
            }
        }
        if (this.goldenAuraTimer > 0) {
            this.goldenAuraTimer -= dt;
            if (Math.random() < 0.5) spawnParticles(this.x + rand(-25, 25), this.y + rand(-25, 25), 1, '#fbbf24');
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

        let speedMult = (this.isInvisible ? S.stealthSpeedBonus : 1) * this.speedBoost * this.metaSpeedMult;
        if (this.passiveUnlocked && this.passiveSpeedBonus > 0) speedMult = Math.max(speedMult, this.passiveSpeedBonus);
        if (this.speedBoostTimer > 0) speedMult += S.speedOnHit / S.moveSpeed;
        if (this.obstacleBuffTimer > 0) speedMult *= BALANCE.player.obstacleBuffPower;

        // ── Apply Combo Speed Buff ──
        speedMult *= (1 + ((this.comboCount || 0) * 0.01));
        // ── Second Wind Buff ──
        if (this.isSecondWind) {
            speedMult *= (BALANCE.player.secondWindSpeedMult || 1.3);
            if (Math.random() < 0.1) spawnParticles(this.x + rand(-15, 15), this.y + rand(-15, 15), 1, '#ef4444');
        }

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

        if (!this.isDashing) {
            this.checkObstacleProximity(ax, ay, dt, '#93c5fd');
        }

        if (this.cooldowns.dash > 0) {
            const dashTickRate = window.isSlowMotion ? 3.0 : 1.0;
            this.cooldowns.dash -= dt * dashTickRate;
            if (this.cooldowns.dash <= 0) this.cooldowns.dash = 0;
        }
        if (this.cooldowns.stealth > 0) this.cooldowns.stealth -= dt;

        if (checkInput('space')) {
            if (this.cooldowns.dash <= 0 && this.groundedTimer <= 0) {
                this.dash(ax || 1, ay || 0);
                consumeInput('space');
            } else if (this.groundedTimer > 0) {
                consumeInput('space'); // consume silently — dash blocked by Grounded
            }
        }

        if (checkInput('rightClick')) {
            if (this.cooldowns.stealth <= 0 && !this.isInvisible && this.energy >= S.stealthCost) {
                this.activateStealth();
                consumeInput('rightClick');
            }
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

        // BUG-11 FIX: swap-and-pop O(1) instead of splice O(n)
        for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
            this.dashGhosts[i].life -= dt * 5;
            if (this.dashGhosts[i].life <= 0) {
                this.dashGhosts[i] = this.dashGhosts[this.dashGhosts.length - 1];
                this.dashGhosts.pop();
            }
        }

        if (this.weaponRecoil > 0) {
            this.weaponRecoil = Math.max(0, this.weaponRecoil - this.weaponRecoilDecay * dt);
        }

        _standAura_update(this, dt);

        if (this.dead && this.dashTimeouts && this.dashTimeouts.length) {
            const ids = this.dashTimeouts.slice();
            this.dashTimeouts.length = 0;
            for (const timeoutId of ids) {
                try { clearTimeout(timeoutId); } catch (e) { }
            }
        }

        this.updateUI();
    }

    triggerRecoil() {
        this.weaponRecoil = 1.0;
    }

    activateStealth() {
        const S = this.stats;
        this.isInvisible = true; this.ambushReady = true;
        this.energy -= S.stealthCost;
        this.stealthUseCount++;
        spawnParticles(this.x, this.y, 25, '#facc15');
        if (typeof UIManager !== 'undefined') UIManager.showVoiceBubble('เข้าโหมดซุ่ม!', this.x, this.y - 40);
        this.checkPassiveUnlock();
        Achievements.stats.stealths++; Achievements.check('ghost');
    }

    breakStealth() {
        this.isInvisible = false;
        this.cooldowns.stealth = this.stats.stealthCooldown * this.cooldownMultiplier * this.skillCooldownMult;
    }

    dash(ax, ay) {
        const S = this.stats;
        if (this.isDashing) return;
        this.isDashing = true;
        this.cooldowns.dash = S.dashCooldown * this.skillCooldownMult;

        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        let dashSpeed = S.dashDistance / 0.2;
        if (window.isSlowMotion) dashSpeed *= 4.0;
        this.vx = Math.cos(angle) * dashSpeed;
        this.vy = Math.sin(angle) * dashSpeed;

        for (let i = 0; i < 5; i++) {
            const timeoutId = setTimeout(() => {
                if (!this.dead) {
                    this.dashGhosts.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
                }
                const idx = this.dashTimeouts.indexOf(timeoutId);
                if (idx > -1) this.dashTimeouts.splice(idx, 1);
            }, i * 30);
            this.dashTimeouts.push(timeoutId);
        }

        // ── Dash particle สีตามธีมตัวละคร ──
        const dashParticleColor = this.charId === 'auto' ? '#ef4444' : '#60a5fa';
        spawnParticles(this.x, this.y, 15, dashParticleColor);
        Audio.playDash();
        Achievements.stats.dashes++;
        Achievements.check('speedster');

        const dashEndTimeoutId = setTimeout(() => { if (!this.dead) this.isDashing = false; }, 200);
        this.dashTimeouts.push(dashEndTimeoutId);
    }

    checkPassiveUnlock() {
        const S = this.stats;
        if (!this.passiveUnlocked && this.level >= S.passiveUnlockLevel && this.stealthUseCount >= S.passiveUnlockStealthCount) {
            this.passiveUnlocked = true;
            const hpBonus = Math.floor(this.maxHp * S.passiveHpBonusPct);
            this.maxHp += hpBonus; this.hp += hpBonus;
            const unlockText = S.passiveUnlockText ?? 'ปลดล็อค: ซุ่มเสรี!';
            spawnFloatingText(unlockText, this.x, this.y - 60, '#fbbf24', 30);
            spawnParticles(this.x, this.y, 50, '#fbbf24');
            addScreenShake(15); this.goldenAuraTimer = 3;
            Audio.playAchievement();
            if (typeof UIManager !== 'undefined') UIManager.showVoiceBubble(`${unlockText}`, this.x, this.y - 40);
            try {
                const saved = getSaveData();
                const set = new Set(saved.unlockedPassives || []);
                set.add(this.charId);
                updateSaveData({ unlockedPassives: [...set] });
            } catch (e) {
                console.warn('[MTC Save] Could not persist passive unlock:', e);
            }
        }
    }

    gainExp(amount) {
        this.exp += amount;

        // ── Combo System Trigger ─────────────────────────────
        this.comboCount = Math.min(this.COMBO_MAX_STACKS || 50, (this.comboCount || 0) + 1);
        this.comboTimer = this.COMBO_MAX_TIME || 3.0;

        if (typeof spawnFloatingText !== 'undefined' && this.comboCount >= 3) {
            const fontSize = Math.min(26, 14 + (this.comboCount * 0.5));
            spawnFloatingText(`Combo x${this.comboCount}!`, this.x, this.y - 65, '#f43f5e', fontSize);
        }
        // ─────────────────────────────────────────────────────

        if (this.comboCount % 3 === 0) spawnFloatingText(`+${amount} EXP`, this.x, this.y - 50, '#8b5cf6', 14);
        while (this.exp >= this.expToNextLevel) this.levelUp();
        this.updateUI();
    }

    levelUp() {
        const S = this.stats;

        // ── 1. Consume EXP and advance level ───────────────────────────────────
        this.exp -= this.expToNextLevel;
        this.level++;
        this.expToNextLevel = Math.floor(this.expToNextLevel * S.expLevelMult);

        // ── 2. Damage multiplier ────────────────────────────────────────────────
        // Reads per-character scalar from config; falls back to universal +5%
        // so old saves / characters without the key still work correctly.
        const dmgGainPerLevel = S.damageMultiplierPerLevel ?? 0.05;
        this.damageMultiplier += dmgGainPerLevel;

        // ── 3. Cooldown reduction (floor: never below 50% of base cooldown) ─────
        const cdReductionPerLevel = S.cooldownReductionPerLevel ?? 0.03;
        this.cooldownMultiplier = Math.max(0.5, this.cooldownMultiplier - cdReductionPerLevel);

        // ── 4. Max HP scaling ───────────────────────────────────────────────────
        // If the character config defines maxHpPerLevel > 0 the tank/brawler
        // identity is expressed here. Kao has maxHpPerLevel: 0 so nothing happens.
        const hpGainPerLevel = S.maxHpPerLevel ?? 0;
        if (hpGainPerLevel > 0) {
            this.maxHp += hpGainPerLevel;
            // Grant the newly added HP immediately as a tactile level-up reward
            this.hp = Math.min(this.maxHp, this.hp + hpGainPerLevel);
        }

        // ── 5. Full restore ─────────────────────────────────────────────────────
        // Energy always refills fully.
        // HP only does a full heal when no incremental HP gain was applied —
        // this preserves the "you earned more HP" feel for tank characters.
        if (hpGainPerLevel === 0) {
            this.hp = this.maxHp;
        }
        this.energy = this.maxEnergy;

        // ── 6. Feedback ─────────────────────────────────────────────────────────
        const dmgPct = Math.round((this._damageMultiplier - 1) * 100);
        const cdPct = Math.round((1 - this.cooldownMultiplier) * 100);
        const hpLine = hpGainPerLevel > 0 ? `, +${hpGainPerLevel} MaxHP` : '';
        // stat line — เล็กลง ย้ายต่ำลง spawn ก่อน
        spawnFloatingText(
            `+${dmgPct}% DMG, -${cdPct}% CD${hpLine}`,
            this.x, this.y - 55, '#fbbf24', 20
        );
        // big level text — stagger 350ms, y สูงกว่า ไม่ชนกัน
        const _lvlSelf = this;
        setTimeout(() => {
            if (_lvlSelf.dead) return;
            spawnFloatingText(`✦ LEVEL ${_lvlSelf.level}! ✦`, _lvlSelf.x, _lvlSelf.y - 115, '#facc15', 36);
        }, 350);
        spawnParticles(this.x, this.y, 40, '#facc15');
        addScreenShake(12);
        Audio.playLevelUp();

        // ── 7. Passive check ────────────────────────────────────────────────────
        // Delegates to the per-character implementation via prototype chain.
        // Runs for every character; PoomPlayer's version is assigned below.
        this.checkPassiveUnlock();
    }

    takeDamage(amt) {
        const S = this.stats;
        if (this.isDashing) return;
        // ── Energy Shield block ──────────────────────────────────
        if (this.hasShield) {
            this.hasShield = false;
            spawnFloatingText('🛡️ BLOCKED!', this.x, this.y - 40, '#8b5cf6', 22);
            spawnParticles(this.x, this.y, 20, '#c4b5fd');
            if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
            return;
        }
        if (this.onGraph) { amt *= 2; spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16); }
        this.hp -= amt; this.hp = Math.max(0, this.hp);

        // ── Damage display — แยก contact damage (เล็กๆต่อเนื่อง) vs bullet/AoE (ก้อนใหญ่) ──
        // CONTACT DAMAGE: amt < 5 ต่อครั้ง → ไม่แสดงตัวเลขรายเฟรม
        //   แสดง ⚠️ แค่ครั้งเดียวต่อ cooldown window + เปิด warning ring
        // BULLET/AOE DAMAGE: amt ≥ 5 → แสดงตัวเลขทันทีแบบเดิม
        const CONTACT_THRESHOLD = 5;
        const WARNING_COOLDOWN = 1.2; // วินาที — ไม่แสดงซ้ำถี่กว่านี้

        if (amt < CONTACT_THRESHOLD) {
            // สะสม damage ไว้เพื่อ HP bar (แต่ไม่สแปม floating text)
            this._dmgAccum = (this._dmgAccum || 0) + amt;

            // แสดง ⚠️ + เปิด warning ring เมื่อ cooldown หมด
            if (!(this._contactWarningTimer > 0)) {
                spawnFloatingText('⚠️', this.x, this.y - 38, '#fbbf24', 22);
                this._contactWarningTimer = WARNING_COOLDOWN;
            }
        } else {
            // Bullet / AoE / boss special — แสดงตัวเลขทันที
            // รวม contact ที่สะสมไว้ก่อนหน้าถ้ามี
            const total = (this._dmgAccum || 0) + amt;
            this._dmgAccum = 0;
            spawnFloatingText(Math.round(total), this.x, this.y - 30, '#ef4444');
        }
        spawnParticles(this.x, this.y, 8, '#ef4444');
        addScreenShake(8); Audio.playHit();
        // ── Hit Flash trigger ──────────────────────────────────
        if (!this._hitFlashLocked) {
            this._hitFlashTimer = 1.0;
            this._hitFlashBig = (amt >= 5);
            // ── ป้องกัน contact damage reset timer ซ้ำทุกเฟรม ──────
            // ใช้ _hitFlashCooldown เพื่อ lock ไม่ให้ trigger ใหม่
            // จนกว่า flash ปัจจุบันจะ decay ลงถึง 0.5 ก่อน
            this._hitFlashLocked = true;
        }
        Achievements.stats.damageTaken += amt;
        if (this.hp <= 0) {
            this.dead = true;
            if (this.dashTimeouts && this.dashTimeouts.length) {
                this.dashTimeouts.forEach(id => clearTimeout(id));
                this.dashTimeouts.length = 0;
            }
        }
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
        // ── Apply Second Wind Damage Multiplier ──
        if (this.isSecondWind) {
            damage *= (BALANCE.player.secondWindDamageMult || 1.5);
        }
        if (this.passiveUnlocked && !this.usesOwnLifesteal) {
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

    // ── MTC Room: Apply rotating buff on entry ────────────────
    applyMtcBuff(buffIndex) {
        const C = BALANCE.mtcRoom;
        // Remove any existing MTC buff first
        if (this.mtcBuffTimer > 0) {
            if (this.mtcBuffType === 0) this._damageMultiplier -= this.mtcDmgBuff;
            if (this.mtcBuffType === 1) this.speedBoost -= this.mtcSpeedBuff;
        }
        this.mtcBuffType = buffIndex;
        this.mtcDmgBuff = 0;
        this.mtcSpeedBuff = 0;
        const mag = C.buffCycleMagnitude[buffIndex];
        const dur = C.buffCycleDuration[buffIndex];
        const name = C.buffCycleNames[buffIndex];
        const col = C.buffCycleColors[buffIndex];
        const icon = C.buffCycleIcons[buffIndex];

        if (buffIndex === 0) {
            // DMG +15%
            this.mtcDmgBuff = mag;
            this._damageMultiplier += mag;
            this.mtcBuffTimer = dur;
        } else if (buffIndex === 1) {
            // SPD +10%
            this.mtcSpeedBuff = mag;
            this.speedBoost += mag;
            this.mtcBuffTimer = dur;
        } else if (buffIndex === 2) {
            // CDR Burst — instant reduction on all active cooldowns
            for (const key of Object.keys(this.cooldowns)) {
                this.cooldowns[key] = Math.max(0, this.cooldowns[key] * (1 - mag));
            }
            // Also reduce subclass skill cooldowns if present (KruManop-style skills obj)
            if (this.skills) {
                for (const key of Object.keys(this.skills)) {
                    if (this.skills[key].cd !== undefined) {
                        this.skills[key].cd = Math.max(0, this.skills[key].cd * (1 - mag));
                    }
                }
            }
            this.mtcBuffTimer = 0; // instant, no duration
            this.mtcBuffType = -1;
        }
        spawnFloatingText(`${icon} ${name}`, this.x, this.y - 75, col, 22);
    }

    applyGrounded(duration) {
        // Takes the longer of current remaining timer vs new duration
        this.groundedTimer = Math.max(this.groundedTimer, duration);
    }

    // ─────────────────────────────────────────────────────────
    // DEV BUFF — applied by startGame() when window.isAdmin is set
    // ─────────────────────────────────────────────────────────
    // ไม่แตะ passiveUnlocked เลย — passive ยังต้องปลดในเกมเองตามปกติ
    //
    // Buffs ที่ให้:
    //   • HP +50%           (maxHp + hp เต็ม)
    //   • Energy +50%       (maxEnergy + energy เต็ม)
    //   • Damage ×1.25      (_damageMultiplier)
    //   • Speed ×1.20       (metaSpeedMult)
    //   • CDR ×0.60         (skillCooldownMult — floor 0.1)
    //   • Crit +8%          (baseCritChance)
    //   • Cooldowns reset   (cooldowns + skills{} ทั้งหมด → 0)
    //
    // Flag: this._devBuffApplied  ป้องกันเรียกซ้ำ
    // ─────────────────────────────────────────────────────────
    applyDevBuff() {
        if (this._devBuffApplied) return;
        this._devBuffApplied = true;

        // ── HP +50% ────────────────────────────────────────────
        const hpBonus = Math.floor(this.maxHp * 0.50);
        this.maxHp += hpBonus;
        this.hp = this.maxHp;  // start full

        // ── Energy +50% ────────────────────────────────────────
        const enBonus = Math.floor(this.maxEnergy * 0.50);
        this.maxEnergy += enBonus;
        this.energy = this.maxEnergy;

        // ── Damage ×1.25 ───────────────────────────────────────
        this._damageMultiplier *= 1.25;

        // ── Speed ×1.20 ────────────────────────────────────────
        this.metaSpeedMult *= 1.20;

        // ── CDR ×0.60 (stack กับ meta CDR ที่มีอยู่) ──────────
        this.skillCooldownMult = Math.max(0.1, this.skillCooldownMult * 0.60);

        // ── Crit +8% ───────────────────────────────────────────
        this.baseCritChance = Math.min(0.85, (this.baseCritChance || 0) + 0.08);

        // ── Reset all skill cooldowns to 0 ─────────────────────
        if (this.cooldowns) {
            for (const key of Object.keys(this.cooldowns)) this.cooldowns[key] = 0;
        }
        // ครอบคลุม .skills{} ของ Kao/Auto ด้วย
        if (this.skills) {
            for (const key of Object.keys(this.skills)) {
                if (this.skills[key] && typeof this.skills[key].cd !== 'undefined')
                    this.skills[key].cd = 0;
            }
        }

        console.log('[MTC Dev] applyDevBuff() →',
            `HP ${this.maxHp}  EN ${this.maxEnergy}`,
            `DMG×${this._damageMultiplier.toFixed(2)}  SPD×${this.metaSpeedMult.toFixed(2)}`,
            `CDR×${this.skillCooldownMult.toFixed(2)}  Crit ${(this.baseCritChance * 100).toFixed(0)}%`
        );
    }

    // draw() ย้ายไป PlayerRenderer._drawBase() แล้ว


    updateUI() {
        const S = this.stats;
        const hpEl = document.getElementById('hp-bar');
        const enEl = document.getElementById('en-bar');
        if (hpEl) hpEl.style.width = `${this.hp / this.maxHp * 100}%`;
        if (enEl) enEl.style.width = `${this.energy / this.maxEnergy * 100}%`;

        const dp = Math.min(100, (1 - this.cooldowns.dash / S.dashCooldown) * 100);
        const dashEl = document.getElementById('dash-cd');
        if (dashEl) dashEl.style.height = `${100 - dp}%`;
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('dash-icon',
                Math.max(0, this.cooldowns.dash), S.dashCooldown);
        }

        const sEl = document.getElementById('stealth-icon');
        const sCd = document.getElementById('stealth-cd');
        if (this.isInvisible) {
            sEl?.classList.add('active');
            if (sCd) sCd.style.height = '0%';
            if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
                UIManager._setCooldownVisual('stealth-icon', 0, S.stealthCooldown);
            }
        } else {
            sEl?.classList.remove('active');
            if (sCd) {
                const sp = Math.min(100, (1 - this.cooldowns.stealth / S.stealthCooldown) * 100);
                sCd.style.height = `${100 - sp}%`;
            }
            if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
                UIManager._setCooldownVisual('stealth-icon',
                    Math.max(0, this.cooldowns.stealth), S.stealthCooldown);
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
                const skillNameEl = passiveEl.querySelector('.skill-name');
                if (skillNameEl) {
                    skillNameEl.textContent = 'MAX';
                    skillNameEl.style.color = '#facc15';
                }
            } else if (this.level >= (this.stats.passiveUnlockLevel ?? 3)) {
                passiveEl.style.display = 'flex';
                passiveEl.style.opacity = '0.5';
                const skillName = passiveEl.querySelector('.skill-name');
                if (skillName) skillName.textContent = `${this.stealthUseCount}/${this.stats.passiveUnlockStealthCount ?? 5}`;
            }
        }
    }
}

// ════════════════════════════════════════════════════════════
// ✅ WARN 5 FIX — Shared obstacle-awareness prototype method
// ════════════════════════════════════════════════════════════
Player.prototype.checkObstacleProximity = function (ax, ay, dt, particleColor) {
    const OB = BALANCE.player;

    let mapObjs = [];
    if (window.mapSystem) {
        if (typeof mapSystem.getObjects === 'function') mapObjs = mapSystem.getObjects();
        else if (Array.isArray(mapSystem.objects)) mapObjs = mapSystem.objects;
        else if (Array.isArray(mapSystem.solidObjects)) mapObjs = mapSystem.solidObjects;
    }
    if (Array.isArray(BALANCE.map.wallPositions)) {
        mapObjs = mapObjs.concat(BALANCE.map.wallPositions);
    }

    const isMoving = (ax !== 0 || ay !== 0);
    let scraping = false;

    const warningThreshold = this.radius + OB.obstacleWarningRange;

    for (const obj of mapObjs) {
        if (!obj || obj.x === undefined || obj.y === undefined) continue;
        const oL = obj.x, oT = obj.y, oR = oL + (obj.w || 0), oB = oT + (obj.h || 0);
        const halfW = (obj.w || 0) / 2, halfH = (obj.h || 0) / 2;
        if (Math.abs(this.x - (oL + halfW)) > warningThreshold + halfW + 10) continue;
        if (Math.abs(this.y - (oT + halfH)) > warningThreshold + halfH + 10) continue;
        const closestX = Math.max(oL, Math.min(this.x, oR));
        const closestY = Math.max(oT, Math.min(this.y, oB));
        const d = Math.hypot(this.x - closestX, this.y - closestY);

        const scrapeThreshold = this.radius + 4;

        if (d < scrapeThreshold && isMoving) scraping = true;

        if (d < warningThreshold && isMoving) {
            const now = Date.now();
            if (now - this.lastObstacleWarning > OB.obstacleWarningCooldown) {
                this.lastObstacleWarning = now;
                if (typeof UIManager !== 'undefined') UIManager.showVoiceBubble('Careful!', this.x, this.y - 50);
            }
            break;
        }
    }

    if (scraping) this.obstacleBuffTimer = OB.obstacleBuffDuration;

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

// ─── Mobile patch ─────────────────────────────────────────────
// ✅ BUG 2 FIX: zeroes WASD when joystick active, then delegates to
// __origUpdate which handles the joystick read exactly once.
if (typeof Player !== 'undefined') {
    const __origUpdate = Player.prototype.update;
    Player.prototype.update = function (dt, keys, mouse) {
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            keys.w = keys.a = keys.s = keys.d = 0;
        }
        __origUpdate.call(this, dt, keys, mouse);
    };
}
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.Player = Player;