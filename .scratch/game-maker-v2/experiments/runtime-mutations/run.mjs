// 票 14 的**变异判据**：每一发改一处**真的**源码，跑定向测试，**必须变红**。
//
// ⚠️ 六条规矩（03/06/08/09/10/11/12 一路攒下来的）都写进脚本：
//   ① 先断言锚点**真的在、且只出现一次**；② 每发独立复原；③ 瞄「有判据看着的那句话」；
//   ④ 变异落在 `contracts/src` 时要 rebuild **且加 `--force`**；⑤ 变异把编译弄红也算红（要说清是哪一期）；
//   ⑥ **靶子要与判据对齐** —— 源码改了、被测的那句没动，就是「变异是空的」。
//
// 跑法：node .scratch/game-maker-v2/experiments/runtime-mutations/run.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const C = "packages/contracts/tests";
const A = "packages/assets/tests";
const LEDGER = "packages/contracts/src/ledger.ts";
const MIRROR = "packages/contracts/src/config-tool.ts";
const CONFIG = "packages/contracts/src/game-config.ts";
const OPS = "packages/assets/src/ops.ts";
const T = [`${A}/compile-runtime.test.ts`];

const M = [
  // ── 那两层判据 ────────────────────────────────────────────────────────────
  { label: "⚠️ **跳过 v3 契约那一步**（线形状过了就当真 ⇒ 重复 id 的配置会被落盘）",
    file: OPS,
    find: "    const truth = parseGameConfig(once.result.value);",
    replace: "    const truth = { ok: true as const, value: once.result.value };",
    tests: T },

  { label: "⚠️ **业务校验不过也照落**（恢复旧行为 —— R9 之后 config 那里已经没有读者了）",
    file: OPS,
    find: "  if (hard.length > 0)",
    replace: "  if (false && hard.length > 0)",
    tests: T },

  { label: "⚠️ 拒绝的消息不再点出「**这不是模型没生成好**」（两类失败混回一类）",
    file: OPS,
    find: '"\\n⚠️ **这不是模型没生成好** —— 一份过得了契约、过不了业务校验的配置，说明是**这份设计配这个包**"',
    replace: '"\\n⚠️ 模型这次没生成好 —— "',
    tests: T },

  // ── profile 分派 ──────────────────────────────────────────────────────────
  { label: "⚠️ profile **不从设计层读**（写死 platformer ⇒ 设计说哪一代没人听）",
    file: OPS,
    find: "  const want = design.game.runtimeProfile;",
    replace: '  const want = { id: "platformer", version: "1" }; void design.game.runtimeProfile;',
    tests: T },

  { label: "`levelId` 指了个不存在的关也照编（**悄悄编第一关**）",
    file: OPS,
    find: "  const level = design.levels.find((l) => l.id === levelId);",
    replace: "  const level = design.levels[0];",
    tests: T },

  // ── 出发前那道凭据检查 ────────────────────────────────────────────────────
  { label: "⚠️ **空凭据也照发**（本地配置错被计成上游故障 —— 票 46 那个坑）",
    file: OPS,
    // ⚠️ 锚点**必须独一无二**：这一行的字面在 `compileTdGame` 里也有一条（同款检查），
    //   而 `String.replace(str, …)` 只替**第一处** ⇒ 第一版改中的是塔防那一行、本处纹丝不动，
    //   于是「变异没红」是**变异没打到靶**，不是判据弱。带上它前面那句只此一处的注释。
    find: '  //   `failure: "http"`，**一个本地配置错被计成上游故障**。⚠️ 报错里点名那两个环境变量。\n  if (!opts.transport || opts.transport.baseUrl === "" || opts.transport.apiKey === "")',
    replace: '  //   `failure: "http"`。\n  if (!opts.transport)',
    tests: T },

  // ── 契约侧 ────────────────────────────────────────────────────────────────
  { label: "`LedgerStep` 去掉 `compile-runtime`（这一步在账上隐形）",
    file: LEDGER,
    find: '  "compile-runtime",\n',
    replace: "",
    tests: [`${C}/structured-call.test.ts`] },

  { label: "⚠️ 镜像 **`z.strictObject` 改回 `z.object`**（多余的键被静默剥掉、不再拒）",
    file: MIRROR,
    find: "export const ConfigToolSchema = z.strictObject({",
    replace: "export const ConfigToolSchema = z.object({",
    tests: [`${C}/config-tool.test.ts`] },

  { label: "⚠️ 镜像把**速度也写成整数**（「坐标一律整数」那条规矩的例外被抹掉）",
    file: MIRROR,
    find: "const PlayerMoveShape = z.strictObject({\n  speed: z.number().positive(),",
    replace: "const PlayerMoveShape = z.strictObject({\n  speed: z.number().int().positive(),",
    tests: [`${C}/config-tool.test.ts`] },

  { label: "⚠️ **`Entity` 不封口**（`scale` 悄悄能进来了 —— 票 09 那条禁令失去结构保证）",
    file: CONFIG,
    find: "  motion: Motion.optional(),\n}).strict();",
    replace: "  motion: Motion.optional(),\n});",
    tests: [`${C}/game-config.test.ts`] },

  // ── 提示词 ────────────────────────────────────────────────────────────────
  { label: "⚠️ 提示词不再插 ① 档字段 `world.structure`",
    file: "packages/assets/src/prompt.ts",
    find: "    `- \\`world.structure\\`：${d.world.structure}`",
    replace: "    `- （这一条故意拿掉）`",
    tests: T },

  // ⚠️ 第一版的靶子瞄错了：我改的是**示例那一行**，而判据看的是 `designBrief` 里带关卡 id 的那句
  //   ⇒ 源码改了、被测的那句没动（票 10 / 12 那口老坑的第三次）。
  { label: "⚠️ 提示词不再说「编的是**哪一关**」（关卡 id 从设计简报里消失）",
    file: "packages/assets/src/prompt.ts",
    find: "`- 关卡 \\`${l.id}\\` —— \\`levels[].purpose\\`：${l.purpose}｜怎么走：${l.layout}｜这一关有：${l.entities.join(\" / \") || \"（空）\"}`",
    replace: "`- 有一关：${l.purpose}｜怎么走：${l.layout}`",
    tests: T },
];

