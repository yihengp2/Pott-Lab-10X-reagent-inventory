# 10x Genomics Reagent Inventory

A responsive laboratory workspace for complete kits, partial kits, individual reagents, spare components, and other-lab material. The central workflow is **find item → Use 1 Reaction → confirm**. The application runs immediately without a backend and can use Supabase for a shared inventory.

This is an independent laboratory tool, not an official 10x Genomics product. Catalog identifiers in demonstration records are illustrative and must be verified against the physical kit before real use.

## Local development

Use Node.js 22.12 or later (Node 24 LTS recommended).

```sh
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173`.

```sh
npm run build
npm run preview
npm run lint
npm test
npm run format
```

`npm run build` checks TypeScript and creates the production `dist/` directory. A pnpm lockfile is also supplied; `pnpm install --frozen-lockfile` reproduces the development dependency versions. Its workspace override uses the WebAssembly build of esbuild to support restricted Windows environments. Ordinary npm installation uses Vite's native esbuild dependency.

## Demo mode

Leave **both** Supabase environment variables empty. No account, network service, API key, or SQL setup is needed. The UI displays **Demo Mode — Local browser storage**.

- Twelve realistic records are added on first use, including the four requested example records. Some additional expiration dates are relative to the first launch, so the dashboard demonstrates upcoming expiration.
- All inventory, settings, and audit entries are saved in one `localStorage` document named `10x-inventory-v1`.
- Demo users have administrator privileges. This is a device-local demonstration, not an authentication boundary.
- Changes persist after refresh and are shared between tabs of the same origin. Web Locks serialize writes in browsers that support them. Separate browsers, devices, ports, or deployment origins have separate inventories.
- Do not use browser storage as the only copy of important laboratory data. Export a CSV or configure Supabase. Browser data clearing removes the local inventory and history.
- To reset only this demo, remove the `10x-inventory-v1` key from this origin's browser storage, then refresh.
- Demo data is never automatically copied into Supabase. Export it and explicitly import it as an administrator if you want to migrate it.

## What is included

| Page            | Behavior                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Dashboard       | Seven summary categories; 30/60/90-day expiration windows; recently updated records; low stock         |
| Inventory       | Full-text search; eight filters; sortable data columns; add item; filtered CSV export                  |
| Item details    | Reactions, ownership, location, dates, provenance, notes, QR code, printable label, audit history      |
| Quick Use       | Mobile search or QR URL lookup, item selection, prominent use button, confirmation, updated count      |
| Freezer Map     | Freezer → shelf → box → position hierarchy; freezer filter; box contents                               |
| Activity        | Global change history, search, action filters, before/after differences                                |
| Import / Export | CSV template, file validation and preview, atomic import, all-inventory export                         |
| Settings        | Default lab/freezer, stock threshold, expiration window, custom options, Supabase user-role management |

### Inventory rules

- Required: item name, workflow, status, owner lab, freezer, shelf, and box. Position is optional.
- Reaction counts are whole numbers. Quantity may be fractional. Values cannot be negative, and remaining reactions cannot exceed original reactions.
- Using reactions never silently changes the chosen status. Reaching zero suggests **DEPLETED** and disables further use.
- Restocking adds reactions; the original capacity is increased when necessary to accommodate the new count. A previously DEPLETED status remains visible until explicitly changed.
- Low stock means `remainingReactions <= lowStockThreshold`, including zero. The default is two reactions. Dashboard kit counters apply only to Complete Kit and Partial Kit records; the running-low list includes individual reagents as well.
- Expiration uses the browser's local calendar date, not elapsed hours. Yesterday is expired; today is urgent. Windows are 0–30 days (urgent), 31–60 (warning), and 61–90 (upcoming). No expiration is inferred for a missing date.
- Expiration warnings do not overwrite status. Settings selects the initial dashboard expiration window; the seven-category metric remains explicitly labeled "Expiring in 30 days".
- **OTHER LAB — DO NOT USE WITHOUT PERMISSION** appears when the status is OTHER LAB or the owning lab differs from the default lab, ignoring capitalization and surrounding spaces. Usage requires a permission acknowledgement and records that acknowledgement in history. This records the researcher's acknowledgement; it does not contact the owning lab.
- Delete requires confirmation and is a soft delete in both storage adapters. Deleted records disappear from inventory but retain their history.

## Architecture

