import { initAudio } from './audio';
import { app } from './core/app';
import { cv, field } from './render/canvas';
import { board, boardClick, inBoard, pixHex } from './sim/board';
import { detonateAt } from './sim/world';

const local = (e: PointerEvent): [number, number] => {
  const r = cv.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};

export function bindInput(): void {
  cv.addEventListener('pointerdown', e => {
    initAudio();
    const [x, y] = local(e);
    if (app.view === 'board') boardClick(x, y);
    else detonateAt(x / field.scale, y / field.scale);
  });
  cv.addEventListener('pointermove', e => {
    if (app.view !== 'board') return;
    const h = pixHex(...local(e));
    board.hover = inBoard(h[0], h[1]) ? h : null;
  });
  cv.addEventListener('pointerleave', () => { board.hover = null; });
}
