# 03 差距分诊与策略设计裁定

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

基于 01 的差距清单与 02 的契约表达结论，与人类逐项裁定：

**分诊**

- 每个差距归入：本轮修复 / 记录为已知限制 / 划出范围。继承的证据逐条确认「可继承 / 需重验 / 不可继承」。
- 明确本轮不做的事，防止最小修复膨胀。

**策略设计（Q3(a) 的三类危险形态）**

1. **横向巡逻**：保留现有「带外等待 + 相位窗口 + 跨带推演」，还是重写？现有实现的已知边界（平台近似、落地按 `floorY`）是否接受？
2. **纵向巡逻**：把三角波模型推广到 `axis:"y"`，还是用更保守的「带外等待」？纵向运动与重力/跳跃如何交互？
3. **定时喷发（`dangers`）**：Q7(b) 只读暴露盒足迹 + `periodMs` + `activeMs` + `t` 后，策略用「窗口推演」还是「state-only 保守等待」？`t` 的可信边界（场景启动毫秒、命中不复位、重载归零）如何写进判据？字段缺失/周期非法时如何回落？
4. **无进展 / 重复重置**：阈值（步数制、非墙钟）、进展度量（最大 x / 收集数 / 目标状态）、主动停止的语义与证据落点（按 02 的结论）。
5. **跳跃验证**：用 `onFloor` / `vy` / 位置变化确认「跳发生了」；单次跳跃尝试上限、连续失败后的动作。
6. **等待上限**：独立最大等待步数/时长与结束条件。
7. **`pickupAbove` 可达性**：什么算「足够证据」才追？不可达时跳过非必需目标、报告能力不足的边界。

**继承与记录缺口（01 发现）**

8. **视觉审核七项覆盖**：FA-04 记录的是六项（整体风格 / 色彩与明暗 / 角色 / 场景 / 关键物件 / 实际运行效果），
   §7.3 要求七项（风格一致性 / 角色辨识度 / 场景完整性 / 画面可读性 / 动画表现 / 玩法与视觉对应关系 / 整体完成度）。
   如何映射？缺失项是否需要人工补审？`08-goal.png` 与 `09-final.png` 字节相同是否可接受？
9. **记录缺口**：审核记录身份未绑定 delivery、视觉结论无 evidence ref、`delivery.evidence` 读取不重算哈希 ——
   记已知限制 / effort 脚本核验 / 另开加固票？本轮不得声称已加固产品读取路径（Q8(b)）。
10. **最终 verdict**：历史 `pass` 只覆盖 delivery/试玩/视觉，不覆盖 P0-1 通用性；本轮最终结论的判定口径是什么？

输出：每项的实现判据 + 验收测试清单 + 明确不做什么。此票收口后，04/05 才开工；05 另受 08 阻塞。

## Answer

**2026-10-28 用户逐项裁定：Q1–Q11 全部采纳推荐项。本票只锁定判据与语义，不实施；04/05 开工时按此执行。**

### 裁定表

