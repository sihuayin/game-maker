# 23. E2E fixture + 真跑一次：`fixtures/e2e/wasteland-platformer/`

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> `docs/v2/03-claude-code.md` §27/§28。**这是终点的判据本身。**
>
> ⚠️ **2026-10-09 · 本票未解**（认领过 `claude`、做了一半）：fixture 的 `intent.md` 已按 §27 逐字建好，
> 但**真跑没跑成 —— 理解段第 2 步 `analyze-intent` 就断了**（三发全 `schema`、退 4）。
> 病因量清了，派生成[票 34「`coreLoop` 这个键名让模型 12/12 吐字符串」](34-coreloop-key-name.md)，
> **本票改挂它**。现场与量到的数在下面的 `## 现场`。`style.png` **还没定**（票面 §1 那一问仍然开着）。
>
> ✅ **2026-10-09 · 票 34 已关，本票的前置解除**（`Blocked by` 已去掉 `34`）。连同本轮人类的三条裁定：
> **① `style.png` 用 `fixtures/reference/halt-dusk.png`，并在 fixture 里明说这是「有意的错配」**；
> **② 不改 `game-maker.local.json`**（那条死掉的 `9098` 代理得绕，不是修文件）；
> **③ 验收从「跑到站点」收紧为「从 fixture 真跑到站点，并验证生图确实发生」。**
> ⚠️ 票 34 只验到第 2 步（`analyze-intent` 首发过契约），**没有替本票跑过**。
>
> ❌ **2026-10-09 深夜 · 票 35 已关，本票按它的决定真跑了一次（第三次），还是没到站点。**
> **退出码 1 · 墙钟 6175.3s（≈103 分钟）· 付了 9 张图的钱**（7 张生成图 + 2 张母版），
> **抛在 `pack` 段的 `scavenger-idle` 上**（票 35 §6 那条 0 像素哨兵 —— **它响了，而且响对了**）。
> ⚠️ 但**它报出来的真因推翻了票 35 决定表的第 2 行**：那个「确定的派生色」模型**从没交付过**
> （9/9 在容差 30 下 **0 像素**，最近像素差 **L1 118~334**）⇒ 派生[票 37](37-key-colour-not-delivered.md)，
> **本票先挂它**（`Blocked by: 37`）。⚠️ **2026-10-10 票 37 已 `resolved`** —— 它只改了**单帧 / 多帧**
> 那一侧（按实测众数色抠），**背景层按 Q3 原样留着**，而背景层那条哨兵**必然**会响
> （背景层同样不交付声明色）⇒ 派生出[票 38](38-background-layer-key-colour.md)，
> **本票改挂票 38**。现场与读数在
> `experiments/e2e-wasteland/raw/key-colour-third-run/`（**原现场那 9 张已被复制出来** ——
> 它们在下一次真跑开头会被 `rmSync` 删掉，而 `*.png` 在 `.gitignore` 里）。
> ⚠️ **「验证生图确实发生」这一条今天验到了**（9 张真 PNG + 同名 `.prompt.txt`）；
> **「跑到站点」还差 `pack` 尾 + `config` + `qa` + 站点。**

## Question

图上的 Destination 写着：链要能跑完，**并且**在这个 fixture 上**真跑通一次**。
这一票是**执行**，不是决定 —— 但它会**顶出新问题**（前三张图的经验：真跑一次才知道的事，一件一件会回来）。

### 1. 建 fixture（§27 给了原文）

```text
fixtures/e2e/wasteland-platformer/
├── style.png
└── intent.md
```

`intent.md` 的正文 §27 已经写好了，照抄：

> 制作一个横版废土寻宝游戏。
> 玩家控制一名拾荒者，在废弃城市中探索，寻找资源和宝箱，同时躲避危险和敌人。
> 游戏需要有：横版移动 · 跳跃 · 宝箱 · 资源 · 敌人 · 废土背景 · 最终目标

⚠️ **`style.png` 从哪来** —— 这是本票第一个要答的：
- **(a)** 用 `fixtures/reference/halt-dusk.png`（**黄昏山间列车小站**）—— ⚠️ 那张图**不是废土**，
  风格与意图**故意错配**。错配是**好事**（它考的是「跟图走还是跟文本走」这个真问题），
  但要**明说**这是在测错配。
