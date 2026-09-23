import { randomUUID } from "node:crypto";
import type {
  AssetManifest, ArtifactRef, CreationEvaluationReport, CreationProject, CreationRun,
  GameSpec, GameplayTestPlan, RepairPlan, StyleSpec
} from "../contracts/index.js";
import { DEFAULT_BUDGET } from "../contracts/policy.js";
import { assertTransition } from "./state-machine.js";
import type { CreationStore } from "./store.js";
import type { RuntimePorts } from "./ports.js";

export class CreationOrchestrator {
  private style?: StyleSpec;
  private game?: GameSpec;
  private manifest?: AssetManifest;
  private tests?: GameplayTestPlan;
  private assets: ArtifactRef[] = [];
  private build?: ArtifactRef;

  constructor(private readonly store: CreationStore, private readonly ports: RuntimePorts) {}

  async create(project: CreationProject): Promise<CreationRun> {
    this.store.projects.set(project.id, project);
    const now = new Date().toISOString();
    const run: CreationRun = {
      id: randomUUID(), projectId: project.id, status: "created",
      iteration: 0, attempt: 0, createdAt: now, updatedAt: now,
      budget: DEFAULT_BUDGET,
      execution: { paused: false, cancelRequested: false }
    };
    this.store.runs.set(run.id, run);
    return this.execute(run);
  }

  async resume(runId: string): Promise<CreationRun> {
    const run = this.mustRun(runId);
    run.execution.paused = false;
    run.updatedAt = new Date().toISOString();
    return this.execute(run);
  }

  async pause(runId: string): Promise<void> {
    const run = this.mustRun(runId);
    run.execution.paused = true;
    run.execution.pauseReason = "manual";
    run.updatedAt = new Date().toISOString();
  }

  async cancel(runId: string): Promise<void> {
    const run = this.mustRun(runId);
    run.execution.cancelRequested = true;
    if (!["passed","failed","cancelled"].includes(run.status)) {
      run.status = "cancelled";
    }
    run.updatedAt = new Date().toISOString();
  }

  async execute(run: CreationRun): Promise<CreationRun> {
    while (!["passed","failed","cancelled"].includes(run.status)) {
      if (run.execution.paused || run.execution.cancelRequested) return run;
      try {
        switch (run.status) {
          case "created": await this.compile(run); break;
          case "compiled": await this.generate(run); break;
          case "generated": await this.buildGame(run); break;
          case "built": await this.start(run); break;
          case "running": await this.evaluate(run); break;
          case "evaluating": await this.decide(run); break;
          case "repairing": await this.repair(run); break;
          case "finalizing": await this.finalize(run); break;
          default: throw new Error(`Unsupported executable state: ${run.status}`);
        }
      } catch (error) {
        run.status = "failed";
        run.updatedAt = new Date().toISOString();
        this.store.runs.set(run.id, run);
        throw error;
      }
    }
    return run;
  }

  private transition(run: CreationRun, next: CreationRun["status"]) {
    assertTransition(run.status, next);
    run.status = next;
    run.updatedAt = new Date().toISOString();
    this.store.runs.set(run.id, run);
  }

  private async compile(run: CreationRun) {
    const project = this.store.projects.get(run.projectId)!;
    this.transition(run, "compiling");
    this.style = await this.ports.compiler.compileStyle(project);
    this.game = await this.ports.compiler.compileGame(project);
    this.manifest = await this.ports.compiler.compileAssets(this.game, this.style);
    this.tests = await this.ports.compiler.compileGameplayTests(this.game);
    this.transition(run, "compiled");
  }

  private async generate(run: CreationRun) {
    if (!this.style || !this.manifest) throw new Error("Compile artifacts are missing");
    this.transition(run, "generating");
    this.assets = await this.ports.assets.generate(this.manifest, this.style);
    this.transition(run, "generated");
  }

  private async buildGame(run: CreationRun) {
    if (!this.style || !this.game || !this.manifest) throw new Error("Compile state missing");
    this.build = await this.ports.builder.build({
      run, game:this.game, style:this.style, manifest:this.manifest, assets:this.assets
    });
    this.transition(run, "built");
  }

  private async start(run: CreationRun) {
    if (!this.build) throw new Error("Build artifact missing");
    await this.ports.runner.start(this.build, run);
    this.transition(run, "running");
  }

  private async evaluate(run: CreationRun) {
    if (!this.style || !this.game || !this.manifest || !this.tests) throw new Error("Evaluation context missing");
    const observations = await this.ports.observer.collect(run);
    this.store.observations.set(run.id, observations);
    const report = await this.ports.evaluator.evaluate({
      run, game:this.game, style:this.style, manifest:this.manifest,
      gameplayPlan:this.tests, observations
    });
    this.store.evaluations.set(run.id, report);
    this.transition(run, "evaluating");
  }

  private async decide(run: CreationRun) {
    const report = this.store.evaluations.get(run.id)!;
    if (report.gate.status === "pass" && report.gate.hardGate.passed) {
      this.transition(run, "finalizing");
      return;
    }
    if (run.iteration >= run.budget.maxIterations) {
      run.status = "failed";
      run.updatedAt = new Date().toISOString();
      return;
    }
    run.iteration += 1;
    this.transition(run, "repairing");
  }

  private async repair(run: CreationRun) {
    const report = this.store.evaluations.get(run.id)!;
    const plan = await this.ports.repair.plan(report);
    const plans = this.store.repairs.get(run.id) ?? [];
    plans.push(plan);
    this.store.repairs.set(run.id, plans);
    await this.ports.repair.execute(plan, run);
    this.transition(run, "building");
  }

  private async finalize(run: CreationRun) {
    await this.ports.runner.stop(run);
    const report = this.store.evaluations.get(run.id)!;
    run.best = {
      artifacts: this.build ? [this.build, ...this.assets] : [...this.assets],
      qualityScore: report.quality.score,
      gateStatus: report.gate.hardGate.passed ? "pass" : "fail",
      iteration: run.iteration
    };
    this.transition(run, "passed");
  }

  private mustRun(id: string): CreationRun {
    const run = this.store.runs.get(id);
    if (!run) throw new Error(`Run not found: ${id}`);
    return run;
  }
}
