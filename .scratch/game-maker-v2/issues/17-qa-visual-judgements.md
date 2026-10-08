# 17. Visual QA 的**判据**：只收构造性约束与层覆盖，七个 `similarity` 一个都不要

Type: grilling
Status: resolved
Owner: claude (2026-10-08)
Blocked by: 06, 15
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> 依据 **R3**（Q13）。`03 §21` 要七个相似度；本票要证的是**它们全是观察**。

## Question

`03 §21` 要检查：`style similarity` · `palette similarity` · `silhouette` · `composition` ·
`character consistency` · `material consistency` · `animation consistency`。

R3 定了判据只收三类（**集合差 / 构造性约束 / 引用族**）。R3 还说了理由：
`review.ts:6` 那条纪律**已经在跑** ——「***它只说差异，不说好坏***……不要求打分」。

### 1. 逐项判「判据 / 观察」，并说出理由

对 `§21` 的七项，每一项都要答：**它满足「精确可算 + 错了一定不是设计」吗？**
⚠️ **判据的门槛是后半句**（`CONTEXT.md:364-371`）：「要把一条观察升级成判据，
得先说出『**错了一定不是设计**』的理由。」说不出的，就是观察。

### 2. 判据那一侧的清单（R3 给的，要落成实现）

| 判据 | 今天在哪 | 备注 |
|---|---|---|
| 色板绑定四值自洽（`exact`/`composited`/`quantized`/`unbound`） | `assetpack.ts` / `quantize.ts` | 票 36 定的，**必须在** |
| 尺寸 · 锚点 · 九宫格 三条构造性约束 | 散在 `pack.ts` / 校验处 | ⚠️ 九宫格误写的代价**落在画上**（`CONTEXT.md:259-269`） |
| **层覆盖**（不平铺的层必须 ≥ 视口） | 装配期检查 | `CONTEXT.md:429-435`：视口 480×270 是**外壳常量** |

要答：这三条**是不是已经在跑**？若已经在跑，本票的活是**把它们接进 QAReport**（票 06），
不是重写。⚠️ 重写 = 第二份真相。

### 3. 视觉判据的输入是**交付态**

`CONTEXT.md:174-179`：`exact` 是「**光栅化后扫像素实测**，不是承诺」。
要答：判据跑在**交付态图集**上（那就有像素），还是**创作态 drawlist** 上（票 36 说
`Palette Binding` 对 drawlist **解析期静态可判**）？两者取其一，或各管一半。

## Answer

**结论：Visual QA 的**判据那一半**落地**（`packages/qa/src/visual.ts`）—— `§21` 那七项**一条判据都不加**
（逐项的理由见 §1），而**当前包边界内可达**的两条构造性约束接进了 `QAReport`。
**16 条新测试 · 套件 1070/1070**（此前 1054）· `tsc -b` / `pnpm typecheck` 干净 · 两个守卫绿 ·
**8 发变异全部验过会红**。

⚠️ **本票的射程一句话**（人类裁定的原话）：*只把当前 QA 包边界内可达的构造性约束接入 Visual QA；
不新增 similarity 判据、不重算上游判据、不跨包抓视觉数据、不负责 review observation。*

### 0. 裁决表（7 问 + 一处修正）

| # | 问 | 裁决 | 落地 |
|---|---|---|---|
| 1 | 1-Q1 | 七项 `similarity` **全是观察**；一个 judgement/score 都不加 | 文件头逐项写了理由 |
| 2 | 1-Q2 | **β**：`layer-coverage` 留在装配期，QA **不重写**、`checked` 里没有它 | `visual.ts` 的 `NOT_MINE` 那一格 |
| 3 | 1-Q3 | QA **只吃交付态**；创作态的静态分析是 `pack` 的上游 | 两条判据读的全是产物 |
| 4 | 1-Q4 | **α + 修正**：本票不跑 `review`/`inspect`，而 `observations` **保持空** —— **不许拿 `unavailable` 表示「不归我」** | `buildQAReport(results, [])` |
| 5 | 1-Q5 | `visual.ts` 实现 `QaRunner`；跑**实际可达**的判据；经 `buildQAReport()` 投影 | `visualQaRunner` |
| 6 | 1-Q6 | 本票之后 **`incomplete` 是正确结果**，不打补丁 | `checked` 的差集自己说明缺什么 |
| 7 | 1-Q7 | 真 fixture + **故意损坏**，证明两条判据真的会响 | `qa/tests/visual.test.ts` |

