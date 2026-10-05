//! macOS / Linux 更新：先检查并准备安装，再交给独立助手等待旧进程退出和重启。

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn package_version(name: &str) -> Option<semver::Version> {
    let value = if let Some(rest) = name.strip_prefix("coolapk-desktop_") {
        rest.split_once('_')?.0
    } else {
        let rest = name.strip_prefix("coolapk-desktop-")?;
        let end = rest.find(".x86_64").or_else(|| rest.find(".aarch64"))?;
        rest[..end].rsplit_once('-')?.0
    };
    semver::Version::parse(value.trim_start_matches('v')).ok()
}

// 系统包管理器采用自己的预发布排序，确保正式版可以接替同目标的测试版。
#[cfg(any(target_os = "linux", test))]
fn system_package_version(version: &str, kind: &str) -> String {
    if let Some((base, number)) = version.split_once("-beta.") {
        if kind == "deb" {
            format!("{base}~beta.{number}")
        } else {
            format!("{base}-0.beta.{number}")
        }
    } else if kind == "rpm" {
        format!("{version}-1")
    } else {
        version.to_string()
    }
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn matches_arch(name: &str, arch: &str) -> bool {
    let aliases: &[&str] = match arch {
        "x86_64" => &["x64", "amd64", "x86_64"],
        "aarch64" => &["arm64", "aarch64"],
        _ => return false,
    };
    aliases.iter().any(|alias| {
        name.match_indices(alias).any(|(index, _)| {
            let before = name.as_bytes().get(index.wrapping_sub(1));
            let after = name.as_bytes().get(index + alias.len());
            (index == 0 || before.is_some_and(|c| matches!(c, b'-' | b'_' | b'.')))
                && (after.is_none() || after.is_some_and(|c| matches!(c, b'-' | b'_' | b'.')))
        })
    })
}

// 直接读取 Mach-O / Universal 头，避免用户更新时需要安装 Xcode 命令行工具。
#[cfg(any(target_os = "macos", test))]
fn macho_supports_arch(header: &[u8], arch: &str) -> bool {
    let expected = match arch {
        "x86_64" => 0x0100_0007,
        "aarch64" => 0x0100_000c,
        _ => return false,
    };
    let Some(magic) = header.get(..4) else {
        return false;
    };
    let (little, stride) = match magic {
        [0xcf, 0xfa, 0xed, 0xfe] => (true, 0),
        [0xfe, 0xed, 0xfa, 0xcf] => (false, 0),
        [0xca, 0xfe, 0xba, 0xbe] => (false, 20),
        [0xbe, 0xba, 0xfe, 0xca] => (true, 20),
        [0xca, 0xfe, 0xba, 0xbf] => (false, 32),
        [0xbf, 0xba, 0xfe, 0xca] => (true, 32),
        _ => return false,
    };
    let word = |offset: usize| -> Option<u32> {
        let bytes = header.get(offset..offset + 4)?.try_into().ok()?;
        Some(if little {
            u32::from_le_bytes(bytes)
        } else {
            u32::from_be_bytes(bytes)
        })
    };
    if stride == 0 {
        return word(4) == Some(expected);
    }
    let Some(count) = word(4) else {
        return false;
    };
    count > 0
        && count <= 32
        && header.len() >= 8 + count as usize * stride
        && (0..count as usize).any(|index| word(8 + index * stride) == Some(expected))
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
pub use native::{distribution, install};

// 单元测试也编译两个平台的安装实现，便于在 Windows 发现 Rust/Tauri API 类型错误。
// 实际安装仍只由对应平台的分支调用。
#[cfg(any(target_os = "macos", target_os = "linux", test))]
#[cfg_attr(test, allow(dead_code))]
mod native {
    use super::super::commands::update_cache_dir;
    use super::{matches_arch, package_version};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::process::{Command, Stdio};
    use std::time::{SystemTime, UNIX_EPOCH};

    // AppImage 为其内置工具设置的环境不能传给系统安装工具或新的 AppImage。
    fn system_command(program: &str) -> Command {
        let mut command = Command::new(program);
        for key in ["APPIMAGE", "APPDIR", "OWD", "LD_LIBRARY_PATH", "LD_PRELOAD"] {
            command.env_remove(key);
        }
        command.env("PATH", "/usr/bin:/bin:/usr/sbin:/sbin");
        command
    }

    fn output(command: &mut Command) -> Result<String, String> {
        let result = command
            .output()
            .map_err(|error| format!("无法运行安装工具：{error}"))?;
        if !result.status.success() {
            let detail = String::from_utf8_lossy(&result.stderr);
            return Err(format!("安装工具执行失败：{}", detail.trim()));
        }
        Ok(String::from_utf8_lossy(&result.stdout).trim().to_string())
    }

    #[cfg(any(target_os = "macos", test))]
    fn current_app() -> Option<PathBuf> {
        let executable = std::env::current_exe().ok()?.canonicalize().ok()?;
        let app = executable
            .ancestors()
            .find(|path| path.extension().is_some_and(|ext| ext == "app"))?;
        if app.starts_with("/Volumes") || app.to_string_lossy().contains("/AppTranslocation/") {
            return None;
        }
        Some(app.to_path_buf())
    }

    #[cfg(any(target_os = "linux", test))]
    fn current_appimage() -> Option<PathBuf> {
        let path = PathBuf::from(std::env::var_os("APPIMAGE")?);
        // $APPIMAGE 是原始镜像位置；current_exe 是 /tmp/.mount_*/usr/bin 内的程序。
        if !path.is_absolute() {
            return None;
        }
        let path = path.canonicalize().ok()?;
        let current = std::env::current_exe().ok()?.canonicalize().ok()?;
        let appdir = PathBuf::from(std::env::var_os("APPDIR")?)
            .canonicalize()
            .ok()?;
        if !path.is_file() || !current.starts_with(appdir) {
            return None;
        }
        Some(path)
    }

    pub fn distribution() -> &'static str {
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            "unsupported"
        }
        #[cfg(target_os = "macos")]
        {
            if current_app().is_some() {
                "installer"
            } else {
                "unsupported"
            }
        }
        #[cfg(target_os = "linux")]
        {
            if current_appimage().is_some() {
                return "portable";
            }
            let Ok(executable) = std::env::current_exe().and_then(fs::canonicalize) else {
                return "unsupported";
            };
            if let Ok(owner) = output(
                system_command("/usr/bin/dpkg-query")
                    .args(["-S"])
                    .arg(&executable),
            ) {
                if owner.lines().any(|line| {
                    line.starts_with("coolapk-desktop: ") || line.starts_with("coolapk-desktop:")
                }) {
                    return "deb";
                }
            }
            if output(
                system_command("/usr/bin/rpm")
                    .args(["-qf", "--queryformat", "%{NAME}"])
                    .arg(&executable),
            )
            .is_ok_and(|owner| owner == "coolapk-desktop")
            {
                return "rpm";
            }
            "unsupported"
        }
    }

    fn prepare_paths(target: &Path) -> Result<(PathBuf, PathBuf), String> {
        let parent = target.parent().ok_or("无法定位安装目录")?;
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos();
        let stem = format!(".coolapk-update-{}-{nonce}", std::process::id());
        let staged = parent.join(format!("{stem}.new"));
        let backup = parent.join(format!("{stem}.backup"));
        // 同目录写权限检查在退出旧程序前完成。
        let probe = parent.join(format!("{stem}.probe"));
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&probe)
            .map_err(|error| format!("安装目录不可写，请将应用移到可写目录或手动更新：{error}"))?;
        fs::remove_file(probe).map_err(|error| error.to_string())?;
        Ok((staged, backup))
    }

    fn launch_helper(
        app: &tauri::AppHandle,
        mode: &str,
        target: &Path,
        staged: &Path,
        backup: &Path,
    ) -> Result<(), String> {
        let cache = update_cache_dir(app)?;
        fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
        let error_file = cache.join("install-error.txt");
        let _ = fs::remove_file(&error_file);
        let log = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(cache.join("install.log"))
            .map_err(|e| e.to_string())?;
        system_command("/bin/sh")
            .args([
                "-c",
                include_str!("desktop-update.sh"),
                "coolapk-update",
                mode,
            ])
            .arg(std::process::id().to_string())
            .arg(target)
            .arg(staged)
            .arg(backup)
            .arg(error_file)
            .stdin(Stdio::null())
            .stderr(Stdio::from(log.try_clone().map_err(|e| e.to_string())?))
            .stdout(Stdio::from(log))
            .spawn()
            .map_err(|e| format!("启动更新助手失败：{e}"))?;
        Ok(())
    }

    pub fn install(app: &tauri::AppHandle, location: &str, portable: bool) -> Result<(), String> {
        let package = fs::canonicalize(location).map_err(|_| "更新包不存在，请重新下载")?;
        let cache = update_cache_dir(app)?
            .canonicalize()
            .map_err(|e| e.to_string())?;
        if package.parent() != Some(cache.as_path()) || !package.is_file() {
            return Err("拒绝安装不在应用更新目录内的文件".to_string());
        }
        let name = package
            .file_name()
            .and_then(|v| v.to_str())
            .ok_or("更新文件名无效")?;
        let version = package_version(name).ok_or("更新包版本号无效")?;
        if version <= app.package_info().version || !matches_arch(name, std::env::consts::ARCH) {
            return Err("更新包版本或架构不适用于当前程序".to_string());
        }
        let kind = distribution();
        if kind == "unsupported" || portable != (kind == "portable") {
            return Err("更新包与当前安装方式不匹配".to_string());
        }
        #[cfg(target_os = "macos")]
        {
            if !name.to_ascii_lowercase().ends_with(".dmg") {
                return Err("macOS 更新需要 DMG 文件".to_string());
            }
            install_macos(app, &package, &version.to_string())
        }
        #[cfg(target_os = "linux")]
        {
            match kind {
                "portable" if name.to_ascii_lowercase().ends_with(".appimage") => {
                    install_appimage(app, &package)
                }
                "deb" | "rpm" if name.ends_with(&format!(".{kind}")) => {
                    install_linux_package(app, &package, kind, &version.to_string())
                }
                _ => Err("更新包与当前 Linux 安装方式不匹配".to_string()),
            }
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            Err("当前平台不使用 Unix 更新助手".to_string())
        }
    }

    #[cfg(any(target_os = "linux", test))]
    fn install_appimage(app: &tauri::AppHandle, package: &Path) -> Result<(), String> {
        use std::io::Read;
        let mut header = [0u8; 20];
        fs::File::open(package)
            .and_then(|mut f| f.read_exact(&mut header))
            .map_err(|e| e.to_string())?;
        let machine = u16::from_le_bytes([header[18], header[19]]);
        let expected = if std::env::consts::ARCH == "x86_64" {
            62
        } else {
            183
        };
        if &header[..4] != b"\x7fELF"
            || &header[8..11] != b"AI\x02"
            || header[5] != 1
            || machine != expected
        {
            return Err("AppImage 格式或架构不正确".to_string());
        }
        let target = current_appimage().ok_or("无法定位当前 AppImage")?;
        let (staged, backup) = prepare_paths(&target)?;
        fs::copy(package, &staged).map_err(|e| format!("准备更新失败：{e}"))?;
        if let Err(error) = output(system_command("/bin/chmod").arg("755").arg(&staged)) {
            let _ = fs::remove_file(&staged);
            return Err(error);
        }
        if let Err(error) = launch_helper(app, "appimage", &target, &staged, &backup) {
            let _ = fs::remove_file(staged);
            return Err(error);
        }
        Ok(())
    }

    #[cfg(any(target_os = "linux", test))]
    fn install_linux_package(
        app: &tauri::AppHandle,
        package: &Path,
        kind: &str,
        expected_version: &str,
    ) -> Result<(), String> {
        let metadata = if kind == "deb" {
            output(
                system_command("/usr/bin/dpkg-deb")
                    .arg("-f")
                    .arg(package)
                    .args(["Package", "Version", "Architecture"]),
            )?
            .lines()
            .filter_map(|line| line.split_once(": ").map(|(_, value)| value.to_string()))
            .collect::<Vec<_>>()
        } else {
            output(
                system_command("/usr/bin/rpm")
                    .args(["-qp", "--queryformat", "%{NAME}\n%{VERSION}-%{RELEASE}\n%{ARCH}"])
                    .arg(package),
            )?
            .lines()
            .map(str::to_string)
            .collect::<Vec<_>>()
        };
        let arch = match (kind, std::env::consts::ARCH) {
            ("deb", "x86_64") => "amd64",
            ("deb", "aarch64") => "arm64",
            (_, "x86_64") => "x86_64",
            (_, "aarch64") => "aarch64",
            _ => "unknown",
        };
        let system_version = super::system_package_version(expected_version, kind);
        if metadata != ["coolapk-desktop", system_version.as_str(), arch] {
            return Err("安装包的名称、版本或架构与当前更新不一致".to_string());
        }
        let mut install = system_command("/usr/bin/pkexec");
        if kind == "deb" {
            install.args(["/usr/bin/dpkg", "-i"]);
        } else {
            install.args(["/usr/bin/rpm", "-U", "--"]);
        }
        // 授权取消/安装失败时返回错误，前端保持运行和待安装包，允许用户重试。
        let target = std::env::current_exe()
            .and_then(fs::canonicalize)
            .map_err(|e| e.to_string())?;
        output(install.arg(package))?;
        launch_helper(app, "restart", &target, Path::new(""), Path::new(""))
    }

    #[cfg(any(target_os = "macos", test))]
    fn plist(app: &Path, key: &str) -> Result<String, String> {
        output(
            system_command("/usr/libexec/PlistBuddy")
                .args(["-c", &format!("Print :{key}")])
                .arg(app.join("Contents/Info.plist")),
        )
    }

    #[cfg(any(target_os = "macos", test))]
    fn install_macos(
        app: &tauri::AppHandle,
        package: &Path,
        expected_version: &str,
    ) -> Result<(), String> {
        use std::io::Read;
        let target =
            current_app().ok_or("请先将应用从 DMG 移到 Applications 或其他可写目录，再更新")?;
        let (staged, backup) = prepare_paths(&target)?;
        let mount = update_cache_dir(app)?.join(format!("mount-{}", std::process::id()));
        fs::create_dir(&mount).map_err(|e| e.to_string())?;
        if let Err(error) = output(
            system_command("/usr/bin/hdiutil")
                .args(["attach", "-readonly", "-nobrowse", "-mountpoint"])
                .arg(&mount)
                .arg(package),
        ) {
            let _ = fs::remove_dir(&mount);
            return Err(error);
        }
        let prepared = (|| {
            let mut candidates = fs::read_dir(&mount)
                .map_err(|e| e.to_string())?
                .flatten()
                .map(|entry| entry.path())
                .filter(|path| path.extension().is_some_and(|ext| ext == "app"))
                .collect::<Vec<_>>();
            if candidates.len() != 1 {
                return Err("DMG 中没有唯一的应用包".to_string());
            }
            let source = candidates.remove(0);
            if fs::symlink_metadata(&source)
                .map_err(|e| e.to_string())?
                .file_type()
                .is_symlink()
                || plist(&source, "CFBundleIdentifier")? != app.config().identifier
                || plist(&source, "CFBundleShortVersionString")? != expected_version
            {
                return Err("DMG 内应用的标识或版本号不匹配".to_string());
            }
            let binary = plist(&source, "CFBundleExecutable")?;
            if binary.is_empty()
                || Path::new(&binary).components().count() != 1
                || binary.contains('/')
            {
                return Err("应用主程序路径不合法".to_string());
            }
            let mut header = Vec::new();
            fs::File::open(source.join("Contents/MacOS").join(binary))
                .and_then(|file| file.take(4096).read_to_end(&mut header))
                .map_err(|e| e.to_string())?;
            if !super::macho_supports_arch(&header, std::env::consts::ARCH) {
                return Err("DMG 内的应用不支持当前芯片架构".to_string());
            }
            output(
                system_command("/usr/bin/codesign")
                    .args(["--verify", "--deep", "--strict"])
                    .arg(&source),
            )?;
            output(system_command("/usr/bin/ditto").arg(&source).arg(&staged))?;
            output(
                system_command("/usr/bin/codesign")
                    .args(["--verify", "--deep", "--strict"])
                    .arg(&staged),
            )?;
            Ok(())
        })();
        let detached = output(system_command("/usr/bin/hdiutil").arg("detach").arg(&mount));
        let _ = fs::remove_dir(&mount);
        if let Err(error) = prepared.and(detached.map(|_| ())) {
            let _ = fs::remove_dir_all(&staged);
            return Err(error);
        }
        if let Err(error) = launch_helper(app, "macos", &target, &staged, &backup) {
            let _ = fs::remove_dir_all(staged);
            return Err(error);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_from_release_and_cached_packages() {
        for name in [
            "coolapk-desktop_1.28.0_x64.dmg",
            "coolapk-desktop_1.28.0_amd64-12-123.AppImage",
            "coolapk-desktop-1.28.0-1.x86_64-12-123.rpm",
        ] {
            assert_eq!(package_version(name).unwrap().to_string(), "1.28.0");
        }
        assert_eq!(
            package_version("coolapk-desktop-1.29.0-beta.2-1.x86_64.rpm")
                .unwrap()
                .to_string(),
            "1.29.0-beta.2"
        );
        assert!(package_version("other_1.28.0_amd64.deb").is_none());
        assert!(package_version("coolapk-desktop_bad_amd64.deb").is_none());
    }

    #[test]
    fn architectures_need_token_boundaries() {
        assert!(matches_arch(
            "coolapk-desktop-1.28.0-1.x86_64.rpm",
            "x86_64"
        ));
        assert!(matches_arch(
            "coolapk-desktop_1.28.0_aarch64.dmg",
            "aarch64"
        ));
        assert!(!matches_arch("coolapk-desktop_1.28.0_arm64.dmg", "x86_64"));
        assert!(!matches_arch(
            "coolapk-desktop_1.28.0_fakeamd64.deb",
            "x86_64"
        ));
        assert!(!matches_arch("coolapk-desktop_1.28.0_amd64.deb", "unknown"));
    }

    #[test]
    fn beta_system_package_versions_allow_final_release_upgrade() {
        assert_eq!(system_package_version("1.31.0-beta.101", "deb"), "1.31.0~beta.101");
        assert_eq!(system_package_version("1.31.0-beta.101", "rpm"), "1.31.0-0.beta.101");
        assert_eq!(system_package_version("1.31.0", "deb"), "1.31.0");
        assert_eq!(system_package_version("1.31.0", "rpm"), "1.31.0-1");
    }

    #[test]
    fn validates_thin_and_universal_macos_binaries() {
        let arm = [0xcf, 0xfa, 0xed, 0xfe, 0x0c, 0, 0, 1];
        assert!(macho_supports_arch(&arm, "aarch64"));
        assert!(!macho_supports_arch(&arm, "x86_64"));
        let mut universal = vec![0; 48];
        universal[..8].copy_from_slice(&[0xca, 0xfe, 0xba, 0xbe, 0, 0, 0, 2]);
        universal[8..12].copy_from_slice(&[1, 0, 0, 7]);
        universal[28..32].copy_from_slice(&[1, 0, 0, 12]);
        assert!(macho_supports_arch(&universal, "aarch64"));
        assert!(macho_supports_arch(&universal, "x86_64"));
        assert!(!macho_supports_arch(&universal[..30], "x86_64"));
        assert!(!macho_supports_arch(b"not a binary", "x86_64"));
    }
}
