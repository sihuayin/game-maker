# I03-PU-Air-Control-Closure — 空中控制与模型外规避闭合证据

Type: grilling
Status: resolved
Owner: claude (I03-PU-Air-Control session 2026-11-14)
Blocked by: —
Map: ../map.md
Class: I-03 / DECISION

## Question

`PUBLIC_PU` 条件 5「模型外规避已排除」需要哪些证据、由谁产生、如何独立复核？在它闭合前，`PUBLIC_PU` 必须保持 `BLOCKED`；U4 的 conditional 图割与 `midAirHits = 0` 都不构成正面证据。

### 必须裁定

1. 必须排除的模型外规避行为：空中水平控制、walk-off 漂移、moving platform、y 轴、其他未建模运动。
2. 需要的 Runtime / 控制能力证据（源码、探针、运行时观测、负向测试）。
3. 证据产生者与产生方式；是否新增依赖 / 是否修改 Runtime / `reach.ts` / `scene.ts`。
4. 负向测试矩阵：哪些行为必须被证明不可达 / 不可规避。
5. 独立复核人与复核标准；E1 / E2 / E3 证据格式。
6. `PASS / FAIL / INSUFFICIENT_EVIDENCE` 判定规则与停止条件。

### 禁止

- 用 U4 conditional 图割、`midAirHits=0`、NB 结果替代条件 5；
- 在本票之外开放 `PUBLIC_PU`；
- 修改 Runtime / 产品代码 / 已签署 I-02 原文；
- 推送 / PR / 合并。

### 验收

条件 5 的可执行判据、证据来源、负向矩阵、独立复核标准、PASS / FAIL / IE 规则；未闭合项显式列出。

## Answer

（resolved 时填写）
**Q1=B / Q2=A / Q3=A / Q4=A / Q5=A / Q6=通过 / Q7=A+B / Q8=通过 / Q9=通过 / Q10=通过。**
冻结 **PU 条件 5 的可执行证据合同**：用**有界控制包络上的保守不可达证明**替代“运行时能力不存在”的错误前提。
**本票不产生证据、不实现证明、不闭合条件 5；`PUBLIC_PU` 仍 `BLOCKED`。**

### 0. 冻结结论

| 题 | 结论 |
| --- | --- |
| Q1 | **B**：控制包络上的保守不可达证明；A 与代码事实冲突，C 是玩法变更，D 等于放弃闭合 |
| Q2 / Q6 | 有界控制包络 E（见 §1） |
| Q3 | 只读源码证据 + `.scratch` Phaser 探针 + 负向测试；不改 Runtime |
| Q4 | 探针逐帧采样控制能力清单与轨迹包络 |
| Q5 | 逐项 `PASS / FAIL / INSUFFICIENT_EVIDENCE / NOT_RUN`；fresh 独立复核 |
| Q7 | **A 垂直包容 + B 保守弧线扫掠**；C 只作支持证据 |
| Q8 | 17 条能力 / 负向矩阵 C1–C17（见 §3） |
| Q9 | E1 / E2 / E3；独立复核报告路径 |
| Q10 | 判定规则 + STOP 清单（见 §5） |

### 1. 控制包络 E（Q2 / Q6）

| 维度 | E 内（允许） | E 外（禁止） |
| --- | --- | --- |
| 水平 | 任意时刻 `vx ∈ {-speed, 0, +speed}`，含地面、空中、下落 | 超过 `speed` 的水平速度 |
| 垂直 | 重力恒定；仅 `onFloor` 时单次起跳 `vy = -jumpVelocity` | 空中再跳、二段跳、冲刺、墙跳、梯子、y 轴输入 |
| 悬崖 | walk-off 后保留水平控制，按抛物线下落 | 下落中改变 `vy`（重力除外） |
| 平台 | 只有静态 `solid` 可作落点 | moving solid 作落点 / moving platform |
| 世界边界 | 按 Runtime 实测处理（C14） | 假定不可越界而不验证 |

配置出现 E 外运动（y 轴 Hazard、多移动 Hazard、moving solid、Danger 联合）⇒ `model-out`，不得 PU。

**代码事实（E1）**：

- `packages/demo/src/shell/scene.ts` 的 `update()` 每帧无条件 `setVelocityX(...)`，空中水平控制存在；
- 跳跃只在 `onFloor` 时触发；无二段跳 / 冲刺 / 墙跳 / 梯子 / y 轴输入；
- `packages/demo/src/world.ts` 只把**不带 `motion`** 的 `solid` 当落点。

### 2. 证明义务（Q7）

条件 5 的 `PASS` 需要**两条独立证明**同时成立：

#### 2.1 A：垂直包容

- Hazard 在穿越带内的垂直跨度必须覆盖 `[地面, 地面 + maxJumpHeight)`；
- 覆盖不了 ⇒ **FAIL**（不是 IE），PU 候选不得 `ADMITTED`；
- `maxJumpHeight` 必须来自冻结的运动参数（`jumpVelocity` / `gravity`），不得用实测最高点代替。

#### 2.2 B：保守弧线扫掠

- 在 E 内，从每个可达地面点、每个 `vx ∈ [-speed, speed]`、每次合法起跳扫抛物线；
- 证明没有任何弧线穿过门区到达 goal 侧；
- 命中 ⇒ **FAIL**；
- 扫掠必须覆盖 walk-off 弧线与空中水平控制；不得只扫单条轨迹。

#### 2.3 C 的定位

运行时探针采样**只是支持证据**，不能单独构成“不可达”证明，也不能作为条件 5 的正面证据。

