/**
 * 👾 MTC: ENHANCED EDITION - Game Entities (FIXED + POOM)
 * Player, PoomPlayer, NagaEntity, Enemies, Boss, PowerUps
 *
 * FIXED BUGS:
 * - ✅ Confused status timer now properly counts down and expires
 * NEW:
 * - ✅ PoomPlayer: คนอีสาน ปาข้าวเหนียว + กินข้าวเหนียว + อัญเชิญพญานาค
 * - ✅ NagaEntity: พญานาคเลื้อยตามเมาส์ ทำ Damage ศัตรู
 */

// ────────────────────────────────────────────────────────────
// Base Entity Class
// ────────────────────────────────────────────────────────────
class Entity {
    constructor(x, y, radius) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.radius = radius;
        this.angle = 0;
        this.hp = 100; this.maxHp = 100;
        this.dead = false;
    }
    applyPhysics(dt) { this.x += this.vx * dt; this.y += this.vy * dt; }
}

// ────────────────────────────────────────────────────────────
// PLAYER (นักเรียน MTC — ตัวละครดั้งเดิม)
// ────────────────────────────────────────────────────────────
class Player extends Entity {
    constructor() {
        super(0, 0, 20);
        this.hp = BALANCE.player.hp;
        this.maxHp = BALANCE.player.maxHp;
        this.energy = BALANCE.player.energy;
        this.maxEnergy = BALANCE.player.maxEnergy;
        this.cooldowns = { dash: 0, stealth: 0, shoot: 0 };
        this.isDashing = false;
        this.isInvisible = false;
        this.ambushReady = false;
        this.walkCycle = 0;
        this.damageBoost = 1;
        this.speedBoost = 1;
        this.speedBoostTimer = 0;
        this.afterImages = [];
        this.onGraph = false;
        this.isConfused = false; this.confusedTimer = 0;
        this.isBurning = false; this.burnTimer = 0; this.burnDamage = 0;
        this.level = 1; this.exp = 0; this.expToNextLevel = 100;
        this.baseCritChance = 0.05;
        this.passiveUnlocked = false;
        this.stealthUseCount = 0;
        this.goldenAuraTimer = 0;
    }

