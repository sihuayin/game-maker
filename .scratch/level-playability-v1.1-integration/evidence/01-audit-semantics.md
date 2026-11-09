# I00-01 现有审计语义与 coverage 缺口（证据）

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I00-01](../issues/02-i00-01-audit-semantics-coverage.md) |
| 分支 / HEAD | `wayfinder/level-playability-v1.1-integration` / `330d6dc3919d9f7fa9de05baff9668a4a1177133` |
| 权威输入 | `docs/v7.8/移动.md` @ `sha256:3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9` |
| 修改产品目录 | **否**（只写 `.scratch/level-playability-v1.1-integration/{evidence,scripts}/`） |
| 裁定 | 无。选项清单交 [I00-R1](../issues/10-i00-r1-contract-freeze.md) 裁定 |

标注约定：**【E1】** 源码 `file:line`；**【E2】** 测试名 + 断言 + 退出码；**【E3】** scratch 复跑原始输出；**【推断】** 未直接执行验证的推论。

---

## 0. 结论摘要（供裁定票引用）

- **F1（已确认）**：`aggregateLayer` 的 `coverage` 入参在函数体里**从未被读取**。层内三态只由 evidence 与 gaps 决定。
- **F2（已确认）**：顶层 fold 只读三层 `verdict`，**不读 coverage、不读 gaps、不读 evidence**。
- **F3（已确认）**：因此「`coverage = partial` ⇒ 总 verdict 降级」在现有实现里**不存在**；`verdict.ts:18-19` 与 `profile.ts:22-23` 的这段说明是**未实现的/被推翻的**文字，实际语义以 `api.ts:14-18, 87-92` 为准。
- **F4（已确认）**：`coverage.spatial` 在**所有 39 个**现有 fixture 用例里都是 `partial`（玩家几何无条件 `partial`）；9 个 `NO_PROVEN_BLOCKER` 用例全部带 `partial`。
- **F5（已确认）**：存在「无任何 gap、层内全 `NO_PROVEN_BLOCKER`、mechanic coverage 仍 `partial`」的真实关卡形状：`pit-chest-with-reset-hazard`。`partial` 可由**帧来源几何**单独产生，不需要任何降级 gap。
- **F6（已确认）**：`PlayabilityVerdict`（整关返回）**不含 layer gaps**；13 个 `INSUFFICIENT_EVIDENCE` 用例里有 11 个的整关 `evidence` 为空，降级原因在整关结果里**完全丢失**。
- **F7（已确认）**：`PlayabilityEvidence` 可承载「关键几何证据」与 danger 安全窗口的时间量；**没有**运动模型、相位、`lagMs`、范围限制字段。
- **F8（已确认）**：`playabilityIssues` 只在 `PROVEN_UNPLAYABLE` 时产 issue，且 issue **不带 `code`**；`NO_PROVEN_BLOCKER` / `INSUFFICIENT_EVIDENCE` 在产品输出里**零痕迹**。

---

## 1. 复现方法与输入 SHA

### 1.1 环境

```text
$ git rev-parse HEAD
330d6dc3919d9f7fa9de05baff9668a4a1177133

$ node --version && ./node_modules/.bin/vitest --version
v22.23.2
vitest/3.2.7 darwin-arm64 node-v22.23.2
```

### 1.2 输入文件 SHA-256（`shasum -a 256`，退出码 0）

