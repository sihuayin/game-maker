import { randomUUID } from "node:crypto";
import type {
  CreationEvaluationReport, CreationProject, CreationRun
} from "../contracts/index.js";
import { CreationOrchestrator } from "./orchestrator.js";
import type { CreationStore } from "./store.js";

export interface GameCreationRequest {
  projectId?: string;
  title: string;
  requirement: string;
  referenceImage?: string;
}

export class CreationRuntime {
  constructor(private readonly store: CreationStore, private readonly orchestrator: CreationOrchestrator) {}

  async create(request: GameCreationRequest): Promise<CreationRun> {
    const project: CreationProject = {
      id: request.projectId ?? randomUUID(),
      title: request.title,
      requirement: request.requirement,
      referenceImage: request.referenceImage,
      createdAt: new Date().toISOString()
    };
    return this.orchestrator.create(project);
  }

  resume(runId: string) { return this.orchestrator.resume(runId); }
  pause(runId: string) { return this.orchestrator.pause(runId); }
  cancel(runId: string) { return this.orchestrator.cancel(runId); }

  async retry(runId: string) {
    const run = this.store.runs.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    run.attempt += 1;
    run.status = "built";
    run.execution.cancelRequested = false;
    run.execution.paused = false;
    return this.orchestrator.execute(run);
  }

  getStatus(runId: string): CreationRun {
    const run = this.store.runs.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    return run;
  }

  getReport(runId: string): CreationEvaluationReport {
    const report = this.store.evaluations.get(runId);
    if (!report) throw new Error(`Evaluation not found: ${runId}`);
    return report;
  }
}
