# 29. `stylespec.json` 从来没有被 schema 验过 —— 要不要给它一道闸

Type: grilling
Status: resolved
Owner: claude (2026-10-11)
Blocked by: —
Map: ../map.md
> 由[票 02](02-contract-visual-world.md) 的 **R1-Q8** 毕业。票 02 只加了**回归测试**
> （`packages/contracts/tests/visual-world.test.ts` 里四处 `safeParse`），
> **没有**动 `ops.ts` 的裸 cast —— 因为那是**行为变更**，不该夹带进契约票。
> ⚠️ 本票面积**比票面看上去大**：`parseWith`（`zod-issues.ts:44`）**全仓库零调用者**，
> 也就是说「Zod 错误 → 人可读」这个入口本身也还挂着。

## Question

**`StyleSpec` 有一份 schema，而磁盘上没有任何一份 `stylespec.json` 走过它。**

今天读 `stylespec.json` 的两处**运行时代码**都是裸 cast：

```ts
// packages/assets/src/ops.ts:63   （derive 的输入）
const style = JSON.parse(fs.readFileSync(opts.stylePath, "utf8")) as StyleSpec;

// packages/assets/src/ops.ts:840 （pack 的输入，styleRef 指向的那份）
const style = JSON.parse(fs.readFileSync(styleAbs, "utf8")) as StyleSpec;
```

`as StyleSpec` 是**编译期的谎**：它一个字段都不验。而 `StyleSpecSchema` 是有真内容的 ——
`palette` 必须是规范化的**小写 `#rrggbb`**、**不得重复色**、`confidence ∈ [0,1]`。
一份 `{"id":"x","identity":[],"confidence":2}` 今天能**一路走到生图**。

⚠️ 但这条**不是**「谁忘了写一行」，是**判据没有落点**：票 02 立 §4 判据时才发现，
`fixtures/style-spec.json` **没有任何测试读过它**，两个包内那份只被**逐文件 checksum** 盖住 ——
那证明的是**字节没变**，不是**它是一份合法的 `StyleSpec`**。

要裁决的：

1. **加不加这道闸？** 加了，`derive` / `pack` 会在**今天悄悄通过**的坏文件上开始报错 ——
   这正是 R16「旧路径不动」要小心的地方：**先量一下有多少存量会被拒**（仓库里能找到的
   每一份 `stylespec.json` 都跑一遍 `safeParse`），别让修复本身变成破坏。
2. **闸放在哪一层？** ① `ops.ts` 两处裸 cast 就地改成 `parseWith(StyleSpecSchema, …)`；
   ② 再往外一层，在 CLI 入口收（`--style` 与 `styleRef` 各自解析的时机）；
   ③ 只在**新链**（票 15 的 pipeline）收，旧的两处**认了**。
3. **`parseWith` 那笔账**：它零调用者。是顺手让它上岗，还是承认它是个为将来留的空壳、
   连同 `formatIssues` 的再导出一起清掉？（`drawlist.ts:14-16` 那条再导出注释说它是为了
   「免得既有调用方一行都要改」—— 但既有调用方**一个都没有**。）
4. ⚠️ **与 R6 的边界**：票 02 刚把 `StyleSpecSchema` 钉死为**一个字不改**。
   本票若真要「改它才能加闸」（例如收紧某个字段），那就是**撞 R6** —— 得重新开票，不能由本票覆盖（R17）。

## Answer

**裁定 2026-10-11（人类 · HITL）** —— 四条全裁，每条都带**决策边界**。原话**逐字**抄在下面。

