# 图片驱动的游戏创作工具链：两个可独立交付的产物（游戏资源包 / 可运行 demo）

Labels: wayfinder:map
Tracker: local-markdown
Effort: game-creation-v1

> **本图为重画版**（2026-09-24）。上一版终点是「一条命令全程无人工干预跑通全链路 +
> 自我修复让分数上升」，Q1–Q23 张票全部服务于那个终点。人类在 2026-09-24 把终点
> 改成**两个可独立交付的产物**，因此地图重画：闭环那条脊柱整体出局（见 Out of scope），
> 7 张票改写、7 张保留、9 张关掉。上一版的 20 项锁定决策里，与闭环无关的仍然有效。

## Destination

把「图片驱动的游戏创作」做成**两个可以分开交付、分开使用**的产物，每个产物都能被
**agent** 与**命令行**两种方式调用。

**产物 A —— 游戏资源包。**
输入「一张风格参考图 + 一段需求」（可选再给一份显式资源清单，或一批**人工导入的位图素材**），
输出一个**引擎中立**的资源包：
玩家动画、背景、UI 资源，交付形态是 **PNG + 标准图集/动画元数据**，
并附带创作态的 drawlist 源文件与 StyleSpec。验收两件事：

1. 包里的资源**能被随便一个引擎直接拿去用** —— 不需要本项目的 runtime。
2. 包里所有资源**看起来属于同一个视觉世界**，**包括参考图里根本没出现过的新事物**
   （牛、拖拉机、招牌）。后者是这条链最容易失败、也最容易被忽略的维度。

**产物 B —— 可运行 demo。**
输入「一个资源包 + 一段需求」，输出一个**静态可托管、打开即玩**的小型横版游戏目录：
手写固定、永不改变的 runtime 外壳 + AI **只产出的数据**（连一行代码都不生成）。
验收：一条命令跑完，**起一个静态 HTTP server**（`python3 -m http.server` 级别）打开就能玩，
且**不吃生图能力**（喂 fixture 资源包也能跑）。

⚠️ **「打开即玩」的准确含义已由[票 03](issues/03-phaser-vite-playwright-chain.md) 实测钉死：
不是 `file://` 双击打开** —— 那做不到。两个互相独立的原因：Vite 产出的 module script 撞 CORS
（HTML 规范要求 module script 走 CORS），以及 **Phaser 的 loader 整个建立在 XHR 上——连 PNG 都走 XHR**。
最阴险的是绕开 Vite 之后：游戏能启动、canvas 出来、横幅正常打印，**却一张图都不加载且不报错**。
产物 B 的构建实测**亚秒级**（280–459 ms），资源包体积对构建耗时几乎无影响。

**两个产物之间只有数据文件依赖、没有代码依赖。** 仓库以 monorepo 承载，
资源管线 / demo 管线 / 契约 / CLI / MCP 各自可独立打包。

**本 effort 明确不做**：自动评分、门禁、自我修复闭环 —— 那另开一张地图（见 Out of scope）。

## Notes

### 领域与代码位置

- 技术规范：`docs/文档.md`（83 节，中文）。⚠️ **它是上一版终点的规范，其
  QA/Gate/Repair/Benchmark 章节（29–51、65–71、74–75）在本地图中已出局**，
  仍然有效的是契约章节（11–28、52–63）。
- 现有代码：`packages/` 五个包（2026-09-24 由票 07 从 `demo/` 迁出）。
  `contracts` 有真实 schema，`assets` / `demo` / `cli` / `mcp` 是空壳，各自的落地票写在文件头。
- 领域词汇表：`CONTEXT.md`（仓库根）。本轮已按 R3 修正 **Asset** 的定义
  （从「就是一份 DrawList」改为「有创作态与交付态两种表达」）。

### 每个 session 开工前必读

1. 本图（尤其 R1–R9 锁定决策表）
2. `CONTEXT.md`
3. 所claim的票的完整正文 + 它的 blockers 的 Answer

### 按需调用的 skill

- 架构/接口设计票 → `codebase-design`
- 术语冲突或新概念 → `domain-modeling`（并同步更新 `CONTEXT.md`）
- 造具体东西给人 react → `prototype`
- 查第三方事实 → `research`
- 压力测试决策 → `grilling`
- 造像素/动画资源本身 → `game-assets`

### 版本控制约定

**规划产物（`.scratch/` 与 `CONTEXT.md`）直接提交到 `main`，不走分支 / PR。**
理由：这张地图是**跨 session 的协调产物** —— 其他 session 靠读它判断哪张票被认领了、
哪些决策已锁定。放到分支上就看不见了，协调即失效。
`提交` 与 `推送` 分开：人类说「提交」时只 commit，不 push。
（research 票的产物同理，落在 `.scratch/game-creation-v1/research/`。）

### 本 effort 的执行模式

**覆盖 wayfinder 的「只规划不执行」默认**：终点是两个真产物，所以地图里有执行票
（`task` 类型会真的写代码）。但执行票只能在其依赖的设计票 resolved 之后才建 ——
不要提前把 fog 切成执行票。

### 本轮锁定（2026-09-24 grilling 产出，不得重开）

