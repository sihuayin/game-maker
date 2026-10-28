# 2026-10-28 · FA-02 真实试玩通关证据

**结论：冻结产物的自动试玩取得 `SUCCESS`（真实按键 → 真实运行时观测），并已写回本轮交付信封。**
交付 `verdict` 仍为 `incomplete` —— 因为 `visual-review` 仍是 `pending`（FA-04 未做），
不是试玩未通过。本条只回答 FR-02（真实试玩证据），不冒充最终验收。

## 1. 验收对象（与 FA-01 冻结同一份字节）

| 项 | 值 |
|---|---|
| 快照（只读） | `.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/`（`chmod -R a-w`，80 条哈希 0 变化） |
| 工作区（可写） | `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/` |
| 站点 | `site/v1` · shell `2` · `site.json` = pack `v1` / config `game-config.json` |
| 包 | `wasteland-scavenger-recipe` pack `v1` · manifest `sha256:a162942d…feb3` |
| 配置 | `site/v1/game-config.json` = run 的 `game-config.json` · `sha256:455d9c7f…7dcd` |
| 本轮交付信封 | FA-01D `acceptance/init-delivery.mjs` 初始化；本轮只由 `game-maker playtest` 写 `delivery.playtest` |

运行报告的 `identity`（`playtest-report/v1`）与 `artifacts/identity.json` 的三方一致：
`packChecksum` / `configChecksum` / `siteVersion=1` / `shellVersion=2` 全等。

## 2. 本轮代码改动（FA-01C Q2(i) 批准范围内）

| 文件 | 改动 | 性质 |
|---|---|---|
| `packages/demo/probe/playtest/policy.mjs` | 新增 `decide()`：巡逻带前**等待**（松开右键）→ 按实时几何/相位算跨带窗口 → 起跳越过；危险物在前/带内时抑制 `pickupAbove`；通用起跳前做安全推演 | 策略语义（不改协议） |
| `packages/demo/probe/playtest/runner.mjs` | `move_to`/`reach_goal` 每步可松开/恢复 ArrowRight；物理量从**被验收游戏自己的** `player.move` 读取 | 执行层 |
| `packages/demo/probe/probe-harness.mjs` | `READ_STATE` 的危险物增加只读盒足迹 `left/right/top/bottom/width/height` | 观测面（不写站点） |
| `packages/demo/probe/playtest/tests/policy.test.mjs` | 11 个纯离线用例：模型反推、窗口随物理量变化、等待/起跳/抑制、两组几何的闭环推演 | 离线测试 |
| `.scratch/fpvs-v1-final/scenarios/acceptance/acceptance-win-wasteland-v1.json` | 验收场景（`required:true` / `siteVersion:1` / setup none） | 场景数据 |

不变式：未改 contracts / CLI / MCP 公开输入输出；未新增依赖；未调用付费上游；未改站点字节；
未覆盖历史 `run/vN`、`pack/site/vN` 或已发布报告。

## 3. 运行记录（保留失败，不删不利结果）

| 运行 | 命令 | 结果 | 说明 |
|---|---|---|---|
| 迭代 1 | `playtest.mjs --site work/.../site/v1 --scenario-dir scenarios/acceptance --out runs/.../harness-1` | ❌ `won=false`，19 次 reset，卡在 x=438 | 策略把"贴带等待的过冲"当成"已进入巡逻带" ⇒ 一直前进；且把**下一只**危险物当成近前障碍，禁止了平台攀爬跳。失败证据保留在 `harness-1/` |
| 迭代 2 | 同命令 → `harness-2` | ✅ `SUCCESS` · 断言 pass · `won=true` · 0 reset | 停点改为带外沿，等待区与"被迫深带内"分离；接近段允许安全推演过的攀爬/拾取跳 |
| 中间复现（2 次） | `... --out harness-determinism --repeat 2` | ✅ 两次都 `SUCCESS`，`determinism.same=true` | 规范化投影（断言三值/离散终态/可比较事件计数）一致 |
| **最终代码复现（2 次）** | `... --out harness-final --repeat 2` | ✅ 两次都 `SUCCESS`，`determinism.same=true` | 最终 `policy.mjs`（常量清理后）的证据；450 / 437 steps |
| 交付链（v1） | `node packages/cli/dist/cli.mjs playtest work/.../run/v1 --out work --scenario-dir scenarios/acceptance` | ✅ exit 0 · `SUCCESS` · 写回 | 清理前的策略版本；attempt `playtest/v1/`（保留，不覆盖） |
| **交付链（v2，最终）** | 同命令 | ✅ exit 0 · `SUCCESS` · 写回 | attempt `playtest/v2/`；453 steps；`playable-smoke=pass`；`visual-review` 未变；`verdict=incomplete` |

