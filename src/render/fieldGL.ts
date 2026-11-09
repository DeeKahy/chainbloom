import { clock } from '../core/app';
import { BlastKind, HOLE_CORE, HOLE_FEED, multiverseOn, world, WELL_GLOW } from '../sim/world';
import { stat } from '../systems/stats';
import { field, glCv, layoutChanged, size, type View } from './canvas';
import { colorOf, CRY, WHITE } from './sprites';

/**
 * WebGL2 renderer for the orb field. Canvas 2D drew every blast ring, disc and particle as its own
 * anti-aliased path, which phones can't keep up with in big chains. Here everything is a quad with
 * a distance-field fragment shader, drawn in two instanced calls per frame.
 *
 * It draws the same picture as renderField() in field.ts, which stays as the fallback. Drones, texts
 * and the flash are drawn on the 2D canvas on top (see drawFieldOverlay).
 */

// Instance kinds, matched in the shaders.
const BLAST = 0, ORB = 2, SQUARE = 3, DIAMOND = 4, SEGMENT = 5, WELL = 6, HOLE = 7;

/** Floats per instance: x, y, r, kind | r, g, b, a | p0, p1, p2, p3 */
const STRIDE = 12;

const VS = `#version 300 es
layout(location=0) in vec2 corner;
layout(location=1) in vec4 a_shape;  // x, y, r, kind
layout(location=2) in vec4 a_col;
layout(location=3) in vec4 a_p;
uniform vec2 u_res;     // canvas size in CSS px
uniform float u_scale;  // CSS px per world unit
uniform vec2 u_shake;   // CSS px
uniform float u_px;     // one device pixel in world units
out vec2 v_lp; out vec4 v_col; out vec4 v_p; out float v_r; out float v_kind; out float v_len;
void main() {
  float kind = a_shape.w;
  vec2 pos;
  v_len = 0.0;
  if (kind == 5.0) {
    // segment from (x,y) to (p0,p1), width p2: v_lp.x runs along it, v_lp.y across
    vec2 a = a_shape.xy, b = a_p.xy, d = b - a;
    float len = max(length(d), 1e-4);
    vec2 t = d / len, n = vec2(-t.y, t.x);
    float hw = a_p.z * 0.5 + u_px;
    float along = (corner.x * 0.5 + 0.5) * len;
    pos = a + t * along + n * corner.y * hw;
    v_lp = vec2(along, corner.y * hw);
    v_len = len;
  } else {
    float pad = (kind == 0.0 ? a_p.x : 0.0) + 2.0 * u_px;
    float extent = a_shape.z + pad;
    v_lp = corner * extent;
    pos = a_shape.xy + v_lp;
  }
  v_col = a_col; v_p = a_p; v_r = a_shape.z; v_kind = kind;
  vec2 css = pos * u_scale + u_shake;
  vec2 clip = css / u_res * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FS_HEAD = `#version 300 es
