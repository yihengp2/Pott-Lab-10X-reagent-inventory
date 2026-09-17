-- 10x Genomics Reagent Inventory. Run once in a new Supabase project.
-- All inventory writes go through transactional RPCs. RLS blocks direct writes.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, name text not null default '',
 role text not null default 'Viewer' check(role in ('Admin','Member','Viewer')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid references auth.users(id)
);
create function public.current_inventory_role() returns text language sql stable security definer set search_path=public,pg_temp as $$
 select role from public.profiles where id=auth.uid()
$$;
create function public.handle_inventory_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 begin insert into public.profiles(id,email,name) values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'name',split_part(coalesce(new.email,''),'@',1))); return new; end
$$;
create trigger inventory_new_user after insert on auth.users for each row execute function public.handle_inventory_user();
insert into public.profiles(id,email,name) select id,coalesce(email,''),split_part(coalesce(email,''),'@',1) from auth.users on conflict do nothing;
create table public.labs (id uuid primary key default gen_random_uuid(),name text unique not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id));
create table public.projects (id uuid primary key default gen_random_uuid(),name text not null,lab_id uuid references public.labs(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id));
create table public.freezer_locations (id uuid primary key default gen_random_uuid(),freezer text not null,shelf text not null,box text not null,position text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),unique(freezer,shelf,box,position));
create table public.inventory_items (
 id uuid primary key default gen_random_uuid(),
 data jsonb not null check(jsonb_typeof(data)='object'),
 item_name text generated always as (data->>'itemName') stored,
 workflow text generated always as (data->>'workflow') stored,
 status text generated always as (data->>'status') stored,
 owner_lab text generated always as (data->>'ownerLab') stored,
 remaining_reactions numeric generated always as ((data->>'remainingReactions')::numeric) stored check(remaining_reactions>=0),
 lab_id uuid references public.labs(id),project_id uuid references public.projects(id),location_id uuid references public.freezer_locations(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id),deleted_at timestamptz
);
create index inventory_live_status on public.inventory_items(status) where deleted_at is null;
create index inventory_data on public.inventory_items using gin(data);
create table public.inventory_history (
 id uuid primary key default gen_random_uuid(),inventory_item_id uuid not null references public.inventory_items(id),
 data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id)
);
create index history_item_time on public.inventory_history(inventory_item_id,created_at desc);
create table public.settings(id text primary key default 'default' check(id='default'),data jsonb not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid references auth.users(id));
create function public.inventory_touch() returns trigger language plpgsql set search_path=public,pg_temp as $$ begin new.updated_at=now();if tg_op='INSERT' then new.created_by=auth.uid();end if;return new;end $$;
create trigger settings_touch before insert or update on public.settings for each row execute function public.inventory_touch();
create trigger profiles_touch before update on public.profiles for each row execute function public.inventory_touch();
create trigger labs_touch before insert or update on public.labs for each row execute function public.inventory_touch();
create trigger projects_touch before insert or update on public.projects for each row execute function public.inventory_touch();
create trigger locations_touch before insert or update on public.freezer_locations for each row execute function public.inventory_touch();
alter table public.profiles enable row level security;
alter table public.labs enable row level security;
alter table public.projects enable row level security;
alter table public.freezer_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_history enable row level security;
alter table public.settings enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.current_inventory_role()='Admin');
create policy inventory_read on public.inventory_items for select to authenticated using(public.current_inventory_role() is not null);
create policy history_read on public.inventory_history for select to authenticated using(public.current_inventory_role() is not null);
create policy settings_read on public.settings for select to authenticated using(public.current_inventory_role() is not null);
create policy settings_insert on public.settings for insert to authenticated with check(public.current_inventory_role()='Admin');
create policy settings_update on public.settings for update to authenticated using(public.current_inventory_role()='Admin') with check(public.current_inventory_role()='Admin');
create policy labs_read on public.labs for select to authenticated using(public.current_inventory_role() is not null);
create policy labs_admin on public.labs for all to authenticated using(public.current_inventory_role()='Admin') with check(public.current_inventory_role()='Admin');
create policy projects_read on public.projects for select to authenticated using(public.current_inventory_role() is not null);
create policy projects_admin on public.projects for all to authenticated using(public.current_inventory_role()='Admin') with check(public.current_inventory_role()='Admin');
create policy locations_read on public.freezer_locations for select to authenticated using(public.current_inventory_role() is not null);
create policy locations_admin on public.freezer_locations for all to authenticated using(public.current_inventory_role()='Admin') with check(public.current_inventory_role()='Admin');
grant select on public.profiles,public.inventory_items,public.inventory_history to authenticated;
grant select,insert,update on public.settings to authenticated;
grant select,insert,update,delete on public.labs,public.projects,public.freezer_locations to authenticated;
revoke insert,update,delete on public.profiles,public.inventory_items,public.inventory_history from authenticated,anon;
create function public.validate_inventory(p jsonb) returns void language plpgsql set search_path=public,pg_temp as $$
declare k text; n numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'Invalid inventory record';end if;
 foreach k in array array['itemName','workflow','ownerLab','freezer','shelf','box','status'] loop
  if jsonb_typeof(p->k) is distinct from 'string' or length(trim(p->>k))=0 then raise exception '% is required',k;end if;
 end loop;
 if p->>'status' not in ('ACTIVE','PARTIAL','LOW STOCK','ORPHAN','EXPIRED','DEPLETED','HOLD','RESERVED','OTHER LAB') then raise exception 'Invalid status';end if;
 if coalesce(p->>'itemType','') not in ('Complete Kit','Partial Kit','Individual Reagent','Spare Component','Buffer','Enzyme','Library Reagent','Chip','Beads','Other') then raise exception 'Invalid item type';end if;
 foreach k in array array['originalReactions','remainingReactions','quantity'] loop
  if jsonb_typeof(p->k) is distinct from 'number' then raise exception '% must be numeric',k;end if;
  n=(p->>k)::numeric;if n<0 or n>1000000000 then raise exception '% is outside the valid range',k;end if;
  if k<>'quantity' and trunc(n)<>n then raise exception 'Reactions must be whole numbers';end if;
 end loop;
 if (p->>'remainingReactions')::numeric>(p->>'originalReactions')::numeric then raise exception 'Remaining exceeds original reactions';end if;
 foreach k in array array['expirationDate','openedDate','receivedDate'] loop
  if coalesce(p->>k,'')<>'' then
   if (p->>k)!~'^\d{4}-\d{2}-\d{2}$' or to_char((p->>k)::date,'YYYY-MM-DD')<>p->>k then raise exception 'Invalid date: %',k;end if;
  end if;
 end loop;
