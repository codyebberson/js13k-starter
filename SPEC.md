# Dye Hard — Game Spec

A js13kgames compo entry. Total zipped package (code, graphics, audio) must be **under 13,312 bytes**.

---

## 1. Development Rules

These rules govern how code is written for this project.

1. **Readable first, golfed later.** The build pipeline (Terser → Roadroller → advzip/ECT via
   `js13k-vite-plugins`) does heavy minification and compression. Write clear, human-readable
   TypeScript with descriptive variable and function names. Hyper-golfing is a deliberate,
   late-stage activity once the game is mature — never a default style.
2. **Efficient, not clever.** Prefer simple data structures and straightforward algorithms.
   Avoid abstractions, classes, and indirection that don't pay for themselves. The sample game
   in `src/_sample-game/` shows the preferred idioms (plain modules, const enums as numbers,
   flat entity arrays).
3. **Repetition compresses well.** Roadroller and zip both reward self-similar code. Don't
   contort code to deduplicate a few lines; consistent, repetitive patterns often produce a
   smaller final package than "DRY" cleverness.
4. **One asset, derived variants.** Ship a single sprite sheet; derive all palette variants at
   runtime. Never ship two images that differ only by palette.
5. **Measure, don't guess.** Run `npm run build` regularly and track the zipped size. Byte
   costs are unintuitive post-compression; decisions between approaches should be settled by
   building both when practical.
6. **Budget awareness.** Track the live number in [`SIZE_LOG.md`](SIZE_LOG.md).
   **2026-08-28: advzip 12,006 B (90.19% of 13,312). Headroom 1,306 B.**
   Rough working split (revise as the project matures):
   - Sprite sheet PNG: ~0.5 KB packed
   - Engine (canvas/bake/input/loop): ~2–3 KB
   - World (infinite white + veins + flowers): ~1–1.5 KB
   - Swarm / combat / powers: ~1.5–2 KB
   - UI (packed font, HUD, menus, cards, shop): ~1.5 KB
   - Audio (SoundBox player + song + 5 SFX): in the zip (was deferred, now shipped)
   - This is currently **under** the cap. If we go over, spend from the **fallback
     ladder**, cheapest pain first:
     1. Opening cutscene becomes static dialogue panels (no choreographed movement).
        **Spent:** walk-on / march / extra dialogue, then the whole cutscene moved
        to Director's Cut. Title drain + story line remain.
     2. Cut surge spawns and the stretch difficulty modes. **Never shipped (0 B).**
     3. Drop scrap-shop rows (never the whole shop). **Done for this build:** Luck,
        shop STR/DEX/CON/WIS, XP Gain, Scrap Gain. **Still in:** Start HP, Start Speed,
        Magnet, Revive.
     4. Straighten the procedural pipes — **done, then further cut:** competition
        pipes and the snake walker are Director's Cut (rule 10). Production is the
        500 px portal ring on an infinite white map.
     5. Shrink the audio reservation. **Re-spent:** production ships `smallplayer.ts`
        (SoundBox) + `music.ts` + `pickup-sfx.ts`. `_sample-game/` still has ZzFX.
7. **No external dependencies at runtime.** Everything is hand-rolled or vendored (ZzFX/ZzFXM
   already vendored in the sample).
8. **TypeScript strictness stays on.** Types are free — they're erased at build time.
9. **Dev tooling is isolated.** Debug keys/overlays live in `src/debug.ts` and are loaded
   only behind `import.meta.env.DEV`, so they are not part of the production entry.
10. **Director's Cut.** Features cut for the 13 KB zip stay in the repo, isolated so they
    are **not imported by the production entry** (tree-shaking keeps them out of the zip).
    Do not delete them. After the competition they can be wired back for a richer build.
    When cutting something this way: move it under `src/directors-cut/`, leave a comment at
    the old call site explaining the swap, and add a row to the list below.

    Currently isolated:

    | Module | What it restores | How to enable |
    |--------|------------------|---------------|
    | [`src/directors-cut/pipe-snake.ts`](src/directors-cut/pipe-snake.ts) | Occupancy-grid snake pipes (S/C shapes). Needs old curve kit + elbow art restored to the sheet. | `portalFromCellRandom` is still here; the walker itself is in git history on this file until curves return. |
    | [`src/directors-cut/pipes.ts`](src/directors-cut/pipes.ts) | Competition pipes, edge portals, plaza portal | Not imported by production. Re-wire `generatePipes` / portal combat to restore. |
    | [`src/directors-cut/cutscene.ts`](src/directors-cut/cutscene.ts) | Opening cutscene (pipe drop + drain waves + dialogue) | Not imported by production. Re-wire Start → `startCutscene`. |
    | Tile wall tests (git history on `player.ts` / `combat.ts` / `enemies.ts`) | Player tile-edge snap, enemy chase/knockback wall stops, bolt-vs-wall cull | Infinite white map has no solids (`getTile` is always white). Restore when walls return. |

All timing in this spec is expressed in **real time** (seconds/minutes), never frames.

---

## 2. Game Overview

### Premise

