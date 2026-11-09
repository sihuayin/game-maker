# I00-08 文件影响分析与白名单提案

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I00-08](../issues/11-i00-08-file-whitelist.md) |
| 依据 | [`r1-contract.md`](r1-contract.md)（已签署） |
| 性质 | **提案，不是授权**；授权在 [I00-R2](../issues/13-i00-r2-whitelist-authorization.md) |
| 修改产品目录 | **否** |

## 0. 结论摘要

- 最小改动面：**contracts 4 个文件 + 2 个新文件，pipeline 2 个，assets 1 个**。
- **CLI / MCP 不需要新增任何参数**：默认 `lagMs` 与 `packDir` 都能在 pipeline 层取得。
- **会改变既有发布结果**：含移动 hazard 的关卡从「不产出 issue」变为可能被拒（这是本功能的目的，但必须在 R2 与 I-04 显式验收）。
- 公共面改动 4 项，全部需要 R2 授权。

## 1. 改动点清单

| # | 文件 | 改动性质 | 为什么必须在生产侧 | 不做的后果 |
| --- | --- | --- | --- | --- |
| 1 | `packages/contracts/src/playability/temporal.ts`（**新**） | 时序判定核心：连续求交、witness、永久门、图割、预算 | 判据必须住 contracts（`config-audit.ts` 头注释的架构要求） | 无能力 |
| 2 | `packages/contracts/src/playability/temporal-input.ts`（**新**） | Atlas 字节读取 + SHA-256 + 逐帧几何提取 | I00-02：信任链只能在审计侧闭合 | G-01 无法满足 ⇒ IE |
| 3 | `packages/contracts/src/playability/mechanic.ts` | 消解 `moving-hazard-phase` gap；时序结果并入机制层 | gap 当前在 `:114-120` 无条件产生 | 移动 hazard 永远 IE |
| 4 | `packages/contracts/src/playability/verdict.ts` | `coverage.temporal` + 证据可选字段（加法） | 三态词汇与证据结构住这里 | 无法表达时序可信度 |
| 5 | `packages/contracts/src/playability/api.ts` | `auditPlayability` 增 options；顶层优先级规则 | 顶层折叠在 `:87-92`，时序 IE 必须不被吞掉 | 时序 IE 被聚合成 NB |
| 6 | `packages/contracts/src/playability/index.ts` | 导出新模块 | 内部 barrel | 无法被引用 |
| 7 | `packages/contracts/src/config-audit.ts` | `ConfigAuditContext` 增 `packDir` / `lagMs`，透传给 `auditPlayability` | 唯一确定性审计入口（`:39-56`） | 生产链路拿不到输入 |
| 8 | `packages/pipeline/src/create-game.ts:631` | 传入 `packDir` / `lagMs` | 汇合点必须与 `ops.ts` 同一份实现 | 两路径拦截不一致 |
| 9 | `packages/pipeline/src/publish-gate.ts:140` | 把 packDir 穿进 `configProblem` | 发布闸门必须能读同一份 Atlas | 发布侧永远 IE |
| 10 | `packages/assets/src/ops.ts:1247,1284` | 传入 `packDir` / `lagMs` | `compileRuntime` 的两处调用 | 编译期不判 |

### 不需要改动

- `packages/demo/**`（Runtime 只读）。
- `packages/cli/**`、`packages/mcp/**`：无新增 flag。`lagMs` 由 pipeline 层单一具名常量提供；`packDir` 在四个发布入口本已存在。
- `packages/contracts/src/game-config.ts`：不新增 config 字段。
- `packages/contracts/src/assetpack.ts`：不升 manifest 版本。
- `pnpm-lock.yaml`：无新依赖。

## 2. 公共面判定

| 项 | 改动 | 授权 |
| --- | --- | --- |
| `auditPlayability` 签名 | 增第三个 `options` 参数（`lagMs` + Atlas 来源） | **需 R2** |
| `ConfigAuditContext` | 增可选 `packDir` / `lagMs` | **需 R2** |
| `PlayabilityVerdict.coverage` | 增 `temporal` 维度 | **需 R2** |
| `PlayabilityEvidence` | 增可选 `model` / `lag` / `degradation` / `limits` | **需 R2** |
| CLI / MCP | **无变化** | 不需要 |
| `ConfigIssue.code` | **无变化**（仍只有 3 个值） | 不需要 |
| 持久化 schema | **无变化** | 不需要 |
| 第三方依赖 | **无新增** | 不需要 |

