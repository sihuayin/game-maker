# 实体身份稳定性 V1：GameDesignSpec → GameConfig 身份契约（承载执行）

Labels: wayfinder:map
Tracker: local-markdown
Effort: entity-identity-v1

> **本图 2026-10-25 开。** 前置：`visual-design-impl-v1` 已 8/8 收口，其票 08 真实 E2E 抓到
> 「设计→config id 不保真」缺口，明言**另立 effort**—— 本图就是那张票的兑现。
> 输入 PRD：`docs/v7.1/稳定.md`；领域词汇以 `CONTEXT.md` 为准。
> 事实基准：`assets/codebase-facts.md`（recon 2026-10-25，file:line 已核）。
>
> **四个裁定（用户 2026-10-25）**：
> Q1 身份契约 = **(a)** config 实体加 `sourceIntent` 回指设计 id（`id` 仍是运行时身份；1:N、孤儿都干净）·
> Q2 强制机制 = **(c)** 提示词声明 + 编译期确定性校验硬失败（不靠 asset 名回填）·
> Q3 执行模式 = **承载执行**（直接改代码 + 测试 + E2E）·
> Q4 范围 = **仅实体身份契约**（P1 宽高比 / P2 SceneLayoutSpec / P3 主观视觉质量全划出）。

## Destination

让 `GameDesignSpec` 设计实体身份在 `compileRuntime` 编译链中稳定传递到 `GameConfig`：
config 实体新增 `sourceIntent` 回指设计 id，编译期确定性验真 + QA 第 7 判据改按 `sourceIntent`
精确 join，消除 E2E 暴露的「设计→config id 缺口」，**且不放松 QA 严格性**。
**验收 = 一条真实 E2E** 消除身份错误（其余非身份的 QA 错误照实记录，不算本图失败）。

## Notes

- **身份契约已裁（Q1）**：config `Entity` 加 `sourceIntent?: z.string().min(1)`；`id` 仍是运行时唯一
  身份，`sourceIntent` 是设计身份回指。**可选**（孤儿 `block`/`gate` 不带）、**不唯一**（`resource-pickup`
  → 3 个 pickup 共享）。这与 VDS 的 `sourceIntent` 命名同源，join 变成 `VDS.sourceIntent === config.entity.sourceIntent`。
- **强制机制已裁（Q2）**：LLM 提示词只能引导、校验守契约 —— 提示词要求模型逐实体声明 `sourceIntent`，
  编译期确定性验真硬失败（模型错 → 重采样循环，仿 `auditGameConfig` modelHard）。**不做 asset 名回填**
  （`asset` 有歧义：`gate` 与 `chest-1` 都引 `chest`，见 facts §4）。
- **关键事实**（`assets/codebase-facts.md`，file:line 已核）：改写源头 = `compileRuntime`
  （`assets/src/ops.ts:1004`）LLM 编译、提示词未要求保留设计 id；设计四桶实体 id 稳定且已沿意图层
  （`game-design.ts:169-172`）；config `Entity.id` 自由、superRefine 只查唯一（`game-config.ts:222`）；
  真实映射 1:1 改名 + 1:N + 孤儿三种；VDS `sourceIntent` 已干净；QA join 键现在 = `id`
  （`qa/src/visual.ts:219/229`）。
- **执行纪律**：本图改仓库代码，但**不动** `fixtures/`、`game-maker.local.json`，不 `reset`/`clean`；
  不提交/推送除非单独授权。`create` 链含**付费 LLM 调用**（票 05 的 E2E），先书面预算 + 逐字授权才跑
  （`visual-design-impl-v1` 同款纪律）。测试 = Vitest + TDD + 一条真实 E2E。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [01 config 契约：Entity 加 sourceIntent](issues/01-config-sourceintent-field.md)：`Entity` 加 `sourceIntent: z.string().min(1).optional()` —— 可选（孤儿不带）· 不唯一（1:N 共享，id 唯一只看 id 不改）· schema 只验形状（悬空归票 03/04）。+3 测试，全仓 1929/1929，typecheck 绿。
- [02 compileRuntime 提示词声明 sourceIntent](issues/02-prompt-sourceintent.md)：**补齐 v4 工具镜像**（`config-tool.ts` EntityShape 也加 `sourceIntent`，否则模型发不出该键）+ 提示词铁律 8（1:N 同源 / 孤儿不填 / 玩家非实体）+ `gameConfigExample` 占位。+1 漂移测试，全仓 1930/1930，typecheck 绿。
- [03 编译期确定性验真](issues/03-compile-verify.md)：`auditEntityIdentity(design, config)` 落 `game-config.ts`（coverage + 悬空，孤儿合法，player 除外），接进 `compileRuntime` 重采样循环 + 循环后校验。报错口径随 `modelHard` 定案。+6 测试（5 单测 + 1 集成），夹具补 sourceIntent，全仓 1936/1936，typecheck 绿。
- [04 QA 第 7 判据 join 键改 sourceIntent](issues/04-qa-join-key.md)：`visualConfigCoherence` 的 `entityOf`（按 id）改 `bySource`（按 `sourceIntent` 分组、孤儿不进组），1:N 逐个查串桶、几何取第一个。+2 测试（1:N 合法/串桶），全仓 1938/1938，typecheck 绿。
- [05 测试 + 真实 E2E](issues/05-tests-e2e.md)：§6.2 五实体集成测试（`entity-identity.test.ts` 3 条）+ §6.3 E2E 四发验证身份目标——r2 真实 config `sourceIntent` 全覆盖（编译期修复生效），重建 bundle 后用修复代码重判 QA 零 error。全仓 1941/1941。唯一阻点：plan-assets 上游 empty-input（预先存在、非本图），成本 ≈$0.4。

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

- **1:N 反复声明错时的兜底**：LLM 在 1:N 场景反复把 `sourceIntent` 声明错，是否引入「asset 名无歧义时
  的确定性兜底回填」。**当前不引入**（Q2=c 只验真、不回填），若票 05 E2E 暴露模型在这点过不去再回头。

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->

- **资源宽高比 / 动画验收改进（P1，PRD §9）**：与身份无关，另立 effort。
- **SceneLayoutSpec 中间层（P2，PRD §9）**：结构化布局输入，超出身份契约。
- **主观视觉质量评估（P3，PRD §9）**：超出身份契约。
- **VDC 布局能力扩展（PRD §9「本轮不建议」）**：本图只修身份，不动布局。
- **GameDesignSpec 实体分类体系修改（PRD §3）**：1:N 用 `sourceIntent` 承载，不改设计 schema。
- **资源生成提示词 / 图像模型选择（PRD §3）**：超出身份契约。
