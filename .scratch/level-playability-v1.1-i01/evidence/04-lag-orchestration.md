# I01-04 双档 lag 编排与 stub 降级

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I01-04](../issues/04-i01-04-lag-orchestration.md) |
| 依据 | [I01-01 文件计划](01-file-plan.md)、[I01-02 可信输入](02-trusted-input-contract.md)、[I01-03 几何判据](03-frame-geometry-predicate.md)、I-00 §5 |
| 性质 | **决策记录，不是实施授权**；授权在 [I01-R1](../issues/08-i01-r1-authorization.md) |
| 修改产品目录 | **否** |

## 0. 结论摘要

- **结果类型**：`TemporalAuditResult = { applicable: false } | { applicable: true, verdict, degradation? }`。
- **适用性**：配置中**只要有** `kind === "hazard"` 且带 `motion` 的实体，就 `applicable: true`；Y 轴与多移动 Hazard 一律保守 IE，**不得**误判为不适用或 NB。
- **两档比较**：只比 `verdict` 状态；不同 ⇒ IE + `lag-disagreement`。
- **非法 lag**：返回 IE + `lag-invalid`，不抛异常、不钳位、不取默认值。
- **常量**：`TEMPORAL_LAG_MS = 16.67`、`TEMPORAL_LAG_BASELINE_MS = 200`，唯一住在 contracts `temporal.ts`；不复用 `FRAME_MARGIN_MS`。
- **编排器**：`assets/ops.ts` 的 `runTemporalAudit`，读一次可信输入、调两次入口、比较后返回。
- **stub 与替身是两件事**：生产用冻结的 `stubTemporalAnalyzer`；测试替身只允许出现在 contracts 测试。
- **结果消费**：三处生产调用方接线后**丢弃**返回值；消费留到 I-03。这个局限必须原样写进授权包。

## 1. 决策表

| 问题 | 裁定 | 冻结内容 |
| --- | --- | --- |
| Q1 结果类型 | A | 判别联合；无移动 Hazard ⇒ `applicable: false` |
| Q2 双档比较 | A | 只比 `verdict`；不同 ⇒ IE |
| Q3 非法 lag | A | IE + `lag-invalid`，不抛 |
| Q4 常量位置 | A | contracts `temporal.ts` 唯一一处 |
| Q5 编排器 | A | assets `ops.ts`，读一次、调两次、比较 |
| Q6 stub 注入 | A | `analyze` 必填；生产显式传 `stubTemporalAnalyzer` |
| Q7 注入边界 | A | 架构测试限制生产调用者与生产 stub；替身仅在测试 |
| Q8 结果消费 | A | 调用即接线，结果丢弃；消费在 I-03 |

**Q6/Q7 修正**：生产 stub 与测试替身是两个概念，不得混写。

## 2. 结果类型

```ts
type TemporalAuditResult =
  | { readonly applicable: false }
  | {
      readonly applicable: true;
      readonly verdict: PlayabilityVerdictState;
      readonly degradation?: "lag-invalid" | "lag-disagreement";
    };
```

- `PlayabilityVerdictState` 沿用 `verdict.ts:26-29` 的三态。
- 不携带 `evidence` / `coverage` / witness；I-01 不碰公共证据字段。

## 3. 适用性

- `applicable: false` **仅当**配置里没有任何 `kind === "hazard"` 且带 `motion` 的实体。
- 只要存在移动 Hazard ⇒ `applicable: true`：
  - `Motion.axis === "y"` ⇒ IE（I-01 模型只支持 X 轴），**不是**不适用；
  - 多个移动 Hazard ⇒ IE（I-01 只做单 Hazard 模型）；
  - 尚未实现的分析能力 ⇒ IE。
- 移动 `solid`（moving platform）不会让时序分析变为适用；它由现有 `moving-platform-unsupported` gap 处理。
- 适用性不依赖 `lagMs`；两档必须得到相同的 `applicable`。

## 4. 生产 stub

```ts
type TemporalAnalyzer = (args: {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly lagMs: number;
  readonly trustedInput: TrustedAtlasInput;
}) => TemporalAuditResult;
```

`stubTemporalAnalyzer`：

- 对任何 `applicable: true` 的输入只返回 `{ applicable: true, verdict: "INSUFFICIENT_EVIDENCE" }`。
- **永不**返回 `NO_PROVEN_BLOCKER` 或 `PROVEN_UNPLAYABLE`。
- 收到 `trustedInput` 但不消费其几何（I-02 才消费）；入口必须把它传进来。
- 经 `api.ts` 以 `@internal` 导出，由 `runTemporalAudit` 显式传入。
- 它是**占位实现**，不是能力声明；不得在文档或输出中读成「已实现时序判定」。

## 5. 两档比较

```ts
resolveTwoLagResults(a: TemporalAuditResult, b: TemporalAuditResult): TemporalAuditResult
```

规则：

1. 两档都 `applicable: false` ⇒ `applicable: false`。
2. 一档适用、一档不适用 ⇒ `applicable: true`, IE, `lag-disagreement`（适用性不依赖 lag，出现分歧即内部不一致）。
3. 两档都适用：
   - `verdict` 相同 ⇒ 保留该 verdict；
   - `verdict` 不同 ⇒ IE + `lag-disagreement`。
