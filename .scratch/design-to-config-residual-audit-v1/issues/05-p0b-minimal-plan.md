# P0-B 最小实施方案

Type: grilling
Status: resolved
Owner: main session · 2026-11-02
Blocked by: 03, 04
Map: ../map.md

## Question

只针对 04 已裁定「值得修复」的缺口，形成 P0-B 最小实施方案。**不实施**，只出方案。

### 必须交付

1. **真实残余问题定义**：每条问题一句话定义其失败形态与可观察后果。
2. **源码与历史证据**：复用 01/02/04 的 `file:line`、测试用例、历史日志位置。
3. **最小修改模块与调用链**：改哪个函数、放在哪一步、与现有审计的执行顺序；优先纯函数边界，
   不新增包、不改 Runtime、不新增第三方依赖。
4. **契约变更结论**：引用 03 的 A/B 建议；明确「需要 / 不需要 / 需 P1 单独批准」。
5. **确定性测试矩阵**：每个问题的最小正/负 fixture、预期错误定位、是否复用既有 fixture；覆盖
   边界情况，不只为五个历史 ID 写测试。
6. **零付费验证方案**：既有 fixture + mock transport + 真实产物重判的具体命令与预期产物；
   不包含 `create` 付费链。
7. **风险评估**：误拒合法配置、与 Runtime 行为漂移、错误定位不稳定、QA/site 同步风险；每条给
   缓解措施。
8. **Out of scope 清单**：与 map.md 的 Out of scope 对齐，不新增未裁定项。

### 约束

- **不修改代码、不修改契约、不新增 fixture 文件**；本票产出方案与测试矩阵设计。
- 若 04 的裁定为空集，本票不开；由 06 直接收口。

### 产出

- 本票追加 `## Answer`（方案摘要 + 测试矩阵 + 风险 + P1 审批问题），`Status` 改 `resolved`。

## Comments

