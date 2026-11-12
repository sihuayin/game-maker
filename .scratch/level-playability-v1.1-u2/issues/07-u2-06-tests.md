# U2-06 测试矩阵与 D3 §11 反例

Type: task
Status: open
Owner: claude (U2-06 session 2026-11-12)
Blocked by: 06
Map: ../map.md
Class: U2 / TESTS

## Task

为 U2 写定向测试与内存夹具扩展。只覆盖 U2；**不写 A–J 矩阵**（U5）。

### 允许文件

- `packages/contracts/tests/playability-temporal-witness.test.ts`（新增）
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，只增）
- 不新增 JSON fixture；不读写文件系统；不修改既有测试。

### 必须覆盖

- **网格**：`N ≥ 2`、`N_max`、容量、`phaseGridCapped`、`grid-resolution-infeasible`。
- **走廊 / spawn**：`standable` 连通段、非整数 spawn ⇒ IE、`startCells()` 替代禁止、目标在走廊外 ⇒ IE。
- **到达**：0.5px 内缩、退化 / 不可表达、状态边界到达。
- **S1–S4**：跨 solid 的 `move`、折返点切段 + pad、相位 / 时间连续、连接连续。
- **残差等待**：整格保守覆盖；只查端点的反例。
- **U9**：`∀k` 接近、整周期等待、`∃ψ` 出口、同一 pad。
- **W**：最小不动点、全 N 格、rank、循环无终止反例。
- **Witness**：形状、`policy` 只引用 `verified`、派生盒 == 解析盒、确定性序列化、体积阈值。
- **双档 lag**：独立 Witness；禁止跨档共享 / 拼接。
- **D3 §11 十三条反例**：逐条覆盖，且必须失败 / 必须 IE。
- 标题带 `[I02-02][AC-03]` / `[I02-02][AC-04]` 等可追溯编号。

### 禁止

- 修改产品代码 / 既有测试 / JSON fixture；A–J 矩阵；U3–U5 场景；把 U5 硬化写成 U2 已通过。

### 验收

定向 vitest 与全量 `pnpm test` 通过；既有测试零修改；无 JSON fixture / 文件系统依赖；测试计数写入 U2-07 报告。
