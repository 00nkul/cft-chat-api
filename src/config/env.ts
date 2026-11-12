import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  FIREBASE_PROJECT_ID: z.string().min(1).default('cft-chat-dev'),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
});

export const env = envSchema.parse(process.env);
