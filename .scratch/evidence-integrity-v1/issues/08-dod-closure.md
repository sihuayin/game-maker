# DoD 收口：回归、证据聚合与最终结论

Type: task
Status: open
Blocked by: 01, 07

## Question

按 `docs/v7.6/验收.md` §12 的 10 条 DoD 逐项收口：

- 正式入口重算范围内全部必需证据哈希；缺失 / 篡改 / 不可读可被发现；
- 身份、引用、关键报告一致性得到正式校验；
- 最终结论从当前有效检查重算，声明与重算差异可定位；
- 负向测试覆盖篡改、缺失、错配、路径逃逸、结论过期；
- 测试证明原始证据、历史记录、受保护交付未被修改；
- 冻结 Demo 通过正式基线重验，或对差异给出明确、可审计的解释；
- `pnpm test` / `pnpm typecheck` / `pnpm test:playtest` / `pnpm test:acceptance` / `pnpm test:evidence` 全部通过（记录退出码）；
- 无付费调用、无历史版本覆盖、无阈值降低。

产物：
- 最终验收记录（`runs/<timestamp>-final-acceptance/`）：`report.json` / `report.md` 副本、回归日志、DoD 10 条逐项判定、已知限制（含信任边界、单 Demo、`visual-review` 机器边界、MCP 未做、耗时）；
- map 的 Decisions-so-far 追加本票 gist，地图关闭；
- 不覆盖任何历史记录；提交/推送需单独授权。

最终结论只在「证据完整性通过 + 六项重算一致 + 声明与重算一致」时为 `pass`；任何未知不得升级为通过。
