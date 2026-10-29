# P0-02：A 平台探索/收集 付费试跑与交付证据

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-02-second-demo

> **当前状态（2026-10-29）：零付费准备可继续；真实付费执行 BLOCKED（LiteLLM 零预算验证阶段）。**
>
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
- **预算闸（Q2 c）**：票 01/14/19 均未授权；严格 $6 硬停止不可得。P0-02 可继续零付费准备；**付费执行 BLOCKED**。继续路径 = 票 22（LiteLLM 零预算 429 验证）→ 票 23（预算授权 v5）。票 23 未通过前，任何付费命令都不得运行。
- **执行路径（Q3）**：两段式 `create`（不带 `--yes`）→ checkpoint 人工审查 → `build`。checkpoint 应提供 design / recipe / plan；材料缺失即暂停并报告，不绕过。
- **输入（Q4）**：代理起草 intent 与关卡概念；参考图必须用户提供/批准；scenario 在最终 config 后起草、用户批准；未经批准不得付费生图。**参考图闸**：票 15 → 16 → 17 已收口（用户接受 `rooftop-dusk.png`）；票 05 现在只阻塞在预算授权 v3（票 19）。
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

- [起草 A 的 intent 与关卡概念](issues/03-draft-a-inputs.md)：**已收口（起草）** —— **屋顶信使**：黄昏城市天际线，4 封信 `collect-pickup` + `reach-goal`；5 段屋顶，台阶 ≤50px、缺口 ≤55px（在 60.5/66 上限内）；无 hazard/danger/moving；16 色视觉；资源表 12 项 + 可选信箱；新参考图要求已列。零付费、零生成、零生产修改。待票 04 HITL 批准输入与参考图。详见 [inputs/a-intent.md](inputs/a-intent.md) · [a-level-concept.md](inputs/a-level-concept.md) · [a-assets.md](inputs/a-assets.md)。

- [批准 A 的输入与新参考图](issues/04-approve-a-inputs-and-reference.md)：**已收口（HITL）** —— 概念/输入继续；Q1 **b** 程序化生成新的黄昏屋顶城市参考图（零付费、确定性、可复现，生成后先检查再验收）；Q2 **a** 保持 4 封信 + 可选信箱；Q3 **a** 全部边界确认。核对发现现有 `generate.mjs` 硬编码为黄昏山间列车小站、无参数，参考图路径升级为票 15「裁定参考图生成路径」→ 16「生成并检查」→ 17「验收参考图」；票 05 已阻塞在 17。付费执行仍阻塞于预算 v2。

- [裁定参考图生成路径](issues/15-reference-image-path.md)：**已收口（HITL）** —— 路径 **(a) 新建 effort-local 脚本** `.scratch/p0-02-second-demo/tools/generate-reference.mjs`，复用 `draw.mjs`，零付费/确定性/可复现生成 480×270 黄昏屋顶城市；不改生产代码、现有 `generate.mjs`、fixtures 或历史实验；保留屋顶信使 + 4 封信 + 可选信箱；生成后检查尺寸/色彩/provenance/视觉效果，票 17 由用户验收；票 17 接受前不运行 `create` checkpoint。详见 [rulings-2026-10-29.md](rulings-2026-10-29.md)。

- [调用成本估算与超限停止机制](issues/13-cost-model-and-stop-mechanism.md)：**已收口（research）** —— 官方价可核实但**端点未核实**：checkpoint ≈$0.073、build ≈$0.535、全量 ≈$0.608、A（16 图）≈$0.68；生图占 77%。结构性最坏 87 趟 ≈$4.32（A 16 图 ≈$4.59；24 图 ≈$5.67）。**不能提供“下一次调用前”可靠动态护栏**（run ledger 阶段末才落盘）；可行的是 Prepay/静态上限 ≥ 最坏/checkpoint 两段闸/staging watcher + `--concurrency-image 1`（有界超射 1–2 张）。`22 次调用`不是货币上限。票 14 需端点主机名、计价档、provider 硬上限与验证方式、金额/覆盖阶段、生图批准、`ANTHROPIC_*` env 处理、重试政策。详见 [research/13-cost-model.md](research/13-cost-model.md)。

- [预算授权 v2（货币上限 + 成本护栏）](issues/14-budget-authorization-v2.md)：**已收口（HITL）· 目标 $6.00 USD 已选但未授权** —— Q1 **c** 端点/计价档未核实；Q2 **a** $6.00 作为单次完整 A 运行的目标上限，尚未生效；Q3 **c** 硬限额未验证前不授权（官方 spend cap/Prepay 有计费延迟，不能当严格 $6 硬停止）；Q4 **b** 暂不批准付费生图；Q5 **a** 执行前移除 `ANTHROPIC_*` 影响并验证 Gemini 文本路径；Q6 **a** 默认重采样、第二次完整运行另行 HITL 批准。**执行仍阻塞**：下一道闸门 = 票 18「零付费核验 provider 端点、计价与护栏」→ 票 19「预算授权 v3」；票 05/06/09 已改为阻塞在 19。逐字裁定：[rulings-2026-10-29.md](rulings-2026-10-29.md)。

