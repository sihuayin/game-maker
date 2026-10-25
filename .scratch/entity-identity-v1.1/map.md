# 实体身份稳定性 V1.1：错误归属拒绝与关卡作用域（承载执行）

Labels: wayfinder:map
Tracker: local-markdown
Effort: entity-identity-v1.1

> **本图 2026-10-25 开。** 前置：`entity-identity-v1` 已 5/5 收口（PRD `docs/v7.1/稳定.md`），
> 其验真只查「身份在不在」（coverage + 悬空），不查「kind 对不对」，且不按关卡过滤 —— 留下两个缺口。
> 输入 PRD：`docs/v7.1/稳定02.md`；领域词汇以 `CONTEXT.md` 为准。

> **执行口径（用户 2026-10-25 裁定）**：
> - **Q1 承载执行** —— 终点是代码 + 测试 + 真实 E2E 全部落地，不是契约文档。
> - **Q2 沿用现有 schema** —— 覆盖范围 = `design.levels.find(l => l.id === levelId).entities`；
>   全局设计完整性独立检查；单关卡项目保持原行为。**无 schema 改动**（`levels[]` 与 `sourceIntent` 已在）。
> - **Q3 只修身份映射**（语义兼容 + 关卡作用域）—— `empty-input` 独立记录，本图不修、不靠放宽校验规避。

## Destination

让身份验真「可信」而非「能通过」：在既有 `levels[].entities[]` 与设计桶→kind 基础上，
让 `auditEntityIdentity`（1）拒绝 `sourceIntent` 存在但语义不兼容的错误归属（含 `interactables`
桶内 `goal → chest`），（2）按当前关卡过滤覆盖范围、把全局设计完整性拆成独立检查。
**验收 = 单元/集成测试 + 一条真实 E2E**：错误归属被拒、合法映射与合法结构性实体通过、多关卡各自只覆盖本关必需实体。

## Notes

- **关键事实（recon 2026-10-25）**：
  - `GameDesignSpec.levels[]`（`game-design.ts:176-188`）= `{ id, purpose, layout, entities: string[] }`，
    `entities[]` 回指 `player` + 四桶；gate ⑥ 已拒绝悬空引用（`game-design.ts:319-324`）。
  - `compileRuntime` 已选关（`ops.ts:1036` `opts.levelId ?? design.levels[0].id`），但把整份设计喂给模型
    （`designBrief` 遍历所有桶 + 所有 `levels`），`auditEntityIdentity(design, config)`（`game-config.ts:528-549`）
    要求覆盖**四桶全部、无关卡过滤** —— 这就是 Problem B 的缺口现场。
  - 桶→kind 兼容矩阵**已有一份**：`DESIGN_BUCKET_KINDS`（`qa/src/visual.ts:186-191`），
    但 `interactables` 桶同时允许 `chest` 与 `goal`，**不足以拒绝桶内 `goal → chest`**。
  - `interactables[].type` 是 `z.string()` 开放自由文本（`game-design.ts:170`），非封闭枚举 ——
    票 02 的「精确子类型映射」必须先落在票 01 的真实取值分布盘点之上。
  - 真·多关卡设计已存在 `.scratch/`（2–3 关），可对真实夹具测。
- **执行纪律**：改仓库代码，但**不动** `fixtures/`、`game-maker.local.json`，不 `reset`/`clean`；
  不提交/推送除非单独授权。`create` 链含**付费 LLM 调用**（票 04 的 E2E），先书面预算 + 逐字授权才跑
  （`entity-identity-v1` 同款纪律）。测试 = Vitest + TDD + 一条真实 E2E。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [盘点 interactables[].type 真实取值分布](issues/01-interactable-type-distribution.md)：`type` **开放无界**（30 份 spec / 57 条 / 28 distinct 值、自由散文）⇒ 精确子类型映射不可行；唯一配对样本 e2e-r2 现场复现 `gate`(goal)→`chest` 错归属（现有验真放过）。
- [兼容矩阵裁定](issues/02-compatibility-matrix.md)：**C 路线** —— 只拦可严格证明的跨桶错误，`interactables` 保持原样（除 `decor` 外全部）；交付 = 矩阵落 contracts 单一来源 + 编译期跨桶检查（早于资源生成）；同桶 `gate→chest` 记录为已知限制（靠开放 `type` 区分、不可靠）。
- [关卡作用域裁定](issues/03-level-scope.md)：B1 覆盖 = 当前关卡 `levels[].entities[]` 四桶（player 不计入 `config.entities`）· B2 全局完整性独立 · B3 单关卡不改 schema · B4 越界拒绝 `wrong-scope`（判据序：悬空→越界→兼容→覆盖；越界须**单独遍历 `config.entities[]`**，覆盖循环抓不到「多出」）。兼容 / 作用域两类错误分开定位。
- [实施 Phase 1](issues/04-phase1-compatibility-check.md)：矩阵落 contracts 单一来源 + `auditEntityIdentity` 第 ③ 步编译期跨桶检查（C 路线：`interactables` 保持原样，不误拒 `i-signal`→goal）· +6 测试 · 全仓 130/1947 全绿。
- [实施 Phase 2](issues/05-phase2-level-scope.md)：`auditEntityIdentity` 增 `levelId?` 作用域 —— coverage 只查本关四桶（player 不进）· 越界 `wrong-scope` **单独遍历 `config.entities[]`** 拒绝 · 兼容只查本关（悬空/越界不重复报）· 多关缺上下文报 `scope` error（不默认取第一关/不回退全局覆盖）· `compileRuntime` 两处传 `level.id` · 全局完整性仍归 schema gate ⑤⑥ · +7 测试 · 全仓 130/1954 全绿。
- [实施 Phase 3](issues/06-phase3-e2e.md)：真实 E2E 验收 —— E2E-A 跨桶错误归属拒绝（真 pack+注入→`invalid`+不落盘+不触生图）· E2E-C 两关作用域（`levelId` 分别编译、同一配置编错关被拒）· E2E-B 真实 `create` 产物重判零 error（`auditEntityIdentity` + QA 第 7 判据）· **零付费 LLM 调用** · +3 测试 · 全仓 130/1957 全绿。

## Not yet specified

<!-- 暂无：票 01 已把 `type` 取值分布这条雾坐实为「开放无界」，推进到票 02 的 A1/A2 重判；票 03 已收口。 -->

## Out of scope

- **资源宽高比 / 动画验收改进（P1，PRD §9）**：与身份无关，另立 effort。
- **SceneLayoutSpec 中间层（P2，PRD §9）**：超出身份契约。
- **主观视觉质量（P3，PRD §9）**：超出身份契约。
- **GameDesignSpec / GameConfig 整体 schema 重设计（PRD §2.2）**：本图沿用现有 `levels[]` + `sourceIntent`，不动 schema。
- **`empty-input` 缺陷**：独立追踪，本图不修、不靠放宽校验规避；若 E2E 复现则记录（PRD §7.3）。
- **跨项目设计知识复用（PRD §2.2）**：超出。
- **模糊名称匹配 / 静默自动修复（PRD §2.2）**：超出，不做。
