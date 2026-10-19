# 票 10 smoke M1：`gemini-nano-banana-2.1` 也只支持 JPEG（失败报告）

- **状态**：**失败即停**。没有生成图；没有包。
- **授权（人裁逐字）**：
  > **换 gemini-nano-banana-2.1，先按 smoke 预算 1 张 / ≤4 发 / 15 分钟确认 PNG**
- **实际**：**1 发 HTTP**，`400 invalid_request`，约 1 秒；没有图。
- **预计花费**：**$0**（生成前拒绝；以账单为准）。
- **现场**：`.scratch/style-migration-v1/runs/2026-10-19d-smoke-m1/http-calls.log`

## 0 · 一句话

`gemini-nano-banana-2.1` 与 `gemini-3.1-flash-lite-image` **一样**：
Interactions 的 `response_format.mime_type` **只接受 `image/jpeg`**，拒绝 `image/png`。

```json
{"error":{"message":"The value 'image/png' is not supported for 'response_format.mime_type'. Supported values: 'image/jpeg'.","code":"invalid_request"}}
```

⇒ **在 Interactions API 上，我们试过的两台新模型都拿不到 PNG。**
文档里那些 `mime_type: "image/png"` 的示例与实际 API 行为不一致（至少对这两台模型）。

## 1 · 证据

```
START smoke model=gemini-nano-banana-2.1 proxy=http://127.0.0.1:7890 maxImageReq=4 maxTextReq=0
IMG-REQ #1 https://generativelanguage.googleapis.com/v1beta/interactions
IMG-RES #1 400
IMG-MIME #1 none b64len=0 stepTypes=
FAIL ... 400 ... Supported values: 'image/jpeg'.
```

- 4xx 不重试 ⇒ 只发 1 发。
- 生成前拒绝 ⇒ 预计 $0。
- 没有 `pack/v1`。

## 2 · 现在的死路与活路

| 路线 | 能否拿 PNG | 备注 |
| --- | --- | --- |
| 3.1 Lite / nano-banana-2.1 + Interactions PNG | ❌ **实测拒绝** | 这两台只支持 JPEG |
| 3.1 Lite / nano-banana-2.1 + Interactions JPEG | ✅（JPEG） | 需要 **JPEG 解码**；伪影风险 |
| 3.1-flash-image + Interactions PNG | ❓ 未试 | 很可能同样只支持 JPEG；要 1 发 smoke |
| 3-pro-image + Interactions PNG | ❓ 未试 | 更贵；要 1 发 smoke |
| 2.5 + legacy `generateContent` | ✅ **PNG（C/C2 已验证）** | 2.5 已标注停服；需恢复 legacy 分支 |

## 3 · 可选路线

### J2（推荐，若继续用新模型）· nano-banana-2.1 + JPEG 解码

- 请求改 `image/jpeg`；加纯 JS 解码器（`jpeg-js` 0.4.4 · BSD-3 · 约 76 KB；`@types/jpeg-js` 0.3.7）。
- 费用：$0.0336 / 1K（与 Lite 相同）；输入 $1.50 / 1M。
- 施工**零付费**：加依赖 + 解码分支 + 离线 JPEG fixture + 全量测试。
- 风险：JPEG 伪影可能伤 1px 描边；修好后先发 1 发 smoke 看质量，再决定是否发满 21 张。

### J1 · 3.1 Lite + JPEG 解码

- 同上，但模型保持 Lite：输入更便宜（$0.25 / 1M），图像单价相同。
- 质量定位低于 nano-banana-2.1；若只在意成本可选。

### B（推荐，若 PNG 保真优先）· 回退 2.5 legacy PNG

- 恢复 legacy `generateContent` 分支（旧代码在 git 历史里），模型 `gemini-2.5-flash-image`。
- 费用：$0.039 / 张（21 张 ≈ $0.819）。
- 优点：**PNG 无伪影**，C/C2 已验证。
- 风险：2.5 官方标注 2026-10-02 停服（今天仍可用，但随时可能不可用）。

### P · 试 `gemini-3-pro-image` 要 PNG

- 1 发 smoke；更贵。很可能同样只支持 JPEG；不作首选。

### D · runner 里 `sips` 转码

- 只可能是探针；与 Destination 的「生产链不依赖人工抢救」冲突。不推荐。

## 4 · 建议

1. **若这次交付优先 PNG 保真**：选 **B**，恢复 2.5 legacy，直接回到 21 张预算（$0.819）。
2. **若要继续用新模型**：选 **J2**，零付费加 JPEG 解码 + 离线测试，然后 1 发 smoke 评估伪影。

两条都需要你裁；未收到前不发上游、不改源码。

## 5 · 需要你给的授权

逐字一句即可：

> **裁 B：恢复 2.5 legacy PNG 真跑，按 21 张预算另出报告**

或

> **裁 J2：nano-banana-2.1 + JPEG 解码，先零付费施工 + 测试**
