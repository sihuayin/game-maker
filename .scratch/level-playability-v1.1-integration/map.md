# Level Playability V1.1 Integration：单移动 Hazard 正式集成（I-00 冻结）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-integration
Baseline: `docs/v7.8/移动.md` @ `sha256:3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9`；权威输入提交 `bd1389f`
Status: open · 2026-11-09 开图
Predecessor: [Level Playability V1.1 P0](../level-playability-v1.1-p0/map.md)（已收口；裁定 GO — 技术可行性）

> **2026-11-09 开图。** 授权来源：[`docs/v7.8/移动.md`](../../docs/v7.8/移动.md)（Level Playability V1.1 — 单移动 Hazard 正式集成需求文档）。
> PRD §9.1 把当前阶段限死在规划：需求分析、契约提案、架构与文件影响分析、测试矩阵设计、验收方案、独立实施计划编制。§9.2 规定 Runtime / Pipeline / contracts / CLI / MCP / 新依赖的任何改动都必须另提白名单并**重新授权**。
> 因此本图的终点是**可授权的 I-00 冻结包**，不是集成本身，也不是「已证明方案都能在现有代码结构下实现」。

## Destination

交付一份**可授权的 I-00 冻结包**，使正式集成能够被独立授权执行。本图不实施任何 I-0x。

冻结包必须包含：

1. 输入、输出契约及证据来源。
2. 单 X 轴 Hazard 运动模型与适用边界。
3. 时间相位、初始时间与 `lagMs` 假设（含两档敏感性）。
4. G-01～G-07 的逐项验证方案。
5. 生产文件与模块修改白名单。
6. 性能预算、超限策略与证据不足降级策略。
7. 非目标、停止条件与退出条件。
8. I-01～I-05 的实施顺序、依赖、测试矩阵与验收条件（**仅计划**，状态 `PLANNED`）。

最终冻结文档发布到 `docs/v7.8/移动-I00.md`；过程、脚本与证据留在本 effort 目录。

**终点不是**「已证明 I-00 的方案都能在现有代码结构下实现」。若某项硬门槛在现有架构下无法满足，I-00 允许以「阻塞 / 需修改 PRD / 需缩小范围 / 停止 effort」结束，不得为了交包而把「必须证明」降级为「尽量证明」。

## Notes

### 权威输入与冻结边界

- **PRD（只读冻结）**：[`docs/v7.8/移动.md`](../../docs/v7.8/移动.md)，`sha256:3598cc19…`，提交 `bd1389f`。地图内**不直接编辑**；若评审发现必须修改，先走 HITL 修改权威输入并重算哈希。
- **前序结论包（只读证据基线）**：[P0 结论包](../level-playability-v1.1-p0/evidence/04-final-report.md)、[P0 模型](../level-playability-v1.1-p0/prototype/MODEL.md)。P0 已裁定 GO（技术可行性口径），但**不构成集成就绪，也不构成任何实施授权**。本图可引用、可复核，不重开 P0 结论。
- **G-01～G-07 是硬约束，不是可协商的实现偏好。** 地图内不得放宽。
- **领域词汇**：`CONTEXT.md` 是唯一权威；本图不新增同义词。

### 已核实的架构事实（2026-11-09 只读调查）

这四条不是背景介绍，是 I-00 必须给出结论的强制裁定项：

