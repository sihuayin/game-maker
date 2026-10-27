# 07. Harness 核心与观测（可复现判定基础）

Type: task
Status: open
Map: ../map.md
Blocked by: 02, 03, 05

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
