# I01-04 双档 lag 编排与 stub 降级

Type: grilling
Status: resolved
Owner: amber
Blocked by: 02
Map: ../map.md
Class: I-01 / DECISION

## Question

裁定 `lagMs` 双档编排的精确形态，以及 I-01 的显式 stub 如何在不改变既有 Verdict 的前提下被真实消费。

### 必须裁定

1. **常量落点**：`16.67ms` 与 `200ms` 的唯一具名常量放在哪一层（assets / pipeline / contracts），名字是什么。`200ms` 必须与 `mechanic.ts:62` 的 `FRAME_MARGIN_MS` 无复用关系。
2. **入口签名**：新时序入口的完整签名（含 `lagMs` 必填、`TrustedAtlasInput`、manifest、config）。不得有默认值、模块级状态或第二个入口。
3. **编排位置**：谁调用两次（pipeline 层还是 assets 层）；三处生产调用方如何共享同一份编排，避免各写一遍。
4. **比较单元**：比较两次返回的什么？
   - 整关 verdict；
   - 时序层结果；
   - 完整证据结构。
   两档不一致 ⇒ `INSUFFICIENT_EVIDENCE` 的精确规则；一致但都为 IE 时如何表达。
5. **stub 契约**：
   - 对任何移动 Hazard 只返回 `INSUFFICIENT_EVIDENCE`；
   - 不得返回 `NO_PROVEN_BLOCKER` 或 `PROVEN_UNPLAYABLE`；
   - 必须可被 I-02 替换而不改入口签名；
   - 如何防止 stub 被误读成「算法已实现」。
6. **替身注入**：测试如何制造「两档不一致」；注入点不能成为生产第二入口。可参考 `create-game.ts:139-145` 的 `inspect?` / `verify?` 测试注入先例。
7. **回归不变性**：证明 I-01 接线后，既有静态关卡与移动 Hazard 关卡的顶层 Verdict 不变（移动 Hazard 今天已是 IE）。

### 产出

`../evidence/04-lag-orchestration.md`。**不修改任何生产文件。**

### 停止条件

- 两档比较需要一个公共诊断字段才能被观察；
- stub 需要改变 `coverage` 或顶层聚合；
- 需要模块级默认值或第二入口。

## Answer

决策记录：[`evidence/04-lag-orchestration.md`](../evidence/04-lag-orchestration.md)。

- **Q1–Q8 全部 A**，并按修正把「生产 stub」与「测试替身」分开。
- **结果类型**：`{ applicable: false } | { applicable: true, verdict, degradation?: "lag-invalid" | "lag-disagreement" }`。
- **适用性**：只要存在带 `motion` 的 `hazard` 就为 `true`；Y 轴与多移动 Hazard 保守 IE，不判为不适用。
- **两档比较**：只比 `verdict`；不同 ⇒ IE + `lag-disagreement`。
- **非法 lag**：`undefined` / 非 number / `NaN` / `±Infinity` / 负数 ⇒ IE + `lag-invalid`；`0` 合法。顺序为先校验 lag，再判适用性。
- **常量**：`TEMPORAL_LAG_MS = 16.67`、`TEMPORAL_LAG_BASELINE_MS = 200`，唯一住在 contracts `temporal.ts`；不复用 `FRAME_MARGIN_MS`。
- **编排器**：`assets/ops.ts` 的 `runTemporalAudit`，读一次可信输入、调两次入口、`resolveTwoLagResults` 后返回。
- **stub 边界**：生产显式使用 `stubTemporalAnalyzer`（`@internal` 导出）；其它 analyzer 只允许出现在 contracts 测试；架构测试限制生产调用者与生产 stub。
- **消费局限**：三处调用方接线后丢弃结果，消费留到 I-03；若 I01-05 发现必须新增公共字段 ⇒ 停止重裁。
- 不改变静态 Verdict、发布门禁、`coverage.temporal`、持久化或 CLI/MCP。
