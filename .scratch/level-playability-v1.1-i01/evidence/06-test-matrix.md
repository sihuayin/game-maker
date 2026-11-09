# I01-06 测试矩阵与证据要求

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I01-06](../issues/06-i01-06-test-matrix.md) |
| 依据 | [I01-02 可信输入](02-trusted-input-contract.md)、[I01-03 几何判据](03-frame-geometry-predicate.md)、[I01-04 双档编排](04-lag-orchestration.md)、[I01-05 接线](05-call-site-wiring.md)、[`移动-I01-需求.md`](../../../docs/v7.8/移动-I01-需求.md) §2.3 / §3 / §5、I-00 §11 / G-01 / G-02 |
| 性质 | **测试设计，不是实施授权**；授权在 [I01-R1](../issues/08-i01-r1-authorization.md) |
| 修改产品目录 | **否** |

## 0. 结论摘要

- **唯一新增测试文件**：`packages/contracts/tests/playability-temporal-input.test.ts`（§11 允许 `playability-*.test.ts` 只增不改）。既有测试**零改动**，包括 `playability-api.test.ts` / `config-audit.test.ts` / `publish-gate.test.ts`。
- **夹具零新增**：正向用真包 `fixtures/packs/last-train/v2` 只读；负向在内存里改 JSON，并**把 `files[]` 重绑到改后字节的真实 sha256**，确保触达目标失败码而不是一律 `atlas-checksum-mismatch`；TOCTOU 用 `mkdtempSync(os.tmpdir())` 的临时副本。不写 `fixtures/packs/**`。
- **非空洞的核心**：负向用例要求 `ok === false` + 精确失败码；正向用例要求精确帧集合 / 文件集合。另加两组**阳性对照**（真实 brand + 注入 analyzer 返回 `NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE`），专门堵住「入口恒返回 IE」也能让伪造声明用例变绿的假阳性。
- **架构测试**：contracts 源码无 `node:fs` / `node:crypto`；`verifyTemporalInput` / `auditPlayabilityTemporal` 的生产调用者只允许 `assets/src/ops.ts`；生产 `analyze` 只允许 `stubTemporalAnalyzer`；`runTemporalAudit` 在三处生产文件各出现一次；常量唯一；`runTemporalAudit` 同步。
- **两条必须写进授权包的残余限制**：
  1. 生产读取器 `readTrustedAtlasInput` 住在 assets 且模块私有，白名单没有 assets 测试位，contracts 又不能 import assets ⇒ **文件 I/O 没有独立 vitest 断言**；只能由类型形状、纯函数同字节测试、架构扫描、集成零行为变化共同约束。
  2. 三处生产接线按 Q8=A **丢弃结果**，因此「已消费」只能在结构上证明（源码扫描 + 非回归），不能在运行时观察。
- **语料复跑**：`acceptance-corpus.mjs` / `acceptance-matrix.mjs` 是 scratch 脚本，不是 vitest；基线 96 配对 `36/36/24`、矩阵 `19/9/11`、零新增误报、零容差。

## 1. 测试文件与夹具

### 1.1 文件

`packages/contracts/tests/playability-temporal-input.test.ts`

- 直接 import 内部模块（与既有 `playability-*.test.ts` 惯例一致）：
  - `../src/playability/temporal-input.js`：`verifyTemporalInput` / `isTrustedAtlasInput` / 失败码类型
  - `../src/playability/temporal.js`：`auditPlayabilityTemporal` / `resolveTwoLagResults` / `stubTemporalAnalyzer` / `temporalScope` / `TEMPORAL_LAG_MS` / `TEMPORAL_LAG_BASELINE_MS`
  - `../src/game-config.js` / `../src/assetpack.js`：`parseGameConfig` / `parseAssetPack`
- 测试文件可以用 `node:fs` / `node:crypto`（既有 contracts 测试已经这么做）；**架构测试只扫描 `packages/contracts/src/**`**，不扫描 `tests/**`。

### 1.2 夹具策略

