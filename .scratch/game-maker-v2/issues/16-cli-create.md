# 16. CLI `create`：`--style` + `--intent`，以及唯一的检查点

Type: grilling
Status: resolved
Owner: claude (2026-10-08)
Blocked by: 15
Map: ../map.md
> `docs/v2/03-claude-code.md` §26。CLI 是**薄壳** —— 只解析参数、渲染结果。

## Question

§26 要：

```bash
game-maker create --style ./style.png --intent "做一个废土横版寻宝游戏"
game-maker create --style ./style.png --intent ./intent.md
```

### 1. `--intent` 收两种东西

裸文本 vs 文件路径。要答判定规则（存在同名文件时的歧义），以及**失败时**的退出码
（参数错是 `2`，而「那段文本解析不出意图」是 `1` 还是 `4`）。
今天的退出码表在 `cli.ts:29`：`0` ok · `1` fail · `2` usage · `3` upstream · `4` 产物/清单不合法。

### 2. 检查点的 CLI 表面（承票 15 §2）

R9 + Q10b：在清单处停一次，`--yes` 跳过。要答：
- **停的时候打什么**？必须让「要不要花这笔钱」这个问题**看得见**（今天 `pack` 的
  生图条数已经在 `--json` 里报，`README_zh.md` 记着「清单里有 image 资源时，这一步才是花钱的那一步」）。
- **是交互式问，还是打印后退出、要人再跑一条命令**？
  ⚠️ 后者对 **MCP** 与**脚本**友好得多，而 CLI 今天**没有任何交互式输入**（读一遍 `cli.ts` 就成立）。
- 停了之后**怎么续**？（`--from recipe` 那种形式，见 Q10 的选项 (c)——R9 选了 (b)，
  但要答「续」的入口长什么样；否则这个检查点就是一条死路。）

### 3. 与既有命令的关系

`derive` / `pack` / `compile-game` / `compile-td-game` / `site` / `verify` / `inspect`
**七条一条都不许删**（`03 §31`，且 `README_zh.md` 的 CLI 参考在卖它们）。
要答：`create` 与它们**共用**哪些实现（本质上是把 `derive → pack → compile → site` 串起来，
只是**输入**从「需求 + StyleSpec」变成「图 + 文本」）。

### 4. 判据

- `game-maker create` **不带任何可选参数**能跑（`--yes` 除外，且 `--yes` 也要能跑）。
- `--help` 里能看到它，且 `docs`（`README.md` / `README_zh.md`）同步更新 ——
  ⚠️ `pnpm check:links` 会查相对链接（`scripts/check-links.mjs`）。

> ⚠️ **2026-10-02（[票 03](03-contract-intent-and-design.md) 已关）：`ambiguity` 这个字段的**存亡押在本票上**。**
> 票 03 Q2 判：`GameIntentSpec.ambiguity` 的**唯一消费者是 R9 的清单检查点**
> （不是终点那份 QA 报告 —— 一份「你没说清」的报告在生图之后递给人，没有任何一刻能改变结局）。
> ⇒ 它必须 ① 在检查点的**展示清单**里具名出现 ② `--yes` 跳过时**进日志**。
> ⚠️ **这两条若不成立，那个字段当场出局** —— 回去把它从 `game-intent.ts` 删掉，
> 别养成「将来可能会用」的空壳。这是票 03 写进契约文件里的原话，本票是兑现处。

## Answer

**结论：`create` / `build` 两条命令落地** —— V2 那条链在 CLI 上有了入口，而**人工点只有一个、就在
清单处**（R9）。**18 条新测试 · 套件 1054/1054**（此前 1036）· `tsc -b --force` / `pnpm typecheck`
干净 · 两个守卫绿（146 份文档 · 786 条链接）· **12 发变异全部验过会红** ·
**真 E2E 跑了 4 次**（人类授权 n=1；结果见 §6 —— 全停在上游，而它当场照出一个真缺陷）。

### 0. 裁决表（9 问 + E2E）

