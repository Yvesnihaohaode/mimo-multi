#!/usr/bin/env node
// Bump version + push tags, but pin the previous commit's subject to the
// version bump's commit message so `git log` reads as
// "0.1.16 - [fix] xxx" instead of a bare "0.1.16".
//
// We deliberately skip `npm version`'s built-in `-m "%s ..."` substitution:
// on Windows that argument gets mangled by cmd.exe (% is the env-var marker)
// when running under pnpm/npm scripts. Instead we bump with
// --no-git-tag-version, then craft the commit + tag ourselves via `git`,
// which takes the message as a plain argv entry — no shell parsing involved.
//
// Usage: node scripts/release.mjs <patch|minor|major|prerelease> [--preid beta]
//
// `prerelease` increments the prerelease counter when current is already a
// prerelease (0.2.5-beta.0 → 0.2.5-beta.1), or starts a new prerelease when
// current is stable. Pass `--preid <id>` to pick the prerelease identifier
// (default `beta`); ignored when current already has a different identifier.
//
// CI in publish.yml maps SemVer prerelease suffix → npm dist-tag automatically
// (beta / alpha / rc / next), so `release:prerelease` cuts a beta build that
// users install with `npm i -g mimo2codex@beta` without touching `latest`.
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ALLOWED_BUMPS = ["patch", "minor", "major", "prerelease"];
const bump = process.argv[2];
if (!ALLOWED_BUMPS.includes(bump)) {
  console.error(`Usage: node scripts/release.mjs <${ALLOWED_BUMPS.join("|")}> [--preid beta]`);
  process.exit(1);
}

// Parse `--preid <id>` if present.
let preid = "beta";
{
  const idx = process.argv.indexOf("--preid");
  if (idx !== -1 && process.argv[idx + 1]) {
    preid = process.argv[idx + 1];
  }
}

let lastSubject = "";
try {
  lastSubject = execSync("git log -1 --pretty=%s", { encoding: "utf8", cwd: repoRoot }).trim();
} catch {
  // first commit / detached state — just bump without context
}

// Skip the splice if the previous commit was itself a version bump, so we
// don't end up with "0.1.17 - 0.1.16".
const looksLikeVersionBump = /^v?\d+\.\d+\.\d+(\s|$)/.test(lastSubject);
const ctxSuffix = lastSubject && !looksLikeVersionBump ? ` - ${lastSubject}` : "";

function run(cmd, args, { shell = false } = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: repoRoot, shell });
  if (r.error) {
    console.error(`[release] failed to start: ${cmd}`, r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`[release] command failed (exit ${r.status}): ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

// 1. Bump version in package.json (+ package-lock.json if present); no commit, no tag.
// npm on Windows is npm.cmd — Node's spawn can't launch .cmd files directly,
// so we go through the shell. These args are all simple ASCII so re-parsing
// by cmd.exe is harmless.
const versionArgs = ["version", bump, "--no-git-tag-version"];
if (bump === "prerelease") {
  versionArgs.push("--preid", preid);
}
run("npm", versionArgs, { shell: true });

// 2. Read the new version.
const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
const newVersion = pkg.version;
const message = `${newVersion}${ctxSuffix}`;

console.log(`[release] new version: ${newVersion}`);
console.log(`[release] commit message: ${message}`);

// 3. Commit the bumped manifest + tag at HEAD.
run("git", ["commit", "-am", message]);
run("git", ["tag", "-a", `v${newVersion}`, "-m", message]);

// 4. Push branch + tag together.
run("git", ["push", "--follow-tags"]);
