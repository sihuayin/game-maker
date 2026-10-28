# FA-06 最终回归与收口

Type: task
Status: open
Owner: unclaimed
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

<!-- pending -->
