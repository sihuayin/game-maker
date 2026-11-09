# I01-05 三处生产调用方接线与回归影响

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I01-05](../issues/05-i01-05-call-site-wiring.md) |
| 依据 | [I01-01 文件计划](01-file-plan.md)、[I01-02 可信输入](02-trusted-input-contract.md)、[I01-03 几何判据](03-frame-geometry-predicate.md)、[I01-04 双档编排](04-lag-orchestration.md)、I-00 §11 白名单 |
| 性质 | **证据与接线方案，不是实施授权**；授权在 [I01-R1](../issues/08-i01-r1-authorization.md) |
| 基线 | `main @ 29ea1d1`；本文件写作时 HEAD `0067fe3`，`packages/**` 无改动 |
| 修改产品目录 | **否** |

## 0. 结论摘要

- **三处都能接线，越界清单为空。** 触及文件仅：`assets/src/ops.ts`、`pipeline/src/create-game.ts`、`pipeline/src/publish-gate.ts`，加 I01-01 已批准的两个 contracts 新文件与 `api.ts` 导出。
- **`runTemporalAudit` 必须是同步函数。** `assertPublishableQa` 是同步 API（`publish-gate.ts:164`），把它改成 `async` 会改变公共签名；因此读取器用 `fs.readFileSync` + `createHash`。
- **读取计划 = 适用才读、每次编排只读一次。** 先用 `temporalScope(config)` 判适用性；无移动 Hazard ⇒ 零读盘。适用时按 scope 去重读取 atlas JSON（`last-train` 为 2 个文件）。
- **不在 `compileRuntime` 的重采样循环 `:1247` 接线**，只在循环后 `:1284` 的确定性校验通过后接一次。理由：结果被丢弃、无法影响重采样；逐发读取只会把 I/O 乘上 1–3 倍，且可能读的是永不落盘的 config。这是对 I01-01「两处调用点接入」的收敛，必须交 I01-07 记录为计划偏离。
- **时序 IE 在三处都不产 issue、不改 Verdict、不阻断、不抛。** 结果按 I01-04 Q8=A 丢弃。今天的移动 Hazard 已经是 IE（`mechanic.ts:119` → `verdict.ts:113`），而 `playabilityIssues` 只映射 `PROVEN_UNPLAYABLE`（`api.ts:114`），所以既有行为不变。
- **读取失败一律降级，不抛。** 缺文件、坏字节、意外异常 ⇒ `INSUFFICIENT_EVIDENCE`；这是保证 I-01 接线不改变退出码的结构性要求。
- **公共面无新增参数 / 返回字段。** `PublishGateOptions`、`CompileRuntimeOptions`、`BuildInput` 全部不变；`configProblem` 是私有函数。新增符号仍在 I01-01 已批准的新导出集合内。

## 1. 逐调用点

| # | 调用点 | `packDir` 来源 | manifest 来源 | 接线位置 | 结果去向 | 需要的参数穿透 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `packages/assets/src/ops.ts`（`compileRuntime`） | `opts.packDir`（`:988`） | `manifest`（`:1111`） | 循环后确定性校验通过之后（`:1296` 附近） | 丢弃 | 无 |
| 2 | `packages/pipeline/src/create-game.ts`（汇合点） | `packDir`（`:561`） | `manifest.value`（`:599`） | `pipelineIssues` 硬失败抛出之后（`:643` 附近） | 丢弃 | 无 |
| 3 | `packages/pipeline/src/publish-gate.ts`（`configProblem`） | `opts.packDir`（`:43`） | `readManifest(opts.packDir)`（`:171`） | config 解析成功且可玩性未阻断时（`:141` 附近） | 丢弃 | 私有 `configProblem` 增加 `packDir` 形参；调用点 `:221` 传入 `opts.packDir` |

### 1.1 `assets/src/ops.ts`：`compileRuntime`

事实位置：

- `CompileRuntimeOptions.packDir`：`ops.ts:984-1004`（`packDir: string` 在 `:988`）。
- manifest 读取与解析：`:1107-1111`。
- 重采样循环内的 `auditConfigPipeline(...).resampleable`：`:1247`。
- 循环后的 `auditConfigPipeline(...).deterministic`：`:1284`。
- 硬失败抛出：`:1288-1295`。
- 落盘起点：`:1297` 的 `mkdirSync`。

