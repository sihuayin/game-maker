# FPVS-V1 最终验收报告（FA-05）

- **验收对象**：`wasteland-scavenger-recipe` · `pack/v1` · `site/v1` · shell `2`（FA-01 冻结）
- **报告日期**：2026-10-28
- **最终结论：`pass`**
- **依据**：现有 `delivery` 模型确定性计算 —— `delivery.verdict = pass`；六项必需检查全 `pass`，
  真实试玩 `SUCCESS`，P0-06 人工视觉审核 `pass`，身份一致，无未解决阻塞。
- **一句话**：这个指定版本的 Demo 已由**真实按键操作**证明可启动、可移动/跳跃、可收集/开宝箱、
  可躲避危险并完成目标；实际交付资源与运行画面经**人类**逐项对照参考图确认通过；CLI / MCP /
  交付报告对同一对象给出同一结论。

> 本报告是**结论记录**，不重新执行试玩；所有可复核证据的路径、命令、退出码与身份都写在 §9。
> 非 pass 的缺口也必须列清 —— 本轮没有阻塞项，限制见 §3.7。

## 1. 验收对象与身份

| 项 | 值 | 证据 |
|---|---|---|
| 包 | `wasteland-scavenger-recipe` · `pack/v1` | `artifacts/identity.json` |
| 站点 / shell | `site/v1` · shell `2` · `site.json` = pack `v1` / config `game-config.json` | `work/.../site/v1/site.json` |
| manifest | `sha256:a162942de2a65a549be6958f0739f900df0625e0fa957872425bd9a53aa7feb3` | `identity.json` |
| config | `sha256:455d9c7fc982e4d4c3c5b32ff4a94f1dd99f5e85b8adcb0f59af521f3b757dcd`（run 与站点同一份） | `identity.json` |
| 只读快照 | `artifacts/wasteland-scavenger-recipe/`（66 文件，`chmod -R a-w`） | `artifacts/hashes.json` |
| 可写工作区 | `work/wasteland-scavenger-recipe/`（site/pack/config 与快照逐字节一致） | `hashes.json` / `materials.json` |
| 最终报告 | `work/.../run/v1/qa-report.json` · `sha256:dc20e301…5ee6`（本目录 `qa-report.json` 为逐字节副本） | `consistency.json` |
| 试玩报告 | `work/.../run/v1/playtest/v2/result.json` | `delivery.playtest.report` |

**身份三方一致**：`qa-report.delivery`、`playtest/v2/result.json.identity`、`artifacts/identity.json`
的 packId/packVersion/siteVersion/shellVersion/configChecksum/packChecksum 全等（`consistency.json →
identity.three-way`）。快照 66 + 参考 14 条哈希 **0 变化**；工作区 66 条中只有
`run/v1/qa-report.json` 变（FA-02 试玩写回 + FA-04 视觉写回，均为本轮预期）。

## 2. 构建、配置与 QA

| 项 | 结论 | 证据 |
|---|---|---|
| 资源包 / 配置 | `pass` | `delivery.checks`: `asset-pack=pass`、`config=pass` |
| QA | `pass` | 7/7 判据全跑；`failures` 只有 2 条 **warning**（`wasteland-patroller` 16×16 视觉构图 vs 24×32 配置几何；`wasteland-chest` 16×16 vs 32×32），**不阻断**；`delivery.checks.qa=pass` |
| 站点装配 | `pass` | `delivery.checks.site=pass`；`delivery.site={version:1,shell:"2"}` |
| 视觉 QA 观察 | `review=unavailable`（无视觉上游） | `qa-report.observations`；由 FA-04 人工审核补足，**不替代** |

证据：`work/.../run/v1/qa-report.json`（QA 层）· `runs/2026-10-28-visual-review/materials.json →
existingVisualQa`（QA 层与快照字节一致）。

## 3. FR-05 判定维度

### 3.1 产物身份与版本一致性 — ✅

