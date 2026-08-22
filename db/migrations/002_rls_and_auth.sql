-- Row Level Security and policies for TrámiteYa

-- Enable RLS on procedure_instances, documents, document_versions

ALTER TABLE IF EXISTS procedure_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS document_versions ENABLE ROW LEVEL SECURITY;

-- policy: allow logged in users to insert their own instances
CREATE POLICY "insert_instance_if_owner" ON procedure_instances
  FOR INSERT USING (auth.role() IS NOT NULL)
  WITH CHECK (user_id = auth.uid());

-- policy: select/update/delete only if owner
CREATE POLICY "instance_is_owner" ON procedure_instances
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- documents: only owner can access
CREATE POLICY "document_owner" ON documents
  FOR ALL USING (
    (SELECT user_id FROM procedure_instances WHERE procedure_instances.id = documents.instance_id) = auth.uid()
  ) WITH CHECK (
    (SELECT user_id FROM procedure_instances WHERE procedure_instances.id = documents.instance_id) = auth.uid()
  );

-- document_versions: only owner via document
CREATE POLICY "document_versions_owner" ON document_versions
  FOR ALL USING (
    (SELECT user_id FROM procedure_instances WHERE procedure_instances.id = (
      SELECT instance_id FROM documents WHERE documents.id = document_versions.document_id
    )) = auth.uid()
  ) WITH CHECK (false); -- disallow direct inserts (use API)
