# U2-06 测试矩阵与 D3 §11 反例

Type: task
Status: resolved
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

## Answer

**范围**：只新增 / 扩展白名单内两个测试文件，未改产品代码、既有测试、JSON fixture、`package.json` / vitest 配置。

- `packages/contracts/tests/playability-temporal-witness.test.ts`（新增，1294 行，68 tests）
- `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，只增 264 行：内存世界构造器）

实现提交：`fa2e8e9`（claim：`cd6ab7a`）。

### 测试计数与命令

| 命令 | 结果 |
| --- | --- |
| `pnpm build` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-witness.test.ts` | **68/68 passed**，exit 0 |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | **65/65 passed**，exit 0 |
| `pnpm test` | **173 files / 2742 tests passed**，exit 0；2 条已知 runner `Timeout calling "onTaskUpdate"`（与 U2-00 基线同类，非测试失败） |

基线（U2-00）为 172 files / 2674 tests；本票 +1 file / +68 tests。

### 覆盖清单（68 tests）

1. **网格（7）**：`N≥2`、`N_max=4`、`dt`、`maxStep`、`xPositions`、`stateCapacity`；容量把 `N` 压到 2 ⇒ `phaseGridCapped=true` / `state-capacity`、`maxStep=2`；容量恰好容纳 `N_max` 的边界；`N<2`、非法周期 ⇒ `grid-resolution-infeasible`（`phase-grid-infeasible` / `period-invalid`）；`witnessPhaseCellBounds` 逐位连续与 `k=N−1` 折周期。
2. **走廊 / spawn（9）**：`standable-run` 走廊与合法范围裁剪；solid 截断走廊；精确 spawn 盒；非整数 x / y ⇒ IE `spawn-not-on-lattice` 且不 `round()`；spawn 越界 / 压 solid / 不可站三个细分；`startCells()` 有邻近落脚点但**不替代**真实 spawn；目标在走廊外 ⇒ `goal-not-representable`；gate 缺失细分。
3. **到达（5）**：0.5px 四边内缩、`goalStates` 与相位无关；奇数玩家宽下未内缩会误收 `footX=86/94`、内缩后拒绝；Goal Rect 退化 ⇒ `goal-rect-degenerate`；无合法格点 ⇒ `goal-not-representable`；`witnessPlayerBox == boxFromFoot`（全走廊）。
4. **S1–S4（7）**：跨 solid 的 move（真实走廊 `state` + 放宽走廊单测 `static`）；wait 端点安全、区间内碰撞；`lagPad` 上升段右扩 / 下降段左扩；折返点切段（跨折返点格 `segments=2`）；S3 跨格 / 回退相位 / 越界 `k` / 非整数 `cycle`；`state` / `speed`；S4 链式连续（0 / `P` 偏移允许，时间 / x / 相位断裂拒绝）。
5. **残差等待（4）**：`symbolic` / `conservative-over-cell` / `cell-start` 形状；只查端点的反例（端点安全、折返点穿 spawn）；跨折返点安全格 `segments≥2`；相切安全、0.5px 正宽度碰撞失败。
6. **W（3）**：complete 时全 N 相位、rank 严格递减、Goal rank 0；最小不动点（永久屏障世界：spawn 侧逐边安全但 rank 不存在）；Hazard 穿 spawn 的相位格不覆盖。
7. **U9（6）**：四项判据（standable、`∀k` 接近、整周期等待、`∃ψ` 出口）；`[T_arr,T_arr+P]` 切段与统一 `lagPad`；同一 pad 贯穿两档；前置 `geometry-untrusted`；residual-wait 失败；`no-waiting-cell` 失败。
8. **Witness（6）**：D9 形状与字段闭集；`policy` 只引用 `verified=1` 并逐条重放；确定性序列化（两次独立运行逐字节相同 + 与夹具规范化 JSON 对账）；体积阈值（transitions / bytes 两类 4 个覆盖 + 非法预算）；U9 编码（trace / 停留 N 个单格 wait / `policy`）；不完整结果与非有限 Hazard 的失败无部分 witness。
9. **双档 lag（2）**：16.67ms / 200ms 各自独立编码；跨档复用 U9 停留记录（lag 不一致 / Hazard 速度不一致）⇒ `model-out`。
10. **D3 §11 十三条（13）**：逐条单独测试（见下）。
11. **预算（4）**：`maxStates` / `maxEdges` / `maxCutsPerBranch` 各自实际原因码、`policy=[]`、`phases=[]`；注入时钟 ⇒ `wall-clock-abort`；`maxCutsPerCheck=0` 下跨折返点格仍 verified（证明 U2 预切段）；U9 耗尽同样只 IE、无部分证书。
12. **确定性（2）**：W 的 rank / 策略 / 后继逐项相同；`serialized` / `bytes` 逐字节相同且不含 `wallClockMs`。

