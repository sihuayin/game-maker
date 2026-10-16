// 票 77 · 第二个探针 —— **只读 · 零付费 · 零网络**。
// 量的是：`carryOnError(e, { ledger: 累积数组 })` 这句话，在**我们想挂的那几处**到底挂不挂得上。
// 用**出货的**契约实现跑（`packages/contracts/dist/command.js`），不是本脚本自己重写的等价物。
import path from "node:path";
import { pathToFileURL } from "node:url";
const HERE = path.dirname(new URL(import.meta.url).pathname);
const { carryOnError, ledgerOfError, CommandError } =
  await import(pathToFileURL(path.resolve(HERE, "../../../../packages/contracts/dist/command.js")).href);

const A = { step: "analyze-reference", target: "visual-world", attempts: 1 };
const B = { step: "analyze-intent", target: "game-intent", attempts: 1 };
const C = { step: "compile-design", target: "game-design", attempts: 1 };
const X = { step: "compile-runtime", target: "game-config", attempts: 1 };
const shown = (e) => { const g = ledgerOfError(e); return g ? JSON.stringify(g.map((c) => c.step)) : "undefined"; };

function trial(label, note, make) {
  const e = make();
  const before = shown(e);
  const had = "ledger" in e;
  carryOnError(e, { ledger: [A, B, C] });
  const after = shown(e);
  const ok = after !== before;
  console.log(`${label}`);
  console.log(`   ${note}`);
  console.log(`   \`"ledger" in e\` 挂之前 = ${had}`);
  console.log(`   账：挂之前 ${before}  →  挂之后 ${after}   ${ok ? "⭐ 挂上了" : "⚠️ **没挂上（空操作）**"}`);
  console.log("");
  return ok;
}

console.log("票 77 · 第二个探针 —— 「挂累积的账」这句话挂不挂得上\n");

const r1 = trial(
  "情形 ①：异常上**已经**有一行账",
  "（`ops.ts` 每一处 `ledgerCarrying(call.record())` 造的就是这个形状：段 A / 段 B 的 config）",
  () => new CommandError("invalid", "配置过不了业务校验", { ledger: [X] }),
);

const r2 = trial(
  "情形 ②：异常上**没有**账 —— 而构造时**连第三个参数都没给**",
  "（`assertQaPassed`（`create-game.ts:205`）与 `failWith`（`layout.ts:56`）今天就是这个形状）",
  () => new CommandError("invalid", "装配期校验不过"),
);

const r3 = trial(
  "情形 ③（对照）：异常是**普通 `Error`**",
  "（`ops.ts:1248` 与 `packAssets` 的 catch 靠的就是这一档 —— 它是有效的）",
  () => new Error("判断失败：全透明的图"),
);

console.log("⇒ 读出来的：");
console.log(`   ① ${r1 ? "挂得上" : "**挂不上**"} · ② ${r2 ? "挂得上" : "**挂不上**"} · ③ ${r3 ? "挂得上" : "挂不上"}`);
console.log("");
console.log("⚠️ ② 挂不上，是因为 `CommandError` 的构造器**无条件**赋 `this.ledger = opts.ledger`");
console.log("   ⇒ `'ledger' in e` **恒真** ⇒ `carryOnError` 的「只加不改」（`command.ts:133-140`）");
console.log("   把它当成「下层已经挂过了」，于是一次**静默的空操作**。");
console.log("   ⚠️ 仓库自己已经记着这条：`ops.ts:1233-1235` 逐字「`CommandError` 的构造器**无条件**赋");
console.log("      `ledger`/`failureDir` ⇒ `'ledger' in e` 恒真 ⇒ 下面那句 `carryOnError` 对它们本来就是个 no-op」。");
console.log("");
console.log("   ⇒ 结论：票面把 (a) 说成「要动 `ledgerCarrying` 的形状」——");
console.log("     ⚠️ 而量下来它有个**更靠前**的坎：在我们最想挂的那两个抛点上，");
console.log("     `carryOnError` 这个**动词本身**就是空操作（①②），与挂的是什么形状无关。");
