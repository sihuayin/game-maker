# 03 · 动画帧底部地面线清理 —— 施工报告（2026-10-20）

零付费施工。输入是最终包的 raw（`style-migration-v1/runs/2026-10-19k-patch/authoring/generated/`）
与票 06 的 34 色 `stylespec.json`；输出是 `pack/v6`。**0 张生图 · 0 次文本上游 · 0 条 ledger。**

## 路线比较（票面要求先比较 ① / ②）

### ① 提示词约束（下次生成）

- 只能在**未来付费跑**里生效；已经买回来的 61 张 raw 一张都救不了。
- 效果无法在不花钱的前提下验证 —— 本票的验收要的是「现在这张联系表上没有线」。
- 过去几次真跑已经量到：模型对「画布比例 / 一行动作」这类硬约束都会漂（见 style-migration-v1 的票 05/12–16），
  一条新的软约束没有理由更可信。
- ⇒ **不选**。可以留作未来提示词的 belt-and-braces，但本票不预授权任何付费验证。

### ② 零付费后处理（选中）

- 在 `importFrames` 里、`dropDetachedSpecks` 与**并集裁框之前**，按 alpha 判据识别并删掉底部的细横线。
- 确定性、可单测、零成本，能修**已经买回来的 raw**。
- 判据与实测量（`2026-10-19k-patch` 的 61 张动画 raw）：

| 量 | 实测 |
| --- | --- |
| 命中帧 | **30 / 61**（scavenger 15 = 除 `jump2` 外全部；wasteland-enemy 15 = 全部） |
| 线的位置 | scavenger `y=1137–1142`（5 行）；enemy `y=993–997`（5 行） |
| 线所在行的覆盖率 | **0.30–0.77 × 宽**（最窄 `patrol2` = 0.058 跳变；最宽 0.77） |
| 脚所在行的覆盖率 | **0.16–0.25 × 宽** |
| 线的高度 | **5 px**（`maxRows` 默认按图高 1% 取：1184→12、1024→11） |

⚠️ **为什么不能复用 `dropDetachedSpecks`**：
- 线常常**贴着脚**（和主体 4 连通），「孤立」判据够不着；
- 即使线是分离的，它的包围盒也会和主体包围盒相交（x 方向），`dropDetachedSpecks` 的
  「不相交」条件同样放不过它；
- 放宽碎片阈值既会丢真饰件，也违反票面「不放宽单帧碎片阈值」的边界。

⚠️ **为什么不能只看绝对覆盖率**：`jump2` 的身体整段都 ≥ 0.4 × 宽 —— 只看覆盖率会把它当线。
判据因此取「**行覆盖突然跳高** + 薄」：从 ink 底边往上找
`覆盖(y) − 覆盖(y−1) ≥ 0.04 × 宽` 的第一段，且它到线底每行都 ≥ `0.28 × 宽`、总高 ≤ `maxRows`。

## 施工

- `packages/assets/src/image.ts`：新增 `dropBottomGroundLines()`。
- `packages/assets/src/import.ts`：新增 `ImportOptions.dropBottomLines`（**默认 false**）；
  在 `importFrames` 里先删地面线、再删碎点、最后算并集裁框。
- `packages/assets/src/pack.ts`：只对 **非背景的动画** 传 `dropBottomLines: true`。
  单帧道具（地形块 / 废墟）不碰 —— 它们的底边可能就是内容（实测 `hazard-terrain` 底部有 2 行满宽边框）。
- **脚部保护**：只删「正上方没有墨」的像素（逐行从上往下）。贴脚的那一小段会留下，
  成为脚底的延伸，而不是把脚切掉。→ 「脚部完整」是结构性保证，不是靠阈值调出来的。
- 不动 `dropDetachedSpecks` 的阈值，不动其他判据。

## 测试

新增 `packages/assets/tests/groundline.test.ts`（6 条）：

1. 贴脚的细横线被删、脚部像素一个不少；
2. 虚线（多段）整段删；
3. 宽身体 / 厚底座不是地面线（原样返回）；
4. 没有线时原样返回（同一对象）；
5. 最底一行的抗锯齿残边不影响识别；
6. `importFrames` 的并集包围盒不再被地面线拉高（被压小的帧恢复）。

全量：**105 文件 / 1640 条全绿**（+1 文件 / +6 条）。

