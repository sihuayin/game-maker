# 09. 试玩结果接入实施（smoke → 检查项映射 + 证据）

Type: task
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md
Blocked by: 08

## Question

落地票 05 裁定的 smoke 接入（实施）：

1. **映射函数**：实现 smoke `result.json` → `{ status: DeliveryCheckStatus; detail?: string }`：
   - `ok:true` → `pass`；
   - `ok:false` 且命中现有确定性玩法判据（如 `参考玩家` `killed===0`）→ `fail` + `detail=GAMEPLAY_FAILURE`；
   - `ok:false` 其余 → `incomplete` + `detail=UNKNOWN`（默认，不自动归因）；
   - smoke 未跑（前置失败）→ `blocked`；不适用 → `not-required`。
2. **证据**：把 smoke 证据写入 `evidence[]`（`result.json` / `fail-<stage>.png` / `console.json` / `exceptions.json` 路径）。
3. **已知限制**：3/4 场景（`stage:"navigate"`、`collected=1/4`）写 `knownLimitations[]`，**归 UNKNOWN**（不提前认定 AGENT_LIMITATION）；
   措辞事实化：「自动玩家在移动宽巡逻处未完成核心循环；存在试玩器受限的可能（跳 ~66px < 巡逻 100px 且巡逻移动），
   但无真人实测通关或无碰撞通路证据，原因未确定」。
4. **注册表**：在 08 的检查项注册表里登记 `playable-smoke` 检查项（必需 + 判定规则）。
5. **测试**：ok:true、ok:false 未知原因、命中 killed===0 判据、smoke 未跑、3/4 场景归 UNKNOWN。

边界：不补 smoke 输出、不新增五类枚举、不改 playable-smoke.mjs。票 05 裁定全文见 issues/05-playtest-evidence.md。

## Answer（实施 · 2026-10-27）

- **映射函数**：`packages/contracts/src/playable-smoke.ts` 新增 `mapPlayableSmoke(result | undefined)` →
  `{ status, detail? }`：`undefined`（没跑/前置失败）→ `blocked`；`ok:true` → `pass`；`ok:false` 且命中
  确定性玩法失败 stage → `fail` + `GAMEPLAY_FAILURE`；`ok:false` 其余（超时）→ `incomplete` + `UNKNOWN`。
- **确定性玩法失败 stage 表**：`PLAYABLE_SMOKE_GAMEPLAY_FAILURE_STAGES = ["floor", "win", "runtime"]` ——
  「掉穿地面 / 到 gate 但 won=false / 核心循环完成但页面错误」三个**非超时**失败；超时
  `move`/`pickup`/`navigate` 归 UNKNOWN。⚠️ 票 09 项 1 的「如 `参考玩家` `killed===0`」是**通用例子**，
  横版侧的具体确定性判据落在这张 stage 表（横版 smoke 没有 `killed` 字段，`killed` 只存在于塔防探针）。
- **证据**：`playableSmokeEvidence(result, smokeDir)` → 恒有 `result.json` / `console.json` / `exceptions.json`，
  失败再补 `fail-<stage>.png`（POSIX 路径，尾斜杠不重复）。
- **已知限制**：`playableSmokeKnownLimitations(result)` —— `stage:"navigate"` 返回票 05 Q3 的事实化措辞
  （「…原因未确定」），**永不产 `AGENT_LIMITATION`**（无真人实测通关 / 无无碰撞通路证据就不提前归因）。
- **注册表**：`playable-smoke` 已由票 08 登记进 `DELIVERY_REQUIRED_CHECKS`（必需）；本票把它的**判定规则**
  落成 `mapPlayableSmoke`（票 09 项 4 的「判定规则」）。
- **测试**：`packages/contracts/tests/playable-smoke.test.ts` 11 条 —— ok:true、ok:false 未知原因、命中
  floor 判据、smoke 未跑、3/4 navigate 归 UNKNOWN、stage 表边界、已知限制措辞、证据引用。

**验证**：`pnpm vitest run packages/contracts/tests/playable-smoke.test.ts` 11/11 绿；`pnpm test` 全仓
**2040/2040** 绿；`pnpm typecheck` 全绿。

**范围注**：三个映射函数是**纯函数**，目前没有入口调用它们 —— 阶段C 真实产物验收（§8.4，地图
`Not yet specified`）会消费它们读真实 `smoke3/playable/result.json` 更新 `delivery.checks["playable-smoke"]`。
`AGENT_LIMITATION` 三档之一在类型里、但**本映射永不产出**（票 05 Q3 更严格证据标准）。不改 `playable-smoke.mjs`。
