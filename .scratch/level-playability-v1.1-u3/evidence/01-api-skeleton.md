# U3-01 证据 — 门区模块 API 骨架与输入契约

| 项 | 值 |
| --- | --- |
| 票 | [U3-01 门区模块 API 骨架与输入契约](../issues/02-u3-01-api-skeleton.md) |
| 执行会话 | claude（U3-01 session 2026-11-12） |
| 基线 | `U3-00` @ `bb1c9bd` |
| 改动（白名单内） | 新增 `packages/contracts/src/playability/temporal-gate.ts`、新增 `packages/contracts/tests/playability-temporal-gate.test.ts` |
| 白名单外改动 | **无**（`fixtures` 本票未扩展） |

## 1. 交付内容

| 项 | 落点 |
| --- | --- |
| 入口 | `computePermanentGate(input: PermanentGateInput): PermanentGateHalf`（`@internal`） |
| 输入契约 | `PermanentGateInput`：`motion`、`hazard`、`playerSize`、`spawnBox`、`goalRect`、只读 `graph`；不解析 `GameConfig` |
| 输出 | `gate` / `periodCoverage` / `sideRule` / `forbiddenInjection`（均取自 D9 `PermanentGateProof` 的索引类型）+ `gateStatus`（D9 `ProofStatus`）+ `reason`（D9 `DegradationReason`） |
| 骨架行为 | 恒返回 `INCOMPLETE` + `no-permanent-gate`，四个半部为 `null` |
| 原因闭集 | 只允许 `no-permanent-gate` / `geometry-untrusted`，未新增原因码 |
| 依赖 | `./geometry.js`、`./graph.js`、`./temporal-motion.js`、`./temporal-result.js`（全部 `import type`）；不 import `temporal.ts` / `temporal-witness.ts` |
| 公共面 | 不进 `playability/index.ts` 与 `contracts/src/index.ts`；导出符号全部 `@internal` |

## 2. 命令与结果

| # | 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | ---: | --- |
| C1 | `pnpm typecheck` | `01-typecheck.log` | **0** | 全 workspace Done |
| C2 | `pnpm build` | `01-build.log` | **0** | `tsc -b` + bundle 全部 Done |
| C3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts` | `01-gate.log` | **0** | **11 / 11 passed** |
| C4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | `01-temporal-input.log` | **0** | **65 / 65 passed**（T-55 / T-57 / T-58 / T-61 / T-62 / T-64 保持 ✓） |

## 3. 定向测试覆盖（11 条）

1. 输出形状固定为六字段；
2. 骨架 `INCOMPLETE` + `no-permanent-gate`，四个半部 `null`；
3. 失败原因属于 D9 闭集的 U3 两项；
4. 半部类型可无损耗赋给 `PermanentGateProof` 对应字段（编译期）；
5. 相同输入重复运行序列化相等；
6. 不生成 U4 字段；
7. 不 import `temporal.ts` / `temporal-witness.ts`；
8. 只 import D6 DAG 允许的下层模块（白名单式集合断言）；
9. 不新增公共 barrel 导出；
10. 无 `TEMPORAL_LAG_*` / `Symbol(` / `analyze:`；
11. 导出符号全部标 `@internal`。

## 4. 边界声明

- 本票未实现 `L/R` 公式、周期覆盖、判侧或 `forbiddenBoxes` 注入；未生成任何 U4 字段或完整证书。
- 未修改 `temporal.ts` / `graph.ts` / `reach.ts` / 既有测试 / JSON fixture；未新增依赖或公共导出。
- 未推送、未创建 PR、未合并。
