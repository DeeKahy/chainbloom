import { initAudio, tone } from '../audio';
import { fmt, replayClass } from '../core/util';
import type { RunUpgradeDef, UpgradeDef } from '../content/types';
import { UP } from '../content/upgrades';
import { S } from '../state/state';
import { buyRunUpgrade, costFor, isVisible } from '../systems/economy';
import { recalc, stat } from '../systems/stats';
import { toast } from './toast';

interface Card {
  el: HTMLButtonElement;
  nm: HTMLElement;
  lv: HTMLElement;
  ds: HTMLElement;
  cost: HTMLElement;
}

function makeCard(cls: string, onClick: (el: HTMLButtonElement) => void): Card {
  const el = document.createElement('button');
  el.className = cls;
  el.innerHTML = '<div class="row"><span class="nm"></span><span class="lv"></span></div><div class="ds"></div><div class="cost"></div>';
  el.addEventListener('click', () => onClick(el));
  const q = (s: string) => el.querySelector<HTMLElement>(s)!;
  return { el, nm: q('.nm'), lv: q('.lv'), ds: q('.ds'), cost: q('.cost') };
}

// ---------- generic currency shop (Stardust, Dark Matter, and future layers) ----------

export interface CurrencyShopOptions {
  box: HTMLElement;
  defs: UpgradeDef[];
  /** Level map in the save, e.g. S.st */
  levels: () => Record<string, number>;
  balance: () => number;
  spend: (n: number) => void;
  /** Extra class for the card (colours the affordable state). */
  cls: string;
  unit: string;
  sound: [f: number, dur: number, endF: number];
  onBuy: () => void;
}

/** Builds the cards once and returns a refresh function. Cost of level l is ceil(base * g^l). */
export function currencyShop(o: CurrencyShopOptions): () => void {
  o.box.innerHTML = '';
  const cards = new Map<string, Card>();
  for (const u of o.defs) {
    const card = makeCard('up ' + o.cls, el => {
      const lv = o.levels(), l = lv[u.id];
      if (l >= u.max) return;
      const c = Math.ceil(u.base * u.g ** l);
      if (o.balance() < c) return;
      o.spend(c);
      lv[u.id]++;
      recalc();
      replayClass(el, 'flash');
      initAudio();
      tone(o.sound[0], o.sound[1], .07, 'triangle', o.sound[2]);
      o.onBuy();
    });
    o.box.appendChild(card.el);
    cards.set(u.id, card);
  }
  return () => {
    const lv = o.levels(), bal = o.balance();
    for (const u of o.defs) {
      const c = cards.get(u.id)!, l = lv[u.id];
      const single = u.max === 1;
      c.nm.textContent = u.name;
      c.lv.textContent = single ? '' : `Lv ${l}${u.max < 100 ? '/' + u.max : ''}`;
      if (l >= u.max) {
        c.el.className = `up ${o.cls} maxed`;
        c.ds.textContent = single ? u.desc(0, stat) : 'Maxed';
        c.cost.textContent = single ? 'OWNED' : 'MAX';
        continue;
      }
      const cost = Math.ceil(u.base * u.g ** l);
      c.el.className = `up ${o.cls}` + (bal >= cost ? ' afford' : '');
      c.ds.textContent = u.desc(l, stat);
      c.cost.textContent = `${fmt(cost)} ${o.unit}`;
    }
  };
}

// ---------- money shop (run upgrades, with categories, unlock teasers and Buy ×N) ----------

const runCards = new Map<string, Card>();
let paneUp: HTMLElement;

export function buildRunShop(pane: HTMLElement, onBuy: () => void): void {
  paneUp = pane;
  pane.innerHTML = '';
  let cat: string | null = null;
  for (const u of UP) {
    if (u.cat !== cat) {
      cat = u.cat;
      const h = document.createElement('div');
      h.className = 'cat';
      h.textContent = cat;
      h.dataset.cat = cat;
      pane.appendChild(h);
    }
    const card = makeCard('up', el => {
      if (!buyRunUpgrade(u)) return;
      replayClass(el, 'flash');
      initAudio();
      tone(660, .12, .06, 'triangle', 990);
      onBuy();
    });
    pane.appendChild(card.el);
    runCards.set(u.id, card);
  }
}

function maxedText(u: RunUpgradeDef, l: number): string {
  const after = u.desc(l - 1, stat).split('→')[1];
  return after ? 'Maxed: ' + after.trim() : 'Maxed';
}

export function refreshRunShop(): void {
  let teaserShown = false;
  const catsVisible: Record<string, boolean> = {};
  for (const u of UP) {
    const c = runCards.get(u.id)!, l = S.lv[u.id];
    const vis = isVisible(u);
    if (vis && !S.seen.includes(u.id)) {
      S.seen.push(u.id);
      if (u.unlock && S.playTime > 1) toast('Unlocked: ' + u.name, '#7dffb0');
    }
    if (!vis) {
      // Show only the next locked upgrade, as a "???" teaser with its hint.
      if (!teaserShown) {
        teaserShown = true;
        c.el.style.display = '';
        c.el.className = 'up teaser';
        c.nm.textContent = '???'; c.lv.textContent = ''; c.ds.textContent = u.hint || 'Keep going'; c.cost.textContent = '';
        catsVisible[u.cat] = true;
      } else c.el.style.display = 'none';
      continue;
    }
    catsVisible[u.cat] = true;
    c.el.style.display = '';
    c.nm.textContent = u.name;
    c.lv.textContent = u.max < 100 ? `Lv ${l}/${u.max}` : `Lv ${l}`;
    if (l >= u.max) {
      c.el.className = 'up maxed';
      c.ds.textContent = maxedText(u, l);
      c.cost.textContent = 'MAX';
      continue;
    }
    const [n, cost] = costFor(u, l, S.money);
    const afford = S.money >= cost;
    c.el.className = 'up' + (afford ? ' afford' : '') + (c.el.classList.contains('flash') ? ' flash' : '');
    c.ds.textContent = u.desc(l, stat);
    c.cost.textContent = '$' + fmt(cost) + (n > 1 ? `  (×${n})` : '');
  }
  paneUp.querySelectorAll<HTMLElement>('.cat').forEach(h => { h.style.display = catsVisible[h.dataset.cat!] ? '' : 'none'; });
}
