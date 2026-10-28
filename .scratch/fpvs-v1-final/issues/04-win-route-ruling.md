# FA-01C 通关路线裁定

Type: grilling
Status: resolved
Owner: main session · 2026-10-28
Map: ../map.md
Blocked by: 03

## Question

FA-01A 结论：现有动作能表达「按顺序收集 + 到达 gate」，但不能可靠表达「等待巡逻相位/避开宽范围巡逻」；
`jump_over` 的 hazard 目标未实现、`assert_state` 是空操作、策略的 `pickupAbove` 会主动跳进危险区。
FA-01B 已确认并修复 gate 停点（诊断运行 `won=true`，但该运行移走了第二只巡逻怪，不是验收证据）。
本票只剩**危险物避让/动作语义**这条主线，裁定本轮通关证据走哪条路线：

- **(a) 改策略 / 补实现（不改协议）**：危险物接近时松开右键等待、抑制危险区内的 `pickupAbove`、
  实现 `jump_over hazard` 与 `assert_state` 动作点断言；需批准代码变更并补离线测试。
- **(b) 扩展场景协议**：例如 `wait_until` 增加相位/位置/时间条件、`move_to` 增加实体 id/坐标目标。
  需单独协议审批；按用户 2026-10-27 规则，本阶段默认不做。
- **(c) 人工试玩**：按 FR-02 标记人工证据；交付里保留 `AGENT_LIMITATION`，不得写成自动 SUCCESS。
  现有 harness 没有手玩模式，需先说明人工证据的采集与复核形式。
- **(d) 接受当前能力边界**：最终按 `AGENT_LIMITATION` / `incomplete` 诚实收口，不修 harness。
- **(e) (a)+(c) 组合**：先修策略/动作，仍不通关时补人工证据。

**必须同时裁定**：
1. 若选 (a)/(b)，修复属于「配置/管线级确定性缺陷」还是「重写 Playtest V1」；后者不在本图内。
2. 危险物维度的证据措辞：接受 `reset` + trace 间接证据，还是补 `hazard-hit` 事件 / trace 字段
   （FA-01A §4.2 的观测缺口）。
3. 若选 (c)，人工证据的记录、复核与交付标记方式；如何与自动证据分开。
4. `chest-2` 无定向目标、漏捡后无法回头——路线是否要求先修复这个表达缺口，还是用集齐守卫规避。

推荐：**(e)** —— 先做不改协议的 (a)，用 FA-02 的动作序列验证；仍不通关再走 (c)，
全程保留五态归因，不把人工证据写成自动通过。

## Answer（裁定 · 2026-10-28）

用户逐条裁定，正式记录如下：

| 决策项 | 最终选择 | 边界 |
|---|---|---|
| 主路线 | **Q1 (d)** | 自动策略优先，诚实兜底 |
| 策略修复 | **Q2 (i)，必要时 (ii)** | 2–3 次迭代；不改协议 |
| 人工取证 | **Q3 (i)** | 独立 human evidence，不冒充自动成功 |
| 最终 verdict | **Q4 (i)** | 不新增契约字段，接受 `incomplete` |

### Q1 — 主路线：(d)

先做有限、通用的策略修复，争取自动 `SUCCESS`；失败后以 `AGENT_LIMITATION` / `incomplete` 诚实收口。
不因自动路线失败把游戏判成不可玩，也不把未完成写成成功。

### Q2 — 修复范围：先 (i)，必要时 (ii)

第一阶段只做：

- 危险物接近时允许玩家**等待**，而不是持续推进；
- 等待期间正确**松开右键**，恢复时再按下；
- 依据实时观测到的危险物几何/相位决定继续移动/起跳；
- 危险区内**抑制 `pickupAbove`**，避免为收集高处物品主动跳进巡逻区。

若第一阶段仍不足以稳定通关，再补 (ii)：`jump_over` 的 hazard 目标实现、`assert_state` 动作点断言
（字段已存在，不扩协议）。

**硬边界**：不写死本关坐标、特定 hazard ID 或固定通关时间；规则必须基于实时观测的几何/相位。
时间盒 2–3 次迭代；每次记录结果、失败原因、下一步判断，不以无限调参追求 `SUCCESS`。

### Q3 — 人工取证：(i)

使用 headful Chrome + CDP + `READ_STATE` 轮询，关键节点截图/录屏，形成结构化 human evidence bundle。
至少包含：冻结 Demo 身份与版本；实际运行页面及启动结果；操作时间线；关键节点 `READ_STATE`；
关键节点截图/录屏；目标是否实际完成；失败归因与证据限制；`evidenceType: human` 或等效标记。

人工证据**不写成自动 Playtest SUCCESS**，不冒充 `delivery` 的自动试玩证据。
若 headful/CDP 能力经审计无法完整复用，缩小证据范围并记录缺口，不临时扩展成通用手玩框架。

### Q4 — 最终 verdict：(i)

不新增契约字段，不把人工通关证据转换成 `playable-smoke: pass`。
若有限策略修复仍不能获得自动 `SUCCESS`：

1. 保存所有真实运行记录；
2. 若可行，采集人工证据包；
3. 在现有交付模型允许的范围内记录真实状态；
4. 最终 verdict 保持 `incomplete`（除非现有证据足以依据既有契约判定其他状态）；
5. 在 Markdown 最终验收报告中说明自动路线限制、人工证据结论与剩余缺口。

人工证据即使证明真人可通关，也不能绕过当前 `delivery` 契约的自动试玩门槛。
未来若要让人工证据参与正式 verdict，另开契约审批票，不纳入本轮。

### FA-01B 证据绑定（收口前置）

- 诊断运行的 site 是 `work/wasteland-scavenger-recipe/site/v1`；work 与 snapshot **66/66 字节一致**
  （`artifacts/identity.json` 的 `verification.workVsSnapshot.same=true`）。
- `site-integrity.json` 前后哈希一致；config checksum 与 `identity.json` 一致；snapshot 零写入。
- gate 修复本身在 harness（`policy.mjs` / `observe.mjs`），不在验收产物。
- 报告：[runs/2026-10-27-gate-stop/README.md](../../runs/2026-10-27-gate-stop/README.md)。

### FA-02 开工前置（用户 2026-10-28 逐字）—— 已确认

1. **策略接口**：`createPolicy` / `noteObservation` / `shouldJump`（`policy.mjs`）；
   `runMoveTo` / `runWaitUntil` / `createKeyboard`（`runner.mjs`）。
2. **READ_STATE 可观测字段**：player `x/right/bottom/onFloor/blockedRight/touchingRight`；
   hazards `x/y/axis/distance/periodMs/t0`；pickups/chests/dangers/gate；solids/scrollX
   （`probe-harness.mjs:207-235`）。
3. **危险物相位定义**：三角波 `start → start+distance → start`，
   `phase = ((t0 % periodMs)+periodMs)%periodMs / periodMs`；现有策略只在 `phase < 0.5` 时主动跳
   （`hazard.ts:14-19`；`policy.mjs:56-64`）。
4. **动作执行/右键释放**：`runMoveTo` 持续 `keyDown ArrowRight`，循环内只决定是否跳，
   `finally` 才 `keyUp`；`runWaitUntil` 不发方向键（`runner.mjs:101-117,153-184`）。
   **等待语义需要新增「循环内松开/恢复右键」，不是现有能力。**

→ FA-02 的策略迭代可开工；交付写回/最终报告仍依赖 FA-01D。
