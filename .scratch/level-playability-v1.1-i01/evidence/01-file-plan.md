# I01-01 精确文件清单与依赖方向

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I01-01](../issues/01-i01-01-file-plan.md) |
| 依据 | [`map.md`](../map.md) 开图裁定 Q1–Q12；[`移动-I01-需求.md`](../../../docs/v7.8/移动-I01-需求.md) `sha256:05c6c72a…`；[`移动-I00.md`](../../../docs/v7.8/移动-I00.md) §11 |
| 性质 | **计划，不是授权**；授权在 [I01-R1](../issues/08-i01-r1-authorization.md) |
| 修改产品目录 | **否** |

## 0. 结论摘要

- 最小改动面：**contracts 2 个新文件 + 1 个既有文件；assets 1 个；pipeline 2 个；新测试 1 个**。
- **不需要改** `config-audit.ts`、`mechanic.ts`、`verdict.ts`、`playability/index.ts`、`contracts/src/index.ts`。这比 I-00 的 I-01 计划窄。
- **公共面**：新增导出经 `api.ts`（唯一公开路径，`index.ts:150` 已导出 `api.js`）；它**替代** R2 第 1 项「`auditPlayability` 增 options」，不是第 5 项加法。`coverage.temporal` 与 `PlayabilityEvidence` 字段（R2 第 3、4 项）在 I-01 **不使用**。
- **依赖方向**：`pipeline → assets → contracts`，无环；`contracts` 源码不出现 `node:fs` / `node:crypto`。
- **越界清单**：空。

> ⚠️ 本文件只固定**文件与模块落点**，不固定最终签名。签名由 [I01-02](../issues/02-i01-02-trusted-input-contract.md) / [I01-04](../issues/04-i01-04-lag-orchestration.md) 裁定；若裁定需要新增文件或公共面第 5 项，本计划作废并回到 [I01-07](../issues/07-i01-07-whitelist-audit.md) 审计。

## 1. 文件清单

| # | 文件 | 类型 | 改动 | 为什么必须在这里 | 不做的后果 | 白名单 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `packages/contracts/src/playability/temporal-input.ts` | **新** | 纯验证：`verifyTemporalInput({ bytes, manifest, digest })`、`TrustedAtlasInput` 运行时 brand、失败分类 | 判据必须住 contracts（`config-audit.ts` 头注释的架构要求）；不读文件才能保持浏览器兼容 | G-01 无可信输入；无法证明几何来源 | §11 新文件 |
| 2 | `packages/contracts/src/playability/temporal.ts` | **新** | 时序入口 `auditPlayabilityTemporal`、I-01 显式 stub、两档比较 `resolveTwoLagResults`、`16.67` / `200` 具名常量 | 唯一时序入口 + 纯比较逻辑；I-02 在同一文件替换 stub | 两档编排与降级不可测；`lagMs` 无入口 | §11 新文件 |
| 3 | `packages/contracts/src/playability/api.ts` | 既有 | **只加导出**：转出 #1/#2 的公开符号；不改任何既有签名 | `contracts/src/index.ts` **不在白名单**；`index.ts:150` 只导出 `api.js` ⇒ `api.js` 是唯一合法公开路径 | assets / pipeline 无法 import 新入口 | §11 允许 |
| 4 | `packages/assets/src/ops.ts` | 既有 | 新增唯一受控读取器 `readTrustedAtlasInput`（`node:fs` + `node:crypto`）与编排器 `runTemporalAudit`；`compileRuntime` 两处调用点接入 | 唯一能合法读盘并算真实 SHA-256 的层；`compileRuntime` 已有 `packDir`（`:984-1004`） | Q6=B 无处落地；生产路径拿不到可信输入 | §11 允许 |
| 5 | `packages/pipeline/src/create-game.ts` | 既有 | 汇合点（`:631`）调用 `runTemporalAudit`；`packDir` 已在 `:561` | 汇合点是 `reuseConfig` 与编译两条路径的唯一共同入口 | 两条路径拦截不一致 | §11 允许 |
| 6 | `packages/pipeline/src/publish-gate.ts` | 既有 | 把 `packDir` 穿进 `configProblem`（`:134-140`），调用 `runTemporalAudit` | 发布闸门的 `PublishGateOptions.packDir` 已在（`:43-46`），但 `configProblem` 现在只收 `configPath` + manifest | 发布侧拿不到可信输入 | §11 允许 |
| 7 | `packages/contracts/tests/playability-temporal-input.test.ts` | **新** | 需求 §2.3 的用例 + contracts 纯依赖架构测试 | 需求指定的测试落点；白名单允许新测试文件 | 无可执行证据 | §11 允许（只增） |
| 8 | `packages/pipeline/tests/publish-gate.test.ts` | 既有 | **仅在** I01-05 证明需要时新增用例（不改既有断言） | 发布闸门接线的最小回归位 | 若 #6 改动无测试覆盖，I01-06 会要求补 | §11 允许（只增） |

