# mimo2codex · 中文文档

> [English](./README.md) · 中文

让**最新版** OpenAI Codex CLI / Codex 桌面端无缝接入**小米 MiMo V2.5** 的本地代理。把 Codex 的 Responses API 实时翻译成 MiMo 的 Chat Completions API，纯本地无状态。

![mimo2codex 安装与启动](https://raw.githubusercontent.com/7as0nch/mimo2codex/main/images/npminstall.jpg)

## 解决什么问题

小米米莫官方 [Codex 集成文档](https://platform.xiaomimimo.com/docs/zh-CN/integration/codex) 只支持 `wire_api = "chat"`，而最新版 Codex 已经把这个开关变成硬错误。官方建议是降级 Codex 到 0.80.0——但会丢掉 pet 宠物、桌面端新功能、新工具。mimo2codex 在中间挂个本地代理，**Codex 用最新版、MiMo 服务端不变**，两边都不用改。

类似 [openrouter](https://openrouter.ai)、[claude-code-router](https://github.com/musistudio/claude-code-router)、[y-router](https://github.com/luohy15/y-router)——纯协议网关。

## 支持

- ✅ Codex CLI 0.x（`wire_api = "responses"`）+ 桌面端
- ✅ 工具调用——function tools、并行调用、`local_shell`、`custom`、MCP `namespace`
- ✅ 联网搜索——翻译成 MiMo 原生 `web_search` builtin（需在控制台激活 Web Search Plugin）
- ✅ 视觉——`mimo-v2.5` / `mimo-v2-omni` 走视觉路径；pro/flash 自动剥图 + 占位文本
- ✅ 1M 长上下文——传 `mimo-v2.5-pro[1m]`
- ✅ 思维链透传（`--no-reasoning` 隐藏）
- ✅ cc-switch 集成（`mimo2codex print-cc-switch` 输出粘贴片段）
- ⚠️ **`/hatch` 自定义宠物生成**——纯 MiMo 做不到。Codex 的 `/hatch` 在客户端硬编码调 OpenAI 的 `image_gen` 工具，这步代理拦不住；MiMo 自己又没有图像生成 endpoint。绕路方案走 `mimoskill/`（免费，不要 OpenAI key），见下文。

## 安装——任选一种

### 🟢 npm（最常用）

```bash
npm install -g mimo2codex
```

### 🟡 一键脚本（不需要全局安装）

```bash
curl -fsSL https://raw.githubusercontent.com/7as0nch/mimo2codex/main/scripts/install.sh | bash
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/7as0nch/mimo2codex/main/scripts/install.ps1 | iex
```

### 其他方式

- **git clone 手动构建**：`git clone https://github.com/7as0nch/mimo2codex && cd mimo2codex && npm install && npm run build`，想看源码 / 改代码用这个
- **`npm link`**：clone 完之后 `npm run build && npm link`，把本地仓库注册成全局命令，不用 publish

要求 Node.js ≥ 18。

## 使用

### 1. 拿一个 MiMo API Key

去 [platform.xiaomimimo.com](https://platform.xiaomimimo.com) → 控制台 → API Keys 创建。`sk-` 开头是按量付费，`tp-` 开头是 Token 套餐。

### 2. 启动代理

```bash
export MIMO_API_KEY=sk-xxxxxxxxxxxxxxxx
mimo2codex
```

启动横幅会直接打印好该贴到 `~/.codex/` 的 `auth.json` 和 `config.toml` 内容。默认走 auth.json 方式——CLI 和桌面端都能用，不依赖任何环境变量。

### 3. 配置 Codex

把启动横幅打的两段内容写到对应文件：

| 文件 | macOS / Linux | Windows |
|---|---|---|
| auth.json | `~/.codex/auth.json` | `%USERPROFILE%\.codex\auth.json` |
| config.toml | `~/.codex/config.toml` | `%USERPROFILE%\.codex\config.toml` |

### 4. 跑 Codex

```bash
codex
> 写一个 Python 计算斐波那契并保存到 fib.py
```

宠物、工具调用、思考过程、多轮对话都正常。`--no-reasoning` 可以不在终端显示思考。

> 桌面端如果没读到新 `auth.json`，**完全退出后重启**（托盘 → 退出，不只是关窗口）。

## 配合 cc-switch 使用

[cc-switch](https://github.com/farion1231/cc-switch) 是个跨平台桌面 App，专门管理 Claude Code / Codex / OpenCode / OpenClaw / Gemini CLI 的多供应商切换。它的 Codex 预设里没 MiMo（因为 MiMo 不支持 Responses API），mimo2codex 当桥用「自定义供应商」加进去：

1. 让 mimo2codex 一直跑（`MIMO_API_KEY=... mimo2codex`）
2. `mimo2codex print-cc-switch` 输出 `auth.json` + `config.toml` 两段文本
3. cc-switch GUI → **Codex** Tab → **+** → **自定义** → 把两段贴对应文本框 → 名称写 `MiMo (via mimo2codex)` → 添加
4. 点击新供应商激活——cc-switch 自动写 Codex 的配置文件。后续切回 OpenAI 官方 / Azure / OpenRouter 都是一键，mimo2codex 进程不需要重启，只在被路由到时收到流量。

cc-switch 的「获取模型」按钮调 `/v1/models`，mimo2codex 已实现——下拉里能直接选 `mimo-v2.5-pro` / `mimo-v2.5-pro[1m]` / `mimo-v2-flash`。

## CLI 参数速查

| 参数 | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| `--port`, `-p` | `MIMO2CODEX_PORT` | `8788` | 监听端口 |
| `--host` | `MIMO2CODEX_HOST` | `127.0.0.1` | 绑定地址 |
| `--base-url` | `MIMO_BASE_URL` | `https://api.xiaomimimo.com/v1` | Token 套餐改 `https://token-plan-cn.xiaomimimo.com/v1` |
| `--api-key` | `MIMO_API_KEY` | _必填_ | 上游 MiMo Key |
| `--no-reasoning` | `MIMO2CODEX_NO_REASONING=1` | 关 | 终端不显示思考（多轮工具调用仍回填给 MiMo） |
| `--verbose`, `-v` | `MIMO2CODEX_VERBOSE=1` | 关 | 打印每次翻译的请求体 |

子命令：

```bash
mimo2codex print-config             # 默认 auth.json + config.toml 两段
mimo2codex print-config --env-key   # 老的环境变量方式（仅 CLI 适用）
mimo2codex print-cc-switch          # cc-switch 自定义供应商片段
```

## 故障排查

<details>
<summary><b>报 <code>Missing environment variable: MIMO2CODEX_KEY</code></b></summary>

你 `config.toml` 还在用老的 `env_key = "MIMO2CODEX_KEY"`，桌面端不读 shell 环境变量。换成 auth.json 方式：把 `env_key = "..."` 改成 `requires_openai_auth = true`，再写 `~/.codex/auth.json` 为 `{"OPENAI_API_KEY": "mimo2codex-local"}`。或者直接 `mimo2codex print-config` 重新拿默认输出粘贴。

</details>

<details>
<summary><b>报 <code>404: No endpoints found that support image input</code></b></summary>

模型不支持图。MiMo 系列里只有 `mimo-v2.5` 和 `mimo-v2-omni` 接受图片。把 `config.toml` 的 model 换成这两个之一，或交给 mimo2codex 自动剥图（`mimo-v2.5-pro` / `-flash` 上自动加占位文本）。

</details>

<details>
<summary><b>报 <code>400: Param Incorrect: text is not set</code></b></summary>

MiMo 的图像 API 要求每条带图消息必须同时有 `text` part。mimo2codex 自动补一个空格——确保你是最新版（`npm update -g mimo2codex` 或 `git pull && npm run build`）。

</details>

<details>
<summary><b>生成宠物时 Codex 报 <code>image_gen tool not available</code></b></summary>

是 Codex 的 `/hatch` 想调 OpenAI 图像 API——MiMo 没有图像生成能力。改用仓库自带的 [`mimoskill/scripts/generate_pet.py`](./mimoskill/scripts/generate_pet.py)，默认走免费的 Pollinations.ai，**不需要任何 OpenAI key**。完整流程见 [mimoskill/SKILL.md](./mimoskill/SKILL.md)。

</details>

<details>
<summary><b>报 <code>stream disconnected before completion</code></b></summary>

老版本 bug——确保 ≥ 0.1.0。SSE 事件 data 里必须带 `type` 字段，老构建漏了。

</details>

<details>
<summary><b>日志被 <code>dropping unsupported tool type</code> 刷屏</b></summary>

已修——已知服务端工具（`code_interpreter`、`image_generation`、`computer_use` 等）默默丢弃；未知类型每个会话只 WARN 一次，不再每次请求都刷。

</details>

<details>
<summary><b>报 <code>400: web search tool found in the request body, but webSearchEnabled is false</b></summary>

是老版本。新版 mimo2codex 会自动捕获这个 400、剥掉 web_search 重试，并在本次进程里记住"插件未激活"，后续请求自动跳过 web_search——**不会再报错**。升到最新即可：`npm update -g mimo2codex`（或 `git pull && npm run build`）。

如果你**确实**想让联网搜索工作，去 [MiMo 控制台 → 插件管理](https://platform.xiaomimimo.com/#/console/plugin) 激活 Web Search Plugin（独立计费），然后重启 mimo2codex 即可。

</details>

<details>
<summary><b>Codex 说"我现在做 X"然后回合就结束了，没真调工具</b></summary>

MiMo 在多步 agentic 编码任务上的弱点——模型把 token 花在"叙述"上不真调工具。mimo2codex 默认强制 `parallel_tool_calls: true`（一回合多个工具调用），通常能缓解。

如果还是踩到，**最有效的技巧是改提示词**——用命令式替代"继续"：

> 不要解释，直接调 apply_patch 写完整文件内容

这种格式（具体指令 + 显式工具名 + "不要解释"）对 MiMo 的稳定性比"继续"高得多。

</details>

## mimoskill——填补 MiMo 的能力缺口

[mimoskill/](./mimoskill/) 是仓库根目录下一捆**辅助脚本 + 参考文档**。它存在的原因是有些事 MiMo 原生不支持（主要是图像生成），而 Codex 在客户端硬编码了一些能力假设，代理层压根改不动。

### 为啥要这玩意

| 问题 | mimo2codex 自己为啥搞不定 |
|---|---|
| `/hatch` 自定义宠物生成 | Codex 在**客户端**直接调 OpenAI 的 `image_gen` 工具——MiMo 没图像生成 endpoint，代理也没法假装有，因为 Codex 根本不把这个请求送到代理来。 |
| Codex 内的图片生成 | 同上，代理拦不住客户端硬编码。 |
| 在 Codex 之外直接调 MiMo | mimo2codex 是代理不是 SDK——一次性调用走脚本比启代理简单得多。 |
| MiMo 的各种坑（图必须配 text、`max_completion_tokens`、`reasoning_content` 多轮回填等） | 每写一次脚本都要重学这些坑很烦，脚本里已经全踩好了。 |

### 里面有啥

| 文件 | 作用 |
|---|---|
| `SKILL.md` | Skill 清单——给 Claude / Codex agent 读的，描述什么时候该调哪个脚本 |
| `scripts/mimo_chat.py` | 直接调 MiMo 的聊天 / 视觉 / 联网搜索，**纯标准库**（不用 `pip install openai`） |
| `scripts/generate_pet.py` | 图片生成：`auto` 模式没 OpenAI key 时走免费 Pollinations，有就走 `gpt-image-1`；也支持 Replicate / 本地 SD |
| `scripts/install_pet.sh` | 把生成的 PNG 装到 Codex 宠物目录（自动探测 macOS / Linux / Windows 路径） |
| `references/models.md` | MiMo 模型能力矩阵 + 字段坑 |
| `references/pet_workflow.md` | 宠物生成完整流程（单图 vs 多状态 bundle） |
| `assets/pet_prompt_template.md` | 调好的 chibi 贴纸风格提示词模板 |

### 三种用法

**1. 直接调用（普通用户，零配置）**

```bash
python3 mimoskill/scripts/mimo_chat.py "讲个笑话"
python3 mimoskill/scripts/mimo_chat.py --image src.jpg "描述这张图"
python3 mimoskill/scripts/generate_pet.py --description "chibi shiba 程序员" --out pet.png
bash mimoskill/scripts/install_pet.sh pet.png shiba
```

**2. 当 Claude Code 的 Skill 用**——把目录软链到 `~/.claude/skills/`：

```bash
ln -s "$(pwd)/mimoskill" ~/.claude/skills/mimoskill
```

之后 Claude 会自动读 `SKILL.md`，遇到相关任务（"帮我从这张图生成宠物"）会自己路由到对应脚本。

**3. 当 Codex agent 指南**——已经通过仓库根的 [AGENTS.md](./AGENTS.md) 接好了。Codex 每次启会话自动读 AGENTS.md，遇到生图 / 宠物相关任务会路由到 mimoskill 脚本，**不会再去 `pip install openai`**。

### 用 mimoskill 替代 `/hatch` 生成宠物

```bash
# 生成（免费——没 OpenAI key 时默认用 Pollinations.ai）
python3 mimoskill/scripts/generate_pet.py --description "chibi shiba 程序员" --out pet.png

# 安装
bash mimoskill/scripts/install_pet.sh pet.png shiba

# 完全退出 + 重启 Codex，宠物菜单里挑新的
```

想要更高质量，设 `PET_OPENAI_API_KEY=sk-真OpenAI-key`（跟 `MIMO_API_KEY` 完全独立——只用于这一次图片生成调用），`auto` 模式会自动切到 `gpt-image-1`。多状态动画 bundle 用 `--bundle DIR/`。完整流程：[mimoskill/SKILL.md](./mimoskill/SKILL.md)。

## 项目结构

![项目结构](https://raw.githubusercontent.com/7as0nch/mimo2codex/main/tutorial-video/assets/04-agent-docs.jpg)

```
src/                 # TypeScript 源码（cli、server、translate、upstream、util）
test/                # 46 个 vitest 用例
mimoskill/           # MiMo 辅助工具 + 宠物生成绕路方案
scripts/install.{sh,ps1}  # 一键安装脚本
dist/                # tsc 编译产物
AGENTS.md            # Codex agent 说明（不要装 openai，用 mimoskill）
PUBLISHING.md        # 维护者发布手册
```

## 开发

```bash
git clone https://github.com/7as0nch/mimo2codex && cd mimo2codex
npm install
npm run dev          # tsx 直接跑，不用构建
npm test             # 46 个 vitest
npm run build        # 产出 dist/
```

把本地代码注册成全局 `mimo2codex` 命令：`npm run build && npm link`。

## 许可证

MIT，见 [LICENSE](./LICENSE)。
