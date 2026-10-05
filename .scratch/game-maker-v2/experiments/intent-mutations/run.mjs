// 票 09 的**变异判据**：每一发改一处**真的**源码，跑定向测试，**必须变红**。
//
// ⚠️ 两条从票 03 / 06 / 08 学来的规矩，写进脚本里：
//   ① **改之前先断言那一段真的在文件里、且只出现一次** —— 否则 sed/替换没匹配上、
//      源码一个字没动，而「全绿」会被当成「判据够强」（票 03 与票 06 各吃过一次）。
//   ② **每一发独立跑完再复原**，一发失败不牵连下一发。
//
// ⚠️ **本票新吃到的第三种「变异是空的」**（第 13 发实测）：
//   `game-design` 的测试 import `@game-maker/contracts`，那是**包出口 ⇒ `dist/`** ——
//   所以改 `packages/contracts/src/**` 而**不 rebuild**，测试读到的还是旧 dist，
//   源码变了、变异却**没进到被测的那份代码里**，于是「全绿」。
//   （票 08 没吃到这一口，是因为它那条 ledger 变异挑的测试 import 的是 `../src/index.js`。）
//   ⇒ 凡变异落在 `packages/contracts/src/**`，**先 rebuild 再跑**；跑完统一再 build 一次收尾。
//
// ⚠️ **第三种「变异是空的」的孪生兄弟（同日实测）**：收尾那次 `tsc -b` 在**增量**状态下
//   可能是 **no-op** —— 复原后的源码与 tsbuildinfo 里记的那一份在它看来"没变"，
//   于是 dist 里留着的还是**某一发变异版的** JS，而测试跑的是 dist。
//   症状：变异全绿了，紧接着 `pnpm test` 却红了一片（本票实吃）。
//   ⇒ 两处 rebuild 一律加 **`--force`**（它才真的丢开 tsbuildinfo 重编）。
//
// 跑法：node .scratch/game-maker-v2/experiments/intent-mutations/run.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const G = "packages/game-design";
const C = "packages/contracts/tests";
const T = `${G}/tests`;
const INTENT = "packages/contracts/src/game-intent.ts";
const ANALYZE = "packages/game-design/src/analyze-intent.ts";
const PROMPTS = "packages/game-design/src/prompts.ts";

