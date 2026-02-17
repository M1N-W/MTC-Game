/**
 * 🔫 MTC: ENHANCED EDITION - Weapon System
 * Beautiful 3D-style gun models + Auto Rifle Burst Fire
 *
 * FIXED BUGS (refactor):
 * - All BALANCE.player.weapons.* → BALANCE.characters[this.activeChar].weapons.*
 * - All BALANCE.player.critMultiplier → BALANCE.characters[this.activeChar].critMultiplier
 * - WeaponSystem stores this.activeChar, set via setActiveChar(charType) in startGame
 * - Guard clauses in updateWeaponUI / getWeaponData prevent crash when char unset
 */

class Projectile {
    constructor(x, y, angle, speed, damage, color, isCrit, team) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage; this.color = color; this.team = team;
        this.life = 3; this.angle = angle; this.isCrit = isCrit;
        this.size = isCrit ? 24 : 14;
        this.symbol = this.getSymbol(isCrit, team);
    }

    getSymbol(isCrit, team) {
        if (team === 'player') return isCrit ? '∑' : 'x';
        const symbols = ['sin', 'cos', 'tan', '√', 'π', '-b±√', 'dx', 'dy', 'Δ'];
        return randomChoice(symbols);
    }

    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.life -= dt; this.angle += dt * 2;
        if (Math.random() < 0.3) spawnParticles(this.x, this.y, 1, this.color);
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        CTX.shadowBlur = 10; CTX.shadowColor = this.color;
        CTX.fillStyle = this.color;
        CTX.font = `bold ${this.size}px monospace`;
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillText(this.symbol, 0, 0);
        CTX.restore();
    }

    checkCollision(entity) {
        return circleCollision(this.x, this.y, 10, entity.x, entity.y, entity.radius);
    }
}

class WeaponSystem {
    constructor() {
        this.currentWeapon = 'auto';
        this.weaponCooldown = 0;
        this.weaponsUsed = new Set(['auto']);

        // ── FIX: activeChar must be set via setActiveChar(charType)
        //    in startGame() BEFORE any call to updateWeaponUI() or getWeaponData(). ──
        this.activeChar = 'kao';

        // Burst fire state
        this.maxBurst = 3;
        this.burstDelay = 0.08;
        this.burstTimer = 0;
        this.isBursting = false;
        this.pendingBurstShots = 0;
    }

    /**
     * setActiveChar(charType)
     * Call this BEFORE updateWeaponUI() in startGame().
     * Tells the WeaponSystem which BALANCE.characters entry to read.
     */
    setActiveChar(charType) {
        this.activeChar = charType || 'kao';
    }

    /** Safe helper — falls back to 'kao' if activeChar has no weapons. */
    getCharWeapons() {
        const charData = BALANCE.characters[this.activeChar];
        if (!charData || !charData.weapons) {
            console.warn(`[WeaponSystem] No weapons for char "${this.activeChar}". Falling back to kao.`);
            return BALANCE.characters.kao.weapons;
        }
        return charData.weapons;
    }

    switchWeapon() {
        const weapons = ['auto', 'sniper', 'shotgun'];
        const idx = weapons.indexOf(this.currentWeapon);
        this.currentWeapon = weapons[(idx + 1) % 3];
        this.weaponsUsed.add(this.currentWeapon);
        this.updateWeaponUI();
        Audio.playWeaponSwitch();
        Achievements.stats.weaponsUsed = this.weaponsUsed;
        if (this.weaponsUsed.size >= 3) Achievements.check('weapon_master');
    }

    /** FIXED: was BALANCE.player.weapons[...] */
    updateWeaponUI() {
        const weapons = this.getCharWeapons();
        const weaponData = weapons[this.currentWeapon];
        if (!weaponData) {
            console.warn(`[WeaponSystem] Weapon "${this.currentWeapon}" not in char "${this.activeChar}".`);
            return;
        }
        const nameEl = document.getElementById('weapon-name');
        if (nameEl) { nameEl.textContent = weaponData.name; nameEl.style.color = weaponData.color; }
    }

    getCurrentWeapon() { return this.currentWeapon; }

    /** FIXED: was BALANCE.player.weapons[this.currentWeapon] */
    getWeaponData() {
        return this.getCharWeapons()[this.currentWeapon];
    }

    update(dt) {
        if (this.weaponCooldown > 0) this.weaponCooldown -= dt;

        if (this.isBursting && this.burstTimer > 0) {
            this.burstTimer -= dt;
            if (this.burstTimer <= 0 && this.pendingBurstShots > 0) {
                this.pendingBurstShots--;
                if (this.pendingBurstShots > 0) {
                    this.burstTimer = this.burstDelay;
                } else {
                    this.isBursting = false;
                    // FIXED: was BALANCE.player.weapons.auto.cooldown
                    this.weaponCooldown = this.getCharWeapons().auto.cooldown;
                }
            }
        }
    }

