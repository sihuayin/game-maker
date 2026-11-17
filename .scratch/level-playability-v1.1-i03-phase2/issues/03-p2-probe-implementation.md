# P2 · Probe 实施 brief（含 P3 独立复核门）

Type: grilling
Status: resolved
Owner: claude (P2 session 2026-11-17)
Blocked by: 02
Map: ../map.md
Class: I-03-Phase2 / P2

## Question

为 P2 产出一份可交接的执行 brief：如何只消费 P1 冻结的契约 / 夹具 / hash 实现 geometry probe，产出与冻结契约一致的证据，并定义 P3（I03-03C）独立复核与用户签署门？

必须覆盖：probe 脚本与运行命令（真实浏览器 / 现有 demo；不新增 npm 依赖）；逐帧 / 逐 body 的 `expected / actual / delta / pass`；14 正例行 + 11 负例；`all-checked` 不是 `coverage.geometry=checked`；P3 fresh reviewer 的输入 hash、14+11 逐项 `PASS/FAIL/NOT_RUN`、独立重跑、限制与签署；`reports/P3-probe-review.md` 固定路径；P3 PASS 只允许 P6 消费，不开放能力；hash 不一致 ⇒ STOP；回滚。

约束：见 `reports/00-execution-protocol.md` §5 与 annex §5；P2 不得修改 P1 契约 / 夹具语义 / hash；产品 `packages/**` 零改动。

## Answer

**Q43–Q49 = 用户全部采纳（2026-11-17）。** 本 brief 冻结 P2/P3 边界；**不构成 P2 实施授权**。

### 1. 目标与前置

P2 只产出**只读、可复现的几何证据**，供 P3 独立复核；不修改产品代码，不设置公共 `coverage.geometry`。

P2 实施前置：P1 完成合并 / 独立复核 / 用户签署 / Ledger；用户另行签署 P2 增量授权。P1 未完成 ⇒ P2 保持 BLOCKED。

### 2. Harness 与采集

- 只读 import `packages/demo/probe/probe-harness.mjs`（CDP / Chrome / 静态 server / `PHASER_HOOK`）；不复制 harness 本体、不新增依赖、不改 `packages/demo`。
- DevTools console 只作自动采集不可用时的 fallback，不代替正式 P2 证据。
- CDP 注入**只读**表达式，读取 `window.__gmGame` → scene `shell`：
  - player body；
  - hazards sprites：`start / axis / distance / periodMs / 当前帧`；
  - solids 静态 body；
  - sprite world bounds 与 body world AABB **分开记录**。
- 每个字段注明来源（Runtime 对象 / 动画帧 / fixture manifest）。页面不可直接观察的字段记 `unobservable`；对应检查判为未通过或证据不足，**不得从 expected 反推 actual**。
- 禁止 monkey-patch 站点代码；负例单变量变异只在页面会话内注入，采集与变异逻辑分离。

### 3. 样本（25 个）

| 样本 | 执行方式 | 数量 |
| --- | --- | --- |
| 正例 | 真实 pack 采集 | 14 |
| `geometry-mismatch` | 页面会话内单变量变异 | 10 |
| `missing-evidence` | 页面会话内移除必要证据 | 1 |
| **合计** | | **25** |

负例以 P1 冻结的 F2 修正版为准：10 `geometry-mismatch`（含 `body-bounds-mismatch`）+ 1 `missing-evidence`。每个负例记录 fixture ID、预期 `failureCode`、实际 class / summary、变异前后差异、单变量证明；多因素变异不计有效负例。

### 4. 证据格式

- 一次运行一个 JSON：`version: "i03-geometry-probe/v1"`。
- 每行 `expected / actual / delta / pass`；含 `summary`、environment metadata。
- 语义 hash：规范化 JSON，排除 `generatedAt / durationMs / environment / runner / hashes`。
- `all-checked` 只是生成器局部结论，绝不自动设置公共 `coverage.geometry`。

### 5. 交付物

```
geometry-probe/
├── scripts/
│   ├── probe.mjs
│   └── run-probe.mjs
└── evidence/
    └── p2/
        ├── raw/
        ├── commands/
        └── hashes/
```

`reports/P2-*` 记录环境、命令、原始结果、语义 hash、失败与限制。

### 6. P3 独立复核门

- fresh reviewer 独立重跑：14 正例 + 11 负例；原始 JSON / 语义 hash；P1 contract / manifest hash；环境 / runner；负例单变量有效性。
- 报告固定：`.scratch/level-playability-v1.1-i03-phase2/reports/P3-probe-review.md`。
- **P3 PASS + 用户签署**后 P6 才可读取 probe 输出；P2 自测、作者自审、P3 PASS 但未签署均不满足。

### 7. 白名单 / STOP

仅允许：

- `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/scripts/`
- `.scratch/level-playability-v1.1-i03-phase2/geometry-probe/evidence/p2/`
- `.scratch/level-playability-v1.1-i03-phase2/reports/P2-*`

证据只通过 audit 分支追踪；不得在产品实现分支创建产品 commit。

STOP + HITL：harness 无法取得所需几何；需改 `packages/demo` 或其他产品代码；需新增依赖；P1 contract / manifest hash 不一致；无法证明单变量变异；需改变采集契约才能继续。

### 8. 授权顺序

本 brief 只是规划。执行顺序：

1. P1 完成并 Ledger；
2. 用户签署 P2 增量授权；
3. P2 实施 / 证据；
4. fresh P3 复核；
5. P3 PASS + 用户签署；
6. 才允许 P6 消费。

本会话未写 probe、未运行浏览器、未创建 audit 分支。

