# 19. token 与耗时的账本

Type: grilling
Status: resolved
Blocked by: —
Map: ../map.md

> ✅ **2026-09-28 已决议** —— 见文末 Answer。⚠️ **票面开头两条 🔴 前提都已锈**：
> ①「R10 之后管线不再调用生图 API」**是反的**（R10 已于 2026-09-25 被人类推翻，
> 管线现在自己调生图模型）；② 第 2/6/8 问挂着的 `RepairBudget` **在代码里从来不存在**。
> 两处都**不改动正文**，Answer 里逐条交代。

> 🔴 **范围再次变化**（2026-09-24，[票 34](34-wan-quota-facts.md) + [票 35](35-bitmap-provenance.md)）。
>
> **R10 之后管线不再调用生图 API**，所以「生图配额账本」这一大块**没了** ——
> 没有配额消耗、没有抽奖式重试、没有图片张数。剩下的是：
> 1. **LLM 调用的 token 账本**（DeepSeek，`thinking: disabled` 后 9s/次）。
> 2. **构建耗时**：[票 03](03-phaser-vite-playwright-chain.md) 实测 **280–459 ms**，
>    且**资源包体积对耗时几乎无影响**（主项是打包 Phaser 本体）—— 这一项可以直接当作零。
> 3. 光栅化的耗时（[票 21](21-drawlist-renderer.md)，待测）。
>
> ⚠️ 票 34 查不到「Token Plan 一张图扣多少 Credits」（官方无系数表），
> **这条现在也不重要了** —— 管线不烧那个池子了。
> 「成本折算成钱」那条 fog 仍在，但对象只剩 token。

> ⚠️ **范围已重画**（2026-09-24，R2）：从「一次 run 的**时间**预算」变成
> **「一次资源生成的额度**账本」。
>
> 上一版的前提是「一个 run 必须在 10 分钟内跑完」，R2 砍掉 run 之后这条约束消失了 ——
> 现在没有人在等一个 run 结束，**人在等一批资源生成完**。所以真问题变成：
>
> 1. **额度是产品级约束，不是性能约束**。生图走千问 Token Plan（[票 34](34-wan-quota-facts.md) 查事实），
>    一次要出 20 张图，配额够不够、超了会怎样、要不要限流？
> 2. **账本记什么**：token 数（票 01 确认每条响应都带 usage）、图片张数、每条链路的耗时。
>    记在哪 —— manifest？CLI 输出？两者？
> 3. **成本折算成钱**（fog 里那块）：代理不转发定价，要不要内置牌价表。
> 4. **失败重试也烧额度**：生图是**抽奖**（票 23 问题 1），一次生成可能要重抽几次。
>    账本必须把「重抽」和「失败」分开记，否则配额的归因是错的。

## Question

**本票由票 01 的实测结果直接催生。** Q17 锁定的 budget 是「3 轮 / 10 分钟」，
但票 01 测出的真实延迟让这个上限站不住：

| 调用点 | 模态 | 实际模型 | 实测延迟 |
|---|---|---|---|
| `compileStyle` | 视觉 | qwen3.8-max | **47 – 63 s**（最坏 **136 s**） |
| `compileGame` | 文本 | deepseek-v4-pro | 27 – 38 s |
| GameplayTestPlan 补充 | 文本 | deepseek-v4-flash | 6 – 8 s |
| Repair 诊断 | 文本 | deepseek-v4-flash | 6 – 8 s |

粗算一次完整 run：
`compileStyle 60 + compileGame 35 + 3 轮 × (诊断 7 + 资源重编译 60)`
≈ **296 s 起步** —— 还没算 `vite build`、Playwright 启 Chromium、
截图、Observation 采集、结构化 Visual QA、HTML 报告生成。
而 Q17 给的总预算是 **600 s**。**大概率超支。**

延迟的主因已查明：**推理 token 占输出的 80%**
（实测一次 `completion_tokens=1993`，其中 `reasoning_tokens=1603`）。
这不是网络慢，是模型在思考。

必须 grill 出的问题：

