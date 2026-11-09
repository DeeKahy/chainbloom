import { blip, refillBudget, soundOn, tone } from '../audio';
import { app, clock } from '../core/app';
import { fmt, rand, TAU } from '../core/util';
import { field, layout, views, type View } from '../render/canvas';
import { colorOf, CRY } from '../render/sprites';
import { S } from '../state/state';
import { earn, tickRate, type Chain } from '../systems/economy';
import { stat } from '../systems/stats';

// ---------- entity types ----------
export interface Orb {
  x: number; y: number; vx: number; vy: number; r: number;
  /** 0 normal, 1 gold, 2 volatile, 3 split */
  type: number;
  hue: number;
  born: number;
  dead: boolean;
  /** >0 while counting down to an Instability detonation. */
  crit: number;
  /** Entangled twin in the other universe (layer 5): popping one pops the other. */
  twin?: Orb | null;
}
export const enum BlastKind { Normal = 0, Critical = 1, Volatile = 2, Crystal = 3, Drone = 4, Mirror = 5, Bloom = 6 }
export interface Blast {
  x: number; y: number; R: number; r: number; depth: number; ch: Chain | null;
  age: number; dur: number; born: number; kind: BlastKind; done: boolean;
  /** Whether it already went through the bridge. */
  jumped: boolean;
}
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; sz: number }
export interface FloatText { x: number; y: number; t: string; size: number; life: number; max: number; c: string }
export interface Crystal {
  id: number; x: number; y: number; adj: Crystal[];
  /** 0 intact, 1 shattering, 2 gone */
  state: 0 | 1 | 2;
  born: number; timer: number; depth: number; ch: Chain | null;
}
export interface Well { x: number; y: number; vx: number; vy: number; a: number; /** Seconds until it spits out a violet orb. */ t: number }
export interface Drone { a: number; t: number; x: number; y: number }
export interface Beam { x1: number; y1: number; x2: number; y2: number; life: number }

/** Radius of a well's glow, in world units. Orbs popped inside it are worth stat.wellMult. */
export const WELL_GLOW = 120;

/** Black hole at the field's centre (layer 4), in world units: pull reach, feeding zone, repelling core. */
export const HOLE_PULL = 420, HOLE_FEED = 210, HOLE_CORE = 46;

// ---------- universes ----------
const CS = 48;
type Grid<T> = Map<number, T[]>;

function makeWorld(index: number) {
  return {
    /** 0 = universe A (always), 1 = universe B (from the first Multiverse on). */
    index,
    view: views[index] as View,
    orbs: [] as Orb[],
    blasts: [] as Blast[],
    parts: [] as Particle[],
    texts: [] as FloatText[],
    crystals: [] as Crystal[],
    wells: [] as Well[],
    drones: [] as Drone[],
    beams: [] as Beam[],
    chains: [] as Chain[],
    grid: new Map() as Grid<Orb>,
    cgrid: new Map() as Grid<Crystal>,
    spawnAcc: 0,
    cryAcc: 0,
    cryId: 0,
    shake: 0,
    flash: 0,
    flashCol: '255,245,220',
    /** Black hole (layer 4): mass fed by nearby pops, and seconds left of the current flare. */
    mass: 0,
    flareT: 0,
    holeA: 0,
    /** Bridge glow, set when a blast passes through. */
    portalFlash: 0,
    /** Events from the other universe, handled at the start of this universe's next update. */
    inbox: {
      blasts: [] as { x: number; y: number; R: number; depth: number; ch: Chain | null; kind: BlastKind }[],
      pops: [] as { orb: Orb; depth: number; ch: Chain | null }[],
      mirrors: [] as { x: number; y: number; t: number }[],
    },
  };
}
export type World = ReturnType<typeof makeWorld>;

/** Both universes. Universe B only runs once the Multiverse is unlocked. */
export const worlds: World[] = [makeWorld(0), makeWorld(1)];

/** The universe being updated or drawn. Everything below works on it; switch with useWorld(). */
export let world: World = worlds[0];
let grid = world.grid, cgrid = world.cgrid;

export function useWorld(w: World): void {
  world = w;
  grid = w.grid; cgrid = w.cgrid;
  field.W = w.view.W; field.H = w.view.H; field.scale = w.view.scale;
}

