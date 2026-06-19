import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

export type SupabaseScriptConfig = {
  url: string;
  secretKey: string;
  env: "local" | "staging" | "production";
};

export function loadLocalEnv(root = process.cwd()) {
  for (const file of [
    ".env.local",
    ".env.staging.local",
    ".env.production.local",
    ".env",
    "apps/web/.env.local",
  ]) {
    const fullPath = path.join(root, file);
    if (!existsSync(fullPath)) continue;
    const text = readFileSync(fullPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

export function supabaseScriptConfig(argv = process.argv): SupabaseScriptConfig {
  loadLocalEnv();
  const env = (process.env.SUPABASE_ENV || "local") as SupabaseScriptConfig["env"];
  if (!["local", "staging", "production"].includes(env)) {
    throw new Error("SUPABASE_ENV must be local, staging, or production");
  }
  if (env === "production" && !argv.includes("--allow-production")) {
    throw new Error("Refusing to run against production Supabase without --allow-production");
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url) throw new Error("SUPABASE_URL is required for content scripts");
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required for content scripts");
  if (process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_SECRET_KEY must never be set");
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY must never be set");
  }

  return { url, secretKey, env };
}

export function createServiceRoleClient(config = supabaseScriptConfig()) {
  return createClient(config.url, config.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