4. 任一档因非法 lag 已返回 IE + `lag-invalid` ⇒ 结果为 IE + `lag-invalid`（`lag-invalid` 优先于 `lag-disagreement`）。
5. 不比较 witness、evidence、内部细节。

## 6. 非法 lag 矩阵

`lagMs` 是必填 number。以下一律返回 `applicable: true` + IE + `lag-invalid`：

| 输入 | 处理 |
| --- | --- |
| 运行时缺失（`undefined` / `null`） | `lag-invalid` |
| 非 number（字符串 / 对象等） | `lag-invalid` |
| `NaN` | `lag-invalid` |
| `Infinity` / `-Infinity` | `lag-invalid` |
| 负数 | `lag-invalid` |
| `0` | **合法**（有限非负数） |

- 无隐式默认值；无模块级状态。
- **顺序**：先校验 lag，再判适用性。按 Q3 的严格口径，非法 lag 一律返回 IE + `lag-invalid`，即使配置没有移动 Hazard；`applicable: false` 只在 lag 合法时出现。

## 7. 常量

```ts
export const TEMPORAL_LAG_MS = 16.67;
export const TEMPORAL_LAG_BASELINE_MS = 200;
```

- 唯一住在 `contracts/src/playability/temporal.ts`。
- 不复用 `mechanic.ts:62` 的 `FRAME_MARGIN_MS`。
- `200ms` 是 `smoothStep` 下 `delta ≤ 200ms` 的**源码上界推导值**，不是实测延迟。
- 「Pipeline 使用」= 生产路径经过使用该常量的 `runTemporalAudit`；不要求 pipeline 源码出现字面引用。

## 8. 生产链路

```
三处生产调用方
  （pipeline/create-game、pipeline/publish-gate、assets/compileRuntime）
        ↓
assets/ops.ts: runTemporalAudit({ config, manifest, packDir })
        ↓
readTrustedAtlasInput（一次）
        ↓
auditPlayabilityTemporal(..., lagMs = 16.67, analyze = stubTemporalAnalyzer)
auditPlayabilityTemporal(..., lagMs = 200,   analyze = stubTemporalAnalyzer)
        ↓
contracts/temporal.ts: resolveTwoLagResults
        ↓
返回 TemporalAuditResult
        ↓
I-01 调用方丢弃结果
```

- `runTemporalAudit` 每次调用读一次可信输入；不要在两次 lag 调用之间重复读盘。
- `compileRuntime` 是否在重采样循环里复用同一次读取，由 [I01-05](../issues/05-i01-05-call-site-wiring.md) 裁定。

## 9. 注入边界（Q6/Q7）

1. **生产 stub**：`stubTemporalAnalyzer` 住 contracts，经 `api.ts` 以 `@internal` 导出；生产路径显式使用它。
2. **测试替身**：contracts 测试自行注入 analyzer，用于制造两档一致 / 不一致 / 三态组合，验证比较与降级。
3. **架构测试**：
   - 扫描 `packages/**/src/**/*.ts`，`auditPlayabilityTemporal` 的生产调用者只允许 `packages/assets/src/ops.ts`；
   - 生产源码中对 `analyze` 的实参只允许 `stubTemporalAnalyzer`；
   - 其他 analyzer 定义只允许出现在 `packages/contracts/tests/**`。

## 10. 生产结果消费的局限

- 三处调用方调用 `runTemporalAudit` 后**丢弃**返回值。
- 可执行证据在 contracts 测试：两档一致、两档分歧、非法 lag、不适用、轴 / 多 Hazard 保守 IE。
- 这不是「生产系统已消费时序结论」；I-01 只建立链路。
- 若 [I01-05](../issues/05-i01-05-call-site-wiring.md) 发现必须新增公共字段才能让结果有消费者 ⇒ **停止并回 I01-R1 重新裁定**，不得顺手扩公共 API。

## 11. 边界

**包含**：结果类型、适用性、stub、两档比较、非法 lag、常量、编排器、注入边界、消费局限。

**不包含**：I-02 连续时间算法、I-03 `coverage.temporal` / 顶层聚合 / `mechanic.ts` gap 消解、公共诊断字段、持久化、发布阻断行为、CLI / MCP 参数、新依赖。

## 12. 停止条件

- 需要新增公共诊断字段或 `coverage.temporal`；
- 需要模块级默认值、第二入口或可选 `analyze` 兜底；
- 需要修改 `mechanic.ts` / `verdict.ts` / `config-audit.ts` 或任何白名单外文件；
- 两档比较无法只靠 `verdict` 表达确定性要求。

## 13. 事实来源

- 三态：`packages/contracts/src/playability/verdict.ts:26-29`。
- `Motion.axis`：`packages/contracts/src/game-config.ts:79-85`。
- `FRAME_MARGIN_MS`：`packages/contracts/src/playability/mechanic.ts:62`。
- 移动 Hazard 现有 gap：`packages/contracts/src/playability/mechanic.ts:114-119`。
- 生产调用点：`packages/contracts/src/config-audit.ts:53`、`packages/pipeline/src/publish-gate.ts:140`、`packages/assets/src/ops.ts:1247,1284`。
