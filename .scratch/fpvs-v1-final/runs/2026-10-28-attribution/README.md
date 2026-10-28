# 2026-10-28 · FA-03 缺陷归因与有限修复

**结论：FA-02 的 `SUCCESS` 复核成立；未发现需要修复的配置/管线级确定性缺陷 ⇒ 不产生新版本产物，
本票按「归因完成 + 零修复」收口。** 另发现两处**证据/规则层面**的限制（不改变本次验收结论）：
① 规则 ④ 存在一处**潜在**误归因路径（未触发，改语义需审批）；
② FA-02 报告里的「危险物最小净空 25.8px」无法从持久化 trace 复现，本报告给出可复现读数。

复核脚本（只读、零付费）：`verify.mjs` → `attribution.json`（21 项检查全过）。

## 0. 复核对象

| 项 | 值 |
|---|---|
| 工作区 | `.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/` |
| run | `run/v1` · `site/v1` · shell `2` |
| 被测 attempt | `run/v1/playtest/v2/`（FA-02 交付链最终写回） |
| 场景 | `acceptance-win-wasteland-v1`（`required:true` / `setup:none` / `siteVersion:1`） |
| 快照 | `artifacts/wasteland-scavenger-recipe/`（66 文件只读） |
| 报告 | `run/v1/playtest/v2/result.json` · `run/v1/qa-report.json` |
| 复核方式 | 独立重算事件/断言/轨迹；用 `contracts` 的真实 `attribute()` 重新归因；**不跑浏览器、不写 work/快照** |

## 1. 归因复核（逐项，复核依据在 `attribution.json`）

| 维度 | 本次结果 | 证据与复核 | 结论 |
|---|---|---|---|
| 启动 | ✅ | `scene-ready` + `spawn`@(40,240,onFloor)；console 无 `error`（仅 Phaser 横幅、shell 版本行、一条九宫格 warning）；`exceptions=[]` | 直接观测，充分 |
| 玩家移动 | ✅ | trace 453 行、poll gap 0；x 40 → 1371 | 直接观测 |
| 跳跃与落地 | ✅ | `input.jsonl` Space keyDown 9 次；`jump`/`land` 各 9（事件由状态差推断） | 按键直接 + 事件推断 |
| 收集物 | ✅ | `pickup` 事件 4、`collected` 0→6、`activePickups` 4→0 | 直接观测 |
| 宝箱 | ✅ | `chest-open` 事件 2、`chestsOpened=2` | 直接观测（近距自动触发，符合设计） |
| 危险物 | ✅ 躲避成功 | `reset=0`、`danger-hit=0`、`runtime-error=0`；按包 manifest 的 24×32 / 脚底锚点重建盒足迹，453 个采样 **0 次重叠** | 接触只能间接判定（无 `hazard-hit` 事件）；权威判据是游戏 physics overlap → `reset`，本轮 0 |
| 游戏目标 | ✅ | `win`@17006ms；末态 `won=true`、`right=1383 ≥ gate.x=1380`、`bottom=240 ≥ gate.y=208` | 直接观测 |
| 集齐守卫 | ✅ | 末次 pickup（`collected=6`）@13653ms；`reach_goal` 按下 @13653ms；`win`@17006ms | 未集齐不会先到 gate（场景动作顺序 = `wait_until collected>=6` → `reach_goal`） |
| 身份 | ✅ | 报告 identity 的 packChecksum / configChecksum / siteVersion / shellVersion 与 `artifacts/identity.json` 全等 | 三方一致 |
| 字节稳定 | ✅ | 快照 66 + 参考 14 条哈希 0 变化；work 对快照 66 条只有 `run/v1/qa-report.json` 变（FA-02 的 delivery 写回，预期）；`site-integrity.unchanged=true`；`setup.kind=none` | 站点/包/配置字节未改 |

**五态归因（真实 `attribute()`）**：`execution=executed` · `stage=evaluate` · `outcome=SUCCESS`。
环境健康（scene-ready、poll gap 0、无环境错误）；7/7 动作 `completed`、0 超时；进度 1331px；
8/8 断言 `pass`、终止达成、0 runtime-error —— 命中 SUCCESS 门槛，不依赖任何 fail→失败的升级路径。