**2026-11-02 · 04 移交（正式输入）**：范围 = A 类七项 **Q1、Q3、Q4、Q5、Q6、Q8、Q11**（见 [04 裁定表](04-residual-gap-ruling.md#裁定表)），B/D 类不在本票范围。建议优先顺序 **不是对生产代码修改的批准**：

1. **Q1 + Q3 + Q4**：补齐资源语义与表现能力校验。
2. **Q5**：统一确定性复验入口，消除路径绕过。
3. **Q6**：修复设计输出与配置强制条件之间的矛盾（方案由本票依源码确定）。
4. **Q8**：加强既有四桶覆盖闸的 kind 检查 —— 是**加强既有闸**，不是新增独立资源规划闸门；位置由本票确定。
5. **Q11**：为上述修改建立独立负向测试与合法配置回归（E02/E03/E04）。

约束：票 03 条件式 A 已触发（`code?: ConfigIssueCode`，闭集 union，只给新增/加强的错误写码，不 retrofit、不改 CLI/MCP/落盘）；全程零付费、不重新生成 Demo；Q5 的复验边界在方案中明确列出被统一入口覆盖的审计族。

## Answer

**方案结论：A 类七项均有源码落点，最小修改面为 `contracts`（3 个文件）+ `assets`（3 个文件）+ `pipeline`（1 个文件），不新增包、不改 Runtime、不新增第三方依赖。需要 P1 批准两项契约变更：`ConfigIssue.code`（票 03 条件式 A）与 `GameDesignSpecSchema.resources ≥ 1`。全程零付费。**

**本轮追加裁定（用户 2026-11-03，按推荐）**：Q6(b) = **B1**（设计层要求 ≥1 resource）；Q6(a) = **A1**（`hudUiGate` 与提示词无条件要求两件 ui）；Q5 = **C1**（`auditConfigPipeline` 统一入口）。

---

## 1. 真实残余问题定义

| # | 问题 | 失败形态 | 可观察后果 |
|---|---|---|---|
| P1 | 五类实体槽位无 asset-kind 锁（Q1） | 设计 enemy/pickup/goal/chest/danger 被规划成 `ui`/`background`，config 全链通过并落盘 | 交付一份"能跑但画错"的游戏，零报错 |
| P2 | `chest`/`danger` 不要求状态帧（Q3） | 单帧资源 ⇒ `openFrame`/`activeFrame` 为 `undefined`（`demo/src/shell/scene.ts:175-195`） | 开箱/打击发生了，画面无变化 |
| P3 | 九宫格声明尺寸无下界（Q4） | 声明 < 边框和 ⇒ Phaser 钳到边框和（`NineSlice.js:724`），而 `auditScreenSpace` 用声明尺寸算盒 | HUD 实际绘制位置与审计结论不一致，越界不被发现 |
| P4 | 两条复验路径绕过确定性审计（Q5） | `reuseConfig` 只跑引用族；人工改清单后的 `runBuild` 只重跑覆盖闸 | 坏配置落盘并交付；手工修配置/清单是官方支持的路径 |
| P5 | `hud` 必填 vs `hudUiGate` 条件触发（Q6a） | 设计未声明 `hud:screen-space` ⇒ 清单可无 ui ⇒ config 连拒 3 发后 `invalid` | 合法设计零交付，且已烧掉 3 次文本调用 |
| P6 | `resources: []` 合法 vs config 要求 pickup/chest（Q6b） | 同上：设计层允许、config 层必拒 | 合法设计零交付 |
| P7 | 覆盖闸不查 kind（Q8） | 错误 kind 的资源先付费生成，到 config 才被下游 kind 锁拒绝 | 生图费用已经发生；`plan` 的重采样也救不回已花的钱 |

**验证缺口（Q11）**：E02 无独立用例、E03 只有 `animation→ui` 形态、E04 完全无负向测试；上述新判据没有回归基础。

## 2. 源码与历史证据

| # | 证据 |
|---|---|
| P1 | `contracts/src/game-config.ts:370-374`（只锁 `solid`/`hud`）；E3：enemy→hazard→ui、pickup→background 全链落盘（`research/01-downstream-audit.md`） |
| P2 | `contracts/src/game-config.ts:366-381`（实体循环只解引用）；运行时 `demo/src/shell/scene.ts:175-195`、`world.ts:184-185`；历史 81 处 chest 单帧（全部在 `.scratch/` 冻结产物） |
| P3 | `contracts/src/game-config.ts:404-425`（见到 `scale9Borders` 直接 return null）；`assets/src/pack.ts:257-261`（中央矩形）；Phaser `NineSlice.js:724`（width clamp） |
| P4 | `pipeline/src/create-game.ts:482-489`（`parseReusedConfig` 只跑 `auditReferences`）；`create-game.ts:610-612`（两条路径唯一汇合点） |
| P5 | `contracts/src/game-config.ts:223`（`hud: Hud` 必填）；`assets/src/ops.ts:300-314`（条件触发）；`assets/src/prompt.ts:919`（同条件） |
| P6 | `game-design/src/prompts.ts:273`（明说可为空）；`contracts/src/game-config.ts:380-381`（`pickupCount === 0` 报错）；`contracts/src/game-config.ts:534-539`（只有 `resources` 桶保证 pickup） |
| P7 | `assets/src/ops.ts:266-286`（只查 id/characterId）；`assets/src/prompt.ts:919-925` 与 `hudUiGate` 同档 |
| Q11 | `contracts/tests/game-config.test.ts:172-185,435-444`；`assets/tests/plan-hud-gate.test.ts`、`plan-coverage-gate.test.ts` |

**语料自证（2026-11-03 实测，零网络）**

- Q1：120 份 `game-config/v1`（`out/` + `fixtures/` + `.scratch/`）→ **0 处误伤**。
- Q3：当前 `fixtures/` 与 `out/` → **0 处**；历史冻结产物 **81 处** chest 单帧（证明判据会真实响）。
- Q4：23 份横版配置 + 全部塔防真配置 → **0 处**低于下界。
- Q6a：37/37 真实设计都声明 `hud:screen-space`；Q6b：37/37 `resources` 非空。
- Q8：真实清单中 enemies/interactables/resources 只出现 `sprite`/`animation`；npcs → `decor`（不受限）。

## 3. 最小修改模块与调用链

### 3.1 `packages/contracts/src/game-config.ts`

1. **`ENTITY_ASSET_KINDS`**（紧邻 `EntityKind`，单一来源）：
   `solid → ["sprite"]`；`pickup/hazard/goal/chest/danger → ["sprite","animation"]`；`decor → undefined`（不加锁）。
2. **`auditReferences` 实体循环**（`:370-374`）：用上表取 allowed kinds；`chest`/`danger` 在 `ref()` 解析成功后检查 `res.frames.length >= 2`，否则 error（新 `code`）。
3. **`auditPanelSize`**（`:404`）：九宫格分支不再直接放行。由 `scale9Borders` + `asset.size` 算 `left/right/top/bottom`，判两条：
   - 中央区放得进资源：`b.x + b.w <= size.w && b.y + b.h <= size.h`；
   - 声明尺寸 ≥ 边框和：`declared.w >= left + right`（= `size.w - b.w`）、`declared.h >= top + bottom`。
   越界即 error（新 `code`）；两条都过才按原九宫格规则放行。**横版与塔防共用**，TD 三格自动受益。
4. **`ConfigIssueCode`**（票 03 形态）：`code?: ConfigIssueCode` 加在 `ConfigIssue` 上；闭集 union 三个值：
   `"entity-asset-kind"`（Q1）、`"entity-state-frames"`（Q3）、`"hud-panel-size"`（Q4）。不 retrofit 既有构造点。
5. **`DESIGN_BUCKET_ASSET_KINDS`**（紧邻 `DESIGN_BUCKET_KINDS`，`:534-539`）：由桶允许的 EntityKind 反向派生 —— 任一 kind 为 `undefined`（`decor`）则整桶不受限，否则取并集。结果：`enemies/interactables/resources → ["sprite","animation"]`，`npcs → undefined`。

### 3.2 `packages/contracts/src/config-audit.ts`（新文件，纯函数）

```ts
export function auditConfigPipeline(config: GameConfig, ctx: {
  manifest: AssetPackManifest;
  design?: GameDesignSpec;
  levelId?: string;
  viewport: { w: number; h: number };
  hudLineHeight: number;
}): { resampleable: ConfigIssue[]; deterministic: ConfigIssue[] }
```
- `resampleable` = `auditGameConfig` + `auditEntityIdentity`（有 design 时）+ `auditScreenSpace`；
- `deterministic` = `resampleable` + `auditLayerCoverage`（内部调 `backgroundLayerEntries`）。
- 从 `contracts/src/index.ts` 导出；顺序与今天 `ops.ts:1194-1199` / `:1220-1226` 逐条一致。

### 3.3 `packages/assets/src/ops.ts`

1. **`designCoverageGate`**（`:266-286`）：`needAsset` 增加可选的 allowed kinds。先判覆盖是否存在（原错误不变），再判覆盖它的 spec 是否至少有一件 kind 合法；否则点名 id + "覆盖它的是 X，这里要的是 sprite / animation"。同一函数、同一档 `schema`、同一条重采样路，**不是新增闸门**。
2. **`hudUiGate`**（`:300-314`）：删除 `runtimeRequirements` 提前返回；消息改为"本代 config 结构上必填 hud"。
3. **`prompt.ts:919`**：HUD 要求段改为**无条件**输出（措辞同步改）。
4. **`compileRuntime`**：两处审计调用（`:1194-1199`、`:1220-1226`）改为 `auditConfigPipeline(...)`，按 `resampleable` / `deterministic` 取值；行为与分档不变。

### 3.4 `packages/pipeline/src/create-game.ts`

1. **汇合点统一复验**（`:610-612` 之后）：config 从磁盘读回后，调 `auditConfigPipeline(config.value, { manifest: manifest.value, design: designParsed.data, levelId: designParsed.data.levels[0]?.id, viewport: input.viewport ?? DEFAULT_VIEWPORT, hudLineHeight: input.hudLineHeight ?? DEFAULT_HUD_LINE_HEIGHT })`，`deterministic` 有 error ⇒ `CommandError("invalid", ...)`。
   - 这一段在 `reuseConfig` 与编译两条路径**之后**，因此两者天然同入口；
   - `parseReusedConfig` 保持原签名与"快速失败"职责，不改。
2. 补 `DEFAULT_HUD_LINE_HEIGHT` 导入（已在 `contracts` 导出）。

### 3.5 `packages/contracts/src/game-design.ts`

`superRefine` 增加：`resources.length === 0` ⇒ issue（path `["resources"]`），消息说明"config 的 objective 要求至少一个 pickup/chest；`interactables` 可能落成 goal/solid，不能保证；请至少写一个 resource"。设计生成侧已把 schema 失败归入 `schema` 档并重采样（`game-design/src/compile-design.ts:176-188`）。

### 3.6 调用顺序

```
design schema（含 resources ≥1）
  → planAssets: designCoverageGate（含 kind）→ hudUiGate（无条件）
  → compileRuntime: parse → clamp → auditConfigPipeline.resampleable（可重采样）
                   → auditConfigPipeline.deterministic（不可重采样，不落盘）
  → runBuild: 读回 config → auditConfigPipeline.deterministic（两条路径统一）
  → QA（auditReferences 自动获得 Q1/Q3 新判据）
```

## 4. 契约变更结论

| 变更 | 结论 | 依据 |
|---|---|---|
| `ConfigIssue.code?: ConfigIssueCode` + 3 个码 | **需要，P1 单独批准** | 票 03 条件式 A 已触发；只给本图新增错误写码，不 retrofit、不改现有消息/严重度/where |
| `GameDesignSpecSchema` 要求 `resources ≥ 1` | **需要，P1 单独批准** | Q6(b) = B1；设计契约变更，模型可重采样 |
| `hud` 保持必填 / `GameConfig` 形状不变 | **不需要变更** | Q6(a) = A1 走清单侧 |
| `AssetPackManifest` / CLI / MCP / 落盘产物 / `QAFinding` | **不改变** | 票 03 约束 |

## 5. 确定性测试矩阵

> 全部复用既有 fixture（`fixtures/packs/last-train/v2/manifest.json`、`fixtures/e2e/wasteland-platformer`）；边界用例在测试内联构造，**不新增 fixture 文件**。

| 用例 | 文件 | 形态 | 预期 |
|---|---|---|---|
| Q1 正例：pickup/hazard/goal 用 sprite 或 animation | `contracts/tests/game-config.test.ts` | `base()` 既有实体 + 一个 animation pickup | 无 kind 错误 |
| Q1 负例：pickup → `hud-lost-slots`（ui） | 同上 | 改 `entities[0].asset` | error，`/是 ui，这里要的是 sprite \/ animation/`，`code="entity-asset-kind"` |
| Q1 负例：hazard → `bg-dusk-halt`；goal → ui | 同上 | 各一条 | 同上 |
| Q1 回归：decor → ui / animation | 同上 | 既有 `decor` 用例 | **不报** kind 错误 |
| Q2 负例（Q11/E02）：`slope-1` solid → `player-traveler`（animation） | 同上 | 显式 id `slope-1` | `/是 animation，这里要的是 sprite/` |
| Q3 正例：chest 引用多帧动画 | 同上 | `chest` + `anim:"sweep"` | 无状态帧错误 |
| Q3 负例：chest / danger → `pickup-suitcase`（1 帧） | 同上 | 各一条 | error，`/至少需要两帧/`，`code="entity-state-frames"` |
| Q3 边界：恰好 2 帧 | 同上 | 内联 manifest | 不报 |
| Q4 负例：九宫格声明 < 边框和（含 1×1） | 同上 | `hud-lost-slots` 声明 1×1 | error，`code="hud-panel-size"` |
| Q4 负例：中央区放不进资源 | 同上 | 内联 manifest（`b.x+b.w > size.w`） | error |
| Q4 正例：声明 == 下界 / 既有真配置 | 同上 | 声明 8×8（last-train） | 不报；既有非九宫格用例不变 |
| Q5 负例：`reuseConfig` 带屏幕空间越界的合法 schema config | `pipeline/tests/create-game.test.ts` | 现有 harness + `reuseConfig` | `invalid`，消息含 `auditScreenSpace` 的 where |
| Q5 负例：build 后篡改 run 内 config 再 `runBuild` | 同上 | 改 `hud.panel.size` | `invalid`，消息含 `hud.panel.size` |
| Q5 正例：合法 config 复用 | 同上 | 既有 `parseReusedConfig` 用例 | 照常成功 |
| Q6a 负例：设计不声明 `hud:screen-space` + 清单无 ui | `assets/tests/plan-hud-gate.test.ts` | 去掉能力 + 去 ui | 3 发 `schema`，`invalid`，点名面板/图标 |
| Q6a 正例：同上但清单有两件 ui | 同上 | 补 ui | 通过、落盘 |
| Q6a 提示词：无条件含 HUD 要求 | `assets/tests/prompt.test.ts` | 不声明能力的 design | 提示词仍含两件 ui 要求 |
| Q6b 负例：`resources: []` | `contracts/tests/game-design.test.ts` | 内联设计 | schema 拒，path 指向 `resources` |
| Q6b 正例：≥1 resource | 同上 | 既有夹具 | 通过 |
| Q8 负例：enemy 的 spec.kind 改为 ui（id 不变） | `assets/tests/plan-coverage-gate.test.ts` | mock transport | 3 发 `schema`，消息点名 id + 期望 kinds，一页不落盘 |
| Q8 负例：characterId 覆盖但 kind 错 | 同上 | 改 spec.kind | 同上 |
| Q8 正例：npcs 由 ui 覆盖 | 同上 | decor 豁免 | 通过 |
| Q11 负例（E03/E04）：`hud.panel` ← sprite、`hud.pip` ← 资源 sprite | `contracts/tests/game-config.test.ts` | 各一条 | `/这里要的是 ui/`，补上独立断言 |

**错误码断言**：新增三类错误带 `code`；既有错误对象**没有** `code`（不 retrofit 的回归）。

## 6. 零付费验证方案

1. **单元/集成**（无网络）：
   `pnpm exec vitest run packages/contracts/tests/game-config.test.ts packages/contracts/tests/game-design.test.ts packages/assets/tests/plan-coverage-gate.test.ts packages/assets/tests/plan-hud-gate.test.ts packages/assets/tests/compile-runtime.test.ts packages/pipeline/tests/create-game.test.ts`
   预期：exit 0，全部通过。
2. **语料重判（只读脚本，不落盘、不联网）**：
   - `out/**` + `fixtures/**` 的 120 份 config 跑 `auditGameConfig` ⇒ **新增 error 数 = 0**（不误伤真产物）。
   - `.scratch/**` 冻结 config 跑同一判据 ⇒ 新增 error **恰为 81 条 chest 状态帧**（证明判据真实响）；**不修改、不重跑、不改写**这些历史证据。
3. **规划期闸门（mock transport）**：Q8/Q6a 用例走既有 `fetchImpl` 回放夹具清单，零模型调用、零生图。
4. **不执行** `create` 付费链；不调用任何 image transport。

## 7. 风险评估

| 风险 | 证据/评估 | 缓解 |
|---|---|---|
| Q1 误拒合法配置 | 120 份真实 config 0 违反；`decor` 与 `npcs` 豁免 | 锁表单一来源；真实包回归用例 |
| Q3 让历史产物"变红" | 81 处冻结产物会报；当前 `fixtures/`/`out/` 0 处 | 冻结证据不重跑、不改写；把 81 条记为"判据真实响"的证据 |
| Q4 波及塔防 | `auditPanelSize` 与 TD 共用；真实 TD 配置 0 违反 | 同一条判据覆盖三格；TD 既有测试回归 |
| Q5 重复校验/消息漂移 | 两条路径用同一函数、同一顺序；编译路径失败发生在返回前，不会双报 | 测试断言消息 where |
| Q5 多关卡假设 | `compileRuntime` 默认 `levels[0]`，`BuildInput` 无 `levelId` | 本图与今天生产链一致；多关卡另立 effort |
| Q6a 每份清单多两件 ui | config 本来就要求它们；37/37 设计已声明 HUD | 闸门提前到规划期，失败更便宜 |
| Q6b 设计层变严 | 0/37 真实设计资源为空；但"靠 chest interactable 满足 pickup"的设计会被要求补 resource | 错误消息写明原因；P1 明确批准 |
| Q8 上游误拒 | 真实清单只出现 sprite/animation；`npcs` 豁免 | 桶→kind 表由 `DESIGN_BUCKET_KINDS` 派生，不另写一份 |
| 错误定位不稳定 | 新错误沿用 `entity "<id>"` / `hud.panel.size` 既有格式 | 测试断言 `where` 字面量 |
| QA/site 同步 | QA 的 `reference-resolution` 调 `auditReferences`，自动获得 Q1/Q3；site 不改 | 不改两处实现，只改共享函数 |

## 8. Out of scope

与 `map.md` 对齐，本方案不涉及：Q2 sprite 语义 / `role`、Q7 reachability 并入 compile、Q9 上游诊断与重采样反馈 / viewport-role 贯通、Q10(a)(b)(c) 地形退化与设计表达限制、Q10(d) 设计 goal 桶、`interactables` 同桶误归属、`decor` kind 锁、P1 实施本身、CLI/MCP/落盘产物变更、任何付费调用。

## 9. P1 审批问题

1. 是否批准本方案的七项范围与 `file:line` 落点？
2. 是否批准 `ConfigIssue.code?: ConfigIssueCode` 与三个码（`entity-asset-kind` / `entity-state-frames` / `hud-panel-size`）？只给新增错误写码，不 retrofit。
3. 是否批准 `GameDesignSpecSchema` 的 `resources ≥ 1`（设计契约变更）？
4. 是否接受两处**行为收紧**：`reuseConfig`/`runBuild` 会拒绝更多输入；`planAssets` 会对错误 kind 的清单重采样/拒绝？
5. 是否确认：`hud` 仍必填、Runtime/CLI/MCP/落盘产物均不变，`QAFinding` 不扩展？

**实施顺序**（同 04）：Q1+Q3+Q4 → Q5 → Q6 → Q8 → Q11。本票只出方案，未改任何代码、契约或 fixture。
