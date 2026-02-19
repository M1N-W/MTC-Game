'use strict';
/**
 * js/entities/enemy.js
 *
 * ► Enemy      — Basic grunt
 * ► TankEnemy  — Heavy melee bruiser
 * ► MageEnemy  — Ranged caster (confusion + meteor)
 * ► PowerUp    — Loot drop (collected by player)
 *
 * Depends on: base.js (Entity)
 *
 * ────────────────────────────────────────────────────────────────
 * COMBAT FEEDBACK ADDITIONS (Lead Gameplay Developer pass)
 * ────────────────────────────────────────────────────────────────
 * ✅ HIT FLASH — All three enemy classes (Enemy, TankEnemy, MageEnemy)
 *    now implement a white-silhouette flash whenever takeDamage() is called:
 *
 *    Construction:  this.hitFlashTimer = 0;
 *    On damage:     this.hitFlashTimer = HIT_FLASH_DURATION;   // 0.10 s
 *    In update():   if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
 *    In draw():     a full-coverage white shape (matching the enemy's silhouette)
 *                   is painted on top of the normal sprite at up to 75 % alpha,
 *                   linearly fading to 0 over the flash duration.
 *
 *    The flash duration constant HIT_FLASH_DURATION = 0.10 s (≈ 6 frames at
 *    60 fps) sits at the top of this file so it can be tuned centrally.
 *
 *    Draw implementation uses `CTX.save()/restore()` so no canvas state
 *    leaks into the health-bar drawing that immediately follows.
 *
 * ────────────────────────────────────────────────────────────────
 * BALANCE — GLITCH WAVE DAMAGE REDUCTION (Balance Designer pass)
 * ────────────────────────────────────────────────────────────────
 * ✅ GLITCH WAVE MITIGATION — When window.isGlitchWave is true (set by
 *    game.js whenever a Glitch Wave is in progress), all melee contact
 *    damage dealt to the player by Enemy and TankEnemy is multiplied by
 *    GLITCH_DAMAGE_MULT (0.6), giving a 40 % reduction.
 *
 *    Rationale: Glitch Waves already invert player controls and spawn a
 *    double horde; reducing contact damage prevents unavoidable death
 *    from disorientation without removing the tension of the mechanic.
 *
 *    window.isGlitchWave is a boolean synced by game.js on every state
 *    change; reading it here via window avoids any import/scope coupling.
 */

// ─── Tunable: seconds a hit-flash stays at full opacity before fading out ───
// At 0.10 s (≈ 6 frames @ 60 fps) the flash is snappy but legible.
const HIT_FLASH_DURATION = 0.10;

// ─── Tunable: enemy contact damage multiplier during a Glitch Wave ──────────
// 0.6 = 40 % reduction. Applies only to melee contact (not projectiles).
const GLITCH_DAMAGE_MULT = 0.6;

