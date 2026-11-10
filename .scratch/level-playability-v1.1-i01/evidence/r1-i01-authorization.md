# I-01 执行包冻结与授权（已签署）

| 项 | 值 |
| --- | --- |
| 票 | [I01-R1](../issues/08-i01-r1-authorization.md) |
| 状态 | **SIGNED — 用户签署（2026-11-10）** |
| 基线 | `main @ 29ea1d1` |
| 依据 | I01-01～I01-07 的决策与证据；[`移动-I00.md`](../../../docs/v7.8/移动-I00.md) §11 / G-01 / G-02；[I00-R2](../level-playability-v1.1-integration/issues/13-i00-r2-whitelist-authorization.md) 签署记录 |
| 性质 | 签署后**只授权 I-01 实施**；不授权 I-02 / I-03，也不构成 I-00 白名单的扩大 |

> ✅ 用户已于 2026-11-10 逐项签署。签署只授权 I-01 实施；不授权 I-02 / I-03。

## 1. 能力声明

I-01 **只交付**：

1. 可信 Atlas 输入：唯一生产读取器读取 atlas JSON 字节，按 `manifest.files[]` 校验 sha256，逐帧核对 `sourceSize` / `anchor` / `rotated` / `trimmed`，不可信 ⇒ `INSUFFICIENT_EVIDENCE`。
2. `lagMs` 双档编排：`16.67ms` 与 `200ms` 两次调用；两档 `verdict` 不一致 ⇒ `INSUFFICIENT_EVIDENCE`。
3. 显式生产 stub：对任何适用输入只返回 `INSUFFICIENT_EVIDENCE`，永不返回 `PROVEN_UNPLAYABLE` / `NO_PROVEN_BLOCKER`。
4. 三处生产调用方接线：`assets/ops.ts`、`pipeline/create-game.ts`、`pipeline/publish-gate.ts`；结果按 Q8=A 丢弃。
5. 测试与证据：`playability-temporal-input.test.ts` 的 65 条矩阵；既有测试零改动；LP-06/07 scratch 语料复跑。

I-01 **不包含**：

- 连续时间求交、witness、永久门、垂直规避图割、网格规则（I-02）。
- `coverage.temporal`、`PlayabilityEvidence` 公共字段、`mechanic.ts` gap 消解、顶层 Verdict 优先级（I-03）。
- 任何生产环境下的移动 Hazard 时序可达性判定能力。
- Runtime / CLI / MCP 参数、持久化 schema、`ConfigIssue.code`、新依赖。

## 2. 精确文件清单与依赖方向

### 2.1 实施文件（7 个）

```text
A  packages/contracts/src/playability/temporal-input.ts     纯验证 + brand + 失败码
A  packages/contracts/src/playability/temporal.ts            scope + 入口 + stub + 比较 + 常量
A  packages/contracts/tests/playability-temporal-input.test.ts   65 条矩阵
M  packages/contracts/src/playability/api.ts                 只加 @internal 导出
M  packages/assets/src/ops.ts                                私有读取器 + runTemporalAudit + :1284 接线
M  packages/pipeline/src/create-game.ts                      汇合点接线
M  packages/pipeline/src/publish-gate.ts                     configProblem 穿透 packDir + 接线
```

无 `D`；无既有测试改动；无 `package.json` / `pnpm-lock.yaml`；无 `fixtures/**`；无 `docs/v7.8/**`；无 `demo` / `cli` / `mcp`。

### 2.2 依赖方向

```text
pipeline → assets → contracts
```

- `contracts` 源码禁止 `node:fs` / `node:crypto`（架构测试守护）。
- `assets/ops.ts` 是唯一读盘层与唯一真实 SHA-256 提供者。
- `runTemporalAudit` **同步**；`assertPublishableQa` 保持同步。

## 3. 契约（冻结签名）

