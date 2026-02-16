/**
 * 🔫 MTC: ENHANCED EDITION - Weapon System (FIXED)
 * Beautiful 3D-style gun models + Auto Rifle Burst Fire
 * 
 * FIXED BUGS:
 * - Burst fire now works properly with synchronous projectile generation
 * - Proper cooldown management during burst
 * - Base crit chance implemented
 */

class Projectile {
    constructor(x, y, angle, speed, damage, color, isCrit, team) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage;
        this.color = color;
        this.team = team;
        this.life = 3;
        this.angle = angle;
        this.isCrit = isCrit;
        this.size = isCrit ? 24 : 14;
        this.symbol = this.getSymbol(isCrit, team);
    }
    
    getSymbol(isCrit, team) {
        if (team === 'player') {
            return isCrit ? '∑' : 'x';
        }
        
        const symbols = ['sin', 'cos', 'tan', '√', 'π', '-b±√', 'dx', 'dy', 'Δ'];
        return randomChoice(symbols);
    }
    
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.angle += dt * 2;
        
        // Particle trail
        if (Math.random() < 0.3) {
            spawnParticles(this.x, this.y, 1, this.color);
        }
        
        return this.life <= 0;
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        
        CTX.shadowBlur = 10;
        CTX.shadowColor = this.color;
        CTX.fillStyle = this.color;
        CTX.font = `bold ${this.size}px monospace`;
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
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
        this.weaponsUsed = new Set();
        this.weaponsUsed.add('auto');
        
        // FIXED: Better burst fire system
        this.burstCount = 0;
        this.maxBurst = 3;
        this.burstDelay = 0.08;
        this.burstTimer = 0;
        this.isBursting = false;
        this.pendingBurstShots = 0;
    }
    
    switchWeapon() {
        const weapons = ['auto', 'sniper', 'shotgun'];
        const currentIndex = weapons.indexOf(this.currentWeapon);
        this.currentWeapon = weapons[(currentIndex + 1) % 3];
        
        this.weaponsUsed.add(this.currentWeapon);
        this.updateWeaponUI();
        Audio.playWeaponSwitch();
        
        // Update achievements
        Achievements.stats.weaponsUsed = this.weaponsUsed;
        if (this.weaponsUsed.size >= 3) {
            Achievements.check('weapon_master');
        }
    }
    
    updateWeaponUI() {
        const weaponData = BALANCE.player.weapons[this.currentWeapon];
        const nameEl = document.getElementById('weapon-name');
        if (nameEl) {
            nameEl.textContent = weaponData.name;
            nameEl.style.color = weaponData.color;
        }
    }
    
    getCurrentWeapon() {
        return this.currentWeapon;
    }
    
    getWeaponData() {
        return BALANCE.player.weapons[this.currentWeapon];
    }
    
    update(dt) {
        if (this.weaponCooldown > 0) {
            this.weaponCooldown -= dt;
        }
        
        // FIXED: Handle burst fire timing
        if (this.isBursting && this.burstTimer > 0) {
            this.burstTimer -= dt;
            
            if (this.burstTimer <= 0 && this.pendingBurstShots > 0) {
                // Time to fire next burst shot
                this.pendingBurstShots--;
                
                if (this.pendingBurstShots > 0) {
                    this.burstTimer = this.burstDelay;
                } else {
                    // Burst complete
                    this.isBursting = false;
                    this.weaponCooldown = BALANCE.player.weapons.auto.cooldown;
                }
            }
        }
    }
    
    canShoot() {
        return this.weaponCooldown <= 0 && !this.isBursting;
    }
    
    // FIXED: Immediate burst shot system
    shoot(player, damageMultiplier = 1) {
        if (!this.canShoot()) return [];
        
        const projectiles = [];
        
        // Auto rifle: start burst fire
        if (this.currentWeapon === 'auto') {
            // Fire first shot immediately
            const firstShot = this.shootSingle(player, damageMultiplier);
            projectiles.push(...firstShot);
            
            // Set up burst state
            this.isBursting = true;
            this.burstTimer = this.burstDelay;
            this.pendingBurstShots = this.maxBurst - 1; // -1 because we already fired one
            
        } else {
            // Other weapons: single shot
            const shot = this.shootSingle(player, damageMultiplier);
            projectiles.push(...shot);
            this.weaponCooldown = this.getWeaponData().cooldown;
        }
        
        return projectiles;
    }
    
    // FIXED: Burst continuation - call this from game loop
    updateBurst(player, damageMultiplier = 1) {
        if (!this.isBursting || this.burstTimer > 0 || this.pendingBurstShots <= 0) {
            return [];
        }
        
        // Fire next burst shot
        const shot = this.shootSingle(player, damageMultiplier);
        this.burstTimer = this.burstDelay;
        this.pendingBurstShots--;
        
        if (this.pendingBurstShots <= 0) {
            this.isBursting = false;
            this.weaponCooldown = BALANCE.player.weapons.auto.cooldown;
        }
        
        return shot;
    }
    
    // Single shot (used by burst and other weapons)
    shootSingle(player, damageMultiplier = 1) {
        const weapon = this.getWeaponData();
        const projectiles = [];
        
        // FIXED: Calculate damage with base crit chance + passive skill
        let baseDamage = weapon.damage * damageMultiplier;
        const damageResult = player.dealDamage(baseDamage);
        let damage = damageResult.damage;
        let isCrit = damageResult.isCrit;
        let color = weapon.color;
        
        // Ambush crit
        if (player.ambushReady) {
            damage *= BALANCE.player.critMultiplier;
            isCrit = true;
            color = '#facc15';
            player.ambushReady = false;
            player.breakStealth();
            spawnParticles(player.x, player.y, 15, '#facc15');
            
            Achievements.stats.crits++;
            Achievements.check('crit_master');
        } else if (player.isInvisible) {
            player.breakStealth();
        }
        
        // High ground bonus
        if (player.onGraph) {
            damage *= 1.67;
            if (!isCrit) color = '#f59e0b';
            spawnFloatingText('HIGH GROUND!', player.x, player.y - 40, '#f59e0b', 16);
        }
        
        // Spawn projectiles
        const offset = 28;
        for (let i = 0; i < weapon.pellets; i++) {
            const spread = (Math.random() - 0.5) * weapon.spread;
            const angle = player.angle + spread;
            const sx = player.x + Math.cos(angle) * offset;
            const sy = player.y + Math.sin(angle) * offset;
            
            projectiles.push(new Projectile(
                sx, sy, angle, weapon.speed,
                damage / weapon.pellets,
                color, isCrit, 'player'
            ));
        }
        
        // Recoil
        player.vx -= Math.cos(player.angle) * 50;
        player.vy -= Math.sin(player.angle) * 50;
        
        // Play sound
        Audio.playShoot(this.currentWeapon);
        
        return projectiles;
    }
    
    // Draw beautiful 3D-style weapon on player
    drawWeaponOnPlayer(player) {
        const weapon = this.getWeaponData();
        
        CTX.save();
        CTX.translate(15, 10);
        
        // Shadow
        CTX.fillStyle = 'rgba(0, 0, 0, 0.3)';
        CTX.fillRect(2, 2, 26, 10);
        
        // Draw based on weapon type
        if (this.currentWeapon === 'auto') {
            this.drawAutoRifle(weapon);
        } else if (this.currentWeapon === 'sniper') {
            this.drawSniper(weapon);
        } else if (this.currentWeapon === 'shotgun') {
            this.drawShotgun(weapon);
        }
        
        CTX.restore();
    }
    
    // Beautiful Auto Rifle model
    drawAutoRifle(weapon) {
        // Main body (gradient)
        const gradient = CTX.createLinearGradient(0, -6, 0, 6);
        gradient.addColorStop(0, '#2563eb');
        gradient.addColorStop(0.5, '#3b82f6');
        gradient.addColorStop(1, '#1e40af');
        
        CTX.fillStyle = gradient;
        CTX.fillRect(0, -5, 24, 10);
        
        // Top rail
        CTX.fillStyle = '#1e293b';
        CTX.fillRect(4, -7, 16, 2);
        
        // Magazine
        CTX.fillStyle = '#334155';
        CTX.fillRect(8, 2, 6, 8);
        
        // Barrel
        CTX.fillStyle = '#0f172a';
        CTX.fillRect(20, -2, 8, 4);
        
        // Barrel tip (glow)
        CTX.fillStyle = '#60a5fa';
        CTX.shadowBlur = 8;
        CTX.shadowColor = '#60a5fa';
        CTX.fillRect(27, -1, 2, 2);
        CTX.shadowBlur = 0;
        
        // Stock
        CTX.fillStyle = '#1e40af';
        CTX.fillRect(-6, -3, 8, 6);
        
        // Grip
        CTX.fillStyle = '#1e293b';
        CTX.fillRect(10, 5, 4, 6);
        
        // Details
        CTX.strokeStyle = '#60a5fa';
        CTX.lineWidth = 1;
        CTX.strokeRect(2, -4, 4, 8);
        CTX.strokeRect(14, -4, 4, 8);
        
        // MTC Logo
        CTX.fillStyle = '#fff';
        CTX.font = 'bold 5px Arial';
        CTX.textAlign = 'center';
        CTX.fillText('MTC', 12, 1);
    }
    
    // Beautiful Sniper model
    drawSniper(weapon) {
        // Main body (gradient red)
        const gradient = CTX.createLinearGradient(0, -5, 0, 5);
        gradient.addColorStop(0, '#dc2626');
        gradient.addColorStop(0.5, '#ef4444');
        gradient.addColorStop(1, '#991b1b');
        
        CTX.fillStyle = gradient;
        CTX.fillRect(0, -4, 28, 8);
        
        // Scope
        CTX.fillStyle = '#1e293b';
        CTX.fillRect(10, -10, 8, 5);
        
        // Scope lens
        CTX.fillStyle = '#3b82f6';
        CTX.shadowBlur = 10;
        CTX.shadowColor = '#3b82f6';
        CTX.beginPath();
        CTX.arc(14, -7, 2, 0, Math.PI * 2);
        CTX.fill();
        CTX.shadowBlur = 0;
        
        // Long barrel
        CTX.fillStyle = '#0f172a';
        CTX.fillRect(24, -2, 12, 4);
        
        // Barrel tip (red glow)
        CTX.fillStyle = '#ef4444';
        CTX.shadowBlur = 12;
        CTX.shadowColor = '#ef4444';
        CTX.fillRect(35, -1, 2, 2);
        CTX.shadowBlur = 0;
        
        // Stock
        CTX.fillStyle = '#7c2d12';
        CTX.fillRect(-8, -2, 10, 4);
        
        // Bipod legs
        CTX.strokeStyle = '#475569';
        CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(20, 4);
        CTX.lineTo(18, 10);
        CTX.moveTo(22, 4);
        CTX.lineTo(24, 10);
        CTX.stroke();
        
        // Details
        CTX.fillStyle = '#fff';
        CTX.font = 'bold 4px Arial';
        CTX.textAlign = 'center';
        CTX.fillText('SNIPER', 14, 1);
    }
    
    // Beautiful Shotgun model
    drawShotgun(weapon) {
        // Main body (gradient orange)
        const gradient = CTX.createLinearGradient(0, -6, 0, 6);
        gradient.addColorStop(0, '#ea580c');
        gradient.addColorStop(0.5, '#f59e0b');
        gradient.addColorStop(1, '#c2410c');
        
        CTX.fillStyle = gradient;
        CTX.fillRect(0, -6, 22, 12);
        
        // Pump action
        CTX.fillStyle = '#78350f';
        CTX.fillRect(8, -4, 6, 8);
        
        // Wide barrel
        CTX.fillStyle = '#0f172a';
        CTX.fillRect(18, -4, 10, 8);
        
        // Barrel opening (wider)
        CTX.fillStyle = '#1e293b';
        CTX.fillRect(27, -3, 2, 6);
        
        // Muzzle flash effect
        CTX.fillStyle = '#fb923c';
        CTX.shadowBlur = 10;
        CTX.shadowColor = '#f59e0b';
        CTX.beginPath();
        CTX.arc(29, 0, 2, 0, Math.PI * 2);
        CTX.fill();
        CTX.shadowBlur = 0;
        
        // Stock (wood texture)
        CTX.fillStyle = '#92400e';
        CTX.fillRect(-8, -4, 10, 8);
        
        // Wood grain
        CTX.strokeStyle = '#78350f';
        CTX.lineWidth = 1;
        for (let i = -6; i < 2; i += 2) {
            CTX.beginPath();
            CTX.moveTo(-8, i);
            CTX.lineTo(-2, i);
            CTX.stroke();
        }
        
        // Shell holder
        CTX.fillStyle = '#dc2626';
        CTX.fillRect(4, -7, 3, 2);
        CTX.fillRect(10, -7, 3, 2);
        CTX.fillRect(16, -7, 3, 2);
        
        // Details
        CTX.fillStyle = '#fff';
        CTX.font = 'bold 4px Arial';
        CTX.textAlign = 'center';
        CTX.fillText('12G', 11, 1);
    }
}

