# UI / UX audit — gameplay clarity pass

## Concrete finding

The screenshots show four simultaneous information layers competing at the same depth: static zone labels, landmark labels, world floating text, and HUD/terminal output. This is a hierarchy failure, not a typography-only issue. The current map can remain rich, but it needs one semantic label per place, one action prompt per event, and a separate, screen-fixed event channel.

The requested **125% browser zoom lock must not be implemented as browser zoom**. Browsers do not provide a reliable, accessible API to lock the user’s zoom, and a 125% browser zoom does not inherently improve canvas performance. Implement a **1.25 in-game camera scale** instead; render in CSS-pixel canvas space and preserve browser pinch/desktop zoom for accessibility.

### Evidence and exact hooks

| Finding | Current hook | Required ownership |
| --- | --- | --- |
| Native cursor remains visible | `css/base.css` `#gameCanvas { cursor: crosshair; }` outranks the body inline cursor set by `CrosshairSystem._setCursorHidden()` | `CrosshairSystem` owns gameplay cursor visibility; CSS provides the class escape hatch. |
| Kao is purple, not the requested blue | `js/balance.js` `MTC_CROSSHAIRS.kao`; duplicate `kao-sight` style in `js/systems/CrosshairSystem.js` | Keep palette data in balance/config and make the renderer consume it. |
| Parent and child zone names duplicate/overlap | `MapSystem.drawZoneFloors()` draws every `MAP_CONFIG.zones` pill; `database` nests in `serverFarm` and `shop` nests in `courtyard` | Map owns a single zone-label selection/collision pass. Landmark renderers must not draw a second navigational label. |
| Messages overlap the map and the bottom skill rail | `TerminalLog` creates six persistent bottom-left DOM lines; `RunUpgradeSystem`, `WaveManager`, `TimeManager`, and `BodySwapSystem` also emit world floating text | A screen-fixed Event Rail owns tactical notices; floating text remains only for combat numbers and 1–2 word local state. |
| The gate reads as a generic spinning circle | `PortalSystem.draw()` uses two arcs, four ticks, and an Inter label | `PortalSystem` remains the sole gate renderer, with a constrained portal-kit composition. |
| A 1.25 game camera would desynchronise layers if added locally | `utils.js` currently has translation-only `worldToScreen`/`screenToWorld`; `MapSystem._drawStaticTerrain()` crops at 1:1; `PortalSystem`, `AlertSystem`, `BodySwapSystem`, and `BridgeSystem` subtract camera coordinates directly | `utils.js` owns every world/screen transform. All world renderers call it; terrain cache samples with the same scale. |

Architecture smell: camera math is central in name but duplicated in four world-overlay systems, so any zoom feature will otherwise make objects, labels, and interaction positions drift apart.

## Exactly three visual directions

| Direction | Description | DFII (impact + fit + feasibility + performance − consistency risk) |
| --- | --- | --- |
| 1. **Signal Garden Containment** — recommended | Retro-futurist campus navigation uses teal data lanes and amber command rails; the south grove supplies organic silhouettes; industrial language is restricted to gates and containment edges. | **5 + 5 + 5 + 5 − 2 = 18/20** (excellent) |
| 2. **Archive Blackout** | Severe charcoal arena, amber-only archive signage, and intentionally rare teal warnings. High contrast and calmer screens, but it loses the garden’s identity. | **4 + 4 + 5 + 5 − 2 = 16/20** (excellent) |
| 3. **Corrupted Bloom** | A denser biological-data garden with violet anomaly veins and animated spores. Distinctive, but has the highest risk of recreating the reported clutter. | **5 + 4 + 3 + 3 − 4 = 11/20** (strong, constrain heavily) |

**Recommendation — Signal Garden Containment.** It keeps the existing tactical-terminal mood and makes the data garden memorable without using the industrial and organic motifs at equal visual volume.

Differentiation anchor: the map is recognisable by its **quiet teal data lanes passing through a dark botanical commons, terminated by crisp amber containment gates**—not by ubiquitous neon circles or labels.

## Decision-complete visual hierarchy

### 1. World and map labels