| # | 决策 |
|---|---|
| **R1** | 终点 = 两个可独立交付的产物。**重画本图的 Destination，不新开地图** |
| **R2** | **自我修复 / 门禁闭环整体出局**（另开一张地图）。只保留**生成路径上**的确定性校验：schema 校验、色板引用、包围盒/尺寸越界 |
| **R3** | **交付态 = 引擎中立的位图**（PNG + 标准图集/动画元数据）；**drawlist = 创作态主干**（可静态校验、可 diff、可精确修），随包交付作源文件。<br>⚠️ **2026-09-24 修正**（[票 35](issues/35-bitmap-provenance.md)）：交付态 PNG **全部**由光栅化器产出；「位图原生创作态」保留但**降格为人工导入通道**，**管线永不调用生图 API** |
| **R4** | 资源种类：**sprite / animation / background / ui 四类一等公民**；**map 归 Game Config** —— 它是「引用其他资源的布局」，不是可绘制产物 |
| **R5** | 消费形态：**core 库 → CLI → MCP server**。CLI 与 MCP 都是 core 的薄壳；**MCP 不 shell out 到 CLI**，避免两层进度协议 |
| **R6** | A 与 B **完全解耦**：A 不需要游戏，B 不需要生图能力，两者之间只有一个可序列化的资源包文件。仓库内置 fixture 资源包 |
| **R7** | 资源清单**两条路都开**（人给 / 由需求推导），但**清单先落盘成文件**；之后两条路完全同构 |
| **R8** | demo = **固定 runtime + 数据**，AI **一笔代码都不写**。（Q15 再退一步：从「数据 + 纯函数」退到「只有数据」—— 绘制整体归资源管线） |
| **R10** | **位图来源 = (c)+(a)**：drawlist 是唯一的**自动生成路径**；位图只经**人工导入通道**（`inputs/`）进来，管线**零生图 API 调用**。排除「换一家商用生图 API」（无付费意愿）与「继续用 Token Plan」（违反条款）。**代价明确接受**：放弃管线全自动产出有手绘质感的角色 |
| **R11** | **StyleSpec = 人机协作的一次交互产出**：人在 Claude Code 会话里让模型看图、产出 StyleSpec JSON、存成文件，**管线只消费文件**。这本就是条款点名的允许场景，且与 R7「清单两条路都开」同构。**产物 A 的入口因此是「一条命令 + 一次人工提取」，不是全自动** |
| **R9** | monorepo **按产品切**：`contracts` / `assets` / `demo` / `cli` / `mcp`。npm 包为主；`cli` 额外出单文件 bundle；`mcp` 出 `npx` 可起的 stdio server；**资源包与站点目录是 zip / 目录，不是 npm 包** |

### 继承自上一版、仍然有效

| # | 决策 |
|---|---|
| Q4 | **Phaser 3 + Vite，不用 React** |
| Q6 | 自我迭代 = 单调改进 + Best Artifact 回滚 —— ⚠️ **随 R2 出局**（对将来的闭环地图仍有效） |
| Q7 | 参考图由人类提供；**未提供 → 程序化造一张**（票 04） |
| Q9 | 产物全 gitignore，只提交 `inputs/` + `fixtures/` —— 目录形态被 R9 取代，**精神保留** |
| Q10 | Runtime Bridge = 手写固定 SDK，不由 AI 生成 —— ⚠️ **随 R2 出局** |
| Q14 | 验收 = 严格版 —— **被新版 Destination 的两条验收取代** |
| **Q20** | **Asset 创作态格式 = `drawlist+curve/v1`**（严格 DSL + 数值曲线 op）。op 集合：`rect`/`circle`/`ellipse`/`poly`/`line`/`curve`；颜色**必须**是 `palette:N` 引用，硬编码色由 schema 直接拒绝；一个 `(asset, state)` 一份 `.json`。详见[票 05](issues/05-asset-representation.md)<br>⚠️ **R3 降格它**：不再是 Asset 的**定义**，而是创作态表达 |
| — | **混合路线**：英雄角色位图、关卡几何/道具 drawlist（2026-09-23 由[票 22](issues/22-asset-generator.md)/[票 23](issues/23-bitmap-asset-pipeline.md) 确立）。R3 下升华为「**创作态 / 交付态**」两层 |

### 环境事实（已实测，不必重查 —— 细节全在[票 01](issues/01-proxy-api-contract.md) 与[票 34](issues/34-wan-quota-facts.md)）

> ⚠️ **2026-09-24 06:30 UTC 重新实测，上一版的两条环境事实已被推翻** —— 见下面标 🔴 的两条。
> 这两个发现改变了「产物 A 怎么拿到 StyleSpec 与位图」的实现路径，
> 但**没有改变 Destination**，因此不重画地图，只修正事实与相关票的范围。

- **本地代理 = CC Switch**，基址 `ANTHROPIC_BASE_URL`，凭据 `ANTHROPIC_AUTH_TOKEN`。
- 🔴 **2026-09-24 22:xx 实测：文本路径的 `/v1/chat/completions` 已经不通了 ——
  代理又故障转移到一个新 provider（`dragoncode.codes`），而那个账号
  `INSUFFICIENT_BALANCE`（HTTP 403）。** 同一时刻 **`/v1/messages` 仍然可用**
  （0.7s、干净 JSON、也仍然能收图）。票 01 那份「文本走 chat/completions」的配方因此作废。
  → 生成器的端点已做成**参数**（默认 `/v1/messages`），因为这条路在变。
  **这就是「代理活不过重启」的现场重演**：[票 14](issues/14-degradation-chain.md)（降级链）
  仍然在 frontier 上，而这次它不再是「理论上的兜底」——**它就是眼下的常态**。
  另：一端 403 期间我连试三次，同一个 provider 也不稳定（同一份 prompt 有时通有时不通）。

- ⚠️ **2026-09-24 21:xx 实测：视觉路径现在通了**（第三次翻转，见下面被划掉的那条）。
  三次探测：纯红 64×64 → "红色 #D12E2E"；纯青 `#4EBBA4` → "青绿色 #66B0A3"；
  左青右橙两色块 → "2块。左侧为蓝绿色，右侧为红褐色"（**连左右分界都对**）。
  响应 `model` 是 `deepseek-flash`（票 01 时视觉走 qwen3.8-max、票 34 时走千问），
  而 `/v1/models` 现在列的是 **Codex / GPT-5** —— 上游又换了。
  ⚠️ **两点必须一起记住**：① **色值有偏差**（`#4EBBA4` 被读成 `#66B0A3`，疑似上游对图做了重编码），
  这对「提取精确色板」是个真风险；② **无法确认现在是谁在计费**，所以
  [票 34](issues/34-wan-quota-facts.md) 那条「条款禁止管线化调用」**是否仍然适用，未验证**。
  → 这**推翻了 R11 的立论之一**（「视觉不可用」），但 R11 的另一条腿（条款）悬着。
  **R11 在锁定表里标了「不得重开」，所以我不擅自改它** —— 由人类决定是否重开。
  直接后果：[票 15](issues/15-stylespec-fixture.md)（参考图 → StyleSpec）**技术上现在可做**。

