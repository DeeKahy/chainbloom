import { app } from '../core/app';
import { $ } from '../core/util';

/** The 2D canvas: the whole Constellation board, and drones/texts/flash on top of the orb field. */
export const cv = $<HTMLCanvasElement>('#cv');
export const ctx = cv.getContext('2d')!;

/** The WebGL canvas under it, which draws the orb field when WebGL2 works (see fieldGL.ts). */
export const glCv = $<HTMLCanvasElement>('#gl');

/** Which renderer draws the orb field. Set once at boot, and back to false if the GPU context is lost. */
export const gfx = { gl: false };

/** Logical (CSS pixel) size of the canvas. The Constellation board works in these. */
export const size = { W: 800, H: 600, DPR: 1 };

/**
 * Area of the orb field in world units. It is the same on every screen, so orb density and how
 * far a blast reaches don't depend on screen size; only the shape follows the canvas.
 */
export const FIELD_AREA = 800_000;

/** The orb field in world units. `scale` is CSS pixels per world unit. */
export const field = { W: 1000, H: 800, scale: 1 };

export const BG = '#06070d';

export function resize(): void {
  const r = cv.parentElement!.getBoundingClientRect();
  size.DPR = Math.min(2, window.devicePixelRatio || 1);
  size.W = Math.max(200, r.width);
  size.H = Math.max(200, r.height);
  field.scale = Math.sqrt(size.W * size.H / FIELD_AREA);
  field.W = size.W / field.scale;
  field.H = size.H / field.scale;
  cv.width = glCv.width = size.W * size.DPR;
  cv.height = glCv.height = size.H * size.DPR;
  ctx.setTransform(size.DPR, 0, 0, size.DPR, 0, 0);
  clearCanvas();
}

/** Reset the 2D canvas: opaque when it draws the scene itself, see-through when WebGL draws the field under it. */
export function clearCanvas(): void {
  if (gfx.gl && app.view === 'orbs') {
    ctx.clearRect(0, 0, size.W, size.H);
    return;
  }
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size.W, size.H);
}
