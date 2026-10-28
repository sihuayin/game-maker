# 通用试玩策略收敛与真实证据闭环（v7.6 P0）

Labels: wayfinder:map
Tracker: local-markdown
Effort: generic-playtest-v1

> **本图 2026-10-28 开、2026-10-28 关闭。** 输入：`docs/v7.6/验证.md`（FPVS-V1 Final Acceptance — P0：通用试玩策略收敛与真实证据闭环）。
> **收口形态（用户 2026-10-28 逐字裁定）**：**(a) 承载执行 + 证据复用** —— 逐条重验 v7.6；
> 继承 P0-2～P0-4 已收口机制，只修真实审计发现的缺口；每张票收口到代码 + 测试 + 真实证据。
> **方向裁定 Q1–Q9（用户 2026-10-28 逐字）**：
>   Q1 **(a)** 承载执行 + 证据复用，不重建 playtest-v1 / fpvs-v1-final；
>   Q2 **(a)** 验收对象 = 冻结 wasteland Demo（`pack/v1 · site/v1 · shell 2`），不重新生成；
>   Q3 **(a)** 通用 = 状态驱动 + 横向巡逻 / 纵向巡逻 / 定时喷发三类危险形态；fixture 覆盖每类 + 真实 Demo 一次运行；
>   Q4 **(a)** 先审计现有契约能否表达「主动停止 / 无进展 / 重复重置」；证明不足才单开审批票；
>   Q5 **(a)** 视觉审核与历史 verdict 在身份一致、字节不变时继承，最终报告明确标注来源；
>   Q6 **(a)** 最多 3 轮有记录的策略迭代，零付费；
>   Q7 **(b)** 只读扩展 `READ_STATE`：暴露 `dangers` 的盒足迹、`periodMs`、`activeMs`、`t`（不改站点/游戏契约）；
>   Q8 **(b)** 继承证据用 effort 脚本机械比对身份与哈希，不改产品审核路径；
>   Q9 **(a)** 只跑冻结 Demo 一次真实试玩；纵向巡逻与定时喷发用确定性 fixture 验证。
> **三条边界（用户 2026-10-28 逐字）**：
>   ① 继承不等于免审 —— 旧测试/真实产物只有在身份、适用范围、证据有效性成立时才可继承；
>   ② 通用不等于保证通关 —— 能力不足必须如实落 `AGENT_LIMITATION` / `TIMEOUT` 或契约允许的准确结果；
>   ③ 不为表达方便擅自扩契约 —— 优先用现有 `actions`、trace、`InsufficientEvidence` 与归因表达主动停止。
> **执行顺序（用户 2026-10-28 逐字）**：基线审计 → 契约表达审计 → 策略实现与确定性验证 → 冻结 Demo 真实试玩 → 最终证据聚合。
> **前置（继承，不重开）**：`playtest-v1`（五态归因 / 版本绑定 / 证据三值 / 基线机制）、
> `fpvs-v1-p1`（`delivery` 六检查 + 四值 verdict + 视觉写入）、`fpvs-v1-final`（FA-01–06 全收口，
> 真实自动通关 + 视觉人工审核 pass + `delivery.verdict=pass`）。
> **基线事实（2026-10-28 E1 源码审计）**：v7.6 §1 的问题基线部分过时 —— FA-02 已在冻结 Demo 上取得真实
> 自动 `SUCCESS`（`won=true` / collected 6 / 0 reset），FA-05/06 已给 `verdict=pass`；
> `delivery.playtest` 仅 `SUCCESS` 通过是 playtest-v1 的既定映射，不是缺陷。真实空白集中在 §5.3 的通用性：
> §5.5 **3 MET / 3 PARTIAL / 2 NOT MET** —— `policy.mjs` 不读 `dangers`、`axis:"y"` 被 `hazardModel` 排除、
> 无无进展/重复重置终止、等待无独立上限、巡逻带外 `pickupAbove` 仍无条件追逐；跳跃**证据层**已有
> `jump/land` 状态差推断（`observe.mjs:111-112`），缺的是**动作层**校验与重试上限。
> §6.6 证据闭环 **8/8 MET**；§7.5 **3 MET / 3 PARTIAL**、§8.4 **5 MET / 1 PARTIAL** ——
> 审核记录身份未绑定 delivery、视觉结论无 evidence ref、`delivery.evidence` 读取不重算哈希；
> FA-04 为六项清单，与 §7.3 的七项不完全对应；`08-goal.png` 与 `09-final.png` 字节相同。

