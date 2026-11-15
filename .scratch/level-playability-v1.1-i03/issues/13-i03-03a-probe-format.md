# I03-03A 几何 probe 证据格式与 hash

Type: grilling
Status: resolved
Owner: claude (I03-03A session 2026-11-14)
Blocked by: 04
Map: ../map.md
Class: I-03 / DECISION

## Question

几何 probe 的**机器可读证据格式**是什么？它必须让 I03-03 的两层证据（构建期 Atlas / PNG + 运行时 Phaser probe）可复跑、可比较、可独立复核，且不把 probe 数字写成公共 API 或 CI 门禁。

### 必须裁定

- JSON schema / version / 顶层字段（命令、环境、夹具 id、几何分项、expected / actual、pass / fail、failure code、raw hash）；
- 构建期与运行时两段的字段如何分列；
- 环境字段（Node / OS / arch / Phaser version / 浏览器 / headless）；
- 逐帧 / 逐 body 比较的字段与单位（box / size / anchor / offset / foot）；
- 失败码闭集（缺 atlas / 缺帧 / anchor 不符 / trimmed / rotated / body size 不符 / body offset 不符 / hash 不符 / probe 未运行）；
- 确定性：相同夹具 / 环境 ⇒ 语义字段逐字节一致；时间戳 / 主机字段排除；
- 原始证据路径、hash 链与退出码；E3 格式；
- 格式如何供 `coverage.geometry` 分项与 NB/PU 准入读取；
- **不新增公共字段 / 依赖 / 持久化 schema；probe 数字不作 CI 门禁**。

### 禁止

- 把 probe 结果写成公共 Verdict / 公共 coverage；
- 用墙钟阈值当通过条件；
- 把未运行 / 不完整比较写成 checked。

### 验收

JSON schema 草案、字段表、失败码闭集、确定性规则、正 / 负例、下游消费点。

## Answer

**Q1=A / Q2=A / Q3=A / Q4=A / Q5=A。** 本票冻结 **I03-03A Geometry Probe Evidence Contract**；不授权 probe 实现，不开放公共能力，不修改 Runtime / `profile.ts` / `graph.ts`。

> 本票只定义**证据格式与判定规则**。probe 实现必须等 I03-03B（固定夹具矩阵）与 I03-03C（独立复核标准）完成；`all-checked` 是生成器结论，不是最终 `coverage.geometry = checked`。

### 0. 冻结结论

| 题 | 选择 | 结论 |
| --- | --- | --- |
| Q1 | A | 真实浏览器 + 现有 demo；人工 console 或 headless Chrome；不新增 npm 依赖；Node HEADLESS shim 只作调试 |
| Q2 | A | 一次运行一个 JSON，逐帧 / 逐 body 记录 `expected / actual / delta / pass`；summary 只作索引 |
| Q3 | A | 零容差 + 显式坐标归一化；任何非零 delta ⇒ 分项不得 checked；坐标约定不明确 ⇒ STOP |
| Q4 | A | Atlas JSON/PNG + 规范化结果 SHA-256；环境 / 时间戳只作 metadata；失败码闭集 |
| Q5 | A | probe 是证据生成器，不是 CI：`all-checked` / `partial` / `untrusted` 都退 0；仅 harness 崩溃 / 无证据退非 0 |

### 1. 证据 JSON 契约

