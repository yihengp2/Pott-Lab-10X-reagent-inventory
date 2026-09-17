# Validation record

Verified on September 17, 2026.

- `npm run build`: passed (TypeScript and production Vite build).
- `npm run lint`: passed.
- `npm test`: passed, 30 tests across local/business/CSV and PostgreSQL authorization suites.
- Browser: item creation, edit/notes, expiration date entry and expired warning, use-one confirmation, zero remaining, disabled additional use, persistence after reload, combined text/status filtering, CSV preview and import.
- Mobile: 390 × 844 viewport; Quick Use fits without page-wide horizontal overflow and its main action is at least 60 CSS pixels tall.
- Optional WebMCP search: valid query returned matching records and opened the inventory filter; invalid input rejected.
- Runtime console inspection: no errors reported during the checked workflows.

Issues found and corrected during verification: date-input event handling, lock release after failed transactions, Windows/mixed CSV line endings, button background selector specificity, and default Supabase response pagination.

Limits: CSV content generation/round-trip and formula escaping passed automated tests, but the in-app browser did not expose a completed download event. Physical labels and phone-camera scanning were not tested. No live Supabase project, authentication email delivery, or deployment account was supplied; PostgreSQL behavior was exercised locally through PGlite with simulated Supabase auth context. A real two-user hosted integration check remains a deployment prerequisite.

The delivered source contains the original sample-data seed; browser QA records are local to the preview browser and are not included in the source or production build.
