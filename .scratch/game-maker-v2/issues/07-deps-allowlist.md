# 07. 依赖守卫要先表态：`ALLOWED` 图加新包（否则新包根本装不上）

Type: task
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
> 依据 **R11**（Q12）。这是**一次机械修改**，但它挡住所有新包。

## Question

`scripts/check-deps.mjs:16-22` 现在的图：

```js
const ALLOWED = {
  "@game-maker/contracts": [],
  "@game-maker/assets":    ["@game-maker/contracts"],
  "@game-maker/demo":      ["@game-maker/contracts"],
  "@game-maker/cli":       ["@game-maker/contracts", "@game-maker/assets", "@game-maker/demo"],
  "@game-maker/mcp":       ["@game-maker/contracts", "@game-maker/assets", "@game-maker/demo"],
};
```

规则（`check-deps.mjs:36-42`）：**不在图里的包名直接报错**
（「新增包必须先在 check-deps.mjs 里表态」）· 允许表外的兄弟依赖一律红 · 只查 `dependencies`。

R11 定的目标图：

```js
  "@game-maker/vision":      ["@game-maker/contracts"],
  "@game-maker/game-design": ["@game-maker/contracts"],
  "@game-maker/qa":          ["@game-maker/contracts"],
  "@game-maker/pipeline":    ["@game-maker/contracts", "@game-maker/assets", "@game-maker/vision",
                              "@game-maker/game-design", "@game-maker/qa"],
  "@game-maker/cli":         ["@game-maker/contracts", "@game-maker/assets", "@game-maker/demo",
                              "@game-maker/pipeline"],
  "@game-maker/mcp":         ["@game-maker/contracts", "@game-maker/assets", "@game-maker/demo",
                              "@game-maker/pipeline"],
```

⚠️ **没有 `visual-memory`**（R11/Q16② 明确不建）。

### 要做的

1. 改 `ALLOWED`。
2. ⚠️ **顺序**：`check-deps.mjs:42` 会校验「图里每个名字都在 `packages/` 下存在」——
   所以这张图**不能先改**，得等包真的建出来，否则 `pnpm check` 当场红。
   ⇒ 这一票与票 08/09/10/12/15 **配对做**：建一个包 + 加一行，或者包全建完再一次加。
   **选一个并写进 Answer**（哪个更不容易把 `main` 弄红）。
3. 判据：`pnpm check:deps` 绿；且**故意**加一条违规边（例如 `vision → assets`）时它**变红**。

## Answer

（待解）

---

## Answer

**✅ 2026-10-01 已决议并落地。** Q20 = **9 个包**（既有 5 + 新 4）· Q21 = **(a) 一次建完骨架 + 一次接线**。

### 做了什么

**新建 4 个包骨架**，每个 4 样文件（`package.json` · `tsconfig.json` · `tsconfig.spec.json` · `src/index.ts`）：

```text
packages/vision/        → @game-maker/vision       [contracts]
packages/game-design/   → @game-maker/game-design  [contracts]
packages/qa/            → @game-maker/qa           [contracts]
packages/pipeline/      → @game-maker/pipeline     [contracts, assets, vision, game-design, qa]
```

每个 `src/index.ts` 只有 `export {};` 加一段注释，**指名**它那张票（08 / 09 / 17 / 15）。
⚠️ 这**不是**「零消费者的空壳」（那正是 `visual-memory` 被砍的理由）—— 这四个包**都有指名的票**，
注释就是「还没填，去这里看」。

**两处接线**（缺一处就不一致）：

1. `scripts/check-deps.mjs` 的 `ALLOWED` —— 加 4 行，并把 `pipeline` 加进 `cli` / `mcp` 的允许表。
   ⚠️ `cli` / `mcp` 的 `package.json` **现在还没声明** `@game-maker/pipeline`（那是票 15/16 的活）；
   `ALLOWED` 是**允许表**不是实际表 —— 这里先表态，免得后来再改一遍。
2. 根 `tsconfig.json` 的 `references` —— 加 4 行。

`pnpm-workspace.yaml` 的 `packages/*` 不用动。`pnpm install` 跑过（107 个包，**离线复用、未下载任何东西**）。

### 判据：绿 + **红**

```text
pnpm check:deps   ✅ 依赖图合法（9 个包）
pnpm check:links  ✅ 相对链接零断裂（137 份文档 · 610 条链接）
pnpm typecheck    ✅ 9 个包全 Done
pnpm build        ✅
pnpm test         ✅ 27 个文件 · 527 个测试全过
```

⚠️ **关键是「会红」** —— 三条变异，全部如期：

| 变异 | 结果 |
|---|---|
| 给 `vision` 加一条逆向依赖 `→ assets` | ✅ 红：`@game-maker/vision → @game-maker/assets：被禁止的边` |
| `ALLOWED` 里加一个 `packages/` 下没有的名字 | ✅ 红：`@game-maker/ghost: 允许图里有它，但 packages/ 下没有` |
| 把一个包从 `ALLOWED` 删掉（目录还在） | ✅ 红：`@game-maker/qa: 不在允许图里（新增包必须先在 check-deps.mjs 里表态）` |

三条复原后 `check:deps` 复绿；`vision/package.json` 与 `check-deps.mjs` 的 diff **只剩本票有意的那一处**。

### ⚠️ 一条我查了、但**没成立**的（比结论更值得读）

我原本要报的缺口是：

> 根 `tsconfig.json` 的 `references` 漏掉一个包会**静默** —— 包在、守卫绿、`dist/` 却永远不产出。

**实测不成立。** 做法：把 `packages/qa` 从根 `references` 摘掉 · **删掉它的 `dist/` 与 `tsbuildinfo`** ·
再跑 `pnpm check` ⇒ `dist/` **照样被重建**，`check` 全绿。原因：`tsc -b` **跟着 references 传递地构建**，
而 `packages/pipeline/tsconfig.json` 恰好引用了 `../qa`。

⚠️ **第一次测我测错了** —— 没先删 `dist/`，上一次构建的残留把结论遮住了；删掉重测才看见真相。

⇒ **更正一个心智模型**：根那张 `references` 是**构建入口表**，**不是** `packages/` 的镜像；
它只需覆盖「**没人引用的那些包**」。所以「图与目录必须同步」这句话**对根 references 不成立** ——
它只对 `check-deps.mjs` 成立（那个守卫是**双向**的，见下）。

### 一条留给票 15 的前瞻缺口（本票**不判**，只标出）

`pipeline` 今天的依赖表里**没有 `demo`**（R11 定的）。而 `createGame` 要装配站点，
`assembleFromConfig` 住在 `@game-maker/demo`（今天由 `cli` 调）。

⇒ 要么票 15 给 `pipeline` 加一条 `→ demo`（那就要在 `ALLOWED` 上补一行），
要么让站点装配留在 `cli` 那一层。**两条都合理，是票 15 的决定** ——
这里只标出来，免得开工时才发现 `ALLOWED` 又要动一次。

### 产物

- `packages/{vision,game-design,qa,pipeline}/`（4 个新包 × 4 个文件）
- `scripts/check-deps.mjs` · `tsconfig.json` · `pnpm-lock.yaml`
