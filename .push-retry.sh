#!/bin/bash
# 推送重试：直连/代理 交替，直到成功
cd /vol1/@appdata/trim.hermes/workspace/coolapk-windows || exit 1
for i in 1 2 3 4 5 6; do
  echo "=== 第 $i 次尝试 $(date +%H:%M:%S) ==="
  case $((i % 3)) in
    0) GITCMD=(git -c http.proxy=http://127.0.0.1:7890 -c http.version=HTTP/1.1 push origin main) ;;
    *) GITCMD=(git -c http.version=HTTP/1.1 push origin main) ;;
  esac
  if "${GITCMD[@]}"; then echo "PUSH_OK"; exit 0; fi
  sleep 12
done
echo "PUSH_FAILED"
exit 1
