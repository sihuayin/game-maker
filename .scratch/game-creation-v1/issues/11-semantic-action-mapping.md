# 11. 语义 TestAction 到 Phaser 的映射：走不走真实输入系统？

Type: grilling
Status: open
Blocked by: 10
Map: ../map.md

## Question

文档第 18 节定了原则：不要 `click(532, 421)`，要
`{type:'interact', target:'crop.tomato.01'}`，「Runtime 再把语义目标解析成
实际游戏对象」。但**「解析成」有两种完全不同的实现**，测试语义天差地别：

- **路线 ①：直接触发内部逻辑**
  `interact('crop.tomato.01')` → Bridge 查 tag 表拿到 GameObject →
  直接调用它的 interact 回调 / 直接改它的 state。
  **快、稳定、可复现，但完全没测到输入系统。**
  如果玩家的碰撞检测坏了、交互半径设错了、键盘绑定失效了，
  路线 ① 会给出 **PASS** —— 一个虚假的 PASS。

- **路线 ②：解析成真实输入事件**
  `interact('crop.tomato.01')` → Bridge 查 tag 表拿到 GameObject 的
  屏幕坐标 → Playwright 发真实鼠标点击 / 键盘按键 →
  游戏自己的输入处理链走一遍。
  **真的测了输入系统，但慢、可能 flaky（坐标、动画时序、遮挡）。**

这直接决定 Q14 验收标准里「真的能玩到采摘番茄」的**含金量**：
路线 ① 下，一个键盘完全失灵的游戏也能拿到 Gameplay PASS。

必须 grill 出的问题：

1. **默认走哪条**？还是**两条都要**（同一个 TestAction 跑两遍，
   结果不一致就是一个 issue）？
2. **按 action 类型区分**？比如
   `move`（方向键，时序敏感）走 ②、`interact` 走 ①、
   还是反过来？逐个 action 类型定：
   move / click / press / wait / interact / select。
3. **`preconditions` 怎么落地**？`GameplayTestCaseSchema` 有
   `preconditions: TestCondition[]`（契约里退化成 `z.record(z.unknown())`）。
   「玩家已经在农场里」这种前置条件是靠 ① 直接设置状态（快、但跳过了
   到达过程），还是靠 ② 真的走过去（慢、但这才是 Critical Path 的本意）？
   文档第 33 节的 Critical Path 是
   `Boot → Move → Reach Crop → Interact → Harvest → Inventory Increase → Objective Complete`
   —— 这条链**整条都该是 ②**，否则「Move」和「Reach Crop」两步毫无意义。
4. **坐标解析**：路线 ② 需要把 `crop.tomato.01` 变成屏幕坐标。
   要考虑：camera 偏移与缩放、GameObject 的 origin、
   被其他物体遮挡怎么办、目标在视口外怎么办（要不要先 scroll/move camera）。
5. **等待与时序**：动作之间怎么等？固定 sleep（flaky）、
   等某个事件、还是等 Observation 满足某个条件？
   `wait` action 的 `duration` 是唯一显式等待手段吗？
6. **失败诊断**：路线 ② 失败时，怎么区分「游戏逻辑坏了」和
   「Playwright 没点中」？Evidence 要记什么才能让人一眼分辨？
7. **flaky 的容忍度**：Q17 把 budget 收到 3 轮 / 10 分钟。
   如果 Gameplay QA 本身 flaky，repair 循环会去修一个根本没坏的东西 —— 
   **这会让整个「自我迭代」变成噪声放大器**。
   要不要引入「同一测试跑 N 次取多数」？成本怎么算进 budget？

调用 `grilling` skill；需要看票 02 第 6 条和票 03 第 8 条的实测结论。

## Answer

_（待填）_
