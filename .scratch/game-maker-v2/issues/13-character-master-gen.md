# 13. 母版 → 动画：`character-gen.ts` 与 `character-reference` 策略

> ⚠️ **2026-10-02（[票 04](04-contract-character-dna.md) 已关）：标题与 §2 已按裁决重写。**
> 原标题是「母版 → **DNA** → 动画」，而票 04 Q4 把顺序定死成 **DNA → 母版 → 动画**
> （`Master → DNA` **禁止** —— 那是权威倒挂）。⇒ **DNA 的产出**已拆出去，
> 成为[票 31 `character-dna-gen`](31-character-dna-gen.md)（住 `packages/game-design/`）。
> **本票只负责：拿到 DNA 之后，怎么把它变成母版、再把母版变成动画。**
> `docs/v2/03-claude-code.md §16` 的箭头已按 R17 反转。

Type: grilling
Status: resolved
Owner: claude (2026-10-07)
Blocked by: 04, 07, 11, 31
Map: ../map.md
> `docs/v2/03-claude-code.md` §16。「而不是 idle / run / jump 分别重新设计角色。」

## Question

⚠️ **先说清楚：那条性质今天已经成立。** §16 要防的事（分别重新设计角色）今天**不会发生** ——
多帧是**一次调用画一行、按墨迹间隙切**（`pack.ts:340-342,377` + `sheet.ts`，
`sheet.ts:1-9` 记着「等分会给出 144 vs 4 的头宽差」）。

所以这一票问的是**别的事**：**母版 + DNA 买到了什么今天买不到的东西？**

### 1. 今天有什么、缺什么（别重新量）

- **有**：`ImageSource.reference`（`recipe.ts:60-65`）是一条**文件路径**的母版；
  `fixtures/recipes/shift-change-image-anim.json:46` 在用；
  Gemini 把 `[styleReference, reference]` 按序内联（`image-gen.ts:299-312`，
  prompt 里注明「附件第 N 张」）；OpenAI 有输入图时走 `/images/edits`。
- **缺**：契约（`masterAsset` / `derivedFrom` / `CharacterDNA` 在 `packages/` 里**零命中**）、
  跨资产一致性、依赖边。

### 2. 母版**本身**怎么造出来

⚠️ **§16 的链已按[票 04](04-contract-character-dna.md) 反转成 `DNA → 母版 → 动画`**
（`Master → DNA` **禁止**：母版是基因的一张渲染图，基因才是权威）。
⇒ **第一环（DNA）不归本票**，在[票 31](31-character-dna-gen.md)。本票从 DNA 出发。

要答的是**第二环**：

- **(a)** 一次 `image` 调用（提示词由 `CharacterDNA` + `VisualWorldSpec` 渲染）产出一张母版位图；
- **(b)** 用 drawlist 画（可 diff、可静态校验，符合「创作态」那一侧的偏好）；
- **(c)** 母版可有可无 —— 直接从 DNA + 世界语法生成每个动画。

⚠️ **形状已经定了**（票 04）：母版是 `AssetRecipe.authoring[]` 里的一项
（`{id, role, description, source, characterId, size}`），**不进交付包**（结构性保证），
资产用 `AssetSpec.masterAsset` 指向它。本票要填的是**`source` 该用哪一种**。

⚠️ **(a) 有一个链条上的硬约束**：`CONTEXT.md:117-131` 那条「风格一致性可证明」成立于**创作态**
（色板引用使「颜色 ∈ 色板」构造上恒真），再由创作态**决定性**地传导到交付态。
**生图产出的母版不经过那层** —— 它的颜色靠 `Palette Binding` 的 `quantized` 或 `unquantized`
诚实标注（票 36）。要答：母版和它的动画**各自**标成哪一值。

⚠️ **母版的画布 `size`**（票 04 Q2 新加的那一格）：它决定母版自身的头身比
（`headCount(size.h)`），而动画的头身比由**动画 spec 的** `size` 定。
⇒ 判据：**母版的宽高比 ⊆ 引用它的资产的宽度比集合**。本票要给出**画布取多大**的规则。

### 3. `character-reference` 在别的上游上会**静默失效**

`recipe.ts:129-131` 与 `image-gen.ts:56-68` 记着：DashScope 的 `image_edit` 需要**公网 URL**，
接不了本地文件；上游不支持参考图时**管线不报错**。

