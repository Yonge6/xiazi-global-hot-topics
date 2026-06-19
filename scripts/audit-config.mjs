import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const checks = [
  {
    file: "package.json",
    disallow: [/vilesaint-site/],
    message: "package name should no longer use the old VileSaint brand",
  },
  {
    file: "src/lib/studio/auth.ts",
    disallow: [/process\.env\.STUDIO_PASSWORD\s*\?\?/, /process\.env\.STUDIO_SESSION_SECRET\s*\?\?/, /vilesaint-local-development-secret/, /vilesaint-studio-session/],
    message: "Studio auth must not contain production default fallbacks or old cookie names",
  },
  {
    file: "src/app/[locale]/page.tsx",
    disallow: [/BEIJING · 00:05 DAILY/, /https:\/\/pluto\.hk\/\$\{locale\}/],
    message: "Locale page should use shared product config for URL and publication time",
  },
  {
    file: "src/components/issue-masthead.tsx",
    disallow: [/T00:05:00\+08:00/, /00:05/],
    message: "Issue masthead should use shared publication config",
  },
  {
    file: "src/lib/issues/schedule.ts",
    disallow: [/ISSUE_SLOT_HOURS_BEIJING = \[0\]/, /ISSUE_SLOT_MINUTE_BEIJING = 5/, /5 16 \* \* \*/],
    message: "Schedule should use the 05:00 Asia/Shanghai publication config",
  },
  {
    file: "vercel.json",
    disallow: [/"5 16 \* \* \*"/],
    message: "Vercel cron should match 05:00 Asia/Shanghai",
  },
  {
    file: ".env.example",
    disallow: [/NEXT_PUBLIC_SITE_URL=https:\/\/vilesaint\.com/, /STUDIO_PASSWORD=000000/],
    message: "Example env should use Pluto and no default Studio password",
  },
];

const failures = [];

for (const check of checks) {
  const path = resolve(root, check.file);
  const content = await readFile(path, "utf8");
  const matches = check.disallow.filter((pattern) => pattern.test(content));
  if (matches.length > 0) {
    failures.push(`${relative(root, path)}: ${check.message}`);
  }
}

if (failures.length > 0) {
  console.error(`Config audit failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Config audit passed");
