/**
 * 🔫 MTC: ENHANCED EDITION - Weapon System
 * Three weapon types: Auto, Sniper, Shotgun
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
    
    // Check collision with entity
    checkCollision(entity) {
        return circleCollision(this.x, this.y, 10, entity.x, entity.y, entity.radius);
    }
}

class WeaponSystem {
    constructor() {
        this.currentWeapon = 'auto';
        this.weaponCooldown = 0;
        this.weaponsUsed = new Set();
        this.weaponsUsed.add('auto'); // Start with auto
    }
    
    switchWeapon() {
        const weapons = ['auto', 'sniper', 'shotgun'];
        const currentIndex = weapons.indexOf(this.currentWeapon);
        this.currentWeapon = weapons[(currentIndex + 1) % 3];
        
        // Track for achievement
        this.weaponsUsed.add(this.currentWeapon);
        
        // Update UI
        this.updateWeaponUI();
        
        // Play sound
        Audio.playWeaponSwitch();
        
        // Check achievement
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
    }
    
    canShoot() {
        return this.weaponCooldown <= 0;
    }
    
    shoot(player, damageMultiplier = 1) {
        if (!this.canShoot()) return [];
        
        const weapon = this.getWeaponData();
        const projectiles = [];
        
        // Calculate damage
        let damage = weapon.damage * damageMultiplier;
        let color = weapon.color;
        let isCrit = false;
        
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
                damage / weapon.pellets, // Damage per pellet
                color, isCrit, 'player'
            ));
        }
        
        // Recoil
        player.vx -= Math.cos(player.angle) * 50;
        player.vy -= Math.sin(player.angle) * 50;
        
        // Set cooldown
        this.weaponCooldown = weapon.cooldown;
        
        // Play sound
        Audio.playShoot(this.currentWeapon);
        
        return projectiles;
    }
    
    // Draw weapon indicator on player
    drawWeaponOnPlayer(player) {
        const weapon = this.getWeaponData();
        const screen = worldToScreen(player.x, player.y);
        
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(player.angle);
        
        // Position gun
        CTX.translate(15, 10);
        
        // Gun body
        CTX.fillStyle = weapon.color;
        CTX.fillRect(0, -4, 24, 8);
        
        // Barrel (different per weapon)
        const barrelColor = weapon.color === '#ef4444' ? '#991b1b' :
                           weapon.color === '#f59e0b' ? '#ca8a04' : '#1d4ed8';
        CTX.fillStyle = barrelColor;
        
        if (this.currentWeapon === 'sniper') {
            // Long barrel
            CTX.fillRect(20, -2, 12, 4);
        } else if (this.currentWeapon === 'shotgun') {
            // Wide barrel
            CTX.fillRect(20, -3, 8, 6);
        } else {
            // Normal barrel
            CTX.fillRect(20, -2, 8, 4);
        }
        
        // Details
        CTX.fillStyle = barrelColor;
        CTX.fillRect(2, -3, 3, 6);
        CTX.fillRect(8, -3, 2, 6);
        
        // MTC Logo
        CTX.fillStyle = '#fff';
        CTX.shadowBlur = 3;
        CTX.shadowColor = '#fff';
        CTX.font = 'bold 6px Arial';
        CTX.textAlign = 'center';
        CTX.fillText('MTC', 12, 1);
        CTX.shadowBlur = 0;
        
        CTX.restore();
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
        } else {
            this.projectiles.push(projectile);
        }
    }
    
    update(dt, player, enemies, boss) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            
            // Update projectile
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
                        enemy.takeDamage(proj.damage);
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
