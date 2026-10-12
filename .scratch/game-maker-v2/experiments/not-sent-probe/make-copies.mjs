// 造两份**逐字复制**的 `ops.ts` 副本，只为量票 51 的两件事（跑完删掉，别提交）。
//
//   node .scratch/game-maker-v2/experiments/not-sent-probe/make-copies.mjs
//
//   · `packages/assets/src/probe-ops-a.ts` —— 原文 + 一句 `export`（为了直接调 `spentCall`）
//     + **改一行**：`compileTdGame` 的 `not-sent` 抛点照抄成 `upstream` 档的样子（带账）。
//     ⇒ 用来量病二的**幻影**（`trip({})` 之后 `record()` 交出什么）与「照抄就会报假账」那个陷阱。
//   · `packages/assets/src/probe-ops-b.ts` —— A 之上再改一处：`callText` 的 `res.json()` 包 try/catch
//     （逐字对齐 `onceThroughTool` / `analyze-intent` 那两份实现）。
//     ⇒ 用来**预演修法 (a)**：只设防能不能把那一族收干净。
//
// ⚠️ 两份文件都**绝不提交**；`probe.test.ts` 里那两行 import 指向它们。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(fileURLToPath(new URL("../../../../packages/assets/src/ops.ts", import.meta.url)));
const DIR = path.dirname(SRC);
const original = fs.readFileSync(SRC, "utf8");

/** 改一处就在场断言一处 —— 上游源码动了，这份脚本**当场炸**，而不是悄悄产出一份假副本。 */
const sub = (s, from, to, what) => {
  if (!s.includes(from)) throw new Error(`补丁点找不到了（${what}）—— 源码动过，去看 ${path.basename(SRC)}`);
  return s.replace(from, to);
};

// ── A ────────────────────────────────────────────────────────────────────────
let a = original;
a = sub(a, "\nfunction spentCall(step: LedgerStep, target: string) {",
  "\nexport function spentCall(step: LedgerStep, target: string) {", "spentCall 的 export");
a = sub(a, '      if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message);',
  '      if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message, ledgerCarrying(call.record()));',
  "compileTdGame 那个 not-sent 抛点（6 空格缩进那一处）");

// ── B ────────────────────────────────────────────────────────────────────────
const naked = `  const j = (await res.json()) as {
    model?: string; content?: { type: string; text?: string }[]; stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
  };`;
const guarded = `  let j: {
    model?: string; content?: { type: string; text?: string }[]; stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
  };
  try { j = (await res.json()) as typeof j; }
  catch (e) { throw new UpstreamCallError("http", \`上游回的不是 JSON：\${(e as Error).message}\`); }`;
const b = sub(a, naked, guarded, "callText 里裸着的 res.json()");

fs.writeFileSync(path.join(DIR, "probe-ops-a.ts"), a);
fs.writeFileSync(path.join(DIR, "probe-ops-b.ts"), b);
console.log("写好两份副本：packages/assets/src/probe-ops-a.ts · probe-ops-b.ts（记得删）");