    update(dt, keys, mouse) {
        // ── Status effects ──
        if (this.isBurning) {
            this.burnTimer -= dt;
            this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15,15), this.y + rand(-15,15), 1, '#f59e0b');
        }
        // ✅ FIXED: นับถอยหลังสถานะมึนงง
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) { this.isConfused = false; this.confusedTimer = 0; }
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
        if (this.goldenAuraTimer > 0) {
            this.goldenAuraTimer -= dt;
            if (Math.random() < 0.5) spawnParticles(this.x + rand(-25,25), this.y + rand(-25,25), 1, '#fbbf24');
        }

        // ── Movement ──
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

        let speedMult = (this.isInvisible ? BALANCE.player.stealthSpeedBonus : 1) * this.speedBoost;
        if (this.speedBoostTimer > 0) speedMult += BALANCE.player.speedOnHit / BALANCE.player.moveSpeed;
        if (!this.isDashing) {
            this.vx += ax * BALANCE.player.acceleration * dt;
            this.vy += ay * BALANCE.player.acceleration * dt;
            this.vx *= BALANCE.player.friction; this.vy *= BALANCE.player.friction;
            const cs = Math.hypot(this.vx, this.vy);
            if (cs > BALANCE.player.moveSpeed * speedMult) {
                const scale = BALANCE.player.moveSpeed * speedMult / cs;
                this.vx *= scale; this.vy *= scale;
            }
        }
        this.applyPhysics(dt);
        this.x = clamp(this.x, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        this.y = clamp(this.y, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);

        // ── Skills ──
        if (this.cooldowns.dash > 0) this.cooldowns.dash -= dt;
        if (keys.space && this.cooldowns.dash <= 0) { this.dash(ax || 1, ay || 0); keys.space = 0; }
        if (this.cooldowns.stealth > 0) this.cooldowns.stealth -= dt;
        if (mouse.right && this.cooldowns.stealth <= 0 && !this.isInvisible && this.energy >= BALANCE.player.stealthCost) {
            this.activateStealth(); mouse.right = 0;
        }
        if (this.isInvisible) {
            this.energy -= BALANCE.player.stealthDrain * dt;
            if (this.energy <= 0) { this.energy = 0; this.breakStealth(); }
        } else { this.energy = Math.min(this.maxEnergy, this.energy + 15 * dt); }

        // ── Aiming ──
        if (window.touchJoystickRight && window.touchJoystickRight.active) {
            this.angle = Math.atan2(window.touchJoystickRight.ny, window.touchJoystickRight.nx);
        } else { this.angle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x); }

        for (let i = this.afterImages.length - 1; i >= 0; i--) {
            this.afterImages[i].life -= dt * 5;
            if (this.afterImages[i].life <= 0) this.afterImages.splice(i, 1);
        }
        this.updateUI();
    }

    dash(ax, ay) {
        this.isDashing = true;
        this.cooldowns.dash = BALANCE.player.dashCooldown;
        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        this.vx = Math.cos(angle) * (BALANCE.player.dashDistance / 0.2);
        this.vy = Math.sin(angle) * (BALANCE.player.dashDistance / 0.2);
        for (let i = 0; i < 5; i++) setTimeout(() => {
            this.afterImages.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
        }, i * 30);
        spawnParticles(this.x, this.y, 15, '#60a5fa');
        Audio.playDash();
        Achievements.stats.dashes++; Achievements.check('speedster');
        setTimeout(() => { this.isDashing = false; }, 200);
    }

    activateStealth() {
        this.isInvisible = true; this.ambushReady = true;
        this.energy -= BALANCE.player.stealthCost;
        this.stealthUseCount++;
        spawnParticles(this.x, this.y, 25, '#facc15');
        showVoiceBubble("เข้าโหมดซุ่ม!", this.x, this.y - 40);
        this.checkPassiveUnlock();
        Achievements.stats.stealths++; Achievements.check('ghost');
    }

    breakStealth() { this.isInvisible = false; this.cooldowns.stealth = BALANCE.player.stealthCooldown; }

    checkPassiveUnlock() {
        if (!this.passiveUnlocked && this.level >= 3 && this.stealthUseCount >= 5) {
            this.passiveUnlocked = true;
            const hpBonus = Math.floor(this.maxHp * 0.5);
            this.maxHp += hpBonus; this.hp += hpBonus;
            spawnFloatingText('ปลดล็อค: ซุ่มเสรี!', this.x, this.y - 60, '#fbbf24', 30);
            spawnParticles(this.x, this.y, 50, '#fbbf24');
            addScreenShake(15); this.goldenAuraTimer = 3;
            Audio.playAchievement();
            showVoiceBubble("ทักษะ 'ซุ่มเสรี' ปลดล็อคแล้ว!", this.x, this.y - 40);
        }
    }

    gainExp(amount) {
        this.exp += amount;
        spawnFloatingText(`+${amount} EXP`, this.x, this.y - 50, '#8b5cf6', 14);
        while (this.exp >= this.expToNextLevel) this.levelUp();
        this.updateUI();
    }

    levelUp() {
        this.exp -= this.expToNextLevel;
        this.level++;
        this.expToNextLevel = Math.floor(this.expToNextLevel * 1.5);
        this.hp = this.maxHp; this.energy = this.maxEnergy;
        spawnFloatingText(`LEVEL ${this.level}!`, this.x, this.y - 70, '#facc15', 35);
        spawnParticles(this.x, this.y, 40, '#facc15');
        addScreenShake(12); Audio.playLevelUp();
        this.checkPassiveUnlock();
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
        let damage = baseDamage, isCrit = false;
        let critChance = this.baseCritChance;
        if (this.passiveUnlocked) critChance += 0.035;
        if (Math.random() < critChance) {
            damage *= BALANCE.player.critMultiplier; isCrit = true;
            if (this.passiveUnlocked) this.goldenAuraTimer = 1;
            Achievements.stats.crits++; Achievements.check('crit_master');
        }
        if (this.passiveUnlocked) {
            const healAmount = damage * 0.02;
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

    addSpeedBoost() { this.speedBoostTimer = BALANCE.player.speedOnHitDuration; }

    draw() {
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
            const auraSize = 35 + Math.sin(performance.now() / 200) * 5;
            const auraAlpha = 0.3 + Math.sin(performance.now() / 300) * 0.1;
            CTX.save(); CTX.globalAlpha = auraAlpha; CTX.strokeStyle = '#fbbf24';
            CTX.lineWidth = 3; CTX.shadowBlur = 20; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, auraSize, 0, Math.PI * 2); CTX.stroke(); CTX.restore();
        }

        if (this.isConfused) { CTX.font = 'bold 24px Arial'; CTX.fillText('😵', screen.x, screen.y - 40); }
        if (this.isBurning) { CTX.font = 'bold 20px Arial'; CTX.fillText('🔥', screen.x + 20, screen.y - 35); }

        CTX.save(); CTX.translate(screen.x, screen.y); CTX.rotate(this.angle);
        CTX.globalAlpha = this.isInvisible ? 0.3 : 1;
        const w = Math.sin(this.walkCycle) * 8;
        CTX.fillStyle = '#1e293b';
        CTX.beginPath(); CTX.ellipse(5 + w, 10, 6, 4, 0, 0, Math.PI * 2); CTX.fill();
        CTX.beginPath(); CTX.ellipse(5 - w, -10, 6, 4, 0, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#f8fafc'; CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 6); CTX.fill();
        CTX.fillStyle = '#1e40af';
        CTX.beginPath(); CTX.moveTo(0, -12); CTX.lineTo(-3, 0); CTX.lineTo(-5, 12);
        CTX.lineTo(0, 15); CTX.lineTo(5, 12); CTX.lineTo(3, 0); CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#2563eb'; CTX.font = 'bold 8px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillText("MTC", 0, -5);
        CTX.fillStyle = '#ffdfc4'; CTX.beginPath(); CTX.arc(0, 0, 13, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#0f172a';
        CTX.beginPath(); CTX.arc(0, 0, 14, Math.PI * 1.1, Math.PI * 2.9); CTX.fill();
        CTX.beginPath(); CTX.arc(-8, -5, 6, 0, Math.PI * 2); CTX.fill();
        CTX.beginPath(); CTX.arc(8, -5, 6, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#333'; CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.arc(-6, 0, 5, 0, Math.PI * 2);
        CTX.moveTo(7, 0); CTX.arc(6, 0, 5, 0, Math.PI * 2);
        CTX.moveTo(-1, 0); CTX.lineTo(1, 0); CTX.stroke();
        const t = performance.now() / 500;
        const gl = Math.abs(Math.sin(t)) * 0.8 + 0.2;
        CTX.fillStyle = `rgba(255,255,255,${gl})`;
        CTX.fillRect(-8, -2, 3, 2); CTX.fillRect(4, -2, 3, 2);
        CTX.fillStyle = '#ffdfc4'; CTX.beginPath(); CTX.arc(10, 15, 5, 0, Math.PI * 2); CTX.fill();
        weaponSystem.drawWeaponOnPlayer(this);
        CTX.fillStyle = '#ffdfc4'; CTX.beginPath(); CTX.arc(8, -15, 5, 0, Math.PI * 2); CTX.fill();
        CTX.restore();

        if (this.level > 1) {
            CTX.fillStyle = 'rgba(139, 92, 246, 0.9)';
            CTX.beginPath(); CTX.arc(screen.x + 22, screen.y - 22, 10, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#fff'; CTX.font = 'bold 10px Arial';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(this.level, screen.x + 22, screen.y - 22);
        }
    }

    updateUI() {
        document.getElementById('hp-bar').style.width = `${this.hp / this.maxHp * 100}%`;
        document.getElementById('en-bar').style.width = `${this.energy / this.maxEnergy * 100}%`;
        const dp = Math.min(100, (1 - this.cooldowns.dash / BALANCE.player.dashCooldown) * 100);
        document.getElementById('dash-cd').style.height = `${100 - dp}%`;
        if (this.isInvisible) {
            document.getElementById('stealth-icon').classList.add('active');
            document.getElementById('stealth-cd').style.height = '0%';
        } else {
            document.getElementById('stealth-icon').classList.remove('active');
            const sp = Math.min(100, (1 - this.cooldowns.stealth / BALANCE.player.stealthCooldown) * 100);
            document.getElementById('stealth-cd').style.height = `${100 - sp}%`;
        }
        const levelEl = document.getElementById('player-level');
        if (levelEl) levelEl.textContent = `Lv.${this.level}`;
        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;
        const passiveEl = document.getElementById('passive-skill');
        if (passiveEl) {
            if (this.passiveUnlocked) { passiveEl.classList.add('unlocked'); passiveEl.style.opacity = '1'; }
            else if (this.level >= 3) {
                passiveEl.style.display = 'flex'; passiveEl.style.opacity = '0.5';
                const skillName = passiveEl.querySelector('.skill-name');
                if (skillName) skillName.textContent = `${this.stealthUseCount}/5`;
            }
        }
    }
}

// ────────────────────────────────────────────────────────────
// 🌾 POOM PLAYER (ภูมิ — คนอีสาน)
// ────────────────────────────────────────────────────────────
class PoomPlayer extends Entity {
    constructor() {
        super(0, 0, 20);
        this.hp = BALANCE.poom.hp;
        this.maxHp = BALANCE.poom.maxHp;
        this.energy = BALANCE.poom.energy;
        this.maxEnergy = BALANCE.poom.maxEnergy;
        this.cooldowns = { dash: 0, eat: 0, naga: 0, shoot: 0 };
        this.isDashing = false;
        // compat fields ที่ boss/enemy ต้องการ
        this.isInvisible = false; this.ambushReady = false;
        this.passiveUnlocked = false; this.stealthUseCount = 0; this.goldenAuraTimer = 0;
        this.walkCycle = 0;
        this.damageBoost = 1; this.speedBoost = 1; this.speedBoostTimer = 0;
        this.afterImages = [];
        this.onGraph = false;
        this.isConfused = false; this.confusedTimer = 0;
        this.isBurning = false; this.burnTimer = 0; this.burnDamage = 0;
        // Skill state
        this.isEatingRice = false; this.eatRiceTimer = 0;
        this.currentSpeedMult = 1;   // Skill 1 ปรับ speed (ลบ currentAttackMult — ใช้ critBonus แทน)
        this.nagaCount = 0;
        // Level
        this.level = 1; this.exp = 0; this.expToNextLevel = 100;
        this.baseCritChance = BALANCE.poom.critChance;
    }

    update(dt, keys, mouse) {
        // ── Status effects ──
        if (this.isBurning) {
            this.burnTimer -= dt; this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15,15), this.y + rand(-15,15), 1, '#f59e0b');
        }
        // ✅ FIXED: นับถอยหลังสถานะมึนงง
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) { this.isConfused = false; this.confusedTimer = 0; }
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;

        // ── Skill 1: กินข้าวเหนียว timer ──
        if (this.isEatingRice) {
            this.eatRiceTimer -= dt;
            // Buff: +30% speed (Spec) + +25% crit chance handled in dealDamage()
            this.currentSpeedMult = BALANCE.poom.eatRiceSpeedMult;
            if (Math.random() < 0.2) spawnParticles(this.x + rand(-20,20), this.y + rand(-20,20), 1, '#fbbf24');
            if (this.eatRiceTimer <= 0) {
                this.isEatingRice = false;
                this.currentSpeedMult = 1;
                spawnFloatingText('หมดฤทธิ์!', this.x, this.y - 40, '#94a3b8', 14);
            }
        }

        // ── Movement ──
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
        if (this.speedBoostTimer > 0) speedMult += BALANCE.poom.speedOnHit / BALANCE.poom.moveSpeed;
        if (!this.isDashing) {
            this.vx += ax * BALANCE.poom.acceleration * dt;
            this.vy += ay * BALANCE.poom.acceleration * dt;
            this.vx *= BALANCE.poom.friction; this.vy *= BALANCE.poom.friction;
            const cs = Math.hypot(this.vx, this.vy);
            if (cs > BALANCE.poom.moveSpeed * speedMult) {
                const scale = BALANCE.poom.moveSpeed * speedMult / cs;
                this.vx *= scale; this.vy *= scale;
            }
        }
        this.applyPhysics(dt);
        this.x = clamp(this.x, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        this.y = clamp(this.y, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);

        // ── Cooldowns ──
        if (this.cooldowns.dash > 0) this.cooldowns.dash -= dt;
        if (this.cooldowns.eat > 0)  this.cooldowns.eat  -= dt;
        if (this.cooldowns.naga > 0) this.cooldowns.naga -= dt;
        if (this.cooldowns.shoot > 0) this.cooldowns.shoot -= dt;

        // ── Dash (Space) ──
        if (keys.space && this.cooldowns.dash <= 0) { this.dash(ax || 1, ay || 0); keys.space = 0; }

        // ── Skill 1: กินข้าวเหนียว (E) ──
        if (keys.e && this.cooldowns.eat <= 0 && !this.isEatingRice) { this.eatRice(); keys.e = 0; }

        // ── Skill 2: อัญเชิญพญานาค (R) ──
        if (keys.r && this.cooldowns.naga <= 0) { this.summonNaga(); keys.r = 0; }

        // Energy regen
        this.energy = Math.min(this.maxEnergy, this.energy + 12 * dt);

        // ── Aiming ──
        if (window.touchJoystickRight && window.touchJoystickRight.active) {
            this.angle = Math.atan2(window.touchJoystickRight.ny, window.touchJoystickRight.nx);
        } else { this.angle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x); }

        for (let i = this.afterImages.length - 1; i >= 0; i--) {
            this.afterImages[i].life -= dt * 5;
            if (this.afterImages[i].life <= 0) this.afterImages.splice(i, 1);
        }
        this.updateUI();
    }

    // 🍚 ปาข้าวเหนียว — เรียกจาก game.js เมื่อ mouse.left
    shoot() {
        if (this.cooldowns.shoot > 0) return;
        this.cooldowns.shoot = BALANCE.poom.riceCooldown;   // ไม่มี attackMult แล้ว — Spec ใช้ critBonus แทน
        const { damage, isCrit } = this.dealDamage(BALANCE.poom.riceDamage * this.damageBoost);
        projectileManager.add(new Projectile(
            this.x, this.y, this.angle,
            BALANCE.poom.riceSpeed, damage,
            BALANCE.poom.riceColor, false, 'player'
        ));
        if (isCrit) spawnFloatingText('สาดข้าว!', this.x, this.y - 40, '#fbbf24', 18);
        this.speedBoostTimer = BALANCE.poom.speedOnHitDuration;
    }

    // 🥢 Skill 1
    eatRice() {
        this.isEatingRice = true;
        this.eatRiceTimer = BALANCE.poom.eatRiceDuration;
        this.cooldowns.eat = BALANCE.poom.eatRiceCooldown;
        spawnParticles(this.x, this.y, 30, '#fbbf24');
        spawnFloatingText('กินข้าวเหนียว!', this.x, this.y - 50, '#fbbf24', 22);
        showVoiceBubble('อร่อยแท้ๆ!', this.x, this.y - 40);
        addScreenShake(5); Audio.playPowerUp();
    }

    // 🐍 Skill 2
    summonNaga() {
        this.cooldowns.naga = BALANCE.poom.nagaCooldown;
        window.specialEffects.push(new NagaEntity(this.x, this.y, this));
        spawnParticles(this.x, this.y, 40, '#10b981');
        spawnFloatingText('อัญเชิญพญานาค!', this.x, this.y - 60, '#10b981', 24);
        showVoiceBubble('ขอพรพญานาค!', this.x, this.y - 40);
        addScreenShake(10); Audio.playAchievement();
        this.nagaCount++;
        if (this.nagaCount >= 3) Achievements.check('naga_summoner');
    }

    dash(ax, ay) {
        this.isDashing = true;
        this.cooldowns.dash = BALANCE.poom.dashCooldown;
        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        this.vx = Math.cos(angle) * (BALANCE.poom.dashDistance / 0.2);
        this.vy = Math.sin(angle) * (BALANCE.poom.dashDistance / 0.2);
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
        let damage = baseDamage, isCrit = false;
        // Base crit + Skill 1 bonus (+25% crit ตาม Spec)
        let critChance = this.baseCritChance;
        if (this.isEatingRice) critChance += BALANCE.poom.eatRiceCritBonus;
        if (Math.random() < critChance) {
            damage *= BALANCE.poom.critMultiplier; isCrit = true;
            Achievements.stats.crits++; Achievements.check('crit_master');
        }
        return { damage, isCrit };
    }

    heal(amt) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
        spawnFloatingText(`+${amt} HP`, this.x, this.y - 30, '#10b981');
        spawnParticles(this.x, this.y, 10, '#10b981'); Audio.playHeal();
    }

    addSpeedBoost() { this.speedBoostTimer = BALANCE.poom.speedOnHitDuration; }

    gainExp(amount) {
        this.exp += amount;
        spawnFloatingText(`+${amount} EXP`, this.x, this.y - 50, '#8b5cf6', 14);
        while (this.exp >= this.expToNextLevel) this.levelUp();
        this.updateUI();
    }

    levelUp() {
        this.exp -= this.expToNextLevel; this.level++;
        this.expToNextLevel = Math.floor(this.expToNextLevel * 1.5);
        this.hp = this.maxHp; this.energy = this.maxEnergy;
        spawnFloatingText(`LEVEL ${this.level}!`, this.x, this.y - 70, '#facc15', 35);
        spawnParticles(this.x, this.y, 40, '#facc15');
        addScreenShake(12); Audio.playLevelUp();
    }

    draw() {
        // After images (สีทอง)
        for (const img of this.afterImages) {
            const s = worldToScreen(img.x, img.y);
            CTX.save(); CTX.translate(s.x, s.y); CTX.rotate(img.angle);
            CTX.globalAlpha = img.life * 0.3; CTX.fillStyle = '#fbbf24';
            CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 8); CTX.fill(); CTX.restore();
        }

        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.3)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 25, 18, 8, 0, 0, Math.PI * 2); CTX.fill();

        // 🌟 ออร่าสีเหลืองตอนกินข้าวเหนียว
        if (this.isEatingRice) {
            const t = performance.now() / 200;
            const auraSize = 38 + Math.sin(t) * 6;
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

        // Status icons
        if (this.isConfused) { CTX.font = 'bold 24px Arial'; CTX.textAlign='center'; CTX.fillText('😵', screen.x, screen.y - 44); }
        if (this.isBurning) { CTX.font = 'bold 20px Arial'; CTX.fillText('🔥', screen.x + 20, screen.y - 35); }
        if (this.isEatingRice) { CTX.font = 'bold 18px Arial'; CTX.textAlign='center'; CTX.fillText('🍚', screen.x, screen.y - 44); }

        // ── Poom Sprite ──
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        const w = Math.sin(this.walkCycle) * 8;

        // Legs (กางเกงขาสั้นสีน้ำเงิน)
        CTX.fillStyle = '#1e3a8a';
        CTX.beginPath(); CTX.ellipse(5 + w, 12, 7, 5, 0, 0, Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.ellipse(5 - w, -12, 7, 5, 0, 0, Math.PI*2); CTX.fill();

        // Body: ผ้าขาวม้าลายตาราง (พื้นแดง)
        CTX.fillStyle = '#dc2626';
        CTX.beginPath(); CTX.roundRect(-16, -13, 32, 26, 5); CTX.fill();

        // ลายตาราง — clip เพื่อไม่ให้เส้นล้นตัว
        CTX.save();
        CTX.beginPath(); CTX.roundRect(-16, -13, 32, 26, 5); CTX.clip();
        CTX.strokeStyle = 'rgba(255,255,255,0.5)'; CTX.lineWidth = 3;
        for (let xi = -16; xi <= 16; xi += 8) { CTX.beginPath(); CTX.moveTo(xi,-13); CTX.lineTo(xi,13); CTX.stroke(); }
        for (let yi = -13; yi <= 13; yi += 7) { CTX.beginPath(); CTX.moveTo(-16,yi); CTX.lineTo(16,yi); CTX.stroke(); }
        CTX.strokeStyle = 'rgba(255,255,255,0.18)'; CTX.lineWidth = 1.5;
        for (let d = -30; d < 40; d += 10) { CTX.beginPath(); CTX.moveTo(d-13,-13); CTX.lineTo(d+13,13); CTX.stroke(); }
        CTX.restore();

        // Hands
        CTX.fillStyle = '#d4a574';
        CTX.beginPath(); CTX.arc(10, 14, 5, 0, Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.arc(8, -14, 5, 0, Math.PI*2); CTX.fill();

        // Head (ผิวแดดอีสาน)
        CTX.fillStyle = '#d4a574';
        CTX.beginPath(); CTX.arc(0, 0, 13, 0, Math.PI*2); CTX.fill();

        // Hair (ดำสั้น)
        CTX.fillStyle = '#0f172a';
        CTX.beginPath(); CTX.arc(0, 0, 14, Math.PI*1.15, Math.PI*2.85); CTX.fill();
        CTX.beginPath(); CTX.arc(-7, -4, 5, 0, Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.arc(7, -4, 5, 0, Math.PI*2); CTX.fill();

        // Eyes
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.arc(-5, 1, 4.5, 0, Math.PI*2); CTX.moveTo(6,1); CTX.arc(5, 1, 4.5, 0, Math.PI*2); CTX.stroke();
        const tg = performance.now() / 500;
        CTX.fillStyle = `rgba(255,255,255,${Math.abs(Math.sin(tg))*0.7+0.3})`;
        CTX.fillRect(-7,-1,3,2); CTX.fillRect(3,-1,3,2);

        // Smile (ยิ้มแฮะ)
        CTX.strokeStyle = '#7c3c2a'; CTX.lineWidth = 2;
        CTX.beginPath(); CTX.arc(0, 2, 5, 0.1, Math.PI-0.1); CTX.stroke();

        CTX.restore();

        // Level badge (สีส้มอีสาน)
        if (this.level > 1) {
            CTX.fillStyle = 'rgba(234, 88, 12, 0.9)';
            CTX.beginPath(); CTX.arc(screen.x+22, screen.y-22, 10, 0, Math.PI*2); CTX.fill();
            CTX.fillStyle = '#fff'; CTX.font = 'bold 10px Arial';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(this.level, screen.x+22, screen.y-22);
        }
    }

    updateUI() {
        const hpBar = document.getElementById('hp-bar');
        const enBar = document.getElementById('en-bar');
        if (hpBar) hpBar.style.width = `${this.hp / this.maxHp * 100}%`;
        if (enBar) enBar.style.width = `${this.energy / this.maxEnergy * 100}%`;

        const dpEl = document.getElementById('dash-cd');
        if (dpEl) {
            const dp = Math.min(100, (1 - this.cooldowns.dash / BALANCE.poom.dashCooldown) * 100);
            dpEl.style.height = `${100 - dp}%`;
        }
        // Skill 1 cooldown
        const eatCd = document.getElementById('eat-cd');
        if (eatCd) {
            if (this.isEatingRice) { eatCd.style.height = '0%'; document.getElementById('eat-icon')?.classList.add('active'); }
            else {
                document.getElementById('eat-icon')?.classList.remove('active');
                const ep = Math.min(100, (1 - this.cooldowns.eat / BALANCE.poom.eatRiceCooldown) * 100);
                eatCd.style.height = `${100 - ep}%`;
            }
        }
        // Skill 2 cooldown
        const nagaCd = document.getElementById('naga-cd');
        if (nagaCd) {
            const np = Math.min(100, (1 - this.cooldowns.naga / BALANCE.poom.nagaCooldown) * 100);
            nagaCd.style.height = `${100 - np}%`;
        }
        const levelEl = document.getElementById('player-level');
        if (levelEl) levelEl.textContent = `Lv.${this.level}`;
        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;
    }
}

// ────────────────────────────────────────────────────────────
// 🐍 NAGA ENTITY (พญานาคเลื้อยตามเมาส์)
// ────────────────────────────────────────────────────────────
class NagaEntity {
    constructor(startX, startY, owner) {
        this.owner = owner;
        const n = BALANCE.poom.nagaSegments;
        this.segments = Array.from({ length: n }, () => ({ x: startX, y: startY }));
        this.life = BALANCE.poom.nagaDuration;
        this.maxLife = BALANCE.poom.nagaDuration;
        // ✅ ใช้ key ใหม่ตาม Spec: nagaSpeed (จาก nagaFollowSpeed), nagaDamage (จาก nagaDPS)
        this.speed = BALANCE.poom.nagaSpeed;
        this.damage = BALANCE.poom.nagaDamage;   // damage per-hit (สัมผัส)
        this.radius = BALANCE.poom.nagaRadius;
    }

    // interface: update(dt, player, _meteorZones) → true = remove
    update(dt, player, _meteorZones) {
        this.life -= dt;
        if (this.life <= 0) return true;

        // หัวตามเมาส์
        const head = this.segments[0];
        const dx = mouse.wx - head.x, dy = mouse.wy - head.y;
        const d = Math.hypot(dx, dy);
        if (d > 8) {
            const step = Math.min(this.speed * dt, d);
            head.x += (dx / d) * step; head.y += (dy / d) * step;
        }

        // แต่ละ segment ตาม segment ก่อนหน้า
        const segDist = BALANCE.poom.nagaSegmentDistance;
        for (let i = 1; i < this.segments.length; i++) {
            const prev = this.segments[i - 1], curr = this.segments[i];
            const sdx = curr.x - prev.x, sdy = curr.y - prev.y;
            const sd = Math.hypot(sdx, sdy);
            if (sd > segDist) { curr.x = prev.x + (sdx/sd)*segDist; curr.y = prev.y + (sdy/sd)*segDist; }
        }

        // Damage ศัตรู (damage per-second = nagaDamage × dt → smooth per-frame)
        for (const enemy of (window.enemies || [])) {
            if (enemy.dead) continue;
            for (const seg of this.segments) {
                if (dist(seg.x, seg.y, enemy.x, enemy.y) < this.radius + enemy.radius) {
                    enemy.takeDamage(this.damage * dt, player);
                    if (Math.random() < 0.1) spawnParticles(seg.x, seg.y, 2, '#10b981');
                    break;
                }
            }
        }
        // Damage บอส (ลดลง 40% — ป้องกัน OP)
        if (window.boss && !window.boss.dead) {
            for (const seg of this.segments) {
                if (dist(seg.x, seg.y, window.boss.x, window.boss.y) < this.radius + window.boss.radius) {
                    window.boss.takeDamage(this.damage * dt * 0.4);
                    break;
                }
            }
        }
        return false;
    }

    draw() {
        const lifeRatio = this.life / this.maxLife;
        // วาดจาก tail → head เพื่อให้หัวอยู่บนสุด
        for (let i = this.segments.length - 1; i >= 0; i--) {
            const seg = this.segments[i];
            const screen = worldToScreen(seg.x, seg.y);
            const t = i / (this.segments.length - 1);
            const r = this.radius * (1 - t * 0.55);
            const alpha = lifeRatio * (1 - t * 0.3);

            CTX.save(); CTX.globalAlpha = Math.max(0.1, alpha);

            if (i === 0) {
                // หัว (ทอง)
                CTX.fillStyle = '#fbbf24'; CTX.shadowBlur = 20; CTX.shadowColor = '#fbbf24';
                CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI*2); CTX.fill();
                CTX.shadowBlur = 0;
                // ตา
                CTX.fillStyle = '#ef4444';
                CTX.beginPath(); CTX.arc(screen.x - r*0.35, screen.y - r*0.2, r*0.25, 0, Math.PI*2); CTX.fill();
                CTX.beginPath(); CTX.arc(screen.x + r*0.35, screen.y - r*0.2, r*0.25, 0, Math.PI*2); CTX.fill();
                // เขี้ยว
                CTX.fillStyle = '#fff';
                CTX.beginPath();
                CTX.moveTo(screen.x - r*0.3, screen.y + r*0.4);
                CTX.lineTo(screen.x - r*0.15, screen.y + r*0.8);
                CTX.lineTo(screen.x, screen.y + r*0.4);
                CTX.fill();
            } else if (i === this.segments.length - 1) {
                // หาง
                CTX.fillStyle = '#065f46'; CTX.shadowBlur = 6; CTX.shadowColor = '#10b981';
                CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI*2); CTX.fill();
            } else {
                // ลำตัว
                CTX.fillStyle = i % 2 === 0 ? '#10b981' : '#059669';
                CTX.shadowBlur = 10; CTX.shadowColor = '#10b981';
                CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI*2); CTX.fill();
                if (i % 2 === 0 && r > 8) {
                    CTX.strokeStyle = 'rgba(6,95,70,0.6)'; CTX.lineWidth = 1.5;
                    CTX.beginPath(); CTX.arc(screen.x, screen.y, r*0.7, 0, Math.PI*2); CTX.stroke();
                }
            }
            CTX.restore();
        }
        // แสดงเวลาที่เหลือเหนือหัว
        if (this.segments.length > 0) {
            const hs = worldToScreen(this.segments[0].x, this.segments[0].y);
            CTX.fillStyle = `rgba(251,191,36,${lifeRatio})`;
            CTX.font = 'bold 10px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(`${this.life.toFixed(1)}s`, hs.x, hs.y - 32);
        }
    }
}

