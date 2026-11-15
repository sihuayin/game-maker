# U4 实现报告（I02-04 垂直规避图割）

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u4` @ `d14481c` |
| U4 产品范围 | `b884a35..HEAD`（`b884a35` = 并入已合并 i02 后的起点） |
| U4 产品 diff | `temporal-evasion.ts`（新增 329 行）、`playability-temporal-evasion.test.ts`（新增 411 行） |
| 上游依赖 | `graph.ts` `HopSampling` 尾参：[PR #37](https://github.com/sihuayin/game-maker/pull/37) 已合并（`2241e11` / `13b4e3b`） |
| 授权 | U4 增量授权 [`05-u4-incremental-authorization.md`](../../level-playability-v1.1-i02/reports/05-u4-incremental-authorization.md)；`graph.ts` 独立审批 [`06-u4-graph-approval.md`](../../level-playability-v1.1-i02/reports/06-u4-graph-approval.md) |

## 1. 交付内容

`packages/contracts/src/playability/temporal-evasion.ts`：

- `computePermanentEvasion(input: PermanentEvasionInput): PermanentEvasionHalf`（`@internal`）。
- 输入：精确 `spawnCell`、已外扩 0.5px 的 `goalRegion`、`gateRect`（诊断）、`move`、只读 `graph`。
- 输出：`graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure` / `status` / `reason`，类型直接取自 D9 `PermanentGateProof` 索引类型。
- 辅助符号：`withExactSpawnSeed`、`normalPositionsCovered`、`MOVEMENT_MODEL_CLOSURE`（均 `@internal`，不进 barrel）。

## 2. 关键实现决定

1. **精确 spawn**：`assessReachability` 内部用 `startCells()` 的宽松多起点；U4 用 `withExactSpawnSeed` 覆盖种子函数为单一精确脚点格，其余静态底座共享。
2. **图割**：`assessReachability(seeded, move, [{ rect: goalRegion }], { full: true })`；消费 `covered` / `midAir` / `seen`；`verdict` 恒 `"conditional"`；`midAirHits = 0` 永不作为正面证明。
3. **hop 双档**：`reach.ts` 只读且不参数化 hop 采样，因此 U4 用 `movementNeighbors` + `hopEdges(..., sampling)` 做两档各自**完整** BFS；覆盖语义对齐 `assessReachability`。mid-air 仍由 `reach.ts` 60Hz 只作否决。
4. **规范化覆盖**：`F1 ⊆ F2` 用整数交叉乘判定；**不要求** `n_doubled = 2·n_base`。`arcSampleCount` 仅复算每弧 `n` 与 cap，实际采样仍由 `hopEdges` 完成。
5. **D9 摘要投影**：`n` = 该档最大每弧采样数；`endpoints` = 该档接受的 hop 弧落点（排序去重）；`cap` = `maxSamples`。
6. **主原因固定优先级**：图割否决 / 任一档可达 ⇒ `graph-cut-incomplete`；cap ⇒ `hop-sample-budget`；覆盖不可证明 / 不一致 ⇒ `hop-doubling-changed`；全成立 ⇒ `COMPLETE` + `null`。
7. **模型闭合**：`movementModelClosure` 恒 `"not-proven-air-control"`；`movement-model-unclosed` 为保留码，U4 不主张 Runtime 不可达，当前不产生该路径。

## 3. 失败原因映射（冻结）

| 条件 | 原因码 |
| --- | --- |
| `goalIntersections > 0` 或 `midAirHits > 0` | `graph-cut-incomplete` |
| 任一档目标可达 | `graph-cut-incomplete` |
| 任一档 cap 绑定 | `hop-sample-budget` |
| `F1 ⊆ F2` 不可证明 / 两档不一致 / 连通性改变 | `hop-doubling-changed` |
| 全部成立 | `null`（`COMPLETE`） |

`movement-model-unclosed` 未由 U4 产生（保留给主张 Runtime 不可达的 U5 组装层）。

## 4. 测试矩阵

`playability-temporal-evasion.test.ts`：**36 tests**

| 组 | 条数 | 内容 |
| --- | ---: | --- |
| U4-02 | 5 | `HopSampling` 默认等价、单项缺省、稳定序列化、倍档正常性 |
| U4-04 | 6 | API 形状、原因闭集、确定性、依赖边界、barrel、无 `startCells()` |
| U4-05 | 5 | 精确 spawn、可达 / 不可达、mid-air 否决、evidence 确定性 |
| U4-06 | 6 | 两档摘要、反例 9/10、覆盖不可证明、cap、双档一致不可达 |
| U4-07 | 7 | 模型闭合恒定性、原因优先级、`COMPLETE ⇔ null`、输出边界、反例 11/12 |
| U4-08 | 7 | D4 §11 反例 5、7–12 具名矩阵 |

D4 §11 反例覆盖：U4 负责 5、7–12；1–4、6、13 由 `playability-temporal-gate.test.ts`（48 tests）确认不回归。

## 5. 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run …/playability-temporal-evasion.test.ts` | **0** | 36 / 36 |
| `pnpm exec vitest run …/playability-temporal-gate.test.ts` | **0** | 48 / 48 |
| `pnpm exec vitest run …/playability-graph.test.ts` | **0** | 11 / 11 |
| `pnpm exec vitest run …/playability-temporal-input.test.ts --reporter=verbose` | **0** | 65 / 65；T-55/57/58/61/62/64 ✓ |
| `pnpm test` | **0** | **175 files / 2831 tests passed**；2 条 `onTaskUpdate` RPC 超时（工具层） |

## 6. 白名单审计（U4 范围 `b884a35..HEAD`）

```text
A packages/contracts/src/playability/temporal-evasion.ts
M packages/contracts/tests/playability-temporal-evasion.test.ts
```

- `graph.ts` 变更**只**来自 PR #37（`13b4e3b`）；`13b4e3b..HEAD` 对 `graph.ts` 零 diff。
- `temporal.ts` / `reach.ts` / `docs/` / `fixtures/` 零 diff。
- 无新依赖、无锁文件、无 JSON fixture、无公共 barrel 导出（两个 index 文件均不含 `temporal-evasion`）。
- 依赖：`../game-config.js`、`./geometry.js`、`./graph.js`、`./reach.js`、`./temporal-result.js` —— 均在只读允许面内。

## 7. 已知限制 / 未覆盖项

1. **`F1 ⊆ F2` 是严格规则**：等价于 `n2` 是 `n1` 的整数倍。由于 `ceil(2x)` 可能是 `2·ceil(x)−1`，真实夹具上部分弧会合法判为 `hop-doubling-changed`；这是 D4 §6.2 的签署语义，不是缺陷。
2. **`movement-model-unclosed` 未产生**：U4 只做模型内计算；该码保留给未来主张 Runtime 不可达的调用方。
3. **U4 内的 BFS 与 `reach.ts` 存在语义对齐维护成本**：`reach.ts` 不参数化 hop，U4 复用其原语但自行遍历；任何覆盖语义变更需同步。
4. **`puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` / 完整证书**不在 U4；U5 组装。
5. 未运行 I-03 生产接线、`PUBLIC_NB` / `PUBLIC_PU`；`coverage` 仍 `partial`。
6. R4 复核尚未进行；本报告不代表 R4 结论。
