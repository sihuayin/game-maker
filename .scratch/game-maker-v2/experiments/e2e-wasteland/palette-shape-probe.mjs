// 票 23 的探针 ⑤（2026-10-10）：顶层 `palette` 到底是「手气差」还是「这名字系统性翻车」。
//
// 已确立的事实（第四次真跑 · `raw/run-2026-10-10.json`）：理解层第 1 步 `analyze-reference`
// **3 发重采样全灭**，病因**三次一模一样**：`palette: Invalid input: expected object, received array`。
// 而免费探针已证明**声明是对的**：
//   顶层 `palette` → JSON schema `type: "object"`（六桶全 required、`additionalProperties: false`）
//   `style.palette` → JSON schema `type: "array"`（`^#[0-9a-f]{6}$`）
// ⇒ 模型是在违反一份**写明了 object** 的声明。
//
// ⚠️ 前三跑这一步**全过**（第二跑是 1 次 schema 失败后过）⇒ n=1 判断不了。本探针量**命中率**。
//
// 做法（照 `coreloop-name-probe.mjs` 那个法子，只差一处）：
//   ① 先借**出货的 `analyzeReference`** 造出**一模一样**的请求体 ——
//      ⚠️ 抓包用的 `fetchImpl` **直接抛**，所以这一步**一次上游调用都不发**（零成本）。
//   ② 把那份 body 原样**重放 N 次**，逐发看顶层 `palette` 与 `style.palette` 的形状。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/palette-shape-probe.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const RAW = path.join(HERE, "raw", "palette-shape");
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(RAW, { recursive: true });

const N = process.env["PROBE_DRY"] === "1" ? 0 : 6;
const STYLE_REL = "fixtures/e2e/wasteland-platformer/style.png";
const BASE = process.env["ANTHROPIC_BASE_URL"];
const TOKEN = process.env["ANTHROPIC_AUTH_TOKEN"];
const MODEL = process.env["ANTHROPIC_MODEL"] ?? "(未设)";

const { analyzeReference } = await import(pathToFileURL(path.join(ROOT, "packages/vision/dist/index.js")).href);
const { styleIdOf } = await import(pathToFileURL(path.join(ROOT, "packages/pipeline/dist/index.js")).href);
const { VisualWorldSpecSchema } = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);

// ── ① 造请求体（零上游调用）───────────────────────────────────────────────────
let captured;
try {
  await analyzeReference({
    styleReferences: [{ path: STYLE_REL, role: "global" }],
    requirementText: fs.readFileSync(path.join(ROOT, "fixtures/e2e/wasteland-platformer/intent.md"), "utf8"),
    styleId: styleIdOf(STYLE_REL),
    cwd: ROOT,
    transport: { baseUrl: BASE, apiKey: TOKEN },
    fetchImpl: async (_u, init) => { captured = init.body; throw new Error("capture-only（本探针不发这一次）"); },
  });
} catch { /* 预期：抓完就抛 */ }
if (captured === undefined) throw new Error("没抓到请求体 —— analyzeReference 的构造路径变了？");
fs.writeFileSync(path.join(RAW, "01.request.json"), captured);

const body = JSON.parse(captured);
const ModelFacing = VisualWorldSpecSchema.omit({ styleReferences: true });
console.log(`模型 ${MODEL} · 上游 ${BASE}`);
console.log(`请求体已抓：${captured.length} 字节（提示词 + 工具 schema 逐字节就是链上那一份）`);
console.log(`重放 N=${N}\n`);

const kindOf = (v) => (Array.isArray(v) ? "array" : v === undefined ? "缺席" : v === null ? "null" : typeof v);
const summary = { 顶层palette: {}, style_palette: {}, 整体过schema: { ok: 0, bad: 0 }, 病由: {}, 逐发: [] };

for (let i = 1; i <= N; i++) {
  const res = await fetch(`${BASE}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": TOKEN, "anthropic-version": "2023-06-01" },
    body: captured,
  });
  const txt = await res.text();
  fs.writeFileSync(path.join(RAW, `02.replay.${i}.json`), txt);

  let doc;
  try { doc = JSON.parse(txt); } catch { summary.逐发.push({ i, 上游: "非 JSON" }); continue; }
  const input = doc.content?.find?.((c) => c.type === "tool_use")?.input;

  const top = kindOf(input?.palette);
  const stylePal = kindOf(input?.style?.palette);
  summary.顶层palette[top] = (summary.顶层palette[top] ?? 0) + 1;
  summary.style_palette[stylePal] = (summary.style_palette[stylePal] ?? 0) + 1;

  const r = input === undefined ? { success: false } : ModelFacing.safeParse(input);
  let why = "";
  if (r.success) summary.整体过schema.ok += 1;
  else {
    summary.整体过schema.bad += 1;
    why = (r.error?.issues ?? []).slice(0, 2).map((x) => `${(x.path ?? []).join(".")}: ${x.message}`).join("；");
    summary.病由[why] = (summary.病由[why] ?? 0) + 1;
  }
  summary.逐发.push({ i, 顶层palette: top, style_palette: stylePal, 过schema: r.success, 病由: why });
  console.log(`  ${i}. 顶层 palette=${top.padEnd(6)} style.palette=${stylePal.padEnd(6)} 过 schema=${r.success ? "✅" : "❌ " + why}`);
}

fs.writeFileSync(path.join(RAW, "summary.json"), JSON.stringify(summary, null, 1));
console.log(`\n=== 汇总 ===`);
console.log(`顶层 palette 形状   ：${JSON.stringify(summary.顶层palette)}`);
console.log(`style.palette 形状  ：${JSON.stringify(summary.style_palette)}`);
console.log(`整体过 schema       ：${JSON.stringify(summary.整体过schema)}`);
console.log(`\n原始落在 ${path.relative(ROOT, RAW)}/`);
