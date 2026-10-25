# 兼容矩阵裁定：语义兼容性的判据粒度

Type: grilling
Status: resolved
Blocked by: 01

## Question

`sourceIntent` 指向真实设计 ID 不代表映射正确。现有 QA 矩阵 `DESIGN_BUCKET_KINDS`
（`qa/src/visual.ts:186-191`）只约束「设计桶 ↔ 运行时 kind」，无法区分 `interactables` 桶内的
宝箱、出口与其他交互对象 —— 仍无法拒绝 `goal → chest`。

必须维持：不改 schema；不名称模糊匹配；不让模型自解释放行；保留合法 1:N；无 `sourceIntent`
的结构性实体继续允许；不动资源路由 / QA 其他判据 / 生命周期。

**A1 — 兼容性采用哪一级判据？**

- **A.** 只复用设计桶→kind 矩阵（改动最小，但同桶 `goal → chest` 仍漏）。
- **B.** 桶矩阵 + 精确子类型映射：对可确定解释的 `interactables[].type` 建封闭映射（依赖票 01 盘点）；
  不认识 / 无法确定的类型不得静默放行。
- **C.** 只对可严格证明的错误增加拒绝规则：保留现有矩阵，不依赖自由文本推断；若 schema 无法识别
  宝箱 / 出口差异，就明确记录「同桶误归属未彻底解决」，不谎称已解决。

**A2 — 未知设计子类型如何处理？**

- 拒绝：未知类型的非空身份映射直接判错，要求符合明确兼容契约。
- 放行：只要桶↔kind 兼容就允许，子类型暂不作为硬判据。

当前倾向（用户 2026-10-25）：**优先 B，但必须建立在票 01 的真实取值分布盘点之上**；若盘点显示
`type` 开放无界，B 不可行，退到 C。兼容矩阵必须既拒错误归属，又不能靠误拒合法设计制造
「通过率下降 = 修复成功」的假象。

**票 01 盘点已回（2026-10-25）**：`type` **开放无界**（30 份 spec / 57 条 / 28 distinct 值、含自由散文）⇒ **B 不可行**。
且唯一有 `sourceIntent` 的配对样本 e2e-r2 现场复现了 `gate`(kind=goal, sourceIntent="chest") 错归属 ——
现有 `auditEntityIdentity`（只查覆盖+悬空）放过了它。⇒ A1 落在 A 与 C 之间，倾向 C。
A2「未知类型」在开放文本下没有「已知/未知」边界，需一并重判（见票 02 收口）。

## Answer

裁定（用户 2026-10-25 收口；**同日修订为 C 路线**）：**只收可严格证明的跨桶规则**，不用桶矩阵制造误拒来假装解决同桶误归属。

| 设计桶 | 允许的运行时 `kind` |
|---|---|
| `enemies` | `hazard`, `danger` |
| `npcs` | `decor` |
| `interactables` | `chest`, `pickup`, `goal`, `hazard`, `danger`, `solid`（**保持原样**，除 `decor` 外全部）|
| `resources` | `pickup` |

**修订原因**：初裁「摘除 `interactables` 的 `goal`/`solid`」在 Phase 1 全仓跑出 16 个误拒 ——
真实夹具 `last-train` 的 `i-signal`（信号灯交互物）**合法**映射到 `goal`（终点），摘 `goal` 会拒掉它。
⇒ 同桶（`interactables` 内 `goal`↔`chest`）靠 `type`/`behavior` 开放文本区分，票 01 已证不可靠，
不能靠桶矩阵制造误拒来假装解决。**C 路线：只拦可严格证明的跨桶错误**（enemy 被做成 pickup / resource 被做成 hazard 等）。

**本票真正交付**：兼容矩阵落为 contracts **单一来源** + **编译期**跨桶检查（`auditEntityIdentity` 第 ③ 步，
早于资源生成），把原本只在 QA 事后查的跨桶错误提到编译期硬失败。

**已知限制（明写，不谎称解决）**：`interactables` 内部「信号灯→goal 对 / 宝箱→goal 错」桶矩阵无法区分；
`gate(goal)→chest` 这类同桶误归属**不在本票射程内**，留待后续机制（提示词加固或独立调查）。

**实现注意**：兼容矩阵单一来源（QA `DESIGN_BUCKET_KINDS` 与编译期共用）；与票 03 的关卡作用域
**分开**定位错误（兼容性错误报设计桶 + 运行时 kind + `sourceIntent`；作用域错误报 `wrong-scope`）。

**回归测试**：
- 跨桶拒绝：enemy → pickup、resource → hazard。
- 桶内放行：interactable → chest/pickup/goal/hazard/danger/solid 六种全通过。
- 同桶不误拒（记录限制）：interactable → goal（gate→chest）仍放行。
- 两个 enemy 同源 1:N 通过；goal/solid 孤儿不带 `sourceIntent` 不拒。