### 明确不改

| 文件 | 理由 |
| --- | --- |
| `packages/contracts/src/config-audit.ts` | 三处调用方直接调用 `runTemporalAudit`，不把时序结果塞进 `ConfigAuditContext`；Q8=B 下不改顶层聚合 |
| `packages/contracts/src/playability/mechanic.ts` | I-01 不消解 `moving-hazard-phase` gap；那是 I-03 |
| `packages/contracts/src/playability/verdict.ts` | `coverage.temporal` 留给 I-03 |
| `packages/contracts/src/playability/index.ts` | 内部桶不在包公开面；测试按既有惯例直接 import `playability/*.js` |
| `packages/contracts/src/index.ts` | **不在白名单**；新公开符号经 `api.ts` 转出，无需动它 |
| `packages/demo/**`、`cli/**`、`mcp/**`、`game-config.ts`、`assetpack.ts` | I-00 §11 明确禁止或无需改动 |

## 2. 依赖方向

```
pipeline (create-game / publish-gate)
    │  import { runTemporalAudit, readTrustedAtlasInput } from "@game-maker/assets"
    ▼
assets (ops.ts)
    │  node:fs / node:crypto         ┐
    │  import { verifyTemporalInput, auditPlayabilityTemporal } from "@game-maker/contracts"
    ▼                                │
contracts (temporal-input.ts / temporal.ts)
    │  纯函数；禁止 node:fs / node:crypto
    ▼
（无下游）
```

- `assets → contracts`：唯一方向；`pipeline → assets` 已存在（`packages/pipeline/package.json`）。
- **禁止** `contracts → assets`：会成环，且把 Node 内置模块拖进浏览器 bundle。
- **架构测试**（落在 #7）：扫描 `packages/contracts/src/**/*.ts`，断言不出现 `from "node:fs"`、`from "node:crypto"`、`from "fs"`、`from "crypto"`。
- 唯一真实 SHA-256 只出现在 `assets/src/ops.ts`；`digest` 注入仅用于纯函数测试，I01-04 必须给出「注入不得进入生产调用路径」的检查方式。

## 3. 模块落点

### 3.1 `temporal-input.ts`（contracts，纯）

- `TrustedAtlasInput`：branded 值，携带被验证的 atlas / 帧几何、验证结论与失败分类。
- **唯一生产者是 `verifyTemporalInput` 本身**：不额外导出铸造工厂，避免把 brand 变成公开可铸。
- 运行时 brand 用模块私有 `Symbol`；`isTrustedAtlasInput` 只做运行时校验。
- `digest: (bytes: Uint8Array) => string` 注入；函数只接收一次 `bytes`，解析与哈希消费同一个对象（TOCTOU 关闭）。
- 失败分类至少覆盖：文件缺失、SHA 不符、JSON 无效、帧缺失、`sourceSize` 不符、`anchor` 缺失或不符。

### 3.2 `temporal.ts`（contracts，纯）

- `auditPlayabilityTemporal(config, manifest, { lagMs, trustedInput, analyze })`：每次只接受一个 `lagMs`，无默认值、无模块状态。
- I-01 `analyze` 是显式 stub：对任何移动 Hazard 只返回 `INSUFFICIENT_EVIDENCE`，永不返回 `NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE`。
- `resolveTwoLagResults(a, b)`：纯比较；不一致 ⇒ `INSUFFICIENT_EVIDENCE`。
- 具名常量 `TEMPORAL_LAG_MS = 16.67`、`TEMPORAL_LAG_BASELINE_MS = 200`，集中一处；不得复用 `mechanic.ts:62` 的 `FRAME_MARGIN_MS`。最终落点由 I01-04 裁定（若必须在 pipeline，则改为从 pipeline 传入，但常量仍只有一处）。

### 3.3 `assets/ops.ts`（唯一读盘层）

- `readTrustedAtlasInput({ packDir, manifest })`：`fs.readFileSync` 一次 → `createHash("sha256")` → 调 `verifyTemporalInput` 同一份字节 → 返回 branded 结果。
- `runTemporalAudit({ config, manifest, packDir })`：读一次可信输入 → 以两个常量各调一次入口 → `resolveTwoLagResults` → 返回结果。
- `compileRuntime` 的两处调用点（`:1247`、`:1284`）使用同一个编排器；**每发 config 不重复读盘**的方案由 I01-05 定。

### 3.4 pipeline（接线层）

