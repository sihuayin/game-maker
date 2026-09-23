# 02. Phaser 3 的插件系统能否支撑一个「自动采集」的 Runtime Bridge？

Type: research
Status: open
Blocked by: —
Map: ../map.md

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
