# FA-02 真实试玩通关证据

Type: task
Status: closed
Owner: main session · 2026-10-28
Map: ../map.md
Blocked by: —

## 开工前置（用户 2026-10-28 逐字；已确认）

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
   等待语义需要新增「循环内松开/恢复右键」。

**裁定摘要（FA-01C）**：先做 Q2(i) 的通用策略修复（等待/松开右键、危险区抑制 `pickupAbove`），
必要时补 Q2(ii)；时间盒 2–3 次迭代；不写死坐标/hazard ID/固定时间。人工证据按 Q3(i) 采集但**不**写成
自动 SUCCESS；最终 verdict 按 Q4(i) 保持 `incomplete`（若自动 SUCCESS 做不到）。

> 注：FA-01D 已收口（CLI `--scenario-dir` + E1 信封），策略迭代与交付写回均可开工。

## Question

在冻结快照的可写工作区上，用 FA-01C 裁定的路线与 FA-01D 裁定的交付链，执行一条可复现的通关路径，
证明玩家能够通过实际操作完成游戏目标，并给出 FR-02 七个验收维度的逐项结果。

0. **交付信封（已就位）**：FA-01D 已用 `acceptance/init-delivery.mjs` 在 work 区初始化**本轮**
   delivery（asset-pack/config/qa/site = pass；playable-smoke/visual-review = incomplete；
   `visualReview.status = "pending"`；verdict = incomplete）。除非要显式重置，不要重复运行初始化脚本；
   历史 stage-c 的 `visual-review: pass` 没有被继承。
1. **动作与路线**：按 FA-01C 的裁定执行。默认只使用现有语义动作
   （`move_to` / `jump_over` / `wait_until` / `reach_goal` / `assert_state`）；若裁定允许补实现或改策略，
   以裁定票的批准范围为准，不越界、不悄悄扩协议。
2. **动作序列是验收脚本，不是判定依据**：执行必须经过 harness 的真实按键通道，
   结果由运行时观测（`won` / `collected` / `events` / `trace`）确认；不得调用内部完成函数、
   改内存、改 config、使用 `setup.mutate-hazard` 或预置胜利。
3. **gate 停点已修复**：FA-01B 确认 7.5px 缺口并改为「右边界 + 垂直重叠」；隔离诊断已 `won=true`。
   但该诊断移走了第二只巡逻怪，**不是验收证据**；本票必须在**不移动危险物**的真实运行中取证，
   不得复用诊断结果，也不得把「到 gate 但未 won」写成通关。
4. **场景绑定**冻结快照的 `siteVersion=1`；验收场景放本 effort 的 `scenarios/`，
   不混入五态自测目录。建议从 FA-01A §5 的草案出发（4 个 `move_to pickup` 检查点 +
   `wait_until collected>=6` 守卫 + `reach_goal` + `wait_until won`），按实际裁定调整。
5. **证据**：`result.json` + `events.jsonl` + `trace.jsonl` + `input.jsonl` + console/exceptions + 截图；
   必须出现 `won=true`（或等价终止状态）且至少一条实质断言 `pass`；`site-integrity` 证明站点字节未改。
6. **七维覆盖矩阵**：启动 / 移动 / 跳跃与落地 / 收集物 / 宝箱 / 危险物 / 游戏目标；
   逐项标「本次运行直接观测」/「由事件间接可判（如 reset + trace）」/「未覆盖（需独立场景）」。
   危险物没有 `hazard-hit` 事件，接触只能由 `reset` + trace 间接判定，措辞不得夸大。
7. **避免误归因**：到 gate 前先加「集齐守卫」（`wait_until collected>=6`），避免漏捡宝箱后被
   `gateReached + won=false` 误判成 `GAMEPLAY_FAILURE`；若未通关，按五态 + UNKNOWN 归因，
   不得把代理限制算成游戏失败，不得把超时算成缺陷。
8. **交付链**：用已批准的 CLI 路径写回：
   `node packages/cli/dist/cli.mjs playtest .scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1 --out .scratch/fpvs-v1-final/work --scenario-dir <验收场景目录>`
   只写工作区的 `run/v1/playtest/v<K>/` 与 `qa-report.json`；快照零写入，身份不匹配拒写。

完成条件：至少一条真实操作路径完成目标，证据可复核；其余强制维度有明确结果（含「未覆盖」）；
未通关时归因正确且不冒充通过。

## Answer（收口 · 2026-10-28）

