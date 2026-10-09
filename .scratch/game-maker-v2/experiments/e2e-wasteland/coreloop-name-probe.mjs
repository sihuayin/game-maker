// 票 23 的探针 ③：`coreLoop` 这个**键名本身**是不是病根。
//
// 已确立的事实（12 次往返）：工具 schema 里 `coreLoop` 明明白白写着
// `{"type":"array","items":{"type":"string"}}` 且在 `required` 里，
// 而模型 **12/12 吐字符串**；同期 `winConditions` / `loseConditions` / `ambiguity` /
// `entities` / `mechanics` **全部 12/12 是数组**。 ⇒ 不是「模型不会用数组」。
// 改提示词那句（连「这是一个字符串数组」都写上了）**一发都没救回来**（9/9 仍是字符串）。
//
// 剩下的假设只剩「**键名**」：`coreLoop` 是单数、是一个在游戏设计里惯用一句话描述的概念；
// 而 `winConditions` 是复数、「条件」天然是个清单。本探针把**同一个请求**里的键名换掉再发。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/coreloop-name-probe.mjs
import fs from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const RAW = path.join(HERE, "raw", "coreloop-name");
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(RAW, { recursive: true });

const base = JSON.parse(fs.readFileSync(path.join(HERE, "raw", "intent-raw", "01.request.json"), "utf8"));
const N = 3;

/** 把请求体里 `coreLoop` 这个键名整体换掉（schema 的 properties/required + 提示词那句）。 */
function rename(body, to) {
  const s = JSON.stringify(body).replaceAll('"coreLoop"', JSON.stringify(to));
  return JSON.parse(s.replaceAll("`coreLoop`", `\`${to}\``));
}

const ARMS = {
  "a-现状(coreLoop)": (b) => b,
  "b-复数(coreLoops)": (b) => rename(b, "coreLoops"),
  "c-描述性(coreLoopSteps)": (b) => rename(b, "coreLoopSteps"),
  "d-无关词(zorbixList)": (b) => rename(b, "zorbixList"),
};

const summary = {};
for (const [arm, patch] of Object.entries(ARMS)) {
  const body = patch(JSON.parse(JSON.stringify(base)));
  const field = Object.keys(body.tools[0].input_schema.properties).find((k) => /coreLoop|zorbix/.test(k));
  const counts = { array: 0, string: 0, other: 0 };
  for (let i = 1; i <= N; i++) {
    const res = await fetch(`${process.env["ANTHROPIC_BASE_URL"]}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env["ANTHROPIC_AUTH_TOKEN"], "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    fs.writeFileSync(path.join(RAW, `${arm}.${i}.json`), txt);
    const doc = JSON.parse(txt);
    const inp = doc.content?.find((c) => c.type === "tool_use")?.input;
    const v = inp?.[field];
    const kind = Array.isArray(v) ? "array" : typeof v === "string" ? "string" : "other";
    counts[kind] += 1;
  }
  summary[arm] = { field, ...counts };
  console.log(`${arm.padEnd(24)} 键名="${field}"  ${JSON.stringify(counts)}`);
}
fs.writeFileSync(path.join(HERE, "raw", "coreloop-name-summary.json"), JSON.stringify(summary, null, 1));
console.log(`\n原始落在 ${path.relative(ROOT, RAW)}/`);
