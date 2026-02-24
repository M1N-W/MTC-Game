# MTC Game — Godot Migration Guide

## Overview

This document maps every visual system in the current Vanilla JS Canvas implementation
to its equivalent Godot 4 node/scene structure. Use this as a reference when porting.

**Source config file:** `js/config.js` (MAP_CONFIG, BALANCE, VISUALS, GAME_CONFIG)
**Key principle:** All visual constants already live in `MAP_CONFIG` and `BALANCE.map.mapColors`
— in Godot these become exported `Resource` (.tres) files.

---

## Visual Layer Architecture

### Current JS Layer Order (back → front)
```
1. Background gradient       (game.js: drawBackground)
2. Terrain — Arena boundary  (map.js: drawTerrain → layer 1)
3. Terrain — Hex grid        (map.js: drawTerrain → layer 2)
4. Terrain — Circuit paths   (map.js: drawTerrain → layer 3)
5. Terrain — Zone auras      (map.js: drawTerrain → layer 4)
6. Map objects (desks, trees, etc.)  (map.js: draw)
7. Entities (enemies, player)        (entity classes)
8. Projectiles                       (weapons.js)
9. Particles & effects               (effects.js)
10. Lighting overlay                 (map.js: drawLighting)
11. UI / HUD                         (ui.js)
```

### Godot 4 Equivalent (CanvasLayer z-index)
```
Node2D (root)
├── CanvasLayer (z=0)  — Background
│   └── ColorRect or Gradient2D
├── CanvasLayer (z=1)  — Terrain
│   ├── ArenaBoundary (Node2D + _draw())
│   ├── HexGrid       (Node2D + _draw())
│   ├── CircuitPaths  (Node2D + _draw() + AnimationPlayer)
│   └── ZoneAuras     (Node2D + PointLight2D)
├── CanvasLayer (z=2)  — Map Objects
│   └── TileMap or individual PackedScene instances
├── CanvasLayer (z=3)  — Entities
│   ├── Player.tscn
│   ├── Enemy.tscn
│   └── Boss.tscn
├── CanvasLayer (z=4)  — Projectiles
│   └── Projectile.tscn (pooled)
├── CanvasLayer (z=5)  — Particles & VFX
│   └── GPUParticles2D (replaces Particle class pool)
├── CanvasLayer (z=6)  — Lighting
│   └── Light2D nodes (replaces offscreen canvas in drawLighting)
└── CanvasLayer (z=10) — HUD/UI
    └── Control nodes
```

---

## 1. Terrain System → Godot

### JS Source
`js/map.js: drawTerrain(ctx, camera)` with config from `MAP_CONFIG` in `js/config.js`

### Config Reference (MAP_CONFIG)
| Key | Description | Godot Equivalent |
|-----|-------------|------------------|
| `MAP_CONFIG.arena` | Concentric rings + animated dashes | `Node2D._draw()` with `draw_arc()` |
| `MAP_CONFIG.hex` | Flat-top hex grid with falloff | `TileMap` or procedural `_draw()` |
| `MAP_CONFIG.paths` | Animated PCB circuit lines + packets | `Line2D` + `AnimationPlayer` |
| `MAP_CONFIG.auras` | Radial gradient glow pools | `PointLight2D` or `GPUParticles2D` |

### Migration Steps
```gdscript
# ArenaBoundary.gd
extends Node2D
@export var config: ArenaConfig  # Resource (.tres) from MAP_CONFIG.arena
func _draw():
    var t = Time.get_ticks_msec() / 1000.0
    var alpha = config.halo_alpha_base + sin(t * 0.6) * 0.03
    draw_arc(Vector2.ZERO, config.radius, 0, TAU, 128, Color(0.47, 0.23, 1, alpha), 52)
```

---

## 2. Map Objects → Godot PackedScenes

