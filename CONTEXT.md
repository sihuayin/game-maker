# CONTEXT — 领域词汇表

本文件**只是词汇表**：不含实现细节、不是规格、不是草稿本。
实现规格在 `docs/文档.md`；当前决策在 `.scratch/game-creation-v1/map.md`。

术语若与 `docs/文档.md` 有出入，以本文件为准（本文件记录的是本项目**实际采用**的含义）。

---

## 生命周期

**Creation Project（创建项目）**
一次游戏创作的顶层容器：一个标题、一段需求文本、零到多张风格参考图。
一个 Project 下可以有多个 Run。

**Creation Run（创建运行）**
Project 的一次完整尝试，从需求到「通过 Gate」或「放弃」。
Run 是生命周期状态机的载体，也是预算（Budget）的结算单位。

**Iteration（迭代）**
一个 Run 内部「评估 → 修复 → 重建 → 再评估」的循环计数。
Iteration 递增意味着系统承认上一版不够好并尝试改进。

**Attempt（尝试）**
Run 失败后被整体重跑的次数。与 Iteration 不同：Attempt 是「从头再来」，
Iteration 是「在这一版上继续修」。

**Lifecycle State（生命周期状态）**
Run 当前所处的阶段（created / compiling / … / passed / failed / cancelled）。
**Pause 不是生命周期状态**，而是 `execution.paused` 标志位 ——
避免状态机与暂停语义相乘导致状态爆炸。

---

## 编译产物（Contracts / ABI）

各阶段之间**只通过 Contract 通信**，任何模块不得依赖另一个模块的内部实现。
Contract 是本运行时的 ABI。

**StyleSpec（风格规格）**
从参考图提取出的**视觉语法**，不是参考图的描述，更不是参考图的复制。
回答「这个世界长什么样、按什么规则长」：色板、形状语言、材质、光照、镜头、构图。
关键性质：它必须能约束**参考图里没出现过的新事物**（参考图里没有牛，
但生成出来的牛必须属于同一个视觉世界）。

**GameSpec（游戏规格）**
从需求文本推导出的**游戏设计**：核心循环、世界、玩家、机制、实体、场景、
UI、规则、胜负条件、需求清单。

**Requirement（需求）**
用户明确要求的一条能力，带 `core` / `important` / `optional` 优先级和验收标准。
Requirement 是**用户的话**，不是系统的设计选择 —— 因此 core 级 Requirement
未实现时，无论视觉和玩法分数多高，Gate 一律 FAIL。

**AssetSpec（资源规格）**
一个待生成资源的**需求描述**：角色、外观、几何、状态、变体、依赖。
AssetSpec 是「需要什么」，Asset 是「实际做出的东西」。

**AssetManifest（资源清单）**
一个 Run 所需全部 AssetSpec 的集合，并能回答：需要多少、已生成多少、
缺多少、哪些坏了、哪些没被用到、哪些是 Critical。

**Asset（资源）** ⚠️ 本项目特化含义
**一份 DrawList（绘制指令数据），不是一张位图，也不是一段代码。**
Asset 可 diff、可静态校验、可精确回滚。因此「风格一致性」在本项目里
是**可证明的**，不是靠视觉模型事后猜的。
一个 Asset 的一个状态 = 一份产物（见 DrawList）。

**DrawList（绘制指令表）**
Asset 的物理形态：一份 JSON，含 `format` / `id` / `state` / `viewBox` /
`expectedSize` / `ops`。`ops` 是一串**纯数值图元**
（`rect` / `circle` / `ellipse` / `poly` / `line` / `curve`）。
关键性质：**不含任何不透明字符串** —— 连曲线都是数值控制点列，
不是 SVG 的 `d`。因此它的包围盒、用色、尺寸都能在**不渲染**的前提下算出来。
代价是包围盒为**凸包上界**（保守高估，只会误报过大、不会漏报过大）。

**Palette Reference（色板引用）**
DrawList 里表达颜色的唯一合法形式：`palette:N`，指向 `StyleSpec.palette` 的一项。
**硬编码色值不是「不推荐」，而是根本无法通过 schema** ——
「颜色 ∈ 色板」因此是一个**构造上恒真**的命题，而非运行时检查项。
推论：换掉整个 StyleSpec 色板，Asset 的产物文本**一字不变**。

**State（资源状态）**
同一 Asset 的不同外观（番茄的 growing / ripe / harvested）。
状态之间是**整份 ops 的替换**，不是补丁 —— 状态差异可能极大
（成熟果实 → 只剩一个土坑）。产物按 `(asset, state)` 粒度切分，
以便修复时只重生成被点名的那一个状态。

**ArtifactRef（产物引用）**
指向一个大型产物的**轻量引用**（id / type / path / version / checksum / createdAt），
而非产物本身。Run 里只存 ArtifactRef，产物本体在文件系统。

**Artifact（产物）**
文件系统上的实际内容。**绝对禁止覆盖式生成**：`cow/v1`、`cow/v2` 并存，
旧版本永久保留 —— Evaluation、Repair、Rollback、Experiment 都需要历史。

