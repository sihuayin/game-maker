# 图片驱动的 AI 游戏创建 Demo（GAME_CREATION_RUNTIME_V1 落地）

Labels: wayfinder:map
Tracker: local-markdown
Effort: game-creation-v1

## Destination

一条命令、全程无人工干预，从「一张风格参考图 + 一段 Cozy Farm 游戏想法」跑通
compile → generate → build → run → observe → evaluate → gate → repair → re-evaluate
全链路，产出一个在浏览器里**真的能玩到采摘番茄**的 Phaser 游戏，外加一份静态 HTML
报告展示评分与**至少一轮让分数上升的自我修复**；模型代理不可用时降级到 fixture
**仍能跑通全链路**。

## Notes

### 领域与代码位置

- 技术规范：`docs/文档.md`（83 节，中文）。**所有代码路径均相对于 `demo/`**：
  文档里的 `src/contracts/` 实际是 `demo/src/contracts/`。
- 现有代码：`demo/`（892 行）。骨架已完整 —— Contracts(Zod)、State Machine、
  Orchestrator 生命周期循环、Gate 计算、In-memory Store。
- **7 个 Port 全是 Mock**（见 `demo/src/example.ts`）；
  `DefaultRepairEngine.execute()` 是空函数。
- 领域词汇表：`CONTEXT.md`（仓库根）。

### 每个 session 开工前必读（文档第 79 节的强制要求）

1. `docs/文档.md`
2. `demo/src/contracts/index.ts` + `policy.ts`
3. `demo/src/runtime/state-machine.ts`
4. `demo/src/runtime/ports.ts`
5. `demo/src/runtime/orchestrator.ts`

### 按需调用的 skill

- 架构/接口设计票 → `codebase-design`
- 术语冲突或新概念 → `domain-modeling`（并同步更新 `CONTEXT.md`）
- 造具体东西给人react → `prototype`
- 查第三方事实 → `research`
- 压力测试决策 → `grilling`

### 版本控制约定

**规划产物（`.scratch/` 与 `CONTEXT.md`）直接提交到 `main`，不走分支 / PR。**
理由：这张地图是**跨 session 的协调产物** —— 其他 session 靠读它来判断
哪张票被认领了、哪些决策已锁定。放到分支上就看不见了，协调即失效。

代码改动不在此列（仍按常规流程）。`提交` 与 `推送` 分开：人类说「提交」时
只 commit，不 push。

### 本 effort 的执行模式

**覆盖 wayfinder 的「只规划不执行」默认**：Q1 决定终点是一个真跑通的 demo，
所以地图后半段包含执行票（`task` 类型会真的写代码）。但执行票只能在其依赖的
设计票 resolved 之后才建 —— 不要提前把 fog 切成执行票。

### 已锁定的架构决策（charting 阶段 grilling 产出，19 项，不得重开）

这些是在建图之前与人类 grill 出来的，**不是** ticket 决议，因此不出现在
Decisions so far。每张票都必须服从它们。

| # | 决策 |
|---|---|
| Q1 | 终点 = 真跑通的 demo；地图前半决策票、后半执行票 |
| Q2 | `VisionPort` 抽象：先 `FixtureVisionAdapter`，后 `HttpVisionAdapter` |
| Q3 | **程序化资源生成** —— AI 产出 SVG/Canvas 绘制代码，**不产出位图** |
| Q4 | **Phaser 3 + Vite，不用 React**；Playwright + Chromium 做 Runner |
| Q5 | 第一个端到端 demo = **Cozy Farm**（文档通篇的参照游戏） |
| Q6 | 自我迭代 = **单调改进**：RepairProgress + Stalled 检测 + Best Artifact 回滚 |
| Q7 | 参考图由人类提供；**未提供 → 程序化造一张**作为默认输入 |
| Q8 | **三层降级**：HTTP 代理（可达时）→ Fixture → Fail-fast；`deepseek-v4-pro` 做 compile，`deepseek-v4-flash` 做 repair 诊断<br>⚠️ **模型分工部分作废**（见[票 01](issues/01-proxy-api-contract.md)）：视觉与文本走**两个不同上游**，pro/flash 分档只存在于文本路径。实际分工改为**按模态**：`compileStyle` → qwen3.8-max（唯一选择）；`compileGame`/testplan/repair → DeepSeek。三层降级本身**仍然有效且必需** |
| Q9 | **合一目录** `demo/projects/<projectId>/`；产物全 gitignore，只提交 `inputs/` + `fixtures/` |
| Q10 | `window.__GAME_RUNTIME__` 由**手写固定的 Phaser 插件 SDK** 实现；AI 只负责调 `bridge.tag()` |
| Q11 | Visual QA = **结构化静态校验为主 + 截图存档为 evidence**；视觉模型打分降级到 fog |
| Q12 | **条件迁移**：`repairing → generating`（plan 含 asset/scene/ui action）/ `→ building`（仅 code/runtime）；记 ADR |
| Q13 | 交付形态 = **CLI + 静态 HTML 报告**（无框架、无服务器） |
| Q14 | 验收 = 严格版（见 Destination） |
| Q15 | **AI 只产出「数据 + 纯函数」**：实体绘制函数 + `game-config.json`。Phaser 主 scene、游戏循环、bridge 插件、输入处理、碰撞、vite 配置、build 脚本、runner **全部手写固定** |
| Q16 | GameplayTestPlan = **规则推导生骨架（保证 critical path 结构性覆盖）+ LLM 补边界 case** |
| Q17 | Budget 收紧到 **3 轮 / 10 分钟** + token 上限（上线前放宽是配置改动，非架构改动） |
| Q18 | Benchmark **Out of scope** |
| Q19 | Checkpoint **写入** = in；Resume / Recovery / SQLite = **Out of scope** |
| **Q20** | **Asset 格式 = `drawlist+curve/v1`**（严格 DSL + 数值曲线 op）。op 集合：`rect`/`circle`/`ellipse`/`poly`/`line`/`curve`；颜色**必须**是 `palette:N` 引用，硬编码色由 schema 直接拒绝；一个 `(asset, state)` 一份 `.json` 产物。详见[票 05](issues/05-asset-representation.md) |

