import fs from "node:fs";
const B=process.env.ANTHROPIC_BASE_URL, K=process.env.ANTHROPIC_AUTH_TOKEN;
const b64=fs.readFileSync("/tmp/gen/ref.b64","utf8").trim();
const SPEC=`{
  "id": "style-ref",
  "identity": "string[] 3-6 个风格气质词（如 pixel-art, dystopian...）",
  "camera": {"mode":"string","angle":"string"},
  "composition": {"layout":"string","density":"string"},
  "palette": "string[] 6-10 个 #RRGGBB hex，按画面占比从高到低",
  "lighting": {"direction":"string","contrast":"string","ambience":"string"},
  "shapeLanguage": "string[] 形状特征（直角/圆角/硬边/破碎...）",
  "material": "string[] 材质质感（金属/磨砂/像素抖动/磨损...）",
  "environment": "string[] 环境元素",
  "characterStyle": "string[] 角色画法（比例/描边/像素粒度...）",
  "constraints": "string[] 生成新资源时必须遵守的规则",
  "confidence": "number 0-1"
}`;
const body={model:"deepseek-v4-pro",max_tokens:3000,
  messages:[{role:"user",content:[
    {type:"image",source:{type:"base64",media_type:"image/png",data:b64}},
    {type:"text",text:`这是一张游戏截图，将作为风格参考图。\n提取它的**视觉语法**（不要描述画面内容、不要提 UI 文字）。\npalette 必须是 #RRGGBB hex 数组，只列**真实存在**的颜色，不要补全猜测色。\n严格按以下 JSON 结构输出，只输出 JSON 本体，不要 markdown 围栏：\n${SPEC}`}]}]};
const t0=Date.now();
const r=await fetch(`${B}/v1/messages`,{method:"POST",headers:{"content-type":"application/json","x-api-key":K},body:JSON.stringify(body)});
const j=await r.json();
const txt=(j.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("").trim()
  .replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
console.log(`HTTP ${r.status}  ${(Date.now()-t0)/1000}s  tokens: in=${j.usage?.input_tokens} out=${j.usage?.output_tokens}`);
let p; try{ p=JSON.parse(txt); }catch(e){ console.log("PARSE FAIL:",e.message,"\nraw:",txt.slice(0,400)); process.exit(1); }
const req=["id","identity","camera","composition","palette","lighting","shapeLanguage","material","environment","characterStyle","constraints","confidence"];
const miss=req.filter(k=>!(k in p));
if(miss.length){ console.log("missing fields:",miss); }
fs.writeFileSync("/tmp/gen/stylespec.json",JSON.stringify(p,null,2));
console.log("\nidentity     :",JSON.stringify(p.identity));
console.log("palette      :",JSON.stringify(p.palette));
console.log("shapeLanguage:",JSON.stringify(p.shapeLanguage));
console.log("material     :",JSON.stringify(p.material));
console.log("character    :",JSON.stringify(p.characterStyle));
console.log("constraints  :",JSON.stringify(p.constraints).slice(0,500));
