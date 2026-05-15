import { readFileSync } from "node:fs";

// Parse & inject KEY=value lines into process.env. Semantics intentionally
// mirror scripts/load-env.sh and scripts/load-env.ps1 so the in-process loader
// and the shell-side loaders behave identically:
//
//   - `#` comment lines and blank lines are skipped
//   - leading `export ` prefix is tolerated (and stripped)
//   - keys must match POSIX env var rules: [A-Za-z_][A-Za-z0-9_]*
//   - paired surrounding quotes ("..." or '...') are stripped; interior is
//     literal — no $var expansion, no backslash escapes
//   - existing process.env entries are OVERWRITTEN (the file is the source of
//     truth for the keys it declares)
//   - Windows CRLF line endings are tolerated

export interface DotenvEntry {
  key: string;
  value: string;
}

export interface DotenvParseResult {
  entries: DotenvEntry[];
  skipped: Array<{ line: number; raw: string; reason: string }>;
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseDotenv(text: string): DotenvParseResult {
  const entries: DotenvEntry[] = [];
  const skipped: DotenvParseResult["skipped"] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/^[ \t]+/, "");
    if (line.length === 0) continue;
    if (line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) {
      skipped.push({ line: i + 1, raw, reason: "no '=' separator" });
      continue;
    }
    let body = line;
    if (body.startsWith("export ")) {
      body = body.slice(7).replace(/^[ \t]+/, "");
    }
    const eq2 = body.indexOf("=");
    if (eq2 < 1) {
      skipped.push({ line: i + 1, raw, reason: "no '=' after export prefix" });
      continue;
    }
    const key = body.slice(0, eq2).trim();
    let value = body.slice(eq2 + 1);
    if (!KEY_RE.test(key)) {
      skipped.push({ line: i + 1, raw, reason: `invalid key name '${key}'` });
      continue;
    }
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }
    entries.push({ key, value });
  }
  return { entries, skipped };
}

export interface LoadDotenvResult {
  path: string;
  loaded: string[];
  skipped: Array<{ line: number; raw: string; reason: string }>;
}

export function loadDotenvFile(
  path: string,
  env: NodeJS.ProcessEnv = process.env
): LoadDotenvResult {
  const text = readFileSync(path, "utf8");
  const { entries, skipped } = parseDotenv(text);
  for (const { key, value } of entries) {
    env[key] = value;
  }
  return { path, loaded: entries.map((e) => e.key), skipped };
}
