# 01 下游审计：compile-runtime 调用链、槽位 kind 锁与五错误回归

- 票：[01-downstream-validation-audit](../issues/01-downstream-validation-audit.md)
- 日期：2026-11-02
- 基线：`main` @ `ebdeff3`
- 性质：只读源码审计 + 既有测试 + 只读探针；零付费、零模型调用、零生图；未运行 `create` / `build` / `plan` / `pack` 链。
- 证据分级：E0 推测 · E1 源码 · E2 测试 · E3 真实产物 + 运行证据。
- 行号均指上述基线；源码一旦改动会漂移。

---

## 0. 结论先行

1. **五个历史错误今天仍全部被拦截。** 用 2026-10-23 那次真实产物（`rust-city-scavenger/pack/v1` + `game-design.json`）重建当时的五处错误，`auditGameConfig` 今天报出**恰好五条 error**，消息与历史日志逐项对应（E3，见 §8 探针 H1）。E01/E02 现在由 `solid -> sprite` kind 锁在 `resolvePackRef` 之前直接拒；E03/E04 由 `hud.panel/pip -> ui` kind 锁拒；E05 由 `auditPanelSize` 拒。
2. **但失败分档已经变了。** 历史上这五条是「过契约、不过业务校验 ⇒ 不重采样、不落盘」；今天这五条都由 `auditGameConfig` 产生，而 `auditGameConfig` 的调用已被 `recipe-config-gap-v1` 票 10 移进**重采样循环**（`ops.ts:1193-1207`；票面 `.scratch/recipe-config-gap-v1/issues/10-compile-runtime-retry.md` 的 Answer 逐字记录了这次改动）。当前实际行为是：**最多 3 次文本调用、3 次都被判为“模型错”、抛 `invalid`（退出码 4）、不落盘、不消耗 `game-configs` 版本号**（E1 + E3，探针 H3）。`map.md` 里「不重采样」的现状描述对今天不成立；那是历史日志描述的行为，不是当前实现。
3. **E03/E04 多了一条上游防线。** 同一份历史清单（7 件资源、0 件 `ui`）今天会在 `planAssets` 的 `hudUiGate` 就被拒（3 发重采样、不落清单、不进入生图；E3 探针 H4）。条件是该设计的 `runtimeRequirements` 含 `hud:screen-space`；历史设计恰好含（`game-design.json:115`）。
4. **E01/E02 没有上游防线。** 规划层没有「平台关必须产出可作地形的 sprite」的闸门；清单可以合法地只含玩法 sprite，并在配置步（花钱之后）才被 kind 锁拒。`designCoverageGate` 只核对设计实体 id 覆盖（`ops.ts:266-290`）。
5. **槽位 kind 锁覆盖 5 个槽位，其余 6 种实体 kind 没有锁。** 没有锁的是 `pickup` / `hazard` / `goal` / `chest` / `danger` / `decor`（`game-config.ts:370-372`）。因此「设计对象 -> 资源语义」只在**格式层**被部分证明：E3 探针证明「设计里的敌人 -> `hazard` -> `ui` 图标」可以通过 `compileRuntime` 全链并落盘（探针 G1）。
6. **测试覆盖有明显缺口。** E01 与 E05 有同一形态的确定性纯函数测试；E03 在横版只有「animation -> ui」而不是「sprite -> ui」；E04 在横版**没有任何负向测试**；五个错误**没有一个**在 `compile-runtime` 端到端层有回归测试（§5）。
7. **真实残余缺口（事实，不评方案）**：非锁定 kind 的 `EntityKind -> AssetKind` 无约束；`sprite` 内部不区分语义（玩法 sprite 可当地形）；`chest`/`danger` 不要求状态帧（单帧静默）；九宫格声明尺寸没有最小尺寸/边框适配校验；`reachability` 只由 QA 跑，不在编译/装配期；`reuseConfig` 只跑 `auditReferences`、绕过其余审计（§7）。

---

## 1. `compile-runtime` 完整调用链

### 1.1 入口

| 入口 | 位置 | 传入 | 备注 |
|---|---|---|---|
| CLI `game-maker compile-runtime` | `packages/cli/src/cli.ts:673-689` | `viewport: VIEWPORT`（480×270）、`hudLineHeight: HUD_LINE_HEIGHT`（10） | 缺 `--design`/`--pack` ⇒ `usage`（2） |
| MCP `compile_runtime` | `packages/mcp/src/server.ts:340-349` | `viewport: VIEWPORT`；**不传 `hudLineHeight`** | 走默认 `DEFAULT_HUD_LINE_HEIGHT = 10`，与外壳常量今天同值；仍是第二处默认值（E1） |
| `runBuild`（create/build 链） | `packages/pipeline/src/create-game.ts:592-605` | 传入调用方 viewport/hudLineHeight；`outRoot` 指向临时 `.config-*` 目录 | 成功后 `renameSync` 到 `run/vN/game-config.json`（`:602-604`），临时目录在 `finally` 删除 |
| `--reuse-config` | `packages/pipeline/src/create-game.ts:482-489` | 不调用 `compileRuntime` | 只跑 `parseGameConfig` + `auditReferences`，其余审计全部绕过（见 §6/§7） |

`compileRuntime` 定义：`packages/assets/src/ops.ts:1039`。

### 1.2 主链（独立 `compile-runtime`）

