# 移动-I03 Phase-2 授权 annex（UNSIGNED 草案）

> **状态：UNSIGNED DRAFT。** 本文件由 Phase-2 charting 会话产出；**未签署前不构成任何实施授权**。
> 用户签署后，本文件完整 SHA-256 成为 Phase-2 授权基线；P1–P6 仍需各自独立增量授权，P7 仍需独立验收授权。
> 本文件不修改 `docs/v7.8/移动-I03.md` 正文或其 §12.2，不修改 I-02 / U5 冻结结果。

| 项 | 值 |
| --- | --- |
| 上游授权包 | `docs/v7.8/移动-I03.md` @ `sha256:2bbe7c5534ecb2e28db28657d58de9be54007963c1d4f69f8883568fdc0478f8`（SIGNED） |
| Phase-1 关闭 | `main` @ `dd10dff`；验收 `INCOMPLETE`（required PASS 16 / FAIL 0 / NOT_RUN 3） |
| 执行协议 | `.scratch/level-playability-v1.1-i03-phase2/reports/00-execution-protocol.md` |
| 地图 | `.scratch/level-playability-v1.1-i03-phase2/map.md` |

## §0 目的与状态

Phase-2 只收口 Phase-1 遗留的 required `NOT_RUN`：AC-10（NB admission machinery）、AC-12（global gate close）、AC-14（只认 I03-03C probe 的分项 PASS）。AC-15 保持非 required，但作为 AC-14 的证据依赖实施。AC-11 保持非 required `NOT_RUN`。

Phase-2 的目标是 **19 条 required AC 全 PASS**；完成与全 PASS 都不自动开放 `PUBLIC_NB` / `PUBLIC_PU`。

## §1 范围边界

**范围内**：

- P1：probe 契约冻结 + 夹具物化。
- P2：probe 实施；P3：I03-03C 独立复核与用户签署（P2 内部门）。
- P4：NB admission machinery。
- P5：global gate close。
- P6：AC-14 几何证据消费。
- P7：全量 AC-01–AC-21 验收（用户另行授权）。

**范围外**：

- PU 六条件、条件 2（几何）、条件 5（空中控制）、`I03-PU-Air-Control-Closure`。
- `PUBLIC_NB` gate `OPEN` / `ADMITTED`；`PUBLIC_PU` admission / gate 开放。
- 修改 I-03 正文 / §12.2、I-02、phase-1 报告。
- 把 probe 脚本 / 夹具副本放进产品 package。
- 修改发布拒稿行为、CLI / MCP 输出、公共 `PlayabilityVerdict` 顶层形状。

## §2 单元与依赖

| 单元 | 内容 | 启动条件 | Ledger |
| --- | --- | --- | --- |
| P1 | probe 契约冻结 + 夹具物化 | annex 签署 + P1 授权 | 是 |
| P2 | probe 实施 | P1 合并 / 签署 / Ledger | 是 |
| P3 | I03-03C 独立复核 + 用户签署 | P2 实施完成 | P2 行内 |
| P4 | NB admission machinery | P1 合并 / 签署 / Ledger | 是 |
| P5 | global gate close | P4 合并 / 签署 / Ledger | 是 |
| P6 | AC-14 几何证据消费 | P3 PASS + 用户签署 | 是 |
| P7 | 全量验收 | P2–P6 全部合并 / 签署 / Ledger + 用户 P7 授权 | 否 |

P2 与 P4 可在 P1 后并行；P5 与 P6 可在各自前置满足后并行。并行不共享授权 / 分支 / 复核 / Ledger。

## §3 授权模型

1. 本 annex 由用户签署后生效；签署只建立后续逐单元申请依据。
2. 每个单元写独立增量授权记录（范围、白名单、STOP、证据要求），用户签署后 docs-only PR 合入 `main`。
3. 从更新后的 `main` 切实施分支（P1/P2 用 audit 分支）。
4. 实施 / 测试 / 证据 → fresh 独立复核 → 用户签署 → 合并 → 独立 Ledger 行。
5. Phase-1 授权记录已耗尽，不得引用。
6. P7 由用户另行授权 fresh 验收会话。

