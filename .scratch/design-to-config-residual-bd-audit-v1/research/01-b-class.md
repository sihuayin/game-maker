# B 类当前源码复核：Q2 / Q7 / Q10(a)(b)(c) / interactables / decor（P1 后）

- **Date**：2026-11-03
- **Baseline**：`main` @ `3b1b61d`（当前工作树与基线一致；`git status --short` 只显示本票新建的
  `.scratch/design-to-config-residual-bd-audit-v1/`）
- **Input**：P0 收口报告 [`final-report.md`](../design-to-config-residual-audit-v1/final-report.md)、
  P1 实施报告 [`report.md`](../design-to-config-residual-audit-v1-p1/report.md)、
  `entity-identity-v1.1` 裁定、`recipe-config-gap-v1` 裁定、当前源码
- **Nature**：只读研究。**不裁定修复去留**；不修改生产代码、测试、fixture、契约或历史证据；
  零付费、零模型调用、零生图；未 commit / 未建分支 / 未推送。
- **Line convention**：全部 `file:line` 指当前工作树（= 基线 `3b1b61d`）。

---

## 0. 结论速览

| 原子项 | 当前是否仍成立 | 证据级别 | P1 是否改变成立条件 | 语料重判（候选判据一旦落判） | 契约变更候选 |
|---|---|---|---|---|---|
| B-01 Q2 sprite 内部语义 / `role` 无人读 | **是** | E1 + E2（缺失语义判据）+ E3 | **否**：五类 kind 锁只锁 asset kind；`role` 仍无审计读取；`ConfigIssue.code` 三码不涉及语义 | `role` 非空：0；`solid` 的 role 启发式地形分类：0/318；新语义类字段：1599 件资产无该字段，属迁移成本而非误报 | 是：`AssetSpec`/`AssetPackEntry` 增必填 `semanticClass`（或等价封闭枚举） |
| B-02 Q7 `reachability` 只在 QA | **是** | E1 + E2 + E3 | **否**：`auditConfigPipeline` 未纳入 `auditReachability`；Q5 只统一了确定性复验 | 移入编译/汇合点：134 对 config+manifest 新增 **0** 条 error | 无必须 schema；可选 `ConfigIssue.code: "unreachable"` |
| B-03 Q10(a) 地形仅提示词线索 | **是** | E1 + E3（既有产物重判） | **否**：设计层无地形字段；config `terrain` 仍是无资源引用的 `Rect[]` | 启发式「layout 提地形 ⇒ 清单须有地形 sprite」：42 对 design+recipe 中 1 对命中（只有玩家资源的历史 run）；判据不可精确化 | 是：设计层结构化地形需求 |
| B-04 Q10(b) layout 散文表达 | **是** | E1 + E2 + E3 | **否**：`levels[].layout` 仍 `z.string()`；只进提示词 | 若要求结构化 layout：77/77 关全部不满足；不是零误伤 | 是：结构化 layout / 地形表达 |
| B-05 Q10(c) 斜坡无独立槽位 | **是** | E1 + E3 | **否**：`EntityKind` 仍无 slope；`terrain` 仍是 `Rect[]`；Runtime 无斜坡碰撞 | 3/49 设计在 layout 里提到斜坡；config 无斜坡实体可落（槽位不存在） | 是：新增 slope 实体或地形 shape 联合（**改 Runtime**） |
| B-06 `interactables` 同桶误归属 | **是**，且仍是既有冻结限制 | E1 + E2 + E3 | **否**：`auditConfigPipeline` 把 `auditEntityIdentity` 扩大了执行面，但兼容矩阵与 `type` 开放文本未变 | 已知样本 1 个 config（`gate`(goal) ← `sourceIntent:"chest"`）；28 个 distinct `type` 值使封闭映射不可行 | 是：封闭子类型 / 独立 goal 桶；不改契约则只能保留限制 |
| B-07 `decor` 无 kind 锁 | **是**，且仍是既有冻结限制 | E1 + E2 + E3 | **否**：P1 显式 `decor: undefined`；Q8 由它派生出 `npcs` 整桶豁免 | 若锁 `sprite|animation`：39 个 config 副本（同一件 `health-icon`，ui）新增 error；若只排除 `background`：0 | 无必须 schema；锁本身是表项变更，非契约形状变更 |

**总判断（事实层）**：P1 没有消除任何一项 B 类原子项。`ConfigIssue.code` 只覆盖
`entity-asset-kind` / `entity-state-frames` / `hud-panel-size` 三码；`auditConfigPipeline`
只统一了既有确定性审计，没有引入 `role` 语义分类，也没有纳入 `reachability`；五类实体
kind 锁把「资源形态」收紧到 `sprite|animation`，但**没有**把 `sprite` 内部再分类。

---

## 1. 方法与证据口径

### 1.1 当前源码

- 当前分支 `main`，HEAD `3b1b61d`；研究期间未改任何受版本控制的文件。
- `ConfigIssue` 的形状：`packages/contracts/src/game-config.ts:300-317`。
- P1 新增的统一审计：`packages/contracts/src/config-audit.ts:34-49`。
- P1 的实体 kind 锁：`packages/contracts/src/game-config.ts:51,56-70,400-418`。
- P1 的覆盖闸 kind 检查：`packages/assets/src/ops.ts:267-274`。
- P1 的构建汇合点：`packages/pipeline/src/create-game.ts:620-636`。

### 1.2 证据分级

| 级别 | 本报告用法 |
|---|---|
| E0 | 推测；不作为结论依据 |
| E1 | 当前源码定位（调用链、分支、字段是否被读） |
| E2 | 既有测试（文件 + 用例名 + 断言；本报告复跑） |
| E3 | 既有真实产物 + 零付费运行证据（只读语料扫描、既有 run 重判） |

### 1.3 语料重判口径（E3）

- 扫描范围：`out/**`、`fixtures/**`、`.scratch/**`，跳过 `node_modules` / `.git`，共 5243 份 JSON。
- 识别到：`game-config/v1` **151** 份、assetpack 各版本 manifest **171** 份、
  `game-design/v1` **49** 份、`asset-recipe/v1` **83** 份。
- config ↔ manifest 配对：从 config 目录向上找最近的 manifest；同层按 manifest `id` 是否出现在
  config 路径中优先；共 **134** 对（17 份找不到邻近包，跳过）。该口径比 P1 报告
  「102 份能就近配到 manifest」更宽（包含同项目多个 site 版本），但 P1 的关键数字
  `entity-state-frames = 75` 在本口径下**逐字复现**，可作为口径交叉校验。
- design ↔ config 配对：仅接受共同路径前缀 ≥ 4 层的同 run 设计，共 44 对（不用于 B-06 的
  全量推断，只用于已知样本重判）。
- design ↔ recipe 配对：共同路径前缀 ≥ 4 层，共 **42** 对（B-03 启发式扫描用）。
- 扫描命令：内联 `node --input-type=module`，只读 `fs.readFileSync` + 当前 `packages/contracts/dist`；
  **exit 0**。本报告所有 E3 数字来自同一次汇总输出（见 §9）。
- 扫描是**只读**的：没有重跑构建、没有写任何 run / pack / site、没有修改历史产物。

### 1.4 测试复跑（E2）

```text
pnpm exec vitest run \
  packages/contracts/tests/game-config.test.ts \
  packages/contracts/tests/reachability.test.ts \
  packages/contracts/tests/game-design-gate.test.ts \
  packages/qa/tests/gameplay.test.ts \
  packages/assets/tests/plan-coverage-gate.test.ts \
  packages/pipeline/tests/create-game.test.ts
```

结果：**6 files / 194 tests passed，exit 0**（2026-11-03）。这是本报告唯一一次执行测试的命令；
未运行付费链、未调用模型、未生图。

---

## 2. P1 改变的共同面（先回答「是否改变 B 项成立条件」）

### 2.1 `ConfigIssue.code` 的位置与边界

`packages/contracts/src/game-config.ts:300-317`：

```ts
export type ConfigIssue = {
  severity: "error" | "warning";
  where: string;
  message: string;
  code?: ConfigIssueCode;
};
export const CONFIG_ISSUE_CODES = ["entity-asset-kind", "entity-state-frames", "hud-panel-size"] as const;
```

事实：

- 三码都是 P1 的 Q1/Q3/Q4 新增或加强的错误；既有 47 个构造点不 retrofit（源码注释明写）。
- 没有任何 B 类错误被赋码：`auditEntityIdentity`、`auditReachability`、`auditReferences` 的
  `role` 相关路径都没有 `code`。
