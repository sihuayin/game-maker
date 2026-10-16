# 票 96 的只读探针 —— 「给 `verify` 一个清单入参」落到盘上今天已有的包上，会报什么

⚠️ **只读 · 零付费 · 零上游 · 源码一个字节没动 · 不写任何产物。**

```bash
node .scratch/game-maker-v2/experiments/96-verify-manifest/probe96.mjs
```

原始输出：[`raw-output.txt`](raw-output.txt)。

## 它核什么

跑的是**若 (a) 落地就要跑的那一段循环**（`qa/src/visual.ts:104-124` 的同款：逐条清单资产 →
包里找同 id 的 entry → 找不到报「包里没有」→ 找到调 `auditAssetSpec`）。
⚠️ 判据本身**不重写**：直接调出货的 `dist` 里的 `auditAssetSpec` / `parseRecipe` / `parseAssetPack`。

| 节 | 读到的 |
|---|---|
| ① | `verifyPack({packDir})` 对盘上两个包**都是 `ok=true`**（今天没有清单也过） |
| ② | `last-train.json` ＋ `last-train/v2` ⇒ **缺 0 · 不符 0**；`counter-siege.json` ＋ `counter-siege/v4` ⇒ **缺 0 · 不符 0** |
| ② | `counter-siege-derived.json` ＋ `counter-siege/v4`（**从未配对过的两份**）⇒ **缺 15 · 不符 5** |
| ③ | 包里**没有指回清单的指针**（`generator={name,version}` · `provenance={mode}`）⇒ 清单只能由调用方给 |

## 两条顺带量到的

⚠️ **对账是单向的**：循环走的是**清单**那一侧，包里**多出来**而清单里没有的 entry
**今天没有任何判据看得见**（探针单独数了：那两份真配对各 **0** 件，错配那一对 **15** 件）。
⚠️ **第二条**：两处「不符」在可到达的场景里都**不指认谁的错** ——
真配对上恒 0，剩下那一次非 0 的形状是「这两份东西不是一个年代的」，不是「包做错了」。
