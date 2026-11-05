# LP-00 Runtime 语义核验（P1–P4 源码证据）

Type: research
Status: open
Owner: —
Blocked by: —
Map: ../map.md

## Question

在代码基线上，从 `packages/demo` 源码核实 PRD §4.1 的 P1–P4 四项 Runtime 语义，形成 LP 后续算法可用的语义边界与证据档案。本票 AFK，由 research subagent 执行；只读，不改生产代码。

| 编号 | 核验内容 | 必须回答的问题 |
|---|---|---|
| P1 | 资源尺寸、锚点与碰撞几何 | manifest 标称 `size` 与资源 `anchor` 如何决定实体的实际空间占用？逐帧 atlas 与标称尺寸的误差边界是什么（本轮不解决，只记录）？ |
| P2 | EntityKind 与 body | solid / chest / danger 的 `body` 是否实际生效？pickup / hazard / goal 是否忽略 `body`？判断分支在哪个文件、哪一行？ |
| P3 | Chest 交互范围 | 实际交互检测代码是什么？交互盒是否等于 `body ?? size` 外扩 `range`？ |
| P4 | 出生点与静态几何 | 出生点与地形重叠时，Runtime 的实际初始化与碰撞处理顺序、分离语义是什么？ |

### 必须交付

1. **`../research/01-runtime-semantics.md`**：每项语义的 `file:line`、公式或条件、涉及实体类型、正反例 fixture / 测试、语义变化时受影响的判据。
2. **适用性矩阵**：P1–P4 各自标 `CONFIRMED` / `CONTRADICTED` / `INSUFFICIENT_EVIDENCE`；后者必须写明缺什么证据、影响哪些判据。
3. **判据边界**：LP-01～LP-04 哪些算法可以基于哪项语义；哪项语义缺失时必须降级为 `INSUFFICIENT_EVIDENCE`。
4. 本票 `## Answer` 摘要（结论 + 缺口 + 对后续票的影响）。

### 证据

- E1：`file:line`；E2：既有测试名 + 断言或新增只读检查；E3：零付费复跑（命令、退出码、路径）。
- 不得用推测补齐缺失语义；无法确认即 `INSUFFICIENT_EVIDENCE`。

### 边界

- 只读；不修改 `packages/**`、测试、fixture、历史语料。
- 不裁定判据是否上线或是否硬拒；那是 02 复核票的事。
- 零付费；不调用模型、不生图、不重建站点。

### 通过标准

- P1–P4 每项有源码证据，或明确标记为 `INSUFFICIENT_EVIDENCE` 并写明影响。
- 证据可复现：命令 / 测试名 / 退出码或精确 `file:line`。
