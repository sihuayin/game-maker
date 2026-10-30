# 默认 Playtest 场景与废土常量解耦

Type: grilling
Status: resolved
Blocked by: （无）

## Question

HITL：默认五态场景 `success-basic.json` 写死 `target.siteVersion=1`、`initialActivePickups==4`、`collected==6`，是 wasteland Demo 的常量；新 Demo 计数不同会假失败（`packages/demo/probe/playtest/scenarios/five-state/success-basic.json:8-59`）。请裁定解耦方式：

- (a) **运行时从 config 派生**默认场景：`siteVersion` 来自 `site.json`，`initialActivePickups` 来自 pickup 实体数，`collected` 按明确的 pickup+chest 规则派生；保留 `game-maker playtest` 无参可用。
- (b) **非默认 Demo 必须显式 `--scenario-dir`**：默认五态目录只服务冻结 wasteland Demo；其他 Demo 在准备阶段快速失败，错误信息列出从 config 读到的身份与需要提供的场景，不猜玩法。
- (c) 新增 `scenario generate` 命令，从 config 生成场景模板；默认 playtest 要求显式或已生成的场景。
- (d) 保持现状，只在文档里说明常量。

已知事实：CLI 只选 `harnessCondition:none` + `required:true` + siteVersion 匹配的场景；`--scenario-dir` 已存在；P0-02 旧图原本就计划为 A 起草自定义场景；阶段 B 的新 Demo 也需要自定义场景。

建议（待裁定）：**(b)**。理由：用最小的行为变更消除隐式依赖，不替用户猜「collected 应该等于什么」的玩法语义；默认 wasteland 行为保持兼容，新 Demo 的失败是明确、可诊断的，而不是假绿/假红。若后续需要无参新 Demo，再单开生成器需求。

产物：票内 Answer + 追加裁定；未裁定前不写生产代码。

## Answer

**2026-10-29 HITL 收口。** 逐字裁定见 [rulings-2026-10-29.md 第 8 节](../rulings-2026-10-29.md)。

### 已定契约

| 项 | 决定 |
|---|---|
| 解耦策略 | 非默认 Demo **必须显式** `--scenario-dir`；默认五态目录只服务冻结 wasteland Demo，其他 Demo 在准备阶段 exit 4 快速失败 |
| 默认 Demo 身份 | CLI 显式常量：`packId === "wasteland-scavenger-recipe" && packVersion === 1`，与 `SCENARIO_DIR` 放在一起；叠加现有 `siteVersion` 校验 |
| 触发条件 | **未传** `--scenario-dir` 且目标 pack 身份不匹配 → exit 4 |
| 诊断 | 列出实际 `packId` / `packVersion` / `siteVersion` / pickup 数 / chest 数 / config 路径；说明默认五态场景只服务 `wasteland-scavenger-recipe v1`，其他 Demo 需用 `--scenario-dir` 提供至少含 `siteVersion` 与 `initialActivePickups` 断言的必需场景 |
| 拒绝记录 | 沿用 `playtest/rejections/*.json`；按票 05，旧 pass 已先被撤销为 `blocked` |
| 绕过 | 显式传 `--scenario-dir` 即绕过默认 Demo 身份检查（即使指向默认目录） |
| 契约 | 不改场景 schema、不改默认场景内容、不新增 CLI 命令 |

### 实现义务（已回写下游票）

- [默认场景实施](../issues/12-default-scenario-implementation.md)：常量、提前失败、诊断、测试与独立副本 E3。
