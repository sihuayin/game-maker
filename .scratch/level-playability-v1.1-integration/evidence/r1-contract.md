# I00-R1 输入输出契约（冻结草案）

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I00-R1](../issues/10-i00-r1-contract-freeze.md) |
| 依据 | I00-01～07、I00-10 证据 + B1/B2 + 用户 2026-11-09 裁定 |
| 状态 | **待用户签署**；未签署前不得作为实施依据 |
| 修改产品目录 | **否** |

> 本草案是 `docs/v7.8/移动-I00.md` 的契约主体。条文用「必须 / 不得」；依据用 `file:line` 或证据链接。

## 1. 输入契约

| 输入 | 来源 | 必填 | 验证规则 | 失败 |
| --- | --- | --- | --- | --- |
| `GameConfig` | 现有（`game-config.ts`） | 是 | 现有 schema | IE |
| `AssetPackManifest` | 现有（`assetpack.ts:265`） | 是 | `verifyPack` 通过（`ops.ts:1918-1960`） | IE |
| **Atlas JSON 字节** | pack 内 `meta` 指向的文件 | 是 | **与 manifest `files[]` 记录同一份字节**：读取后立即校验 SHA-256，解析与比对必须使用这份字节 | IE |
| `FixedRuntimeProfile` | 现有（`profile.ts:37-58`） | 是 | 固定实例 | — |
| Hazard 运动描述 | `GameConfig` 的 `Motion`（`kind/axis/distance/periodMs`）+ `Entity.at` | 是 | `kind === "cycle"`、`axis === "x"`、`distance > 0`、`periodMs > 0` | IE |
| 分析范围 | `config.world` + 玩家起点 / 目标 | 是 | 起点盒与终点在范围内 | IE |
| `lagMs` | **显式入参** | 是 | 有限非负数；无隐式默认 | IE |
| `T_arr`（玩家抵达时刻） | 可选 | 否 | 若提供，必须可追溯 | 缺省时按 §3 处理 |

**TOCTOU 条文**：禁止「先 `verifyPack`，再重新读取一个可能被替换的文件」。读取、哈希校验、几何比对必须使用**同一份字节**。

## 2. 运动模型

1. **单 x 轴 hazard**；`Motion.kind` 必须为 `cycle`；`periodMs` 是**往返整周期**（`hazard.ts:14-19`）。
2. `t = 0` 时 hazard 锚点位于 `at`；折返点在 `t = periodMs/2`，两端不停留。
3. **相位当自由变量**：不假设「玩家第一次看到 hazard 时它恰好在 `t=0`」。
4. **U9（安全等待格）**：相位自由的前提是存在**可达、可等待、且等待过程本身安全**的安全等待格。三者必须逐一被证明；地图上有一个空格不等于 U9 成立。
5. 模型外（y 轴、多移动 hazard、moving platform、danger 联合、非 `cycle`、状态转换）⇒ IE，不得静默近似。

## 3. 时间与 lag

1. 只使用 **game-time**；禁止墙钟相位判据。
2. `lagMs` **必填**：核心 API 每次只接受一个值，内部不得有第二个默认值。
3. 上层编排以两档（**16.67ms / 200ms**）分别调用并比较。
4. **两档结论不一致 ⇒ `INSUFFICIENT_EVIDENCE`**。
5. 200ms 是 `smoothStep` 下 `delta ≤ 200ms` 的**源码上界推导值**，不是实测延迟；证据必须如实标注。
6. 不得复用 `mechanic.ts:62` 的 `FRAME_MARGIN_MS`。
7. 若 `T_arr` 无法确定且 U9 不成立 ⇒ IE（PRD FR-07 的语义映射）。

## 4. 几何、网格与容差

1. **相切语义**：时序判定与 `overlapsStrict` 同义（贴着不算撞，`geometry.ts:14`）。须由 I-01 补一条 Phaser overlap 的直接证据；若推翻，改的是 Runtime 语义基线。
2. **实现方式**：必须解析求交（折返点切段），不得逐点采样。
3. **门宽**：`R − L > ε`；不设语义阈值。
4. **容差**：单一具名常量 `ε = max(1e-9, 1e-9 × (xMax − xMin))`，只在一处定义。
5. **网格**：`N ≥ 2`；`N ≤ floor(maxSpeed × periodMs / xStep)`；在可行上界内取最大 `N`，再受 `maxStates` / `timeBudgetMs` 约束；空区间或预算耗尽 ⇒ IE（`grid-resolution-infeasible` / `search-budget-exhausted`）。
6. 不得要求 `v_hazard × dt ≤ xStep`（B1：可靠性来自解析求交，不来自采样密度）。

