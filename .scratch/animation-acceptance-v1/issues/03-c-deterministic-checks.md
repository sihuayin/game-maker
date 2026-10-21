# 03. C · 现有确定性检查覆盖矩阵

Type: research
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

搜索并核实与以下问题有关的代码和测试：文件存在性、文件解码、图片宽高、图集边界、帧引用、
动画帧顺序、资源名称冲突、透明背景、锚点合法性、资源清单与实际产物一致性、错误分类与失败信息。

回答任务书 §4.3 的 7 个问题：

1. 当前是否存在资源包级别的验证器？
2. 验证器实际检查哪些条件？
3. 是否存在只声明检查但没有读取对应字段的情况？
4. 检查结果是布尔值、错误列表，还是统一错误对象？
5. 失败信息能否定位到具体文件、资源和帧？
6. 当前测试是否覆盖非法输入？
7. 是否存在多个模块重复实现同一检查？

**特别检查**：如果某个模块声称能够验证锚点、尺寸或动画结构，必须确认它确实读取并验证对应字段，
而不是只依赖其他检查的间接结果。

必读：`packages/assets/src/pack.ts`（`verifyPack`）、`packages/assets/src/ops.ts`、
`inspect` 实现、`packages/contracts/src/assetpack.ts` 的 `superRefine`、`packages/qa/src/*.ts`、
相关 tests（`packages/assets/tests/*`、`packages/contracts/tests/assetpack.test.ts`）。

## 验收

- 覆盖矩阵：检查项 · 实现位置 · 正常用例 · 异常用例 · 错误定位能力 · 状态
  （`implemented` / `partial` / `missing` / `unverified`）。
- 每个「检查存在」的结论有 `path:line`；每个「有测试」的结论有测试文件与用例名。
- 明确验证器返回结构、错误对象字段、能否定位文件/资源/帧。
- 明确重复实现与只声明不读取的字段。
- 在 HEAD 复验 W4 的结论（尤其 `verifyPack` 是否在 `runBuild` 中、`inspect` 是否只观察不阻断）。

## 边界

- 只读；不改验证器 / 测试 / Schema。
- 允许定向测试与只读 `verify` / `inspect`；禁止 `pnpm check` / `pnpm build` / 写 `out/`；零付费。
- W4 只作线索，逐条对 `f0dac01` 复验。
- 不写 `map.md`；只写本票与 `research/c-deterministic-checks.md`；不提交。

## 产出

`research/c-deterministic-checks.md`：覆盖矩阵 + 验证器行为 + 重复实现 + 证据弱点。
完成后在本票追加 `## Answer`（10–20 行摘要），`Status: resolved`。

## Answer

- **有包级验证器，但不在构建链上**：`verifyPack`（`packages/assets/src/ops.ts:1662`）只由 CLI `verify` / MCP `verify_asset_pack` 手动调用；`runBuild`（`packages/pipeline/src/create-game.ts:417-560`）不调用它。它只验 schema + `files[]` 存在/大小/sha256 + 反向穷举 + 可选 ledger/master-ratios 的 schema 与包版本。
- **verify 不解码、不读图集 JSON**：不查帧矩形越界、不核对 `atlases[].size`、不读锚点、不核对目录 `vN`、不解析 `coverage.json`。探针：换成非 PNG、帧矩形 `9999`、`atlases[].frames=999`、目录改 `v99`，`verify` 全通过。
- **契约层最实**：`AssetPackEntry.superRefine` 真实校验帧/动画/层/资源 id 唯一、动画帧 ⊆ `frames[]`、多帧归组、层帧一一对应（`assetpack.ts:194-333`）；但只看 manifest，不碰图集 JSON（探针 F：manifest 加幽灵帧 ⇒ 通过）。
- **「只声明不读取」确认**：QA 判据 `constructive-constraint` 的注释与标签写「尺寸/锚点/九宫格」（`qa.ts:114,385`），实际 `auditAssetSpec`（`audit.ts:45-84`）不读 `anchor` / `scale9Borders` / 图集帧 bounds；spec 锚点 `{0,0}` vs 产物 `{0.9,0.9}` 仍返回 `[]`。
- **死字段/死检查**：`AtlasEntry.checksum`（`assetpack.ts:262`）零读者；`checkSize`（`audit.ts:24`）零生产调用；`FrameRef.index/durationMs` 零读者；`fps/loop` 运行时写死（`shell/scene.ts:191,140`、`shell/td/scene.ts:143`）——v7 `jump` 声明 `fps=10/loop=false`，实际 6fps 循环。
- **返回结构不统一**：`parseAssetPack{ok,errors:string[]}` / `verify` 抛 `CommandError` + `problems[]` / `auditAssetSpec string[]` / QA `{target,severity,detail}` / `ConfigIssue{severity,where,message}`。
- **定位分层**：`verify` 到文件（相对路径，最多 6 条）不到资源/帧；QA 到资源 id/`recipe`/`game-config` 不到文件；没有任何一层同时给出文件+资源+帧的结构化字段。
- **非法输入测试不均**：契约/QA/生成期负例充分；`verify` 对包内容的仓库负例只有 checksum 篡改（`cli.test.ts:127`），缺文件/大小不符/越界/坏 JSON 无仓库测试（`/tmp` 探针 A–N 补齐，未入库）。
- **重复实现**：同一文件两份 checksum（`files[]` 被验、`atlases[].checksum` 不验）；动画帧引用在 `superRefine` 与 `resolvePackRef` 两处活实现；帧数在 recipe/pack/manifest/audit 四层各说一遍。
- **W4 复验全部成立**：`verify` 不在 runBuild、`inspect` 只观察不阻断（`create-game.ts:510-518` + `assemble.test.ts:123-150`）、Asset QA 只对账 spec↔manifest、`pack.audit` 不消费、`checkSize` 无生产调用。`ea53240..HEAD` 的代码增量只有 JPEG 解码。
- **运行证据**：5 组定向测试 exit 0（40/26/14/20/41 用例）；v7 包只读 `verify` 157 文件通过、`inspect` 19 资源/76 帧/13 动画。零付费、未写 `out/`。
- **未验证**：真实播放外观/帧序/锚点对齐（属票 06）；`coverage.json` 版本对账无测试；坏 manifest JSON 退 1（非 4）。
- 完整矩阵与证据：`research/c-deterministic-checks.md`（§1 矩阵、§2 验证器、§3 特别检查、§6 W4、§7 运行）。
