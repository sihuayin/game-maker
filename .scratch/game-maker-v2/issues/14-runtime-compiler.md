# 14. Runtime Compiler：`GameDesignSpec` + `RuntimeProfile` + `AssetPack` → `GameConfig`

Type: grilling
Status: resolved
Owner: claude (2026-10-05)
Blocked by: 05, 10, 07
Map: ../map.md
> `docs/v2/03-claude-code.md` §19。「不要修改 Runtime 核心代码来适应每个游戏。」

## Question

这是**唯一**写 `GameConfig` 的地方（R12 之后它还多一个职责：**用 `RuntimeProfile` 拒绝**）。

### 1. 与 `compile-game` / `compile-td-game` 的关系

今天两个编译器都是 `需求 + 资源包 → 关卡配置`，**没有** `GameDesignSpec` 输入。
R4 之后塔防**不进新链**。要答：

- `compile-game` 是**保留**（人手写关卡那条路仍然开着，`README_zh.md` 明说）**还是被取代**？
- 若保留：它和 Runtime Compiler 就是**两个**写 `game-config/v1` 的地方 —— 谁负责
  「外壳不支持 → 拒绝」这条？**两个入口必须走同一处校验**（学 `derivePackMode`）。

### 2. `RuntimeProfile` 在哪一步拒绝，代价是多少

R12 把拒绝点定在**构建期**，但**第几步**没定。承票 10 §3：越晚拒绝越贵
（晚到这一步，`AssetPack` 已经造完、**生图的钱已经花了**）。

要答：`compile-design`（票 10）时要**先读一次** `RuntimeProfile` 吗？
⚠️ 若读，那票 10 的输入就变了（要加 `RuntimeProfile`）—— 那要**回头改票 10 的 Blocked by**，
或者把「能力预检」立成**独立的一小步**（在清单之前）。**这一票要给出落点。**

### 3. 坐标与几何的既有硬规矩（一条都不许松）

`CONTEXT.md:230` · `:250-257`：`GameConfig` 的坐标一律是**交付态像素、1:1、整数**；
HUD 活在**屏幕空间**（上限是**视口**不是 `world.size`）；纯文字那些**右边界保证不了**。
`CONTEXT.md:274-277` 的**砖**三条（尺寸精确等于 `arena.cell` · 锚点正中 · 是 sprite/animation）。
**票 09 那条明令：禁止 `scale`。**

要答：这些**今天在 `compile-game` 里**的检查，搬到 Runtime Compiler 之后走**同一份**实现
（不是抄一份）。

### 4. 第一阶段只出 `platformer/v1`

R4。要答：`RuntimeProfile` 有**两个成员**（横版 + 塔防）而只有一个是新链的 ——
这个不对称在代码里怎么表达，才不会让下一个加玩法的人以为要改 `GameConfig` 的形状。

> ✅ **2026-10-02（[票 05](05-contract-runtime-profile.md) 已关）：这一问已被答掉，不再是开放问题。**
> ① profile 与 `format` **正交**（Q3(b)）—— `format` 说「这份数据怎么读」，profile 说「这一代外壳会做什么」，
> 两者**不是**同一根轴上的两个名字，所以加一个 profile 成员**不必**动 `GameConfig` 的形状。
> ② 族的容器已经在了：`RUNTIME_PROFILES` 注册表 + `resolveRuntimeProfile({id, version})`
> （`packages/contracts/src/runtime-profile.ts`）。今天**一个成员**，塔防那一代**不进新链**（R4）。
> ③ 你要做的是**解析引用**：`GameDesignSpec.game.runtimeProfile` 解析不动 ⇒ `undefined` ⇒
> 那就是「说不出是哪一代的能力」的拒绝素材。
> ⇒ 本节剩下的只有你自己那道题：**在哪一刻拒绝**（§2），以及两个入口怎么走同一处校验（§1）。

## Answer

