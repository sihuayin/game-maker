# 84. 塔防 `hud.panel` 的世界尺那一条 —— 票 83 落地之后它**已可证冗余**

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 人裁（2026-10-14）原话逐字：
> 「关票 ,并立票处理 `td-config.ts:542` 那条已可证冗余的世界尺」
> ⚠️ **立票 ≠ 批准施工**（[票 65](65-layer-coverage-at-config.md) / [票 80](80-hud-panel-world-ruler-removal.md)
> / [票 82](82-hud-anchor-convention-ownership.md) 先例逐字沿用）：**本票面只把现场与落点落成文字** ——
> 删一行代码仍要**另一次独立点头**，而人裁那句「处理」**没有**指定怎么处理。
> ⚠️ 本票是[票 83](83-td-world-equals-viewport-and-pokeout.md) **施工记录 §4 第 3 条**记下的那个
> 「下一张票的现成候选」——票 83 的边界写着「不许扩大」，所以它当时**只记一句、不代裁**。

## Question

塔防 `hud.panel` 的盒子今天被**两条尺子**量 —— 而其中一条（世界尺）是另一条（视口尺）的**真子集**。
这件事在票 83 落地之前还说不死，落地之后就可以证了。要裁的是：**到底拆不拆、拆成哪种形状。**

⚠️ 与横版那一次（[票 80](80-hud-panel-world-ruler-removal.md)）的**关键差别**：
那一次人裁**already** 说了「只移除横版 `game-config.ts` 中 `hud.panel` 的 `inWorld(...)` 检查」——
判决是现成的，票 80 只是把它落成施工范围。
**本票没有那句判决**：人裁说的是「处理」，而「处理」不是「删」。
⇒ 本票先把「可证」那部分量实，把「怎么处理」摆成选项，**留给裁定**。

## 1 · 今天量到的（**探针实测**，不是推的）

### 1.1 ⭐ 那一行**零判据** —— 禁用整行，全仓一条都不红

**探针**（人裁「立票」时当场量的，本轮**重跑了一次**、含 `pnpm build` 让 `dist` 跟上）：

```text
改：packages/contracts/src/td-config.ts:542
    if (hudPanel) inWorld("hud.panel", entityBox(config.hud.panel.at, config.hud.panel.size, hudPanel.anchor));
    → 整行注释掉
跑：pnpm build && pnpm test（TMPDIR=/Volumes/shy/.gm-test-tmp）
读：83 files / 1435 tests  全绿 · Duration 12.12s
还原：md5 与备份一致（7a4e8184…）· `grep -c PROBE-84` → 0 · 重新 build 让 dist 回到正确状态
```

⚠️ **对照鲜明**：[票 80](80-hud-panel-world-ruler-removal.md) 删横版那一行时红了**四处断言**
（那条票的 §3 逐条列着）。⇒ 塔防这一行**今天没有一只手按着它** ——
谁删它、谁改它、谁把它写错，**套件一片绿**。
⚠️ 这正是票 83 §3.2 诊断过的那个病的**同一张脸的第三例**（「加判据不会自带判据」的孪生：
「**删**判据也不会有判据叫」）。

### 1.2 两条尺子量的是**同一个盒子、同一组边界** —— 而世界尺更弱

| | 世界尺（`:542` · 墙内） | 视口尺（`auditScreenSpace` · 墙外） |
| --- | --- | --- |
| 算式 | `entityBox(config.hud.panel.at, config.hud.panel.size, hudPanel.anchor)` | `entityBox(hud.panel.at, hud.panel.size, anchorOf(manifest, hud.panel.asset))`（`screen-space.ts:115`） |
| 越界判据 | `b.x<0 \|\| b.y<0 \|\| b.x+b.w>W \|\| b.y+b.h>H`（`td-config.ts:446`） | `b.x<0 \|\| b.y<0 \|\| b.x+b.w>viewport.w \|\| b.y+b.h>viewport.h`（`screen-space.ts:56`） |
| 严重度 | `error` | `error` |
| ⚠️ 守卫 | **`if (hudPanel)`** —— 资源解不到就**整条跳过** | 无守卫：`anchorOf` 缺席时退 `FALLBACK_ANCHOR`（`{0.5,1}`），**照报** |

⚠️ **票 62 量过**这两条走的是同一个 `entityBox`（当时是为横版量的，塔防是同一对函数）——
票 83 施工记录里也照此写。⇒ **同一个盒子、同一组边、同一个严重度**：
唯一的差别是拿哪个常量去比（`W/H` 还是 `viewport.w/h`）。