```text
eb1187405272dbe7b8355cbbcb4dfc2007f37f2d8f05c05aad078ab81d2ef643  packages/contracts/src/playability/verdict.ts
fdd3e1d904717b899f7a2718a684f360298a8971947364be66d7f75ad1842afb  packages/contracts/src/playability/api.ts
2deea6e6e42b2c189114166bf3bdf39ab38c560eb330190e59d0cd8733ba8ab2  packages/contracts/src/playability/profile.ts
a14116271fd9a1b191118497b421d64e5fe72161fb485d7dfd1e7e159f891c50  packages/contracts/src/playability/spatial.ts
0f60760f89453d1380a8756e4bd0bdf66969b239c5af8543533599d99e2668da  packages/contracts/src/playability/mechanic.ts
b0bdf4a1335942536d7a9f99fd1b30c2fa702e3d1238ddfd60f5f0aeb241c418  packages/contracts/src/playability/completion.ts
def3fa7132b9142e5f9441f1b5b6f5b6e4d8ef97096bd0db0b2c5b620445e55b  packages/contracts/src/playability/graph.ts
b1b85fd3bee51ca3f7aba7c7cbececb9d6f47bc7fa5fb2959c910d417e88b95b  packages/contracts/src/playability/targets.ts
1015a9d49b3b1bcba483ea5c07d0357007bc12d6a986770b80a31ba6f55e2e79  packages/contracts/src/game-config.ts
33d3b268afdd84243d71771c988da750025c3eaaf355e590057715c0f560a4dc  packages/contracts/src/config-audit.ts
b76f6da4e44c6e54f4fc49ea498e495e8000c970665acddd9478b2a98d19648e  packages/pipeline/src/publish-gate.ts
55b5507eb48651e93ba69db9ba217a234d2844d97b73d0f6dbd7d66d05a07fa7  packages/contracts/tests/playability-api.test.ts
0d8981850d46bc5eb8f27904dd878331d4bf3646282d5d3f5c39b5067d7ca77f  packages/contracts/tests/playability-spatial.test.ts
ee4dedd96918c8f2d3f2465a6daad9b3662f981ceded35bc92755af5822bf26b  packages/contracts/tests/playability-mechanic.test.ts
c41b2de19be1a85834a1faa8ca34c7f370b46a35b6b6e80d5b0372cc4c67e38b  packages/contracts/tests/playability-completion.test.ts
23c442bd7a2cdf5761e0b0181ec68abb65457d1b4647d03dcde1cea39aeb02d6  packages/contracts/tests/config-audit.test.ts
348111c835e9b65dc3f0c554981312720ec55609e852ef237be5b45c089dfd20  packages/pipeline/tests/publish-gate.test.ts
3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9  docs/v7.8/移动.md
```

### 1.3 只读探针（E3）

脚本：`.scratch/level-playability-v1.1-integration/scripts/probe-coverage.ts`
（枚举三个 playability fixture 文档的 39 个 case，打印整关 / 分层 verdict、coverage、gaps；不写产品目录。）

```text
$ ./node_modules/.bin/esbuild .scratch/level-playability-v1.1-integration/scripts/probe-coverage.ts \
    --bundle --platform=node --format=esm \
    --outfile=.scratch/level-playability-v1.1-integration/scripts/probe-coverage.mjs
退出码 0

$ node .scratch/level-playability-v1.1-integration/scripts/probe-coverage.mjs "$PWD" \
    > .scratch/level-playability-v1.1-integration/scripts/probe-coverage.out.json
退出码 0
```

原始输出：`scripts/probe-coverage.out.json`。汇总：

```text
aggregateLayer({ coverage: "partial", evidence: [] }) = NO_PROVEN_BLOCKER
case 总数 39：PROVEN_UNPLAYABLE 17 / INSUFFICIENT_EVIDENCE 13 / NO_PROVEN_BLOCKER 9
coverage.spatial === "partial"：39 / 39
NO_PROVEN_BLOCKER 且至少一维 partial：9 / 9
```

### 1.4 既有测试（E2）

```text
$ ./node_modules/.bin/vitest run \
    packages/contracts/tests/playability-api.test.ts \
    packages/contracts/tests/playability-spatial.test.ts \
    packages/contracts/tests/playability-mechanic.test.ts \
    packages/contracts/tests/playability-completion.test.ts \
    packages/contracts/tests/config-audit.test.ts \
    packages/pipeline/tests/publish-gate.test.ts

Test Files  6 passed (6)
     Tests  137 passed (137)
  Duration  29.93s
退出码 0
```

---

## 2. Q1：聚合的真实行为，以及两段说明是否矛盾

### 2.1 `aggregateLayer` 的真实行为【E1】

`verdict.ts:104-115`：

- 入参签名含 `coverage`（`verdict.ts:105`），但**函数体 `110-114` 一次都没有读它**。
- 判定顺序：
  1. `verdict.ts:111` — 任一条 `judgmentId` 不在 `nonBlocking` 集合里的 evidence ⇒ `PROVEN_UNPLAYABLE`；
  2. `verdict.ts:112` — 否则只要还有 evidence（全是非阻断）⇒ `INSUFFICIENT_EVIDENCE`；
  3. `verdict.ts:113` — 否则 gaps 非空 ⇒ `INSUFFICIENT_EVIDENCE`；
  4. `verdict.ts:114` — 否则 ⇒ `NO_PROVEN_BLOCKER`。
