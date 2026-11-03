# 下游审计：compile-runtime 调用链、槽位 kind 锁与五错误回归

Type: research
Status: resolved
Owner: research subagent · 2026-11-02
Blocked by: —
Map: ../map.md

## Question

**只读**审计下游校验链路，回答：2026-10-23 的五个历史错误今天是否仍被可靠拦截？现有语义校验
覆盖到哪里、还漏什么？错误定位与测试覆盖是否足以支撑 P0-B 的缺口裁定？

### 必须交付（E1 源码 / E2 测试，逐条给 `file:line`）

1. **`compile-runtime` 完整调用链**：从设计 + 资源清单输入，到 `parseGameConfig`、`clampToWorld`、
   重采样循环、各批审计、层覆盖、落盘；标明每一步失败的分档（重采样 / 不重采样）、是否落盘、是否
   消耗版本号。
2. **所有 `audit*` 函数及职责**：至少覆盖 `auditReferences`、`auditGameConfig`、`auditPanelSize`、
   `auditScreenSpace`、`auditLayerCoverage`、`auditReachability`、`auditEntityIdentity`；注明每个函数
   被谁调用（编译 / QA / site / CLI）、返回形态与严重度分档。
3. **全部槽位 kind 锁清单**：`player` / `solid` / `hud.panel` / `hud.pip` / `background` / 各实体 kind
   （`pickup` `hazard` `chest` `goal` `danger` `decor`）分别要求/不要求哪种 `AssetKind`；明确列出
   **没有锁**的槽位。
4. **五个历史错误逐项复核**（以 `.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/stage-b.log`
   为历史证据）：每项给出「历史捕获方式 → 当前实现位置 → 当前回归测试（文件 + 用例名 + 断言）」；
   若当前测试只覆盖同类而非同一形态，必须写明差异。
5. **当前测试覆盖和遗漏**：现有正/负测试覆盖了哪些槽位、哪些错误族；哪些错误族只有正向验收、
   没有确定性负向测试。
6. **`ConfigIssue` 消费点初步清点**：全部返回或消费 `ConfigIssue` 的位置（含 QA 合成、CLI/MCP 输出），
   只清点与形态，不评估方案（方案归 03）。
7. **语义约束的其余缺口**：除 kind 锁外，现有审计是否缺「设计对象 ↔ 资源语义」「动画引用完整性」
   「UI 能力与尺寸」中的任何一条；给出证据而不是 PRD 转述。

### 约束

- **只读**：不修改任何生产代码、测试、fixture、契约。
- 不跑付费调用；需要运行测试时只用**既有**测试与 fixture，并记录命令、退出码、结果。
- 不把 PRD 的槽位表当作事实来源；一切规则以源码与 Runtime 消费逻辑为准。
- 证据分级：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据。

### 产出

- 报告写入 `../research/01-downstream-audit.md`（相对本票）。
- 本票追加 `## Answer`（一页以内：五错误现状表 + 槽位锁矩阵 + 残余缺口事实清单），`Status` 改 `resolved`。

## Answer

**结论：五个历史错误今天仍全部被拦截；但拦截分档已从「不重采样」变为「模型错、3 发重采样后失败」，且测试覆盖只到纯函数层，缺口在“拦得窄 / 拦得晚 / 回归形态不全”。完整报告：[research/01-downstream-audit.md](../research/01-downstream-audit.md)。**

### A. 五错误现状（E1 源码 + E3 真实历史产物复现）

| 编号 | 今天是否拦截 | 当前实现 | 当前回归测试（文件 + 用例 + 断言） | 同形态？ |
|---|---|---|---|---|
| E01 `block-1` solid 用 player animation | 是 | `solid -> sprite` kind 锁，先于 `resolvePackRef`（`contracts/src/game-config.ts:317-327,370-372`） | `packages/contracts/tests/game-config.test.ts:181-185` `it("...solid 实体只能引用 sprite...")`，断言 `/是 animation，这里要的是 sprite/` | 同槽位同错误类，消息由“缺 anim”变为直接 kind 拒绝 |
| E02 `slope-1` 同 E01 | 是 | 同 E01；GameConfig 无独立 slope 槽位（`EntityKind` `:51`） | 无 `slope-1` 用例，由同一实现覆盖 | 同实现，无独立用例 |
| E03 `hud.panel` 用 chest sprite | 是 | `hud.panel -> ui`（`game-config.ts:373`） | 横版 `game-config.test.ts:172-179` 只测 `animation -> ui`；塔防 `td-config.test.ts:107-111` 才测 `sprite -> ui` | **不同形态**；无 compile-runtime 端到端用例 |
| E04 `hud.pip` 用 resource-item sprite | 是 | `hud.pip -> ui`（`game-config.ts:374`） | **无负向测试**；只有正向夹具 | **缺失** |
| E05 panel 72×32 vs chest 32×24 非九宫格 | 是 | `auditPanelSize`（`game-config.ts:404-425`，调用 `:479`） | `game-config.test.ts:439-444` `it("负例：非九宫格 + 声明 ≠ 包...")`，断言 `/不是九宫格/`、`/12×12/`；正例 `:435-437` | 同形态，夹具换成 hud-pip 12×12 |

