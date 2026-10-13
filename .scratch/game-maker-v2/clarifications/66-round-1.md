# 票 66 · 第一轮问题
## MCP 的 `build_asset_pack` 拿不到生图凭据 —— 怎么修、怎么测

**立案现场**（票 50 施工时撞见 · **读出来的**）：一个**活着的**上游桩（HTTP 200 · 一张**完全合法**的
16×16 全透明 PNG）+ `GAME_MAKER_IMAGE_*` 四样设全 ⇒ 走 mcp 的真 stdio 服务发一条 `tools/call`：

```
tools/call build_asset_pack { recipePath: <assets:[{source:{kind:"image"}}] 的清单> }
→ isError: true · _exitCode: 2（usage） · structuredContent: undefined
→ "✗ 这份清单里有 source.kind=\"image\" 的资源，但**没配生图凭据** ——
    写 game-maker.local.json（已 gitignore）或设 GAME_MAKER_IMAGE_* 环境变量。"
→ ⚠️ 桩被打了 **0 发**（不是「请求失败」，是**根本没发出去**）
```

⚠️ 三件事一起看才说明问题：**退 2**（usage，不是上游 3、不是判断 1）· **桩 0 发** ·
**那句 advice 说的正是已经做完的事**（变量已设、桩就在那儿）。
⚠️ **同一个桩、同一份清单，CLI 走得通**（退出码 1 · 账上有那一笔 · 现场在盘上）⇒
差别不在凭据、不在清单、不在上游，**只在壳**。

**病因**（一行）：`packages/mcp/src/server.ts` 七条工具里**只有 `create_game` 把它递下去**：

| 位置 | 工具 | 递没递 |
|---|---|---|
| `:238-244` | **`build_asset_pack`** | ❌ **没有** —— 只有 `recipePath`/`outRoot`/`transport`（**文字**那一路）/`onProgress` |
| `:272` | `create_game` | ✅ `...(imageTransportOf() === undefined ? {} : { imageTransport: imageTransportOf()! })` |
| `:65-67` | （`imageTransportOf()` 本身） | 它今天**只被 `create_game` 那一处用** |

而它是**必需品**：`ops.ts:1375` 的判据逐字是 `needsImage && !opts.imageTransport` ⇒
**在发出第一发之前**拒掉 ⇒ **`build_asset_pack` 对「真生图」这一类清单彻底不可用**，
而真生图正是你会去调它的原因。

**它为什么活到今天**：`packages/mcp/tests/server.test.ts` 的「工具调用」那组（`:93-118`，3 条）
只驱动 `inspect_asset_pack`（×2）与 `verify_asset_pack` 的 **usage/2** ⇒
`build_asset_pack` 在测试里**只被当字符串读过**（`:69` 工具名清单 · `:77` description 断言），
**从没被调用过**。⚠️ 而「补一条断言它退 2 的测试」是把 bug 钉成规矩 ⇒ 修与测要一起来。

---

## 一、要裁的三件

### ❓ Q1 — 修法

- **(a) 就在 `build_asset_pack` 那一处补，调现成的 `imageTransportOf()`**（与 `create_game:272` 逐字同形）。
- **(b) 再多走一步**：把 `...(imageTransportOf() === undefined ? {} : { imageTransport: imageTransportOf()! })`
  这段收成 MCP 侧的一个小助手，两处共用 —— 今天**只省一次重复**（两处，不是三处），
  但下一个需要生图的工具不必再抄第三遍。
- **(c) 往前挪一层**：把解析挪进 core（`packAssets` 自己 `resolveImageTransport`），两个壳都不再管凭据 ——
  ⚠️ 代价：**把「读配置文件」塞进 core**（core 至今不读那个文件）、并会**改变 CLI 的 warning 行为**
  （`cli.ts:508` 那两行 `img.warnings`），还可能牵动票 16 的前提（凭据由调用方给）。

➡️ **推荐 (a)**。理由：最小改动、与 `create_game` 那一处逐字同形、
且 `imageTransportOf()` **本来就是那个单一真相**（不是新写一份解析）。
⚠️ (c) **不是**「更干净」：壳替调用方读文件是**票 16 的有意设计**，本票不借一处 bug 把它推翻。

