# FPVS-V1 Final Acceptance：真实 Demo 最终验收闭环

Labels: wayfinder:map
Tracker: local-markdown
Effort: fpvs-v1-final

> **本图 2026-10-27 开。** 输入：`docs/v7.5/demo.md`（FPVS-V1 Final Acceptance）。
> **收口形态（用户 2026-10-27 逐字）**：**(b) 承载执行** —— 每张票 = 一个决策或一段实现，
> 收口到代码 + 测试 + 真实产物验收，与 `fpvs-v1-p0` / `fpvs-v1-p1` / `playtest-v1` 一致；
> 完成条件即验收判据。
> **方向裁定（用户 2026-10-27 逐字）**：
>   **(a) 终点是可信结论，不是通过** —— `fail` / `blocked` / `incomplete` 都是合法收口结果；
>   **(b) 验收对象是冻结的真实产物** —— 本轮证据绑定 `.scratch/fpvs-v1-final/artifacts/` 中的只读快照，
>   记录原始路径与哈希；不修改历史产物；
>   **(c) 真实操作与人工判断各司其职** —— 用现有 harness 的真实按键执行可复现的通关序列；
>   视觉审核由人类在会话中看到完整材料后逐项判断，不能用历史 PASS 替代本轮审核；
>   **(a) 通关证据以语义动作序列为主、策略修改为备、人工试玩为最后**；
>   **(a) 缺陷修复只限配置/管线级确定性缺陷** —— 需重写 Runtime 或重新付费生成则停止修复、按实际证据收口；
>   **(a) 最终结论复用 `delivery.verdict`** + 另出人类可读 Markdown 报告，不新增契约字段。
> **三个实施前必须锁定的细节（用户 2026-10-27 逐字）**：
>   ① FA-01 快照要**证明字节一致**：哈希清单覆盖验收所需文件，明确路径/相对路径/算法/缺失处理；
>   只读是验收约束，不能只靠目录命名；
>   ② FA-02 动作序列**不能绕过真实游戏**：`move_to / jump_over / wait_until` 只是验收脚本的表达，
>   执行必须经过现有 harness 的动作与真实输入通道，并由运行时观测确认；动作语义不足时先审计，不悄悄扩协议；
>   ③ FA-04 视觉审核**必须等待真实材料**：材料绑定 FA-01 冻结版本，缺材料项明确标「无法确认」，
>   不得先 PASS 后补图。
> **前置（继承，不重开）**：`playtest-v1` 已收口（五态归因 + 版本绑定 + 证据三值 + 基线）；
> `fpvs-v1-p1` 已收口（`delivery` 六检查项 + 四值 verdict + 视觉评审写入）。
> 本图只在冻结的真实产物上补齐最终验收证据，不重写这两条链路。
> **顺序纪律（用户 2026-10-27 逐字）**：先冻结验收对象并审计现有 harness 的动作能力；
> 在 FA-01 与 FA-01A 收口前，不启动通关脚本开发。FA-01A 已收口，但它暴露的 gate 停点、
> 动作/策略缺口、交付链缺口由 FA-01B / FA-01C / FA-01D 裁定，三者收口前 FA-02 不开工。

## Destination

为**冻结的真实 Demo**（`wasteland-scavenger-recipe` · `pack/v1` · `site/v1` · shell 2 的只读快照）
产出可追溯、可复核的 **FPVS-V1 最终验收结论**：真实玩家操作完成目标、人工视觉审核绑定同一版本、
`delivery.verdict` 与 CLI/MCP/报告一致；结论允许 `pass` / `fail` / `blocked` / `incomplete`，
未知、缺失或无法复核的证据不得升级为通过。

## Notes

- **输入（只读）**：`docs/v7.5/demo.md` 是需求规格；`CONTEXT.md` 是领域词汇唯一权威。
- **验收对象（起点事实）**：`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe/`
  （`pack/v1` · `site/v1` · shell 2 · `run/v1/game-config.json`）；上一轮真实试玩 `success-basic`
  = `AGENT_LIMITATION`（collected 3/6，10 次 reset，卡在巡逻危险物），交付 `verdict = incomplete`。
