'use strict';

/**
 * js/weapons/ProjectileManager.js
 * ════════════════════════════════════════════════
 * Projectile update/collision/drawing and special spawners.
 * ════════════════════════════════════════════════
 */

class ProjectileManager {
    constructor() {
        this.projectiles = [];
        this._grid = (typeof SpatialGrid !== 'undefined') ? new SpatialGrid() : null;
    }

    add(projectile) {
        if (Array.isArray(projectile)) this.projectiles.push(...projectile);
        else if (projectile) this.projectiles.push(projectile);
    }

    update(dt, player, enemies, boss) {
        if (!this._grid && typeof SpatialGrid !== 'undefined') {
            this._grid = new SpatialGrid();
        }
        if (this._grid) {
            this._grid.build(enemies);
        }

        const projs = this.projectiles;

        for (let i = projs.length - 1; i >= 0; i--) {
            const proj = projs[i];
            const expired = proj.update(dt);
            let hit = false;

            if (proj.pierce > 0 && !proj.hitSet) proj.hitSet = new Set();

            if (proj.team === "player") {
                if (boss && !boss.dead && proj.checkCollision(boss)) {
                    if (!proj.hitSet || !proj.hitSet.has(boss)) {
                        boss.takeDamage(proj.damage);

                        if (typeof addScreenShake === "function")
                            addScreenShake(proj.isCrit ? 5 : 2);
                        if (typeof triggerHitStop === "function")
                            triggerHitStop(proj.isCrit ? 60 : 20);

                        spawnFloatingText(
                            Math.round(proj.damage),
                            proj.x,
                            proj.y - 20,
                            "white",
                            18,
                        );
                        if (typeof spawnHitMarker === "function")
                            spawnHitMarker(proj.x, proj.y);
                        if (
                            proj.kind === "punch" &&
                            typeof spawnWanchaiPunchText === "function"
                        ) {
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

                if (!hit) {
                    const candidates = this._grid ? this._grid.query(proj.x, proj.y) : enemies;
                    for (let j = 0; j < candidates.length; j++) {
                        const enemy = candidates[j];
                        if (enemy.dead) continue;
                        if (!proj.checkCollision(enemy)) continue;
                        if (proj.hitSet && proj.hitSet.has(enemy)) continue;

                        enemy.takeDamage(proj.damage, player);
                        if (typeof proj.onHit === "function") proj.onHit(enemy);

                        if (enemy.dead) {
                            if (typeof triggerHitStop === "function") triggerHitStop(40);
                            if (typeof addScreenShake === "function") addScreenShake(4);
                        } else if (proj.isCrit) {
                            if (typeof triggerHitStop === "function") triggerHitStop(30);
                            if (typeof addScreenShake === "function") addScreenShake(3);
                        }

                        spawnFloatingText(
                            Math.round(proj.damage),
                            proj.x,
                            proj.y - 20,
                            "white",
                            16,
                        );
                        if (typeof spawnHitMarker === "function")
                            spawnHitMarker(proj.x, proj.y);
                        if (
                            proj.kind === "punch" &&
                            typeof spawnWanchaiPunchText === "function"
                        ) {
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
            } else if (proj.team === "enemy") {
                if (
                    proj.checkCollision(player) &&
                    !player.isInvisible &&
                    !player.isFreeStealthy
                ) {
                    if (
                        typeof PatPlayer !== "undefined" &&
                        window.player instanceof PatPlayer
                    ) {
                        if (window.player.tryReflectProjectile(proj)) {
                            continue;
                        }
                    }
                    player.takeDamage(proj.damage);
                    hit = true;
                }
            }

            if (hit || expired) {
                if (hit) spawnParticles(proj.x, proj.y, 5, proj.color);
                projs[i] = projs[projs.length - 1];
                projs.pop();
            }
        }
    }

    draw() {
        for (let p of this.projectiles) p.draw();
    }
    clear() {
        this.projectiles = [];
    }
    getAll() {
        return this.projectiles;
    }

    spawnWanchaiPunch(x, y, angle) {
        const a = angle ?? 0;
        const sx = x + Math.cos(a) * 28;
        const sy = y + Math.sin(a) * 28;
        const p = new Projectile(sx, sy, a, 1500, 70, "#fb7185", false, "player", {
            kind: "punch",
            life: 0.15,
            size: 18,
            radius: 16,
            pierce: 0,
        });
        this.add(p);
    }

    spawnHeatWave(player, angle) {
        const a = angle ?? player?.angle ?? 0;
        const range =
            player?.stats?.heatWaveRange ??
            BALANCE.characters?.auto?.heatWaveRange ??
            180;

        const damageBase =
            player?.stats?.weapons?.auto?.damage ??
            BALANCE.characters?.auto?.weapons?.auto?.damage ??
            34;

        const dmgMult =
            (player?.damageBoost || 1) * (player?.damageMultiplier || 1);

        let damage = damageBase * dmgMult;
        try {
            if (player && typeof player.dealDamage === "function") {
                const res = player.dealDamage(damage);
                damage = res?.damage ?? damage;
            }
        } catch (e) { }

        const speed = Math.max(600, range * 9);
        const sx = player.x + Math.cos(a) * 22;
        const sy = player.y + Math.sin(a) * 22;

        const p = new Projectile(
            sx,
            sy,
            a,
            speed,
            damage,
            "#dc2626",
            false,
            "player",
            {
                kind: "heatwave",
                life: Math.max(0.12, range / speed) * 3,
                size: 18,
                radius: 18,
                pierce: 2,
                bounces: 3,
            },
        );
        this.add(p);
    }
}

window.ProjectileManager = ProjectileManager;
window.projectileManager = new ProjectileManager();
