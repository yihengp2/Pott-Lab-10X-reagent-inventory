import { useState } from 'react';
import { Search, Check, ArrowRight } from 'lucide-react';
import { applyCatalogEntry, searchCatalog, type CatalogEntry } from '../data/catalog';
import type { InventoryItem } from '../model';
export function CatalogPicker({
  item,
  onChange,
}: {
  item: InventoryItem;
  onChange: (item: InventoryItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [expanded, setExpanded] = useState(true);
  return (
    <section className="panel catalog-picker">
      <div className="panel-heading">
        <div>
          <h2>Start with a kit from the catalog</h2>
          <p>
            Standard details filled in. Your lot, expiration, ownership, and location stay yours.
          </p>
        </div>
        {selected && (
          <button type="button" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide catalog' : 'Change kit'}
          </button>
        )}
      </div>
      {selected && (
        <div className="catalog-selected" role="status">
          <Check size={18} />
          <div>
            <strong>
              {selected.itemName} · {selected.reactions} reactions
            </strong>
            <small>
              PN-{selected.catalogNumber} · Review the fields below, then add lot, expiration, and
              location.
            </small>
          </div>
          <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
            Kit guide ↗
          </a>
        </div>
      )}
      {expanded && (
        <>
          <div className="search-input">
            <Search size={18} />
            <input
              aria-label="Search kit catalog"
              placeholder="Search kit name or catalog number, e.g. 1000268"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="catalog-results">
            {searchCatalog(query).map((entry) => (
              <button
                type="button"
                className="catalog-result"
                key={entry.catalogNumber}
                onClick={() => {
                  onChange(applyCatalogEntry(item, entry));
                  setSelected(entry);
                  setExpanded(false);
                }}
              >
                <div>
                  <strong>{entry.itemName}</strong>
                  <small>
                    PN-{entry.catalogNumber} · {entry.workflow} · {entry.reactions} reactions
                  </small>
                </div>
                <ArrowRight size={17} />
              </button>
            ))}
            {!searchCatalog(query).length && (
              <p className="help-text">
                No catalog match. You can still enter any kit manually below.
              </p>
            )}
          </div>
          <p className="help-text">
            Initial catalog: 3′ Next GEM, GEM-X, and related components. All fields remain editable.
            Complete kits contain components with different storage temperatures; use their
            individual labels.
          </p>
        </>
      )}
    </section>
  );
}
