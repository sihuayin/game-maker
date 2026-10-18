# 08. Phase 1 测试基准与固定废土输入

Type: task
Status: resolved
Owner: claude (2026-10-18 · 人裁离线；第五轮已收口，见 [14](14-round-5-rulings.md))
Blocked by: —
Map: ../map.md
> PRD §9 的测试要求；本票把「跑什么、用什么输入、记录什么观察」钉死。不跑付费上游。

## Question

1. **单元**：三路线各有正例；同一规格 + 能力重复运行 route 稳定；无合法路线明确失败；
   非法 `source.kind` 在 plan 前被拒；模型候选不能绕过 resolver。
2. **集成**：固定废土横版输入（现有 `run/v1` 的 design/VWS + 手写 import fixture）；
   每项资源有合法路线；pack 能执行三路线；产物可被 verify/后续 config 读取；
   失败能定位到资源与阶段。
3. **回归**：assets / CLI / MCP / pack / 旧 Recipe / 塔防分派不变；`check-deps`、类型检查、全量测试。
4. **观察不阻断**：图像宽高比等观察值记录，不作为本阶段阻断判据；不引入 QA 分数。
5. **记录**：路线分布、成功/失败、失败原因，作为观察数据。

## 本轮要定（测试基准细节）

- **固定输入从哪来**：把废土横版的设计/VWS/Recipe 复制到 `fixtures/e2e/wasteland-platformer/`，
  还是直接读 `.scratch/.../run/v1`？import fixture 的 PNG/Recipe 放哪？
- **测试落点**：resolver / sidecar / capability 的单元测试放 `packages/assets/tests/` 还是 `packages/contracts/tests/`？
  sidecar 的 schema 是新契约（`contracts/src/asset-plan.ts`）还是 assets 内部？
  集成测试放 `packages/pipeline/tests/`，CLI/MCP 退出码放各自包？
- **用例清单**：8 个 reason code、硬信号顺序、冲突、候选平局、无路线、能力缺失、import 可/不可访问、
  九宫格/非九宫格 UI、确定性（N 次同输入）、sidecar 一致性、旧 Recipe 无 sidecar、失败无 sidecar。
- **观察基线**：废土 fixture 的路线分布（预期 4 image / 6 drawlist）如何记录为观察而非门禁；
  宽高比等观察值如何记录；不引入 QA 分数。
- **旧测试意图改写**：`plan-assets.test.ts:180` 从「提示词不写死 route」改为「最终 route 由 resolver 决定」。
- **零付费**：只用 fake transport / fake generator / 手写 Recipe；不跑 live 上游。


## 第五轮裁定（收口，见 [14](14-round-5-rulings.md)）

- fixture：复制 e2e 的 design / VWS / DNA / recipe 到 `fixtures/e2e/wasteland-platformer/`；另建小型 import fixture；测试不读 `.scratch`。
- 落点：resolver / sidecar / capability 在 `packages/assets/tests/`；集成在 `packages/pipeline/tests/`；CLI/MCP 各自；契约在 `packages/contracts/tests/`。
- sidecar：新契约 `packages/contracts/src/asset-plan.ts`（`asset-plan/v1` + `parseAssetPlan`），不改 Recipe Schema。
- 用例：12 组 + N=20 确定性 + sidecar Schema 专项；改写 `plan-assets.test.ts:180`。
- 观察：路线分布 / 宽高比 / 失败原因只观察；门禁仅合法性 / 能力 / ref / sidecar 一致性 / 确定性 / 错误分类；无 QA 分数。
- 零付费：fixture + fake transport/generator + 手写 Recipe；不跑 live 上游。
