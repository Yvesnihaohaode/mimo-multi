import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDotenv, loadDotenvFile } from "../src/util/dotenv.js";

describe("parseDotenv: semantics mirror scripts/load-env.{sh,ps1}", () => {
  it("parses plain KEY=value lines", () => {
    const r = parseDotenv("FOO=bar\nBAZ=qux");
    expect(r.entries).toEqual([
      { key: "FOO", value: "bar" },
      { key: "BAZ", value: "qux" },
    ]);
    expect(r.skipped).toEqual([]);
  });

  it("strips paired surrounding quotes (double and single)", () => {
    const r = parseDotenv(`A="hello"\nB='world'\nC="mixed'end\nD=plain`);
    expect(r.entries).toEqual([
      { key: "A", value: "hello" },
      { key: "B", value: "world" },
      // unpaired: leading " and trailing '  — NOT stripped, both kept literal
      { key: "C", value: `"mixed'end` },
      { key: "D", value: "plain" },
    ]);
  });

  it("does NOT expand $variables or escape sequences inside values", () => {
    const r = parseDotenv(`PATH_LIKE=$HOME/bin\nNEWLINE="a\\nb"`);
    expect(r.entries).toEqual([
      { key: "PATH_LIKE", value: "$HOME/bin" },
      { key: "NEWLINE", value: "a\\nb" },
    ]);
  });

  it("skips comments and blank lines", () => {
    const r = parseDotenv(`# top comment\n\nFOO=1\n   # indented comment\n\nBAR=2\n`);
    expect(r.entries).toEqual([
      { key: "FOO", value: "1" },
      { key: "BAR", value: "2" },
    ]);
  });

  it("tolerates `export ` prefix", () => {
    const r = parseDotenv(`export MIMO_API_KEY=sk-xxx\nexport  TWO=two`);
    expect(r.entries).toEqual([
      { key: "MIMO_API_KEY", value: "sk-xxx" },
      { key: "TWO", value: "two" },
    ]);
  });

  it("tolerates Windows CRLF line endings", () => {
    const r = parseDotenv("FOO=bar\r\nBAZ=qux\r\n");
    expect(r.entries.map((e) => e.key)).toEqual(["FOO", "BAZ"]);
    expect(r.entries.map((e) => e.value)).toEqual(["bar", "qux"]);
  });

  it("rejects invalid key names (digit start, dashes, etc.) with a skip reason", () => {
    const r = parseDotenv(`1FOO=bad\nBAR-BAZ=bad\nGOOD_1=ok`);
    expect(r.entries).toEqual([{ key: "GOOD_1", value: "ok" }]);
    expect(r.skipped).toHaveLength(2);
    expect(r.skipped[0].reason).toMatch(/invalid key/);
    expect(r.skipped[1].reason).toMatch(/invalid key/);
  });

  it("skips lines without '=' but doesn't blow up", () => {
    const r = parseDotenv(`FOO=1\nnonsenseline\nBAR=2`);
    expect(r.entries.map((e) => e.key)).toEqual(["FOO", "BAR"]);
    expect(r.skipped).toHaveLength(1);
  });

  it("allows '=' in the value (only first '=' splits)", () => {
    const r = parseDotenv(`KEY=a=b=c`);
    expect(r.entries).toEqual([{ key: "KEY", value: "a=b=c" }]);
  });

  it("strips leading whitespace from lines", () => {
    const r = parseDotenv(`   FOO=1\n\tBAR=2`);
    expect(r.entries).toEqual([
      { key: "FOO", value: "1" },
      { key: "BAR", value: "2" },
    ]);
  });
});

describe("loadDotenvFile: writes into the provided env object", () => {
  it("loads + overwrites existing env entries (file is source of truth)", () => {
    const dir = mkdtempSync(join(tmpdir(), "mimo2codex-dotenv-"));
    const file = join(dir, ".env");
    writeFileSync(file, `FOO=newvalue\nNEW=appears`);
    try {
      const env: NodeJS.ProcessEnv = { FOO: "old", UNRELATED: "keep" };
      const r = loadDotenvFile(file, env);
      expect(r.loaded).toEqual(["FOO", "NEW"]);
      expect(env.FOO).toBe("newvalue");
      expect(env.NEW).toBe("appears");
      expect(env.UNRELATED).toBe("keep");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
