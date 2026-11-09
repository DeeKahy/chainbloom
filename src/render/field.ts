import { clock } from '../core/app';
import { TAU } from '../core/util';
import { LAWS } from '../content/multiverse';
import { BlastKind, gate, HOLE_CORE, HOLE_FEED, multiverseOn, useWorld, WELL_GLOW, world, worlds, type World } from '../sim/world';
import { S } from '../state/state';
import { stat } from '../systems/stats';
import { ctx, field, size, type View } from './canvas';
import { colorOf, CRY, WHITE } from './sprites';
import { renderFieldGL } from './fieldGL';

const FONT = 'ui-sans-serif,system-ui,sans-serif';

/** Smallest on-screen orb sprite in CSS pixels, so orbs stay visible on a phone. */
const MIN_ORB_PX = 16;

/** Full-canvas flash (the Constellation board). */
export function drawFlash(): void {
  if (world.flash > 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${world.flashCol},${world.flash})`;
    ctx.fillRect(0, 0, size.W, size.H);
  }
}

/** The universes on screen right now (B only from the first Multiverse on). */
const shownWorlds = (): World[] => worlds.filter(w => w.view.visible && (w.index === 0 || multiverseOn()));

function flashIn(v: View): void {
  if (world.flash <= 0) return;
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(${world.flashCol},${world.flash})`;
  ctx.fillRect(v.x, v.y, v.w, v.h);
}

/** Canvas 2D fallback: each universe in its rectangle, in world units under one scale transform. */
export function renderField(): void {
  for (const w of shownWorlds()) {
    useWorld(w);
    const v = w.view;
    ctx.save();
    ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
    ctx.translate(v.x, v.y);
    drawWorld2D(v);
    ctx.restore();
    flashIn(v);
  }
  useWorld(worlds[0]);
  drawLinks();
}