- [生成并检查参考图](issues/16-generate-and-check-reference.md)：**已收口（待验收）** —— 新建 effort-local `tools/generate-reference.mjs`，复用 `draw.mjs`，零付费/确定性生成 `inputs/reference/rooftop-dusk.png`（480×270、16 唯一色、每像素在色板内、sha `1b926a5b…f6f2`，两次运行一致）；不改现有 `generate.mjs`/fixtures/历史实验；视觉验收待票 17 由用户确认。详见 [research/16-reference-image.md](research/16-reference-image.md)。

- [验收参考图](issues/17-accept-reference-image.md)：**已收口（HITL）** —— 用户**接受** `inputs/reference/rooftop-dusk.png` 作为 P0-02 参考图输入；480×270、16 唯一色、sha `1b926a5b…f6f2`；接受不等于预算授权。`create` checkpoint 仍只阻塞在预算授权 v3（票 19）。逐字裁定：[rulings-2026-10-29.md](rulings-2026-10-29.md) §6。

- [零付费核验 provider 端点、计价与护栏](issues/18-verify-provider-and-guardrail.md)：**已收口（task）** —— 端点已闭合：image 与文件 text 均为官方 Gemini（`generativelanguage.googleapis.com`），但当前 `ANTHROPIC_*` env 把 text 覆盖到本地代理 `127.0.0.1:15721`；执行前必须 unset 并在干净 env 复核。**严格 $6.00 硬护栏未建立**：官方 Prepay/spend cap 有延迟，本地 proxy 不是计量网关；可行的是有界超射（静态上限 + checkpoint 闸 + staging watcher + `--concurrency-image 1`，约 1–2 张图 ≈$0.034–$0.067）或保持阻塞/换 provider。详见 [research/18-provider-verification.md](research/18-provider-verification.md)。

- [预算授权 v3（核验后生效）](issues/19-budget-authorization-v3.md)：**已收口（HITL）· 保持阻塞** —— Q1 **b**：严格 $6.00 硬停止不可得，不接受有界超射改变约束，因此不授权；Q2 不适用，不批准付费调用/生图。P0-02 可继续零付费准备，但真实付费执行 **BLOCKED**。继续路径 = 票 20「寻找可硬限额的计量网关」→ 票 21「预算授权 v4」；票 05/06/09 已改为阻塞在 21。逐字裁定：[rulings-2026-10-29.md](rulings-2026-10-29.md) §7。

- [寻找可硬限额的计量网关](issues/20-metering-gateway.md)：**已收口（research）** —— **没有 provider 强制的严格 $6 路径**：官方 Prepay 有 ~10 分钟 overage、spend cap 月度非即时、AI Studio cap 实验性；Gemini RPD/Quota override 未获文档支持。最接近 = **LiteLLM Proxy 自托管**：key `max_budget=6`（lifetime）、预请求 429、per-request 预留（含 image）、原生 Gemini 路径、无需改生产代码；先用 `max_budget=0` 零付费验证 429。OpenRouter 非严格（image 不在在飞预留；$5.80 cap 才可能压住，需验证生图路由/PNG）。Cloudflare/Vercel/Portkey/Helicone/Requesty/Kong 不适用；本地 `127.0.0.1:15721` 是 CC Switch，只记日志/用量，无预算执行。兜底 = effort-local 计量代理（自建信任，需实现/HITL）。若只接受 provider 强制，保持 BLOCKED。详见 [research/20-metering-gateway.md](research/20-metering-gateway.md)。

- [预算授权 v4（网关核验后）](issues/21-budget-authorization-v4.md)：**已收口（HITL）· 仅进入零付费验证** —— 选择 **LiteLLM 自托管**路径；$6.00 与付费生图**仍未授权**。先用 `max_budget=0` / `max_parallel_requests=1` 验证原生 Gemini `:generateContent` 与 `/v1beta/interactions` 在转发前返回 429、上游零调用；验证通过后再另行提交预算授权。P0-02 仍 **BLOCKED**；下一道闸门 = 票 22「LiteLLM 零预算硬拒绝验证」→ 票 23「预算授权 v5」；票 05/06/09 已改为阻塞在 23。逐字裁定：[rulings-2026-10-29.md](rulings-2026-10-29.md) §8。

## Not yet specified

- 首次运行失败后是否授权第二次完整运行：须单独 HITL 批准；只允许换输入，不改生产代码，不得拼接两次运行。
- 新交付的正式证据清单与 `verify-delivery`：P0-01 Q5 已留作后续缺口；本期只冻结快照/哈希/身份。
- 最终 P0-02 报告是否进入 `docs/`、以及是否与审计文档一并提交：收口时单独裁定。
- 若 checkpoint 材料不全或 build 在付费前失败，是否换输入后重试：按 Q6 需单独批准。

## Out of scope

- 修改生产代码、公共契约、CLI/MCP、运行时或依赖；修改测试以改变结果。
- 手工编辑中间 JSON；补写缺失的成功证据；把两次运行拼成一次全绿。
- 自动重试直到通过；为通过而降低阈值或跳过检查。
- 复用冻结 wasteland 包/旧视觉世界；降级为“只换关卡”。
- 正式证据清单与 `verify-delivery`（本期只记录为后续缺口）。
- B 的危险时序假绿链修复；C 塔防；D 俯视角/运行时扩展。
- 执行期间提交/推送；任何未获授权的付费调用。
