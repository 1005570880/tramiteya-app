# TrámiteYa — Updates

## Phase 10.1 — Build recovery

- Fixed TypeScript narrowing in the SIMIT PDF-first form so validated procedure references remain non-null inside async completion handlers.
- Branch `phase-1-setup` is now at the build-fix commit and ready for a fresh Vercel deployment.

## Phase 8.4 — Wompi Production Payments

- Added production Wompi Checkout Widget integration using the server-side price catalog.
- Added SHA-256 integrity signing with `WOMPI_INTEGRITY_SECRET` and unique `DOC-<documentVersionId>` references.
- Added authenticated payment preparation endpoint at `/api/payments/wompi`.
- Added `/api/webhooks/wompi` with dynamic Wompi event-property checksum verification using `WOMPI_EVENTS_SECRET`, timestamp and SHA-256.
- Webhook now validates transaction amount, changes payment state to `approved`, and marks the corresponding document version metadata as `payment_status: paid`.
- Result page now uses the real Wompi widget and checks payment status for the exact document version before enabling Word/PDF downloads.
- No launch pricing is used; checkout reads the server catalog in `src/data/pricing.ts`.

## Phase 6 — Motor Multitrámite

- Added `src/lib/multitramiteEngine.ts` as the central orchestration layer for form packages, conditional fields, required-field validation and document generation.
- Added `POST /api/procedures/[slug]/validate` for server-side validation before generation.
- Added `POST /api/procedures/[slug]/generate` as a unified generation endpoint for configured procedures.
- Improved `StepForm` to respect conditional fields and validate required values without relying on browser truthiness.
- Added support in the wizard for select and radio field types already represented by the form schema.
- Kept the existing Supabase/file-backed repository architecture and document generators intact.

## Phase 5 — Persistence and Auth

- Added Supabase browser and server clients.
- Implemented Supabase repositories for procedures, instances and documents.
- Added repository factory with file-backed fallback.
- Added Zod schemas for API validation.
- Updated API route handlers to use repository factory and enforce server-side auth/ownership checks.
- Added RLS migration and seed.
- Added service and client-side auth guard for dashboard.