const M = [
  { label: "重采样只试一次（`STRUCTURED_CALL_ATTEMPTS` 名存实亡）",
    file: ANALYZE,
    find: "for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++) {",
    replace: "for (let attempt = 1; attempt <= 1; attempt++) {",
    tests: [`${T}/analyze-intent.test.ts`] },

  { label: "`parseToolUse` 的结果不再当判据 —— 不过 Zod 也放行",
    file: ANALYZE,
    find: '  if (!parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent };',
    replace: '  if (false && !parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent }; if (!parsed.ok) return { kind: "ok", value: {} as never, spent };',
    tests: [`${T}/analyze-intent.test.ts`] },

  { label: "传输层失败也拿去重采样（把两种病因混进同一个分母）",
    file: ANALYZE,
    find: "      const ledger = call.record();\n      throw new AnalyzeIntentError(once.failure, once.detail, ledger ? [ledger] : undefined);",
    replace: "      lastFailure = once.failure; lastDetail = once.detail; continue;",
    tests: [`${T}/analyze-intent.test.ts`] },

  { label: "传输层的病因**不进** `failures[]`（票 08 票面那句已过时的读法）",
    file: ANALYZE,
    find: "      call.trip({ failure: once.failure });",
    replace: "      call.trip({});",
    tests: [`${T}/analyze-intent.test.ts`] },

  { label: "账的 `target` 不再是产物名",
    file: ANALYZE,
    find: 'const LEDGER_TARGET = "game-intent";',
    replace: 'const LEDGER_TARGET = "intent";',
    tests: [`${T}/analyze-intent.test.ts`] },

  { label: "`.omit()` 把顶层那条 gate **摘掉**（票 08 实测：`.omit()` 会丢 `superRefine`）",
    file: ANALYZE,
    find: "parseToolUse(body, TOOL_NAME, GameIntentSpecSchema)",
    replace: "parseToolUse(body, TOOL_NAME, GameIntentSpecSchema.omit({ title: true }))",
    tests: [`${T}/analyze-intent.test.ts`] },

  { label: "gate 的「必填字符串非空」整条拿掉",
    file: INTENT,
    find: "  for (const [label, s] of strings) if (blank(s)) issue(",
    replace: "  for (const [label, s] of strings) if (false && blank(s)) issue(",
    tests: [`${C}/game-intent-gate.test.ts`] },

  { label: "空白判据丢掉 `.trim()`（`\"   \"` 会被当成有内容）",
    file: INTENT,
    find: '  const blank = (s: string | undefined) => (s ?? "").trim() === "";',
    replace: '  const blank = (s: string | undefined) => (s ?? "") === "";',
    tests: [`${C}/game-intent-gate.test.ts`] },

  { label: "gate 里拿掉 `mechanics ≥ 1`（「一条机制都说不出来」被放行）",
    file: INTENT,
    find: '    ["player.goals", v.player.goals.length],\n    ["mechanics", v.mechanics.length]\n',
    replace: '    ["player.goals", v.player.goals.length]\n',
    tests: [`${C}/game-intent-gate.test.ts`] },

  { label: "把 `entities ≥ 1` **塞回** gate（人类专门划出去的那一格）",
    file: INTENT,
    find: '    ["mechanics", v.mechanics.length]',
    replace: '    ["mechanics", v.mechanics.length],\n    ["entities", v.entities.length]',
    tests: [`${C}/game-intent-gate.test.ts`] },

  { label: "gate 的 id 重复检查拿掉（设计层按 id 延续，重了就对不上是哪一个）",
    file: INTENT,
    find: '  dupIds(v.entities, "entities");\n',
    replace: "",
    tests: [`${C}/game-intent-gate.test.ts`] },

  { label: "顶层 `resources` **加回来**（Q5 的出局没被守住）",
    file: INTENT,
    find: "  winConditions: z.array(z.string()),",
    replace: "  resources: z.array(z.string()),\n  winConditions: z.array(z.string()),",
    tests: [`${C}/game-intent-gate.test.ts`, `${T}/analyze-intent.test.ts`] },

  { label: "`LedgerStep` 去掉 `analyze-intent`（这一步在账上再次隐形）",
    file: "packages/contracts/src/ledger.ts",
    find: '  "analyze-intent",\n',
    replace: "",
    // ⚠️ 判据在 `contracts` 那份测试里（`LedgerStep.options`）—— 由**枚举**守着，不是由调用方。
    //   第一版指向 `analyze-intent.test.ts`，那一发**全绿**：调用方写死的字面量不受枚举影响，
    //   而它仍然测得出 `step: "analyze-intent"` ⇒ 变异没进到被测的那份代码里。
    tests: [`${C}/structured-call.test.ts`] },

  { label: "提示词骨架**丢掉字段台账**（① 档欠条要的「逐个点名」没了）",
    file: PROMPTS,
    find: '${Object.entries(FIELD_HINTS).map(([k, v]) => `- \\`${k}\\` —— ${v}`).join("\\n")}',
    replace: "（自己看着办）",
    tests: [`${T}/prompts.test.ts`] },

  { label: "骨架丢掉 `subgenre` 那一行（一个 ① 档字段从此不在模板里露脸）",
    file: PROMPTS,
    find: '  subgenre: "细分题材。需求提了、或能可靠推出来就填；**推不出来就省掉**",\n',
    replace: "",
    tests: [`${T}/prompts.test.ts`] },

  { label: "工具说明丢掉「`mechanics[].name` 是自由文本」那句（票 03 播给本票的第一条）",
    file: PROMPTS,
    find: "1. \\`mechanics[].name\\` 是**自由文本**。",
    replace: "1. \\`mechanics[].name\\` 是一个字段。",
    tests: [`${T}/prompts.test.ts`] },

  { label: "工具说明丢掉「`resource` 是资源**唯一**的地方」",
    file: PROMPTS,
    find: "\\`resource\\` 这一档是「资源」**唯一**的地方",
    replace: "\\`resource\\` 这一档收资源",
    tests: [`${T}/prompts.test.ts`] },
];

let bad = 0;
for (const [i, m] of M.entries()) {
  const abs = path.join(ROOT, m.file);
  const original = fs.readFileSync(abs, "utf8");
  const hits = original.split(m.find).length - 1;
  if (hits !== 1) { console.log(`❌ ${i + 1}. ${m.label}\n     变异锚点在文件里出现 ${hits} 次（要求恰好 1 次）—— **源码没动，这一发不算数**`); bad++; continue; }
  fs.writeFileSync(abs, original.replace(m.find, m.replace));

  // ⚠️ 见文件头：变异落在 `contracts/src` 时，测试读的是 `dist/` ⇒ 不 rebuild 就等于没改。
  const needsBuild = m.file.startsWith("packages/contracts/src/");
  if (needsBuild) execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });

  let red = false, how = "";
  try {
    execFileSync("npx", ["vitest", "run", ...m.tests], { cwd: ROOT, stdio: "pipe" });
  } catch (e) {
    const out = String(e.stdout ?? "") + String(e.stderr ?? "");
    const f = /Tests +(\d+ failed)/.exec(out);
    red = true; how = f ? f[1] : "非零退出";
  } finally {
    fs.writeFileSync(abs, original);   // ⚠️ 无论成败都复原
  }
  console.log(`${red ? "✅" : "❌"} ${i + 1}. ${m.label}${red ? ` —— 变红（${how}）` : " —— **没有变红！判据漏了这一条**"}`);
  if (!red) bad++;
}
// ⚠️ 收尾：把 dist 建回**真源码**那一份（上面几发可能把变异后的 src build 进了 dist）。
execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });
console.log(bad === 0 ? `\n✅ ${M.length} 发变异全部验过会红` : `\n❌ ${bad} 发有问题`);
process.exit(bad === 0 ? 0 : 1);
