#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if coolapk_windows_lib::try_run_portable_update_helper() {
        return;
    }
    coolapk_windows_lib::run();
}
