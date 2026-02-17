/**
 * 👾 MTC: ENHANCED EDITION - Game Entities (FIXED)
 * Player, Enemies, Boss, PowerUps with Level System & Passive Skills
 * * FIXED BUGS:
 * - Added base crit chance (5%)
 * - Passive skill adds +2% crit chance on top of base
 * - Fixed damage calculation
 * - Syntax errors resolved
 * - ✅ FIXED: Confused status timer now properly counts down and expires
 */

// Base Entity Class
class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = radius;
        this.angle = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.dead = false;
    }
    
    applyPhysics(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
}

// ==================== PLAYER (WITH LEVEL SYSTEM) ====================
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
        this.isConfused = false;
        this.confusedTimer = 0;
        this.isBurning = false;
        this.burnTimer = 0;
        this.burnDamage = 0;
        
        // Level system
        this.level = 1;
        this.exp = 0;
        this.expToNextLevel = 100;
        
        // FIXED: Base crit chance
        this.baseCritChance = 0.05; // 5% base crit chance
        
        // Passive skill "ซุ่มเสรี"
        this.passiveUnlocked = false;
        this.stealthUseCount = 0;
        this.goldenAuraTimer = 0;
    }
    
    // ✅ This single, combined update method fixes the syntax error
    update(dt, keys, mouse) {
        // Status Effects
        if (this.isBurning) {
            this.burnTimer -= dt;
            this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15, 15), this.y + rand(-15, 15), 1, '#f59e0b');
        }
        
        // ✅ FIXED: นับถอยหลังและปิดสถานะมึนงง
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) {
                this.isConfused = false;
                this.confusedTimer = 0;
            }
        }
        
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
        
        // Golden aura animation
        if (this.goldenAuraTimer > 0) {
            this.goldenAuraTimer -= dt;
            if (Math.random() < 0.5) spawnParticles(this.x + rand(-25, 25), this.y + rand(-25, 25), 1, '#fbbf24');
        }
        
        // ==========================================
        // 🎮 [MOBILE & PC] MOVEMENT (เดิน)
        // ==========================================
        let ax = 0, ay = 0;
        let isTouchMove = false;
        
        // เช็คว่ามี Input จากจอยสติ๊กซ้าย (มือถือ) หรือไม่
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            ax = window.touchJoystickLeft.nx;
            ay = window.touchJoystickLeft.ny;
            isTouchMove = true;
        } else {
            // ถ้าไม่มี ให้ใช้คีย์บอร์ด (PC)
            if (keys.w) ay -= 1;
            if (keys.s) ay += 1;
            if (keys.a) ax -= 1;
            if (keys.d) ax += 1;
        }
        
        if (this.isConfused) { ax *= -1; ay *= -1; }
        
        if (ax || ay) {
            // ถ้ารับค่ามาจากคีย์บอร์ด (PC) ต้อง Normalize เพื่อไม่ให้เดินทแยงแล้วเร็วขึ้น
            if (!isTouchMove) {
                const len = Math.hypot(ax, ay);
                ax /= len; ay /= len;
            }
            this.walkCycle += dt * 15;
        } else {
            this.walkCycle = 0;
        }
        
        let speedMult = (this.isInvisible ? BALANCE.player.stealthSpeedBonus : 1) * this.speedBoost;
        if (this.speedBoostTimer > 0) speedMult += BALANCE.player.speedOnHit / BALANCE.player.moveSpeed;
        
        if (!this.isDashing) {
            this.vx += ax * BALANCE.player.acceleration * dt;
            this.vy += ay * BALANCE.player.acceleration * dt;
            this.vx *= BALANCE.player.friction;
            this.vy *= BALANCE.player.friction;
            const cs = Math.hypot(this.vx, this.vy);
            if (cs > BALANCE.player.moveSpeed * speedMult) {
                const scale = BALANCE.player.moveSpeed * speedMult / cs;
                this.vx *= scale; this.vy *= scale;
            }
        }
        
        this.applyPhysics(dt);
        this.x = clamp(this.x, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        this.y = clamp(this.y, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        
        // ==========================================
        // ⚔️ SKILLS & COOLDOWNS (สกิลและปุ่ม Action)
        // ==========================================
        if (this.cooldowns.dash > 0) this.cooldowns.dash -= dt;
        if (keys.space && this.cooldowns.dash <= 0) { this.dash(ax || 1, ay || 0); keys.space = 0; }
        
        if (this.cooldowns.stealth > 0) this.cooldowns.stealth -= dt;
        if (mouse.right && this.cooldowns.stealth <= 0 && !this.isInvisible && this.energy >= BALANCE.player.stealthCost) { 
            this.activateStealth(); 
            mouse.right = 0; 
        }
        
        if (this.isInvisible) {
            this.energy -= BALANCE.player.stealthDrain * dt;
            if (this.energy <= 0) {
                this.energy = 0;
                this.breakStealth();
            }
        } else {
            this.energy = Math.min(this.maxEnergy, this.energy + 15 * dt);
        }
        
        // ==========================================
        // 🎯 [MOBILE & PC] AIMING (เล็งและยิงปืน)
        // ==========================================
        if (window.touchJoystickRight && window.touchJoystickRight.active) {
            // ถ้าเล่นบนมือถือ (Twin-stick) ให้หันหน้าตัวละครตามจอยสติ๊กขวา
            this.angle = Math.atan2(window.touchJoystickRight.ny, window.touchJoystickRight.nx);
        } else {
            // ถ้าเล่นบน PC ให้หันหน้าตามจุดของเมาส์
            this.angle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x);
        }
        
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
        const distance = BALANCE.player.dashDistance;
        const time = 0.2;
        const speed = distance / time;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        for (let i = 0; i < 5; i++) setTimeout(() => {
            this.afterImages.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
        }, i * 30);
        
        spawnParticles(this.x, this.y, 15, '#60a5fa');
        Audio.playDash();
        Achievements.stats.dashes++;
        Achievements.check('speedster');
        setTimeout(() => { this.isDashing = false; }, 200);
    }
    
    activateStealth() {
        this.isInvisible = true;
        this.ambushReady = true;
        this.energy -= BALANCE.player.stealthCost;
        
        // Track stealth uses for passive skill
        this.stealthUseCount++;
        
        spawnParticles(this.x, this.y, 25, '#facc15');
        showVoiceBubble("เข้าโหมดซุ่ม!", this.x, this.y - 40);
        
        // Check if passive skill should unlock
        this.checkPassiveUnlock();
        
        Achievements.stats.stealths++;
        Achievements.check('ghost');
    }
    
    breakStealth() {
        this.isInvisible = false;
        this.cooldowns.stealth = BALANCE.player.stealthCooldown;
    }
    
    // Check and unlock passive skill
    checkPassiveUnlock() {
        if (!this.passiveUnlocked && this.level >= 3 && this.stealthUseCount >= 5) {
            this.passiveUnlocked = true;
            
            // Apply passive bonuses
            const hpBonus = Math.floor(this.maxHp * 0.5);
            this.maxHp += hpBonus;
            this.hp += hpBonus;
            
            // Visual effects
            spawnFloatingText('ปลดล็อค: ซุ่มเสรี!', this.x, this.y - 60, '#fbbf24', 30);
            spawnParticles(this.x, this.y, 50, '#fbbf24');
            addScreenShake(15);
            this.goldenAuraTimer = 3;
            
            Audio.playAchievement();
            showVoiceBubble("ทักษะ 'ซุ่มเสรี' ปลดล็อคแล้ว!", this.x, this.y - 40);
        }
    }
    
    // Gain experience
    gainExp(amount) {
        this.exp += amount;
        spawnFloatingText(`+${amount} EXP`, this.x, this.y - 50, '#8b5cf6', 14);
        
        // Level up check
        while (this.exp >= this.expToNextLevel) {
            this.levelUp();
        }
        
        this.updateUI();
    }
    
    // Level up
    levelUp() {
        this.exp -= this.expToNextLevel;
        this.level++;
        this.expToNextLevel = Math.floor(this.expToNextLevel * 1.5);
        
        // Heal on level up
        this.hp = this.maxHp;
        this.energy = this.maxEnergy;
        
        // Visual effects
        spawnFloatingText(`LEVEL ${this.level}!`, this.x, this.y - 70, '#facc15', 35);
        spawnParticles(this.x, this.y, 40, '#facc15');
        addScreenShake(12);
        Audio.playLevelUp();
        
        // Check passive unlock after level up
        this.checkPassiveUnlock();
    }
    
    takeDamage(amt) {
        if (this.isDashing) return;
        if (this.onGraph) { 
            amt *= 2; 
            spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16); 
        }
        
        this.hp -= amt;
        this.hp = Math.max(0, this.hp);
        spawnFloatingText(Math.round(amt), this.x, this.y - 30, '#ef4444');
        spawnParticles(this.x, this.y, 8, '#ef4444');
        addScreenShake(8);
        Audio.playHit();
        Achievements.stats.damageTaken += amt;
        
        if (this.hp <= 0) window.endGame('defeat');
    }
    
    // FIXED: Deal damage with proper crit chance and lifesteal
    dealDamage(baseDamage) {
        let damage = baseDamage;
        let isCrit = false;
        
        // FIXED: Base crit chance (5%) + passive bonus (3.5%)
        let critChance = this.baseCritChance;
        if (this.passiveUnlocked) {
            critChance += 0.035; // +3.5% from passive
        }
        
        // Check for crit
        if (Math.random() < critChance) {
            damage *= BALANCE.player.critMultiplier;
            isCrit = true;
            
            if (this.passiveUnlocked) {
                this.goldenAuraTimer = 1;
            }
            
            Achievements.stats.crits++;
            Achievements.check('crit_master');
        }
        
        // FIXED: Lifesteal only if passive is active
        if (this.passiveUnlocked) {
            const healAmount = damage * 0.02; // +2% per hit from passive
            this.hp = Math.min(this.maxHp, this.hp + healAmount);
            
            if (Math.random() < 0.3) {
                spawnFloatingText(`+${Math.round(healAmount)}`, this.x, this.y - 35, '#10b981', 12);
            }
        }
        
        return { damage, isCrit };
    }
    
    heal(amt) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
        spawnFloatingText(`+${amt} HP`, this.x, this.y - 30, '#10b981');
        spawnParticles(this.x, this.y, 10, '#10b981');
        Audio.playHeal();
    }
    
    addSpeedBoost() {
        this.speedBoostTimer = BALANCE.player.speedOnHitDuration;
    }
    
    draw() {
        // After images
        for (const img of this.afterImages) {
            const screen = worldToScreen(img.x, img.y);
            CTX.save();
            CTX.translate(screen.x, screen.y);
            CTX.rotate(img.angle);
            CTX.globalAlpha = img.life * 0.3;
            CTX.fillStyle = '#60a5fa';
            CTX.beginPath();
            CTX.roundRect(-15, -12, 30, 24, 8);
            CTX.fill();
            CTX.restore();
        }
        
        const screen = worldToScreen(this.x, this.y);
        
        // Shadow
        CTX.fillStyle = 'rgba(0,0,0,0.3)';
        CTX.beginPath();
        CTX.ellipse(screen.x, screen.y + 25, 18, 8, 0, 0, Math.PI * 2);
        CTX.fill();
        
        // Golden aura (passive skill)
        if (this.passiveUnlocked) {
            const auraSize = 35 + Math.sin(performance.now() / 200) * 5;
            const auraAlpha = 0.3 + Math.sin(performance.now() / 300) * 0.1;
            
            CTX.save();
            CTX.globalAlpha = auraAlpha;
            CTX.strokeStyle = '#fbbf24';
            CTX.lineWidth = 3;
            CTX.shadowBlur = 20;
            CTX.shadowColor = '#fbbf24';
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, auraSize, 0, Math.PI * 2);
            CTX.stroke();
            CTX.restore();
        }
        
        // Status icons
        if (this.isConfused) { 
            CTX.font = 'bold 24px Arial'; 
            CTX.fillText('😵', screen.x, screen.y - 40); 
        }
        if (this.isBurning) { 
            CTX.font = 'bold 20px Arial'; 
            CTX.fillText('🔥', screen.x + 20, screen.y - 35); 
        }
        
        // Main player sprite
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        CTX.globalAlpha = this.isInvisible ? 0.3 : 1;
        
        const w = Math.sin(this.walkCycle) * 8;
        
        // Legs
        CTX.fillStyle = '#1e293b';
        CTX.beginPath(); CTX.ellipse(5 + w, 10, 6, 4, 0, 0, Math.PI * 2); CTX.fill();
        CTX.beginPath(); CTX.ellipse(5 - w, -10, 6, 4, 0, 0, Math.PI * 2); CTX.fill();
        
        // Body
        CTX.fillStyle = '#f8fafc'; 
        CTX.beginPath(); 
        CTX.roundRect(-15, -12, 30, 24, 6); 
        CTX.fill();
        
        // Tie
        CTX.fillStyle = '#1e40af'; 
        CTX.beginPath(); 
        CTX.moveTo(0, -12); 
        CTX.lineTo(-3, 0); 
        CTX.lineTo(-5, 12);
        CTX.lineTo(0, 15); 
        CTX.lineTo(5, 12); 
        CTX.lineTo(3, 0); 
        CTX.closePath(); 
        CTX.fill();
        
        // MTC Badge
        CTX.fillStyle = '#2563eb'; 
        CTX.font = 'bold 8px Arial'; 
        CTX.textAlign = 'center'; 
        CTX.textBaseline = 'middle';
        CTX.fillText("MTC", 0, -5);
        
        // Head
        CTX.fillStyle = '#ffdfc4'; 
        CTX.beginPath(); 
        CTX.arc(0, 0, 13, 0, Math.PI * 2); 
        CTX.fill();
        
        // Hair
        CTX.fillStyle = '#0f172a'; 
        CTX.beginPath(); 
        CTX.arc(0, 0, 14, Math.PI * 1.1, Math.PI * 2.9); 
        CTX.fill();
        CTX.beginPath(); 
        CTX.arc(-8, -5, 6, 0, Math.PI * 2); 
        CTX.fill();
        CTX.beginPath(); 
        CTX.arc(8, -5, 6, 0, Math.PI * 2); 
        CTX.fill();
        
        // Eyes
        CTX.strokeStyle = '#333'; 
        CTX.lineWidth = 2.5; 
        CTX.beginPath(); 
        CTX.arc(-6, 0, 5, 0, Math.PI * 2);
        CTX.moveTo(7, 0); 
        CTX.arc(6, 0, 5, 0, Math.PI * 2); 
        CTX.moveTo(-1, 0); 
        CTX.lineTo(1, 0); 
        CTX.stroke();
        
        // Eye glint
        const t = performance.now() / 500;
        const gl = Math.abs(Math.sin(t)) * 0.8 + 0.2;
        CTX.fillStyle = `rgba(255,255,255,${gl})`;
        CTX.fillRect(-8, -2, 3, 2); 
        CTX.fillRect(4, -2, 3, 2);
        
        // Hands
        CTX.fillStyle = '#ffdfc4'; 
        CTX.beginPath(); 
        CTX.arc(10, 15, 5, 0, Math.PI * 2); 
        CTX.fill();
        
        // Weapon
        weaponSystem.drawWeaponOnPlayer(this);
        
        CTX.fillStyle = '#ffdfc4'; 
        CTX.beginPath(); 
        CTX.arc(8, -15, 5, 0, Math.PI * 2); 
        CTX.fill();
        
        CTX.restore();
        
        // Level badge
        if (this.level > 1) {
            CTX.fillStyle = 'rgba(139, 92, 246, 0.9)';
            CTX.beginPath();
            CTX.arc(screen.x + 22, screen.y - 22, 10, 0, Math.PI * 2);
            CTX.fill();
            
            CTX.fillStyle = '#fff';
            CTX.font = 'bold 10px Arial';
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
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
        
        // Update level UI
        const levelEl = document.getElementById('player-level');
        if (levelEl) {
            levelEl.textContent = `Lv.${this.level}`;
        }
        
        // Update exp bar
        const expBar = document.getElementById('exp-bar');
        if (expBar) {
            const expPercent = (this.exp / this.expToNextLevel) * 100;
            expBar.style.width = `${expPercent}%`;
        }
        
        // Update passive skill indicator
        const passiveEl = document.getElementById('passive-skill');
        if (passiveEl) {
            if (this.passiveUnlocked) {
                passiveEl.classList.add('unlocked');
                passiveEl.style.opacity = '1';
            } else if (this.level >= 3) {
                passiveEl.style.display = 'flex';
                passiveEl.style.opacity = '0.5';
                const skillName = passiveEl.querySelector('.skill-name');
                if (skillName) {
                    skillName.textContent = `${this.stealthUseCount}/5`;
                }
            }
        }
    }
}

