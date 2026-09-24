# monorepo-probe —— 票 29 的实物验证

票 29 的产出要求写着：「若第 6 条需要看实物，调用 `prototype` skill 先在一个临时目录把
workspace 骨架搭起来（**不落进仓库**），证明依赖方向与构建链路真的成立，再决定。」

我在 `/tmp/mono-probe` 里搭了个五包等价体（`a`≈contracts、`b`≈assets、`c`≈demo、
`cli`、`mcp`，零外部依赖、全程离线），把票 29 的三条结构性断言逐条跑了一遍。
**玩具树本身是丢弃的，这里只留那个要进仓库的脚本。**

## 这里有什么

`check-deps.mjs` —— 依赖方向守卫，已按 `@game-maker/*` 的真实允许图写好，票 07 直接抄。

## 实测验证的六条

| # | 断言 | 结果 |
|---|---|---|
| ① | `tsc -b` 按依赖序构建五个包、产出 `dist/*.js` + `*.d.ts` | ✅ 一次通过 |
| ② | 增量重跑零工作 | ✅ 重建 0 个项目 |
| ③ | 改叶子包（`a`）→ 下游全部失效重建 | ✅ 重建 5 个项目，`cli` 的类型跟着变成新值 |
| ④ | `check-deps.mjs` 拒绝「已声明但被禁止的边」（`assets → demo`） | ✅ 退出码 1 |
| ⑤ | 未声明的依赖在运行时解析失败 | ✅ `ERR_MODULE_NOT_FOUND` |
| ⑥ | 深层 import 被 `exports` 挡住 | ✅ `ERR_PACKAGE_PATH_NOT_EXPORTED` |

## 跑这一遍撞出来的三件事（纸上不会发现）

**G1 —— `tsconfig.base.json` 里的 `outDir` / `rootDir` 是按 base 文件自己的目录解析的。**
不是按继承者。第一版把这两个字段放在 base 里，五个包**全部**把产物路径对到了仓库根的 `src/`
（`error TS6059: File ... is not under 'rootDir' '/tmp/mono-probe/src'`）。
**修法：相对路径类选项（`outDir` / `rootDir` / `include`）必须写在各包自己的 tsconfig 里，
base 只放绝对语义的选项（`target` / `module` / `strict` / `composite` / `declaration`）。**

**G2 —— `check-deps.mjs` 抓住的是我自己。** 我让 `mcp` 去 import `cli`，
守卫立刻报「被禁止的边」。这不是脚本太严，是它正确执行了 R5（MCP 不 shell out 到 CLI）——
`mcp` 该依赖的是核心库，不是 CLI 那个壳。**允许图因此把 cli 与 mcp 都限定为叶子。**

**G3 —— pnpm 的严格解析同时作用在 `tsc` 上，不只是运行时。**
把 `@probe/cli` 加进 mcp 的 import 却没写进它的 `package.json`，`tsc -b` 直接
`TS2307: Cannot find module`。第 1 层的覆盖面比预期更大：**类型检查期就拦住了。**
