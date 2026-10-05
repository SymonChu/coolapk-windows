#!/bin/bash
# 盯 v0.1.0 那轮 CI，跑完后把「启动自检」那步的输出摘出来
T=$(cat ~/.github_token | tr -d '\n\r')
API=https://api.github.com/repos/SymonChu/coolapk-windows
RID=37262676489
for i in $(seq 1 40); do
  curl -s -H "Authorization: Bearer $T" "$API/actions/runs/$RID" -o /tmp/r.json
  st=$(python3 -c "import json;d=json.load(open('/tmp/r.json'));print(d['status'], d['conclusion'] or '-')" 2>/dev/null)
  echo "$(date +%H:%M:%S) $st"
  case "$st" in "completed"*) break ;; esac
  sleep 45
done
JID=$(curl -s -H "Authorization: Bearer $T" "$API/actions/runs/$RID/jobs" | python3 -c "import json,sys;print(json.load(sys.stdin)['jobs'][0]['id'])")
echo "== 各步骤结果 =="
curl -s -H "Authorization: Bearer $T" "$API/actions/runs/$RID/jobs" | python3 -c "
import json,sys
for j in json.load(sys.stdin)['jobs']:
    for s in j['steps']: print('  ',s['number'],s['name'],'->',s['conclusion'])"
echo "== 启动自检输出 =="
curl -sL -H "Authorization: Bearer $T" "$API/actions/jobs/$JID/logs" -o /tmp/joblog.txt
grep -nE "启动失败|启动成功|退出码|查找日志目录|coolapk-diagnostics|runtime\.started|runtime\.panic|error while building|WebView" /tmp/joblog.txt | head -40
echo "== Release =="
curl -s -H "Authorization: Bearer $T" "$API/releases" | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('Release 数:',len(d))
for r in d[:1]:
    print(r['tag_name'], r['published_at'])
    for a in r.get('assets',[]): print('  资产:',a['name'],round(a['size']/1048576,2),'MB',a['browser_download_url'])"
