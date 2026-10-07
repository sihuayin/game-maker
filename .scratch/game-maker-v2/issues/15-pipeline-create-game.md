# 15. `packages/pipeline` + `createGame`：一条链串起来，产物落 `run/v<N>/`

Type: grilling
Status: resolved
Owner: claude (2026-10-07)
Blocked by: 06, 07, 08, 09, 10, 11, 12, 13, 14
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> `docs/v2/03-claude-code.md` §25 + 依据 **R8**（Q9a）。
>
> ⚠️ **2026-10-01（[票 02](02-contract-visual-world.md)，R2-Q5）—— 包内要不要带一份 `VisualWorldSpec`，
> 归本票，别在 `pack.ts` 里补。** 票 02 只钉了 `run/v<N>/visual-world.json`（doc `02 §Phase19` 已写）；
> 而包（`pack/v<N>/`）今天只带 `authoring/stylespec.json`（`pack.ts:566`），doc 从头到尾**没说**包内要不要放 VWS。
> ⇒ 这是「链怎么落盘」的问题，不是「契约长什么样」的问题。⚠️ 包是**自描述、可复跑**的那份 ——
> 只带 stylespec 的包，重建时**拿不回类型化视图**（`VWS.camera.mode` 这类封闭枚举），
> 而 `pack.ts:580` 的 `provenance.style` 槽位也只指向 stylespec。这个权衡要在本票里表态。

## Question

`pipeline` 是**唯一**把新包串起来的地方（R11 的依赖图），也就是 §25 的 `createGame`。

### 1. 落盘形状（R8 定的，要落成具体路径）

R8：`run/v<N>/` + `pack/v<N>/` + `site/v<N>/`，**禁止覆盖**。要答的是 **`run/` 里装哪些文件、
各自叫什么**：

```text
out/<gameId>/
├── run/v<N>/
│   ├── visual-world.json        ← 票 02
│   ├── game-intent.json         ← 票 03
│   ├── game-design.json         ← 票 03
│   ├── character-dna.json       ← 票 04（可能多个角色 ⇒ 一个目录？）
│   ├── runtime-profile.json     ← ⚠️ **票 05 判：不落盘**（见下方注）
│   └── qa-report.json           ← 票 06
├── <清单落在哪？>                ← ⚠️ 今天 recipes/v<N>.json 是与 pack/ 平级的
├── pack/v<N>/                   ← 票 12 的产出
└── site/v<N>/                   ← 票 14 的产出
```

⚠️ **两个要判的**：
- **清单**今天是 `out/<id>/recipes/v<N>.json`（**与 `pack/` 平级**，且 `derive` 单独跑时也写这儿）。
  进 `run/v<N>/` 会**移动一个既有路径** —— 移还是不移？
- **`gameId` 谁给**：今天 id 由**模型**给出（`README_zh.md`：「id 由模型给出，命令会把确切路径打出来」）。
  一次 `create` 里，id 在**哪一步**才知道？（视觉那一步没有 id。）

> ⚠️ **2026-10-02（[票 05](05-contract-runtime-profile.md) 已关）：上面那张树里的 `runtime-profile.json` 划掉。**
> Q5 判**不落盘**：`RuntimeProfile` 是**外壳的事实**，不是这一次运行的产物 ——
> 写进 `run/` 会让它长得像运行的产物，而「禁止覆盖的 `v<N>`」对它的语义也不成立。
> `01 §13` 那份**定稿的九项**里没有它（就是本草稿之后定的），**那是故意的**。
> ⚠️ 但 `createGame` 的返回里**仍有** `runtimeProfile`（§4）—— 那是**内存对象**，路径与对象要分开说。

### 2. 检查点（R9）在 `createGame` 里怎么表达

R9：人工点**只有一个**，在**清单处**，`--yes` 跳过。要答：这个「停」是
**API 层的一次返回**（`createGame` 分两段调用）还是 **CLI 层的一次循环**（`pipeline` 里没有「停」这个概念）？
⚠️ MCP 也要有这个能力（`packages/mcp`），而 MCP 是**无交互**的 —— 这决定了答案。

