# 审批包与独立实施交接

Type: grilling
Status: resolved
Owner: amber · 2026-11-05
Blocked by: 09
Map: ../map.md

## Question

汇总审计、规格、语料重判、合成矩阵与最小实施方案，完成 Level Playability V1 的**审批包**，并决定独立实施 effort 的启动条件。本票是 HITL：由用户裁定。

### 必须裁定

1. **规格批准**：是否批准三层判定框架、原子判据清单、结果模型与失败定位。
2. **契约候选**：逐个裁定（批准 / 推迟 / 不采用）；批准只授予方案资格，不等于实施授权。
3. **实施授权**：是否进入独立实施 effort；实施的范围、顺序、测试与回退要求。
4. **票据与分支**：实施 effort 的票据切法、分支、提交纪律、是否开 PR、是否合并。
5. **付费边界**：实施与验收是否仍为零付费；任何付费验证需单独预算与二次确认。
6. **图关闭**：更新 `../map.md` 的 Status 与 Decisions so far；本票置 resolved。

### 输出

- `../final-report.md`（审计结论、判据清单、语料结果、矩阵、方案、审批问题、已知限制）。
- 本票 `## Answer` 记录逐项裁定。
- 更新 map；若进入实施，记录下一 effort 的入口与授权边界。

### 边界

- 不实施生产代码；不推送 `main`；不合并 PR。
- 不得把「审计通过」表述为「关卡可玩性已验证」；只能表述为「确定性判据已定义、语料零不可解释误伤、合成负例通过」。
- 不得把 `NO_PROVEN_BLOCKER` 写成「可玩」。
- 不重开 01–09 的事实结论；只做审批与交接。

### 通过标准

- 审批包覆盖 Destination 的 8 项交付。
- 每项契约候选有明确处置。
- 实施 effort 有入口、票据、授权边界与回退点。
- 图 `Status` 更新，10 票 `## Answer` 完整。

## Answer（round 1：Q1–Q6，2026-11-05 裁定）

### Q1 — 规格批准：批准

批准三层框架、原子判据清单、三态结果模型、失败定位与 coverage。批准的四项模型修正：真实几何重叠、walk + fall、solid 静态、以 Runtime 几何语义为准。

- `QA_JUDGEMENTS` 保持 7 条，不增加第 8 条。
- severity 只由 verdict 派生，不允许各判据自行决定硬拒。
- 本次批准是审计规格，不是生产实现授权，不重开 01–09 的事实结论。

### Q2 — 契约候选：仅批准 C1

| 候选 | 裁定 |
|---|---|
| C1 `auditPlayability` / `playabilityIssues` + 内部类型 | **批准**（contracts 加法导出；不改既有调用者 / `auditConfigPipeline` 返回形状；不新增 CLI/MCP 参数或持久化字段） |
| C2 `ConfigIssue.code` | 不采用 / 推迟（不扩展闭集） |
| C3 持久化 verdict / coverage | 不采用（不进 QA / delivery / config） |
| C4 新增 QA 判据 | 不采用（QA 保持 7 条） |
| C5 `FixedRuntimeProfile` 生产入参 / CLI 参数 | 不采用（内部常量） |
| C6 manifest 逐帧 atlas 几何 | 不采用 / 后续 effort |

C1 的批准不隐含批准 C2–C6。

### Q3 — P1–P4：全部批准进入规格，Runtime 证据是硬前提

- P1 标称 size + 资源 anchor = 碰撞几何；**需核对 Runtime 实际使用方式**。
- P2 `body` 语义：solid/chest/danger 生效，pickup/hazard/goal 忽略；**需核对实体碰撞分支**。
- P3 chest 交互盒 = `body ?? size` 外扩 `range`；**需核对实际交互检测代码**。
- P4 出生点与静态几何重叠时的分离语义；**需核对初始化与碰撞处理顺序**。

**强制要求**：每项必须有 Runtime 源码证据才可成为确定性判据的有效假设；记录文件/函数、几何公式或条件、相关实体类型、正反例 fixture、语义变化时受影响的判据。任一项无法确认 ⇒ 相关判据只能 `INSUFFICIENT_EVIDENCE`，不得把未经证实的假设写成确定性 error。

P1 的适用范围必须明写：manifest 标称尺寸不等于逐帧可见边界；本轮不引入 C6，不得声称已解决逐帧碰撞几何。

### Q4 — 三条历史真实缺陷：记录为已知真实缺陷（A）

- `run-out-2026-10-13h`、`run-out-2026-10-18a`、`visual-design-impl`。
- 不设路径 / 环境 / run ID 例外；不修改历史证据；不重发布旧 run/pack。
- LP-01 后 A 按正常规则启用；被阻断的历史样本保留为已知缺陷证据。
- 不得为让历史样本通过而降低判据或增加绕过逻辑。
- v3 parser 本就不读的那条（`run-out-2026-10-13h`）明确归为「历史生产 parser 行为」，不归因于 LP-01 新增阻断。

