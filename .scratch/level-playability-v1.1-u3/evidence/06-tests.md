# U3-06 证据 — 测试矩阵与 D4 反例

| 项 | 值 |
| --- | --- |
| 票 | [U3-06 测试矩阵与 D4 反例](../issues/07-u3-06-tests.md) |
| 执行会话 | claude（U3-06 session 2026-11-12） |
| 基线 | `U3-05` @ `77a9b17` |
| 改动（白名单内） | `packages/contracts/tests/playability-temporal-gate.test.ts`（本票未改产品代码） |
| 白名单外改动 | **无** |

## 1. 测试矩阵（48 条）

| 组 | 覆盖 |
| --- | --- |
| U3-01 API | 六字段形状、失败原因闭集、D9 可嵌入、确定性、无 U4 字段 |
| U3-02 闭式 | `L/R/width`、非中心锚点、非扫掠区、ε 两侧、y 严格重叠 / 相切 / 不重叠、`width ≤ 0`、非法周期 / 非有限 / 非法几何 |
| U3-03 覆盖 | 记录与区间、极值 `t=0/P/2/P`（含负时间、多周期）、区间相邻与总长、起终点一致、非法周期 |
| U3-04 判侧 | 左→右 / 右→左、`goalRegion` 外扩、spawn 精确、同侧 / 跨门、边界相切、未外扩 Goal Rect 反例、非法目标 |
| U3-05 注入 | 原样注入、`expandedRect`、建图调用序列、不可穿越、`blocked` 不变、门顶不是地板、预扩张 / 重复扩张、不同源 |
| U3-06 反例 | D4 §11 的 1–4、6、13 + ε 不进谓词 + 确定性与公共面 |
| 边界 | 不 import `temporal.ts` / `temporal-witness.ts`、DAG 导入白名单、无 barrel、无 `TEMPORAL_LAG_*` / `Symbol(` / `analyze:`、无图割、无采样循环、导出符号 `@internal` |

## 2. D4 §11 反例（R3 范围）

| # | 反例 | 断言 |
| --- | --- | --- |
| 1 | 门宽用 pad / 扫掠并集 | `width = w − d`，不等于 `w + d`，也不含假设 pad；`L` 严格大于扫掠左缘 |
| 2 | 相位格采样 / 只取上升段 | 覆盖必须两段（`[0,P/2]`、`[P/2,P]`），总长 = `P`；覆盖函数无循环 |
| 3 | 整段扫掠区注入 `forbiddenBoxes` | 掩码与闭式展开不符 ⇒ `INCOMPLETE` + `geometry-untrusted` |
| 4 | 手工预扩张后再注入 | 重复扩张 ⇒ `INCOMPLETE` + `geometry-untrusted` |
| 6 | 同侧 / 目标跨门 / 起点不在严格一侧 | 全部 `INCOMPLETE` + `no-permanent-gate`，`sideRule` / `forbiddenInjection` 为 `null` |
| 13 | Witness lag pad 用到门区 | `L/R/width` 与闭式完全一致、不含 pad；模块无 `lagPad` |

## 3. 命令与结果

| # | 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | ---: | --- |
| C1 | `pnpm typecheck` | `06-typecheck.log` | **0** | 全 workspace Done |
| C2 | `pnpm build` | `06-build.log` | **0** | `tsc -b` + bundle 全部 Done |
| C3 | `pnpm exec vitest run …playability-temporal-gate.test.ts` | `06-gate.log` | **0** | **48 / 48 passed** |
| C4 | `pnpm exec vitest run …playability-temporal-input.test.ts` | `06-temporal-input.log` | **0** | **65 / 65 passed**（T-55 / T-57 / T-58 / T-61 / T-62 / T-64 保持 ✓） |

> 首次 gate 测试有 1 条失败：ε 对比用例把门区整体右移后未同步移动目标，判侧按设计返回
> `no-permanent-gate`。已把该用例的目标移到门右侧后复跑至全绿。产品代码未因此修改。

## 4. 边界声明

- 本票未修改产品代码；未覆盖 U4 图割 / hop 双档；未修改 `playability-temporal-input.test.ts`。
- 未新增 JSON fixture / 依赖 / 公共导出；未推送、未创建 PR、未合并。
