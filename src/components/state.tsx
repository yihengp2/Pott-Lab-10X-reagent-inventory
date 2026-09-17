import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { AppSettings, InventoryHistory, InventoryItem, User } from '../model';
import { DEFAULT_SETTINGS } from '../model';
import { repository, supabase, getProfile, configurationError } from '../data/repository';
interface State {
  items: InventoryItem[];
  history: InventoryHistory[];
  settings: AppSettings;
  user: User;
  refresh: () => Promise<void>;
  act: (fn: () => Promise<void>, message: string) => Promise<boolean>;
  busy: boolean;
  notify: (message: string) => void;
}
const Context = createContext<State | null>(null);
export const useInventory = () => {
  const state = useContext(Context);
  if (!state) throw new Error('Missing provider');
  return state;
};
export function Provider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [user, setUser] = useState<User | null>(
    supabase
      ? null
      : { id: 'demo', email: 'demo@local', name: 'Demo administrator', role: 'Admin' },
  );
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(configurationError || '');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const refresh = useCallback(async () => {
    const [i, h, s] = await Promise.all([
      repository.getItems(),
      repository.getHistory(),
      repository.getSettings(),
    ]);
    setItems(i);
    setHistory(h);
    setSettings(s);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void getProfile(session.user.id)
          .then(setUser)
          .catch((e) => setError(e.message));
      } else {
        setUser(null);
        setLoaded(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (user)
      void refresh()
        .then(() => setLoaded(true))
        .catch((e) => {
          setError(e.message);
          setLoaded(true);
        });
  }, [user, refresh]);
  useEffect(() => {
    const handler = () => void refresh().catch((e) => setError(e.message));
    if (!user) return;
    window.addEventListener('storage', handler);
    window.addEventListener('focus', handler);
    const timer = supabase
      ? setInterval(() => {
          if (document.visibilityState === 'visible') handler();
        }, 15000)
      : undefined;
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('focus', handler);
      if (timer) clearInterval(timer);
    };
  }, [refresh, user]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(''), 5000);
      return () => clearTimeout(id);
    }
  }, [toast]);
  async function act(fn: () => Promise<void>, message: string) {
    if (busy) return false;
    setBusy(true);
    try {
      await fn();
      await refresh();
      setToast(message);
      return true;
    } catch (e) {
      setToast(
        `Error: ${e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e)}`,
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <main className="auth">
        <h1>Unable to load inventory</h1>
        <p role="alert">{error}</p>
        <button onClick={() => location.reload()}>Try again</button>
        {supabase && (
          <button onClick={() => void supabase!.auth.signOut().then(() => location.reload())}>
            Sign out
          </button>
        )}
      </main>
    );
  if (!user && supabase)
    return (
      <main className="auth">
        <span className="brand-symbol">10x</span>
        <h1>Your lab. In sync.</h1>
        <p>Sign in to your shared reagent inventory.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await supabase!.auth.signInWithPassword({ email, password });
            if (error) setToast(error.message);
            setBusy(false);
          }}
        >
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="primary" disabled={busy}>
            Sign in
          </button>
          <p>Ask your lab administrator for an account.</p>
          <p role="alert">{toast}</p>
        </form>
      </main>
    );
  if (!loaded || !user)
    return (
      <main className="auth">
        <span className="brand-symbol">10x</span>
        <p>Loading your laboratory inventory…</p>
      </main>
    );
  return (
    <Context.Provider
      value={{ items, history, settings, user, refresh, act, busy, notify: setToast }}
    >
      {children}
      {toast && (
        <div
          role="status"
          className={'toast ' + (toast.startsWith('Error') ? 'error' : '')}
          onClick={() => setToast('')}
        >
          {toast}
          <span>×</span>
        </div>
      )}
    </Context.Provider>
  );
}
