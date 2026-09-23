# 21. DrawList renderer：Canvas2D 与 Phaser 两条消费路径

Type: task
Status: open
Blocked by: 02
Map: ../map.md

## Question

票 05 定了 Asset 是 `drawlist+curve/v1`（纯数值图元 + `curve` 用 Catmull-Rom）。
现在要把它变成屏幕上的像素。按 Q15，renderer 属于**手写固定**代码，不由 AI 生成。

**为什么阻塞在票 02**：Phaser 3 的 `Graphics` API 能否重放 drawlist **尚未实测**
（`bezierCurveTo` 是否存在、ellipse 参数是宽高还是半径、颜色是 number 还是 string）。
票 02 的第 9 条会给出答案，那决定走哪条路。

两条路（票 05 子问题 6 的结论）：

1. **直接画**：每个实体一个 `this.add.graphics()`，重放 ops。
   简单、无中间产物、改 ops 立刻生效 —— **对 repair 循环友好**
   （票 16 改一个数字就能看到效果，不用等 texture 重建）。
2. **离屏渲染成 texture**：drawlist → Canvas2D → `game.textures.addCanvas()`
   → `this.add.image()`。性能好（GPU 精灵批处理），但多一层缓存要失效管理。

**建议先 ①，性能不够再上 ②。** 但 ② 有一个 ① 没有的好处：
它产出的 canvas 可以被 Playwright 截图，也可以被
`measureInk()`（原型里那个「渲染后扫像素」的函数）用来**实测真实包围盒**，
进而校准票 12 的凸包容差。这个用途值不值得让 ② 提前？

要落地：

1. **`demo/src/game/renderer.ts`**：`drawOps(ctx, ops, palette)` 的 Canvas2D 实现。
   原型里已有一份可用的（含 Catmull-Rom → 三次贝塞尔的 8 行转换），直接搬。
2. **Phaser 版翻译器**（若票 02 确认 `Graphics` 够用）：
   同一个 `drawOps` 抽象，换一套后端调用。**两者必须产出视觉一致的结果** ——
   要不要一个对照测试（同一份 drawlist 分别渲染，比对像素）？
3. **palette 解析**：`palette:N` → hex。这个函数与票 20 的
   `resolveRefs()` 是同一个东西，**不要写两份**。
4. **错误处理**：原型实测过 D 候选的失败模式 ——「坏数据通过校验、到渲染才炸」。
   E 格式下 schema 已经拦住了绝大部分，但 renderer 仍要能
   **报告是哪个 asset 的哪个 op 渲染失败**（对应
   `RuntimeHealthReport.assetLoadErrors` 与 `AssetManifest.broken`），
   而不是让整个游戏崩掉。
5. **性能基线**：一次渲染 8 个 asset × 若干实体要多久？
   这个数字要进票 19 的时间账本。

不要在本票里做的事：Runtime Bridge（票 10）、场景组合（票 09 的 Game Config）、
Visual QA 的检查逻辑（票 12）。

## Answer

_（待填）_
