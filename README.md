# mimo2codex

> English · [中文文档](./README.zh.md)

Local proxy that lets the **latest OpenAI Codex CLI / desktop** talk to **Xiaomi MiMo V2.5**, by translating Codex's Responses API ↔ MiMo's Chat Completions API on the fly. Stateless, no telemetry, runs on `127.0.0.1`.

![mimo2codex install + run](https://raw.githubusercontent.com/7as0nch/mimo2codex/main/images/%E4%BD%BF%E7%94%A8%E6%95%99%E7%A8%8B.jpg)

## Why

MiMo's [official Codex doc](https://platform.xiaomimimo.com/docs/zh-CN/integration/codex) only supports `wire_api = "chat"`, but newer Codex versions hard-error on it (the official workaround is to downgrade Codex, losing pets, the new desktop release and tool fixes). mimo2codex fixes this without touching either side: keep Codex on latest, run mimo2codex locally, Codex thinks it's talking to a native Responses backend.

Conceptually a sibling of [openrouter](https://openrouter.ai), [claude-code-router](https://github.com/musistudio/claude-code-router), [y-router](https://github.com/luohy15/y-router) — a thin protocol shim.

## What works

- ✅ Codex CLI `wire_api = "responses"` and Codex desktop app
- ✅ Tool calling — function tools, parallel calls, `local_shell`, `custom`, MCP `namespace`
- ✅ Web search — translated to MiMo's native `web_search` builtin (requires plugin activation)
- ✅ Vision — only `mimo-v2.5` and `mimo-v2-omni`; pro/flash auto-strip images with a placeholder
- ✅ 1M context — pass `mimo-v2.5-pro[1m]`
- ✅ Reasoning passthrough (with `--no-reasoning` to hide)
- ✅ cc-switch integration (`mimo2codex print-cc-switch` outputs paste-ready snippets)
- ⚠️ **`/hatch` custom pet generation** — pure MiMo can't do this. Codex's `/hatch` is hardcoded to call OpenAI's `image_gen` tool client-side, and we can't intercept that from the proxy layer. MiMo also has no image-generation endpoint. Workaround via `mimoskill/` (free, no OpenAI key required) — see below.

## Install — pick one

### 🟢 npm (most users)

```bash
npm install -g mimo2codex
```

### 🟡 curl one-liner (no global install)

```bash
curl -fsSL https://raw.githubusercontent.com/7as0nch/mimo2codex/main/scripts/install.sh | bash
```

PowerShell on Windows:

```powershell
irm https://raw.githubusercontent.com/7as0nch/mimo2codex/main/scripts/install.ps1 | iex
```

### Other paths

- **Git clone + manual** — `git clone https://github.com/7as0nch/mimo2codex && cd mimo2codex && npm install && npm run build`. Use this if you want to hack on the source.
- **`npm link`** — after a clone, `npm run build && npm link` registers `mimo2codex` globally without publishing.

Requires Node.js ≥ 18.

## Use

### 1. Get a MiMo API key

[platform.xiaomimimo.com](https://platform.xiaomimimo.com) → Console → API Keys. Either pay-as-you-go (`sk-xxx`) or token-plan (`tp-xxx`).

### 2. Start the proxy

```bash
export MIMO_API_KEY=sk-xxxxxxxxxxxxxxxx
mimo2codex
```

The startup banner prints the exact `auth.json` + `config.toml` snippets to paste into `~/.codex/`. Default works for both Codex CLI and desktop without any env-var dance.

### 3. Configure Codex

Copy the printed snippets to:

| | macOS / Linux | Windows |
|---|---|---|
| auth.json | `~/.codex/auth.json` | `%USERPROFILE%\.codex\auth.json` |
| config.toml | `~/.codex/config.toml` | `%USERPROFILE%\.codex\config.toml` |

### 4. Run Codex

```bash
codex
> Write a Python fibonacci function and save it to fib.py
```

Pet, tool calls, reasoning, multi-turn — all just work. Pass `--no-reasoning` if you want to hide thinking from the terminal.

> If Codex desktop ignores the new `auth.json`, **fully quit it** (system tray → Quit) and relaunch.

## Use with cc-switch

[cc-switch](https://github.com/farion1231/cc-switch) is a desktop app for switching between Claude Code / Codex / OpenCode providers in one click. Its built-in Codex preset list doesn't include MiMo, but mimo2codex slots in as a custom provider:

1. Keep mimo2codex running (`MIMO_API_KEY=... mimo2codex`)
2. `mimo2codex print-cc-switch` — outputs `auth.json` + `config.toml` text blocks
3. cc-switch GUI → **Codex** tab → **+** → **Custom** → paste both blocks → name it `MiMo (via mimo2codex)` → **Add**
4. Click the new provider to activate it; cc-switch writes Codex's config files for you. Switch back to OpenAI / Azure / OpenRouter anytime — mimo2codex keeps running and only gets traffic when its provider is active.

cc-switch's "Fetch Models" button calls `/v1/models`, which mimo2codex implements — the dropdown auto-lists `mimo-v2.5-pro`, `mimo-v2.5-pro[1m]`, `mimo-v2-flash`.

## CLI flags

| Flag | Env | Default | Notes |
|---|---|---|---|
| `--port`, `-p` | `MIMO2CODEX_PORT` | `8788` | listen port |
| `--host` | `MIMO2CODEX_HOST` | `127.0.0.1` | bind host |
| `--base-url` | `MIMO_BASE_URL` | `https://api.xiaomimimo.com/v1` | use `https://token-plan-cn.xiaomimimo.com/v1` for `tp-*` keys |
| `--api-key` | `MIMO_API_KEY` | _required_ | upstream MiMo key |
| `--no-reasoning` | `MIMO2CODEX_NO_REASONING=1` | off | hide reasoning from Codex (still preserved between turns) |
| `--verbose`, `-v` | `MIMO2CODEX_VERBOSE=1` | off | log every translated request body |

Subcommands:

```bash
mimo2codex print-config             # ~/.codex/config.toml + auth.json snippets
mimo2codex print-config --env-key   # legacy env-var variant (CLI only)
mimo2codex print-cc-switch          # cc-switch paste blocks
```

## Troubleshooting

<details>
<summary><b>Missing environment variable: <code>MIMO2CODEX_KEY</code></b></summary>

Your `config.toml` has the legacy `env_key = "MIMO2CODEX_KEY"` line. Codex desktop doesn't inherit shell env vars. Switch to the auth.json variant: replace `env_key = "..."` with `requires_openai_auth = true` and write `~/.codex/auth.json` with `{"OPENAI_API_KEY": "mimo2codex-local"}`. Or just rerun `mimo2codex print-config` and paste the new default output.

</details>

<details>
<summary><b>MiMo returned 404: No endpoints found that support image input</b></summary>

You sent images on a model that doesn't support vision. Only `mimo-v2.5` and `mimo-v2-omni` accept images. Switch model in `config.toml` to one of those, or let mimo2codex auto-strip (it already does on `mimo-v2.5-pro`/`-flash` — placeholder text replaces the image).

</details>

<details>
<summary><b>MiMo returned 400: Param Incorrect: <code>text</code> is not set</b></summary>

MiMo's image API requires every image-bearing message to include a `text` part. mimo2codex auto-injects a single space when missing — make sure you're on the latest version (`npm update -g mimo2codex` or `git pull && npm run build`).

</details>

<details>
<summary><b>Codex shows <code>image_gen tool not available</code> when generating a pet</b></summary>

That's Codex's `/hatch` trying to call OpenAI's image API. MiMo doesn't have image generation. Use [`mimoskill/scripts/generate_pet.py`](./mimoskill/scripts/generate_pet.py) instead — defaults to free Pollinations.ai, no extra key needed. See [mimoskill/SKILL.md](./mimoskill/SKILL.md).

</details>

<details>
<summary><b>Stream disconnected before completion</b></summary>

Old version bug — make sure you're on >= 0.1.0. Each SSE event must have <code>type</code> in its data payload; older builds were missing it.

</details>

<details>
<summary><b>Logs spammed with <code>dropping unsupported tool type</code></b></summary>

Already fixed — known server-side tools (`code_interpreter`, `image_generation`, `computer_use`, etc.) are silently dropped at debug level. Unknown types warn once per session, not per request.

</details>

## mimoskill — fill MiMo's gaps

[mimoskill/](./mimoskill/) is a bundle of helper scripts + reference docs at the project root. It exists because some things MiMo just doesn't do natively (mainly: image generation), and Codex hardcodes a few capability assumptions on the client side that the proxy can't override.

### Why it exists

| Problem | Why mimo2codex alone can't fix it |
|---|---|
| `/hatch` custom pet generation | Codex calls OpenAI's `image_gen` tool **client-side**. MiMo has no image-gen endpoint, and we can't fake one in the proxy because Codex won't ship the request through us — it tries to talk to OpenAI directly with the auth.json key. |
| In-Codex image generation in general | Same reason. |
| Direct MiMo calls outside Codex | mimo2codex is a proxy, not an SDK — bare scripts are easier than spinning up the proxy for one-off calls. |
| Quirks like image+text pairing, `max_completion_tokens`, `reasoning_content` re-injection | Repeating these every time you write a script wastes your time; the helper scripts encode them already. |

### What's in it

| File | Purpose |
|---|---|
| `SKILL.md` | Skill manifest read by Claude / Codex agents — describes when to invoke each script |
| `scripts/mimo_chat.py` | Direct chat / vision / web-search call to MiMo, **stdlib-only** (no `pip install openai`) |
| `scripts/generate_pet.py` | Image generation: `auto` mode picks free Pollinations when no OpenAI key, else `gpt-image-1`. Also supports Replicate / local SD. |
| `scripts/install_pet.sh` | Install the generated PNG into Codex's pet directory (probes macOS/Linux/Windows paths) |
| `references/models.md` | MiMo capability matrix + field quirks |
| `references/pet_workflow.md` | Pet generation walkthrough (single image vs animated bundle) |
| `assets/pet_prompt_template.md` | Tuned chibi-sticker prompt templates |

### Three ways to use it

**1. Direct invocation (any user, no setup)**

```bash
python3 mimoskill/scripts/mimo_chat.py "tell me a joke"
python3 mimoskill/scripts/mimo_chat.py --image src.jpg "describe this"
python3 mimoskill/scripts/generate_pet.py --description "chibi shiba dev" --out pet.png
bash mimoskill/scripts/install_pet.sh pet.png shiba
```

**2. As a Claude Code skill** — symlink the directory into `~/.claude/skills/`:

```bash
ln -s "$(pwd)/mimoskill" ~/.claude/skills/mimoskill
```

Claude reads `SKILL.md` and routes relevant requests (e.g. "generate a pet from this image") to the right scripts automatically.

**3. As a Codex agent guide** — already wired via [AGENTS.md](./AGENTS.md). Codex reads it on each session and routes image-gen / pet tasks to mimoskill scripts instead of trying to `pip install openai`.

### Generating a `/hatch` replacement pet

```bash
# Generate (free — defaults to Pollinations.ai when no OpenAI key is set)
python3 mimoskill/scripts/generate_pet.py --description "chibi shiba coder" --out pet.png

# Install
bash mimoskill/scripts/install_pet.sh pet.png shiba

# Fully quit + relaunch Codex, pick the new pet from the picker
```

For higher quality, set `PET_OPENAI_API_KEY=sk-real-openai-key` (separate from `MIMO_API_KEY` — used only for the image gen call) and `auto` mode switches to `gpt-image-1`. Animated multi-state bundles via `--bundle DIR/`. Full guide: [mimoskill/SKILL.md](./mimoskill/SKILL.md).

## Project layout

![Project structure](https://raw.githubusercontent.com/7as0nch/mimo2codex/main/tutorial-video/assets/04-agent-docs.jpg)

```
src/                 # TypeScript source (cli, server, translate, upstream, util)
test/                # 46 vitest tests
mimoskill/           # MiMo helpers + pet generation workaround
scripts/install.{sh,ps1}  # one-liner bootstrap
dist/                # tsc output (generated)
AGENTS.md            # Codex-agent instructions (don't import openai, use mimoskill)
PUBLISHING.md        # maintainer release runbook
```

## Develop

```bash
git clone https://github.com/7as0nch/mimo2codex && cd mimo2codex
npm install
npm run dev          # tsx, no build step
npm test             # 46 vitest cases
npm run build        # produces dist/
```

To register `mimo2codex` globally from your local checkout: `npm run build && npm link`.

## License

MIT — see [LICENSE](./LICENSE).
