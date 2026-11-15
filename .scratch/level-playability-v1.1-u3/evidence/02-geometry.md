# U3-02 证据 — 门区几何与闭式公式

| 项 | 值 |
| --- | --- |
| 票 | [U3-02 门区几何与闭式公式](../issues/03-u3-02-geometry.md) |
| 执行会话 | claude（U3-02 session 2026-11-12） |
| 基线 | `U3-01` @ `c011c48` |
| 改动（白名单内） | `packages/contracts/src/playability/temporal-gate.ts`、`packages/contracts/tests/playability-temporal-gate.test.ts` |
| 白名单外改动 | **无** |

## 1. 实现内容

| 项 | 内容 |
| --- | --- |
| 闭式 | `L = at + d − anchorX·w`；`R = at + (1 − anchorX)·w`；`width = w − d`；`y = at.y − anchorY·h`；`height = h` |
| 有效条件 | `width > ε` 且 Hazard y 区间与玩家盒 y 区间**严格重叠**（贴边不算） |
| ε | I-00 §6.4 单一具名常量，`epsilon(xMin, xMax)`；x 域取锚点全周期行程 `[at.x, at.x + d]` |
| 失败分类 | 非有限 / 非法周期 / 非法几何（`w≤0`、`h≤0`、`anchor ∉ [0,1]`、`d<0`、spawn 盒非正）⇒ `geometry-untrusted`；`width ≤ ε`、y 不相交 ⇒ `no-permanent-gate` |
| 无 pad | 门区不带宽高 pad、不用整段扫掠区、不预扩张；`L/R` 是恒覆盖核心边界 |
| 输出 | 有效时 `gate` + `gateStatus: "COMPLETE"`；`periodCoverage` / `sideRule` / `forbiddenInjection` 仍为 `null`（后续票填充） |

### 1.1 ε 的 x 域（本票裁定点）

`gate.epsilon` 的 x 域取 `[at.x, at.x + distance]`（Hazard 锚点全周期行程）。理由：
这是本层唯一独立于被比较量的长度标尺；若用门宽自身 `[L, R]` 作标尺，
`width > max(1e-9, 1e-9·width)` 在 `width > 0` 时恒真，阈值失效。

## 2. 命令与结果

| # | 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | ---: | --- |
| C1 | `pnpm typecheck` | `02-typecheck.log` | **0** | 全 workspace Done |
| C2 | `pnpm build` | `02-build.log` | **0** | `tsc -b` + bundle 全部 Done |
| C3 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-gate.test.ts` | `02-gate.log` | **0** | **17 / 17 passed** |
| C4 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | `02-temporal-input.log` | **0** | **65 / 65 passed**（T-55 / T-57 / T-58 / T-61 / T-62 / T-64 保持 ✓） |

## 3. 新增定向覆盖（U3-02 段）

1. `L/R/width` 闭式（中心锚点）；
2. 非中心锚点的 `L/R` 不对称（`anchorX = 0.25`）；
3. 门区 ≠ 整段扫掠区、无 lag pad（`L > 扫掠左缘`、`R < 扫掠右缘`）；
4. ε 两侧：`width = ε` ⇒ INCOMPLETE、略小 ⇒ INCOMPLETE、略大 ⇒ COMPLETE；
5. y 严格重叠 / 相切 / 不重叠；
6. `width ≤ 0`（`d = w`、`d > w`）；
7. 非法周期（0 / 负 / NaN）、非有限坐标、`d < 0`、`w=0`、`h=0`、`anchor ∉ [0,1]`、spawn 盒非正 ⇒ `geometry-untrusted`。

## 4. 边界声明

- 未实现周期覆盖、判侧、`forbiddenBoxes` 注入；未生成 U4 字段或完整证书。
- 未修改 `temporal.ts` / `graph.ts` / `reach.ts` / fixture；未新增依赖或公共导出。
- `pnpm test` 全量留给 U3-07。
- 未推送、未创建 PR、未合并。
