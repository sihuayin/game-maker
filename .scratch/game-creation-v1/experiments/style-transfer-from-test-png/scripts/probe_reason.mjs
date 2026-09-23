import fs from "node:fs";
const B=process.env.ANTHROPIC_BASE_URL,K=process.env.ANTHROPIC_AUTH_TOKEN;
const SS=JSON.parse(fs.readFileSync("/tmp/gen/stylespec.json","utf8"));
const msg={role:"user",content:`constraints: ${JSON.stringify(SS.constraints)}\n\n为横版跳跃游戏生成一个地面砖块的 drawlist（JSON），op 只能用 rect/circle/ellipse/poly/line/curve，颜色只能是 palette:N。只输出 JSON。`};
const variants=[
  ["max_tokens=8000（仅加大）",{max_tokens:8000}],
  ["reasoning_effort=low",{max_tokens:4000,reasoning_effort:"low"}],
  ["thinking=disabled",{max_tokens:4000,thinking:{type:"disabled"}}],
  ["chat_template_kwargs no-think",{max_tokens:4000,chat_template_kwargs:{thinking:false}}]
];
for(const [name,extra] of variants){
  const t0=Date.now();
  const r=await fetch(`${B}/v1/chat/completions`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${K}`},
    body:JSON.stringify({model:"deepseek-v4-pro",messages:[msg],...extra})});
  const j=await r.json(); const dt=((Date.now()-t0)/1000).toFixed(0);
  const c=j.choices?.[0]?.message?.content||"";
  const u=j.usage||{};
  const ok=c.trim().startsWith("{");
  console.log(`${ok?"✓":"✗"} ${name.padEnd(30)} ${String(dt).padStart(3)}s  finish=${(j.choices?.[0]?.finish_reason||"-").padEnd(6)} reason=${String(u.completion_tokens_details?.reasoning_tokens??0).padStart(4)} content=${String(c.length).padStart(5)}B${ok?"  JSON-OK":""}`);
  if(ok) fs.writeFileSync("/tmp/gen/platform.probe.json",c);
}