export const multiverseOn = (): boolean => S.multiverses > 0;
/** The universes that are simulated right now. */
export const activeWorlds = (): World[] => multiverseOn() ? worlds : [worlds[0]];
const other = (w: World): World => worlds[1 - w.index];

// ---------- the bridge ----------
/**
 * The bridge sits on the edge the two universes share on screen: A's right and B's left edge
 * when they are side by side, A's bottom and B's top edge when they are stacked (narrow screens).
 */
const sideBySide = (): boolean => layout.split;

/** How far short of the edge a blast may stop and still go through, in world units. */
const BRIDGE_REACH = 24;
/** Orbs this close to the gate drift toward it, so chains near it tend to cross. */
const BRIDGE_PULL = 230;

/** Centre of this universe's gate (on its edge) and the unit vector pointing out through it. */
export function gate(w: World): { x: number; y: number; nx: number; ny: number } {
  const { W, H } = w.view, a = w.index === 0;
  return sideBySide() ? { x: a ? W : 0, y: H / 2, nx: a ? 1 : -1, ny: 0 } : { x: W / 2, y: a ? H : 0, nx: 0, ny: a ? 1 : -1 };
}

/** A point in universe `from`, mirrored across the shared edge into universe `to` (twins, Mirror). */
function mirrored(x: number, y: number, from: World, to: World): [number, number] {
  const fx = x / from.view.W, fy = y / from.view.H;
  return sideBySide() ? [(1 - fx) * to.view.W, fy * to.view.H] : [fx * to.view.W, (1 - fy) * to.view.H];
}

/** Floating text at universe A's gate (live Threads, cross-world totals). */
export function bridgeText(t: string, c: string, size = 16, w: World = worlds[0]): void {
  if (!multiverseOn() || app.view === 'board' || w.texts.length >= 70) return;
  // spread along the gate so several in a row don't pile up on one spot
  const g = gate(w), s = rand(-.4, .4) * stat.portalSpan;
  w.texts.push({ x: g.x - g.nx * 110 + (g.nx ? 0 : s), y: g.y - g.ny * 70 + (g.ny ? 0 : s), t, size, life: 1.6, max: 1.6, c });
}

/** State shared by both universes. */
export const shared = {
  lastBanner: 0,
  /** The most recently finished chain, for the Stats pane and pinned stats. */
  lastChain: { count: 0, total: 0, depth: 0 },
};

/**
 * The Garden (layer 6) lives in sim/garden.ts and plugs in here, so world.ts doesn't import it:
 * every pop is offered to the flowers of the current universe, and each universe update ticks them.
 */
export const gardenHooks = {
  pop: null as ((o: Orb, depth: number, ch: Chain | null) => void) | null,
  update: null as ((dt: number) => void) | null,
};

/** Hooks so the simulation stays DOM-free: the UI fills these in. */
export const hooks = {
  banner: (_count: number) => { /* set by ui */ },
  chainFinished: (_c: Chain) => { /* set by board */ },
  /** Layer 7: a finished chain may drop a bead on the Loom. */
  bead: (_c: Chain) => { /* set by loom */ },
  flare: () => { /* set by ui */ },
  melody: (_bonus: number) => { /* set by ui */ },
};

// ---------- payouts ----------
/**
 * Pay out an orb's value. After the first Singularity it is dilated (flares lift the exponent for
 * a while), universe B adds its own exponent until Bridge Tuning lifts it, and Quick Time pays less.
 */
function payout(v: number, ch: Chain | null): void {
  let d = 1;
  if (stat.hole) d = Math.min(1, stat.dilation + (world.flareT > 0 ? stat.flareBonus : 0));
  if (world.index === 1) d *= stat.bExp;
  if (d < 1 && v > 1) v = v ** d;
  earn(v, ch);
}

/** Pops near the black hole feed it mass; a full meter sets off a flare. */
function feedHole(x: number, y: number): void {
  const { W, H } = field;
  if ((x - W / 2) ** 2 + (y - H / 2) ** 2 > HOLE_FEED * HOLE_FEED) return;
  world.mass = Math.min(stat.massCap, world.mass + stat.massGain);
  if (world.mass >= stat.massCap && world.flareT <= 0) {
    world.mass = 0;
    world.flareT = stat.flareDur;
    screenFlash('255,170,80', .45);
    world.shake = Math.min(14, world.shake + 6);
    if (soundOn()) { tone(110, 1.4, .12, 'sawtooth', 660); tone(220, 1.2, .06, 'sine', 1320); }
    hooks.flare();
  }
}