| 用途 | 来源 | 写法 |
| --- | --- | --- |
| 正向 manifest | `fixtures/packs/last-train/v2/manifest.json` | **只读**；`parseAssetPack` |
| 正向 atlas 字节 | `delivery/atlas.animations.json`、`delivery/atlas.sprites.json` | **只读**；`readFileSync` 成 `Uint8Array` |
| 正向 config | `fixtures/game-configs/last-train.json` | **只读**；`parseGameConfig` |
| 负向字节 | 上述 JSON 的内存副本 | `JSON.parse` → 改 → `JSON.stringify` → `Buffer.from` |
| 负向 manifest | 上述 manifest 的内存副本 | 把对应 `files[].checksum` 改成改后字节的真实 sha256，再 `parseAssetPack` |
| TOCTOU / 文件替换 | `fs.mkdtempSync(path.join(os.tmpdir(), "gm-temporal-"))` | 写副本、读、替换、再读；`afterAll` 清理 |
| 适用性变体 | 正向 config 的 `structuredClone` | 增删 `motion`、改 `axis`、复制 hazard、加 solid/danger/chest/decor |

**为什么负向要重绑 `files[]`**：`verifyTemporalInput` 先比 checksum、再解析、再验几何。若只改 JSON 不重绑 `files[]`，所有负向都会先撞 `atlas-checksum-mismatch`，几何失败码永远得不到执行 —— 测试会「全绿」但假。重绑后，checksum 通过，失败只可能来自目标判据。

**为什么不需要新增仓库夹具**：所有负向都能从真包的内存在改；没有一种需要新 `fixtures/packs/**` 或 `fixtures/contracts/tests/fixtures/playability-*.json`。若实施时发现某条用例必须新增仓库夹具 ⇒ **STOP → I-00 R2**，不得顺手加。

### 1.3 真包的关键期望值（写死进断言，作为正例基线）

- `temporalScope(last-train)`：
  - `applicable === true`（唯一移动实体 `carriage`，`kind:"hazard"`、`motion.axis:"x"`、`distance:200`、`periodMs:4000`）。
  - `assetIds`（排序后）`["hazard-sweeping-carriage", "pickup-suitcase", "player-traveler", "signal-endlight"]`。
- `verifyTemporalInput` 正例：
  - `frames` 15 条：player 8 + hazard 2 + pickup 1 + goal 4。
  - `assets` 4 个；`files` 2 条，路径 `delivery/atlas.animations.json` / `delivery/atlas.sprites.json`，checksum 与 manifest `files[]` 一致。
  - player 帧 anchor `{x:0.5,y:0.95}`；hazard / pickup / goal anchor `{x:0.5,y:1}`。
  - 每帧 `sourceSize == asset.size`；`rotated === false`、`trimmed === false`。

## 2. 用例矩阵

> 列说明：「非空洞」= 如果新通道是空转 / 被旁路，这条为什么会红。所有负向都断言**精确失败码**，不只断言 `ok:false`。

### A. 正向与验证范围（G-01）

| ID | 场景 | 构造 | 断言 | 非空洞 |
| --- | --- | --- | --- | --- |
| T-01 | 正常 Atlas 读取 + SHA | 真包 manifest + 2 个 atlas 字节 + 真实 sha256 digest | `ok:true`；`frames` 15、`assets` 4、`files` 2；帧键 `assetId/frameName`；player anchor `{0.5,0.95}` | `verifyTemporalInput` 若恒返回 ok 空值，帧 / 文件数量与键名断言失败 |
| T-02 | 范围只含 player + 引用 hazard/pickup/goal | 同上 | `assets` 恰为 4 个；background / UI / 未引用 `prop-*` 不在 `frames` / `assets` | 若把整包资产都塞进来，`assets.size` 与帧数变大 ⇒ 红 |
| T-03 | 多资产共用 atlas 去重 | player + hazard + goal 都在 `animations` | `files` 只有 `animations` 一条（加 `sprites` 共 2） | 若按资产逐条记文件，`sprites` 之外会多出重复 `animations` ⇒ 红 |
| T-04 | 未引用资产损坏不影响 | 改坏 / 删除 `backgrounds` 或 `ui` atlas 的字节并重绑 `files[]` | `ok:true` | 若验证范围误扩到整包，会报失败 ⇒ 红 |
| T-05 | 引用资产缺失 | `assetIds` 追加 `"ghost-asset"` | `ok:false` + `asset-unverified` | 若静默跳过未知资产，`ok` 为 true ⇒ 红 |

