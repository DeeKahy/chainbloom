import { app, onRefresh, type View } from '../core/app';
import { $, $$, fmt } from '../core/util';
import { NODE_TYPES, NODES } from '../content/rifts';
import { clearCanvas } from '../render/canvas';
import { board, hk, nodeCost, nodeUnlocked, type Tool } from '../sim/board';
import { S } from '../state/state';
import { stat } from '../systems/stats';

const palBtns = new Map<Tool, { el: HTMLButtonElement; n: HTMLElement; c: HTMLElement }>();

export function buildPalette(): void {
  const box = $('#palBtns');
  box.innerHTML = '';
  for (const t of [...NODE_TYPES, 'remove'] as Tool[]) {
    const b = document.createElement('button');
    b.className = 'pb';
    const col = t === 'remove' ? '#ff5a6e' : NODES[t].col;
    b.style.color = col;
    b.innerHTML = `<i style="background:${col}"></i><span class="n"></span><span class="c"></span>`;
    b.addEventListener('click', () => { board.tool = t; refreshPalette(); });
    box.appendChild(b);
    palBtns.set(t, { el: b, n: b.querySelector<HTMLElement>('.n')!, c: b.querySelector<HTMLElement>('.c')! });
  }
  $$<HTMLButtonElement>('#viewBtns button').forEach(b => b.addEventListener('click', () => setView(b.dataset.v as View)));
  onRefresh(() => { if (app.view === 'board') refreshPalette(); });
}

export function refreshPalette(): void {
  for (const [t, p] of palBtns) {
    p.el.classList.toggle('on', board.tool === t);
    if (t === 'remove') { p.n.textContent = 'Remove'; p.c.textContent = 'full refund'; continue; }
    p.el.style.display = nodeUnlocked(t) ? '' : 'none';
    p.n.textContent = NODES[t].name;
    p.c.textContent = fmt(nodeCost(t, S.board.length)) + ' Flux';
  }
  const hn = board.hover && board.map.get(hk(board.hover[0], board.hover[1]));
  const tool = board.tool;
  const desc = hn ? `<b>${NODES[hn.t].name}:</b> ${NODES[hn.t].desc}` :
    tool === 'remove' ? '<b>Remove:</b> click a node to take it back for a full refund.' : `<b>${NODES[tool].name}:</b> ${NODES[tool].desc}`;
  $('#palInfo').innerHTML = `<b style="color:#7dffb0">${fmt(S.flux)} Flux</b> · orb value ×${fmt(stat.fluxMult)} from all Flux ever earned · core charge ${fmt(S.pulseBank)}<br>${desc}`;
  board.palH = $('#palette').offsetHeight || board.palH;
}

export function setView(v: View): void {
  app.view = v;
  $$('#viewBtns button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#palette').hidden = v !== 'board';
  $('#combo').style.display = v === 'board' ? 'none' : '';
  clearCanvas();
  if (v === 'board') refreshPalette();
}
