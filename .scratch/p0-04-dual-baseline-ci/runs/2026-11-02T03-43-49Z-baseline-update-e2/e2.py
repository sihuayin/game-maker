#!/usr/bin/env python3
import os, sys, json, hashlib, subprocess, time
from pathlib import Path
from datetime import datetime, timezone

REPO=Path.cwd().resolve(); RUN=Path(sys.argv[1]).resolve(); RUN.mkdir(parents=True,exist_ok=True)
STARTED=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
COMMANDS=[]
A_MAN=Path(".scratch/evidence-integrity-v1/manifest/expected-hashes.json"); A_AN=Path(".scratch/evidence-integrity-v1/manifest/expected-hashes.sha256"); A_LOG=Path(".scratch/evidence-integrity-v1/manifest/MANIFEST-UPDATES.md")
B_MAN=Path(".scratch/p0-02-second-demo-v2/manifest/final-manifest.json"); B_AN=Path(".scratch/p0-02-second-demo-v2/manifest/expected-hashes.sha256"); B_LOG=Path(".scratch/p0-02-second-demo-v2/manifest/MANIFEST-UPDATES.md")
REG=Path(".scratch/baselines/registry.json"); FRZ=Path(".scratch/p0-02-second-demo-v2/freeze"); FRZH=Path(".scratch/p0-02-second-demo-v2/freeze-sha256.txt")

def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for c in iter(lambda:f.read(1<<20),b''): h.update(c)
    return "sha256:"+h.hexdigest()

def run(args,timeout=1200):
    t0=time.time(); r=subprocess.run([str(a) for a in args],cwd=REPO,capture_output=True,text=True,timeout=timeout)
    rec={"cmd":" ".join(str(a) for a in args),"exit":r.returncode,"durationMs":int((time.time()-t0)*1000),"stdoutTail":r.stdout[-3000:],"stderrTail":r.stderr[-3000:]}
    COMMANDS.append(rec); return r,rec

def snap():
    paths=[A_MAN,A_AN,A_LOG,B_MAN,B_AN,B_LOG,REG,FRZH]+[p for p in FRZ.rglob("*") if p.is_file()]
    return {str(p):sha(p) for p in sorted({str(x) for x in paths}) if Path(p).is_file()}

def main():
    before=snap()
    changed_file=RUN/"empty-changed-paths.txt"; changed_file.write_text("")
    res={}
    r,c=run(["node","scripts/validate-baseline-candidate.mjs","--base-root",".","--candidate-root",".","--baseline","fpvs-v1","--changed-paths",str(changed_file),"--out",str(RUN/"validation-a.json")]); res["validateA"]=c
    r,c=run(["node","scripts/validate-baseline-candidate.mjs","--base-root",".","--candidate-root",".","--baseline","p0-02-second-demo-v2","--changed-paths",str(changed_file),"--out",str(RUN/"validation-b.json")]); res["validateB"]=c
    for label in ["a","b"]:
        r,c=run(["node","scripts/write-baseline-update-meta.mjs","--out",str(RUN/f"meta-{label}.json"),"--baseline",("fpvs-v1" if label=="a" else "p0-02-second-demo-v2"),"--candidate-sha","7cd7cd4957588f6fe2d39849a7d80dfa2641b0d3","--base-sha","7cd7cd4957588f6fe2d39849a7d80dfa2641b0d3","--base-ref","refs/heads/main","--run-id","e2","--workflow","baseline-update","--actor","sihuayin","--actor-id","0","--triggering-actor","sihuayin","--validation",str(RUN/f"validation-{label}.json"),"--validation-outcome","success","--evidence-outcome","success"]); res[f"meta{label.upper()}"]=c
    r,c=run(["pnpm","test"]); res["test"]=c
    r,c=run(["pnpm","typecheck"]); res["typecheck"]=c
    r,c=run(["pnpm","check:links"]); res["links"]=c
    after=snap(); changed=sorted(k for k in set(before)|set(after) if before.get(k)!=after.get(k))
    metaA=json.loads((RUN/"meta-a.json").read_text()) if (RUN/"meta-a.json").exists() else None
    metaB=json.loads((RUN/"meta-b.json").read_text()) if (RUN/"meta-b.json").exists() else None
    failures=[]
    for k in ["validateA","validateB","metaA","metaB","test","typecheck","links"]:
        if res[k]["exit"]!=0: failures.append(f"{k} exit={res[k]['exit']}")
    if metaA is None or metaA.get("result")!="pass": failures.append("metaA not pass")
    if metaB is None or metaB.get("result")!="pass": failures.append("metaB not pass")
    if changed: failures.append(f"protected changed: {changed[:10]}")
    verdict="PASS" if not failures else "FAIL"
    facts={"format":"p0-04-baseline-update-e2-facts/v1","startedAt":STARTED,"finishedAt":datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),"verdict":verdict,"failures":failures,"results":res,"metaA":metaA,"metaB":metaB,"immutability":{"changed":changed,"protectedFiles":len(before)},"note":"本地 E2；真实 dispatch E3 在 06 合并后执行。","commands":COMMANDS}
    (RUN/"facts.json").write_text(json.dumps(facts,ensure_ascii=False,indent=2)+"\n")
    L=["# P0-04 票 06 · Baseline Update 双基线通道（本地 E2）\n",f"- 生成时间：{STARTED}（UTC）",f"- 结论：**{verdict}**","- 说明：本地 E2；真实 owner dispatch E3 在 06 合并后执行。\n","## 结果\n","| 步骤 | 退出 | 耗时 |","|---|---|---|"]
    for k,v in res.items(): L.append(f"| {k} | {v['exit']} | {v['durationMs']} ms |")
    L.append("\n## Meta\n")
    for label,m in (("A",metaA),("B",metaB)):
        L.append(f"- {label}: result={m.get('result') if m else None} · baseline={m.get('baseline') if m else None} · operator={json.dumps(m.get('operator'),ensure_ascii=False) if m else None}")
    L.append("\n## 零改动\n")
    L.append(f"- 受保护文件快照 {len(before)} 个；变化：**{changed if changed else '无'}**。")
    (RUN/"report.md").write_text("\n".join(L)+"\n")
    print(f"VERDICT={verdict}"); [print('FAIL:',f) for f in failures]; print('RUN=',RUN)
if __name__=="__main__": main()