```text
src/
  model.ts                      InventoryItem, InventoryHistory, User, Lab,
                                Project, FreezerLocation, AppSettings
  data/
    repository.ts               Shared repository contract and both adapters
    sample.ts                   Demo seed data
  lib/
    business.ts                 Validation, expiration, stock and ownership logic
    csv.ts                      CSV serialization, validation and downloads
  components/
    state.tsx                   Authentication, data loading, mutation feedback
    layout.tsx                  Navigation, dashboard, badges and warnings
    inventory.tsx               Inventory table, item forms, accessible dialogs
    detail.tsx                  Details, usage, QR labels and activity
    management.tsx              Freezer map, CSV tools, settings and user roles
    agent-tools.tsx             Optional feature-detected browser search tool
  main.tsx                      Routes and providers
  styles.css                    Responsive UI and small-label print rules
supabase/migrations/
  001_inventory.sql             PostgreSQL schema, RLS and transactional RPCs
  002_settings_validation.sql   Server-side settings validation
tests/
  inventory.test.ts            Local persistence, quantities, CSV and rules
  database.test.ts             PostgreSQL migration and authorization checks
```

`InventoryRepository` provides `getItems`, `getItem`, `createItem`, `updateItem`, `useQuantity`, `restock`, `deleteItem`, `getHistory`, `createHistory`, `importItems`, `getSettings`, and `saveSettings`.

**Audit integrity:** `createHistory()` intentionally rejects standalone calls. Every mutation creates history in the same local write or PostgreSQL transaction; application callers cannot forge or independently delete audit records. History includes timestamp, actor, item, action, previous value, new value, and notes.

The Supabase adapter fetches records in batches to avoid PostgREST's default 1,000-row response truncation. The shared workspace refreshes after mutations, on window focus, and every 15 seconds while visible. Editing uses an `updatedAt` comparison to reject stale writes; reaction-use RPCs lock and update the latest row atomically.

## Supabase configuration

1. Create a Supabase project dedicated to this laboratory workspace.
2. Run `supabase/migrations/001_inventory.sql`, then `002_settings_validation.sql`, in the SQL editor or through your migration process. Run each migration once.
3. In Authentication, enable email/password sign-in. Create laboratory accounts with passwords in Supabase's user administration tools. Public sign-up is not exposed in this application; disable public sign-ups for an invite-only lab.
4. Set the Authentication Site URL and allowed redirect URLs to the deployment origin (and your development URL when needed).
5. Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Use a **public anon/publishable key**, never a service-role key. Vite embeds `VITE_*` values into the client bundle; RLS and the RPC permission checks protect the database. Both values must be present to enable shared mode. Restart Vite or rebuild the deployment after changes.

6. New accounts automatically receive a Viewer profile. Bootstrap the first administrator through the trusted SQL editor:

```sql
update public.profiles
set role = 'Admin'
where email = 'your-admin@your-lab.example';
```

7. Sign in as the administrator and configure the lab under Settings. Manage the roles of existing users in **Settings → Members & permissions**. Creating/inviting accounts and password recovery remain managed through Supabase Authentication; the app does not embed privileged auth-admin credentials. Users with a valid invitation session can view the workspace; create a password through your organization's account-onboarding process for subsequent password sign-in.

### Roles and authorization

| Capability                                 | Admin | Member | Viewer |
| ------------------------------------------ | :---: | :----: | :----: |
| View/search items, map, history and labels |   ✓   |   ✓    |   ✓    |
| Create or duplicate items                  |   ✓   |   ✓    |        |
| Use/restock and edit quantity              |   ✓   |   ✓    |        |
| Move and update status                     |   ✓   |   ✓    |        |
| Edit identification, ownership and notes   |   ✓   |        |        |
| Delete, import, export, configure          |   ✓   |        |        |
| Change other users' roles                  |   ✓   |        |        |

The frontend hides unauthorized controls, and PostgreSQL enforces write permissions independently. Members cannot change ownership by calling the RPC directly. Direct inventory/history writes are revoked; mutations go through `mutate_inventory`. `import_inventory` is administrator-only and rolls back the entire batch if any row fails. Role changes go through `set_user_role`; administrators cannot demote themselves through that function.

Viewer access necessarily permits reading and copying visible records. "Export" permissions refer to the app's bulk-export UI, not a claim that readable data cannot be extracted.

### Database representation

All seven requested tables are present: `inventory_items`, `inventory_history`, `profiles`, `labs`, `projects`, `freezer_locations`, and `settings`. Each includes primary keys, creation/update timestamps and creator attribution. Profiles reference `auth.users`; history references inventory; optional inventory and project catalog IDs carry foreign keys.

The complete camelCase inventory schema is stored in `inventory_items.data` (JSONB), preserving the same model across local and shared adapters. Generated SQL columns expose item name, workflow, status, owner lab, and remaining reactions for indexing/querying. SQL validation enforces required fields, enum values, numbers, and dates. `inventory_history.data` stores immutable before/after snapshots.

Custom pick-list names are stored in `settings.data` and on inventory records. The normalized `labs`, `projects`, and `freezer_locations` tables are available for future catalog-ID workflows; the current UI does not require those IDs or automatically synchronize those optional tables. One Supabase project represents one shared laboratory workspace; owner labs are inventory ownership labels, not separate isolated tenants.

