# hazard 正向断言实施

Type: task
Status: resolved
Blocked by: 01, 03

## Question

按票 03 的裁定实施 `hazard-contact` 的真实正向断言。最低不变量：

1. **先红**：固定两条当前缺失的事实 ——
   - `node packages/demo/probe/mechanic-probe.mjs --only hazard-contact` 当前 exit 2（不认识该 probe）；
   - `READ_STATE.hazards[*].hits` 当前不存在。
   用可复现测试/脚本记录这两点为红。
2. **实施（probe-only）**：按票 03 裁定 ——
   - `packages/demo/src/shell/scene.ts` 给 hazard 条目加命中计数，overlap 时递增；
   - `probe-harness.mjs` 的 `READ_STATE` 暴露 `hazards[*].hits`；
   - `mechanic-probe.mjs` 新增 `hazard-contact`（合成 config：玩家 spawn x=40、静止 hazard x=160、无 danger；按住右键走进 hazard）；
   - `QA_PROBED_MECHANICS` 加入 `hazard-contact`，保持 probe 清单与闭集一致。
   **不改** Playtest 事件闭集、`runner.mjs` / `observe.mjs` 事件推导、场景 schema、证据完整性规则。
3. **冻结 Demo 脚本**：在 `.scratch/p0-02-second-demo-v2/tools/hazard-contact-frozen.mjs` 新增 effort-local 脚本，复用 `probe-harness.mjs`；以**只读快照**为 pack/config 输入，装配与产物写本 effort `runs/`；原样冻结 config，按住右键至进入巡逻带（x≈360–380）或已命中，松开等待一个 3s 周期；断言 `hazards[0].hits >= 1`、命中后 `x` 回到首帧 ±5px、无 console 错误。仅当实测相位不可控时才可用诊断变体，并在证据中标记偏离原因。
4. **测试**：probe 清单/闭集一致性测试；hazard 命中计数的运行时 witness 测试；不改场景 schema，故不新增场景测试。
5. **真实证据（零付费）**：
   - 生产 probe：`pnpm build && node packages/demo/probe/mechanic-probe.mjs --out <本 effort runs/03-probe>`（至少 `--only hazard-contact` 一次 + 全量一次）；
   - 冻结脚本：对只读快照运行，记录命令、退出码、输出路径、Chrome/shell/pack 身份；
   - 快照运行前后逐文件 sha256 复核；诊断碰撞不进正式交付证据清单。
6. **回归**：目标测试 + `pnpm typecheck` + `pnpm test:mechanic`。

产物：代码 + 场景 + 测试 + `research/09-hazard-assertion-evidence.md`。未获票 03 裁定前不开工。

## Answer

**2026-10-30 实施收口。** 证据：[research/09-hazard-assertion-evidence.md](../research/09-hazard-assertion-evidence.md)。

### 实现（probe-only，票 03）

- `scene.ts`：hazard 条目新增 `hits`，overlap 时 `hazard.hits += 1` 后再 `hitHazard()`（复位语义不变）。
- `README_STATE` / `slimState`：暴露 `hazards[*].hits`。
- `mechanic-probe.mjs`：新增 `hazard-contact`（spawn 40、pickup 80、静止 hazard 160、无 danger）；断言 `hits>=1`、离开过 spawn、命中后回到 spawn（±5px）。
- `QA_PROBED_MECHANICS` 加入 `hazard-contact`；probe 清单与闭集同源。
- **不扩** Playtest 事件闭集、场景 schema、证据完整性规则、MCP。

### 证据

- 生产 probe `--only hazard-contact`：**exit 0 / 2s**，hazardHits=1、复位到 40；全量 4/4 exit 0 / 11s。
- 冻结脚本（只读快照 + 原样冻结 config）：**exit 0 / 9s**，mode=frozen-config，maxX=353.5，hazardHits=1，resetObserved=true；快照哈希前后一致（`5730d4a6…f5dd`），未使用诊断变体。
- `pnpm test` 150 文件 / **2249 tests** 全绿；`pnpm typecheck` exit 0；历史证据验收 exit 0。
- 阶段 A 副本 `qa-report.json` sha256 未变（`dc20e301…5ee6`）；零付费、未提交。

### 已知限制

- probe 使用 last-train 夹具与合成 config；冻结脚本用只读快照的原样 config，已确定性触发 patroller-1。
- `pnpm test:mechanic` 默认会写旧 effort 目录；本轮用 `--out` 指向本 effort 做语义等价运行，未写历史。