**Game Config（游戏配置）**
本项目新增的 Contract（文档中无对应物）：AI 产出的**纯数据**，描述实体清单、
场景布局、交互规则、关卡/进度结构、胜负条件。它是 AI 与手写游戏代码之间
唯一的语义接口 —— AI 只写 Game Config 和绘制函数，**不写游戏循环**。

---

## 运行时观察与验证

**Runtime Observation（运行时观察）**
游戏运行某一时刻的**语义快照**：场景、镜头、玩家、实体（含 id/type/position/
bounds/visible/state/interactive）、UI、游戏状态、事件流、截图。
Visual QA、Gameplay QA、Runtime QA **共享同一份 Observation**。

**Runtime Bridge（运行时桥）**
游戏内部主动暴露语义状态的通道（`window.__GAME_RUNTIME__`）。
存在的理由：**AI 不应该通过截图猜玩家在哪里。**
本项目中 Bridge 是**手写固定的 SDK**，不由 AI 生成 —— 它是 QA 的地基，
地基不能每次 run 重新浇筑。

**Semantic Test Action（语义测试动作）**
以游戏语义而非屏幕坐标表达的测试操作：`interact('crop.tomato.01')`，
而不是 `click(532, 421)`。Runtime 负责把语义目标解析成实际游戏对象。

**GameplayTestPlan（玩法测试计划）**
从 GameSpec 自动推导出的测试集合，含明确的 **Critical Tests** 列表。

**Critical Path（关键路径）**
完成核心玩法循环所必须走通的那条动作链
（Boot → Move → Reach Crop → Interact → Harvest → Inventory Increase → Objective Complete）。
**任何 Critical Path 失败 ⇒ Gameplay Gate = FAIL**，不接受平均分补偿。

**Evidence（证据）**
每一条 QA Issue 必须携带的可追溯凭据（截图 id、区域 id、observation id）。
**禁止只有 `score = 72`**：没有 Evidence 的分数不可诊断，因此也无法修复。

**Visual QA（视觉质检）** ⚠️ 本项目特化含义
以**结构化静态校验**为主：因为 Asset 是代码，色板越界、尺寸越界、
形状语言不符都可以精确判定。截图照拍，但作为 Evidence 存档，
不作为打分依据。

**Novel Asset Style Consistency（新资源风格一致性）**
参考图里**不存在**的那些资源（cow / tractor / barn / fishing rod），
生成出来后是否仍属于同一个视觉世界。这是本项目最容易失败、
也最容易被忽略的维度 —— 参考图相似度再高也证明不了它。

---

## 门禁与修复

**Creation Gate（创建门禁）**
判定一个 Run 能否交付。**不是**「所有指标平均后 > 80 就 pass」，
而是 Hard Gate 与 Quality Score **两道独立的关**。

**Hard Gate（硬门禁）**
一组不可用其他维度补偿的绝对条件：core Requirement = 100%、
Critical Gameplay = 100%、Critical Visual Issues = 0、Boot = PASS、
Runtime Errors = 0、各项覆盖率不低于阈值。**任一不过 ⇒ FAIL。**

**Quality Score（质量分）**
各维度加权得出的连续分数，用于**比较两个版本谁更好**，
不用于决定能否交付（那是 Hard Gate 的事）。

**Blocker（阻塞项）**
导致 Hard Gate 失败的具体检查项。Blocker 是 Repair 的输入。

**Repair（修复）**
输入是**整份 CreationEvaluationReport**，不是一个 Error。
因为修复必须同时看到 Requirement / Asset / Visual / Gameplay / Runtime /
Interaction / Evidence 才能判断该改什么。

**RepairAction（修复动作）**
一次具体的修复意图，带类型（asset / code / scene / ui / runtime）、
目标 id、策略名、理由。

**RepairProgress（修复进展）**
一轮修复的前后分数对比与改进量。

**Stalled（停滞）**
连续若干轮 RepairProgress 无实质改进（甚至下降）的判定。
**Stalled ⇒ 必须切换策略**，而不是用同一个策略再试一次。

**Best State（最佳状态）**
至今为止质量分最高的那一版产物集合。
**v3 分数低于 v2 时，Best 仍是 v2** —— 绝不允许更差的版本覆盖更好的版本。
这是「自我迭代」不退化成「自我破坏」的唯一保障。

**Budget（预算）**
对修复循环的硬性上限：最大迭代数、最大资源重生成次数、最大代码修复次数、
最大时长、最大成本。存在的唯一理由：**防止 AI 无限修复。**

---

## 降级与运行模式

**Fixture Mode（夹具模式）**
模型代理不可达时的运行模式：StyleSpec / GameSpec 从仓库固化的 JSON 读取，
全链路照常跑通，产物确定性可复现。
**Fixture run 必须在报告里被明确标注** —— 一个不知道自己是 fixture run 的
PASS 是虚假的 PASS。

**Degradation Chain（降级链）**
HTTP 代理（若可达）→ Fixture → Fail-fast 的三层回退顺序。
设计意图：demo **永远可运行**，同时**能展示真实 AI 能力**。

**Checkpoint（检查点）**
重要阶段结束时 dump 的一份 Run 状态 + ArtifactRef 列表。
本项目只做**写入**，不做 Resume / Recovery。
