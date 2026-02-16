/**
 * 🏫 MTC: ENHANCED EDITION - School Map System (UPGRADED)
 * Cleaner map with MTC Room Safe Zone
 * 
 * NEW FEATURES:
 * - Reduced object density (0.3 → 0.15)
 * - MTC Room: Safe Zone with healing
 * - Better map aesthetics
 * - Improved collision system
 */

class MapObject {
    constructor(x, y, w, h, type) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.type = type;
        this.solid = type !== 'decoration';
    }
    
    checkCollision(cx, cy, radius) {
        if (!this.solid) return false;
        return circleRectCollision(cx, cy, radius, this.x, this.y, this.w, this.h);
    }
    
    resolveCollision(entity) {
        if (!this.solid) return;
        
        const closestX = clamp(entity.x, this.x, this.x + this.w);
        const closestY = clamp(entity.y, this.y, this.y + this.h);
        
        const dx = entity.x - closestX;
        const dy = entity.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < entity.radius) {
            const overlap = entity.radius - distance;
            if (distance > 0) {
                entity.x += (dx / distance) * overlap;
                entity.y += (dy / distance) * overlap;
            } else {
                entity.x += overlap;
            }
            
            entity.vx *= 0.5;
            entity.vy *= 0.5;
        }
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        
        CTX.save();
        CTX.translate(screen.x, screen.y);
        
        switch (this.type) {
            case 'desk':
                this.drawDesk();
                break;
            case 'chair':
                this.drawChair();
                break;
            case 'blackboard':
                this.drawBlackboard();
                break;
            case 'cabinet':
                this.drawCabinet();
                break;
            case 'wall':
                this.drawWall();
                break;
        }
        
        CTX.restore();
    }
    
    drawDesk() {
        CTX.fillStyle = '#7c3aed';
        CTX.fillRect(0, 0, this.w, this.h);
        CTX.fillStyle = '#8b5cf6';
        CTX.fillRect(3, 3, this.w - 6, this.h - 6);
        CTX.fillStyle = '#1e293b';
        CTX.fillRect(8, 8, this.w * 0.4, this.h * 0.5);
        CTX.strokeStyle = '#3b82f6';
        CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(this.w - 10, 12);
        CTX.lineTo(this.w - 10, 25);
        CTX.stroke();
    }
    
    drawChair() {
        CTX.fillStyle = '#475569';
        CTX.fillRect(5, 0, this.w - 10, this.h - 15);
        CTX.fillStyle = '#64748b';
        CTX.fillRect(0, this.h - 15, this.w, 15);
        CTX.fillStyle = '#334155';
        CTX.fillRect(3, this.h - 12, 4, 12);
        CTX.fillRect(this.w - 7, this.h - 12, 4, 12);
    }
    
    drawBlackboard() {
        CTX.fillStyle = '#1e293b';
        CTX.fillRect(0, 0, this.w, this.h);
        CTX.strokeStyle = '#94a3b8';
        CTX.lineWidth = 4;
        CTX.strokeRect(4, 4, this.w - 8, this.h - 8);
        CTX.fillStyle = '#fff';
        CTX.font = 'bold 18px monospace';
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        CTX.fillText('ax² + bx + c = 0', this.w / 2, this.h / 2);
        CTX.font = 'bold 12px monospace';
        CTX.fillText('∫f(x)dx', this.w / 4, this.h - 15);
        CTX.fillText('lim x→∞', 3 * this.w / 4, this.h - 15);
    }
    
    drawCabinet() {
        CTX.fillStyle = '#92400e';
        CTX.fillRect(0, 0, this.w, this.h);
        CTX.fillStyle = '#78350f';
        CTX.fillRect(4, 4, this.w / 2 - 8, this.h - 8);
        CTX.fillRect(this.w / 2 + 4, 4, this.w / 2 - 8, this.h - 8);
        CTX.fillStyle = '#fbbf24';
        CTX.beginPath();
        CTX.arc(this.w / 4, this.h / 2, 4, 0, Math.PI * 2);
        CTX.fill();
        CTX.beginPath();
        CTX.arc(3 * this.w / 4, this.h / 2, 4, 0, Math.PI * 2);
        CTX.fill();
    }
    
    drawWall() {
        CTX.fillStyle = '#f5f5f4';
        CTX.fillRect(0, 0, this.w, this.h);
        CTX.strokeStyle = '#d6d3d1';
        CTX.lineWidth = 2;
        
        const brickW = 50;
        const brickH = 25;
        
        for (let y = 0; y < this.h; y += brickH) {
            for (let x = 0; x < this.w; x += brickW) {
                const offset = (Math.floor(y / brickH) % 2) * (brickW / 2);
                CTX.strokeRect(x + offset, y, brickW, brickH);
            }
        }
    }
}

