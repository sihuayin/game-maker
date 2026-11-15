# I03-07 实施单元、复核点、白名单与回滚

Type: grilling
Status: resolved
Owner: claude (I03-07 session 2026-11-14)
Blocked by: 05, 06, 07
Map: ../map.md
Class: I-03 / DECISION

## Question

为未来 I-03 实施 effort 定义单元拆分、依赖、复核点、白名单、停止 / 回滚与 Authorization Ledger。**本图不执行实施。**

### 必须裁定

- 最小面：`contracts`、`assets/ops.ts`、`pipeline/publish-gate`；`mechanic.ts` / `api.ts` 逐文件条件授权；
- CLI / MCP / Runtime / 持久化证据链 DEFERRED；
- 单元边界、依赖、复核点、增量授权；
- 白名单逐文件列出允许修改的内容；
- STOP + HITL 规则（白名单外 / 新依赖 / 公共 Contract 变化 / 拒稿行为变化）；
- 回滚与关闭条件；
- 不把本图变成实施授权。

### 禁止

- 预先授权任何实施单元；
- 扩大最小面 / 白名单；
- 把实施 PR、推送、合并纳入本图。

### 验收

单元 / 依赖 / 复核点表、逐文件白名单、STOP / 回滚规则、台账空白表。

## Answer

（resolved 时填写）
**Q1=A / Q2=A / Q3=A / Q4=A / Q5=A / Q6=通过 / Q7=有条件通过（仅修订 11）/ Q8=通过 / Q9=通过 / Q10=通过。**
执行顺序冻结为 **U1 → U2 → U4 → U5 → U3**。本票只冻结实施边界与授权台账形状；**不授权任何单元开工**。

### 0. 冻结结论

| 题 | 结论 |
| --- | --- |
| Q1 | 按契约缝切五个独立单元；不按包切、不再细分 |
| Q2 | U4 接入真实分析 `analyzeTemporalInternalTwoLag`（经 U1 适配器）；T-58 按新语义改写 |
| Q3 | `moving-hazard-phase` gap 替换为独立 U3，最后执行 |
| Q4 | Authorization Ledger 放在 `docs/v7.8/移动-I03.md` 内，I-03 只留空白表 |
| Q5 | 白名单逐文件精确路径；禁止 glob / 目录通配 / 按包授权 |
| Q6 | 五单元逐文件白名单照案冻结（见 §2） |
| Q7 | 12 条 STOP + HITL，仅第 11 条按修订措辞冻结（见 §3） |
| Q8 | 五道通用复核门 + 单元专属门（见 §4） |
| Q9 | 单元独立回滚；U4 / U5 / U3 必须回滚演练（见 §5） |
| Q10 | 正常 / 中止关闭条件；关闭不等于开放能力（见 §6） |

### 1. 单元与依赖

| 单元 | 范围 | 依赖 |
| --- | --- | --- |
| **U1** | contracts 公共证据类型 + 适配器（I03-01） | — |
| **U2** | contracts 能力门 + 公共 Verdict 映射（I03-02） | U1 |
| **U4** | assets `runTemporalAudit` 接入真实分析并产出证据（I03-01 / I03-06） | U1、U2 |
| **U5** | pipeline `publish-gate` 诊断字段（I03-06） | U4 |
| **U3** | contracts `mechanic.ts` gap 替换（I03-02 §4） | U4、U5 复核通过 |

