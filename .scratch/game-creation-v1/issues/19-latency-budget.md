# 19. 一次完整 run 的时间账本与缓存策略

Type: grilling
Status: open
Blocked by: 14
Map: ../map.md

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
