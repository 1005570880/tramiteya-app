# Phase 5 updates

- Added Supabase browser and server clients (src/lib/supabaseBrowserClient.ts, src/lib/supabaseServerClient.ts)
- Implemented Supabase repositories for procedures, instances and documents (src/lib/supabaseProcedureRepo.ts, src/lib/supabaseInstanceRepo.ts, src/lib/supabaseDocumentRepo.ts)
- Added repository factory with file-backed fallback (src/lib/repositoryFactory.ts)
- Added Zod schemas for API validation (src/lib/schemas.ts)
- Updated API route handlers to use repository factory and enforce server-side auth/ownership checks
- Added RLS migration (db/migrations/002_rls_and_auth.sql) and seed (db/seed.sql)
- Added service and client-side auth guard for dashboard
- Updated package.json with @supabase/supabase-js and zod

See db/migrations and .env.example for Supabase setup instructions.
