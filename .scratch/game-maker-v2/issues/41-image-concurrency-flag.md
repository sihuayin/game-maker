# 41. CLI 加一条**只设 image** 的并发路 —— `--concurrency` 表达不出裁定要的「image 2」

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 23「E2E fixture + 真跑一次」](23-e2e-fixture-wasteland.md)：第四/五/六跑**每一跑都在偏离一条已裁的规矩**。
> 人类在[第六跑决策轮第 1 轮](../clarifications/23-run6-round-1.md) 的 **Q4** 上裁定：
> 「**增加图片并发参数** —— 能独立控制 image concurrency」。
> ⚠️ **它推翻的是[票 47「并行生成资源」](../../game-creation-v1/issues/47-parallel-generation.md) 在 CLI 那一层的选择** ——
> 见下。引擎那两个信号量的**形状不变**，变的是 CLI 的**入口**。

## Question

**裁定给的数**：票 23 第五跑 Q3 的原话是「**image 2**」。
**而 CLI 上表达不出来**：只有一个 `--concurrency <n>`，落成 `{ text: n, image: n }`
（`cli.ts:179` 与 `:446`，两条路都这么写）⇒ 第四/五/六跑实为 **`text 2 / image 2`**。

⚠️ **引擎那一层是支持的** —— 缺的只是那个 flag：

```
ops.ts:1029   concurrency?: { text?: number; image?: number };   // 分开的
pack.ts:162   export const DEFAULT_CONCURRENCY = { text: 4, image: 3 } as const;
```

⚠️ **而 `cli.ts:438` 的注释今天写着反话**（引票 47）：

> 并发上限（票 47）：**按上游分别定**是本来的形状，但一个数就够人用了 ——
> 给了就两边都用它；**要分开调就用 API**。

⇒ 票 47 的决定是「CLI 只给一个数 · 分开调走 API」。**这条裁定把它推翻了**，所以那句注释要**改**，
并在票里记明这一层是被推翻的（不能只改代码、留一句反话在那儿）。

要定的：

1. **形式**：`--concurrency-image <n>`（与 `--concurrency` 并列），还是让 `--concurrency` 收
   `text:2,image:2` 这种值？（⚠️ 后者要动 `concurrencyOf` 的解析与它那条 usage 报错。）
2. **默认值不动**：票 47 那张表是**实测挑的**（串行 50.1s → 并发 4 是 11.6s 的最优点），
   而 `image` 那条比文本保守（上游限流）。⇒ 本票**只加「覆盖」**，**不许动 `DEFAULT_CONCURRENCY`**。
3. **两条路都要接**：`create --yes`（`cli.ts:404`）与 `build`（`cli.ts:416`）—— 今天两处各写了一遍。
4. **`pack` 那条独立命令**（`cli.ts:440`）要不要也接？（它的 `--concurrency` 只喂 `packAssets`。）
5. **要不要一条测试钉住「只设 image 时 text 仍是默认值」**（否则「分开设」会退化成「又变成一起设」）。

## 量到的

- 第四/五/六跑实为 `text 2 / image 2`（三跑的驱动都有 `--concurrency 2`）。
- 票 47 的实测表（同一份清单 · 真上游）：并发 1 → 50.1s · **4 → 11.6s**（最优）· 6 → 12.2s · 8 → 11.7s
  ⇒ 「再往上没有收益，只有被上游限流的风险」。

## 裁定（2026-10-10 · 人类第 1 轮）

**Q4：增加图片并发参数。** 验收重点：**能独立控制 image concurrency**。

## Answer

（待解）
