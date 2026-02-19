'use strict';
/**
 * 🔫 MTC: ENHANCED EDITION - Weapon System
 * Beautiful 3D-style gun models + Auto Rifle Burst Fire
 *
 * FIXED BUGS (refactor):
 * - All BALANCE.player.weapons.* → BALANCE.characters[this.activeChar].weapons.*
 * - All BALANCE.player.critMultiplier → BALANCE.characters[this.activeChar].critMultiplier
 * - WeaponSystem stores this.activeChar, set via setActiveChar(charType) in startGame
 * - Guard clauses in updateWeaponUI / getWeaponData prevent crash when char unset
 *
 * AUDIO NOTE (Poom character sounds):
 * - Poom's shooting sound (Audio.playPoomShoot) is called inside
 *   PoomPlayer.shoot() in js/entities/player.js, NOT here.
 *   Reason: Poom bypasses WeaponSystem entirely — his projectile is fired
 *   directly via PoomPlayer.shoot() which reads his rice* stats from BALANCE.
 *   WeaponSystem only governs Kao's auto/sniper/shotgun weapon modes.
 * - Naga hit sound (Audio.playNagaAttack) is called inside
 *   NagaEntity.update() in js/entities/player.js with a 220 ms cooldown
 *   to prevent rapid-tick audio stacking.
 */

class Projectile {
    constructor(x, y, angle, speed, damage, color, isCrit, team, options = {}) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage; this.color = color; this.team = team;

        this.life = (options && options.life !== undefined) ? options.life : 3;
        this.angle = angle; this.isCrit = isCrit;

        this.kind = options?.kind || 'bullet';
        this.size = (options && options.size !== undefined) ? options.size : (isCrit ? 24 : 14);
        this.radius = (options && options.radius !== undefined) ? options.radius : 10;
        this.pierce = (options && options.pierce !== undefined) ? options.pierce : 0;
        this.hitSet = null;

