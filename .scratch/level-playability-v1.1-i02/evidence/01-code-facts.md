# I02-01 代码事实与 I-01 能力核对（证据）

| 项 | 值 |
| --- | --- |
| 票 | [`02-i02-01-code-facts.md`](../issues/02-i02-01-code-facts.md) |
| 基线 | `main @ a3b8a54`（I-01 合并提交 `f6a7de9`） |
| 日期 | 2026-11-10 |
| 性质 | 只读取证；只写 `.scratch/level-playability-v1.1-i02/evidence/` |
| **修改产品目录** | **否** |
| 结论 | 只登记事实与冲突，不做设计裁定 |

## 0. 环境、输入与命令

### 0.1 环境

| 项 | 值 |
| --- | --- |
| Node | `v22.23.2` |
| pnpm | `10.7.1` |
| Vitest | `3.2.7`（`/tmp/i02-01-pnpm-test.log` 运行头） |
| 平台 | `darwin 24.6.0` / `arm64`（Apple M 系列） |
| 仓库 | `/Volumes/shy/some-projects/game-maker` |
| HEAD | `a3b8a54e36a292d0dc8dbd5f5839ec35964a3858` |

### 0.2 输入 SHA-256

| 输入 | SHA-256 |
| --- | --- |
| `docs/v7.8/移动-200.md`（I-02 需求，未跟踪新文件） | `14a3816d8d5975765e3a9301c5f06612ab03f6f14130ca4ca865550ec165b7d5` |
| `docs/v7.8/移动-I00.md`（I-00 冻结包） | `d9fea112a519965e7903d6c7dc9125498927880b14ff0baba9896ecd446e69eb` |
| `packages/contracts/src/playability/temporal.ts` | `4628535b13ba2e3b8934fdecfcf81ec775df53137a8a5838ebaf86214c8bf86a` |
| `packages/contracts/src/playability/temporal-input.ts` | `fb72c781287d2b0bdc4caaa81dd05810c01f4e4216840431d7ece25e32982e08` |
| `packages/contracts/src/playability/mechanic.ts` | `0f60760f89453d1380a8756e4bd0bdf66969b239c5af8543533599d99e2668da` |
| `packages/contracts/src/playability/graph.ts` | `def3fa7132b9142e5f9441f1b5b6f5b6e4d8ef97096bd0db0b2c5b620445e55b` |
| `packages/contracts/src/playability/reach.ts` | `5329904c8c6e16031208825e3e5e11c184a9cc8b63dcf08db1827a5f5544efb2` |
| `packages/contracts/src/playability/profile.ts` | `2deea6e6e42b2c189114166bf3bdf39ab38c560eb330190e59d0cd8733ba8ab2` |
| `packages/assets/src/ops.ts` | `05e181d918beb91da24c4fed462cf8e774c312129976e852775443d9b22e2e4f` |
| `packages/contracts/tests/playability-temporal-input.test.ts` | `1310363601ac869e12594f6e4d9b3befbbf4bfe1bbffec45c5c25548689d6bc9` |
| `.scratch/level-playability-v1/corpus/inventory.json` | `ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f`（清单文档另记冻结 payload hash `25e6c891…`） |
| `.scratch/level-playability-v1.1-integration/scripts/perf-probe.mjs` | `4485333e81ee8a0e9b3f55eff300c13c5de23af0a8dde7af17fed75e0538938b` |
| `fixtures/packs/last-train/v2/manifest.json` | `145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689` |
| `fixtures/packs/last-train/v2/delivery/atlas.animations.json` | `6874ae923c2ee8287e4d4e534e8498b0ef5e108460364151e39d4dcfb766c86d` |
| `fixtures/packs/last-train/v2/delivery/atlas.sprites.json` | `51b7fbca9718e2b839b3086108f736b9fd0c999595336735ca59efc4d875b554` |

### 0.3 命令与退出码

| 命令 | 退出码 | 结果摘要 |
| --- | ---: | --- |
| `pnpm test` | 0 | `170 passed (170)` test files；`2616 passed (2616)` tests；`2 errors` 为 Vitest worker `onTaskUpdate` 超时，被 `dangerouslyIgnoreUnhandledErrors: true` 忽略；总耗时 124.03s |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts` | 0 | 1 file / 65 tests passed；1.04s |
| `pnpm exec vitest run packages/contracts/tests/playability-{api,completion,geometry,graph,mechanic,spatial,temporal-input}.test.ts` | 0 | 7 files / 190 tests passed；28.06s |
| 只读重算语料计数（`python3 -I`，读 `inventory.json` + 其 `configs[].path`） | 0 | 21 unique / 31 hazard / 19 moving；16 configs 含 motion |
| `git diff --stat -- packages docs fixtures` | 0 | 空输出（产品目录无改动） |

原始日志已复制到本目录：`evidence/logs/i02-01-pnpm-test.log`、`evidence/logs/i02-01-temporal.log`、`evidence/logs/i02-01-playability.log`。

---

## 1. `packages/contracts/src/playability/temporal.ts`

### 1.1 常量

- `TEMPORAL_LAG_MS = 16.67`：`temporal.ts:26`。注释称「逐帧延迟（约 60Hz）」，并声明不复用 `mechanic.ts` 的帧余量常量（`:25`）。
- `TEMPORAL_LAG_BASELINE_MS = 200`：`temporal.ts:29`。注释称它是 `smoothStep` 下 `delta ≤ 200ms` 的源码上界推导值，不是实测延迟（`:28`）。

### 1.2 精确类型与签名

```ts
export type TemporalAuditResult =
  | { readonly applicable: false }
  | {
      readonly applicable: true;
      readonly verdict: PlayabilityVerdictState;
      readonly degradation?: "lag-invalid" | "lag-disagreement";
    };