**结论：`compile-game` 被 `compile-runtime` 取代**（新链的 config 从**设计层**长出来）·
**`RuntimeProfile` 被读，但只用于分派**（拒绝早在票 10 就发生了）·
⚠️ **业务校验不过 ⇒ 抛、且不落盘**（与旧行为**相反**，那是 R9 的后果）。
15 条裁决 · **22 条新测试** · 套件 **928/928**（此前 906）· `tsc -b --force` 干净 ·
两个守卫绿（146 份文档 · 776 条链接）· **12 发变异全部验过会红**。

### 0. 裁决表

| # | 轮 | 裁决 | 落点 |
|---|---|---|---|
| 1 | 1-Q1 | **`compile-game` → `compile-runtime`**（(a) 取代） | `ops.ts` |
| 2 | 1-Q1 | **保留 `"compile-game"` 的 ledger 兼容值**（历史账还要能解析）—— 与票 12 处理 `derive` 同款 | `ledger.ts` |
| 3 | 1-Q1 | CLI `compile-game` → `compile-runtime` · MCP `compile_game` → `compile_runtime` | `cli.ts` · `server.ts` |
| 4 | 1-Q2 | **(β) `RuntimeProfile` 被读，用于 runtime dispatch**（`CONFIG_SHAPES`：哪一代 ⇒ 哪一种 config 形状） | `ops.ts` |
| 5 | 1-Q2 | ⚠️ **拒绝仍归 `compile-design`，本步不重复** ⇒ `01 §8` 那张表的两格改指票 10 | `01-contracts.md §8` |
| 6 | 1-Q3 | **几何族不提前**（留在 `site`） | 无 |
| 7 | 1-Q3 | ⚠️ **给「禁 `scale`」补一条判据**（此前只有结构保证） | `game-config.test.ts` |
| 8 | 1-Q3 | 顺带在契约注释里写清**那条整数规矩的例外**（速度不是整数） | `game-config.ts` 头 |
| 9 | 1-Q4 | **落 `packages/assets`**（改写 `compileGame`）—— Phase 12 那两个候选出局 | `ops.ts` |
| 10 | 1-Q5 | **R16**（强制工具调用 + 过 Zod + 3 次） | `ops.ts` |
| 11 | 1-Q5 | **新增 v4 镜像 `config-tool.ts`** + 漂移测试（先例票 02 / 票 12） | `contracts` |
| 12 | 1-Q5 | **结构化失败 ⇒ retry**；⚠️ **业务校验失败 ⇒ 确定性失败**（不 retry、**不落盘**） | `ops.ts` |
| 13 | 1-Q5 | `viewport` / `hudLineHeight` **继续由调用方提供**（它们是外壳的常量，不是数据） | `ops.ts` |
| 14 | 1-Q5 | 落盘路径**不变**（`game-configs/v<N>.json`）—— 要不要挪进 `run/` 归票 15 | 无 |
| 15 | 1-Q5 | 探针 n≈4，量**真设计 + 真包 → config → 三族校验** | `experiments/runtime-first-shot/` |

### 1. `compile-game` 的存废（Q1）

它与票 12 的 `derive` 是**同一个形状的问题**，但票面自己点出了 (b) 的代价更低：校验**本来就只有一处**
（`auditGameConfig` + `auditScreenSpace`，两个编译器同款）⇒ 并存不会有「两份校验漂移」。仍然选 (a)：

- 新链的 config 必须**从设计层长出来** —— `levels[].layout`、每关的 `entities[]`、`world.structure`
  都在设计层；而从需求硬猜正是 `compile-td-game` 那条「需求没说的，它们只能拿示例填」的老路
  （`README_zh.md` 自己记着那个安静产出合法错清单的案子）。
- Destination 要「**不需要人工修改中间 JSON**」，而旧那道「audit 不过照样落盘」正是给人改的口子
  （见 §4 那处**行为反转**）。

⚠️ **代价已付**：两份 README 的用法示例与 ASCII 图、`docs/counter-siege.md` 一类引用、MCP 工具表。
⚠️ **塔防的 `compile-td-game` 一个字不动**（R4）—— 所以「不许被新链弄坏」照旧成立，
而它的**清单步骤**那次损失记在票 12 的账上（`derive` 一没，塔防的「由需求推导清单」那条腿也没了，
今天从**人写的清单**起跑）。