end $$;
create function public.mutate_inventory(p_id uuid,p_action text,p_payload jsonb default '{}'::jsonb,p_notes text default '') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r text; prev jsonb; nxt jsonb; amount numeric; actor text; stamp text; hid uuid; deleted timestamptz; allowed text[];
begin
 r=public.current_inventory_role();
 if auth.uid() is null or r is null or r not in ('Admin','Member') then raise exception 'Write access denied';end if;
 if p_action not in ('Created','Edited','Used','Restocked','Moved','Status changed','Deleted') then raise exception 'Unknown action';end if;
 if p_action='Deleted' and r<>'Admin' then raise exception 'Administrator access required';end if;
 stamp=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 select coalesce(nullif(name,''),email) into actor from public.profiles where id=auth.uid();
 if p_action='Created' then
  nxt=p_payload-'deletedAt';nxt=nxt||jsonb_build_object('id',p_id,'createdAt',stamp);
 else
  select data,deleted_at into prev,deleted from public.inventory_items where id=p_id for update;
  if prev is null or deleted is not null then raise exception 'Item not found';end if;
  nxt=prev;
  if p_action in ('Used','Restocked') then
   if jsonb_typeof(p_payload->'amount') is distinct from 'number' then raise exception 'Invalid amount';end if;
   amount=(p_payload->>'amount')::numeric;
   if amount<=0 or trunc(amount)<>amount or amount>1000000000 then raise exception 'Enter a positive whole number';end if;
   if p_action='Used' then
    if (prev->>'remainingReactions')::numeric<amount then raise exception 'Insufficient remaining reactions';end if;
    nxt=jsonb_set(nxt,'{remainingReactions}',to_jsonb((prev->>'remainingReactions')::numeric-amount));
   else
    nxt=jsonb_set(nxt,'{remainingReactions}',to_jsonb((prev->>'remainingReactions')::numeric+amount));
    nxt=jsonb_set(nxt,'{originalReactions}',to_jsonb(greatest((prev->>'originalReactions')::numeric,(nxt->>'remainingReactions')::numeric)));
   end if;
  elsif p_action='Deleted' then nxt=nxt||jsonb_build_object('deletedAt',stamp);
  else
   if p_payload->>'updatedAt' is distinct from prev->>'updatedAt' then raise exception 'Record changed. Refresh and try again.';end if;
   allowed=array['remainingReactions','originalReactions','quantity','quantityUnit','freezer','shelf','box','position','storageTemperature','status'];
   if r='Member' and (p_payload-allowed) is distinct from (prev-allowed) then raise exception 'Members can only update quantity, location, and status';end if;
   nxt=(p_payload-'deletedAt')||jsonb_build_object('id',p_id,'createdAt',prev->>'createdAt');
  end if;
 end if;
 nxt=nxt||jsonb_build_object('updatedAt',stamp,'updatedBy',actor);
 perform public.validate_inventory(nxt);
 if p_action='Created' then
  insert into public.inventory_items(id,data,created_by) values(p_id,nxt,auth.uid());
 else
  update public.inventory_items set data=nxt,updated_at=now(),deleted_at=case when p_action='Deleted' then now() else null end where id=p_id;
 end if;
 hid=gen_random_uuid();
 insert into public.inventory_history(id,inventory_item_id,data,created_by) values(hid,p_id,jsonb_build_object('id',hid,'timestamp',stamp,'user',actor,'inventoryItem',p_id,'itemName',nxt->>'itemName','action',p_action,'previousValue',prev,'newValue',nxt,'notes',coalesce(p_notes,'')),auth.uid());
 return nxt;