⭐ **而票 83 把那个差别消掉了**：`auditTdWorldSize` 判**硬失败**除非 `world.size` 逐字等于视口
（`td-config.ts:627`，`error`）。⇒ **任何走完校验的配置都满足 `W == viewport.w && H == viewport.h`**
⇒ 两条判据在**活着的配置上**是**同一个谓词**。

⚠️ **而 `:542` 那点「更弱」也证得出说不死**：它比视口尺**少**一个守卫的反面 ——
资源解不到时它整条不发话，而**同一个资源**已经被上面 `:428` 的 `ref("hud.panel", …)`
以「包里没有资源」判死了。⇒ 它**不可能比视口尺多报出任何一个盒子**。

### 1.3 两个生产调用者**都**在紧挨着跑那两条更该跑的判据

`auditTdConfig` 全仓**只有两个**生产调用点（`grep` 读数，非测试、非 `dist`）：

| 调用点 | 紧邻的兄弟（同一张 `all` / 同一个 `auditOf` 里） |
| --- | --- |
| `packages/assets/src/ops.ts:1115`（编译期） | `:1117` `auditTdWorldSize(vp, c)` · `:1119` `auditScreenSpace(vp, tdHudScreenItems(...))` |
| `packages/demo/src/td/site.ts:142`（装配期） | `:143` `auditTdWorldSize(VIEWPORT, config)` · `:130`…`:144` `screenIssues` |

⚠️ **没有第三个消费者**：`packages/qa` / `vision` / `game-design` 一处都不调它；
`contracts/src/config-tool.ts` 只提 `auditGameConfig`（**横版**），不碰塔防。
⇒ **`:542` 今天是一个「在这个仓库里永远不可能是唯一说话的那条」的判据。**

### 1.4 盘上 **18/18** 份 td-config：世界都等于视口，两条尺子一处都不报

**读数**（扫 `out/**/td-config*.json`，18 份）：
`world.size` **18/18 都是 `480×270`**，`hud.panel` **18/18 都是 `at (0,0) · size 480×30`**
⇒ 世界尺报 **0** 处 · 视口尺（粗算）报 **0** 处。
⚠️ 也就是说：**拆掉它，盘上没有任何一份产物的判决会变**（本条与 1.1 的探针互证）。

### 1.5 ⚠️ 一处**不对称**：塔防 HUD 五个成员，只有 `hud.panel` 拿了两条尺

`auditScreenSpace` 那一族经 `tdHudScreenItems`（`screen-space.ts:110`）覆盖**五个**成员：
`hud.panel` · `hud.start` · `hud.buttons[…每座塔一个]` · `hud.icons.*` · `hud.readout`（唯一纯文字、只有高度）。
而 `td-config.ts` 的 `inWorld`（世界尺）**只碰一个**：`:542` 的 `hud.panel`。
⇒ **同一个 `hud` 对象里，一个成员被量两遍、四个成员被量一遍** —— 而这一半的**理由今天写不出来**
（横版那一侧 [票 80](80-hud-panel-world-ruler-removal.md) 已经把它删掉了；
[票 63](63-hud-panel-size-not-reconciled.md) 的 Q6 立的正是「不能只修横版、而让塔防保留无条件例外」）。

### 1.6 这一行**不是**全场唯一的世界尺 —— 它的三个邻居两个都不动

`auditTdConfig` 里 `inWorld` 一共三个调用点：

```text
:512  inWorld(`slot "${s.id}"`, slotBoxes[i]!.box)     ← 世界尺是它**唯一**的尺子（不动）
:540  inWorld("core", entityBox(coreAt, …))            ← 同上（不动）
:542  inWorld("hud.panel", entityBox(…))               ← ⚠️ 只有它有第二条尺子（本票）
```

⚠️ 与[票 80](80-hud-panel-world-ruler-removal.md) 的边界逐字同款：「**不得删除世界尺本身**，
也**不得影响其他世界空间对象的检查**」—— `inWorld` 的定义、`W`/`H`、`:512` `:540` **一个字不许动**。

## 2 · 要裁决的（此处只列，**本票不预先指定**）

1. ⭐ **拆，还是留？**
   - (甲) **删 `:542` 那一行**（与[票 80](80-hud-panel-world-ruler-removal.md) 横版同款），
     在原地留一段注释说明「它的尺子归视口尺，而世界 == 视口由 `auditTdWorldSize` 钉着」。
     ⇒ 代价照实说：那一行**今天零判据**（§1.1）⇒ **删它不会红任何东西**，
     所以**必须先补判据再拆**（与票 80 的四处断言、票 83 的六条探针同一条纪律）。
   - (乙) **留着不动**，补一条判据钉住「它今天恒等于视口尺那一半」+ 注释写明理由
     （票 83 §4.3 当时选的就是这个：**只记一句，不代裁**）。
   - (丙) 别的形状（例如把两条尺子**合并**成一处，或让世界尺只在**横版**存在）。
