# 01. P0-04 · 资产完整性链（覆盖闸 / verifyPack 入链 / 空色板前移）

Type: task
Status: resolved
Owner: main session · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

把「设计要的实体是否都有对应资源」「包文件是否真的完整」「空色板是否在下游付费前被拒」
三件事变成链上的硬闸。对应 `CAP-SPEC-12` / `CAP-ASSET-06` / `CAP-SPEC-17`，
范围与测试口径见 `docs/v4/P0-00-p0-scope.md` §3 P0-04。

1. **design→recipe 覆盖闸**：对 `GameDesignSpec` 的 `enemies` / `npcs` / `interactables` / `resources`
   每个 id，要求 recipe 有对应资产（`characterId` / 资产 id / 明确的豁免规则）。
   豁免必须显式、可测试，不得用「模型说不需要」当豁免。先读现有 design → recipe 的形状再定落点。
2. **`verifyPack` 入链**：`runBuild` 在 `packAssets` 成功后、`compileRuntime` / QA / site 之前调用
   `verifyPack`；失败 ⇒ `invalid`，不产 config / QA / site。只做一次全量 checksum，不重复。
3. **空色板前移**：VWS 产出后、`analyzeIntent` / `compileDesign` / `compileCharacterDna` /
   `planAssets` 等下游付费调用之前拒绝空色板；单独 `planAssets` 入口也拒绝。
   **不是**「在产出色板的那一发之前」——色板本身就是那一发的产物。

## 验收

- 设计里有一个敌人、recipe 缺它 ⇒ 规划期拒绝（或 `runBuild` 在 config 前拒绝）；负例明确。
- 显式豁免的 id 不报；未豁免的缺 id 必报；豁免清单可测试。
- 篡改包内一个文件（checksum 不符）⇒ `runBuild` 在 config / QA / site 前 `invalid`；
  CLI 退 4；站点不产；原包保留。
- 空色板 VWS ⇒ 在 `analyzeIntent` 之前拒绝；fake upstream 下游调用计数为 0；
  `planAssets` 单独入口同样拒绝。
- 正例：v7 + 已验收 config / design 不被新闸误伤。
- `pnpm test` / `pnpm typecheck` 全绿。

## 边界

- 不新增 `source.kind`；不改 `resolveRoute` 规则矩阵；不改 Pack 目录结构 / manifest 语义 / 版本分配；
  不实现 `import` 三入口；不改变 QA 既有引用族判据。
- **若需要新增 finding code / 契约字段 / CLI 参数**：先按 Q5 交逐项变更清单，获批后才动。
- 零付费；不跑真实上游链；不改 v7 包与 `fixtures/`；不提交。

## 产出

`## Answer`：三类闸的落点（`path:line`）、测试文件名与用例数、命令与退出码、
任何契约变更清单及其批准状态。

## Answer

**已收口（施工）。** 三类闸全部落链；零付费、未提交。**无契约 / CLI / MCP / 新依赖变更**
（`fixtures/upstream/canned.json` 的最小改动已获用户逐字批准）。

### 1. design→recipe 覆盖闸（`CAP-SPEC-12`）

- 判据：`packages/assets/src/ops.ts:253`（`designCoverageGate`）——设计四桶每个 id，必须有一件资产的
  `spec.id` 或 `spec.characterId` **逐字**相等；不做前缀、不改名、不省略。
- 规划期：`ops.ts:379`（`planAssets` 重采样循环，与玩家闸门同档 `schema`）——三发用完 ⇒
  `CommandError("invalid")`、退出码 4、清单一个字节都不落盘。
- 构建期：`packages/pipeline/src/create-game.ts:463`——`runBuild` 在 `packAssets` **之前**用磁盘上那份
  清单与设计再查一次（人改过清单也拦，缺资源时不烧生图的钱）。
- 提示词：`packages/assets/src/prompt.ts:819`（工具说明第 3 条；「七条」→「八条」）——
  重采样时模型看得到规则，三发内能真正修好；`plan-assets.test.ts` 的 12 字段具名插值仍全绿。
- **豁免：无**（用户 2026-10-21 逐字裁定「严格全覆盖，无豁免」）。缺 id 必报、名字原样列出。
- 批准记录：用户 2026-10-21 逐字「允许最小改 canned 夹具」——canned 配方补一件 `e-drone`
  drawlist sprite；不做「不动 fixtures、改测试桩」的绕行。

### 2. `verifyPack` 入链（`CAP-ASSET-06`）

- `packages/pipeline/src/create-game.ts:499`——`packAssets` 成功之后、`compileRuntime` / QA / site 之前
  调一次 `verifyPack`（全量 checksum **只做一次**）。失败 ⇒ `invalid`（退出码 4），不产 config / QA / site；
  包原样保留（诊断现场）。
- 测试注入口：`BuildInput.verify`（`create-game.ts:134`，默认 `verifyPack`），与既有 `inspect` 同款。

### 3. 空色板前移（`CAP-SPEC-17`）

- 共用判据：`packages/assets/src/ops.ts:276`（`emptyPaletteProblem`，`readStyle` 也改走它，`ops.ts:1559`）。
- VWS 产出后、下游付费调用前：`packages/pipeline/src/create-game.ts:303`——先 `writeVisualWorld`
  （失败现场留得下空色板 VWS），再拒；`analyze-reference` 已花的账随异常走。
- 单独 `plan` 入口：`ops.ts:319`——在任何上游调用之前拒（fake upstream 计数 0）。

### 测试与命令

| 命令 | 结果 | 证据 |
|---|---|---|
| `pnpm test` | exit 0 · 111 文件 / **1740 用例全绿** | `runs/2026-10-21-ticket-01/test.txt` |
| `pnpm typecheck` | exit 0 | `typecheck.txt` |
| `pnpm build` | exit 0 | `build.txt` |
| `pnpm check:deps` | exit 0（9 个包） | `check-deps.txt` |
| 覆盖闸正例：归档 10-17d / `fixtures/e2e/wasteland-platformer` / canned | 三对全 `null`（不误伤） | `coverage-positive.txt` |
| `game-maker verify` v7 | exit 0 · 157 checksum | `verify-v7.txt` |

- 新增 `packages/assets/tests/plan-coverage-gate.test.ts`：**6 用例**（正例；敌人缺资源；
  交互物改名；拾取物缺资源；NPC 缺资源；空色板 plan 入口零调用）。
- `packages/pipeline/tests/create-game.test.ts` 新增 **3 用例**：人改清单删敌人 ⇒ pack 前拒；
  篡改包文件 ⇒ verify 在 config / QA / site 前 `invalid`、原包保留；空色板 VWS ⇒ 只发第一发、
  现场留 VWS。
- 既有用例的必要更新：canned 夹具 +1 资源 ⇒ pipeline/CLI 的资源数与 drawlist 并发峰值断言；
  `plan-assets` 系列用本地占位资产满足覆盖闸（夹具文件不动）；`prompt.test.ts` 条数七→八。

### 诚实边界

- **CLI「退 4」**：篡改包只能在库层通过 `BuildInput.verify` 注入（CLI 无此注入口），所以端到端 CLI
  用例没有直接跑「篡改包 → CLI」；改用 `exitCodeOfError` 断言 4，并复用既有的同一映射证据
  （`cli.test.ts:105-107` 的 `invalid → 4`、`cli-create.test.ts:412` 的 build invalid → 4）。
- 构建期读设计失败（文件缺失 / 不过契约）仍是裸 `Error`（退出码 1），与同文件里「清单过不了契约」
  的既有处置一致；本票不改这个档。
