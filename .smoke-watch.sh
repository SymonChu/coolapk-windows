#!/bin/bash
# 盯最新一轮 CI（main 分支），跑完后把「启动自检」的输出摘出来
T=$(cat ~/.github_token | tr -d '\n\r')
API=https://api.github.com/repos/SymonChu/coolapk-windows
for i in $(seq 1 40); do
  curl -s -H "Authorization: Bearer $T" "$API/actions/runs?per_page=6" -o /tmp/cw.json
  RID=$(python3 -c "
import json
d=json.load(open('/tmp/cw.json'))
rs=[x for x in d['workflow_runs'] if x.get('head_branch')=='main']
r=rs[0] if rs else None
print(r['id'], r['status'], r['conclusion'] or '-', r['head_sha'][:7]) if r else print('none')")
  set -- $RID
  echo "$(date +%H:%M:%S) run=$1 $2 $3 $4"
  case "$2" in "completed") break ;; esac
  sleep 45
done
RUNID=$1
echo "== 各步骤 =="
curl -s -H "Authorization: Bearer $T" "$API/actions/runs/$RUNID/jobs" -o /tmp/cj.json
python3 -c "
import json
for j in json.load(open('/tmp/cj.json'))['jobs']:
    print('JOB',j['name'],j['conclusion'])
    for s in j['steps']: print('   ',s['number'],s['name'],'->',s['conclusion'])"
JID=$(python3 -c "import json;print(json.load(open('/tmp/cj.json'))['jobs'][0]['id'])")
curl -sL -H "Authorization: Bearer $T" "$API/actions/jobs/$JID/logs" -o /tmp/clog.txt
echo "== 启动自检 / 编译错误 =="
grep -nE "启动失败|启动成功|退出码|stderr|启动追踪|runtime\.started|runtime\.panic|error\[E|^error:|error while building" /tmp/clog.txt | head -30
echo "== 自检段落原文 =="
awk '/启动自检（真跑一次/,/上传单文件 exe/' /tmp/clog.txt | sed 's/^[0-9T:.Z-]*Z //' | head -60
