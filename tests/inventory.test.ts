import { describe, it, expect, beforeEach } from 'vitest';
import { blankItem, DEFAULT_SETTINGS, type InventoryItem } from '../src/model';
import { LocalStorageInventoryRepository, STORAGE_KEY } from '../src/data/repository';
import {
  daysUntil,
  expiration,
  isOtherLab,
  matchesSearch,
  validateItem,
} from '../src/lib/business';
import { exportCsv, parseCsv } from '../src/lib/csv';
let data: Map<string, string>;
let repo: LocalStorageInventoryRepository;
beforeEach(() => {
  data = new Map();
  data.set(STORAGE_KEY, JSON.stringify({ items: [], history: [], settings: DEFAULT_SETTINGS }));
  repo = new LocalStorageInventoryRepository(
    {
      getItem: (k) => data.get(k) || null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    },
    'Test researcher',
  );
});
const fixture = () => ({
  ...blankItem(DEFAULT_SETTINGS),
  itemName: 'Test Kit',
  shelf: 'Shelf 1',
  box: 'Box A',
  remainingReactions: 1,
});
describe('Inventory transactions', () => {
  it('creates, edits and persists records with history', async () => {
    const item = fixture();
    await repo.createItem(item);
    await repo.updateItem({ ...(await repo.getItem(item.id))!, notes: 'Edited notes' });
    const fresh = new LocalStorageInventoryRepository({
      getItem: (k) => data.get(k) || null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    });
    expect((await fresh.getItem(item.id))?.notes).toBe('Edited notes');
    expect((await repo.getHistory(item.id)).map((h) => h.action)).toEqual(['Edited', 'Created']);
  });
  it('reaches zero without silently changing status and rejects overuse', async () => {
    const item = fixture();
    await repo.createItem(item);
    await repo.useQuantity(item.id, 1);
    expect((await repo.getItem(item.id))?.remainingReactions).toBe(0);
    expect((await repo.getItem(item.id))?.status).toBe('ACTIVE');
    await expect(repo.useQuantity(item.id, 1)).rejects.toThrow('Only 0');
    expect(await repo.getHistory(item.id)).toHaveLength(2);
  });
  it('rejects invalid usage amounts', async () => {
    const item = fixture();
    await repo.createItem(item);
    for (const amount of [0, -1, 0.5, NaN, Infinity])
      await expect(repo.useQuantity(item.id, amount)).rejects.toThrow();
    expect((await repo.getItem(item.id))?.remainingReactions).toBe(1);
  });
  it('records restocking and moving', async () => {
    const item = fixture();
    await repo.createItem(item);
    await repo.restock(item.id, 20);
    const saved = (await repo.getItem(item.id))!;
    expect(saved.remainingReactions).toBe(21);
    expect(saved.originalReactions).toBe(21);
    await repo.updateItem({ ...saved, box: 'Box B' }, 'Moved');
    expect((await repo.getHistory(item.id)).map((h) => h.action)).toEqual([
      'Moved',
      'Restocked',
      'Created',
    ]);
  });
  it('soft deletes but retains audit history', async () => {
    const item = fixture();
    await repo.createItem(item);
    await repo.deleteItem(item.id);
    expect(await repo.getItems()).toHaveLength(0);
    expect((await repo.getHistory(item.id))[0].action).toBe('Deleted');
    expect(JSON.parse(data.get(STORAGE_KEY)!).items[0].deletedAt).toBeTruthy();
  });
  it('rejects stale edits', async () => {
    const item = fixture();
    await repo.createItem(item);
    await expect(repo.updateItem({ ...item, updatedAt: '2000-01-01' })).rejects.toThrow(
      'another tab',
    );
  });
  it('imports atomically with independent ids', async () => {
    const a = fixture();
    await expect(repo.importItems([a, { ...a, itemName: '' }])).rejects.toThrow();
    expect(await repo.getItems()).toHaveLength(0);
    await repo.importItems([a, a]);
    expect(await repo.getItems()).toHaveLength(2);
    expect(new Set((await repo.getItems()).map((i) => i.id)).size).toBe(2);
    expect(await repo.getHistory()).toHaveLength(2);
  });
  it('does not corrupt saved data on a storage failure', async () => {
    const broken = new LocalStorageInventoryRepository({
      getItem: (k) => data.get(k) || null,
      setItem: () => {
        throw new Error('Quota exceeded');
      },
    });
    await expect(broken.createItem(fixture())).rejects.toThrow('Quota');
    expect(await repo.getItems()).toHaveLength(0);
  });
  it('persists settings', async () => {
    await repo.saveSettings({ ...DEFAULT_SETTINGS, lowStockThreshold: 4 });
    expect((await repo.getSettings()).lowStockThreshold).toBe(4);
  });
});
describe('Business logic', () => {
  it('uses local calendar-day expiration boundaries', () => {
    const now = new Date(2026, 2, 7, 23, 59);
    expect(daysUntil('2026-03-08', now)).toBe(1);
    expect(daysUntil('2026-03-07', now)).toBe(0);
    expect(daysUntil('2026-03-06', now)).toBe(-1);
    expect(daysUntil('', now)).toBeNull();
  });
  it('flags expiration without overwriting status', () => {
    const item = { ...fixture(), expirationDate: '2020-01-01' };
    expect(expiration(item).level).toBe('expired');
    expect(item.status).toBe('ACTIVE');
  });
  it('recognizes other lab by status and owner', () => {
    expect(isOtherLab({ ...fixture(), ownerLab: 'Other' }, DEFAULT_SETTINGS)).toBe(true);
    expect(isOtherLab({ ...fixture(), status: 'OTHER LAB' }, DEFAULT_SETTINGS)).toBe(true);
    expect(isOtherLab({ ...fixture(), ownerLab: ' pott lab ' }, DEFAULT_SETTINGS)).toBe(false);
  });
  it('searches notes, projects and full location', () => {
    const item = { ...fixture(), notes: 'Use with adapter', project: 'Atlas' };
    for (const q of ['adapter', 'atlas', 'box a', 'TEST KIT'])
      expect(matchesSearch(item, q)).toBe(true);
    expect(matchesSearch(item, 'missing')).toBe(false);
  });
  it('validates quantities, dates and required location', () => {
    expect(() => validateItem({ ...fixture(), box: '' })).toThrow();
    expect(() => validateItem({ ...fixture(), expirationDate: '2026-02-30' })).toThrow();
    expect(() => validateItem({ ...fixture(), remainingReactions: 17 })).toThrow();
  });
});
describe('CSV', () => {
  it('round trips quotes, commas and multiline notes', () => {
    const item = { ...fixture(), itemName: 'Kit, "A"', notes: 'line one\nline two' };
    const result = parseCsv(exportCsv([item]), DEFAULT_SETTINGS);
    expect(result.errors).toEqual([]);
    expect(result.items[0].itemName).toBe(item.itemName);
    expect(result.items[0].notes).toBe(item.notes);
    expect(result.items[0].id).not.toBe(item.id);
  });
  it('escapes formulas for Excel', () => {
    expect(exportCsv([{ ...fixture(), itemName: '=1+1' }])).toContain("'=1+1");
  });
  it('reports missing fields and invalid status', () => {
    expect(parseCsv('itemName\nKit', DEFAULT_SETTINGS).errors.length).toBeGreaterThan(0);
    expect(
      parseCsv(
        exportCsv([{ ...fixture(), status: 'INVALID' } as unknown as InventoryItem]),
        DEFAULT_SETTINGS,
      ).errors.join(' '),
    ).toContain('Invalid status');
  });
});

it('accepts Windows mixed CSV line endings', () => {
  const csv =
    'itemName,workflow,itemType,status,ownerLab,freezer,shelf,box,expirationDate\nTest,ATAC,Buffer,ACTIVE,Pott Lab,Freezer,Shelf,Box,2027-12-31\r\n';
  expect(parseCsv(csv, DEFAULT_SETTINGS).errors).toEqual([]);
});
