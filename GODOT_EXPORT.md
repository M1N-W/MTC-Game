# MTC Game — Godot Migration Guide

## Overview

This document maps every visual system in the current Vanilla JS Canvas implementation
to its equivalent Godot 4 node/scene structure. Use this as a reference when porting.

**Source config file:** `js/config.js` (MAP_CONFIG, BALANCE, VISUALS, GAME_CONFIG)
**Key principle:** All visual constants already live in `MAP_CONFIG` and `BALANCE.map.mapColors`
— in Godot these become exported `Resource` (.tres) files.

**Last updated:** After JS Refactor Phase 1–4 (Rendering Decoupling + Performance Optimization)
- Step 1–3: Entity logic/render separation → `*Renderer` classes in `js/rendering/`
- Step 4a: `effects.js` v12 — Swap-and-pop O(1) + OrbitalParticle Object Pool
- Step 4b: `weapons.js` v2 — SpatialGrid O(P×k) + Swap-and-pop in ProjectileManager

---

## Visual Layer Architecture

### Current JS Layer Order (back → front)
```
1. Background gradient           (game.js: drawBackground)
2. Terrain — Arena boundary      (map.js: drawTerrain → layer 1)
3. Terrain — Hex grid            (map.js: drawTerrain → layer 2)
4. Terrain — Circuit paths       (map.js: drawTerrain → layer 3)
5. Terrain — Zone auras          (map.js: drawTerrain → layer 4)
6. Map objects (desks, trees…)   (map.js: draw)
7. Entities (enemies, player)    (js/rendering/*Renderer.js)  ← was entity classes
8. Projectiles                   (js/rendering/ProjectileRenderer.js)
9. Particles & effects           (effects.js)
10. Lighting overlay             (map.js: drawLighting)
11. UI / HUD                     (ui.js)
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
│   ├── Player.tscn   (CharacterBody2D — logic + visual in one scene)
│   ├── Enemy.tscn
│   └── Boss.tscn
├── CanvasLayer (z=4)  — Projectiles
│   └── Projectile.tscn (Area2D — no ProjectileManager needed)
├── CanvasLayer (z=5)  — Particles & VFX
│   └── GPUParticles2D (replaces all JS Object Pool systems)
├── CanvasLayer (z=6)  — Lighting
│   └── Light2D nodes (replaces offscreen canvas in drawLighting)
└── CanvasLayer (z=10) — HUD/UI
    └── Control nodes
```

---

## 0. JS Renderer Classes → Godot  *(NEW — added after refactor)*

During JS refactoring, all `draw()` methods were extracted from Entity classes
into dedicated Renderer classes in `js/rendering/`. In Godot this separation
is **not needed** — each scene owns its own visual nodes directly.

| JS Renderer | What it did | Godot equivalent |
|---|---|---|
| `PlayerRenderer._drawBase/Kao/Auto/Poom` | Drew player body, weapon, effects | `Node2D._draw()` inside `Player.tscn` (or `Sprite2D` + `AnimationPlayer`) |
| `EnemyRenderer` | Drew enemy sprites + health bars | `Node2D._draw()` inside `Enemy.tscn` |
| `BossRenderer` | Drew boss + phase effects | `Node2D._draw()` inside `Boss.tscn` |
| `ProjectileRenderer` | Drew all projectile types | `AnimatedSprite2D` or `Node2D._draw()` inside `Projectile.tscn` |

**Key insight:** The JS `*Renderer` pattern was a workaround for Canvas2D's global
state. In Godot each `tscn` scene encapsulates its own rendering — no separate
Renderer class is needed.

---

## 0b. Systems Eliminated by Godot  *(NEW — added after refactor)*

These JS systems exist purely because of Browser/Canvas limitations.
They have **no direct port** — Godot replaces them with built-in features.

| JS System | Why it existed | Godot replacement |
|---|---|---|
| `ProjectileManager` | Manual projectile list + collision loop | `Area2D.area_entered` / `body_entered` signals |
| `SpatialGrid` (weapons.js v2) | O(P×E) brute-force was too slow | Godot Physics Broadphase (built-in, automatic) |
| `Particle` Object Pool | `new Particle()` caused GC pauses | `GPUParticles2D` pools GPU-side natively |
| `FloatingText` Object Pool | Same GC reason | `Label` + `Tween` via `ObjectPool.gd` singleton |
| `HitMarker` Object Pool | Same GC reason | `GPUParticles2D` or simple `Tween` |
| `OrbitalParticle` Object Pool | Same GC reason | `GPUParticles2D` emission shape = ring |
| `InputSystem` (keys/mouse) | Browser event → game state bridge | `Input` singleton built-in |
| `circleCollision()` helper | Manual circle overlap math | `CollisionShape2D` + physics signals |
| `worldToScreen()` / camera math | Manual viewport transform | `Camera2D` node handles this automatically |

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
@export var server_inner:       Color = Color(0.15, 0.20, 0.32)
@export var server_unit_slot:   Color = Color(0.11, 0.16, 0.24)
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
`js/effects.js` v12: `Particle`, `FloatingText`, `HitMarker`, `WeatherSystem`, `OrbitalParticleSystem`

