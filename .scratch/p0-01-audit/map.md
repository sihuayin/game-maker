# P0-01：生成管线只读能力审计

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-01-audit

> **本图 2026-10-29 开。** 输入：`docs/v7.6/管线.md`（P0-01 · 生成管线只读能力审计 PRD；当前为未提交的工作区文件）。
> **终点形态（用户 2026-10-29 逐字裁定 Q1 = (a)）**：唯一交付物是可合并的只读审计文档，并给出能否进入第二个 Demo 实施的结论及最小阻塞解除方案；不直接实施修复或启动生成。
>
> **方向裁定 Q1–Q11（用户 2026-10-29 逐字）**：
>   Q1 **(a)** 终点 = 可合并只读审计文档 + 能否进入第二个 Demo 实施的结论 + 最小阻塞解除方案；不实施、不启动生成；
>   Q2 **(a)** 本图承载执行：只读调查、证据收集与综合；research/task 可拆，最终文档由综合票产出；
>   Q3 **(a)** 冻结生产代码 HEAD `2c1a9d5`；报告记录完整 SHA、分支、`git status`；PRD 保留为未提交工作区输入；
>   Q4 **(a)** 主文档 `docs/v7.6/p0-01-readonly-capability-audit.md`；详细证据 `.scratch/p0-01-audit/research/*.md`；主文档必须有证据索引；
>   Q5 **(a)+(c)** 按「能力 × 入口/场景」逐行，每行一个主状态；`E2E_VERIFIED` 必须绑定冻结点交付身份与可追溯真实运行证据，只对实际覆盖场景成立；
>   Q6 **(a)** 允许使用 `5f29592` 产生的 FPVS-V1 真实证据，须记录来源 commit、交付身份、证据清单 SHA 与适用场景；不外推到 `2c1a9d5` 未验证的新路径；
>   Q7 **(a)** 允许免费、确定性、不破坏历史的测试/验证命令；新输出只写 `out/` 或专用临时目录；禁止付费、重生成资源/站点、重跑浏览器试玩、写历史交付物；
>   Q8 **(a)** 先以证据比较 2–3 个候选，再由一张 HITL 决策票裁定唯一候选；不得预先锁定玩法；
>   Q9 **(a)** 审计期间不提交、不推送；完成后单独请求授权；未获授权前保留工作区状态；
>   Q10 **(a)** 新状态仅作报告元数据，不写入 `CONTEXT.md`；必须显式映射 E0–E3、Mechanic Coverage、`DeliveryCheckStatus`；
>   Q11 **(a)** 所有真实入口在调用链层面逐一覆盖；与第二个 Demo 决策相关的主链/旁路做深度审计，其余记录边界，不强做完整 E2E。
>
> **补充裁定（用户 2026-10-29 逐字）**：
>   ① `E2E_VERIFIED` 是有边界的证据结论，不是模块总评；历史 Demo 成功只证明对应交付身份与实际覆盖场景；
>   ② 命令执行前先确认副作用；即使名为 `inspect` / `verify` / `test`，也可能写历史、更新账本或触发外部调用；不满足 Q7 的命令不得运行；
>   ③ 候选比较先于候选裁定；2–3 个候选须依据真实运行时实现、机制覆盖、可观测性与预计改动比较，而非游戏类型的主观偏好；
>   ④ 本期只产出审计文档；发现代码缺口写成有证据的阻塞项与最小解除方案，不在本轮顺手修复。
>
> **首批工作（用户 2026-10-29 逐字）**：从冻结基线、核实安全审计命令、梳理真实入口开始。

## Destination

产出 `docs/v7.6/p0-01-readonly-capability-audit.md`：在冻结基线 `2c1a9d5` 上，以可追溯证据回答
「当前管线真实支持什么、哪些只有实现/测试/fixture 证据、哪些机制未获真实运行验证、第二个 Demo 最可能在哪里失败、
下一项最值得做的工程需求是什么」，并给出唯一优先候选与「能否进入实施 / 最小阻塞解除方案」的结论。
零生产代码变更、零付费、零历史覆盖。

## Notes

