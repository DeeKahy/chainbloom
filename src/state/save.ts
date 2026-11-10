import { normalizeFarm } from '../eras/farm/state';
import { fresh, replaceState, S, sanitizeState, SAVE_VERSION, type GameState } from './state';

/** Kept from the original single-file game so existing saves still load. */
const KEY = 'chainbloom_v1';

type RawSave = Partial<GameState> & Record<string, unknown>;

/**
 * Ordered migrations. MIGRATIONS[i] upgrades a save from version i+1 to i+2.
 * Saves from the single-file game have no version field and count as version 1.
 */
const MIGRATIONS: ((d: RawSave) => void)[] = [
  // 1 → 2: starsCycle added late in v1; pulseBank became persistent.
  d => {
    if (d.starsCycle === undefined) d.starsCycle = (d.starsEver as number) || 0;
    if (d.pulseBank === undefined) d.pulseBank = 0;
  },
  // 2 → 3: stats can be pinned to the orb field.
  d => {
    if (!Array.isArray(d.pinned)) d.pinned = [];
  },
  // 3 → 4: layer 4 (Singularity). Before the first one, the "cycle" is the whole game so far,
  // so the gain starts from all money ever earned.
  d => {
    if (d.cyclePeak === undefined) d.cyclePeak = typeof d.total === 'number' ? d.total : 0;
  },
  // 4 → 5: Stardust Autobuyer toggle (on by default; it does nothing until the upgrade is bought).
  d => {
    if (typeof d.autoStar !== 'boolean') d.autoStar = true;
  },
  // 5 → 6: layer 5 (Multiverse). New fields start at their defaults.
  d => {
    if (!Array.isArray(d.laws)) d.laws = ['', ''];
    if (typeof d.melody !== 'string') d.melody = '01201';
  },
  // 6 → 7: Threads also flow in live from every cross-world pop.
  d => {
    if (typeof d.crossTotal !== 'number') d.crossTotal = 0;
    if (typeof d.threadsLive !== 'number') d.threadsLive = 0;
  },
  // 7 → 8: layers 6-8 (Garden, Loom, Big Bang). Everything starts locked and empty; fresh() fills the rest.
  d => {
    if (typeof d.hopBest !== 'number') d.hopBest = 0;
  },
  // 8 → 9: the Repulsion law is gone. A universe set to it goes back to none. If it was the only Law
  // owned, the next one is free again (as the first Law always is); otherwise its 4 Threads come back.
  d => {
    if (Array.isArray(d.laws)) d.laws = d.laws.map(l => l === 'repel' ? '' : l);
    const tl = d.tl as Record<string, number> | undefined;
    if (tl?.lawRepel) {
      const others = ['lawSquare', 'lawFlip', 'lawQuick'].some(id => tl[id] > 0);
      if (others && typeof d.threads === 'number') d.threads += 4;
      delete tl.lawRepel;
    }
  },
  // 9 → 10: the Laws of Physics are gone entirely, with no refund.
  d => {
    delete d.laws;
    const tl = d.tl as Record<string, number> | undefined;
    if (tl) for (const id of ['lawSquare', 'lawFlip', 'lawQuick', 'lawRepel']) delete tl[id];
  },
  // 10 → 11: eras. Every save so far is in the space era; the farm starts empty (fresh() fills it).
  d => {
    if (typeof d.era !== 'number') d.era = 0;
  },
];

/**
 * Turn any parsed save object into a complete, current GameState.
 * A save from a NEWER version (e.g. after rolling the game back) is loaded as well as this version
 * can: unknown fields are kept and written back, and the version number is not lowered, so the
 * newer game still reads it correctly. Refusing it would start a fresh game that autosaves over it.
 */
