# AGENTS.md: Chainbloom

Read this before changing anything. It covers what the game is for, how it is built, and how it ships. The code layout is in [README.md](README.md).

## What the user wants

A **satisfying "number goes up" game** with a simple core loop, automation, and progression that feels good. The original brief, paraphrased:

- You start with **limited chain reactions** and upgrade them.
- Other systems then **interplay** with the chains and make them better.
- **Options to trigger them automatically.**
- Things that **stack up and spread**, either destroying or creating.

Judge every change against these pillars:
1. **Feel first.** Sound climbing a pentatonic scale with chain depth, particles, screen shake, floating totals, the "N CHAIN" banner and a smoothly counting money display are core to the game, not polish. Don't regress them.
2. **Systems feed each other.** Every new mechanic should make chains bigger or more frequent, or be powered by them. Avoid side systems that don't touch the chain loop.
3. **Automation is earned.** The player clicks first, then unlocks drones, Instability, the Autobuyer and Auto-Supernova, until lower layers play themselves and attention moves up a layer.
4. **Each layer reveals itself.** Upgrades appear as "???" teasers with a hint; tabs and views appear only when reached.

The user thinks in layers and wants to keep adding them. Keep the code shaped so a new layer is cheap (see "Adding a layer").

## The game today

**Layer 1: Money (the orb field).** Click to detonate. Orbs caught in the blast pop for money.
- *Chain Reaction:* popped orbs explode too, up to the chain depth. *Resonance* multiplies value at each step deeper, and *Shockwave* widens the blasts.
- *Automation:* Detonator Drones fire at the densest cluster, Overclock speeds them up, and Instability makes orbs go critical on their own.
- *Exotic orbs:* red is a huge blast that doesn't use up depth, gold is worth ×15, and violet splits into 3 orbs.
- *Field:* Gravity Wells swirl orbs into clusters, spit out a violet orb every 2 s each (`stat.wellOrbEvery`), and orbs popped in a well's glow are worth ×1.2 (`stat.wellMult`). Crystal Lattice grows like coral and shatters in a cascade when touched.

**Layer 2: Supernova → Stardust ✦.** Needs $1M in a run and resets layer 1. Gain is `floor(sqrt(runEarned/1e5) × starMult)`. Permanent upgrades: value multiplier, starting cash, spawns and cap, free drones, free depth, and Fission (a chance a chain blast keeps its depth).

**Layer 3: Collapse → Dark Matter ◆.** Needs 1,000 Stardust earned since the last Collapse, and resets layers 1–2. It unlocks:
- **The Constellation:** a hex board. Every finished orb chain adds its pop count to the core's charge (`S.pulseBank`). The core fires the pulse through the nodes the player places:
  - Collector: turns the pulse into Flux.
  - Relay: passes it to every neighbour.
  - Amplifier: ×2.
  - Siphon: skims half as Flux and passes the full pulse on.
  - Echo: refires from itself 0.5 s later.

  Flux buys nodes, and all Flux ever earned multiplies orb value as `(1+fluxEver)^0.35`. Removing a node refunds it in full.
- **Rifts:** harder runs that keep Stardust and block prestige while inside. Sealing one gives a permanent reward:
  - Shallow (depth ≤ 2): unlocks the Amplifier.
  - Silent (no automation): unlocks the Siphon.
  - Drought (slow spawns, half cap): unlocks the Echo.
  - Entropy (orbs decay after 5 s): unlocks Auto-Supernova.
- **Dark Matter upgrades:** ×3 value, Stardust gain, Autobuyer, a faster core, starting Stardust, and a bigger board.

**Layer 4: Singularity → ◉.** Unlocks once every Dark Matter upgrade is maxed and every Rift is sealed (the endgame of layer 3; `collapseComplete()`). After that, a Singularity is available whenever the cycle's best run (`S.cyclePeak`, the highest `runEarned` since the last Singularity) reaches $1e30. Gain is `floor((log10(cyclePeak)/30)^2.5 × singMult)`: ~60 at 1e154. It resets Dark Matter and its upgrades, the Constellation and Flux, and keeps Rift seals, records and collapse count.
- **Dilation:** from the first Singularity on, every orb payout is raised to `stat.dilation` (^0.5, +0.05 per Event Horizon level, up to ^1). This is the deliberate slowdown, and it keeps numbers far below the 1e308 cap. `payout()` in `src/sim/world.ts` applies it.
- **Black hole:** sits at the field centre (`HOLE_*` in world.ts), pulls orbs into a swirl, and pops within `HOLE_FEED` add mass. A full meter (`stat.massCap`) sets off a flare: dilation +`flareBonus` for `flareDur` seconds. Mass and flare are transient (not saved).
- **Upgrades** (`src/content/singularity.ts`): Event Horizon, Chain Memory (gain × `chainMemoryMult(S.best)`: ×6.1 at a 100K chain, flattening fast after), Hawking Radiation, Accretion, Long Flare, Corona, Auto-Collapse, Star Chart (keeps the board layout).
- **Next:** a 5th layer (the "Multiverse": more orb fields, chains crossing between them) is teased once dilation reaches ^1. Not built yet; see the performance note under Known gaps.

## Known gaps (as of 2026-11-08)