- ~~🔴 **视觉路径当前不可用**~~（**已于 2026-09-24 21:xx 被上面那条推翻**；保留原文供追溯）。
  CC Switch 请求日志显示：**千问 Token Plan**（provider `bcd60069`，唯一能收图的上游）
  最后一次成功是 **2026-09-24 01:36:33 UTC**，之后 22 次 `429 Throttling.AllocationQuota`，
  复位时间 **2026-10-15 16:00 UTC**（约 21 天后）；代理已**故障转移到 DeepSeek**
  （`331fbb23`，7856 次 200，仍在服务）。
  实测：往 `/v1/messages` 发图片块返回 **200**，但响应 `model` 是 `deepseek-flash`，
  且它**看不到图** —— 对一张 1×1 的图编出「light pink / salmon」。
  → **「参考图 → StyleSpec」这一步目前无法自动完成。**
- 🔴 **千问 Token Plan 的 key 条款禁止管线化调用**（[票 34](issues/34-wan-quota-facts.md)）。
  官方原文：Token Plan「仅限在编程工具和智能体工具（如 Claude Code、Cursor…）中
  **交互式使用**，**不可用于自动化脚本、自定义应用程序后端或任何非交互式批量调用场景**」，
  违者可能导致订阅暂停或 key 封禁。
  → **即使配额恢复，把生图编进自动化管线也是违规的。** 这是产品决策，工程绕不过去。
  ⚠️ 注意条款**明确允许** Claude Code 这类工具里的交互式使用 —— 这给了一条合法出路（见[票 35](issues/35-bitmap-provenance.md)）。
- ✅ **文本路径健康**：DeepSeek 正常服务，`thinking: {"type":"disabled"}` 后 **9s** 出结果。
  **drawlist 生成、game-config 编译、资源清单推导全都靠它，不受上面两条影响。**
- ⚠️ **StyleSpec 的 hex 落进管线时统一规范化为小写 `#rrggbb`**（票 24）——
  否则同一份色板有两种合法文本，checksum 不稳。实验产出的是大写。
- ⚠️ **不要用 `tool_choice` 强制 JSON**（1/3 通过）。**纯文本 JSON 9/9 通过**。
- ✅ **位图生图配方本身是通的**（2026-09-23 验证）：千问 `wan2.7-image-pro`，
  端点 `…/api/v1/services/aigc/multimodal-generation/generation`（**只有这条路径可用**），
  **支持参考图 base64 内联作风格条件**，7.8s/张，1024×1024。
  ⚠️ 但受上面两条约束，**它现在既跑不通也不合规**。
- **鉴权完全不校验**：探测代理死活要打 `/v1/models` 或发真实请求，不能靠鉴权失败。
- ⚠️ **`/v1/models` 当前返回空列表 `[]`**（票 01 时它列出过 deepseek 模型）——
  代理的上游配置在变，**不要把它当作稳定事实**。
- **代理活不过重启** → 生成侧降级（[票 14](issues/14-degradation-chain.md)）仍然必需，
  且**眼下它就是常态而非常态之外的兜底**。
- Node v22.23.2、npm 10.9.8、pnpm、bun 可用；**Playwright 未安装**。

### 票的状态取值

`open`（可认领）/ `claimed`（已被认领）/ `resolved`（已决议）/ `out-of-scope`（判出局，
不再毕业，见 Out of scope）。

## Decisions so far

<!-- 一行一张已关闭的票：够判断相关性即可，细节去票里看 -->

- [对外调用面：CLI 与 MCP](issues/30-cli-and-mcp-surface.md)：**产物 A 现在真的能被调用了** ——
  CLI 与 MCP 两个壳都是 core（`packages/assets/src/ops.ts`）的薄壳，MCP 不 shell out 到 CLI（R5），
  两者渲染**同一份** `CommandResult`。四个操作：`derive` / `pack` / `verify` / `inspect`
  （`site` 刻意**不占位** —— 会报「还没实现」的子命令是在给 agent 埋陷阱）。
  **降级成功 = 退出码 0**，靠 `--json` 里的 `degraded` 区分（降级是正常运营模式，票 14）；
  失败不放进 `outcome` —— 它抛，这样「成功」这个类型里没有假货。
  **路径一律相对 `outRoot`**，理由与票 24 给资源包定的一样（绝对路径把产物绑死在某台机器上）。
  MCP 长任务用**原生的 `notifications/progress`**，不搞 job id 轮询（stdio 进程短命，作业表是真复杂度）。
  工具 description 里写死三件事：做什么 / **何时用** / **什么输入会失败** ——
  `build_asset_pack` 里那句「看到 degraded 为 true 时**不要**当成正常产物汇报」是刻意写的。
  两个壳都出**单文件 bundle**（esbuild，vite/phaser external，zod 内联，裸 node 能跑）。
  🔴 **施工抓到三个真 bug**：① **`verify` 校验不过时退出码是 0**（把「失败」塞进了 `degraded`，
  而它按裁决是成功）—— 篡改过的包能骗过校验脚本；② MCP 的**回复**没走注入的 emitter（只把进度走了）；
  ③ `--help` 单独用时退 2（把「要了 help」与「不给子命令」并成了一个条件）。
  **219 条测试全绿**，四个包 typecheck 全过。

- [生成侧降级链](issues/14-degradation-chain.md)：**三层，整包降级，并且现场验证过**（今天上游真的在断）。
  ① 首选端点 → ② 备用端点（**不算降级，但记进 `provenance.transport`**）→
  ③ **程序化兜底**（不用 LLM 也出结构完整的包：尺寸/帧数/锚点全对、颜色全在色板内、能进引擎）。
  为什么不退到仓库内置的 fixture 包：**fixture 是针对特定输入的**，用户换了需求它就对不上，
  而 demo 会「假装」响应新输入；程序化兜底对**任何** spec 都成立。
  **整包降级、绝不混着来** —— 半真半假的包在风格上看得出来，而风格一致性正是验收第 2 条看的东西。
  中途断了整包重试/转兜底；失败的那次既不留工作目录也不吃版本号（补全了票 22 那条）。
  **「所有 LLM 调用点 × 所需 fixture」的答案是：不需要 fixture** —— 阻断的调用点只剩 2 个
  （清单推导有人工路径、drawlist 生成有程序化兜底），StyleSpec 按 R11 已移出管线。
  标注意外地对齐了：**票 24 的 `origin` + `provenance.mode` 本来就是为这个设计的**。
  另：**重试与降级分工明确** —— 重试吸收偶发抖动（不改变产物来源、不惊动降级链），
  降级兜底持续不可用（改变来源、必须标注），有测试守着。
  **现场验证**：`chat-completions` 403 → 切 `messages` 成功出包并记录切换；
  上游全死 → 兜底包仍过 schema、对账 0 问题。200 条测试全绿。

