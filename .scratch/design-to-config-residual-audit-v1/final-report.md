# Design-to-Config Residual Gap Audit V1 — 最终报告（P0-A / P0-B 收口）

- **日期**：2026-11-03
- **输入（只读冻结）**：`docs/v7.7/配置.md`（v7.7 PRD，原文不改）
- **裁定记录**：[rulings-2026-11-02.md](rulings-2026-11-02.md)
- **状态**：P0-A 审计与 P0-B 方案完成，**停在 P1 审批门前**；未进入实施。

---

## 0. 结论摘要

1. **五个历史错误今天仍全部被拦截**，但拦截分档已从 2026-10-23 的「校验不过 → 不重采样 → 不落盘」变为「判模型错 → 3 发重采样 → `invalid`(4) → 不落盘、不消耗版本号」。五个错误是**回归证据**，不是五项待实现功能。
2. **残余缺口成立**：A 类 7 项、B 类 4 组、D 类 2 项、**C 类 0 项**。因此**不接受**「现有能力足够、无需新增生产代码」。
3. **P0-B 最小方案**已形成：修改面 7 个文件，不新增包、不改 Runtime、不新增依赖；需要两项 P1 单独批准的契约变更。
4. 全程**零付费、零模型调用、零生图**；未修改任何生产代码、契约、CLI/MCP 或历史冻结证据。

**一句话结论：链路能拦住历史五错，但对「五错同族的其余形态」拦得窄、对人工改配置/清单的复验拦得漏、对设计合法输出与 config 强制条件的矛盾拦得晚；这七处值得修，方案已备，待 P1 批准。**

---

## 1. 问题定义修订

**PRD 原定义**：「Design、Asset Manifest、Visual Design 和 GameConfig 之间缺少语义校验」。

**修订后的定义**（2026-11-02 用户裁定，本图硬约束）：

> 检查现有 Design → Asset Planning → GameConfig → Runtime 链路中的语义约束是否**完整、一致**，并识别当前仍然存在的**资源规划缺口、配置校验缺口和审计反馈缺口**。

两点必须同时成立：

- 历史日志证明五错在当时**已被捕获**，系统行为正确；之后 `recipe-config-gap-v1` 又补了 `hudUiGate`、`solid → sprite` 锁与审计重采样循环。
- 因此本图先**证明问题是否仍存在**，再决定是否修复；允许结论为「无需新增生产代码」（但本次裁定为**不成立**）。

---

## 2. 审计方法与证据分级

| 级别 | 含义 | 本图用法 |
|---|---|---|
| **E0** | 推测 | 不作为结论依据 |
| **E1** | 源码 | 调用链、判据覆盖、绕过路径 |
| **E2** | 测试 | 既有正/负用例；本次收口复跑 |
| **E3** | 真实产物 + 运行证据 | 历史日志重放、语料扫描、产物矩阵 |

**方法**

1. 两条并行只读研究票：下游校验链路（票 01）与上游规划闭环（票 02）。
2. 历史证据：重放 `.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/stage-b.log` 的五条硬失败，用当前 `compileRuntime` 重建同一份坏配置（E3）。
3. 语料扫描：`out/**`、`fixtures/**`、`.scratch/**` 下的 120 份 `game-config/v1`、全量 manifest / recipe / design。
4. 收口复跑（2026-11-03）：7 个相关测试文件，`185 passed`，exit 0。

---

## 3. 五错误回归证据现状

