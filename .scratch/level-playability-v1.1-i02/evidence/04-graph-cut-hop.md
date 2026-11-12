# I02-04 图割与 hop 加倍可行性实验 — 证据

| 项 | 值 |
| --- | --- |
| 票 | [I02-04 图割与 hop 加倍可行性实验](../issues/05-i02-04-graph-cut-hop.md)（task · AFK） |
| 结论 | **可行，但有方向性发现**：`forbiddenBoxes` 的“不可穿越、不提供支撑”语义成立；N1（门上平台）与 N2（门下坑道）都能绕过水平门区；`hopSamples` 的 60→120Hz 加倍**可以改变连通性结论**，且实测方向几乎总是“更密采样删除边”，边级反向翻转（更密采样恢复边）存在但很罕见。I-00 §7.2 的 hop 加倍不变性检查因此是**必需的单向护栏**。 |
| 断言 | **35 / 35 通过**（`outputs/run.json` → `summary`） |
| 证据等级 | E1（源码行号）+ E3（scratch 复跑，退出码 0） |
| 产品目录改动 | **无**（只读 `packages/contracts/dist/**`；`git status --porcelain` 与开工前一致） |
| 原始输出 | [`outputs/run.json`](../experiments/04-graph-cut/outputs/run.json) |

> ⚠️ scratch 可行性证据，不是生产验收，也不构成对 `graph.ts` 修改的授权。

## 1. 目的与边界

验证 I-02 §7.2 的第三条 PU 条件（“含 hop 边的移动图上起点与终点不连通”）所依赖的三件事：

1. `forbiddenBoxes` 注入门区后，`reach.ts` / `hopSamples` 是否按“不可穿越、不提供支撑、世界外自由”解释。
2. 水平门区是否可能被垂直路线（平台上 / 坑道下）绕过。
3. `hopSamples` 的采样密度加倍会不会改变连通性结论；若会，方向如何、频率多高。

不是：生产实现、真实 moving hazard 的时序、覆盖判定（LP-02/03）、多 Hazard 或 y 轴运动。

## 2. 输入与 SHA-256

| 输入 | SHA-256 |
| --- | --- |
| `packages/contracts/src/playability/graph.ts` | 见 `outputs/run.json → meta.sources` |
| `packages/contracts/src/playability/reach.ts` | 同上 |
| `packages/contracts/dist/playability/graph.js` | 同上（运行期实际加载的是 dist） |
| `fixtures/game-configs/last-train.json` | 同上 |
| `fixtures/packs/last-train/v2/manifest.json` | 同上 |
| `inputs/cases.json` | `6937b847ac576c11f8bffcbfec76b4d6c7dabfa505a12df2c9f2d1434dd969da` |

源码与本实验相关的常量（E1）：

- `graph.ts:79` `forbiddenBoxes` 类型；`:125-135` 外扩注入（`x0=floor(x−halfW)+1`，`y0=floor(y)+1`，`x1=ceil(x+w+halfW)−1`，`y1=ceil(y+h+pH)−1`）。
- `graph.ts:140` `standable[i] = 1` 只看 `blocked[i+1]`，不看 `forbidden` ⇒ **禁区不提供支撑**。
- `graph.ts:225-255` `hopSamples`；`:237` `n = max(6, min(120, ceil(t·60)))`；界外采样点 `continue`。
- `reach.ts:6` 禁区语义注释；`:155` mid-air 扫描按 60Hz；`:199` “世界外的采样点当自由空间”。

## 3. 环境与命令

```
darwin 24.6.0 · node v22.23.2 · 无新增依赖
cwd = .scratch/level-playability-v1.1-i02/experiments/04-graph-cut
node build-inputs.mjs   # 写 inputs/cases.json
node run.mjs            # 退出码 0；写 outputs/run.json
```

`outputs/stdout.txt`：

```
{"checks":35,"passed":35,"failed":0}
determinism.inProcess = true
measurementSha256 = e966581677c1490c3cf7b578f60cb32db9b1c2a6b7595d6b89d909c15f422124
```

## 4. 代表性几何

真夹具 `last-train`：世界 `1440×270`，玩家盒 `32×48`，脚点 `(40, 252.4)`，移动参数 `{speed: 90, jumpVelocity: 330, gravity: 900}`；`maxJumpHeight = 60.5`，`jumpSpan(move, 270) ≈ 110.13`。出生落脚点 `(40, 250)`；目标脚点按场景下表。