- **FA-01A 审计结论（2026-10-27）**：
  - 现有 `move_to` / `reach_goal` 只向右、只认 gate 或 pickup 下标；`wait_until` 只有 won/collected；
    `jump_over` 的 hazard 目标被丢弃、`assert_state` 是空操作；**不能表达**「等待巡逻相位/避开宽范围巡逻」。
  - 策略的 `pickupAbove` 会在本关 scrap-2 / scrap-3 前无条件起跳，正好落进 patroller-1 / patroller-2
    的巡逻区，是上一轮反复 reset 的直接原因。
  - **gate 停点缺口（已修复）**：FA-01B 实测停在 `x=1360.5 / right=1372.5`，离 gate 盒 7.5px；
    已改为「右边界 + 垂直重叠」，修复后隔离诊断 `won=true`（该诊断移走了第二只巡逻怪，非验收证据）。
  - **交付链缺口**：验收场景放 effort `scenarios/` 只能用 `playtest.mjs --scenario-dir` 跑；
    `game-maker playtest` 硬编码五态目录且只收 `required:true`，进不了 CLI 归因/写回。
  - **观测面**：启动/移动/跳跃落地/拾取/宝箱/目标可直接证明；危险物只有 `reset` + trace 间接证据
    （本关 `hits` 恒 0，没有 `hazard-hit` 事件）。
  - **分类**：场景动作/代理控制不足（AGENT_LIMITATION 族）+ harness 确定性停点缺口，
    **不是已证明的游戏不可完成**（静态可达性通过；历史 v3 曾通过 patroller-1 到 x=772.5）。
  审计全案：[research/harness-capability.md](research/harness-capability.md)。
- **FA-01 冻结结论（2026-10-27）**：快照 66 文件只读、工作区 66 文件可写、历史参考 14 文件；
  身份三方一致（manifest / config / 历史试玩）；哈希 80 条。work 的 qa-report 无 `delivery`，
  FA-02 前需初始化本轮信封（FA-01D）。
- **交付链（FA-01D 已定）**：`game-maker playtest --scenario-dir`（可选）+ E1 新鲜 delivery；
  不改 MCP/协议/默认五态。work 的 `qa-report.json` 已有 delivery（verdict=incomplete、visual=pending）。
- **P0-06 起点**：`fpvs-v1-p1` 票 02 曾记录同一产物的人类 PASS；本图按用户裁定**重新审核**，
  旧 PASS 只作历史参考，不自动继承。
- **最终收口规则（用户 2026-10-27 逐字）**：
  `pass` = 所有强制条件都有充分证据、真实通关已证明、视觉审核通过；
  `fail` = 有证据证明强制条件不满足，且已确认是游戏缺陷或审核不通过；
  `blocked` = 环境/依赖/外部阻塞使必要验证无法继续；
  `incomplete` = 必要步骤未完成，或证据不足以作出可靠结论。
  只需修改配置或管线即可修复的确定性缺陷 → 生成新版本并重新验收；需要重写 Runtime 或重新付费生成
  → 停止修复，按实际证据收口，不扩大本阶段范围。
- **零付费 / 离线优先**：复用现有真实产物；不因验收重复付费生图、不新增付费调用。
- **交付契约稳定**：复用 `delivery.verdict` 与六项检查；不新增 schema / 枚举 / 字段；确需扩展时单开审批票。
- **工作树纪律**：不改既有 `fixtures/`、`game-maker.local.json`；不 `reset`/`clean`；不提交/推送除非单独授权；
  测试产物只写 `out/` 或本 effort 目录；历史 `run/vN` / `pack/site/vN` / 报告零改动。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径 + 身份）。

## Decisions so far

<!-- the index: one line per closed ticket -->

- [FA-01 冻结验收对象](issues/01-freeze-acceptance-object.md)：**已收口** —— 只读快照 66 文件 +
  可写工作区 66 文件 + 历史参考 14 文件；快照/参考 `chmod -R a-w`、0 可写条目；snapshot/source 与
  work/snapshot 逐文件哈希一致；manifest、config、历史试玩身份三方一致；哈希清单 80 条、24 项关键检查
  全命中。审计：[research/freeze-audit.md](research/freeze-audit.md)。新发现：work 的 qa-report 无
  `delivery`，CLI 会拒绝 → 初始化本轮 delivery 信封归 FA-01D / FA-02。
  → 解除 FA-01B / FA-01D 阻塞；FA-01C 仍被 FA-01B 阻塞。
