# 票 09 · hazard 正向断言实施证据

- 日期：2026-10-30
- 票：[hazard 断言实施](../issues/09-hazard-assertion-implementation.md)
- 上游裁定：[票 03](../issues/03-hazard-positive-assertion.md) · `rulings-2026-10-29.md` 第 5 节
- 结论：**probe-only 实现完成 + E2 全绿 + E3（生产 probe + 只读快照冻结脚本）通过**。零付费；未提交；快照 / 旧 work / qa-report 零改动。

## 1. 红：改动前的缺陷

[00-stage-a-facts.md](00-stage-a-facts.md) §5 记录（HEAD `f0411e6`）：

- `mechanic-probe.mjs` 只有 collect-pickup / open-chest / avoid-danger；`--only hazard-contact` 会 exit 2（不认识）。
- `READ_STATE.hazards[*]` 只有几何/相位，没有命中计数；`hitHazard()` 只复位、不计数。
- 现有 hazard 测试是源码文本判据或猴子补丁旧实现，不是当前实现的正向用例。

⚠️ 诚实说明：实现与测试在同一会话完成，没有保留改前代码的独立失败运行日志；红状态由上述 file:line 事实与新增 witness/probe 断言固定。

## 2. 绿：实现内容

- `packages/demo/src/shell/scene.ts`：hazard 条目新增 `hits`；overlap 时 `hazard.hits += 1` 后再 `hitHazard()`（复位语义不变）。
- `packages/demo/probe/probe-harness.mjs`：`READ_STATE.hazards[*].hits`；`slimState` 同步保留 `hits`。
- `packages/demo/probe/mechanic-probe.mjs`：新增 `hazard-contact`：
  - 合成 config：玩家 spawn x=40、pickup x=80（objective 需要至少一件收集物）、静止 hazard x=160、无 danger；
  - 按住右键走进 hazard；命中后松开再采一帧；
  - 断言：`hits >= 1`、玩家离开过 spawn、命中后出现一帧回到 spawn（±5px）。
- `packages/contracts/src/vocabulary.ts`：`QA_PROBED_MECHANICS` 加入 `hazard-contact`（probe 清单与闭集同源）。
- `packages/demo/tests/shell-mechanic-witness.test.ts`：新增源码 witness（`hazard.hits += 1` + `hits: h.hits ?? 0`）。
- **不扩** Playtest 事件闭集、场景 schema、证据完整性规则、MCP（票 03 裁定）。

## 3. E3：生产 probe

命令（cwd = 仓库根）：

```
node packages/demo/probe/mechanic-probe.mjs --only hazard-contact \
  --out .scratch/p0-02-second-demo-v2/runs/09-probe-hazard
```

- 退出码 **0**；耗时 2s；Chrome 156.0.8078.48；证据 `runs/09-probe-hazard/`
- 结果：`hazard-contact` passed；`hazardHits=1`；命中后 x 回到 40（spawn）；无 console/异常。
- 全量 probe（4 条）同样 exit 0 / 11s：`collect-pickup · open-chest · avoid-danger · hazard-contact` 全绿（`runs/09-probe-all/`）。
  - 这是 `pnpm test:mechanic` 的语义等价运行；为遵守「产物只写本 effort」，显式用 `--out` 指向本 effort，未写旧 `.scratch/intent-to-mechanics-v1/runs`。

## 4. E3：只读快照冻结脚本

脚本：`.scratch/p0-02-second-demo-v2/tools/hazard-contact-frozen.mjs`（复用 `probe-harness.mjs`）

```
node .scratch/p0-02-second-demo-v2/tools/hazard-contact-frozen.mjs
```

- 输入：只读快照 `.scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/`（pack v1 + 原样 `run/v1/game-config.json`）
- 退出码 **0**；耗时 9s；证据 `runs/09-hazard-contact-frozen/summary.json`
- 结果：`mode=frozen-config`；spawn x=40；maxX=353.5（进入 patroller-1 巡逻带 340–440）；`hazardHits=1`；`resetObserved=true`；87 个采样；无失败。
- 快照零改动：脚本运行前后逐文件哈希聚合均为 `5730d4a695c1a42fdcd88b098f0ae608df4218ceaae6308114bb4cc437cbf5dd`（`snapshotUnchanged=true`）。
- 诊断变体 `--diagnostic` 已实现但**未使用**：原样冻结 config 已确定性触发，符合票 03「优先原样」的要求。

## 5. 回归

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm test` | 0 | 150 文件 / **2249 tests** 全绿（含新增 witness） |
| `pnpm typecheck` | 0 | 全部 package 通过 |
| 生产 probe 全量 | 0 | 4/4 通过（`runs/09-probe-all/`） |
| 冻结脚本 | 0 | 命中 + 复位 + 快照零改动 |
| 历史证据验收（`--out` 本 effort） | 0 | 223 文件 / 13 records / 诊断 0 |

## 6. 历史与零付费

- 阶段 A 可写副本 `run/v1/qa-report.json` sha256 仍为 `dc20e3013044ddac0f9dc6c720384945448628dd628db369da4d6b98d66c5ee6`（未改）。
- 只读快照逐文件哈希未变（见上）；旧 work 未触碰。
- probe 只用本地 Chrome + last-train 夹具；冻结脚本只读快照；零付费。
- 未提交、未推送。

## 7. 变更文件

- `packages/demo/src/shell/scene.ts`
- `packages/demo/probe/probe-harness.mjs`
- `packages/demo/probe/mechanic-probe.mjs`
- `packages/contracts/src/vocabulary.ts`
- `packages/demo/tests/shell-mechanic-witness.test.ts`
- `.scratch/p0-02-second-demo-v2/tools/hazard-contact-frozen.mjs`（effort-local）
