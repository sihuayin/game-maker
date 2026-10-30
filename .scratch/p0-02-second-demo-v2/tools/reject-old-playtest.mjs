#!/usr/bin/env node
// 票 10 的负向 E3：把冻结 Demo 现有的 harness v1 / rules v1 报告塞回写回层，必须被拒。
// 用法：node .scratch/p0-02-second-demo-v2/tools/reject-old-playtest.mjs <copyRoot>
//   copyRoot 是含 wasteland-scavenger-recipe/{pack,site,run} 的独立副本根。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PlaytestReportSchema } from '../../../packages/contracts/dist/index.js';
import { writePlaytestToReport } from '../../../packages/pipeline/dist/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const outRoot = path.resolve(process.argv[2] ?? path.join(REPO, '.scratch/p0-02-second-demo-v2/work/ticket10-reject-old'));
const runDir = path.join(outRoot, 'wasteland-scavenger-recipe', 'run', 'v1');
const reportPath = path.join(runDir, 'playtest', 'v2', 'result.json');
if (!fs.existsSync(reportPath)) {
  console.error(`找不到旧报告：${reportPath}`);
  process.exit(2);
}
const report = PlaytestReportSchema.parse(JSON.parse(fs.readFileSync(reportPath, 'utf8')));
const evidence = [
  { ref: 'playtest-result', path: 'wasteland-scavenger-recipe/run/v1/playtest/v2/result.json' },
  { ref: 'playtest-site-integrity', path: 'wasteland-scavenger-recipe/run/v1/playtest/v2/site-integrity.json' },
];
try {
  writePlaytestToReport({ outRoot, runDir, report, evidence });
  console.error('❌ 旧 harness/rules 报告被接受了 —— 身份校验失效');
  process.exit(1);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  const ok = /harnessVersion/.test(msg) && /playtest-harness\/v1/.test(msg);
  console.log(`${ok ? '✅' : '❌'} 旧报告被拒：${msg}`);
  process.exit(ok ? 0 : 1);
}
