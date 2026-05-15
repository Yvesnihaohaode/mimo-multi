# .env 与一键加载脚本 · 分系统快速配置

> [English](./env-setup.md) · 中文
>
> 返回：[README 中文](../README.zh.md) · [README English](../README.md)

mimo2codex 把每个 provider 的 API key 都做成了**环境变量**——好处是不入库、不在配置文件里裸奔；坏处是每开一个新终端窗口都得重新 `export` 一遍。

mimo2codex 提供两种持久化方式，**普通用户用第一种就够了**：

| 方式 | 适合谁 | 谁负责加载 |
|---|---|---|
| **A. 内置 `.env` 自动加载**（推荐） | 装了 npm 包 / curl 一键安装的普通用户 | `mimo2codex` 自己——启动时自动读 `~/.mimo2codex/.env`，不需要任何额外步骤 |
| **B. 仓库脚本注入到 shell** | 拉了源码 + 同时还想给 codex / IDE / 其他工具用同一份 key 的高级用户 | 你自己 `source scripts/load-env.sh` / `. .\scripts\load-env.ps1`，env 进入当前 shell |

下面先讲 **A**，**B** 放在最后做对照。

## 它解决什么

- 不想每次开 shell 都重新 `export MIMO_API_KEY=... && export DS_API_KEY=...`
- 想把 MiMo / DeepSeek / Qwen / Kimi / OpenAI 等多家 key 放一个文件里集中管
- 不想 key 写进 `~/.zshrc` / PowerShell `$PROFILE` 里全局污染（也不想被备份工具同步到云端）
- 不想 key 被 `git commit` 误带上去（`.env` 已经在 `.gitignore` 里）

## 方式 A · 内置加载器（推荐，跨系统通用）

> 不需要拉仓库、不需要 source 任何东西。只要装好 `mimo2codex`，三行命令搞定。

```bash
mimo2codex init                           # 1. 在 ~/.mimo2codex/ 下生成 .env + .env.example
# 用任意编辑器编辑 ~/.mimo2codex/.env     # 2. 填入真 key
mimo2codex                                # 3. 启动；启动横幅会显示 "env file: ... (1 key: MIMO_API_KEY)"
```

**关键点：**

- `~/.mimo2codex/.env` 是 mimo2codex **每次启动**都会自动加载的文件——不依赖 shell、不依赖操作系统、桌面端启动也读得到（因为是 mimo2codex 进程内自己读，不靠 shell env 继承）
- Windows 上 `~/` 解析为 `%USERPROFILE%`，所以路径是 `C:\Users\<你>\.mimo2codex\.env`
- 第一次裸跑 `mimo2codex`（没 .env、shell 里也没 key）会自动给你建好 .env 并打印「编辑这个文件再 re-run」——所以 step 1 的 `init` 是可选的，**直接跑 `mimo2codex` 也行**
- 不想自动加载？加 `--no-load-env`，行为退回到老逻辑（只看 shell env）
- 自定义存放位置：`mimo2codex --data-dir /some/other/dir`，`.env` 会在那个目录

**`mimo2codex init` 详解：**

| 场景 | 行为 |
|---|---|
| 全新机器 | 创建 `~/.mimo2codex/`，写入 `.env.example`，把 `.env.example` 复制成 `.env` |
| 已有 `.env` | 只刷新 `.env.example`（追新 key 列表用），**不动**你的 `.env` |
| `--data-dir <path>` | 改写 `<path>/.env` 而不是默认目录 |

**老用户从 `export` 平滑迁移：** 如果你已经在 shell 里 `export MIMO_API_KEY=...`，且没建 `.env`，mimo2codex 探测到「shell 里有 key」就**不会**触发首次设置 bootstrap，沿用老的行为不打扰你。想迁移到 .env 文件，跑一次 `mimo2codex init`，然后把 `export` 行从 `.zshrc` 里删掉就行。

## 方式 B · 用仓库脚本注入到 shell（高级，可选）

适用场景：

