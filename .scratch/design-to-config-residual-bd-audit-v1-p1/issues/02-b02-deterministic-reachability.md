# B-02：deterministic reachability

Type: task
Status: open
Owner: —
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
