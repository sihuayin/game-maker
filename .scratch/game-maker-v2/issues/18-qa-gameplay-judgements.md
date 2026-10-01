# 18. Gameplay QA 的**判据**：引用族 + 冒烟，不做「玩法好不好」

Type: grilling
Status: open
Owner: —
Blocked by: 06, 15
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> 依据 **R3**（Q13）。`03 §22` 要检查 boot/spawn/input/movement/collision/interaction/pickup/goal/win/lose。

## Question

⚠️ **先说清楚这一票不做什么**：`game-creation-v1` 的 Out of scope 里明确推掉了整簇
**Runtime Bridge / 语义测试动作 / Playwright 玩法验证**（`map.md:1029-1033`，票 02/10/11）。
R3 那一轮**没有把它请回来** —— 判据只收「构造性约束 + 引用族 + 集合差」。

所以 §22 那十项里，**哪些不靠运行游戏就能判**？

### 1. 引用族（今天已经在跑的那一族）

`CONTEXT.md:274-284` · `:232-248`：`hud.panel` 必须是 `ui` 类 · **砖**的三条（尺寸精确等于
`arena.cell` · 锚点正中 · 是 sprite/animation）· 资源引用解得到 · 九宫格只在面板上读。
这些**全是构建期可判的**，而且**错了不会自己报错**（所以它们才够得上判据）。

要答：这一族今天散在哪（`compile-*` / `site` / `verify`）？**归拢到一个地方**还是保持散着？

### 2. 冒烟：`boot → spawn → goal` 可达

R3 的候选里写的是「冒烟：boot/spawn/goal 可达」。要答的是**它到底怎么跑**：

- **(a) 不跑游戏**：「可达」判成**图上的可达性**（玩家起点 → 终点，给定地形与实体几何）——
  ⚠️ 塔防那张图已经有一个先例：**参考玩家**（`CONTEXT.md:373-384`）——
  「一个把『这一关是通的』变成可断言的事的玩家……它不是模拟器的旁路，它就是模拟器的一个调用者」。
- **(b) 跑游戏**（Playwright / headless）—— ⚠️ 那就是把推掉的那一簇请回来，**本图不做**。

要答：横版这边**有没有**塔防那样的纯层（`packages/demo/src/world.ts` 是「一条纯函数：
`(manifest, game-config) → 场景描述`」，`CONTEXT.md:422`）—— 若有，可达性可以**在纯层上算**，
不碰浏览器。

### 3. 失败码

与票 06 §2 同一处：`GameplayQAResult` 在 `01-contracts.md` §9-12 里**只有 `QAFailureCode`**
（`GAMEPLAY_READABILITY_ERROR` / `GAMEPLAY_RUNTIME_ERROR`）。要答：这两个码够不够表达上面那两族？
⚠️ 不够就**加码**，而不是把两族硬塞进两个名字里。

## Answer

（待解）