```ts
// temporal-input.ts
type TemporalInputFailureCode =
  | "atlas-file-missing" | "atlas-checksum-mismatch" | "atlas-json-invalid"
  | "frame-missing" | "frame-source-size-mismatch"
  | "frame-anchor-missing" | "frame-anchor-mismatch"
  | "asset-unverified"
  | "frame-rotated-unsupported" | "frame-trimmed-unsupported";

type TrustedAtlasInput = {
  readonly [brand]: true;                       // 模块私有 unique symbol，不导出
  readonly frames: ReadonlyMap<string, FrameGeometry>;   // 键 assetId/frameName
  readonly assets: ReadonlySet<string>;
  readonly files: readonly VerifiedFile[];      // 追溯到已校验字节
};

type VerifyTemporalInputInput = {
  readonly manifest: AssetPackManifest;
  readonly assetIds: readonly string[];
  readonly atlases: readonly { readonly path: string; readonly bytes: Uint8Array }[];
  readonly digest: (bytes: Uint8Array) => string;
};

function verifyTemporalInput(input: VerifyTemporalInputInput): TemporalInputResult;

// temporal.ts
type TemporalAuditResult =
  | { readonly applicable: false }
  | { readonly applicable: true;
      readonly verdict: PlayabilityVerdictState;
      readonly degradation?: "lag-invalid" | "lag-disagreement" };

type TemporalAnalyzer = (args: {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly lagMs: number;
  readonly trustedInput: TrustedAtlasInput;
}) => TemporalAuditResult;

function temporalScope(config: GameConfig): {
  readonly applicable: boolean;
  readonly assetIds: readonly string[];
};

function auditPlayabilityTemporal(
  config: GameConfig,
  manifest: AssetPackManifest,
  options: { readonly lagMs: number; readonly trustedInput: TrustedAtlasInput; readonly analyze: TemporalAnalyzer },
): TemporalAuditResult;

function resolveTwoLagResults(a: TemporalAuditResult, b: TemporalAuditResult): TemporalAuditResult;
function stubTemporalAnalyzer(args: Parameters<TemporalAnalyzer>[0]): TemporalAuditResult;

const TEMPORAL_LAG_MS = 16.67;
const TEMPORAL_LAG_BASELINE_MS = 200;

// assets/ops.ts
function runTemporalAudit(args: {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly packDir: string;
}): TemporalAuditResult;
```

- `runTemporalAudit` 读一次可信输入、调两次入口、`resolveTwoLagResults`、返回；**不抛**，任何未知异常收敛为 IE。
- `readTrustedAtlasInput` 模块私有、不导出；生产 digest 固定真实 sha256，不接受外部注入。
- `@internal` **不是访问控制**；边界靠架构测试 + 代码评审 + I01-07 审计。

## 4. 逐帧几何判据

对 `temporalScope.assetIds` 范围内的每个 `asset.frames[]`：

1. 帧必须存在于对应 atlas JSON；
2. `sourceSize.w == asset.size.w` 且 `sourceSize.h == asset.size.h`；
3. `anchor` 必须存在；
4. `anchor` 与 `asset.anchor` 在 `1e-9` 内一致（`ANCHOR_EQUAL_EPSILON`，不复用门宽 ε）；
5. `rotated === false`、`trimmed === false`（schema 缺省按 `false`；显式 `true` ⇒ unsupported）。

文件绑定：

- JSON 字节的 SHA 只认 `manifest.files[]` 中 `atlases[].meta` 那条；`AtlasEntry.checksum` 是 PNG 的 sha256，**不得**用来校验 JSON。
- 同一路径按去重；相同 checksum 合并；冲突 ⇒ `atlas-checksum-mismatch`；缺失 ⇒ `atlas-file-missing`。
- 失败**全量累积**，按 `(code, atlasPath, assetId, frameName)` 去重并稳定排序；失败结果不携带任何可消费几何（全有或全无）。
- 真实语料 `last-train/v2`：9 资产 / 14 动画帧在严格判据下零不符；player anchor 固定 `{0.5,0.95}`。

负例矩阵见 [`03-frame-geometry-predicate.md`](03-frame-geometry-predicate.md)。

## 5. 双档编排与 stub 契约

