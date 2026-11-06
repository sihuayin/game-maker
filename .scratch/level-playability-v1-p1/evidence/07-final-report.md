# Level Playability V1 — 最终验收报告

- **Date**：2026-11-06
- **Effort**：`level-playability-v1-p1`（LP-00 ～ LP-07）
- **Branch / PR**：`wayfinder/level-playability-v1` → `main`；Draft PR #28 已转正式 PR
- **Baseline**：生产代码 `main` @ `fa17c14`；本分支保留完整实施与复核历史
- **Nature**：零付费（无模型调用、无生图、无站点重建、无新付费 Demo）；未合并、未推送 `main`
- **Map**：[Level Playability V1 P1：LP-00～LP-07 实施与验收](../map.md)（已关闭）

> **核心语义**：`NO_PROVEN_BLOCKER` **不等于**「可玩」；`INSUFFICIENT_EVIDENCE` 不等于「不可玩」；
> 只有 `PROVEN_UNPLAYABLE` 产 `ConfigIssue` 并硬拒。最终报告不以「零 error」宣称可玩。

---

## 0. 结论

LP-00 ～ LP-07 全部完成；三层可玩性判据（空间 / 机制 / 完成性）已接入 `deterministic` 与 Publish Gate；
冻结语料与 39 例矩阵完成验收；三次强制复核（LP-00 / LP-02 / LP-03）通过。

**验收结论**：AC-01 ～ AC-09、AC-11 PASS；**AC-10 PASS_WITH_KNOWN_LIMITATION**（Vitest runner 残余）；
**AC-12 PASS**（正式 PR 与本报告完成后成立）。无未解释的新增误阻断；无未经批准的范围扩展。

**双口径必须并陈**：

| 口径 | PROVEN | NO_PROVEN | INSUFFICIENT |
|---|---|---|---|
| 39 例矩阵层内 / 案例级预期 | **19** | **16** | **4** |
| 实际 `auditPlayability` 组合 | **19** | **9** | **11** |

差异为 7 个带合法宽巡逻 `carriage` 的空间边界（baseline / gap-40 / wall-40 / pickup-50 /
chest-range30 / pickup-on-luggage / target-at-edge）。LP-03 已批准「巡逻 hazard 一律
`INSUFFICIENT_EVIDENCE`」；空间层对它们是 `NO_PROVEN_BLOCKER`，整关组合把覆盖缺口记为证据不足。
**不是新增误报，也没有硬拒合法设计。**

---

## 1. 阶段与 commit

| 阶段 | Commit | 内容 |
|---|---|---|
| LP-00 | `8b6efbb` / `e3d8929` | Runtime 语义证据 + 复核 PASS WITH BOUNDARIES（P4 降级） |
| LP-01 | `dafc53e` | 统一 Runtime geometry profile + 共享移动图（AABB / Solid / Walk-Fall / hop） |
| LP-02 | `523881d` / `cbc93a8` | 空间判据 + mid-air touch-only 保守降级（复核 `1350639`） |
| LP-03 | `1a5c369` | 机制 A（静止 hazard 禁区 + 反事实）/ B（全高 danger 安全窗口）+ 复核 `81febb2` |
| LP-04 | `d152630` | 完成性 mask DP + 复位边 + 跨层抑制 |
| LP-05 | `ec078b1` / `ca096cf` | fall 边修复 + `auditPlayability` / deterministic / Publish Gate 接线 |
| LP-06 | `203ad8a` | 96 配对 / 20 config + 39 例矩阵双口径验收 |
| LP-07 | 本 commit | 最终报告 + 收口 + 正式 PR |

三次强制复核：[LP-00](../issues/02-lp00-review.md) · [LP-02](../issues/05-lp02-review.md) · [LP-03](../issues/07-lp03-review.md)。

---

## 2. AC-01 ～ AC-12 验收