1. **`coverage = "partial"` 与顶层聚合不一致。** `verdict.ts:18-19` 说 LP-05 应把 `partial` 拉向 `INSUFFICIENT_EVIDENCE`，但 `api.ts:87-92` 只看 layer verdict，`api.ts:14-18` 甚至明确允许 `NO_PROVEN_BLOCKER + coverage.spatial = partial`。而 `profile.ts:92-97` 把帧来源几何标 `partial` ⇒ **今天「帧几何部分可信」的关卡可以拿到 `NO_PROVEN_BLOCKER`**。
2. **Manifest 不含逐帧几何，审计路径看不到 acceptance 的比对结果。** 逐帧 `frame` / `sourceSize` / 帧级 `anchor` 只在 `atlas-json.ts:35-48`；`assets/src/acceptance.ts:296-358,604-690` 已做比对；但 `auditPlayability(config, ctx.manifest)`（`config-audit.ts:29,53`、`publish-gate.ts:140`）只吃 manifest，`profile.ts:18-25` 白纸黑字把这条等式标为 `partial`。**G-01 目前没有可信证据传递通道。**
3. **`Motion` 没有 phase 字段。** `game-config.ts:79-85` 只有 `kind/axis/distance/periodMs`；三角波从 `t=0` 起算（`packages/demo/src/hazard.ts:14-19`）。PRD 要求相位明确，但配置不直接表达相位；P0 的 U1 / U8 仍未确认。
4. **`lagMs` 没有入口。** P0 用 200ms 锚定 Phaser `delta ≤ 200ms` 的源码上界；现有 auditor 没有任何 lag 参数。G-02 的「显式、可审计」很可能触及公共输入契约。

另有两条 P1 事实：

- P0 的 `4096 visited / 12288 edges / 7–19ms` 是单次原型样本，**不能**当生产性能预算（P0 结论包已明说）。
- LP-06 / LP-07 只有 scratch 脚本，没有 vitest；「V1 完整回归」的实际覆盖面比名字窄，I-00 必须写实。

### 执行覆盖（有限只读）

Wayfinder 默认只做决策；本图按用户 2026-11-09 裁定**有限承载执行**：

**允许**

- 在 `.scratch/level-playability-v1.1-integration/{scripts,evidence}/` 写扫描 / 验证脚本与文档。
- 读取 `packages/**`、`docs/**`、现有测试与 fixtures。
- 运行不修改产品文件的测试或小型验证程序。
- 将日志、摘要、哈希与结论保存到本 effort 的 `evidence/`。

**禁止**

- 修改 `packages/**`、产品配置、公共契约、现有测试或 CI。
- 安装新依赖、调用付费模型或外部付费服务、生成付费站点。
- 生成会被生产流程读取的配置或代码。
- 将 scratch 脚本接入正式构建、CI 或产品包。

**停止线**：零付费、Runtime 只读、不接生产。

### 票分类与状态

| 前缀 | 含义 | 允许的产出 |
| --- | --- | --- |
| `I-00 / DECISION` | 需要裁定的设计决策 | 裁定记录 |
| `I-00 / EVIDENCE` | 只读取证任务 | `evidence/` 下的证据文件 |
| `I-00 / DELIVERABLE` | 冻结包文档 | 冻结文档草案 |
| `I-01～I-05 / PLAN` | 未来阶段的计划文本 | 仅计划；状态只能是 `PLANNED` |

- 票类型（`Type:`）：`research` / `prototype` / `grilling` / `task`。
- 状态（`Status:`）：`open` / `claimed` / `resolved`。I-01～I-05 的计划票只能是 `PLANNED`，不得标 `resolved` 后暗示已执行。
- 认领即改 `Status: claimed` 并保存，先于任何工作。
- 裁定票（grilling）只产出裁定记录，不产生产品代码 commit；未通过时后续票保持 blocked。

### 证据标准

- **E1**：源码 / 契约 `file:line`。
- **E2**：测试名 + 断言 + 退出码。
- **E3**：scratch 复跑（命令、路径、计数、原始输出摘要）。
- 每个取证任务必须记录：对应需求 / 硬门槛编号、输入文件与 SHA、命令与环境、原始结果、是否修改产品目录（必须为否）、结论与限制、复现方法。

### 依赖图

