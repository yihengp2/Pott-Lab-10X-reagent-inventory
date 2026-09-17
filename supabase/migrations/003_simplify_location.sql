-- Shelf and box remain in legacy data; only freezer is required for location.
create or replace function public.validate_inventory(p jsonb) returns void language plpgsql set search_path=public,pg_temp as $$
declare k text; n numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception 'Invalid inventory record';end if;
 foreach k in array array['itemName','workflow','ownerLab','freezer','status'] loop
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