- Assign each location a `labelTier`: `sector`, `landmark`, or `none`. At any time, render no more than one `sector` label in a 280 × 72 screen-space exclusion rectangle. Parent sector labels yield to a focused child landmark; use the existing zone loop in `MapSystem.drawZoneFloors()` to resolve that deterministically by tier, then distance to viewport centre.
- Remove static text from individual object artwork except tiny illegible-to-gameplay glyphs. `MTC DATABASE`, `SERVER FARM`, and `CO-OP STORE` must not appear both on artwork and as floor pills. Use a sector pill only when its anchor is inside the viewport; use a 12px landmark marker only while the player is within 300 world units.
- Sector marker spec: 11px `Orbitron`/existing tactical display face, uppercase, 1.6px tracking; panel `rgba(8,12,18,0.88)`; 1px border at 50% accent opacity; 8px horizontal / 4px vertical inset; maximum rendered width 152px with ellipsis. No shadow and no background blur.
- Replace the large permanently visible zone rectangles with a 1px boundary at alpha `0.10` and one 64px corner bracket at alpha `0.28`. Do not draw inner grids above alpha `0.12`. The sector remains discoverable through floor hue, not wallpaper-like linework.
- Palette: charcoal `#080C12`, panel `#0D1117`, command amber `#F59E0B`, hazard orange `#F97316`, data teal `#22D3EE`, foliage `#4ADE80`, dark leaf `#243D0E`, text primary `#E0F2FE`, muted text `#94A3B8`.

### 2. Notifications and ability comprehension

- Replace the six-line `TerminalLog` stack with a single **Event Rail** at `left: 18px; bottom: max(118px, env(safe-area-inset-bottom) + 18px)`, width `min(352px, calc(100vw - 36px))`. Show one current notice plus one dimmed previous notice; dedupe same `sender + text` within 2.5 seconds and increment a compact `×N` counter. Keep `aria-live="polite"`; warnings use `aria-live="assertive"` only once per state transition.
- Event Rail anatomy: 3px teal/amber severity rule, 12px mono timestamp/verb, 14px title, optional 11px action key. Entry 220ms `cubic-bezier(0.16, 1, 0.3, 1)` from -8px Y; linger 3.8s; fade 180ms. Limit to two simultaneous rows. This fixes the visible duplicate `ANOMALY GATE OPEN -> WAVE 2` noise even before the gate-state bug is fixed.
- Define an `AbilityCoach` presentation layer (DOM or HUD canvas; not entity floating text). It reads existing `TimeManager` and `BodySwapSystem` state but changes neither ability’s combat logic. It can show one context card per ability every 20 seconds maximum and dismisses immediately on activation.
  - **Time slow** prompt condition: at least 4 hostiles inside 260 world units or a visible boss telegraph; card: `TIME FRACTURE READY` / `T — slow the next rush`; blue `#38BDF8` icon with a 0–100 energy bar. Add `SLOW 70% · 1.8s` only if that is the actual mechanics value.
  - **Hijack** prompt condition: a valid enemy snapshot exists and its active trait provides a meaningful threshold benefit; card: `DATA HIJACK READY` / `F — borrow [TRAIT]`; green `#4ADE80` badge. Do not suggest it when no valid target/snapshot exists.
  - Auto-cast must be opt-in under an explicit `Assisted Skills` setting. If enabled, Time slow may trigger only once per 12 seconds at the danger threshold; Hijack must never auto-target without a valid snapshot. Each automatic action emits `ASSISTED: TIME FRACTURE` once to the Event Rail.
- Reserve world floating text for damage/healing, pickup numerals, and short local tags (`HIJACKED`, `SLOW`). Remove long system sentences from `spawnFloatingText` call sites in `WaveManager`, `TimeManager`, `BodySwapSystem`, and `RunUpgradeSystem`; route them through the Event Rail.

### 3. Crosshair and portal kit

