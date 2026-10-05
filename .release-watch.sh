#!/bin/bash
# 等 v0.1.0 的 Release 出现（CI 打 tag 后自动发布），出现即打印资产
T=$(cat ~/.github_token | tr -d '\n\r')
API=https://api.github.com/repos/SymonChu/coolapk-windows
for i in $(seq 1 60); do
  curl -s -H "Authorization: Bearer $T" "$API/releases" -o /tmp/rel.json
  n=$(python3 -c "import json;print(len(json.load(open('/tmp/rel.json'))))" 2>/dev/null || echo 0)
  if [ "$n" -gt 0 ] 2>/dev/null; then
    python3 - <<'PY'
import json
r=json.load(open('/tmp/rel.json'))[0]
print('RELEASE_OK', r['tag_name'], '|', r['name'], '|', r['published_at'])
for a in r.get('assets', []):
    print('   资产:', a['name'], round(a['size']/1048576,2), 'MB', a['browser_download_url'])
PY
    exit 0
  fi
  echo "$(date +%H:%M:%S) 第 $i 次：Release 还没出来"
  sleep 60
done
echo "RELEASE_TIMEOUT"
exit 1
