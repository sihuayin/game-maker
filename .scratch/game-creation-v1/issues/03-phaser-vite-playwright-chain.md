# 03. 产物 B 怎么构建、怎么静态托管？

Type: research
Status: resolved
Blocked by: —
Map: ../map.md

> ⚠️ **范围已重画**（2026-09-24，R3/R8）：本票原来是「Phaser + Vite + **Playwright** 三段链路」。
> R2 判 QA 闭环出局后，**Playwright 驱动玩法验证已随之下线**，本票只剩前半段：
> 产物 B 是一个「**静态可托管、打开即玩**的目录」，那它具体长什么样、怎么构建出来、
> 怎么做到「打开就能玩」而不需要一个 dev server。Playwright 若保留，只可能是**可选的启动冒烟检查**，
> 不再是链路的一环。
>
> **本票现在必须回答**：
> 1. Vite 构建一个 Phaser 3 游戏的产物形态 —— 入口 HTML、hash 命名、资源目录、base path。
> 2. **静态托管的最小要求**：能不能 `file://` 直接打开（Phaser 加载 atlas 会不会撞 CORS）？
>   如果不行，最小可行的托管方式是什么（`npx serve`？一条 `python3 -m http.server`？）
> 3. **资源包怎么进构建产物**：atlas PNG + JSON 是构建时打进去，还是运行时从资源包目录加载？
>    R6 要求「B 吃一个资源包」，所以装配方式直接决定产物 B 的目录形状。
> 4. 构建耗时多少（进票 19 的账本）。

## Question

Q4 已决定 Phaser 3 + Vite（无 React）、Playwright + Chromium 做 Runner。
但 `GameBuilder` → `GameRunner` → `ObservationProvider` 这条链的物理形态没定。查清：

1. **构建产物**：`vite build` 出来的是什么？纯静态 `index.html` + JS/CSS？
   产物能否用 `file://` 直接打开，还是**必须**起 HTTP server
   （ES module 的 CORS 限制、资源加载路径）？如果必须起 server，
   Vite 有 `vite preview`，还有别的选择吗？
2. **游戏资源路径**：程序化生成的 SVG/PNG 放在 `public/` 还是打包进 JS？
   `base` 配置怎么设才能让产物目录可以整体搬走（ArtifactRef.path 要能指向它）？
3. **Playwright 现状**：Playwright 当前的安装方式（`playwright` vs
   `@playwright/test`）、Chromium 下载体积、能否只装 chromium
   （`--with-deps`? `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`?）、macOS 上有无额外权限问题。
4. **就绪判定**：怎么知道游戏**真的启动完了**、可以开始截图和跑测试？
   靠 `page.waitForFunction('window.__GAME_RUNTIME__')`？
   还是等 Phaser 的 `READY` 事件？还是等首帧渲染？
   三者的可靠性差别是什么？（这是 Boot Gate 的实现基础。）
5. **截图**：`page.screenshot()` 截 canvas 有没有坑（WebGL 上下文需要
   `preserveDrawingBuffer`？Phaser 默认用 WebGL 还是 Canvas renderer？）？
   截全页 vs 截 canvas 元素 vs 截 clip 区域，哪个适合做 Visual QA 的 Evidence？
   区域截图（文档第 30 节的 `region_003`）怎么实现？
6. **Console / 错误捕获**：怎么抓 `console.error`、未捕获异常、
   资源 404（`assetLoadErrors` / `missingResources` / `runtimeErrors` 三个
   RuntimeHealthReport 字段全靠这个）？Playwright 的 `page.on('console')` /
   `page.on('pageerror')` / `page.on('requestfailed')` 分别覆盖什么？
7. **FPS 测量**：`RuntimeHealthReport` 有 `averageFps` / `minFps`。
   从 Playwright 外部能测到游戏内部 FPS 吗？还是必须由 Bridge 在游戏内
   用 `game.loop.actualFps` 采集后暴露出来？
8. **测试驱动方式**：语义动作（`interact('crop.tomato.01')`）是
   ① 通过 `page.evaluate` 调 Bridge 的 `execute()`，还是
   ② 由 Playwright 发真实鼠标/键盘事件？
   两者的**测试语义完全不同**（② 真的测了输入系统，① 没有）。
   查清各自的技术限制，供票 11 决策。

