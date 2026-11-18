# PU-C5 unit brief · 空中控制证据生产（条件 5）

| 项 | 值 |
| --- | --- |
| 票 | [`06-pu-c5-brief`](../issues/06-pu-c5-brief.md)（grilling，resolved 2026-11-18） |
| 授权包 | `docs/v7.8/移动-收口.md` §6（UNSIGNED 草案） |
| 证据合同 | [`18-i03-pu-air-control.md`](../../level-playability-v1.1-i03/issues/18-i03-pu-air-control.md)（条件 5 合同，已冻结） |
| 差分底座 | [`01-coverage-inventory`](../evidence/01-coverage-inventory.md) §3.3 |
| 状态 | **brief 冻结；PU-C5 `NOT_AUTHORIZED`**——实施前仍需独立增量授权记录 + 用户签署 |
| 基线 | 单元分支切出时的 `main` SHA（不在本 brief 预填） |

## 0. 单元性质

PU-C5 = **纯证据生产**（纯 audit）：

- 产出条件 5 的 E1 / E2 / E3 证据、A/B 证明与独立复核；
- **不改** Runtime / `reach.ts` / `scene.ts` / `profile.ts` / `graph.ts` / `temporal-gate.ts` / 任何产品源码；
- **不改** `movementModelClosure` 常量、`PUBLIC_PU` gate 或 `publicCapability`；
- 证据 `PASS` 只表示「条件 5 的证据成立」，不改变产品状态。

## 1. 控制包络 E（继承合同 §1，不重开）

| 维度 | E 内 | E 外 |
| --- | --- | --- |
| 水平 | 任意时刻 `vx ∈ {-speed, 0, +speed}`（地面 / 空中 / 下落） | 超过 `speed` |
| 垂直 | 重力恒定；仅 `onFloor` 单次 `vy = -jumpVelocity` | 空中再跳、二段跳、冲刺、墙跳、梯子、y 轴输入 |
| 悬崖 | walk-off 后保留水平控制，抛物线下落 | 下落中改变 `vy`（重力除外） |
| 平台 | 只有静态 `solid` 可作落点 | moving solid / moving platform |
| 世界边界 | Runtime 实测（C14） | 假定不可越界而不验证 |

E 外运动 ⇒ `model-out`，不得 PU。E 的定义以合同为准；本 brief 不改写。

## 2. C1–C17 矩阵与 required 集合

**required = C1–C15**；**C16 / C17 = 规则项**（证据索引与复核逐条确认未被违反，不占能力行）。

