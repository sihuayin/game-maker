# 80. 横版 `hud.panel` 的世界尺那一条**移除** —— 票 62 的 Q3 裁出的**独立施工票**

Type: task
Status: claimed
Owner: claude (2026-10-14)
Blocked by: —
Map: ../map.md
> 派生自[票 62](62-hud-panel-double-ruler.md) 的 **Q3 = (c)** 与随附的补充边界。人裁（2026-10-14）原话逐字：
> 「本票只作裁定，实施另立施工票。施工票**只移除横版 `game-config.ts` 中 `hud.panel` 的 `inWorld(...)` 检查**；
> 保留 `terrain[i]`、`entity`、`player.at` 的世界尺检查。塔防对应行归 Q4 的独立票处理。」
> 「施工票移除的**只有横版 `hud.panel` 那一条**世界尺检查，**不得删除世界尺本身**，
> 也**不得影响其他世界空间对象的检查**。」
> 「删除该行后，相关四处测试断言应改为**验证正确的视口判据**，而不是简单删除测试或放宽判定。」
> ⚠️ **立票 ≠ 批准施工** —— 本轮 **A3** 逐字：「57、58 按既定裁定范围施工；22 的接线和
> **62 的改动必须先经各自派生票裁定**」。**本票就是那张「各自派生票」** ⇒
> 开票只把范围落成文字；**动 `game-config.ts` 一行仍要另一次独立点头**。

## 1 · 这一票治的是什么（票 62 的读数，别重新量）

**两把尺子在量同一个盒子 —— 而其中一把是多余的。**

`hud.panel` 的盒子今天同时被两处判决：

```text
世界尺  packages/contracts/src/game-config.ts:430
        inWorld("hud.panel", boxOf(config.hud.panel.at, config.hud.panel.size, …))
        ⚠️ 它就在 auditGameConfig 里（自洽族），跟着 config 那一步跑

视口尺  packages/contracts/src/screen-space.ts:49  auditScreenSpace(viewport, items)
        ⚠️ **它不在 auditGameConfig 里** —— 它在编译/装配那一层被调用：
        packages/assets/src/ops.ts:916 · packages/demo/src/site.ts:210 · packages/demo/src/td/site.ts:111
        ⇒ 视口是**调用方传进去的**，契约里没有视口常量
```

⚠️ **两条算的是同一个盒子**：都走 `entityBox(at, size, anchor)`（横版那份在 `game-config.ts:107`，
视口那份在 `screen-space.ts:89` 的 `gameHudScreenItems` 里）。所以报文里那个 `(x,y) w×h` 一字不差，
**读现场的人会以为是同一条判据说两遍**。

票 62 的补充裁定把判决关系写死成一句：

> 「真跑中，世界尺报告的上边界问题与视口尺重复；**负 `x` 越界只由视口尺报告**。」

⇒ 删掉世界尺那一行**不是**让 `hud.panel` 没人管，而是让它**只剩视口尺管**——
而视口尺**更严**（`screen-space.ts:56` 查四条边，含负数）。

## 2 · 要改的那一行（**只有一行**）

| 行 | 今天的内容 | 处置 |
| --- | --- | --- |
| `game-config.ts:399` | `const { w: W, h: H } = config.world.size;` | **不动** |
| `game-config.ts:423-426` | `inWorld` 的定义（`:424` 只查远端两条边 `b.x+b.w > W \|\| b.y+b.h > H`） | **不动** |
| `game-config.ts:425` | 报文逐字 `落在世界之外（世界 ${W}×${H}；这个盒子是 (${b.x},${b.y}) ${b.w}×${b.h}）` | **不动** |
| `game-config.ts:427` | `inWorld(\`terrain[${i}]\`, t)` | **不动** |
| `game-config.ts:428` | `inWorld(\`entity "${e.id}"\`, boxOf(…))` | **不动** |
| `game-config.ts:429` | `inWorld("player.at", boxOf(…)` | **不动** |
| **`game-config.ts:430`** | **`inWorld("hud.panel", boxOf(config.hud.panel.at, …))`** | ⛔ **删这一行** |

⚠️ **「只有一行」是字面意思**：人裁原话「**不得删除世界尺本身**，也不得影响其他世界空间对象的检查」
⇒ `inWorld` 的定义、`W`/`H`、以及上面那三个调用点**一个字都不许动**。

**可核的读数**（施工完成的第 ① ② 条，见 §6）：

