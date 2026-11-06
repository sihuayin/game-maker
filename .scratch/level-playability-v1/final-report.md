# Level Playability V1 — 审批包与最终报告

- **Effort**：Level Playability V1（只读审计与判据规格）
- **状态**：**审批通过，地图关闭**（2026-11-05）
- **代码基线**：`main` @ `fa17c14`
- **审批票据**：[审批包与独立实施交接](issues/10-approval-package.md)
- **实施入口**：独立 effort `p1/level-playability-v1`；本报告是交接件，不是实施记录
- **性质**：本图未修改生产代码；本报告不声称「关卡可玩性已验证」，只声称「确定性判据已定义、语料零不可解释误伤、合成负例通过」

## 1. 结论摘要

1. **三层判定框架已批准**：空间可达性 / 机制可通行性 / 关卡完成性，共用三态 `PlayabilityVerdict`。
2. **原子判据**：空间 4 类、机制 2 条、完成性 1 条；其余方向明确落 `INSUFFICIENT_EVIDENCE` 或观察。
3. **结果模型**：内部三态 + evidence + coverage；`PROVEN_UNPLAYABLE` 映射到现有 `ConfigIssue[]`；不新增持久化 schema。
4. **集成**：`auditPlayability` 替换 `auditConfigPipeline.deterministic` 里的 reachability；发布闸改调同一入口；QA 仍 7 条、统一移动模型。
5. **语料**：96 唯一配对 / 20 唯一 config；空间新增 0、完成性有效 gate 新增 0；机制 A 3 条真实缺陷、0 误伤、1 probe 排除。
6. **合成矩阵**：39 例（17 `PROVEN_UNPLAYABLE` / 18 `NO_PROVEN_BLOCKER` / 4 `INSUFFICIENT_EVIDENCE`）。
7. **实施授权**：LP-00…LP-07 串行，三个强制复核点，全程零付费。

> ⚠️ `NO_PROVEN_BLOCKER` **不等于**「可玩」。它只表示已执行判据没有发现确定性阻断。

## 2. Destination 八项交付

| # | Destination 交付 | 落点 |
|---|---|---|
| 1 | 当前源码能力与缺口审计 | [research/02-capability-gap-audit.md](research/02-capability-gap-audit.md) |
| 2 | 不可玩 / 证据不足 / 未发现阻断的定义 | [framework.md](framework.md) §3；本报告 §3 |
| 3 | 机制组合、空间布局、可通行性的原子判据 | [framework.md](framework.md) §1；[test-matrix.md](test-matrix.md) §1 |
| 4 | 每条判据的精确算法、输入、输出、失败定位 | [research/03](research/03-spatial-layout-judgments.md)、[04](research/04-mechanic-composition-judgments.md)、[05](research/05-level-completion-judgments.md)；本报告 §4 |
| 5 | 历史语料重判结果 | [corpus/rejudgment.md](corpus/rejudgment.md)；本报告 §6 |
| 6 | 合成负例测试矩阵 | [test-matrix.md](test-matrix.md)；本报告 §7 |
| 7 | 最小实施方案、修改面、测试、回退 | [plan.md](plan.md)；本报告 §8 |
| 8 | 独立实施 effort 票据与审批问题 | 本报告 §9–§11；[审批票据](issues/10-approval-package.md) |

## 3. 判定框架（已批准）

### 3.1 三层

| 层 | 判据 id 前缀 | 问题 |
|---|---|---|
| 空间可达性 | `PLAYABILITY_SPATIAL_*` | 目标之间是否存在几何可达路径 |
| 机制可通行性 | `PLAYABILITY_MECHANIC_*` | 路径在现有机制约束下是否实际可走 |
| 关卡完成性 | `PLAYABILITY_COMPLETION_*` | 必须完成的目标能否在一次游玩中完成 |

### 3.2 三态

| Verdict | 含义 | 硬拒 |
|---|---|---|
| `PROVEN_UNPLAYABLE` | 有确定性证据证明不可玩 | 是 |
| `INSUFFICIENT_EVIDENCE` | 当前判据无法证明可玩或不可玩 | 否 |
| `NO_PROVEN_BLOCKER` | 已执行判据未发现确定性阻断 | 否 |