- `ConfigIssue` 仍没有 `entityId` / `assetId` / `expected` / `actual` / `semanticClass` 这类字段；
  因此 B 类若需要机读区分，仍得新增码或新增字段（均属契约变更）。

### 2.2 `auditConfigPipeline` 的组成与缺口

`packages/contracts/src/config-audit.ts:34-49`：

```ts
const resampleable: ConfigIssue[] = [
  ...auditGameConfig(config, ctx.manifest),
  ...(ctx.design === undefined ? [] : auditEntityIdentity(ctx.design, config, ctx.levelId)),
  ...auditScreenSpace(ctx.viewport, gameHudScreenItems(config, ctx.manifest, { lineHeight })),
];
const deterministic: ConfigIssue[] = [
  ...resampleable,
  ...auditLayerCoverage(...),
];
```

事实：

- **纳入**：引用族、自洽族、身份对账、HUD 屏幕空间、层覆盖。
- **未纳入**：`auditReachability`。因此 B-02 的「只在 QA」没有因为 Q5 的统一入口而改变。
- 身份对账被纳入，意味着 P1 之后 `runBuild` 的汇合点也会跑 `auditEntityIdentity`
  （`packages/pipeline/src/create-game.ts:620-636`）。这**扩大了 B-06 既有矩阵的执行面**，
  但没有改变矩阵本身，也没有改变同桶限制。

### 2.3 五类实体 kind 锁与 `decor`

`packages/contracts/src/game-config.ts:56-70`：

```ts
export const ENTITY_ASSET_KINDS = {
  solid: ["sprite"],
  pickup: ["sprite", "animation"],
  hazard: ["sprite", "animation"],
  goal: ["sprite", "animation"],
  chest: ["sprite", "animation"],
  danger: ["sprite", "animation"],
  decor: undefined,
};
```

事实：

- P1 新增的是 `pickup/hazard/goal/chest/danger` 五类；`solid` 的锁在 `recipe-config-gap-v1` 时已有。
- 锁的是 **AssetKind**（`sprite` / `animation` / `background` / `ui`，`assetpack.ts:105`），
  不是 `sprite` 内部的语义类别（地形 / 道具 / 角色）。
- `decor: undefined` 是显式表态，不是遗漏；同一份注释写明「v7 真配置动画与 ui 都合法」。
- `DESIGN_BUCKET_ASSET_KINDS` 由 `DESIGN_BUCKET_KINDS` + `ENTITY_ASSET_KINDS` 派生
  （`game-config.ts:615-627`）。因为 `npcs → decor` 且 `decor` 无锁，派生的 `npcs` 整桶为
  `undefined`（不做 asset-kind 检查）。这是 B-07 在 P1 后的一个**结构性旁证**，不是新缺口。

### 2.4 对 B 项的净影响

- **没有一项被 P1 消除**。
- B-01 的适用范围被 Q1 收窄到 `sprite|animation`（不再有 `pickup → ui` 这类更粗的错误），
  但 `sprite` 内部语义仍无分类。
- B-02 被 Q5 的统一入口明确**排除在外**（事实，不是评价）。
- B-03/B-04/B-05 未被 P1 触碰；P1 唯一的设计契约收紧是 `resources ≥ 1`
  （`packages/contracts/src/game-design.ts:285-301`），与地形/布局/斜坡无关。
- B-06 的同一份身份矩阵现在在 config 编译与 build 汇合点都跑；限制不变。
- B-07 的 `decor: undefined` 被 P1 保留并新增回归测试（`game-config.test.ts:668`）。

---

## 3. B-01：Q2 sprite 内部语义 / `role` 无人读

### 3.1 当前状态

**仍成立。** P1 的 kind 锁只回答「这个槽位能不能引用这个 AssetKind」，不回答
「这件 `sprite` 是地形、道具还是角色」。`role` 仍不被任何审计函数读取。

源码事实：

- `AssetKind` 只有四个值：`sprite` / `animation` / `background` / `ui`
  （`packages/contracts/src/assetpack.ts:105`）。
- `AssetSpec.role` 是自由文本 `z.string()`（`packages/contracts/src/asset-spec.ts:17`）；
  `AssetPackEntry.role` 同样是 `z.string()`（`packages/contracts/src/assetpack.ts:167`）。
- `auditReferences` 只按 `AssetKind` 判槽位（`game-config.ts:349-363,400-418`）；
  `auditGameConfig`、`auditEntityIdentity`、`auditPanelSize`、`auditReachability` 都没有
  读取 `role`。
- `role` 的真实消费者是**图像提示词**（`packages/assets/src/prompt.ts:212,377,405,480,537`）
  与**塔防**编译提示词（`packages/assets/src/ops.ts:1373-1378`）。
- **横版** config 编译提示词 `resourceBrief` **不打印 `role`**（`packages/assets/src/ops.ts:953-964`）：
  它打印 `id / kind / size / 九宫格 / 锚点 / 动画`。因此 B-01 不是「`role` 绝对无人读」，
  而是「**审计不读、横版 config 模型也看不到**」；这一点比 P0 的表述更精确。

P1 是否改变：**否**。Q1 锁只把 `sprite|animation` 之外的值排除，`sprite` 内部仍无分类；
`ConfigIssue.code` 没有语义码；`auditConfigPipeline` 没有语义分类器。

### 3.2 证据

| 级别 | 证据 |
|---|---|
| E1 | `assetpack.ts:105`（四值 AssetKind）；`asset-spec.ts:17` 与 `assetpack.ts:167`（role 自由文本）；`game-config.ts:349-363,400-418`（只锁 kind）；`ops.ts:953-964`（横版 brief 不打印 role）vs `ops.ts:1373-1378`（塔防 brief 打印 role） |
| E2 | `packages/contracts/tests/game-config.test.ts:639-700` 的 P1·Q1 用例全部按 `AssetKind` 断言，**没有一条**读 `role`；`packages/contracts/tests/asset-spec.test.ts:15-39` 的 `role` 只是任意字符串（`protagonist` / `ground-tile` / `scene-backdrop` / `panel`），schema 不约束取值。**没有「sprite 语义类别」测试，因为实现里没有该字段/判据。** |
| E3 | 语料 1599 件 manifest 资产、`role` 空串 **0**；134 对 config 中 `solid` 引用 318 次，涉及 13 个 distinct role。所有 role 都是地形/障碍语义（地面砖、台阶、平台、碎石堆、断墙、钢板、行李堆等）；没有 `solid → 失物收集物` 这类 P0 探针 G2 的现存样本。 |

补充 E3（语义混用的现存形状）：同一件资产在不同槽位被复用：

- `wasteland-platform-tile`：`solid` + `goal`；
- `tile-platform`：`solid` + `goal`；
- `station-platform`：`solid` + `goal`。

39 个 config 副本；本次汇总口径下至少 3 件 distinct 资产。它们是既有产物，不是本图造出的；只说明
「只看 AssetKind 时，同一件地形 sprite 可以同时承担终点外观」。

### 3.3 候选判据与误报边界

**可写但不够精确的候选**

1. `AssetSpec.role` / `AssetPackEntry.role` 非空。
   - 精确、可计算；但 `role` 仍是自由文本，非空不代表语义正确。语料新增 error = 0
     （1599 件全部非空），但这条判据**抓不到 P0 G2**（`role:"失物收集物"` 也是非空）。
2. `solid` 引用的资产，其 `role` 命中地形关键词表（地面/砖/台阶/平台/碎石/坡/墙/钢板/tile）。
   - 关键词表不是契约、不是封闭枚举；换一种自然语言写法就漏（英语 `ground` 已需并列）。
   - 语料 318 次 `solid` 引用的 role 全部可读为地形/障碍，新增 error = 0；但这不是
     「零误伤」的证明，只是「关键词表恰好覆盖了当前语料」。
3. 同一件资产不得同时承担 `solid` 与非 `solid` 槽位。
   - 精确、可计算；但语料会命中至少 3 件资产、39 个 config 副本（上面的 `solid`+`goal`）。
     这些是既有合法产物（终点用平台砖外观），所以该判据的误报边界不够干净。
   - 它也不是 P0 G2 的判据：G2 是 `solid` 引用拾取物 sprite，拾取物仍可只被 `solid` 引用。

**不可写（缺语义信息）**

- 缺少一个**机读的资产语义类别**，以及「实体槽位 → 允许的语义类别」的映射。
  `role` 是自由文本、无封闭取值；`AssetKind` 又不能区分地形/道具/角色。
  因此「`sprite` 内部语义」在当前契约下没有可计算判据。

