# VDC↔GameConfig 语义验证边界：可判语义收口（承载执行，只限 delta）

Labels: wayfinder:map
Tracker: local-markdown
Effort: visual-semantics-verification-v1

> **本图 2026-10-25 开。** 输入：用户 `/wayfinder` 直给的目标 ——「让 VDC 的视觉设计语义被最终
> GameConfig 确定性验证」，第一版 5 条 + 明确不做 6 条（无独立 PRD，本图即种子）。
> 前置：`visual-design-v1`(7/7)、`visual-design-impl-v1`(8/8)、`entity-identity-v1`(5/5)、
> `entity-identity-v1.1`(6/6) 均已收口；本图是它们的**边界收口**，不是新能力。
>
> **四岔已裁（用户 2026-10-25）**：
> Q1 图的射程 = **(a) 只画 delta**（已完成的语义覆盖 / 类型 / 作用域+身份回指 / E2E 作继承决策，不重开）·
> Q2 确定性靶标 = **(a) 严守判据/观察分界**（判据 = 精确可算 + 错了一定不是设计）·
> Q3 执行模式 = **(a) 承载执行**（只限本图确认的 delta）·
> Q4 数量与空间 = **(a) 承认无可判之物，收缩本图**。
>
> **事实基准（fact-finder 2026-10-25，file:line 已核）**：设计 spec **无数量字段**（四桶实体只
> `id`+自由文本，`game-design.ts:169-172`）；VDS 布局**纯机械**（一行柱子、同一地面线、占位尺寸，
> 不读 `world.structure`/`levels[].layout`，`layout.ts`）；VDS **屏幕空间** 480×270 ↔ GameConfig
> **世界空间**（横向跟随镜头+视差），**无 screen→world 变换** ⇒ 绝对/相对位置都不可比。

## Destination

落定 VDC↔GameConfig **可判语义的边界**：已判的（覆盖 / 类型 / 作用域 / 身份 / E2E）继承不重开；
**不可判的（数量、空间关系）明确写出结构性原因并记录**；**确有判据但漏掉的（VDS↔design 覆盖
S=D）补上**。验收 = 沿用一条真实 E2E，确认边界成立 + 补上的判据抓到注入的错误。

## Notes

- **继承决策（本图不重开，出处权威）**：身份回指 `sourceIntent`（entity-identity-v1 票 01–04）；
  关卡作用域 + 跨桶 kind 兼容（entity-identity-v1.1 票 01–06）；VDS 契约 + 桶↔kind 家族 + 几何观察
  （visual-design-v1 / visual-design-impl-v1 票 01–08）。这些是「已判」，本图只引用、不重裁。
- **本图唯一的真缺口**：票 04 契约承诺的 **VDS↔design 覆盖 S=D**（缺失 `D∖S`、悬空 `S∖D` 都硬失败）
  **从没落地** —— `visualConfigCoherence`（`qa/src/visual.ts:221-222`）静默跳过悬空、从不遍历设计实体查缺失。
  确定性 `layout.ts` 结构上保证 S=D，故不是现存 bug，而是「防手写/LLM VDS」的纵深。见票 02。
- **不可判边界（票 01 要写死）**：数量（设计无 `count` 字段 → 只有「≥1 覆盖」可判，`N` 个不可判）；
  空间关系（VDS 纯机械 + 屏幕≠世界无变换 → 绝对/相对位置都不可判）；「桶总序」是布局伪影、非语义断言，
  **不加观察**（会喷噪音）。
- **判据/观察分界（Q2 严守）**：`CONTEXT.md` 硬规则 —— 判据 = 精确可算 + 错了一定不是设计；缺一只能观察。
  本图**不降低门槛**去扩大判据覆盖率。
- **执行纪律（entity-identity-v1.1 同款）**：改仓库代码，但**不动** `fixtures/`、`game-maker.local.json`，
  不 `reset`/`clean`；不提交/推送除非单独授权。`create` 链含**付费 LLM 调用**，E2E 前先书面预算 + 逐字授权。
  测试 = Vitest + TDD；证据分级 E0 推测 / E1 源码 / E2 测试 / E3 真实产物。

## Decisions so far

- [01 不可判边界裁定：数量与空间关系的结构性不可判](issues/01-unverifiable-boundary.md)：数量精确值 / 空间关系（绝对+相对）**结构性不可判**（设计无 `count`、VDS 纯机械、屏幕≠世界无变换），不做新检查；「桶总序」是布局伪影、不加观察；边界落 `CONTEXT.md` 词汇表「结构性不可判」词条。核心原则：布局伪影不升级为设计语义，缺失的语义信息不靠观察或阈值补造。
- [02 VDS↔design 覆盖 S=D 硬失败补漏](issues/02-vds-design-coverage.md)：`visualConfigCoherence` 补上 `S∖D` 悬空 + `D∖S` 缺失两条 error（票 04 契约承诺、此前静默跳过）；D=四桶（player/mechanics 不进）、全设计口径。+5 单测、真实 e2e-r2 产物重判零误报。全仓 1962/1962 · typecheck 绿。顺带确认「VDS 全设计 / config 单关卡」错位 → 毕业为票 03。
- [03 VDS 全设计 / config 单关卡：多关卡拆实体时的「缺失」误报](issues/03-vds-level-scope-mismatch.md)：确认**非当前场景**（`create` 不选关、永远 `levels[0]`、多关卡索引未设计）⇒ 记录为已知限制、本图不做；届时把 `levelId` 流进 `QaContext` + scope 检查，归多关卡那张图。

## Not yet specified

<!-- 空：唯一的雾（VDS 全设计 / config 单关卡错位）已由票 02 确认、毕业为票 03 -->

## Out of scope

- **AI 自动修复**：验证只报错、不自动修（用户明确不做）。
- **新的游戏行为原语**：不扩展外壳行为集。
- **多游戏模板 / 跨项目知识复用**：超出。
- **完整 Benchmark / 付费 LLM 评分**：超出（本图零付费 LLM，除 E2E 一条）。
- **给上游补语义让数量/空间可判**（设计加 `count`、VDS 升级语义布局）：Q4=(a) 已裁**不做**，
  撞「纯结构布局」裁定 + 「不做行为原语」。
