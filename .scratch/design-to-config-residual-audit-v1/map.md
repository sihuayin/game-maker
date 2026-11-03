# Design-to-Config Residual Gap Audit V1：P0-A 审计与 P0-B 方案

Labels: wayfinder:map
Tracker: local-markdown
Effort: design-to-config-residual-audit-v1

> **本图 2026-11-02 开。** 输入：`docs/v7.7/配置.md`（v7.7 PRD，**只读冻结**，原文不改）。
> **本图 2026-11-03 收口**：6 张票全部裁定，最终报告 [final-report.md](final-report.md)；停在 P1 审批门前。
>
> **2026-11-03 P1 已批准并实施**：全量七项 + 两项契约变更；见 [`design-to-config-residual-audit-v1-p1`](../design-to-config-residual-audit-v1-p1/map.md)。
>
> **本图不是原 PRD 的实现图。** 现状核查（2026-11-02，E1 源码 + 历史日志）证明：2026-10-23
> P0-FINAL 的五个硬错误**当时全部已被现有审计捕获**，运行按预期拒绝、不重采样、不落盘；
> 此后 `recipe-config-gap-v1` 又落地了 `hudUiGate`、`solid → sprite` kind 锁与审计重采样循环。
> ⇒ 五个历史错误是**回归证据**，不是五项待实现功能；本图先证明问题是否仍存在，再决定是否修复。
>
> **裁定（用户 2026-11-02，逐字见 [rulings-2026-11-02.md](rulings-2026-11-02.md)）**：
> Q1 终点 = **(a) P0-A + P0-B，停在 P1 审批门前** · Q2 靶子 = **(a) 以审计重定** ·
> Q3 契约 = **(a) 仅考虑可选 `code`，独立票比较 A/B** · Q4 边界 = **(a) 下游为主，证据决定是否碰上游** ·
> Q5 付费 = **全程零付费** · Q6 已知限制 = **明确 Out of scope** ·
> Q7 审计切票 = **(b) 上下游两张并行 + 综合** · Q8 缺口判定 = **(a) HITL grilling** ·
> Q9 A/B 比较 = **(a) 独立票** · Q10 方案/收口 = **(a) 分开**。
>
> **硬约束**：允许最终结论为「现有能力足够、无需新增生产代码」；不以代码量衡量本图是否成功。

## Destination

在 P1 审批门前交付 **Design-to-Config Residual Gap Audit V1**：以当前源码与历史证据重新确认
五类错误是否仍未被可靠拦截，产出 **P0-A 事实审计**（下游校验链路 + 上游规划闭环）与
**P0-B 最小方案**（真实残余问题、源码/历史证据、修改面、测试矩阵、零付费验证、风险、Out of scope）。
**允许结论为「现有能力足够、无需新增生产代码」；本图不修改生产代码、不改变契约、零付费。**

## Notes

### 权威与输入

- PRD（只读）：`docs/v7.7/配置.md`。
- 裁定（冻结输入）：[rulings-2026-11-02.md](rulings-2026-11-02.md)。
- 领域词汇：`CONTEXT.md` 是唯一权威；本图不新增同义词。
- Tracker：local-markdown（`.scratch/design-to-config-residual-audit-v1/`）。

### 现状事实（2026-11-02 开图前核查，E1 源码 + 历史日志）

- `.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/stage-b.log`：五个错误当时**全部已被
  现有审计捕获**；失败形态是「校验不过 → 不重采样 → 不落盘」（**当时**的保护行为）。
  ⚠️ **今天已不同**：五条全部进入 `modelHard` 重采样循环（`ops.ts:1193-1207`），实际是 3 次文本调用、
  3 次判「模型错」后抛 `invalid`(4)，仍不落盘、不消耗版本号（下游审计 E3 复现）。
- 已落地（`recipe-config-gap-v1`）：票 04 `hudUiGate`（设计声明 HUD 时清单须产 ui 面板 + 图标）、
  票 05 `solid → sprite` kind 锁（E01/E02 现报「是 animation，这里要的是 sprite」）、
  票 10 把引用/自洽/HUD 屏幕空间三族审计移进重采样循环。