// ==================== ENEMIES ====================
class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 18);
        this.maxHp = BALANCE.enemy.baseHp + getWave() * BALANCE.enemy.hpPerWave;
        this.hp = this.maxHp;
        this.speed = BALANCE.enemy.baseSpeed + getWave() * BALANCE.enemy.speedPerWave;
        this.damage = BALANCE.enemy.baseDamage + getWave() * BALANCE.enemy.damagePerWave;
        this.shootTimer = rand(...BALANCE.enemy.shootCooldown);
        this.color = randomChoice(['#ef4444', '#f59e0b', '#8b5cf6']);
        this.type = 'basic';
        this.expValue = 10;
    }
    
    update(dt, player) {
        if (this.dead) return;
        const dx = player.x - this.x, dy = player.y - this.y, d = dist(this.x, this.y, player.x, player.y);
        this.angle = Math.atan2(dy, dx);
        
        if (d > 150 && !player.isInvisible) {
            this.vx = Math.cos(this.angle) * this.speed;
            this.vy = Math.sin(this.angle) * this.speed;
        } else { 
            this.vx *= 0.9; 
            this.vy *= 0.9; 
        }
        
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
            this.dead = true; 
            this.hp = 0;
            spawnParticles(this.x, this.y, 20, this.color);
            addScore(BALANCE.score.basicEnemy * getWave());
            addEnemyKill();
            Audio.playEnemyDeath();
            
            // Give EXP to player
            if (player) player.gainExp(this.expValue);
            
            Achievements.stats.kills++;
            Achievements.check('first_blood');
            
            if (Math.random() < BALANCE.powerups.dropRate) {
                window.powerups.push(new PowerUp(this.x, this.y));
            }
        }
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.3)'; 
        CTX.beginPath();
        CTX.ellipse(screen.x, screen.y + 20, 15, 7, 0, 0, Math.PI * 2); 
        CTX.fill();
        
        CTX.save(); 
        CTX.translate(screen.x, screen.y); 
        CTX.rotate(this.angle);
        CTX.fillStyle = this.color; 
        CTX.beginPath(); 
        CTX.arc(0, 0, this.radius, 0, Math.PI * 2); 
        CTX.fill();
        CTX.fillStyle = '#000'; 
        CTX.beginPath(); 
        CTX.arc(8, 0, 4, 0, Math.PI * 2); 
        CTX.fill();
        CTX.restore();
        
        const hp = this.hp / this.maxHp, bw = 30;
        CTX.fillStyle = '#1e293b'; 
        CTX.fillRect(screen.x - bw / 2, screen.y - 30, bw, 4);
        CTX.fillStyle = '#ef4444'; 
        CTX.fillRect(screen.x - bw / 2, screen.y - 30, bw * hp, 4);
    }
}

