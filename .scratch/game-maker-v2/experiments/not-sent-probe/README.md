# 探针：`not-sent` 那一档的三张脸、它的账簿幻影，以及两条路的判档分歧

**纯本地、零网络、零花费。** 全部走 `fetchImpl` 桩 —— 没有一次真调用、没有一次付费运行。
回答的是[票 51「`not-sent` 那一档两头都不准」](../../issues/51-not-sent-lies-both-ways.md) 的「先量再问」五条。

读数写进了票 51 的 `## 第 1 轮已量到的`（M1–M6）；本目录是那批读数的**可复跑见证**。

## 跑法

```sh
# 1. 造两份逐字复制的 ops.ts 副本（跑完务必删）
node .scratch/game-maker-v2/experiments/not-sent-probe/make-copies.mjs

# 2. 把探针拷进 assets 的 tests/（它 import "../src/…"，只能在那儿跑）
#    ⚠️ 存在这里的名字带 `.txt` 尾巴：vitest 默认扫 `**/*.test.ts`，不这么写
#       `pnpm test` 会把它当一条真测试收走、然后因为找不到 `../src/` 整个套件变红。
cp .scratch/game-maker-v2/experiments/not-sent-probe/probe.test.ts.txt packages/assets/tests/probe51.test.ts

# 3. 跑（读数同时落盘成 JSON，给下一个人留证）
PROBE_OUT=$PWD/.scratch/game-maker-v2/experiments/not-sent-probe/raw \
  npx vitest run packages/assets/tests/probe51.test.ts

# 4. 收摊（这三个文件**都不该进任何一次提交**）
rm packages/assets/tests/probe51.test.ts \
   packages/assets/src/probe-ops-a.ts packages/assets/src/probe-ops-b.ts
```

⚠️ 两份副本是**逐字复制**的 `ops.ts`，只多两处、共四行：

| 副本 | 改了什么 | 为什么 |
|---|---|---|
| `probe-ops-a.ts` | `export` 了 `spentCall`（为了直接调它）＋ **一行**：`compileTdGame` 的 `not-sent` 抛点照抄成 `upstream` 档的样子（带账） | 量 `trip({})` 之后 `record()` 交出什么，并演示「照抄就会报出一笔假账」这个陷阱 |
| `probe-ops-b.ts` | A 之上再一处：`callText` 的 `res.json()` 包 try/catch（逐字对齐 `onceThroughTool`） | **预演修法 (a)**：只设防能不能把那一族收干净 |

`make-copies.mjs` 每处都在场断言 —— 上游源码一动，它**当场炸**，而不是悄悄产出一份假副本
（改完的 `diff` 只该有那四行，行号 `324` / `419` / `961` 是当时的真值）。

## 变异（票 51 落地**之后**那四发 · 2026-10-12）

```sh
python3 .scratch/game-maker-v2/experiments/not-sent-probe/run-mutations.py
```

⚠️ 它**就地**改 `packages/assets/src/ops.ts` 再还原（`finally` + sha256 校验），**别和并跑的会话撞**。

| # | 变异 | 结果 |
|---|---|---|
| ① | 撤掉 `callText` 的非 JSON 设防（`res.json()` 裸回去） | 🔴 红（1 条） |
| ②a | 撤掉 `callText` 的形状设防 | 🔴 红（4 条） |
| ②b | 把 `onceThrough` 的判据退回「兜底 = `not-sent`」 | 🔴 红（1 条 —— 只红**⑤**） |
| ③a | `not-sent` 只加回 `trip`（不动抛点） | ⚪ **没红**（见下） |
| ③b | `not-sent` 加回 `trip` **且**照抄 `upstream` 档挂账 | 🔴 红（1 条） |
| ④ | 撤掉工具链的「body 不是对象」前置检查 | 🔴 红（2 条） |

**两发要解释的**（都不是「测试写漏了」）：

- **②b 只红 ⑤**：①② 那几张脸都被 `callText` 的守卫**提前**收成了 `UpstreamCallError`，判据那一步
  根本轮不到 —— 所以「判据是点名还是兜底」在它们身上**看不出来**。⑤ 是专门为这一臂加的：
  它让一个抛点（HTTP 头回来了、读 body 时才断）**绕过**守卫，走到默认那一臂上去。
  ⇒ 没有 ⑤，Q1(d) 翻转的那一半**一条测试都没钉着**。
- **③a 没红**：只 `trip` 不挂账时，那一格幻影**没人读**（`not-sent` 那个 `CommandError` 不带账）
  ⇒ 从外面**观察不到**。这正是票面把它叫「**陷阱**」的原因：它要等**下一个人**照着 `upstream` 档
  照抄才害人（③b 就是那次照抄）。所以 ③ 钉的是**结果**（账必须缺席 ⇒ 因为一趟都没发），
  而修法是**结构性**的：不 `trip` ⇒ `trips` 恒 0 ⇒ `record()` 恒 `null` ⇒ 将来谁接上也是 no-op。

## 一句话结论（细节见票 51 的 M1–M6）

- **产 `not-sent` 的地方只有一处**（`onceThrough` 的 catch），而它的**唯一调用方是 `compileTdGame`**
  —— `planAssets:221` / `compileRuntime:709` 那两行**够不着**（`onceThroughTool` 从不产这一档，只为类型收窄而存在）。
- 它今天收**三张脸**：凭据没配（真没上路）· 200 + 非 JSON（上路了、花了钱）· 200 + JSON 但形状炸
  （`null` / `{"content":5}`，同样花了钱）。**只有第一张是它该收的。**
- 三张脸对外都被重包成 `upstream`/3 ⇒ **退出码今天没变**；变的是**账**（后两张的账整个缺席）与**文案**（原始 JS 错误直出）。
- `trip({})` 让 `record()` 交出一格 `{attempts: 1, ms}` 的**幻影**（一个请求都没上路），
  且它违反 `CONTEXT.md:427-429` 对 `attempts`（= HTTP 往返趟数）的定义。
- 同一份 `null` 体：工具链判 `invalid`/4 且重试 3 趟，文本链判 `upstream`/3 —— **真分歧**。

## 产物

`raw/` 里是那一次跑（2026-10-12）落盘的逐条读数，与票 51 的 M1–M6 一一对应：

| 文件 | 对应的量 |
|---|---|
| `probe51-three.json` | M3 —— **三个命令 × 七种 200 回应体**（含 `{"content":5}`）的落点 / `kind` / 退出码 / 账 |
| `probe51-record.json` | M4 —— `trip({})` 之后 `record()` 的逐字段读数（含「一次没 trip」与「一次真往返」两个对照） |
| `probe51-phantom.json` | M4 —— 陷阱演练（那一行照抄成带账之后，错误上挂出的假账） |
| `probe51-credentials.json` | M5 —— 空凭据走三个命令各自的对外落点 |
| `probe51-shapes.json` | M2 —— 形状族（`false` / `"abc"` / `{}` / `content:5` / text 缺 / text 为 null）逐条 |
| `probe51-option-a.json` | M6 —— 修法 (a) 的预演 |

## 没量到的（诚实清单）

- **真实上游会不会真回这些形状**（`null` / `{"content":5}` / `text/plain`）：本探针只喂桩，
  **一次真调用都没有**。「代理把上游的 500 转成 200 带 error body」是票面的判断，**不是量出来的**。
- **两个壳（CLI / MCP）印出来的字**：本探针只到 `CommandResult` / 异常那一层，没走壳
  （票 50 正是为「壳那一侧没有见证」开的）。
