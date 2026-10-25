# 02. compileRuntime 提示词：要求逐实体声明 sourceIntent

Type: task
Status: resolved
Owner: claude (2026-10-25 · resolved)
Blocked by: 01
Map: ../map.md

## Question

让 `compileRuntime` 的提示词（`packages/assets/src/ops.ts:1046-1117` 的模板，铁律那段）要求模型
**逐实体声明 `sourceIntent`**（Q2=(c) 的前半：提示词引导）。

- 设计实体 id 清单**已经**在提示词里：`designBrief(d)`（`packages/assets/src/prompt.ts:850`）逐条列出
  四桶每个实体的 `id`。提示词要**点名**：config 实体若实例化某设计实体，`sourceIntent` 就填那个 id。
- 明确三条：
  1. resource 1:N 时，**多个** config 实体填**同一个** `sourceIntent`（不是给每个编新 id）。
  2. `block` / `gate` 这类**结构/派生实体**（地面 solid、终点 goal，没有设计对位）**不填** `sourceIntent`。
  3. `sourceIntent` **只许**指向设计里真实存在的实体 id，不许现编。
- **不改 `id` 生成规则**：`id` 仍是运行时唯一身份（Q1 已裁），本票只管 `sourceIntent` 的声明。

执行：改 `prompt.ts` 的 compileRuntime 提示词模板 + 相应夹具/快照测试（若有 prompt 快照测试则同步）。

## Answer

已落码（2026-10-25），三处：

- **`packages/contracts/src/config-tool.ts` `EntityShape`** 加 `sourceIntent: z.string().min(1).optional()`。
  ⚠️ **关键发现**：这是 `compileRuntime` 模型**对着发工具调用**的 v4 镜像（`ConfigToolSchema` 是
  `.strictObject`）。票 01 只改了 v3 权威契约 `game-config.ts`，镜像没跟 ⇒ 模型**发不出** `sourceIntent`
  （多发一个键会被 `parseToolUse` 拒）。本票补齐，并加漂移测试锁死 v3/v4 同步。
- **`packages/assets/src/ops.ts` 提示词加铁律 8**（原 8/9/10 顺延为 9/10/11）：`sourceIntent` = 实体是
  哪个设计实体的实例 —— 填设计里真实存在的 id（`designBrief` 已逐条列出），1:N 多条同 sourceIntent、
  孤儿（地面 solid / 终点 gate）不填、玩家是顶层字段不在实体里。
- **`packages/assets/src/ops.ts` `gameConfigExample`** 骨架示例：`pickup-1` 与 `mover` 加
  `sourceIntent: "<设计实体 id>"` 占位，`block-1` / `gate`（孤儿）不带 —— 给模型看两种形状。

**测试**：`config-tool.test.ts` +1 —— 带/不带 `sourceIntent`，v3 契约与 v4 镜像**都同意**（锁同步）。

**验证**：受影响 4 文件 119/119 · 全仓 **1930/1930** · `pnpm typecheck` 10 包绿。`designBrief` 未改
（它已把设计实体 id 逐条列出，正是铁律 8 指向的「真实存在的 id」清单）。
