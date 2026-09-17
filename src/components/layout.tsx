import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ScanLine,
  Snowflake,
  History,
  ArrowDownUp,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ChevronRight,
  FlaskConical,
  Menu,
  ArrowRight,
  Clock3,
  TriangleAlert,
  LogOut,
} from 'lucide-react';
import { useInventory } from './state';
import { supabase } from '../data/repository';
import { expiration, isKit, isOtherLab } from '../lib/business';
import type { InventoryItem } from '../model';
export function Badge({ status }: { status: string }) {
  return (
    <span className={'badge badge-' + status.toLowerCase().replaceAll(' ', '-')}>
      <span />
      {status}
    </span>
  );
}
export const shortDate = (date: string) =>
  date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';
export function Shell({ children }: { children: React.ReactNode }) {
  const { settings, user } = useInventory();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const links = [
    ['/', 'Dashboard', LayoutDashboard],
    ['/inventory', 'Inventory', Package],
    ['/quick-use', 'Quick Use', ScanLine],
    ['/freezers', 'Freezer Map', Snowflake],
    ['/activity', 'Activity', History],
    ['/import-export', 'Import / Export', ArrowDownUp],
    ['/settings', 'Settings', Settings],
  ] as const;
  return (
    <div className="app">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <Link to="/" className="brand">
          <span className="brand-symbol">10x</span>
          <div>
            GENOMICS<span>REAGENT INVENTORY</span>
          </div>
        </Link>
        <div className="lab-switch">
          <div className="lab-icon">
            <FlaskConical size={18} />
          </div>
          <div>
            <strong>{settings.labName}</strong>
            <small>Laboratory workspace</small>
          </div>
          <span className="live-dot" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end={path === '/'} onClick={() => setOpen(false)}>
              <Icon size={19} />
              {label}
              {path === '/quick-use' && <span className="shortcut">↵</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-note">
            <span className="live-dot" />
            <strong>{supabase ? 'Shared workspace' : 'Demo Mode'}</strong>
            <p>{supabase ? 'Connected to Supabase' : 'Local browser storage'}</p>
          </div>
          <div className="profile">
            <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
            {supabase && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => void supabase!.auth.signOut()}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      {open && (
        <button className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate('/inventory?q=' + encodeURIComponent(search));
            }}
          >
            <Search size={18} />
            <input
              aria-label="Search all inventory"
              placeholder="Search inventory, lots, or locations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>Enter ↵</kbd>
          </form>
          <div className="topbar-right">
            <span className="live-dot" />
            {supabase ? 'Shared inventory' : 'Demo Mode — Local browser storage'}
          </div>
        </header>
        <main key={pathname}>{children}</main>
        <footer>
          <span>10x Genomics Reagent Inventory</span>
          <span>Less time tracking. More time discovering.</span>
        </footer>
      </div>
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow || 'YOUR LAB, ORGANIZED'}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <Package size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Warnings({ item }: { item: InventoryItem }) {
  const { settings } = useInventory();
  const ex = expiration(item);
  return (
    <div className="warnings">
      {isOtherLab(item, settings) && (
        <div className="warning danger">
          <TriangleAlert size={18} />
          <strong>OTHER LAB — DO NOT USE WITHOUT PERMISSION</strong>
        </div>
      )}
      {ex.level !== 'none' && (
        <div className={'warning ' + (ex.level === 'expired' ? 'danger' : '')}>
          <Clock3 size={18} />
          {ex.level === 'expired'
            ? 'EXPIRED — Consider changing status to EXPIRED.'
            : (ex.level === 'urgent'
                ? 'URGENT EXPIRATION — '
                : ex.level === 'warning'
                  ? 'EXPIRATION WARNING — '
                  : 'UPCOMING EXPIRATION — ') + ex.label}
        </div>
      )}
      {item.remainingReactions <= settings.lowStockThreshold && (
        <div className="warning">
          <TriangleAlert size={18} />
          {item.remainingReactions === 0
            ? 'No reactions remaining — consider marking DEPLETED.'
            : `LOW STOCK — ${item.remainingReactions} reactions remaining.`}
        </div>
      )}
    </div>
  );
}
export function Dashboard() {
  const { items, settings, user, history } = useInventory();
  const [window, setWindow] = useState(settings.expirationWarningInterval);
  const soon = items
    .filter((i) => {
      const d = expiration(i).days;
      return d !== null && d >= 0 && d <= window;
    })
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
  const low = items.filter((i) => i.remainingReactions <= settings.lowStockThreshold);
  const metrics = [
    {
      label: 'Active kits',
      value: items.filter((i) => isKit(i) && i.status === 'ACTIVE').length,
      icon: Package,
      tone: 'green',
      filter: 'ACTIVE',
    },
    {
      label: 'Partial kits',
      value: items.filter(
        (i) => isKit(i) && (i.status === 'PARTIAL' || i.itemType === 'Partial Kit'),
      ).length,
      icon: FlaskConical,
      tone: 'blue',
      filter: 'PARTIAL',
    },
    {
      label: 'Low-stock kits',
      value: low.filter(isKit).length,
      icon: TriangleAlert,
      tone: 'amber',
      filter: 'low',
    },
    {
      label: 'Expiring in 30 days',
      value: items.filter((i) => {
        const d = expiration(i).days;
        return d !== null && d >= 0 && d <= 30;
      }).length,
      icon: Clock3,
      tone: 'orange',
      filter: 'soon',
    },
  ];
  const recent = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  return (
    <>
      <PageHeader
        eyebrow="LABORATORY OVERVIEW"
        title="A clear view of your inventory."
        description="Keep your reagents accounted for. Keep your research moving."
        action={
          user.role !== 'Viewer' && (
            <Link className="button primary" to="/inventory/new">
              <Plus size={18} />
              Add Item
            </Link>
          )
        }
      />
      <div className="overview-line">
        <span>
          <span className="live-dot" /> {settings.labName} inventory
        </span>
        <span>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>
      <div className="metrics">
        {metrics.map((m) => (
          <Link to={'/inventory?filter=' + m.filter} key={m.label} className="metric">
            <div className="metric-top">
              <span className={'metric-icon ' + m.tone}>
                <m.icon size={19} />
              </span>
              <ArrowUpRight size={17} />
            </div>
            <strong>{m.value.toString().padStart(2, '0')}</strong>
            <span>{m.label}</span>
            <div className="metric-footer">
              View inventory <ArrowRight size={13} />
            </div>
          </Link>
        ))}
      </div>
      <div className="secondary-metrics">
        <Link to="/inventory?filter=expired">
          <span className="count red">
            {
              items.filter((i) => expiration(i).level === 'expired' || i.status === 'EXPIRED')
                .length
            }
          </span>
          <div>
            <strong>Expired items</strong>
            <small>Review before use</small>
          </div>
          <ChevronRight size={17} />
        </Link>
        <Link to="/inventory?filter=orphan">
          <span className="count purple">
            {items.filter((i) => i.status === 'ORPHAN' || i.itemType === 'Spare Component').length}
          </span>
          <div>
            <strong>Orphan & spare reagents</strong>
            <small>Make the most of what’s left</small>
          </div>
          <ChevronRight size={17} />
        </Link>
        <Link to="/inventory?filter=other">
          <span className="count blue">{items.filter((i) => isOtherLab(i, settings)).length}</span>
          <div>
            <strong>Other-lab items</strong>
            <small>Permission required to use</small>
          </div>
          <ChevronRight size={17} />
        </Link>
      </div>
      <div className="dashboard-grid">
        <section className="panel expiring">
          <div className="panel-heading">
            <div>
              <h2>
                <Clock3 size={18} />
                Expiring soon
              </h2>
              <p>Use these first to reduce reagent waste.</p>
            </div>
            <div className="segmented">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  className={window === d ? 'selected' : ''}
                  onClick={() => setWindow(d)}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ITEM / WORKFLOW</th>
                  <th>REMAINING</th>
                  <th>EXPIRATION</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {soon.slice(0, 5).map((i) => (
                  <tr key={i.id}>
                    <td>
                      <Link className="item-link" to={'/item/' + i.id}>
                        {i.itemName}
                      </Link>
                      <small>{i.workflow}</small>
                    </td>
                    <td>
                      <strong>{i.remainingReactions}</strong>
                      <span className="muted"> / {i.originalReactions} rxns</span>
                    </td>
                    <td>
                      <span className="date-urgent">{shortDate(i.expirationDate)}</span>
                      <small>{expiration(i).label}</small>
                    </td>
                    <td>
                      <Link aria-label={'View ' + i.itemName} to={'/item/' + i.id}>
                        <ChevronRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!soon.length && (
              <Empty
                title="Nothing expiring in this window"
                description="Your reagents have a little more time."
              />
            )}
          </div>
          <Link className="panel-bottom" to={'/inventory?expiration=' + window}>
            View expiring inventory
            <ArrowRight size={15} />
          </Link>
        </section>
        <section className="quick-card">
          <div className="quick-icon">
            <ScanLine size={27} />
          </div>
          <span className="eyebrow">AT THE FREEZER?</span>
          <h2>
            One reaction.
            <br />
            One quick update.
          </h2>
          <p>Find your kit, record what you use, and get back to your experiment.</p>
          <Link className="button" to="/quick-use">
            Open Quick Use
            <ArrowRight size={18} />
          </Link>
          <div className="quick-foot">
            <span />
            Built for your next 5 seconds
          </div>
          <div className="molecule m1" />
          <div className="molecule m2" />
        </section>
        <section className="panel recent">
          <div className="panel-heading">
            <div>
              <h2>Recently updated</h2>
              <p>The latest changes around the lab.</p>
            </div>
            <Link className="text-link" to="/activity">
              View activity
              <ArrowUpRight size={15} />
            </Link>
          </div>
          {recent.map((i) => (
            <Link className="recent-row" to={'/item/' + i.id} key={i.id}>
              <span className="item-icon">
                <FlaskConical size={18} />
              </span>
              <div>
                <strong>{i.itemName}</strong>
                <small>
                  {i.updatedBy} ·{' '}
                  {new Date(i.updatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </small>
              </div>
              <Badge status={i.status} />
            </Link>
          ))}
          {!recent.length && (
            <Empty
              title="Your inventory starts here"
              description="Add your first kit to see updates."
            />
          )}
          <div className="panel-bottom muted">{history.length} recorded inventory changes</div>
        </section>
        <section className="panel low-stock">
          <div className="panel-heading">
            <div>
              <h2>
                <TriangleAlert size={18} />
                Running low
              </h2>
              <p>{settings.lowStockThreshold} reactions or fewer remaining.</p>
            </div>
            <span className="small-count">{low.length}</span>
          </div>
          {low.slice(0, 4).map((i) => (
            <Link className="low-row" to={'/item/' + i.id} key={i.id}>
              <div>
                <strong>{i.itemName}</strong>
                <small>
                  {i.freezer} · {i.box}
                </small>
              </div>
              <span className="remaining-pill">
                {i.remainingReactions}
                <small>rxns</small>
              </span>
            </Link>
          ))}
          {!low.length && (
            <Empty title="Stock looks healthy" description="No low-stock items right now." />
          )}
        </section>
      </div>
    </>
  );
}