### 3. 失败时保住什么（承 `image-route-v1` 的三张票）

那三张票（`.scratch/image-route-v1/`）钉死的三条**在本图仍然有效**，新链不许违反：
① 失败时**改名留下工作目录**，不删；② 账**发出即记**；③ 失败时**等「在飞的」收尾**；
（另：失败的生图调用**要报重试**）。要答：`create` 跑到一半失败时，`run/v<N>/` 是**留下还是回滚**。

### 4. `createGame` 的返回（§25）

§25 的返回里有 `visualWorld, gameIntent, gameDesign, assetRecipe, assetPack,
runtimeProfile, gameConfig, qa`。要答：
- ⚠️ **它返回的是内存对象还是路径？** `CLI 只解析参数、渲染结果`（`README_zh.md`），
  而 §28 要一堆 JSON 文件 —— 两者不冲突，但**谁负责写**要说清（pipeline 写，CLI 只报路径）。
- 进度与取消：今天 `pack` 有 `--concurrency`、MCP 有 `notifications/progress`。

> ⚠️ **2026-10-02（[票 03](03-contract-intent-and-design.md) 已关）：`run/v<N>/` 的**目录清单**定了** ——
> 它就是那个被砍掉的 `GameCreationState`（本票 Q3 判**不建**那个契约，目录即容器）。
> 九项见 `docs/v2/01-contracts.md §13`：`intent.md` · `visual-world.json` · `game-intent.json` ·
> `game-design.json` · `character-dna.json` · `asset-recipe.json` · `game-config.json` ·
> `qa-report.json` · `ledger.json`。
> ⚠️ 除 `asset-recipe.json`（R9 检查点 + R10 策略都落在那里）外**一律机器产出、不许手改** ——
> 否则「禁止覆盖」的 `v<N>` 会被手工编辑悄悄毁掉。
> ⚠️ `intent.md` 存**原样字节**（裸文本则写一个 `.md`），**不做规范化** —— 否则复现的不是同一次输入。
> ⚠️ 票 02 甩过来的「**包内要不要带一份 `VisualWorldSpec`**」**仍挂在本票** —— 票 03 没有回答它。

> ⚠️ **2026-10-02（[票 04](04-contract-character-dna.md) 已关）：两条统一校验落在本票。**
> ① **引用族**：`AssetSpec.characterId` 必须命中 `run/v<N>/character-dna.json` 里某条的 `id`。
>    （配方内那条 `masterAsset → authoring[]` 已在契约的 `superRefine` 里，本票**不用**管它。）
> ② **构造性**：母版的宽高比必须与**每一个**引用它的资产的 `size` 宽高比一致（票 04 Q2/Q4）
>    —— 否则同一个角色会有两套头身比（票 22 撞过的那类坑）。
> ⚠️ 两条都**只在 pipeline 做一次** —— planner 明确不重复验（票 04 Q3）。
> 另：`run/v<N>/` 清单里的 **`character-dna.json`** 早已在票 03 的九项里；
> 它的产出方是[票 31](31-character-dna-gen.md)（不是票 13 —— 那条链的箭头被反转过）。

## Answer

**结论：票 15 的**设计面**收敛** —— 一条 `create` 链的**生命周期边界**（而不是把函数串起来）、九项落盘、
检查点、失败语义、两条接线的通道。**三轮共 18 问**，全部裁决完毕。
⚠️ **施工待做**：本文只记**裁决与验收面**；那五个 invariant 要在实现时用测试锁死（见 §6）。

### 0. 裁决表（三轮 18 问）