const inWellGlow = (x: number, y: number): boolean =>
  world.wells.some(w => (w.x - x) ** 2 + (w.y - y) ** 2 < WELL_GLOW ** 2);

// ---------- spatial hash ----------
const cellKey = (x: number, y: number) => Math.floor(x / CS) + Math.floor(y / CS) * 1024;

function buildGrid<T extends { x: number; y: number; dead?: boolean; state?: number }>(list: T[]): Grid<T> {
  const g: Grid<T> = new Map();
  for (const o of list) {
    if (o.dead || o.state === 2) continue;
    const k = cellKey(o.x, o.y);
    let a = g.get(k);
    if (!a) { a = []; g.set(k, a); }
    a.push(o);
  }
  return g;
}

function near<T>(g: Grid<T>, x: number, y: number, r: number, fn: (o: T) => void): void {
  const x0 = Math.floor((x - r) / CS), x1 = Math.floor((x + r) / CS);
  const y0 = Math.floor((y - r) / CS), y1 = Math.floor((y + r) / CS);
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    const a = g.get(cx + cy * 1024);
    if (a) for (let i = 0; i < a.length; i++) fn(a[i]);
  }
}

// ---------- spawning & effects ----------
/** `force` sets the orb type instead of rolling it (wells spit out violet orbs). Returns the orb. */
export function spawnOrb(x?: number, y?: number, vx?: number, vy?: number, force?: number): Orb {
  const { W, H } = field;
  let type = 0;
  const r = Math.random();
  if (r < stat.pGold) type = 1;
  else if (r < stat.pGold + stat.pVol) type = 2;
  else if (r < stat.pGold + stat.pVol + stat.pSplit) type = 3;
  if (force !== undefined) type = force;
  const a = Math.random() * TAU, sp = rand(6, 22);
  const o: Orb = {
    x: x ?? rand(20, W - 20), y: y ?? rand(20, H - 20),
    vx: vx ?? Math.cos(a) * sp, vy: vy ?? Math.sin(a) * sp,
    r: type ? 8.5 : rand(6, 8), type, hue: Math.random() * 3 | 0, born: clock.T, dead: false, crit: 0,
  };
  world.orbs.push(o);
  return o;
}

/** Entanglement: a fresh orb gets a twin at the mirrored spot in the other universe. */
function maybeEntangle(o: Orb): void {
  if (!multiverseOn() || !stat.pTwin || Math.random() >= stat.pTwin) return;
  const here = world, there = other(here);
  if (there.orbs.length >= stat.cap) return;
  const [tx, ty] = mirrored(o.x, o.y, here, there), side = sideBySide();
  useWorld(there);
  const t = spawnOrb(tx, ty, side ? -o.vx : o.vx, side ? o.vy : -o.vy, o.type);
  t.hue = o.hue;
  useWorld(here);
  o.twin = t; t.twin = o;
}

export function newChain(x: number, y: number, auto = false): Chain {
  const c: Chain = { x, y, total: 0, count: 0, last: clock.T, maxD: 0, auto, home: world.index, cross: 0, hops: 0, notes: '', sang: false };
  world.chains.push(c);
  return c;
}

export function burst(x: number, y: number, c: string, n: number, sp: number, life: number): void {
  for (let i = 0; i < n && world.parts.length < 2600; i++) {
    const a = Math.random() * TAU, s = sp * (.25 + Math.random());
    const l = life * (.6 + Math.random() * .7);
    world.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, c, sz: 1 + Math.random() * 2.2 });
  }
}

export function addBlast(x: number, y: number, R: number, depth: number, ch: Chain | null, kind: BlastKind = BlastKind.Normal): void {
  world.blasts.push({ x, y, R, r: 0, depth, ch, age: 0, dur: .16 + R / 900, born: clock.T, kind, done: false,
    jumped: false });
}

/**
 * A detonation that starts a chain (a click, a drone, a critical orb). With Mirror Universe it may
 * echo at the mirrored spot in the other universe a moment later (echoes are not echoed again).
 */