接线：

```ts
// 位置：:1284 的 deterministic 审计通过（hard.length === 0）之后、落盘之前。
// ⚠️ I-01：只接线、不消费。时序结果不进入 issues / summary / data / artifacts。
runTemporalAudit({ config, manifest, packDir: opts.packDir });
```

- **为什么不在 `:1247` 接**：`runTemporalAudit` 的返回值在 I-01 被丢弃（I01-04 Q8=A），它不可能影响 `modelHard` 或重采样决策。放进循环的唯一效果是每发 config 多读一次盘 —— 最多 3 倍 I/O，而且可能为永不落盘的 config 读盘。循环后只对**最终会落盘的那一份**跑一次，才是「Atlas 只读一次 / 按需读」。
- **为什么放在硬失败之后**：确定性硬失败会直接抛、不落盘（`:1289-1295`）；此时跑时序没有意义，也不该读盘。
- **对 I01-01 的偏离**：I01-01 §3.3 写「两处调用点使用同一个编排器」，本票把 `:1247` 排除、只保留 `:1284`。这属于同一文件内的接线形态收窄，仍在 §11 白名单内，但必须在 [I01-07](07-i01-07-whitelist-audit.md) 的偏离审计中逐项记录，不能描述成原样执行。

### 1.2 `pipeline/src/create-game.ts`：汇合点

事实位置：

- `packDir`：`:561`（`path.join(input.outRoot, packed.artifacts[0]!.path)`）。
- `manifest`：`:599`（`parseAssetPack(readRunJson(packDir, "manifest.json"))`）。
- `config` 从磁盘读回：`:618`。
- 统一确定性复验：`:631-637`；硬失败抛出：`:638-642`。
- QA 段起点：`:645`。

接线：

```ts
// 位置：pipelineIssues 硬失败抛出之后、QA 之前。
// ⚠️ reuseConfig 与 compileRuntime 两条路径都经过这里；同一位置、同一顺序。
runTemporalAudit({ config: config.value, manifest: manifest.value, packDir });
```

- 这是 `reuseConfig` 与编译两条路径的**唯一共同入口**（文件自己的注释 `:623-630`），因此接线一次就覆盖两条路径，不会出现「路径不同、拦的东西不同」。
- **编译路径会读两次**：`compileRuntime` 内一次（§1.1）+ 汇合点一次。这是可接受的：两者是不同库边界，I01-04 又禁止模块级缓存；两次读取都是同一组小 JSON（`last-train` 为 2 个文件），且不产生可观察行为。**不能**为了去重而把结果塞进 `CommandResult.data` —— 那是新增公共返回字段，触发 STOP。

### 1.3 `pipeline/src/publish-gate.ts`：`configProblem`

事实位置：

- `PublishGateOptions.packDir`：`:43`（必填）。
- manifest：`readManifest(opts.packDir)` `:171`。
- `configProblem` 现状：`:134-146`，只收 `(configPath, manifest)`。
- 调用点：`:221`。
- TD 早退：`:169`（`formatOf(opts.configPath) === TD_CONFIG_FORMAT` ⇒ `return undefined`）。

接线：

```ts
// 私有签名：configProblem(configPath, manifest, packDir)
function configProblem(
  configPath: string | undefined,
  manifest: AssetPackManifest,
  packDir: string,
): string | undefined {
  if (configPath === undefined) return undefined;
  // …现有 JSON 解析 / parseGameConfig / auditPlayability…
  if (hard.length > 0) return "…现有文案…";       // 已阻断，不再读盘

  // I-01：只接线、不消费。时序 IE 不产生任何 problem 文案。
  runTemporalAudit({ config: parsed.value, manifest, packDir });
  return undefined;
}
```

调用点改为 `configProblem(opts.configPath, manifest, opts.packDir)`（`:221`）。

- `PublishGateOptions` **不变**；`packDir` 本来就是必填项，只是现在被穿进私有函数。
- TD 配置在 `:169` 早退，永远到不了时序接线 —— 时序是横版概念，这是正确边界。
- `configPath` 缺省（库调用 / 既有测试）继续跳过，既有边界不动。
- 只有 config schema 通过、且可玩性没有先阻断时才读盘；发布被拒的配置不额外付出 I/O。

