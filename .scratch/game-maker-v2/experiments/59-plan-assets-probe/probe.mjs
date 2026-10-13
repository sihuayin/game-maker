// 票 59 的**定向探针** —— `plan-assets` 这一步的 `empty-input` 到底可不可重复。
//
// ⚠️ 人裁（2026-10-13）的执行约束，逐条落在下面：
//   ① 先跑 3 发；只要有 1 发成功即停，记实际的 n 与空输入数 k
//   ② 前 3 发全空 ⇒ 再补 3 发，**最多 6 发，不追加**
//   ③ **每发独立调用**，不走 `planAssets` 那条自带 3 发重采样的路
//   ④ 保存**原始响应体**，尽量辨别模型有没有输出正文/`thinking`、`stop_reason` 是什么
//   ⑤ 出现其他类型的失败 ⇒ 按预定规则停止，**不混为** `empty-input`
//   ⑥ 检查落盘内容的密钥泄漏风险
//
// ⚠️ **本脚本一行都不改上游**：模型名 / `max_tokens` / 提示词 / 工具 schema
//   全部**照抄** `packages/assets/src/ops.ts:planAssets` 那一份（下面 `buildBody()` 里注明出处），
//   探针量的是**今天这一步的真实行为**，不是某个变体的行为。
// ⚠️ 图片 0 张 —— 这里只打文本上游 `ANTHROPIC_BASE_URL`（本机 cc-switch），**不碰任何 https**。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  forcedTool, parseToolUse, parseRecipe, RecipeToolSchema,
  GameDesignSpecSchema, VisualWorldSpecSchema,
} from "../../../../packages/contracts/dist/index.js";
import { assetPlanPrompt, PLAN_TOOL_NAME, PLAN_TOOL_DESCRIPTION } from "../../../../packages/assets/dist/prompt.js";
import { UPSTREAM_TIMEOUT_MS } from "../../../../packages/assets/dist/generate.js";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const RAW = path.join(HERE, "raw");
const SITE = path.resolve(HERE, "../../experiments/e2e-wasteland/raw/run-out-2026-10-13b/.failed-2026-10-13T09-22-52-685Z");

const MAX_SHOTS = 6;          // ② 硬上限
const FIRST_BATCH = 3;        // ① 先 3 发
const DEADLINE_MS = 150 * 60 * 1000;   // 沿用 150 分钟硬叫停

const t0 = Date.now();
const out = (...a) => console.log(...a);

// ── 输入：**已落盘的**第九跑设计 + 这个世界（不用再买理解层那一步）──────────
const design = GameDesignSpecSchema.parse(JSON.parse(fs.readFileSync(path.join(SITE, "game-design.json"), "utf8")));
const world = VisualWorldSpecSchema.parse(JSON.parse(fs.readFileSync(path.join(SITE, "visual-world.json"), "utf8")));
const refs = world.styleReferences;

// ── 请求体：**照抄** `ops.ts:planAssets`（`packages/assets/src/ops.ts:198-212`）────────
//    发出去的是**同一串字节**，探针才是「这一步」的探针。
const PROMPT = assetPlanPrompt({
  design, vws: world,
  echo: { styleRef: "stylespec.json", styleId: world.style.id, ...(refs.length > 0 ? { referenceImage: "reference.png" } : {}) },
});
const BODY = JSON.stringify({
  model: "deepseek-v4-pro", max_tokens: 16_000, thinking: { type: "disabled" },
  ...forcedTool(PLAN_TOOL_NAME, PLAN_TOOL_DESCRIPTION, RecipeToolSchema),
  messages: [{ role: "user", content: [{ type: "text", text: PROMPT }] }],
});

const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/+$/, "");
const apiKey = process.env.ANTHROPIC_AUTH_TOKEN ?? "";
if (!baseUrl || !apiKey) {
  console.error("❌ 文本上游没配：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN 两个都要给");
  process.exit(2);
}

