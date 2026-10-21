# 02. 新增 AtlasJson 与 animation-acceptance/v1 契约

Type: task
Status: resolved
Owner: task 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

按 Phase 0 实施计划 §4.1 / §4.2 新增两个契约：

1. `packages/contracts/src/atlas-json.ts`
   - `AtlasFrame` / `AtlasJson`（TexturePacker JSON Hash）。
   - 字段：`frames` record；每帧 `frame{x,y,w,h}`、`rotated`、`trimmed`、`spriteSourceSize`、
     `sourceSize`、可选 `anchor` / `scale9Borders`；`meta` 宽松。
   - **strict**；不要 `.passthrough()` 无声吞未知字段。
2. `packages/contracts/src/animation-acceptance.ts`
   - `animation-acceptance/v1` schema + `parseAnimationAcceptance`。
   - 字段按计划 §4.1：`format` / `createdAt` / `toolVersion` / `pack` / `baseline` /
     `animations[]` / `findings[]` / `human` / `runtime`。
   - `findings[]` 至少带 `file` / `assetId` / `anim` / `frame` 之一（superRefine）。
   - `human.items` 必须 7 项；`human.verdict` ∈ pending/pass/fail。
   - `runtime.status` ∈ verified/unverified/not-run；runtime 不参与结构验收。
   - `metrics` 可为 null（无 baseline 时）。
3. 在 `packages/contracts/src/index.ts` 导出两个新文件。

## 验收

- 新增 `packages/contracts/tests/atlas-json.test.ts`：
  v7 四张图集 JSON 正例；缺字段 / 负宽高 / 类型错负例。
- 新增 `packages/contracts/tests/animation-acceptance.test.ts`：
  最小报告正例；缺 pack 身份 / 人裁项不全 / finding 无定位 / runtime 非法负例。
- 定向 vitest exit 0；`pnpm typecheck` 不新增错误。
- 不改既有契约 / 测试 / 生产代码。

## 边界

- 只改两个新文件 + `contracts/src/index.ts` + 两个新测试。
- 不提交；不写 `out/`；零付费；不碰 `CONTEXT.md` / 无关 `.scratch`。
- 不写 `map.md`。

## 产出

本票 `## Answer`：新增符号、测试命令与结果、任何与计划不同的地方（须说明）。

## Answer

**新增 / 改动文件**

- `packages/contracts/src/atlas-json.ts`（新增）：`AtlasFrame` / `AtlasJson`（二者均为 schema + type）。
  `frames` 为 record；每帧 `frame` / `rotated` / `trimmed` / `spriteSourceSize` / `sourceSize`，可选
  `anchor` / `scale9Borders`；`meta` 宽松（`z.record(z.unknown())`），顶层与帧均 `.strict()`，
  无 `.passthrough()`。
- `packages/contracts/src/animation-acceptance.ts`（新增）：`ANIMATION_ACCEPTANCE_FORMAT`、
  `AnimationAcceptance`、`parseAnimationAcceptance`；辅助导出 `AcceptanceAtlasRef` /
  `AcceptancePackRef` / `AcceptanceBaselineRef` / `AcceptanceMetrics` / `AcceptanceSeverity` /
  `AcceptanceFinding` / `AcceptanceVerdict` / `AcceptanceAnimation` / `HUMAN_REVIEW_ITEM_KEYS` /
  `HumanReviewItemKey` / `HumanVerdict` / `HumanReviewItem` / `AcceptanceHuman` / `RuntimeStatus` /
  `DeclaredVsActual` / `AcceptanceRuntime`。
- `packages/contracts/src/index.ts`（改动）：新增上述两文件的 `export *`；既有导出未动。
- `packages/contracts/tests/atlas-json.test.ts`（新增，17 例）：v7 四张真图集正例；
  缺 `frame` / 缺 `sourceSize` / 负宽 / 零高 / 负偏移 / 类型错 / 未知帧字段 / 未知顶层字段负例。
- `packages/contracts/tests/animation-acceptance.test.ts`（新增，18 例）：无 baseline 最小报告 +
  有 baseline 七项读数正例；缺 pack 身份 / 缺 pack.id / checksum 形状 / 人裁 6 项 /
  人裁 key 重复 / 人裁 verdict 非法 / finding 无定位 / severity 非法 / runtime 状态非法 /
  format 错 / metrics 缺失（undefined）负例。

**测试命令与结果**

- `pnpm vitest run packages/contracts/tests/atlas-json.test.ts packages/contracts/tests/animation-acceptance.test.ts`
  → 2 files / 35 tests passed，exit 0。
- `pnpm --filter @game-maker/contracts typecheck`（包级 `tsc -p tsconfig.spec.json`；**不是**
  `pnpm typecheck` / `tsc -b`）→ exit 0，无输出、无写盘。
- 按要求未跑 `pnpm typecheck`（票 01 并行修两处既有错误，避免并发 `tsc -b`）。

**与计划的差异（均为有意）**

1. `findings[].code` 在契约层是 `z.string().min(1)`，不是枚举：计划 §4.1 要求「闭集」但未给出码表；
   码表由实现方（票 05 `acceptance.ts`）拥有，提前猜一组码会把并行实现锁死。`severity` 闭集与
   「至少一个定位字段」仍由 schema 强制。
2. `AcceptanceAnimation.declared.fps` 为 `number | null`：`assetpack` 的 `Animation.fps` 本身可选，
   报告必须能表达「没声明」而不是编一个数。
3. `metrics` 为 `null` 时 `verdict` 也 nullable（计划示例只展示有 baseline 的正例）——
   无读数就没有绿/黄/红。
4. `human.items` 除 `.length(7)` 外还拒绝重复 key（superRefine），保证是计划列出的 7 项，
   而不是 7 条重复。
5. 额外导出 `HUMAN_REVIEW_ITEM_KEYS`（计划 7 项 key 的唯一一份），供票 05 / Tier 2 人裁模板共用。
6. `metrics` 与动画条目内的 `findings[]` 均为 `.strict()`；百分比字段限制 0–100，
   `backgroundL1` / 计数类未强加整数约束（口径由票 03 / 12 决定）。