- **(b)** 新造一张废土参考图 —— ⚠️ 仓库里**没有**，要么花钱生（走 `inputs/` 那条导入通道），
  要么手绘。
⚠️ 注意 `intent.md` 里**没提**「场地是一格格砖」那类要件 —— 横版这边
`README_zh.md` 警告过的同类坑（需求没说的，编译器只能拿示例填）**同样适用**。

### 2. 真跑一次并记录

```bash
game-maker create --style fixtures/e2e/wasteland-platformer/style.png \
                  --intent fixtures/e2e/wasteland-platformer/intent.md
```

要记下的（**事实**，不是评价）：
- 每一步的**墙钟**与**账**（`ledger.json`：调用数 / 往返数 / 上游自报 token / 张数）；
- 三个 QA 各自的**判据**过了没、**观察**说了什么；
- 视觉那一步的**严格 JSON 成功率**（票 08 §3 / 票 25 问同一件事）；
- 与 `§28` 期望的产物清单**比一比**：

```text
out/<gameId>/
├── visual-world.json  game-intent.json  game-design.json
├── asset-recipe.json  asset-pack.json
├── runtime-profile.json  game-config.json  qa-report.json
└── playable/
```
⚠️ **这个清单与 R8 的形状不一致**（R8 是 `run/v<N>/` + `pack/v<N>/` + `site/v<N>/`）。
本票要**记下实际落盘**，并确认 R8 那个形状**真的能承载** §28 要的每一份东西 ——
**承载不了就是地图要改的地方**，要当场报回去。

### 3. 终点判据

「浏览器里打开能玩」—— ⚠️ 起服务的规矩是**钉死过的**（`README_zh.md`）：
HTTP server 的根必须是 `out/<gameId>/`，**不是**站点目录本身；`file://` **不行**。
本票要**照那条规矩**验一次，并把「能不能玩」记成**观察**（好不好玩只有人眼）。

## 现场（2026-10-09 · 未解）

认领过（`claude`），做了一半，**没跑到终点**。原始输出留在
`.scratch/game-maker-v2/experiments/e2e-wasteland/`（`raw/understanding.json` · `raw/out/.failed-…/` ·
三支探针脚本与它们的 `raw/`）。

### 已完成

**1. fixture 的 `intent.md` 建好了**（`fixtures/e2e/wasteland-platformer/intent.md`）——
逐字取自 `03 §27` 那个 ```text 块（含它自己的换行与 `-` 列表）。
⚠️ **票面引的那三行是**把 §27 的硬换行折成句子的**转述**；本票按票面「照抄 §27」那个字面走了 §27 的原文。

**2. `style.png` 没定** —— 票面 §1 那一问（借 `halt-dusk.png` 测错配 / 新造一张）**仍然开着**：
第 3 步都到不了，现在选哪张都只是把一次真跑花掉。

### 真跑

```bash
node packages/cli/dist/cli.mjs create \
  --style fixtures/reference/halt-dusk.png \
  --intent fixtures/e2e/wasteland-platformer/intent.md
```

（`--style` 临时借 `halt-dusk.png` **当探针**，不是定案。）

| 步 | 结果 |
|---|---|
| `visual-world` | ✅ 过 —— 产物落在临时 run 目录里（见下），内容连贯（`camera.mode: "side"` · 六桶 · `materials` 四类） |
| `intent` | ❌ **退 4** —— `analyze-intent` 三发全 `schema`，9.4s，账上 `inputTokens 191 / cached 1920 / outputTokens 671`，`servedModel=deepseek-flash` |
| `design` · `character-dna` · `recipe` | 没走到 |
| `pack` · `config` · `qa` · 站点 | 没走到 |

⚠️ 它**没走到 `commitRun`**，所以没有 `run/v<N>/`：失败现场是
`raw/out/.failed-2026-10-09T09-30-48-652Z/`（`abandonRun` 改的名，**只改名不删**），
里面是 `halt-dusk.png` · `intent.md` · `visual-world.json` 三件。
⚠️ **那个目录不在 git 里** —— 仓库根 `.gitignore` 有一条 `out/`（不限层级）⇒ 它被吃掉了。
⚠️ 这是**本仓库既有的形状**，不是这里漏了：[票 13](13-character-master-gen.md) 的
`raw/out/` 产物 PNG 同样不入库（它 §228 也是这么记的）。**留在现场、只在本机** ——
真正该进 git 的是**读数**（本票里那张表与那条路径），不是像素。

### 断在哪

**`coreLoop` 这个键名** —— 模型把它吐成字符串。完整的量（四组探针 · 对照组 · 改名后 3/3 过真契约）
在[票 34](34-coreloop-key-name.md) 的 `## Question`，**不在这里抄第二份**。