```
I00-00 Effort 初始化与权威输入冻结（task · AFK）
  ├─ I00-01 现有审计语义与 coverage 缺口        （research）
  ├─ I00-02 AssetPack 几何证据来源               （research）
  ├─ I00-03 Hazard 运动相位与时间起点            （research）
  ├─ I00-04 lagMs 来源与传递路径                 （research）
  ├─ I00-05 连续时间边界与数值容差               （grilling · HITL）
  ├─ I00-06 性能取证与预算                       （task · AFK）
  └─ I00-10 垂直规避证明（G-04）                 （grilling · HITL）
        ↓ 全部 resolved
I00-07 七项硬门槛验证矩阵（task · AFK）
        ↓
I00-R1 输入输出契约冻结（grilling · HITL）[HARD BLOCK]
        ├─ I00-08 文件影响分析与白名单提案（task · AFK）
        │       ↓
        │   I00-R2 文件白名单与授权边界（grilling · HITL）[HARD BLOCK]
        └─ I00-09 I-01～I-05 实施计划骨架（task · AFK）
                ↓
            I00-R3 I-00 最终收口（grilling · HITL）[HARD BLOCK]
```

- `I00-10` 是对用户 2026-11-09 骨架的补充：G-04（垂直规避必须由可信几何 + 受支持的玩家运动模型证明，不得采信调用方布尔标记）在骨架里没有独立落点，而它决定 `PROVEN_UNPLAYABLE` 能否落地。它不是门槛矩阵的一行，是一个必须先裁的范围问题。
- 其余问题用 grilling 票直接裁定；若 grilling 发现会改变三张 R 票的核心结论，回到对应 R 票，不绕过硬阻断。
- **R2 通过只表示白名单与边界已经清楚，不代表白名单内的生产修改自动获批。** 未来执行仍需独立实施授权。

### 分文分支与产物

- 图与票：`wayfinder/level-playability-v1.1-integration`（本分支）。
- 产物：`.scratch/level-playability-v1.1-integration/{map.md,issues/,evidence/,scripts/}`。
- 不复活 P0 的 `wayfinder/level-playability-v1.1` 与 `p1/level-playability-v1.1-p0`，也不把 P0 研究产物改造成本 effort 的执行目录。

## Decisions so far

<!-- 索引：每张已关闭票一行，够判断相关性即可；细节永远在票里。 -->

## Not yet specified

<!-- 以下雾区的形状取决于尚未裁定的票；前沿推进后再毕业为票。 -->

- **若 G-01 无法在不改公共契约的前提下满足，集成范围缩到哪**（是否限定单 pack / 单 fixture 来源、是否要求调用方提供已验收包清单）。取决于 [I00-02 AssetPack 几何证据来源](issues/03-i00-02-asset-geometry-provenance.md)。
- **若 `lagMs` 必须扩展公共 API，是否需要拆出一个独立的前置 effort**。取决于 [I00-04 lagMs 来源与传递路径](issues/05-i00-04-lagms-source.md)。
- **现有语料里实际含移动 hazard 的关卡有多少**，决定集成收益与回归面；可作为取证顺带产出，但可能反过来影响范围裁定。
- **`coverage` 契约是否需要顺带修正**：PRD 禁止回退既有语义，而当前 `partial` 不参与顶层聚合。修正可能同时影响 V1 既有行为。取决于 [I00-01 现有审计语义与 coverage 缺口](issues/02-i00-01-audit-semantics-coverage.md)。
- **G-04 若判定必须建模跳跃 / 下落，是否直接超出 PRD 非目标** ⇒ 那时只剩「缩范围」或「停」。取决于 [I00-10 垂直规避证明](issues/08-i00-10-vertical-evasion-proof.md)。

## Out of scope

- **I-01～I-05 的执行**：生产实现、生产测试、验收与 Pipeline 收口。本图只产出计划文本（状态 `PLANNED`）。
- **任何生产代码修改**：Runtime、Pipeline、`packages/contracts`、CLI、MCP、公共参数、持久化 schema、`ConfigIssue.code`、新依赖。PRD §9.2 要求独立授权。
- **扩大模型范围**：多移动 Hazard 联合、Moving Platform、多 Danger 联合、跳跃 / 下落 / 重力的精确时序、连续物理仿真。PRD §2.2 明确不做。
- **把 P0 原型直接搬进生产**：PRD G-07 明确禁止。
- **修改已冻结的 PRD、LP-02～LP-07 测试、历史 run / pack / site / fixtures 与既有验收证据。**
