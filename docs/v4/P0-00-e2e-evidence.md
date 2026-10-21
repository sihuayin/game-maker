# P0-00 真实产物与 E2E 证据

| 属性 | 内容 |
|---|---|
| 审计基线 | `v2-foundation` · `ea53240`（2026-10-20） |
| 当前 HEAD（写作时） | `7aa98d7` |
| 证据来源 | [W6 调研](../../.scratch/p0-00-audit/research/w6-e2e-evidence.md) · 运行目录 [runs/2026-10-20a-head-replay](../../.scratch/p0-00-audit/runs/2026-10-20a-head-replay/) |
| 视觉裁定 | [08. 视觉对照裁定](../../.scratch/p0-00-audit/issues/08-visual-comparison-rulings.md) |
| 相关交付物 | [能力差距表](P0-00-capability-gap-audit.md) · [调用链](P0-00-call-graph.md) · [测试矩阵](P0-00-test-matrix.md) · [P0 范围](P0-00-p0-scope.md) |
| 付费调用 | **0**（无生图、无文本上游、无 `review`） |

> **结论先行**：HEAD 下游零付费重放**可玩**（需要状态感知输入）；归档的完整链路单跑站点**不可玩**；
> **没有一次在 HEAD 上从「风格图 + 意图」到可玩 Demo 的单跑**。不得宣称 HEAD E2E 已通过。
> 一次性付费 E2E 已由 Q8 裁定为 P0 最终验收门，须另立票、出书面预算、逐次授权。

## 1. 环境与基线

| 项 | 值 |
|---|---|
| 分支 / HEAD | `v2-foundation` / `ea53240398058fb2dd90366f4013d8c5a0609aa6` |
| 工作树 | 脏（`CONTEXT.md` 已改、`docs/v4/` 未入库、`.scratch/` 未跟踪） |
| 系统 | macOS 15.7.9（24G830） |
| Node | v22.23.2 |
| Chrome | 155.0.8059.85（headless + CDP 9222） |
| 本地服务 | `python3 -m http.server` |
| 构建 | `pnpm build` → **exit 0**（重建 dist，未改源码） |
| 付费调用 | **0**（无生图、无文本上游、无 `review`） |

## 2. 归档真跑清点（上游 E3）

所有路径相对 `.scratch/game-maker-v2/experiments/e2e-wasteland/raw/`。

| 运行 | 命令 | exit | 结果 | 产物 |
|---|---|---|---|---|
| a | `create` | 4 | 上游空入参；3 次尝试；29.7s | `run-2026-10-17a.json` |
| b | `create` | 0 | 10 资源清单；预计 11 张生图 | `run-2026-10-17b.json` · `run-out-2026-10-17b/` |
| c | `build` | 1 | `enemy-wasteland/patrol` 声明 4 帧只检出 1 块 | `run-2026-10-17c.json` · `run-out-2026-10-17c/` |
| **d** | `build`（段 B 重跑） | **0** | **251.0s · pack → config → qa → 站点**；10 资源 / 43 文件；`qa-report.failures: []` | `run-2026-10-17d.json` · `run-out-2026-10-17d/` |

### 2.1 commit 漂移（Q2 裁定：必须标注）

- 运行现场**没有记录 sha**。当天提交：`d8bda90`（20:47 · 第二十跑跑通）→
  `bf3e11f`（21:25 · 背景层按锚点落位）→ `a3ac8d8`（22:09 · 实体交互绑回真玩家 + 危险物按锚点落位）。
- 审计基线 `ea53240` 比这些晚三天；当前 HEAD `7aa98d7` 又晚一天。
- 第二十跑**当时没有在浏览器里打开**（票 23 的结果节明确写着「站点没有在浏览器里打开；人眼评审不在本跑」）。
- 第二十跑的 `qa-report.json`：`checked = 5`（palette-binding / constructive-constraint /
  reference-resolution / reachability / intent-coverage），`failures: []`，`inspect` / `review`
  两条 observation 均为 `unavailable`。**没有 `layer-coverage`**，也没有 verdict 字段。

