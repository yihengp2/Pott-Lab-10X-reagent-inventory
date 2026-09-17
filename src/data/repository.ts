import { createClient } from '@supabase/supabase-js';
import {
  type InventoryItem,
  type InventoryHistory,
  type HistoryAction,
  type AppSettings,
  type User,
  DEFAULT_SETTINGS,
} from '../model';
import { sampleItems } from './sample';
import { validateItem, useReactions, normalizeSettings } from '../lib/business';
export interface InventoryRepository {
  getItems(): Promise<InventoryItem[]>;
  getItem(id: string): Promise<InventoryItem | undefined>;
  createItem(item: InventoryItem): Promise<void>;
  updateItem(item: InventoryItem, action?: HistoryAction, notes?: string): Promise<void>;
  useQuantity(id: string, amount: number, notes?: string): Promise<void>;
  restock(id: string, amount: number): Promise<void>;
  deleteItem(id: string): Promise<void>;
  getHistory(id?: string): Promise<InventoryHistory[]>;
  createHistory(): Promise<never>;
  importItems(items: InventoryItem[]): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
}
interface Store {
  items: InventoryItem[];
  history: InventoryHistory[];
  settings: AppSettings;
}
export const STORAGE_KEY = '10x-inventory-v1';
export class LocalStorageInventoryRepository implements InventoryRepository {
  constructor(
    private storage: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: (k) => localStorage.getItem(k),
      setItem: (k, v) => localStorage.setItem(k, v),
    },
    private actor = 'Demo administrator',
  ) {}
  private read(): Store {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const items = sampleItems();
    const state = {
      items,
      history: items.map((item) => ({
        id: crypto.randomUUID(),
        timestamp: item.createdAt,
        user: item.updatedBy,
        inventoryItem: item.id,
        itemName: item.itemName,
        action: 'Created' as const,
        previousValue: null,
        newValue: item,
        notes: 'Demo sample inventory',
      })),
      settings: DEFAULT_SETTINGS,
    };
    this.write(state);
    return state;
  }
  private write(state: Store) {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  private async transaction(run: (state: Store) => void) {
    const execute = async () => {
      const state = this.read();
      run(state);
      this.write(state);
    };
    if (typeof navigator !== 'undefined' && navigator.locks)
      await navigator.locks.request(STORAGE_KEY, execute);
    else await execute();
  }
  private record(
    state: Store,
    item: InventoryItem,
    action: HistoryAction,
    previous: InventoryItem | null,
    notes = '',
  ) {
    const now = new Date().toISOString();
    item.updatedAt = now;
    item.updatedBy = this.actor;
    state.history.unshift({
      id: crypto.randomUUID(),
      timestamp: now,
      user: this.actor,
      inventoryItem: item.id,
      itemName: item.itemName,
      action,
      previousValue: previous,
      newValue: { ...item },
      notes,
    });
  }
  async getItems() {
    return this.read().items.filter((i) => !i.deletedAt);
  }
  async getItem(id: string) {
    return (await this.getItems()).find((i) => i.id === id);
  }
  async createItem(item: InventoryItem) {
    validateItem(item);
    await this.transaction((s) => {
      if (s.items.some((i) => i.id === item.id)) throw new Error('Record already exists.');
      const next = { ...item, createdAt: new Date().toISOString() };
      this.record(s, next, 'Created', null);
      s.items.push(next);
    });
  }
  async updateItem(item: InventoryItem, action: HistoryAction = 'Edited', notes = '') {
    validateItem(item);
    await this.transaction((s) => {
      const index = s.items.findIndex((i) => i.id === item.id && !i.deletedAt);
      if (index < 0) throw new Error('Item not found.');
      const prev = s.items[index];
      if (item.updatedAt !== prev.updatedAt)
        throw new Error('This record changed in another tab. Refresh and try again.');
      const next = { ...item, createdAt: prev.createdAt };
      this.record(s, next, action, { ...prev }, notes);
      s.items[index] = next;
    });
  }
  async useQuantity(id: string, amount: number, notes = '') {
    await this.transaction((s) => {
      const i = s.items.findIndex((i) => i.id === id && !i.deletedAt);
      if (i < 0) throw new Error('Item not found.');
      const previous = { ...s.items[i] };
      const next = useReactions(previous, amount);
      this.record(
        s,
        next,
        'Used',
        previous,
        notes || `Used ${amount} reaction${amount === 1 ? '' : 's'}`,
      );
      s.items[i] = next;
    });
  }
  async restock(id: string, amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Enter a positive whole number.');
    await this.transaction((s) => {
      const item = s.items.find((i) => i.id === id && !i.deletedAt);
      if (!item) throw new Error('Item not found.');
      const prev = { ...item };
      item.remainingReactions += amount;
      item.originalReactions = Math.max(item.originalReactions, item.remainingReactions);
      validateItem(item);
      this.record(s, item, 'Restocked', prev, `Added ${amount} reactions`);
    });
  }
  async deleteItem(id: string) {
    await this.transaction((s) => {
      const item = s.items.find((i) => i.id === id && !i.deletedAt);
      if (!item) throw new Error('Item not found.');
      const prev = { ...item };
      item.deletedAt = new Date().toISOString();
      this.record(s, item, 'Deleted', prev, 'Soft deleted; retained in audit history');
    });
  }
  async getHistory(id?: string) {
    return this.read()
      .history.filter((h) => !id || h.inventoryItem === id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }
  async createHistory(): Promise<never> {
    throw new Error('History is generated atomically by inventory changes.');
  }
  async importItems(items: InventoryItem[]) {
    items.forEach(validateItem);
    await this.transaction((s) => {
      items.forEach((item) => {
        const next = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
        this.record(s, next, 'Created', null, 'CSV import');
        s.items.push(next);
      });
    });
  }
  async getSettings() {
    return this.read().settings;
  }
  async saveSettings(settings: AppSettings) {
    await this.transaction((s) => {
      s.settings = normalizeSettings(settings);
    });
  }
}
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const configurationError =
  Boolean(url) !== Boolean(key)
    ? 'Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or leave both empty for demo mode.'
    : null;
export class SupabaseInventoryRepository implements InventoryRepository {
  private client() {
    if (!supabase) throw new Error('Supabase is not configured.');
    return supabase;
  }
  private async mutate(id: string, action: string, payload: unknown = {}, notes = '') {
    const { error } = await this.client().rpc('mutate_inventory', {
      p_id: id,
      p_action: action,
      p_payload: payload,
      p_notes: notes,
    });
    if (error) throw error;
  }
  async getItems() {
    const items: InventoryItem[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await this.client()
        .from('inventory_items')
        .select('data')
        .is('deleted_at', null)
        .order('id')
        .range(offset, offset + 999);
      if (error) throw error;
      items.push(...(data || []).map((r) => r.data as InventoryItem));
      if (!data || data.length < 1000) break;
    }
    return items;
  }
  async getItem(id: string) {
    const { data, error } = await this.client()
      .from('inventory_items')
      .select('data')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data?.data as InventoryItem | undefined;
  }
  async createItem(item: InventoryItem) {
    validateItem(item);
    await this.mutate(item.id, 'Created', item);
  }
  async updateItem(item: InventoryItem, action: HistoryAction = 'Edited', notes = '') {
    validateItem(item);
    await this.mutate(item.id, action, item, notes);
  }
  async useQuantity(id: string, amount: number, notes = '') {
    await this.mutate(id, 'Used', { amount }, notes);
  }
  async restock(id: string, amount: number) {
    await this.mutate(id, 'Restocked', { amount });
  }
  async deleteItem(id: string) {
    await this.mutate(id, 'Deleted');
  }
  async getHistory(id?: string) {
    const history: InventoryHistory[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = this.client()
        .from('inventory_history')
        .select('data')
        .order('created_at', { ascending: false })
        .order('id')
        .range(offset, offset + 999);
      if (id) query = query.eq('inventory_item_id', id);
      const { data, error } = await query;
      if (error) throw error;
      history.push(...(data || []).map((r) => r.data as InventoryHistory));
      if (!data || data.length < 1000) break;
    }
    return history;
  }
  async createHistory(): Promise<never> {
    throw new Error('History is generated atomically by inventory changes.');
  }
  async importItems(items: InventoryItem[]) {
    items.forEach(validateItem);
    const { error } = await this.client().rpc('import_inventory', { p_items: items });
    if (error) throw error;
  }
  async getSettings() {
    const { data, error } = await this.client()
      .from('settings')
      .select('data')
      .eq('id', 'default')
      .maybeSingle();
    if (error) throw error;
    return data ? (data.data as AppSettings) : DEFAULT_SETTINGS;
  }
  async saveSettings(settings: AppSettings) {
    const { error } = await this.client()
      .from('settings')
      .upsert({ id: 'default', data: normalizeSettings(settings) });
    if (error) throw error;
  }
}
export const repository: InventoryRepository = supabase
  ? new SupabaseInventoryRepository()
  : new LocalStorageInventoryRepository();
export async function getProfile(id: string): Promise<User> {
  if (!supabase) throw new Error('Not configured');
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return { id: data.id, email: data.email, name: data.name, role: data.role };
}