let bad = 0;
for (const [i, m] of M.entries()) {
  const abs = path.join(ROOT, m.file);
  const original = fs.readFileSync(abs, "utf8");
  const hits = original.split(m.find).length - 1;
  if (hits !== 1) { console.log(`❌ ${i + 1}. ${m.label}\n     锚点在文件里出现 ${hits} 次（要求恰好 1 次）—— **源码没动，这一发不算数**`); bad++; continue; }
  fs.writeFileSync(abs, original.replace(m.find, m.replace));

  let red = false, how = "";
  if (m.file.startsWith("packages/contracts/src/")) {
    try { execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" }); }
    catch {
      fs.writeFileSync(abs, original);
      execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });
      console.log(`✅ ${i + 1}. ${m.label} —— 变红（**编译期**）`);
      continue;
    }
  }
  try { execFileSync("npx", ["vitest", "run", ...m.tests], { cwd: ROOT, stdio: "pipe" }); }
  catch (e) {
    const out = String(e.stdout ?? "") + String(e.stderr ?? "");
    const f = /Tests +(\d+ failed)/.exec(out);
    red = true; how = f ? f[1] : "非零退出";
  } finally { fs.writeFileSync(abs, original); }
  console.log(`${red ? "✅" : "❌"} ${i + 1}. ${m.label}${red ? ` —— 变红（${how}）` : " —— **没有变红！判据漏了这一条**"}`);
  if (!red) bad++;
}
execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/contracts"], { cwd: ROOT, stdio: "pipe" });
execFileSync("pnpm", ["-w", "exec", "tsc", "-b", "--force", "packages/assets"], { cwd: ROOT, stdio: "pipe" });
console.log(bad === 0 ? `\n✅ ${M.length} 发变异全部验过会红` : `\n❌ ${bad} 发有问题`);
process.exit(bad === 0 ? 0 : 1);