- [FA-01A harness 动作能力与观测覆盖审计](issues/02-harness-action-audit.md)：**已收口** —— 现有动作可表达
  「按顺序收集 + 到达 gate」，但不能表达「等待巡逻相位/避开宽范围巡逻」：`jump_over` 的 hazard 目标被丢弃、
  `assert_state` 空操作、`wait_until` 只有 won/collected、策略的 `pickupAbove` 主动跳进危险区；
  另发现 gate 停点可能早约 8px（静态推断，需实跑确认）与 CLI 五态硬编码导致验收场景进不了写回链。
  分类 = 场景动作/代理控制不足（AGENT_LIMITATION 族）+ harness 确定性停点缺口，不是已证明的游戏不可完成。
  审计全案：[research/harness-capability.md](research/harness-capability.md)。
  → 毕业 [FA-01B](issues/03-gate-stop-confirmation.md) / [FA-01C](issues/04-win-route-ruling.md) /
  [FA-01D](issues/05-delivery-chain-ruling.md)。

- [FA-01B gate 停点确认与判定修复](issues/03-gate-stop-confirmation.md)：**已收口** ——
  真实运行被危险物挡住（120s 到 x=813），改用 `mutate-hazard` 隔离诊断（非验收证据）：
  修复前 `collected=6` 但停在 `x=1360.5 / right=1372.5`、`won=false`，确认 7.5px 缺口；
  修复 `policy.mjs` / `observe.mjs` 为「右边界 + 垂直重叠」，修复后隔离诊断 `won=true`、`win=1`。
  新增 4 个离线用例；`pnpm test:playtest` 81 测试 + self-test 全绿；全仓 `pnpm test` 2132 测试绿；
  站点字节未改（self-test 误写历史证据已 `git restore` 恢复）。
  报告：[runs/2026-10-27-gate-stop/README.md](runs/2026-10-27-gate-stop/README.md)。
  → 解除 FA-01C 阻塞；FA-02 仍需 FA-01C / FA-01D，且必须在不移动危险物的真实运行中取证。

- [FA-01C 通关路线裁定](issues/04-win-route-ruling.md)：**已收口** —— 用户 2026-10-28 逐条裁定：
  Q1(d) 自动策略优先、诚实兜底；Q2(i) 先改策略 + runner 的等待/松开右键、危险区抑制 `pickupAbove`，
  必要时补 Q2(ii) `jump_over`/`assert_state`；硬边界：不写死坐标/hazard ID/固定时间，2–3 次迭代；
  Q3(i) 人工证据用 headful Chrome + CDP + READ_STATE + 截图/录屏，标 `human`；Q4(i) 不新增契约字段，
  自动 SUCCESS 做不到就 `incomplete`。FA-02 四个前置已确认。→ 解除 FA-01C 阻塞；FA-02 仍待 FA-01D
  的交付链裁定（策略迭代可先开工）。

- [FA-01D 验收场景进入交付链](issues/05-delivery-chain-ruling.md)：**已收口** —— 用户 2026-10-28 裁定
  (a) `--scenario-dir` 可选参数（相对 cwd、默认五态不变、不加 MCP/命令/协议/输出字段）+ (E1)
  `buildSiteSuccessDelivery` 新鲜 delivery。`selectScenarios` 纯函数保留 `required:true`/
  `harnessCondition:none`；缺值 exit 2，目录/场景无效 exit 4；9+1 测试；work 信封已初始化
  （六项检查、verdict incomplete、QA 层未变、快照零写入）；全仓 2142 测试 + typecheck + build 绿。
  → 解除 FA-02 阻塞。

- [FA-02 真实试玩通关证据](issues/06-real-playtest-win-evidence.md)：**已收口** —— 在冻结工作区上用
  真实按键通道取得自动 `SUCCESS`：`won=true` / `collected=6` / `chestsOpened=2` / `resets=0` /
  `runtime-error=0`；策略改为「巡逻带外沿等待（松开右键）+ 按实时几何/相位跨带起跳 + 危险区抑制
  `pickupAbove` + 通用起跳安全推演」，物理量取自游戏自己的 `player.move`，未改协议/坐标/id；
  `READ_STATE` 增加只读危险物盒足迹；新增 11 个离线策略用例。迭代 1 失败证据保留（19 reset，
  卡平台左面）；迭代 2 通关后，最终代码再跑 3 次（`harness-final` ×2 + 交付链 v2）全 SUCCESS、
  投影一致。CLI 写回 attempt v2（453 steps）：`playable-smoke=pass`、`visual-review` 仍 pending ⇒
  `verdict=incomplete`（试玩通过 ≠ 最终验收通过）。站点字节未改、快照 80 条哈希零变化；
  全仓 2153 测试 + typecheck + test:playtest 92 测试绿。
  报告：[runs/2026-10-28-acceptance/README.md](runs/2026-10-28-acceptance/README.md)。
  → 解除 FA-03 阻塞。