// ────────────────────────────────────────────────────────────
// ENEMIES
// ────────────────────────────────────────────────────────────
class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 18);
        this.maxHp = BALANCE.enemy.baseHp + getWave() * BALANCE.enemy.hpPerWave;
        this.hp = this.maxHp;
        this.speed = BALANCE.enemy.baseSpeed + getWave() * BALANCE.enemy.speedPerWave;
        this.damage = BALANCE.enemy.baseDamage + getWave() * BALANCE.enemy.damagePerWave;
        this.shootTimer = rand(...BALANCE.enemy.shootCooldown);
        this.color = randomChoice(['#ef4444', '#f59e0b', '#8b5cf6']);
        this.type = 'basic'; this.expValue = 10;
    }
    update(dt, player) {
        if (this.dead) return;
        const dx = player.x - this.x, dy = player.y - this.y, d = dist(this.x, this.y, player.x, player.y);
        this.angle = Math.atan2(dy, dx);
        if (d > 150 && !player.isInvisible) { this.vx = Math.cos(this.angle)*this.speed; this.vy = Math.sin(this.angle)*this.speed; }
        else { this.vx *= 0.9; this.vy *= 0.9; }
        this.applyPhysics(dt);
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && d < BALANCE.enemy.shootRange && !player.isInvisible) {
            projectileManager.add(new Projectile(this.x, this.y, this.angle, 500, this.damage, '#fff', false, 'enemy'));
            this.shootTimer = rand(...BALANCE.enemy.shootCooldown);
        }
        if (d < this.radius + player.radius) player.takeDamage(this.damage * dt * 3);
    }
    takeDamage(amt, player) {
        this.hp -= amt;
        if (this.hp <= 0) {
            this.dead = true; this.hp = 0;
            spawnParticles(this.x, this.y, 20, this.color);
            addScore(BALANCE.score.basicEnemy * getWave()); addEnemyKill(); Audio.playEnemyDeath();
            if (player) player.gainExp(this.expValue);
            Achievements.stats.kills++; Achievements.check('first_blood');
            if (Math.random() < BALANCE.powerups.dropRate) window.powerups.push(new PowerUp(this.x, this.y));
        }
    }
    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.3)'; CTX.beginPath();
        CTX.ellipse(screen.x, screen.y+20, 15, 7, 0, 0, Math.PI*2); CTX.fill();
        CTX.save(); CTX.translate(screen.x, screen.y); CTX.rotate(this.angle);
        CTX.fillStyle = this.color; CTX.beginPath(); CTX.arc(0,0,this.radius,0,Math.PI*2); CTX.fill();
        CTX.fillStyle = '#000'; CTX.beginPath(); CTX.arc(8,0,4,0,Math.PI*2); CTX.fill(); CTX.restore();
        const hp = this.hp/this.maxHp, bw = 30;
        CTX.fillStyle = '#1e293b'; CTX.fillRect(screen.x-bw/2, screen.y-30, bw, 4);
        CTX.fillStyle = '#ef4444'; CTX.fillRect(screen.x-bw/2, screen.y-30, bw*hp, 4);
    }
}