- In `CrosshairSystem._setCursorHidden()`, toggle a dedicated `gameplay-cursor-hidden` class on `#gameCanvas` and set its inline cursor as a fallback. Add `#gameCanvas.gameplay-cursor-hidden { cursor: none !important; }`. Restore the native pointer on menus, modal choices, paused state, touchscreen, and when the canvas loses focus. This fixes the CSS specificity conflict rather than masking it.
- Make the crosshair scale from `MTC_CROSSHAIRS` only. For Kao, change primary to blue `#38BDF8`, accent `#E0F2FE`, and use an asymmetric four-segment reticle: 17px outer radius, 5px centre dot, 2px stroke, 8px gaps, and a 3px cyan leading aim tick. Rotate only the leading tick toward aim; no continuous whole-reticle spin. Idle breathing: 1.8s `easeInOutSine`, radius ±1px, glow alpha 0.35. Firing response: 90ms expansion + 140ms recovery, capped at +4px. Other characters retain recognisable shape families with their individual palette tokens.
- Rebuild `PortalSystem.draw()` as an **Anomaly Relay Gate**, not a rotating disc: a 92px-wide broken hexagonal containment frame, two static amber gate pylons, a teal inward-flow data ribbon, and a 34px dark aperture with a violet anomaly core. Under the gate, show only `WAVE N // ENTER` in the sector-label treatment. No spinning full circles.
- Gate motion: frame warm-up 420ms `cubic-bezier(0.16,1,0.3,1)`; data ribbon drift 2.4s `easeInOutSine`; core pulse 1.2s; one 160ms aperture flash on approach. Maximum glow alpha 0.45. Emit no particles per frame; derive all paths from fixed 6-point arrays and `_t`. Gate culls at `CULL_MARGIN` as it does today.

### 4. Correct 125% in-game camera and transform migration

- Add `zoom: 1.25` to the camera in `utils.js`; preserve `x`/`y` as the world coordinate at the unscaled viewport’s top-left. `worldToScreen` must return `(world - camera) * zoom`; `screenToWorld` must return `screen / zoom + camera`; `updateCamera` must target `CANVAS.width / (2 * zoom)` and `CANVAS.height / (2 * zoom)`. Input therefore remains aligned at 125%.
- `MapSystem._drawStaticTerrain()` must crop `CANVAS.width / zoom` × `CANVAS.height / zoom` world-cache pixels at `camera - terrainOrigin` and draw the source to the full canvas destination. Keep its cache in world-pixel coordinates; do not scale the cache itself every frame.
- Replace direct `entity.x - cam.x` / `entity.y - cam.y` in `PortalSystem`, `AlertSystem`, `BodySwapSystem`, and `BridgeSystem` with `worldToScreen`. Update weather spawn bounds in `effects.js` to use the inverse camera viewport size. Any renderer using `camera.zoom` must read the same value; remove fallback globals such as `cameraZoom`.
- Apply screen shake only once around the world render pass, as `drawGame()` already does. The Crosshair, Event Rail, HUD, menus, and upgrade modal remain screen-space after `CTX.restore()` and must never be camera-scaled.

## Performance, accessibility, and acceptance gates

- Keep 60 FPS as the budget: one terrain-cache blit, a maximum of four active sector brackets, two Event Rail rows, one gate, and no per-frame DOM allocation. Reuse fixed canvas paths and buffers; no `Array#filter`, map-wide scans, or particle spawning in draw paths.
- Respect `prefers-reduced-motion`: freeze gate ribbon displacement, crosshair breathing, and Event Rail slide motion; retain colour, position, and text state. Support minimum 4.5:1 contrast for text; never encode ability readiness with colour alone; key prompts require text and an icon. Keep browser zoom and pinch zoom enabled.
- Add focused tests for: only one native/canvas cursor visible while playing; Kao crosshair colour/shape selection; parent-child zone label collision suppression; terminal duplicate coalescing; gate label/readability and culling; `worldToScreen(screenToWorld(p))` round-trip at `zoom=1.25`; terrain, portal, alerts, bridge, weather, mouse aim, and interaction alignment at `zoom=1.25`.
- Visual acceptance: at 1920×1080, no world label intersects a second world label, Event Rail, ability rail, radar, or player damage number; static text count inside the immediate combat viewport is no more than three; the gate has a legible approach direction and `WAVE N // ENTER` cue; Kao displays only the blue custom reticle during active play.