见 §1。三方身份一致；试玩报告与 QA 报告均指向同一 pack/site/config；快照零写入；
FA-04 的全部视觉材料对快照 `frozen match`（reference / delivered assets）。

### 3.2 构建、配置、QA — ✅

见 §2。`delivery.checks` 的 asset-pack / config / qa / site 均为 `pass`。

### 3.3 真实启动与必要操作 — ✅

FA-02 在冻结工作区上用**真实按键通道**执行验收场景（`acceptance-win-wasteland-v1`），
FA-04 用同一动作序列实拍运行画面：

| 维度 | 结果 | 证据 |
|---|---|---|
| 启动 | `scene-ready` + `spawn`@(40,240,onFloor)；console 无 error；exceptions `[]` | `playtest/v2/.../events.jsonl`、`console.json`、`exceptions.json`；截图 `shots/01-startup.png` |
| 移动 | trace x 40 → 1371；453 采样、poll gap 0 | `trace.jsonl`；`shots/02-movement.png` |
| 跳跃/落地 | Space keyDown 9 次；`jump`/`land` 各 9（事件由状态差推断） | `input.jsonl`、`events.jsonl`；`shots/03-jump.png` |
| 收集物 | `pickup` 事件 4；`collected` 0→6；`activePickups` 4→0 | `events.jsonl`；`shots/04-pickup.png` |
| 宝箱 | `chest-open` 事件 2；`chestsOpened=2`（近距自动触发，符合设计） | `events.jsonl`；`shots/05-chest-open.png` |
| 危险物 | `reset=0`、`danger-hit=0`、`runtime-error=0`；采样级盒足迹重建 0 重叠；等待 + 定时跨越（见限制 §3.7） | `events.jsonl`、`trace.jsonl`；`shots/06-hazard-wait.png`、`07-hazard-cross.png` |

### 3.4 真实目标完成 — ✅

| 证据 | 值 |
|---|---|
| 目标事件 | `win` @17006ms |
| 终止状态 | `won=true`；`collected=6`；`chestsOpened=2`；`playerX=1371` |
| gate 判定 | 末态 `right=1383 ≥ gate.x=1380` 且 `bottom=240 ≥ gate.y=208` |
| 集齐守卫 | 末次 pickup（collected=6）@13653ms；`reach_goal` 按键 @13653ms；**先集齐后到 gate** |
| 复现 | FA-02 最终代码 2 次 `harness-final` + 交付链 v2 全 `SUCCESS`；规范化投影一致 |
| 身份/字节 | 试玩报告 identity 与 §1 全等；`site-integrity.unchanged=true` |

结论：**不是**内部完成函数、改内存、改 config 或预置胜利 —— 是真实按键下的运行时 `won` 状态。

### 3.5 试玩失败归因与有限修复 — ✅

| 项 | 结论 | 证据 |
|---|---|---|
| 本轮结果 | `SUCCESS`（`executed / SUCCESS / evaluate`） | `playtest/v2/result.json`；FA-03 `attribution.json` |
| 保留的失败迭代 | `AGENT_LIMITATION`（19 reset、3138 步、未终止；`won` 断言 `unknown`，不是 `GAMEPLAY_FAILURE`） | `runs/2026-10-28-acceptance/harness-1/` |
| 历史结果 | `playtest/v1..v3` 仍为 `AGENT_LIMITATION`（collected 3 / reset 10）；只读、不升级 | `artifacts/reference/playtest-v1/...` |
| 缺陷判定 | 未观察到游戏缺陷；无 invariant fail、无初始态矛盾、0 runtime-error | FA-03 复核 |
| 修复 | **零修复、零新版本产物**（无配置/管线级确定性缺陷阻断验收；零付费） | `runs/2026-10-28-attribution/README.md` |

归因规则见 §3.7 的已知限制；本轮验收对象不受影响。

### 3.6 P0-06 人工视觉审核 — ✅

