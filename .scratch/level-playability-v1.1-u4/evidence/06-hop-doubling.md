# U4-06 hop 双档与规范化采样覆盖 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u4` |
| `temporal-evasion.ts` SHA-256 | `1bb27ce22a9b606bb12aabe071421a7650bb6f4bcb285cb26607e630bb939c4d` |
| 测试文件 SHA-256 | `50ff1980325c9db44b53914e43c342daa9601178dae4f278f8ad0d7844ec3644` |

## 实现要点

- 双档参数：主档 `{ hz: 60, maxSamples: 120 }`，倍档 `{ hz: 120, maxSamples: 240 }`。
- `reachWithSampling`：每档各自跑**完整** BFS（不提前终止），原语为 `movementNeighbors` + `hopEdges(..., sampling)`；覆盖语义对齐 `assessReachability`（落脚点盒 / walk-off 下落段 / hop 弧采样点）。`reach.ts` 只读且不参数化 hop（D4 §5），因此该 BFS 在 U4 内实现，mid-air 仍由 `reach.ts` 60Hz 只作否决。
- `arcSampleCount`：仅复算每弧 `n = max(6, min(cap, ceil(t·hz)))` 与 cap 绑定，用于 `F1 ⊆ F2` 与 cap 判定；**实际采样仍由 `hopEdges` 完成**，不引入第二份采样实现。
- `normalPositionsCovered(n1, n2)`：整数交叉乘判定 `F1 ⊆ F2`，不使用浮点容差；不把 `n2 === 2·n1` 作为条件。
- D9 `HopSampleSummary` 投影：`n` = 该档最大每弧采样数；`endpoints` = 该档接受的 hop 弧落点（排序去重）；`cap` = 该档 `maxSamples`。
- 结论映射（冻结）：图割否决（`goalIntersections > 0` 或 `midAirHits > 0`）⇒ `graph-cut-incomplete`；任一档可达 ⇒ `graph-cut-incomplete`；cap 绑定 ⇒ `hop-sample-budget`；覆盖不可证明 / 两档不一致 / 连通性改变 ⇒ `hop-doubling-changed`；全部成立 ⇒ `COMPLETE` + `reason: null`。

## 测试（evasion 文件共 22 条，新增 6 条）

1. 两档各自完整跑：`n = 12 / 24`、cap `120 / 240`、端点含 `[6,20]`，`F1 ⊆ F2` 成立。
2. 反例 10：`normalPositionsCovered(6,18) = true`（3× 也覆盖），`(7,13) = false`；判据不是 2×。
3. 覆盖不可证明（`n1=7 / n2=13`）⇒ `hop-doubling-changed`，`method: "insufficient"`。
4. cap 绑定 ⇒ `hop-sample-budget`。
5. 反例 9：`(4,17)` 为 120Hz 独有采样点、落入禁区 ⇒ 粗档跨缺口、密档被否；`connectivityPreserved = false`，两档端点均可审计。
6. 两档都不可达且覆盖成立 ⇒ `COMPLETE`、`reason = null`。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run …/playability-temporal-evasion.test.ts` | **0** | 1 file / **22 tests passed** |
| graph + gate + temporal-input | **0** | 3 files / **124 tests passed** |
| `pnpm test` | **0** | **175 files / 2817 tests passed** |

原始输出：`06-{build,typecheck,evasion,targeted,test}.log`（本地保留，不入库）。

## 白名单

产品 diff 仅 `temporal-evasion.ts` 与 `playability-temporal-evasion.test.ts`；`graph.ts` / `reach.ts` / `temporal.ts` / docs / fixtures 零 diff。
