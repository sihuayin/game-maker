# game-maker

**English** · [中文](README_zh.md)

An **image-driven game creation toolchain**. From *a style reference image + a piece of requirement text*, it produces **two artifacts that can be delivered and consumed independently**.

| | Artifact | What it is | Acceptance |
|---|---|---|---|
| **A** | **Game asset pack** | An engine-neutral directory: PNG atlases + standard animation metadata, shipped together with the authoring-state drawlists and the StyleSpec they were built from | ① Any engine can take it directly — no runtime from this repo required. ② Everything in it must look like it belongs to **one visual world**, *including objects that never appeared in the reference image*. |
| **B** | **Runnable demo** | A statically hostable, open-and-play side-scroller (plus a tower-defense variant) | A fixed, hand-written runtime shell + **data only** — the AI writes **not a single line of game code**. It runs off a fixture pack, so it needs **no image-generation capability**. |

The two artifacts share **data files only, never code**. Both are driven by the same core library through two thin shells: a **CLI** and an **MCP server** (the MCP server does *not* shell out to the CLI).

## Pipeline

```
                            ┌── derive ──────────▶ asset recipe ──▶ pack ──▶ ASSET PACK (A) ─┐
a piece of requirement ─────┤                                                                ├──▶ site ──▶ demo site (B) ──▶ open & play
a style reference image ────┴─ StyleSpec ──▶ compile-game / compile-td-game ──▶ level config ─┘
```

Two entry points are deliberate: the asset recipe can be **derived** from the requirement *or* **written by hand**, and the level config can be **compiled** from the requirement *or* **written by hand**. Once the file exists on disk, both paths are fully isomorphic.

## Repository layout

| Path | What lives there |
|---|---|
| [`packages/contracts`](packages/contracts) | Zod schemas and pure types — **the only shared code** |
| [`packages/assets`](packages/assets) | The asset pipeline (drawlist → static validation → raster → quantize → atlas → manifest) and the `derive` / `pack` / `compile-*` / `verify` / `inspect` operations |
| [`packages/demo`](packages/demo) | Artifact B: the fixed runtime shell and the site assembler |
| [`packages/cli`](packages/cli) | CLI thin shell — it parses arguments and renders results, nothing else |
| [`packages/mcp`](packages/mcp) | MCP stdio server thin shell |
| [`fixtures/`](fixtures) | Baseline material checked into the repo: reference images, StyleSpecs, drawlists, recipes, level configs, and **two complete packs** |
| [`inputs/`](inputs) | Material *you* bring this time — requirement prompts, generated bitmaps, hand-drawn PNGs (see [`inputs/README.md`](inputs/README.md)) |
| `out/` | Everything produced at runtime. Default artifact root, fully gitignored |
| [`docs/`](docs) · [`CONTEXT.md`](CONTEXT.md) · [`.scratch/`](.scratch) | Specifications, the domain glossary, the planning map |

The dependency direction is **enforced, not just documented**: [`scripts/check-deps.mjs`](scripts/check-deps.mjs) fails the build if `contracts` grows a dependency, if `assets`/`demo` depend on each other, or if `mcp` starts depending on `cli`. That graph is exactly the "A and B are independently deliverable" claim, made structural.

## Requirements

- **Node ≥ 22** (developed on v22.23.2)
- **pnpm 10** (the repo pins `pnpm@10.7.1`)
- **Python 3** — optional, and only to serve the demo (any static HTTP server works)

## Install and build

```bash
pnpm install
pnpm build     # tsc -b + esbuild bundles: shell.js, cli.mjs, server.mjs
pnpm check     # dependency-direction guard + relative-link guard + build
pnpm test      # vitest, fully offline
```

The CLI builds to a single self-contained ESM bundle, so it runs straight from the repo:

```bash
node packages/cli/dist/cli.mjs --help
```

Everything below writes `game-maker ...` for short. Either alias it:

```bash
alias game-maker="node $(pwd)/packages/cli/dist/cli.mjs"
```

or paste the full `node packages/cli/dist/cli.mjs` invocation each time.

