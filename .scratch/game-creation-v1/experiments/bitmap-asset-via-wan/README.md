# 位图资源生成已解锁：Qwen wan2.7-image-pro + 参考图风格条件

2026-09-23 验证。**这张 `player_with_reference.png` 就是证据**：
喂 `demo/test.png` 作风格参考，7.8 秒出一张 1024×1024 像素风角色 sprite。

## 可用配方（凭据在 CC Switch「千问AI平台 Token Plan」行，不入库）

```
POST https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
Authorization: Bearer <千问 OPENAI_API_KEY>
{
  "model": "wan2.7-image-pro",            # 或 wan2.7-image
  "input": {"messages": [{"role": "user", "content": [
      {"image": "data:image/png;base64,<参考图>"},   # 风格条件，实测接受 data URI
      {"text": "<风格约束 + 角色描述>"}
  ]}]},
  "parameters": {"size": "1024*1024", "n": 1}
}
→ output.choices[0].message.content[0].image = <临时 URL>，需下载
```

## 踩过的坑（复跑必读）

- ❌ `/compatible-mode/v1/images/generations` → `InvalidParameter: url error`
  （wan 系列在 token-plan 上**不走** OpenAI 兼容生图路径）
- ❌ `/api/v1/services/aigc/text2image/image-synthesis` → `Model not exist`
- ✅ **只有 `/api/v1/services/aigc/multimodal-generation/generation` 可用**
- 参考图用 base64 data URI 直接内联可行（1.4MB 图 → 1.4MB 请求体，http 200）
- 返回的是**临时 URL**，必须立即下载
- `/v1/models` 列出的 15 个模型里生图的只有 `wan2.7-image` / `wan2.7-image-pro`

## 已验证 vs 未验证

| | |
|---|---|
| ✅ 参考图风格条件 | 色板、磨损质感、CRT 屏、1px 描边都对上了 test.png |
| ✅ 派生色调 | 夹克上有明暗阶与锈迹抖动 —— drawlist 做不到的东西 |
| ✅ 速度 | 7.8s / 张 |
| ❓ 多帧 sheet | GPT 那张参考图的 trick 是「一张图含全部帧再按网格切」。**未测** wan 能否产出对齐的网格 sheet —— 这是位图路线帧一致性的关键，归票 23 |
| ❓ 位图的可校验性 | 色板/包围盒不再静态可知，需像素直方图分析 —— 票 12 被降级的那条检查要复活 |

## 凭据探测记录（全部实测）

| 供应商 | 结果 |
|---|---|
| MiniMax image-01 | key 有效但 **余额为零**（status 1008） |
| Google Official / OpenAI Official | CC Switch 里**空配置，无 key** |
| 千问 Token Plan | **✅ 可用**（本文件） |
| dragoncode.codes 中转 | 未测（千问已通，未消耗该授权） |
