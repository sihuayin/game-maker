# P0-02：A 平台探索/收集 付费试跑与交付证据

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-02-second-demo

> **本图 2026-10-29 开。** 输入：`docs/v7.6/p0-01-readonly-capability-audit.md`、`.scratch/p0-01-audit/rulings-2026-10-29.md`、`.scratch/p0-01-audit/research/09-decision-report.md`。P0-02 目前没有独立 PRD，本图同时定义它的执行契约。
>
> **终点形态（用户 2026-10-29 逐字裁定 Q1 = (a)）**：**承载执行** —— 从新输入、预算闸、`create/build`、delivery、真实浏览器 Playtest，到证据冻结与最终结论，形成完整闭环。
>
> **方向裁定 Q1–Q9（用户 2026-10-29 逐字）**：
>   Q1 **(a)** 承载执行；Q2 **(c)** 暂不授权付费，只开图；预算授权作为第一张 HITL 票，执行票必须阻塞到获得明确预算授权之后；Q3 **(a)** 两段式：先 `create`（不带 `--yes`）停在 checkpoint，人工审核 design/recipe/plan 后再决定是否进入付费 `build`；checkpoint 材料不全则暂停报告，不绕过闸门；
>   Q4 **(b)** 代理起草 intent 与关卡概念；参考图由用户提供或明确批准；scenario 按最终 config 起草并经用户批准；未经批准不得启动付费生图；
>   Q5 **(b)** 严格检查所有验收项，但失败是合法结论；只有全部必要条件满足才 `pass`，否则按证据 `fail`/`blocked`，不修到通过；
>   Q6 **(b + a 批准式例外)** 首次运行允许管线自身默认重采样，不额外手工重试；第二次完整运行须另获明确批准，只换输入、不改代码，不得把两次运行拼成一次全绿证据；
>   Q7 **(a)** 冻结新 `run/pack/site` 的只读快照、哈希与交付身份，保留 delivery 与 Playtest；正式证据清单与 `verify-delivery` 留后续；
>   Q8 **(a)** 用户亲自审核 Playtest 后的截图/运行画面并给出视觉 verdict；这是 `pass` 的必要条件；未完成审核只能标记未完成/受阻，不得声称视觉通过；
>   Q9 **(a)** 执行期间不提交、不推送；收口后单独请求授权。
>
> **开图边界（用户 2026-10-29 逐字）**：
>   1. 当前状态是允许规划，不允许付费执行；Q2 的预算 HITL 票必须先通过。
>   2. 首次运行失败即保留现场和证据，不自动发起第二次完整运行。
>   3. 不修改生产代码、不手工编辑中间 JSON、不补写缺失的成功证据。
>   4. `pass` 必须同时具备真实交付、真实 Playtest、人工视觉通过和冻结身份；不能把已知的 delivery 壳级 E3、Playtest 写回或正式证据清单缺口伪装成已解决。
>   5. 全程不提交、不推送，直至另行授权。

## Destination

完成一次真实、可复核的 **P0-02 A（平台探索/收集）试跑**：
预算授权 → 起草/批准输入（新 intent、参考图、自定义 scenario）→ 两段式 `create` checkpoint 审查 → 付费 `build` 产出 pack/config/QA/site/delivery → 真实浏览器 `playtest` → 人工视觉审核 → 冻结新交付身份与证据 → 严格 `pass` / `fail` / `blocked` 结论。
不改生产代码、不手改中间 JSON、不新增运行时/契约、不自动重试、不用历史 E3 替代新证据。

## Notes