// NEW: MTC Room (Safe Zone)
class MTCRoom {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 200;
        this.h = 200;
        this.healRate = 40; // HP per second
        this.maxStayTime = 4; // seconds
        this.playerStayTime = 0;
        this.cooldownTime = 10; // seconds before can use again
        this.cooldown = 0;
        this.isPlayerInside = false;
    }
    
    update(dt, player) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        
        const inside = this.checkPlayerInside(player.x, player.y);
        
        if (inside && this.cooldown <= 0) {
            if (!this.isPlayerInside) {
                this.isPlayerInside = true;
                this.playerStayTime = 0;
                spawnFloatingText('SAFE ZONE!', player.x, player.y - 60, '#10b981', 25);
                showVoiceBubble("เข้าสู่ MTC Room - กำลังรักษา...", player.x, player.y - 40);
            }
            
            this.playerStayTime += dt;
            
            // Heal player
            if (player.hp < player.maxHp) {
                const healAmount = this.healRate * dt;
                player.hp = Math.min(player.maxHp, player.hp + healAmount);
                
                if (Math.random() < 0.3) {
                    spawnParticles(player.x + rand(-20, 20), player.y + rand(-20, 20), 1, '#10b981');
                }
            }
            
            // Restore energy
            if (player.energy < player.maxEnergy) {
                player.energy = Math.min(player.maxEnergy, player.energy + 30 * dt);
            }
            
            // Kick out after max time
            if (this.playerStayTime >= this.maxStayTime) {
                this.kickOut(player);
            }
        } else {
            if (this.isPlayerInside) {
                this.isPlayerInside = false;
            }
        }
    }
    
    checkPlayerInside(px, py) {
        return px >= this.x && px <= this.x + this.w &&
               py >= this.y && py <= this.y + this.h;
    }
    
    kickOut(player) {
        this.isPlayerInside = false;
        this.cooldown = this.cooldownTime;
        spawnFloatingText('เวลาหมด!', player.x, player.y - 60, '#f59e0b', 20);
        showVoiceBubble("ออกจาก MTC Room แล้ว", player.x, player.y - 40);
        
        // Push player out gently
        const centerX = this.x + this.w / 2;
        const centerY = this.y + this.h / 2;
        const angle = Math.atan2(player.y - centerY, player.x - centerX);
        player.vx = Math.cos(angle) * 200;
        player.vy = Math.sin(angle) * 200;
    }
    
    draw() {
        const screen = worldToScreen(this.x, this.y);
        
        CTX.save();
        
        // Room background
        const gradient = CTX.createRadialGradient(
            screen.x + this.w / 2, screen.y + this.h / 2, 0,
            screen.x + this.w / 2, screen.y + this.h / 2, this.w / 2
        );
        
        if (this.cooldown > 0) {
            gradient.addColorStop(0, 'rgba(100, 116, 139, 0.3)');
            gradient.addColorStop(1, 'rgba(71, 85, 105, 0.1)');
        } else {
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
            gradient.addColorStop(1, 'rgba(5, 150, 105, 0.1)');
        }
        
        CTX.fillStyle = gradient;
        CTX.fillRect(screen.x, screen.y, this.w, this.h);
        
        // Border
        if (this.cooldown > 0) {
            CTX.strokeStyle = '#64748b';
            CTX.setLineDash([10, 5]);
        } else {
            CTX.strokeStyle = '#10b981';
            CTX.setLineDash([]);
        }
        
        CTX.lineWidth = 4;
        CTX.strokeRect(screen.x, screen.y, this.w, this.h);
        CTX.setLineDash([]);
        
        // MTC Sign
        CTX.fillStyle = '#fff';
        CTX.font = 'bold 32px Orbitron, monospace';
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        
        if (this.cooldown > 0) {
            CTX.fillStyle = '#64748b';
            CTX.fillText('MTC ROOM', screen.x + this.w / 2, screen.y + this.h / 2 - 20);
            CTX.font = 'bold 16px Arial';
            CTX.fillText(`COOLDOWN: ${Math.ceil(this.cooldown)}s`, screen.x + this.w / 2, screen.y + this.h / 2 + 20);
        } else {
            const pulse = Math.sin(performance.now() / 300) * 0.3 + 0.7;
            CTX.globalAlpha = pulse;
            CTX.fillStyle = '#10b981';
            CTX.shadowBlur = 20;
            CTX.shadowColor = '#10b981';
            CTX.fillText('MTC ROOM', screen.x + this.w / 2, screen.y + this.h / 2 - 20);
            
            CTX.shadowBlur = 0;
            CTX.globalAlpha = 1;
            CTX.font = 'bold 14px Arial';
            CTX.fillText('SAFE ZONE - เข้ามารักษาตัว', screen.x + this.w / 2, screen.y + this.h / 2 + 20);
            CTX.fillText('(4 วินาที)', screen.x + this.w / 2, screen.y + this.h / 2 + 40);
        }
        
        // Show timer when player is inside
        if (this.isPlayerInside) {
            const timeLeft = this.maxStayTime - this.playerStayTime;
            CTX.fillStyle = '#fbbf24';
            CTX.font = 'bold 24px Arial';
            CTX.fillText(`⏱️ ${timeLeft.toFixed(1)}s`, screen.x + this.w / 2, screen.y + this.h / 2 + 70);
        }
        
        CTX.restore();
    }
}