You are a **unicorn** living in a bright world painted with all seven colors of the rainbow.
An evil corporation, led by the **Business Boss**, opens a **portal in the central plaza**
and dispatches seven **Business Men**, who build seven **pipes** (each fed by its own small
portal at the world's edge) and siphon the color away. When a run begins, the world is
entirely **greyscale**. You set out to destroy those pipes.

### Structure

- **Genre:** top-down, pixel sprite-based **survivors-like** (Vampire Survivors-like).
  Movement is the only in-run player control; all owned abilities auto-fire.
- **World:** one single **infinite** open-world map, freely navigable, rendered with a
  smooth-scrolling camera that follows the player. Production ground is a white plaza
  with a vein overlay (see §3 World). Colored pizza slices and pipes are Director's Cut.
- **A run:** the player spawns at the **world origin** with the starting kit. Colors,
  powers, XP, and in-run stats **reset** each run. Death ends the run after revives are
  spent. Scrap and shop ranks persist between runs (see Scrap).
- **Objective:** find all 7 **ring portals**. Each portal has **100 HP**. Destroying a
  portal **releases one color** and **adds that color's bit to the nova** immediately
  (the next pulse uses it).
- **Order:** portals can be tackled in **any order**. Every portal must be beatable with
  the starting kit (horn + white nova) alone.
- **Win:** destroy all 7 portals. No survival timer — revisit if runs feel too long or
  too short. The plaza **final boss** is deferred (Director's Cut / later pass).
- **Portal areas:** fully open — walk up to a portal and attack it. The around-player
  swarm continues (no sealed arena). Portals do not chase or deal contact damage.

### Title screen and flow

- **Title screen:** game title (**"Dye Hard"**, working title) at the top, with a
  **Start** button and an **Upgrades** button (opens the scrap shop). Settings / audio
  toggles are TBD.
- **Title shortlist** (working; currently using Dye Hard): Prism Break, Pipe Dreams,
  Dye Hard, Breaking Grey, Ocean's Seven, Live and Let Dye, The Color of Money.
- **Start** plays the opening cutscene (below), then the run begins.
- **Full loop:** title → Start → cutscene → run → win/death overlay → scrap shop → next
  run (cutscene again) … Pause menu's "Quit to Menu" returns to the title (treated as a
  death: magneted scrap is kept).

### Opening cutscene

Plays on **every** Start press. **Skippable with any key** (skip jumps straight to the
greyscale run-start state).

1. Opens on the plaza: unicorn below, **Business Boss** standing at a plaza portal.
   The world is fully colored. No pipes yet.
2. Boss panel: *"THE PORTALS WORK! TIME TO STEAL THESE VALUABLE COLORS!"*
3. The **seven pipes drop** in (staggered). The first pipe removes the boss and plaza
   portal. **Each drop starts that color's reverse drain** from its **plaza-side cap**.
   Inside each circle that slice greys; when a wave finishes, that color unlocks off
   the rest of the world (tiles, unicorn).
4. Unicorn panel: *"I MUST FIND AND DESTROY THOSE PORTALS!"*
5. The run starts (greyscale, pipes in place).

### Run loop

1. **Start:** center spawn, greyscale world, horn + white nova owned, shop Start HP /
   Start Speed / Magnet / Revive applied.
2. **Play:** move only. Enemies spawn around the player. Crystals and scrap magnet in.
3. **Level-up:** pause, pick 1 card, resume.
4. **Portal:** walk to a ring portal, destroy it → portal death sequence (see Enemies),
   ending in the color-unlock overlay. Then that color's nova bit is on.
5. **Death:** if a revive remains, revive **in place** and continue. Otherwise the run ends.
6. **Win or death overlay**, then the **scrap shop**, then the next run.

**Overlay queue:** if the XP bar fills during a portal death sequence, the level-up card
shows **after** the color-unlock overlay, before resuming. Overlays never overlap. After
the 7th portal overlay, **YOU WIN**.

**Pause semantics:** any pause (level-up, pipe overlay, pause menu) freezes **everything** —
spawns, cooldowns, projectiles, the color wave, and magnet motion.

### Color release

When a portal is destroyed, that color **unlocks instantly** (tiles, sprites, HUD square,
nova bit). A **colored pixel shower** falls from that color's HUD square. The color-unlock
overlay then fires (see the portal death sequence).

> Director's Cut: a wave radiating outward from the portal, recoloring the world as it
> passes. Not in this production pass.

### Player

- **Health:** baseline **100 HP**. CON (in-run only) increases max HP. Shop Start HP
  adds extra max HP at run start (amounts TBD).
- **No mana.** Abilities do not spend a resource; they auto-fire.
- **Starting kit** (owned at run start, always auto-firing):
  - **Horn** — alternating left/right horn lash (not facing-aimed). Cycle is **1.5s**
    in **250ms** beats: **right → left → rest ×4**. Visual is the **17×9 unicorn horn**
    sheet sprite, mid-body, `flipH` for left; **10** base damage. Hits **only on the
    first frame** of each lash. Hitbox is the old chevron box (taller / 50% longer
    than a 17px graphic). Scales with **STR** only (**+20% per rank**, in-run cards).
    Horn art uses yellow and **greys with the palette** until yellow is unlocked.
  - **Nova (white)** — the kit stomp. A self-centered expanding ring: **area damage +
    knockback** as the leading edge passes enemies. See Auto-combat.
- **Hitboxes:** 11×11 aligned to the **bottom** of the 11×19 player sprite (horn/head
  sticks out above). Sprite facing art is TBD (movement/horn do not use facing).
- Movement collision uses that hitbox only.
- The player **can be frozen** (by blue/indigo on an enemy nova) and, like all frozen
  entities, takes **+25% damage** while frozen.

### Auto-combat

- **Two fireables:** horn (own 1.5s lash cycle) and **one nova** (shared period). **No
  ability keys.** The player never triggers attacks manually.
- **Nova:** one expanding ring that **follows the caster** for **500ms** out to **66 px**.
  Default **period 2s**. Each owned color is a **bit** on that pulse. Visual: **1px
  concentric strokes**, white innermost (player kit only), then owned colors in
  **ROYGBIV** order (gaps if pipes were taken out of order).
- **Persistent disk.** Anyone who overlaps the current radius during the pulse is
  hit **once** (walk-ins included). Instant (on fire) vs overlap (while the ring is live):

  | When | Bits | Effect |
  |------|------|--------|
  | Fire | Red | 1 fireball at nearest enemy (player) / at the player (boss). Skip the bolt if there is no target. |
  | Fire | Indigo | 1 frostball, same targeting as red. |
  | Fire | Yellow | Speed burst on the **caster** (**1s**; **+15%** move speed × nova PWR). |
  | Fire | Green | Heal the **caster** (**8** HP × nova PWR). |
  | Sweep | White | Stomp damage (**5** × nova PWR) + knockback (**0.36** px/ms; bosses take 50%). |
  | Sweep | Orange | Area damage (**6** × nova PWR). |
  | Sweep | Blue | Freeze **0.5s** × nova PWR (bosses: slow for **2×** that). |
  | Sweep | Violet | Destroy **hostile** bolts the wavefront crosses (player nova eats enemy shots; enemy nova eats player shots). Same-nova friendly bolts are not eaten. |

- White + orange on the same contact: **one** damage number (sum), after freeze. Freeze
  then damage means this hit can take the **+25%** frozen bonus if blue is also on.
- Knockback only if white is on **and** the enemy survived.
- Bosses use **base** amounts (nova PWR = 1). Player nova PWR = **1 + 0.2 × WIS**.
- **Projectiles** (player *and* boss): spawned when the nova fires if that bit is on.
  Fly in a **straight line** toward the target's position **at fire time** — no tracking.
  They impact the **first enemy hit**, even if it wasn't the original target. They pass
  **over pipes**, are **blocked by walls**, and **despawn off-screen** on a miss.
  Frostball freeze radius on impact: **2× sprite size** (14 px).
- Frozen entities (enemies *and* player) take **+25% damage**. The final
  boss **cannot be frozen** — it is **slowed** instead, for **2× the freeze duration**.

### Powers (one bit per released color)

Destroying a portal **turns that color's nova bit on immediately** (it does not go through
the level-up draft). All nova numbers on the **player** pulse scale with **WIS** (nova
PWR). Horn is the only STR-scaled attack. Powers are not drafted or ranked.