| # | 问 | 裁决 | 一句话 |
|---|---|---|---|
| 1 | 1-Q1 | **β** | `run/v<N>/` 先落临时目录、结束时改名；失败 ⇒ `run/failed-<ts>/` 留着，**不占版本号** |
| 2 | 1-Q2 | **α** | 清单与 config **移进** `run/v<N>/`（`recipes/` 与 `game-configs/` 两个目录名退役） |
| 3 | 1-Q3 | **α** | 九项里那五份「有人返回、没人落盘」的产物**由 pipeline 写**（序列化只此一处） |
| 4 | 1-Q4 | **α** | `ledger.json` **两份**：包里那份是**包的收据**（跟包走、被 verify），`run/` 那份是**整条链**的 |
| 5 | 1-Q5 | **α** | 检查点 = **两段 API**（理解段写到清单为止 · 构建段从磁盘读清单）；MCP 无交互 ⇒ 直接串 |
| 6 | 1-Q6 | **α** | 返回 **对象 + 路径都给**；进度是**步级**的 `onProgress`；取消不做 |
| 7 | 1-Q7 | **γ + α** | QA 是**明确扩展点**（注入 + 缺席时说得出口）；今天 `qa-report.json` 不会出现 |
| 8 | 1-Q8 | **α** | `characterRef` 由 pipeline 注入、由 `packAssets` 读 ⇒ **单一通道** |
| 9 | 1-Q9 | **α** | 包内**带**一份 VWS（`authoring/visual-world.json`），**不动 `provenance`** |
| 10 | 2-Q10 | **α** | 「一次运行」= **显式 `RunHandle`** + 三次状态转移（open / commit / abandon） |
| 11 | 2-Q11(a) | **(i)** | 人改过清单里的 `id` 与目录名不一致 ⇒ **直接拒** |
| 12 | 2-Q11(b) | **是** | 构建段**必须**重新从磁盘 `parseRecipe` |
| 13 | 2-Q12 | **α** | `QaRunner` / `QaContext` 住 **`contracts`**（`qa` 只许依赖 contracts ⇒ 反向会断） |
| 14 | 2-Q13 | **α** | `characterRef` 是 **DNA 的唯一通道** |
| 15 | 2-Q14 | **α** | run 的账是**链级并集**（文本那几发 ∪ 包里那份的生图/母版） |
| 16 | 2-Q15 | **α** | 带 VWS、**不升 `provenance`**（升版会判死两份**入库**的 v2 fixture 包） |
| 17 | 2-Q16 | **β** | 一次 create run **共用同一个 N**（首次构建时） |
| 18 | 3-Q17 | **α** | 同一 Run **允许多次 construction attempt**（正式规则见 §1） |
| 19 | 3-Q18 | **α** | **有 `characterId` 而 `characterRef` 缺席 ⇒ 生成开始前拒** |

### 1. 生命周期：`RunHandle`（Q10 / Q16 / Q17）

**正式规则（人类原话，实现时照抄）**：

> 同一 Run 可以有多次 construction attempt；首次 attempt 默认与 Run version 对齐。
> 之后每次新的 construction attempt 使用由父 Run 显式分配的新子树版本。
> 所有子步骤只接受调用方传入的 version，禁止自行计算。失败 attempt 不消耗已提交版本。

落到形状上：

```ts
type RunHandle = { version: number; tmpDir: string; gameId?: string };   // gameId 在 commit 时才填
openRun(outRoot)        // 扫 <out>/*/run/v* 分配 N + 开 <out>/.building-<pid>-<N>/
commitRun(handle, gameId)  // rename 到 <out>/<gameId>/run/v<N>/（⚠️ 目标已存在 ⇒ 取下一个 N 重试）
abandonRun(handle)      // rename 到 <out>/<gameId>/run/failed-<ts>/（**只改名、不删**）
```

⚠️ **三条边界**：
- **gameId 迟到**（`gameId` 只在 plan 那一步之后才知道）⇒ 句柄先只有 `version`，commit 时才填 ——
  这正是「先临时目录、后改名」那一步的由来（不是洁癖）。
- **不加锁**（全仓没有一个锁，`nextPackVersion` 今天就有同样的 TOCTOU）—— 而 `renameSync` 到
  **已存在的目标会失败**这一点就是**原子抢**：失败就取下一个 N 重试。不比今天差，也不比今天复杂。
