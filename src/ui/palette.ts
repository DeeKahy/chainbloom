import { app, onRefresh, type View } from '../core/app';
import { $, $$, fmt, setHTML, setText } from '../core/util';
import { NODE_TYPES, NODES } from '../content/rifts';
import { clearCanvas } from '../render/canvas';
import { board, hk, nodeCost, nodeUnlocked, type Tool } from '../sim/board';
import { S } from '../state/state';
import { stat } from '../systems/stats';

const palBtns = new Map<Tool, { el: HTMLButtonElement; n: HTMLElement; c: HTMLElement }>();

export function buildPalette(): void {
  const box = $('#palBtns');
  setHTML(box, '');
  for (const t of [...NODE_TYPES, 'remove'] as Tool[]) {
    const b = document.createElement('button');
    b.className = 'pb';
    const col = t === 'remove' ? '#ff5a6e' : NODES[t].col;
    b.style.color = col;
    setHTML(b, `<i style="background:${col}"></i><span class="n"></span><span class="c"></span>`);
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
    if (t === 'remove') { setText(p.n, 'Remove'); setText(p.c, 'full refund'); continue; }
    p.el.style.display = nodeUnlocked(t) ? '' : 'none';
    setText(p.n, NODES[t].name);
    setText(p.c, fmt(nodeCost(t, S.board.length)) + ' Flux');
  }
  const hn = board.hover && board.map.get(hk(board.hover[0], board.hover[1]));
  const tool = board.tool;
  let desc = hn ? `<b>${NODES[hn.t].name}:</b> ${NODES[hn.t].desc}` :
    tool === 'remove' ? '<b>Remove:</b> click a node to take it back for a full refund.' : `<b>${NODES[tool].name}:</b> ${NODES[tool].desc}`;
  if (board.armed) {
    const an = board.map.get(hk(board.armed[0], board.armed[1]));
    desc = tool === 'remove'
      ? (an ? `<b>Tap again</b> to remove this ${NODES[an.t].name} (+${fmt(an.c)} Flux back).` : 'Nothing to remove here. Pick a node.')
      : an && an.t === tool ? `This is already a ${NODES[tool].name}.`
      : `<b>Tap again</b> to ${an ? `replace the ${NODES[an.t].name} with` : 'place'} a <b>${NODES[tool].name}</b> for ${fmt(nodeCost(tool, S.board.length - (an ? 1 : 0)))} Flux.`;
  }
  setHTML($('#palInfo'), `<b style="color:#7dffb0">${fmt(S.flux)} Flux</b> · orb value ×${fmt(stat.fluxMult)} · core charge ${fmt(S.pulseBank)}<br>${desc}`);
  board.palH = $('#palette').offsetHeight || board.palH;
  // The board sits below whatever overlays the top of the stage (view buttons, and the HUD where it shows).
  const top = $('#stage').getBoundingClientRect().top;
  let bottom = $('#viewBtns').getBoundingClientRect().bottom;
  const hud = $('#hud');
  if (getComputedStyle(hud).display !== 'none') bottom = Math.max(bottom, hud.getBoundingClientRect().bottom);
  board.topH = bottom - top + 10;
}

export function setView(v: View): void {
  app.view = v;
  board.armed = null;
  document.body.classList.toggle('boardview', v === 'board');
  $$('#viewBtns button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#palette').hidden = v !== 'board';
  $('#combo').style.display = v === 'board' ? 'none' : '';
  clearCanvas();
  if (v === 'board') refreshPalette();
}