function detonation(x: number, y: number, R: number, kind: BlastKind, auto: boolean): Chain {
  const ch = newChain(x, y, auto);
  addBlast(x, y, R, 0, ch, kind);
  if (multiverseOn() && stat.mirror && Math.random() < stat.mirror) {
    const there = other(world), [mx, my] = mirrored(x, y, world, there);
    there.inbox.mirrors.push({ x: mx, y: my, t: .6 });
  }
  return ch;
}

/** Player click on the orb field (in the current universe). */
export function detonateAt(x: number, y: number): void {
  if (S.gathering) { burst(x, y, '#ffc4e8', 4, 30, .4); return; } // the Stillness: nothing detonates
  detonation(x, y, stat.clickR, BlastKind.Normal, false);
  burst(x, y, '#e8ecff', 6, 60, .3);
}

function pop(o: Orb, depth: number, ch: Chain | null): void {
  if (o.dead) return;
  o.dead = true;
  const col = colorOf(o);
  const inWell = world.wells.length > 0 && inWellGlow(o.x, o.y);
  payout(stat.value * col.mult * stat.combo ** depth * (inWell ? stat.wellMult : 1), ch);
  if (gardenHooks.pop) gardenHooks.pop(o, depth, ch);
  if (stat.hole) feedHole(o.x, o.y);
  if (inWell) burst(o.x, o.y, '#b98bff', 5, 90, .45);
  if (ch) {
    if (depth > ch.maxD) ch.maxD = depth;
    if (ch.home !== world.index) { ch.cross++; S.crossTotal++; }
    // Melody: the colours of the last five normal orbs this chain popped
    if (stat.melodyMult > 1 && !ch.sang) {
      ch.notes = (ch.notes + (o.type ? 'x' : String(o.hue))).slice(-S.melody.length);
      if (ch.notes === S.melody) ch.sang = true;
    }
  }
  // Entanglement: the twin pops too, in its own universe, as part of the same chain
  if (o.twin) {
    const t = o.twin;
    o.twin = null; t.twin = null;
    if (!t.dead) other(world).inbox.pops.push({ orb: t, depth, ch });
  }
  S.popped++;
  burst(o.x, o.y, col.rgb, o.type === 2 ? 22 : 9 + Math.min(depth, 10), o.type === 2 ? 240 : 140, .55);
  blip(depth, o.type);
  world.shake = Math.min(10, world.shake + .35 + (o.type === 2 ? 1.5 : 0));
  if (o.type === 3) {
    for (let i = 0; i < 3; i++) {
      if (world.orbs.length > stat.cap * 1.6) break;
      const a = Math.random() * TAU;
      spawnOrb(o.x + Math.cos(a) * 6, o.y + Math.sin(a) * 6, Math.cos(a) * 140, Math.sin(a) * 140);
    }
  }
  let nd = depth + 1, R = stat.chainR, kind = BlastKind.Normal;
  if (o.type === 2) { nd = depth; R = stat.chainR * 1.8; kind = BlastKind.Volatile; }
  else if (stat.fission && Math.random() < stat.fission) nd = depth;
  if (nd <= stat.depth && !(ch?.thin && Math.random() < 2 / 3)) addBlast(o.x, o.y, R, nd, ch, kind);
}

function shatter(n: Crystal, depth: number, ch: Chain | null): void {
  if (n.state !== 0) return;
  n.state = 1; n.timer = .035; n.depth = depth; n.ch = ch;
}

function growCrystal(): void {
  const { W, H } = field, crystals = world.crystals;
  if (crystals.length >= stat.cryCap) return;
  let x: number, y: number, parent: Crystal | null = null;
  if (!crystals.length || Math.random() < .03) { x = rand(30, W - 30); y = rand(30, H - 30); }
  else {
    parent = crystals[Math.random() * crystals.length | 0];
    if (parent.state !== 0) return;
    const a = Math.random() * TAU;
    x = parent.x + Math.cos(a) * 15; y = parent.y + Math.sin(a) * 15;
  }
  if (x < 10 || y < 10 || x > W - 10 || y > H - 10) return;
  let ok = true;
  near(cgrid, x, y, 12, c => { if (c.state === 0 && (c.x - x) ** 2 + (c.y - y) ** 2 < 121) ok = false; });
  if (!ok) return;
  const n: Crystal = { id: world.cryId++, x, y, adj: [], state: 0, born: clock.T, timer: 0, depth: 0, ch: null };
  if (parent) { n.adj.push(parent); parent.adj.push(n); }
  near(cgrid, x, y, 18, c => {
    if (c !== parent && c.state === 0 && n.adj.length < 3 && (c.x - x) ** 2 + (c.y - y) ** 2 < 324) { n.adj.push(c); c.adj.push(n); }
  });
  crystals.push(n);
  const k = cellKey(x, y);
  let a = cgrid.get(k);
  if (!a) { a = []; cgrid.set(k, a); }
  a.push(n);
}

