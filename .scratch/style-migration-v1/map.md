# Style Migration V1：把资源样式迁到图 43，并把多帧生成修到可交付

Labels: wayfinder:map
Tracker: local-markdown
Effort: style-migration-v1

> **本图 2026-10-18 开。**输入是 [风格迁移方案报告](report-2026-10-18.md)、
> [C 图像探针报告](report-C-image-probe-2026-10-18.md)、[C2 报告](report-C2-image-probe-2026-10-18.md)
> 与 [C/C2 结果](RESULTS-C-C2-2026-10-18.md)。
> ⚠️ **本图先只立票**（人裁「先写修复票」）：**立票 ≠ 批准施工**，也**不批准任何新的付费跑**。

> ✅ **2026-10-19 · 本图完成。** 最终包：
> `runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/`
> （`verifyPack` ok · 19 资源 · 61 帧 · 0 次最终重建上游调用）。
> 已知内容瑕疵：潜伏者 hang/lunge/retreat 语义混用；多图地面线；绿外套量化成棕。
> 后续可另立票：潜伏者定向修复（≤13 发，需报告 + 点头）· 地面线零付费清理 · 色板复盘。

## Destination

**整包资源按图 43 的样式可交付**：玩家 / 敌人 / 背景 / 道具 / UI 都是深色描边、3–4 级明暗、
脏旧材质、有限色板的像素画；动画按**固定网格**生成并可稳定切帧；生产链不依赖人工抢救。

## Notes

- **已付费证据**：C 3 张 + C2 3 张 = 6 张；jump 未生成。风格成立；侧视提示词修复已落地。
- **免费抢救**：`runs/2026-10-18f-salvage/`（16 帧侧视玩家包，`verifyPack` 通过）。
- **当前真实阻塞**：一图多帧的布局/数量不可信（8→9、9→12、加黑框/文字）。
  ⚠️ **2026-10-18 票 01 已关**：固定网格机制（`animations[].sheet` + 按格切 + 每格校验）已落地；
  生产链是否由 planner 统一写 `sheet`、以及付费验证仍待后续。
- **母版缺口（票 03）**：B 跑 3 角色 / 0 母版不是有意裁定，是提示词允许省略且无人兜底。
  ⚠️ **2026-10-18 票 03 已关**：planner 确定性补母版；B 配方免费重放 **0 → 3 张**，
  生图调用 **18 → 21**（下一轮预算按 21 报）。
- **本图边界**：不扩玩法（攻击/受伤/死亡）· 不改 `game-maker.local.json` ·
  下一轮付费必须另出报告 + 逐字点头。

**已落地但未提交的源码改动（探针期间）**：
- `packages/vision/src/prompts.ts`：忽略素材目录排版 + 色板下限 32（B 阶段）。
- `packages/game-design/src/prompts.ts`：`player.id` / `npcs` 的具体例子 + 写完自检（B 阶段）。
- `packages/assets/src/master.ts`：母版改侧视（C2）—— **仍未提交**，另行点头。
- `packages/assets/src/prompt.ts` 的 C2 探针改动（动画改侧视、删「共 N 帧」干扰句）
  **已随票 01 的提交入库**（2026-10-18，`71e9409`）—— 更正本图先前的「未提交」记录。
⚠️ 这些是探针的输入修复，**不等于下面任何一张票已施工**；提交需另行点头。

