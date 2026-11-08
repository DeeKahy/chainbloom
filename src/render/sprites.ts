export interface OrbLook {
  rgb: string;
  spr: HTMLCanvasElement;
  mult: number;
}

function makeSprite(r: number, g: number, b: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(.16, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(.32, `rgba(${r},${g},${b},.45)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return c;
}

const mk = (rgb: [number, number, number], mult: number): OrbLook =>
  ({ rgb: `rgb(${rgb})`, spr: makeSprite(...rgb), mult });

export const NORMALS = ([[110, 231, 255], [120, 170, 255], [140, 255, 220]] as [number, number, number][]).map(c => mk(c, 1));
/** Indexed by OrbType; index 0 is unused (normal orbs pick from NORMALS by hue). */
export const TYPES: OrbLook[] = [NORMALS[0], mk([255, 211, 77], 15), mk([255, 80, 100], 1), mk([185, 120, 255], 1)];
export const WHITE = mk([255, 255, 255], 1);
export const CRY = 'rgb(190,240,255)';

export const colorOf = (o: { type: number; hue: number }): OrbLook =>
  o.type ? TYPES[o.type] : NORMALS[o.hue];