产出：一条**已验证可跑通**的最小链路（Vite 项目 → build → 起 server →
Playwright 打开 → 截图 → 抓 console），含真实命令和真实代码。
链路必须是实际跑过的，不是文档摘抄。

## Answer

**产物 B 用 `file://` 双击打开是做不到的，有两个互相独立的原因；「打开即玩」应准确定义为
「起一个静态 HTTP server 后打开即玩」——最小可行方式就是 `cd dist && python3 -m http.server`。
除此之外的构建与托管链条全部成立且亚秒级完成。**

完整调研（含实测命令、Chrome 原始报错、Phaser 源码行号、全部来源 URL）：
[`../research/demo-build-hosting.md`](../research/demo-build-hosting.md)
可复跑实验：[`../experiments/vite-build-hosting-probe/`](../experiments/vite-build-hosting-probe/)（`node probe.mjs`，四项检查全绿）

### ① 构建产物形态（实测 Vite 8.3.0 + Phaser 3.90.0）

```
dist/index.html                     0.33 kB │ gzip:   0.24 kB
dist/assets/index-DxhXxVJr.js   1,198.77 kB │ gzip: 319.64 kB
dist/assets/atlas.json / atlas.png      ← 来自 public/，名字原样、不带 hash
```

`dist/index.html` 的脚本标签被改写成
`<script type="module" crossorigin src="./assets/index-DxhXxVJr.js">`。
- **入口 = `<root>/index.html`**，**命名带内容 hash**，`assetsDir` 默认 `'assets'`。
- **`base: './'` 是必须的**（官方文档原话：`Empty string or ./ (for embedded deployment)`）。
  实测：产物整体拷到 `http://…/deep/nested/` 仍原样可跑，无 404
  → **产物目录可整体搬走，`ArtifactRef.path` 指向该目录即可，不用记录部署基址**。
  ⚠️ Phaser 官方 Vite 模板也设 `base: './'`。
- ⚠️ Phaser 打进一个 1.2 MB chunk，**必然触发 `>500 kB` 构建告警**，构建脚本要显式吃掉。

### ② 能不能 `file://` 直接打开 —— **不能**，双重否决

| # | 否决点 | 依据 |
|---|---|---|
| 1 | **module script 撞 CORS** | HTML 规范：「Unlike classic scripts, module scripts require the use of the CORS protocol」；实测 Chrome 153 报 `blocked by CORS policy: Cross origin requests are only supported for protocol schemes: chrome, chrome-extension, …, http, https` |
| 2 | **Phaser 的 loader 整个建立在 XHR 上** | `XHRLoader.js` 对**所有**资源都 `new XMLHttpRequest()`；`ImageFile.js` **连 PNG 也走 XHR**（`responseType:'blob'`），不用 `<img src>`；`AtlasJSONFile` 把 ImageFile + JSONFile 捆一起 |

**第 2 条是架构性的、绕不过的。** 实测反证：「把 bundle 改成 classic script 绕开 Vite」
之后 Phaser 正常启动、canvas 出来、横幅正常打印，**但 `frames: []` —— 一图未加载，
而且不报错**。这是「游戏能玩但没画面」的静默失败，比崩溃更难发现。

> **`file://` 的准确行为**：origin 是 **opaque/null**（MDN：「Modern browsers usually treat
> the origin of files loaded using the `file:///` scheme as opaque origins」）——
> **连同一个文件夹里的文件都算跨源**，所以改相对路径救不了。

**最小可行托管**（按零安装成本排序，前两条已实测通过）：

| 方式 | 命令 | 需要什么 |
|---|---|---|
| **Python 内置** | `cd dist && python3 -m http.server 8000` | 只要 Python 3（本机 3.13.3 已有） |
| Vite 自带 | `npx vite preview` | 需要 node_modules |
| npm 包 | `npx serve dist` | ⚠️ 未实测 |

**推荐 `python3 -m http.server`** —— 零 npm 依赖、零联网，连 node 都不需要，
正好兑现「产物 B 不吃生图能力、喂 fixture 也能跑」。
⚠️ **别把 `vite preview` 写进给用户的说明**（官方明说「not meant as a production server」，
且要求对方装了 node + 项目依赖）。

