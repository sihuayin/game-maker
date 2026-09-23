import fs from "node:fs";
const SS=JSON.parse(fs.readFileSync("/tmp/gen/stylespec.json","utf8"));
const pal=SS.palette;
const items=["player.idle","player.jump","platform.idle","pickup.idle","hazard.idle","bg_sign.idle"]
  .map(n=>{const [id,st]=n.split(".");return {n,o:JSON.parse(fs.readFileSync(`/tmp/gen/${id}.${st}.json`,"utf8"))};});
const C=s=>pal[+s.split(":")[1]]||"#f0f";
function catmull(P,closed){let d=`M${P[0][0]} ${P[0][1]}`;for(let i=0;i<P.length-1;i++){const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;
 d+=` C${(p1[0]+(p2[0]-p0[0])/6).toFixed(2)} ${(p1[1]+(p2[1]-p0[1])/6).toFixed(2)}, ${(p2[0]-(p3[0]-p1[0])/6).toFixed(2)} ${(p2[1]-(p3[1]-p1[1])/6).toFixed(2)}, ${p2[0]} ${p2[1]}`;}return closed?d+" Z":d;}
function body(o){return (o.ops||[]).map(op=>{
 const f=op.fill&&op.fill!=="none"?` fill="${C(op.fill)}"`:' fill="none"';
 const st=op.stroke?` stroke="${C(op.stroke)}" stroke-width="${op.strokeWidth||1}" stroke-linecap="round"`:"";
 const oq=op.opacity!=null?` opacity="${op.opacity}"`:"";
 switch(op.op){case"rect":return`<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}"${f}${st}${oq}/>`;
 case"circle":return`<circle cx="${op.cx}" cy="${op.cy}" r="${op.r}"${f}${st}${oq}/>`;
 case"ellipse":return`<ellipse cx="${op.cx}" cy="${op.cy}" rx="${op.rx}" ry="${op.ry}"${f}${st}${oq}/>`;
 case"poly":return`<polygon points="${op.points.map(q=>q.join(",")).join(" ")}"${f}${st}${oq}/>`;
 case"line":return`<line x1="${op.x1}" y1="${op.y1}" x2="${op.x2}" y2="${op.y2}"${st}${oq}/>`;
 case"curve":return`<path d="${catmull(op.points,op.closed)}"${f}${st}${oq}/>`;}}).join("");}
const CW=170,CH=250,S=5;
const W=CW*items.length+40,H=CH+90;
let x=20;
const cells=items.map(({n,o})=>{
 const sc=Math.min((CW-30)/o.viewBox[2],(CH-70)/o.viewBox[3],S);
 const ox=x+(CW-o.viewBox[2]*sc)/2, oy=40+(CH-70-o.viewBox[3]*sc)/2;
 const g=`<g transform="translate(${ox},${oy}) scale(${sc})">${body(o)}</g>`;
 const lbl=`<text x="${x+CW/2}" y="${CH+22}" text-anchor="middle" font-family="Menlo,monospace" font-size="15" fill="#a8b5ae">${n}</text>`
         + `<text x="${x+CW/2}" y="${CH+42}" text-anchor="middle" font-family="Menlo,monospace" font-size="12" fill="#66756e">ops=${o.ops.length} bbox=${(()=>{let a=1e9,b=1e9,c=-1e9,d=-1e9;const p=(X,Y)=>{if(X<a)a=X;if(Y<b)b=Y;if(X>c)c=X;if(Y>d)d=Y;};for(const op of o.ops){const s2=(op.strokeWidth||0)/2;
 if(op.op==="rect"){p(op.x-s2,op.y-s2);p(op.x+op.w+s2,op.y+op.h+s2);}else if(op.op==="circle"){p(op.cx-op.r-s2,op.cy-op.r-s2);p(op.cx+op.r+s2,op.cy+op.r+s2);}else if(op.op==="ellipse"){p(op.cx-op.rx-s2,op.cy-op.ry-s2);p(op.cx+op.rx+s2,op.cy+op.ry+s2);}else if(op.op==="line"){p(op.x1-s2,op.y1-s2);p(op.x2+s2,op.y2+s2);}else if(op.points)for(const q of op.points)p(q[0]-s2,q[1]-s2);}return `${Math.round(c-a)}×${Math.round(d-b)}`;})()}</text>`;
 const fr=`<rect x="${x+6}" y="20" width="${CW-12}" height="${CH-16}" fill="none" stroke="#2c3538"/>`;
 x+=CW; return fr+g+lbl;}).join("");
const sw=pal.map((c,i)=>`<rect x="${20+i*38}" y="${H-34}" width="34" height="26" fill="${c}"/><text x="${20+i*38+17}" y="${H-8}" text-anchor="middle" font-family="Menlo,monospace" font-size="11" fill="#8b9a94">${i}</text>`).join("");
fs.writeFileSync("/tmp/gen/sheet.svg",`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#171c1f"/>${cells}${sw}</svg>`);
console.log("sheet.svg",W+"x"+H);