### 2. `RuntimeProfile` 只作分派（Q2）

⚠️ 先摆冲突：`01 §8` 那张表把「**署名**」与**两条差集**都派给了 Runtime Compiler，而**票 10 已经做了**——
它必须做，因为 R12 要「在生图之前、且免费」地拒，而**唯一同时看得见设计层与 profile 的那一步就是 `compile-design`**
（票 10 把它加成了第三个输入）。

⇒ **(β)**：本步**读** profile，但只用来**挑 config 形状**（`CONFIG_SHAPES`：`platformer` ⇒ `game-config/v1`）。
好处三条：① §19 的输入表**不用改**（profile 确实被读）；② profile 有一个**具名的读者**（R7 的门要的就是这个）；
③ 它正好答掉地图那段雾里悬着的问题 ——「第二个成员落地那天，谁来执行、在哪一刻执行」：**拒绝在票 10、分派在本步**。
⚠️ 今天那张表只有一行、**恒等于常数是预期的**（契约里自带这句自白，同票 05 给那两个数组写的）。
⚠️ 按 R17 改了 `01-contracts.md §8` 那张表的**两格**（`mechanics[]` / `capabilities[]` 的读者 → `compile-design`），
并给 `id`·`version` 那一格补上本步的分派读者。
⚠️ **不从入参读 profile** —— 那会给同一个事实**第二个来源**；源头是 `design.game.runtimeProfile`（票 05：
「设计层存的是 `{id, version}` **引用**」）。⚠️ 我的第一版就是开了个 `runtimeProfile` 入参，
**被一条判据当场抓住**（见 §6 第 3 条）。

### 3. 既有硬规矩：同一份实现（Q3）

- `auditGameConfig` + `auditScreenSpace` **今天就是那一份**（两个编译器与 `site` 都读它）⇒ 照旧调它，**不抄** ✓。
  而九条铁律**已经写在旧提示词里**（坐标非负整数、`at` 是锚点落点、`world.size.h == 视口高`、`kind` 五值、
  `objective` 不带数量、HUD 屏幕空间、只许用清单里的 id 与动画名）⇒ 照搬 ✓。
- **几何族不提前**：它是一场**有记载的分工**（「`compile` 跑它能跑的、`site` 跑其余的」），
  提前它要把 `demo` 的纯层搬进 `contracts`（比本票大得多的结构改动）；而**它不烧钱** ——
  与 R12 的「越晚越贵」不同：几何不过只是**晚知道**。
- ⚠️ **补了「禁 `scale`」的判据**：票 09 九条硬规矩里**唯一一条此前没有任何判据看着**的 ——
  它靠 `.strict()` 这个**结构**保证，而结构保证会**静默失效**（下一个人把某个子对象改回 `z.object()`
  那天，`scale` 就能进来了，而**没有任何测试会红**）。⚠️ 一条变异专门验它（见 §6）。
- 顺带在契约头部写清**那条整数规矩的例外**：`PlayerMove.speed/jumpVelocity/gravity` 与塔防那边的
  三个速度**故意是浮点** —— 它管的是**位置与尺寸**，不是每秒多少像素。

### 4. ⚠️ 那处**行为反转**：业务校验不过 ⇒ 不落盘（Q5 的人类裁定）

裁定原文：**「这里需要区分『模型输出结构不合法』和『模型输出合法但编译后的 `GameConfig` 通过不了业务 audit』。
后者不应该默认重采样，否则会把确定性的编译/设计错误伪装成模型生成失败。」** ⇒ 落地成：

| 失败档 | 谁 | 行为 |
|---|---|---|
| 线形状不过 / v3 契约不过（实体 id 重复等） | **模型没生成好** | **重采样**，`STRUCTURED_CALL_ATTEMPTS` 次用尽才抛 |
| 业务校验不过（引用族 / 自洽族 / 屏幕空间） | **确定性的编译错误** | **只试一次、不重采样、直接抛**，消息里点出「**这不是模型没生成好**」 |
| `http` / `timeout` | 上游 | 当场停，不重采样 |