## 5. 三态判定

### 5.1 `PROVEN_UNPLAYABLE`（六条同时成立）

1. 门区恒覆盖：`R − L > ε`，且任意相位、任意合法 lag 位姿下都被覆盖（**交集，不带 pad**）。
2. 全部参与判定的几何 `checked`；hazard 帧几何通过 §1 的信任链。
3. 含 hop 边的移动图上，起点脚点与终点脚点不连通（`graph.ts`，`forbiddenBoxes` 注入门区的外扩矩形）。
4. **hop 采样加倍不变性**：`hopSamples` 的 `n` 加倍后连通性结论不变。
5. 模型外规避已排除（`graph.ts` 的边集之外无可用移动）。
6. 两档 lag 结论一致。

### 5.2 `NO_PROVEN_BLOCKER`

- 存在**连续时间验证**过的安全 witness（每条线段通过解析求交），且两档 lag 结论一致。
- 必须同时携带 `coverage`，其中 `temporal = checked`。
- 不代表关卡可玩。

### 5.3 `INSUFFICIENT_EVIDENCE`

其余全部。不得被提升为另两态。

### 5.4 禁止

- BFS 无解 / 预算耗尽 / 采样未撞 ≠ PU。
- 任一必要几何证据非 `checked` ⇒ 不得输出确定性结论。
- 调用方的 `verticalEvasionImpossible` 标记一律不接受。

## 6. coverage

1. 新增**内存内** `coverage.temporal`，取值 `checked` / `partial` / `unknown`。
2. `coverage.spatial` 行为**一字不改**；不得因它恒为 `partial` 而回退 9 个既有用例。
3. 移动 hazard 的机制判定必须检查 `coverage.temporal`：非 `checked` ⇒ 机制层 IE；`checked` 才进入时序判定。
4. `temporal = checked` 只表示所需输入与模型检查完成，**不代表已证明可通行**。
5. **顶层优先级**：时序层证据不足不得被 `api.ts:87-92` 聚合成 `NO_PROVEN_BLOCKER`；必须补一条覆盖顶层聚合路径的测试。
6. 不新增持久化 verdict、不新增 `ConfigIssue.code`。

## 7. 证据格式

在现有 `PlayabilityEvidence` 上做**加法**：

| 字段 | 含义 |
| --- | --- |
| `model` | 使用的运动模型标识与参数（单 x 轴 / 三角波 / 周期） |
| `lag` | 两档 `lagMs` 与各自结论 |
| `degradation` | 降级原因码与缺失项 |
| `limits` | 覆盖范围与已知限制 |

- 不改 `ConfigIssue`、不加 `code`、不新增持久化 schema、不引入落盘证据链。
- 「可审计」= 测试 + 冻结契约 + scratch 原始证据 + 审计过程可复核，**不是**生产运行结果可持久化追溯。此句必须同时出现在冻结文档与能力声明中。

## 8. 降级矩阵

| 条件 | 结果 |
| --- | --- |
| 缺 `lagMs` / 非法 | IE |
| 两档 lag 结论不一致 | IE |
| 相位不可确定且 U9 不成立 | IE |
| 非 `cycle` / 非 x 轴 / 多移动 hazard / moving platform / danger 联合 | IE |
| pack 未通过 `verifyPack` | IE |
| Atlas 字节哈希不符 / 缺失帧 / 帧数不符 / `sourceSize` 不符 / **anchor 缺失或不符** | IE |
| 任一参与判定的几何非 `checked` | IE |
| 门区非正宽度 / 判侧不成立 | IE |
| 图仍连通 / hop 加倍后结论改变 | IE |
| 网格区间为空 / 预算耗尽 | IE |
| 模型外规避无法排除 | IE |

## 9. 授权边界

- 本契约**不构成实施授权**。
- 公共面改动（`auditPlayability` 签名、新增输入、证据字段扩展、`coverage.temporal`）必须先经 **I00-R2** 白名单裁定，再经独立实施授权。
- 未授权 I-01 执行。