- 常量：`TEMPORAL_LAG_MS = 16.67`、`TEMPORAL_LAG_BASELINE_MS = 200`，唯一住 `temporal.ts`；不复用 `FRAME_MARGIN_MS`。
- 适用性：只要存在 `kind === "hazard"` 且带 `motion` 的实体即 `applicable: true`；Y 轴与多移动 Hazard 保守 IE，不判为不适用。无移动 Hazard ⇒ `applicable: false`，不读盘。
- 非法 `lagMs`（`undefined` / `null` / 非 number / `NaN` / `±Infinity` / 负数）⇒ IE + `lag-invalid`；`0` 合法。顺序：先校验 lag，再判适用性。
- 两档只比 `verdict`：不同 ⇒ IE + `lag-disagreement`；`lag-invalid` 优先于 `lag-disagreement`。
- 生产 stub 只返回 IE，永不 NB/PU；经 `api.ts` 以 `@internal` 导出，由 `runTemporalAudit` 显式传入；替身只允许出现在 contracts 测试。
- 三处调用方接线后**丢弃**结果；消费留到 I-03。I-01 不证明生产系统已消费时序结论。

## 6. 测试矩阵与证据要求

- 新测试：`packages/contracts/tests/playability-temporal-input.test.ts`，65 条用例（T-01～T-65），覆盖：
  - 正向读取与 SHA、验证范围、`files[]` 绑定、10 个失败码；
  - 逐帧几何（`sourceSize` / anchor 缺失 / `1e-9` 容差两侧 / rotated / trimmed）；
  - 累积、去重、全有或全无；
  - TOCTOU 同字节、不读盘、文件替换；
  - brand 伪造（含 PU / NB 阳性对照）；
  - `lagMs` 非法矩阵与两档组合表；
  - 适用性 / scope；
  - 架构扫描（contracts 无 fs/crypto、唯一调用者、唯一 analyzer、三处接线、常量唯一）。
- 既有测试零改动：`playability-api.test.ts` / `config-audit.test.ts` / `publish-gate.test.ts`。
- 夹具零新增：真包只读 + 内存改 JSON；负向重绑 `files[]`；TOCTOU 用系统临时目录。
- 回归命令：`pnpm build` / `pnpm typecheck` / `pnpm test` / `pnpm check:deps` / `pnpm check:links` 全 exit 0。
- 语料：`acceptance-corpus.mjs` / `acceptance-matrix.mjs`（scratch，非 vitest）；基线 96 配对 `36/36/24`、矩阵 `19/9/11`、零新增误报、零容差。

详见 [`06-test-matrix.md`](06-test-matrix.md)。

## 7. 范围审计结论

- 7 个文件全部在 I-00 §11 白名单内；越界清单为空。
- 既有测试零改动、零删除、零放宽。
- 公共面无第 5 项功能类别：R2 第 2–4 项不用；第 1 项由新入口替代；`auditPlayability` 签名不动。
- **边界导出**：`stubTemporalAnalyzer` / `temporalScope` 属第 1 项替代集合，必须在本文逐符号签署；若被判定为第 5 项 ⇒ `STOP → I-00 R2`。
- 预期实施 diff：3 个 `A` + 4 个 `M`，无 `D`。

详见 [`07-scope-audit.md`](07-scope-audit.md)。

## 8. 对 I-00 冻结计划的偏离清单

| # | I-00 原计划 | I-01 实际 | 处理 |
| --- | --- | --- | --- |
| 1 | Atlas 读取在 contracts | 读取在 `assets/ops.ts`；contracts 只验证 | 显式偏离，白名单内 |
| 2 | 几何提取 + 验证都在 contracts | contracts 纯验证；assets 可信读取 + 真实 SHA | 显式偏离，白名单内 |
| 3 | 扩展 `auditPlayability` options | 新增独立入口 `auditPlayabilityTemporal`；旧签名不动 | 显式偏离；R2 第 1 项替代 |
| 4 | `config-audit.ts` 增 `packDir` / `lagMs` | 不改；调用方直接调编排器 | 显式偏离，白名单内 |
| 5 | `coverage.temporal` / 证据字段 | I-01 内部结果；公共字段留给 I-03 | 阶段边界，不实施 |
| 6 | `compileRuntime` `:1247` + `:1284` 两处 | 只接 `:1284`；循环内不接 | I01-05 收敛；R1 列明 |
| 7 | `publish-gate.test.ts` 可选只增 | 不新增；`:193` 已覆盖 | I01-06 裁定 |

