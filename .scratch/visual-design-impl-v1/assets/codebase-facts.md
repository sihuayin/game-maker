# Codebase Facts — Visual Design Compiler V1 (recon)

Read-only recon, 2026-10-24. Every claim carries a `file:line` citation. Line numbers refer to the
files under `/Volumes/shy/some-projects/game-maker/`. This drives the planning map for a "Visual
Design Compiler" side-track; the locked design lives in `.scratch/visual-design-v1/map.md` + `issues/*.md`.

Repo is a pnpm monorepo, `type: module`, package dirs: `packages/{contracts,assets,cli,demo,game-design,mcp,pipeline,qa,vision}`
(`pnpm-workspace.yaml` = `packages/*`).

---

## 1. GameDesignSpec shape

Defined in `packages/contracts/src/game-design.ts`. It is a **V2 contract ⇒ `zod/v4`**, sealed with
`z.strictObject` (`game-design.ts:3`, `:65`, `:124`).

- Discriminant: `format: z.literal("game-design/v1")` (`game-design.ts:71`, `:125`).
- Id = `z.string().min(1)` (`game-design.ts:74`) — **the only identity type**, open strings (not a closed enum).
- Full field structure (`GameDesignSpecSchema`, `game-design.ts:124-208`):
  - `game` (`:127-147`): `title: string.min(1)` (`:129`), `genre: string` (`:135`), `camera: string` (`:141`), `runtimeProfile: RuntimeProfileRefSchema` (`:146`).
  - `coreLoopSteps: z.array(z.string())` (`:153`).
  - `player` (`:155-160`): `{ id, role: string, abilities: string[], goals: string[] }`.
  - 4 entity buckets (`:169-172`), each item `{ id, … }`:
    - `enemies`: `{ id, behavior: string, threat: string }`
    - `npcs`: `{ id, role: string, interaction: string }`
    - `interactables`: `{ id, type: string, behavior: string }`
    - `resources`: `{ id, purpose: string }`
  - `world` (`:174`): `{ theme: string, setting: string, structure: string }`.
  - `levels` (`:176-188`): `{ id, purpose: string, layout: string, entities: string[] }` — `layout` is **free text**, `entities[]` references entity ids (resolved by gate ⑥, `:319-324`).
  - `progression` (`:190`): `{ model, description }`; `difficulty` optional (`:191`).
  - `mechanics` (`:194`): `GameDesignMechanicSchema = { id, mechanic: MechanicSchema }` (`:79-82`); `MechanicSchema` is a closed enum (`vocabulary.ts:38-61`).
  - `winConditions: string[]` (`:196`), `loseConditions: string[]` (`:197`).
  - `runtimeRequirements: z.array(CapabilitySchema)` (`:205`) — closed capability enum (`vocabulary.ts:130-149`).
  - `superRefine` gate (`:209-325`): non-empty required strings, per-item strings, id uniqueness across `player`+4 buckets (`:296-307`), `levels[].entities[]` resolves to a known id (`:319-324`).

**Critical answer — geometry:** GameDesignSpec carries **NO geometry/bounds/positions anywhere.**
Every entity field is semantic (id + free-text strings); the only "spatial" content is `levels[].layout`
(free text) and `world.structure` (free text). There is no x/y/w/h/rect/at/point in this schema.
(Geometry lives downstream in `GameConfig`, see §7.)

**Entity buckets:** exactly **4** design buckets — `enemies / npcs / interactables / resources`
(`game-design.ts:169-172`), plus `player` (`:155`) and `mechanics[]` (`:194`). The bucket names are
derived from `ENTITY_BUCKETS` (`vocabulary.ts:172-177`; intent `type` closed enum `INTENT_ENTITY_TYPES`
`vocabulary.ts:162`). **`terrain` and `objective` are NOT design-layer buckets** — they exist only in
`GameConfig` (`game-config.ts:215` `terrain`, `:203-207` `objective`). The locked design's
"`npc/enemy/interactable/resource` 由 `sourceIntent` 落桶" is consistent with this.

---

## 2. VisualWorldSpec / palette

Defined in `packages/contracts/src/visual-world.ts` (also V2 ⇒ `zod/v4`, `:49`).