**结果：在冻结的可写工作区上，用真实按键通道跑出自动 `SUCCESS`：`won=true`、`collected=6`、
`chestsOpened=2`、`resets=0`；已由 `game-maker playtest --scenario-dir` 写回本轮交付信封
（`playable-smoke=pass`；`visual-review` 仍 pending ⇒ `verdict=incomplete`，不是试玩失败）。**

### 做了什么（FA-01C Q2(i) 批准范围内，不改协议）

1. `policy.mjs` 新增 `decide(st, ctx)`：巡逻危险物（横向三角波）前**等待**——停在巡逻带外沿、
   松开右键；按**实时几何 + 相位**算「现在起跳能否在滞空窗口内越过、且危险物不会中途转向」才起跳；
   危险物在前/带内时抑制 `pickupAbove`；任何通用起跳前先做轨迹安全推演。
   物理量取自**被验收游戏自己的** `player.move`，不写死本关坐标/id/固定时间。
2. `runner.mjs`：`move_to` / `reach_goal` 内可松开/恢复 ArrowRight（等待语义）；不改场景契约。
3. `probe-harness.mjs`：`READ_STATE` 的危险物增加只读盒足迹（`left/right/top/bottom/width/height`）。
4. 新增 `policy.test.mjs`（11 个纯离线用例：模型反推、窗口随物理量/几何变化、等待/起跳/抑制、
   两组不同几何的闭环推演）。

### 运行与证据（保留失败，不删不利结果）

| 运行 | 结果 | 证据 |
|---|---|---|
| 迭代 1 `harness-1` | ❌ 未通关：19 reset，卡在平台左面 x=438 | `runs/2026-10-28-acceptance/harness-1/`（失败原因：过冲被判成"已在带内"；把下一只危险物当成近前障碍，压掉了攀爬跳） |
| 迭代 2 `harness-2` | ✅ SUCCESS · 0 reset · 449 steps | `runs/2026-10-28-acceptance/harness-2/` |
| 中间复现 ×2 `harness-determinism` | ✅ 两次 SUCCESS，投影一致（`determinism.same=true`） | `runs/2026-10-28-acceptance/harness-determinism/` |
| 最终代码复现 ×2 `harness-final` | ✅ 两次 SUCCESS，投影一致 | `runs/2026-10-28-acceptance/harness-final/` |
| 交付链（CLI，最终） | ✅ exit 0 · SUCCESS · 写回 attempt **v2**（453 steps） | `work/.../run/v1/playtest/v2/` + `qa-report.json` |

- 身份：`result.json.identity` 的 pack/config checksum、site v1、shell 2 与 `artifacts/identity.json` 全等；
  `site-integrity.unchanged=true`；快照/参考 80 条哈希零变化。
- 通关链：等待（`keyUp ArrowRight @3103 → keyDown @4707`，1.60s）→ 起跳越过 patroller-1
  （滞空 x≈325→385）→ 平台取 scrap-2/chest-1 → 起跳越过 patroller-2（x≈703→765）→ chest-2/scrap-3 →
  平台取 scrap-4 → 集齐守卫 → `win`@17006ms。全程 9 jump / 9 land、0 reset、0 runtime-error。
- 危险物：trace 采样级重建盒足迹 **0 次重叠**；水平接近时脚底离危险物头顶最小 25.8px。
  ⚠️ 接触仍只能由 `reset` + trace 间接判定（无 `hazard-hit` 事件），措辞未夸大。

### FR-02 七维

启动 ✅ 直接 · 移动 ✅ 直接 · 跳跃落地 ✅（按键直接 + 事件推断）· 收集物 ✅ 直接 ·
宝箱 ✅ 直接 · 危险物 ✅ 躲避成功（按键/轨迹直接 + 接触间接）· 游戏目标 ✅ 直接。
无"未覆盖"项；唯一证据缺口是危险物接触没有正向事件（已按间接证据记录）。
另：开票清单里的"截图"不在 Playtest V1 的 E3 证据集（result/events/trace/input/console/exceptions）内，
本轮**没有新增截图能力**；通关判定不依赖截图。参考图↔运行画面的视觉材料与截图归 FA-04。

### 交付语义

`delivery.playtest.aggregate=SUCCESS`、`playable-smoke=pass`；`visual-review` 仍 `incomplete`/`pending`
⇒ `verdict=incomplete`。自动试玩通过**不等于**最终验收通过（FR-05）；最终结论留给 FA-04 / FA-09。

### 回归

`pnpm test` 2153 tests 绿 · `pnpm typecheck` 绿 · `pnpm test:playtest` self-test 4/4 + 92 tests 绿。
报告：[runs/2026-10-28-acceptance/README.md](../runs/2026-10-28-acceptance/README.md)。
