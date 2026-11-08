import { clock } from '../core/app';
import { TAU } from '../core/util';
import { NODES } from '../content/rifts';
import { board, DIRS, hexPix, hexSize, hk, HOP, inBoard } from '../sim/board';
import { S } from '../state/state';
import { stat } from '../systems/stats';
import { ctx, size } from './canvas';
import { drawFlash } from './field';
import { NORMALS, TYPES } from './sprites';

const FONT = 'ui-sans-serif,system-ui,sans-serif';

function hexPath(x: number, y: number, s: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30), px = x + s * Math.cos(a), py = y + s * Math.sin(a);
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

export function renderBoard(): void {
  const T = clock.T;
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(8,6,18,.45)'; ctx.fillRect(0, 0, size.W, size.H);
  const s = hexSize(), R = stat.boardR, hover = board.hover;

  // grid
  ctx.lineWidth = 1;
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) {
    if (!inBoard(q, r)) continue;
    const [x, y] = hexPix(q, r);
    hexPath(x, y, s * .94);
    const hov = hover && hover[0] === q && hover[1] === r;
    ctx.strokeStyle = hov ? 'rgba(232,236,255,.7)' : 'rgba(120,120,220,.16)';
    ctx.stroke();
  }

  // the hex picked by a first tap (touch): filled in the tool colour until the second tap
  if (board.armed) {
    const [x, y] = hexPix(board.armed[0], board.armed[1]);
    const col = board.tool === 'remove' ? '#ff5a6e' : NODES[board.tool].col;
    hexPath(x, y, s * .94);
    ctx.globalAlpha = .3 + .15 * Math.sin(T * 8); ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineWidth = 1;
  }

  // links between occupied neighbours (each pair drawn once via the first 3 directions)
  ctx.strokeStyle = 'rgba(160,160,255,.22)'; ctx.lineWidth = 2; ctx.beginPath();
  const all = [{ q: 0, r: 0 }, ...S.board];
  for (const n of all) for (let i = 0; i < 3; i++) {
    const nq = n.q + DIRS[i][0], nr = n.r + DIRS[i][1];
    if (board.map.has(hk(nq, nr)) || (nq === 0 && nr === 0)) {
      const [x1, y1] = hexPix(n.q, n.r), [x2, y2] = hexPix(nq, nr);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
  }
  ctx.stroke();

  // nodes
  ctx.globalCompositeOperation = 'lighter';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of S.board) {
    const [x, y] = hexPix(n.q, n.r), N = NODES[n.t], f = n.flash || 0;
    hexPath(x, y, s * (.76 + f * .1));
    ctx.globalAlpha = .18 + .55 * f; ctx.fillStyle = N.col; ctx.fill();
    ctx.globalAlpha = .85; ctx.strokeStyle = N.col; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = .9; ctx.font = `800 ${Math.max(9, s * .42) | 0}px ${FONT}`;
    ctx.fillText(N.icon, x, y + 1);
  }

  // core with its charge ring
  const [cx, cy] = hexPix(0, 0), cs = s * (1.9 + .7 * board.coreFlash + .1 * Math.sin(T * 4));
  ctx.globalAlpha = 1;
  ctx.drawImage(TYPES[1].spr, cx - cs, cy - cs, cs * 2, cs * 2);
  ctx.strokeStyle = 'rgba(255,211,77,.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, s * .62, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, board.coreT / stat.pulseCD)); ctx.stroke();

  // pulses in flight
  for (const h of board.hops) {
    const p = Math.min(1, (T - h.start) / HOP);
    const [x1, y1] = hexPix(h.fq, h.fr), [x2, y2] = hexPix(h.q, h.r);
    const x = x1 + (x2 - x1) * p, y = y1 + (y2 - y1) * p;
    const sz = s * (.35 + Math.min(.5, Math.log10(1 + h.v) * .06));
    ctx.drawImage(h.wave.echo ? TYPES[3].spr : NORMALS[0].spr, x - sz, y - sz, sz * 2, sz * 2);
  }

  // flux texts
  ctx.globalCompositeOperation = 'source-over';
  for (const t of board.texts) {
    const [x, y] = hexPix(t.q, t.r);
    ctx.globalAlpha = Math.min(1, t.life * 2);
    ctx.font = `800 ${Math.max(10, s * .4) | 0}px ${FONT}`;
    ctx.fillStyle = t.c;
    ctx.fillText(t.t, x, y - s * .6 - (1 - t.life) * 26);
  }
  ctx.globalAlpha = 1;

  if (!S.board.length) {
    ctx.fillStyle = `rgba(232,236,255,${.45 + .2 * Math.sin(T * 3)})`;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('Place a Collector next to the core', cx, cy + s * 2.4);
  }

  drawFlash();
}
