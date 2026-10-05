// 票 08 的**变异判据**：每一发改一处**真的**源码，跑定向测试，**必须变红**。
//
// ⚠️ 两条从票 03 / 票 06 学来的规矩，写进脚本里：
//   ① **改之前先断言那一段真的在文件里、且只出现一次** —— 否则 sed/替换没匹配上、
//      源码一个字没动，而「全绿」会被当成「判据够强」（那两票各吃过一次）。
//   ② **每一发独立跑完再复原**，一发失败不牵连下一发。
//
// 跑法：node .scratch/game-maker-v2/experiments/vws-mutations/run.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const V = "packages/vision/tests";
const C = "packages/contracts/tests";

const M = [
  { label: "重采样只试一次（`STRUCTURED_CALL_ATTEMPTS` 名存实亡）",
    file: "packages/vision/src/analyze-reference.ts",
    find: "for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++) {",
    replace: "for (let attempt = 1; attempt <= 1; attempt++) {",
    tests: [`${V}/analyze-reference.test.ts`] },

  { label: "`stop_reason`/工具块不再当判据 —— 不过 Zod 也放行",
    file: "packages/vision/src/analyze-reference.ts",
    find: "  if (!parsed.ok) return { kind: \"bad\", failure: parsed.failure, detail: parsed.detail, spent };",
    replace: "  if (false && !parsed.ok) return { kind: \"bad\", failure: parsed.failure, detail: parsed.detail, spent }; if (!parsed.ok) return { kind: \"ok\", value: {} as never, spent };",
    tests: [`${V}/analyze-reference.test.ts`] },

  { label: "传输层失败也拿去重采样（把两种病因混进同一个分母）",
    file: "packages/vision/src/analyze-reference.ts",
    find: "      const ledger = call.record();\n      throw new AnalyzeReferenceError(once.failure, once.detail, ledger ? [ledger] : undefined);",
    replace: "      lastFailure = once.failure; lastDetail = once.detail; continue;",
    tests: [`${V}/analyze-reference.test.ts`] },

  { label: "不覆盖 `style.id`（裁决 21 的「强制覆盖」没了）",
    file: "packages/vision/src/build-visual-world.ts",
    find: "    style: { ...input.fromModel.style, id: input.styleId },",
    replace: "    style: { ...input.fromModel.style },",
    tests: [`${V}/build-visual-world.test.ts`] },

  { label: "不注入 `styleReferences`（模型答不出的那个路径没人填）",
    file: "packages/vision/src/build-visual-world.ts",
    find: "    styleReferences: input.styleReferences,",
    replace: "    styleReferences: [],",
    tests: [`${V}/build-visual-world.test.ts`] },

  { label: "装配后**不再**重新过契约（越界 gate 失去唯一的落点）",
    file: "packages/vision/src/build-visual-world.ts",
    find: "  if (!r.success) return { ok: false, detail: formatIssues(r.error).slice(0, 4).join(\"；\") };",
    replace: "  if (!r.success) return { ok: true, spec: candidate as never };",
    tests: [`${V}/build-visual-world.test.ts`, `${C}/visual-world-gate.test.ts`] },

  { label: "越界 gate 的边界写成 `>`（差一错）",
    file: "packages/contracts/src/visual-world.ts",
    find: "    if (idx >= n)",
    replace: "    if (idx > n)",
    tests: [`${C}/visual-world-gate.test.ts`] },

  { label: "gate 只查六桶、**漏掉** `materials.*.color`",
    file: "packages/contracts/src/visual-world.ts",
    find: "  for (const [name, mat] of Object.entries(v.materials))\n    (mat?.color ?? []).forEach((ref, i) => sites.push({ where: `materials.${name}.color[${i}]`, path: [\"materials\", name, \"color\", i], ref }));",
    replace: "",
    tests: [`${C}/visual-world-gate.test.ts`] },

  { label: "`LedgerStep` 去掉 `analyze-reference`（这一步在账上再次隐形）",
    file: "packages/contracts/src/ledger.ts",
    find: '  "analyze-reference",\n',
    replace: "",
    tests: [`${C}/structured-call.test.ts`] },

  // ⚠️ 这一发**第一版写错了**：改的是 `export` 那半，而 `import` 那半还在 ⇒ 本地绑定并没有真的没掉，
  //   于是「全绿」不是判据弱，是**变异是空的**。真正的病是「只有纯再导出、连 import 都没有」，
  //   所以要从 **import 那一行**里把它摘掉（这一发自己也是一条判据：变异脚本必须**真的改到东西**）。
  { label: "超时常量退化成**纯再导出**（本地绑定没了 ⇒ `setTimeout(fn, undefined)` 立刻触发）",
    file: "packages/assets/src/generate.ts",
    find: "import { DrawListSchema, UPSTREAM_TIMEOUT_MS, type AssetSpec,",
    replace: "import { DrawListSchema, type AssetSpec,",
    tests: ["packages/assets/tests/generate.test.ts"] },

  { label: "提示词丢掉「选色不排色」那条实测纠正",
    file: "packages/vision/src/prompts.ts",
    find: "- ⚠️ **不要**按画面占比从高到低排序。",
    replace: "- 颜色挑得好看一点。",
    tests: [`${V}/prompts.test.ts`] },

  { label: "工具声明丢掉那三个开放对象**不是数组**那句",
    file: "packages/vision/src/prompts.ts",
    find: "   **不是数组**。它们是\"原话\"的载体，例如",
    replace: "   随便填。它们是\"原话\"的载体，例如",
    tests: [`${V}/prompts.test.ts`] },

  { label: "需求文本不进提示词（参考图之外那半张输入没了）",
    file: "packages/vision/src/prompts.ts",
    find: "${input.requirementText.trim()}",
    replace: "（略）",
    tests: [`${V}/prompts.test.ts`] },
];

let bad = 0;
for (const [i, m] of M.entries()) {
  const abs = path.join(ROOT, m.file);
  const original = fs.readFileSync(abs, "utf8");
  const hits = original.split(m.find).length - 1;
  if (hits !== 1) { console.log(`❌ ${i + 1}. ${m.label}\n     变异锚点在文件里出现 ${hits} 次（要求恰好 1 次）—— **源码没动，这一发不算数**`); bad++; continue; }
  fs.writeFileSync(abs, original.replace(m.find, m.replace));

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
console.log(bad === 0 ? `\n✅ ${M.length} 发变异全部验过会红` : `\n❌ ${bad} 发有问题`);
process.exit(bad === 0 ? 0 : 1);
