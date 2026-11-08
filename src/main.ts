import './style.css';
import { app, refreshAll } from './core/app';
import { $, fmt } from './core/util';
import { bindInput } from './input';
import { renderBoard } from './render/board';
import { resize } from './render/canvas';
import { gfx, glCv, clearCanvas } from './render/canvas';
import { renderField, renderFieldWithGL } from './render/field';
import { initFieldGL } from './render/fieldGL';
import { rebuildBoardMap, updateBoard } from './sim/board';
import { spawnOrb, updateField, world } from './sim/world';
import { load, save } from './state/save';
import { S, sanitizeState } from './state/state';
import { autoBuy, autoBuyStardust, autoRateAvg } from './systems/economy';
import { applyOfflineEarnings, checkRiftGoal, maybeAutoNova, tickPrestige } from './systems/prestige';
import { recalc } from './systems/stats';
import { buildHud, frameHud, tickHud } from './ui/hud';
import { buildPalette } from './ui/palette';
import { buildPins } from './ui/pins';
import { buildCollapsePane, buildNovaPane, buildSingPane, buildStatsPane } from './ui/panes';
import { buildRunShop } from './ui/shop';
import { toast } from './ui/toast';

// ---------- boot ----------
load();
recalc();
gfx.gl = initFieldGL(() => {
  // GPU context lost (driver reset, memory pressure): carry on with the 2D renderer.
  gfx.gl = false;
  glCv.style.display = 'none';
  clearCanvas();
});
if (!gfx.gl) glCv.style.display = 'none';
resize();
new ResizeObserver(resize).observe($('#stage'));

buildRunShop($('#pane-up'), () => tickHud());
buildNovaPane();
buildCollapsePane();
buildSingPane();
buildStatsPane();
buildPalette();
buildPins();
buildHud();
rebuildBoardMap();
bindInput();

requestAnimationFrame(() => { resize(); for (let i = 0; i < 14; i++) spawnOrb(); });

const offline = applyOfflineEarnings();
if (offline) setTimeout(() => toast(`While you were away, your drones earned $${fmt(offline)}`, '#ffd34d'), 400);
refreshAll();

// ---------- main loop ----------
const UI_INTERVAL = .12;
const SAVE_INTERVAL = 5;
let last = performance.now(), uiT = 0, saveT = 0;
let capWarned = false;

function frame(now: number): void {
  if (debug.paused) { last = now; requestAnimationFrame(frame); return; }
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;

  updateField(dt);
  updateBoard(dt);
  if (app.view === 'board') renderBoard(); else if (gfx.gl) renderFieldWithGL(); else renderField();
  frameHud(dt);

  uiT += dt; saveT += dt;
  if (uiT > UI_INTERVAL) {
    uiT = 0;
    recalc();
    if (S.dl.auto && S.autoBuy) autoBuy();
    if (S.sl.autoStar && S.autoStar) autoBuyStardust();
    sanitizeState();
    if (S.money >= Number.MAX_VALUE && !capWarned) { capWarned = true; toast('Money hit the number limit (1.8e308). It stays there for now.', '#ff5a6e'); }
    maybeAutoNova();
    tickPrestige();
    checkRiftGoal();
    tickHud();
  }
  if (saveT > SAVE_INTERVAL) { saveT = 0; save(autoRateAvg()); }
  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => save(autoRateAvg()));
document.addEventListener('visibilitychange', () => { if (document.hidden) save(autoRateAvg()); });

// Debug handle for the browser console.
const debug = { S, recalc, world, gfx, clearCanvas, renderField, renderFieldWithGL, /** Freeze the loop (for comparing renderers). */ paused: false };
(window as unknown as Record<string, unknown>).__cb = debug;

requestAnimationFrame(frame);