| 编号 | 历史形态 | 今天是否拦截 | 当前实现 | 现有回归测试 | 同形态？ |
|---|---|---|---|---|---|
| E01 | `block-1` solid 用玩家 animation | **是** | `solid → sprite` 锁，先于 `resolvePackRef`（`contracts/src/game-config.ts:317-327,370-372`） | `game-config.test.ts:181-185`，断言 `/是 animation，这里要的是 sprite/` | 同槽位同错误类 |
| E02 | `slope-1` 同 E01 | **是** | 同 E01；GameConfig 无独立 slope 槽位 | **无 `slope-1` 独立用例** | 同实现，无独立用例 |
| E03 | `hud.panel` 用 chest sprite | **是** | `hud.panel → ui`（`:373`） | 横版只测 `animation → ui`；塔防才测 `sprite → ui` | **不同形态**，无端到端用例 |
| E04 | `hud.pip` 用 resource-item sprite | **是** | `hud.pip → ui`（`:374`） | **无负向测试** | 缺失 |
| E05 | panel 72×32 vs chest 32×24 非九宫格 | **是** | `auditPanelSize`（`:404-425`，调用 `:479`） | `game-config.test.ts:439-444` | 同形态 |

**当前失败分档（E3）**：五条全部进入 `modelHard`（`assets/src/ops.ts:1193-1207`）→ 3 次文本调用、3 次判「模型错」→ `invalid`(4)，**不落盘、不消耗 `game-configs` 版本号**。历史日志的「不重采样」只对 2026-10-23 当时成立。

**检测面**：E01–E04 在 `compileRuntime` / QA `reference-resolution` / site / `reuseConfig` 可见；**E05 在 QA 与 `reuseConfig` 不可见**（`auditPanelSize` 不在 `auditReferences` 内）。

---

## 4. 残余缺口裁定结果

| 问题 | 缺口 | 类别 | 去向 |
|---|---|---|---|
| Q1 | `pickup/hazard/goal/chest/danger` 无 asset-kind 锁 | **A** | 05 |
| Q2 | `sprite` 内部无可机读语义分类，`role` 无人读 | **B** | Out of scope |
| Q3 | `chest/danger` 不要求状态帧 | **A** | 05 |
| Q4 | 九宫格最小尺寸/边框适配未校验 | **A** | 05 |
| Q5 | `reuseConfig` 与人工改清单后的 `runBuild` 复验绕过 | **A** | 05 |
| Q6 | `hud` 必填 vs `hudUiGate` 条件；`resources: []` vs 要求 pickup/chest | **A** | 05 |
| Q7 | `reachability` 只在 QA 跑 | **B** | Out of scope |
| Q8 | 四桶覆盖闸只查 id/characterId、不查 kind | **A**（原建议 C，用户修正） | 05 |
| Q9 | `modelHard` 归因、盲重采样、viewport/role 未贯通 | **D** | 另立 effort |
| Q10(a)(b)(c) | 地形仅提示词线索、layout 散文、斜坡无槽位 | **B** | Out of scope |
| Q10(d) | 设计无 goal 桶 vs `objective.gate` 必须指向 goal | **D** | 另立 effort |
| Q10 补充 | `interactables` 同桶误归属；`decor` 不加 kind 锁 | **B** | Out of scope |
| Q11 | E02/E03/E04 测试形态缺失 | **A** | 05 |

**Q8 的修正理由（用户裁定）**：下游 kind 锁在资源生成**后**拦截，覆盖闸在付费生图**前**拦截；阶段不同、不可互相替代。Q8 是**加强既有覆盖闸**，不是新增独立资源规划闸门。

---

## 5. P0-B 方案摘要

**修改面**：`contracts` 3 个文件 + `assets` 3 个文件 + `pipeline` 1 个文件。

| 项 | 最小修改 | 落点 |
|---|---|---|
| Q1 | `ENTITY_ASSET_KINDS` 单一来源；实体循环加 kind 锁 | `contracts/src/game-config.ts:370-374` |
| Q3 | `chest`/`danger` 解析后帧数 `< 2` ⇒ error | 同上 |
| Q4 | 九宫格：中央区须放得进资源；声明尺寸 ≥ 边框和 | `contracts/src/game-config.ts:404-425` |
| Q5 | 新 `auditConfigPipeline`；`compileRuntime` 与 `runBuild` 汇合点同调 | `contracts/src/config-audit.ts`（新）、`pipeline/src/create-game.ts:610-612` |
| Q6a | `hudUiGate` 与提示词**无条件**要求两件 ui | `assets/src/ops.ts:300-314`、`assets/src/prompt.ts:919` |
| Q6b | `GameDesignSpecSchema` 要求 `resources ≥ 1` | `contracts/src/game-design.ts` superRefine |
| Q8 | `designCoverageGate` 加 kind 检查；桶→kind 由 `DESIGN_BUCKET_KINDS` 派生 | `assets/src/ops.ts:266-286`、`contracts/src/game-config.ts:534-539` |
| Q11 | 22 条正/负/边界测试；不新增 fixture 文件 | 见票 05 §5 |

