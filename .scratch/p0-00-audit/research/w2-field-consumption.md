# W2 规格字段消费审计（HEAD `ea53240`）

日期：2026-10-20 · 分支：`v2-foundation` · HEAD：`ea53240`
票：[`02-w2-field-consumption.md`](../issues/02-w2-field-consumption.md)
任务书：[`docs/v4/P0-00-task-brief.md` §5 W2](../../../docs/v4/P0-00-task-brief.md)
地图：[`../map.md`](../map.md) · 同批研究：[`w1-call-graph.md`](w1-call-graph.md) · [`w3-asset-routes.md`](w3-asset-routes.md) · [`w4-qa-capability.md`](w4-qa-capability.md)

> **边界遵守**：只读审计；零付费。**没有**运行 `create` / `build` / `plan` / `pack` / `compile-runtime` /
> `compile-td-game` / `site` 对真实配置，也没有触发任何上游调用。只运行了本地免费测试
> （见 §6，命令 + 退出码）。未改源码 / 测试 / fixture / Schema / `docs/v4/` / `map.md` / 别的票。
>
> **基线漂移（Q2 裁定）**：HEAD 上没有一条单跑到站点。下文 E3 的**上游**证据来自归档旧真跑
> （2026-10-17 / 10-18 / 10-20，早于或与 HEAD 同日的实验目录），**下游**证据来自 HEAD 源码 +
> 既有站点目录的零付费重放记录。E3 只证明「那份产物确实被写出来 / 那个操作确实发生过」，
> **不**证明「HEAD 的每一行最新行为」或「视觉风格已经验收」。

---

## 0. 结论摘要（先看这 8 条）

1. **主链是通的，但字段消费呈三层**：
   **代码判据**（少）→ **提示词燃料**（多）→ **只写不读的交付字段**（若干）。
   `VWS` → `GameDesignSpec` / `CharacterDNA` / `AssetRecipe` 主要是**文本提示词传递**，
   真正改变机器行为的只有少数几个点：`camera.mode` 的拒绝面、`characterId`/`masterAsset` 的路线与 DNA 查找、
   `styleReferences`/`referenceImage` 的参考图内联、`style.palette` 的抠底色与量化。
2. **VWS 新视图不是「可执行视觉语法」**：`lighting` 四格、`styleIdentity.styleName`、
   `composition.characterScale`、`camera.projection/angle/elevation/perspective` **全仓零读取**。
   `palette` 六桶、`constraints`、`shapeLanguage` 只进提示词；没有任何生成后判据检查它们是否被遵守。
3. **Intent 的胜负条件没有进入设计**：`GameIntentSpec.winConditions` / `loseConditions` /
   `progression` / `challenge` 在 `designPrompt` 里**一次都没插值**，也没有判据读它们。
4. **Design 的胜负条件没有进入运行时**：`GameDesignSpec.winConditions` / `loseConditions` /
   `progression` / `difficulty` 只有契约/gate 读；`designBrief` 不包含它们，QA 也不读。
   真产物里设计写「接触敌人即失败」，而外壳 `hitHazard()` 是**退回起点、无血量、无失败态**。
5. **`GameConfig.objective.gate` 只被校验、不被运行时消费**：外壳给**每一个** `goal` 实体都绑
   `tryWin()`，`tryWin()` 只看拾取计数；`this.gate` 赋值后从未读取。真配置里 `chest-1` 与 `gate-1`
   都是 `goal` ⇒ 捡齐后碰到宝箱就会提前胜利。
6. **`AssetSpec.animations.fps/loop` 到了 manifest 就断**：`pack` 写进 manifest，外壳却硬编码
   `frameRate: 8 / 10 / 6` 与 `repeat: -1`；`loop:false` 的 jump 也会循环。
7. **`AssetSpec.styleId` 与 `AssetSpec.required` 零业务读取**：前者连契约注释都承认是死字段；
   后者只被 `pack` 抄进 manifest，随后没有任何读者。测试只做形状对等，不证明行为。
8. **v3 基线成立**：`deriveRecipe` 已不存在；`planAssets` 是唯一规划入口；`resolveRoute` 是
   `source.kind` 唯一最终写入者；route 仍是 `image/drawlist/import` 三值；plan sidecar 成功才写且过
   `asset-plan/v1`。执行层多出的 `frames` 被折叠成 `image`（W3 的 F1，只登记不重开）。

**字段判定口径**（下文表格最后一列）：

| 标记 | 含义 |
|---|---|
| `consumed` | 有机器读取，且读取后改变实际行为（构建/运行时/判据） |
| `prompt-only` | 只被插值进模型提示词；行为是否兑现由模型决定，无自动判据 |
| `validated-only` | 只有 schema / 构建期审计读它，运行时或下游不读 |
| `dead` | 全仓源码零读取（只有定义、提示词模板或测试 fixture） |
| `record` | 只写给人看的记录；无机器消费者，且这是设计意图 |

证据等级：`E1` 源码、`E2` 测试、`E3` 真实产物；`E2（在场）` 表示测试只断言「字段出现在提示词 / 形状合法」，
**不**断言下游行为。

---

## 1. 主链与字段传递（实际实现，不是任务书示意图）

```text
参考图 + 需求
  └─ analyzeReference            vision/analyze-reference.ts:303
       ├─ 模型一发 → buildVisualWorld（注入 styleReferences / style.id）vision/build-visual-world.ts:34-44
       └─ applyDeterministicPalette（重写六桶 / materials.color）  vision/palette.ts:203-236
            → run/v<N>/visual-world.json
需求
  └─ analyzeIntent               game-design/src/analyze-intent.ts（一发）
       → run/v<N>/game-intent.json
VWS + Intent
  └─ compileDesign               game-design/src/compile-design.ts
       ├─ designPrompt（Intent 6 个 ① 档 + VWS 部分字段）  game-design/src/prompts.ts:295-344
       └─ buildDesign（注入 genre/camera/runtimeProfile；R12 拒绝）build-design.ts:153-177
            → run/v<N>/game-design.json
Design + VWS
  └─ compileCharacterDna         game-design/src/compile-character-dna.ts
       ├─ characterDnaPrompt（VWS character 五格 + palette 六桶 + materials + shapeLanguage + constraints）
       └─ buildCharacterDna（集合相等 / 逐字守门人 / palette 越界）build-character-dna.ts:119-243
            → run/v<N>/character-dna.json
Design + VWS
  └─ planAssets                  assets/src/ops.ts:249
       ├─ assetPlanPrompt（designBrief + worldBrief）assets/src/prompt.ts:891-970
       ├─ parseRecipe + playerAnimationGate + ensureCharacterMasters
       └─ resolveRoute（唯一 source.kind 写入者）assets/src/route.ts:80-118
            → recipes/v<N>.json + v<N>.plan.json + stylespec.json + reference.png
Recipe + StyleSpec + DNA
  └─ packAssets → buildAssetPack assets/src/pack.ts:320
       ├─ masterPrompt（DNA → 母版）assets/src/master.ts:72-130
       ├─ imagePrompt / animationFramePrompt（DNA → 资产）assets/src/prompt.ts:314-560
       └─ manifest（size/anchor/animations/layers/scale9Borders/required）
Design + AssetPack
  └─ compileRuntime              assets/src/ops.ts:882
       ├─ designBrief + resourceBrief + 手感常数 → 一发文本模型
       └─ auditGameConfig + auditScreenSpace + auditLayerCoverage（error 不落盘）ops.ts:1046-1059
            → game-configs/v<N>.json → run/v<N>/game-config.json
AssetPack + GameConfig
  └─ qaRunner                   qa/src/assemble.ts:58-90
       ├─ visual: constructive-constraint / palette-binding
       ├─ gameplay: reference-resolution / reachability
       └─ intent: intent-coverage（只有 id 半边）
            → run/v<N>/qa-report.json
GameConfig + AssetPack
  └─ site（CLI/MCP）            demo/src/site.ts:191-216
       ├─ auditGameConfig + auditScreenSpace + auditGeometry
       └─ buildWorld → shell/scene.ts（Phaser）
```

关键点：**VWS/Intent/Design 的「下游」主要是「下一次模型调用的提示词」**，不是结构化变换。
这符合契约文件头的 ① 档欠条，但意味着「字段有读取」≠「行为可验证」。

---

## 2. 字段映射表

> 每行回答 W2 六问：Q1 生产者 · Q2 验证者 · Q3/Q4 读者与实际行为 · Q5 测试 · Q6 真实产物。
> 「测试/产物」为空 = 没有。

### 2.1 `VisualWorldSpec`（`packages/contracts/src/visual-world.ts:160-303`）