| 项 | 结论 |
|---|---|
| 审核者 / 时间 | 人（本次会话用户） · `2026-10-28T08:12:51.004Z` |
| 逐项结论 | 整体风格 / 色彩与明暗 / 角色 / 场景 / 关键物件 / 实际运行效果：**六项全部 pass** |
| 材料绑定 | `pack/v1 · site/v1 · shell 2`；`materials.json` 17 源 + 27 生成逐文件 sha256；reference/delivered assets `frozen match` |
| 运行画面 | 9 张**真实按键通关**截图（启动/移动/跳跃/收集/危险物等待/危险物跨越/宝箱/到达目标/终态）；0 reset；站点字节未改 |
| 历史 PASS | **未继承**（阶段C 的 visual pass 只作参考；本轮重新审核） |
| 写回 | `delivery.visualReview={status:"pass",reviewer,reviewedAt,note}`；`visual-review` 检查项 `pass` |

证据：`runs/2026-10-28-visual-review/README.md` · `review-record.json` · `materials.json` ·
`review.html` · `shots/`。

### 3.7 未解决阻塞与证据缺口

**阻塞项：无。** 以下为**限制/证据形态**，均不构成强制条件失败，已在结论中保留：

1. **危险物接触无正向事件**：11 类事件里没有 `hazard-hit`；权威判据是游戏自己的 physics overlap →
   `reset`（本轮 `reset=0`），trace 盒足迹重建只是采样级佐证（0 重叠；净空 18.75px / 6.25px）。
   措辞不夸大为“证明未碰撞每一帧”。
2. **规则 ④ 的潜在误归因**（未触发）：未集齐就到 gate 时，`won=false` 可能被判
   `GAMEPLAY_FAILURE`；本轮 trace 中“到 gate 但 won=false”采样 = 0，集齐守卫先满足，win 时
   collected=6。改判定语义需单独审批，本轮不改。
3. **FA-02 的 25.8px 净空不可复现**：本报告以可复现读数 18.75px（|dx|≤14）/ 6.25px（盒重叠）为准；
   历史报告未改写。
4. **视觉审核是人工判断**：没有参考图↔资源的自动相似度打分（本阶段明确不做）；人工结论绑定版本、
   材料与逐项记录，见 §3.6。
5. **试玩 E3 证据集不含截图**：FA-04 的截图是从同一冻结站点另行实拍的，作为视觉审核材料，
   不冒充 Playtest V1 的自动证据。

## 4. 最终 verdict 与确定性计算

`delivery.checks`（六项必需）：

| 检查 | 状态 | detail |
|---|---|---|
| asset-pack | `pass` | — |
| config | `pass` | — |
| qa | `pass` | — |
| site | `pass` | site v1 · shell 2 |
| playable-smoke | `pass` | `SUCCESS` |
| visual-review | `pass` | 人工 pass |

`deriveDeliveryVerdict` 的总序 `fail > blocked > incomplete > pass`：没有 fail / blocked /
incomplete ⇒ **`pass`**。该 verdict 是**确定性算出来的**（不是调用方打的），且
`DeliveryReportSchema` 会拒绝 verdict 与检查项不一致的报告（`consistency.json →
verdict.deterministic`）。

**四类语义**：本轮为 `pass`；`fail` / `blocked` / `incomplete` 均不适用，因为
没有明确失败证据、没有环境/外部阻塞、没有缺失证据或未完成步骤。若后续任一强制条件失去证据，
必须按 `incomplete` 保留，不得沿用本 `pass`。

## 5. CLI / MCP / 交付报告一致性

- **同一份交付报告**：`work/.../run/v1/qa-report.json` → `delivery.verdict = pass`。
- **CLI 与 MCP 同源**：`create` / `build`（CLI）与 `create_game`（MCP）都只调用
  `deliverySummaryOf(delivery)` 渲染终端摘要，不另建 verdict 计算；FA-03 的
  `pipeline/tests/delivery.test.ts` 已钉住“四种 verdict 写盘读回后，报告 verdict = 摘要
  `deliveryVerdict`”。`consistency.json → summary.shared-by-cli-and-mcp` 在本轮最终对象上复核：
  `summaryVerdict = pass`、结论行含 `pass`。