### B. 文件、checksum 与 schema（G-01）

| ID | 场景 | 构造 | 断言 | 非空洞 |
| --- | --- | --- | --- | --- |
| T-06 | 文件缺失 | `atlases` 省略 `delivery/atlas.animations.json` | `ok:false` + `atlas-file-missing`，`atlasPath` 为该路径 | 若缺文件被当作「没有几何需求」，会 ok ⇒ 红 |
| T-07 | SHA 不符 | 原字节 + digest 返回另一个合法 checksum | `ok:false` + `atlas-checksum-mismatch` | 若跳过对比，ok ⇒ 红 |
| T-08 | JSON 无效 | 非 JSON 字节 + 重绑 `files[]` | `ok:false` + `atlas-json-invalid` | 若 `JSON.parse` 失败被吞成 ok ⇒ 红 |
| T-09 | 顶层多余字段 | 有效 JSON + 未知顶层键 + 重绑 `files[]` | `ok:false` + `atlas-json-invalid`（`AtlasJson` 严格） | 若用宽松解析，ok ⇒ 红 |
| T-10 | PNG checksum 不参与 JSON 校验 | 改 `manifest.atlases[].checksum`（PNG），`files[]` 不动 | `ok:true` | 若误用 `AtlasEntry.checksum` 校验 JSON，会 checksum-mismatch ⇒ 红 |
| T-11 | 同一路径两份不同字节 | `atlases` 重复 `animations`，字节不同 | `ok:false` + `atlas-checksum-mismatch` | 若取第一条 / 最后一条，ok ⇒ 红 |
| T-12 | `meta` 路径逃逸 | 原 manifest 副本把 `meta` 改成 `../atlas.json` | `parseAssetPack` 拒绝（`PackPath`） | 若跳过了 manifest schema，逃逸路径会进读取器 ⇒ 红 |

### C. 逐帧几何（G-01）

| ID | 场景 | 构造 | 断言 | 非空洞 |
| --- | --- | --- | --- | --- |
| T-13 | 帧缺失 | 从 `animations.frames` 删 `hazard-sweeping-carriage.sweep2` + 重绑 | `ok:false` + `frame-missing`，带 `assetId` / `frameName` | 若只验「有动画」不验帧名，ok ⇒ 红 |
| T-14 | `sourceSize` 不符（单帧） | `pickup-suitcase` 的 `sourceSize.w` +1 + 重绑 | `frame-source-size-mismatch` | 若只比 manifest 标称值、不读帧，ok ⇒ 红 |
| T-15 | `sourceSize` 不符（多帧第 2 帧） | `sweep2.sourceSize.h` +1 + 重绑 | `frame-source-size-mismatch`，`frameName` 为 `sweep2` | 若只验第 0 帧（manifest `size` 的来源），ok ⇒ 红 |
| T-16 | `anchor` 缺失 | 删 `player-traveler.idle1.anchor` + 重绑 | `frame-anchor-missing` | 若回落到 `FALLBACK_ANCHOR`，ok ⇒ 红 |
| T-17 | `anchor` 不符 | `idle1.anchor.x` +0.01 + 重绑 | `frame-anchor-mismatch` | 若只信 manifest anchor、不读帧，ok ⇒ 红 |
| T-18 | `anchor` 容差内 | `idle1.anchor.x` +5e-10 | `ok:true` | 若把任何浮点差异都判失败，红（过严） |
| T-19 | `anchor` 容差外 | `idle1.anchor.x` +2e-9 | `frame-anchor-mismatch` | 若无容差、精确相等，5e-10 也会红；若容差过大，2e-9 会绿 ⇒ 两边夹住 |
| T-20 | `rotated: true` | `idle1.rotated = true` + 重绑 | `frame-rotated-unsupported` | 若忽略 rotated，ok ⇒ 红 |
| T-21 | `trimmed: true` | `idle1.trimmed = true` + 重绑 | `frame-trimmed-unsupported` | 若忽略 trimmed，ok ⇒ 红 |
| T-22 | `rotated` / `trimmed` 省略 | 删除两键 + 重绑 | `ok:true`（schema 默认 `false`） | 若把缺失当非法，红（过严） |

### D. 累积、去重与全有或全无（G-01）

