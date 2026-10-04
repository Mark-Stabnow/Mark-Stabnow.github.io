import {useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import type {Item} from './types';
import {InventoryIndex, normalize} from '../shared/algorithms.mjs';

type Props = {items: Item[]; online: boolean; children: (items: Item[]) => ReactNode};

/** Read-only tools over the loaded records. Warehouse search remains at the API. */
export default function IndexedInventoryView({items, online, children}: Props) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('prefix');
  const [order, setOrder] = useState('loaded');
  // Rebuild after a new page or confirmed edit, not after a local search keystroke.
  const index = useMemo(() => active ? new InventoryIndex<Item>(items) : null, [active, items]);
  let visible = items;
  if (index) {
    const text = normalize(query);
    if (text) {
      if (mode === 'exact') {
        const match = index.exact(text);
        visible = match ? [match] : [];
      } else visible = index.prefix(text);
    }
    if (order === 'lowest') {
      const matches = new Set(visible.map(item => item.id));
      visible = index.lowest(10, text ? item => matches.has(item.id) : undefined);
    }
  }
  return <>
    <section className="indexed-tools" aria-label="Loaded inventory tools">
      <label className="indexed-toggle">
        <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)}/>
        Search and order the loaded view
      </label>
      {index && <>
        <p className="muted small" role="status">{index.size} loaded items. These tools search this view only, not the whole warehouse. The search above and "Load more items" determine which records are loaded.</p>
        <div className="indexed-fields">
          <label>Loaded-view search<input type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} placeholder="Start of a name or SKU"/></label>
          <label>Match type<select aria-label="Match type" value={mode} onChange={event => setMode(event.target.value)}>
            <option value="prefix">Name / SKU prefix</option><option value="exact">Exact SKU</option>
          </select></label>
          <label>Loaded-view order<select aria-label="Loaded-view order" value={order} onChange={event => setOrder(event.target.value)}>
            <option value="loaded">Search results</option><option value="lowest">Lowest 10 stock counts</option>
          </select></label>
        </div>
        <p className="muted small">Prefix matches the start of a name or SKU. Both modes ignore case and surrounding spaces. Lowest stock uses confirmed quantities, including zero, with SKU and ID as tie-breakers.</p>
      </>}
    </section>
    {children(visible)}
    {!visible.length && <p className="empty" role="status">{active
      ? `No match in the loaded view. ${online ? 'Use the warehouse search above to look beyond this view.' : 'Reconnect to search beyond the saved view.'}`
      : 'No items match this view.'}</p>}
  </>;
}
