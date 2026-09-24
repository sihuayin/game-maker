# 29. monorepo 切分与构建工具链

Type: grilling
Status: resolved
Blocked by: —
Map: ../map.md

> R9 定了**按产品切**：`contracts` / `assets` / `demo` / `cli` / `mcp`。
> 本票定**怎么落地**：包管理器、构建器、包间依赖规则、以及每个包打出什么。

## Question

1. **包管理器与 workspace**：仓库里 npm、pnpm、bun 都可用（票 01 实测）。
   选哪个？`pnpm-workspace.yaml` 还是 npm workspaces？（注意：R9 说 CLI 要出单文件 bundle，
   这会影响构建器的选择。）
2. **依赖方向必须是单向的**，且要**可强制**。预期形状：
   `contracts` ← `assets` ← `cli` / `mcp`，`contracts` ← `demo` ← `cli` / `mcp`，
   且 **`assets` 与 `demo` 之间没有任何依赖**（R6：只有数据文件依赖）。
   用什么手段**机械地**守住这条？（`eslint-plugin-import` 的 `no-restricted-imports`？
   dependency-cruiser？还是只靠约定 + review？）
   **这条是 R6 的物理保证** —— 靠约定的话，A 和 B 迟早会偷偷共享一个工具函数，
   然后「两个产物可独立交付」就变成假的了。
3. **TypeScript 工程配置**：`project references` 还是各自独立 `tsc`？
   内部包在开发时是走源码（`exports` 指向 `src`）还是走构建产物（指向 `dist`）？
   （走源码开发爽但会让 `mcp` 的单文件 bundle 变复杂。）
4. **每个包打出什么**（R9 已给方向，这里定细节）：
   - `contracts`：npm 包（纯类型 + Zod）
   - `assets`：npm 包（可被程序调用）
   - `demo`：npm 包（含固定的 runtime 外壳源码 + 构建器）
   - `cli`：npm 包 + **单文件 bundle**（用 `tsup` / `esbuild` / `bun build`？）
   - `mcp`：npm 包，`bin` 指向 stdio server
   **要不要现在就为发布做准备**（`private: false`、版本策略、changesets）？
   还是 V1 全部 `private: true`、只在本地 `npm pack` 验证可打包？
5. **产物 A 与 B 的构建产物放哪**：R9 说「资源包与站点目录是 zip / 目录，不是 npm 包」——
   它们的**默认输出路径**在哪、要不要 gitignore（Q9 的精神保留）、
   构建产物在 monorepo 里算谁的（`packages/assets/out`？仓库根 `out/`？）
6. **现有 `demo/` 如何处置**：票 07 是执行，本票要给出**目标形态**，
   否则票 07 无从下手。

## 产出要求

调用 `grilling` skill。产出**目录树 + 每个 package.json 的关键字段 + 强制依赖方向的手段**。
若第 6 条需要看实物，调用 `prototype` skill 先在一个临时目录把 workspace 骨架搭起来
（不落进仓库），证明依赖方向与构建链路真的成立，再决定。

## Answer

**结论：pnpm workspaces + `exports` → `dist` + TypeScript project references。
依赖方向由三层**结构保证**（不靠 lint 规则）。产物全部落在仓库根 `out/<gameId>/{pack/v<N>, site}/`。
现有 `demo/` 目录**整体消失** —— 816 行里只有 `contracts/` 一个子目录被提升，其余按 R2 出局。**

### 0. 目标形态

```
pnpm-workspace.yaml          packages: [packages/*] · onlyBuiltDependencies: [esbuild] · catalog:
package.json                 private · packageManager: "pnpm@10.7.1" · scripts: build/check:deps/test/dev
tsconfig.base.json           只放绝对语义的选项（见 G1）
tsconfig.json                solution-style，只列 references
.npmrc                       registry=https://registry.npmjs.org（见 §1）
scripts/check-deps.mjs       依赖方向守卫（见 §2 第 3 层）
packages/
  contracts/    Zod schema 与纯类型。唯一的共享代码。依赖：无
  assets/       资源管线（drawlist → 静态校验 → 光栅化 → 量化 → 图集 → manifest）。依赖：contracts
  demo/         产物 B：固定 runtime 外壳 + 站点构建器。依赖：contracts
  cli/          薄壳。依赖：contracts, assets, demo。bin: game-maker
  mcp/          薄壳，stdio server。依赖：contracts, assets, demo。bin: game-maker-mcp
fixtures/       入库的输入（demo/test.png 等）
out/            全部产物，gitignored
```

