# 14. 三层降级链：探测、切换、与「这是 fixture run」的标注

Type: grilling
Status: open
Blocked by: 01
Map: ../map.md

## Question

Q8 决定了 **HTTP 代理（若可达）→ Fixture → Fail-fast** 的三层降级，
理由是那个 localhost 代理的生命周期不受本项目控制。
Q14 的验收标准里明确写了「代理不可用时降级到 fixture 仍能跑通全链路」。

`CONTEXT.md` 已经立了一条原则：
**一个不知道自己是 fixture run 的 PASS 是虚假的 PASS。**
本票要把这条原则变成机制。

阻塞在票 01：探测什么、超时多少、怎么调用，全取决于代理的真实契约。

要 grill 出的问题：

1. **降级发生在哪一层**？三个候选：
   - **Port 层**：`LLMPort` 有多个 adapter 实现，运行时注入时决定用哪个
     （启动时探测一次，全程固定）
   - **Adapter 内部**：`HttpVisionAdapter` 自己 try HTTP、catch 后读 fixture
     （每次调用都可能降级）
   - **Orchestrator 层**：整个 phase 失败后回退
   **三者的可观察性完全不同**：Port 层降级是「这次 run 是 fixture run」，
   Adapter 内部降级是「这次 run 的某几个调用是 fixture」—— 
   后者更危险，因为它可能产生**半真半假**的 run。
   要不要禁止逐调用降级、只允许整 run 降级？
2. **探测怎么做、什么时候做**？启动时探一次（快、但代理可能中途死掉）、
   还是每次调用前探（慢、但准确）？探测超时设多少（票 01 第 5 条给数字）？
   探测失败但真实调用其实能成功（探测端点和推理端点不同）怎么办？
3. **中途失败怎么办**？run 跑到第 3 轮 repair 时代理挂了 —— 
   ① 整个 run fail ② 剩下的调用降级到 fixture ③ 挂起等代理回来。
   ①最诚实但浪费前面的工作；②产生半真半假的 run；③需要 pause 机制
   （`execution.paused` 已经有了，但谁来 resume？）。
   注意 Q19 把 Resume 划出了范围，所以 ③ 可能不可行。
4. **标注机制**：fixture 模式怎么记进产物？
   - `CreationRun` 加字段？（**要改契约**，慎重）
   - `CreationEvaluationReport.evidence[]` 里加一条
     `{type:'degradation', message:'compileStyle used fixture'}`？
     （契约里 evidence 的 type 是自由字符串，**不用改契约**）
   - 只在 HTML 报告（票 06）里显示？
   **建议走 evidence**：它天然可追溯，且文档第 59 节 Evidence First 的精神一致。
   这个取舍要定。
5. **fixture 从哪来、谁维护**？票 15 会产出第一份 StyleSpec fixture。
   但 GameSpec fixture 呢（`compileGame` 也要 LLM）？
   GameplayTestPlan 的 LLM 补充部分（票 13 第 7 条）呢？
   Repair 诊断（Q8 说用 `flash`）呢？
   **每一个 LLM 调用点都需要一份 fixture**，否则 fixture 模式跑不通全链路。
   要列全这份清单。
6. **fixture 的一致性**：fixture 是针对**特定输入**的
   （特定参考图 + 特定需求文本）。如果用户换了输入，fixture 就不匹配了 —— 
   这时候是 ① 报错 ② 无视输入直接返回 fixture ③ 按输入哈希查 fixture 表？
   ②最危险（demo 会「假装」响应了新输入）。
7. **Fail-fast 那一层**：HTTP 不可达**且** fixture 缺失时，
   错误码是什么（文档第 60 节的 `RuntimeError.code` 枚举里
   有 `VISION_MODEL_ERROR`，够不够）？`retryable` 是 true 还是 false？
8. **测试策略**：降级链必须有测试，且要能**在不依赖真实代理的情况下**
   测「HTTP 可用」这条路径。怎么 mock？

调用 `grilling` skill。
**产出是一份降级机制设计 + 一份「所有 LLM 调用点 × 所需 fixture」的完整清单。**

## Answer

_（待填）_

---

## 来自票 01 的更新（2026-09-23）—— **本票现已解除阻塞**

票 01 已 resolved，给出了本票需要的全部事实。**其中一条改变了本票的结构：**

### ⚠️ 降级必须**按模态分别做**，不是按 run 整体做

票 01 查明视觉和文本走的是**两个完全不同的上游**：

| 路径 | 端点 | 上游 |
|---|---|---|
| 视觉（`compileStyle`） | `/v1/messages` | **qwen3.8-max** |
| 文本（`compileGame` / testplan / repair） | `/v1/chat/completions` | **DeepSeek** |

CC Switch 是一个 GUI 应用，用户可以在界面里**单独切换或关闭某个供应商**。
所以「视觉通、文本不通」（或反之）是**完全可能的独立故障**，
不是同一个开关的两面。

这让第 1 条的「Port 层降级 vs Adapter 内部降级」二分**不够用了**：
需要的是**按模态分组的降级**，且每组独立探测、独立标注。
一个 run 可能是「视觉走 fixture、文本走真实模型」的混合体 ——
**这种混合 run 的 PASS 该怎么标注**？比全 fixture run 更危险，
因为它看起来更像真的。

### 其余事实（已实测，直接用）

- **探测成本极低**：`/v1/models` 或一次 8-token ping ≈ **0.63 s**。
  → 第 2 条可以选「**每个 phase 前探测**」，不必只在启动时探一次。
- **鉴权完全不校验**：错误 key、甚至不带鉴权头都返回 200。
  → 探测**不能**靠鉴权失败来判断代理死活；要探就必须发真实推理请求
  或打 `/v1/models`。
- **可用性**：CC Switch 的 PPID = 1（launchd），**不是 Claude Code 子进程**，
  退出 Claude Code 后仍活着，已连跑 2 天；但活不过重启（除非配登录项）。
  → 第 3 条的「fixture 是常态还是兜底」答案是**兜底**，但不能省。
- **延迟数字**（第 2 条的超时设定用）：
  视觉 47-63 s（最坏 136 s）、文本 pro 27-38 s、文本 flash 6-8 s。
  → **探测超时和调用超时必须分开设**：探测 ~3 s，真实调用 ≥ 180 s。
- **无 rate-limit 响应头**，所以无法靠 header 判断是否被限流；
  只能靠 HTTP 状态码和错误体。
- **第 5 条的 fixture 清单已可列全**：`compileStyle`（视觉）、
  `compileGame`（文本）、GameplayTestPlan 的 LLM 补充部分、Repair 诊断
  —— **共 4 个调用点，每个都需要一份 fixture**。
- **第 4 条建议采纳 evidence 路线**：票 01 确认每条响应都带 usage，
  所以 evidence 里除了「用了 fixture」还能记「用了真实模型 + token 数」。

### 关联

延迟与 budget 的冲突已单独开成
[19. 一次完整 run 的时间账本与缓存策略](19-latency-budget.md)，
本票只管**降级与标注**，不用重复处理时间问题。
