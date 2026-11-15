# U3 实现报告（作者侧）

| 项 | 值 |
| --- | --- |
| 单元 | U3（I02-03：永久门区证明） |
| effort | `.scratch/level-playability-v1.1-u3/` |
| 分支 | `wayfinder/level-playability-v1.1-u3`（base `c0d6981`） |
| 授权 | 增量授权记录 04：仅 U3 实施 + R3 复核门 |
| 票 | U3-00 … U3-07（全部 resolved） |

> ⚠️ 本报告是**作者侧**材料。R3 复核会话**不得**读取本文件（见地图执行形态与 R3 输入包）。

## 1. 范围

- 只实现 D4 冻结的**门区半部**：门区闭式几何、全周期覆盖、判侧规则、`forbiddenBoxes` 注入。
- 不生成 `graphCut` / `hopDoubling` / `hopSamplingCoverage` / `movementModelClosure`，不组装完整 `PermanentGateProof` / `TemporalInternalResult`。
- `temporal.ts` 零改动；`graph.ts` / `reach.ts` 只读。

## 2. 文件

| 文件 | 性质 | 内容 |
| --- | --- | --- |
| `packages/contracts/src/playability/temporal-gate.ts` | 新增 | `computePermanentGate`、输入 / 输出契约、四段门区半部 |
| `packages/contracts/tests/playability-temporal-gate.test.ts` | 新增 | 48 条：API、闭式、覆盖、判侧、注入、D4 反例、边界 |
| `packages/contracts/tests/playability-temporal-fixtures.ts` | 既有 | **未修改** |

白名单外零改动；无新依赖、无锁文件变更、无 JSON fixture、无 barrel 导出。

## 3. API

```ts
export type PermanentGateInput = {
  readonly motion: TriangleMotion;
  readonly hazard: HazardBoxSpec;
  readonly playerSize: Size;
  readonly spawnBox: Aabb;
  readonly goalRect: Aabb;
  readonly graph: MovementGraph;                    // 基线图（不带 forbiddenBoxes）
  readonly buildGraph: (forbiddenBoxes: readonly Aabb[]) => MovementGraph | null;
};

export type PermanentGateHalf = {
  readonly gate: PermanentGateProof["gate"] | null;
  readonly periodCoverage: PermanentGateProof["periodCoverage"] | null;
  readonly sideRule: PermanentGateProof["sideRule"] | null;
  readonly forbiddenInjection: PermanentGateProof["forbiddenInjection"] | null;
  readonly gateStatus: ProofStatus;
  readonly reason: DegradationReason | null;
};

export const computePermanentGate: (input: PermanentGateInput) => PermanentGateHalf;
```

所有导出符号 `@internal`；不新增公共 barrel 导出。

### 3.1 输入契约扩展

`buildGraph` 是 U3-05 引入的字段：U3-05 要求以**原始** `gateRect` 调用 `buildMovementGraph`，而 U3-01 的输入不含 `GameConfig` / `AssetPackManifest`，地图又禁止本模块解析 `GameConfig`。回调由调用方闭包持有 config / manifest / profile；本模块不新增模块依赖。同源性由 `buildGraph([])` 重跑基线图逐项校验。

## 4. 失败原因闭集

只使用 D9 `DegradationReason` 的两项：

| 原因 | 触发 |
| --- | --- |
| `geometry-untrusted` | 非有限数值、非法周期、`distance < 0`、`w/h ≤ 0`、`anchor ∉ [0,1]`、spawn / goal 盒非正、图不同源、注入掩码与闭式展开不符 |
| `no-permanent-gate` | `width ≤ ε`、Hazard 与玩家 y 区间不严格重叠、同侧 / 跨门 / 无法判侧 |

未新增原因码；`INCOMPLETE` 一律不携带半部结果。

## 5. 冻结语义落点

| D4 | 实现 |
| --- | --- |
| §1.1 闭式 | `gateGeometryOf`：`L/R/width/y/height` + ε + y 严格重叠 |
| §1.2 lag | 门区无 pad；`⋂δ` 由全相位量化自动满足；不引入 `lagMode`（属完整 proof） |
| §1.3 全周期 | `periodCoverageOf`：极值 `at` / `at+d`，两段解析半周期，无采样循环 |
| §2 判侧 | `sideRuleOf`：精确 spawn + `inflate(goalRect, 0.5)`，两方向闭式 |
| §3 注入 | `forbiddenInjectionOf`：原始 `gateRect` 单次注入，掩码 / `standable` / `blocked` 逐项校验 |