### 1. 包管理器与 workspace（票面问题 1）

**pnpm workspaces。** 决定性理由不是快，是 pnpm 的**非扁平 `node_modules` 本身就是「依赖方向」这个问题的第一层答案**：
一个包 import 了没在它自己 `package.json` 里声明的依赖，**解析直接失败** —— 开发机、CI、任何人机器上都一样。
R6 的「A 与 B 可独立交付」因此由**模块解析器**兜底，而不是一条可以被 disable 的 lint 规则。
npm workspaces 的扁平提升做不到这件事。（实测覆盖面比预期还大：连 `tsc` 类型检查都过不去，见 G3。）

两条附带项：

- **仓库级 `.npmrc` 钉 `registry=https://registry.npmjs.org`**。本机 `~/.npmrc` 指向 npmmirror，
  实测会让 Vite 8 拉全平台 `@rolldown/binding-*` 卡死 5 分钟以上（[票 07](07-project-workspace.md) 记录）。
  代价是国内拉包变慢 —— 这条可逆，将来若要改回去只需删掉这一行。
- **`onlyBuiltDependencies: [esbuild]`**：pnpm 10 默认屏蔽 postinstall 脚本，esbuild 需要它。

### 2. 依赖方向**怎么**机械强制（票面问题 2）

票面把选项列成 eslint-plugin-import / dependency-cruiser / 约定三选一 —— **这个框定是陷阱**，
单一手段挡不住 R6 真正怕的事。失败有两种形态，需要两道不同的闸：
**未声明的依赖**（解析不出来）与**已声明但被禁止的边**（解析得出来，但图错了）。后者才是 R6 的死法。

**三层结构保证，全部不依赖 lint 规则：**

| 层 | 手段 | 挡住什么 |
|---|---|---|
| 1 | pnpm 非扁平 `node_modules` | 未声明的依赖不存在 —— **连同 `tsc` 一起失败** |
| 2 | 每个包的 `exports` **只暴露 `"."`** | 深层 import 语法上不可达，包边界 = API 表面 |
| 3 | 手写 `scripts/check-deps.mjs`（约 40 行、零依赖） | **已声明但被禁止的边** —— 唯一能挡住 R6 那条边的一层 |

第 3 层读的是**同一份 `package.json`**，没有第二套描述，所以是结构性的而非启发式的；
它同时强制「新增包必须先在允许图里表态」。**不选 dependency-cruiser**：为守卫一条边引入一个依赖、
一份配置、第三个真相来源。若将来真出现深层 import 的漏网，再补不迟。

允许图（含一条容易被忽略的约束）：`contracts` 无人依赖；`assets`/`demo` 只依赖 `contracts`，
**两者之间没有任何边**；`cli` 与 `mcp` 都是叶子，依赖三个核心包 ——
⚠️ **`mcp` 不依赖 `cli`**（R5：MCP 不 shell out 到 CLI，避免两层进度协议）。这条是实测里被守卫抓出来的（G2）。

### 3. TypeScript 工程配置（票面问题 3）

**`exports` → `dist` + project references。**

- **走 `dist`**：R9 要的两次「出包」（`cli` 单文件 bundle、`mcp` stdio server）都在打包器里完成；
  走 `dist` 让打包器的输入是**已编译的 JS + `.d.ts`**，它不需要理解跨包 TS 编译 —— `tsc -b` 已经做完了。
  走源码的诱惑是「改完立刻生效」，但它把跨包编译责任推给**每一个**消费方（Vite、esbuild、vitest 各配一遍），
  并且正踩中票面自己点出的那条：「走源码开发爽但会让 mcp 的单文件 bundle 变复杂」。
- **project references**：`tsc --build` 自己算构建顺序并增量，与 pnpm 的拓扑认知一致、不打架；
  跨包类型跳转与 `declarationMap` 直接可用。代价是开发时常驻一个 `tsc -b --watch`。

⚠️ **G1 —— 实测撞出来的坑，落地时必须按这条写**：
**`tsconfig.base.json` 里的 `outDir` / `rootDir` 是按 base 文件自己的目录解析的，不是按继承者。**
第一版把它们放在 base 里，五个包**全部**把产物路径对到了仓库根的 `src/`
（`error TS6059: File ... is not under 'rootDir'`）。
→ **base 只放绝对语义的选项**（`target` / `module` / `moduleResolution` / `strict` /
`composite` / `declaration` / `declarationMap`）；**相对路径类选项**（`outDir` / `rootDir` / `include`）
**写在各包自己的 tsconfig 里**。

