# Daily publication — one supported entry point

Input: `issue-spec.json` and `zh/NO.01.png` … `zh/NO.09.png`, plus the nine
matching English files under `en/`. Images are final PNGs, 887 × 1774, 10 KB–10 MB.

Run from the existing production directory, without switching its branch:

```sh
node node_modules/tsx/dist/cli.mjs scripts/daily-publication.ts \
  --issue-spec /absolute/daily/issue-spec.json --poster-root /absolute/daily
```

The command validates all sources and posters, creates a candidate without any
mirrors, uploads eighteen immutable Alibaba OSS objects, verifies hashes, commits the
current issue and dated archives atomically, and checks the public website.
Success ends with `ARCHIVE_ACCEPTED current=18/18 archive=18/18`.

Do not run `git fetch`, copy posters into the repository, invoke the old Release
V2 production rollout, activate a database release, or rebuild Alibaba for a
daily issue. Browser image generation is unchanged. Git stores JSON only.

## Retry and recovery

- Rerun the same command after a transient error. Content-derived IDs reuse
  objects. Unchanged complete publication creates no commit.
- Never change an image while retrying its existing immutable batch; rerunning
  with changed input creates a new version automatically.
- Preflight/upload failure leaves the current issue untouched. Acceptance failure
  after activation is reported as failure, not silently hidden or republished.
- A non-fast-forward conflict stops activation. Inspect the new current issue
  before retrying; an older date cannot replace a newer date by accident.
- `.publication.lock` blocks concurrent runs using one input folder. If a process
  crashes, confirm it has exited before removing that exact stale lock.
- Roll back only to a recorded immutable bundle:

```sh
node node_modules/tsx/dist/cli.mjs scripts/daily-publication.ts \
  --rollback rel_YYYYMMDD_24hexcharacters --poster-root /absolute/report-directory
```

The rollback validates the recorded images (OSS or legacy COS) and atomically restores pointers.
Other dates are retained. No force push and no binary history rewrite.

## Persistence and security

- `data/current-issue.json` and `data/current-release.json`: current pointers.
- `data/archive/YYYY-MM-DD.json` and `data/release-archive/YYYY-MM-DD.json`:
  date archive, committed with the current pointers.
- `data/releases/RELEASE_ID.json`: immutable content + poster manifest, including
  the superseded release before replacement. The web reader resolves this by the
  issue's assetVersion to avoid mixed-cache 409 errors.
- Pre-migration archives continue to use their existing dated manifest or legacy
  poster routes; nothing was deleted from history.
- OSS publisher credentials are outside Git at `~/.config/xiazi/oss-publisher.json`,
  owner-only. GitHub authentication comes from the existing `gh` login. Never put
  credentials in an automation prompt, issue file, report or browser.
- Keep today and the previous three days of local outputs. Never delete unique
  source images or an unverified failed candidate as part of publication.

The older mirror builder requires an explicit maintenance override; the old
two-commit publisher is disabled. Neither is a daily publication path.
The legacy Supabase shadow workflow is now manual maintenance only; a daily JSON
commit no longer starts a second, unrelated database publication job.

## Application deployments are separate and immutable

Alibaba current is `daily-direct-20260914-v1`; the preceding
`editorial-icons-20260914-v1` remains a complete rollback version. Identical large
dependency files in four older releases were SHA-256 and byte-verified before
hard-link deduplication (284 paths, approximately 3.80 GiB released). All paths,
content, modes, ownership and modification times were preserved.

Treat all deployed versions and their shared dependencies as immutable. Never
run `npm install`/`npm ci` or patch dependencies in an old deployment. A dependency
upgrade must use independently installed dependencies in a new candidate. Daily
content publication does not build or add deployment directories.

## Alibaba OSS asset storage

New daily publications use `xiazi-release-assets-20260824` in `cn-wulanchabu`.
The publisher checks that bucket versioning has never been enabled, and uses
conditional creation (`x-oss-forbid-overwrite: true`), AES256 encryption, and
SHA256 readback. Its RAM policy denies deletion and limits writes to
`release-assets/`. Only that public poster prefix permits anonymous reads.
Existing COS manifests remain readable for rollback. Credentials stay outside Git.