`packages/contracts/src/index.ts:150` 已 `export * from "./playability/api.js"` ⇒ 上述类型是公开面。

## 3. 回归影响面

### 3.1 必须保持不变的

| 对象 | 判据 |
| --- | --- |
| `playability-spatial.test.ts`（23 用例） | 全文不改；`coverage.spatial` 行为不变 |
| `playability-mechanic.test.ts`（6 用例） | 只允许**新增**用例；`巡逻 hazard ⇒ moving-hazard-phase gap` 这条在时序判定落 IE 时仍须成立 |
| `playability-completion.test.ts`（10 用例） | 全文不改 |
| `playability-api.test.ts` | 只允许新增；`无阻断：coverage.spatial 仍诚实记 partial` 必须继续通过 |
| `config-audit.test.ts` / `publish-gate.test.ts` | 既有断言不改 |
| LP-06 语料（96 对）与 LP-06 矩阵（39 例） | 复跑结果与基线一致（非移动关卡） |

### 3.2 会改变的行为（必须显式验收）

- **含移动 hazard 的关卡**：今天 `moving-hazard-phase` gap ⇒ 机制层 IE ⇒ `playabilityIssues` 不产 issue。
- 集成后，若时序判定得到 `PROVEN_UNPLAYABLE`，`playabilityIssues` 会产出 error ⇒ **`build` / `site` / `publish-gate` 会拒**。
- 这是功能目的，但属于**发布结果变化**：R2 必须批准；I-04 必须证明 19 个既有移动 hazard 关卡**没有**被误拒（无假阳）。

### 3.3 证据强度缺口

- LP-06 / LP-07 只有 scratch 脚本，无 vitest；「V1 完整回归」= 既有 vitest + LP-06/07 复跑，**不等于**全量自动化回归。冻结文档必须写明。

## 4. 白名单草案

### 允许（拟）

```
packages/contracts/src/playability/temporal.ts          （新）
packages/contracts/src/playability/temporal-input.ts    （新）
packages/contracts/src/playability/mechanic.ts
packages/contracts/src/playability/verdict.ts
packages/contracts/src/playability/api.ts
packages/contracts/src/playability/index.ts
packages/contracts/src/config-audit.ts
packages/contracts/tests/playability-*.test.ts          （只增不改）
packages/contracts/tests/fixtures/playability-*.json    （只增不改）
packages/pipeline/src/create-game.ts
packages/pipeline/src/publish-gate.ts
packages/pipeline/tests/publish-gate.test.ts            （只增不改）
packages/assets/src/ops.ts
```

### 明确禁止

```
packages/demo/**                   Runtime 只读
packages/cli/**  packages/mcp/**   不新增参数
packages/contracts/src/game-config.ts
packages/contracts/src/assetpack.ts
packages/contracts/src/playability/{geometry,graph,reach,spatial,completion,targets}.ts
任意既有测试的断言删除 / 放宽
pnpm-lock.yaml / 任何新依赖
fixtures/packs/**                  （除非 R2 单独批准新 fixture）
```

### 需单独裁定

- `packages/contracts/src/playability/profile.ts`：`coverage.temporal` 的默认值若落在这里。
- `packages/contracts/src/playability/graph.ts`：hop 采样加倍不变性若需要参数化采样密度。
- `fixtures/packs/**`：I-05 若需要新的真实关卡夹具。
- **发布行为变化本身**（§3.2）。

## 5. 不做的替代

| 若不做 | 后果 |
| --- | --- |
| 不读 Atlas（G-01 走声明） | 违反 G-01；`profile.ts` 的 `partial` 无法升级 |
| 不加 `coverage.temporal` | 时序 IE 会被顶层的 spatial partial 淹没 |
| 不改 `mechanic.ts` gap | 移动 hazard 永远 IE，功能为零 |
| 不接 pipeline / publish-gate | 只在测试里存在，生产不可见 |
| 不补顶层优先级测试 | §5 的规则无证据 |
