# `interactables[].type` — real-world value distribution & design `type` → runtime `kind` mapping

Date: 2026-10-25. Scanned the whole repo with `find . -name game-design.json`, excluding `node_modules/`, `dist/`, `.git/`.

- **30 `game-design.json` files** scanned (locations: `.scratch/entity-identity-v1/`, `.scratch/game-maker-v2/experiments/e2e-wasteland/`, `.scratch/intent-to-mechanics-v1/`, `.scratch/p0-final-v1/`, `.scratch/recipe-config-gap-v1/`, `.scratch/style-migration-v1/`, `.scratch/visual-design-impl-v1/`, `fixtures/e2e/`).
- **57 `interactables[]` entries** total, **28 distinct `type` strings**.

## Distinct `type` values

| `type` | count | sample design id(s) | looks fixed / ad-hoc |
|---|---|---|---|
| `宝箱` | 15 | `chest`, `chest-scavenge`, `chest-ruined-city`, `chest-wasteland`, `treasure-chest` | ad-hoc (bare noun, many synonyms) |
| `危险区域（碎石尖刺带）` | 5 | `hazard-spike-rubble` | ad-hoc (free prose) |
| `treasure-container` | 3 | `chest` | fixed-looking token |
| `level-exit` | 3 | `exit-gate` | fixed-looking token |
| `危险机关` | 3 | `danger-hazard`, `ground-hazard`, `hazard-wire` | ad-hoc (free prose) |
| `hazard` | 2 | `hazard`, `hazard-spikes` | fixed-looking token |
| `危险物` | 2 | `hazard` | ad-hoc (free prose) |
| `可开启容器` | 2 | `chest`, `chest-wasteland` | ad-hoc (free prose) |
| `可开启的收货容器` | 2 | `chest` | ad-hoc (free prose) |
| `可开启的宝箱` | 2 | `chest` | ad-hoc (free prose) |
| `goal-terminal` | 1 | `extraction-point` | fixed-looking token |
| `fragile-platform` | 1 | `collapsed-floor` | fixed-looking token |
| `environment-hazard` | 1 | `hazard-terrain` | fixed-looking token |
| `containers` | 1 | `treasure-chest` | fixed-looking token |
| `chest` | 1 | `chest` | fixed-looking token |
| `尖刺危险：由等距小方点排成一排的地面/墙面危险色块` | 1 | `spike-trap` | ad-hoc (full sentence) |
| `危险地形/坍塌废墟` | 1 | `rubble-hazard` | ad-hoc (free prose) |
| `宝箱：约一个角色高的矩形方块，箱盖为横向亮色横条` | 1 | `treasure-chest` | ad-hoc (full description w/ visual detail) |
| `可开启的收获容器` | 1 | `treasure-chest` | ad-hoc (free prose) |
| `倾斜的路灯柱` | 1 | `streetlamp` | ad-hoc (free prose) |
| `指示牌` | 1 | `sign-post` | ad-hoc (free prose) |
| `地形障碍块` | 1 | `rubble-block` | ad-hoc (free prose) |
| `地面障碍尖刺` | 1 | `hazard-spike` | ad-hoc (free prose) |
| `危险地形` | 1 | `hazard-pit` | ad-hoc (free prose) |
| `撤离点灯柱` | 1 | `exit-beacon` | ad-hoc (free prose) |
| `宝箱容器` | 1 | `chest-wasteland` | ad-hoc (free prose) |
| `地面断口` | 1 | `broken-floor` | ad-hoc (free prose) |
| `路边破损长椅` | 1 | `bench` | ad-hoc (free prose) |

Source of the tally: full repo scan (30 files) via `jq '.interactables[] | .type'`, deduplicated. Representative file paths per value: the `宝箱` cluster spans e.g. `./.scratch/entity-identity-v1/runs/2026-10-25-e2e-r3/.failed-2026-10-25T08-38-21-712Z/game-design.json`, `./.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-17d/wasteland-scavenger-assets/run/v1/game-design.json`, `./fixtures/e2e/wasteland-platformer/game-design.json`; the full-sentence ad-hoc values live in `./.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out/wasteland-scavenger-assets/run/v1/game-design.json` (`宝箱：约一个角色高的矩形方块，箱盖为横向亮色横条`, `尖刺危险：由等距小方点排成一排的地面/墙面危险色块`).

## Closed vs open verdict

**OPEN / unbounded.** Evidence:

- 57 entries collapse into **28 distinct strings** — roughly one new string per two entries. A closed enum would show a handful of values repeating exactly.
- The same semantic concept is spelled many different ways: "chest" appears as `chest`, `宝箱`, `可开启的宝箱`, `可开启容器`, `可开启的收货容器`, `可开启的收获容器`, `宝箱容器`, `treasure-container`, `containers`, and the full-description `宝箱：约一个角色高的矩形方块，箱盖为横向亮色横条` — 10 distinct strings for one concept. "hazard" appears as `hazard`, `危险物`, `危险机关`, `危险地形`, `environment-hazard`, `危险区域（碎石尖刺带）`, `危险地形/坍塌废墟`, `地面障碍尖刺`, `尖刺危险：…` — 9 distinct strings.
- Some values are literal free prose / full descriptions with visual detail (`宝箱：约一个角色高的矩形方块，箱盖为横向亮色横条`, `尖刺危险：由等距小方点排成一排的地面/墙面危险色块`) — unambiguous proof the field is free text, not a vocabulary.
- The schema confirms this by construction: `interactables[].type` is `z.string()` (free-form), NOT a `z.enum(...)` — `packages/contracts/src/game-design.ts:171`. Runtime `kind` by contrast IS a closed enum — `EntityKind = z.enum(["solid","pickup","hazard","goal","chest","danger","decor"])` at `packages/contracts/src/game-config.ts:51`.

