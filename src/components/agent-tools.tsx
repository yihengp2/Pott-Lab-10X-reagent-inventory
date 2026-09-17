import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from './state';
import { matchesSearch } from '../lib/business';
interface ToolRegistry {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
export function AgentTools() {
  const { items } = useInventory();
  const navigate = useNavigate();
  useEffect(() => {
    const context = (document as Document & { modelContext?: ToolRegistry }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'search_inventory',
            description:
              'Search current laboratory inventory by item, lot, owner, project, location or notes. Opens the same filtered Inventory view without changing records.',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input) {
              if (
                !input ||
                typeof input !== 'object' ||
                !('query' in input) ||
                typeof input.query !== 'string' ||
                input.query.length > 500
              )
                throw new Error('Provide a query string of at most 500 characters.');
              const matches = items.filter((i) => matchesSearch(i, input.query as string));
              navigate('/inventory?q=' + encodeURIComponent(input.query));
              return {
                count: matches.length,
                items: matches.slice(0, 50).map((i) => ({
                  id: i.id,
                  itemName: i.itemName,
                  remainingReactions: i.remainingReactions,
                  status: i.status,
                })),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional proposed browser API; unsupported contexts use the UI. */
    }
    return () => lifecycle.abort();
  }, [items, navigate]);
  return null;
}
