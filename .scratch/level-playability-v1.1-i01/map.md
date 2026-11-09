# Level Playability V1.1 I-01：可信输入与延迟编排

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-i01
Baseline: `main` @ `29ea1d1`
Authority: [`docs/v7.8/移动-I01-需求.md`](../../docs/v7.8/移动-I01-需求.md) @ `sha256:05c6c72aaaa2201cb33c8de42eb38809251ab97a1cf06450daee7d9e7416a113`（2847 bytes，2026-11-09 冻结，只读）
Status: open · 2026-11-09 开图
Predecessor: [Level Playability V1.1 Integration](../level-playability-v1.1-integration/map.md)（已收口；I-00 冻结包已发布）

> **2026-11-09 开图。** 用户以 I-01 需求文档发起本图，并逐轮裁定终点、架构、入口、降级与判据。
> 按裁定，本图只产出**可独立签署的 I-01 执行包**；不实施生产代码，不进入独立 PR。
> I-00 冻结包（[`docs/v7.8/移动-I00.md`](../../docs/v7.8/移动-I00.md)）与 **R2 授权边界**仍是上位约束。
> **本图不构成 I-01 实施授权。**

## Destination

交付一份**可独立签署的 I-01 执行包**，使 I-01（可信 Atlas 输入 + `lagMs` 双档编排 + 降级测试）能够被单独授权、并以独立 PR 实施。

执行包必须包含：

1. **精确文件清单与依赖方向**：逐文件列出新增 / 修改、写出为什么必须在生产侧、并逐条对 I-00 §11 白名单与 R2 授权核对。
2. **可信输入契约**：唯一生产读取器、运行时 brand、digest 注入、纯验证函数的签名与数据形状。
3. **逐帧几何判据**：`sourceSize` / `anchor` / 缺帧 / checksum 绑定 / TOCTOU 的精确判据与负例。
4. **双档 `lagMs` 编排**：`16.67ms` / `200ms` 的唯一具名常量、比较单元、不一致 ⇒ `INSUFFICIENT_EVIDENCE` 的可执行测试方案。
5. **三处生产调用方接线**：`ops.ts`、`create-game.ts`、`publish-gate.ts` 的精确接法，以及不改变既有静态 Verdict 的证明方式。
6. **测试矩阵与证据要求**：新测试文件、夹具策略、既有测试零改动的验证、LP-06 / LP-07 语料复跑方案。
7. **偏离、风险与停止条件**：对 I-00 原计划的逐项偏离记账，以及任何越界即停止的判据。

**终点不是** I-01 的实施，也不是移动 Hazard 时序可达性能力。本图不修改生产代码。

## Notes

### 权威输入与冻结边界

- **I-01 需求（只读冻结）**：[`docs/v7.8/移动-I01-需求.md`](../../docs/v7.8/移动-I01-需求.md)，`sha256:05c6c72a…`，2847 bytes。本图内**不得编辑**；若评审发现必须修改，先走 HITL 修改权威输入并重算哈希。
- **I-00 冻结包（只读上位约束）**：[`docs/v7.8/移动-I00.md`](../../docs/v7.8/移动-I00.md)。§11 白名单与 R2 授权形态是硬边界；本图不得自行放宽。
- **前序证据（可引用、不重开）**：[I-00 地图与证据](../level-playability-v1.1-integration/map.md)、[`evidence/02-geometry-provenance.md`](../level-playability-v1.1-integration/evidence/02-geometry-provenance.md)、[`evidence/08-file-impact.md`](../level-playability-v1.1-integration/evidence/08-file-impact.md)、[`evidence/09-implementation-plan.md`](../level-playability-v1.1-integration/evidence/09-implementation-plan.md)。
- **领域词汇**：[`CONTEXT.md`](../../CONTEXT.md) 是唯一权威；本图不新增同义词。

### 开图裁定（用户 2026-11-09，三轮）