```
compileRuntime                                  assets/src/ops.ts:1039
├─ readJson(design)                             :1041-1044
├─ GameDesignSpecSchema.safeParse(design)       :1047-1049
├─ resolveRuntimeProfile(design.game.runtimeProfile) :1053-1056
├─ CONFIG_SHAPES[profile.id]                    :1058-1064
├─ read pack/manifest.json + parseAssetPack     :1066-1068
├─ level = design.levels.find(levelId)          :1070-1074
├─ transport 非空检查（baseUrl/apiKey）          :1080-1083
├─ vp = opts.viewport ?? DEFAULT_VIEWPORT       :1085
├─ 构造提示词                                    :1086-1157
├─ spentCall("compile-runtime", "game-config")  :1159
└─ for attempt < STRUCTURED_CALL_ATTEMPTS(3)    :1162
   ├─ onceThroughTool(...)                      :1163-1166
   ├─ upstream 失败 -> 抛 upstream               :1167-1170
   ├─ not-sent -> 抛 upstream                   :1177
   ├─ bad（无线形状/没调工具/空入参）-> continue :1178
   ├─ parseGameConfig(once.result.value)        :1181-1187
   │   └─ 不过 v3 契约 -> failure:"schema"、continue
   ├─ clampToWorld(truth.value, manifest)       :1189（定义 :1028-1037）
   ├─ modelHard = [auditGameConfig, auditEntityIdentity, auditScreenSpace]
   │   .filter(severity==="error")              :1193-1207
   │   └─ 非空 -> trip({spent})、continue（“模型错”）
   ├─ trip({spent}); checked = truth; break     :1205-1207
   └─ 循环耗尽 -> 抛 invalid(lastError, ledger)  :1209
├─ issues = [auditGameConfig, auditEntityIdentity, auditScreenSpace,
│            auditLayerCoverage(backgroundLayerEntries)] :1219-1227
├─ hard = issues.filter(severity==="error")     :1228
├─ hard 非空 -> 抛 invalid（不落盘）             :1229-1235
└─ mkdir <out>/<packId>/game-configs            :1236-1237
   ├─ version = nextVersion(dir)                :1238（定义 :849-852）
   ├─ write <dir>/v<version>.json               :1239-1240
   └─ summary/data（warnings 以字符串形式）      :1242-1260
```

要点：

- `clampToWorld` 在 `parseGameConfig` 之后、业务审计之前执行，**原地修改** `entities[].at`，只钳「底边超出世界高 / 右边超出世界宽」两条（与 `auditGameConfig` 的 `inWorld` 同一条公式，`ops.ts:1024-1025`）。因此落盘的是钳过的坐标（E2：`compile-runtime.test.ts:169-177`）。
- 循环内与循环后**各跑一遍同样的三族审计**。因为审计是确定性的，循环后新增的 error 只可能来自第四族 `auditLayerCoverage`；代码仍重算四族。
- 循环内的 `modelHard` 只看 `error`；warning 不触发重采样。
- 循环内的 `auditGameConfig` 已包含 E01-E05 全部五条（引用族 + 自洽族 + `auditPanelSize`），所以五个历史错误今天都属于「模型错」分档。
- `call.trip({spent})` 对“模型错”**不记 `failure`**：账上是 3 次成功往返、`failures` 缺席（E2：`compile-runtime.test.ts:203-211`；E3 探针 H3）。

### 1.3 每步失败分档

| 步 | 触发 | `CommandError.kind` / 退出码 | 重采样 | 落盘 | `game-configs` 版本号 | 证据 |
|---|---|---|---|---|---|---|
| 设计 JSON 读不出 | `ops.ts:1042` | `invalid` / 4 | 否 | 否 | 否 | E1 |
| 设计不过 schema | `:1048` | `invalid` / 4 | 否 | 否 | 否 | E1 + E2（`compile-runtime.test.ts:440-448`） |
| 外壳 profile 不存在 | `:1056` | `invalid` / 4 | 否 | 否 | 否 | E2（`:431-438`） |
| config shape 不存在 | `:1061` | `invalid` / 4 | 否 | 否 | 否 | E1 |
| 没有 `manifest.json` | `:1066` | `usage` / 2 | 否 | 否 | 否 | E2（`:249-254`） |
| manifest 不过 schema | `:1068` | `invalid` / 4 | 否 | 否 | 否 | E1 |
| 关卡 id 不存在 | `:1072-1074` | `usage` / 2 | 否 | 否 | 否 | E2（`:423-429`） |
| 缺文本上游凭据 | `:1080-1083` | `upstream` / 3 | 否 | 否 | 否 | E2（`:234-247`） |
| 循环内上游失败（http/timeout） | `:1167-1170` | `upstream` / 3 | 否（立即抛） | 否 | 否 | E1 |
| 循环内 `not-sent` | `:1177` | `upstream` / 3 | 否 | 否 | 否 | E1（该档在本路“不该出现”） |
| 循环内线形状/工具形状失败 | `:1178` | —（continue） | 是，直至 3 发 | 否 | 否 | E1 + E2（`:193-201`） |
| `parseGameConfig` 不过 v3 契约 | `:1181-1187` | —（continue，`failure:"schema"`） | 是 | 否 | 否 | E1 + E2（`:257-267`） |
| `modelHard` 非空（引用/自洽/HUD/身份） | `:1193-1207` | —（continue，`spent` 记账） | 是，直至 3 发 | 否 | 否 | E1 + E2（`:130-230`）+ E3（H3） |
| 循环耗尽 | `:1209` | `invalid` / 4 | 否（已用尽 3 发） | 否 | 否 | E2（`:193-211`） |
| 循环后四族 hard（实际只剩层覆盖） | `:1229-1235` | `invalid` / 4 | 否 | 否 | 否 | E2（`:462-517`：`attempts:1`、无 `schema`） |
| 成功 | `:1236-1240` | — | — | 是 | **是**（`nextVersion`） | E2（`:99-113`） |

补充：

- **退出码**只住一处：`packages/contracts/src/command.ts:46`（`ok 0 / failure 1 / usage 2 / upstream 3 / invalid 4`）。
- **失败时不建目录**：`mkdirSync` 在全部审计之后（`:1237`），所以 `out/` 不存在；测试直接断言这一点（`compile-runtime.test.ts:141`、`:490`）。
- **build 链的版本号语义不同**：`runBuild` 在理解段已经分配了 `run/vN` 与 `pack/vN`；`compileRuntime` 在临时 staging 里写的是 `v1`，随后重命名成 `run/vN/game-config.json`。编译失败不会回滚已存在的 `run/vN` / `pack/vN`（E1：`create-game.ts:592-605`）。
- **`reuseConfig` 的失败分档不同**：`parseGameConfig` + `auditReferences` 失败即 `invalid`，不重采样、不写入；但自洽族、`auditPanelSize`、`auditEntityIdentity`、`auditScreenSpace`、`auditLayerCoverage` 都不在 `:485` 这一处（E1）。

