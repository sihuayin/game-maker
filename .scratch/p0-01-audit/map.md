# P0-01：生成管线只读能力审计

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-01-audit

> **本图 2026-10-29 开、2026-10-29 关闭。** 输入：`docs/v7.6/管线.md`（P0-01 · 生成管线只读能力审计 PRD；当前为未提交的工作区文件）。
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

- [冻结审计基准](issues/01-freeze-audit-baseline.md)：**已收口** —— 生产代码基线 **`2c1a9d5`**（`main`）；当前 HEAD `e5dc05e` 仅新增本期 effort 文件（12 files / 684 insertions），生产代码 diff 为空；工作区仅未跟踪 PRD（`sha256:9ac9e120…92f4a7`）；10 包 / 6,877 受跟踪文件 / 149 测试文件；未读本地凭据与忽略构建产物；零生产修改。详见 [research/01-baseline.md](research/01-baseline.md)。

- [核实安全审计命令](issues/02-verify-safe-audit-commands.md)：**已收口** —— allowlist：只读 shell、`pnpm test`、`typecheck/build`（仅 `.gitignore` 的 dist）、`verify`/`inspect`、`accept`/`verify-delivery`/`test:evidence`/`site` 加 `--out <tmp>`；Chrome 机制探针仅按条件（需新观测 + 临时输出，非 Playtest）；禁止 `create/build/plan/pack/compile-*`、`playtest`、整条 `test:playtest`、`review`、`review-verdict`、`playtest-baseline`、`install`。未执行候选命令，零生产修改。详见 [research/02-safe-commands.md](research/02-safe-commands.md)。

- [Playtest、人工视觉与证据完整性审计](issues/06-playtest-visual-evidence.md)：**已收口（research）** —— Playtest 真跑系统 Chrome/CDP/真实按键；交付内 v1/v2 为 E3（harness/rules v1），06 两份 v2 attempt 未归因，HEAD 的 v2 CLI 写回无 E3。状态靠轮询快照差分，瞬时事件结构性可漏；五态 + UNKNOWN + not-executed 分类完整（19 个归因用例），但交付默认只要求 happy-path，非 SUCCESS 无真实 E3。身份绑 site/pack/config/shell/harness/rules，缺 runId/attempt nonce 且版本不强制；人工视觉记录独立且匹配冻结身份（11/11 identity verified），机器只验完整性/一致性。`verify-delivery` 缺失/不符会 blocked/fail、exit 0 只在 pass，但失败重跑不撤销旧 pass、`review-verdict` 不校验身份。负向测试 18 + 6；CLI playtest 准备层、视觉非全 pass、playtest 摘要不一致无负向用例。详见 [research/06-playtest-visual-evidence.md](research/06-playtest-visual-evidence.md)。

- [能力矩阵](issues/04-capability-matrix.md)：**已收口（research）** —— 10 个能力域共 52 行：**`E2E_VERIFIED` 31 · `TESTED` 17 · `UNKNOWN` 4 · `BLOCKED` 0**；E2E 行只来自 7 组真实运行，横版主链只有一组完整 E3（`040b907` create / `5b8283f` 冻结）。`delivery` 写回是新增代码，冻结 Demo 的信封由 effort 脚本初始化，壳级写回无 E3；Playtest v1 有 CLI 写回 E3、HEAD v2 组合无 E3、非 SUCCESS 仅 `AGENT_LIMITATION` 沙箱；人工视觉仅 1 次 E3，独立性与可重复性 `UNKNOWN`；`verify-delivery` HEAD 重跑 pass（223/151/72、13 records、六项 match、diagnostics 0），运行前后 1,035 个受保护文件零变化；TD compile 无真实模型 E3、TD 玩法 `UNKNOWN`；MCP 仅 `create_game` 全链且无 E3。整仓 `pnpm test` 在并发审计负载下两次超时、超时用例隔离重跑全过（环境约束，非能力失败）。详见 [research/04-capability-matrix.md](research/04-capability-matrix.md)。

- [机制与可观测性矩阵](issues/05-mechanism-observability.md)：**已收口（research）** —— 横版机制词表 10 条、9 条有运行时实现；**交付级 E3 3/10**（`collect-pickup` / `open-chest` / `reach-goal`；严格从闭集声明起点的全链只有 2/10，`reach-goal` 只在 `winConditions`）。`run`/`jump`/`gravity`/`collide-terrain` 仅间接观测；`hazard-contact` 有真实 `reset=10` 但无正向断言；`avoid-danger` 只有 fixture probe，冻结 config 无 danger 而覆盖仍判 `satisfied`；`moving-platform` 无运行时，手写 `solid+motion` 可静默绕过。三处系统性断点：config 编译器不读 `design.mechanics` 且 kind 铁律漏 chest/danger；覆盖门禁只读 design、probe 默认全过、不落盘；Playtest 默认场景写死 wasteland 常量且不判 hazard/danger/moving。塔防 9 类构念仅纯层仿真，无设计/QA/delivery/Playtest。详见 [research/05-mechanism-observability.md](research/05-mechanism-observability.md)。

