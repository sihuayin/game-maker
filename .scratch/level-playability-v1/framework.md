# Level Playability V1 — 判定框架

- **性质**：审计规格（本图产出）。不修改生产代码，不构成 contracts 变更授权。
- **裁定来源**：[判定框架与输入/结果/集成边界裁定](issues/01-framework-and-boundaries.md)（Q1–Q7，2026-11-04，HITL 全采纳推荐）。
- **冻结输入**：[开图裁定](rulings-2026-11-04.md)、[能力与缺口审计](research/02-capability-gap-audit.md)、`CONTEXT.md`。
- **基线**：`main` @ `fa17c14`。
- **术语**：以 `CONTEXT.md` 为准（`可玩性判定` / `空间可达性` / `机制可通行性` / `关卡完成性` / `Playability Verdict` / `FixedRuntimeProfile`）。

## 0. 架构原则

> 判定系统只基于 GameConfig、AssetPackManifest 与 FixedRuntimeProfile；只对能够证明的不可玩问题硬拒。不能证明不代表可玩，也不能证明不代表不可玩。

三条纪律贯穿全文：

1. **判据 vs 观察**：只有「精确可算 + 错了一定不是设计」才进判据；难度、节奏、路线优劣、体验仍是观察。
2. **证明方向只往「玩家更强」偏**：判据高估玩家能力；「不在可达集里」才是可靠的那半句话。
3. **三态不退化**：`NO_PROVEN_BLOCKER` 永远不等于 `PROVEN_PLAYABLE`；coverage 缺口必须显式出现。

## 1. 三层定义

| 层 | 判据 id 前缀 | 要回答的问题 | 例子 |
|---|---|---|---|
| 空间可达性 | `PLAYABILITY_SPATIAL_*` | 目标之间是否存在几何上的可达路径？ | 拾取物被地形完全隔断；chest 在坑对面 |
| 机制可通行性 | `PLAYABILITY_MECHANIC_*` | 路径在现有机制约束下是否实际可走？ | 巡逻危险物封死唯一通路；实心体 motion 的运行时语义 |
| 关卡完成性 | `PLAYABILITY_COMPLETION_*` | 必须完成的目标能否在一次游玩中全部完成？ | 收集后回不到 gate；必需 chest 不可取得 |

层名用中文，id 用英文；三层共用同一个 `PlayabilityVerdict`。

## 2. 输入边界

### 2.1 允许的输入

```
(GameConfig, AssetPackManifest) + FixedRuntimeProfile
```

- `GameConfig`：几何、实体、`objective`、玩家手感参数。
- `AssetPackManifest`：玩家尺寸 / 锚点、solid `body`、资源尺寸与能力；不可由 config 推断。
- `FixedRuntimeProfile`：集中定义的运行时假设集合（见 2.2）。

### 2.2 FixedRuntimeProfile

| 假设 | 本轮定义 |
|---|---|
| 二段跳 | 不存在 |
| `solid` | 静态碰撞（`motion` 不推进） |
| `hazard` | 接触后复位到出生点，已收集计数保留 |
| kill plane | 不存在；掉出世界不判死 |
| viewport | 不作为判据输入 |
| design | 不读取 |

要求：

- 集中定义、可测试；**不允许**各审计函数各自隐含一套默认值。
- 生产调用方不传 profile；测试可以注入显式 profile 作为缝。
- Runtime 行为变化时，必须重新评估依赖该假设的判据；不得沿用过期假设。

### 2.3 排除的输入及理由

| 排除 | 理由 |
|---|---|
| `GameDesignSpec` | `levels[].layout` 是自由文本、无坐标；判设计意图只能靠模型推断，撞停止线。设计↔config 身份对账已由 `auditEntityIdentity` 负责（resampleable）。 |
| viewport | 运行时外壳用常量 `VIEWPORT`；自定义 viewport 只影响站点/审计，不影响运行时行为。空间判据只读 `config.world.size`。 |
| Playtest 结果 | `AGENT_LIMITATION` / `TIMEOUT` / `ENVIRONMENT_FAILURE` 不得转成不可玩；试玩只是证据，不是判据。 |
| 模型调用 / 生图 | 全程零付费；判据必须是确定性纯函数。 |

## 3. 结果模型

### 3.1 PlayabilityVerdict

```
PlayabilityVerdict = {
  verdict:  PROVEN_UNPLAYABLE | INSUFFICIENT_EVIDENCE | NO_PROVEN_BLOCKER,
  evidence: PlayabilityEvidence[],
  coverage: { spatial, mechanic, completion }   // 每维 checked | partial | not-checked
}

PlayabilityEvidence = {
  judgmentId, target, detail, witness, coverage,
  assetId?, expected?, actual?
}
```

### 3.2 三态

