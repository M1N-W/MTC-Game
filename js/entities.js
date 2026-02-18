/**
 * 👾 MTC: ENHANCED EDITION - Game Entities (REFACTORED)
 *
 * CHANGES (Stability Overhaul):
 * - ✅ Boss class MOVED HERE from game.js (was the primary cause of split-brain issues)
 * - ✅ BarkWave class MOVED HERE from game.js
 * - ✅ All UIManager.showVoiceBubble() calls replaced with global showVoiceBubble()
 *       from utils.js — safe even before UIManager is constructed.
 * - ✅ Boss.takeDamage() uses window.startNextWave() so it can live outside game.js
 * - ✅ No functions are redefined that exist in utils.js (dist, rand, clamp, lerp, etc.)
 *
 * Load order: config.js → utils.js → effects.js → entities.js → map.js → ui.js → game.js
 */

// ════════════════════════════════════════════════════════════
// Base Entity
// ════════════════════════════════════════════════════════════
class Entity {
    constructor(x, y, radius) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.radius = radius;
        this.angle = 0;
        this.hp = 100; this.maxHp = 100;
        this.dead = false;
    }

    applyPhysics(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    isOnScreen(buffer = 120) {
        if (typeof worldToScreen !== 'function' || typeof CANVAS === 'undefined') return true;
        const s = worldToScreen(this.x, this.y);
        const r = (this.radius || 20) + buffer;
        return s.x + r > 0 &&
               s.x - r < CANVAS.width  &&
               s.y + r > 0 &&
               s.y - r < CANVAS.height;
    }
}

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
        this.afterImages     = [];

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
        this.afterImages = [];

        this.onGraph = false;
        this.isConfused = false; this.confusedTimer = 0;
        this.isBurning  = false; this.burnTimer = 0; this.burnDamage = 0;

        this.isEatingRice   = false; this.eatRiceTimer = 0;
        this.currentSpeedMult = 1;
        this.nagaCount = 0;

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
// ENEMIES
// ════════════════════════════════════════════════════════════
class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, BALANCE.enemy.radius);
        this.maxHp = BALANCE.enemy.baseHp + getWave()*BALANCE.enemy.hpPerWave;
        this.hp = this.maxHp;
        this.speed  = BALANCE.enemy.baseSpeed + getWave()*BALANCE.enemy.speedPerWave;
        this.damage = BALANCE.enemy.baseDamage + getWave()*BALANCE.enemy.damagePerWave;
        this.shootTimer = rand(...BALANCE.enemy.shootCooldown);
        this.color = randomChoice(BALANCE.enemy.colors);
        this.type = 'basic'; this.expValue = BALANCE.enemy.expValue;
    }
    update(dt, player) {
        if (this.dead) return;
        const dx=player.x-this.x, dy=player.y-this.y;
        const d=dist(this.x,this.y,player.x,player.y);
        this.angle=Math.atan2(dy,dx);
        if (d>BALANCE.enemy.chaseRange && !player.isInvisible) {
            this.vx=Math.cos(this.angle)*this.speed; this.vy=Math.sin(this.angle)*this.speed;
        } else { this.vx*=0.9; this.vy*=0.9; }
        this.applyPhysics(dt);
        this.shootTimer-=dt;
        if (this.shootTimer<=0 && d<BALANCE.enemy.shootRange && !player.isInvisible) {
            projectileManager.add(new Projectile(this.x,this.y,this.angle,BALANCE.enemy.projectileSpeed,this.damage,'#fff',false,'enemy'));
            this.shootTimer=rand(...BALANCE.enemy.shootCooldown);
        }
        if (d<this.radius+player.radius) player.takeDamage(this.damage*dt*3);
    }
    takeDamage(amt, player) {
        this.hp-=amt;
        if (this.hp<=0) {
            this.dead=true; this.hp=0;
            spawnParticles(this.x,this.y,20,this.color);
            addScore(BALANCE.score.basicEnemy*getWave()); addEnemyKill(); Audio.playEnemyDeath();
            if (player) player.gainExp(this.expValue);
            Achievements.stats.kills++; Achievements.check('first_blood');
            if (Math.random()<BALANCE.powerups.dropRate) window.powerups.push(new PowerUp(this.x,this.y));
        }
    }
    draw() {
        const screen=worldToScreen(this.x,this.y);
        CTX.fillStyle='rgba(0,0,0,0.3)'; CTX.beginPath();
        CTX.ellipse(screen.x,screen.y+20,15,7,0,0,Math.PI*2); CTX.fill();
        CTX.save(); CTX.translate(screen.x,screen.y); CTX.rotate(this.angle);
        CTX.fillStyle=this.color; CTX.beginPath(); CTX.arc(0,0,this.radius,0,Math.PI*2); CTX.fill();
        CTX.fillStyle='#000'; CTX.beginPath(); CTX.arc(8,0,4,0,Math.PI*2); CTX.fill(); CTX.restore();
        const hp=this.hp/this.maxHp, bw=30;
        CTX.fillStyle='#1e293b'; CTX.fillRect(screen.x-bw/2,screen.y-30,bw,4);
        CTX.fillStyle='#ef4444'; CTX.fillRect(screen.x-bw/2,screen.y-30,bw*hp,4);
    }
}

