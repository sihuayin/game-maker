# 06. 管线接线 + 包注册 + compile 逻辑入口

Type: task
Status: resolved
Owner: claude (2026-10-25 · resolved)
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

## Answer

已落码（2026-10-25）：

- **依赖边**：`pipeline → visual-design`（`check-deps.mjs` ALLOWED + `pipeline/package.json` + `pipeline/tsconfig.json`
  references）。包注册（package.json/tsconfig/root references/check-deps）票 02/04 已完成，本票只补这一条边。
- **`compile.ts`**：`compileVisualDesign(input): VisualDesignOutput` —— **纯计算**（`layoutVds → serializeVds →
  renderVds → validateVds`），validator 判据不过抛 `CommandError("invalid")`（定位到阶段+对象）。**不写盘**
  （序列化只此一处 = pipeline 的 `jstr`/`writeJson`），返回 `{vds, svg, png}` 交 pipeline 落盘。
- **接线（`create-game.ts`）**：在 `say("character-dna")` 后、`say("recipe")` 前插一步 —— 读 `design.spec` +
  `world.spec`，`viewport: DEFAULT_VIEWPORT`（480×270），写 `visual-design.json` + `visual-design/svg/scene.svg` +
  `visual-design/preview/scene.png`（`encodePNG`）。**不调 `commitRun`**（骑现有单次 rename 原子落 + 失败不占号）；
  `UNDERSTANDING_STEPS` 5→6（加 "visual-design"）；`UnderstandingPaths` 加 `visualDesign`。
- **`RUN_ARTIFACT`** 加 `visualDesign` 键（"visual-design.json"）。「文件清单」§8.1 #8 **结构上成立**：每个文件都由
  `writeJson`/`writeFileSync` 写、失败即抛，故「写成功」=「文件全在」，无需另加 fs 存在检查。
- **连带修正 `create-game.test.ts` 3 处**：2× run 目录里 `visual-design/` 目录被当文件读（EISDIR）→ 顶层文件比时跳过；
  1× 理解段进度 5→6 步。
- **验证**：`compile.test.ts` 1/1（wasteland 真夹具编排产出三者一致）；`create-game.test.ts` 49/49；全仓 **1922/1922**；
  `check:deps` + `build` + `typecheck` 绿。
