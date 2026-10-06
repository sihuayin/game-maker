// 票 11 的**变异判据**：每一发改一处**真的**源码，跑定向测试，**必须变红**。
//
// ⚠️ 四条从票 03 / 06 / 08 / 09 / 10 学来的规矩，写进脚本里：
//   ① 改之前先断言那段**真的在、且只出现一次**（否则「全绿」是变异没生效）。
//   ② 每一发独立跑完再复原。
//   ③ **瞄「有判据看着的那句话」**（票 10 第 22 发吃过：改的句子没有判据盯着 ⇒ 全绿）。
//   ④ **变异落在 `contracts/src` 时测试读的是 `dist/` ⇒ 必须先 rebuild，且要 `--force`**
//      （增量 `tsc -b` 可能是 no-op，dist 里会留着上一发变异版的 JS）。
//
// 跑法：node .scratch/game-maker-v2/experiments/recipe-mutations/run.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const C = "packages/contracts/tests";
const A = "packages/assets/tests";
const RECIPE = "packages/contracts/src/recipe.ts";
const SPEC = "packages/contracts/src/asset-spec.ts";
const PACK = "packages/assets/src/pack.ts";

const M = [
  // ── 契约：环 ──────────────────────────────────────────────────────────────
  { label: "⚠️ **环判据整条拿掉**（含环的清单放行 ⇒ 跑到一半死）",
    file: RECIPE,
    find: "  if (cycle !== null)",
    // ⚠️ 写成 `cycle !== null && false` 而不是 `false && cycle !== null`：后者会让 TS **不再收窄**
    //   `cycle` ⇒ 编译期 TS18047 ⇒ 那一发红的是编译器、不是判据（两条都算红，但前者才在测判据）。
    replace: "  if (cycle !== null && false)",
    tests: [`${C}/recipe-graph.test.ts`] },

  { label: "⚠️ 环**只报一个节点**（报错指不出环在哪）",
    file: RECIPE,
    find: "    if (st === 1) return [...stack.slice(stack.indexOf(n)), n]; // 顺着栈把环抄出来",
    replace: "    if (st === 1) return [n]; // 顺着栈把环抄出来",
    tests: [`${C}/recipe-graph.test.ts`] },

  // ── 契约：dependsOn 的引用族 ─────────────────────────────────────────────
  { label: "`dependsOn` **解不到也不报**（悬空依赖放行）",
    file: RECIPE,
    find: "      else if (!ids.has(dep))",
    replace: "      else if (false && !ids.has(dep))",
    tests: [`${C}/recipe-graph.test.ts`] },

  { label: "`dependsOn` **指向自己也不报**（自环只靠环判据兜底 ⇒ 报错说错话）",
    file: RECIPE,
    find: "      if (dep === e.spec.id)",
    replace: "      if (false && dep === e.spec.id)",
    tests: [`${C}/recipe-graph.test.ts`] },

  { label: "⚠️ 指向**母版**时把那句提示拿掉（两类边的边界说不出来了）",
    file: RECIPE,
    find: "            ? \" —— ⚠️ 那是个**母版**：引用母版要用 `masterAsset`，不是 `dependsOn`（两类边各管各的）\"",
    replace: "            ? \"\"",
    tests: [`${C}/recipe-graph.test.ts`] },

  { label: "`AssetSpec.dependsOn` **整条删掉**（那张图在契约里不存在了）",
    file: SPEC,
    find: "  dependsOn: z.array(z.string().min(1)).optional(),\n",
    replace: "",
    tests: [`${C}/recipe-graph.test.ts`] },

  // ── 契约：母版画布的比例 ────────────────────────────────────────────────
  { label: "⚠️ **宽高比判据拿掉**（那张画布与资产的比谁都不管 ⇒ 同一个角色两种长相）",
    file: RECIPE,
    find: "    if (w * c.h !== c.w * h)",
    replace: "    if (false && w * c.h !== c.w * h)",
    tests: [`${C}/recipe-graph.test.ts`] },

  { label: "宽高比**算错**（叉乘写成 `w*c.w !== h*c.h` ⇒ 比例一致的也被拒）",
    file: RECIPE,
    find: "    if (w * c.h !== c.w * h)",
    replace: "    if (w * c.w !== h * c.h)",
    tests: [`${C}/recipe-graph.test.ts`] },

  { label: "母版**不存在**时也去比比例（同一件事报两遍）",
    file: RECIPE,
    find: "    const master = (r.authoring ?? []).find((a) => a.id === m);\n    if (master === undefined) return; // 「母版不存在」上面已经报过了，别报两遍",
    replace: "    const master = (r.authoring ?? []).find((a) => a.id === m) ?? { size: { w: 1, h: 0 } };",
    tests: [`${C}/recipe-graph.test.ts`] },

  // ── pack：排程 ───────────────────────────────────────────────────────────
  { label: "⚠️ **依赖等待整条拿掉**（顺序器没了 ⇒ 依赖在清单里是装饰）",
    file: PACK,
    find: "        for (const d of spec.dependsOn ?? []) {",
    replace: "        for (const d of [] as string[]) {",
    tests: [`${A}/pack-deps.test.ts`] },

  { label: "⚠️ **前置失败也照跑**（依赖者还是发出去 ⇒ 那一笔白花的钱）",
    file: PACK,
    find: "          const why = depFailure.get(d);",
    replace: "          const why: string | undefined = undefined; void depFailure.get(d);",
    tests: [`${A}/pack-deps.test.ts`] },

  { label: "⚠️ **无依赖时也串行**（顺序器把全并发拖成 v1 那样的墙钟）",
    file: PACK,
    find: "        for (const d of spec.dependsOn ?? []) {",
    replace: "        for (const d of recipe.assets.slice(0, idx).map((x) => x.spec.id)) {",
    tests: [`${A}/pack-deps.test.ts`] },
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
    try {
      execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });
    } catch {
      // ⚠️ **变异把编译弄红也是红**（判据拦住了它，只是拦在编译期）—— 但要说清是**哪一期**红的，
      //   否则这一发会被当成「判据够强」而其实是「类型够强」。
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
    const t = /Test Files +\d+ failed/.test(out) && /timed out/i.test(out);
    red = true; how = f ? f[1] : t ? "超时" : "非零退出";
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