class TankEnemy extends Entity {
    constructor(x,y) {
        super(x,y,BALANCE.tank.radius);
        this.maxHp = BALANCE.tank.baseHp+getWave()*BALANCE.tank.hpPerWave;
        this.hp=this.maxHp;
        this.speed=BALANCE.tank.baseSpeed+getWave()*BALANCE.tank.speedPerWave;
        this.damage=BALANCE.tank.baseDamage+getWave()*BALANCE.tank.damagePerWave;
        this.color=BALANCE.tank.color; this.type='tank'; this.expValue=BALANCE.tank.expValue;
    }
    update(dt,player) {
        if(this.dead) return;
        const dx=player.x-this.x, dy=player.y-this.y;
        const d=dist(this.x,this.y,player.x,player.y);
        this.angle=Math.atan2(dy,dx);
        if(!player.isInvisible){this.vx=Math.cos(this.angle)*this.speed;this.vy=Math.sin(this.angle)*this.speed;}
        else{this.vx*=0.95;this.vy*=0.95;}
        this.applyPhysics(dt);
        if(d<BALANCE.tank.meleeRange+player.radius) player.takeDamage(this.damage*dt*2);
    }
    takeDamage(amt,player) {
        this.hp-=amt;
        if(this.hp<=0){
            this.dead=true;
            spawnParticles(this.x,this.y,30,this.color);
            addScore(BALANCE.score.tank*getWave()); addEnemyKill(); Audio.playEnemyDeath();
            if(player) player.gainExp(this.expValue);
            Achievements.stats.kills++;
            if(Math.random()<BALANCE.powerups.dropRate*BALANCE.tank.powerupDropMult) window.powerups.push(new PowerUp(this.x,this.y));
        }
    }
    draw() {
        const screen=worldToScreen(this.x,this.y);
        CTX.fillStyle='rgba(0,0,0,0.4)'; CTX.beginPath();
        CTX.ellipse(screen.x,screen.y+25,20,10,0,0,Math.PI*2); CTX.fill();
        CTX.save(); CTX.translate(screen.x,screen.y); CTX.rotate(this.angle);
        CTX.fillStyle=this.color; CTX.fillRect(-20,-20,40,40);
        CTX.fillStyle='#57534e'; CTX.fillRect(-18,-18,12,36); CTX.fillRect(6,-18,12,36);
        CTX.fillStyle='#dc2626'; CTX.beginPath(); CTX.arc(10,0,6,0,Math.PI*2); CTX.fill(); CTX.restore();
        const hp=this.hp/this.maxHp;
        CTX.fillStyle='#1e293b'; CTX.fillRect(screen.x-20,screen.y-35,40,5);
        CTX.fillStyle='#78716c'; CTX.fillRect(screen.x-20,screen.y-35,40*hp,5);
    }
}

