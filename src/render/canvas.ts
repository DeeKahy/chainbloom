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
 * Area of each orb field in world units. It is the same on every screen, so orb density and how
 * far a blast reaches don't depend on screen size; only the shape follows the canvas.
 */
export const FIELD_AREA = 800_000;

/** One universe on screen: its rectangle in CSS px, and its size in world units (scale = CSS px per unit). */
export interface View { x: number; y: number; w: number; h: number; W: number; H: number; scale: number; visible: boolean }

const blankView = (): View => ({ x: 0, y: 0, w: 800, h: 600, W: 1000, H: 800, scale: 1, visible: false });
/** Universe A and B. Layer 5 shows both side by side on wide screens, one at a time on narrow ones. */
export const views: View[] = [blankView(), blankView()];

/** The current universe's field in world units (set by useWorld in sim/world.ts). */
export const field = { W: 1000, H: 800, scale: 1 };

/** Multiverse layout: whether B exists, whether both show side by side, and which one a phone shows. */
export const layout = { multi: false, split: false, focus: 0 };

export const BG = '#06070d';

/** Stage width from which the two universes sit side by side. */
const SPLIT_MIN_W = 700;

function computeViews(): void {
  const split = layout.multi && size.W >= SPLIT_MIN_W;
  layout.split = split;
  const gap = split ? 6 : 0;
  views.forEach((v, i) => {
    v.x = 0; v.y = 0; v.w = size.W; v.h = size.H;
    if (split) { v.w = (size.W - gap) / 2; v.x = i ? v.w + gap : 0; }
    v.visible = split || (layout.multi ? i === layout.focus : i === 0);
    v.scale = Math.sqrt(v.w * v.h / FIELD_AREA);
    v.W = v.w / v.scale; v.H = v.h / v.scale;
  });
  field.W = views[0].W; field.H = views[0].H; field.scale = views[0].scale;
}

/** Turn universe B on/off, or switch which one a phone shows. */
export function setLayout(multi: boolean, focus = layout.focus): void {
  if (layout.multi === multi && layout.focus === focus) return;
  layout.multi = multi; layout.focus = multi ? focus : 0;
  computeViews();
  clearCanvas();
  layoutChanged.n++;
}
/** Bumped whenever the views move, so the WebGL renderer clears its trails. */
export const layoutChanged = { n: 0 };

export function resize(): void {
  const r = cv.parentElement!.getBoundingClientRect();
  size.DPR = Math.min(2, window.devicePixelRatio || 1);
  size.W = Math.max(200, r.width);
  size.H = Math.max(200, r.height);
  computeViews();
  cv.width = glCv.width = size.W * size.DPR;
  cv.height = glCv.height = size.H * size.DPR;
  ctx.setTransform(size.DPR, 0, 0, size.DPR, 0, 0);
  clearCanvas();
  layoutChanged.n++;
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