✅ **前沿（本段扫描）：10 / 11 两张** —— 票 09 已关，票 10 解锁（但仍是付费票：须先出书面预算报告 + 逐字点头）。
⚠️ **2026-10-19 票 10 已认领**：付费预算报告已出（[`report-10-hybrid-real-run-2026-10-19.md`](report-10-hybrid-real-run-2026-10-19.md)），
等待逐字点头（A 无 sheet / B 加 sheet）。免费预检发现：配方 0 母版（已补成 21 次生图）、13 个动画 0 `sheet`、config 的 9098 代理无人监听（计划走 7890）。
⚠️ **人裁 2026-10-19**：模型改用 **`gemini-3.1-flash-lite-image`**（runner 显式覆盖，config 不动）；免费预检通过（列表 / generateContent / countTokens 带图 200），≈ $0.0336/张。
❌ **2026-10-19 票 10 真跑失败（B 变体）**：6 生图 + 3 文本，全部 200，但生图回应**非 PNG**，`decodePNG` 拒绝；
花费 ≈ $0.21；无包、无隐藏重试。失败报告 [`report-10-failure-2026-10-19.md`](report-10-failure-2026-10-19.md)。
⚠️ 适配路线票 12 已裁 **A2**；施工票 13 **已完工、关票**（Interactions API；全量 102/1620 全绿；零上游）。
❌ **2026-10-19 smoke**：1 发 HTTP 400 —— `gemini-3.1-flash-lite-image` 的 Interactions **只接受 `image/jpeg`**，
拒绝 `image/png`；预计 $0、无图、无包。❌ **2026-10-19 smoke M1**：`gemini-nano-banana-2.1` **也只接受 `image/jpeg`**，拒绝 `image/png`（1 发 400，预计 $0）；
M1 未能解决 PNG。新裁在[票 15](issues/15-interactions-jpeg-only.md)：**B · 恢复 2.5 legacy PNG**（已施工、关票；全量 102/1624 全绿；零付费）。
  `GeminiOptions.api` 默认 `auto`：2.5 → legacy `generateContent`，3.x → Interactions。票 10 现 `Blocked by: 09`。
✅ **2026-10-19 legacy smoke 通过**：1 发 `image/png` · `verifyPack` ok · 1 生图 / 0 文本 · 96×64 交付 · ≈$0.039。
📄 第二次真跑已获授权并执行：**18 生图 + 3 文本**后失败（≈$0.702；累计 ≈$0.94）。
❌ **根因不是 PNG，而是 2.5 不遵守固定网格**：run 4×2→4×3/11 个、patrol 3×2→4×2/8 个、
idle 带格线与编号、standby 多画一个人。失败报告 [`report-10-real-legacy-failure-2026-10-19.md`](report-10-real-legacy-failure-2026-10-19.md)。
新裁在[票 16](issues/16-fixed-grid-not-followed.md)：**A · `rows=1` 单行提示词重写**（已施工、关票；全量 102/1625 全绿；零付费）。
✅ **2026-10-19 单行 smoke 通过**：1 发 `scavenger run` 8×1 → **8 帧 / verifyPack ok / 无格线**；
小瑕疵：脚下细虚线、32 色把外套绿映射成棕。≈$0.039；累计 ≈$0.98。
下一步：把其余动画改单行 + 复用已生成的 3 张母版 → 完整重跑预算报告。
📄 第三次真跑已授权并执行：**14 生图调用 / 18 发 + 3 文本**后失败（≈$0.55–0.70；累计 ≈$1.53–1.68）。
❌ **单行仍不守 4 帧数量/内容**：idle 4×1→4×2（8 个）；hang → 1 倒挂 + 4 站立 + 格线；
scrap-idle → 5 个人类（spec 是废料）。失败报告 [`report-10-real-single-row-failure-2026-10-19.md`](report-10-real-single-row-failure-2026-10-19.md)。
新裁在[票 17](issues/17-frame-by-frame-vs-salvage.md)：**A · 逐帧生成**（已施工、关票）；
新增 `source.kind="frames"` + `animationFramePrompt` + pack 逐帧分支；全量 **103 文件 / 1629 条**；零付费。
票 10 现 `Blocked by: 09`。
📄 逐帧真跑已授权并执行：**66 次生图 / 70 发 + 3 文本**（≈$2.57–2.73；累计 ≈$4.1–4.4）。
✅ **逐帧结构成功**：61 帧 + 2 sprite + 3 背景全部生成，0 母版调用；
❌ 唯一失败：`office-debris` 的碎片判据误杀（桌子+椅子+弹簧 = 33 块，最大 55.4%）。
⚑ 内容观察：玩家/敌人一致性好；废料/净水/终端正确（standby3 是人）；潜伏者倒挂/站立语义混用；多图有地面线。
失败/抢救报告 [`report-10-real-frames-failure-2026-10-19.md`](report-10-real-frames-failure-2026-10-19.md)。
新裁在[票 18](issues/18-frames-salvage-vs-regen.md)：**A · 零付费复用**（已施工、关票）。
✅ **2026-10-19 抢救出包**：`runs/2026-10-19j-salvage/.../pack/v1/` —— `verifyPack` ok、**0 次上游调用**、
19 资源 / 61 帧。内容瑕疵：standby3 是人、潜伏者语义混用、地面线、绿外套量化成棕。
成功报告 [`report-10-salvage-success-2026-10-19.md`](report-10-salvage-success-2026-10-19.md)。
✅ **2026-10-19 standby3 已修**（1 发 ≈$0.039 → 终端）；patch 复用其余 65 张 + 3 drawlist 零付费重建：
**最终包** `runs/2026-10-19l-salvage-standby3/.../pack/v1/` —— `verifyPack` ok、0 上游、19 资源 / 61 帧。
剩余：潜伏者语义、地面线、绿外套量化成棕。票 10 等收包 / 继续定向修复。
票 01 / 02 / 03 已施工、关票、提交（2026-10-18）；票 04 已施工、关票、提交（2026-10-19）；
**票 05 已裁定、关票（2026-10-19），未施工**（源码 / 测试 / 提示词一字未动）；
**票 06 已裁定、关票（2026-10-19），未施工**（裁切表 / PNG / 配方 / 源码一字未动）；
**票 07 已裁定、关票（2026-10-19），未施工**（`master.ts` / 测试一字未动）；
**票 08 已施工、关票（2026-10-19），未提交**（测试 +3 条留在工作树）；
**票 09 已施工、关票（2026-10-19）**（零上游、零付费；7 PNG + 迁移配方 + 桩跑包，未提交）。

