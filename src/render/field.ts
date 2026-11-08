import { clock } from '../core/app';
import { TAU } from '../core/util';
import { world, BlastKind } from '../sim/world';
import { S } from '../state/state';
import { stat } from '../systems/stats';
import { ctx, size } from './canvas';
import { colorOf, CRY, WHITE } from './sprites';

const FONT = 'ui-sans-serif,system-ui,sans-serif';

export function drawFlash(): void {
  if (world.flash > 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${world.flashCol},${world.flash})`;
    ctx.fillRect(0, 0, size.W, size.H);
  }
}

export function renderField(): void {
  const { W, H } = size, T = clock.T;
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // Translucent clear leaves motion trails.
  ctx.fillStyle = 'rgba(6,7,13,0.34)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (world.shake > .1) ctx.translate((Math.random() - .5) * world.shake, (Math.random() - .5) * world.shake);

  // wells
  for (const w of world.wells) {
    const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, 120);
    g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(.25, 'rgba(60,30,110,.35)'); g.addColorStop(1, 'rgba(60,30,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w.x, w.y, 120, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(185,139,255,.35)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(w.x, w.y, 22 + k * 14, w.a * (2 - k * .5) + k, w.a * (2 - k * .5) + k + 2.2); ctx.stroke();
    }
  }

  ctx.globalCompositeOperation = 'lighter';

  // crystals
  if (world.crystals.length) {
    ctx.strokeStyle = 'rgba(150,220,255,.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const c of world.crystals) for (const a of c.adj) if (a.state !== 2 && a.id < c.id) { ctx.moveTo(c.x, c.y); ctx.lineTo(a.x, a.y); }
    ctx.stroke();
    for (const c of world.crystals) {
      const s = c.state === 1 ? 5 : 2.4 * Math.min(1, (T - c.born) * 3);
      ctx.fillStyle = c.state === 1 ? '#fff' : CRY;
      ctx.beginPath(); ctx.moveTo(c.x, c.y - s); ctx.lineTo(c.x + s, c.y); ctx.lineTo(c.x, c.y + s); ctx.lineTo(c.x - s, c.y); ctx.fill();
    }
  }

  // orbs
  for (const o of world.orbs) {
    const grow = Math.min(1, (T - o.born) * 4);
    let s = o.r * 3.6 * grow, spr = colorOf(o).spr;
    if (o.crit) { s *= 1 + (.7 - o.crit) * .9; if ((o.crit * 20 | 0) % 2) spr = WHITE.spr; }
    if (o.type === 1) s *= 1 + .08 * Math.sin(T * 6 + o.x);
    ctx.drawImage(spr, o.x - s / 2, o.y - s / 2, s, s);
  }

  // blasts
  for (const b of world.blasts) {
    const p = Math.min(1, b.age / b.dur), fade = b.age > b.dur ? 1 - (b.age - b.dur) / .35 : 1;
    const hue = b.kind === BlastKind.Volatile ? 350 : b.kind === BlastKind.Crystal ? 195 : b.kind === BlastKind.Drone ? 45 : 190 + b.depth * 28;
    ctx.globalAlpha = Math.max(0, fade) * (b.kind === BlastKind.Crystal ? .4 : .85);
    ctx.strokeStyle = `hsl(${hue},100%,${b.kind === BlastKind.Drone ? 70 : 65}%)`;
    ctx.lineWidth = (b.kind === BlastKind.Volatile ? 4 : 2.4) * (1.4 - p * .6);
    ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(.1, b.r), 0, TAU); ctx.stroke();
    if (p < 1) {
      ctx.globalAlpha = .12 * (1 - p);
      ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // drone beams
  for (const b of world.beams) {
    ctx.globalAlpha = b.life / .2;
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
  }

  // particles
  for (const p of world.parts) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.c;
    ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
  }
  ctx.globalAlpha = 1;

  // drones
  ctx.globalCompositeOperation = 'source-over';
  for (const d of world.drones) {
    const ready = 1 - Math.max(0, d.t) / stat.interval;
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(Math.atan2(H / 2 - d.y, W / 2 - d.x));
    ctx.fillStyle = '#ffd34d'; ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,211,77,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(d.x, d.y, 13, -Math.PI / 2, -Math.PI / 2 + ready * TAU); ctx.stroke();
  }

  // floating payout texts
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of world.texts) {
    ctx.globalAlpha = Math.min(1, t.life / t.max * 2);
    ctx.font = `800 ${t.size | 0}px ${FONT}`;
    ctx.fillStyle = t.c;
    ctx.fillText(t.t, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  if (S.total < 3) {
    ctx.fillStyle = `rgba(232,236,255,${.35 + .2 * Math.sin(T * 3)})`;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('Click to detonate', W / 2, H / 2 + 40);
  }
  ctx.restore();

  drawFlash();
}
