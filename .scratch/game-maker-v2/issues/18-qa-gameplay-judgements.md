# 18. Gameplay QA 的**判据**：引用族 + 冒烟，不做「玩法好不好」

Type: grilling
Status: resolved
Owner: claude (2026-10-08)
Blocked by: 06, 15
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> 依据 **R3**（Q13）。`03 §22` 要检查 boot/spawn/input/movement/collision/interaction/pickup/goal/win/lose。

## Question

⚠️ **先说清楚这一票不做什么**：`game-creation-v1` 的 Out of scope 里明确推掉了整簇
**Runtime Bridge / 语义测试动作 / Playwright 玩法验证**（`map.md:1029-1033`，票 02/10/11）。
R3 那一轮**没有把它请回来** —— 判据只收「构造性约束 + 引用族 + 集合差」。

所以 §22 那十项里，**哪些不靠运行游戏就能判**？

### 1. 引用族（今天已经在跑的那一族）

`CONTEXT.md:274-284` · `:232-248`：`hud.panel` 必须是 `ui` 类 · **砖**的三条（尺寸精确等于
`arena.cell` · 锚点正中 · 是 sprite/animation）· 资源引用解得到 · 九宫格只在面板上读。
这些**全是构建期可判的**，而且**错了不会自己报错**（所以它们才够得上判据）。

要答：这一族今天散在哪（`compile-*` / `site` / `verify`）？**归拢到一个地方**还是保持散着？

### 2. 冒烟：`boot → spawn → goal` 可达

R3 的候选里写的是「冒烟：boot/spawn/goal 可达」。要答的是**它到底怎么跑**：

- **(a) 不跑游戏**：「可达」判成**图上的可达性**（玩家起点 → 终点，给定地形与实体几何）——
  ⚠️ 塔防那张图已经有一个先例：**参考玩家**（`CONTEXT.md:373-384`）——
  「一个把『这一关是通的』变成可断言的事的玩家……它不是模拟器的旁路，它就是模拟器的一个调用者」。
- **(b) 跑游戏**（Playwright / headless）—— ⚠️ 那就是把推掉的那一簇请回来，**本图不做**。

要答：横版这边**有没有**塔防那样的纯层（`packages/demo/src/world.ts` 是「一条纯函数：
`(manifest, game-config) → 场景描述`」，`CONTEXT.md:422`）—— 若有，可达性可以**在纯层上算**，
不碰浏览器。

### 3. 失败码

与票 06 §2 同一处：`GameplayQAResult` 在 `01-contracts.md` §9-12 里**只有 `QAFailureCode`**
（`GAMEPLAY_READABILITY_ERROR` / `GAMEPLAY_RUNTIME_ERROR`）。要答：这两个码够不够表达上面那两族？
⚠️ 不够就**加码**，而不是把两族硬塞进两个名字里。

## Answer

**结论：Gameplay QA 的判据那一半落地**（`packages/qa/src/gameplay.ts`）—— **引用族**接上
`auditReferences()`、**可达性**接上 `contracts` 里新写的 `auditReachability()`，
而 ⚠️ **「跑游戏」一次都没跑**：可达性是一条**纯层的静态可达性**，模型**一律往「玩家更强」偏**。
**29 条新测试 · 套件 1097/1097**（此前 1070）· `tsc -b` / `pnpm typecheck` 干净 · 两个守卫绿 ·
**8 发变异全部验过会红**。

⚠️ **本票顺带改了一处接口**（票 17 也一起改了）：三个族的出口统一成 **`QaFamilyResult`** ——
一个族**只声明自己那几条**（`Partial`）、**缺席 = 不归我**，「该跑却跑不了」是**抛**。
⚠️ 而**实测到**：一份族结果**落盘过不了 `qa-report/v1`**（押给票 20，已写进那张票的票面）。

### 0. 裁决表（3 轮 9 问）

| # | 问 | 裁决 | 落地 |
|---|---|---|---|
| 1 | 1-Q1 | ⚠️ **不接受全部 error** ⇒ **(b)**：`reference-resolution` **只吃引用族** | 抽出 `auditReferences()`，`auditGameConfig()` 调它 |
| 2 | 1-Q2 | **(c)**：contracts 加 `auditReachability()` | 新文件 `reachability.ts`（不跑游戏） |
| 3 | 1-Q3 | **(a)**：六项外壳能力**不立判据** | `gameplay.ts` 文件头一那段自白 |
| 4 | 1-Q4 | **(a)**：一条判据**至多一条** finding，`target` 恒 `game-config` | `merged()` |
| 5 | 1-Q5 | **部分**：`gameplayQaRunner` 在，但**不许**填别人的格子 | 家族形状（见 §6） |
| 6 | R2-Q1 | **(ii)**：抽具名函数 | `auditReferences()` —— **既有两个调用点一行未改** |
| 7 | R2-Q2 | **(c) + 算法约束**：宽松上界 · hazard 当空气 · motion 整段可站 · 下落不限 · **只有不可达是 error** | 见 §3 |
| 8 | R2-Q3 | **(a)**：旧的两条警告**留在原处**，不并进 QA | `auditGameConfig` 一个字未动 |
| 9 | R2-Q4 | **(a) + α**：`QaFamilyResult`，`visual.ts` 一并改 | `contracts/qa.ts` + `qa/src/*.ts` |
| 10 | R3-Q1 | **(a)**：缺席 = **不归我**；该跑却跑不了 ⇒ **抛** | `QaFamilyRunner` 的文档 + 两条测试 |
| 11 | R3-Q2 | **(a)**：`CONTEXT.md` 加 **QA 族** | `CONTEXT.md` 那条新词（族 ≠ 判据） |

