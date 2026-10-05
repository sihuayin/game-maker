// 把「模型吐出来的那一份」装配成**契约成品**：注入两件调用方才知道的东西，然后**重新过一次契约**。
//
// ⚠️ **为什么需要这一步**（而不是直接信模型）：有两处**模型答不出来、也不该被问**：
//   ① `styleReferences[].path` 是**相对于 `visual-world.json` 自身**的，
//      而 `analyzeReference` 只返回值、不写文件 —— 它在组装提示词时**根本不知道**最终路径。
//      ⇒ 这一个键**从模型面向的 schema 里被 `omit` 掉了**（票 08 的 R1-Q2），由这里填回来。
//   ② `style.id` 是**身份不是观察**（票 02 裁决 21）—— 提示词递给模型照抄，这里**强制覆盖**。
//
// 判据是那条分界线（票 08 的 R2-Q6）：**投影只在「模型不可能知道」时才正当**。
// 所以这里**只**注入这两件，`style` 子树的其余字段一个都不动 —— 模型看得见的那些，
// 就该由模型负责（它答不好，是提示词要修的事，不是这里替它决定的理由）。
//
// ⚠️ **重新过契约不是客套**：注入是我们干的，注入错了是**我们**的事，不该一路走到磁盘上
//   才由下游炸。⚠️ 而且**票 08 的那条越界 gate 正是在这一步响的** ——
//   `superRefine` 会被 `toJSONSchema` 丢掉，所以它拦不住模型，只能拦**成品**。
import { VisualWorldSpecSchema, formatIssues, type StyleReference, type VisualWorldSpec } from "@game-maker/contracts";

/** 模型面向的 schema 比契约**少一个键**：`styleReferences` 由调用方注入。 */
export type VisualWorldFromModel = Omit<VisualWorldSpec, "styleReferences">;

export type BuildVisualWorldInput = {
  /** 模型吐出来的那一份（已过 `ModelFacingSpec`，所以**没有** `styleReferences`）。 */
  fromModel: VisualWorldFromModel;
  /** 调用方给的参考图登记。第一阶段恰好 1 项（R18 的 `maxItems` 由**调用方**执行）。 */
  styleReferences: StyleReference[];
  /** 调用方给的风格身份（票 08 的 R2-Q2：参考图 basename 的 slug，由 CLI 生成）。 */
  styleId: string;
};

export type BuildVisualWorldOutcome =
  | { ok: true; spec: VisualWorldSpec }
  | { ok: false; detail: string };

export function buildVisualWorld(input: BuildVisualWorldInput): BuildVisualWorldOutcome {
  const candidate = {
    ...input.fromModel,
    styleReferences: input.styleReferences,
    style: { ...input.fromModel.style, id: input.styleId },
  };
  // ⚠️ 失败**不是**「上游/模型的错」那一类 —— 它是**成品不过契约**。调用方（`analyzeReference`）
  //   把它归到 `schema` 那一档并重采样，因为绝大多数情况下致病的是模型吐的那半边。
  const r = VisualWorldSpecSchema.safeParse(candidate);
  if (!r.success) return { ok: false, detail: formatIssues(r.error).slice(0, 4).join("；") };
  return { ok: true, spec: r.data };
}