    canShoot() { return this.weaponCooldown <= 0 && !this.isBursting; }

    shoot(player, damageMultiplier = 1) {
        if (!this.canShoot()) return [];
        const projectiles = [];

        if (this.currentWeapon === 'auto') {
            projectiles.push(...this.shootSingle(player, damageMultiplier));
            this.isBursting = true;
            this.burstTimer = this.burstDelay;
            this.pendingBurstShots = this.maxBurst - 1;
        } else {
            projectiles.push(...this.shootSingle(player, damageMultiplier));
            this.weaponCooldown = this.getWeaponData().cooldown;
        }
        return projectiles;
    }

    updateBurst(player, damageMultiplier = 1) {
        if (!this.isBursting || this.burstTimer > 0 || this.pendingBurstShots <= 0) return [];
        const shot = this.shootSingle(player, damageMultiplier);
        this.burstTimer = this.burstDelay;
        this.pendingBurstShots--;
        if (this.pendingBurstShots <= 0) {
            this.isBursting = false;
            // FIXED: was BALANCE.player.weapons.auto.cooldown
            this.weaponCooldown = this.getCharWeapons().auto.cooldown;
        }
        return shot;
    }

    shootSingle(player, damageMultiplier = 1) {
        const weapon = this.getWeaponData();
        const projectiles = [];

        let baseDamage = weapon.damage * damageMultiplier;
        const damageResult = player.dealDamage(baseDamage);
        let damage = damageResult.damage;
        let isCrit = damageResult.isCrit;
        let color = weapon.color;

        if (player.ambushReady) {
            // FIXED: was BALANCE.player.critMultiplier
            const critMult = BALANCE.characters[this.activeChar]?.critMultiplier ?? 2.5;
            damage *= critMult;
            isCrit = true; color = '#facc15';
            player.ambushReady = false; player.breakStealth();
            spawnParticles(player.x, player.y, 15, '#facc15');
            Achievements.stats.crits++;
            Achievements.check('crit_master');
        } else if (player.isInvisible) {
            player.breakStealth();
        }

        if (player.onGraph) {
            damage *= 1.67;
            if (!isCrit) color = '#f59e0b';
            spawnFloatingText('HIGH GROUND!', player.x, player.y - 40, '#f59e0b', 16);
        }

        const offset = 28;
        for (let i = 0; i < weapon.pellets; i++) {
            const spread = (Math.random() - 0.5) * weapon.spread;
            const angle = player.angle + spread;
            const sx = player.x + Math.cos(angle) * offset;
            const sy = player.y + Math.sin(angle) * offset;
            projectiles.push(new Projectile(sx, sy, angle, weapon.speed, damage / weapon.pellets, color, isCrit, 'player'));
        }

        player.vx -= Math.cos(player.angle) * 50;
        player.vy -= Math.sin(player.angle) * 50;
        Audio.playShoot(this.currentWeapon);
        return projectiles;
    }

    drawWeaponOnPlayer(player) {
        const weapon = this.getWeaponData();
        CTX.save();
        CTX.translate(15, 10);
        CTX.fillStyle = 'rgba(0, 0, 0, 0.3)';
        CTX.fillRect(2, 2, 26, 10);
        if      (this.currentWeapon === 'auto')    this.drawAutoRifle(weapon);
        else if (this.currentWeapon === 'sniper')  this.drawSniper(weapon);
        else if (this.currentWeapon === 'shotgun') this.drawShotgun(weapon);
        CTX.restore();
    }

    drawAutoRifle(weapon) {
        const g = CTX.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#2563eb'); g.addColorStop(0.5, '#3b82f6'); g.addColorStop(1, '#1e40af');
        CTX.fillStyle = g; CTX.fillRect(0, -5, 24, 10);
        CTX.fillStyle = '#1e293b'; CTX.fillRect(4, -7, 16, 2);
        CTX.fillStyle = '#334155'; CTX.fillRect(8, 2, 6, 8);
        CTX.fillStyle = '#0f172a'; CTX.fillRect(20, -2, 8, 4);
        CTX.fillStyle = '#60a5fa'; CTX.shadowBlur = 8; CTX.shadowColor = '#60a5fa';
        CTX.fillRect(27, -1, 2, 2); CTX.shadowBlur = 0;
        CTX.fillStyle = '#1e40af'; CTX.fillRect(-6, -3, 8, 6);
        CTX.fillStyle = '#1e293b'; CTX.fillRect(10, 5, 4, 6);
        CTX.strokeStyle = '#60a5fa'; CTX.lineWidth = 1;
        CTX.strokeRect(2, -4, 4, 8); CTX.strokeRect(14, -4, 4, 8);
        CTX.fillStyle = '#fff'; CTX.font = 'bold 5px Arial'; CTX.textAlign = 'center'; CTX.fillText('MTC', 12, 1);
    }

