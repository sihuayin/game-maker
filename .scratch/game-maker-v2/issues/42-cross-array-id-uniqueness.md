# 42. `player` 不参与「id 跨桶唯一」—— 于是同 id 的两个实体能一路走到 `character-dna` 才被拒

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 23「E2E fixture + 真跑一次」](23-e2e-fixture-wasteland.md) 的**探针 ⑥**。
> 人类在[第六跑决策轮第 1 轮](../clarifications/23-run6-round-1.md) 裁定：
> 「**已有独立的确定性失败证据，应另行立票，不能塞进本轮**」。
> ⚠️ **本票不挡票 23**（人类明确「不能塞进本轮」）—— 它是独立的一条。
> ❌ **2026-10-11：这一行今天被推翻** —— 第七次真跑**在真跑上又踩了同一个洞**，
> **票 23 已改挂本票**（`Blocked by: 42`）。理由与「人可否决」写在文末那一节。
>
> ⚠️ **2026-10-11 · 一处可能的标签错**（本 session 只报不改）：本票 `Type: task`，
> 但它的 `## Question` 写的是「**要定的（三选一，或组合）**」，而且第一问（「`player` 当初没进那条判据
> 是**故意**的还是**漏了**」）**只有人能答**。按本仓库的类型定义，这更像一张 **grilling（HITL）**票，
> 不是 **task（AFK）**票 —— 标签决定了「谁来解、要不要人在场」。⚠️ **改标签等于改下一步的解法，留给人裁。**
> 量到的现场：`raw/run-out-2026-10-10b/.failed-2026-10-10T10-36-45-891Z/game-design.json`
> ＋ 探针 ⑥ 的读数 `.scratch/…/experiments/e2e-wasteland/raw/character-dna/summary.json`

⚠️⚠️ **先把一处更正写在这里**（我第一次把这条报给人时写错了两个字）：

| 我当时的说法 | 实测 |
|---|---|
| 「**9/9** 确定性失败」 | **6/6**（`summary.json`：`过闸 ok: 0 · bad: 6`；磁盘上是 `02.replay.1…6.json`） |
| 「`characters[2].id` **与 `player` 同名**」 | 撞的是 **`characters[2].id` 与 `characters[0].id`**（都在 DNA 的 `characters[]` **里**，**不是**与设计层的 `player` 直接同名） |

⚠️ **但结论不变，而且更正之后链条更清楚** —— 见下。

## Question

**病根在两层之间的一段缝**：

- **设计层**（`packages/contracts/src/game-design.ts:254-262`）**有一条**「id 跨桶唯一」的判据，
  但它只查**四个桶**（`enemies` / `npcs` / `interactables` / `resources`）。
  ⚠️ **`player` 不在里面** —— 它是个**独立的 `strictObject`**（`:147`），压根没进那个 `seen` 表。
- **于是** `player.id` 与某个桶里的 id 相同**在设计层畅通无阻**。第五跑那份设计就是：
  `player.id = "scavenger"` 而 `npcs = ["scavenger"]`。
- **而下游要它唯一**：`character-dna` 被要求「player + enemies + npcs 里**每个角色实体恰好一条**」
  （票 04 的 Q3 · 票 31 的 Q2）⇒ 拿到那份设计**必然**产出 `[scavenger, enemy, scavenger]`
  ⇒ **必然**撞 `character-dna.ts:165-169` 那道闸（「角色 id 重复」）。
- **探针 ⑥ 量的就是「重试还有没有活路」**：同一份输入重放 **6 次**，**6 次全灭、病因逐字相同**
  ⇒ ⚠️ **这就是「独立的确定性失败证据」** —— 在那一份输入上，那一发的重采样**没有活路**。

要定的（**三选一，或组合**）：

1. **在设计层拒**：把 `player.id` 并进那条唯一性判据（`seen` 里先放 `player`）。
   ⚠️ 好处是**最早、且免费**（`compile-design` 是文本步，在任何生图之前），
   而且票 10 已经定过这条路的形式：**拒绝是一条结论**（退出码 4 · 走 `rejections` · **不重采样**）。
2. **在 DNA 那一层改**：承认「player 与某个 npc 可以同名」，把「每个角色实体一条」那条规矩松开
   （或让 DNA 的 id 带上来源桶）。⚠️ 但 `characterId` 靠 id 命中，「含糊」是**真的**含糊。
3. **两处都动**（设计层拒 + DNA 层把文案说清）。

⚠️ **四件必须先想清楚的事**：

- **为什么 `player` 当初没进那条判据？** 是**故意**的（player 与 NPC 是两种东西）还是**漏了**？
  ⇒ 这决定了上面选 1 还是 2。票 10 的票面写着「id 跨**桶**唯一」，而 `player` **不是桶**
  （`vocabulary.ts:108` 的 `ENTITY_BUCKETS` 只有四个值）—— 字面上它确实**不在**那条规矩的作用域里。
