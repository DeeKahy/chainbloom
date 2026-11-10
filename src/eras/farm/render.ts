import { TAU } from '../../core/util';
import { S } from '../../state/state';
import { HUES, PLOT_MAX, type Strain } from './content';
import { activeTiles, inPlot, meadow, strainById, targetsOf, tileXY } from './meadow';

/**
 * Canvas 2D drawing of the meadow. A few dozen flowers and a few hundred particles at most, so
 * plain 2D is plenty (the space era needed WebGL for thousands of orbs).
 */

export const view = {
  w: 0, h: 0, dpr: 1,
  /** Screen position of plot tile (0,0) of the full PLOT_MAX grid, and the tile size, in CSS px. */
  x0: 0, y0: 0, tile: 40,
  /** Tile under the pointer (-1 for none), for the pattern preview. */
  hover: -1,
};

let cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D;
let bg: HTMLCanvasElement | null = null;

export function initRender(canvas: HTMLCanvasElement): void {
  cv = canvas;
  ctx = cv.getContext('2d')!;
}

/** Fit the plot in the canvas, leaving room for the HUD at the top. */
export function resize(): void {
  const r = cv.getBoundingClientRect();
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  view.w = r.width; view.h = r.height;
  cv.width = Math.round(r.width * view.dpr);
  cv.height = Math.round(r.height * view.dpr);
  layoutPlot();
  bg = null;
}

export function layoutPlot(): void {
  const n = activeTiles().length ** .5;
  const top = view.h < 500 ? 70 : 96, pad = 14;
  const tile = Math.max(18, Math.min((view.w - pad * 2) / n, (view.h - top - pad) / n, 92));
  const ox = (view.w - tile * n) / 2, oy = top + (view.h - top - pad - tile * n) / 2;
  const off = (PLOT_MAX - n) / 2;
  view.tile = tile;
  view.x0 = ox - off * tile;
  view.y0 = oy - off * tile;
  bg = null;
}

export const tileCenter = (i: number): [number, number] => {
  const [x, y] = tileXY(i);
  return [view.x0 + (x + .5) * view.tile, view.y0 + (y + .5) * view.tile];
};

export function tileFromPoint(px: number, py: number): number {
  const x = Math.floor((px - view.x0) / view.tile), y = Math.floor((py - view.y0) / view.tile);
  if (x < 0 || y < 0 || x >= PLOT_MAX || y >= PLOT_MAX || !inPlot(x, y)) return -1;
  return y * PLOT_MAX + x;
}

// ---------- effects ----------

interface Petal { x: number; y: number; vx: number; vy: number; r: number; spin: number; life: number; max: number; col: string; size: number }
interface Ring { x: number; y: number; t: number; col: string; size: number }
interface Float { x: number; y: number; t: number; text: string; col: string }
interface Gust { y: number; t: number; amp: number }

const petals: Petal[] = [], rings: Ring[] = [], floats: Float[] = [], gusts: Gust[] = [];
/** Seconds since each tile last bloomed (for the squash animation). */
const bloomedAt = new Map<number, number>();
let T = 0;

export function bloomFx(i: number, pay: number, s: Strain, text: string): void {
  const [x, y] = tileCenter(i), col = HUES[s.hue].col;
  bloomedAt.set(i, T);
  rings.push({ x, y, t: 0, col, size: view.tile });
  const n = Math.min(9, 4 + s.pot);
  for (let k = 0; k < n && petals.length < 450; k++) {
    const a = Math.random() * TAU, sp = (30 + Math.random() * 70) * view.tile / 60;
    petals.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, r: Math.random() * TAU, spin: (Math.random() - .5) * 8,
      life: 0, max: 1.1 + Math.random() * .8, col, size: view.tile * (.07 + Math.random() * .05) });
  }
  if (floats.length < 40) floats.push({ x, y: y - view.tile * .3, t: 0, text, col });
  void pay;
}

export function floatText(i: number, text: string, col: string): void {
  const [x, y] = tileCenter(i);
  floats.push({ x, y: y - view.tile * .5, t: 0, text, col });
}

export function gustFx(i: number): void {
  const [, y] = tileCenter(i);
  for (let k = 0; k < 4; k++) gusts.push({ y: y + (k - 1.5) * view.tile * .5, t: -k * .08, amp: 6 + Math.random() * 10 });
}

// ---------- drawing ----------

