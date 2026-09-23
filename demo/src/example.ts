import { InMemoryCreationStore } from "./runtime/in-memory-store.js";
import { CreationOrchestrator } from "./runtime/orchestrator.js";
import { CreationRuntime } from "./runtime/creation-runtime.js";
import { MockEvaluator } from "./qa/evaluator.js";
import { DefaultRepairEngine } from "./repair/repair-engine.js";
import type { RuntimePorts } from "./runtime/ports.js";
import type { ArtifactRef, AssetManifest, CreationProject, CreationRun, GameSpec, GameplayTestPlan, StyleSpec } from "./contracts/index.js";

const artifact = (id:string,type:ArtifactRef["type"],version=1):ArtifactRef =>
  ({id,type,path:`artifacts/${id}`,version,checksum:`mock-${id}-${version}`,createdAt:new Date().toISOString()});

const ports: RuntimePorts = {
  compiler: {
    async compileStyle(_p:CreationProject):Promise<StyleSpec> {
      return {id:"style-1",identity:["cozy stylized 2D"],camera:{mode:"top-down"},
        composition:{},palette:["warm green","cream","brown"],lighting:{},shapeLanguage:["soft","rounded"],
        material:["painted"],environment:["pastoral"],characterStyle:["cute"],constraints:[],confidence:.9};
    },
    async compileGame(_p:CreationProject):Promise<GameSpec> {
      return {id:"game-1",title:"Demo Farm",coreLoop:["move","interact","harvest"],world:{},
        player:{},mechanics:["harvest"],entities:[{id:"crop.tomato.01",type:"crop"}],
        scenes:[{id:"farm",name:"Farm"}],ui:[],rules:[],winConditions:["harvest tomato"],
        loseConditions:[],requirements:[
          {id:"r1",description:"Player can move",priority:"core",acceptance:["player moves"]},
          {id:"r2",description:"Player can harvest",priority:"core",acceptance:["crop harvested"]}
        ]};
    },
    async compileAssets(game,style):Promise<AssetManifest> {
      const assets=[{id:"player",role:"player",description:"player",styleId:style.id,visual:{},geometry:{},states:[],variants:[],dependencies:[],required:true},
        {id:"tomato",role:"crop",description:"tomato crop",styleId:style.id,visual:{},geometry:{},states:["idle","harvested"],variants:[],dependencies:[],required:true}];
      return {id:"manifest-1",assets,generated:2,missing:0,broken:0,unused:0};
    },
    async compileGameplayTests(game):Promise<GameplayTestPlan> {
      return {id:"tests-1",gameSpecId:game.id,tests:[
        {id:"boot",name:"Boot",category:"boot",actions:[{type:"wait",duration:100}],assertions:[{type:"game_state",expected:"playing"}],critical:true},
        {id:"harvest",name:"Harvest",category:"mechanic",actions:[{type:"interact",target:"crop.tomato.01"}],
          assertions:[{type:"entity_state",target:"crop.tomato.01",expected:"harvested"}],critical:true}
      ],criticalTests:["boot","harvest"],successCriteria:["boot","harvest"]};
    }
  },
  assets: {
    async generate(manifest):Promise<ArtifactRef[]> {
      return manifest.assets.map(a=>artifact(a.id,"asset",1));
    }
  },
  builder: {
    async build():Promise<ArtifactRef> { return artifact("build","build",1); }
  },
  runner: {
    async start() {}, async stop() {}
  },
  observer: {
    async collect(run):Promise<any[]> {
      return [{id:"obs-1",runId:run.id,frame:1,timestamp:Date.now(),scene:{id:"farm",name:"Farm"},
        camera:{},entities:[],ui:[],gameState:"playing",events:[]}];
    }
  },
  evaluator: new MockEvaluator(),
  repair: new DefaultRepairEngine()
};

const store = new InMemoryCreationStore();
const runtime = new CreationRuntime(store, new CreationOrchestrator(store, ports));

const run = await runtime.create({
  title:"Demo Farm",
  requirement:"A small cozy farm where the player can move and harvest a tomato.",
  referenceImage:"references/style.png"
});

console.log(JSON.stringify({
  runId:run.id,
  status:run.status,
  iteration:run.iteration,
  report: runtime.getReport(run.id)
}, null, 2));