### JS Source
`js/map.js: drawDesk/drawTree/drawServer/drawDataPillar/drawBookshelf`
Config: `MAP_CONFIG.objects` + `BALANCE.map.mapColors`

### Migration Map
| JS Function | Godot Scene | Godot Draw Method |
|-------------|-------------|-------------------|
| `drawDesk(w,h)` | `Desk.tscn` | `Node2D._draw()` or Sprite2D |
| `drawTree(size)` | `Tree.tscn` | `Node2D._draw()` with AnimationPlayer |
| `drawServer(w,h)` | `ServerRack.tscn` | `Node2D._draw()` + blinking timer |
| `drawDataPillar(w,h)` | `DataPillar.tscn` | `Node2D._draw()` + `PointLight2D` |
| `drawBookshelf(w,h)` | `Bookshelf.tscn` | `Node2D._draw()` |
| `drawBlackboard()` | `Blackboard.tscn` | `Node2D._draw()` or Sprite2D |
| `drawChair()` | Part of `Desk.tscn` | Simple `ColorRect` nodes |
| `drawCabinet()` | `Cabinet.tscn` | Simple `ColorRect` nodes |
| `ExplosiveBarrel` | `Barrel.tscn` | `Area2D` + `AnimatedSprite2D` |

### Color Resource Example
```gdscript
# MapObjectPalette.gd (Resource)
class_name MapObjectPalette
extends Resource

# Desk
@export var desk_screen_glow: Color = Color(1, 1, 0.86, 0.18)
@export var desk_monitor_body: Color = Color(0.12, 0.25, 0.69)
@export var desk_monitor_text: Color = Color(0.58, 0.77, 0.99)
@export var desk_note_paper:   Color = Color(0.98, 0.75, 0.14)
@export var desk_note_pen:     Color = Color(0.97, 0.44, 0.44)

# Server
@export var server_inner:      Color = Color(0.15, 0.20, 0.32)
@export var server_unit_slot:  Color = Color(0.11, 0.16, 0.24)
@export var server_data_led_on: Color = Color(0.23, 0.51, 0.96)
@export var server_data_led_off: Color = Color(0.11, 0.19, 0.33)
```

---

## 3. Lighting System → Godot Light2D

### JS Source
`js/map.js: drawLighting(player, projectiles, extraLights)`
Uses offscreen canvas composite blending.

### Migration Map
| JS Light Type | Godot Node |
|---------------|-----------|
| Player light (warm) | `PointLight2D` child of Player.tscn, orange tint |
| Projectile light (cool) | `PointLight2D` child of Projectile.tscn, cyan tint |
| DataPillar light (cool) | `PointLight2D` child of DataPillar.tscn |
| ServerRack light (cool) | `PointLight2D` child of ServerRack.tscn |
| Ambient darkness | `CanvasModulate` with dark color |

```gdscript
# In Player.gd
@onready var light = $PointLight2D
func _physics_process(delta):
    light.energy = 1.25 if is_dashing else 1.0
```

---

## 4. Particle System → GPUParticles2D

### JS Source
`js/effects.js: Particle, FloatingText, HitMarker, WeatherSystem`

### Object Pool → Godot
Godot's `GPUParticles2D` handles pooling natively — no manual pool needed.

| JS System | Godot Node |
|-----------|-----------|
| `ParticleSystem` (circles, steam, binary, afterimage) | `GPUParticles2D` with `ParticleProcessMaterial` |
| `FloatingTextSystem` | `Label` nodes with `Tween` (pooled via `ObjectPool` singleton) |
| `HitMarkerSystem` (normal + crit) | `GPUParticles2D` with cross texture |
| `WeatherSystem` (rain/snow) | `GPUParticles2D` full-screen emitter |

---

## 5. Entity Classes → Godot Scenes

### JS Source
`js/entities/base.js`, `js/entities/player/*.js`, `js/entities/enemy.js`, `js/entities/boss.js`

