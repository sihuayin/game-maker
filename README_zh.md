# game-maker

[English](README.md) · **中文**

一个**图片驱动的游戏创作工具链**。输入「**一张风格参考图 + 一段需求文本**」，产出**两个可以分开交付、分开使用**的产物。

| | 产物 | 是什么 | 验收 |
|---|---|---|---|
| **A** | **游戏资源包** | 一个**引擎中立**的目录：PNG 图集 + 标准动画元数据，随包附上创作态的 drawlist 源文件与生成它所依据的 StyleSpec | ① 随便一个引擎都能直接拿去用 —— **不需要本项目的 runtime**。② 包里所有资源**看起来属于同一个视觉世界**，**包括参考图里根本没出现过的新事物**。 |
| **B** | **可运行 demo** | 一个静态可托管、打开即玩的小型横版游戏（另有塔防一版） | 手写固定、永不改变的 runtime 外壳 + **只有数据** —— AI **一笔游戏代码都不写**。喂 fixture 资源包就能跑，因此**不吃生图能力**。 |

两个产物之间**只有数据文件依赖、没有代码依赖**。它们共用同一个 core 库，对外是两个薄壳：一个 **CLI** 和一个 **MCP server**（MCP **不** shell out 到 CLI）。

## 管线

```
                            ┌── plan ────────────▶ 资源清单 ──▶ pack ──▶ 资源包 (A) ─┐
一段需求 ───────────────────┤                                                       ├──▶ site ──▶ 站点 (B) ──▶ 打开即玩
一张风格参考图 ─────────────┴─ StyleSpec ──▶ compile-runtime / compile-td-game ──▶ 关卡配置 ─┘
```

两个入口都是**故意开着的**：资源清单可以由设计**规划**出来，也可以**人手写**；关卡配置可以由需求**编译**，也可以**人手写**。文件一落盘，两条路在下游完全同构。
⚠️ **2026-10-05**：规划那一步取代了老的 `derive`（它吃「需求 + StyleSpec」，而新的吃「设计 + 这个世界」）——
见 `docs/v2/03-claude-code.md §12`。

## 仓库结构

| 路径 | 里面是什么 |
|---|---|
| [`packages/contracts`](packages/contracts) | Zod schema 与纯类型 —— **唯一的共享代码** |
| [`packages/assets`](packages/assets) | 资源管线（drawlist → 静态校验 → 光栅化 → 量化 → 图集 → manifest），以及 `plan` / `pack` / `compile-*` / `verify` / `inspect` 这些操作 |
| [`packages/demo`](packages/demo) | 产物 B：固定 runtime 外壳与站点装配器 |
| [`packages/cli`](packages/cli) | CLI 薄壳 —— 只解析参数、渲染结果，别的什么都不做 |
| [`packages/mcp`](packages/mcp) | MCP stdio server 薄壳 |
| [`fixtures/`](fixtures) | 仓库自带的**基准件**：参考图、StyleSpec、drawlist、配方、关卡配置，以及**两个完整的资源包** |
| [`inputs/`](inputs) | **你**这一次要用的素材 —— 需求提示词、生图产出、手绘 PNG（见 [`inputs/README.md`](inputs/README.md)） |
| `out/` | 跑出来的一切。默认产物根，**全部 gitignore** |
| [`docs/`](docs) · [`CONTEXT.md`](CONTEXT.md) · [`.scratch/`](.scratch) | 技术规格、领域词汇表、规划地图 |

依赖方向是**被守卫的，不只是被写下来的**：[`scripts/check-deps.mjs`](scripts/check-deps.mjs) 会在 `contracts` 长出依赖、`assets` 与 `demo` 互相依赖、或 `mcp` 开始依赖 `cli` 时让构建变红。那张依赖图正是「A 与 B 可独立交付」这句话的结构化版本。

## 环境要求

- **Node ≥ 22**（开发用的是 v22.23.2）
- **pnpm 10**（仓库钉的是 `pnpm@10.7.1`）
- **Python 3** —— 可选，只用来起静态服务（任何静态 HTTP server 都行）

## 安装与构建

```bash
pnpm install
pnpm build     # tsc -b + esbuild 打包：shell.js、cli.mjs、server.mjs
pnpm check     # 依赖方向守卫 + 相对链接守卫 + 构建
pnpm test      # vitest，完全离线
```

CLI 打成**一份自包含的 ESM bundle**，所以直接在仓库里就能跑：

```bash
node packages/cli/dist/cli.mjs --help
```

下文一律简写成 `game-maker ...`。可以加个别名：

```bash
alias game-maker="node $(pwd)/packages/cli/dist/cli.mjs"
```

不改别名的话，每次把 `node packages/cli/dist/cli.mjs` 原样打全即可。

## 快速上手 —— 走 fixture（离线、不花一分钱）

仓库自带两个完整的资源包，**一个模型都不用调**就能看到能玩的游戏。

```bash
game-maker verify fixtures/packs/last-train/v2
game-maker site   fixtures/packs/last-train/v2 --config fixtures/game-configs/last-train.json
# → out/last-train/site/v<N>（N 是下一个没用过的站点版本号）
```