### 顺带量到的（与断点无关，但本票该记）

- ⚠️ **`game-maker.local.json` 的 `image.proxy` 写的是 `127.0.0.1:9098`，那个口今天没人听** ——
  而本机的 ClashX 在 **`7890`**：走它 `generativelanguage.googleapis.com` 通、
  Gemini key **有效**（`models` 列表回 50 个）、`gemini-2.5-flash-image` 在表里。
  ⇒ **生图那条路是「端口写错了」，不是「没有」**；但本票**没动那个文件**（它是人的、没进 git）。
- ⚠️ **`resolveImageTransport` 的环境变量那条路没有 proxy 这一项**
  （`IMAGE_ENV` 只有 protocol / baseUrl / apiKey / model）⇒ 想用 env 覆盖**换不掉代理**：
  要么改文件、要么把代理起在配置写的那个口上。
- **生图一次都没发生过**：`out/` 下的账里 `protocol` 零命中（`gemini` / `openai` / `dashscope` 都没有）。

### ⚠️ 第一次真跑（2026-10-09 上午）：断在第 2 步

§2 那份产物清单与 R8 的形状对不对得上 · 「浏览器里打开能玩」那条判据 · 三个 QA 各自的判据 ·
视觉那一步的严格 JSON 成功率 —— **第一次一条都没验**，全断在第 2 步后面（病因 = 票 34）。

---

## 现场 · 第二次真跑（2026-10-09 下午 · 票 34 关掉之后）

fixture 齐了（`intent.md` §27 逐字节 + `style.png` = `halt-dusk.png`，**有意错配**，见 `fixtures/e2e/wasteland-platformer/README.md`）。
**这一跑还是没到站点** —— 这次挂在 `pack` 段，病另有其人 ⇒ 派生[票 35](35-multiframe-needs-background.md)。

### 怎么跑的（**这一条是读数的一部分**）

```bash
node .scratch/game-maker-v2/experiments/e2e-wasteland/run.mjs
```

驱动的是**出货的 CLI 入口**（`packages/cli/dist/cli.js` 的 `run`），参数：
`create --style fixtures/e2e/wasteland-platformer/style.png --intent …/intent.md --out <实验目录> --yes --json --concurrency 3`。

⚠️ **`game-maker.local.json` 一个字没动**（人类 2026-10-09 裁定「暂不修改」；它是人的、没进 git）。
那条死掉的 `9098` 代理是**绕过去**的：注入 `deps.fetchImpl`，**`https:` 走 ClashX 的 `7890`、其余直连**
（`IMAGE_ENV` 没有 proxy 那一项、env 覆盖换不掉代理 ⇒ 只剩这条路；**票 16** 用过同一条）。
⚠️ 不分流会把本机那条明文请求也塞进代理，openssl 当场 `wrong version number`。

**退出码 1 · 墙钟 151.8s**（含 19 件资源的出图）。Understanding 段 `run/v1/ledger.json` 自报 **64946ms**。

### 走到了哪一步

| 步 | 结果 |
|---|---|
| `visual-world` | ✅ |
| `intent` | ✅ **首发就过**（票 34 的改名在真链上生效） |
| `design` | ✅ |
| `character-dna` | ✅ |
| `recipe` | ✅ |
| `pack` | ❌ **18/19 件出完，抛在 `scavenger-idle`** |
| `config` · `qa` · 站点 | 没走到 |

⇒ **理解层那 5 步全绿，`run/v1/` 落盘了**（10 项：`intent.md` · `style.png` · `reference.png` ·
`stylespec.json` · `visual-world.json` · `game-intent.json` · `game-design.json` ·
`character-dna.json` · `asset-recipe.json` · `ledger.json`）。

### 账（`run/v1/ledger.json` · 逐发）