**这些偏离不得被描述成「按 I-00 原样执行」。**

## 9. 风险与停止条件

### 必须原样写入授权包的限制

1. **Runtime brand 不是密码学边界**：它是架构纪律与误用防护，不能抵御同进程恶意代码伪造 / 篡改。
2. **生产 stub 不代表算法能力**：I-01 只证明链路接通、编排器能消费结果并执行降级，不证明移动 Hazard 时序判定已实现。
3. **生产读取器无独立单元测试**：`readTrustedAtlasInput` 在 assets 且模块私有；白名单无 assets 测试位、contracts 不能反向 import assets。约束来自类型形状、纯函数同字节测试、架构扫描与集成非回归。
4. **三处接线丢弃结果**：「已消费」只能结构证明（源码扫描），不能运行时观察。
5. **发布闸读取失败静默降级**：缺 atlas / 坏字节在发布闸得到 IE 并被丢弃；不阻止发布，也无可见记录。

### 停止条件（立即停，不得绕过）

- 需要修改既有测试、白名单外文件、`contracts/src/index.ts` 或任何「需单独裁定」项 ⇒ `STOP → I-00 R2`。
- 需要第 5 项公共面类别（新字段 / 新参数 / 新 `ConfigIssue.code` / 持久化 / CLI / MCP / 依赖）⇒ `STOP → I-00 R2`。
- `runTemporalAudit` 无法保持同步 ⇒ `STOP`（会迫使发布闸改 `async`）。
- Atlas 字节无法与 manifest 稳定绑定，或 TOCTOU 无法关闭 ⇒ `STOP`。
- 两档无法确定性比较 ⇒ `STOP`。
- 实现发现必须新增公共字段才能让结果有消费者 ⇒ `STOP`，回 I01-R1 重新裁定。
- 任何既有断言被删除或放宽 ⇒ 直接阻断。

### I-01 不触发 R2 Q6

I-01 的生产 stub 只返回 IE，不返回 `PROVEN_UNPLAYABLE` ⇒ **不改变发布结果**。R2 Q6 的「移动 Hazard 关卡可能被拒」只在 I-04 时序判定产生 PU 时生效。

## 10. 授权边界

签署只授权：

- I-01 实施：上述 7 个文件、独立 PR、基线 `main @ 29ea1d1`。
- 实施分支：`p1/level-playability-v1.1-i01`（自 `main @ 29ea1d1`）；不推送 `main`、不自动合并。
- 零付费：不调用付费模型、不生图、不使用外部付费服务。
- Runtime / CLI / MCP 只读：不改 `packages/demo/**`、`packages/cli/**`、`packages/mcp/**`。
- 不新增依赖、不改持久化 schema、不改 `ConfigIssue.code`。
- **不启动 I-02 / I-03。**

实施完成后必须提交：测试结果、回归结果、范围审计证据；复核通过后才申请 I-02 授权。

## 11. 签署

| 项 | 值 |
| --- | --- |
| 签署人 | **用户裁定** |
| 签署日期 | **2026-11-10** |
| 签署方式 | 用户逐项确认 §1～§10；裁定记录如下 |
| 状态 | **SIGNED** |

签署记录：

- **Q1 整体授权**：**签署**。按 §1～§10 授权 I-01 实施；仅限 7 个文件、独立 PR、零付费、Runtime / CLI / MCP 只读、不启动 I-02 / I-03。
- **Q2 边界导出**：**接受为 R2 第 1 项替代集合**。`stubTemporalAnalyzer` / `temporalScope` 由本包逐符号签署，不视为第 5 项，不回 I-00 R2。
- **Q3 残余限制**：**接受并原文写入**。生产读取器无独立单元测试；三处接线丢弃结果、只能结构证明「已消费」。
- **Q4 执行形态**：**全部接受**。`compileRuntime` 只接 `:1284`；独立 PR；分支 `p1/level-playability-v1.1-i01` 自 `main@29ea1d1`。
- **Q5 证据归档**：**链接引用**。执行包正文自包含签署所需的判定与清单；细节证据不复制，遵守「决策只住一处」。
