// **QA 的判据族**（票 17 / 18 / 19 / 20）—— 这一包只依赖 `contracts`（票 07 的白名单）。
//
// ⚠️ **两个族已经落地**：
//   · `visual.ts`   —— 视觉那两条（票 17）：`constructive-constraint` · `palette-binding`；
//   · `gameplay.ts` —— 玩法那两条（票 18）：`reference-resolution` · `reachability`。
//
// ⚠️ **出口是「族结果」而不是一份报告**（票 18 的 R2-Q4）：一个族**只声明自己那几条**
//   （`QaFamilyResult.judgements` 是 `Partial`），**缺席 = 不归本族**。
//   谁把三族凑成一份 `qa-report.json`、谁补齐那两条观察，归**票 20**（合成器）——
//   ⚠️ 那不只是「装配」：一份族结果**落盘会过不了 `qa-report/v1`**（`superRefine` ④ 要求
//   每个观察来源恰好一条，而票 18 实测到了这件事）。
//
// ⚠️ 还没落地的：意图那一族（票 19）、修复循环（票 21）。
export * from "./visual.js";
export * from "./gameplay.js";
