# 02 · 潜伏者语义修复 —— 付费预算报告（待逐字点头）

> **本报告不授权任何调用。** 只有人在对话里逐字批准后，才用 `RUN_APPROVED=1` 启动
> `generate-patch.mjs`。当前**没有**发出任何生图 / 文本请求。

## 结论先说

- 13 帧里 **6 帧语义明确不符**（hang1/2/3 站立；lunge4 站立；retreat2/3 站立）。
- 建议只重生成这 **6 帧**；其余 7 帧 + 3 drawlist 用 `reuseFrom` 复用。
- 模型：**`gemini-2.5-flash-image` legacy `generateContent`（已知回 PNG）**；
  **不用** `game-maker.local.json` 当前的 `gemini-3.1-flash-lite-image`（Interactions 只回 JPEG，
  而代码明确拒绝非 PNG —— 见下「配置风险」）。
- 预算：**6 张成功图 ≈ $0.20–0.23**；每帧最多 2 次尝试 ⇒ **≤12 发 HTTP**（票面 ≤13）。
  文本调用 **0**。墙钟上限 15 分钟。
- 若首帧 `lunge1` 也要重画（见下），则 7 帧 ≈ $0.23–0.27、≤14 发 —— 需要单独说。

## 逐帧判定（证据：`evidence/lurker-13-montage.png` 与三张分动作图）

| 帧 | 现状 | 判定 | 动作 |
| --- | --- | --- | --- |
| `hang1` | 直立侧站 | ❌ hang 要倒挂、头朝下 | **重生成** |
| `hang2` | 直立侧站 | ❌ 同上 | **重生成** |
| `hang3` | 直立侧站 | ❌ 同上 | **重生成** |
| `hang4` | 倒挂、头朝下 | ✅ | 复用 |
| `lunge1` | 落地/前倾预备，脚着地 | ⚠️ 可读作「落下后的预备」 | 默认**保留**；要首帧腾空则 +1 发 |
| `lunge2` | 前扑、四肢伸展 | ✅ | 复用 |
| `lunge3` | 前扑、腾空 | ✅ | 复用 |
| `lunge4` | 直立站姿 | ❌ 打断扑击序列 | **重生成** |
| `lunge5` | 前扑 | ✅ | 复用 |
| `retreat1` | 倒挂 | ✅ | 复用 |
| `retreat2` | 直立侧站 | ❌ retreat 要回到倒挂位 | **重生成** |
| `retreat3` | 直立、垂着线缆 | ❌ 同上 | **重生成** |
| `retreat4` | 倒挂 | ✅ | 复用 |

**重生成清单（6 帧）**：`ceiling-lurker.hang1` · `hang2` · `hang3` · `lunge4` · `retreat2` · `retreat3`。

## 配置风险（为什么不用文件里的模型）

`resolveImageTransport`（免费）读到的当前配置：

- model = **`gemini-3.1-flash-lite-image`**
- proxy = **`http://127.0.0.1:9098`** —— **本机 9098 当前没有监听**；`7890` 在监听（此前真跑用的就是它）
- 代码 `image-gen.ts`：3.x 走 Interactions；实测它**只回 JPEG**，而 `imageFromInteraction`
  对 `mime !== image/png` **明确抛错** ⇒ 按当前配置发，第一发就会拿到 JPEG 后失败（且可能已扣费）。
- ⇒ 本次脚本**显式覆盖**为 `model=gemini-2.5-flash-image`、`api=generateContent`、`proxy=127.0.0.1:7890`；
  **不修改 `game-maker.local.json`**。2.5 的停服风险仍在（票 05 未收口），但本次只有 6 帧，
  且票 05 记录它「今天仍可用」。

**这一点需要你在点头时一并确认**：是否同意本次用 2.5 legacy + 7890，而不是等 05 的模型路线。

## 调用与花费

- 成功图：6 张 × Google list price（2026-10-19）$0.0336/张（1K） ≈ **$0.20**；
  按此前真跑实测的 $0.039/张上限 ≈ **$0.23**。
- 每帧 `attempts=2`（NO_IMAGE / 5xx 才重试；不静默多试）。最坏 12 发 HTTP；
  NO_IMAGE 通常不计费，**计费上界仍按 6 张算**。
- 文本：**0**（不调母版 / 不调 drawlist）。
- 时间：单张实测 15–26s；串行 6 帧约 2–3 分钟（上限 15 分钟）。
- 账：脚本逐发写 `http-calls.log`；结果写 `generate-result.json`（每帧 ms / attempts / model）；
  之后重建零上游，包内 ledger 0 调用。

## 提示词处理（语义修复的关键）

基础提示词仍用 `animationFramePrompt()`（母版 / 风格 / 尺寸 / 色板判据不变），
**只在 6 个新帧后面追加一段逐帧语义**：

- `hang1–3`：`头朝下倒挂：四肢的爪勾住天花板的管道，身体垂直向下、头部在下；不要站立，脚不要着地。`
- `lunge4`：`扑击中的腾空帧：身体前倾、四肢朝前伸展，离开地面；不要直立，不要双脚平踩地面。`
- `retreat2–3`：`正在回到悬挂位：头朝下、身体向上收，爪勾住天花板；不要站立，脚不要着地。`

⚠️ 这是**本次 6 帧的附加句**，不改共享 `animationFramePrompt`，也不改母版 / 网格判据。
每帧的完整提示词会写进 patch 目录的 `*.prompt.txt`，可逐字复核。

## 施工流程（批准后）

1. `RUN_APPROVED=1 node generate-patch.mjs`：复制 `2026-10-19k-patch` 到本 run 的 `patch/`，
   只覆盖上述 6 张 raw，其余 66 张原样；逐发记账。
2. 人眼检查 6 张新 raw（本报告的证据图旁边出新图）。
3. 零上游重建：用 **v4 的 34 色 `stylespec.json`** + `reuseFrom: patch/`，出 `pack/v7`
   （新 run 目录，不覆盖 v6）；`verifyPack` 必须 ok，帧数 4/5/4 不变，0 母版调用。
4. 联系表逐帧复核；若仍有语义不符，**停下来报告**，不静默再发。

## 零付费备选（不推荐，但可行）

- 用现有正确的倒挂帧 `hang4 / retreat1 / retreat4` 互相复制，把 hang / retreat 的 8 帧全部填成倒挂；
  lunge4 复制 `lunge3` 或 `lunge5`。用 `reuseFrom` 的 patch 目录零上游重建。
- 代价：**有重复帧**，三段动画的读感变差；但语义（不站立）能过联系表检查。
- 若你不想在模型路线未定时花钱，这是本票唯一零成本收敛路径。

## 待你点头的原话

> **批准 02：重生成 6 帧（hang1/2/3、lunge4、retreat2/3），模型 gemini-2.5-flash-image legacy PNG，
> 代理 7890，每帧最多 2 次尝试，预算 ≤ $0.23；不重生成 lunge1。**

（若要含 `lunge1`，把「6 帧」改成「7 帧」、预算改成 ≤ $0.27。）
