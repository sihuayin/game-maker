# D-01：viewport 全链贯通

Type: task
Status: open
Owner: —
Blocked by: 03
Map: ../map.md

## Question

实施 D-01：同一次调用的 viewport 在理解 / 构建 / 站点装配各阶段逐次相等。
依据：[final-report.md](../../design-to-config-residual-bd-audit-v1/final-report.md) §2.1；
[plan.md](../../design-to-config-residual-bd-audit-v1/plan.md) §4。

### 已批准的契约增量（不得扩大）

- `UnderstandingInput.viewport?: { w: number; h: number }`
- `AssembleOptions.viewport?`
- `SiteOptions.viewport?`
- `buildWorld` / `buildTdWorld` 的 opts 新增可选 `viewport`

默认值不变；不新增 CLI/MCP 参数；不改序列化形状；不改 Runtime。若实施中发现必须扩大契约或改变边界，
**暂停并重新审批**；不得退化成只合并常量后声称完成。

### 允许修改

- `packages/pipeline/src/create-game.ts`
- `packages/demo/src/assemble.ts`
- `packages/demo/src/site.ts`
- `packages/demo/src/td/site.ts`
- `packages/demo/src/world.ts`
- `packages/demo/src/td/world.ts`
- `packages/assets/src/ops.ts`（仅修正 `:99-101` 的失真注释）
- 测试：`packages/pipeline/tests/create-game.test.ts`、`packages/demo/tests/world.test.ts`、
  `packages/demo/tests/site.test.ts`、`packages/demo/tests/td-site.test.ts`、
  `packages/assets/tests/plan-background-gate.test.ts`、`packages/qa/tests/layers.test.ts`

### 实现纪律

- 不能只把 viewport 传到最外层、内部 world builder 再读常量；必须逐行替换 `buildWorld` / `buildTdWorld`
  内的 `VIEWPORT` 引用。
- 用**自定义视口测试**证明该值到达：世界描述的 `viewport`、背景层尺寸、HUD fallback 盒、
  站点屏幕空间审计。
- 站点按 `format` 分派时把 viewport 传给横版 / 塔防装配；`auditScreenSpace` / `auditTdWorldSize`
  使用同一值。

### 通过标准

- 上述测试文件绿；`pnpm typecheck` 绿；默认路径语料 `world.size.h` 117/117 = 270；
  自定义视口用例证明各阶段逐次相等；CLI/MCP 形状不变。
- 票内 `## Answer` 记录测试命令、结果、commit SHA 与回退点。

### 回退方法

- 回退本票 commit，移除可选字段与传递；不影响 01–03。

### 提交

- 独立 commit：`P1-D-01: viewport passthrough`。

### 证据

- 测试输出、自定义视口断言、语料结果、commit SHA；供 PR 审阅。