| 字段 | Q1 生产者 | Q2 验证者 | Q3 读取者 → Q4 实际行为 | Q5 测试 | Q6 真实产物 | 判定 / 等级 |
|---|---|---|---|---|---|---|
| `format` | `analyzeReference` 一发 | `VisualWorldSpecSchema` literal（`:161`） | 判别式；无业务行为 | `contracts/tests/visual-world.test.ts:175` | A1 | `consumed`（结构）/ E2 |
| `styleIdentity.styleName` | 模型 | `z.string().optional()`（`:170`） | **无读者**（全仓 grep 只命中定义） | 无 | — | **`dead` / E1** |
| `styleIdentity.keywords` | 模型 | 数组（`:171`） | `designPrompt` 原话（`game-design/src/prompts.ts:329`）；`characterClassBrief:509`；`worldBrief`（`assets/src/prompt.ts:874`）→ 只进提示词 | `design-prompts.test.ts:40-47`；`dna-prompts.test.ts:32-39`；`plan-assets.test.ts:137-149` 只断言「在提示词里」 | A4（设计 / DNA 原话呼应） | `prompt-only` / E2（在场） |
| `styleIdentity.description` | 模型 | 必填串（`:172`） | `designPrompt:324`、`characterClassBrief:508`、`worldBrief:873`；只进提示词 | 同上 | A4 | `prompt-only` / E2（在场） |
| `camera.mode` | 模型 | 封闭枚举 `CAMERA_MODES`（`:151,176`） | `build-design.ts:70` 注入 `design.game.camera`；`cameraSupported:121-130` 在构建前拒绝 `top-down/isometric/first-person/other`（`CAMERA_MODE_NEEDS:30-36`）；同时进 `designPrompt:325` / `worldBrief:877` | `build-design.test.ts:136-162`（4 个不支持值都拒；`side` 放行；不拿 `camera:*` 当笼统判据） | A4（`design.game.camera="side"`） | **`consumed` / E2** |
| `camera.projection/angle/elevation/perspective` | 模型 | 各自 optional 串/数（`:178-181`） | **无读者**；只有 `mode` 被读 | 无 | — | **`dead` / E1** |
| `composition.foreground/midground/background/objectScale/density` | 模型 | optional 串（`:184-190`） | `describeComposition`（`prompts.ts:347-355`）→ `designPrompt:326`；`worldBrief:877-878`；只进提示词 | `design-prompts.test.ts:50-55`（`world.structure` 必须带 midground 真值）；`plan-assets.test.ts:137-149` | A4：`design.world.structure` 逐句复述了 VWS 的三层与密度 | `prompt-only` / E2+E3 |
| `composition.characterScale` | 模型 | optional 串（`:189`） | **无读者**：`describeComposition` 与 `worldBrief` 的白名单都刻意不含它 | 无 | — | **`dead` / E1** |
| `palette` 六桶（`primary/secondary/accent/background/shadow/highlight`） | 模型 + `applyDeterministicPalette` 重写 | `PaletteRefShape` + `superRefine` 越界（`:285-303`） | `characterClassBrief:498-500`（DNA 提示词）、`worldBrief:875`（规划提示词）→ 只进提示词；**没有代码按桶取色**；`applyDeterministicPalette` 只是把引用重映射到新色板 | `visual-world.test.ts:180-205`（六桶必填/允许空/只收 ref）；`dna-prompts.test.ts:32-39`；`plan-assets.test.ts:137-149`；**无生成后检查** | A1：DNA 的 `palette` 下标落在世界色板内；A2：prompt 里翻译成 hex | `prompt-only` / E2 |
| `lighting.direction/softness/contrast/mood` | 模型 | optional 串（`:208-213`） | **无读者**（全仓 grep 只命中定义；`style.lighting` 也零读取） | 无 | — | **`dead` / E1** |
| `materials.*.appearance/texture/color` | 模型 + 重映射 | 开集键、封口值、`PaletteRef[]`（`:220-227`） | `characterClassBrief:501-506` 读三样 → DNA 提示词；`worldBrief:875` 只读 `appearance` → 规划提示词；**生图模板不读 VWS.materials**（读 `StyleSpec.material`） | `dna-prompts.test.ts:32-39`（六桶与 materials 真的被读） | A4 | `prompt-only`（`worldBrief` 只读一部分）/ E2（在场） |
| `character.proportions/silhouette/poseLanguage/clothing/faceAbstraction` | 模型 | optional 串（`:229-235`） | `designPrompt:328` 读 silhouette/proportions；`characterClassBrief:511-516` 读五格 → DNA 提示词；`worldBrief:879` 读四格；`verbatimCopyGuard:157-175` 逐字比三对（silhouette/clothing/face） | `compile-character-dna.test.ts:38-62`（五格逐个具名 + 真值）；`build-character-dna.test.ts:79-125`（守门人必要不充分被测试钉住） | A4：DNA 每一格都在世界「类」的基础上改写而非整句抄 | `prompt-only` + 一条守门人 / E2 |
| `environment.architecture/terrain/props/textureDensity` | 模型 | optional 串（`:237-242`） | `designPrompt:327-328` 读四格；`worldBrief:880` 读四格；只进提示词 | `design-prompts.test.ts:50-62`（layout 必须与 environment 挂钩） | A4：`levels[0].layout` 用了 architecture/terrain 真值 | `prompt-only` / E2+E3 |
| `shapeLanguage` | 模型 | `string[]`（`:247`） | `characterClassBrief:517` → DNA 提示词；**plan/config/生图模板都不读** | `dna-prompts.test.ts:32-39` | A4 | `prompt-only` / E2（在场） |
| `constraints`（顶层那张） | 模型 | `string[]`（`:248`） | `characterClassBrief:518` → DNA 提示词；**三张生图模板故意不读**（`assets/src/prompt.ts:289-300` 的票 30 裁定） | `prompt.test.ts:147-214`（三张模板不收 `style.constraints`；drawlist 照收是另一条） | A4 | `prompt-only`（且只到 DNA）/ E2（在场） |
| `styleReferences[].path` | **调用方注入**（`build-visual-world.ts:37`） | `StyleReferencePath`（`:90-95`）；create 强制恰好 1 张（`create-game.ts:269-270`） | `writeVisualWorld` 拷贝并改写路径（`pipeline/artifacts.ts:58-78`）→ `planAssets` 只取 `refs[0]` 拷成 `reference.png`（`ops.ts:403-408`）→ `pack` 解码后内联进每次生图（`pack.ts:641-646`）与母版（`:431-433`） | `vision/tests/build-visual-world.test.ts:30-48`（注入/覆盖）；`create-game.test.ts` 路径改写；`pack-master.test.ts:108-116`（引用母版的那一发拿到位图） | A1 `reference.png` 存在；A2 `authoring/generated/*.png` 存在；**请求级证据是 E1（`pack.ts:641-646`）+ `pack-master.test.ts:108-116`**，不是 A2 目录本身 | **`consumed` / E1+E2+E3** |
| `style` 子树 | 模型（`style.id` 由调用方强制覆盖，`build-visual-world.ts:38`）+ `applyDeterministicPalette` 重写 `palette` | `StyleSpecShape`（`:102-119`） | `styleRef` → `stylespec.json`；`pack` 读 `style.palette`（`keyColorFor` / 量化）、`style.identity/material`（生图模板）、`style.constraints`（drawlist `styleBrief` + 母版）；**`style.camera/composition/lighting/environment/characterStyle/confidence` 零读取**（契约头 `:29-33`；`prompt.ts:217` 明写 camera 故意不读） | `visual-world.test.ts:33-116` 漂移测试；`prompt.test.ts:147-214`；`pack.test.ts:96-109` 色板规范化/去重 | A1 `stylespec.json`；A2 `authoring/stylespec.json`；A6 色板实验 | `consumed`（palette/identity/material）+ `dead`（6 个旧字段，已解释的兼容例外）/ E2+E3 |
| `style.palette` 为空 | 模型 | VWS **允许空**（`StyleSpecShape.palette` 的 `.default([])`，`:108`；六桶也允许 `[]`，`:199-206`；只有越界 gate） | `planAssets` 把 `world.style` 原样写盘（`ops.ts:401`）；`pack` 的 `readStyle` 才拒空色板（`ops.ts:1503-1504`）——**在设计与规划的钱花完之后** | `packages/assets/tests/style-gate.test.ts`（空色板拒） | — | **验证位置缺口** / E1+E2 |

### 2.2 `GameIntentSpec`（`packages/contracts/src/game-intent.ts:130-329`）

