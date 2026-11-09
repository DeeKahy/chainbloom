import { app, onRefresh, type BuyAmount, type Tab } from '../core/app';
import { $, $$, fmt, replayClass, setHTML, setText } from '../core/util';
import { riftById } from '../content/rifts';
import { hooks, multiverseOn, world } from '../sim/world';
import { layout, setLayout } from '../render/canvas';
import { NORMALS } from '../render/sprites';
import { S } from '../state/state';
import { rateAvg } from '../systems/economy';
import { colGain, collapseComplete, mvGain, novaGain, singGain, singularityComplete } from '../systems/prestige';
import { stat } from '../systems/stats';
import { refreshCollapsePane, refreshMultiversePane, refreshNovaPane, refreshSingPane, refreshStatsPane } from './panes';
import { refreshPalette, setView } from './palette';
import { refreshPins } from './pins';
import { refreshRunShop } from './shop';
import { toast } from './toast';

const el = {
  money: $('#money'), rate: $('#rate'), ready: $('#ready'), riftHud: $('#riftHud'), combo: $('#combo'),
  novaTab: $('#novaTab'), colTab: $('#colTab'), singTab: $('#singTab'), mvTab: $('#mvTab'), melodyHud: $('#melodyHud'), uniBtn: $('#uniBtn'), dilHud: $('#dilHud'), viewBtns: $('#viewBtns'), autoBuyRow: $('#autoBuyRow'),
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
  // Buy ×1 / ×10 / Max applies to every shop tab; the Autobuy checkbox only to Upgrades
  el.buyamt.style.visibility = t === 'stats' ? 'hidden' : '';
  el.autoBuyRow.hidden = !S.dl.auto || t !== 'up';
  refreshVisibleTab();
}

const setMuteLabel = () => { el.mute.textContent = S.mute ? '♪ Off' : '♪ On'; };

export function buildHud(): void {
  dispMoney = S.money;
  $$('#tabs button[data-t]').forEach(b => b.addEventListener('click', () => selectTab(b.dataset.t as Tab)));
  $$('#buyamt button').forEach(b => b.addEventListener('click', () => {
    app.buyN = b.dataset.n as BuyAmount;
    $$('#buyamt button').forEach(x => x.classList.toggle('on', x === b));
    refreshVisibleTab();
  }));
  el.autoBuy.addEventListener('change', () => { S.autoBuy = el.autoBuy.checked; });
  el.mute.addEventListener('click', () => { S.mute = !S.mute; setMuteLabel(); });
  el.uniBtn.addEventListener('click', () => setLayout(true, layout.focus ? 0 : 1));
  onRefresh(() => {
    el.autoBuy.checked = S.autoBuy;
    setMuteLabel();
    // After a wipe the higher layers disappear again.
    if (!S.collapses && app.view === 'board') setView('orbs');
    if (S.runEarned < 2.5e5 && !S.novas) el.novaTab.hidden = true;
    if (S.starsCycle < 300 && !S.collapses) el.colTab.hidden = true;
    if (!collapseComplete() && !S.singularities) el.singTab.hidden = true;
    if (!singularityComplete() && !S.multiverses) el.mvTab.hidden = true;
    if (el.novaTab.hidden && app.tab === 'nova' || el.colTab.hidden && app.tab === 'col' || el.singTab.hidden && app.tab === 'sing' || el.mvTab.hidden && app.tab === 'mv') selectTab('up');
    refreshRunShop();
  });
}

export function refreshVisibleTab(): void {
  if (app.tab === 'up') refreshRunShop();
  if (app.tab === 'nova') refreshNovaPane();
  if (app.tab === 'col') refreshCollapsePane();
  if (app.tab === 'sing') refreshSingPane();
  if (app.tab === 'mv') refreshMultiversePane();
  if (app.tab === 'stats') refreshStatsPane();
}

/** Every frame: animate the money counter toward its real value. */
export function frameHud(dt: number): void {
  // Ease toward the real value, but jump across big gaps (a reset, or a huge payout): easing
  // linearly across 100 orders of magnitude would take half a minute.
  if (S.money > dispMoney * 100 || S.money < dispMoney / 100) dispMoney = S.money;
  dispMoney += (S.money - dispMoney) * Math.min(1, dt * 10);
  if (Math.abs(S.money - dispMoney) < .5) dispMoney = S.money;
  setText(el.money, '$' + fmt(dispMoney));
}

/** ~8×/sec: text, unlock reveals and the visible pane. */
export function tickHud(): void {
  setText(el.rate, '$' + fmt(rateAvg()) + ' / sec');
  refreshPins();
  el.autoBuyRow.hidden = !S.dl.auto || app.tab !== 'up';
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
  if ((collapseComplete() || S.singularities > 0) && el.singTab.hidden) {
    el.singTab.hidden = false;
    if (S.playTime > 1) toast('Singularity unlocked', '#ffb35c');
  }
  el.viewBtns.hidden = !S.collapses;
  if ((singularityComplete() || S.multiverses > 0) && el.mvTab.hidden) {
    el.mvTab.hidden = false;
    if (S.playTime > 1) toast('Multiverse unlocked', '#7fd4ff');
  }
  // Multiverse: the view buttons show from the start, and a phone gets a switch between universes
  if (multiverseOn()) el.viewBtns.hidden = false;
  el.uniBtn.hidden = !multiverseOn() || layout.split || app.view !== 'orbs';
  setText(el.uniBtn, layout.focus ? '⇄ A' : '⇄ B');
  // Melody: the five target colours
  el.melodyHud.hidden = !S.tl.melody || app.view !== 'orbs';
  if (!el.melodyHud.hidden) setHTML(el.melodyHud, '♫ ' + [...S.melody].map(n => `<i style="background:${NORMALS[+n].rgb};color:${NORMALS[+n].rgb}"></i>`).join(''));

  // dilation and the black hole's flare
  if (stat.hole) {
    const flare = world.flareT > 0;
    const d = Math.min(1, stat.dilation + (flare ? stat.flareBonus : 0));
    setText(el.dilHud, flare ? `✸ Flare · dilation ^${d.toFixed(2)} · ${Math.ceil(world.flareT)}s`
      : `Dilation ^${d.toFixed(2)} · mass ${Math.floor(world.mass / stat.massCap * 100)}%`);
    el.dilHud.classList.toggle('flare', flare);
  } else setText(el.dilHud, '');

  const mg = mvGain() > 0, sg = singGain() > 0, cg = colGain() > 0;
  setText(el.ready, mg ? '❖ Multiverse ready ❖' : sg ? '◉ Singularity ready ◉' : cg ? '◆ Collapse ready ◆' : '✦ Supernova ready ✦');
  el.ready.style.color = mg ? '#7fd4ff' : sg ? '#ffb35c' : cg ? '#c9a6ff' : '';
  el.ready.classList.toggle('on', mg || sg || cg || novaGain() > 0);
}

hooks.flare = () => toast('✸ Flare! Dilation eases for a while: chain hard now.', '#ffb35c');
hooks.melody = bonus => toast(`♫ Melody! The chain paid ×${stat.melodyMult}: +$${fmt(bonus)}. A new melody plays next.`, '#7dffb0');