class MageEnemy extends Entity {
    constructor(x,y) {
        super(x,y,BALANCE.mage.radius);
        this.maxHp=BALANCE.mage.baseHp+getWave()*BALANCE.mage.hpPerWave;
        this.hp=this.maxHp;
        this.speed=BALANCE.mage.baseSpeed+getWave()*BALANCE.mage.speedPerWave;
        this.damage=BALANCE.mage.baseDamage+getWave()*BALANCE.mage.damagePerWave;
        this.color=BALANCE.mage.color; this.type='mage';
        this.soundWaveCD=0; this.meteorCD=0; this.expValue=BALANCE.mage.expValue;
    }
    update(dt,player) {
        if(this.dead) return;
        const d=dist(this.x,this.y,player.x,player.y), od=BALANCE.mage.orbitDistance;
        this.angle=Math.atan2(player.y-this.y,player.x-this.x);
        if(d<od && !player.isInvisible){this.vx=-Math.cos(this.angle)*this.speed;this.vy=-Math.sin(this.angle)*this.speed;}
        else if(d>od+BALANCE.mage.orbitDistanceBuffer){this.vx=Math.cos(this.angle)*this.speed;this.vy=Math.sin(this.angle)*this.speed;}
        else{this.vx*=0.95;this.vy*=0.95;}
        this.applyPhysics(dt);
        if(this.soundWaveCD>0) this.soundWaveCD-=dt;
        if(this.meteorCD>0) this.meteorCD-=dt;
        if(this.soundWaveCD<=0 && d<BALANCE.mage.soundWaveRange && !player.isInvisible){
            player.isConfused=true; player.confusedTimer=BALANCE.mage.soundWaveConfuseDuration;
            spawnFloatingText('CONFUSED!',player.x,player.y-40,'#a855f7',20);
            for(let i=0;i<360;i+=30){
                const a=(i*Math.PI)/180;
                spawnParticles(this.x+Math.cos(a)*50,this.y+Math.sin(a)*50,3,'#a855f7');
            }
            this.soundWaveCD=BALANCE.mage.soundWaveCooldown;
        }
        if(this.meteorCD<=0 && Math.random()<0.005){
            window.specialEffects.push(new MeteorStrike(player.x+rand(-300,300),player.y+rand(-300,300)));
            this.meteorCD=BALANCE.mage.meteorCooldown;
            Audio.playMeteorWarning();
        }
    }
    takeDamage(amt,player) {
        this.hp-=amt;
        if(this.hp<=0){
            this.dead=true;
            spawnParticles(this.x,this.y,25,this.color);
            addScore(BALANCE.score.mage*getWave()); addEnemyKill(); Audio.playEnemyDeath();
            if(player) player.gainExp(this.expValue);
            Achievements.stats.kills++;
            if(Math.random()<BALANCE.powerups.dropRate*BALANCE.mage.powerupDropMult) window.powerups.push(new PowerUp(this.x,this.y));
        }
    }
    draw() {
        const screen=worldToScreen(this.x,this.y);
        CTX.fillStyle='rgba(0,0,0,0.3)'; CTX.beginPath();
        CTX.ellipse(screen.x,screen.y+18,13,6,0,0,Math.PI*2); CTX.fill();
        CTX.save(); CTX.translate(screen.x,screen.y+Math.sin(performance.now()/300)*3); CTX.rotate(this.angle);
        CTX.fillStyle=this.color; CTX.beginPath(); CTX.arc(0,5,15,0,Math.PI*2); CTX.fill();
        CTX.strokeStyle='#6b21a8'; CTX.lineWidth=3; CTX.beginPath();
        CTX.moveTo(-10,0); CTX.lineTo(-10,-25); CTX.stroke();
        CTX.fillStyle='#fbbf24'; CTX.shadowBlur=10; CTX.shadowColor='#fbbf24';
        CTX.beginPath(); CTX.arc(-10,-25,5,0,Math.PI*2); CTX.fill(); CTX.shadowBlur=0;
        CTX.fillStyle='#7c3aed'; CTX.beginPath(); CTX.arc(0,-5,12,0,Math.PI); CTX.fill(); CTX.restore();
        const hp=this.hp/this.maxHp;
        CTX.fillStyle='#1e293b'; CTX.fillRect(screen.x-15,screen.y-30,30,4);
        CTX.fillStyle='#a855f7'; CTX.fillRect(screen.x-15,screen.y-30,30*hp,4);
    }
}

