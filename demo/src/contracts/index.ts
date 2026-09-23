import { z } from "zod";

export const CreationStatus = z.enum([
  "created","compiling","compiled","generating","generated","building",
  "built","running","evaluating","repairing","finalizing","passed","failed","cancelled"
]);
export type CreationStatus = z.infer<typeof CreationStatus>;

export const RequirementPriority = z.enum(["core","important","optional"]);
export const RequirementSchema = z.object({
  id: z.string(), description: z.string(), priority: RequirementPriority,
  acceptance: z.array(z.string()).default([])
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const StyleSpecSchema = z.object({
  id: z.string(), identity: z.array(z.string()),
  camera: z.record(z.unknown()).default({}),
  composition: z.record(z.unknown()).default({}),
  palette: z.array(z.string()).default([]),
  lighting: z.record(z.unknown()).default({}),
  shapeLanguage: z.array(z.string()).default([]),
  material: z.array(z.string()).default([]),
  environment: z.array(z.string()).default([]),
  characterStyle: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1)
});
export type StyleSpec = z.infer<typeof StyleSpecSchema>;

export const GameSpecSchema = z.object({
  id: z.string(),
  title: z.string(),
  coreLoop: z.array(z.string()),
  world: z.record(z.unknown()).default({}),
  player: z.record(z.unknown()).default({}),
  mechanics: z.array(z.string()),
  entities: z.array(z.record(z.unknown())),
  scenes: z.array(z.record(z.unknown())),
  ui: z.array(z.record(z.unknown())),
  rules: z.array(z.string()),
  winConditions: z.array(z.string()),
  loseConditions: z.array(z.string()),
  requirements: z.array(RequirementSchema)
});
export type GameSpec = z.infer<typeof GameSpecSchema>;

export const AssetSpecSchema = z.object({
  id: z.string(), role: z.string(), description: z.string(),
  styleId: z.string(), visual: z.record(z.unknown()).default({}),
  geometry: z.record(z.unknown()).default({}),
  states: z.array(z.string()).default([]),
  variants: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  required: z.boolean().default(true)
});
export type AssetSpec = z.infer<typeof AssetSpecSchema>;

export const ArtifactType = z.enum([
  "requirement","style-spec","game-spec","asset-manifest","asset","scene",
  "build","screenshot","evaluation","repair-plan","benchmark"
]);
export const ArtifactRefSchema = z.object({
  id: z.string(), type: ArtifactType, path: z.string(),
  version: z.number().int().positive(), checksum: z.string(), createdAt: z.string()
});
export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;

export const AssetManifestSchema = z.object({
  id: z.string(), assets: z.array(AssetSpecSchema),
  generated: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  broken: z.number().int().nonnegative(),
  unused: z.number().int().nonnegative()
});
export type AssetManifest = z.infer<typeof AssetManifestSchema>;

export const TestActionSchema = z.discriminatedUnion("type", [
  z.object({type:z.literal("move"), direction:z.enum(["up","down","left","right"]), duration:z.number().optional()}),
  z.object({type:z.literal("click"), target:z.string()}),
  z.object({type:z.literal("press"), key:z.string()}),
  z.object({type:z.literal("wait"), duration:z.number()}),
  z.object({type:z.literal("interact"), target:z.string()}),
  z.object({type:z.literal("select"), target:z.string()})
]);
export type TestAction = z.infer<typeof TestActionSchema>;

export const TestAssertionSchema = z.object({
  type: z.enum(["entity_exists","entity_state","variable","scene","ui_visible","game_state"]),
  target: z.string().optional(), expected: z.unknown().optional()
});
export type TestAssertion = z.infer<typeof TestAssertionSchema>;

export const GameplayTestCaseSchema = z.object({
  id:z.string(), name:z.string(),
  category:z.enum(["boot","navigation","interaction","mechanic","progression","win","lose","ui"]),
  preconditions:z.array(z.record(z.unknown())).default([]),
  actions:z.array(TestActionSchema), assertions:z.array(TestAssertionSchema),
  critical:z.boolean()
});
export type GameplayTestCase = z.infer<typeof GameplayTestCaseSchema>;

export const GameplayTestPlanSchema = z.object({
  id:z.string(), gameSpecId:z.string(), tests:z.array(GameplayTestCaseSchema),
  criticalTests:z.array(z.string()), successCriteria:z.array(z.string())
});
export type GameplayTestPlan = z.infer<typeof GameplayTestPlanSchema>;

export const RuntimeEntitySchema = z.object({
  id:z.string(), type:z.string(),
  position:z.object({x:z.number(),y:z.number()}),
  bounds:z.object({x:z.number(),y:z.number(),width:z.number(),height:z.number()}),
  visible:z.boolean(), state:z.string(), interactive:z.boolean()
});
export const RuntimeObservationSchema = z.object({
  id:z.string(), runId:z.string(), frame:z.number(), timestamp:z.number(),
  scene:z.object({id:z.string(),name:z.string()}),
  camera:z.record(z.unknown()).default({}),
  player:z.record(z.unknown()).optional(),
  entities:z.array(RuntimeEntitySchema),
  ui:z.array(z.record(z.unknown())),
  gameState:z.enum(["booting","playing","paused","won","lost","error"]),
  events:z.array(z.record(z.unknown())),
  screenshot:z.string().optional()
});
export type RuntimeObservation = z.infer<typeof RuntimeObservationSchema>;

export const RequirementCoverageSchema = z.object({
  total:z.number(), implemented:z.number(), tested:z.number(), passed:z.number(),
  coverage:z.number().min(0).max(1), missing:z.array(z.string())
});
export type RequirementCoverage = z.infer<typeof RequirementCoverageSchema>;

export const AssetCompletenessReportSchema = z.object({
  totalRequired:z.number(), generatedRequired:z.number(), completeness:z.number(),
  criticalMissing:z.array(z.string()), broken:z.array(z.string())
});
export type AssetCompletenessReport = z.infer<typeof AssetCompletenessReportSchema>;

export const VisualIssueSchema = z.object({
  id:z.string(), severity:z.enum(["critical","major","minor"]),
  category:z.string(), message:z.string(), evidenceIds:z.array(z.string())
});
export const VisualReportSchema = z.object({
  score:z.number().min(0).max(1), styleConsistency:z.number().min(0).max(1),
  novelAssetStyleConsistency:z.number().min(0).max(1),
  issues:z.array(VisualIssueSchema)
});
export type VisualReport = z.infer<typeof VisualReportSchema>;

export const GameplayReportSchema = z.object({
  passed:z.number(), total:z.number(), passRate:z.number().min(0).max(1),
  criticalPassed:z.number(), criticalTotal:z.number(),
  failures:z.array(z.object({testId:z.string(),message:z.string()}))
});
export type GameplayReport = z.infer<typeof GameplayReportSchema>;

export const RuntimeHealthReportSchema = z.object({
  boot:z.boolean(), sceneLoad:z.boolean(), crashes:z.number(),
  runtimeErrors:z.number(), assetLoadErrors:z.number(), missingResources:z.number(),
  averageFps:z.number().optional(), minFps:z.number().optional(), memoryWarnings:z.number()
});
export type RuntimeHealthReport = z.infer<typeof RuntimeHealthReportSchema>;

export const QualityDimensionSchema = z.object({name:z.string(),score:z.number().min(0).max(1),weight:z.number().min(0)});
export type QualityDimension = z.infer<typeof QualityDimensionSchema>;

export const GateCheckSchema = z.object({
  id:z.string(), category:z.enum(["runtime","asset","visual","gameplay","requirement"]),
  name:z.string(), required:z.boolean(),
  status:z.enum(["pass","fail","warning","not-run"]), score:z.number().optional(),
  evidenceIds:z.array(z.string()), message:z.string().optional()
});
export type GateCheck = z.infer<typeof GateCheckSchema>;

export const CreationGateResultSchema = z.object({
  status:z.enum(["pass","fail","warning"]),
  hardGate:z.object({passed:z.boolean(),checks:z.array(GateCheckSchema)}),
  quality:z.object({score:z.number(),dimensions:z.array(QualityDimensionSchema)}),
  blockers:z.array(z.string()), recommendations:z.array(z.string())
});
export type CreationGateResult = z.infer<typeof CreationGateResultSchema>;

export const CreationEvaluationReportSchema = z.object({
  runId:z.string(), requirement:RequirementCoverageSchema,
  assets:AssetCompletenessReportSchema, visual:VisualReportSchema,
  gameplay:GameplayReportSchema, runtime:RuntimeHealthReportSchema,
  interaction:z.object({score:z.number().min(0).max(1),issues:z.array(z.string())}),
  quality:z.object({score:z.number(),dimensions:z.array(QualityDimensionSchema)}),
  gate:CreationGateResultSchema,
  evidence:z.array(z.object({id:z.string(),type:z.string(),message:z.string(),artifactIds:z.array(z.string())}))
});
export type CreationEvaluationReport = z.infer<typeof CreationEvaluationReportSchema>;

export const RepairBudgetSchema = z.object({
  maxIterations:z.number().int().positive(), maxAssetRegenerations:z.number().int().nonnegative(),
  maxCodeRepairs:z.number().int().nonnegative(), maxDurationMs:z.number().positive(),
  maxCost:z.number().nonnegative().optional()
});
export type RepairBudget = z.infer<typeof RepairBudgetSchema>;

export const RepairActionSchema = z.object({
  id:z.string(), type:z.enum(["asset","code","scene","ui","runtime"]),
  targetId:z.string(), strategy:z.string(), reason:z.string()
});
export const RepairPlanSchema = z.object({
  id:z.string(), runId:z.string(), actions:z.array(RepairActionSchema),
  estimatedCost:z.number().nonnegative().default(0)
});
export type RepairPlan = z.infer<typeof RepairPlanSchema>;

export const BestStateSchema = z.object({
  artifacts:z.array(ArtifactRefSchema), qualityScore:z.number(),
  gateStatus:z.enum(["pass","fail"]), iteration:z.number()
});
export type BestState = z.infer<typeof BestStateSchema>;

export const CreationRunSchema = z.object({
  id:z.string(), projectId:z.string(), status:CreationStatus,
  iteration:z.number().int().nonnegative(), attempt:z.number().int().nonnegative(),
  createdAt:z.string(), updatedAt:z.string(),
  currentTaskId:z.string().optional(), checkpointId:z.string().optional(),
  budget:RepairBudgetSchema,
  execution:z.object({paused:z.boolean(),cancelRequested:z.boolean(),pauseReason:z.string().optional()}),
  best:BestStateSchema.optional()
});
export type CreationRun = z.infer<typeof CreationRunSchema>;

export const CreationCheckpointSchema = z.object({
  id:z.string(), runId:z.string(), phase:z.string(), iteration:z.number(),
  artifacts:z.array(ArtifactRefSchema), runtimeState:z.record(z.unknown()).optional(),
  evaluation:CreationEvaluationReportSchema.optional(), createdAt:z.string()
});
export type CreationCheckpoint = z.infer<typeof CreationCheckpointSchema>;

export const CreationProjectSchema = z.object({
  id:z.string(), title:z.string(), requirement:z.string(),
  referenceImage:z.string().optional(), createdAt:z.string()
});
export type CreationProject = z.infer<typeof CreationProjectSchema>;