## Quick start — the fixture path (offline, no API keys)

The repo ships two complete packs, so you can be playing a game without calling a single model.

```bash
game-maker verify fixtures/packs/last-train/v2
game-maker site   fixtures/packs/last-train/v2 --config fixtures/game-configs/last-train.json
# → out/last-train/site/v<N>  (N is the next unused site version)
```

Now serve it. **The HTTP server root must be the parent of `pack/` and `site/`** — that is `out/last-train/`, *not* the site directory itself. Pointing the root inside the site gives 404s, and **Phaser's loader fails silently**, so you get a black canvas and no error.

```bash
cd out/last-train && python3 -m http.server 8000
# open http://127.0.0.1:8000/site/v<N>/index.html
```

The tower-defense variant, same shape:

```bash
game-maker site fixtures/packs/counter-siege/v4 --config fixtures/td-configs/counter-siege.json
cd out/counter-siege && python3 -m http.server 8000
# open http://127.0.0.1:8000/site/v<N>/index.html
```

Both fixture packs are the real thing, not stubs — `inspect` an asset pack to see every asset, its kind, size, usage of the palette, and its animations:

```bash
game-maker inspect fixtures/packs/counter-siege/v4
```

## Full pipeline — requirement to playable game

This path calls a model, so it needs the text upstream configured first (see [Configuration](#configuration)).

**Step 0 is a human-in-the-loop interaction, not a pipeline call**: turning a reference image into a StyleSpec. The runbook and a copy-pasteable prompt live in [`docs/stylespec-extraction.md`](docs/stylespec-extraction.md). Two ready-made StyleSpecs are checked in under `fixtures/`, so you can skip this step while exploring.

```bash
# 1. requirement + StyleSpec → asset recipe (a file, so you can read it before spending anything)
game-maker derive --requirement inputs/last-train/PROMPT.md --style fixtures/style-spec.halt-dusk.json
# → out/<id>/recipes/v1.json   — the id comes from the model; the command prints the exact path

# 2. recipe → asset pack (this is the step that costs money if the recipe has image assets)
game-maker pack --recipe out/<id>/recipes/v1.json
# → out/<id>/pack/v1

# 3a. side-scroller: requirement + pack → level config
game-maker compile-game --requirement inputs/last-train/PROMPT.md --pack out/<id>/pack/v1
# 3b. tower defense: requirement + pack → level config
game-maker compile-td-game --requirement inputs/counter-siege/PROMPT.md --pack out/<id>/pack/v1

# 4. pack + level config → site
game-maker site out/<id>/pack/v1 --config out/<id>/game-configs/v1.json
```

A level config may also be **hand-written**; [`fixtures/game-configs/last-train.json`](fixtures/game-configs/last-train.json) is exactly that. Both routes stay legal, and they do not always produce the same level — the hand-written config puts all three lost items on the ground line, while the compiled one stacks the second item on top of the luggage pile.

For the tower-defense route, read [`docs/td-requirement.md`](docs/td-requirement.md) **before** writing the requirement. `derive` and `compile-td-game` are not genre-aware: whatever the requirement does not say, they fill in from the example. A requirement that never states its arena is tiled will happily produce a legal recipe for one big background image, and that failure only surfaces much later.

## Configuration

Two independent upstreams. Each is optional depending on which commands you run.

**Text upstream** — used by `derive`, `compile-game`, `compile-td-game`:

```bash
export ANTHROPIC_BASE_URL=...
export ANTHROPIC_AUTH_TOKEN=...
```

**Image generation** — used by `pack`, and only when the recipe actually contains image assets:

```bash
cp game-maker.local.example.json game-maker.local.json   # the real file is gitignored
```

Fill in one of the supported protocols (`openai` / `minimax` / `dashscope-mcp` / `gemini`); the example file documents what each one expects. Environment variables win over the file: `GAME_MAKER_IMAGE_PROTOCOL` · `GAME_MAKER_IMAGE_BASE_URL` · `GAME_MAKER_IMAGE_API_KEY` · `GAME_MAKER_IMAGE_MODEL`.

A pack whose recipe contains no image assets needs **no** image credentials at all — and `site` never needs either upstream.

## CLI reference

```
game-maker derive          --requirement <requirement.md> --style <stylespec.json> [--out <dir>] [--json]
game-maker pack            --recipe <recipe.json> [--out <dir>] [--concurrency <n>] [--json]
game-maker compile-game    --requirement <requirement.md> --pack <pack dir> [--out <dir>] [--json]
game-maker compile-td-game --requirement <requirement.md> --pack <pack dir> [--out <dir>] [--json]
game-maker site            <pack dir> --config <level config> [--shell <shell.js>] [--out <dir>] [--json]
game-maker verify          <pack dir> [--json]
game-maker inspect         <pack dir> [--json]
```

- `--out <dir>` — artifact root, default `./out`. **Every reported path is relative to it.**
- `--json` — machine-readable output. It is *the same data* the human rendering draws from and the MCP tools return, not a second representation.
- `--concurrency <n>` — parallel generation cap.

Exit codes: `0` success · `1` failure · `2` usage error · `3` upstream unreachable · `4` invalid pack/recipe.

Two properties worth knowing up front:

- **Artifacts are versioned by directory and never overwritten.** A pack is `pack/v<N>`, a site is `site/v<N>`, each with its own counter. Re-running a command writes the next version rather than clobbering the previous one.
- **Exit code 3 is real.** When image generation is unreachable, the whole pack fails. There is no degradation chain quietly producing an uglier pack — if the artifact cannot be made, there is no artifact. On failure the CLI reports what was already spent, and keeps the raw images plus the verbatim prompts that were sent, so they can be reused as `{"kind":"import", ...}` sources at zero further cost.

## MCP server

```bash
node packages/mcp/dist/server.mjs      # stdio
```

Six tools: `derive_recipe` · `build_asset_pack` · `verify_asset_pack` · `inspect_asset_pack` · `compile_game` · `assemble_site`. Long-running calls stream progress over the MCP-native `notifications/progress`; clients that ignore notifications still work, they just see no progress.

Register it with any MCP client, for example `.mcp.json`:

```json
{
  "mcpServers": {
    "game-maker": { "command": "node", "args": ["packages/mcp/dist/server.mjs"] }
  }
}
```

## Documentation

| Document | What it answers |
|---|---|
| [`CONTEXT.md`](CONTEXT.md) | **The domain glossary.** If a term conflicts with anywhere else in the repo, this file wins |
| [`docs/文档.md`](docs/文档.md) | The original V1 technical specification (83 sections, Chinese). Its contract sections are still authoritative; its QA / gate / repair / benchmark sections belong to an earlier goal and are **out of scope** here |
| [`docs/stylespec-extraction.md`](docs/stylespec-extraction.md) | How a human produces a StyleSpec from a reference image — with the prompt to copy |
| [`docs/td-requirement.md`](docs/td-requirement.md) | What a tower-defense requirement must say, and why omitting it makes the models invent an answer |
| [`docs/counter-siege.md`](docs/counter-siege.md) | The tower-defense level: its design, numbers, and how to run it |
| [`inputs/README.md`](inputs/README.md) | What input material to bring, and the measured bitmap requirements for the import channel |
| [`.scratch/game-creation-v1/map.md`](.scratch/game-creation-v1/map.md) | The planning map: the goal, the locked decisions, and every ticket with its answer |

## Gotchas

- **Serve the demo from the right root.** `out/<gameId>/`, never `out/<gameId>/site/v<N>/`. Phaser loads everything over XHR and fails silently, so a wrong root looks like a black screen with a clean console.
- **`file://` does not work.** Double-clicking `index.html` cannot work, for two independent reasons: module scripts are required to go through CORS, and Phaser's loader is built on XHR — down to the PNGs.
- **Only `inputs/` and `fixtures/` are committed.** Everything under `out/` is generated and gitignored; `game-maker.local.json` holds credentials and is gitignored too.
- **Version directories are per-pack, not per-asset.** The unit that breaks, rolls back, and gets reproduced is a whole deliverable.
