# FA-06 最终回归与收口

Type: task
Status: closed
Owner: main session · 2026-10-28
Map: ../map.md
Blocked by: 09

## Question

对最终验收做工程收口：跑齐回归、核对约束、确认无未授权变更，并把地图收口。

1. **回归**：`pnpm test`、`pnpm typecheck`、`pnpm test:playtest`；如改动触及专项测试，
   追加 `pnpm test:acceptance`（按实际脚本定义）。
   ⚠️ **自测输出隔离**：`test:playtest` 的 self-test 默认写
   `.scratch/playtest-v1/runs/<date>-self-test`，该路径可能已被跟踪；FA-01B 曾覆盖 10 个历史文件并用
   `git restore` 恢复。运行前先确认输出路径，避免再次覆盖历史证据；若已覆盖，记录并恢复。
2. **约束核对**：未发生未经批准的 contracts/CLI/MCP/依赖变更；无新增付费调用；
   未覆盖 `run/vN` / `pack/site/vN` / 历史报告；未删除不利结果；未降低阈值。
3. **快照完整性**：FA-01 哈希清单复核，快照字节未变；工作区身份与快照一致。
4. **报告自检**：§8 最终验收清单逐项有结论；CLI/MCP/delivery/报告一致；
   `pass/fail/blocked/incomplete` 语义正确；未知/缺失/不匹配未判通过。
5. **收口**：更新 map 的 Decisions so far；若 verdict 非 pass，列出未解决项与后续建议，
   不把「未完成」写成「通过」。

完成条件：测试与类型检查通过；约束零破坏；报告可复核；地图收口（或明确剩余阻塞）。

## Answer

**结果：回归全绿、约束零破坏、快照完整性通过、报告自检通过；最终 verdict 保持 `pass`；
地图收口，无 open ticket。**

1. **回归**：`pnpm test` **2160/145 exit 0** · `pnpm typecheck` **exit 0** ·
   `pnpm test:playtest` self-test **4/4** + **96/8 exit 0** ·
   `FREE_ACCEPTANCE_OUT=… pnpm test:acceptance` **exit 0**（vitest / mechanic-probe /
   mechanic-coverage=satisfied；`allOk=true`）。追加免费验收的理由：本阶段改了
   `probe-harness.mjs`（READ_STATE 加性字段），它是 mechanic-probe 共用的观测面。
   原始输出：`runs/2026-10-28-regression-closure/regression/*.txt` + `*.exit`。
2. **自测输出隔离**：self-test 默认写已跟踪的 `.scratch/playtest-v1/runs/2026-10-28-self-test`
   （22 文件）；运行覆盖了 **10 个 tracked 文件**，已把新证据复制到
   `runs/2026-10-28-regression-closure/self-test-run/`（24 文件，排除 `out/`），并用
   `git restore` 恢复；10 个文件的 sha256 全部等于运行前记录
   （`self-test-isolation.json → restoredMatchesPrecheck=true`）。
3. **约束核对**：contracts 源码 / MCP 源码 / 依赖（package.json·pnpm-lock）**零变更**；
   **零删除**（文件/测试）；代码改动只在批准范围（CLI `--scenario-dir`、probe/playtest
   策略·执行·观测、`READ_STATE` 加性字段、测试、文档）；**零付费**；未覆盖
   `run/vN` / `pack/site/vN` / 历史报告；未删除不利结果；未降低阈值。
4. **快照完整性**：快照 66 + 参考 14 条哈希 **0 变化**；work vs 快照只有
   `run/v1/qa-report.json`（FA-02/FA-04 写回，预期）；三方身份与 FA-05 一致。
5. **报告自检**：demo.md §8 清单 **27/27 行都有结论**；`consistency-recheck.json` **12/12**
   （CLI/MCP/交付报告/报告文本一致；缺席证据不默认 pass）；四类语义正确（最终 `pass`，
   fail/blocked/incomplete 不适用）；未知/缺失/不匹配未判通过。
6. **收口**：map 的 Decisions 已加 FA-06 行；Not yet specified 清空；**无 open ticket**；
   FPVS-V1 Final Acceptance **目的地已达**。最终 verdict 仍是 `pass`，未把未完成写成通过。
   报告：[runs/2026-10-28-regression-closure/README.md](../runs/2026-10-28-regression-closure/README.md)。