| step | target | ms | 往返 | `failures` | in | out |
|---|---|---|---|---|---|---|
| `analyze-reference` | `style` | 14090 | **2** | `["schema"]` | 230 | 1305 |
| `analyze-intent` | `game-intent` | 3652 | **1** | `[]` | 195 | 811 |
| `compile-design` | `game-design` | 27643 | **3** | `["schema","schema"]` | 243 | 2002 |
| `character-dna` | `character-dna` | 6407 | **1** | `[]` | 2219 | 929 |
| `plan-assets` | `recipe` | 13024 | **1** | `[]` | 2918 | 3489 |

上游一律自报 **`servedModel: deepseek-flash`**（请求的是 `deepseek-v4-pro`）。

### ⚠️ 严格 JSON 成功率（票面 §2 点名要的那一项）

**5 发里 2 发要重采样，一共烧掉 4 次额外的往返。**
⚠️ **`compile-design` 打满了 R16 那 3 发地板**（`["schema","schema"]` 之后第 3 发才过）——
**再多一次就要退 4**。这正是地图 `Not yet specified` 里问的那件事：
「R16 那 3 次地板撑不撑得住」—— 今天在这条链上**恰好撑住，且没有余量**。
⚠️ 而 `analyze-intent` 是 **1 发过**（改名之前是 3 发全灭）。

### ⚠️ 生图**确实发生了**（人类 2026-10-09 的验收第 2 条）

19 件资源 = **10 件走生图 + 9 件走 drawlist**；另有 **2 张母版**（都走生图）。

```text
authoring/generated/   10 张 .png + 10 份同名 .prompt.txt   共 7.9 MB
authoring/masters/      4 张（2 张母版各自的分层）
authoring/drawlist/     9 份 .json
```

抽查 `scavenger-idle.idle.png`：**PNG 魔数对、1344×768、8-bit RGBA、非隔行** —— 真位图，不是占位。
（`file(1)` 与直接读 `IHDR` 两个口径都核过。）

⚠️ **但生图那本账没留下来** —— `pack.ts:880` 才写 `ledger.json`，而它排在那个抛点（`617`）**后面**
⇒ 19 张图的调用数 / 往返数 / 上游自报 token 一条都没有。**这是票 35 顺带记的第二件事。**

### 断在哪（⇒ 票 35）

```text
资源 "scavenger-idle" 的动画 "idle" 是多帧，但 source 没给 `background` ——
分块靠的是抠掉背景之后的 alpha，不抠就切不开（实测会把一整排 4 个角色判成 1 块）。
```

配方里 5 件多帧动画（`scavenger-idle` / `scavenger-run` / `scavenger-jump` /
`enemy-idle` / `enemy-patrol`）**五件的 `source.background` 全是 `null`** ⇒ 不是手滑，是**模型不知道有这回事**
（契约里它是 `.optional()`、提示词里一个字没提）。现场与三条证据在[票 35](35-multiframe-needs-background.md)。

⚠️ **失败现场是 `failed-2026-10-09T10-10-36-372Z/`**（`abandonRun` 改名不删）——
`run/v1/` 还在旁边，两者并存；`pack/v1/` **没被用掉**（这个 N 只在成功时才占）。

### §28 那份清单 vs R8 那个形状（票面 §2 点名要的那一项）

⚠️ **只验到一半**（链没跑完），但已经能看出**形状是「三段不是一棵树」**：

| §28 要的 | 今天落在 | 验到没 |
|---|---|---|
| `visual-world.json` · `game-intent.json` · `game-design.json` · `asset-recipe.json` | `run/v1/` | ✅ **在** |
| （§28 没点名的）`intent.md` · `style.png` · `reference.png` · `stylespec.json` · `character-dna.json` · `ledger.json` | `run/v1/` | ✅ 也在 —— §28 的清单**比实际少列了 6 份** |
| `asset-pack.json` · `runtime-profile.json` · `game-config.json` | `pack/v<N>/`（未成形，今天在 `failed-…/authoring/`） | ❌ 没验到 |
| `qa-report.json` | 同上一段 | ❌ 没验到 |
| `playable/` | `site/v<N>/` | ❌ 没验到 |