| AC | 状态 | 依据 |
|---|---|---|
| AC-01 Runtime 语义 | **PASS** | P1 带边界 `CONFIRMED`、P2/P3 `CONFIRMED`、P4 `CONTRADICTED` → `SPAWN_IN_TERRAIN` 仅诊断 |
| AC-02 几何模型 | **PASS** | `playability-geometry` 10 例 + `playability-graph` 11 例；AABB / Solid / Walk-Fall |
| AC-03 空间可达性 | **PASS** | `playability-spatial` 46 例；mid-air 保守降级；矩阵 23 例 |
| AC-04 机制可通行性 | **PASS** | `playability-mechanic` 25 例；3 条历史真实缺陷识别；非法危险机制降级 |
| AC-05 关卡完成性 | **PASS** | `playability-completion` 23 例；mask DP（k≤12）、复位边、gate 收齐后命中 |
| AC-06 三态模型 | **PASS** | 三态聚合；`INSUFFICIENT_EVIDENCE` 不产 issue；`NO_PROVEN_BLOCKER` 不写成可玩 |
| AC-07 Pipeline | **PASS** | `deterministic` + Publish Gate 接线；不可玩 config 退 4、站点不产；非阻断不改变流程 |
| AC-08 历史回归 | **PASS** | 96 唯一配对 / 20 唯一 config + 39 例矩阵；双口径已由用户裁定 (A) |
| AC-09 误报控制 | **PASS** | 0 playability 误报；3 条历史真实缺陷已知；7 个合法边界仅落 INSUFF |
| AC-10 工程质量 | **PASS_WITH_KNOWN_LIMITATION** | 2550 例测试通过、build/typecheck exit 0；Vitest runner RPC workaround 仍在（§6） |
| AC-11 范围约束 | **PASS** | 无 Runtime / CLI / MCP / 依赖扩展；C1 加法导出；范围审计见 §5 |
| AC-12 交付审查 | **PASS** | 正式 PR #28 + 本报告 + 回退说明；用户批准收口 |

---

## 3. 冻结语料回归

**口径**：inventory `sha256:25e6c891…`（脚本复算通过）；usable 150 份 config →
**96 唯一配对 / 20 唯一 config / 31 唯一内容组合**。

| 结果 | 数量 |
|---|---|
| 配对级 PROVEN / INSUFF / NO_PROVEN | 36 / 36 / 24 |
| 唯一 config 机制 A 历史真实缺陷 | **3** |
| 唯 config 既有审计 error（非 playability） | 5 |
| 唯 config playability `INSUFFICIENT` | 11（6 移动 hazard + 5 既有审计 config） |
| **新增 playability 误报** | **0** |
| probe 夹具排除 | 6 |

**3 条历史真实缺陷**（不重发布旧 run/pack）：

1. `pickup-water-4` / `goal-1`（`run-out-2026-10-13h/.../ruined-city-scavenger`）
2. `scrap-4/5/6` / `gate-1`（`run-out-2026-10-17d` / `10-18a` 同 contentHash）
3. `pickup-3` / `chest-1` / `gate`（`visual-design-impl-v1/.../e2e-v4pro-promptfix`）

- 5 份既有审计 error（2 gate 缺失 + 3 chest 引用）归引用族 / 自洽族，不是 playability 新阻断。
- 6 份移动 hazard 的 level config 保持 `INSUFFICIENT_EVIDENCE`（`moving-hazard-phase`），未硬拒。
- 6 个 probe 夹具（hazard-contact、avoid-danger、collect-pickup、open-chest、`__probe*` 副本）排除。

**研究阶段结论保持**：空间 0 新增 / 0 修复；机制 A 3 条真实缺陷 + 1 probe；完成性有效 gate no-walk 0；
`k` 最大 9（≤12）。

---

## 4. 39 例矩阵

| 层（层内发现） | PROVEN | NO_PROVEN | INSUFFICIENT |
|---|---|---|---|
| spatial（23） | 13 | 8 | 2 |
| mechanic（6） | 3 | 1 | 2 |
| completion（10） | 1 | 7 | 2 |
| **案例级最终归因** | **19** | **16** | **4** |
| **实际 `auditPlayability` 组合** | **19** | **9** | **11** |

### 4.1 跨层归因

