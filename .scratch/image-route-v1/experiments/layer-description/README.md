# 实验：给每一层**自己的**描述，模型会不会就只画它自己那一层

[票 02](../../issues/02-layer-has-no-description.md) 的实测现场。四张图**不是**拿来用的素材，
是**证据** —— 缩到 480×270（背景的目标尺寸），看的是「这一层画了什么」。

## 跑什么

```sh
node .scratch/image-route-v1/experiments/layer-description/run.mjs            # 逐层描述
node .scratch/image-route-v1/experiments/layer-description/run.mjs 只画自己   # 再补一句
```

⚠️ **它要花钱**（一轮 3 笔 Gemini 调用）⇒ **不进 CI**，与 `probe/*.mjs` 同一条规矩。
⚠️ 原图（1344×768）落在 `out/__layer-exp/`，那份不入库。

## 四张图各自是什么

| 文件 | 哪一层 | 描述 | 看到了什么 |
|---|---|---|---|
| `sky.png` | 最远 | 逐层 | 天空+远山 **+ 更近的每一层**（车站、站台、铁轨全画了） |
| `wall.png` | 中景 | 逐层 | 墙带 ✓ **+ 地面那一条** |
| `ground.png` | 最近 | 逐层 | **只有站台+铁轨 ✓ 完全正确** |
| `sky-explicit.png` | 最远 | 逐层 + 「只画自己」 | 内容对了 ✓ **但天空缩成中间一条带** ⇒ 撞上票 50 |

⚠️ **四张里没有一张的底色是提示词要的那个纯色** —— 这正是[票 03](../../issues/03-key-color-drift.md)。
每张旁边那份 `.prompt.txt` 是那一刻**逐字**发出去的提示词。
