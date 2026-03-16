'use strict';

/**
 * js/weapons/WeaponSystem.js
 * ════════════════════════════════════════════════
 * Weapon switching, fire pipeline, and weapon art for Kao and Auto.
 * ════════════════════════════════════════════════
 */

class WeaponSystem {
    constructor() {
        this.currentWeapon = "auto";
        this.weaponCooldown = 0;
        this.weaponsUsed = new Set(["auto"]);

        this.activeChar = "kao";

        // Burst fire state
        this.maxBurst = 3;
        this.burstDelay = 0.08;
        this.burstTimer = 0;
        this.isBursting = false;
        this.pendingBurstShots = 0;
    }

    // ── Weapon switching ──────────────────────────────────────────────────────
    setActiveChar(charType) {
        this.activeChar = charType || "kao";
        const charData = BALANCE.characters[this.activeChar];
        const firstWeapon = charData?.weapons
            ? Object.keys(charData.weapons)[0]
            : "auto";
        this.currentWeapon = firstWeapon;
        this.weaponsUsed = new Set([firstWeapon]);
    }

    getCharWeapons() {
        const charData = BALANCE.characters[this.activeChar];

        if (!charData) {
            console.warn(
                `[WeaponSystem] Unknown char "${this.activeChar}". Falling back to kao.`,
            );
            return BALANCE.characters.kao.weapons;
        }

        if (charData.weapons) return charData.weapons;

        const S = charData;
        const riceWeapon = {
            name: "🍙 ข้าวเหนียว",
            damage: S.riceDamage ?? 62,
            cooldown: S.riceCooldown ?? 0.46,
            range: S.riceRange ?? 750,
            speed: S.riceSpeed ?? 600,
            spread: 0,
            pellets: 1,
            color: S.riceColor ?? "#ffffff",
            icon: "🍙",
        };
        return { auto: riceWeapon, sniper: riceWeapon, shotgun: riceWeapon };
    }

    switchWeapon() {
        const weapons = Object.keys(this.getCharWeapons());
        const idx = weapons.indexOf(this.currentWeapon);
        this.currentWeapon = weapons[(idx + 1) % weapons.length];
        this.weaponsUsed.add(this.currentWeapon);
        this.updateWeaponUI();
        Audio.playWeaponSwitch();
        Achievements.stats.weaponsUsed = this.weaponsUsed;
        if (this.weaponsUsed.size >= 3) Achievements.check("weapon_master");

        if (window.player && window.player.charId === "kao") {
            player._weaponSwitchFlash = 0.5;
            player._prevWeaponKey = this.currentWeapon;
        }
    }

    updateWeaponUI() {
        try {
            if (this.activeChar === "poom") {
                const nameEl = document.getElementById("weapon-name");
                if (nameEl) {
                    nameEl.textContent = "🍙 ข้าวเหนียว";
                    nameEl.style.color = "#ffffff";
                }
                return;
            }

            if (this.activeChar === "auto") {
                const nameEl = document.getElementById("weapon-name");
                if (nameEl) {
                    nameEl.textContent = "🔥 HEAT WAVE";
                    nameEl.style.color = "#dc2626";
                }
                return;
            }

            const weapons = this.getCharWeapons();
            const weaponData = weapons[this.currentWeapon];
            if (!weaponData) {
                console.warn(
                    `[WeaponSystem] Weapon "${this.currentWeapon}" not in char "${this.activeChar}".`,
                );
                return;
            }
            const nameEl = document.getElementById("weapon-name");
            if (nameEl) {
                nameEl.textContent = weaponData.name;
                nameEl.style.color = weaponData.color;
            }

            const indicator = document.querySelector(".weapon-indicator");
            if (indicator) {
                indicator.classList.remove("weapon-indicator--hidden");
                clearTimeout(this._weaponHideTimer);
                this._weaponHideTimer = setTimeout(() => {
                    indicator.classList.add("weapon-indicator--hidden");
                }, 2500);
            }
        } catch (err) {
            console.error("[WeaponSystem] updateWeaponUI failed:", err);
        }
    }