// ════════════════════════════════════════════════════════════
// ENEMIES
// ════════════════════════════════════════════════════════════
class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, BALANCE.enemy.radius);
        // Exponential HP scaling: baseHp * (1.25^(wave/2))
        // Creates curved difficulty that prevents bullet sponge enemies
        this.maxHp = Math.floor(BALANCE.enemy.baseHp * Math.pow(1.25, getWave() / 2));
        this.hp = this.maxHp;
        this.speed  = BALANCE.enemy.baseSpeed + getWave()*BALANCE.enemy.speedPerWave;
        this.damage = BALANCE.enemy.baseDamage + getWave()*BALANCE.enemy.damagePerWave;
        this.shootTimer = rand(...BALANCE.enemy.shootCooldown);
        this.color = randomChoice(BALANCE.enemy.colors);
        this.type = 'basic'; this.expValue = BALANCE.enemy.expValue;

        // ── Hit flash state ──────────────────────────────────
        // Seconds remaining on the white-silhouette flash.
        // Set to HIT_FLASH_DURATION on every takeDamage() call.
        // Decays in update(); drawn in draw() if > 0.
        this.hitFlashTimer = 0;
    }

    update(dt, player) {
        if (this.dead) return;

        // ── Tick hit-flash timer ─────────────────────────────
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

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

        // ── Melee contact damage ─────────────────────────────
        // During a Glitch Wave, reduce contact damage by 40 % to keep the
        // inverted-controls chaos survivable without removing the threat.
        if (d<this.radius+player.radius) {
            const contactDamage = this.damage * dt * 3;
            const glitchMult    = window.isGlitchWave ? GLITCH_DAMAGE_MULT : 1.0;
            player.takeDamage(contactDamage * glitchMult);
        }
    }

    takeDamage(amt, player) {
        this.hp-=amt;

        // ── Trigger hit flash ────────────────────────────────
        // Reset to full duration on every hit so rapid hits keep the flash active.
        this.hitFlashTimer = HIT_FLASH_DURATION;

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

        // Shadow / ground ellipse
        CTX.fillStyle='rgba(0,0,0,0.3)'; CTX.beginPath();
        CTX.ellipse(screen.x,screen.y+20,15,7,0,0,Math.PI*2); CTX.fill();

        // ── Normal sprite ────────────────────────────────────
        CTX.save(); CTX.translate(screen.x,screen.y); CTX.rotate(this.angle);
        CTX.fillStyle=this.color; CTX.beginPath(); CTX.arc(0,0,this.radius,0,Math.PI*2); CTX.fill();
        CTX.fillStyle='#000'; CTX.beginPath(); CTX.arc(8,0,4,0,Math.PI*2); CTX.fill();
        CTX.restore();

        // ── Hit flash — white silhouette ─────────────────────
        // Painted AFTER the sprite restore so it composites cleanly on top.
        // Alpha ramps from 0.75 at full flash → 0 as timer expires.
        if (this.hitFlashTimer > 0) {
            const flashAlpha = (this.hitFlashTimer / HIT_FLASH_DURATION) * 0.75;
            CTX.save();
            CTX.globalAlpha = flashAlpha;
            CTX.fillStyle   = '#ffffff';
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, this.radius, 0, Math.PI * 2);
            CTX.fill();
            CTX.restore();
        }

        // ── HP bar ───────────────────────────────────────────
        const hp=this.hp/this.maxHp, bw=30;
        CTX.fillStyle='#1e293b'; CTX.fillRect(screen.x-bw/2,screen.y-30,bw,4);
        CTX.fillStyle='#ef4444'; CTX.fillRect(screen.x-bw/2,screen.y-30,bw*hp,4);
    }
}

class TankEnemy extends Entity {
    constructor(x,y) {
        super(x,y,BALANCE.tank.radius);
        // Heavy exponential HP scaling: baseHp * (1.25^(wave/1.8))
        // Tanks remain threatening but become manageable with focused fire
        this.maxHp = Math.floor(BALANCE.tank.baseHp * Math.pow(1.25, getWave() / 1.8));
        this.hp=this.maxHp;
        this.speed=BALANCE.tank.baseSpeed+getWave()*BALANCE.tank.speedPerWave;
        this.damage=BALANCE.tank.baseDamage+getWave()*BALANCE.tank.damagePerWave;
        this.color=BALANCE.tank.color; this.type='tank'; this.expValue=BALANCE.tank.expValue;

        // ── Hit flash state ──────────────────────────────────
        this.hitFlashTimer = 0;
    }

    update(dt,player) {
        if(this.dead) return;

        // ── Tick hit-flash timer ─────────────────────────────
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

        const dx=player.x-this.x, dy=player.y-this.y;
        const d=dist(this.x,this.y,player.x,player.y);
        this.angle=Math.atan2(dy,dx);
        if(!player.isInvisible){this.vx=Math.cos(this.angle)*this.speed;this.vy=Math.sin(this.angle)*this.speed;}
        else{this.vx*=0.95;this.vy*=0.95;}
        this.applyPhysics(dt);

        // ── Melee contact damage ─────────────────────────────
        // Glitch Wave reduces Tank melee damage by 40 % — tanks hit
        // very hard and the player can't dodge reliably with inverted controls.
        if(d<BALANCE.tank.meleeRange+player.radius) {
            const contactDamage = this.damage * dt * 2;
            const glitchMult    = window.isGlitchWave ? GLITCH_DAMAGE_MULT : 1.0;
            player.takeDamage(contactDamage * glitchMult);
        }
    }

