// 票 12 的**变异判据**：每一发改一处**真的**源码，跑定向测试，**必须变红**。
//
// ⚠️ 五条从 03 / 06 / 08 / 09 / 10 / 11 学来的规矩（都写进脚本）：
//   ① 改之前先断言那段**真的在、且只出现一次**；② 每一发独立跑完再复原；
//   ③ **瞄「有判据看着的那句话」**；④ 变异落在 `contracts/src` 时要 rebuild **且加 `--force`**
//   （增量 `tsc -b` 可能是 no-op）；⑤ 变异把编译弄红也算红，但要**说清是哪一期红的**。
//
// 跑法：node .scratch/game-maker-v2/experiments/plan-mutations/run.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const C = "packages/contracts/tests";
const A = "packages/assets/tests";
const MIRROR = "packages/contracts/src/recipe-tool.ts";
const LEDGER = "packages/contracts/src/ledger.ts";
const OPS = "packages/assets/src/ops.ts";
const PROMPTS = "packages/assets/src/prompt.ts";
const P = { prompt: [`${A}/plan-assets.test.ts`], ledger: [`${A}/text-op-ledger.test.ts`] };

const M = [
  // ── 那两层判据：线形状 vs 契约 ────────────────────────────────────────────
  { label: "⚠️ **跳过 v3 契约那一步**（线形状过了就当真 ⇒ 含环的清单会被落盘）",
    file: OPS,
    find: "    const truth = parseRecipe(once.result.value);",
    replace: "    const truth = { ok: true as const, value: once.result.value };",
    tests: P.ledger },

  { label: "⚠️ 工具 schema 换成一份**空的**（镜像那 7 键没了）",
    file: OPS,
    find: "    ...forcedTool(PLAN_TOOL_NAME, PLAN_TOOL_DESCRIPTION, RecipeToolSchema),",
    replace: "    tools: [{ name: PLAN_TOOL_NAME, description: PLAN_TOOL_DESCRIPTION, input_schema: {} }], tool_choice: { type: \"tool\", name: PLAN_TOOL_NAME },",
    tests: P.prompt },

  { label: "镜像里**删掉 `dependsOn`**（线形状与契约分叉）",
    file: MIRROR,
    find: "  dependsOn: z.array(z.string().min(1)).optional()\n",
    replace: "",
    tests: [`${C}/recipe-tool.test.ts`] },

  { label: "镜像里 **`required` 的默认值没了**（省略该键的输入两份分叉）",
    file: MIRROR,
    find: "  required: z.boolean().default(true),",
    replace: "  required: z.boolean(),",
    tests: [`${C}/recipe-tool.test.ts`] },

  // ── 账 ────────────────────────────────────────────────────────────────────
  { label: "`LedgerStep` 去掉 `plan-assets`（这一步在账上隐形）",
    file: LEDGER,
    find: '  "plan-assets",\n',
    replace: "",
    tests: [`${C}/structured-call.test.ts`] },

  { label: "账里的 `step` 报成 `derive`（新的调用顶着旧的名字）",
    file: OPS,
    find: '  const call = spentCall("plan-assets", "recipe");',
    replace: '  const call = spentCall("derive", "recipe");',
    tests: P.ledger },

  // ── 落盘那一半 ────────────────────────────────────────────────────────────
  { label: "⚠️ 落盘时**不改写 `styleRef`**（清单指着模型瞎写的路径）",
    file: OPS,
    find: "  const out: Record<string, unknown> = { ...checked.value, styleRef: STYLE_FILE };",
    replace: "  const out: Record<string, unknown> = { ...checked.value };",
    tests: P.ledger },

  { label: "⚠️ 风格参考图**不拷进配方目录**（`03 §15` 要的「原图参与」断了）",
    file: OPS,
    find: '    out["referenceImage"] = REF_FILE;',
    replace: '    out["referenceImage"] = "model-wrote-this.png";',
    tests: P.ledger },

  { label: "⚠️ **没配凭据也照发**（本地配置错被计成上游故障 —— 票 46 那个坑）",
    file: OPS,
    find: '  if (!opts.transport || opts.transport.baseUrl === "" || opts.transport.apiKey === "")',
    replace: "  if (!opts.transport)",
    tests: P.ledger },

  { label: "`max_tokens` 调小（这份清单比前几发都大）",
    file: OPS,
    find: "    model: \"deepseek-v4-pro\", max_tokens: 16_000, thinking: { type: \"disabled\" },",
    replace: "    model: \"deepseek-v4-pro\", max_tokens: 1_000, thinking: { type: \"disabled\" },",
    tests: P.prompt },

  // ── 提示词：欠条 + 探针抓到的两处 ─────────────────────────────────────────
  { label: "⚠️ 提示词不再插设计层 ① 档字段 `world.structure`",
    file: PROMPTS,
    find: "    `- \\`world.structure\\`：${d.world.structure}`",
    replace: "    `- （这一条故意拿掉）`",
    tests: P.prompt },

  { label: "⚠️ 提示词不再插 ① 档字段 `interactables[].behavior`",
    file: PROMPTS,
    find: "\\`interactables[].behavior\\`：${e.behavior}",
    replace: "行为：${e.behavior}",
    tests: P.prompt },

  { label: "⚠️ 提示词不再插 ① 档字段 `npcs[].role`",
    file: PROMPTS,
    find: "\\`npcs[].role\\`：${e.role}",
    replace: "角色：${e.role}",
    tests: P.prompt },

  { label: "⚠️ **骨架把「那三个键住在 `spec` 里」那句话拿掉**（探针第一轮栽的就是它）",
    file: PROMPTS,
    // ⚠️ 靶子要瞄**判据正在看的那一句**：第一版瞄的是上一行的「两层」，
    //   而判据锚的是这一行的「放错一层会被拒收」⇒ 源码改了、被测的那句一个字没动。
    find: "放错一层会被拒收",
    replace: "放哪层都一样",
    tests: P.prompt },

  { label: "⚠️ **骨架把 `source.kind` 写死成 `drawlist`**（等于替模型把策略定了）",
    file: PROMPTS,
    find: '"source":{"kind":"drawlist|image|import"}}]}',
    replace: '"source":{"kind":"drawlist"}}]}',
    tests: P.prompt },

  { label: "⚠️ 「**层数按画面需要定**」（票 12 的 Q3：不固定三层）没了",
    file: PROMPTS,
    find: "**层数按画面需要定**",
    replace: "**一律三层**",
    tests: P.prompt },

  { label: "说明里「`character-reference` **不是值**」那条没了",
    file: PROMPTS,
    find: "**不是值**",
    replace: "也是值",
    tests: P.prompt },

  { label: "说明里母版比例那条（「宽高比必须一致」）没了",
    file: PROMPTS,
    find: "宽高比必须一致",
    replace: "看着差不多就行",
    tests: P.prompt },

  { label: "说明里「`dependsOn` **不许有环**」没了",
    file: PROMPTS,
    find: "**整张图不许有环**",
    replace: "环也能凑合",
    tests: P.prompt },
];