聚合（framework §3.3）：任一证明 ⇒ `PROVEN_UNPLAYABLE`；否则任一在范围内维度未 fully checked ⇒ `INSUFFICIENT_EVIDENCE`；否则 `NO_PROVEN_BLOCKER`。

### 3.3 输入与固定运行剖面

只接收 `(GameConfig, AssetPackManifest) + FixedRuntimeProfile`；不读 design、viewport、playtest。

**P1–P4 批准为规格候选假设，但每项必须有 Runtime 源码证据才可成为确定性判据的有效假设**：

| 假设 | 内容 | 证据门槛 |
|---|---|---|
| P1 | manifest 标称 `size` + 资源 `anchor` = 碰撞几何 | 记录 Runtime 实际使用方式；逐帧 atlas 误差边界必须明写 |
| P2 | solid/chest/danger 的 `body` 生效；pickup/hazard/goal 忽略 | 记录实体碰撞分支 |
| P3 | chest 交互盒 = `body ?? size` 外扩 `range` | 记录实际交互检测代码 |
| P4 | 出生点与静态几何重叠时的分离语义 | 记录初始化与碰撞处理顺序 |

任一项无法从当前 Runtime 确认 ⇒ 相关判据只能 `INSUFFICIENT_EVIDENCE`。P1 不声称解决逐帧碰撞几何；C6（manifest 逐帧 atlas）不在 V1。

## 4. 原子判据清单（已批准）

### 4.1 空间

| 判据 id | 算法摘要 | 失败定位 |
|---|---|---|
| `PLAYABILITY_SPATIAL_CHEST_UNREACHABLE` | chest 作为必需目标（含 `range` 外扩交互盒）进入移动图；无路径即报 | `target=entity "<chest>"`；witness `no-path` |
| `PLAYABILITY_SPATIAL_{PICKUP,CHEST,GATE}_BLOCKED` | 目标完全埋进实心体、无任何自由玩家重叠位置；与 `UNREACHABLE` 同目标互斥，`BLOCKED` 优先 | `target=entity "<id>"`；witness `blocked` |
| `PLAYABILITY_SPATIAL_SPAWN_IN_TERRAIN` | 窄口径：脚点 + 锚点 offset + 附近无 standable；纯盒重叠会误伤 11/20，不采用 | `target=player.at`；witness `blocked` |
| 模型修正（无独立 id） | 真实 AABB 重叠替换 `covers`；walk + fall 边；solid `motion` 静态原位；pickup/goal 用运行时几何（忽略 `body`） | 强化上述判据 |

### 4.2 机制

| 判据 id | 算法摘要 | 失败定位 |
|---|---|---|
| `PLAYABILITY_MECHANIC_PATH_BLOCKED` | 目标集 pickup + chest + gate；**非移动** hazard 作不可站立禁区（不是 solid）；反事实：去掉 hazard 可达、加禁区不可达 | `target=entity "<id>"`；witness `blocked` |
| `PLAYABILITY_MECHANIC_PATH_NO_SAFE_WINDOW` | 单 danger、全高切面、spawn 与目标异侧；`requiredMs = (d.box.w + player.w)/speed*1000 > strike.periodMs + 1 帧` | `target=entity "<id>"`；witness `blocked` + `blocker:"danger"` / `requiredMs` / `idleMs` |

不注册：巡逻 hazard、moving-platform、被 hazard/danger 包住的收集物、多 danger 联合、同刻约束 —— 均 `INSUFFICIENT_EVIDENCE`。

### 4.3 完成性

| 判据 id | 算法摘要 | 失败定位 |
|---|---|---|
| `PLAYABILITY_COMPLETION_GATE_NOT_REACHABLE_AFTER_COLLECT` | 带标签图 + mask DP（k≤12）；收齐全部必需 pickup/chest 后到 gate；hazard/danger 复位边保留计数；复用 03 的 gate 谓词；03/04 已报根因抑制 | `target=entity "<gate>"`；witness `no-path` |

## 5. 结果模型、集成与分档

