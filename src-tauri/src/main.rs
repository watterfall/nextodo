// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod watcher;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Start file watcher for auto-reload
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(e) = watcher::start_watcher(app_handle) {
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
            commands::append_archive_tasks
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