## Decisions so far

- **范围**：整包风格迁移（人裁 2026-10-18）。
- **目标样式**：图 43（`.scratch/style-migration-v1/assets/reference-sheet.png`）。
- **多帧策略**：**固定网格 + 按格切**（人裁 2026-10-18）；不再靠连通块数帧。
- **当前动作**：先写修复票，不施工、不付费（人裁 2026-10-18）。
- **探针 intent**：去掉「打开宝箱」的机制，因为外壳不支持（R12 拒绝）；开宝箱缺口另记。
- **票 01（2026-10-18 已关）**：`sheet` 住 `animations[]` · 允许任意 `rows`（`columns × rows === frames`）·
  严格结构校验（空格 / 四边框 / 最大块 < 60%）· 旧连通块路径保留。
  全量 **98 文件 / 1575 条全绿**；零付费上游。
- **票 03（2026-10-18 已关）**：每个带 `characterId` 的 `animation` 必须有一张**本角色、同比例**的母版；
  提示词说硬 + `ensureCharacterMasters` 确定性兜底。`import`/`mustReuse` 豁免。
  全量 **99 文件 / 1585 条全绿**；零付费上游。
- **票 02（2026-10-18 已关）**：`despill` 住 `import.ts` 的 `prepareFrame`（抠底之后）；
  阈值是内部常量 + `ImportOptions` 可配，不进契约。
  自动门：只对**品红家族底色**生效；无 `background` 不跑；天空层深蓝不跑（否则误删内容）。
  C/C2 六张真图进 `fixtures/model-paint-despill/`；交付态命中判据 0；红/棕不丢。
  全量 **100 文件 / 1601 条全绿**；零付费上游。
