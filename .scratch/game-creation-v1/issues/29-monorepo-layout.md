# 29. monorepo 切分与构建工具链

Type: grilling
Status: open
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
