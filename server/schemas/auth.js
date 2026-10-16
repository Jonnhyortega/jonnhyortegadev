import { z } from 'zod';

// Cuerpo de POST /api/auth/recovery. El formato del código se valida aparte
// (normalizeCode) para que un formato inválido cuente como fallo.
export const recoveryRequestSchema = z.object({ code: z.string().min(1).max(32) }).strict();