| 场景 | 地形（top y） | 门区 / 禁区 | 起点脚点 | 目标脚点 |
| --- | --- | --- | --- | --- |
| 基线 | 平地 `y=250` | 无 | `(40,250)` | `(1000,250)` |
| N1 | 平地 vs 门上方平台 `y=210`（`x 650..750`） | gate `{700,210,40,60}` | `(40,250)` | `(1000,250)` |
| N2 | 平地 vs 门下方坑道 `y=260`（`x 660..780`） | gate `{700,170,40,42}` | `(40,250)` | `(1000,250)` |
| N7a | 左 `y=250` 至 `x=620`；右 `y=231` 从 `x=667` | 一个薄禁区 `{648.355,208.917,0.935,6.622}` | `(40,250)` | `(700,231)` |
| N7b | 左 `y=250` 至 `x=600`；右 `y=250` 从 `x=640`（世界宽 800） | 一个薄禁区 `{614.454,205.174,1.947,6.033}` | `(40,250)` | `(700,250)` |

门区都在起点右侧，横跨地面走廊；门顶 `y=210`（N1）或 `y=170..212`（N2）。世界边界：栅格 `x∈[0,W]`、`y∈[0,270]`；栅格外 `freeAt=false`。

## 5. `forbidden` 语义（运行时核对）

门区外扩矩形实测 `{x0:685, x1:755, y0:211, y1:270}`，与手算一致。

| 检查 | 结果 |
| --- | --- |
| `freeAt(700,250)` | `false` |
| `forbidden[idx]` | `1` |
| `blocked[idx]` | `0`（**不提供支撑**） |
| `standableAt(700,210)`（hazard 顶） | `false` |
| `movementNeighbors(684,250)` | 只有 `(683,250,walk)`，无进入 685 的边 |
| `hopSamples(690,250 → 750,250)` | `null`（弧线穿禁区） |

**世界外**：小世界探针（`200×120`，地面 `y=50`，从 `(50,50)` 跳到 `(80,50)`）的抛物线有 **17 个界外采样点**；这些点被跳过，边仍被接受。若把界外点当作禁区，同一弧会被拒绝（反事实实测为真）。这与 `reach.ts:199` 的 mid-air 口径一致；但注意**栅格本身** `freeAt(-1,50)=false`，即“世界外自由”只适用于抛物线采样/覆盖扫描，不适用于落脚格 BFS。

## 6. 绕过反例（N1 / N2）

| 场景 | 平坦地形 | 有垂直绕行 | 结论 |
| --- | --- | --- | --- |
| N1 门上方平台 | 目标不可达 | 目标可达（60/120Hz 一致） | 水平门区**不是** PU 的充分条件 |
| N2 门下方坑道 | 目标不可达 | 目标可达（60/120Hz 一致） | 同上 |

N1：平台顶 `y=210`，`standableAt(650,210)=true`；玩家从地面跳上平台、走过门顶、在 `x=780` 落回地面。N2：坑底 `y=260` 与门底 `y=212` 恰好相切（严格判定下可通行），玩家下坑、从门下穿过、再跳回地面。

这两条直接对应 I-02 §6.3 的“局部封锁反例：水平门区封锁，但玩家可从上方绕行，不能判为不可玩”。PU 必须同时排除 **所有** hop / walk-off 路线，或证明门区在整张图上构成割。

## 7. hop 采样加倍：量化

### 7.1 机制

`hopSamples` 的采样数 `n = max(6, min(120, ceil(t·60)))`，采样点为 `px=round(ax+dx·f)`、`py=round(ay−(v·t·f−½g(t·f)²))`。

- 本世界最长的跳跃 `t ≈ 0.78s` ⇒ `n ≤ 47`，**120 的上限从不触发**。所以“加倍上限”在本夹具上无效；真正的旋钮是**采样率**（60→120Hz）或等价地 `n→2n`。
- 采样间距：水平 `≤ speed/60 = 1.5px`；垂直在顶点附近小于 1px、在两端最大约 `v/g·60 = 5.5px`。
- 禁区外扩矩形至少 `33×49` 个脚点格（玩家 32×48）。相对于这个尺寸，相邻采样点的位置差异很小，所以更密的采样**通常**只会增加撞点、删除边；只有在采样点恰好落在禁区角点边界上时，才可能出现反向。

