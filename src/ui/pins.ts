import { onRefresh } from '../core/app';
import { $, setHTML } from '../core/util';
import { pinnedRows } from './statRows';

/** Stats pinned from the Stats pane, shown under the money on the orb field. */
export function refreshPins(): void {
  const rows = pinnedRows();
  const box = $('#pins');
  box.hidden = !rows.length;
  setHTML(box, rows.map(r => `<span><i>${r.label}</i> ${r.value()}</span>`).join(''));
}

export function buildPins(): void {
  onRefresh(refreshPins);
}
