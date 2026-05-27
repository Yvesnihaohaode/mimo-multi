import { createInterface } from "node:readline";
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Model options ──────────────────────────────────────────────────────────

interface ModelOption {
  id: string;
  label: string;
  desc: string;
  ctx: number;
  maxOut: number;
  vision: boolean;
}

const MODELS: ModelOption[] = [
  {
    id: "mimo-v2.5-pro",
    label: "MiMo V2.5 Pro",
    desc: "最强，推理增强，非视觉",
    ctx: 1_000_000,
    maxOut: 131_072,
    vision: false,
  },
  {
    id: "mimo-v2-pro",
    label: "MiMo V2 Pro",
    desc: "均衡，推理增强，非视觉",
    ctx: 1_000_000,
    maxOut: 131_072,
    vision: false,
  },
  {
    id: "mimo-v2.5",
    label: "MiMo V2.5",
    desc: "视觉模型，支持图片输入",
    ctx: 1_000_000,
    maxOut: 32_768,
    vision: true,
  },
  {
    id: "mimo-v2-omni",
    label: "MiMo V2 Omni",
    desc: "视觉+音频，全模态",
    ctx: 1_000_000,
    maxOut: 32_768,
    vision: true,
  },
  {
    id: "mimo-v2-flash",
    label: "MiMo V2 Flash",
    desc: "快速响应，非视觉",
    ctx: 1_000_000,
    maxOut: 65_536,
    vision: false,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function codexDir(): string {
  return join(homedir(), ".codex");
}

function authPath(): string {
  return join(codexDir(), "auth.json");
}

function configPath(): string {
  return join(codexDir(), "config.toml");
}

function question(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

// ─── Main wizard ────────────────────────────────────────────────────────────

export async function runSetupWizard(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  if (!process.stdin.isTTY) {
    console.error("error: setup requires an interactive terminal (TTY).");
    process.exit(2);
  }

  console.log("");
  console.log("  🎯  mimo-multi 自动配置");
  console.log("  ──────────────────────────────────────────");
  console.log("");
  console.log("  本向导将自动生成 Codex 的配置文件，");
  console.log("  免除手动编辑 JSON / TOML 的麻烦。");
  console.log("");

  // ── Step 1: Model selection ──
  console.log("  选择默认模型：");
  console.log("");
  for (let i = 0; i < MODELS.length; i++) {
    const m = MODELS[i];
    const marker = i === 0 ? " ← 默认" : "";
    console.log(`    ${i + 1}. ${m.id}${marker}`);
    console.log(`       ${m.desc} | ${(m.ctx / 1_000_000).toFixed(0)}M 上下文 | ${(m.maxOut / 1024).toFixed(0)}K 最大输出`);
  }
  console.log("");

  const modelChoice = await question(rl, "  请输入序号 [1]: ");
  const modelIndex = modelChoice ? parseInt(modelChoice, 10) - 1 : 0;
  const selectedModel =
    modelIndex >= 0 && modelIndex < MODELS.length ? MODELS[modelIndex] : MODELS[0];
  console.log(`  → ${selectedModel.id}`);
  console.log("");

  // ── Step 2: API Key ──
  const apiKey = await question(rl, "  🔑 MiMo API Key: ");
  if (!apiKey) {
    console.log("");
    console.error("  ⚠️  API Key 不能为空，已取消。");
    process.exit(2);
  }
  const masked = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "****";
  console.log(`  → ${masked}`);
  console.log("");

  // ── Step 3: 1M context ──
  const ctxChoice = await question(rl, "  📐 启用 1M 长上下文？[Y/n]: ");
  const useFullCtx = ctxChoice.toLowerCase() !== "n";
  console.log(`  → ${useFullCtx ? "是" : "否"}`);
  console.log("");

  // ── Step 4: Visual fallback ──
  let useVisualFallback = true;
  if (!selectedModel.vision) {
    const vfChoice = await question(rl, "  🖼️  启用视觉自动回退？（非视觉模型收到图片时自动切 v2.5）[Y/n]: ");
    useVisualFallback = vfChoice.toLowerCase() !== "n";
    console.log(`  → ${useVisualFallback ? "是" : "否"}`);
    console.log("");
  }

  // ── Write files ──
  const dir = codexDir();
  mkdirSync(dir, { recursive: true });

  // Backup existing files
  for (const p of [authPath(), configPath()]) {
    if (existsSync(p)) {
      const bak = p + ".bak";
      copyFileSync(p, bak);
      console.log(`  📋 已备份: ${p} → ${bak}`);
    }
  }

  const host = "127.0.0.1";
  const port = 8788;

  // auth.json
  const authJson = JSON.stringify({ OPENAI_API_KEY: "mimo-multi-local" }, null, 2) + "\n";
  writeFileSync(authPath(), authJson, "utf-8");

  // config.toml
  const ctxLine = useFullCtx ? `\nmodel_context_window = ${selectedModel.ctx}` : "";
  const maxOutLine = `\nmodel_max_output_tokens = ${selectedModel.maxOut}`;
  const configToml = `model = "${selectedModel.id}"
model_provider = "mimo"${ctxLine}${maxOutLine}

# Switch model — replace the two lines above with one of the entries below.
# Available MiMo models:
#   model = "mimo-v2.5-pro"    model_context_window = 1000000   model_max_output_tokens = 131072
#   model = "mimo-v2-pro"      model_context_window = 1000000   model_max_output_tokens = 131072
#   model = "mimo-v2.5"        model_context_window = 1000000   model_max_output_tokens = 32768
#   model = "mimo-v2-omni"     model_context_window = 1000000   model_max_output_tokens = 32768
#   model = "mimo-v2-flash"    model_context_window = 1000000   model_max_output_tokens = 65536

[model_providers.mimo]
name = "MiMo (via mimo-multi)"
base_url = "http://${host}:${port}/v1"
wire_api = "responses"
requires_openai_auth = true
request_max_retries = 1
`;
  writeFileSync(configPath(), configToml, "utf-8");

  // ── Done ──
  console.log("  ✅ 配置完成！");
  console.log("");
  console.log(`  ~/.codex/auth.json   → 已写入`);
  console.log(`  ~/.codex/config.toml → 已写入（模型: ${selectedModel.id}）`);
  console.log("");

  if (useVisualFallback && !selectedModel.vision) {
    console.log("  🖼️  视觉自动回退已就绪：发送图片时自动切换 mimo-v2.5");
    console.log("");
  }

  console.log("  启动方式：");
  console.log("");
  console.log(`  MIMO_API_KEY=${masked} mimo-multi --port ${port}`);
  console.log("  # 或一键启动：");
  console.log("  start-codex-mimo");
  console.log("");

  rl.close();
}