### 3.4 语料重判

- 候选 1（`role` 非空）：新增 error **0**。
- 候选 2（`solid` role 地形关键词）：新增 error **0**（318/318 当前 role 可读为地形/障碍）。
- 候选 3（禁止 `solid` 与其它槽位共用资产）：新增 error **39 个 config 副本 / 至少 3 件 distinct 资产**；
  逐条解释：`wasteland-platform-tile`、`tile-platform`、`station-platform` 在既有 config 中
  既是 `solid` 又作为 `goal` 外观；若判为 error，这 39 份历史副本都会被判死，故不是零误伤。
- 若新增必填 `semanticClass`：当前 **1599** 件资产全部缺该字段（schema 迁移，不是语义误报）；
  语料无法在「不修改历史产物」的前提下直接重判。

### 3.5 修改面

- 若走「新增 `semanticClass`」：`packages/contracts/src/asset-spec.ts`（AssetSpec）、
  `packages/contracts/src/assetpack.ts`（AssetPackEntry / 包格式版本）、
  `packages/contracts/src/recipe-tool.ts`（v4 镜像）、`packages/contracts/src/recipe.ts`（引用族）、
  `packages/assets/src/pack.ts`（写入侧）、`packages/assets/src/prompt.ts`（生成提示）、
  `packages/contracts/src/game-config.ts`（审计判据）、全部 manifest / fixture。
  包格式需升版（当前 `assetpack/v4`，`assetpack.ts:57`）；历史包若不能读，需版本分支或迁移。
- 若不改契约：只能改提示词/规划期线索（`prompt.ts:985-989` 一类），不是判据；
  或继续依赖 `role` 关键词，违反 CONTEXT 的「精确可计算」门槛。
- 不改 Runtime / CLI / MCP 的对外形状（若只加审计字段）；但 manifest schema 变更会影响
  所有消费者与历史数据。

### 3.6 契约变更候选

| 项 | 内容 |
|---|---|
| 变更内容 | 在 `AssetSpec` 与 `AssetPackEntry` 增必填封闭枚举 `semanticClass`（如 `terrain` / `prop` / `character` / `ui` / `background`）；`auditReferences` 对 `solid` 要求 `terrain`，其余槽位按表约束 |
| 必要性 | 这是唯一能把「地形 / 道具 / 角色」变成可计算判据的语义信息；`role` 自由文本与 `AssetKind` 四值都不够 |
| 不改契约的替代 | 保留 kind 锁 + 提示词（现状）；或加**可选** `semanticClass` 且仅在存在时检查（则当前语料 0 命中，判据不会真正生效，只是空壳） |
| 影响面 | manifest 格式升版；1599 件历史资产；pack 写入、recipe 镜像、prompt、所有读取 manifest 的消费者与测试；序列化字段新增 |
| 不做后果 | `solid` 仍可引用任意 `sprite`；P0 G2（拾取物 sprite 当地形）一类错误在「单帧 sprite」形态下仍可穿过 kind 锁 |
| 审批点/前置 | 需单列审批契约变更；必须先决定语义类别集合与历史包迁移策略；本图不实施 |

### 3.7 前置裁定（逐字）

> **P0 04 裁定，Q2**：「`sprite` 内部无可机读语义分类，`role` 无人读 | **B** | 当前只保证资源形态兼容，
> 不保证角色/地形/道具语义正确；补分类是契约级改动 | Out of scope」

> **P0 final-report §10**：「`sprite` 内部语义（地形/道具/角色）与 `role` 消费：需要清单级语义分类，B 类。」

> **P0 开图冻结 Q6**：「以下明确不属于本图：`interactables` 同桶误归属（如 `gate → chest`）；
> `decor` 不增加 kind 锁；`entity-identity-v1.1` 已裁定的 C 路线限制。只有当审计提供证据证明
> 它们直接造成当前目标范围内的失败时，才允许提交范围变更建议。」

---

## 4. B-02：Q7 `reachability` 只在 QA

### 4.1 当前状态

**仍成立。** `auditReachability` 仍只由 QA 玩法族调用；P1 的 `auditConfigPipeline` 没有纳入它。

源码事实：

- `packages/contracts/src/reachability.ts:44` 定义 `auditReachability`；只报不可达的
  `goal` / `pickup`，`severity: "error"`（`reachability.ts:217-225`）。
- 唯一调用点是 `packages/qa/src/gameplay.ts:80`（`reachability: merged("game-config", auditReachability(...))`）；
  QA 合成器在 `packages/qa/src/assemble.ts:96` 声明这一条。
- `auditConfigPipeline`（`config-audit.ts:34-49`）只含 `auditGameConfig` / `auditEntityIdentity` /
  `auditScreenSpace` / `auditLayerCoverage`，**不含** `auditReachability`。
- `auditGameConfig` 的「可通关族」只是**警告**：逐 solid 的台阶高 vs 最大跳跃高度、以及
  `motion` 行程越界（`game-config.ts:562-584`）；它不是图搜索，不覆盖 pickup/goal 的不可达。
- QA 的默认路径：`qaRunnerOf` 里 `null` 才关 QA（`create-game.ts:218-219`），`runBuild` 默认
  `qaRunner`，QA 硬失败阻断（`create-game.ts:232-250,708`）。因此「QA 默认会跑并阻断」成立。
- 但 QA 报告只绑 **pack 身份**：`publish-gate.ts:10-12` 明写「只钉 pack，不钉 config」；
  `reachability` / `reference-resolution` 吃 config，一份绿色 pack 报告仍可给另一份手写 config 放行。
  这使 B-02 不只是「阶段晚」，还是「报告与 config 的绑定面不完整」。

P1 是否改变：**否**。Q5 统一了 `auditConfigPipeline`，但明确没有把 reachability 放进去；
`ConfigIssue.code` 也没有给 reachability 赋码。

### 4.2 证据

| 级别 | 证据 |
|---|---|
| E1 | `reachability.ts:44-225`；`qa/src/gameplay.ts:71-85`（唯一调用）；`config-audit.ts:34-49`（未纳入）；`game-config.ts:562-584`（只有台阶高/行程警告）；`publish-gate.ts:10-12`（report 只钉 pack） |
| E2 | `packages/contracts/tests/reachability.test.ts:35-179`：真夹具通、200px 沟、100px 墙、40px 沟/墙、120px 高 pickup、出生点无落脚点不报、玩家资源解不到不报、阈值来自 60.5px 顶点等；`packages/qa/tests/gameplay.test.ts:129-148`：QA 族真的会报不可达；本报告复跑 6 文件 194 tests exit 0。 |
| E3 | 语料 134 对 config+manifest 上 `auditReachability` 返回 **0 条 error**；`fixtures/game-configs/last-train.json` + `fixtures/packs/last-train/v2/manifest.json` 也是 0。 |

### 4.3 候选判据与误报边界

**可写判据**

- `auditReachability(config, manifest).length === 0`。
- 这是精确的纯层 BFS；射程已在源码文件头写明：玩家能力**一律往强里估**，
  `hazard` 当空气、下落不设限、带 `motion` 的 solid 按整段行程算、落点取下降段；
  **只报「够不到」**，从不报「可达」。因此它偏向漏报，不偏向误报。
- 误报边界（源码自述）：出生点附近没有落脚点时不报（归 `auditGameConfig` 的出生点族）；
  玩家资源解不到时不报（归引用族）；它抓不到贴边/连续蹬墙/绕顶等精细路线（那会报可达，
  是安全侧）。所以把「不可达」当 error 的误伤风险低，但**漏报**仍存在。

**不适合直接写成 compile 期判据的理由（事实，不是裁定）**

- 它需要 `manifest` 与完整 config，放在 `auditConfigPipeline` 技术上可行（签名已有 manifest）；
  但会改变失败分档：从 QA 的 `fail` 变成 config 编译的 `invalid`/重采样，或变成 build 汇合点
  的确定性硬失败。P0 Q7 的既有理由正是「拉进 compile-runtime 会改变失败分档」。
- 当前 `auditConfigPipeline` 有 `resampleable` / `deterministic` 两档；若加入 reachability，
  需要决定放哪一档：放 `resampleable` 会让模型因布局不可达连抽 3 发（可能仍改不好）；
  放 `deterministic` 会在不重采样的情况下硬拒。这是设计选择，不是判据能不能写的问题。

### 4.4 语料重判

- 候选判据 `auditReachability(...).length === 0` 在 134 对 config+manifest 上新增 error **0**。
- 逐条解释：无新增；当前语料中的真实 config（含历史 wasteland / last-train / 自测负例）都没有
  不可达的 pickup/goal。
