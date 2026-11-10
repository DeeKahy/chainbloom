/**
 * Era 1: space. The orb field and layers 1-5 (Supernova, Collapse, Singularity, Multiverse),
 * plus the old Garden/Loom/Big Bang code, which no longer opens: reaching the Garden's goal ends
 * the era instead (see `gardenReady()` in systems/prestige.ts).
 *
 * This era's code predates the era split and lives in src/{content,sim,systems,render,ui}; its DOM
 * is the static markup in index.html (#app). Later eras keep everything under src/eras/<name>/.
 */
import { $, fmt } from '../../core/util';
import { refreshAll } from '../../core/app';
import { bindInput } from '../../input';
import { renderBoard } from '../../render/board';
import { gfx, glCv, clearCanvas, resize, setLayout } from '../../render/canvas';
import { renderField, renderFieldWithGL } from '../../render/field';
import { initFieldGL } from '../../render/fieldGL';
import { rebuildBoardMap, updateBoard } from '../../sim/board';
import { activeWorlds, multiverseOn, spawnOrb, tickGlobal, updateField, useWorld, world, worlds } from '../../sim/world';
import { app } from '../../core/app';
import { S, sanitizeState } from '../../state/state';
import { autoBuy, autoBuyDark, autoBuyStardust, autoRateAvg } from '../../systems/economy';
import { applyOfflineEarnings, checkRiftGoal, gardenReady, maybeAutoNova, tickPrestige } from '../../systems/prestige';
import { recalc } from '../../systems/stats';
import { buildHud, frameHud, tickHud } from '../../ui/hud';
import { buildPalette } from '../../ui/palette';
import { buildPins } from '../../ui/pins';
import { buildCollapsePane, buildMultiversePane, buildNovaPane, buildSingPane, buildStatsPane } from '../../ui/panes';
import { buildRunShop } from '../../ui/shop';
import { buildBangPane, buildGardenPane, buildLoomPane } from '../../ui/layers';
import { toast } from '../../ui/toast';
import { requestNextEra, type Era } from '../era';

let capWarned = false;
const perf = { simMs: 0, simMax: 0, paused: false };

const space: Era = {
  name: 'Chainbloom',
  theme: 'era-space',
  chrome: '#06070d',

  mount() {
    $('#app').hidden = false;
    recalc();
    gfx.gl = initFieldGL(() => {
      // GPU context lost (driver reset, memory pressure): carry on with the 2D renderer.
      gfx.gl = false;
      glCv.style.display = 'none';
      clearCanvas();
    });
    if (!gfx.gl) glCv.style.display = 'none';
    setLayout(multiverseOn());
    resize();
    new ResizeObserver(resize).observe($('#stage'));

    buildRunShop($('#pane-up'), () => tickHud());
    buildNovaPane();
    buildCollapsePane();
    buildSingPane();
    buildMultiversePane();
    buildGardenPane();
    buildLoomPane();
    buildBangPane();
    buildStatsPane();
    buildPalette();
    buildPins();
    buildHud();
    rebuildBoardMap();
    bindInput();

    requestAnimationFrame(() => { resize(); for (let i = 0; i < 14; i++) spawnOrb(); });
    refreshAll();
    // A save that already reached the Garden (or past it) before the farm existed moves on now.
    if (S.gardenOn || gardenReady()) setTimeout(requestNextEra, 1200);
  },

  frame(dt) {
    if (perf.paused) return;
    const t0 = performance.now();
    tickGlobal(dt);
    for (const w of activeWorlds()) {
      useWorld(w);
      updateField(dt);
    }
    useWorld(worlds[0]);
    const sim = performance.now() - t0;
    perf.simMs += (sim - perf.simMs) * .1;
    perf.simMax = Math.max(perf.simMax * .995, sim);
    updateBoard(dt);
    if (app.view === 'board') renderBoard(); else if (gfx.gl) renderFieldWithGL(); else renderField();
    frameHud(dt);
  },

  tick() {
    if (perf.paused) return;
    recalc();
    if (S.dl.auto && S.autoBuy) autoBuy();
    if (S.sl.autoStar && S.autoStar) autoBuyStardust();
    if (S.tl.dmAuto && S.autoDm) autoBuyDark();
    setLayout(multiverseOn());
    sanitizeState();
    if (S.money >= Number.MAX_VALUE && !capWarned) { capWarned = true; toast('Money hit the number limit (1.8e308). It stays there for now.', '#ff5a6e'); }
    maybeAutoNova();
    tickPrestige();
    checkRiftGoal();
    tickHud();
  },

  autoRate: autoRateAvg,

  catchUp(secs, hidden) {
    // Hidden tab: the page stayed open, so drones earn at full rate. Closed game: half rate.
    const g = hidden ? applyOfflineEarnings(1, 1) : applyOfflineEarnings();
    if (!g) return null;
    refreshAll();
    if (secs <= 60) return null;
    return hidden ? `While you were tabbed out, your drones earned $${fmt(g)}` : `While you were away, your drones earned $${fmt(g)}`;
  },

  debug: {
    world, worlds, gfx, clearCanvas, renderField, renderFieldWithGL, recalc,
    /** Freeze the loop (for comparing renderers). */
    get paused() { return perf.paused; }, set paused(v: boolean) { perf.paused = v; },
    /** Simulation time per frame in ms: a moving average and a slowly decaying peak (for profiling). */
    get simMs() { return perf.simMs; }, get simMax() { return perf.simMax; },
  },
};

export default space;
