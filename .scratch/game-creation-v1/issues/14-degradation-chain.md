# 14. 生成侧降级链：生图 / LLM 不可达时退到哪里

Type: grilling
Status: resolved
Blocked by: 01
Map: ../map.md

> 🔴 **降级现在是常态，不是兜底**（2026-09-24，[票 34](34-wan-quota-facts.md)）：
> 本票原假设「代理通常可达，不可达时降级」。实际状态是
> **视觉与生图这两条上游现在就是死的**（配额耗尽 + 条款禁止），
> 而文本上游（DeepSeek）健康。所以本票的设计目标要反过来写：
> **让「只有文本可用」成为一个被正常支持的运行模式**，而不是一个异常分支。
>
> 并新增一条降级触发条件：**条款违规风险**。若某条调用路径合法但我们的用法不合规，
> 那是比「不可达」更该触发降级的条件（[票 35](35-bitmap-provenance.md) 定边界）。

> ⚠️ **范围已重画**（2026-09-24，R2/R6）：从**运行侧**降级变成**生成侧**降级。
>
> 上一版问的是「一次 run 跑不通时怎么退」，R2 砍掉 run 之后，真问题只剩一个：
> **生图端点或模型代理不可达时，产物 A 和 B 各自怎么办。**
>
> R6 已经把答案的骨架给了：仓库存一份 **fixture 资源包**，B 吃它照样能跑。
> 本票要把骨架填成规则，必须回答：
> 1. **按模态分别降级**（票 01 的结论）：视觉路径（`/v1/messages` → qwen）与
>    文本路径（DeepSeek）与生图路径（wan）是**三条独立的上游**，可能一死两活。
>    三条各自的探测方式、失败签名、超时是什么？
> 2. **降级的粒度**：整个资源包回退到 fixture，还是**逐资源**回退
>    （生图挂了但 drawlist 资源照常生成）？逐资源回退会让资源包变成
>    「一半真一半假」—— 这在风格一致性上能不能接受？
> 3. **必须被显式标注**：一个不知道自己是 fixture 的产物是虚假的产物。
>    标注写在哪（manifest？CLI 输出？退出码）？
> 4. **生图配额的失败长什么样**（与[票 34](34-wan-quota-facts.md) 联动）：
>    配额耗尽是一个必须能识别出来的**独立失败签名**，不能混进「网络抖动」。

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

## Answer

**结论：降级链落进 `packages/assets`，三层，**整包降级**，并且**现场验证过**——
今天 `/v1/chat/completions` 正在 403，链子探测到它、切到 `/v1/messages`、成功出包，
把那次切换如实记进了 `provenance.transport`。**

### 0. 八问的现状：大部分已被落地的票吸收

| 票面问题 | 现状 |
|---|---|
| 1 降级发生在哪一层 | **重写成三层链条**（端点 → 备用端点 → 程序化兜底）。原来的「Port / Adapter / Orchestrator」是 run 模型的说法 |
| 3 中途失败怎么办 | ✅ 裁决：**整包重试 / 转兜底**，绝不保留半成品 |
| 4 标注机制 | ✅ **已被[票 24](24-asset-pack-contract.md)/[票 37](37-assetpack-manifest-landing.md) 落地**，而且比票 14 当初设想的 evidence 路线更硬：`origin` + `provenance.mode`（**schema 强制自洽**）+ `degradations[]` |
| 5 fixture 清单 | ✅ 见 §4 —— 现在只有 **2 个**阻断调用点，且**都不需要 fixture** |
| 6 fixture 的一致性 | ✅ **被绕开了**：程序化兜底对任何输入都成立，没有「对不上」这回事 |
| 8 测试策略 | ✅ 已是既成事实：`fetchImpl` 注入（票 22）+ 生成器注入（票 38） |
| 2 / 7 探测与 fail-fast | 见 §3 / §5 |

### 1. 四条裁决

| 问题 | 裁决 |
|---|---|
| 上游全不可达时退到哪 | **程序化兜底** —— 不用 LLM 也出一个结构完整的包 |
| 降级粒度 | **整包**，绝不混着来 |
| 端点故障转移 | **不算降级**，但要记一笔 |
| 中途断了 | **整包重试 / 转兜底** |

### 2. 为什么不退到「仓库内置的 fixture 包」

R6 说了仓库存一份 fixture 资源包 —— 但那是**为产物 B 服务的**（B 吃它照样能跑）。
拿它当 A 的降级产物会撞上**票面问题 6**：fixture 是针对特定输入的。用户换了需求文本，
那个包就对不上了，而 demo 会**「假装」响应了新输入**。

程序化兜底对**任何** spec 都成立：尺寸对、帧数对、锚点对、颜色全在色板内、能被引擎直接加载。
只是**难看**。所以不存在「对不上」这回事。

它产出的资源 `origin` 仍是 `generated`（确实是本管线造的），**降级事实记在
`provenance.degradations[]` 里** —— 那才是它该待的地方。

### 3. 三层链条

```
① 首选端点   真生成                     → 产物最好
② 备用端点   换一个协议拿回同样的东西      → 产物一样，但记进 provenance.transport
③ 程序化兜底 不用 LLM 也出结构完整的包     → 产物难看，记进 provenance.degradations
```