**零付费验证**：6 个测试文件复跑 + 只读语料重判。当前语料新增 error 预期 = 0；冻结历史恰出 81 条 chest 状态帧（判据真实响的证据，不重写）。

**语料自证**：Q1 0/120 误伤；Q4 0 处越界；37/37 设计都声明 HUD 且资源非空；真实清单中 enemies/interactables/resources 只出现 `sprite`/`animation`。

---

## 6. 证据状态分区

### 已由测试证明（E2）

- 五错误今天仍被拦截：`packages/contracts/tests/game-config.test.ts`（kind 锁与面板尺寸用例）；2026-11-02 研究轮 151 tests passed，2026-11-03 收口复跑 185 tests passed。
- 规划期各闸存在且在重采样循环内：`plan-coverage-gate.test.ts`、`plan-hud-gate.test.ts`、`plan-background-gate.test.ts`、`plan-assets-player-gate.test.ts`、`compile-runtime.test.ts`。
- `reuseConfig` 当前只做 schema + 引用校验：`pipeline/tests/create-game.test.ts:140-150`。

### 已由源码证明（E1）

- 五类实体槽位无 kind 锁；`decor` 无锁；锁只锁格式不锁语义。
- 两条复验路径的绕过范围（`create-game.ts:482-489`、`:517-525`）。
- `hudUiGate` 只在 `hud:screen-space` 时触发，而 `hud` 结构必填。
- 设计提示词允许 `resources: []`，而 config 要求 ≥1 pickup/chest。
- 覆盖闸只查 id/characterId；桶→EntityKind 矩阵存在但未用于 kind。
- 五错误全部落在 `modelHard` 重采样档。

### 已由真实产物/运行证明（E3）

- 五错在当前实现下的真实失败分档（3 发、`invalid`(4)、不落盘）。
- 语料矩阵：120 份 config 的实体 kind 分布、81 处历史 chest 单帧、23 份横版 + 塔防配置的九宫格下界 0 违反、37 份设计的 HUD/资源声明、真实清单的桶→kind 分布。
- 历史日志路径：`.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/stage-b.log`。

### 未验证

- **所有拟议修改的行为**：本图未修改任何代码，新判据没有任何一条被实现或测试。
- 付费链上的真实表现（`create` 全链、图像生成、模型重采样）——本图按约束未跑。
- 多关卡：`BuildInput` 无 `levelId`，`runBuild` 复验将固定用 `levels[0]`；多关卡场景未验证。
- site 装配期是否还有第三套校验口径 —— 本图未把 site 纳入复验范围。
- 塔防路径：新增设计 schema 约束只影响平台跳跃设计链（TD 走 requirement 文本，不读 design）；TD 对新判据的实际体验未跑。
- Phaser 之外渲染路径（Canvas 渲染器画不出 NineSlice，既有已知项）。

---

## 7. P1 审批问题清单

1. **是否确认残余缺口值得修复**？A 类 7 项均有源码/产物证据与确定性测试判据；若否决，需说明哪一项证据不成立。
2. **是否批准两项契约变更**？
   - `ConfigIssue.code?: ConfigIssueCode`，闭集三码 `entity-asset-kind` / `entity-state-frames` / `hud-panel-size`；只给新增/加强的错误写码，不 retrofit 47 个历史构造点，不扩展 `QAFinding`。
   - `GameDesignSpecSchema` 要求 `resources ≥ 1`（设计契约变更）。
