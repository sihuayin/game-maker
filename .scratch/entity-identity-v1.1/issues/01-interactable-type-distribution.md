# 盘点 interactables[].type 真实取值分布

Type: research
Status: resolved

## Question

`interactables[]` 的 `type` 是 `z.string()` 开放自由文本（`game-design.ts:170`），非封闭枚举。
票 02（兼容矩阵）要决定能否建「精确子类型 → 运行时 kind」的封闭映射（其 A1=B 依赖此结论）。
在裁决前，必须盘点真实设计规格里 `type` 到底取过哪些值，以及每个取值在真实 E2E 里最终映射成了哪个运行时 `kind`。

要回答：

1. **取值分布**：扫描 `fixtures/`、`inputs/`、`.scratch/**/runs/**/game-design.json`（含 `.failed-*`）里
   所有 `interactables[]`，列出 `type` 的**去重取值清单**与每个值出现次数。
2. **封闭还是开放**：这个取值集合是**封闭可枚举**（就这几个值），还是**开放无界**（自由文本、可无限新增）？
   判断依据：schema 是否 `z.enum`（已知不是）；真实样本里是否有「无法归类」的自由文本值。
3. **真实映射**：对每个 distinct `type` 值，在能配对的真实 config（同 run 的 `game-config.json`）里，
   该设计实体（按 `sourceIntent` 对齐）最终成了哪个运行时 `kind`？给「type → kind」真实对照表。
4. **边界**：`type` 之外，`interactables[].behavior` 是否也承载了可区分「宝箱 / 出口 / 机关」的信号？
   还是只有 `type` 有意义？

交付物：`.scratch/entity-identity-v1.1/assets/interactable-type-distribution.md`，每条带来源路径。
不得臆造取值；样本里没有的 `type` 就说没有；「type → kind」只能来自真实配对样本，不得推断。

## Answer

盘点完成，全量事实表见 [`assets/interactable-type-distribution.md`](../assets/interactable-type-distribution.md)。

**结论**：
- 扫 30 份 `game-design.json`、57 条 `interactables[]`；distinct `type` 值 **28 个**，同一概念十几种拼法（`chest` / `宝箱` / `可开启容器` / 整句自由文本）。
- **开放无界**：`type` 是 `z.string()`（`game-design.ts:171`），非 `z.enum`；有自由散文值。⇒ A1=B（精确子类型映射）**不可行**。
- **真实 `type → kind`**：唯一有 `sourceIntent` 的配对样本（`entity-identity-v1/runs/2026-10-25-e2e-r2`）里
  `type="chest"` → **同时 `chest` 与 `goal`**（一个 chest 实体 + 一个 goal 出口实体，都 `sourceIntent:"chest"`）。
  这正是 PRD 头条 bug 的现场复现：`gate`(kind=goal) 被错误归属到 `chest`，而现有 `auditEntityIdentity`（只查覆盖+悬空）放过了它。
- `type` 单独**无法**区分 chest vs goal；语义信号在 `behavior` 自由文本（打开/释放 vs 撤离/终点 vs 伤害），但 `behavior` 同样开放。

**对票 02 的含义**：A1 落在 A（桶矩阵，漏同桶）与 C（只拒绝可严格证明的错误）之间，倾向 C；桶级矩阵 `interactables → [chest, …, goal, …]` 同时允许两者，本身也漏。