### 环境事实（已实测查证，不必重查）

**本地代理 = CC Switch**（`/Applications/CC Switch.app`，PID 651，**PPID 1 / launchd**）。
基址 `ANTHROPIC_BASE_URL`，凭据 `ANTHROPIC_AUTH_TOKEN`。
全部细节见 [票 01](issues/01-proxy-api-contract.md) 的 Answer，这里只留最容易踩的几条：

- ⚠️ **`/v1/models` 的元数据是误导性的**。它列的两个 deepseek 模型都标
  `input_modalities: ["text","image"]`，**实测为假**。
- ⚠️ **不同协议走不同上游**，这是本项目最重要的环境事实：

  | 端点 | 协议 | 实际上游 | 图像 |
  |---|---|---|---|
  | `/v1/messages` | Anthropic | **qwen3.8-max**（请求里的 model 名被忽略） | ✅ **唯一能收图的路** |
  | `/v1/chat/completions` | OpenAI | **DeepSeek**（`deepseek-v4-pro` / `deepseek-flash`） | ❌ 收到 `[Unsupported Image]` |
  | `/v1/responses` | OpenAI | DeepSeek | ❌ 同上 |

- ⚠️ **不要用 `tool_choice` 强制 JSON** —— 完整 12 字段 schema 只有 **1/3** 通过。
  **纯文本 JSON（prompt 描述结构）实测 9/9 通过、零 markdown 围栏。**
- ⚠️ **延迟很大**：视觉 47-63 s（最坏 136 s）、DeepSeek pro 27-38 s、flash 6-8 s。
  主因是推理 token 占输出 ~80%。`max_tokens` 必须给足（≥3000），超时 ≥180 s。
  → 与 Q17 的 10 分钟 budget 冲突，见[票 19](issues/19-latency-budget.md)。
- **鉴权完全不校验**：错误 key、甚至不带鉴权头都返回 200。
  → 探测代理死活**不能**靠鉴权失败，要打 `/v1/models` 或发真实请求（ping ≈ 0.63 s）。
- **代理活得比 Claude Code 久**（PPID 1，已连跑 2 天），但活不过重启 →
  fixture 降级是**兜底而非常态**，仍然必需。
- 无任何 OpenAI / Gemini / Replicate / Stability key。
- Node v22.23.2、npm 10.9.8、pnpm、bun 可用；**Playwright 未安装**。
- 仓库里**一张图片都没有**（png/jpg/webp/svg 全查过，零结果）。

### 已知代码缺陷（票 08 处理）

`state-machine.ts` 只有 `repairing → building`，跳过 `generate`。因此 repair plan
里的 asset action **永远不会被执行** —— 这正是 `DefaultRepairEngine.execute()`
是空函数也能「跑通」的原因。

## Decisions so far

<!-- 一行一张已关闭的票：够判断相关性即可，细节去票里看 -->

- [本地模型代理的真实调用契约是什么？](issues/01-proxy-api-contract.md)：
  代理是 CC Switch，**三种协议都通但走不同上游** —— 视觉只能走 `/v1/messages`
  （实为 qwen3.8-max，`/v1/models` 的 image 模态声明是假的，DeepSeek 收到的是
  `[Unsupported Image]`）；`tool_choice` 强制 JSON 只有 1/3 可靠，
  **纯文本 JSON 9/9 通过**；鉴权完全不校验；延迟 6-136 s（推理 token 占 80%）。
  **两处推翻既有决策**：Q8 的模型分工改为按模态、Q17 的 10 分钟 budget 大概率超支
  （已开[票 19](issues/19-latency-budget.md)）。
