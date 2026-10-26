# FPVS-V1-P0：真实可玩 Demo（风格图 + 意图 → 可启动 / 可操作 / 可通关）

Labels: wayfinder:map
Tracker: local-markdown
Effort: fpvs-v1-p0

> **本图 2026-10-25 开。** 输入：`docs/v7.2/demo.md`（FPVS-V1-P0「First Playable Vertical Slice」）。
> **四岔已裁（用户 2026-10-25 逐字）**：
> Q1 射程 = **(a) 承载执行到 Demo**（修复必要缺口 + 交付真实可玩 Demo，付费 E2E 是最后一张独立票）·
> Q2 审计口径 = **(b) 增量缺口定位**（继承 `p0-00-audit` 已收口结论，只对 E2E 路径按 demo.md 6 条 P0 验收重验）·
> Q3 交互语义 = **(a) 近距自动开箱**（复用近距触发，不新增交互键/外壳输入能力）·
> Q4 付费闸 = **(a) 零付费默认**（单独书面授权前不执行付费 E2E、不产生费用）。
>
> **前置（全部收口，本图继承不重开）**：`p0-00-audit`（能力差距审计）→ `p0-construction-v1`（非 E2E 12/12）
> → `p0-final-v1`（E2E 失败：`empty-input` → R12）→ `intent-to-mechanics-v1`（R12 已消、付费重跑卡 design→config）
> → `recipe-config-gap-v1`（design→config 5 条硬失败已修：solid→sprite kind 锁 + `hudUiGate` + 业务校验重采样）
> → `entity-identity-v1` / `entity-identity-v1.1`（身份稳定）→ `visual-design-v1` / `visual-design-impl-v1` /
> `visual-semantics-verification-v1`（VDC + 语义验证边界）。
> **当前真实阻塞（票 01 研究结论）**：design→config 5 条硬失败**已被 `recipe-config-gap-v1` 修复**（非本图前置遗漏）；
> 唯一剩余阻塞 = **文本上游 `deepseek-v4-pro` 对 `emit_asset_recipe` 大 schema 不可靠**（empty-input/schema，约 1/8 成功率），
> 用户 2026-10-24 曾裁定暂不换 provider。其余逐层缺口（R12 重采样 / drawlist 截断 / image 底色 / config 几何）均已修。

## Destination

修复必要缺口，交付一个**真实可玩 Demo**（FPVS-V1-P0）：风格图 + 意图 → 现有 `create` 管线 →
可启动、可操作、可通关，且风格资源实际接入。验收 = `demo.md` 的 6 条 P0 判据全过，
付费 E2E 单跑产出真实产物 + 可复现验收步骤 + 验收结果 + 已知限制。

## Notes

- **输入（只读）**：`fixtures/e2e/wasteland-platformer/style.png` + `intent.md`（废土寻宝，与 W6 同款）。
- **付费闸（Q4）**：零付费默认；付费 E2E（生图 + 文本）单独立票、书面预算 + 逐字授权，未授权零调用。
- **交互语义（Q3）**：宝箱 = 近距自动触发（`open-chest` 已落地为「近距触发 + 一次性 + 复用 collect-then-reach」），
  不新增「交互」键。
- **审计口径（Q2）**：只对 E2E 路径按 demo.md 6 条 P0 验收做增量缺口定位，不推翻 `p0-00-audit` 已收口结论。
- **领域词汇**：以 `CONTEXT.md` 为准（`docs/文档.md` 是旧规格）。
- **工作树纪律**：不改 `fixtures/`、`game-maker.local.json`；不 `reset`/`clean`；不提交/推送除非单独授权；
  测试产物只写 `out/` 或本 effort 目录。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [01 增量缺口定位：E2E 路径 vs demo.md 6 条 P0](issues/01-incremental-gap-audit.md)：design→config 5 条硬失败**已被 `recipe-config-gap-v1` 修复**（solid→sprite kind 锁 + hudUiGate + 业务校验重采样，免费验收已过；本图 map「前置」链漏记该 effort、当前阻塞前提有误）· 唯一当前阻塞 = **文本上游 `deepseek-v4-pro` 对 `emit_asset_recipe` empty-input/schema（约 1/8）** · 6 条 P0 里 P0-03/04/05 运行能力已离线就绪、P0-02 卡 plan-assets、P0-06 未到真实站点人工对照。研究全案：[research/incremental-gap.md](research/incremental-gap.md)。
