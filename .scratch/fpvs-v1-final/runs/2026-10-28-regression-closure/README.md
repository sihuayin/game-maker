# 2026-10-28 · FA-06 最终回归与收口

**结论：回归全绿、约束零破坏、快照完整性通过、报告自检通过；最终 verdict 保持 `pass`；
地图收口，无 open ticket。**

## 1. 回归

| 命令 | 退出码 | 结果 | 证据 |
|---|---|---|---|
| `pnpm test` | 0 | **2160 tests / 145 files 全绿** | `regression/test.txt` · `regression/test.exit` |
| `pnpm typecheck` | 0 | 全部包 `typecheck: Done` | `regression/typecheck.txt` · `regression/typecheck.exit` |
| `pnpm test:playtest` | 0 | self-test **4/4 全绿** + **96 tests / 8 files 全绿** | `regression/playtest.txt` · `regression/playtest.exit` |
| `FREE_ACCEPTANCE_OUT=… pnpm test:acceptance` | 0 | **免费验收闭环全绿**：vitest ✅ · mechanic-probe ✅ · mechanic-coverage `satisfied`；`allOk=true` | `regression/acceptance.txt` · `regression/acceptance.exit` · `free-acceptance/free-acceptance.json` |

为什么跑 `test:acceptance`：本阶段的 `probe-harness.mjs` 改动（READ_STATE 只读危险物盒足迹）
是 `mechanic-probe` 共用的观测面；改动是**加性**的，但按 FA-06 的「如改动触及专项测试」要求，
把免费验收也跑一遍。输出用 `FREE_ACCEPTANCE_OUT` 定向到本目录，**不写其他 effort 的默认路径**。

## 2. 自测输出隔离（`test:playtest`）

`self-test.mjs` 的输出路径是 `.scratch/playtest-v1/runs/2026-10-28-self-test`，该目录**已被跟踪**
（22 个文件）。按 FA-06 要求先确认、再跑、再记录并恢复：

| 项 | 结果 |
|---|---|
| 运行前 | 记录 22 个 tracked 文件 + sha256（`precheck.json → selfTest.hashes`） |
| 运行后覆盖 | **10 个 tracked 文件**被覆盖（`hazard-legacy/reset-1.png`、`report/.../events|input|trace`、`report/attempt-v1/result.json`、`report/summary.json`、`summary.json` 等） |
| 新证据保留 | 复制到 `self-test-run/`（24 个文件 = 22 个 tracked 证据 + 2 个被 `.gitignore` 忽略的 `chrome.log`；排除 `out/`） |
| 恢复 | `git restore --source=HEAD -- <self-test 目录>` |
| 恢复校验 | 10 个文件的 sha256 **全部等于运行前记录**（`self-test-isolation.json → restoredMatchesPrecheck=true`） |
| 最终状态 | 该目录 `git status` 干净；`out/` 仍被 `.gitignore` 忽略 |

记录：`self-test-isolation.json`（覆盖清单、运行后哈希、恢复后哈希、复制位置）。

## 3. 约束核对

| 约束 | 结果 | 证据 |
|---|---|---|
| contracts 源码变更 | **无** | `precheck.json → constraints.contractsSrcChanges = []` |
| MCP 源码变更 | **无** | `constraints.mcpSrcChanges = []` |
| 依赖变更（package.json / pnpm-lock） | **无** | `constraints.depsChanges = []` |
| 删除文件 / 删除测试 | **无** | `constraints.deletedFiles = []`、`testDeletions = []` |
| 代码改动范围 | 仅批准范围：CLI `--scenario-dir`、probe/playtest 策略·执行·观测、`READ_STATE` 加性字段、测试、文档 | `precheck.json → constraints.codeChanges` |
| 新增付费调用 | **零**（全程复用真实产物；assets/vision/game-design/visual-design 源码未改；所有回归离线/免费） | 同上 + `regression/acceptance.txt` |
| 覆盖 `run/vN` / `pack/site/vN` / 历史报告 | **零**（快照/参考哈希 0 变化；`git status` 无历史文件改动） | `postcheck.json` |
| 删除不利结果 | **未删除**（FA-02 失败迭代、FA-03 归因、历史 `AGENT_LIMITATION` 全部保留） | 仓库内证据 |
| 降低阈值 | **未发生**（无测试删除；测试数 2153 → 2160；验收判据统计未改） | `precheck.json` / `regression/test.txt` |

