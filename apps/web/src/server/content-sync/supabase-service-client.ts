import { createClient } from "@supabase/supabase-js";

export function createSupabaseServiceClientFromEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase secret keys must not be exposed through NEXT_PUBLIC variables");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
