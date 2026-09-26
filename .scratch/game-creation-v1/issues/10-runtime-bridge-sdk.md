# 10. Runtime Bridge SDK 的 API 设计

Type: grilling
Status: resolved
Blocked by: —
Map: ../map.md

> ⛔ **已判出局**（2026-09-24，R2）。判出局的**不是问题本身，是本图的终点**：
> 它属于「QA 闭环」那一簇，回答的是「AI 能不能自己判断做得好不好并改进」，
> 而重画后的终点是「能不能产出两个可用的东西」。
> 同票 02。
>
> **文件保留、不删除** —— 里面的实测数据与分析对将来那张闭环地图仍然有效。
> 永不毕业：只有重画 Destination 才会回来，且那时是一张新地图。

## Question

Q10 决定了 Bridge 是**手写固定的 Phaser 插件 SDK**，AI 只调 `bridge.tag()`。
文档第 73 节给了接口草案：
`getState / getEntities / getPlayer / getScene / getUI / getEvents / execute`。
但草案里的返回类型全是 `unknown`（`demo/src/contracts/index.ts` 的
`RuntimeObservationSchema` 同样把 `camera/player/ui/events` 建成了
`z.record(z.unknown())`）—— **这些逃生舱必须在本票被填掉**，
否则 Observation 就是一坨没有契约的 JSON，QA 无从下手。

阻塞在票 02（Phaser 插件到底能钩到什么）和票 09（实体和交互的语义模型）。

要 grill 出的问题：

1. **Observation 的强类型化**：`RuntimeObservationSchema` 里
   `camera` / `player` / `ui` / `events` 四个 `z.record(z.unknown())`
   分别应该是什么形状？`RuntimeEventSchema` 在文档第 27 节是**有**明确
   type 枚举的（`game_started` / `scene_loaded` / `entity_spawned` / …），
   但代码里退化成 `z.array(z.record(z.unknown()))` —— 要不要按文档补回来？
2. **tag 的 API**：`bridge.tag(gameObject, semanticId)` 的确切签名。
   谁保证 semanticId 唯一？重复 tag 怎么办？
   tag 了一个之后被 destroy 的 GameObject 怎么办（内存泄漏）？
   **AI 漏 tag 怎么办** —— 这是 Q10 选 B 的核心动机，
   但如果 AI 就是漏了，系统怎么发现？
   （建议：Visual QA 数一下截图里的可见物体数 vs `getEntities()` 返回数，
   不一致就报 issue。这个要不要做？）
3. **`execute(action)` 的语义**：文档第 18 节的 `TestAction` 已在契约里
   （move / click / press / wait / interact / select）。
   `interact('crop.tomato.01')` 的实现路径取决于票 02 第 6 条的答案。
   **语义动作要不要真的走输入系统**？（票 11 专门处理这个。）
4. **事件采集的自动化程度**：Bridge 能自动采集哪些事件
   （Phaser 的 input/scene 事件），哪些必须由 AI 生成的代码显式上报
   （`objective_completed`、`item_collected` 这类**游戏语义**事件）？
   如果需要显式上报，那就给了 AI 第二个「可以漏」的点 —— 
   与 Q15「AI 只产出数据+纯函数」的精神冲突。怎么收窄？
   （可能的解法：让 Game Config 的 `effects` 声明**自动**产生事件，
   AI 完全不需要写上报代码。这依赖票 09 第 3 条。）
5. **gameState 的判定**：`booting / playing / paused / won / lost / error`
   六个状态里，`won` / `lost` 是游戏语义。由 Game Config 的胜负条件
   自动判定，还是由 AI 显式 `bridge.setGameState('won')`？
   同上，后者是一个「可以漏」的点。
6. **采样策略**：`ObservationProvider.collect(run)` 返回
   `RuntimeObservation[]`。是每帧采一次（数据量爆炸）、
   按事件采（事件驱动）、还是按测试步骤采（每个 TestAction 前后各一次）？
   `frame` 和 `timestamp` 字段的语义是什么？
7. **UI 的语义化**：`RuntimeUIElement` 完全没定义。
   Phaser 没有内建 UI 系统，游戏 UI 就是一堆 GameObject ——
   那 `ui_visible` 断言（`TestAssertionSchema` 里有）怎么判定？
8. **版本与兼容**：Bridge SDK 是 QA 的地基，一旦 AI 生成的代码依赖了
   某个版本，就不能随便改。要不要给它自己的版本号和契约测试？

调用 `grilling` 与 `domain-modeling` skill。
**产出是一份可直接实现的 SDK 接口定义（含强类型 Observation 契约）
+ 一个最小可跑的 Phaser 插件骨架**，并补全
`demo/src/contracts/index.ts` 里对应的 `z.record(z.unknown())` 逃生舱。

## Answer

_（待填）_
