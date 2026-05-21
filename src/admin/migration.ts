// Data-directory migration: copy ~/.mimo2codex (or wherever it currently lives)
// to a user-chosen new location, then point the persistent pointer file at
// the new path so the next process boot opens SQLite there.
//
// Design notes:
//   • SQLite is closed before any file is touched. We never copy a hot db.
//   • Server is in maintenance mode for the whole copy — every non-admin route
//     returns 503. The user is told to restart the process when copy finishes,
//     since we deliberately don't re-open SQLite on the new path here (that
//     would re-enter all the runtime caches with the *old* in-memory state
//     against a *new* db file — a brittle combination compared to a clean boot).
//   • On any failure during copy, the partially-written destination is removed
//     and SQLite is re-opened on the original path so the proxy keeps working.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  createReadStream,
  createWriteStream,
} from "node:fs";
import { join, resolve, normalize, sep, isAbsolute, relative } from "node:path";
import { pipeline } from "node:stream/promises";
import { closeDb, openDb } from "../db/index.js";
import { writePointer } from "../db/dataDirPointer.js";
import {
  setMaintenance,
  setRestartRequired,
} from "../util/maintenance.js";
import { log } from "../util/log.js";

export interface PreviewResult {
  ok: boolean;
  resolved: string;
  fileCount: number;
  totalBytes: number;
  // True when the parent of resolved sits on the same logical volume / device
  // as src. Cross-volume migrations only matter for the speed estimate.
  sameVolumeHint: boolean;
  targetExists: boolean;
  targetEmpty: boolean;
  warnings: string[];
  errors: string[];
}

export interface FileEntry {
  relPath: string; // relative to srcDir, using forward slashes
  size: number;
}

interface ScanResult {
  files: FileEntry[];
  totalBytes: number;
}

export type MigrationEvent =
  | { type: "start"; ts: number; srcDir: string; destDir: string }
  | { type: "scan"; fileCount: number; totalBytes: number }
  | {
      type: "progress";
      copiedFiles: number;
      copiedBytes: number;
      totalFiles: number;
      totalBytes: number;
      currentFile: string;
    }
  | { type: "pointer"; path: string }
  | { type: "done"; ts: number; destDir: string }
  | { type: "error"; code: string; message: string };

export type MigrationEmit = (evt: MigrationEvent) => void;

// ── Path checks ──────────────────────────────────────────────────────────

function normalizeForCompare(p: string): string {
  // Posix-style for unambiguous string comparison. We only use this for the
  // overlap test; we never persist the normalized form.
  let n = normalize(resolve(p));
  if (n.endsWith(sep)) n = n.slice(0, -1);
  return n;
}

function isInsideOrEqual(child: string, ancestor: string): boolean {
  const c = normalizeForCompare(child);
  const a = normalizeForCompare(ancestor);
  if (c === a) return true;
  const rel = relative(a, c);
  return !rel.startsWith("..") && !isAbsolute(rel);
}

export function validatePaths(
  srcDir: string,
  destDir: string
): { ok: boolean; resolved: string; errors: string[] } {
  const errors: string[] = [];
  if (!destDir || typeof destDir !== "string") {
    errors.push("target path is required");
    return { ok: false, resolved: "", errors };
  }
  if (!isAbsolute(destDir)) {
    errors.push("target path must be absolute");
  }
  const resolved = isAbsolute(destDir) ? normalize(resolve(destDir)) : destDir;
  if (!isAbsolute(destDir)) {
    return { ok: false, resolved, errors };
  }
  if (normalizeForCompare(resolved) === normalizeForCompare(srcDir)) {
    errors.push("target is the same as the current data directory");
  } else if (isInsideOrEqual(resolved, srcDir)) {
    errors.push("target cannot be inside the current data directory");
  } else if (isInsideOrEqual(srcDir, resolved)) {
    errors.push("target cannot be a parent of the current data directory");
  }
  return { ok: errors.length === 0, resolved, errors };
}

// ── Scan ─────────────────────────────────────────────────────────────────

function scanDir(srcDir: string): ScanResult {
  const out: FileEntry[] = [];
  let total = 0;
  function walk(absDir: string, relPrefix: string): void {
    if (!existsSync(absDir)) return;
    for (const name of readdirSync(absDir)) {
      const abs = join(absDir, name);
      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs, rel);
      } else if (st.isFile()) {
        out.push({ relPath: rel, size: st.size });
        total += st.size;
      }
      // skip symlinks / sockets / etc. — none should appear in ~/.mimo2codex
    }
  }
  walk(srcDir, "");
  return { files: out, totalBytes: total };
}

// ── Preview ──────────────────────────────────────────────────────────────

export function previewMigration(srcDir: string, destDir: string): PreviewResult {
  const v = validatePaths(srcDir, destDir);
  const warnings: string[] = [];
  let fileCount = 0;
  let totalBytes = 0;
  let targetExists = false;
  let targetEmpty = true;

  if (existsSync(v.resolved)) {
    targetExists = true;
    try {
      const entries = readdirSync(v.resolved);
      targetEmpty = entries.length === 0;
    } catch (err) {
      v.errors.push(`cannot read target directory: ${(err as Error).message}`);
    }
  }

  if (targetExists && !targetEmpty) {
    v.errors.push(
      "target directory is not empty — choose an empty or non-existent path"
    );
  }

  const sameVolumeHint =
    v.resolved.length > 0 &&
    srcDir.length > 0 &&
    (process.platform === "win32"
      ? v.resolved.slice(0, 2).toLowerCase() === srcDir.slice(0, 2).toLowerCase()
      : true);
  if (!sameVolumeHint) {
    warnings.push(
      "target is on a different drive — copy will be slower than a rename"
    );
  }

  if (v.ok && v.errors.length === 0) {
    try {
      const sc = scanDir(srcDir);
      fileCount = sc.files.length;
      totalBytes = sc.totalBytes;
    } catch (err) {
      v.errors.push(`failed to scan source: ${(err as Error).message}`);
    }
  }

  return {
    ok: v.errors.length === 0,
    resolved: v.resolved,
    fileCount,
    totalBytes,
    sameVolumeHint,
    targetExists,
    targetEmpty,
    warnings,
    errors: v.errors,
  };
}