| Color  | Hex      | Bit (on the nova) |
|--------|----------|-------------------|
| Red    | `e40404` | Fireball — ranged damage (nearest enemy) |
| Orange | `ff8200` | Flame — area damage on the wavefront |
| Yellow | `f1e300` | Speed — burst on the caster when the nova fires |
| Green  | `08ba00` | Heal — HP pulse on the caster when the nova fires |
| Blue   | `0030e2` | Frost — area freeze on the wavefront |
| Indigo | `6c00ef` | Frostball — nearest-enemy freeze, small impact radius |
| Violet | `a656ff` | Ward — wavefront destroys hostile projectiles |

**Yellow speed:** not a permanent stat. Unlocking yellow makes the nova apply a **burst**
each pulse. Shop Start Speed is always-on and stacks with the burst while it is active.

### Stats

STR / DEX / CON / WIS are **in-run only** (level-up cards). They do **not** persist
and have no shop rows. Each caps at **5 ranks**. A capped stat leaves the draft pool.

| Stat | Effect |
|------|--------|
| STR | Horn damage only (**+20% per rank**) |
| DEX | Reduces incoming damage by **10% per rank** (multiplied into damage taken; max 50% at cap) |
| CON | Increases player max HP (**+20 per rank**) |
| WIS | Nova PWR — **+20% per rank** on nova damage, heal, freeze duration, and yellow burst amount |

### XP and level-up

- Kills may drop **crystals** (in-run XP). Crystals have an inherent drop chance (TBD);
  not every kill necessarily drops one.
- Crystals **magnet** toward the player (see Magnet below). Magnet range is upgradeable
  in the scrap shop.
- Filling the XP bar **pauses** the game. Pick **1** card from a hand of **3**, then resume.
  (Luck / extra cards were cut.)
- **Draft pool:** STR / DEX / CON / WIS only (until capped). Color bits come from pipes;
  horn/nova are kit. No power cards, no cooldown ranks.
- Duplicate cards in a single hand: TBD.

### Magnet and pickups

- **Attract radius:** a circle from the player's center, radius **2× player width**
  (22 px). The shop Magnet row grows this **+25% per rank**.
- **Pull speed:** attracted pickups move at **2× player move speed**.
- **Pickup (collection) radius:** the player hitbox itself.
- Crystals and scrap on the ground **never expire** and have **no cap**.

### Scrap (must-have)

Meta currency for between-run upgrades. Cut only if bytes force it; shop **rows** are
the first thing to drop, not the whole system.

