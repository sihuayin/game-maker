# 票 02（P0-06）· 静默降级与入口错误语义 —— 验证证据

日期：2026-10-21 · 分支 `p0-construction-v1` · 零付费、未提交。

## 命令与退出码

| 命令 | 退出码 | 摘要文件 |
|---|---|---|
| `pnpm test` | 0 | `test.txt`（113 文件 / 1744 用例全绿） |
| `pnpm typecheck` | 0 | `typecheck.txt` |
| `pnpm build` | 0 | `build.txt` |
| `pnpm check:deps` | 0 | `check-deps.txt`（9 个包） |
| 定向：frames + MCP 错误码 + MCP 绝对路径全链 | 0 | `targeted.txt`（5 用例） |

## 落点

1. **`frames` 明确失败**（CAP-ASSET-01）：`packages/assets/src/ops.ts:384`——在 `parseRecipe`
   成功之后、任何路线决策之前拒（`invalid` / 4）；**不重采样**（一发就收）、不落 recipe / sidecar；
   `call.trip({spent})` 保留这一发的花费。`authoring[]` 的 `frames` 已由契约自己拒（母版是位图）。
2. **MCP 错误翻译**（CAP-ENTRY-01）：`asCommandError` 从 `cli.ts` 搬到
   `packages/contracts/src/command.ts:103`（形状不变、行为逐字不变），`assets` 再导出；
   `packages/mcp/src/server.ts:414` 的 catch 先翻译再算 `_exitCode`。
3. **MCP `stylePath` 相对化**：`styleRefOf` 从 `cli.ts` 搬到
   `packages/pipeline/src/create-game.ts:251`；CLI（`cli.ts:505`）与 MCP（`server.ts:344`）共用。

## 测试

- 新增 `packages/assets/tests/plan-frames-candidate.test.ts`：1 用例（frames 候选 ⇒ 4、点名 id 与
  「逐帧模式」、一发就收、零落盘）。
- 新增 `packages/mcp/tests/error-semantics.test.ts`：3 用例（设计拒绝 4 / HTTP 3 / usage 2）。
- `packages/mcp/tests/create-game-no-digest.test.ts`：现在直接给**绝对路径** `stylePath` 跑完整链，
  证明与 CLI 同输入同样成功。

## 变更面

- 无契约形状 / CLI flag / MCP 参数 / 新依赖；`asCommandError` 与 `styleRefOf` 是搬家，
  CLI 行为一字不改。Q5 逐项清单已获用户 2026-10-21 逐字批准（「抽到共享层」）。