## Destination

在冻结的 wasteland Demo（`pack/v1 · site/v1 · shell 2`，零付费、字节不变）上，让 v7.6 P0 的四包在**当前 main**上
有证据地成立：试玩策略依据可观测状态对**横向巡逻 / 纵向巡逻 / 定时喷发**三类危险形态作出「推进 / 等待 /
起跳 / 停止」决策，连续无进展与重复重置能有限终止且原因可追溯；P0-2/P0-3/P0-4 以身份一致的历史证据继承并
逐项重验；最终报告能诚实回答「这个确定版本是否有足够证据达标」，结论允许 `pass` / `fail` / `blocked` /
`incomplete`，未知或证据不足不得升级为通过。

## Notes

- **输入（只读）**：`docs/v7.6/验证.md` 是需求规格；`CONTEXT.md` 是领域词汇唯一权威。
- **验收对象**：`.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/`（只读快照）+
  `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/`（可写工作区）；本轮不改站点字节、不生成新 Demo。
- **继承证据**：FA-04 `review-record.json` / `capture.json`、FA-05 `final-acceptance.md` /
  `qa-report.json` / `evidence.json` / `consistency.json`、FA-06 `regression.json`。继承前必须核对
  pack/site/shell/checksum 与文件哈希；核对通过 ≠ 产品读取路径已加固（Q8(b)）。
- **观测扩展（Q7(b)）**：`READ_STATE` 对 `dangers` 只读暴露盒足迹 + `periodMs` + `activeMs` + `t`；
  `t` 是场景启动后的毫秒累计（`scene.ts` `d.t += delta`），命中复位不重置、页面重载归零。
  ⚠️ 领域陷阱：`periodMs` 是**安全窗口时长**，`activeMs` 是喷发时长，完整周期 = `periodMs + activeMs`
  （`packages/demo/src/hazard.ts:28-33`）；字段缺失/周期非法 ⇒ 保守策略，不猜窗口。
- **契约边界（Q4(a)）**：先审计 `playtest-report/v1` 的 action outcome 闭集、`execution`、`termination`、
  trace/actions 与 `InsufficientEvidence` 能否无歧义表达主动停止；不预先扩 outcome / 游戏契约。
- **契约表达（02/08 已收口）**：现有契约不能无歧义表达「执行器主动停止」；08 已批准可选
  `stop?{reason, atStep}`（4 个执行器原因）、harness/rules 升 v2、归因优先于 deadline。05 按批准边界实施，
  不改 `delivery.playtest` 镜像、不扩 `actions[].outcome`。
- **真实取证（Q9(a)）**：只跑冻结 wasteland 一次真实浏览器试玩；三类危险形态由确定性 fixture 覆盖。
  `avoid-danger` probe 不纳入周期策略证据（`400/400` 是 50/50 循环，但玩家出生点落在 120px 危险盒内，
  不是干净的「带外等待后穿越」样本）。
- **零付费 / 迭代上限（Q6(a)）**：不调用付费模型、不重生成资源；策略迭代最多 3 轮有记录，到上限输出证据与剩余问题。
- **失败语义**：游戏失败 / 环境故障 / 执行器能力不足 / 超时 / 证据不足必须区分；不把未知映射为成功，不降低阈值。
- **工作树纪律**：不改既有 `fixtures/`、`game-maker.local.json`；不 `reset`/`clean`；不提交/推送除非单独授权；
  测试产物只写 `out/` 或本 effort 目录；历史 `run/vN` / `pack/site/vN` / 报告零改动。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径 + 身份）。
- **03 裁定（2026-10-28）**：策略判据、阈值与停止语义已锁定（见 03 的 Answer）；视觉补审见
  [09](issues/09-visual-review-supplement.md)；最终结论 = 交付 verdict + §5.5 逐项判定。
- **08 裁定（2026-10-28）**：批准 `stop?{reason,atStep}`（4 个执行器原因）；归因在游戏失败/环境失败/SUCCESS 之后
  把执行器 stop 判 `AGENT_LIMITATION`；交付摘要不镜像；确定性投影加 `stopReason`；05 按批准边界实施。
- **地图关闭（2026-10-28）**：全部 9 张票已收口；07 最终结论 `pass`；目的地已达。
  最终报告 `evidence/07-final-acceptance.md`、机器可读结论 `evidence/07-final-verdict.json`、
  继承核对 `evidence/07-inherited-verification.json`（27/27）。
