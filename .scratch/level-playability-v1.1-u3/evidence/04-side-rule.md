# U3-04 证据 — 判侧规则

| 项 | 值 |
| --- | --- |
| 票 | [U3-04 判侧规则](../issues/05-u3-04-side-rule.md) |
| 执行会话 | claude（U3-04 session 2026-11-12） |
| 基线 | `U3-03` @ `e6958d5` |
| 改动（白名单内） | `packages/contracts/src/playability/temporal-gate.ts`、`packages/contracts/tests/playability-temporal-gate.test.ts` |
| 白名单外改动 | **无** |

## 1. 实现内容

| 项 | 内容 |
| --- | --- |
| 目标过近似 | `goalRegion = expandBox(goalRect, 0.5)`（四边各 +0.5px，复用 `geometry.ts`） |
| spawn | 使用输入里的精确 spawn 盒，**不外扩、不内缩、不取整**；不使用 `startCells()` |
| 左→右 | `spawnBox.x + spawnBox.w ≤ L ∧ goalRegion.x ≥ R` |
| 右→左 | `spawnBox.x ≥ R ∧ goalRegion.x + goalRegion.w ≤ L` |
| 失败 | 同侧 / 目标跨门 / 起点跨门 / 无法判侧 ⇒ `INCOMPLETE` + `no-permanent-gate`；`sideRule` 为 `null` |
| 非法目标 | 非有限 / `w≤0` / `h≤0` ⇒ `geometry-untrusted` |
| 方向语义 | PU 目标外扩，与 D3 的 NB 到达内缩方向相反；模块不 import `temporal-witness.ts`（既有断言保持） |

## 2. 命令与结果

| # | 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | ---: | --- |
| C1 | `pnpm typecheck` | `04-typecheck.log` | **0** | 全 workspace Done |
| C2 | `pnpm build` | `04-build.log` | **0** | `tsc -b` + bundle 全部 Done |
| C3 | `pnpm exec vitest run …playability-temporal-gate.test.ts` | `04-gate.log` | **0** | **31 / 31 passed** |
| C4 | `pnpm exec vitest run …playability-temporal-input.test.ts` | `04-temporal-input.log` | **0** | **65 / 65 passed**（架构断言保持 ✓） |

> 首次 gate 测试因「导出符号标 `@internal`」断言的文档窗口（8 行）短于入口注释长度而失败，
> 已把窗口放宽到 20 行后复跑至全绿。

## 3. 新增定向覆盖（U3-04 段）

1. 左→右正向（含 `spawnBox` 原样记录、`goalRegion` 四边 +0.5）；
2. 右→左正向；
3. spawn 精确盒不外扩（`spawnRight = 50.5 > L` 必须 INCOMPLETE）；
4. 同侧 / 目标跨门 / 起点跨门 ⇒ INCOMPLETE；
5. 边界相切按 `≤` / `≥` 闭合成立（两个方向各一例）；
6. 不得直接用未外扩 Goal Rect（未外扩成立、外扩后不成立 ⇒ INCOMPLETE，两方向各一例）；
7. 非法 `goalRect` ⇒ `geometry-untrusted`。

## 4. 边界声明

- 未实现 `forbiddenBoxes` 注入与图割；未生成 U4 字段。
- 未修改 `temporal.ts` / `graph.ts` / `reach.ts` / fixture；未新增依赖或公共导出。
- 全量 `pnpm test` 留给 U3-07；未推送、未创建 PR、未合并。
