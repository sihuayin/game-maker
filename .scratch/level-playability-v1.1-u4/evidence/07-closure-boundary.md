# U4-07 模型闭合、降级映射与输出边界 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u4` |
| `temporal-evasion.ts` SHA-256 | `09ca8c5907ed5e530f4c2395ed5854bfc90336f8e797518aed6fb28e499fe54f` |
| 测试文件 SHA-256 | `598a94bc129f6161466d291f41198ab995a560c88633cbb16295159ffec95d33` |

## 实现要点

- `MOVEMENT_MODEL_CLOSURE = "not-proven-air-control"`（D9 冻结字面量），输出恒取该常量，与 `status` / `reason` 无关。
- 模块头部补全模型闭合证据链：`scene.ts:89` 空中水平控制、`graph.ts` hop 恒速弧、`reach.ts` 60Hz mid-air 保守保护、`walk-off` 无水平漂移。
- `degradationReasonOf`：固定优先级，保证主原因确定：
  1. 图割否决（`goalIntersections > 0` 或 `midAirHits > 0`）⇒ `graph-cut-incomplete`；
  2. 任一档可达 ⇒ `graph-cut-incomplete`；
  3. cap 绑定 ⇒ `hop-sample-budget`；
  4. 覆盖不可证明 / 两档不一致 / 连通性改变 ⇒ `hop-doubling-changed`；
  5. 全成立 ⇒ `null`。
- `movement-model-unclosed` 为**保留码**：U4 从不主张 Runtime 不可达，当前不产生该路径；若未来调用方要求该主张，必须返回该码并保持 `INCOMPLETE`。
- 输出边界：运行时恰好六个键；无 `puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` / `certificate` / `internalResult` / `publicCapability` / `publicVerdict`。

## 测试（evasion 文件共 29 条，新增 7 条）

1. `movementModelClosure` 在 clean / reachable / cap / coverage 四类结果中恒为冻结字面量。
2. 主原因固定优先级映射，且只取 U4 闭集子集。
3. `COMPLETE ⇔ reason === null`；`COMPLETE` 仍不改变模型闭合声明。
4. 输出只有六个键，不夹带 U5 / 公共字段。
5. 反例 11：代码不出现 `runtimeUnreachable` / `PROVEN_UNPLAYABLE` 等主张。
6. 反例 12：代码不出现 `certificate` / `internalResult` / `publicCapability` / `puConditions`。
7. `hopSamplingCoverage.covered` 与 `hopDoubling.normalizedCoverage` 同源。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run …/playability-temporal-evasion.test.ts` | **0** | 1 file / **29 tests passed** |
| graph + gate + temporal-input | **0** | 3 files / **124 tests passed** |
| `pnpm test` | **0** | **175 files / 2824 tests passed** |

原始输出：`07-{build,typecheck,evasion,targeted,test}.log`（本地保留，不入库）。

## 白名单

产品 diff 仅 `temporal-evasion.ts` 与 `playability-temporal-evasion.test.ts`；`graph.ts` / `reach.ts` / `temporal.ts` / docs / fixtures 零 diff。
