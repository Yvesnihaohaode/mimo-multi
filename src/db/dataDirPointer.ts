import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { log } from "../util/log.js";

// Persisted pointer to a user-chosen data directory. Placed in the user's
// home directory (next to the default ~/.mimo2codex/, not inside it — so the
// pointer survives a data-dir move and is never overwritten by a migration).
//
// Resolution order is owned by resolveDataDir (CLI > env > pointer > default),
// so the pointer is only consulted when the user has NOT supplied --data-dir
// or MIMO2CODEX_DATA_DIR explicitly.
const POINTER_FILE_NAME = ".mimo2codex-pointer.json";

export function pointerFilePath(): string {
  return join(homedir(), POINTER_FILE_NAME);
}

interface PointerPayload {
  dataDir: string;
  updatedAt: number;
}

export function readPointer(): string | null {
  const path = pointerFilePath();
  if (!existsSync(path)) return null;
  try {
    const text = readFileSync(path, "utf-8");
    const parsed = JSON.parse(text) as PointerPayload;
    if (typeof parsed.dataDir === "string" && parsed.dataDir.length > 0) {
      return parsed.dataDir;
    }
    return null;
  } catch (err) {
    log.warn(`pointer file at ${path} is unreadable; ignoring`, {
      error: (err as Error).message,
    });
    return null;
  }
}

export function writePointer(dataDir: string): void {
  const path = pointerFilePath();
  // homedir() always exists, but be defensive in case of unusual envs.
  mkdirSync(dirname(path), { recursive: true });
  const payload: PointerPayload = {
    dataDir,
    updatedAt: Date.now(),
  };
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  log.info(`wrote dataDir pointer → ${dataDir}`);
}