```ts
export type GeometryProbeVersion = "i03-geometry-probe/v1";
export type GeometryDimension = "hazard" | "player" | "graph";
export type GeometryProbeCoverage = "checked" | "partial" | "not-checked";

export type GeometryProbeFailureCode =
  | "atlas-missing"
  | "atlas-hash-mismatch"
  | "frame-missing"
  | "frame-size-mismatch"
  | "anchor-mismatch"
  | "trimmed"
  | "rotated"
  | "body-size-mismatch"
  | "body-offset-mismatch"
  | "body-bounds-mismatch"
  | "graph-solid-mismatch"
  | "probe-not-run"
  | "environment-mismatch"
  | "nondeterministic";

/** 失败类别决定 summary 与公共降级；code 不直接映射公共 Verdict。 */
export type GeometryProbeFailureClass =
  | "missing-evidence"     // 未运行 / 缺文件 / 证据不完整 ⇒ partial
  | "geometry-mismatch"    // 实际几何与模型不一致 ⇒ untrusted + geometry-untrusted
  | "environment"          // 环境不匹配 ⇒ partial，禁止跨环境比较
  | "nondeterministic";    // 同环境不可复现 ⇒ partial

export type GeometryProbeFailure = {
  readonly code: GeometryProbeFailureCode;
  readonly class: GeometryProbeFailureClass;
  readonly detail?: string;
};

export type GeometryProbeRow = {
  readonly dimension: GeometryDimension;
  readonly assetId?: string;
  readonly frameName?: string;
  readonly bodyId?: string;
  /** 审计预期值；字段按 dimension 适用。 */
  readonly expected: {
    readonly box?: { x: number; y: number; w: number; h: number };
    readonly size?: { w: number; h: number };
    readonly anchor?: { x: number; y: number };
    readonly foot?: { x: number; y: number };
    readonly offset?: { x: number; y: number };
    readonly bounds?: { x: number; y: number; w: number; h: number };
  };
  /** Phaser 实际值；坐标已归一到审计约定。 */
  readonly actual: GeometryProbeRow["expected"];
  /** actual − expected；所有适用字段逐项记录。 */
  readonly delta: Record<string, number>;
  readonly pass: boolean;
  readonly failure?: GeometryProbeFailure;
};

export type GeometryFixtureResult = {
  readonly fixtureId: string;
  readonly dimensions: readonly GeometryDimension[];
  readonly build: {
    readonly atlasJsonPath: string;
    readonly atlasPngPath?: string;
    readonly rows: readonly GeometryProbeRow[];
  };
  readonly runtime: {
    readonly rows: readonly GeometryProbeRow[];
  };
};

export type GeometryProbeRun = {
  readonly version: GeometryProbeVersion;
  readonly runner: {
    readonly kind: "browser-console" | "headless-chrome";
    readonly command?: string;
    readonly userAgent?: string;
    readonly phaserVersion: string;
    readonly demoRevision: string;
  };
  readonly environment: {
    readonly os: string;
    readonly arch: string;
    readonly browser?: string;
    readonly browserVersion?: string;
    readonly viewport?: { readonly w: number; readonly h: number };
    readonly deviceScaleFactor?: number;
  };
  readonly fixtures: readonly GeometryFixtureResult[];
  readonly summary: {
    readonly status: "all-checked" | "partial" | "untrusted";
    readonly hazard: GeometryProbeCoverage;
    readonly player: GeometryProbeCoverage;
    readonly graph: GeometryProbeCoverage;
  };
  readonly hashes: {
    readonly atlasJson: string;   // "sha256:…" 原始文件字节
    readonly atlasPng: string;    // "sha256:…" 原始文件字节
    readonly normalizedResult: string;
  };
  /** metadata；不进 normalizedResult hash。 */
  readonly generatedAt: string;
  readonly durationMs: number;
};
```

- 每个 fixture 必须分 `build` / `runtime` 两段；每段必须覆盖**所有声明帧与相关 body**，不得抽样。
- `summary` 只是索引和聚合，不是唯一证据；复核读 rows + hashes。
- 行内 `pass = true` 当且仅当 `delta` 所有适用字段严格为 0（见 §2）。

### 2. 坐标归一化（零容差）

**先归一，再比较；不先设容差。** 每行必须明确记录以下约定：

| 对象 | 审计预期 | Phaser 实际 | 归一化规则 |
| --- | --- | --- | --- |
| Entity box（hazard/goal/pickup） | `runtimeEntityGeometry(...).box`（`entityBox` 取整） | sprite `getBounds()` **与** frame `sourceSize` / origin 分开记录 | 统一到世界 AABB；sprite bounds 与 body bounds 分别记录，不混用 |
| Player box | `runtimePlayerGeometry` 的 size / anchor / foot；`boxFromFoot` | sprite frame `sourceSize` / origin；body `size` / `offset` / world AABB | foot 统一为 body 底边中点；明确 rounded vs unrounded；逐动画帧记录 |
| Graph solid / terrain | `graph.solids[].box`、`graph.player.size/foot` | 对应 static body world AABB（按 id 对齐） | 统一到世界 AABB；按 solid id 比较 |
| Hazard frame | manifest asset `size` + `anchor`；Atlas frame `sourceSize` / `anchor` | Phaser frame `sourceSize` / `customPivot` / `originX/Y` | 逐帧比较；trimmed / rotated 直接不可比 |

- `delta = actual − expected`；`pass` 要求所有 delta **严格为 0**。浮点表示差异也算非零；不得用 ±0.5px 或字段容差吸收。
- 如果发现差异来自**坐标约定本身尚未明确**（例如 body 原点、sprite bounds 与 body bounds 的取法），标记 `missing-evidence` 并 **STOP**；不得自行选一个归一化方式继续。
- `sprite world bounds` 与 `body world AABB` **分开记录**；谁与审计盒比较必须逐行写明，不能把两者混成一个 `actual.bounds`。

### 3. 失败码 → 类别 → summary