| # | 问题 | 裁定 | 锁定内容 |
|---|---|---|---|
| Q1 | 横向巡逻 | **A 保留** | 保留 FA-02 已验证的带外等待、三角波相位窗口、跨带推演与 `jumpPredictionSafe`；不重写通用时间窗引擎 |
| Q2 | 纵向巡逻 | **A，字段缺失按 B 回落** | 按**完整扫掠范围**判相关性；「盒底高于玩家头顶」的垂直安全窗口 ≥ 穿越时间 + 余量才过；不沿用只看当前帧的 `verticalOverlap` |
| Q3 | 定时喷发 | **C 逐级回落** | 正常用 `t/periodMs/activeMs/d.box` 推演；字段缺失/非法 → state-only；连 state 都没有 → 不穿越 + 等待上限 |
| Q4 | 无进展与重置 | **B + 300 步 + 5 次** | 复合进展指标；连续 300 观测步无进展 / 累计 5 次重置 → 主动停止 |
| Q5 | 等待上限 | **A 120 步** | 连续 `advance:false` 120 步 → `wait-limit`；恢复推进或新进展清零 |
| Q6 | 跳跃验证 | **A** | 发键后 3 步内验证；连续 3 次未观察到 → 降级为不跳；累计 5 次失败且无替代推进手段 → `jump-exhaustion` |
| Q7 | `pickupAbove` | **A** | 平台几何 + 单跳包络判可达；不可达的非必需目标跳过但**不得静默**；必需目标不可达如实归因；所有起跳前都做 `jumpPredictionSafe` |
| Q8 | 视觉审核 6→7 | **A 补审四项** | 追加画面可读性 / 动画表现 / 玩法与视觉对应关系 / 整体完成度；追加记录，不改历史 FA-04 |
| Q9 | 证据缺口 | **A 只记录 + effort 脚本** | 07 机械核对 subject/delivery/逐文件 sha256/site-integrity/QA evidence；报告披露产品读取路径仍不重算哈希；不新开加固票 |
| Q10 | 剩余范围 | **全部 A** | 五态 E2E 本轮不做；07 修正基线叙述；契约 `stop` 表示由 08 裁定 |
| Q11 | 最终 verdict | **A 双判定** | `deriveDeliveryVerdict` + §5.5 八项逐项 MET/PARTIAL/NOT MET；两者均通过才 `pass`；历史 `pass` 不得覆盖本轮失败 |

### 一、策略判据（锁定）

**横向巡逻（04 不重写，05 只补缺口）**
- 保留：巡逻带外等待、相位窗口 `crossingWindow`、`jumpPredictionSafe`、等待点 `bandLeft - 2px`、`CROSS_*` 余量。
- 已知近似接受并披露：推演落地按 `floorY`（站平台时保守多掉）、只支持 `motion.kind:"cycle"`、等待点按轮询帧滑行约 3px。

**纵向巡逻（04）**
- 相关性：用危险物**扫过的垂直范围**（行程两端对应的 `top/bottom`）与玩家高度判断；不得沿用只读当前帧的 `verticalOverlap`，否则高处待命的纵向危险物会被过滤掉。
- 决策：复用 `hazardAnchor` 同一三角波公式；算出「盒底高于玩家头顶」的时间窗；窗口 ≥ 穿越时间 + 余量才通过；整周期无窗口 → 等；等待超 120 步 → `wait-limit`。
- 与重力/跳跃：通过纵向危险**不要求起跳**；不得把跳跃当作纵向规避手段（跳进运动轨迹更危险）。
- 回落：缺 `distance/periodMs/t0/width/height` 等必要运动字段 → 保守带外等待，不猜窗口。

**定时喷发（04）**
- 推演：`phase = t % (periodMs + activeMs)`；`periodMs` 是安全窗口、`activeMs` 是喷发窗口、完整周期是两者之和；命中盒用 `d.box`，不是 sprite body。
- 安全余量 ≥ 2×(poll + step) ≈ 150ms；`state === "active"` 时绝不进入；多个 danger 逐一路径推演（任一不满足即等待）。
- 回落阶梯：缺 `box`/`t`/`periodMs`/`activeMs` 或数值非法 → 只用观测到的 `state`（只在观测到 `idle` 时进入），trace 记 `danger-window-unknown`；连 `state` 都没有 → 不穿越 + 等待上限。
- `danger-window-unknown` **不得**加入 `events.jsonl` 的 11 类闭集，也不得扩契约；记录在 `trace.jsonl` 的策略注解（或等价的非契约 sidecar），由 04 选择一种并测试。

**跳跃验证（05）**
- 发出跳跃输入 ≠ 跳跃成功；发键后 3 个观测步内必须观察到 `!onFloor || vy < 0 || bottom 相对发键前下降 ≥ 2px`。
- 连续 3 次未观察到 → 降级为「不跳、继续走/等」；同一动作累计 5 次失败且**不存在替代推进手段** → `jump-exhaustion`。成功一次清零失败计数。

