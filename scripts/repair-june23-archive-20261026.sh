#!/usr/bin/env bash
set -euo pipefail
readonly release=/opt/xiazi/releases/seo-20261022-v1
readonly stage=/srv/wonderelian/.seo-fix-20261026/2026-06-23.json
readonly backup=/srv/wonderelian/.seo-fix-20261026/xiazi-archive-backup
readonly old=37ba5ce4f3e0fd0e521f096b3f92dfd354c6728acfdebf24be818b2f4a1f0da5
readonly new=6de70035fa0e085cecade23c8b1663b8e535229c49f6798e3204476a0232fc0c
test "$(readlink -f /opt/xiazi/current)" = "$release"
test "$(sha256sum "$stage" | cut -d' ' -f1)" = "$new"
test ! -e "$backup"
for prefix in data apps/web/data; do
  file="$release/$prefix/archive/2026-06-23.json"
  test -f "$file" && test ! -L "$file"
  test "$(sha256sum "$file" | cut -d' ' -f1)" = "$old"
done
before="$(sha256sum "$release/data/current-issue.json" "$release/data/current-release.json" "$release/apps/web/data/current-issue.json")"
mkdir -p "$backup/root" "$backup/web"
cp -p "$release/data/archive/2026-06-23.json" "$backup/root/2026-06-23.json"
cp -p "$release/apps/web/data/archive/2026-06-23.json" "$backup/web/2026-06-23.json"
rollback(){ cp -p "$backup/root/2026-06-23.json" "$release/data/archive/2026-06-23.json"; cp -p "$backup/web/2026-06-23.json" "$release/apps/web/data/archive/2026-06-23.json"; echo ARCHIVE_ROLLED_BACK; }
trap rollback ERR
for prefix in data apps/web/data; do
  file="$release/$prefix/archive/2026-06-23.json"
  install -m 0644 "$stage" "$file.next-seo-fix"
  mv "$file.next-seo-fix" "$file"
done
cd "$release"
node_modules/.bin/tsx -e 'import fs from "node:fs"; import {parseIssue} from "./packages/contracts/src/schemas.ts";for(const prefix of ["data","apps/web/data"]){const issue=parseIssue(JSON.parse(fs.readFileSync(prefix+"/archive/2026-06-23.json","utf8")));if(issue.issueDate!=="2026-06-23"||issue.topics.length!==9)throw new Error("ARCHIVE_INVALID");}console.log("RUNTIME_SCHEMA_PASS");'
test "$before" = "$(sha256sum "$release/data/current-issue.json" "$release/data/current-release.json" "$release/apps/web/data/current-issue.json")"
trap - ERR
echo ARCHIVE_METADATA_REPAIRED_CURRENT_UNCHANGED
