-- Validate settings at the database boundary, including writes outside the UI.
begin;
create function public.validate_inventory_settings() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare k text; n numeric;
begin
 if jsonb_typeof(new.data) is distinct from 'object' then raise exception 'Settings must be an object';end if;
 foreach k in array array['labName','defaultFreezer'] loop
  if jsonb_typeof(new.data->k) is distinct from 'string' or trim(new.data->>k)='' then raise exception '% is required',k;end if;
 end loop;
 if jsonb_typeof(new.data->'lowStockThreshold') is distinct from 'number' then raise exception 'Invalid stock threshold';end if;
 n=(new.data->>'lowStockThreshold')::numeric;
 if n<0 or n>1000000000 or trunc(n)<>n then raise exception 'Invalid stock threshold';end if;
 if coalesce(new.data->>'expirationWarningInterval','') not in ('30','60','90') then raise exception 'Invalid expiration warning window';end if;
 foreach k in array array['workflows','ownerLabs','projects','freezers','shelves','boxes'] loop
  if jsonb_typeof(new.data->k) is distinct from 'array' then raise exception '% must be an array',k;end if;
  if exists(select 1 from jsonb_array_elements(new.data->k) v where jsonb_typeof(v) is distinct from 'string') then raise exception '% must contain strings',k;end if;
 end loop;
 return new;
end $$;
create trigger settings_validate before insert or update on public.settings for each row execute function public.validate_inventory_settings();
revoke all on function public.validate_inventory_settings() from public,anon;
commit;
