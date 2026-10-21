# 02. P0-06 · 静默降级与入口错误语义

Type: task
Status: resolved
Owner: main session · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

修掉「不静默降级」与「入口语义不一致」两类真实缺陷。对应 `CAP-ASSET-01` / `CAP-ENTRY-01` /
`CAP-ENTRY-02`，范围见 `docs/v4/P0-00-p0-scope.md` §3 P0-06。

1. **`frames` 不再静默折叠**：`planAssets` 对 `frames` 候选明确 `invalid`
   （消息说明「请改用 image 或逐帧模式」），sidecar 记录模型真实候选。
   P0 默认采用「明确失败」，不参数化保留 `frames`。
2. **MCP 错误翻译**：复用 CLI 的 `asCommandError` 语义（或抽到共享层），
   使设计拒绝 / 契约错误 / HTTP / timeout 的 `_exitCode` 与 CLI 一致（4 / 3 / 2）。
3. **MCP `stylePath` 相对化**：与 CLI `styleRefOf` 同一规则；绝对路径不再被
   `StyleReferencePath` 拒。

## 验收

- 模型给 `frames` 候选 ⇒ `planAssets` 明确失败且不落 sidecar；sidecar 不再把候选改写成 `image`。
- 非法 kind / 候选 import / 能力缺失的既有失败行为不变。
- MCP 设计拒绝 ⇒ `_exitCode=4`；HTTP 失败 ⇒ 3；usage ⇒ 2。
- MCP 绝对路径 `stylePath` ⇒ 成功（与 CLI 同输入）。
- `pnpm test` / `pnpm typecheck` 全绿。

## 边界

- 不新增 `source.kind`；不新增 route；不把 `frames` 变成第四条 route；
  不做 TD / review / 并发参数等价（P2）；不改变 CLI 退出码语义；
  不改变 MCP 工具面（除必要的错误语义修复）。
- MCP QA 硬失败测试归票 09（发布闸门），本票不重复实现。
- **若抽取错误翻译层触及共享形状或需要新增契约**：先按 Q5 交逐项清单，获批后才动。
- 零付费；不提交。

## 产出

`## Answer`：三处改动的 `path:line`、MCP `_exitCode` 对照表、测试文件名与用例数、
契约变更清单及批准状态。

## Answer

**已收口（施工）。** 三项全部落链；零付费、未提交。无契约形状 / CLI flag / MCP 参数 / 新依赖变更；
`asCommandError` 与 `styleRefOf` 只是**搬家**（CLI 行为不变）。Q5 逐项清单已获用户 2026-10-21
逐字批准「抽到共享层」。

### 1. `frames` 不再静默折叠（`CAP-ASSET-01`）

- 落点：`packages/assets/src/ops.ts:384`——`planAssets` 在 `parseRecipe` 成功之后、任何路线决策之前，
  只要 `assets[]` 里有一件 `source.kind:"frames"` ⇒ `CommandError("invalid")`（退出码 4），
  消息点名资源 id 与「逐帧模式（frames）」，说明 P0 不接受模型自己挑这条候选。
- 行为：**不重采样**（一发就收，盲重发只会重复同一件事）；**不落 recipe / sidecar**；
  `call.trip({ spent })` 让这一发的花费照实进账。
- 旧降级路：`candidate: frames → image` 的收窄已不可达（上面先拒），并就地加了注释，免得下一个人
  把它读回「frames 会被折成 image」。
- 边界：`authoring[]` 的 `frames` **契约本来就拒**（「母版是一张位图，不是动画」）—— 不在这里再写一遍。

### 2. MCP 错误翻译（`CAP-ENTRY-01`）

- `asCommandError` 从 `packages/cli/src/cli.ts` 搬到 `packages/contracts/src/command.ts:103`
  （按形状识别 `rejections` → 4、`failure` 的 `http`/`timeout` → 3、其余 `failure` → 4；
  文案与账的携带逐字不变）；`assets` 原样再导出，CLI（`cli.ts:656`）与 MCP 共用。
- MCP：`packages/mcp/src/server.ts:414` 的 catch **先 `asCommandError(raw)`**，再用
  `exitCodeOfError(e)`；账 / 失败现场仍按能力读。
- 实测（`packages/mcp/tests/error-semantics.test.ts`）：设计拒绝（R12 的 `rejections`）⇒ `_exitCode=4`；
  HTTP 500 ⇒ `3`；非资源包 ⇒ `2`。翻译之前前两档都会退 1。

### 3. MCP `stylePath` 相对化（`CAP-ENTRY-02`）

- `styleRefOf` 从 `cli.ts` 搬到 `packages/pipeline/src/create-game.ts:251`（规则一字不改）；
  CLI 在 `cli.ts:505`、MCP 在 `server.ts:344`（`styleRefOf(process.cwd(), String(args.stylePath))`）共用。
- `packages/mcp/tests/create-game-no-digest.test.ts` 删掉了「测试手工转相对路径」的绕行，
  现在直接给**绝对路径**跑完整 create 链并成功 —— 与 CLI 同输入同结果。

### 测试与命令

| 命令 | 结果 | 证据 |
|---|---|---|
| `pnpm test` | exit 0 · 113 文件 / **1744 用例全绿** | `runs/2026-10-21-ticket-02/test.txt` |
| `pnpm typecheck` | exit 0 | `typecheck.txt` |
| `pnpm build` | exit 0 | `build.txt` |
| `pnpm check:deps` | exit 0（9 个包） | `check-deps.txt` |
| 定向：frames / MCP 错误码 / MCP 绝对路径全链 | exit 0 · 5 用例 | `targeted.txt` |

新增：`plan-frames-candidate.test.ts`（1 用例）、`error-semantics.test.ts`（3 用例）；
更新：`create-game-no-digest.test.ts`（绝对路径）。

### 既有行为不变

非法 kind / 候选 import / 能力缺失的既有失败路没有改动（`route-resolver`、`plan-sidecar` 等既有
用例全绿）；MCP 的 QA 硬失败路径仍归票 09，本票未碰。
