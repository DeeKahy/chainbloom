import './style.css';
import { app, refreshAll } from './core/app';
import { $, fmt } from './core/util';
import { bindInput } from './input';
import { renderBoard } from './render/board';
import { resize } from './render/canvas';
import { renderField } from './render/field';
import { rebuildBoardMap, updateBoard } from './sim/board';
import { spawnOrb, updateField } from './sim/world';
import { load, save } from './state/save';
import { S } from './state/state';
import { autoBuy, autoRateAvg } from './systems/economy';
import { applyOfflineEarnings, checkRiftGoal, maybeAutoNova } from './systems/prestige';
import { recalc } from './systems/stats';
import { buildHud, frameHud, tickHud } from './ui/hud';
import { buildPalette } from './ui/palette';
import { buildCollapsePane, buildNovaPane, buildStatsPane } from './ui/panes';
import { buildRunShop } from './ui/shop';
import { toast } from './ui/toast';

// ---------- boot ----------
load();
recalc();
resize();
new ResizeObserver(resize).observe($('#stage'));

buildRunShop($('#pane-up'), () => tickHud());
buildNovaPane();
buildCollapsePane();
buildStatsPane();
buildPalette();
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

function frame(now: number): void {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;

  updateField(dt);
  updateBoard(dt);
  if (app.view === 'board') renderBoard(); else renderField();
  frameHud(dt);

  uiT += dt; saveT += dt;
  if (uiT > UI_INTERVAL) {
    uiT = 0;
    recalc();
    if (S.dl.auto && S.autoBuy) autoBuy();
    maybeAutoNova();
    checkRiftGoal();
    tickHud();
  }
  if (saveT > SAVE_INTERVAL) { saveT = 0; save(autoRateAvg()); }
  requestAnimationFrame(frame);
}

window.addEventListener('beforeunload', () => save(autoRateAvg()));
document.addEventListener('visibilitychange', () => { if (document.hidden) save(autoRateAvg()); });

// Debug handle for the browser console.
(window as unknown as Record<string, unknown>).__cb = { S, recalc };

requestAnimationFrame(frame);