---

## 2. 所有 `audit*` 函数、职责与调用点

### 2.1 `ConfigIssue` 家族（本图相关）

| 函数 | 定义 | 返回形态 | 严重度 | 职责 | 调用点（生产） |
|---|---|---|---|---|---|
| `auditReferences` | `contracts/src/game-config.ts:304` | `ConfigIssue[]` | 只 `error` | 引用族：kind 锁、`resolvePackRef`、obj gate、至少 1 pickup、player 三动画互异 | `compileRuntime` 经 `auditGameConfig`；QA `gameplay.ts:79`；`parseReusedConfig` `create-game.ts:485` |
| `auditGameConfig` | `game-config.ts:427` | `ConfigIssue[]` | error + warning | 引用族 + 自洽族（实体/地形/玩家出界、出生点卡 solid）+ `auditPanelSize` + 台阶高/行程越界警告 | `compileRuntime` `ops.ts:1194,1220`；`site` `demo/src/site.ts:191` |
| `auditPanelSize` | `game-config.ts:404` | `ConfigIssue \| null` | `error` | 声明尺寸 vs 包尺寸：九宫格放行，非九宫格要求相等 | `auditGameConfig:479`；`auditTdConfig:561`（panel/buttons/start） |
| `auditScreenSpace` | `contracts/src/screen-space.ts:49` | `ConfigIssue[]` | 只 `error` | HUD 整盒/文字高必须落在视口内；“量不了”也是 error | `compileRuntime` `ops.ts:1196,1222`；`compileTdGame:1428`；`site` `site.ts:210`；`td/site.ts:130` |
| `auditLayerCoverage` | `contracts/src/layer-coverage.ts:137` | `ConfigIssue[]` | 只 `error` | 每层背景按 parallax/tileable 最坏情况必须盖住视口 | `compileRuntime:1224`；QA `layers.ts:58`；`site` `auditGeometry:43` |
| `auditReachability` | `contracts/src/reachability.ts:44` | `ConfigIssue[]` | 只 `error` | 从出生点用“最宽能力上界”做 BFS，只报够不到的 pickup/goal | **仅 QA** `gameplay.ts:80`；**不在** `compileRuntime` / `site`（`contracts/src/index.ts:145-147` 自白） |
| `auditEntityIdentity` | `game-config.ts:559` | `ConfigIssue[]` | 只 `error` | 设计四桶实体 ↔ config `sourceIntent`：coverage / 悬空 / wrong-scope / 桶→kind 兼容 | `compileRuntime:1195,1221`；QA `visual.ts` 只用 `DESIGN_BUCKET_KINDS`，不调它 |

### 2.2 其它 `audit*`（同仓，非本图五错误的直接判据）

| 函数 | 定义 | 返回 | 调用点 |
|---|---|---|---|
| `auditTdConfig` | `contracts/src/td-config.ts:381` | `ConfigIssue[]`（error+warning） | `compileTdGame` `ops.ts:1424`；`td/site.ts:142` |
| `auditTdWorldSize` | `td-config.ts:634` | `ConfigIssue[]`（error） | `compileTdGame:1426`；`td/site.ts:143` |
| `auditGeometry`（横版站点） | `demo/src/site.ts:37` | `ConfigIssue[]`（error+warning） | `site.ts:205` |
| `auditTdGeometry` | `demo/src/td/site.ts:25` | `ConfigIssue[]` | `td/site.ts:145` |
| `auditWinnable` | `demo/src/td/winnable.ts:84` | `ConfigIssue[]`（error+warning） | `td/site.ts:134,147` |
| `auditAssetSpec` | `contracts/src/audit.ts:45` | `string[]`（**不是** `ConfigIssue`） | pack/acceptance |
| `auditIntentCoverage` | `contracts/src/intent-coverage.ts:110` | `MissingIntentItem[]`（**不是** `ConfigIssue`） | QA intent 族 |
| `auditSheetCells` | `assets/src/sheet.ts:244` | `SheetCellIssue[]` | 图集切格 |

### 2.3 CLI / MCP 的调用位置

CLI 与 MCP **不直接调用任何 `audit*` 函数**：它们只调 `compileRuntime`（CLI `cli.ts:673-689`；MCP `server.ts:340-349`）或 `assembleSite`（CLI `cli.ts:704-728`；MCP `server.ts:438-445`），再由这些 core 函数调用审计。CLI/MCP 能看到的只有 `CommandResult`（summary/data）或 `CommandError.message`，没有 `ConfigIssue[]`（E1）。

### 2.4 严重度分档的事实

- `ConfigIssue` 只有 `severity: "error" | "warning"`、`where`、`message`（`game-config.ts:281-285`）。没有 `code` / `entityId` / `field` / `assetId` / `expected` / `actual`。
- 硬失败 = `severity === "error"`；`warning` 只由 `auditGameConfig` 的台阶高/行程越界（`game-config.ts:506,512`）、`auditGeometry` 的近端探出与覆盖率观察等产生；在 `compileRuntime` 中 warning **不阻断**，只在成功回报的 `summary`/`data.issues` 里出现（`ops.ts:1249-1256`）。
- `auditReachability` 的严重度是 `error`，但只由 QA 消费；因此它在链上是“QA 阶段硬失败”，不是编译期硬失败（`reachability.ts:217-218`、`qa/src/gameplay.ts:80`）。

---

## 3. 槽位 kind 锁矩阵

### 3.1 横版 `game-config/v1`