## 2. 读取次数与「只读一次 / 按需读」

### 2.1 计数口径

「一次读取集」= 当前 config 的 scope 需要的**去重后 atlas JSON 文件集合**；每个文件读一次、SHA 一次、解析一次（同一份 `bytes`）。`fixtures/game-configs/last-train.json` 的实际 scope：

- player：`player-traveler`（`animations`）
- 引用的 hazard / pickup / goal：`hazard-sweeping-carriage`（`animations`）、`pickup-suitcase`（`sprites`）、`signal-endlight`（`animations`）
- ⇒ 去重后 **2 个 atlas JSON**：`delivery/atlas.animations.json`、`delivery/atlas.sprites.json`。background / UI / decor / 未引用资产不读。

| 生产路径 | `runTemporalAudit` 调用次数 | 读取集次数 | 说明 |
| --- | --- | --- | --- |
| `compile-runtime` 直接入口（CLI / MCP） | 1 | 1 | 循环后一次 |
| `build` / `create`（编译 config 路径） | 2 | 2 | `compileRuntime` 一次 + 汇合点一次 |
| `build` / `create`（`reuseConfig` 路径） | 1 | 1 | 只走汇合点 |
| `site` / 发布闸（`assertPublishableQa`） | 1 | 1 | 私有 `configProblem` 一次；TD 为 0 |

### 2.2 方案

```ts
// assets/src/ops.ts（同步；只此一处读盘）
function readTrustedAtlasInput(
  packDir: string,
  manifest: AssetPackManifest,
  assetIds: readonly string[],
): TemporalInputResult {
  // 1) assetIds → asset.atlasId → manifest.atlases[].meta；去重、稳定排序。
  // 2) 逐路径 readFileSync；任何读取异常 ⇒ 该路径不进入 atlases。
  // 3) 生产 digest 固定为真实 sha256（不接受外部注入）。
  // 4) verifyTemporalInput 用同一份 bytes 做 SHA 比对与 AtlasJson.safeParse。
}

export function runTemporalAudit(args: {
  config: GameConfig;
  manifest: AssetPackManifest;
  packDir: string;
}): TemporalAuditResult {
  try {
    const scope = temporalScope(args.config);
    if (!scope.applicable) return { applicable: false };   // 零读盘
    const trusted = readTrustedAtlasInput(args.packDir, args.manifest, scope.assetIds);
    if (!trusted.ok) return { applicable: true, verdict: "INSUFFICIENT_EVIDENCE" };
    const a = auditPlayabilityTemporal(args.config, args.manifest, {
      lagMs: TEMPORAL_LAG_MS, trustedInput: trusted.value, analyze: stubTemporalAnalyzer,
    });
    const b = auditPlayabilityTemporal(args.config, args.manifest, {
      lagMs: TEMPORAL_LAG_BASELINE_MS, trustedInput: trusted.value, analyze: stubTemporalAnalyzer,
    });
    return resolveTwoLagResults(a, b);
  } catch {
    // ⚠️ I-01 的接线不得改变既有退出码；未知异常按最保守的 IE 处理。
    return { applicable: true, verdict: "INSUFFICIENT_EVIDENCE" };
  }
}
```

- **不缓存**：`readTrustedAtlasInput` 不在模块级或跨调用缓存字节；I01-04 禁止模块级状态，缓存还会让「换了包 / 换了文件」的 TOCTOU 语义变模糊。
- **不二次读盘**：同一路径只 `readFileSync` 一次；SHA 与 `AtlasJson.safeParse` 消费同一个 `Uint8Array`。
- **不抛**：缺文件、坏 JSON、权限错误、意外异常都收敛为 IE。这保证 `compileRuntime` / `runBuild` / `assertPublishableQa` 的既有成功 / 失败边界不变。
- **只在适用时读**：`temporalScope(config)` 是 contracts 的纯函数，单一来源；`applicable === false` 时不产生任何文件 I/O。

## 3. 时序 IE 下的行为

Q8=B 的规则：时序结果不产 `ConfigIssue`、不改 `Verdict`、不落盘、不新增日志协议。三处接线后的具体行为：