## 重建（零付费）

- 脚本：`run-groundline.mjs`（`reuseFrom = 2026-10-19k-patch`，`generate` / `generateImage` 都是**抛错桩**）。
- 色板：34 色（票 06 的 `stylespec.json`，`#59503b` / `#50432b` 两个橄榄槽在末尾）。
- 包：`ruin-scavenger-extraction-assets/pack/v6/`
- `verifyPack` **ok**（0 problems）· 19 资源 · **61 个动画帧**（总 76 帧，与 v4 同）·
  `imageCalls = 0` · `ledgerCalls = 0`。
- 复现：`pnpm build`，然后在本目录 `PACK_VERSION=6 node run-groundline.mjs`
  （两个上游桩都会抛；`reuseFrom` 缺文件会当场失败）。

## 观感 / 证据

- **联系表**：`evidence/contact-sheet-v6-1600.png` —— 无地面线 / 虚线；底部独走一遍窄条扫描，
  只剩水桶、废料堆、潜伏者脚、撤离点废墟这些**本来就是内容**的宽底，没有线。
- **raw 上的线**：`evidence/rawbottom-scavenger-actor.png`、`evidence/rawbottom-wasteland-enemy.png`。
- **v4 / v6 对照**：`evidence/compare-v4-idle-jump.png` / `compare-v6-idle-jump.png` ·
  `compare-v4-run.png` / `compare-v6-run.png` · `compare-v4-patrol.png` / `compare-v6-patrol.png`；
  单帧放大：`evidence/side-v4-v6-scavenger-actor.idle2.png`、`side-v4-v6-wasteland-enemy.patrol1.png`、`side-v4-v6-scavenger-actor.jump1.png`。
- `v5` 是施工中间产物（从底边向上找线顶边）；`v6` 改成从窗口最高处向下找。两者只差
  `scavenger-actor.idle4` 的 1 个像素。v5 的包体已移出 run 目录，**最终包是 v6**。
- 61 帧里（v4 → v6）**27 帧变了、34 帧逐字节相同**。变的是 scavenger 的 idle/run（jump 不变）与**全部** wasteland-enemy；
  jump / lurker / 水 / 废料 / 撤离点 / 道具全部不变。

### ⚠️ 需要人看一眼的副作用：裁框变紧 ⇒ 横向比例变化

线被从并集框里去掉后，idle / enemy 的裁框从「身体 + 线」变成「身体」：

| 帧 | v4 在 48 宽里的身体宽 | v6 |
| --- | --- | --- |
| scavenger idle1/3 | 42 px | 48 px |
| scavenger idle2/4 | 34 px | 48 px |
| wasteland-enemy patrol/halt | 42–44 px | 47–48 px |
| scavenger run | 48 px | 48 px（不变） |

⇒ v4 的 idle 帧之间本来就不一致（34 vs 42），且 idle 比 run 小；v6 让同一角色的所有动画都填满 48。
代价是「按 spec 尺寸 48×64 拉伸」这条既有行为现在**真正生效**，身体横向比 v4 宽一些。

这是「先删线、再裁框」的直接结果，也是票面写的位置。若人判定**必须保 v4 的横向比例**，
另一条路是「裁框仍按含线图算、只删像素」—— 但那样 idle 帧间的缩放不一致会留着，
且跳跃帧的底部空白也还在（本次 v4 里跳跃帧已被 `dropSpecks` 丢掉线，所以不额外变差）。
本票按票面选了前者。

**裁定（2026-10-20）：保留 v6。** 理由：地面线与头顶碎点（票 107）是同一类上游瑕疵 ——
**瑕疵不参与裁框**。v4 的 idle 帧间缩放不一致（34 vs 42）正是线参与裁框的后果；
v6 让 idle / enemy 与 run / jump 一样填满目标框，动画之间不再「站住就缩小」。
横向比例的变化是「按 spec 尺寸拉伸」这条既有行为的真实结果，不在本票里另改；
若将来要保比例，应当改 `importFrames` 的缩放策略（letterbox），而不是把线重新算进裁框。

## 未做 / 不越界

- 未改 `game-maker.local.json`；未发任何上游请求；未关票、未提交。
- `pnpm typecheck` 仍有两条**与本票无关的既有红**（`pack-sheet-grid.test.ts:150`、`prompt.test.ts:257`），未修。