- 注意：这不表示「移入编译后仍 0 误伤」在所有语义上成立，只表示**当前语料** 0；
  也不表示现有的 QA 路径已经覆盖手工改 config 的发布路径（见 §4.1 的 publish-gate 事实）。

### 4.5 修改面

- 若移入编译/汇合点：`packages/contracts/src/config-audit.ts`（新增调用）、
  `packages/assets/src/ops.ts`（`compileRuntime` 的两处 pipeline 调用）、
  `packages/pipeline/src/create-game.ts`（汇合点）。可能保留 QA 调用以免报告缺判据。
- 不改 Runtime；不改 CLI/MCP 的对外形状，但失败阶段与退出码会变（config 的 `invalid` 4
  vs QA 的 `invalid` 4，错误文案/落盘时机不同）。
- 若只加发布绑定：`packages/pipeline/src/publish-gate.ts` 需要 config 身份，属于契约/报告形状变更。

### 4.6 契约变更候选

| 项 | 内容 |
|---|---|
| 变更内容 | 无必须的 schema 变更。可选：给 reachability 的 `ConfigIssue` 加 `code: "unreachable"`（需扩 `CONFIG_ISSUE_CODES`） |
| 必要性 | 若要在编译/汇合点机读区分「不可达」与其它确定性失败，码有测试与后续处理价值；若只保留 QA，则不必 |
| 不改契约的替代 | 保持 QA；或在 `auditConfigPipeline` 直接调用现有函数（无新码），用 `where`/`message` 区分；或只补 publish-gate 的 config 绑定，不改判据层 |
| 影响面 | 若加码：`game-config.ts` 闭集、QA `ConfigIssue` 消费者、测试；若移阶段：失败分档、退出码、重采样账 |
| 不做后果 | 手工改 config / `qa: null` / 以别的 config 复用 pack 报告时，不可达关卡仍可能出现在交付物里；编译期不拦 |
| 审批点/前置 | 若动 `ConfigIssueCode` 或 publish-gate 的 config 身份，单列审批；若无码、只换调用点，属行为变更仍应单列 |

### 4.7 前置裁定（逐字）

> **P0 04 裁定，Q7**：「属于玩法质量检查，不是资源语义检查；拉进 compile-runtime 会改变失败分档 | Out of scope」

> **P0 final-report §10**：「`reachability` 只在 QA：B 类。」

> **P0 开图冻结 Q6**：「只有当审计提供证据证明它们直接造成当前目标范围内的失败时，才允许提交范围变更建议。」

> **P1 map Out of scope**：「B 类（sprite 语义/`role`、reachability 并入 compile、地形/斜坡限制）、
> D 类（上游诊断/盲重采样、`viewport`/`role` 贯通、设计 goal 桶）—— 仍冻结或另立 effort。」

---

## 5. B-03：Q10(a) 地形仅有提示词线索

### 5.1 当前状态

**仍成立。** 设计层没有地形需求的结构化字段；`GameConfig.terrain` 仍是不引用资源的 `Rect[]`；
规划期的地形 sprite 只由提示词引导，plan 闸不检查「layout 提到地形但清单没有地形 sprite」。

源码事实：

- `GameDesignSpec.levels[]` 只有 `{ id, purpose, layout, entities[] }`，`layout` 是
  `z.string()`（`packages/contracts/src/game-design.ts:176-188`，`layout` 在 `:182`）。
- `GameConfigSchema.terrain` 是 `z.array(Rect)`（`packages/contracts/src/game-config.ts:240`）；
  `Rect` 不引用任何 asset（`game-config.ts:43`）；`auditGameConfig` 只判它是否在世界内
  （`:537`）与可通关警告的 groundY（`:568`）。
- 地形 sprite 的正向线索在 `packages/assets/src/prompt.ts:985-989`：
  「若这一关的 `layout` 需要看得见的静态碰撞体（地面砖 / 台阶 / 碎石堆 / 斜坡），产出一件对应的
  `sprite`（role 写……）；不产它，关卡就只剩看不见的地面线。」
- 规划闸 `designCoverageGate` 只查四桶 id；`backgroundCoverageGate` 查背景；`hudUiGate` 查 ui；
  没有地形闸（`packages/assets/src/ops.ts:267-274` 及全文件无 terrain gate）。
- P1 改了 `hudUiGate`（无条件）与覆盖闸 kind（`ops.ts:267-274,300-329`），**没有**新增地形闸。

P1 是否改变：**否**。P1 的 `GameDesignSpec` 只增加了 `resources ≥ 1`（`game-design.ts:285-301`），
没有地形字段；P1 的 `DESIGN_BUCKET_ASSET_KINDS` 只对四桶的 asset kind 做派生，不涉及 layout/terrain。

### 5.2 证据

| 级别 | 证据 |
|---|---|
| E1 | `game-design.ts:176-188`（无地形字段）；`game-config.ts:240,537,568`（terrain 为 Rect）；`prompt.ts:985-989`（只有提示词线索）；`ops.ts:267-274`（覆盖闸只看四桶 id/kind） |
| E2 | `packages/assets/tests/compile-runtime.test.ts:370` 断言 `levels[0].layout` 原样进提示词；`packages/assets/tests/compile-runtime.test.ts:360` 断言设计字段按点号路径插值。**没有地形闸测试**；`packages/assets/tests/plan-coverage-gate.test.ts:54-105` 只覆盖四桶 id 覆盖，`126-169` 只覆盖 Q8 kind，未覆盖地形。 |
| E3 | 语料 42 对 design+recipe：其中 38 对的 layout 含地形/平台/砖/台阶/碎石等词（启发式），42 对中 41 对的 recipe 有可读为地形 sprite 的资产，**1 对没有任何地形资产**（`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/.../asset-recipe.json`，只有 1 件玩家 animation）。该 run 的 recipe 已存在于历史产物中，plan 闸没有因 layout 地形需求而拒绝。 |

P0 的既有 E3（复现 3）仍可引用：历史设计 + 手工补 ui、不补地形 sprite 的清单，`planAssets`
一发通过（P0 `final-report.md` §3/§5；本报告未重跑付费链）。

### 5.3 候选判据与误报边界

**候选（均不可精确化）**

1. 「`levels[].layout` 命中地形关键词 ⇒ recipe 至少一件 `sprite`（role/description 命中地形词）」。
   - 关键词表不是契约，无法覆盖自由散文的同义改写；`layout` 提到「地面」也可能有意用
     看不见的 `terrain` 搭地面（`ops.ts:1120` 明确允许「清单没地形 sprite 时用 terrain」）。
   - 语料启发式命中 1/42；不能证明 0 误伤，也不能证明覆盖完整。
2. 「设计层显式声明地形需求 ⇒ recipe 必须有对应资源」。
   - 需要先在 `GameDesignSpec` 增结构化字段；当前没有，无法重判。
3. 「`GameConfig.terrain` 非空 ⇒ 必须有 solid sprite」不成立：`terrain` 的定义就是
   「看不见的碰撞」，与可见地形 sprite 是**替代关系**，不是蕴含关系（`game-config.ts:48,240`）。

**不可写的原因**：缺少「设计层对地形/道具的结构化需求」；`layout` 是 prose，且 Runtime 契约
明确允许退化到 invisible `terrain`。因此无法给出「精确、可计算、错了一定不是设计意图」的判据。

### 5.4 语料重判

- 启发式候选「layout 提地形 ⇒ recipe 有地形 sprite」：42 对 design+recipe 中 **1 对**新增 error。
  逐条解释：该 recipe 只有 `player-scavenger` 一件 animation（不是 sprite），layout 提到
  「碎石尖刺瓦砾带 / 地面缺口」；这更像一次未完成/失败的清单，而不是能证明判据精确的样本。
- 由于判据本身不可精确化，这个 1 不能当作「零误伤」证明；若把「地面」等词都算入，会把
  仅用 invisible terrain 的合法关卡误判。
- 当前语料没有出现「layout 明确要碎石堆/斜坡且 recipe/solid 无任何对应 sprite」的成功产物
  （38 对中 37 对有地形 sprite）；P0 复现 3 是人工构造的缺地形清单。

### 5.5 修改面

- 若做结构化设计需求：`game-design.ts`（新增 `levels[].terrain` 或 `requiredProps`）、
  `game-design/src/prompts.ts`（逐条生产）、`assets/src/prompt.ts`（插值）、
  `assets/src/ops.ts`（新增规划闸）、`assets/src/compile-runtime`（映射到 solid/terrain）、
  全部 design fixture。修改面大，涉及设计契约与历史设计。
