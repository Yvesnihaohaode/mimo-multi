# mimo-multi · 中文文档

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green?style=flat-square">
  <img alt="node" src="https://img.shields.io/badge/Node-18%2B-blue?style=flat-square&logo=node.js&logoColor=white">
  <img alt="visual-fallback" src="https://img.shields.io/badge/视觉回退-自动-orange?style=flat-square">
  <img alt="docker" src="https://img.shields.io/badge/docker-supported-blue?style=flat-square&logo=docker&logoColor=white">
</p>

**[mimo2codex](https://github.com/7as0nch/mimo2codex) 的增强 fork，核心功能：视觉回退。**

当你给不支持视觉的模型（如 `mimo-v2.5-pro`、`deepseek-v4-pro`）发送图片时，mimo-multi 会自动检测并**无缝切换**到视觉模型——不需要手动换模型、不会报错、不用重启。

> 基于 mimo2codex v0.5.5，原作者 [7as0nch](https://github.com/7as0nch)。核心代理的所有功劳归于原作者。本 fork 只加了一个杀手级功能：**视觉回退**。

## 视觉回退

很多强大模型（`mimo-v2.5-pro`、`deepseek-v4-pro`、`mimo-v2-flash`）不支持图片输入。你给它发张图就会报 `404: No endpoints found that support image input`。以前的方案是手动切模型——烦人且打断思路。

mimo-multi 把它做成透明的：

```
Codex 发图片 → mimo-multi 检测到 → 查模型能力 → 自动切到视觉模型
                       ↑
              [visual-fallback] deepseek-v4-pro → mimo-v2.5 (image detected)
```

- **能力路由**: 读取每个模型的 `supportsImages` 字段，而非硬编码名单
- **同 provider 优先**: MiMo pro/flash → `mimo-v2.5`；必要时间跨 provider 切换
- **Responses API**: 检测 `payload.input[].content[]` 中的 `input_image` 类型
- **Chat Completions API**: 检测 `payload.messages[].content[]` 中的 `image_url` 类型
- **零配置**: 开箱即用，无需任何设置
- **日志可见**: 代理日志中会显示 `[visual-fallback]` 信息，发生切换时一目了然

## 安装

### npm（全局安装）

```bash
npm install -g mimo-multi
```

需要 Node.js >= 18。

### Docker（一键部署）

```bash
git clone https://github.com/Yvesnihaohaode/mimo-multi.git
cd mimo-multi
cp .env.example .env   # 编辑 .env 填入 API Key
docker compose up -d
```

管理界面访问 `http://localhost:8788/admin`，数据持久化在 `./.mimo-multi/`。

预构建镜像即将上线 GitHub Container Registry。

## 快速开始

### 自动配置（推荐）

一条命令，无需手动编辑文件：

```bash
npm install -g mimo-multi
mimo-multi setup
```

配置向导会依次询问：
1. 选择默认模型（v2.5-pro / v2-pro / v2.5 / v2-omni / v2-flash）
2. 输入 MiMo API Key
3. 是否启用 1M 长上下文
4. 是否启用视觉自动回退（非视觉模型收到图片时自动切 v2.5）

`~/.codex/auth.json` 和 `~/.codex/config.toml` 自动生成——不用手动写 JSON/TOML，不会打错字、不会格式错误。

然后启动：

```bash
export MIMO_API_KEY=你的MiMo密钥
mimo-multi --port 8788
```

打开 Codex 就能用了。发张图试试，代理日志里会看到 `[visual-fallback]`。

### 手动配置

<details>
<summary>5 步手动配置（点击展开）</summary>

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

</details>

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
