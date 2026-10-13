# 票 46 探针：生产端能不能产出一份**过不了自己契约**的包？

**问题的来历**：票 44 的 Q2 把「制造端自校验」整块划出去另开票，并在票面**诚实交代**：
「空色板是它**确证的一条**进路，它**没有全量证否其他进路** —— 也就是说『还有没有**别的写法**能让
`buildAssetPack` 产出一份过不了自己契约的包』，**今天没有人量过**。」

**本探针就是去量那句话。** 免费（`generate` / `generateImage` 都是注入的端口，全程喂桩，不碰网络）。

## 怎么跑

`probe.test.ts.txt` 摘掉 `.txt` 放进 `packages/assets/tests/`，然后：

```bash
cd packages/assets && npx vitest run tests/__t46-probe.test.ts
```

原始输出在 [`raw/probe-run.txt`](raw/probe-run.txt)。

## 量到了什么

### ✅ 探针 A：**有一条真路** —— 分层背景里两层**同名**

把 `fixtures/recipes/shift-change.json` 里那个 `background` 资源改成两层、**两层都叫 `far`**：

| 问 | 答 |
|---|---|
| `parseRecipe`（配方闸） | **PASSES —— 放行** |
| `readStyle`（票 44 新加的入口闸） | 管的是**色板**，不看层名 ⇒ 也放行 |
| `buildAssetPack` 产出的 manifest 过 `parseAssetPack` 吗 | **REJECTED** —— `assets[0].frames: 帧名重复："store-interior-bg.far"` / `assets[0].layers: 层名重复："far"` |
| 那份包被**提交**到 `pack/v<N>/` 了吗 | **是** —— `<out>/shift-change-assets/pack/v1`，`manifest.json` 就在里面 |
| 旁边有失败现场吗 | **没有** —— `<out>/<gameId>/` 下只有 `pack` |

**⇒ 「一份违反自己契约的包落在磁盘上、并且被当作成功产物交付」今天是可以复现的。**

⚠️ **这条路没有任何缝**：注入桩生成器就够，走的就是生产函数 `buildAssetPack` 本身。

⚠️ **它不是纸上谈兵**：真实包里分层背景是常态（`bg-dusk-halt` 的 `sky/wall/ground`、
`counter-siege` 的 `floor/fittings`、`last-train` 十几个版本都是三层）。今天盘上这些**恰好**层名互不相同 ——
**是运气，不是闸**。而 `Layer` 的唯一性规则**只写在交付侧**（`assetpack.ts` 的 `AssetPackEntry.superRefine`），
创作侧 `BackgroundSpec.layers`（= `Layer.extend(...)`，**同一个定义的镜像**）**没有这一条** ——
一条规矩只住在一半。`recipe.ts` 的 `superRefine` 查了 `assets[].id` 重复、`authoring[].id` 重复、
`masterAsset` 指得着、`reference` 与 `masterAsset` 打架 —— **唯独没查层名**。

### ❌ 探针 B：空色板这条**到不了** manifest

直接把 `palette: []` 喂给 `buildAssetPack`（绕过 `readStyle`）：**在 `rasterize` 就炸了** ——

```
RasterError: drawlist "player-odin" ops[0]: 颜色引用 "palette:0" 越界（色板只有 0 项）
```

⇒ 只要有任何一个 drawlist 引用 `palette:N`，空色板**先死在光栅化**，根本走不到组装 manifest 那一步
（这正是票 29 记下的那条「报错指向 drawlist、**指错了方向**」）。
所以票 44 在 `readStyle` 入口堵的那一条，**今天**在 manifest 侧**量不出第二次**。

## 一条顺带量到的（与「验在哪个点」直接相关）

`pack.ts` 里**提交边界已经存在**，而且是干净的：

```
:1143  manifest.files = walk(packDir)      // checksum 取自真字节
:1147  fs.writeFileSync(packDir/manifest.json, jstr(manifest))   // 写进工作目录（.building-<pid>-<N>/）
:1150  auditAssetSpec(...)                 // ⚠️ 不是 schema 校验、不抛
:1158  fs.renameSync(packDir, finalDir)    // ← 提交成 pack/v<N>/
```

⇒ `:1147` 与 `:1158` 之间**没有任何** schema 校验。而 `jstr` 就是 `JSON.stringify(o, null, 2) + "\n"`
—— **验内存里那个对象**与**验写出去的那份字节**不是同一件事（`undefined` 会被丢掉、`NaN` 变 `null`）。
