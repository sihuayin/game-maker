# 票 55 · 第一轮问题
## `compile-design` 被拒的设计**一个字都不落盘** —— 于是真跑验不了「模型把 `player.id` 改成了什么」

**票面要答的**：`compile-design` 拒掉一份设计时，**模型那份设计（以及每次重采样的原始输出）该不该落盘？落在哪？**

**为什么非答不可**：票 23 的第八次真跑死在 `compile-design`，而它 §四.2 点名的两个验收读点**一个都读不到**
（模型把 `player.id` 改成了什么 · 第一发撞的是哪一条 `schema`）⇒ 归因从「铁证」掉到「强相关」。

---

## 一、已经量到的（不用重新量）

**失败现场这台机器**
- `abandonRun`（`packages/pipeline/src/run.ts:108-117`）**只做一次 `renameSync`** —— 把 `run.tmpDir`
  改名成 `<outRoot>/.failed-<ts>/`（`gameId` 还没定出来时）或 `<outRoot>/<gameId>/run/failed-<ts>/`。
  **改名、不删**，进程退出后仍然在。
- 它由 `create-game.ts:332-339` 的**唯一那个 catch** 调用 —— 理解段**任何**抛出都走这里，
  **不按错误类分流**（`DesignRejectedError` 只是被那个 catch 原样放过去）。
- `run.tmpDir` = `<outRoot>/.building-<pid>-<base36 时间戳>/`；各步**随步落盘**写进去；
  成功后 `commitRun` 把**整个目录** rename 成 `run/v<N>/`。
- 先例（票 36）：产物**在抛点之前**写进 staging，靠那次 rename 带出去；
  而「完整账 / 半截账」**靠目录位置分辨、不加字段**（`pack.ts:981-982` 的原话）。

**重采样那一圈**
- `structured-call.ts` 是**纯的**（无 fetch / 无重试 / 无 fs）；它的 `parseToolUse` 在**失败分支**
  只回 `{failure, detail}`，**把模型入参 `input` 丢掉**。
- `compile-design.ts:234-273`：跨发**只保留** `lastFailure`（一个枚举）+ `lastDetail`（一段格式化文字）；
  **上游 body 与模型入参都是局部变量，从不落到任何地方**。
- 两条路形状不同：**R12 的拒绝**（`kind:"rejected"`）**只走一趟、不重采样**；
  **schema 档**（`kind:"bad"`）**重采样到 3 发**，打满才抛 `CompileDesignError`。

**⚠️ 一处票面没预料到的实测 —— 它推翻 Q3 的前提**
`build-design.ts:158-176`：`kind:"rejected"` **只在 `GameDesignSpecSchema.safeParse` 成功之后**才可能返回
（`const design = parsed.data` 就在前面那一行）。
⇒ **R12 拒掉的那份，本身是一份完全合法的 `GameDesignSpec`** —— 契约连 gate 都过了，
是 `intentCoverage` / `cameraSupported` 这种「结论」否掉了它。
⇒ 票面 Q3 写的「它过不了 schema、连 `format` 都可能缺」，**只对 schema 那一档成立**。

**今天现场长什么样**（第八跑）
`.failed-2026-10-13T02-21-58-177Z/` 里只有 4 个文件：`intent.md` · `style.png` · `visual-world.json` ·
`game-intent.json` —— **没有 `game-design.json`**。

**泄密这一侧**
全仓 `grep 'redact|sanitize|脱敏|打码'` **零命中** —— **没有任何脱敏纪律**；
密钥今天只出现在请求头（`compile-design.ts:171`），所以**事实上不泄，但没有任何东西看着它**。

---

## 二、这一轮要你裁的

### ❓ Q1 — 落什么（粒度）

被拒的那一刻，磁盘上该留下几份东西？

- **(a)** 只落**最后一次失败那一发**的模型入参
- **(b)** 落**每一次**往返的原始模型入参（schema 档最多 **3** 份；R12 档恒 **1** 份）
- **(c)** (b) + **装配后**那一份 `candidate`（即注入 `callerKnownGame` 之后、送去 parse 的那份）
- **(d)** (b) + **完整请求体 / 响应体**

➡️ **推荐 (b)**。`attempts: 3` 这一格的正题就是「模型三次各试了什么」——只留最后一次，
等于把「系统性毛病 vs 手气差」这条判断**重新变回推理**，而那正是这一票要消灭的东西。
(c) 多出来的注入值是**纯函数可复算**的（`callerKnownGame(profile, vws)`），不必占地方；
(d) 会把 headers 拖进来，直接撞上 Q6。

---

### ❓ Q2 — 落在哪 · 怎么活过失败

- **(a)** 把那一摞原始入参**挂在抛出的 error 上**，由 `create-game.ts` 那个 catch
  在 `abandonRun` **之前**写进 `run.tmpDir` ⇒ 跟着那次 rename 进失败现场。
  **成功路径结构性碰不到它**（不抛就没有那份东西）。
- **(b)** 在 `compileDesign` 里**早写**进 staging（票 36 那种做法），成功时再删掉。

➡️ **推荐 (a)**。本票的**阴性判据**是「成功路径的产物一个字节不变」——
(a) 把它做成**结构性**保证（不抛就根本没有写入点）；(b) 得在成功路径上**加一处清理**，
反而多一个能坏的地方，而且「忘了删」正是那种会悄悄改掉成功产物的坏法。
⚠️ 仓库里已有同型先例：`carryOnError(e, { failureDir })`（`command.ts:114`）就是把东西**挂到 error 上**带出去的。

---

### ❓ Q3 — 名字与形状（⚠️ 票面的前提已被实测推翻一半）

那份东西**不是**契约产物（schema 档连 `format` 都可能缺），
而 R12 那一档又**真的是**一份合法 `GameDesignSpec`。一个名字要同时装这两种。

