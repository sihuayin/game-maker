# 票 12 · 默认 Playtest 场景与废土常量解耦证据

- 日期：2026-10-30
- 票：[默认场景实施](../issues/12-default-scenario-implementation.md)
- 上游裁定：[票 06](../issues/06-default-scenario-constants.md) · `rulings-2026-10-29.md` 第 8 节
- 结论：**默认 Demo 身份门禁落地；E2 全绿；E3 非默认拒绝 + 默认 wasteland 兼容各一次通过**。零付费；未提交；基线 / 历史零改动。

## 1. 红：改动前的缺陷

[00-stage-a-facts.md](00-stage-a-facts.md) §3 记录（HEAD `f0411e6`）：

- 默认五态目录的 `success-basic.json` 写死 `target.siteVersion=1`、`initialActivePickups==4`、`collected==6`。
- `selectScenarios` 只校验 `siteVersion`；任何 site v1 的新 Demo 都会选中它，然后死在 wrote 常量上（假失败）。
- 没有「默认目录只服务冻结 wasteland Demo」的身份门禁。

## 2. 绿：实现内容

- `packages/cli/src/playtest.ts`：
  - `DEFAULT_SCENARIO_DEMO = { packId: "wasteland-scavenger-recipe", packVersion: 1 }`，与 `SCENARIO_DIR` 放在一起。
  - `defaultScenarioIdentityProblem(delivery, siteVersion, configPath, configLabel)`：默认 Demo ⇒ `undefined`；否则返回诊断，列出实际 packId/packVersion/siteVersion/pickup/chest/config 路径，并提示用 `--scenario-dir` 提供至少含 siteVersion 与 initialActivePickups 断言的必需场景。
  - `resolveTarget(..., usingDefaultScenarios)`：**未传** `--scenario-dir` 时，在 `selectScenarios` 之前执行身份门禁；不匹配 ⇒ `CommandError("invalid")`（exit 4）。
  - **显式** `--scenario-dir` 绕过门禁（即使指向默认目录）。
- 与票 05 / 票 11 的撤销顺序一致：门禁在准备阶段失败，旧 pass 已先被撤销为 `blocked`；rejection 记录包含 invalidation。
- 不改场景 schema / 默认场景文件 / CLI 命令集合。

## 3. E2

| 测试 | 结果 |
|---|---|
| `packages/cli/tests/playtest-default-identity.test.ts` | 3 tests（默认 wasteland ⇒ undefined；非默认诊断；CLI 非默认 exit 4；显式目录绕过） |
| 全量 `pnpm test` | **153 文件 / 2271 tests** 全绿 |
| `pnpm typecheck` | exit 0 |
| 历史证据验收（`--out` 本 effort） | exit 0（223 文件 / 13 records / 诊断 0） |

## 4. E3 · 非默认 Demo：未传 --scenario-dir ⇒ exit 4

独立副本：`work/ticket12-nondefault/`（把 pack manifest 与 `delivery.pack.packId` 改成 `other-demo`，移除可选 manifestChecksum）。

```
node packages/cli/dist/cli.mjs playtest \
  .scratch/p0-02-second-demo-v2/work/ticket12-nondefault/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/p0-02-second-demo-v2/work/ticket12-nondefault
```

- 退出码 **4**；耗时 <1s；日志 `runs/ticket12-nondefault.log`。
- 诊断：`默认五态场景只服务 wasteland-scavenger-recipe v1；当前 pack=other-demo v1、site=v1、pickup=4、chest=2（config=wasteland-scavenger-recipe/site/v1/game-config.json）。请用 --scenario-dir 提供本 Demo 的必需场景（至少含 siteVersion 与 initialActivePickups 断言）。`
- 旧 pass 已先撤销：`playable-smoke=blocked`、`delivery.playtest` 缺席、invalidation 记录 1 条、rejection 记录含同一诊断。

## 5. E3 · 默认 wasteland：行为保持兼容

独立副本：`work/ticket12-default/`，未传 `--scenario-dir`。

```
node packages/cli/dist/cli.mjs playtest \
  .scratch/p0-02-second-demo-v2/work/ticket12-default/wasteland-scavenger-recipe/run/v1 \
  --out .scratch/p0-02-second-demo-v2/work/ticket12-default
```

- 退出码 **0**；耗时 **19s**；attempt v3；`success-basic` SUCCESS；`playable-smoke=pass`、`verdict=pass`。
- invalidation 记录 1 条（before pass → after blocked），最终成功写回恢复 pass。
- 证明默认 wasteland 身份门禁不会误伤兼容路径。

## 6. 历史与零付费

- 基线副本 qa-report 仍为 `dc20e301…5ee6`；旧 work 95/95、冻结快照 66/66 未变。
- 真实运行只启动本地 Chrome；零模型/付费调用；未提交、未推送。

## 7. 已知限制

- 门禁身份是 `packId + packVersion + siteVersion`；同一 packId/version 但内容被改而不升版本的情况属于版本纪律问题，不在本票识别范围。
- 非默认 Demo 的 `--scenario-dir` 只需提供匹配 siteVersion 的必需场景；场景是否真正覆盖玩法由该 Demo 的作者负责。

## 8. 变更文件

- `packages/cli/src/playtest.ts`
- `packages/cli/tests/playtest-default-identity.test.ts`（新）