- 注意 `nonBlocking` 默认是空集（`verdict.ts:110`）：**默认任何 evidence 都算阻断**，调用方必须显式传入非阻断集合。
- gaps 只在 evidence 为空时才起决定作用（`112` 先于 `113`）。

层内调用点：

| 层 | 调用 | 传入 | 备注 |
| --- | --- | --- | --- |
| spatial | `spatial.ts:143,204-206` | `coverage`、`nonBlocking: SPATIAL_NON_BLOCKING`、gaps | 缺图分支 `spatial.ts:116` 也传 coverage |
| mechanic | `mechanic.ts:256` | `coverage`、gaps（**不传 nonBlocking**） | mechanic evidence 全按阻断处理 |
| completion | `completion.ts:345` | `coverage`、gaps | 同上 |

### 2.2 顶层 fold 的真实行为【E1】

`api.ts:87-92`：

```text
layers.some(PROVEN)       ⇒ PROVEN_UNPLAYABLE
否则 layers.some(IE)      ⇒ INSUFFICIENT_EVIDENCE
否则                      ⇒ NO_PROVEN_BLOCKER
```

- 只读 `l.verdict`。**coverage / gaps / evidence 均不参与**。
- `api.ts:94-104` 的跨层去重只改 evidence 列表（按 `target`，层序 spatial > mechanic > completion），不改 verdict。
- 返回对象 `{ verdict, evidence, coverage }`（`api.ts:104`；类型 `api.ts:44-48`）**不含 layer gaps**。
- 结果「不落盘」：`api.ts:62` 的 JSDoc 明说「内部结果，不落盘」。

### 2.3 是否矛盾：**是（文字层），实现以 `api.ts` 为准**【E1】

| 位置 | 原文要点 |
| --- | --- |
| `verdict.ts:16-19` | `aggregateLayer` 不因 partial 拉层内 verdict；「**LP-05 做整关聚合时，`partial` 才按 framework §3.3 把总 verdict 拉向 `INSUFFICIENT_EVIDENCE`**」 |
| `profile.ts:22-23` | `partial`「会在没有阻断时把 verdict 拉向 `INSUFFICIENT_EVIDENCE`（聚合规则在 LP-02 / LP-05）」 |
| `api.ts:14-18` | 明确写：framework §3.3 的「任一维 partial ⇒ INSUFFICIENT」是**更严的默认**；**用户 2026-11-06 裁定**按层 verdict 组合、让 19/16/4 分布可复现；**允许** `NO_PROVEN_BLOCKER + coverage.spatial = partial` |
| `api.ts:87-92` | 实际只按层 verdict 组合 |

结论（事实陈述）：`verdict.ts:18-19` / `profile.ts:22-23` 描述的「总 verdict 被 partial 拉向 IE」**在代码里没有实现**；`api.ts:14-18` 承认这是对 framework 默认的有意偏离，并给出用户裁定作为依据。两者是**规范文字冲突**，不是两处代码行为冲突——实际行为只有一种。

### 2.4 最小可复现示例

**(a) 纯函数级（构造输入）**【E3】【E2】

```text
aggregateLayer({ coverage: "partial", evidence: [] })
  ⇒ "NO_PROVEN_BLOCKER"
```

- 探针输出见 §1.3。
- 同一断言已存在于 `packages/contracts/tests/playability-spatial.test.ts:275-277`：
  `it("什么都没有 ⇒ NO_PROVEN_BLOCKER（coverage 仍单独记录 partial）")`。

**(b) 整关级（真实 fixture，无任何 gap）**【E3】

`pit-chest-with-reset-hazard`（`playability-completion-matrix.json`，fixture 期望 `NO_PROVEN_BLOCKER`）：

```text
top:   verdict = NO_PROVEN_BLOCKER
       coverage = { spatial: "partial", mechanic: "partial", completion: "checked" }
       evidence = []
layers: spatial    = NO_PROVEN_BLOCKER / coverage partial / gaps []
        mechanic   = NO_PROVEN_BLOCKER / coverage partial / gaps []
        completion = NO_PROVEN_BLOCKER / coverage checked / gaps []
```

这是最强的形状：**三层都是 NO_PROVEN、两层 coverage 是 partial、三层都没有 gap，整关仍是 NO_PROVEN**。`mechanic` 的 partial 来自静止 hazard 的帧来源几何（`mechanic.ts:127`），不是任何降级 gap。