### Q5 — QA `auditReachability` 行为：接受变化，统一移动模型（A）

更新对应测试，不保留两套几何 / 移动语义。明确：QA reachability 通过只代表 QA 自己的判据通过，不代表机制可通行性或关卡完成性已判定；Playability 三态不进入 QA 的 7 条判断。

### Q6 — R1 / R21：两项批准

- **R1**：`PATH_NO_SAFE_WINDOW` 不新增第五种 witness；折入 `blocked`，带 `blocker:"danger"` / `requiredMs` / `idleMs` 证据字段，不得当作 verdict 或错误码。测试覆盖：有可通过窗口、窗口不足、全高墙无窗口、边界恰好相等。
- **R21**：矩阵 `expectedVerdict` 定义为所属层级 / 判据的预期，不代表整关 aggregate；整关 aggregate 另测。

### 待裁定

Q7 实施授权范围、Q8 票据/分支/PR、Q9 付费边界、Q10 图关闭。

## Answer（round 2：Q7–Q10，2026-11-05 裁定）

### Q7 — 实施授权：批准 A（完整 LP-00…LP-07，串行）

以本表为**权威实施序列**（覆盖 plan.md 的旧 LP 编号）：

| 票 | 职责 | 关键交付 |
|---|---|---|
| LP-00 | Runtime 语义核验 | P1–P4 证据档案、判据适用性矩阵 |
| LP-01 | 基础几何模型 | 真实重叠、walk + fall、solid 静态模型 |
| LP-02 | 空间可达性 | CHEST / PICKUP / GATE / SPAWN 判据 |
| LP-03 | 机制可通行性 | `PATH_BLOCKED`、danger 安全窗口 |
| LP-04 | 关卡完成性 | `GATE_NOT_REACHABLE_AFTER_COLLECT` |
| LP-05 | 纯函数与 pipeline 集成 | C1 加法导出、deterministic 硬拒 |
| LP-06 | 历史语料与负例验收 | 全量重判、零误伤说明、coverage |
| LP-07 | 收口与交付 | 最终报告、回退记录、实施验收 |

强制复核点（不通过即停止后续票，不得自动越过）：

1. **LP-00 后**：审核 P1–P4 Runtime 证据；无证据支持的判据必须 `INSUFFICIENT_EVIDENCE`，不能推测补全。
2. **LP-02 后**：审核空间模型与历史语料误伤；确认后才能进入 LP-03。
3. **LP-03 后**：审核 hazard / danger 时间窗口模型与边界 fixture；确认后才能进入 LP-04。

**未分配项**：`plan.md` 的编译提示词修改（`packages/assets/src/ops.ts`）不在 Q7 的 LP 表中，按**未授权 / 未分配**处理；若需要，另立票据，不在本次实施授权内。

### Q8 — 票据、分支与 PR：批准推荐方案

- 独立分支 `p1/level-playability-v1`，从本图审批包提交切出。
- LP-00…LP-07 一票一 commit；每票记录命令、退出码、commit SHA、回退点。
- LP-02 后开 Draft PR；LP-07 后转正式 PR；**不自动合并**。
- 只推实施分支，不推 `main`；推送经 `127.0.0.1:7890` 代理。
- 每票可独立 revert；判据级关闭用 `PLAYABILITY_DISABLED`，并遵守：
  1. 关闭某条判据不影响其它判据；
  2. 关闭状态可审计；
  3. 关闭后不得报告该判据已通过；
  4. 不允许用关闭判据掩盖历史语料误伤；
  5. 不允许关闭全部判据伪造验收成功。

### Q9 — 付费边界：批准 A（全程零付费）

实施与验收不调用付费模型、不生图、不做付费模型效果验证、不重建需要付费服务的站点；只用本地源码、fixture、历史语料与确定性测试。任何付费验证另立预算并单独确认。

### Q10 — 图关闭：批准 A

- 地图 `Status: closed · 2026-11-05 审批通过；实施另起 effort p1/level-playability-v1`。
- 产出 [final-report.md](../final-report.md)。
- 本票 `Status: resolved`。
- 本图 Destination 到实施审批门为止，不承担生产代码实施。

### 授权边界

**已批准**：LP-00…LP-07 串行实施；P1–P4 Runtime 证据核验；C1 内部加法导出；确定性 Playability 审计及现有 `ConfigIssue[]` 硬拒映射；QA 统一移动模型；一票一 commit、分支 PR、独立回退；全程零付费。

**仍不批准**：新增 Runtime 机制或 EntityKind；新增持久化 Playability schema；新增 QA 第 8 条；CLI/MCP 新参数；C2–C6；付费验证；推送 `main` 或自动合并 PR。

**停止线**：LP-00 不能证明的 Runtime 语义，对应判据必须保持 `INSUFFICIENT_EVIDENCE`；后续实施不得为了完成票据而把未知假设变成确定性规则。
