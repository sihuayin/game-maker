// **QA 的判据族 + 它们的汇合处**（票 17 / 18 / 19 / 20）—— 这一包只依赖 `contracts`
// （票 07 的白名单）。
//
// ⚠️ **三个族**：
//   · `visual.ts`   —— 视觉那两条（票 17）：`constructive-constraint` · `palette-binding`；
//   · `gameplay.ts` —— 玩法那两条（票 18）：`reference-resolution` · `reachability`；
//   · `intent.ts`   —— 意图那一条（票 19）：`intent-coverage`（**只有 id 那一半**）。
// ⚠️ 六条判据里的第六条 `layer-coverage`（层覆盖）**不属于任何族** ——
//   2026-10-22 起由**合成器自己**跑（`layers.ts`，判据本体仍是装配期的 `auditLayerCoverage`）
//   ⇒ `checked` 回到 6/6、`qaVerdict` 不再恒为 `incomplete`（见 `contracts/src/qa.ts` 四①）。
//
// ⚠️ 一个族的**出口是「族结果」而不是一份报告**（票 18 的 R2-Q4）：一个族**只声明自己那几条**
//   （`QaFamilyResult.judgements` 是 `Partial`），**缺席 = 不归本族**。
//   谁把三族凑成一份 `qa-report.json`、谁补齐那两条观察 —— 是 **`assemble.ts`**（票 20）：
//   它导出的 `qaRunner` **就是** `QaRunner`（`(ctx) => Promise<QAReport>`），
//   `pipeline` 的 `runBuild` 默认接的就是它。
//   ⚠️ 那不是「顺手拼一下」：一份族结果**落盘过不了 `qa-report/v1`**（`superRefine` ④ 要求
//     每个观察来源恰好一条，票 18 实测到了），而补齐那两条**只有汇合处做得成**。
//
// ⚠️ 还没落地的：修复循环（票 21）。
export * from "./visual.js";
export * from "./gameplay.js";
export * from "./intent.js";
export * from "./layers.js";
export * from "./assemble.js";
export * from "./pixel.js";
