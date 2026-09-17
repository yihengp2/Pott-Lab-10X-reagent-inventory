import { STATUSES, ITEM_TYPES, type InventoryItem, type AppSettings } from '../model';
export function daysUntil(date: string, now = new Date()): number | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000,
  );
}
export function expiration(item: InventoryItem) {
  const days = daysUntil(item.expirationDate);
  return {
    days,
    label:
      days === null
        ? 'No expiration set'
        : days < 0
          ? 'Expired'
          : days === 0
            ? 'Expires today'
            : `Expires in ${days} days`,
    level:
      days === null
        ? 'none'
        : days < 0
          ? 'expired'
          : days <= 30
            ? 'urgent'
            : days <= 60
              ? 'warning'
              : days <= 90
                ? 'notice'
                : 'none',
  };
}
export function isOtherLab(item: InventoryItem, settings: AppSettings) {
  return (
    item.status === 'OTHER LAB' ||
    item.ownerLab.trim().toLowerCase() !== settings.labName.trim().toLowerCase()
  );
}
export const location = (item: InventoryItem) =>
  [item.freezer, item.shelf, item.box, item.position].filter(Boolean).join(' / ');
export const isKit = (item: InventoryItem) =>
  item.itemType === 'Complete Kit' || item.itemType === 'Partial Kit';
export function validateItem(item: InventoryItem) {
  if (!STATUSES.includes(item.status)) throw new Error('Invalid status.');
  if (!ITEM_TYPES.includes(item.itemType)) throw new Error('Invalid item type.');
  for (const key of ['itemName', 'workflow', 'ownerLab', 'freezer', 'shelf', 'box'] as const)
    if (!item[key].trim()) throw new Error(`${key.replace(/([A-Z])/g, ' $1')} is required.`);
  for (const key of ['originalReactions', 'remainingReactions', 'quantity'] as const)
    if (!Number.isFinite(item[key]) || item[key] < 0 || item[key] > 1000000000)
      throw new Error(`${key} must be a nonnegative number.`);
  if (!Number.isInteger(item.remainingReactions) || !Number.isInteger(item.originalReactions))
    throw new Error('Reactions must be whole numbers.');
  if (item.remainingReactions > item.originalReactions)
    throw new Error('Remaining reactions cannot exceed original reactions.');
  for (const key of ['expirationDate', 'openedDate', 'receivedDate'] as const)
    if (
      item[key] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(item[key]) ||
        Number.isNaN(Date.parse(item[key])) ||
        new Date(item[key]).toISOString().slice(0, 10) !== item[key])
    )
      throw new Error(`Invalid ${key}. Use YYYY-MM-DD.`);
}
export function useReactions(item: InventoryItem, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0)
    throw new Error('Enter a positive whole number of reactions.');
  if (amount > item.remainingReactions)
    throw new Error(`Only ${item.remainingReactions} reactions remain.`);
  return { ...item, remainingReactions: item.remainingReactions - amount };
}
export function matchesSearch(item: InventoryItem, query: string) {
  return [
    item.itemName,
    item.catalogNumber,
    item.lotNumber,
    item.workflow,
    item.ownerLab,
    item.ownerPerson,
    item.project,
    location(item),
    item.notes,
  ]
    .join(' ')
    .toLowerCase()
    .includes(query.toLowerCase().trim());
}

export function normalizeSettings(settings: AppSettings): AppSettings {
  const next = {
    ...settings,
    labName: settings.labName.trim(),
    defaultFreezer: settings.defaultFreezer.trim(),
  };
  if (!next.labName || !next.defaultFreezer)
    throw new Error('Lab name and default freezer are required.');
  if (
    !Number.isInteger(next.lowStockThreshold) ||
    next.lowStockThreshold < 0 ||
    next.lowStockThreshold > 1000000000
  )
    throw new Error('Enter a valid nonnegative stock threshold.');
  if (![30, 60, 90].includes(next.expirationWarningInterval))
    throw new Error('Choose a 30, 60, or 90 day expiration window.');
  for (const key of ['workflows', 'ownerLabs', 'projects', 'freezers', 'shelves', 'boxes'] as const)
    next[key] = [...new Set(next[key].map((v) => v.trim()).filter(Boolean))];
  return next;
}