- 若只加强提示词：`prompt.ts:985-989` 与 `ops.ts:1120`；不是判据，无法确定性保证。
- 不改 Runtime / CLI / MCP；但若新增设计字段，所有设计消费者与历史设计需要迁移。

### 5.6 契约变更候选

| 项 | 内容 |
|---|---|
| 变更内容 | `GameDesignSpec.levels[]` 增结构化地形/道具需求（如 `terrain: { kind: "visible"|"invisible", roleHint?: string }[]` 或 `requiredProps: string[]`），并定义它到 `solid` / `terrain` 的映射 |
| 必要性 | 没有结构化字段就无法把「layout 要地形」变成可计算判据；提示词只能提高概率 |
| 不改契约的替代 | 维持 (c) 退化：提示词正向产地形 sprite，缺了退 invisible `terrain`；不加判据。或加**可选**字段且仅在存在时检查（当前 0 命中，判据空转） |
| 影响面 | 设计契约、设计提示词、规划闸、config 编译、全部设计 fixture；不直接影响 Runtime 形状 |
| 不做后果 | 可见地形 sprite 的产率仍只由提示词决定；缺地形时关卡变平但合法（既有 (c) 裁定接受） |
| 审批点/前置 | 属于设计层 schema 变更；与 `recipe-config-gap-v1` 的「设计层结构化 HUD/地形需求 out of scope」裁定冲突，需先单列审批/重新裁定 |

### 5.7 前置裁定（逐字）

> **P0 04 裁定，Q10(a)(b)(c)**：「地形仅提示词线索并允许退化；layout 散文无结构化需求；
> 斜坡无独立槽位 | **B** | 前序已裁定，不重开 | Out of scope」

> **`recipe-config-gap-v1` 票 03 Answer**：「选 (c) —— 两者兼备……**安全网 = (b)**：solid/decor →
> `["sprite"]` 的 kind 锁（确定性，进票 05）+ 提示词规则「清单没地形 sprite 时用看不见的
> `terrain` 搭地面，**禁止拿玩家/动画资源当 solid**」。缺 sprite 时退 terrain。」

> **`recipe-config-gap-v1` map Out of scope**：「设计层结构化 HUD/地形需求（Q1=c 否决）：
> 让 `GameDesignSpec` 显式表达 HUD/地形，不在本图；prose layout 的自由度保留。」

---

## 6. B-04：Q10(b) layout 散文表达

### 6.1 当前状态

**仍成立。** `levels[].layout` 仍是 `z.string()`；设计层没有 layout 的结构化表示；
`designBrief` 把它原样插入提示词；没有任何解析器或闸读它的结构。

源码事实：

- `game-design.ts:182`：`layout: z.string()`。
- `packages/assets/src/prompt.ts:869-870`：`designBrief` 逐关输出
  `` `levels[].purpose`：…｜怎么走：${l.layout}｜这一关有：… ``。
- `compile-runtime` 的提示词也插入 `layout`（测试断言见 `packages/assets/tests/compile-runtime.test.ts:370`）。
- 没有 `layout` 解析器：搜索 `layout` 只命中 schema、提示词与测试，没有结构化消费者。
- P1 未改：P1 的设计契约只加了 `resources ≥ 1`（`game-design.ts:285-301`）。

### 6.2 证据

| 级别 | 证据 |
|---|---|
| E1 | `game-design.ts:176-188,182`；`prompt.ts:854-871,869-870`；`ops.ts` 中 `designBrief` 调用（`prompt.ts:918` 在 `assetPlanPrompt`）；无 layout 解析器 |
| E2 | `packages/assets/tests/compile-runtime.test.ts:370` 断言 layout 原样出现在 config 编译提示词；`packages/game-design/tests/design-prompts.test.ts:57` 断言 `levels[].layout` 要与参考图环境挂钩（提示词纪律，不是结构化判据）。 |
| E3 | 49 份设计、**77** 个 `levels[]`；`layout` 空串 **0**，全部是自然语言字符串。没有任何 layout 被结构化解析的产物。 |

### 6.3 候选判据与误报边界

- 「`layout` 必须满足某结构化 schema」：当前 77/77 关全部不满足；这是 100% 误伤，不是判据。
- 「`layout` 必须包含某些 token」：散文写法不可枚举；无法区分「合法但换一种说法」与
  「真的没写」。不符合 CONTEXT 的判据门槛。
- **不可写的原因**：缺少 layout 的机器可读表示；自由散文的语义不可机械判定。
  这与 `entity-identity-v1.1` 对 `interactables[].type` 的判断同构（开放文本 ⇒ 精确映射不可行）。

### 6.4 语料重判

- 若判据是「layout 必须结构化」：77/77 关新增 error（全部现有设计）。
- 若判据是「layout 必须包含地形关键词」：只是文本匹配，不能证明语义；本报告不把它当作候选判据。
- 结论：该项无法给出满足「语料零误伤」的判据。

### 6.5 修改面

- 若做结构化 layout：`game-design.ts`、`game-design/src/prompts.ts`、`assets/src/prompt.ts`、
  `assets/src/ops.ts`、`assets/src/compile-runtime.ts`、全部 design fixture；可能还要
  `visual-design` / VDS（如果 layout 结构化后要映射视觉对象）。
- 若不改契约：继续只作提示词文本；无确定性修改面。

### 6.6 契约变更候选

| 项 | 内容 |
|---|---|
| 变更内容 | 为 `levels[]` 增结构化 layout/地形/道具表达（例如 `layoutSpec`：平台、沟、斜坡、道具的序列；或至少 `layoutHints` 的封闭枚举数组） |
| 必要性 | 只有结构化后，规划/编译才可能对「layout 要什么」做确定性检查 |
| 不改契约的替代 | 保留 prose + 提示词；或在 `GameDesignSpec` 增加**可选** hints，且仅在存在时检查（当前语料 0 命中，不会形成覆盖） |
| 影响面 | 设计契约、设计提示词、plan/compile 提示词、设计 fixture；若要求必填，77/77 关需迁移，历史设计全部受影响 |
| 不做后果 | layout 的语义只对模型可见；无法审计「这一关的布局是否被实现」；B-04 继续作为提示词纪律 |
| 审批点/前置 | 设计层 schema 变更，且与 `recipe-config-gap-v1` 的 out-of-scope 裁定冲突；需单列审批并重新确认「prose layout 自由度保留」是否仍成立 |

### 6.7 前置裁定（逐字）

> **P0 04 裁定，Q10(a)(b)(c)**：「地形仅提示词线索并允许退化；layout 散文无结构化需求；
> 斜坡无独立槽位 | **B** | 前序已裁定，不重开 | Out of scope」

> **`recipe-config-gap-v1` map Out of scope**：「设计层结构化 HUD/地形需求（Q1=c 否决）：
> 让 `GameDesignSpec` 显式表达 HUD/地形，不在本图；prose layout 的自由度保留。」

> **P1 map Out of scope**：「B 类（sprite 语义/`role`、reachability 并入 compile、地形/斜坡限制）……
> 仍冻结或另立 effort。」

---

## 7. B-05：Q10(c) 斜坡无独立槽位

### 7.1 当前状态

**仍成立。** `EntityKind` 仍是
`solid | pickup | hazard | goal | chest | danger | decor`（`game-config.ts:51`），没有 `slope`；
`terrain` 仍是轴对齐 `Rect`（`game-config.ts:240`）；Runtime 的可达性/碰撞也按矩形处理
（`reachability.ts:61`；`packages/demo/src/world.ts:171`）。`slope` 在 `packages/contracts/src`
与 `packages/demo/src` 中零命中（本报告 grep）。

源码事实：

- 设计层 `layout` 可以写「斜坡」，但它只是提示词文本（见 B-04）。
- 规划期唯一的地形资源落点是 `solid → sprite`（`ENTITY_ASSET_KINDS.solid = ["sprite"]`，
  `game-config.ts:63`）；斜坡视觉只能作为 `solid` sprite 画出，碰撞仍是 AABB。
- `terrain` 是看不见的碰撞矩形，也不引用资源；不能表达斜坡形状。
- `vocabulary.test.ts:27-35` 的 `ENTITY_KIND_FATE` 是穷尽表；加一种 `EntityKind` 必须同时给它
  机制交代（`decor: null` 是明写「没有机制」）。新增 `slope` 会触发这条机制映射与 Runtime 能力。