| 槽位 / 字段 | 代码位置 | 要求 `AssetKind` | 结果 |
|---|---|---|---|
| `scene.background.asset` | `game-config.ts:337` | `background` | 有锁 |
| `player.asset` | `game-config.ts:340` | `animation` | 有锁 |
| `player.anims.{idle,run,jump}` | `game-config.ts:343-344` | 逐个 `resolvePackRef`；不额外锁 kind（受 `player.asset` 锁约束） | 有解析校验 |
| `entities[].asset`，`kind:"solid"` | `game-config.ts:370-372` | `sprite` | 有锁 |
| `entities[].asset`，`kind:"pickup"` | `game-config.ts:370-372` | 无 | **没有锁** |
| `entities[].asset`，`kind:"hazard"` | 同上 | 无 | **没有锁** |
| `entities[].asset`，`kind:"goal"` | 同上 | 无 | **没有锁**（只要求 `objective.gate` 指向某个 goal 实体，`:376-378`） |
| `entities[].asset`，`kind:"chest"` | 同上 | 无 | **没有锁** |
| `entities[].asset`，`kind:"danger"` | 同上 | 无 | **没有锁** |
| `entities[].asset`，`kind:"decor"` | 同上 | 无 | **没有锁**（源码明确说明：装饰可以是 sprite / animation / ui，`game-config.ts:366-369`） |
| `hud.panel.asset` | `game-config.ts:373` | `ui` | 有锁 |
| `hud.pip.asset` | `game-config.ts:374` | `ui` | 有锁 |
| `objective.gate` | `game-config.ts:376-378` | 指向存在的 `kind:"goal"` 实体 | id 对账 |
| `terrain[]` | `game-config.ts:215-222` | 不引用资源 | 无资源语义 |

**没有 kind 锁的槽位清单（横版）：`pickup`、`hazard`、`goal`、`chest`、`danger`、`decor`。**

注意：即使有锁的槽位也只锁**格式**，不锁**语义**：`solid` 接受任何 `sprite`（包括玩法 sprite），`ui` 接受任何 `ui`，`animation` 接受任何 `animation`。`role` 是自由文本，当前没有任何审计读它（E1：`assetpack.ts:166`；`auditReferences` 只用 `kind`）。

### 3.2 实体 kind → 设计桶（身份层，不是资源层）

`DESIGN_BUCKET_KINDS`（`game-config.ts:534-539`）：

| 设计桶 | 允许的运行时 `EntityKind` |
|---|---|
| `enemies` | `hazard`, `danger` |
| `npcs` | `decor` |
| `interactables` | `chest`, `pickup`, `goal`, `hazard`, `danger`, `solid` |
| `resources` | `pickup` |

这张表只把“设计对象”对到“实体 kind”，不把“实体 kind”对到“资源 kind”。六种无锁 kind 因此是设计对象 → 资源语义链上的空档（§7.1）。

### 3.3 塔防 `td-config/v1`（参照）

`auditTdConfig` 的 kind 锁（`td-config.ts:410-427`）：`scene.slot` / `scene.slotActive` / `core` → `sprite`；`arena.tiles` → `sprite | animation`；tower / projectile → `sprite | animation`；tower fx → `animation`；enemies → `animation`；`hud.panel` / `hud.buttons` / `hud.start` / `hud.icons.*` → `ui`。塔防这些槽位没有“无锁”项。

---

## 4. 五个历史错误的逐项复核

历史证据：`.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/stage-b.log`。真实产物：同目录 `rust-city-scavenger/pack/v1/manifest.json`（`chest` 32×24 非九宫格、`resource-item` 16×16 sprite、`scavenger-hero` animation 含 idle/run/jump）。

| 编号 | 历史捕获方式 | 当前实现位置 | 当前回归测试 | 同形态？ |
|---|---|---|---|---|
| E01 `block-1` 用 `scavenger-hero` | `resolvePackRef`：多动画未指明 anim（历史消息） | `auditReferences` 的 `solid -> sprite` kind 锁，先于 `resolvePackRef`（`game-config.ts:317-327,370-372`）；当前消息 `"scavenger-hero" 是 animation，这里要的是 sprite` | `packages/contracts/tests/game-config.test.ts:181-185`，`it("recipe-config-gap-v1 票 05：solid 实体只能引用 sprite —— 拿玩家动画当地形被拒")`；断言 `toMatch(/是 animation，这里要的是 sprite/)` | **同槽位、同错误类、不同消息**（历史是间接的“缺 anim”，今天是直接 kind 拒绝）。用例 id 就是 `block-1`，与 E01 同形 |
| E02 `slope-1` 用 `scavenger-hero` | 同 E01 | 同 E01（`solid` 是唯一地形实体槽；GameConfig 没有独立 `slope` 槽位，`EntityKind` 见 `game-config.ts:51`） | 没有以 `slope-1` 命名的用例；由上一行同一实现覆盖 | **同实现，无独立用例**。E02 不是独立槽位，不能要求单独 kind 锁 |
| E03 `hud.panel` 用 `chest`（sprite） | `kindOf` 的 `hud.panel -> ui`（历史消息与今天模板相同） | `game-config.ts:373`，消息 `"chest" 是 sprite，这里要的是 ui` | 横版：`game-config.test.ts:172-179`，`it("资源种类不对 → 报出来（把背景当玩家是最容易犯的那个）")`，断言 `/是 animation，这里要的是 ui/`（用的是 `player-traveler`，不是 sprite）。塔防：`td-config.test.ts:107-111` 用 `tower-nailgun`（sprite）断言 `/... 是 sprite，这里要的是 ui/` | **不同形态**：横版直接测试只覆盖 `animation -> ui`；`sprite -> ui` 只在塔防 `hud.panel` 有测试。没有 `compile-runtime` 端到端用例 |
| E04 `hud.pip` 用 `resource-item`（sprite） | `kindOf` 的 `hud.pip -> ui` | `game-config.ts:374`，消息同上 | **没有负向测试**。`hud.pip` 只出现在正向夹具（`fixtures/game-configs/last-train.json:22`、`game-config.test.ts:40`）与运行时 pip 布局测试（`demo/tests/world.test.ts:130-131`） | **缺失** |
| E05 `hud.panel.size` 72×32 vs `chest` 32×24 非九宫格 | `auditPanelSize`（历史消息逐字） | `game-config.ts:404-425`，由 `auditGameConfig:479` 调用 | `game-config.test.ts:429-447`，`it("负例：非九宫格 + 声明 ≠ 包 ⇒ **报错**（`hud-pip` 包里那一件没有 `scale9Borders`）")`；断言 `/不是九宫格/`、`/12×12/`；另有正例 `:435-437`（九宫格 + 声明≠包放行）与非九宫格相等放行 `:445-447` | **同形态**（非九宫格 + 声明≠包 + error），只是夹具从 `chest` 32×24 换成 `hud-pip` 12×12 |