precision highp float;
in vec2 v_lp; in vec4 v_col; in vec4 v_p; in float v_r; in float v_kind; in float v_len;
uniform float u_px;
out vec4 o;
float stroke(float dist, float w) {
  // coverage of a line of width w at distance dist from its centre, anti-aliased over one pixel
  float hw = max(w, u_px) * 0.5;
  return clamp((hw + u_px * 0.5 - abs(dist)) / u_px, 0.0, 1.0) * min(1.0, w / u_px);
}
`;

/** Everything additive. Each shape is cheap, so branching on the kind costs little. */
const FS = FS_HEAD + `
void main() {
  float d = length(v_lp);
  vec3 rgb = v_col.rgb;
  float a;
  if (v_kind == 0.0) {
    // blast: ring (alpha v_col.a, width p0) plus the translucent disc inside it (alpha p1), one quad.
    // p2 = 1 makes it a square (Law: Square Blasts).
    if (v_p.z > 0.5) d = max(abs(v_lp.x), abs(v_lp.y));
    a = stroke(d - v_r, v_p.x) * v_col.a + clamp((v_r - d) / u_px + 0.5, 0.0, 1.0) * v_p.y;
    o = vec4(rgb * a, a);
    return;
  }
  if (v_kind == 2.0) {
    // the orb sprite: white core, solid colour, then a soft glow
    float t = d / v_r;
    if (t < 0.16) { rgb = mix(vec3(1.0), rgb, t / 0.16); a = 1.0; }
    else if (t < 0.32) a = mix(1.0, 0.45, (t - 0.16) / 0.16);
    else a = mix(0.45, 0.0, clamp((t - 0.32) / 0.68, 0.0, 1.0));
  }
  else if (v_kind == 3.0) a = clamp((v_r - max(abs(v_lp.x), abs(v_lp.y))) / u_px + 0.5, 0.0, 1.0);
  else if (v_kind == 4.0) a = clamp((v_r - abs(v_lp.x) - abs(v_lp.y)) * 0.7071 / u_px + 0.5, 0.0, 1.0);
  else a = (v_lp.x >= 0.0 && v_lp.x <= v_len) ? stroke(v_lp.y, v_p.z) : 0.0;
  a *= v_col.a;
  o = vec4(rgb * a, a);
}`;

/** Wells: dark radial gradient with three violet arcs swirling on top (source-over, not additive). */
const FS_WELL = FS_HEAD + `
const float TAU = 6.2831853;
void main() {
  if (v_kind == 7.0) {
    // black hole: params are rotation, mass fill, flare and line thickness
    float d = length(v_lp), ang = atan(v_lp.y, v_lp.x);
    float rot = v_p.x, mass = v_p.y, flare = v_p.z, th = v_p.w, core = ${HOLE_CORE.toFixed(1)};
    // faint haze over the feeding zone
    float haze = smoothstep(v_r, v_r * 0.5, d) * (0.10 + 0.14 * flare);
    vec3 col = vec3(1.0, 0.55, 0.2) * haze; float al = haze;
    // accretion disk: hot near the core, cooler outwards, three swirling arms
    float t = clamp((d - core - 4.0) / 75.0, 0.0, 1.0);
    float disk = (d > core && d < core + 80.0) ? (1.0 - t) * (0.5 + 0.5 * sin(ang * 3.0 - rot * 2.0 + d * 0.08)) : 0.0;
    disk *= 0.5 + 0.5 * flare;
    vec3 hot = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.45, 0.12), t);
    col = hot * disk + col * (1.0 - disk); al = disk + al * (1.0 - disk);
    // event horizon, then a thin photon ring around it
    float hole = clamp((core - d) / (u_px * 1.5) + 0.5, 0.0, 1.0);
    col *= 1.0 - hole; al = hole + al * (1.0 - hole);
    float pr = stroke(d - core - 1.5, 2.0 * th) * (0.75 + 0.25 * flare);
    col = vec3(1.0, 0.85, 0.6) * pr + col * (1.0 - pr); al = pr + al * (1.0 - pr);
    // mass meter: a ring filling clockwise from the top
    float a01 = mod(ang + 1.5707963, TAU) / TAU;
    float m = stroke(d - (core + 104.0), 2.5 * th) * (a01 <= mass ? 0.9 : 0.14);
    col = vec3(1.0, 0.7, 0.35) * m + col * (1.0 - m); al = m + al * (1.0 - m);
    o = vec4(col, al);
    return;
  }
  float d = length(v_lp), t = d / v_r;
  vec4 g0 = vec4(0.0, 0.0, 0.0, 0.9), g1 = vec4(60.0 / 255.0, 30.0 / 255.0, 110.0 / 255.0, 0.35);
  vec4 g = t < 0.25 ? mix(g0, g1, t / 0.25) : mix(g1, vec4(g1.rgb, 0.0), clamp((t - 0.25) / 0.75, 0.0, 1.0));
  if (t > 1.0) g.a = 0.0;
  vec3 col = g.rgb * g.a; float al = g.a;
  float ang = atan(v_lp.y, v_lp.x);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float delta = mod(ang - (v_p.x * (2.0 - fk * 0.5) + fk), TAU);
    if (delta <= 2.2) {
      float c = stroke(d - (22.0 + fk * 14.0), 1.5 * v_p.y) * 0.35;
      col = vec3(185.0, 139.0, 255.0) / 255.0 * c + col * (1.0 - c);
      al = c + al * (1.0 - c);
    }
  }
  o = vec4(col, al);
}`;

const FADE_VS = `#version 300 es
layout(location=0) in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;
const FADE_FS = `#version 300 es
precision mediump float;
out vec4 o;
// rgba(6,7,13,.34) over the previous frame leaves the motion trails, like the 2D renderer
void main() { o = vec4(vec3(6.0, 7.0, 13.0) / 255.0 * 0.34, 0.34); }`;

let gl: WebGL2RenderingContext;
let prog: WebGLProgram, wellProg: WebGLProgram, fadeProg: WebGLProgram;
let vao: WebGLVertexArrayObject, fadeVao: WebGLVertexArrayObject, instBuf: WebGLBuffer;
type Uniforms = Record<'res' | 'scale' | 'shake' | 'px', WebGLUniformLocation | null>;
let U: Uniforms, UW: Uniforms;