function drawBackground(): void {
  bg = document.createElement('canvas');
  bg.width = cv.width; bg.height = cv.height;
  const b = bg.getContext('2d')!;
  b.scale(view.dpr, view.dpr);
  const g = b.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, '#fbf3dc');
  g.addColorStop(.35, '#eef0cf');
  g.addColorStop(1, '#cfe3b0');
  b.fillStyle = g;
  b.fillRect(0, 0, view.w, view.h);
  // grass tufts, from a fixed seed so they don't jump on resize
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  b.lineCap = 'round';
  for (let k = 0; k < 160; k++) {
    const x = rnd() * view.w, y = view.h * (.3 + .7 * rnd()), h = 5 + rnd() * 9;
    b.strokeStyle = `rgba(${90 + rnd() * 40 | 0},${140 + rnd() * 40 | 0},${70 + rnd() * 20 | 0},.35)`;
    b.lineWidth = 1.4;
    for (let j = -1; j <= 1; j++) {
      b.beginPath(); b.moveTo(x + j * 2, y); b.quadraticCurveTo(x + j * 3, y - h * .6, x + j * 5, y - h); b.stroke();
    }
  }
  // soil
  const t = view.tile, r = t * .16, gap = Math.max(2, t * .06);
  b.fillStyle = 'rgba(120,90,50,.18)';
  const tiles = activeTiles();
  const [ax, ay] = tileXY(tiles[0]), n = tiles.length ** .5;
  roundRect(b, view.x0 + ax * t - gap * 2, view.y0 + ay * t - gap * 2, n * t + gap * 4, n * t + gap * 4, r * 1.6);
  b.fill();
  for (const i of tiles) {
    const [x, y] = tileXY(i);
    const px = view.x0 + x * t + gap / 2, py = view.y0 + y * t + gap / 2, s = t - gap;
    const sg = b.createLinearGradient(px, py, px, py + s);
    sg.addColorStop(0, '#a98260');
    sg.addColorStop(1, '#8e6a4b');
    b.fillStyle = sg;
    roundRect(b, px, py, s, s, r);
    b.fill();
    b.strokeStyle = 'rgba(70,45,25,.18)';
    b.lineWidth = 1;
    for (let k = 1; k <= 2; k++) { b.beginPath(); b.moveTo(px + s * .18, py + s * k / 3); b.lineTo(px + s * .82, py + s * k / 3); b.stroke(); }
  }
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

const ellipse = (x: number, y: number, rx: number, ry: number, rot: number): void => {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); ctx.fill();
};