| # | 问 | 裁决 | 落地 |
|---|---|---|---|
| 1 | 1-Q1 | **非交互**检查点：打印后退出，**新命令 `build <runDir>`** 续 | `cli.ts` 的两个 case |
| 2 | 1-Q2 | 停的时候打：run 目录 · 清单摘要 · **生图资产数** · `ambiguity[]` 逐条 · 下一步那条命令 | `awaitingCheckpoint()` |
| 3 | 1-Q3 | `--intent` 的判别**写死一条**；「解析不出意图」退出码 **4** | `readRequirement()` · `asCommandError()` |
| 4 | 1-Q4 | `--style` **恰好一张**（第二张 ⇒ usage，文案指名票 26） | `parseArgs` 的「同一个选项给了两次」 |
| 5 | 1-Q5 | 壳只接线；`pack` 加 `--visual-world` / `--version` 两个 flag | `cli.ts` 的 `pack` case |
| 6 | 1-Q6 | `--yes`（与 `build`）**一路跑到站点**，三条产物**同一个 N** | `buildAndSite()` |
| 7 | 1-Q7 | MCP 加**一个** `create_game`（无交互 ⇒ 自动跳过检查点） | `mcp/src/server.ts` |
| 8 | 1-Q8 | 停住时退 **0**，但 `data.status = "awaiting"` | `awaitingCheckpoint()` |
| 9 | 1-Q9 | 按结构施工 + **create/build 等价测试** | `cli-create.test.ts` |
| 10 | E2E | 授权 n=1 ⇒ **真跑了 4 次**（每次都停在上游；见 §6） | `experiments/create-e2e/` |

### 1. 检查点：**打印后退出**，`build` 接着跑（Q1/Q2/Q8）

```
game-maker create --style ./style.png --intent "…"
  → out/<gameId>/run/v1/…（七项）· 打印摘要 · **退出码 0**（`data.status = "awaiting"`）
game-maker build out/<gameId>/run/v1
  → 生图 → pack/v1 · 配置 · 站点 site/v1
```

⚠️ **为什么不是交互式提示**：CLI 今天**零交互**（`io` 只有 `out`/`err`，不读 stdin），而 MCP
**无交互** ⇒ 交互式会把检查点变成 CLI 独有的东西，脚本与 MCP 都得绕。⇒ 「停」= **一次成功的返回**，
而「续」= 一条**新命令**（`create` 理解段 · `build` 构建段 · `site` 站点段 —— 与 MCP 的
`build_asset_pack` 同族）。
⚠️ **退出码 0 + `status` 标记**：只退 0 的话，脚本会以为整条链跑完了 ⇒ `data.status` 是**机器可读**的那一格
（`awaiting` / `complete`）。

**停的时候打什么**（F6 那两条的落点）：run 目录 · 清单摘要（各 `kind` 的条数）·
**`imageAssetCount`（「这一步才花钱」的那个数）** · **`ambiguity[]` 逐条** · 下一步那两行命令。
⚠️ 而 **`--yes` / `build` 那条路上 `ambiguity[]` 照样打**（票 03 把那个字段的存亡押在这一票上的两条之一 ✓
—— 本票**兑现**了它，那个字段**留下**）。

### 2. `--intent`：判别一条死线 + 两档退出码（Q3）

- **判别**：以 `.md`/`.txt` 结尾、或含路径分隔符、或以 `./` `../` 开头 ⇒ **当路径**
  （不存在 ⇒ `usage`(2)，文案说清「你给的是路径而它不在」）；否则**当裸文本** ✓
  于是 `--intent "做一个横版游戏"` 永不被当成文件名，而 `--intent intent.md` 写错会**当场**说清。
- **两档退出码**（票 09 定的方向 + 票 16 的落地）：参数错 **2** · 「模型三发都没吐出一份过契约的文书」
  **4** · R12 的拒绝 **4**（文案走 `rejections`）· 上游不可达 **3** · 其它 **1** ✓
  ⚠️ 这一档**不改判据，只翻译**：`plan`/`pack` 对同一档也是 4（票 14 的播下原话「两类失败都退出码 4」）。
- **读文件是逐字节的**（§13：`intent.md` 存原样字节），与提示词那侧的 `trim()` 分开 ✓。

### 3. `create` 与既有七条命令（Q5/Q6）

- ⚠️ **七条一条没删**（`plan`/`pack`/`compile-runtime`/`compile-td-game`/`site`/`verify`/`inspect`），
  两份 README 与 `--help` 同步加了两条新命令 ✓。