- **缺席证据不默认 pass**：`deliverySummaryOf(undefined)` → `deliveryVerdict=null` 且明示“尚无”；
  `mapPlaytest(undefined)` → `blocked`；`visualReviewToCheck("pending")` → `incomplete`
  （`consistency.json → no-missing-evidence-defaults-pass`）。
- **报告文本**：本文件 §4 与 `delivery.verdict` 一致（`consistency.json → report.text-consistent`）。

> 现有接口没有“读取既有 run 并打印交付摘要”的 CLI 命令；一致性以两壳共用的纯函数 +
> FA-03 写盘读回测试为准（demo.md §2.1 “以现有接口能力为准”）。

## 6. 最终验收清单（demo.md §8）

| 类别 | 检查项 | 结论 |
|---|---|---|
| 产物与证据 | 验收对象明确，版本身份可复核 | ✅ §1 |
| | 试玩报告、QA 报告和实际产物版本一致 | ✅ §1 / `identity.three-way` |
| | 必要证据来自实际运行的 Demo | ✅ §3.3–3.4（真实按键 + 运行时观测） |
| | 历史报告没有被误当作本轮验收结果 | ✅ §3.5（历史 AGENT_LIMITATION 只读、不升级） |
| 游戏可玩性 | Demo 能正常启动 | ✅ scene-ready / spawn / 无 error |
| | 玩家能够执行必要移动与跳跃操作 | ✅ trace 40→1371；Space 9；jump/land 9/9 |
| | 收集物和宝箱行为符合现有设计 | ✅ 4 pickup / 2 chest-open |
| | 危险物行为及相关反馈符合现有设计 | ✅ 等待 + 跨越；0 reset（接触间接，见 §3.7） |
| | 至少一条真实操作路径证明游戏目标完成 | ✅ win / collected 6 / gate |
| | 自动试玩失败已经归因，未将 agent limitation 等同游戏失败 | ✅ §3.5 |
| | 所有证据不足的项目均明确保留未完成状态 | ✅ 无遗留；限制已列 §3.7 |
| 视觉一致性 | 已对照原始风格参考图 | ✅ §3.6 |
| | 已检查实际交付资源 | ✅ §3.6 |
| | 已检查实际运行画面 | ✅ §3.6 |
| | 已记录 P0-06 审核结论及理由 | ✅ §3.6 / `review-record.json` |
| | 审核结果绑定正确版本 | ✅ §3.6 / `materials.json` |
| 最终报告 | 强制条件逐项有结论 | ✅ 本文件 |
| | 最终状态符合现有契约语义 | ✅ `delivery.verdict` |
| | CLI、MCP 和交付报告结果一致 | ✅ §5 |
| | 未知、缺失或不匹配的证据没有被判定为通过 | ✅ §5 |
| | 未解决问题和限制已明确记录 | ✅ §3.7 |
| 工程约束 | 相关测试通过 | ✅ `pnpm test` 2160/145；`pnpm test:playtest` 96 + self-test 4/4（FA-03；此后无代码变更） |
| | 类型检查通过 | ✅ `pnpm typecheck`（2026-10-28 复跑） |
| | 未发生未经批准的契约、CLI/MCP 或依赖变更 | ✅ 本阶段只在批准范围内改 probe/策略/CLI `--scenario-dir`/测试 |
| | 未发起新的付费调用 | ✅ 全程零付费（复用真实产物） |
| | 未覆盖历史版本化产物 | ✅ `run/vN` / `pack/site/vN` / 历史报告零改动 |
| | 未通过降低验收门槛获得通过结论 | ✅ 未改阈值 / 未删测试 / 未放宽规则 |

