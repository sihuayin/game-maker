# 09 · 同动画 2 帧 smoke —— 付费预算报告（待逐字点头）

> **本报告不授权任何调用。** 只有人在对话里逐字批准后，才用 `RUN_APPROVED=1` 启动
> `smoke.mjs`。当前**没有**发出任何生图 / 文本请求；零付费自检只用本地合成 JPEG 验证了请求体，
> 产物在 `evidence/dry/`，不会冒充上游产物。

## 结论先说

- 目标：验证 **2.1 · Interactions · JPEG** 的真实编码与**逐帧裁框抖动**。
- 帧：`scavenger-actor.idle1` / `idle2`（48×64，玩家旗舰资产；与最终包 v7 同一提示词）。
- 预算：2 张成功图 ≈ **$0.067**；全局 ≤4 发 HTTP（每帧 `attempts=2`）≈ 上界 **$0.134**；
  加输入 token ≈ $0.003–0.009 ⇒ **≤ $0.16**。文本调用 **0**。墙钟上限 15 分钟。
- 模型 / 接口：**`gemini-nano-banana-2.1` · Interactions · `image/jpeg`**，1K，3:4。
- 配置：**不改 `game-maker.local.json`**；脚本显式覆盖 model / api / proxy。

## 当前配置与覆盖

`resolveImageTransport`（免费）读到：

- protocol = **gemini**
- model = `gemini-3.1-flash-lite-image`
- baseUrl = `https://generativelanguage.googleapis.com/v1beta`
- proxy = `http://127.0.0.1:9098` —— **本机 9098 没有监听**
- apiKey：存在（不打印）
- 7890：**在监听**（本次显式使用）

本次脚本显式覆盖：

- model → `gemini-nano-banana-2.1`
- api → `interactions`
- proxy → `http://127.0.0.1:7890`

不修改配置文件；不换 provider；不调用文本上游。

## 将发出的请求（零付费 dry-run 已核对）

`DRY_RUN=1 node smoke.mjs` 用本地合成 JPEG 跑通了生成器 + 解码 + 导入管线，**0 次 HTTP**。
请求摘要（不含参考图 base64）在 `evidence/requests/*.dry.json`；摘要：

- URL：`https://generativelanguage.googleapis.com/v1beta/interactions`
- model：`gemini-nano-banana-2.1`
- response_format：`{ type: "image", mime_type: "image/jpeg", aspect_ratio: "3:4", image_size: "1K" }`
- input：1 段 text（1720 字符）+ 2 张内联 PNG 参考图（风格图 + 母版）
- 两帧各一发；**不会**发母版 / 文本 / drawlist 调用。

提示词逐字取自 v7 的 `scavenger-actor.idle1.prompt.txt` / `idle2.prompt.txt`，
与 2.5 基线同源；参考图是 `reference.png` + `reuse/master-scavenger-actor.png`。

## 成本

| 项 | 计算 | 金额 |
| --- | --- | --- |
| 2 张成功图 | 2 × $0.0336（2.1 · 1K） | ≈ $0.067 |
| 最坏 4 发 | 4 × $0.0336 | ≈ $0.134 |
| 输入 token | 提示词 + 2 参考图，1K–3K tokens/张 | ≈ $0.003–0.009 |
| **上界** | | **≤ $0.16** |

- 每帧 `attempts=2`；只在 NO_IMAGE / 5xx 重试，每次重试都落账。
- 全局 4 发硬上限：超过即 `exit 124`，不再发。
- 墙钟 15 分钟硬上限。
- 若第一发 400 / 格式错 / 解码错：记录并停止，不靠重试掩盖。
- 已在 08 里确认：Interactions 请求体是 `image/jpeg`，解码器先于请求落地；
  真回 JPEG 时会走 `decodeJPEG`，不会出现「200 计费后在本地丢图」。

## 记录与验收

批准后脚本会落盘：

- `evidence/raw/*.jpg`：上游真实 JPEG 字节；
- `evidence/*.decoded.png`：解码后的 RGBA；
- `evidence/*.imported.png`：按 v7 同款管线（34 色、48×64、众数色抠底、`dropSpecks`、`dropBottomLines`）导入的帧；
- `evidence/requests/*.json`：每发请求体（不含 key）；
- `http-calls.log`：每发 URL / 状态 / MIME / 字节数；
- `result.json`：每帧 ms / attempts / 尺寸 / bbox / 导入读数；
- `evidence/contact-imported.png`：2.5 vs 2.1 的 48×64 导入帧并排（8× 放大）；
- `evidence/contact-raw.png`：2.5 vs 2.1 原图并排（等高缩略）。

**判定标准（人眼）**：

- 2.1 帧的轮廓 / 描边 / 配色是否可接受；
- idle1 → idle2 的轮廓是否出现肉眼不可接受的「呼吸」/ 位移漂移；
- 与 2.5 基线对比：基线本身也有 bbox 漂移（idle1 `{744×1143 @ 0,0}` vs idle2 `{738×1139 @ 6,5}`，
  dx=6 / dy=5 / dw=−6 / dh=−4），所以**不是要求零漂移**，而是看 2.1 是否明显更差。
- 结论三选一：`接受 JPEG` / `触发共享裁框票` / `拒绝`。

## 待你点头的原话

> **批准 09：用 gemini-nano-banana-2.1 · Interactions · JPEG 跑 scavenger-actor idle1/idle2 两帧，
> 代理 7890，每帧最多 2 次尝试，全局 ≤4 发，预算 ≤ $0.16，墙钟 ≤15 分钟；不改配置文件。**

批准后执行：

```bash
RUN_APPROVED=1 node .scratch/asset-integration-v1/runs/2026-10-21a-smoke/smoke.mjs
```
