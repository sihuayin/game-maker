# U4-08 测试矩阵与 D4 §11 反例 5、7–12 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u4` |
| 产品代码 | **零改动**（`temporal-evasion.ts` hash 与 U4-07 相同：`09ca8c59…9fe54f`） |
| 测试文件 SHA-256 | `3839288b33fe623b9c3f420767c6b92b741729fee1bc494f70078013ecc30817` |
| U4 测试文件 | **36 tests**（U4-02 5 + U4-04 6 + U4-05 5 + U4-06 6 + U4-07 7 + U4-08 7） |

## D4 §11 反例矩阵（U4 / R4 部分）

| # | 反例 | 具名测试 | 结果 |
| --- | --- | --- | --- |
| 5 | 判侧直接用取整 Goal Rect（不外扩 0.5px）⇒ 漏判边界接触 | `反例 5：goalRegion 必须已外扩 0.5px；未外扩会漏判 0.3px 的边界接触` | ✅ 未外扩 `goalIntersections=0`；外扩后 `=1` |
| 7 | 用 `midAirHits = 0` 作为正面证明 | `反例 7：midAirHits 只作否决证据…` | ✅ `midAirHits=1` 时仅否决，`verdict` 仍 `conditional` |
| 8 | 用 `startCells()` 宽松种子替代精确 spawn | `反例 8：精确 spawn 出发，不用 startCells 的宽松多起点` | ✅ `evidence` 记录 `seeds=1` |
| 9 | 只跑倍档或只比较单条 hop 边 | `反例 9：两档都跑，不只看倍档或单条 hop 边` | ✅ `connectivityPreserved=false`，两档端点分别审计 |
| 10 | 把 `n_double === 2·n_prime` 当作通过条件 | `反例 10：判据是 F1 ⊆ F2，不是 n_doubled === 2·n_base` | ✅ `(6,18)` 覆盖、`(7,13)` 不覆盖 |
| 11 | 把图割不连通写成 Runtime 不可达 | `反例 11：不把图割不连通写成 Runtime 不可达` | ✅ 代码无 runtime-unreachable 主张 |
| 12 | `coverage.partial` / 模型未闭合时发布 PU | `反例 12：模型未闭合 / coverage partial 时不发布 PU 或公共能力` | ✅ 无 certificate / publicCapability / puConditions |

## U3 反例 1–4、6、13（不得回归）

由 `playability-temporal-gate.test.ts` 覆盖并原样通过：**48 / 48 passed**（未修改该文件）。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| `pnpm exec vitest run …/playability-temporal-evasion.test.ts` | **0** | 1 file / **36 tests passed** |
| gate + graph + temporal-input | **0** | 3 files / **124 tests passed**（48 + 11 + 65） |
| `pnpm test` | **0** | **175 files / 2831 tests passed** |

原始输出：`08-{build,typecheck,evasion,targeted,test}.log`（本地保留，不入库）。

## 白名单

产品 diff **仅测试文件**；`temporal-evasion.ts` / `graph.ts` / `reach.ts` / `temporal.ts` / docs / fixtures 零改动。
