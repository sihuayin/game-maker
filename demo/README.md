# Game Creation Runtime V1

A framework-agnostic TypeScript/Zod implementation skeleton for a single-game creation lifecycle:

Requirement → Style/Game/Asset Compile → Generate → Build → Run → Observe → Evaluate → Gate → Repair → Rebuild → Finalize.

## Scope

- Single game project lifecycle only.
- No cross-game knowledge sharing.
- Contracts are the ABI between phases.
- Evaluators are read-only.
- Repairs create new artifact versions.
- Checkpoints and event logs support resume/recovery.
- Hard gates are separate from the quality score.

## Quick start

```bash
npm install
npm run build
npm test
npm run dev
```

The example uses an in-memory artifact store and a deterministic mock phase implementation. Replace the phase implementations with real asset generators, game builders, browser/game runtime adapters, and vision evaluators.

## Main entry points

- `src/contracts/index.ts` — Zod schemas and TypeScript contracts.
- `src/runtime/creation-runtime.ts` — public runtime API.
- `src/runtime/orchestrator.ts` — lifecycle orchestration.
- `src/runtime/state-machine.ts` — explicit state transitions.
- `src/runtime/in-memory-store.ts` — reference persistence implementation.
- `src/qa/evaluator.ts` — unified read-only evaluation.
- `src/repair/repair-engine.ts` — repair planning/execution.
- `src/example.ts` — runnable end-to-end mock.

## Production integration points

Implement these interfaces:

- `CreationCompiler`
- `AssetGenerator`
- `GameBuilder`
- `GameRunner`
- `ObservationProvider`
- `CreationEvaluator`
- `RepairEngine`

Then wire them into `CreationOrchestrator`.

## Important

The thresholds in `src/contracts/policy.ts` are engineering defaults, not empirically validated benchmark results.
