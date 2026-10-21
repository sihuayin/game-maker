# 04. W4 QA 真实判定能力

Type: research
Status: resolved
Owner: claude（2026-10-20 认领 · research 子代理）
Blocked by: —
Map: ../map.md

## Question

建立 QA 能力矩阵，至少区分 8 个维度：

| 维度 | 必须回答 |
| --- | --- |
| Contract / Schema | 只验证结构，还是也验证跨字段业务约束？ |
| Intent QA | 能否发现实体 / 机制缺失及近似替代？判据是什么？ |
| Design QA | 能否验证设计对意图的覆盖，而非只检查文本相似？ |
| Asset QA | 是否验证文件、帧、尺寸、引用与资源清单一致？ |
| Visual QA | 是否实际比较生成结果与参考风格？比较对象、阈值、误报边界？ |
| Gameplay QA | 是否真实启动游戏并执行输入？验证目标 / 失败 / 胜利 / 关卡可达？ |
| Integration QA | 是否验证资源被 GameConfig 正确引用并进入最终 Demo？ |
| Publish Gate | 哪些 finding 会阻断成功退出或正式发布？ |

每个 QA 族列出：入口与实现文件、finding 生成条件、severity / blocking 规则、
CLI 与 MCP 是否一致、正例与负例测试、尚未覆盖的维度。

**硬边界**：不得把「存在 Visual QA 模块」等同于「视觉一致性已被验证」；必须证明它读取了
正确输入与真实产物，并且结果影响验收 / 退出码。

## 验收

矩阵明确区分静态检查、真实视觉检查、真实玩法检查、发布阻断；每条结论有路径、行号或测试依据。

## 边界

- 只读；零付费；不改 `packages/qa` 或任何源码；只写 `research/w4-qa-capability.md`。
- 可运行本地免费测试与 `verify` / `inspect` / `review`；不得触发付费上游。

## 产出

`research/w4-qa-capability.md`：8 维矩阵 + 阻断规则表 + 未覆盖维度 + `## Answer`。

## Answer

研究文件（8 维矩阵、阻断规则表、逐族入口/finding/severity/测试、未覆盖维度）：[../research/w4-qa-capability.md](../research/w4-qa-capability.md)

关键结论（基线 `v2-foundation` / `ea53240`，只读、零付费）：

1. **自动 QA 只跑 6 条判据里的 5 条**：`layer-coverage` 不归任何族，`checked` 恒 5/6、`qaVerdict` 恒 `incomplete`；闸门只看 `failures` 里的 `error`，不看 verdict。（E1 + E2：`contracts/src/qa.ts:109`、`qa/src/assemble.ts:89`、`pipeline/src/create-game.ts:215-226`）
2. **Visual QA 模块存在，但不读图片、不读参考风格**：`visualQaRunner` 只解析 recipe / manifest / drawlist JSON；`packages/qa` 依赖白名单只有 `contracts`。把「有 Visual QA」当成「视觉一致已验证」是错的。（E1：`qa/src/visual.ts:84-174`、`qa/package.json:13-14`、`scripts/check-deps.mjs:24`）
3. **真实视觉比较只有付费、人工、非阻断的 `review`**：`reviewPack` 确实把联系表 + 原图一起喂模型，但不在创建链、无阈值、无评分、永不阻断，且**从未真跑过**（实验记录自白「没量」）。（E1 + E2；E3 absent：`assets/src/review.ts:100-170`、`pipeline/src/review.ts:4-7`）
4. **免费 `inspect` 读真实 PNG，但结果只进 `observations`**：真实包 `player-scavenger.run` 长宽比差 **+52.4%** 仍退出 0；另一真包 41 个色板外像素也退出 0。观察不阻断有 E3。（`assets/src/ops.ts:1900-1945`、`qa/src/assemble.ts:97-100`；本次免费 `inspect` / `verify` 均 EXIT 0）
5. **Intent / Design 覆盖是 id 级集合差，不是语义**：实体按 `type` 落桶、机制按 id；同一 id 填更弱的 `mechanic` 能过；文本相似被实测证伪后故意砍掉。Design QA 没有独立族，R12 拒绝只在生成前做 schema/相机/机制/覆盖检查。（E1 + E2：`contracts/src/intent-coverage.ts:110-131`、`game-design/src/build-design.ts:132-181`）
6. **Asset QA 不验证文件/checksum/真实帧尺寸**：只对账 spec ↔ manifest 元数据（kind/标称尺寸/动画名与帧数/viewBox）；`verifyPack` 是唯一 checksum 闸，但 `runBuild` 不调用它。（E1 + E3：`contracts/src/audit.ts:45-83`、`assets/src/ops.ts:1662-1730`）
7. **Gameplay QA 不启动游戏、不发输入**：`auditReachability` 是上界 BFS，只报够不到的终点/拾取物；输入、碰撞、胜利/失败、危险物均不验证。真实可玩性只有一次人工 CDP 记录。（E1 + E3 人工：`contracts/src/reachability.ts:44-225`、`.scratch/asset-integration-v1/runs/2026-10-20e-site/site-report.md`）
8. **发布阻断只在 `create --yes` / `build` 成立**：QA error → 报告先落盘再抛 → CLI 退出 4、站点不产；无 `failed-*`、无 `failureDir`，`run/pack` 保留。（E2：`create-game.ts:215-226,543-544`、`cli/tests/cli-create.test.ts:409-420`）
9. **发布门可被 `site` / `assemble_site` 绕过**：两者都不读 `qa-report.json`、也不跑 `reachability`；而 reachability 是 QA 独有判据。一个「终点够不到」的 config 过得了上游业务校验，QA 失败后仍可手工装配站点。（E1 + E2：`cli.ts:575-591`、`mcp/src/server.ts:318-326`、`cli-create.test.ts:365`）
10. **CLI/MCP 判定同源、呈现不同**：CLI 打 inspect 摘要，MCP 明确不打；MCP 无 `build` / `review` 工具，但同样可用 `assemble_site` 绕过 QA；MCP 的 QA 失败路径无测试。（E1 + E2：`cli.ts:316,354,402-426`、`server.ts:44-62,295-296`、`mcp/tests/create-game-no-digest.test.ts:127-129`）

证据缺口：没有归档的真实 QA 失败 run（阻断只有 E2）；三份归档 `qa-report.json` 均早于 inspect 接线；视觉相似度没有 E3；MCP 失败路径与 `site` 绕过均无测试。