- Discriminant: `format: z.literal("visual-world/v1")` (`:55`, `:161`).
- The **palette** lives at `style.palette` — a `StyleSpecShape` field (`:108`) typed `PaletteShape`
  (`:68`) = `z.array(PaletteColorShape)` with a no-duplicate superRefine (`:68-74`).
  `PaletteColorShape` = `z.string().regex(/^#[0-9a-f]{6}$/)` (`:63`) — normalized lowercase `#rrggbb`.
  **Entry shape: no name/hex/index — each palette entry is just a hex string; index = array position.**
- The **six palette buckets** (`PALETTE_BUCKETS` `:146` = `primary/secondary/accent/background/shadow/highlight`)
  hold `PaletteRef` arrays (`palette: <idx>` strings, `PaletteRefShape` `:79-81`), NOT hex values —
  "the only color source is `style.palette`" (`:194`, `:285-303` superRefine rejects out-of-range refs).
- Deterministic palette extraction: `packages/vision/src/palette.ts:162` `extractPalette(src, {size})`,
  `PALETTE_SIZE = 32` (`:19`); `applyDeterministicPalette(spec, palette)` (`:203`) rewrites `palette:N`
  refs and `style.palette`. Producer: `analyzeReference` at `packages/vision/src/analyze-reference.ts:303`.
- Written to disk as `run/v<N>/visual-world.json` by `writeVisualWorld` (`pipeline/src/artifacts.ts:58-62`),
  which also copies style reference images and rewrites `styleReferences[].path` to basenames (`:65-78`).