**收集物可达性（05）**
- 判据：存在一个 solid 顶面在玩家脚底上方 ≤ `maxJumpHeight`（`v²/2g`，用被验收游戏的 `player.move` 算；默认 ≈ 60.5px）且水平覆盖拾取物 x，并且从该顶面再跳到拾取物高度也够。
- 不可达的非必需目标：跳过，但记录 `pickup-unreachable` 证据（拾取物下标 + 缺失的平台几何），**不得静默**。
- 必需目标不可达：本次运行以未收集结束，按五态如实归因（`AGENT_LIMITATION` / `TIMEOUT`），**不得判成游戏失败**。
- 所有起跳前都做 `jumpPredictionSafe`（现在只在危险分支做）。

### 二、停止与预算（锁定）

| 规则 | 锁定值 |
|---|---|
| 无进展窗口 | 连续 **300** 个观测步（自最后一次进展事件起计） |
| 重置预算 | 累计 **5** 次（不因进展清零） |
| 连续等待上限 | **120** 步 |
| 跳跃成功观测窗口 | 发键后 **3** 步 |
| 连续未观察到跳跃 | **3** 次 → 降级为不跳 |
| 单一动作累计失败 | **5** 次；仅当跳跃是唯一推进手段时才停 |
| 策略迭代 | 最多 **3** 轮有记录 |
| 真实冻结 Demo | 同一对象的**一次取证活动**，最多 3 轮 attempt |

- 复合进展指标：`maxX` / `collected` / `chestsOpened` / `gateReached` / `won` 中任一项**严格增加**即进展。
- 等待期间恢复推进或出现新进展 → 清除相应等待计数；重置计数不因进展清零。
- 停止是**执行器主动结束**：`terminationReached = false`，不是游戏失败；必须记录停止原因、`atStep`（累计观测步）、最后观测与动作轨迹。
- 停止原因至少区分：`no-progress` / `reset-exhaustion` / `wait-limit` / `jump-exhaustion`。
- 重置判据与 `observe.mjs` 的 x 回弹判据一致，不得另写一套。

### 三、契约边界（Q4/Q10 显式锁定）

- 03 只锁定**触发条件与语义**；执行器主动停止的**报告表示**由 [08 契约扩展审批](08-contract-extension-approval.md) 裁定。
- 08 批准前，05 **不得**修改 `playtest-report/v1` / `delivery` schema，不得新增 `stop` 字段，不得扩 `actions[].outcome` 闭集。
- 未批准时，停止事实先落 `trace.jsonl` / 最后观测；如 08 拒绝，最终报告必须披露「`timeout` 含执行器主动停止」，不得被误读为场景截止。

### 四、验收测试清单

**04 必须新增/保持**
- 纵向：`hazardModel` 接受 `axis:"y"`、拒绝缺字段；由观测反推锚点/相位；**扫掠范围相关性**（当前在高处、但扫掠能到玩家高度 ⇒ 相关）。
- 纵向窗口：可行窗口 ⇒ 前进；无窗口 ⇒ 等待；等待 120 步 ⇒ `wait-limit`；通过时不要求起跳。
- danger：窗口 ≥ 穿越 + 150ms ⇒ 进；`active` ⇒ 绝不进；缺字段 ⇒ state-only + `danger-window-unknown`；多 danger 逐一路径推演。
- 现有 `policy/observe/scenarios` 测试与 `pnpm test:playtest` 保持绿；零新依赖。