| 字段 | Q1 生产者 | Q2 验证者 | Q3 读取者 → Q4 实际行为 | Q5 测试 | Q6 真实产物 | 判定 / 等级 |
|---|---|---|---|---|---|---|
| `title` | 模型 | optional 串（`:134`） | `compile-design.ts:255` 作为 `gameTitleHint` → `designPrompt:343`；只影响标题建议 | `design-prompts.test.ts:103`（只在用户起名时给） | A1 `game.title` 为「废城拾荒者」 | `prompt-only` / E2 |
| `genre` | 模型 | 非空 gate（`:190-198`） | `designPrompt:308` 原话；**设计层的 `game.genre` 装配时被 `profile.id` 覆盖**（`build-design.ts:68-72`），不做语义映射 | `design-prompts.test.ts:40-47`；`build-design.test.ts:67-80` | A4：intent「横版废土寻宝…」→ design `genre:"platformer"` | `prompt-only` + 已知语义缺口 / E2 |
| `subgenre` | 模型 | optional 串（`:137`） | `designPrompt:308` 原话 | `design-prompts.test.ts:40-47` | A4 | `prompt-only` / E2（在场） |
| `camera` | 模型 | optional 串（`:138`） | `designPrompt:309` 原话；真正的相机判据读的是 `vws.camera.mode`，不是它 | `design-prompts.test.ts:40-47` | A4 | `prompt-only` / E2（在场） |
| `targetExperience` | 模型 | 非空 gate（`:191`） | `designPrompt:310` | `design-prompts.test.ts:40-47` | A4 | `prompt-only` / E2（在场） |
| `coreLoopSteps` | 模型 | 非空数组 gate（`:213-219`） | `designPrompt:311`；文本相减已按票 19 砍掉 | `design-prompts.test.ts:40-47` | A4 | `prompt-only` / E2（在场） |
| `player.role` | 模型 | 非空 gate（`:193`） | `designPrompt:312` | `design-prompts.test.ts:40-47` | A4 | `prompt-only` / E2（在场） |
| `player.goals` | 模型 | 非空数组 gate（`:213-219`） | `designPrompt:312` | 同上 | A4 | `prompt-only` / E2（在场） |
| `world.theme/setting/atmosphere` | 模型 | 非空 gate（`:194-196`） | `designPrompt:313` | `design-prompts.test.ts:40-47` | A4 | `prompt-only` / E2（在场） |
| `mechanics[].id/name` | 模型 | id 唯一 + 非空数组 gate（`:213-219,229-239,263-276`） | `designPrompt:314` 原话；`auditIntentCoverage` 按 **id** 查设计层（`intent-coverage.ts:127-129`）；`build-design.ts:97-117` 转成 R12 拒绝 | `build-design.test.ts:89-135`（缺机制/缺实体/串桶）；`qa/tests/intent.test.ts:64-126` | A4：6 条机制 → 6 条 design.mechanics | **`consumed`（判据）+ prompt / E2** |
| `entities[].id/type/role` | 模型 | 封闭 `type` + id 唯一 + 跨数组 id 不撞 + id 不等于类名（`:184-312`） | `designPrompt:315-316` 逐个 id/type/role；`auditIntentCoverage` 按 `type` 找桶、按 id 作对家（`intent-coverage.ts:116-125`） | `build-design.test.ts:99-135`；`game-intent-gate.test.ts`；`intent-coverage.test.ts` | A4：3 个实体 → 对应桶 | **`consumed`（判据）+ prompt / E2** |
| `progression` / `challenge` | 模型（可选） | 出现时 `type/description` 不得两端皆空（`:221-226`） | **无读者**：`designPrompt` 没有插值；没有判据；没有下游模板 | 只有 `prompts.test.ts:126-146` 断言「台账里写了这条规矩」——**不是行为** | A4 的意图**没有**这两格（`has("progression")=false`）；设计层自行造了 `progression`/`difficulty` | **`dead` / E1** |
| `winConditions` / `loseConditions` | 模型 | 只查元素非空（`:201-209`）；允许 `[]` | **无读者**：`designPrompt` 没有插值；`auditIntentCoverage` 不读；QA 明写不读（`qa/src/intent.ts:51-61`） | `game-intent-gate.test.ts:137-138`（空放行）——只证明 gate | A4：意图的胜负条件没有出现在设计提示词的任何位置 | **`dead` / E1** |
| `ambiguity` | 模型 | 元素非空 + 以字段名开头（工具说明纪律） | `designPrompt:322`；CLI 检查点逐条打印（`cli.ts:293,322,360`）；MCP 同样（`server.ts:302`） | `cli-create.test.ts:265`（`--yes` 也逐条打） | A4 的 intent 有 7 条 ambiguity | **`consumed`（提示词 + 检查点）/ E2** |

### 2.3 `GameDesignSpec`（`packages/contracts/src/game-design.ts:124-325`）

| 字段 | Q1 生产者 | Q2 验证者 | Q3 读取者 → Q4 实际行为 | Q5 测试 | Q6 真实产物 | 判定 / 等级 |
|---|---|---|---|---|---|---|
| `game.title` | 模型 / 提示可带用户标题 | 非空（`:129`） | `designBrief:849` → 规划 + config 提示词；报告 | `compile-runtime.test.ts:298-313`；`plan-assets.test.ts:114-131` | A1：config 生成时提示词含标题 | `prompt-only` / E2（在场） |
| `game.genre` / `game.camera` | 模型照抄，装配强制覆盖（`build-design.ts:68-72,155-158`） | 非空（`:216-217`） | `designBrief:850` → 下游提示词；`camera` 的拒绝面实际在 `vws.camera.mode` | `build-design.test.ts:67-80`（覆盖）；`compile-runtime.test.ts:298-313` | A4 | `prompt-only`（camera 的机器行为在 VWS 侧）/ E2 |
| `game.runtimeProfile` | 调用方注入（`:146, build-design.ts:71`） | `RuntimeProfileRefSchema` | `compileRuntime` 用它选外壳与 config 形状（`ops.ts:903-912`）；查不到直接 `invalid` | `compile-runtime.test.ts:378-386` | A1/A3：`platformer/v1` | **`consumed` / E2** |
| `coreLoopSteps` | 模型 | 非空数组 + 元素非空（`:240-283`） | `designBrief:851` → 下游提示词；无文本判据 | `compile-runtime.test.ts:298`；`plan-assets.test.ts:114` | A4 | `prompt-only` / E2（在场） |
| `player.id` | 模型（沿用意图） | 与四桶唯一（`:296-307`） | 规划提示词要求玩家资源的 `characterId`（`assets/src/prompt.ts:956`）；DNA 提示词列 id（`game-design/src/prompts.ts:529`）；`characterSetGate:119-142`；`playerAnimationGate:201-238` | `build-character-dna.test.ts:37-77`；`plan-assets-player-gate.test.ts` | A1：`player-scavenger` 贯穿 design/DNA/recipe | **`consumed` / E2+E3** |
| `player.role` / `player.abilities` | 模型 | 非空 + 数组非空（`:218,243,276-283`） | `designBrief:852-853` → 下游提示词；`characterIndividualBrief:529` → DNA 提示词 | `compile-runtime.test.ts:298`；`plan-assets.test.ts:114` | A4 | `prompt-only` / E2（在场） |
| `player.goals` | 模型 | 数组非空（`:243,276-283`） | **只在 DNA 提示词**（`characterIndividualBrief:529`）；`designBrief` **不包含**它 | `compile-runtime.test.ts:298` 的 12 字段清单不含 goals | A4 | `prompt-only`（只到 DNA）/ E2（在场） |
| `enemies[].id/behavior/threat` | 模型（沿用意图 id） | id 唯一 + 每项字符串非空（`:228-238,296-307`） | `designBrief:855` → 规划/config 提示词；`characterIndividualBrief:531-532` → DNA 提示词 | `plan-assets.test.ts:114`；`compile-runtime.test.ts:298` | A4；A2：敌人动画资源存在 | `prompt-only` / E2（在场） |
| `npcs[].id/role/interaction` | 模型 | 同上 | `designBrief:856`；`characterIndividualBrief:533-534` | 同上 | —（样例设计 `npcs:[]`） | `prompt-only` / E2（在场） |
| `interactables[].id/type/behavior` | 模型 | 同上 | `designBrief:857` → 规划/config 提示词；DNA 明确排除（`characterIndividualBrief:536-537`） | 同上 | A4：`chest-wasteland` / `rubble-hazard` | `prompt-only` / E2（在场） |
| `resources[].id/purpose` | 模型 | 同上 | `designBrief:858` → 提示词；DNA 排除 | 同上 | A4：`scrap-resource` | `prompt-only` / E2（在场） |
| 四个桶 → 资源清单的覆盖 | — | **只有玩家有闸**（`ops.ts:201-238`）；敌人/NPC/交互物/资源**没有**设计→清单的覆盖判据 | 规划提示词说「id 沿用」；模型可以漏、可以改名；没有 gate | `plan-assets-player-gate.test.ts` 只覆盖玩家 | A1 恰好对齐；10-18a 的 recipe/DNA 不一致只作完整性异常登记（见 §6），不作反例 | **缺口 / E1+E2** |
| `world.theme/setting/structure` | 模型 | 非空（`:219-221`） | `designBrief:854`；config 提示词明确要求 `levels[].layout` 照 `world.structure` 摆（`ops.ts:961-964`） | `compile-runtime.test.ts:298`；`plan-assets.test.ts:114` | A4：`world.structure` 复述 VWS composition | `prompt-only` / E2+E3 |
| `levels[].id` | 模型 | id 必填（`:178`） | `compileRuntime` 选 `opts.levelId ?? design.levels[0].id`（`ops.ts:914-918`）；create 不传 `levelId` | `compile-runtime.test.ts:369-377` | A3：只装配了 level-01 风格的一关 | **`consumed`（只第一关）/ E2+E3** |
| `levels[].purpose/layout/entities` | 模型 | 每项非空；`entities` 必须是引用族（`:228-238,309-324`） | `designBrief:859-863` → 规划/config 提示词；config 提示词说「照 layout 摆」；**没有结构化检查 config 是否真的照 layout** | `design-prompts.test.ts:57-62`；`compile-runtime.test.ts:298-313` | A3 的 config 是手写，不能证明模型照 layout；A4 的 layout 很具体 | `prompt-only` / E2（在场） |
| `progression` / `difficulty` | 模型 | `progression` 必填、`difficulty` 可选；字符串非空（`:222-225`） | **无读者**：`designBrief` 不含；`designPrompt` 不含；config 提示词不含；QA 不读 | 无 | A4 有很完整的 progression/difficulty 文本，但运行时没有任何对应字段 | **`dead` / E1** |
| `mechanics[].id/mechanic` | 模型 | 封闭 `MechanicSchema`；id 必填（`:79-82`） | `build-design.ts:134-145` 与 `profile.mechanics` 求差（今天恒空，留位）；`auditIntentCoverage` 按 id 查 | `build-design.test.ts:164-188` | A4：6 条机制全部映射到枚举 | **`consumed`（校验；今天恒空）/ E2** |
| `winConditions` / `loseConditions` | 模型 | 元素非空、允许空数组（`:245-250`） | **无读者**：`designBrief` 不含；config 提示词不含；QA 不读；运行时没有失败态 | 无 | A4：设计写「接触敌人即失败」；A3 的外壳 `hitHazard()` 只是退回起点（`shell/scene.ts:264-267`） | **`dead` + E3 反证 / E1+E3** |
| `runtimeRequirements` | 模型 | 封闭 `CapabilitySchema`（`:205`） | `build-design.ts:140-143` 与 `profile.capabilities` 求差（今天恒空，留位） | `build-design.test.ts:181-188` | — | **`consumed`（校验；今天恒空）/ E2** |

