# 06. 管线接线 + 包注册 + compile 逻辑入口

Type: task
Status: open
Owner: —
Blocked by: 01, 02, 03, 04, 05
Map: ../map.md

## Question

把 `VisualDesignCompiler` 接进现有 `create` 链，并完成新包的注册。**先核对实际配置，再动手**（用户 Q4 点名：
「避免把注册点误认为只有三处」）。

- **包注册** ✅ **已由票 02 完成**（建包目录 + 自己的 `package.json`/`tsconfig.json`/`tsconfig.spec.json` + root
  `references` 加 `packages/visual-design` + `check-deps.mjs` `ALLOWED` 加 `visual-design: ["@game-maker/contracts"]`，
  只依赖 contracts）。本票**不需再注册**，开工时核对 `pnpm check:deps` + `pnpm build` 仍绿即可，然后做**管线接线**（下面）。
- **逻辑入口（不挂 CLI）**：导出 `VisualDesignCompiler.compile(input): Promise<CommandResult>`（`packages/visual-design/src/index.ts`），
  编排 `layoutVds` → `serializeVds` → `renderVds` → `validateVds`（票 02–05），返回 `CommandResult`
  （`contracts/src/command.ts:13-20`）。CLI 独立命令**不加**（Q7）。
- **管线接缝**：在 `runUnderstanding` 的 `say("character-dna")`（`create-game.ts:355`）之后、`say("recipe")`
  （`create-game.ts:365`）**之前**插入一步：读 `run.tmpDir/game-design.json` + `run.tmpDir/visual-world.json`，
  写 `run.tmpDir/visual-design.json` + `run.tmpDir/visual-design/{svg,preview}/`。**不调用 `commitRun`**（已有的
  `commitRun` `create-game.ts:390` 单次 `renameSync` 原子落，`visual-design/{svg,preview}/` 子树免费继承原子提交 +
  「失败不占号」，`run.ts:75-94`/`:108-117`）。失败 = throw `CommandError`（`EXIT.invalid`），走既有 catch →
  `abandonRun`（`create-game.ts:411-438`）。
- **RUN_ARTIFACT 加键**（`artifacts.ts:14-26`，现 **10** 键，不是锁定文档写的「9」）：加 `visualDesign`
  ("visual-design.json") 等；`visual-design/{svg,preview}/` 子树无需注册（骑 `renameSync`）。
- **不许动**（`visual-design-v1` 票 02/PRD §9.2）：`resolveRoute`（`assets/src/route.ts:80`）、`source.kind`
  （`contracts/recipe.ts:143`）、`GameConfigSchema`（`EntityKind` 封闭枚举 `game-config.ts:50`）、原子提交规则、
  `pack` 语义。**旁轨不闸**：不改 `site`/`pack` 消费 VDS。

**测试**：接线后 `create` 一条合成 run（构造输入）产出 `run/vN/visual-design.json` + `visual-design/{svg,preview}/`；
失败路径不占版本号（`abandonRun`）；`pnpm check` 全绿。