class TankEnemy extends Entity {
    constructor(x, y) {
        super(x, y, 25);
        this.maxHp = BALANCE.tank.baseHp + getWave() * BALANCE.tank.hpPerWave;
        this.hp = this.maxHp;
        this.speed = BALANCE.tank.baseSpeed + getWave() * BALANCE.tank.speedPerWave;
        this.damage = BALANCE.tank.baseDamage + getWave() * BALANCE.tank.damagePerWave;
        this.color = '#78716c'; this.type = 'tank'; this.expValue = 25;
    }
    update(dt, player) {
        if (this.dead) return;
        const dx = player.x-this.x, dy = player.y-this.y, d = dist(this.x,this.y,player.x,player.y);
        this.angle = Math.atan2(dy, dx);
        if (!player.isInvisible) { this.vx=Math.cos(this.angle)*this.speed; this.vy=Math.sin(this.angle)*this.speed; }
        else { this.vx*=0.95; this.vy*=0.95; }
        this.applyPhysics(dt);
        if (d < BALANCE.tank.meleeRange + player.radius) player.takeDamage(this.damage*dt*2);
    }
    takeDamage(amt, player) {
        this.hp -= amt;
        if (this.hp <= 0) {
            this.dead = true;
            spawnParticles(this.x, this.y, 30, this.color);
            addScore(BALANCE.score.tank*getWave()); addEnemyKill(); Audio.playEnemyDeath();
            if (player) player.gainExp(this.expValue);
            Achievements.stats.kills++;
            if (Math.random() < BALANCE.powerups.dropRate*1.5) window.powerups.push(new PowerUp(this.x,this.y));
        }
    }
    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.4)'; CTX.beginPath();
        CTX.ellipse(screen.x, screen.y+25, 20, 10, 0, 0, Math.PI*2); CTX.fill();
        CTX.save(); CTX.translate(screen.x, screen.y); CTX.rotate(this.angle);
        CTX.fillStyle = this.color; CTX.fillRect(-20,-20,40,40);
        CTX.fillStyle = '#57534e'; CTX.fillRect(-18,-18,12,36); CTX.fillRect(6,-18,12,36);
        CTX.fillStyle = '#dc2626'; CTX.beginPath(); CTX.arc(10,0,6,0,Math.PI*2); CTX.fill(); CTX.restore();
        const hp = this.hp/this.maxHp;
        CTX.fillStyle = '#1e293b'; CTX.fillRect(screen.x-20,screen.y-35,40,5);
        CTX.fillStyle = '#78716c'; CTX.fillRect(screen.x-20,screen.y-35,40*hp,5);
    }
}