| ID | 场景 | 构造 | 断言 | 非空洞 |
| --- | --- | --- | --- | --- |
| T-23 | 多失败累积 | 同时：`sweep2` 尺寸 +1、删 `pickup-suitcase` 帧、`signal-endlight.red1` anchor 错 | 精确 3 条失败；按 `(code, atlasPath, assetId, frameName)` 稳定排序；无重复 | 若首错即停，只有 1 条 ⇒ 红；若按对象键序，顺序不稳定 ⇒ 红 |
| T-24 | 全有或全无 | T-23 的结果 | `!("value" in result)`；没有可消费的 `frames` / `assets` / `files` | 若返回「部分可信几何」，会存在 `value` ⇒ 红 |
| T-25 | 重复失败去重 | 同一帧同时 `sourceSize` 错和 `anchor` 错 | 两个不同 code 各一条；同一 `(code, atlasPath, assetId, frameName)` 不重复 | 若按帧名只留一条，会少一个 code ⇒ 红 |

### E. TOCTOU 与纯函数边界（G-01）

| ID | 场景 | 构造 | 断言 | 非空洞 |
| --- | --- | --- | --- | --- |
| T-26 | digest 与解析同一份字节 | digest spy 记录实参 | digest 收到的对象 `===` `atlases[i].bytes`；每个唯一路径只调用一次 | 若函数二次读盘 / 复制字节，身份或次数不等 ⇒ 红 |
| T-27 | 不访问磁盘 | `atlases[].path` 指向一个不存在的路径，但提供匹配字节 | `ok:true` | 若函数按 path 读盘，直接抛 / 失败 ⇒ 红 |
| T-28 | 文件替换（旧字节） | 临时副本：读字节 A → 磁盘替换为 B → 用 A + digest(A) 验证 | `ok:true`；几何来自 A | 若验证时重新读盘，会得到 B ⇒ 红 |
| T-29 | 文件替换（新字节 + 旧 digest） | 用 B + digest(A) 验证 | `atlas-checksum-mismatch` | 若按 path 重读并重算 digest，B 会自洽 ⇒ 绿（假） |

### F. brand 与伪造声明（G-01 / 需求 §2.3）

| ID | 场景 | 构造 | 断言 | 非空洞 |
| --- | --- | --- | --- | --- |
| T-30 | 普通对象冒充 | 形状完整的 plain object | `isTrustedAtlasInput(fake) === false` | 若只做形状检查，true ⇒ 红 |
| T-31 | 同名 Symbol 冒充 | 对象带 `Symbol("trusted")` / `Symbol.for("trusted")` | `false` | 若 brand 用 `Symbol.for` 或字符串键，true ⇒ 红 |
| T-32 | 克隆丢失 brand | `structuredClone(branded)` | `false` | 若 brand 是普通属性，克隆后仍为 true ⇒ 红 |
| T-33 | 真 brand | `verifyTemporalInput` 正例返回值 | `isTrustedAtlasInput(value) === true` | 若守卫恒 false，正例入口全部失败 ⇒ 红 |
| T-34 | 伪造 hitbox / body / 尺寸 / 垂直规避 | plain object 额外带 `hitbox`、`body`、`size`、`verticalEvasionImpossible:true`；`auditPlayabilityTemporal` 传入 | 返回 `INSUFFICIENT_EVIDENCE`；**analyzer spy 一次都没被调用** | 若入口接受无 brand 对象，spy 会被调用 ⇒ 红；若入口接受几何覆盖，可能得到确定性结论 ⇒ 红 |
| T-35 | 阳性对照：入口真的会派发 | 真 brand + spy analyzer 返回 `PROVEN_UNPLAYABLE` | 入口返回 `PROVEN_UNPLAYABLE` | 若入口恒返回 IE，红。**这条专门堵住「移动 Hazard 本来就是 IE」的假绿** |
| T-36 | 阳性对照：另一档 | 真 brand + spy 返回 `NO_PROVEN_BLOCKER` | 入口返回 `NO_PROVEN_BLOCKER` | 同上；证明 T-34 的 IE 不是常量 |

### G. `lagMs` 与两档降级（G-02 / 需求 §2.2）