- `create-game.ts`：汇合点调用 `runTemporalAudit`；`packDir` 来自 `:561`。
- `publish-gate.ts`：`configProblem` 增加 `packDir` 参数并调用 `runTemporalAudit`；`PublishGateOptions.packDir` 已在。
- I-01 的时序结果**不进入** `ConfigIssue[]`、不改 Verdict、不落盘、不新增日志协议。Q10=A 的「消费者」是 `runTemporalAudit` 自身：接线真实、比较与降级分支真实执行；若 I01-05 发现必须新增公共字段才能观察，**停止并回 I01-R1 重新裁定**。

## 4. 公共面判定

| R2 已批准项 | I-01 是否使用 | 说明 |
| --- | --- | --- |
| 1. `auditPlayability` 增 options | **否** | 由新导出 `auditPlayabilityTemporal` **替代**；旧签名不动 |
| 2. `ConfigAuditContext` 增字段 | **否** | 调用方直接调编排器，不经过 `auditConfigPipeline` |
| 3. `PlayabilityVerdict.coverage` 增 `temporal` | **否** | 留给 I-03 |
| 4. `PlayabilityEvidence` 增可选字段 | **否** | 留给 I-03 |

- I-01 的公共面**加法**：经 `api.ts` 转出新符号（`auditPlayabilityTemporal`、`verifyTemporalInput`、`TrustedAtlasInput` 及相关结果类型）。它替代第 1 项，**不是第 5 项**。
- assets 包新增导出 `readTrustedAtlasInput` / `runTemporalAudit`：位于白名单内的 `ops.ts`，但属于包级公开面 ⇒ 必须列入 [I01-07](../issues/07-i01-07-whitelist-audit.md) 的审计表。
- **不新增**：`ConfigIssue.code`、持久化 schema、CLI / MCP 参数、第三方依赖。

## 5. 既有测试零改动证明

| 测试文件 | 现有调用点 | 为什么不需要改 |
| --- | --- | --- |
| `playability-api.test.ts:38` | `auditPlayability(caseOf(...), MANIFEST)` | 旧签名不变；新入口是独立导出 |
| `config-audit.test.ts:32` | `auditConfigPipeline(c, { manifest, viewport })` | `ConfigAuditContext` 不变 |
| `publish-gate.test.ts` | 走 `publishGate(...)` 公共入口 | 只加 `packDir` 穿透与内部调用；不新增既有断言 |
| `playability-{spatial,mechanic,completion}.test.ts` | 直接调各层 | 本计划不碰 `mechanic.ts` / `verdict.ts` / `spatial.ts` / `completion.ts` |

- 全部既有测试文件 **零改动**。
- 新增测试只写 `playability-temporal-input.test.ts`；若 I01-05 需要 `publish-gate.test.ts` 的新用例，遵守「只增不改」。

## 6. 越界清单

**空。** 所有计划文件都能映射到 I-00 §11 白名单条目。

条件性停止（任一成立即停，不得写进授权票）：

1. I01-02 / I01-04 需要 contracts 引入 `node:fs` / `node:crypto`。
2. 需要修改 `contracts/src/index.ts` 或任何白名单外文件。
3. 需要 `coverage.temporal`、`PlayabilityEvidence` 新字段，或第 5 项公共面加法。
4. 需要修改既有测试文件（含只补参数的调用点适配）。
5. 需要 `fixtures/packs/**` 或新依赖。

## 7. 与 I-00 计划的偏离落地

| I-00 计划 | 本计划 | 落点 |
| --- | --- | --- |
| 读取在 contracts `temporal-input.ts` | 读取在 `assets/ops.ts`；contracts 只验证 | #1 / #4 |
| `auditPlayability` 增 options | 新入口 `auditPlayabilityTemporal`；旧签名不变 | #2 / #3 |
| `ConfigAuditContext` 增 `packDir` / `lagMs` | 不改 `config-audit.ts`；调用方直接调编排器 | #4–#6 |
| `coverage.temporal` / evidence 字段 | 不使用，留给 I-03 | — |

## 8. 事实来源

- 公开路径：`packages/contracts/src/index.ts:150`（只导出 `playability/api.js`）；`playability/index.ts` 不在包公开面。
- `compileRuntime` options 含 `packDir`：`packages/assets/src/ops.ts:984-1004`；两处调用 `:1247, :1284`。
- `create-game` 的 `packDir`：`packages/pipeline/src/create-game.ts:561`；汇合点 `:631`。
- `publish-gate` 的 `packDir`：`packages/pipeline/src/publish-gate.ts:43-46`；`configProblem` `:134-140`。
- `assets` 包导出 `ops.js`：`packages/assets/src/index.ts`。
- `pipeline` 依赖 `assets`：`packages/pipeline/package.json`。
- `FRAME_MARGIN_MS`：`packages/contracts/src/playability/mechanic.ts:62`。
- 既有测试调用点：`packages/contracts/tests/playability-api.test.ts:38`、`config-audit.test.ts:32`。
