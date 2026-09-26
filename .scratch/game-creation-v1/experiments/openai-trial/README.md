# openai-trial —— `openai` 形态的生图客户端：探活 + 真跑

2026-09-26。人类把 `game-maker.local.json` 换成了 OpenAI 形态（实际指向**中转**
`api.krill-code.net/v1`，模型 `gpt-image-2.5`，经代理 `127.0.0.1:9098`，key 46 字符）。
此前 `imageGeneratorFor` 对 `openai` 是**显式抛「没实现」** —— 这一轮把它写出来并真跑。

```bash
node probe-size.mjs 1536x1024 1024x1536   # ① 非方形尺寸收不收
node probe-edits.mjs                      # ② 输入图有没有去处（第一版：形态错）
node probe-edits2.mjs                     # ② 补 content-length 之后
node probe-edits-fidelity.mjs             # ③ 决定性一问：图真传过去了吗
node probe-outage.mjs                     # ④ 500 是偶发还是持续
# 真跑（要 4 分钟，5 次调用）
node packages/cli/dist/cli.mjs pack --recipe fixtures/recipes/shift-change-openai.json --out out
node packages/cli/dist/cli.mjs inspect out/shift-change-openai/pack/v1
node ../../experiments/real-generation/preview.mjs out/shift-change-openai/pack/v1
```

## 探明的事实（全部真跑过）

| 问题 | 答案 |
|---|---|
| 端点形状 | `POST {baseUrl}/images/generations`，Bearer，`{model,prompt,n,size}` → `data[0].b64_json` |
| 兜底 200 | **无** —— 乱写路径是 **520**，与真路由分得开（人类上次量到 524 是它家后端当时没起来） |
| `1024x1024` | ✅ 200 |
| `1536x1024` | ✅ 200，回显与实际都是 1536×1024 |
| `1024x1536` | ✅ 200，回显与实际都是 1024×1536 |
| `background:"transparent"` | ❌ **原样回显、不兑现** —— 返回 PNG 的 alpha 通道**全是不透明** |
| 背景 | ✅ 模型**认得提示词里的背景色要求**：让它用 `#ff00ff`，四角实测 `#fb03fc` / `#fc05fb` |
| 速度 | ⚠️ **28~48 秒**一张（Gemini 是 11~18 秒） |
| `/images/edits`（带输入图） | ✅ 200 —— **但必须自带 `content-length`**，见下 |
| 可用性 | ⚠️ **有整段故障**：2026-09-26 11:07 起两个端点都秒回 500（见下） |

## 抓到的三个「差点被骗过去」

**① `/images/edits` 的 400 是形态错，不是端点不存在。**
第一版手搓的 multipart 报 `invalid multipart form: incomplete multipart stream`。
读起来像「这个端点不支持」，实际是 Node 的 `https.request` 给了 Buffer 却没给
`content-length`，于是走 **chunked**，而中转的多部件解析器不吃 chunked。
补上 `content-length` 立刻 200。**按 400 收手就会得出「这条中转不收输入图」这个错误结论。**

**② 把图塞进 `generations` 的 body 会得到 200。**
未知字段被**静默忽略** —— 回一张和输入毫无关系的图。这是最坏的一种失败：
HTTP 200、有图、东西是错的。所以两条路由在客户端里是**分开**的
（有输入图 → `/images/edits` 多部件；没有 → `/images/generations` JSON），
不是「同一条路多塞一个字段」。

**③ `colorType 6` ≠ 有透明。**
单帧资源回来的 PNG 是 `colorType 6`（带 alpha 通道），但逐像素量下去
**0.0% 的像素是透明的** —— 那只是一个 RGBA 容器，通道全填 255。
所以「看 colorType 判断有没有透明底」是个会骗人的判据，**必须量 alpha 的分布**。

## 真跑的结果

```
清单 → 真包：4 个资源 · 3 张图集 · 18 个文件 · 5 次生图调用
manifest 过 schema ✅ · provenance.mode = mixed · coverage = {quantized: 4}
```

入口：`fixtures/recipes/shift-change-openai.json`（从 `shift-change-image-anim.json` 派生，
**去掉 `referenceImage` 与 `reference`**），出包：`out/shift-change-openai/pack/v1`。