逐项结论：

- **E01/E02**：仍被拦截，且比历史更直接。历史上“拿玩家动画当地形”要走到 `resolvePackRef` 才以“缺 anim”失败；今天 kind 锁先拒，错误定位更准。**但只对“animation 型角色”成立**；如果角色被产成单帧 `sprite`，同一语义错误会通过（§7.1 G2）。
- **E03/E04**：仍被拦截（`hud.panel` / `hud.pip -> ui`）。此外，历史清单 0 件 `ui` 资源会在上游 `hudUiGate` 被拒（E3 H4），所以 E03/E04 的**根因**今天在规划层就被挡住（条件：设计声明 `hud:screen-space`）。
- **E05**：仍被拦截，消息模板与历史逐字同源；测试同形态。
- **分档变化**：五项在 `compileRuntime` 中全部进入 `modelHard`，于是今天都是“3 发重采样后仍失败 ⇒ invalid / 不落盘 / 不消耗版本号”（E3 H2/H3）。历史日志的“不重采样”只对应 2026-10-23 当时的行为。
- **检测面矩阵**（同一份坏配置在各阶段是否会被看见）：

| 阶段 | E01 | E02 | E03 | E04 | E05 |
|---|---|---|---|---|---|
| `compileRuntime` | 是（modelHard） | 是（modelHard） | 是（modelHard） | 是（modelHard） | 是（modelHard） |
| QA `reference-resolution`（`auditReferences`） | 是 | 是 | 是 | 是 | **否**（`auditPanelSize` 不在 `auditReferences`） |
| `site` 装配（`auditGameConfig`） | 是 | 是 | 是 | 是 | 是 |
| `parseReusedConfig` | 是 | 是 | 是 | 是 | **否** |

（E1：`ops.ts:1193-1207,1219-1227`；`qa/src/gameplay.ts:79`；`demo/src/site.ts:191`；`pipeline/src/create-game.ts:485`。）

---

## 5. 现有正/负测试覆盖与遗漏

### 5.1 按槽位 / 错误族

| 槽位 / 规则 | 正向验收 | 负向（确定性） | 判定 |
|---|---|---|---|
| `player -> animation` | `game-config.test.ts` 的 `base()`；`recipe-config-acceptance.test.ts:28-40` | `game-config.test.ts:172-175` 把 background 当 player | 有正有负 |
| `solid -> sprite` | `base()` 的 `luggage`；`recipe-config-acceptance.test.ts` | `game-config.test.ts:181-185`（animation -> solid） | 有正有负 |
| `hud.panel -> ui`（animation 形态） | `base()`；`recipe-config-acceptance.test.ts` | `game-config.test.ts:177-178` | 有负（但形态是 animation） |
| `hud.panel -> ui`（sprite 形态，横版） | 同上 | **无**（只在塔防 `td-config.test.ts:109-111`） | 漏 |
| `hud.pip -> ui` | `base()`、`last-train.json` | **无** | 只有正向 |
| `scene.background -> background` | `base()` | QA：`qa/tests/gameplay.test.ts:81-85`（player 当 background） | 有负（在 QA 层） |
| `pickup/hazard/goal/chest/danger/decor` 的 kind | 各有正向实体 | **不存在规则，因此无负向** | 空档 |
| 动画名存在 | 真夹具 | `game-config.test.ts:193-197`（`walk`）；QA `gameplay.test.ts:73-79` | 有正有负 |
| 多动画未指明 anim | 真夹具 | `resolvePackRef` 路径；但横版无专门用例（E01 历史形态被 kind 锁改写） | 间接 |
| player 三格互异 | `game-config.test.ts:230-232` | `:234-250`（全同、两格同） | 有正有负 |
| `chest` / `danger` 的状态帧 | schema 正例 `game-config.test.ts:213-219` | **无规则、无测试** | 空档 |
| 非九宫格声明尺寸 | `:445-447` | `:439-444` | 有正有负 |
| 九宫格声明≠包 | `:435-437` | —（该形态本身合法） | 正向 |
| 九宫格最小尺寸/边框适配 | **无测试** | **无规则** | 空档 |
| HUD 屏幕空间 | `base()` | `game-config.test.ts:336-345`；`compile-runtime.test.ts:152-158` | 有正有负 |
| 层覆盖 | `layer-coverage.test.ts:35-45` 等 | `layer-coverage.test.ts:54-105`；`compile-runtime.test.ts:487-507`；QA `layers.test.ts` | 有正有负 |
| `auditEntityIdentity` | `game-config.test.ts:453-545`、`:547-630` | 同组负例；QA `entity-identity.test.ts:92-114` | 有正有负 |
| `auditReachability` | `reachability.test.ts:35-52` | `:54-77`、`:95-116`；QA `gameplay.test.ts` | 有正有负 |
| `clampToWorld` | `compile-runtime.test.ts:169-177` | —（它是确定性修复，不是判据） | 正向 |
| 五个历史错误在 `compile-runtime` 端到端 | **无** | **无** | 漏 |