- **失败不消耗已提交版本**：`.building-<pid>-<N>` 只有在 `commitRun` 那一刻才变成 `run/v<N>`；
  中途挂掉 ⇒ 现场改名成 `failed-<ts>`，那个 N **没有**被用掉（与 `pack` 今天的行为一字不差）。
- ⚠️ **多次 attempt 的 N 关系**：首次 `attempt` 的子版本 = Run 的 N（⇒ `run/v3` + `pack/v3` + `site/v3`）；
  之后每次新的 attempt，**父 Run 显式分配**新的子树版本（⇒ 可能 `run/v3` + `pack/v4`）。
  ⚠️ 而「子树版本号一律由调用方给定、**子步骤禁止自行计算**」这条要落到**代码**上：
  `buildAssetPack` 今天内部会调 `nextPackVersion`（`pack.ts:199,259`）—— 要开一个「调用方指定则不重算」的口子；
  **site 那一侧同款**（`assembleFromConfig` 自己的计数器）⇒ 那个口子与它的接线**播给票 16**（它才摸 CLI/MCP）。

### 2. 两段 API（Q5 / Q11 / Q6）

```ts
runUnderstanding({ outRoot, requirement, styleReferences, runtimeProfile?, transport })
  → { run, visualWorld, intent, design, characterDna, recipe, paths }   // 自己 commit（检查点的落点就是定稿的 run）
runBuild({ runDir, imageTransport, concurrency?, qa?, onProgress? })
  → { pack, config, ledger, paths }
createGame({...}) = 上面两个串起来（+ 可选 onRecipe 回调；MCP 走这条 ⇒ 等于自动跳过检查点）
```

⚠️ **构建段只吃 `runDir`**（+ 上游凭据）：清单、风格、参考图、DNA **一概从磁盘读回** ——
R10「策略住清单里、**人可改**」要的就是这个（人在检查点改的正是磁盘上那一份）。
⚠️ **两条判据**：① 清单里的 `id` 与目录名（`gameId`）**不一致 ⇒ 拒**（目录名是这次运行的身份，
而 `pack`/`site` 都按清单的 `id` 建自己的树 ⇒ 不一致会把同一次运行的产物劈到两个 gameId 下）；
② 构建段照跑 `parseRecipe`（`pack` 今天第一行就做）。

### 3. 落盘与账（Q1–Q4 / Q14 / Q15 / Q2）

- **九项**（`01 §13`）落 `run/v<N>/`：`intent.md`（原样字节）· `visual-world.json` · `game-intent.json` ·
  `game-design.json` · `character-dna.json` · `asset-recipe.json` · `game-config.json` ·
  `qa-report.json`（**今天缺席**，见 §5）· `ledger.json`。
  ⚠️ `stylespec.json` 跟着配方一起搬（`styleRef: "stylespec.json"` 是同目录相对路径，搬家后依然成立）。
  ⚠️ 「旧包读不到」**不违反**那条「历史 `ledger.json` 不许解析不过」的纪律 —— 后者说的是**入库的**历史，
  而 `out/` 是 gitignore 的产物目录。
- **两份账**：`pack/v<N>/ledger.json` 是**包的收据**（票 45 的形状，跟包走）；`run/v<N>/ledger.json`
  是**链级并集**（pipeline 那几发文本调用 ∪ 包里那份的生图/母版 —— `buildAssetPack` 已经回吐那份 `Ledger`）。
  ⚠️ 两者**不是同一份账的两种缩略**：`byStep` 的口径不同（一个只含这一包，一个含整条链）。
- **包内带 VWS**：`authoring/visual-world.json` 拷进包，**它自动进 `files[]`**（有 checksum、可发现），
  而 `provenance` **一个字不动** ⇒ **不升版**。⚠️ 依据：升版的先例（v1→v2）是**删键**（读码器真的不兼容），
  而这次是**纯增加一个文件**；而升版会**判死两份入库的 v2 fixture 包**
  （`fixtures/packs/counter-siege/v4` · `fixtures/packs/last-train/v2`）。⚠️ 代价明写：读者靠**约定**而非 manifest 槽位。

