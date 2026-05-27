# CLAUDE.md — mimo-multi

## 项目定位

**mimo-multi** 是 [mimo2codex](https://github.com/7as0nch/mimo2codex)（MIT）的增强 fork。核心功能：**视觉回退**——自动检测请求中的图片，将非视觉模型（pro/flash）无缝切换到 `mimo-v2.5`。

## 项目完成状态（2026-05-27）

| 项 | 状态 |
|------|------|
| 视觉回退补丁（src/server.ts 两处） | ✅ 已提交 |
| package.json 改名 | ✅ mimo-multi |
| README.md + README.zh.md | ✅ 含完整使用指南 |
| GitHub 仓库 | ✅ https://github.com/Yvesnihaohaode/mimo-multi |
| npm 发布 | ✅ `npm install -g mimo-multi` |
| 上游自动同步 CI | ✅ `.github/workflows/sync-upstream.yml` |
| 本地已安装替换 | ✅ start-codex-mimo 使用 mimo-multi 命令 |
| GitHub Secret NPM_TOKEN | ✅ 已配置 |

## 凭证（私密记忆）

GitHub Token、npm Token、git remote 等敏感信息存在记忆系统 `mimo-multi-credentials.md` 中，CLAUDE.md 里不写。

## 日常操作

### 本地开发
```bash
cd /Users/yufeng/Desktop/mimo-multi
npm run build          # 编译
npm test               # 跑测试（524个）
npm install -g .       # 本地安装为全局命令
```

### 发布新版本
```bash
npm version patch      # 或 minor / major
git push && npm publish
```

### 上游冲突处理
用户收到 GitHub Issue 通知（`[upstream-conflict]` 标签）→ 贴链接给 Claude Code → AI 解决冲突 → 测试 → 发布。

### 一键启动
```bash
start-codex-mimo       # 启动 mimo-multi + Codex
```

## 架构

```
Codex 桌面端 → :8788 (mimo-multi) → MiMo API
                       ↑
              [visual-fallback] 补丁在此
```

## 核心改动（技术备忘）

修改 `src/server.ts` 两处，在 `selectProvider()` 调用前插入检测逻辑：

**Responses API 路径：** 检测 `payload.input[].content[]` 中 `type === "input_image"` 的 content part，过滤掉非 message 类型的 item（function_call 等没有 content 属性）。

**Chat Completions API 路径：** 检测 `payload.messages[].content[]` 中 `type === "image_url"` 或 `"input_image"` 的 content part。

**关键点：** 只过滤 `item.type === "message"` 的项，避免 `ResponsesFunctionCallItem` 等无 content 属性的类型导致 TS 报错。

## CI/CD 自动流水线

每天北京时间 16:07（`.github/workflows/sync-upstream.yml`）：
1. 检测上游新提交 → 无则跳过
2. 尝试 merge → 有冲突（server.ts）则建 Issue 通知
3. npm install → build → test（524 个）
4. 通过后自动 push + npm publish

## 相关资源

- 上游仓库：https://github.com/7as0nch/mimo2codex
- npm 包：https://www.npmjs.com/package/mimo-multi
- 启动脚本：`/Users/yufeng/.local/bin/start-codex-mimo`
- Codex 配置：`~/.codex/config.toml` + `~/.codex/auth.json`
- 记忆：`mimo-multi-credentials.md`（GitHub Token, npm Token, git 配置）