**保留的失败证据**：迭代 1（`runs/2026-10-28-acceptance/harness-1/`）复核为
`AGENT_LIMITATION`：19 次 reset、3138 步、未终止、`won` 断言是 `unknown`（未到 gate，否定条件不可判）。
断言聚合虽是 `fail`（`chests-opened` / `pickups-cleared` 等否定条件在未到达时按当前实现判 fail），
但归因先看正面能力边界证据，**没有**升成 `GAMEPLAY_FAILURE` —— 与「代理限制 ≠ 游戏失败」一致。

**历史结果**：参考快照里的 `playtest-v1` 仍为 `AGENT_LIMITATION`（collected 3 / reset 10），
阶段C 报告的 `visual-review=pass` 只作历史参考；本轮信封由 FA-01D 重新初始化为 `visual=pending`，
**不继承**。

## 2. 缺陷判定

**没有观察到游戏缺陷。** 判据：无 invariant fail、无初始态契约矛盾、无否定条件失败证据、
站点字节未改、0 runtime-error、0 reset；目标在真实按键下达成。危险物、宝箱、收集、跳跃、
移动、启动六个维度都有运行时证据；唯一证据形态缺口是危险物接触没有正向事件（已如实标注）。

**误归因风险（FA-01A 提出、本票复核）**：`gateReached=true + won=false` 会被规则 ④ 判
`GAMEPLAY_FAILURE`，若失败原因其实是漏捡（代理限制）就是误归因。

- 本次**未触发**：trace 中「到 gate 但 `won=false`」的采样 = **0**；`win` 时 `collected=6`；
  验收场景在 `reach_goal` 前有 `wait_until collected>=6`，复核确认该守卫在真实运行中先满足。
- 为什么它是**潜在**问题：游戏本身把胜利门控在 `collected >= pickupCount`（`scene.ts:362`），
  「到 gate 但没集齐」是**设计内行为**，不能单独当作游戏缺陷。当前
  `observe.mjs` 的 `judgeableNegative('won')` 只要求 `gateReached`，与归因规则 ④ 合起来
  会把这类运行判成 `GAMEPLAY_FAILURE`。
- 处理：**不改**。改判定语义属于「改变既有状态的语义」，按地图 §7.2 需单独审批；且本次验收
  对象不受影响。已作为已知限制记录（见 §7）。

**证据措辞复核（危险物）**：FA-02 报告写「水平进入 ±14px 时脚底最小离危险物头顶 25.8px」。
按报告自己描述的「锚点 ±12px、y∈[208,240]」重建，并用包 manifest 的 24×32、脚底锚点复核，
**无法复现 25.8px**；可复现的读数是：
- `|player.x − hazard.x| ≤ 14` 时最小净空 **18.75px**（t=5213ms）；
- 玩家盒与危险物盒**水平重叠**时最小净空 **6.25px**（t=5286ms）。
两者都 > 0，且 453 个采样 0 重叠、`reset=0` —— 定性结论不变。历史报告不覆盖、不改写；
本票以可复现读数为准。

## 3. 有限修复决定

| 判断 | 结果 |
|---|---|
| 是否有配置/管线级确定性缺陷阻断验收？ | **没有**（试玩 SUCCESS、交付写回成功、身份一致、字节稳定） |
| 是否需要新版本产物？ | **不需要**；快照/站点/pack/config 零写入，历史 `run/vN` / `playtest/vN` 未覆盖 |
| 是否需要重写 Runtime / 重新付费生成？ | **不需要**；本票零付费、零上游调用 |
| 规则 ④ 的潜在误归因 | **不修**：未触发 + 改语义需审批；记录为已知限制，附建议改法（审批后：`judgeableNegative('won')` 追加「`activePickups===0`」，并同步改规则 ④ 的单测） |

版本变更可追溯性：本票**没有产生新版本**；work 区唯一变化仍是 FA-02 已记录的
`run/v1/qa-report.json`（playtest v2 写回），快照 80 条哈希零变化。

## 4. FR-03 / §6.1 离线判定边界测试

先核对现有覆盖，再补缺（纯离线、零付费）。**新增 7 个测试**，全部通过。