> 因此：归档只能证明「那条链曾经产出这些文件/这些结果」，不能证明 HEAD 的当前行为。
> 上游 E3 必须与 HEAD 下游重放（§3）分开引用。

## 3. HEAD 下游零付费重放（E3）

### 3.1 命令与退出码

```bash
pnpm build                                                            # exit 0
node packages/cli/dist/cli.mjs verify  <pack v7>                      # exit 0 · 157 个 checksum 全对
node packages/cli/dist/cli.mjs inspect <pack v7>                      # exit 0 · 19 资源 / 4 图集
node packages/cli/dist/cli.mjs site    <pack v7> --config <手写 config> --out <run>/out  # exit 0
python3 -m http.server 8766 --bind 127.0.0.1 --directory <run>/out/ruin-scavenger-extraction-assets
# Chrome headless + CDP 9222；node play.mjs <run>
```

- 包：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
- config：`.scratch/asset-integration-v1/runs/2026-10-20e-site/game-config.json`
  （**手写，不是 `compile-runtime` 输出**）
- 站点：`<run>/out/ruin-scavenger-extraction-assets/site/v1/` · `site.json` = `{shell:"2", pack:"v7"}`
- 装配校验：三族 + 第四族（几何）+ 第五族（HUD 屏幕空间）全过。
- 引用完整性（脚本核对）：config 引用 **19 / 19** 个资源，`missing=[]`、`unused=[]`。

### 3.2 核心循环（成功样例）

状态由 CDP 注入的 `Phaser.Game` 捕获钩子读取（只读，不改源码）：

| 事件 | 时间 | 位置 / 读数 |
|---|---|---|
| 收集第 1 个 | t=529ms | x=85 · y=250 |
| 收集第 2 个 | t=2353ms | x=250 · y=215.8 |
| 收集第 3 个 | t=4312ms | x=405.5 · y=174.3 |
| **获胜** | **t=5990ms** | **x=557 · y=193 · collected=3 · won=true** |

- 最终：3 / 3 pickup 全部 `active=false`，HUD 三个 pip 点亮，画面出现「到达终点」。
- 重置次数：0；单次跑完（`play-trace-success.json`）。
- 截图：`10-run-start.png` · `11-collected-{1,2,3}.png` · `13-gap-crossed.png` · `14-near-end.png` · `15-won.png`。
- ⚠️ **朴素定时输入跑不通**：第一次盲开（按住右 + 固定时刻跳）卡在 x≈124 的固体台阶；
  后续盲开漏掉空中的第 3 个 pickup、并在危险物上重置。成功那次用的是**状态反馈**
  （读 x / y / onFloor / blockedRight / collected 后决定何时跳）。→ P0 smoke 必须用状态感知输入，
  不能只写死按键时序（`CAP-QA-07`）。

## 4. 失败样例（E3）：危险物重置后掉穿地面

- 驱动：`repro-hazard.mjs` · 轨迹：`hazard-repro-trace.json` ·
  截图：`hazard-repro-03-reset-1.png`、`hazard-repro-07-fell-through.png`。
- 序列：从木箱顶（y≈202）起跳 → 在空中 x≈393 撞上 `hazard-terrain` → `hitHazard()` 把玩家传回起点 →
  **重置后位置 x=52 · y=262.5（已低于地面顶 250），`onFloor=false`** → y 持续增大到 413+，
  再也回不到地面；`collected=3`、`won=false`。
- 源码：`packages/demo/src/shell/scene.ts` 的 `hitHazard()` 只调
  `player.setPosition(world.player.at.x, world.player.at.y)`，没有 `body.reset()` /
  把速度与物理体重同步；在空中或站在固体上被重置时，物理体被放进地面以下，分离逻辑救不回来。
- W5 类别 8 没有任何启动 / 输入测试覆盖这一条。→ P0 修复项（`CAP-RUNTIME-01`），
  P0 smoke 必须有负例覆盖（§6）。

## 5. 归档完整链路站点实际可玩吗？（E3）

把第二十跑的 `site/v1/`（旧 shell，独立端口 8767）真正打开并驱动：