然后起服务。**HTTP server 的根必须是 `pack/` 与 `site/` 的父目录** —— 也就是 `out/last-train/`，**不是**站点目录本身。根指到 site 里面会 404，而 **Phaser 的 loader 会静默失败**：你得到一个黑画布，控制台干干净净。

```bash
cd out/last-train && python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/site/v<N>/index.html
```

塔防那一版形状一样：

```bash
game-maker site fixtures/packs/counter-siege/v4 --config fixtures/td-configs/counter-siege.json
cd out/counter-siege && python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/site/v<N>/index.html
```

两个 fixture 包都是真货，不是空壳。`inspect` 能看包里每个资源的种类、尺寸、用色与动画：

```bash
game-maker inspect fixtures/packs/counter-siege/v4
```

## 完整管线 —— 从需求到能玩的游戏

这条路要调模型，先把文本上游配好（见[配置](#配置)）。

**第 0 步是一次人机交互，不是一次管线调用**：把参考图变成 StyleSpec。操作规程与可直接复制的提示词在 [`docs/stylespec-extraction.md`](docs/stylespec-extraction.md)。`fixtures/` 里已经躺着两份现成的 StyleSpec，探索阶段可以先跳过这一步。

```bash
# 1. 资源清单 —— ⚠️ **今天请走「人手写」那条路**：`plan`（规划）的输入是**设计层 + 这个世界**，
#    而那两份产物由新链产出，那条链还在建。⇒ 抄一份 fixtures/recipes/ 里的改（8 份都是真的）。
cp fixtures/recipes/shift-change.json /tmp/my-recipe.json
# ⚠️ 规划那一步落地成什么样、以及它什么时候能用，见 docs/v2/03-claude-code.md §12。

# 2. 资源清单 → 资源包（清单里有 image 资源时，这一步才是花钱的那一步）
game-maker pack --recipe out/<id>/recipes/v1.json
# → out/<id>/pack/v1

# 3a. 横版：设计 + 资源包 → 关卡配置
game-maker compile-runtime --design out/<id>/run/v1/game-design.json --pack out/<id>/pack/v1
# 3b. 塔防：需求 + 资源包 → 关卡配置
game-maker compile-td-game --requirement inputs/counter-siege/PROMPT.md --pack out/<id>/pack/v1

# 4. 资源包 + 关卡配置 → 站点
game-maker site out/<id>/pack/v1 --config out/<id>/game-configs/v1.json
```

关卡配置也可以**人手写**，[`fixtures/game-configs/last-train.json`](fixtures/game-configs/last-train.json) 就是人写的那一份。两条路都合法，而且出来的不总是同一关 —— 手写那份把三件失物都摆在地面线上，编译那份把第二件摆到了行李堆顶上。

走塔防这条路的人，请**先**读 [`docs/td-requirement.md`](docs/td-requirement.md) 再写需求。`compile-td-game` **不是玩法感知的**：需求没说的，它只能拿示例填。⚠️ 而竖版那条新链上的 `plan` **是**玩法感知的（它读的是**设计层**）。一份没提「场地是一格格砖」的需求，会安安静静地产出一份「一整张大背景图」的合法清单，而那个失败要到很远的 `compile-td-game` 才响。

## 配置

两个互相独立的上游，用不用得上取决于你跑哪些命令。

**文本上游** —— `create` / `build` / `plan`、`compile-runtime`、`compile-td-game` 要用：

```bash
export ANTHROPIC_BASE_URL=...
export ANTHROPIC_AUTH_TOKEN=...
```

**生图上游** —— `pack` 要用，且只在清单里**真的有 image 资源**时才需要：

```bash
cp game-maker.local.example.json game-maker.local.json   # 真文件已 gitignore
```

在里面填一种协议（`openai` / `minimax` / `dashscope-mcp` / `gemini`），每种协议各要什么写在示例文件的注释键里。环境变量优先于文件：`GAME_MAKER_IMAGE_PROTOCOL` · `GAME_MAKER_IMAGE_BASE_URL` · `GAME_MAKER_IMAGE_API_KEY` · `GAME_MAKER_IMAGE_MODEL`。

清单里没有 image 资源的包，**一个生图凭据都不需要** —— 而 `site` 两个上游都不需要。

## CLI 参考

```
game-maker create          --style <一张参考图> --intent <需求文本 | 需求.md> [--yes] [--style-id <slug>] [--out <目录>] [--json]
game-maker build           <run 目录> [--out <目录>] [--concurrency <n>] [--json]
game-maker plan            --design <game-design.json> --visual-world <visual-world.json> [--out <目录>] [--json]
game-maker pack            --recipe <清单.json> [--visual-world <visual-world.json>] [--version <n>] [--out <目录>] [--concurrency <n>] [--json]
game-maker compile-runtime --design <game-design.json> --pack <资源包目录> [--level <关卡 id>] [--out <目录>] [--json]
game-maker compile-td-game --requirement <需求.md> --pack <资源包目录> [--out <目录>] [--json]
game-maker site            <资源包目录> --config <关卡配置> [--shell <shell.js>] [--out <目录>] [--json]
game-maker verify          <资源包目录> [--json]
game-maker inspect         <资源包目录> [--json]
```

- `--out <目录>` —— 产物根，默认 `./out`。**所有回报的路径都相对于它**。
- `--json` —— 机器可解析的输出。它与人类输出、与 MCP 工具返回的是**同一份数据**，不是第二套表示。

### `create` / `build`：V2 的那条链（两段）

```bash
game-maker create --style ./style.png --intent "做一个废土横版寻宝游戏"
# → out/<gameId>/run/v1/…（理解层那几份 + 清单）—— **在这里停**：
#   它把「清单里几个资源要走生图」与「你没说清的地方」打给你看，然后退出（退出码 0）
game-maker build out/<gameId>/run/v1
# → 生图 → out/<gameId>/pack/v1 · 配置 · 站点 out/<gameId>/site/v1
```

⚠️ **人工点只有一个，就在那个停的地方**（R9）：清单是**唯一**可以手改的产物，改完再跑 `build` —— 而 `build` 读的是**磁盘上那一份**（所以改的确实生效）。加 `--yes` 就一路跑到底（等于跳过检查点），两条路的产物**逐字节等价**。

⚠️ `--style` 今天**恰好收一张**（[多参考图](.scratch/game-maker-v2/issues/26-multiple-style-references.md) 实现延后）。`--intent` 收两种东西：**像路径就当路径**（以 `.md`/`.txt` 结尾、或含路径分隔符），否则当裸文本 —— 写错文件名会当场报参数错，而不会把文件名当成一句需求喂给模型。
- `--concurrency <n>` —— 并发生成的上限。

退出码：`0` 成功 · `1` 失败 · `2` 参数错 · `3` 上游不可达 · `4` 产物/清单不合法。

两条值得先知道的性质：

- **产物按目录版本化，永不覆盖。** 资源包是 `pack/v<N>`，站点是 `site/v<N>`，各用各的计数器。重跑一条命令写的是下一个版本，而不是把上一版盖掉。
- **退出码 3 是当真的。** 生图不可达时整包失败 —— 没有一条降级链在背后悄悄产出一个难看的包：产物做不出来，就是没有产物。失败时 CLI 会报出**已经花掉的那几笔**，并把已经付过钱的原图连同那时逐字发出去的提示词留在磁盘上，下次可以改成 `{"kind":"import", ...}` 复用，**生图 0 次**。

## MCP server

```bash
node packages/mcp/dist/server.mjs      # stdio
```

六个工具：`plan_assets` · `build_asset_pack` · `verify_asset_pack` · `inspect_asset_pack` · `compile_runtime` · `assemble_site`。长任务的进度走 MCP **原生的** `notifications/progress`；不支持通知的客户端照样能用，只是看不到进度。

注册进任何 MCP 客户端，例如 `.mcp.json`：

```json
{
  "mcpServers": {
    "game-maker": { "command": "node", "args": ["packages/mcp/dist/server.mjs"] }
  }
}
```

## 文档

| 文档 | 它回答什么 |
|---|---|
| [`CONTEXT.md`](CONTEXT.md) | **领域词汇表。** 某个术语若与仓库里别处有出入，以它为准 |
| [`docs/文档.md`](docs/文档.md) | 最初的 V1 技术规格（83 节）。它的**契约章节仍然有效**；QA / 门禁 / 修复 / Benchmark 那几章属于上一版终点，在本项目里**已出局** |
| [`docs/stylespec-extraction.md`](docs/stylespec-extraction.md) | 人怎么从一张参考图产出一份 StyleSpec —— 连提示词一起 |
| [`docs/td-requirement.md`](docs/td-requirement.md) | 一份塔防需求**必须说**哪两件事，以及不说会怎样 |
| [`docs/counter-siege.md`](docs/counter-siege.md) | 那个塔防关卡：设计、数值、怎么跑起来 |
| [`inputs/README.md`](inputs/README.md) | 该带什么输入素材来，以及导入通道**实测得出**的位图要求 |
| [`.scratch/game-creation-v1/map.md`](.scratch/game-creation-v1/map.md) | 规划地图：终点、锁定决策，以及每一张票连同它的答案 |

## 几个会咬人的地方

- **站点要从对的根起服务。** `out/<gameId>/`，绝不能是 `out/<gameId>/site/v<N>/`。Phaser 什么都走 XHR 且**静默失败**，所以根指错了看起来就是「黑屏 + 干净的控制台」。
- **`file://` 不行。** 双击 `index.html` 做不到，两个互相独立的原因：module script 规范要求走 CORS；而 Phaser 的 loader 整个建立在 XHR 上 —— 连 PNG 都走。
- **只有 `inputs/` 与 `fixtures/` 入库。** `out/` 下的一切都是产物、全部 gitignore；`game-maker.local.json` 装的是凭据，同样 gitignore。
- **版本目录是 per-pack，不是 per-asset。** 会坏掉、会被回滚、会被复现的是**一整个交付物**，不是包里某个资源。
