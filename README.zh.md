# mimo-multi · 中文文档

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
  <img alt="node" src="https://img.shields.io/badge/Node-18%2B-blue?style=flat-square&logo=node.js&logoColor=white">
  <img alt="visual-fallback" src="https://img.shields.io/badge/视觉回退-自动-orange?style=flat-square">
</p>

**[mimo2codex](https://github.com/7as0nch/mimo2codex) 的增强 fork，核心功能：视觉回退。**

当你给不支持视觉的 MiMo 模型（`mimo-v2.5-pro`、`mimo-v2-pro`、`mimo-v2-flash`）发送图片时，mimo-multi 会自动检测并**无缝切换**到 `mimo-v2.5`——不需要手动换模型、不会报错、不用重启。

> 基于 mimo2codex v0.5.5，原作者 [7as0nch](https://github.com/7as0nch)。核心代理的所有功劳归于原作者。本 fork 只加了一个杀手级功能：**视觉回退**。

## 视觉回退

MiMo 最强的模型（`mimo-v2.5-pro`、`mimo-v2-flash`）不支持图片输入。你给它发张图就会报 `404: No endpoints found that support image input`。以前的方案是手动改 `config.toml` 切到 `mimo-v2.5`——烦人且打断思路。

mimo-multi 把它做成透明的：

```
Codex 发图片 → mimo-multi 检测到 → 自动切到 mimo-v2.5 → 正常返回
                       ↑
              [visual-fallback] mimo-v2.5-pro → mimo-v2.5 (image detected)
```

- **Responses API**: 检测 `payload.input[].content[]` 中的 `input_image` 类型
- **Chat Completions API**: 检测 `payload.messages[].content[]` 中的 `image_url` 类型
- **零配置**: 开箱即用，无需任何设置
- **日志可见**: 代理日志中会显示 `[visual-fallback]` 信息，发生切换时一目了然

## 安装

```bash
npm install -g mimo-multi
```

需要 Node.js >= 18。

## 快速开始

### 1. 获取 MiMo API Key

前往 [MiMo 控制台](https://platform.xiaomimimo.com) → API Keys → 复制 key（`sk-` 或 `tp-` 开头）。

### 2. 安装

```bash
npm install -g mimo-multi
```

需要 Node.js >= 18。

### 3. 启动代理

```bash
export MIMO_API_KEY=你的MiMo密钥
mimo-multi
```

启动成功后会打印两段配置内容，分别对应 Codex 的两个配置文件。

### 4. 配置 Codex

把启动横幅打印的内容写到对应文件：

| 文件 | macOS / Linux 路径 |
|------|--------------------|
| auth.json | `~/.codex/auth.json` |
| config.toml | `~/.codex/config.toml` |

示例配置：

**~/.codex/auth.json**
```json
{"OPENAI_API_KEY": "mimo-multi-local"}
```

**~/.codex/config.toml**
```toml
model = "mimo-v2.5-pro"
model_provider = "mimo"

[model_providers.mimo]
name = "MiMo (via mimo-multi)"
base_url = "http://127.0.0.1:8788/v1"
wire_api = "responses"
requires_openai_auth = true
```

### 5. 启动 Codex

```bash
codex
# 或在桌面端应用中打开
```

之后发图片就会看到代理日志中的 `[visual-fallback]` 提示，无需任何手动操作。

完整功能文档（多 provider、Docker、Admin UI、通用 provider、cc-switch 集成等）详见[上游 mimo2codex 文档](https://github.com/7as0nch/mimo2codex)。

## 与上游 mimo2codex 的区别

| | mimo2codex | mimo-multi |
|---|---|---|
| 非视觉模型 + 图片 | 丢弃图片，替换为占位文本 | **自动切换到视觉模型** |
| 视觉模型 + 图片 | 正常工作 | 正常工作 |
| 手动切模型 | 图片场景需要手动 | 不需要 |

## 上游同步

本 fork 通过 GitHub Actions（`.github/workflows/sync-upstream.yml`）自动跟踪上游更新：

- 每天检测一次 mimo2codex 新版本
- 与视觉回退补丁无冲突时自动合并
- 若 `src/server.ts` 出现冲突则自动创建 Issue（概率极低——仅改动约 20 行代码）

## 许可证

MIT，见 [LICENSE](./LICENSE)。基于 [7as0nch](https://github.com/7as0nch) 的 [mimo2codex](https://github.com/7as0nch/mimo2codex)。