> ### 票 29 · 第一轮裁定
>
> | 问题 | 裁定 | 决策边界 |
> |---|---|---|
> | Q1：加不加 schema 闸？ | 加，选项①：`ops.ts:1100` 就地校验。 | 使用 `StyleSpecSchema.safeParse`，失败时按现有错误处理方式拒绝。不要在 `planAssets` 重复校验已通过 schema 的新链产物。 |
> | Q2：大小写由哪把尺子决定？ | 选 (c)：区分规范形式与接受形式。 | `StyleSpec` 契约定义规范形式，hex 使用小写；入口负责规范化，大写输入先转小写，再按现有规则去重，最后校验。不能因为规范形式要求小写，就拒绝已经存在的真实大写色板输入。 |
> | Q3：`parseWith` 怎么处理？ | 删除 `parseWith`，保留 `formatIssues` 的再导出。 | `parseWith` 没有调用者，且其签名与 V2 的 Zod v4 契约不兼容。不要为没有实际使用场景的辅助函数保留空壳。 |
> | Q4：`stylespec.json` 是产物还是输入？ | 按产物处理。 | V2 链由程序生成该文件，校验失败就拒绝，不将它作为可自动容错的手写输入。`provenance.style.origin` 的错误声明记录为独立问题，本票不修改。 |
>
> ### 两个实施细节需要明确
>
> 1\. Q2 的规范化顺序
>
> 建议明确为：
>
> `输入 → hex 小写化 → 色板去重 → StyleSpecSchema 校验 → 后续生图`
>
> 规范化与去重应复用现有逻辑，避免再出现两套规则。schema 仍负责验证规范形式，而不是兼任输入修复器。
>
> 2\. Q1 的校验范围
>
> 加闸并不意味着 schema 自动覆盖所有潜在问题。按现有证据：
>
> - `confidence` 越界或缺失、`id` 类型错误、`identity` 非数组、`camera` 非对象等问题，应由 schema 闸拦截。
> - `palette` 缺失时，schema 的 `.default([])` 可能使校验通过，但后续代码仍可能因缺少色板而报错。不要把 schema 校验通过误认为业务数据必然可用。 本票是否额外要求拒绝缺失色板，应依据现有契约和消费者要求，不擅自扩大校验范围。
> - 多余字段会被当前非 strict 的 `z.object` 剥除，而非拒绝；本票不应顺手改变整个契约的 strict 策略。
>
> 以上四项裁定均以你提供的清点结果和代码事实为依据。这是设计裁定，不代表已经修改代码或运行测试。

---

### 一、Q1 要的「先量一下」—— 量完了，而它正好**证明了 Q2 那条裁定的必要**

票面 Q1 的顾虑是「别让修复本身变成破坏」。全仓清点（`stylespec.json` 共 **90** 份：
`.scratch/` 8 · `fixtures/` 2 · `out/` 80）：

| 闸的写法 | 通过 | 拒 |
|---|---|---|
| **裸 `safeParse`**（只有校验、没有入口规范化） | 88 | **2** |
| **按裁定加了入口规范化** | **90** | **0** |

⚠️ 而被裸 `safeParse` 拒掉的那 **2 份**，**不是别人的坏数据，是本仓库自己的基准 fixture**：

1. `.scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json`（`id: style-ref` · 9 个**大写**色值）
2. `.scratch/game-creation-v1/experiments/asset-pack-draft/out/dystopian-shop/v1/authoring/stylespec.json` —— 与第 1 份**同内容**（同一个 `id` / `confidence` / 色板），是它在一个生成包里的副本

两份的失败原因**一模一样**：`palette.0 / palette.1: 色值必须是规范化的小写 #rrggbb`。而第 1 份被
**9 个源文件**引用（8 个测试 + `fixtures/style-spec.provenance.json`）。

⇒ **一句 `safeParse` 会让 8 个测试文件当场变红，并把仓库的基准 fixture 钉成「非法」。** 这正是 Q1
要防的那个「修复变成破坏」，也正是 Q2 裁定 (c) 存在的理由 —— **两条裁定是一件事的两半**，
少了规范化那一半，Q1 那一半就是个陷阱。

