# 02. W2 规格字段是否被消费

Type: research
Status: resolved
Owner: claude（2026-10-20 认领 · research 子代理）
Blocked by: —
Map: ../map.md

## Question

对 `VisualWorldSpec`、`GameIntentSpec`、`GameDesignSpec`、`CharacterDNA`、`AssetRecipe`、`GameConfig`
的关键字段，逐项建立 **producer → transform → consumer** 映射，并对每个字段回答任务书 W2 的六问：

1. 谁生成它？
2. 谁验证它？
3. 谁读取它？
4. 读取后改变了什么实际行为？
5. 是否有测试证明该行为，而不只是断言字段存在？
6. 是否有真实产物可以观察其效果？

至少覆盖：

- VWS：调色板、视觉风格、世界约束、参考图、绘制规则。
- Intent：实体、机制、核心循环、玩家目标、约束。
- Design：机制、关卡、实体、反馈、可执行设计。
- DNA：视觉约束、色板引用、角色一致性字段。
- Recipe：资源 ID、生产路线、输入、约束、执行信息。
- GameConfig：资源、动画、控制、碰撞、关卡、玩法配置。

## 验收

关键字段不存在未解释的「有定义、无消费者」或「测试只检查非空」；所有例外登记为缺口，
并标注证据强度（E0–E3）。特别注意 v3 已裁定的基线，只验证不重开（Q3）。

## 边界

- 只读；零付费；不改源码 / Schema；只写 `research/w2-field-consumption.md`。
- 不运行付费上游；可运行本地免费测试，但须记录命令与退出码。

## 产出

`research/w2-field-consumption.md`：字段映射表 + 缺口清单 + `## Answer` 摘要。

## Answer

完整证据：[`research/w2-field-consumption.md`](../research/w2-field-consumption.md)（基线 HEAD `ea53240`；只读、零付费）。

**关键结论（5–10 条）**

1. **消费分三层**：少数代码判据（`camera.mode`、路线/DNA 查找、`style.palette` 抠底与量化、`styleReferences` 参考图）→ 大量「只进提示词」（VWS 六桶/character/constraints、Intent 大部分字段、Design 12 个 ① 档字段、DNA 八字段）→ 少量只写不读字段。没有把「提示词里出现」写成「行为已生效」。
2. **VWS 死字段**（E1）：`styleIdentity.styleName`、`composition.characterScale`、`lighting.*`、`camera.projection/angle/elevation/perspective` 全仓零读取。六桶 / `constraints` / `shapeLanguage` 只到 DNA/规划提示词，无生成后判据（测试仅断言在场，E2）。
3. **Intent 死字段**（E1）：`winConditions` / `loseConditions` / `progression` / `challenge` 在 `designPrompt` 中零插值、零判据；用户的胜负条件没有交给设计层。
4. **Design 死字段**（E1+E3）：`winConditions` / `loseConditions` / `progression` / `difficulty` 不进 `designBrief`、不进 config 提示词、QA 不读；真产物 A4 写「接触敌人即失败」，而外壳 `hitHazard()` 只退回起点、无失败态。
5. **`GameConfig.objective.gate` 只校验、不被运行时消费**（E1+E3，P0）：每个 `goal` 都绑 `tryWin()`，`tryWin()` 只看 `pickupCount`；`this.gate` 赋值后从未读取。真配置里 `chest-1` 与 `gate-1` 都是 goal ⇒ 捡齐后碰宝箱就提前胜利。
6. **`animations.fps/loop` 在 manifest→runtime 断链**（E1+E2）：`pack` 写进 manifest，外壳却硬编码 `frameRate:8/10/6`、`repeat:-1`；`jump.loop=false` 也循环。`entities[].motion` 也只在 `hazard` 上被消费，`solid` 上的 motion 被校验/可达性当真、运行时不动。
7. **`AssetSpec.styleId` 与 `required` 零业务读取**（E1）：前者连 `recipe.ts:153-157` 都自白是死字段；后者只被 `pack` 抄进 manifest。相关测试只做形状对等，不证明行为。
8. **设计→资源清单无覆盖判据**（E1+E2）：只有玩家动画闸（`ops.ts:201-238`）；敌人/NPC/交互物/资源可被清单静默漏掉或改名。真实产物中 10-17d 恰好对齐，但没有 gate 保证下一次也对齐。
9. **v3 基线成立**（E2）：`deriveRecipe` 已不存在；`planAssets` 唯一规划入口；`resolveRoute` 唯一 `source.kind` 写入者；route 仍为 `image/drawlist/import` 三值；plan sidecar 成功才写且过契约。执行层 `frames` 折叠成 `image` 是 W3 的 F1，只引用不重开。
10. **测试**：本地运行 18 个测试文件 / 343 个测试，全部通过，退出码 0；但一大批判据只断言「字段在提示词里 / 形状合法」，已逐条标成 `E2（在场）`，未冒充 E3。**HEAD 没有单跑至站点的 E2E**（Q2 裁定），A3 的 config 是手写，不是 `compile-runtime` 产出。

**缺口与分流**：21 条缺口（W2-G01…G21）已在研究文件 §3 逐条登记，含证据、等级、分流（修正/补测/新增/补文档/暂缓）、优先级与验收条件。最高优先：G01 `objective.gate`、G02 设计胜负无运行时落点、G04 fps/loop、G12 设计→清单覆盖。
