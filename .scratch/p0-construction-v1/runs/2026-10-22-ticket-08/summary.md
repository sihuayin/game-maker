# 票 08 · P0-02a · QA 跑满 6/6 —— 验证记录（2026-10-22）

## 变更范围（Q5 逐项清单已获逐字批准）

1. `packages/contracts/src/qa.ts`：`QaContext` 增必填 `viewport: { w, h }`；`qa-report/v1` 字段未动。
2. `packages/contracts/src/layer-coverage.ts`：新增 `backgroundLayerEntries()` 与 `BackgroundAssetLayers`
   （config 侧入参的唯一来路）；`assets/src/ops.ts` 的私有同名函数删除、改调共享实现。
3. `packages/pipeline/src/create-game.ts`：`QaContext.viewport = input.viewport ?? DEFAULT_VIEWPORT`
   （与 `compileRuntime` 同值）。
4. 新增 `packages/qa/src/layers.ts`：合成器直接跑第六条判据（仍不属于任何族）。
5. 测试 / 文档同步（见下）。

未改：CLI flag、MCP 参数、`qa-report/v1` 字段、依赖、v7 包 / `fixtures/`、`game-maker.local.json`。

## 命令与结果（E3）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm typecheck` | 0 | 9 个包全绿 |
| `pnpm test` | 0 | **115 test files / 1779 tests passed**（本票前 1772） |
| `pnpm check:deps` | 0 | 依赖图合法（9 个包） |
| `pnpm build` | 0 | `tsc -b` + 三份 bundle 全绿 |
| `npx vitest run packages/qa/tests/assemble.test.ts packages/qa/tests/layers.test.ts` | 0 | 11 + 6 通过 |
| `npx vitest run packages/pipeline/tests/create-game.test.ts` | 0 | 48 通过 |
| `npx vitest run packages/cli/tests/cli-create.test.ts` | 0 | 33 通过 |

## 6/6 证据

- `qa/tests/assemble.test.ts`：干净 fixture（`fixtures/packs/last-train/v2` + `fixtures/game-configs/last-train.json`，视口 480×270）
  ⇒ `checked` 六条、`qaVerdict === "pass"`、`failures === []`。
- `qa/tests/layers.test.ts`：正例 0 finding；把 `bg-dusk-halt.sky` 视差改成 0.5 ⇒ 1 条
  `{ target: "bg-dusk-halt.sky", severity: "error" }`；换 960 宽视口同层再响（证明视口真的被用上）。
- `qa/tests/assemble.test.ts`：「删掉 runner 必红」源码见证（`assemble.ts` 必须调
  `layerCoverageJudgement(ctx)` 并把结果挂到 `"layer-coverage"`）。
- `pipeline/tests/create-game.test.ts`：默认合成器的一次干净构建 ⇒ `checked=6`、`pass`。
- `cli/tests/cli-create.test.ts`：`create --yes` 人类行 ⇒ `6/6 条由 QA 跑过（裁决 pass）`，且不再出现「没跑的：…」。

## 诚实边界

- `layer-coverage` 在链上**恒绿**（`compile-runtime` 在同一个 `auditLayerCoverage` 的 error 上就抛）；
  本票证明的是「它真跑了、坏输入会响」，不是「链上会红」——坏例子只能由手工改包构造。
- 未跑 `pnpm test:playable`（浏览器依赖，归票 10 / 票 11）。
- 未提交、未推送（Q4）。