| # | 场景 | 期望 | 证据形式 | 现状（盘点） | PU-C5 动作 |
| --- | --- | --- | --- | --- | --- |
| C1 | 地面左右移动 | 可执行；`|vx| ≤ speed` | E1 + E3 | E1 `scene.ts:89` | 探针逐帧记录 |
| C2 | 空中水平控制 | 存在；无加速度限制 | E1 + E3 | E1 `scene.ts:89`（无条件 `setVelocityX`） | 探针空中输入 |
| C3 | 跳跃 | 仅 `onFloor`；空中再按不产生 `vy` | E1 + E2 + E3 | E1 `scene.ts:90-91`；E2 witness | 探针正向 + 负向 |
| C4 | y 轴输入 / 下穿 | 不存在 | E1 + E3 | E1 `scene.ts:85-91` | 探针无 y 输入 + 源码 |
| C5 | 二段跳 / 冲刺 / 墙跳 / 梯子 | 不存在 | E1 + E3 | E1 + `vocabulary.ts:41` | 探针组合输入 |
| C6 | walk-off 漂移 | 下落中仍可水平控制 | E1 + E3 | E1 `scene.ts:89` | 探针抛物线弧线 |
| C7 | moving solid | 不作落点；Runtime 不移动 | E1 + E2 + E3 | E1 `world.ts:104,114`；E2 witness | 探针 + 源码 |
| C8 | y 轴 Hazard | `model-out`，不得 PU | E2 | `playability-temporal.test.ts:144` PASS | 索引 |
| C9 | 多个移动 Hazard | `model-out` | E2 | 同 C8；`input.test.ts:490` PASS | 索引 |
| C10 | Danger + strike | `model-out` | E1 + E2 | E1 `temporal.ts:418`；无直接测试 | 新增 scratch 负向断言（I-04 的产品测试仅作佐证） |
| C11 | 门区高度 < 跳跃包络 | 条件 5 **FAIL** | A 证明 | MISSING | A 负例 |
| C12 | 门区覆盖跳跃包络 | 可 PASS（仍需其余项） | A 证明 | MISSING | A 正例 |
| C13 | 门区边缘空中绕行 | 扫掠拒绝或证明不可行 | B 证明 | MISSING | B 扫掠 |
| C14 | 世界边界 / 无 physics bounds | 实测；可越界须证明无害或 FAIL | E3 | PARTIAL | 探针界外采样 |
| C15 | 同环境重跑不一致 | IE（`nondeterministic`） | E3 | PARTIAL | 两次重跑零容差比较 |
| C16 | probe 未运行 / 证据缺失 | IE / `NOT_RUN` | 规则 | 规则 | 索引与复核确认 |
| C17 | `midAirHits=0` 当正面证据 | 禁止 | 规则 | E2 `evasion.test.ts:232,445` PASS | 索引与复核确认 |

条件 5 证据 `PASS` = **C1–C15 全部 required PASS + §3 A/B 通过 + 独立复核 PASS + 用户签署**。

## 3. 证明义务 A / B

### 3.1 A：垂直包容

- 输入：冻结的 `move.jumpVelocity` / `move.gravity`；Hazard 穿越带内的垂直跨度。
- 公式：`maxJumpHeight = jumpVelocity² / (2 × gravity)`（只读复用 `packages/contracts/src/game-config.ts:274`）。
- 判定：Hazard 垂直跨度必须覆盖 `[地面, 地面 + maxJumpHeight)`；覆盖不了 ⇒ **FAIL**（不是 IE）。
- 不得用实测最高点代替冻结参数。

**产出**：`evidence/proof-A.json`——逐案例输入参数、公式、`maxJumpHeight`、跨度、覆盖判定；C11 / C12 的合成正负例同时写入。

### 3.2 B：保守弧线扫掠

- 在 E 内：从每个可达地面点、每个 `vx ∈ [-speed, +speed]`、每次合法起跳扫抛物线；
- 必须覆盖 walk-off 弧线与空中水平控制；
- 证明没有任何弧线穿过门区到达 goal 侧；命中 ⇒ **FAIL**。

**产出**：`evidence/proof-B.json`——扫描网格（起点、`vx` 步长、时间步长）、覆盖声明、反例（若有）、未覆盖边界。离散扫描的保守性假设必须写在报告里，不得表述为形式化证明。

### 3.3 C 的定位

运行时探针只作支持证据；**不得**单独证明「不可达」，**不得**作为条件 5 正面证据。

## 4. 探针

- 复用 `packages/demo/probe/probe-harness.mjs`（headless Chrome + CDP + Phaser hook）；`slimState` 提供 `x / y / vx / vy / onFloor`。
- 依赖：Node 22、系统 Chrome、已构建 `packages/demo/dist`；记录 Node / Chrome 版本与 demo build SHA（`evidence/environment.json`）。
- 逐帧注入左 / 右 / 跳组合，覆盖 C1–C7 与 C14；记录原始帧序列。
- 同环境两次重跑，零容差比较（`evidence/probe-run1.json` / `probe-run2.json` / `diff.json`）；不一致 ⇒ C15 IE。
- 支持环境写死为本机 macOS + 记录版本；其他环境不推断，不跨环境合并结论。

### 4.1 夹具

