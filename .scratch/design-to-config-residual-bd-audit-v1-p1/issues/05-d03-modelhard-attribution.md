# D-03：modelHard 归因与受限重采样反馈

Type: task
Status: resolved
Owner: amber
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

## Answer

**已实施并验收。** commit `42a9fca`（`P1-D-03: restricted retry feedback`），基线 `6354f44`。

### 改动

- `packages/contracts/src/config-audit.ts`：新增内部纯函数 `classifyConfigIssues(config, manifest, issues)`
  → `{ configFixable, packRooted }`。规则严格按 `plan.md` §5.2：实体语义从 config 确认（id 存在 + kind），
  复用 `ENTITY_ASSET_KINDS`；`decor` / 幻觉 id / 未知 `where` 一律 config 可修；
  `entity-state-frames` 仅在 chest/danger 上追加「≥2 帧」能力；hud / player / background 按 kind 存在性判；
  不读 message 文本、不改 `ConfigIssue` / `auditConfigPipeline` 返回形状。
- `packages/assets/src/ops.ts`：只改**编译循环**。`bad` 档中 `failure === "schema"` 时、以及
  `parseGameConfig` 失败时，把失败摘要追加到下一发 prompt；`modelHard` 先分类：
  `packRooted` 非空 ⇒ `call.trip({ spent })` 后立即抛 `CommandError("invalid")`（`attempts: 1`），
  文案指向**资源清单 / 包**、不写「模型错」；`configFixable` 非空 ⇒ 照常重采样，并把上一发的
  `where/message` 带入下一发。新增私有 `retryFeedback()`：固定标题 + 最多 6 条、每条折行并截断 300 字符。
  `bad`（http / timeout / truncated / empty-input）**不喂回**。
- 未触碰规划循环、塔防循环、Runtime、CLI/MCP 形状与落盘产物。

### 测试

| 类型 | 用例 | 结果 |
|---|---|---|
| 单测（`config-audit.test.ts`，+11） | entity 有/无 allowed kind、幻觉 id、decor、chest 状态帧有/无 ≥2 帧备选、hud / player / background、未知 where | 全通过 |
| 循环（`compile-runtime.test.ts`，+4） | 无 ui 包 ⇒ 1 发硬拒、不写「模型错」、指向清单；幻觉 id ⇒ 3 发且第 2/3 发带上一发摘要；schema 失败 ⇒ 第 2/3 发带 schema 摘要；`bad` ⇒ 三发 body 无反馈 | 全通过 |

### 验证

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run packages/contracts/tests/config-audit.test.ts packages/assets/tests/compile-runtime.test.ts packages/assets/tests/compile-td-game.test.ts packages/pipeline/tests/create-game.test.ts` | 139/139 通过（4 文件） |
| 全仓 `vitest run`（10 个包） | 2382/2382 通过（157 文件） |
| `pnpm typecheck` | 全包通过 |
| 语料重判（只读 `/tmp/p1-d03-scan2.mjs`） | 117 份 `game-config.json`、117 份配对 manifest；146 条 resampleable（71 `entity-state-frames` + 75 无码）；**新分类器 0 条包根因** |

- 语料口径：run 版本与 pack 版本**不保证相等**（publish-gate 研究 §3.2），同层配对取**最新 pack**；
  否则会把 `run/v1` 配到只有 1 件资产的半成品 `pack/v1`，制造假的包根因。research 的 86 条来自更窄的
  design 配对；本口径多出的无码项全部仍是 config 可修，包根因计数不变（0）。
- 包根因行为由 **fabricated 临时包**（删掉全部 ui 资产）见证；语料 0 条**不**表示包根因不存在。
- 零付费：未调用模型、未生图、未重建站点；规划 / 塔防循环未改。

### 回退

- `git revert 42a9fca`：删除分类器与循环内的分类 / 反馈 / 硬拒，恢复 `modelHard` 原逻辑；
  不影响 01–04。若 07 的付费验证不通过，只回退**反馈**部分，保留归因与硬拒。

### 证据

- 测试输出见上表；commit `42a9fca`；语料脚本在 `/tmp`（未提交）；新测试即归因/反馈的行为见证。
