# 08. JPEG 解码 + Interactions 请求改 JPEG（零付费）

Type: task
Status: resolved
Owner: claude (2026-10-21 认领 · task · 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自 [07](07-model-route-ratification.md) 的 Q4 裁定（2026-10-20）。
> ✅ **开工授权已由 07 写明**，范围仅限本票列出的内容；超出部分不授权。

## Question

在 `packages/assets` 增加 JPEG 输入路径，并把 Interactions 请求的输出格式改为 JPEG。

- 依赖：`jpeg-js@0.4.4`（运行时）、`@types/jpeg-js@0.3.7`（dev）。
- 新增 JPEG 解码：`jpeg.decode` → RGBA `RasterImage`；校验宽高；JPEG 无 alpha，alpha 恒 255。
- `image-gen.ts` 的 Interactions 请求：`response_format.mime_type` 从 `image/png` 改为 `image/jpeg`。
- 响应按 `mime_type` 分派：JPEG / PNG 兼容，其它明确失败；无 mime 时按文件签名嗅探。
- legacy `generateContent` 路径**继续只认 PNG**。
- 格式错误**不重试**（重试只会继续计费）。
- 顺序：**先解码器、后改请求**；不得出现「请求已改、解码器未就绪」的中间态。

## 验收

- `jpeg-js` 能解出 RGBA；宽度/高度校验有测试。
- Interactions 请求体断言为 `image/jpeg`。
- 离线 JPEG fixture 能走完整导入；WebP / 未知格式明确失败；无 mime 时能嗅探；格式错不重试。
- 全量测试全绿。
- 0 次生图 / 0 次文本上游；未改 `game-maker.local.json`；未替换 fixtures；未加共享裁框。

## 边界

- **不含**：改配置默认模型、付费调用、替换 model-paint fixtures、动画级共享裁框。
- 任何超出上述范围的改动，停在本票边界，另立票。

## Comments

### 2026-10-20 · 授权（逐字）

> Q4 JPEG 零付费施工：批准立票并授权限定范围内开工。仅限解码、MIME 分派、Interactions 请求格式及指定测试；不含付费调用和默认模型切换。

## Answer（2026-10-21 · 施工完成）

**验收达成**：JPEG 解码 + Interactions 请求改 JPEG + MIME 分派 + 测试；0 次上游调用；
未改 `game-maker.local.json`；未替换 fixtures；未加共享裁框。

### 施工

- 新增 `packages/assets/src/jpeg.ts`：`decodeJPEG()`（`jpeg-js@0.4.4` → RGBA；宽高与字节数校验；
  alpha 恒 255）；`isJPEG()` 签名判定。
- `packages/assets/src/image-gen.ts`：
  - Interactions 请求 `response_format.mime_type` → `image/jpeg`；
  - `decodeUpstreamImage()` 统一分派：**声明了 mime 就以声明为准**，没声明才按签名嗅探；
    Interactions 白名单 = `image/jpeg` / `image/png`（PNG 仅兼容旧桩 / 旧上游）；
    legacy 白名单 = 仅 `image/png`；
  - 未知 / 冲突格式明确失败；错误消息不匹配重试正则 ⇒ **格式错误不重试**。
- `packages/assets/src/index.ts` 导出 `jpeg.js`。
- **依赖修正**：`@types/jpeg-js@0.3.7` 是 deprecated stub（`jpeg-js` 自带 `index.d.ts`），
  安装时 pnpm 明确警告；已移除，只保留 `jpeg-js@0.4.4`。这不改变 Q4 的授权范围。
- 顺序：解码器先落地，随后才改请求格式；工作树里没有「请求已改、解码器未就绪」的中间态。

### 证据

- `pnpm exec vitest run packages/assets/tests/image-gen.test.ts`：**39 / 39 通过**。
  - 新增：JPEG 解码（RGBA / alpha 255）、JPEG 签名嗅探、JPEG 主路径、PNG 兼容、
    WebP 明确失败且不重试、声明 PNG 却给 JPEG 字节 → 按声明失败。
  - 改写：Interactions 请求体断言 `image/jpeg`；旧「非 PNG 即失败」改为「非 JPEG/PNG 即失败」。
- `pnpm test`：**105 文件 / 1647 条全绿**（2026-10-21）。
- `pnpm build`：`tsc -b` + 全部 bundle 成功；CLI / MCP 的 esbuild 产物里能读到 `jpeg-js@0.4.4`。
- `pnpm --filter @game-maker/assets typecheck` 仍有 **2 条与本票无关的既有错误**
  （`pack-sheet-grid.test.ts` 缺 `requestedSize`、`prompt.test.ts` 缺 `CharacterDNA`）；
  本票未触碰这两个文件，也未扩大范围去修。

### 边界

- 0 次生图 / 0 次文本上游；未改默认模型 / 配置；未替换 fixtures；未加共享裁框。
- [09. 同动画 2 帧 smoke](09-two-frame-smoke.md) 现在解除阻塞；执行前仍须书面预算报告 + 逐字点头。