- `PlayabilityVerdict` 只活在 contracts 内部；**不**进入 `qa-report.json` / `delivery` / config / 新 zod schema。
- `PROVEN_UNPLAYABLE` → 现有 `ConfigIssue[]`（`severity:"error"`，`where`/`message` 沿用现有格式，**不加 `code`**）。
- `INSUFFICIENT_EVIDENCE` / `NO_PROVEN_BLOCKER` → 不产 `ConfigIssue`。
- 进入 `auditConfigPipeline.deterministic`：编译循环后 / 汇合点硬拒；不重采样、不落盘；退出码仍 `invalid`(4)。
- 发布闸改调 `auditPlayability` 的映射；standalone `assembleSite` 直调仍不过闸（残余风险，明写）。
- QA 仍 7 条，`auditReachability` 与 `auditPlayability` 共用改进后的移动模型；QA 通过只代表 QA 自己的判据通过。
- severity 只由 verdict 派生；警告族（台阶 / 行程）保持 warning，不升级、不参与 verdict；同一 `(target, 根因类)` 只报一条 error。

## 6. 历史语料重判（零误伤基线）

- **清单**：[corpus/inventory.json](corpus/inventory.json)，版本 `level-playability-corpus-inventory/v1`，冻结 `sha256:25e6c891cbb01e456433e104862bc9f03c8404f92fec10acdc93700aca00983d`。
- **范围**：152 份横版 config（21 唯一）、171 份 manifest（90 v4 / 81 旧 schema）、49 设计 / 77 关；结构配对 146；审计可用 150 份 / 96 唯一配对 / 20 唯一 config。
- **结果**（[corpus/rejudgment.md](corpus/rejudgment.md)）：

| 判据 | 结果 |
|---|---|
| 空间 | 新增 0、修复 0；chest 0、embedded 0；spawn 窄口径 0（纯盒重叠 11，均为浅锚点嵌入） |
| 机制 A | 4 命中：3 真实缺陷 + 1 probe 夹具排除；0 合法设计误伤、0 判据不稳；walk 复核后命中不变 |
| 机制 B | 0 命中；唯一 danger 是 probe 夹具且非全高 |
| 完成性 | 有效 gate 的 no-walk 0；8 个配对 no-walk 全部 gate 缺失（2 唯一），归引用族；chest 不可达 0 |

### 已知真实缺陷（不设例外、不重发布）

1. `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/game-config.json` → `pickup-water-4`、`goal-1`；manifest 为 **assetpack/v3**，生产 parser 本就不读，只会在只读归一化下命中；归「历史生产 parser 行为」，不归因于新增判据。
2. `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/site/v1/game-config.json` → `scrap-4/5/6`、`gate-1`；v4，A 启用后会新阻断。
3. `.scratch/visual-design-impl-v1/runs/2026-10-25-e2e-v4pro-promptfix/wasteland-scavenger/run/v1/game-config.json` → `pickup-3`、`chest-1`、`gate`；v4，A 启用后会新阻断。

> 结论措辞：**零不可解释误伤**成立；不是「新增 error = 0」。严格 aggregate 下，多数历史 config 因 coverage 缺口应为 `INSUFFICIENT_EVIDENCE`。

## 7. 合成负例与合法边界矩阵

[test-matrix.md](test-matrix.md) / [matrix.json](fixtures/07-matrix/matrix.json)：39 例，**非生产**。

- 17 `PROVEN_UNPLAYABLE`、18 `NO_PROVEN_BLOCKER`、4 `INSUFFICIENT_EVIDENCE`。
- 覆盖：沟壑、墙 / 高台、chest 封死、BLOCKED、spawn 深埋、越界、静止 hazard 封路、全高 danger、单向坑、双单向岔路、合法顺序、同弧收多物、range 隔墙、悬空目标、复位 hazard、chest/hazard 重叠等。
- 巡逻 hazard、被机制包住的收集物、moving-platform 明确预期 `INSUFFICIENT_EVIDENCE`，不是硬拒。
- 合成矩阵只证明判据会响、合法边界不误伤；不替代 08 的历史语料基线。

## 8. 最小实施方案（已批准方向）

### 8.1 修改面

生产修改面详见 [plan.md](plan.md) §1：contracts 内新增 `playability/{profile,verdict,graph,spatial,mechanic,completion,registry,index}.ts`；改 `reachability.ts`、`config-audit.ts`、`index.ts`、`publish-gate.ts`；`create-game.ts` / `qa/src/gameplay.ts` 不需要改。**无 Runtime 修改、无新机制、无持久化 schema。**