### 7.2 边级翻转

定向扫描（把禁区外扩矩形的角放到一个粗采样点附近，最大化边界敏感度）：**100,000 次，95 次 forward（粗采样接受、密采样拒绝），4 次 reverse（粗采样拒绝、密采样接受）**。

- forward 例：`(635,250) → (683,246)`，禁区 `{661.568,227.139,2.216,0.962}`，外扩矩形 `{646,679,228,270}`；60Hz 接受，120Hz 拒绝。
- reverse 例：`(620,250) → (673,231)`，禁区 `{648.355,208.917,0.935,6.622}`，外扩矩形 `{633,665,209,263}`；60Hz 拒绝，120Hz 接受。

### 7.3 图级翻转

用“跨沟 hop 是否存在”作为连通性代理（两侧平台内部连通）：同高 4,000 例 + 变高 4,000 例。

| 家族 | forward（连通→断连） | reverse（断连→连通） | 两侧均连 | 两侧均断 |
| --- | --- | --- | --- | --- |
| 同高（seed 55555） | 5 | **0** | 3,936 | 59 |
| 变高（seed 777777） | 32 | **0** | 3,136 | 832 |

- **N7b（图级正向翻转，已用真实图 + 完整 BFS 复核）**：
  - 地形左 `{0,250,600,20}`、右 `{640,250,160,20}`，禁区 `{614.454,205.174,1.947,6.033}`，目标 `(700,250)`。
  - 60Hz：跨沟边 4 条，右侧可达 161 个脚点格，目标可达。
  - 120Hz：跨沟边 0 条，右侧可达 0 格，目标不可达。
  - 无禁区对照：两档均可达（792 格）。
- **N7a（边级反向翻转）**：`(620,250)→(673,231)` 在 60Hz 被拒、120Hz 接受；但图级仍有 21–22 条其它跨沟边，目标在 60/120Hz 都可达。也就是说，“单边恢复”没有转化为“图恢复”——这是 8,000 例图级扫描中 reverse 为 0 的原因：**冗余弧掩盖了单边翻转**。

### 7.4 对 I-00 §7.2 的含义（事实，不是裁定）

- 方向不对称：更密采样删边是常态（40,000 例里 37 次图级翻转全是这个方向），加边是罕见例外（边级 4/100,000）。
- 因此“hop 加倍不变性”不是对称的健全性检查，而是**单向护栏**：若 120Hz 判“不连通”而 60Hz 判“连通”，结论改变 ⇒ 必须降级为 IE；不能只跑密档就宣称 PU。反过来，60Hz 的“不连通”在密档下仍不连通是本实验的常态，但**不是定理**（边级存在 4 次反例），所以 I-00 要求两档一致是正确的保守规则。
- 这也意味着：PU 证明应尽量在**更粗**的采样上成立（玩家能力被高估的方向），Witness 应在**更密**的采样上验证（更严格的方向）。这条不对称性建议提交 D4/D8 显式裁定。

## 8. 参数化选项（只提议，未改代码）

### 8.1 当前可做的（已实现于 scratch）

`core.mjs` 的 `hopSamplesN` / `hopEdgesN` / `reachN` 与 `graph.ts` 同式，但接受 `{hz, maxSamples}`。默认 `{60,120}` 时与产品 `hopSamples` / `reachableCells` **逐点一致**（基线 1,441 格完全相同）。这说明“hop 加倍不变性”检查**不需要改产品代码**就能执行。

### 8.2 若要进入产品：最小加法式改动

```ts
export type HopSampling = { readonly hz?: number; readonly maxSamples?: number };

export function hopSamples(
  graph: MovementGraph, ax: number, ay: number, bx: number, by: number,
  move: MoveParams, sampling: HopSampling = {},
): Vec[] | null {
  // ...
  const n = Math.max(6, Math.min(sampling.maxSamples ?? 120, Math.ceil(t * (sampling.hz ?? 60))));
}

export function hopEdges(graph, x, y, move, sampling: HopSampling = {}): HopEdge[] { /* 透传 */ }
export function hopTargets(graph, x, y, move, sampling: HopSampling = {}): Vec[] { /* 透传 */ }
```