⚠️ 顺带量到的一条**两把尺子**（本票的病根，不是副产品）：`normalizePalette`
（`pack.ts:207`，大写 → 小写、且**接受**大写）与 `PaletteSchema`（`drawlist.ts:99`，**要求**小写）
**恰好在「大小写」上分歧**，而分歧点落在这两份真文件上。裁定 (c) 给了它们明确分工：
**契约管规范形式 · 入口管接受形式**，两边都不改，分歧消失。

### 二、票面有四处与今天的代码对不上（就地更正，不改原文）

1. **裸 cast 只剩一处**，不是两处。票面点的 `ops.ts:63`（`derive` 的输入）**已经不存在了** ——
   票 12 把 `derive` 并进 `planAssets` 时删掉了它。今天独苗是 `packAssets` 里读 `styleRef` 那一行。
2. **Q2 的选项 ② 描述的是已经不存在的代码。** 它说「`--style` 与 `styleRef` 各自解析的时机」——
   而今天 `--style` 是**参考图**（一张 PNG），不是 stylespec 文件；stylespec 只由 `styleRef` 指。
   ⇒ 选项 ② 作为一个**代码描述**失效（作为「闸放哪一层」的取舍仍然成立，人类选了 ①）。
3. **Q3 关于「再导出」的账只对了一半。** `drawlist.ts` 那条注释说再导出是为了「免得既有调用方一行都要改」——
   对 `formatIssues` 成立（`assetpack.ts` / `recipe.ts` 确实从那儿取），对 `parseWith` **不成立**（零调用方）。
4. **新链不需要选项 ③ 之外的补丁**：`planAssets` 今天**写盘之前**就先 `safeParse` 了
   （`VisualWorldSpecSchema` 那一处），所以「新链产物没人验」这个前提对新链不成立 —— 与新裁定的
   「不要在 `planAssets` 重复校验」是一致的。

### 三、按裁定施工（R5：本图把执行带进来）

| 裁定 | 落点 |
|---|---|
| Q1 · 在 `packAssets` 就地加闸 | `ops.ts` 新增 `readStyle()`（**与 `readVisualWorld` / `readCharacterRef` 同款**的模块级读法），替掉那一句 `JSON.parse(...) as StyleSpec` |
| Q2 · 顺序「小写 → 去重 → 校验」 | `readStyle` 先调 **`pack.ts` 的 `normalizePalette`**（**复用，不是第二套**）再 `StyleSpecSchema.safeParse`；为此把 `normalizePalette` **导出**（原本是模块私有的） |
| Q3 · 删 `parseWith`、留 `formatIssues` | `zod-issues.ts` 本体删（留墓碑注释记死因）；`drawlist.ts:18` 的再导出收窄成 `export { formatIssues, type IssueLike }` |
| Q4 · 当产物、失败即拒 | `readStyle` 的拒绝一律 `CommandError("invalid")`（退出码 **4**），**与两条兄弟读法同款** |

**判据**（`packages/assets/tests/style-gate.test.ts` 12 条 + `packages/contracts/tests/zod-issues.test.ts` 4 条）：
`tsc -b --force` 干净（退出码 0）· 套件 **73 文件 / 1227 条全过**（此前 71 / 1211）·
`check:deps` ✅（9 个包）· `check:links` ✅（180 份文档 · 1000 条链接）。

⚠️ **这 16 条判据在本票之前一条都不存在、也一条都不会红** —— `pack.test.ts` 直接调 `buildAssetPack`，
**绕开了 `packAssets` 里那道「读盘 → 校验」的入口**。所以本票补的是**入口**的判据，不是打包器的。

**变异验证（每条裁定都要能证伪）**：

