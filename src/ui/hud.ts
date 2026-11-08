import { app, onRefresh, type BuyAmount, type Tab } from '../core/app';
import { $, $$, fmt, replayClass, setText } from '../core/util';
import { riftById } from '../content/rifts';
import { hooks } from '../sim/world';
import { S } from '../state/state';
import { rateAvg } from '../systems/economy';
import { colGain, novaGain } from '../systems/prestige';
import { refreshCollapsePane, refreshNovaPane, refreshStatsPane } from './panes';
import { refreshPalette, setView } from './palette';
import { refreshPins } from './pins';
import { refreshRunShop } from './shop';
import { toast } from './toast';

const el = {
  money: $('#money'), rate: $('#rate'), ready: $('#ready'), riftHud: $('#riftHud'), combo: $('#combo'),
  novaTab: $('#novaTab'), colTab: $('#colTab'), viewBtns: $('#viewBtns'), autoBuyRow: $('#autoBuyRow'),
  autoBuy: $<HTMLInputElement>('#autoBuy'), mute: $('#mute'), buyamt: $('#buyamt'),
};

let dispMoney = 0;

/** Big "N CHAIN" banner for long chains. */
hooks.banner = count => {
  const c = el.combo;
  setText(c, count + ' CHAIN');
  c.style.color = count >= 200 ? '#ffd34d' : count >= 60 ? '#ff7ab8' : count >= 30 ? '#b98bff' : '#6ee7ff';
  c.style.textShadow = `0 0 30px ${c.style.color}`;
  replayClass(c, 'go');
};

function selectTab(t: Tab): void {
  app.tab = t;
  $$('#tabs button[data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === t));
  $$('.pane').forEach(p => { p.hidden = p.id !== 'pane-' + t; });
  el.buyamt.style.visibility = t === 'up' ? '' : 'hidden';
  refreshVisibleTab();
}

const setMuteLabel = () => { el.mute.textContent = S.mute ? '♪ Off' : '♪ On'; };

export function buildHud(): void {
  dispMoney = S.money;
  $$('#tabs button[data-t]').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.t as Tab)));
  $$('#buyamt button').forEach(b => b.addEventListener('click', () => {
    app.buyN = b.dataset.n as BuyAmount;
    $$('#buyamt button').forEach(x => x.classList.toggle('on', x === b));
    refreshRunShop();
  }));
  el.autoBuy.addEventListener('change', () => { S.autoBuy = el.autoBuy.checked; });
  el.mute.addEventListener('click', () => { S.mute = !S.mute; setMuteLabel(); });
  onRefresh(() => {
    el.autoBuy.checked = S.autoBuy;
    setMuteLabel();
    // After a wipe the higher layers disappear again.
    if (!S.collapses && app.view === 'board') setView('orbs');
    if (S.runEarned < 2.5e5 && !S.novas) el.novaTab.hidden = true;
    if (S.starsCycle < 300 && !S.collapses) el.colTab.hidden = true;
    if (el.novaTab.hidden && app.tab === 'nova' || el.colTab.hidden && app.tab === 'col') selectTab('up');
    refreshRunShop();
  });
}

export function refreshVisibleTab(): void {
  if (app.tab === 'up') refreshRunShop();
  if (app.tab === 'nova') refreshNovaPane();
  if (app.tab === 'col') refreshCollapsePane();
  if (app.tab === 'stats') refreshStatsPane();
}

/** Every frame: animate the money counter toward its real value. */
export function frameHud(dt: number): void {
  dispMoney += (S.money - dispMoney) * Math.min(1, dt * 10);
  if (Math.abs(S.money - dispMoney) < .5) dispMoney = S.money;
  setText(el.money, '$' + fmt(dispMoney));
}

/** ~8×/sec: text, unlock reveals and the visible pane. */
export function tickHud(): void {
  setText(el.rate, '$' + fmt(rateAvg()) + ' / sec');
  refreshPins();
  el.autoBuyRow.hidden = !S.dl.auto;
  const R = S.rift ? riftById(S.rift) : undefined;
  setText(el.riftHud, R ? `${R.name} · $${fmt(S.runEarned)} / $${fmt(R.goal)}` : '');
  refreshVisibleTab();
  if (app.view === 'board') refreshPalette();

  const showNova = S.runEarned >= 2.5e5 || S.novas > 0;
  if (showNova && el.novaTab.hidden) {
    el.novaTab.hidden = false;
    if (S.playTime > 1) toast('Supernova unlocked', '#ffd34d');
  }
  if ((S.starsCycle >= 300 || S.collapses > 0) && el.colTab.hidden) {
    el.colTab.hidden = false;
    if (S.playTime > 1) toast('Collapse unlocked', '#c9a6ff');
  }
  el.viewBtns.hidden = !S.collapses;

  const cg = colGain() > 0;
  setText(el.ready, cg ? '◆ Collapse ready ◆' : '✦ Supernova ready ✦');
  el.ready.style.color = cg ? '#c9a6ff' : '';
  el.ready.classList.toggle('on', cg || novaGain() > 0);
}