        this.symbol = options?.symbol || this.getSymbol(isCrit, team);
    }

    getSymbol(isCrit, team) {
        if (team === 'player') return isCrit ? '∑' : 'x';
        const symbols = ['sin', 'cos', 'tan', '√', 'π', '-b±√', 'dx', 'dy', 'Δ'];
        return randomChoice(symbols);
    }

    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.life -= dt; this.angle += dt * 2;
        if (this.kind !== 'punch' && Math.random() < 0.3) spawnParticles(this.x, this.y, 1, this.color);
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);

        if (this.kind === 'heatwave') {
            CTX.rotate(this.angle);
            CTX.globalAlpha = 0.85;
            CTX.shadowBlur = 18;
            CTX.shadowColor = this.color;

            const g = CTX.createLinearGradient(-24, 0, 24, 0);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.35, 'rgba(251,113,133,0.65)');
            g.addColorStop(1, 'rgba(220,38,38,0.95)');

            CTX.fillStyle = g;
            CTX.beginPath();
            CTX.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
            CTX.fill();

            CTX.globalAlpha = 0.55;
            CTX.strokeStyle = 'rgba(255,241,242,0.8)';
            CTX.lineWidth = 2;
            CTX.beginPath();
            CTX.ellipse(-6, 0, 16, 6, 0, 0, Math.PI * 2);
            CTX.stroke();

            CTX.restore();
            return;
        }

        if (this.kind === 'punch') {
            CTX.rotate(this.angle);
            CTX.shadowBlur = 24;
            CTX.shadowColor = this.color;

            // Impact wave
            CTX.globalAlpha = 0.55;
            CTX.strokeStyle = this.color;
            CTX.lineWidth = 4;
            CTX.beginPath();
            CTX.arc(10, 0, 14, -Math.PI / 3, Math.PI / 3);
            CTX.stroke();

            // Fist block
            CTX.globalAlpha = 0.9;
            const fg = CTX.createLinearGradient(-6, -10, 16, 10);
            fg.addColorStop(0, '#fff1f2');
            fg.addColorStop(0.5, '#fb7185');
            fg.addColorStop(1, '#dc2626');
            CTX.fillStyle = fg;
            CTX.beginPath();
            CTX.roundRect(-6, -8, 18, 16, 6);
            CTX.fill();

            CTX.restore();
            return;
        }

        if (this.team === 'player' && this.symbol === 'x') {
            // ── Kao: bullet tracer ────────────────────────────────
            CTX.rotate(this.angle);
            const trailLen = this.isCrit ? 28 : 18;
            const coreW    = this.isCrit ? 4  : 2.5;
            // Outer glow trail
            const trailGrad = CTX.createLinearGradient(-trailLen, 0, 0, 0);
            trailGrad.addColorStop(0, 'rgba(0,0,0,0)');
            trailGrad.addColorStop(1, this.color);
            CTX.strokeStyle = trailGrad; CTX.lineWidth = coreW + 3; CTX.lineCap = 'round';
            CTX.globalAlpha = 0.35;
            CTX.beginPath(); CTX.moveTo(-trailLen, 0); CTX.lineTo(0, 0); CTX.stroke();
            // Core tracer
            CTX.globalAlpha = 1;
            CTX.strokeStyle = this.color; CTX.lineWidth = coreW;
            CTX.shadowBlur = this.isCrit ? 18 : 10; CTX.shadowColor = this.color;
            CTX.beginPath(); CTX.moveTo(-trailLen * 0.6, 0); CTX.lineTo(3, 0); CTX.stroke();
            // Tip flash
            CTX.fillStyle = this.isCrit ? '#facc15' : '#ffffff';
            CTX.shadowBlur = 16; CTX.shadowColor = this.isCrit ? '#facc15' : this.color;
            CTX.beginPath(); CTX.arc(3, 0, this.isCrit ? 4 : 2.5, 0, Math.PI * 2); CTX.fill();

        } else if (this.team === 'player' && this.symbol === '∑') {
            // ── Kao: crit tracer — golden supercharged ────────────
            CTX.rotate(this.angle);
            // Wide energy wake
            CTX.globalAlpha = 0.22;
            CTX.fillStyle = '#facc15';
            CTX.beginPath(); CTX.ellipse(-18, 0, 22, 7, 0, 0, Math.PI * 2); CTX.fill();
            // Core
            CTX.globalAlpha = 1;
            const cg = CTX.createLinearGradient(-26, 0, 4, 0);
            cg.addColorStop(0, 'rgba(251,191,36,0)'); cg.addColorStop(0.6, '#facc15'); cg.addColorStop(1, '#ffffff');
            CTX.strokeStyle = cg; CTX.lineWidth = 5; CTX.lineCap = 'round';
            CTX.shadowBlur = 24; CTX.shadowColor = '#facc15';
            CTX.beginPath(); CTX.moveTo(-26, 0); CTX.lineTo(4, 0); CTX.stroke();
            CTX.fillStyle = '#fff'; CTX.shadowBlur = 20; CTX.shadowColor = '#facc15';
            CTX.beginPath(); CTX.arc(4, 0, 5, 0, Math.PI * 2); CTX.fill();

        } else if (this.color === '#fbbf24' || this.color === '#fde68a' || this.color === '#ffffff') {
            // ── Poom: sticky rice clump ───────────────────────────
            CTX.rotate(this.angle);
            const r = this.isCrit ? 9 : 6;
            const grainPositions = [
                [0, 0, r], [-r * 0.7, -r * 0.4, r * 0.75], [r * 0.6, -r * 0.5, r * 0.7],
                [-r * 0.5, r * 0.6, r * 0.65], [r * 0.4, r * 0.55, r * 0.6]
            ];
            // Glow aura
            CTX.globalAlpha = 0.3; CTX.fillStyle = '#fde68a';
            CTX.shadowBlur = 14; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(0, 0, r + 5, 0, Math.PI * 2); CTX.fill();
            // Rice grains
            CTX.globalAlpha = 1; CTX.shadowBlur = 8; CTX.shadowColor = '#fbbf24';
            for (const [gx, gy, gr] of grainPositions) {
                const gGrad = CTX.createRadialGradient(gx - gr * 0.2, gy - gr * 0.2, 0, gx, gy, gr);
                gGrad.addColorStop(0, '#fffbeb');
                gGrad.addColorStop(0.6, '#fde68a');
                gGrad.addColorStop(1, '#fbbf24');
                CTX.fillStyle = gGrad;
                CTX.beginPath(); CTX.arc(gx, gy, gr, 0, Math.PI * 2); CTX.fill();
            }
            if (this.isCrit) {
                CTX.globalAlpha = 0.8; CTX.strokeStyle = '#facc15'; CTX.lineWidth = 1.2;
                CTX.shadowBlur = 20; CTX.shadowColor = '#facc15';
                CTX.beginPath(); CTX.arc(0, 0, r + 8, 0, Math.PI * 2); CTX.stroke();
            }

        } else {
            // ── Enemy / fallback: math symbol ────────────────────
            CTX.rotate(this.angle);
            CTX.shadowBlur = 10; CTX.shadowColor = this.color;
            CTX.fillStyle = this.color;
            CTX.font = `bold ${this.size}px monospace`;
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(this.symbol, 0, 0);
        }

        CTX.restore();
    }

    checkCollision(entity) {
        const r = (this.radius !== undefined) ? this.radius : 10;
        return circleCollision(this.x, this.y, r, entity.x, entity.y, entity.radius);
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

    /**
     * Safe helper — returns the weapons map for the active character.
     *
     * • Kao  → BALANCE.characters.kao.weapons  (standard weapons object)
     * • Poom → synthetic shim built from poom's flat rice* stats so that any
     *           accidental call to getWeaponData() / getCharWeapons() on a Poom
     *           session never throws.  The shim is NOT used for Poom's actual
     *           shooting (shootPoom() in game.js handles that separately).
     * • Unknown char → falls back to kao weapons with a console warning.
     */
    getCharWeapons() {
        const charData = BALANCE.characters[this.activeChar];

        // ── Char not found at all ──
        if (!charData) {
            console.warn(`[WeaponSystem] Unknown char "${this.activeChar}". Falling back to kao.`);
            return BALANCE.characters.kao.weapons;
        }

        // ── Char has a standard weapons object (Kao and future chars) ──
        if (charData.weapons) return charData.weapons;

        // ── Poom: no weapons object → build a minimal shim ──
        // This prevents any crash if getWeaponData() is ever called during a
        // Poom session (e.g., a code path that doesn't check instanceof PoomPlayer).
        const S = charData;
        const riceWeapon = {
            name:    '🍙 ข้าวเหนียว',
            damage:  S.riceDamage   ?? 42.5,
            cooldown:S.riceCooldown ?? 0.46,
            range:   S.riceRange    ?? 750,
            speed:   S.riceSpeed    ?? 600,
            spread:  0,
            pellets: 1,
            color:   S.riceColor    ?? '#ffffff',
            icon:    '🍙'
        };
        return { auto: riceWeapon, sniper: riceWeapon, shotgun: riceWeapon };    }

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

    /** FIXED: was BALANCE.player.weapons[...]. Poom shows rice icon instead. */
    updateWeaponUI() {
        try {
            // Poom uses a completely different attack system — show a dedicated label
            if (this.activeChar === 'poom') {
                const nameEl = document.getElementById('weapon-name');
                if (nameEl) { nameEl.textContent = '🍙 ข้าวเหนียว'; nameEl.style.color = '#ffffff'; }
                return;
            }

            // Auto (AutoPlayer) uses Heat Wave + Wanchai Stand — show dedicated label
            if (this.activeChar === 'auto') {
                const nameEl = document.getElementById('weapon-name');
                if (nameEl) { nameEl.textContent = '🔥 HEAT WAVE'; nameEl.style.color = '#dc2626'; }
                return;
            }

            const weapons    = this.getCharWeapons();
            const weaponData = weapons[this.currentWeapon];
            if (!weaponData) {
                console.warn(`[WeaponSystem] Weapon "${this.currentWeapon}" not in char "${this.activeChar}".`);
                return;
            }
            const nameEl = document.getElementById('weapon-name');
            if (nameEl) { nameEl.textContent = weaponData.name; nameEl.style.color = weaponData.color; }
        } catch (err) {
            console.error('[WeaponSystem] updateWeaponUI failed:', err);
        }
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

        // Apply RPG damage multiplier from player level progression
        damage *= player.damageMultiplier || 1.0;

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
        // Kao's weapon sound — routed through playShoot(weaponType).
        // Poom's shoot sound (Audio.playPoomShoot) is fired in PoomPlayer.shoot()
        // inside js/entities/player.js since Poom never calls shootSingle() here.
        Audio.playShoot(this.currentWeapon);
        return projectiles;
    }

    drawWeaponOnPlayer(player) {
        CTX.save();
        CTX.translate(15, 10);
        CTX.fillStyle = 'rgba(0, 0, 0, 0.3)';
        CTX.fillRect(2, 2, 26, 10);
        // Use the enhanced gun art function
        drawKaoGunEnhanced(CTX, this.currentWeapon);
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

            // Ensure hit memory exists for piercing projectiles
            if (proj && proj.pierce > 0 && !proj.hitSet) proj.hitSet = new Set();

            if (proj.team === 'player') {
                if (boss && !boss.dead && proj.checkCollision(boss)) {
                    if (!proj.hitSet || !proj.hitSet.has(boss)) {
                        boss.takeDamage(proj.damage);
                        spawnFloatingText(Math.round(proj.damage), proj.x, proj.y - 20, 'white', 18);
                        if (typeof spawnHitMarker === 'function') spawnHitMarker(proj.x, proj.y);
                        if (proj.kind === 'punch' && typeof spawnWanchaiPunchText === 'function') {
                            spawnWanchaiPunchText(proj.x, proj.y);
                        }
                        player.addSpeedBoost();
                        if (proj.pierce > 0) {
                            proj.hitSet?.add(boss);
                            proj.pierce -= 1;
                        } else {
                            hit = true;
                        }
                    }
                }
                for (let enemy of enemies) {
                    if (!enemy.dead && proj.checkCollision(enemy)) {
                        if (proj.hitSet && proj.hitSet.has(enemy)) continue;
                        enemy.takeDamage(proj.damage, player);
                        spawnFloatingText(Math.round(proj.damage), proj.x, proj.y - 20, 'white', 16);
                        if (typeof spawnHitMarker === 'function') spawnHitMarker(proj.x, proj.y);
                        if (proj.kind === 'punch' && typeof spawnWanchaiPunchText === 'function') {
                            spawnWanchaiPunchText(proj.x, proj.y);
                        }
                        player.addSpeedBoost();
                        if (proj.pierce > 0) {
                            proj.hitSet?.add(enemy);
                            proj.pierce -= 1;
                        } else {
                            hit = true;
                            break;
                        }
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

    spawnWanchaiPunch(x, y, angle) {
        const a = angle ?? 0;
        const sx = x + Math.cos(a) * 28;
        const sy = y + Math.sin(a) * 28;
        const p = new Projectile(sx, sy, a, 1500, 70, '#fb7185', false, 'player', {
            kind: 'punch',
            life: 0.15,
            size: 18,
            radius: 16,
            pierce: 0
        });
        this.add(p);
    }

    spawnHeatWave(player, angle) {
        const a = angle ?? player?.angle ?? 0;
        const range = player?.stats?.heatWaveRange ?? BALANCE.player?.auto?.heatWaveRange ?? 150;
        const damageBase = 34;
        const dmgMult = (player?.damageBoost || 1) * (player?.damageMultiplier || 1);

        let damage = damageBase * dmgMult;
        try {
            if (player && typeof player.dealDamage === 'function') {
                const res = player.dealDamage(damage);
                damage = res?.damage ?? damage;
            }
        } catch (e) {}

        const speed = Math.max(600, range * 9);
        const sx = player.x + Math.cos(a) * 22;
        const sy = player.y + Math.sin(a) * 22;
        const p = new Projectile(sx, sy, a, speed, damage, '#dc2626', false, 'player', {
            kind: 'heatwave',
            life: Math.max(0.12, range / speed),
            size: 18,
            radius: 18,
            pierce: 2
        });
        this.add(p);
    }
}

var weaponSystem      = new WeaponSystem();
var projectileManager = new ProjectileManager();

// ════════════════════════════════════════════════════════════
// 🎨 STANDALONE WEAPON ART FUNCTIONS
// Called from player.js draw() methods
// ════════════════════════════════════════════════════════════

/**
 * drawPoomWeapon(ctx, x, y, angle)
 * "The Tactical Kratib" — a futuristic Sticky Rice Container Launcher.
 *
 * Design:
 *  • Body  : Bamboo-textured cylinder with neon metal rings
 *  • Barrel: High-tech emitter cone at the muzzle
 *  • Strap : Visible shoulder sling
 *
 * Call this inside a CTX.save/restore that is already translated
 * to the player's screen position and rotated to the player's angle.
 * The weapon is drawn at an offset from that origin.
 */
function drawPoomWeapon(ctx) {
    const now = performance.now();
    ctx.save();
    // Offset: weapon sits at player's "right hand" (forward direction)
    ctx.translate(12, 6);

    // ── Shoulder strap ───────────────────────────────────────────
    ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.bezierCurveTo(-22, 2, -14, 12, -8, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── Body: bamboo-textured cylinder ───────────────────────────
    const bodyGrad = ctx.createLinearGradient(0, -7, 0, 7);
    bodyGrad.addColorStop(0,   '#4ade80');
    bodyGrad.addColorStop(0.35,'#16a34a');
    bodyGrad.addColorStop(0.65,'#15803d');
    bodyGrad.addColorStop(1,   '#14532d');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath(); ctx.roundRect(-14, -6, 28, 12, 3); ctx.fill();

    // Bamboo groove lines
    ctx.save();
    ctx.beginPath(); ctx.roundRect(-14, -6, 28, 12, 3); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.2;
    for (let gx = -10; gx <= 12; gx += 7) {
        ctx.beginPath(); ctx.moveTo(gx, -6); ctx.lineTo(gx, 6); ctx.stroke();
    }
    // Highlight sheen
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(-14, -6, 28, 4);
    ctx.restore();

    // ── Neon metal rings ─────────────────────────────────────────
    const ringPulse = 0.6 + Math.sin(now / 300) * 0.4;
    const ringPositions = [-8, 0, 8];
    for (const rx of ringPositions) {
        // Ring body
        ctx.fillStyle = '#334155';
        ctx.fillRect(rx - 1.5, -7, 3, 14);
        // Neon glow on ring
        ctx.fillStyle = `rgba(0,229,255,${ringPulse * 0.9})`;
        ctx.shadowBlur = 6; ctx.shadowColor = '#00e5ff';
        ctx.fillRect(rx - 1, -7.5, 2, 2);
        ctx.fillRect(rx - 1,  5.5, 2, 2);
        ctx.shadowBlur = 0;
    }

    // ── Barrel / emitter (muzzle end, rightward) ─────────────────
    // Barrel shaft
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.roundRect(14, -4, 10, 8, 2); ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.fillRect(14, -2, 10, 4);
    // Emitter cone tip
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(24, -5); ctx.lineTo(24, 5); ctx.lineTo(30, 2); ctx.lineTo(30, -2); ctx.closePath();
    ctx.fill();
    // Emitter glow ring
    const emitGlow = 0.5 + Math.sin(now / 200) * 0.5;
    ctx.strokeStyle = `rgba(74,222,128,${emitGlow})`;
    ctx.lineWidth = 1.5; ctx.shadowBlur = 12; ctx.shadowColor = '#4ade80';
    ctx.beginPath(); ctx.arc(30, 0, 3.5, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    // Hot core dot
    ctx.fillStyle = `rgba(187,247,208,${emitGlow})`;
    ctx.shadowBlur = 10; ctx.shadowColor = '#4ade80';
    ctx.beginPath(); ctx.arc(30, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // ── Grip / butt stock ─────────────────────────────────────────
    ctx.fillStyle = '#78350f';
    ctx.beginPath(); ctx.roundRect(-22, -5, 9, 10, 2); ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-22, -3, 9, 3);
    // Grip texture
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    for (let gly = -4; gly <= 4; gly += 2) {
        ctx.beginPath(); ctx.moveTo(-22, gly); ctx.lineTo(-13, gly); ctx.stroke();
    }

    ctx.restore();
}

/**
 * drawKaoGunEnhanced(ctx, weapon)
 * Enhanced version of the weapon draw — richer detail with Kao's
 * tactical cyberpunk aesthetic. Replaces the inline weapon draw.
 * Called after CTX.translate(15, 10).
 */
function drawKaoGunEnhanced(ctx, weaponType) {
    const now = performance.now();
    ctx.save();

    if (weaponType === 'sniper') {
        // ── SNIPER: Long-barrel precision rifle ───────────────────
        const g = ctx.createLinearGradient(0, -5, 0, 5);
        g.addColorStop(0, '#ef4444'); g.addColorStop(0.5, '#dc2626'); g.addColorStop(1, '#991b1b');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, -4, 32, 8, 2); ctx.fill();
        // Barrel extension
        ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.roundRect(28, -2.5, 14, 5, 1); ctx.fill();
        ctx.fillStyle = '#1e293b'; ctx.fillRect(28, -1.5, 14, 3);
        // Muzzle flash ring
        const mFlash = 0.4 + Math.sin(now / 250) * 0.3;
        ctx.fillStyle = `rgba(239,68,68,${mFlash})`; ctx.shadowBlur = 8; ctx.shadowColor = '#ef4444';
        ctx.beginPath(); ctx.arc(42, 0, 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        // Scope
        ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.roundRect(10, -11, 12, 7, 2); ctx.fill();
        ctx.fillStyle = '#3b82f6'; ctx.shadowBlur = 10; ctx.shadowColor = '#3b82f6';
        ctx.beginPath(); ctx.arc(16, -7, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(14, -7); ctx.lineTo(18, -7); ctx.moveTo(16, -9); ctx.lineTo(16, -5); ctx.stroke();
        // Stock
        ctx.fillStyle = '#7c2d12'; ctx.beginPath(); ctx.roundRect(-10, -3, 12, 6, 2); ctx.fill();
        ctx.strokeStyle = '#92400e'; ctx.lineWidth = 0.8;
        for (let i = -9; i < 0; i += 2) { ctx.beginPath(); ctx.moveTo(i, -3); ctx.lineTo(i, 3); ctx.stroke(); }
        // Foregrip
        ctx.fillStyle = '#1e293b'; ctx.fillRect(6, 4, 4, 8);
        ctx.fillStyle = '#334155'; ctx.fillRect(20, 4, 4, 6);
        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 4px Arial'; ctx.textAlign = 'center';
        ctx.fillText('SNIPER', 16, 1);

    } else if (weaponType === 'shotgun') {
        // ── SHOTGUN: Wide-bore tactical scatter ───────────────────
        const g = ctx.createLinearGradient(0, -7, 0, 7);
        g.addColorStop(0, '#f59e0b'); g.addColorStop(0.5, '#ea580c'); g.addColorStop(1, '#c2410c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, -6, 22, 12, 3); ctx.fill();
        // Double barrel
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.roundRect(18, -5.5, 12, 5, 1); ctx.fill();
        ctx.beginPath(); ctx.roundRect(18, 0.5, 12, 5, 1); ctx.fill();
        // Muzzle flash
        const sFlash = 0.45 + Math.sin(now / 200) * 0.35;
        ctx.fillStyle = `rgba(251,146,60,${sFlash})`; ctx.shadowBlur = 10; ctx.shadowColor = '#f59e0b';
        ctx.beginPath(); ctx.arc(30, -3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(30,  3, 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        // Pump / wood grip
        ctx.fillStyle = '#78350f'; ctx.beginPath(); ctx.roundRect(-10, -4, 12, 8, 2); ctx.fill();
        ctx.fillStyle = '#92400e'; ctx.fillRect(-10, -2, 12, 3);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
        for (let i = -9; i < 0; i += 2) { ctx.beginPath(); ctx.moveTo(i, -4); ctx.lineTo(i, 4); ctx.stroke(); }
        // Shell indicator strips
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(2, -8, 3, 2); ctx.fillRect(9, -8, 3, 2); ctx.fillRect(16, -8, 3, 2);
        // Trigger guard
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(8, 6, 5, 0, Math.PI); ctx.stroke();
        // Label
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 4px Arial'; ctx.textAlign = 'center';
        ctx.fillText('12G', 11, 1);

    } else {
        // ── AUTO RIFLE (default): Burst-fire tactical ─────────────
        const g = ctx.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#3b82f6'); g.addColorStop(0.5, '#2563eb'); g.addColorStop(1, '#1e40af');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, -5, 26, 10, 2); ctx.fill();
        // Rail / top
        ctx.fillStyle = '#1e293b'; ctx.fillRect(2, -7, 18, 2);
        ctx.fillStyle = '#334155'; ctx.fillRect(4, -8.5, 4, 1.5); ctx.fillRect(12, -8.5, 4, 1.5);
        // Barrel
        ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.roundRect(22, -2.5, 10, 5, 1); ctx.fill();
        // Muzzle glow
        const aFlash = 0.45 + Math.sin(now / 180) * 0.35;
        ctx.fillStyle = `rgba(96,165,250,${aFlash})`; ctx.shadowBlur = 10; ctx.shadowColor = '#60a5fa';
        ctx.beginPath(); ctx.arc(32, 0, 2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        // Mag
        ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.roundRect(8, 5, 8, 9, 1); ctx.fill();
        ctx.fillStyle = '#334155'; ctx.fillRect(9, 6, 6, 4);
        // Grip
        ctx.fillStyle = '#1e40af'; ctx.beginPath(); ctx.roundRect(-8, -3.5, 10, 7, 2); ctx.fill();
        // Charging handle / detail lines
        ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 1;
        ctx.strokeRect(2, -4, 5, 8); ctx.strokeRect(14, -4, 5, 8);
        // Label
        ctx.fillStyle = '#fff'; ctx.font = 'bold 5px Arial'; ctx.textAlign = 'center';
        ctx.fillText('MTC', 12, 1);
    }

    ctx.restore();
}

window.Projectile         = Projectile;
window.WeaponSystem        = WeaponSystem;
window.ProjectileManager   = ProjectileManager;
window.weaponSystem        = weaponSystem;
window.projectileManager   = projectileManager;
window.drawPoomWeapon      = drawPoomWeapon;
window.drawKaoGunEnhanced  = drawKaoGunEnhanced;

/**
 * drawAutoWeapon(ctx)
 * Auto's weapon art: a thermodynamic gauntlet / knuckle-duster
 * drawn in Crimson Red.  Called from AutoPlayer.draw() after
 * CTX.save() + CTX.translate(player screen pos) + CTX.rotate(angle).
 */
function drawAutoWeapon(ctx) {
    const now = performance.now();
    ctx.save();
    // Offset: weapon at player's forward "fist" position
    ctx.translate(10, 4);

    const glow = 0.5 + Math.sin(now / 220) * 0.5;

    // ── Knuckle base ──────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, -7, 0, 7);
    bg.addColorStop(0, '#fca5a5');
    bg.addColorStop(0.4, '#dc2626');
    bg.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(-10, -6, 22, 12, 4); ctx.fill();

    // ── Heat vent slits ───────────────────────────────────────────
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    for (let i = -5; i <= 5; i += 3) {
        ctx.beginPath(); ctx.moveTo(i, -5); ctx.lineTo(i, 5); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Knuckle spikes ────────────────────────────────────────────
    ctx.fillStyle = '#7f1d1d';
    for (let k = -6; k <= 6; k += 4) {
        ctx.beginPath();
        ctx.moveTo(k - 2, -6);
        ctx.lineTo(k + 2, -6);
        ctx.lineTo(k, -11);
        ctx.closePath();
        ctx.fill();
    }

    // ── Glow core dot ─────────────────────────────────────────────
    ctx.fillStyle = `rgba(251,113,133,${glow})`;
    ctx.shadowBlur = 10 * glow;
    ctx.shadowColor = '#dc2626';
    ctx.beginPath(); ctx.arc(4, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // ── Label ─────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 4px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('AUTO', 1, 1.5);

    ctx.restore();
}

window.drawAutoWeapon = drawAutoWeapon;