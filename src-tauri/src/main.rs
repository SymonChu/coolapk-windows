#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    coolapk_windows_lib::startup_trace_begin();
    coolapk_windows_lib::startup_trace("main() 进入");
    if coolapk_windows_lib::try_run_portable_update_helper() {
        coolapk_windows_lib::startup_trace("作为便携版更新助手运行，结束");
        return;
    }
    coolapk_windows_lib::startup_trace("非更新助手模式，进入 run()");
    coolapk_windows_lib::run();
    coolapk_windows_lib::startup_trace("run() 已返回");
}
