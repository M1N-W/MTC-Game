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

        // ── Collision Awareness state ──────────────────────────
        this.obstacleBuffTimer = 0;
        this.lastObstacleWarning = 0;

        // ── EMP Grounded status (BossFirst EMP_ATTACK) ─────────
        this.groundedTimer = 0;
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

        let speedMult = (this.isInvisible ? S.stealthSpeedBonus : 1) * this.speedBoost;
        if (typeof KaoPlayer !== 'undefined' && this instanceof KaoPlayer && this.passiveUnlocked) speedMult = Math.max(speedMult, 1.4);
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

        if (keys.space && this.cooldowns.dash <= 0 && this.groundedTimer <= 0) {
            this.dash(ax || 1, ay || 0); keys.space = 0;
        } else if (keys.space && this.groundedTimer > 0) {
            keys.space = 0; // consume input silently — dash blocked by Grounded
        }

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

        for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
            this.dashGhosts[i].life -= dt * 5;
            if (this.dashGhosts[i].life <= 0) this.dashGhosts.splice(i, 1);
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
        showVoiceBubble('เข้าโหมดซุ่ม!', this.x, this.y - 40);
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
            spawnFloatingText('ปลดล็อค: ซุ่มเสรี!', this.x, this.y - 60, '#fbbf24', 30);
            spawnParticles(this.x, this.y, 50, '#fbbf24');
            addScreenShake(15); this.goldenAuraTimer = 3;
            Audio.playAchievement();
            showVoiceBubble("ทักษะ 'ซุ่มเสรี' ปลดล็อคแล้ว!", this.x, this.y - 40);
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
        spawnFloatingText(
            `LEVEL ${this.level}! +${dmgPct}% DMG, -${cdPct}% CD${hpLine}`,
            this.x, this.y - 90, '#fbbf24', 32
        );
        spawnFloatingText(`LEVEL ${this.level}!`, this.x, this.y - 70, '#facc15', 35);
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
        if (this.passiveUnlocked && !(typeof KaoPlayer !== 'undefined' && this instanceof KaoPlayer)) {
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

    applyGrounded(duration) {
        // Takes the longer of current remaining timer vs new duration
        this.groundedTimer = Math.max(this.groundedTimer, duration);
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
                showVoiceBubble('Careful!', this.x, this.y - 50);
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