**唯一的 `file://` 逃生舱已实测可行**：atlas PNG 走 base64 data URI + JSON 走内联对象
（`XHRLoader` 有专门的 `file.base64` fake-XHR 分支，根本不碰 XHR）。
但产物会变成自包含单 HTML，**与 R6「B 吃一个资源包」冲突**，体积按 4/3 膨胀。
**不作为路线，只作为「必须邮件发一个文件」场景的备案。**

### ③ 资源包怎么进构建产物 —— 三种模型，都实测过

| 模型 | 做法 | 换包要重建？ | 结论 |
|---|---|---|---|
| **1. `public/`** | `public/assets/` → `dist/assets/`，**原样拷贝、不 hash** | 要 | 当前能立刻跑通的简化版 |
| 2. `import` | 构建期打进 bundle | 要 | ❌ 大包不可行；且实测**导入的 `.json` 变成 JS 对象不是 URL**，288 B 的 PNG 被 `assetsInlineLimit`(4096) **内联成 data URI**，`dist` 里根本没这个 png |
| **3. 站点目录 + 同级资源包目录** | `artifact/{site,pack}/`，游戏侧 `loaderBaseURL='../pack/'` | **不要** | ✅ **R6 最忠实，建议作为终局** |

模型 3 已实测跑通（server log 确认 `GET /pack/atlas.png 200`，图集正常装载）。
⚠️ **代价：HTTP server 的根必须是 `artifact/` 父目录，不能是 `artifact/site/`** ——
即**「产物 B 的路径」是父目录**，这一点必须写进契约，否则用户 `cd site` 起 server 会拿 404。

**给票 33 的输入**：装配 API 需要一个**「包基址」参数**，而不是把路径写死 ——
Phaser 的 Game Config 有现成的 `loaderBaseURL`/`loaderPath` 钩子
（源码 JSDoc 原话：「Useful if allowing the asset base url to be configured outside of the game code」），
同一份 `site/` 不用重建就能在模型 1 / 模型 3 之间切换。

### ④ 构建耗时 —— **亚秒级**（进票 19 的账本）

| 场景 | Vite 自报 | 端到端 wall |
|---|---|---|
| 只有 Phaser，无资源包 | **280–282 ms** | 0.47 s |
| + **67 MB / 25 文件**资源包 | **409–459 ms** | 0.60–0.66 s |

- **资源包体积对构建耗时几乎无影响**（67 MB 只加约 130–180 ms，底层 `cp -R` 只要 0.13 s）。
- 绝对主项是**打包 Phaser 本体**，不是资源。
- 对照生图单次 47–63 s：**`vite build` 在预算里可当作零，本票不构成票 19 的瓶颈。**
- ⚠️ 只测了 Vite 8.3.0（已换 Rolldown，`build.rollupOptions` 标 Deprecated），数字不能套 Vite 7。

### 对本项目其余票的直接输入

- **票 19**：`vite build` = **0.3–0.5 s**，与包体积无关。
- **票 25**：资源包进 `public/` 原样拷贝即可；若走 `import` 要注意 `.json` 会被编译成 JS 对象。
- **票 32**：外壳的资源路径必须走**可配置基址**，否则模型 1/3 之间切换要改代码。
- **票 33**：装配需要一个「包基址」参数；**产出目录 = 父目录（`site/` + `pack/`）**。
- **票 07**：构建脚本显式处理 `>500 kB` chunk 告警。
- **环境坑**：本机 `.npmrc` 指向 `registry.npmmirror.com`，装 Vite 8 会拉**所有平台**的
  `@rolldown/binding-*`，实测卡死 >5 分钟；加 `--registry=https://registry.npmjs.org` 后 **42 秒**装完。

### 查不到 / 未实测（不填空）

Firefox/Safari 的 `file://` 行为未实测（只有 Chrome 153，但 MDN + HTML 规范的表述是跨浏览器的）；
`npx serve` 未实测；只测了 Vite 8.3.0；没测 CI/别的机器；
「Vite 能否配出 IIFE 产物」未实测（不影响结论，否决点 2 独立成立）。

⚠️ **本票的旧正文（问题 3–8：Playwright 安装、Boot Gate、截图、console 捕获、FPS、语义动作）
已随 R2/R8 出局，未回答**，与新范围无关。