- **拒在哪一步**：设计层拒 = 人看到的是「设计不合格」；DNA 层拒 = 人看到的是「模型吐错了」。
  ⚠️ 这两件事在图上是**两个错误类**（票 10 的 Q3c：拒绝 ≠ 失败，前者不重采样）。
  今天的形状是**后者** —— 于是那一发**白重采样了 3 次**。
- **它是「潜伏」不是「回归」**：第六跑**过了** `character-dna`（`compile-design` 每跑重新生成设计，
  那一跑没产出这种设计）⇒ 本票不是修一个正在响的错，是**堵一条会随机踩到的路**。
- **判据的位置**：要不要一条测试钉住「`player.id` 与桶 id 重复 ⇒ 设计层拒」？

## 量到的

```
第五跑那份 game-design.json：
  player.id = scavenger
  enemies       = ['enemy']
  npcs          = ['scavenger']        ← 同一个 id
  interactables = ['chest', 'bench', 'streetlamp']
  resources     = ['resource', 'supply']
  ⇒ 重复的 = ['scavenger']   （而设计层的闸一声没响）

探针 ⑥（同一份输入重放 6 次）：过闸 ok 0 / bad 6
  病因逐字：工具入参不过契约：characters[2].id: 角色 id 重复："scavenger"
            —— characterId 会变得含糊（它靠 id 命中）
  逐发 ids：['scavenger', 'enemy', 'scavenger'] × 6
```

## 第七跑：同一个洞在**真跑**上又踩了一次（2026-10-11）

⚠️ 上面那句「**本票不挡票 23**」**今天作废** —— 理由见本节末。

第七次真跑（[票 23](23-e2e-fixture-wasteland.md) · **段 A**，人类批的是「只批段 A」）
**死在理解层第四步，正是本票这条缝**：

```text
退出码 4 · 墙钟 58.5s · 0 张图
步：visual-world → intent → design → character-dna   ✗（前三关全过）
错误逐字：重采样 3 次都没有拿到一份过契约的 CharacterDNA（最后一次：schema）。
          最后一次的病因：工具入参不过契约：characters[2].id: 角色 id 重复："scavenger"
          —— characterId 会变得含糊（它靠 id 命中）
账：attempts 3 · failures ["schema","schema","schema"] · in 174 / out 918 · ms 20859
现场：raw/run-out-2026-10-11a/.failed-2026-10-11T05-13-03-917Z/
      ⚠️ 副本已留：[`…/raw/id-collision-run7/`](../experiments/e2e-wasteland/raw/id-collision-run7/NOTE.md)
        （原现场在 `run-out-2026-10-11a/` **里面**，而那段驱动开头就 `rmSync(OUT)` ⇒ **下次段 A 一跑就没了**）
```

那一跑那份 `game-design.json` 里的桶（**逐桶读出来的**）：

| 桶 | id |
|---|---|
| `player` | `scavenger` |
| `enemies[0]` | `enemies` |
| `npcs[0]` | **`scavenger`** ← 与 `player` **逐字同名** |
| `interactables[0]` | `chest` |
| `resources[0]` | `resources` |

⚠️ **与第五跑那份是同一个形状**（`player.id = scavenger` ∧ `npcs = ["scavenger"]`），
**连死在 `characters[2].id` 都一样** ⇒ **两次独立真跑 · 同一个病 · 同一个位置**。
⚠️ 那一跑的 NPC 是设计层**自己补**出来的「**玩家控制的拾荒者本人**，无对话」（票 10 的 R2-Q1：
设计多出意图是**合法**的）⇒ 它一落到 `character-dna` 就**必然**撞。
⚠️ 顺带看出一条**同源**的毛病（这一跑**没撞**，因为桶名彼此不同，但同一个成因）：
`enemies[0].id = "enemies"` · `resources[0].id = "resources"` —— **桶名被当成了 id**。

### 为什么这一次它挡路了（而上一轮判的是「不挡」）

人类上一轮的原话是「已有独立的确定性失败证据，应另行立票，**不能塞进本轮**」，
当时的**前提**是：第六跑**过了** `character-dna` ⇒ 它是**潜伏**，不是挡在路上的。
**那个前提今天被一次真跑证伪了** —— 潜伏的那条踩上了，而且**重采样救不了**
（探针 ⑥：同一份输入重放 6 次全灭、模型**从不**自行合并那两条）。
⇒ 本 session 据此**把票 23 改挂本票**（`Blocked by: 42`）。
⚠️ **这是本 session 自己的决定，不是在执行人的话** —— 它与上面那行判词**相抵**，**人可否决**。

## Answer

（待解）