function drawWorld2D(v: View): void {
  const { scale } = field, T = clock.T;
  // Lines and dots are thickened when the field is scaled down, so they don't vanish on a phone.
  const thick = Math.max(1, .7 / scale);
  const minOrb = MIN_ORB_PX / scale;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Translucent clear leaves motion trails.
  ctx.fillStyle = 'rgba(6,7,13,0.34)';
  ctx.fillRect(0, 0, v.w, v.h);
  ctx.save();
  if (world.shake > .1) ctx.translate((Math.random() - .5) * world.shake, (Math.random() - .5) * world.shake);
  ctx.save();
  ctx.scale(scale, scale);
  // wells
  for (const w of world.wells) {
    const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, WELL_GLOW);
    g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(.25, 'rgba(60,30,110,.35)'); g.addColorStop(1, 'rgba(60,30,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, WELL_GLOW, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(185,139,255,.35)'; ctx.lineWidth = 1.5 * thick;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(w.x, w.y, 22 + k * 14, w.a * (2 - k * .5) + k, w.a * (2 - k * .5) + k + 2.2); ctx.stroke();
    }
  }

  // black hole (layer 4): the same layers as the WebGL shader, simplified
  if (stat.hole) {
    const hx = field.W / 2, hy = field.H / 2, flare = world.flareT > 0 ? 1 : 0, core = HOLE_CORE;
    let g = ctx.createRadialGradient(hx, hy, core, hx, hy, HOLE_FEED);
    g.addColorStop(0, `rgba(255,140,50,${.12 + .14 * flare})`); g.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, HOLE_FEED, 0, TAU); ctx.fill();
    g = ctx.createRadialGradient(hx, hy, core, hx, hy, core + 80);
    g.addColorStop(0, `rgba(255,240,215,${.5 + .5 * flare})`); g.addColorStop(.4, `rgba(255,120,40,${.3 + .3 * flare})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, core + 80, 0, TAU); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(hx, hy, core, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,153,.8)'; ctx.lineWidth = 2 * thick;
    ctx.beginPath(); ctx.arc(hx, hy, core + 1.5, 0, TAU); ctx.stroke();
    ctx.lineWidth = 2.5 * thick;
    ctx.strokeStyle = 'rgba(255,178,90,.14)'; ctx.beginPath(); ctx.arc(hx, hy, core + 104, 0, TAU); ctx.stroke();
    const m = world.mass / stat.massCap;
    if (m > 0) {
      ctx.strokeStyle = 'rgba(255,178,90,.9)'; ctx.beginPath();
      ctx.arc(hx, hy, core + 104, -Math.PI / 2, -Math.PI / 2 + m * TAU); ctx.stroke();
    }
  }

  ctx.globalCompositeOperation = 'lighter';

  // crystals
  if (world.crystals.length) {
    ctx.strokeStyle = 'rgba(150,220,255,.35)'; ctx.lineWidth = 1.2 * thick;
    ctx.beginPath();
    for (const c of world.crystals) for (const a of c.adj) if (a.state !== 2 && a.id < c.id) { ctx.moveTo(c.x, c.y); ctx.lineTo(a.x, a.y); }
    ctx.stroke();
    for (const c of world.crystals) {
      const s = (c.state === 1 ? 5 : 2.4 * Math.min(1, (T - c.born) * 3)) * thick;
      ctx.fillStyle = c.state === 1 ? '#fff' : CRY;
      ctx.beginPath(); ctx.moveTo(c.x, c.y - s); ctx.lineTo(c.x + s, c.y); ctx.lineTo(c.x, c.y + s); ctx.lineTo(c.x - s, c.y); ctx.fill();
    }
  }

  // orbs
  for (const o of world.orbs) {
    const grow = Math.min(1, (T - o.born) * 4);
    let s = Math.max(o.r * 3.6, minOrb) * grow, spr = colorOf(o).spr;
    if (o.crit) { s *= 1 + (.7 - o.crit) * .9; if ((o.crit * 20 | 0) % 2) spr = WHITE.spr; }
    if (o.type === 1) s *= 1 + .08 * Math.sin(T * 6 + o.x);
    ctx.drawImage(spr, o.x - s / 2, o.y - s / 2, s, s);
  }

  // blasts
  for (const b of world.blasts) {
    const p = Math.min(1, b.age / b.dur), fade = b.age > b.dur ? 1 - (b.age - b.dur) / .35 : 1;
    const hue = b.kind === BlastKind.Volatile ? 350 : b.kind === BlastKind.Crystal ? 195 : b.kind === BlastKind.Drone ? 45
      : b.kind === BlastKind.Mirror ? 275 : 190 + b.depth * 28;
    ctx.globalAlpha = Math.max(0, fade) * (b.kind === BlastKind.Crystal ? .4 : .85);
    ctx.strokeStyle = `hsl(${hue},100%,${b.kind === BlastKind.Drone ? 70 : 65}%)`;
    ctx.lineWidth = (b.kind === BlastKind.Volatile ? 4 : 2.4) * (1.4 - p * .6) * thick;
    const br = Math.max(.1, b.r);
    ctx.beginPath();
    if (b.sq) ctx.rect(b.x - br, b.y - br, br * 2, br * 2); else ctx.arc(b.x, b.y, br, 0, TAU);
    ctx.stroke();
    if (p < 1) {
      ctx.globalAlpha = .12 * (1 - p);
      ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // drone beams
  for (const b of world.beams) {
    ctx.globalAlpha = b.life / .2;
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2 * thick;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
  }

  // particles
  for (const p of world.parts) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.c;
    const sz = p.sz * thick;
    ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;

  // entangled orbs wear a thin violet ring
  ctx.strokeStyle = 'rgba(201,166,255,.7)'; ctx.lineWidth = 1.2 * thick;
  for (const o of world.orbs) if (o.twin) { ctx.beginPath(); ctx.arc(o.x, o.y, Math.max(o.r * 3.6, minOrb) * .42, 0, TAU); ctx.stroke(); }

  // the bridge
  if (multiverseOn()) {
    const g = gate(world), h = stat.portalSpan / 2;
    const cx = g.x - g.nx * 2, cy = g.y - g.ny * 2;
    // a band of width w across the edge, the gate's span along it
    const band = (w: number): void => g.nx ? ctx.fillRect(cx - w / 2, cy - h, w, h * 2) : ctx.fillRect(cx - h, cy - w / 2, h * 2, w);
    const glow = .55 + .2 * Math.sin(T * 3) + .7 * world.portalFlash;
    ctx.globalAlpha = Math.min(1, glow * .12); ctx.fillStyle = '#7fd4ff'; band(46 * thick);
    ctx.globalAlpha = Math.min(1, glow * .35); band(16 * thick);
    ctx.globalAlpha = Math.min(1, glow); ctx.fillStyle = '#e6f7ff'; band(3.5 * thick);
    for (const s of [-h, h]) { ctx.beginPath(); ctx.arc(cx + (g.nx ? 0 : s), cy + (g.nx ? s : 0), 3.5 * thick, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  drawFieldOverlay(v);
  ctx.restore();
}

/** WebGL path: each universe on the GL canvas, and only drones, texts and the flash on the 2D canvas above it. */
export function renderFieldWithGL(): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, size.W, size.H);
  for (const w of shownWorlds()) {
    useWorld(w);
    const v = w.view;
    const sx = world.shake > .1 ? (Math.random() - .5) * world.shake : 0;
    const sy = world.shake > .1 ? (Math.random() - .5) * world.shake : 0;
    renderFieldGL(v, sx, sy);
    ctx.save();
    ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
    ctx.translate(v.x + sx, v.y + sy);
    drawFieldOverlay(v);
    ctx.restore();
    flashIn(v);
  }
  useWorld(worlds[0]);
  drawLinks();
}

/**
 * Across both universes: faint threads between entangled twins (only when both are on screen),
 * and a label naming each universe and its Law.
 */
function drawLinks(): void {
  if (!multiverseOn()) return;
  const [a, b] = worlds;
  if (a.view.visible && b.view.visible) {
    ctx.strokeStyle = 'rgba(201,166,255,.13)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const o of a.orbs) {
      const t = o.twin;
      if (!t || t.dead) continue;
      ctx.moveTo(a.view.x + o.x * a.view.scale, a.view.y + o.y * a.view.scale);
      ctx.lineTo(b.view.x + t.x * b.view.scale, b.view.y + t.y * b.view.scale);
    }
    ctx.stroke();
  }
  ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  for (const w of shownWorlds()) {
    const law = LAWS.find(l => l.id === S.laws[w.index]);
    ctx.fillStyle = 'rgba(127,212,255,.55)';
    ctx.fillText(`Universe ${w.index ? 'B' : 'A'}${law ? ' · ' + law.name : ''}`, w.view.x + 10, w.view.y + w.view.h - 8);
  }
}
/** Drones used shadowBlur every frame, which Firefox renders very slowly; draw the glowing drone once and stamp it. */
const DRONE_HALF = 24;
let droneImg: HTMLCanvasElement | null = null, droneDPR = 0;

function droneSprite(): HTMLCanvasElement {
  if (droneImg && droneDPR === size.DPR) return droneImg;
  droneDPR = size.DPR;
  droneImg = document.createElement('canvas');
  droneImg.width = droneImg.height = DRONE_HALF * 2 * droneDPR;
  const c = droneImg.getContext('2d')!;
  c.setTransform(droneDPR, 0, 0, droneDPR, DRONE_HALF * droneDPR, DRONE_HALF * droneDPR);
  c.fillStyle = '#ffd34d'; c.shadowColor = '#ffd34d'; c.shadowBlur = 10 * droneDPR;
  c.beginPath(); c.moveTo(9, 0); c.lineTo(-6, -6); c.lineTo(-3, 0); c.lineTo(-6, 6); c.fill();
  return droneImg;
}


/** Drones, payout texts and the first-run hint, in screen pixels at world positions so they stay readable. */
function drawFieldOverlay(v: View): void {
  const { W, H, scale } = field, T = clock.T;
  ctx.globalCompositeOperation = 'source-over';
  for (const d of world.drones) {
    const ready = 1 - Math.max(0, d.t) / stat.interval;
    const x = d.x * scale, y = d.y * scale;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(H / 2 - d.y, W / 2 - d.x));
    ctx.drawImage(droneSprite(), -DRONE_HALF, -DRONE_HALF, DRONE_HALF * 2, DRONE_HALF * 2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,211,77,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + ready * TAU); ctx.stroke();
  }

  // floating payout texts
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of world.texts) {
    ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
    ctx.font = `800 ${t.size | 0}px ${FONT}`;
    ctx.fillStyle = t.c;
    ctx.fillText(t.t, t.x * scale, t.y * scale);
  }
  ctx.globalAlpha = 1;

  if (S.total < 3) {
    ctx.fillStyle = `rgba(232,236,255,${.35 + .2 * Math.sin(T * 3)})`;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('Click to detonate', v.w / 2, v.h / 2 + 40);
  }
}