- **审计基线（Q3）**：生产代码 HEAD `2c1a9d5`；PRD 为未提交工作区输入；报告记录完整 SHA、分支、`git status`；审计期间不修改生产实现。
- **交付物（Q4）**：主文档 `docs/v7.6/p0-01-readonly-capability-audit.md`（PRD §6 十节）；详细证据在 `.scratch/p0-01-audit/research/*.md`；主文档含证据索引。
- **状态词汇（Q10）**：`IMPLEMENTED / TESTED / E2E_VERIFIED / UNKNOWN / BLOCKED` 仅为审计报告元数据，不写入 `CONTEXT.md`。
  显式映射：`IMPLEMENTED` ≈ E1（源码实现）；`TESTED` ≈ E2（可核实的测试断言）；`E2E_VERIFIED` ≈ E3（命令 + 退出码 + 路径 + 产物身份）+ 交付身份绑定；
  `UNKNOWN` = 证据不足；`BLOCKED` = 审计限制导致无法核实。`Mechanic Coverage` 的 design/runtime/qa 三层与 `DeliveryCheckStatus` 五值按既有语义使用，不另造同义词。
- **状态判定（Q5）**：按「能力 × 入口/场景」逐行；每行一个主状态；有实现有测试但无真实 E2E ⇒ 主状态 `TESTED`，实现事实留在 implementation 字段；
  `E2E_VERIFIED` 只对证据实际覆盖的场景成立；单一成功样本必须在 `limitations` 注明，不外推为普遍支持。
- **历史证据（Q6）**：FPVS-V1 证据产生于 `5f29592`，绑定冻结 Demo 身份；使用时记录来源 commit、身份、清单 SHA（`ba7a485b…`）与适用场景。
- **审计动作（Q7 + 补充裁定 ②）**：命令必须先经「核实安全审计命令」票确认副作用；输出只写 `out/` 或专用临时目录；禁止付费、重生成、重跑浏览器试玩、写历史。
- **工作树纪律**：不 `reset` / `clean`；不提交/推送除非单独授权（Q9）；不改 `fixtures/`、`game-maker.local.json`；审计产物只写本 effort 目录与目标文档。
- **证据来源优先级（PRD §4.2）**：生产代码与契约 → 自动化测试及断言 → 真实运行/Playtest/交付产物 → 历史 PRD 与验收说明；设计文档不能单独证明已实现。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据；每条确定性结论必须可追溯到代码、测试或 E3。
- **术语**：`CONTEXT.md` 是领域词汇唯一权威；`Mechanic Status` / `Mechanic Coverage` / `DeliveryCheckStatus` / `Evidence` 按既有含义使用。

## Decisions so far

<!-- 索引：每张关闭票一行，gist + 链接；详情只在票里 -->

- [梳理真实生成管线与入口](issues/03-map-real-pipeline.md)：**已收口（research）** —— 两条生产链：横版 `create/build → 理解六步 → runBuild（pack→verify→config→QA→机制覆盖）→ 发布闸 → site → delivery`；塔防 `需求+包 → compile-td-game → td-config → site`（无设计层/QA/delivery/playtest）。CLI 15 命令 vs MCP 8 工具，MCP 仅 `create_game` 能走完横版全链；独立 `site` 不写 delivery ⇒ 手工 plan/pack/compile/site 不可试玩；真实 E3 为 `040b907` 生成、`5b8283f` 冻结的 wasteland 横版（playtest harness v1，HEAD 已 v2；冻结 delivery 由 effort 脚本初始化，非当前 `buildAndSite`）；HEAD `verify-delivery` 只重算冻结证据。详见 [research/03-real-pipeline.md](research/03-real-pipeline.md)。

## Not yet specified

- 第二个 Demo 若不可进入实施，后续 P0-02 应以什么粒度、拆几张需求另立（取决于候选比较与缺口分类的结论）。
- 审计文档的入库拆分方式（单独提交文档，或与 PRD 一并提交）——Q9 已定「完成后单独请求授权」，具体提交边界待收口时定。
- 是否存在只能靠付费/浏览器重跑才能消除的 `UNKNOWN`——取决于安全命令核实与证据审计；若存在，按 Q7 记为 `BLOCKED` 并写明解除代价，不绕过。

## Out of scope

- 修改生产代码、公共契约、CLI/MCP、运行时或依赖；修改测试以改变验收结果（PRD §3.2 / §7 / 补充裁定 ④）。
- 付费模型调用；重新生成资源或站点；启动第二个 Demo 的正式生成。
- 覆盖历史 run / pack / delivery / 验收报告；把历史报告复制成新 Demo 的证据。
- 新增机制注册表、自动修复/进化能力、跨游戏知识共享/迁移、多游戏运行时。
- 在本期顺手修复任何代码缺口；把审计结论直接当成实施授权。