- Single hex-resolution helper is `paletteColor(ref, palette)` in **`contracts/src/drawlist.ts:132-135`**
  (v3 file) — this is the one place `palette:N` → hex happens (the locked design's "唯一解析处").
- Downstream readers: `planAssets` parses `visualWorldPath` via `VisualWorldSpecSchema.safeParse`
  (`ops.ts:330`) and writes `world.style` as `stylespec.json` next to the recipe (`ops.ts:524`);
  `compileDesign` reads `vws` (`game-design/src/compile-design.ts:40-41,148-149`); `compileRuntime`
  reads design only (not VWS).

---

## 3. Pipeline seam

Entry: `packages/pipeline/src/create-game.ts` (`createGame` = `runUnderstanding` + `runBuild`,
`create-game.ts:661-682`).

- `UNDERSTANDING_STEPS = ["visual-world","intent","design","character-dna","recipe"]` (`:40`).
- `BUILD_STEPS = ["pack","config","qa"]` (`:41`).
- `runUnderstanding` (`:283-439`): opens run (`openRun` `:286`), then per step:
  - `say("visual-world")` `:297` → `analyzeReference` `:312` → `writeVisualWorld` `:324`.
  - empty-palette gate `:330-331`.
  - `say("intent")` `:333` → `analyzeIntent` `:334` → `writeJson(RUN_ARTIFACT.gameIntent)` `:340`.
  - `say("design")` `:342` → `compileDesign` `:345-351` → `writeJson(RUN_ARTIFACT.gameDesign)` `:353`
    ⇒ writes **`game-design.json`** (RUN_ARTIFACT value, `artifacts.ts:18`).
  - `say("character-dna")` `:355` → `compileCharacterDna` `:356` → write `:363`.
  - `say("recipe")` `:365` → **`planAssets` `:368-375`** (file-in/file-out: reads
    `designPath = run.tmpDir/game-design.json`, `visualWorldPath = run.tmpDir/visual-world.json`,
    `outRoot: run.tmpDir` — the comment at `:366` says "规划那一步是文件进出的"). Then inject
    `characterRef` (`:380`), re-`parseRecipe` (`:381-385`), `flattenPlannerOutput` (`:387`),
    `writeJson(RUN_ARTIFACT.recipe)` `:388`.
  - `commitRun` `:390`; `abandonRun` in catch `:434`.
- `runBuild` (`:457-653`): re-reads recipe from disk (`:462-467`), `say("pack")` `:500` →
  `packAssets` `:501-514` → `verifyPack` `:526` → `say("config")` `:528` →
  **`compileRuntime` `:536-544`** (writes to a fresh `mkdtempSync(".config-")` staging dir `:533`,
  then `fs.renameSync(produced, configPath)` into `run/vN/game-config.json` `:546-548`; staging removed
  in `finally` `:549-551`). Then `say("qa")` `:564` → `runner` (default `qaRunner`) `:585-595` →
  `QAReportSchema.safeParse` + `subject` injection `:603-614` → `writeJson(qaReport)` `:619-620` →
  `assertQaPassed` `:621` → `buildMechanicCoverage` gate `:626-629`.

**How a new step is inserted:** it is a normal file-in/file-out step in `runUnderstanding` (e.g. after
`say("character-dna")` / before `say("recipe")`, i.e. before `create-game.ts:365`), reading
`run.tmpDir/game-design.json` (+ optionally `visual-world.json`) and writing into `run.tmpDir`. It does
**not** call `commitRun` — only the already-present `commitRun` at `:390` finalizes.

**How steps signal failure:** steps **throw**. The convention is `CommandError(kind, msg, opts)`
(`contracts/src/command.ts:67-88`), where `kind` maps to an exit code via `EXIT = { ok:0, failure:1,
usage:2, upstream:3, invalid:4 }` (`command.ts:46`) and `exitCodeOfError` (`command.ts:88`). Bare
`Error` throws are also used (they map to `failure`=1, `command.ts:88`). The pipeline catches, writes
attempt/failure sidecars, calls `abandonRun`, and rethrows (`create-game.ts:411-438`). There is no
process.exit in core — CLI/MCP translate to exit codes.

---

## 4. ops.ts — planAssets / compileRuntime

File: `packages/assets/src/ops.ts`.

- **`planAssets(opts: PlanAssetsOptions): Promise<CommandResult>`** — `:320`.
  - `PlanAssetsOptions` `:80-99`: `{ designPath, visualWorldPath, outRoot, transport?, fetchImpl?,
    timeoutMs?, imageTransport?, existingAssets? }`.
  - Reads+validates `game-design.json` (`GameDesignSpecSchema.safeParse`, `:328`) and
    `visual-world.json` (`VisualWorldSpecSchema.safeParse`, `:330`); empty-palette gate `:348-349`.
  - Calls upstream via R16 forced tool (`onceThroughTool`, `:385-389`), retries with
    `EMPTY_INPUT_ATTEMPTS` / `STRUCTURED_CALL_ATTEMPTS` (`:384`), gates: `parseRecipe` (`:403`),
    frames-candidate reject (`:418-427`), `designCoverageGate` (`:432`), `hudUiGate` (`:442`),
    `playerAnimationGate` (`:453`).
  - Deterministic route decision via `resolveRoute` (`:491-511`) + `sourceForDecision` (`:511-513`).
  - **Writes:** `<outRoot>/<recipeId>/recipes/v<N>.json` (`:466-467`, `:536-538`),
    `stylespec.json` (world.style) (`:524`), `reference.png` copy (`:529-532`),
    `v<N>.plan.json` sidecar (`:541-564`).
  - Returns `CommandResult` (`command.ts:13-20`): `{ command, summary[], data?, artifacts: {path, kind}[] }`
    — here `artifacts = [{path: <recipe>, kind: "asset-recipe"}, {path: <plan>, kind: "asset-plan"}]`
    (`ops.ts:572-575`).
- **`compileRuntime(opts: CompileRuntimeOptions): Promise<CommandResult>`** — `:1004`.
  - `CompileRuntimeOptions` `:920-940`: `{ designPath, packDir, outRoot, levelId?, transport?,
    fetchImpl?, viewport?, hudLineHeight?, timeoutMs? }`. `viewport` default `DEFAULT_VIEWPORT`
    (`:830` = `{w:480,h:270}`), used at `:1050`.
  - Reads design (`:1012`), resolves profile + `CONFIG_SHAPES` (`:1018-1028`), reads
    `packDir/manifest.json` (`:1030-1034`).
  - Upstream prompt `:1051-1116`; retries `STRUCTURED_CALL_ATTEMPTS` (`:1122`); `parseGameConfig`
    (`:1147`), deterministic clamp `clampToWorld` (`:1155`), model-hard audit in-loop
    `auditGameConfig`+`auditScreenSpace` (`:1159-1163`).
  - **Deterministic final audit** (no-resample, no-write): `auditGameConfig` + `auditScreenSpace` +
    `auditLayerCoverage` (`:1184-1190`); hard `error` ⇒ throw `CommandError("invalid")` **without
    writing** (`:1192-1198`).
  - **Writes:** `<out>/<manifest.id>/game-configs/v<N>.json` (`:1200-1204`). Returns `CommandResult`
    with `artifacts: [{path, kind: "game-config"}]` (`:1222`).
- `DEFAULT_VIEWPORT` `:830` ("与票 32 裁决 1 的外壳常量同值").

---

## 5. run.ts / versioning / artifacts.ts

File: `packages/pipeline/src/run.ts`.

- `openRun(outRoot)` `:60-65` — allocates `run.tmpDir = <outRoot>/.building-<pid>-<ts>` (`:61`); no
  version allocated here.
- `commitRun(run, gameId)` `:75-94` — **atomic via a single `fs.renameSync(run.tmpDir, dir)`** (`:83`)
  into `<outRoot>/<gameId>/run/v<N>`; `nextRunVersion` scans dirs for max `v<N>`+1 (`:37-46`); on
  `ENOTEMPTY`/`EEXIST` it retries the next N (`:86`). Version N is **only** allocated inside this loop.
- **"失败不占号"**: `abandonRun(run, {why, gameId?})` `:108-117` renames tmpDir to
  `<gameId>/run/failed-<ts>` (or `.failed-<ts>` when no gameId) — the version N that would have been
  used is never consumed because `commitRun` never ran. This is stated at `run.ts:73`
  ("失败不消耗版本号").
- `parseRunVersion(dir)` `:49-53`.

File: `packages/pipeline/src/artifacts.ts`.

- `RUN_ARTIFACT` `:14-26` — **10** keys (note: locked-design tickets 02/qa.ts still say "九项/9 items";
  a 10th, `recipePlan`, was added as "asset-recipe.plan.json"):
  `intentMd` ("intent.md"), `visualWorld` ("visual-world.json"), `gameIntent` ("game-intent.json"),
  `gameDesign` ("game-design.json"), `characterDna` ("character-dna.json"), `recipe`
  ("asset-recipe.json"), `recipePlan` ("asset-recipe.plan.json"), `config` ("game-config.json"),
  `qaReport` ("qa-report.json"), `ledger` ("ledger.json").
- **Pattern to add a new artifact:** add a key to `RUN_ARTIFACT` (`:14`), write the file into
  `run.tmpDir` before `commitRun` (as `runUnderstanding` does per-step), read it back with
  `readRunJson(runDir, name)` (`:112-119`). Subdirectory trees (e.g. `visual-design/{svg,preview}/`)
  need no registration — they ride the single `renameSync` (see locked ticket 02, which I verified:
  `commitRun` renames the whole tmpDir, so any pre-written subtree lands atomically).
- JSON writer: `jstr` = 2-space + trailing newline (`:30`), `writeJson` (`:32-34`).

---

## 6. QA family

Types all in `packages/contracts/src/qa.ts` (V2 ⇒ `zod/v4`, `:94`); implementations in `packages/qa/src/*`.

- **`QA_JUDGEMENTS`** `:110-152` — **6 items**, `as const`, names are nouns:
  `palette-binding`, `constructive-constraint`, `layer-coverage`, `reference-resolution`,
  `reachability`, `intent-coverage`. `QAJudgementSchema = z.enum(QA_JUDGEMENTS)` `:154`;
  `QAJudgement` type `:155`.
- Judgment result (**two-state**, "success is not a variant"): `JudgementResultSchema`
  `:192-204` = `{ran:true, findings[]}` | `{ran:false, reason}`. `QAFindingSchema` `:172-178`
  = `{target, detail, severity: "error"|"warning"}`. `QAFailureSchema` `:184-187` = finding + projected
  `judgement`.
- Report: `QAReportSchema` `:275-337` = `{format:"qa-report/v1", subject?, checked[], failures[],
  observations[]}` with superRefine (no dup checked, no dup (judgement,target), failure⇒checked,
  exactly one observation per source).
- `QAJudgementResults = { [K in QAJudgement]: JudgementResult }` `:349` (mapped type ⇒ adding a
  judgment key is a compile error until all producers supply it).
- `QaFamilyResult = { judgements: Partial<QAJudgementResults>, observations }` `:437-440`;
  `QaFamilyRunner = (ctx) => Promise<QaFamilyResult>` `:443`; `QaContext` `:455-485`
  (`runDir, packDir, configPath, intentPath, designPath, recipePath, gameId, viewport,
  inspectObservation?`); `QaRunner` `:499`.
- `buildQAReport(results, observations)` `:358-372` (projects `checked` + failures);
  `qaVerdict` `:393-397` ("pass"/"fail"/"incomplete"); `QA_JUDGEMENT_LABELS` `:402-409`
  (a `Record<QAJudgement,string>` literal — must stay exhaustive).
- Families: `visualQaRunner` (`qa/src/visual.ts:85`) declares `constructive-constraint` +
  `palette-binding`; `gameplayQaRunner` (`qa/src/gameplay.ts`) declares `reference-resolution` +
  `reachability`; `intentQaRunner` (`qa/src/intent.ts:78`) declares `intent-coverage`;
  `layerCoverageJudgement` (`qa/src/layers.ts:48`) is run directly by the composer.
- Composer: `qaRunner` in `qa/src/assemble.ts:75-105` — `Promise.all` of the 3 families, builds the
  explicit 6-key `QAJudgementResults` object (`:90-97`), `declared()` helper throws if a family drops
  its own key (`:117-124`), then `buildQAReport` with 2 observations (`:101-104`).
- Pipeline invocation: `runBuild` passes paths into `runner` (`create-game.ts:585-595`), re-checks the
  report schema + injects `subject` (`:603-614`), and `assertQaPassed` (`:221-246`) gates on
  `failures[severity="error"]` and `QA_JUDGEMENTS.filter(j => !report.checked.includes(j))` (`:226`).

**How a 7th judgment (VDS↔GameConfig cross-check) gets added** (matches locked ticket 07):
1. Append the name to `QA_JUDGEMENTS` (`qa.ts:110`) — this auto-extends `QAJudgement`,
   `QAJudgementResults`, and `checked`.
2. Add a label to `QA_JUDGEMENT_LABELS` (`qa.ts:402`).
3. Add the key to the `judgements` object in `qa/src/assemble.ts:90-97` (compile-enforced), and produce
   the `JudgementResult` in a family or in the composer (ticket 07 puts it in the **visual** family).
4. Add any new path to `QaContext` (`qa.ts:455`; ticket 07 needs `vdsPath`) and pass it from
   `runBuild` (`create-game.ts:585-595`).
5. If a new observation source is needed, extend `OBSERVATION_SOURCES` (`qa.ts:214`) — currently
   `["inspect","review"]`.
`assertQaPassed` (`create-game.ts:226`) automatically treats the 7th unchecked judgment as a blocker.

---

## 7. Contracts / zod

`packages/contracts/src` — **two zod instances coexist**: legacy contracts use `zod` (v3), V2 contracts
use `zod/v4` and **must not nest across instances** (`visual-world.ts:3-4`, `game-design.ts:3`, `qa.ts:3`;
v4 mirror of v3 `Palette`/`StyleSpec` at `visual-world.ts:37-119` with a drift test in
`tests/visual-world.test.ts`). Conventions: `z.strictObject`/`.strict()` everywhere; a `format:
z.literal("<name>/v1")` discriminant per file; `export type X = z.infer<...>`; `superRefine` for gates
(model cannot see superRefine — `game-design.ts:119-120`).

- **`game-config.ts`** (v3, `zod`):
  - `EntityKind = z.enum(["solid","pickup","hazard","goal","chest","danger","decor"])` `:50` — **7 values**.
  - `Coord = z.number().int().nonnegative()` `:32`; `Point` `:33`; `Size` `:34`; `Rect` `:42`.
  - The "coordinate fields ~21-24" = the comment banning `scale` / fractional pixels via `.strict()`
    (`:21-24`). `GameConfigSchema` `:209-219` (top-level 7 blocks: `world/scene/player/terrain/entities/
    hud/objective`); `.strict().superRefine` at `:219-229`.
  - `Entity` `:89-102` (`{id, kind, at: Point, asset, anim?, body?, motion?, range?, strike?}`) —
    **geometry here is `at` (anchor point) + optional `body`; `size`/`anchor` live in the asset pack**
    (`:85-88`). `entityBox` derives boxes (`:117-…`); `DEFAULT_PLAYER_MOVE` `:109`; `FALLBACK_ANCHOR` `:115`.
  - `auditGameConfig` / `auditReferences` / `auditReachability` are in `game-config.ts` + `reachability.ts`
    (`index.ts:134-140`), used by both `compileRuntime` and QA.
- **`recipe.ts`** (v3): `AssetSource = z.discriminatedUnion("kind", [DrawlistSource, ImageSource,
  ImportSource, FramesSource])` `:143`; `DrawlistSource` `:43`; `ImageSource` `:63`; `ImportSource` `:108`;
  `FramesSource` `:141`. `RECIPE_FORMAT = "asset-recipe/v1"` `:17`; `AssetRecipe` `:222`; `parseRecipe` `:379`.
- **`route.ts`** is in `packages/assets/src/route.ts` (not contracts): `resolveRoute(input)` `:80`
  (pure fn, "`source.kind` 的唯一最终写入者" per header `:1`), `sourceForDecision` `:143-155`,
  `plannerCapabilitiesOf` `:121-140`. `source.kind` in the model output is only a **candidate**
  (`route.ts:1`, `ops.ts:470`).
- **Export/versioning:** `contracts/src/index.ts` re-exports every schema module (`:65-175`); versioning
  is by `format` string literal, not by package version.

---

## 8. Shell constants

- **`VIEWPORT = { w: 480, h: 270 } as const`** — `packages/demo/src/draw.ts:15` (comment `:14` "视口 =
  外壳常量（票 32 裁决 1）… 1 交付像素 = 1 屏幕像素"). Same value mirrors in
  `assets/src/ops.ts:830` (`DEFAULT_VIEWPORT`).
- `SHELL_VERSION = "2"` `draw.ts:28`; `HUD_LINE_HEIGHT = 10` `draw.ts:43`; `BACKDROP = "#000000"`
  `draw.ts:45`.
- These are injected into `compile-*` as parameters (CLI passes `viewport: VIEWPORT, hudLineHeight:
  HUD_LINE_HEIGHT` at `cli.ts:593-594` / `:608-609`); "视口不是数据" per `CONTEXT.md:608-614`.
- Also relevant: `game-config.ts` forces `world.size.h === viewport.h` via prompt (`ops.ts:1066`) and
  `auditScreenSpace` checks HUD against the viewport (`ops.ts:1161-1162`).

---

## 9. Rasterization / SVG

- **DrawList→PNG** is `rasterize(drawlist, {palette, scale=1})` in `packages/assets/src/raster.ts:120`.
  Pure TypeScript, **no third-party graphics library**. Determinism guarantees: no anti-aliasing
  (per-pixel center-point binary coverage, `:8-9`, `:117-118`), fixed `CURVE_SEGMENTS = 24` (`:17`),
  integer `scale >= 1` (`:121`), Float32 accumulation + single final quantize (`:125`, `:176-178`).
  Output is `RasterImage` (RGBA8, row-major, "唯一图像类型", `assets/src/image.ts:1`).
- PNG encode is **hand-rolled** `encodePNG` in `assets/src/png.ts:29-41` using only `node:zlib`
  (`deflateSync level 9`) — deterministic byte output ("同样的输入永远得到同样的字节", `:28`).
  `decodePNG` `:44-88` also hand-rolled.
- `rasterizeToGrid` `raster.ts:187-192` = rasterize + `resizeNearest`.
- **SVG/XML search result — NONE exists.** `grep -rniE "svg|resvg|sharp|@xmldom|xmldom|canvas|fast-xml|
  xml2js|xmlbuilder|sax" packages/*/src` finds no SVG renderer and no XML parser (only prose mentions of
  "SVG" in `raster.ts:118`/`drawlist.ts:11` and Phaser `createCanvas` placeholders in the demo shell).
- **Installed libraries that could render:** only `phaser@3.90.0` (browser game engine, `demo/package.json`)
  and `jpeg-js@0.4.4` (JPEG decode only, `assets/package.json`). Root `node_modules` = `esbuild`,
  `typescript`, `vitest`. **No resvg-js, sharp, @napi-rs/canvas, skia-canvas, canvas, or XML parser.**
- ⇒ For V1's "SVG → PNG preview" there is **no off-the-shelf SVG→PNG path**. Two viable routes for the
  implementer: (a) add a new dependency (`@resvg/resvg-js` or `sharp`), or (b) hand-roll — which is
  unusually cheap here because the locked SVG whitelist (`.scratch/visual-design-v1/assets/05-…md`) is
  only `<svg>/<g>/<rect>` + 10 attributes, i.e. a set of solid-color rectangles that the existing
  `rasterize`/`encodePNG` machinery could render directly (mirroring the `rect` op at `raster.ts:79-81`);
  a minimal XML parse of that whitelisted subset would also be hand-rolled (nothing installed).

---

## 10. CLI

File: `packages/cli/src/cli.ts` (bundled to `dist/cli.mjs` by esbuild, `cli/package.json` `bin`).

- Hand-rolled arg parse (`parseArgs`, flags), then a single `switch (command)` at `:508` inside `run()`.
- **Existing subcommands (case labels):** `create` `:509`, `build` `:534`, `plan` `:546`, `pack` `:562`,
  `compile-runtime` `:582`, `compile-td-game` `:598`, `site` `:613`, `verify` `:639`, `inspect` `:644`,
  `accept` `:649`, `review` `:663`, default "不认识的操作" `:672`. `--help`/`help` `:501`; no-command =
  usage error `:502`.
- **Pattern to add a command** (e.g. `visual-design`): add a `case "visual-design": { … }` block to the
  `switch`; validate flags (throw `CommandError("usage", …)`); call a core op that returns
  `CommandResult`; `result` is printed by the shared tail (`:675`) and exit code set by `exitCode`
  (default `EXIT.ok`, `:507`) or via thrown `CommandError`. Entry guard at `:706-708` runs only when
  invoked directly (so tests can import `run`).
- Exit codes: `EXIT` in `contracts/src/command.ts:46`; error → code mapping in the catch block
  `cli.ts:677-702`.

---

## 11. Tests

- Runner: **vitest**. Root script `pnpm test` = `vitest run --passWithNoTests` (`package.json`).
  `pnpm typecheck` = `tsc -b && pnpm -r --if-present typecheck`; `pnpm check` = deps + links + build.
- **Layout: NOT colocated** — tests live in `packages/<pkg>/tests/*.test.ts` (parallel to `src/`).
  Examples: `packages/contracts/tests/*.test.ts`, `packages/assets/tests/*.test.ts`,
  `packages/qa/tests/{assemble,gameplay,intent,layers,pixel,visual}.test.ts`,
  `packages/pipeline/tests/{create-game,palette,publish-gate,review,run}.test.ts`.
  Each package has a `tsconfig.spec.json` for typechecking tests (`"typecheck": "tsc -p tsconfig.spec.json"`).
- Fixtures: shared `fixtures/` dir at repo root (asset packs, styles, etc.); per-package fixture helpers
  e.g. `packages/game-design/tests/fixtures.ts`, `packages/assets/tests/_model-paint.ts` (leading
  underscore = not a test file).
- Demo probes (integration/acceptance, Node `.mjs` scripts, NOT vitest):
  `packages/demo/probe/{playable-smoke.mjs, mechanic-probe.mjs, free-acceptance.mjs, probe-harness.mjs,
  smoke.mjs, smoke-td.mjs, td-balance.mjs, td-sweep.mjs}`. Run via root scripts that **build first**:
  `test:playable` = `pnpm build && node packages/demo/probe/playable-smoke.mjs`, `test:mechanic` =
  `…/mechanic-probe.mjs`, `test:acceptance` = `pnpm build && node …/free-acceptance.mjs` (`package.json`).
  `free-acceptance.mjs` gates on `QA_PROBED_MECHANICS` (`vocabulary.ts:114-118`).

---

## 12. game-design package

- `compileDesign(input: CompileDesignInput): Promise<CompileDesignResult>` —
  `packages/game-design/src/compile-design.ts:235`.
  - `CompileDesignInput` `:38-48` = `{ intent: GameIntentSpec, vws: VisualWorldSpec,
    runtimeProfile?, transport, fetchImpl?, timeoutMs? }`.
  - `CompileDesignResult` `:50-55` = `{ spec: GameDesignSpec, ledger?: LedgerCall[] }`.
  - Flow: assert configured `:236`, re-validate upstream `assertUpstream` `:237` (safeParse of
    intent+vws), `pickProfile` `:238`, forced-tool call `:242-260`, `onceThrough` `:277`
    (`parseToolUse` + `GameDesignSpecSchema` at `:195`), then `buildDesign({fromModel, intent, vws,
    profile})` `:204` (injects the 3 echo values `genre`/`camera`/`runtimeProfile` + runs R12 rejection;
    see `build-design.ts`). Retries `STRUCTURED_CALL_ATTEMPTS` `:276`; `DesignRejectedError` (R12) not
    resampled when deterministic `*-unsupported`/`mechanic-experimental` (`:288-306`).
- **Output JSON shape = the full `GameDesignSpec`** (§1 above). **It assigns NO geometry** — there is
  no code path writing any bounds/position into the design; the only transformations are the 3 injected
  string fields + R12 gating (in `build-design.ts`).
- Package exports: `game-design/src/index.ts:16-21` (`prompts`, `build-design`, `analyze-intent`,
  `compile-design`, `build-character-dna`, `compile-character-dna`). The package depends only on
  `@game-maker/contracts` (`game-design/package.json`).

---

## 13. tsconfig / build / new-package registration

- Build = `tsc -b` project references. Root `tsconfig.json` has `references` to **9 packages**
  (`contracts, assets, demo, cli, mcp, vision, game-design, qa, pipeline`).
- `tsconfig.base.json`: `target ES2022, module/moduleResolution NodeNext, strict,
  noUncheckedIndexedAccess, composite, declaration, declarationMap, sourceMap`. Each package's
  `tsconfig.json` extends base with `{outDir: "dist", rootDir: "src", references: []}` and
  `include: ["src"]`; `tsconfig.spec.json` covers `tests/`.
- **Adding a new package requires registering it in THREE places:**
  1. `pnpm-workspace.yaml` already matches `packages/*` — no change needed there.
  2. Root `tsconfig.json` → add `{ "path": "packages/<name>" }` to `references`.
  3. `scripts/check-deps.mjs` → add the package to the `ALLOWED` map (declaring which sibling packages
     it may depend on). The script **hard-fails** with "不在允许图里（新增包必须先在 check-deps.mjs 里表态）"
     if a package exists but isn't in `ALLOWED`. Current `ALLOWED` (all the `@game-maker/*` edges) is
     listed there; the dependency direction rule is: new V2 packages depend only on `@game-maker/contracts`
     (R11 — `vision`, `game-design`, `qa` each list `["@game-maker/contracts"]`).
  4. Also add `scripts/check-links.mjs` is irrelevant to code (it only validates `.md` relative links,
     skipping `node_modules/out/.git/dist/.claude`).

---

## Cross-check: locked design assertions vs. actual code

- ✅ `visual-world → intent → design → character-dna → recipe` (`create-game.ts:40`) — matches map.md.
- ✅ `planAssets` at `ops.ts:320`, `compileRuntime` at `ops.ts:1004` (唯一产 GameConfig 处 — confirmed:
  `compileRuntime` is the only writer of `game-config/v1`; `td-config` comes from `compileTdGame`
  `ops.ts:1369`, the TD side-track), `raster.ts:120` — all match.
- ✅ `draw.ts:15` VIEWPORT 480×270; `game-config.ts:21-24` scale-ban; `raster.ts:121` scale≥1 integer.
- ✅ `resolveRoute` (`assets/src/route.ts:80`) and `source.kind` (`recipe.ts:143`) are real;
  `GameCreationState` is a dead word (zero symbols in the repo).
- ✅ `EntityKind` closed enum at `game-config.ts:50` (7 values) — matches ticket 03/07's "EntityKind 7 值".
- ⚠️ **Minor drift:** locked tickets 02 / `qa.ts` comments say the run dir has "九项 / 9 items", but
  `RUN_ARTIFACT` now has **10** keys (a `recipePlan` "asset-recipe.plan.json" was added; `artifacts.ts:14-26`).
  Not a design blocker, but the "九个名字的家" phrasing is stale.
- ✅ PRD's `1280×720` is non-normative (PRD §5.3 says "仅为概念示例…不是契约"); 480×270 is the only
  constant anywhere. PRD's `schemaVersion: 1` has no precedent — all four existing contracts use a
  `format: "<name>/v1"` literal (ticket 03 already resolves this to `"visual-design/v1"`).
- ⚠️ **Gap to flag for the implementer:** the pipeline/QA/CLI all read **only files under
  `run/v<N>/`**. A new VDS step that writes `visual-design.json` + `visual-design/{svg,preview}/` into
  `run.tmpDir` inherits atomic commit + "失败不占号" for free (`run.ts:75-94`, `:108-117`), and the QA
  cross-check would add a 7th `QA_JUDGEMENTS` entry + a `QaContext` path — all consistent with the
  locked tickets. The one thing the locked design does NOT yet specify concretely (and this recon
  confirms must be decided): **there is no XML parser or SVG rasterizer in the repo**, so the
  "render scene.svg → preview/scene.png" step must either add a dependency or hand-roll a rect-only
  rasterizer (which the existing `raster.ts`/`png.ts` machinery makes cheap).