/** One flower head, centred on (0,0), radius ~r. */
function head(s: Strain, r: number, open: number): void {
  const h = HUES[s.hue], col = h.col;
  ctx.fillStyle = col;
  switch (s.p) {
    case 'cross': // daisy: many slim petals
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; ellipse(Math.cos(a) * r * .55 * open, Math.sin(a) * r * .55 * open, r * .45 * open, r * .15, a); }
      ctx.fillStyle = s.hue === 0 ? '#c9791c' : '#f2c23a'; ellipse(0, 0, r * .28, r * .28, 0);
      break;
    case 'diag': // poppy: four round petals
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + TAU / 8; ellipse(Math.cos(a) * r * .38 * open, Math.sin(a) * r * .38 * open, r * .48, r * .4 * open + r * .08, a); }
      ctx.fillStyle = '#3b2a2a'; ellipse(0, 0, r * .2, r * .2, 0);
      break;
    case 'row': // tulip: a cup
      ellipse(-r * .3 * open, r * .05, r * .32, r * .58, -.35 * open);
      ellipse(r * .3 * open, r * .05, r * .32, r * .58, .35 * open);
      ctx.fillStyle = h.soft; ellipse(0, 0, r * .3, r * .62, 0);
      ctx.fillStyle = col; ellipse(0, r * .1, r * .26, r * .5, 0);
      break;
    case 'col': // foxglove: three bells down a spike
      for (let k = 0; k < 3; k++) { const y = (k - 1) * r * .62; ellipse(0, y, r * (.26 + k * .06) * (.6 + .4 * open), r * .3, 0); }
      ctx.fillStyle = h.soft; for (let k = 0; k < 3; k++) ellipse(0, (k - 1) * r * .62 + r * .12, r * .1, r * .07, 0);
      break;
    case 'ring': // aster: two layers of fine petals
      for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; ellipse(Math.cos(a) * r * .6 * open, Math.sin(a) * r * .6 * open, r * .38 * open, r * .08, a); }
      ctx.fillStyle = h.soft;
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + .3; ellipse(Math.cos(a) * r * .32 * open, Math.sin(a) * r * .32 * open, r * .24 * open, r * .08, a); }
      ctx.fillStyle = '#e6a92a'; ellipse(0, 0, r * .18, r * .18, 0);
      break;
    case 'knight': // clover: three heart leaves and a small head
      ctx.fillStyle = '#5f9a4a';
      for (let k = 0; k < 3; k++) { const a = k / 3 * TAU - TAU / 4; ellipse(Math.cos(a) * r * .38, Math.sin(a) * r * .38, r * .34, r * .3, a); }
      ctx.fillStyle = col; ellipse(0, 0, r * .3 * (.5 + .5 * open), r * .3 * (.5 + .5 * open), 0);
      break;
    case 'wind': { // dandelion: a puffball
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, r * .05);
      for (let k = 0; k < 18; k++) {
        const a = k / 18 * TAU, l = r * .75 * open;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke();
        ellipse(Math.cos(a) * l, Math.sin(a) * l, r * .08, r * .08, 0);
      }
      ctx.fillStyle = h.soft; ellipse(0, 0, r * .18, r * .18, 0);
      break;
    }
    default: // orchid: five petals and a big lip
      for (let k = 0; k < 4; k++) { const a = k / 4 * TAU - TAU / 8 - TAU / 4; ellipse(Math.cos(a) * r * .4 * open, Math.sin(a) * r * .4 * open, r * .42, r * .2, a); }
      ctx.fillStyle = h.soft; ellipse(0, r * .35 * open, r * .34, r * .3, 0);
      ctx.fillStyle = '#c0397a'; ellipse(0, r * .25 * open, r * .12, r * .1, 0);
  }
}