- **Layer 4 balance is a first guess** (2026-11-08): gain exponent, $1e30 minimum, upgrade prices and the 600-mass flare are untested in real play. The aim was a few days of on/off play from the first Singularity to ^1.
- **Performance for more fields (layer 5):** one field costs ~1–1.5 ms/frame of simulation on desktop, ~4–5 ms on a phone. The plan when it matters: simulate only visible fields, and credit hidden ones at their measured rates (which would also let a backgrounded tab catch up; right now it earns nothing until reload). That needs the simulation to stop calling audio/particles directly first.
- **Balance is untuned.** Costs, growth rates, the $1M and 1,000-Stardust thresholds, and node prices are first guesses; the early game was never hand-played end to end. Prices live in `src/content/`, gain formulas in `src/systems/prestige.ts`, node cost in `src/sim/board.ts`.
- **Never tested:** a full Entropy Rift run, and Auto-Supernova in real play.
- **Numbers are plain doubles** and overflow at about 1e308, which endgame players reach (one was at 2e154 on 2026-11-08). `sanitizeState()` clamps every saved number to `Number.MAX_VALUE` (JSON would write Infinity as null and wipe progress) and `save()` refuses to write a NaN, so progress stops at the cap instead of breaking. Any growth past it, e.g. a 4th layer, needs break_eternity.js behind `economy.ts` and `fmt()`, with a save migration.
- **The simulation still calls audio and particles directly,** so it can't run headless. Next structural step if balance work starts: have the simulation emit events (pop, chainFinished, nova) for audio, particles and UI to subscribe to, then add a fast-forward balance script that prints when each milestone is reached.

## Rules for changes

- **Never break existing saves.** The storage key stays `chainbloom_v1`. If the `GameState` shape changes, bump `SAVE_VERSION` in `src/state/state.ts` and append a migration in `src/state/save.ts`. New upgrades need no migration: `normalize()` fills missing levels with 0.
- **All resets go through `src/systems/prestige.ts`.** Each layer's reset calls the one below it (`resetStardustLayer` → `resetRunLayer`). Don't clear state by hand anywhere else.
- **Content is data.** Upgrades, rifts and nodes are entries in `src/content/`. Shops render whatever is there.
- **The orb field runs in world units, not pixels.** `field` in `src/render/canvas.ts` always has area `FIELD_AREA`, and only its shape follows the screen, so orb density and blast reach are the same on a phone and a big monitor (a small screen used to pack ~8× the orbs per blast). The renderer draws under `ctx.scale(field.scale)` with minimum on-screen sizes, and input divides by the scale. Drones and floating texts are drawn in screen pixels. The Constellation board stays in pixels.
- **The orb field has two renderers that must look the same.** `src/render/fieldGL.ts` (WebGL2, the default) draws trails, wells, crystals, orbs, blasts, beams and particles as instanced quads with distance-field shaders, on `#gl` under the 2D canvas. `renderField()` in `src/render/field.ts` is the Canvas 2D fallback (no WebGL2, a lost GPU context, or `?renderer=2d`). Drones, payout texts and the flash are always drawn on the 2D canvas on top, and the Constellation board is 2D only. A visual change to the field goes in both. Canvas 2D was too slow for big chains (each ring and disc is its own anti-aliased path); don't move field drawing back to it. To compare the two, set `__cb.paused = true` in the console and call `__cb.renderField()` / `__cb.renderFieldWithGL()` on the same frozen frame.
- **Keep the simulation DOM-free.** `src/sim/` talks to the UI only through `hooks` and the `refreshAll()` bus in `src/core/app.ts`.
- **Don't change behaviour during refactors.** Balance changes go in their own commits.
- **`npm run build`** runs a strict `tsc` and must pass. Playtest in the browser after gameplay changes; numbers can be set from the console via `window.__cb.S`.
- **Commits:** author is the user (`DeeKahy`). No Claude co-author trailer or attribution.

## Adding a layer

1. Add its currency, level map and counters to `GameState`, and bump the save version with a migration.
2. Put its upgrade list in `src/content/`.
3. Add a gain formula and a reset step in `prestige.ts` that calls the layer below.
4. Add a pane in `src/ui/panes.ts` using `currencyShop()`, plus a tab in `index.html`.
5. Give it its own mechanic that is powered by, and feeds back into, the layers below, like the Constellation does.

## Deploying

The game is live at **https://chainbloom.smallapp.cc**, a static site with no backend. Player saves live only in their browser.

- **Repos:**
  - GitHub: `DeeKahy/chainbloom` (private), `origin`.
  - Server working copy: `agent@192.168.8.102:/etc/nixos/chainbloom`, `server`. The server accepts pushes and updates its working tree.
- **Server:** the NixOS box (VM 102). Its own `~/AGENTS.md` covers the host. The site comes from this repo's `flake.nix` (`buildNpmPackage` → `dist/`); Caddy serves that store path, configured in `/etc/nixos/selfhosted.nix`.
- **To deploy a change:**
  ```bash
  git push origin main && git push server main
  ssh agent@192.168.8.102 'cd /etc/nixos && nix flake update chainbloom && sudo nixos-rebuild switch --flake /etc/nixos#nixos && git commit -qam "chainbloom: bump" && git push -q'
  ```
- **After changing `package-lock.json`**, recompute `npmDepsHash` in `flake.nix` with `nix run nixpkgs#prefetch-npm-deps -- package-lock.json`.
- **Caching:** `assets/` is cached forever (the filenames are content-hashed) and `index.html` is `no-cache`, so a deploy shows up on the next reload.
