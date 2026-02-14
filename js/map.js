/**
 * 🏫 MTC: ENHANCED EDITION - School Map System
 * Classroom objects with collision
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
    
    // Check collision with circle (player/enemy)
    checkCollision(cx, cy, radius) {
        if (!this.solid) return false;
        return circleRectCollision(cx, cy, radius, this.x, this.y, this.w, this.h);
    }
    
    // Push entity out of object
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
                // Entity center is inside object
                entity.x += overlap;
            }
            
            // Reduce velocity
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
            case 'decoration':
                this.drawDecoration();
                break;
        }
        
        CTX.restore();
    }
    
    drawDesk() {
        // Desk body (purple - school theme)
        CTX.fillStyle = '#7c3aed';
        CTX.fillRect(0, 0, this.w, this.h);
        
        // Desk top (lighter purple)
        CTX.fillStyle = '#8b5cf6';
        CTX.fillRect(3, 3, this.w - 6, this.h - 6);
        
        // Book
        CTX.fillStyle = '#1e293b';
        CTX.fillRect(8, 8, this.w * 0.4, this.h * 0.5);
        
        // Pen
        CTX.strokeStyle = '#3b82f6';
        CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(this.w - 10, 12);
        CTX.lineTo(this.w - 10, 25);
        CTX.stroke();
    }
    
    drawChair() {
        // Chair back
        CTX.fillStyle = '#475569';
        CTX.fillRect(5, 0, this.w - 10, this.h - 15);
        
        // Chair seat
        CTX.fillStyle = '#64748b';
        CTX.fillRect(0, this.h - 15, this.w, 15);
        
        // Legs (simple)
        CTX.fillStyle = '#334155';
        CTX.fillRect(3, this.h - 12, 4, 12);
        CTX.fillRect(this.w - 7, this.h - 12, 4, 12);
    }
    
    drawBlackboard() {
        // Board background
        CTX.fillStyle = '#1e293b';
        CTX.fillRect(0, 0, this.w, this.h);
        
        // Frame
        CTX.strokeStyle = '#94a3b8';
        CTX.lineWidth = 4;
        CTX.strokeRect(4, 4, this.w - 8, this.h - 8);
        
        // Equation
        CTX.fillStyle = '#fff';
        CTX.font = 'bold 18px monospace';
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        CTX.fillText('ax² + bx + c = 0', this.w / 2, this.h / 2);
        
        // Additional formulas
        CTX.font = 'bold 12px monospace';
        CTX.fillText('∫f(x)dx', this.w / 4, this.h - 15);
        CTX.fillText('lim x→∞', 3 * this.w / 4, this.h - 15);
    }
    
    drawCabinet() {
        // Cabinet body (wood)
        CTX.fillStyle = '#92400e';
        CTX.fillRect(0, 0, this.w, this.h);
        
        // Left door
        CTX.fillStyle = '#78350f';
        CTX.fillRect(4, 4, this.w / 2 - 8, this.h - 8);
        
        // Right door
        CTX.fillRect(this.w / 2 + 4, 4, this.w / 2 - 8, this.h - 8);
        
        // Door handles
        CTX.fillStyle = '#fbbf24';
        CTX.beginPath();
        CTX.arc(this.w / 4, this.h / 2, 4, 0, Math.PI * 2);
        CTX.fill();
        CTX.beginPath();
        CTX.arc(3 * this.w / 4, this.h / 2, 4, 0, Math.PI * 2);
        CTX.fill();
        
        // Wood grain
        CTX.strokeStyle = '#57534e';
        CTX.lineWidth = 1;
        for (let i = 10; i < this.h; i += 8) {
            CTX.beginPath();
            CTX.moveTo(6, i);
            CTX.lineTo(this.w / 2 - 6, i);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(this.w / 2 + 6, i);
            CTX.lineTo(this.w - 6, i);
            CTX.stroke();
        }
    }
    
    drawWall() {
        // Wall (light brick)
        CTX.fillStyle = '#f5f5f4';
        CTX.fillRect(0, 0, this.w, this.h);
        
        // Brick pattern
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
    
    drawDecoration() {
        // Simple decoration (could be posters, etc.)
        CTX.fillStyle = '#fbbf24';
        CTX.beginPath();
        CTX.arc(this.w / 2, this.h / 2, Math.min(this.w, this.h) / 2 - 2, 0, Math.PI * 2);
        CTX.fill();
    }
}

class MapSystem {
    constructor() {
        this.objects = [];
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;
        
        this.objects = [];
        this.generateSchoolMap();
        this.initialized = true;
        
        console.log(`✅ Map initialized with ${this.objects.length} objects`);
    }
    
    generateSchoolMap() {
        const mapSize = BALANCE.map.size;
        const density = BALANCE.map.objectDensity;
        
        // Object sizes
        const sizes = {
            desk: { w: 60, h: 40 },
            chair: { w: 30, h: 30 },
            cabinet: { w: 50, h: 60 },
            blackboard: { w: 150, h: 80 }
        };
        
        // Generate random objects
        const spacing = 300;
        for (let y = -mapSize / 2; y <= mapSize / 2; y += spacing) {
            for (let x = -mapSize / 2; x <= mapSize / 2; x += spacing) {
                // Don't spawn near center (player start)
                if (Math.abs(x) < 150 && Math.abs(y) < 150) continue;
                
                if (Math.random() < density) {
                    const type = randomChoice(BALANCE.map.objectTypes);
                    const size = sizes[type];
                    
                    // Add some randomness to position
                    const rx = x + rand(-50, 50);
                    const ry = y + rand(-50, 50);
                    
                    this.objects.push(new MapObject(rx, ry, size.w, size.h, type));
                }
            }
        }
        
        // Add walls at map edges
        for (let wall of BALANCE.map.wallPositions) {
            this.objects.push(new MapObject(wall.x, wall.y, wall.w, wall.h, 'wall'));
        }
        
        // Add central blackboard (always visible)
        this.objects.push(new MapObject(-75, -600, 150, 80, 'blackboard'));
    }
    
    update(entities) {
        // Check collisions with all entities
        for (let entity of entities) {
            if (entity.dead) continue;
            
            for (let obj of this.objects) {
                obj.resolveCollision(entity);
            }
        }
    }
    
    draw() {
        // Sort objects by Y position for proper layering
        const sorted = [...this.objects].sort((a, b) => a.y - b.y);
        
        for (let obj of sorted) {
            // Only draw if visible on screen
            const screen = worldToScreen(obj.x, obj.y);
            if (screen.x + obj.w < -100 || screen.x > CANVAS.width + 100) continue;
            if (screen.y + obj.h < -100 || screen.y > CANVAS.height + 100) continue;
            
            obj.draw();
        }
    }
    
    clear() {
        this.objects = [];
        this.initialized = false;
    }
    
    getObjects() {
        return this.objects;
    }
    
    // Check if a position is blocked
    isBlocked(x, y, radius = 0) {
        for (let obj of this.objects) {
            if (obj.checkCollision(x, y, radius)) {
                return true;
            }
        }
        return false;
    }
    
    // Find safe spawn position
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
        
        // Fallback
        return { x: preferredX, y: preferredY };
    }
}

// Create singleton instance
const mapSystem = new MapSystem();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MapObject,
        MapSystem,
        mapSystem
    };
}
