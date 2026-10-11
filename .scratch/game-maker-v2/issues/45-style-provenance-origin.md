# 45. `provenance.style.origin` 硬编码 `"human-in-session"` —— 而契约枚举里没有「模型生成」这一档

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 29](29-stylespec-parse-gate.md)。人类在那一票 **Q4 的边界**里明确处置，原话：
> 「`provenance.style.origin` 的错误声明**记录为独立问题，本票不修改**。」

## Question

`pack.ts:1004` 写包时把风格出处**硬编码**成 `"human-in-session"`：

```ts
style: { origin: "human-in-session", ref: "authoring/stylespec.json", stylespecId: style.id, checksum: sha256(Buffer.from(styleDoc)) },
```

而 `assetpack.ts:225` 那份契约把 `origin` 收成**两值枚举**：

```ts
origin: z.enum(["human-in-session", "fixture"])
```

⚠️ V2 链上的 `stylespec.json` 是**模型生成的** —— 既不是人在会话里给的，也不是 fixture。
⇒ **它在撒谎**。而这不是「忘了改一个字」，是**结构性**的：枚举里**根本没有第三个可用的值**。

⚠️ 票 29 顺带量到的两件事，让这个洞比票面看上去更具体：

1. **全仓只有一个写点**（`pack.ts:1004`），且它**永远**吐第一个值
   ⇒ `origin` 今天是个**常量**，不是一份记录。它不携带任何信息。
2. **第二个值 `"fixture"` 零生产者** —— 全仓没有任何地方产出 `"fixture"`。
   （实测两份签入的 fixture 包 `counter-siege/v4` 与 `last-train/v2` **都**写着 `"human-in-session"`。）
   ⇒ 那个枚举**实际只有一档**。

要裁决的：

1. **加不加第三档**（`model-generated`？）—— 加了，`origin` 才**第一次有可能说得对**。
2. **`fixture` 那一档怎么办？** 它零生产者，且签入的 fixture 包都没用它 ——
   是「还没轮到」，还是「本来就该由 `mode` 承担、这一档是多余的」？（`PackMode` 里已经有 `"fixture"` 了。）
3. ⚠️ **枚举是 `.strict()` 的**，加值要动契约（`assetpack.ts`）**与**它的两个消费者。
   R6 管的是 `StyleSpec`、**不管 `AssetPackManifest`** ⇒ 这里**不是**撞 R6；
   且加值是**扩大**不是替换，旧包的 `"human-in-session"` 仍然合法 ⇒ 要判的是「**要不要回填**既有包与 8 份 fixture」。
4. **该由谁决定这个值？** 票 29 的 Q4 已经定了 `stylespec.json` 是**产物** ——
   那么「产物自报出处」这个判据的落点在哪（写包时按调用方给的？还是从链路上游传下来？）需要一并定。

## Answer

（待解）