### 2.4 `CharacterDNA`（`packages/contracts/src/character-dna.ts:73-126`）

| 字段 | Q1 生产者 | Q2 验证者 | Q3 读取者 → Q4 实际行为 | Q5 测试 | Q6 真实产物 | 判定 / 等级 |
|---|---|---|---|---|---|---|
| `id` | 模型（必须沿用设计 id） | 文件级重复 gate + `characterSetGate`（`build-character-dna.ts:119-142`）+ `paletteRefBounds` 的 where 映射 | `pack` 的 `dnaOrThrow` 按 id 查（`pack.ts:398-410`）；`assetDna` / `masterDna` 开跑前算好（`:411-422`） | `build-character-dna.test.ts:37-77`；`pack-master.test.ts` | A1：DNA 两个 id = design 两个角色；A2：prompt 文件按角色生成 | **`consumed` / E2+E3** |
| `identity` | 模型 | 非空 gate（`character-dna.ts:179-184`） | `dnaBrief`（`assets/src/prompt.ts:75-99`）→ 母版提示词（`master.ts:104-110`）与资产提示词（`animationFramePrompt:534` / `singleObjectPrompt:404`） | `master.test.ts:34-53`（8 个字段逐个具名）；`pack-master.test.ts:121-140`（prompt 含 identity 真值） | A2：`ceiling-lurker.hang1.prompt.txt` 第 8 行是 DNA.identity 原文 | **`consumed`（提示词）/ E2+E3** |
| `silhouette` / `face` / `clothing` | 模型 | 非空 + 三对逐字守门人（`build-character-dna.ts:157-175`，必要不充分，测试钉着） | `dnaBrief:75-99` → 母版 + 资产提示词 | `master.test.ts:55-63`（none 翻人话）；`build-character-dna.test.ts:79-125` | A2 prompt 文件；A4 DNA 三格都在世界类的基础上改写 | **`consumed`（提示词）/ E2+E3** |
| `gear` | 模型 | 元素非空、允许 `[]`（`character-dna.ts:187-195`） | `dnaBrief` → 提示词 | `master.test.ts:34-53` | A2 | `consumed`（提示词）/ E2+E3 |
| `palette` | 模型 | `PaletteRefShape`（正则）+ `paletteRefBounds`（下标 < `vws.style.palette.length`，`build-character-dna.ts:191-208`） | `dnaBrief:76-84` 把 ref 翻译成 hex → 提示词；**没有代码在生成后检查像素是否真的用了这些颜色** | `master.test.ts:48-53`（ref → hex）；`build-character-dna.test.ts:151-210`（越界拒） | A2：`ceiling-lurker.hang1.prompt.txt` 第 13 行是 `#221205 #301100 …` | **`consumed`（提示词）+ 越界判据 / E2+E3** |
| `visualConstraints` | 模型 | 元素非空、允许 `[]`（`:187-195`） | `dnaBrief` → 提示词（`master.ts` / 资产提示词） | `master.test.ts:34-53` | A2 prompt 文件 | `consumed`（提示词）/ E2+E3 |
| 跨资产一致性 | 系统 | 无自动判据 | 消费侧靠**母版图作为参考图**（`pack.ts:647-655`）+ 同一份 DNA 文本；不是独立一致性判据 | `pack-master.test.ts:108-116`（引用母版的那一发拿到那张位图） | A2：多帧围绕母版生成 | `consumed`（机制）/ E2；**视觉一致性未验收** |

### 2.5 `AssetRecipe` / `AssetSpec` / `AuthoringAsset` / plan sidecar