- **09 事实（2026-10-28）**：人类补审 §7.3 四项全部 `pass`（可读性 / 动画 / 玩法-视觉对应 / 完成度）；
  8 个不同画面（08-goal 与 09-final 同字节，不称 9 个）；FA-04 三份记录零改动；
  记录 `evidence/09-review-record.supplement.json`、材料 `evidence/09-review-materials.json`；
  不冒充七项全量重审、不写 delivery。
- **06 事实（2026-10-28）**：冻结 wasteland 真实浏览器试玩 **两次 attempt 均 SUCCESS**
  （`won=true` / collected 6 / chests 2 / 0 reset / 0 hazard-hit / 0 runtime-error；452 / 451 steps；
  投影一致、身份一致、site-integrity 与 50 文件前后哈希不变）；0 次策略迭代、≤3 attempt；
  产物 `evidence/06-attempt-{1,2}/`、`06-snapshot-{before,after-1,after-2}.json`、`06-reproducibility.json`。
  `result.outcome=null` 是 harness 不做五态归因的既定行为；07 不得把无 stop 误读为缺证据。
- **04 事实（2026-10-28）**：`READ_STATE` 对 `dangers` 只读暴露打击盒足迹 + `periodMs/activeMs/t`；
  `policy.mjs` 支持纵向巡逻（完整扫掠相关性 + 头顶安全窗 + 150ms 余量，不要求起跳）与定时喷发
  （`t % (periodMs+activeMs)` 逐一路径推演，active 禁入，state-only 回落）；
  `vertical-window-unknown` / `danger-window-unknown` 只落 `strategy.json` notes，不进 11 类闭事件。
  冻结 wasteland 只有 `axis:"x"` 巡逻物，无 y/danger 实体 ⇒ 06 的真实路径等价 FA-02，纵向/喷发证据仍是 E2 fixture。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [基线重验与差距清单](issues/01-baseline-reverification.md)：**已收口** —— `main@ae339b9` 未满足 v7.6 全部标准：
  §5.5 **3/3/2**、§6.6 **8/8**、§7.5 **3/3**、§8.4 **5/1**、§12 **6/1/1**（DoD-1 未满足）。
  差距清单 9 条（dangers/axis:y/pickupAbove/无进展终止/等待与跳跃校验/契约表达/审核身份/证据哈希/测试覆盖）；
  FA-04 视觉审核**可继承**（身份与 44/44 材料、9 张截图哈希一致；但六项 ≠ §7.3 七项，08/09 截图字节相同），
  FA-05 `verdict=pass` 可继承为同一冻结对象的交付结论、**不可继承为 §5.5 通用性已满足**，FA-06 回归可作基线但 04/05 后须重跑。
  研究全案：[research/baseline-audit.md](research/baseline-audit.md)。→ 解除 03 阻塞。

- [契约表达审计：主动停止 / 无进展 / 重复重置](issues/02-contract-expressiveness.md)：**已收口** ——
  现有 `playtest-report/v1` + `delivery` **不能无歧义表达**「执行器主动停止」：没有终止发起者字段，
  `actions[].outcome` 闭集无 `stopped`，`attribute()` 对主动停止与场景超时同判；重置计数可读，
  但「达上限并停止」不可读，事后 `stuck` 统计不落盘也不终止运行。最小增量提案 =
  可选 `PlaytestScenarioReportSchema.stop?{reason, atStep}`（`mapPlaytest` 忽略，`playable-smoke`/verdict 不变）；
  属事实缺口，须单开审批票 → 毕业 [08 契约扩展审批](issues/08-contract-extension-approval.md)（被 03 阻塞）；
  05 改为同时被 03/08 阻塞。研究全案：[research/contract-expressiveness.md](research/contract-expressiveness.md)。

- [03 差距分诊与策略设计裁定](issues/03-gap-triage-and-strategy-ruling.md)：**已收口** —— Q1–Q11 全部采纳：
  横向保留 FA-02 已验证模型；纵向/喷发用确定性 fixture + 保守回落；复合进展 300 步 / 5 次重置 / 120 步等待上限 /
  跳跃 3 步验证 + 3 次降级 + 5 次累计；`pickupAbove` 用平台几何 + 单跳包络；停止语义锁定
  `no-progress` / `reset-exhaustion` / `wait-limit` / `jump-exhaustion`，**契约表示由 08 裁定、05 批准前不动 schema**；
  视觉补审四项（新票 09）、证据缺口只做 effort 脚本 + 披露、五态 E2E 不做；最终结论 = `deriveDeliveryVerdict` +
  §5.5 八项逐项判定，历史 `pass` 不得覆盖本轮失败。→ 解除 04/08/09 阻塞；05 仍受 08 阻塞。