### 8.2 契约候选

| 候选 | 裁定 |
|---|---|
| C1 `auditPlayability` / `playabilityIssues` + 内部类型 | **批准**（contracts 加法导出；不改既有调用者 / `auditConfigPipeline` 返回形状；不加 CLI/MCP 参数或持久化字段） |
| C2 `ConfigIssue.code` | 不采用 / 推迟 |
| C3 持久化 verdict / coverage | 不采用 |
| C4 新增 QA 判据 | 不采用 |
| C5 profile 生产入参 / CLI 参数 | 不采用 |
| C6 manifest 逐帧 atlas 几何 | 不采用 / 后续 effort |

### 8.3 实施序列（Q7 权威表，覆盖 plan.md 旧 LP 编号）

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

**复核点**：LP-00、LP-02、LP-03 后各一次；不通过即停止后续票，不得自动越过。

**未分配项**：`plan.md` 的编译提示词修改（`packages/assets/src/ops.ts`）不在 Q7 表中，按未授权 / 未分配处理；若需要，另立票据。

### 8.4 测试与回退

- 每条判据单测：正例 / 负例 / 合法边界；39 例矩阵转生产测试；冻结语料回归；P1–P4 缺口测试；集成与确定性测试。
- 回退：每票可独立 revert；判据级用 `PLAYABILITY_DISABLED` 关闭，且必须可审计、不得报告已通过、不得掩盖历史误伤、不得全部关闭伪造验收。
- 分支 `p1/level-playability-v1`；一票一 commit；LP-02 后 Draft PR，LP-07 后正式 PR；不自动合并；不推 `main`；推送经 `127.0.0.1:7890`。

## 9. 审批裁定汇总（Q1–Q10）

| 问题 | 裁定 |
|---|---|
| Q1 规格 | 批准 |
| Q2 契约候选 | 仅 C1 |
| Q3 P1–P4 | 全部批准进入规格；Runtime 证据是硬前提 |
| Q4 三条历史缺陷 | 已知真实缺陷，不设例外 |
| Q5 QA 行为 | 接受变化，统一移动模型 |
| Q6 R1 / R21 | 两项批准 |
| Q7 实施授权 | LP-00…LP-07 串行，三个复核点 |
| Q8 票据 / 分支 / PR | 一票一 commit；分支 + Draft/正式 PR；不自动合并 |
| Q9 付费 | 全程零付费 |
| Q10 图关闭 | 关闭 |

## 10. 已知限制与未证明

- **未证明可玩**：`NO_PROVEN_BLOCKER` 不是「可玩」；本图没有运行真实试玩来验证。
- **仍为 `INSUFFICIENT_EVIDENCE`**：巡逻 hazard、moving-platform、被 hazard/danger 包住的收集物、多 danger 联合、`k>12`、负坐标目标、mid-air touch-only、spawn-no-foothold、逐帧 atlas 几何、P1–P4 未获证据时的相关判据。
- **残余风险**：`assembleSite` 直调不过闸；QA standalone 看不到机制 / 完成性 error；`auditReachability` 与 QA detail 会随统一移动模型变化。
- **历史缺陷**：3 条已知真实缺陷；其中 2 条 v4 会在 A 启用后新阻断，1 条 v3 只归历史 parser 行为。
- **明确排除**：Runtime 修改、新 EntityKind / Motion / 机制、斜坡 / 非 AABB、逐帧 atlas、设计层布局坐标、持久化 Playability schema、QA 第 8 条、CLI/MCP 新参数、C2–C6、付费验证。

## 11. 实施交接

- **下一 effort**：`p1/level-playability-v1`（独立地图 / 票据，不复用本图）。
- **入口**：本报告 + [plan.md](plan.md) + [test-matrix.md](test-matrix.md) + [corpus/rejudgment.md](corpus/rejudgment.md) + 冻结清单。
- **第一张票**：LP-00（Runtime 语义核验）；未完成 P1–P4 证据档案前，不得进入 LP-01。
- **停止线**：LP-00 不能证明的 Runtime 语义，对应判据保持 `INSUFFICIENT_EVIDENCE`；不得把未知假设变成确定性规则。