### 5.2 “只有正向验收、没有确定性负向测试”的清单

1. **`hud.pip -> ui`（E04）**：没有负向测试。
2. **横版 `hud.panel` 的 `sprite -> ui`（E03 的精确形态）**：没有横版负向测试；只有塔防同族。
3. **`chest` / `danger` 的资源必须带状态帧**：规则不存在，测试也不存在（§7.2）。
4. **九宫格面板的最小尺寸 / 边框适配**：规则与测试都不存在（§7.3）。
5. **非锁定 kind 的 `EntityKind -> AssetKind`**：规则不存在，测试也不存在（§7.1）。
6. **五个历史错误的 `compileRuntime` 端到端回归**：测试只到纯函数层或别的槽位/格式；没有一条用 `compileRuntime` + mock fetch 断言“五条 error、3 发、不落盘”。
7. **`reuseConfig` 的自洽族/HUD 尺寸/身份审计**：无负向测试（因为它确实没跑这些审计）。

---

## 6. `ConfigIssue` 全部消费点（形态清点，不评方案）

### 6.1 类型与生产者

- 类型：`{ severity: "error" | "warning"; where: string; message: string }`（`contracts/src/game-config.ts:281-285`）。
- 生产者：§2.1 的七个函数 + §2.2 的 `auditTdConfig` / `auditTdWorldSize` / `auditGeometry` / `auditTdGeometry` / `auditWinnable`。
- `auditAssetSpec` / `auditIntentCoverage` / `auditSheetCells` 返回各自的字符串/结构，**不是** `ConfigIssue`。

### 6.2 消费者与投影形态

| 消费点 | 位置 | 输入 | 输出形态 | 信息损失 |
|---|---|---|---|---|
| `compileRuntime` 循环内 | `ops.ts:1193-1207` | 三族 `ConfigIssue[]` | 过滤 `error`；拼 `  · ${where}: ${message}`（最多 6 条）进 `lastError` | 丢掉 warning；丢掉 `severity`（已过滤） |
| `compileRuntime` 循环后 | `ops.ts:1219-1235` | 四族 `ConfigIssue[]` | hard -> `CommandError("invalid")` 多行字符串（最多 6 条）；warning -> summary 行 | 超过 6 条只显示前 6；无结构化字段 |
| `compileRuntime` 成功回报 | `ops.ts:1249-1256` | 四族 `ConfigIssue[]` | `data.issues: string[]`，每项 `"⚠️ ${where}: ${message}"`；summary 同 | `severity` 被压进字符串前缀 |
| `compileTdGame` | `ops.ts:1422-1430` | `auditTdConfig` / `auditTdWorldSize` / `auditScreenSpace` | `string[]`，每项 `❌/⚠️ where: message` | 同 |
| QA `reference-resolution` / `reachability` | `qa/src/gameplay.ts:77-83,96-107` | `auditReferences` / `auditReachability` | **一条** `QAFinding`：`target:"game-config"`、`detail` 为逐行 `where: message`、`severity` = 任一 error 则 error | 逐条粒度合并；`where` 只活在 detail 文本里 |
| QA `layer-coverage` | `qa/src/layers.ts:58,70-80` | `auditLayerCoverage` | **每条 issue 一条** `QAFinding`：`target` = 层名或 `"scene.background"`、`detail` = message、`severity` 照搬 | `where` 不保留（换成 target） |
| QA `visual-config-coherence` | `qa/src/visual.ts:196-293` | 不消费 `ConfigIssue`；自己产 `QAFinding` | `target` = 设计 id、`severity` error/warning | 不在本表 |
| QA 合成器 | `qa/src/assemble.ts:78-104` | 各族 `QAFinding` | `QAReport.failures`（`qa.ts:370-384`） | `ConfigIssue` 已在上游投影掉 |
| `site` 横版 | `demo/src/site.ts:191-217`；`layout.ts:54-57` | `auditGameConfig` + `auditScreenSpace` + `auditGeometry` | error -> `CommandError("invalid")` 多行；warning -> summary + `data.warnings: string[]` | 全部 error 一次报全；warning 字符串化 |
| `site` 塔防 | `demo/src/td/site.ts:141-149,165-177` | 五族 | 同上 | 同上 |
| `parseReusedConfig` | `pipeline/src/create-game.ts:482-489` | 仅 `auditReferences` | error -> `CommandError("invalid")` 单行拼接（最多 6） | 无 warning；无其余审计 |
| CLI | `packages/cli/src/cli.ts:901` | `CommandResult`，不是 `ConfigIssue` | `--json` 打印整个 result（含 `data.issues` 字符串）；人类模式打印 `summary` | 无结构化 issue |
| MCP | `packages/mcp/src/server.ts:452-484` | `CommandResult` / `CommandError` | 成功：`content[0].text = summary.join("\n")` + `structuredContent = result`；失败：`✗ ${message}` + ledger/failureDir | MCP 文本面没有 issue 列表；`structuredContent` 里只有字符串数组 |

`ConfigIssue` 的**全部**字段就是 `severity` / `where` / `message`。除 `compileRuntime` 内部过滤 `severity` 外，所有消费者都只做字符串拼接；没有任何消费者读取 `code` / `entityId` / `field` / `assetId` / `expected` / `actual`（它们不存在）。

---

## 7. 其它语义约束的残余缺口（证据，不评方案）

### 7.1 设计对象 ↔ 资源语义

**G1：`EntityKind -> AssetKind` 只覆盖 5 个槽位。**
`auditReferences` 只对 `scene.background` / `player` / `solid` / `hud.panel` / `hud.pip` 传 `kinds`；其余实体 kind 走 `ref(..., undefined)`（`game-config.ts:370-374`）。E3 探针（§8 G1）：
- 设计 `enemies[]` 的 `e-1` → config `hazard` → 资源 `hud-pip`（`ui`）：`compileRuntime` 成功、`version = 1`、文件已写。
- `pickup` → `bg-dusk-halt`（`background`，3 帧）：`auditGameConfig` 零 issue（放在世界内时）。
- `hazard` → `hud-pip`、`pickup` → `hud-pip`、`chest` → 单帧 sprite、`danger` → 单帧 sprite：均零 issue。
- 对照：`player` → sprite、`scene.background` → sprite、`solid` → ui 均报 error，证明锁本身有效。