export type TemporalAnalyzer = (args: {
  readonly config: GameConfig;
  readonly manifest: AssetPackManifest;
  readonly lagMs: number;
  readonly trustedInput: TrustedAtlasInput;
}) => TemporalAuditResult;
```

位置：`temporal.ts:31-44`。签名里**没有** `FixedRuntimeProfile`、`T_arr`、预算参数、witness/proof/stats 出口，也没有结果诊断字段。见 §9 C-04/C-10。

### 1.3 `stubTemporalAnalyzer`

- `temporal.ts:67-69`：忽略全部入参，恒返回 `{ applicable: true, verdict: "INSUFFICIENT_EVIDENCE" }`。
- 文件头 `temporal.ts:6-8` 明确它是「显式占位实现」，永不返回 `PROVEN_UNPLAYABLE` / `NO_PROVEN_BLOCKER`，不是能力声明。

### 1.4 `auditPlayabilityTemporal`

签名：`temporal.ts:88-102`。

执行顺序（严格按代码）：

1. `typeof lagMs !== "number" || !Number.isFinite(lagMs) || lagMs < 0` ⇒ `{applicable:true, verdict:"INSUFFICIENT_EVIDENCE", degradation:"lag-invalid"}`（`:98`、`:71-73`）。`0` 合法。
2. `!isTrustedAtlasInput(trustedInput)` ⇒ `{applicable:true, verdict:"INSUFFICIENT_EVIDENCE"}`，无 degradation（`:99`、`:75-77`）。注意 brand 检查在适用性之前：**没有移动 Hazard 也会因 brand 失败返回 applicable:true/IE**。
3. `!temporalScope(config).applicable` ⇒ `{applicable:false}`（`:100`）。
4. 否则调用 `analyze({config, manifest, lagMs, trustedInput})`（`:101`）。

### 1.5 `resolveTwoLagResults`

`temporal.ts:107-115`：

1. 任一侧 `applicable && degradation === "lag-invalid"` ⇒ `lag-invalid`（`:108`，优先级最高）。
2. 两侧都 `applicable:false` ⇒ `{applicable:false}`（`:109`）。
3. 仅一侧适用 ⇒ `{applicable:true, verdict:"INSUFFICIENT_EVIDENCE", degradation:"lag-disagreement"}`（`:110-111`）。
4. 两侧 `verdict` 相同 ⇒ 返回该 verdict，不比较 degradation（`:113`；T-46 `playability-temporal-input.test.ts:464-469`）。
5. 其余 ⇒ IE + `lag-disagreement`（`:114`）。

### 1.6 适用性与范围 `temporalScope`

`temporal.ts:56-64`：

- `applicable = true` 的条件是**任一** `kind === "hazard"` 且 `motion !== undefined` 的实体（`:60`）；Y 轴、多移动 Hazard 也置 true。
- `assetIds` = player + 所有 hazard / pickup / goal 的 `asset`，去重后按 `localeCompare` 排序（`:57-63`）。
- 文件头 `temporal.ts:15-18` 说明：Y 轴与多移动 Hazard 由分析器保守 IE，不判为不适用。
- `auditPlayabilityTemporal` 会再次调用 `temporalScope`；`runTemporalAudit` 已经调用过一次（重复计算，见 §3）。

---

## 2. `packages/contracts/src/playability/temporal-input.ts`

### 2.1 `TrustedAtlasInput` 的保证

类型：`temporal-input.ts:64-71`。构造只发生在 `verifyTemporalInput` 成功分支（`:273-279`）。

成功时保证：

1. `assetIds` 中每个资产都在 manifest 里（`:112-121`），且其 `atlasId` 指向 manifest 的图集（`:124-137`）。
2. 该图集的 `meta` 路径在 `manifest.files[]` 里（`:151-158`），且调用方提供了字节（`:159-166`）。
3. 同一路径若提供多份字节，所有 digest 必须一致（`:167-174`）；digest 必须等于 `files[].checksum`（`:176-182`）。
4. 字节可 `JSON.parse`（`:184-189`），且通过 `AtlasJson` 严格 schema（`:190-197`）。
5. `value.frames` 只包含**每个 scoped asset 的每个 `asset.frames[]` 帧**（`:210`、`:261-267`），键为 `assetId/frameName`。
6. `value.assets` 是 scoped asset id 集合（`:276`）；`value.files` 是已校验 JSON 文件列表，按路径排序（`:199`、`:277`）。
7. 全有或全无：任一 failure ⇒ `{ok:false, failures}`，不携带任何几何（`:271`、`:73-75`）。

### 2.2 逐帧校验：`sourceSize` / `anchor` / `rotated` / `trimmed`

**是，I-01 对每个 scoped asset 的每个声明帧逐帧校验**：

| 字段 | 规则 | 位置 |
| --- | --- | --- |
| 帧存在 | `parsed.frames[frameRef.name]` 必须存在，否则 `frame-missing` | `temporal-input.ts:211-218` |
| `sourceSize` | `w/h` 必须与 `asset.size.w/h` **精确相等**（整数），否则 `frame-source-size-mismatch` | `:222-228` |
| `anchor` | 缺失 ⇒ `frame-anchor-missing`，不回落默认值；存在但与 `asset.anchor` 任一轴相差 > `ANCHOR_EQUAL_EPSILON` ⇒ `frame-anchor-mismatch` | `:229-244` |
| `rotated` | `true` ⇒ `frame-rotated-unsupported` | `:245-251` |
| `trimmed` | `true` ⇒ `frame-trimmed-unsupported` | `:252-258` |

- `ANCHOR_EQUAL_EPSILON = 1e-9`（`:28`），是**绝对**容差，只用于 anchor 相等；不是 I-00 §6.4 的 gate ε 公式。
- `rotated` / `trimmed` 省略时由 schema 默认 `false`（`../atlas-json.ts:31-38`），T-22 覆盖（`playability-temporal-input.test.ts:254-261`）。
- 每个失败帧**累积全部**判据，不首错即停（`:202`、`:220-259`）；T-25 验证同帧两个 code（测试 `:284-291`）。

### 2.3 `TrustedAtlasInput` **不保证**什么

- 不校验 PNG 图片字节：生产只读 `meta` JSON 路径（`ops.ts:1002-1008`）；`atlas.image` 与 PNG checksum 不在 `verifyTemporalInput` 内。T-10 明确「PNG checksum 不参与 JSON 校验」（测试 `:175-180`）。
- 不校验 `frame` 矩形、`spriteSourceSize`、atlas `meta.size` 的几何一致性；`AtlasJson` schema 只做形状/非负/正数（`../atlas-json.ts:15-47`）。
- 不校验 Runtime 实际 hitbox / Phaser overlap 语义；I-00 §6.1 要求「I-01 补一条 Phaser overlap 的直接证据」，当前 I-01 代码和测试中没有该证据（见 §9 C-11）。
- 不校验 hazard `body`、motion 参数（`cycle` / `x` / `distance>0` / `periodMs>0`）、world 范围、玩家 `move`、`T_arr`、相位。
- 只校验传入 `assetIds` 的范围；未引用资产损坏不影响（T-04，测试 `:138-141`）。
- 不校验 `manifest.files[].bytes` 与实际字节数；只比 checksum（`:176-182`）。
- brand 是架构误用防护，不是密码学安全边界；同进程恶意代码可伪造（文件头 `:16-19`、守卫 `:283-286`）。

### 2.4 TOCTOU 是否由「只收字节」关闭

**对 atlas JSON 信任链，是。** `verifyTemporalInput` 的输入类型只有 `{path, bytes}`（`:77-85`），没有可二次读盘的路径；digest 与 `JSON.parse` 消费同一个 `candidates[0]` 字节对象（`:167`、`:185`）。生产薄壳 `readTrustedAtlasInput` 每个 `meta` 只 `fs.readFileSync` 一次（`ops.ts:1010-1016`），然后交给纯验证（`:1017`）。T-26 直接断言 digest 收到的就是同一字节对象（测试 `:296-308`），T-27/T-28/T-29 覆盖无盘访问与替换（测试 `:310-342`）。

**边界（不构成「全部关闭」）**：PNG 图片、manifest 文件本身、以及读取后到分析之间的其他输入不在该字节链内；`digest` 是注入函数，生产用真实 sha256（`ops.ts:993-994`），测试可注入。见 §9 C-11。

### 2.5 失败码清单（10 个）

`TemporalInputFailureCode`，`temporal-input.ts:30-40`：

1. `atlas-file-missing`
2. `atlas-checksum-mismatch`
3. `atlas-json-invalid`
4. `frame-missing`
5. `frame-source-size-mismatch`
6. `frame-anchor-missing`
7. `frame-anchor-mismatch`
8. `asset-unverified`
9. `frame-rotated-unsupported`
10. `frame-trimmed-unsupported`

失败按 `(code, atlasPath, assetId, frameName)` 去重并 `localeCompare` 稳定排序（`:87-97`、`:271`）。

---

## 3. `packages/assets/src/ops.ts` 的 `runTemporalAudit`

### 3.1 读盘范围

- 唯一读盘层注释：`ops.ts:985-991`（「全仓唯一读 atlas JSON 字节并算真实 SHA-256 的地方」）。
- `readTrustedAtlasInput`（`:997-1018`）：
  - 只看 `temporalScope` 给出的 `assetIds`（`:1002-1008`）；
  - 只读这些资产引用的 atlas `meta` 路径（`:1006-1008`）；
  - 不读 PNG、不读 manifest（manifest 已由调用方解析传入）、不读 config；
  - 读失败（缺文件 / 权限 / 坏路径）被 `catch` 吞掉，省略该路径，由 `verifyTemporalInput` 报 `atlas-file-missing`（`:1011-1015`）。
- `runTemporalAudit` 只在 `temporalScope(config).applicable` 为 true 时读盘（`:1033-1035`）；没有移动 Hazard 时零文件 I/O（注释 `:1025`）。
- 注意：Y 轴 / 多移动 Hazard 也会 `applicable:true`，因此也会读盘。

### 3.2 同步 / 不抛约束

- `runTemporalAudit` 是同步 `export function`（`:1027`），返回 `TemporalAuditResult`。
- 整体 `try { ... } catch { return {applicable:true, verdict:"INSUFFICIENT_EVIDENCE"} }`（`:1032-1044`）；任何未知异常收敛为最保守 IE。
- 注释明确：`assertPublishableQa` 是同步 API，改成 `async` 会破坏公共签名；且「绝不抛」，不得改变既有退出码（`:1023-1024`）。T-60 以源码文本断言同步（测试 `:605-610`）。

### 3.3 结果丢弃策略

- I-01 只接通链路，不消费结果：`ops.ts:991`、`:1360-1362`；三个调用点均不绑定返回值。
- 失败/降级不产 `ConfigIssue`、不改 Verdict、不阻断；`TemporalAuditResult` 只在内存中返回后丢弃。
- 这意味着 `verifyTemporalInput` 的 10 个失败码、`lag-invalid`、`lag-disagreement` 在生产侧**不可观测**（无日志、无 issue、无持久化）。

### 3.4 三处生产调用方

| 调用点 | 所在函数 | 位置 / 条件 |
| --- | --- | --- |
| `packages/assets/src/ops.ts:1363` | `compileRuntime`（定义 `:1144`） | 在 `auditConfigPipeline(...).deterministic` 硬校验通过之后、写 config 之前；注释 `:1360-1362` |
| `packages/pipeline/src/create-game.ts:647` | `runBuild`（定义 `:497`） | `reuseConfig` 与 `compileRuntime` 两条路径的汇合点；在确定性复验之后；注释 `:644-646` |
| `packages/pipeline/src/publish-gate.ts:152` | `configProblem`（定义 `:135`，由 `assertPublishableQa` `:231` 调用） | 在 `auditPlayability` 硬失败检查之后；注释 `:151`；`configPath` 缺省时整个函数提前返回（`:140`） |

T-61 用源码扫描断言恰好这三处（测试 `:612-615`）。

---

## 4. `packages/contracts/src/playability/mechanic.ts`

### 4.1 `moving-hazard-phase` gap 的位置与生成条件

- `mechanic.ts:115-120`：

```ts
const allHazards = config.entities.filter((e) => e.kind === "hazard");
const staticHazards = allHazards.filter((e) => !e.motion);
const movingHazards = allHazards.filter((e) => e.motion);
const movingSolids = config.entities.filter((e) => e.kind === "solid" && e.motion);
if (movingHazards.length > 0) addGap("moving-hazard-phase");
if (movingSolids.length > 0) addGap("moving-platform-unsupported");
```

- 生成条件：**只要存在任一 `kind === "hazard"` 且带 `motion` 的实体**，无条件生成；不区分 X/Y 轴、不区分数量、不要求 static hazard 存在。
- `addGap`（`:84-87`）同时把 `mechanic` coverage 置为 `"partial"`。
- 移动 Hazard 不进入静止 Hazard 的 A 判据（`staticHazards` 排除 motion，`:116`、`:122-133`）；也不进入 B 的 danger 判据（B 只看 `kind === "danger"`，`:183-188`）。
- 因此包含移动 Hazard 的关卡当前：mechanic verdict = IE（gap），`coverage.mechanic = partial`，整关 IE，`playabilityIssues` 空。I-00 证据也记录同一事实：`.scratch/level-playability-v1.1-integration/evidence/01-audit-semantics.md:231,242`。
- 现有测试：`playability-mechanic.test.ts:133-136`（`wide-patrol` ⇒ gap）；fixture `playability-mechanic-matrix.json` 的 `wide-patrol` 期望 `INSUFFICIENT_EVIDENCE` / `expectedGap: "moving-hazard-phase"`。

### 4.2 层内与整关聚合现状

层内（`mechanic.ts`）：

- `finish()`，`:252-258`：把 evidence 的 `coverage.mechanic` 覆盖为最终 coverage；调用 `aggregateLayer({coverage, evidence, gaps: gapList.map(g => g.missing)})`（`:256`），返回 `{verdict, evidence, coverage, gaps}`。
- `aggregateLayer` 规则（`verdict.ts:104-114`）：
  1. 任一非 `nonBlocking` evidence ⇒ `PROVEN_UNPLAYABLE`（`:111`）；
  2. 否则有 evidence（含诊断）⇒ `INSUFFICIENT_EVIDENCE`（`:112`）；
  3. 否则有非空 gaps ⇒ `INSUFFICIENT_EVIDENCE`（`:113`）；
  4. 否则 `NO_PROVEN_BLOCKER`（`:114`）。
- `coverage === "partial"` **本身不改变层内 verdict**（`verdict.ts:101-102`）。

整关（`api.ts:64-105`）：

- 建一次 base graph + 一次 `assessReachability(..., {full:true})`，三层共用（`:69-76`）。
- 顺序：`auditSpatial` → `auditMechanic` → `auditCompletion`（`:77-79`）。
- coverage 三维：spatial / mechanic / completion（`:81-85`）。
- 整关三态优先级（`:86-92`）：任一层 PU ⇒ PU；否则任一层 IE ⇒ IE；否则 NB。
- 同目标 evidence 去重，层间优先级 spatial > mechanic > completion（`:94-102`，`layerRank` `:51-54`）。
- `playabilityIssues` 只在整关 PU 时映射**阻断型** evidence，`severity:"error"`、`where=target`、`message=detail`，不带 `code`（`:113-118`）。
- `config-audit.ts:49-54` 把 `playabilityIssues(auditPlayability(...))` 放进 `deterministic`。

---

## 5. `graph.ts` / `reach.ts` / `profile.ts`

### 5.1 `forbiddenBoxes` 语义

- 选项类型：`graph.ts:74-80`；文档说明「不可穿越、但**不提供支撑**的禁区」。
- 建图（`graph.ts:125-133`）：
  - `forbidden = blocked.slice()`，即 forbidden 包含全部 solid（`:126`）；
  - 对每个 box 按玩家半宽 / 全高外扩成脚点格并置 1（`:127-133`）；
  - **不修改** `blocked`，因此不修改 `standable`（`:135-142`：站得住 = 本格 forbidden=0 且下一格 `blocked=1`）。
- `freeAt` 使用 `forbidden`（`:151-152`）；`movementNeighbors` 从 `standableAt` 出发，走 `freeAt`（`:188-214`）。
- `hopSamples` 也在 `forbidden` 上判碰撞：任一采样格 forbidden ⇒ 整条 hop 返回 `null`（`:246`）。
- 生产使用：静止 hazard 掩码 `mechanic.ts:147-149`；danger 全列掩码 `mechanic.ts:203`。均传入 world 坐标矩形，外扩由 `buildMovementGraph` 做。
- 相关：`sweptBox`（`:66-72`）只在 `profile.solidMotion === "swept"` 时用于 solid；固定 profile 是 `"static-origin"`（`profile.ts:57`），所以生产 solid 运动按原始位置静态处理（`graph.ts:106`）。

### 5.2 `hopSamples` 的 `n` 与 `Math.round`

- 签名 `hopSamples(graph, ax, ay, bx, by, move)`：`graph.ts:225-227`。
- `n = Math.max(6, Math.min(120, Math.ceil(t * 60)))`：`graph.ts:237`。即采样数按飞行时间 `t`（秒）×60 向上取整，再 clamp 到 `[6,120]`；循环 `i = 0..n` 含两端（`:239-240`）。
- 取整位置：
  - `const px = Math.round(ax + dx * f)`：`:242`；
  - `const py = Math.round(ay - (vy*t - g*t²/2))`：`:243`。
- 其余相关取整：
  - `startCells()` 的 `Math.round(player.foot.x ± player.size.w)`：`graph.ts:160-161`；
  - `reach.ts` 出生点覆盖 `coverAt(Math.round(foot.x), Math.round(foot.y))`：`:114`；
  - mid-air 扫掠 `Math.round(from.x + vx*t)`、`Math.round(from.y - (...))`：`reach.ts:196-197`。
- 影响（事实）：采样密度固定、坐标先取整再查 forbidden；没有「加倍采样」参数。I-00 §7.4 的 hop 加倍不变性无法在不改 `graph.ts` / 不另写路径的情况下验证；`graph.ts` 在 I-00 白名单中属「需单独裁定」（`docs/v7.8/移动-I00.md:167`）。

### 5.3 `GeometryCoverage` 的来源

- 类型：`profile.ts:34`，值域 `"checked" | "partial" | "not-checked"`。
- `runtimeEntityGeometry`（`profile.ts:83-99`）：
  - `source = profile.collisionSource[entity.kind]`（`:88`）；`none` ⇒ `null`（`:89`）；
  - 资产缺失 ⇒ `null`（`:90-91`）；
  - `source === "body"` ⇒ `entity.body ?? asset.size`；否则 `asset.size`（`:92`）；
  - `coverage = source === "frame" ? "partial" : "checked"`（`:97`）。
- `runtimePlayerGeometry`（`profile.ts:102-115`）：尺寸/锚点来自 manifest，`coverage: "partial"`（`:113`）。
- `buildMovementGraph`（`graph.ts:85-167`）：
  - `coverage` 初值 = `player.coverage`（`:97`），所以**恒为 partial**；
  - terrain 为 `"checked"`（`:99-101`）；
  - solid 的 geometry 缺失 ⇒ `partial`（`:104-105`）；solid 自身 coverage（`:108`）为 partial 时整体置 partial（`:110`）。
- `mechanic.ts`：任何参与静态 hazard 判定的 frame 几何都会把 mechanic coverage 置 `partial`（`:125-127`）。
- 结论（事实）：`profile.ts` 的 frame/partial 规则 + 玩家 partial 使 base graph/机制层的空间几何**不可能**达到 `checked`。

### 5.4 `runtimeEntityGeometry` 对 hazard 的 `frame` / `partial` 规则

- `FIXED_RUNTIME_PROFILE.collisionSource`：`solid/chest/danger = "body"`，`pickup/hazard/goal = "frame"`，`decor = "none"`（`profile.ts:49-58`，hazard 在 `:53`）。
- 因此 hazard：
  - 几何来源是 Phaser 图集帧（`source = "frame"`）；
  - 尺寸使用 `asset.size`，**忽略 `entity.body`**（`:92`）；
  - 锚点使用 `asset.anchor ?? FALLBACK_ANCHOR`（`:93`）；
  - `coverage` 恒为 `"partial"`（`:97`），因为「帧尺寸/锚点 == manifest 标称」不在 schema 里，只由 pack acceptance 保证（文件头 `:16-25`）。
- 注意：即便 `verifyTemporalInput` 已经逐帧证明了 `sourceSize/anchor` 与 manifest 相等，`runtimeEntityGeometry` **不接收 `TrustedAtlasInput`**，仍返回 `partial`。见 §9 C-01。

---

## 6. 测试基础设施

### 6.1 命令与命名

- 根 `package.json:13`：`"test": "vitest run --passWithNoTests"`。
- `vitest.config.ts:8` `testTimeout: 20000`；`hookTimeout: 20000`；`:13` `dangerouslyIgnoreUnhandledErrors: true`。
- 测试文件命名：`packages/contracts/tests/playability-<主题>.test.ts`；当前 7 个：
  - `playability-api.test.ts`
  - `playability-completion.test.ts`
  - `playability-geometry.test.ts`
  - `playability-graph.test.ts`
  - `playability-mechanic.test.ts`
  - `playability-spatial.test.ts`
  - `playability-temporal-input.test.ts`
- 夹具模式：
  1. **真实 pack**：`fixtures/packs/last-train/v2/manifest.json`，配置 `fixtures/game-configs/last-train.json`（`playability-graph.test.ts:12-22`；`playability-temporal-input.test.ts:26-30`）。
  2. **矩阵 JSON**：`packages/contracts/tests/fixtures/playability-{matrix,mechanic-matrix,completion-matrix}.json`，每份含共享 `manifest` + `cases`（`caseId/expectedVerdict/expectedJudgmentId/expectedGap/note/config`）；测试遍历 cases，用 `parseAssetPack` / `parseGameConfig` 解析（`playability-mechanic.test.ts:13-44`、`playability-api.test.ts:12-39`）。
  3. **内存突变**：`structuredClone(CONFIG)` 后改 config（`playability-graph.test.ts:23-27`、`playability-mechanic.test.ts:44`；`playability-temporal-input.test.ts:99-104`）；atlas 负向用 `mutateAtlas` + `manifestFor` 把 `files[].checksum` 重绑到改后字节（`:57-77`）。
  4. 无新增 pack：temporal-input 测试头明确「夹具零新增：正向只读真包」（`:3-6`）。

### 6.2 `playability-temporal-input.test.ts` 已覆盖

65 条（T-01～T-65，头注释 `:3-6`；运行 65 passed）：

| 组 | 内容 | 行 |
| --- | --- | --- |
| A | 正向、SHA、范围只含 player + hazard/pickup/goal、共用 atlas 去重、未引用资产损坏不影响、引用资产缺失 | `:111-147` |
| B | 文件缺失、SHA 不符、JSON 无效、顶层多余字段、PNG checksum 不参与、同路径两份不同字节、meta 路径逃逸 | `:149-193` |
| C | 帧缺失、sourceSize 单/多帧、anchor 缺失/不符/容差内/容差外、rotated、trimmed、省略默认 false | `:195-262` |
| D | 多失败累积排序、全有或全无、同帧双 code | `:264-292` |
| E | TOCTOU：digest/解析同字节、不访问磁盘、文件替换旧/新字节 | `:294-343` |
| F | brand 伪造、同名 Symbol、structuredClone、真 brand、伪造 hitbox/body/size/verticalEvasionImpossible ⇒ IE、PU/NB 阳性对照 | `:345-390` |
| G | lagMs 缺失/非法/0 合法/非法优先于适用性、两档都/一档/相同/不同、lag-invalid 优先、只比 verdict | `:392-470` |
| H | 无/有 X/Y/多移动 Hazard 的适用性、静止 Hazard、范围排除、去重排序、stub 永不 PU/NB | `:472-532` |
| I | contracts 无 fs/crypto、verify/audit 生产调用者、analyze 只 stub、readTrusted 不导出、同步、三调用点、常量唯一、lag 无默认、brand 单点、入口无几何参数 | `:534-650` |

### 6.3 `playability-temporal-input.test.ts` 未覆盖

- **真实连续时间算法**：所有 analyze 都是 `stubTemporalAnalyzer` 或测试 spy；没有 X 轴移动 Hazard 的 witness / 永久门 / 逐段连续判定。
- **`runTemporalAudit` 的运行时行为**：只在 T-60/T-61 做源码文本断言；没有测试实际调用 `runTemporalAudit`，也没有测试 `readTrustedAtlasInput` 的读盘、缺 packDir、读失败→IE、结果丢弃。
- **`auditPlayabilityTemporal` 的“无移动 Hazard ⇒ applicable:false”路径**：T-47/T-51 只测 `temporalScope`，没有直接测入口。
- **brand 失败 + 无移动 Hazard 的优先级**：没有测试（代码会返回 applicable:true/IE）。
- **两档不一致的生产路径**：stub 对两档都返回 IE，生产路径永远 agreement；只有 `resolveTwoLagResults` 的纯函数测试。
- **coverage.temporal / 顶层聚合**：类型不存在，测试不存在。
- **预算、状态数、墙钟、确定性重复、网格规则**：无。
- **A–J 场景**：无。
- **`verifyTemporalInput` 的 PNG/图片几何、`frame` 矩形的边界一致性**：无（T-10 反向证明不参与）。
- **跨 locale 的排序确定性**：无；代码用 `localeCompare`（`temporal-input.ts:96,150,277`、`temporal.ts:63`），测试只用同一比较器复算，无法发现跨环境差异。

---

## 7. 语料与 `perf-probe.mjs`

### 7.1 21 configs / 19 moving 的口径

- `inventory.md:24-31`：`uniqueHorizontalConfigs = 21`；`inventory.json.counts.uniqueHorizontalConfigs = 21`。
- 口径（`inventory.md:17-22`）：`parseOk ∧ format === "game-config/v1" ∧ unique by contentHash`。
- 本次只读重算（`python3 -I`，读 `inventory.json` 的 `configs[]` 及其 `path`）：
  - 21 个 unique contentHash 的横向 config；
  - 31 个 `kind:"hazard"`；
  - 19 个带 `motion`；
  - 19/19 为 `axis:"x"`、`kind:"cycle"`；
  - 16 个 config 含至少一个移动 hazard；
  - worldWidth min 480 / p50 1440 / max 1920；
  - distance min 40 / p50 120 / max 200；
  - periodMs min 2500 / p50 3000 / max 4000；
  - hazard 往返速度（`2*distance/periodMs`）min 0.0267 / p50 0.0686 / max 0.1385 px/ms。
- 与 I-00 证据一致：`.scratch/level-playability-v1.1-integration/evidence/06-performance.md:39`（21 configs / 31 hazards / 19 moving）、`:71`、`:74`。

### 7.2 I-00 `perf-probe.mjs` 是否可直接复用

**不能原样直接复用为 I-02 性能证据。** 事实：

- 它 `import` 的是 P0 原型 `.scratch/level-playability-v1.1-p0/prototype/temporal-model.mjs`（`perf-probe.mjs:37-38`），不是 I-02 的连续时间实现。
- 它使用 P0 的离散配置形状：`phaseSteps: 200`、`xStep: 2`、`lagMs: 16.67`、`maxStates: 200000`、`timeBudgetMs: 5000`（`:363-364`），并硬编码 `assumptions.verticalEvasionImpossible: false`（`:180`、`:363`）。
- 它硬编码 I-00 的语料断言 `uniqueConfigs === 21 && movingHazards === 19`（`:610-611`）；I-02 若语料或口径变化会直接失败。
- 输出目录由 `--out` 指定（`perf-probe.mjs:41`、`:48`），可以指向本 effort 的 `evidence/`，因此**写入边界可复用**；语料扫描 `corpusScan()`（`:205-327`）和 `runCase()`（`:111` 起）的框架也可复用。
- 但 I-02 需要：替换 `analyze` 为 I-02 连续时间实现；改用 I-02 的输入/预算/结果形状；把 corpus 扫描里的 manifest 几何改为经过 I-01 信任链的帧几何；去掉 P0 断言。结论：**可复用骨架与语料口径，不可直接复用测量结论/断言**。

---

## 8. 现有 fixtures / packs 能否构造 I-02 的 A–J

### 8.1 现有资产与配置事实

- 生产测试唯一真实 pack：`fixtures/packs/last-train/v2`（manifest SHA 见 §0.2）。
- 可用资产尺寸（manifest）：
  - `hazard-sweeping-carriage` animation 64×48，anchor `{0.5,1}`，帧 `sweep1/sweep2`；
  - `player-traveler` animation 32×48，anchor `{0.5,0.95}`；
  - `prop-luggage-pile` sprite 40×40；`prop-awning-steps` sprite 56×32；`pickup-suitcase` sprite 16×16；
  - `signal-endlight` animation 16×40；背景 480×270；HUD 72×32 / 12×12。
- 实体与资产 kind 锁：`hazard` 允许 `sprite` / `animation`（`game-config.ts:62-70`），因此 `prop-luggage-pile` 等现有 sprite 也可作为 hazard（P0 案例 A 已经这么做）。
- `Motion` 只有 `{kind:"cycle", axis:"x"|"y", distance:int>0, periodMs:int>0}`（`game-config.ts:79-85`），**没有 phase 字段**；世界尺寸 `Size` 只要求正整数（`game-config.ts:34-35`），没有上限。
- 现有生产测试 fixture 已经包含移动 hazard：
  - `playability-mechanic-matrix.json` 的 `wide-patrol`：`carriage` + `motion {x,200,4000}`，期望 IE / `moving-hazard-phase`；
  - `playability-matrix.json` 的 `baseline-last-train`：同样含 `carriage` motion；
  - `fixtures/game-configs/last-train.json` 的 `carriage`：`motion {cycle,x,200,4000}`。
- P0 scratch 案例（非生产 fixture，只读参考）已经用同一 last-train pack 构造了 A/B：
  - `cases/a/game-config.json`：hazard 用 `prop-luggage-pile`，`distance:120, periodMs:4000`；
  - `cases/b/game-config.json`：hazard 用 `hazard-sweeping-carriage`，`distance:20, periodMs:2000`；
  - `cases/b/analyzer-input-lag16.67ms.json` 用 `assumptions.verticalEvasionImpossible:true`。**I-00 §7/§117 明确不接受调用方该标记**；P0 案例不能原样作为 I-02 B 的证据。

### 8.2 A–J 可构造性（只登记，不裁定）

| 场景 | 用现有 `last-train/v2` + 内存 config 可构造 | 需要新 pack/asset 吗 | 当前代码阻碍 |
| --- | --- | --- | --- |
| A 安全等待窗口后通过 | 是。config-only；P0 案例 A 已示范 | 否 | 无真实 analyzer/witness |
| B 永久封锁门 + 无垂直规避 | 是。hazard 64×48、distance 20 可产生正宽度门（P0 案例 B）；可用 terrain 约束垂直通道 | 否（若要更大/更高的 hazard 则需要新帧/资产） | 无永久门证明；graph cut 未接入；`verticalEvasionImpossible` 不被 I-00 接受 |
| C 证据不足 | 是。可用未验证/缺失帧、Y 轴、多移动、非法 lag、预算等 | 否 | 真实 analyzer 未实现；预算未实现 |
| D 折返点临界碰撞 | 是。config-only；三角波折返是纯数学 | 否 | 无连续时间求交 |
| E 等待阶段碰撞 | 是。config-only；让 hazard 扫过等待位置 | 否 | 无 witness 验证 |
| F 周期内短暂安全窗口 | 是。调 `distance` / `periodMs` | 否 | 无完整周期分析 |
| G 存在垂直规避路径 | 是。terrain + 现有 solid（`prop-awning-steps` / `prop-luggage-pile`）可搭高低路线 | 否 | 无图割与连续时间门证明的联合 |
| H 搜索预算超限 | 是。世界尺寸无 schema 上限；可用大 world / 多相位 | 否 | 预算参数、计数、超时机制均不存在 |
| I 两档 lag 不一致 | 仅在测试注入 `TemporalAnalyzer` 时可构造；生产 stub 两档恒同 IE | 否 | 真实算法未实现；T-58 把生产 analyze 钉死为 stub |
| J 相同输入重复运行一致 | 是。纯函数 / 重复调用即可 | 否 | 真实算法未实现 |

**结论（事实层）**：A–J 的**数据形状**都可由现有 pack 资产 + 内存 config/terrain 表达，没有哪一类在 schema 上强制要求新 pack。只有在需要现有资产之外的 hazard 尺寸/帧锚点/帧变体时，才需要新增 `fixtures/packs/**`；I-00 把 `fixtures/packs/**` 列为「需单独裁定」（`docs/v7.8/移动-I00.md:167`）。注意：即使不需要新 pack，A–J 也需要新增测试夹具（`packages/contracts/tests/fixtures/playability-*.json` 只增）或测试内构造器；并且 B/G/H/I 还依赖尚未实现的 I-02 算法/预算/图割。

---

## 9. 与 I-00 冻结条文或 I-02 需求文档不一致的代码事实（只登记，不裁定）

> 以下每一条都只记录「代码事实 vs 冻结文字」。**不做取舍、不提修改方案。**

### C-01 Hazard frame 几何恒为 `partial`，与 I-00 §7.2「全部参与判定的几何 checked」冲突

- I-00 `:98-99`：`PROVEN_UNPLAYABLE` 条件 2 =「全部参与判定的几何 `checked`；Hazard 帧几何通过 §3.1 信任链」。
- 代码：`profile.ts:49-58` 把 `hazard` 定为 `"frame"`；`runtimeEntityGeometry` 对 frame 恒返回 `coverage:"partial"`（`profile.ts:97`）；`runtimePlayerGeometry` 恒 partial（`:113`）；`mechanic.ts:125-127` 也在静态 hazard 上置 partial；base graph 初值取玩家 coverage（`graph.ts:97`），所以 graph 也恒 partial。
- 关键事实：`runtimeEntityGeometry` 不接收 `TrustedAtlasInput`，`verifyTemporalInput` 的逐帧证明不会改变 coverage。I-00 信任链与现有 coverage 规则之间缺少接线。

### C-02 `coverage.temporal` 与 evidence 扩展字段不存在；I-00 要求新增，I-02 §8.2 又默认禁止改公共 Contract

- I-00 `:61-64`：新增 `coverage.temporal` 与 `PlayabilityEvidence` 可选 `model/lag/degradation/limits`；`:121-125` 定义 temporal coverage 与机制层检查。
- I-02 `:322-333`：未经单独审批不得修改公共 Contract / 持久化 Verdict。
- 代码：`PlayabilityCoverage` 只有 `spatial/mechanic/completion`（`verdict.ts:33-37`）；`PlayabilityEvidence` 没有 `model/lag/degradation/limits`（`:74-86`）；`TemporalAuditResult` 只有 `applicable/verdict/degradation`（`temporal.ts:31-37`）；全仓 `src` 中没有 `coverage.temporal`（本次 grep 仅命中 `api.ts` 的 temporal 类型转出）。

### C-03 机制层对移动 Hazard 无条件产 gap，未检查 `coverage.temporal`

- I-00 `:123`：移动 Hazard 的机制判定必须检查 `coverage.temporal`，非 `checked` ⇒ 机制层 IE，`checked` 才进入时序判定。
- 代码：`mechanic.ts:119` 只要存在移动 Hazard 就 `addGap("moving-hazard-phase")`，并把 `mechanic` 置 partial（`:84-87`）；没有 `coverage.temporal` 概念。
- I-02 `:375` 把该 gap 的消解列为 I-03 范围。因此这是**预期未接线**，但代码事实与 I-00 §8.3 的最终要求不一致。

### C-04 入口签名缺少 I-00 要求的 motion 校验、`T_arr`、`FixedRuntimeProfile` 与相位输入

- I-00 `:52`：Hazard 运动描述须校验 `cycle` / `x` / `distance>0` / `periodMs>0`，失败 IE；`:55`：`T_arr` 可选；`:54`：`FixedRuntimeProfile` 必填；`:72`：相位当自由变量。
- I-02 `:91-95`：I02-01 输入要求「运动区间、速度、周期及相位信息」「玩家碰撞体和合法移动范围」「Runtime 所需的碰撞体与边界参数」。
- 代码：`TemporalAnalyzer` 入参只有 `config/manifest/lagMs/trustedInput`（`temporal.ts:39-44`）；没有 `T_arr`、没有 phase、没有 profile、没有显式运动校验。`Motion` schema 允许 `axis:"y"`（`game-config.ts:79-85`），并未在入口拒绝；`temporalScope` 对 Y 轴/多移动也返回 `applicable:true`（`temporal.ts:60`），把降级留给 analyzer/stub。
- 事实：相位信息在当前 config 中不存在（`Motion` 无 phase 字段）；运行时 `t0 = 0`（`packages/demo/src/shell/scene.ts:161`）与 I-00「相位自由」不是同一层语义。

### C-05 没有统一的 gate ε；现有 ε 只是 anchor 相等容差

- I-00 `:89-92`：门宽 `R−L > ε`；单一具名常量 `ε = max(1e-9, 1e-9 × (xMax − xMin))`，只在一处定义；`overlapsStrict` 同义「贴着不算撞」。
- I-02 `:103-104`：AABB 相交语义必须固定；`epsilon` 必须集中定义。
- 代码：`ANCHOR_EQUAL_EPSILON = 1e-9` 仅用于 anchor 相等（`temporal-input.ts:28,236-237`）；`geometry.ts:14-19` 的 `overlapsStrict` / `overlapsInclusive` 是精确浮点比较，没有 ε；不存在 gate ε 常量，也没有连续时间求交实现。

### C-06 运行时三角波在 `packages/demo/**`（I-00 禁止修改），contracts 没有对应运动函数

- I-00 `:70-74`：单 X 轴、`cycle`、`t=0` 在 `at`、`t=P/2` 折返、两端不停留；`:145-167` 白名单禁止 `packages/demo/**`。
- 运行时实现：`packages/demo/src/hazard.ts:14-19`（`hazardAnchor`，三角波、`periodMs` 为往返周期、取模支持负/大于周期）；`scene.ts:270-280` 每帧累加 `t0`，初值 `0`（`:161`）。
- 代码事实：contracts 的 `playability/**` 没有任何 hazard 位置/三角波函数；`temporal.ts` 不引用 `hazardAnchor`。`packages/demo` 依赖 contracts（`packages/demo/package.json`），反向导入不可行。I-02 若要在 contracts 中实现运动模型，必然与 demo 的 `hazardAnchor` 形成两份实现（或需要另行裁定共享方式）。
- 另：运行时 `t0=0` 与 I-00「相位自由」的关系、以及 `lagMs` 的相位滞后如何在该实现上定义，代码中没有接线。

### C-07 hop 采样固定，`hop doubling` 无法在不改 `graph.ts` 的情况下验证

- I-00 `:101`：PU 条件 4「hop 采样加倍不变性」；`:167` 把 `graph.ts`（hop 采样参数化）列入「需单独裁定」。
- I-02 `:176`、`:283`：hop 加倍反例；`hopDoubling` 推翻原证明必须失效。
- 代码：`hopSamples` 的 `n` 固定为 `max(6,min(120,ceil(t*60)))`（`graph.ts:237`），坐标 `Math.round`（`:242-243`）；没有采样密度参数、没有第二种采样策略、没有加倍对比 API。要落 I-02 的加倍不变性检查，必须在 `graph.ts` 外复制一份 hop 采样或改 `graph.ts`（后者属「需单独裁定」）。

### C-08 预算常量与计数/超时机制不存在

- I-00 `:171-173`：默认 `maxStates=500_000`、`timeBudgetMs=2_000`，硬上限 1M / 10s；常量写在机制层模块级；超限逐层降级 + `coverage.temporal=partial`。
- I-02 `:192-197`、`:199-222`：预算、计量口径、网格规则、超限 IE。
- 代码：`temporal.ts` 只有 `TEMPORAL_LAG_MS` / `TEMPORAL_LAG_BASELINE_MS`（`:26,29`）；`mechanic.ts` 只有 `FRAME_MARGIN_MS` / `minHazardThickness`（`:61-65`）；`completion.ts` 有 `EDGE_BUDGET = 40_000_000`（`:69`），但不是时序预算；不存在 `maxStates` / `timeBudgetMs` / 超时计数 / 预算降级路径。

### C-09 现有架构测试把生产 `analyze` 钉死为 `stubTemporalAnalyzer`

- `playability-temporal-input.test.ts:589-596`（T-58）：生产代码中 `analyze:` 的唯一实参必须是 `stubTemporalAnalyzer`；`:612-615`（T-61）钉死三处调用。
- 代码：`ops.ts:1039` 确实传 `stubTemporalAnalyzer`。
- I-00 `:157` 规定 `packages/contracts/tests/playability-*.test.ts`「只增不改」；`:184` 规定不得删除/放宽既有断言。I-02 `:316-318` 允许增加内部算法能力但不得提前完成 I-03 生产接入。
- 事实：I-02 的真实分析器即使实现，也不能在 `runTemporalAudit` 中替换 stub（会立刻触发 T-58）；未来 I-03 接线时必须修改该既有断言，而这与「只增不改」存在张力。登记，不裁定。

### C-10 `TemporalAuditResult` 无法承载 I-02 的 witness / proof / stats / diagnostics

- I-00 `:129-131` 允许 `PlayabilityEvidence` 增加 `model/lag/degradation/limits`；I-02 `:299-308` 要求交付连续时间算法、witness、永久门、图割、预算与诊断。
- 代码：`TemporalAuditResult` 只有 `applicable` / `verdict` / `degradation`（`temporal.ts:31-37`）；`TemporalAnalyzer` 没有 stats/proof/witness 出口（`:39-44`）。内部结果只能藏在闭包里或另建类型；若经 `api.ts` 转出则公共面扩大（`api.ts:126-138`）。
- 地图 `Not yet specified` 已把「能否不改签名承载 proof/stats/diagnostics」列为 D9 待裁定；此处只登记代码事实。

### C-11 I-02 §1 的「逐帧几何验证」比代码实际保证的范围更宽

- I-02 `:19-20`：I-01「Atlas 文件读取、哈希校验、解析使用同一份字节」；「逐帧几何验证覆盖 `sourceSize`、`anchor`、`rotated`、`trimmed`」——这两句与代码一致。
- 但 I-00 `:87` 还要求「须由 I-01 补一条 Phaser overlap 的直接证据；若推翻，改的是 Runtime 语义基线」。代码/测试中没有 Phaser overlap 直接证据；`verifyTemporalInput` 只验证 JSON 元数据与 manifest 的相等，不验证 PNG 或 Runtime 实际碰撞体（见 §2.3）。
- 事实：I-02 若把「已验证逐帧几何」读成「Runtime hitbox 已证明」，会超出 I-01 实际提供的能力。

### C-12 `localeCompare` 排序与 I-02 的跨环境确定性要求存在潜在张力

- I-02 `:207`（I02-05 功能要求 7）与 `:350`（AC-10）：相同输入重复运行结果确定。
- 代码：`temporalScope` 的 `assetIds` 排序（`temporal.ts:63`）、失败列表排序（`temporal-input.ts:96`）、文件列表排序（`:150,277`）都用 `String.prototype.localeCompare`（无显式 locale）。该比较依赖运行时默认 locale，跨环境可能产生不同顺序；现有测试只按同一比较器复算，无法发现跨 locale 差异。
- 事实：排序差异通常只影响诊断顺序/文件顺序，不直接改变 verdict；但 I-02 的「确定性」口径需要显式覆盖此点（登记，不裁定）。

### C-13 P0 的 `verticalEvasionImpossible` 声明与 I-00 的拒绝条款直接冲突

- I-00 `:100-102`、`:116-117`：PU 需要含 hop 边的图上不连通；「调用方的 `verticalEvasionImpossible` 标记一律不接受」。
- I-02 `:71`、`:155`：无法排除垂直规避 ⇒ IE；永久封锁证明必须与垂直规避分析共同满足。
- 代码：`TemporalAnalyzer` 没有 `assumptions` / `verticalEvasionImpossible` 参数（`temporal.ts:39-44`），与 I-00 一致；但 P0 原型和 P0 案例 B 仍以该声明作为 PU 前提（`.scratch/level-playability-v1.1-p0/prototype/MODEL.md:86`、`cases/b/analyzer-input-lag16.67ms.json`）。I-02 不能复用 P0 的 B 结论，必须用图割；当前代码没有图割接线。

### C-14 I-02 §8.2「不得修改 V1 既有空间/机制/完成性判定语义」与 I-03 的 gap 消解边界

- I-02 `:328` 禁止改变 V1 既有空间、机制、完成性判定语义；`:329` 禁止把 I-02 结果直接接入最终生产 Verdict；`:375` 把 `moving-hazard-phase` gap 消解、`coverage.temporal`、顶层聚合列为 I-03。
- 代码事实：`mechanic.ts:119` 的 gap 与 `api.ts:86-92` 的整关 IE 是当前 V1 语义的一部分；`mechanic.ts` / `api.ts` 在 I-00 白名单内，但 I-02 不能改。I-02 的算法结果必须停留在内部，无法通过现有机制层/Verdict 出口表达。登记。

---

## 10. 限制与复现

### 10.1 限制

- 本票只读源码与文档，**没有**运行 I-02 算法（不存在）；`pnpm test` 只证明 I-01 及既有 V1 测试全绿，不证明 I-02 能力。
- 语料重算使用 `python3 -I` 直接读 `inventory.json` 与其 `configs[].path`；`inventory.json` 生成于 `main @ fa17c14`（`inventory.md:5`），不是当前 HEAD；本票只核对计数，未重跑 `06-inventory.mjs`。
- 未运行 `perf-probe.mjs`（它会写 `--out` 目录并依赖 P0 原型）；只做静态复用性分析。若后续要引用性能数字，应把 `--out` 指向本 effort 的 `evidence/` 并记录模型 SHA（`perf-probe.mjs:37-38,692`）。
- 未运行 `pnpm check`（`tsc -b` + deps/links）；本票不涉及类型/构建变更。
- 测试全量运行出现 2 条 Vitest worker `onTaskUpdate` 超时；`pnpm test` 退出码 0，`vitest.config.ts:13` 已显式忽略。这是 runner 现象，不是产品断言失败。
- `docs/v7.8/移动-200.md` 当前是未跟踪文件（`git status` 显示 `??`），其 SHA 已记录；I-00 文档为已跟踪/冻结文件。

### 10.2 复现要点

```bash
cd /Volumes/shy/some-projects/game-maker
git rev-parse HEAD
pnpm test
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts
pnpm exec vitest run packages/contracts/tests/playability-api.test.ts \
  packages/contracts/tests/playability-completion.test.ts \
  packages/contracts/tests/playability-geometry.test.ts \
  packages/contracts/tests/playability-graph.test.ts \
  packages/contracts/tests/playability-mechanic.test.ts \
  packages/contracts/tests/playability-spatial.test.ts \
  packages/contracts/tests/playability-temporal-input.test.ts
python3 -I - <<'PY'
import json, os
root = "/Volumes/shy/some-projects/game-maker"
d = json.load(open(os.path.join(root, ".scratch/level-playability-v1/corpus/inventory.json")))
uniq = {}
for c in d["configs"]:
    if not c.get("parseOk"): continue
    try: o = json.load(open(os.path.join(root, c["path"])))
    except Exception: continue
    if o.get("format") != "game-config/v1": continue
    uniq.setdefault(c["contentHash"], (c, o))
haz = mov = 0
for _, o in uniq.values():
    for e in o.get("entities", []):
        if e.get("kind") == "hazard":
            haz += 1
            mov += bool(e.get("motion"))
print(len(uniq), haz, mov)  # 21 31 19
PY
git diff --stat -- packages docs fixtures   # 应为空
```

### 10.3 产品目录

**修改产品目录：否。** 本票只新增本证据文件；`packages/**`、`docs/**`、`fixtures/**` 均未修改（`git diff --stat -- packages docs fixtures` 为空）。