const uniformsOf = (p: WebGLProgram): Uniforms => ({
  res: gl.getUniformLocation(p, 'u_res'), scale: gl.getUniformLocation(p, 'u_scale'),
  shake: gl.getUniformLocation(p, 'u_shake'), px: gl.getUniformLocation(p, 'u_px'),
});
let data = new Float32Array(4096 * STRIDE);
let n = 0;
let lastW = 0, lastH = 0;

function shader(type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}

function program(vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

/** Set up WebGL2. Returns false (and leaves the 2D renderer in charge) if it isn't available. */
export function initFieldGL(onLost: () => void): boolean {
  if (new URLSearchParams(location.search).get('renderer') === '2d') return false;
  try {
    const c = glCv.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!c) return false;
    gl = c;
    prog = program(VS, FS);
    wellProg = program(VS, FS_WELL);
    fadeProg = program(FADE_VS, FADE_FS);
    U = uniformsOf(prog);
    UW = uniformsOf(wellProg);
    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    fadeVao = gl.createVertexArray()!;
    gl.bindVertexArray(fadeVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    instBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }
    gl.bindVertexArray(null);
    glCv.addEventListener('webglcontextlost', e => { e.preventDefault(); onLost(); }, { once: true });
    return true;
  } catch (e) {
    console.warn('WebGL renderer unavailable, using 2D', e);
    return false;
  }
}

// ---------- colours ----------
const colorCache = new Map<string, [number, number, number]>();
const parseCtx = document.createElement('canvas').getContext('2d')!;