**探测必须发真实请求**：票 01 实测代理**完全不校验鉴权**（错误 key、甚至不带鉴权头都返回 200），
所以靠鉴权失败判断死活是错的。`probeEndpoint()` 发一次 `max_tokens: 8` 的真请求，
超时 ~8s（票 01 实测 0.6s，但那是它当时的上游）。

**「不算降级但要记一笔」需要一个新落点** —— 它既不是降级，`degradations[]` 里放着就是撒谎。
所以给 `provenance` 加了 `transport: {preferred, used, switches[]}`（可选、附加式，
旧包不受影响）。产物一模一样，但**不记的话没人知道那天换过端点，下次同一个坑要重新踩**。

### 4. 「所有 LLM 调用点 × 所需 fixture」—— 答案是：**不需要 fixture**

按当前决策，管线里的 LLM 调用点只剩 **2 个**：

| 调用点 | 阻断？ | 挂了怎么办 |
|---|---|---|
| **清单推导**（[票 28](28-recipe-compilation.md)） | 是 | 清单是文件 —— **人可以直接写一份**（R7 的两条路本来就同构） |
| **drawlist 生成**（[票 22](22-asset-generator.md)） | 是 | **程序化兜底** |
| 抽查（[票 22](22-asset-generator.md) 的 `reviewPack`） | **否** | 跳过 —— 它本来就不阻断 |
| StyleSpec 提取（[票 15](15-stylespec-fixture.md)） | **不是管线调用** | R11 定它是人在会话里做的，管线只消费文件 |

票 01 当时列的是 4 个调用点（`compileStyle` / `compileGame` / testplan / repair），
那是 run 模型。**R11 把 StyleSpec 移出了管线，R2 把后两个删掉了。**

所以：**产物 A 的降级不需要任何 fixture** —— 两个阻断调用点，
一个有人工路径（清单是文件），一个有程序化兜底。

### 5. Fail-fast 与「绝不覆盖」的配合

到第三层还是失败（比如连兜底都出错），`buildPackResilient` 抛出去。
**失败的那次既不留下工作目录、也不吃版本号** —— 这是[票 22](22-asset-generator.md) 修的那条，
本票把它补全了：`buildAssetPack` 现在失败时会清掉 `.building-*`。
所以「绝不覆盖」的版本号只被**成功的包**消耗，`v1` 永远在。

### 6. 🔴 现场验证（不是推演）

**① 端点故障转移**（上游正在 403）：

```
❌ chat-completions  HTTP 403：{"error":{"message":"… Provider: dragoncode.codes … Insufficient account balance"}}
✅ messages          HTTP 200
→ 实际走了：messages · degradations: []
→ provenance.transport.switches = [{from: "chat-completions", to: "messages", reason: "HTTP 403：…"}]
```

**② 上游全死**（指向一个死端口）：

```
→ 实际走了：procedural
→ 包仍然合法：manifest 过 schema ✅ · spec↔产物对账 ✅ 0 问题
→ coverage: {exact: 3, composited: 0, quantized: 0, unbound: 0}   ← 兜底产物也全在色板内
⚠️ 降级（drawlist）：上游全部不可达（messages: fetch failed；chat-completions: fetch failed） → procedural
```

### 7. 一处需要点名的分工：**重试先吸收抖动，降级兜底真正的坏**

有界重试（票 22，默认 2 次）与降级链**不是一回事**：

- **重试**管的是**偶发**（模型偶尔吐坏 JSON、一次网络抖动）—— 不改变产物来源；
- **降级**管的是**持续不可用** —— 改变产物来源，因此**必须标注**。

有一条测试专门守着这个分工：第一次失败被重试救回来时，**降级链不该被惊动**
（`used` 仍是首选、`degradations` 仍为空）；连着两次都失败才整包退到兜底。

### 8. 落地清单与验收

| 文件 | 内容 |
|---|---|
| `packages/assets/src/procedural.ts` | **新增** —— 不用 LLM 的兜底生成器 |
| `packages/assets/src/degrade.ts` | **新增** —— `probeEndpoint()` · `buildPackResilient()` · `explainDegradation()` |
| `packages/contracts/src/assetpack.ts` | `provenance.transport`（可选，附加式） |
| `packages/assets/src/pack.ts` | `provenance` 可注入；失败时清工作目录 |
| `packages/assets/tests/degrade.test.ts` | **新增** 14 条 |

| # | 检查 | 结果 |
|---|---|---|
| ① | 全部测试 | ✅ **200 passed** |
| ② | **现场验证：端点故障转移**（上游真的 403 着） | ✅ 切到备用端点并如实记录 |
| ③ | **现场验证：上游全死 → 兜底** | ✅ 包仍然过 schema、对账 0 问题 |
| ④ | `pnpm check` / `typecheck` | ✅ |

### 9. 留给下游

- **[票 30](30-cli-and-mcp-surface.md)**：`explainDegradation()` 已经备好 ——
  「agent 必须能知道自己拿到的是不是降级产物」这条义务现在有一个现成的落点。
  建议把 `degradations` 非空与 `transport.used` 直接进 CLI 输出与 MCP 返回结构体。
- ⚠️ **本票没有解决「上游断了就没人知道」这件事** —— 它解决的是「断了之后产物仍然可用，
  且产物自己说得清自己是什么」。**告警/重试节奏**不在范围里。