/** Drones aim at a random sample of orbs and pick the one with the most neighbours. */
export function findTarget(): Orb | null {
  const alive = world.orbs.filter(o => !o.dead && !o.crit);
  if (alive.length < 2) return null;
  let best: Orb | null = null, bestN = -1;
  const rr = (stat.clickR * .85) ** 2;
  for (let i = 0; i < 28; i++) {
    const o = alive[Math.random() * alive.length | 0];
    let c = 0;
    near(grid, o.x, o.y, stat.clickR, p => { if (!p.dead && (p.x - o.x) ** 2 + (p.y - o.y) ** 2 < rr) c++; });
    if (c > bestN) { bestN = c; best = o; }
  }
  return best;
}

/** A fresh random melody: five notes, each one of the three normal orb colours. */
export const newMelody = (): string => Array.from({ length: 5 }, () => String(Math.random() * 3 | 0)).join('');

function finishChain(c: Chain): void {
  if (c.sang) {
    // Melody: the chain played the target, so its whole payout is multiplied
    const bonus = c.total * (stat.melodyMult - 1);
    earn(bonus, null);
    c.total += bonus;
    if (soundOn()) [...S.melody].forEach((n, i) => setTimeout(() => tone(523 * 1.26 ** +n, .25, .07, 'triangle', 523 * 1.26 ** +n), i * 110));
    S.melody = newMelody();
    hooks.melody(bonus);
  }
  if (c.count > S.best) S.best = c.count;
  if (c.hops > S.hopBest) S.hopBest = c.hops;
  if (c.cross > S.crossBest) S.crossBest = c.cross;
  if (c.count) shared.lastChain = { count: c.count, total: c.total, depth: c.maxD };
  hooks.chainFinished(c);
  hooks.bead(c);
  if (app.view === 'board') return;
  if (c.count >= 1 && world.texts.length < 70) {
    const big = Math.log2(c.count + 1);
    world.texts.push({ x: c.x, y: c.y - 10, t: '+' + fmt(c.total), size: 12 + big * 3.2, life: 1.1 + big * .1, max: 1.1 + big * .1,
      c: c.sang ? '#7dffb0' : c.cross ? '#7fd4ff' : c.maxD >= 4 ? '#ffd34d' : c.maxD >= 2 ? '#b98bff' : '#e8ecff' });
  }
  if (c.cross >= 25) bridgeText('⇄ ' + fmt(c.cross) + ' crossed', '#bfe9ff', 13 + Math.log2(c.cross) * 1.5, world);
  if (c.count >= 15 && clock.T - shared.lastBanner > .5) {
    shared.lastBanner = clock.T;
    hooks.banner(c.count);
    if (soundOn()) tone(392 + Math.min(c.count, 300), .5, .07, 'triangle', 784 + Math.min(c.count, 300));
  }
}

// ---------- resets ----------

/** Remove everything that belongs to the current run, in both universes (used by every prestige/rift reset). */
export function clearRun(): void {
  for (const w of worlds) {
    w.orbs = []; w.crystals = []; w.chains = []; w.blasts = [];
    w.inbox.blasts = []; w.inbox.pops = []; w.inbox.mirrors = [];
  }
}

/** Remove everything, including cosmetic leftovers. Used by Wipe and import. */
export function clearAll(): void {
  clearRun();
  for (const w of worlds) {
    w.parts = []; w.texts = []; w.wells = []; w.drones = []; w.beams = [];
    w.mass = 0; w.flareT = 0; w.shake = 0; w.flash = 0;
  }
}

/** The Stillness begins: every blast in flight fizzles, so the chains running now end. */
export function stillAll(): void {
  for (const w of worlds) {
    for (const b of w.blasts) b.done = true;
    w.inbox.blasts = []; w.inbox.pops = []; w.inbox.mirrors = [];
    for (const o of w.orbs) o.crit = 0;
  }
}