- P1 未改；P1 的 Q1 只锁既有 kind 的 asset kind。

### 7.2 证据

| 级别 | 证据 |
|---|---|
| E1 | `game-config.ts:51`（无 slope）；`:240`（terrain Rect）；`reachability.ts:61`（地形按 Rect 参与碰撞）；`demo/src/world.ts:171`（terrain 转 Box）；`demo/src/shell/scene.ts:196`（decor 无行为，旁证 kind 分支封闭）；`packages/contracts/src` / `packages/demo/src` 中 `slope` / `斜坡` 零命中 |
| E2 | `packages/contracts/tests/vocabulary.test.ts:27-35,37-41`：每种 `EntityKind` 必须映射机制或明写 null；没有 slope。`game-config.test.ts` 的 base 只使用矩形 terrain (`:25,79`)。**没有斜坡测试，因为契约没有斜坡槽位。** |
| E3 | 语料 49 份设计、77 关：**3** 关的 `layout` 提到斜坡/坡地（`.scratch/entity-identity-v1/runs/2026-10-25-e2e/rust-city-remnant/...`、`.scratch/entity-identity-v1/runs/2026-10-25-e2e-r4/.failed-...`、`.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/rust-city-scavenger/...`）；config 中没有任何 slope 实体可落（槽位不存在），也没有 slope 碰撞产物。 |

### 7.3 候选判据与误报边界

- **不可写**：没有斜坡槽位，就没有「合法斜坡引用」的判据；不能要求 config 出现不存在的实体类型。
- 「layout 提到斜坡 ⇒ config 必须有 slope 实体」：判据在现有契约下无落点；若硬写，3 份设计
  会被判死，而 Runtime 根本不能消费 slope。
- 「`terrain` 矩形必须覆盖斜坡区域」：矩形无法表达斜坡；没有几何表示可判。
- **不可写的原因**：缺少斜坡的契约表示与 Runtime 碰撞语义。

### 7.4 语料重判

- 当前没有可落判据，新增 error = 0（不是零误伤，而是判据不存在）。
- 若强制要求「斜坡必须为独立实体」：3 份设计/关卡命中；但无法满足，因为 `EntityKind` 无 slope。
- 若只做视觉斜坡（`solid` sprite），当前产物里没有可识别的 slope 槽位；不能从 config 区分
  「斜坡 sprite」与普通 solid sprite。

### 7.5 修改面

- 若要真支持斜坡：`packages/contracts/src/game-config.ts`（`EntityKind` 或 `terrain` shape 联合）、
  `packages/contracts/src/vocabulary.ts`（机制映射）、`packages/demo/src/world.ts` 与
  `packages/demo/src/shell/scene.ts`（斜坡碰撞/渲染）、`packages/contracts/src/reachability.ts`
  （可达性几何）、`packages/assets/src/ops.ts` 的 config 骨架/提示词、所有 game-config fixture 与测试。
- **改 Runtime**，超出本图「不改 Runtime / CLI / MCP 对外形状」的边界；需要单独立项。
- 不改契约的替代：继续把斜坡视觉画成 `solid` sprite，碰撞用矩形；或在 `terrain` 里用阶梯矩形逼近。

### 7.6 契约变更候选

| 项 | 内容 |
|---|---|
| 变更内容 | 新增 `EntityKind: "slope"`，或把 `terrain[]` 从 `Rect` 扩为 `Rect | Slope`（方向/坡度），并在 Runtime 实现斜坡碰撞 |
| 必要性 | B-05 的判据与可玩性都需要斜坡的契约表示；只加视觉资源无法解决碰撞语义 |
| 不改契约的替代 | 保持现状：斜坡视觉作为 `solid` sprite，碰撞仍是 AABB；或 `terrain` 用阶梯矩形近似。两种都不新增契约，但都无法表达「斜坡」 |
| 影响面 | contracts（EntityKind/terrain/mechanism/vocabulary）、Runtime（碰撞与渲染）、config 编译提示词、所有 config fixture、可达性判据；序列化形状变化 |
| 不做后果 | PRD AC-02 的「合法斜坡资源」在现有 Runtime 契约里没有对等位置；斜坡只能视觉近似 |
| 审批点/前置 | **改 Runtime**，超出本图 Out of scope；必须先单列 Runtime/契约审批；本图不实施 |

### 7.7 前置裁定（逐字）

> **P0 04 裁定，Q10(a)(b)(c)**：「地形仅提示词线索并允许退化；layout 散文无结构化需求；
> 斜坡无独立槽位 | **B** | 前序已裁定，不重开 | Out of scope」

> **P0 final-report §10**：「layout 散文 → 结构化地形/道具需求、地形仅提示词线索并允许退化、
> 斜坡无独立槽位：B 类。」

> **`recipe-config-gap-v1` map Out of scope**：「设计层结构化 HUD/地形需求（Q1=c 否决）……
> prose layout 的自由度保留。」

---

## 8. B-06：`interactables` 同桶误归属

### 8.1 当前状态

**仍成立，且仍是既有冻结限制。** `interactables[].type` 仍是开放 `z.string()`；
`DESIGN_BUCKET_KINDS.interactables` 仍同时允许 `chest` / `pickup` / `goal` / `hazard` / `danger` /
`solid`；`auditEntityIdentity` 只拦可严格证明的**跨桶**错误，同桶 `goal ↔ chest` 不拦。

源码事实：

- `packages/contracts/src/game-design.ts:171`：
  `interactables: z.array(z.strictObject({ id: Id, type: z.string(), behavior: z.string() }))`。
- `packages/contracts/src/game-config.ts:599-608`：`interactables: ["chest", "pickup", "goal",
  "hazard", "danger", "solid"]`。注释 `:601-603` 明写「同桶误归属不在本矩阵射程内」。
- `auditEntityIdentity` 第 ④ 步只查 `sourceIntent` 所在桶 → 运行时 kind 是否在允许集合
  （`game-config.ts:696-710`）；同桶任何允许值都通过。
- P1 之后，`auditConfigPipeline` 在 `config-audit.ts:41` 调 `auditEntityIdentity`，
  所以身份矩阵在 `compileRuntime` 与 `runBuild` 汇合点都会跑；**执行面扩大，规则未变**。
- `DESIGN_BUCKET_ASSET_KINDS.interactables` 由矩阵派生为 `["sprite","animation"]`
  （`game-config.ts:615-627`）；这只约束 asset kind，不区分 chest/goal。

P1 是否改变：**否**（仅扩大执行面）。`ConfigIssue.code` 没有 identity 码；`type` 仍开放。

### 8.2 证据

| 级别 | 证据 |
|---|---|
| E1 | `game-design.ts:171`；`game-config.ts:599-608,696-710`；`config-audit.ts:41`（P1 汇合点也跑身份） |
| E2 | `packages/contracts/tests/game-config.test.ts:517-529`：`interactable → 六种 kind 都通过`；`:525` 的用例名逐字为「兼容：已知限制 —— interactable → goal（gate→chest）不拦，同桶无法严格区分」，断言 `auditEntityIdentity(...)` 返回 `[]`。 |
| E3 | 已知样本：`.scratch/entity-identity-v1/runs/2026-10-25-e2e-r2/wasteland-scavenger-recipe/run/v1/` 中设计 `interactables[0]` 为 `{id:"chest", type:"chest"}`，config 同时有 `chest-1`（kind chest ← sourceIntent chest）与 `gate`（kind goal ← sourceIntent chest）。本报告对同一 run 只读重判：`auditEntityIdentity(design, config, "level-1")` 返回 `[]`（exit 0），而 `gate` 的 `kind` 是 `goal`、`sourceIntent` 是 `chest`；测试 `:525` 用同一形状。另：49 份设计 / 76 条 interactables / **28** 个 distinct `type`（`chest`、`宝箱`、`可开启容器`、自由散文等）。 |

### 8.3 候选判据与误报边界

**不可写的原因**

- `type` 是开放自由文本，28 个 distinct 值、包含整句散文；「宝箱 / 出口 / 机关」没有封闭枚举。
  `entity-identity-v1.1` 票 01 已量过旧语料（30 份设计 / 57 条 / 28 distinct）并结论
  「`type` 开放无界 ⇒ 精确子类型映射不可行」。
- 若把 `interactables` 的 `goal`/`solid` 摘掉，`entity-identity-v1.1` Phase 1 全仓实测会出现
  **16 个误拒**（真实夹具 `last-train` 的 `i-signal` 合法映射到 `goal`）。这条裁定明确禁止
  「靠桶矩阵制造误拒来假装解决同桶误归属」。
