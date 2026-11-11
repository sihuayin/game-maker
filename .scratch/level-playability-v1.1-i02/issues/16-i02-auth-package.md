# I02-AUTH 授权包编写

Type: task
Status: open
Owner: —
Blocked by: 07, 08, 09, 10, 11, 12, 13, 14, 15, 21
Map: ../map.md
Class: I-02 / DELIVERABLE

## Question

编写 `docs/v7.8/移动-I02.md`：一份可签署、可审计、分阶段放行的 I-02 实施授权包。**不写实现，不接生产。**

### 必须包含

1. **能力声明与边界**：沿用 I-00 §1 的承诺边界，不扩大。
2. **七项 §12 内容**：
   - 文件白名单与允许修改的模块；
   - I02-01～I02-05 提交拆分；
   - AABB、epsilon、三角波、图割的正式数学语义；
   - 默认预算与硬上限终值；
   - 测试命令、性能基准、停止条件；
   - 公共接口 / 依赖 / Runtime 审批边界；
   - R1 / R2 通过条件。
3. **I-00 / I-02 冲突登记表**（独立章节）：五组已知冲突 + 登记过程中新增的冲突；每条给出裁定票与状态，不得静默择一。
4. **五个单元的完整定义与授权状态**：I02-01 `AUTHORIZED`，I02-02～05 `PLANNED`；PLANNED 不等于隐含授权。
5. **单元依赖与先后**：I02-03 / I02-04 的依赖、顺序、各自授权条件（D8 的裁定）。
6. **复核门槛**：R1（I02-01 后）与 R2（I02-02 后、I02-04 前）的检查清单。
7. **执行边界**：本包只授权实施，不授权改 I-00 冻结语义、不授权 I-03 接入、不授权新增依赖。
8. **风险与未确认项**：U1/U2/U3/U8/U9、hop 取整、LP-06/07 无 vitest、发布行为变化等。
9. **证据索引**：所有证据指向 `.scratch/level-playability-v1.1-i02/`，SHA 与命令可复核。
10. **签署表**：首次签署只放行 I02-01。

### 硬约束

- 授权包不构成对 I02-01～05 的自动授权。
- 任何「必须证明」不得降级为「尽量证明」。
- 与 I-00 已冻结语义冲突的内容必须显式标注并链接裁定票。
- 不得把 scratch 实验表述为生产验收通过。

### 输出

`docs/v7.8/移动-I02.md`（草稿；签署前不生效）。

### 下游

I02-AUDIT。

## 上游裁定（D8，2026-11-11）

原样引用 [I02-D8](14-i02-d8-review-gates.md)：

- §10 总授权文本；
- §6 Authorization Ledger 与能力状态（`PUBLIC_NB` / `PUBLIC_PU` 在 I-03 前均为 `BLOCKED`）；
- §9 停止 / 缩范围 / 回滚矩阵；
- 首次签署只授权 U1；U2–U5 分别为 `PLANNED` / `PLANNED` / `BLOCKED` / `PLANNED`。


## 上游裁定（D5，2026-11-11）

原样引用 [I02-D5](11-i02-d5-budget-determinism.md)：确定性承诺措辞、预算表、降级顺序、双档「不完整 vs 不一致」、发布门分层。`maxCutsPerBranch` 标 `DEFERRED`，以 [I02-D5B](21-i02-d5b-cut-budget-benchmark.md) 为前置；不得签署 U1–U2 的完整预算验收。

## 上游裁定（D6 / D7，2026-11-11）

授权包必须完成三项对齐：

1. **文件白名单**：D6 的 I-02 白名单 + D7 增补的 `packages/contracts/tests/playability-temporal-fixtures.ts`（`TEST_ONLY`，单独列出，不并入 `playability-temporal*.test.ts` 通配）。
2. **测试语义**：D7 的六文件布局、A–J 语义断言、双档 lag、预算 / 确定性、性能证据、LP-06/07 回归口径与 AC-01～AC-13 映射。
3. **内部字段**：D9 必须为 A–J 每条语义断言提供字段落点；AUTH 逐条核对，对不上就回 D9，不得弱化 D7。

另需在授权包中写明：

- `now` 注入是内部测试专用，只用于 wall-clock abort，不构成公共接口；
- `graph.ts` 仍受独立增量审批约束；
- `ops.ts` stub 与 T-57 / T-58 / T-61 保持不变；
- `PUBLIC_NB` / `PUBLIC_PU` 在 I-03 前均为 `BLOCKED`。

## 上游裁定（D5B，2026-11-11）

授权包必须记录 D5B 冻结的预算终值（证据：[`evidence/07-cut-budget.md`](../evidence/07-cut-budget.md)）：

- `maxCutsPerBranch` = **5,000,000** 默认 / **10,000,000** 硬，计量单位 **解析段数**（`cutPoints + 1`）；`maxCutsPerCheck` = 1,000,000（cutPoints）。
- 在预算章节明确 D5 §3.1 的 `cuts` = segments；若拒绝该澄清，记录 fallback `1,000,000` / `4,000,000` 并注明其不具约束力、真实工作由 `maxEdges` 约束。
- Witness 体积终值按 D9 冻结的记录形状记录：W1 `1,000,000 / 64 MiB`（推荐）、W2 `250,000 / 64 MiB`、W3 `1,000,000 / 256 MiB`（不推荐）。
- 累计 cut 预算不得先于状态 / edge 预算触发；U9 与 W 共用 NB 预算，不另设计数器。

## 上游裁定（D9，2026-11-11）

授权包必须写入 [I02-D9](15-i02-d9-internal-result-contract.md) 的内部结果契约，并完成对齐：

1. **A–J ↔ 字段**：逐条核对 D7 §2 的语义断言与 D9 §9 的字段落点；对不上回 D9，不得弱化 D7。
2. **候选语义**：`pu-candidate` 只表示模型内门区 + 图割 + hop 证明完整，**不是**公共 PU；`geometry-checked` 与 `model-out-excluded` 仍为 `BLOCKED`；`publicCapability` 恒为 `BLOCKED`，`publicResult` 恒为 `null`。
3. **Witness**：W1 紧凑记录；`1M / 64 MiB`；容量以实际确定性序列化字节数为准；不完整证明保留 `certificate.status = "INCOMPLETE"`。
4. **原因码**：D9 §5 的闭集；新增原因必须改 D9/AUTH。
5. **确定性**：FNV-1a 32-bit 只是指纹；测试与基准必须同时保留规范化完整序列化。
6. **测试钩子**：`testHooks`（`budget` / `now`）不进公共导出面；AUTH 必须要求公共导出扫描与白名单审计。
7. **I-03 边界**：I-03 负责 `coverage.temporal`、`PlayabilityEvidence` 的 `model/lag/degradation/limits` 与公共发布门禁；I-02 不接生产。
