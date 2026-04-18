# How to Add a New Character Card

*Introduced in v3.44.2 alongside the design-token refactor of the character-select UI.*

4 steps. Each is local — no cross-file reasoning needed. Forgetting any single step degrades gracefully to Kao's default theme (spottable in QA, never silent).

## 1. Pick a `data-char` slug

Lowercase, no spaces. Example: `nong`.

This slug is used in:

- `index.html`     : `<div class="char-card" id="card-nong" data-char="nong">`
- `css/char-select.css` : `.char-card[data-char="nong"] { ...tokens... }`
- `css/menus.css`  : `#overlay.theme-nong { ...tokens... }`
- JS (menu.js / setupCharacterHUD / PlayerBase._abilityUnlock) — unrelated to this checklist.

## 2. `css/char-select.css` — add token block

Append near the other per-char token blocks (search `DESIGN TOKENS per character`):

```css
.char-card[data-char="nong"] {
  --frame-color:         rgba(R, G, B, 0.65);   /* unselected portrait bracket */
  --frame-color-bright:  #hex;                   /* selected bracket peak (framePulse) */
  --glow-color:          rgba(R, G, B, 0.60);   /* charGlow inner ring */
  --glow-color-soft:     rgba(R, G, B, 0.25);   /* charGlow outer halo */
  --corner-color:        rgba(R, G, B, 0.55);   /* 4-corner unselected */
  --corner-color-bright: #hex;                   /* 4-corner selected peak */
}

/* Brighten frame when this card is selected — matches the pattern of other chars */
.char-card.selected[data-char="nong"] { --frame-color: rgba(R, G, B, 0.95); }
```

That single block wires **3 animations** to the new character:

- `framePulse` 1.8 s on `.char-portrait-frame::before/::after`
- `charGlow`   1.8 s on `.char-card.selected` (box-shadow)
- `cornerPulse` 1.8 s staggered on the 4 `.card-corner`s

No new `@keyframes` needed.

## 3. `css/menus.css` — add overlay token block + backdrop rule

Two things to add together (search `Character theme backgrounds for #overlay`):

```css
#overlay.theme-nong {
  /* Outer backdrop (existing pattern — same as other 4 chars) */
  background:
    repeating-linear-gradient(0deg, transparent, transparent 3px,
                              rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px),
    radial-gradient(ellipse at 50% 30%,
      rgba(R, G, B, 0.95) 0%,
      rgba(R, G, B, 0.97) 35%,
      rgba(4, 2, 12, 1)   80%
    );
  /* Menu-container tint (v3.44.2 tokens) */
  --menu-bg-start: rgba(R, G, B, 0.98);   /* ~15% lighter than backdrop */
  --menu-bg-end:   rgba(R, G, B, 0.99);
  --menu-border:   rgba(R, G, B, 0.22);
  --menu-glow:     rgba(R, G, B, 0.14);
}
```

## 4. `index.html` — copy an existing card, swap `data-char` + content

Duplicate any existing `.char-card` block (the Kao card is a good template). Change:

- Outer wrapper: `id="card-nong"` + `data-char="nong"` + `onclick="handleCardClick('nong')"`
- Inside `.char-card-inner`, **keep the 4 corner spans exactly as-is**:

```html
<i class="card-corner card-corner--tl" aria-hidden="true"></i>
<i class="card-corner card-corner--tr" aria-hidden="true"></i>
<i class="card-corner card-corner--bl" aria-hidden="true"></i>
<i class="card-corner card-corner--br" aria-hidden="true"></i>
```

- `.char-name`, `.char-title`, `.char-desc`, `.char-tag` — character text.
- `.char-avatar` — inline SVG with `viewBox="0 0 96 112"` (the aspect is enforced by `.char-avatar { aspect-ratio: 96/112 }` in CSS).
- Stat rows — four `.stat-bar` entries (HP / DMG / SPD / RANGE) with `.stat-bar-fill-XX` width class.
- Back-face skills — mirror the key list your player class exposes.

Also remember to wire the char id into:

- `js/menu.js` carousel order
- `js/entities/player/YourPlayer.js`
- `js/game.js` `_createPlayer()` factory

(These are **not** part of this UI checklist but are required for the card to actually be playable.)

## Quick checklist

- [ ] Pick `data-char` slug (e.g. `nong`).
- [ ] Token block in `css/char-select.css` (6 vars + selected frame-color override).
- [ ] Overlay backdrop + token block in `css/menus.css` (4 `--menu-*` vars).
- [ ] `<div class="char-card" data-char="nong">` in `index.html` with 4 corner spans intact.
- [ ] Hard refresh browser (SW cache-bust) → verify:
  - Frame pulses at 1.8 s
  - Card glow animates (box-shadow) at 1.8 s
  - All 4 corners visible + clockwise pulse at 1.8 s, 0.45 s phase offset
  - Menu container bg tints correctly when this char is selected
  - Portrait float at 3.6 s (half-tempo harmonic)

## Graceful degradation

If any token is missing, the variable chain falls back to **Kao's gold theme**:

| Missing | Fallback behaviour |
|---------|--------------------|
| `--frame-color*`        | Kao gold bracket, framePulse still runs |
| `--glow-color*`         | Kao gold glow |
| `--corner-color*`       | Kao gold corners |
| `--menu-bg-*` / `--menu-border` / `--menu-glow` | Kao's warm-orange container gradient |
| 4 corner spans in HTML  | No corners render — easy to spot in review |

**No silent crashes, no layout breaks, no missing animations** (the unified keyframes read token vars and continue to run even with fallbacks).

## Tempo reference

All character-select-screen animations are synchronised on a 1.8 s master / 3.6 s harmonic tempo:

| Keyframe       | Duration | Role                                  |
|----------------|----------|---------------------------------------|
| `charGlow`     | 1.8 s    | Master beat — card box-shadow pulse   |
| `framePulse`   | 1.8 s    | Portrait frame border/shadow pulse    |
| `cornerPulse`  | 1.8 s    | 4 corners, 0.45 s phase stagger       |
| `portraitFloat`| 3.6 s    | Half-tempo harmonic — avatar bob      |
| `statShimmer`  | 2.6 s    | Ambient, not synced (by design)       |

Do not change these durations without a corresponding update to the whole set.