/** Any CSS colour string → 0..1 RGB, cached (particles use a handful of colours). */
function rgbOf(css: string): [number, number, number] {
  let c = colorCache.get(css);
  if (!c) {
    parseCtx.fillStyle = '#000';
    parseCtx.fillStyle = css;
    const s = parseCtx.fillStyle;
    if (s.startsWith('#')) c = [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
    else { const m = s.match(/[\d.]+/g)!.map(Number); c = [m[0] / 255, m[1] / 255, m[2] / 255]; }
    colorCache.set(css, c);
  }
  return c;
}

/** hsl(h, 100%, l) → RGB, as the blast rings use. */
function hsl(h: number, l: number): [number, number, number] {
  const a = Math.min(l, 1 - l);
  const f = (k0: number): number => { const k = (k0 + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}

// ---------- instance buffer ----------
function put(x: number, y: number, r: number, kind: number, c: readonly number[], a: number, p0 = 0, p1 = 0, p2 = 0, p3 = 0): void {
  if ((n + 1) * STRIDE > data.length) {
    const next = new Float32Array(data.length * 2);
    next.set(data);
    data = next;
  }
  const i = n++ * STRIDE;
  data[i] = x; data[i + 1] = y; data[i + 2] = r; data[i + 3] = kind;
  data[i + 4] = c[0]; data[i + 5] = c[1]; data[i + 6] = c[2]; data[i + 7] = a;
  data[i + 8] = p0; data[i + 9] = p1; data[i + 10] = p2; data[i + 11] = p3;
}

const NONE = [0, 0, 0] as const;

let lastLayout = -1;

/**
 * Draw the current universe (see useWorld) into its view's rectangle. `shake` is the same random
 * offset the 2D overlay uses this frame. Each universe keeps its own trails: the fade and every
 * draw are clipped to its rectangle.
 */
export function renderFieldGL(v: View, shakeX: number, shakeY: number): void {
  const { scale } = field, T = clock.T, DPR = size.DPR;
  const thick = Math.max(1, .7 / scale);
  const minOrb = 16 / scale;
  if (glCv.width !== lastW || glCv.height !== lastH || layoutChanged.n !== lastLayout) {
    lastW = glCv.width; lastH = glCv.height; lastLayout = layoutChanged.n;
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, lastW, lastH);
    gl.clearColor(6 / 255, 7 / 255, 13 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  // this universe's rectangle, in device pixels from the bottom left
  const vx = Math.round(v.x * DPR), vy = Math.round((size.H - v.y - v.h) * DPR), vw = Math.round(v.w * DPR), vh = Math.round(v.h * DPR);
  gl.viewport(vx, vy, vw, vh);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(vx, vy, vw, vh);
  gl.enable(gl.BLEND);

  // trails
  gl.useProgram(fadeProg);
  gl.bindVertexArray(fadeVao);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  n = 0;
  // wells (drawn normally, first)
  for (const w of world.wells) put(w.x, w.y, WELL_GLOW, WELL, NONE, 1, w.a, thick);
  if (stat.hole) {
    // black hole (layer 4): params are rotation, mass fill 0..1, flare 0..1 and line thickness
    put(field.W / 2, field.H / 2, HOLE_FEED, HOLE, NONE, 1, world.holeA, world.mass / stat.massCap, world.flareT > 0 ? 1 : 0, thick);
  }
  const wellCount = n;

  // everything else adds light, like the 2D renderer's 'lighter'
  if (world.crystals.length) {
    const line = rgbOf('rgb(150,220,255)'), cry = rgbOf(CRY), white = [1, 1, 1];
    for (const c of world.crystals) for (const a of c.adj) {
      if (a.state !== 2 && a.id < c.id) put(c.x, c.y, 0, SEGMENT, line, .35, a.x, a.y, 1.2 * thick);
    }
    for (const c of world.crystals) {
      const s = (c.state === 1 ? 5 : 2.4 * Math.min(1, (T - c.born) * 3)) * thick;
      put(c.x, c.y, s, DIAMOND, c.state === 1 ? white : cry, 1);
    }
  }

  const twin = rgbOf('#c9a6ff');
  for (const o of world.orbs) {
    const grow = Math.min(1, (T - o.born) * 4);
    let s = Math.max(o.r * 3.6, minOrb) * grow, look = colorOf(o);
    if (o.crit) { s *= 1 + (.7 - o.crit) * .9; if ((o.crit * 20 | 0) % 2) look = WHITE; }
    if (o.type === 1) s *= 1 + .08 * Math.sin(T * 6 + o.x);
    put(o.x, o.y, s / 2, ORB, rgbOf(look.rgb), 1);
    // entangled orbs wear a thin violet ring
    if (o.twin) put(o.x, o.y, s * .42, BLAST, twin, .6 + .25 * Math.sin(T * 5 + o.x), 1.2 * thick);
  }

  for (const b of world.blasts) {
    const p = Math.min(1, b.age / b.dur), fade = b.age > b.dur ? 1 - (b.age - b.dur) / .35 : 1;
    const hue = b.kind === BlastKind.Volatile ? 350 : b.kind === BlastKind.Crystal ? 195 : b.kind === BlastKind.Drone ? 45
      : b.kind === BlastKind.Mirror ? 275 : 190 + b.depth * 28;
    const col = hsl(hue % 360, b.kind === BlastKind.Drone ? .7 : .65);
    const r = Math.max(.1, b.r);
    const lw = (b.kind === BlastKind.Volatile ? 4 : 2.4) * (1.4 - p * .6) * thick;
    put(b.x, b.y, r, BLAST, col, Math.max(0, fade) * (b.kind === BlastKind.Crystal ? .4 : .85), lw, p < 1 ? .12 * (1 - p) : 0, b.sq ? 1 : 0);
  }

  const gold = rgbOf('#ffd34d');
  for (const b of world.beams) put(b.x1, b.y1, 0, SEGMENT, gold, b.life / .2, b.x2, b.y2, 2 * thick);

  for (const p of world.parts) put(p.x, p.y, p.sz * thick / 2, SQUARE, rgbOf(p.c), p.life / p.max);

  // the bridge: a glowing gate on the edge facing the other universe
  if (multiverseOn()) {
    const x = world.index === 0 ? field.W - 2 : 2, y0 = field.H / 2 - stat.portalSpan / 2, y1 = field.H / 2 + stat.portalSpan / 2;
    const glow = .5 + .2 * Math.sin(T * 3) + .6 * world.portalFlash;
    put(x, y0, 0, SEGMENT, rgbOf('#7fd4ff'), glow * .35, x, y1, 14 * thick);
    put(x, y0, 0, SEGMENT, rgbOf('#e6f7ff'), glow, x, y1, 3 * thick);
  }

  const use = (p: WebGLProgram, u: Uniforms): void => {
    gl.useProgram(p);
    gl.uniform2f(u.res, v.w, v.h);
    gl.uniform1f(u.scale, scale);
    gl.uniform2f(u.shake, shakeX, shakeY);
    gl.uniform1f(u.px, 1 / (scale * DPR));
  };
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * STRIDE), gl.STREAM_DRAW);
  if (wellCount) {
    use(wellProg, UW);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, wellCount);
  }
  if (n > wellCount) {
    use(prog, U);
    gl.blendFunc(gl.ONE, gl.ONE);
    // draw the additive range: re-point the instance attributes at its first element
    for (let i = 0; i < 3; i++) gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, wellCount * STRIDE * 4 + i * 16);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n - wellCount);
    for (let i = 0; i < 3; i++) gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
  }
  gl.bindVertexArray(null);
}

