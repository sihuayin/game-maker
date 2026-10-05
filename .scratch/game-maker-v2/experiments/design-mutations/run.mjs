// 票 10 的**变异判据**：每一发改一处**真的**源码，跑定向测试，**必须变红**。
//
// ⚠️ 三条从票 03 / 06 / 08 / 09 学来的规矩，写进脚本里：
//   ① 改之前先断言那段**真的在、且只出现一次**（否则「全绿」是变异没生效）。
//   ② 每一发独立跑完再复原。
//   ④ **每一发要瞄准「有判据看着的那句话」** —— 第 22 发第一版瞄的是「不许挑个近似的」，
//      而测试只锚了旁边那句「整条省掉」⇒ 变异改掉了源码却**没改到被测的东西**。
//      修法是**把测试补宽**，不是把变异改软。
//   ③ **变异落在 `contracts/src` 时，测试读的是 `dist/` ⇒ 必须先 rebuild，且要 `--force`**
//      —— 增量状态下那次 build 可能是 no-op，dist 里会留着上一发变异版的 JS
//      （症状：变异全绿、紧接着 `pnpm test` 红一片）。票 09 两样都实吃过。
//
// 跑法：node .scratch/game-maker-v2/experiments/design-mutations/run.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const C = "packages/contracts/tests";
const T = "packages/game-design/tests";
const DESIGN = "packages/contracts/src/game-design.ts";
const VOCAB = "packages/contracts/src/vocabulary.ts";
const LEDGER = "packages/contracts/src/ledger.ts";
const BUILD = "packages/game-design/src/build-design.ts";
const COMPILE = "packages/game-design/src/compile-design.ts";
const PROMPTS = "packages/game-design/src/prompts.ts";

