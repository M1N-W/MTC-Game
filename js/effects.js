/**
 * 💥 MTC: ENHANCED EDITION - Effects System
 * Particles, floating text, and special effects
 */

// Particle System
class Particle {
    constructor(x, y, vx, vy, color, size, lifetime) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = lifetime;
        this.maxLife = lifetime;
    }
    
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // Apply friction
        this.vx *= 0.95;
        this.vy *= 0.95;
        
        this.life -= dt;
        return this.life <= 0;
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        const alpha = this.life / this.maxLife;
        
        CTX.globalAlpha = alpha;
        CTX.fillStyle = this.color;
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, this.size * alpha, 0, Math.PI * 2);
        CTX.fill();
        CTX.globalAlpha = 1;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }
    
    spawn(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = rand(100, 400);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = rand(2, 5);
            const lifetime = rand(0.3, 0.8);
            
            this.particles.push(new Particle(x, y, vx, vy, color, size, lifetime));
        }
    }
    
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (this.particles[i].update(dt)) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    draw() {
        for (let particle of this.particles) {
            particle.draw();
        }
    }
    
    clear() {
        this.particles = [];
    }
}

// Floating Text System
class FloatingText {
    constructor(text, x, y, color, size = 20) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.life = 1.5;
        this.vy = -80;
    }
    
    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
        return this.life <= 0;
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        const alpha = Math.min(1, this.life);
        
        CTX.globalAlpha = alpha;
        CTX.fillStyle = this.color;
        CTX.font = `bold ${this.size}px Orbitron, monospace`;
        CTX.strokeStyle = 'black';
        CTX.lineWidth = 3;
        CTX.textAlign = 'center';
        CTX.strokeText(this.text, screen.x, screen.y);
        CTX.fillText(this.text, screen.x, screen.y);
        CTX.globalAlpha = 1;
    }
}

class FloatingTextSystem {
    constructor() {
        this.texts = [];
    }
    
    spawn(text, x, y, color, size = 20) {
        this.texts.push(new FloatingText(text, x, y, color, size));
    }
    
    update(dt) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            if (this.texts[i].update(dt)) {
                this.texts.splice(i, 1);
            }
        }
    }
    
    draw() {
        for (let text of this.texts) {
            text.draw();
        }
    }
    
    clear() {
        this.texts = [];
    }
}

// Special Effects for Boss

// Equation Slam Effect
class EquationSlam {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 50;
        this.maxRadius = BALANCE.boss.slamRadius;
        this.speed = 400;
        this.damage = BALANCE.boss.slamDamage;
        this.hit = false;
        this.equation = "ax² + bx + c = 0";
    }
    
    update(dt, player) {
        this.radius += this.speed * dt;
        
        // Check player collision
        if (!this.hit) {
            const d = dist(this.x, this.y, player.x, player.y);
            if (d <= this.radius && d >= this.radius - 30) {
                player.takeDamage(this.damage);
                this.hit = true;
            }
        }
        
        return this.radius >= this.maxRadius;
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        
        CTX.save();
        CTX.translate(screen.x, screen.y);
        
        const alpha = 1 - (this.radius / this.maxRadius);
        CTX.globalAlpha = alpha;
        
        // Ring
        CTX.strokeStyle = '#facc15';
        CTX.lineWidth = 8;
        CTX.beginPath();
        CTX.arc(0, 0, this.radius, 0, Math.PI * 2);
        CTX.stroke();
        
        // Equation text around the ring
        CTX.fillStyle = '#fff';
        CTX.font = 'bold 20px monospace';
        CTX.textAlign = 'center';
        
        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 / 4) * i;
            const tx = Math.cos(angle) * this.radius;
            const ty = Math.sin(angle) * this.radius;
            CTX.fillText(this.equation, tx, ty);
        }
        
        CTX.restore();
    }
}

// Deadly Graph Effect
class DeadlyGraph {
    constructor(startX, startY, targetX, targetY, duration = null) {
        this.startX = startX;
        this.startY = startY;
        this.angle = Math.atan2(targetY - startY, targetX - startX);
        this.length = 0;
        this.maxLength = BALANCE.boss.graphLength;
        this.speed = 600;
        this.damage = BALANCE.boss.graphDamage;
        this.phase = 'expanding'; // expanding, blocking, active
        this.timer = 0;
        this.hasHit = false;
        
        // ⭐ ใช้ duration จาก config หรือค่า default 10 วินาที
        this.blockingDuration = duration !== null ? duration / 2 : 5;  // ครึ่งหนึ่งสำหรับ blocking
        this.activeDuration = duration !== null ? duration / 2 : 5;    // อีกครึ่งสำหรับ active
    }
    