- Drops in-run like crystals and is **magneted** the same way. Regular enemies drop a
  small amount; the final boss drops a chunk. Portals drop nothing. Amounts and inherent
  chances TBD.
- Scrap magneted during the run is **kept on death, win, or quit-to-menu**. Uncollected
  scrap on the ground is lost.
- Spent in a **between-run shop** (after the death or victory overlay), also reachable
  from the title screen via **Upgrades**.
- Persist scrap + purchased ranks in **localStorage**. World progress, released colors,
  XP, and in-run stats are **not** saved.

#### Scrap shop

Each row can be bought **3 ranks**. Prices TBD. Not in the shop: horn/nova kit, nova
period, in-run stats, drop-rate rows.

**In this build (4 rows):**

| Row | 3 ranks |
|-----|---------|
| Start HP | Extra max HP at run start (beyond in-run CON). Amounts TBD. |
| Start Speed | Extra move speed at run start (always-on; stacks with the yellow nova burst). Amounts TBD. |
| Magnet | Attract radius **+25%** per rank. |
| Revive | **1/2/3** extra lives per run. Revive **in place**. HP restored and i-frames TBD. |

**Cut from the shop (SPEC fallback #3):** Luck (4th/5th draft cards), STR/DEX/CON/WIS
starting-stat rows, XP Gain, Scrap Gain. Inherent crystal/scrap drop chances are
unmodified. Old 11-row localStorage rank arrays are ignored (scrap is still loaded).

### Enemies

#### Swarm behavior

- Regular enemies **constantly spawn just off-screen around the player**, wherever the
  player is on the map. The map is never empty.
- **Baseline spawn rate: ~2 enemies/sec.** Every **3 minutes**, a **surge**: 10× the
  spawn rate for **5 seconds**.
- **Max live cap: 150** enemies.
- Enemies that get too far away **teleport back** to the off-screen spawn ring — unless
  the count is near the cap, in which case they **despawn** in favor of fresh spawns.
- **Spawn validity:** never on pipes, walls, or water (if water returns). Enemies **can
  pass over pipes and water**; walls block them.
- **Visuals:** office supplies **float** — a 1px vertical bob, with a small code-drawn
  pixel-circle **shadow** beneath (2 frames: larger shadow on the "down" bob frame,
  smaller on "up").
- **Separation:** enemies may overlap each other **up to 50%**, never fully (use a coarse
  spatial grid — pairwise checks don't scale to the cap).
- **Contact damage:** touch-based. Damage begins only once the enemy hitbox is **>25%
  inside** the player hitbox, then ticks every **0.5s** while overlapping. **No knockback
  on the player.**

#### Type progression

Easiest to hardest — contact damage is **1 for the paperclip, +1 per step**:

| # | Enemy | Damage |
|---|-------|--------|
| 1 | Paperclip | 1 |
| 2 | Pencil | 2 |
| 3 | Binder clip | 3 |
| 4 | Pen | 4 |
| 5 | USB stick | 5 |
| 6 | Stapler | 6 |
| 7 | Calculator | 7 |
| 8 | Scissors | 8 |

A run starts with **paperclips only**; **each destroyed portal unlocks the next type**
(7 portals → all 8 types in play). HP and movement per type: TBD.

#### Elites (mini-bosses)

Office-supply sprites, same 7×9 art as the swarm, drawn at **2×**. No HP bar.

- **10× HP** of their type. Extra crystal/scrap on death (`dropEliteLoot`).
- **One nova bit** (any of the 7 colors, including yellow/green/violet). The pulse
  **shows in that color**. Radius is **50%** of the player's nova (**33 px**).
  Period and effects use **base** amounts (nova PWR = 1).
- **SPEC-boss crowd control:** cannot be frozen — **slowed** instead, for **2×** the
  freeze duration. Take **50% knockback** from the player's white nova.
- **Do not** teleport/despawn with the swarm. **Do not** count toward the 150 cap.
- **Spawns:**
  1. **Swarm elites** — ~4% of spawn ticks, any unlocked type, random nova color.
     Soft cap of **4** live swarm elites.
  2. **Portal elite** — when a portal dies, one elite of the **newly unlocked type**
     appears at the portal (random nova color). Always spawns (not gated by the
     swarm-elite cap).

- **Stretch difficulty modes:** Easy = only the type ladder, no rate scaling; Normal =
  default; Hard = spawn pressure also ramps with time in the run.

#### Ring portals (7)

One per color, on a **500 px** circle around spawn. **Red at 12 o'clock**, then
**ROYGBIV clockwise**. Black edge triangles (canvas path) point at off-screen live portals
(hidden when that portal is on-screen or destroyed). The **plaza portal**
(cutscene / finale) is Director's Cut and is **not** a target.

- **HP: 100.** HP bar under the 12×23 portal (same style as the player bar).
- **Damage:** any player attack that overlaps the portal AABB (horn, nova wavefront,
  fireballs). No contact damage, no nova of their own, no loot on death.

#### Portal death sequence

1. The portal is **removed**. That color's nova bit turns on, the next enemy type
   unlocks, and a **portal elite** of the new type spawns at the portal.
2. A **colored pixel shower** falls from that color's HUD square.
3. The **color-unlock overlay** shows: color name, power name, what it does (same card
   family as level-up).
4. If the XP bar filled, the **level-up card** shows next. After the **7th** portal
   overlay, **YOU WIN**. Then play resumes with that color's nova bit on (or the
   win screen, if that was the last portal).

#### Final boss

**Deferred this pass.** After all 7 portals, show **YOU WIN**. The Business Boss /
plaza-portal finale stays in Director's Cut / a later pass.

- **HP: 200** (when it returns).
- Fires **one rainbow nova** (red, orange, green, blue, indigo, violet — **no** white
  kit stomp, **no** yellow burst) on the default **2s** period.
- Cannot be frozen (slowed 2× freeze duration instead).
- Takes **50% of normal knockback** from the player's white nova.

### HUD

- **Player HP bar:** beneath the player sprite — white inner bar 1px high, outlined on
  all sides by 1px black; top of the outline 1px below the sprite; inner width = % of HP.
- **XP bar:** top-center, **60px** wide, same style but **2px-high** white inner bar.
  Text **"Level #"** to its right, on a **solid black plate** (1px pad around the glyphs).
- **Color indicator:** beneath the XP bar, **7 squares** — 4×4 interior with a 1px black
  outline. Interior is **grey until that color is released**, then filled with its
  rainbow color.
- **Scrap counter:** top-right — the collected amount formatted `##,###` on a **solid
  black plate** (1px pad), followed by the scrap sprite.
- **Pause icon:** **top-left** — two white 1×4 vertical bars, each with a 1px black
  outline, 1px gap between them. Clicking it (or a pause key) opens a menu with
  **Resume** and **Quit to Menu**.

### UI framework

- **Menu input:** gameplay is move-only, but all menus/overlays (cards, shop, pause,
  title, dialogue) accept **mouse click** OR **move keys to navigate + Enter to select**.
- **Dialogue panels** (cutscene): Zelda-like — speaker sprite framed on the left, text to
  the right. Advance with any key/click.
- **Pixel explosion:** one reusable, **tintable** burst-of-pixels effect, instantiated
  for enemy deaths, the player taking a hit, and portal destruction.
- **Text** uses the bit-packed code font (see §3 Text rendering). No DOM UI — everything
  is canvas.

### Controls

- **WASD + arrow keys:** movement (gameplay); menu navigation (overlays).
- **Enter / mouse click:** menu select. **Any key:** skip cutscene / advance dialogue.
- No ability keys. No settings key-remap UI.

### Persistence

- **localStorage** holds scrap + scrap-shop ranks only (plus any future non-gameplay
  settings if they exist).
- A run does **not** save position, released colors, destroyed pipes, XP, or loadout.
- The cutscene plays every run, so no "seen it" flag is needed.

### Audio

- **Shipped.** SoundBox player (`src/smallplayer.ts`) + looping song + five Voxby SFX
  (`src/pickup-sfx.ts`): crystal pickup, powerup/unlock, nova, enemy/portal hit, horn.
  Unlocks on the first pointer/key gesture. ZzFX/ZzFXM remain in `_sample-game/` only.
  - *Idea to explore:* a music track that gains instruments/richness as colors return.

---

## 3. Technical Design

### Rendering: bake-once canvas engine

The core visual mechanic — the world transitioning from greyscale to color — must not cost
anything per frame. The engine pre-renders ("bakes") sprites into offscreen canvases and the
render loop does nothing but `drawImage`:

1. **Load** `sprites.png` once; draw it to an offscreen canvas and read it with
   `getImageData` to get raw pixels.
2. **Bake:** for each sprite frame, write pixels into a dedicated offscreen canvas, applying
   the current palette state. Optional flips, 90° CCW rotation (`rot90`), and an
   rgb swap (`recolorFrom` → `recolorTo`) are supported (used for pipe orientations
   and the per-pipe stripe color; not used for the player yet — facing art TBD).
3. **Render loop:** pure `drawImage(bakedCanvas, x, y)` calls. Zero per-pixel work per frame.
4. **On color unlock:** re-bake affected sprites **once**, then resume pure `drawImage`.

### Palette state: color is the source of truth

`sprites.png` is authored in **full color** (the "all colors released" end state). While a
color is locked, the bake step remaps that color's pixels **down to its grey** — the reverse
of colorizing grey art.

Why this direction:

- The color→grey mapping is many-to-one, which is harmless: red (`e40404`) and the neutral
  mid-grey both render as `747474` while red is locked. The reverse (grey→color) is
  **ambiguous**: a `747474` pixel could be "locked red" or "permanently neutral grey", and
  several desaturated greys are within a few shades of each other (see §4 palette table).
- Only one PNG ships. `sprites-grey.png` is a **dev-only reference** and must be excluded
  from the build.

### Radiating color wave

For the wave effect (color returning outward from a destroyed pipe), the working approach:

- Maintain both a "current palette" baked set and a "next palette" baked set during a wave.
- Render the world twice clipped by an expanding circle (`ctx.clip` with an arc), or render
  the recolored version masked on top of the grey version. The wave is transient (a few
  seconds), so a temporary double-render is acceptable.
- If byte cost or performance is a problem, fall back to instant recolor + flash.

### Text rendering: bit-packed font

No font lives on the sprite sheet. Text uses a **bit-packed 3×5 pixel font**:

- Glyphs: A–Z, 0–9, and the punctuation the UI needs (`, . ! ? ' - +`). Each glyph is
  3×5 = **15 bits, one packed integer per glyph**, stored in a string/array. Roadroller
  compresses this data extremely well.
- A tiny renderer draws glyphs with per-pixel `fillRect` at any tint color and integer
  scale.
- **Bake once, like everything else:** static labels are rendered once to offscreen
  canvases and drawn with `drawImage`. Dynamic text (scrap counter, level number) re-bakes
  only when the value changes.

### Animation

- **Characters (Unicorn, Business Boss):** a 2-frame walk cycle **derived at
  bake time** from the single 11×19 sheet frame — no extra sheet art. The "leg-cut" trick:
  - The sprite's vertical midline is column 5. For each walk frame, take the bottom 2 rows
    (rows 17–18) on one side of the midline — a **4-wide × 2-tall block** (columns 1–4 for
    the left frame, columns 6–9 for the right) — and **cut it off (transparent)**, so that
    leg reads as lifted.
  - Fill the **1×4 row directly above the cut** (row 16, same columns) **solid black** —
    the new bottom outline/foot of the shortened leg.
  - Bake both variants once per character (three canvases total: idle + left-cut +
    right-cut). Alternate the two cut frames while the entity is moving; show the
    unmodified frame when idle. Frame cadence TBD (start ~150ms). Hitboxes unchanged.
  - Exact cut columns/rows should be eyeballed against the art — treat the coordinates
    above as the starting point.
- **Enemies:** 1px float bob + 2-frame code-drawn shadow (see §2 Enemies) — no sheet
  animation frames.
- **Facing flips:** still none — facing art remains TBD.

### Resolution & display

- **The canvas fills the entire browser viewport** — no letterboxing or border.
- The internal resolution is dynamic: an integer pixel scale is chosen as
  `round(innerHeight / TARGET_VIEW_HEIGHT)` (currently **250**), then the canvas is sized to
  cover the window at that scale with `image-rendering: pixelated`. Pixels stay crisp at any
  window size; the visible world area varies slightly with window shape.
- Target visibility is **±125px** from the player (`TARGET_VIEW_HEIGHT / 2`). Horizontal
  reach depends on window aspect ratio. Sprites and tiles are drawn **1:1** in world
  pixels; only the whole canvas is integer-upscaled to the window.
- *Tunable:* `TARGET_VIEW_HEIGHT` is the single camera zoom knob.

### World / tilemap

- **Tile size: 11px** — matches the player's hitbox. Production world is **infinite**
  white plaza (origin spawn). Legacy **100×100** bounds remain for Director's Cut.
- **Layout** (Director's Cut / unused this pass): seven **"pizza slice"** ground regions radiate
  from the center, one per pipe, each assigned by nearest portal angle and painted in a
  shaded variant of that pipe's rainbow color. They meet a **lumpy white plaza hub** at
  world center (`hubRadiusTiles`: ~9-tile radius with a 3- and 5-lobe sine wobble — not a
  clean circle). The map edge is a solid **wall ring**. Tiles 0–6 = slice colors,
  7 = white plaza, 8 = wall. Ground tiles are code-painted with seeded speckles.
- The plaza is plain walkable ground; the final-boss/cutscene **portal opens on its right
  side**. Water and bushes were removed; if water returns, it blocks the player but not
  enemies.
- **Pipes (competition layout):** 7 portals on a 10×10 edge map (cells `(0,0)` red NW,
  `(5,0)` orange N, `(9,0)` yellow NE, `(0,5)` green W, `(9,5)` blue E, `(0,9)` indigo SW,
  `(5,9)` violet S), inset 75px. Portals are unflipped. From each portal, a **stub** of
  **3 straights + a cap** runs **inward** (toward the plaza). Corners on a west/east wall
  go horizontal; N/S edge portals emit from the bottom/top of the monument. **No curves.**
  **Plaza run:** one capped pipe per color (3–6 straights, cap both ends) just off the
  hub, aimed out along that slice. Both vanish with the portal. Opening drain waves
  originate at each plaza-side cap.
  Each run is assigned one rainbow color; the authored `b1b1b1` center stripe (dot on
  caps) is remapped to that color at bake and **stays colored** even while the world is
  greyscale (exempt from desaturation). Vertical straights use `rot90=1`.
  The old occupancy-grid snake (S/C shapes, random run lengths, player-width gaps, jittered
  insets) is **Director's Cut** — [`src/directors-cut/pipe-snake.ts`](src/directors-cut/pipe-snake.ts),
  not shipped (also needs the removed elbow sprites). See §1 rule 10.
- Pipes block **player movement** only: enemies walk over them, projectiles fly over them.
- **Authoring: hybrid** — competition pipes are portal stubs + one plaza run per color;
  ground slices still aim at the portal cells. Any future landmarks / major walls would
  be hand-placed with seeded decoration/fill.

### Game state

- Flat entity array + plain module-level state, following the sample game's structure.
- Scene flag for title / cutscene / run / overlay / shop — keep it a simple variable, not
  a framework.
- Save/load via a single small JSON blob in localStorage (scrap + shop ranks only;
  see §2 Persistence).

---

## 4. Sprites

### Sheet: `public/sprites.png` (50×42)

All game art is drawn **1:1** (no pixel doubling). No walk/facing animation frames on the
sheet — character walk frames are derived at bake time (§3 Animation leg-cut).

#### Characters (11×19), top-left

| Sprite | Origin | Size | Notes |
|--------|--------|------|-------|
| Unicorn (player) | (0,0) | 11×19 | Facing art TBD; no flips for now. Hitbox 11×11 bottom-aligned. Walk frames derived at bake (§3 leg-cut). |
| Portal | (0,19) | 12×23 | One sprite, never flipped. E/W stubs leave through the vertical seam; N/S stubs leave the bottom/top of the monument. Also used for the plaza portal (cutscene/finale). Edge portals are the pipe-destroy targets (100 HP). |
| Business Boss (finale) | (11,0) | 11×19 | Walk frames derived at bake (§3 leg-cut). |

#### Common enemies (7×9 cells), two rows from (22,0)

| # | Name | Origin |
|---|------|--------|
| 0 | Binder clip | (22,0) |
| 1 | Pencil | (29,0) |
| 2 | Pen | (36,0) |
| 3 | Stapler | (43,0) |
| 4 | Paperclip | (22,9) |
| 5 | Calculator | (29,9) |
| 6 | USB stick | (36,9) |
| 7 | Scissors | (43,9) |

Hitboxes: **content-sized** (not the full padded cell). Sheet order differs from the
difficulty ladder in §2 — map sheet index → difficulty tier in code.

#### Pickups, flowers, pipes, horn — right of the portal

Flowers / crystal / scrap sit just right of the portal (y=19). Cap, straight, and horn
pack below them (y=29).

| Sprite | Origin | Size | Notes |
|--------|--------|------|-------|
| Flower 0–3 | (12,19), (19,19), (26,19), (33,19) | 7×10 cells | Decorative; debug scatter only |
| Crystal | (40,19) | 4×6 | In-run XP pickup |
| Scrap | (44,19) | 6×6 | Meta-currency pickup; also drawn in the HUD counter |
| Pipe cap | (12,29) | 5×8 | Opaque metal; `b1b1b1` center dot; long black border against the pipe |
| Pipe straight | (17,29) | 9×6 | Opaque metal; `b1b1b1` center stripe |
| Unicorn horn | (26,29) | 17×9 | Lash visual (mid-body, flipH for left). Greys with locked yellow. |

No curve / elbow pieces on the sheet. `createSprite` supports flipH/flipV, `rot90` (CCW),
and an optional rgb swap used to recolor the pipe stripe. Vertical straights use
`rot90=1`. No diagonal pipe piece.

#### Not on the sheet — code-drawn primitives

These are deliberately **not** sheet art; draw them with rects/arcs at bake or in the UI
layer:

- Projectiles (fireball, frostball) and the **nova** (concentric 1px color strokes;
  white + owned ROYGBIV). No shield ring, no heal `+`.
- Enemy **shadows** (2-frame pixel circle) and the tintable **pixel explosion**.
- All HUD elements (bars, color squares, pause icon) and all **text** (bit-packed font,
  §3).
- Ground/wall tiles (seeded speckle painting in `map.ts`).

There is **no font row on the sheet** (removed — superseded by the packed code font).

Dev-only / not shipped: `reference/sprites-grey.png`, `public/sprites-unicorn.png`,
`public/sprites-squared.png` (superseded experiments).

### Palette (11 colors)

Seven rainbow colors plus four neutrals. Greys below are the straight-desaturation values
measured from `sprites-grey.png` — used by the bake step when a color is locked.

All seven measured greys are exactly **HSL lightness**: `grey = (max(r,g,b) + min(r,g,b)) / 2`
(floored). The bake step uses this formula rather than a lookup table; it also leaves the four
neutral greys unchanged for free, and correctly desaturates any shaded placeholder variants of
the rainbow colors.

| Role    | Color    | Locked grey | Note |
|---------|----------|-------------|------|
| Red     | `e40404` | `747474`    | **Collides with neutral mid-grey** — harmless in the color→grey direction. |
| Orange  | `ff8200` | `7f7f7f`    | |
| Yellow  | `f1e300` | `787878`    | Near-aliases `f1e400`/`f1e500`/`f1e600` mapped in code. |
| Green   | `08ba00` | `5d5d5d`    | |
| Blue    | `0030e2` | `717171`    | |
| Indigo  | `6c00ef` | `777777`    | Near-aliases `6e00ef`/`6d00ef`/`6b00ef`/`6f00ef` mapped in code. |
| Violet  | `a656ff` | `aaaaaa`    | |
| Neutral | `000000` | unchanged   | Outlines. |
| Neutral | `747474` | unchanged   | Mid-grey shading. |
| Neutral | `b1b1b1` | unchanged | Pipe stripe placeholder; remapped per-pipe and exempt from desaturation. |
| Neutral | `cecece` | unchanged   | Light grey. |
| Neutral | `ffffff` | unchanged   | White (current unicorn body). |

### Asset rules

- `sprites-grey.png` is a **dev-only desaturation reference**; never ship it.
- Do not ship superseded player sheets (`sprites-unicorn.png`, `sprites-squared.png`) in the
  final package — keep at most one active `sprites.png`.
- New sprites should be added to `sprites.png` using only the 11 palette colors (plus
  near-quantized variants mapped in `palette.ts`), so the bake system colors them for free.
- World tiles stay code-painted until real tile art lands on the sheet.

---

## 5. Open Questions / TBD

- Player facing **art** (horn and movement do **not** use facing). Walk
  animation is **implemented** (§3 leg-cut bake, 150ms cadence, spec cut coordinates —
  they match the art exactly); only visual tuning of the cadence remains if desired.
- XP curve (crystals per level) and inherent crystal/scrap drop chances per enemy type.
- Combat numbers (placeholders in code, tune in play): horn lash timing/damage, nova
  period/duration/radius, white/orange/fireball damage, knockback, heal, freeze, yellow
  burst duration and amount.
- Per-rank STR/CON/WIS amounts are in code (20% / +20 HP / 20% nova PWR); whether CON
  heals current HP when max HP grows.
- Duplicate cards in a single hand: allowed or not.
- Revive: HP restored and i-frames (likely needed so the swarm doesn't instantly re-kill);
  whether the revive count appears on the HUD.
- Regular enemy HP and movement speed per type.
- Whether the Prismatic Shard remains visible at the plaza during runs — **no**,
  removed (sprite and narrator). Unicorn speaks the second cutscene line.
- Scrap shop prices; Start HP / Start Speed amounts per rank.
- Settings / audio toggles on the title screen.
- Exact per-enemy content hitbox rectangles (measure when wiring combat).
- Pipe metal-pixel collision: per-pixel mask vs. tight AABB of opaque pixels (byte cost).
- Flower collision: decorative only vs. soft blockers.
- Audio design (deferred).
- Real tile art on the sheet vs. keeping code-painted placeholders.

---

## 6. Build Guidance & Execution Order

A suggested phase order for building the remaining game, sequenced to minimize rework
(each phase only depends on the ones before it), with a model recommendation per phase.
"Flagship" = a best-in-class model is strongly recommended (interlocking systems, byte- or
performance-sensitive tradeoffs, or design judgment). "Capable" = well-specified,
self-contained work any competent model can execute from this spec.

Already built (no work needed): bake engine, palette/desaturation, pipes, world slices +
plaza, camera, player movement/collision (§3), swarm core, starting-kit combat, packed
font + HUD, menu/overlay framework (pause, level-up draft, stats), unified nova +
projectiles + freeze, ring portals + color unlock + elites.

| Phase | Work | Model | Why | Complete |
|-------|------|-------|-----|----------|
| 1 | **Swarm core:** spawn ring/rate/cap, teleport-back/despawn, chase movement, float bob + shadow, spatial-grid separation, contact damage, player HP + under-player HP bar | Flagship | Performance under a 150-enemy cap and the most interlocking rules in the game; everything else sits on top of it | ✅ |
| 2 | **Starting-kit combat:** horn, white nova + knockback, enemy HP/death, pixel explosion, crystal/scrap drops, magnet + pickup | Capable | Fully specified, self-contained math; makes the game playable end-to-end early | ✅ |
| 3 | **Packed font + HUD:** font renderer + label baking, XP bar, "Level #", scrap counter, color squares, pause icon | Capable | Well-bounded; unblocks every later text UI | ✅ |
| 4 | **Menu/overlay framework:** shared card/menu component, mouse + keyboard input, pause menu, level-up draft + XP curve, stat application | Flagship | One reusable UI system serving five screens under byte pressure — structure decisions here echo everywhere | ✅ |
| 5 | **Powers:** unified nova (bitfield, concentric strokes, swept hit), projectiles, freeze/slow, WIS nova PWR | Flagship | One pulse shared by player and finale; color bits replace seven fireables | ✅ |
| 6 | **Portals:** 100 HP ring portals (500 px, red at 12 o'clock), edge markers, unlock overlay, HUD color shower, next enemy type | Flagship | Production progression after the infinite-map rewrite | ✅ |
| 7 | **Run lifecycle + meta:** death/win overlays, revives, localStorage, scrap shop, title screen | Capable | The shop table and persistence rules are precise; mostly wiring the phase-4 framework | ✅ |
| 8 | **Elites + win:** swarm/portal mini-bosses (10× HP, half-size colored nova, boss CC), YOU WIN after 7 portals. Plaza finale deferred | Capable | Reuses phase-5 nova; portal elite is the newly unlocked type | ✅ |
| 9 | **Opening cutscene + dialogue UI:** panel component, scripted choreography, skip | Flagship | Scripted movement + sequenced pipe/color drain under tight bytes; first candidate on the fallback ladder, so cost judgment matters | ✅ |
| 10 | **Tuning + stretch + ship:** balance numbers (the §5 TBDs), surge spawns, difficulty modes, audio, final golfing | Flagship | Playtest judgment and byte-tradeoff calls per Rule 5 | |

Notes:

- Phase 10 is next. Cutscene (`src/cutscene.ts`) plays on every Start:
  colored plaza, static boss + portal, one boss line, staggered pipe drop
  (first pipe removes boss/portal; each drop starts that color's drain), unicorn
  line. Any key/click advances a panel; during choreography it skips to the
  greyscale run start. Dialogue panel = framed speaker sprite + word-wrapped
  packed-font lines. No plaza shard.
- Shop is 4 rows (Start HP / Start Speed / Magnet / Revive). Luck, shop stats,
  and XP/Scrap Gain are cut. Horn is a 1.5s left/right lash, not facing-aimed.
- Audio is in the production zip (SoundBox + SFX). **2026-08-28 zip: 12,006 B /
  13,312, headroom 1,306 B** — see [`SIZE_LOG.md`](SIZE_LOG.md). Remaining fallback
  spend if we go over: Start Speed row, damage numbers, remaining cutscene
  motion / instant wave (last resort). Pipe death is already instant (one explosion).
