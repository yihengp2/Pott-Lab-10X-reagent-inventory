import Papa from 'papaparse';
import { blankItem, STATUSES, ITEM_TYPES, type AppSettings, type InventoryItem } from '../model';
import { validateItem } from './business';
export const CSV_FIELDS = Object.keys(
  blankItem({ defaultFreezer: '', labName: '' } as AppSettings),
) as (keyof InventoryItem)[];
export function exportCsv(items: InventoryItem[]) {
  return '\ufeff' + Papa.unparse(items, { columns: CSV_FIELDS, escapeFormulae: true });
}
export function csvTemplate() {
  return Papa.unparse({ fields: CSV_FIELDS, data: [] });
}
export function parseCsv(text: string, settings: AppSettings) {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h: string) => h.trim(),
  });
  const errors = parsed.errors.map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`);
  const fields = parsed.meta.fields || [];
  for (const field of ['itemName', 'workflow', 'status', 'ownerLab', 'freezer', 'shelf', 'box'])
    if (!fields.includes(field)) errors.push(`Missing column: ${field}`);
  const items: InventoryItem[] = [];
  parsed.data.forEach((row, index) => {
    try {
      const item = blankItem(settings);
      for (const field of CSV_FIELDS) {
        if (
          row[field] !== undefined &&
          !['id', 'createdAt', 'updatedAt', 'updatedBy'].includes(field)
        ) {
          Object.assign(item, {
            [field]: ['originalReactions', 'remainingReactions', 'quantity'].includes(field)
              ? Number(row[field].trim())
              : field === 'notes'
                ? row[field]
                : row[field].trim(),
          });
        }
      }
      if (!STATUSES.includes(item.status)) throw new Error('Invalid status');
      if (!ITEM_TYPES.includes(item.itemType)) throw new Error('Invalid item type');
      validateItem(item);
      items.push(item);
    } catch (e) {
      errors.push(`Row ${index + 2}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  return { items, errors };
}
export function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