function drawPlant(i: number, ripeGlow: number): void {
  const p = S.farm.plot[i];
  if (!p) return;
  const s = strainById(p.s);
  if (!s) return;
  const [cx, cy] = tileCenter(i), t = view.tile;
  const g = p.g, ripe = g >= 1;
  const size = t * (.26 + .02 * s.pot);
  const since = T - (bloomedAt.get(i) ?? -9);
  const sway = Math.sin(T * 1.3 + i * 1.7) * .06 * (ripe ? 1 : g);
  const baseY = cy + t * .38;
  ctx.save();
  ctx.translate(cx, baseY);
  ctx.rotate(sway);
  // stem height grows with the plant
  const stemH = t * (.12 + .36 * Math.min(1, g * 1.2));
  ctx.strokeStyle = '#4f8a3c';
  ctx.lineWidth = Math.max(1.5, t * .05);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(t * .05, -stemH * .5, 0, -stemH); ctx.stroke();
  // leaves
  ctx.fillStyle = '#69a84f';
  const leaf = t * .16 * Math.min(1, .4 + g);
  ctx.save(); ctx.translate(0, -stemH * .3); ctx.rotate(-.9); ellipse(leaf * .8, 0, leaf, leaf * .38, 0); ctx.restore();
  ctx.save(); ctx.translate(0, -stemH * .45); ctx.rotate(.9 + Math.PI); ellipse(leaf * .8, 0, leaf, leaf * .38, 0); ctx.restore();
  ctx.translate(0, -stemH);
  if (ripe) {
    // soft halo that breathes, so ripe flowers read at a glance
    const pulse = .5 + .5 * Math.sin(T * 3 + i);
    ctx.fillStyle = `rgba(255,236,150,${.22 + .2 * pulse * ripeGlow})`;
    ellipse(0, 0, size * 1.25, size * 1.25, 0);
    head(s, size, 1);
  } else if (g > .35) {
    // a closed bud that swells and starts to show colour
    const b = (g - .35) / .65;
    ctx.fillStyle = '#5f9a4a';
    ellipse(0, 0, size * (.2 + .2 * b), size * (.32 + .25 * b), 0);
    ctx.fillStyle = HUES[s.hue].col;
    ctx.globalAlpha = b;
    ellipse(0, -size * .1 * b, size * .16 * b + .5, size * .26 * b + .5, 0);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // just bloomed: a squash of the old head
  if (since < .35) {
    ctx.globalAlpha = 1 - since / .35;
    ctx.save(); ctx.translate(cx, baseY - stemH); ctx.scale(1 + since * 2, 1 + since * 2);
    head(s, size, 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // potency pips under the tile
  if (s.pot > 1 && t >= 30) {
    ctx.fillStyle = 'rgba(255,240,190,.85)';
    for (let k = 0; k < s.pot; k++) ellipse(cx + (k - (s.pot - 1) / 2) * t * .1, cy + t * .43, t * .025, t * .025, 0);
  }
}

export function render(dt: number): void {
  T += dt;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  if (!bg) drawBackground();
  ctx.drawImage(bg!, 0, 0, view.w, view.h);
  const tiles = activeTiles();

  // pattern preview for the tile under the pointer
  if (view.hover >= 0) {
    const [hx, hy] = tileCenter(view.hover), t = view.tile;
    ctx.strokeStyle = 'rgba(255,250,230,.8)';
    ctx.lineWidth = 2;
    roundRect(ctx, hx - t / 2 + 2, hy - t / 2 + 2, t - 4, t - 4, t * .16);
    ctx.stroke();
    const p = S.farm.plot[view.hover], s = p && strainById(p.s);
    if (s && s.p !== 'wind' && s.p !== 'seek') {
      ctx.fillStyle = 'rgba(255,214,90,.55)';
      for (const k of targetsOf(view.hover, s)) { const [x, y] = tileCenter(k); ellipse(x, y, t * .1, t * .1, 0); }
    }
  }

  for (const i of tiles) drawPlant(i, 1);

  // pollen in the air: a glowing grain on a low arc, with a short trail
  for (const g of meadow.grains) {
    const [ax, ay] = tileCenter(g.from), [bx, by] = tileCenter(g.to);
    const lift = Math.hypot(bx - ax, by - ay) * .3 + view.tile * .2;
    for (let k = 3; k >= 0; k--) {
      const u = Math.max(0, Math.min(1, (g.t - k * .03) / g.dur));
      const x = ax + (bx - ax) * u, y = ay + (by - ay) * u - Math.sin(u * Math.PI) * lift - view.tile * .2;
      ctx.fillStyle = k ? `rgba(255,214,90,${.35 - k * .08})` : '#ffe27a';
      ellipse(x, y, view.tile * (k ? .05 : .075), view.tile * (k ? .05 : .075), 0);
    }
  }

  for (let k = rings.length - 1; k >= 0; k--) {
    const r = rings[k];
    r.t += dt;
    if (r.t > .6) { rings.splice(k, 1); continue; }
    ctx.strokeStyle = r.col;
    ctx.globalAlpha = .6 * (1 - r.t / .6);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.size * (.2 + r.t * 1.1), 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (let k = petals.length - 1; k >= 0; k--) {
    const p = petals[k];
    p.life += dt;
    if (p.life > p.max) { petals.splice(k, 1); continue; }
    p.vy += 60 * dt; p.vx *= .985; p.vy *= .985;
    p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.spin * dt;
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.fillStyle = p.col;
    ellipse(p.x, p.y, p.size, p.size * .5, p.r);
  }
  ctx.globalAlpha = 1;

  for (let k = gusts.length - 1; k >= 0; k--) {
    const g = gusts[k];
    g.t += dt;
    if (g.t > 1.2) { gusts.splice(k, 1); continue; }
    if (g.t < 0) continue;
    const u = g.t / 1.2, x = -60 + (view.w + 120) * u;
    ctx.strokeStyle = `rgba(255,255,255,${.5 * Math.sin(u * Math.PI)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j <= 10; j++) {
      const px = x - j * 12, py = g.y + Math.sin(j * .7 + T * 4) * g.amp * .3;
      if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.font = `800 ${Math.max(12, Math.min(18, view.tile * .3))}px ui-sans-serif,system-ui,sans-serif`;
  for (let k = floats.length - 1; k >= 0; k--) {
    const f = floats[k];
    f.t += dt;
    if (f.t > 1.1) { floats.splice(k, 1); continue; }
    ctx.globalAlpha = 1 - f.t / 1.1;
    ctx.fillStyle = '#5a3d12';
    ctx.fillText(f.text, f.x + 1, f.y - f.t * 30 + 1);
    ctx.fillStyle = f.col;
    ctx.fillText(f.text, f.x, f.y - f.t * 30);
  }
  ctx.globalAlpha = 1;
}