2. **若拆：判据补在哪？** 「删掉世界尺之后 `hud.panel` 仍被视口尺看着」这件事，
   今天**没有一条测试**钉得住（§1.1）。⇒ 是先补「视口尺会挡住 `hud.panel` 跑出屏幕」，
   还是先补「世界尺不在了」这类**结构**断言？
   ⚠️ **票 80 的前车之鉴**：它删横版那一行之后，四处断言是**改成验证视口判据**的，
   不是删掉——那条纪律要不要逐字沿用？
3. ⚠️ **`W` / `H` 会不会因此变成死变量？** `:435` 的 `const { w: W, h: H } = config.world.size;`
   今天被 `:512` `:540` `:542` **三处**用着 ⇒ 拆掉一处**还剩两处**，不会变死。
   ⇒ 看起来是安全的，但**要当场核一次**（票 83 就栽在「以为安全、其实是死代码」的那个 `const V` 上）。
4. ⚠️ **§1.5 那处不对称要不要一并裁？**
   塔防 HUD 五个成员里只有 `hud.panel` 有双尺 ——
   是「本来就只该给面板」（那要说出**为什么**），还是「另外四个漏了」（那就是加判据不是删判据）。
   ⇒ **要么单独裁一句，要么明确记下「不裁」** —— 不能就这么悬着。
   ⚠️ 而这一问**可能**与[票 82](82-hud-anchor-convention-ownership.md)（HUD 锚点约定归谁管）咬合：
   锚点决定盒子的形状，而两条尺子量的是**同一个**盒子 ⇒ 锚点错了**两条一起错**。
5. **报文怎么办？** `:542` 的报文（`落在世界之外（世界 ${W}×${H}；…）`）与视口尺的
   （`HUD 活在**屏幕空间**，必须整个落在视口 …；⚠️ 尺子是**视口**不是 world.size`）
   **说的是同一件事的两套话**。拆掉之后只剩一套 ⇒ 要不要顺手核对「留下的那一套话说得对不对」？

## 3 · 边界（本票**不做**）

- **不动 `:512` `:540`**（`slot` / `core` 的世界尺是它们**唯一**的尺子）·
  **不动 `inWorld` 的定义** · **不动 `:435` 的 `W`/`H`** —— 票 80 边界逐字沿用。
- **不动横版**：`packages/contracts/src/game-config.ts` 与 `packages/demo/src/site.ts` 一字不动。
- **不动 `screen-space.ts`** · **不动 `tdHudScreenItems`** · **不动 `auditTdWorldSize`**（票 83 刚落的那条）。
- **不合并两份 `inWorld`** —— 票 81 的 **Q2 顺延**（人裁边界 3：等落定后再判是否同义）。
- **不改其他世界空间对象的检查**（人裁边界 5 逐字）。
- **不动 R 表** · **不改提示词** · `packages/qa` 判据一行不碰 · `game-maker.local.json` 一个字不动 ·
  **不执行任何付费真跑** · **不提交**。
- ⚠️ **本票与[票 82](82-hud-anchor-convention-ownership.md) 分开**（锚点约定归它）
  —— 而 §2.4 那一问**可能**要等它先裁，见 §2.4 的 ⚠️。

## 4 · 验收（今天写得出来的部分）

1. ⭐ **§2 那几问有逐字裁定**（拆 / 留 / 别的形状，以及 §2.4 那处不对称裁不裁）。
2. **若裁的是「拆」**：先补判据、再拆 —— 且**实测一次证伪**
   （把新补的判据弄坏，那条测试**当场红**；票 83 §6.1 逐字沿用）。
3. **`grep -n 'inWorld(' packages/contracts/src/td-config.ts` 的读数**
   与裁定的形状**逐字对得上**（拆了就是两处、留就是三处）。
4. 五闸全绿（`test` / `typecheck` / `check:deps` / `check:links` / `build`）。

⚠️ **免费证不了的**（票 83 那一条**照旧没证**，本票**也不会**把它变成已证）：
加了尺寸约束之后**真跑**会不会拒掉本来该过的塔防配置 ——
那要一次真跑（**票 23**，另出报告 + **逐次明确同意**）。
⚠️ 而盘上**塔防一个真跑产物都没有**（票 81 §2.5 量的）—— §1.4 扫的那 18 份**全是装配/实验产物**，
**不是模型写的**。⇒ 两条尺子今天**都没盖过一个真产物**。
