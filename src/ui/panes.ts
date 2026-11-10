import { onRefresh } from '../core/app';
import { $, fmt, setClass, setHTML, setText } from '../core/util';
import { DU, SU } from '../content/prestige';
import { SL } from '../content/singularity';
import { crossForLive, TL } from '../content/multiverse';
import { AUTO_NOVA_RIFT, RIFTS } from '../content/rifts';
import { refreshPins } from './pins';
import { STAT_ROWS, togglePin } from './statRows';
import type { RiftDef } from '../content/types';
import { exportSave, parseImport, replaceAndReload } from '../state/save';
import { S } from '../state/state';
import { stat } from '../systems/stats';
import {
  colGain, COLLAPSE_MIN, GARDEN_HOPS, GARDEN_THREADS, collapseComplete, doCollapse, doNova, doSingularity, enterRift, importState, leaveRift, nextNovaAt,
  doMultiverse, mvGain, NOVA_MIN, novaGain, SING_MIN_LOG, singGain, singularityComplete, wipe,
} from '../systems/prestige';
import { currencyShop, refreshRunShop } from './shop';
import { armed, toast } from './toast';

// ---------- Supernova pane ----------
let refreshStarShop = (): void => {};

export function buildNovaPane(): void {
  refreshStarShop = currencyShop({
    box: $('#starList'), defs: SU, levels: () => S.st,
    balance: () => S.stardust, spend: n => { S.stardust -= n; },
    cls: 'star', unit: '✦', sound: [520, .3, 1040],
    onBuy: () => { refreshNovaPane(); refreshRunShop(); },
  });
  const btn = $<HTMLButtonElement>('#novaBtn');
  btn.addEventListener('click', () => {
    if (!novaGain()) return;
    if (!armed(btn, 'Click again to go Supernova')) return;
    doNova(false);
  });
  $<HTMLInputElement>('#autoNova').addEventListener('change', e => { S.autoNova = (e.target as HTMLInputElement).checked; });
  $<HTMLInputElement>('#autoStar').addEventListener('change', e => { S.autoStar = (e.target as HTMLInputElement).checked; });
  onRefresh(refreshNovaPane);
}

export function refreshNovaPane(): void {
  setText($('#sdCount'), fmt(S.stardust));
  const g = novaGain();
  const pct = Math.min(1, S.runEarned / NOVA_MIN);
  $('#novaBar').style.width = (g ? 100 : pct * 100) + '%';
  $('#autoNovaRow').hidden = !S.riftsDone.includes(AUTO_NOVA_RIFT);
  $<HTMLInputElement>('#autoNova').checked = S.autoNova;
  $('#autoStarRow').hidden = !S.sl.autoStar;
  $<HTMLInputElement>('#autoStar').checked = S.autoStar;
  const info = $('#novaInfo');
  if (S.rift) setText(info, 'Supernova is blocked while you are inside a Rift.');
  else if (g) setHTML(info, `Supernova now for <b style="color:var(--gold)">+${fmt(g)} ✦</b> · next ✦ at $${fmt(nextNovaAt(g))}`);
  else setText(info, `$${fmt(S.runEarned)} / $1M earned this run`);
  $<HTMLButtonElement>('#novaBtn').disabled = !g;
  refreshStarShop();
}

// ---------- Collapse pane (Dark Matter + Rifts) ----------
let refreshDarkShop = (): void => {};
const riftEls = new Map<number, { el: HTMLElement; btn: HTMLButtonElement; lv: HTMLElement }>();

function onRiftClick(R: RiftDef, btn: HTMLButtonElement): void {
  if (S.riftsDone.includes(R.id)) return;
  if (S.rift === R.id) {
    if (armed(btn, 'Click again to abandon')) leaveRift(R);
    return;
  }
  if (armed(btn, 'Click again: resets money & upgrades')) enterRift(R);
}

export function buildCollapsePane(): void {
  refreshDarkShop = currencyShop({
    box: $('#dmList'), defs: DU, levels: () => S.dl,
    balance: () => S.dm, spend: n => { S.dm -= n; },
    cls: 'dmc', unit: '◆', sound: [330, .4, 990],
    onBuy: () => refreshCollapsePane(),
  });
  const rl = $('#riftList');
  setHTML(rl, '');
  for (const R of RIFTS) {
    const d = document.createElement('div');
    setClass(d, 'up rift');
    d.innerHTML = `<div class="row"><span class="nm">${R.name}</span><span class="lv"></span></div>
      <div class="ds">${R.rule}<br>Goal: earn $${fmt(R.goal)} in the rift. Reward: <b style="color:#e3d4ff">${R.reward}</b></div>
      <button class="rbtn"></button>`;
    const btn = d.querySelector<HTMLButtonElement>('.rbtn')!;
    btn.addEventListener('click', () => onRiftClick(R, btn));
    riftEls.set(R.id, { el: d, btn, lv: d.querySelector<HTMLElement>('.lv')! });
    rl.appendChild(d);
  }
  $<HTMLInputElement>('#autoCol').addEventListener('change', e => { S.autoCol = (e.target as HTMLInputElement).checked; });
  $<HTMLInputElement>('#autoDm').addEventListener('change', e => { S.autoDm = (e.target as HTMLInputElement).checked; });
  const colBtn = $<HTMLButtonElement>('#colBtn');
  colBtn.addEventListener('click', () => {
    if (!colGain()) return;
    if (!armed(colBtn, 'Click again: this resets Stardust too')) return;
    doCollapse();
  });
  onRefresh(refreshCollapsePane);
}

