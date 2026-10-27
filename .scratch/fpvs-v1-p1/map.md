# FPVS-V1-P1：生成结果交付验收与证据报告

Labels: wayfinder:map
Tracker: local-markdown
Effort: fpvs-v1-p1

> **本图 2026-10-27 开。** 输入：`docs/v7.3/报告.md`（FPVS-V1-P1「生成结果交付验收与证据报告」）。
> **收口形态（用户 2026-10-27 逐字）**：**(a) 承载执行** —— 每张票 = 一段实现或一个决策，
> 收口到代码+测试+§8.4 真实产物验收，与 `fpvs-v1-p0` 一致。
> **P0-06（用户 2026-10-27 逐字）**：**含 HITL 任务票** —— 人类完成对照并把结论写回，§8.4 真实验收闭环。
> **前置（继承，不重开）**：`fpvs-v1-p0`（真实可玩 Demo：create 管线端到端通、QA pass、smoke `playable` 3/4
> 记已知限制、P0-06 风格人工对照留待人工）。本图承接其收口态：**产物已产出，缺的是「统一交付验收结论」**。

## Destination

建立统一的**生成结果交付验收与证据报告**（FPVS-V1-P1）：在现有 `create → build → QA → site` 链之后，把资源校验 /
配置编译 / QA / 站点构建 / headless smoke / 视觉人工对照六类结果汇总成一份可追溯的交付结论，回答
「这一版通过了哪些检查、还剩哪些问题、证据是否足以交付」。复用并扩展现有 `qa-report.json`，实现最终交付状态的
确定性计算 + 版本绑定 + 失败证据保留 + 自动化测试；§8.4 用已有真实产物做一次零付费端到端报告验收。

## Notes

- **输入（只读）**：`docs/v7.3/报告.md` 是需求规格；`CONTEXT.md` 是领域词汇唯一权威（`docs/文档.md` 是旧规格）。
- **不重造已有检查**（§4.1）：复用资源校验/QA/构建/试玩结果，消费结构化输出，不在新模块复制判断逻辑。
- **硬失败与未完成区分**（§4.2）：`FAIL`（确定性校验失败/强制条件未满足）≠ `INCOMPLETE`（没完成、无法下结论）
  ≠ `BLOCKED`（前置失败）≠ `PASS` ≠ `NOT_REQUIRED`；不得用 `success: boolean` 覆盖全部状态。
- **试玩失败 ≠ 游戏失败**（§4.3）：smoke 失败记录 `stage`+`reason`+截图，原因不明保留 UNKNOWN，不自动归因。
- **视觉验收独立于结构验收**（§4.4）：色板合法/PNG 有效/图集正确/尺寸合理 ≠ 最终画面符合参考风格；未评审不得设通过。
- **报告必须绑定产物**（§4.5）：绑 pack/v<N> ↔ config ↔ site/v<N>，不凭项目名或最近成功态推断合格。
- **零付费**（§9.3）：验收复用已有产物，不因验收重复付费生图。
- **领域词汇**：以 `CONTEXT.md` 为准。关键已有词：`qa-report.json`（观察全文）、`观察摘要`（终端 3–4 行聚合）、
  `qaVerdict`（pass|fail|incomplete 纯函数）、`观察/判据`（判据阻断、观察只报）、`产物 A/B`、`pack/v<N>`/`site/v<N>`、
  `参考玩家`（可通关下界、非难度计）、`ledger.json`（收据）vs `manifest.json`（自描述）、
  `HumanVerdict`（pending|pass|fail，animation-acceptance 冻结占位）、`观察摘要`/`人类输出`。
- **工作树纪律**：不改 `fixtures/`、`game-maker.local.json`；不 `reset`/`clean`；不提交/推送除非单独授权；
  测试产物只写 `out/` 或本 effort 目录。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。

## Decisions so far

<!-- the index: one line per closed ticket -->

- [01 阶段A 只读审计](issues/01-readonly-audit.md)：**已收口** —— 现有报告/状态/产物关联全量审计，五件交付物齐
  （能力清单 / 报告结构 / 版本关联图 / 缺失清单 / 最小改动建议）。关键结论：`BLOCKED`/`NOT_REQUIRED` 不存在、
  smoke 无步骤数字段、无跨阶段持久化聚合、P0-06 verdict 无存储；自然装配缝 = `assertPublishableQa`。
  研究全案：[research/audit.md](research/audit.md)。
- [02 P0-06 视觉人工对照完成](issues/02-p0-06-visual-review.md)：**已收口** —— 人类对照参考图 vs 真实站点
  （pack/v1 · site/v1 · shell 2），**PASS**（2026-10-27，确认满足）。verdict 待票 06 机制落地后由阶段C 写回报告。
- [03 统一状态模型裁定](issues/03-status-model.md)：**已收口** —— 报告层五态枚举 `pass/fail/incomplete/blocked/not-required`
  （小写连字符、独立层、不改现有枚举）+ 最终状态总序 `fail > blocked > incomplete > pass` + 生成失败=FAIL（下游可 blocked 但最终 fail）+
  qaVerdict 降为输入之一（同名不同义）+ 不新增判据（观察只记不阻断）。→ 毕业 [07 状态计算实施](issues/07-status-computation-impl.md)。