class MapSystem {
    constructor() {
        this.objects = [];
        this.mtcRoom = null;
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        
        this.objects = [];
        this.generateCleanerMap();
        
        // Create MTC Room at center-left
        this.mtcRoom = new MTCRoom(-400, -100);
        
        this.initialized = true;
        
        console.log(`✅ Map initialized with ${this.objects.length} objects + MTC Room`);
    }
    
    generateCleanerMap() {
        const mapSize = BALANCE.map.size;
        const density = 0.15; // REDUCED from 0.3
        
        const sizes = {
            desk: { w: 60, h: 40 },
            chair: { w: 30, h: 30 },
            cabinet: { w: 50, h: 60 },
            blackboard: { w: 150, h: 80 }
        };
        
        // Generate with larger spacing
        const spacing = 400; // INCREASED from 300
        for (let y = -mapSize / 2; y <= mapSize / 2; y += spacing) {
            for (let x = -mapSize / 2; x <= mapSize / 2; x += spacing) {
                // Don't spawn near center
                if (Math.abs(x) < 200 && Math.abs(y) < 200) continue;
                
                // Don't spawn near MTC Room
                if (Math.abs(x + 400) < 250 && Math.abs(y + 100) < 250) continue;
                
                if (Math.random() < density) {
                    // Only spawn desks and cabinets (remove chairs)
                    const type = randomChoice(['desk', 'cabinet', 'blackboard']);
                    const size = sizes[type];
                    
                    const rx = x + rand(-80, 80);
                    const ry = y + rand(-80, 80);
                    
                    this.objects.push(new MapObject(rx, ry, size.w, size.h, type));
                }
            }
        }
        
        // Add walls at map edges
        for (let wall of BALANCE.map.wallPositions) {
            this.objects.push(new MapObject(wall.x, wall.y, wall.w, wall.h, 'wall'));
        }
        
        // Add central blackboard
        this.objects.push(new MapObject(-75, -600, 150, 80, 'blackboard'));
    }
    
    update(entities) {
        // Check collisions
        for (let entity of entities) {
            if (entity.dead) continue;
            
            for (let obj of this.objects) {
                obj.resolveCollision(entity);
            }
        }
        
        // Update MTC Room
        if (this.mtcRoom && window.player) {
            this.mtcRoom.update(getDeltaTime(performance.now()), window.player);
        }
    }
    
    draw() {
        const sorted = [...this.objects].sort((a, b) => a.y - b.y);
        
        for (let obj of sorted) {
            const screen = worldToScreen(obj.x, obj.y);
            if (screen.x + obj.w < -100 || screen.x > CANVAS.width + 100) continue;
            if (screen.y + obj.h < -100 || screen.y > CANVAS.height + 100) continue;
            
            obj.draw();
        }
        
        // Draw MTC Room
        if (this.mtcRoom) {
            this.mtcRoom.draw();
        }
    }
    
    clear() {
        this.objects = [];
        this.mtcRoom = null;
        this.initialized = false;
    }
    
    getObjects() {
        return this.objects;
    }
    
    isBlocked(x, y, radius = 0) {
        for (let obj of this.objects) {
            if (obj.checkCollision(x, y, radius)) {
                return true;
            }
        }
        return false;
    }
    
    findSafeSpawn(preferredX, preferredY, radius) {
        const maxAttempts = 50;
        
        for (let i = 0; i < maxAttempts; i++) {
            const angle = (Math.PI * 2 / maxAttempts) * i;
            const distance = 100 + i * 50;
            const x = preferredX + Math.cos(angle) * distance;
            const y = preferredY + Math.sin(angle) * distance;
            
            if (!this.isBlocked(x, y, radius)) {
                return { x, y };
            }
        }
        
        return { x: preferredX, y: preferredY };
    }
}

const mapSystem = new MapSystem();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MapObject,
        MTCRoom,
        MapSystem,
        mapSystem
    };
}
