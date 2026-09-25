import fs from "node:fs"; import path from "node:path";
const ROOT="/Volumes/shy/some-projects/game-maker/";
const { decodePNG, encodePNG, emptyImage } = await import(ROOT+"packages/assets/dist/index.js");
const packDir = process.argv[2];
const m = JSON.parse(fs.readFileSync(path.join(packDir,"manifest.json"),"utf8"));
const SCALE=5, PAD=14, BG=[24,28,31];
const items=[];
for (const at of m.atlases) {
  const j = JSON.parse(fs.readFileSync(path.join(packDir, at.meta),"utf8"));
  const img = decodePNG(fs.readFileSync(path.join(packDir, at.image)));
  for (const [name, f] of Object.entries(j.frames)) {
    const sub = emptyImage(f.frame.w, f.frame.h);
    for (let y=0;y<f.frame.h;y++) for (let x=0;x<f.frame.w;x++) {
      const s=((f.frame.y+y)*img.width+f.frame.x+x)*4, d=(y*f.frame.w+x)*4;
      img.data.copy(sub.data, d, s, s+4);
    }
    items.push({name, img: sub});
  }
}
items.forEach(i=>{ i.sc = Math.max(1, Math.min(SCALE, Math.floor(260/Math.max(i.img.width,i.img.height)))); });
const cellW=Math.max(...items.map(i=>i.img.width*i.sc)), cellH=Math.max(...items.map(i=>i.img.height*i.sc));
const COLS=7, ROWS=Math.ceil(items.length/COLS);
const W=PAD+COLS*(cellW+PAD), H=PAD+ROWS*(cellH+PAD);
const sheet=emptyImage(W,H);
for(let i=0;i<W*H;i++){const s=i*4;sheet.data[s]=BG[0];sheet.data[s+1]=BG[1];sheet.data[s+2]=BG[2];sheet.data[s+3]=255;}
items.forEach((it,k)=>{
  const cx=PAD+(k%COLS)*(cellW+PAD), cy=PAD+Math.floor(k/COLS)*(cellH+PAD);
  const ox=cx+Math.floor((cellW-it.img.width*it.sc)/2), oy=cy+Math.floor((cellH-it.img.height*it.sc)/2);
  for(let y=0;y<it.img.height*it.sc;y++)for(let x=0;x<it.img.width*it.sc;x++){
    const s=(Math.floor(y/it.sc)*it.img.width+Math.floor(x/it.sc))*4;
    if(!it.img.data[s+3])continue;
    const d=((oy+y)*W+ox+x)*4;
    for(let c=0;c<4;c++)sheet.data[d+c]=it.img.data[s+c];
  }
});
fs.writeFileSync("/tmp/pack-preview.png", encodePNG(sheet));
console.log(`${items.length} 帧 → /tmp/pack-preview.png（${W}×${H}，${SCALE}× 放大）`);
