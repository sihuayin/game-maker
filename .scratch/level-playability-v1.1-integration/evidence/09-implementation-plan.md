# I00-09 I-01～I-05 实施计划骨架

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I00-09](../issues/12-i00-09-implementation-plan.md) |
| 依据 | [`r1-contract.md`](r1-contract.md)、[`07-gate-matrix.md`](07-gate-matrix.md)、[`08-file-impact.md`](08-file-impact.md) |
| 状态 | **全部 `PLANNED`**；本文件不构成任何执行授权 |

## 0. 阶段总览

| 阶段 | 承担门槛 | 依赖 | 估算（会话数，仅估算） |
| --- | --- | --- | --- |
| I-01 可信输入与几何来源 | G-01 / G-02 / G-03（输入侧） | R2 授权 | 3–4 |
| I-02 时序判定核心 | G-03 / G-04 / G-05 | I-01 | 5–7 |
| I-03 现有判定体系集成 | G-01 传递 / G-06 | I-02 | 2–3 |
| I-04 负向与回归验收 | 全部七项负例 + V1 回归 | I-03 | 3–4 |
| I-05 Pipeline 验收与收口 | G-07 | I-04 | 2–3 |

## I-01 可信输入与几何来源

**交付物**

- `temporal-input.ts`：atlas 字节读取 → SHA-256 校验 → 逐帧 `sourceSize` / `anchor` 提取；TOCTOU 关闭（同一份字节）。
- `lagMs` 入参与编排层两档调用。
- 输入校验与降级测试。

**前置**：I00-R2 白名单授权。

**测试落点**：`packages/contracts/tests/playability-temporal-input.test.ts`（新）；G-01/G-02 负例在 I-04 汇总。

**验收**：无法通过调用方伪造声明（hitbox / body / 尺寸 / `verticalEvasionImpossible`）取得确定性结论；所有几何与 lag 负例落 IE。

**退出条件**：若 atlas 字节无法与 manifest 稳定绑定（例如 pack 被就地改写且无法检测）⇒ 停止，回 R2 缩小范围。

## I-02 时序判定核心

**交付物**

- 连续求交（折返点切段、`overlapsStrict` 语义、单一 `ε`）。
- witness 构造与逐段验证。
- 永久封锁门（交集、不带 pad、`R−L > ε`）。
- 垂直规避图割（`graph.ts` + `forbiddenBoxes` + hop 加倍不变性）。
- 网格规则（`N ≥ 2`、`N ≤ floor(maxSpeed·periodMs/xStep)`、预算）。

**前置**：I-01。

**测试落点**：`packages/contracts/tests/playability-temporal.test.ts`（新）。

**验收**

- A / B / C 三类基线符合预期。
- 稳定性：(d) 确定性为硬门槛；(a) PU 分辨率不变、(b) NB 不被更细分辨率推翻为 PU、(c) IE 单调收窄——用对抗夹具，不要求全输入证明。
- 模型外输入全部 IE。

**退出条件**：hop 加倍不变性系统性失败 ⇒ 缩小范围（可能放弃 PU 能力），回 R2 修订契约。

## I-03 现有判定体系集成

**交付物**

- `mechanic.ts` 消解 `moving-hazard-phase` gap（仅在时序给出确定性结果时）。
- `coverage.temporal` 与证据可选字段。
- 顶层优先级：时序 IE 不得被聚合成 NB。

**前置**：I-02。

**测试落点**：`playability-mechanic.test.ts` / `playability-api.test.ts` 只增不改；新增顶层聚合测试。

**验收**：不建立平行审计入口；既有调用方无需修改；静态关卡行为不变。

**退出条件**：任何既有测试必须改动才能通过 ⇒ 停止，回 R1/R2。

## I-04 负向与回归验收

**交付物**

- G-01～G-07 的全部负例（含 B2 的 N1–N10）。
- V1 回归报告。
- 确定性与重复执行验证。

**前置**：I-03。

**测试落点**：contracts 单测 + pipeline 集成 + LP-06/07 语料复跑。

**验收**：每项已知风险都有对应用例；无既有行为回退；**19 个既有移动 hazard 关卡无一被误判为 PU**。

**退出条件**：任何回归或假阳 ⇒ 阻断，不进入 I-05。

## I-05 Pipeline 验收与收口

**交付物**：Pipeline 集成证据、真实关卡案例、最终测试与构建报告、支持范围与限制、最终结论。

**前置**：I-04。

**验收**：新能力在正式创作与审计流程中有效，且不扩大模型承诺。

**退出条件**：真实关卡案例无法覆盖 NB / PU / IE 三态 ⇒ 记录为已知限制，不得用构造案例替代。

## 两个必答问题

### Q1：「V1 完整回归」到底覆盖什么

| 层 | 内容 | 强度 |
| --- | --- | --- |
| 既有 vitest | `playability-{spatial,mechanic,completion,api}`、`config-audit`、`publish-gate` | 强（自动化） |
| LP-06 语料 96 对 + 矩阵 39 例 | 复跑 scratch 脚本，与基线 JSON 对比 | 中（脚本，非 CI） |
| LP-06 / LP-07 | **无 vitest** | 弱 |

**结论**：I-04 的「完整回归」= 既有 vitest 全绿 + LP-06/07 复跑一致。**不**包含把 LP-06/07 转成 vitest（那会扩大 effort）。此缺口必须写进冻结文档的已知限制。

### Q2：真实关卡案例从哪来

- 现有语料有 19 个移动 hazard config，但多数可能根本不触发时序路径（距离远、通路宽）。
- I-05 至少需要：1 个真实 `NO_PROVEN_BLOCKER`、1 个真实 `PROVEN_UNPLAYABLE`、1 个真实 `INSUFFICIENT_EVIDENCE`。
- 若现有语料不足，可在授权范围内新建 fixture；`fixtures/packs/**` 属产品目录，**需 R2 单独批准**。

## 偏离与限制（必须写进冻结文档）

1. **无 CLI / MCP 新参数**：`lagMs` 由 pipeline 层单一具名常量提供，非用户可配。
2. **LP-06 / LP-07 不转 vitest**：回归强度低于名义。
3. **结果不落盘**：可审计性由测试、契约、scratch 证据承担。
4. **发布行为变化**：含移动 hazard 的关卡可能从「放行」变为「拒绝」，属功能目的，需 R2 显式批准。
5. **Runtime 只读**：不修改游戏运行时语义。