- [08 契约扩展审批：主动停止的表示](issues/08-contract-extension-approval.md)：**已收口（批准）** ——
  `playtest-report/v1` 加性可选 `stop?{reason: no-progress | reset-exhaustion | wait-limit | jump-exhaustion, atStep}`；
  harness/rules 升 v2；归因在环境/游戏失败/SUCCESS 之后、`positiveLimitation`/`structuralUndecidable`/`deadlineHit`
  之前把执行器 stop 判 `AGENT_LIMITATION`；交付摘要不镜像；确定性投影加 `stopReason`；05 按批准边界实施。
  → 解除 05 阻塞。

- [05 有限终止与动作验证](issues/05-finite-termination-and-action-verification.md)：**已收口** —— 按 03/08 实施并全部确定性验证：
  复合进展 300 步无进展 / 累计 5 次重置 / 连续 120 步等待 / 跳跃 3 步窗口（连续 3 次降级、必需跳跃累计 5 次且无替代）
  ⇒ `stop{reason,atStep}`（atStep = trace 观测步）⇒ 归因 `AGENT_LIMITATION`（优先于 deadline/轮询断档，不判游戏失败）；
  `pickupAbove` 只用单跳包络 + 平台几何（冻结 Demo 的 scrap-2/4 平台形态可达），不可达记 `pickup-unreachable`；
  harness 条件场景不套用停止；非契约 sidecar `strategy.json`（最后观测 + 注解）。`delivery.playtest` 不镜像 stop。
  回归：`pnpm test` 2189/146 exit 0 · `typecheck` exit 0 · `test:playtest` 4/4 + 125 exit 0。
  证据：`evidence/05-regression.json`、`evidence/self-test-run/`。→ 06 仍待 04；harness/rules 已是 v2（旧基线 not-comparable）。
- [04 危险形态通用化（横向 / 纵向 / 定时喷发）](issues/04-danger-forms-generalization.md)：**已收口** ——
  `hazardModel` 接受 `axis:"y"`（锚点 = 盒底，反推起点/相位）；相关性按**完整扫掠范围**；纵向穿越窗口
  =「盒底高于头顶」时间 ≥ 穿越 + 150ms，通过**不要求起跳**，无窗口等待至 120 步 `wait-limit`；
  定时喷发按 `t % (periodMs+activeMs)` 逐一路径推演多 danger，`state=active` 绝不进，缺字段回落
  state-only（idle 才进）。`READ_STATE` 对 `dangers` 只读暴露打击盒足迹 + `periodMs/activeMs/t`；
  注解 `vertical-window-unknown` / `danger-window-unknown` 只落 `strategy.json` notes，不扩契约/11 类事件。
  回归：`pnpm test` 2207/147 exit 0 · `typecheck` exit 0 · `test:playtest` self-test 4/4 + 143/10 exit 0。
  证据：`evidence/04-regression.json`。冻结 Demo 只有 `axis:"x"` 巡逻物 ⇒ 06 真实路径等价 FA-02。→ 解除 06 阻塞（05 同时已收口）。
- [06 冻结 Demo 真实试玩取证](issues/06-frozen-demo-real-playtest.md)：**已收口** —— 冻结 wasteland（pack/v1 · site/v1 · shell 2）
  上两次全新目录的真实浏览器 attempt 均 **SUCCESS**：`won=true` / collected 6 / chests 2 / 0 reset / 0 hazard-hit /
  0 runtime-error；452 / 451 steps、约 17.7s、7 动作；确定性投影一致、身份与 `artifacts/identity.json` 全等、
  `site-integrity.unchanged=true`、site+pack 50 文件前后 sha256 一致。0 次策略迭代（首轮成功、无失败样本）；
  `result.outcome=null` 是 harness 不做五态归因的既定行为。冻结 Demo 只有 axis:x 巡逻物 ⇒ 纵向/喷发仍为 E2 fixture。
  证据：`evidence/06-attempt-{1,2}/`、`06-snapshot-{before,after-1,after-2}.json`、`06-reproducibility.json`。
  → 解除 07 对 06 的阻塞（07 仍等 09）。