- 壳只**接线**：理解段与构建段走 `@game-maker/pipeline` 的两段 API，构建段里那两步用**现成的 op**
  （`packAssets` / `compileRuntime`）—— 壳里没有一行业务判断 ✓。
- ⚠️ **站点那一层只有壳够得着**（`pipeline` 的白名单里没有 `demo`）⇒ `create --yes` / `build`
  在 config 之后**自己**串第三步，并把**同一个 N** 传给 `assembleFromConfig`（票 15 的 Q16/Q17：
  「父指定、子不自算」；那个口子开在 `layout.ts`，**目标已存在就拒** ✓）。
- `pack` 也拿到了 `--visual-world` 与 `--version`（票 15 播下来的两件）✓ —— ⚠️ `--version` 的 help 写清
  「给了就**不自算**、撞名即失败」，它**不是覆盖**。

### 4. MCP：第七个工具 `create_game`（Q7）

一个工具跑完整条链、**自动跳过检查点**（MCP 无交互 ⇒ 检查点对它是空操作 ✓），带
`notifications/progress` ✓。⚠️ 想把「生图之前看一眼清单」那条路留给 `plan_assets` + `build_asset_pack`
那一对 —— 描述里明写了这个分工 ✓（工具表由 `server.test.ts` 钉着）。

### 5. ⚠️ 施工时撞到的五处（三处是**先前的**问题，两处是**边界**）

1. ⚠️ **`parseArgs` 一直在 `try` 外面** —— 「`--recipe` 后面没跟值」这类**参数错会崩栈**
   （退出码 1），而退出码表写着 2 ✓ 已挪进去 ✓。⚠️ **既有测试只直接测过 `parseArgs`**，所以这条洞
   从没被跑到 —— 本票的测试是从 `run()` 那一层打的，当场撞出来。
2. ⚠️ **`--style` 给绝对路径会被契约拒**：`visual-world.json` 里那一格**以它自身为基准**
   （`StyleReferencePath`）⇒ 壳必须把它**相对化**再递下去（`styleRefOf`）✓。
   不然「用户从哪儿拿到一张图」就成了契约问题（而它其实是**壳那一侧的形状转换**）。
3. ⚠️ **外壳 bundle 按 `cwd` 找**（`defaultShellPath`）⇒ 独立安装时找不到它 —— `create`/`build`
   因此也认 `--shell`（与 `site` 同款的口子）✓。
4. ⚠️ **理解层的错误类壳不认识** ⇒ 「模型三发都没吐出一份过契约的文书」会被退成 **1** ✗
   —— **这是 E2E 探针当场撞出来的**（真跑那一次的 JSON 里 `exitCode: 1`）⇒ 已按**形状**翻译
   （带 `failure` 的七档 + 带 `rejections` 的 R12 拒绝），现在是 **4** ✓（第四次真跑验过）。
5. ⚠️ **两个包的测试要同一套假上游，而跨包的 TS import 过不了 `rootDir`**（`tsc -p tsconfig.spec.json`
   当场报 **TS6059**）⇒ 骨架数据挪进 **`fixtures/upstream/canned.json`**（**运行时读**的 JSON），
   逻辑各留十几行 ✓ —— **会漂的那部分因此只有一处**。
   ⚠️ 而夹具本身也撞了一次判据：**背景没画满**被站点那一族拒（票 50 的「最远那层必须画满」）✓
   —— 「判据对、夹具错」⇒ 夹具改成画满整帧 ✓。

### 6. E2E 探针：**真跑了 4 次，全停在上游**（人类授权 n=1）

跑法：`node .scratch/game-maker-v2/experiments/create-e2e/run.mjs` —— 它驱动**出货的 CLI 入口**
（`packages/cli` 的 `run`），不是把库函数拼一遍。⚠️ 生图那一路走 `deps.fetchImpl`（本机那条能通的代理），
而**文本上游按 URL 直连**（第一次跑没分流，把本机那条明文请求也塞进代理 ⇒ 0.0s 就 openssl 报错 ✓ 已修）。