| 字段 | Q1 生产者 | Q2 验证者 | Q3 读取者 → Q4 实际行为 | Q5 测试 | Q6 真实产物 | 判定 / 等级 |
|---|---|---|---|---|---|---|
| `format` / `id` / `styleRef` | 模型 + 调用方改写 | `parseRecipe`（`recipe.ts:222-249`） | `pack` 读 `styleRef` 解析 style（`ops.ts:1509-1516`）；`id` 决定包目录 | `recipe.test.ts`；`pack.test.ts:164-171`（相对配方文件） | A1 / A2 | `consumed` / E2+E3 |
| `referenceImage` | `planAssets` 从 `world.styleReferences[0]` 拷贝（`ops.ts:403-408`） | `InputPath` | `pack` 解码后作为 `styleReference` 内联每次生图/母版调用（`pack.ts:641-646,431-433`） | `pack-master.test.ts:170-181`（三样都会递图） | A1 `reference.png`；A2 生图产物 | **`consumed` / E2+E3** |
| `characterRef` | `pipeline/artifacts.ts:105` 注入（`injectCharacterRef`） | `InputPath`；`readCharacterRef`：有 `characterId` 却无文件 ⇒ 拒（`ops.ts:1420-1434`） | `pack` 读 DNA 文件 → `dnaOrThrow`（`pack.ts:398-410`） | `create-game.test.ts`；`pack.test.ts` DNA 路径 | A1 `characterRef: character-dna.json` | **`consumed` / E2+E3** |
| `assets[].spec.id` | 模型 / 人 | `parseRecipe` 去重（`:252-256`） | `pack` 迭代；manifest id；config 引用；QA 按 id 对账 | `recipe.test.ts:44`；`pack.test.ts` | A1 / A2 | **`consumed` / E2+E3** |
| `assets[].source.kind` | 模型候选 → `resolveRoute` 最终写 | `parseRecipe` union；route 三值 | `planAssets` 调 `resolveRoute`（`ops.ts:367-399`）；`pack` 按 kind 分派（`:567/603/1018`） | `route-resolver.test.ts:28-124`；`plan-sidecar.test.ts:49-86`；`pack.test.ts:116-188` | A1；A5 sidecar route 与 recipe source 一致 | **`consumed` / E2+E3** |
| `source.reference` / `background.tolerance` / `alphaThreshold` / `minLargestShare` | 模型 | `parseRecipe` 形状；`dashscope-mcp` 参考图预检（`ops.ts:380-386`） | `pack` 用 reference 作为参考图（`pack.ts:647-655`）；用 tolerance 抠底（`:629-640,885-895`）；alphaThreshold 传给 `importFrames`（`:997-1002`）；`minLargestShare` 判单帧最大块（`:885-895`） | `pack.test.ts:847-964`（实测众数色）；`pack-reuse-threshold.test.ts:94`（多部件下限）；`import.test.ts:305` | A1 / A2 | **`consumed` / E2+E3** |
| `source.kind="import"` 的 `ref` / `sheet.*` | 模型 / 人 | sheet 网格/帧名/动画分组/帧数（`recipe.ts:344-370`） | `pack` 解码 + `sliceGrid`（`import.ts:299-325`）；`importFrames` | `recipe.test.ts:59-131`；`import.test.ts:132-305` | A1；A2 imported 资源 | **`consumed` / E2+E3** |
| `source.kind="frames"` | 模型候选 → 被折叠成 `image` | `parseRecipe`：只能 animation、不能与 sheet 同写（`:327-338`） | `pack` 逐帧调用（`pack.ts:672-681`）；route 侧被映射成 `image`（`ops.ts:372`） | `pack-frames.test.ts:37-90`；W3 的 F1 | A2 逐帧文件 | **`consumed`（但 route 记录折叠）/ E2** |
| `spec.styleId` | 模型（照抄 `world.style.id`） | `z.string()`（`asset-spec.ts:19`）——**没有 min(1)，没有一致性校验** | **无读者**：`pack` 不读；manifest 不收；契约注释自己承认「源码零读取」（`recipe.ts:153-157`） | `recipe-tool.test.ts` 只做 v3/v4 形状对等 | A1：每件都写 `styleId:"style"`，从未被核对 | **`dead` / E1（已解释的遗留字段）** |
| `spec.role` / `spec.description` | 模型 | `z.string()`（不强制非空） | `role` 在生图提示词（`prompt.ts:211,376,404,477,534`）；`description` 同处；`role` 也进 manifest（`pack.ts:1208`） | `prompt.test.ts` 多处；`master.test.ts:77`（人写 role/description 进母版提示词） | A2 prompt 文件 | **`consumed`（提示词）/ E2+E3** |
| `spec.size` | 模型 | 正整数；`auditAssetSpec` 与产物尺寸对账（`audit.ts:51-52`） | 提示词画布比例（`prompt.ts` 各模板）；`importFrames` 目标尺寸；`auditAssetSpec` | `pack.test.ts`；`auditAssetSpec` 相关 QA | A2 manifest size = 实际帧尺寸 | **`consumed` + 对账 / E2+E3** |
| `spec.anchor` | 模型 | `Anchor` 形状；**没有产物对账** | 提示词锚点说明（`prompt.ts:215-218`）；manifest `anchor`（`pack.ts:1212`）；config/demo 用它推盒子（`demo/src/draw.ts:123-126`、`world.ts:137-140`） | `world.test.ts:101-125`（盒子由锚点推）；`game-config.test.ts:243-277`（锚点语义） | A3：站点里脚落地面 | **`consumed` / E2+E3** |
| `spec.required` | 模型 | `z.boolean().default(true)`（`asset-spec.ts:28`） | `pack` 抄进 manifest（`pack.ts:1209`）；**manifest 里也没有读者** | `recipe-tool.test.ts:55,72-85` 只做形状对等 | A1：`required:false` 的 `prop-*` 仍然照常生成、照常交付 | **`dead` / E1（测试只验形状）** |
| `spec.characterId` | 模型（写玩家 id 是硬要求） | `recipe` 只验形状；`playerAnimationGate` 只验玩家；`pack` 查 DNA 时命中即用、查不到即抛 | 路线硬信号 `image:character`（`route.ts:94-104`）；`pack` 查 DNA（`pack.ts:411-422`）；母版兜底（`planner-masters.ts:49-73`） | `route-resolver.test.ts:29-44`；`plan-assets-player-gate.test.ts`；`pack-master.test.ts` | A1 | **`consumed` / E2+E3** |
| `spec.masterAsset` | 模型 / `ensureCharacterMasters` 兜底 | `recipe` 同文件引用族 + 环 + 比例（`:267-323`） | 路线硬信号 `image:master`（`route.ts:94-104`）；`pack` 取母版图作为 reference（`pack.ts:647-655`） | `pack-master.test.ts:108-116`；`planner-masters.test.ts` | A2 母版与动画产物 | **`consumed` / E2+E3** |
| `spec.dependsOn` | 模型 / 人 | 同文件存在性、自依赖、无环（`recipe.ts:287-305`） | `pack` 先等依赖（`pack.ts:1080-1100`）；失败不发出后续调用 | `pack-deps.test.ts:62`；`recipe-graph.test.ts` | A1 | **`consumed` / E2+E3** |
| `animations[].name/frames/sheet` | 模型 | 名字唯一、sheet 网格 = frames（`asset-spec.ts:212-229`）；`auditAssetSpec` 对账帧数（`audit.ts:54-65`） | 帧数 → `framePlan` / `imageUnitsOf` / 逐帧调用（`pack.ts:672-681`）；sheet 决定切格（`pack.ts:681-683`） | `pack-sheet-grid.test.ts`；`pack-frames.test.ts`；`rule` 测试 | A1 / A2 | **`consumed` / E2+E3** |
| `animations[].fps` / `loop` | 模型 | `fps` 正数、`loop` 默认 true（`asset-spec.ts:84-85`） | `pack` 写进 manifest（`pack.ts:1050-1057`）；**外壳不读**：`shell/scene.ts:140` 实体动画硬编码 `frameRate:8`，`:193` 玩家硬编码 `run?10:6`，两处都 `repeat:-1` | `pack-frames.test.ts:66` 只断帧名；contracts 的 `resolvePackRef` 测试断言 `animation.fps` 被返回（`assetpack.test.ts:268`）；**没有运行时 fps/loop 测试** | A1：manifest 有 `fps:4/10/8` 与 `jump.loop:false`；A3 播放中但未验证速率/循环 | **断链（manifest → runtime）/ E1+E2** |
| `background.layers[].name/parallax/tileable/description` | 模型 / 人 | 层名唯一；`parallax` 非负；`tileable` 封口（`asset-spec.ts:188-229`） | 生图逐层提示词（`prompt.ts:335-393`）；manifest 层表（`pack.ts:1218`）；外壳铺层（`demo/src/draw.ts:187-236`）；层覆盖判据（`ops.ts:1045-1053`） | `pack.test.ts:212-233`；`world.test.ts:88-99`；`site.test.ts:266-317` | A3：三层背景可见 | **`consumed` / E2+E3** |
| `ui.ninePatch` | 模型 | 中央区非空（`asset-spec.ts:231-238`） | 路线硬信号 `drawlist:ui-ninepatch`（`route.ts:107-109`）；生图模板（`prompt.ts:218-227`）；`scale9Of` → manifest `scale9Borders`（`pack.ts:259-264,1220-1224`） | `pack.test.ts:233-254`；`route-resolver.test.ts:45-60`；`site.test.ts` HUD 尺寸 | A3：HUD 面板在 Canvas 下回退普通拉伸 | **`consumed` / E2+E3** |
| `authoring[].id/role/description/size/characterId` | 模型 / 人 | id 空间分离 + 比例一致（`recipe.ts:258-323`）；`dnaOrThrow`（`pack.ts:420-422`） | 母版提示词读 role/description（`master.ts:89-90`）；size 作为 canonical 画布（`:120-123`）；characterId 查 DNA | `pack-master.test.ts:121-140`；`recipe.test.ts:193-267` | A2 母版 prompt/PNG | **`consumed` / E2+E3** |
| `authoring[].source` 的 `image.reference/background/alphaThreshold/minLargestShare` | 模型 | `AssetSource` 形状合法（`recipe.ts:164-174`） | `pack` 母版支只读 `source.kind` + `size`；`image` 支只读 recipe 级 `referenceImage`；**这些参数被忽略** | `pack-master.test.ts:129` 写入 `background:{tolerance:30}`，但没有任何断言证明它被使用 | A2 | **`dead`（母版支）/ E1** |
| plan sidecar `format/recipeId/recipeVersion/capabilities/inputs/assets[].route/reason/inputs/candidate/participated` | `planAssets` 从 resolver 输出直接生成（`ops.ts:421-441`） | `parseAssetPlan`（`asset-plan.ts:79-82`） | `flattenPlannerOutput` 改名成 `run/v<N>/asset-recipe.plan.json`（`pipeline/artifacts.ts:104-105`）；**没有任何下游代码读它**；测试读它做对账 | `plan-sidecar.test.ts:49-86`；`plan-assets.test.ts` | A5：sidecar 的 route/reason 与 recipe 一致 | **`record`（按设计）/ E2** |

### 2.6 `GameConfig`（`packages/contracts/src/game-config.ts:190-207`）