| 变异 | 红 |
|---|---|
| 闸退回裸 cast（**本票要治的那个病**） | **10** 红（余 2 条是正例：裸 cast 照样放行合法文件） |
| 入口不做规范化（大写直接喂 schema） | **1** 红（恰好是大写那一条） |
| 去掉 `normalizePalette` 的 try/catch | **1** 红（恰好是重复色那一条） |
| 把 `parseWith` 补回 `zod-issues.ts` | **1** 红 |
| 把 `parseWith` 连再导出一起补回 `drawlist.ts` | **2** 红 |

### 四、闸的牙齿与盲区（都钉了判据，别把「过 schema」当「数据可用」）

**牙齿**（今天一律**零次上游调用**就被拒 —— R12 的「生图之前、免费地拒」）：`confidence` 越界 ·
`confidence` 缺席 · `id` 非字符串 · `identity` 非数组 · `camera` 非对象 · 色板混进非字符串 ·
色板重复色 · 文件根本不是 JSON。每条都断言 `fetchImpl` **一次都没被调**。

**盲区**（人类在 Q1 边界里点名的那条，**本票故意不动**）：色板**整个缺席**时 `palette` 走
`.default([])` ⇒ **schema 放行**。今天它的实际后果**比「可能报错」更具体**，所以特地钉了一条
characterization 测试把它记死：闸放行 → **上游已经被调过（钱花了）** → 下游 `RasterError` 才炸，
而**报错指向 drawlist**（`颜色引用 "palette:0" 越界（色板只有 0 项）`）—— **指错了方向**。
⇒ 这是一处**已知缺口**，不是一处正确行为。改它要么动 `StyleSpecSchema`（**撞 R6**）、要么在入口另加一条，
两条路都超出本票 ⇒ 已开[票 44](44-empty-palette-passes-gate.md)。

### 五、一处**裁定之外**的顺带修正（诚实交代）

裁定说「按**现有**错误处理方式拒绝」。而施工中发现：`normalizePalette` 撞见**重复色**时抛的是
**裸 `Error`**（`exitCodeOfError` ⇒ 退出码 **1**），而 schema 拒绝走 `CommandError("invalid")`（退出码 **4**）。
⇒ 同一份坏 `stylespec.json` 会**按「重不重复」拿到两个退出码** —— 这正是本仓库反复吃的「两把尺子」。
**已收进同一个出口**（`try/catch` → `CommandError("invalid")`），并单列一条判据 + 一条变异（上表第 3 行）钉住。
⚠️ 这是**本票唯一一处超出四条裁定字面**的改动，理由写在裁定自己的边界里（「按现有方式拒绝」= 统一出口）。

### 六、本票不碰的

- **`provenance.style.origin` 的错误声明**（`pack.ts:999` 硬编码 `"human-in-session"`，而契约枚举
  `["human-in-session","fixture"]` 里没有「模型生成」这一档，V2 的风格却正是模型生成的）——
  人类裁定**记录为独立问题、本票不修改** ⇒ 已开[票 45](45-style-provenance-origin.md)。
- **契约的 strict 策略**（多余字段被剥除而非拒绝）—— 人类明写「不应顺手改变」。
- **`读不出来或不是 JSON` 那段读盘逻辑在 `ops.ts` 里有 5 份**（另 `qa` 有 3 份）——
  **既有**的重复，不是本票造成的；`readStyle` 照抄了既有写法而没有顺手合并（动了就是**重构**，
  该另开票走 R17）。**记在这里**，不在此处修。

### 七、给下一张票的三条读数

1. **闸的有效射程**：今天它能拦住 8 类坏文件、且全在花钱之前；它**拦不住**的只有「色板缺席」这一类。
2. **`88/90` 那个数**：任何「收紧 `StyleSpecSchema`」的提案都得先过这一关 —— 仓库里有 **2 份大写色板的真文件**，
   其中 1 份被 **9 个源文件**引用。**这条约束不是审美，是实测。**
3. **入口尚未被覆盖的路**：本票只给 `packAssets` 加了闸。`planAssets` 那条**新链**今天**本来就校**，
   所以不需要第二道（人类的边界也是这么说的）。

