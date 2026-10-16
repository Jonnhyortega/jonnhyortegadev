import { z } from 'zod';

const color = () => z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const themeSchema = z
  .object({
    primary: color(),
    secondary: color(),
    accent: color(),
    highlight: color(),
    ink: color(),
  })
  .strict();
