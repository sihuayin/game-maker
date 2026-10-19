# 票 10：混合迁移包第一次真跑 —— 失败报告（2026-10-19）

- **状态**：**失败即停**。没有产出包；没有自动重跑 / 自动回退 / 自动修复。
- **授权**：人裁「授权执行」，变体 **B**（加 `sheet`）。
- **模型**：`gemini-3.1-flash-lite-image`（runner 显式覆盖；`game-maker.local.json` 未改）
- **现场**：`.scratch/style-migration-v1/runs/2026-10-19b-real/`
- **不覆盖**：包目录从未生成（只有失败现场 `failed-2026-10-19T05-20-52-155Z/`）。

## 0 · 一句话

跑了 **6 次生图 + 3 次文本**，全部 HTTP 200；但模型回来的图**不是 PNG**，
管线的 `decodePNG` 当场拒绝，母版造不出来 ⇒ 包失败、停止。
**花费约 $0.21**（6 张 × $0.0336）+ 文本 usage。问题在**生图回应格式适配**，不在配方 / 网格 / 风格。

## 1 · 时间线

| 时间（UTC） | 事件 |
| --- | --- |
| 05:17:47 | runner 启动；3 个母版并发发出（IMG #1–#3） |
| 05:18:59–05:19:10 | 3 个母版都回 **200**；解码阶段失败（非 PNG） |
| 05:19:11 | 3 个单帧 sprite（scrap / water / hazard）与 3 个 drawlist 同时发出 |
| 05:19:14–05:19:16 | 3 个 drawlist 全部 200（deepseek，成功落盘） |
| 05:20:06–05:20:52 | 3 个 sprite 回来；同样非 PNG |
| 05:20:52 | 母版失败被汇总抛出：`资产 "scavenger-actor" 的母版 "master-scavenger-actor" 没造出来（Gemini 生图失败（4 次内）：不是 PNG（签名不匹配））` |
| 05:20:52 | runner 停止；失败现场保留 |

## 2 · 实际花费

| 项 | 数量 | 估计 |
| --- | --- | --- |
| 生图（3 母版 + 3 sprite） | **6 次调用 / 6 发 HTTP** | 6 × $0.0336 ≈ **$0.2016** |
| 文本 drawlist | **3 次调用 / 3 发 HTTP** | usage：输入 4,369 · 输出 2,939 tokens；按中转价未计价，量级 **< $0.01** |
| 合计 | | **≈ $0.21** |

⚠️ 6 次生图都返回 200，所以都按已生成计费；其中 3 个 sprite 的图也没有落盘（同样解码失败）。
⚠️ 这 6 次都是 `attempts = 1`：签名错误不在重试判据里（`HTTP 5xx / 429 / network / NO_IMAGE`），
所以**没有隐藏重试**，也没有重复烧钱。

## 3 · 现场与可回收产物

失败现场：
`runs/2026-10-19b-real/ruin-scavenger-extraction-assets/failed-2026-10-19T05-20-52-155Z/`

| 产物 | 状态 |
| --- | --- |
| `ledger.json` | ✅ 完整：6 生图 + 3 文本，逐条 attempts / ms / usage |
| `authoring/drawlist/{hud-panel,scrap-icon,health-icon}.json` | ✅ **3 个真实文本输出已落盘**（单帧 drawlist） |
| `authoring/imported/*.png` | ✅ 7 张迁移 PNG 已拷入 |
| `authoring/visual-world.json` | ✅ |
| `authoring/masters/` · `authoring/generated/` | ❌ 空（解码在写盘之前失败） |
| `manifest.json` / `delivery/` | ❌ 没有包 |

## 4 · 诊断

### 4.1 直接原因

`packages/assets/src/image-gen.ts` 的 `imageFromGemini()` 只做一件事：

```ts
return decodePNG(Buffer.from(p.inlineData.data, "base64"));
```

它**没有看 `p.inlineData.mimeType`**。`decodePNG` 的第一行是 PNG 签名检查（`png.ts:45`），
签名不匹配就抛「不是 PNG（签名不匹配）」。这次 3.1 lite 回来的 inline data 不是 PNG。