// ════════════════════════════════════════════════════════════
// POWER-UPS
// ════════════════════════════════════════════════════════════
class PowerUp {
    constructor(x,y) {
        this.x=x; this.y=y; this.radius=BALANCE.powerups.radius; this.life=BALANCE.powerups.lifetime;
        this.bobTimer=Math.random()*Math.PI*2;
        this.type=randomChoice(['heal','damage','speed']);
        this.icons={heal:'❤️',damage:'⚡',speed:'🚀'};
        this.colors={heal:'#10b981',damage:'#f59e0b',speed:'#3b82f6'};
    }
    update(dt,player) {
        this.life-=dt; this.bobTimer+=dt*3;
        const d=dist(this.x,this.y,player.x,player.y);
        if(d<this.radius+player.radius){this.collect(player);return true;}
        return this.life<=0;
    }
    collect(player) {
        switch(this.type){
            case 'heal': player.heal(BALANCE.powerups.healAmount); break;
            case 'damage':
                player.damageBoost=BALANCE.powerups.damageBoost;
                setTimeout(()=>{player.damageBoost=1;},BALANCE.powerups.damageBoostDuration*1000);
                spawnFloatingText('DAMAGE UP!',player.x,player.y-40,'#f59e0b',20); break;
            case 'speed':
                player.speedBoost=BALANCE.powerups.speedBoost;
                setTimeout(()=>{player.speedBoost=1;},BALANCE.powerups.speedBoostDuration*1000);
                spawnFloatingText('SPEED UP!',player.x,player.y-40,'#3b82f6',20);
        }
        spawnParticles(this.x,this.y,20,this.colors[this.type]);
        addScore(BALANCE.score.powerup); Audio.playPowerUp();
        Achievements.stats.powerups++; Achievements.check('collector');
    }
    draw() {
        const screen=worldToScreen(this.x,this.y+Math.sin(this.bobTimer)*5);
        CTX.save(); CTX.translate(screen.x,screen.y);
        CTX.shadowBlur=20; CTX.shadowColor=this.colors[this.type];
        CTX.font='32px Arial'; CTX.textAlign='center'; CTX.textBaseline='middle';
        CTX.fillText(this.icons[this.type],0,0); CTX.restore();
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
// (MOVED HERE from game.js)
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

// ════════════════════════════════════════════════════════════
// 👑 BOSS — "KRU MANOP THE DOG RIDER"
// (MOVED HERE from game.js — game.js no longer defines this class)
// ════════════════════════════════════════════════════════════
class Boss extends Entity {
    constructor(difficulty = 1, isRider = false) {
        super(0, BALANCE.boss.spawnY, BALANCE.boss.radius);
        this.maxHp     = BALANCE.boss.baseHp * difficulty;
        this.hp        = this.maxHp;
        this.name      = 'KRU MANOP';
        this.state     = 'CHASE';
        this.timer     = 0;
        this.moveSpeed = BALANCE.boss.moveSpeed;
        this.difficulty = difficulty;
        this.phase     = 1;
        this.sayTimer  = 0;
        this.isRider   = isRider;

        this.skills = {
            slam:  { cd: 0, max: BALANCE.boss.slamCooldown  },
            graph: { cd: 0, max: BALANCE.boss.graphCooldown  },
            log:   { cd: 0, max: BALANCE.boss.log457Cooldown },
            bark:  { cd: 0, max: BALANCE.boss.phase2.barkCooldown }
        };

        this.log457State       = null;
        this.log457Timer       = 0;
        this.log457AttackBonus = 0;
        this.isInvulnerable    = false;
        this.isEnraged         = false;
        this.dogLegTimer       = 0;
    }

    update(dt, player) {
        if (this.dead) return;
        const dx=player.x-this.x, dy=player.y-this.y;
        const d=dist(this.x,this.y,player.x,player.y);
        this.angle=Math.atan2(dy,dx);
        this.timer+=dt; this.sayTimer+=dt;
        if (this.isRider) this.dogLegTimer+=dt*(this.isEnraged?2.5:1.0);

        for (let s in this.skills) if (this.skills[s].cd>0) this.skills[s].cd-=dt;

        if (this.sayTimer>BALANCE.boss.speechInterval && Math.random()<0.1) {
            this.speak('Player at '+Math.round(player.hp)+' HP');
            this.sayTimer=0;
        }

        if (this.hp<this.maxHp*BALANCE.boss.phase2Threshold && this.phase===1) {
            this.phase=2; this.isEnraged=true;
            this.moveSpeed=BALANCE.boss.moveSpeed*BALANCE.boss.phase2.enrageSpeedMult;
            spawnFloatingText('ENRAGED!',this.x,this.y-80,'#ef4444',40);
            if(this.isRider) spawnFloatingText('🐕 DOG RIDER!',this.x,this.y-120,'#d97706',32);
            addScreenShake(20);
            spawnParticles(this.x,this.y,35,'#ef4444');
            spawnParticles(this.x,this.y,20,'#d97706');
            this.speak(this.isRider?'Hop on, boy! Let\'s go!':'You think you can stop me?!');
            Audio.playBossSpecial();
        }

        if (this.log457State==='charging') {
            this.log457Timer+=dt; this.isInvulnerable=true;
            this.hp=Math.min(this.maxHp,this.hp+this.maxHp*BALANCE.boss.log457HealRate*dt);
            if (this.log457Timer>=BALANCE.boss.log457ChargeDuration) {
                this.log457State='active'; this.log457Timer=0;
                this.log457AttackBonus=BALANCE.boss.log457AttackBonus;
                this.isInvulnerable=false;
                addScreenShake(20); spawnFloatingText('67! 67! 67!',this.x,this.y-80,'#facc15',35);
                this.speak('0.6767!');
            }
        } else if (this.log457State==='active') {
            this.log457Timer+=dt;
            this.log457AttackBonus+=BALANCE.boss.log457AttackGrowth*dt;
            if (this.log457Timer>=BALANCE.boss.log457ActiveDuration) {
                this.log457State='stunned'; this.log457Timer=0;
                this.vx=0; this.vy=0;
                spawnFloatingText('STUNNED!',this.x,this.y-60,'#94a3b8',30);
            }
        } else if (this.log457State==='stunned') {
            this.log457Timer+=dt; this.vx=0; this.vy=0;
            if (this.log457Timer>=BALANCE.boss.log457StunDuration) {
                this.log457State=null; this.log457AttackBonus=0;
            }
            return;
        }

        if (this.state==='CHASE') {
            if (!player.isInvisible) { this.vx=Math.cos(this.angle)*this.moveSpeed; this.vy=Math.sin(this.angle)*this.moveSpeed; }
            else { this.vx*=0.95; this.vy*=0.95; }
            this.applyPhysics(dt);

            if (this.timer>2) {
                this.timer=0;
                const barkChance=(this.isRider&&this.phase===2)?0.40:(this.isRider)?0.18:0;
                if      (this.skills.log.cd<=0 && Math.random()<0.20) this.useLog457();
                else if (this.skills.graph.cd<=0 && Math.random()<0.25) this.useDeadlyGraph(player);
                else if (this.isRider && this.skills.bark.cd<=0 && Math.random()<barkChance) this.bark(player);
                else if (this.skills.slam.cd<=0 && Math.random()<0.30) this.useEquationSlam();
                else this.state=Math.random()<0.3?'ULTIMATE':'ATTACK';
            }
        } else if (this.state==='ATTACK') {
            this.vx*=0.9; this.vy*=0.9;
            const fr=this.phase===2?BALANCE.boss.phase2AttackFireRate:BALANCE.boss.attackFireRate;
            const bf=fr/(1+this.log457AttackBonus);
            if (this.timer>bf) {
                projectileManager.add(new Projectile(this.x,this.y,this.angle,BALANCE.boss.chalkProjectileSpeed,BALANCE.boss.chalkDamage,'#fff',false,'enemy'));
                if (this.phase===2) {
                    projectileManager.add(new Projectile(this.x,this.y,this.angle+0.3,BALANCE.boss.chalkProjectileSpeed,BALANCE.boss.chalkDamage,'#fff',false,'enemy'));
                    projectileManager.add(new Projectile(this.x,this.y,this.angle-0.3,BALANCE.boss.chalkProjectileSpeed,BALANCE.boss.chalkDamage,'#fff',false,'enemy'));
                }
                this.timer=0;
                if (Math.random()<0.08) this.state='CHASE';
            }
        } else if (this.state==='ULTIMATE') {
            this.vx=0; this.vy=0;
            if (this.timer>1) {
                const bullets=this.phase===2?BALANCE.boss.phase2UltimateBullets:BALANCE.boss.ultimateBullets;
                for(let i=0;i<bullets;i++){
                    const a=(Math.PI*2/bullets)*i;
                    projectileManager.add(new Projectile(this.x,this.y,a,BALANCE.boss.ultimateProjectileSpeed,BALANCE.boss.ultimateDamage,'#ef4444',true,'enemy'));
                }
                addScreenShake(15);
                spawnFloatingText('POP QUIZ!',this.x,this.y-80,'#facc15',40);
                Audio.playBossSpecial();
                this.state='CHASE'; this.timer=-1;
            }
        }

        if (d<this.radius+player.radius)
            player.takeDamage(BALANCE.boss.contactDamage*dt*(1+this.log457AttackBonus));

        if (window.UIManager) {
            window.UIManager.updateBossHUD(this);
            window.UIManager.updateBossSpeech(this);
        }
    }

    bark(player) {
        const P2=BALANCE.boss.phase2;
        this.skills.bark.cd=this.skills.bark.max;
        this.state='CHASE';
        const barkAngle=Math.atan2(player.y-this.y,player.x-this.x);
        const coneHalf=Math.PI/3.5;
        window.specialEffects.push(new BarkWave(this.x,this.y,barkAngle,coneHalf,P2.barkRange));
        const dx=player.x-this.x, dy=player.y-this.y, d=Math.hypot(dx,dy);
        if (d>0 && d<P2.barkRange) {
            const playerAngle=Math.atan2(dy,dx);
            let diff=playerAngle-barkAngle;
            while(diff>Math.PI) diff-=Math.PI*2;
            while(diff<-Math.PI) diff+=Math.PI*2;
            if (Math.abs(diff)<coneHalf) {
                player.takeDamage(P2.barkDamage);
                const pushMag=480;
                player.vx+=(dx/d)*pushMag; player.vy+=(dy/d)*pushMag;
                spawnFloatingText('BARK! 🐕',player.x,player.y-55,'#f59e0b',26);
                addScreenShake(10);
            }
        }
        spawnFloatingText('WOOF WOOF!',this.x,this.y-100,'#d97706',30);
        spawnParticles(this.x,this.y,12,'#d97706');
        Audio.playBossSpecial();
        this.speak('BARK BARK BARK!');
    }

    useEquationSlam() {
        this.skills.slam.cd=this.skills.slam.max; this.state='CHASE';
        addScreenShake(15);
        spawnFloatingText('EQUATION SLAM!',this.x,this.y-80,'#facc15',30);
        this.speak('Equation Slam!'); Audio.playBossSpecial();
        window.specialEffects.push(new EquationSlam(this.x,this.y));
    }

    useDeadlyGraph(player) {
        this.skills.graph.cd=this.skills.graph.max; this.state='CHASE';
        spawnFloatingText('DEADLY GRAPH!',this.x,this.y-80,'#3b82f6',30);
        this.speak('Feel the power of y=x!'); Audio.playBossSpecial();
        window.specialEffects.push(new DeadlyGraph(this.x,this.y,player.x,player.y,BALANCE.boss.graphDuration));
    }

    useLog457() {
        this.skills.log.cd=this.skills.log.max;
        this.log457State='charging'; this.log457Timer=0; this.state='CHASE';
        spawnFloatingText('log 4.57 = ?',this.x,this.y-80,'#ef4444',30);
        Audio.playBossSpecial();
    }

    async speak(context) {
        try {
            const text=await Gemini.getBossTaunt(context);
            if (text && window.UIManager) window.UIManager.showBossSpeech(text);
        } catch(e) { console.warn('Speech failed:',e); }
    }

    takeDamage(amt) {
        if (this.isInvulnerable) {
            spawnFloatingText('INVINCIBLE!',this.x,this.y-40,'#facc15',20);
            return;
        }
        this.hp-=amt;
        if (this.hp<=0) {
            this.dead=true; this.hp=0;
            spawnParticles(this.x,this.y,60,'#dc2626');
            spawnFloatingText('CLASS DISMISSED!',this.x,this.y,'#facc15',35);
            addScore(BALANCE.score.boss*this.difficulty);
            if (window.UIManager) window.UIManager.updateBossHUD(null);
            Audio.playAchievement();
            for(let i=0;i<3;i++){
                setTimeout(()=>window.powerups.push(new PowerUp(this.x+rand(-50,50),this.y+rand(-50,50))),i*200);
            }
            window.boss=null;
            Achievements.check('boss_down');
            setTimeout(()=>{
                setWave(getWave()+1);
                if (getWave()>BALANCE.waves.maxWaves) window.endGame('victory');
                else if (typeof window.startNextWave==='function') window.startNextWave();
            }, BALANCE.boss.nextWaveDelay);
        }
    }

    draw() {
        const screen=worldToScreen(this.x,this.y);
        const RIDER_OFFSET_Y=this.isRider?-22:0;
        CTX.save(); CTX.translate(screen.x,screen.y);

        if (this.log457State==='charging') {
            const sc=1+(this.log457Timer/2)*0.3;
            CTX.scale(sc,sc);
            const pu=Math.sin(this.log457Timer*10)*0.5+0.5;
            CTX.beginPath(); CTX.arc(0,0,70,0,Math.PI*2);
            CTX.fillStyle=`rgba(239,68,68,${pu*0.3})`; CTX.fill();
        }
        if (this.log457State==='active')  {CTX.shadowBlur=20;CTX.shadowColor='#facc15';}
        if (this.log457State==='stunned') {
            CTX.font='bold 30px Arial'; CTX.textAlign='center'; CTX.fillText('😵',0,-70);
        }
        if (this.state==='ULTIMATE') {
            CTX.beginPath(); CTX.arc(0,0,70,0,Math.PI*2);
            CTX.strokeStyle=`rgba(239,68,68,${Math.random()})`;
            CTX.lineWidth=5; CTX.stroke();
        }
        if (this.phase===2 && this.log457State!=='charging') {
            CTX.shadowBlur=20; CTX.shadowColor='#ef4444';
        }

        CTX.rotate(this.angle);
        if (this.isRider) this._drawDog();

        CTX.save(); CTX.translate(0,RIDER_OFFSET_Y);
        CTX.fillStyle='#f8fafc'; CTX.fillRect(-30,-30,60,60);
        CTX.fillStyle='#e2e8f0';
        CTX.beginPath(); CTX.moveTo(-30,-30); CTX.lineTo(-20,-20); CTX.lineTo(20,-20); CTX.lineTo(30,-30); CTX.closePath(); CTX.fill();
        CTX.fillStyle='#ef4444';
        CTX.beginPath(); CTX.moveTo(0,-20); CTX.lineTo(6,0); CTX.lineTo(0,25); CTX.lineTo(-6,0); CTX.closePath(); CTX.fill();
        CTX.fillStyle=this.log457State==='charging'?'#ff0000':'#e2e8f0';
        CTX.beginPath(); CTX.arc(0,0,24,0,Math.PI*2); CTX.fill();
        CTX.fillStyle='#94a3b8'; CTX.beginPath(); CTX.arc(0,0,26,Math.PI,0); CTX.fill();
        if (this.phase===2||this.log457State==='active') {
            CTX.fillStyle='#ef4444';
            CTX.fillRect(-12,-5,10,3); CTX.fillRect(2,-5,10,3);
        }
        CTX.fillStyle='#facc15'; CTX.fillRect(25,12,60,10);
        CTX.fillStyle='#000'; CTX.font='bold 8px Arial'; CTX.fillText('30cm',50,17);

        if (this.isEnraged) {
            const t=performance.now()/80;
            for(let i=0;i<4;i++){
                const px=Math.sin(t*.9+i*1.57)*18;
                const py=-Math.abs(Math.cos(t*1.1+i*1.57))*22-30;
                const ps=3+Math.sin(t+i)*1.5;
                CTX.globalAlpha=0.55+Math.sin(t+i)*0.3;
                CTX.fillStyle=i%2===0?'#ef4444':'#f97316';
                CTX.shadowBlur=8; CTX.shadowColor='#ef4444';
                CTX.beginPath(); CTX.arc(px,py,ps,0,Math.PI*2); CTX.fill();
            }
            CTX.globalAlpha=1; CTX.shadowBlur=0;
        }
        CTX.restore();
        CTX.restore();
    }

    _drawDog() {
        const P2=BALANCE.boss.phase2;
        const bodyCol =this.isEnraged?'#dc2626':P2.dogColor;
        const darkCol =this.isEnraged?'#991b1b':'#92400e';
        const lightCol=this.isEnraged?'#ef4444':'#b45309';
        const eyeCol  =this.isEnraged?'#facc15':'#1e293b';

        const legSpeed=this.isEnraged?9:4.5;
        const swingAmt=0.45;
        const swingA= Math.sin(this.dogLegTimer*legSpeed)*swingAmt;
        const swingB=-swingA;
        const LEG_LEN=20, PAW_RY=4;

        CTX.save(); CTX.globalAlpha=0.22; CTX.fillStyle='rgba(0,0,0,0.9)';
        CTX.beginPath(); CTX.ellipse(6,62,44,10,0,0,Math.PI*2); CTX.fill(); CTX.restore();

        const drawLeg=(pivotX,pivotY,swingAngle,pawTiltSign)=>{
            CTX.save(); CTX.translate(pivotX,pivotY); CTX.rotate(swingAngle);
            CTX.strokeStyle=darkCol; CTX.lineWidth=7; CTX.lineCap='round';
            CTX.beginPath(); CTX.moveTo(0,0); CTX.lineTo(0,LEG_LEN); CTX.stroke();
            CTX.fillStyle=darkCol; CTX.beginPath(); CTX.arc(0,LEG_LEN,3.5,0,Math.PI*2); CTX.fill();
            CTX.strokeStyle=darkCol; CTX.lineWidth=5;
            CTX.beginPath(); CTX.moveTo(0,LEG_LEN); CTX.lineTo(pawTiltSign*3,LEG_LEN+11); CTX.stroke();
            CTX.fillStyle=darkCol;
            CTX.beginPath(); CTX.ellipse(pawTiltSign*3,LEG_LEN+13,6,PAW_RY,pawTiltSign*.25,0,Math.PI*2); CTX.fill();
            CTX.restore();
        };
        drawLeg( 14,36, swingA,-1); drawLeg( 26,36, swingB, 1);
        drawLeg(-14,36, swingB,-1); drawLeg( -2,36, swingA, 1);

        CTX.fillStyle=bodyCol; CTX.strokeStyle=darkCol; CTX.lineWidth=2.5;
        CTX.beginPath(); CTX.ellipse(6,28,44,18,0,0,Math.PI*2); CTX.fill(); CTX.stroke();
        CTX.fillStyle=lightCol;
        CTX.beginPath(); CTX.ellipse(0,20,22,10,0,0,Math.PI*2); CTX.fill();

        const tailWag=Math.sin(this.dogLegTimer*(this.isEnraged?12:6))*18;
        CTX.strokeStyle=darkCol; CTX.lineWidth=6; CTX.lineCap='round';
        CTX.beginPath(); CTX.moveTo(-44,22);
        CTX.quadraticCurveTo(-58,8,-55+tailWag*.35,-6+tailWag); CTX.stroke();
        CTX.fillStyle=bodyCol;
        CTX.beginPath(); CTX.arc(-55+tailWag*.35,-7+tailWag,7,0,Math.PI*2); CTX.fill();

        CTX.fillStyle=bodyCol; CTX.strokeStyle=darkCol; CTX.lineWidth=2.5;
        CTX.beginPath(); CTX.arc(52,20,18,0,Math.PI*2); CTX.fill(); CTX.stroke();

        CTX.fillStyle=darkCol; CTX.strokeStyle=darkCol; CTX.lineWidth=1.5;
        CTX.beginPath(); CTX.ellipse(44,8,9,15,-0.5,0,Math.PI*2); CTX.fill();

        CTX.fillStyle=lightCol; CTX.strokeStyle=darkCol; CTX.lineWidth=1.5;
        CTX.beginPath(); CTX.ellipse(64,23,12,8,0.2,0,Math.PI*2); CTX.fill(); CTX.stroke();

        CTX.fillStyle='#1e293b';
        CTX.beginPath(); CTX.arc(71,20,3.5,0,Math.PI*2); CTX.fill();

        CTX.fillStyle=eyeCol; CTX.shadowBlur=this.isEnraged?8:0; CTX.shadowColor='#facc15';
        CTX.beginPath(); CTX.arc(56,13,4,0,Math.PI*2); CTX.fill();
        CTX.shadowBlur=0; CTX.fillStyle='#1e293b';
        CTX.beginPath(); CTX.arc(57,13,2,0,Math.PI*2); CTX.fill();

        CTX.strokeStyle=darkCol; CTX.lineWidth=2; CTX.lineCap='round';
        CTX.beginPath(); CTX.arc(63,24,5,0.1,Math.PI-0.1); CTX.stroke();

        if (this.isEnraged||Math.sin(this.dogLegTimer*3)>0.2) {
            CTX.fillStyle='#fb7185';
            CTX.beginPath(); CTX.ellipse(63,32,5,7,0,0,Math.PI*2); CTX.fill();
        }

        if (this.isEnraged) {
            const t=performance.now()/120;
            CTX.save();
            for(let i=0;i<5;i++){
                const ex=Math.sin(t*.7+i*1.26)*36;
                const ey=Math.cos(t*.9+i*1.26)*16+28;
                const er=3+Math.sin(t*1.5+i)*1.5;
                CTX.globalAlpha=0.5+Math.sin(t+i)*0.3;
                CTX.fillStyle=i%2===0?'#ef4444':'#f97316';
                CTX.shadowBlur=10; CTX.shadowColor='#ef4444';
                CTX.beginPath(); CTX.arc(ex,ey,er,0,Math.PI*2); CTX.fill();
            }
            CTX.restore();
        }
    }
}

// ─── Mobile patch (keep original signature) ──────────────────
if (typeof Player !== 'undefined') {
    const __origUpdate = Player.prototype.update;
    Player.prototype.update = function(dt, keys, mouse) {
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            keys.w = keys.a = keys.s = keys.d = 0;
            this.__mobile_ax = window.touchJoystickLeft.nx;
            this.__mobile_ay = window.touchJoystickLeft.ny;
        } else {
            this.__mobile_ax = null;
            this.__mobile_ay = null;
        }
        __origUpdate.call(this, dt, keys, mouse);
        if (this.__mobile_ax !== null) {
            const ax=this.__mobile_ax, ay=this.__mobile_ay;
            const len=Math.hypot(ax,ay)||1;
            this.vx += ax/len * BALANCE.physics.acceleration * dt;
            this.vy += ay/len * BALANCE.physics.acceleration * dt;
        }
        if (window.touchJoystickRight && window.touchJoystickRight.active &&
            (window.touchJoystickRight.nx!==0||window.touchJoystickRight.ny!==0)) {
            this.angle=Math.atan2(window.touchJoystickRight.ny, window.touchJoystickRight.nx);
        }
    };
}

// ─── Node/bundler export ──────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Entity, Player, PoomPlayer, NagaEntity, Enemy, TankEnemy, MageEnemy, PowerUp, Drone, BarkWave, Boss };
}