| 轮次 | 问题 | 裁定 | 要点 |
| --- | --- | --- | --- |
| 一 | Q1 终点形态 | **A** | 只交付可授权的 I-01 执行包；决策冻结与代码实施分离 |
| 一 | Q2 图落点 | **全部采纳** | tracker / 分支 / 基线 / 权威输入先提交并记 SHA |
| 一 | Q3 授权形态 | **A** | 单张硬阻断授权票整体签署；前置决策票消歧 |
| 一 | Q4 白名单冲突 | **B** | 图内不可裁定；改既有测试调用点也属文件修改 ⇒ 回 I-00 R2 |
| 二 | Q5 两档延迟 | **C** | 框架 + 可注入替身；禁止伪造算法能力 |
| 二 | Q6 可信读取 | **B** | 调用方（assets）读取；contracts 只比对；保持浏览器兼容 |
| 二 | Q7 `lagMs` 入口 | **A** | 新增独立时序入口；旧 `auditPlayability` 签名不变 |
| 二 | Q8 降级载体 | **B** | I-01 用内部结果；`coverage.temporal` 留给 I-03 |
| 三 | Q9 可信来源 | **A** | 唯一合法生产读取器 + 运行时 brand + 架构测试；**不是密码学边界** |
| 三 | Q10 生产消费者 | **A** | 三处真实接线 + 显式 stub（只返回 IE）；不新增公共字段 |
| 三 | Q11 测试落点 | **A** | contracts 纯函数 + digest 注入；测试留在 contracts |
| 三 | Q12 几何判据 | **A** | 帧存在 + `sourceSize == asset.size` + `anchor` 必须存在且一致 |

**Q4=B 的边界**：新增测试文件符合「只增不改」；修改既有测试调用点仍属违反；删除 / 放宽既有断言明确禁止。I-01 可以调查并提出最小修改清单，但**确认必须修改既有测试文件即停止授权包冻结，回 I-00 R2**。

**Q9 的限制必须原样写入授权包**：Runtime brand 是架构纪律与误用防护，**不是同进程内的密码学安全边界**，不能抵御恶意代码伪造或篡改。

**Q10 的限制必须原样写入授权包**：stub 只证明「生产调用链已接通、编排器能消费结果并执行降级」，**不证明**生产系统已具备移动 Hazard 时序判定能力；若接线后发现必须新增公共字段才能让结果有消费者，停止并重新裁定。

### 对 I-00 冻结计划的显式偏离

| 项目 | I-00 原计划 | 当前裁定形态 | 处理 |
| --- | --- | --- | --- |
| Atlas 读取 | contracts 内读取（`temporal-input.ts`） | assets 负责文件读取与 SHA | 显式偏离 |
| 几何验证 | contracts 内提取并验证 | contracts 纯函数验证；assets 负责可信读取 | 显式偏离 |
| 时序入口 | 扩展 `auditPlayability` options | 新增独立时序入口 | 显式偏离 |
| 旧入口 | 增加 options | 保持旧签名不变 | 显式偏离 |
| 降级字段 | 按计划在 I-03 集成 coverage | I-01 内部表达 | 保持阶段边界 |

这些偏离**仍在 I-00 白名单内**（`assets/src/ops.ts`、`playability/api.ts`、`config-audit.ts` 均被允许），但属于架构与计划形态变更 ⇒ **必须在授权票中逐项列明，不能描述成原样执行**。若实施发现必须动白名单外文件、既有测试或超出 R2 已批准的 4 项公共面加法 ⇒ 停止并回 I-00 R2。

### 已核实的结构事实（2026-11-09 只读调查）