- **#32 `two-one-way-branches`**：空间层 gate 不可达（x=180..200 全高墙）⇒ 整关 PROVEN；完成性抑制。
- **#39 `chest-overlapping-hazard`**：同一 64×48 hazard 封死 gate ⇒ 机制层 A PROVEN；完成性抑制。
- **#21 / #22**：既有 `auditGameConfig`（spawn-in-solid / inWorld）硬拒。
- **#19 / #20 / #25 / #29**：4 个 `INSUFFICIENT`（spawn 诊断 2、巡逻 hazard 1、moving-platform 1）。

### 4.2 逐条修正

- **#4 `wall-100`**：goal `signal` 的 SUBJECT 应为 `GATE`，不是 `PICKUP`；同墙也封死 suitcase-2/3。
- **#12 `chest-range-rescues`**：原研究只检查 chest；gate 在 100px 沟对面，空间层 gate 不可达。
- **#19 `spawn-deep-terrain`**：LP-00 复核 P4 覆盖 ⇒ 只观察，`INSUFFICIENT`。
- **#28 `pickup-in-static-hazard`**：被包住 pickup 仍 gap；同一 hazard 封死其后目标 ⇒ 整关 PROVEN 归机制层。
- **#39 `chest-overlapping-hazard`**：整关 PROVEN 归机制层；完成性抑制。
- **有效 gate no-walk = 0** 保持。

### 4.3 合法边界

所有矩阵负例的合法配对未被硬拒；7 个被机制 gap 降级的合法边界仅从 `NO_PROVEN` 变成
`INSUFFICIENT`（覆盖缺口），没有变成 `PROVEN_UNPLAYABLE`。

---

## 5. Runtime / 几何边界与范围审计

### 5.1 Runtime geometry profile

- `collisionBox = entityBox(at, body ?? size, manifest.anchor)`，全仓唯一（`entityBox`）。
- **solid / chest / danger** 消费 `body`；**pickup / hazard / goal** 用运行时图集帧几何，**忽略 `body`**。
- chest 交互盒 = 实体盒**四边**外扩 `range`，与玩家盒**严格 AABB** 相交，不要求落地。
- solid 的 `motion` 按**静态原位**（运行时从不推进）；hazard 的 `body` 被忽略；hazard 顶不是地板。
- 玩家 / 帧几何不可由审计输入复核 ⇒ `coverage.partial`；`partial` 不阻止确定性阻断，但独立暴露。
- **出生点**：Runtime 无专用分离语义（P4 被源码推翻）⇒ `SPAWN_IN_TERRAIN` 只诊断，永不硬拒。
- **mid-air touch-only**：存在不撞实心体、不要求落地的弧时，不判 `UNREACHABLE`，降为
  `INSUFFICIENT_EVIDENCE`；该弧不写进可达集。

### 5.2 范围审计

**未越界**：

- 未修改 Runtime 行为（`packages/demo` 生产源码 0 改动）。
- 未新增 CLI / MCP 参数（CLI / MCP src 0 改动）。
- 未新增依赖（`package.json` / lockfile 0 改动）。
- 未修改历史版本产物（`run/**` / `pack/**` / `site/**` 0 改动）。
- C1 加法导出：`contracts/src/index.ts` 仅新增 `export * from "./playability/api.js"`。
- `CONTEXT.md` 新增的是领域词汇表（可玩性判定 / 三层 / Verdict / FixedRuntimeProfile），不是 schema。
- 唯一 `fixtures/**` 改动是测试夹具 `fixtures/upstream/canned.json`（按设计补巡逻 motion），不是历史产物。
- 生产修改面：`contracts` 的 `playability/**`、`reachability.ts`、`config-audit.ts`、`index.ts` 一行；`pipeline/src/publish-gate.ts`。

### 5.3 分支偏差（用户批准）

PRD §6.1 原定分支为 `p1/level-playability-v1`。实施过程中经用户批准，沿用
`wayfinder/level-playability-v1` 作为实施分支及 PR #28 head，保留原 commit 与审查历史。
该偏差不构成功能范围或架构边界变更。

---

## 6. 工程质量与已知限制