### 4. 两条接线的通道（Q13 / Q18 + 票 04 那两条的边界）

- **DNA 的唯一通道是清单那一格**：`createGame` 写清单时填 `characterRef: "character-dna.json"`
  （同一个目录 ⇒ 相对路径是常数），**从不**把 DNA 对象递给 pack；`packAssets` 读 `characterRef`
  （相对配方文件）→ `CharacterDNAFileSchema.parse` → 传 `buildAssetPack({characterDna})`。
  ⇒ **单跑的 `pack`** 与新链走**同一条电路**。⚠️ 缺席（全是道具的配方）⇒ 整条回落（票 13 的 Q3）。
- **补上引用族缺的那一格**：清单里**有 `characterId` 而 `characterRef` 缺席** ⇒ `packAssets` 在
  **生成开始前**拒（免费、开跑前）。依据是票 04 的原话「`AssetSpec.characterId` **必须命中**
  `character-dna.json` 里某条的 id」——而票 13 那条**回落**说的是「**调用方没给 DNA 文件**」这种兼容情形，
  一份**自己声明了 `characterId`** 的清单不属于那一类。
- ⚠️ **不重复实现票 04 那两条校验**：① 引用族（给了文件而 id 查不到）在 `pack.ts:340` 的 `dnaOrThrow` 里
  已经落了；② 母版宽高比在契约的 `superRefine` 里已经落了（票 11/12 的播下都写着「已在契约里，
  别再写第三份」）。本票只补**上面那一格**，然后**验证三条引用链真的会响**（见 §6 的 invariant 4）。

### 5. QA 是一个**明确的扩展点**（Q7 / Q12）

```ts
// ⚠️ 住 `contracts`（与 `QAReport` 同处）：`packages/qa` 的白名单只有 contracts ⇒ 类型住 pipeline 会反向依赖
type QaContext = { runDir: string; packDir: string; configPath: string; gameId: string };
type QaRunner  = (ctx: QaContext) => Promise<QAReport>;
```
- `createGame` 收 `qa?: QaRunner`：**给了就跑、没给就在返回里明说缺席**。
- **pipeline 写 `qa-report.json`**（Q3 的裁定），QA 只**返回** `QAReport`。
- 步序：**在 config 之后、站点装配之前**（站点那一层 pipeline 够不着 —— `pipeline` 的白名单里没有 `demo`）。
- ⚠️ ⇒ 今天 `run/v<N>/qa-report.json` **不会出现**：`01 §13` 的九项是**目标形状**，
  缺的那一项由票 17-20 补（它们落地时接的就是这个扩展点）。

### 6. ⚠️ 五个 invariant —— 实现时**必须被测试锁死**（人类点名的验收面）

| # | invariant | 锁死它的东西 |
|---|---|---|
| 1 | **Run 身份** | `run/v<N>/` 的目录名 = 清单的 `id`；**两者不一致 ⇒ 拒**（Q11a）；`commitRun` 的原子抢（撞名 ⇒ 换 N） |
| 2 | **构建 attempt 的版本** | 首次 attempt 与 Run 同 N；之后每次由父**显式分配**；⚠️ **子步骤自行计算 ⇒ 能不能被测试发现？**（要给 `buildAssetPack` / `assembleFromConfig` 各一条「调用方指定则不重算」的判据） |
| 3 | **recipe 磁盘真相** | 构建段**只**读磁盘那份：测试要能证明「内存里那份旧的在人改过之后**没有**被用」 |
| 4 | **character 引用完整性** | 三条链各一条测试：`characterRef` 缺席 + 有 `characterId`（新拒） · 给了文件而 id 不在里面（`pack` 已有的） · `masterAsset`/母版宽高比（契约已有的）—— **都要证明真的会响** |
| 5 | **失败现场保留** | 理解段挂 ⇒ `run/failed-<ts>/` 里是**已经跑完的那几步**的产物；构建段挂 ⇒ 包那侧的 `failed-<ts>`（已有）；两者都**不占版本号** |

