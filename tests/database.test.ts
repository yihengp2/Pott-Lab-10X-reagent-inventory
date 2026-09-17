import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { blankItem, DEFAULT_SETTINGS, type InventoryItem } from '../src/model';
let db: PGlite;
const admin = '00000000-0000-4000-8000-000000000001',
  member = '00000000-0000-4000-8000-000000000002',
  viewer = '00000000-0000-4000-8000-000000000003';
async function asUser(id: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
const fixture = () => ({
  ...blankItem(DEFAULT_SETTINGS),
  itemName: 'SQL test kit',
  shelf: 'Shelf 1',
  box: 'Box A',
  remainingReactions: 1,
});
async function mutate(item: InventoryItem, action = 'Created', payload: unknown = item) {
  return (
    await db.query<{ mutate_inventory: InventoryItem }>(
      'select public.mutate_inventory($1,$2,$3::jsonb,$4)',
      [item.id, action, JSON.stringify(payload), 'Test'],
    )
  ).rows[0].mutate_inventory;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;",
  );
  await db.exec(readFileSync('supabase/migrations/001_inventory.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/002_settings_validation.sql', 'utf8'));
  for (const [id, email] of [
    [admin, 'admin@lab.test'],
    [member, 'member@lab.test'],
    [viewer, 'viewer@lab.test'],
  ])
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,'{}')", [
      id,
      email,
    ]);
  await db.query(
    "update public.profiles set role=case when id=$1 then 'Admin' when id=$2 then 'Member' else 'Viewer' end",
    [admin, member],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe('PostgreSQL migration and authorization', () => {
  it('creates users as Viewers', async () => {
    await asUser(viewer);
    const p = await db.query<{ role: string }>('select role from public.profiles');
    expect(p.rows).toEqual([{ role: 'Viewer' }]);
  });
  it('blocks Viewer writes even through RPC', async () => {
    await asUser(viewer);
    await expect(mutate(fixture())).rejects.toThrow('Write access denied');
  });
  it('allows member creation and consumption with atomic history', async () => {
    await asUser(member);
    const item = fixture();
    await mutate(item);
    const used = await mutate(item, 'Used', { amount: 1 });
    expect(used.remainingReactions).toBe(0);
    expect(used.status).toBe('ACTIVE');
    await expect(mutate(item, 'Used', { amount: 1 })).rejects.toThrow('Insufficient');
    const history = await db.query<{ count: number }>(
      'select count(*)::int as count from public.inventory_history where inventory_item_id=$1',
      [item.id],
    );
    expect(history.rows[0].count).toBe(2);
  });
  it('prevents members from changing ownership or deleting', async () => {
    await asUser(member);
    const item = await mutate(fixture());
    await expect(mutate(item, 'Edited', { ...item, ownerLab: 'Hijacked' })).rejects.toThrow(
      'Members can only',
    );
    await expect(mutate(item, 'Deleted', {})).rejects.toThrow('Administrator');
  });
  it('allows member movement and quantity updates', async () => {
    await asUser(member);
    const item = await mutate(fixture());
    const moved = await mutate(item, 'Moved', { ...item, box: 'Box B' });
    expect(moved.box).toBe('Box B');
  });
  it('blocks direct writes and audit forgery', async () => {
    await asUser(admin);
    await expect(db.query("insert into public.inventory_items(data) values('{}')")).rejects.toThrow(
      'permission denied',
    );
    await expect(db.query('delete from public.inventory_history')).rejects.toThrow(
      'permission denied',
    );
  });
  it('soft deletes as Admin and preserves history', async () => {
    await asUser(admin);
    const item = await mutate(fixture());
    await mutate(item, 'Deleted', {});
    const rows = await db.query<{ deleted_at: string }>(
      'select deleted_at from public.inventory_items where id=$1',
      [item.id],
    );
    expect(rows.rows[0].deleted_at).toBeTruthy();
    const h = await db.query('select * from public.inventory_history where inventory_item_id=$1', [
      item.id,
    ]);
    expect(h.rows.length).toBe(2);
  });
  it('rejects stale edits', async () => {
    await asUser(admin);
    const item = await mutate(fixture());
    await expect(mutate(item, 'Edited', { ...item, updatedAt: 'old' })).rejects.toThrow(
      'Record changed',
    );
  });
  it('rolls back the entire import on invalid data', async () => {
    await asUser(admin);
    const before = (
      await db.query<{ n: number }>('select count(*)::int n from public.inventory_items')
    ).rows[0].n;
    await expect(
      db.query('select public.import_inventory($1::jsonb)', [
        JSON.stringify([fixture(), { ...fixture(), remainingReactions: -1 }]),
      ]),
    ).rejects.toThrow();
    expect(
      (await db.query<{ n: number }>('select count(*)::int n from public.inventory_items')).rows[0]
        .n,
    ).toBe(before);
  });
  it('restricts role management and protects own admin access', async () => {
    await asUser(member);
    await expect(db.query("select public.set_user_role($1,'Admin')", [viewer])).rejects.toThrow(
      'Administrator',
    );
    await asUser(admin);
    await expect(db.query("select public.set_user_role($1,'Viewer')", [admin])).rejects.toThrow(
      'own role',
    );
    await db.query("select public.set_user_role($1,'Member')", [viewer]);
    await db.query("select public.set_user_role($1,'Viewer')", [viewer]);
  });
  it('blocks Member settings changes through RLS', async () => {
    await asUser(member);
    await expect(
      db.query('insert into public.settings(id,data) values($1,$2::jsonb)', [
        'default',
        JSON.stringify(DEFAULT_SETTINGS),
      ]),
    ).rejects.toThrow('row-level security');
  });
});

it('validates and persists settings for Admin', async () => {
  await asUser(admin);
  await expect(
    db.query('insert into public.settings(id,data) values($1,$2::jsonb)', [
      'default',
      JSON.stringify({ ...DEFAULT_SETTINGS, lowStockThreshold: -1 }),
    ]),
  ).rejects.toThrow('Invalid stock threshold');
  await db.query('insert into public.settings(id,data) values($1,$2::jsonb)', [
    'default',
    JSON.stringify(DEFAULT_SETTINGS),
  ]);
  const result = await db.query<{ data: typeof DEFAULT_SETTINGS }>(
    'select data from public.settings',
  );
  expect(result.rows[0].data.labName).toBe('Pott Lab');
});
