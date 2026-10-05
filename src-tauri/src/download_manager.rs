use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::watch;

/// 单个下载任务的控制信号。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DownloadControl {
    Run,
    Pause,
    Cancel,
}

/// 保存正在运行任务的控制通道；任务历史由前端持久化，避免 Rust 状态和页面状态重复存储。
pub struct DownloadManager {
    controls: Mutex<HashMap<String, watch::Sender<DownloadControl>>>,
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new()
    }
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            controls: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(&self, task_id: &str) -> Result<watch::Receiver<DownloadControl>, String> {
        let (sender, receiver) = watch::channel(DownloadControl::Run);
        let mut controls = self
            .controls
            .lock()
            .map_err(|_| "下载任务控制器不可用".to_string())?;
        if controls.contains_key(task_id) {
            return Err("下载任务已经在运行".to_string());
        }
        controls.insert(task_id.to_string(), sender);
        Ok(receiver)
    }

    pub fn request(&self, task_id: &str, control: DownloadControl) -> Result<(), String> {
        let controls = self
            .controls
            .lock()
            .map_err(|_| "下载任务控制器不可用".to_string())?;
        let sender = controls
            .get(task_id)
            .ok_or_else(|| "下载任务当前没有运行".to_string())?;
        sender
            .send(control)
            .map_err(|_| "下载任务已经结束".to_string())
    }

    pub fn finish(&self, task_id: &str) {
        if let Ok(mut controls) = self.controls.lock() {
            controls.remove(task_id);
        }
    }
}
