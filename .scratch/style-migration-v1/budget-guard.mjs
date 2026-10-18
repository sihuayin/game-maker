// B 阶段的预算闸：只允许文本上游，≤MAX 发，墙钟硬停。
// 用法：node --import ./budget-guard.mjs packages/cli/dist/cli.js create ...
import fs from "node:fs";
const MAX = Number(process.env.STYLE_B_MAX_CALLS ?? "15");
const WALL = Number(process.env.STYLE_B_WALL_MS ?? String(20 * 60 * 1000));
const LOG = process.env.STYLE_B_LOG ?? ".scratch/style-migration-v1/runs/2026-10-18a/text-calls.log";
const BASE = process.env.ANTHROPIC_BASE_URL ?? "";
const origin = (() => { try { return new URL(BASE).origin; } catch { return ""; } })();
let n = 0;
const log = (line) => fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);
log(`GUARD start max=${MAX} wall=${WALL}ms origin=${origin}`);
const orig = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (!origin || !url.startsWith(origin)) {
    log(`BLOCK non-text url=${url}`);
    throw new Error(`STAGE_B_BLOCKED: non-text fetch ${url}`);
  }
  n += 1;
  if (n > MAX) { log(`STOP budget exceeded n=${n}`); process.exit(124); }
  const body = init?.body === undefined ? 0 : String(init.body).length;
  log(`CALL #${n} ${url} body=${body}B`);
  try {
    const res = await orig(input, init);
    log(`DONE #${n} status=${res.status}`);
    return res;
  } catch (e) {
    log(`FAIL #${n} ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
};
const t = setTimeout(() => { log("STOP wall clock"); process.exit(124); }, WALL);
t.unref();