There is a *converged core* — `宝箱`, `hazard`, `treasure-container`, `level-exit`, `危险机关` — that the LLM repeatedly emits, but it is surrounded by an unbounded halo of synonyms and free-text. Any classifier must treat the space as open and normalize semantically, not by exact string.

## Real `type → kind` mapping (via `sourceIntent`)

Mechanism: in a run dir containing both `game-design.json` and `game-config.json`, a design interactable `{id: X, type: T}` maps to every config entity whose `sourceIntent === X`; record that entity's `kind`.

**6 run dirs pair both files**, but `sourceIntent` is only present in **1** of them (the field was introduced in the latest commit `a84ab72`; the other 5 configs predate it and carry no `sourceIntent`). `grep -rl sourceIntent --include=game-config.json` returns exactly one file:

`./.scratch/entity-identity-v1/runs/2026-10-25-e2e-r2/wasteland-scavenger-recipe/run/v1/game-config.json`

| `type` | `kind`(s) via `sourceIntent` | representative source path | note |
|---|---|---|---|
| `chest` | `chest`, `goal` | `./.scratch/entity-identity-v1/runs/2026-10-25-e2e-r2/wasteland-scavenger-recipe/run/v1/game-config.json` | **ambiguous (1:N)** — see below |
| `hazard` | `hazard` | same dir | 1:1 |
| all other 26 `type` values | — | — | **no paired sample** (the other 5 paired run dirs' configs have zero `sourceIntent` entries, so no join key exists) |

The `chest` split (same dir, `game-config.json`):
- `chest-1` → `kind: "chest"`, `sourceIntent: "chest"`, `asset: "chest"` — the openable chest.
- `gate` → `kind: "goal"`, `sourceIntent: "chest"`, `asset: "chest"` — the exit gate (`objective.gate: "gate"`, `objective.kind: "collect-then-reach"`).

So one design interactable (`id: "chest"`, `type: "chest"`) produced **two** runtime entities of **different kinds**. This is the 1:N identity sharing that the `sourceIntent` back-pointer was designed to capture (commit `a84ab72`: "1:N 共享、孤儿不带"). Also note the cross-bucket reality in the same config: the design `enemies[].id = "enemy-wasteland"` maps to `kind: "hazard"`, and `resources[].id = "resource-item"` maps to `kind: "pickup"` — interactables are not the only bucket whose `type`/bucket does not 1:1 determine `kind`.

## Behavior signal

`interactables[].behavior` is free prose (`z.string()`), but it **does carry a reliable semantic signal** — just not a structured one. In the 57 samples the behavior text consistently predicts the intended runtime class:

- chest: `"玩家靠近后可以打开，释放其中的宝物（计入收集目标）"` (`./.scratch/entity-identity-v1/runs/2026-10-25-e2e-r2/…/game-design.json`), `"…箱盖弹开…吐出宝藏供收集"` (`./.scratch/entity-identity-v1/runs/2026-10-25-e2e/rust-city-remnant/run/v1/game-design.json`) — markers: 打开/开启/箱盖/释放/吐出.
- hazard: `"…玩家触碰到会造成伤害"`, `"接触即让拾荒者损失状态"`, `"接触即受伤并结束本关"` — markers: 伤害/受伤/失败/损失.
- goal/exit: `"街区尽头的撤离闸门，玩家带着已收集物资接触它即结束本段"` (`level-exit`, `./.scratch/game-maker-v2/experiments/e2e-wasteland/raw/checkpoint-run11/ruined-city-scavenger/run/v1/game-design.json`), `"城市尽头的撤离信号终端…触发撤离结算"` (`goal-terminal`, `./.scratch/style-migration-v1/runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1/game-design.json`) — markers: 撤离/终点/结束/结算/闸门.

So `behavior` is **not** noise, but it is semantic free text that requires an LLM (or a keyword net) to classify — it is not a machine token and not a closed enum.

## Implication for the compatibility matrix

**`type` alone CANNOT disambiguate `chest` vs `goal` within the `interactables` bucket.**

- `DESIGN_BUCKET_KINDS` in `packages/qa/src/visual.ts:186-191` already encodes this: `interactables: ["chest", "pickup", "goal", "hazard", "danger", "solid"]` — six kinds, one bucket. The comment immediately above it states the reason verbatim: `interactables` 是 EntityKind 除 `decor`（`decor` 丢了交互 = 串桶），and `visualConfigCoherence`'s doc note (`visual.ts:198`) says "一桶既有 chest 又有 hazard，桶→EntityKind 不是 1:1" (a bucket is not 1:1 to EntityKind).
- The single real paired sample **confirms the specific `chest → goal` ambiguity**: design `type: "chest"` legitimately mapped to both `kind: "chest"` and `kind: "goal"` (the `gate` entity above). So a `chest`-typed interactable **can legitimately be a `goal`** — the QA matrix's inclusion of `goal` in the interactables allowed-set is not speculative.
- The reverse (`goal`-typed → `chest` kind) has **no paired sample**: the `level-exit` / `goal-terminal` / `撤离点灯柱` types all live in run dirs whose configs predate `sourceIntent`, so no join-key evidence exists either way. Semantically nothing in `behavior` forbids it; only absence of data keeps it unconfirmed.
- Bottom line: disambiguating `chest` vs `goal` (or any kind) for an interactable requires the **`behavior` free text** (semantic: open/release vs exit/结算) and/or the **`sourceIntent`→`kind` join key**, never the bare `type` string. `type` is an open, non-enumerable free-form field; it can only be used after semantic normalization, and even then it is not sufficient on its own.
