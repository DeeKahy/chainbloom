import { initAudio, soundOn, tone } from '../../audio';
import { TAU } from '../../core/util';

/**
 * The way into the farm: about 11 seconds, drawn on its own overlay. The stars go quiet, you take
 * your hat off, dawn comes up over a field, and a straw hat goes on. Tap to skip after a moment.
 */

const LINES: [start: number, end: number, text: string][] = [
  [.8, 3.2, 'The universes hum along without you now.'],
  [3.4, 5.8, 'You take off your hat. It has been a long day.'],
  [6, 8.3, 'Time to call it a day…'],
  [8.5, 10.6, '…and become a farmer.'],
];
const LENGTH = 11.6;

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const clamp = (u: number): number => Math.max(0, Math.min(1, u));
const ease = (u: number): number => { u = clamp(u); return u * u * (3 - 2 * u); };
const mix = (a: number[], b: number[], u: number): string =>
  `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], u))).join(',')})`;

export function playIntro(): Promise<void> {
  return new Promise(resolve => {
    const box = document.createElement('div');
    box.id = 'intro';
    box.innerHTML = '<canvas></canvas><div class="cap"></div><div class="skip">tap to skip</div>';
    document.body.appendChild(box);
    const cv = box.querySelector('canvas')!, ctx = cv.getContext('2d')!;
    const cap = box.querySelector<HTMLElement>('.cap')!, skip = box.querySelector<HTMLElement>('.skip')!;
    let w = 0, h = 0, dpr = 1;
    const fit = (): void => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
    };
    fit();
    window.addEventListener('resize', fit);

    let seed = 3;
    const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const stars = Array.from({ length: 140 }, () => ({ x: rnd(), y: rnd() * .75, r: .5 + rnd() * 1.4, p: rnd() * TAU }));
    const orbs = Array.from({ length: 18 }, () => ({ x: rnd(), y: .2 + rnd() * .5, vx: (rnd() - .5) * .01, c: ['#6ee7ff', '#b98bff', '#ffd34d', '#ff7ab8'][rnd() * 4 | 0] }));
    const sprouts = Array.from({ length: 40 }, () => ({ x: rnd(), y: rnd(), at: 6.6 + rnd() * 2.6, s: .6 + rnd() * .8, c: ['#f6c437', '#ef7fa6', '#a88be0', '#f4efe4'][rnd() * 4 | 0] }));

    let t = 0, last = performance.now(), done = false, line = -1;
    const played = new Set<number>();
    const finish = (): void => {
      if (done) return;
      done = true;
      box.classList.add('out');
      setTimeout(() => { window.removeEventListener('resize', fit); box.remove(); resolve(); }, 700);
    };
    box.addEventListener('pointerdown', () => { initAudio(); if (t > 1.5) finish(); });

    const chime = (at: number, f: number): void => {
      if (t >= at && !played.has(at)) { played.add(at); if (soundOn()) { tone(f, 1.6, .04, 'sine', f); tone(f * 1.5, 1.2, .015, 'sine', f * 1.5); } }
    };

    const frame = (now: number): void => {
      if (done) return;
      t += Math.min(.05, (now - last) / 1000);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const dawn = ease((t - 5.6) / 3);
      const ground = h * .74, cx = w / 2;

      // sky: night to a buttery morning
      const g = ctx.createLinearGradient(0, 0, 0, ground);
      g.addColorStop(0, mix([6, 7, 13], [154, 196, 230], dawn));
      g.addColorStop(.6, mix([14, 16, 34], [250, 214, 170], dawn));
      g.addColorStop(1, mix([24, 20, 46], [255, 236, 190], dawn));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // stars and the last few orbs, fading out
      for (const s of stars) {
        ctx.globalAlpha = (1 - dawn) * (.5 + .5 * Math.sin(t * 2 + s.p));
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, TAU); ctx.fill();
      }
      for (const o of orbs) {
        o.x += o.vx * .016;
        ctx.globalAlpha = (1 - ease(t / 4)) * .8;
        ctx.fillStyle = o.c;
        ctx.shadowColor = o.c; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(o.x * w, o.y * h, 4, 0, TAU); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // the sun comes up behind the hill
      if (dawn > 0) {
        const sy = lerp(ground + 60, ground - h * .22, dawn);
        const sg = ctx.createRadialGradient(cx + w * .18, sy, 0, cx + w * .18, sy, 140);
        sg.addColorStop(0, 'rgba(255,245,200,1)');
        sg.addColorStop(.25, 'rgba(255,220,120,.95)');
        sg.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(cx + w * .18, sy, 140, 0, TAU); ctx.fill();
      }

      // the hill and the field
      ctx.fillStyle = mix([12, 14, 26], [143, 190, 104], dawn);
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, ground + 20);
      ctx.quadraticCurveTo(cx, ground - 50, w, ground + 20);
      ctx.lineTo(w, h);
      ctx.fill();
      for (const s of sprouts) {
        const u = ease((t - s.at) / .6);
        if (u <= 0) continue;
        const x = s.x * w, y = ground + 30 + s.y * (h - ground - 40), k = s.s * Math.min(w, 700) / 700;
        ctx.strokeStyle = '#4f8a3c'; ctx.lineWidth = 2 * k;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 14 * u * k); ctx.stroke();
        ctx.fillStyle = s.c;
        ctx.beginPath(); ctx.arc(x, y - 14 * u * k, 4 * u * k, 0, TAU); ctx.fill();
      }

      // you
      const sc = Math.min(1.3, h / 600), body = mix([10, 11, 20], [92, 70, 52], dawn);
      const fx = cx - w * .05, fy = ground - 13 * sc;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(fx - 18 * sc, fy);
      ctx.lineTo(fx - 22 * sc, fy - 58 * sc);
      ctx.quadraticCurveTo(fx, fy - 74 * sc, fx + 22 * sc, fy - 58 * sc);
      ctx.lineTo(fx + 18 * sc, fy);
      ctx.fill();
      const headY = fy - 86 * sc;
      ctx.beginPath(); ctx.arc(fx, headY, 14 * sc, 0, TAU); ctx.fill();

      // the hat: off the head and down to the chest, then a straw hat goes on
      const off = ease((t - 3.6) / 1.4), on = ease((t - 8.6) / 1.2);
      if (on <= 0) {
        const hx = lerp(fx, fx + 16 * sc, off), hy = lerp(headY - 12 * sc, fy - 46 * sc, off);
        // the arm that holds it
        ctx.strokeStyle = body; ctx.lineWidth = 7 * sc; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fx + 16 * sc, fy - 56 * sc);
        ctx.quadraticCurveTo(fx + 26 * sc, lerp(fy - 30 * sc, fy - 40 * sc, off), hx, hy + 6 * sc); ctx.stroke();
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(off * .5);
        ctx.fillStyle = mix([30, 30, 46], [40, 32, 30], dawn);
        ctx.fillRect(-18 * sc, -2 * sc, 36 * sc, 4 * sc);
        ctx.fillRect(-11 * sc, -22 * sc, 22 * sc, 21 * sc);
        ctx.fillStyle = 'rgba(110,231,255,.5)';
        ctx.fillRect(-11 * sc, -6 * sc, 22 * sc, 3 * sc);
        ctx.restore();
      }
      if (on > 0) {
        const hy = lerp(headY - 70 * sc, headY - 10 * sc, on);
        ctx.globalAlpha = Math.min(1, on * 2);
        ctx.fillStyle = '#e8c36a';
        ctx.beginPath(); ctx.ellipse(fx, hy, 30 * sc, 7 * sc, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(fx, hy - 6 * sc, 14 * sc, 11 * sc, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = '#b5473a';
        ctx.fillRect(fx - 14 * sc, hy - 7 * sc, 28 * sc, 3.5 * sc);
        ctx.globalAlpha = 1;
      }

      // captions
      const cur = LINES.findIndex(([a, b]) => t >= a && t < b);
      if (cur !== line) {
        line = cur;
        cap.classList.remove('on');
        if (cur >= 0) { cap.textContent = LINES[cur][2]; void cap.offsetWidth; cap.classList.add('on'); }
      }
      cap.style.color = dawn > .5 ? '#4a3417' : '#e8ecff';
      skip.style.opacity = t > 1.5 ? '.6' : '0';
      chime(.9, 196); chime(3.6, 220); chime(6.1, 262); chime(8.7, 330); chime(9.3, 392);

      if (t >= LENGTH) finish();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
