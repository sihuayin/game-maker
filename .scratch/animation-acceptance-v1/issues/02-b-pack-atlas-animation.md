# 02. B · 资源包、图集与动画数据结构

Type: research
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

追踪一条真实数据路径：

`资源产物 → 资源清单 → 图集 / 动画元数据 → 游戏配置 → 运行时加载`

回答任务书 §4.2 的 10 个问题：

1. 当前资源包的正式格式是什么？
2. 图集和动画元数据由谁生成？
3. 动画帧如何表示、排序与引用？
4. 锚点、帧尺寸和帧持续时间如何表达？
5. 哪些字段必填，哪些可选？
6. 资源路径和资源身份如何确定？
7. 是否存在内容哈希、版本号或稳定资源 ID？
8. 是否已有 schema 校验和引用完整性检查？
9. 哪些异常会被明确拒绝，哪些可能漏过？
10. 资源包格式是否足以支持后续验收报告关联？

必须区分五层：Schema 合法 / 文件存在 / 文件可解码 / 元数据引用有效 / 动画可以正确播放。
不得因为包能成功解析，就认定其中所有动画均有效。

必读：`packages/contracts/src/assetpack.ts`、`packages/assets/src/{atlas,sheet,pack,quantize,raster}.ts`、
`packages/demo/src/{site,assemble,world,draw}.ts`、`packages/contracts/src/game-config.ts`、
`docs/v2/01-contracts.md`、`CONTEXT.md` 的 AssetPackManifest / Asset / 母版词条。
真实样本：v7 包、`fixtures/packs/last-train/v2`、`fixtures/packs/counter-siege/v4`。

## 验收

- 数据结构表：字段 · 必填/可选 · 生产者 · 消费者 · 校验入口 · 证据。
- 帧如何表示 / 排序 / 引用；`anchor`、`size`、`durationMs`、`fps`、`loop` 的落点与语义。
- 资源身份：路径、id、版本、checksum、稳定 ID 是否存在。
- 引用完整性检查点：动画 → 帧、图集 → 帧、manifest → files、config → pack；哪些异常会漏过。
- v7 `scavenger-actor` idle 4 帧在这条链上的每一站：源文件、manifest 条目、图集矩形、运行时读取点。
- 资源包格式是否足以支持验收报告关联（结论 + 证据）。

## 边界

- 只读；不改资源 / 不重新生成 / 不改 Schema / 配置 / 锁文件。
- 允许定向测试与只读 `verify` / `inspect`；禁止 `pnpm check` / `pnpm build` / 写 `out/`；零付费。
- v7 与 fixtures 仅作只读样本，不复制、不修改。
- 不写 `map.md`；只写本票与 `research/b-pack-atlas-animation.md`；不提交。

## 产出

`research/b-pack-atlas-animation.md`：数据路径 + 字段表 + 校验入口 + 五层合法性结论 + 证据弱点。
完成后在本票追加 `## Answer`（10–20 行摘要），`Status: resolved`。

## Answer

- **格式**：`assetpack/v4` manifest + 四类 TexturePacker JSON Hash 图集（`delivery/atlas.<kind>.{json,png}`）+ `authoring/` + `ledger.json`/`coverage.json`（`packages/contracts/src/assetpack.ts:57,265-333`；`packages/assets/src/pack.ts:1143-1165`）。生产者是 `buildAssetPack`；消费者是 `world.ts`/`draw.ts` 与 Phaser。
- **帧**：名字是唯一连接键；播放顺序 = `Animation.frames[]` 数组序（`pack.ts:1050-1056`；`resolvePackRef` `assetpack.ts:377-426`）。`FrameRef.index`/`durationMs` 零生产者、零消费者（`assetpack.ts:153-154`；`pack.ts:1221`）。
- **anchor/size**：manifest 资源级一份 + 图集逐帧一份；壳用 manifest 算盒子，Phaser 用图集 `customPivot` 逐帧 origin（`draw.ts:123-126`；Phaser 3.90 `JSONHash.js:80-85`）。两份**从不跨文件对账**。
- **fps/loop**：写进 manifest，但运行时写死 `run?10:6` / 实体 `8` / 全部 `repeat:-1`（`scene.ts:140,193`）。v7 `jump(fps10,loop:false)` 实际 6fps 无限循环。CONTEXT:313-316 声称 Game Config 可逐引用覆盖，契约/实现里没有。
- **身份**：包 `id + version + files[].sha256` 足以钉住包字节；无 per-asset 哈希、无 manifest 自哈希、无全局稳定 ID；`AtlasEntry.checksum/size/frames` 零读者；包内无 recipe、`generator.run` 零生产者。
- **五层**：L1 manifest schema `implemented`（图集 JSON 无 schema）；L2 文件 `partial`（`verify` 手动，`runBuild` 不调用）；L3 解码 `partial`（只有 `inspect` 解码且不阻断）；L4 引用 `partial`（manifest 内与 config→pack 实；manifest→图集 JSON 无检查）；L5 播放 `partial`（帧推进 HEAD 实测通过；fps/loop/duration 不生效；视觉正确性未验证）。
- **关键漏网**：`/tmp` 合成探针证明 `verify` 在「manifest 帧不在图集 JSON + 图集 PNG 不是 PNG + AtlasEntry.frames 说谎」时仍 exit 0；`inspect` 才报「不是 PNG」exit 1。跨资源同名帧会被 `atlas.ts:86` 静默覆盖。
- **v7 idle 全链路**：`authoring/generated/scavenger-actor.idle1..4.png` → manifest idle(4,fps6,loop) → `atlas.animations.json` 矩形 `{64/112/160/208,192,48,64}` → `game-config.player.anims.idle` → `site/v3` → Phaser。HEAD 运行采样 124 点，4 帧 ~168ms 循环（`runs/2026-10-21-runtime/samples-idle.json`）。
- **报告关联**：`partial`。`qa-report/v1` 只有 `format/checked/failures/observations`（`qa.ts:266-274`），无 id/version/checksum/createdAt；`run/v<N>` 与 `pack/v<M>` 可不同号（`create-game.ts:437-441`）。包侧身份够，报告侧缺外键。
- **证据**：`.scratch/animation-acceptance-v1/research/b-pack-atlas-animation.md`（本报告，含字段表、检查点矩阵、五层表、v7 逐站表）。
- **测试**：`vitest` 7 文件 / 129 用例通过；`verify` 三包 exit 0；`inspect` v7 与 last-train exit 0；仓库 `out/` 未写、工作树未改（除 research/本票）。
- **未验证**：图集越界矩形在 `inspect` 的具体失败形态；视觉正确性（票 05）；运行时证据来自票 06 的同基线 CDP run，本票未重跑；`pnpm typecheck` 未跑。