**(c) 整关级（既有测试钉住的案例）**【E2】

`packages/contracts/tests/playability-api.test.ts:43-48`：

```text
it("无阻断：层 verdict 组合为 NO_PROVEN，coverage.spatial 仍诚实记 partial")
  expect(verdict.verdict).toBe("NO_PROVEN_BLOCKER");
  expect(verdict.coverage.spatial).toBe("partial");
  expect(playabilityIssues(verdict)).toEqual([]);
```

该测试**显式把 F3 的行为固化成回归基线**。

---

## 3. Q2：`partial` 的实际泄漏面

### 3.1 产生 `partial` 的路径

| # | 路径 | 位置 | 作用域 | 触发条件 | 伴随 gap? |
| --- | --- | --- | --- | --- | --- |
| P1 | 玩家几何无条件 partial | `profile.ts:101-114`（`coverage: "partial"` 在 `113`） | 所有层共享的图 | 玩家资产可解析 | 否 |
| P2 | 图 coverage 以玩家 coverage 起算 | `graph.ts:97`（`let coverage = player.coverage`） | spatial / mechanic / completion 的 `coverage.spatial` | 同上 | 否 |
| P3 | 帧来源实体几何 | `profile.ts:92-97`（`source === "frame" ⇒ partial`） | pickup / hazard / goal | 实体 kind 为 frame 系 | 否 |
| P4 | 目标覆盖记 partial | `targets.ts:65,82` | spatial/mechanic 的 evidence.coverage | 帧来源目标 | 否 |
| P5 | 静止 hazard 让 mechanic 层 partial | `mechanic.ts:127` | `coverage.mechanic` | 关卡里有**静止 hazard** | **否**（即使无 gap） |
| P6 | 实心体几何缺失 | `graph.ts:105` | graph coverage | solid 资产解不到 | 否（另记引用族） |
| P7 | mechanic gaps | `mechanic.ts:84-87` 置 partial；gap 产生点见 `mechanic.ts:119-120,126,129,140,144,151,156,185,192,194,198,201,204,211,218,221,222,245` | `coverage.mechanic` | 移动 hazard、moving platform、薄 hazard、目标在 hazard/danger 内、多 danger、非全高 danger 等 | 是 |
| P8 | completion gaps | `completion.ts:89-92` 置 partial；分支见 `completion.ts:101-113,125-131,136-152,236,307-310` | `coverage.completion` | 目标引用缺口、gate 缺失、k=0、k>12、**被空间/机制层抑制**、搜索预算超限等 | 是 |
| P9 | 缺图分支 | `spatial.ts:116-117` | `coverage.spatial` | 玩家资产缺失 | 是 |

补充：

- `spatial.ts:92-94` 与 `mechanic.ts:108-110` 会把**同一条 evidence** 里尚未跑的维度记成 `not-checked`；这是 per-evidence 字段，不影响整关 coverage。
- P8 中的 `suppressed-by-spatial-or-mechanic`（`completion.ts:125-128`）是**去重抑制**，不是证据弱；它会让 completion coverage 变 partial，但层 verdict 已经是 IE（gap 在）。
- 代码层面可确认的推论：completion 的 `partial` 只出现在 gap 分支（成功 / no-walk 分支用 `completion` 变量，初始 `checked`，`completion.ts:88,311,334`），而 gap 非空必然让 `aggregateLayer` 返回 IE（`verdict.ts:113`）。⇒ **不存在 completion partial + completion NO_PROVEN 的组合**（与 §3.2 探针一致）。

### 3.2 具体关卡形状：partial 与 `NO_PROVEN_BLOCKER` 共存

来自 §1.3 探针（全部 39 例）：

| 形状 | fixture 例 | 整关 verdict | 哪一维 partial | 有 gap? |
| --- | --- | --- | --- | --- |
| 玩家可解析 + 无阻断（最常见） | `low-ceiling-walkable`、`danger-wide-idle`、`gate-midair-jumpthrough`、`one-way-pit-gate-on-pit-floor`、`order-required-high-then-low`、`two-pickups-one-arc`、`chest-behind-wall-with-range`、`chest-midair-jumpthrough` | NO_PROVEN | spatial（P1/P2） | 否 |
| 含一个**不封路**的静止 hazard | `pit-chest-with-reset-hazard` | NO_PROVEN | spatial + **mechanic**（P5，帧几何） | 否 |
| 含移动 hazard | `baseline-last-train`、`wide-patrol`、`gap-*` 等 | **IE**（不是 NO_PROVEN） | spatial + mechanic | 是（`moving-hazard-phase`，`mechanic.ts:119`） |

