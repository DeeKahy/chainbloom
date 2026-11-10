/**
 * Era 2: the farm. You took your hat off and called it a day; now it's you and a meadow.
 * Layer 1 is the Meadow (content.ts, meadow.ts). Everything lives in this folder: its DOM is
 * built by ui.ts into #farm, its colours hang off body.era-farm in farm.css.
 */
import './farm.css';
import { initAudio, soundOn, tone } from '../../audio';
import { $, fmt } from '../../core/util';
import { S } from '../../state/state';
import { HUES } from './content';
import { autoRate, bloomTap, fx, isRipe, meadow, offline, plant, seedRate, uproot, update } from './meadow';
import { initRender, layoutPlot, render, resize, tileCenter, tileFromPoint, bloomFx, floatText, gustFx, honeyFx, view } from './render';
import { banner, buildUi, frameUi, hybridToast, refreshSeeds, tickUi, ui, winterScene } from './ui';
import { apiary, apiaryOffline, seedHoneyRate, updateApiary } from './apiary';
import { checkUnlocks, finishHarvest } from './seasons';
import { toast } from '../../ui/toast';
import { playIntro } from './intro';
import type { Era } from '../era';

const PENT = [0, 2, 4, 7, 9];
/** Notes per second the chain may play, so a big chain is a run of bells, not a wall of noise. */
let notes = 6;

function bell(depth: number): void {
  if (!soundOn() || notes < 1) return;
  notes--;
  const step = Math.min(depth, 19);
  const semi = Math.floor(step / 5) * 12 + PENT[step % 5];
  const f = 330 * 2 ** (semi / 12);
  tone(f, .7, .045, 'sine', f * .998);
  tone(f * 2, .35, .012, 'triangle', f * 2);
}

function bindInput(cv: HTMLCanvasElement): void {
  const local = (e: PointerEvent): [number, number] => {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  let painting = false;
  let painted = new Set<number>();
  /** What a drag does is set by the tile it starts on: a swipe from a ripe flower blooms, from soil it plants. */
  let mode: 'bloom' | 'plant' | 'dig' = 'plant';

  const act = (i: number, first: boolean): void => {
    if (i < 0 || painted.has(i)) return;
    painted.add(i);
    if (first) mode = ui.tool === 'dig' ? 'dig' : isRipe(i) ? 'bloom' : 'plant';
    if (mode === 'dig') {
      if (uproot(i)) tone(180, .12, .04, 'triangle', 120);
      return;
    }
    if (mode === 'bloom') { bloomTap(i); return; }
    // planting over a growing flower of another strain replaces it; ripe flowers are left alone
    const p = S.farm.plot[i];
    if (p && p.g >= 1) return;
    if (plant(i, S.farm.sel)) tone(440, .1, .03, 'sine', 520);
  };

  cv.addEventListener('pointerdown', e => {
    initAudio();
    cv.setPointerCapture(e.pointerId);
    painting = true;
    painted = new Set();
    const [x, y] = local(e);
    act(tileFromPoint(x, y), true);
  });
  cv.addEventListener('pointermove', e => {
    const [x, y] = local(e);
    const i = tileFromPoint(x, y);
    view.hover = e.pointerType === 'mouse' ? i : -1;
    if (painting) act(i, false);
  });
  const stop = (): void => { painting = false; };
  cv.addEventListener('pointerup', stop);
  cv.addEventListener('pointercancel', stop);
  cv.addEventListener('pointerleave', () => { view.hover = -1; });
}

const farm: Era = {
  name: 'Chainbloom: the Farm',
  theme: 'era-farm',
  chrome: '#f6efd9',

  mount() {
    const root = $('#farm');
    root.hidden = false;
    buildUi(root);
    const cv = $<HTMLCanvasElement>('#fcv');
    initRender(cv);
    resize();
    new ResizeObserver(resize).observe($('#fstage'));
    bindInput(cv);
    if (!S.farm.since) S.farm.since = Date.now();
    seedRate(S.lastRate);

    fx.bloom = (i, depth, pay, s, kindred) => {
      bloomFx(i, pay, s, '+' + fmt(pay) + (kindred ? ' ♥' : ''));
      bell(depth);
    };
    fx.chainEnd = c => { if (c.count >= 6) banner(c.count); };
    fx.hybrid = (s, i) => { hybridToast(s); floatText(i, 'new seed!', HUES[s.hue].col); refreshSeeds(); };
    fx.breeze = i => gustFx(i);
    fx.honey = (hive, amount) => honeyFx(hive, '+' + fmt(amount) + ' ⬢');
    fx.reap = i => floatText(i, '🌾', '#c88a12');
    fx.harvestEnd = c => {
      const r = finishHarvest(c);
      void winterScene(r).then(() => { layoutPlot(); tickUi(); toast(`Spring. Plant your meadow again: your ${S.farm.strains.length} strains are waiting.`, '#7fb85a'); });
      layoutPlot();
      tickUi();
    };
    seedHoneyRate();
    tickUi();
  },

  frame(dt) {
    notes = Math.min(6, notes + dt * 14);
    update(dt);
    updateApiary(dt);
    render(dt);
    frameUi(dt);
  },

  tick() {
    const opened = checkUnlocks();
    if (opened === 'apiary') {
      layoutPlot();
      toast('Something hums beyond the hedge: a hive! Bees will bloom your ripe flowers. See the Apiary tab.', '#d99a1c');
      tone(392, .8, .05, 'triangle', 784);
    } else if (opened === 'seasons') {
      toast('The air turns cooler. The Seasons have come: see the Harvest tab.', '#c88a12');
      tone(330, 1, .05, 'triangle', 660);
    }
    tickUi();
  },

  autoRate,

  catchUp(secs, hidden) {
    const share = hidden ? 1 : .5;
    const g = offline(secs, share), h = apiaryOffline(secs, share);
    if ((!g && !h) || secs <= 60) return null;
    return `While you were ${hidden ? 'tabbed out' : 'away'}, ${S.farm.apiaryOn ? 'the bees' : 'the breeze'} brought ${fmt(g)} ✿` + (h ? ` and ${fmt(h)} ⬢` : '');
  },

  intro: playIntro,

  debug: { meadow, apiary, layoutPlot, view, tileCenter },
};

export default farm;
