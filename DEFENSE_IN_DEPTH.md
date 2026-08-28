# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: npm library · public

## 1. Security docs
- [x] `SECURITY.md` present — contact info + "How this repository is secured" summary — PR #132
- [x] `DEFENSE_IN_DEPTH.md` present (this file) — PR #132

## 2. CODEOWNERS and cloud bootstrap
- [x] `.github/CODEOWNERS` covers `/.github/`, `/.cursor/`, `/.devcontainer/`, `/scripts/` with owners the maintainer names — PR #132
- [x] Codespaces and Cursor Cloud Agents bootstrap Aikido Safe Chain via scripts/setup-cloud-environment.sh (--ci shims, frozen lockfile) — PR #132

## 3. Dependencies (pnpm)
- [x] `packageManager: pnpm@11.3+` pinned in `package.json` — verified main (`pnpm@11.17.0+sha512…`)
- [x] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false`; no first-party `minimumReleaseAgeExclude` — PR #132
- [x] `trustPolicy: no-downgrade`; no first-party `trustPolicyExclude` — PR #132
- [x] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline (reviewed exceptions: `esbuild`, `skia-canvas`) — PR #132
- [x] `blockExoticSubdeps: true` — PR #132
- [x] Lockfile committed; CI installs with `pnpm install --frozen-lockfile` — PR #132
- [x] No `.github/dependabot.yml`; other dependency-update tools (if any) open PRs only — never auto-merge — verified main

## 4. GitHub Actions
- [x] `permissions: contents: read` (or `{}` + per-job grants) on every workflow — PR #133
- [x] No `contents: write` except jobs whose purpose is mutating the repo (GitHub Release, Changesets version PR); generated output is a workflow artifact, never committed back from CI — verified main
- [x] Every action pinned to a full commit SHA (`npx actions-up`) — PR #133
- [x] Every job installs Socket Firewall (`SocketDev/action` SHA-pinned, `firewall-version` pinned); `pnpm install` / `npm install` run as `sfw pnpm install` / `sfw npm install` — PR #133
- [x] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR — PR #133
- [x] `persist-credentials: false` on checkouts that don't push — PR #133
- [x] No `pull_request_target` on workflows that run untrusted PR code — verified main
- [x] Artifact-publishing workflows disable `actions/setup-node` default caching (`package-manager-cache: false`) to prevent cache poisoning — PR #133
- [x] No npm tokens (or other registry credentials) in Actions secrets — verified main (OIDC trusted publishing; no `NPM_TOKEN`)

## 5. npm publishing — npm libraries only
- [x] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual) — verified maintainer
- [x] `.github/workflows/release.yaml` packs then stages with `pnpm stage publish ./packed/*.tgz --no-git-checks` — PR #134
- [x] Maintainer promotes staged versions with 2FA (manual) — verified maintainer
- [x] Drydock connected — staged releases reviewed before promotion (manual) — verified maintainer
- [x] No direct publish rights: package requires 2FA and disallows tokens (manual) — verified maintainer
- [x] `package.json` `repository.url` accurate so provenance maps to this repo — verified main

## 6. Security tooling
- [x] Aikido runs on every build — verified main (Aikido GitHub app check on PRs)
- [x] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release` — PR #134
- [x] Socket reviews every PR that changes dependencies — verified main (Socket GitHub app check on PRs)

## 7. Repository lockdown
- [x] `lockdown-repo.sh` applied; `--check` with `--required-checks` and `--allowed-actions` passes (PRs required on the default branch, merges blocked unless required status checks pass, tag ruleset, immutable releases, fork-PR approval (public repos), read-only workflow tokens, Actions allowlist, secret scanning, Dependabot disabled, private vulnerability reporting (public repos)) — PR #135
- [x] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual) — verified maintainer
- [x] Recovery codes stored offline in a password manager (manual) — verified maintainer
