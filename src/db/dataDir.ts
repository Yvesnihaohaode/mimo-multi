import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { readPointer } from "./dataDirPointer.js";

const DEFAULT_DIR_NAME = ".mimo2codex";

export type DataDirSource = "cli" | "env" | "pointer" | "default";

export interface ResolvedDataDir {
  dir: string;
  source: DataDirSource;
  defaultDir: string;
  cliOverride: string | null;
  envOverride: string | null;
  pointerValue: string | null;
}

// Resolve the data directory for sqlite + future config files. Priority:
//   1. explicit cliOverride (--data-dir)
//   2. MIMO2CODEX_DATA_DIR env var
//   3. user-set pointer file (~/.mimo2codex-pointer.json) — set by admin UI
//   4. ~/.mimo2codex
export function resolveDataDir(
  cliOverride: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): string {
  return resolveDataDirInfo(cliOverride, env).dir;
}

// Same resolution as resolveDataDir, but also reports *which layer* won. The
// admin UI uses this to show e.g. "data dir is fixed by --data-dir at boot,
// you can't change it from the UI without removing the flag first".
export function resolveDataDirInfo(
  cliOverride: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): ResolvedDataDir {
  const defaultDir = join(homedir(), DEFAULT_DIR_NAME);
  const envOverride = env.MIMO2CODEX_DATA_DIR ?? null;
  const pointerValue = readPointer();

  let dir: string;
  let source: DataDirSource;
  if (cliOverride) {
    dir = cliOverride;
    source = "cli";
  } else if (envOverride) {
    dir = envOverride;
    source = "env";
  } else if (pointerValue) {
    dir = pointerValue;
    source = "pointer";
  } else {
    dir = defaultDir;
    source = "default";
  }

  mkdirSync(dir, { recursive: true });

  return {
    dir,
    source,
    defaultDir,
    cliOverride: cliOverride ?? null,
    envOverride,
    pointerValue,
  };
}