class MageEnemy extends Entity {
    constructor(x, y) {
        super(x, y, 16);
        this.maxHp = BALANCE.mage.baseHp + getWave()*BALANCE.mage.hpPerWave;
        this.hp = this.maxHp;
        this.speed = BALANCE.mage.baseSpeed + getWave()*BALANCE.mage.speedPerWave;
        this.damage = BALANCE.mage.baseDamage + getWave()*BALANCE.mage.damagePerWave;
        this.color = '#a855f7'; this.type = 'mage';
        this.soundWaveCD = 0; this.meteorCD = 0; this.expValue = 30;
    }
    update(dt, player) {
        if (this.dead) return;
        const d = dist(this.x,this.y,player.x,player.y), od = 300;
        this.angle = Math.atan2(player.y-this.y, player.x-this.x);
        if (d < od && !player.isInvisible) { this.vx=-Math.cos(this.angle)*this.speed; this.vy=-Math.sin(this.angle)*this.speed; }
        else if (d > od+100) { this.vx=Math.cos(this.angle)*this.speed; this.vy=Math.sin(this.angle)*this.speed; }
        else { this.vx*=0.95; this.vy*=0.95; }
        this.applyPhysics(dt);
        if (this.soundWaveCD > 0) this.soundWaveCD -= dt;
        if (this.meteorCD > 0) this.meteorCD -= dt;
        if (this.soundWaveCD <= 0 && d < BALANCE.mage.soundWaveRange && !player.isInvisible) {
            player.isConfused = true; player.confusedTimer = BALANCE.mage.soundWaveConfuseDuration;
            spawnFloatingText('CONFUSED!', player.x, player.y-40, '#a855f7', 20);
            for (let i = 0; i < 360; i += 30) {
                const a = (i*Math.PI)/180;
                spawnParticles(this.x+Math.cos(a)*50, this.y+Math.sin(a)*50, 3, '#a855f7');
            }
            this.soundWaveCD = BALANCE.mage.soundWaveCooldown;
        }
        if (this.meteorCD <= 0 && Math.random() < 0.005) {
            window.specialEffects.push(new MeteorStrike(player.x+rand(-300,300), player.y+rand(-300,300)));
            this.meteorCD = BALANCE.mage.meteorCooldown;
            Audio.playMeteorWarning();
        }
    }
    takeDamage(amt, player) {
        this.hp -= amt;
        if (this.hp <= 0) {
            this.dead = true;
            spawnParticles(this.x, this.y, 25, this.color);
            addScore(BALANCE.score.mage*getWave()); addEnemyKill(); Audio.playEnemyDeath();
            if (player) player.gainExp(this.expValue);
            Achievements.stats.kills++;
            if (Math.random() < BALANCE.powerups.dropRate*1.3) window.powerups.push(new PowerUp(this.x,this.y));
        }
    }
    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.3)'; CTX.beginPath();
        CTX.ellipse(screen.x, screen.y+18, 13, 6, 0, 0, Math.PI*2); CTX.fill();
        CTX.save(); CTX.translate(screen.x, screen.y+Math.sin(performance.now()/300)*3); CTX.rotate(this.angle);
        CTX.fillStyle = this.color; CTX.beginPath(); CTX.arc(0,5,15,0,Math.PI*2); CTX.fill();
        CTX.strokeStyle = '#6b21a8'; CTX.lineWidth = 3; CTX.beginPath();
        CTX.moveTo(-10,0); CTX.lineTo(-10,-25); CTX.stroke();
        CTX.fillStyle = '#fbbf24'; CTX.shadowBlur = 10; CTX.shadowColor = '#fbbf24';
        CTX.beginPath(); CTX.arc(-10,-25,5,0,Math.PI*2); CTX.fill(); CTX.shadowBlur = 0;
        CTX.fillStyle = '#7c3aed'; CTX.beginPath(); CTX.arc(0,-5,12,0,Math.PI); CTX.fill(); CTX.restore();
        const hp = this.hp/this.maxHp;
        CTX.fillStyle = '#1e293b'; CTX.fillRect(screen.x-15,screen.y-30,30,4);
        CTX.fillStyle = '#a855f7'; CTX.fillRect(screen.x-15,screen.y-30,30*hp,4);
    }
}