计数：

```text
NO_PROVEN_BLOCKER 且至少一维 partial：9 / 9
coverage.spatial === partial：39 / 39
```

**与 V1.1 的关系（事实边界）**：

- 今天移动 hazard 一律走 `moving-hazard-phase` gap（`mechanic.ts:119`）⇒ mechanic IE ⇒ 整关 IE。所以「移动 hazard + NO_PROVEN + partial」目前**不会**出现。
- 【推断】一旦移动 hazard 的相位/时间证据被实现、该 gap 被替换为确定性判据，如果判定成功路径返回 `NO_PROVEN_BLOCKER`，而 hazard 几何仍是帧来源 `partial`（`profile.ts:97`），那么**现有顶层聚合不会降级**——这正是 PRD §3.2 / G-06 要防的形状。该推断依赖未来实现细节，未被当前代码执行验证。

---

## 4. Q3：PRD §6.2 七项解释要素 vs 现有证据结构

现有结构：

- `PlayabilityEvidence`：`verdict.ts:74-86`（`judgmentId` 76、`target` 78、`detail` 80、`witness` 81、`coverage` 82、`assetId` 84、`expected` 85、`actual` 86）。
- `Witness` 五种：`verdict.ts:47-72`（`no-path` 48-56、`blocked` 57-62、`coverage-gap` 63、`count` 64、`no-safe-window` 66-72）。
- `PlayabilityCoverage`：`verdict.ts:31-37`；层结果 `verdict.ts:88-92`；整关 `api.ts:44-48`。
- 层 gaps：`spatial.ts:88-90`、`mechanic.ts:58-59`、`completion.ts:57-58`。

| PRD §6.2 要素 | 能否表达 | 载体 / `file:line` | 缺口 |
| --- | --- | --- | --- |
| 判定状态 | **能（仅内存）** | `PlayabilityVerdict.verdict` `api.ts:44-45,104` | evidence 自带 verdict；issue 只在 PROVEN 派生（`api.ts:113-118`），NO_PROVEN/IE 无任何产品痕迹 |
| 使用的运动模型 | **不能** | 无字段；witness 只有具体几何/时间量（`verdict.ts:57-72`）；`FIXED_RUNTIME_PROFILE.id`（`profile.ts:37-47,49-58`）**没有**进 evidence | 模型身份、X 轴三角波、`t=0`、相位均无处可放 |
| 关键几何证据 | **能（按判据）** | `blocked` rect/overlapFoot/solids/blockers `verdict.ts:57-62`；`no-path` reachableSet/targetsReached `verdict.ts:48-55`；`no-safe-window` box/targetRegion `verdict.ts:66-72` | 无通用几何快照；`coverage-gap` 只有一个字符串 `missing`（`verdict.ts:63`） |
| 时间窗口或永久封锁证据 | **部分能** | `no-safe-window` 有 `idleMs/activeMs/requiredMs/speed/playerWidth/fullColumnCut/targetRegion`（`verdict.ts:66-72`） | 仅覆盖单 danger 全高切面这一条判据；移动 hazard 的相位/永久封锁证据不存在 |
| 使用的 `lagMs` 假设 | **不能** | 全仓 `packages/**/src` 无 `lagMs` / `lag` 字段（grep 只命中 `periodMs`：`game-config.ts:82-84,98`） | 无输入、无 profile 字段、无 evidence 字段 |
| 降级原因（若有） | **层内能，整关不能** | 层 gaps：`spatial.ts:88-90`、`mechanic.ts:58-59`、`completion.ts:57-58`；部分降级写成 `coverage-gap` evidence（`verdict.ts:63`、`spatial.ts:181`） | 整关返回**不含 gaps**（`api.ts:44-48,104`）；纯 gap 导致的 IE 整关 `evidence` 为空（探针：`baseline-last-train`、`wide-patrol`、`low-ceiling-walkable` 等） |
| 结论覆盖范围与限制 | **部分能** | 三维 `coverage` `verdict.ts:31-37,88-92`；per-evidence coverage `verdict.ts:82`；`no-path` 的 `reachableSet` / `targetsReached`（`verdict.ts:48-55`） | coverage 只有三态，没有「为什么 partial」「哪件实体导致」「空间/时间边界」；限制不可枚举 |

