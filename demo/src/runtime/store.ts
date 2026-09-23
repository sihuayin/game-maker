import type {
  ArtifactRef, CreationCheckpoint, CreationProject, CreationRun,
  CreationEvaluationReport, RepairPlan, RuntimeObservation
} from "../contracts/index.js";

export interface CreationStore {
  projects: Map<string, CreationProject>;
  runs: Map<string, CreationRun>;
  artifacts: Map<string, ArtifactRef>;
  checkpoints: Map<string, CreationCheckpoint>;
  observations: Map<string, RuntimeObservation[]>;
  evaluations: Map<string, CreationEvaluationReport>;
  repairs: Map<string, RepairPlan[]>;
}