All systems use Object Pool + Swap-and-pop in JS (v12 optimization).
In Godot **none of this manual pooling is needed** — `GPUParticles2D` handles it GPU-side.

| JS System | JS Pool size | Godot Node |
|-----------|-------------|-----------|
| `ParticleSystem` (circle/steam/binary/afterimage) | MAX 300 | `GPUParticles2D` with `ParticleProcessMaterial` |
| `FloatingTextSystem` | MAX 80 | `Label` + `Tween` (pooled via `ObjectPool.gd` singleton) |
| `HitMarkerSystem` (normal + crit) | MAX 80 | `GPUParticles2D` with cross texture, or simple `Tween` |
| `WeatherSystem` (rain/snow) | MAX 200 | `GPUParticles2D` full-screen emitter |
| `OrbitalParticleSystem` (Auto/Kao) | MAX 40 | `GPUParticles2D` emission shape = ring |

### ObjectPool.gd (for FloatingText)
```gdscript
# ObjectPool.gd (Autoload)
# Replaces FloatingText._pool[] in effects.js
extends Node

var _label_pool: Array[Label] = []

func acquire_label() -> Label:
    if _label_pool.size() > 0:
        return _label_pool.pop_back()
    var lbl = Label.new()
    add_child(lbl)
    return lbl

func release_label(lbl: Label) -> void:
    lbl.visible = false
    _label_pool.push_back(lbl)
```

---

## 5. Entity Classes → Godot Scenes

### JS Source
`js/entities/base.js`, `js/entities/player/*.js`, `js/entities/enemy.js`, `js/entities/boss.js`
Visual logic now lives in `js/rendering/*Renderer.js` (after refactor Step 4).

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

### Projectile — Special Case
In JS: `Projectile` class + `ProjectileManager` + `SpatialGrid` (manual collision loop).
In Godot: **`Area2D` only** — `ProjectileManager` and `SpatialGrid` have no Godot equivalent.

```gdscript
# Projectile.gd
extends Area2D
@export var damage: float = 10.0
@export var team: String = "player"  # "player" | "enemy"

func _ready():
    area_entered.connect(_on_area_entered)

func _on_area_entered(area: Area2D) -> void:
    if area.is_in_group("enemies") and team == "player":
        area.take_damage(damage)
        queue_free()
    elif area.is_in_group("player") and team == "enemy":
        area.take_damage(damage)
        queue_free()
```

### Summons / Special Entities
| JS Class | Godot Scene | Notes |
|---|---|---|
| `KaoClone` | `KaoClone.tscn` (Node2D) | Spawned via `instantiate()`, follows owner |
| `NagaEntity` | `Naga.tscn` (CharacterBody2D) | Full AI, despawns after duration |
| `Drone` | `Drone.tscn` (Node2D) | Orbits player, no physics body needed |

---

## 6. Game State → Godot Autoloads (Singletons)

### JS Source
`js/systems/GameState.js` — `phase`, `timeScale`, `hitStopTimer`, wave state, etc.
`js/game.js` — `window.player`, `window.enemies`, `window.boss`

```gdscript
# GameState.gd (Autoload)
extends Node

enum Phase { MENU, PLAYING, PAUSED, GAMEOVER }
var phase: Phase = Phase.MENU
var time_scale: float = 1.0
var hit_stop_timer: float = 0.0
var wave: int = 1
var score: int = 0
var is_glitch_wave: bool = false
var controls_inverted: bool = false

# Entity refs (set by scenes on _ready)
var player: Player = null
var enemies: Array[Enemy] = []
var boss: Boss = null

func set_phase(new_phase: Phase) -> void:
    phase = new_phase
    Engine.time_scale = time_scale if phase == Phase.PLAYING else 1.0
```

```gdscript
# In Player.gd
func _ready():
    GameState.player = self

# In Enemy.gd
func _ready():
    GameState.enemies.append(self)
func _exit_tree():
    GameState.enemies.erase(self)
```

---

## 7. Config System → Godot Resources

### JS Source
`js/config.js` — `BALANCE`, `MAP_CONFIG`, `GAME_CONFIG`, `VISUALS`

| JS Config Object | Godot Resource |
|-----------------|----------------|
| `BALANCE.characters.kao` | `KaoStats.tres` (extends `CharacterStats`) |
| `BALANCE.characters.auto` | `AutoStats.tres` |
| `BALANCE.characters.poom` | `PoomStats.tres` |
| `BALANCE.boss` | `BossStats.tres` |
| `BALANCE.map.mapColors` | `MapPalette.tres` |
| `MAP_CONFIG.objects` | `MapObjectPalette.tres` |
| `MAP_CONFIG.arena` | `ArenaConfig.tres` |
| `GAME_CONFIG` | `GameConfig.tres` |

