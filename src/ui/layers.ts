import { app, onRefresh } from '../core/app';
import { $, fmt, setClass, setHTML, setText } from '../core/util';
import { EL, eraGain } from '../content/bang';
import { crossCost, geneOf, GL, PATTERNS, pollenThreadMult, TRIGGERS } from '../content/garden';
import { LL, loomBonusText, LOOM_MAX } from '../content/loom';
import { NORMALS } from '../render/sprites';
import { crossSeeds, discard, plantedCount, seedById, uproot } from '../sim/garden';
import { activeWorlds } from '../sim/world';
import { S } from '../state/state';
import { loomCells, loomFx, merge } from '../systems/loom';
import {
  BANG_BEAD, BANG_KNOTS, bangInProgress, doBigBang, gatheredOrbs, LOOM_POLLEN, LOOM_POT, setGathering,
} from '../systems/prestige';
import { recalc, stat } from '../systems/stats';
import { currencyShop } from './shop';
import { armed, toast } from './toast';

// ---------- Garden (layer 6) ----------
let refreshGlShop = (): void => {};
/** Seeds picked for the next cross (at most two). */
const picked: number[] = [];

export function buildGardenPane(): void {
  refreshGlShop = currencyShop({
    box: $('#glList'), defs: GL, levels: () => S.gl,
    balance: () => S.pollen, spend: n => { S.pollen -= n; },
    cls: 'glc', unit: '✿', sound: [523, .5, 1046],
    onBuy: () => { recalc(); refreshGardenPane(); },
  });
  $('#seedList').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (!b || b.disabled) return;
    const id = +b.dataset.id!;
    switch (b.dataset.act) {
      case 'plant':
        if (app.planting === id) { app.planting = null; break; }
        if (plantedCount() >= stat.beds) { toast('Every bed is in use: uproot a flower first.', '#ff5a6e'); break; }
        app.planting = id;
        toast('Tap the orb field where it should grow.', '#7dffb0');
        break;
      case 'uproot': uproot(id); break;
      case 'pick': {
        const i = picked.indexOf(id);
        if (i >= 0) picked.splice(i, 1);
        else { picked.push(id); if (picked.length > 2) picked.shift(); }
        break;
      }
      case 'drop':
        if (!armed(b, 'Discard it?')) return;
        discard(id);
        if (picked.includes(id)) picked.splice(picked.indexOf(id), 1);
        break;
    }
    refreshGardenPane();
  });
  $('#crossBtn').addEventListener('click', () => {
    const [a, b] = picked.map(seedById);
    if (!a || !b) return;
    const child = crossSeeds(a, b);
    if (!child) { toast('Not enough Pollen, or the seed bank is full.', '#ff5a6e'); return; }
    picked.length = 0;
    toast(`A new seed: ${geneOf(PATTERNS, child.p).name} · ${geneOf(TRIGGERS, child.t).name}, potency ${child.pot}`, '#7dffb0');
    refreshGardenPane();
  });
  const autoMv = $<HTMLInputElement>('#autoMv');
  autoMv.addEventListener('change', () => { S.autoMv = autoMv.checked; });
  onRefresh(refreshGardenPane);
}

function seedCard(id: number): string {
  const s = seedById(id)!;
  const P = geneOf(PATTERNS, s.p), T = geneOf(TRIGGERS, s.t);
  const planted = S.garden.beds.find(b => b.seed === id);
  const plantBtn = planted
    ? `<button data-act="uproot" data-id="${id}">Uproot</button>`
    : `<button data-act="plant" data-id="${id}" class="${app.planting === id ? 'on' : ''}">${app.planting === id ? 'Tap the field…' : 'Plant'}</button>`;
  return `<div class="seed${picked.includes(id) ? ' sel' : ''}">
    <div class="genes"><span class="dot" style="background:${NORMALS[s.hue].rgb}"></span>${P.icon} ${P.name} · ${T.icon} ${T.name}
      <span class="pot">${'★'.repeat(s.pot)}${'☆'.repeat(Math.max(0, stat.potMax - s.pot))}</span></div>
    <div class="about">Blooms: ${P.desc}. Grows: ${T.desc}.</div>
    <div class="btns">${plantBtn}
      <button data-act="pick" data-id="${id}" class="${picked.includes(id) ? 'on' : ''}">${picked.includes(id) ? 'Picked to cross' : 'Pick to cross'}</button>
      <button data-act="drop" data-id="${id}" ${S.garden.seeds.length <= 2 ? 'disabled' : ''}>Discard</button>
      ${planted ? `<span class="tag">Growing in universe ${planted.w ? 'B' : 'A'}</span>` : ''}</div>
  </div>`;
}

