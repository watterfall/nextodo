// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod watcher;

use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Manager;

/// Thread-safe state for controlling the file watcher
pub struct WatcherState {
    pub paused: AtomicBool,
}

impl WatcherState {
    pub fn new() -> Self {
        Self {
            paused: AtomicBool::new(false),
        }
    }
}

fn main() {
    // Create shared watcher state
    let watcher_state = Arc::new(WatcherState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .manage(watcher_state.clone())
        .setup(move |app| {
            // Start file watcher for auto-reload
            let app_handle = app.handle().clone();
            let watcher_state_clone = watcher_state.clone();
            std::thread::spawn(move || {
                if let Err(e) = watcher::start_watcher(app_handle, watcher_state_clone) {
                    eprintln!("Failed to start file watcher: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_data_path,
            commands::get_data_file_paths,
            commands::atomic_write_file,
            commands::read_data_file,
            commands::backup_data,
            commands::migrate_legacy_data,
            commands::get_system_info,
            commands::trigger_reload,
            commands::append_archive_tasks,
            commands::suspend_watcher,
            commands::resume_watcher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
