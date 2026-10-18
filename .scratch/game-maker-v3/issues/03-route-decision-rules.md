# 03. 确定性路线规则矩阵：resolveRoute 的输入、优先级与冲突

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线；第三轮细节已裁，见 [12](12-round-3-rulings.md))
Blocked by: —
Map: ../map.md
> 第一轮 Q2/Q5/Q6 已定：模型产完整 Recipe + 路线候选；`resolveRoute` 是 `source.kind` 的唯一最终写入者；
> 能力对象约束可执行路线；plan sidecar 记录理由。本票只问**规则本身**。
> ⚠️ 规则必须可单测；不得按资源名称/文件后缀推断；不得把类别映射当成无条件硬编码。

## Question

给定「资源规格 + design/VWS 上下文 + 能力对象 +（可选的）既有素材引用」，`resolveRoute` 如何选出
唯一的 `source.kind`？

至少要定：

1. **输入信号**：`spec.kind` / `characterId` / `masterAsset` / `animations` / `layers` / `size` /
   `required` / `description` / `role`，以及 design/VWS 的哪些字段参与？模型给的路线候选是
   记录为观察、还是不参与？
2. **三种路线的优先级与冲突**：
   - 明确要求原样使用既有素材且有可用 ref ⇒ `import` 是否无条件最高优先？
   - 复杂角色 / 敌人 / 背景 / 复杂机械 ⇒ `image` 的判据是什么（不只是 `kind`）？
   - 简单 UI / 几何符号 / 规则化图形 ⇒ `drawlist` 的判据是什么？
   - 混合样例：简单 UI 但要求动画；复杂道具但没有素材；可平铺地形；已有母版的角色；
     已有 ref 的简单 UI；`ui` 但九宫格；`background` 但可平铺。
3. **无合法路线的条件**：能力缺失 / ref 不可访问 / 约束冲突时，哪些是规划期硬失败？
4. **规则形状**：规则表 + 固定优先级 + 显式例外，还是打分？给出可测的确定性顺序。
5. **与模型候选的关系**：候选只作记录、还是在不合法时可触发重采样？不得让候选绕过 resolver。


## 第二轮已定（方向，见 [11](11-round-2-rulings.md)）

- 模型候选只作 **image / drawlist 平局裁决**；import 与结构化硬信号优先于候选；候选不能覆盖它们。
- 优先级：**import > image > drawlist**；无合法路线或能力缺失 ⇒ **规划期硬失败**，不静默降级/重新选路。
- **不纳入** `size` / `required` / `dependsOn` 作为信号。
- image 硬信号：`characterId` / `masterAsset` / `kind: animation` / `kind: background`；
  drawlist 硬信号：`kind: ui` 且符合简单几何/九宫格条件。
- **仍待本票细化**：硬信号的具体字段与冲突组合；`kind: ui` 的「简单几何/九宫格」精确条件；
  import 的「design/spec 要求原样使用」如何表示；候选缺失/非法时的行为；每条规则的 reason code。


## - import：fixture-only `existingAssets:[{id,ref,mustReuse}]`；`mustReuse=true` + ref 可访问才选；create 链空；候选不触发。
- image 硬信号顺序：`characterId > masterAsset > animation > background`，首个命中写 reason code。
- drawlist 硬信号：`kind:"ui"` + 有效 `ninePatch`（窄口径）；非九宫格 UI 由合法候选平局；候选缺失/非法/import ⇒ 失败。
- 冲突：合格 import > image 硬信号 > drawlist 硬信号 > 候选；无合法路线或能力缺失 ⇒ 硬失败，不换路。
- reason 闭合枚举 8 个（不含 `drawlist:ui-simple`）。
- ⚠️ 实施时仍需在 09/08 落实：硬信号字段的精确类型、`ninePatch` 的有效性定义、冲突组合测试表。
