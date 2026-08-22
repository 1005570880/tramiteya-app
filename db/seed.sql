-- Seed procedures from src/data/procedures.ts

INSERT INTO procedures (id, slug, title, description, category, estimated_time, available, meta)
VALUES
  ('derecho-peticion', 'derecho-de-peticion', 'Derecho de petición', 'Solicitud escrita dirigida a una entidad pública o privada para pedir información o reclamar derechos.', 'Administrativo', '15 minutos', true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO procedures (id, slug, title, description, category, estimated_time, available, meta)
VALUES
  ('accion-de-tutela', 'accion-de-tutela', 'Acción de tutela', 'Protección inmediata de derechos constitucionales cuando están siendo vulnerados.', 'Constitucional', '30 minutos', false, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO procedures (id, slug, title, description, category, estimated_time, available, meta)
VALUES
  ('reclamacion-laboral', 'reclamacion-laboral', 'Reclamación laboral', 'Reclamo ante el empleador por incumplimientos laborales.', 'Laboral', '20 minutos', true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO procedures (id, slug, title, description, category, estimated_time, available, meta)
VALUES
  ('contrato-arrendamiento', 'contrato-de-arrendamiento', 'Contrato de arrendamiento', 'Contrato para formalizar el arrendamiento de un inmueble o local comercial.', 'Civil', '25 minutos', true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;