// ── Run ──────────────────────────────────────────────────────────────────

async function copyFile(srcAbs: string, destAbs: string): Promise<void> {
  mkdirSync(join(destAbs, ".."), { recursive: true });
  await pipeline(createReadStream(srcAbs), createWriteStream(destAbs));
}

export async function runMigration(
  srcDir: string,
  destDir: string,
  emit: MigrationEmit
): Promise<void> {
  emit({ type: "start", ts: Date.now(), srcDir, destDir });

  // Re-validate at run time — preview may have raced with a filesystem change.
  const preview = previewMigration(srcDir, destDir);
  if (!preview.ok) {
    emit({ type: "error", code: "preflight_failed", message: preview.errors.join("; ") });
    return;
  }

  const targetDir = preview.resolved;
  let createdTarget = false;
  if (!preview.targetExists) {
    try {
      mkdirSync(targetDir, { recursive: true });
      createdTarget = true;
    } catch (err) {
      emit({
        type: "error",
        code: "mkdir_failed",
        message: `cannot create target: ${(err as Error).message}`,
      });
      return;
    }
  }

  // Take SQLite offline + flip global maintenance flag *before* scanning the
  // source again so we get the final post-close file set (no -wal / -shm
  // lingering open).
  setMaintenance(true, "data directory migration in progress");
  try {
    closeDb();
  } catch (err) {
    log.warn("closeDb during migration threw — proceeding", {
      error: (err as Error).message,
    });
  }

  // Scan after close so the file list reflects what's actually on disk.
  let scan: ScanResult;
  try {
    scan = scanDir(srcDir);
  } catch (err) {
    setMaintenance(false);
    // Re-open db so the proxy keeps working on the original location.
    try {
      openDb(srcDir);
    } catch {
      /* if reopen fails, the process is in a bad spot regardless */
    }
    emit({
      type: "error",
      code: "scan_failed",
      message: `failed to scan source: ${(err as Error).message}`,
    });
    return;
  }
  emit({ type: "scan", fileCount: scan.files.length, totalBytes: scan.totalBytes });

  let copiedFiles = 0;
  let copiedBytes = 0;
  const copiedRelPaths: string[] = [];

  for (const entry of scan.files) {
    const srcAbs = join(srcDir, entry.relPath.replace(/\//g, sep));
    const destAbs = join(targetDir, entry.relPath.replace(/\//g, sep));
    emit({
      type: "progress",
      copiedFiles,
      copiedBytes,
      totalFiles: scan.files.length,
      totalBytes: scan.totalBytes,
      currentFile: entry.relPath,
    });
    try {
      await copyFile(srcAbs, destAbs);
      copiedRelPaths.push(entry.relPath);
      copiedFiles += 1;
      copiedBytes += entry.size;
    } catch (err) {
      // Roll back: remove anything we wrote so the user is left with a clean
      // empty (or removed) target dir, and put the proxy back on the source.
      log.error("file copy failed during migration; rolling back", {
        relPath: entry.relPath,
        error: (err as Error).message,
      });
      for (const rel of copiedRelPaths) {
        try {
          rmSync(join(targetDir, rel.replace(/\//g, sep)), { force: true });
        } catch {
          /* keep rolling back even if one removal fails */
        }
      }
      if (createdTarget) {
        try {
          rmSync(targetDir, { recursive: true, force: true });
        } catch {
          /* user can clean up manually */
        }
      }
      setMaintenance(false);
      try {
        openDb(srcDir);
      } catch {
        /* see note above */
      }
      emit({
        type: "error",
        code: "copy_failed",
        message: `copying ${entry.relPath}: ${(err as Error).message}`,
      });
      return;
    }
  }
  // Final progress tick so the bar lands on 100% before the done frame.
  emit({
    type: "progress",
    copiedFiles,
    copiedBytes,
    totalFiles: scan.files.length,
    totalBytes: scan.totalBytes,
    currentFile: "",
  });

  // Write the pointer last — until this succeeds, the user can still recover
  // by simply restarting the process (which will reopen the original path).
  try {
    writePointer(targetDir);
  } catch (err) {
    log.error("pointer write failed after successful copy", {
      error: (err as Error).message,
    });
    // Don't roll back the copy — the user's data is safely in the new
    // location; we just couldn't persist the pointer. Surface that explicitly.
    setMaintenance(false);
    try {
      openDb(srcDir);
    } catch {
      /* see note above */
    }
    emit({
      type: "error",
      code: "pointer_write_failed",
      message:
        `data copied to ${targetDir}, but writing the pointer file failed: ` +
        (err as Error).message +
        ". Restart with --data-dir to use the new location.",
    });
    return;
  }
  emit({ type: "pointer", path: targetDir });

  // Mark the process as "restart required" so the admin UI can show a banner
  // and refuse further state-changing operations until the user restarts.
  setRestartRequired(
    true,
    "data directory was migrated; restart to load from the new location",
    targetDir
  );
  // Maintenance flag stays ON: any incoming request keeps getting 503 until
  // restart. The admin UI is whitelisted so the banner + close-modal still work.

  emit({ type: "done", ts: Date.now(), destDir: targetDir });
}