### 7. 施工清单（设计面已收敛，施工待做）

| 落点 | 做什么 |
|---|---|
| `packages/pipeline/src/` | **新**：`run.ts`（`RunHandle` + 三个转移 + 版本分配）· `create-game.ts`（两段 API + 串联）· 九项的序列化 |
| `packages/contracts/src/qa.ts` | `QaRunner` / `QaContext` 两个类型（QA 的缝） |
| `packages/assets/src/ops.ts` | `packAssets`：读 `recipe.characterRef`（相对配方文件）→ parse → 传 `characterDna`；**有 `characterId` 而 `characterRef` 缺席 ⇒ 拒**；接受**显式 `version`** |
| `packages/assets/src/pack.ts` | `buildAssetPack` 接受**显式 `version`**（给了 ⇒ **不许**自算） |
| `packages/assets/src/pack.ts` | 包里拷一份 `authoring/visual-world.json`（Q15 α） |
| 播给**票 16** | `assembleFromConfig` 的**显式版本口子** + CLI/MCP 的接线（两段怎么问人、`--yes`、进度渲染、`site` 用哪个 N） |
| 测试 | 五个 invariant + 九项落盘 + 两段之间的「人改过清单」+ 失败现场 + 三条引用链 |

⚠️ **施工不消耗本票的裁决**：上面每一条都在本文里有出处（轮次 + 问号），实现时照抄即可。

---

### 10. 施工记录（2026-10-07）—— 本文的裁决**全部落地**，另有七处**实现时的判断**要留档

**判据**：**36 条新测试 · 套件 1036/1036**（此前 1007）· `tsc -b --force` 与 `pnpm typecheck` 全绿 ·
两个守卫绿（146 份文档 · 783 条链接）· **14 发变异全部验过会红**（含五个 invariant 各一发）。

**改了哪些文件**

| 文件 | 改什么 |
|---|---|
| `packages/pipeline/src/run.ts` | **新**：`RunHandle` + `openRun` / `commitRun` / `abandonRun` + 版本分配 + 原子抢 |
| `packages/pipeline/src/artifacts.ts` | **新**：九项的写与读 —— **随步落盘**（见 §10.4）、参考图拷贝与路径改写、`characterRef` 注入、planner 产出的摊平 |
| `packages/pipeline/src/create-game.ts` | **新**：`runUnderstanding` / `runBuild` / `createGame` + 进度 + 检查点 + 账的并集 |
| `packages/contracts/src/run-ledger.ts` | **新**：`run-ledger/v1`（链级那份账 —— **自己的形状**，见 §10.3） |
| `packages/contracts/src/qa.ts` | `QaContext` / `QaRunner` 两个类型（QA 的缝） |
| `packages/contracts/src/ledger.ts` | 把 `CallCount` 导出（run 那份账逐字复用它的口径） |
| `packages/assets/src/ops.ts` | `packAssets`：读 `recipe.characterRef` → 传 `characterDna`；**有 `characterId` 而 `characterRef` 缺席 ⇒ 拒**；接受**显式 `version`** 与 `visualWorldPath` |
| `packages/assets/src/pack.ts` | `buildAssetPack` 接受**显式 `version`**（给了 ⇒ **不自算**）与 `visualWorld`（拷进包） |
| `packages/vision/src/analyze-reference.ts` | 输入多一个 `cwd`（见 §10.6） |
| 测试 | `pipeline/tests/run.test.ts`（**新** 10）· `pipeline/tests/create-game.test.ts`（**新** 19）· `pipeline/tests/upstream.ts`（假上游 + 五份骨架） |

**七处实现时的判断**（裁决没覆盖到、我按现有纪律选了一边 —— **要改我改**）：

1. ⚠️ **版本分配从 `openRun` 挪到了 `commitRun`。** Q10 的建议原文写的是「`openRun` 扫 `<out>/*/run/v*` 分配 N」——
   施工时发现那句**自相矛盾**：那时 `gameId` 还没定，而「这棵树里的第几次运行」**必须按 gameId 数**。
   ⇒ 落法：`openRun` 只开临时目录，`commitRun(run, gameId)` 才在**那棵树里**分配 N。
   ⚠️ 规则一个字没动（仍是**父分配、子不重算**），只是把「父」摆到了它真正知道 gameId 的那一刻。