⚠️ **并且不落盘** —— 这是**与旧行为相反**的一处。旧 `compileGame` audit 不过也照落，理由是票 09 裁决 2 的
「**人过目**」：「不落盘的话他连看的东西都没有」。而 **R9 把人工点收成了唯一一个、且在清单处** ⇒
config 那里**已经没有读者**了 ⇒ 旧代码自己那句注释终于说了算：**「坏配置比没配置更坏」**。
⚠️ 两族判据都是**同一份实现**，而 `issues` 里的**警告**（台阶高过跳跃高度、周期运动越界）**不阻断** ——
与契约自己的纪律一致：「精确的硬失败、上界的报警告」。

### 5. 探针（`experiments/runtime-first-shot/`，n=4）

⚠️ 它量的**不是**「过不过线形状」（票 12 刚量过），而是**「真设计 + 真包 → 一份过得了三族校验的 config」**——
那条路最靠后、最贵。⇒ 直接调**出货的那个 op**（`compileRuntime`），于是「提示词 → 工具调用 → v3 契约 →
三族校验 → 落盘」整条路都被跑了一遍。输入是**两样真东西**：票 10 探针真跑出来过的设计 + `fixtures/packs/last-train/v2`。

- **过契约 + 过三族校验 3/4**，而且**每一发都只走了一趟**（首发就成）/ 3.1–3.7s。
- ⚠️ **那一发失败正是设计的行为**：`invalid`，两条硬失败 ——
  `entity "lamp-1"/"lamp-2": 资源 "signal-endlight" 有多个可画的动画，引用必须指明 anim（可选：red, green）`
  ⇒ **引用族**抓住、**只试一次、不重采样、不落盘**，消息里点出「这不是模型没生成好」✓✓。
  这正是「设计 + 包」这一步真实的失败长相：**设计层说「这里有盏信号灯」，而包里那张图有两张画**。
- 落盘那份：`world 1440×270`（**视口那条守住了**）· 12 实体 · `objective` 与 `gate` 都对 · **0 条警告**。
- 传输层那两档出现 **0** 次。

### 6. 落地时量到的（四条）

1. ⚠️ **我的第一版把 profile 从入参读、而不是从设计层读** —— 于是「设计说哪一代」**没人听**，
   而那条判据当场抓住（`expected undefined to be 'invalid'` ⇒ 它**没抛**）。⇒ 源头只能是
   `design.game.runtimeProfile`（票 05：设计层存的是引用）。**这是「同一个事实两个来源」的教科书案例。**
2. ⚠️ **变异锚点必须独一无二**：「空凭据」那一行的字面在 `compileTdGame` 里也有一条（同款检查），
   而 `String.replace(str, …)` 只替**第一处** ⇒ 第一版改中的是塔防那一行、本处纹丝不动，
   于是「变异没红」是**变异没打到靶**，不是判据弱。⇒ 锚点带上它前面那句只此一处的注释。
3. ⚠️ **靶子要与判据对齐**（第三次撞上这口老坑）：那一发我改的是**提示词示例那一行**，
   而判据看的是 `designBrief` 里带关卡 id 的那句 ⇒ 源码改了、被测的那句没动。**补宽测试或重瞄靶子，别改软变异。**
4. ⚠️ **又一处 `tsc` 放行、`esbuild` 报错**的语法事故：一处**少了一个收尾双引号**（我把 `"（空）"` 写成了 `"（空）`），
   于是字符串一路吞到下一个引号 —— 而**行号列号两把工具都按字节报**（中文 3 字节 ⇒ 报出来的列号超过行长）。
   ⇒ 排查那种「不可能的列号」时，直接上 `npx esbuild <file> --outfile=/dev/null`，它给的位置**精确到字符**。
   ⚠️ 我先前那条「引号奇偶」扫描**已经报了那一行（dq=5 是奇数）**而我放过了它 —— **扫描说可疑就别放过**。

### 7. `game.camera` / `game.genre` 的读者（票 10 播下的第 ③ 条，本票的答复）