class TankEnemy extends Entity {
    constructor(x, y) {
        super(x, y, 25);
        this.maxHp = BALANCE.tank.baseHp + getWave() * BALANCE.tank.hpPerWave;
        this.hp = this.maxHp;
        this.speed = BALANCE.tank.baseSpeed + getWave() * BALANCE.tank.speedPerWave;
        this.damage = BALANCE.tank.baseDamage + getWave() * BALANCE.tank.damagePerWave;
        this.color = '#78716c'; 
        this.type = 'tank';
        this.expValue = 25;
    }
    
    update(dt, player) {
        if (this.dead) return;
        const dx = player.x - this.x, dy = player.y - this.y, d = dist(this.x, this.y, player.x, player.y);
        this.angle = Math.atan2(dy, dx);
        if (!player.isInvisible) { 
            this.vx = Math.cos(this.angle) * this.speed; 
            this.vy = Math.sin(this.angle) * this.speed; 
        } else { 
            this.vx *= 0.95; 
            this.vy *= 0.95; 
        }
        this.applyPhysics(dt);
        if (d < BALANCE.tank.meleeRange + player.radius) {
            player.takeDamage(this.damage * dt * 2);
        }
    }
    
    takeDamage(amt, player) {
        this.hp -= amt;
        if (this.hp <= 0) {
            this.dead = true; 
            spawnParticles(this.x, this.y, 30, this.color);
            addScore(BALANCE.score.tank * getWave()); 
            addEnemyKill(); 
            Audio.playEnemyDeath();
            
            if (player) player.gainExp(this.expValue);
            
            Achievements.stats.kills++;
            if (Math.random() < BALANCE.powerups.dropRate * 1.5) {
                window.powerups.push(new PowerUp(this.x, this.y));
            }
        }
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.4)'; 
        CTX.beginPath();
        CTX.ellipse(screen.x, screen.y + 25, 20, 10, 0, 0, Math.PI * 2); 
        CTX.fill();
        CTX.save(); 
        CTX.translate(screen.x, screen.y); 
        CTX.rotate(this.angle);
        CTX.fillStyle = this.color; 
        CTX.fillRect(-20, -20, 40, 40);
        CTX.fillStyle = '#57534e'; 
        CTX.fillRect(-18, -18, 12, 36); 
        CTX.fillRect(6, -18, 12, 36);
        CTX.fillStyle = '#dc2626'; 
        CTX.beginPath(); 
        CTX.arc(10, 0, 6, 0, Math.PI * 2); 
        CTX.fill();
        CTX.restore();
        const hp = this.hp / this.maxHp;
        CTX.fillStyle = '#1e293b'; 
        CTX.fillRect(screen.x - 20, screen.y - 35, 40, 5);
        CTX.fillStyle = '#78716c'; 
        CTX.fillRect(screen.x - 20, screen.y - 35, 40 * hp, 5);
    }
}

