#!/usr/bin/env node
/**
 * **提示词的一次命中率**：真调 N 次 `compile-td-game`，印「N 次里 M 次过 · 平均几笔上游调用」。
 *
 *   node packages/demo/probe/td-hit-rate.mjs [次数]        # 默认 5
 *
 * ⚠️ **它每次都花钱**（每次 1–3 笔真调用）⇒ **不许进 CI** ——
 *   与 `smoke*.mjs` / `td-sweep.mjs` 同一条规矩：**可复跑、不守门**。
 *
 * ⚠️ **它为什么存在**（[票 12](../../../.scratch/td-compile-v1/issues/12-prompt-hit-rate.md)）：
 *   票 05 当年跑**一次**过了就把提示词当成「跑通了」，而后来真跑 20 次才量出
 *   **单次过只有 ~1/4**（失败几乎全在「`path.points` 的坐标 vs 地图上画成 `:` 的格」那一族）
 *   —— **一次采样不是一次测量**。那一族已经被做成结构上不可能（路径改由代码从地图派生），
 *   所以这个脚本量的是**那之后**的命中率；谁再动提示词或契约，重跑它，
 *   并把新数写进 [`docs/td-requirement.md`](../../../docs/td-requirement.md)。
 *
 * 依赖：`packages/assets/dist`（先 `pnpm build`）+ 上游凭据
 *   （`ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`，见 `game-maker.local.example.json`）。
 */
import path from "node:path";
// ⚠️ **它住 `assets/probe/` 而不是 `demo/probe/`**：它量的是 `compileTdGame`，而它住这个包。
//   放 demo 那边要写成 `../../assets/dist/...` —— 那是一条**被禁止的边**
//   （`scripts/check-deps.mjs`：`demo → contracts`，别的一律不许），只是那个守卫只读
//   `package.json`、看不见相对路径的 import，所以它会**悄悄通过**。别去踩。
import { compileTdGame } from "../dist/index.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
process.chdir(ROOT);

const N = Number(process.argv[2] ?? 5);
const transport = { baseUrl: process.env.ANTHROPIC_BASE_URL ?? "", apiKey: process.env.ANTHROPIC_AUTH_TOKEN ?? "" };
if (!transport.baseUrl || !transport.apiKey) {
  console.error("⚠️ 缺上游凭据：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN（见 game-maker.local.example.json）");
  process.exit(1);
}

const REQUIREMENT = "inputs/counter-siege/PROMPT.md";
const PACK = "fixtures/packs/counter-siege/v4";

let ok = 0, calls = 0;
for (let i = 0; i < N; i++) {
  const t0 = Date.now();
  // ⚠️ **重采样上限仍是 3**（`compileTdGame` 的默认）—— 换掉它先量，别拍。
  const r = await compileTdGame({ requirementPath: REQUIREMENT, packDir: PACK, outRoot: "out/__hit-rate", transport });
  const trips = r.data.ledger[0]?.attempts ?? 0;
  calls += trips;
  if (r.data.ok) ok += 1;
  const bad = r.data.issues.filter((x) => x.startsWith("❌"));
  console.log(`  第 ${i + 1} 次 · ${((Date.now() - t0) / 1000).toFixed(1)}s · 试了 ${trips} 次 · ${r.data.ok ? "✅ 过" : `❌ ${bad.length} 条：${bad[0] ?? ""}`}`);
}
console.log(`\n  **${N} 次里 ${ok} 次过** · 一共 ${calls} 笔上游调用（平均 ${(calls / N).toFixed(1)} 笔/次）`);
