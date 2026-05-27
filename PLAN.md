# mimo-multi 项目方案

## 背景

mimo2codex（MIT 许可证，作者 7as0nch，403 stars）是一个本地代理，将 Codex Responses API 翻译为 MiMo Chat Completions API。但它不支持视觉模型自动切换——当用户发送图片给 mimo-v2.5-pro 时，MiMo API 会静默丢弃图片。

**mimo-multi** 在 mimo2codex 基础上增加视觉回退功能：自动检测请求中的图片，无缝切换到支持视觉的模型（mimo-v2.5），无需用户手动操作。

## 核心改动

仅修改 `src/server.ts` 一处，在 `selectProvider()` 调用前插入 ~20 行检测逻辑：

```
1. 检测 payload.model 是否在不支持视觉的模型列表中
2. 遍历 payload.input 查找 input_image 类型的 content
3. 检测到图片 → payload.model 替换为 mimo-v2.5
4. selectProvider() 拿到已修正的 model，路由到正确 provider
```

关键点：必须在 `selectProvider()` 之前修改 `payload.model`，因为 server.ts 后续会用 selectProvider 返回的 upstreamModel 覆盖 chat.model。

## 发布方案

**路线：Fork + 独立 npm 包**

1. Fork `7as0nch/mimo2codex` → 自己的 GitHub 仓库 `mimo-multi`
2. 重命名包名：`package.json` 中 `name` 改为 `mimo-multi`
3. 应用视觉回退补丁
4. 发布到 npm（`npm publish`）

## 上游跟踪与自动更新策略

### 机制设计

在 GitHub Actions 中配置定时任务（每天一次），自动检测上游更新：

```yaml
# .github/workflows/sync-upstream.yml
on:
  schedule:
    - cron: '0 8 * * *'  # 每天北京时间 16:00
  workflow_dispatch:      # 手动触发
```

### 四种情况的处理

| 情况 | 自动处理 | 说明 |
|------|---------|------|
| 上游修 bug | `git merge upstream/main` 自动合并 | 无冲突则直接 push |
| 上游加新功能 | 同上，自动 merge | 跑测试通过后自动发布 |
| 上游改无关文件 | 零冲突，自动 merge | 翻译层、CLI、Web UI 等 |
| 上游改 server.ts 同一段 | **创建 Issue + 通知维护者** | 概率极低（改动仅 20 行），需人工介入 |

### 自动化流水线

```
定时触发 → fetch upstream → diff 分析 → 分类处理:
  ├─ 无新版本 → 跳过
  ├─ 有新版本 + 无冲突 → 自动 merge → 跑测试 → 自动 npm publish
  └─ 有新版本 + 有冲突 → 创建 Issue 标记 "upstream-conflict" → 通知
```

### 冲突检测脚本

```bash
# scripts/check-upstream.sh
# 1. git fetch upstream
# 2. git merge --no-commit --no-ff upstream/main
# 3. 检查冲突文件是否包含 src/server.ts
# 4. 仅非关键文件冲突 → 自动解决
# 5. server.ts 冲突 → 暂停，通知人工处理
```

## 项目结构

```
mimo-multi/
├── .github/workflows/
│   └── sync-upstream.yml    # 自动跟踪上游
├── scripts/
│   └── check-upstream.sh    # 冲突检测与分类
├── src/
│   └── server.ts            # 核心：视觉回退逻辑
├── CLAUDE.md                # AI 助手指令
├── README.md                # 项目说明
├── README.zh.md             # 中文说明
└── package.json             # 改名 mimo-multi
```

## 实施步骤

### Phase 1: GitHub 仓库创建
1. 用户在 GitHub 创建空仓库 `mimo-multi`
2. 添加 remote，推送代码

### Phase 2: 核心补丁
1. 应用 server.ts 视觉回退补丁
2. 修改 package.json（name, description, repository 等）
3. 编写 README（中英双语）

### Phase 3: 自动更新 CI
1. 编写 sync-upstream.yml
2. 编写 check-upstream.sh
3. 测试自动 merge 流程

### Phase 4: npm 发布
1. 注册 npm 账号（如需要）
2. `npm publish` 发布首版

### Phase 5: 文档与推广
1. README 写清楚安装和使用方法
2. 说明与上游 mimo2codex 的关系
3. 标注视觉回退功能的使用场景

## 验证方式

1. `npm i -g mimo-multi` 安装成功
2. `mimo-multi --port 8788` 启动成功
3. 发送含图片的请求 → 日志显示 `[visual-fallback] mimo-v2.5-pro → mimo-v2.5`
4. 发送不含图片的请求 → 正常路由，无模型切换
5. 上游有新版本时 → GitHub Actions 自动检测并处理
