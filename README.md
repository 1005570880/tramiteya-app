# TrámiteYa

Repositorios: frontend (Next.js App Router) with a simple backend of Route Handlers.

Este repositorio contiene un MVP de TrámiteYa — una plataforma para la automatización de trámites jurídicos.

Resumen rápido

- Frontend: Next.js (App Router), React, TypeScript, TailwindCSS
- Local persistence for MVP: localStorage in browser
- Phase 4 goal: preparar backend real (Supabase/Postgres) y migrar persistencia a API + DB

Lo que hay en esta rama

- src/app/* — páginas y rutas (Home, Catálogo, Trámite, Formulario, Dashboard, Documentos)
- src/components — componentes reutilizables
- src/data — catálogo de procedimientos y formularios
- src/lib — utilidades y adaptadores (draftStorage, procedureStorage, generateDocument)
- src/types — tipos TypeScript

Instalación (desarrollo local)

1. Clona el repo
   git clone git@github.com:1005570880/tramiteya-app.git
   cd tramiteya-app

2. Instala dependencias
   npm install

3. Desarrollo
   npm run dev

4. Build
   npm run build

Variables de entorno (
see .env.example)

- NEXT_PUBLIC_SUPABASE_URL — URL de Supabase (opcional)
- NEXT_PUBLIC_SUPABASE_ANON_KEY — anon key (opcional)
- SUPABASE_SERVICE_ROLE_KEY — service role key (solo servidor; nunca exponer en cliente)

Arquitectura propuesta

Frontend (React) -> API (Next Route Handlers) -> Repository (Supabase/Postgres) -> Storage (Postgres)

Cómo preparar Supabase (resumen)

1. Crea un proyecto en Supabase
2. Configura las variables en .env (ver .env.example)
3. Crea las tablas usando db/migrations/001_init.sql
4. Inicia el servidor Next en modo producción apuntando a las variables

Roadmap (inmediato)

- Phase 4: preparar route handlers, repositorios y migraciones
- Phase 5: conectar Supabase y habilitar Auth, RLS y almacenamiento de archivos

---