- [06 文本上游阻塞处置](issues/06-text-upstream-disposition.md)：**(a) 换 provider** —— 2026-10-25 用户改口径：不走 cc-switch，直连 **Gemini（gemini-3.1-flash）**、key 复用 `image` 段、改 repo 加 gemini 文本协议（覆盖边界 #2）。→ 毕业 [07 切换文本上游到 Gemini](issues/07-switch-provider-verify-recipe.md)。
- [07 切换文本上游到 Gemini](issues/07-switch-provider-verify-recipe.md)：**已收口** —— 全文本调用点按协议分支 + `text` 段 + gemini schema 兼容（`const`/`additionalProperties`/`propertyNames`/`exclusiveMinimum`）+ 真 gemini 探针 `create` Stage A exit 0 · 5 步全 0 重试 · `emit_asset_recipe` 一发过契约（模型 `gemini-3.5-flash`，服务侧报 `gemini-3.6-flash`）。→ 文本上游验证完成，E2E 归票 05。
- [08 背景层覆盖缺口修复](issues/08-background-layer-coverage.md)：**已裁定** —— Stage B 卡点 = 背景资产标称高 180 < 视口高 270（纯高度缺口，宽度已由 `tileable.x` 解决）；根因 = `assetPlanPrompt` 从不注入视口、模型盲猜 320×180。三问 = **提示词 + 清单闸（组合）** · **口径高≥视口高270、宽走 tileable.x** · **免费离线 + probe-7 产物过闸验证**。→ 毕业 [09 背景层覆盖实施](issues/09-background-coverage-impl.md)。
- [09 背景层覆盖实施](issues/09-background-coverage-impl.md)：**已收口** —— 提示词注入视口高/宽 + `backgroundCoverageGate`（与三道闸同档、`schema` 重采样）；口径 = 高≥视口高270、正视差 tileable.x、parallax 0 层宽≥480、**无层背景跳过**（mirror `backgroundLayerEntries`）；视口在 create 链一律 `DEFAULT_VIEWPORT`（`UnderstandingInput` 无 viewport，随 `compileVisualDesign` 同款）；E3 喂 probe-7 真实产物抓出「高 180<270 + sky 宽 320<480」零付费；全仓 1980/1980 · typecheck/check:deps 绿。→ 下一个阻塞回到票 05。
- [10 意图→机制「探索」过度抽取](issues/10-intent-explore-mechanic.md)：**已裁定** —— 票 05 重跑在 `compile-design` 挂（非背景覆盖）；根因 = `analyze-intent` 把「探索」伞状动词抽成独立机制 `mech-explore`、设计层封闭枚举无对家、R12 拒绝「悄悄做丢」（3 发全 rejected）。三问 = **意图层（分解伞状动词）**。→ 毕业 [11 意图提示词伞状动词分解](issues/11-intent-umbrella-verb.md)。
- [11 意图提示词伞状动词分解](issues/11-intent-umbrella-verb.md)：**已收口** —— `TOOL_DESCRIPTION`「先分家」段加「伞状动词不是一条机制」（探索/寻宝/冒险拆成移动+收集+抵达、不立 `explore`，并与第 1 条「二段跳照记」显式分界）+ 配套会红测试；全仓 1981/1981 · typecheck 绿。模型是否真听话归票 05 付费重跑。→ 下一个动作 = 回票 05。
- [12 动画帧表长宽比失真](issues/12-animation-aspect-ratio.md)：**已裁定** —— 票 05 第二次重跑推进到 QA（票 09 背景、票 11 意图都过）；`constructive-constraint` 2 条硬失败（run/patrol 各 4 帧，源 AR ~2.9 → 目标 4.0，压扁）。根因 = 4 帧横条 AR 4.0 生图发不出。三问 = **网格排版（压 AR）**，pack 确定性推导为主 + 提示词提示。→ 毕业 [13 动画帧表网格排版](issues/13-animation-grid.md)。
- [13 动画帧表网格排版](issues/13-animation-grid.md)：**已收口** —— `deriveSheetGrid`（N≥3 近正方形分解、质数退化横条）+ `animationSheetPrompt`/`gridOf` 共用（`anim.sheet ?? deriveSheetGrid(n)`）+ recipeShapeSpec 提示；E3 r2 真实清单 run/patrol（4 帧）→ 2×2、AR 4.0→1.0；全仓 1989/1989 · typecheck 绿。→ 下一个动作 = 回票 05 重跑。
- [14 enemy 比例](issues/14-enemy-proportion.md)：**已裁定** —— 票 05 第三次重跑修完 sourceSizeObservations bug 后，run 8.2% 过、patrol 25.3% 差 0.3% 不过（enemy 母版方、patrol 墨迹 718×900 偏竖，DNA 写「宽体」但模型画竖）。三问 = **调 enemy 尺寸（设计层，32×32 → 24×32/32×48）**。→ 毕业 [15 enemy 尺寸改高比例](issues/15-enemy-size-tall.md)。
- [15 enemy 尺寸改高比例](issues/15-enemy-size-tall.md)：**已收口** —— `assetPlanPrompt` 加「角色类资源按身份定尺寸」（高挑用高框、Q版用方框）+ 测试；全仓 1990/1990 · typecheck 绿。⚠️ 是提示词不是确定性，模型是否真定高框归票 05 付费重跑。→ 下一个动作 = 回票 05。
- [16 smoke 可玩性卡巡逻 hazard](issues/16-smoke-patrol-hazard.md)：**已裁定** —— 票 05 第四次重跑 **create QA pass**（exit 0、enemy 24×32 生效、最大 AR 差 18.5%），但 smoke `playable` FAIL：自动玩家收集 1/4 后卡巡逻 hazard（12 次重置）。根因 = `hazardAhead` 只看当前 x、不看 motion。三问 = **修 smoke 自动玩家（时序感知）**。→ 毕业 [17 smoke 跳跃时序感知](issues/17-smoke-patrol-aware.md)。
- [17 smoke 跳跃时序感知](issues/17-smoke-patrol-aware.md)：**已收口（部分）** —— `hazardAhead` 对巡逻 hazard 只在 phase<0.5 起跳（读 `t0`），smoke `playable` **1/4 → 3/4**；「停住等」试过回退。量出根本缺口：跳 ~66px vs patrol 100px，玩家 ~0.14s 短。→ 毕业 [18 patrol 范围收窄闸](issues/18-patrol-range-gate.md)。
- [18 patrol 范围收窄闸](issues/18-patrol-range-gate.md)：**方向作废** —— 试过 `clampPatrolRange`（distance 钳到 jumpSpan），`last-train` 的 `carriage` distance=200 是合法宽巡逻（躲、不是跳），硬钳误伤 ⇒ 撤。「巡逻 ≤ 跳跃跨度」不是普适约束。真实问题是**自动玩家跳不过移动宽巡逻（测试限制），不是游戏 bug**。→ 票 05 收尾：smoke 3/4 记已知限制。
- [05 付费 E2E 最终验收](issues/05-paid-e2e.md)：**收口** —— **create 管线端到端通**（五个真实缺口全修、QA pass、站点产出），smoke `playable` 3/4 记已知限制（自动玩家跳不过移动宽巡逻、真人可达），P0-06 风格人工对照留待人工。

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

（空。文本上游处置已由票 06 裁定 (a)，毕业为票 07。）
## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->

- [02 design→config 修复方案裁定](issues/02-design-config-fix-approach.md) / [03 修复实施](issues/03-design-config-fix-impl.md) /
  [04 免费验收闭环](issues/04-free-acceptance.md)：**划出范围** —— 票 01 研究确认 design→config 5 条硬失败
  已被 `recipe-config-gap-v1` 修复，本图无缺口可修，三票作废。
- **新增外壳能力**（交互键、新行为原语）：Q3 已裁近距触发，不扩外壳。
- **全量能力差距重审**：Q2 已裁增量定位，不推翻 `p0-00-audit`。
- **P1 / P2 收紧**（主观视觉评分、多关、HP / 失败态等）：超出 FPVS-V1-P0。
- **自动修复 / 自动重生成 / 隐藏重试**：失败留现场、登记缺口，不得把失败重试成成功。
- **提前重构没有证据表明有问题的模块**：demo.md P0-01 验收标准。
- **提交 / 推送**：每次单独授权。