| 调用点 | 时序 IE 时发生什么 | 与今天是否一致 |
| --- | --- | --- |
| `compileRuntime` | 结果被丢弃；`issues` / `data.issues` / `summary` / 落盘内容全部不变 | 一致。移动 Hazard 今天已因 `moving-hazard-phase` 落 IE；`playabilityIssues` 不产 issue |
| `create-game` 汇合点 | 结果被丢弃；`pipelineIssues` 不变，QA / site 继续 | 一致，理由同上 |
| `publish-gate` | 结果被丢弃；`configProblem` 仍只在 `PROVEN_UNPLAYABLE` 时返回文案 | 一致，理由同上 |

**今天的证明链**：

1. 移动 Hazard ⇒ `mechanic.ts:119` 无条件 `addGap("moving-hazard-phase")`。
2. `aggregateLayer` 见到 gap ⇒ `INSUFFICIENT_EVIDENCE`（`verdict.ts:113`）。
3. 整关 `auditPlayability` 任一层 IE ⇒ 整体 IE（`api.ts` 的三层组合）。
4. `playabilityIssues` 只在 `PROVEN_UNPLAYABLE` 时产 error（`api.ts:114`），IE 一条 issue 都不产。
5. ⇒ 编译 / 构建 / 发布今天本来就放行移动 Hazard 关卡；I-01 接的是「一条非阻断的旁路」，不是新的拦截。

**静态关卡**：`temporalScope` 返回 `applicable: false`，直接返回；不读盘、不产 issue。静态 Verdict 与今天逐字相同。

## 4. 公共面检查

| 检查项 | 结论 |
| --- | --- |
| `PublishGateOptions` 新字段 | **否**；`packDir` 已存在，只穿进私有 `configProblem` |
| `CompileRuntimeOptions` 新字段 | **否** |
| `BuildInput` 新字段 | **否** |
| 三处调用方的新返回字段 / 新 `ConfigIssue.code` | **否** |
| `coverage.temporal` / `PlayabilityEvidence` 新字段 | **否**（留给 I-03） |
| 新依赖 / 持久化 schema / CLI / MCP 参数 | **否** |

新增符号的范围：

- **assets 包**：`runTemporalAudit` 一个导出（I01-01 已列）。`readTrustedAtlasInput` 建议保持**模块私有**（不导出），把 assets 的新增公共面压到最小；I01-07 审计时按此登记。
- **contracts 包**：`auditPlayabilityTemporal`、`verifyTemporalInput`、`TrustedAtlasInput` 及相关结果类型（I01-01 / I01-02 / I01-04 已列），加本票需要的纯函数 `temporalScope(config)`。它承载 I01-02 的「验证范围」与 I01-04 的「适用性」两条规则，避免三处各写一遍。经 `api.ts` 以 `@internal` 转出，属于 I01-01 所说「替代 R2 第 1 项」的新导出集合，**不是第 5 项公共面加法**。
- **降级备选**：若 I01-07 判定 `temporalScope` 超出已批准导出集合，可退化为「无适用性短路、每次调用都读盘」；三处接线与结果类型不变，只增加不适用 config 的 I/O。不得把这个备选当成默认。

**结论：无 STOP。** 没有第 5 项公共面加法，没有新增参数 / 返回字段，没有白名单外文件。

## 5. 回归影响

### 5.1 既有测试

| 测试 / 位置 | 为什么受影响 | 预期 |
| --- | --- | --- |
| `packages/contracts/tests/playability-api.test.ts:38` | 不 import 新符号；`auditPlayability` 签名不变 | 全绿，零改动 |
| `packages/contracts/tests/config-audit.test.ts:32` | `config-audit.ts` 不改，`ConfigAuditContext` 不变 | 全绿，零改动 |
| `packages/assets/tests/compile-runtime.test.ts` | 新增同步读取；真实包 `last-train/v2` 的 `animations` / `sprites` atlas 存在，读取成功 ⇒ IE 被丢弃；合成 / 缺 atlas 的临时包 ⇒ 读取失败收敛为 IE，不抛 | 全绿，零改动；`summary` / `data` / 落盘内容不变 |
| `packages/pipeline/tests/create-game.test.ts` | 汇合点新增一次非阻断调用 | 全绿，零改动 |
| `packages/pipeline/tests/publish-gate.test.ts:193` | `GOOD_CONFIG = fixtures/game-configs/last-train.json` 含移动 Hazard `carriage`，既有「可达 config ⇒ 照常放行」用例会自动走到新接线 | 全绿，零改动；仍返回 `defined` |
| `packages/cli/tests/**`、`packages/mcp/tests/**` | 只经 `compileRuntime` / `runBuild` / `assertPublishableQa`，外部行为不变 | 全绿，零改动 |
| `packages/demo/**` | 不 import 新符号；Runtime 只读 | 全绿 |