⇒ **R8 的三段形状承载得了 §28 的清单**（前 4 份已经在 `run/v1/` 里躺着了），
⚠️ 但**反过来不成立**：§28 那份清单**漏了 6 份真实产物**。
要不要把 §28 补全 —— 属于 `docs/v2` 的回填，本票只报事实。

### 没验的（等票 35）

「浏览器里打开能玩」那条判据（票面 §3）· 三个 QA 各自的判据与观察 ·
`config` / 站点那一步 —— **一条都没验**，全在 `pack` 段后面。
⚠️ **票面 §3 那条「HTTP server 的根必须是 `out/<gameId>/`、`file://` 不行」也还没照做**。

## ⏳ 付费运行报告（2026-10-10 出 · **待批** —— 票 38 落地之后的那一跑）

⚠️ **这不是在申请「可以跑」，是把要花什么、条件是什么摆出来等人裁。没拿到明确同意之前，一张图都不买。**
（R9 的唯一人工检查点在 manifest；这份报告是它前面那道闸。）

### 一、这次要跑的是什么

从 `fixtures/e2e/wasteland-platformer/` 起，跑**完整那条链**：`visual-world → intent → design →
character-dna → recipe(plan) → pack → config → qa → site`，验的是**票 23 的终点判据**
（「从 fixture 真跑到站点，并验证生图确实发生」，人类 2026-10-09 收紧过的那一条）。

### 二、预算 · 最大调用次数

⚠️ **生图调用数不是固定的** —— 清单由 `plan-assets` 那一步**当场生成**（模型产出的），
所以「这一次会买几张」在开跑前**只有上限、没有准数**。两次真跑的实测量到：

| 哪一跑 | 清单件数 | 生图 unit（含母版） | **实际买了** |
| --- | --- | --- | --- |
| `-run`（2026-10-09 上午） | 19 | 13 + 2 = **15** | **0**（死在 `plan-assets`） |
| `-assets`（2026-10-09 18:30） | 24 | 11 + 2 = **13** | **9**（7 生成 + 2 母版） |

⇒ **上限按 15 张报**（取两次里大的那个）。文本调用 **5 发**（上一跑 `run/v1/ledger.json` 逐发记着：
`analyze-reference` · `analyze-intent` · `compile-design` · `character-dna` · `plan-assets`）。
并发 `text 4 / image 3`（`DEFAULT_CONCURRENCY`）。墙上时间上限按 **120 分钟**估（上一跑 102.9 分钟）。

⚠️⚠️ **最要紧的一条：失败不会立刻止血，所以预算要按全量估。**
`pack` 是 `await Promise.allSettled(recipe.assets.map(…))`（`pack.ts:878`）—— **所有资产同时开跑**；
而「失败之后不再花钱」只在**信号量排队处**拦得住（`pack.ts` 的 `gate`：排队期间再查一次
`stop.error`），**已经发出去的拦不住**。实测坐实：`-assets` 那一跑**第一个**资产 `scavenger-idle`
就抛了，可它**照样付了 9 张**（`authoring/generated/` 7 个 `.png` + `authoring/masters/` 2 个）
才停下来。⇒ **别按「第一个抛点」估钱。**

### 三、停止条件

1. **任何一步硬失败**（`create` 非零退出）⇒ 停，**不重跑**。⚠️ **不许偷偷加重试 / 修复循环 /
   自动重生成**（R13 的边界，要动得按 R17 另开票 —— 票 33 刚裁过「第一阶段不建」）。
2. ⚠️ **没有「最多买 N 张」这个开关** —— 今天**全仓没有**预算 / 上限参数
   （已查：`cli` / `pipeline` 里没有 `maxCalls` / `budget` / `--limit` 之类）。
   ⇒ 这一条**今天只能靠人盯着**，或者接受「按上限 15 张全花掉」的敞口。**这是一处已知空白，不是保证。**
3. 墙上时间超过 **150 分钟** ⇒ 人工叫停（上一跑 102.9 分钟）。

### 四、验收条件（跑完之后拿什么判它成了）

1. `create` **退出码 0**，且走到 `site` 段 —— 产出 `out/<gameId>/site/v<N>/index.html`。
2. ⚠️ **生图确实发生**（人类 2026-10-09 的验收第 2 条）：`authoring/generated/` 里**有真 `.png`**，
   而且账上记着（`ledger.json` 的 image 调用 / `imageCalls`）—— **不是 0**。