    takeDamage(amt,player) {
        this.hp-=amt;

        // ── Trigger hit flash ────────────────────────────────
        this.hitFlashTimer = HIT_FLASH_DURATION;

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

        // Shadow
        CTX.fillStyle='rgba(0,0,0,0.4)'; CTX.beginPath();
        CTX.ellipse(screen.x,screen.y+25,20,10,0,0,Math.PI*2); CTX.fill();

        // ── Normal sprite ────────────────────────────────────
        CTX.save(); CTX.translate(screen.x,screen.y); CTX.rotate(this.angle);
        CTX.fillStyle=this.color; CTX.fillRect(-20,-20,40,40);
        CTX.fillStyle='#57534e'; CTX.fillRect(-18,-18,12,36); CTX.fillRect(6,-18,12,36);
        CTX.fillStyle='#dc2626'; CTX.beginPath(); CTX.arc(10,0,6,0,Math.PI*2); CTX.fill();
        CTX.restore();

        // ── Hit flash — white silhouette (matches square body) ──
        // TankEnemy body is a 40×40 rect centred on the entity.
        // We draw a matching rect in white to create the flash silhouette.
        if (this.hitFlashTimer > 0) {
            const flashAlpha = (this.hitFlashTimer / HIT_FLASH_DURATION) * 0.75;
            CTX.save();
            CTX.globalAlpha   = flashAlpha;
            CTX.fillStyle     = '#ffffff';
            // Replicate the translate + rotate that the sprite uses
            CTX.translate(screen.x, screen.y);
            CTX.rotate(this.angle);
            CTX.fillRect(-20, -20, 40, 40);
            CTX.restore();
        }

        // ── HP bar ───────────────────────────────────────────
        const hp=this.hp/this.maxHp;
        CTX.fillStyle='#1e293b'; CTX.fillRect(screen.x-20,screen.y-35,40,5);
        CTX.fillStyle='#78716c'; CTX.fillRect(screen.x-20,screen.y-35,40*hp,5);
    }
}

class MageEnemy extends Entity {
    constructor(x,y) {
        super(x,y,BALANCE.mage.radius);
        // Moderate exponential HP scaling: baseHp * (1.28^(wave/2))
        // Mages remain glass cannons but scale reasonably
        this.maxHp=Math.floor(BALANCE.mage.baseHp * Math.pow(1.28, getWave() / 2));
        this.hp=this.maxHp;
        this.speed=BALANCE.mage.baseSpeed+getWave()*BALANCE.mage.speedPerWave;
        this.damage=BALANCE.mage.baseDamage+getWave()*BALANCE.mage.damagePerWave;
        this.color=BALANCE.mage.color; this.type='mage';
        this.soundWaveCD=0; this.meteorCD=0; this.expValue=BALANCE.mage.expValue;

        // ── Hit flash state ──────────────────────────────────
        this.hitFlashTimer = 0;
    }

    update(dt,player) {
        if(this.dead) return;

        // ── Tick hit-flash timer ─────────────────────────────
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

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

        // ── Trigger hit flash ────────────────────────────────
        this.hitFlashTimer = HIT_FLASH_DURATION;

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

        // Shadow
        CTX.fillStyle='rgba(0,0,0,0.3)'; CTX.beginPath();
        CTX.ellipse(screen.x,screen.y+18,13,6,0,0,Math.PI*2); CTX.fill();

        // ── Normal sprite (with floating bob animation) ──────
        // Capture the current bob offset so the flash can match it.
        const bobOffset = Math.sin(performance.now()/300) * 3;

        CTX.save(); CTX.translate(screen.x, screen.y + bobOffset); CTX.rotate(this.angle);
        CTX.fillStyle=this.color; CTX.beginPath(); CTX.arc(0,5,15,0,Math.PI*2); CTX.fill();
        CTX.strokeStyle='#6b21a8'; CTX.lineWidth=3; CTX.beginPath();
        CTX.moveTo(-10,0); CTX.lineTo(-10,-25); CTX.stroke();
        CTX.fillStyle='#fbbf24'; CTX.shadowBlur=10; CTX.shadowColor='#fbbf24';
        CTX.beginPath(); CTX.arc(-10,-25,5,0,Math.PI*2); CTX.fill(); CTX.shadowBlur=0;
        CTX.fillStyle='#7c3aed'; CTX.beginPath(); CTX.arc(0,-5,12,0,Math.PI); CTX.fill();
        CTX.restore();

        // ── Hit flash — white silhouette ─────────────────────
        // The MageEnemy body is approximately a circle of radius 15 at (0, +5)
        // relative to the bobbing position. We draw that same circle in white.
        if (this.hitFlashTimer > 0) {
            const flashAlpha = (this.hitFlashTimer / HIT_FLASH_DURATION) * 0.75;
            CTX.save();
            CTX.globalAlpha = flashAlpha;
            CTX.fillStyle   = '#ffffff';
            // Match the bob + rotation transform so the flash sits on the body
            CTX.translate(screen.x, screen.y + bobOffset);
            CTX.rotate(this.angle);
            CTX.beginPath();
            CTX.arc(0, 5, 15, 0, Math.PI * 2);
            CTX.fill();
            CTX.restore();
        }

        // ── HP bar ───────────────────────────────────────────
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