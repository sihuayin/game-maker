// 票 19 的**变异判据**：每一发改一处**真的**源码，跑定向测试，**必须变红**。
//
// ⚠️ 五发，而且**每一发都记「被谁杀死的」**（票 19 的 Q13）——
//   本票把实现抽进了 `contracts`，于是**同一个函数有两个包的调用方**：
//   一发变异可能只被**另一个包**的测试杀死，而看日志的人会以为是自己那一侧改坏了。
//   ⇒ 脚本对每一发**分别跑两套**，两边都要报：
//     A 套 = contracts + game-design 的用例（`auditIntentCoverage` 的**单元**与**第一个调用方**）
//     B 套 = qa 的用例（**第二个调用方** —— 交付态那条路）
//   ⚠️ 第 ⑤ 发是本票唯一一条**反向**判据：别的变异怕「不响」，它怕「响」（把文本那一半加回来）。
//     它只可能被**钉子**杀死 —— 这就是那枚钉子存在的理由。
//
// ⚠️ 三条从票 03 / 06 / 08 / 09 / 10 学来的规矩（照 `design-mutations/run.mjs`）：
//   ① 改之前先断言那段**真的在、且只出现一次**（否则「全绿」是变异没生效）。
//   ② 每一发独立跑完再复原。
//   ③ **变异落在 `contracts/src` 时，测试读的是 `dist/` ⇒ 必须先 rebuild，且要 `--force`**
//      —— 增量状态下那次 build 可能是 no-op，dist 里会留着上一发变异版的 JS。
//
// 跑法：node .scratch/game-maker-v2/experiments/intent-coverage-mutations/run.mjs
//
// ⚠️ **本脚本与票 09 的 `intent-mutations/` 不是一回事**：那一份瞄的是 `analyze-intent`（理解层第一步），
//   这一份瞄的是**意图覆盖那条判据**（`auditIntentCoverage`）。名字像，用途不一样。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const COVERAGE = "packages/contracts/src/intent-coverage.ts";
const QA = "packages/qa/src/intent.ts";

/** A 套：**实现**那一侧（contracts 的单元 + game-design 这个调用方）。 */
const A = ["packages/contracts/tests/intent-coverage.test.ts", "packages/game-design/tests/build-design.test.ts"];
/** B 套：**第二个调用方**那一侧（QA 的意图族，走交付态那条路）。 */
const B = ["packages/qa/tests/intent.test.ts"];

const M = [
  { label: "① 集合差换成「**非空即通过**」（票面 §4 点名的那一发）",
    file: COVERAGE,
    find: "\n  return out;\n}",
    replace: "\n  if (out.length > 0) return [];\n  return out;\n}" },

  { label: "② 只查 `entities`，**不查 `mechanics`**",
    file: COVERAGE,
    find: "  for (const m of intent.mechanics)\n    if (!hasId(design.mechanics, m.id))\n      out.push({ kind: \"mechanic\", id: m.id, saidAs: m.name });\n\n  return out;",
    replace: "\n  return out;" },

  { label: "③ 把「按 `type` 落桶」放宽成「**任意桶里有就算**」（串桶不再算缺）",
    file: COVERAGE,
    find: "    if (hasId(design[bucket], e.id)) continue;",
    replace: "    if (BUCKETS.some((b) => hasId(design[b], e.id))) continue;" },

  { label: "④ `severity` 从 `error` 降成 `warning`（判据不再阻断）",
    file: QA,
    find: "    severity: \"error\",",
    replace: "    severity: \"warning\"," },

  { label: "⑤ ⚠️ **把文本那一半加回来**（票 19 亲手砍掉的那半 —— 反向钉子）",
    file: COVERAGE,
    find: "\n  return out;\n}",
    replace: "\n  for (const s of intent.coreLoop)\n    if (!design.coreLoop.includes(s)) out.push({ kind: \"mechanic\", id: s, saidAs: s });\n\n  return out;\n}" }
];

const runTests = (tests) => {
  try {
    execFileSync("npx", ["vitest", "run", ...tests], { cwd: ROOT, stdio: "pipe" });
    return { red: false, how: "" };
  } catch (e) {
    const out = String(e.stdout ?? "") + String(e.stderr ?? "");
    const f = /Tests +(\d+ failed)/.exec(out);
    // ⚠️ **哪条用例杀死的**：vitest 的 FAIL 行里带文件名。
    const files = [...new Set([...out.matchAll(/FAIL +(packages\/\S+\.test\.ts)/g)].map((m) => m[1]))];
    return { red: true, how: `${f ? f[1] : "非零退出"}${files.length ? ` · ${files.join(" + ")}` : ""}` };
  }
};

let bad = 0;
for (const [i, m] of M.entries()) {
  const abs = path.join(ROOT, m.file);
  const original = fs.readFileSync(abs, "utf8");
  const hits = original.split(m.find).length - 1;
  if (hits !== 1) { console.log(`❌ ${m.label}\n     变异锚点在文件里出现 ${hits} 次（要求恰好 1 次）—— **源码没动，这一发不算数**`); bad++; continue; }
  fs.writeFileSync(abs, original.replace(m.find, m.replace));

  const rebuild = () => execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });
  const needsBuild = m.file.startsWith("packages/contracts/src/");
  if (needsBuild) rebuild();

  const a = runTests(A);
  const b = runTests(B);

  // ⚠️ **复原之后也要 rebuild**：不 rebuild 的话 dist 里留着**这一发变异版**的 JS，
  //   而下一发如果不在 contracts（不需要 rebuild），它跑的就是**上一发的变异体** ——
  //   症状是「A 套莫名其妙红了」。这正是票 09/10 记过的那口陷阱，本脚本第一版实吃过（④ 那一发）。
  fs.writeFileSync(abs, original);
  rebuild();

  const killed = a.red || b.red;
  console.log(`${killed ? "✅" : "❌"} ${m.label}`);
  console.log(`     A（实现侧）${a.red ? `变红（${a.how}）` : "**没红**"} · B（QA 侧）${b.red ? `变红（${b.how}）` : "**没红**"}`);
  if (!killed) bad++;
}
execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });
execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/qa"], { cwd: ROOT, stdio: "pipe" });
console.log(bad === 0 ? `\n✅ ${M.length} 发变异全部验过会红` : `\n❌ ${bad} 发有问题`);
process.exit(bad === 0 ? 0 : 1);