### 4.2 为什么 3.1 会变

- 本仓用的是 **legacy `generateContent`** 形状：
  `generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } }`。
- 免费查的 API discovery（v1beta）里，`ImageConfig` **只有 `aspectRatio` 与 `imageSize`**，
  **没有输出 MIME 选项** ⇒ 无法在 legacy 路径上要求 PNG。
- 新模型族的 **Interactions API** 有 `response_format: { type: "image", mime_type: "image/jpeg" | "image/png", ... }`；
  官方文档示例里 `image/jpeg` 是正常选项。⇒ 3.1 lite 很可能默认回 **JPEG**（也可能 WebP / 带前缀的 base64，
  没有原始字节无法百分百确认；但「不是 PNG」这一点是确定的）。

### 4.3 这不是配方 / 网格 / 风格失败

- 3 个 drawlist 都 200 并落盘；7 张 import 正常。
- 没有一张图进入「动画 / 网格 / 帧数」校验 —— 失败发生在**解码**，在风格与网格判断之前。
- 固定网格 B 变体**没有被验证**，也没有被否定。

## 5 · 已验证 / 未验证

| 项 | 结果 |
| --- | --- |
| 3.1 lite 可调用、key / proxy 可用 | ✅ |
| 3.1 lite 接受参考图（countTokens） | ✅（免费预检） |
| 3.1 lite 的 `generateContent` 返回 200 | ✅ 6 发 |
| 3.1 lite 输出 PNG | ❌ **不是 PNG** |
| 母版 / 动画 / 背景 / 道具的生图与风格 | ❌ 未进入（解码前失败） |
| `verifyPack` | ❌ 没有包可验 |

## 6 · 可选的下一步（需要你裁）

### A（推荐）· 修适配层：按 `mimeType` 解码

- 让 `imageFromGemini` 读 `inlineData.mimeType`，PNG 走现有解码；JPEG / 其它格式给明确错误或解码。
- 两条实现路线：
  - **A1 · 加一个纯 JS JPEG 解码器**（如 `jpeg-js`）：改动小、可用 fixture 离线测；
    需要动依赖 allowlist（v2 票 07 的边界）。JPEG 压缩伪影可能影响 1px 描边。
  - **A2 · 生图适配器改用 Interactions API，显式 `mime_type: "image/png"`**：
    从源头拿 PNG，无 JPEG 伪影；但请求 / 回应形状都要改，改动更大。
- 两者都可以**零付费**实现 + 离线 fixture 测试；完成后再另出真跑报告 + 逐字点头。

### B · 回退 `gemini-2.5-flash-image` 真跑

- 现有代码在 2.5 上已验证会回 PNG（C / C2 六张）；零源码改动。
- 代价：2.5 官方标注 2026-10-02 停服（今天仍列出、key 可用，但随时可能不可用）；
  且这是**回退**，不是把 3.1 修通。

### C · 先做一发诊断（≈ $0.034）

- 用已经加好的 MIME 观察（runner 的 `IMG-MIME` 日志）发 **1 张**，确认到底是 JPEG / WebP / 其它。
- 便宜、确定；但它不产出包，也不修管线。若你选 A，A1/A2 的选择会因此更硬。

### D · runner 里用 `sips` 把 JPEG 转 PNG（不推荐）

- 能当**探针**跑通余下 21 张，但这是「人工抢救」进生产链，和本图 Destination
  （生产链不依赖人工抢救）冲突。除非你明确只想要一次探针，否则不立。

## 7 · 需要你给的授权

下一步至少要在 **A1 / A2 / B / C** 里选一个。逐字一句即可，例如：

> **选 A2：改 Interactions API 要 PNG，先零付费施工 + 测试**

或

> **选 C：先发 1 张诊断，≈$0.034**

或

> **选 B：回退 2.5 真跑，按原 21 张预算另出报告**

在收到这句之前：不发任何上游请求、不改源码、不重跑。