## 6. 测试矩阵（48 条）

| 组 | 条数 | 关键断言 |
| --- | ---: | --- |
| API / 形状 / 原因闭集 / D9 可嵌入 | 5 | 六字段、失败原因 ∈ 闭集、半部类型可赋给 D9 |
| 闭式几何 | 8 | `L/R/width`、非中心锚点、非扫掠区、ε 两侧、y 三态、`width ≤ 0`、非法输入 |
| 全周期覆盖 | 5 | 区间、极值含负时间 / 多周期、相邻与总长、起终点一致、非法周期 |
| 判侧 | 8 | 两方向、外扩、精确 spawn、同侧 / 跨门、边界相切、未外扩反例、非法目标 |
| 注入 | 7 | 原样注入、`expandedRect`、调用序列、不可穿越、`blocked` 不变、门顶非地板、预扩张 / 同源 |
| D4 反例 + ε + 确定性 | 8 | §11 的 1–4、6、13；ε 不进谓词；无随机 / 时间依赖 |
| 依赖 / 公共面 | 7 | DAG 导入白名单、无 `temporal.ts` / witness、无 barrel、无图割、无采样循环、`@internal` |

## 7. 命令与结果

| 命令 | 原始输出 | 退出码 | 结果 |
| --- | --- | ---: | --- |
| `pnpm build` | `../evidence/07-build.log` | **0** | `tsc -b` + bundle Done |
| `pnpm typecheck` | `../evidence/07-typecheck.log` | **0** | 全 workspace Done |
| `pnpm exec vitest run …playability-temporal-gate.test.ts` | `../evidence/07-gate.log` | **0** | **48 / 48 passed** |
| `pnpm exec vitest run …playability-temporal-input.test.ts --reporter=verbose` | `../evidence/07-architecture.log` | **0** | **65 / 65 passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `pnpm test` | `../evidence/07-test.log` | **0** | **174 / 174 files，2795 / 2795 tests passed**；2 条已知 `[vitest-worker] Timeout calling "onTaskUpdate"`（非断言失败） |

架构断言（U3 相关）：

| 断言 | 结果 |
| --- | --- |
| T-55 contracts `src` 不引 `node:fs` / `node:crypto` | ✓ |
| T-57 不新增 `auditPlayabilityTemporal(` 生产调用者 | ✓ |
| T-58 生产 `analyze:` 仍只有 `stubTemporalAnalyzer` | ✓ |
| T-61 三处生产接线不变 | ✓ |
| T-62 不新增 `TEMPORAL_LAG_*` | ✓ |
| T-64 不出现 `Symbol(` | ✓ |
| `temporal-gate.ts` 不 import `temporal.ts` / `temporal-witness.ts` | ✓（定向测试） |

## 8. 已知限制与未覆盖项

1. **未组装完整 `PermanentGateProof`**：`graphCut` / hop / `movementModelClosure` / `puConditions` / `geometryCoverage` / `lagMode` / `lagInvariantByConstruction` 均未产出（U4 / U5）。
2. **`intervals` 语义是本单元冻结**：D9 只冻结形状；本实现取「周期内覆盖时间窗口」，两个解析半周期不合并。
3. **ε 的 x 域是本单元裁定**：取 `[at.x, at.x + distance]`；若上游要求别的标尺，需在 U5 / 后续裁定。
4. **`expandedRect` 是连续边界表示**：`graph.ts` 的禁区是脚点格量化，`expandedRect` 记录连续矩形；一致性由掩码逐格校验。
5. **`buildGraph` 回调引入输入契约扩展**：需 R3 判断是否可接受；替代方案（传 `GameConfig` / `AssetPackManifest`）会新增模块依赖，本单元未采用。
6. **未做图割 / hop / 生产接线**：U3 完成不等于 PU 能力，`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`。
7. **A–J F 行顶层断言**：推迟到后续集成阶段。

## 9. 声明

- 未推送、未创建 PR、未合并。
- 未修改 `temporal.ts` / `graph.ts` / `reach.ts` / `docs/` / `fixtures/`。
- 本报告不构成 R3 结论。
