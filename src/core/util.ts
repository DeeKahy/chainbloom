export const TAU = Math.PI * 2;

export const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/** querySelector that throws early instead of returning null, so a typo in an id fails loudly. */
export function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
}

export const $$ = <T extends HTMLElement = HTMLElement>(sel: string): T[] =>
  Array.from(document.querySelectorAll<T>(sel));

const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return (n < 10 && n % 1) ? n.toFixed(1) : Math.floor(n).toString();
  const e = Math.floor(Math.log10(n) / 3);
  if (e < SUF.length) {
    const v = n / Math.pow(10, e * 3);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + SUF[e];
  }
  return n.toExponential(2).replace('+', '');
}

/** Restart a CSS animation class on an element. */
export function replayClass(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// The HUD and panes refresh ~8×/sec. Writing the same text or class again still makes the browser
// redo style and layout for the side panel, which is slow on phones, so writes go through these.
const htmlCache = new WeakMap<HTMLElement, string>();

export function setText(el: HTMLElement, s: string): void {
  htmlCache.delete(el);
  if (el.textContent !== s) el.textContent = s;
}

export function setHTML(el: HTMLElement, s: string): void {
  if (htmlCache.get(el) === s) return;
  htmlCache.set(el, s);
  el.innerHTML = s;
}

export function setClass(el: HTMLElement, s: string): void {
  if (el.className !== s) el.className = s;
}