- 若写「同一 `sourceIntent` 只能对应一个运行时 kind」，会误伤合法的 1:N（测试
  `game-config.test.ts:531` 允许两个 enemy 同源 1:N；交互物 1:N 也可能合法）。

**可写的替代（但不是同桶判据）**

- 封闭 `interactables[].type` 枚举 + 子类型 → kind 映射（先改 schema，再可判）。
- 或在设计层拆出独立 `goals` 桶（与 Q10(d) D 类相关），从根上避免同桶；这是更大的契约变更。

### 8.4 语料重判

- 当前无判据，新增 error = 0。
- 若强行按「同桶 `type` → kind 必须精确匹配」的启发式：已知样本 1 个 config 命中
  （`gate` goal ← `chest`）；但 28 个 distinct type 无法形成封闭映射，更多配置会被任意规则误伤，
  不能当作零误伤。
- 若把 `interactables` 的 `goal`/`solid` 摘掉：`entity-identity-v1.1` Phase 1 已实测 16 处误拒
  （真实 `i-signal` → goal），故明确不在可接受方向。
- 若封闭 `type` 枚举：49 份设计 / 76 条全部需要迁移；当前自由文本值大量无法自动归类。

### 8.5 修改面

- 若封闭子类型：`game-design.ts`（`type` 改枚举或增 `subtype`）、`game-config.ts`
  （`DESIGN_BUCKET_KINDS` / `auditEntityIdentity`）、`game-design/src/prompts.ts`、
  `assets/src/prompt.ts` / `ops.ts`（规划期映射）、`entity-identity-v1.1` 的矩阵测试、全部 design fixture。
- 若拆独立 goal 桶：设计 schema、意图层 `ENTITY_BUCKETS`、`intent-coverage.ts`、覆盖闸、
  身份矩阵、所有设计/fixture；范围更大。
- 不改 Runtime（若只改设计层与 config kind）。

### 8.6 契约变更候选

| 项 | 内容 |
|---|---|
| 变更内容 | 把 `interactables[].type` 从 `z.string()` 改为封闭枚举（或新增必填 `subtype`），并建立子类型 → 运行时 kind 的映射；或把 goal 从 `interactables` 拆成独立设计桶 |
| 必要性 | 同桶误归属无法用现有开放文本可靠判定；只有封闭枚举/独立桶才能写出精确判据 |
| 不改契约的替代 | 保留已知限制（当前）；或只加强提示词（`designBrief` 已逐条打印 type/behavior，但仍是提示词纪律）；或只做 QA 层面的启发式观察（不是 error 判据） |
| 影响面 | 设计契约、意图层桶映射、设计提示词、plan/compile、身份矩阵、49 份设计/76 条 interactables、历史 fixture；若必填则历史设计不能直接 parse |
| 不做后果 | `gate(goal)→chest` 这类同桶误归属继续通过；真实 e2e-r2 已复现 1 例；B-06 仍是冻结限制 |
| 审批点/前置 | 必须先与 `entity-identity-v1.1` 的 C 路线裁定对齐；本图不得静默改裁，只能记录为范围变更建议 |

### 8.7 前置裁定（逐字）

> **`entity-identity-v1.1` 票 02 Answer**：「裁定（用户 2026-10-25 收口；**同日修订为 C 路线**）：
> **只收可严格证明的跨桶规则**，不用桶矩阵制造误拒来假装解决同桶误归属。」

> **`entity-identity-v1.1` 票 02 Answer，已知限制**：「`interactables` 内部「信号灯→goal 对 /
> 宝箱→goal 错」桶矩阵无法区分；`gate(goal)→chest` 这类同桶误归属**不在本票射程内**，
> 留待后续机制（提示词加固或独立调查）。」

> **`entity-identity-v1.1` map Decisions**：「同桶 `gate→chest` 记录为已知限制（靠开放 `type`
> 区分、不可靠）。」

> **P0 04 裁定，Q10 补充**：「`interactables` 同桶误归属；`decor` 不加 kind 锁 | **B** | 继续冻结 | Out of scope」

> **P0 开图冻结 Q6**：「`interactables` 同桶误归属（如 `gate → chest`）；`decor` 不增加 kind 锁；
> `entity-identity-v1.1` 已裁定的 C 路线限制。只有当审计提供证据证明它们直接造成当前目标范围内的
> 失败时，才允许提交范围变更建议。」

---

## 9. B-07：`decor` 无 kind 锁

### 9.1 当前状态

**仍成立，且仍是既有冻结限制。** P1 的 `ENTITY_ASSET_KINDS` 对 `decor` 明写 `undefined`；
`auditReferences` 对 `decor` 不传 allowed kinds；`decor` 可引用任何可解析的 asset kind。

源码事实：

- `game-config.ts:56-70`：`decor: undefined`；注释 `:58-60` 明写「v7 真配置就这么用」。
- `auditReferences` 实体循环 `:400-418`：`const allowed = ENTITY_ASSET_KINDS[e.kind]`；
  `decor` 为 `undefined`，`ref(...)` 不锁 kind，只解引用。
- `DESIGN_BUCKET_ASSET_KINDS` 的派生逻辑（`:615-627`）：`npcs` 的唯一 kind 是 `decor`，
  且 `decor` 无锁 ⇒ `npcs` 整桶 `undefined`（Q8 覆盖闸对 NPC 不查 asset kind）。
- Runtime：`packages/demo/src/shell/scene.ts:196` 对 `case "decor": break;`；`decor` 没有交互/机制，
  所以「资源形状是否适合装饰」在 Runtime 没有语义依据。`vocabulary.test.ts:27-35`
  `decor: null // 装饰：不可交互，没有机制。null 是表态`。

P1 是否改变：**否**。P1 Q1 的决策记录逐字写明「`decor` 不加锁」；P1 Q8 由它派生 `npcs` 豁免。

### 9.2 证据

| 级别 | 证据 |
|---|---|
| E1 | `game-config.ts:56-70,400-418,615-627`；`demo/src/shell/scene.ts:196`；`vocabulary.test.ts:27-35` |
| E2 | `packages/contracts/tests/game-config.test.ts:668-673`（P1 新增「`decor` 不加锁 —— ui 与 animation 都照过」）；`:187-191`（recipe-config-gap-v1 的 decor 动画装饰回归）。 |
| E3 | 语料 338 次 `decor` 引用：`sprite` 168、`animation` 117、`ui` 39、`<missing>` 14。39 个 config 副本的 `decor` 引用同一件 `health-icon`（ui）。没有 `decor → background` 的现存样本。 |

### 9.3 候选判据与误报边界

- **锁 `decor → sprite|animation`**：判据精确、可计算；语料新增 **39 个 config 副本**
  （同一件 `health-icon`，ui）全部报错。这些是既有 v7 真配置用法，P0/P1 注释明写其合法性。
  因此不满足「语料零误伤」。
- **锁 `decor → 除 background 外全部`**：语料新增 **0**；判据精确；但当前 Runtime 对 decor 是
  `break`（无任何行为），没有证据表明「decor 用 background 外观」在语义上错误。它只会禁止一种
  没有观察到、也没有 Runtime 规则支持的使用，可能是「长得像判据的空壳」。
- **不加锁**：与 P1 现状一致；B-07 仍作为已知限制，而不是可判据。
- **不可写的原因**：Runtime 没有给 decor 任何语义约束；`decor` 的设计目的就是「纯装饰」，
  任何可渲染 asset kind 在事实上都可由 `buildWorld` 渲染。要写锁，必须先定义「装饰可以是什么」
  的 Runtime 语义；当前没有。

### 9.4 语料重判

- 锁 `sprite|animation`：新增 **39** 条 error（39 个 config 副本；distinct 资产只有 `health-icon` 1 件）。
  逐条解释：这些 config 把 `health-icon`（ui）作为 `decor`（血条图标/装饰），是 v7 真配置的用法；
  不是错误，故该锁不是零误伤。
- 锁「排除 background」：新增 **0**；但没有语义依据，不能据此证明判据正当。
- 不锁：新增 **0**（现状）。

### 9.5 修改面

- 若加锁：`packages/contracts/src/game-config.ts:62-70` 的表项 + `auditReferences` 已有循环；
  新增/修改 `game-config.test.ts` 的 decor 回归；无需 schema 形状变更、无需 Runtime、无新依赖。
- 若把 `decor` 的允许集改成「排除 background」：同样只改表项；但需要先补 Runtime/设计语义依据。
- 若新增 asset 语义类别（与 B-01 共用）：影响面见 B-01。

