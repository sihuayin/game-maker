# D-02：role 提示词贯通

Type: task
Status: resolved
Owner: amber
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

## Answer

**已实施并验收。** commit `09e2b53`（`P1-D-02: role prompt parity`），基线 `3df872e`。

### 改动

- `packages/assets/src/ops.ts`：新增 `roleNote(a)` —— `role` 连续空白折成单空格、去首尾，
  输出 `<role> · `；空值输出 `（role 为空） · `。横版 `resourceBrief`（原先不印 role）与塔防
  `tdResourceBrief`（原先直接印 `a.role`）都改为调用它；更新两处文档注释。
- `packages/assets/tests/compile-runtime.test.ts`：横版每条资产行含 manifest `role`；同一包下横版 /
  塔防 body 的 role 集合 parity；换行 role 单行化；空 role 占位且行结构完整。
- `packages/assets/tests/compile-td-game.test.ts`：塔防每条资产行含 manifest `role`（防回退）。

### 验证

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run packages/assets/tests/compile-runtime.test.ts packages/assets/tests/compile-td-game.test.ts` | 62/62 通过（2 文件） |
| `pnpm exec vitest run packages/assets/tests` | 624/624 通过（46 文件） |
| `pnpm typecheck` | 全包通过 |
| 负向检查：临时去掉横版行的 `roleNote` | 「横版清单每条资产行都带 role」失败（判据有牙齿），随后还原 |

- 零付费：未调用模型、未生图、未重建站点。
- 语料有效性：只改提示词渲染，不触碰任何 audit 逻辑 ⇒ 新增 error 预测 0（全局重判在 06 复验）。
- 契约：无变更；`AssetPackEntry.role` 原已存在。

### 回退

- `git revert 09e2b53`（本票是第一张，无跨票依赖；回退不影响后续票）。

### 证据

- 测试输出见上表；commit `09e2b53`；parity / 换行 / 空值用例位于上述两个测试文件。