票 10 把这两个值**注入**进设计层并留了自白（「可派生的副本，读者是人与下游模板」），并点名要 14
「**说清你想拿它干嘛**」。本票的答复是：**不读它们**。config 的形状由 `format` 定，不由相机定；
而「相机不被外壳支持」那条拒绝**已经在票 10**（对着 `vws.camera.mode`）。
⇒ 它们今天仍是**可派生的副本**，读者只剩「人」与下游模板。⚠️ **若票 12/17 也不读，按 R7 的门它们该出局** ——
这句话留在这里，免得不声不响地留成 `GameSpec` 那种空壳。

### 8. 播下

- **`15`（pipeline）**：你要的 `gameConfig` 现在有人产了；⚠️ `createGame` 返回里那个 **`runtimeProfile`**
  是内存对象（它**不落盘** ✓）—— 而本步**从设计层**读那一代，所以你只要保证 `game-design.json` 里的引用对得上。
  ⚠️ 落盘路径**今天没动**（`out/<id>/game-configs/v<N>.json`，仍与 `recipes/` 同级）——
  「要不要挪进 `run/v<N>/`」**仍然是你的**（与清单那一处是同一个问题）。
- **`16`（CLI）**：`create` 要串的这一步现在叫 **`compile-runtime`**（签名 `--design` + `--pack` + 可选 `--level`）。
  ⚠️ **退出码映射**：结构失败与业务失败**都是 4**，但文案不同（后者走那条点明「不是模型没生成好」的消息）。
- **`17`/`18`（两个 QA）**：`Gameplay QA` 是**第一个**读这份 config 的判据族（`hud.panel` 必须是 `ui`、
  砖的尺寸 == `arena.cell`、引用解得到）—— ⚠️ 前两条里的**砖那条是塔防的**（`auditTdConfig` 已经做了），
  横版这一侧**没有砖**。
- **`21`（修复循环）**：R13 说第一阶段**只做资源级重生成** ⇒ **这份 config 永远不会被修复循环重生成**。
  而本票那处「业务校验不过 ⇒ 不落盘」让一件事变干净了：**不存在一份「改一改还能用」的坏配置躺在盘上**
  —— 你要修的是**设计层或清单**，不是配置。
- **`23`（E2E fixture）**：`world.size.h == 270` 与「至少一个 pickup + 一个 goal」是这份 config 的两条硬线，
  你那对 `style.png` / `intent.md` 经全链之后要落得下来。
- **`19`/`22`/`26`/`29`/`30`/`31`/`32`**：无涉。

### 9. 连带改动（都记账，不是重开 R 表）

`assets/src/ops.ts`（`compileGame` → **`compileRuntime`**；`CONFIG_SHAPES` 分派表；两类失败分开；
⚠️ 顺带把「查两个字段空不空」那条凭据检查与票 12 对齐）· `assets/src/prompt.ts`
（导出 `designBrief` 给两处共用 + `CONFIG_TOOL_*`）· **新文件 `contracts/src/config-tool.ts`**（v4 镜像）
+ `contracts/tests/config-tool.test.ts`（漂移测试）· `contracts/src/ledger.ts`（`+ "compile-runtime"`）·
`contracts/src/game-config.ts`（头部那两段自白：整数规矩的例外 + `scale` 禁令与其唯一例外）·
`contracts/tests/game-config.test.ts`（**补「禁 `scale`」的判据**）· `cli/src/cli.ts` · `mcp/src/server.ts`
+ `mcp/tests/server.test.ts` · `assets/tests/compile-game.test.ts` → **`compile-runtime.test.ts`**（重写，
⚠️ 原来那一整块「坏配置照常落盘」**逐条反过来断言**）· `assets/tests/text-op-ledger.test.ts`
（那一族从「旧协议」搬到「工具调用」）· `docs/v2/{01,02,03}.md`（`§8` 那张表的两格 / Phase 12 落点 /
`§19` 的四处出入）· `00-overview.md`（§10 对账表加一行，末句改「最后八行」）· **两份 README**
（ASCII 图 / 用法 / CLI 表 / MCP 工具表）· `CONTEXT.md`（`Game Config` 那条补「不落盘」）。
