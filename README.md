# Chainbloom

A chain-reaction idle game. Click the field to detonate orbs, build chains, go Supernova, Collapse, and wire up the Constellation. Then hang up your hat and become a farmer: a meadow where blooms spread from flower to flower.

TypeScript + Vite, canvas 2D, no runtime dependencies. The build is a static site.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + bundle into dist/
```

## Layout

| Folder | What lives there |
|---|---|
| `src/content/` | Pure game data: run upgrades, Stardust/Dark Matter upgrades, rifts, constellation nodes. Balance changes go here. |
| `src/state/` | The save (`GameState`, `fresh()`) and load/save/migrate/export/import. |
| `src/systems/` | Rules: derived stats (`recalc`), economy (earning, costs, autobuy), prestige (every reset goes through here). |
| `src/sim/` | Per-frame simulation: the orb field (`world.ts`) and the constellation (`board.ts`). No DOM. |
| `src/render/` | Canvas drawing, sprites. |
| `src/ui/` | Side panel, shops, HUD, palette, toasts. |
| `src/main.ts` | Boot and the frame loop, shared by every era. |
| `src/eras/` | One folder per era (`era.ts` explains). `space/` wraps the folders above; `farm/` holds the whole farm era: content, simulation, renderer, UI, CSS and its intro. |

## Adding things

- **Upgrade:** add an entry to the right list in `src/content/`. Shops render it automatically, and old saves get it at level 0.
- **Rift:** add to `RIFTS` with a `modify(stat)` hook (or `orbLifetime`).
- **Prestige layer:** add its currency and level map to `GameState`, a content list, a reset step in `systems/prestige.ts` (each layer calls the one below), and a pane using `currencyShop()`.
- **Save shape change:** bump `SAVE_VERSION` in `state/state.ts` and append a migration in `state/save.ts`. Never change the storage key.
