import { CatalogPicker } from './catalog-picker';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  SlidersHorizontal,
  Download,
  ArrowUpDown,
  ChevronRight,
  ArrowLeft,
  Save,
  X,
  FlaskConical,
} from 'lucide-react';
import { useInventory } from './state';
import { PageHeader, Badge, Empty, shortDate } from './layout';
import { blankItem, ITEM_TYPES, STATUSES, type InventoryItem } from '../model';
import {
  matchesSearch,
  expiration,
  isOtherLab,
  location,
  validateItem,
  isKit,
} from '../lib/business';
import { repository } from '../data/repository';
import { download, exportCsv } from '../lib/csv';
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-content">
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Inventory() {
  const { items, settings, user } = useInventory();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<keyof InventoryItem>('updatedAt');
  const [direction, setDirection] = useState(-1);
  const query = params.get('q') || '';
  const quick = params.get('filter') || '';
  const set = (key: string, value: string) =>
    setParams((prev) => {
      if (value) prev.set(key, value);
      else prev.delete(key);
      return prev;
    });
  const filtered = items
    .filter((i) => {
      if (!matchesSearch(i, query)) return false;
      for (const field of [
        'workflow',
        'itemType',
        'status',
        'ownerLab',
        'ownerPerson',
        'freezer',
        'project',
      ] as const) {
        if (params.get(field) && i[field] !== params.get(field)) return false;
      }
      const d = expiration(i).days;
      const ex = params.get('expiration');
      if (ex === 'expired' && !(d !== null && d < 0)) return false;
      if (ex === 'none' && d !== null) return false;
      if (ex && /^\d+$/.test(ex) && (d === null || d < 0 || d > Number(ex))) return false;
      if (quick === 'low') return isKit(i) && i.remainingReactions <= settings.lowStockThreshold;
      if (quick === 'soon') return d !== null && d >= 0 && d <= 30;
      if (quick === 'expired') return (d !== null && d < 0) || i.status === 'EXPIRED';
      if (quick === 'orphan') return i.status === 'ORPHAN' || i.itemType === 'Spare Component';
      if (quick === 'other') return isOtherLab(i, settings);
      if (quick === 'PARTIAL')
        return isKit(i) && (i.status === 'PARTIAL' || i.itemType === 'Partial Kit');
      if (quick === 'ACTIVE') return isKit(i) && i.status === 'ACTIVE';
      if (quick) return i.status === quick;
      return true;
    })
    .sort((a, b) => {
      const av = sort === 'freezer' ? location(a) : (a[sort] ?? ''),
        bv = sort === 'freezer' ? location(b) : (b[sort] ?? '');
      return (
        (typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true })) * direction
      );
    });
  const columns: [string, keyof InventoryItem][] = [
    ['Item', 'itemName'],
    ['Workflow', 'workflow'],
    ['Catalog #', 'catalogNumber'],
    ['Lot #', 'lotNumber'],
    ['Owner', 'ownerLab'],
    ['Remaining', 'remainingReactions'],
    ['Expiration', 'expirationDate'],
    ['Location', 'freezer'],
    ['Status', 'status'],
    ['Last updated', 'updatedAt'],
  ];
  return (
    <>
      <PageHeader
        title="Inventory"
        eyebrow="EVERY KIT. EVERY REACTION."
        description={`${items.length} items across your laboratory. Find what you need in seconds.`}
        action={
          user.role !== 'Viewer' && (
            <Link className="button primary" to="/inventory/new">
              <Plus size={17} />
              Add Item
            </Link>
          )
        }
      />
      <section className="panel">
        <div className="inventory-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search inventory"
              placeholder="Search items, lots, owners, notes…"
              value={query}
              onChange={(e) => set('q', e.target.value)}
            />
          </div>
          <button
            className={filtersOpen ? 'active-control' : ''}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal size={16} />
            Filters{params.size > 0 && <span className="small-count">{params.size}</span>}
          </button>
          {user.role === 'Admin' && (
            <button onClick={() => download(exportCsv(filtered), '10x-filtered-inventory.csv')}>
              <Download size={16} />
              Export filtered
            </button>
          )}
        </div>
        {filtersOpen && (
          <div className="filters">
            {(
              [
                'workflow',
                'itemType',
                'status',
                'ownerLab',
                'ownerPerson',
                'freezer',
                'project',
              ] as const
            ).map((field) => (
              <label key={field}>
                {
                  {
                    workflow: 'Workflow',
                    itemType: 'Item type',
                    status: 'Status',
                    ownerLab: 'Owner lab',
                    ownerPerson: 'Owner person',
                    freezer: 'Freezer',
                    project: 'Project',
                  }[field]
                }
                <select
                  value={params.get(field) || ''}
                  onChange={(e) => set(field, e.target.value)}
                >
                  <option value="">All</option>
                  {[...new Set(items.map((i) => i[field]))]
                    .filter(Boolean)
                    .sort()
                    .map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                </select>
              </label>
            ))}
            <label>
              Expiration
              <select
                value={params.get('expiration') || ''}
                onChange={(e) => set('expiration', e.target.value)}
              >
                <option value="">Any date</option>
                <option value="30">Within 30 days</option>
                <option value="60">Within 60 days</option>
                <option value="90">Within 90 days</option>
                <option value="expired">Expired</option>
                <option value="none">No date set</option>
              </select>
            </label>
          </div>
        )}
        {params.size > 0 && (
          <div className="filter-summary">
            <span>
              {filtered.length} matching items {quick && `· ${quick}`}
            </span>
            <button className="icon-button" onClick={() => setParams({})}>
              Clear filters <X size={13} />
            </button>
          </div>
        )}
        <div className="table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                {columns.map(([label, key]) => (
                  <th
                    key={key}
                    aria-sort={
                      sort === key ? (direction === 1 ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    <button
                      className="sort-button"
                      onClick={() => {
                        setSort(key);
                        setDirection(sort === key ? -direction : 1);
                      }}
                    >
                      {label}
                      <ArrowUpDown size={11} />
                    </button>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td>
                    <Link className="item-link" to={'/item/' + i.id}>
                      {i.itemName}
                    </Link>
                    <small>
                      {i.itemType}
                      {isOtherLab(i, settings) && ' · OTHER LAB — PERMISSION REQUIRED'}
                    </small>
                  </td>
                  <td>{i.workflow}</td>
                  <td>{i.catalogNumber || '—'}</td>
                  <td>{i.lotNumber || '—'}</td>
                  <td>
                    {i.ownerLab}
                    <small>{i.ownerPerson}</small>
                  </td>
                  <td>
                    <strong>{i.remainingReactions}</strong> / {i.originalReactions}
                    <small>
                      {i.remainingReactions <= settings.lowStockThreshold
                        ? 'LOW STOCK'
                        : 'reactions'}
                    </small>
                  </td>
                  <td className={expiration(i).level !== 'none' ? 'date-urgent' : ''}>
                    {shortDate(i.expirationDate)}
                    <small>
                      {expiration(i).days !== null && expiration(i).level !== 'none'
                        ? expiration(i).label
                        : ''}
                    </small>
                  </td>
                  <td>
                    {i.freezer}
                    <small>{i.position}</small>
                  </td>
                  <td>
                    <Badge status={i.status} />
                  </td>
                  <td>
                    {new Date(i.updatedAt).toLocaleDateString()}
                    <small>{i.updatedBy}</small>
                  </td>
                  <td>
                    <Link
                      className="icon-button"
                      aria-label={'Open ' + i.itemName}
                      to={'/item/' + i.id}
                    >
                      <ChevronRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty
            title="No matching inventory"
            description="Try a different search or clear your filters."
          />
        )}
        <div className="panel-bottom">
          <span>
            {filtered.length} of {items.length} items
          </span>
          <span>Click an item to view details or record use</span>
        </div>
      </section>
    </>
  );
}
const sectionFields: [string, [keyof InventoryItem, string, string?][]][] = [
  [
    'Identification',
    [
      ['itemName', 'Item name'],
      ['workflow', 'Workflow'],
      ['itemType', 'Item type'],
      ['catalogNumber', 'Catalog number'],
      ['lotNumber', 'Lot number'],
    ],
  ],
  [
    'Ownership',
    [
      ['ownerLab', 'Owner lab'],
      ['ownerPerson', 'Owner person'],
      ['project', 'Project'],
    ],
  ],
  [
    'Quantity',
    [
      ['originalReactions', 'Original reactions', 'number'],
      ['remainingReactions', 'Remaining reactions', 'number'],
      ['quantity', 'Quantity', 'number'],
      ['quantityUnit', 'Unit'],
    ],
  ],
  [
    'Dates',
    [
      ['receivedDate', 'Received date', 'date'],
      ['openedDate', 'Opened date', 'date'],
      ['expirationDate', 'Expiration date', 'date'],
    ],
  ],
  [
    'Location',
    [
      ['storageTemperature', 'Storage temperature'],
      ['freezer', 'Freezer'],
      ['position', 'Position'],
    ],
  ],
  [
    'Status & provenance',
    [
      ['status', 'Status'],
      ['sourceKit', 'Source kit'],
    ],
  ],
  ['Notes', [['notes', 'Notes', 'textarea']]],
];
export function ItemForm() {
  const { id } = useParams();
  const { items, settings, user, act, busy } = useInventory();
  const navigate = useNavigate();
  const existing = items.find((i) => i.id === id);
  const [params] = useSearchParams();
  const duplicate = items.find((i) => i.id === params.get('duplicate'));
  const [item, setItem] = useState<InventoryItem>(() =>
    existing
      ? { ...existing }
      : duplicate
        ? ({
            ...duplicate,
            ...Object.fromEntries(
              ['id', 'createdAt', 'updatedAt', 'updatedBy'].map((k) => [
                k,
                blankItem(settings)[k as keyof InventoryItem],
              ]),
            ),
            itemName: duplicate.itemName + ' (copy)',
          } as InventoryItem)
        : blankItem(settings),
  );
  const [error, setError] = useState('');
  if (user.role === 'Viewer')
    return (
      <Empty title="View-only access" description="An administrator or member can add inventory." />
    );
  if (id && !existing)
    return <Empty title="Item not found" description="This record may have been removed." />;
  const limited = user.role === 'Member' && Boolean(existing);
  const allowed = [
    'remainingReactions',
    'originalReactions',
    'quantity',
    'quantityUnit',
    'freezer',
    'shelf',
    'box',
    'position',
    'storageTemperature',
    'status',
  ];
  const required = ['itemName', 'workflow', 'ownerLab', 'freezer', 'status'];
  const lists: Record<string, string[]> = {
    workflow: settings.workflows,
    ownerLab: settings.ownerLabs,
    project: settings.projects,
    freezer: settings.freezers,
    shelf: settings.shelves,
    box: settings.boxes,
  };
  return (
    <>
      <Link className="back-link" to={id ? '/item/' + id : '/inventory'}>
        <ArrowLeft size={15} />
        Back to {id ? 'item' : 'inventory'}
      </Link>
      <PageHeader
        eyebrow={existing ? 'UPDATE A RECORD' : 'GROW YOUR INVENTORY'}
        title={existing ? 'Edit item' : duplicate ? 'Duplicate item' : 'Add an item'}
        description="A few details now make the next experiment easier."
      />
      <form
        className="item-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            validateItem(item);
            if (
              await act(
                () => (existing ? repository.updateItem(item) : repository.createItem(item)),
                existing ? 'Item updated' : 'Item added',
              )
            )
              navigate('/item/' + item.id);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      >
        {!existing && !duplicate && <CatalogPicker item={item} onChange={setItem} />}
        {limited && (
          <div className="warning">
            Members can update quantities, location, and status. Ask an administrator to edit
            identification or ownership.
          </div>
        )}
        {sectionFields.map(([title, fields], index) => (
          <section className="form-section panel" key={title}>
            <div className="form-section-heading">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{title}</h2>
                {title === 'Location' && <p>Freezer is required. Position is optional.</p>}
              </div>
            </div>
            <div className="form-grid">
              {fields.map(([key, label, type]) => (
                <label key={key} className={key === 'notes' || key === 'itemName' ? 'wide' : ''}>
                  {label}
                  {required.includes(key) && <span className="required"> *</span>}
                  {key === 'status' || key === 'itemType' ? (
                    <select
                      value={String(item[key])}
                      disabled={limited && !allowed.includes(key)}
                      onChange={(e) => setItem({ ...item, [key]: e.target.value })}
                    >
                      {(key === 'status' ? STATUSES : ITEM_TYPES).map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  ) : type === 'textarea' ? (
                    <textarea
                      rows={4}
                      value={String(item[key])}
                      disabled={limited && !allowed.includes(key)}
                      onChange={(e) => setItem({ ...item, [key]: e.target.value })}
                    />
                  ) : (
                    <input
                      onInput={(e) => {
                        if (type === 'date') {
                          const value = e.currentTarget.value;
                          setItem((prev) => ({ ...prev, [key]: value }));
                        }
                      }}
                      type={type || 'text'}
                      step={key === 'quantity' ? 'any' : 1}
                      min={type === 'number' ? 0 : undefined}
                      required={required.includes(key)}
                      value={String(item[key] ?? '')}
                      disabled={limited && !allowed.includes(key)}
                      list={lists[key] ? 'list-' + key : undefined}
                      onChange={(e) =>
                        setItem({
                          ...item,
                          [key]:
                            type === 'number'
                              ? e.target.value === ''
                                ? ''
                                : Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  )}
                  {lists[key] && (
                    <datalist id={'list-' + key}>
                      {lists[key].map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  )}
                </label>
              ))}
            </div>
          </section>
        ))}
        {error && (
          <div role="alert" className="warning danger">
            {error}
          </div>
        )}
        <div className="form-actions">
          <Link className="button" to={id ? '/item/' + id : '/inventory'}>
            Cancel
          </Link>
          <button className="primary" disabled={busy} type="submit">
            <Save size={17} />
            {existing ? 'Save changes' : 'Add item'}
          </button>
        </div>
      </form>
    </>
  );
}
export function ItemMini({ item }: { item: InventoryItem }) {
  return (
    <Link className="selection-item" to={'/item/' + item.id}>
      <span className="item-icon">
        <FlaskConical size={20} />
      </span>
      <div>
        <strong>{item.itemName}</strong>
        <small>{location(item)}</small>
      </div>
      <Badge status={item.status} />
      <ChevronRight size={18} />
    </Link>
  );
}