- 当前 `auditReferences` 已有 kind 锁：`player→animation`、`solid→sprite`、`hud.panel/pip→ui`、
  `background→background`；**其余 kind（pickup/hazard/chest/goal/danger/decor）没有锁**。
- `ConfigIssue` 只有 `{severity, where, message}` —— FR-06 的其余字段是契约变更。
- 「斜坡」在 GameConfig 中**不是独立槽位**，只能是 `solid`；PRD 槽位表与「以真实 Runtime 能力为准」有张力。
- 同桶误归属（`interactables: gate→chest`）是 `entity-identity-v1.1` 已裁定的已知限制（C 路线）。

### 前序地图（只引用，不重开）

- [`recipe-config-gap-v1`](../recipe-config-gap-v1/map.md)：HUD ui 资源、地形 prop、solid kind 锁、重采样。
- [`entity-identity-v1.1`](../entity-identity-v1.1/map.md)：兼容矩阵 C 路线、关卡作用域。
- [`visual-semantics-verification-v1`](../visual-semantics-verification-v1/map.md)：VDS↔config 覆盖边界。

### 执行纪律

- **零付费、零模型调用、零生图**；全部使用既有 fixture + mock transport + 真实产物重判。
- **不修改生产代码、不修改 `ConfigIssue` 契约、不修改 CLI/MCP 对外行为、不修改历史冻结证据。**
- **不直接推送 `main`**；不 `reset`/`clean`；不覆盖既有 run/pack/site 版本。
- **P1 必须重新审批**；本图在 P0-B 收口处停止，不自动进入实施。
- 证据分级：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->
- [上游审计：plan-assets/recipe 职责与上下游闭环](issues/02-upstream-planning-audit.md)：五历史错误在上游已闭环（HUD 闸 / solid 锁 / 玩家 / 背景 / 层覆盖），**不需要新增 plan-assets 闸门**；但整链非完全闭环 —— HUD 闸只在 `hud:screen-space` 时触发而 `hud` 结构必填、地形只有提示词线索、四桶覆盖不看 kind、人工改清单复验不全、重采样盲、上游根因被写成「模型错」、`role`/viewport 未贯通。验证 149 tests 零付费。
- [下游审计：compile-runtime 调用链、槽位 kind 锁与五错误回归](issues/01-downstream-validation-audit.md)：五错误今天**仍全部被拦截**，但分档变为「模型错、3 发重采样后失败」；锁只在 5 个槽位（player/solid/hud.panel/hud.pip/background），**pickup/hazard/goal/chest/danger/decor 无 kind 锁**；E03 无同形态用例、E04 无负向测试；E05 在 QA/`reuseConfig` 不可见；真实残余缺口已 E3 复现（enemy→hazard→ui 可落盘、玩法 sprite 作 solid 零 issue、chest/danger 状态帧静默、九宫格 1×1 零 issue、`reuseConfig` 绕过多数审计）。
- [ConfigIssue 条件式类型增量裁定](issues/03-configissue-conditional-code.md)：**条件式 A** —— 仅当 04 裁定存在「值得修复 + 需新增/加强确定性负向测试 + 码有实际价值」的缺口时，才加 `code?: ConfigIssueCode`（contracts 闭集 union）；**不 retrofit** 47 个构造点、不给 E01–E05 补码、不扩展 `QAFinding`、不改 CLI/MCP/落盘；不触发则直接裁定「无契约变更」。
- [残余缺口裁定（HITL）](issues/04-residual-gap-ruling.md)：残余缺口成立，**Q8 由 C 修正为 A** —— 下游 kind 锁在生图后拦错、覆盖闸在付费生图前拦错，阶段不同不可互替；A 类七项（Q1 五槽位 kind 锁、Q3 chest/danger 状态帧、Q4 九宫格下界、Q5 两条复验绕过、Q6 设计合法输出与 config 强制条件矛盾、Q8 四桶覆盖闸 kind 检查、Q11 E02/E03/E04 负向测试）进 05；B 类（Q2 sprite 语义、Q7 reachability、Q10(a)(b)(c)）保留，D 类（Q9 上游诊断/重采样/viewport-role、Q10(d) 设计无 goal 桶）另立 effort；C 类为空集；**票 03 条件式 A 触发**，结论不接受「无需新增生产代码」。
- [P0-B 最小实施方案](issues/05-p0b-minimal-plan.md)：七项各有源码落点 —— 修改面 `contracts`(3)+`assets`(3)+`pipeline`(1)，不新增包、不改 Runtime；Q1 锁表与 Q8 桶→kind 表**都由 `DESIGN_BUCKET_KINDS` 派生**（单一来源）；Q5 在 `create-game.ts:610-612` 汇合点统一调用新 `auditConfigPipeline`；Q6 裁定为 **B1 设计层 `resources ≥ 1`** + **A1 HUD 闸无条件**；需 P1 批准两项契约变更（`ConfigIssue.code` 三码、设计 `resources ≥ 1`）。语料自证：Q1 0/120 误伤、Q4 0 处越界、Q6 37/37 设计无影响、Q8 真实清单零误拒；Q3 在 81 处历史 chest 单帧上真实响。零付费验证含 6 个测试文件 + 只读语料重判。
- [P0-A/P0-B 收口与 P1 审批材料](issues/06-closeout-and-p1-package.md)：最终报告 [final-report.md](final-report.md)；五错仍被拦截（3 发重采样后 `invalid`、不落盘），残余缺口 A 类 7 项 / B 类 4 组 / D 类 2 项 / **C 类 0**；P0-B 修改面 7 文件，两项契约变更待 P1 批准（`ConfigIssue.code` 三码、设计 `resources ≥ 1`）；证据分「测试证明 / 源码证明 / 真实产物证明 / 未验证」；零付费、未改生产代码、未 commit。**本图完成，停在 P1 门前。**

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

