# B-02：deterministic reachability

Type: task
Status: resolved
Owner: amber
Blocked by: 01
Map: ../map.md

## Question

实施 B-02：把 `auditReachability(...)` 的 error 放进 `deterministic` 档，不进 `resampleable`。
依据：[final-report.md](../../design-to-config-residual-bd-audit-v1/final-report.md) §1；
[plan.md](../../design-to-config-residual-bd-audit-v1/plan.md) §2。

### 允许修改

- `packages/contracts/src/config-audit.ts`：import `auditReachability`；在 `deterministic` 数组追加
  `...auditReachability(config, ctx.manifest)`；更新文件头「两档」说明。
- `packages/assets/src/ops.ts`：仅改循环后的确定性失败文案（`:1229-1241`）为家族中性。
- `packages/pipeline/src/create-game.ts`：仅改汇合点文案（`:625-636`）为「改配置、布局或清单」。
- 测试：`packages/contracts/tests/reachability.test.ts`、新增 `packages/contracts/tests/config-audit.test.ts`、
  `packages/assets/tests/compile-runtime.test.ts`、`packages/pipeline/tests/create-game.test.ts`、
  `packages/qa/tests/gameplay.test.ts`。

### 实现与测试要求

- 不加 `ConfigIssue.code: "unreachable"`，不扩展 contracts 闭集；不改 `ConfigIssue` 形状。
- 行为变化：不可达 config 的失败阶段从 QA 提前到编译 / 汇合点；退出码仍为 `invalid`(4)；
  默认 QA 路径的最终结果不变。
- 正 / 负 / 边界：不可达 config 进入 deterministic、不进入 resampleable、不喂回下一发；
  可达 config 不新增 error。

### 通过标准

- 上述测试文件绿；`pnpm typecheck` 绿；语料重判 reachability 新增 error 为 0（任何新增须逐条解释）。
- 票内 `## Answer` 记录测试命令、结果、commit SHA 与回退点。

### 回退方法

- 回退本票 commit，恢复 `auditConfigPipeline` 原档位与文案；不得影响 01 的 role 改动。

### 提交

- 独立 commit：`P1-B-02: deterministic reachability`。

### 证据

- 测试输出、语料重判结果、commit SHA；供 PR 审阅。

## Answer

**已实施并验收。** commit `2377716`（`P1-B-02: deterministic reachability`），基线 `09e2b53`。

### 改动

- `packages/contracts/src/config-audit.ts`：import `auditReachability`；`deterministic` 数组追加
  `...auditReachability(config, ctx.manifest)`；文件头「两档」说明补上 reachability 与层覆盖同档。
- `packages/assets/src/ops.ts`：循环后的确定性失败文案改为家族中性（「确定性失败、重抽 config 改不了、
  按每条提示改布局 / 配置或资源清单」）；顺带更正该段注释（不再只剩层覆盖）。**未改**循环内 `resampleable` 路径。
- `packages/pipeline/src/create-game.ts`：汇合点文案补成「改配置、布局或清单」。
- 新增 `packages/contracts/tests/config-audit.test.ts`：不可达 config 的 reachability error 进
  `deterministic`、不进 `resampleable`；可达夹具不新增 error；`deterministic` 仍是超集。
- `packages/assets/tests/compile-runtime.test.ts`：不可达 config ⇒ `invalid`、只发一趟、不落盘、
  文案含「够不到 / 布局 / 确定性失败」且不含「模型错」；可达夹具照常通过。既有票 48 锚点用例按新语义
  把两个实心体从悬空改回贴地（悬空的 40×40 块现在会真的挡路）。
- `packages/pipeline/tests/create-game.test.ts`：reuseConfig + 满高墙 ⇒ `invalid`(4)、在 QA 之前、
  文案指向布局。既有「QA 硬失败 ⇒ 报告先落盘」两条改为**注入合法失败报告**触发（真链不可达现在走不到 QA）。
- `packages/qa/tests/gameplay.test.ts`：未改，回归通过 —— QA 的 `reachability` 判据仍在 `checked`。

**授权扩展（F3 裁定点，用户 2026-11-03 明确授权）**：全仓回归发现 3 个集成测试以「不可达 config 在 QA
才失败」为前提，不在本票原允许清单内。经用户授权后更新：

- `packages/cli/tests/cli-create.test.ts`：不可达 config ⇒ 退出码 4、站点不产、**无 qa-report**
  （QA 未到达）；错误指向 config 阶段的 reachability。
- `packages/mcp/tests/create-game-qa-failure.test.ts`：同上，MCP `create_game` 的发布语义改为
  「config 步硬拒、退 4、站点不产、无 qa-report」。文件名保留（历史证据多处引用）。
- `packages/pipeline/tests/delivery-integration.test.ts`：「QA 硬失败 ⇒ delivery 提前落盘」改为注入
  合法失败报告触发，其余断言（`qa=fail`、site/playable-smoke blocked、verdict fail、subject 在）原样保留。

### 验证

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run packages/contracts/tests/reachability.test.ts packages/contracts/tests/config-audit.test.ts packages/assets/tests/compile-runtime.test.ts packages/pipeline/tests/create-game.test.ts packages/qa/tests/gameplay.test.ts` | 130/130 通过（5 文件） |
| `pnpm exec vitest run packages/{contracts,assets,pipeline,qa,cli,mcp,demo}` | 2095/2095 通过（139 文件） |
| `pnpm typecheck` | 全包通过 |
| 语料重判（只读 `/tmp/p1-b02-scan.mjs`） | 5288 份 JSON；152 份 `game-config/v1`、171 份 manifest；按最近包配对 152/152；**reachability error 0 条**（研究口径 134 对亦为 0） |

- 行为变化（须在 06 / 07 明示）：不可达 config 的失败阶段从 QA 提前到编译 / 汇合点；退出码仍为
  `invalid`(4)，但落盘时机与文案不同；QA 的 reachability 判据保留。
- 契约：无变更；未加 `ConfigIssue.code: "unreachable"`；`ConfigIssue` 形状不变。
- 零付费：未调用模型、未生图、未重建站点。

### 回退

- `git revert 2377716`：删除 `config-audit.ts` 的一行 spread，恢复两条文案与既有测试；不影响 01 的 role 改动。

### 证据

- 测试输出见上表；commit `2377716`；语料扫描脚本位于 `/tmp`（未提交）。