- **既有断言的删除 / 放宽：无。**
- **既有测试文件修改：无。**
- 若 I01-06 认为需要为发布闸补一条「移动 Hazard 配置不因时序 IE 被拒」的显式回归，可按 I01-01 §1 第 8 行在 `publish-gate.test.ts` **只增**用例；既有 `:193` 已事实上覆盖，新增不是硬性要求。

### 5.2 语料复跑（scratch，不是 vitest）

命令与基线（来自 LP-06 证据 `evidence/06-corpus-acceptance.md`）：

```bash
pnpm build
node .scratch/level-playability-v1-p1/acceptance-corpus.mjs   # exit 0 → evidence/06-corpus-regression.json
node .scratch/level-playability-v1-p1/acceptance-matrix.mjs   # exit 0 → evidence/06-matrix-acceptance.json
```

| 口径 | 基线 |
| --- | --- |
| 冻结语料 | 96 唯一配对 / 20 唯一 config / 31 唯一内容组合 |
| 配对级分布 | `PROVEN_UNPLAYABLE 36` · `INSUFFICIENT_EVIDENCE 36` · `NO_PROVEN_BLOCKER 24` |
| 矩阵组合分布 | `PROVEN_UNPLAYABLE 19` · `NO_PROVEN_BLOCKER 9` · `INSUFFICIENT_EVIDENCE 11` |
| 新增 playability 误报 | **0** |
| 容差 | **零差异**；任何计数变化都按 LP-07 的 F3 停在裁定点 |

说明：这两个脚本直接调 `auditSpatial` / `auditMechanic` / `auditCompletion`，不经过 I-01 的新接线；复跑的意义是证明「静态 / 机制 / 完成性结论没有被 I-01 触碰」。

### 5.3 全仓门