let bad = 0;
for (const [i, m] of M.entries()) {
  const abs = path.join(ROOT, m.file);
  const original = fs.readFileSync(abs, "utf8");
  const hits = original.split(m.find).length - 1;
  if (hits !== 1) { console.log(`❌ ${i + 1}. ${m.label}\n     变异锚点在文件里出现 ${hits} 次（要求恰好 1 次）—— **源码没动，这一发不算数**`); bad++; continue; }
  fs.writeFileSync(abs, original.replace(m.find, m.replace));

  const needsBuild = m.file.startsWith("packages/contracts/src/");
  let red = false, how = "";
  if (needsBuild) {
    try { execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" }); }
    catch {
      fs.writeFileSync(abs, original);
      execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });
      console.log(`✅ ${i + 1}. ${m.label} —— 变红（**编译期**：tsc 先拦下了）`);
      continue;
    }
  }
  try {
    execFileSync("npx", ["vitest", "run", ...m.tests], { cwd: ROOT, stdio: "pipe" });
  } catch (e) {
    const out = String(e.stdout ?? "") + String(e.stderr ?? "");
    const f = /Tests +(\d+ failed)/.exec(out);
    red = true; how = f ? f[1] : "非零退出";
  } finally {
    fs.writeFileSync(abs, original);
  }
  console.log(`${red ? "✅" : "❌"} ${i + 1}. ${m.label}${red ? ` —— 变红（${how}）` : " —— **没有变红！判据漏了这一条**"}`);
  if (!red) bad++;
}
execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });
execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/assets"], { cwd: ROOT, stdio: "pipe" });
console.log(bad === 0 ? `\n✅ ${M.length} 发变异全部验过会红` : `\n❌ ${bad} 发有问题`);
process.exit(bad === 0 ? 0 : 1);