- **(a)** 原始入参进一个**显式的非契约容器**（如 `design-attempts.json`），**不**另写 `game-design.json`
- **(b)** 两者都写：容器 + 那份合法的 `game-design.json`（仅 R12 档会有）
- **(c)** 直接叫 `game-design.json`

➡️ **推荐 (a)**。(c) 对 schema 档是**假话**——读者会以为它是契约产物，而它恰恰是没过的；
(b) 让**同一份事实落两处**，而 `run/v<N>/game-design.json` 才是那一份的正位。
⚠️ **反方（请一并考虑）**：选 (a) 的话，R12 那些**拒因**（`intentCoverage` 等）不在原始入参里，
要看它们得**重放 `buildDesign`**（纯函数）。⚠️ 不过第八跑已经证明拒因**本来就读得到**
（它从 shell 渲染的报错里读出了 `intent-entity-missing`）—— 这一票缺的从来是**入参本身**。

---

### ❓ Q4 — 范围：只改 `compile-design`，还是理解层四步一起改

事实：`parseToolUse` 是**共享咽喉** —— `analyze-reference` · `analyze-intent` ·
`compile-character-dna` · `compile-design` 以及 assets 的 `ops.ts` 全都用它；
给它加一个 `raw?` 字段是**加法，不炸任何现有调用点**。

- **(a)** 只 `compile-design`（票面的 Question 就是它）
- **(b)** 理解层四步一起

➡️ **推荐 (a)**。票面问的就是 `compile-design`；(b) 是**范围扩张**，
而本仓的纪律是「说不出谁读它就别加」（R7）—— 另外三步今天**各有自己的落盘**
（`visual-world.json` / `game-intent.json` / `character-dna.json`），**没有实测的缺口**。
⚠️ 但**形状**按「一步一份」来设计，将来要接别的步时**不用改形状**。

---

### ❓ Q5 — 「每次为什么被拒」要不要一起落

- **(a)** 只落入参，**拒因靠重放**（判据都是纯函数）
- **(b)** 入参 + 每一发的 `failure` 类 + `detail` 文字（`once.detail` 在循环里**已经算好了**）

➡️ **推荐 (b)**。重放给的是**今天**的判词 —— 而本仓的契约这两周就升过 v3（票 45），
你要的是「**那一跑当时**撞的是哪一条」。`detail` 已经在手上，捕获它**几乎零成本**。

---

### ❓ Q6 — 泄密纪律

- **(a)** 只落**模型自己写的入参**；**永不**落请求体 / 响应体 / headers；
  并**加一条测试**钉住「落下来的东西里不含密钥」——
  同型钉子仓库里已经有：`image-gen.test.ts:9` 那个 `SECRET` + `expect(...).not.toContain(SECRET)`
- **(b)** 不加测试，靠纪律

➡️ **推荐 (a)**。今天密钥只走 headers 所以**事实上不泄**，但那是**巧合**、没有东西看着它；
而这一票正是**往现场新塞一类内容**，是补这条钉子的正确时机。

---

### ❓ Q7 — 记账那一侧动不动

票面表里「第一发撞的是哪条 `schema`」还有另一个读法：`ledger` 只记 `failure` 的**类**，不记 detail。

- **(a)** **不动 `ledger`**（它是 `.strict()` 契约，动它 = 升版 —— 票 45 上周刚为删四行付过一次 `assetpack/v2 → v3`）
- **(b)** 给 `ledger` 加 detail 字段

➡️ **推荐 (a)**。Q5 选 (b) 之后这一问**已经被 `detail` 回答了**；
而改 `.strict()` 契约的代价上周**刚量过一次**。

---

## 三、不需要你裁的一条（它是 Q2 的推论）

**判据**照票面 §3 · Q5 走，我不另问：
**阳性** = 造一次拒绝 ⇒ 失败现场里**有那份原始入参、且能读回来**（有测试盯着）；
**阴性** = **成功路径的产物一个字节不变**（票 36 的 Q2/A 立过同款钉子）——
⚠️ 而 Q2 选 (a) 的话，这条阴性判据是**结构性**成立的，不是靠测试守出来的。

---

## 四、我预判的下一轮（现在还不必答，等你这一轮裁定之后再定）

- 容器里的**确切文件名与字段名**（依赖 Q1 / Q3）
- `DesignRejectedError` / `CompileDesignError` **怎么把入参带出来** —— 加字段，还是另一条路（依赖 Q2）
- `create-game.ts` 里写的**确切位置**，以及 `pack` 那一侧（`keepFailureSite`）**要不要同款**（依赖 Q2 / Q4）
- 测试**落在哪个文件**、几条

---

## 裁定表（填这一张）

| 题 | 我的推荐 | 你的裁定 |
|---|---|---|
| **Q1** 落什么（粒度） | (b) 每一次往返的原始入参 | |
| **Q2** 落在哪 / 怎么活过失败 | (a) 挂 error 上，catch 里在 `abandonRun` 之前写进 `run.tmpDir` | |
| **Q3** 名字与形状 | (a) 只写非契约容器，不另写 `game-design.json` | |
| **Q4** 范围 | (a) 只 `compile-design` | |
| **Q5** 拒因要不要一起落 | (b) 入参 + 每发的 `failure` + `detail` | |
| **Q6** 泄密纪律 | (a) 只落模型入参，且加一条密钥钉子测试 | |
| **Q7** 记账动不动 | (a) 不动 `ledger` | |

（若某题的裁定是**选项之外**的第三条路，直接写在第 3 列；有**补充裁定**或**边界**，
另起一段写在表下面 —— 我会把你的原话逐字抄进票 55 的 `## Answer`。）
