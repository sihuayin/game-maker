# 44. 实现固定 runtime 外壳

Type: task
Status: resolved
Blocked by: 41
Map: ../map.md

> ✅ **2026-09-28 已决议** —— 见文末 Answer。**外壳写出来了，而且真的起来了**
> （无头 Chrome，两个场景都出画布、零异常）。⚠️ 两件事要人看一眼：
> ① 一处**偏离 Q4**（用 esbuild 不用 Vite，理由与实测在 Answer §4）；
> ② 施工抓到 **`at` 的参考点在契约里没定死**，已毕业成[票 48](48-anchor-reference-point.md)。


> 由[票 32](32-runtime-shell.md) 毕业。它只**定形状**，而代码没有票承载 ——
> 33 的抬头明写「不要在本票里做外壳本身」，于是这份代码一直是无主的。
> 本票就是它：**浏览器里跑的那些字节**。

## Question

把外壳写出来，落在 `packages/demo/`（R9）。**不是决策票** —— 形状全部来自票 32 的 Answer，
本票不重开任何一条。

### 要产出的东西

1. **一条纯函数**：`(manifest, gameConfig) → 场景描述`。**它是本票的中心** ——
   票 32 裁决 4 说它是外壳可测的全部理由。Phaser 只负责把那份描述画出来，
   **函数里不许出现 Phaser**（票 21 的「零 DOM 依赖」是同一个纪律）。
2. **薄渲染层**：一个 scene，`update` 只做「推进物理 + 同步相机 + 刷 HUD」，
   在 `create` 里把场景描述铺开。**判据是它薄到没什么可测的**。
3. **占位符**：任何解不到的资源 → 在原位画一个刺眼的方块（品红/黑棋盘）+ 控制台警告，
   **游戏继续**（票 32 裁决 3）。⚠️ 这条直接对冲票 03 那条实测：
   **Phaser 的 loader 对 `file://` 会静默返回空且不报错** —— 不主动查，坏数据是不显形的。
4. **相机、输入、物理、HUD** 按票 32 的裁决 1/2 与本票的形状写死；
   手感参数从 `player.move` 读、**给默认值**。
5. **构建**：`packages/demo` 出**一份自包含 bundle**（Phaser 内联），
   逐字节相同的 `shell.js` 给所有站点共用（票 32 §2）。
   ⚠️ **施工要撞的第一件事**：票 03 的探针验的是 **Vite 8 + Phaser 3.90**，
   而仓库里的 Vite 是 **7.3.6**（vitest 带进来的）—— 能不能共存、要不要为 demo 单独升到 8，
   实测了再定，别猜。
6. **`SHELL_VERSION` 常量**（票 32 裁决 6），供站点装配写进 `site.json`。

### 测试

- **守门的（进 vitest，零浏览器）**：纯函数那一层的单测 ——
  **空数据不抛** · **坏数据（三处引用解不到）不抛且产出占位符描述** · 正常的 last-train 数据装配正确。
- **可复跑的探针（不进 CI）**：起 `python3 -m http.server` + Chrome 的真冒烟，
  照 `experiments/vite-build-hosting-probe/probe.mjs` 那个样子。它回答「真的能起来吗」。
- **夹具**：票 32 §3 那份**故意什么都缺**的 game-config ——
  ⚠️ 它**过不了构建期校验**，是**直接注入外壳**的，**不走 `site` 命令**。

### 不归本票

- **站点装配器**（`(包, game-config, out根) → site/v<N>/`）与那三族 + 第四族校验 ——
  归[票 33](33-runtime-assembly.md)。
- **给 last-train 写真正的 fixture game-config** —— 也归票 33（它依赖本票定的视口与玩家尺寸）。
- **外壳的成分清单与验收** —— 已由票 32 定死，本票照做。

---

## Answer

**结论：外壳写出来了，落在 `packages/demo/` —— 而且它真的起来了。**
无头 Chrome 里两个场景都**出画布、零页面异常**：空场景那一份满是刺眼的品红/黑棋盘与七条警告，
正常那一份画出了黄昏小站（三层视差、站台、旅行者站在地面线上、HUD 在左下角）。
**纯层 20 条测试 · 全套 315/315 · `pnpm check` 绿 · 一份 1.2 MB 的自包含 `shell.js`。**

### 1. 两条结构性决定

**① 纯层与渲染层在编译期就分开**（票 32 裁决 4 的落点）。