### D3 §11 十三条逐条

| # | 反例 | 测试结果 |
| --- | --- | --- |
| 1 | 跨 solid 的 move | 真实走廊 `state`；放宽走廊单测 `static`（S1 连续扫掠） |
| 2 | 非整数 spawn 10.4 | IE `spawn-not-on-lattice` / `spawn-foot-not-integer`，邻近整数格 standable 也不吸附 |
| 3 | Goal Rect 未内缩 | 奇数玩家宽下 `overlapsStrict(raw)=true` 而 `witnessArrives=false` |
| 4 | 残差等待只查端点 | 端点姿态无碰撞，整格检查 `hazard` 失败 |
| 5 | wait 端点安全、区间内碰撞 | `hazard` 失败 |
| 6 | 预算耗尽仍输出 NB | `insufficient` + 实际原因码 + 空策略 / 空 phases + encode 失败 |
| 7 | 安全循环、无终止 rank | 屏障世界 `failed`，spawn 列 wait 安全但无 rank / 无策略 |
| 8 | 跨 lag 拼接 | 16.67ms 结果按 200ms 请求编码 ⇒ `model-out` |
| 9 | `startCells()` 替代 spawn | 邻近落脚点存在，仍 IE `spawn-not-standable` |
| 10 | 目标在走廊外 | IE `goal-not-representable` / `goal-outside-corridor`，不推 PU |
| 11 | Goal Rect 退化 / 不可表达 | `goal-rect-degenerate` / `goal-not-representable` |
| 12 | 只查端点 standable | 端点只相切、S1 `static` 拒绝 |
| 13 | 整格覆盖写成具体 φ0 已验证 | 形状断言 `symbolic=true` / `conservative-over-cell`，无逐 φ0 字段 |

### 内存世界夹具（`TEST_ONLY`，无文件系统）

`playability-temporal-fixtures.ts` 只导出 raw object 构造器，再由测试交给 `parseAssetPack` / `parseGameConfig`；不注册测试、不读盘、不被 `src/**` 引用。

- 默认世界：100×60，地面顶边 `y=40`，玩家 2×20，spawn `(5,40)`，goal 在 `x=90`（取整盒 `[87,93]×[20,40]`），Hazard 4×12 在 `[50,60]` 往返 / 200ms，玩家速度 20px/s ⇒ `N_max=4`、`dt=50ms`、`maxStep=1`、走廊 `[1,99]`。
- 可调项：世界 / 地面 / 脚点 y、玩家尺寸与速度、spawn / goal、Hazard 位置 / 行程 / 周期 / 尺寸、可选脚点行 wall solid；`witnessHazard` 由同一组输入派生 `WitnessHazard`。
- 正样本世界把 Hazard 放在 `y=20`（盒底与玩家头顶 20 相切，严格不相交），使 W / U9 有完整证书；碰撞 / 屏障 / 残差 / lag 用例再各自覆盖 Hazard 位置。
- 失败样本世界：脚点行 wall（走廊截断 / 目标在走廊外 / spawn 压 solid）、`spawnY=30`（不可站）、退化 Goal、Hazard 覆盖 spawn（残差失败）、Hazard 永久屏障（最小不动点反例）。

### 已知限制 / 观察（不改产品代码）

1. **S1 与走廊的冗余**：静态 solid 若能被 S1 扫到，同一条 `blocked` 规则也必然把中间脚点格从 `standable` 移除；因此通过 `resolveWitnessSpace` 的真实走廊，跨墙 move 首先被走廊截断拒绝（`state`）。S1 分支本身用**测试内放宽的走廊对象**（`{...space, corridor:{...xHi}}`，端点只与 1px 墙相切）单测到 `static`，证明它不是端点采样；这不改变产品语义。
2. **`maxCutsPerCheck` 无法从 U2 入口单独耗尽**：U2 在调用 `intersectContinuous` 前已按折返点预切段，单次 check 没有内部 cut。测试用 `maxCutsPerCheck=0` 验证跨折返点格仍按两段解析检查（`segments=2`）；per-check 上限的执行归 U1 运动原语。
3. **`searchWinningSet` 的 `failed` 侧携带 goal 侧策略**（类型注释允许；`encodeWitness` 拒绝非 `complete`），与模块 U2-03 头注释「失败侧不携带部分策略（policy: []）」措辞不一致。仅是文档措辞不一致，无提升路径；产品代码不在本票白名单，未修改。
4. **W 的跨档隔离是入口形状保证**：W 转移记录不携带 lag，`encodeWitness` 一次只收一档；运行时 `model-out` 的跨档检查由 U9 停留记录（`hazardSpeed` / `lagPad`）承担，本票已覆盖后者。
5. 未写 A–J 矩阵 / U3–U5 场景；不把 U2 定向测试写成公共 NB / PU 能力。