⚠️ 那两处去掉是**当时**的必要：写客户端的那一刻还不知道 `/images/edits` 能用。
现在客户端已经会在带输入图时改走 edits，所以这两处**可以加回来** —— 但**先别**：
在保真度那一问被量出来之前加回去，等于把「模型真的看了母版」当成已证事实写进配方。
（那正是这个仓库被烧过三次的那类错误：指标全绿、东西是错的。）

**14 帧的玩家是同一个角色** —— 绿毛线帽、灰绿夹克、胸口那块发光 CRT 屏
在全部 14 帧里都在同一个位置，只有四肢在变。`composite-player-on-bg.png`
是把这 4 个待机/跑/跳帧贴到参考图派生出的背景上，用来判「是不是同一个世界」。

| 量 | 结果 |
|---|---|
| 帧包围盒一致性 | idle `29×43 30×43 31×43 32×46` · run `28×45…30×46`（跳跃帧本就该变形状） |
| 不透明率 | 38~58%，**没有一帧是空的** |
| 色板符合性 | **色板外色 0** |
| 色板覆盖 | **9/9 用上**，但分布很偏：`#3e3236` 48% + `#55685f` 31% = 79% |
| 两份最亮的色 | `#c3cdc9` **0.0%**、`#a9b7ac` 0.7% —— 角色整体被量化**压暗**了 |

（对照上一轮 `wan-player-1024.png` 的基线：最暗三色也占 49%。所以「暗」是这个世界的色板决定的，
不是这一次的异常；但**亮部没用上**是真的，角色因而比背景更沉。）

## 对管线的影响

- **背景好抠**：模型认提示词里的背景色（`#ff00ff`），配 `keyBackground` 容差 40 干净切分。
  也不需要 DashScope 那套「渐变洋红」的绕法。
- **慢一倍**：一个 3 动画的玩家资源 = 3 次调用 ≈ 2 分钟。整包 5 次调用 ≈ 3.5 分钟。
- **「透明底」三个上游都不兑现**（DashScope / Gemini / 这个），
  在这个项目里只有人工导入那条路能自己保证。
- **可靠性是新的硬约束**：见下面那条故障 —— 生图不可用 = 整包失败 = 退出码 3，这是 R10 修正时
  就明确接受的代价，这一轮给出了它的**真实发生率**。

## 可用性：这条中转会整段挂掉（2026-09-26 11:07 起，实测 ≥10 分钟）

包刚跑成（11:05）过了两分钟，**两个端点**就都开始回 500
`{"type":"error","error":{"type":"internal_error","message":"image generation service unavailable"}}`。
`probe-outage.mjs` 每 30 秒打一次，连打 20 次：

```
+1s   第 1 次  0.7s  ❌ 500     ...（中间 17 次同样）
+504s 第 17 次 1.5s  ❌ 500
+535s 第 18 次 1.5s  ❌ 抛了 TLS 连接被重置
+568s 第 19 次 3.0s  ❌ 500
+606s 第 20 次 7.7s  ❌ 抛了 TLS 连接被重置
```

**两条要分开看的事实：**

| | |
|---|---|
| 故障**持续 ≥10 分钟**（探针自己停了，不是恢复了） | 而且期间还夹着两次 TLS 重置 |
| 失败**秒回**：0.7~3.0 秒 | 正常出图是 28~48 秒 —— 这个对比让「是 500 而不是排队」一眼可辨 |

**对客户端的裁决：`openai` 这一支不做退避（`attempts ?? 3`，无 delay）。**
理由是量出来的，不是省事：**退避救不了这种故障** —— 3 次重试共约 5 秒，
而故障是 600 秒量级。给一个救不了任何东西、却让每次真失败都多等半分钟的机制，
就是在把「快而响」换成「慢而响」。生图不可用 = 整包失败 = 退出码 3，
这是 R10 修正时就写下的代价，**这一轮量出了它的真实发生率**。

## 未回答的

**`/images/edits` 到底有没有把图传过去？** 探针写了（`probe-edits-fidelity.mjs`：
同一条提示词分别走 edits 与 generations，量输出与输入图的平均色差），
但**三次尝试全部撞上后端故障**（两次 500、一次 TLS 重置，见下面那节），没跑成。
在跑出结果之前，
「母版 → 动画这条路在这个协议下成立」**仍然只是「端点收下了这个请求」，不是「模型真的看了那张图」**。