### 6.1 测试 / 构建证据

- `pnpm build` → exit 0
- `pnpm typecheck` → exit 0
- `pnpm test` → **168 文件 / 2550 例通过，exit 0**
- 契约测试：45 文件 / 963 例
- 语料 / 矩阵脚本：`acceptance-corpus.mjs` / `acceptance-matrix.mjs` 均 exit 0

### 6.2 AC-10 已知限制（PASS_WITH_KNOWN_LIMITATION）

- Vitest 版本 **3.2.7**。
- 长集成测试文件偶发 `[vitest-worker]: Timeout calling onTaskUpdate`；这是 **runner 通信超时**，
  不是业务测试失败。
- 当前 workaround：`vitest.config.ts` 的 **20s testTimeout** + **`dangerouslyIgnoreUnhandledErrors`**。
- **不能**把忽略 unhandled errors 解释为已解决 runner 问题；当前状态保留为已知工程残余。
- 后续交接：LP-07 后移除 workaround，评估升级 Vitest 或拆分长集成测试文件。

### 6.3 未证明 / 已知限制

- `NO_PROVEN_BLOCKER` 不是「可玩」；`INSUFFICIENT_EVIDENCE` 不是「不可玩」。
- 巡逻 hazard、moving-platform、被 hazard/danger 包住的目标、多 danger、非全列 danger、
  `k>12`、负坐标目标、mid-air touch-only、逐帧 atlas 几何、spawn-no-foothold：V1 不硬判。
- **7 个带合法宽巡逻 hazard 的空间边界在整关组合里是 INSUFF**（覆盖缺口），不是误报。
- `assembleSite` / `assembleFromConfig` 直调仍不过发布闸（既有边界，未改）。
- QA standalone 只跑 `auditReachability`（空间层）；机制 / 完成性 error 只在 `deterministic` /
  发布闸出现。
- 3 条历史真实缺陷 + 1 probe 会被机制 A 硬拒；已知、不设例外、不重发布旧 run/pack。
- `auditPlayability` 在 last-train 上约 0.9s；编译链因此变慢（测试超时 workaround 的成因之一）。

---

## 7. 回退点

| 范围 | 回退 |
|---|---|
| LP-01 几何 | `dafc53e`（纯加法） |
| LP-02 空间 | `523881d` / `cbc93a8`（纯加法 + 等价 hop 重构） |
| LP-03 机制 | `1a5c369`（纯加法 + 共享 reach/targets 抽取） |
| LP-04 完成性 | `d152630`（纯加法 + `full` 选项 / witness 可选字段） |
| LP-05 集成 | `ca096cf`（deterministic / 发布闸 / C1 导出）；`ec078b1` 单独回退 fall 边修复 |
| LP-06 证据 | `203ad8a`（只读脚本 / 证据） |
| LP-07 收口 | 本 commit（报告 / 地图 / PR 记录） |

- 判据级回退：删除对应层 / 恢复 `deterministic` 只调 `auditReachability`；**不得**用「全部关闭」伪造验收。
- **不合并 PR、不推送 `main`、不自动关闭 PR。**

---

## 8. 证据索引

- Runtime 语义：[research/01-runtime-semantics.md](../research/01-runtime-semantics.md)
- 三次复核：[LP-00](../issues/02-lp00-review.md) · [LP-02](../issues/05-lp02-review.md) · [LP-03](../issues/07-lp03-review.md)
- 语料 / 矩阵：[06-corpus-acceptance.md](06-corpus-acceptance.md)、`06-corpus-regression.json`、`06-matrix-acceptance.json`
- 实施：[LP-01](../issues/03-lp01-geometry.md) · [LP-02](../issues/04-lp02-spatial.md) · [LP-03](../issues/06-lp03-mechanic.md) · [LP-04](../issues/08-lp04-completion.md) · [LP-05](../issues/09-lp05-pipeline.md) · [LP-06](../issues/10-lp06-corpus.md) · [LP-07](../issues/11-lp07-closeout.md)
- PR：[#28](https://github.com/sihuayin/game-maker/pull/28)
