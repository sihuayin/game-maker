# 10. 修正 verdict 的 baseline 覆盖语义

Type: task
Status: resolved
Owner: task 子代理 · 2026-10-21
Blocked by: 05
Map: ../map.md

> 派生自 [08](08-v7-report.md)：v7 报告有 12 个**非 baseline** 动画被判红。
> baseline 只覆盖 `scavenger-actor.idle`；run / jump / patrol 等帧间差异是正常运动，
> 用票 12 阈值判红是语义错误，不是产物缺陷。

## Question

当前 `buildReport`（`packages/assets/src/acceptance.ts`）在 baseline 存在时对**所有**动画计算
`verdict`。修改为：

- 仅当 `baseline.json.asset.id === asset.id` 且
  `baseline.json.asset.animation === anim.name` 时设置 `verdict`；
- 其他动画仍可保留 `metrics`（作为观察读数），但 `verdict: null`；
- 报告 summary / `report.md` 明确「verdict 只在 baseline 覆盖的动画上计算」，
  并写出覆盖的 `asset.anim`；
- 不改 `hasErrors` / findings / 退出码语义。

更新 `packages/assets/tests/acceptance.test.ts`：

- v7 + baseline：`scavenger-actor.idle` 的 `verdict === "green"`；
  其余动画 `verdict === null`（`metrics` 可非 null）；
- 合成 baseline 的「覆盖 / 不覆盖」两个用例（覆盖则 verdict 非 null，不覆盖则 null）；
- 不降低原有测试覆盖。

## 验收

- v7 + baseline：exit 0，findings 0；idle green；其他动画 verdict null。
- 定向 vitest 全绿；包级 `tsc` 不新增错误。
- 不修改 contracts / CLI / MCP / 报告 schema。

## 边界

- 只改 `packages/assets/src/acceptance.ts` + `packages/assets/tests/acceptance.test.ts`。
- 不提交；零付费；不写仓库 `out/`（测试用临时目录）；不碰 `CONTEXT.md` / 无关 `.scratch`；不写 `map.md`。

## 产出

本票 `## Answer`：修改点、v7 报告的 verdict 分布、测试结果、偏差。

## Answer

**结论：verdict 现在只在 baseline 的 `asset.id` + `asset.animation` 同时匹配时才计算；v7 的 13 个动画中只剩 `scavenger-actor.idle` 为 green，其余 12 个保留 metrics、verdict 为 null。**

### 修改点（只动两个文件）

- `packages/assets/src/acceptance.ts`
  - `BaselineJson` 新增被消费字段 `asset: { id, animation }`（`.passthrough()`，与 fixture §6.2 对齐；
    此前 `asset` 只是顶层 passthrough 的追溯字段）。
  - `buildReport`：`isCovered = baseline.asset.id === asset.id && baseline.asset.animation === anim.name`；
    有 baseline 时仍对**所有**动画调 `metricsForAnimation`（观察读数），但 `verdict = isCovered ? computed.verdict : null`。
  - summary 新增一行：`verdict 覆盖：<asset.anim 列表> —— verdict 只在 baseline 覆盖的动画上计算；其余动画保留 metrics（观察读数），verdict 为 null`；
    无覆盖时写「无（当前包没有 baseline 覆盖的动画）」。
  - `renderMarkdown`（`report.md`）新增同样的 `verdict 覆盖：… —— verdict 只在 baseline 覆盖的动画上计算…` 行。
  - 未改 `hasErrors` / findings / 退出码 / 报告 schema / contracts / CLI / MCP。
- `packages/assets/tests/acceptance.test.ts`
  - v7 + 真实 baseline：idle `verdict === "green"`；其余 12 个逐个断言 `verdict === null` 且 `metrics !== null`
    （含两个同名 `idle` 但 `asset.id` 不同的资源）；断言 summary 写明覆盖名单。
  - 合成 baseline 两例：覆盖（idle 匹配 ⇒ verdict 非 null）与不覆盖（`animation` 不匹配、`asset.id` 不匹配 ⇒ verdict null、metrics 非 null），
    并断言 summary / `report.md` 的覆盖文案与「无」分支。
  - `writeBaseline` 夹具补 `asset` 字段；原有 17 例断言全部保留（总例数 17 → 18）。

### v7 verdict 分布

- `scavenger-actor.idle` → **green**（alpha 0.4% / bbox 0.2% / pos 0.4% / L1 3 / colors 18 / off 0 / boundary 87.4%）。
- 其余 **12** 个动画（run、jump、patrol、charge、halt、hang、lunge、retreat、scrap-resource.idle、clean-water.idle、standby、active）
  → `verdict: null`，`metrics` 均非 null（此前它们被票 12 阈值判红，属语义错误）。
- findings 仍为 **0**，`hasErrors: false`（exit 0 语义不变）。

### 测试

- `vitest run packages/assets/tests/{acceptance,animation-metrics,animation-baseline}.test.ts` → **3 文件 / 38 例全过**
  （acceptance 18、metrics 13、baseline 7）。
- `pnpm --filter @game-maker/assets typecheck` → **exit 0**。
- 测试只写系统临时目录；未提交、零付费、未写仓库 `out/`、未碰 `CONTEXT.md` / 无关 `.scratch` / `map.md`。

### 偏差

- baseline schema 现在**要求** `asset.id` / `asset.animation`：缺这两个字段的 baseline 会按「输入不合法」exit 4，
  而不是静默地「无覆盖」。这来自本票要消费该字段；真实 frozen fixture 已具备。
- `report.md` 的覆盖名单从「非 null verdict」反推（报告 schema 不允许新增 baseline 的 `asset.anim` 字段）。
  正常路径与 summary 一致；若被覆盖动画的 metrics 不可用（verdict 也为 null），summary 仍写出它，但 Markdown 名单会漏掉它。
