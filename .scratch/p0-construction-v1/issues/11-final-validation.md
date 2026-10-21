# 11. 最终验证与完工总结

Type: task
Status: open
Owner: —
Blocked by: 01, 02, 03, 04, 07, 08, 09, 10
Map: ../map.md

## Question

按 `docs/v4/P0-00-p0-scope.md` §5 的完成判据做全量验证，交付书面总结。
只做验证与记录；发现缺口时登记，不擅自扩范围修复。

1. 跑并记录：`pnpm test`、`pnpm typecheck`、`pnpm build`、`pnpm check:deps`、`pnpm check`、
   `pnpm test:playable`、v7 `accept`。
   `pnpm check` 的 2 条既有 `.scratch` 断链单独记录，不算本图引入。
2. 逐条核对 12 条非 `CAP-E2E-01` 的完成判据，给「CAP → 测试 / 命令 → 证据路径 → 结论」表。
3. 核对工作树：v7 包与 `fixtures/` 的 sha256 / mtime 未变；`game-maker.local.json` 未变；
   既有 `CONTEXT.md` 改动未被碰。
4. 书面总结：施工范围、偏差、未完成项；**必须写明「单跑 E2E（P0-FINAL）未完成」**，
   不得出现无条件的「P0 全部验收通过」。

## 验收

- 每条判据都有可复跑的命令与证据路径。
- 若某项未达成：记录阻塞点与最小补充条件，不把它写成通过。
- 证据落 `.scratch/p0-construction-v1/runs/<date>-final/`。
- 不提交、不推送；停在等待单独授权状态。

## 边界

- 只验证与记录；不修补缺口（缺口登记后由新票或用户裁定）。
- 不跑真实上游 / 付费链；不改 v7 包与 `fixtures/`；不碰 `game-maker.local.json` 与无关 `.scratch`。
- **P0-FINAL 不在本票**。

## 产出

`## Answer`：命令与退出码表、12 条判据对照表、工作树校验、书面总结链接。