| ID | 场景 | 构造 | 断言 | 非空洞 |
| --- | --- | --- | --- | --- |
| T-37 | `lagMs` 运行时缺失 | `undefined`（cast） | `applicable:true` + `verdict:"INSUFFICIENT_EVIDENCE"` + `degradation:"lag-invalid"` | 若有隐式默认值，会得到正常 verdict ⇒ 红 |
| T-38 | `null` / 字符串 / `NaN` / `±Infinity` / 负数 | 逐项 cast | 同 T-37；`lag-invalid` | 若只查 `typeof number`，`NaN` / `Infinity` / 负数会漏 ⇒ 红 |
| T-39 | `0` 合法 | 真 brand + spy 返回 NB，`lagMs:0` | NB，`degradation` 为 `undefined` | 若把 0 当 falsy 拒绝，红 |
| T-40 | 非法 lag 优先于适用性 | 无移动 Hazard 的 config + `lagMs:NaN` | IE + `lag-invalid`（不是 `applicable:false`） | 若先判适用性，会返回不适用 ⇒ 红 |
| T-41 | 两档都不适用 | 两个 `{applicable:false}` | `{applicable:false}` | 若强行适用，红 |
| T-42 | 一档适用一档不适用 | `{applicable:true,verdict:IE}` / `{applicable:false}` | IE + `lag-disagreement` | 若取任一档，结果会是不适用或裸 IE ⇒ 红 |
| T-43 | 两档 verdict 相同 | 两档 NB；两档 IE | 保留该 verdict；IE 时不加 `lag-disagreement` | 若一律降级，相同 NB 会变 IE ⇒ 红 |
| T-44 | 两档 verdict 不同 | NB vs PU | IE + `lag-disagreement` | 若不做比较，返回 NB 或 PU ⇒ 红 |
| T-45 | `lag-invalid` 优先 | 一档 IE+`lag-invalid`，一档 IE+`lag-disagreement` | IE + `lag-invalid` | 若按后者覆盖，degradation 错 ⇒ 红 |
| T-46 | 只比 verdict | 两档同 verdict，但其它可选字段不同 | 同 verdict，无降级 | 若比较整个对象，会误判分歧 ⇒ 红 |

### H. 适用性与范围（G-01 / G-02）

| ID | 场景 | 构造 | 断言 | 非空洞 |
| --- | --- | --- | --- | --- |
| T-47 | 无移动 Hazard | 删 `carriage.motion` | `temporalScope.applicable === false` | 若按「有 hazard」判适用，true ⇒ 红 |
| T-48 | X 轴移动 Hazard | 真包 | `applicable === true` | 若漏判，false ⇒ 红 |
| T-49 | Y 轴移动 Hazard | `motion.axis:"y"` | `applicable === true`；stub 返回 IE | 若把 Y 轴当不适用，false ⇒ 红 |
| T-50 | 多个移动 Hazard | 复制 `carriage` 为新 id + motion | `applicable === true`；stub 返回 IE | 若只支持单 Hazard 就判不适用，false ⇒ 红 |
| T-51 | 只有静止 Hazard | `motion` 删掉，保留 hazard | `applicable === false` | 若按 kind 判适用，true ⇒ 红 |
| T-52 | 范围排除 | 加 solid / danger / chest / decor 实体，各自引用不同资产 | `assetIds` 不含这些资产；只含 player + hazard/pickup/goal | 若按「所有实体」收集，多出资产 ⇒ 红 |
| T-53 | 去重与稳定排序 | 两个 pickup 共用 `pickup-suitcase` | `assetIds` 恰出现一次；数组等于排序后的期望值 | 若按出现顺序或不去重 ⇒ 红 |
| T-54 | stub 永不 PU / NB | 对 T-48～T-50 的适用输入调用 `stubTemporalAnalyzer` | 一律 `{applicable:true, verdict:"INSUFFICIENT_EVIDENCE"}` | 若 stub 返回 NB/PU，红；若入口没传 stub，T-35/T-36 的正向对照仍绿但架构测试 T-58 红 |

### I. 架构与结构断言（防「第二入口 / 第二读取器」）

> 这些测试用 `readFileSync` 扫描源码（仓库已有先例：`demo/tests/shell-scene-wiring.test.ts`、`qa/tests/assemble.test.ts`）。它们是**结构 tripwire**，不是行为证明；行为证明在 A–H。