1. **先把账本算准**：把一次 run 的**每一个**耗时环节列出来并估算，
   不只是 LLM 调用 —— build、浏览器启动、截图、评估、报告。
   哪些能实测（现在就能测 vite build 和 Playwright 启动）？
   哪些只能估？
2. **`maxDurationMs` 该设多少**？三个方向：
   - 放宽到 20-30 分钟（承认现实）
   - 保持 10 分钟，但减少 LLM 调用点
   - 保持 10 分钟，但**把 LLM 调用移出计时**（budget 只管 repair 循环，
     不管 compile）—— 这符合 `RepairBudget` 这个名字的本意吗？
   **注意**：`RepairBudget` 的字段是 `maxIterations` /
   `maxAssetRegenerations` / `maxCodeRepairs` / `maxDurationMs` / `maxCost`。
   从名字看它约束的是**修复循环**，不是整个 run。
   但 `orchestrator.ts` 现在怎么用它？这个语义要先厘清。
3. **缓存策略**（可能是最大的杠杆）：
   - `compileStyle` 只依赖**参考图**。同一张图的 StyleSpec 完全可以缓存
     （按图片 checksum 做 key）。**这正是票 15 的 fixture 机制的推广** ——
     fixture 就是「缓存的种子」。要不要把 fixture 和 cache 统一成一个概念？
   - `compileGame` 只依赖**需求文本**，同样可按文本哈希缓存。
   - Repair 时**只有被点名的资源需要重编译**（票 16 第 1 条），
     不该每轮都全量重跑 compileStyle。
   - 缓存写在哪？`demo/projects/<id>/fixtures/` 还是单独的 `cache/`？
     缓存要不要入库（Q9 说只提交 `inputs/` 和 `fixtures/`）？
4. **降推理开销**：能不能让模型少想一点？
   - 有没有 `reasoning_effort` / `thinking.budget_tokens` 之类的参数可用？
     （票 01 没测这个 —— **需要补测**。）
   - 换 `deepseek-v4-flash` 做 compileGame 能省 30 s，质量够吗？
     （票 01 实测 flash 的 GameSpec JSON 也是 3/3 通过，且更丰富 ——
     它甚至产出了 `important` / `optional` 级需求，pro 只产出 core。
     **这个反直觉结果值得在票 09 里复核。**）
5. **并行**：`compileStyle`（视觉）和 `compileGame`（文本）走的是
   **两个不同上游**（qwen vs DeepSeek），**完全可以并行**，省 ~35 s。
   资源生成也可以按依赖图并行（文档第 63 节，目前在 fog 里）。
   要不要把「compile 阶段并行」从 fog 里捞出来？
6. **超时与重试的时间成本**：票 01 证明纯文本 JSON 有 3/3 和 6/6 的通过率，
   但不是 100%。一次 Zod 校验失败 → 重试 → **又是 60 秒**。
   重试次数怎么和 `maxDurationMs` 协调？要不要「重试预算」独立计时？
7. **开发期的体验**：Q17 收紧 budget 的初衷是「开发期每验证一次改动
   要等一小时，反馈循环长到无法迭代」。实测下来这个担忧**成立了**。
   要不要引入一个 `--fast` / `--cached` 模式（全部走缓存和 fixture，
   0 次模型调用，几秒钟跑完全链路）专供开发期？
   **这可能比调 budget 数字更有价值。**
8. **`maxCost` 怎么填**：票 01 查明代理**不转发定价**，
   但每条响应都有 usage。要不要在代码里内置一张牌价表来估算成本？
   牌价会变，内置就会过期 —— 还是只记 token 数、不折算成钱？

调用 `grilling` skill。**产出是一份完整的 run 时间账本（每项含实测或估算依据）
+ 修正后的 budget 数字 + 缓存策略设计 + 关于 `--fast` 模式的结论。**
第 4 条需要补一次实测（`reasoning_effort` 类参数是否可用）。

## 来自 2026-09-23 实验的重大更新：时间账本要重算

票 22 的实验发现 **`thinking: {"type":"disabled"}`**（DeepSeek 路径）：