- [FA-03 缺陷归因与有限修复](issues/07-defect-attribution-fix.md)：**已收口** —— FA-02 的 `SUCCESS`
  复核成立（21 项只读检查全过；真实 `attribute()` = executed/SUCCESS/evaluate；身份三方一致、
  80 条哈希零变化）；无配置/管线级确定性缺陷 ⇒ **零修复、零新版本产物**。失败迭代复核为
  `AGENT_LIMITATION`（19 reset、3138 步），历史结果可读不升级。误归因风险（gateReached + won=false →
  规则 ④）本次未触发（0 采样、集齐守卫先满足、win 时 collected=6），作为已知限制记录（改语义需审批）；
  FA-02 报告的 25.8px 净空不可复现，可复现读数 18.75/6.25px，结论不变。新增 7 个纯离线边界用例；
  `pnpm test` 2160/145 + typecheck + `test:playtest` self-test 4/4 + 96 测试绿。
  报告：[runs/2026-10-28-attribution/README.md](runs/2026-10-28-attribution/README.md)。
  → 前沿移至 FA-04（视觉人工审核）与最终汇总。

## Not yet specified

<!-- in-scope fog that graduates as the frontier advances -->

- **有限策略修复能否在真实危险物下产出自动 SUCCESS**：**已由 FA-02 回答 = 能**（2 次迭代内；
  4 次真实运行全 SUCCESS）。Q4(i) 的兜底（人工证据 / `incomplete`）不触发；人工证据不再需要。
- **FA-03 在"已通关"后的实际范围**：归因复核改为「确认 SUCCESS 证据充分 + 危险物接触的间接证据
  措辞 + FR-03 离线边界测试」；不再有"未通关原因判定"的主体，若发现新缺陷按配置/管线级有限修复处理。
  **已由 FA-03 回答 = 无新缺陷、零修复**：SUCCESS 证据充分；危险物措辞已用可复现读数修正；
  FR-03 补 7 个离线用例；唯一遗留是规则 ④ 的**潜在**误归因路径（未触发，改语义待审批）。
- **最终 verdict 非 pass 时的「未解决项 / 限制」结构**：逐项证据引用、缺口、阻塞原因
  （取决于最终结果是 fail / blocked / incomplete 中的哪一种）。
- **若 FA-03 产出新版本产物，需要重做哪些取证**：试玩、视觉、报告的身份重绑范围
  （取决于缺陷是否出现及修复层级）。
  **已由 FA-03 回答 = 不适用**：没有新版本产物，验收对象仍是 FA-01 冻结的 `pack/v1 · site/v1 · shell 2`。

## Out of scope

<!-- work ruled beyond the destination; closed, never graduates -->

- **重写 Runtime / 新增游戏机制 / 改 shell**（`SHELL_VERSION` 不升、站点字节不动）。
- **新增付费 E2E 或模型调用**；重新生成 Demo 的付费路径。
- **未经审批的 contracts / CLI / MCP 公开输入输出变更**；新增第三方依赖；改 `playtest-scenario/v1` 协议。
- **覆盖 `run/vN`、`pack/site/vN` 或已发布报告**；删除不利结果制造通过。
- **把历史 `playable-smoke` 数据升级为 Playtest V1 新证据**。
- **降低验收标准 / 删除测试 / 缩减覆盖 / 改阈值**；用 `setup.mutate-hazard` 或改 config 造通关。
- **P1 视觉一致性验收 V1 的自动化相似度系统**：本图只做 P0-06 人工确认，不做参考图↔资源的自动打分。
- **塔防 demo 与其他游戏**；自动修复循环 / 自主 AI 修复；人工豁免机制（doc §6 注）。
