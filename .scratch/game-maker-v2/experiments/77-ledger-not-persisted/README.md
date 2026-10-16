# 票 77 探针 · 失败现场上的账 —— 壳印出来的 vs 盘上真花的

**只读 · 零付费 · 零网络。** 一条命令，读的全是盘上现成的字节：

```bash
node .scratch/game-maker-v2/experiments/77-ledger-not-persisted/probe77.mjs
```

原始输出逐字留在 [`raw-output.txt`](raw-output.txt)（本文件里的数**全部**来自它）。

## 它读什么

| # | 读点 | 是什么 |
|---|---|---|
| ③ | `<raw>/run-<suffix>.json` 的 `.text` **开头那个 JSON 对象**里的 `ledger` | **壳实际印出来的**那一份 ⚠️ `.text` 不是纯 JSON：JSON 之后还跟着驱动记的进度行 ⇒ 脚本从 0 起扫出第一个配平的 `{…}` |
| ① | `<run-out>/<gameId>/run/v<N>/ledger.json` | run 级账（`writeRunLedger` 的产物 · 链级并集） |
| ② | `<run-out>/<gameId>/pack/v<N>/ledger.json` | 包的收据（跟包走、被 `verify` 校验） |
| ④ | `<run-out>/.failed-*` | 失败现场（`abandonRun` 改的名）里到底有哪些文件 |

`<raw>` = `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/`（票 23 的真跑现场，**本机**）。

## ⚠️ 三条读法上的讲究（不守就会读出错的数）

1. **两份账不能相加。** run 级那份是**链级并集**（段 A ∪ 段 B），包那份是**段 B 的一部分**
   ⇒ 相加 = 重复计数。本脚本报的是**按行去重后的并集**。
2. **`.text` 不是 JSON。** 它是「一个 JSON 对象 + 一截进度行」⇒ 必须扫出第一个配平的 `{…}`，
   直接 `JSON.parse` 会**整份失败**（第一版探针就栽在这儿，会把「有账」读成「没账」）。
3. **⚠️ 有几跑是**过时的现场**，不能当今天的证据**：`run-out-2026-10-10c` 死在 `pack` 段而壳
   **一行都没印** —— 那是因为它跑在 **2026-10-10**，而「按**能力**读、不按类读」是
   **票 48**（`e1617d4`，**2026-10-12 18:52**）才落地的。⇒ 那一跑量到的是**票 48 已经治好**的病。
   **13 日那一族（13a–13h）全部在票 48 之后**，才是今天壳的行为。

## 本轮量到的六件事

① **13e（第十二跑 · 死在 `config`）**：壳印 **1 行**，这一跑真花 **36 行**（含 **14 张图**）。

② ⭐ **13h（第十五跑 · 死在站点装配期）**：壳**连 `ledger` 这个键都没有**，而这一跑真花 **35 行**
   （含 **11 张图**）。⚠️ 而它的 run 级账**是写全了的** —— 35 行都在磁盘上，**只是没人念给它听**。

③ ⭐⭐ **13e 与 13h 是一次天然对照实验**：两张死的是**同一类**判据（「层盖不住世界」），
   而**抛点不同 ⇒ 下场不同**。⚠️ 而[票 65](../../issues/65-layer-coverage-at-config.md)
   恰恰把那条判据**从 13h 那一侧搬到了 13e 那一侧** —— 账从「已落盘」挪进了「还没落盘」那一段。

④ ⚠️ **段 A 也少报，而且那半边的真值**哪儿都不在盘上**（本轮新发现的半边）**：
   段 A 的 run 级账只在**成功**时写（`create-game.ts:314`），失败现场里也没有账
   ⇒「前面那几步跑过没有」只剩**进度行**。四跑量出来：少 3 / 3 / 2 / 4 行。

⑤ ⭐ **仓库里已经有先例**：`packAssets` 的 catch（`ops.ts:1480-1516`）**已经**挂的是
   **整个累积数组**（不是最后一发），而且同时挂 `failureDir` —— 那一份连失败现场里的账都读得到。

⑥ ⚠️ 而 `compileRuntime` 那一段**没有**可挂的数组：它里面**根本没有累积数组**，
   只有 `spentCall("compile-runtime","game-config")` **那一格**（它已经涵盖了本步的 3 次重采样）
   ⇒ 「挂累积的账」在那一处是**发明一个还不存在的累积**，不是换个形状。

## 第二个探针：`probe77-carry-noop.mjs`

```bash
node .scratch/game-maker-v2/experiments/77-ledger-not-persisted/probe77-carry-noop.mjs
```

量的是另一件事：**「把累积的账挂到异常上」这句话挂不挂得上**。用**出货的**契约实现跑
（`packages/contracts/dist/command.js`），不是本脚本自己重写的等价物。原始输出在
[`raw-output-carry-noop.txt`](raw-output-carry-noop.txt)。

| 情形 | 异常的形状 | 挂之前 → 挂之后 | |
|---|---|---|---|
| ① | `new CommandError(…, { ledger: [X] })` —— `ops.ts` 那 8 处的形状 | `["compile-runtime"]` → `["compile-runtime"]` | ⚠️ **没挂上** |
| ② | `new CommandError(…)` —— 第三参都没给（`assertQaPassed` / `failWith`） | `undefined` → `undefined` | ⚠️ **没挂上** |
| ③ | 普通 `Error` —— `ops.ts:1248` 与 `packAssets` 靠这一档 | `undefined` → `[A,B,C]` | ⭐ 挂上了 |

⚠️ **根因**：`CommandError` 的构造器**无条件**赋 `this.ledger = opts.ledger`（`command.ts:78-86`）
⇒ `"ledger" in e` **恒真** ⇒ `carryOnError` 的「**只加不改**」（`command.ts:133-140`）
把它当成「下层已经挂过了」⇒ **一次静默的空操作**。

⚠️ **仓库自己已经记着这条**：`ops.ts:1233-1235` 逐字 ——
*「`CommandError` 的构造器**无条件**赋 `ledger`/`failureDir` ⇒ `'ledger' in e` 恒真 ⇒
下面那句 `carryOnError` 对它们本来就是个 no-op」*。

⇒ 本票的 (a) 那一支（「异常上挂累积的账」）**要成立，得先回答「用什么动词挂」**。

## 明确**没**证的

- **改完之后人会不会真的看见对的钱** —— 那要在一次真跑的失败现场上看（**票 23**）。
- **`pack` 段失败时的完整账**（⑤）是**读代码 + 读测试**读出来的：语料里那一档的**唯一实例**
  是 `10-10c`，而它**跑在票 48 之前**（见上面第 3 条）⇒ 今天的行为**没有现场量过**。
