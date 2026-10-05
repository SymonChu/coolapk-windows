#[cfg(any(target_os = "android", target_os = "ios", test))]
use std::path::Path;
use std::path::PathBuf;

pub struct UploadSource {
    pub path: PathBuf,
    temporary_directory: Option<PathBuf>,
}
impl Drop for UploadSource {
    fn drop(&mut self) {
        if let Some(directory) = &self.temporary_directory {
            // 只删除本次创建、由应用拥有的临时目录，不操作所选原文件。
            let _ = std::fs::remove_dir_all(directory);
        }
    }
}

fn file_url_path(value: &str) -> Result<PathBuf, String> {
    reqwest::Url::parse(value)
        .map_err(|_| "文件 URI 格式无效".to_string())?
        .to_file_path()
        .map_err(|_| "文件 URI 不能转换为本地路径".to_string())
}

#[cfg(any(target_os = "android", target_os = "ios", test))]
fn stage_reader(
    reader: &mut impl std::io::Read,
    cache: &Path,
    name: &str,
) -> Result<UploadSource, String> {
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let directory = cache.join(format!(
        "cdn-upload-{stamp}-{}",
        SEQUENCE.fetch_add(1, Ordering::Relaxed)
    ));
    std::fs::create_dir_all(cache).map_err(|e| format!("创建上传缓存失败：{e}"))?;
    std::fs::create_dir(&directory).map_err(|e| format!("创建上传临时目录失败：{e}"))?;
    let name = name.replace(['/', '\\', '\0'], "_");
    let name = if name.trim().is_empty() || name == "." || name == ".." {
        "上传文件"
    } else {
        &name
    };
    let source = UploadSource {
        path: directory.join(name),
        temporary_directory: Some(directory),
    };
    let mut output = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&source.path)
        .map_err(|e| format!("创建上传临时文件失败：{e}"))?;
    // 文档提供器可能返回不可 seek 的流；先分块落盘，再复用 MD5 和流式上传。
    std::io::copy(reader, &mut output).map_err(|e| format!("读取所选文件失败：{e}"))?;
    drop(output);
    Ok(source)
}

pub async fn resolve(app: &tauri::AppHandle, value: &str) -> Result<UploadSource, String> {
    if !value.starts_with("content://") && !value.starts_with("file://") {
        return Ok(UploadSource {
            path: PathBuf::from(value),
            temporary_directory: None,
        });
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let _ = app;
        if value.starts_with("content://") {
            return Err("此文件需要通过 Android 文件选择器读取".to_string());
        }
        Ok(UploadSource {
            path: file_url_path(value)?,
            temporary_directory: None,
        })
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        use tauri::Manager;
        use tauri_plugin_fs::FsExt;
        let url = reqwest::Url::parse(value).map_err(|e| format!("文件 URI 无效：{e}"))?;
        #[cfg(target_os = "android")]
        let name = if value.starts_with("content://") {
            super::commands::call_android_update_method(app, "getUploadFileName", value.to_string())
                .await?
        } else {
            file_url_path(value)?
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .ok_or("文件名无效")?
        };
        #[cfg(target_os = "ios")]
        let name = file_url_path(value)?
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .ok_or("文件名无效")?;
        let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
        let app = app.clone();
        tokio::task::spawn_blocking(move || {
            let location = tauri_plugin_fs::FilePath::Url(url);
            let result = (|| {
                let mut reader = app
                    .fs()
                    .open(
                        location.clone(),
                        tauri_plugin_fs::OpenOptions::new().read(true).clone(),
                    )
                    .map_err(|e| format!("打开所选文件失败，请重新选择文件：{e}"))?;
                stage_reader(&mut reader, &cache, &name)
            })();
            #[cfg(target_os = "ios")]
            let _ = app.fs().stop_accessing_security_scoped_resource(location);
            result
        })
        .await
        .map_err(|e| format!("准备上传文件失败：{e}"))?
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_url_decodes_filename() {
        #[cfg(windows)]
        let url = "file:///C:/Temp/%E5%9B%BE%E7%89%87%20a.png";
        #[cfg(not(windows))]
        let url = "file:///tmp/%E5%9B%BE%E7%89%87%20a.png";
        assert_eq!(
            file_url_path(url).unwrap().file_name().unwrap(),
            "图片 a.png"
        );
        assert!(file_url_path("content://media/external/images/1").is_err());
    }
    #[test]
    fn stages_non_seekable_reader_and_cleans_only_copy() {
        let cache = std::env::temp_dir();
        let bytes = b"unchanged source bytes";
        let mut reader = &bytes[..];
        let source = stage_reader(&mut reader, &cache, "../原图.png").unwrap();
        assert_eq!(std::fs::read(&source.path).unwrap(), bytes);
        let path = source.path.clone();
        assert_eq!(path.file_name().unwrap(), ".._原图.png");
        drop(source);
        assert!(!path.exists());
        assert!(cache.exists());
    }
}