| 字段 | Q1 生产者 | Q2 验证者 | Q3 读取者 → Q4 实际行为 | Q5 测试 | Q6 真实产物 | 判定 / 等级 |
|---|---|---|---|---|---|---|
| `world.size` | 文本模型（`compileRuntime` 一发） | `Size`；`auditScreenSpace` / `auditGameConfig.inWorld`；提示词要求高 = 视口高（`ops.ts:933-936`） | 背景铺层、相机边界（`demo/src/world.ts:125`、`shell/scene.ts:70`）；可达性判据 | `compile-runtime.test.ts`；`game-config.test.ts`；`world.test.ts` | A3：`640×270` / A1：`1920×270` | **`consumed` / E2+E3** |
| `scene.background.asset` | 模型 | `auditReferences`（`game-config.ts:314`） | `buildBackground`（`world.ts:128`）→ 层表/帧/视差 | `world.test.ts:88-99`；`gameplay.test.ts:78` | A3：三层背景 | **`consumed` / E2+E3** |
| `player.asset` / `player.anims.idle/run/jump` | 模型 | 引用族逐个解 + 三格必须不同（`game-config.ts:306-337`） | `world.ts:147-166` 建 player 与动作映射；`scene.ts:76-91,185-196` 播 run/jump/idle | `game-config.test.ts:150-227`；`world.test.ts:109-115`；`shell-scene-wiring.test.ts` | A3：CDP 跑/跳 | **`consumed` / E2+E3** |
| `player.at` | 模型 | `inWorld` + 出生点不卡 solid（`game-config.ts:437-452`）；`auditReachability` 用脚点 | `world.ts:162-165` 盒子；`scene.ts:185` 出生；`hitHazard` 退回这里 | `game-config.test.ts:229-277`；`world.test.ts:101-108` | A3：出生点/复位 | **`consumed` / E2+E3** |
| `player.move.speed/jumpVelocity/gravity` | 模型（可省） | `PlayerMove`；`playerMoveOf` 统一默认（`:219`）；可达性用同一套 | `world.ts:165`；`scene.ts:76-87` 实际速度/跳跃/重力 | `game-config.test.ts:102-127,289-317`；`world.test.ts:151-163` | A3：CDP 移动/跳跃 | **`consumed` / E2+E3** |
| `terrain[]` | 模型 | `Rect`；`inWorld`；可达性当实心 | `world.ts:131`；`scene.ts:50` 加静态碰撞 | `game-config.test.ts:237-243`；`world.test.ts:135` | A3：地面线 | **`consumed` / E2+E3** |
| `entities[].id` | 模型 | 唯一（`:190-207`）；`objective.gate` 必须指向 goal（`:338-339`） | 诊断/`objective.gate` 校验；运行时**不按 id 区分**（除 gate 外） | `game-config.test.ts:94,128-135` | A1/A3 | **`consumed`（校验）/ E2** |
| `entities[].kind` | 模型 | 封闭枚举（`:47`） | `scene.ts:145-163` 分支：solid 碰撞 / pickup overlap / hazard overlap+复位 / goal overlap+win / decor 只画 | `game-config.test.ts:82-88`；`world.test.ts`（盒子）；`shell-scene-wiring.test.ts` | A3：拾取、危险、终点都可见 | **`consumed` / E2+E3** |
| `entities[].at/asset/anim/body` | 模型 | 引用族；`body` 尺寸；`inWorld` | `world.ts:133-144` 推盒子、解帧；`scene.ts` 摆精灵/建动画 | `world.test.ts:117-125`；`gameplay.test.ts:66-96` | A3：所有资源进场景 | **`consumed` / E2+E3** |
| `entities[].motion` | 模型 | `Motion`（只 `cycle`）（`:59-67`）；`auditGameConfig` 越界警告；`auditReachability` 把实心体的**整段行程**当可踩 | **只有 `hazard` 被外壳移动**（`scene.ts:152-154`）；`solid/pickup/goal/decor` 上的 `motion` 被 `world.ts:142` 带上但没有运行时消费者 | `shell-scene-wiring.test.ts:33-40`（只测 hazard）；`hazard.test.ts` | A1/A3：只有敌人 hazard 在巡逻 | **部分消费 / E1+E2** |
| `hud.panel.asset/at/size` | 模型 | 引用族（ui 种类）；`auditPanelSize` 以九宫格为条件（`:427-455`）；`auditScreenSpace` 四边 | `world.ts:170-175` 解 draw；`scene.ts:200-227` 画面板（九宫格 / Canvas 回退） | `world.test.ts:127-134`；`site.test.ts:118-130`；`compile-runtime.test.ts:334-360` | A3：左上 HUD 面板 | **`consumed` / E2+E3** |
| `hud.pip.asset/at/step` | 模型 | 引用族（ui）；屏幕空间 | `world.ts:179-185` 生成 N 个 pip；`scene.ts:227` 画；`refreshPips` 按拾取点亮 | `world.test.ts:127-134` | A3：`cdp-run` 后 pip 点亮 | **`consumed` / E2+E3** |
| `objective.kind` | 模型 | literal `collect-then-reach`（`:185`） | **无分支**：外壳直接按这一种规则实现 | `game-config.test.ts` 只验 schema | A3 | **`validated-only` / E1** |
| `objective.gate` | 模型 | `auditReferences` 要求 goal 存在（`:338-339`）；`auditReachability` 用它找终点（`reachability.ts:125`） | **外壳不读**：每个 `goal` 都绑 `tryWin()`（`scene.ts:158-162`），`tryWin` 只看 `pickupCount`（`:269-274`）；`this.gate` 赋值后从未读取（`:26,160`） | `game-config.test.ts:128-135`（只验引用）；`reachability.test.ts`；**无「只有 gate 能赢」测试** | A1：config 有 `chest-1` 与 `gate-1` 两个 goal；`objective.gate="gate-1"` | **`validated-only`（运行时未消费）/ E1+E3** |
| `pickupCount`（派生） | `pickupCount()`（`:216`） | 引用族要求至少 1 个 pickup（`:341-343`） | `world.ts:169,179` 决定 pip 数；`scene.ts:270` 决定胜利阈值 | `game-config.test.ts:110-114`；`world.test.ts:127-134` | A1：6 个 pickup / 6 个 pip；A3：3 个 pickup / 3 个 pip | **`consumed` / E2+E3** |
| 失败条件 / 血量 / 生命 | **契约没有字段** | — | `hitHazard()` 只复位到出生点（`scene.ts:264-267`）；没有 lose 状态、没有 HP | `hazard.test.ts` 只测路径；无失败态测试 | A3：site-report 未记录失败态 | **缺失（设计层文本无落点）/ E1+E3** |
| 控制映射 | **契约没有字段**；外壳硬编码方向键/WASD/空格（`scene.ts:73,78-84`） | — | 实际输入 | `shell-scene-wiring.test.ts` 不测按键；CDP 证据 | A3：CDP run/jump | **按设计的常量（非字段缺口）/ E1+E3** |

---

## 3. 缺口清单（所有「有定义、无消费者」或「测试只查在场」）

> 分流用任务书 §6 的六类；优先级用 §6 的 P0/P1/P2。每个缺口给出最小验收条件。

