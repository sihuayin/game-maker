# publish-gate：standalone site / assemble_site 的 reachability 复验

Type: task
Status: resolved
Owner: amber
Blocked by: 02
Map: ../map.md

## Question

实施 publish-gate 第五项：standalone `site` / `assemble_site` 在发布前现场重跑 reachability。
依据：[final-report.md](../../design-to-config-residual-bd-audit-v1/final-report.md) §1；
[plan.md](../../design-to-config-residual-bd-audit-v1/plan.md) §3；
[04 研究](../../design-to-config-residual-bd-audit-v1/research/04-publish-gate-config-identity.md)。

### 允许修改

- `packages/pipeline/src/publish-gate.ts`：import `parseGameConfig` / `auditReachability`；
  新增 `configProblem(configPath, manifest)`；在报告通过 `subjectProblem` / `verdictProblem` 之后、
  返回之前调用；显式报告与 auto 查找两条分支共用。
- 测试：`packages/pipeline/tests/publish-gate.test.ts`、`packages/cli/tests/cli-site-gate.test.ts`、
  `packages/mcp/tests/assemble-site-qa-gate.test.ts`。

### 实现与测试要求

- 非 TD、`configPath` 存在时重跑 `auditReachability`；有 error 即拒绝发布；`configPath` 缺省跳过。
- config 解析失败 ⇒ 跳过，由装配器报自己的 schema 错；不在 gate 重复 Ownership。
- 不改契约；不扩第七条 `visual-config-coherence`；不改 CLI/MCP 参数与返回形状；退出码语义不变。
- 实现时逐入口复核 `build` / `create --yes` / MCP `create_game` / standalone `site` / `assemble_site`
  的 `configPath` 传递。
- 正 / 负 / 边界：config A 绿报告 + config B 不可达 ⇒ 拒绝；可达 config ⇒ 通过；
  TD / `configPath` 缺省 ⇒ 跳过。

### 通过标准

- 上述测试文件绿；`pnpm typecheck` 绿；语料 publish-gate 三元组重判无未解释的新增拒绝。
- 票内 `## Answer` 记录测试命令、结果、commit SHA 与回退点。

### 回退方法

- 回退本票 commit，删除 `configProblem` 调用；不影响 01 / 02。

### 提交

- 独立 commit：`P1-publish-gate: reachability recheck`。

### 证据

- 测试输出、入口复核记录、commit SHA；供 PR 审阅。

## Answer

**已实施并验收。** commit `4e6d866`（`P1-publish-gate: reachability recheck`），基线 `2be43e7`。

### 改动

- `packages/pipeline/src/publish-gate.ts`：import `parseGameConfig` / `auditReachability`；新增
  `configProblem(configPath, manifest)`：`configPath` 缺省 ⇒ 跳过；JSON / schema 解析失败 ⇒ 跳过
  （由装配器报自己的 schema 错）；否则现场跑 `auditReachability`，有 `error` 即返回摘要。
  在 `subjectProblem` / `verdictProblem` 之后、返回之前调用 —— 显式报告与 auto 查找两条分支共用。
  文案是「**这份 config 本身不可达**」，不写成「报告不能证明属于这份 config」。
  文件头更新：报告身份仍只钉 pack；本项补的是现场重跑，不改 config 身份绑定。
- 测试：
  - `packages/pipeline/tests/publish-gate.test.ts`（+5）：显式分支 / auto 分支拒绝；可达 config 放行；
    `configPath` 缺省跳过；config 解析失败跳过。
  - `packages/cli/tests/cli-site-gate.test.ts`（+2）：显式 `--qa-report` 与 auto 查找两条都退 4、站点不产。
  - `packages/mcp/tests/assemble-site-qa-gate.test.ts`（+1）：`assemble_site` 退 4、站点不产。

### 入口复核（四个真实发布入口都传 `configPath`）

| 入口 | 位置 | `configPath` |
|---|---|---|
| CLI `build` / `create --yes` | `packages/cli/src/cli.ts:281-284` | `built.paths.config` |
| CLI `site` | `packages/cli/src/cli.ts:717-720` | `--config` 解析后的 `configPath` |
| MCP `create_game` | `packages/mcp/src/server.ts:374-378` | `built.paths.config` |
| MCP `assemble_site` | `packages/mcp/src/server.ts:433-436` | `args.configPath` |

缺省只服务库调用与既有测试；不存在「发布入口不传 configPath」的逃逸路径。

### 验证

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run packages/pipeline/tests/publish-gate.test.ts packages/cli/tests/cli-site-gate.test.ts packages/mcp/tests/assemble-site-qa-gate.test.ts packages/contracts/tests/reachability.test.ts packages/qa/tests/gameplay.test.ts` | 66/66 通过（5 文件） |
| `pnpm exec vitest run packages/{pipeline,cli,mcp,contracts,qa,assets,demo}` | 2103/2103 通过（139 文件） |
| `pnpm typecheck` | 全包通过 |
| 语料三元组（只读 `/tmp/p1-publish-gate-scan.mjs`） | 31 份 QA 报告；可配 `config` + 匹配 pack 的 **23 组**；reachability 新增 error **0**（5 份无同目录 config 跳过；0 份 TD） |

- 复现口径（`plan.md` §3.5）：绿报告 A + config B（满高墙）⇒ 退 4；A + A ⇒ exit 0 —— 由 CLI 三条与
  gate 单测覆盖。
- 契约：无变更；未引入 `subject.configChecksum`；CLI/MCP 参数与返回形状不变；退出码仍为 `invalid`(4)。
- 零付费：未调用模型、未生图、未重建站点。

### 回退

- `git revert 4e6d866`：删除 `configProblem` 及其调用与新增测试；不影响 01 / 02。

### 证据

- 测试输出见上表；commit `4e6d866`；入口复核见上表；语料脚本在 `/tmp`（未提交）。
