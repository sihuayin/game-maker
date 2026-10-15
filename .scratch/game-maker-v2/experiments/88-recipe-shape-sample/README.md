# 票 88 的只读探针 —— 核那份施工方案**能不能成立**

⚠️ **只读 · 零付费 · 零上游 · 源码一个字节没动。**

```bash
node .scratch/game-maker-v2/experiments/88-recipe-shape-sample/probe88.cjs
```

原始输出：[`raw-output.txt`](raw-output.txt)。方案在[票 88](../../issues/88-recipe-shape-sample-as-data.md) 的 `## 施工方案` 一节。

## 它核什么

段 B 的世界与视口**不写死**，直接从 `packages/assets/dist` 的构建产物里取
（`gameConfigExample.world.size` · `DEFAULT_VIEWPORT`）—— 与那条待写的测试**将用的是同一份**；
几何走**真的** `auditLayerCoverage` / `layerDrawnSize`。

| 节 | 读到的 |
|---|---|
| ① | 提案那份数据 × 骨架世界 ⇒ **零 error**（验收条件 1 成立） |
| ② | 把 `sky` 退回 `0.3` ⇒ **红 1 条**、报文含 **192×270px**（验收条件 2 成立 ⇒ 上一条不是恒真） |
| ③ | 提案 (甲) 三层 vs 今天那段样板，逐层对照 |
| ④ | 规矩第二条「把资源画得足够宽」的**临界宽度**表 |
| ⑤ | 最小改动 (乙) 也过 —— ⚠️ 但中间层没有示范 |

## 一条顺带量到的

⚠️ `nominal` 是**资源级**的（`ops.ts:785` 与 `demo/src/draw.ts:223` 都取 `asset.size`）
⇒ **层与层各自定宽做不到** —— 所以规矩第二条说的是「把**整件资源**画得足够宽」，
这与票 76 人裁的原话（「将**资源**绘制得足够宽」）**逐字对得上**。

## 边界

⚠️ **没有改任何源码或测试 · 没有跑真上游 · 没有提交。**
⚠️ **它入库**（本仓 32 个 `experiments/` 目录都在 git 索引里）。
⚠️ **唯一的例外是 `72-two-shell-size/`** —— 那一份由票 72 的 Q3′ 指定**不进索引**，
那是那一票自己的落点规矩，**不是本目录的通则**。