| §6.1 情形 | 现有覆盖 | 本次补齐 |
|---|---|---|
| 真实验收所需条件全部满足 | `contracts/delivery.test.ts` 场景 A；`pipeline/playtest.test.ts` 写回 → pass | — |
| 目标未完成 + 明确游戏缺陷 | `playtest-attribution` invariant / 初始态 / won fail；`applyPlaytest` GAMEPLAY_FAILURE → fail | — |
| 代理能力不足、未证明不可玩 | `AGENT_LIMITATION` → `incomplete`；本次复核真实失败迭代 = `AGENT_LIMITATION` | — |
| 环境故障中断 | `ENVIRONMENT_FAILURE` → `blocked` | — |
| 试玩超时 | `TIMEOUT` → `incomplete` | — |
| 关键状态/事件缺失 | `UNKNOWN` + 结构化 `InsufficientEvidence`；不映射 pass | **「无失败证据、无终止、无超时 ⇒ UNKNOWN」**（沉默不读成通过/失败） |
| site / pack / config 版本不匹配 | siteVersion + config checksum 拒写 | **pack id / packVersion / shell 不匹配拒写**；**delivery 无 site 身份拒写** |
| 视觉审核未完成 | `visualReviewToCheck(pending)` → incomplete；delivery 场景 H | — |
| 视觉审核不通过 | 场景 I / `applyVisualReview(fail)` → fail | — |
| 历史报告可读、不升级 | 旧报告无 delivery 仍解析；delivery 缺席 ≠ pass | **历史阶段C（visual pass + smoke incomplete）读回仍 incomplete，不合成 `playtest` 摘要**；**无 delivery 的摘要明示「尚无」，不是 pass** |
| 未知状态不映射为通过 | `mapPlaytest(UNKNOWN)` → incomplete；场景 K | **`applyPlaytest(UNKNOWN)` → smoke incomplete + verdict incomplete** |
| CLI / MCP / 报告一致 | 两壳都调用 `deliverySummaryOf` | **四种 verdict 写盘读回 → 报告 verdict = 摘要 `deliveryVerdict`，且非 pass 的结论行不含「：pass」** |

新增测试位置：

- `packages/contracts/tests/playtest-attribution.test.ts` —— 沉默 ≠ 通过/失败
- `packages/contracts/tests/playtest.test.ts` —— pack/shell 身份拒写、无 site 拒写、UNKNOWN 不升级
- `packages/contracts/tests/delivery.test.ts` —— 历史阶段C 读回不升级
- `packages/pipeline/tests/delivery.test.ts` —— CLI/MCP/交付报告同源一致（4 verdict + 无 delivery）

## 5. 回归

| 命令 | 结果 |
|---|---|
| `pnpm test` | **2160 tests / 145 files 全绿**（FA-02 基线 2153 + 新增 7） |
| `pnpm typecheck` | 全绿 |
| `pnpm test:playtest` | self-test 4/4 绿 + **96 tests / 8 files 全绿**（FA-02 基线 92 + 新增 4） |
| `pnpm test:acceptance` | **未跑**：本票未触达意图→机制验收链路；`pnpm test` 已含单测/witness |

> 环境注记：首次 `pnpm test` 因磁盘满（`ENOSPC`）在 `cli.test.ts` 的 `accept` 用例失败；
> 清理 20 个残留的 `$TMPDIR/gm-cli-accept-findings-*` 测试临时目录（各约 89MB，测试自己创建的产物）后重跑全绿。
> 与代码无关，仓库文件未动。

## 6. 复跑

```bash
# 前置：pnpm build（verify.mjs 导入 packages/contracts/dist）
node .scratch/fpvs-v1-final/runs/2026-10-28-attribution/verify.mjs
pnpm test
pnpm typecheck
pnpm test:playtest
```

`verify.mjs` 只读：不启动浏览器、不写 `work/` 或快照；唯一写入是本目录的 `attribution.json`。

## 7. 未解决项与限制

1. **规则 ④ 的潜在误归因**（未触发）：未集齐就到达 gate 时，`won=false` 会被判
   `GAMEPLAY_FAILURE`。当前验收对象不受影响（集齐守卫 + `win` 时 `collected=6`）。
   改法已写进 §3，需审批。
2. **FA-02 的 25.8px 读数不可复现**：本报告给出可复现读数 18.75px / 6.25px；历史报告未改写。
3. **危险物接触无正向事件**：11 类事件里没有 `hazard-hit`；权威判据是游戏自己的
   physics overlap → `reset`（本轮 0），trace 盒足迹重建只是采样级佐证。
4. **最终交付 verdict 仍是 `incomplete`**：`playable-smoke=pass`、`visual-review=incomplete(pending)`；
   视觉人工审核归 FA-04，本票不冒充最终验收。
5. **零写入的历史与产物**：快照 66 + 参考 14 哈希 0 变化；历史 `playtest/v1..v3` 与阶段C 报告未改。
