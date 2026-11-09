import { initAudio, tone } from '../audio';
import { app } from '../core/app';
import { fmt, replayClass, setClass, setHTML, setText } from '../core/util';
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
  setClass(el, cls);
  setHTML(el, '<div class="row"><span class="nm"></span><span class="lv"></span></div><div class="ds"></div><div class="cost"></div>');
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

/**
 * Levels and total cost the current Buy setting (×1 / ×10 / Max) would buy. Level l costs
 * ceil(base × g^l). ×10 prices the full 10 (capped at max) and buys only if all are affordable;
 * Max buys as many as the balance covers, and shows the next single level when none are.
 */
function currencyCost(u: UpgradeDef, l: number, bal: number): [count: number, cost: number] {
  if (l >= u.max) return [0, 0];
  if (u.free?.(S)) return [1, 0];
  const max = app.buyN === 'max';
  const want = max ? Infinity : +app.buyN;
  let n = 0, c = 0;
  while (l + n < u.max && n < want && n < 500) {
    const next = Math.ceil(u.base * u.g ** (l + n));
    if (max && c + next > bal) break;
    c += next;
    n++;
  }
  return n ? [n, c] : [1, Math.ceil(u.base * u.g ** l)];
}

/** Builds the cards once and returns a refresh function. Follows the shared Buy ×1 / ×10 / Max setting. */
export function currencyShop(o: CurrencyShopOptions): () => void {
  setHTML(o.box, '');
  const cards = new Map<string, Card>();
  for (const u of o.defs) {
    const card = makeCard('up ' + o.cls, el => {
      const lv = o.levels(), l = lv[u.id];
      if (l >= u.max) return;
      const [n, c] = currencyCost(u, l, o.balance());
      if (o.balance() < c) return;
      o.spend(c);
      lv[u.id] += n;
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
      setText(c.nm, u.name);
      setText(c.lv, single ? '' : `Lv ${l}${u.max < 100 ? '/' + u.max : ''}`);
      if (l >= u.max) {
        setClass(c.el, `up ${o.cls} maxed`);
        setText(c.ds, single ? u.desc(0, 1, stat) : 'Maxed');
        setText(c.cost, single ? 'OWNED' : 'MAX');
        continue;
      }
      const [n, cost] = currencyCost(u, l, bal);
      setClass(c.el, `up ${o.cls}` + (bal >= cost ? ' afford' : ''));
      setText(c.ds, u.desc(l, l + n, stat));
      setText(c.cost, cost ? `${fmt(cost)} ${o.unit}` + (n > 1 ? `  (×${n})` : '') : 'FREE');
    }
  };
}

// ---------- money shop (run upgrades, with categories, unlock teasers and Buy ×N) ----------

const runCards = new Map<string, Card>();
let paneUp: HTMLElement;

export function buildRunShop(pane: HTMLElement, onBuy: () => void): void {
  paneUp = pane;
  setHTML(pane, '');
  let cat: string | null = null;
  for (const u of UP) {
    if (u.cat !== cat) {
      cat = u.cat;
      const h = document.createElement('div');
      setClass(h, 'cat');
      setText(h, cat);
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
  const after = u.desc(l - 1, l, stat).split('→')[1];
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
        setClass(c.el, 'up teaser');
        setText(c.nm, '???'); setText(c.lv, ''); setText(c.ds, u.hint || 'Keep going'); setText(c.cost, '');
        catsVisible[u.cat] = true;
      } else c.el.style.display = 'none';
      continue;
    }
    catsVisible[u.cat] = true;
    c.el.style.display = '';
    setText(c.nm, u.name);
    setText(c.lv, u.max < 100 ? `Lv ${l}/${u.max}` : `Lv ${l}`);
    if (l >= u.max) {
      setClass(c.el, 'up maxed');
      setText(c.ds, maxedText(u, l));
      setText(c.cost, 'MAX');
      continue;
    }
    const [n, cost] = costFor(u, l, S.money);
    const afford = S.money >= cost;
    setClass(c.el, 'up' + (afford ? ' afford' : '') + (c.el.classList.contains('flash') ? ' flash' : ''));
    setText(c.ds, u.desc(l, l + n, stat));
    setText(c.cost, '$' + fmt(cost) + (n > 1 ? `  (×${n})` : ''));
  }
  paneUp.querySelectorAll<HTMLElement>('.cat').forEach(h => { h.style.display = catsVisible[h.dataset.cat!] ? '' : 'none'; });
}