### 1. `§21` 那七项：**全是观察**，而理由分三种

| §21 | 判定 | 理由（R3 那半句「**错了一定不是设计**」说不说得出来） |
|---|---|---|
| `style similarity` | 观察 | 没有可算的形式 —— 它要的就是人眼那一句 |
| `palette similarity` | 观察 | ⚠️ **别和 `palette-binding` 混**：后者是「颜色 ∈ 色板」（判据 ✓），这一条是「色板像不像参考图」 |
| `silhouette` | 观察 | 票 22 已量过：连**数值**的比例指令模型都不执行，遑论「像不像」 |
| `composition` | 观察 | 而它**可算的那一半**（层与视口的关系）已经是另一条判据（`layer-coverage`）了 |
| `character consistency` | 观察 | 唯一可算的是逐帧外接矩形，而**跳跃帧本来就该变** ⇒ 会误伤正例（票 13 的 Q7 裁过同一条） |
| `material consistency` | 观察 | `StyleSpec.material` 是自由文本，没有可算的形式 |
| `animation consistency` | 观察 | 与 `character consistency` 同一件事 |

⚠️ 一并写下：**`similarity` 这个词一次都不许进契约** —— 它是「分数」的影子（R3 砍掉的那个东西）。

### 2. 判据那一侧：两条接进来，四条**说得出为什么不在**

`packages/qa` 的白名单**只有 `contracts`**（票 07 钉死）—— 这一条决定了射程：

| 判据 | 这一次跑了吗 | 为什么 |
|---|---|---|
| `constructive-constraint` | ✅ | `auditAssetSpec` 住 **contracts** ⇒ 够得着。逐资产对账「清单说要做成什么样 vs 包里实际是什么」 |
| `palette-binding` | ✅ | 扫不了像素（解码器住 `assets`）⇒ 做**报表级对账**（名字本来就叫「四值**自洽**」） |
| `layer-coverage` | ❌ | 规则要**同时**知道世界多宽与视口多大 ⇒ 住**装配期**（那儿已经硬失败）。⚠️ **故意不重写** |
| `reference-resolution` | ❌ | config 侧那一半归**票 18** |
| `reachability` | ❌ | 归**票 18**（「怎么跑」也在那一票里定） |
| `intent-coverage` | ❌ | 归**票 19** |

⚠️ **`palette-binding` 的对账对象是「两处说法」**：逐条目的 `paletteBinding` 与包级的
`palette.coverage` 四个数 —— 它们是**同一件事的两种说法**，对不上就有一个在说谎
（判据的理由原话：「报错了，下游读到的是**假的**」）✓。而**不重算**那四个数（那是 `pack` 的活）。
⚠️ 六格里的「没跑」那四格**必须给全**（`QAJudgementResults` 是**全映射** —— 少一格是**编译错误** ✓
  而那条由**类型**守，不是判据 ✓）。

### 3. ⚠️ 写测试时撞出的两处：**契约已经挡在前面**的检查

破坏性测试（票面 Q7 要的「两种故意损坏」）当场照出两件事，都改了代码/测试：

1. **改 manifest 的帧数/色板大小，先炸的是**包契约**（`superRefine`）** ⇒ 那两条路**轮不到 QA**
   ⇒ 于是 `palette.size == values.length` 这条检查**从 QA 里删掉了**：契约已经守住它，
   再写一遍就是**一条永远绿的判据**（拿一份 `size` 对不上的 manifest 去喂，先炸的是 `parseAssetPack` ✓
   —— 这一条现在**有测试钉着**：断言它**抛**，且抛的是契约的话）。
2. **「清单里有、包里没有」这条走 manifest 那一侧也够不到**（图集声称包含不存在的资源 ⇒ 契约先拒）
   ⇒ 测试改成**改清单**（人加了一条、包还是旧的 ✓）—— 而那正是票 16 那条路会有的形状 ✓。

