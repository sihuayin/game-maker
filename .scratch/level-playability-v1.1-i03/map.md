# I-03：实施授权包（规划型 effort）

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-i03
Authority: [`docs/v7.8/移动-I02.md`](../../docs/v7.8/移动-I02.md) @ `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（已签署）+ U5 完成报告 / 最终审计 PASS / U5-SIGN（2026-11-13，i02 @ `2b57f2a`）+ [I-03 前沿裁定](reports/00-frontier-ruling.md)
Incremental authorization: 用户 `amber` · 2026-11-13 · 指令「开 I-03 新地图」· 范围**仅授权包规划与签署准备**；不实施生产修改；实施另开 effort
Baseline: `wayfinder/level-playability-v1.1-i02` @ `2b57f2a`（U5 已合并）
Branch: `wayfinder/level-playability-v1.1-i03`
PR target: `wayfinder/level-playability-v1.1-i02`（仅授权包 / 文档）
Status: open · 2026-11-13 · I03-02 完成；frontier：I03-03 / I03-06

> **规划型 effort。** Destination 是**可签署的 I-03 实施授权包**，不是生产代码修改。
> 本图不执行 `ops.ts` / `publish-gate` / `mechanic.ts` / `api.ts` / `contracts` 的实施改动；
> 实施必须另开 effort，并取得授权包规定的单元授权。
>
> **六条冻结边界**：
> 1. `PUBLIC_NB` 接线完成 ≠ `PUBLIC_NB` 开放。
> 2. `PUBLIC_PU` 不属于第一阶段实施目标，持续 `BLOCKED`。
> 3. I-02 的 `publicCapability=BLOCKED` / `publicResult=null` 保持原样；适配层只消费，不回写 / 篡改。
> 4. `INSUFFICIENT_EVIDENCE` 必须保留为独立状态，不能映射为 `NO_PROVEN_BLOCKER`。
> 5. 时序结果第一阶段不改变 `publish-gate` 的拒稿行为。
> 6. 授权包签署只建立后续实施依据，不自动授权所有实施单元。

## Destination

**I-03 实施授权包完成、独立审查、用户签署，形成可单独启动实施 effort 的正式依据。**

授权包覆盖：

- I-02 内部结果 → 公共证据映射；
- 公共 Verdict 与 `coverage.temporal` 语义；
- `PlayabilityEvidence.model / lag / degradation / limits` 字段与来源；
- 发布门消费规则与 release gate；
- `PUBLIC_NB` / `PUBLIC_PU` 独立准入链；
- 验收矩阵、负向测试、回归；
- 实施单元、依赖、复核点；
- Authorization Ledger、白名单、停止与回滚。

**本图不执行生产修改；不开放 `PUBLIC_NB` / `PUBLIC_PU`；不启动 I-03 实施。**

## Notes

### 前沿裁定（2026-11-13）

- **Q1 = A**：产出一份可签署的 I-03 实施授权包；实施另开 effort。
- **Q2 = 分阶段**：第一阶段围绕 `PUBLIC_NB` 的接线与证据门槛；`PUBLIC_PU` 持续 `BLOCKED`。
- **Q3 = 最小面**：`contracts` + `assets/ops.ts` + `pipeline/publish-gate`；`mechanic.ts` / `api.ts` 仅必要时逐文件授权；CLI / MCP / Runtime / 持久化 DEFERRED。
- **Q4 = A**：第一阶段只增加 `coverage.temporal` 与 evidence，不改变拒稿行为；未来 gate 变更需另开审查。
- 完整裁定见 [`reports/00-frontier-ruling.md`](reports/00-frontier-ruling.md)。

### NB 三状态（不得混用）

1. **接线完成**：生产链路能消费内部 NB 候选 + Witness。
2. **证据准入通过**：几何可信度、时序覆盖、lag 语义、Witness 完整性等全部通过。
3. **`PUBLIC_NB` 开放**：只有第 2 项通过 + 独立审查 + 授权，才允许发布公共 `NO_PROVEN_BLOCKER`。

**接线完成 ≠ 证据准入 ≠ 公共开放。** 当前 `coverage.geometry = partial`，Runtime hitbox 未闭合；I-03 授权包必须把几何证据补齐列为独立 gate。

### PU 独立链

`PUBLIC_PU` 至少需要：`coverage.geometry = checked`、空中控制 / 模型外规避闭合、hop 图割与加倍采样完整、I-00 六项条件全部满足、独立审查与增量授权。**不得因 NB 通过而推导 PU 可用。**

### 第一阶段发布行为

- 模型内 `PROVEN_UNPLAYABLE` 不直接触发生产拒稿；
- `NO_PROVEN_BLOCKER` 不直接改变放行条件；
- `INSUFFICIENT_EVIDENCE` 如实暴露，不能转成安全结论；
- 现有 `auditPlayability` 拒稿规则保持不变。

### 执行形态

- 一票一 commit；每张决策票一个独立会话；未阻塞的票可由不同会话并行（同一依赖层若产生冲突，以先签署的裁定为准）。
- 本图只产授权包与审查记录；**不写生产代码**。
- 授权包完成后：独立审查 → 用户签署 → 地图收口；**不自动启动实施**。
- 证据格式沿用 E1 / E2 / E3；逐项 `PASS` / `FAIL` / `NOT_RUN`。

## Decisions so far

- [I03-02 公共 Verdict 与 coverage 语义](issues/03-i03-02-verdict-coverage.md): Q1=A / Q2=A / Q3=A / Q4=A / Q5=A；内部 nb/pu-candidate 在 `PUBLIC_*` BLOCKED 时一律映射 IE；替换 `moving-hazard-phase` gap 为能力门控 temporal 层；`coverage.temporal` 适用即约束；现有三层 PU/IE 优先；temporal 非阻断。未改产品代码。
- [I03-01 I-02 内部结果 → 公共证据映射](issues/02-i03-01-evidence-mapping.md): Q1=A / Q2=A / Q3=B / Q4=A / Q5=A；公共 evidence 用 model/lag/degradation/limits 摘要 + `kind:"temporal"` witness；`coverage.temporal` 用 `checked|partial|unknown`；D9 20 码 many-to-one 到 13 个公共 degradation 值；`lag.perLag` 两档结论；judgmentId `PLAYABILITY_TEMPORAL_EVIDENCE` 非阻断。未改产品代码。
- [I03-00 初始化、范围冻结、授权台账与包骨架](issues/01-i03-00-init.md): 分支 / base / 授权包 SHA / 输入基线 / 台账 / DRAFT 包骨架就绪；产品目录零 diff；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 实施未授权。I03-01 为下一 frontier。
- [I-03 地图前沿裁定](reports/00-frontier-ruling.md): Q1=A / Q2=分阶段 / Q3=最小面 / Q4=A；Destination 是可签署的 I-03 实施授权包；`PUBLIC_NB` 接线 / 证据准入 ≠ 开放；`PUBLIC_PU` 持续 `BLOCKED`；第一阶段非阻断；实施另开 effort。

## Not yet specified

无已知雾区。所有可陈述的授权包决策已拆票（见下）。实施期的执行顺序、PR 拆分、feature flag 形态、Runtime 证据工具属于后续实施 effort，不在本图。

## Out of scope

- **生产代码修改**：`ops.ts`、`publish-gate`、`mechanic.ts`、`api.ts`、`contracts` 实施改动。
- **`PUBLIC_NB` / `PUBLIC_PU` 实际开放**：本图只定义准入链；开放需未来实施 + 独立审查 + 授权。
- **`PUBLIC_PU` 第一阶段实施**：持续 `BLOCKED`。
- **CLI / MCP / Runtime / 持久化证据链 / 额外公共导出 / 历史产物迁移**。
- **I-04 / 后续 effort / 实施 PR / 推送 / 合并**。
- **修改已签署的 I-02 授权包或 U5 结果**。
- **把 I-02 的内部 `nb-candidate` / `pu-candidate` 直接写成公共 Verdict**。

## 依赖图

```text
I03-00 初始化 / 范围冻结 / 台账 / 包骨架
  ├─ I03-01 内部结果 → 公共证据映射
  │    └─ I03-02 公共 Verdict 与 coverage 语义
  │         ├─ I03-04 PUBLIC_NB 三阶段准入链
  │         ├─ I03-05 PUBLIC_PU 独立准入链
  │         └─ I03-06 publish-gate 消费规则
  ├─ I03-03 几何 / Runtime hitbox 证据 gate
  │    ├─ I03-04
  │    └─ I03-05
  ├─ I03-07 实施单元 / 复核点 / 白名单 / 回滚（需 I03-04 / I03-05 / I03-06）
  └─ I03-08 验收矩阵 / 负向测试 / 回归（需 I03-01 ～ I03-06）
       └─ I03-09 授权包组装与一致性审计（需 I03-07 / I03-08）
            └─ I03-10 授权包独立审查
                 └─ I03-11 用户签署授权包（地图收口）
```

## 证据落点

- 前沿裁定：`reports/00-frontier-ruling.md`
- 授权包草案：`docs/v7.8/移动-I03.md`（I03-09 创建；本图不预先填写结论）
- 审查报告：`reports/I03-review.md`（I03-10）
- 本图证据：`.scratch/level-playability-v1.1-i03/`