## 7. 工程约束（复核命令与说明）

| 命令 | 结果 | 备注 |
|---|---|---|
| `pnpm test` | **2160 tests / 145 files 全绿**（2026-10-28 复跑，exit 0） | 退出码：`regression/test.exit`（已入库）；详细日志本地生成（`.gitignore` 的 `*.log` 不入库），`pnpm test` 可复跑；与 FA-03 基线一致 |
| `pnpm typecheck` | 全绿（2026-10-28 复跑，exit 0） | 退出码：`regression/typecheck.exit`（已入库）；日志可复跑生成 |
| `pnpm test:playtest` | self-test 4/4 + **96 tests / 8 files 全绿**（FA-03 记录） | 本轮未重跑：self-test 会写已跟踪的 `.scratch/playtest-v1/runs/<date>-self-test`，避免覆盖历史证据（FA-06 处理） |
| `pnpm test:acceptance` | 未跑 | 本阶段未触达意图→机制验收链路；`pnpm test` 已含单测/witness |

## 8. 复现

```bash
# 1) 最终一致性（只读；生成 consistency.json）
node .scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance/consistency.mjs

# 2) 归因/证据复核（FA-03 时点记录；21/21）
#    注意：该脚本的 delivery.consistency 断言的是 FA-03 时点 visual-review=incomplete；
#    FA-04 之后最终状态已推进为 pass，最终态一致性以 1) 的 consistency.mjs 为准。
node .scratch/fpvs-v1-final/runs/2026-10-28-attribution/verify.mjs

# 3) 视觉材料复核（只读/可重拍；需 pnpm build）
node .scratch/fpvs-v1-final/runs/2026-10-28-visual-review/capture.mjs
node .scratch/fpvs-v1-final/runs/2026-10-28-visual-review/build-materials.mjs

# 4) 回归
pnpm test && pnpm typecheck
```

## 9. 证据索引

完整逐文件 sha256、清单与状态见 `evidence.json`；核心证据：

| ref | 路径 | 说明 |
|---|---|---|
| `identity` | `artifacts/identity.json` · `artifacts/hashes.json` | 三方身份 + 80 条哈希 |
| `qa-report` | `work/.../run/v1/qa-report.json`（副本：本目录 `qa-report.json`，sha256 `dc20e301…5ee6`） | 七判据、QA 层、delivery |
| `playtest-result` | `work/.../run/v1/playtest/v2/result.json` | `SUCCESS`；453 steps；won/collected 6/chests 2/reset 0 |
| `playtest-evidence` | `playtest/v2/acceptance-win-wasteland-v1/{events,trace,input,console,exceptions}` · `site-integrity.json` | 真实按键与运行时观测 |
| `attribution` | `runs/2026-10-28-attribution/{README.md,attribution.json,verify.mjs}` | 21 项归因复核（FA-03 时点） |
| `acceptance-run` | `runs/2026-10-28-acceptance/{README.md,harness-1,harness-final,...}` | 通关与失败迭代证据 |
| `visual-review` | `runs/2026-10-28-visual-review/{README.md,review-record.json,materials.json,review.html,shots/,assets/}` | 人类 visual pass + 材料 |
| `consistency` | 本目录 `consistency.json` | 最终态 CLI/MCP/报告一致性 |
| `regression` | FA-03 报告 + 本次 `regression/test.exit` / `typecheck.exit` + `pnpm test` / `pnpm typecheck` 复跑 | 2160/145 + typecheck 绿（日志按 `.gitignore` 不入库） |

## 10. 最终结论

**最终结论：`pass`。**

理由：六项必需检查全部 `pass`；真实按键操作完成目标（`won=true`、collected 6、0 reset）；
P0-06 人工视觉审核六项全部通过并绑定冻结版本；身份与字节一致；无未解决阻塞；CLI / MCP /
交付报告与本文结论一致。限制见 §3.7，均不构成强制条件失败，也没有被升级为通过。