⚠️ 这是本票最该钉的一条：**「带参考图」这件要求，在某个协议上会静默地不成立。**
要答：是**判据**（那家协议下 `character-reference` 直接拒绝）还是**观察**（照跑、账上记一笔）。

### 4. 判据

帧间一致的**可断言**形式是什么？今天的判据是「一次调用画一行」这个**构造**本身。
DNA 之后要多一条吗？（⚠️ 若拿不出「精确可算 + 错了一定不是设计」的形式，按 R3 它只能是**观察**。）

## Answer

**结论：`DNA → 母版 → 动画` 这条链**这次真的通了（票 04 画的箭头、票 31 产的基因、本票把中间那一环接上）。
`packages/assets/` 三处改动 + 契约两道口子 · **31 条新测试** · 套件 **1007/1007**（此前 976）·
`tsc -b` / `pnpm typecheck` 干净 · 两个守卫绿（146 份文档 · 779 条链接）· **10 发变异全部验过会红** ·
**真探针 n=4 臂 / 10 张真图**（第一轮的产物被我自己的重放模式误删，见 §6——**多花了一轮的钱，是我的错**）。

### 0. 裁决表（第 1 轮 7 问 + 人类的三处修改）

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | 1-Q1 | 母版实现 **`image` + `import` 两条**，`drawlist` **明确不实现**（抛，不静默退回） | `master.ts`（`MASTER_SOURCES`）· `pack.ts` 免费拦停 |
| 2 | 1-Q2 | **`size` 是 canonical target；provider 尺寸是派生值** —— 进提示词、进请求，回图**校比例** | `master.ts`（`masterRatioMismatch`）· `pack.ts` |
| 3 | 1-Q3 | 身份进**母版 + 动画两发**；⚠️ 人类收紧：**必须是 8 个 DNA 语义字段，不是 7 个**（`id` 也在台账里） | `prompt.ts`（`dnaBrief`） |
| 4 | 1-Q4 | `source.reference` 与 `spec.masterAsset` **双写直接拒** | `contracts/src/recipe.ts` |
| 5 | 1-Q5 | 母版**并发前段**（不进 DAG）· **只阻断引用失败 master 的 assets** · 整包仍失败 | `pack.ts` |
| 6 | 1-Q6 | 拒的**只**是「真有一张参考图会被静默丢掉」；⚠️ 人类收窄：**`styleRef` 永不触发** | `master.ts`（`referenceImagesOf`）· `ops.ts` |
| 7 | 1-Q7 | **不新增帧间一致的 hard gate**（理由见 §5） | 无 |
| 8 | 1-Q8 | `master.ts` **收紧职责**（只放提示词 + 两条判据）· **CLI/DNA 接线留给 15/16** | `master.ts` 文件头 · `ops.ts` 不动 CLI |
| 9 | 探针 | **授权**：n≈4 真生图 + **provider reference** 与 **failure propagation** 两项加测 | `experiments/master-first-shot/` |

### 1. 母版怎么造：`image` + `import`，而 `drawlist` 喊一声（Q1）

- **`import`**：一条路径（**相对配方文件**解析，与资产的 `import.ref` 同一条规则）⇒ **今天那张手作母版
  （`inputs/master-to-animation/player-master.png`）自然落进来**，一个调用都不发。
- **`image`**：`DNA 的八个字段 + 世界风格 → 一张位图`。⭐ 这就是票 04 那条箭头。
- ⚠️ **`drawlist` 不实现**：`drawlist` 生成器的签名是 `(spec: AssetSpec, style)`，而母版**不是** `AssetSpec`
  —— 要么造假 spec、要么改签名（两份签名的漂移，票 40 吃过一次）。⇒ **没实现就抛一句说得清的话**。
- ⚠️ **母版的反向提示词是新写的一份**：`imageNegativePrompt()` 里有 `"human figure", "character", "hands"`
  （那是给「单个物体」定的：一个箱子贴图里不许冒出个人），而**母版画的正是一个角色** ——
  拿它去配母版 = 一半在说「画这个人」、一半在说「不要人」。新那份留了「**不许画成一排三视图**」
  （模型见到「角色参考图」最容易犯的错，见探针产物）。