- [04 qa-report 扩展契约 + 版本绑定裁定](issues/04-qa-report-contract.md)：**已收口** —— 扩展 `qa-report/v1` 加可选 `delivery`
  子对象（不升版、加性）+ 字段集定案（runId/pack/config/site?/checks/verdict/visualReview/evidence/knownLimitations）+
  两阶段落盘（QA 层现状 + site 装配后补 delivery、site 版本显式分配）+ 失败路径落盘（QA 及之后都写、pack/config 之前不强行造）+
  必需性用固定检查项注册表 + CLI 摘要列 P1。→ 毕业 [08 交付报告契约 + 落盘实施](issues/08-delivery-report-impl.md)。
- [05 自动试玩结果与失败分类接入裁定](issues/05-playtest-evidence.md)：**已收口** —— smoke 只接现有 result.json 字段+证据引用
  （不补步骤统计、不改 playable-smoke.mjs）+ 不新增五类枚举（status 用 DeliveryCheckStatus、detail 记归因
  GAMEPLAY_FAILURE/AGENT_LIMITATION/UNKNOWN）+ **3/4 场景归 UNKNOWN**（更严格证据标准：无真人实测通关、无无碰撞通路证据，
  不提前判 AGENT_LIMITATION）。→ 毕业 [09 试玩结果接入实施](issues/09-playtest-integration-impl.md)。
- [06 视觉评审状态记录机制裁定](issues/06-visual-review-mechanism.md)：**已收口** —— 复用 HumanVerdict 三值（不加取消/无效/重评）+
  新增极简 CLI `review-verdict`（仅 CLI 不加 MCP，**校验归属 + 原子更新**）+ 评审字段最小化（复用 delivery 身份/证据）+
  每 run 独立初始化 pending、禁止跨 run 复制 + P0-06 转录真实裁定不冒充重评。→ 毕业 [10 视觉评审写入实施](issues/10-visual-review-impl.md)。
- [07 状态计算实施](issues/07-status-computation-impl.md)：**已收口** —— `delivery.ts` 新增 `DeliveryCheckStatus`（五值）+
  `DeliveryVerdict`（四值）+ `deriveDeliveryVerdict`（总序 fail>blocked>incomplete>pass、not-required 不参与、必需项标 not-required 抛错）+
  19 条 §6 测试（A–L 全映射）+ CONTEXT.md 词条。全仓 2009/2009 · typecheck 绿。→ 解锁 08。
- [08 交付报告契约 + 落盘实施](issues/08-delivery-report-impl.md)：**已收口** —— `DeliveryReportSchema` + 六检查项注册表（`DELIVERY_REQUIRED_CHECKS` 全部必需）+
  `delivery?` 并入 `qa-report/v1`（不升版、旧报告仍解析）+ 两阶段落盘（QA 硬失败提前落 / site 成功·失败补写，`create-game.ts` + CLI/MCP 三处接线）+
  收尾异常不覆盖原始失败 + 39 条单测。试玩（票 09）/视觉（票 10）登记了口、status 暂记 incomplete（最终结论因此 incomplete，不冒充通过）。
  全仓 2029/2029 · typecheck 绿。→ 解锁 09/10。
- [09 试玩结果接入实施](issues/09-playtest-integration-impl.md)：**已收口** —— `playable-smoke.ts` 新增 `mapPlayableSmoke`（ok→pass /
  非超时失败 stage `floor`·`win`·`runtime`→fail+GAMEPLAY_FAILURE / 超时→incomplete+UNKNOWN / 未跑→blocked）+
  `playableSmokeEvidence`（result.json/console/exceptions + fail-<stage>.png）+ `playableSmokeKnownLimitations`
  （navigate→票 05 Q3 事实化措辞，**永不产 AGENT_LIMITATION**）。纯函数、暂未接入口（阶段C 消费）。全仓 2040/2040 · typecheck 绿。→ 解锁 10。

## Not yet specified

<!-- in-scope fog that graduates as the frontier advances -->

- **跨阶段集成测试**（§8.2）：等 07/08/09/10 实施落地后。
- **CLI 摘要（FR-06，P1）**：核心报告落地后再实施，复用观察摘要机制（票 04 Q5 裁定）。
- **阶段C 真实产物验收**（§8.4）：报告落地后，用最新 E2E 真实产物（`fpvs-v1-p0` 的 `2026-10-26-e2e-r4`）做一次
  零付费端到端报告验收，输出统一报告 + 版本关联 + 试玩证据 + 视觉状态 + 最终结论。

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->

- **§2.3 非目标**：重写 `create` 生成流水线 · 新增游戏引擎/重构固定 Runtime · 替换资源生成路线 ·
  自动修复/自我进化/自动实验 · 跨游戏知识复用/跨项目迁移 · 为刷高验收分重复付费生成 ·
  把视觉质量强转为未经验证的数值阈值 · 把自动试玩器升级成完整人类行为模拟器。
- **人工豁免机制**（§6 注）：如需允许人工豁免，另行设计显式可追溯机制，本图不隐式放行。
- **§11 路线图（本图之后）**：P1 视觉一致性验收 V1（参考图↔关键资源↔最终截图可追溯）· P2 失败定位与低成本重跑 ·
  暂缓 自动修复与自我进化。