fs.mkdirSync(RAW, { recursive: true });
out("票 59 定向探针 —— plan-assets 的 empty-input 可不可重复");
out(`  输入（已落盘、只读）: ${SITE}`);
out(`  文本上游             : ${baseUrl}（**直连，不经代理**；https 一律不碰）`);
out(`  工具                 : ${PLAN_TOOL_NAME} · schema ${JSON.stringify(RecipeToolSchema).length} 字符`);
out(`  提示词体量           : ${PROMPT.length} 字符（第九跑当场量到的就是 5621 —— 这一行是「同一串字节」的交叉验证）`);
out(`  请求体 sha256        : ${createHash("sha256").update(BODY).digest("hex").slice(0, 16)}`);
out(`  上限                 : ${MAX_SHOTS} 发 · 先 ${FIRST_BATCH} 发 · 单发超时 ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)}s`);
out("");

/** 把响应体的**形状**摘下来（不问对错）—— 这是「丢在哪一层」那一问的证据。 */
function shapeOf(body) {
  const b = body;
  const blocks = Array.isArray(b?.content) ? b.content : [];
  return {
    stop_reason: b?.stop_reason ?? null,
    blockCount: blocks.length,
    blocks: blocks.map((x) => {
      const t = x?.type ?? "?";
      if (t === "text") return { type: t, chars: String(x.text ?? "").length };
      if (t === "thinking") return { type: t, chars: String(x.thinking ?? "").length };
      if (t === "tool_use") {
        const inp = x.input;
        return {
          type: t, name: x.name ?? null,
          inputKind: inp === undefined ? "缺席" : Array.isArray(inp) ? "数组" : inp === null ? "null" : typeof inp === "object" ? (Object.keys(inp).length === 0 ? "空对象" : "对象") : typeof inp,
          inputKeys: inp && typeof inp === "object" && !Array.isArray(inp) ? Object.keys(inp).length : 0,
          inputChars: JSON.stringify(inp ?? null).length,
        };
      }
      return { type: t };
    }),
    usage: {
      inputTokens: b?.usage?.input_tokens ?? null,
      outputTokens: b?.usage?.output_tokens ?? null,
      ...(b?.usage?.reasoning_tokens !== undefined ? { reasoningTokens: b.usage.reasoning_tokens } : {}),
    },
    model: b?.model ?? null,
  };
}

const shots = [];
let k = 0;               // `empty-input` 的发数 —— 只有它进 k（约束 ⑤）
let stoppedBy = null;

