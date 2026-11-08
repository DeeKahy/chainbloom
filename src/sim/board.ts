import { chime, initAudio, soundOn, tone } from '../audio';
import { app, clock } from '../core/app';
import { fmt } from '../core/util';
import { NODES } from '../content/rifts';
import type { NodeType } from '../content/types';
import { size } from '../render/canvas';
import { S, type BoardNode } from '../state/state';
import { stat } from '../systems/stats';
import { hooks } from './world';

/** Axial hex directions. */
export const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const hk = (q: number, r: number): string => q + ',' + r;

/** Seconds a pulse takes to hop between neighbouring nodes. */
export const HOP = .14;

interface Wave { vis: Set<string>; echo: boolean }
export interface Hop { wave: Wave; q: number; r: number; fq: number; fr: number; v: number; start: number; at: number }
interface Echo { q: number; r: number; v: number; at: number }
export interface BoardText { q: number; r: number; t: string; life: number; c: string }

export type Tool = NodeType | 'remove';

export const board = {
  map: new Map<string, BoardNode>(),
  hops: [] as Hop[],
  echoes: [] as Echo[],
  texts: [] as BoardText[],
  coreT: 0,
  coreFlash: 0,
  tool: 'collect' as Tool,
  hover: null as [number, number] | null,
  /** Touch: the hex picked by the first tap; a second tap on it places or removes. */
  armed: null as [number, number] | null,
  /** Bottom of the overlays above the board (view buttons, HUD) in CSS px. */
  topH: 92,
  /** Height of the palette overlay; the board shrinks to fit above it. */
  palH: 130,
};

export function rebuildBoardMap(): void {
  board.map = new Map();
  for (const n of S.board) board.map.set(hk(n.q, n.r), n);
}

export function clearBoardFx(): void {
  board.hops = []; board.echoes = []; board.texts = [];
  board.coreT = 0; board.coreFlash = 0;
}

// ---------- geometry ----------
export const inBoard = (q: number, r: number): boolean =>
  Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= stat.boardR;


const boardAvail = () => Math.max(80, size.H - board.palH - 24 - board.topH);

export function hexSize(): number {
  const R = stat.boardR;
  return Math.max(6, Math.min(40, size.W / ((2 * R + 1) * 1.75), boardAvail() / ((2 * R + 1) * 1.55)));
}
const boardCY = () => board.topH + boardAvail() / 2;

export function hexPix(q: number, r: number): [number, number] {
  const s = hexSize();
  return [size.W / 2 + s * Math.sqrt(3) * (q + r / 2), boardCY() + s * 1.5 * r];
}

export function pixHex(x: number, y: number): [number, number] {
  const s = hexSize();
  x -= size.W / 2; y -= boardCY();
  const fq = (Math.sqrt(3) / 3 * x - y / 3) / s, fr = (2 / 3 * y) / s, fs = -fq - fr;
  let q = Math.round(fq), r = Math.round(fr);
  const sR = Math.round(fs);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(sR - fs);
  if (dq > dr && dq > ds) q = -r - sR; else if (dr > ds) r = -q - sR;
  return [q, r];
}

// ---------- economy ----------
/** First node is free; each further node costs more, scaled by type. */
export const nodeCost = (t: NodeType, count: number): number => count === 0 ? 0 : 10 * 1.5 ** count * NODES[t].mult;
export const nodeUnlocked = (t: NodeType): boolean => !NODES[t].req || S.riftsDone.includes(NODES[t].req);

// Orb chains charge the core (only once the Constellation exists).
hooks.chainFinished = c => { if (S.collapses > 0) S.pulseBank += c.count; };

// ---------- pulses ----------
function emitFrom(q: number, r: number, v: number, wave: Wave): void {
  for (const [dq, dr] of DIRS) {
    const nq = q + dq, nr = r + dr, k = hk(nq, nr);
    if (board.map.has(k) && !wave.vis.has(k)) board.hops.push({ wave, q: nq, r: nr, fq: q, fr: r, v, start: clock.T, at: clock.T + HOP });
  }
}