// ────────────────────────────────────────────────────────────
// POWER-UPS
// ────────────────────────────────────────────────────────────
class PowerUp {
    constructor(x, y) {
        this.x=x; this.y=y; this.radius=20; this.life=BALANCE.powerups.lifetime;
        this.bobTimer=Math.random()*Math.PI*2;
        this.type=randomChoice(['heal','damage','speed']);
        this.icons={heal:'❤️',damage:'⚡',speed:'🚀'};
        this.colors={heal:'#10b981',damage:'#f59e0b',speed:'#3b82f6'};
    }
    update(dt, player) {
        this.life -= dt; this.bobTimer += dt*3;
        const d = dist(this.x,this.y,player.x,player.y);
        if (d < this.radius+player.radius) { this.collect(player); return true; }
        return this.life <= 0;
    }
    collect(player) {
        switch(this.type) {
            case 'heal': player.heal(BALANCE.powerups.healAmount); break;
            case 'damage':
                player.damageBoost = BALANCE.powerups.damageBoost;
                setTimeout(() => { player.damageBoost=1; }, BALANCE.powerups.damageBoostDuration*1000);
                spawnFloatingText('DAMAGE UP!',player.x,player.y-40,'#f59e0b',20); break;
            case 'speed':
                player.speedBoost = BALANCE.powerups.speedBoost;
                setTimeout(() => { player.speedBoost=1; }, BALANCE.powerups.speedBoostDuration*1000);
                spawnFloatingText('SPEED UP!',player.x,player.y-40,'#3b82f6',20);
        }
        spawnParticles(this.x,this.y,20,this.colors[this.type]);
        addScore(BALANCE.score.powerup); Audio.playPowerUp();
        Achievements.stats.powerups++; Achievements.check('collector');
    }
    draw() {
        const screen = worldToScreen(this.x, this.y+Math.sin(this.bobTimer)*5);
        CTX.save(); CTX.translate(screen.x, screen.y);
        CTX.shadowBlur=20; CTX.shadowColor=this.colors[this.type];
        CTX.font='32px Arial'; CTX.textAlign='center'; CTX.textBaseline='middle';
        CTX.fillText(this.icons[this.type],0,0); CTX.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Entity, Player, PoomPlayer, NagaEntity, Enemy, TankEnemy, MageEnemy, PowerUp };
}

// ===== SAFE MOBILE PATCH =====
if (typeof Player !== "undefined") {
    const __origUpdate = Player.prototype.update;
    Player.prototype.update = function(dt, keys, mouse) {
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            keys.w=keys.a=keys.s=keys.d=0;
            this.__mobile_ax=window.touchJoystickLeft.nx; this.__mobile_ay=window.touchJoystickLeft.ny;
        } else { this.__mobile_ax=null; this.__mobile_ay=null; }
        __origUpdate.call(this,dt,keys,mouse);
        if (this.__mobile_ax !== null) {
            const ax=this.__mobile_ax, ay=this.__mobile_ay;
            const len=Math.hypot(ax,ay)||1;
            this.vx+=ax/len*BALANCE.player.acceleration*dt;
            this.vy+=ay/len*BALANCE.player.acceleration*dt;
        }
        if (window.touchJoystickRight && window.touchJoystickRight.active &&
            (window.touchJoystickRight.nx!==0||window.touchJoystickRight.ny!==0)) {
            this.angle=Math.atan2(window.touchJoystickRight.ny,window.touchJoystickRight.nx);
        }
    };
}