import { soundOn, tone } from '../audio';
import { clock } from '../core/app';
import { rand, TAU } from '../core/util';
import { crossCost, FLOWER_REACH, PATTERNS, STARTER_SEEDS, TRIGGERS, WILT, type Bed, type Seed } from '../content/garden';
import { field } from '../render/canvas';
import { NORMALS } from '../render/sprites';
import { S } from '../state/state';
import type { Chain } from '../systems/economy';
import { recalc, stat } from '../systems/stats';
import { addBlast, BlastKind, burst, findTarget, gardenHooks, gate, multiverseOn, newChain, world, worlds, type Orb, type World } from './world';

/**
 * Layer 6: flowers on the orb field. A flower is a planted seed (S.garden.beds); its growth is
 * transient. Pops near it (by its trigger gene) grow it, and a full flower blooms: it fires its
 * pattern gene as blasts in the chain that fed it, with the depth wound back by
 * stat.refresh + floor(potency / 2), so a well-placed garden keeps chains going. Each flower blooms
 * at most once per chain (Chain.bloomed): a chain can run through the whole garden, but it ends.
 */
export interface Flower {
  bed: Bed;
  seed: Seed;
  x: number;
  y: number;
  growth: number;
  /** Seconds left resting after a bloom. */
  wilt: number;
  /** 1 → 0 after a bloom, for the flash. */
  glow: number;
}

/** Flowers per universe, rebuilt from S.garden whenever the beds change (gardenChanged). */
const flowers: Flower[][] = [[], []];
let builtFor = -1;
/** Bump after changing S.garden.beds or seeds, so the flowers are rebuilt. */
export const garden = { ver: 0 };

/** Delayed Echo rings, per universe. */
const later: { x: number; y: number; R: number; depth: number; ch: Chain | null; t: number }[][] = [[], []];

export const seedById = (id: number): Seed | undefined => S.garden.seeds.find(s => s.id === id);

function rebuild(): void {
  builtFor = garden.ver;
  for (let w = 0; w < 2; w++) {
    const old = flowers[w];
    flowers[w] = S.garden.beds.filter(b => b.w === w).flatMap(bed => {
      const seed = seedById(bed.seed);
      if (!seed) return [];
      const prev = old.find(f => f.bed === bed);
      return [{ bed, seed, x: 0, y: 0, growth: prev?.growth ?? 0, wilt: prev?.wilt ?? 0, glow: prev?.glow ?? 0 }];
    });
  }
}

/** The current universe's flowers, placed in its world units (the layout may have changed). */
export function flowersOf(w: World): Flower[] {
  if (builtFor !== garden.ver) rebuild();
  const list = flowers[w.index];
  for (const f of list) { f.x = f.bed.fx * w.view.W; f.y = f.bed.fy * w.view.H; }
  return list;
}

// ---------- growth and blooms ----------
function feed(o: Orb, depth: number, ch: Chain | null): void {
  if (!S.gardenOn || !S.garden.beds.length || S.gathering) return;
  const list = flowersOf(world);
  if (!list.length) return;
  const crossPop = !!ch && ch.home !== world.index;
  for (const f of list) {
    if (f.wilt > 0) continue;
    let g = 0;
    if (f.seed.t === 'cross') g = crossPop ? 1 : 0;
    else {
      if ((o.x - f.x) ** 2 + (o.y - f.y) ** 2 > FLOWER_REACH * FLOWER_REACH) continue;
      if (f.seed.t === 'pop') g = 1;
      else if (f.seed.t === 'hue') g = !o.type && o.hue === f.seed.hue ? 3 : 0;
      else if (f.seed.t === 'deep') g = depth >= 5 ? 4 : 0;
    }
    if (!g) continue;
    f.growth = Math.min(stat.growNeed, f.growth + g);
    // a full flower waits for a chain it hasn't bloomed for yet
    if (f.growth >= stat.growNeed && !ch?.bloomed?.includes(f.bed)) bloom(f, depth, ch);
  }
}