3. 站点装配期校验**全过**：三族（契约层）+ 第四族（几何）+ 第五族（HUD 屏幕空间）。
4. ⚠️ **那条「最远层必须画满」的门禁绿了不算证据** —— 票 38 之后它**恒真**（`site.ts` 自白写明：
   最远层有意不抠 ∧ 上游 14/14 张不给 alpha ⇒ 覆盖率 ≡ 1.0）。**别把它当通过信号。**

### 五、明确不做

**不加重试 / 修复循环 / 自动重生成**（R13 不动）· **`packages/qa` 一行不碰** ·
**`game-maker.local.json` 一个字不动**（那条死掉的 `9098` 代理靠注入 `deps.fetchImpl` 绕开）。

### 六、开跑前还剩一个没弄清的点（**建议先弄它**）

⚠️ **进度日志与磁盘上的账对不上**：`raw/run.json` 那份 stdout 记着 `pack` 走到了 `hud-chest-icon（23/24）`，
可 `authoring/generated/` 里只有 **7 张**（`treasure-chest-opened` 与 `wasteland-skyline` 的**后 3 层**
一个文件都没有）。两件事**今天解释不通** —— 而它直接关系到第二节那个「失败会花掉多少」的估计。
⇒ 建议**开跑前**先把这段对上（读 `pack.ts` 的并发 / 信号量那一段 + 那次跑的 stdout 顺序），
或者**接受敞口**再跑。⚠️ 我**没有**擅自去改代码或改那份现场去「对上」它。

## Answer

⚠️ **下面这段写在票 38 施工落地之前 —— 已被本节末尾那一段（✅ 2026-10-10）作废。**
本票今天的状态是：**待解，但阻塞已解除**（`Blocked by: —`），可以取。

（待解 —— 本票被[票 38](38-background-layer-key-colour.md) 挡住：
[票 37](37-key-colour-not-delivered.md) 已落地（**单帧 / 多帧**改按**实测众数色**抠，
判据是「抠掉多数 + 剩余连成一块」），但票 37 的 **Q3** 把**背景层**原样留着 ——
⚠️ 而背景层同样**不交付**那个声明色（第三次真跑 9/9 张在容差 30 下 0 像素）
⇒ 下一次真跑**付完 13 张图之后**仍然会停在 `wasteland-skyline.skyline`。
链上一轮跑到 `pack` 段的 `scavenger-idle` 上断了，离站点还差 `config` + `qa` + 站点三步）

⚠️ **2026-10-10 补一行**：[票 38](38-background-layer-key-colour.md) 两轮问答**设计面已收敛**
（最远层不抠 · 非最远层按实测众数色抠），但**代码一行未动** ——
本票**照旧挂在那里，不许提前解**：抠底那条分支今天仍然按**声明色**走，
现在开跑等于**再买一次那 13 张图**、再停在 `wasteland-skyline.skyline`。
解票的条件是票 38 那 8 条施工落地，不是它的裁定落地。

✅ **2026-10-10（同一天更晚）：那 8 条施工已全部落地 ⇒ [票 38](38-background-layer-key-colour.md) `resolved`，
上面这一段因此作废。本票的 `Blocked by` 解除，**本票成为前沿上可取的票**。**
落地的是：最远层**整个 `background` 键都不传**（不抠）· 非最远层按**实测众数色**抠 ·
`keyedPixels === 0` 那条哨兵**删**（它正是「开跑就停在 `wasteland-skyline.skyline`」的那一条）·
`site.ts` 两条 `FILLED` 门禁各加**带日期自白**。闸：套件 **1184/1184** · 变异三发全红。
⚠️ **但「可开跑」不等于「可以开跑」**：本票自己那条规矩照旧 ——
**先出一份付费运行报告（预算 / 最大调用次数 / 停止条件 / 验收条件），拿到人明确同意之后再跑**。
⚠️ 而且这一次的终点**仍然不确定**：抠底之后的**下一个**观测点是 `pack.ts` 的**帧数核对**，
它至今**一次都没响过**（`检测到` 在 `raw/run.json` 里出现 0 次 —— 上一次的抛点在它前面）。
