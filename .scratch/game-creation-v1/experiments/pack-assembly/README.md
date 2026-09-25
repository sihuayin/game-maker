# pack-assembly —— 票 38 的实物：产物 A 端到端

```bash
pnpm build && node build-pack.mjs    # 清单 + StyleSpec → out/shift-change-assets/pack/v1/
node verify.mjs                      # 确定性 + 可消费性
```

输入是**真实推导出来的**清单 [`fixtures/recipes/shift-change.json`](../../../fixtures/recipes/shift-change.json)
（见 [`../recipe-derivation/`](../recipe-derivation/)），风格是**真实产出**的 StyleSpec。

## ⚠️ 桩生成器

`source.kind === "generate"` 的资源需要一个 drawlist 生成器，而那是
[票 22](../../issues/22-asset-generator.md) 的事（还没做）。这里用一个**确定性的占位实现**，
只为把组装链路跑通。**这不是生成器** —— 它画的是色块，不是资源。

组装之所以能用桩测，是因为生成器是**注入的端口**：把网络调用埋在组装里，
「包为什么长这样」就无法被测试。

## 实测结果

```
清单 ✅ · manifest 过 schema ✅ · 对账（spec ↔ 产物）0 问题
215 ms · 28 个文件 · 1106 KiB
out/shift-change-assets/pack/v1/

交付态  delivery/atlas.{animations,backgrounds,sprites}.{json,png}
创作态  authoring/drawlist/*.json（20 份）· authoring/imported/*.png · authoring/stylespec.json
入口    manifest.json
```

两条路都跑到了：7 个资源走生成（`exact`）、1 个背景走人工导入（`quantized`）。

## 验过的

| | |
|---|---|
| **确定性** | 同一 epoch 两次构建，manifest 与包内 **28 个文件（含 PNG）逐字节相同** |
| **可消费性** | 图集是 TexturePacker JSON Hash（`frames` 是**对象**），帧字段恰好是 Phaser 真读的那 6 个：`anchor, frame, rotated, sourceSize, spriteSourceSize, trimmed` |
| **可搬走** | 包内路径全是相对 POSIX |
| **绝不覆盖** | 同一个 outDir 再跑落在 `v2`，`v1` 还在 |
| **对账** | spec 说的尺寸/动画名/帧数 vs 包里实际的，0 问题 |