### 9.6 契约变更候选

| 项 | 内容 |
|---|---|
| 变更内容 | 无必须的 schema 变更。若加锁，只改 `ENTITY_ASSET_KINDS.decor`（表项）；若要让「装饰用 ui」有明确语义，可在 AssetSpec/manifest 增语义类别（与 B-01 同一变更） |
| 必要性 | 当前 Runtime 对 decor 无行为，加锁没有可证明的 Runtime 依据；只有 B-01 的语义类别落地后，才可能把「ui 装饰」与「场景装饰」分开 |
| 不改契约的替代 | 继续 `decor: undefined`（现状）；或只排除 `background`（语料 0 误伤，但语义依据弱） |
| 影响面 | 只改表项：contracts 审计 + 测试；若引入语义类别：manifest/pack/prompt 全链（同 B-01） |
| 不做后果 | `decor` 可引用任意可解析 asset kind；当前 Runtime 不区分，实际没有观察到失败 |
| 审批点/前置 | 若只改表项，属审计规则变更，不是 schema；若引用 B-01 的语义类别，单列契约审批；本图不实施 |

### 9.7 前置裁定（逐字）

> **P1 map Decisions**：「**Q1 · 实体槽位 kind 锁**：`ENTITY_ASSET_KINDS`……`decor` **不加锁**。」

> **P0 04 裁定，Q10 补充**：「`interactables` 同桶误归属；`decor` 不加 kind 锁 | **B** | 继续冻结 | Out of scope」

> **P0 final-report §10**：「`decor` 不加 kind 锁：v7 真配置同时使用 animation/sprite/ui，冻结。」

> **P0 开图冻结 Q6**：「`decor` 不增加 kind 锁……只有当审计提供证据证明它们直接造成当前目标范围内的
> 失败时，才允许提交范围变更建议。」

---

## 10. 汇总：候选判据可写性

| 原子项 | 候选判据 | 精确可计算 | 语料零误伤 | 缺什么 |
|---|---|---|---|---|
| B-01 | `solid` 的资产语义类必须是 `terrain` | 仅当新增 `semanticClass` 后成立 | 当前 0（role 非空）/ 语义字段不可判 | 机读语义类别 + 槽位映射 |
| B-02 | `auditReachability(...).length === 0` | 是 | 134 对 0 error | 不需要新语义；需要定失败分档 |
| B-03 | layout 地形词 ⇒ recipe 地形 sprite | 否（关键词表） | 42 对 1 命中，非零误伤证明 | 设计层结构化地形需求 |
| B-04 | layout 结构化 schema | 否（现无 schema） | 77/77 不过 | 结构化 layout 表示 |
| B-05 | 斜坡必须为独立实体 | 否（无槽位） | 3 份设计命中但无法满足 | slope 契约 + Runtime 碰撞 |
| B-06 | 同桶 `type` → kind 精确映射 | 否（28 个开放值） | 1 个已知样本；封闭化会 16 处已知误拒 | 封闭子类型或独立 goal 桶 |
| B-07 | `decor` 锁 `sprite|animation` | 是 | 39 个 config 副本误伤 | Runtime 没有 decor 语义；若排除 background 则 0 但无依据 |

---

## 11. 语料扫描的已知限制

- 配对是启发式的：17 份 config 找不到邻近 manifest，未参与 `auditReachability` / kind 统计；
  这不会让「新增 error = 0」变成「一定 0」，只表示**已配对部分**为 0。
- 38 个 design+recipe 的「地形 sprite」判定使用 role/description/id 关键词启发式，不是契约判据；
  本报告只用它说明「提示词线索在语料里大体有效，但没有确定性保证」。
- 历史产物是冻结证据；本报告没有修改、重跑或覆盖任何 run / pack / site。
- 所有 `role` 语义判断（地形/道具/角色）都是**人工阅读**，不是机器判据；这正是 B-01 不可写的证据本身。

---

## 12. 本报告没有作出的裁定

- 没有判定 B-01…B-07 哪些修复、哪些推迟、哪些剔除；这些归 03 统一裁定。
- 没有批准任何契约变更；§3.6/§4.6/§5.6/§6.6/§7.6/§8.6/§9.6 只是候选与影响面。
- 没有把 PRD 槽位表当作事实来源；所有规则以当前源码与 Runtime 消费逻辑为准。
- 没有重开 `entity-identity-v1.1` 的 C 路线，也没有改写 P0/P1 的既有裁定。

---

## 附录 A：关键源码位置索引（基线 `3b1b61d`）

| 事实 | 位置 |
|---|---|
| `AssetKind` 四值 | `packages/contracts/src/assetpack.ts:105` |
| `AssetSpec.role` 自由文本 | `packages/contracts/src/asset-spec.ts:17` |
| manifest `role` 自由文本 | `packages/contracts/src/assetpack.ts:167` |
| `ConfigIssue` / 三码闭集 | `packages/contracts/src/game-config.ts:300-317` |
| `ENTITY_ASSET_KINDS`（含 `decor: undefined`） | `packages/contracts/src/game-config.ts:56-70` |
| `auditReferences` 实体循环 | `packages/contracts/src/game-config.ts:335-418` |
| `auditPanelSize` | `packages/contracts/src/game-config.ts:449-495` |
| `auditGameConfig`（含可通关警告） | `packages/contracts/src/game-config.ts:498-585` |
| `DESIGN_BUCKET_KINDS` / 同桶注释 | `packages/contracts/src/game-config.ts:599-608` |
| `DESIGN_BUCKET_ASSET_KINDS` 派生 | `packages/contracts/src/game-config.ts:615-627` |
| `auditEntityIdentity` | `packages/contracts/src/game-config.ts:648-710` |
| `auditConfigPipeline` | `packages/contracts/src/config-audit.ts:34-49` |
| `auditReachability` | `packages/contracts/src/reachability.ts:44-225` |
| `interactables[].type` 开放文本 | `packages/contracts/src/game-design.ts:171` |
| `levels[].layout` 散文 | `packages/contracts/src/game-design.ts:176-188,182` |
| `GameConfig.terrain: Rect[]` | `packages/contracts/src/game-config.ts:240` |
| `EntityKind`（无 slope） | `packages/contracts/src/game-config.ts:51` |
| 横版 `resourceBrief`（不打印 role） | `packages/assets/src/ops.ts:953-964` |
| 塔防 `tdResourceBrief`（打印 role） | `packages/assets/src/ops.ts:1373-1378` |
| 地形提示词线索 | `packages/assets/src/prompt.ts:985-989` |
| `designBrief` 插入 layout | `packages/assets/src/prompt.ts:854-871` |
| 覆盖闸 kind（P1 Q8） | `packages/assets/src/ops.ts:267-274` |
| `hudUiGate` 无条件（P1 Q6a） | `packages/assets/src/ops.ts:300-329` |
| `compileRuntime` 使用 pipeline | `packages/assets/src/ops.ts:1205,1229` |
| `runBuild` 汇合点 | `packages/pipeline/src/create-game.ts:620-636` |
| QA 默认/阻断 | `packages/pipeline/src/create-game.ts:218-219,232-250,640,708` |
| publish gate 只钉 pack | `packages/pipeline/src/publish-gate.ts:10-12` |
| Runtime decor 无行为 | `packages/demo/src/shell/scene.ts:196` |

## 附录 B：语料扫描汇总输出（E3，exit 0）

```json
{
  "files": 5243,
  "configs": 151,
  "manifests": 171,
  "designs": 49,
  "recipes": 83,
  "paired_config_manifest": 134,
  "unpaired": 17,
  "parseFail": 0,
  "p1_stateFrames": 75,
  "p1_otherIssues": 78,
  "B02_reachErrors": 0,
  "B01_assets": 1599,
  "B01_roleEmpty": 0,
  "B01_solidRefsRoles": 13,
  "B01_dualUseAssets": ["wasteland-platform-tile", "tile-platform", "station-platform"],
  "B04_layoutCount": 77,
  "B03_terrainLayouts": 63,
  "B05_slopeLayouts": 3,
  "B03_designRecipePairs": 42,
  "B03_layoutTerrainPairs": 38,
  "B03_noTerrainAssetPairs": 1,
  "B06_interactables": 76,
  "B06_distinctTypes": 28,
  "B07_decorKinds": { "animation": 117, "sprite": 168, "ui": 39, "missing": 14 },
  "B07_cfgWithDecorUi": 39,
  "B07_decorUiAssets": ["health-icon"]
}
```