交付链运行的报告：`.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/playtest/v2/result.json`。
站点字节：`site-integrity.json.unchanged = true`（index.html / shell.js / site.json / game-config.json 前后哈希一致）。

## 4. 通关证据链（交付链 v2，`steps=453`）

- **输入时间线**（`input.jsonl`，真实按键）：`ArrowRight` down/up 7/8 次；`Space` 9 次。
  在 patroller-1 前 `keyUp ArrowRight @3103ms` → `keyDown ArrowRight @4707ms` → 起跳：
  **1.60s 的等待**（松开右键）后才起跳；越过 patroller-2 前也有松开/恢复（77ms）。
- **跳跃/落地**（`events.jsonl`，状态差 `inferred:true`）：`jump` 9 / `land` 9；
  首次越障的滞空段 x 约 325→385，二次越障约 703→765。
- **收集**：`pickup[0]`@1830ms、`pickup[1]`@6414、`chest-open[0]`@6678、`chest-open[1]`@10682、
  `pickup[2]`@10846、`pickup[3]`@13653 → `collected` 0→6，`activePickups=0`，`chestsOpened=2`。
- **目标**：`win`@17006ms；`endState.won=true`、`playerX=1371`（gate 盒左边界 1380，玩家右边界进入盒内）；
  `reach_goal` 与 `wait_until won` 均 `completed`。
- **危险物**：全程 `reset=0`、`danger-hit=0`、`runtime-error=0`。
  采样级检查（trace 每行按危险物锚点 ±12px、y∈[208,240] 重建盒足迹）：**0 次重叠**；
  水平进入 ±14px 时脚底最小离危险物头顶 **25.8px**。

## 5. FR-02 七维覆盖矩阵

| 维度 | 本次结果 | 证据类型 | 说明 / 限制 |
|---|---|---|---|
| 启动 | ✅ | 直接观测 | `scene-ready` + `spawn`@(40,240) onFloor；console/exceptions 为空 |
| 玩家移动 | ✅ | 直接观测 | trace x 40→1371；452 个状态样本 |
| 跳跃与落地 | ✅ | 直接（按键）+ 推断（事件） | `input.jsonl` 的 Space 9 次；`jump`/`land` 各 9（事件是状态差推断） |
| 收集物 | ✅ | 直接观测 | 4 个 pickup 事件（indexes 0–3），初始 active 4 → 0 |
| 宝箱 | ✅ | 直接观测 | 2 个 `chest-open`（chest[0]、chest[1]），近距自动触发 |
| 危险物 | ✅ 躲避成功 | 直接（按键/轨迹）+ 间接（接触判定） | 等待 + 定时越障；**接触只能由 `reset` + trace 跳变间接判定**（11 类事件里没有 `hazard-hit`，`hits` 只统计 `danger`），本次 0 reset；措辞不夸大成"证明未碰撞每一个帧" |
| 游戏目标 | ✅ | 直接观测 | `win` 事件 + `won=true` + 集齐 6 件 + 到达 gate；`delivery.playtest` 归因 `SUCCESS` |

## 6. 归因

- 环境健康：`execution=executed`、`scene-ready` 观测到、poll gap 0、无环境类 console 错误。
- 代理限制：本次不适用（已通关）；此前 `AGENT_LIMITATION` 的诊断结论保留在
  `../2026-10-27-gate-stop/` 与历史 `playtest/v1..v3`，**不改写、不升级**。
- 游戏缺陷：未观察到；`reset=0`、断言全 pass。
- 结论：`SUCCESS`（真实操作路径完成目标）。这是**试玩维度**的结论；最终验收仍受 FA-04 视觉审核约束。

## 7. 复跑

```bash
# 前置：pnpm build
node packages/demo/probe/playtest/playtest.mjs \
  --site .scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/site/v1 \
  --scenario-dir .scratch/fpvs-v1-final/scenarios/acceptance \
  --out <新目录> --repeat 2

node packages/cli/dist/cli.mjs playtest \
  .scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/fpvs-v1-final/work \
  --scenario-dir .scratch/fpvs-v1-final/scenarios/acceptance
```

## 8. 回归

- `pnpm test`：**2153 tests / 145 files 全绿**
- `pnpm typecheck`：全绿
- `pnpm test:playtest`：self-test 4/4 绿 + 92 tests 绿（含新增 `policy.test.mjs` 11 个）
- 快照/参考哈希：`artifacts/hashes.json` 80 条**全部未变**；工作区 66 个对应文件只有
  `run/v1/qa-report.json` 变（本轮的 delivery 写回，预期），site/pack/config 字节未变。