- **票 05（2026-10-19 已关 · 只裁定）**：母版回图比例**只作观察**，零容差整数判定，
  不阻断、不归一化、不换模型；不新增比例门。`recipe` 设计层与 `pack` import 母版两条硬判据不动；
  三种 fixture 的观察断言留待施工授权（票 08）。依据：v2《39 · 母版的长宽比判据降为观察》
  已证「画布比例不是角色本体比例的代理」。
- **票 08（2026-10-19 已施工、关票）**：补 2.9% / 10% 读数 fixture + C2 现场
  （`48×64 → 858×1178`）集成守卫；观察照记、资产照发、不阻断。
  全量 **102 文件 / 1616 条全绿**（+3）；零上游、零付费、**未提交**。
  ⚠️ `pnpm typecheck` 仍有两条与本票无关的既有红（`pack-sheet-grid.test.ts:150` ·
  `prompt.test.ts:257`），未修（超出本票授权）。
- **票 07（2026-10-19 已关 · 只裁定）**：母版提示词里「外接矩形比例必须精确 = 画布比例、
  交付管线会两方向拉伸它」是假的且自相矛盾；改写为「画布是 W×H；后面每一次动画都会
  照这张图的头身比与形象画」。资产提示词 / 多帧提示词里同类句子**不动**（那里是真的）。
  施工另立票 11（待授权）。
- **票 06（2026-10-19 已关 · 只裁定）**：10 个 drawlist 走**混合路线** ——
  7 个环境/道具（`collapsed-floor` · `tile-floor` · `metal-platform` · `vent-duct` ·
  `concrete-step` · `wooden-crate` · `broken-wall`）从图 43 **裁切导入**；
  3 个 UI（`hud-panel` · `scrap-icon` · `health-icon`）保留 **drawlist**。
  **零新增生图，预算维持 21**；不扩 `create` 的 `existingAssets`，不改 planner 全局规则。
  施工（裁切表/PNG/配方）另立票 09；真实 pack 另立票 10（付费，需报告 + 点头）。
- **票 04（2026-10-19 已关）**：色板由参考图**确定性提取并替换模型色板**；
  生产 **32 色**（24 支持/验证，48 不用）；`PALETTE_SIZE = 32`。
  粗直方图 + 中位切分 + 暖色/肤色 20% + 高饱和 10% 预留 + 最远点补齐；
  每个色真实出现在参考图；24/32 两档量化预览都过（MSE 158.9 / 122.3）。
  链上三跑（模型给三份不同色板）落盘 `style.palette` 逐项相同；`palette:N` 改写后在范围。
  只支持 PNG 参考图（非 PNG 上游前拒绝）。全量 **102 文件 / 1613 条全绿**；零付费上游。
- **票 12（2026-10-19 已关 · 只裁定）**：3.1 生图非 PNG ⇒ 改 **Interactions API**，
  `response_format: { type:"image", mime_type:"image/png", aspect_ratio, image_size:"1K" }`；
  按 `steps[]` 解析回图。施工另立票 13；零付费。
- **票 10（2026-10-19 已关 · 收包）**：最终包 `runs/2026-10-19l-salvage-standby3/.../pack/v1/` ——
  `verifyPack` ok · 19 资源 · 61 帧 · 2 sprite + 7 import · 3 层背景 · 3 UI；最终重建 0 上游。
  内容瑕疵（潜伏者语义 / 地面线 / 绿→棕）记录在 Notes；后续另立票。
- **票 19（2026-10-19 已施工、关票）**：standby3 定向修复（1 发 → 终端）；patch 复用其余 65 张 + 3 drawlist，
  零付费重建整包（19 资源 / 61 帧，`verifyPack` ok）。最终包 `runs/2026-10-19l-salvage-standby3/.../pack/v1/`。
- **票 18（2026-10-19 已施工、关票）**：裁 **A · 零付费复用**。`reuseFrom` + `minLargestShare` 落地；
  用现场 66 张 + 3 drawlist 重建整包（19 资源 / 61 帧），`verifyPack` ok、0 上游调用。
  内容瑕疵：standby3 是人、潜伏者语义混用、地面线、绿外套量化成棕。