export function refreshCollapsePane(): void {
  setText($('#dmCount'), fmt(S.dm));
  const g = colGain();
  $('#colBar').style.width = Math.min(100, S.starsCycle / COLLAPSE_MIN * 100) + '%';
  setHTML($('#colInfo'), S.rift ? 'Collapse is blocked while you are inside a Rift.' :
    g ? `Collapse now for <b style="color:#c9a6ff">+${fmt(g)} ◆</b>` : `${fmt(S.starsCycle)} / ${fmt(COLLAPSE_MIN)} Stardust earned since last Collapse`);
  $<HTMLButtonElement>('#colBtn').disabled = !g;
  $('#autoDmRow').hidden = !S.tl.dmAuto;
  $<HTMLInputElement>('#autoDm').checked = S.autoDm;
  $('#autoColRow').hidden = !S.sl.autoCol;
  $<HTMLInputElement>('#autoCol').checked = S.autoCol;
  refreshDarkShop();
  // Teaser for layer 4 until the first Singularity
  const tease = $('#singTease');
  tease.hidden = !S.collapses || S.singularities > 0;
  if (!tease.hidden) {
    const maxed = DU.filter(u => S.dl[u.id] >= u.max).length, sealed = S.riftsDone.length;
    setHTML(tease, collapseComplete()
      ? '<b style="color:#ffb35c">◉ Something stirs at the centre of the field.</b> The Singularity tab is open.'
      : `<b>???</b> Max every Dark Matter upgrade (${maxed} / ${DU.length}) and seal every Rift (${sealed} / ${RIFTS.length}).`);
  }
  const showR = S.collapses > 0;
  $('#riftCat').hidden = !showR; $('#riftHelp').hidden = !showR; $('#riftList').hidden = !showR;
  for (const R of RIFTS) {
    const r = riftEls.get(R.id)!;
    const done = S.riftsDone.includes(R.id), act = S.rift === R.id;
    setClass(r.el, 'up rift' + (done ? ' done' : '') + (act ? ' active' : ''));
    setText(r.lv, done ? 'Sealed ✓' : act ? `$${fmt(S.runEarned)} / $${fmt(R.goal)}` : '');
    r.btn.style.display = done ? 'none' : '';
    if (!r.btn.dataset.armed) setText(r.btn, act ? 'Abandon rift' : 'Enter rift');
  }
}

// ---------- Singularity pane (layer 4) ----------
let refreshSingShop = (): void => {};

export function buildSingPane(): void {
  refreshSingShop = currencyShop({
    box: $('#slList'), defs: SL, levels: () => S.sl,
    balance: () => S.sing, spend: n => { S.sing -= n; },
    cls: 'sgc', unit: '◉', sound: [180, .5, 720],
    onBuy: () => refreshSingPane(),
  });
  const btn = $<HTMLButtonElement>('#singBtn');
  btn.addEventListener('click', () => {
    if (!singGain()) return;
    if (!armed(btn, 'Click again: resets Dark Matter and the Constellation')) return;
    doSingularity();
  });
  onRefresh(refreshSingPane);
}

export function refreshSingPane(): void {
  setText($('#singCount'), fmt(S.sing));
  const g = singGain();
  const lg = Math.log10(Math.max(1, S.cyclePeak));
  $('#singBar').style.width = (g ? 100 : Math.min(100, lg / SING_MIN_LOG * 100)) + '%';
  const info = $('#singInfo');
  if (S.rift) setText(info, 'Singularity is blocked while you are inside a Rift.');
  else if (!S.singularities && !collapseComplete()) setText(info, 'Max every Dark Matter upgrade and seal every Rift first.');
  else if (g) setHTML(info, `Singularity now for <b style="color:#ffb35c">+${fmt(g)} ◉</b> (from your best run this cycle, $${fmt(S.cyclePeak)})`);
  else setText(info, `Best run this cycle $${fmt(S.cyclePeak)} / $1e${SING_MIN_LOG}`);
  $<HTMLButtonElement>('#singBtn').disabled = !g;
  $('#beyond').hidden = !S.singularities;
  if (!$('#beyond').hidden) {
    const maxed = SL.filter(u => S.sl[u.id] >= u.max).length;
    setHTML($('#beyond'), singularityComplete()
      ? 'Beyond the horizon: <b style="color:#7fd4ff">every Singularity upgrade is maxed.</b> The Multiverse tab is open.'
      : `Beyond the horizon: <b>???</b> Max every Singularity upgrade (${maxed} / ${SL.length}).`);
  }
  refreshSingShop();
}

