# U3-03 证据 — 全周期覆盖

| 项 | 值 |
| --- | --- |
| 票 | [U3-03 全周期覆盖](../issues/04-u3-03-period-coverage.md) |
| 执行会话 | claude（U3-03 session 2026-11-12） |
| 基线 | `U3-02` @ `c9326a3` |
| 改动（白名单内） | `packages/contracts/src/playability/temporal-gate.ts`、`packages/contracts/tests/playability-temporal-gate.test.ts` |
| 白名单外改动 | **无** |

## 1. 实现内容

| 项 | 内容 |
| --- | --- |
| 闭式 | `max p = at + d`（`t = P/2`）、`min p = at`（`t = 0 / P`）；极值只作解析边界 |
| 记录 | `{ periodMs: P, complete: true, intervals: [[0, P/2], [P/2, P]] }` |
| 区间语义 | 周期内门区核心被覆盖的绝对时间窗口（ms，端点闭）；两个解析半周期**不合并**，折返点保持可见；两者相邻且合并恰为 `[0, P]` |
| 无 pad / 无缺口 | 区间总长 = `P`；门区本身不带宽高 pad，`⋂δ` 由全相位量化自动满足 |
| 失败 | 非法周期（`≤0` / 非有限）⇒ `geometry-untrusted`，`periodCoverage` 为 `null`，绝不产出 `complete: true` |
| 采样禁令 | 模块内无 `for` / `while` 循环（定向测试断言），全周期结果只能来自闭式 |

### 1.1 `intervals` 语义（本票裁定点）

D9 只冻结了 `intervals: readonly (readonly [number, number])[]` 的形状，未限定语义。本模块冻结为
**「一个周期内门区核心被覆盖的绝对时间窗口」**：有效门区在定义上覆盖整个周期，记录两个
解析半周期 `[0, P/2]`、`[P/2, P]`。不合并的理由是让「上升段 / 下降段各自单调」的解析来源
在证据里保持可见，避免下游把相邻端点的拼接误读成跨折返点的推断。

## 2. 命令与结果

| # | 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | ---: | --- |
| C1 | `pnpm typecheck` | `03-typecheck.log` | **0** | 全 workspace Done |
| C2 | `pnpm build` | `03-build.log` | **0** | `tsc -b` + bundle 全部 Done |
| C3 | `pnpm exec vitest run …playability-temporal-gate.test.ts` | `03-gate.log` | **0** | **23 / 23 passed** |
| C4 | `pnpm exec vitest run …playability-temporal-input.test.ts` | `03-temporal-input.log` | **0** | **65 / 65 passed**（架构断言保持 ✓） |

> 首次 `pnpm typecheck` 曾因测试内元组解构触发 `TS2488`（`noUncheckedIndexedAccess`）失败，
> 已改为显式判空后复跑至退出码 0；上述表内为复跑结果。

## 3. 新增定向覆盖（U3-03 段）

1. `periodMs` 与两段闭式区间；
2. 极值只在 `t = 0 / P/2 / P` 取得，含负时间（`-P`、`-P/2`）与多周期（`5P`、`P + P/2`）；
3. 区间相邻、无缺口、总长恰为一个周期；
4. 周期起终点一致（`P` 与 `0` 同相位），不产生第二段覆盖；
5. 非法周期（`0` / 负数 / `NaN` / `Infinity`）⇒ `geometry-untrusted` + `periodCoverage: null`；
6. 模块源码无 `for` / `while`（采样路径不可能产生 `complete: true`）。

## 4. 边界声明

- 未实现判侧与 `forbiddenBoxes` 注入；未引入 `lagMode` / lag pad 字段（属完整 proof）。
- 未修改 `temporal.ts` / `graph.ts` / `reach.ts` / fixture；未新增依赖或公共导出。
- 全量 `pnpm test` 留给 U3-07；未推送、未创建 PR、未合并。