class MageEnemy extends Entity {
    constructor(x, y) {
        super(x, y, 16);
        this.maxHp = BALANCE.mage.baseHp + getWave() * BALANCE.mage.hpPerWave;
        this.hp = this.maxHp;
        this.speed = BALANCE.mage.baseSpeed + getWave() * BALANCE.mage.speedPerWave;
        this.damage = BALANCE.mage.baseDamage + getWave() * BALANCE.mage.damagePerWave;
        this.color = '#a855f7'; 
        this.type = 'mage';
        this.soundWaveCD = 0; 
        this.meteorCD = 0;
        this.expValue = 30;
    }
    
    update(dt, player) {
        if (this.dead) return;
        const d = dist(this.x, this.y, player.x, player.y), od = 300;
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        if (d < od && !player.isInvisible) { 
            this.vx = -Math.cos(this.angle) * this.speed; 
            this.vy = -Math.sin(this.angle) * this.speed; 
        } else if (d > od + 100) { 
            this.vx = Math.cos(this.angle) * this.speed; 
            this.vy = Math.sin(this.angle) * this.speed; 
        } else { 
            this.vx *= 0.95; 
            this.vy *= 0.95; 
        }
        this.applyPhysics(dt);
        
        if (this.soundWaveCD > 0) this.soundWaveCD -= dt;
        if (this.meteorCD > 0) this.meteorCD -= dt;
        
        if (this.soundWaveCD <= 0 && d < BALANCE.mage.soundWaveRange && !player.isInvisible) {
            if (d < BALANCE.mage.soundWaveRange) {
                player.isConfused = true; 
                player.confusedTimer = BALANCE.mage.soundWaveConfuseDuration;
                spawnFloatingText('CONFUSED!', player.x, player.y - 40, '#a855f7', 20);
                for (let i = 0; i < 360; i += 30) {
                    const a = (i * Math.PI) / 180;
                    spawnParticles(this.x + Math.cos(a) * 50, this.y + Math.sin(a) * 50, 3, '#a855f7');
                }
            }
            this.soundWaveCD = BALANCE.mage.soundWaveCooldown;
        }
        
        // Meteor spawn (0.5% chance)
        if (this.meteorCD <= 0 && Math.random() < 0.005) {
            window.specialEffects.push(new MeteorStrike(
                player.x + rand(-300, 300), 
                player.y + rand(-300, 300)
            ));
            this.meteorCD = BALANCE.mage.meteorCooldown;
            Audio.playMeteorWarning();
        }
    }
    
