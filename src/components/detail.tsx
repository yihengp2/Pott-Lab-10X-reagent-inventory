import {itemUrl} from '../lib/urls';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Plus,
  Minus,
  MapPin,
  Pencil,
  Printer,
  Copy,
  Trash2,
  Search,
  ScanLine,
  Check,
  FlaskConical,
  ArrowRight,
  Clock3,
} from 'lucide-react';
import { useInventory } from './state';
import { PageHeader, Warnings, Badge, shortDate, Empty } from './layout';
import { Modal } from './inventory';
import { repository } from '../data/repository';
import { location, isOtherLab, matchesSearch, expiration } from '../lib/business';
import type { InventoryItem, InventoryHistory, HistoryAction } from '../model';
export function HistoryList({ entries }: { entries: InventoryHistory[] }) {
  return (
    <div className="history-list">
      {entries.map((h) => (
        <article className="history-entry" key={h.id}>
          <span className={'history-dot ' + (h.action === 'Used' ? 'used' : '')}>
            <Clock3 size={15} />
          </span>
          <div>
            <div className="history-title">
              <strong>{h.action}</strong>
              <time>{new Date(h.timestamp).toLocaleString()}</time>
            </div>
            <Link to={'/item/' + h.inventoryItem}>{h.itemName}</Link>
            <p>
              {h.user}
              {h.notes && ' · ' + h.notes}
            </p>
            <details>
              <summary>View changes</summary>
              <div className="change-values">
                {[
                  ...new Set([
                    ...Object.keys(h.previousValue || {}),
                    ...Object.keys(h.newValue || {}),
                  ]),
                ]
                  .filter(
                    (k) =>
                      !['updatedAt', 'createdAt', 'updatedBy', 'id'].includes(k) &&
                      JSON.stringify(h.previousValue?.[k as keyof InventoryItem]) !==
                        JSON.stringify(h.newValue?.[k as keyof InventoryItem]),
                  )
                  .map((k) => (
                    <div key={k}>
                      <strong>{k.replace(/([A-Z])/g, ' $1')}</strong>
                      <span>
                        {String(h.previousValue?.[k as keyof InventoryItem] ?? '—')} →{' '}
                        {String(h.newValue?.[k as keyof InventoryItem] ?? '—')}
                      </span>
                    </div>
                  ))}
              </div>
            </details>
          </div>
        </article>
      ))}
      {!entries.length && (
        <Empty title="No activity yet" description="Inventory updates will appear here." />
      )}
    </div>
  );
}
export type ActionMode =
  'use' | 'custom' | 'restock' | 'move' | 'delete' | 'DEPLETED' | 'EXPIRED' | 'HOLD';