## §4 P1 · probe 契约冻结 + 夹具物化

**落点**：`.scratch/level-playability-v1.1-i03-phase2/geometry-probe/{contract,fixtures,scripts,evidence/p1}`。

**输入（已冻结）**：

- I03-03A Geometry Probe Evidence Contract。
- I03-03B 夹具设计；I03-03B2 逐行 manifest；I03-03B2a 玩家坐标约定。
- 源 pack `fixtures/packs/last-train/v2`（只读）；v4 归一化副本。
- F2 修正后的负例矩阵。

**F2 修正后的冻结计数**：

| 项 | 值 |
| --- | --- |
| 正例行 | **14**：hazard 2 / player 8 帧 + player body 1 / graph 3 |
| 负例 | **11**：10 `geometry-mismatch`（含 `body-bounds-mismatch`）+ 1 `missing-evidence`（`atlas-missing`） |
| manifest SHA-256 | `dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b` |
| build script SHA-256 | `4253bbbb4c849d94654239f90c074e7d3161d07c97a8ed7beb3ba5a4c7a3ea66` |
| 源 manifest | `145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |
| 归一化 manifest | `19f4da6fb9bf25b96b48b96e2e44bb1773ad0c1222dc865f72e77a56fc85cb98` |
| 源 pack tree | `570535deff5c2f4e1626b2680a4b555f631e51d6d87721507a0a1f6e2feb7383` |

**P1 白名单**：仅 `.scratch/.../geometry-probe/**` 与 `reports/P1-*`；产品文件零改动。

**P1 必须记录**：原始输入 hash、归一化变换、每个夹具副本 hash、manifest hash、命令与退出码。P1 不得修改原始产品 fixture。

**STOP**：任何 hash 不一致、负例回退到旧 10 个口径、或需要改产品文件 ⇒ STOP。

## §5 P2 · probe 实施与 P3 独立复核门

**P2 落点**：`.scratch/.../geometry-probe/{scripts,evidence/p2}`；只消费 P1 冻结输入，不得修改契约 / 夹具语义 / hash。

**运行**：真实浏览器 / 现有 demo；不新增 npm 依赖；逐帧 / 逐 body 记录 `expected / actual / delta / pass`；`all-checked` 不是 `coverage.geometry=checked`。

**P3**：

- fresh reviewer，未参与 P1/P2。
- 输入：契约 hash、manifest hash、probe 输出 hash、命令、冻结基底。
- 逐项检查 14 正例行 + 11 负例；每项 `PASS / FAIL / NOT_RUN`。
- 报告固定路径：`.scratch/level-playability-v1.1-i03-phase2/reports/P3-probe-review.md`。
- 报告含 reviewer 独立性、日期 / 环境、输入 hash、独立重跑记录、限制、用户签署行。
- P3 PASS + 用户签署后才允许 P6 消费；P3 不自动设置 `coverage.geometry=checked`。

**STOP**：P1/P2 hash 不一致、证据不完整、P3 未签署而 P6 读取 probe ⇒ STOP。

## §6 P4 · NB admission machinery

**白名单**：

- 新 `packages/contracts/src/playability/admission.ts`
- 新 `packages/contracts/tests/playability-admission.test.ts`
- 新 `packages/contracts/tests/fixtures/playability-admission-matrix.json`
- `packages/contracts/src/playability/api.ts`（仅导出）

**不许修改**：`public-verdict.ts`、`verdict.ts`、`capability-gate.ts`、公共 Verdict 类型 / 映射。

**准入规则**（§8.2 十项，全部同时满足）：几何（hazard + player checked；必要时 graph checked）；I03-03A/B/C 三层复核；`coverage.temporal="checked"`；双档完整一致；`certificate.kind="witness"` + `status="COMPLETE"`；无预算耗尽 / wall-clock abort；跨进程确定性；witness 体积未越界；公共映射正确；固定 admission fixtures 全过。

**夹具**：Synthetic NB 正例、False-NB 负例、真实 IE 负例；运行前冻结并记录 hash。

**关键负向证明**：gate `BLOCKED` 时，即使 synthetic 输入满足准入规则，也不得 `ADMITTED`。AC-10 的 checked 几何正例必须等 P3 签署；P3 前不得把 AC-10 标 PASS。

## §7 P5 · Global gate close

**白名单**：

- 新 `packages/contracts/src/playability/capability-gate.ts`
- 新 `packages/contracts/tests/playability-capability-gate.test.ts`
- 新 `packages/contracts/tests/fixtures/playability-capability-gate-matrix.json`
- `packages/contracts/src/playability/public-verdict.ts`（仅最小 gate 状态接线）
- `packages/contracts/src/playability/api.ts`（仅导出）

**必须覆盖**：gate `BLOCKED` 时 admission 成功不得放行；假 NB / 假 PU 不得 `ADMITTED`；证据基线失效时关闭优先；关闭状态不能被后续 admission 覆盖；NB / PU 两 gate 独立负路径。

**不变量**：`PublicVerdictResult` 形状不变；U2 mapper 优先级不变；需要改形状 ⇒ STOP。P5 不依赖 P3 / P6，不得读取未复核 probe 结果。

## §8 P6 · AC-14 几何证据消费

**白名单**：

- 新 `packages/contracts/src/playability/geometry-evidence.ts`
- 改 `packages/contracts/src/playability/temporal-evidence.ts`
- 改 `packages/contracts/src/playability/verdict.ts`（仅 geometry 类型加法式放宽）
- 改 `packages/contracts/src/playability/api.ts`（仅导出）
- 改 `packages/contracts/tests/playability-temporal-evidence.test.ts`
- 新 `packages/contracts/tests/playability-geometry-evidence.test.ts`
- 改 `packages/assets/src/ops.ts`（显式可选参数接线）
- 改 `packages/assets/tests/ops.test.ts`

**不许修改**：`publish-gate.ts`、CLI、MCP、`public-verdict.ts`、`PublicVerdictResult` 顶层形状。

**类型加法式放宽（显式例外）**：

- `PublicGeometryCoverage.runtimeBody: "unverified" | "verified"`。
- `PublicGeometryCoverage.coverage: "checked" | "partial" | "unknown"`。
- `TemporalLimitsEvidence.geometryCoverage` 同步放宽。

**输入契约**：

```ts
type GeometryEvidenceInput = {
  readonly state: "checked" | "partial" | "unknown";
  readonly review: {
    readonly reportHash: string;
    readonly signedBy: string;
    readonly signedAt: string;
    readonly probeVersion: string;
    readonly fixtureManifestHash: string;
  } | null;
};
```

- `checked` 必须带完整非空 `review`；缺失 / 不完整 ⇒ 不得输出 checked。
- adapter 是纯函数：不读文件、不运行 probe、不查询 audit 分支。
- `ops.ts` 只传递显式证据；`runTemporalAudit` 新增可选参数，发布闸暂不自动接线。
- `review` 字段是数据，不是签署真实性证明；真实性建立在 P3 复核 + 用户签署链上。

**合并语义**：

1. 三维 `hazard / player / graph` 各自 `checked / partial / unknown`。
2. `model.geometryCoverage` 使用三维输入；无输入时保留现有 `partial / unverified` 常量。
3. `coverage.geometry`：任一维 `unknown` ⇒ `unknown`；否则任一维 `partial` ⇒ `partial`；全部 `checked` ⇒ `checked`。
4. 与 `existingCoverage` 合并：`partial / unknown` 只能降低，绝不提升；只有 `checked + review` 才能提升 existing 的 `partial`；无输入时保持既有行为。
5. `applicable:false` 不生成 temporal evidence，不设置 geometry。

**测试**：全部 synthetic、符合真实类型、无文件 I/O、无 `as any`；真实 P3 证据的端到端验证留给 P7。

## §9 P7 · 全量验收

- 前置：P2–P6 全部独立复核 PASS、用户签署、合并、Ledger 完成；用户另行签署 P7 验收授权。
- fresh 独立验收会话重跑 AC-01–AC-21；映射：AC-10→P4、AC-12→P5、AC-14→P6、AC-15→P2+P3；AC-11 非 required `NOT_RUN`。
- AC-15：P2/P3 证据完整且签署 ⇒ PASS；否则 `NOT_RUN`；始终非 required；有实际失败证据可判 FAIL。
- 报告：`.scratch/level-playability-v1.1-i03-phase2/reports/phase2-acceptance.md`；phase-1 报告不可变。
- 整体状态与退出码按 I-03 §10.5；禁止通过率 / 加权 / 分组替代逐项判定。
- `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；关闭 ≠ 开放。

## §10 STOP

Phase-1 §11.3 的 12 条 STOP 全部继承。Phase-2 追加：

1. P1 → P2：契约或夹具 hash 不一致 ⇒ 停止 P2。
2. P2 → P3：probe 实现 / 结果 / 证据不完整 ⇒ P3 不得 PASS。
3. P3 → P6：无独立复核 PASS + 用户签署 ⇒ P6 不得读取 probe 输出。
4. P2–P6 → P7：任一单元未签署 / 未合并 / Ledger 未完成 ⇒ P7 不得启动。

## §11 AC 映射

| AC | required | Phase-2 证据 |
| --- | --- | --- |
| AC-01–AC-09 | 是 | Phase-1 回归；P7 重跑 |
| AC-10 | 是 | P4；checked 几何正例依赖 P3 |
| AC-11 | 否 | 不纳入；保持 `NOT_RUN` |
| AC-12 | 是 | P5 |
| AC-13 | 是 | Phase-1 回归；P7 重跑 |
| AC-14 | 是 | P6（只消费 P3 签署证据） |
| AC-15 | 否 | P2 + P3；完整签署时 PASS，否则 `NOT_RUN` |
| AC-16–AC-19 | 是 | Phase-1 回归；P7 重跑 |
| AC-20 | 是 | Phase-1 + Phase-2 各单元五道门 / Ledger / 回滚 |
| AC-21 | 是 | P7 全量回归 + LP-06/07 + 跨进程确定性 |

## §12 Ledger（空白，5 行）

Phase-2 只维护本表；不修改 I-03 §12.2。空白字段 = 尚未授权或尚未完成，不得预填。

| 单元 | 文件（操作 / 目的） | 增量授权状态 | 实施 SHA | 复核证据路径 + hash | 批准人 | 日期 | 回滚目标 SHA | 回滚演练证据 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 |  | 未授权 |  |  |  |  |  |  |  |
| P2 |  | 未授权 |  |  |  |  |  |  |  |
| P4 |  | 未授权 |  |  |  |  |  |  |  |
| P5 |  | 未授权 |  |  |  |  |  |  |  |
| P6 |  | 未授权 |  |  |  |  |  |  |  |

## §13 能力与关闭边界

- `PUBLIC_NB` / `PUBLIC_PU` 恒 `BLOCKED`；`publicCapability="BLOCKED"` / `publicResult=null`。
- Phase-2 完成、required 全 PASS、P7 PASS 均不自动开放任何能力。
- `PUBLIC_NB` / `PUBLIC_PU` 开放需独立 effort、独立审查与用户显式授权。
- 中止关闭：按逆序回滚 P6 → P5 → P4 → P2 → P1，回到各单元前基线，重跑全量测试，Ledger 记录原因与回滚 SHA。

## §14 用户签署

| 项 | 值 |
| --- | --- |
| 签署人 | ____________________ |
| 日期 | ____________________ |
| 签署对象 SHA-256 | ____________________（签署时由用户复算并填入） |
| 结论 | ____________________ |

> 签署前本 annex 不构成实施授权；签署后仅建立逐单元申请依据。各单元与 P7 仍需独立授权。