- [第二个 Demo 候选比较](issues/07-second-demo-candidates.md)：**已收口（research）** —— 当前运行时只有 `platformer/v1`，玩法差异只能来自关卡/视觉/机制重心。3 个候选：**A 平台探索/收集**（现有机制域、无新机制；证据最强、风险最低）、**B 危险时序**（`hazard-contact` + `avoid-danger` 为核心；有假绿/无正向断言风险）、**C 塔防**（类型差异最大；无设计/QA/delivery/Playtest，属平台级接入）。证据强弱 A > B > C，风险/成本 A < B < C；玩法差异 C > B > A。俯视角探索解谜列为 `BLOCKED` 非候选（需新运行时/契约，不是一份新 config）；免费验证只能证明运行时行为与测试事实，完整交付仍需付费 `create/build` + 浏览器 `playtest`。不做最终裁定，唯一候选交票 08 HITL。详见 [research/07-second-demo-candidates.md](research/07-second-demo-candidates.md)。

- [裁定第二个 Demo 唯一候选](issues/08-candidate-decision.md)：**已收口（HITL）** —— 唯一候选 **A 平台探索/收集**；允许进入 P0-02 付费试跑，但**付费执行需另行明确预算授权**，未获授权则暂停、不得降级复用旧包。P0-02 只新增输入（新 intent、参考图、自定义 scenario），不改生产代码、不手改中间 JSON、不新增运行时/契约；核心验收 `collect-pickup` + `reach-goal`，`open-chest` 可选；新参考图 → 新视觉世界/资源包；证据 = 真实运行 + delivery 报告 + 真实浏览器 Playtest，新交付的正式清单与 `verify-delivery` 留作后续缺口。成功不得用历史 E3 替代，也不得把壳级 delivery E3 / v2 playtest 写回 / 正式清单缺失默认为已通过；B 的假绿链是独立缺口。逐字裁定：[rulings-2026-10-29.md](rulings-2026-10-29.md)。

- [开发决策报告与缺口分类](issues/09-decision-report.md)：**已收口** —— 六类缺口：已具备 6 · 已实现需补证据 7 · 生产实现缺口 10 · 机制不可观测/判定 6 · 证据/身份/版本管理缺口 7 · 证据不足 7。**下一步唯一优先 = P0-02 A 付费试跑**；第二个 Demo 可进入实施（A），条件：预算授权 + 只新增输入（intent/参考图/自定义 scenario）+ 不改生产代码/不手改中间 JSON；核心验收 `collect-pickup` + `reach-goal`，`open-chest` 可选；新参考图→新视觉世界/资源包；证据=真实运行+delivery+真实浏览器 Playtest，正式清单/`verify-delivery` 后续补齐。最高风险：delivery 壳级 E3、v2 playtest 写回、默认场景常量、几何可通关、新交付清单。B 假绿链独立。详见 [research/09-decision-report.md](research/09-decision-report.md)。

- [写主文档并自检](issues/10-write-main-doc.md)：**已收口 · 地图关闭** —— `docs/v7.6/p0-01-readonly-capability-audit.md`（287 行，PRD §6 十节 + §8 清单 18/18）；能力矩阵 52 行（31 E2E / 17 TESTED / 4 UNKNOWN / 0 BLOCKED），机制 10 条（交付级 E3 3/10、严格全链 2/10）；Playtest/视觉/证据八项；候选 A/B/C 与 HITL 裁定 A；下一步唯一优先 P0-02 A 试跑；引用路径全部存在、生产代码零 diff、零付费、零历史覆盖。详见 [主文档](../../docs/v7.6/p0-01-readonly-capability-audit.md)。

## Not yet specified

<!-- in-scope fog that graduates as the frontier advances -->

（无）—— 10 收口完成；**无 open ticket，P0-01 目的地已达。**

开图时留下的三项（P0-02 的预算/执行计划、新交付的正式证据清单与 `verify-delivery`、浏览器机制探针是否用于补证据）
都是**本图目的地之后**的工作：P0-02 是新 effort，新交付证据清单是后续需求，浏览器探针只在需要新行为观测时按 Q7 单独批准。
审计文档的入库拆分方式按 Q9 在收口后单独请求授权。

## Out of scope

- 修改生产代码、公共契约、CLI/MCP、运行时或依赖；修改测试以改变验收结果（PRD §3.2 / §7 / 补充裁定 ④）。
- 付费模型调用；重新生成资源或站点；启动第二个 Demo 的正式生成。
- 覆盖历史 run / pack / delivery / 验收报告；把历史报告复制成新 Demo 的证据。
- 新增机制注册表、自动修复/进化能力、跨游戏知识共享/迁移、多游戏运行时。
- 在本期顺手修复任何代码缺口；把审计结论直接当成实施授权。
