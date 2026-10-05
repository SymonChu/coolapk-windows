#!/bin/sh
# 参数全部由 Rust 以独立 argv 传入；不把路径插入 shell 源码。
set -u
mode=$1
pid=$2
target=$3
staged=$4
backup=$5
error_file=$6

fail() {
  printf '%s\n' "$1" > "$error_file"
  exit 1
}

launch() {
  if [ "$mode" = macos ]; then
    /usr/bin/open -n "$target"
  else
    "$target" </dev/null &
    new_pid=$!
    sleep 2
    kill -0 "$new_pid" 2>/dev/null
  fi
}

# 等待旧进程退出，超时保留原安装和下载包。
attempt=0
while kill -0 "$pid" 2>/dev/null; do
  attempt=$((attempt + 1))
  [ "$attempt" -le 120 ] || fail '更新未执行：旧程序未退出，请关闭其他实例后重试。'
  sleep 1
done

if [ "$mode" = restart ]; then
  launch || fail '安装完成，但重新启动失败，请手动打开酷安。'
  exit 0
fi

# staged/backup 都在原安装的父目录，rename 在同一文件系统内完成。
mv "$target" "$backup" || fail '无法备份原程序，已保留原安装，请检查目录权限。'
if ! mv "$staged" "$target"; then
  mv "$backup" "$target" || fail "替换和恢复失败，旧程序备份位于：$backup"
  printf '%s\n' '替换更新失败，已恢复原程序。' > "$error_file"
  launch || true
  exit 1
fi

if launch; then
  rm -rf "$backup"
  rm -f "$error_file"
else
  if ! mv "$target" "$staged" || ! mv "$backup" "$target"; then
    fail "新版启动和自动恢复失败，旧程序备份位于：$backup"
  fi
  printf '%s\n' '新版程序启动失败，已恢复旧版；下载包已保留，可再次尝试更新。' > "$error_file"
  launch || true
  exit 1
fi
