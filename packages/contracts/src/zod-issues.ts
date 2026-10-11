// Zod 错误的**唯一一份**人可读格式化器。
//
// ⚠️ **2026-10-01 从 `drawlist.ts` 搬出来**（票 28 的 code review）：它原来住在一个**画图**模块里，
//   而 `drawlist.ts` 与「错误长什么样」毫无关系 —— 那让那个文件**为了两个不相干的理由被改**
//   （Divergent Change）。`structured-call.ts` 要用它时更明显：一个 V2 的结构化调用
//   去 import 旧契约的画图模块，看着就像走私。
//
// ⚠️ 值取决于「**能不能定位**」（R2 之后确定性校验是唯一留下的质量控制）——
//   「某个 op 有问题」在 20 个 op 的产物上等于没说。
/**
 * ⚠️ **形参故意是结构类型，不是 `z.ZodError`**：本仓库现在装着两套 Zod ——
 *   旧契约用 `zod`（v3），V2 新契约用 `zod/v4`，两者的错误对象**形状一样但类型不同**。
 *   收窄成 v3 的 `ZodError` 会逼出**第二份实现**，而「两份实现可以各错各的」是本仓库反复吃的亏。
 *   两个版本都满足这个形状：`{ issues: [{ path, message }] }`。
 */
export type IssueLike = {
  path: readonly PropertyKey[];
  message: string;
  /** v3 的联合错误（v4 没有它，这里是空转）。 */
  unionErrors?: readonly { issues: readonly IssueLike[] }[];
  issues?: readonly IssueLike[];
};

/** 摊平成 `ops[1].cy: 期望 number` 这种可定位的字符串。 */
export function formatIssues(error: { issues: readonly IssueLike[] }): string[] {
  const flat = (issues: readonly IssueLike[]): IssueLike[] =>
    issues.flatMap((i) => (Array.isArray(i.unionErrors)
      ? i.unionErrors.flatMap((u) => flat(u.issues))
      : Array.isArray(i.issues) ? flat(i.issues) : [i]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of flat(error.issues)) {
    // ⚠️ `String(p)`：`PropertyKey` 含 `symbol`，直接插进模板串会在**运行时**炸（TS2731）。
    const path = i.path.reduce<string>((acc, p) => (typeof p === "number" ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)), "");
    const line = `${path || "<根>"}: ${i.message}`;
    if (!seen.has(line)) { seen.add(line); out.push(line); }
  }
  return out;
}

// ⚠️ **`parseWith` 已删除**（票 29，2026-10-11）。它从落地那天起就是**零调用者**
//   （`drawlist.ts` 那条再导出注释写着「免得既有调用方一行都要改」—— 而既有调用方**一个都没有**）。
//   人类 2026-10-11 的裁定：**不留空壳** —— 「为将来留着的辅助函数」正是票 09（`GameSpec`）
//   与票 18（`ArtifactRef`）反复处死的那种东西，它会让下一个读代码的人以为它是活的。
//   ⚠️ **它还有一条结构性的死因**：签名锚在 **v3** 的 `z.ZodType` 上，而 V2 新契约是 **v4**
//   （票 28 的边界：两套 Zod 不许互相嵌套）⇒ 它在 V2 那一侧**用不了**（`qa/src/intent.ts` 记录过）。
//   ⚠️ **`formatIssues` 留着**（它有真调用者），`IssueLike` 也留着（它是 `formatIssues` 的形参类型）。
//   今天的收口写法是 `schema.safeParse(...)` + `formatIssues(error)` —— 全仓一致。