- 新建 **scratch-only** 探针夹具于 `.scratch/level-playability-v1.1-closure/pu-c5/fixtures/`（inline config / 小 site）。
- 明确为 **audit 资产**，不得进入 `fixtures/**`；每个夹具记录 hash 与用途。
- P1 geometry-probe 位于 audit 分支 `wayfinder/i03-phase2-probe-evidence` @ `0b21984`；仅在需要几何帧时按 SHA 只读引用，不作为控制能力证据。
- C7 moving solid / C10 danger strike 的合成场景在本目录构造。

## 5. 证据、复核与签署

| 产物 | 路径 |
| --- | --- |
| 证据目录 | `.scratch/level-playability-v1.1-closure/pu-c5/evidence/`（`commands.log`、`probe-run1.json`、`probe-run2.json`、`diff.json`、`proof-A.json`、`proof-B.json`、`c-matrix.json`、`environment.json`、`invariants.json`、`SHA256SUMS`） |
| 证据索引 / 验收 | `.scratch/level-playability-v1.1-closure/pu-c5/reports/PU-C5-acceptance.md` |
| 复核报告（合同路径，权威） | `.scratch/level-playability-v1.1-i03/reports/pu-air-control-closure-review.md` |
| 用户签署 | `.scratch/level-playability-v1.1-closure/pu-c5/reports/PU-C5-signature.md` |

- fresh reviewer 未参与 PU-C5 的实施、包络定义、证据或授权包撰写。
- 复核必须：自己重跑探针；重算 `SHA256SUMS`；抽查至少 2 条自选断言；核对 E 包络无越界；核对 C16 / C17 未被违反。
- 复核 PASS 只表示条件 5 的证据成立；不设置 `ADMITTED`、不开放 `PUBLIC_PU`。

## 6. 判定与 gate 记录

- 条件 5 行逐项 `PASS / FAIL / INSUFFICIENT_EVIDENCE / NOT_RUN`；禁止通过率 / 加权。
- 单元整体结论：`PASS`（全部 required PASS + A/B + 复核 + 签署）/ `FAIL` / `INSUFFICIENT_EVIDENCE` / `NOT_RUN`。
- **gate 记录**：Ledger 行写「条件 5 证据 PASS，`PUBLIC_PU` gate 仍 `BLOCKED`，产品 `movementModelClosure` 仍 `not-proven-air-control`」。
- 证据 PASS 不改变 `publicCapability` / `publicResult` / gate 常量；条件 5 的产品状态变更属独立 effort。

## 7. STOP

合同 §5 五条全部继承，另加：

1. 探针两次重跑不一致且无法归因 ⇒ STOP。
2. 夹具进入 `fixtures/**` 或产品目录 ⇒ STOP。
3. 把证据 PASS 写成产品 gate / 常量变化 ⇒ STOP。
4. 消费未签署的 PU-C5 证据（含复用到 PU-ADMIT）⇒ STOP。
5. 发现 E 之外的运行时能力 ⇒ STOP + HITL。
6. 证明无法闭合，或需要改产品源码 / 加依赖 ⇒ STOP + HITL。

任一 STOP ⇒ HITL；不得自行缩范围或改写历史记录。

## 8. 回滚（纯 audit）

- 证据与脚本提交到独立 audit 分支 `wayfinder/closure-pu-c5-evidence`；`main` 只收报告。
- 回滚 = 丢弃该 audit 分支；产品零回滚；记录「无产品影响」证据。
- 不需要 revert drill。

## 9. Handoff（→ PU-ADMIT）

PU-C5 签署后向 PU-ADMIT 交付：`PU-C5-acceptance.md`、复核报告路径 + hash、签署记录、C1–C17 判定表、A/B 证据 hash、环境信息。

PU-ADMIT 只消费该签署证据；不得读取未签署的中间产物。条件 5 的 gate 仍 `BLOCKED`，直到 PU-ADMIT 在独立授权下形成六条件结论。

本 brief 不授权 PU-ADMIT，也不授权任何产品代码改动。
