import { describe, expect, it } from 'vitest';
import { applyCatalogEntry, searchCatalog } from '../src/data/catalog';
import { blankItem, DEFAULT_SETTINGS } from '../src/model';

describe('Kit catalog', () => {
  it('finds kits by catalog number or case-insensitive name', () => {
    expect(searchCatalog(' 1000269 ')[0].reactions).toBe(4);
    expect(searchCatalog('gem-x')).toHaveLength(2);
    expect(searchCatalog('unlisted kit')).toEqual([]);
  });
  it('fills standard fields while preserving the local record details', () => {
    const original = {
      ...blankItem(DEFAULT_SETTINGS),
      lotNumber: 'LOT-42',
      expirationDate: '2027-01-01',
      ownerPerson: 'Researcher',
      shelf: 'Shelf 2',
      box: 'Box C',
      notes: 'Reserved for project',
      status: 'HOLD' as const,
    };
    const result = applyCatalogEntry(original, searchCatalog('1000269')[0]);
    expect(result.catalogNumber).toBe('1000269');
    expect(result.originalReactions).toBe(4);
    expect(result.remainingReactions).toBe(4);
    expect(result.quantity).toBe(1);
    for (const key of [
      'id',
      'lotNumber',
      'expirationDate',
      'ownerPerson',
      'shelf',
      'box',
      'notes',
      'status',
    ] as const) {
      expect(result[key]).toBe(original[key]);
    }
    expect(original.catalogNumber).toBe('');
  });
});