    getCurrentWeapon() {
        return this.currentWeapon;
    }

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
                    this.weaponCooldown = this.getCharWeapons().auto.cooldown;
                }
            }
        }
    }

    canShoot() {
        return this.weaponCooldown <= 0 && !this.isBursting;
    }

    shoot(player, damageMultiplier = 1) {
        if (!this.canShoot()) return [];
        const projectiles = [];

        if (this.currentWeapon === "auto") {
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
        if (!this.isBursting || this.burstTimer > 0 || this.pendingBurstShots <= 0)
            return [];
        const shot = this.shootSingle(player, damageMultiplier);
        this.burstTimer = this.burstDelay;
        this.pendingBurstShots--;
        if (this.pendingBurstShots <= 0) {
            this.isBursting = false;
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
            const critMult =
                BALANCE.characters[this.activeChar]?.critMultiplier ?? 2.5;
            damage *= critMult;
            isCrit = true;
            color = "#facc15";
            player.ambushReady = false;
            player.breakStealth();
            spawnParticles(player.x, player.y, 15, "#facc15");
            Achievements.stats.crits++;
            Achievements.check("crit_master");
        } else if (player.isInvisible) {
            player.breakStealth();
        }

        if (player.onGraph) {
            damage *= 1.67;
            if (!isCrit) color = "#f59e0b";
            spawnFloatingText(
                GAME_TEXTS.combat.highGround,
                player.x,
                player.y - 40,
                "#f59e0b",
                16,
            );
        }

        damage *= player.damageMultiplier || 1.0;

        const MUZZLE_OFFSETS = {
            auto: 49,
            sniper: 69,
            shotgun: 45,
            poom: 43,
            autoPlayer: 51,
            katana: 44,
        };
        let offset;
        if (player.charId === "poom") {
            offset = MUZZLE_OFFSETS.poom;
        } else if (player.charId === "auto") {
            offset = MUZZLE_OFFSETS.autoPlayer;
        } else if (player.charId === "pat") {
            offset = MUZZLE_OFFSETS.katana;
        } else {
            offset = MUZZLE_OFFSETS[this.currentWeapon] ?? 49;
        }
        for (let i = 0; i < weapon.pellets; i++) {
            const spread = (Math.random() - 0.5) * weapon.spread;
            const angle = player.angle + spread;
            const sx = player.x + Math.cos(angle) * offset;
            const sy = player.y + Math.sin(angle) * offset;

            let projOptions = {};
            if (this.currentWeapon === "sniper") {
                projOptions.bounces = 2;
                projOptions.life = 5;
            } else if (this.currentWeapon === "shotgun") {
                projOptions.bounces = 1;
                projOptions.life = 2.5;
            }

            const p = new Projectile(
                sx,
                sy,
                angle,
                weapon.speed,
                damage / weapon.pellets,
                color,
                isCrit,
                "player",
                projOptions,
            );
            p.weaponKind = this.currentWeapon;
            projectiles.push(p);
        }

        player.vx -= Math.cos(player.angle) * 50;
        player.vy -= Math.sin(player.angle) * 50;

        if (
            typeof shellCasingSystem !== "undefined" &&
            (this.currentWeapon === "auto" ||
                this.currentWeapon === "sniper" ||
                this.currentWeapon === "shotgun")
        ) {
            const shellCount = this.currentWeapon === "shotgun" ? 3 : 1;
            const shellSpeed = this.currentWeapon === "sniper" ? 160 : 120;
            for (let _s = 0; _s < shellCount; _s++) {
                shellCasingSystem.spawn(player.x, player.y, player.angle, shellSpeed);
            }
        }

        Audio.playShoot(this.currentWeapon);
        return projectiles;
    }

    drawWeaponOnPlayer(player) {
        CTX.save();
        CTX.translate(15, 10);
        CTX.fillStyle = "rgba(0, 0, 0, 0.3)";
        CTX.fillRect(2, 2, 26, 10);
        drawKaoGunEnhanced(
            CTX,
            this.currentWeapon,
            !!(player && player.isWeaponMaster),
        );
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🎨 WEAPON ART FUNCTIONS
// ════════════════════════════════════════════════════════════

function drawKaoGunEnhanced(ctx, weaponType, isAwakened = false) {
    const now = performance.now();
    ctx.save();

    if (weaponType === "sniper") {
        const now2 = now;
        const powerPulse = 0.5 + Math.sin(now2 / 200) * 0.5;

        ctx.fillStyle = "#1e3a5f";
        ctx.beginPath();
        ctx.roundRect(-14, -4, 12, 8, 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(147,197,253,0.3)";
        ctx.lineWidth = 0.8;
        for (let gls = -13; gls < -4; gls += 2.5) {
            ctx.beginPath();
            ctx.moveTo(gls, -4);
            ctx.lineTo(gls, 4);
            ctx.stroke();
        }

        const recvG = ctx.createLinearGradient(0, -5, 0, 5);
        recvG.addColorStop(0, "#334155");
        recvG.addColorStop(0.5, "#1e293b");
        recvG.addColorStop(1, "#0f172a");
        ctx.fillStyle = recvG;
        ctx.beginPath();
        ctx.roundRect(-2, -5, 20, 10, 2);
        ctx.fill();

        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.roundRect(18, -2.5, 26, 5, 1.5);
        ctx.fill();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(18, -1.5);
        ctx.lineTo(44, -1.5);
        ctx.stroke();
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(42, -3.5, 6, 7, 2);
        ctx.fill();
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 0.8;
        for (let si = 43; si < 48; si += 1.5) {
            ctx.beginPath();
            ctx.moveTo(si, -3.5);
            ctx.lineTo(si, 3.5);
            ctx.stroke();
        }
        const muzzle = 0.4 + Math.sin(now2 / 300) * 0.3;
        ctx.fillStyle = `rgba(0,229,255,${muzzle})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#00e5ff";
        ctx.beginPath();
        ctx.arc(49, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        const lineGrad = ctx.createLinearGradient(-2, 0, 44, 0);
        lineGrad.addColorStop(0, `rgba(0,229,255,0)`);
        lineGrad.addColorStop(0.15, `rgba(0,229,255,${powerPulse * 0.7})`);
        lineGrad.addColorStop(0.8, `rgba(96,165,250,${powerPulse})`);
        lineGrad.addColorStop(1, `rgba(147,197,253,0.3)`);
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 10 * powerPulse;
        ctx.shadowColor = "#00e5ff";
        ctx.beginPath();
        ctx.moveTo(-2, -5.5);
        ctx.lineTo(44, -5.5);
        ctx.stroke();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = `rgba(96,165,250,${powerPulse * 0.6})`;
        ctx.lineWidth = 0.8;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(2, 5.5);
        ctx.lineTo(42, 5.5);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(6, -13, 16, 9, 2);
        ctx.fill();
        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.roundRect(5, -5, 18, 2, 1);
        ctx.fill();
        ctx.fillStyle = "#0ea5e9";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#0284c7";
        ctx.beginPath();
        ctx.arc(14, -9, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#e0f2fe";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(11, -9);
        ctx.lineTo(17, -9);
        ctx.moveTo(14, -12);
        ctx.lineTo(14, -6);
        ctx.stroke();
        ctx.fillStyle = `rgba(224,242,254,${0.6 + Math.sin(now2 / 180) * 0.4})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#00e5ff";
        ctx.beginPath();
        ctx.arc(14, -9, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#475569";
        ctx.beginPath();
        ctx.arc(8, -9, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(20, -9, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#1e3a5f";
        ctx.beginPath();
        ctx.roundRect(8, 5, 4, 9, 1);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(22, 5, 4, 7, 1);
        ctx.fill();

        // Suppressor cylinder on barrel end
        ctx.fillStyle = "#0d1f38";
        ctx.beginPath();
        ctx.roundRect(44, -4, 10, 8, 3);
        ctx.fill();
        ctx.strokeStyle = "#1e3a5f";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(44, -4, 10, 8, 3);
        ctx.stroke();
        // Suppressor baffle lines
        ctx.strokeStyle = "rgba(30,58,138,0.5)";
        ctx.lineWidth = 0.7;
        for (let sl = 46; sl < 53; sl += 2) {
            ctx.beginPath();
            ctx.moveTo(sl, -4);
            ctx.lineTo(sl, 4);
            ctx.stroke();
        }
        // Muzzle dot
        const suppGlow = 0.3 + Math.sin(now / 300) * 0.2;
        ctx.fillStyle = `rgba(6,182,212,${suppGlow})`;
        ctx.shadowBlur = 5;
        ctx.shadowColor = "#06b6d4";
        ctx.beginPath();
        ctx.arc(54, 0, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(147,197,253,0.8)";
        ctx.font = "bold 4px Arial";
        ctx.textAlign = "center";
        ctx.fillText("KAO-SR", 8, 2);
    } else if (weaponType === "shotgun") {
        const g = ctx.createLinearGradient(0, -7, 0, 7);
        g.addColorStop(0, "#f59e0b");
        g.addColorStop(0.5, "#ea580c");
        g.addColorStop(1, "#c2410c");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(0, -6, 22, 12, 3);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.roundRect(18, -5.5, 12, 5, 1);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(18, 0.5, 12, 5, 1);
        ctx.fill();
        const sFlash = 0.45 + Math.sin(now / 200) * 0.35;
        ctx.fillStyle = `rgba(251,146,60,${sFlash})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#f59e0b";
        ctx.beginPath();
        ctx.arc(30, -3, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(30, 3, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#78350f";
        ctx.beginPath();
        ctx.roundRect(-10, -4, 12, 8, 2);
        ctx.fill();
        ctx.fillStyle = "#92400e";
        ctx.fillRect(-10, -2, 12, 3);
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 1;
        for (let i = -9; i < 0; i += 2) {
            ctx.beginPath();
            ctx.moveTo(i, -4);
            ctx.lineTo(i, 4);
            ctx.stroke();
        }
        ctx.fillStyle = "#dc2626";
        ctx.fillRect(2, -8, 3, 2);
        ctx.fillRect(9, -8, 3, 2);
        ctx.fillRect(16, -8, 3, 2);
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(8, 6, 5, 0, Math.PI);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.font = "bold 4px Arial";
        ctx.textAlign = "center";
        ctx.fillText("12G", 11, 1);
    } else {
        const g = ctx.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, "#3b82f6");
        g.addColorStop(0.5, "#2563eb");
        g.addColorStop(1, "#1e40af");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(0, -5, 26, 10, 2);
        ctx.fill();
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(2, -7, 20, 2.5);
        ctx.strokeStyle = "rgba(96,165,250,0.25)";
        ctx.lineWidth = 0.7;
        for (let rs = 3; rs < 21; rs += 3) {
            ctx.beginPath();
            ctx.moveTo(rs, -7);
            ctx.lineTo(rs, -4.5);
            ctx.stroke();
        }
        ctx.fillStyle = "#334155";
        ctx.fillRect(4, -8.5, 4, 1.5);
        ctx.fillRect(14, -8.5, 4, 1.5);
        ctx.fillStyle = "#0f172a";
        ctx.beginPath();
        ctx.roundRect(22, -2.5, 12, 5, 1);
        ctx.fill();
        const aFlash = 0.45 + Math.sin(now / 180) * 0.35;
        ctx.fillStyle = `rgba(96,165,250,${aFlash})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#60a5fa";
        ctx.beginPath();
        ctx.arc(34, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(8, 5, 8, 10, 1);
        ctx.fill();
        ctx.fillStyle = "#334155";
        ctx.fillRect(9, 6, 6, 4);
        ctx.strokeStyle = "rgba(59,130,246,0.4)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(10, 6);
        ctx.lineTo(10, 12);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(14, 6);
        ctx.lineTo(14, 12);
        ctx.stroke();
        ctx.fillStyle = "#1e3a5f";
        ctx.beginPath();
        ctx.roundRect(4, 5, 7, 8, 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(96,165,250,0.3)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(4, 5, 7, 8, 2);
        ctx.stroke();
        ctx.fillStyle = "#1e40af";
        ctx.beginPath();
        ctx.roundRect(-8, -3.5, 10, 7, 2);
        ctx.fill();
        ctx.strokeStyle = "#60a5fa";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(2, -4, 5, 8);
        ctx.strokeRect(14, -4, 5, 8);
        ctx.fillStyle = "rgba(147,197,253,0.9)";
        ctx.font = "bold 5px Arial";
        ctx.textAlign = "center";
        ctx.fillText("MTC", 12, 1);
    }

    if (isAwakened) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        if (weaponType === "sniper") {
            const rRingPhase = (now / 300) % (Math.PI * 2);
            for (let ri = 0; ri < 3; ri++) {
                const rx = 10 + ri * 12;
                const rAlpha = 0.55 + Math.sin(rRingPhase + ri * 1.2) * 0.35;
                ctx.globalAlpha = rAlpha;
                ctx.strokeStyle = "#38bdf8";
                ctx.lineWidth = 1.2;
                ctx.shadowBlur = 8;
                ctx.shadowColor = "#0ea5e9";
                ctx.beginPath();
                ctx.ellipse(rx, 0, 2.5, 5.5, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.globalAlpha = 0.28;
            const laserGrad = ctx.createLinearGradient(49, 0, 130, 0);
            laserGrad.addColorStop(0, "#ef4444");
            laserGrad.addColorStop(1, "rgba(239,68,68,0)");
            ctx.strokeStyle = laserGrad;
            ctx.lineWidth = 0.8;
            ctx.shadowBlur = 6;
            ctx.shadowColor = "#ef4444";
            ctx.beginPath();
            ctx.moveTo(49, 0);
            ctx.lineTo(130, 0);
            ctx.stroke();
        } else if (weaponType === "shotgun") {
            const heatFlicker = 0.6 + Math.sin(now / 80) * 0.4;
            ctx.globalAlpha = heatFlicker * 0.7;
            ctx.fillStyle = "#dc2626";
            ctx.shadowBlur = 16;
            ctx.shadowColor = "#f97316";
            ctx.beginPath();
            ctx.arc(27, -3, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(27, 3, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.35 + Math.sin(now / 150) * 0.2;
            ctx.strokeStyle = "#fde68a";
            ctx.lineWidth = 1;
            ctx.lineCap = "round";
            ctx.shadowBlur = 4;
            ctx.shadowColor = "#f59e0b";
            ctx.beginPath();
            ctx.moveTo(24, -7);
            ctx.quadraticCurveTo(26, -13, 22, -17);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(30, -7);
            ctx.quadraticCurveTo(33, -14, 30, -19);
            ctx.stroke();
        } else {
            const hPhase = (now / 500) % (Math.PI * 2);
            const hFloat = Math.sin(hPhase) * 2.5;
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = "rgba(96,165,250,0.25)";
            ctx.strokeStyle = "#60a5fa";
            ctx.lineWidth = 0.9;
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#60a5fa";
            ctx.beginPath();
            ctx.roundRect(8, -15 + hFloat, 10, 5, 1.5);
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 0.45;
            ctx.strokeStyle = "#7dd3fc";
            ctx.lineWidth = 0.7;
            ctx.setLineDash([1.5, 2]);
            ctx.beginPath();
            ctx.moveTo(9, -10 + hFloat);
            ctx.lineTo(9, -7);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(17, -10 + hFloat);
            ctx.lineTo(17, -7);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.9 + Math.sin(now / 120) * 0.1;
            ctx.fillStyle = "#38bdf8";
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#0ea5e9";
            ctx.beginPath();
            ctx.arc(13, -12.5 + hFloat, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    ctx.restore();
}

function drawAutoWeapon(ctx, wanchaiActive = false, ventGlow = 0.3) {
    const now = performance.now();
    ctx.save();
    ctx.translate(12, 4);

    const heat = wanchaiActive ? 1.0 : ventGlow;
    const firePulse = Math.max(0, 0.4 + Math.sin(now / 160) * 0.6);

    const bg = ctx.createLinearGradient(0, -9, 0, 9);
    bg.addColorStop(0, "#fca5a5");
    bg.addColorStop(0.35, "#dc2626");
    bg.addColorStop(0.7, "#991b1b");
    bg.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(-11, -8, 26, 16, 4);
    ctx.fill();
    ctx.strokeStyle = "#450a0a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-11, -8, 26, 16, 4);
    ctx.stroke();

    ctx.fillStyle = "rgba(127,29,29,0.55)";
    ctx.beginPath();
    ctx.roundRect(-8, -5, 18, 6, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(220,38,38,0.3)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.roundRect(-8, -5, 18, 6, 2);
    ctx.stroke();

    ctx.fillStyle = "#3d0808";
    ctx.beginPath();
    ctx.roundRect(15, -5, 16, 10, 2);
    ctx.fill();
    ctx.strokeStyle = "#5c1010";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(15, -5, 16, 10, 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(239,68,68,0.25)";
    ctx.lineWidth = 0.7;
    for (let sv = 17; sv <= 28; sv += 4) {
        ctx.beginPath();
        ctx.moveTo(sv, -5);
        ctx.lineTo(sv, 5);
        ctx.stroke();
    }

    ctx.fillStyle = "#1a0505";
    ctx.beginPath();
    ctx.roundRect(31, -3.5, 8, 7, [0, 3, 3, 0]);
    ctx.fill();
    ctx.strokeStyle = "#3d0808";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(31, -3.5, 8, 7, [0, 3, 3, 0]);
    ctx.stroke();
    for (let mp = 0; mp < 3; mp++) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.beginPath();
        ctx.arc(33 + mp * 2, -3, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(33 + mp * 2, 3, 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
    const muzzleGlow = 0.3 + Math.sin(now / 140) * 0.2;
    ctx.fillStyle = `rgba(239,68,68,${muzzleGlow * heat})`;
    ctx.shadowBlur = 8 * muzzleGlow * heat;
    ctx.shadowColor = "#dc2626";
    ctx.beginPath();
    ctx.arc(39, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    const pistonPositions = [-6, 0, 6];
    for (let pi = 0; pi < pistonPositions.length; pi++) {
        const px = pistonPositions[pi];
        const pistonPhase = Math.sin(now / 100 + pi * 1.2);
        const pistonOffset = pistonPhase * 2 * heat;
        ctx.fillStyle = "#450a0a";
        ctx.beginPath();
        ctx.roundRect(px - 2, -7, 4, 14, 1);
        ctx.fill();
        ctx.fillStyle = "#9f1239";
        ctx.beginPath();
        ctx.roundRect(px - 1, -6 + pistonOffset, 2, 7 - pistonOffset, 0);
        ctx.fill();
        ctx.fillStyle = "#fca5a5";
        ctx.beginPath();
        ctx.roundRect(px - 2.5, -6 + pistonOffset, 5, 3, 1);
        ctx.fill();
    }

    for (let ep = -1; ep <= 1; ep += 2) {
        const epx = ep * 7;
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(epx - 1.5, -13, 3, 7, 1);
        ctx.fill();
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(epx - 2.5, -9, 5, 2, 0);
        ctx.fill();
        ctx.stroke();
        if (heat > 0.2) {
            const fireAlpha = heat * firePulse * 0.8;
            ctx.globalAlpha = fireAlpha;
            ctx.shadowBlur = 14 * heat;
            ctx.shadowColor = "#fb923c";
            const fx = epx + Math.sin(now / 80 + ep) * 1.5;
            const fy = -14 - heat * firePulse * 5;
            ctx.fillStyle = "#fb923c";
            ctx.beginPath();
            ctx.arc(fx, fy, Math.max(0, 3 * heat * firePulse), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fde68a";
            ctx.globalAlpha = fireAlpha * 0.5;
            ctx.beginPath();
            ctx.arc(fx, fy - 3.5, Math.max(0, 2 * heat), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    ctx.shadowBlur = 7 * heat;
    ctx.shadowColor = "#fb923c";
    for (let vi = 0; vi < 4; vi++) {
        const vp = heat * (0.4 + vi * 0.1) * (0.6 + Math.sin(now / 130 + vi) * 0.4);
        const ventG = ctx.createLinearGradient(-11, 0, -8, 0);
        ventG.addColorStop(0, `rgba(251,146,60,${vp * 1.2})`);
        ventG.addColorStop(1, `rgba(239,68,68,${vp * 0.5})`);
        ctx.fillStyle = ventG;
        ctx.beginPath();
        ctx.roundRect(-11, -5.5 + vi * 3.5, 4, 2, 1);
        ctx.fill();
        ctx.fillStyle = `rgba(251,146,60,${vp})`;
        ctx.beginPath();
        ctx.roundRect(21, -5.5 + vi * 3.5, 4, 2, 1);
        ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#5c1010";
    for (let k = -7; k <= 7; k += 4) {
        const spH = 5 + heat * firePulse * 2.5;
        ctx.beginPath();
        ctx.moveTo(k - 2, -8);
        ctx.lineTo(k + 2, -8);
        ctx.lineTo(k, -8 - spH);
        ctx.closePath();
        ctx.fill();
    }

    const cP = heat * firePulse;
    ctx.save();
    ctx.translate(3, 0);
    ctx.beginPath();
    for (let hi = 0; hi < 6; hi++) {
        const ha = (hi / 6) * Math.PI * 2 - Math.PI / 6;
        if (hi === 0) ctx.moveTo(Math.cos(ha) * 4, Math.sin(ha) * 4);
        else ctx.lineTo(Math.cos(ha) * 4, Math.sin(ha) * 4);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(251,113,133,${cP * 0.9})`;
    ctx.shadowBlur = 14 * cP;
    ctx.shadowColor = "#dc2626";
    ctx.fill();
    ctx.strokeStyle = `rgba(252,165,165,${cP * 0.7})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;

    ctx.restore();
}

window.WeaponSystem = WeaponSystem;
window.weaponSystem = new WeaponSystem();
window.drawKaoGunEnhanced = drawKaoGunEnhanced;
window.drawAutoWeapon = drawAutoWeapon;
