#!/usr/bin/env python3
import os,sys,json,hashlib,subprocess,time,glob
from pathlib import Path
from datetime import datetime,timezone
REPO=Path.cwd().resolve(); RUN=Path(sys.argv[1]).resolve(); RUN.mkdir(parents=True,exist_ok=True)
STARTED=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"); CMD=[]
A=Path('.scratch/evidence-integrity-v1/manifest/expected-hashes.json'); AA=Path('.scratch/evidence-integrity-v1/manifest/expected-hashes.sha256'); AL=Path('.scratch/evidence-integrity-v1/manifest/MANIFEST-UPDATES.md')
B=Path('.scratch/p0-02-second-demo-v2/manifest/final-manifest.json'); BA=Path('.scratch/p0-02-second-demo-v2/manifest/expected-hashes.sha256'); BL=Path('.scratch/p0-02-second-demo-v2/manifest/MANIFEST-UPDATES.md')
REG=Path('.scratch/baselines/registry.json'); FH=Path('.scratch/p0-02-second-demo-v2/freeze-sha256.txt'); FRZ=Path('.scratch/p0-02-second-demo-v2/freeze')
def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for c in iter(lambda:f.read(1<<20),b''): h.update(c)
    return 'sha256:'+h.hexdigest()
def run(args,timeout=1200):
    t0=time.time(); r=subprocess.run([str(a) for a in args],cwd=REPO,capture_output=True,text=True,timeout=timeout)
    rec={'cmd':' '.join(str(a) for a in args),'exit':r.returncode,'durationMs':int((time.time()-t0)*1000),'stdoutTail':r.stdout[-4000:],'stderrTail':r.stderr[-4000:]}
    CMD.append(rec); return r,rec
def paths():
    ps=[A,AA,AL,B,BA,BL,REG,FH]+[p for p in FRZ.rglob('*') if p.is_file()]
    for man in (A,B):
        d=json.load(open(man))
        for rid,decl in d['roots'].items():
            base=(man.parent/decl).resolve()
            for f in d['files']:
                if f['root']==rid: ps.append(base/f['path'])
    return ps