### 1. 引用族：切成一个具名函数，而**链上恒绿**写进自白

`auditReferences(config, manifest)` 从 `auditGameConfig` 里抽出来（**引用族那 7 条**），
`auditGameConfig` 仍然调它 ⇒ `compile-runtime` / `site` 两处**一行未改**、报出来的东西**连顺序都一致**
（有一条测试钉着：`auditGameConfig` 的前 N 条 === `auditReferences`）。

⚠️ **而它在链上永远响不了**：步序是 `pack → config → qa`，而 `compileRuntime` 在 error 上**抛**
（`ops.ts:692`，连 config 文件都不落）⇒ 能走到 QA 的那份 config 必然已经全绿。
那段自白写在 `gameplay.ts` 文件头二，**三条理由**是：判据的名字与家是票 06 定的 ·
`incomplete` 若成恒态就失去信号 · QA 是**交付态的自述**（`compile-runtime` 只是其中一个调用者）。
⚠️ 而**它真会响**：`gameplay.test.ts` 拿一份故意损坏的 config 证明了这件事。

⚠️ **自洽族不进这一条**（Q1(b)）：`hud.panel` 扔到世界外、出生点卡在 solid 里 —— 两条测试
**用 `auditGameConfig` 反证**：同一份配置走那条路听得见，走 QA 这条路**一声不响**。

### 2. §22 那十项的去处（Q3）

| 项 | 去处 |
|---|---|
| `input` · `movement` · `collision` · `interaction` · `win` · `lose` | **不是判据** —— 外壳的**行为原语**（`CAPABILITIES`），每一关都一样 |
| `boot` | 不是判据 —— 契约解析 + `buildWorld` 的「**绝不抛**」守着 |
| `spawn` | 自洽族（`auditGameConfig` 硬失败，**不进 QA**） |
| `pickup` · `goal` | **两条判据**：引用解得到（引用族）+ 够得到（可达性） |

### 3. 可达性：**过宽是故意的**，因为「不在里面」才可靠

`auditReachability(config, manifest)`（`contracts/src/reachability.ts`）。它**只报不可达**，
一条好消息都不产。模型逐条只**高估**玩家：`hazard` 当空气 · 带 `motion` 的实心体按**整段行程** ·
**下落不设限** · 落点取弧线的**下降段**（给的时间更多）。
⇒ 可达集是**上界** ⇒ 「不在集合里」是**可靠**的那半句话。

⚠️ **能抓**：宽过一次跳跃的沟 · 高过顶点的墙 · 被围死的终点。
⚠️ **抓不到**：贴边 / 连续蹬墙 / 绕顶的精细路线，以及**终点被埋进实心体里**（一个身位之内算够到）
—— 那些报成「可达」，是**安全**的那一侧。两条都写进了代码注释。

⚠️ **实现里当场撞出两个建模错误**（都是先写出来、再被实测打脸的）：

1. **出生点被「埋进土里」2.4px**。`last-train` 的角色锚点是 `{x:.5, y:.95}` —— 落在 `at` 上的是
   **身高 95% 那一点**，于是「站在地面线上」把盒子埋进去 2.4px。第一版拿锚点当状态，
   于是 `hits(出生点) === true`，**整条判据静默地什么都不报**（挖一条 200px 的沟也不响）。
   ⇒ 状态改成**脚点**（盒子底边中点），出生点按「附近最近的那些落脚点」**落位**。
2. **「世界的底算地板」把每一条沟都变成可通行**。第一版给 `y >= H` 也算了落脚点，
   想着「掉下去不会死」—— 结果是掉进坑、沿坑底走、再爬上来，**200px 的沟照样「通」**。
   ⇒ 地板是 `terrain`，没有隐式的。⚠️ 「下落不设限」说的是**不会摔死**，不是「底下有一层看不见的地板」。

⚠️ 还有一处性能：逐格去问每个实心体是 `(W+1)×(H+1)×实心体数` —— 一个 6000px 宽、撒 300 块砖的
关卡**要 1 秒**。改成**按区间刷格子**（`Σ 实心体面积`）⇒ 8ms。

### 4. findings 的粒度：**一条**，`target` 恒 `game-config`（Q4）

契约的 `superRefine` ② 禁止同一 `(judgement, target)` 重复，而 `target` 复用**账的词汇**
（不是 `ConfigIssue.where` 那种人话）。⇒ 两个 `target` 都只能是 `game-config`
（整份配置是**同一次调用**产出的），**局部性靠 `detail` 里每行的 `where` 前缀**保留。
⚠️ 逐实体拆会**暗示**一个并不存在的「只重跑这一个实体」的粒度 —— 而修复循环重跑的是整份 config 那一发。

