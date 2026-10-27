# 09. 基线机制（身份 / 覆盖 / 三值比较 / 人工晋升）

Type: task
Status: open
Map: ../map.md
Blocked by: 05, 06, 07, 08

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

## 追加范围（票 06 收口 · 2026-10-27）

在基线机制之外，本票落真实产物验收与旧报告兼容：

1. **零付费真实产物验收**：`.scratch/playtest-v1/acceptance.mjs`，前置 `pnpm build`；复用 `.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4`，在 `.scratch/playtest-v1/runs/<日期>-acceptance/` 建立可写沙箱；历史产物只读（前后哈希比对 `historicalMutated: false`）。
2. **验收三块**：① 真实产物链路（本地 Chrome、正式 attempt、写回沙箱 `qa-report.json`）；② 归因/交付一致性（check status、`delivery.playtest`、verdict、证据引用、身份）；③ 离线五态 + 准备拒绝测试（记录命令/退出码）+ 旧报告兼容（`.scratch/fpvs-v1-p1/runs/2026-10-27-stage-c/qa-report.json` 可解析、无 `delivery.playtest`、未升级）。
3. **`acceptance.json`（`playtest-acceptance/v1`）**：`verdict`（pass/incomplete/fail）、`source`（historicalRun/sandbox/historicalMutated）、`environment`（chrome found|missing）、`checks.realPlaytest`（command/exitCode/attempt/reportVersion/execution/aggregate/checkStatus/detail/requiredScenariosComplete/evidenceRefsResolve/deliveryVerdict/**gameExecutionReached**/**sceneReadyObserved**/**executionEvidence**）、`checks.attributionDelivery`、`checks.offlineFiveStates`、`checks.legacyReport`、`incompleteReasons`、`artifacts`。
4. **判定**：`pass` 须 Chrome 可用 + **真实游戏执行已被证实**（不只是 `execution=executed`）+ 一致性全过 + 离线五态/准备拒绝测试通过 + 旧报告兼容 + 历史产物未改；`incomplete` = Chrome 缺失或未能证明真实游戏执行，且其余检查无链路缺陷；`fail` = schema/映射/证据/身份/verdict 不一致、报告损坏、历史产物被改，或**离线验收断言失败**（离线失败不得降格为 incomplete）。退出码 `0` pass / `1` fail|incomplete / `4` 输入或历史产物不可用。
5. **基线观察**：只验证 `changed` 不改变 status/verdict；晋升与两次干净运行仍按票 05 及本票既有范围。
6. 真实运行五态任一都可接受，不要求 `SUCCESS`；Chrome 缺失时终端必须明说「真实游戏执行未验收」，且 `incomplete` 不得返回 `0`。
