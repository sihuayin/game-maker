# P1 实施报告 — Design-to-Config Residual Gaps

- **日期**：2026-11-03
- **批准**：用户当日批准全量七项 + 两项契约变更
- **基线**：`ebdeff3`（P0 收口）；分支 `p1/design-to-config-residual-gaps`
- **状态**：实现完成；测试全绿；未 commit / 未 push

## 1. 修改面（生产代码）

| 文件 | 改动 |
|---|---|
| `packages/contracts/src/game-config.ts` | `ENTITY_ASSET_KINDS`、`DESIGN_BUCKET_ASSET_KINDS`、`ConfigIssue.code` + 三码、实体循环 kind 锁与状态帧、`auditPanelSize` 下界 |
| `packages/contracts/src/config-audit.ts`（新） | `auditConfigPipeline`：`resampleable` / `deterministic` 两档，顺序与 `ops.ts` 逐条一致 |
| `packages/contracts/src/index.ts` | 导出 `config-audit.js` |
| `packages/contracts/src/game-design.ts` | `resources ≥ 1`（Q6b） |
| `packages/assets/src/ops.ts` | `designCoverageGate` 加 kind 检查；`hudUiGate` 无条件；`compileRuntime` 两处审计改走统一入口 |
| `packages/assets/src/prompt.ts` | HUD 要求改为无条件 |
| `packages/pipeline/src/create-game.ts` | 汇合点统一确定性复验（Q5） |

不新增包、不改 Runtime、不改 CLI/MCP 的对外形状；`ConfigIssue.code` 只做附加。

## 2. 契约变更（P1 单独批准）

- `ConfigIssue.code?: ConfigIssueCode`，闭集：`entity-asset-kind` / `entity-state-frames` / `hud-panel-size`。
  **不 retrofit** 既有构造点：既有错误对象上 `code` 缺席（有回归断言）。
- `GameDesignSpecSchema` 要求 `resources.length ≥ 1`；`schema` 档、走现有重采样。

## 3. 测试证据（E2）

- `pnpm exec vitest run`：**161 个测试文件、2378 tests 全过**（基线 2351 + 新增 27）。
- `pnpm exec tsc -b`：通过。
- `pnpm check:deps`：依赖图合法（10 个包）。
- 新增用例覆盖：
  - Q1：pickup/hazard/goal 的 ui/background 负例、decor 豁免、E02 `slope-1`。
  - Q3：chest/danger 单帧负例、恰好 2 帧边界、其他槽位不受约束。
  - Q4：1×1 下界负例、中央区放不进、声明 == 下界、既有真配置回归。
  - Q5：reuseConfig 屏幕空间越界、九宫格 1×1、原样复用正例。
  - Q6a：设计无 `hud:screen-space` 时清单仍须 ui（正/负 + 提示词无条件）。
  - Q6b：`resources: []` 拒绝、非空通过。
  - Q8：敌人 spec.kind 改 ui、`characterId` 覆盖但 kind 错、`npcs` 由 ui 覆盖正例。
  - E03/E04：`hud.panel` ← sprite、`hud.pip` ← 资源 sprite 独立断言。

## 4. 语料重判（E3，只读、零网络、零生图）

脚本只读 `out/**`、`fixtures/**`、`.scratch/**` 下的 `game-config/v1`，就近取 `pack/v*/manifest.json`：

- 共找到 **151** 份 config，**102** 份能就近配到 manifest（49 份历史目录没有邻近包，跳过）。
- `out/` 与 `fixtures/`：新判据 **0 条 error**（Q1/Q3/Q4 均零误伤）。
- `.scratch/` 冻结产物：**75 条** `entity-state-frames`（chest 单帧），全部是历史证据本应命中的形态；
  **未修改、未重跑、未改写**这些产物。与 P0 报告的「81 处历史 chest 单帧」同族（差额来自 manifest 匹配/跳过口径）。

## 5. 测试夹具同步（因契约收紧而必须改）

- `fixtures/upstream/canned.json`：设计补 `r-scrap`、config 的 pickup/goal 改用 sprite、清单补 `r-scrap` 与 `ui-hud` 的 `ninePatch`。
- `packages/pipeline/tests/create-game.test.ts`、`packages/cli/tests/cli-create.test.ts`：资产数/并发峰值随夹具更新。
- `packages/qa/tests/{assemble,visual}.test.ts`：VDS 与 config 补 `r-scrap` 覆盖。
- `packages/assets/tests/*`、`packages/game-design/tests/fixtures.ts`、`packages/contracts/tests/{runtime-profile,vocabulary}.test.ts`：
  为「HUD 无条件」与「resources ≥ 1」补齐合法输入。

## 6. 已知限制（未变）

- 多关卡：`BuildInput` 无 `levelId`，`runBuild` 与 `compileRuntime` 一致取 `levels[0]`。
- site 装配期口径未纳入本次统一复验。
- B/D 类缺口按 P0 裁定继续冻结/另立 effort。