| 配置 | 延迟 | content |
|---|---|---|
| thinking 开（默认），max_tokens=2600 | 51s | **空**（reasoning 吃光） |
| thinking 开，max_tokens=8000 | 161s | **空**（reasoning 吃光） |
| **thinking 关** | **3.5 – 9s** | **有** |

这意味着票 01 测的「deepseek-v4-pro 文本 27-38s」**是在 thinking 开着、
且 prompt 较短时**的数字。关掉 thinking 后文本调用降到 **个位数秒**。

对账本的直接影响：
- 第 2 条（maxDurationMs 设多少）：LLM 部分的时间压力**大幅缓解**。
  6 份资源 5 路并行只要 8s。10 分钟 budget 的主要威胁从 LLM 转移到
  Playwright 构建/启动/截图（仍未实测）。
- 第 4 条（降推理开销）：**有答案了** —— 就是 `thinking:{type:"disabled"}`。
  不需要再探 `reasoning_effort`（实测被忽略）。
- 第 4 条后半（flash vs pro）：关 thinking 后 pro 已经够快，
  flash 的速度优势不再重要，**质量优先选 pro** 的理由变强了。
- **新增待测**：视觉路径（qwen via `/v1/messages`）有没有同开关。
  票 01 的 StyleSpec 提取花 61s，若可关 thinking 可能砍到 10s 内。
  这归票 22 问题 5。

⚠️ 但关 thinking 有代价：会加 markdown 围栏、JSON 形状纪律下降。
第 6 条（重试成本）要吸收这点 —— 关 thinking 后的**一次通过率会低于**
票 01 测的 9/9，重试预算要按新数字设。

---

## Answer

**结论：这票大半已经自己溶解了 —— 只留下一件真事：把「花掉的」记下来。**
账跟着**包**走，落在包根的 `ledger.json`（**契约零改动**）；失败也要报账；
**不折算成钱**；**不设上限**。三张新票：45 / 46 / 47。

### 0. 八条裁决

| # | 问题 | 裁决 |
|---|---|---|
| Q1 | 账给谁看 | **账跟着包走**（未来拿到这个包的人）**+ 由 `CommandResult` 渲染**（人与 MCP 的 agent）。只有「人在终端看一眼」是它最弱的形态 —— `imageCalls` 已经证明那样活不过终端关闭 |
| Q2 | 失败的 run | **照样报账** —— 花了钱是事实，失败不改变这个事实（与 R3「诚实是结构性的」同一条纪律） |
| Q3 | 缓存 / `--fast` | **不做**。真杠杆是**并行** → [票 47](47-parallel-generation.md) |
| Q4 | 粒度 | 明细只覆盖**会花钱的三类调用** + **一条 run 级汇总**。光栅化不单独记 |
| Q5 | 载体 | 包根 sidecar **`ledger.json`** —— 自动进 `files[]`、自动被 `verify` 校验，**契约零改动** |
| Q6 | 失败通道 | `CommandError` 带一个可选 `ledger`，与成功路径**共用同一个类型** |
| Q7 | 钱 | **不折算**。只记事实 —— 钱是事实的纯函数，随时能补 |
| Q8 | 上限 / 熔断 | **不做** —— **清单就是预算** |

### 1. 先记三件「没有了」的事

**① `RepairBudget` 的三问没有附着对象。** 票面第 2/6/8 条问的 `maxDurationMs` /
`maxCost` / 重试预算，全部挂在 `RepairBudget` 上 —— 而**代码里根本没有这个类型**
（grep 全仓：它只出现在 `docs/文档.md` 的已出局章节与旧票正文里）。
它随闭环一起出局，**不搬进来**。

**② 票面开头那句「R10 之后管线不再调用生图 API，所以生图配额账本没了」是反的。**
R10 于 2026-09-25 被人类推翻，管线现在**自己调生图模型**
（`packages/assets/src/image-gen.ts`，四家协议）。生图账本回来了，只是换了上游与计价单位。

**③ StyleSpec 的缓存问题已经不存在。** R11 把它定成「人在会话里产出、存成文件、管线只消费」——
**缓存就是那个文件本身**。