```
packages/demo/
  src/world.ts     ← 读 (manifest, game-config) → 场景描述。**零 Phaser、零 DOM**
  src/shell/       ← 薄渲染 + 入口。要 DOM 与 Phaser
  tsconfig.json       只编译 world.ts + index.ts（lib 无 DOM）→ dist/
  tsconfig.shell.json 只检查 src/shell（lib 有 DOM）→ 不产出
```

⚠️ **那条缝是编译器看着的，不是一句约定**：`world.ts` 里写一句 `document.x` 就编译不过。
「纯函数是外壳可测的全部理由」因此是**结构上的事实**。

**② 一次 esbuild 出一个自包含 bundle。** 见下面 §4 —— 这条偏离了 Q4，要你点头。

### 2. 实测钉住的两条 Phaser 사실（票 25 的判据成立）

直接读 `phaser@3.90.0` 源码：

- **`src.anchor || src.pivot` → `Frame.customPivot`**，而 `Sprite.setCurrentFrame` 与
  `AnimationState.setCurrentFrame` 都会 `if (frame.customPivot) setOrigin(pivotX, pivotY)`。
  ⇒ **逐帧锚点是 Phaser 原生行为，外壳一行代码都没写**。
- **`src.scale9Borders` → `Frame.setScale9()`**，`add.nineslice()` 零参数自动读。

⚠️ 但**碰撞盒与绘制有意分开**：盒子用**资源级锚点 + 标称尺寸**（manifest 的），
绘制用**逐帧锚点 + 帧的真实尺寸**。理由：逐帧变化的碰撞盒会让角色边跑边抖，
而逐帧锚点正是「跳起来收腿」（票 40 量过 `jump2` −2.6px）能画出来的原因。

### 3. 施工抓到的东西

**① `at` 的参考点在契约里**没有定死**，而校验器同时用了两种读法。**
这是本票最重的一条，它已经不是「外壳怎么写」的问题：

- **包的锚点指死了答案**：角色 `{x:.5, y:.95}`（脚）、道具 `{x:.5, y:1}`（底边中心）、
  HUD 面板 `{x:0, y:1}`（左下角）、小方块 `{x:0,y:0}`。⇒ **`at` 是「锚点落在哪」**。
- 而 `auditGameConfig` **同一个函数里用了两种读法**：越界检查把 `at` 当**左上角**
  （`at.x + w > W`），台阶高度却把 `at.y` 当**底边**（`step = groundY - at.y`）。
- 后果是**合法的 config 会被拒**：一个底边锚点、站在地面线上的东西写 `at.y = 地面 y`，
  越界检查算成 `at.y + h`，**凭空多出一个 `h`**。
- ⚠️ 而且**票 41 那次「修夹具」是修错了地方**：HUD 面板的 `at.y = 262` 在锚点语义下
  （`{x:0,y:1}` ⇒ 底边在 262，正是「离地 8px」）**本来就是对的**，
  我按左上角近似把它改成了 230。已毕业成[票 48](48-anchor-reference-point.md)。

**② 玩家本体不能拿 `{ asset }` 去解。** 它按定义有多个动画 —— 拿 `{asset}` 必然撞上
「必须指明 anim」。这与票 41 在引用族里抓到的是**同一个坑**（把「这个 id 是不是 animation」
与「这个引用画的是哪一帧」当成一回事）。现在的写法是先解各动作、再拿**第一个解得动的**当起点。

**③ 空场景夹具不能带注释键。** `GameConfigSchema` 是 `.strict()`，
我第一版往 JSON 里塞了 `_说明` 之类的键 ⇒ **整份 config 被拒**，
于是一个「考引用解不到」的夹具变成了「考 schema 不过」。已改成纯 JSON。

**④ 探针把外壳**自己报出来的问题**当成了「控制台报错」。** 外壳报坏数据用的就是
`[error] where: message`（票 32 裁决 3 要求它喊出来），而探针原本用 `/[error]/` 数「崩没崩」——
**等于把「它忠实地报告了坏数据」判成「它崩了」**。现在分开数：
`[error]`＝外壳报出的数据问题、`Uncaught/TypeError`＝没人预期过的崩溃。
顺带：Chrome 的日志格式是 `INFO:CONSOLE:<行号>]`（**不是 `(N)`**），
且消息里带转义引号 —— 用最短匹配抽会把消息截断成半句，于是探针看起来在报一个不存在的问题。

