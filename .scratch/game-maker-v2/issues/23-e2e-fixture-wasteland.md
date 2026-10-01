# 23. E2E fixture + 真跑一次：`fixtures/e2e/wasteland-platformer/`

Type: task
Status: open
Owner: —
Blocked by: 16, 20
Map: ../map.md
> `docs/v2/03-claude-code.md` §27/§28。**这是终点的判据本身。**

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

## Answer

（待解）
