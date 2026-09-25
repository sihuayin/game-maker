# 30. 对外调用面：CLI 与 MCP

Type: grilling
Status: resolved
Blocked by: 24, 29
Map: ../map.md
> 🔴 **票 28 已 resolved —— 操作集合要加一个**（2026-09-24）：
> `asset-recipe/v1` 的形状已定，且**推导与生成被定成两阶段**（先出清单、人过目、再生成）。
> 所以 CLI/MCP 至少要暴露三个动作：**推导清单** · **生成资源包** · **构建 demo**。
> 「推导清单」把 `requirement.md` + StyleSpec 变成一份清单文件（不覆盖旧的）；
> 「生成资源包」消费清单。契约见 `packages/contracts/src/recipe.ts`。


> R5 定了 core 库 → CLI → MCP 三层，且 **MCP 不 shell out 到 CLI**。
> 本票定**对外到底暴露哪些操作**，以及这些操作在两种形态下分别长什么样。
> 这是「agent 使用」与「命令行自行调用」两个使用方式的**唯一**实现处。

## Question

1. **操作集合**。按 R6 的两次交付，至少要有「生成资源包」和「构建 demo」两个动作；
   但[票 28](28-recipe-compilation.md) 的两阶段流程会再加一个「只推导清单」。
   完整集合是什么？还要不要「校验一个已有资源包」「列出包里有什么」
   「只重新生成某几个资源」（增量，fog 里那块）？
2. **CLI 的确切形态**：子命令名、参数名（`--reference` / `-r`？）、
   资源清单与需求文本怎么传（文件？stdin？内联字符串？）、
   **进度输出格式**（人类看的行 vs 机器可解析的？`--json`？）、
   **退出码语义**（成功 / 参数错 / 上游不可达 / 配额耗尽，各自几号）、
   跑完要不要自动开浏览器（上一版 fog 里那条，现在仍没答案）。
3. **MCP 的工具面**：暴露哪些 tool、每个 tool 的输入/输出 schema、
   **产物路径怎么返回**（绝对路径？相对于某个根？）、
   **长任务的进度怎么给**（MCP 没有原生的长任务进度 —— 是同步阻塞、
   还是返回 job id 让调用方轮询一个 `get-status` tool？）。
   这一条决定 MCP 的实现复杂度，是本票最难的点。
4. **两种形态的信息一致性**：同一个操作，CLI 打印的和 MCP 返回的必须是**同一份数据**
   （R5 已经排除「MCP 转调 CLI」的实现方式，所以是 core 返回结构体、
   两个壳各自渲染）。那个**结构体**的形状是什么？它其实是 core 的公开 API 的一部分。
5. **降级标注怎么让调用方看见**（与[票 14](14-degradation-chain.md) 对齐）：
   agent 必须能知道自己拿到的是不是 fixture 产物。
6. **agent 专用考虑**：MCP tool 的 description 要不要内嵌「什么时候该用这个工具、
   什么样的输入会失败」？这份说明归谁维护（与票 22 问题 4 的 prompt 模板是同类问题）？

## 产出要求

调用 `grilling` skill。产出 **CLI 的完整参数表 + MCP tool 的 schema 草案 +
core 返回结构体的草案**。若第 3 条（MCP 长任务进度）难判，
调用 `prototype` skill 起一个最小 stdio MCP server 实测两种方案的可行性。

## Answer

**结论：CLI 与 MCP 两个壳落地，都是 core 的薄壳（R5：MCP 不 shell out 到 CLI）。
四个操作 · 单文件 bundle · 219 条测试全绿。产物 A 现在**真的能被调用了**。**

### 0. 四条裁决

| 问题 | 裁决 |
|---|---|
| 操作集合 | **四个**：`derive` / `pack` / `verify` / `inspect`（`site` 留给票 32/33） |
| 降级成功 | **退出码 0**，靠 `--json` 里的 `degraded` 区分 |
| MCP 长任务进度 | **同步阻塞 + MCP 原生的 `notifications/progress`** |
| core 返回结构体 | `CommandResult`；**路径一律相对于 `outRoot`** |

### 1. 操作集合与退出码

| 子命令 | 做什么 | 什么时候用 |
|---|---|---|
| `derive --requirement <需求.md> --style <stylespec.json>` | 需求 + StyleSpec → 资源清单（`asset-recipe/v1`） | 两阶段的第一步；清单**绝不覆盖**，每次写 `v<N>` |
| `pack --recipe <清单.json>` | 清单 → 一整个资源包（含降级链） | 清单过目定稿之后 |
| `verify <资源包目录>` | manifest schema + **逐文件 checksum** + `files[]` 覆盖 | **唯一能发现「包被人手改过」的手段**，要主动跑 |
| `inspect <资源包目录>` | 包里有什么：kind / 尺寸 / 来源 / 色板绑定 / 帧与动画 | **写游戏配置之前** —— 得先知道动画叫什么名字 |

```
退出码  0 成功（**包括降级成功**）
        1 失败 · 2 参数错 · 3 上游不可达 · 4 产物/清单不合法
```

**降级为什么是 0**：降级是正常运营模式（[票 14](14-degradation-chain.md) 的结论），产物可用且已标注。
给它一个独立退出码会让每个 `set -e` 的调用方都得额外处理一个**其实是成功**的结果。
脚本要分支就读 `--json` 里的 `degraded`。

### 2. CLI 与 MCP 渲染的是**同一份** `CommandResult`

R5 排除了「MCP 转调 CLI」，所以 core 返回结构体、两个壳各自渲染：