结论：七项里**只有「判定状态」（内存）、「关键几何证据」、「部分时间窗口证据」**能在现有结构内表达；「运动模型」「`lagMs`」**完全无处可放**；「降级原因」在整关层无处可放；「覆盖范围与限制」只有三态摘要。

---

## 5. Q4：最小改动点四选一（每项标注影响与授权类别）

授权口径（来自 `map.md:10-12,146-149`）：任何 Runtime / Pipeline / contracts / CLI / MCP / 公共参数 / 持久化 schema / `ConfigIssue.code` 的改动都必须 PRD §9.2 独立授权，并经 [R2](../issues/13-i00-r2-whitelist-authorization.md) 白名单裁定；scratch 取证已获本图授权。

### (a) 顶层聚合语义（改 `api.ts:87-92`）

- **做法**：把 coverage（至少 mechanic / 已知 partial 来源）纳入整关 fold；PROVEN 优先级可保留。
- **语义影响**：由于 `coverage.spatial` 恒为 partial（P1/P2，39/39），任何「任一维 partial ⇒ IE」的规则会让**所有有玩家资产的关卡**从 NO_PROVEN 变为 IE。这与 PRD §7 验收案例 A 的期望 `NO_PROVEN_BLOCKER` 直接冲突。若只纳入 mechanic/completion，则 spatial 的帧几何泄漏仍在。
- **LP-02～LP-04**：层内语义不变 ⇒ `playability-spatial.test.ts:60-82`、`playability-mechanic.test.ts:93-102`、`playability-completion.test.ts:76-80` 均不受影响。
- **LP-05**：`playability-api.test.ts:43-48` **必失败**（显式期望 NO_PROVEN + partial）；`:87-93` 仍通过（IE 也不是 PROVEN，issue 仍空）。
- **`config-audit.test.ts`**：只检查 issue（`37-76`），verdict 降级不新增 issue ⇒ **不失败**。
- **`publish-gate.test.ts`**：只检查 issue（`150-200`）⇒ **不失败**。
- **授权类别**：contracts 语义变更 + PRD 级裁定（与验收案例 A 冲突时须先改 PRD 或缩范围）。

### (b) 机制层内部（改 `aggregateLayer` / 各层，把 partial 直接压成 IE）

- **做法**：让 `aggregateLayer` 读 coverage，或在 spatial/mechanic/completion 内先降级。
- **语义影响**：`aggregateLayer` 是三层共用函数；spatial 层 coverage 恒 partial ⇒ spatial 层恒 IE ⇒ 整关恒 IE（PROVEN 优先级保留时，PROVEN 仍可出）。NO_PROVEN_BLOCKER 对解析得出玩家资产的关卡**不可达**。
- **LP-02**：`playability-spatial.test.ts:60-82`（NO_PROVEN 用例）、`:275-277`（纯函数断言）**必失败**。
- **LP-03**：`playability-mechanic.test.ts:93-102`（可跳过静止 hazard ⇒ NO_PROVEN + partial）**必失败**。
- **LP-04**：completion partial 本来就伴随 gap ⇒ 层 verdict 已是 IE，`playability-completion.test.ts:76-80,199-203` **大概率不受影响**。
- **LP-05**：`playability-api.test.ts:43-48` **必失败**。
- **`config-audit.test.ts` / `publish-gate.test.ts`**：只看 issue ⇒ **不失败**（PROVEN 仍产 error）。
- **授权类别**：contracts 语义变更 + 大范围测试基线修改（测试属 map `Out of scope` 的"已冻结 LP-02～LP-05 测试"，需额外授权）+ PRD 级裁定。

### (c) 证据结构扩展（改 `verdict.ts:74-92` / `api.ts:44-48`，加法字段）

