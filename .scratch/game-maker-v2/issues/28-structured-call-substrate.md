# 28. V2 结构化调用的**底座**：`contracts` 里的 tool schema/解析器 + 账的 `failure` 闭集

Type: task
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
> 由[票 27](27-json-via-tool-choice.md) 的 **Q3(ii) + Q4(ii)** 派生，并按 **R5**（执行带进地图）当场开工。
> **没有任何要决定的东西** —— 决定已经在票 27 做完了，这一票是**执行**。
> ⇒ 它是 **08 / 09 / 10 的硬前置**（那三张票都要按 R16（新）写代码，而 R16（新）的判据落在这里）。

## Question

票 27 定了两件必须**先存在**的东西，否则 08/09/10 一开工就会各写一份歪的。

### 一、`contracts` 里那**纯的一半**（Q3(ii)）

R11 / `check-deps.mjs` 的结构约束是「**新包彼此不依赖、只依赖 `contracts`**」，
所以共享的 I/O（fetch / 重试 / 记账）**堵死了**。但真正容易写歪的是**形状那一半**：

1. **`Zod Schema → tool 的 `input_schema``** 的转换器。
   ⚠️ **零新依赖**：装的 zod 是 `3.25.76`，但**包里带着 v4 实现**，走 `zod/v4` 子路径
   就有内置的 `toJSONSchema()`（`node_modules/.pnpm/zod@3.25.76/node_modules/zod/v4/classic/external.d.ts:8`）。
   今天仓库里 **0 处**用到它。
2. **「从一次响应里取出那个对象」的解析器** —— 找 `tool_use` 块、取出 `input`、
   `safeParse` 过关，**并把失败归类**（下面那个闭集）。
   ⚠️ **`stop_reason === "tool_use"` 不是成功信号**（票 27 第 1 发：工具被调、`input={}`）。
   解析器**不许**拿它当捷径。

⚠️ 这一半是**纯函数**：零 I/O、可单测。**不要**把 fetch 塞进 `contracts`。

### 二、账要能区分**失败病因**（Q4(ii)）

`LedgerCall` 今天是 `.strict()` 的，只有 `attempts`（次数），**没有任何字段说「为什么重来」** ——
四种完全不同的病因混在同一个分母里：

| 病因 | 说明什么 | 今天能看出吗 |
|---|---|---|
| 模型**没调工具**、直接回文本 | 代理**没认** `tool_choice` —— 这是 (a) 的死因 | ❌ |
| 调了工具但 `input` **过不了 Zod** | schema 太大 / 模型能力不够 | ❌ |
| **`input` 是空的**（代理丢数据，票 27 第 1 发实测） | 代理的 bug，**与模型无关** | ❌ |
| 被**截断**（`stop_reason = max_tokens`） | 输出预算不够 | ❌（且 `ops.ts` 今天**根本不看 `stop_reason`**） |
| HTTP / 超时 | 代理又挂了 | ❌ |

加一个**闭集**字段，只在**失败那笔**上出现（成功那笔不带，`absence == 不是失败`）：

```ts
failure?: "http" | "timeout" | "truncated" | "no-tool-use" | "empty-input" | "schema"
```

⚠️ `empty-input` 是票 27 的探针**当场抓到的**那一档，别省。

### 三、账改成**可追踪、不可覆盖**

今天两处是坏的，都在 `ops.ts`：

- **`derive`（`ops.ts:112-116`）每一轮把 `deriveCall` 整个覆盖写**，且记的 `attempts` **恒为 1**
  ⇒ 它的重采样在账上**完全不可见**。
- **`compileGame` 根本不返回 ledger**（`compile-td-game` 返回）。同一个仓库两个样。

⇒ 改成：**每次尝试各记一笔**（与 `generate.ts:195/209` 的写法对齐），
`compileGame` 也把 ledger 交出来。**这动的是账，不是协议** —— 与票 27 Q2(i)「旧协议不动」不冲突。

## Answer

**✅ 2026-10-01 已施工。** R5 把执行带进了地图，所以这一票当场做完，不是又出一张决定。
两个评审轴（Standards / Spec）各跑了一轮，**都指到了同一处硬伤**，已修 —— 见下面的「当场更正」。

### 落了什么

| 文件 | 内容 |
|---|---|
| `packages/contracts/src/structured-call.ts`（新） | `CALL_FAILURES` 闭集 · `StructuredSchema`（结构性，v3/v4 都吃）· **`parseToolUse`** · **`toolInputSchema`** · **`forcedTool`** · `STRUCTURED_CALL_ATTEMPTS = 3` |
| `packages/contracts/src/zod-issues.ts`（新） | `formatIssues` / `IssueLike` / `parseWith` —— 从 `drawlist.ts` **搬出来**（评审：一个画图模块不该兼当 Zod 错误桥） |
| `packages/contracts/src/ledger.ts` | `failures` 字段 · **`LedgerStep` 补上 `"compile-game"`** |
| `packages/assets/src/ops.ts` | `onceThrough`（一趟往返）· `spentCall`（一次调用的账，随往返累加）· 三处调用点改用它 |

**没有新依赖**（`pnpm-lock.yaml` 与所有 `package.json` 零改动）。562 个测试全过。

