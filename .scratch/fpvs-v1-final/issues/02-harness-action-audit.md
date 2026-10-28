# FA-01A harness 动作能力与观测覆盖审计

Type: research
Status: resolved
Owner: research subagent · 2026-10-27
Map: ../map.md
Blocked by: —

## Question

只读审计现有 Playtest V1 harness 的动作语义、观测面与场景契约，回答「能否用现有能力表达并证明
一条通关路径」，为 FA-02 提供可执行的动作序列草案与缺口清单。
**不改代码、不扩展协议、不跑 Chrome。**

1. **动作全集**：`move_to` / `jump_over` / `wait_until` / `reach_goal` / `assert_state` 的实现、
   参数、终止条件、失败/超时行为；能否表达「避开宽范围巡逻危险物」「上平台取物」「等待时机」。
2. **观测面**：`READ_STATE` 字段、11 类事件、断言三值、trace/input 粒度；能否证明
   启动 / 移动 / 跳跃与落地 / 收集物 / 宝箱 / 危险物 / 游戏目标七个维度。
3. **场景契约**：`playtest-scenario/v1` 是否允许新增「验收通关场景」而不改协议；场景放哪、
   如何绑定 `siteVersion`、如何避免与五态自测混用；`expectedOutcome` / `baselineEligible` 怎么设。
4. **缺口**：若现有动作无法表达通关路径，明确是「场景表达不足」还是「游戏本身不可完成」；
   给出最小可行方案（不改协议 / 需审批的协议变更 / 转人工或策略修改）。
5. **产出**：`.scratch/fpvs-v1-final/research/harness-capability.md` + 一条建议动作序列草案
   （草案不作为最终证据，只供 FA-02 执行）。

边界：只读 `packages/demo/probe/playtest/`、`packages/contracts/src/playtest*.ts`、场景文件与
`packages/cli`/`packages/pipeline` 中相关写回路径；不改 `packages/`、`fixtures/`、历史产物；
不发起真实运行。

## Answer

产出：`.scratch/fpvs-v1-final/research/harness-capability.md`（含逐项 file:line、E2/E3 引用与场景草案）。
**结论：现有能力不能可靠表达并证明一条通关路径；主因是动作/策略表达不足，另有 gate 停点静态缺口；不是已证明的游戏不可完成。**

1. **动作全集**：`move_to`/`reach_goal` 只按 ArrowRight + 策略自动跳，目标只认 `gate` 或 `pickup[index]`；
   `jump_over` 的 hazard 目标被丢弃（当 `reach_goal` 执行）；`assert_state` 是空操作；`wait_until` 只有
   `won`/`collected` 条件；`timeout` 会跳过所有后续动作（`runner.mjs:153-184,248-253`；`playtest.ts:335-346`）。
   没有左移/刹车/定点停/按时间或危险物相位等待。**能表达“上平台取物”“按顺序收集再到达 gate”；
   不能表达“等待时机/避开宽范围巡逻危险物”。** 自动策略的 `pickupAbove` 还会在危险区前无条件起跳
   （`policy.mjs:65-68`），与本关 scrap-2(x=466)/scrap-3(x=850) 的位置叠加，是反复 reset 的直接原因。
2. **观测面**：READ_STATE 字段见 `probe-harness.mjs:207-235`；落盘 trace 裁掉了 `solids` 与 hazard 的
   `axis/distance/periodMs/t0`（`observe.mjs:8-21`）。11 类事件可覆盖启动/移动/跳跃落地/拾取/宝箱/目标；
   巡逻危险物没有 `hazard-hit`，只能靠 `reset` + trace 间接判定，`hits` 只统计 `danger`，本关恒 0
   （`observe.mjs:104-115,127,215`）。断言三值、`onInsufficient` 写死 unknown、`withinMs`/`requires`
   只声明不执行（`observe.mjs:156-201`；`playtest.ts:330-331`）。
3. **场景契约**：`playtest-scenario/v1` 允许新增验收场景而不改协议（`playtest.ts:357-393`）；放
   `.scratch/fpvs-v1-final/scenarios/` 用 `playtest.mjs --scenario-dir` 运行；`target.siteVersion=1`
   绑定 site，报告 checksum 提供强身份。但 CLI 硬编码五态目录且只收 `required:true`
   （`cli/src/playtest.ts:23,109-122`；`cli.ts:758-765`），所以本 effort 场景目前**进不了 CLI/写回链**。
   `expectedOutcome` 只是设计意图、不参与归因（`playtest-attribution.ts:3`）；`baselineEligible` 在现有
   代码里只转抄不参与比较（`runner.mjs:85,268`；CLI 基线只看 scenarioId 文件，`cli/src/playtest.ts:229-242`），
   验收场景设 `false` 最干净；不要放进五态目录。
4. **缺口分类**：主因是“场景表达/代理控制不足”（AGENT_LIMITATION 族），不是 GAMEPLAY_FAILURE。
   需求文档明确“该现象目前不能直接判定为游戏本身不可玩”（`docs/v7.5/demo.md:37`）；静态可达性未报不可达
   （`qa-report.json:13`）；真实运行 v3 曾通过 patroller-1 到 x=772.5（`.../v3/success-basic/trace.jsonl:326`）。
   但**人类一定可通关无法确认**（patroller-2 从未被通过，也无人工证据）。另有一条**静态推断、需 FA-02 实跑确认**
   的硬缺口：`targetReached` 在 `x >= gate.x - 20`（本关≈1360）就停，gate 盒左边界 1380、玩家右边界 x+12，
   可能还差约 8px 才触发 `tryWin()`（`policy.mjs:74`；`game-config.json:166-173`；`manifest.json:337-351`；
   `trace.jsonl:1`）。若成立，即使收集全也无法通关，且 `gateReached=true/won=false` 会被误归因为
   GAMEPLAY_FAILURE（`observe.mjs:156-165`；`playtest-attribution.ts:145-147`）。
5. **草案**：研究文件 §5 给出可解析的 `playtest-scenario/v1` JSON：四个 `move_to pickup[index]` 检查点 +
   `wait_until collected>=6` 守卫 + `reach_goal` + `wait_until won`，并说明每步预期观测、为何不用
   `mutate-hazard`/改 config、以及 gate 停点/chest-2 不可定向/CLI 不入链等风险。**草案不是最终证据**。
6. **建议 FA-02**：先用草案做一次真实诊断运行，并先确认 gate 停点（读 gate 静态体或观察是否 `won=true`）；
   若确认 8px 缺口，按确定性缺陷走修复审批（方案 G，不改协议）；若被危险物时机卡住，申请“不改协议”的
   策略/CLI 变更（方案 B/C/E）或按 FR-02 用人工试玩补证据并明确标记（方案 F）；不得把 `AGENT_LIMITATION`
   算成游戏失败，也不得用 setup 改危险物造通关。

