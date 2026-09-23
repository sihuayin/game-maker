import type {
  ArtifactRef, AssetManifest, CreationEvaluationReport, CreationRun, CreationProject,
  GameSpec, GameplayTestPlan, RepairPlan, RuntimeObservation, StyleSpec
} from "../contracts/index.js";

export interface CreationCompiler {
  compileStyle(project: CreationProject): Promise<StyleSpec>;
  compileGame(project: CreationProject): Promise<GameSpec>;
  compileAssets(game: GameSpec, style: StyleSpec): Promise<AssetManifest>;
  compileGameplayTests(game: GameSpec): Promise<GameplayTestPlan>;
}

export interface AssetGenerator {
  generate(manifest: AssetManifest, style: StyleSpec): Promise<ArtifactRef[]>;
}

export interface GameBuilder {
  build(input: {
    run: CreationRun;
    game: GameSpec;
    style: StyleSpec;
    manifest: AssetManifest;
    assets: ArtifactRef[];
  }): Promise<ArtifactRef>;
}

export interface GameRunner {
  start(build: ArtifactRef, run: CreationRun): Promise<void>;
  stop(run: CreationRun): Promise<void>;
}

export interface ObservationProvider {
  collect(run: CreationRun): Promise<RuntimeObservation[]>;
}

export interface CreationEvaluator {
  evaluate(input: {
    run: CreationRun;
    game: GameSpec;
    style: StyleSpec;
    manifest: AssetManifest;
    gameplayPlan: GameplayTestPlan;
    observations: RuntimeObservation[];
  }): Promise<CreationEvaluationReport>;
}

export interface RepairEngine {
  plan(report: CreationEvaluationReport): Promise<RepairPlan>;
  execute(plan: RepairPlan, run: CreationRun): Promise<void>;
}

export interface RuntimePorts {
  compiler: CreationCompiler;
  assets: AssetGenerator;
  builder: GameBuilder;
  runner: GameRunner;
  observer: ObservationProvider;
  evaluator: CreationEvaluator;
  repair: RepairEngine;
}
