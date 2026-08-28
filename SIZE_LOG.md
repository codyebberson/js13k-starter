# Size log

Limit: **13,312 B**. Zip is the scoreboard (`npm run build` → advzip).

## 2026-08-28 — current zip

**advzip: 12,006 B (90.19% of 13 KB). Headroom 1,306 B.**

Pre-trim working zip was **12,406 B** (93.19%). This pass dropped **400 B** by deleting unique no-ops that the infinite white map never used:

| Change | Why it shipped for free |
|--------|-------------------------|
| Player tile-edge snap | `getTileSolid` always returns null |
| Enemy/bolt wall tests | `getTile` is always white; no `TILE_WALL` |
| Colored + wall tile bakes | Only the white stamp is drawn; veins carry color |
| Empty `generateMap()` call | Live map is infinite white |
| `isSequenceActive` stub | Always false, no callers |
| SFX play counters | Dev-only `window.musicState` leftover |
| Font glyphs `K` and `.` | Unused in any baked string |

Left in source (tree-shaken or Director's Cut): `PORTAL_CELLS`, `hubRadiusTiles`, `colorWave` / `WAVE_SPEED`, empty `generateMap` / `getTileSolid`. Restore player snap + `hitsWall` / `wallBox` from git when walls return.

Not touched (need live sign-off or Track 2): damage numbers, Start SPD shop row, remaining cutscene motion / instant wave, shop string cuts.

---

## Track 1 bulk golf (2026-08-20)

No UI / gameplay / visual changes. Reverted any cluster that grew the zip.

| Stage | advzip | Delta |
|------:|-------:|------:|
| Baseline (`main`) | 12596 | — |
| Cluster A: dead unique (`pixelScale`, unused glyphs `J.?\'-`, unused `generatePipes` boot/seed, `colorWave.maxR`, sprite consts, `lang`) | 12504 | **-92** |
| Cluster D packed (pickups helper, shop tuples, cam object, openEnd, map `#fff`) | 12530 | +26 — **reverted** |
| Spawn packing (`makeEnemy`) + map grey hex strings + save `??` | 12487 | **-17** |
| Pickup `add()` helper | 12522 | +35 — **reverted** |
| `openEnd`, `totalStat` cap, drop charset | 12467 | **-20** |
| Drop `toUpperCase`; unify nova heal/boost caster | 12465 | **-2** |
| Boss death near-miss; share STR/WIS rank mul | 12455 | **-10** |
| Merge `hornPwr`/`novaPwr` → `pwr(id)` | 12439 | **-16** |

**Then: 12,439 B (93.44% of 13 KB). Saved 157 B. Headroom 873 B.**

Not done from that pass (need live sign-off or Track 2): pipe dir tables, player snap, cutscene wrap, damage numbers, shop row cuts, instant wave. Player snap is now gone as a no-op (2026-08-28); the rest still apply.