- [AssetGenerator：drawlist 的生成](issues/22-asset-generator.md)：**产物 A 端到端跑通了（真生成器）**
  —— 77.7s · 8 个资源 · 28 个文件 · spec↔产物对账 0 问题，**14 帧的玩家是同一个角色**。
  四条裁决：**加 `dither` op**（它是像素风里**唯一不出色板**的调色手段 —— 票 36 实测 opacity
  会产出色板外复合色，而两种色板色交替不会，所以含 dither 的资源仍是 `exact`）·
  **`characterStyle` 当自由文本、头身比从 `spec.size` 推**·
  **schema-to-prompt 渲染器收成一个模块放 `assets`**（生成与推导共用）·
  **「像不像」生成后抽查、只出观察清单不打分**。
  真跑出来的东西：**14 帧同一角色**（一次调用写死进实现）· dither 迁移了但**用过头**（读起来是噪点）。
  🔴 **抽查真的抓到结构化校验查不出的**：导入的那张背景「有平滑渐变、橙色超标、带透视」——
  **量化到 9 色不会把一张照片变成像素画**。这正是 `paletteBinding: quantized` 这个字段的意义。
  施工抓到三件：失败构建白吃版本号（改成成功才改名）· `max_tokens` 8192 截断被误报成
  「JSON 不合法」（改成读 `stop_reason` 分开报）· 偶发坏 JSON（加了**有界重试**，不是修复循环）。
  另：抽查工具自己被抓出一个 `Buffer.copy` 参数写反的 bug —— **是抽查替我发现的**。
  ⚠️ **`/v1/chat/completions` 现已 403（`INSUFFICIENT_BALANCE`，provider 换成了 dragoncode.codes）**，
  `/v1/messages` 仍可用 ⇒ 端点做成参数。见 Notes 的「环境事实」。

- [资源包的组装](issues/38-asset-pack-assembly.md)：**产物 A 的组装链路端到端通了** ——
  `buildAssetPack()` 落进 `packages/assets`：清单 + StyleSpec → 一个通过校验、逐字节可复现、
  能被任何引擎直接吃掉的包。**端到端实测**（真实推导的清单 + 真实 StyleSpec）：
  215 ms · 28 个文件 · 1106 KiB，生成与导入**两条路都跑到**，spec↔产物对账 **0 问题**。
  关键设计：**drawlist 生成器是注入的端口**（`DrawListGenerator`）——
  组装因此可以完全离线测试，而「把网络调用埋在组装里，包为什么长这样就无法被测试」。
  **它是产物 A 的出口，所以最该被测清楚。**
  验过：确定性（**含 PNG 逐字节相同**）· 可消费性（TexturePacker JSON Hash，帧字段恰好是
  Phaser 真读的 6 个）· 可搬走（相对 POSIX）· 绝不覆盖（`v<N>` 递增）。
  施工抓到两件：`original` 用了 `process.cwd()`（**会让 manifest 随 cwd 变**，破了确定性）；
  图集文件名与票 24 定的 `delivery/atlas.<name>.json` 不一致（是验证脚本报文件不存在才暴露的）。
  ⚠️ **产物 A 现在只差票 22**（真 drawlist 生成器）—— 组装跑的是桩。
  `coverage.unbound` **恒为 0**（本管线产不出它，契约留给别的生产者）。
  另传给票 18：版本递增是「扫描目录取 max+1」，**未加锁**。

- [需求 → 资源清单的编译](issues/28-recipe-compilation.md)：`asset-recipe/v1` ——
  **嵌套 `{spec, source}` 两层**。清单**不是** manifest 的输入版（票 20 定的 Spec/Artifact 两层），
  两者不共用类型、不互相扩展；有测试守着「拿 manifest 形状当清单喂进去会被拒」。
  `source` 只有 `generate`（**不写任何路径** —— 路径是产物）与 `import`（票 23 的两种形态）；
  **目标尺寸不写在 source 里**，它就是 `spec.size`，不会出现两份互相矛盾的尺寸。
  推导的输入 = **需求文本 + 已存在的 StyleSpec 文件**（参考图不进 prompt，R11 定了那条通道的产物就是它）
  —— 但 StyleSpec 的 `material`/`shapeLanguage` 词汇**明确出现在**推导出的资源描述里。
  **两阶段**：先出清单、人过目、再生成（清单是最后一个能廉价改主意的地方）。
  **不承诺幂等，承诺冻结**：再推导产出新文件、绝不覆盖，下游只认文件。
  `dependencies` 只进清单、只用于生成顺序，且引用的 id 必须在清单里。
  **实物验证**：真跑了一次推导（需求文本 + 真实 StyleSpec → LLM）——
  **14.8s、一次通过 schema、8 个资源**；实例固化在 `fixtures/recipes/shift-change.json`。
  🔴 **两次推导暴露两件事**：① 模型默认会把角色的每个动作**拆成一个资源**，
  而那正好打掉票 22 的帧间一致性（多状态必须一次调用生成）—— 写进 prompt 规则后自己收成一个资源；
  ② **锚点是推导里最不可靠的字段**（两次跑，货箱 `(0.5,1)` vs `(0.5,0.72)`）——
  因为推导发生在产物之前、模型看不到画，而票 26 又裁定锚点不能自动推 ⇒ 两阶段里人该重点看它。
  **解除阻塞：38（产物 A 最后一个缺口）。**
  ⚠️ 顺带实测到**一条环境事实翻了**：**视觉路径现在通了**（三次探测全对）——
  详见 Notes 的「环境事实」，R11 是否重开由人类定。

