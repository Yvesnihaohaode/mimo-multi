// Release notes shown in the "What's New" modal on admin first-load after a
// version bump. Maintained as a hand-rolled data file (TSX, not JSON, so we
// can drop in icons and the occasional ReactNode without losing TS safety).
//
// How to add an entry when you ship a new version:
//   1. Bump package.json `version` (via `npm run release:patch` etc.).
//   2. Update doc/tag-log{,.zh}.md as before (the WhatsNew modal complements
//      tag-log, it does not replace it).
//   3. Prepend a new `ReleaseNote` to RELEASE_NOTES below. Most recent first.
//      The modal auto-shows it to users whose lastSeenVersion is below it.
//
// Keep entries user-facing: highlight what changed from the user's seat, name
// the menu / button / page where the new thing lives, and (optionally) wire a
// CTA that navigates straight to it.

import type { ReactNode } from "react";
import { DatabaseOutlined, GlobalOutlined } from "@ant-design/icons";

export interface BilingualText {
  en: string;
  zh: string;
}

export interface ReleaseHighlight {
  icon?: ReactNode;
  /** Section badge: "new" | "improved" | "fixed" | "doc" */
  kind?: "new" | "improved" | "fixed" | "doc";
  title: BilingualText;
  description: BilingualText;
  /** Plain-text breadcrumb so users can find the new feature themselves. */
  location?: BilingualText;
  /** Optional CTA. ctaPath wins → react-router navigate; else ctaHref opens new tab. */
  ctaLabel?: BilingualText;
  ctaPath?: string;
  ctaHref?: string;
}

export interface ReleaseNote {
  version: string; // semver "0.4.2"
  date: string;    // "2026-05-21" ISO
  title: BilingualText;
  summary?: BilingualText;
  highlights: ReleaseHighlight[];
}

// ── Entries ──────────────────────────────────────────────────────────────
// Most recent first. Anything missing the user has seen scrolls into view.
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.4.2",
    date: "2026-05-21",
    title: {
      en: "Data-dir migration in the UI + official docs site",
      zh: "Admin UI 数据迁移 + 官网文档站",
    },
    highlights: [
      {
        kind: "new",
        icon: <DatabaseOutlined />,
        title: {
          en: "Migrate your data directory from the admin UI",
          zh: "Admin UI 一键迁移数据目录",
        },
        description: {
          en: "Pick a target path → preview the file count and total size → live progress bar copies SQLite + .env + providers.json. The server is in maintenance mode (503) while copying; the original directory is kept so you can verify the new location before deleting.",
          zh: "选目标路径 → 预览将复制的文件数和大小 → 进度条流式复制 SQLite + .env + providers.json。迁移期间服务进入维护模式（503），原目录保留，待你验证新目录无误后再手动删除。",
        },
        location: {
          en: "Top-right ⚙️ Settings → Local data directory → Migrate to a new directory",
          zh: "右上 ⚙️ 设置 → 本地数据目录 → 迁移到新目录",
        },
      },
      {
        kind: "doc",
        icon: <GlobalOutlined />,
        title: {
          en: "Official docs site",
          zh: "官方文档站点",
        },
        description: {
          en: "All docs and tutorials now live at mimodoc.chengj.online — start there when you're stuck. The footer link points straight at it.",
          zh: "完整文档与教程都汇集在 mimodoc.chengj.online，不懂的先来这里看。Footer 已经接好了直达入口。",
        },
        location: {
          en: "Footer → 📖 Docs",
          zh: "页脚 → 📖 文档",
        },
        ctaLabel: { en: "Open the docs", zh: "打开文档" },
        ctaHref: "https://mimodoc.chengj.online/",
      },
      {
        kind: "fixed",
        title: {
          en: "Hide server-only Codex entries in local mode",
          zh: "本地代理模式隐藏 server-only Codex 入口",
        },
        description: {
          en: "Export / Import to local and the History tab on the Codex 接入 page only make sense in Docker auth deployments. They're hidden now when running as a local single-user proxy.",
          zh: "「Codex 接入」页的「导出到本地」/「从本地导入」按钮与 History tab 只在 Docker 鉴权部署模式下有意义，本地代理模式现已隐藏，减少视觉噪音。",
        },
        location: {
          en: "Codex 接入 page — only visible when authMode = on",
          zh: "Codex 接入 页面 —— 仅在 authMode = on 时显示",
        },
      },
    ],
  },
];

// ── Semver compare ────────────────────────────────────────────────────────
export function compareVersion(a: string, b: string): number {
  const parse = (v: string): number[] =>
    v.replace(/^v/, "").split(".").map((n) => {
      const m = /^(\d+)/.exec(n);
      return m ? parseInt(m[1], 10) : 0;
    });
  const aa = parse(a);
  const bb = parse(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const ai = aa[i] ?? 0;
    const bi = bb[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

// Releases the user has not yet acknowledged, capped at the running version
// (so a release-notes.tsx entry for a *future* version doesn't leak through).
export function unseenReleases(
  lastSeen: string | null,
  current: string,
): ReleaseNote[] {
  const baseline = lastSeen ?? "0.0.0";
  return RELEASE_NOTES.filter(
    (n) =>
      compareVersion(n.version, baseline) > 0 &&
      compareVersion(n.version, current) <= 0,
  );
}