### 4. 每个包打出什么（票面问题 4）

**V1 全部 `private: true`，不发布，只验证「能打包」。** 理由：Destination 里产物 A 是资源包目录/zip、
产物 B 是站点目录，R9 已明说「资源包与站点目录是 zip / 目录，不是 npm 包」——
发布到 npm 不服务任何一条验收，而 changesets 会把版本与 changelog 纪律压在一个契约每周还在改的仓库上。
`pnpm pack` 保留 R9 真正要的那条性质（每包可独立打包），拿掉仪式。等站点要交给外人时再回来。

每个包 `type: "module"` + `private: true`，`exports` **只暴露 `"."`**：

| 包 | `exports["."]` | `bin` |
|---|---|---|
| `@game-maker/contracts` | `dist/index.js` / `dist/index.d.ts` | — |
| `@game-maker/assets` | 同上 | — |
| `@game-maker/demo` | 同上（导出 `buildSite()` **和** `runtimeShellDir`） | — |
| `@game-maker/cli` | `dist/index.js` | `game-maker` → `dist/cli.mjs` |
| `@game-maker/mcp` | `dist/index.js` | `game-maker-mcp` → `dist/mcp.mjs` |

⚠️ **`packages/demo` 里有两种东西**：构建器 API（`src/` → `dist/`）与**固定的 Phaser runtime 外壳源码**
（`runtime/`，一个 Vite 工程，**不被任何包 import**）。外壳不是公共 API，**不给它开子路径 export**；
构建器改为导出常量 `export const runtimeShellDir = fileURLToPath(new URL('../runtime/', import.meta.url))` ——
把「外壳在哪」变成可测的显式事实，而不是让调用方拼路径。

**CLI 单文件 bundle 用 esbuild 直接调，不用 tsup**：`.d.ts` 已由 `tsc -b` 产出，
打包器只需做「拼接 + 内联」一件事；tsup 会在其上再包一层并带来一份与 tsc 重复的 dts 配置。

```
esbuild packages/cli/src/cli.ts --bundle --platform=node --format=esm \
  --target=node22 --outfile=packages/cli/dist/cli.mjs \
  --external:vite --external:phaser
```

**`--bundle` 不等于把所有东西塞进去**：`vite` 与 `phaser` 必须 **external** ——
它们在**运行时**被真正加载（构建站点时调 `vite.build()`，站点里跑 Phaser），内联它们既不可能也无意义。
`zod` 与三个内部包全部内联，所以 `npx` 起来不需要任何 `node_modules` —— 这正是 R9 要的那条性质。
`mcp` 换入口、同一条命令。

（零依赖替代是 `bun build`，但会给一个 Node 仓库引入第二个运行时做构建 —— 不引入。）

### 5. 产物 A 与 B 的构建产物放哪（票面问题 5）

**仓库根 `out/`，单一 gitignored 目录**，形状：

```
out/<gameId>/pack/v<N>/     产物 A（内部形状由票 24 定）
out/<gameId>/site/          产物 B
```

三条理由：① 产物**不属于任何单个包** —— 资源包由 `assets` 产出但 `cli`/`mcp` 都可能触发，
站点由 `demo` 产出但也是 `cli` 的产物，放进某个包里就制造了「这算谁的」的假问题；
② 一份 `.gitignore` 覆盖全部，兑现 Q9 的精神；③ 两者是**兄弟目录**，正好满足
[票 03](03-phaser-vite-playwright-chain.md) 实测出的那条契约 —— **HTTP server 的根必须是它们的父目录**。

### 6. 现有 `demo/` 的目标形态与删除边界（票面问题 6）

按票面判据（契约与生成路径上的确定性校验留下；评分/门禁/修复/状态机/编排器删除）逐文件判：