- [AssetSpec 的四类扩展](issues/27-asset-spec-kinds.md)：`AssetSpec` 扩成四类，
  **两个逃生舱（`visual` / `geometry`）删除** —— R2 之后确定性校验是唯一的质量控制，
  而 `z.record(z.unknown())` 正是「校验不到的地方」。
  四类共用 `id/role/description/styleId/**anchor**/size/dependencies/required`，
  各自另有 `animations`（动画，帧数是**数量**不是名字）/ `layers`+`tileable`（背景）/
  `ninePatch`+`screenSpace`（UI）。`kind` 仍是**声明**的（R4 不动），但加了一致性对账。
  ⚠️ **`bg_sign` 从 `ui` 改判为 `sprite`** —— R4 把 UI 定义成「屏幕空间」，而它是世界空间的道具；
  判据是它活在屏幕空间还是世界空间，不是它长得像不像面板。代价：那个真包里**再没有真实 ui 样本**了
  （实验资产的空白，已记给票 31）。
  **尺寸校验不拍魔法阈值**：票 20 的 `boundsOfOps()` 已经返回 `{box, exact}` ——
  精确的硬失败、上界的报警告；给百分比容差反而会给最该严的精确图元白送宽容。
  新增 `audit.ts`（R2 校验的共同的家）：`checkSize()` + **`auditAssetSpec()`（spec ↔ 产物对账）**
  + UI 九宫格中央区非空。**对账当场抓到两个真问题**：真包 `build.mjs` 对导入资源永远写 `size: null`；
  而它能存在是因为票 24 把 `size` 定成了 nullable —— **已收紧为必填**。
  **126 条测试全绿**；真包四类实例对账 0 问题，反证 3/3 抓到。**解除阻塞：28。**

- [动画的表达与来源](issues/26-animation-representation.md)：四条裁决 + **`state` 在三个地方被收掉**。
  ① **动画是一个 Asset 内部唯一的分组概念**，「状态」降格为**单帧动画**
  （番茄的三个状态 = 三个单帧动画）；新增结构性规则：**多于一帧的资源每帧都必须归组**，
  否则那一帧不可达 —— 这条规则当场抓出真包 recipe 里 `player.jump` 一直没被归组。
  ② **锚点逐资源声明，不能自动推** —— 实测：player 六帧里 jump 的包围盒底边高 2px（收腿腾空），
  按 bbox 自动推会把它钉回地面、**腾空动作消失**，而其余五帧看起来完全正常。
  这正是票 23 问题 1 提的那个候选答案，它错得不显眼。③ 播放参数**资源给默认、config 可覆盖**。
  ④ **维持票 20 的裁定：形状 A 唯一落盘**。
  落点：`drawlist.state` → `frame` · manifest 的 `frames[].state` 删掉 · 引用语法收成 `{asset, anim?}`。
  `CONTEXT.md` 的 Frame / Animation / State / Anchor 四词立住（State 标注「已降格」）。
  **97 条测试全绿**；真包复跑仍合法（`player` 6 帧归成 walk/idle/jump 三个动画）。
  对票 27 / 28 / 09 各加了一条抬头说明。**解除阻塞：27。**

- [人工导入位图通道](issues/23-bitmap-asset-pipeline.md)：**六问里四问已被上游票溶解**
  （生成那半随票 35 消失、契约那问票 24 已答、repair 出局、成本随零生图 API 作废）。
  剩下的两问由原型实测裁决并落进 `packages/assets/src/import.ts`：
  **降采样 = 面积平均（alpha 加权）→ alpha 阈值 → 量化**、**颜色 = 量化到世界色板**，
  导入形态收 **单张 PNG（+ 管线容差抠背景）** 与 **一张 sheet + 网格描述** 两种。
  🔴 **原型推翻了一个隐含假设**：模型给的「像素风」图**没有像素网格** ——
  实测边缘位置对任何 k 取模都是均匀分布、相邻像素平均色差 15.07、前景 **61152 种颜色**、
  背景还不是平色（四角 4 种颜色）。所以这条通道不是「重采样回原网格」，
  是**重建**一个网格（25×48 对应 **16.9 倍**降采样）。
  不量化时 1200 个格子有 **651~771 种颜色** —— 那不是像素画，这是「必须量化」的直接论据。
  真实素材按 Q9 精神搬到 `fixtures/import/`；原型在 `experiments/bitmap-import-draft/`。
  **共 94 条测试全绿。解除阻塞：26。**

- [drawlist → PNG 光栅化器](issues/21-drawlist-renderer.md)：交付态光栅化器落进 `packages/assets`
  （raster / image / png / quantize / atlas 五块，**73 条测试全绿**）。票面正文里的
  Canvas2D 与 Phaser 翻译器**两条都作废**（交付态是 PNG，Phaser 不认识 drawlist），
  真正交付的是**编译器后端**：Node 端跑、零 DOM 依赖。
  四条硬要求全落地：**逐字节确定**（不抗锯齿 + 浮点累积 + 末次量化，三条测试守着）·
  **最近邻放大不引入插值色** · **TexturePacker JSON Hash**（只写 Phaser 真读的字段，
  逐像素核对帧落位）· **失败报 asset + op**（`palette:99` 格式合法但越界，schema 拦不住，
  必须由光栅化器定位）。`paletteColor()` 全仓库只此一处，量化与 PNG 对两条通道共用。
  🔴 **移植时修掉一个真 bug**：草案的 `decodePNG` 按**通道数**分支，而 colorType 4（灰度+alpha）
  与 6（RGBA）通道数都是 4 —— 人工导入的 `test.png` 被当成灰度读，**背景整张变灰**（只剩 5 色）。
  按 colorType 分支后解出 9 色，整个包从灰度变成青灰+奶油+橙。换实现后所有
  drawlist 光栅化的 PNG 逐字节没变 —— 移植忠实。
  **性能基线**：真实产物 0.074 ms/份，一轮 12 份含 PNG 编码 1.85 ms；最坏 ~1 ms/份。
  **光栅化不是瓶颈** —— 20 个资源约 20 ms vs 一次 LLM 调用 9 s。
  连带删掉实验里那四份重复实现（`lib/*.mjs`）。**建票 38**（包组装）。

