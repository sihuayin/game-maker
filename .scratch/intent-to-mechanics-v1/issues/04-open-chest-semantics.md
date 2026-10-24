# 04. open-chest 端到端语义：宝箱 config + 运行时交互

Type: prototype
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 01
Map: ../map.md

## Question

`open-chest` 的端到端语义（文档 FR-04 / FR-05）：宝箱的 **config 表达**（`EntityKind` 加 interactable/chest？
open/closed 状态、奖励内容、是否可重复打开、交互范围、触发方式）与**运行时行为**（新增「交互」输入？打开状态变化、
奖励发放、一次性防重复、范围外输入无效）。

## 现状（E1）

- config `EntityKind = solid/pickup/hazard/goal/decor`（`game-config.ts:50`），**无 interactable**；shell 只绑
  移动 + 跳跃（`scene.ts:73-87`），**无「交互」输入**；pickup 无奖励/道具概念（只计数 + 点亮 pip）。
- 设计层 interactables 桶 = `{id, type, behavior}` 全自由文本（`game-design.ts:171`），无状态机、无奖励、无 config 通道。

## 建议

以 **prototype** 做一份粗糙 config + 纯层 + 渲染器草图再定（不直接动正式 schema）。候选语义：
- 奖励**复用 collect-pickup 计数**（最小，不加新奖励系统）；「交互」作为 open-chest 的触发——**近距自动触发** vs
  **新增 interact 输入**二选一（这是本票核心分叉）。
- config 最小：新增 `EntityKind`（chest/interactable）+ `{ open(状态), reward, repeatable, range }`；
  运行时：进入范围触发 → 状态 close→open → 发奖励 → 记录状态 → 一次性防重复 → 范围外不触发。

承载实现：`game-config.ts` EntityKind + 字段、`world.ts`/`scene.ts` 交互逻辑、`auditReferences` 校验、witness 测试。

## Answer

**裁定（2026-10-23 · 用户逐字）**：

- **Q1 触发方式 = (A) 近距自动触发**：玩家进入宝箱范围自动打开 + 发奖励；**不新增 interact 输入或 capability**。
- **Q2 奖励模型 = (a) 复用收集计数**：开箱 `collected + 1`，`pickupCount` 统计 `pickup + chest`；
  目标 = 收齐所有 pickup + 打开所有宝箱 → 到终点。

**落定语义**：

1. 新 `EntityKind = "chest"`，可选 `range`（交互范围，缺省用实体盒子）。
2. 状态机：`closed` →（进入范围）→ `open` →（发奖励 `+1`，一次性）→ 锁定；**范围外不触发、重复交互不重复发**。
3. 奖励并入现有 `collect-then-reach` objective，不另造奖励系统；宝箱 =「有 open 状态、近距触发、一次性」的加强版 pickup。

实现切片 → 毕业成 [票 13](13-open-chest-impl.md)。
