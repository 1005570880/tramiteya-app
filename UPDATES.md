# TrámiteYa — Updates

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