    takeDamage(amt, player) {
        this.hp -= amt;
        if (this.hp <= 0) {
            this.dead = true; 
            spawnParticles(this.x, this.y, 25, this.color);
            addScore(BALANCE.score.mage * getWave()); 
            addEnemyKill(); 
            Audio.playEnemyDeath();
            
            if (player) player.gainExp(this.expValue);
            
            Achievements.stats.kills++;
            if (Math.random() < BALANCE.powerups.dropRate * 1.3) {
                window.powerups.push(new PowerUp(this.x, this.y));
            }
        }
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.3)'; 
        CTX.beginPath();
        CTX.ellipse(screen.x, screen.y + 18, 13, 6, 0, 0, Math.PI * 2); 
        CTX.fill();
        CTX.save(); 
        CTX.translate(screen.x, screen.y + Math.sin(performance.now() / 300) * 3);
        CTX.rotate(this.angle);
        CTX.fillStyle = this.color; 
        CTX.beginPath(); 
        CTX.arc(0, 5, 15, 0, Math.PI * 2); 
        CTX.fill();
        CTX.strokeStyle = '#6b21a8'; 
        CTX.lineWidth = 3; 
        CTX.beginPath();
        CTX.moveTo(-10, 0); 
        CTX.lineTo(-10, -25); 
        CTX.stroke();
        CTX.fillStyle = '#fbbf24'; 
        CTX.shadowBlur = 10; 
        CTX.shadowColor = '#fbbf24';
        CTX.beginPath(); 
        CTX.arc(-10, -25, 5, 0, Math.PI * 2); 
        CTX.fill(); 
        CTX.shadowBlur = 0;
        CTX.fillStyle = '#7c3aed'; 
        CTX.beginPath(); 
        CTX.arc(0, -5, 12, 0, Math.PI); 
        CTX.fill();
        CTX.restore();
        const hp = this.hp / this.maxHp;
        CTX.fillStyle = '#1e293b'; 
        CTX.fillRect(screen.x - 15, screen.y - 30, 30, 4);
        CTX.fillStyle = '#a855f7'; 
        CTX.fillRect(screen.x - 15, screen.y - 30, 30 * hp, 4);
    }
}