| code | class | summary 影响 |
| --- | --- | --- |
| `atlas-missing` / `probe-not-run` | `missing-evidence` | 该分项 `partial` / `not-checked`；整体 `partial` |
| `environment-mismatch` | `environment` | 该分项不得 checked；整体 `partial`；**不得**映射为 geometry mismatch / `geometry-untrusted` |
| `nondeterministic` | `nondeterministic` | 同上，整体 `partial` |
| `atlas-hash-mismatch` / `frame-missing` / `frame-size-mismatch` / `anchor-mismatch` / `trimmed` / `rotated` / `body-size-mismatch` / `body-offset-mismatch` / `body-bounds-mismatch` / `graph-solid-mismatch` | `geometry-mismatch` | 整体 `untrusted`；对应分项不得 checked；公共层可记录 `geometry-untrusted` |

- 失败码是**闭集**；新增情形必须 STOP + HITL，不得以自由字符串扩展。
- `summary.hazard/player/graph`：该分项所有 required rows 通过 ⇒ `checked`；有任何 `missing-evidence` / `environment` / `nondeterministic` ⇒ `partial`；完全未运行 ⇒ `not-checked`；任何 `geometry-mismatch` ⇒ `partial`（整体 `untrusted`）。
- `summary.status`：任一 `geometry-mismatch` ⇒ `untrusted`；否则任一非 checked ⇒ `partial`；否则 `all-checked`。
- **环境不匹配不能当作几何 mismatch**：保留 `environment-mismatch` 独立原因；不同浏览器 / runner 的结果**不得直接比较**。

### 4. Hash 与确定性

- **输入 hash**：对 Atlas JSON / PNG 的原始文件字节算 SHA-256；记录路径与 `"sha256:…"`。
- **结果 hash**：对规范化 JSON 算 SHA-256。覆盖 `version` + `fixtures` 的语义字段（rows / summary）；**排除** `generatedAt`、`durationMs`、`environment`、`runner`、`hashes` 自身。
- 规范化：对象键字典序、数组保序、数字用 `JSON.stringify` 的确定性格式、无 `undefined`。
- 相同夹具 / runner / 环境 ⇒ 语义字段逐字节一致。不得把时间戳 / 耗时 / 环境写进语义 hash。
- 环境 / runner 仍是必须记录的 metadata；复核用它们判断 `environment-mismatch`，但不让它们改变语义 hash。

### 5. 退出码与输出

输出目录：`.scratch/level-playability-v1.1-i03/evidence/geometry-probe/`

| 情况 | 退出码 | summary.status |
| --- | ---: | --- |
| 全部几何检查通过 | **0** | `all-checked` |
| 部分证据不足 / 环境不匹配 / 非确定 | **0** | `partial` |
| 发现不可信 / 几何不一致 | **0** | `untrusted` |
| Harness 崩溃 / 未产出证据 | 非 0 | 无有效 summary |

**禁止把退出码 0 当作几何通过。** 准入必须读取 JSON 的 `summary.status`、逐行结果和 hash；独立复核也必须检查原始证据。

### 6. 三条追加约束

1. **夹具覆盖必须先冻结**：I03-03B 的夹具清单（逐帧、玩家 body、solid 图割几何）必须先于 probe 实现冻结；不得实现后反向挑选容易通过的样本。
2. **环境不匹配独立**：环境不匹配阻断 `checked`，但保留 `environment-mismatch` 独立原因；不得把它写成 `geometry-mismatch` 或 `geometry-untrusted`；不得跨环境比较结果。
3. **证据不可自我认证**：probe 的 `all-checked` 只是生成器结论；最终把几何分项提升为 `checked` 仍需 I03-03C 独立复核确认：夹具完整、比较规则正确、证据 hash 可复现。probe 输出本身不设置 `coverage.geometry`。

### 7. 边界

- 不授权 probe 实现；不修改 Runtime / `profile.ts` / `graph.ts` / 产品代码 / 公共类型。
- 不开放 `PUBLIC_NB` / `PUBLIC_PU`；不改变现有 publish rejection。
- 全部进入 I-03 授权包；I03-09 组装时必须把 §1–§6 与三条追加约束写入几何 probe 证据合同。
- `coverage.geometry = checked` 仍需两层证据 + 独立复核 + 准入；probe `all-checked` 不等于公共能力。

### 8. 下游

- **I03-03B**：先冻结夹具矩阵；probe 实现的前置。
- **I03-03C**：独立复核标准；最终 `checked` 的必要条件。
- **I03-04 / I03-05**：读 `summary` / rows / hash 与复核结论；不得只看退出码。
- **I03-06**：发布门消费规则；与 probe 格式解耦。
- **I03-07 / I03-08 / I03-09**：白名单、验收矩阵、授权包组装。