- [把资源包 manifest 契约落进 packages/contracts](issues/37-assetpack-manifest-landing.md)：
  `assetpack/v1` 的契约落进 `packages/contracts/src/assetpack.ts` —— 票据 24 定的形状一字未改，
  superRefine 交叉校验**一条没简化**（含 **`provenance.mode` 由 `assets[].origin` 唯一派生**，
  所以「fixture 包谎报自己是 generated」是解析不通过）。9 条反例原样变成单元测试，另加 8 条，**共 49 条全绿**。
  **最有分量的证据**：票 24 真跑出来的那个包**原样通过**新契约，不是拿现造 fixture 自证。
  三处「不写两份」：`PaletteRef` / `formatIssues` / `paletteBindingOf` 全部从票 20 复用；
  顺带解掉一个命名冲突（`DrawListPaletteBinding` 两值 vs `PaletteBinding` 四值）。
  **补了票 24 欠的一个落点**：`resolvePackRef()` —— 只给 `asset` 而资源有多个可画的东西时就**失败**，
  不留到运行时。顺手补上票 24 漏落的 `StyleSpecSchema.palette` 规范化（小写 + 无重复色）。
  ⚠️ 草案那份 `schema.mjs` **已删除**（两份并存的 schema 必然漂移），
  实验的 `validate.mjs` 改为 import 真契约。

- [把 DrawList 契约与静态分析器落进 packages/contracts](issues/20-drawlist-contract.md)：
  `drawlist+curve/v1` 的 Zod 契约（六个 op 的 `discriminatedUnion`，`.strict()`）+
  `boundsOfOps()` / `resolveRefs()` / `paletteBindingOf()` 落进 `packages/contracts`，
  **21 条测试全绿**，fixtures 是原型 `GEOM` 的 8 个 `(asset,state)` 组合（仓库根 `fixtures/drawlist/`）。
  两条关键设计：**`exact` 是 `boundsOfOps()` 返回值的一部分**（含 curve 时 box 是凸包上界，
  让调用方没机会忘记，尺寸校验因此只能判过大）；`paletteBindingOf()` 是**解析期静态**的
  （票 36 的落点，票 37 直接 import）。
  🔴 **挖出一件大事**：把实验里 12 份真实产物过一遍 schema，**6 过 6 不过** ——
  `animated-player` 那 6 份全缺 `state`，根因是 `gen_player.mjs` 摊平多状态响应时忘了写。
  而模型真正产出的是**多状态文档**（一次调用出全部状态，正是票 22 证明帧间同一性所需的形状）。
  即 **Q20 的落盘粒度与生成粒度在真实产物里已分叉出两种形状**。
  本票裁决形状 A 为唯一落盘形态、`state` 必填（它是 manifest 里 state 的主来源），
  **但这是可推翻的** —— 完整证据已记进票 26 待它裁决。
  另：顺带修掉原型一个 bug（`poly` 漏了描边半宽，会让上界失效），
  发现 `StyleSpecSchema.palette` 尚未规范化（已加进票 37 射程）。

- [目录迁移：现有 demo/ 拆进 monorepo](issues/07-project-workspace.md)：
  **`packages/` 五包骨架已落地，四条验收全过**（`check:deps` / `tsc -b` / 守卫拒绝注入的
  `assets → demo` / 跨包类型经 `exports`→`dist` 解析）。`demo/` 整体删除 19 个文件 816 行；
  `contracts` 从 **32 个导出 240 行砍到 9 个 112 行**（随 R2 出局的 23 个 schema 全删），
  `test.png` → `fixtures/reference/test.png`，票 05 的原型 HTML 归档回它的实验目录。
  ⚠️ **本票正文写于旧终点，其中四条（`demo/projects/` 目录结构、`FileArtifactStore`、
  Checkpoint 写入、Store 取舍）已作废**，未按字面执行 —— 逐条交代在 Answer §2。
  施工撞出五件事，其中一条会影响所有后续票：**空测试套件会让 CI 从一开始就是红的**
  （`vitest run` 无测试文件时退出码 1）→ 暂用 `--passWithNoTests`，票 20 落真实测试时摘掉。
  另：`pnpm install` 实测 6 分 49 秒（官方源），esbuild 的 `onlyBuiltDependencies` 白名单有效。
  **解除阻塞**：20 / 21 / 18。**并暴露一个无主缺口 → 建票 37**。

- [monorepo 切分与构建工具链](issues/29-monorepo-layout.md)：**pnpm workspaces + `exports` → `dist` +
  TypeScript project references**。依赖方向由**三层结构保证**、不靠 lint：pnpm 的非扁平 `node_modules`
  （未声明的依赖解析不出来，连 `tsc` 都过不去）· 每个包的 `exports` **只暴露 `"."`**（深层 import 语法上不可达）·
  一个手写 40 行的 `scripts/check-deps.mjs`（挡住**已声明但被禁止的边** —— R6 唯一的死法）。
  允许图里 **`mcp` 不依赖 `cli`**（R5：MCP 不 shell out 到 CLI）。产物全在仓库根
  `out/<gameId>/{pack/v<N>, site}/`（兄弟目录，满足票 03「HTTP server 的根必须是父目录」）。
  V1 全部 `private: true`，只验证 `pnpm pack` 能打包。**现有 `demo/` 整体消失** ——
  816 行里只有 `contracts/` 的一部分与 `demo/test.png` 活下来。
  **实物验证**：五包等价体在 `/tmp` 跑通六条断言，并撞出三个纸上不会发现的坑
  （`tsconfig.base` 的 `outDir`/`rootDir` 按 base 目录解析、守卫抓出 mcp→cli 违规、
  pnpm 严格解析连类型检查期都覆盖）—— `experiments/monorepo-probe/`。
  **解除阻塞**：07 / 20 / 21 / 30。