```
Entity (base.js)              →  CharacterBody2D (base scene)
├── PlayerBase.js             →  Player.tscn (extends base)
│   ├── KaoPlayer.js          →  Kao.tscn
│   ├── AutoPlayer.js         →  Auto.tscn
│   └── PoomPlayer.js         →  Poom.tscn
├── Enemy.js                  →  Enemy.tscn
├── Boss.js                   →  Boss.tscn
├── BossFirst.js              →  BossFirst.tscn
├── BossDog.js                →  BossDog.tscn
└── GoldfishMinion.js         →  GoldfishMinion.tscn
```

---

## 6. Game State → Godot Autoloads (Singletons)

### JS Source
`js/game.js` — `window.gameState`, `window.player`, `window.enemies`, etc.

```gdscript
# GameState.gd (Autoload)
extends Node
var game_state: String = "MENU"
var player: Player = null
var enemies: Array[Enemy] = []
var projectiles: Array[Projectile] = []
var score: int = 0
var wave: int = 1

# Input.gd (Autoload)
extends Node
var mouse_world: Vector2 = Vector2.ZERO
var keys: Dictionary = {}
```

---

## 7. Config System → Godot Resources

### JS Source
`js/config.js` — `BALANCE`, `MAP_CONFIG`, `GAME_CONFIG`, `VISUALS`

| JS Config Object | Godot Resource |
|-----------------|----------------|
| `BALANCE.characters.kao` | `KaoStats.tres` (extends `CharacterStats`) |
| `BALANCE.boss` | `BossStats.tres` |
| `BALANCE.map.mapColors` | `MapPalette.tres` |
| `MAP_CONFIG.objects` | `MapObjectPalette.tres` |
| `MAP_CONFIG.arena` | `ArenaConfig.tres` |
| `GAME_CONFIG` | `GameConfig.tres` |

```gdscript
# CharacterStats.gd (Resource)
class_name CharacterStats
extends Resource
@export var hp: float = 100
@export var move_speed: float = 300
@export var dash_speed: float = 550
```

---

## 8. Audio System → Godot AudioStreamPlayer

### JS Source
`js/audio.js` — BGM, SFX, voice bubbles

```
AudioManager.js (singleton)  →  AudioManager.gd (Autoload)
├── BGM tracks               →  AudioStreamPlayer (music bus)
├── SFX pool                 →  AudioStreamPlayer2D (sfx bus, pooled)
└── Voice/speech             →  AudioStreamPlayer (voice bus)
```

---

## 9. Skill/Cooldown System → Godot

### JS Source
`js/entities/boss.js` — `this.skills = { slam: {cd, max}, graph: {cd, max}, ... }`

```gdscript
# Skill.gd (Resource)
class_name Skill
extends Resource
@export var max_cooldown: float = 5.0
var current_cooldown: float = 0.0

func is_ready() -> bool:
    return current_cooldown <= 0.0

func tick(delta: float) -> void:
    current_cooldown = max(0.0, current_cooldown - delta)

func use() -> void:
    current_cooldown = max_cooldown
```

---

## Migration Priority Order

1. **Config Resources** — Convert `BALANCE` + `MAP_CONFIG` to `.tres` files
2. **Game State Autoload** — Replace `window.*` globals
3. **Base Entity** — Port `CharacterBody2D` base with HP/movement
4. **Player Characters** — Port Kao → Auto → Poom
5. **Enemy + Boss** — Port enemy AI state machines
6. **Terrain Rendering** — Port `drawTerrain` to `_draw()` methods
7. **Map Objects** — Port each `draw*` function to PackedScene
8. **Particle VFX** — Replace Object Pool with GPUParticles2D
9. **Lighting** — Replace offscreen canvas with Light2D
10. **UI/HUD** — Port `ui.js` to Control nodes
11. **Audio** — Port `audio.js` to AudioManager autoload
12. **AI Integration** — Port Gemini API calls via HTTPRequest node
