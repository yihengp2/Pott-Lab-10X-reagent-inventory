export const WORKFLOWS = [
  "3' Gene Expression",
  "5' Gene Expression",
  "5' Immune Profiling",
  'CITE-seq',
  'TCR',
  'BCR',
  'ATAC',
  'Multiome',
  'Flex',
  'Fixed RNA Profiling',
  'GEM-X',
  'Chromium',
  'Other',
];
export const ITEM_TYPES = [
  'Complete Kit',
  'Partial Kit',
  'Individual Reagent',
  'Spare Component',
  'Buffer',
  'Enzyme',
  'Library Reagent',
  'Chip',
  'Beads',
  'Other',
] as const;
export const STATUSES = [
  'ACTIVE',
  'PARTIAL',
  'LOW STOCK',
  'ORPHAN',
  'EXPIRED',
  'DEPLETED',
  'HOLD',
  'RESERVED',
  'OTHER LAB',
] as const;
export type Status = (typeof STATUSES)[number];
export interface InventoryItem {
  id: string;
  itemName: string;
  workflow: string;
  itemType: (typeof ITEM_TYPES)[number];
  catalogNumber: string;
  lotNumber: string;
  ownerLab: string;
  ownerPerson: string;
  project: string;
  originalReactions: number;
  remainingReactions: number;
  expirationDate: string;
  openedDate: string;
  receivedDate: string;
  storageTemperature: string;
  freezer: string;
  shelf: string;
  box: string;
  position: string;
  status: Status;
  notes: string;
  sourceKit: string;
  quantity: number;
  quantityUnit: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt?: string;
}
export type HistoryAction =
  'Created' | 'Edited' | 'Used' | 'Restocked' | 'Moved' | 'Status changed' | 'Deleted';
export interface InventoryHistory {
  id: string;
  timestamp: string;
  user: string;
  inventoryItem: string;
  itemName: string;
  action: HistoryAction;
  previousValue: Partial<InventoryItem> | null;
  newValue: Partial<InventoryItem> | null;
  notes: string;
}
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'Admin' | 'Member' | 'Viewer';
}
export interface Lab {
  id: string;
  name: string;
}
export interface Project {
  id: string;
  name: string;
  labId?: string;
}
export interface FreezerLocation {
  id: string;
  freezer: string;
  shelf: string;
  box: string;
  position: string;
}
export interface AppSettings {
  labName: string;
  defaultFreezer: string;
  lowStockThreshold: number;
  expirationWarningInterval: number;
  workflows: string[];
  ownerLabs: string[];
  projects: string[];
  freezers: string[];
  shelves: string[];
  boxes: string[];
}
export const DEFAULT_SETTINGS: AppSettings = {
  labName: 'Pott Lab',
  defaultFreezer: 'Freezer -20 #1',
  lowStockThreshold: 2,
  expirationWarningInterval: 30,
  workflows: WORKFLOWS,
  ownerLabs: ['Pott Lab', 'Collaborating Lab'],
  projects: ['Cell Atlas', 'Immune Landscape', 'Chromatin Accessibility'],
  freezers: ['Freezer -20 #1', 'Freezer -80 #2'],
  shelves: ['Shelf 1', 'Shelf 2', 'Shelf 3', 'Shelf 4', 'Shelf 5'],
  boxes: ['Box A', 'Box B', 'Box C', 'Spare Components', 'Expired', 'Box Other Lab'],
};
export function blankItem(settings: AppSettings): InventoryItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    itemName: '',
    workflow: WORKFLOWS[0],
    itemType: 'Complete Kit',
    catalogNumber: '',
    lotNumber: '',
    ownerLab: settings.labName,
    ownerPerson: '',
    project: '',
    originalReactions: 16,
    remainingReactions: 16,
    expirationDate: '',
    openedDate: '',
    receivedDate: new Date().toISOString().slice(0, 10),
    storageTemperature: '-20 °C',
    freezer: settings.defaultFreezer,
    shelf: '',
    box: '',
    position: '',
    status: 'ACTIVE',
    notes: '',
    sourceKit: '',
    quantity: 1,
    quantityUnit: 'kit',
    createdAt: now,
    updatedAt: now,
    updatedBy: '',
  };
}