- （无 —— **本图已完成**。剩余工作是 P1 审批，不是本图的雾；B/D 类已记入 Out of scope。）

## Out of scope

- **P1 实施与任何生产代码修改**：本图终点是 P0-B；P1 重新审批后另立 effort。
- **`ConfigIssue` 契约修改本身**：本图只审计必要性与 A/B 方案，不实施。
- **CLI / MCP 对外行为变更**。
- **重写 GameConfig / Asset Manifest / Phaser Runtime / 资源生成流水线**（PRD §10）。
- **新增游戏机制、新 Demo、重新生成 FPVS-V1、P0-02 第二 Demo 付费生成**（PRD §10）。
- **付费生图 / 模型调用 / 跨游戏设计复用**（PRD §2.3、§8.3）。
- **`interactables` 同桶误归属（`gate → chest`）与 `decor` kind 锁**：`entity-identity-v1.1` 已裁定的
  已知限制；除非审计提供证据证明直接造成本图目标范围内的失败，否则不重开（证据 ⇒ 仅提交范围变更建议）。
- **自动修复 / 自动重试系统**（PRD §10）。
- **修改历史冻结证据、Evidence CI 双基线策略、把历史验收改写为通过**（PRD §10）。
- **sprite 内部语义分类与 `role` 消费（Q2, B）**：当前只保证资源形态兼容，不保证角色/地形/道具语义正确；引入可机读分类是契约级改动，另立 effort 才考虑。
- **`reachability` 并入 `compileRuntime`（Q7, B）**：继续由 QA 覆盖，不改失败分档。
- **地形仅提示词线索并允许退化、layout 散文无结构化需求、斜坡无独立槽位（Q10(a)(b)(c), B）**：前序裁定保留，不重开。
- **上游诊断与反馈贯通（Q9, D）**：`modelHard` 归因、盲重采样、`viewport`/`role` 未贯通 —— 另立 effort。
- **设计层新增 goal 桶（Q10(d), D）**：设计表达缺口，超出本图终点 —— 另立 effort。