```bash
grep -n "inWorld(" packages/contracts/src/game-config.ts
# 今天：4 处（全是调用：:427 :428 :429 :430）
# 施工后：3 处（:427 :428 :429）—— 定义那一行写的是 `inWorld = (…`，不含 `inWorld(` 这个子串
```

## 3 · 会红的四处断言 —— 逐处核过，**其中两处根本不是 HUD 测试**

| # | 位置 | 它属于哪条 `it` | 输入 | 删掉 `:430` 之后 |
| --- | --- | --- | --- | --- |
| ① | `packages/contracts/tests/game-config.test.ts:259` | `:249`「**锚点决定盒子从哪边长**……（这条是锚点语义的守门人）」 | `:255` `at {x:8,y:262}` 期望**无错** · `:258` `at {x:8,y:271}` 期望 `/hud\.panel.*世界之外/` | **红**（`:255` 那一半仍绿，`:259` 那一半没了） |
| ② | `packages/contracts/tests/game-config.test.ts:265` | `:262`「HUD 面板自己也要落在世界内」 | `:264` `at {x:1440,y:262}` | **红** |
| ③ | `packages/contracts/tests/reachability.test.ts:196` | `:193`「⚠️ 而**自洽族不进 `auditReferences`**」 | `:194` `at {x:9999,y:262}` | **红** |
| ④ | `packages/qa/tests/gameplay.test.ts:113` | `:103`「把 HUD 面板扔到世界外 ⇒ `reference-resolution` **一声不响**」 | `:105` 同形 | **红** |

⚠️ **一处与人裁措辞的差异（照实说，供下一轮核对）**：人裁说「相关**四处**测试断言应改为验证正确的视口判据」。
**前两处（①②）逐字成立** —— 它们确实是在测 HUD 落位；
**后两处（③④）不是 HUD 的测试** —— 它们是票 18「**引用族只吃引用族**」那条分工的**反证**，
`hud.panel` 在那里只是**证人**（当时唯一一个能**只踩自洽族、不踩引用族**的输入）。
⇒ 那两处**不该**改成视口判据（改了就等于把那条命题的证据换掉了），该做的是**换一个证人**：
换成一个同样只踩自洽族的输入（`game-config.test.ts:225` 走 `terrain`、`:246` 走 `entity`，
两个现成的先例）。⚠️ **换哪一个是施工轮拍板的事，本票不预先指定。**

⚠️ **①另有一层，而它有个好消息**：它守的是**锚点语义**（盒子从 `at` **往上长**，不是往下），
而 `hud.panel` 在那个夹具里是**唯一**锚点 `{x:0,y:1}`（左下角）的资源。
**改成视口判据它照样守得住** —— `gameHudScreenItems`（`screen-space.ts:86`）用的是**同一个**
`entityBox(panel.at, panel.size, anchorOf(manifest, panel.asset))`（`:89`）
⇒ 「盒子从哪边长」这条性质在视口尺那边**被算到同一步**。**⇒ ① 可以照人裁改。**

⚠️ **旁证但不会红**（核过，别把它们算进「四处」）：`assets/tests/compile-runtime.test.ts:125`
（输入 `:123` `at {x:1000,…}` —— `1000+72 ≤ 1440`，**世界尺在它上面本来就不响**）·
`demo/tests/site.test.ts:127` · `demo/tests/td-site.test.ts:154` · `reachability.test.ts:182-191`
（它**只断 prefix 相等**，删了那行照样绿 —— **只有 `:185` 那句注释会烂掉**）。

## 4 · 施工前要拍板的（⚠️ 没有一件是「照做」就完的）

1. **③④ 换哪个证人**（§3 那两格）—— 换 `terrain` 还是 `entity`，本票**不预先指定**。
2. **视口从哪来**：`auditScreenSpace` 要调用方传 `viewport`，而 `packages/contracts` **里没有**视口常量
   （`{w:480,h:270}` 那个住在 `packages/demo/src/draw.ts:15` 的 `VIEWPORT`）。
   ⇒ 契约那一层新写的断言，视口值是**就地写一个常量**、还是从别处引 —— **今天没有现成答案**。
3. **② 怎么改**：它那个 `it` 用的是 `errs()`（跑 `auditGameConfig` 的 helper），换成视口判据就要换整串调用
   （`auditScreenSpace(viewport, gameHudScreenItems(config, manifest, { lineHeight }))`）。
   是**在同一个 `it` 里换函数**，还是**把它挪进 `screen-space` 的测试文件**？**本票不预先指定**。
4. ⚠️ **塔防那条不许顺手改**：`hud.panel` 在塔防那侧**另有一条世界尺**（`packages/contracts/src/td-config.ts:542`），
   人裁把它**明确划给票 81**（「塔防对应行归 Q4 的独立票处理」）。
5. ⚠️ **一条今天量到的、与本票相邻的空白**：塔防那条硬失败**完全没有判据看着**
   （`grep 世界之外` 在 `packages/*/tests` 里只命中横版那几处）——
   那是**票 81 的现场**，本票只是把它记在这儿，**不动它**。

## 5 · 边界（本票**不做**）

- **只删 `game-config.ts:430` 那一行**；`inWorld` 的定义、`W`/`H`、`:427`/`:428`/`:429` 一字不动。
- **不碰塔防**（`td-config.ts` 一行不改 —— 那是[票 81](81-world-ruler-semantics-differences.md)）。
- **不碰装配期**（`packages/demo/src/site.ts:133` 的 `pokeOut`、`packages/demo/src/td/site.ts:40` 不动）。
- **不碰视口尺本身**（`screen-space.ts` 一行不改 —— 本票只是把断言**指向**它）。
- **不碰 `packages/qa` 的判据**（只改它那一处测试）。
- **不动 R 表** · **不改提示词一行** · `game-maker.local.json` 一个字不动 ·
  **不执行任何付费真跑** · **不提交** · **不关票**。
- ⚠️ **与[票 81](81-world-ruler-semantics-differences.md) / [票 82](82-hud-anchor-convention-ownership.md)
  分开**（本轮 **A1** 逐字：「五个议题分别立票，保留各自边界，不合并成一张大票」·「每张独立裁定」）。

## 6 · 验收（今天写得出来的部分）

**施工完成的判据是四条，都可免费核**：

1. `game-config.ts:430` 那一行**不在**了。
2. 世界尺**本身还在**：`grep -n "inWorld(" packages/contracts/src/game-config.ts` **恰好 3 处**
   （`:427` `:428` `:429`），且 `:423-426` 那段定义与 `:399` 的 `W`/`H` 原样。
3. **四处断言一处没删、一处没放宽**，且每处仍在断言一件真事：①② 走视口判据，③④ 换了证人
   —— ⚠️ 这一条要**逐处读**，因为「改成永远为真的断法」也能骗过前两条。
4. 五闸全绿（`test` / `typecheck` / `check:deps` / `check:links` / `build`）。

⚠️ **免费证不了的**：删掉之后**真跑**还会不会在 HUD 上报重复 ——
那要一次真跑（**票 23**，另出报告 + **逐次明确同意**）。
票 62 的免费探针（`experiments/62-hud-double-ruler/`）已经把「两把尺子在 `hud.panel` 上判同一个盒子」
这件事量到了；**本票不重放它**。

---

### ✅ 施工记录（2026-10-14 · 人裁「票 80 施工」）

> ⚠️ **本节只记施工**。上面那张裁定表与本票的射程**一字未动**。
> ⚠️ **不关票** —— 「施工」不是「关票许可」。`Status` 只从 `open` 改成 `claimed`（工作已落地、未收口）。

#### 落地（逐文件）

| 文件 | 改了什么 |
| --- | --- |
| `packages/contracts/src/game-config.ts` | ⛔ **删掉那一行**（原 `:430` 的 `inWorld("hud.panel", …)`），原地换成 5 行注说明「它为什么不在这里」与「加回来自会红」 |
| `packages/contracts/tests/game-config.test.ts` | ① 改为**视口判据**（保留 `errs(ok)` 那一半）；② 改名「…落在**视口**内」并改为视口判据，**另加一条证伪性断言**；新增 `VIEWPORT` 常量与 `vpErrs()` 工具 + 3 个 import |
| `packages/contracts/tests/reachability.test.ts` | ③ 证人 `hud.panel` → `terrain`；**⚠️ 另动了一处（见「第五处」）** |
| `packages/qa/tests/gameplay.test.ts` | ④ 证人 `hud.panel` → `terrain`，`it` 名字跟着改 |

#### §4 那四问，施工时是这么拍的（逐条照实记）

1. **③④ 换哪个证人 → `terrain`**。理由不是「随便挑一个」：地形**一个资源都不引用**，
   ⇒ 「引用族一声不响」从「碰巧」变成**必然**。⚠️ 也就是说**换完之后这两条断言更硬了**，不是更软。
   （`gameplay.test.ts` 同一个 describe 里 `:117` 那条本来就用 `player.at` 当第二个证人 —— 有先例。）
2. **视口从哪来 → 测试文件里就地写一份 `VIEWPORT = {w:480,h:270}`**。
   ⚠️ 这一问施工时才量清：**契约层根本没有视口常量**，两份具名的住在
   `packages/assets/src/ops.ts:607`（`DEFAULT_VIEWPORT`）与 `packages/demo/src/draw.ts:15`（`VIEWPORT`），
   而契约**依赖不到**它们（`check:deps` 会当场拒）。⇒ 就地写 + 注明出处。
   ⚠️ **本票这一份是今天第 3 份代码字面量**（核过：`grep -rn "w: 480" packages/*/src` →
   只有 `ops.ts:607` 与 `demo/src/draw.ts:15` 两处；`prompt.ts` / `screen-space.ts` / `game-config.ts` /
   `td-config.ts` / `qa.ts` 里的「480×270」都只是**散文**，不是常量）——
   **本票不合并它们**（那是另一张票的事），只把它记在这儿。
3. **② 怎么改 → 留在同一个 `it` 里，只换被调的函数**（`auditScreenSpace` + `gameHudScreenItems`）。
   没有挪进别的测试文件 —— 那会把它和「自洽族」那张 describe 拆开，而它守的性质（盒子从哪边长）与
   ①还是同一件事。**`lineHeight` 传 `DEFAULT_HUD_LINE_HEIGHT`**（横版这条路其实用不上它，但传生产同款值）。
4. **塔防一行没碰** ✅（`td-config.ts` / `demo/src/td/site.ts` 都不在 `git diff` 里）。

#### ⚠️ 第五处（超出「四处」的一笔，如实记）

`reachability.test.ts:185`（**不在人裁点名的那四处里**，删行后它也**不会红**）里有一句注释
「同时踩**自洽族**那一条（HUD 落在世界外）」—— 删了世界尺之后这句话**变成假的**。
处置：把**那一处输入**也换成 `terrain`（注释因此保住为真），**不是**去改注释。
⇒ 这是本票动过的**第五处**，性质是「让一句注释继续为真」，**不是**放宽或删除任何断言。

#### 验收（本票 §6 的四条，逐条）

| 判据 | 读数 |
| --- | --- |
| ① 那一行不在 | `grep -n "inWorld(" packages/contracts/src/game-config.ts` → **3 处**（原为 4） |
| ② 世界尺本身完好 | 定义 `:423-426`、`W`/`H`、`:427`/`:428`/`:429` 三个调用点**原样**；`git diff` 只有 `-1 行 +5 行注` |
| ③ 四处断言一处没删、没放宽 | 逐处核过（见上表）；**且证伪性实测过**：把那一行**临时加回去**，`game-config.test.ts` 当场红 —— `expected 'hud.panel: 落在世界之外（世界 1440×270；这个盒子是 (1440,230) 72×32）' not to match /hud\.panel/`，随后**已移除** |
| ④ 五闸全绿 | 见下 |

```text
pnpm build       ✅ 干净
pnpm test        ✅ 83 files / 1426 tests   （⚠️ 见「一条环境读数」）
pnpm typecheck   ✅ 干净
pnpm check:deps  ✅ 9 个包
pnpm check:links ✅ 267 份文档 · 1484 条链接零断裂
```

⚠️ **一条环境读数（照实说）**：`pnpm build && pnpm test` 那**第一跑**报了 15 failed / 6 files
（含 `Test timed out in 5000ms`，其中一条是**本票没碰过**的干净配置用例）——
**紧接着用同一条命令重跑，以及再连跑三次，都是 83 files / 1426 tests 全绿**。
⇒ 判为**环境/负载**（测试的 `TMPDIR` 落在 `/Volumes/shy` 那块外置盘上，机器同时在建包），
**不是本票的回归**。⚠️ 本票**没有**据此改任何东西，只把这次读数记下来。

#### 没做的（照实记）

- ⚠️ **没提交**（`git status` 里这四处改动**还在工作区**）· **没关票** · **没付费真跑**。
- ⚠️ **票 81 / 票 82 一行没碰** —— 它们各自还停在自己的票面上。
- ⚠️ **免费证不了的那一件仍然没证**：删了之后**真跑**还会不会在 HUD 上报重复 ——
  那要一次真跑（**票 23**，另出报告 + **逐次明确同意**）。