/** Reset both black holes (Singularity and Multiverse). */
export function clearHoles(): void {
  for (const w of worlds) { w.mass = 0; w.flareT = 0; }
}

export function screenFlash(col: string, amount: number): void {
  world.flashCol = col;
  world.flash = amount;
}

// ---------- update ----------
/** Once per frame, before the universes: the clock, play time and the income rate. */
export function tickGlobal(dt: number): void {
  clock.T += dt;
  S.playTime += dt;
  S.runTime += dt;
  S.colTime += dt;
  S.mvTime += dt;
  refillBudget(dt);
  tickRate(dt);
}

/** Whether a blast at (x, y) with radius r has reached this universe's bridge. */
function atBridge(b: Blast): boolean {
  const g = gate(world);
  // distance along the edge from the gate centre, and how far the blast reaches past the edge line
  const along = g.nx ? Math.abs(b.y - g.y) : Math.abs(b.x - g.x);
  if (along > stat.portalSpan / 2) return false;
  const out = g.nx ? (b.x - g.x) * g.nx : (b.y - g.y) * g.ny;
  return out + b.r >= -BRIDGE_REACH;
}

/** Update the current universe (see useWorld). Quick Time passes a larger dt. */
export function updateField(dt: number): void {
  const { W, H } = field;
  const T = clock.T, mv = multiverseOn();

  // events from the other universe
  const ib = world.inbox;
  if (ib.blasts.length) {
    for (const e of ib.blasts) {
      addBlast(e.x, e.y, e.R, e.depth, e.ch, e.kind);
      world.blasts[world.blasts.length - 1].jumped = true; // arrived through the bridge: it cannot go straight back
      burst(e.x, e.y, '#7fd4ff', 10, 160, .5);
    }
    world.portalFlash = 1;
    ib.blasts = [];
  }
  if (ib.pops.length) {
    const pops = ib.pops; ib.pops = [];
    for (const e of pops) if (!e.orb.dead) { burst(e.orb.x, e.orb.y, '#c9a6ff', 6, 120, .5); pop(e.orb, e.depth, e.ch); }
  }
  for (const m of ib.mirrors) {
    m.t -= dt;
    if (m.t <= 0) {
      const ch = newChain(m.x, m.y, true);
      addBlast(m.x, m.y, stat.clickR, 0, ch, BlastKind.Mirror);
      burst(m.x, m.y, '#d9b8ff', 8, 90, .4);
    }
  }
  if (ib.mirrors.length) ib.mirrors = ib.mirrors.filter(m => m.t > 0);

  // spawning
  world.spawnAcc += stat.spawn * dt;
  while (world.spawnAcc >= 1) {
    world.spawnAcc -= 1;
    if (world.orbs.length < stat.cap) maybeEntangle(spawnOrb());
  }


  // wells
  const wells = world.wells;
  while (wells.length < stat.wells) wells.push({ x: rand(W * .2, W * .8), y: rand(H * .2, H * .8), vx: rand(-18, 18), vy: rand(-18, 18), a: 0, t: rand(.5, stat.wellOrbEvery) });
  if (wells.length > stat.wells) wells.length = stat.wells;
  for (const w of wells) {
    w.x += w.vx * dt; w.y += w.vy * dt; w.a += dt;
    if (w.x < 80 || w.x > W - 80) w.vx *= -1;
    if (w.y < 80 || w.y > H - 80) w.vy *= -1;
    w.x = Math.max(79, Math.min(W - 79, w.x)); w.y = Math.max(79, Math.min(H - 79, w.y));
    // Every few seconds a well spits a violet (Mitosis) orb out of its core, flung into the swirl.
    w.t -= dt;
    if (w.t <= 0) {
      w.t = stat.wellOrbEvery * rand(.85, 1.15);
      if (world.orbs.length < stat.cap) {
        const a = Math.random() * TAU, ox = Math.cos(a), oy = Math.sin(a);
        spawnOrb(w.x + ox * 34, w.y + oy * 34, ox * 70 - oy * 45, oy * 70 + ox * 45, 3);
        burst(w.x + ox * 34, w.y + oy * 34, '#b98bff', 8, 80, .4);
      }
    }
  }

  // black hole (layer 4)
  if (stat.hole) {
    world.holeA += dt * (world.flareT > 0 ? 2.4 : .8);
    if (world.flareT > 0) world.flareT = Math.max(0, world.flareT - dt);
  }
  const hx = W / 2, hy = H / 2;

  // the bridge pulls nearby orbs toward its gate, and sparks drift into it
  const gt = mv ? gate(world) : null, half = stat.portalSpan / 2;
  if (gt && Math.random() < dt * 10) {
    const s = rand(-half, half), d = rand(60, 200);
    const px = gt.nx ? gt.x - gt.nx * d : gt.x + s, py = gt.ny ? gt.y - gt.ny * d : gt.y + s;
    const l = d / 140;
    world.parts.push({ x: px, y: py, vx: gt.nx * 140, vy: gt.ny * 140, life: l, max: l, c: '#7fd4ff', sz: 1.5 + Math.random() * 1.5 });
  }

  // orbs
  const damp = 1 - .55 * dt;
  for (const o of world.orbs) {
    if (o.dead) continue;
    o.vx += (Math.random() - .5) * 40 * dt; o.vy += (Math.random() - .5) * 40 * dt;
    for (const w of wells) {
      const dx = w.x - o.x, dy = w.y - o.y, d = Math.hypot(dx, dy);
      if (d < 320 && d > 1) {
        const f = 110 * (1 - d / 320) * dt * (d < 30 ? -.5 : 1);
        o.vx += (dx / d * f) - (dy / d) * f * .55;
        o.vy += (dy / d * f) + (dx / d) * f * .55;
      }
    }
    if (stat.hole) {
      // a stronger, wider swirl than a well; the core pushes orbs back out so they orbit instead of vanishing
      const dx = hx - o.x, dy = hy - o.y, d = Math.hypot(dx, dy);
      if (d < HOLE_PULL && d > 1) {
        const f = 150 * (1 - d / HOLE_PULL) * dt * (d < HOLE_CORE ? -1.4 : 1);
        o.vx += (dx / d * f) - (dy / d) * f * .7;
        o.vy += (dy / d * f) + (dx / d) * f * .7;
      }
    }
    if (gt) {
      // toward the nearest point of the gate segment
      const qx = gt.nx ? gt.x : Math.max(gt.x - half, Math.min(gt.x + half, o.x));
      const qy = gt.ny ? gt.y : Math.max(gt.y - half, Math.min(gt.y + half, o.y));
      const dx = qx - o.x, dy = qy - o.y, d = Math.hypot(dx, dy);
      if (d < BRIDGE_PULL && d > 1) {
        const f = 55 * (1 - d / BRIDGE_PULL) * dt;
        o.vx += dx / d * f; o.vy += dy / d * f;
      }
    }
    o.vx *= damp; o.vy *= damp;
    const sp = Math.hypot(o.vx, o.vy);
    if (sp > 160) { o.vx *= 160 / sp; o.vy *= 160 / sp; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx); } else if (o.x > W - o.r) { o.x = W - o.r; o.vx = -Math.abs(o.vx); }
    if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy); } else if (o.y > H - o.r) { o.y = H - o.r; o.vy = -Math.abs(o.vy); }
    if (stat.unstable && !o.crit && Math.random() < stat.unstable * dt) o.crit = .7;
    if (T - o.born > stat.orbLifetime) { o.dead = true; burst(o.x, o.y, 'rgb(90,100,130)', 4, 40, .4); }
  }

  grid = world.grid = buildGrid(world.orbs);
  cgrid = world.cgrid = buildGrid(world.crystals);

  // critical orbs (Instability)
  for (const o of world.orbs) {
    if (o.dead || !o.crit) continue;
    o.crit -= dt;
    if (o.crit <= 0) {
      const ch = detonation(o.x, o.y, stat.chainR * 1.3, BlastKind.Critical, true);
      pop(o, 0, ch);
    }
  }

  // blasts (only those that existed at the start of this frame expand this frame)
  const n = world.blasts.length;
  for (let i = 0; i < n; i++) {
    const b = world.blasts[i];
    b.age += dt;
    const p = Math.min(1, b.age / b.dur);
    b.r = b.R * (1 - (1 - p) ** 3);
    if (b.done || S.gathering) continue; // the Stillness: blasts still fade out, but pop nothing
    near(grid, b.x, b.y, b.r + 9, o => {
      if (!o.dead && o.born < b.born && (o.x - b.x) ** 2 + (o.y - b.y) ** 2 < (b.r + o.r) ** 2) pop(o, b.depth, b.ch);
    });
    if (world.crystals.length) near(cgrid, b.x, b.y, b.r, c => {
      if (c.state === 0 && (c.x - b.x) ** 2 + (c.y - b.y) ** 2 < b.r * b.r) shatter(c, b.depth, b.ch);
    });
    // The bridge: a blast that reaches it carries on in the other universe, as part of the same chain
    if (mv && !b.jumped && b.ch && b.kind !== BlastKind.Crystal && atBridge(b)) {
      b.jumped = true;
      b.ch.hops++;
      const there = other(world);
      // it comes out of the other gate at the same offset along the edge
      const g = gate(world), tg = gate(there);
      const x = tg.nx ? tg.x - tg.nx * 4 : Math.max(10, Math.min(there.view.W - 10, tg.x + (b.x - g.x)));
      const y = tg.ny ? tg.y - tg.ny * 4 : Math.max(10, Math.min(there.view.H - 10, tg.y + (b.y - g.y)));
      there.inbox.blasts.push({ x, y, R: b.R, depth: b.depth, ch: b.ch, kind: b.kind });
      world.portalFlash = 1;
    }
    if (p >= 1) b.done = true;
  }
  world.blasts = world.blasts.filter(b => b.age < b.dur + .35);
  world.portalFlash = Math.max(0, world.portalFlash - dt * 2.5);

  // crystals
  if (stat.cryRate) {
    world.cryAcc += stat.cryRate * dt;
    while (world.cryAcc >= 1) { world.cryAcc -= 1; growCrystal(); }
  }
  let cryDead = false;
  for (const c of world.crystals) {
    if (c.state !== 1) continue;
    c.timer -= dt;
    if (c.timer <= 0) {
      c.state = 2; cryDead = true;
      payout(stat.value * stat.cryVal * stat.combo ** c.depth, c.ch);
      burst(c.x, c.y, CRY, 5, 110, .45);
      blip(c.depth + 1, 0);
      addBlast(c.x, c.y, 26, c.depth, c.ch, BlastKind.Crystal);
      for (const a of c.adj) shatter(a, c.depth, c.ch);
      world.shake = Math.min(10, world.shake + .15);
    }
  }
  if (cryDead) world.crystals = world.crystals.filter(c => c.state !== 2);

  // drones
  const drones = world.drones;
  while (drones.length < stat.drones) drones.push({ a: Math.random() * TAU, t: rand(.5, stat.interval), x: W / 2, y: H / 2 });
  if (drones.length > stat.drones) drones.length = stat.drones;
  drones.forEach((d, i) => {
    d.a += dt * (.18 + i * .03);
    d.x = W / 2 + Math.cos(d.a + i * TAU / drones.length) * (W * .44);
    d.y = H / 2 + Math.sin(d.a + i * TAU / drones.length) * (H * .42);
    d.t -= dt;
    if (d.t <= 0) {
      const tg = findTarget();
      if (!tg) { d.t = .4; return; }
      d.t = stat.interval * rand(.9, 1.1);
      world.beams.push({ x1: d.x, y1: d.y, x2: tg.x, y2: tg.y, life: .2 });
      detonation(tg.x, tg.y, stat.clickR, BlastKind.Drone, true);
    }
  });
  for (const b of world.beams) b.life -= dt;
  world.beams = world.beams.filter(b => b.life > 0);

  if (gardenHooks.update) gardenHooks.update(dt);

  // particles & texts
  const pd = 1 - 2.2 * dt;
  for (const p of world.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= pd; p.vy *= pd; }
  world.parts = world.parts.filter(p => p.life > 0);
  for (const t of world.texts) { t.life -= dt; t.y -= 28 * dt; }
  world.texts = world.texts.filter(t => t.life > 0);

  // chains end once nothing has popped for 0.35s (pops in the other universe keep them alive)
  for (const c of world.chains) if (T - c.last > .35) { c.over = true; finishChain(c); }
  world.chains = world.chains.filter(c => !c.over);

  world.orbs = world.orbs.filter(o => !o.dead);
  world.shake *= Math.max(0, 1 - 8 * dt);
  world.flash = Math.max(0, world.flash - dt * .8);
}
