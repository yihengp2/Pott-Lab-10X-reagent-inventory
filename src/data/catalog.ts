import type { InventoryItem } from '../model';
export interface CatalogEntry {
  catalogNumber: string;
  itemName: string;
  workflow: string;
  itemType: InventoryItem['itemType'];
  reactions: number;
  storageTemperature: string;
  sourceUrl: string;
}
const nextGem =
  'https://cdn.10xgenomics.com/image/upload/v1668017706/support-documents/CG000315_ChromiumNextGEMSingleCell3-_GeneExpression_v3.1_DualIndex__RevE.pdf';
const gemX =
  'https://cdn.10xgenomics.com/image/upload/v1725314293/support-documents/CG000731_ChromiumGEM-X_SingleCell3v4_UserGuide_RevB.pdf';
export const KIT_CATALOG: CatalogEntry[] = [
  {
    catalogNumber: '1000268',
    itemName: "Chromium Next GEM Single Cell 3' Kit v3.1",
    workflow: "3' Gene Expression",
    itemType: 'Complete Kit',
    reactions: 16,
    storageTemperature: 'Component-specific — see kit labels',
    sourceUrl: nextGem,
  },
  {
    catalogNumber: '1000269',
    itemName: "Chromium Next GEM Single Cell 3' Kit v3.1",
    workflow: "3' Gene Expression",
    itemType: 'Complete Kit',
    reactions: 4,
    storageTemperature: 'Component-specific — see kit labels',
    sourceUrl: nextGem,
  },
  {
    catalogNumber: '1000691',
    itemName: "Chromium GEM-X Single Cell 3' Kit v4",
    workflow: 'GEM-X',
    itemType: 'Complete Kit',
    reactions: 16,
    storageTemperature: 'Component-specific — see kit labels',
    sourceUrl: gemX,
  },
  {
    catalogNumber: '1000686',
    itemName: "Chromium GEM-X Single Cell 3' Kit v4",
    workflow: 'GEM-X',
    itemType: 'Complete Kit',
    reactions: 4,
    storageTemperature: 'Component-specific — see kit labels',
    sourceUrl: gemX,
  },
  {
    catalogNumber: '1000123',
    itemName: "Chromium Next GEM Single Cell 3' GEM Kit v3.1",
    workflow: "3' Gene Expression",
    itemType: 'Spare Component',
    reactions: 16,
    storageTemperature: '-20 °C',
    sourceUrl: nextGem,
  },
  {
    catalogNumber: '1000130',
    itemName: "Chromium Next GEM Single Cell 3' GEM Kit v3.1",
    workflow: "3' Gene Expression",
    itemType: 'Spare Component',
    reactions: 4,
    storageTemperature: '-20 °C',
    sourceUrl: nextGem,
  },
  {
    catalogNumber: '1000122',
    itemName: "Chromium Next GEM Single Cell 3' Gel Bead Kit v3.1",
    workflow: "3' Gene Expression",
    itemType: 'Beads',
    reactions: 16,
    storageTemperature: '-80 °C',
    sourceUrl: nextGem,
  },
  {
    catalogNumber: '1000129',
    itemName: "Chromium Next GEM Single Cell 3' Gel Bead Kit v3.1",
    workflow: "3' Gene Expression",
    itemType: 'Beads',
    reactions: 4,
    storageTemperature: '-80 °C',
    sourceUrl: nextGem,
  },
  {
    catalogNumber: '1000190',
    itemName: 'Library Construction Kit',
    workflow: "3' Gene Expression",
    itemType: 'Library Reagent',
    reactions: 16,
    storageTemperature: '-20 °C',
    sourceUrl: nextGem,
  },
  {
    catalogNumber: '1000196',
    itemName: 'Library Construction Kit',
    workflow: "3' Gene Expression",
    itemType: 'Library Reagent',
    reactions: 4,
    storageTemperature: '-20 °C',
    sourceUrl: nextGem,
  },
];
export function applyCatalogEntry(item: InventoryItem, entry: CatalogEntry): InventoryItem {
  return {
    ...item,
    itemName: entry.itemName,
    catalogNumber: entry.catalogNumber,
    workflow: entry.workflow,
    itemType: entry.itemType,
    originalReactions: entry.reactions,
    remainingReactions: entry.reactions,
    quantity: 1,
    quantityUnit: 'kit',
    storageTemperature: entry.storageTemperature,
  };
}
export function searchCatalog(query: string) {
  return KIT_CATALOG.filter((entry) =>
    [entry.itemName, entry.catalogNumber, entry.workflow, String(entry.reactions)]
      .join(' ')
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
}