| ID | 缺口 | 证据 | 等级 | 分流 | 优先级 | 验收条件 |
|---|---|---|---|---|---|---|
| **W2-G01** | `GameConfig.objective.gate` 运行时未消费：任何 `goal` 都能触发胜利 | `game-config.ts:184-188,338-339`；`demo/src/shell/scene.ts:158-162,269-274`；`this.gate` 只在 `:26,160` 出现 | **E1 + E3** | 修正 + 补测 | **P0** | 一份有两个 `goal` 的 config，捡齐后只碰非 `gate` 的 goal **不胜利**；碰 `gate` 才胜利；测试在 `demo/tests` 覆盖 |
| **W2-G02** | 设计层 `winConditions` / `loseConditions` 无机器消费者；运行时没有失败态 | `game-design.ts:196-197`；`prompt.ts:846-865`（`designBrief` 不含）；`scene.ts:264-267`；A4 设计写「接触敌人即失败」 | **E1 + E3** | 修正或补文档 + 补测 | **P0/P1** | 明确二选一：① `GameConfig` 增加可执行的胜负原语并接入外壳；② 契约/文档明确「design 的胜负文本是叙事，不是运行时契约」，并从验收里剔除 |
| **W2-G03** | `design.levels[]` 只有第一关被编译；create 不传 `levelId` | `ops.ts:914-918`；`create-game.ts:508-516`；A4 设计有 3 关，A3 只装配 1 关（`site-report.md:10-12,96`） | **E1 + E3** | 修正或补文档 | **P1** | 要么 create 支持多关 / 明确选关，要么契约与文档写清「第一阶段只编译第一关」，并在检查点/摘要里说出来 |
| **W2-G04** | `animations.fps` / `loop` 到 manifest 即断；外壳硬编码帧率与 `repeat:-1` | `asset-spec.ts:84-85`；`pack.ts:1050-1057`；`demo/src/shell/scene.ts:140,193` | **E1 + E3** | 修正 + 补测 | **P1** | 外壳从 `manifest.assets[].animations[]` 取 `fps`/`loop`；测试断言 `jump.loop=false` 不循环、不同 fps 真的不同 |
| **W2-G05** | `entities[].motion` 只在 `hazard` 上被消费；`solid` 上的 motion 被校验/可达性当真、运行时不动 | `game-config.ts:59-67,74-81`；`world.ts:142`；`scene.ts:152-154`；`reachability.ts` 把实心体整段行程当可踩 | **E1 + E2** | 修正或补文档 + 补测 | **P1** | 要么运行时移动所有带 motion 的实体，要么契约限制 `motion` 只能用于 `hazard` 并加 schema/gate |
| **W2-G06** | VWS `lighting` 四格零读取 | `visual-world.ts:208-213`；全仓 grep 仅定义 | **E1** | 修正（接线到提示词或删除） | **P1** | 若保留：至少在 DNA / 规划提示词里具名插值；若不保留：从契约删除并升版说明 |
| **W2-G07** | VWS `styleIdentity.styleName`、`composition.characterScale`、`camera.projection/angle/elevation/perspective` 零读取 | `visual-world.ts:170,178-181,189`；`describeComposition` 白名单 `game-design/src/prompts.ts:347-355`；`worldBrief` `assets/src/prompt.ts:867-885` | **E1** | 修正或暂缓 | **P2** | 同 G06：要么有具名读者 + 测试，要么删/标注为兼容字段 |
| **W2-G08** | VWS 六桶 / `constraints` / `shapeLanguage` 只进提示词；无生成后判据；测试只断言「在提示词里」 | `game-design/src/prompts.ts:498-518`；`assets/src/prompt.ts:875,885`；测试 `dna-prompts.test.ts:32-39`、`plan-assets.test.ts:137-149`；A2 无视觉比对 | **E2（在场）** | 补测（视觉 QA）+ 补文档 | **P1** | 至少一条可重复的视觉对照（参考图 vs 交付图）或明确把这三项降为「提示词建议，不验收」 |
| **W2-G09** | `styleReferences` 多于 1 张时 `planAssets` 静默只取第一张 | `visual-world.ts:267`（无上限）；`create-game.ts:269-270` 只约束 create；`ops.ts:280,404-408` 只 `refs[0]` | **E1** | 修正 + 补测 | **P1** | `plan`/MCP 路径对 `styleReferences.length > 1` 明确拒绝（usage），或实现多图；测试覆盖 |
| **W2-G10** | Intent `winConditions` / `loseConditions` / `progression` / `challenge` 无消费者 | `game-intent.ts:163-172`；`designPrompt` `prompts.ts:295-344` 无插值；`auditIntentCoverage` 只读 entities/mechanics | **E1** | 修正或补文档 | **P1** | 要么在 `designPrompt` 里具名插值并补测试（至少证明用户的胜负条件被交给设计），要么在契约里写明「不进入设计」 |
| **W2-G11** | Design `progression` / `difficulty` 无消费者 | `game-design.ts:190-191,222-225`；`designBrief` `assets/src/prompt.ts:846-865` 不含；config 提示词不含 | **E1** | 补文档或暂缓 | **P2** | 文档明确它们是「人读的设计说明」；或接入 config/QA（需要新判据） |
| **W2-G12** | 设计四桶 → 资源清单没有覆盖判据（只有玩家动画闸） | `ops.ts:201-238`；`planner-masters.ts` 只补母版；无 design→recipe 的 id 对账 | **E1 + E2** | 新增判据 + 补测 | **P1** | 对 `enemies/npcs/interactables/resources` 的每个 id，要求 recipe 有对应资产（或明确豁免规则）；负例：删掉一个敌人资源 ⇒ 规划期拒绝 |
| **W2-G13** | `AssetSpec.styleId` 零读取 | `asset-spec.ts:19`；`recipe.ts:153-157` 自白；manifest 不收 | **E1** | 补文档（或后续升版删除） | **P2** | 文档标为遗留；若保留，至少加一条「与 `styleRef`/`style.id` 一致」的校验或删除 |
| **W2-G14** | `AssetSpec.required` / `AssetPackEntry.required` 零业务读者 | `asset-spec.ts:28`；`assetpack.ts:170`；`pack.ts:1209`；测试 `recipe-tool.test.ts:55-85` 只做形状对等 | **E1** | 修正或补文档 | **P2** | 要么定义 `required:false` 的语义（可缺、QA 跳过），要么删除；`required:false` 的产物必须有一条行为测试 |
| **W2-G15** | `AuthoringAsset.source` 的 image 参数（`reference`/`background`/`alphaThreshold`/`minLargestShare`）被接受但忽略 | `recipe.ts:164-174`；`pack.ts:430-460` 母版支只读 `kind`/`import.ref`/`size` | **E1** | 修正或补文档 | **P2** | 要么母版支消费这些参数并测试，要么在 schema/文档里禁止在母版上写 |
| **W2-G16** | DNA `palette` / `visualConstraints` 只进提示词；生成后不验证颜色/约束 | `character-dna.ts:106-125`；`dnaBrief` `assets/src/prompt.ts:75-99`；`paletteRefBounds` 只验下标 | **E2 + E3（仅到 prompt）** | 补测（视觉 QA） | **P1** | 至少一条像素级/人工对照证明 DNA 颜色进入交付图；否则明确「提示词建议，不验收」 |
| **W2-G17** | 空 VWS 色板在 VWS 层合法，直到 `pack` 才拒；设计与规划的调用已经花掉 | `visual-world.ts:199-206`；`ops.ts:1503-1504`；`palette.length===0` 在 `planAssets` 入口不查 | **E1 + E2** | 修正（前移 gate） | **P1** | `analyzeReference`/`planAssets` 在读入 VWS 后、任何上游调用前拒绝空色板；测试覆盖 |
| **W2-G18** | 大量 ① 档字段的测试只断言「出现在提示词/值为真」，不证明下游行为 | `design-prompts.test.ts:35-38`；`plan-assets.test.ts:114-131`；`compile-runtime.test.ts:298-313`；`dna-prompts.test.ts:32-39` | **E2（在场）** | 补测 | **P1** | 为每个 ① 档字段至少一条「字段 → 下游产物」的可证伪测试，或把「提示词在场」明确登记为唯一验收口径 |
| **W2-G19** | plan sidecar 无机器消费者（只作记录） | `ops.ts:421-441`；`pipeline/artifacts.ts:104-105`；全仓无 reader | **E2** | 补文档 / 暂缓 | **P2** | 文档写明它是审计记录；若希望它驱动重放/修复，另立票 |
| **W2-G20** | `StyleSpec` 六个旧字段零读取（`camera`/`composition`/`lighting`/`environment`/`characterStyle`/`confidence`） | `visual-world.ts:29-33`（已解释的兼容例外）；`prompt.ts:217`（camera 故意不读） | **E1** | 暂缓（R6 兼容） | **P2** | 已解释；只需在综合票确认「保留」即可，不当作新缺口重开 |
| **W2-G21** | `GameConfig.objective.kind` 无分支（单值枚举） | `game-config.ts:185`；`shell/scene.ts:269-274` 直接实现该规则 | **E1** | 补文档 / 暂缓 | **P2** | 文档写明「单值枚举是留位」；新增值时必须同时改外壳与 schema |

**跨票引用**：`source.kind="frames"` 被折叠成 `image` 是 W3 的 **F1**（[`w3-asset-routes.md`](w3-asset-routes.md)），
本票只确认它仍成立（`ops.ts:372`；`route.ts:154`），**不重开**。

---

## 4. v3 基线复核（Q3：只验证，不重开）

| 基线 | 复核结果 | 证据 |
|---|---|---|
| `deriveRecipe` 仍存在 / 默认 drawlist | **不成立**：源码无 `deriveRecipe` 函数或导出；只剩历史注释 | `grep -rn "deriveRecipe" packages --include="*.ts"` 仅 `assets/src/prompt.ts:563` 注释；W3 §1 |
| `planAssets` 是唯一规划入口 | **成立**：读 design/VWS → 一发工具调用 → `parseRecipe` → 玩家闸 → 母版兜底 → `resolveRoute` → 写 recipe/sidecar | `ops.ts:249-451`；`plan-assets.test.ts` 16 tests |
| `resolveRoute` 是 `source.kind` 唯一最终写入者 | **成立**：决策纯函数 + `sourceForDecision`；`planAssets` 再 `parseRecipe` 一次 | `route.ts:80-118,143-155`；`ops.ts:367-399`；`route-resolver.test.ts` 17 tests |
| 路线仍是三值 `image/drawlist/import` | **成立**（route/sidecar）；执行层多一个 `frames`，规划时折叠成 `image` | `asset-plan.ts:13`；`recipe.ts:143`；`ops.ts:372`；W3 F1 |
| plan sidecar 独立、只规划成功才写 | **成立**：`parseAssetPlan` 后才写 `v<N>.plan.json`；失败路径不落 | `ops.ts:421-441`；`plan-sidecar.test.ts:49-86` |
| `resolveRoute` 的 `context` 读 design/VWS | **不成立（但属 v3 基线）**：`RouteContext` 明确写「当前规则不读它」 | `route.ts:20-21`；本票只登记，不重开 |
| `planAssets` 的 `source.kind` 候选 | **成立**：模型给的是候选，最终由 resolver 改写 | `ops.ts:367-399`；`plan-assets.test.ts:181-208` |

---

## 5. 测试证据（本次实际运行）

命令（本地、免费、无网络）：

```bash
npx vitest run \
  packages/contracts/tests/visual-world.test.ts \
  packages/contracts/tests/game-intent.test.ts \
  packages/contracts/tests/game-design.test.ts \
  packages/contracts/tests/character-dna.test.ts \
  packages/contracts/tests/game-config.test.ts \
  packages/contracts/tests/recipe.test.ts \
  packages/game-design/tests/design-prompts.test.ts \
  packages/game-design/tests/dna-prompts.test.ts \
  packages/game-design/tests/build-design.test.ts \
  packages/game-design/tests/build-character-dna.test.ts \
  packages/assets/tests/plan-assets.test.ts \
  packages/assets/tests/route-resolver.test.ts \
  packages/assets/tests/plan-sidecar.test.ts \
  packages/assets/tests/compile-runtime.test.ts \
  packages/qa/tests/intent.test.ts \
  packages/qa/tests/visual.test.ts \
  packages/qa/tests/gameplay.test.ts \
  packages/demo/tests/world.test.ts
```