| 项 | 读数 |
|---|---|
| 启动 | ✅ 正常起画面；玩家可移动 / 跳跃 |
| 拾取物 | ❌ 6 个 pickup 全程 `active=true`；跑完整条世界 `collected=0` |
| 终点 | ❌ 到达 gate（x=1850 附近，最终 x=1864）仍 `won=false` |
| 背景 | ❌ 全黑（背景层没有落位） |
| 敌人 | ❌ hazard 的 y 为 `-125722`（世界外，不可见） |

- 截图：`run-d-01-start.png`（黑背景、HUD 0 pip）· `run-d-05-end.png`（玩家在终点、pickup 仍在）。
- 解释：第二十跑在 `d8bda90`（20:47）装配；之后两次提交正是修这些：
  `bf3e11f`（背景层按锚点落位）与 `a3ac8d8`（实体交互绑回真玩家 · 危险物按锚点落位）。
  所以这是**历史站点的真实行为**，不是当前 HEAD 的行为；但它证明了一件事：
  **「QA 通过 + 站点装配出来」不等于「游戏可玩」**。第二十跑当时没有打开过站点，所以这个失败没有被发现。

> 这条证据直接支撑 Q2（可玩 smoke）与 Q4（发布闸门）的 P0 裁定，不代表 HEAD 当前不可玩。

## 6. QA 结果 vs 实际观察

| 观察 | 结果 |
|---|---|
| 第二十跑 `qa-report` | `checked=5`（缺 `layer-coverage`）· `failures=[]` · `inspect/review=unavailable` |
| 第二十跑站点实际试玩 | **不可玩**（pickup 不收、背景黑、敌人世界外） |
| HEAD 重放 `site` | **不生成 `qa-report.json`**；`site` 不跑 QA（与 W4 的「可绕过」一致） |
| HEAD `inspect` | exit 0；观察到 `health-icon` 有 41 个色板外像素、若干长宽比差（如 +52.4% 的历史包），**观察不阻断** |

⇒ **QA 的通过 / 失败与实际可玩性不一致**：第二十跑 QA 全绿但站点不可玩；HEAD 重放根本没有 QA 参与。
该结论是 P0-02（发布闸门）与 P0-03（可玩 smoke）的直接依据。

## 7. 任务书 W6 的六项人工检查

| # | 检查项 | 观察（证据） | 性质 / 裁定 |
|---|---|---|---|
| 1 | 主角可辨 / 帧一致 | 玩家在 idle / run / jump 三态可见；`15-won.png` 中角色与 HUD、终点同屏 | 客观 + 用户确认 |
| 2 | 与参考图风格一致 | `reference.png` 与站点截图同为废土像素、棕灰底 + 少量橙红点缀 | **08 裁定 Q1 = (a) 整体可接受**；观察项：暗部偏重、局部细节密集 |
| 3 | 参考图未出现的新实体同世界 | `ceiling-lurker` / `wasteland-enemy` / `extraction-point` 均以同一像素语言出现 | **08 裁定 Q2 = (b)**：世界观兼容；局部缺口 = `ceiling-lurker` 剪影可读性、`extraction-point` 像素尺度与材质分块；`wasteland-enemy` 不定性为漂移 |
| 4 | 资源完整 / 引用 / 进场景 | config 引用 19/19；装配校验全过；截图可见多类资源 | 客观 |
| 5 | 移动 / 交互 / 核心循环 | **HEAD 重放：是**（3 pickup + 到达终点 + 胜利横幅）；**归档第二十跑：否**（pickup 不收） | 客观 |
| 6 | QA 与实际观察一致 | **否**（见 §6） | 客观 |

### 7.1 视觉裁定的边界（08 逐字结论）

- **整体可接受 ≠ 视觉 QA 已具备自动判断风格一致性的能力**；W4 的结论不变。
- 局部缺口交 P0 范围按影响 / 修复成本排序；**不默认触发全量资源重生成**。
- 危险物掉穿地面仍独立保留为高优先级候选，不被视觉裁定覆盖。
- HEAD 下游重放仍基于 pack v7 + 手写 config，**不能宣称 HEAD 单跑 E2E 通过**。

