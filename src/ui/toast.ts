import { $ } from '../core/util';

export function toast(msg: string, color?: string): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  if (color) t.style.borderLeftColor = color;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/**
 * Two-click confirmation (native confirm() is blocked in some embeds).
 * First click relabels the button for 3 s; returns true only on the second click.
 */
export function armed(btn: HTMLElement, msg: string): boolean {
  if (btn.dataset.armed) {
    clearTimeout(+btn.dataset.armed);
    delete btn.dataset.armed;
    btn.textContent = btn.dataset.label ?? '';
    return true;
  }
  btn.dataset.label = btn.textContent ?? '';
  btn.textContent = msg;
  btn.dataset.armed = String(setTimeout(() => {
    delete btn.dataset.armed;
    btn.textContent = btn.dataset.label ?? '';
  }, 3000));
  return false;
}