const M = [
  { label: "重采样只试一次（`STRUCTURED_CALL_ATTEMPTS` 名存实亡）",
    file: COMPILE,
    find: "for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++) {",
    replace: "for (let attempt = 1; attempt <= 1; attempt++) {",
    tests: [`${T}/compile-design.test.ts`] },

  { label: "`parseToolUse` 的结果不再当判据 —— 不过 Zod 也放行",
    file: COMPILE,
    find: '  if (!parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent };',
    replace: '  if (false && !parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent }; if (!parsed.ok) return { kind: "ok", spec: {} as never, spent };',
    tests: [`${T}/compile-design.test.ts`] },

  { label: "⚠️ **R12 的拒绝被当成模型失败**（拿去重采样）",
    file: COMPILE,
    find: "      call.trip({ spent: once.spent });\n      const ledger = call.record();\n      throw new DesignRejectedError(",
    replace: "      lastFailure = \"schema\"; lastDetail = once.detail; continue;\n      throw new DesignRejectedError(",
    tests: [`${T}/compile-design.test.ts`] },

  { label: "⚠️ 拒绝时**记了 failure**（那一发调用其实成功了）",
    file: COMPILE,
    find: "    if (once.kind === \"rejected\") {\n      // ⚠️ **这一发成功了**：`trip` 只带 `spent`，**不带 failure** —— 账上因此没有失败痕迹。\n      call.trip({ spent: once.spent });",
    replace: "    if (once.kind === \"rejected\") {\n      call.trip({ failure: \"schema\", spent: once.spent });",
    tests: [`${T}/compile-design.test.ts`] },

  { label: "传输层失败也拿去重采样",
    file: COMPILE,
    find: "      const ledger = call.record();\n      throw new CompileDesignError(once.failure, once.detail, ledger ? [ledger] : undefined);",
    replace: "      lastFailure = once.failure; lastDetail = once.detail; continue;",
    tests: [`${T}/compile-design.test.ts`] },

  { label: "传输层的病因**不进** `failures[]`",
    file: COMPILE,
    find: "      call.trip({ failure: once.failure });",
    replace: "      call.trip({});",
    tests: [`${T}/compile-design.test.ts`] },

  { label: "三个照抄值**不再覆盖**（模型写什么就是什么）",
    file: BUILD,
    find: "    game: { ...fromModel.game, ...callerKnownGame(profile, vws) }",
    replace: "    game: { ...fromModel.game }",
    tests: [`${T}/build-design.test.ts`] },

  { label: "相机判据写成「有 `camera:*` 就支持」（拒绝面悄悄关掉）",
    file: BUILD,
    find: "  if (need !== null && profile.capabilities.includes(need)) return [];",
    replace: "  if (profile.capabilities.some((c) => c.startsWith(\"camera:\"))) return [];",
    tests: [`${T}/build-design.test.ts`] },

  { label: "`top-down` 被当成做得了（`CAMERA_MODE_NEEDS` 那一格松掉）",
    file: BUILD,
    find: '  "top-down": null,',
    replace: '  "top-down": "camera:parallax",',
    tests: [`${T}/build-design.test.ts`] },

  { label: "覆盖度判据**不查机制**了（「二段跳」做丢了也没人管）",
    file: BUILD,
    find: "  for (const m of intent.mechanics)",
    replace: "  for (const m of [] as typeof intent.mechanics)",
    tests: [`${T}/build-design.test.ts`] },

  { label: "⚠️ 覆盖度判据变成**双向**（设计层不许补全 —— 与 R2-Q1 的裁定相反）",
    file: BUILD,
    find: "  const have = new Set(design.mechanics.map((m) => m.id));",
    replace: "  for (const b of [\"enemies\", \"npcs\", \"interactables\", \"resources\"] as const) for (const x of design[b]) if (!intent.entities.some((e) => e.id === x.id)) out.push({ reason: \"intent-entity-missing\", detail: \"多出来了\" });\n  const have = new Set(design.mechanics.map((m) => m.id));",
    tests: [`${T}/build-design.test.ts`] },

  { label: "覆盖度判据**不按 `type` 落桶**（串桶查不出来）",
    file: BUILD,
    find: "    const bucket = ENTITY_BUCKETS[e.type];",
    replace: '    const bucket = "enemies" as const;',
    tests: [`${T}/build-design.test.ts`] },

  { label: "`ENTITY_BUCKETS` 把 `resource` 指错桶（名字的家被改坏）",
    file: VOCAB,
    find: '  resource: "resources"',
    replace: '  resource: "interactables"',
    tests: [`${C}/vocabulary.test.ts`] },

  { label: "`LedgerStep` 去掉 `compile-design`（这一步在账上再次隐形）",
    file: LEDGER,
    find: '  "compile-design",\n',
    replace: "",
    tests: [`${C}/structured-call.test.ts`] },

  { label: "gate：必填字符串非空整条拿掉",
    file: DESIGN,
    find: "  for (const [label, s] of strings) if (blank(s)) issue(",
    replace: "  for (const [label, s] of strings) if (false && blank(s)) issue(",
    tests: [`${C}/game-design-gate.test.ts`] },

  { label: "gate：`levels[].entities[]` 的悬空引用不查了",
    file: DESIGN,
    find: "      if (!seen.has(ref))",
    replace: "      if (false && !seen.has(ref))",
    tests: [`${C}/game-design-gate.test.ts`] },

  { label: "gate：id 跨四桶重复不查了",
    file: DESIGN,
    find: "      if (first !== undefined)",
    replace: "      if (false && first !== undefined)",
    tests: [`${C}/game-design-gate.test.ts`] },

  { label: "gate：拿掉 `levels ≥ 1`（零关卡的设计放行）",
    file: DESIGN,
    find: '    ["mechanics", v.mechanics.length],\n    ["levels", v.levels.length]\n',
    replace: '    ["mechanics", v.mechanics.length]\n',
    tests: [`${C}/game-design-gate.test.ts`] },

  { label: "gate：把**四个桶**塞进「≥1」（障碍跑式关卡被判死）",
    file: DESIGN,
    find: '    ["levels", v.levels.length]',
    replace: '    ["levels", v.levels.length],\n    ["enemies", v.enemies.length]',
    tests: [`${C}/game-design-gate.test.ts`] },

  { label: "提示词骨架**丢掉字段台账**（① 档欠条的「逐个点名」没了）",
    file: PROMPTS,
    find: '${Object.entries(DESIGN_FIELD_HINTS).map(([k, v]) => `- \\`${k}\\` —— ${v}`).join("\\n")}',
    replace: "（自己看着办）",
    tests: [`${T}/design-prompts.test.ts`] },

  { label: "⚠️ 提示词丢掉「**依据是需求**」那句（补全当场退化成「模型觉得总该有」）",
    file: PROMPTS,
    find: "⚠️ **但依据是需求，不是「你觉得游戏里应该有」**",
    replace: "⚠️ 想加就加。",
    tests: [`${T}/design-prompts.test.ts`] },

  { label: "工具说明丢掉「做不了就**整条省掉**」（静默损失那一档没了防线）",
    file: PROMPTS,
    find: "**不许**挑一个「近似的」顶上去",
    replace: "挑一个最接近的顶上去也行",
    tests: [`${T}/design-prompts.test.ts`] },

  { label: "提示词不再插**意图层的 ① 档字段** `world.atmosphere`",
    file: PROMPTS,
    find: "- 世界：${intent.world.theme} · ${intent.world.setting} · **氛围**：${intent.world.atmosphere}",
    replace: "- 世界：${intent.world.theme} · ${intent.world.setting}",
    tests: [`${T}/design-prompts.test.ts`] },

  { label: "提示词不再插 **VWS 的 `composition`**（`world.structure` 那个落点断了）",
    file: PROMPTS,
    find: "${describeComposition(vws)}",
    replace: "（自己编）",
    tests: [`${T}/design-prompts.test.ts`] },
];

let bad = 0;
for (const [i, m] of M.entries()) {
  const abs = path.join(ROOT, m.file);
  const original = fs.readFileSync(abs, "utf8");
  const hits = original.split(m.find).length - 1;
  if (hits !== 1) { console.log(`❌ ${i + 1}. ${m.label}\n     变异锚点在文件里出现 ${hits} 次（要求恰好 1 次）—— **源码没动，这一发不算数**`); bad++; continue; }
  fs.writeFileSync(abs, original.replace(m.find, m.replace));

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
    fs.writeFileSync(abs, original);
  }
  console.log(`${red ? "✅" : "❌"} ${i + 1}. ${m.label}${red ? ` —— 变红（${how}）` : " —— **没有变红！判据漏了这一条**"}`);
  if (!red) bad++;
}
execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });
execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/game-design"], { cwd: ROOT, stdio: "pipe" });
console.log(bad === 0 ? `\n✅ ${M.length} 发变异全部验过会红` : `\n❌ ${bad} 发有问题`);
process.exit(bad === 0 ? 0 : 1);