| Verdict | 含义 | 硬拒 |
|---|---|---|
| `PROVEN_UNPLAYABLE` | 有确定性证据证明关卡不可玩 | 是 |
| `INSUFFICIENT_EVIDENCE` | 当前判据无法证明可玩或不可玩 | 否 |
| `NO_PROVEN_BLOCKER` | 已执行判据未发现确定性阻断 | 否 |

### 3.3 聚合规则（由三态定义派生）

1. 任一已执行判据产出 `PROVEN_UNPLAYABLE` ⇒ 总 verdict 为 `PROVEN_UNPLAYABLE`；
2. 否则，若任一在范围内维度不是 `checked`（存在 `partial` / `not-checked`，或某判据返回证据不足） ⇒ `INSUFFICIENT_EVIDENCE`；
3. 否则 ⇒ `NO_PROVEN_BLOCKER`。

`NO_PROVEN_BLOCKER` **不等于** `PROVEN_PLAYABLE`；空 `ConfigIssue[]` 只表示没发现确定性错误。

### 3.4 coverage

- `checked`：该维在范围内的判据全部执行并给出结论；
- `partial`：部分执行，其余因语义缺失 / 超出当前规格而跳过；
- `not-checked`：一条都没跑。

coverage 必须逐维记录，**不得**因最终没有 error 而隐去未运行检查。

### 3.5 持久化边界

`PlayabilityVerdict` 是**内部纯函数结果**。类型与函数可供 scratch、测试与内部消费者使用，但**不得**进入：

- `qa-report.json`
- `delivery`
- GameConfig 持久化结构
- 任何新 contracts 导出 schema

错误侧只映射到现有 `ConfigIssue[]`；不新增持久化结果格式。

## 4. 集成点

### 4.1 失败阶段

`PROVEN_UNPLAYABLE` 进入 `auditConfigPipeline` 的 `deterministic` 档：

1. 编译循环完成（`packages/assets/src/ops.ts:1278-1295`）；
2. 汇合点执行 playability 审计（`packages/pipeline/src/create-game.ts:621-643`）；
3. `PROVEN_UNPLAYABLE` 映射为确定性 `ConfigIssue`；
4. 硬拒：不重采样、不落盘；
5. `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` 不产生 error。

退出码不变：仍为 `invalid`（4）。失败阶段相对现状可能提前到 QA / site 之前，与 P1 · B-02 一致。

### 4.2 发布闸

- `packages/pipeline/src/publish-gate.ts:140` 今天只重跑 `auditReachability`；实施时**直接改调** `auditPlayability`。
- 不做「两个都调」的过渡（会在同一不可达上重复报）。
- `assembleSite` 直调是否接线列为 09 的修改面；若不接线，规格必须明写「库直调 `assembleSite` 仍不过闸」的残余风险。

### 4.3 QA 不变

- **不新增 QA 判据**，不扩展 `QA_JUDGEMENTS`（仍 7 条），不把 verdict 塞进 QA 报告。
- QA 的 `reachability` 格子继续调 `auditReachability`；QA standalone 与 deterministic 属不同阶段/报告，不构成同报告重复。

### 4.4 测试必须证明

- 确定性不可玩会阻断；
- 证据不足不会阻断；
- 未发现阻断不会被提升为「已证明可玩」；
- deterministic 失败不会触发模型重采样；
- 同一 `(target, 根因类)` 只产一条 error。

## 5. 判据 id 与失败定位

### 5.1 命名规则

```
PLAYABILITY_<LAYER>_<SUBJECT>_<FAILURE>
```

- `LAYER` = `SPATIAL` | `MECHANIC` | `COMPLETION`
- `SUBJECT` = 目标类型或路径（`PICKUP` / `CHEST` / `GATE` / `SPAWN` / `PATH` / …）
- `FAILURE` = `UNREACHABLE` / `BLOCKED` / `NOT_COLLECTABLE` / `NO_SAFE_WINDOW` / …

id 一经发布即稳定；改名 = 破坏 scratch / 测试锚点，应废弃而非重命名。每个原子判据在 03–05 的规格中登记，汇总到模块内一份封闭注册表（内部，不导出为契约 schema）。

### 5.2 失败定位字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `judgmentId` | 是 | 稳定判据 id |
| `target` | 是 | 实体 id 或字段路径；映射到 `ConfigIssue.where` |
| `detail` | 是 | 人话定位；映射到 `ConfigIssue.message` |
| `witness` | 是 | 可机检证明：`no-path`（含可达集摘要）/ `blocked`（含矩形或格子）/ `coverage-gap`（含缺哪维）/ `count`（含 collected / required） |
| `coverage` | 是 | 三维各自的 `checked` / `partial` / `not-checked` |
| `assetId` | 否 | manifest 能力相关时 |
| `expected` / `actual` | 否 | 数值阈值类判据；不强制 |

### 5.3 映射到 ConfigIssue