function bloom(f: Flower, depth: number, ch: Chain | null): void {
  f.growth = 0; f.wilt = WILT; f.glow = 1;
  const s = f.seed, pot = s.pot;
  const ch2 = ch ?? newChain(f.x, f.y, true);
  (ch2.bloomed ??= []).push(f.bed);
  // the bloom carries on the chain that fed it, with its depth wound back
  const d = Math.max(0, depth - stat.refresh - Math.floor(pot / 2));
  const R = stat.chainR * (1 + .15 * pot);
  const { W, H } = field;
  switch (s.p) {
    case 'ring': addBlast(f.x, f.y, R * 1.6, d, ch2, BlastKind.Bloom); break;
    case 'spray':
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + clock.T, r = 70 + 10 * pot;
        addBlast(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, R, d, ch2, BlastKind.Bloom);
      }
      break;
    case 'lance': {
      // toward the bridge's gate, or the centre before the Multiverse
      let tx = W / 2, ty = H / 2;
      if (multiverseOn()) { const g = gate(world); tx = g.x; ty = g.y; }
      const dx = tx - f.x, dy = ty - f.y, len = Math.hypot(dx, dy) || 1;
      for (let i = 1; i <= 3 + pot; i++) addBlast(f.x + dx / len * 75 * i, f.y + dy / len * 75 * i, R, d, ch2, BlastKind.Bloom);
      break;
    }
    case 'seek':
      for (let i = 0; i < 1 + Math.ceil(pot / 2); i++) {
        const t = findTarget();
        if (t) addBlast(t.x, t.y, R * 1.2, d, ch2, BlastKind.Bloom);
      }
      break;
    case 'gild': {
      const rr = (90 + 15 * pot) ** 2;
      for (const o of world.orbs) if (!o.dead && !o.type && (o.x - f.x) ** 2 + (o.y - f.y) ** 2 < rr) o.type = 1;
      addBlast(f.x, f.y, R, d, ch2, BlastKind.Bloom);
      break;
    }
    case 'echo':
      addBlast(f.x, f.y, R * 1.3, d, ch2, BlastKind.Bloom);
      for (let i = 1; i <= 2; i++) later[world.index].push({ x: f.x, y: f.y, R: R * 1.3, depth: d, ch: ch2, t: .45 * i });
      break;
  }
  burst(f.x, f.y, NORMALS[s.hue].rgb, 14 + pot * 3, 160, .7);
  burst(f.x, f.y, '#7dffb0', 8, 90, .6);
  const p = 2 * pot * stat.pollenMult;
  S.pollen += p; S.pollenEver += p;
  if (soundOn()) tone(659 * 1.26 ** (s.hue + (PATTERNS.findIndex(x => x.id === s.p) % 3)), .3, .05, 'triangle', 1318);
}

function update(dt: number): void {
  if (!S.gardenOn) return;
  for (const f of flowersOf(world)) {
    if (f.wilt > 0) f.wilt -= dt;
    if (f.glow > 0) f.glow = Math.max(0, f.glow - dt * 1.5);
  }
  const l = later[world.index];
  if (!l.length) return;
  for (const e of l) { e.t -= dt; if (e.t <= 0) addBlast(e.x, e.y, e.R, e.depth, e.ch, BlastKind.Bloom); }
  later[world.index] = l.filter(e => e.t > 0);
}

gardenHooks.pop = feed;
gardenHooks.update = update;

/** Forget delayed blooms (resets clear the field). */
export function clearGardenFx(): void {
  later[0] = []; later[1] = [];
  for (const list of flowers) for (const f of list) { f.growth = 0; f.wilt = 0; }
}

// ---------- seeds: unlock, planting, breeding ----------
function addSeed(s: Omit<Seed, 'id'>): Seed {
  const seed = { ...s, id: S.garden.next++ };
  S.garden.seeds.push(seed);
  if (seed.pot > S.potBest) S.potBest = seed.pot;
  garden.ver++;
  return seed;
}

/** First time the Garden opens: two starter seeds. */
export function openGarden(): void {
  S.gardenOn = true;
  if (!S.garden.seeds.length) for (const s of STARTER_SEEDS) addSeed(s);
  recalc();
}

export const plantedCount = (): number => S.garden.beds.length;
export const isPlanted = (id: number): boolean => S.garden.beds.some(b => b.seed === id);

/** Plant a seed at a point of universe `w` (world units). Returns false if every bed is in use. */
export function plantAt(id: number, w: number, x: number, y: number): boolean {
  const v = worlds[w].view;
  if (!seedById(id) || isPlanted(id) || plantedCount() >= stat.beds) return false;
  S.garden.beds.push({ seed: id, w, fx: Math.min(.97, Math.max(.03, x / v.W)), fy: Math.min(.97, Math.max(.03, y / v.H)) });
  garden.ver++;
  return true;
}

export function uproot(id: number): void {
  S.garden.beds = S.garden.beds.filter(b => b.seed !== id);
  garden.ver++;
}

export function discard(id: number): void {
  uproot(id);
  S.garden.seeds = S.garden.seeds.filter(s => s.id !== id);
  garden.ver++;
}

const pick = <T>(a: T, b: T): T => Math.random() < .5 ? a : b;
const randomOf = <T>(list: T[]): T => list[Math.random() * list.length | 0];

/**
 * Cross two seeds: each gene from either parent; with stat.mutate a gene (pattern, trigger or colour)
 * changes to a random one; potency is the better parent's, +1 a third of the time (up to stat.potMax).
 * Returns the child, or null if it can't be afforded or the bank is full.
 */
export function crossSeeds(a: Seed, b: Seed): Seed | null {
  const cost = crossCost(S.crosses);
  if (S.pollen < cost || S.garden.seeds.length >= stat.bank) return null;
  S.pollen -= cost;
  S.crosses++;
  const child = { p: pick(a.p, b.p), t: pick(a.t, b.t), hue: pick(a.hue, b.hue), pot: Math.max(a.pot, b.pot) };
  if (Math.random() < stat.mutate) {
    const r = Math.random();
    if (r < .4) child.p = randomOf(PATTERNS).id;
    else if (r < .8) child.t = randomOf(TRIGGERS).id;
    else child.hue = rand(0, 3) | 0;
  }
  if (Math.random() < 1 / 3) child.pot = Math.min(stat.potMax, child.pot + 1);
  return addSeed(child);
}
