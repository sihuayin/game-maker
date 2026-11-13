# I03-07 实施单元、复核点、白名单与回滚

Type: grilling
Status: open
Owner: —
Blocked by: 05, 06, 07
Map: ../map.md
Class: I-03 / DECISION

## Question

为未来 I-03 实施 effort 定义单元拆分、依赖、复核点、白名单、停止 / 回滚与 Authorization Ledger。**本图不执行实施。**

### 必须裁定

- 最小面：`contracts`、`assets/ops.ts`、`pipeline/publish-gate`；`mechanic.ts` / `api.ts` 逐文件条件授权；
- CLI / MCP / Runtime / 持久化证据链 DEFERRED；
- 单元边界、依赖、复核点、增量授权；
- 白名单逐文件列出允许修改的内容；
- STOP + HITL 规则（白名单外 / 新依赖 / 公共 Contract 变化 / 拒稿行为变化）；
- 回滚与关闭条件；
- 不把本图变成实施授权。

### 禁止

- 预先授权任何实施单元；
- 扩大最小面 / 白名单；
- 把实施 PR、推送、合并纳入本图。

### 验收

单元 / 依赖 / 复核点表、逐文件白名单、STOP / 回滚规则、台账空白表。