- 执行顺序固定 **U1 → U2 → U4 → U5 → U3**。
- 每个单元独立分支、独立 PR、独立复核、独立授权；上一单元复核通过并签署后，下一单元才可开始。
- U3 不得提前：旧 gap 先删而真实时序链路未接通，会出现诊断空窗。
- 真实分析接线不等于 NB / PU 证据准入；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`。
- `analyzeTemporalInternalTwoLag` 的内部 `publicCapability="BLOCKED"` / `publicResult=null` 不得改写。
- 真实分析返回 `nb-candidate` / `pu-candidate` 不得产生公共安全或不可玩结论。

### 2. 逐文件白名单（Q6）

白名单记录**操作类型**与**单元限定目的**；列入白名单是必要条件，不是充分授权。

| 单元 | 文件 | 操作 | 限定目的 |
| --- | --- | --- | --- |
| **U1** | `packages/contracts/src/playability/verdict.ts` | 修改 | 公共 coverage / evidence / witness 加法字段与类型 |
| | `packages/contracts/src/playability/temporal-evidence.ts` | 新增 | 内部结果 → 公共 evidence 的适配器 |
| | `packages/contracts/src/playability/api.ts` | 修改 | U1 相关导出 |
| | `packages/contracts/tests/playability-api.test.ts` | 修改 | U1 覆盖 |
| | `packages/contracts/tests/playability-temporal-evidence.test.ts` | 新增 | U1 适配器测试 |
| **U2** | `packages/contracts/src/playability/public-verdict.ts` | 新增 | 能力门 + 公共 Verdict 映射 |
| | `packages/contracts/src/playability/api.ts` | 修改 | U2 相关导出；**仅限 U2 职责** |
| | `packages/contracts/tests/playability-public-verdict.test.ts` | 新增 | U2 映射 / 优先级 / 冲突测试 |
| **U4** | `packages/assets/src/ops.ts` | 修改 | `runTemporalAudit` 接真实分析并产出证据 |
| | `packages/assets/tests/ops.test.ts` | 修改 | U4 覆盖 |
| | `packages/contracts/tests/playability-temporal-input.test.ts` | 修改 | **仅 T-58**：允许显式适配器路径、保留禁止路径 |
| **U5** | `packages/pipeline/src/publish-gate.ts` | 修改 | 诊断字段消费 |
| | `packages/pipeline/tests/publish-gate.test.ts` | 修改 | G1–G11 + 变异测试 |
| **U3** | `packages/contracts/src/playability/mechanic.ts` | 修改 | 移除 `moving-hazard-phase` gap |
| | `packages/contracts/tests/playability-mechanic.test.ts` | 修改 | 按新语义改写，保留负向覆盖 |
| | `packages/contracts/tests/fixtures/playability-mechanic-matrix.json` | 修改 | **仅 `wide-patrol` 行** |

特别约束：

1. `api.ts` 跨 U1 / U2 重复出现是允许的，但**不是一次性授权**：U2 只能在 U1 独立复核通过并签署后修改，且只改 U2 职责范围。
2. U3 的 `wide-patrol` 行必须纳入白名单，否则现有 `expectedGap: "moving-hazard-phase"` 与 U3 目标无法同时成立；授权**不**扩展到其他 fixture 行。
3. U4 的 T-58 修改只允许证明新的显式适配器路径，并保留禁止路径断言；不得借机修改其他测试约束。
4. U4 若发现 U1 适配器 API 不足：**STOP + HITL**，不得扩 U1 API 或临时改 contracts 源文件。
5. 全局禁区：`package.json`、`pnpm-lock.yaml`、`tsconfig*`、`packages/demo/**`、`packages/cli/**`、`packages/mcp/**`、`scripts/**`、`docs/**`、`.github/**`、白名单外 fixture。`docs/**` 归 I03-09。

### 3. STOP + HITL（Q7）

任一触发即停止当前单元并交回用户：

1. 修改 / 新增任何白名单外文件；
2. 新依赖、`package.json` / lockfile / tsconfig 变化；
3. 公共契约形状超出 U1 / U2 已列类型；
4. 任何放行 / 拒稿行为或退出码变化；
5. gate 状态从 `BLOCKED` 变化、准入状态变化、证据基线变化；
6. 改动未逐条列出的既有断言（仅 T-58 与 U3 的 mechanic 测试 / `wide-patrol` 行获准）；
7. 新增 `runTemporalAudit` / `auditPlayabilityTemporal` / `verifyTemporalInput` 生产调用者；
8. `runTemporalAudit` 改成 async、新增可能抛出的行为、或签名不兼容；
9. 触碰 Runtime / `scene.ts` / `reach.ts` / 几何语义 / probe / 白名单外夹具；
10. 持久化时序证据或改 `qa-report/v1`；
11. **引入非确定性语义、以墙钟影响算法结果或分支选择、将墙钟数据纳入确定性签名、或导致跨进程结果不稳定。仅允许 I-02 已冻结的 abort-only 墙钟检查；该检查只能中止计算，不能改变计算语义、证明结论或确定性签名。**
12. 修改 I-02 内部算法、`publicCapability` 或 `publicResult`。

补充：**白名单是必要条件，不是充分授权**；列入白名单的文件仍不得用于本单元目的之外的修改。

### 4. 复核门（Q8）

每个单元固定五道通用门，全过并签署后才允许下一单元：

1. 单元测试 + 全量 `pnpm test` + `tsc -b` + `check:deps` 全绿；
2. 独立复核人（未参与该单元实现，fresh 会话）按白名单逐文件核 diff、测试证据与操作目的；
3. 不变量快照：`publicCapability="BLOCKED"`、`publicResult=null`、NB / PU gate `BLOCKED`、发布拒稿行为不变；**必须同时保存修改前基线与修改后结果**，不得只凭修改后状态推断“行为未变”；
4. 复核报告与 E1 / E2 / E3 证据落盘，记录路径与 hash；
5. 用户在该单元 Ledger 行显式签署后，才进入下一单元。

单元专属门：

- **U4**：T-58 同时证明允许路径与禁止路径；保留 stub 负向覆盖；双档运行有可重放的确定性证据。仅证明新适配器“能被调用”不足以通过。
- **U5**：I03-06 的 G1–G11 + 变异测试全过。
- **U3**：不能只检查旧 gap 字符串消失；必须证明 temporal 层完整接管原诊断责任；适用 / 非适用 / 缺失时序结果均不得出现诊断空窗或错误放行；`moving-platform-unsupported` 及其余 mechanic 语义不变。

### 5. 回滚（Q9）

- 每个单元在实施时填写回滚目标 SHA 与回滚命令；**不得预填虚构 SHA**。
- 回滚顺序固定 **U3 → U5 → U4 → U2 → U1**（逆执行序）。
- **U4 / U5 / U3 必须实际进行回滚演练**：在单元分支 revert 后跑相关测试，保留日志与 hash。
- **U1 / U2** 允许文档化回滚，但必须记录实际回滚提交 SHA。
- 必须区分：
  - **回滚演练**：在单元分支执行 revert、跑测试、记录证据；演练产生的回滚状态**不得**当作正式交付状态。
  - **正式回滚**：中止或故障时按逆序回滚已落地单元，最终目标为各单元实施前基线。
- 假 NB / 假 PU / 公共证据健全性问题不能只靠代码回滚，还必须：
  1. 关闭相应全局能力 gate；
  2. 使受影响的公共证据基线失效；
  3. 把受影响结果恢复为 IE；
  4. 记录失效范围、原因、重新开放所需的独立复核与用户授权。

### 6. 关闭条件（Q10）

**正常关闭**（全部满足）：

- U1–U5 全部完成独立复核与用户签署；
- Ledger 每一行都有实施 SHA、复核证据、批准记录与回滚信息；
- 全量测试、类型检查、依赖守卫全绿；
- `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；`publicResult=null`；
- 发布拒稿行为与冻结基线一致；
- 不存在未处理的白名单外修改或未解决的 STOP 事项。

**中止关闭**：按逆序回滚全部已落地单元，回到各单元实施前基线；重新运行全量测试与依赖守卫；Ledger 记录中止原因、实际回滚 SHA 与最终验证结果。

**关闭 ≠ 开放**：I03-07 正常关闭只表示本轮生产接线、证据映射、诊断接管与复核工作完成；`PUBLIC_NB` / `PUBLIC_PU` 开放是独立的后续准入决策。即使 U1–U5 全部通过，也不能据此把任一 gate 从 `BLOCKED` 改为 `OPEN`。

### 7. Authorization Ledger（空白表）

放在 `docs/v7.8/移动-I03.md`；I-03 只提供空白表，**不预填批准结果**。

| 单元 | 文件（操作 / 目的） | 增量授权状态 | 实施 SHA | 复核证据路径 + hash | 批准人 | 日期 | 回滚目标 SHA | 回滚演练证据 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| U1 |  | 未授权 |  |  |  |  |  |  |  |
| U2 |  | 未授权 |  |  |  |  |  |  |  |
| U4 |  | 未授权 |  |  |  |  |  |  |  |
| U5 |  | 未授权 |  |  |  |  |  |  |  |
| U3 |  | 未授权 |  |  |  |  |  |  |  |

- 空白字段 = 尚未授权或尚未完成，**不能用计划状态代替批准**。
- 回滚 SHA 在实施时填写，不能规划阶段预填。

### 8. 必须保留的现有测试守卫

| 守卫 | 处理 |
| --- | --- |
| T-61 `runTemporalAudit` 生产调用者恰好三处 | 保持三处；U4 不得新增调用者 |
| T-56 / T-57 `verifyTemporalInput` / `auditPlayabilityTemporal` 只能由 `ops.ts` 调用 | 原样保持 |
| T-58 生产 `analyze:` 只能是 stub | U4 按明确新语义改写：允许 stub 与指定适配器，禁止其他 analyzer；保留负向覆盖 |
| T-60 同步约束 | 保持 `runTemporalAudit` / `assertPublishableQa` 同步 |
| mechanic 旧 gap 断言 | 只在 U3 改写，并保留负向覆盖 |

### 9. 边界

- **全部进入 I-03 授权包**：I03-09 必须把 §1–§8 转录进 `docs/v7.8/移动-I03.md` 的实施单元、白名单、复核门、台账与关闭章节。
- **不授权任何单元开工**：U1–U5 需要分别取得增量授权；本轮 Q6–Q10 的通过不是批量开工许可。
- **不修改生产代码**：本票未改任何 `src` / 测试 / fixture。
- **不开放 `PUBLIC_NB` / `PUBLIC_PU`**；不改变发布拒稿行为；I-02 的 `publicCapability="BLOCKED"` / `publicResult=null` 保持原样。

### 10. 下游

- **I03-08**：把 §3–§6 转成验收矩阵与回滚证据要求；覆盖 T-58 正 / 负路径、U3 无诊断空窗、U4 双档确定性、U5 的 G1–G11 + 变异测试、修改前后基线快照。
- **I03-09**：组装授权包；不得把规划写成已实施，不得预填 Ledger。
- **I03-10 / I03-11**：独立审查与用户签署整包；单签不构成单元授权。
- **I03-PU-Air-Control-Closure**：独立，不受本票影响。