### 4. ⚠️ 一处**偏离 Q4**，要你点头

**Q4 是「Phaser 3 + Vite」。本票用的是 esbuild。**

票面把这件事点名成「施工要撞的第一件事」，说**实测了再定**。实测下来：

| | esbuild（**实际用的**） | Vite 8 |
|---|---|---|
| 一句命令出一份自包含 bundle | ✅ `--bundle --platform=browser --format=iife` | 要配 lib 模式 |
| 耗时 | **346 – 1045 ms** | 票 03 实测 280–459 ms |
| 新工具链 | **零**（`cli` / `mcp` 早就这么打） | +rolldown 全家桶（票 07 记过：npmmirror 上会拉全平台二进制、卡死 5 分钟） |
| HTML 入口 / dev server / HMR | 用不到 —— `index.html` 是**装配器写的**（票 33），站点是静态产物 | 用不到 |

⚠️ **我没有装 Vite 8**：装它要拉 rolldown 的跨平台二进制，而那正是票 07 记下的那个坑。
我的判断是**外壳根本不需要打包器**（它要的就是一个文件，正是 R9 给 `cli` 定的那条路），
但这**推翻的是一条锁定决策**，所以摆出来由你定。
**换回 Vite 只动 `package.json` 一行 `bundle` 脚本，源码一个字不改。**

### 5. 完成条件逐条

| 票面要求 | 状态 |
|---|---|
| 一条纯函数 `(manifest, gameConfig) → 场景描述`，无 Phaser | ✅ `world.ts`，且**编译期**不许碰 DOM |
| 薄渲染层（`update` 只做推进物理 + 同步相机 + 刷 HUD） | ✅ `shell/scene.ts` |
| 占位符：解不到就品红/黑棋盘 + 控制台警告、游戏继续 | ✅ 探针 A 场景截图可见（整屏棋盘） |
| 相机 / 输入 / 物理 / HUD 写死；手感从 `player.move` 读且有默认 | ✅ 视口常量 480×270、`Scale.NONE` 2× 整数放大、相机水平跟随 + clamp |
| `packages/demo` 出一份自包含 bundle（Phaser 内联） | ✅ `dist/shell.js` 1.2 MB |
| `SHELL_VERSION` 常量供装配写进 `site.json` | ✅ 且**对不上会喊**（站点不在 git 里，拷错版本必须显形） |
| 守门测试（空数据不抛 / 坏数据出占位符 / 正常数据装配正确） | ✅ **20 条**，零浏览器 |
| 可复跑的探针（不进 CI） | ✅ `pnpm --filter @game-maker/demo smoke` |

⚠️ **`pnpm typecheck` 在 `main` 上本来就是红的**（`packages/assets/tests/` 三处，
与本票无关，本票开始前就红）。本票自己的 `typecheck` 是绿的。
真正的门是 `pnpm check`（依赖图 + `tsc -b` + bundle）与 `pnpm test`。

### 6. 产出

```
packages/demo/
  src/world.ts              纯层（本票的中心）
  src/index.ts              只导出纯层
  src/shell/{scene,entry}.ts 薄渲染 + 站点入口（IIFE，不是 module —— 少一个 CORS 失败模式）
  tests/world.test.ts       20 条，零浏览器
  fixtures/empty-world.json 票 32 §3 那份**故意什么都缺**的夹具
  fixtures/last-train.world.json 一份**合法**的 config（探针与测试共用，不是第二份）
  probe/smoke.mjs           起 http server + 无头 Chrome 的真冒烟（两个场景 + 截图）
  dist/shell.js             构建产物（gitignore）
```

⚠️ **`fixtures/last-train.world.json` 是**临时**的**：票面把「真正的 last-train fixture game-config」
判给了[票 33](33-runtime-assembly.md)（它依赖本票定的视口与玩家尺寸）。这一份存在的理由是
**让外壳今天就能端到端冒烟**；票 33 要么采纳它、要么替换它。

### 7. 毕业与解锁

- **毕业[票 48](48-anchor-reference-point.md)**（task）—— `at` 的参考点必须定死，
  校验器现在同时用了两种读法。
- ⭐ **[票 33（资源包 → 运行时的装配）](33-runtime-assembly.md) 现在解锁了** ——
  它的七个前置里最后一个就是本票。**它是通往产物 B 的最后一段路**：
  装配器一落地，「一个资源包 + 一份 game-config → 打开即玩」这条链就闭合了。
