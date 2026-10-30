# 默认 Playtest 场景与废土常量解耦：实施

Type: task
Status: resolved
Blocked by: 01, 06

## Question

按票 06 的裁定实施解耦。最低不变量：

1. **先红**：新增失败测试，证明当前默认路径对非 wasteland Demo 的隐式依赖 ——
   - 一个 `packId` 不是 `wasteland-scavenger-recipe`（或 packVersion ≠ 1）、site v1 的 Demo，未传 `--scenario-dir` 时仍会选到 `success-basic`，随后死在 `initialActivePickups==4` / `collected==6` 的假失败上；
   - 按票 06 应有的「准备阶段 exit 4 + 诊断」当前不存在。
2. **实施（票 06 (b)）**：
   - 在 `SCENARIO_DIR` 旁加默认 Demo 身份常量：`{ packId: "wasteland-scavenger-recipe", packVersion: 1 }`；
   - `runPlaytestCommand` 记录是否显式传入 `--scenario-dir`；未传时，在准备阶段比对 `delivery.pack.packId/packVersion`（及现有 siteVersion 校验），不匹配 → `CommandError("invalid")`（exit 4）；
   - 显式传 `--scenario-dir` 时绕过该检查（即使指向默认目录）；
   - 默认 wasteland 行为保持兼容；不改场景 schema/场景文件。
3. **诊断**：错误信息列出实际 `packId` / `packVersion` / `siteVersion` / pickup 数 / chest 数 / config 路径，并说明默认五态场景只服务 `wasteland-scavenger-recipe v1`，其他 Demo 需用 `--scenario-dir` 提供至少含 `siteVersion` 与 `initialActivePickups` 断言的必需场景。沿用 `playtest/rejections/*.json`；按票 05，旧 pass 已先撤销为 `blocked`。
4. **测试**：默认 wasteland（packId/packVersion 匹配）仍选 `success-basic`；非默认 pack + 默认目录 → exit 4 且诊断含身份事实；显式 `--scenario-dir` 对非默认 Demo 可用；不削弱现有 required/siteVersion 测试。
5. **真实证据**：在**独立副本**上把 pack 身份改成非 `wasteland-scavenger-recipe` v1（或使用一个非默认 Demo 副本），跑一次「无 `--scenario-dir`」的命令：记录 exit 4、诊断全文、`playtest/rejections/*.json`、旧 pass 已被撤销为 `blocked`；再确认默认 wasteland 副本仍能选中 `success-basic`（可用 CLI/测试层面的选择证据）。零付费；基线副本不被污染。
6. **回归**：目标测试 + `pnpm typecheck`。

产物：代码 + 测试 + `research/12-default-scenario-evidence.md`。未获票 06 裁定前不开工。

## Answer

**2026-10-30 实施收口。** 证据：[research/12-default-scenario-evidence.md](../research/12-default-scenario-evidence.md)。

### 实现

- `playtest.ts` 增加 `DEFAULT_SCENARIO_DEMO = { packId:"wasteland-scavenger-recipe", packVersion:1 }` 与 `defaultScenarioIdentityProblem(...)`。
- 未传 `--scenario-dir` 时，在 `selectScenarios` 之前校验目标 pack/site 身份：不匹配 → exit 4，诊断列出实际 packId/packVersion/siteVersion/pickup/chest/config 路径，并提示用 `--scenario-dir` 提供至少含 siteVersion 与 initialActivePickups 断言的必需场景。
- 显式 `--scenario-dir` 绕过门禁；不改场景 schema/场景文件。
- 与票 05/票 11 一致：准备拒绝先撤销旧 pass，rejection 记录含 invalidation。

### 证据

- 全量 `pnpm test` **153 文件 / 2271 tests** 全绿；`pnpm typecheck` exit 0；历史证据验收 exit 0。
- 非默认 Demo E3（独立副本，pack=other-demo）：exit 4，诊断含实际身份；旧 pass 已撤销为 blocked；invalidation/rejection 记录齐全。
- 默认 wasteland E3（独立副本，未传 --scenario-dir）：exit 0 / 19s，success-basic SUCCESS，最终 pass；证明兼容路径未被误伤。
- 基线副本 qa-report 仍为 `dc20e301…5ee6`；旧 work / 快照零改动；零付费、未提交。

### 已知限制

- 身份是 packId+packVersion+siteVersion；同版本内容漂移属版本纪律问题。
- 非默认 Demo 的 `--scenario-dir` 场景覆盖玩法由作者负责。