2. **失败现场的位置**由「定出 id 了没有」决定：定了 ⇒ `<out>/<gameId>/run/failed-<ts>/`；
   没定（`gameId` 在 plan 之后才知道，而**前四发调用都在它之前**）⇒ `<out>/.failed-<ts>/`。
   ⚠️ **带点前缀是故意的**：不然它会长得像一个 gameId 的目录。现场里是**已跑完那几步**的产物。
3. **run 的那份账是新契约 `run-ledger/v1`，不是复用 `Ledger`。** Q4 裁的是「两份、语义不同」——
   而 `Ledger` 那个形状**带着 `packId` / `packVersion`**（它是包的收据）⇒ 硬套会写出两个**说谎的字段**。
   ⚠️ 新那份用 **v3 的 zod**（不是 v4）：它**永远不是工具路**，而且它必须复用 `LedgerCall`（v3）——
   硬套 v4 就得再镜像一份，那正是「两份定义会漂」。
4. ⚠️ **理解段随步落盘**（每步一出来就写 staging，不是最后一把写）。这不是优化，是 **invariant 5 的前提**：
   最后一把写的话，前四步里任何一步挂掉，现场都是**空的** —— 那条 invariant 就成了一句空话。
5. **第二次 attempt 的 `game-config.json` 会覆盖 run 里那一份**（它记的是**最新一次**构建的配置）。
   理由：配置是**派生量**（从包 + 设计重编译就有），而历次 attempt 各自的包**永不覆盖**（`pack/v3`、`pack/v4` 都在）。
   ⚠️ 这是九项里**唯一**一处「同一份文件被写第二次」—— 如果将来要留历次配置，那就得给配置再找一个落点（今天没有读者）。
6. ⚠️ **旧路径留着**：`plan` 单跑仍写 `<out>/<id>/recipes/v<N>.json`、`compile-runtime` 仍写 `game-configs/`。
   Q2 的原话是「**`run/v<N>` 成为 create run 的唯一正式产物位置**」—— 那句说的是 **create run**，
   而单跑的 `plan` 不是一个 run（它没有身份、没有检查点）。⇒ 本票**没有**退役那两个目录名。
   ⚠️ 而 create 链里的清单/config 走的是 **staging + 移动**（那两个 op 是**文件进出**的，本票没改它们的落点）。
   ⚠️ 想让两个入口的产物**同形**的话，那是另一件事 —— 记为派生，等有人要。
7. **`analyzeReference` 多了个 `cwd`**（三行）：`styleReferences[].path` 是**调用方给的相对路径**，
   而「相对谁」在 CLI（进程 cwd）与 `createGame`（它自己的 `cwd`）之间**不是一个答案**。
   ⇒ 照仓库现成的规矩（R5：环境由壳读、core 只收结构体）——与 `resolveImageTransport({env, cwd})` 同款。

**两条顺带的落地**：
- **VWS 的参考图**：`run/v<N>/visual-world.json` 里的 `styleReferences[].path` 被改写成**同目录的 basename**
  （图也拷进来）⇒ 定稿的 run **自包含**（契约本来就写着「相对它自己」，那些图必须跟过来）。
- `packAssets({visualWorldPath})` 是**可选**的：create 链**总是**传（Q15 α）；单跑 `pack` 不传就没有
  —— 那一格要 CLI 接线（票 16）。

**播给票 16**（它才摸 CLI/MCP）：
① `assembleFromConfig` 要一个**显式版本**口子（「子步骤不许自行计算」那条规矩同样管 site）；
② `create` 命令 = 两次调用 + 检查点问人 + `--yes` 跳过；
③ `pack` 的 `--visual-world` / `--version` 两个可选 flag；
④ 进度渲染（步级 + 包的资产级）。
