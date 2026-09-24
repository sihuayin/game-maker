# 19. token 与耗时的账本

Type: grilling
Status: open
Blocked by: —
Map: ../map.md

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

## Answer

_（待填）_


---

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