### 4. 交付态 / 创作态（Q3）

**判据一律吃交付态**：`constructive-constraint` 比的是清单 vs **manifest 的产物条目**，
而 `palette-binding` 读的是**包里的数** ✓。创作态只剩**一处**联结：逐资产的 `authoring[]` 里那份 drawlist
（给了，`auditAssetSpec` 就顺带核对**每份的 `viewBox` 与声明尺寸** ✓）——
⚠️ 那是「创作态 ↔ 交付态」**唯一**的联结点，所以有一条测试专门改坏它 ✓。
⚠️ 而创作态那条**静态判定**（`paletteBindingOf`）是 `pack` 用来给值的东西 —— **判据的输入，不是第二个实现** ✓。

### 5. 观察那一栏：**空着**（Q4 的人类修正）

`review`（视觉差异）归票 22、`inspect` 的用色观察归票 20 —— 本 Runner **一个都不跑**。
⚠️ 而**不许拿 `unavailable` 去表示「不归我」**：那个分支的意思是「**我去拿了、没拿到**（并说得出为什么）」，
而「不归我」是**没有这一条** ⇒ **空数组** ✓（有一条测试专门钉它 ✓）。

### 6. 判据（Q7 要的「真 fixture + 故意损坏」）

`packages/qa/tests/visual.test.ts`（**16 条**）用的是**真产物**：`fixtures/packs/last-train/v2` +
`fixtures/recipes/last-train.json`（9 个资产，一一对上 ✓）。损坏那几条**先把包拷出来**再改 ✓：

| 损坏 | 期望 | 结果 |
|---|---|---|
| 改包里一个资产的 `size` | 一条 `error`，`target` = 那个 id | ✅ |
| 改清单的动画帧数（spec 3 帧 / 产物 2 帧） | 一条 `error` | ✅ |
| 清单里加一条、包里没做 | 「**没被做出来**」 | ✅ |
| 改坏创作态那份 drawlist 的 `viewBox` | 一条 `error`（那条线唯一看得见的地方） | ✅ |
| 改包级四值里的一个 | 一条 `error`，`target` = `recipe` | ✅ |
| 反过来改**条目**上那个值 | 也响（两处说同一件事） | ✅ |
| 把 `palette.ref` 指到 `files[]` 之外 | 也响（那份色板在 checksum 覆盖之外） | ✅ |
| **干净的真包** | 零 `failures` · `checked` 恰好两条 · 裁决 `incomplete` | ✅ |

**8 发变异全部验过会红**（四值对账 · `palette.ref` · 不调 `auditAssetSpec` · 谎报 `layer-coverage` 跑过 ·
「没被做出来」那支 · 不传 drawlist · 塞一条 `unavailable` · 把某一档 `severity` 降成 `warning`）。
⚠️ 最后那一发**第一遍是绿的** ⇒ 补了一条「响了就是 `fail`（不是 `incomplete`）」的测试
—— **`severity` 就是让裁决阻断的那个东西**，而它此前只在一条用例里被断过。

### 7. 未决 / 派生

- ⚠️ **`QaContext` 里没有上游凭据、没有视口**（票 15 定的那个形状）⇒ 本票的两条判据都用不上它们，
  但**视觉观察那一族要用凭据** ⇒ 票 22 落地的要么自己收凭据、要么那个形状要动。**押给票 22。**
- ⚠️ **`layer-coverage` 的「不在 QA 里」是有意的**（§2）—— 若将来要让它进 QA，唯一干净的路是
  `QaContext` 加视口 + 那条规则上移到 contracts（那会动票 14 记过的分工）。**今天不做。**
- 本票**没有派生新票**。

### 8. 改了哪些文件

| 文件 | 改什么 |
|---|---|
| `packages/qa/src/visual.ts` | **新**：`visualQaRunner`（`QaRunner` 的实现）+ `constructiveConstraint` + `paletteBinding` + `drawlistsOf` |
| `packages/qa/src/index.ts` | 从空骨架变成导出 `visual.js`（并写明三个读者：17 / 18-19 / 20） |
| `packages/qa/tests/visual.test.ts` | **新**：16 条（干净真包 · 七种故意损坏 · 边界三条） |
