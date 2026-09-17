import { useState, useEffect } from 'react';
import { Snowflake, Upload, Download, FileSpreadsheet, Save, Users } from 'lucide-react';
import { useInventory } from './state';
import { PageHeader, Empty } from './layout';
import { ItemMini } from './inventory';
import { download, exportCsv, csvTemplate, parseCsv } from '../lib/csv';
import { repository, supabase } from '../data/repository';
import type { AppSettings, InventoryItem, User } from '../model';
export function FreezerMap() {
  const { items } = useInventory();
  const [selected, setSelected] = useState('');
  const freezers = [...new Set(items.map((item) => item.freezer))].sort();
  const selectedItems = items.filter((item) => item.freezer === selected);
  return (
    <>
      <PageHeader
        title="Freezer Map"
        eyebrow="EVERYTHING IN ITS PLACE"
        description="Choose a freezer to see its inventory and positions."
      />
      <div className="freezer-layout">
        <div className="freezer-tree">
          {freezers.map((freezer) => (
            <button
              key={freezer}
              className={selected === freezer ? 'box-card selected' : 'box-card'}
              onClick={() => setSelected(freezer)}
            >
              <Snowflake size={21} />
              <strong>{freezer}</strong>
              <small>{items.filter((item) => item.freezer === freezer).length} items</small>
            </button>
          ))}
          {!freezers.length && (
            <Empty
              title="No freezer locations yet"
              description="Add inventory to populate the map."
            />
          )}
        </div>
        <section className="panel box-contents">
          <div className="panel-heading">
            <div>
              <h2>{selected || 'Freezer contents'}</h2>
              <p>Select a freezer to explore its inventory.</p>
            </div>
          </div>
          {selected ? (
            selectedItems
              .sort((a, b) => a.position.localeCompare(b.position))
              .map((item) => (
                <div key={item.id} className="position-row">
                  <span className="position-tag">{item.position || '—'}</span>
                  <ItemMini item={item} />
                </div>
              ))
          ) : (
            <Empty title="A place for every reagent" description="Choose a freezer on the left." />
          )}
        </section>
      </div>
    </>
  );
}
export function ImportExport() {
  const { items, settings, user, act, busy } = useInventory();
  const [preview, setPreview] = useState<InventoryItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [filename, setFilename] = useState('');
  const [done, setDone] = useState(false);
  if (user.role !== 'Admin')
    return (
      <>
        <PageHeader
          title="Import / Export"
          description="Bulk inventory tools are available to administrators."
        />
        <Empty
          title="Administrator access required"
          description="Ask your lab administrator to import or export inventory."
        />
      </>
    );
  return (
    <>
      <PageHeader
        title="Import / Export"
        eyebrow="BRING YOUR INVENTORY TOGETHER"
        description="Move from spreadsheets to a shared inventory, with a review before anything is saved."
      />
      <div className="transfer-grid">
        <section className="panel transfer-card">
          <span className="transfer-icon">
            <Upload size={24} />
          </span>
          <h2>Import a CSV</h2>
          <p>
            Start with the template, add your records, and upload your file. Each row creates a new
            inventory item.
          </p>
          <button onClick={() => download(csvTemplate(), '10x-inventory-template.csv')}>
            <FileSpreadsheet size={17} />
            Download CSV template
          </button>
          <label className="upload-area">
            <Upload size={26} />
            <strong>Choose a CSV file</strong>
            <span>UTF-8 CSV · up to 2 MB · maximum 5,000 rows</span>
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Choose CSV file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                setDone(false);
                setErrors([]);
                setPreview([]);
                if (!file) return;
                setFilename(file.name);
                if (file.size > 2 * 1024 * 1024) {
                  setErrors(['Choose a file smaller than 2 MB.']);
                  return;
                }
                try {
                  const parsed = parseCsv(await file.text(), settings);
                  if (parsed.items.length > 5000)
                    parsed.errors.push('Maximum 5,000 records per import.');
                  setPreview(parsed.items);
                  setErrors(parsed.errors);
                } catch (err) {
                  setErrors([String(err)]);
                }
              }}
            />
          </label>
        </section>
        <section className="panel transfer-card">
          <span className="transfer-icon blue">
            <Download size={24} />
          </span>
          <h2>Export your inventory</h2>
          <p>
            Download all {items.length} current records in an Excel-compatible CSV. Exported files
            include every inventory field.
          </p>
          <button
            className="primary"
            onClick={() =>
              download(
                exportCsv(items),
                '10x-inventory-' + new Date().toISOString().slice(0, 10) + '.csv',
              )
            }
          >
            <Download size={17} />
            Export all inventory
          </button>
          <div className="transfer-tip">
            <strong>Need a specific subset?</strong>
            <p>Apply filters on the Inventory page, then choose “Export filtered”.</p>
          </div>
          <p className="help-text">
            Exports contain current inventory. The Activity page retains your change history.
            Deleted records are excluded from CSV.
          </p>
        </section>
      </div>
      {filename && !done && (
        <section className="panel import-preview">
          <div className="panel-heading">
            <div>
              <h2>Review: {filename}</h2>
              <p>
                {preview.length} valid records · {errors.length} errors · No changes saved yet
              </p>
            </div>
            <button
              className="primary"
              disabled={busy || !!errors.length || !preview.length}
              onClick={async () => {
                if (
                  await act(
                    () => repository.importItems(preview),
                    `${preview.length} items imported`,
                  )
                ) {
                  setDone(true);
                  setPreview([]);
                }
              }}
            >
              Import {preview.length} items
            </button>
          </div>
          {errors.length > 0 && (
            <div className="import-errors" role="alert">
              <h3>Fix these errors before importing</h3>
              {errors.slice(0, 30).map((error, i) => (
                <p key={i}>{error}</p>
              ))}
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Workflow</th>
                  <th>Owner</th>
                  <th>Remaining</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((i, n) => (
                  <tr key={n}>
                    <td>{i.itemName}</td>
                    <td>{i.workflow}</td>
                    <td>{i.ownerLab}</td>
                    <td>{i.remainingReactions}</td>
                    <td>{[i.freezer, i.position].filter(Boolean).join(' / ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 20 && (
            <p className="help-text">
              Showing the first 20 records. All {preview.length} will be imported.
            </p>
          )}
        </section>
      )}
      {done && (
        <div className="success-message">
          Import complete. Your items are now available in Inventory.
        </div>
      )}
    </>
  );
}
export function SettingsPage() {
  const { settings, user, act, busy } = useInventory();
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [people, setPeople] = useState<User[]>([]);
  const [peopleError, setPeopleError] = useState('');
  const [pendingRole, setPendingRole] = useState<Record<string, User['role']>>({});
  useEffect(() => {
    if (supabase && user.role === 'Admin')
      void supabase
        .from('profiles')
        .select('*')
        .then(({ data, error }) => {
          if (error) setPeopleError(error.message);
          else setPeople(data || []);
        });
  }, [user.role]);
  const admin = user.role === 'Admin';
  return (
    <>
      <PageHeader
        title="Settings"
        eyebrow="MAKE IT YOUR LAB’S"
        description="Configure your workspace, stock alerts, and reusable inventory choices."
      />
      {!admin && (
        <div className="warning">
          These settings are read-only. Your lab administrator can update them.
        </div>
      )}
      <form
        className="settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await act(
            () =>
              repository.saveSettings({
                ...draft,
                labName: draft.labName.trim(),
                defaultFreezer: draft.defaultFreezer.trim(),
              }),
            'Workspace settings saved',
          );
        }}
      >
        <section className="panel form-section">
          <div className="form-section-heading">
            <span>01</span>
            <div>
              <h2>Workspace defaults</h2>
              <p>Used when adding items and identifying other-lab material.</p>
            </div>
          </div>
          <div className="form-grid">
            <label>
              Lab name
              <input
                required
                disabled={!admin}
                value={draft.labName}
                onChange={(e) => setDraft({ ...draft, labName: e.target.value })}
              />
            </label>
            <label>
              Default freezer
              <input
                required
                disabled={!admin}
                value={draft.defaultFreezer}
                onChange={(e) => setDraft({ ...draft, defaultFreezer: e.target.value })}
              />
            </label>
            <label>
              Low-stock threshold (reactions)
              <input
                type="number"
                min="0"
                step="1"
                required
                disabled={!admin}
                value={draft.lowStockThreshold}
                onChange={(e) => setDraft({ ...draft, lowStockThreshold: Number(e.target.value) })}
              />
            </label>
            <label>
              Default expiration warning window
              <select
                disabled={!admin}
                value={draft.expirationWarningInterval}
                onChange={(e) =>
                  setDraft({ ...draft, expirationWarningInterval: Number(e.target.value) })
                }
              >
                {[30, 60, 90].map((d) => (
                  <option value={d} key={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section className="panel form-section">
          <div className="form-section-heading">
            <span>02</span>
            <div>
              <h2>Inventory options</h2>
              <p>One option per line. Custom values are also accepted when adding an item.</p>
            </div>
          </div>
          <div className="form-grid">
            {(['workflows', 'ownerLabs', 'projects', 'freezers'] as const).map((key) => (
              <label key={key}>
                {key.replace(/([A-Z])/g, ' $1')}
                <textarea
                  rows={6}
                  disabled={!admin}
                  value={draft[key].join('\n')}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value.split('\n') })}
                />
              </label>
            ))}
          </div>
        </section>
        {admin && (
          <div className="form-actions">
            <button className="primary" disabled={busy}>
              <Save size={17} />
              Save settings
            </button>
          </div>
        )}
      </form>
      <section className="panel users-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <Users size={19} />
              Members & permissions
            </h2>
            <p>
              {supabase
                ? 'Manage access for registered laboratory users.'
                : 'Demo Mode — Local browser storage. You have administrator access on this browser.'}
            </p>
          </div>
        </div>
        {!supabase ? (
          <p className="help-text">
            Connect Supabase to enable sign-in and shared Admin, Member, and Viewer accounts.
          </p>
        ) : admin ? (
          <>
            <p className="help-text">
              Invite new accounts from Supabase Authentication. New users start as Viewers. Change
              their role below.
            </p>
            {peopleError && <p className="warning danger">{peopleError}</p>}
            {people.map((p) => (
              <div className="user-row" key={p.id}>
                <div>
                  <strong>{p.name || p.email}</strong>
                  <small>{p.email}</small>
                </div>
                <select
                  aria-label={'Role for ' + p.email}
                  value={pendingRole[p.id] || p.role}
                  disabled={p.id === user.id}
                  onChange={(e) =>
                    setPendingRole({ ...pendingRole, [p.id]: e.target.value as User['role'] })
                  }
                >
                  {['Admin', 'Member', 'Viewer'].map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
                <button
                  disabled={busy || !pendingRole[p.id] || p.id === user.id}
                  onClick={async () => {
                    if (
                      await act(async () => {
                        const { error } = await supabase!.rpc('set_user_role', {
                          p_id: p.id,
                          p_role: pendingRole[p.id],
                        });
                        if (error) throw error;
                      }, 'User role updated')
                    ) {
                      setPeople(
                        people.map((person) =>
                          person.id === p.id ? { ...person, role: pendingRole[p.id] } : person,
                        ),
                      );
                      setPendingRole((prev) => {
                        const next = { ...prev };
                        delete next[p.id];
                        return next;
                      });
                    }
                  }}
                >
                  Save role
                </button>
              </div>
            ))}
          </>
        ) : (
          <p className="help-text">
            Your role: {user.role}. Only administrators can manage accounts.
          </p>
        )}
      </section>
    </>
  );
}
