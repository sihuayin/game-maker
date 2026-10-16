# 96. `verifyPack` 的文件头承诺 **spec↔产物对账** —— 而它**结构上做不了**（票 92 的 Q3 = (a) 裁出的票）

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 92](92-asset-spec-anchor-not-reconciled.md) 的 **Q3 = (a)「另立一票」**。
> 人答逐字（2026-10-16）：「**Q1–Q4 全部采纳推荐项**；认同「恒等就不该有对账」，
> 但**仅限于没有独立信息增量的字段比较**。」
> ⚠️ 同批另立[票 95](95-audit-header-promise-reconcile.md)（票 92 的 Q1 = (a)）。**两张各自独立授权。**
> ⚠️ **立票 ≠ 批准施工**（票 65 / 71 / 82 / 90 / 91 / 92 先例逐字沿用）：本票面**只登记现场与射程**，
> 动手要**另一次独立点头**。

## Question

**`verify` 的那句承诺，是要给它一个清单入参去**兑现**，还是把那半句**删掉**？**

## 1 · 现场

`packages/assets/src/ops.ts:1563` 逐字：

```
/** 校验一个包：schema + **逐文件 checksum** + spec↔产物对账。 */
```

而 `verifyPack`（`:1564`）的函数体**一次都没调 `auditAssetSpec`**
（`grep -n audit packages/assets/src/ops.ts` ⇒ 命中的是 `auditGameConfig` / `auditTdConfig` /
`auditScreenSpace` / `auditLayerCoverage` / `auditReachability`，**没有 `auditAssetSpec`**），
且它的入参是 `VerifyOptions = { packDir: string; outRoot?: string }`（`:1561`）—— **手里没有清单** ⇒
它**结构上做不了**那件事。它今天真做的是：`parseAssetPack` · 逐文件 `checksum` 与字节数 ·
`ledger.json` / `MASTER_RATIOS_FILE` 的 schema 与版本对齐 · `files[]` 覆盖穷举。

## 2 · 为什么它比票 95 更像一张票：它自带一个**真问题**

[票 92 的读数 H](../clarifications/92-round-1.md) 量到：`auditAssetSpec` 的两个生产调用点
（`pack.ts:1170` · `qa/src/visual.ts:119`）**都只吃同一次构建/同一次运行的产物** ⇒
**自动链上没有一处能让「清单」与「包」不同源**，这条判据的牙今天**只长在 R9 那条「人可改」的路上**
（`runBuild` 文件头逐字：「**只吃 `runDir`**：……**R10「人可改」要的就是这个**」）。
⇒ 「给 `verify` 一个清单入参」**正是**给那条路配一把尺子：一份**不是它建的**包，
拿一份**人改过的**清单去对。

⚠️ 但**代价必须先摆出来**（本轮**没有量**）：`verify` 今天是个**只吃 `packDir` 一条路径**的命令
（`cli.ts:580` 那一档），加一个可选清单入参会改它的**用法面**；而「清单是可选还是必填」
本身又是一格 —— 盘上已有的包**大多数没有配对的清单**。

## 3 · 要裁的三格（本票**只作裁定**）

1. **兑现还是删句**？(a) 给 `verify` 一个**可选**清单入参，给了就照跑 `auditAssetSpec` ·
   (b) **删掉**「spec↔产物对账」那半句（它今天是一句**做不到的**承诺）·
   (c) 别的。
2. **若兑现**：清单**可选还是必填**？⚠️ 可选的话，「没给清单」与「给了清单、对账通过」是**两件事**，
   而它们的**输出必须能分开**（照本仓「缺席 ≠ 查过了」那条纪律，见 `qa/src/visual.ts` 文件头五）。
3. **射程**：`verify` 是**三个壳**共用的吗（`cli` / `mcp` / 库）？
   ⚠️ `packages/mcp/src/server.ts` 也引 `verifyPack` ⇒ 加参数要**三个壳一起看**。

## 4 · 边界

- **立票 ≠ 批准施工**：本票是 `Type: grilling` ⇒ **只出裁定**（本票**尚未认领**）。
  `ops.ts` / `cli.ts` / `packages/mcp` **一行不碰**，直到**另一次独立点头**。
- **不与[票 95](95-audit-header-promise-reconcile.md) 合并** · **不动 R 表**（R17）·
  `packages/qa` 一行不碰 · `fixtures/**` 不碰 · `game-maker.local.json` 一个字不动 ·
  **不执行任何付费真跑** · **不提交**。
- ⚠️ **免费证得了的**：§1 的逐行读数 · `grep` 的「零命中」。
  **免费证不了的**：加参数之后那三个壳的用法面会变成什么样（**没量过**）。
