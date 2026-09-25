# recipe-derivation —— 票 28 的实物验证：真跑一次「需求 → 资源清单」

```bash
node derive.mjs      # 需求 + StyleSpec → 清单 JSON（调文本路径，约 15s）
```

依赖 `packages/contracts/dist`（先 `pnpm build`）。

## 输入

| | |
|---|---|
| 需求文本 | `requirement.md` —— 一个横版跳跃小游戏《交接班》的 brief |
| StyleSpec | `../style-transfer-from-test-png/stylespec.json`（**真实产出**，R11：人在会话里看图产出、管线只消费文件） |
| 调用 | 票 01 的配方：`/v1/chat/completions` + `thinking:{type:"disabled"}` + **纯文本 JSON**。⚠️ 不用 `tool_choice` |

**参考图不进 prompt** —— R11 定了 StyleSpec 是那条通道的产物。实测这不影响推导的可用性：
StyleSpec 的 `material` / `shapeLanguage` 词汇明确出现在模型给的资源描述里
（"worn painted metal"、"rust streaks"、"hard-edged"、"rounded corners only on handheld props"）。

## 结果

**两次都是 14~15 秒、一次通过 schema。**

| | 第 1 次 | 第 2 次（补了两条规则） |
|---|---|---|
| 资源数 | 10 | **8** |
| 玩家 | **拆成 3 个资源**（player-idle/run/jump） | **1 个资源 3 个动画** ✅ |
| dependencies | 用了 2 处（给拆开的玩家排序） | 一处没用 ✅ |
| 四类分布 | animation×3 · sprite×6 · background×1 | animation×1 · sprite×6 · background×1 |

第 1 次那份留在 `out/recipe.attempt1.json`（`out/` gitignored，要复现就跑一次）。

## 两次推导暴露的两件事

**① 模型的默认动作是「把角色的每个动作拆成一个资源」，而这正好打掉了帧间一致性。**
[票 22](../animated-player/README.md) 实测过：多状态**必须一次调用生成**才能保证是同一个角色。
拆成三个资源之后，那三个资源就是三次独立调用 —— 正是票 22 里 `player.idle` 与 `player.jump`
画成两个不同角色的那个失败模式。第 1 次它还用 `dependencies` 把后两个挂到第一个上，
像是在用「生成顺序」补「它们属于同一个东西」—— 而票 05 明说依赖**只用于生成顺序**。
把这条写成 prompt 规则之后，第 2 次自己就收成一个资源了。

**② 锚点是推导里最不可靠的字段。** 两次跑同一段需求，同一批资源：

| 资源 | 第 1 次 anchor | 第 2 次 anchor |
|---|---|---|
| 货箱 | (0.5, **1**) | (0.5, **0.72**) |
| 漏电地板 | (0.5, **1**) | (0.5, **0.8**) |
| 罐头 | (0.5, **1**) | (0.5, **0.5**) |
| 地砖 / 背景 / 招牌 | (0,0) / (0,0) / (0.5,0.5) | 同左（稳定） |

**理由很直接：推导发生在产物之前，模型看不到画，只能猜「脚底在画布上的比例」。**
而票 26 裁定锚点必须**声明**、不能从 ink 包围盒自动推（jump 帧的脚会被钉回地面）。
两条合起来说明：**锚点在两阶段流程里是人该重点看的那一栏** ——
这正是票 28 把「先出清单、人过目、再生成」定成两阶段的理由之一。