| 第几次 | 停在哪一步 | 病因（上游/模型那侧） | 退出码 | 花了钱吗 |
|---|---|---|---|---|
| 1 | `analyze-intent` | `empty-input` ×3（代理把工具入参丢了，票 27 记过的档） | 1 | 否 |
| 2 | `analyze-reference` | 六个桶里写了**硬编码 hex**（契约要 `palette:N`） | 1 | 否 |
| 3 | `analyze-reference` | `palette` 写成了**数组**（票 08 记过的「开放对象被摊成空对象」同族） | 1 | 否 |
| 4 | `analyze-intent` | `schema` ×2 + `empty-input`（**这一发终于退 4**、账完整带出来） | **4** | 否 |

⚠️ **四次都停在上游**（一次都没走到生图 ⇒ **一分钱没花在生成上**），而每次的失败模式都不一样：
「代理丢入参」「桶里写 hex」「`palette` 写成数组」「schema 不过」——**这正是票 25 那条「代理一直在变」**：
票 08 当初量到 `analyze-reference` 首发 **75%**、票 09 量到 intent 一臂过，而**今天 0/4 趟通**。
⇒ 记为**派生**（见 §7），**本票不认领**。

✅ **而它照出了一处真缺陷**（第 5 节第 4 条）：`create` 把「模型三发没过契约」退成 1 ✗ ⇒ 改成 4 ✓
—— 第四次真跑里那份 `ledger` 就是证据：`attempts: 3` · `failures: ["schema","schema","empty-input"]` ·
`model: deepseek-flash`（代理换的模型）· 用量 ✓ **票 46 那条「已经花掉的那几笔跟着异常走」在壳这一层真的响了**。

### 7. 未决 / 派生

- ⚠️ **理解层今天在上游那侧很不可靠**（§6）：四次真跑、四种失败模式、**一次都没过第二发**。
  票 24（视觉模型可用性）与票 25（原型结构化输出）**都关了**，而它们量的数（75% / 过半）**今天不成立**
  ⇒ 值得**重开一张**（「代理变了，链的前两发现在有多稳」）—— 但那是**票 24/25 的延续**，本票只把它记下来。
- ⚠️ **站点那一步仍要 `cwd` = 仓库根**（或 `--shell`）：独立安装的用户必须显式给外壳路径。
  这是 `defaultShellPath` 的老形状（`site` 命令同样），本票只是把它**接上**了。
- ⚠️ **`--style-id` 的覆盖口已实现**（票 08 的 R2-Q2 播下来的那一件）✓ 但**没测**（它只影响一个 slug）。
- `--concurrency` 在 `create`/`build` 上也认 ✓（透给 `packAssets` 的闸门）。

### 8. 改了哪些文件 + 判据

| 文件 | 改什么 |
|---|---|
| `packages/cli/src/cli.ts` | `create` / `build` 两个 case + `readRequirement` / `styleRefOf` / `progressTo` / `awaitingCheckpoint` / `createComplete` / `buildComplete` / `buildAndSite` / `asCommandError`；`parseArgs` 挪进 `try`；`pack` 的两个新 flag |
| `packages/cli/tests/cli-create.test.ts` | **新**：18 条（`--intent` 三档 · 检查点 · `ambiguity` 两处 · `--yes` 一条到底 · **两条路等价** · 磁盘真相 · 站点 N 由父给 · 退出码两档 · 参数面六条） |
| `packages/mcp/src/server.ts` | 第七个工具 `create_game`（自动跳过检查点） |
| `packages/mcp/tests/server.test.ts` | 工具表 6 ⇒ 7 |
| `packages/demo/src/{site,assemble,layout}.ts` | **显式站点版本口子**（给了就不自算；目标已存在 ⇒ 拒） |
| `packages/cli/package.json` · `packages/mcp/package.json` | 加 `@game-maker/pipeline` 依赖 |
| `fixtures/upstream/canned.json` | **新**：假上游那五份骨架（两个包的测试**共用**，运行时读） |
| `README.md` / `README_zh.md` | CLI 参考 + 一节「`create` / `build`：V2 的那条链（两段）」 |
| 探针 | `experiments/create-e2e/run.mjs` + `raw/e2e.json`（最后一次的事实） |

**判据**：`pnpm test` **1054/1054** · `tsc -b --force` 与 `pnpm typecheck` **全绿** · 两个守卫绿 ·
**12 发变异全部验过会红**（`--intent` 三档 · 检查点不停 · `status` · `ambiguity` · `--style` 两次 ·
相对化 · 站点 N · `--version` · 建站那一步 · MCP 工具表 · `parseArgs` 的位置）。
