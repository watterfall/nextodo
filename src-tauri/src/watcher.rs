use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

/// Start watching the data file for external changes
pub fn start_watcher(app_handle: AppHandle) -> notify::Result<()> {
    let (tx, rx) = channel();

    let mut watcher = RecommendedWatcher::new(
        move |res| {
            if let Err(e) = tx.send(res) {
                eprintln!("Error sending file event: {}", e);
            }
        },
        Config::default().with_poll_interval(Duration::from_secs(2)),
    )?;

    // Get app data directory
    if let Ok(data_dir) = app_handle.path().app_data_dir() {
        // Ensure directory exists
        if !data_dir.exists() {
            std::fs::create_dir_all(&data_dir).ok();
        }

        // Watch the data directory
        watcher.watch(data_dir.as_path(), RecursiveMode::NonRecursive)?;

        println!("Watching for file changes in: {:?}", data_dir);

        // Process events
        loop {
            match rx.recv() {
                Ok(event) => {
                    if let Ok(event) = event {
                        // Check if the changed file is our data file
                        for path in event.paths {
                            if path.file_name().map_or(false, |n| n == "focusflow_data.json") {
                                println!("Data file changed externally");

                                // Emit event to frontend
                                if let Err(e) = app_handle.emit("data-file-changed", ()) {
                                    eprintln!("Failed to emit event: {}", e);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Watch error: {}", e);
                    break;
                }
            }
        }
    }

    Ok(())
}