- **票 17（2026-10-19 已施工、关票）**：裁 **A · 逐帧生成**。`source.kind="frames"`：每帧一次调用；
  契约 / 工具形状 / `imageCallsOf` / `animationFramePrompt` / pack 分支全部落地；
  全量 **103 文件 / 1629 条**；零付费。下一步 66 次生图预算报告。
- **票 16（2026-10-19 已施工、关票）**：裁 **A** —— `rows=1` 的 sheet 提示词改「一行等距排开」，
  不再说「固定网格 / 格子」；多行不变。全量 **102 文件 / 1625 条**；零付费。
  待 1 发 `scavenger run` 8×1 smoke 验证。
- **票 15（2026-10-19 已施工、关票）**：恢复 **2.5 legacy `generateContent`**（PNG）；`api:"auto"` 按模型选路
  （2.5 → legacy，3.x → Interactions）；两条路共用重试 / 记账；非 PNG 明确失败。
  全量 **102 文件 / 1624 条**；零上游、零付费。下一步 1 发 legacy smoke。
- **票 14（2026-10-19 已关 · 只裁定）**：3.1 Lite 的 Interactions 只接受 `image/jpeg` ⇒ 换 **`gemini-nano-banana-2.1`**；
  ⚠️ **M1 的 smoke 实测：nano-banana-2.1 也只接受 JPEG**，PNG 仍不可得。后续裁在票 15。
- **票 13（2026-10-19 已施工、关票）**：Gemini 适配器改 **Interactions API**，
  请求 `response_format.mime_type = image/png`，回应按 `steps[].model_output.content[]` 解析，
  非 PNG 明确失败；兼容 `output_image`。全量 **102 文件 / 1620 条**；零上游、零付费。
  `pnpm typecheck` 仍有两条既有红（与票无关）；`check:links` 回绿（顺手修了票 09 的断链）。
- **票 09（2026-10-19 已施工、关票）**：混合迁移的免费施工落地 —— 7 张目标尺寸 PNG
  （4 张透明背景：平台/通风管/台阶/木箱；3 张满幅不透明：塌陷地面/瓷砖/破墙板）、
  19 条迁移配方（7 import + 3 drawlist + 9 image 原样）、桩跑 `verifyPack` 全绿、`audit` 空、
  `imageCalls = 0`。裁切表两条人裁：楼梯保留结构性三角侧影；塌陷地面保留 Floors 破洞、不改长梁。
  ⚠️ 施工中发现 B 的 `stylespec.json` 仍是票 04 之前的 16 色模型色板；已按票 04 机制
  从 `reference.png` 确定性重算 **32 色**并改写 `palette:N`（零上游）。
  产物在 [`runs/2026-10-19a-migration/`](runs/2026-10-19a-migration/)；**未提交**。

## Not yet specified

- ~~色板大小~~ —— **票 04 已定**：生产 32（24 下限且已验证），48 不用。
- ~~**跳跃动画**~~ —— **已交付**：最终包 `scavenger-actor.jump` 4 帧（逐帧生成）。
- **开宝箱**：外壳没有交互机制；是扩外壳还是把宝箱降级为 goal/pickup。
- **模型选择**：**已定** —— `gemini-2.5-flash-image` legacy `generateContent`（PNG）；
  3.x / nano-banana 的 Interactions 只回 JPEG（票 12–15），逐帧模式绕开了排版问题。

## Out of scope

- 玩法扩展（攻击 / 受伤 / 死亡 / 多关卡索引）。
- 改公共 Recipe Schema 的既有字段语义（新增 `sheet` 属于本图，但旧清单必须继续可读）。
- 自动修复 / 自动重生成循环（R13 边界不动）。
- 跨游戏视觉记忆。
