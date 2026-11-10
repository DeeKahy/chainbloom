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

## Eras (2026-11-10)

The game is a series of **eras**: each one a whole game of its own with its own DOM, colour theme, simulation, currencies and layers. One era runs at a time (`S.era`). The user asked for this when the space game got too busy to read and too heavy for phones: "garden should be a complete switch… basically starting over but you're dealing with plants", and **wants to do it again after another ~5 layers**. So keep each era self-contained.

- **Framework:** `src/eras/era.ts` defines the `Era` interface (`mount`, `frame`, `tick`, `autoRate`, `catchUp`, optional `intro`, `debug`) and `ERAS`, the lazy loaders indexed by `S.era`. `src/main.ts` is era-agnostic: it loads the current era, runs the loop, saves every 5 s, and pays for missed time (reload: `catchUp(secs, false)`; tab hidden then shown: `catchUp(secs, true)`, capped at 2 h).
- **Switching:** an era calls `requestNextEra()` when it is over. main.ts loads the next era, plays its `intro()` (a cutscene on its own overlay), sets `S.era++`, saves and reloads the page. **One way**: there is no button back. **Earlier eras are deleted** (the user's wish: "irrelevant to keep around"): `dropEarlierEras()` in state.ts resets every field except the current era's slice and settings, at the switch and on every load in a later era, and `dropSpaceBackups()` removes the pre-era migration backups (v1-v10). So rolling back past the farm starts space from scratch.
- **Shared code:** `src/core/`, `src/state/` (the save; each era gets a slice like `S.farm` plus a migration), `src/audio.ts`, `src/ui/toast.ts` (the `#toasts` element is moved into the active era's stage), `currencyShop()` in `src/ui/shop.ts` (pass `buyN` and `recalc`), `replaceAndReload()` in save.ts for import/wipe across eras.
- **Era 1, space** (`src/eras/space/index.ts`): the orb field and layers 1-5. Its code predates the split and still lives in `src/{content,sim,systems,render,ui}`, its DOM is `#app` in index.html. Reaching the old Garden goal (150 Threads ever + a 3-hop bridge chain, `gardenReady()`) now **ends the era** (`checkUnlocks()` in prestige.ts). Saves already past it move on when they load.
- **Era 2, the farm** (`src/eras/farm/`, everything in that folder, CSS in `farm.css` under `body.era-farm`, DOM built into `#farm` by ui.ts). Intro: the stars go quiet, you take your hat off ("It has been a long day… Time to call it a day… and become a farmer"), dawn, a straw hat. Pollen palette (cream, butter, sage, honey). Canvas 2D: a few dozen flowers, so no WebGL.
  - **Layer 1: the Meadow → Pollen ✿** (`content.ts`, `meadow.ts`). A square plot, 5×5 growing to 9×9 from the middle (`S.farm.plot` is always 9×9). Plant strains (free, unlimited; drag to plant a row); they grow in real time and glow when ripe. Tap a ripe flower: it blooms and sends pollen grains (visible, ~0.15 s per tile) to the tiles its **pattern** reaches (Daisy ✚ 4 sides, Poppy ✕ diagonals, Tulip ↔ ±2 row, Foxglove ↕ ±2 column, Aster ✺ all 8 but slower; mutation-only: Clover ♞ knight jumps, Dandelion ༄ 3 random tiles, Orchid ❀ the 2 nearest ripe flowers). A grain on a ripe flower blooms it (the chain goes on); on an unripe one it adds growth. A bloomed flower starts over from 0, but grains landing on it regrow it, so a clever layout (dense Asters, for one) keeps a chain going **forever**. The user wants that: "it required brain power to think of it, just limit the rewards" (an earlier fix that forced chains to end was wrong; **a chain does NOT need to end**, harvests included). Pay = pot^1.5 × Nectar × `depthMult` × 2 if the grain's colour matches. `depthMult` compounds by the Sweet Scent step up to depth 8 (`DEPTH_SOFT`), then grows only with the log of the extra depth: the first version compounded forever and the user skipped the whole layer with one chain. The reward limit is `chainFalloff`: the first 50 blooms of a chain (`CHAIN_FULL`) pay in full, then each pays 50/(count+1), so an endless chain's total only grows like a log. To keep an endless chain cheap, past 200 grains in the air (`GRAIN_MERGE`) a new grain joins one of its chain already flying to the same tile (`Grain.w` carries the extra growth); grains then hold at ~200. Deep chains still pay most, so the layout is the puzzle. The Almanac has "Start the farm over" (fresh `S.farm`); there is deliberately no full wipe back to space (the user found it dumb). A grain landing between two different strains can drop a **hybrid** (`breed()`: genes from either parent, potency = the higher, chance of a mutation: +1 potency, a new pattern or a new colour); only new genomes are kept. Strains can be composted. **Breeze** is the automation: blooms a random ripe flower every 15 s × 0.85^(l-1), and its one-minute average rate is what offline/tab-out time pays (half rate when closed).
  - **Layer 2: the Apiary → Honey ⬢** (`apiary.ts`, content `HL`). Opens at a 7×7 meadow + 50,000 Pollen ever. Hives stand on the grass around the soil (`hivePos()`: corners, then side middles; the layout leaves 0.85 tile of grass each side once it's open). Each bee: rest 1.2 s → fly to the nearest ripe flower no other bee is heading for (only its hive's colour with Waggle Dance, `S.farm.hivePref`) → `bloomTap(tile, true)` (an auto chain) → sip 0.7 s → fly home with Honey = potency × 1.4^Big Loads. Royal Jelly multiplies all Pollen (`pollenMult()`). Honey rate is a one-minute average stored in `S.farm.honeyRate` and pays time away like Pollen.
  - **Layer 3: the Seasons → Harvest 🌾** (`seasons.ts`, content `HV`). Opens at 2,500 Honey ever + 3 hives. A played prestige: *Begin the harvest* (needs 1M Pollen this year, `yearPollen`) rests the bees and the breeze (`automationRests()`); the next tap starts the harvest chain. Each flower it blooms counts its potency once (`Chain.reaped`) however often it blooms. It is brought in (`bringIn()`) when the chain dies out, after 15 s without a new flower, or on *Bring it in now*; an endless harvest chain keeps running afterwards, it just stops counting. Gain = crops × (log10(yearPollen) − 5) / 8 × 1.25^Golden Sickle. Then `winter()`: meadow, Pollen, Honey and their upgrades go (Harvest upgrades set what spring starts with: Early Clearing, Scarecrow, Old Hives, Seed Memory); strains, unlocks, Harvest and its upgrades stay. A short snow scene shows the result.
  - **Balance is a first guess** for all three layers, from headless tests only (first harvest in testing: 49 Daisies at 1M Pollen → 12 🌾, before prices went up). **Prices were raised ~4-10× on 2026-11-10** because players "fly through the garden level way too fast"; gates went up with them.
  - **Next (not built):** Market Day (villager orders, a puzzle playstyle) and the Wilds (new land with different soils); the Harvest pane teases "a road leads to the village". With those the farm has ~5 layers, and the user wants the next era switch after that.

## The game today (era 1: space)

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
- **Upgrades** (`src/content/singularity.ts`): Event Horizon, Chain Memory (gain × `chainMemoryMult(S.best)`: ×6.1 at a 100K chain, flattening fast after), Hawking Radiation (13 levels: cut from 20 on 2026-11-09 because the last doubling-cost levels were pure grind before the Multiverse gate), Accretion, Long Flare, Corona, Eternal Autobuyer (keeps the Dark Matter Autobuyer through Singularities by holding `S.dl.auto` at 1), Stardust Autobuyer, Auto-Collapse, Star Chart (keeps the board layout).

**Layer 5: Multiverse → Threads ❖** (2026-11-09, reworked the same day after the user found it not fun: cycles were a full replay for a few Threads, and the payoff was invisible). Unlocks once every Singularity upgrade is maxed (`singularityComplete()`). A Multiverse resets everything except `MV_KEEPS` in prestige.ts (Eternal + Stardust Autobuyer, Auto-Collapse, Star Chart) and rift seals with Déjà Vu, and opens universe B beside A. The first gives a flat 10 ❖. Later ones need **no Singularity** and pay `floor(log10(1 + crossBest)² × 1.5^weave)`, where `crossBest` is the most pops one chain made in the *other* universe this cycle. Threads also **flow in live**: `liveThreads(S.crossTotal)` (log10(1+pops)²/2 × Weaving, in content/multiverse.ts) minus `S.threadsLive`, paid each UI tick with a "+N ❖" at the gate.
- **Two universes** (`worlds` in `src/sim/world.ts`): `world` is a pointer switched with `useWorld()`; each universe has its own orbs, blasts, wells, drones, black hole, grid and `view` (its rectangle and world size). Both share upgrades and money. Side by side when the stage is ≥700 px wide; narrower, they are stacked, and the ⇄ button cycles both → A → B (`layout.focus` 0/1/2). Global time (`tickGlobal`) runs once per frame; each universe runs `updateField`. Cross-universe events go through the receiving universe's `inbox`.
- **Bridge:** a gate on the edge the universes share on screen (`gate()` in world.ts): A's right / B's left when side by side, A's bottom / B's top when stacked, so the geometry follows the layout. Span `BRIDGE_SPAN` (260) + 80 per Wider Bridge. Blasts within `BRIDGE_REACH` of the edge go through, and orbs within `BRIDGE_PULL` drift toward the gate so chains near it cross. Twins and Mirror echoes are mirrored across the same edge. A blast that reaches it continues in the other universe as part of the same chain (`ch.home`, `ch.cross`). Arrivals are marked `jumped` so they can't ping-pong straight back, and cosmetic blasts without a chain never cross.
- **Upgrades** (`src/content/multiverse.ts`): Wider Bridge, Bridge Tuning (B starts at its own ^0.5 dilation), Entanglement (twin orbs in both universes; popping one pops the other), Mirror Universe (detonations echo at the mirrored spot), Melody (a chain popping the five target colours in a row pays × for the whole chain), Déjà Vu, Dark Matter Autobuyer, Dark Spark, Weaving.

**Layers 6-8** (2026-11-09; **retired 2026-11-10**: the code is still there but nothing opens them, since reaching the Garden ends the space era. Kept for reference and old saves). The user asked for something *very different* from more multipliers, so 6 and 7 are mechanics without a reset of their own, and 8 is a prestige you play. Each one opens by itself when its condition holds (`checkUnlocks()` in prestige.ts; flags `gardenOn`/`loomOn`/`bangOn` stay set), with a "Beyond" teaser in the pane below it.

**Layer 6: Garden → Pollen ✿.** Opens at 150 Threads ever (was 250: ~1.5-2 h of open-app play, too long on a phone where the tab pauses whenever it is in the background) + one chain that went through the bridge 3 times (`Chain.hops`, `S.hopBest`). Seeds (`S.garden.seeds`) have genes: pattern (ring, spray, lance, seeker, gilding, echo), trigger (any pop, colour, deep, bridge), colour, potency. Planting (`app.planting`, the next tap on the field) puts one in a bed (`S.garden.beds`, position as a fraction of the universe). `src/sim/garden.ts` plugs into world.ts through `gardenHooks` (every pop is offered to the flowers; growth is transient). A full flower **blooms** in the chain that fed it with depth wound back by `stat.refresh + floor(pot/2)`, so the garden decides chain length. **Each flower blooms at most once per chain** (`Chain.bloomed`): without that, a garden fed itself and a chain never ended. Blooms pay 2 × potency × `stat.pollenMult` Pollen; crossing two seeds costs `crossCost(S.crosses)` and mixes genes with a mutation chance. All Pollen ever multiplies Thread gain (`pollenThreadMult`). Upgrades in `content/garden.ts`, including Seasons (Auto-Multiverse, `maybeAutoMultiverse`, `S.mvTime`). Flowers are drawn in both renderers.

**Layer 7: Loom → Knots ⌘.** Opens at 400 Pollen ever + a seed of potency 4 (`S.potBest`). A merge board in the pane (`S.loom`, 7×7 stored, `stat.loomSize` used). `hooks.bead` → `systems/loom.ts`: a finished chain of 100+ pops drops a bead of tier floor(log10(count)) - 1. Two beads of a tier merge into the next; tier 3+ pays Knots. The board multiplies orb value (`loomValueMult`), and the best bead multiplies Pollen. Upgrades in `content/loom.ts` (Trellis adds garden beds, Shuttle auto-merges).

**Layer 8: Big Bang → Eras ◈.** Opens at a tier-6 bead + 20 Knots ever. The **Stillness** (`S.gathering`): blasts in flight fizzle (`stillAll`), blasts pop nothing, clicks/drones/Instability/crystals/blooms/auto-prestiges stop, spawn ×4, cap × `HOLD_MULT` (fixed at 4, so at most 1,800 orbs a field: Long Stillness makes each pop count more instead of holding more). The Big Bang chain is `thin`: only a third of its pops fire a child blast (the ring pops everything anyway). **Big Bang** sets off one chain from a ring the size of each field; Eras = `eraGain(chain count)` = sqrt(pops/250) × Afterglow, paid with the reset when that chain ends (or after 30 s of game time). `resetBangLayer()` clears the Loom, Knots, Pollen, Garden upgrades (unless Perennial), Thread upgrades except automation/Déjà Vu (unless Remembered Weave), Threads and everything below. Seeds, beds, automation and records stay. Glyph ◈, not ⧗: ⧗ is missing from common fonts.

- **Phone performance** (2026-11-09, `__cb.simMs`/`__cb.simMax` = simulation ms per frame, iPhone 13 emulation with 4× CPU throttle): endgame two-universe field ~4.6 ms, +6 flowers ~+0.5 ms, full Stillness 8.5 ms, Big Bang ~6.6 ms (peak 14). A Repulsion Law (orbs pushing each other apart) was the hot spot in a packed field (15 ms at 3,600 orbs); the user removed it on 2026-11-09 because it "does absolutely nothing" in play: wells, the black hole and the bridge pull swamp it. Then the user had **all Laws of Physics removed** ("just dumb"; save v10 deletes them with no refund). Don't bring back per-universe rule toggles. Avoid per-orb neighbour loops. Below 20 fps the game clock itself slows (dt is capped at 0.05), so slow frames also slow progress.
- **Balance is a first guess** for all three (checked only in a headless browser at ~4 fps). Watch whether 150 Threads is a fair gate, and how many Eras a first Big Bang gives (5 in testing, from an endgame field).

**Rolling back.** The tag `snapshot-pre-multiverse` is the last version before layer 5; `snapshot-pre-mv-rework` is layer 5 as first shipped, before the rework; `snapshot-pre-garden` is the last version before layers 6-8; `snapshot-pre-farm` is the last version before the eras split and the farm (saves stay compatible, see below). Saves made by later versions still load on it (unknown fields are kept and written back, the version number is not lowered), and every version change leaves an untouched copy in `chainbloom_v1_backup_v<N>`. To roll back: `git revert --no-edit snapshot-pre-multiverse..HEAD && git push origin main && git push server main`, then on the host `nix flake update chainbloom` and rebuild.

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

(These steps are for the space era. A farm layer goes in `src/eras/farm/`: its state in `S.farm` (`FarmState`, `freshFarm()`, `normalizeFarm()` fill new fields, so most additions need no migration), content next to `content.ts`, UI in `ui.ts`. A new era: see `src/eras/era.ts`.)

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