| ID | 断言 | 非空洞 |
| --- | --- | --- |
| T-55 | `packages/contracts/src/**/*.ts` 不含 `from "node:fs"` / `"fs"` / `"node:crypto"` / `"crypto"`，也不含 `require(...)` | 若 contracts 引入 Node 内置模块，扫描红；浏览器 bundle 结构被破坏 |
| T-56 | `verifyTemporalInput(` 在 `packages/*/src/**` 只出现在 `temporal-input.ts`（定义）与 `assets/src/ops.ts`（调用） | 若出现第二个生产读取器，红 |
| T-57 | `auditPlayabilityTemporal(` 在 `packages/*/src/**` 只出现在 `temporal.ts`（定义）与 `assets/src/ops.ts`（调用） | 若出现第二入口，红 |
| T-58 | 生产源码里 `analyze:` 的实参只有 `stubTemporalAnalyzer`；`TemporalAnalyzer` 赋值只允许 `stubTemporalAnalyzer`（`temporal.ts`） | 若生产换成别的 analyzer，红 |
| T-59 | `readTrustedAtlasInput` 在 `assets/src/ops.ts` **不是 export** | 若把读取器变成公共入口，红 |
| T-60 | `export function runTemporalAudit` 不带 `async`；`assertPublishableQa` 仍不带 `async` | 若编排器变 async，发布闸被迫改签名 ⇒ 红 |
| T-61 | `runTemporalAudit(` 调用在 `assets/src/ops.ts`、`pipeline/src/create-game.ts`、`pipeline/src/publish-gate.ts` 各至少一次；其他生产文件零次 | 若某处未接线 / 多接一处，红 |
| T-62 | `TEMPORAL_LAG_MS = 16.67`、`TEMPORAL_LAG_BASELINE_MS = 200` 在 `src/**` 各只定义一次；`temporal.ts` 不引用 `FRAME_MARGIN_MS`；`runTemporalAudit` 同时使用两常量 | 若复制常量 / 复用 `FRAME_MARGIN_MS` / 只用一档，红 |
| T-63 | `auditPlayabilityTemporal` 的 `lagMs` 参数无默认值（源码扫描签名） | 若有 `= 16.67` 之类默认值，红 |
| T-64 | brand `Symbol` 只在 `temporal-input.ts` 铸造一次；没有 `mintTrustedAtlasInput` 之类导出 | 若导出铸造工厂，红 |
| T-65 | `verifyTemporalInput` 的入参类型键只有 `manifest` / `assetIds` / `atlases` / `digest`；`auditPlayabilityTemporal` 入参只有 `config` / `manifest` / `{ lagMs, trustedInput, analyze }` | 若出现 `geometry` / `hitbox` / `body` / `size` / `vertical` 参数，红（与 T-34 的行为断言互补） |

## 3. 非空洞论证（汇总）

1. **输入可信度**：T-01 / T-06–T-29 同时断言「正例精确通过」与「反例精确失败码」。如果 `verifyTemporalInput` 是常量 ok，负向全红；如果是常量失败，正向全红。
2. **伪造声明**：T-34 单独不足以证明 —— 因为移动 Hazard 今天已经是 IE，一个恒返回 IE 的入口也能让它绿。T-35 / T-36 用真实 brand + 注入 analyzer 返回 PU / NB，证明入口确实派发；T-34 的 spy「一次都没被调用」才有意义。
3. **两档降级**：T-41–T-46 直接测 `resolveTwoLagResults` 的组合表；T-37–T-40 测入口的 lag 校验顺序。若比较被删、默认值被加、或先判适用性，各自会红。
4. **「已消费」的边界**：三处生产接线按 Q8=A 丢弃结果，所以没有任何运行时断言能观察「结果被消费」。T-61 只证明调用存在；这是结构证明，不是行为证明，必须原样写进 R1。
5. **生产读取器**：T-26–T-29 证明 `verifyTemporalInput` 的纯函数语义（同一字节、不读盘、替换后不追新）；T-55 / T-56 / T-59 证明 contracts 无 I/O、生产只有一个调用者、读取器不导出。生产读取器内部的 `readFileSync` 次数与「同一 Buffer 同时喂 digest 与 parse」**没有独立单元测试**（见 §6 限制）。