- `target` → `where`，沿用现有格式（`entity "<id>"` / 字段路径）；
- `detail` → `message`，沿用现有「够不到」等人话；
- **不带 `code`**：`CONFIG_ISSUE_CODES` 是闭集（`packages/contracts/src/game-config.ts:315-317`），加码是契约形状变更；
- 若实施确需机器码，作为 09 的单列审批候选（必要性 / 替代方案 / 影响面 / 不做后果），本框架不批。

## 6. 放置位置

- 新模块单一入口 `auditPlayability(config, manifest)`（模块名候选 `playability.ts`；最终文件名由 09 定）。
- `auditConfigPipeline.deterministic` 里**替换** `auditReachability`，不是并列；避免重复报。
- `auditReachability` 保留为内部组成件（可重构补走路边 / chest target / 真实 motion 语义），QA 继续调它。
- 发布闸改调 `auditPlayability` 的错误映射。
- `assembleSite` 直调的残余风险见 4.2。

## 7. 与既有审计的关系

### 7.1 分档规则

1. **严重度只由 verdict 派生**：`PROVEN_UNPLAYABLE` → error；另两态 → 不产 `ConfigIssue`（不 downgrade 成 warning）。只有 `auditPlayability` 做这个映射。
2. **error 去重键 = `(target, 根因类)`**：同一目标多条证明只产一条 error；`witness` 列全部根因。
3. **warning 原样保留、不参与 verdict**：台阶高 / 周期行程越界可与 playability error 并存（不同 `where` / message，回答设计观察 vs 证明）；warning 永不升级、不被 `auditPlayability` 读取来推断 verdict。
4. **替换而非叠加**：更严格 overlap、走路边、moving solid 对齐都在 reachability 组成件内部替换旧逻辑，不新增并列判据。

### 7.2 根因归属

| 根因 | 归属 | 严重度 |
|---|---|---|
| 出生点卡在 `solid` | `auditGameConfig`（现有） | error |
| 出生点埋在 terrain | `auditPlayability`（新判据） | error |
| 目标不可达（spawn → target） | `auditPlayability` | error |
| 收集后回不到 gate / 必需收集物不可取得 | `auditPlayability` | error |
| 台阶高 | `auditGameConfig`（现有） | warning |
| 周期行程越界 | `auditGameConfig`（现有） | warning |
| 机制时序无法证明 | `auditPlayability` | 不产 issue（`INSUFFICIENT_EVIDENCE`） |
| 机制存在性 | `mechanic-coverage` | 独立 verdict，不受影响 |
| QA standalone `reachability` | `qa/src/gameplay.ts` | 继承既有 error |

### 7.3 不改变的既有裁定

- 台阶 / 行程 warning 不升级（「可能正是设计」的既有裁定）；
- `mechanic-coverage` 的 `verdict` 不变；
- `QA_JUDGEMENTS` 仍 7 条（多处注释误写 6 条，以代码为准）；
- B-02 的 deterministic reachability 分档不退回。

## 8. 交给 03–05 的边界

本框架只钉框架；以下内容由候选判据票细化，不得在本框架外另行发明：

- **03 空间布局**：chest target、收集后路径、更严格 overlap、出生点 terrain、moving solid 真实语义、走路 / clearance 边、`body` 语义。
- **04 机制组合**：`hazard` / `danger` 安全窗口只做可证明的退化情况，其余落 `INSUFFICIENT_EVIDENCE`；moving platform 在现行 Runtime 下不可写；机制组合原子判据不接手机制覆盖门禁。
- **05 关卡完成性**：`pickupCount` / `tryWin` 的收集门槛、必需 chest、收集顺序、gate 激活；设计层数量 / 可选性 / 文本条件仍结构性不可判。

已知不可写项（直接落 `INSUFFICIENT_EVIDENCE` 或观察，不硬造阈值）：设计↔config 空间一致性、设计层 win/lose 文本、pickup 可选性、逐帧物理、玩家技巧、危险物相位下的精确到达时刻。

## 9. 非目标

- 修改 Runtime、新增 EntityKind / Motion / 机制 / 斜坡碰撞；
- 未经审批的 contracts schema/API 形状变化；
- CLI / MCP 对外接口扩展；
- 塔防 `td-config/v1`；
- 付费验证（模型、生图、站点重建）；
- 难度 / 节奏 / 路线优劣 / 体验评价；
- 把 Playtest 结果当判据；
- 修改历史语料与验收证据。

## 10. 事实来源

- 调用链与分档：`research/02-capability-gap-audit.md` §1；
- 现有判据清单：同上 §2；
- 运行时语义：同上 §3；
- 缺口与重叠表：同上 §4、§5；
- 关键源码：`contracts/src/reachability.ts`、`contracts/src/game-config.ts:300-317,498-587`、`contracts/src/config-audit.ts:42-57`、`pipeline/src/publish-gate.ts:134-144`、`assets/src/ops.ts:1278-1295`、`pipeline/src/create-game.ts:621-643`、`contracts/src/qa.ts:111`。