// Projectile manager
class ProjectileManager {
    constructor() {
        this.projectiles = [];
    }
    
    add(projectile) {
        if (Array.isArray(projectile)) {
            this.projectiles.push(...projectile);
        } else if (projectile) {
            this.projectiles.push(projectile);
        }
    }
    
    update(dt, player, enemies, boss) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            
            const expired = proj.update(dt);
            let hit = false;
            
            // Player projectiles
            if (proj.team === 'player') {
                // Check boss collision
                if (boss && !boss.dead && proj.checkCollision(boss)) {
                    boss.takeDamage(proj.damage);
                    spawnFloatingText(Math.round(proj.damage), proj.x, proj.y - 20, 'white', 18);
                    hit = true;
                    player.addSpeedBoost();
                }
                
                // Check enemy collision
                for (let enemy of enemies) {
                    if (!enemy.dead && proj.checkCollision(enemy)) {
                        enemy.takeDamage(proj.damage, player);
                        spawnFloatingText(Math.round(proj.damage), proj.x, proj.y - 20, 'white', 16);
                        hit = true;
                        player.addSpeedBoost();
                        break;
                    }
                }
            }
            // Enemy projectiles
            else if (proj.team === 'enemy') {
                if (proj.checkCollision(player)) {
                    if (!player.isInvisible) {
                        player.takeDamage(proj.damage);
                        hit = true;
                    }
                }
            }
            
            // Remove projectile
            if (hit || expired) {
                if (hit) {
                    spawnParticles(proj.x, proj.y, 5, proj.color);
                }
                this.projectiles.splice(i, 1);
            }
        }
    }
    
    draw() {
        for (let proj of this.projectiles) {
            proj.draw();
        }
    }
    
    clear() {
        this.projectiles = [];
    }
    
    getAll() {
        return this.projectiles;
    }
}

// Create singleton instances
const weaponSystem = new WeaponSystem();
const projectileManager = new ProjectileManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Projectile,
        WeaponSystem,
        ProjectileManager,
        weaponSystem,
        projectileManager
    };
}
