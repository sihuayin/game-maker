# 04. VDS ↔ GameDesignSpec 覆盖契约（语义 QA §8.2）

Type: grilling
Status: resolved
Owner: claude · 2026-10-24
Blocked by: 03
Map: ../map.md

## Question

钉死「语义覆盖」的判据：GameDesignSpec 里**哪些实体/机制必须**在 VDS 中有对应视觉表达，覆盖怎么机械判。

- GameDesignSpec 的实体桶是 `enemies / npcs / interactables / resources`（+ player / terrain / objective）。
  是否**每一桶的每一个实体**都必须在 VDS 有一个 object？还是只有「有画面的实体」（对照 `CONTEXT.md`「实体 vs 地形」：
  看不见的进地形、看得见的进实体）？
- 覆盖判据用 **id 判**（沿用 `意图覆盖` 票 19 的「只按 id 判」），还是按 role/type？
- 「缺对象」是**判据**（硬失败，PRD AC-04 说「缺少对象时 QA 必须失败或明确报告缺失」）还是**观察**？
- 设计层多出意图是「补全」（允许）；VDS 多出 GameDesignSpec 没有的对象（纯装饰）怎么处理 —— 允许（装饰）还是也要追来源？

这是 HITL：用 grilling + domain-modeling 当面把「覆盖」这个模糊词钉成可机械判的判据。

## Answer

「覆盖」钉成**实体覆盖**判据（人裁 2026-10-24：Q1–Q5 全采纳 + 补一条 `S∖D` 悬空硬失败）。

**定义**（集合差，只按 id，不依赖视觉相似度）：

- `D` = GameDesignSpec 设计实体 id 集合 = `player.id` + 四桶（`enemies/npcs/interactables/resources`）每一项的 `id`。
- `S` = VDS 里**带 `sourceIntent` 的 object** 所引用的 id 集合（去重）。**无 `sourceIntent` 的对象 = 纯装饰，不进 `S`，不进分母。**

**两条硬失败（判据）**：

1. **缺失** `D ∖ S ≠ ∅` —— 设计实体没被任何 VDS object 命中 ⇒ 拒绝。VDS 是编译器从设计**派生**的：设计点名了实体、VDS 漏画 = 编译器丢东西，错的一定不是设计。
2. **悬空** `S ∖ D ≠ ∅` —— `sourceIntent` 指向设计里不存在的 id ⇒ 拒绝。有来源就必须引用真实设计实体；拼写错/过期 id 不是合法装饰。
   ⇒ 净效果 **`S = D`（作为集合）**。同一实体对应多个 VDS object **允许**（判 `≥1`，不是 `恰 1`）。

**三条明确不判（排除项，各归各家）**：

- `mechanics[]` —— 不进 VDS 覆盖（机制端到端另归 `mechanic-coverage.ts` 三层矩阵；`jump` 由 player 体现，不造机制对象）。
- `role ↔ kind` 一致性 —— 归票 07（VDS↔GameConfig 交叉验证），本票**不重复定义同一判据**。
- 装饰对象 / 主观视觉质量 —— 不判（无 `sourceIntent` 不追问依据；构图/比例归后续 QA 地图）。

**落点**：跨文件（VDS vs `game-design.json`），装配/QA 步判；返回中性 `MissingVDSItem[]`（同 `intent-coverage.ts` 的 `MissingIntentItem[]` 纪律），「缺失」与「悬空」**分开**报告。归哪一族/哪一步执行 → 待票 06（确定性验证）与票 07（交叉验证）一起收口，本票只定判据不定落点。