### 5. 出口形状：`QaFamilyResult`，以及**实测到的一处契约冲突**（Q5 / R2-Q4 / R3-Q1）

```ts
type QaFamilyResult = { judgements: Partial<QAJudgementResults>; observations: readonly Observation[] };
type QaFamilyRunner = (ctx: QaContext) => Promise<QaFamilyResult>;
```

⚠️ **缺席 = 不归本族**，而「我该跑却跑不了」是**抛**（与 `visual.ts` 读不到清单一模一样）。
⚠️ 于是 `visual.ts` **一并改了**（判据内容一条未动，只改出口），票 17 那两条「归谁」的话
从 `ran:false` 的 reason 挪进了文件头的自白。

⚠️ **实测**：`QAReportSchema.safeParse(buildQAReport(results, []))` ⇒ **`false`**，两条 issue
（「缺 `inspect`」「缺 `review`」）—— 契约的 `superRefine` ④ 要求**每个观察来源恰好一条**，
而一个族**不产**别人的观察（票 17 的裁定：不许拿 `unavailable` 表示「不归我」）。
⇒ **补齐那两条观察是合成器的活**，已写进[票 20](20-qa-report-assembly.md) 的票面（连同
「`QaRunner` 今天没有实现者」与票 17 搬过来的两条断言）。

### 6. 判据（真 fixture + 故意损坏 + 变异）

`contracts/tests/reachability.test.ts`（**17 条**）用**真配置 + 真包**；`qa/tests/gameplay.test.ts`（**12 条**）
把 fixture **拷出来**再改。⚠️ **8 发变异全部验过会红**：

| 变异 | 会红？ |
|---|---|
| 引用族改吃整个 `auditGameConfig`（自洽族漏进来） | ✅ |
| 不合并、逐条发 finding | ✅ |
| 把「世界的底算地板」加回去 | ✅ |
| 弧线不查碰撞 | ✅ |
| `severity` 一律 `warning` | ✅ |
| 「够到」的容忍度收成 0（只认同一个点） | ✅ ⚠️ **第一遍是绿的** ⇒ 补了一条把**宽容度**钉住的测试 |
| 去掉「出生点非法就不报」那条纪律 | ✅ |
| 视觉族把别人的格子也填上 | ✅ |

⚠️ 第六发**第一遍绿**这件事值得记：那条宽容度是**故意宽**的（一个身位之内算够到），
而宽的东西**没有任何测试会替你记住它为什么宽** —— 除非专门钉一条。

### 7. 未决 / 派生

- ⚠️ **`auditReachability` 只有 QA 一个调用者** —— 「要不要让 `site` / `compile-runtime` 也硬失败」
  写进了地图的 **Not yet specified**（它够不着 R12 要的「生图之前」，搬它是一次分工变更，
  与票 17 对 `layer-coverage` 判过的同款）。**今天不做。**
- ⚠️ **票 20 多了一件非做不可的事**（见 §5）—— 已写进那张票的票面。
- ⚠️ **`01-contracts.md §10` 更正**：原来把 `characterId` 列在 `reference-resolution` 名下是**串了侧**
  （它住 `AssetSpec`，而「必须命中一条 DNA」由 `pack` 抛）；同处记下了「只吃引用族」这条收窄。
- `CONTEXT.md` 新增词 **QA 族**（族 ≠ 判据：判据是格子，族是谁填它们）。
- 本票**没有派生新票**。

### 8. 改了哪些文件

| 文件 | 改什么 |
|---|---|
| `packages/contracts/src/reachability.ts` | **新**：`auditReachability()`（纯层静态可达性） |
| `packages/contracts/src/game-config.ts` | 抽出 `auditReferences()`；`auditGameConfig()` 调它、其余一字未动 |
| `packages/contracts/src/qa.ts` | **新**：`QaFamilyResult` / `QaFamilyRunner`；`reference-resolution` 与 `reachability` 那两段注释改写 |
| `packages/contracts/src/index.ts` | 导出 `reachability.js` |
| `packages/qa/src/gameplay.ts` | **新**：`gameplayQaRunner` + `merged()` |
| `packages/qa/src/visual.ts` | 出口改成 `QaFamilyResult`（判据内容一条未动） |
| `packages/qa/src/index.ts` | 导出 `gameplay.js`，写明两个族与票 20 那条约束 |
| `packages/contracts/tests/reachability.test.ts` | **新**：17 条 |
| `packages/qa/tests/gameplay.test.ts` | **新**：12 条 |
| `packages/qa/tests/visual.test.ts` | 跟着出口改；两条断言搬给票 20（16 → 14 条） |
| `CONTEXT.md` · `docs/v2/01-contracts.md` | QA 族 · §10 的更正与收窄 |
| `.scratch/game-maker-v2/issues/20-qa-report-assembly.md` | 加了那段「出口的形状变了」的 ⚠️ |
| `.scratch/game-maker-v2/map.md` | Decisions-so-far + Not yet specified |