**05 必须新增/保持**
- 无进展：300 步无进展 ⇒ `no-progress`；任一进展事件清零；`atStep`/最后观测/轨迹可追溯。
- 重复重置：累计 5 次 ⇒ `reset-exhaustion`；与 `observe.mjs` 的 reset 判据一致。
- 等待：连续 120 步 `advance:false` ⇒ `wait-limit`；恢复推进或新进展清零。
- 跳跃：3 步内未观察到离地 ⇒ 失败；连续 3 次 ⇒ 降级；累计 5 次且无替代手段 ⇒ `jump-exhaustion`。
- `pickupAbove`：可达（含冻结 Demo 的 scrap-2 形态）⇒ 追；无平台 ⇒ 不跳且记录 `pickup-unreachable`；必需不可达 ⇒ outcome 不是 `GAMEPLAY_FAILURE`。
- 起跳安全：非危险分支的拾取物起跳也先做 `jumpPredictionSafe`。
- 契约：08 批准前零 schema 变更；`pnpm test:playtest` 与全仓回归保持绿；不改站点/配置/Runtime。

**06 / 09 / 07 的验收**
- 06：同一冻结 Demo 一次取证活动、最多 3 轮有记录 attempt；每轮新目录，保留 `result/events/trace/input/console/exceptions/site-integrity`；`site-integrity.unchanged=true`；成功不是硬目标；失败如实归因；不得回退历史 `pass`。
- [09 视觉补审](09-visual-review-supplement.md)：四项追加记录，绑定 subject/reviewer/time，逐项 pass/fail/insufficient；不改 FA-04；`08/09` 字节相同只算 8 个不同画面。
- 07：effort 脚本核对 `review-record.subject` ↔ delivery、materials/capture 逐文件 sha256、`site-integrity` 四文件、QA evidence 36/36；报告披露：产品读取路径仍不重算哈希、只跑一个真实 Demo、纵向/喷发仅 fixture、五态 E2E 未做、旧 `x=813/24` 不可复现（当前样本 `x=438/19`）；最终结论 = `deriveDeliveryVerdict` + §5.5 八项逐项判定，两者均通过才 `pass`。

### 五、明确不做

- 不重写横向巡逻模型；不新增第二套时间窗引擎。
- 不改 Runtime / GameConfig / 站点字节 / `SHELL_VERSION`；不重生成资源。
- 08 批准前不扩 schema；不改 `actions[].outcome` 闭集。
- 不做五态浏览器 E2E；不追加 `avoid-danger` 真实运行。
- 不新开产品审核路径/证据存储加固票；不做付费调用。
- 不写死坐标/实体 id/固定时间；不降低阈值/不删测试/不缩减覆盖。
- 不把 fixture 证据冒充真实浏览器证据；不用历史 `pass` 覆盖本轮失败。
- 不改 `CONTEXT.md`（本 effort 只读）；术语记录在本 Answer。

### 六、术语（本轮记录）

- **Hazard（运动危险）** = `kind:"hazard"` + `motion{kind:"cycle", axis:"x"|"y"}`；接触即复位。
- **Danger（定时喷发）** = `kind:"danger"` + `strike{periodMs, activeMs}`；静止盒 + 周期喷发；`periodMs` 是安全窗口、`activeMs` 是喷发窗口，完整周期 = 两者之和。两者不是同义词。
- **Active Stop（主动停止）** = 执行器在目标达成前主动结束一次试玩，原因 `no-progress` / `reset-exhaustion` / `wait-limit` / `jump-exhaustion`；不是游戏失败，也不是场景超时。
- **Inherited Evidence（继承证据）** = 冻结身份 + 逐文件哈希一致时可复用的历史证据；报告须标注来源与限制。

### 七、实施顺序映射（用户 1–6 阶段 → 本图票号）

1. 基线/证据审计 = 01（已收口）
2. 停止语义/契约审计 = 02（已收口）+ [08 契约扩展审批](08-contract-extension-approval.md)
3. 策略实现 = [04 危险形态通用化](04-danger-forms-generalization.md) / [05 有限终止与动作验证](05-finite-termination-and-action-verification.md)
4. 确定性验证 = 04/05 的验收测试
5. 真实试玩 + 视觉补审 = [06 冻结 Demo 真实试玩](06-frozen-demo-real-playtest.md) + [09 视觉补审](09-visual-review-supplement.md)
6. 最终聚合 = [07 继承证据重验与最终聚合](07-inherited-evidence-reverification-and-final-aggregation.md)