- [Asset 的表达形式：「绘制代码 + 参数」具体长什么样？](issues/05-asset-representation.md)：
  选 **E = 严格 DSL + 数值曲线**（`drawlist+curve/v1`）。五候选实测对比后，
  E 拿到 D 的全部表现力而**不透明字符串仍为 0**：曲线用数值控制点列而非 SVG `d`，
  因此色板绑定、一层 Zod 校验、静态包围盒、解析期拒绝非法输入**全部保留**。
  A 出局（hex 烧死、换色板须重生成）、C 出局（包围盒不可知、坏资源在 import 期炸掉整个模块）、
  D 出局（`d` 不透明 → 包围盒**低估**会漏报 scale 越界、坏 `d` 到渲染期才发现）、
  B 差一步（可检查性满分但画不了有机曲线，与 cozy 圆润风冲突）。
  唯一代价：包围盒从精确变**凸包上界**（实测高估 2px，方向安全）。
  原型归档在分支 `prototype/asset-representation`。

## Not yet specified

朝着 Destination、但现在还不够锐利无法成票的区域。随着前沿推进逐块毕业。

- **CLI 的确切形态**：参数名、进度输出格式、退出码语义、跑完是否自动开浏览器。
  等降级机制（票 14）定了才好定 —— CLI 需要告诉人类「这次是 fixture run」。
- **视觉模型打分作为结构化校验的补充**：文档 P2「Advanced visual evaluation」。
  票 12 会给出结构化校验能覆盖什么，剩下覆盖不了的才轮到视觉模型，届时才知道值不值得。
- **可选的位图生成 adapter**：Q3 否掉了位图作为主干，但 `AssetGenerator` port 天然
  可插一个真图像 API adapter 作为增强。要不要插、插哪家，等程序化路线跑通后才有判断依据。
- **资源并发生成与依赖调度**：文档第 63 节的 dependency graph、P2 的 parallel
  asset generation。串行版本先跑通，才知道并发是不是真瓶颈。
- **自动 prompt 优化**：文档 P2。取决于票 16（repair 动作集）里 LLM 到底承担多少。
- **多场景 / 多关卡结构**：V1 是 single scene。票 05 已确认「场景不是一种 Asset」
  —— drawlist 没有「实例化另一个资源」的 op，所以**场景组合归 Game Config**（票 09）。
  「关卡」在单场景内怎么表达（地块解锁？进度门？）也在票 09 里定；
  **跨场景**的结构要等单场景跑通后才看得清。
- **生成范式扩展到 Q15-A 之外**：如果「数据 + 纯函数」范式撑不住某类游戏，
  放宽到哪一档、怎么保证 bridge tag 不被漏挂，现在无从判断。
- **集成测试策略**：怎么测「AI 生成的产物」而不 flaky。等票 09/12 定了可校验的
  契约之后才有着力点。
- **成本折算成钱**：票 01 已确认每条响应都带 usage（token 数可直接记），
  但代理**不转发定价**。要不要在代码里内置牌价表折算成金额、
  以及要不要进 HTML 报告 —— 归[票 19](issues/19-latency-budget.md)第 8 条处理。

## Out of scope

被**范围**排除在 Destination 之外的东西。永不毕业；只有重画 Destination 才会回来，
且那时是一张新地图。

- **Benchmark Suite 与 E2E Creation Success Rate**（文档第 65-71、83 节）。
  文档自己说 benchmark 回答的是「能不能**稳定**创造」，而本地图回答「能不能创造
  **一个**」；且其前提是有 N 个跑通的游戏，现在连 1 个都没有。
- **Resume / Recovery / SQLite 持久化**（文档第 49-51 节、P1）。
  难点不在存，在恢复语义：`RuntimeStateSnapshot` 要能把 Phaser world 还原到
  「番茄已采摘、背包有 1 个」的中间态，这需要游戏侧支持序列化整个 world，
  是 Q15-A 范式之外的另一个大工程。（Checkpoint **写入**仍在范围内 —— 票 07。）
- **Web 控制台 UI**（上传图片、填想法、看实时进度的页面）。
  Q13 已选 CLI + 静态 HTML 报告；一个交互式前端体量不小于运行时本身。
- **React**：Q4 已排除。游戏内 UI 用 Phaser 原生 GameObject。
- **多引擎支持 / 多游戏 case / 跨项目知识复用 / 跨游戏资产库 / 模板市场**
  （文档第 3、80 节明令禁止的架构漂移）。
- **多人协作 / 联网 / MMO / 大型 3D**（文档第 3 节）。
- **完整 Event Sourcing**（文档第 28 节明确 V1 不做）。