**Q2 的落法**：`size` 进提示词（「外接矩形长宽比必须精确是 w : h」）与请求（`size: {w, h}` 原样递），
而上游那张尺寸表（`requestSize` / `geminiAspect` / `openaiSize`）**由协议自己换算** —— 本票不参与那条换算，
只**回来之后校比例**（对不上就抛，它是参考图，比例错了整条动画链一起错）。

### 2. 那条链跑起来长什么样（Q5）

```
buildInto:
  闸门 → 【母版前段：authoring[] 并发跑，产出 Map<masterId, RasterImage>】 → DAG 等 dependsOn → 逐资产
                                                                                    ↓
                                        资产那一发：spec.masterAsset → masterImages.get(...) → req.reference
```

⚠️ **母版失败**（探测到两件事，都是 Q5 的原话在代码里的落点）：
1. **不踢那道共享的 `stop` 闸** —— 它是「失败即止」的信号，从它里面抛出去 = 全包即止
   （`semaphore` 的 `catch` 会 `stop.error ??= e`）。⇒ 失败**吞在闸门里面**，别的资产照造。
2. **引用它的资产一个字节都不往外发**（`masterImages` 里没有 ⇒ 在 `buildOne` 开头就抛，
   文案照 `dependsOn` 那条：「参考图不成立时发出去的那一笔是白花的钱」）。
3. 而**整包仍然失败**（末尾把那条母版的病因抛出来）—— 没人引用它时若就这么过去，
   包会「成功」而清单里那张母版**根本没造出来**（错得安静）。

⚠️ **一处结构性发现**：母版那条边**在契约里、但从来没被执行过** —— 等待循环只遍历 `spec.dependsOn`
（票 11 的图把 `masterAsset` 只画进了**环检测**）。本票没有把它塞进那张 DAG：母版**没有出边**
（`AuthoringAsset` 不收回指）⇒ 它是一层固定顺序，塞进去只会让整包在第一个母版上串行。

### 3. 身份从哪来：**八个字段**，替换而不是叠加（Q3）

- **`dnaBrief` 的键集就是 `keyof CharacterDNA`** ⇒ 契约加一格而这里不补，**编译就过不去** ——
  「8 个字段一个都不许漏」在这一层不是纪律，是**类型**。
- ⚠️ `id` 也在台账里（人类这一轮把「七个」改成「八个」），而它那一行明写「**不要把它画进图里**」——
  模型会照着字面把文字画上去，而「图上一个字都不许有」是每一份模板的头一条。
- ⚠️ **`palette:N` 翻译成色值**（模型不认 `palette:3`，它认颜色）—— 世界的色板就在 `StyleSpec.palette`，
  这正是「颜色只有一个来源」的落点。⚠️ 顺带：**票 31 那条派生的「越界检查」在这里有了第一个真读者**
  （越界时它会把原始引用原样带进提示词）—— 仍然没有判据，仍等一张票。
- **替换不是叠加**（Q3 的原话）：有 DNA 就把「这个角色是：`spec.description`（`spec.role`）」整句换掉 ——
  同一条提示词里放着两个身份源，模型只会执行一条（那次「既说 4 个角色又说只有 1 个物体」的教训）。
- **没有 DNA 就回落** ⇒ 磁盘上那 8 份 fixture 与「人给一张参考图」那条老路**一字不改**。
  两条边界写死在 `pack.ts`：**没给文件** ⇒ 回落（不是错）；**给了文件却查不到那个 `characterId`** ⇒ 抛
  （文书自相矛盾 —— 静默回落就是「画了一个别的角色」）。

### 4. 两条参考图的路（Q4）与那条静默失效（Q6）

- **Q4**：`source.reference`（一张**路径**）与 `spec.masterAsset`（一个 **id**）**不许同时写** ——
  生成那一步只收得下**一张** `reference`，谁赢都是静默丢一半。⇒ 契约里免费拒（`recipe.ts` 的 superRefine）。
- **Q6**：触发条件写死成「**真的有一张图会被丢**」：`referenceImage`（→ `styleReference`）·
  `source.reference` · `masterAsset` 三样，而 **`styleRef` 永不触发**（它指向 `stylespec.json`，不是图）。
  判据落在 `ops.ts` 的 `packAssets`（**开跑前**、免费），用手法测过：上游配成死的 ⇒
  拦停没响会撞成 `upstream`(3)、响了是 `usage`(2)，两种结局分得开。
