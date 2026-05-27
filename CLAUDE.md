# CLAUDE.md — mimo-multi

## 项目定位

**mimo-multi** 是 [mimo2codex](https://github.com/7as0nch/mimo2codex)（MIT 许可证）的增强 fork，核心功能是**视觉回退**：自动检测请求中的图片，将不支持视觉的模型（pro/flash）无缝切换到支持视觉的模型（v2.5）。

## 架构

```
Codex 桌面端 → :8788 (mimo-multi / mimo2codex 代理) → MiMo API
                                    ↑
                          视觉回退补丁在此生效
```

## 核心改动

仅修改 `src/server.ts` 一处，在 `selectProvider()` 调用前插入检测逻辑：

```typescript
// 位置：server.ts - Responses API 路径 (~line 366) 和 Chat Completions 路径 (~line 923)
// 必须在 selectProvider() 之前修改 payload.model
const VISION_FB = "mimo-v2.5";
const NON_VISION = new Set(["mimo-v2.5-pro", "mimo-v2-pro", "mimo-v2-flash"]);
if (NON_VISION.has(payload.model) && Array.isArray(payload.input)) {
    // 遍历 payload.input 查找 input_image 类型
    // 找到 → payload.model = VISION_FB
}
```

关键点：必须改 `payload.model` 而不是 `chat.model`，因为 `selectProvider()` 返回的 `upstreamModel` 会在之后覆盖 `chat.model`。

## 当前状态

- ✅ 视觉回退已跑通（运行在本地 mimo2codex v0.5.5 上，手动 patch）
- ✅ 用户确认 "跑通了！"
- ⬜ 需要 fork 上游仓库，应用补丁，发布为独立 npm 包 `mimo-multi`
- ⬜ 需要配置 GitHub Actions 自动跟踪上游更新

## 关键文件路径

| 路径 | 说明 |
|------|------|
| `/Users/yufeng/.npm-global/lib/node_modules/mimo2codex/dist/server.js` | 当前已 patch 的运行版本 |
| `/Users/yufeng/.npm-global/lib/node_modules/mimo2codex/dist/server.js.bak` | 原始备份 |
| `/Users/yufeng/.npm-global/lib/node_modules/mimo2codex/dist/translate/reqToChat.js` | 冗余 patch（非必要） |
| `/Users/yufeng/.npm-global/lib/node_modules/mimo2codex/dist/translate/reqToChat.js.bak` | 备份 |
| `/Users/yufeng/.local/bin/start-codex-mimo` | 一键启动脚本（含 MiMo API key） |
| `/Users/yufeng/.codex/config.toml` | Codex 配置，指向 :8788 |
| `/Users/yufeng/.codex/auth.json` | Codex 认证 |

## 上游仓库信息

- **仓库**: https://github.com/7as0nch/mimo2codex
- **作者**: 7as0nch
- **许可证**: MIT
- **当前版本**: v0.5.5
- **Stars**: 403
- **默认分支**: main
- **发布频率**: 极高（几乎每天发版）

## 上游跟踪策略

四种情况自动处理：
1. 上游修 bug → `git merge upstream/main`，无冲突自动发布
2. 上游加新功能 → 自动 merge + 跑测试
3. 上游改无关文件 → 零冲突自动 merge
4. 上游改 server.ts 同一段 → 创建 Issue 通知人工介入（概率极低）

通过 GitHub Actions 定时任务（每天一次）触发检测。

## 待办事项

1. 在 GitHub 创建 `mimo-multi` 仓库
2. Fork mimo2codex，应用视觉回退补丁
3. 修改 package.json（name, description, repository）
4. 编写 README.md + README.zh.md
5. 配置 sync-upstream GitHub Actions
6. 发布到 npm
