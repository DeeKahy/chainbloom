import { app } from './core/app';
import { S } from './state/state';

let ac: AudioContext | null = null;
let master: GainNode | null = null;
/** Sound budget: refills over time so huge chains don't spawn thousands of oscillators. */
let budget = 4;
const PENT = [0, 3, 5, 7, 10];

/** Must be called from a user gesture before any sound plays. */
export function initAudio(): void {
  if (!ac) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ac = new Ctor();
      const comp = ac.createDynamicsCompressor();
      master = ac.createGain();
      master.gain.value = .35;
      master.connect(comp);
      comp.connect(ac.destination);
    } catch {
      ac = null;
    }
  }
  if (ac && ac.state === 'suspended') void ac.resume();
}

export const soundOn = (): boolean => !!ac && !S.mute;

export function refillBudget(dt: number): void {
  budget = Math.min(4, budget + dt * 28);
}

function takeBudget(): boolean {
  if (budget < 1) return false;
  budget -= 1;
  return true;
}

export function tone(f: number, dur: number, vol: number, type: OscillatorType = 'sine', endF?: number): void {
  if (!ac || !master || S.mute) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(endF || f * .5, t + dur);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + .006);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + .02);
}

/** Pentatonic pop that climbs with chain depth. */
export function blip(depth: number, type: number): void {
  if (!soundOn() || app.view === 'board' || !takeBudget()) return;
  const step = Math.min(depth * 2 + (Math.random() * 2 | 0), 22);
  const semi = Math.floor(step / 5) * 12 + PENT[step % 5];
  let f = 196 * 2 ** (semi / 12);
  if (type === 1) f *= 2;
  tone(f, type === 2 ? .25 : .14, type === 2 ? .09 : .055, type === 1 ? 'triangle' : 'sine');
}

/** Constellation node chime. */
export function chime(f: number): void {
  if (!soundOn() || !takeBudget()) return;
  tone(f * (Math.random() < .5 ? 1 : 1.5), .2, .04, 'triangle', f);
}
