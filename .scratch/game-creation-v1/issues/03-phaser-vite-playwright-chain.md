# 03. Phaser 3 + Vite 的构建产物与 Playwright 运行链路怎么接？

Type: research
Status: open
Blocked by: —
Map: ../map.md

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

_（待填）_
