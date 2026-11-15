# U4-05 图割判据与 reach 消费 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u4` |
| `temporal-evasion.ts` SHA-256 | `6414e3eddab691f88da646c4d6be5748f42b264f4d0a690ba334dbc88e8360ff` |
| 测试文件 SHA-256 | `61b628f88f4defd75807081b75f32f3cdb0dce4158794d91312e0e752ac79234` |

## 实现要点

- `withExactSpawnSeed(graph, spawnCell)`：覆盖 `startCells()` 为单一种子，其余静态底座共享；避免 `assessReachability` 内部使用宽松多起点（D4 §4）。
- `graphCutOf`：`assessReachability(seeded, move, [{ id: "goal-region", rect: goalRegion }], { full: true })`，消费 `covered` / `midAir` / `seen`。
- 产出 D9 `graphCut`：`verdict: "conditional"`、`reachableFootpoints`（`seen.size`）、`goalIntersections`（`covered.size`）、`midAirHits`（`midAir.size`）、确定性 `evidence` 字符串。
- `midAirHits > 0` 只作否决；`midAirHits = 0` 永不作为正面证明；`verdict` 恒 `conditional`。
- `reach.ts` 零改动；mid-air 保持 60Hz，不参与 hop 双档。

## 测试（evasion 文件共 16 条）

新增 5 条：

1. 精确 spawn：输入图的 `startCells()` 宽松多起点被覆盖，`evidence` 显示 `seeds=1`；`withExactSpawnSeed` 只替换种子函数。
2. 可达目标 ⇒ `goalIntersections = 1`，`verdict` 仍 `conditional`，`status` 仍 `INCOMPLETE`。
3. 不可达目标 ⇒ `0 / 0`，图割半部照常产出。
4. mid-air 仅触达（合成图：walk-off 后的 fall 弧漂移）⇒ `midAirHits = 1`、`goalIntersections = 0`，只作否决。
5. `evidence` 确定性且格式固定。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run …/playability-temporal-evasion.test.ts` | **0** | 1 file / **16 tests passed** |
| graph + gate + temporal-input | **0** | 3 files / **124 tests passed** |
| `pnpm test` | **0** | **175 files / 2811 tests passed** |

原始输出：`05-{build,typecheck,evasion,targeted,test}.log`（本地保留，不入库）。

## 白名单

产品 diff 仅 `temporal-evasion.ts` 与 `playability-temporal-evasion.test.ts`；`reach.ts` / `graph.ts` / `temporal.ts` / docs / fixtures 零 diff。