export function refreshGardenPane(): void {
  setText($('#pollenCount'), fmt(S.pollen));
  for (let i = picked.length - 1; i >= 0; i--) if (!seedById(picked[i])) picked.splice(i, 1);
  const cost = crossCost(S.crosses);
  setHTML($('#gardenInfo'), `Flowers planted: <b>${plantedCount()} / ${stat.beds}</b> · seeds ${S.garden.seeds.length} / ${stat.bank}<br>` +
    `Pollen per bloom: 2 × potency × ${fmt(stat.pollenMult)} · Thread gain ×${pollenThreadMult(S.pollenEver).toFixed(2)} from ${fmt(S.pollenEver)} Pollen ever`);
  $('#autoMvRow').hidden = !S.gl.seasons;
  $<HTMLInputElement>('#autoMv').checked = S.autoMv;
  setHTML($('#seedList'), S.garden.seeds.map(s => seedCard(s.id)).join(''));
  const btn = $<HTMLButtonElement>('#crossBtn');
  btn.disabled = picked.length !== 2 || S.pollen < cost || S.garden.seeds.length >= stat.bank;
  setText(btn, S.garden.seeds.length >= stat.bank ? 'The seed bank is full: discard one to cross'
    : `Cross ${picked.length === 2 ? 'the two picked seeds' : 'two picked seeds'} (${fmt(cost)} ✿)`);
  setHTML($('#beyond6'), S.loomOn ? 'Beyond: <b style="color:#ffcf7a">the Loom is open.</b>'
    : `Beyond: <b>???</b> Earn ${fmt(LOOM_POLLEN)} Pollen in total (${fmt(S.pollenEver)}) and breed a seed of potency ${LOOM_POT} (best: ${S.potBest}).`);
  refreshGlShop();
}

// ---------- Loom (layer 7) ----------
let refreshLlShop = (): void => {};
let sel = -1;
const beadEls: HTMLButtonElement[] = [];

export function buildLoomPane(): void {
  refreshLlShop = currencyShop({
    box: $('#llList'), defs: LL, levels: () => S.ll,
    balance: () => S.knots, spend: n => { S.knots -= n; },
    cls: 'llc', unit: '⌘', sound: [392, .5, 784],
    onBuy: () => { recalc(); refreshLoomPane(); },
  });
  const grid = $('#loomGrid');
  for (let i = 0; i < LOOM_MAX * LOOM_MAX; i++) {
    const b = document.createElement('button');
    b.dataset.i = String(i);
    grid.appendChild(b);
    beadEls.push(b);
  }
  grid.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-i]');
    if (!b) return;
    const i = +b.dataset.i!;
    if (!S.loom[i]) return;
    if (sel === -1 || sel === i) sel = sel === i ? -1 : i;
    else if (S.loom[sel] === S.loom[i]) { merge(sel, i); sel = -1; }
    else sel = i;
    refreshLoomPane();
  });
  const am = $<HTMLInputElement>('#autoMerge');
  am.addEventListener('change', () => { S.autoMerge = am.checked; });
  onRefresh(refreshLoomPane);
}

const beadColor = (t: number): string => `hsl(${(t * 41 + 20) % 360},85%,${Math.min(78, 52 + t * 2)}%)`;