// ---------- Multiverse pane (layer 5) ----------
let refreshThreadShop = (): void => {};

export function buildMultiversePane(): void {
  refreshThreadShop = currencyShop({
    box: $('#tlList'), defs: TL, levels: () => S.tl,
    balance: () => S.threads, spend: n => { S.threads -= n; },
    cls: 'mvc', unit: '❖', sound: [260, .6, 1560],
    onBuy: () => refreshMultiversePane(),
  });
  const btn = $<HTMLButtonElement>('#mvBtn');
  btn.addEventListener('click', () => {
    if (!mvGain()) return;
    if (!armed(btn, 'Click again: resets everything but the automation and Star Chart')) return;
    doMultiverse();
  });
  onRefresh(refreshMultiversePane);
}

export function refreshMultiversePane(): void {
  setText($('#mvCount'), fmt(S.threads));
  const g = mvGain();
  const info = $('#mvInfo');
  // the bar fills toward the next live Thread
  const at = crossForLive(S.threadsLive, stat.threadMult), next = crossForLive(S.threadsLive + 1, stat.threadMult);
  $('#mvBar').style.width = (S.multiverses ? Math.min(100, (S.crossTotal - at) / Math.max(1, next - at) * 100) : g ? 100 : 0) + '%';
  const flow = S.multiverses ? `<br>Flowing in live: <b style="color:#7fd4ff">${fmt(S.threadsLive)} ❖</b> this cycle from <b>${fmt(S.crossTotal)}</b> cross-world pops. Next at ${fmt(next)}.` : '';
  if (S.rift) setText(info, 'The Multiverse is blocked while you are inside a Rift.');
  else if (!S.multiverses && !singularityComplete()) setText(info, 'Max every Singularity upgrade first.');
  else if (g) setHTML(info, `Open the Multiverse now for <b style="color:#7fd4ff">+${fmt(g)} ❖</b>` + (S.multiverses ? ` (best cross-world chain: ${fmt(S.crossBest)} pops)` : '') + flow);
  else setHTML(info, `Best cross-world chain this cycle: ${fmt(S.crossBest)} pops` + flow);
  $<HTMLButtonElement>('#mvBtn').disabled = !g;

  const b5 = $('#beyond5');
  b5.hidden = !S.multiverses;
  if (!b5.hidden) setHTML(b5, S.gardenOn ? 'Beyond: <b style="color:#7dffb0">the Garden is open.</b>'
    : `Beyond: <b>???</b> Earn ${GARDEN_THREADS} Threads in total (${fmt(S.threadsEver)}) and send one chain through the bridge ${GARDEN_HOPS} times (best: ${S.hopBest}).`);
  refreshThreadShop();
}

// ---------- Stats pane ----------
export function buildStatsPane(): void {
  const wipeBtn = $<HTMLButtonElement>('#wipe');
  wipeBtn.addEventListener('click', () => {
    if (!armed(wipeBtn, 'Really erase everything, including Stardust? Click again')) return;
    wipe();
  });

  const box = $<HTMLTextAreaElement>('#saveText');
  $('#exportBtn').addEventListener('click', async () => {
    box.value = exportSave();
    box.select();
    try {
      await navigator.clipboard.writeText(box.value);
      toast('Save copied to clipboard', '#7dffb0');
    } catch {
      toast('Save is in the box below: copy it from there', '#7dffb0');
    }
  });
  const importBtn = $<HTMLButtonElement>('#importBtn');
  importBtn.addEventListener('click', () => {
    let next;
    try { next = parseImport(box.value); }
    catch (e) { toast('Import failed: ' + (e instanceof Error ? e.message : 'invalid save'), '#ff5a6e'); return; }
    if (!armed(importBtn, 'Click again: replaces your current save')) return;
    // A save from another era needs that era's page: reload into it.
    if (next.era !== S.era) { replaceAndReload(next); return; }
    importState(next);
    box.value = '';
    toast('Save imported', '#7dffb0');
  });
  $('#statsBox').addEventListener('click', e => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
    if (!id) return;
    togglePin(id);
    refreshStatsPane();
    refreshPins();
  });
  onRefresh(refreshStatsPane);
}

/** Built once and updated in place, so a click isn't lost to a re-render between press and release. */
const statEls = new Map<string, { name: HTMLElement; val: HTMLElement }>();

export function refreshStatsPane(): void {
  const box = $('#statsBox');
  if (!statEls.size) {
    for (const r of STAT_ROWS) {
      const name = document.createElement('span'), val = document.createElement('span');
      name.className = val.className = 'srow';
      name.dataset.id = val.dataset.id = r.id;
      setText(name, r.label);
      box.append(name, val);
      statEls.set(r.id, { name, val });
    }
  }
  for (const r of STAT_ROWS) {
    const e = statEls.get(r.id)!, on = S.pinned.includes(r.id);
    e.name.classList.toggle('on', on);
    e.val.classList.toggle('on', on);
    setText(e.val, r.value());
  }
}