## 8. 新登记的缺口

| ID | 缺口 | 优先级 / 分流 |
|---|---|---|
| `CAP-RUNTIME-01`（W6-G1） | 危险物在空中/固体上重置玩家 ⇒ 玩家落到地面以下，且不可恢复 | **P0** 修正 + 补测 |
| `CAP-QA-07`（W6-G2 + W6-G6 + W5 类别 8） | 完整链路单跑可以产出「QA 全绿 + 站点存在」但不可玩；可玩性需要状态感知输入，且没有 boot / input 测试 | **P0** 新增最小 headless smoke + 补测 |
| `CAP-QA-08`（W6-G3） | `site` 与 MCP `assemble_site` 不读 `qa-report.json`、不跑 QA；HEAD 重放无 QA 记录 | **P0** 修正发布闸门 + 补测 |
| `CAP-QA-05`（W6-G4） | `inspect` 的观察值（41 个色板外像素、长宽比差）不阻断发布 | **P2**（像素完整性阈值部分进 P0，见 `CAP-QA-02`） |
| `CAP-E2E-01`（W6-G5） | **HEAD 上没有从「风格图 + 意图」到「可玩 Demo」的单跑**；可玩的 HEAD 站点依赖预建 pack v7 + 手写 config，`compile-runtime` 没有参与 | **P0 最终验收门**（Q8：另立付费票，预算 + 逐次授权） |

## 9. 证据索引

所有路径相对 `.scratch/p0-00-audit/runs/2026-10-20a-head-replay/`：

| 证据 | 文件 |
|---|---|
| 构建日志 | `/tmp/p0-build.log`（exit 0） |
| 包校验 | `verify-pack.txt`（exit 0 · 157 checksum） |
| 包观察 | `inspect-pack.txt`（exit 0 · 19 资源 / 4 图集） |
| 站点装配 | `site-assembly.txt`（exit 0 · shell 2 / pack v7 / 19 资源） |
| 成功轨迹 | `play-trace-success.json` |
| 失败复现轨迹 | `hazard-repro-trace.json` |
| HEAD 重放截图 | `10-run-start.png` · `11-collected-{1,2,3}.png` · `13-gap-crossed.png` · `14-near-end.png` · `15-won.png` |
| 失败复现截图 | `hazard-repro-01-start.png` · `hazard-repro-03-reset-1.png` · `hazard-repro-07-fell-through.png` |
| 归档站点截图 | `20th-run-site-initial.png` · `run-d-01-start.png` · `run-d-05-end.png` |
| 归档站点轨迹 | `run-d-play-trace.json` |
| 驱动 | `drive.mjs` · `play.mjs` · `repro-hazard.mjs` · `play-run-d.mjs` |
| 视觉对照 | `visual-compare/q1-reference-vs-site.png` · `q1-reference-vs-site-mid.png` · `q2-entities-vs-world.png` · `q2-ceiling-lurker.png` · `q2-wasteland-enemy.png` · `q2-extraction-point.png` |

## 10. 结论

1. **HEAD 下游重放是可玩的（E3）**：pack v7 → `verify` → `site` → CDP 驱动 → 3/3 pickup → 到达终点。
2. **但不是单跑 E2E**：上游理解/生图是归档产物；下游 config 是手写的，`compile-runtime` 未参与。
3. **归档的完整链路单跑（第二十跑）站点装配成功、QA 全绿，却不可玩（E3）**；它在运行后被
   `bf3e11f` / `a3ac8d8` 修掉，但当时的验收没有发现。
4. **危险的运行时缺陷**：空中被危险物重置 ⇒ 掉穿地面（E3，已复现）。
5. **不得宣称 HEAD E2E 已通过**；Q2 的混合证据策略成立，且比预期多发现了一条「站点成功 ≠ 可玩」的实证。
6. **下一步**：P0 修复完成后，另立付费票跑一次真正的单跑 E2E，作为 P0 的最终验收门；
   在此之前，任何「P0 全部验收通过」的说法都必须带上这条限定。