// ==================== POWER-UPS ====================
class PowerUp {
    constructor(x, y) {
        this.x = x; 
        this.y = y; 
        this.radius = 20; 
        this.life = BALANCE.powerups.lifetime;
        this.bobTimer = Math.random() * Math.PI * 2;
        this.type = randomChoice(['heal', 'damage', 'speed']);
        this.icons = { heal: '❤️', damage: '⚡', speed: '🚀' };
        this.colors = { heal: '#10b981', damage: '#f59e0b', speed: '#3b82f6' };
    }
    
    update(dt, player) {
        this.life -= dt; 
        this.bobTimer += dt * 3;
        const d = dist(this.x, this.y, player.x, player.y);
        if (d < this.radius + player.radius) { 
            this.collect(player); 
            return true; 
        }
        return this.life <= 0;
    }
    
    collect(player) {
        switch (this.type) {
            case 'heal': 
                player.heal(BALANCE.powerups.healAmount); 
                break;
            case 'damage':
                player.damageBoost = BALANCE.powerups.damageBoost;
                setTimeout(() => { player.damageBoost = 1; }, BALANCE.powerups.damageBoostDuration * 1000);
                spawnFloatingText('DAMAGE UP!', player.x, player.y - 40, '#f59e0b', 20);
                break;
            case 'speed':
                player.speedBoost = BALANCE.powerups.speedBoost;
                setTimeout(() => { player.speedBoost = 1; }, BALANCE.powerups.speedBoostDuration * 1000);
                spawnFloatingText('SPEED UP!', player.x, player.y - 40, '#3b82f6', 20);
        }
        spawnParticles(this.x, this.y, 20, this.colors[this.type]);
        addScore(BALANCE.score.powerup);
        Audio.playPowerUp();
        Achievements.stats.powerups++;
        Achievements.check('collector');
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y + Math.sin(this.bobTimer) * 5);
        CTX.save(); 
        CTX.translate(screen.x, screen.y);
        CTX.shadowBlur = 20; 
        CTX.shadowColor = this.colors[this.type];
        CTX.font = '32px Arial'; 
        CTX.textAlign = 'center'; 
        CTX.textBaseline = 'middle';
        CTX.fillText(this.icons[this.type], 0, 0);
        CTX.restore();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Entity, Player, Enemy, TankEnemy, MageEnemy, PowerUp };
}