- 你拉了源码（不是 npm 装的）
- 你**还想把 key 给其他工具用**（codex 命令本身已经不需要、用 auth.json 了；但比如你的脚本 / IDE / 第三方 CLI 想读同一份 key）

仓库根目录有一对脚本：`scripts/load-env.sh`（bash/zsh/Git Bash/WSL）+ `scripts/load-env.ps1`（Windows PowerShell）。它们做的事和方式 A 的内置加载器一样，但**注入到你的当前 shell**——所以你 source 完之后，从这个 shell 启动的任何工具都能读到 key。

### macOS / Linux（bash / zsh）

```bash
cp .env.example .env             # 仓库根目录
source scripts/load-env.sh
echo $MIMO_API_KEY               # 验证
mimo2codex
```

> ⚠️ 必须用 `source`（或等价的 `.`），**不能**直接 `bash scripts/load-env.sh` —— 直接执行会开子 shell，env 设完就丢。脚本里已经做了检测，错误执行会立刻报错退出。

### Windows PowerShell

```powershell
Copy-Item .env.example .env
. .\scripts\load-env.ps1         # 注意前面的点 `.` ——dot-source 语法
echo $env:MIMO_API_KEY
mimo2codex
```

**如果遇到「无法加载脚本，因为在此系统上禁止运行脚本」**：

```powershell
# 临时绕过（只对当前 PowerShell 窗口有效）
Set-ExecutionPolicy -Scope Process Bypass
. .\scripts\load-env.ps1

# 或者：单独解锁这个脚本
Unblock-File .\scripts\load-env.ps1
```

永久允许（仅对当前用户）：`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`。

### Windows Git Bash / WSL / Cygwin

和 macOS / Linux 一样走 `.sh` 脚本：`cp .env.example .env && source scripts/load-env.sh`。

### Windows cmd.exe（不推荐）

加载脚本不支持 cmd。要么切 PowerShell（按 `Win+X` → Windows PowerShell），要么**直接用方式 A**——`mimo2codex` 在 cmd 里也能跑，`.env` 自动加载和 shell 没关系。手动 `set` 兜底：

```cmd
set MIMO_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
mimo2codex
```

## `.env` 语法

脚本和 dotenv 系列工具基本一致，规则简单：

| 写法 | 行为 |
|---|---|
| `KEY=value` | 标准赋值 |
| `KEY="value"` / `KEY='value'` | 两端的引号会被剥掉，内部按字面量处理（**不**做 `$var` 展开、**不**做 `\n` 转义） |
| `# comment` 整行 | 跳过 |
| 空行 | 跳过 |
| `export KEY=value` | 兼容写法，等同于 `KEY=value` |
| 已经存在的同名 env | **覆盖**（`.env` 是 source of truth） |
| Windows CRLF 行尾 | bash 版会自动剥 `\r`，PowerShell 版由 `Get-Content` 处理 |
| 非法 key 名（含数字开头、特殊字符） | 跳过 + 打 warning |

完整带注释的可用 key 列表见 [.env.example](../.env.example)，主要包含：

- 内置 provider：`MIMO_API_KEY`、`DS_API_KEY` / `DEEPSEEK_API_KEY`
- 通用 provider 单实例：`GENERIC_BASE_URL` / `GENERIC_API_KEY` / `GENERIC_DEFAULT_MODEL`
- 通用 provider 多实例（看你的 `providers.json` 里 `envKey` 字段写了啥）：`QWEN_API_KEY` / `KIMI_API_KEY` / `GLM_API_KEY` / `OPENAI_API_KEY` …
- 运行时配置：`MIMO2CODEX_HOST` / `MIMO2CODEX_PORT` / `MIMO2CODEX_DATA_DIR` / `MIMO2CODEX_DEFAULT_PROVIDER` / `MIMO2CODEX_NO_REASONING` / `MIMO2CODEX_VERBOSE` / `MIMO2CODEX_NO_ADMIN` / `MIMO2CODEX_CONTEXT_OVERFLOW_MODE`

## 常见问题

<details>
<summary><b>方式 A 和方式 B 同时用会冲突吗？</b></summary>

