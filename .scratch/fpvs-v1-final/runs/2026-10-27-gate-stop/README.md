# FA-01B gate 停点确认与判定修复

- 日期：2026-10-27
- 票：`.scratch/fpvs-v1-final/issues/03-gate-stop-confirmation.md`
- 结论：**确认 gate 停点缺口；已修复 `targetReached` / `gateReached`；诊断运行 `won=true`；
  专项回归 81 测试 + self-test 全绿。**
- 性质：诊断运行用 `setup.mutate-hazard` 把**第二只巡逻怪移远**以隔离 gate 几何。
  **它不是验收证据**，只用于确认停点阈值；真实危险物下的通关证据仍归 FA-02。

## 1. 静态推断 vs 实测

| 项 | 值 | 证据 |
|---|---|---|
| gate `at.x` | 1380 | `run/v1/game-config.json` |
| gate 盒左边界 | 1380（锚点 `{0,0}`） | `pack/v1/manifest.json` |
| 玩家右边界 | `x + 12` | trace 首行 `x=40, right=52` |
| 旧停点 | `x >= gate.x - 20` → 1360 | `policy.mjs:74`（修复前） |
| 旧停点实测 | `x=1360.5, right=1372.5` | before-fix trace |
| 缺口 | **7.5px** | `1372.5 < 1380` |

修复前诊断运行（第二只巡逻怪已移远）已 `collected=6`、`chestsOpened=2`、`activePickups=0`，
但停在 `x=1360.5`、`won=false`。⇒ 静态推断成立：停点与 gate 盒不一致，集齐也赢不了。

## 2. 真实游戏（无 setup）无法直接到达停点

同一场景不加 setup 的 120s 真实运行：`timeout`，max x=813，24 次 `reset`，collected 3/6。
说明当前自动策略在 patroller-2 一带就被挡住，**无法用真实危险物运行直接量停点**；
因此用 `mutate-hazard` 做隔离诊断。该运行的证据同时说明：gate 修复不等于游戏可通关。

## 3. 修复

- `packages/demo/probe/playtest/policy.mjs:77`：
  `st.gate && st.right >= st.gate.x && st.bottom >= st.gate.y`
- `packages/demo/probe/playtest/observe.mjs:131`：同一几何条件，用于 `gateReached` 否定可判性。
- 为什么加 `bottom >= gate.y`：只改水平条件时，玩家会停在 gate 盒**上方空中**
  （实测 `x=1369.5, right=1381.5, bottom=201.75 < gate.y=208`），`won` 仍不置位；
  垂直重叠后诊断运行才真正 `won=true`。
- 离线测试（`packages/demo/probe/playtest/tests/observe.test.mjs`）新增 4 个用例：
  水平未到盒、空中越过盒、落地重叠、`targetReached` 的同一几何。

## 4. 修复后诊断运行（隔离 gate 几何）

- `x=1374`、`right=1386`、`bottom=208.5`、`collected=6`、`chestsOpened=2`、`won=true`、
  `win` 事件 1、`terminationReached=true`、`move_to` = `completed`。
- `setup.json`：`mutate-hazard` index 1，`distance 120→10000`，`periodMs 3500→20000`。
- `site-integrity.json`：站点字节未改。
- **限制**：第二只巡逻怪被移远；本运行不能证明"真实危险物下可通关"。

## 4.1 证据与冻结验收对象的绑定

- 诊断运行的 site 是 `work/wasteland-scavenger-recipe/site/v1`；work 与 snapshot 66/66 字节一致
  （`artifacts/identity.json` 的 `verification.workVsSnapshot.same=true`）。
- `site-integrity.json` 前后哈希一致（`unchanged=true`）；config checksum 与 `identity.json` 一致；
  snapshot 零写入。
- 修复本身在 harness（`policy.mjs` / `observe.mjs`），不在验收产物；因此证据绑定到冻结对象。

## 5. 回归

- `pnpm test:playtest`：build 成功；self-test（gate / pickup / input / hazard-legacy）全绿；
  7 个测试文件、81 个测试全过。
- `pnpm test`（全仓）：143 个测试文件、**2132 个测试全过**。
- ⚠️ **过程事故（已恢复）**：`pnpm test:playtest` 的 self-test 默认写
  `.scratch/playtest-v1/runs/2026-10-27-self-test`（已跟踪的历史证据），本次运行覆盖了 10 个文件；
  已用 `git restore --source=HEAD -- .scratch/playtest-v1/runs/2026-10-27-self-test/` 恢复。
  FA-06/后续运行必须先隔离 self-test 输出，避免再次覆盖历史证据。
- 所有诊断运行的 `site-integrity.unchanged=true`；快照零写入。

## 6. 范围裁定

本修复是 **harness 确定性缺陷**（停点阈值与 gate 盒不一致），不是重写 Playtest V1，
不改游戏、不改 shell、不改 `playtest-scenario/v1` 协议；一行几何条件 + 离线测试。
按 doc §7.1「修复验收过程中发现的确定性缺陷」执行。快照与历史产物零改动。

## 7. 对后续票的影响

- **FA-01C**：gate 停点不再阻塞；剩余问题是危险物避让/动作语义。
- **FA-02**：必须在**不移动危险物**的真实运行中取证；本诊断的 `won=true` 不得当作验收证据。
  集齐守卫仍要保留，避免"到 gate 但漏捡"被误判。
- **FA-03**：`gateReached + won=false` 的误归因已收窄（空中越过不再算到达）；
  但"到 gate 且 collected<6"仍会被判 `GAMEPLAY_FAILURE`，漏捡风险仍由 FA-02 守卫与 FA-03 复核处理。

## 8. 证据索引

- 修复前真实运行：`runs/2026-10-27-gate-stop/harness-real/attempt-v1/`
- 修复前隔离诊断：`runs/2026-10-27-gate-stop/harness-clear-patroller-2/attempt-v1/`
- 只加水平条件（中间态）：`runs/2026-10-27-gate-stop/harness-clear-patroller-2-after-fix/attempt-v1/`
- 水平+垂直条件（最终）：`runs/2026-10-27-gate-stop/harness-clear-patroller-2-after-fix-v2/attempt-v1/`
- 场景：`scenarios/gate-stop-diagnostic-clear-patroller-2.json`
- 代码 diff：`packages/demo/probe/playtest/policy.mjs`、`observe.mjs`、`tests/observe.test.mjs`
