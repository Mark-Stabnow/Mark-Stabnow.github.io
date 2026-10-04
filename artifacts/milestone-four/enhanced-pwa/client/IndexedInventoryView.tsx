import {useId, useMemo, useState} from 'react';
import type {ReactNode} from 'react';
import type {Item} from './types';
import {InventoryIndex, normalize} from '../shared/algorithms.mjs';

type Props = {
  items: Item[];
  online: boolean;
  filters?: ReactNode;
  loading?: boolean;
  children: (items: Item[]) => ReactNode;
};

/** Read-only tools over the loaded records. Warehouse search remains at the API. */
export default function IndexedInventoryView({items, online, filters, loading = false, children}: Props) {
  const [active, setActive] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('prefix');
  const [order, setOrder] = useState('loaded');
  const toolsId = useId();
  const scopeId = `${toolsId}-scope`;
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
    <section className="inventory-search-panel" aria-label="Inventory search and filters">
      {filters && <section className="toolbar" aria-label="Inventory filters">{filters}</section>}
      <section className="indexed-tools" aria-label="Loaded inventory tools">
        <div className="indexed-heading">
          <button
            type="button"
            className="indexed-toggle"
            aria-expanded={active}
            aria-controls={toolsId}
            onClick={() => setActive(value => !value)}
          >
            <span>Search &amp; sort this view</span>
            <svg className="indexed-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
          <span className="indexed-count">{items.length} {items.length === 1 ? 'item' : 'items'} loaded</span>
        </div>
        <div id={toolsId} className="indexed-content" hidden={!active}>
          {index && <>
            <p className="muted small indexed-scope" id={scopeId}>
              This view only. Use Search inventory above{online ? ' to search the warehouse' : ' after reconnecting to search the warehouse'}. Closing these tools restores the loaded view.
            </p>
            <div className="indexed-fields">
              <label>Loaded-view search
                <input type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={100} placeholder={mode === 'exact' ? 'Enter a full SKU' : 'Start of a name or SKU'} aria-describedby={scopeId}/>
              </label>
              <label>Match type
                <select value={mode} onChange={event => setMode(event.target.value)}>
                  <option value="prefix">Name / SKU prefix</option>
                  <option value="exact">Exact SKU</option>
                </select>
              </label>
              <label>Loaded-view order
                <select value={order} onChange={event => setOrder(event.target.value)}>
                  <option value="loaded">Search results</option>
                  <option value="lowest">Lowest 10 stock counts</option>
                </select>
              </label>
            </div>
            <div className="indexed-summary">
              <p className="muted small" role="status">{visible.length} of {index.size} loaded items shown.</p>
              <button type="button" className="plain indexed-reset" onClick={() => {setQuery(''); setMode('prefix'); setOrder('loaded');}} disabled={!query && mode === 'prefix' && order === 'loaded'}>Reset view tools</button>
            </div>
          </>}
        </div>
      </section>
    </section>
    {loading && <p role="status">Loading inventory…</p>}
    {children(visible)}
    {!visible.length && <p className="empty" role="status">{active
      ? `No match in the loaded view. ${online ? 'Use the warehouse search above to look beyond this view.' : 'Reconnect to search beyond the saved view.'}`
      : 'No items match this view.'}</p>}
  </>;
}
