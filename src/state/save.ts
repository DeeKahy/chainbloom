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
];

/** Turn any parsed save object into a complete, current GameState. */
export function normalize(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new Error('Save is not an object');
  const d = { ...(raw as RawSave) };
  let v = typeof d.version === 'number' ? d.version : 1;
  if (v > SAVE_VERSION) throw new Error(`Save is from a newer version (${v})`);
  for (; v < SAVE_VERSION; v++) MIGRATIONS[v - 1](d);
  const f = fresh();
  const out: GameState = Object.assign(f, d);
  // Merge level maps so upgrades added later start at 0 instead of undefined.
  out.lv = Object.assign(fresh().lv, d.lv);
  out.st = Object.assign(fresh().st, d.st);
  out.dl = Object.assign(fresh().dl, d.dl);
  out.sl = Object.assign(fresh().sl, d.sl);
  out.version = SAVE_VERSION;
  return out;
}

export function load(): void {
  try {
    const txt = localStorage.getItem(KEY);
    if (txt) replaceState(normalize(JSON.parse(txt)));
  } catch (e) {
    console.warn('Could not load save', e);
  }
}

export function save(autoRate: number): void {
  try {
    S.saved = Date.now();
    S.lastRate = autoRate;
    // A NaN would be written as null and load back as 0: keep the last good save instead.
    if (!sanitizeState()) { console.warn('Chainbloom: not saving, a value is NaN'); return; }
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch { /* storage full or blocked: keep playing */ }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
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