不会。两边都是写 `process.env`，方式 A 由 mimo2codex 自己做（只影响 mimo2codex 进程），方式 B 由 shell 做（影响整个 shell + 后续启动的所有进程）。如果方式 B 已经 source 过、方式 A 又从 `~/.mimo2codex/.env` 读到同名 key——后读的（A）覆盖先读的（B），文件即真理。

通常没必要同时用。多数 npm 用户只用方式 A 就够。
</details>

<details>
<summary><b>用方式 A 还需要每次开新终端再做什么吗？</b></summary>

不用。**任何**启动 mimo2codex 的方式（shell 命令、桌面端 GUI、scheduler、systemd unit、Docker 入口）都会触发自动加载——因为是 mimo2codex 进程内自己读 `~/.mimo2codex/.env`，跟 shell 完全无关。

而方式 B（shell 脚本）才需要每次开新 shell 重新 source——因为它注入的是 shell 的 env。
</details>

<details>
<summary><b>方式 B：每次开新终端窗口都得重新 source？</b></summary>

是的——shell env 是 per-shell 的，关掉窗口就没了。如果你确实想全局可用，挑一种持久化方式：

- **macOS / Linux**：把 `source /path/to/mimo2codex/scripts/load-env.sh` 加到 `~/.zshrc` 或 `~/.bashrc` 末尾
- **PowerShell**：编辑 `$PROFILE`（`code $PROFILE` 或 `notepad $PROFILE`），加一行 `. C:\path\to\mimo2codex\scripts\load-env.ps1`

但这样做的代价是**所有**子进程都会读到你的 key —— 谨慎一点的做法是切到方式 A，那样只有 mimo2codex 自己读得到。
</details>

<details>
<summary><b>Codex 桌面端读不到我 source 的 env 怎么办？</b></summary>

桌面应用从 GUI（Dock、开始菜单）启动时**不继承 shell 环境变量**——这是方式 B 的根本限制，也是方式 A 存在的主要原因之一。

如果你受这个困扰，切到方式 A 就好：mimo2codex 自己读文件，跟桌面端怎么启动无关。

如果你坚持用方式 B，让桌面端从命令行启动（macOS：`open -a Codex`，Windows：`Start-Process codex`），那样会继承当前 shell 的 env。另外 mimo2codex 的默认输出本来就走 `auth.json` 方式（Codex 通过 `requires_openai_auth = true` 读 `~/.codex/auth.json`），不依赖 shell env——详见 [Configure Codex](../README.zh.md#3-配置-codex)。
</details>

<details>
<summary><b>能不能不暴露 key？只看脚本加载了哪些？</b></summary>

脚本设计就是**只打印 key 名，从来不打印 key 值**。`source scripts/load-env.sh` 输出形如：

```
load-env: 3 variable(s) loaded from .env
  - MIMO_API_KEY
  - DS_API_KEY
  - QWEN_API_KEY
```

值想看自己 `echo $MIMO_API_KEY`，但这意味着 key 会进 shell history —— 想避开就用 `printenv MIMO_API_KEY | head -c 10`（只看前 10 个字符）。
</details>

<details>
<summary><b>加载多个 .env 文件（dev / prod）？</b></summary>

脚本第一个参数就是文件路径：

```bash
source scripts/load-env.sh .env.dev      # bash
. .\scripts\load-env.ps1 .\.env.prod     # PowerShell
```

后加载的会**覆盖**先加载的同名 key——`.env` 自身就是这么处理的。
</details>

<details>
<summary><b>不小心把 .env 提交了怎么办？</b></summary>

`.gitignore` 已经挡了，但万一改名或被 `git add -f` 强制加进去：

```bash
git rm --cached .env       # 从索引里去掉，但保留本地文件
git commit -m "untrack .env"
```

如果已经 push 到远端，**立刻把所有泄露的 key 在各家控制台 revoke 重发**——历史里的内容用 `git filter-repo` / `bfg` 也能清，但已经 push 出去的就当泄露了。
</details>
