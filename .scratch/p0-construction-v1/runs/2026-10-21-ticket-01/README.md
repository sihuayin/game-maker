# 票 01（P0-04）· 资产完整性链 —— 验证证据

日期：2026-10-21 · 分支 `p0-construction-v1` · 零付费、未提交。

## 命令与退出码

| 命令 | 退出码 | 摘要文件 |
|---|---|---|
| `pnpm test` | 0 | `test.txt`（111 文件 / 1740 用例全绿） |
| `pnpm typecheck` | 0 | `typecheck.txt` |
| `pnpm build` | 0 | `build.txt` |
| `pnpm check:deps` | 0 | `check-deps.txt` |
| `designCoverageGate` 正例（归档 10-17d / fixtures/e2e / canned） | 0 | `coverage-positive.txt`（三对全 `null` = 不误伤） |
| `game-maker verify` v7 包 | 0 | `verify-v7.txt`（157 个 checksum 全对） |

## 三类闸的落点

1. **design→recipe 覆盖闸**（CAP-SPEC-12）：`packages/assets/src/ops.ts:253`（判据）、
   `ops.ts:379`（`planAssets` 重采样循环，`schema` 档）、`packages/pipeline/src/create-game.ts:463`
   （`runBuild` 在 `packAssets` 之前，查的是磁盘上那份清单）。
2. **`verifyPack` 入链**（CAP-ASSET-06）：`packages/pipeline/src/create-game.ts:499`
   （`packAssets` 成功之后、`compileRuntime` / QA / site 之前；只做一次）。
3. **空色板前移**（CAP-SPEC-17）：`packages/assets/src/ops.ts:276`（共用判据）、
   `ops.ts:319`（单独 `plan` 入口）、`packages/pipeline/src/create-game.ts:303`
   （VWS 落盘之后、`analyze-intent` 之前；失败时账随异常走）。

## 测试

- 新增 `packages/assets/tests/plan-coverage-gate.test.ts`：6 用例
  （正例；敌人缺资源；交互物改名；拾取物缺资源；NPC 缺资源；空色板 plan 入口零调用）。
- 新增 `packages/pipeline/tests/create-game.test.ts` 三例：
  人改清单删敌人 ⇒ 构建段 pack 前拒；篡改包文件 ⇒ verify 在 config/QA/site 前 invalid、原包保留；
  空色板 VWS ⇒ 只发 analyze-reference 一发、现场留 VWS。
- 既有夹具 / 用例的必要更新：`fixtures/upstream/canned.json` 加一件 `e-drone` drawlist sprite
  （用户 2026-10-21 逐字批准「允许最小改 canned 夹具」）；CLI / pipeline 的资源数与 drawlist 并发数断言同步。

## 契约 / 豁免

- **无契约变更**（`asset-recipe/v1` / CLI / MCP / 新依赖：零改动）。
- 覆盖闸口径：用户 2026-10-21 裁定「严格全覆盖，无豁免」——设计四桶每个 id 必须有资产
  `spec.id` 或 `spec.characterId` **逐字**相等；不看前缀、不接收「模型说不需要」。
- planner 工具说明第 3 条已加入同一规则（重采样时模型看得到，能真正修好）。
