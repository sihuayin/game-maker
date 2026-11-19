import fs from 'node:fs';
import crypto from 'node:crypto';
import { parseGameConfig, parseAssetPack } from '/Volumes/shy/some-projects/game-maker/packages/contracts/dist/index.js';
import { temporalScope, analyzeTemporalInternalTwoLag } from '/Volumes/shy/some-projects/game-maker/packages/contracts/dist/playability/temporal.js';
import { verifyTemporalInput } from '/Volumes/shy/some-projects/game-maker/packages/contracts/dist/playability/temporal-input.js';
const root='/Volumes/shy/some-projects/game-maker';
const digest=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const c=fs.readFileSync(root+'/fixtures/game-configs/last-train.json');
const m=fs.readFileSync(root+'/fixtures/packs/last-train/v2/manifest.json');
const cp=parseGameConfig(JSON.parse(c)); const mp=parseAssetPack(JSON.parse(m));
if(!cp.ok||!mp.ok){console.log(JSON.stringify({stage:'parse',config:cp,manifest:mp}));process.exit(0)}
const config=cp.value, manifest=mp.value, scope=temporalScope(config);
const paths=[...new Set(scope.assetIds.map(id=>manifest.assets.find(a=>a.id===id)).filter(Boolean).map(a=>manifest.atlases.find(x=>x.id===a.atlasId)?.meta).filter(Boolean))].sort();
const atlases=paths.map(path=>({path,bytes:fs.readFileSync(root+'/fixtures/packs/last-train/v2/'+path)}));
const trusted=verifyTemporalInput({manifest,assetIds:scope.assetIds,atlases,digest});
const base={configHash:digest(c),manifestHash:digest(m),scope,atlases:atlases.map(a=>({path:a.path,bytes:a.bytes.length,hash:digest(a.bytes)})),verify:trusted.ok?{ok:true,files:trusted.value.files,assets:[...trusted.value.assets],frameCount:trusted.value.frames.size}:{ok:false,failures:trusted.failures}};
if(!trusted.ok){console.log(JSON.stringify({...base,stage:'verify'},null,2));process.exit(0)}
const result=analyzeTemporalInternalTwoLag({config,manifest,lagMs:16.67,trustedInput:trusted.value},200);
console.log(JSON.stringify({...base,stage:'model',lagMs:[16.67,200],result},null,2));
