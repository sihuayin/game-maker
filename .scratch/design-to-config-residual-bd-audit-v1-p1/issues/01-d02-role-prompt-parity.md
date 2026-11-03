# D-02：role 提示词贯通

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md

## Question

实施 D-02：让横版与塔防资源清单的每条资产行都打印 manifest `role`。
依据：[final-report.md](../../design-to-config-residual-bd-audit-v1/final-report.md) §1；
[plan.md](../../design-to-config-residual-bd-audit-v1/plan.md) §1。

### 允许修改

- `packages/assets/src/ops.ts`：新增 `roleNote(a)`；横版行模板（`:958`）与塔防行模板（`:1377`）改用它；更新两处注释。
- `packages/assets/tests/compile-runtime.test.ts`、`packages/assets/tests/compile-td-game.test.ts`。

### 实现与测试要求

- `role` 连续空白折成单空格、去首尾；空值输出 `（role 为空） · `。
- 两份 body 都含同一组 `role`（parity）；新增含换行 role 的单行化用例。
- 不新增依赖；不改 schema、Runtime、CLI/MCP 形状、落盘产物。

### 通过标准

- 上述测试文件绿；`pnpm typecheck` 绿；横版与塔防 body 均含 `role`。
- 票内 `## Answer` 记录测试命令、结果、commit SHA 与回退点。

### 回退方法

- 回退本票 commit；本票是第一张，无跨票依赖。

### 提交

- 独立 commit：`P1-D-02: role prompt parity`。

### 证据

- 测试输出、parity 用例结果、commit SHA；供 PR 审阅。