实施阶段必须全部退出 0：

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm check:deps
pnpm check:links
```

- `check:deps` 必须仍然通过：`pipeline → assets → contracts` 单向，`publish-gate.ts` 新增 `@game-maker/assets` import 不引入反向边（`pipeline/package.json:14` 已有依赖）。
- `check:links` 覆盖新增证据 / 文档链接。

## 6. 范围收集的共享实现

```ts
// packages/contracts/src/playability/temporal.ts（纯函数，无 I/O）
export function temporalScope(config: GameConfig): {
  readonly applicable: boolean;
  readonly assetIds: readonly string[];
};
```

- `applicable`：配置中至少一个 `kind === "hazard" && motion !== undefined`（I01-04 §3 的规则）。
- `assetIds`：`config.player.asset` + 所有 `kind ∈ {hazard, pickup, goal}` 实体的 `asset`；去重、稳定排序。
- 排除：`solid` / `danger` / `chest` / `decor` / background / UI / 未引用资产（I01-02 §1 的范围）。
- **唯一调用者**是 `assets/src/ops.ts` 的 `runTemporalAudit`；三处生产调用方都经由它，因此**没有任何一处重写 scope 规则**。
- contracts 测试可以直接 import 它，覆盖「范围 / 适用性」的纯逻辑，不需要读盘。

## 7. 可行性结论

**三处都能在 I-00 §11 白名单内完成接线。**

| 文件 | 白名单条目 | 改动 |
| --- | --- | --- |
| `packages/contracts/src/playability/temporal.ts`（新） | §11 新文件 | `temporalScope` + 入口 + stub + 比较 + 常量 |
| `packages/contracts/src/playability/temporal-input.ts`（新） | §11 新文件 | 纯验证 + brand + 失败码 |
| `packages/contracts/src/playability/api.ts` | §11 允许 | 只加 `@internal` 导出 |
| `packages/assets/src/ops.ts` | §11 允许 | 私有读取器 + `runTemporalAudit` + `compileRuntime` 一处接线 |
| `packages/pipeline/src/create-game.ts` | §11 允许 | 汇合点一处接线 |
| `packages/pipeline/src/publish-gate.ts` | §11 允许 | `configProblem` 穿透 `packDir` + 一处接线 |

**越界清单：空。** 仍有效的停止条件：

1. 若某处接线必须新增公共字段 / 参数 / 类型才能观察结果 ⇒ 停止，回 I01-R1。
2. 若 `runTemporalAudit` 无法保持同步 ⇒ 停止（会迫使发布闸改 `async`）。
3. 若被要求修改 `config-audit.ts`、`mechanic.ts`、`verdict.ts`、既有测试、`index.ts` 或白名单外文件 ⇒ 停止，回 I-00 R2。
4. 若必须让时序结果进入 `ConfigIssue[]` / Verdict / 发布阻断 ⇒ 停止，那是 I-03 的范围。

## 8. 事实来源

- `CompileRuntimeOptions.packDir`：`packages/assets/src/ops.ts:984-1004`（`:988`）。
- `compileRuntime` manifest：`packages/assets/src/ops.ts:1107-1111`。
- 重采样循环审计：`packages/assets/src/ops.ts:1247`；循环后确定性审计：`:1284`；硬失败抛出：`:1288-1295`；落盘：`:1297`。
- `create-game` 的 `packDir` / `manifest` / 复验 / 抛出：`packages/pipeline/src/create-game.ts:561`、`:599`、`:631-637`、`:638-642`；QA 起点 `:645`。
- `publish-gate` 的 `packDir` / manifest / `configProblem` / 调用点 / TD 早退：`packages/pipeline/src/publish-gate.ts:43`、`:171`、`:134-146`、`:221`、`:169`。
- `PublishGateOptions` 已有 `packDir`：`packages/pipeline/src/publish-gate.ts:43`。
- `pipeline` 依赖 `assets`：`packages/pipeline/package.json:14`。
- 公开路径只导出 `playability/api.js`：`packages/contracts/src/index.ts:150`。
- 移动 Hazard gap：`packages/contracts/src/playability/mechanic.ts:119`。
- 层 IE 聚合：`packages/contracts/src/playability/verdict.ts:104-115`（gap ⇒ IE 在 `:113`）。
- issue 只由 PU 派生：`packages/contracts/src/playability/api.ts:113-118`（`if (verdict.verdict !== "PROVEN_UNPLAYABLE") return [];` 在 `:114`）。
- 真实语料 scope：`fixtures/game-configs/last-train.json`（player `player-traveler`；hazard `hazard-sweeping-carriage`；pickup `pickup-suitcase`；goal `signal-endlight`；唯一移动实体 `carriage`，x 轴 200px / 4000ms）。
- Atlas 路径：`fixtures/packs/last-train/v2/manifest.json`（`animations` / `sprites` 两个 JSON）。
- I-00 §11 白名单：`docs/v7.8/移动-I00.md:145-163`。

## 9. 限制与风险（写入 R1 授权包）

1. **Runtime brand 不是密码学边界**：它是架构纪律与误用防护，不能抵御同进程恶意代码伪造 / 篡改（I01-02 原样保留）。
2. **生产 stub 不代表算法能力**：I-01 只证明链路接通、编排器能消费结果并执行降级，不证明移动 Hazard 时序判定已实现（I01-04 原样保留）。
3. **三处丢弃结果**：I-01 没有生产消费者；IE / 降级在运行时不可观察。可执行证据只在 contracts 测试与 LP-06/07 复跑。
4. **发布闸读取失败静默降级**：缺 atlas / 坏字节在发布闸里得到 IE 并被丢弃；它不会阻止发布，也不会给出可见记录。这是 Q8=B 的直接后果，必须写进授权包。
5. **编译路径重复读取**：`build` / `create` 的编译路径会读两次同一组 atlas JSON。当前是本地小文件、同步读取；若 I-06 性能预算要求更严，再回 I01-R1 裁定跨库缓存，不在 I-01 自行引入。
6. **`temporalScope` 导出面**：它是本票为了「适用才读」新增的 `@internal` 纯函数；若 I01-07 认为超出已批准导出集合，按 §4 的降级备选处理（不做短路、总是读盘），不得静默扩展公共面。