**结果：18 个测试文件全部通过，343 个测试通过，退出码 0**（Vitest 3.2.7）。
这证明的是「当前测试覆盖内的行为」，**不是** E2E、也不是字段语义已被验收。

与 W2 直接相关的测试断言（逐条说明它们**证明了什么**）：

| 测试 | 证明了 | 未证明 |
|---|---|---|
| `design-prompts.test.ts:35-38` | 12 个 ① 档字段名出现在设计提示词里 | 模型是否按字段产出 |
| `design-prompts.test.ts:40-47` | Intent 6 个 ① 档字段的**真值**被插值 | 设计层是否忠实 |
| `plan-assets.test.ts:114-131` | 12 个设计字段 + 真值进入规划提示词 | 资源清单是否覆盖它们 |
| `compile-runtime.test.ts:298-313` | 12 个设计字段 + `levels[0].layout` 进入 config 提示词 | config 是否照 layout 摆 |
| `dna-prompts.test.ts:32-39` | VWS 六桶与 `materials` 进入 DNA 提示词 | DNA 是否真的用了它们 |
| `master.test.ts:34-53` | DNA 8 字段逐个进入母版提示词；`palette` 翻成 hex | 图像是否遵守 |
| `build-character-dna.test.ts:79-125` | 逐字守门人能抓整句复制（换标点即绕过） | 语义层面的「类 vs 个体」 |
| `build-design.test.ts:89-162` | Intent id 覆盖 + camera 拒绝是真的判据 | 设计文本质量 |
| `game-config.test.ts:128-160` | 引用族能抓悬空/种类错 | 运行时是否真的按 `objective.gate` 判胜（见 G01） |
| `world.test.ts:88-163` | 背景层/玩家/实体/HUD/move 的纯层装配 | Phaser 实际画面 |
| `shell-scene-wiring.test.ts:33-40` | `advanceHazards` 按锚点移动 hazard | solid 上的 motion（见 G05） |
| `qa/tests/gameplay.test.ts:126-145` | 可达性有真负例 | 胜利/失败执行 |
| `qa/tests/intent.test.ts:77-85` | 文本相减**故意**不在 QA 里 | 语义覆盖 |

---

## 6. 真实产物（E3）与限制

**A1 — 归档完整单跑（早于 HEAD）**
`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-17d/wasteland-scavenger-assets/`
含 `run/v1/{visual-world,game-intent,game-design,character-dna,asset-recipe,game-config,qa-report}.json`
+ `pack/v1/manifest.json` + `site/v1/site.json`。
用途：证明 VWS→Intent→Design→DNA→Recipe→Pack→Config→Site 这条链**曾经**完整产出；
`qa-report.checked` 只有 5/6，两条 observation 都是 `unavailable`（`run/v1/qa-report.json`）。
限制：**早于 HEAD**（map.md:30），且缺 `asset-recipe.plan.json`（W1 §220 已记）；不能证明 HEAD 的每一行。

**A2 — 最终包（10-20f）**
`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
`manifest.json`（`assetpack/v4`，34 色，19 资源）+ `authoring/generated/*.png` + `*.prompt.txt`
+ `authoring/visual-world.json` + `authoring/stylespec.json`。
用途：证明 DNA 八字段 / VWS 色板 hex / StyleSpec identity/material **真的进入了发给模型的提示词**；
例如 `authoring/generated/ceiling-lurker.hang1.prompt.txt:8-13` 是 DNA identity/silhouette/palette 原文，
同目录 PNG 是那次调用的产物。
限制：**不能**证明图像遵守了这些文字；没有视觉相似度判据。

**A3 — 站点与运行时（10-20e）**
`.scratch/asset-integration-v1/runs/2026-10-20e-site/`
`site-report.md`、`screenshot-v1/v2.png`、`cdp-{a,b,run,jump}.png`、`console.txt`、`network-failures.txt`；
`out/ruin-scavenger-extraction-assets/site/v3/{game-config.json,site.json}`。
用途：证明 `world.size` / `player.anims` / `terrain` / `entities.kind` / `hud.panel` / `hud.pip` / `pickupCount`
在真实 Phaser 里改变行为（移动、跳跃、拾取、pip 点亮、动画在跑）。
限制：**这次 config 是手写的**（`site-report.md:6-12`），**不是** `compile-runtime` 产出；
因此它是 GameConfig→runtime 的 E3，不是 Design→GameConfig 的 E3。`site/v3/site.json` 显示 `pack:"v7"`。

**A4 — 失败现场（10-18a）**
`.scratch/style-migration-v1/runs/2026-10-18a/.failed-2026-10-18T13-14-03-081Z/`
只有 VWS / Intent / Design / DNA（无 recipe/pack）。用途：对照 VWS `composition`/`character` 与
design `world.structure` / DNA 五格，证明提示词消费在真产物里可见。限制：失败现场，无下游产物。

**A5 — plan sidecar（10-18d）**
`.scratch/style-migration-v1/runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1/asset-recipe.plan.json`
用途：证明 sidecar 的 `route/reason/candidate/participated/capabilities` 真的落盘；
与 recipe 的 `source.kind` 对账。限制：早于 HEAD（HEAD 会写同名文件，见 W1）。

**A6 — 色板实验**
`.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/`
`stylespec-*.json`、`palette-curation.md`、`qa-compare/*.png`。用途：观察色板变化对交付图的影响；
**不是**自动判据。

**产物完整性异常（登记，不用作反证）**
`run-out-2026-10-18a/.../run/v1/asset-recipe.json` 只有 1 个资产，而同目录 `pack/v2/manifest.json`
有 10 个资产；两者不可能来自同一次 `pack`。该 run 不作为「recipe↔design 覆盖」的反例；
只作为 VWS/Intent/Design/DNA 的对照材料。10-17d 的 10 资产 recipe 与 design 四桶一致，是本票采用的正例。

---

## 7. 限制与未决

1. **没有 HEAD E2E**（Q2 裁定）：不能声称「HEAD 上从参考图到可玩站点已通过」。
2. **没有付费调用**：所有图像/文本产物都是归档；不能观察新提示词对模型的影响。
3. **没有 reviewPack / inspectPack 观察**：A1 的 QA 两条 observation 都是 `unavailable`，
   所以「视觉一致性」没有 E3。
4. **没有运行 `site`**：A3 是既有站点目录 + 报告，不是本次重放。
5. **Prompt-only 字段的最终证据只能是视觉/玩法对照**：本票只证明「字段进入了提示词」，
   不把「出现」写成「生效」。
6. **跨票依赖**：W3 的 F1（`frames` 折叠）、W4 的 QA 不查胜负执行、W5 的测试覆盖缺口，
   在综合票里应与本票 G01/G02/G04/G12/G18 合并排优先级。

---

## Answer（摘要）

1. **关键字段没有大面积「未解释的死字段」**：少数死字段已逐条登记 —— VWS `styleIdentity.styleName` /
   `composition.characterScale` / `lighting` / `camera` 补充字段；Intent `progression` / `challenge` /
   `winConditions` / `loseConditions`；Design `progression` / `difficulty` / `winConditions` /
   `loseConditions`；Recipe `styleId` / `required` / 母版 image 参数；GameConfig `objective.kind`。
   全部 E1；多数没有测试（所以不能写成「已验收」）。
2. **VWS 的「新视图」主要不是可执行约束**：只有 `camera.mode` 是构建期判据，`styleReferences` 是
   真参考图输入，`style.palette` 是抠底/量化的真输入；其余字段只进提示词。六桶/constraints/shapeLanguage
   的测试只断言「在提示词里」（E2 在场），没有生成后判据。**E2（在场）/ E3（仅到 prompt）**。
3. **Intent 的胜负条件没有进入设计提示词**：`designPrompt` 只插值了 6 个 ① 档字段 + mechanics/entities/
   ambiguity；`winConditions` / `loseConditions` / `progression` / `challenge` 零读取（E1）。
4. **Design 的胜负/进阶/难度没有进入运行时**：`designBrief` 不含它们，QA 不读；真产物 A4 的
   loseConditions 与 A3 的 `hitHazard()` 行为矛盾（E1+E3）。
5. **`GameConfig.objective.gate` 是「只校验、不消费」**：运行时任何 goal 都触发胜利，`this.gate`
   赋值后从未读取；真配置有两个 goal（E1+E3）。这是本票最严重的运行时字段缺口（P0）。
6. **动画 fps/loop 在 manifest→runtime 断链**：`pack` 写、`resolvePackRef` 返回，但外壳硬编码帧率与
   `repeat:-1`（E1+E2）。`motion` 也只在 hazard 上生效（E1+E2）。
7. **v3 基线成立**：`deriveRecipe` 不存在，`planAssets`/`resolveRoute`/三值路线/plan sidecar 均按裁定；
   执行层 `frames` 折叠是 W3 的 F1，本票只引用不重开（E2）。
8. **测试现状**：18 个文件 / 343 个测试通过（退出码 0），但其中一大批只断言「字段出现在提示词」或
   「形状合法」；本票把它们逐条标成 `E2（在场）`，没有冒充 E3。