// ===== SAFE MOBILE PATCH (non-destructive wrapper) =====
if (typeof Player !== "undefined") {
  const __originalUpdate = Player.prototype.update;

  Player.prototype.update = function(dt, keys, mouse) {

    // Inject mobile movement input
    if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
      keys.w = keys.a = keys.s = keys.d = 0;
      this.__mobile_ax = window.touchJoystickLeft.nx;
      this.__mobile_ay = window.touchJoystickLeft.ny;
    } else {
      this.__mobile_ax = null;
      this.__mobile_ay = null;
    }

    // Call original update
    __originalUpdate.call(this, dt, keys, mouse);

    // Override movement velocity if mobile joystick active
    if (this.__mobile_ax !== null) {
      const ax = this.__mobile_ax;
      const ay = this.__mobile_ay;
      const len = Math.hypot(ax, ay) || 1;
      const nx = ax / len;
      const ny = ay / len;

      this.vx += nx * BALANCE.player.acceleration * dt;
      this.vy += ny * BALANCE.player.acceleration * dt;
    }

    // Override aiming for twin-stick
    if (window.touchJoystickRight && window.touchJoystickRight.active &&
        (window.touchJoystickRight.nx !== 0 || window.touchJoystickRight.ny !== 0)) {
      this.angle = Math.atan2(
        window.touchJoystickRight.ny,
        window.touchJoystickRight.nx
      );
    }
  };
}