    drawSniper(weapon) {
        const g = CTX.createLinearGradient(0, -5, 0, 5);
        g.addColorStop(0, '#dc2626'); g.addColorStop(0.5, '#ef4444'); g.addColorStop(1, '#991b1b');
        CTX.fillStyle = g; CTX.fillRect(0, -4, 28, 8);
        CTX.fillStyle = '#1e293b'; CTX.fillRect(10, -10, 8, 5);
        CTX.fillStyle = '#3b82f6'; CTX.shadowBlur = 10; CTX.shadowColor = '#3b82f6';
        CTX.beginPath(); CTX.arc(14, -7, 2, 0, Math.PI * 2); CTX.fill(); CTX.shadowBlur = 0;
        CTX.fillStyle = '#0f172a'; CTX.fillRect(24, -2, 12, 4);
        CTX.fillStyle = '#ef4444'; CTX.shadowBlur = 12; CTX.shadowColor = '#ef4444';
        CTX.fillRect(35, -1, 2, 2); CTX.shadowBlur = 0;
        CTX.fillStyle = '#7c2d12'; CTX.fillRect(-8, -2, 10, 4);
        CTX.strokeStyle = '#475569'; CTX.lineWidth = 2;
        CTX.beginPath(); CTX.moveTo(20,4); CTX.lineTo(18,10); CTX.moveTo(22,4); CTX.lineTo(24,10); CTX.stroke();
        CTX.fillStyle = '#fff'; CTX.font = 'bold 4px Arial'; CTX.textAlign = 'center'; CTX.fillText('SNIPER', 14, 1);
    }

    drawShotgun(weapon) {
        const g = CTX.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#ea580c'); g.addColorStop(0.5, '#f59e0b'); g.addColorStop(1, '#c2410c');
        CTX.fillStyle = g; CTX.fillRect(0, -6, 22, 12);
        CTX.fillStyle = '#78350f'; CTX.fillRect(8, -4, 6, 8);
        CTX.fillStyle = '#0f172a'; CTX.fillRect(18, -4, 10, 8);
        CTX.fillStyle = '#1e293b'; CTX.fillRect(27, -3, 2, 6);
        CTX.fillStyle = '#fb923c'; CTX.shadowBlur = 10; CTX.shadowColor = '#f59e0b';
        CTX.beginPath(); CTX.arc(29, 0, 2, 0, Math.PI * 2); CTX.fill(); CTX.shadowBlur = 0;
        CTX.fillStyle = '#92400e'; CTX.fillRect(-8, -4, 10, 8);
        CTX.strokeStyle = '#78350f'; CTX.lineWidth = 1;
        for (let i = -6; i < 2; i += 2) { CTX.beginPath(); CTX.moveTo(-8,i); CTX.lineTo(-2,i); CTX.stroke(); }
        CTX.fillStyle = '#dc2626';
        CTX.fillRect(4,-7,3,2); CTX.fillRect(10,-7,3,2); CTX.fillRect(16,-7,3,2);
        CTX.fillStyle = '#fff'; CTX.font = 'bold 4px Arial'; CTX.textAlign = 'center'; CTX.fillText('12G', 11, 1);
    }
}

class ProjectileManager {
    constructor() { this.projectiles = []; }

    add(projectile) {
        if (Array.isArray(projectile)) this.projectiles.push(...projectile);
        else if (projectile) this.projectiles.push(projectile);
    }

    update(dt, player, enemies, boss) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            const expired = proj.update(dt);
            let hit = false;

            if (proj.team === 'player') {
                if (boss && !boss.dead && proj.checkCollision(boss)) {
                    boss.takeDamage(proj.damage);
                    spawnFloatingText(Math.round(proj.damage), proj.x, proj.y - 20, 'white', 18);
                    hit = true; player.addSpeedBoost();
                }
                for (let enemy of enemies) {
                    if (!enemy.dead && proj.checkCollision(enemy)) {
                        enemy.takeDamage(proj.damage, player);
                        spawnFloatingText(Math.round(proj.damage), proj.x, proj.y - 20, 'white', 16);
                        hit = true; player.addSpeedBoost(); break;
                    }
                }
            } else if (proj.team === 'enemy') {
                if (proj.checkCollision(player) && !player.isInvisible) {
                    player.takeDamage(proj.damage); hit = true;
                }
            }

            if (hit || expired) {
                if (hit) spawnParticles(proj.x, proj.y, 5, proj.color);
                this.projectiles.splice(i, 1);
            }
        }
    }

    draw()  { for (let p of this.projectiles) p.draw(); }
    clear() { this.projectiles = []; }
    getAll() { return this.projectiles; }
}

const weaponSystem      = new WeaponSystem();
const projectileManager = new ProjectileManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Projectile, WeaponSystem, ProjectileManager, weaponSystem, projectileManager };
}