- **做法**：给 evidence / 整关结果加可选字段，例如运动模型标识、`lagMs`、限制列表、整关 `gaps`；**不改三态判定**。
- **语义影响**：verdict / coverage 行为零变化；解决 Q3 的「无处可放」。若只加字段不落盘，仍不解决 Q5 的持久可审计性。
- **LP-02～LP-04**：现有测试均不比对整条 evidence 的完整形状（`playability-spatial.test.ts:72`、`playability-mechanic.test.ts`、`playability-completion.test.ts:57` 只取 `judgmentId`）⇒ **预计全部通过**（需 typecheck 复核）。
- **LP-05**：`playability-api.test.ts:97-103` 用 `toHaveProperty`，加法字段不影响；**预计通过**。
- **`config-audit.test.ts` / `publish-gate.test.ts`**：不消费新字段 ⇒ **不受影响**。
- **授权类别**：contracts 加法变更（结构扩展）。不触碰三态 verdict、不新增 `ConfigIssue.code`，因此不直接触发 PRD §3.4 的两条禁令；但 PRD §6.2「不在本需求阶段预设新增持久化字段」要求由 [R1](../issues/10-i00-r1-contract-freeze.md) 明确授权并冻结。

### (d) 仅 scratch 取证（不改生产）

- **做法**：模型 / 相位 / `lagMs` / 降级原因 / 限制全部写在本 effort 的 `evidence/` 与测试矩阵里；生产审计维持现状。
- **语义影响**：零。产品运行时的解释力不增加；`NO_PROVEN_BLOCKER + partial` 仍可产出。
- **LP-02～LP-05 / `config-audit.test.ts` / `publish-gate.test.ts`**：**全部不受影响**（137/137 继续通过）。
- **授权类别**：无新增（`map.md:146-149` 已允许 scratch 取证与脚本）。能满足 G-07 的「保留可审计的输入、结果和证据」**仅限本 effort 的验证运行**，不覆盖集成后的生产运行。

### 选项对照（不裁定）

| 选项 | verdict 语义变化 | 受影响测试（已确认会失败） | 生产授权 | 解决 Q3 七要素? | 解决 F3 泄漏? |
| --- | --- | --- | --- | --- | --- |
| (a) 顶层聚合 | 大（NO_PROVEN 可能不可达） | `playability-api.test.ts:43-48` | 需要 + PRD 裁定 | 否 | 是（以牺牲 NO_PROVEN 为代价） |
| (b) 机制层内部 | 大（同上，逐层更早） | spatial `:60-82,275-277`；mechanic `:93-102`；api `:43-48` | 需要 + 改冻结测试 | 否 | 是（同上） |
| (c) 证据结构 | 无 | 预计无 | 需要（契约字段冻结） | 是（内存内） | 否（除非同时改聚合） |
| (d) 仅 scratch | 无 | 无 | 无 | 仅 effort 内 | 否 |

---

## 6. Q5：PRD 约束碰撞下，可审计性只能落在哪里

### 6.1 约束（已确认）

- PRD §3.4（`docs/v7.8/移动.md:90-98`）：沿用三态；**不得新增持久化 verdict 或 `ConfigIssue.code`**，除非独立评审授权。
- `ConfigIssue.code` 是闭集 `CONFIG_ISSUE_CODES`（`game-config.ts:315-317`），PRD 禁止本次扩码。
- `api.ts:62`：`auditPlayability` 结果「内部结果，不落盘」。
- `playabilityIssues` 只映射 PROVEN 的阻断 evidence，issue 不带 `code`（`api.ts:113-118`）。
- 两个调用方都**立刻把结果压成 issue**：
  - `config-audit.ts:53`：`...playabilityIssues(auditPlayability(config, ctx.manifest))`；返回值只有两组 issue 数组（`config-audit.ts:40-56`）。
  - `publish-gate.ts:140`：只取 `playabilityIssues(...).filter(severity==="error")`，再拼进错误字符串（`publish-gate.ts:141-143`）。
- `create-game.ts:631-642`：只取 `deterministic` 的 `error`，硬失败时抛 `CommandError`，**不落盘**。
- QA 报告 schema 里没有 playability 判据（`qa.ts` 只有 `layer-coverage` 等，`qa.ts:128`）；`PlayabilityVerdict` 没有被持久化到任何 run artifact。

### 6.2 可落点清单

