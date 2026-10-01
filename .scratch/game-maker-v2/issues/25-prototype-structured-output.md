# 25. 代理到底支不支持结构化输出 / 视觉输入？—— 真发一次，量出来

Type: prototype
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
> 依据 **R16**（Q17）+ `packages/assets/src/generate.ts:11` 那条实测。
> ⚠️ **HITL**：这一票要**真发请求**（花上游的额度），所以它**不自动跑**，要人点头。

## Question

`generate.ts:11` 记着：

> ② **纯文本 JSON，不用 `tool_choice`** —— **票 01 实测强制 JSON 只有 1/3 通过**。
> ⚠️ **端点已改**：票 01 的配方是 `/v1/chat/completions`，但 2026-09-24 实测那条路走
> Codex 端点、落到一个余额为零的 provider（`INSUFFICIENT_BALANCE`），而 `/v1/messages`
> 仍然可用。**代理的上游配置一直在变，所以端点是参数不是常量。**

⇒ 「1/3」这个数是**对当时的端点**量的，而那句话**自己就说代理一直在变**。
**今天是否还成立，没人知道。** 而 V2 要在**同一条代理**上多吐**三份**严格 JSON。

### 要量的三件事

**① 结构化输出**：`/v1/messages` 今天认不认 `tool_choice` / `tools`（Anthropic 形状的强制 JSON）？
- 若认：量**成功率**（发 5~10 次同一个提示词，数几次是合法 JSON）。
- 若不认 / 报错：记下**错误形状**（HTTP 码 + body），这本身就是一个事实。

**② 视觉输入**：同一端点认不认 `content` 里的 `{type:"image", source:{type:"base64",...}}` 内容块？
- 拿一张**仓库里已有**的小图试（`fixtures/reference/halt-dusk.png` 或更小的），
  问它一个**有确定答案**的问题（例如「画面里有几节车厢」「主色调是什么」），
  这样**答错能看出来**。
- ⚠️ 与票 24 的分工：票 24 查**本地配置**，这一票**发请求**。

**③ 大 JSON 的极限**：一次调用能不能吐出 `01-contracts.md` §2 那么大的 `VisualWorldSpec`
（十一个块）？还是必须分块？量一下**输出长度**与**被截断**的迹象。

### 规矩

- ⚠️ **次数少**：每项 5~10 次足够，别烧额度。用最小的 `max_tokens` 能测出结论就行
  （⚠️ 注意：`generate.ts` 那条注释说**开着 thinking 会吃光输出预算**，关掉快 18 倍）。
- ⚠️ **探针脚本不要入 `packages/`** —— 仓库的惯例是探针放 `out/__probe*` 那种地方
  （`out/` 全部 gitignore）。产物记在 `.scratch/game-maker-v2/experiments/` 下。
- ⚠️ **量出来的数是观察，不是判据**（R3）：它决定**票 08 怎么写**，但不构成任何门。

### 判据

**三件事各有一个明确的结论**（认 / 不认 / 认但成功率多少），且每个结论后面跟着
**发了几次、几次怎样**的原始记录。**「试了一次，好像不行」不算数。**

## Answer

（待解）

---

## Answer

**✅ 2026-10-01 已跑（三发，按人指定的上限压到 2~3）。完整记录在
[`experiments/proxy-probe/README.md`](../experiments/proxy-probe/README.md)，原始响应在 `raw/`。**

### 三个结论

| # | 问题 | 答案 |
|---|---|---|
| ① | 模型**真看见**吗 | ✅ **真看见**。合成图（白底 3 圆，左红/中绿/右蓝，**真值是我造的**）⇒ 答 `"3 个；左=红色 中=绿色 右=蓝色"`，**全对** |
| ② | 真图 + 一次能吐多少 | ✅ 2129 字符 · **11 键全齐** · `JSON.parse` 通过 · **无 markdown 围栏** · `stop=end_turn` |
| ③ | `tools` + `tool_choice` 认不认 | ✅ **认**。`blocks=[tool_use]` · `stop_reason=tool_use` · input 是合法对象 |

三发全 **HTTP 200**（956 / 3404 / 1115 ms）。

⚠️ **① 是最要紧的一发** —— 它排除了那个**已知的失败模式**：这条路此前正好经历过
「**收得下图块、模型看不见图**」（`../../game-creation-v1/map.md:193-200`）。
合成图的真值是我自己画的，所以答对**不可能是碰运气**。

⚠️ **② 说的是那张图，不是在编**：`description` = *"a solitary figure in a train station…"*、
`foreground` = *"Train tracks"*、`background` = *"Station wall, bulletin board"* —— 对得上「黄昏山间列车小站」。

### ⚠️ 三条必须一起读的保留

1. **每项 n = 1。** 回答的是「**能不能**」，**不是「成功率」**。
   票 01 的「1/3」是一个**率**、且在**另一个端点**（`/v1/chat/completions`）上量的 ——
   本探针**既没复现它、也没推翻它**。要率得另开一次测量（多花请求）。
2. **`servedModel` = `deepseek-flash`**，而我们请求的是 `deepseek-v4-pro` ——
   代理换模型**又发生了一次**（旧图已记过）。⇒ 账上 `requestedModel` / `model` 分开记这条纪律**今天仍成立**。
3. **② 的 2129 字符是在 4000 `max_tokens` 下、点名只要那 11 个键拿到的** ——
   真的 `VisualWorldSpec` 可能更大。**天花板没量到。**

### 对下游的影响

- **票 08 的第一段不用新接上游**：复用 `/v1/messages` + base64 图块（照 `review.ts:90-93` 抄）。
  ⇒ 票 08 的 §1「谁来当 Vision LLM」与 §3「模型的实测限制」**这两问已被本票答掉**，票面已就地更新。
- ⚠️ ③ 让「严格 JSON」多了一条**比纯文本强**的路，而 **R16 定的是「沿用三件套」** ——
  **改 R 表必须重新开票**（R17）⇒ 派生[票 27](27-json-via-tool-choice.md)，并把 `25` 从 08/09/10 的阻塞里划掉。

### 产物

- `experiments/proxy-probe/run.mjs` · `raw/{01,02,03}-*.json` · `README.md`