**G2：`sprite` 内部不区分“地形 / 角色 / 道具”。**
`solid` 锁只要求 `sprite`。用真实夹具 `pickup-suitcase`（`role:"失物收集物"`，sprite）作为 `solid`，`auditGameConfig` 零 issue（E3 探针 G2）。`role` 是自由文本（`assetpack.ts:166`），没有任何审计读取它。因此 E01/E02 的**错误类**（把玩法对象当地形）只有在角色恰好是 `animation` 时才被拦；若角色/道具被产成单帧 `sprite`，同一错误会通过。

**G3：设计桶只约束实体 kind，不约束资源 kind。**
`DESIGN_BUCKET_KINDS` 把 `enemies -> {hazard,danger}`、`resources -> {pickup}` 等（`game-config.ts:534-539`）；结合 G1，六种无锁 kind 让“设计敌人用 ui 图标”“设计拾取物用背景”这类组合合法通过。E3 G1 已用真实 `compileRuntime` 证明。

### 7.2 动画引用完整性

**已覆盖：**
- 引用资源不存在（`kindOf` 第一支，`game-config.ts:321`）。
- `anim` 名字不存在（`resolvePackRef`，`assetpack.ts:405-410`）。
- 多动画未指定 `anim`（`assetpack.ts:421-426`）。
- player 三格必须解析到三个不同动画名（`game-config.ts:351-366`），且逐格解析（`:343-344`）。
- `anim` 指向单帧/无动画资源会报“没有名为…的动画”（`assetpack.ts:405-410`）。

**缺口：**
- **`chest` / `danger` 的状态帧没有约束。** Runtime 用 `frames[frames.length-1]` 当打开/喷发帧；资源只有一帧时 `openFrame` / `activeFrame` 为 `undefined`，状态切换在视觉上静默（`demo/src/world.ts:184-185`、`demo/src/shell/scene.ts:175-195`）。E3 探针 G1：`chest`/`danger` 引用单帧 sprite，`auditGameConfig` 零 issue。
- **多帧 `background` 被当作实体引用时会当动画循环播放。** `resolvePackRef` 对 `background` 返回全部层帧（`assetpack.ts:420`）；Runtime 对非 chest/danger 且 `frames.length > 1` 的实体建循环动画（`demo/src/shell/scene.ts:142-147`）。E3 探针 G1 的 `pickup -> background` 在 `auditGameConfig` 零 issue；它是否在运行时“看起来像一摞背景在循环”取决于位置，但配置层没有任何拒绝。
- 没有“动画帧数 ≥ 2”这类通用约束；`animation` 资源是否真的多帧由 pack 契约保证（`AssetPackEntry` 的动画帧分组），但**按槽位消费**的状态帧没有检查。

### 7.3 UI 能力与尺寸

**已覆盖：**
- `hud.panel` / `hud.pip` 必须是 `ui`（`game-config.ts:373-374`）。
- 非九宫格且声明尺寸 ≠ 包尺寸 ⇒ error（`auditPanelSize:404-425`，调用 `:479`）。
- 九宫格且声明尺寸 ≠ 包尺寸 ⇒ 放行（同一函数；正例 `game-config.test.ts:435-437`）。
- HUD 整盒/文字高必须落在视口内（`screen-space.ts:49-78`）；横版 `panel` 与每个 `pip` 都有 box（`screen-space.ts:86-107`）。
- 塔防 `panel` / `buttons` / `start` 共用同一判据（`td-config.ts:556-564`）。

**缺口：**
- **九宫格的最小尺寸 / 边框适配没有检查。** `auditPanelSize` 在 `scale9Borders !== undefined` 时直接放行（`game-config.ts:414`），不检查声明宽高是否 ≥ `left + right` / `top + bottom`。E3 探针 G3：`hud-lost-slots`（`scale9Borders {x:4,y:4,w:64,h:24}`，包 72×32）声明 1×1，`auditGameConfig` 与 `auditScreenSpace` 都是 0 条 issue。Runtime 的 Phaser `NineSlice` 会把宽度钳到 `leftWidth + rightWidth`（`packages/demo/node_modules/phaser/src/gameobjects/nineslice/NineSlice.js:724`，E1），于是**审计用的 1×1 盒子和实际画出的 8×8 盒子不一致**；若摆在视口右下角，实际绘制可能越界而审计不知道。`hudUiGate` 要求面板带 `ninePatch`，但没有校验它的边框与目标尺寸的关系（`ops.ts:303-309`）。
- **`hud.pip` 没有声明尺寸**，尺寸完全取自包（`Hud.pip` 只有 `asset/at/step`，`game-config.ts:194-198`）。这是契约设计，不是漏洞；但意味着 pip 的“显示尺寸 = 资源尺寸”没有第二条校验，只有 `auditScreenSpace` 用包尺寸算盒子。
- **上游闸与下游判据的口径不完全一致**：`hudUiGate` 无条件要求一件带 `ninePatch` 的 `ui` 面板（只要设计声明 `hud:screen-space`，`ops.ts:303-309`），而 `auditPanelSize` 允许“非九宫格 + 声明 == 包”的面板。于是“固定尺寸的非九宫格面板”在配置层合法、在上游规划层却被拒。E1；是否算缺口取决于 P0-B 的口径（记录事实，不评方案）。
- **设计能力与 config 结构的条件不一致（跨链事实）**：`GameConfigSchema` 把 `hud` 设为必填（`game-config.ts:223`），而 `hudUiGate` 只在设计 `runtimeRequirements` 含 `hud:screen-space` 时要求 ui 资源（`ops.ts:301`）。一个不带该能力的设计可以合法规划出“无 ui 资源”的清单，随后在 config 步被 E03/E04 的 kind 锁连拒 3 发——重采样 config 无法补出包里不存在的 ui。建议交上游票 02 裁定（E1）。