| 现有文件 | 行数 | 去向 |
|---|---|---|
| `src/contracts/index.ts` | 240 | 提升为 `packages/contracts/`，**但大半要删** —— 随 R2 出局的 schema（Gate / Evaluation / Repair / Budget / BestState / CreationRun / Checkpoint / RuntimeObservation / GameplayTestPlan / 各种 Report）约 150 行；留下的核心是 `Requirement` / `StyleSpec` / `GameSpec` / `AssetSpec` / `AssetManifest` / `CreationProject`，再按票 24 补 drawlist 与 `assetpack/v1` |
| `src/contracts/policy.ts` | 25 | **删除**（门禁策略，R2 出局） |
| `src/runtime/orchestrator.ts` | 174 | **删除**（编排器） |
| `src/runtime/ports.ts` | 60 | **删除**（旧 Port 面） |
| `src/runtime/creation-runtime.ts` | 54 | **删除** |
| `src/runtime/state-machine.ts` | 17 | **删除**（状态机，随 R2 出局） |
| `src/runtime/store.ts` + `in-memory-store.ts` | 25 | **删除**（Resume/持久化已判出局） |
| `src/qa/` | 79 | **删除**（评分与门禁） |
| `src/repair/` | 33 | **删除**（修复） |
| `src/example.ts` | 76 | **删除**（旧闭环的装配示例） |
| `tests/gate.test.ts` + `tests/state-machine.test.ts` | 35 | **删除**（测的都是出局的东西） |
| `test.png` | 1.0 MB | → **`fixtures/`**（它是参考图**输入**，Q9 精神：只有 `inputs/` 与 `fixtures/` 入库） |
| `demo/package.json` · `tsconfig.json` · `README.md` · `PROTOTYPE-asset-representation.html` | — | 前两者被 monorepo 的对应物取代；`PROTOTYPE-*.html` 是[票 05](05-asset-representation.md) 的原型，**移到该票的实验目录**下归档（那是它的出处） |

**816 行里活下来的只有 `contracts/` 的一部分与 `test.png`。**

⚠️ **一个同名不同物，必须钉死**：今天的 `demo/` 是**上一版闭环的 mock 骨架**；
R9 的 `packages/demo` 是**产物 B 的固定 runtime 外壳 + 构建器** —— 同一个名字，内容毫无重叠，
今天的 `demo/` 里没有任何东西**搬进**新 `packages/demo`。已同步 `CONTEXT.md`（新增 产物 B 的词条）。

### 7. 实物验证（票面要求的那一遍）

在 `/tmp/mono-probe` 搭了个五包等价体（零外部依赖、全程离线），逐条跑：

| # | 断言 | 结果 |
|---|---|---|
| ① | `tsc -b` 按依赖序构建五包、产出 `dist/*.js` + `*.d.ts` | ✅ |
| ② | 增量重跑零工作 | ✅ 重建 0 个项目 |
| ③ | 改叶子包 → 下游全部失效重建 | ✅ 重建 5 个项目 |
| ④ | 守卫拒绝「已声明但被禁止的边」（`assets → demo`） | ✅ 退出码 1 |
| ⑤ | 未声明的依赖运行时解析失败 | ✅ `ERR_MODULE_NOT_FOUND` |
| ⑥ | 深层 import 被 `exports` 挡住 | ✅ `ERR_PACKAGE_PATH_NOT_EXPORTED` |

玩具树是丢弃的（票面要求「不落进仓库」），只留那个要进仓库的脚本与结论：
**[`../experiments/monorepo-probe/`](../experiments/monorepo-probe/)**（含 G1 / G2 / G3 三条实测发现的原文）。

**不建 ADR**：本 effort 的决策记录就是这张地图 + 各票的 Answer，
再开一个 ADR 目录会制造第二个真相来源。

### 8. 交给执行者的清单

[票 07](07-project-workspace.md) 按 §0 的目标形态落地，特别注意：

1. §3 的 **G1** —— base 只放绝对语义选项，`outDir`/`rootDir` 写在各包。
2. §2 的守卫脚本直接抄 [`check-deps.mjs`](../experiments/monorepo-probe/check-deps.mjs)（已按真实包名写好）。
3. §6 的删除边界逐文件执行，**不要整目录搬**。
4. 仓库根 `.npmrc` 与 `pnpm-workspace.yaml` 一次配好（含 `onlyBuiltDependencies` 与 `catalog`）。

### 9. 本票解除阻塞的四张票

[07 目录迁移](07-project-workspace.md)（本票的目标形态就是它的输入） ·
[20 drawlist 契约](20-drawlist-contract.md) · [21 光栅化器](21-drawlist-renderer.md) ·
[30 CLI 与 MCP](30-cli-and-mcp-surface.md)。

⚠️ `20` 与 `21` 的**代码**仍要等 `07` 把 `packages/` 建出来 —— 本票定的是形态，
不是目录本身。这条边（`07 → 20`、`07 → 21`）已补上。
