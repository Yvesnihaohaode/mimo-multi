# .env + one-shot loader scripts · per-OS quick setup

> English · [中文](./env-setup.zh.md)
>
> Back to: [README English](../README.md) · [README 中文](../README.zh.md)

mimo2codex reads every provider's API key from an **environment variable** — keys never touch the repo, never sit naked in a config file. The downside: each new shell window is a fresh `export`.

There are two ways to persist your keys; **most users want option A**:

| Option | For whom | Who loads the file |
|---|---|---|
| **A. Built-in `.env` auto-loader** (recommended) | Anyone who installed via npm / the curl one-liner | `mimo2codex` itself — it reads `~/.mimo2codex/.env` on every start, no extra step |
| **B. Repo loader scripts → inject into your shell** | You cloned the source AND want the same keys visible to other tools (codex CLI, IDE, your own scripts) | You, via `source scripts/load-env.sh` or `. .\scripts\load-env.ps1` |

Option A is covered first; option B is at the bottom for reference.

## What it solves

- You don't want to re-run `export MIMO_API_KEY=... && export DS_API_KEY=...` for every new shell
- You want MiMo / DeepSeek / Qwen / Kimi / OpenAI keys collected in one file
- You don't want keys living in `~/.zshrc` or your PowerShell `$PROFILE` (polluting every process, syncing to cloud backups)
- You don't want `git commit` to ever pick up a real key (`.env` is in `.gitignore`)

## Option A · Built-in loader (recommended, OS-agnostic)

> No clone, no `source`. With `mimo2codex` installed, three steps total.

```bash
mimo2codex init                           # 1. seeds ~/.mimo2codex/.env + .env.example
# edit ~/.mimo2codex/.env in any editor   # 2. fill in real keys
mimo2codex                                # 3. start — banner shows "env file: ... (1 key: MIMO_API_KEY)"
```

**Key points:**

- `~/.mimo2codex/.env` is auto-loaded on **every** `mimo2codex` start. It doesn't depend on the shell, the OS, or how the process was launched (CLI, desktop GUI shortcut, scheduler, systemd unit, Docker entrypoint all see it the same way — mimo2codex reads the file in-process)
- On Windows, `~/` resolves to `%USERPROFILE%`, so the path is `C:\Users\<you>\.mimo2codex\.env`
- First bare `mimo2codex` run (no .env, no key in shell env) auto-bootstraps the file and tells you to edit and re-run — so step 1 (`init`) is optional, **plain `mimo2codex` does the right thing too**
- Don't want auto-load? Pass `--no-load-env`, behavior reverts to "shell env only" (the pre-v0.2.8 behavior)
- Custom location: `mimo2codex --data-dir /some/other/dir` puts `.env` there

**`mimo2codex init` behavior:**

| Scenario | What happens |
|---|---|
| Fresh machine | Creates `~/.mimo2codex/`, writes `.env.example`, copies it to `.env` |
| `.env` already exists | Refreshes `.env.example` only (so you can diff for new keys); **leaves** your `.env` alone |
| `--data-dir <path>` | Targets `<path>/.env` instead of the default |

**Migrating from `export`:** if you already `export MIMO_API_KEY=...` in your shell and have no `.env`, mimo2codex detects the shell key and **skips** first-run bootstrap to avoid surprising you — it just uses your shell env. To switch to the file, run `mimo2codex init` once, then remove the `export` from your `.zshrc`.

## Option B · Repo loader scripts → inject into shell (advanced, optional)

When to use option B:

- You cloned the source (didn't `npm i -g`)
- You **want the same keys visible to other tools** — the codex CLI itself no longer needs them (it uses auth.json), but maybe your own scripts, IDE, or a third-party CLI does

The repo ships a pair of scripts: `scripts/load-env.sh` (bash/zsh/Git Bash/WSL) + `scripts/load-env.ps1` (Windows PowerShell). They do the same parsing as option A, but inject keys **into your current shell** so anything launched from that shell inherits them.

### macOS / Linux (bash / zsh)

```bash
cp .env.example .env             # repo root
source scripts/load-env.sh
echo $MIMO_API_KEY               # sanity check
mimo2codex
```

> ⚠️ You must `source` (or use `.`) — **don't** run `bash scripts/load-env.sh` directly. Direct execution spawns a child shell, sets the vars there, and they evaporate on exit. The script detects this and errors out.

### Windows PowerShell

```powershell
Copy-Item .env.example .env
. .\scripts\load-env.ps1         # mind the leading `. ` — dot-source syntax
echo $env:MIMO_API_KEY
mimo2codex
```

**If you hit "running scripts is disabled on this system"**:

```powershell
# Temporary bypass — current PowerShell window only
Set-ExecutionPolicy -Scope Process Bypass
. .\scripts\load-env.ps1

# Or: unblock just this one script
Unblock-File .\scripts\load-env.ps1
```

To allow scripts permanently for your user: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Windows Git Bash / WSL / Cygwin

Same as macOS / Linux: `cp .env.example .env && source scripts/load-env.sh`.

### Windows cmd.exe (not recommended)

The loader scripts don't support cmd. Either switch to PowerShell (`Win+X` → Windows PowerShell), or **just use option A** — `mimo2codex` runs fine under cmd and the `.env` auto-load doesn't care about the parent shell. As a manual fallback:

```cmd
set MIMO_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
mimo2codex
```

## `.env` syntax

The loaders follow the conventional dotenv rules:

| Form | Behavior |
|---|---|
| `KEY=value` | Standard assignment |
| `KEY="value"` / `KEY='value'` | Surrounding quotes stripped; content is literal (**no** `$var` expansion, **no** `\n` escapes) |
| `# comment` on its own line | Skipped |
| Blank line | Skipped |
| `export KEY=value` | Tolerated for compatibility — equivalent to `KEY=value` |
| Already-set env var with the same name | **Overwritten** (`.env` is the source of truth) |
| Windows CRLF line endings | bash loader auto-strips `\r`; PowerShell loader handles via `Get-Content` |
| Invalid key name (starts with digit, special chars) | Skipped with a warning |

For the full annotated list of usable keys see [.env.example](../.env.example), which covers:

- Built-in providers: `MIMO_API_KEY`, `DS_API_KEY` / `DEEPSEEK_API_KEY`
- Generic provider, single-instance form: `GENERIC_BASE_URL` / `GENERIC_API_KEY` / `GENERIC_DEFAULT_MODEL`
- Generic provider, multi-instance (matching the `envKey` field in your `providers.json`): `QWEN_API_KEY` / `KIMI_API_KEY` / `GLM_API_KEY` / `OPENAI_API_KEY` …
- Runtime config: `MIMO2CODEX_HOST` / `MIMO2CODEX_PORT` / `MIMO2CODEX_DATA_DIR` / `MIMO2CODEX_DEFAULT_PROVIDER` / `MIMO2CODEX_NO_REASONING` / `MIMO2CODEX_VERBOSE` / `MIMO2CODEX_NO_ADMIN` / `MIMO2CODEX_CONTEXT_OVERFLOW_MODE`

## FAQ

<details>
<summary><b>Can I use options A and B together? Do they conflict?</b></summary>

No conflict. Both write into `process.env`. Option A runs inside the mimo2codex process (only affects mimo2codex itself); option B runs in your shell (affects every subsequent process). If both happen and they declare the same key, whichever runs later wins (A runs later because mimo2codex starts after option B's source).

There's usually no reason to use both. Most npm users only need option A.
</details>

<details>
<summary><b>With option A, do I need to do anything in each new terminal?</b></summary>

No. **Any** way of starting mimo2codex (shell command, desktop GUI shortcut, scheduler, systemd unit, Docker entrypoint) triggers auto-load — because mimo2codex reads `~/.mimo2codex/.env` itself, not via shell env inheritance.

Option B (the shell scripts) is what needs re-sourcing per new shell — that's what injects into shell env.
</details>

<details>
<summary><b>Option B: do I really have to source it every new terminal?</b></summary>

Yes — shell env vars are per-shell, gone when the window closes. To persist:

- **macOS / Linux**: append `source /path/to/mimo2codex/scripts/load-env.sh` to `~/.zshrc` or `~/.bashrc`
- **PowerShell**: edit `$PROFILE` (`code $PROFILE` or `notepad $PROFILE`) and add `. C:\path\to\mimo2codex\scripts\load-env.ps1`

The trade-off: **every** child process from that shell sees your keys. The conservative alternative is to switch to option A — only mimo2codex itself sees them.
</details>

<details>
<summary><b>Codex desktop doesn't see the env vars I sourced. What gives?</b></summary>

GUI-launched desktop apps (Dock, Start menu) **don't inherit your shell environment** — that's the fundamental limitation option B can't solve, and a major reason option A exists.

If you're hit by this, switch to option A: mimo2codex reads its own file regardless of how the desktop app was launched.

If you stick with option B, launch the desktop app from the command line (macOS: `open -a Codex`, Windows: `Start-Process codex`) so it inherits the current shell's env. Note that mimo2codex's default `print-config` output uses the `auth.json` flow (`requires_openai_auth = true` makes Codex read `~/.codex/auth.json`) and doesn't need shell env at all — see [Configure Codex](../README.md#3-configure-codex).
</details>

<details>
<summary><b>Can I see what got loaded without exposing the values?</b></summary>

The scripts only ever print **key names, never values**. `source scripts/load-env.sh` outputs:

```
load-env: 3 variable(s) loaded from .env
  - MIMO_API_KEY
  - DS_API_KEY
  - QWEN_API_KEY
```

If you want to inspect a value, `echo $MIMO_API_KEY` works but writes the key into shell history. A safer probe: `printenv MIMO_API_KEY | head -c 10` (first 10 characters only).
</details>

<details>
<summary><b>Load multiple .env files (dev / prod)?</b></summary>

The first arg to either script is the file path:

```bash
source scripts/load-env.sh .env.dev      # bash
. .\scripts\load-env.ps1 .\.env.prod     # PowerShell
```

Later sources **override** earlier ones for same-named keys — the same way `.env` itself overrides pre-existing env.
</details>

<details>
<summary><b>I accidentally committed .env. Help.</b></summary>

`.gitignore` catches it by default, but if you renamed it or `git add -f`-ed it in:

```bash
git rm --cached .env       # remove from index, keep the local file
git commit -m "untrack .env"
```

If you already pushed, **immediately revoke and reissue every leaked key** in each provider's console. You can purge history with `git filter-repo` / `bfg`, but anything that was once on the public remote should be considered leaked.
</details>
