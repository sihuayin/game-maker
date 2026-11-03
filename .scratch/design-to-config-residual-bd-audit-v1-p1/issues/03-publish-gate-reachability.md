# publish-gate：standalone site / assemble_site 的 reachability 复验

Type: task
Status: open
Owner: —
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