```gdscript
# CharacterStats.gd (Resource)
class_name CharacterStats
extends Resource

@export var hp: float = 100.0
@export var move_speed: float = 300.0
@export var dash_speed: float = 550.0
@export var dash_duration: float = 0.18
@export var dash_cooldown: float = 0.9
@export var crit_chance: float = 0.12
@export var crit_multiplier: float = 2.5
@export var radius: float = 16.0
```

---

## 8. Weapon / Skill System → Godot

### JS Source
`js/weapons.js` — `WeaponSystem`, `Projectile`, `ProjectileManager`
`js/entities/boss.js` — `this.skills = { slam: {cd, max}, ... }`

### WeaponSystem → Component on Player
```gdscript
# WeaponComponent.gd (Node child of Player.tscn)
extends Node

@export var stats: CharacterStats
var current_weapon: String = "auto"
var cooldown: float = 0.0

func _process(delta):
    cooldown = max(0.0, cooldown - delta)

func can_shoot() -> bool:
    return cooldown <= 0.0

func shoot(player: Player) -> void:
    if not can_shoot(): return
    var proj = preload("res://scenes/Projectile.tscn").instantiate()
    proj.global_position = player.global_position
    proj.damage = stats.weapons[current_weapon].damage
    proj.team = "player"
    get_tree().current_scene.add_child(proj)
    cooldown = stats.weapons[current_weapon].cooldown
```

### Skill.gd Resource (unchanged from original)
```gdscript
# Skill.gd (Resource)
class_name Skill
extends Resource

@export var max_cooldown: float = 5.0
var current_cooldown: float = 0.0

func is_ready() -> bool:   return current_cooldown <= 0.0
func tick(delta: float):   current_cooldown = max(0.0, current_cooldown - delta)
func use() -> void:        current_cooldown = max_cooldown
```

---

## 9. Audio System → Godot AudioStreamPlayer

### JS Source
`js/audio.js` — BGM, SFX, voice bubbles

```
AudioManager.js (singleton)  →  AudioManager.gd (Autoload)
├── BGM tracks               →  AudioStreamPlayer  (music bus)
├── SFX pool                 →  AudioStreamPlayer2D (sfx bus, pooled)
└── Voice/speech             →  AudioStreamPlayer  (voice bus)
```

---

## 10. Input System → Godot Input Singleton  *(NEW)*

### JS Source
`js/input.js` — `keys{}`, `mouse{}`, raw browser events → game state

In Godot `Input` is a built-in singleton. No port needed — replace call sites directly.

| JS pattern | Godot equivalent |
|---|---|
| `keys.w \|\| keys.a \|\| keys.s \|\| keys.d` | `Input.get_vector("move_left","move_right","move_up","move_down")` |
| `keys.space` | `Input.is_action_just_pressed("dash")` |
| `mouse.left` | `Input.is_action_pressed("shoot")` |
| `mouse.right` | `Input.is_action_pressed("skill")` |
| `mouse.wx, mouse.wy` | `get_global_mouse_position()` inside any Node |
| `keys.b` | `Input.is_action_just_pressed("shop")` |
| `keys.q`, `keys.e` | `Input.is_action_just_pressed("skill_q/e")` |

Define actions in **Project → Input Map** in Godot Editor.

---

## Migration Priority Order

> ⚠️ **JS refactor note:** Steps 1–5 are easier now because Logic and Visual are
> already separated in the JS codebase (`*Renderer` classes in `js/rendering/`).
> Each `*Renderer._draw*()` method maps 1-to-1 to a Godot scene's `_draw()` function.

1. **Config Resources** — Convert `BALANCE` + `MAP_CONFIG` to `.tres` files
2. **Autoloads** — `GameState.gd`, `AudioManager.gd`, `ObjectPool.gd`
3. **Base Entity + Player** — `CharacterBody2D` → `Player.tscn` → `Kao.tscn` (logic first, visual second)
4. **Projectile Scene** — `Area2D` + `area_entered` signal → test collision before adding visuals
5. **Enemy Scene** (1 type first) — `CharacterBody2D` + simple state machine (idle/chase/attack)
6. **Visual / `_draw()`** — Port `*Renderer` methods into each scene's `Node2D._draw()`
7. **Terrain + Map Objects** — `ArenaBoundary.gd`, `Desk.tscn`, `Tree.tscn` etc.
8. **Particle VFX** — Replace all JS Object Pools with `GPUParticles2D`
9. **Lighting** — `PointLight2D` + `CanvasModulate` per scene
10. **UI / HUD** — `CanvasLayer (z=10)` + `Control` nodes
11. **Audio** — `AudioManager.gd` Autoload
12. **AI Integration** — Gemini API via `HTTPRequest` node

### Why Player before Boss/Wave
Player.tscn is the dependency root of every other system. If `move_and_slide()`,
`take_damage()`, and shooting work correctly, all remaining scenes integrate via
signals without touching Player code again.