- **基线**：P0-02 起始生产代码 HEAD（票 02 记录完整 SHA）；必须与 P0-01 基线 `2c1a9d5` 做生产代码 diff，确认零变更。
- **预算闸（Q2 c）**：票 01 已裁定**未授权**；真正的执行闸是票 13（成本估算与超限停止机制）→ 票 14（货币上限授权）。票 14 未通过前，任何可能调用文本/生图上游的命令都不得运行。
- **执行路径（Q3）**：两段式 `create`（不带 `--yes`）→ checkpoint 人工审查 → `build`。checkpoint 应提供 design / recipe / plan；材料缺失即暂停并报告，不绕过。
- **输入（Q4）**：代理起草 intent 与关卡概念；参考图必须用户提供/批准；scenario 在最终 config 后起草、用户批准；未经批准不得付费生图。
- **成功判据（Q5/Q8）**：`create`/`build` exit 0；QA pass；发布闸；site；production shell 写 delivery；`playtest` SUCCESS；人工视觉 pass；新交付身份冻结。任一失败按证据记 `fail`/`blocked`，不修到通过。
- **重试（Q6）**：首次运行只用管线默认重采样；第二次完整运行须单独批准，只换输入；不得把两次运行拼成一次全绿。
- **证据（Q7）**：冻结新 `run/pack/site` 只读快照 + 逐文件 sha256 + 交付身份；保留 delivery/playtest/视觉记录；正式清单/`verify-delivery` 是后续缺口，不在本期伪装为已解决。
- **人工视觉（Q8）**：由用户本人完成；代理不得代审；未审完只能 `incomplete`/`blocked`。
- **工作树纪律**：不 `reset`/`clean`；不改 `packages/**`、契约、CLI/MCP、依赖、测试、fixtures、`game-maker.local.json`；产物只写 `out/`、`.scratch/p0-02-second-demo/` 或本图允许的新目录。
- **提交纪律（Q9）**：执行期间不提交、不推送；收口后单独请求授权。
- **证据来源**：P0-01 主文档 §8、`rulings-2026-10-29.md`、`research/09-decision-report.md`；能力/机制矩阵作为输入，不作为 P0-02 的新证据。

## Decisions so far

<!-- 索引：每张关闭票一行，gist + 链接；详情只在票里 -->

- [预算授权](issues/01-budget-authorization.md)：**已收口（HITL）· 第一轮未授权** —— 22 次调用只是冻结 run 的参考量，不是新设计硬上限，也不能代表货币成本；暂不授权付费、不批准生图；provider 沿用但执行前确认可用性（不读取密钥）；允许默认重采样，每次付费调用前检查预算，无法保证不超限就停；第二次运行须另行 HITL 批准。**执行仍阻塞**：下一道闸门 = 票 13「成本估算与超限停止机制」→ 票 14「预算授权 v2（货币上限 + 成本护栏）」；票 05/06/09 已改为阻塞在 14。逐字裁定：[rulings-2026-10-29.md](rulings-2026-10-29.md)。

- [冻结 P0-02 起始基线](issues/02-freeze-p0-02-baseline.md)：**已收口** —— 起始 HEAD **`4f3bc69`**；生产代码与 P0-01 基线 `2c1a9d5` 零差异（`2c1a9d5..4f3bc69` 仅 21 个 P0-01 文档/effort 文件、3,078 insertions）；工作区仅未跟踪 P0-02 effort + PRD；10 包 / 6,886 tracked / 149 测试；关键输入 sha256 已绑定；未读本地凭据；零生产修改。详见 [research/02-baseline.md](research/02-baseline.md)。

## Not yet specified

- 首次运行失败后是否授权第二次完整运行：须单独 HITL 批准；只允许换输入，不改生产代码，不得拼接两次运行。
- 新交付的正式证据清单与 `verify-delivery`：P0-01 Q5 已留作后续缺口；本期只冻结快照/哈希/身份。
- 最终 P0-02 报告是否进入 `docs/`、以及是否与审计文档一并提交：收口时单独裁定。
- 若 checkpoint 材料不全或 build 在付费前失败，是否换输入后重试：按 Q6 需单独批准。
- 预算的具体金额/调用上限：票 01 未授权；由票 13 成本模型 + 票 14 货币上限裁定；未给出前不执行。
- 超限停止机制能否在不改生产代码的前提下保证每次付费调用前检查（票 13 评估；provider 硬限额 vs effort watcher）。

## Out of scope

- 修改生产代码、公共契约、CLI/MCP、运行时或依赖；修改测试以改变结果。
- 手工编辑中间 JSON；补写缺失的成功证据；把两次运行拼成一次全绿。
- 自动重试直到通过；为通过而降低阈值或跳过检查。
- 复用冻结 wasteland 包/旧视觉世界；降级为“只换关卡”。
- 正式证据清单与 `verify-delivery`（本期只记录为后续缺口）。
- B 的危险时序假绿链修复；C 塔防；D 俯视角/运行时扩展。
- 执行期间提交/推送；任何未获授权的付费调用。
