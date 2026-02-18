/**
 * js/entities/enemy.js
 *
 * ► Enemy      — Basic grunt
 * ► TankEnemy  — Heavy melee bruiser
 * ► MageEnemy  — Ranged caster (confusion + meteor)
 * ► PowerUp    — Loot drop (collected by player)
 *
 * Depends on: base.js (Entity)
 */

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