- 默认值保持现有行为，现有调用点不需要改；属于**向后兼容的尾参**。
- 但 `graph.ts` 的 hop 参数化在 I-00 中列在“需单独裁定”名单；且 `hopSamples` / `hopEdges` / `hopTargets` 是导出函数，改动触及“公共接口”审批边界（授权包第 6 项）。**授权形态必须由 D4/D6 裁定**，本实验不代为决定。
- 注意：只加 `maxSamples` 上限在本夹具上不起作用（上限从不触发）；旋钮必须包含 `hz`（或让 `n` 随倍率缩放）。

### 8.3 备选：I-02 自建证明专用采样器

- 优点：完全不动 `graph.ts`。
- 代价：`graph.ts:229-231` 明确警告“全仓只有这一处算跳跃弧”，复制一份必然漂移；`reach.ts:155` 的 mid-air 扫描也硬编码 60Hz，PU 若依赖 mid-air 结论，还需要同步覆盖。
- 结论：两条路都要 D4/D6 选择；本实验只证明“外部模拟可行”。

## 9. 对下游的事实输入（供 D4 / D8，不构成裁定）

- F1 `forbiddenBoxes` 语义成立：不可穿越、不提供支撑、门顶不是地板；世界外只在抛物线采样/覆盖扫描中按自由处理。
- F2 水平门区可被“上方平台”或“下方坑道”绕过；PU 必须证明**整图割**，不能只看地面走廊。
- F3 hop 采样加倍可以改变图级连通性结论；实测方向以“连通→断连”为主（37/8,000），反向仅见于边级（4/100,000），未见图级反向（0/8,000）。
- F4 因此 hop 加倍不变性必须**两档都跑并比较**；只跑密档会高估不可达，只跑粗档会高估可达。
- F5 采样上限 120 在本夹具（世界高 270）从不触发；参数化的旋钮应是采样率，不是上限。
- F6 外部模拟（不改 `graph.ts`）可行且与产品逐点一致；是否进入产品白名单由 D4/D6 决定。

## 10. 限制与未覆盖

- 图级扫描用“任一跨沟 hop 被接受 ⇒ 两侧连通”的代理；两侧平台内部连通，且两个具体翻转已用真实图 + 完整 BFS 复核。8,000 例计数是代理计数。
- 只测了 60→120Hz；其他倍率、非整数倍率、以及 `maxSamples` 上限未测。
- 只用 `last-train` 的玩家/移动参数；不同 `speed` / `jumpVelocity` / `gravity` 会改变采样间距与翻转频率。
- `reach.ts` 的 mid-air 世界外语义是**代码阅读**（`:199`），未执行；`hopSamples` 的界外语义已执行。
- 未覆盖真实 moving hazard 的时序（I-02 的核心），也未覆盖 `coverage.temporal`、Verdict 聚合。
- 未新增 fixture pack；未修改 `packages/**`、`dist/**`、Runtime、CLI、MCP 或公共 Contract。
- 运行期加载的是 `packages/contracts/dist/**`；其 `hopSamples` 与 `src/graph.ts:237` 的采样式已逐行核对（`n = max(6,min(120,ceil(t*60)))`）。若 dist 与 src 日后漂移，需先 `pnpm build`。

## 11. 复现方法

```bash
cd .scratch/level-playability-v1.1-i02/experiments/04-graph-cut
node build-inputs.mjs
node run.mjs || echo "failures above"
shasum -a 256 outputs/run.json
# 期望：591c40a3190c89e597c23f84b593dcc1454f4c2206de1c3b39139759d3a2d7d4
```

确定性实测：同进程两次、两个独立进程各一次，`outputs/run.json` 的 SHA-256 完全一致，stdout 逐字节相同。

| 产物 | SHA-256 |
| --- | --- |
| `core.mjs` | `b0da60be260c642515dd08d16169e521579447ec222c8a2ce05a25bdfd41ffd0` |
| `build-inputs.mjs` | `32265ad5765fdcb704093b8b1453919888f3a79cb79a099711b24927dd2dda16` |
| `run.mjs` | `e76566e5fb5bc120635cae58e017091c9db1adfd6898b7ad18867e0739eebd5f` |
| `inputs/cases.json` | `6937b847ac576c11f8bffcbfec76b4d6c7dabfa505a12df2c9f2d1434dd969da` |
| `outputs/run.json` | `591c40a3190c89e597c23f84b593dcc1454f4c2206de1c3b39139759d3a2d7d4` |
| `outputs/stdout.txt` | `68a460336b6e038bc72918b910b064fb426854f63fcbd326c9d3a36cf7a80935` |