export function refreshLoomPane(): void {
  setText($('#knotCount'), fmt(S.knots));
  const grid = $('#loomGrid');
  grid.style.gridTemplateColumns = `repeat(${stat.loomSize},1fr)`;
  const used = new Set(loomCells());
  if (sel >= 0 && !S.loom[sel]) sel = -1;
  beadEls.forEach((b, i) => {
    b.hidden = !used.has(i);
    if (b.hidden) return;
    const t = S.loom[i];
    let cls = t ? '' : 'empty';
    if (i === sel) cls += ' sel';
    else if (sel >= 0 && t && t === S.loom[sel]) cls += ' match';
    if (i === loomFx.landed || i === loomFx.merged) cls += ' pop';
    setClass(b, cls.trim());
    setText(b, t ? String(t) : '');
    b.style.background = t ? beadColor(t) : '';
  });
  loomFx.landed = loomFx.merged = -1;
  const full = loomCells().every(i => S.loom[i] > 0);
  setHTML($('#loomInfo'), loomBonusText(stat.loomMult, stat.loomTop) + (full ? '<br><b style="color:#ff5a6e">The Loom is full: merge beads to make room.</b>' : ''));
  $('#autoMergeRow').hidden = !S.ll.auto;
  $<HTMLInputElement>('#autoMerge').checked = S.autoMerge;
  setHTML($('#beyond7'), S.bangOn ? 'Beyond: <b style="color:#ff9ad5">the Big Bang is ready when you are.</b>'
    : `Beyond: <b>???</b> Weave a tier ${BANG_BEAD} bead (best: ${S.bestBead}) and earn ${BANG_KNOTS} Knots in total (${fmt(S.knotsEver)}).`);
  refreshLlShop();
}

// ---------- Big Bang (layer 8) ----------
let refreshElShop = (): void => {};

export function buildBangPane(): void {
  refreshElShop = currencyShop({
    box: $('#elList'), defs: EL, levels: () => S.el,
    balance: () => S.eras, spend: n => { S.eras -= n; },
    cls: 'elc', unit: '◈', sound: [330, .7, 1320],
    onBuy: () => { recalc(); refreshBangPane(); },
  });
  $('#gatherBtn').addEventListener('click', () => setGathering(!S.gathering));
  const bb = $<HTMLButtonElement>('#bangBtn');
  bb.addEventListener('click', () => {
    if (bb.disabled) return;
    if (!armed(bb, 'Click again: set it all off, then reset everything')) return;
    doBigBang();
  });
  onRefresh(refreshBangPane);
}

export function refreshBangPane(): void {
  setText($('#eraCount'), fmt(S.eras));
  const orbs = gatheredOrbs(), g = eraGain(orbs, stat.bangWeight, stat.eraMult);
  const nextAt = Math.ceil(250 * ((g + 1) / stat.eraMult) ** 2 / stat.bangWeight);
  const room = stat.cap * activeWorlds().length;
  const info = $('#bangInfo');
  if (bangInProgress()) setText(info, 'The Big Bang is going off…');
  else if (S.rift) setText(info, 'The Big Bang is blocked while you are inside a Rift.');
  else if (S.gathering) setHTML(info, `Gathered <b>${fmt(orbs)}</b> orbs (room for ${fmt(room)}). A Big Bang now pays about <b style="color:#ff9ad5">+${fmt(g)} ◈</b>; the next Era at ${fmt(nextAt)} orbs.`);
  else setText(info, `Begin the Stillness to gather the field. With your upgrades it holds up to ${fmt(stat.cap * stat.holdMult * activeWorlds().length)} orbs.`);
  $('#bangBar').style.width = (S.gathering ? Math.min(100, orbs / room * 100) : 0) + '%';
  const gb = $<HTMLButtonElement>('#gatherBtn');
  gb.disabled = bangInProgress() || !!S.rift;
  setText(gb, S.gathering ? 'End the Stillness' : 'Begin the Stillness');
  $<HTMLButtonElement>('#bangBtn').disabled = !S.gathering || g < 1 || bangInProgress();
  setHTML($('#beyond8'), 'Beyond: <b>???</b> Something stirs past the last universe. (Not built yet.)');
  refreshElShop();
}