export function normalize(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new Error('Save is not an object');
  const d = { ...(raw as RawSave) };
  let v = typeof d.version === 'number' ? d.version : 1;
  const newer = v > SAVE_VERSION;
  for (; v < SAVE_VERSION; v++) MIGRATIONS[v - 1](d);
  const f = fresh();
  const out: GameState = Object.assign(f, d);
  // Merge level maps so upgrades added later start at 0 instead of undefined.
  out.lv = Object.assign(fresh().lv, d.lv);
  out.st = Object.assign(fresh().st, d.st);
  out.dl = Object.assign(fresh().dl, d.dl);
  out.sl = Object.assign(fresh().sl, d.sl);
  out.tl = Object.assign(fresh().tl, d.tl);
  out.gl = Object.assign(fresh().gl, d.gl);
  out.ll = Object.assign(fresh().ll, d.ll);
  out.el = Object.assign(fresh().el, d.el);
  // nested shapes a hand-edited or damaged save could break
  if (!out.garden || !Array.isArray(out.garden.seeds) || !Array.isArray(out.garden.beds)) out.garden = fresh().garden;
  if (!Array.isArray(out.loom) || out.loom.length !== fresh().loom.length) out.loom = fresh().loom;
  out.farm = normalizeFarm(d.farm);
  if (typeof out.era !== 'number' || out.era < 0) out.era = 0;
  out.version = newer ? (d.version as number) : SAVE_VERSION;
  return out;
}

/** Set when the stored save could not be read: autosave must not overwrite it. */
let loadFailed = false;

export function load(): void {
  let txt: string | null = null;
  try {
    txt = localStorage.getItem(KEY);
    if (!txt) return;
    const parsed = JSON.parse(txt) as RawSave;
    const v = typeof parsed.version === 'number' ? parsed.version : 1;
    // Before migrating to a different version, keep an untouched copy of the save.
    if (v !== SAVE_VERSION) localStorage.setItem(`${KEY}_backup_v${v}`, txt);
    replaceState(normalize(parsed));
  } catch (e) {
    console.warn('Could not load save; keeping it and not autosaving over it', e);
    loadFailed = true;
    try { if (txt) localStorage.setItem(`${KEY}_unreadable`, txt); } catch { /* ignore */ }
  }
}

export function save(autoRate: number): void {
  try {
    S.saved = Date.now();
    S.lastRate = autoRate;
    if (loadFailed) return; // the stored save could not be read: never overwrite it
    // A NaN would be written as null and load back as 0: keep the last good save instead.
    if (!sanitizeState()) { console.warn('Chainbloom: not saving, a value is NaN'); return; }
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch { /* storage full or blocked: keep playing */ }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  loadFailed = false;
}

/** Base64 of the JSON save, safe for non-ASCII. */
export function exportSave(): string {
  sanitizeState();
  const bytes = new TextEncoder().encode(JSON.stringify(S));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Parse an exported string (or raw JSON). Throws with a readable message on bad input. */
export function parseImport(text: string): GameState {
  const t = text.trim();
  if (!t) throw new Error('Paste a save first');
  let parsed: unknown;
  try {
    let json = t;
    if (!t.startsWith('{')) {
      const bin = atob(t);
      json = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    }
    parsed = JSON.parse(json);
  } catch {
    throw new Error("that doesn't look like a Chainbloom save");
  }
  return normalize(parsed);
}

/** An explicit import replaces whatever was stored, so saving may resume. */
export function resumeSaving(): void {
  loadFailed = false;
}

/**
 * Replace the whole game (import, wipe) and reload, so the era the new save is in boots cleanly.
 * The state is swapped first, so the save made on unload writes the new game, not the old one.
 */
export function replaceAndReload(next: GameState): void {
  replaceState(next);
  loadFailed = false;
  save(0);
  location.reload();
}

/** Safety copies made by migrations before eras existed (v1-v10) only hold space progress: delete them. */
export function dropSpaceBackups(): void {
  try {
    for (let v = 1; v <= 10; v++) localStorage.removeItem(`${KEY}_backup_v${v}`);
  } catch { /* storage blocked */ }
}
