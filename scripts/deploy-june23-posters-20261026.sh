#!/usr/bin/env bash
set -euo pipefail
readonly release=/opt/xiazi/releases/seo-20261022-v1
readonly stage=/srv/wonderelian/.seo-fix-20261026/june23-posters
readonly backup=/srv/wonderelian/.seo-fix-20261026/june23-posters-backup
readonly old=6de70035fa0e085cecade23c8b1663b8e535229c49f6798e3204476a0232fc0c
test "$(readlink -f /opt/xiazi/current)" = "$release"
test ! -e "$backup"
cd "$stage"
sha256sum --check SHA256SUMS
release_id="$(node -e 'const x=require("./manifest.json");if(!/^rel_20260623_[0-9a-f]{24}$/.test(x.releaseId)||x.issueDate!=="2026-06-23"||x.posters.length!==18)throw Error("INVALID_MANIFEST");process.stdout.write(x.releaseId)')"
for prefix in data apps/web/data; do
  test "$(sha256sum "$release/$prefix/archive/2026-06-23.json" | cut -d' ' -f1)" = "$old"
  test ! -e "$release/$prefix/release-archive/2026-06-23.json"
  test ! -e "$release/$prefix/releases/$release_id.json"
done
before="$(sha256sum "$release/data/current-issue.json" "$release/data/current-release.json" "$release/apps/web/data/current-issue.json")"
mkdir -p "$backup/root" "$backup/web"
cp -p "$release/data/archive/2026-06-23.json" "$backup/root/2026-06-23.json"
cp -p "$release/apps/web/data/archive/2026-06-23.json" "$backup/web/2026-06-23.json"
rollback(){
  cp -p "$backup/root/2026-06-23.json" "$release/data/archive/2026-06-23.json"
  cp -p "$backup/web/2026-06-23.json" "$release/apps/web/data/archive/2026-06-23.json"
  for prefix in data apps/web/data; do
    if test -f "$release/$prefix/release-archive/2026-06-23.json"; then mv "$release/$prefix/release-archive/2026-06-23.json" "$backup/$(echo "$prefix" | tr / -)-manifest-rolled-back.json"; fi
    if test -f "$release/$prefix/releases/$release_id.json"; then mv "$release/$prefix/releases/$release_id.json" "$backup/$(echo "$prefix" | tr / -)-bundle-rolled-back.json"; fi
  done
  echo ARCHIVE_POSTERS_ROLLED_BACK
}
trap rollback ERR
cd "$release"
node_modules/.bin/tsx -e 'import fs from "node:fs";import{parseIssue}from"./packages/contracts/src/schemas.ts";const s="/srv/wonderelian/.seo-fix-20261026/june23-posters/";const i=parseIssue(JSON.parse(fs.readFileSync(s+"issue.json","utf8")));const m=JSON.parse(fs.readFileSync(s+"manifest.json","utf8"));const old=JSON.parse(fs.readFileSync("data/archive/2026-06-23.json","utf8"));const candidate=JSON.parse(fs.readFileSync(s+"issue.json","utf8"));candidate.assetVersion=old.assetVersion;if(JSON.stringify(candidate)!==JSON.stringify(old)||i.assetVersion!==m.releaseId||m.posters.length!==18)throw Error("ARCHIVE_CONTENT_OR_VERSION_MISMATCH");console.log("ARCHIVE_CONTENT_PRESERVED");'
for prefix in data apps/web/data; do
  mkdir -p "$release/$prefix/release-archive" "$release/$prefix/releases"
  install -m 0644 "$stage/manifest.json" "$release/$prefix/release-archive/2026-06-23.json"
  install -m 0644 "$stage/bundle.json" "$release/$prefix/releases/$release_id.json"
  install -m 0644 "$stage/issue.json" "$release/$prefix/archive/2026-06-23.json.next-posters"
  mv "$release/$prefix/archive/2026-06-23.json.next-posters" "$release/$prefix/archive/2026-06-23.json"
done
test "$before" = "$(sha256sum "$release/data/current-issue.json" "$release/data/current-release.json" "$release/apps/web/data/current-issue.json")"
trap - ERR
echo "ARCHIVE_POSTERS_INSTALLED_CURRENT_UNCHANGED $release_id"