- ⚠️ 代价明写：**今天配的是 gemini**（探针里那条真的把角色保持住了），所以这一拒**不动能跑的东西**；
  而 dashscope 那条今天连世界风格图都吃不到 —— 它本来就不适合这条链。

### 5. 帧间一致：**不加判据**（Q7）

今天靠**构造**（一次调用画一行 + 按墨迹间隙切）。唯一精确可算的是逐帧外接矩形，而**跳跃帧本来就该变**
⇒ 拿它当判据会误伤正例（R3 的第三个条件「错了一定不是设计」不成立）。⇒ 保留构造，
「帧间一致」继续留在**人眼那一格**（R9 的检查点在清单处）。

### 6. 真探针（n=4 臂 / 10 张真图）—— 四件事 + 失败传播

跑法：`node .scratch/game-maker-v2/experiments/master-first-shot/run.mjs`（⚠️ **代理要单独指**：
`MASTER_PROBE_PROXY=…` —— 跑这一次时配置里那个 9098 **没开**，借用的是本机另一条能通 Google 的）。
输入是**三份真跑出来的东西**：世界（票 08 raw/01）· 设计（票 10 raw/01）· DNA（票 31 raw/01 那条 `p-scavenger`）。

| 臂 | 做什么 | 真调用 | 结局 |
|---|---|---|---|
| A | `image` 母版（canonical 64×96）+ 动画**引用它** | 2 | ok |
| B | **同一份动画、同一个提示词**，但没有母版引用（对照） | 1 | ok |
| C | 身份打架：DNA 说「拾荒者」，参考图是**手作的另一张母版**（Odin） | 1 | ok |
| D | 母版那一发**注入失败**（不发出去）+ 一个与母版无关的箱子 | 1 | **failed**（预期） |

- **① 母版回图的尺寸**：**832×1248**（比例 0.667）· canonical 64×96（0.667）⇒ **一致**。
  ⚠️ 注意读法：上游**永远**照它的表给尺寸（2:3 就是 832×1248），canonical 管的是**比例** ——
  这正是 Q2 那两句话的分工，探针把它量成了事实。
- **② 参考图到底进没进这一发**：A 与 B 的**原图逐字节不同** ⇒ 参考图确实进了那一发并改变了产物。
  ⚠️ **像不像要人眼看**：两张都在 `raw/out/*.p-scavenger-idle.raw.png`。
- **③ 打架时谁赢**（我看了 3 张产物，以下**是我的读法、不是判定**）：C 那一张**明显偏向参考图** ——
  DNA 写着「帽檐压得极低、眼睛只剩两个方点」，而产出给了一张**有完整五官的脸**；同时
  `gear` 里那几件（背上的方盒包、腰间的净水细管、腕上的圆盘信号灯）**照 DNA 画了出来**。
  ⇒ 读法是：**参考图对「长相」的支配力强于提示词里那几行散文，而文字仍然在管「有什么东西」**。
  ⚠️ n=1，且这一条只在**人为制造矛盾**时成立（正常那条路上 DNA 与母版同源）。
- **④ 母版的提示词**（`raw/out/A-normal/.../p-scavenger-master.prompt.txt`）：八个字段逐个具名，
  `palette:N` 已翻成色值；产出的那一张（832×1248）是**一个角色、全身、正视、纯色底、无字无框**，
  帽檐压到吃掉眼睛那一行、背上的方盒包与腕上的圆灯都在 —— 与 DNA 那几格对得上（**我的读法**）。
- **⑤ 失败传播（人类这一轮加测的那一项）**：D 的账里**只有箱子那一发**（`step:image` / `target:crate`），
  引用母版的那动一发**一次都没发出去**；箱子照造；整包仍抛（`母版 "p-scavenger-master" 没造出来…`）。
- 每次真调用 **31–57 秒**（gemini 经代理）—— 一条与钱无关、但与「跑一轮要等多久」有关的事实。
- ⚠️ **一处我自己的错**：跑完之后我用 `--from-raw` 补了一次汇总（汇总行当时写错了），
  而那时脚本开头**无条件** `rmSync(raw/out)` ⇒ **第一轮那 5 张产物被我删了** ⇒ 只好重跑一轮（又 5 张）。
  已修：**重放模式一个字节都不许动**。⚠️ 这两轮的钱**记在我这一票的账上**。