### 7.4 错误定位

- `ConfigIssue` 只有 `where`（人话）与 `message`（自由文本）。五条历史错误今天都在 `where` 里给出实体 id 或字段路径，在 `message` 里给出资源 id / 期望 / 实际：
  - E01/E02：`where = entity "block-1"`，message 含 `"scavenger-hero" 是 animation，这里要的是 sprite`。
  - E03/E04：`where = hud.panel` / `hud.pip`，message 含资源 id、实际 kind、期望 kind。
  - E05：`where = hud.panel.size`，message 含声明尺寸、包尺寸、非九宫格事实。
- 这与 PRD AC-03 的“具体实体 / 字段 / 资源 / 预期 / 实际”在**文本上**满足；在**结构上**不满足（没有稳定 `code`、没有独立字段）。这是 03 票 A/B 比较的事实输入，不在本票评方案。
- `auditReferences` 的 `kindOf` 在“资源不存在”那一支与 `resolvePackRef` 共用同一句措辞（`game-config.ts:321`、`assetpack.ts:379`），这是“同一事实同一句话”的现有纪律；kind 不匹配那一支是本函数自己的模板（`game-config.ts:323-324`）。

---

## 8. 验证命令与结果

全部零付费、零模型调用、零生图。`compileRuntime` / `planAssets` 探针使用 mock `fetch`，只写 `/tmp`，不触网络。

| 编号 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| T1 | `npx vitest run packages/contracts/tests/game-config.test.ts packages/contracts/tests/reachability.test.ts packages/contracts/tests/layer-coverage.test.ts packages/assets/tests/compile-runtime.test.ts packages/assets/tests/plan-hud-gate.test.ts packages/qa/tests/gameplay.test.ts packages/qa/tests/layers.test.ts` | 0 | 7 个文件、151 个测试全过（`game-config` 64、`compile-runtime` 33、`reachability` 20、`gameplay` 12、`layer-coverage` 12、`layers` 6、`plan-hud-gate` 4） |
| H1 | `node /tmp/gm-probe-hist.mjs`（真实历史 pack `rust-city-scavenger/pack/v1` + 复原配置） | 0 | `auditGameConfig` 恰好 5 条 error，逐条等于 E01-E05；`auditScreenSpace` 0 条（面板放在视口内） |
| H2 | `node /tmp/gm-probe-hist-e2e.mjs`（真实历史 design + pack + mock fetch 返回同一份坏配置） | 0（探针自身；`compileRuntime` 抛 `invalid`） | `calls = 3`、`written = false`、消息“模型错，3 发重采样后仍没写对”，列出五条 |
| H3 | `/tmp/gm-probe-five.mjs`（last-train 真包，逐项单独注入 E01-E05） | 0 | 四项都是 `kind=invalid`、`calls=3`、`written=false`；E05 连带屏幕空间 error（因面板位置） |
| H4 | `node /tmp/gm-probe-plan.mjs`（真实历史 design + 清单 + mock fetch，调用 `planAssets`） | 0（探针；`planAssets` 抛 `invalid`） | `calls = 3`、`outExists = false`；被 `hudUiGate` 拒：“清单缺 HUD 用的 `ui` 资源” |
| G1 | `/tmp/gm-probe-e2e.mjs`（设计 enemy → `hazard` → `ui`，mock fetch） | 0 | `RESULT ok = true version = 1`，`written = true`（真实落盘） |
| G1' | `/tmp/gm-probe2.mjs`（last-train 真包） | 0 | `pickup -> background` / `pickup -> ui` / `hazard -> ui` / `chest -> 单帧 sprite` / `danger -> 单帧 sprite` 均 `(no issues)`；对照 `player -> sprite` / `background -> sprite` / `solid -> ui` 均报 error |
| G2 | `/tmp/gm-probe4.mjs` | 0 | `pickup-suitcase`（玩法 sprite）作为 `solid` → `(no issues)` |
| G3 | `/tmp/gm-probe3.mjs` | 0 | 九宫格面板声明 1×1 / 8×8 / 7×8：`auditGameConfig` 与 `auditScreenSpace` 都是 0 条 |

说明：

- 探针脚本位于 `/tmp`，不在仓库内；报告只记录命令与结果，不提交脚本。
- `npx vitest` 的 workspace 包解析走 `node_modules` 的 `dist`（`package.json` 的 `exports` 指向 `dist`）。已核对 `packages/contracts/dist/game-config.js` 含当前 kind 锁消息、`packages/assets/dist/ops.js` 含 `hudUiGate`，与源码一致；行号结论以 `src` 为准（E1）。
- 未跑浏览器 / Phaser 运行时；§7.3 的“Phaser 钳到边框和”来自 vendored Phaser 源码（E1），不是浏览器实测（E3 未取得）。

---

## 9. 对 `map.md` 现状事实的两处更正

1. `map.md` 的“当前审计已有 kind 锁：`player→animation`、`solid→sprite`、`hud.panel/pip→ui`、`background→background`”正确（E1，`game-config.ts:337-374`）。
2. `map.md` / 票面引用的“五个错误当时全部已被现有审计捕获，运行按预期拒绝、不重采样、不落盘”只描述 **2026-10-23 当时**的行为。今天 `auditGameConfig` 在重采样循环内（`ops.ts:1193-1207`），五个错误都会触发 3 发重采样；仍然不落盘、不消耗版本号，但不是“不重采样”（E1 + E3 H2/H3）。这会影响 P0-B 对“残余缺口”的判断：问题不是“没被拦住”，而是“拦得晚 / 拦得窄 / 错误分档与历史不同”。