export function ActionModal({
  item,
  mode,
  onClose,
  onDone,
}: {
  item: InventoryItem;
  mode: ActionMode;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { act, busy, settings, user } = useInventory();
  const [amount, setAmount] = useState(1);
  const [notes, setNotes] = useState('');
  const [permission, setPermission] = useState(false);
  const [moved, setMoved] = useState({ ...item });
  const [error, setError] = useState('');
  const use = mode === 'use' || mode === 'custom';
  const other = isOtherLab(item, settings);
  const title =
    mode === 'use'
      ? 'Use 1 reaction'
      : mode === 'custom'
        ? 'Use a custom amount'
        : mode === 'restock'
          ? 'Restock reactions'
          : mode === 'move'
            ? 'Move item'
            : mode === 'delete'
              ? 'Delete this record?'
              : `Mark ${mode.toLowerCase()}`;
  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal-item-name">{item.itemName}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (use && other && !permission) {
            setError('Confirm that the owning lab has granted permission.');
            return;
          }
          if (
            use &&
            (amount > item.remainingReactions || amount <= 0 || !Number.isInteger(amount))
          ) {
            setError('Enter a valid amount within the remaining reactions.');
            return;
          }
          let action: () => Promise<void>;
          if (user.role === 'Viewer') return;
          if (use)
            action = () =>
              repository.useQuantity(
                item.id,
                amount,
                (other ? 'Permission from owning lab confirmed. ' : '') + notes,
              );
          else if (mode === 'restock') action = () => repository.restock(item.id, amount);
          else if (mode === 'move') action = () => repository.updateItem(moved, 'Moved', notes);
          else if (mode === 'delete') action = () => repository.deleteItem(item.id);
          else
            action = () =>
              repository.updateItem({ ...item, status: mode }, 'Status changed', notes);
          if (
            await act(
              action,
              use
                ? `${amount} reaction${amount === 1 ? '' : 's'} used · ${item.remainingReactions - amount} remaining${item.remainingReactions === amount ? ' — consider marking DEPLETED' : ''}`
                : mode === 'restock'
                  ? 'Reactions restocked'
                  : mode === 'delete'
                    ? 'Item deleted; history retained'
                    : 'Item updated',
            )
          ) {
            onClose();
            onDone?.();
          }
        }}
      >
        {use && (
          <>
            <Warnings item={item} />
            <div className="usage-preview">
              <span>
                <strong>{item.remainingReactions}</strong>available
              </span>
              <ArrowRight size={20} />
              <span>
                <strong>{Math.max(0, item.remainingReactions - amount)}</strong>after use
              </span>
            </div>
            {other && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  required
                  checked={permission}
                  onChange={(e) => setPermission(e.target.checked)}
                />
                I have permission from {item.ownerLab} to use this item.
              </label>
            )}
          </>
        )}
        {(mode === 'custom' || mode === 'restock') && (
          <label>
            Number of reactions
            <input
              type="number"
              min="1"
              step="1"
              max={mode === 'custom' ? item.remainingReactions : undefined}
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              autoFocus
            />
          </label>
        )}
        {mode === 'move' && (
          <div className="form-grid">
            {(['freezer', 'shelf', 'box', 'position', 'storageTemperature'] as const).map((key) => (
              <label key={key}>
                {key.replace(/([A-Z])/g, ' $1')}
                <input
                  value={moved[key]}
                  required={['freezer', 'shelf', 'box'].includes(key)}
                  onChange={(e) => setMoved({ ...moved, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        )}
        {mode === 'delete' && (
          <p className="warning danger">
            The item will be hidden from inventory. Its record and complete history will be
            retained. This action requires an administrator.
          </p>
        )}
        {!['use', 'delete'].includes(mode) && (
          <label className="notes-label">
            Notes (optional)
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
        )}
        {error && (
          <p role="alert" className="warning danger">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={mode === 'delete' ? 'danger-button' : 'primary'}
            disabled={
              busy ||
              (use && item.remainingReactions < 1) ||
              (mode === 'delete' && user.role !== 'Admin')
            }
            type="submit"
          >
            {busy
              ? 'Saving…'
              : use
                ? 'Confirm use'
                : mode === 'delete'
                  ? 'Delete record'
                  : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Detail() {
  const { id } = useParams();
  const { items, history, user } = useInventory();
  const item = items.find((i) => i.id === id);
  const [mode, setMode] = useState<ActionMode | null>(null);
  const navigate = useNavigate();
  if (!item)
    return (
      <>
        <Link to="/inventory" className="back-link">
          <ArrowLeft size={16} />
          Inventory
        </Link>
        <Empty
          title="Item not found"
          description="The record may have been deleted, or it belongs to another browser’s demo inventory."
        />
      </>
    );
  const fields: [string, string][] = [
    ['Catalog number', item.catalogNumber],
    ['Lot number', item.lotNumber],
    ['Item type', item.itemType],
    ['Workflow', item.workflow],
    ['Owner lab', item.ownerLab],
    ['Owner person', item.ownerPerson],
    ['Project', item.project],
    ['Quantity', `${item.quantity} ${item.quantityUnit}`],
    ['Expiration', shortDate(item.expirationDate)],
    ['Opened', shortDate(item.openedDate)],
    ['Received', shortDate(item.receivedDate)],
    ['Storage temperature', item.storageTemperature],
    ['Freezer', item.freezer],
    ['Shelf', item.shelf],
    ['Box', item.box],
    ['Position', item.position],
    ['Source kit', item.sourceKit],
    ['Last updated', new Date(item.updatedAt).toLocaleString()],
    ['Updated by', item.updatedBy],
  ];
  return (
    <>
      <div className="no-print">
        <Link className="back-link" to="/inventory">
          <ArrowLeft size={15} />
          Back to inventory
        </Link>
        <PageHeader
          title={item.itemName}
          eyebrow={item.workflow.toUpperCase()}
          description={`Lot ${item.lotNumber || 'not specified'} · ${location(item)}`}
          action={<Badge status={item.status} />}
        />
        <Warnings item={item} />
        <div className="detail-grid">
          <section className="panel detail-main">
            <div className="reaction-bar">
              <div>
                <span className="eyebrow">REACTIONS REMAINING</span>
                <p>
                  <strong>{item.remainingReactions}</strong>
                  <span> / {item.originalReactions}</span>
                </p>
                <progress
                  max={Math.max(1, item.originalReactions)}
                  value={item.remainingReactions}
                />
              </div>
              {user.role !== 'Viewer' && (
                <div className="reaction-actions">
                  <button
                    className="primary large"
                    disabled={item.remainingReactions === 0}
                    onClick={() => setMode('use')}
                  >
                    <Minus size={19} />
                    Use 1 Reaction
                  </button>
                  <button
                    disabled={item.remainingReactions === 0}
                    onClick={() => setMode('custom')}
                  >
                    Use Custom Amount
                  </button>
                </div>
              )}
            </div>
            <div className="detail-fields">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value || '—'}</strong>
                </div>
              ))}
            </div>
            <div className="detail-notes">
              <h3>Notes</h3>
              <p>{item.notes || 'No notes added.'}</p>
            </div>
          </section>
          <aside className="detail-aside">
            <section className="panel">
              <div className="panel-heading">
                <h2>Record actions</h2>
              </div>
              <div className="record-actions">
                {user.role !== 'Viewer' && (
                  <>
                    <button onClick={() => setMode('restock')}>
                      <Plus size={16} />
                      Restock
                    </button>
                    <Link className="button" to={'/item/' + id + '/edit'}>
                      <Pencil size={16} />
                      Edit
                    </Link>
                    <button onClick={() => setMode('move')}>
                      <MapPin size={16} />
                      Move
                    </button>
                    <Link className="button" to={'/inventory/new?duplicate=' + id}>
                      <Copy size={16} />
                      Duplicate Record
                    </Link>
                    <div className="action-divider" />
                    {(['DEPLETED', 'EXPIRED', 'HOLD'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setMode(status)}
                        disabled={item.status === status}
                      >
                        Mark {status.charAt(0) + status.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </>
                )}
                {user.role === 'Admin' && (
                  <button className="delete-link" onClick={() => setMode('delete')}>
                    <Trash2 size={16} />
                    Delete record
                  </button>
                )}
                <button onClick={() => window.print()}>
                  <Printer size={16} />
                  Print Label
                </button>
              </div>
            </section>
            <section className="panel qr-panel">
              <QRCodeSVG
                value={itemUrl(item.id)}
                size={130}
                marginSize={2}
              />
              <h3>Find this item instantly</h3>
              <p>Scan the QR code at the freezer.</p>
              <small>{item.id}</small>
            </section>
          </aside>
        </div>
        <section className="panel detail-history">
          <div className="panel-heading">
            <h2>Update history</h2>
            <span className="muted">Every change, accounted for</span>
          </div>
          <HistoryList entries={history.filter((h) => h.inventoryItem === id)} />
        </section>
        {mode && (
          <ActionModal
            item={item}
            mode={mode}
            onClose={() => setMode(null)}
            onDone={mode === 'delete' ? () => navigate('/inventory') : undefined}
          />
        )}
      </div>
      <div className="print-label">
        <div>
          <h1>{item.itemName}</h1>
          <p>{item.workflow}</p>
          <p>Lot: {item.lotNumber || '—'}</p>
          <p>
            Exp: {item.expirationDate || 'Not set'} · {item.remainingReactions} rxns
          </p>
          <p>{item.status}</p>
          <p>{location(item)}</p>
        </div>
        <QRCodeSVG value={itemUrl(item.id)} size={84} />
      </div>
    </>
  );
}
export function QuickUse() {
  const { items, user } = useInventory();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<ActionMode | null>(null);
  const [success, setSuccess] = useState(false);
  const item = items.find((i) => i.id === selected);
  const results = items
    .filter((i) => matchesSearch(i, search) || search.endsWith('/item/' + i.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 12);
  return (
    <>
      <PageHeader
        eyebrow="LESS TRACKING. MORE RESEARCH."
        title="Quick Use"
        description="Find your reagent. Record a reaction. Get back to the bench."
      />
      <div className="quick-use-layout">
        <section className="panel quick-search">
          <div className="panel-heading">
            <h2>
              <ScanLine size={19} />
              Find an item
            </h2>
          </div>
          <div className="search-input">
            <Search size={19} />
            <input
              autoFocus
              aria-label="Find reagent to use"
              placeholder="Search item, lot, or paste a QR URL…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="help-text">
            Use your phone’s camera to scan a printed QR label and open the item directly.
          </p>
          <div>
            {results.map((i) => (
              <button
                className={'quick-result ' + (selected === i.id ? 'selected' : '')}
                key={i.id}
                onClick={() => {
                  setSelected(i.id);
                  setSuccess(false);
                }}
              >
                <span className="item-icon">
                  <FlaskConical size={20} />
                </span>
                <span>
                  <strong>{i.itemName}</strong>
                  <small>
                    {i.lotNumber || i.workflow} · {i.box}
                  </small>
                </span>
                <span className="quick-count">
                  {i.remainingReactions}
                  <small>rxns</small>
                </span>
              </button>
            ))}
          </div>
          {!results.length && (
            <Empty
              title="No matching items"
              description="Try searching a different lot or item name."
            />
          )}
        </section>
        <section className="panel quick-selected">
          {item ? (
            <>
              <Badge status={item.status} />
              <h2>{item.itemName}</h2>
              <p>{location(item)}</p>
              <Warnings item={item} />
              <div className="big-count">
                <strong>{item.remainingReactions}</strong>
                <span>reactions remaining</span>
              </div>
              {success && (
                <div className="success-message" role="status">
                  <Check size={20} />
                  Reaction recorded. You’re all set.
                </div>
              )}
              {user.role !== 'Viewer' ? (
                <button
                  className="primary use-button"
                  disabled={item.remainingReactions < 1}
                  onClick={() => setMode('use')}
                >
                  <Minus size={23} />
                  USE 1 REACTION
                </button>
              ) : (
                <p className="warning">Your account has view-only access.</p>
              )}
              {item.remainingReactions === 0 &&
                user.role !== 'Viewer' &&
                item.status !== 'DEPLETED' && (
                  <button onClick={() => setMode('DEPLETED')}>Mark Depleted</button>
                )}
              {expiration(item).level === 'expired' &&
                user.role !== 'Viewer' &&
                item.status !== 'EXPIRED' && (
                  <button onClick={() => setMode('EXPIRED')}>Mark Expired</button>
                )}
              <Link className="text-link" to={'/item/' + item.id}>
                View full record
                <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <div className="quick-empty">
              <ScanLine size={45} />
              <h2>Ready when you are.</h2>
              <p>Select a reagent to record your use.</p>
            </div>
          )}
        </section>
      </div>
      {item && mode && (
        <ActionModal
          item={item}
          mode={mode}
          onClose={() => setMode(null)}
          onDone={() => setSuccess(true)}
        />
      )}
    </>
  );
}
export function Activity() {
  const { history } = useInventory();
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const filtered = history.filter(
    (h) =>
      (!action || h.action === action) &&
      [h.itemName, h.user, h.notes].join(' ').toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Activity"
        eyebrow="A SHARED RECORD OF YOUR RESEARCH"
        description="See who changed what, and when. Every inventory update is recorded."
      />
      <section className="panel">
        <div className="inventory-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search activity"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items, people, or notes…"
            />
          </div>
          <select
            aria-label="Filter activity by action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">All actions</option>
            {(
              [
                'Created',
                'Edited',
                'Used',
                'Restocked',
                'Moved',
                'Status changed',
                'Deleted',
              ] as HistoryAction[]
            ).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <HistoryList entries={filtered} />
      </section>
    </>
  );
}
