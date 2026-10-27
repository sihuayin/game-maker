# 07. Harness 核心与观测（可复现判定基础）

Type: task
Status: open
Map: ../map.md
Blocked by: 02, 03, 05, 06

## Question

把票 02/03/05 的裁定落成新 `playtest` harness 的第一层（用户 2026-10-27 分层第 1 层）：同一场景在同版本绑定 +
同判定规则下产出**判定确定**的规范化证据。本票**不**实现五态归因（票 08）与基线（票 09）。

## 范围

1. **场景契约加载**：声明式数据契约 + 薄解释器（票 02）；版本绑定（场景格式版本 + 目标 site 版本 + pack/config
   经 site 依赖验证），不匹配默认拒绝并记 `not-executed` + 拒绝记录。
2. **观测产物**：`events.jsonl`（11 类闭事件 + `source` 真实性 + `actor` 规则 + `params` schema）· `trace`（状态快照）·
   `input.jsonl`（实际输入：`type`/`key`/`code`/`t`/`seq`/动作来源）· `result.json`（摘要 + 逐场景结果 + 身份 + 证据引用）。
3. **确定性运行**：语义动作解释器按**观测步**推进；固定轮询间隔与场景时限；固定 Chrome flags / viewport / DSF /
   渲染路径；把影响决策的 `Date.now()` 改为步骤计数（stuck / jump cooldown）；实际配置写入报告。
4. **规范化投影**：按票 05 Q2 的「必须一致」字段产出可比较投影（断言三值、离散终态、显式可比较事件计数、
   不可判记录）；`PlaytestOutcome` 由票 08 归因填入。
5. **harness 自测分层**：`hazard-legacy` + `gate` / `pickup` / `input` 负例保留为 harness 自测，**不进**五态场景集。

## 验收（完成条件）

- 全仓测试绿 + typecheck 绿；
- 同一场景连续两次干净运行的规范化投影完全一致（票 05 Q2「两次干净运行」定义）；
- 真实产物零付费跑通，命令 + 退出码 + 路径可追溯，产物只写 `out/` 或本 effort 目录；
- 观测字段与票 03 Q5/Q6 逐条对齐：无会话内打点、外壳零改动（`SHELL_VERSION` 不升、站点字节不动）。

## 追加范围（票 06 收口 · 2026-10-27）

票 06 已裁定交付接入的 schema 与聚合规则。本票在原有 harness 核心之外，落以下**契约与规则**；
阶段化归因决策表、实锤门槛与代理限制证据仍归票 08（不重开原分工）：

1. **完整 `PlaytestReportSchema`**（`playtest-report/v1`）：`reportVersion` · 身份绑定（场景格式版本、实际 site/pack/config/shell、harness 版本、判定规则版本）· `execution`（`executed` | `not-executed` + reason）· 逐场景结果（`scenarioId` / `required` / `execution` / `outcome` / 逐断言三值 / 场景级 `insufficientEvidence` / 证据引用）· `aggregate` · 命令与退出码 · 起止时间。
2. **`delivery.playtest` 可选摘要 schema**（`z.strictObject`）：`report` / `reportVersion` / `execution` / `aggregate?` / `scenarios[]`（含场景级 evidence refs 与 UNKNOWN 的 `insufficientEvidence`）/ `evidence` / `baseline?`。摘要不是第二份报告；完整身份与逐断言细节只住 `result.json`。
3. **聚合规则**：`aggregate` 由**已执行场景**按票 04 优先级
   `GAMEPLAY_FAILURE > ENVIRONMENT_FAILURE > TIMEOUT > AGENT_LIMITATION > UNKNOWN > SUCCESS` 计算；
   `not-executed` 不参与排序但阻止 pass；存在 `GAMEPLAY_FAILURE` 时不得因必需场景未执行降为 blocked。
4. **状态映射契约**：`mapPlaytest(view | undefined) → { status, detail }`，纯函数，不读文件、不验路径；规则见票 06 Q7（fail / blocked / incomplete / pass 的边界；`aggregate=SUCCESS` 不等于 pass；必需场景未执行不得 pass）。
5. **superRefine 写前不变量**：check status 必须等于 `mapPlaytest`；pass 要求全部必需场景 executed+SUCCESS、无 UNKNOWN、证据 ref 可解析、`report` 与 `playtest-result` path 相等；fail 只能来自 GAMEPLAY_FAILURE；blocked 覆盖未执行/环境故障/必需场景未执行；incomplete 覆盖 TIMEOUT/AGENT_LIMITATION/UNKNOWN（必需场景已执行）；`baseline` 不参与 status/verdict。
6. **证据引用分层**：`scenarios[].evidence` 与 `delivery.playtest.evidence` 都是指向 `delivery.evidence` 的可解析 refs；UNKNOWN 的 `insufficientEvidence` 保持在场景级；旧报告 `delivery.playtest` 缺席合法，旧 smoke 结果不升级。

⚠️ 本票仍**不**实现五态归因的阶段化决策表、实锤门槛与代理限制证据（票 08）；本票只提供报告契约、聚合规则与交付摘要契约。