> 现有 `temporal-gate.ts` 只要求 Hazard 盒 y 区间与 spawn 盒**严格重叠**，不要求覆盖跳跃高度；因此 A / B 是新增证明义务，不能由现有门区证明代替。

### 3. 能力 / 负向矩阵（Q8）

| # | 场景 | 期望 | 级别 |
| --- | --- | --- | --- |
| C1 | 地面左右移动 | 可执行；速度上限 `speed` | 能力基线 |
| C2 | 空中水平控制 | **存在**；`|vx| ≤ speed`，无加速度限制 | 正面能力 |
| C3 | 跳跃 | 仅 `onFloor` 触发；空中再按跳不产生 `vy` | 正面 + 负向 |
| C4 | y 轴输入 / 下穿 | **不存在** | 负向 |
| C5 | 二段跳 / 冲刺 / 墙跳 / 梯子 | **不存在** | 负向 |
| C6 | walk-off 漂移 | 下落中仍可水平控制 | 正面能力 |
| C7 | moving solid | 不作落点；Runtime 不移动它 | 负向 |
| C8 | y 轴 Hazard | `model-out`，不得 PU | 负向 |
| C9 | 多个移动 Hazard | `model-out` | 负向 |
| C10 | Danger + strike | `model-out` | 负向 |
| C11 | 门区高度 < 跳跃包络（可跳过） | 条件 5 **FAIL** | 证明负向 |
| C12 | 门区覆盖跳跃包络 | 条件 5 可 PASS（仍需其余项） | 证明正例 |
| C13 | 从门区边缘空中绕行 | 弧线扫掠必须拒绝或证明不可行 | 证明负向 |
| C14 | 世界边界 / 无 physics bounds | 探针实测；若可越界，证明无害或 FAIL | 边界 |
| C15 | 同环境重跑不一致 | IE（`nondeterministic`） | 证据 |
| C16 | probe 未运行 / 证据缺失 | IE / `NOT_RUN` | 证据 |
| C17 | 用 `midAirHits=0` 当条件 5 正面证据 | **禁止** | 规则 |

### 4. 证据产生与独立复核（Q3 / Q4 / Q9）

- 只读源码证据 + `.scratch` 内 Phaser 探针 + 负向测试；不修改 Runtime / `reach.ts` / `scene.ts` / `profile.ts` / `graph.ts`；不新增依赖。
- 探针逐帧注入左 / 右 / 跳组合，记录 `vx / vy / x / y / onFloor`；验证 C1–C7；同环境重跑，零容差比较。
- 复核人：fresh 独立会话，未参与 probe、包络定义、证据或授权包撰写。
- 必须自己重跑探针、重算 hash、抽查至少 2 条自选断言。
- **E1**：`scene.ts` / `world.ts` / `profile.ts` / `graph.ts` 的 `file:line`；
- **E2**：探针与负向测试名、断言、退出码；
- **E3**：scratch 复跑命令、路径、计数、原始输出摘要。
- 报告路径：`.scratch/level-playability-v1.1-i03/reports/pu-air-control-closure-review.md`。
- 复核 PASS 只表示“条件 5 的证据成立”；**不**自动设置条件 5、`ADMITTED`、`OPEN` 或开放 `PUBLIC_PU`。

### 5. 判定规则与 STOP（Q10）

条件 5 状态只有 `PASS / FAIL / INSUFFICIENT_EVIDENCE / NOT_RUN`，逐项判定，禁止通过率。

| 状态 | 条件 |
| --- | --- |
| `PASS` | C1–C17 全部 required 行 PASS + §2 A/B 证明通过 + 独立复核 PASS + E1/E2/E3 齐全 |
| `FAIL` | 任一 required 能力 / 证明 / 负向不符（尤其 C11、C13） |
| `INSUFFICIENT_EVIDENCE` | 证据缺失、环境不匹配、非确定性、未运行 |
| `NOT_RUN` | 尚未执行或依赖未满足 |

STOP + HITL：

1. 发现 E 之外的新控制能力；
2. 证明无法闭合；
3. 需要修改 Runtime / `reach.ts` / `scene.ts` / `profile.ts` / `graph.ts`；
4. 需要新依赖；
5. 任何以 `midAirHits=0`、conditional 图割或 NB 结果替代条件 5 的尝试。

条件 5 `PASS` 仍不自动开放 `PUBLIC_PU`：仍需其余五项条件、独立复核、用户显式授权、gate 变更。

### 6. 边界

- 本票**只冻结证据合同**；不产生证据、不实现证明、不闭合条件 5。
- 不修改 Runtime / 产品代码 / 已签署 I-02 原文；不新增依赖。
- 若 A/B 证明需要修改 `temporal-gate.ts` 或新增证明模块，**不在 I-03 最小实施面内**，必须另开 effort / 单元授权；本票不授权。
- `PUBLIC_PU` 仍 `BLOCKED`；`midAirHits=0` / conditional 图割 / NB 结果仍不构成条件 5 正面证据。
- 不推送 / 建 PR / 合并。

### 7. 下游

- **I03-05 / 授权包 §9.3**：条件 5 的证据合同以本票为准；在证据产出并通过独立复核前，条件 5 恒 `BLOCKED`。
- **未来条件 5 实施 effort**：实现 A/B 证明与探针，产出 E1/E2/E3；不自动获得授权。
- **I03-10**：审查授权包时同时读取本票；本票不改变包内 `PUBLIC_PU` `BLOCKED` 状态。
- **I03-11**：签署授权包不闭合条件 5、不开放 PU。