- [资源包的结构与 manifest 契约](issues/24-asset-pack-contract.md)：**产物 A 的交付物 = 一个目录，
  入口是 `manifest.json`（`format: "assetpack/v1"`）**。按**表达层次**分两层 ——
  `delivery/`（引擎直接吃：按 kind 各一份 TexturePacker JSON Hash + PNG）与
  `authoring/`（本项目读：stylespec + drawlist + 导入原图），两层靠 `assetId` 联结，
  包**不含 game-config**、**不绑定游戏**。每个资源必带两个诚实字段：
  `origin`（generated/imported/fixture）与 `paletteBinding`（exact/quantized/unbound），
  包级 `provenance.mode` **由 origin 唯一派生** ⇒ 「fixture 包谎报身份」是解析不通过。
  版本目录改成 **per-pack** `v<N>`（改掉 `docs/文档.md` §21 的 per-asset `cow/v1`）。
  与 §20 的 `AssetManifest` **不是同一个东西**（那个是输入侧 + 旧闭环的过程统计，归票 28）。
  **实物验证**：用仓库里 12 份真实 drawlist + 1 张真实位图生成了一个真包，
  两次生成逐字节相同，Zod 校验通过、9 条反例全被拒 —— `experiments/asset-pack-draft/`。
  **顺带解除了** 20 / 21 / 26 / 27 的阻塞。
  ⚠️ **票 24 刻意没替票 26 定 state↔animation 的关系**，只保证两者在 manifest 里有落点；
  它同时撞出一条需要人类裁决的事，已毕业成票 36（见下）。
  另：它抬头写的目的地 `packages/contracts/` **尚不存在**，
  因此本 session 补连了 `29 → 20` 与 `29 → 21`（此前漏连的边）。

- [带 `opacity` 的 op 与「颜色 ∈ 色板」不变量](issues/36-opacity-and-palette-invariant.md)：
  **保留 `opacity`，把不变量精确化**。从「渲染后像素 ∈ 色板」改成
  「**所有颜色来源 ∈ 色板**（硬编码 hex 由 schema 拒绝，构造恒真）∧
  **复合色是色板的确定函数**（构造恒真）」—— 失效的只是前者那个更强的说法，
  而它本来就只是「没有 opacity 时」的偶然推论。
  「换色板 → 创作态文本一字不变」「换色板 → 交付态整体换色」两条卖点都还活着。
  **顺带的好处**：`paletteBinding` 对 drawlist 资源因此变成**解析期静态可判**（看有没有 `opacity`），
  不需要渲染 —— R2 要的「生成路径上的确定性校验」在解析期就完成了。
  `paletteBinding` 由 3 值扩成 4 值（新增 `composited`）。
  **否决**：禁掉 `opacity`（会判现有真实产物 `hazard` 非法，且是拿 schema 表达审美偏好）、
  混合后吸附回色板（半透明观感直接消失，代价最大）。

- [Asset 的表达形式：「绘制代码 + 参数」具体长什么样？](issues/05-asset-representation.md)：
  选 **E = 严格 DSL + 数值曲线**（`drawlist+curve/v1`）。E 拿到 D 的全部表现力而
  **不透明字符串仍为 0**：曲线用数值控制点列而非 SVG `d`，因此色板绑定、一层 Zod 校验、
  静态包围盒、解析期拒绝非法输入**全部保留**。A/C/D 分别因「hex 烧死」、
  「包围盒不可知且 import 期整模块炸」、「`d` 不透明导致包围盒**低估**（漏报方向）」出局。
  唯一代价：包围盒从精确变**凸包上界**（实测高估 2px，方向安全）。
  ⚠️ **R3 已把它的地位从「Asset 的定义」降为「创作态格式」**。
- [本地模型代理的真实调用契约是什么？](issues/01-proxy-api-contract.md)：
  代理是 CC Switch，**三种协议都通但走不同上游**，视觉只能走 `/v1/messages`；
  `tool_choice` 强制 JSON 只有 1/3 可靠，**纯文本 JSON 9/9 通过**；鉴权完全不校验；
  延迟 6–136 s。它是本图**环境事实**一节的来源。

- [千问 Token Plan 的生图配额与计费事实](issues/34-wan-quota-facts.md)：
  两条都会推翻既有假设：[① 配额与聊天**共享同一个 Credits 池**，超了直接阻断]，
  复位 2026-10-15；**[② 条款禁止管线化调用]**（原文只许「编程/智能体工具中交互式使用」，
  禁止「自动化脚本、应用后端、非交互式批量调用」），违者封 key。
  另有可用事实：`wan2.7-image-pro` **0.50 元/张**（按张不按分辨率）、**RPS 5 / 并发 5**、
  图生图与文生图同价且输入图不计费、局部编辑是 **`bbox_list` 框选不是 mask**。
  **查不到的**：Token Plan 一张图扣多少 Credits（官方无系数表）→ 票 19 的成本账算不出来。
  ⚠️ 本票主 session 复核时补充了两条本票未察觉的事实：代理**已故障转移到 DeepSeek**，
  因此「文本路径照常可用」；以及**条款明确允许 Claude Code 类工具的交互式使用**（见票 35）。

- [产物 B 怎么构建、怎么静态托管？](issues/03-phaser-vite-playwright-chain.md)：
  **`file://` 双击打开做不到** —— 两个互相独立的原因：Vite 的 module script 撞 CORS，
  且 Phaser 的 loader 整个建立在 XHR 上（连 PNG 都走 XHR）。
  所以「打开即玩」= **起一个静态 HTTP server 后打开即玩**。
  `base: './'` 是必须的（产物目录可整体搬走）；资源包推荐「站点目录 + 同级 pack 目录」，
  代价是 **HTTP server 的根必须是父目录**（这一条要进契约）。
  构建耗时 **280–459 ms**，资源包体积对耗时几乎无影响。
  附带发现：Phaser 打进 1.2 MB chunk 必然触发告警（→票 07）；
  Phaser 有 `loaderBaseURL` 钩子，**装配 API 应带「包基址」参数而不是写死路径**（→票 33）。
- [交付格式规格：图集与动画元数据用什么标准？](issues/25-delivery-format-spec.md)：
  **没有跨引擎标准** —— 事实上的通用层是 **TexturePacker 的 JSON Hash / JSON Array**
  （Aseprite 的对应导出格式字段名**逐字相同**），**Phaser 3 原生就能读、不需要转换器**。
  两者唯一差别是 `frames` 是对象还是数组。
  🎯 **对本图最重要的一条**：**锚点是每帧的 `anchor` 字段**（归一化到未裁剪的 `sourceSize`），
  而 Phaser 的 `setCurrentFrame` **会逐帧重设 origin** ——
  所以「角色各帧各自声明锚点」是**原生支持、零运行时代码**的，正合 R8。
  Aseprite 的 `meta.slices[].pivot` **Phaser 一行都不读**。九宫格 = 每帧 `scale9Borders`，
  `this.add.nineslice()` 零参数自动读，**仅 WebGL**。