- [09 视觉审核补审：§7.3 四项未逐项记录的维度](issues/09-visual-review-supplement.md)：**已收口（HITL）** ——
  人类审核者对冻结 wasteland 的 §7.3 四项全部 `pass`（画面可读性 / 动画表现 / 玩法与视觉对应 / 整体完成度），
  `problems=[]`；复用 FA-04 **8 个不同画面**（08-goal = 09-final 同字节，不称 9 个），并在会话内提供本地只读运行入口；
  身份与 `artifacts/identity.json` 全等。追加记录 `evidence/09-review-record.supplement.json`，
  FA-04 `review-record/capture/materials` 零改动（哈希留档）；不冒充七项全量重审、不改产品审核路径、不写 delivery。
  → 解除 07 对 09 的阻塞；07 成为唯一 frontier。
- [07 继承证据重验与最终聚合](issues/07-inherited-evidence-reverification-and-final-aggregation.md)：**已收口** ——
  最终结论 **`pass`**：`deriveDeliveryVerdict` 重算六项必需检查 = `pass`，§5.5 **8/8 MET**；
  01 差距清单 6 closed / 2 effort-closed（产品路径未改、已披露）/ 1 partial（五态 E2E 本轮不做）。
  继承核对 effort 脚本 **27/27**：身份、FA-04 44 条材料、9 图/8 distinct、site-integrity、FA-05 36 条证据 +
  12 条 consistency + qa-report `dc20e301…5ee6`、FA-06 回归、本轮 06 两份 attempt、50 文件快照、
  09 补审与 FA-04 零改动全部通过。回归 `pnpm test` 2207/147 · `typecheck` · `test:playtest` 143/10 ·
  `test:acceptance` allOk=true，全 exit 0。12 条限制已披露（产品读取路径不重算哈希、单 Demo、
  纵向/喷发仅 fixture、五态 E2E 未做、旧 x=813/24 不可复现等）。
  证据：`evidence/07-final-acceptance.md`、`07-final-verdict.json`、`07-inherited-verification.json`、
  `scripts/07-verify-inherited.mjs`、`07-regression/`、`07-acceptance/`。→ **目的地已达，地图关闭。**

## Not yet specified

<!-- 无：06/09 已落地；剩余的全部是 07 的聚合、逐项重验与限制披露。 -->

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->

- **重写 Runtime / 新增游戏机制 / 改 shell**（`SHELL_VERSION` 不升、站点字节不动）。
- **付费生成 / 重跑管线 / 新建 Demo 或站点**（Q2(a) / Q9(a)）。
- **重建 playtest-v1 / fpvs-v1-final 已收口机制**（Q1(a)）。
- **未经审批的 contracts / CLI / MCP 公开输入输出变更**；新增第三方依赖。
- **修改产品审核路径或证据存储机制**（Q8(b) / 03 Q9 A：本轮只做 effort 脚本 + 披露，`review-verdict` / `delivery.evidence` / `consistency` 不改）。
- **把人工试玩或视觉审核结果冒充为自动试玩成功**。
- **跨游戏通关保证 / 自动修复 / 自动进化 / 多关 / HP 等 P1+ 能力**。
- **覆盖 `run/vN`、`pack/site/vN` 或已发布报告**；删除不利结果制造通过。
- **降低验收标准 / 删除测试 / 缩减覆盖 / 改阈值**。
- **把 `avoid-danger` probe 当作周期策略已验证的证据，或追加它的真实运行**（Q9(a) / 03：只跑冻结 Demo 一次）。
- **五态浏览器 E2E 新增**（03 Q10 A：归因单测已覆盖原因类别；不引入浏览器端到端依赖）。
- **更新 `CONTEXT.md` 词条**（本 effort 只读；术语记录在 03 的 Answer）。
- **把不可复现的 `x=813 / 24 reset` 叙述当作当前基线**（07 只用 `x=438 / 19`）。
- **手工合成新的总 verdict 或第二套状态模型**（03 Q11 A）。
- **把 `stop` 扩成完整结束原因枚举**（`scenario-timeout` / `action-timeout` / `actions-exhausted`）或扩 `actions[].outcome`（08 Q1 A / Q7）。
- **在 `delivery.playtest` 镜像 stop**（08 Q4 A：最小摘要不承载；07 读 `result.json`）。
- **实施 Q6 的拒绝降级方案**（08 Q1 已批准，仅备用）。