1. **生产调用点只有三处**：`config-audit.ts:53`（经 `auditPlayability`）、`publish-gate.ts:140`、`assets/ops.ts:1247,1284`（经 `auditConfigPipeline`）。`compileRuntime` 的 options 已含 `packDir`（`ops.ts:984-1004`）；`PublishGateOptions.packDir` 存在，但 `configProblem` 目前只收 `configPath` + manifest（`publish-gate.ts:134-140`），需要穿透。
2. **`packages/contracts` 是纯 schema / 类型包，零 `node:fs` / `node:crypto`**；demo 以 esbuild `platform=browser` 消费 contracts（`packages/demo/src/shell/entry.ts`）。因此读取器不能住 contracts（Q6=B）。
3. **contracts 不能 import assets**（assets 依赖 contracts，反向成环）。Q6=B 下，需求指定的新测试只能测 contracts 的纯验证函数（Q11=A）。
4. **`AtlasEntry.checksum` 是 PNG 的 sha256**（`pack.ts:1171`），不是 JSON。Atlas JSON 字节的唯一绑定来源是 `files[]`（`assetpack.ts:298-332`）。
5. **逐帧几何只在 Atlas JSON**：`packages/contracts/src/atlas-json.ts:35-48`；manifest 只有资源级 `size` / `anchor`（`assetpack.ts:171-175`），且 `size` 取第 0 帧（`pack.ts:1216-1218`）。
6. **anchor 比对在 acceptance 里是条件式的**（`acceptance.ts:341`）；I-00 证据 `pack-d` 证明「删掉帧 anchor + 刷新 `files[]`」仍 verify PASS + acceptance CLEAN。
7. **移动 Hazard 今天已经恒为 IE**：`mechanic.ts:114-119` 无条件 `addGap("moving-hazard-phase")` ⇒ 机制层 `partial` ⇒ 整关 IE。所以「伪造声明拿不到确定性结论」必须靠**证明新通道被消费**，不能靠现状空转。
8. **既有测试引爆面**：直接调 `auditPlayability` 的既有测试只有 `playability-api.test.ts:38` 一个 helper，但其下 24 条断言依赖三态结论；`config-audit.test.ts:32` 有 1 个 `auditConfigPipeline` helper。Q7=A 的目标就是让这两个文件零改动。
9. **I-00 已批准公共面加法 4 项**：`auditPlayability` 签名、`ConfigAuditContext`、`coverage.temporal`、`PlayabilityEvidence` 可选字段（`evidence/08-file-impact.md` §2）。本图裁定只用其中更小的子集；**新增第 5 项需重新裁定**。

### 执行覆盖（有限只读 + scratch 写入）

Wayfinder 默认只做决策；本图按用户 2026-11-09 裁定**不承载实施**。

**允许**

- 读取 `packages/**`、`docs/**`、fixtures、既有测试与 `.scratch/**`。
- 在 `.scratch/level-playability-v1.1-i01/{scripts,evidence}/` 写扫描 / 验证脚本与决策记录。
- 运行不修改产品文件的测试或小型只读验证程序。
- 将日志、摘要、哈希与结论保存到本 effort 的 `evidence/`。

**禁止**

- 修改 `packages/**`、产品配置、公共契约、既有测试或 CI。
- 修改 `docs/v7.8/移动-I00.md` 与 `docs/v7.8/移动-I01-需求.md`。
- 安装新依赖、调用付费模型或外部付费服务。
- 推送 `main`、自动合并、启动 I-02 / I-03。
- 把 scratch 脚本接入正式构建、CI 或产品包。

**停止线**：零付费、Runtime 只读、不接生产。

### 票分类与状态

- 票类型（`Type:`）：`research` / `prototype` / `grilling` / `task`。
- 状态（`Status:`）：`open` / `claimed` / `resolved`。
- 认领即改 `Status: claimed` 并保存，先于任何工作。
- 除 research 票外，**每个会话最多关闭一张票**。
- `Blocked by:` 用本目录票号；全部前置票 `resolved` 后票才进入 frontier。

### 证据标准

- **E1**：源码 / 契约 `file:line`。
- **E2**：测试名 + 断言 + 退出码。
- **E3**：scratch 复跑（命令、路径、计数、原始输出摘要）。
- 每张票收口必须记录：对应需求 / 硬门槛编号、输入文件与 SHA、命令与环境、原始结果、是否修改产品目录（必须为否）、结论与限制、复现方法。

### 依赖图

```
I01-01 精确文件清单与依赖方向（task · AFK）
  └─┬─ I01-02 可信输入契约与 brand（grilling · HITL）
    │     └─ I01-04 双档 lag 编排与 stub（grilling · HITL）
    │           └─ I01-05 三处生产调用方接线（research · AFK）
    │                 └─ I01-06 测试矩阵与证据要求（task · AFK）
    └─────── I01-03 逐帧几何判据与负例（grilling · HITL）
                  └─────── I01-06
                              └─ I01-07 白名单与 R2 一致性审计（task · AFK）
                                    └─ I01-R1 I-01 执行包冻结与授权（grilling · HITL）[HARD BLOCK]
```

- **frontier**：`I01-01` 与 `I01-03` 可并行开工；其余等待前置。
- `I01-05` 是 research 票，可由子代理执行，但必须等 `I01-02` / `I01-04` 收口。
- `I01-R1` 签署后，本图收口；实施是图外的独立 PR。

### 分文分支与产物

