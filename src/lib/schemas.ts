import { z } from 'zod';

export const createInstanceSchema = z.object({
  procedureId: z.string().optional(),
  procedureSlug: z.string().min(1),
  answers: z.record(z.any()).optional(),
});

export const patchInstanceSchema = z.object({
  answers: z.record(z.any()).optional(),
  status: z.enum(['draft','in_progress','pending_information','document_ready','completed']).optional(),
});

export const createDocumentSchema = z.object({
  procedure: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
  }),
  answers: z.record(z.any()),
  instanceId: z.string().optional(),
});
