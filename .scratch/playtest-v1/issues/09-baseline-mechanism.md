# 09. 基线机制（身份 / 覆盖 / 三值比较 / 人工晋升）

Type: task
Status: open
Map: ../map.md
Blocked by: 05, 07, 08

## Question

把票 05 的基线裁定落成可执行机制：自足基线 JSON、三值比较器、显式人工晋升与审计、不稳定覆盖字段降级。
**比较结果纯观察**，不改 outcome、断言三值、delivery 状态与 verdict。

## 范围

1. **基线文件**：`fixtures/playtest-baselines/<baselineId>/baseline.json`（只新增，不碰既有 fixture）：
   `baselineFormatVersion` + `identity`（场景/ site / pack / config / harness 与判定规则版本）+ `coverage`
   （唯一比较范围）+ `expected`（晋升时接受的规范化值）+ `source`（runId / reportChecksum / promotedBy /
   promotedAt / reason）。
2. **比较器**：三值 `match / changed / not-comparable`；`changed` 附结构化 diff；`not-comparable` 说明原因且
   不得被读成 match；只比较 `coverage` 字段；抖动字段一律不比较。
3. **晋升命令**：显式人工操作；要求连续两次干净运行投影一致（同身份/同场景/同判定规则、无影响比较的
   `UNKNOWN`、证据断档或未归因运行错误）+ 覆盖理由 + 审计；普通运行 / CI 不得自动新建或覆盖。
4. **不稳定处理**：干净运行中发现覆盖字段不稳定 ⇒ 告警 + 降级为观察 / 标记需重新审核 + 留审计记录；
   不得自动放宽阈值、伪造证据或覆盖旧基线。
5. **报告**：试玩报告带 `baseline` 比较段；CLI 用「与基线不同」等观察性措辞，不称「回归失败」。

## 验收（完成条件）

- 身份不匹配 ⇒ `not-comparable`（不是 `changed` / `match`）；覆盖外字段不参与比较；
- 允许基线记录非 `SUCCESS` 的已接受行为（如 `failure-missing-pickup` 的 `GAMEPLAY_FAILURE`）；
- 自动运行无法写基线；晋升留痕可审计；
- 比较结果不改变票 04 的归因与交付状态；全仓测试绿 + typecheck 绿。