- 图与票：`wayfinder/level-playability-v1.1-i01`（本分支，自 `main @ 29ea1d1`）。
- 产物：`.scratch/level-playability-v1.1-i01/{map.md,issues/,evidence/,scripts/}`。
- 不复活 I-00 的 `wayfinder/level-playability-v1.1-integration` 分支，也不把 I-00 证据改造成本 effort 的执行目录。

## Decisions so far

<!-- 索引：每张已关闭票一行，够判断相关性即可；细节永远在票里。 -->

- [I01-06 测试矩阵与证据要求](issues/06-i01-06-test-matrix.md): 唯一新测试文件 `playability-temporal-input.test.ts`，既有测试零改动、夹具零新增；65 条矩阵覆盖失败码、`1e-9` 容差、累积去重、TOCTOU 同字节、brand 伪造（配 PU/NB 阳性对照）、lag 矩阵、scope 与架构扫描；负向须重绑 `files[]` 才触达目标失败码；读取器无独立单元测试、接线只能结构证明，两条残余限制进 R1。
- [I01-05 三处生产调用方接线与回归影响](issues/05-i01-05-call-site-wiring.md): 三处均可接线且越界清单为空；`runTemporalAudit` 必须同步、绝不抛；适用才读盘、每次编排读一次，重采样循环内不接（结果丢弃、无法影响重试）；汇合点与发布闸丢弃结果，时序 IE 不产 issue、不改 Verdict、不阻断；无新增参数或返回字段。
- [I01-04 双档 lag 编排与 stub 降级](issues/04-i01-04-lag-orchestration.md): 结果区分 `applicable`；只要存在移动 Hazard 即适用，Y 轴 / 多 Hazard 保守 IE；两档只比 `verdict`，不同 ⇒ IE + `lag-disagreement`；非法 lag ⇒ IE + `lag-invalid`；常量唯一住 contracts；编排器在 `assets/ops.ts`；生产用显式 stub，替身只在测试；三处调用方接线后丢弃结果。
- [I01-03 逐帧几何判据与负例矩阵](issues/03-i01-03-frame-geometry-predicate.md): 每帧须存在、`sourceSize == asset.size`、`anchor` 在 `1e-9` 内一致、`rotated/trimmed === false`；schema 优先，缺失默认按 `false`；失败闭集扩到 10 个；`files[]` 按路径去重；全量累积去重排序；`last-train/v2` 零不符。
- [I01-02 可信输入契约与 brand 机制](issues/02-i01-02-trusted-input-contract.md): 全有或全无的判别联合；范围 = player + 配置引用的 hazard/pickup/goal；一次调用验整包、SHA 来自 `files[]`、同字节解析；模块私有 Symbol brand；digest 注入且生产只允许 `ops.ts`；闭集失败码 + 显式 verified 表；入口无几何/规避参数；`verifyTemporalInput` 经 `api.ts` 标 `@internal`，调用者由架构测试限制。
- [I01-01 精确文件清单与依赖方向](issues/01-i01-01-file-plan.md): 最小改动面 = contracts 2 新 + `api.ts` 只加导出、assets `ops.ts` 唯一读盘层、pipeline 2 处接线；`config-audit.ts` / `mechanic.ts` / `verdict.ts` / `index.ts` 全不改；新导出**替代** R2 第 1 项而非第 5 项；既有测试零改动；越界清单为空。

## Not yet specified

<!-- 在**目标之内**、但还无法精确表述的问题。能写成一张票就写成票，不要预先切片。 -->

- 授权包对 scratch 证据的归档方式（引用 vs 复制）。

## Out of scope

- **I-01 的实施**：生产代码、测试、独立 PR。本图只产出可签署的执行包。
- **I-02 时序判定核心**：连续时间求交、witness、永久门、垂直规避图割、网格规则。
- **I-03 Verdict 集成**：`coverage.temporal`、`PlayabilityEvidence` 公共字段、顶层聚合优先级、`mechanic.ts` 消解 gap。
- **Runtime / CLI / MCP / 持久化 schema / `ConfigIssue.code` / 新依赖 / 付费调用**。
- **修改 I-00 冻结包、I-01 需求文档、既有测试断言或 `fixtures/packs/**`**。
- **修改 I-00 白名单以外的任何文件**；需要时回 I-00 R2 重新裁定。