    update(dt, player) {
        this.timer += dt;
        
        if (this.phase === 'expanding') {
            this.length += this.speed * dt;
            
            // Check collision
            const pd = this.pointToLineDistance(
                player.x, player.y,
                this.startX, this.startY,
                this.startX + Math.cos(this.angle) * this.length,
                this.startY + Math.sin(this.angle) * this.length
            );
            
            if (!this.hasHit && pd < 20) {
                player.takeDamage(this.damage);
                this.hasHit = true;
            }
            
            if (this.length >= this.maxLength) {
                this.phase = 'blocking';
                this.timer = 0;
            }
        } else if (this.phase === 'blocking') {
            // ⭐ ใช้ค่า blockingDuration จาก config
            if (this.timer >= this.blockingDuration) {
                this.phase = 'active';
                this.timer = 0;
            }
        } else if (this.phase === 'active') {
            // High ground mechanic
            const pd = this.pointToLineDistance(
                player.x, player.y,
                this.startX, this.startY,
                this.startX + Math.cos(this.angle) * this.length,
                this.startY + Math.sin(this.angle) * this.length
            );
            
            player.onGraph = (pd < 25);
            
            // ⭐ ใช้ค่า activeDuration จาก config
            if (this.timer >= this.activeDuration) {
                player.onGraph = false;
                return true; // Remove
            }
        }
        
        return false;
    }
    
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = x1; yy = y1;
        } else if (param > 1) {
            xx = x2; yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        return Math.hypot(px - xx, py - yy);
    }
    
    draw() {
        const startScreen = worldToScreen(this.startX, this.startY);
        const endX = this.startX + Math.cos(this.angle) * this.length;
        const endY = this.startY + Math.sin(this.angle) * this.length;
        const endScreen = worldToScreen(endX, endY);
        
        CTX.save();
        
        if (this.phase === 'expanding') {
            CTX.strokeStyle = '#3b82f6';
            CTX.lineWidth = 8;
            CTX.shadowBlur = 20;
            CTX.shadowColor = '#3b82f6';
        } else if (this.phase === 'blocking') {
            CTX.strokeStyle = 'rgba(59, 130, 246, 0.2)';
            CTX.lineWidth = 4;
            CTX.setLineDash([10, 10]);
        } else {
            CTX.strokeStyle = '#1d4ed8';
            CTX.lineWidth = 12;
        }
        
        CTX.beginPath();
        CTX.moveTo(startScreen.x, startScreen.y);
        CTX.lineTo(endScreen.x, endScreen.y);
        CTX.stroke();
        
        if (this.phase === 'expanding' || this.phase === 'active') {
            CTX.fillStyle = '#fff';
            CTX.font = 'bold 24px monospace';
            CTX.textAlign = 'center';
            CTX.fillText('y = x', endScreen.x, endScreen.y - 20);
        }
        
        CTX.restore();
    }
}

// Meteor Strike Effect
class MeteorStrike {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.phase = 'warning'; // warning, impact, done
        this.timer = 0;
        this.warningDuration = 1.5;
        this.radius = 60;
    }
    
    update(dt, player, meteorZones) {
        this.timer += dt;
        
        if (this.phase === 'warning') {
            if (this.timer >= this.warningDuration) {
                this.phase = 'impact';
                this.timer = 0;
                
                // Screen shake
                addScreenShake(10);
                
                // Particles
                particleSystem.spawn(this.x, this.y, 30, '#f59e0b');
                
                // Damage on impact
                const d = dist(this.x, this.y, player.x, player.y);
                if (d < this.radius) {
                    player.takeDamage(BALANCE.mage.meteorDamage);
                }
                
                // Create lava zone
                meteorZones.push({
                    x: this.x,
                    y: this.y,
                    radius: this.radius,
                    damage: BALANCE.mage.meteorBurnDPS,
                    life: BALANCE.mage.meteorBurnDuration
                });
            }
        } else if (this.phase === 'impact') {
            return true; // Remove
        }
        
        return false;
    }
    
    draw() {
        if (this.phase === 'warning') {
            const screen = worldToScreen(this.x, this.y);
            const pulse = Math.sin(this.timer * 10) * 0.3 + 0.7;
            
            // Warning circle
            CTX.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
            CTX.lineWidth = 4;
            CTX.setLineDash([10, 5]);
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, this.radius, 0, Math.PI * 2);
            CTX.stroke();
            CTX.setLineDash([]);
            
            // Falling meteor
            const progress = this.timer / this.warningDuration;
            const meteorY = this.y - 300 + progress * 300;
            const meteorScreen = worldToScreen(this.x, meteorY);
            
            CTX.fillStyle = '#f97316';
            CTX.shadowBlur = 15;
            CTX.shadowColor = '#f97316';
            CTX.beginPath();
            CTX.arc(meteorScreen.x, meteorScreen.y, 15, 0, Math.PI * 2);
            CTX.fill();
            CTX.shadowBlur = 0;
        }
    }
}

// Create singleton instances
const particleSystem = new ParticleSystem();
const floatingTextSystem = new FloatingTextSystem();

// Helper functions for global use
function spawnParticles(x, y, count, color) {
    particleSystem.spawn(x, y, count, color);
}

function spawnFloatingText(text, x, y, color, size = 20) {
    floatingTextSystem.spawn(text, x, y, color, size);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Particle, ParticleSystem, particleSystem,
        FloatingText, FloatingTextSystem, floatingTextSystem,
        EquationSlam, DeadlyGraph, MeteorStrike,
        spawnParticles, spawnFloatingText
    };
}
