import { z } from 'zod';

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional().default(''),
  UPSTASH_REDIS_REST_URL: z.string().optional().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional().default(''),
  ADMIN_EMAILS: z.string().optional().default(''),
  APP_URL: z.string().url().default('http://localhost:3000'),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

type ServerEnv = z.infer<typeof serverSchema>;

let _serverEnv: ServerEnv | null = null;

export const serverEnv = new Proxy({} as ServerEnv, {
  get(_target, prop) {
    if (typeof window !== 'undefined') {
      throw new Error('serverEnv accessed in browser');
    }
    if (!_serverEnv) {
      _serverEnv = serverSchema.parse(process.env);
    }
    return _serverEnv[prop as keyof ServerEnv];
  },
});

export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
