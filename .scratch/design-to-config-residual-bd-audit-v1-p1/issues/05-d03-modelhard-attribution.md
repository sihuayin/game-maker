# D-03：modelHard 归因与受限重采样反馈

Type: task
Status: open
Owner: —
Blocked by: 04
Map: ../map.md

## Question

实施 D-03：只有确定可修的 config 错误进入反馈；确定的清单根因硬拒；不确定 ⇒ config 可修。
只改编译循环，不改规划循环 / 塔防循环。
依据：[final-report.md](../../design-to-config-residual-bd-audit-v1/final-report.md) §2.4；
[plan.md](../../design-to-config-residual-bd-audit-v1/plan.md) §5。

### 允许修改

- `packages/contracts/src/config-audit.ts`：新增内部纯函数 `classifyConfigIssues(config, manifest, issues)`，
  返回 `{ configFixable, packRooted }`；复用 `ENTITY_ASSET_KINDS`；不读 message 文本；
  不改变 `auditConfigPipeline` 返回形状。
- `packages/assets/src/ops.ts`：只改编译循环（`:1174-1215`）；解析一次 `modelHard` → 分类；
  `packRooted` 非空 ⇒ `call.trip({ spent })` 后抛 `CommandError("invalid")`；
  `configFixable` 非空 ⇒ 把摘要拼进下一发 prompt；schema 失败同样追加 schema 摘要；
  新增私有 `retryFeedback()` 负责截断 / 折行。
- 测试：`packages/contracts/tests/config-audit.test.ts`（分类器）、
  `packages/assets/tests/compile-runtime.test.ts`（反馈 / 包根因 / 不确定 / schema / bad）、
  `packages/pipeline/tests/create-game.test.ts`。

### 实现与测试要求

- 保守归因六条细则（`plan.md` §5.2）：能力先从 config 语义与 `where` 推导；`entity "<id>"` 必须确认实体语义；
  `entity-state-frames` 必须确认 code 命中且实体 kind 确实是 `chest` / `danger`；hud / player / scene
  使用明确结构映射；只有「能力明确 + manifest 无任何满足能力的资产 + 错误无法由 config 满足」三者同时成立
  才归包根因；任何不确定 ⇒ config 可修。
- 不新增对外归因码；不改 `ConfigIssue` / `auditConfigPipeline` 返回形状或对外错误码。
- 只有确定的包根因才把 `attempts` 从 3 降为 1；核对既有 `attempts` / ledger 断言。
- 不改变规划循环、塔防循环、Runtime、CLI/MCP 形状、落盘产物。
- 付费验证不在本票执行；只保证 plumbing 与确定性测试。

### 通过标准

- 上述测试文件绿；`pnpm typecheck` 绿；语料 resampleable 预测 86 条（71 state-frames + 15 无码），
  新分类器预测 0 条包根因；无付费调用。
- 票内 `## Answer` 记录测试命令、结果、commit SHA 与回退点。

### 回退方法

- 删除循环内的分类 / 反馈 / 硬拒，恢复 `modelHard` 原逻辑；分类器可一并删除。
- 若付费验证（07 之后）不通过，只回退反馈部分，保留归因与硬拒。

### 提交

- 独立 commit：`P1-D-03: restricted retry feedback`。

### 证据

- 测试输出、语料分类结果、attempts / ledger 断言、commit SHA；供 PR 审阅。