end $$;
create function public.import_inventory(p_items jsonb) returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb; count integer=0;
begin
 if public.current_inventory_role() is distinct from 'Admin' then raise exception 'Administrator access required';end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>5000 then raise exception 'Expected at most 5000 items';end if;
 for item in select value from jsonb_array_elements(p_items) loop
  perform public.mutate_inventory(gen_random_uuid(),'Created',item,'CSV import');count=count+1;
 end loop;return count;
end $$;
create function public.set_user_role(p_id uuid,p_role text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.current_inventory_role() is distinct from 'Admin' then raise exception 'Administrator access required';end if;
 if p_id=auth.uid() then raise exception 'You cannot change your own role';end if;
 if p_role not in ('Admin','Member','Viewer') then raise exception 'Invalid role';end if;
 update public.profiles set role=p_role where id=p_id;
 if not found then raise exception 'User not found';end if;
end $$;
revoke all on function public.mutate_inventory(uuid,text,jsonb,text),public.import_inventory(jsonb),public.set_user_role(uuid,text),public.validate_inventory(jsonb),public.handle_inventory_user(),public.inventory_touch(),public.current_inventory_role() from public,anon;
grant execute on function public.mutate_inventory(uuid,text,jsonb,text),public.import_inventory(jsonb),public.set_user_role(uuid,text),public.current_inventory_role() to authenticated;
commit;
