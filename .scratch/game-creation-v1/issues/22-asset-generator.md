# 22. AssetGenerator：StyleSpec + AssetSpec → drawlist 的生成契约

Type: prototype
Status: open
Blocked by: —
Map: ../map.md

## Question

**这张票是建图时漏掉的。** `ports.ts` 里的 `AssetGenerator.generate(manifest, style)`
是整个系统最核心的创造步骤 —— 拿到 StyleSpec 和 AssetSpec，产出 drawlist ——
但建图时没有任何票负责它（票 05 定输出格式、票 08 修状态机、票 16 定修改、
票 18 定落盘，全是外围）。

人类在 2026-09-23 用 `demo/test.png`（像素风反乌托邦商店内景）跑了一次真实实验，
产物在 `experiments/style-transfer-from-test-png/`（含 `sheet.png` 联系表与
`view.html` 可交互页）。**实验证明这条路能走通，也精确暴露了六个没答案的问题。**

### 实验已证明的

- 链路 test.png →（qwen3.8-max 视觉，61s）StyleSpec →（deepseek-v4-pro 文本，
  **关 thinking 后 3.5-8.4s/个，5 路并行 8s 总耗时**）drawlist → SVG 渲染，**全程无人工修图**
- StyleSpec 提取质量**远超预期**：`shapeLanguage` 抓到
  "hard-edged rectangles / pixel-stepped diagonals / nested panel frames"，
  `constraints` 甚至给出可执行规则（"无纯黑纯白、阴影保持绿灰调"、
  "暖色点缀 <15% 面积"、"1px 深色描边"），且**这次没有色板补全幻觉**
- **颜色风格迁移是结构性成立的**：6 份资源全部只用了色板索引，
  渲染出来确实是参考图那个灰绿+奶油+橙点缀的世界
- **直角/嵌套面板的形状语言迁移成功**：pickup 的嵌套面板框 + CRT 发光屏、
  platform 的锈迹斑点，都与参考图的设备美学吻合
- schema 6/6 通过（用了 few-shot 示例之后，见问题 4）

### 六个待决问题

1. **⚠️ 同一资源的多状态画成了不同角色。**
   `player.idle` 与 `player.jump` 是**两次独立调用**生成的，结果：
   idle 是 11×29 的瘦长人形，jump 是 15×24 的宽块 —— 明显不是同一个角色。
   票 05 定了「一个 (asset, state) 一份产物」，但**没说怎么保证它们是同一个角色**。
   候选：① 多状态一次调用生成（一份响应里给全部 state 的 ops）
   ② 先单独生成「角色骨架」（头身比、部件坐标），再让各状态在骨架上摆姿势
   ③ 生成 jump 时把 idle 的 drawlist 塞进 prompt 当参照。
   三者对 prompt 长度、schema 形状、repair 粒度的影响都不同。
2. **材质迁移撞到了格式极限。**
   参考图的核心材质是 "pixel dithering / rust streaks"。
   实验里只有 platform **偶然**带上了斑点噪点，其余资源全是平涂 ——
   因为 **drawlist 没有 dither 图元**。
   候选：① 加 `dither`/`stipple` op（密度、颜色对、区域）② 接受材质缺失，
   把 dither 当作后期统一叠加的渲染效果（renderer 层做，不进数据）
   ③ 在 `material` 维度上认输，降级 StyleSpec 的材质要求。
   ② 最省事但让「材质」脱离数据、脱离校验；① 最忠实但加 op 就要改票 20 的 schema。
3. **characterStyle 兑现不了。**
   参考图说 "semi-realistic adult proportions (~6 heads)"，生成的是 ~3 heads 积木人。
   `StyleSpec.characterStyle` 是自由文本，模型读到了但没有执行。
   要不要把 characterStyle 结构化成可执行的数值约束（头身比、部件比例）？
   还是承认平台跳跃游戏本来就该 Q 版，在编译 StyleSpec 时按游戏类型改写它？
4. **few-shot 示例是形状合规的必要条件。**
   没有示例时模型把 ops 包进 `"drawlist"` 键、丢掉顶层字段；
   加了一个 3-op 示例后 6/6 通过。
   这份 schema-to-prompt 渲染器（schema + 色板 + 示例 + 风格约束）
   会被 `compileStyle` 之后的**所有**生成调用共用（AssetGenerator、GameConfig、
   GameplayTestPlan 补充、Repair 诊断）—— **它归谁维护？**
   票 09 也提过同样的问题，两张票要统一成一个决定。
5. **`thinking: {type:"disabled"}` 改变了输出风格。**
   开着 thinking：9/9 零 markdown 围栏（票 01 实测）；
   关掉 thinking：会加围栏、JSON 形状纪律下降 —— 但**快 18 倍且真的产出内容**。
   视觉路径（`/v1/messages` 走 qwen3.8-max）**有没有同样的开关？没测过。**
   票 01 测 StyleSpec 提取时 thinking 是开着的，花了 61s ——
   如果 qwen 也支持关 thinking，票 15 的耗时能砍到多少？
6. **「够不够像参考风格」谁来判？**
   结构化校验能查颜色（恒真）、尺寸（凸包）、图元合法性 —— 但查不了「像不像」。
   实验里「pickup 像不像参考图的设备」这种判断是**人眼看 sheet.png 做出来的**。
   这是否就是 fog 里那条「视觉模型打分」该出场的地方？
   如果是，它应该只在**生成后抽查**（便宜），还是进 Creation Gate（贵且不稳）？

### 产出要求

调用 `prototype` skill：把上面 6 问里**能用实物回答的**（1、2、3）做成可看的对比 ——
特别是问题 1，把三种多状态策略各跑一次，把三组 player 并排渲染出来让人眼判。
问题 4、5 是调用契约问题，产出可直接执行的 prompt 模板与参数表。
问题 6 是判断题，产出结论即可。

实验脚本的起点：`/tmp/gen/step1_stylespec.mjs` 与 `step2_assets.mjs`
（未入库；入库时放本票目录下）。

## Answer

_（待填）_
