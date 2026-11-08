import { $ } from '../core/util';

export const cv = $<HTMLCanvasElement>('#cv');
export const ctx = cv.getContext('2d')!;

/** Logical (CSS pixel) size of the play field. The simulation reads this too. */
export const size = { W: 800, H: 600, DPR: 1 };

export const BG = '#06070d';

export function resize(): void {
  const r = cv.parentElement!.getBoundingClientRect();
  size.DPR = Math.min(2, window.devicePixelRatio || 1);
  size.W = Math.max(200, r.width);
  size.H = Math.max(200, r.height);
  cv.width = size.W * size.DPR;
  cv.height = size.H * size.DPR;
  ctx.setTransform(size.DPR, 0, 0, size.DPR, 0, 0);
  clearCanvas();
}

export function clearCanvas(): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size.W, size.H);
}
