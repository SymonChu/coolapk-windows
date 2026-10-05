#!/bin/sh
set -eu
repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
helper="$repo/src-tauri/src/coolapk/desktop-update.sh"
work=$(mktemp -d)
trap 'test ! -f "$work/child-pid" || kill "$(cat "$work/child-pid")" 2>/dev/null || true; rm -rf "$work"' EXIT
mkdir "$work/path with spaces and 'quotes'"
target="$work/path with spaces and 'quotes'/Coolapk.AppImage"
staged="$work/staged"
backup="$work/backup"
error_file="$work/install-error.txt"
export UPDATE_TEST_DIR="$work"

cat > "$target" <<'APP'
#!/bin/sh
printf '%s\n' old > "$UPDATE_TEST_DIR/started"
echo $$ > "$UPDATE_TEST_DIR/child-pid"
sleep 10
APP
cat > "$staged" <<'APP'
#!/bin/sh
printf '%s\n' new > "$UPDATE_TEST_DIR/started"
echo $$ > "$UPDATE_TEST_DIR/child-pid"
sleep 10
APP
chmod +x "$target" "$staged"
sh "$helper" appimage 99999999 "$target" "$staged" "$backup" "$error_file"
test "$(cat "$work/started")" = new
test ! -e "$backup"
test ! -e "$error_file"
kill "$(cat "$work/child-pid")" 2>/dev/null || true

# 新程序退出时恢复旧程序，保留待安装包和可在下次启动显示的错误。
cat > "$target" <<'APP'
#!/bin/sh
printf '%s\n' old > "$UPDATE_TEST_DIR/started"
echo $$ > "$UPDATE_TEST_DIR/child-pid"
sleep 10
APP
printf '#!/bin/sh\nexit 1\n' > "$staged"
chmod +x "$target" "$staged"
if sh "$helper" appimage 99999999 "$target" "$staged" "$backup" "$error_file"; then
  echo '未检测到启动失败' >&2
  exit 1
fi
test "$(cat "$work/started")" = old
test -s "$error_file"
test ! -e "$backup"
test -f "$staged"
kill "$(cat "$work/child-pid")" 2>/dev/null || true

# 旧进程仍在运行时不得替换。
sleep 3 &
old_pid=$!
printf '#!/bin/sh\nexit 1\n' > "$staged"
sh "$helper" appimage "$old_pid" "$target" "$staged" "$backup" "$error_file" &
helper_pid=$!
sleep 1
test ! -e "$backup"
test -f "$staged"
wait "$old_pid"
wait "$helper_pid" && exit 1
echo 'Desktop update helper: replacement, rollback, quoting and process wait passed'
