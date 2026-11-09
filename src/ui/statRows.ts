import { fmt } from '../core/util';
import { RIFTS } from '../content/rifts';
import { multiverseOn, shared, world, worlds } from '../sim/world';
import { S } from '../state/state';
import { stat } from '../systems/stats';

/** One line of the Stats pane. The id is saved in S.pinned, so never rename one. */
export interface StatRow {
  id: string;
  label: string;
  value: () => string;
}

const lastChain = (): string => {
  const c = shared.lastChain;
  return c.count ? `${fmt(c.count)} pops · depth ${c.depth} · $${fmt(c.total)}` : '-';
};

export const STAT_ROWS: StatRow[] = [
  { id: 'money', label: 'Money', value: () => '$' + fmt(S.money) },
  { id: 'runEarned', label: 'Earned this run', value: () => '$' + fmt(S.runEarned) },
  { id: 'total', label: 'Earned all time', value: () => '$' + fmt(S.total) },
  { id: 'popped', label: 'Orbs popped', value: () => fmt(S.popped) },
  { id: 'lastChain', label: 'Last chain', value: lastChain },
  { id: 'best', label: 'Biggest chain', value: () => fmt(S.best) },
  { id: 'novas', label: 'Supernovas', value: () => String(S.novas) },
  { id: 'starsEver', label: 'Stardust earned', value: () => fmt(S.starsEver) },
  { id: 'value', label: 'Orb value', value: () => fmt(stat.value) },
  { id: 'depth', label: 'Chain depth', value: () => String(stat.depth) },
  { id: 'combo', label: 'Resonance', value: () => '×' + stat.combo.toFixed(2) + ' / step' },
  { id: 'maxMult', label: 'Max chain multiplier', value: () => '×' + fmt(stat.combo ** stat.depth) },
  { id: 'orbs', label: 'Orbs on field', value: () => multiverseOn()
    ? `A ${worlds[0].orbs.length} · B ${worlds[1].orbs.length} (max ${stat.cap} each)` : `${world.orbs.length} / ${stat.cap}` },
  { id: 'collapses', label: 'Collapses', value: () => String(S.collapses) },
  { id: 'dmEver', label: 'Dark Matter earned', value: () => fmt(S.dmEver) },
  { id: 'fluxEver', label: 'Flux earned', value: () => fmt(S.fluxEver) },
  { id: 'fluxMult', label: 'Flux bonus', value: () => '×' + fmt(stat.fluxMult) },
  { id: 'rifts', label: 'Rifts sealed', value: () => `${S.riftsDone.length} / ${RIFTS.length}` },
  { id: 'singularities', label: 'Singularities', value: () => String(S.singularities) },
  { id: 'singEver', label: 'Singularity earned', value: () => fmt(S.singEver) },
  { id: 'cyclePeak', label: 'Best run this cycle', value: () => '$' + fmt(S.cyclePeak) },
  { id: 'dilation', label: 'Dilation', value: () => stat.hole ? '^' + Math.min(1, stat.dilation + (world.flareT > 0 ? stat.flareBonus : 0)).toFixed(2) : 'none' },
  { id: 'mass', label: 'Black hole mass', value: () => !stat.hole ? '-' : multiverseOn()
    ? worlds.map((w, i) => `${i ? 'B' : 'A'} ${Math.floor(w.mass / stat.massCap * 100)}%`).join(' · ') : Math.floor(world.mass / stat.massCap * 100) + '%' },
  { id: 'multiverses', label: 'Multiverses', value: () => String(S.multiverses) },
  { id: 'threadsEver', label: 'Threads earned', value: () => fmt(S.threadsEver) },
  { id: 'crossBest', label: 'Best cross-world chain', value: () => fmt(S.crossBest) + ' pops' },
  { id: 'hopBest', label: 'Most bridge crossings in one chain', value: () => String(S.hopBest) },
  { id: 'pollenEver', label: 'Pollen earned', value: () => fmt(S.pollenEver) },
  { id: 'knotsEver', label: 'Knots earned', value: () => fmt(S.knotsEver) },
  { id: 'bangs', label: 'Big Bangs', value: () => String(S.bangs) },
  { id: 'crossTotal', label: 'Cross-world pops this cycle', value: () => fmt(S.crossTotal) },
  { id: 'chainMem', label: 'Chain Memory', value: () => '×' + stat.chainMem.toFixed(2) + (S.sl.memory ? '' : ' (not bought)') },
  { id: 'playTime', label: 'Play time', value: () => Math.floor(S.playTime / 3600) + 'h ' + Math.floor(S.playTime / 60 % 60) + 'm' },
];

export function togglePin(id: string): void {
  const i = S.pinned.indexOf(id);
  if (i >= 0) S.pinned.splice(i, 1); else S.pinned.push(id);
}

/** Pinned rows in the order they were pinned, skipping ids that no longer exist. */
export const pinnedRows = (): StatRow[] =>
  S.pinned.map(id => STAT_ROWS.find(r => r.id === id)).filter((r): r is StatRow => !!r);