| 落点 | 载体 | 能放什么 | 限制 |
| --- | --- | --- | --- |
| L1 内存返回值 | `PlayabilityVerdict` / 各层 `LayerResult`（`api.ts:44-48`、`verdict.ts:88-92`） | verdict、evidence（含 witness）、coverage；层 gaps | 调用方不保留（`config-audit.ts:53`、`publish-gate.ts:140`）；整关无 gaps |
| L2 硬失败文案 | `ConfigIssue.message = detail`、`where = target`（`api.ts:113-118`） | 仅 PROVEN 的人话定位 | 无 `code`、无 coverage、无 verdict 字段；NO_PROVEN/IE 为零 issue |
| L3 测试 / fixture 矩阵 | `packages/contracts/tests/fixtures/playability-*-matrix.json` + 断言 | 判定基线与回归证据（E2） | 不是运行时审计轨迹；用例是人工维护的 |
| L4 scratch 证据 | 本 effort `evidence/`、`scripts/` | 模型、相位、`lagMs`、降级原因、限制、原始输出 | 与生产运行脱钩；只在 I-00 验证中可复现 |
| L5 冻结文档 | `docs/v7.8/移动-I00.md`（R3 发布） | 契约、模型、假设、边界 | 计划文本，不是逐次运行记录 |

**事实结论**：在当前约束下，一次 `NO_PROVEN_BLOCKER` 或 `INSUFFICIENT_EVIDENCE` 的产品运行**不会留下任何持久化审计痕迹**；即使是 `PROVEN_UNPLAYABLE`，持久化的也只有人话 `message` 与 `where`（无 `code`、无 coverage、无 witness）。因此「解释性 + 可审计性」只能落在 L1（需调用方保留返回值）、L3、L4、L5；其中只有 L4/L5 今天实际存在，且都在产品之外。

---

## 7. 已确认 / 推断 / 未确认

**已确认（E1+E2+E3）**

- F1～F8 全部。
- `coverage.spatial` 在 39/39 fixture 用例为 partial；9/9 NO_PROVEN 至少一维 partial。
- `pit-chest-with-reset-hazard`：三层 NO_PROVEN、无 gap、spatial+mechanic partial、整关 NO_PROVEN。
- 13 个 IE 用例中 11 个整关 `evidence` 为空（仅 `spawn-deep-terrain`、`spawn-no-foothold` 有非阻断 evidence）；`baseline-last-train`、`wide-patrol`、`moving-platform` 的降级原因只存在于层 gaps。
- `verdict.ts:18-19` / `profile.ts:22-23` 所述整关降级未实现；`api.ts:14-18` 明示这是用户裁定的偏离。
- 现有 6 个相关测试文件 137/137 通过，退出码 0。

**推断（未执行验证）**

- 移动 hazard 支持落地后，若成功路径返回 NO_PROVEN，现有顶层聚合不会因帧几何 partial 降级。
- 选项 (c) 的加法字段不会破坏现有测试——依据是测试只取 `judgmentId` / `toHaveProperty` / 空数组断言；未实际改代码验证。
- 选项 (a)/(b) 的「NO_PROVEN 不可达」结论依赖「任一维 partial ⇒ IE」这一具体规则形状；若裁定采用更窄的规则，影响面需重算。

**未确认 / 边界**

- PRD 对「永久封锁」与「时间窗口」在 V1.1 的具体判据尚未冻结（R1 议题），本票不评估。
- `frame` 几何在 pack acceptance 的实际可信度由 I00-02 负责，本票只记录审计输入看不到逐帧几何这一事实（`profile.ts:18-25`）。
- `lagMs` 的权威来源由 I00-04 负责；本票只确认现有 contracts 无该字段/入口。

---

## 8. 复现清单（另一个会话可照抄）

```bash
cd /Volumes/shy/some-projects/game-maker
git rev-parse HEAD                       # 期望 330d6dc3919d9f7fa9de05baff9668a4a1177133
shasum -a 256 packages/contracts/src/playability/{verdict,api,profile}.ts   # 对上 §1.2

./node_modules/.bin/esbuild \
  .scratch/level-playability-v1.1-integration/scripts/probe-coverage.ts \
  --bundle --platform=node --format=esm \
  --outfile=.scratch/level-playability-v1.1-integration/scripts/probe-coverage.mjs
node .scratch/level-playability-v1.1-integration/scripts/probe-coverage.mjs "$PWD" \
  > .scratch/level-playability-v1.1-integration/scripts/probe-coverage.out.json

./node_modules/.bin/vitest run \
  packages/contracts/tests/playability-api.test.ts \
  packages/contracts/tests/playability-spatial.test.ts \
  packages/contracts/tests/playability-mechanic.test.ts \
  packages/contracts/tests/playability-completion.test.ts \
  packages/contracts/tests/config-audit.test.ts \
  packages/pipeline/tests/publish-gate.test.ts
```

退出码均为 `0`。本票未修改 `packages/**`、`docs/**`、`fixtures/**`、其他票或 `map.md`。