def snap(): return {str(p):sha(p) for p in sorted({str(x) for x in paths()}) if Path(p).is_file()}
def main():
    before=snap(); res={}
    r,c=run(['node','scripts/validate-baseline-registry.mjs','--registry',str(REG),'--repo-root','.','--require-ids','fpvs-v1,p0-02-second-demo-v2','--exact-ids']); res['registry']=c
    r,c=run(['node','scripts/check-baseline-updates.mjs','--registry',str(REG),'--repo-root','.']); res['updateLogs']=c
    r,c=run(['node','scripts/verify-freeze-snapshot.mjs','--registry',str(REG),'--baseline-id','p0-02-second-demo-v2','--repo-root','.','--head-root','.','--out',str(RUN/'freeze-verification.json')]); res['freeze']=c
    r,c=run(['node','scripts/evidence-acceptance.mjs','--manifest',str(A),'--expected-manifest-sha',AA.read_text().strip(),'--base-manifest',str(A),'--baseline-id','fpvs-v1','--out',str(RUN/'evidence-a')]); res['verifyA']=c
    r,c=run(['node','scripts/evidence-acceptance.mjs','--manifest',str(B),'--expected-manifest-sha',BA.read_text().strip(),'--base-manifest',str(B),'--anchor-mode','digest+base','--baseline-id','p0-02-second-demo-v2','--out',str(RUN/'evidence-b')]); res['verifyB']=c
    asum=sorted(glob.glob(str(RUN/'evidence-a/*-test-evidence/summary.json')))[-1]; arep=sorted(glob.glob(str(RUN/'evidence-a/*-delivery-verification/report.json')))[-1]
    bsum=sorted(glob.glob(str(RUN/'evidence-b/*-test-evidence/summary.json')))[-1]; brep=sorted(glob.glob(str(RUN/'evidence-b/*-delivery-verification/report.json')))[-1]
    r,c=run(['node','scripts/dual-baseline-aggregate.mjs','--registry',str(REG),'--repo-root','.','--a-outcome','success' if res['verifyA']['exit']==0 else 'failure','--b-outcome','success' if res['verifyB']['exit']==0 else 'failure','--b-freeze-outcome','success' if res['freeze']['exit']==0 else 'failure','--a-summary',asum,'--b-summary',bsum,'--a-report',arep,'--b-report',brep,'--a-manifest',str(A),'--b-manifest',str(B),'--b-freeze',str(RUN/'freeze-verification.json'),'--out',str(RUN/'aggregate.json')]); res['aggregate']=c
    r,c=run(['pnpm','test']); res['test']=c
    r,c=run(['pnpm','typecheck']); res['typecheck']=c
    r,c=run(['pnpm','check:links']); res['links']=c
    after=snap(); changed=sorted(k for k in set(before)|set(after) if before.get(k)!=after.get(k))
    ad=json.load(open(A)); bd=json.load(open(B))
    # overlap
    def realmap(man):
        d={}
        for f in man['files']:
            base=(Path(man) if False else None)
        return d
    def abs_for(manpath,man):
        out={}
        for f in man['files']:
            base=(manpath.parent/man['roots'][f['root']]).resolve(); out[str((base/f['path']).resolve())]=f
        return out
    am=abs_for(A,ad); bm=abs_for(B,bd); common=set(am)&set(bm)
    overlap={'count':len(common),'bothRequired':sum(1 for k in common if am[k]['required'] and bm[k]['required']),'aRequiredBOptional':sum(1 for k in common if am[k]['required'] and not bm[k]['required']),'aOptionalBRequired':sum(1 for k in common if not am[k]['required'] and bm[k]['required']),'bothOptional':sum(1 for k in common if not am[k]['required'] and not bm[k]['required'])}
    a_counts={'files':len(ad['files']),'required':sum(1 for f in ad['files'] if f['required']),'optional':sum(1 for f in ad['files'] if not f['required']),'records':len(ad['records']),'roots':len(ad['roots']),'sha256':sha(A)}
    b_counts={'files':len(bd['files']),'required':sum(1 for f in bd['files'] if f['required']),'optional':sum(1 for f in bd['files'] if not f['required']),'records':len(bd['records']),'roots':len(bd['roots']),'sha256':sha(B)}
    b_opt_by_root={}
    for f in bd['files']:
        if not f['required']: b_opt_by_root[f['root']]=b_opt_by_root.get(f['root'],0)+1
    failures=[]
    for k in ['registry','updateLogs','freeze','verifyA','verifyB','aggregate','test','typecheck','links']:
        if res[k]['exit']!=0: failures.append(f"{k} exit={res[k]['exit']}")
    if changed: failures.append('protected changed')
    if a_counts['files']!=223 or a_counts['required']!=151 or a_counts['optional']!=72 or a_counts['records']!=13: failures.append('A counts')
    if b_counts['files']!=231 or b_counts['required']!=137 or b_counts['optional']!=94 or b_counts['records']!=6: failures.append('B counts')
    if overlap['count']!=73: failures.append('overlap count')
    verdict='PASS' if not failures else 'FAIL'
    facts={'format':'p0-04-final-verify/v1','startedAt':STARTED,'finishedAt':datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),'verdict':verdict,'failures':failures,'a':a_counts,'b':b_counts,'bOptionalByRoot':b_opt_by_root,'overlap':overlap,'results':res,'freeze':json.load(open(RUN/'freeze-verification.json')),'aggregate':json.load(open(RUN/'aggregate.json')),'immutability':{'changed':changed,'protectedFiles':len(before)},'commands':CMD}
    (RUN/'facts.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n')
    L=['# P0-04 最终复核（08）\n',f'- 生成时间：{STARTED}（UTC）',f'- 结论：**{verdict}**\n','## 基线\n',f'- A：{a_counts["files"]} / {a_counts["required"]} / {a_counts["optional"]} / {a_counts["records"]} records / {a_counts["roots"]} roots · `{a_counts["sha256"]}`',f'- B：{b_counts["files"]} / {b_counts["required"]} / {b_counts["optional"]} / {b_counts["records"]} records / {b_counts["roots"]} roots · `{b_counts["sha256"]}`',f'- B optional by root：`{json.dumps(b_opt_by_root,ensure_ascii=False)}`',f'- A/B overlap：`{json.dumps(overlap,ensure_ascii=False)}`\n','## 命令\n','| 步骤 | 退出 | 耗时 |','|---|---|---|']
    for k,v in res.items(): L.append(f'| {k} | {v["exit"]} | {v["durationMs"]} ms |')
    L.append(f'\n## 零改动\n\n- 受保护文件 {len(before)} 个；变化：**{changed if changed else "无"}**。\n')
    L.append('## Freeze\n\n```json\n'+json.dumps(facts['freeze'],ensure_ascii=False,indent=2)+'\n```\n')
    L.append('## Aggregate\n\n```json\n'+json.dumps(facts['aggregate'],ensure_ascii=False,indent=2)+'\n```\n')
    (RUN/'report.md').write_text('\n'.join(L)+'\n')
    print('VERDICT=',verdict); [print('FAIL:',f) for f in failures]; print('RUN=',RUN)
if __name__=='__main__': main()
