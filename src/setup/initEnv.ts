import { fileURLToPath } from "node:url";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Locate the bundled .env.example template that ships with the npm package.
// At runtime (compiled): __filename = <pkg>/dist/setup/initEnv.js, so
//   resolve(<here>, "..", "..") = <pkg>
// In dev under tsx: __filename = <repo>/src/setup/initEnv.ts, same shape.
const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "..", "..");
const BUNDLED_EXAMPLE = join(PACKAGE_ROOT, ".env.example");

export function bundledExamplePath(): string {
  return BUNDLED_EXAMPLE;
}

export function dataDirEnvPath(dataDir: string): string {
  return join(dataDir, ".env");
}

export function dataDirExamplePath(dataDir: string): string {
  return join(dataDir, ".env.example");
}

export interface RefreshExampleResult {
  source: string;
  dest: string;
  available: boolean;
  refreshed: boolean;
}

// Refresh the per-user .env.example from the bundled template. Always
// overwrites — the bundled version is the source of truth and may evolve
// (new providers, new runtime flags). Caller is responsible for deciding
// when to refresh (init subcommand: always; auto-load: only when about to
// create .env from it on first run).
export function refreshDataDirExample(dataDir: string): RefreshExampleResult {
  const source = BUNDLED_EXAMPLE;
  const dest = dataDirExamplePath(dataDir);
  if (!existsSync(source)) {
    return { source, dest, available: false, refreshed: false };
  }
  mkdirSync(dataDir, { recursive: true });
  copyFileSync(source, dest);
  return { source, dest, available: true, refreshed: true };
}

export interface EnsureEnvResult {
  envPath: string;
  examplePath: string;
  exampleAvailable: boolean;
  created: boolean;
}

// Ensure <dataDir>/.env exists, seeding it from .env.example if missing.
// Never touches an existing .env. The .env.example is refreshed from the
// bundle just before seeding, so a brand-new user gets the latest template.
export function ensureDataDirEnv(dataDir: string): EnsureEnvResult {
  const envPath = dataDirEnvPath(dataDir);
  const examplePath = dataDirExamplePath(dataDir);
  if (existsSync(envPath)) {
    return { envPath, examplePath, exampleAvailable: existsSync(examplePath), created: false };
  }
  const refresh = refreshDataDirExample(dataDir);
  if (!refresh.available) {
    return { envPath, examplePath, exampleAvailable: false, created: false };
  }
  copyFileSync(examplePath, envPath);
  return { envPath, examplePath, exampleAvailable: true, created: true };
}
