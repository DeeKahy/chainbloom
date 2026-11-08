import { onRefresh } from '../core/app';
import { $, fmt } from '../core/util';
import { DU, SU } from '../content/prestige';
import { AUTO_NOVA_RIFT, RIFTS } from '../content/rifts';
import { refreshPins } from './pins';
import { STAT_ROWS, togglePin } from './statRows';
import type { RiftDef } from '../content/types';
import { exportSave, parseImport } from '../state/save';
import { S } from '../state/state';
import {
  colGain, COLLAPSE_MIN, doCollapse, doNova, enterRift, importState, leaveRift, nextNovaAt, novaGain, wipe,
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
  onRefresh(refreshNovaPane);
}

export function refreshNovaPane(): void {
  $('#sdCount').textContent = fmt(S.stardust);
  const g = novaGain();
  const pct = Math.min(1, Math.log10(Math.max(1, S.runEarned)) / 6);
  $('#novaBar').style.width = (g ? 100 : pct * 100) + '%';
  $('#autoNovaRow').hidden = !S.riftsDone.includes(AUTO_NOVA_RIFT);
  $<HTMLInputElement>('#autoNova').checked = S.autoNova;
  const info = $('#novaInfo');
  if (S.rift) info.textContent = 'Supernova is blocked while you are inside a Rift.';
  else if (g) info.innerHTML = `Supernova now for <b style="color:var(--gold)">+${fmt(g)} ✦</b> · next ✦ at $${fmt(nextNovaAt(g))}`;
  else info.textContent = `$${fmt(S.runEarned)} / $1M earned this run`;
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
  rl.innerHTML = '';
  for (const R of RIFTS) {
    const d = document.createElement('div');
    d.className = 'up rift';
    d.innerHTML = `<div class="row"><span class="nm">${R.name}</span><span class="lv"></span></div>
      <div class="ds">${R.rule}<br>Goal: earn $${fmt(R.goal)} in the rift. Reward: <b style="color:#e3d4ff">${R.reward}</b></div>
      <button class="rbtn"></button>`;
    const btn = d.querySelector<HTMLButtonElement>('.rbtn')!;
    btn.addEventListener('click', () => onRiftClick(R, btn));
    riftEls.set(R.id, { el: d, btn, lv: d.querySelector<HTMLElement>('.lv')! });
    rl.appendChild(d);
  }
  const colBtn = $<HTMLButtonElement>('#colBtn');
  colBtn.addEventListener('click', () => {
    if (!colGain()) return;
    if (!armed(colBtn, 'Click again: this resets Stardust too')) return;
    doCollapse();
  });
  onRefresh(refreshCollapsePane);
}

export function refreshCollapsePane(): void {
  $('#dmCount').textContent = fmt(S.dm);
  const g = colGain();
  $('#colBar').style.width = Math.min(100, S.starsCycle / COLLAPSE_MIN * 100) + '%';
  $('#colInfo').innerHTML = S.rift ? 'Collapse is blocked while you are inside a Rift.' :
    g ? `Collapse now for <b style="color:#c9a6ff">+${fmt(g)} ◆</b>` : `${fmt(S.starsCycle)} / ${fmt(COLLAPSE_MIN)} Stardust earned since last Collapse`;
  $<HTMLButtonElement>('#colBtn').disabled = !g;
  refreshDarkShop();
  const showR = S.collapses > 0;
  $('#riftCat').hidden = !showR; $('#riftHelp').hidden = !showR; $('#riftList').hidden = !showR;
  for (const R of RIFTS) {
    const r = riftEls.get(R.id)!;
    const done = S.riftsDone.includes(R.id), act = S.rift === R.id;
    r.el.className = 'up rift' + (done ? ' done' : '') + (act ? ' active' : '');
    r.lv.textContent = done ? 'Sealed ✓' : act ? `$${fmt(S.runEarned)} / $${fmt(R.goal)}` : '';
    r.btn.style.display = done ? 'none' : '';
    if (!r.btn.dataset.armed) r.btn.textContent = act ? 'Abandon rift' : 'Enter rift';
  }
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
      name.textContent = r.label;
      box.append(name, val);
      statEls.set(r.id, { name, val });
    }
  }
  for (const r of STAT_ROWS) {
    const e = statEls.get(r.id)!, on = S.pinned.includes(r.id);
    e.name.classList.toggle('on', on);
    e.val.classList.toggle('on', on);
    e.val.textContent = r.value();
  }
}