```ts
type CommandResult = {
  command: string;
  outcome: "ok" | "degraded";        // 失败**不在这里** —— 它抛 CommandError
  summary: string[];                 // 人类可读的几行
  data: Record<string, unknown>;     // 机器可读的载荷
  artifacts: { path: string; kind: string }[];   // **相对 outRoot**
  degradations: [...]; transport?: {...}; probes?: [...];
};
```

**路径为什么相对 `outRoot`**：绝对路径把「产物在哪儿」与「这台机器上的哪里」绑死 ——
而[票 24](24-asset-pack-contract.md) 已经为资源包避开了同一个错（包内一律相对路径）。
MCP 把路径交给 agent 时，agent 自己知道根在哪。

实测同一份数据的两副面孔：

```
$ game-maker inspect out/shift-change-assets/pack/v5
shift-change-assets v5 · mixed
8 个资源 · 3 张图集
  player-odin · animation · 32×48 · generated/exact · 14 帧 · 动画 idle(4) run(6) jump(4)
```

```json
{"command":"inspect","outcome":"ok","degradations":[],"summary":[…],
 "data":{"packId":"shift-change-assets","version":5,"provenanceMode":"mixed",
         "assets":[{"id":"player-odin","kind":"animation","size":{"w":32,"h":48},
                    "origin":"generated","paletteBinding":"exact","frames":14,
                    "animations":[{"name":"idle","frames":4,"fps":5,"loop":true}, …]}]}}
```

### 3. MCP 的工具面

四个 tool，输入 schema 是 JSON Schema。**每个 description 都写死了三件事**：
它做什么 · **什么时候该用** · **什么样的输入会失败**（票面问题 6）。

`build_asset_pack` 的 description 里有一句是刻意的：

> ⚠️ **降级成功仍然是成功** —— 返回值里的 `degraded` / `degradations` 会告诉你是哪一层，
> 以及产物是不是兜底画出来的色块。**看到 `degraded` 为 true 时不要当成正常产物汇报。**

**进度通知**：请求带 `_meta.progressToken` 时，服务端边跑边发
`notifications/progress`。实测 `pack` 会逐资源报「正在生成 X（3/8）」。
不搞 job id 轮询 —— MCP server 是短命的 stdio 进程，维护一份作业表反而是真复杂度的来源。

**失败不抛**：MCP 的协议里没有「异常」这个信道，所以失败回
`{isError: true, _exitCode: 2, content: [...]}`。

### 4. 🔴 施工抓到的三件事（都是真 bug）

**① `verify` 校验不过时退出码是 0。** 我把「校验不过」塞进了 `outcome: "degraded"` ——
而 `degraded` 是票 14 的「降级」，按裁决就该成功。于是**一个被篡改过的包 verify 之后退 0**，
而那正是 checksum 存在的意义。改成：校验不过是**失败**，抛 `CommandError("invalid")` → 退出码 4。
实测（篡改一个字节）：

```
$ game-maker verify /tmp/tamper
✗ 校验不过（1 处）：checksum 不符：delivery/atlas.sprites.png    退出码 4
```

**② MCP 的回复没走注入的 emitter。** `handle()` 只把**进度**走注入、回复写死 stdout，
于是测试收不到任何回复、还把 stdout 刷满了。改成**所有出站消息都走注入的 `emit`**。

**③ `--help` 单独用时退 2。** 我把「要了 --help」与「不给子命令」并成了一个条件 ——
但前者是**成功**（用户得到了他想要的），后者才是用法错。

### 5. 交付物

两个壳都出**单文件 bundle**（R9 的要求）：`esbuild` 直接调，`vite` 与 `phaser` external，
zod 与内部包全部内联。实测两个 bundle 都能用裸 `node` 跑，不依赖 `node_modules`：

```
packages/cli/dist/cli.mjs      241 KB
packages/mcp/dist/server.mjs   245 KB
```

### 6. 落地清单与验收

| 文件 | 内容 |
|---|---|
| `packages/assets/src/ops.ts` | **新增** —— core 的公开操作面：`CommandResult` · `EXIT` · 四个操作 |
| `packages/cli/src/cli.ts` | **新增** —— 手写参数解析 · 人类渲染与 `--json` · 退出码 · 可注入的出站 |
| `packages/mcp/src/server.ts` | **新增** —— stdio JSON-RPC server · 四个 tool · 进度通知 |
| `packages/assets/src/pack.ts` 等 | `onProgress` 逐资源透传（MCP 的进度用它） |
| 两个壳的 `package.json` | `bundle` 脚本 + `bin` 指向单文件 |

| # | 检查 | 结果 |
|---|---|---|
| ① | 全部测试 | ✅ **219 passed**（12 个文件） |
| ② | 四个包 `typecheck` | ✅ |
| ③ | 两个 bundle 用裸 node 跑通 | ✅ |
| ④ | MCP 实测：四工具 / 进度通知 / 篡改包 `isError` + `_exitCode: 4` | ✅ |
| ⑤ | `pnpm check` | ✅ |

### 7. 留给下游

- **[票 31](31-first-demo-game.md) / [票 32](32-runtime-shell.md) / [票 33](33-runtime-assembly.md)**：
  `site`（构建 demo）这个动作**刻意没占位** —— 做一个会报「还没实现」的子命令是在给 agent 埋陷阱。
  等那三张票落地，壳是薄的，加一条很便宜。
- **[票 18](18-artifact-ref-consistency.md)**：`derive` 与 `pack` 都写了新的 `v<N>`（都与「绝不覆盖」一致）。
  并发写同一个 `outRoot` 仍会撞 —— 那个决定归票 18。