- [位图从哪来：生图能力的合规使用边界](issues/35-bitmap-provenance.md)：
  定了 **(c)+(a)** 与**人机协作产出 StyleSpec**（见 R10 / R11）。
  管线**永不调用生图 API**，位图只经人工导入通道；StyleSpec 由人在会话里产出、管线只消费。
  **代价明确接受**：放弃管线全自动产出有手绘质感的角色；
  **换来**今天就能开工、将来也不怕封号的产物 A。
  附带记下一条**未探的回头路**：CC Switch 里还有 `dragoncode.codes`（票 01 记「未测」）
  与 Claude Official / Google Official 三个 provider，本次没有探。

## Not yet specified

朝着 Destination、但现在还不够锐利无法成票的区域。随着前沿推进逐块毕业。

- **多关卡 / 多场景结构**：V1 是单关卡还是单场景？跨关卡的结构、关卡之间的资源复用与
  进度门，等[票 31](issues/31-first-demo-game.md)（第一个游戏是什么）与
  [票 09](issues/09-game-config-contract.md)（map 归 Game Config）定了「单关卡怎么表达」
  才看得清。
- **资源包的增量生成与复用**：已有资源包能不能「再补三个资源」而不重跑全部？
  增量对 manifest 形状与版本化的要求，等[票 24](issues/24-asset-pack-contract.md)
  与[票 18](issues/18-artifact-ref-consistency.md)定了才锐利。
- **新资源的风格一致性怎么判**：R2 砍掉了自动评分，于是「像不像同一个视觉世界」
  在 R4 的四类资源上没有自动判据 —— 目前只有人眼 + 参考基准。
  ⚠️ **「引入视觉模型抽查」这条选项现在也断了**（R10/R11：视觉上游不可用且条款受限），
  所以这个问题在当前环境下**只剩人眼一条路**。等[票 24](issues/24-asset-pack-contract.md)/
  [票 27](issues/27-asset-spec-kinds.md)定了可校验面，才看得清创作态的结构化校验还差多少。
- **批量生成的并发与依赖调度**：一次要生 20 个资源，串行可能要几分钟。
  ⚠️ R10 之后**约束变了** —— 不再受生图配额限制（管线不调生图了），
  剩下的瓶颈是 LLM 调用（9s/次）与光栅化。依赖图（票 05 结论：依赖只用于**生成顺序**）
  怎么调度，等[票 28](issues/28-recipe-compilation.md)定了清单形状再说。
- **生成 prompt 的自动优化**：StyleSpec → 生成调用的 prompt 模板（票 22 问题 4 的
  schema-to-prompt 渲染器）要不要按失败样本自我改进。
- **成本折算成钱**：代理不转发定价，要不要内置牌价表把 token 折算成金额。
  归[票 19](issues/19-latency-budget.md)。
- **多引擎导出**：R3 让资源包引擎中立，但「中立到什么程度」只有真接第二个引擎时才知道。
- **多张参考图**：目前假设一张；多张风格图怎么合并成一个 StyleSpec。

## Out of scope

被**范围**排除在 Destination 之外的东西。永不毕业；只有重画 Destination 才会回来，
且那时是一张新地图。

- **自动评分 / 门禁 / 自我修复闭环**（[票 06](issues/06-html-report.md)、
  [票 08](issues/08-state-machine-conditional-repair.md)、
  [票 10](issues/10-runtime-bridge-sdk.md)、
  [票 11](issues/11-semantic-action-mapping.md)、
  [票 12](issues/12-structural-visual-qa.md)、
  [票 13](issues/13-gameplay-test-derivation.md)、
  [票 16](issues/16-repair-actions.md)、
  [票 17](issues/17-repair-progress-rollback.md)）。
  由 R2 判出局 —— 它回答的是「AI 能不能**自己**判断做得好不好并改进」，
  而本图回答「能不能**产出**两个可用的东西」。两者都需要，但**先立产物再立闭环**：
  闭环的 repair 对象在 R3/R6 之后变成了「资源包」和「demo」两种不同粒度，
  不先划清产物边界就会重画一次。
  ⚠️ **票 12 的确定性检查不是丢掉，是搬家** —— 凸包容差、尺寸越界并入
  [票 27](issues/27-asset-spec-kinds.md) 的 AssetSpec 校验规则。
- **Runtime Bridge 与语义测试动作、Playwright 驱动的玩法验证**
  （[票 02](issues/02-phaser-plugin-api.md)、[票 10](issues/10-runtime-bridge-sdk.md)、
  [票 11](issues/11-semantic-action-mapping.md)）。
  它们是 QA 的地基，地基随 QA 一起走。R8 之后产物 B 的「能跑」由**外壳恒可运行**结构性保证，
  不需要观察设施。
- **Web 控制台 UI**（上传图片、填想法、看实时进度的页面）。R5 已选 CLI + MCP，
  一个交互式前端体量不小于管线本身。
- **React**（Q4 已排除）。游戏内 UI 用 Phaser 原生 GameObject。
- **多引擎运行时 / 多游戏模板 / 跨项目知识复用 / 跨游戏资产库 / 模板市场**
  （`docs/文档.md` 第 3、80 节明令禁止的架构漂移）。
  ⚠️ 注意与 R3 的「交付态引擎中立」区分：**产物中立**不等于**运行时支持多引擎**。
- **多人协作 / 联网 / MMO / 大型 3D**（`docs/文档.md` 第 3 节）。
- **完整 Event Sourcing**（`docs/文档.md` 第 28 节明确 V1 不做）。
- **Benchmark Suite 与 E2E Creation Success Rate**（`docs/文档.md` 第 65–71、83 节）。
  它回答「能不能**稳定**创造」，前提是有 N 个跑通的游戏，现在连 1 个都没有。
- **Resume / Recovery / SQLite 持久化**（`docs/文档.md` 第 49–51 节）。
  难点不在存，在恢复语义。