### 7. 未决 / 派生（⚠️ 本票**没做**的那些）

- ⚠️ **动画那一发的反向提示词与它自己的正向要求打架**（本票顺手发现的，**没动**）：
  `pack.ts` 对**每一次**生图都递 `imageNegativePrompt()`，而它里面有 `"human figure", "character", "hands"`
  —— 那三条是给「单个物体」定的；而动画那一发的正向要求恰恰是「画 N 个**角色**」。
  ⚠️ **不动的理由**：那是一段**真跑调出来的**提示词（票 51 的纪律：「别去跟一段量出来的话对着写」），
  要改得配自己的探针。⇒ 记为派生，但**本票不认领**（今天它在探针里没露坏账：动画产物正常）。
  母版那一发**已经绕开它**（新写了一份）。
- ⚠️ **CLI / MCP 现在还够不着母版**（Q8 的裁定：接线归 15/16）：库这一层有了 `characterDna` 入参，
  而「从 `run/v<N>/character-dna.json` 读出来递给它」是票 15 的活。⇒ 今天的 CLI 跑 `pack` 得到的是
  **回落路径**（`spec.description`），不是 DNA。
- ⚠️ **手抄镜像又长了一格**：`BuildPackOptions.recipe` 是**结构子集**（不是 `AssetRecipe`），
  本票得往里加 `authoring?`——票 11 记过的那个坑（`AssetSourceLike` 与契约的 `AssetSource` 是两份）
  又出现了一次。⇒ 它是**已知结构债**，不是新洞。
- ⚠️ 母版位图今天落在**包内**的 `authoring/masters/`（与 `generated/` / `imported/` 并列）——
  「创作态材料到底该在包内还是 `run/v<N>/`」仍归票 15 的落点布局。
- **票 04 §6 那条未决（「画法它听」是推的不是量的）**：本票量到的是「**模型会照 DNA 那几格画出来**」
  （产物里帽檐、方盒包、圆灯都在），但**没有**量「动画那一发在 32×48 上还剩多少」——
  那要等下一票/下一轮，本票不认领。

### 8. 改了哪些文件

| 文件 | 改什么 |
|---|---|
| `packages/contracts/src/recipe.ts` | 加一条免费拒：`source.reference` 与 `spec.masterAsset` **双写** |
| `packages/contracts/src/ledger.ts` | `LedgerStep += "master"`（`target` 是**母版 id**） |
| `packages/assets/src/master.ts` | **新**：`MASTER_SOURCES` · `masterPrompt` · `masterNegativePrompt` · `masterRatioMismatch` · `referenceImagesOf` |
| `packages/assets/src/prompt.ts` | `dnaBrief`（八个字段的台账，键集 = `keyof CharacterDNA`）· `ImagePromptTarget.dna` · 动画/单物体两处**替换 + 回落** |
| `packages/assets/src/pack.ts` | 母版前段（并发、失败语义、免费拦停）· `masterAsset → reference` 接线 · DNA 预扫描 · `recipe` 镜像加 `authoring?` |
| `packages/assets/src/ops.ts` | Q6 的免费拦停（`dashscope-mcp` + 有图要递 ⇒ `usage` 拒） |
| `packages/assets/src/index.ts` | 导出 `master.js` |
| 夹具 | **新**：`fixtures/recipes/shift-change-master.json`（从 `shift-change-image-anim.json` 派生：手作母版改写成 `authoring[]` 的一行 + `masterAsset`）—— **旧的那份一字不动** |
| 测试 | `assets/tests/master.test.ts`（**新** 13）· `assets/tests/pack-master.test.ts`（**新** 13）· `assets/tests/ops.test.ts`（+4）· `contracts/tests/recipe-graph.test.ts`（+1） |
| 探针 | `experiments/master-first-shot/run.mjs`（含 `--from-raw` 重放）+ `raw/`（4 份事实 + `raw/out/` 产物 PNG） |

### 9. 判据

`pnpm test` **1007/1007** · `tsc -b --force` 与 `pnpm typecheck` **全绿** ·
`check:deps` / `check:links` 绿 · **10 发变异全部验过会红**（母版失败不吞 · 参考图接线 ·
比例判据 · 八字段台账 · 反向提示词 · 风格图入清单 · 双写拒 · canonical 画布 · 回落 · 开跑前拦 DNA）。
