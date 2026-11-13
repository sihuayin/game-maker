# U4-04 图割半部 API 骨架与输入契约 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u4` @ `fc2c842` |
| 新增 | `packages/contracts/src/playability/temporal-evasion.ts`（108 行） |
| 扩展 | `packages/contracts/tests/playability-temporal-evasion.test.ts`（+6 条 API 断言） |
| `temporal-evasion.ts` SHA-256 | `567899d9f9f3db913ac2764751d4682eb6fc3d9fc0983d3ac42b75b49201a622`；测试文件 `54469616b90f621af996dbbe6d4c11e296e6ab451d6c97ddd1fe90e35ac1a484` |

## API

```ts
computePermanentEvasion(input: PermanentEvasionInput): PermanentEvasionHalf
```

- 输入：`spawnCell`（D3 精确脚点格）、`goalRegion`（已外扩 0.5px）、`gateRect`（诊断 / 对齐）、`move`、只读 `graph`。
- 输出：`graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` / `status` / `reason`。
- 半部类型直接取自 D9 `PermanentGateProof` 的索引类型，不另立同义类型。
- 骨架恒为 `INCOMPLETE` + `graph-cut-incomplete`，三个半部 `null`；`movementModelClosure` 恒为 `"not-proven-air-control"`。

## 边界断言（测试内）

- 依赖只在 `./geometry.js` / `./graph.js` / `./temporal-motion.js` / `./temporal-budget.js` / `./temporal-result.js` 白名单内；不 import `temporal.ts` / `temporal-gate.ts` / `temporal-witness.ts`。
- 代码本体不出现 `assessReachability(` / `startCells(` / `puConditions` / `geometryCoverage` / `lagInvariantByConstruction` / `analyze:` / `Symbol(` / `TEMPORAL_LAG_`。
- 两个 barrel 文件均不含 `temporal-evasion`。
- 确定性：重复调用 `JSON.stringify` 逐字节一致。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run …/playability-temporal-evasion.test.ts` | **0** | 1 file / **11 tests passed**（5 尾参 + 6 API） |
| graph + gate + temporal-input | **0** | 3 files / **124 tests passed**（11 + 48 + 65） |
| `pnpm test` | **0** | **175 files / 2806 tests passed** |

原始输出：`04-{build,typecheck,evasion,targeted,test}.log`（本地保留，不入库）。

## 白名单

产品 diff 只有 `temporal-evasion.ts`（新增）与 `playability-temporal-evasion.test.ts`（扩展）；无白名单外改动。