## 4. 既有测试与命令

### 4.1 零改动清单

以下文件在 I-01 实施中**一个字符都不改**：

- `packages/contracts/tests/playability-api.test.ts`
- `packages/contracts/tests/config-audit.test.ts`
- `packages/pipeline/tests/publish-gate.test.ts`

说明：I01-05 曾提出「若需要，可在 `publish-gate.test.ts` 只增一条发布闸回归」。本票裁定**不需要**：该文件 `:193` 的 `GOOD_CONFIG = fixtures/game-configs/last-train.json` 自带移动 Hazard `carriage`，既有「可达 config ⇒ 照常放行」用例已经穿过新接线；新增不会提高证明力，反而扩大改动面。

### 4.2 验证命令

```bash
# 新测试文件单独跑
pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts

# 既有三件（零改动，必须全绿）
pnpm exec vitest run \
  packages/contracts/tests/playability-api.test.ts \
  packages/contracts/tests/config-audit.test.ts \
  packages/pipeline/tests/publish-gate.test.ts

# 全仓门
pnpm build
pnpm typecheck
pnpm test
pnpm check:deps
pnpm check:links
```

预期：全部 exit 0；`pnpm test` 的用例总数 = 基线 + 新文件用例数，既有用例数不减少。

### 4.3 范围形状

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD -- 'packages/**/src/**' 'packages/**/tests/**'
```

预期文件集合（实施阶段）：

```
packages/contracts/src/playability/temporal.ts          （新）
packages/contracts/src/playability/temporal-input.ts    （新）
packages/contracts/src/playability/api.ts              （只加导出）
packages/contracts/tests/playability-temporal-input.test.ts （新）
packages/assets/src/ops.ts
packages/pipeline/src/create-game.ts
packages/pipeline/src/publish-gate.ts
```

任何既有测试文件、`config-audit.ts`、`mechanic.ts`、`verdict.ts`、`contracts/src/index.ts`、`fixtures/packs/**` 出现在 diff 中 ⇒ 停止，回 I-00 R2 / I01-07。

## 5. LP-06 / LP-07 语料复跑

这两个是 **scratch 脚本，不是 vitest**；它们直接调 `auditSpatial` / `auditMechanic` / `auditCompletion` 与 `auditPlayability`，不经过 I-01 的新接线。

| 项 | 值 |
| --- | --- |
| 脚本 | `.scratch/level-playability-v1-p1/acceptance-corpus.mjs`、`.scratch/level-playability-v1-p1/acceptance-matrix.mjs` |
| 输入 | `.scratch/level-playability-v1/corpus/inventory.json`（脚本内复算 freeze）；`packages/contracts/tests/fixtures/playability-*.json` |
| 命令 | `pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs`；`pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs` |
| 输出 | `evidence/06-corpus-regression.json`、`evidence/06-matrix-acceptance.json` |
| 语料基线 | 96 唯一配对 / 20 唯一 config / 31 唯一内容组合；`PROVEN_UNPLAYABLE 36` · `INSUFFICIENT_EVIDENCE 36` · `NO_PROVEN_BLOCKER 24` |
| 矩阵基线 | `PROVEN_UNPLAYABLE 19` · `NO_PROVEN_BLOCKER 9` · `INSUFFICIENT_EVIDENCE 11` |
| 新增 playability 误报 | **0** |
| 容差 | **零差异**；任何计数变化按 LP-07 F3 停在裁定点 |

复跑证据要记录：命令、退出码、脚本内 freeze 复算结果、两个 JSON 的路径与计数；不需要把 JSON 贴进授权包（引用路径即可）。

## 6. 残余限制（必须写进 R1 授权包）

1. **生产读取器没有独立单元测试**。`readTrustedAtlasInput` 在 `assets/src/ops.ts` 且模块私有；§11 没有 assets 测试位；contracts 不能反向 import assets。约束来自：
   - 类型形状：`verifyTemporalInput` 只收 `bytes`，不收路径（TOCTOU 由构造关闭）；
   - T-26–T-29 的纯函数同字节 / 不读盘 / 替换测试；
   - T-55 / T-56 / T-59 的架构扫描；
   - `compile-runtime` / `runBuild` / `publish-gate` 既有集成用例的零行为变化。
   **这不是「读取器已被测试证明」，只是「读取器被结构约束 + 纯函数语义间接覆盖」。**
2. **三处接线丢弃结果，无法行为观察**。「已消费」只能由 T-61 的源码扫描证明；I-01 不证明生产系统会使用时序结论。
3. **`temporalScope` 的导出面**：它不在 I01-01 的逐项清单里，是本 effort 为「适用才读盘」新增的 `@internal` 纯函数。I01-07 必须审计；若判定超范围，按 I01-05 §4 的备选退化为「总是读盘、不做适用性短路」，测试矩阵相应删掉 T-47–T-51 的「不读盘」期望（适用性断言仍可保留在 `auditPlayabilityTemporal` 内）。
4. **架构扫描是 tripwire，不是证明**：T-55–T-65 依赖源码文本形状；变量重命名 / 换写法可能让它误红或漏红。真正的边界仍由 §11 白名单、I01-07 审计与代码评审兜底。

## 7. 证据格式（E1 / E2 / E3）

每张实施票 / 最终 R1 附件按以下最小格式记录：

### E1 源码 / 契约证据

- 每条断言写 `file:line` 与它证明的契约条目（G-01 / G-02 / 需求 §2.3）。
- 例：`packages/contracts/src/playability/temporal-input.ts:NN` — `digest` 与 `AtlasJson.safeParse` 消费同一个 `bytes`。
- 架构扫描的结果写成「扫描根目录 + 命中文件列表 + 期望文件列表」。

### E2 测试证据

- 命令（可复现的完整参数）。
- 退出码。
- 每个新用例 → 断言 → 结果；至少给出 describe 块计数与失败列表（失败必须为空）。
- 既有测试：给出三个指定文件的通过数 + 全仓 `pnpm test` 的通过数。
- 变更形状：`git diff --name-only` 的文件列表（与 §4.3 期望集合逐项对照）。

### E3 scratch 复跑

- 命令、输入路径、输出 JSON 路径、计数表、退出码。
- 与 §5 基线的逐项 diff：唯一配对 / 唯一 config / 三态计数 / 矩阵三态计数 / 新增误报数。
- 任何非零差异：停，按 LP-07 F3 处理。

### R1 授权包必须附

1. `pnpm build` / `pnpm typecheck` / `pnpm test` / `pnpm check:deps` / `pnpm check:links` 的退出码与摘要行。
2. 新测试文件的 `describe` / `it` 清单与通过数。
3. `git diff --stat main...HEAD` 与文件集合；明确列出「既有测试零改动」。
4. 两个 scratch 语料脚本的输出路径与计数表。
5. §6 的四条残余限制原文。
6. 本票 §2 的用例矩阵版本（若实施中增删用例，必须同步更新并说明原因）。

## 8. 事实来源

- 真包资产 / 帧 / anchor / size：`fixtures/packs/last-train/v2/manifest.json`；`delivery/atlas.animations.json`；`delivery/atlas.sprites.json`。
- 真 config 与唯一移动 Hazard：`fixtures/game-configs/last-train.json`（`carriage`，x 轴，200px / 4000ms）。
- 失败码闭集：`evidence/02-trusted-input-contract.md` §2；`evidence/03-frame-geometry-predicate.md`。
- 结果类型 / 适用性 / lag 规则：`evidence/04-lag-orchestration.md` §2–§7。
- 接线与读取计划：`evidence/05-call-site-wiring.md` §1–§3。
- 白名单：`docs/v7.8/移动-I00.md:145-163`。
- 既有测试调用点：`packages/contracts/tests/playability-api.test.ts:38`、`packages/contracts/tests/config-audit.test.ts:32`、`packages/pipeline/tests/publish-gate.test.ts:193`。
- 源码扫描先例：`packages/demo/tests/shell-scene-wiring.test.ts:8`、`packages/qa/tests/assemble.test.ts:128`。
- 语料基线：`.scratch/level-playability-v1-p1/evidence/06-corpus-acceptance.md` §1–§2。
- contracts 源码无 Node 内置模块的事实：`packages/contracts/src/index.ts:1-160` 的 import 面；`packages/contracts/tsconfig.json` 只 include `src`。
