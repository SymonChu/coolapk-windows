#!/bin/bash
# 盯 SymonChu/coolapk-windows 最新一次 CI 运行，结束后打印结论与失败步骤
T=$(cat ~/.github_token | tr -d '\n\r')
API="https://api.github.com/repos/SymonChu/coolapk-windows"
for i in $(seq 1 90); do
  curl -s -H "Authorization: Bearer $T" "$API/actions/runs?per_page=1" -o /tmp/ci.json
  st=$(python3 -c "
import json
r=json.load(open('/tmp/ci.json'))['workflow_runs'][0]
print(r['status'], r['conclusion'] or '-')" 2>/dev/null)
  echo "$(date +%H:%M:%S) run=$st"
  case "$st" in
    "completed"*) break ;;
  esac
  sleep 30
done
RID=$(python3 -c "import json;print(json.load(open('/tmp/ci.json'))['workflow_runs'][0]['id'])")
curl -s -H "Authorization: Bearer $T" "$API/actions/runs/$RID/jobs" -o /tmp/cijobs.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/cijobs.json'))
for j in d.get('jobs', []):
    print('JOB:', j['name'], '=>', j['conclusion'], '|', j.get('html_url'))
    for s in j.get('steps', []):
        if s.get('conclusion') not in ('success', 'skipped', None):
            print('   失败步骤:', s['number'], s['name'], '->', s['conclusion'])
PY
