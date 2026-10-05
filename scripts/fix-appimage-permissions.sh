#!/usr/bin/env bash
set -euo pipefail

appimage="${1:?请提供 AppImage 路径}"
test -f "$appimage"
appimage="$(realpath "$appimage")"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# linuxdeploy 可能将入口文件打包为 770，导致其他用户无法通过 AppRun 启动应用。
offset="$("$appimage" --appimage-offset)"
[[ "$offset" =~ ^[0-9]+$ ]]
cd "$workdir"
"$appimage" --appimage-extract >/dev/null
test -f squashfs-root/AppRun.wrapped
chmod 755 squashfs-root/AppRun.wrapped

# 保留原有 AppImage 运行时，重新生成包含正确权限的 SquashFS。
head -c "$offset" "$appimage" > runtime
mksquashfs squashfs-root filesystem.squashfs -noappend -comp zstd -all-root -quiet >/dev/null
cat runtime filesystem.squashfs > fixed.AppImage
chmod 755 fixed.AppImage

# 重新解包最终产物，确认修复后的执行位确实写入了镜像。
mkdir verify
cd verify
../fixed.AppImage --appimage-extract >/dev/null
test "$(stat -c '%a' squashfs-root/AppRun.wrapped)" = 755
test -x squashfs-root/usr/bin/coolapk_desktop
mv ../fixed.AppImage "$appimage"