### 🎯 当场更正：`compileGame` 不交账的**真正原因**

票面写的是「`compileGame` 根本不返回 ledger」。落地时发现根因**不是谁忘了写一行**：
**`LedgerStep` 枚举里压根没有 `compile-game` 这个值** —— 一次上游调用**没地方记**。
补一个枚举值的代价是零（`byStep` 是 `z.record`，缺键不算错），磁盘上已有的账照常通过。

### 🎯 当场更正：票面那条「走 `zod/v4` 子路径就有 `toJSONSchema()`」**对 v3 不成立**

`zod/v4` 的 `toJSONSchema` 只吃 v4 的 `$ZodType`，而 `import { z } from "zod"` 造出来的
v3 `ZodObject` **连 `_zod` 都没有**（实测：`Cannot read properties of undefined (reading 'def')`）。
两条路里选了 **「新契约用 `zod/v4` 写」**（另一条是加 `zod-to-json-schema` 依赖）：
Q2(i) 本来就定了只有 V2 新调用走这套协议，而 V2 那批契约**今天一个都不存在**
（`visual-world` / `game-intent` / `game-design` / `runtime-profile` / `qa` 在 `packages/contracts/src/` 里零命中）
—— 所以这是**定新增，不是改存量**。⛳ **零新依赖**，且 zod 4 才是这条路的前方。

⚠️ **这是一条对别的票的约束，不只是实现细节**：

> **V2 的新契约用 `import { z } from "zod/v4"` 写；旧契约（`StyleSpec` / drawlist / assetpack / …）继续用 `zod`。**
> 两边**不许互相嵌套**（v3 的 `z.array` 里塞 v4 的 schema 会炸）。这条已写进本文件与
> [票 02](02-contract-visual-world.md) / [03](03-contract-intent-and-design.md) / [04](04-contract-character-dna.md) /
> [05](05-contract-runtime-profile.md) / [06](06-contract-qa.md) 的票头。

⚠️ 附带一条形状规矩：**封口要用 `z.strictObject`**。`io: "input"` 下普通的 `z.object`
**不**产出 `additionalProperties: false`（实测）。转换器**不替契约猜** —— 猜就会把
`materials` 那种**开集 `Record`** 也封上，而开集与 `additionalProperties: false` 是矛盾的（票 27 记过）。

### ⚠️ 三条与票面字面不同的地方（都是评审逼出来的，理由在代码里）

1. **`failure` 改成 `failures: CallFailure[]`（数组），不是标量。**
   票面（与票 27 的 Q4(ii)）写的是单值。落地的第一版把 **`LedgerCall` 从「一次调用」改成了「一次往返」**
   —— 而 `CONTEXT.md` 的术语表把这两件事**明确定义开了**（`attempts` 记的是「这一次调用里往返了几次」），
   于是文档化的探测器 **`attempts > calls` == 重试过** 当场失效。评审把它判成**硬违规**，判对了。
   现在：**一格 = 一次调用**（重采样不新开一格），`attempts` 照旧累加，**每次没成的原因按顺序进 `failures`**。
   两个都留着，账才同时回答得了「重试烧了多少」**和**「每次为什么重来」——
   只留最后一次时，最该看见的那一档（上游丢入参、重采样救回来了）**一次都不会出现**。
2. **闭集是 7 个，不是 6 个**：加了 **`invalid-json`**。纯文本那一路的主要失败就是它
   （工具那一路拿不到这一档），而票 28 §三 要给那三处调用点记账，没有它就没词可用。
3. **`empty-input` 比字面宽一档**：不只是「空对象」，而是「这一趟**没交出任何可用的入参**」——
   `{}` / `null` / 字符串 / 数组都算。票 27 第 1 发实测的正是 `{}` 那个形状。

### 评审修掉的另外三处

- **截断只解释失败，不许推翻成功**：`parseToolUse` 原来先看 `stop_reason === "max_tokens"` 再找块，
  于是一份**完整合法**的入参会被判成 `truncated`——代价是丢掉一份好结果再花一次钱重采样。
  现在先「找块 → 验入参」，**过 Zod 就是成功**（R16 的原话），只在**没拿到可用入参**时才回头看 `stop_reason`。
  `ops.ts` 的 `onceThrough` 同一条：`callText` 现在把 `stop_reason` 交出来，截断不再冒充「不是合法 JSON」。
- **「没配凭据」不该进账**：它以前会落成 `failure: "http"`——一个**本地配置错**被计成**上游故障**。
  现在 `onceThrough` 分出 `"not-sent"` 那一档：请求压根没上路，**账上就没有这一笔**（票 46 只记真的发出去的）。
- **一处测试里的孤儿断言**搬进了它自己在测的那条。

### 没做的（有意）

- `STRUCTURED_CALL_ATTEMPTS` 今天**零消费者** —— 它是 R16（新）钉的那个数，等票 08/09/10 来取。
  评审标了「Speculative Generality」，接受：票面明确要求「只此一份」，而那三张消费它的票就在下游。
- 测试里的 `tmp()` / `upstream()` 脚手架在三个文件里各有一份（评审判为 judgement call）。**没并** ——
  这三处夹具的**输入形状不一样**（包 / 配方 / 风格），硬并在一个 helper 里会立刻长出参数分支。