## 4. 快照完整性

| 项 | 结果 |
|---|---|
| 快照文件 | 66 个，**0 变化**（`postcheck.json → snapshot.snapshotChanged=0`） |
| 历史参考 | 14 个，**0 变化**（`referenceChanged=0`） |
| 工作区 vs 快照 | 66 个中只有 `run/v1/qa-report.json` 变（FA-02 试玩写回 + FA-04 视觉写回，均为预期） |
| 三方身份 | 与 FA-05 一致（`consistency-recheck.json → identity.three-way`） |

## 5. 报告自检

| 项 | 结果 |
|---|---|
| demo.md §8 清单 | **27/27 行都有结论（✅）**（`postcheck.json → reportChecklist`） |
| CLI / MCP / 交付报告 | **一致**：`consistency-recheck.json` **12/12**；CLI `create/build` 与 MCP `create_game` 共用 `deliverySummaryOf`，无第二套 verdict |
| 四类语义 | 最终 `pass`；`fail` / `blocked` / `incomplete` 不适用（无失败证据、无阻塞、无缺失/未完成） |
| 未知 / 缺失 / 不匹配 | 未判通过：`mapPlaytest(undefined)=blocked`、`visualReviewToCheck(pending)=incomplete`、`deliverySummaryOf(undefined)=null`（consistency 复核） |
| 最终 verdict | **`pass`**（FA-05 `delivery.verdict`，本轮回归未改变） |

> FA-05 的 `consistency.json` 在最终态复跑后只变了 `generatedAt`；为了不使 FA-05 的
> `evidence.json` 哈希失效，复跑结果另存为 `consistency-recheck.json`，FA-05 原件已 `git restore`。

## 6. 收口

- `map.md` 已记录 FA-06 决策；**Not yet specified 清空**；**无 open ticket**；FPVS-V1 Final
  Acceptance 目的地已达。
- 最终结论仍是 `pass`；没有需要列出的未解决阻塞项。已知限制（危险物接触间接证据、规则 ④ 潜在
  误归因、25.8px 读数、人工视觉、E3 无截图）保留在 FA-05 报告 §3.7，不改变 verdict。
- 本轮未提交/推送（单独授权后再做）。

## 7. 复现

```bash
pnpm test
pnpm typecheck
pnpm test:playtest
FREE_ACCEPTANCE_OUT=.scratch/fpvs-v1-final/runs/2026-10-28-regression-closure/free-acceptance pnpm test:acceptance

node .scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance/consistency.mjs
```

> `test:playtest` 会再次覆盖已跟踪的 self-test 目录；复跑前先记录哈希，复跑后复制证据并用
> `git restore` 恢复（本目录的 `self-test-isolation.json` 是这一次的完整记录）。

## 8. 产物

| 文件 | 说明 |
|---|---|
| `precheck.json` | 运行前：HEAD、快照/工作区哈希、self-test 22 文件哈希、约束审计 |
| `regression.json` | 四条回归命令的退出码、摘要、日志路径 |
| `regression/*.txt` / `*.exit` | 回归原始输出与退出码（`.log` 被 `.gitignore` 忽略，故用 `.txt`） |
| `self-test-isolation.json` | 覆盖的 10 个 tracked 文件、运行后/恢复后哈希、复制位置 |
| `self-test-run/` | 本次 self-test 的新证据副本（24 文件；其中 2 个 `chrome.log` 按 `.gitignore` 不入库） |
| `free-acceptance/` | 免费验收结果（`free-acceptance.json` allOk、mechanic-coverage、probe summary + 组装沙箱） |
| `consistency-recheck.json` | 最终态一致性复跑（12/12） |
| `postcheck.json` | 运行后：快照完整性、git status、§8 清单 27/27、consistency/verdict |