- **当前失败分档（E3）**：用真实 `rust-city-scavenger/pack/v1` + `game-design.json` 重建同一份坏配置，`compileRuntime` 3 次调用、3 次判“模型错”、抛 `invalid`（4）、**不落盘、不消耗 `game-configs` 版本号**。E01-E05 全在 `modelHard`（`assets/src/ops.ts:1193-1207`），所以历史日志的“不重采样”只对 2026-10-23 当时成立。
- **额外上游防线（E3）**：历史清单 0 件 `ui`，今天在 `planAssets` 的 `hudUiGate` 就被拒（3 发、不落清单、不生图；`assets/src/ops.ts:300-314,482-488`），但仅当设计声明 `hud:screen-space`。
- **检测面**：E01-E04 在 `compileRuntime` / QA `reference-resolution` / `site` / `reuseConfig` 都可见；**E05 在 QA 与 `reuseConfig` 不可见**（`auditPanelSize` 不在 `auditReferences`）。

### B. 槽位 kind 锁矩阵（横版 `game-config/v1`）

| 槽位 | 要求 `AssetKind` | 锁 |
|---|---|---|
| `scene.background.asset` | `background` | 有 |
| `player.asset` | `animation` | 有 |
| `entities[].asset`（`solid`） | `sprite` | 有 |
| `hud.panel.asset` / `hud.pip.asset` | `ui` | 有 |
| `entities[].asset`（`pickup`） | 无 | **没有锁** |
| `entities[].asset`（`hazard`） | 无 | **没有锁** |
| `entities[].asset`（`goal`） | 无 | **没有锁** |
| `entities[].asset`（`chest`） | 无 | **没有锁** |
| `entities[].asset`（`danger`） | 无 | **没有锁** |
| `entities[].asset`（`decor`） | 无（源码明示可 sprite/animation/ui） | **没有锁** |

即：**没有 kind 锁的槽位 = pickup / hazard / goal / chest / danger / decor**（`game-config.ts:370-374`）。锁本身也只锁格式、不锁语义（`solid` 接受任何 sprite，`role` 无人读）。

### C. 残余缺口事实清单（不评方案）

1. **设计对象 ↔ 资源语义只在格式层部分成立**：设计桶→EntityKind 有矩阵（`game-config.ts:534-539`），EntityKind→AssetKind 只锁 5 个槽位。E3 证明「设计 enemy → hazard → ui 图标」可通过 `compileRuntime` 全链并落盘；「pickup → background（3 帧）」零 issue。
2. **`sprite` 内不区分地形/角色/道具**：玩法 sprite（`pickup-suitcase`）作 `solid` 零 issue；`role` 是自由文本、无审计读它（`assetpack.ts:166`）。E01/E02 的同类错误在“角色被产成单帧 sprite”时不会被拦。
3. **`chest` / `danger` 不要求状态帧**：单帧 sprite 零 issue；Runtime 的 `openFrame` / `activeFrame` 为 `undefined`，状态切换静默（`demo/src/world.ts:184-185`、`demo/src/shell/scene.ts:175-195`）。
4. **九宫格最小尺寸/边框适配未校验**：`auditPanelSize` 见到 `scale9Borders` 即放行（`game-config.ts:414`）；声明 1×1 仍零 issue，而 Phaser 会钳到边框和 8×8（vendored `NineSlice.js:724`），审计盒与绘制盒不一致。
5. **`reachability` 只在 QA 跑**（`contracts/src/reachability.ts:44`、`qa/src/gameplay.ts:80`），不在 `compileRuntime` / `site`（`contracts/src/index.ts:145-147`）。
6. **`reuseConfig` 只跑 `auditReferences`**（`pipeline/src/create-game.ts:482-489`），自洽族 / `auditPanelSize` / 身份 / 屏幕空间 / 层覆盖全绕过。
7. **`ConfigIssue` 只有 `{severity, where, message}`**（`game-config.ts:281-285`）；所有消费者（QA 合成、site、CLI/MCP）都只做字符串拼接，无稳定 code / 字段级定位（交 03 票 A/B）。
8. **上游一致性**：config 把 `hud` 设为必填（`game-config.ts:223`），而 ui 资源要求只在设计声明 `hud:screen-space` 时触发（`ops.ts:301`）；不带该能力的设计可合法规划出无 ui 清单，随后 config 必然连拒 3 发。

### D. 验证

- `npx vitest run`（7 个相关文件）：退出码 0，151 tests passed。
- 真实历史产物复现：E01-E05 恰好 5 条 error；`compileRuntime` 3 发、不落盘；`planAssets` 被 `hudUiGate` 拒、3 发、不落清单。
- 全部零付费、零模型调用、零生图；未跑 create 链。命令、退出码与探针结果见报告 §8。