for (let n = 1; n <= MAX_SHOTS; n++) {
  // ② 补发**只**在前 3 发全空时才发生 —— 条件写在跑之前，不是看到结果再决定
  if (n > FIRST_BATCH && !(shots.length === FIRST_BATCH && k === FIRST_BATCH)) { stoppedBy = "采样规则：前 3 发不是全空 ⇒ 不补发"; break; }
  if (Date.now() - t0 > DEADLINE_MS) { stoppedBy = "墙钟 150 分钟硬叫停"; break; }

  const started = Date.now();
  let httpStatus = null, body = null, ioError = null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: BODY,
    });
    httpStatus = res.status;
    const text = await res.text();
    fs.writeFileSync(path.join(RAW, `shot-${n}.json`), text + "\n");
    try { body = JSON.parse(text); }
    catch { ioError = `上游回的不是 JSON（${text.slice(0, 120)}）`; }
  } catch (e) {
    ioError = ctl.signal.aborted ? "timeout：上游没在超时内回应" : `http：${e.message}`;
  } finally { clearTimeout(timer); }

  const ms = Date.now() - started;
  const rec = { n, ms, httpStatus };

  if (ioError) {
    // ⑤ 其他类型的失败 ⇒ 停，**不混为 empty-input**
    rec.outcome = ctl_aborted(ioError) ? "timeout" : "http";
    rec.detail = ioError;
    shots.push(rec); stoppedBy = `第 ${n} 发是 ${rec.outcome}（非 empty-input）⇒ 按约束 ⑤ 停止`;
    out(`  第 ${n} 发 · ${rec.outcome} · ${(ms / 1000).toFixed(1)}s —— ${ioError}`); break;
  }

  const parsed = parseToolUse(body, PLAN_TOOL_NAME, RecipeToolSchema);
  rec.shape = shapeOf(body);
  if (parsed.ok) {
    const recipe = parseRecipe(parsed.value);
    rec.outcome = recipe.ok ? "ok" : "schema";
    if (!recipe.ok) rec.detail = `入参过线形状、但不过配方契约：${recipe.errors.slice(0, 4).join("；")}`;
  } else {
    rec.outcome = parsed.failure;      // 同一个分类器 ⇒ 与生产链上那个 `empty-input` 是**同一档**
    rec.detail = parsed.detail;
  }

  shots.push(rec);
  const s = rec.shape;
  out(`  第 ${n} 发 · ${rec.outcome} · ${(ms / 1000).toFixed(1)}s · http ${httpStatus} · stop_reason=${s.stop_reason}`);
  out(`        块 ${s.blockCount} 个：${s.blocks.map((b) => b.type === "tool_use" ? `tool_use(入参${b.inputKind}·${b.inputKeys}键·${b.inputChars}字符)` : `${b.type}(${b.chars ?? "?"}字符)`).join(", ") || "（空）"}`);
  out(`        token：入 ${s.usage.inputTokens} / 出 ${s.usage.outputTokens}${s.usage.reasoningTokens !== undefined ? ` / 思考 ${s.usage.reasoningTokens}` : ""} · 模型 ${s.model}`);

  if (rec.outcome === "ok") { stoppedBy = `第 ${n} 发成功 ⇒ 按约束 ① 停止`; break; }
  if (rec.outcome === "empty-input") { k++; continue; }
  // ⑤ `schema` / `truncated` / `no-tool-use` —— 都不是 empty-input，停止并如实记
  stoppedBy = `第 ${n} 发是 ${rec.outcome}（非 empty-input）⇒ 按约束 ⑤ 停止`;
  break;
}

function ctl_aborted(s) { return s.startsWith("timeout"); }

// ── ⑥ 落盘前扫一遍密钥：探针写下来的东西里**不许**出现任何凭据 ──────────
const NEEDLES = [
  { name: "anthropic-token(env)", v: apiKey },
  { name: "sk-ant-", v: "sk-ant-" },
  { name: "AQ.", v: "AQ." },
  { name: "AIzaSy", v: "AIzaSy" },
];
const leaks = [];
for (const f of fs.readdirSync(RAW)) {
  const t = fs.readFileSync(path.join(RAW, f), "utf8");
  for (const nd of NEEDLES) if (nd.v && t.includes(nd.v)) leaks.push(`${f} 命中 ${nd.name}`);
}

const report = {
  ticket: "59-plan-assets-empty-input",
  ranAt: new Date().toISOString(),
  input: { designPath: path.join(SITE, "game-design.json"), visualWorldPath: path.join(SITE, "visual-world.json") },
  upstream: baseUrl,
  request: { model: "deepseek-v4-pro", maxTokens: 16000, tool: PLAN_TOOL_NAME, promptChars: PROMPT.length, bodySha256Short: createHash("sha256").update(BODY).digest("hex").slice(0, 16) },
  sampling: { maxShots: MAX_SHOTS, firstBatch: FIRST_BATCH, rule: "先 3 发；1 发成功即停；3 发全空才补到 6" },
  n: shots.length,
  emptyInputCount: k,
  stoppedBy,
  wallMs: Date.now() - t0,
  shots,
  keyLeaks: leaks,
};
fs.writeFileSync(path.join(HERE, "report.json"), JSON.stringify(report, null, 2) + "\n");

out("");
out(`结算：n = ${shots.length} · empty-input = ${k} · 停因：${stoppedBy} · 墙钟 ${(report.wallMs / 1000).toFixed(1)}s`);
out(`落盘：${path.join(HERE, "report.json")} 与 raw/shot-*.json`);
out(`密钥扫描：${leaks.length === 0 ? "✅ 干净（" + NEEDLES.filter((x) => x.v).length + " 根钉子，0 命中）" : "❌ " + leaks.join(" / ")}`);