### 2. 为什么不做缓存

剩下唯一贵的是包里那 N 次 LLM 调用（`fixtures/recipes/last-train.json` = 9 个资源、
全部 drawlist，而 `pack.ts` 是 `for` + `await` ⇒ **9 次串行**，按 3.5–9 s/次 ≈ **40–80 s**）。

但票 40 实测过：**「两次生成逐字节相同」做不到** —— 生成的 drawlist 本来就不可复现。
按 prompt 哈希做缓存，等于**把第一次抽到的结果永久钉住**；那不是缓存，
那是「第一次生成即定稿」。

`--only <id>`（只重生成变更过的资源）同样不做：它会让「每跑一次 = 新 `v<N>`」这条版本语义
长出一个「这一版只重做了 3 个资源」的缝合怪。

**真杠杆是并行** → [票 47](47-parallel-generation.md)。
而并行**反过来改账本的形状**：一旦调用并行，「每次调用的 ms」**加起来不再等于**墙钟 ——
所以 Q4 的 run 级汇总不是装饰，它是并行落地的前提。

### 3. 账本是什么：manifest 是自描述，ledger 是收据

自描述回答「这东西**是什么**」—— 引擎要读它才能用，所以它必须是契约、必须 `.strict()`、
必须跟着 `format` 升版。收据回答「做这东西**花了什么**」—— 引擎**不需要**知道。

把收据订进规格书，会让每个第三方消费者都得解析一个与使用无关的字段，
而且从此每次契约演进都要背着它。**这正是 Q5 不走 `provenance` 的理由。**

**Q5 的代价算清楚了**：`provenance` 是 `.strict()`、`format` 是 `z.literal("assetpack/v2")`，
往里加键 = `v2 → v3`，而 v3 落地那一刻 `parseAssetPack` **拒绝所有已存在的 v2 包**
（`fixtures/packs/last-train/v2/` 就在磁盘上）。仓库已经吃过一次这个（v1→v2）。
而 `pack.ts:386` 的 `files[]` 是 **`walk(packDir)` 穷举** ——
sidecar 放包根会**自动进 `files[]`**、自动被 `verify` 校验 checksum。**契约一个字不改，等于白拿。**

⚠️ 一条**保住的纪律**：`ops.ts` 那句「失败**不**放进 `CommandResult` ——
这样『成功』这个类型里没有假货」**仍然成立**。账不是 outcome，它在成功与失败两条路上都存在。

**新词汇已进 `CONTEXT.md`**：[[账（Ledger）与收据]] · [[调用与往返]] · [[墙钟]]。

### 4. 记什么、记在哪

| 步骤 | 今天 | 决议 |
|---|---|---|
| `drawlist` 生成（一次/资源，+重试） | **零** —— 响应里就有的 `usage` 被直接丢 | **记** |
| `derive` 清单推导（一次/命令） | **零** | **记，但不落盘**（见下） |
| `image` 生图（一次/动画、一次/背景层，+重试） | `ms`·`attempts`·`requestedSize`；丢 `usage`、没记 `model`、`requestId`/`sourceHost` 只有个别协议填 | **记全** |
| 光栅化 / 装配 | 无 | **不记** —— 本机纯函数，无上游、无钱、无抖动，记它噪声比信息多 |

⚠️ **`derive` 的账不落盘**：**账跟着「包」走，而「清单」不是包** ——
R7 两条路都开，清单可以是人直接写的，那时根本没有 `derive` 调用。
在清单旁边放账，会给「这个包的账」塞进一个来路不明的加数。

包内 `ledger.json` 的字段形状与非付费步骤的排除理由，见[票 45](45-pack-ledger.md)。

### 5. 毕业的票

- **[票 45](45-pack-ledger.md)**（task）—— 把「花掉的」记下来：三类调用记账 + 包内 `ledger.json`
- **[票 46](46-failure-ledger.md)**（task，阻塞于 45）—— 失败也要报账
- **[票 47](47-parallel-generation.md)**（task）—— 并行生成资源