### Recovering a soft-deleted record

Only a trusted database administrator should restore records. A restore can clear `deleted_at` and remove `data.deletedAt` in the SQL editor, with a corresponding audit entry following your lab's restoration policy. There is no permanent-delete button in the application.

## CSV import and export

The CSV template lists all application fields. Imports create new IDs and server/browser-controlled creation and update metadata; supplied IDs and audit metadata are ignored. Importing the same CSV twice creates two sets of records, rather than overwriting previous inventory.

Required column names: `itemName`, `workflow`, `status`, `ownerLab`, `freezer`, `shelf`, `box`. For a full-fidelity import, use the downloadable template. Other omitted fields receive new-item defaults. Dates use `YYYY-MM-DD`. Use one of the exact status/item-type values listed in `src/model.ts`. Custom workflow names are accepted.

- Upload size: 2 MB; batch size: 5,000 records.
- The preview shows the first 20 valid rows and validation errors. No records are saved until Import is pressed, and errors block the entire import.
- CSV parsing supports quoted commas, embedded newlines, UTF-8 BOMs, and CRLF line endings.
- Exports include a UTF-8 BOM for Excel and escape formula-like strings. Excel may treat catalog/lot values with leading zeros as numbers; import those columns as Text when opening in Excel.
- Export All includes all non-deleted items. Export Filtered uses the exact current search/filter results and ordering.

## QR codes and labels

Each record has `/item/<id>` as its direct URL. QR codes are generated locally with `qrcode.react`; no external QR service receives inventory data. Printing uses a 90 × 50 mm page with 3 mm margins and includes name, workflow, lot, expiration, remaining reactions, status, location and QR code.

Choose the matching paper/label size, actual-size scaling, and disable browser headers/footers. Review the physical output on your printer before a bulk label run. Labels are a snapshot; the QR link opens the current record.

For another phone to resolve a label, use a deployment hostname reachable by that phone. A QR code pointing to `127.0.0.1` only resolves on the same machine. Shared use across devices requires Supabase. Quick Use supports item selection, pasted/scanner-entered item URLs, and direct links scanned with the phone's ordinary camera; it does not request an in-page camera permission.

## Deployment

This is a static Vite frontend. It does not need a Node server in production. HTTPS is recommended for authentication and browser APIs.

### GitHub

Create a repository in your account and push the project source. The included `.gitignore` excludes dependencies, build output and local environment files. Keep `.env.example`, migrations, and the lockfile in source control. No repository or hosting account is created automatically by this deliverable.

### Vercel

1. Import the GitHub repository into Vercel.
2. Choose Vite, build command `npm run build`, output directory `dist`.
3. Add both Supabase environment variables for shared mode, or leave both unset for demo mode.
4. Deploy. `vercel.json` rewrites direct item and application routes to `index.html`.
5. Configure the deployed URL in Supabase Authentication, then verify sign-in and two-user updates.

### Netlify

1. Import the GitHub repository in Netlify.
2. Use build command `npm run build` and publish directory `dist`; these defaults and the SPA rewrite are included in `netlify.toml`.
3. Configure the Supabase variables or leave both unset for demo mode.
4. Deploy and configure Supabase redirect URLs.

### GitHub Pages

The included GitHub Pages workflow deploys a **Demo/localStorage-only version** of this project. GitHub Pages itself supplies neither a shared database nor authentication; a shared version requires a backend such as Supabase and the associated configuration. Vercel or Netlify are the documented shared-workspace deployment paths.

The included workflow builds with the repository base path and hash routing, so direct item/QR links work on Pages. In repository Settings → Pages, choose GitHub Actions as the source. Each push to main rebuilds and deploys the app. The live URL is https://yihengp2.github.io/Pott-Lab-10X-reagent-inventory/.


## Validation and release notes

`npm test` runs local repository and business-rule tests plus the migrations in PGlite (real PostgreSQL compiled to WebAssembly) with Supabase-style authentication roles and `auth.uid()` simulated. It checks role enforcement, direct-write restrictions, audit integrity, stale-edit rejection, soft deletion, and atomic import rollback.

Browser validation covered creation, editing, date entry, reaching zero, disabled further use, expiration warnings, search/filter combinations, refresh persistence, CSV validation/import, and a 390-pixel mobile Quick Use layout. The optional WebMCP search tool was checked for both valid and invalid input. See `VALIDATION.md` for the final verification record.

The database migration tests do not replace a real hosted Supabase integration test. No Supabase credentials or deployment account were supplied; hosted sign-in, invitation email delivery, production synchronization, physical printer output and phone-camera QR scanning must be verified in your environment before a lab rollout.

## License

MIT. See `LICENSE`.