### ❓ Q2 — 那条 message 要不要改口

今天它的判据是 `!opts.imageTransport`（=「**这一次调用没被递到**」），而文案写的是「**你没配**」。
⇒ **在壳的 bug 修掉之后**，它唯一的触发条件就变成「调用方**真**没配」⇒ 文案**自洽**。

- **(a) 不动**：修掉 §2 那一行之后，这句话不再有误导的对象。⚠️ 代价：将来**任何**壳再把凭据吞掉，
  用户拿到的还是这句「你没配」（**症状仍然被误报**）。
- **(b) 改口**：把「没配」拆成两档 —— 但那两档**在 core 里分不开**（core 只看得到 `opts` 里没有），
  要分开就得**调用方在抛之前自己判断**（壳那一侧的事）⇒ 本票若选 (b)，落点在**壳**，不在 `ops.ts`。
- **(c) 别的。**

➡️ **推荐 (a)**。理由：本票是**修一处缺陷**，不是**给壳加一层自检**；
「壳吞凭据」这类 bug 的正确防线是**判据**（票 50 那条见证 + 本票的判据），不是文案。
⚠️ 但这一条**请明确裁一句** —— 不然下一个撞上同样症状的人会再来问一次。

### ❓ Q3 — MCP 的壳级见证怎么写（⚠️ **这一问直接挡着票 50**）

CLI 有 `deps.env` / `deps.fetchImpl`（票 16 开的注入口）；**MCP 一条都没有** ——
`handle(msg, emit)` 只读 `process.env` / `process.cwd()`。已核实：**它是在调用那一刻读的**
（`imageTransportOf()` 与各 `case` 里的 `process.env.ANTHROPIC_*` 都在函数体内）⇒
**测试里 save/restore 进程环境确实驱动得动它**。

- **(a) 不改 MCP 的形状**：判据自己在测试里 save/restore `process.env`。
  ⚠️ 有先例：`cli.test.ts` 的 `withDeadUpstream` 就是改进程全局的（票 01 那组）。
- **(b) 给 MCP 开一道与 CLI 同形的注入口**（`handle(msg, emit, deps?)`）—— 更干净、与 CLI 对称，
  但改的是**生产代码的形状**（且会牵出「deps 里都该有什么」这一串），
  ⚠️ 而票 16 当初**只给了 CLI**，MCP 至今没有，这个不对称**本身没被裁过**。
- **(c) 别的。**

➡️ **推荐 (a)**。理由：**判据的需要不必重画生产代码的形状**；
而 (b) 那个不对称（CLI 有注入口、MCP 没有）**值得单独裁一次**，
但它是**另一件事**（「MCP 的可测性」），不该塞进这张修 bug 的票 —— 若要，(b) 请**另立一票**。
⚠️ 无论选哪个：**MCP 那条见证要等 Q1 的修落地才写得出来**（今天它连生图那一步都到不了）。

---

## 二、这张票的边界（不裁也会照做）

只出决定 —— **修与测随裁定另起施工**（**立票 ≠ 批准施工**，与票 65 同款）·
零付费（立案证据喂的是**本地桩**，一笔上游调用都没有）· 不动提示词 · 不动契约 · 不动 R 表 ·
不动 `packages/qa` · `game-maker.local.json` **一个字不动** · 不借本票扩大票 50 的范围。

---

## 裁定表（填这一张）

| 题 | 我的推荐 | 你的裁定 |
|---|---|---|
| **Q1** 修法 | **(a)** 就在 `build_asset_pack` 那一处补，调现成的 `imageTransportOf()` | |
| **Q2** 那条 message 改不改口 | **(a) 不动**（修完之后它只对「真没配」响） | |
| **Q3** MCP 的壳级见证怎么写 | **(a)** 判据自己 save/restore `process.env`，不改 MCP 的形状 | |

（若某题的裁定是**选项之外**的第三条路，直接写在第 3 列；有**补充裁定**或**边界**，
另起一段写在表下面 —— 我会把你的原话**逐字**抄进票 66 的 `## Answer`。）
