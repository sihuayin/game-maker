# 02. Phaser 3 的插件系统能否支撑一个「自动采集」的 Runtime Bridge？

Type: research
Status: resolved
Blocked by: —
Map: ../map.md

> ⛔ **已判出局**（2026-09-24，R2）。判出局的**不是问题本身，是本图的终点**：
> 它属于「QA 闭环」那一簇，回答的是「AI 能不能自己判断做得好不好并改进」，
> 而重画后的终点是「能不能产出两个可用的东西」。
> Runtime Bridge 是 QA 的地基，地基随 QA 一起走。
>
> **文件保留、不删除** —— 里面的实测数据与分析对将来那张闭环地图仍然有效。
> 永不毕业：只有重画 Destination 才会回来，且那时是一张新地图。

## Question

Q10 已决定：`window.__GAME_RUNTIME__` 由**手写固定的 Phaser 插件 SDK** 实现，
AI 生成的代码只调 `bridge.tag(gameObject, 'crop.tomato.01')`。
这个决定的可行性完全取决于 Phaser 3 的插件能力。查清：

1. **插件机制**：Phaser 3 当前的插件体系（`Phaser.Plugins.BasePlugin` /
   `ScenePlugin`、`GamePlugin`）怎么注册、怎么在 scene 里取用？
   `this.plugins.get('X')` 的实际 API 是什么？插件能否拿到 scene 引用？
2. **生命周期钩子**：插件能监听哪些事件来自动采集 Observation？
   具体确认这些是否存在、签名是什么：
   - `Scenes.Events.STARTED` / `LOADED` / `SHUTDOWN` / `DESTROYED`
   - `Systems.Events.UPDATE`（每帧）
   - `Core.Events.STEP` / `READY`
   - `Input.Events.GAME_OBJECT_DOWN` / `POINTER_DOWN`（用于记录交互事件）
3. **实体枚举**：能否从 scene 拿到全部 GameObject 并读出
   `x/y/width/height/visible/alpha`？`displayWidth` vs `width` vs `getBounds()`
   的区别是什么（文档第 31 节的 scale mismatch 检查依赖这个）？
   `Phaser.GameObjects.Group` / `Layer` 的成员怎么遍历？
4. **tag 的挂载方式**：给一个 GameObject 附加语义 id，是挂自定义属性
   （`go.setData('bridgeId', ...)`）、用 Phaser 内建的 `Data Manager`
   （`go.setData` / `go.getData`）、还是外部 WeakMap？
   哪种在 GameObject 被 destroy 后不会泄漏？
5. **游戏状态读取**：怎么判断游戏处于 booting / playing / paused / won / lost？
   Phaser 有内建的 scene `isPaused()`，但 won/lost 是游戏语义 ——
   插件应该暴露一个 `bridge.setGameState('won')` 让 AI 生成的代码显式声明吗？
6. **执行语义动作**：`bridge.execute({type:'move',direction:'up',duration:500})`
   要模拟键盘输入。Phaser 的 `Input.Keyboard` 能否被**程序化触发**
   （`keyboard.emit`?  `FakeKey`?），还是必须走 Playwright 的真实按键？
   两条路各自的代价是什么？
7. **与 Vite/ESM 的集成**：Phaser 3 当前稳定版本号、npm 包名、
   ESM 导入方式、有无 TypeScript 类型（`@types` 还是自带）。

产出：一份可直接照着写插件的事实清单，含**最小可运行代码片段**
（注册插件 → 监听事件 → 枚举实体 → 暴露到 window）。
如果第 2 或第 6 条的答案是「做不到」，明确说出来并给替代方案 ——
这会推翻 Q10 的实现路径，必须尽早暴露。

## Answer

_（待填）_

---

## 来自票 05 的更新（2026-09-23）—— 新增一条必查项

票 05 已定：Asset 格式是 **`drawlist+curve/v1`** —— 一份 JSON，
`ops` 是纯数值图元（`rect` / `circle` / `ellipse` / `poly` / `line` / `curve`），
其中 `curve` 是**数值控制点列**（Catmull-Rom 转三次贝塞尔），**不是** SVG `d` 字符串。
颜色一律是 `palette:N` 引用，渲染时才解析成 hex。

**新增第 9 条必查项：Phaser 3 的 `Graphics` 能否重放这份 drawlist？**

需要逐个确认这些 API 是否存在、签名是什么、在 WebGL 与 Canvas 两种 renderer 下
行为是否一致：

- `fillRect(x,y,w,h)` / `fillCircle(x,y,r)` / `fillEllipse(x,y,w,h)`
  （注意 Phaser 的 ellipse 参数是**宽高**还是**半径**？）
- `beginPath()` / `moveTo()` / `lineTo()` / `closePath()`
- `bezierCurveTo(cx1,cy1,cx2,cy2,x,y)` —— **curve op 全靠它**，必须确认存在
- `fillPath()` / `strokePath()` / `fillStyle(color, alpha)` / `lineStyle(w, color, alpha)`
- 颜色是 **number（0xFF0000）还是 string（'#FF0000'）**？
  drawlist 解析出来是 hex 字符串，如果需要 number 则要做一次转换。
- `Graphics` 对象能否被复用来画多个实体，还是一个实体一个？
  （关系到 Q15「手写固定」的 renderer 怎么写。）

**如果 `Graphics` 不够用**（比如没有 `bezierCurveTo`），备选路径是
「离屏 Canvas2D 画好 → `game.textures.addCanvas()` → `this.add.image()`」。
Canvas2D 这条路**已被原型实测验证**（原型就是用 Canvas2D 渲染的），
所以这不会推翻票 05 的决策 —— 但会改变 renderer 的实现方式，需要尽早知道。

顺带：第 6 条（程序化触发输入）与第 3 条（`displayWidth` vs `getBounds()`）
现在更重要了 —— drawlist 的静态包围盒是**凸包上界**，
而 `getBounds()` 是渲染后的**真实**包围盒，两者会有小差异。
Visual QA 需要知道这个差异有多大，才能设容差。