function gainFlux(v: number, n: BoardNode): void {
  S.flux += v; S.fluxEver += v; n.flash = 1;
  if (board.texts.length < 50) board.texts.push({ q: n.q, r: n.r, t: '+' + fmt(v), life: 1, c: NODES[n.t].col });
}

export function updateBoard(dt: number): void {
  if (!S.collapses) return;
  const T = clock.T;
  board.coreT += dt;
  board.coreFlash = Math.max(0, board.coreFlash - dt * 2);
  if (board.coreT >= stat.pulseCD && S.pulseBank > 0) {
    board.coreT = 0; board.coreFlash = 1;
    emitFrom(0, 0, S.pulseBank, { vis: new Set(['0,0']), echo: false });
    S.pulseBank = 0;
    if (app.view === 'board' && soundOn()) tone(196, .4, .06, 'sine', 392);
  }
  if (board.hops.length) {
    const due: Hop[] = [], rest: Hop[] = [];
    for (const h of board.hops) (T >= h.at ? due : rest).push(h);
    board.hops = rest;
    for (const h of due) {
      const k = hk(h.q, h.r);
      if (h.wave.vis.has(k)) continue;
      const n = board.map.get(k);
      if (!n) continue;
      h.wave.vis.add(k); n.flash = 1;
      let v = h.v;
      if (app.view === 'board') chime(NODES[n.t].chime);
      if (n.t === 'collect') { gainFlux(v, n); continue; }
      if (n.t === 'siphon') gainFlux(v * .5, n);
      if (n.t === 'amp') v *= 2;
      if (n.t === 'echo' && !h.wave.echo) board.echoes.push({ q: n.q, r: n.r, v, at: T + .5 });
      emitFrom(n.q, n.r, v, h.wave);
    }
  }
  for (let i = board.echoes.length - 1; i >= 0; i--) {
    const e = board.echoes[i];
    if (T < e.at) continue;
    board.echoes.splice(i, 1);
    const k = hk(e.q, e.r), n = board.map.get(k);
    if (!n) continue;
    n.flash = 1;
    emitFrom(e.q, e.r, e.v, { vis: new Set([k]), echo: true });
  }
  for (const n of S.board) if (n.flash) n.flash = Math.max(0, n.flash - dt * 2.5);
  for (const t of board.texts) t.life -= dt;
  board.texts = board.texts.filter(t => t.life > 0);
}

/** Place, replace or remove a node with the current tool. On touch, the first tap only picks the hex. */
export function boardClick(x: number, y: number, touch = false): void {
  initAudio();
  const [q, r] = pixHex(x, y);
  if (!inBoard(q, r) || (q === 0 && r === 0)) { board.armed = null; return; }
  if (touch && !(board.armed && board.armed[0] === q && board.armed[1] === r)) {
    board.armed = [q, r];
    board.hover = [q, r];
    tone(520, .06, .04, 'sine', 620);
    return;
  }
  board.armed = null;
  const k = hk(q, r), ex = board.map.get(k);
  const tool = board.tool;
  if (tool === 'remove') {
    if (!ex) return;
    S.flux += ex.c;
    S.board = S.board.filter(n => n !== ex);
    rebuildBoardMap();
    tone(300, .15, .05, 'sine', 150);
    return;
  }
  if (ex && ex.t === tool) return;
  const cost = nodeCost(tool, S.board.length - (ex ? 1 : 0));
  const refund = ex ? ex.c : 0;
  if (S.flux + refund < cost) { tone(140, .15, .05, 'square', 110); return; }
  S.flux += refund - cost;
  if (ex) S.board = S.board.filter(n => n !== ex);
  S.board.push({ q, r, t: tool, c: cost, flash: 1 });
  rebuildBoardMap();
  tone(700, .15, .06, 'triangle', 1100);
}