3. **是否需要修改上游资源规划**？本图结论：**不需要新增 `plan-assets` 闸门**；只加强既有覆盖闸（Q8）并修正 HUD 闸的触发条件（Q6a）。
4. **最小实施范围是否仍成立**？修改面 7 个文件、不新增包、不改 Runtime、不新增依赖；Q1/Q8 两张表由现有 `DESIGN_BUCKET_KINDS` 派生。
5. **是否批准进入 P1，以及批准到哪一步**？建议按 Q1+Q3+Q4 → Q5 → Q6 → Q8 → Q11 的顺序实施；P1 不得顺手扩大到 B/D 类。

---

## 8. 交付物索引

| 交付物 | 路径 |
|---|---|
| 地图（目的/裁定/决策） | [map.md](map.md) |
| 冻结裁定（开图前三轮） | [rulings-2026-11-02.md](rulings-2026-11-02.md) |
| 下游审计 | [issues/01-downstream-validation-audit.md](issues/01-downstream-validation-audit.md) · [research/01-downstream-audit.md](research/01-downstream-audit.md) |
| 上游审计 | [issues/02-upstream-planning-audit.md](issues/02-upstream-planning-audit.md) · [research/02-upstream-audit.md](research/02-upstream-audit.md) |
| ConfigIssue A/B 评估 | [issues/03-configissue-conditional-code.md](issues/03-configissue-conditional-code.md) |
| 残余缺口裁定 | [issues/04-residual-gap-ruling.md](issues/04-residual-gap-ruling.md) |
| P0-B 最小方案 | [issues/05-p0b-minimal-plan.md](issues/05-p0b-minimal-plan.md) |
| 本报告 | `final-report.md` |
| 历史日志 | `.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/stage-b.log` |
| 关键 fixture | `fixtures/packs/last-train/v2/manifest.json` · `fixtures/e2e/wasteland-platformer/` |
| PRD | `docs/v7.7/配置.md` |

---

## 9. 自检

| 项 | 结果 |
|---|---|
| 零付费 / 零模型调用 / 零生图 | ✅ 全部验证只用既有 fixture、mock transport、真实产物重判 |
| 未修改生产代码 | ✅ `git status --porcelain` 仅 `.scratch/design-to-config-residual-audit-v1/` 与既有未跟踪的 `docs/v7.7/` |
| 未修改契约 / CLI / MCP | ✅ |
| 未修改历史冻结证据 / 未改写验收结论 | ✅ 历史产物只读重判 |
| 未覆盖 run/pack/site 版本 | ✅ 未执行构建链 |
| 未推送 main / 未提交 | ✅ 本次未 commit、未 push |
| 收口测试 | ✅ 2026-11-03 `pnpm exec vitest run` 7 文件，**185 passed**，exit 0 |

---

## 10. 未解决与已知限制

- `interactables` 同桶误归属（如 `gate → chest`）：`entity-identity-v1.1` 已裁定的 C 路线限制，冻结。
- `decor` 不加 kind 锁：v7 真配置同时使用 animation/sprite/ui，冻结。
- `sprite` 内部语义（地形/道具/角色）与 `role` 消费：需要清单级语义分类，B 类。
- `reachability` 只在 QA：B 类。
- layout 散文 → 结构化地形/道具需求、地形仅提示词线索并允许退化、斜坡无独立槽位：B 类。
- 设计无 goal 桶与 `objective.gate` 的契约冲突：D 类，另立 effort。
- 上游诊断归因、盲重采样、`viewport`/`role` 贯通：D 类，另立 effort。
- 多关卡 `levelId` 贯通：本图未验证；若进入 P1，需在 `BuildInput` 明确关卡身份。
- site 装配期口径未纳入本次复验范围。

---

## 11. 停止线

本报告完成 P0-A 与 P0-B 的全部交付。**不自动进入 P1**；是否实施、实施范围与两项契约变更，由用户按第 7 节逐项批准。
