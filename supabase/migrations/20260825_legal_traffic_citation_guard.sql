-- Canonical legal knowledge for traffic prescription/caducity.
-- The application also carries a runtime canonicalization guard so stale rows
-- cannot reintroduce obsolete article mappings into generated documents.

insert into public.legal_sources (id, source_type, title, citation, jurisdiction, status, official_source, version)
values
  ('canonical_ley_769_2002', 'law', 'Código Nacional de Tránsito Terrestre', 'Ley 769 de 2002', 'CO', 'vigente', 'https://www.secretariasenado.gov.co/senado/basedoc/ley_0769_2002.html', 2026),
  ('canonical_decreto_19_2012', 'decree', 'Decreto Ley 19 de 2012', 'Decreto Ley 19 de 2012, artículo 206', 'CO', 'vigente', 'https://www.secretariasenado.gov.co/senado/basedoc/decreto_0019_2012.html', 2026),
  ('canonical_estatuto_tributario_818', 'law', 'Estatuto Tributario', 'Estatuto Tributario, artículo 818', 'CO', 'vigente', 'https://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr033.html', 2026),
  ('canonical_ley_1437_2011', 'law', 'Código de Procedimiento Administrativo y de lo Contencioso Administrativo', 'Ley 1437 de 2011 (CPACA)', 'CO', 'vigente', 'https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=41249', 2026),
  ('canonical_ce_boletin_185_2016', 'jurisprudence', 'Consejo de Estado — doctrina sobre prescripción de sanciones de tránsito', 'Consejo de Estado, Boletín 185, 6 de mayo de 2016', 'CO', 'vigente', 'https://www.consejodeestado.gov.co/documentos/boletines/185.pdf', 2016)
on conflict (id) do update set title = excluded.title, citation = excluded.citation, status = excluded.status, official_source = excluded.official_source, version = excluded.version, verified_at = now();

update public.legal_rules
set active = false
where topics @> array['transito']::text[]
  and (
    coalesce(article, '') ilike '%159%'
    or coalesce(article, '') ilike '%818%'
    or coalesce(article, '') ilike '%91 numeral 3%'
    or coalesce(article, '') ilike '%91 numeral 5%'
    or coalesce(article, '') ilike '%161%'
  );

insert into public.legal_rules (id, source_id, article, rule_text, topics, trigger_conditions, argument_strength, version, active)
values
  ('canonical_transito_art159', 'canonical_ley_769_2002', 'Artículo 159', 'Las sanciones impuestas por infracciones a las normas de tránsito prescriben en tres (3) años contados a partir de la ocurrencia del hecho; la prescripción debe ser declarada de oficio y se interrumpe con la notificación del mandamiento de pago.', array['transito','prescripcion-comparendo'], '{}'::jsonb, 'high', 2026, true),
  ('canonical_transito_art818', 'canonical_estatuto_tributario_818', 'Artículo 818', 'En lo pertinente al cobro coactivo de sanciones de tránsito, el término de prescripción de la acción de cobro se interrumpe, entre otros eventos, por la notificación del mandamiento de pago; interrumpida la prescripción, el término vuelve a correr desde el día siguiente a la notificación del mandamiento.', array['transito','prescripcion-comparendo'], '{}'::jsonb, 'high', 2026, true),
  ('canonical_transito_cpaca_91_3', 'canonical_ley_1437_2011', 'Artículo 91 numeral 3', 'Un acto administrativo en firme pierde obligatoriedad y no puede ser ejecutado cuando, al cabo de cinco (5) años de estar en firme, la autoridad no ha realizado los actos que le correspondan para ejecutarlo.', array['transito','prescripcion-comparendo','perdida-ejecutoriedad'], '{}'::jsonb, 'high', 2026, true),
  ('canonical_transito_cpaca_91_5', 'canonical_ley_1437_2011', 'Artículo 91 numeral 5', 'La causal del numeral 5 corresponde a la pérdida de vigencia del acto administrativo; no es la causal de los cinco años, que corresponde al numeral 3.', array['transito','perdida-ejecutoriedad'], '{}'::jsonb, 'high', 2026, true),
  ('canonical_transito_art161', 'canonical_ley_769_2002', 'Artículo 161', 'La acción por contravención de las normas de tránsito caduca al año contado desde la ocurrencia de los hechos, con las reglas adicionales previstas legalmente.', array['transito','caducidad-comparendo'], '{}'::jsonb, 'high', 2026, true),
  ('canonical_transito_ce_2016', 'canonical_ce_boletin_185_2016', null, 'El Consejo de Estado ha relacionado el artículo 159 de la Ley 769 de 2002 con el artículo 818 del Estatuto Tributario para el análisis de la prescripción del cobro de sanciones de tránsito y ha destacado la relevancia probatoria de verificar la fecha y notificación del mandamiento de pago y las actuaciones posteriores de cobro.', array['transito','prescripcion-comparendo'], '{}'::jsonb, 'high', 2016, true)
on conflict (id) do update set source_id = excluded.source_id, article = excluded.article, rule_text = excluded.rule_text, topics = excluded.topics, trigger_conditions = excluded.trigger_conditions, argument_strength = excluded.argument_strength, version = excluded.version, active = true;

insert into public.legal_versions (library_version, released_at, notes, created_by)
values ('2026.08.25-traffic-canonical-v1', now(), 'Corrección de artículos 159, 818 y 91 CPACA para documentos de tránsito; se evita atribuir los cinco años al artículo 91 numeral 5.', 'TrámiteYa legal knowledge guard');
